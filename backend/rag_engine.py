import os
import io
import re
import json
from collections import Counter
from typing import List, Dict, Any
from dotenv import load_dotenv

# Document loaders
import pypdf
import docx
import csv

# LangChain
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

STOP_WORDS = {
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
    'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now',
    'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'men', 'own', 'say', 'she',
    'too', 'use', 'with', 'from', 'this', 'that', 'they', 'have', 'been', 'were', 'said',
    'each', 'which', 'their', 'will', 'when', 'more', 'what', 'some', 'than', 'into',
    'your', 'also', 'just', 'time', 'like', 'then', 'them', 'over', 'such', 'only',
    'come', 'could', 'there', 'would', 'other', 'about', 'these', 'many', 'well', 'much',
    'any', 'after', 'most', 'very', 'even', 'back', 'good', 'know', 'take', 'make',
    'does', 'part', 'need', 'same', 'long', 'down', 'both', 'here', 'through', 'think',
    'first', 'those', 'being', 'where', 'while', 'should', 'every', 'found', 'still',
    'between', 'without', 'during', 'before', 'under', 'never', 'always', 'made', 'give',
    'great', 'since', 'right', 'things', 'place', 'world', 'again', 'might', 'point',
    'large', 'general', 'however', 'often', 'show', 'going', 'used', 'small', 'number',
    'another', 'until', 'less', 'across', 'once', 'given', 'among', 'within', 'including',
    'along', 'himself', 'themselves', 'because', 'against', 'important', 'something',
    'whether', 'around', 'several', 'example', 'able', 'became', 'above', 'though',
    'either', 'together', 'already', 'later', 'although', 'years', 'people', 'work',
    'system', 'order', 'process', 'level', 'type', 'provide', 'following', 'total',
    'further', 'based', 'available', 'must', 'called', 'possible', 'include', 'result',
    'case', 'form', 'local', 'name', 'high', 'hand', 'seem', 'turn',
}


class RAGEngine:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in .env file!")

        self.embeddings = OpenAIEmbeddings(
            openai_api_key=self.openai_api_key,
            model="text-embedding-3-small"
        )

        self.llm = ChatOpenAI(
            openai_api_key=self.openai_api_key,
            model_name="gpt-4o",
            temperature=0.2
        )

        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " "]
        )

        self.persist_dir = "./chroma_db"
        self.user_data_dir = "./user_data"

    def _get_vectorstore(self, user_id: str) -> Chroma:
        return Chroma(
            collection_name=f"user_{user_id}",
            persist_directory=self.persist_dir,
            embedding_function=self.embeddings
        )

    def _load_metadata(self, user_id: str) -> list:
        path = os.path.join(self.user_data_dir, user_id, "metadata.json")
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        return []

    def _save_metadata(self, user_id: str, data: list):
        dir_path = os.path.join(self.user_data_dir, user_id)
        os.makedirs(dir_path, exist_ok=True)
        path = os.path.join(dir_path, "metadata.json")
        with open(path, "w") as f:
            json.dump(data, f)

    def _extract_keywords(self, text: str, top_n: int = 10) -> list:
        words = re.findall(r'\b[a-z]{4,}\b', text.lower())
        filtered = [w for w in words if w not in STOP_WORDS]
        counter = Counter(filtered)
        return [{"word": word, "count": count} for word, count in counter.most_common(top_n)]

    def extract_text(self, contents: bytes, filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.pdf':
            reader = pypdf.PdfReader(io.BytesIO(contents))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text

        elif ext == '.docx':
            doc = docx.Document(io.BytesIO(contents))
            return "\n".join([para.text for para in doc.paragraphs])

        elif ext == '.txt':
            return contents.decode('utf-8', errors='ignore')

        elif ext == '.csv':
            text = ""
            reader = csv.reader(io.StringIO(contents.decode('utf-8', errors='ignore')))
            for row in reader:
                text += ", ".join(row) + "\n"
            return text

        raise ValueError(f"Unsupported file type: {ext}")

    def ingest_document(self, contents: bytes, filename: str, user_id: str) -> Dict:
        existing = self._load_metadata(user_id)
        if any(d["name"] == filename for d in existing):
            self.delete_document(filename, user_id)
        text = self.extract_text(contents, filename)
        word_count = len(text.split())
        keywords = self._extract_keywords(text)

        chunks = self.splitter.create_documents(
            texts=[text],
            metadatas=[{"source": filename, "filename": filename}]
        )

        vectorstore = self._get_vectorstore(user_id)
        vectorstore.add_documents(chunks)

        metadata = self._load_metadata(user_id)
        metadata.append({
            "name": filename,
            "chunks": len(chunks),
            "words": word_count,
            "type": os.path.splitext(filename)[1].upper().replace(".", ""),
            "keywords": keywords
        })
        self._save_metadata(user_id, metadata)

        return {"chunks": len(chunks), "words": word_count}

    def query(self, question: str, history: List[dict], user_id: str) -> Dict:
        vectorstore = self._get_vectorstore(user_id)

        try:
            count = len(vectorstore.get()['ids'])
        except Exception:
            count = 0

        if count == 0:
            return {
                "answer": "No documents uploaded yet! Please upload a document first.",
                "sources": [],
                "confidence": 0.0,
                "used_context": False
            }

        docs_with_scores = vectorstore.similarity_search_with_score(question, k=4)

        # Score each result
        scored = []
        for doc, score in docs_with_scores:
            confidence = max(0, 1 - (score / 2))
            scored.append((doc, score, confidence))

        avg_confidence = sum(c for _, _, c in scored) / len(scored) if scored else 0
        max_confidence = max((c for _, _, c in scored), default=0)

        # Use document context if the BEST matching chunk clears the threshold.
        # Using max (not avg) so that even one highly-relevant chunk triggers context.
        RELEVANCE_THRESHOLD = 0.20
        CASUAL_THRESHOLD = 0.10  # below this = pure small talk
        use_context = max_confidence >= RELEVANCE_THRESHOLD

        chat_history = []
        for msg in history:
            if msg["role"] == "user":
                chat_history.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                chat_history.append(AIMessage(content=msg["content"]))

        if use_context:
            context = "\n\n".join([doc.page_content for doc, _, _ in scored])
            prompt = f"""You are RAGs_AI, a document assistant. The user has uploaded documents and is asking a question.
Answer using the document context below. Be precise and always state which document the answer comes from.
If the context does not contain enough information, say so clearly — do NOT make up an answer.

Document Context:
{context}

Question: {question}

Answer:"""
        elif max_confidence >= CASUAL_THRESHOLD:
            # Question might be about docs but similarity is too low — guide the user
            prompt = f"""You are RAGs_AI, a document assistant. The user has uploaded documents but their question did not closely match anything in them.
Respond helpfully, let them know you couldn't find a strong match in their documents, and suggest they rephrase or be more specific.

Question: {question}

Answer:"""
        else:
            # Pure small talk / completely unrelated
            prompt = f"""You are RAGs_AI, a friendly assistant. The user is making small talk. Respond naturally and warmly.

Question: {question}

Answer:"""

        response = self.llm.invoke(prompt)

        # Deduplicate sources by filename, only when context was used
        sources = []
        if use_context:
            seen_files = set()
            for doc, _, confidence in scored:
                filename = doc.metadata.get("filename", "unknown")
                if filename not in seen_files and confidence >= CASUAL_THRESHOLD:
                    seen_files.add(filename)
                    sources.append({
                        "file": filename,
                        "page": doc.metadata.get("page", 1),
                        "snippet": doc.page_content[:120].strip() + "..."
                    })

        return {
            "answer": response.content,
            "sources": sources[:2],
            "confidence": round(avg_confidence, 2) if use_context else None,
            "used_context": use_context
        }

    def get_analytics(self, user_id: str) -> Dict:
        metadata = self._load_metadata(user_id)
        if not metadata:
            return {
                "total_documents": 0,
                "total_chunks": 0,
                "total_words": 0,
                "documents": [],
                "top_keywords": []
            }

        total_chunks = sum(d["chunks"] for d in metadata)
        total_words = sum(d["words"] for d in metadata)

        combined = Counter()
        for doc in metadata:
            for kw in doc.get("keywords", []):
                combined[kw["word"]] += kw["count"]
        top_keywords = [{"word": w, "count": c} for w, c in combined.most_common(10)]

        return {
            "total_documents": len(metadata),
            "total_chunks": total_chunks,
            "total_words": total_words,
            "documents": [
                {"name": d["name"], "chunks": d["chunks"], "words": d["words"], "type": d["type"]}
                for d in metadata
            ],
            "top_keywords": top_keywords
        }

    def delete_document(self, filename: str, user_id: str):
        vectorstore = self._get_vectorstore(user_id)
        try:
            results = vectorstore.get(where={"filename": filename})
            ids_to_delete = results.get("ids", [])
            if ids_to_delete:
                vectorstore.delete(ids=ids_to_delete)
        except Exception:
            pass

        metadata = self._load_metadata(user_id)
        metadata = [d for d in metadata if d["name"] != filename]
        self._save_metadata(user_id, metadata)

    def reset(self, user_id: str):
        import shutil
        vectorstore = self._get_vectorstore(user_id)
        try:
            vectorstore.delete_collection()
        except Exception:
            pass
        user_dir = os.path.join(self.user_data_dir, user_id)
        if os.path.exists(user_dir):
            shutil.rmtree(user_dir)
