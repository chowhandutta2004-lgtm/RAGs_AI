from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os

app = FastAPI(title="RAGs_AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "https://ra-gs-ai.vercel.app"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy load RAG engine to avoid startup crashes
rag = None

def get_rag():
    global rag
    if rag is None:
        from rag_engine import RAGEngine
        rag = RAGEngine()
    return rag

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []

@app.get("/")
def root():
    return {"message": "RAGs_AI Backend is running! 🚀"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = ['.pdf', '.docx', '.txt', '.csv']
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")
    contents = await file.read()
    try:
        result = get_rag().ingest_document(contents, file.filename)
        return {
            "message": f"✅ {file.filename} processed successfully!",
            "chunks": result["chunks"],
            "words": result["words"]
        }
    except Exception as e:
        import traceback
        print("UPLOAD ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        result = get_rag().query(request.question, request.history)
        return {
            "answer": result["answer"],
            "sources": result["sources"],
            "confidence": result["confidence"]
        }
    except Exception as e:
        import traceback
        print("CHAT ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics")
def analytics():
    try:
        return get_rag().get_analytics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reset")
def reset():
    get_rag().reset()
    return {"message": "Vector store cleared!"}