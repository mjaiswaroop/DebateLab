# CrossEx / DebateLab - Backend (Phase 1)

CrossEx is an AI-powered collegiate parliamentary debate adjudicator and speech coach. It evaluates audio recordings of debate speeches using Gemini 2.5 multimodal audio analysis, extracting both **delivery signals** (confidence, hesitation, fillers, WPM) and **logic signals** (claims, premise soundness, verbatim fallacies, Socratic inquiry, and opposing rebuttals).

---

## Architecture Overview

- **Framework:** FastAPI with Python 3.12+
- **Model:** `gemini-3.8-flash` via official `google-genai` SDK
- **Database:** SQLAlchemy 2.0 async + PostgreSQL / SQLite (`aiosqlite`)
- **Validation:** Pydantic v2 schemas mirroring the Gemini structured JSON response
- **Audio Transit:** Zero-disk in-RAM processing (`types.Part.from_bytes`) under 10MB limit

---

## Setup & Running

### 1. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
DATABASE_URL=sqlite+aiosqlite:///./debatelab.db
SECRET_KEY=dev_secret_key_change_in_production
```

### 2. Activate Virtual Environment & Install Dependencies

```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Or run directly via venv:
.\venv\Scripts\pip install -r requirements.txt
```

### 3. Start the Development Server

```bash
.\venv\Scripts\python scripts\dev_server.py
```

> Use `scripts/dev_server.py` rather than `uvicorn --reload` directly. This
> repo lives in a OneDrive-synced folder; OneDrive exposes files as reparse
> points, which breaks the file-change notifications the `watchfiles` reloader
> relies on. The dev server then silently stops picking up edits and you keep
> running stale code. `dev_server.py` forces the mtime-polling reloader
> (`StatReload`) and only watches `app/` and `tests/`.

- **Interactive API Docs (Swagger):** `http://localhost:8001/docs`
- **Alternative Docs (ReDoc):** `http://localhost:8001/redoc`
- **Health Check:** `http://localhost:8001/healthz`

---

## API Endpoints

### Stateless Evaluation (Phase 1 Quick Test)
- `POST /api/evaluate`
  - Accepts multipart form: `audio` (file: webm, ogg, mp4, wav, flac), `duration_ms` (int), `topic` (string, optional), `difficulty` (novice | intermediate | advanced, optional).
  - Returns complete scorecard and audio critique without requiring a saved session.

### Stateful Debate Sessions (Phase 4 Database)
- `POST /api/sessions`: Create a new debate session (`topic`, `difficulty`, `initial_thesis`).
- `GET /api/sessions`: List sessions for the authenticated user.
- `GET /api/sessions/{session_id}`: Get session details, full turn transcripts, rebuttals, and trend analytics.
- `POST /api/sessions/{session_id}/turn`: Submit an audio turn for a session. Gemini evaluates with context from prior turns (last 6 turns), stores metrics atomically, updates overall session score, and yields the assistant's counter-rebuttal.
- `PATCH /api/sessions/{session_id}/complete`: Finalize a debate session.

---

## Testing

Run the test suite:
```bash
.\venv\Scripts\pytest -v
```
