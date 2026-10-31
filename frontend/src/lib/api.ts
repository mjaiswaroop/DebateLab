import {
  SessionDetailResponse,
  SessionResponse,
  TurnResponse,
  TextDebateTurnRequest,
  TextDebateTurnResponse,
  DebateVerdictRequest,
  DebateVerdictResponse,
  DebaterProfileResponse,
  DrillResponse,
  BallotResponse,
} from "@/types/debate";

// In browser: default to relative "" so Next.js rewrites /api/* to the backend
// without CORS issues. If direct backend is needed or NEXT_PUBLIC_API_BASE is
// specified, it uses that.
const DEFAULT_API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE ?? ""
    : process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

// Direct-backend fallbacks, tried in order when the primary base is unreachable.
// The backend is documented on port 8001 (see README); 8000 is kept as a
// fallback because an orphaned dev server is often left listening there.
const API_FALLBACK_BASES = [
  "http://127.0.0.1:8001",
  "http://127.0.0.1:8000",
];

const STORAGE_API_KEY = "debatelab_gemini_api_key";

const PLACEHOLDER_KEYS = ["your_gemini_api_key_here", "placeholder", "unset"];

/** Strips whitespace and stray quotes from a pasted API key. */
function normalizeKey(key: string): string {
  return (key || "").trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * Drops the stored key when it is the same one that just failed, so the UI
 * stops reporting a dead key as active without discarding an unrelated
 * working key.
 */
function clearStoredKeyIfMatches(key: string): void {
  if (getStoredApiKey() && getStoredApiKey() === normalizeKey(key)) {
    setStoredApiKey("");
  }
}

export function getStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = normalizeKey(localStorage.getItem(STORAGE_API_KEY) || "");
    if (PLACEHOLDER_KEYS.includes(key.toLowerCase())) {
      return "";
    }
    return key;
  } catch {
    return "";
  }
}

export function setStoredApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = normalizeKey(key);
    if (trimmed && !PLACEHOLDER_KEYS.includes(trimmed.toLowerCase())) {
      localStorage.setItem(STORAGE_API_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_API_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const key = getStoredApiKey();
  if (key) {
    headers["X-Gemini-Api-Key"] = key;
  }
  return headers;
}

/**
 * Universal fetch that first tries the primary base (e.g. Next.js rewrite or configured URL),
 * and if that fails with a network error, falls back to the direct backend ports.
 */
async function fetchWithFallback(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const primaryUrl = `${DEFAULT_API_BASE}${path}`;
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (primaryErr) {
    for (const base of API_FALLBACK_BASES) {
      if (`${base}${path}` === primaryUrl) continue;
      try {
        const fallbackRes = await fetch(`${base}${path}`, options);
        return fallbackRes;
      } catch {
        // try the next fallback
      }
    }
    throw primaryErr;
  }
}

export async function getGeminiConfigStatus(): Promise<{
  gemini_configured: boolean;
  gemini_verified?: boolean;
  model: string;
  environment: string;
  active_model?: string | null;
  source?: string;
}> {
  try {
    const res = await fetchWithFallback("/api/config/status", {
      headers: { ...getAuthHeaders() },
    });
    if (res.ok) {
      return res.json();
    }
  } catch {
    // Backend offline
  }
  // Backend unreachable: fall back to whatever we hold locally.
  return {
    gemini_configured: Boolean(getStoredApiKey()),
    gemini_verified: false,
    model: "gemini-3.8-flash",
    environment: "client-local",
    active_model: null,
    source: getStoredApiKey() ? "client" : "none",
  };
}

export async function testGeminiApiKey(apiKey: string): Promise<{
  valid: boolean;
  message: string;
  error?: string | null;
  model?: string;
  auth_error?: boolean;
  model_error?: boolean;
}> {
  try {
    const res = await fetchWithFallback("/api/config/test-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.valid) {
        // The key is dead - stop the app from claiming it is active.
        clearStoredKeyIfMatches(apiKey);
      }
      return data;
    }
    const err = await res.json().catch(() => ({}));
    clearStoredKeyIfMatches(apiKey);
    return {
      valid: false,
      message: err.detail || "Validation failed",
      error: err.detail || `Server returned ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      message: "Connection to backend failed",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export interface SaveApiKeyResult {
  success: boolean;
  message: string;
  /** True when the key was only persisted in the browser because the backend was unreachable. */
  degraded?: boolean;
  error?: string | null;
}

export async function saveGeminiApiKey(apiKey: string): Promise<SaveApiKeyResult> {
  try {
    const res = await fetchWithFallback("/api/config/key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      // Only persist locally once the backend has actually accepted the key.
      setStoredApiKey(apiKey);
      return {
        success: true,
        message: data.message || "Key activated successfully",
      };
    }

    // The backend rejected the key (invalid credentials, retired model, ...).
    // Surface the real reason instead of reporting a false success, and drop
    // the dead key so the UI stops showing it as active.
    const err = await res.json().catch(() => ({}));
    const detail =
      err.detail || err.error || `Server returned ${res.status}`;
    clearStoredKeyIfMatches(apiKey);
    return {
      success: false,
      message:
        typeof detail === "string"
          ? detail
          : "The backend rejected this API key.",
      error: typeof detail === "string" ? detail : null,
    };
  } catch (err: unknown) {
    // The backend is genuinely unreachable. The key is still usable because every
    // adjudication endpoint forwards X-Gemini-Api-Key, so keep it locally and
    // tell the user this is a degraded (client-only) configuration.
    setStoredApiKey(apiKey);
    return {
      success: true,
      degraded: true,
      message:
        "Backend unreachable - API key stored locally and will be sent with every request.",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function evaluateAudioStateless(
  audioBlob: Blob,
  durationMs: number,
  topic: string = "General Parliamentary Debate",
  difficulty: string = "intermediate",
  thesis?: string,
  pauses?: Array<{ start_ms: number; duration_ms: number }>
): Promise<TurnResponse> {
  const formData = new FormData();
  const filename = audioBlob.type.includes("mp4") ? "recording.m4a" : "recording.webm";
  formData.append("audio", audioBlob, filename);
  formData.append("duration_ms", String(Math.round(durationMs)));
  formData.append("topic", topic);
  formData.append("difficulty", difficulty);
  if (thesis) {
    formData.append("thesis", thesis);
  }
  if (pauses && pauses.length > 0) {
    formData.append("pauses", JSON.stringify(pauses));
  }

  const response = await fetchWithFallback("/api/evaluate", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Evaluation failed with status ${response.status}`);
  }

  return response.json();
}

export async function createSession(
  topic: string,
  difficulty: "novice" | "intermediate" | "advanced" = "intermediate",
  initialThesis?: string,
  format: string = "parliamentary",
  targetWpmMin: number = 140,
  targetWpmMax: number = 180,
  userSide: "government" | "opposition" = "government"
): Promise<SessionResponse> {
  try {
    const response = await fetchWithFallback("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        topic,
        user_side: userSide,
        difficulty,
        initial_thesis: initialThesis || null,
        format,
        target_wpm_min: targetWpmMin,
        target_wpm_max: targetWpmMax,
      }),
    });

    if (response.ok) {
      return response.json();
    }
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Failed to create session (${response.status})`);
  } catch (err: unknown) {
    // Fail-safe: If backend is temporarily offline, instantiate a local active session
    // so the debater is NEVER blocked from practicing!
    const localId = "session_" + Math.random().toString(36).substring(2, 11);
    return {
      id: localId,
      topic,
      user_side: userSide,
      format,
      target_wpm_min: targetWpmMin,
      target_wpm_max: targetWpmMax,
      initial_thesis: initialThesis || null,
      difficulty,
      status: "active",
      overall_score: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };
  }

}

export async function submitSessionTurn(
  sessionId: string,
  audioBlob: Blob,
  durationMs: number,
  pauses?: Array<{ start_ms: number; duration_ms: number }>,
  parentTurnId?: string
): Promise<TurnResponse> {
  const formData = new FormData();
  const filename = audioBlob.type.includes("mp4") ? "turn.m4a" : "turn.webm";
  formData.append("audio", audioBlob, filename);
  formData.append("duration_ms", String(Math.round(durationMs)));
  if (pauses && pauses.length > 0) {
    formData.append("pauses", JSON.stringify(pauses));
  }
  if (parentTurnId) {
    formData.append("parent_turn_id", parentTurnId);
  }

  const response = await fetchWithFallback(`/api/sessions/${sessionId}/turn`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Failed to submit debate turn (${response.status})`);
  }

  return response.json();
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  const response = await fetchWithFallback(`/api/sessions/${sessionId}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Failed to fetch session (${response.status})`);
  }
  return response.json();
}

export async function completeSession(sessionId: string) {
  const response = await fetchWithFallback(`/api/sessions/${sessionId}/complete`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to complete debate session");
  }
  return response.json();
}

export interface ChatPayload {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  topic?: string;
  thesis?: string;
  current_transcript?: string;
  fallacies?: Array<any>;
  rebuttal_text?: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  heuristic?: boolean;
}

/** Error carrying the HTTP status and server-provided detail. */
export class ApiError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function sendChatMessage(payload: ChatPayload): Promise<ChatResponse> {
  const response = await fetchWithFallback("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const detail =
      errorJson.detail || errorJson.message || `Server returned ${response.status}`;
    throw new ApiError(
      typeof detail === "string" ? detail : "Chat failed",
      response.status,
      typeof detail === "string" ? detail : undefined
    );
  }

  return response.json();
}

export async function submitTextDebateTurn(
  payload: TextDebateTurnRequest
): Promise<TextDebateTurnResponse> {
  const response = await fetchWithFallback("/api/debate/text-turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server returned ${response.status}`);
  }
  return response.json();
}

export async function getDebateVerdict(
  payload: DebateVerdictRequest
): Promise<DebateVerdictResponse> {
  const response = await fetchWithFallback("/api/debate/verdict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Verdict failed (${response.status})`);
  }
  return response.json();
}

export async function getDebaterProfile(): Promise<DebaterProfileResponse> {
  const response = await fetchWithFallback("/api/profile", {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (response.ok) {
    return response.json();
  }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.detail || `Failed to fetch profile (${response.status})`);
}

export async function listUserDrills(): Promise<DrillResponse[]> {
  const response = await fetchWithFallback("/api/drills", {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (response.ok) {
    return response.json();
  }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.detail || `Failed to fetch drills (${response.status})`);
}

export async function recordDrill(payload: {
  drill_type: string;
  prompt_text: string;
  duration_seconds: number;
  score: number;
  target_metric: string;
  triggering_weakness?: string;
  metrics?: Record<string, unknown>;
  feedback: string;
  session_id?: string;
}): Promise<DrillResponse> {
  const response = await fetchWithFallback("/api/drills", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    return response.json();
  }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.detail || `Failed to record drill (${response.status})`);
}

export async function getSessionBallots(
  sessionId: string
): Promise<BallotResponse[]> {
  const response = await fetchWithFallback(`/api/sessions/${sessionId}/ballots`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (response.ok) {
    return response.json();
  }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.detail || `Failed to fetch ballots (${response.status})`);
}
