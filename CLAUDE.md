# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAGs_AI is a full-stack Retrieval-Augmented Generation (RAG) application. Users sign in with Google, upload documents, which are chunked and stored in a per-user ChromaDB collection. They can then chat with their own documents via a GPT-4o-powered backend.

- **Frontend**: React + Vite + Tailwind, deployed on Vercel (`https://askmydocs-omega.vercel.app`)
- **Backend**: FastAPI + Python, deployed on Render (`rags-ai-backend`, Oregon, free plan)
- **Auth**: Firebase (Google sign-in), token verified on every backend request
- **Vector DB**: ChromaDB (local persistent), per-user collection isolation
- **LLM**: GPT-4o via LangChain (`ChatOpenAI`, temp=0.2)
- **Embeddings**: `text-embedding-3-small`

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

Backend requires a `.env` file at `backend/.env`:
```
OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

`service-account.json` must be placed in `backend/` (download from Firebase Console → Project Settings → Service Accounts). It is gitignored.

On Render, `GOOGLE_APPLICATION_CREDENTIALS` points to `/etc/secrets/service-account.json` (secret file).

## Architecture

### Backend (`backend/`)

#### `main.py` — FastAPI app
All endpoints require a Firebase ID token via `Authorization: Bearer <token>`. The `get_current_user` dependency verifies the token and returns `uid`.

**Rate limiting** (slowapi, keyed by IP):
- `POST /upload` — 20/min
- `POST /ingest-url` — 10/min
- `POST /ingest-text` — 10/min
- `POST /chat` — 30/min
- `POST /chat/stream` — 30/min

**CORS**: Defaults include `localhost:5173–5176`, `ra-gs-ai.vercel.app`, `askmydocs-omega.vercel.app`. Additional origins can be added via `ALLOWED_ORIGINS` env var (comma-separated).

**Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/upload` | Upload file (multipart), 20 MB limit |
| POST | `/ingest-url` | Ingest a public URL (scrapes HTML) |
| POST | `/ingest-text` | Ingest raw text with a title |
| POST | `/chat` | Sync chat (returns full answer) |
| POST | `/chat/stream` | Streaming chat (SSE, preferred) |
| GET | `/analytics` | Per-user document stats + keywords |
| GET | `/sessions` | List chat sessions (newest-first) |
| POST | `/sessions` | Create new chat session |
| GET | `/sessions/{session_id}/messages` | Get messages for a session |
| DELETE | `/sessions/{session_id}` | Delete a session |
| DELETE | `/document/{filename}` | Delete a document + its vectors |
| DELETE | `/reset` | Wipe entire user collection + metadata |

#### `rag_engine.py` — Core RAG logic

**Supported file types**: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.xlsx`, `.xls`, `.pptx`

**Key methods**:
- `_get_vectorstore(user_id)` — `Chroma` instance scoped to `collection_name=f"user_{user_id}"`
- `_load_metadata(user_id)` / `_save_metadata(user_id, data)` — persists to `./user_data/{user_id}/metadata.json`
- `_load_sessions(user_id)` / `_save_sessions(user_id, data)` — persists to `./user_data/{user_id}/sessions.json`
- `_extract_keywords(text, top_n=10)` — Counter-based, filters `STOP_WORDS` and words < 4 chars
- `extract_text(contents, filename)` — Dispatches by extension to pdf/docx/txt/csv/xlsx/pptx parsers
- `ingest_document(contents, filename, user_id)` — Chunks (800 chars, 100 overlap), embeds, stores; auto-replaces if same filename exists
- `ingest_url(url, user_id)` — Fetches URL via httpx, strips HTML with BeautifulSoup, ingests as `.url` file
- `ingest_text(text, title, user_id)` — Ingests raw text, stores as `{title}.txt`
- `query(question, history, user_id, filter_filename)` — Sync similarity search + GPT-4o response
- `query_stream(question, history, user_id, session_id, filter_filename)` — Async SSE generator; auto-saves to session if `session_id` provided
- `get_sessions(user_id)` — Returns session summaries (no message payloads)
- `create_session(user_id)` — Creates session, auto-names from first message
- `get_session_messages(session_id, user_id)` — Full message history for a session
- `save_session_exchange(...)` — Appends user+assistant messages to session; auto-names session from first question (truncated to 40 chars)
- `delete_session(session_id, user_id)` — Removes session from sessions.json
- `get_analytics(user_id)` — Aggregates metadata; combines keywords across all docs
- `delete_document(filename, user_id)` — Deletes vectors by `filename` metadata filter + removes from metadata.json
- `reset(user_id)` — Deletes ChromaDB collection + entire `user_data/{uid}/` directory

**Confidence scoring** in `query` / `query_stream`:
- Score from ChromaDB → `confidence = max(0, 1 - score/2)`
- `RELEVANCE_THRESHOLD = 0.20` — use document context in prompt
- `CASUAL_THRESHOLD = 0.10` — acknowledge low match, ask user to rephrase
- Below casual threshold → treat as small talk, respond generically

### Frontend (`frontend/src/`)
- **`firebase.js`** — Firebase app init, `auth` export, `signInWithGoogle()`, `logOut()`
- **`AuthContext.jsx`** — `AuthProvider` wraps the app; `useAuth()` returns `{ user, loading }`
- **`main.jsx`** — Wraps `<App>` in `<BrowserRouter><AuthProvider>`
- **`App.jsx`** — Five routes: `/`, `/login`, `/upload`, `/chat`, `/analytics`. Protected routes redirect to `/login` if no user.
- **`pages/Login.jsx`** — Google sign-in; navigates to `/upload` on success
- **`pages/Landing.jsx`** — Marketing page; navbar shows login/logout based on auth state
- **`pages/Upload.jsx`** — Drag-and-drop uploader (also URL ingestion and text paste). Sends `Authorization` header. 20 MB client-side limit enforced at dropzone.
- **`pages/Chat.jsx`** — Chat interface. Uses `/chat/stream` (SSE). Session management sidebar. `rags_ai_messages_{user.uid}` as sessionStorage fallback key. Sends auth token.
- **`pages/Analytics.jsx`** — Document stats. Sends auth token to `/analytics`.

### Key Configuration
- **API URL**: `VITE_API_URL` in `frontend/.env`. Production → Render URL; local dev → `http://localhost:8000`
- **Vercel routing**: `frontend/vercel.json` rewrites all paths to `/` for client-side routing
- **ChromaDB**: `backend/chroma_db/` — each user has their own collection (`user_{uid}`)
- **Metadata**: `backend/user_data/{uid}/metadata.json` — doc info, persists across restarts
- **Sessions**: `backend/user_data/{uid}/sessions.json` — chat history, persists across restarts

### Deployment (`render.yaml`)
- Root dir: `.` (repo root)
- Build: `pip install -r backend/requirements.txt`
- Start: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars: `OPENAI_API_KEY` (sync: false), `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account.json`, `ALLOWED_ORIGINS`

### Known Limitations
- Voice input only works in Chrome (`webkitSpeechRecognition`)
- Analytics mock data is shown when the backend is unreachable (not when authenticated but no docs)
- ChromaDB and user_data are stored on Render's ephemeral filesystem — data is lost on redeploy/restart
- Sessions are stored per-user in flat JSON files (no database); large session histories may get slow
- `query()` (sync) duplicates logic from `query_stream()` — `_build_prompt_and_sources()` was added to DRY this up but `query()` still has its own copy
