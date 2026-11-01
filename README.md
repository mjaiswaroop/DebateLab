# CrossEx DebateLab — AI Parliamentary Debate Adjudicator & Speech Coach

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15+-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Gemini 2.5](https://img.shields.io/badge/Gemini%202.5-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

CrossEx is an AI-powered collegiate parliamentary debate circuit adjudicator and speech coach. It evaluates spoken arguments in real-time using Google's Gemini 2.5 Flash multimodal audio analysis, delivering instant critiques on both **delivery signals** and **argument logic**.

---

## Key Capabilities

- **Audio Capture & Live Waveform:** High-performance Web Audio API `AnalyserNode` live canvas visualizer with DPR scaling, 120s auto-stop, input decibel meter, and automatic MIME negotiation (`webm/opus` / `mp4` fallback).
- **Multimodal Adjudication (Gemini 2.5):** Zero-disk in-RAM audio transit (`types.Part.from_bytes`) under 10MB to directly assess audio delivery without relying on lossy speech-to-text intermediaries.
- **Delivery Signal Scorecard:**
  - **Vocal Confidence (0-100):** Steadiness, assertiveness, absence of uptalk or hedging tone.
  - **Hesitation Index (0-100):** Pauses, restarts, false starts, and trailing off.
  - **Words Per Minute (WPM):** Exact pacing computation verified from transcript length and recording duration.
  - **Filler Word Detection:** Actual acoustic count of fillers (*um*, *uh*, *like*, *you know*, *basically*).
- **Rigorous Logic & Fallacy Detection:**
  - Extraction of central claims and premises.
  - Flagging of logical fallacies with verbatim quotes, severity levels (*critical*, *moderate*, *minor*), explanations, and actionable repair instructions.
  - Identification of strongest and weakest points, plus unaddressed counterarguments.
- **Socratic Inquiry & Spoken Rebuttal:**
  - Opposing counter-argument (60–130 words) challenging the debater's weakest premise.
  - Web Speech API `speechSynthesis` playback with Play, Pause, Resume, and Voice picker.
  - Probing Socratic question exposing hidden assumptions.
- **Multi-Round Trajectory Analytics:**
  - Persistent sessions tracking round-by-round evolution of Confidence, Argument Soundness, Hesitation, and Fillers with interactive Recharts diagrams.

---

## Project Structure

```
DebateLab/
├── SPECIFICATION.md          # Complete Architecture & Implementation Spec
├── README.md                 # System overview and quick-start guide
├── backend/                  # FastAPI & SQLAlchemy backend
│   ├── app/
│   │   ├── main.py           # FastAPI application entrypoint & CORS
│   │   ├── config.py         # Pydantic BaseSettings & environment configs
│   │   ├── db.py             # SQLAlchemy 2.0 async engine & sessionmaker
│   │   ├── models.py         # Declarative models (User, DebateSession, DebateTurn)
│   │   ├── prompts.py        # Chief Adjudicator SYSTEM_PROMPT
│   │   ├── auth.py           # JWT auth with automatic guest/demo fallback
│   │   ├── schemas/          # Pydantic schemas for Gemini and REST APIs
│   │   ├── services/         # GeminiEvaluator with exponential backoff
│   │   └── routers/          # /api/evaluate and /api/sessions routes
│   ├── alembic/              # Async database migrations
│   ├── tests/                # Pytest async test suite (100% passing)
│   └── requirements.txt      # Python dependencies
└── frontend/                 # Next.js 15 App Router frontend
    ├── src/
    │   ├── app/              # App router (layout, globals.css, page.tsx)
    │   ├── components/       # UI components (AudioVisualizer, RecordControl, etc.)
    │   ├── hooks/            # useRecorder (state machine) & useSpeech (TTS)
    │   ├── lib/              # api.ts client and utility helpers
    │   └── types/            # TypeScript domain interfaces
    └── package.json          # Node dependencies
```

---

## Quick Start

### 1. Start the Backend (Port 8001)

```powershell
cd backend

# (Optional) Set your GEMINI_API_KEY in .env
# GEMINI_API_KEY=your_key_here

# Start the FastAPI server on port 8001
.\venv\Scripts\python scripts\dev_server.py
```

> **Use `scripts/dev_server.py`, not `uvicorn --reload` directly.** This repo
> lives in a OneDrive-synced folder, and OneDrive exposes files as reparse
> points, which breaks the file-change notifications Uvicorn's `watchfiles`
> reloader depends on. The dev server then looks healthy but silently stops
> picking up your edits, so you end up debugging stale code. `dev_server.py`
> forces Uvicorn's mtime-polling reloader (`StatReload`), which works
> regardless of where the repo is stored, and only watches `app/` and `tests/`
> instead of the whole tree including the ~50k-file `venv/`.
- API Docs: `http://localhost:8001/docs`
- Health: `http://localhost:8001/healthz`

### 2. Start the Frontend

```powershell
cd frontend

# Start the Next.js development server on port 3001
npm run dev
```
- Open `http://localhost:3001` in your browser.

---

## Running Backend Tests

```powershell
cd backend
.\venv\Scripts\pytest -v
```
All tests run with an isolated in-memory SQLite database and mocked Gemini evaluator.

---

## UI Verification & Screenshot Capture

To capture real screenshots of the running application across desktop (1280px) and mobile (390px) viewports in both Demo and Mocked Live modes:

```powershell
# Ensure frontend dev server is running on http://localhost:3001
node scripts/capture_real_screenshots.js
```
Captured screenshots are saved directly to `docs/screenshots/`:
- `docs/screenshots/demo_1280px.png` (Desktop 1280px, Demo Mode with no API key)
- `docs/screenshots/demo_390px.png` (Mobile 390px, Demo Mode with no API key)
- `docs/screenshots/live_1280px.png` (Desktop 1280px, Mocked Live Response with key)
- `docs/screenshots/live_390px.png` (Mobile 390px, Mocked Live Response with key)

