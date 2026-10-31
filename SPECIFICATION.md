# CrossEx: Architecture and Implementation Specification

Three assumptions up front, since they affect the design:

1. **Audio format risk.** Gemini's documented audio formats are WAV, MP3, AIFF, AAC, OGG Vorbis and FLAC. `audio/webm;codecs=opus` from `MediaRecorder` is widely reported to work, but it isn't in that list, and Safari records `audio/mp4` instead. I've designed for this: the backend normalizes the MIME type and has an optional ffmpeg transcode fallback. Test this on day one of Phase 1.
2. **Model name.** I've made the model ID an environment variable (`GEMINI_MODEL=gemini-3.8-flash`). Confirm it is still served for your API key before building around it — Google closed the Gemini 2.5 family to new API keys and shut it down on 2026-10-20, so `gemini-2.5-flash` now fails with HTTP 404. `GEMINI_MODEL_FALLBACKS` lists models tried automatically when the configured one is unavailable.
3. **"Acoustic" metrics are model estimates, not signal processing.** Gemini can judge hesitations, fillers and apparent confidence, but not measure pitch or decibels. Pacing is the exception, because WPM can be computed exactly from transcript length and recording duration. Treat the rest as calibrated judgments and say so in the UI.

---

## 1. System Architecture

```
┌─────────────────────────── BROWSER (Next.js App Router) ───────────────────────────┐
│  getUserMedia ─► MediaStream ─┬─► MediaRecorder (webm/opus | mp4 fallback) ─► Blob  │
│                               └─► AudioContext ─► AnalyserNode ─► <canvas> waveform  │
│  Dashboard (Recharts, shadcn/ui)  ◄── JSON ──┐         speechSynthesis (rebuttal TTS)│
└──────────────────────────────────────────────┼───────────────────────────────────────┘
                 multipart/form-data (audio + duration_ms) │ HTTPS
┌──────────────────────────────────────────────┼───────────────────────────────────────┐
│ FastAPI (Uvicorn)                            ▼                                       │
│  Auth dep ─► size/type/magic-byte validation ─► bytes in RAM                         │
│      │                                                │ types.Part.from_bytes        │
│      │                                                ▼                              │
│      │                         GeminiEvaluator ──► google-genai ──► gemini-3.8-flash │
│      │                                                │ DebateEvaluationResponse     │
│      ▼                                                ▼                              │
│  SQLAlchemy 2.0 (async, asyncpg) ◄── derive WPM, filler total, running score         │
└──────────┬───────────────────────────────────────────────────────────────────────────┘
           ▼
     PostgreSQL (users, debate_sessions, debate_turns) ◄── Alembic migrations
```

**Data transit**
- **Capture:** `MediaRecorder.start(1000)` emits 1s chunks into an array. This is for crash resilience and memory pressure only. The chunks are concatenated into a single `Blob` on stop and uploaded once. Gemini needs the whole utterance, so there is no streaming upload.
- **MIME:** the client picks the first supported type from `["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]` via `MediaRecorder.isTypeSupported`. The server strips parameters (`audio/webm;codecs=opus` becomes `audio/webm`) before passing it to the SDK.
- **Server handling:** the upload is read in chunks into `bytes` under a hard cap (10 MB, about 5 minutes of Opus at typical bitrates). It then goes to Gemini as `types.Part.from_bytes(data=..., mime_type=...)`. Inline requests have a total size limit (around 20 MB), so the cap keeps you well under it. If you ever raise the cap, switch to the Files API.
- **Zero-disk trade-offs:**
  - Pros: no PII audio at rest, no cleanup jobs, simpler compliance.
  - Cons: the user can't replay past turns, you can't re-run evaluations when you change the prompt, and debugging a bad evaluation is harder. Multi-turn context therefore passes prior transcripts as text, never audio.
  - Optional later: opt-in encrypted object storage with a 30-day TTL.

---

## 2. Core Feature Matrix

**Audio capture and visualization**
- A state machine: `idle → requesting_permission → recording → stopped → uploading → evaluated | error`.
- `AnalyserNode` (`fftSize=2048`) with `getByteTimeDomainData` inside a `requestAnimationFrame` loop draws the waveform. Cancel the loop and close the `AudioContext` on unmount.
- Timer from `performance.now()` deltas, not `setInterval` counting. The final `duration_ms` is sent to the server.
- Hard cap of 120s with auto-stop, a 3s minimum, a live input-level meter, and permission-denied and no-mic states.

**Multimodal adjudication.** Gemini is asked to assess:

| Delivery signals | Logic signals |
|---|---|
| Filler words (um, uh, like, you know, basically), with counts | Claim and premise extraction |
| Hesitation: long pauses, false starts, restarts, trailing off | Premise soundness and evidence quality |
| Vocal confidence: uptalk, hedging tone, volume drop-off, rushed endings | Named fallacies with verbatim quotes |
| Pacing (verified server-side with WPM) | Unaddressed counterarguments |
| Speech detected vs. silence/noise (guards against empty uploads) | A rebuttal plus one Socratic question |

**Scorecard**
- Delivery: Confidence (0-100), Hesitation Index (0-100, higher is worse), Filler Count, WPM.
- Logic: Argument Soundness (0-100) and flagged fallacies, each with the quoted span and severity.
- The rebuttal is shown as text and spoken with `speechSynthesis`, with play, pause and a voice picker.

**History and multi-turn state**
- Each round stores a user row (metrics) and an assistant row (rebuttal).
- Prior transcripts and rebuttals (last 6 turns) are injected into the prompt so the model argues consistently and doesn't repeat itself.
- The trends view plots Confidence, Soundness and Filler Count per turn, and per session across time.

---

## 3. Tech Stack and Manifests

**Justifications:** Next.js App Router gives routing and easy Vercel deployment. shadcn/ui provides accessible primitives you own. FastAPI plus Pydantic v2 gives one typed schema serving as the Gemini output contract, the API response and the validation layer. SQLAlchemy 2.0 async plus asyncpg keeps the event loop free during DB and Gemini waits.

`requirements.txt` (compatible ranges; pin exact versions with `pip-compile` after verifying):
```txt
fastapi~=0.115
uvicorn[standard]~=0.32
pydantic~=2.9
pydantic-settings~=2.6
python-multipart~=0.0.12
google-genai>=1.0
sqlalchemy[asyncio]~=2.0.36
asyncpg~=0.30
alembic~=1.14
tenacity~=9.0
python-jose[cryptography]~=3.3
httpx~=0.27
# dev
pytest~=8.3
pytest-asyncio~=0.24
aiosqlite~=0.20
```

`package.json` dependencies:
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.13.0",
    "lucide-react": "^0.460.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

---

## 4. Database Schema

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(40)  NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE debate_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic           TEXT NOT NULL,
    initial_thesis  TEXT,
    difficulty      VARCHAR(12) NOT NULL DEFAULT 'intermediate'
                    CHECK (difficulty IN ('novice','intermediate','advanced')),
    overall_score   NUMERIC(5,2),
    status          VARCHAR(12) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','abandoned')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX ix_sessions_user_created ON debate_sessions (user_id, created_at DESC);

CREATE TABLE debate_turns (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID NOT NULL REFERENCES debate_sessions(id) ON DELETE CASCADE,
    turn_number           INTEGER NOT NULL CHECK (turn_number >= 1),
    speaker               VARCHAR(10) NOT NULL CHECK (speaker IN ('user','assistant')),
    user_transcript       TEXT,
    filler_words_detected JSONB NOT NULL DEFAULT '[]',
    fallacies_flagged     JSONB NOT NULL DEFAULT '[]',
    confidence_score      SMALLINT CHECK (confidence_score BETWEEN 0 AND 100),
    argument_score        SMALLINT CHECK (argument_score BETWEEN 0 AND 100),
    hesitation_index      SMALLINT CHECK (hesitation_index BETWEEN 0 AND 100),
    words_per_minute      NUMERIC(6,1),
    duration_ms           INTEGER,
    rebuttal_text         TEXT,
    raw_evaluation        JSONB,   -- full Gemini payload, for re-rendering and prompt debugging
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, turn_number, speaker)
);
```

---

## 5. Implementation Roadmap

- **Phase 1: MVP backend** (FastAPI, Pydantic schemas, GeminiEvaluator, stateless `/api/evaluate` test)
- **Phase 2: Recorder and waveform** (Next.js scaffold, `useRecorder`, Canvas waveform, timers)
- **Phase 3: Dashboard and TTS** (Score gauges, fallacy highlights, rebuttal TTS player)
- **Phase 4: Persistence, analytics, polish** (PostgreSQL, Alembic migrations, session management, trend charts)
