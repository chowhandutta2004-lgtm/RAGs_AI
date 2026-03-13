# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAGs_AI is a full-stack Retrieval-Augmented Generation (RAG) application. Users sign in with Google, upload documents (PDF, DOCX, TXT, CSV), which are chunked and stored in a per-user ChromaDB collection. They can then chat with their own documents via a GPT-4o-powered backend. The frontend is deployed on Vercel; the backend on Render.

## Commands

### Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build (output to dist/)
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (FastAPI + Python)
```bash
cd backend
source venv/Scripts/activate   # Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn main:app --reload      # Start dev server at http://localhost:8000
```

Backend requires a `.env` file at `backend/.env` with:
```
OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

`service-account.json` must be placed in `backend/` (download from Firebase Console → Project Settings → Service Accounts). It is gitignored.

## Architecture

### Backend (`backend/`)
- **`main.py`** — FastAPI app. All endpoints require a Firebase ID token via `Authorization: Bearer <token>` header. The `get_current_user` dependency verifies the token and extracts `uid`. Passes `user_id` to every `RAGEngine` method call.
- **`rag_engine.py`** — Core RAG logic, fully per-user:
  - `_get_vectorstore(user_id)` — Returns a `Chroma` instance scoped to `collection_name=f"user_{user_id}"`
  - `_load_metadata(user_id)` / `_save_metadata(user_id, data)` — Persists document metadata to `./user_data/{user_id}/metadata.json`
  - `_extract_keywords(text)` — Counter-based word frequency, filters `STOP_WORDS` and words < 4 chars
  - `ingest_document(contents, filename, user_id)` — Chunks, embeds, stores in per-user ChromaDB collection; saves metadata + keywords to disk
  - `query(question, history, user_id)` — Similarity search against only this user's collection
  - `get_analytics(user_id)` — Loads persisted metadata; aggregates keywords across docs
  - `reset(user_id)` — Deletes only this user's ChromaDB collection and metadata file

### Frontend (`frontend/src/`)
- **`firebase.js`** — Firebase app init, `auth` export, `signInWithGoogle()`, `logOut()`
- **`AuthContext.jsx`** — `AuthProvider` wraps the app; `useAuth()` returns `{ user, loading }`
- **`main.jsx`** — Wraps `<App>` in `<BrowserRouter><AuthProvider>`
- **`App.jsx`** — Five routes: `/`, `/login`, `/upload`, `/chat`, `/analytics`. Protected routes redirect to `/login` if no user.
- **`pages/Login.jsx`** — Google sign-in page. On success, navigates to `/upload`.
- **`pages/Landing.jsx`** — Marketing page. Navbar shows login/logout based on auth state.
- **`pages/Upload.jsx`** — Drag-and-drop uploader. Sends `Authorization` header with every upload.
- **`pages/Chat.jsx`** — Chat interface. Uses `rags_ai_messages_{user.uid}` as sessionStorage key (per-user isolation). Sends auth token with every message.
- **`pages/Analytics.jsx`** — Document stats. Sends auth token to `/analytics`.

### Key Configuration
- **API URL**: Set via `VITE_API_URL` in `frontend/.env`. Production points to Render; local dev should point to `http://localhost:8000`
- **CORS**: Allowed origins hardcoded in `main.py`
- **Vercel routing**: `frontend/vercel.json` rewrites all paths to `/` for client-side routing
- **ChromaDB**: `backend/chroma_db/` — each user has their own collection (`user_{uid}`)
- **Metadata**: `backend/user_data/{uid}/metadata.json` — persists across server restarts

### Known Limitations
- Voice input only works in Chrome (`webkitSpeechRecognition`)
- Analytics mock data is shown when the backend is unreachable (not when authenticated but no docs)
