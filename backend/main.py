import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

_defaults = [
    "http://localhost:5173", "http://localhost:5174",
    "http://localhost:5175", "http://localhost:5176",
    "https://ra-gs-ai.vercel.app",
]
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = _defaults + _extra

app = FastAPI(title="RAGs_AI API", version="1.0.0")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin SDK (guard against double-init on hot reload)
if not firebase_admin._apps:
    _cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if _cred_path and os.path.exists(_cred_path):
        firebase_admin.initialize_app(credentials.Certificate(_cred_path))
    else:
        firebase_admin.initialize_app()

# Lazy load RAG engine to avoid startup crashes
rag = None

def get_rag():
    global rag
    if rag is None:
        from rag_engine import RAGEngine
        rag = RAGEngine()
    return rag

security = HTTPBearer()

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        decoded = firebase_auth.verify_id_token(creds.credentials)
        return decoded["uid"]
    except Exception as e:
        print("AUTH ERROR:", repr(e))
        raise HTTPException(status_code=401, detail=str(e))

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []

@app.get("/")
def root():
    return {"message": "RAGs_AI Backend is running!"}

@app.post("/upload")
@limiter.limit("20/minute")
async def upload_file(request: Request, file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    allowed = ['.pdf', '.docx', '.txt', '.csv']
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")
    MAX_SIZE = 20 * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
    try:
        result = get_rag().ingest_document(contents, file.filename, user_id)
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
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest, user_id: str = Depends(get_current_user)):
    try:
        result = get_rag().query(body.question, body.history, user_id)
        return {
            "answer": result["answer"],
            "sources": result["sources"],
            "confidence": result["confidence"],
            "used_context": result["used_context"]
        }
    except Exception as e:
        import traceback
        print("CHAT ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics")
def analytics(user_id: str = Depends(get_current_user)):
    try:
        return get_rag().get_analytics(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/document/{filename}")
def delete_document(filename: str, user_id: str = Depends(get_current_user)):
    if not re.match(r'^[\w\-. ]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    get_rag().delete_document(filename, user_id)
    return {"message": f"{filename} deleted"}

@app.delete("/reset")
def reset(user_id: str = Depends(get_current_user)):
    get_rag().reset(user_id)
    return {"message": "Vector store cleared!"}
