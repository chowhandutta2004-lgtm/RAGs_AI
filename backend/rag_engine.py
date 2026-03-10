import os
import io
import re
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

class RAGEngine:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in .env file!")

        # Embeddings model — converts text to vectors
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=self.openai_api_key,
            model="text-embedding-3-small"
        )

        # LLM — GPT-4o for generating answers
        self.llm = ChatOpenAI(
            openai_api_key=self.openai_api_key,
            model_name="gpt-4o",
            temperature=0.2  # Low temp = more precise, factual answers
        )

        # Text splitter — breaks documents into chunks
        # chunk_size=800 means ~800 chars per chunk
        # chunk_overlap=100 means chunks share 100 chars (prevents losing context at edges)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " "]
        )

        self.vectorstore = None
        self.documents_metadata = []
        self.persist_dir = "./chroma_db"

        # Load existing vectorstore if it exists
        if os.path.exists(self.persist_dir):
            try:
                self.vectorstore = Chroma(
                    persist_directory=self.persist_dir,
                    embedding_function=self.embeddings
                )
            except:
                pass

    def extract_text(self, contents: bytes, filename: str) -> str:
        """Extract raw text from different file types"""
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

    def ingest_document(self, contents: bytes, filename: str) -> Dict:
        """Process and store a document in the vector store"""
        # Step 1: Extract text
        text = self.extract_text(contents, filename)
        word_count = len(text.split())

        # Step 2: Split into chunks
        chunks = self.splitter.create_documents(
            texts=[text],
            metadatas=[{"source": filename, "filename": filename}]
        )

        # Step 3: Store in ChromaDB
        if self.vectorstore is None:
            self.vectorstore = Chroma.from_documents(
                documents=chunks,
                embedding=self.embeddings,
                persist_directory=self.persist_dir
            )
        else:
            self.vectorstore.add_documents(chunks)

        # Track metadata
        self.documents_metadata.append({
            "name": filename,
            "chunks": len(chunks),
            "words": word_count,
            "type": os.path.splitext(filename)[1].upper().replace(".", "")
        })

        return {"chunks": len(chunks), "words": word_count}

    def query(self, question: str, history: List[dict]) -> Dict:
        """Run RAG query and return answer with sources and confidence"""
        if self.vectorstore is None:
            return {
                "answer": "⚠️ No documents uploaded yet! Please upload a document first.",
                "sources": [],
                "confidence": 0.0
            }

        # Retrieve relevant chunks
        retriever = self.vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4}
)

        # Get docs with scores
        docs_with_scores = self.vectorstore.similarity_search_with_score(question, k=4)

        # Build sources list
        sources = []
        total_score = 0
        for doc, score in docs_with_scores:
            # ChromaDB returns L2 distance — lower is better
            # Convert to 0-1 confidence: closer to 0 distance = higher confidence
            confidence = max(0, 1 - (score / 2))
            total_score += confidence
            sources.append({
                "file": doc.metadata.get("filename", "unknown"),
                "page": doc.metadata.get("page", 1),
                "snippet": doc.page_content[:120].strip() + "..."
            })

        avg_confidence = total_score / len(docs_with_scores) if docs_with_scores else 0

        # Build conversation history for context
        chat_history = []
        for msg in history:
            if msg["role"] == "user":
                chat_history.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                chat_history.append(AIMessage(content=msg["content"]))

        # Build context from retrieved docs
        context = "\n\n".join([doc.page_content for doc, _ in docs_with_scores])

        # Create prompt with context
        prompt = f"""You are RAGs_AI, a friendly and intelligent document assistant.
You have two modes:
1. If the user is greeting you, making small talk, or asking general questions NOT related to documents — respond naturally and warmly like a helpful AI assistant.
2. If the user is asking something that can be answered from the document context below — answer precisely using that context and mention which document it came from.

Document Context:
{context}

Conversation Question: {question}

Respond naturally. If it's a greeting or casual message, just be friendly. If it's a document question, use the context above.
Answer:"""

        response = self.llm.invoke(prompt)

        return {
            "answer": response.content,
            "sources": sources[:3],
            "confidence": round(avg_confidence, 2)
        }

    def get_analytics(self) -> Dict:
        """Return analytics data about uploaded documents"""
        if not self.documents_metadata:
            return {
                "total_documents": 0,
                "total_chunks": 0,
                "total_words": 0,
                "documents": [],
                "top_keywords": []
            }

        total_chunks = sum(d["chunks"] for d in self.documents_metadata)
        total_words = sum(d["words"] for d in self.documents_metadata)

        return {
            "total_documents": len(self.documents_metadata),
            "total_chunks": total_chunks,
            "total_words": total_words,
            "documents": self.documents_metadata,
            "top_keywords": []
        }

    def reset(self):
        """Clear the vector store"""
        import shutil
        if os.path.exists(self.persist_dir):
            shutil.rmtree(self.persist_dir)
        self.vectorstore = None
        self.documents_metadata = []