import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
    filter_filename: Optional[str] = None
    session_id: Optional[str] = None


class URLRequest(BaseModel):
    url: str


class TextRequest(BaseModel):
    title: str
    text: str


@app.get("/")
def root():
    return {"message": "RAGs_AI Backend is running!"}


@app.post("/upload")
@limiter.limit("20/minute")
async def upload_file(request: Request, file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    allowed = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.xls', '.pptx', '.md']
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


@app.post("/ingest-url")
@limiter.limit("10/minute")
async def ingest_url(request: Request, body: URLRequest, user_id: str = Depends(get_current_user)):
    try:
        result = get_rag().ingest_url(body.url, user_id)
        return {
            "message": f"✅ URL ingested successfully!",
            "filename": result["filename"],
            "chunks": result["chunks"],
            "words": result["words"]
        }
    except Exception as e:
        import traceback
        print("INGEST-URL ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest-text")
@limiter.limit("10/minute")
async def ingest_text(request: Request, body: TextRequest, user_id: str = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    try:
        result = get_rag().ingest_text(body.text, body.title, user_id)
        return {
            "message": f"✅ Text ingested successfully!",
            "filename": result["filename"],
            "chunks": result["chunks"],
            "words": result["words"]
        }
    except Exception as e:
        import traceback
        print("INGEST-TEXT ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest, user_id: str = Depends(get_current_user)):
    try:
        result = get_rag().query(body.question, body.history, user_id, filter_filename=body.filter_filename)
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


@app.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: ChatRequest, user_id: str = Depends(get_current_user)):
    async def event_generator():
        try:
            async for event in get_rag().query_stream(
                body.question,
                body.history,
                user_id,
                session_id=body.session_id,
                filter_filename=body.filter_filename
            ):
                yield event
        except Exception as e:
            import traceback
            print("STREAM ERROR:", traceback.format_exc())
            import json
            yield f'data: {json.dumps({"type": "error", "content": str(e)})}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/analytics")
def analytics(user_id: str = Depends(get_current_user)):
    try:
        return get_rag().get_analytics(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Session endpoints ─────────────────────────────────────────────────────────

@app.get("/sessions")
def get_sessions(user_id: str = Depends(get_current_user)):
    try:
        return get_rag().get_sessions(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sessions")
def create_session(user_id: str = Depends(get_current_user)):
    try:
        return get_rag().create_session(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, user_id: str = Depends(get_current_user)):
    try:
        messages = get_rag().get_session_messages(session_id, user_id)
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    try:
        get_rag().delete_session(session_id, user_id)
        return {"message": "Session deleted"}
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
