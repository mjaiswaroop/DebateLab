import asyncio
import hashlib
import logging
import re
import time
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import errors, types
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import settings
from app.prompts import (
    SYSTEM_PROMPT,
    build_adjudicator_system_prompt,
    build_audio_turn_context,
    check_topical_guard,
)
from app.schemas.evaluation import (
    DebateEvaluationResponse,
    GeminiEvaluationResponse,
)

logger = logging.getLogger(__name__)

# Keys that are obviously placeholders rather than real credentials.
PLACEHOLDER_KEYS = ("your_gemini_api_key_here", "placeholder", "unset")

# Minimum plausible length for a real Gemini key (real ones are ~39 chars).
MIN_KEY_LENGTH = 10


def normalize_api_key(raw: Optional[str]) -> str:
    """Strips whitespace and stray quotes from a pasted API key."""
    if not raw:
        return ""
    cleaned = raw.strip().strip('"').strip("'").strip()
    return cleaned


def is_usable_api_key(raw: Optional[str]) -> bool:
    """True when the value looks like a real credential rather than a placeholder."""
    cleaned = normalize_api_key(raw)
    return bool(
        cleaned
        and cleaned.lower() not in PLACEHOLDER_KEYS
        and len(cleaned) >= MIN_KEY_LENGTH
    )


def _retryable(exc: BaseException) -> bool:
    """Retry transient server-side failures and rate limits, never 4xx bad requests."""
    if isinstance(exc, errors.ServerError):
        return True
    if isinstance(exc, errors.ClientError) and getattr(exc, "code", None) == 429:
        return True
    return False


def is_model_unavailable(exc: BaseException) -> bool:
    """True when the API rejected the *model* rather than the key or the request.

    Google retires model IDs (e.g. the Gemini 2.5 family was closed to new keys
    and reached shutdown on 2026-10-20). Those calls surface as HTTP 404 /
    NOT_FOUND and must not be reported to the user as "invalid API key".
    """
    if isinstance(exc, errors.ClientError):
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        if code == 404 or status == "NOT_FOUND":
            return True
    message = str(exc).lower()
    return "not found" in message and "model" in message


def is_quota_exhausted(exc: BaseException) -> bool:
    """True when the key ran out of quota / rate limit for the request.

    On free-tier keys this is frequently *per model*: a key can be out of quota
    for the newest Flash model while another model still answers fine. Treated
    like an unavailable model so the caller can fall back instead of failing.
    """
    if isinstance(exc, errors.ClientError):
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        if code == 429 or status == "RESOURCE_EXHAUSTED":
            return True
    return False


def is_model_overloaded(exc: BaseException) -> bool:
    """True when a model is temporarily at capacity (HTTP 503 UNAVAILABLE).

    Another model usually answers immediately, so this is treated the same way
    as a retired model: move on to the next candidate.
    """
    if isinstance(exc, errors.ServerError):
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        if code == 503 or status == "UNAVAILABLE":
            return True
    return False


def is_model_unusable_now(exc: BaseException) -> bool:
    """True when this model cannot serve the request but another one might.

    Covers a retired model (404), an exhausted quota (429) and a model at
    capacity (503).
    """
    return (
        is_model_unavailable(exc)
        or is_quota_exhausted(exc)
        or is_model_overloaded(exc)
    )


# Matches the "17h2m56.78s" style duration Google returns in a 429 body.
_DURATION_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(h|m|s)")


def _retry_after_seconds(exc: BaseException) -> Optional[float]:
    """Extracts the server's "Please retry in <duration>" hint from a 429 body.

    Free-tier quota errors carry the exact remaining window, e.g.
    "Please retry in 17h2m56.785936604s." Using it as the cooldown means the
    app stops re-asking a model that is known to be out of quota for the day.
    """
    blob = str(exc).lower()
    marker = "please retry in"
    idx = blob.find(marker)
    if idx == -1:
        return None
    tail = blob[idx + len(marker): idx + len(marker) + 40]
    total = 0.0
    found = False
    for value, unit in _DURATION_RE.findall(tail):
        amount = float(value)
        if unit == "h":
            total += amount * 3600
        elif unit == "m":
            total += amount * 60
        else:
            total += amount
        found = True
    return total if found else None


def model_cooldown_seconds(exc: BaseException) -> float:
    """How long to avoid a model that just failed, chosen by failure reason.

    The cooldown used to be a flat 5 minutes for every failure, which is
    wrong for a free-tier key whose quota is per model *per day*: the app
    kept re-asking a model it already knew was exhausted, adding a wasted
    round trip to every turn.
    """
    if is_model_unavailable(exc):
        # 404 - the model id was retired. It never comes back.
        return 24 * 60 * 60
    if is_quota_exhausted(exc):
        # 429 - quota exhausted. Trust the server's retry hint when present.
        hinted = _retry_after_seconds(exc)
        if hinted is not None:
            # Floor of 60s, ceiling of 24h so a bad hint cannot block a model
            # forever.
            return min(max(hinted, 60.0), 24 * 60 * 60)
        return 60 * 60
    if is_model_overloaded(exc):
        # 503 - temporarily at capacity; usually clears within seconds.
        return 30.0
    return 300.0


def is_auth_failure(exc: BaseException) -> bool:
    """True when the API rejected the credentials themselves."""
    if isinstance(exc, errors.ClientError):
        code = getattr(exc, "code", None)
        if code in (401, 403):
            return True
    # The Gemini API reports an invalid key as HTTP 400 INVALID_ARGUMENT with
    # reason API_KEY_INVALID, so the marker only shows up in the payload.
    blob = f"{getattr(exc, 'message', '') or ''} {exc} {getattr(exc, 'details', '') or ''}".lower()
    return (
        "api_key_invalid" in blob
        or "api key not valid" in blob
        or "invalid api key" in blob
        or "permission_denied" in blob
        or "permission denied" in blob
    )


def plain_prose(text: str) -> str:
    """Strips Markdown formatting the chat bubbles cannot render.

    The UI renders replies as plain text, so a model that emits '### Heading'
    or '**bold**' would show the raw markers to the debater.
    """
    if not text:
        return text
    cleaned = re.sub(r"^[ \t]*#{1,6}[ \t]+", "", text, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"\1", cleaned)
    cleaned = cleaned.replace("`", "")
    return cleaned.strip()


def _finish_reason(response: Any) -> Optional[str]:
    """Best-effort extraction of the candidate finish reason."""
    try:
        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            return None
        reason = getattr(candidates[0], "finish_reason", None)
        return str(reason) if reason is not None else None
    except Exception:
        return None


class GeminiLiveError(RuntimeError):
    """Raised when a configured live Gemini call fails.

    Used instead of silently degrading to the local heuristic coach, which made
    a broken key look like a working one.
    """


def describe_live_failure(exc: BaseException) -> str:
    """Turns a Gemini SDK exception into something a debater can act on."""
    if is_auth_failure(exc):
        return (
            "Gemini rejected your API key. Check that you copied the full key "
            "from Google AI Studio (it starts with 'AIza') and that it has not "
            "been revoked."
        )
    if is_model_unavailable(exc):
        return (
            f"The configured Gemini model is not available for this key: {exc}. "
            "Set GEMINI_MODEL to a currently served model."
        )
    if isinstance(exc, TimeoutError):
        return "The Gemini request timed out. Please try again."
    blob = str(exc)
    if "429" in blob or "RESOURCE_EXHAUSTED" in blob.upper():
        return (
            "Gemini rate limit or quota exceeded for this key. Wait a moment, "
            "or check the quota for your key in Google AI Studio."
        )
    return f"Live Gemini call failed: {blob}"


def uses_thinking_level(model: str) -> bool:
    """Gemini 3.x+ replaced the integer `thinking_budget` with a `thinking_level` enum."""
    name = (model or "").lower()
    for prefix in ("gemini-3", "gemini-4"):
        if name.startswith(prefix):
            return True
    return False


VALID_THINKING_LEVELS = ("LOW", "MEDIUM", "HIGH")


def build_thinking_config(
    model: str, level: Optional[str] = None
) -> Optional[types.ThinkingConfig]:
    """Builds a thinking configuration valid for the given model family.

    Gemini 3.x ignores `thinking_budget` and expects `thinking_level`
    ("LOW" | "MEDIUM" | "HIGH"). Gemini 2.x expects the integer `thinking_budget`.
    """
    if uses_thinking_level(model):
        resolved = str(level or settings.gemini_thinking_level or "MEDIUM").upper()
        # `ThinkingLevel` is a str enum, so an unknown value does NOT raise -
        # it silently becomes a bogus member. Validate explicitly.
        if resolved not in VALID_THINKING_LEVELS:
            logger.warning(
                "Unknown thinking level %r; falling back to MEDIUM.", resolved
            )
            resolved = "MEDIUM"
        return types.ThinkingConfig(thinking_level=types.ThinkingLevel(resolved))
    return types.ThinkingConfig(thinking_budget=1024)


def build_generation_config(
    model: str,
    *,
    temperature: Optional[float] = None,
    max_output_tokens: Optional[int] = None,
    thinking_level: Optional[str] = None,
    **extra: Any,
) -> types.GenerateContentConfig:
    """Builds a GenerateContentConfig that is valid for the given model family.

    Gemini 3.x ignores `temperature`/`top_p`/`top_k` (determinism is controlled by
    `thinking_level` and the response schema), so we only send them to older models.
    """
    kwargs: Dict[str, Any] = dict(extra)
    if temperature is not None and not uses_thinking_level(model):
        kwargs["temperature"] = temperature
    if max_output_tokens is not None:
        kwargs["max_output_tokens"] = max_output_tokens
    thinking = build_thinking_config(model, level=thinking_level)
    if thinking is not None:
        kwargs["thinking_config"] = thinking
    return types.GenerateContentConfig(**kwargs)


def _heuristic_chat_reply(
    messages: List[Dict[str, str]],
    topic: Optional[str] = None,
    thesis: Optional[str] = None,
    current_turn_transcript: Optional[str] = None,
    fallacies: Optional[List[Dict[str, Any]]] = None,
    rebuttal_text: Optional[str] = None,
) -> str:
    """Intelligent heuristic and contextual debate logic coach when live Gemini API key is not active."""
    latest_query = messages[-1].get("content", "").strip() if messages else ""
    q = latest_query.lower()
    debate_topic = topic or "General Parliamentary Debate"

    # 1. Direct spelling inquiries (e.g., "can u help me spell mitocondria")
    if "spell" in q:
        if "mitocondria" in q or "mitochondria" in q:
            return (
                "The correct spelling is **mitochondria** (singular: *mitochondrion*). "
                "In biology, it refers to the double-membrane-bound organelle that produces cellular ATP. "
                "When speaking in biotechnology debates, precise scientific diction establishes authoritative speaker ethos!"
            )
        if "parliament" in q or "parliment" in q:
            return "The correct spelling is **parliament** (and parliamentary). Remember the 'ia' diphthong after the 'l'."
        if "adjudicat" in q:
            return "The correct spelling is **adjudicator** (ending in -or, not -er)."
        if "fallacy" in q or "falacy" in q:
            return "The correct spelling is **fallacy** (double 'l', singular) or **fallacies** (plural)."
        return (
            f"Precision in terminology is crucial for speaker ethos. Double check Greek/Latin etymology "
            f"for debate keywords in '{debate_topic}'. (Connect a live Gemini API key in the top bar for full dictionary & definition lookups!)"
        )

    # 2. Greetings and beginner guidance ("hi idk how to speak", "where to start")
    if any(g in q for g in ["idk how to speak", "how to speak", "how do i start", "how to debate", "help me speak", "speech tips", "beginner"]):
        return (
            "Welcome to DebateLab! To deliver a structured, persuasive parliamentary speech, use the classic **P-E-E-L** framework:\n\n"
            "1. **Point**: State your claim in one crisp, unequivocal sentence.\n"
            "2. **Explanation**: Unpack the causal mechanism—why does incentive A produce outcome B?\n"
            "3. **Evidence**: Ground the claim with empirical data, historical precedent, or economic reality.\n"
            "4. **Link**: Connect directly back to why your outcome outweighs the opposition's harm.\n\n"
            "Try clicking **'Start Recording Speech'** above to practice a 30-second opening turn, or ask me to spar on your motion!"
        )

    if q in ["hi", "hello", "hey", "greetings", "good morning", "good evening", "yo"]:
        return (
            f"Greetings debater! I am your CrossEx Collegiate Adjudicator. "
            f"We are evaluating '{debate_topic}'. Ask me to cross-examine your thesis, repair any flagged fallacies, "
            f"or test counter-arguments before your next round."
        )

    # 3. Fallacy repairs
    if any(k in q for k in ["fallacy", "fix", "repair", "flaw", "flagged"]):
        if fallacies and len(fallacies) > 0:
            first_f = fallacies[0]
            f_type = first_f.get("type", "logical fallacy").replace("_", " ").title()
            f_quote = first_f.get("quote", "")
            f_fix = first_f.get("fix", "Ground the assertion with structural stakeholder incentives.")
            return (
                f"To repair the flagged **{f_type}** in your quote \"{f_quote}\":\n\n"
                f"Replace the sweeping assertion with a bounded mechanism. {f_fix} "
                "Specify the institutional conditions under which your claim strictly holds."
            )
        return (
            f"To eliminate fallacies in '{debate_topic}', eliminate universal claims like 'everyone knows' or 'obviously'. "
            "Instead, demonstrate the precise material incentives that drive stakeholder behavior."
        )

    # 4. Sparring / Point of Information / Rebuttal
    if any(k in q for k in ["spar", "poi", "challenge", "rebuttal", "counter"]):
        return (
            f"**Point of Information, speaker!** If you maintain that '{thesis or debate_topic}', "
            "how do you address the displacement dilemma? When the state bans or regulates this mechanism, "
            "stakeholders inevitably migrate toward unregulated shadow channels with zero consumer safeguards. "
            "Haven't you exacerbated the harm rather than mitigating it?"
        )

    # 5. Warrants and mechanisms
    if any(k in q for k in ["warrant", "premise", "mechanism", "strengthen", "causal"]):
        return (
            f"In collegiate parliamentary debate on '{debate_topic}', a warrant is the indispensable bridge between your premise and its impact. "
            "Don't simply claim that actors will behave this way—demonstrate why their fiduciary, political, or survival incentives leave them no other rational choice."
        )

    # 6. Default responsive adjudicator analysis
    return (
        f"As your CrossEx adjudicator for '{debate_topic}', my assessment prioritizes comparative weighing. "
        f"You have addressed '{latest_query}'. To make this compelling to the panel, quantify the magnitude, likelihood, and reversibility "
        "of your outcome compared to the status quo. (Pro-tip: Connect your Gemini API key in the top bar to enable live multimodal AI reasoning!)"
    )


class GeminiEvaluator:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        # `None` means "use the server's configured key"; an explicit empty
        # string means "no key at all" and must NOT silently fall back.
        raw_key = settings.gemini_api_key if api_key is None else api_key
        self.api_key = normalize_api_key(raw_key)
        self.model = model or settings.gemini_model
        # Fallbacks are only consulted when the primary model is unavailable
        # for this key (HTTP 404 from the Gemini API).
        self.fallback_models: List[str] = [
            m for m in (settings.gemini_model_fallbacks or []) if m and m != self.model
        ]
        # Per-key caches: building a genai.Client per request discards HTTP
        # connection pooling, and we also remember which model actually worked.
        self._client_cache: Dict[str, genai.Client] = {}
        self._resolved_model: Dict[str, str] = {}
        # Verification state, keyed by key fingerprint.
        # A key that merely *looks* valid must never be reported as "active":
        # it has to have been proven to work against the live API.
        self._verified_keys: Dict[str, str] = {}
        self._rejected_keys: set[str] = set()
        # Models this key recently hit a quota wall on, with a cooldown.
        self._blocked_models: Dict[str, Dict[str, float]] = {}
        self.client: Optional[genai.Client] = None
        self._init_client()

    # ------------------------------------------------------------------ keys

    @staticmethod
    def _fingerprint(key: str) -> str:
        return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]

    def mark_verified(self, key: str, model: str = "") -> None:
        """Records that this key was proven to work against the live API."""
        cleaned = normalize_api_key(key)
        if not cleaned:
            return
        fingerprint = self._fingerprint(cleaned)
        self._verified_keys[fingerprint] = model or self.model
        self._rejected_keys.discard(fingerprint)

    def mark_rejected(self, key: str) -> None:
        """Records that Gemini refused this key."""
        cleaned = normalize_api_key(key)
        if not cleaned:
            return
        fingerprint = self._fingerprint(cleaned)
        self._rejected_keys.add(fingerprint)
        self._verified_keys.pop(fingerprint, None)

    def is_key_rejected(self, key: str) -> bool:
        cleaned = normalize_api_key(key)
        if not cleaned:
            return False
        return self._fingerprint(cleaned) in self._rejected_keys

    def is_key_verified(self, key: str) -> bool:
        cleaned = normalize_api_key(key)
        if not cleaned:
            return False
        return self._fingerprint(cleaned) in self._verified_keys

    def is_key_usable(self, key: str) -> bool:
        """True when the key is present, well-formed and not known to be rejected."""
        if not is_usable_api_key(key):
            return False
        return not self.is_key_rejected(key)

    def _init_client(self) -> None:
        if is_usable_api_key(self.api_key):
            try:
                self.client = genai.Client(api_key=self.api_key)
                self._client_cache[self._fingerprint(self.api_key)] = self.client
            except Exception as e:
                logger.warning(f"Could not initialize GenAI client: {e}")
                self.client = None
        else:
            self.client = None

    def set_api_key(self, api_key: str) -> None:
        """Update API key dynamically at runtime."""
        self.api_key = normalize_api_key(api_key)
        # A new key has not been proven yet.
        if self.api_key:
            fingerprint = self._fingerprint(self.api_key)
            self._verified_keys.pop(fingerprint, None)
        self._init_client()

    def get_client(self, override_key: Optional[str] = None) -> Optional[genai.Client]:
        """Returns the active client, reusing a cached one for an override key."""
        cleaned = normalize_api_key(override_key)
        if is_usable_api_key(cleaned):
            fingerprint = self._fingerprint(cleaned)
            cached = self._client_cache.get(fingerprint)
            if cached is not None:
                return cached
            try:
                client = genai.Client(api_key=cleaned)
                self._client_cache[fingerprint] = client
                return client
            except Exception as e:
                logger.warning(f"Error creating override GenAI client: {e}")
                return None
        return self.client

    def effective_key(self, override_key: Optional[str] = None) -> str:
        """The API key actually used for a request.

        The browser may override the server's key per request. Per-model state
        (which model worked, which models are currently blocked) has to be
        tracked against whichever key is really in play, so the override wins
        and the server's own key is the fallback.
        """
        cleaned = normalize_api_key(override_key)
        return cleaned or self.api_key

    # ---------------------------------------------------------------- models

    def model_candidates(self, client_key: Optional[str] = None) -> List[str]:
        """Ordered list of models to try, starting with the resolved one."""
        fingerprint = self._fingerprint(normalize_api_key(client_key)) if client_key else ""
        resolved = self._resolved_model.get(fingerprint)
        candidates: List[str] = []
        if resolved:
            candidates.append(resolved)
        candidates.append(self.model)
        candidates.extend(self.fallback_models)
        seen: set[str] = set()
        ordered = [m for m in candidates if not (m in seen or seen.add(m))]

        # Skip models this key just hit a quota wall on - retrying them wastes a
        # request (and quota) on every single turn.
        blocked = self._blocked_models.get(fingerprint, {})
        now = time.time()
        live_blocked = {m for m, until in blocked.items() if until > now}
        if live_blocked:
            preferred = [m for m in ordered if m not in live_blocked]
            if preferred:
                ordered = preferred
        return ordered

    def _block_model(self, client_key: Optional[str], model: str, seconds: float = 300.0) -> None:
        if not client_key or not model:
            return
        fingerprint = self._fingerprint(normalize_api_key(client_key))
        self._blocked_models.setdefault(fingerprint, {})[model] = time.time() + seconds

    def active_model(self, client_key: Optional[str] = None) -> str:
        """The model that will actually be used for the given key."""
        candidates = self.model_candidates(client_key)
        return candidates[0] if candidates else self.model

    async def generate(
        self,
        client: genai.Client,
        *,
        contents: Any,
        config_factory: Any,
        client_key: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        """Calls generate_content, transparently falling back when a model is retired.

        `config_factory` receives the model name so each candidate gets a config
        that is valid for its family (thinking_budget vs thinking_level).
        """
        candidates = self.model_candidates(client_key)
        last_exc: Optional[BaseException] = None
        for index, model in enumerate(candidates):
            try:
                call = client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config_factory(model),
                )
                response = await asyncio.wait_for(call, timeout=timeout) if timeout else await call
                if client_key:
                    self._resolved_model[self._fingerprint(normalize_api_key(client_key))] = model
                    # A successful live call proves the key works.
                    self.mark_verified(client_key, model)
                if index > 0:
                    logger.info(
                        "Model '%s' unavailable for this key; using fallback '%s'.",
                        candidates[0],
                        model,
                    )
                finish_reason = _finish_reason(response)
                if finish_reason in ("MAX_TOKENS", "max_tokens"):
                    logger.warning(
                        "Response from '%s' was truncated by the output-token limit. "
                        "Raise max_output_tokens or lower the thinking level.",
                        model,
                    )
                return response
            except Exception as exc:
                last_exc = exc
                if client_key and is_auth_failure(exc):
                    self.mark_rejected(client_key)
                # A retired model (404), a model the key has no quota for
                # (429) and a model at capacity (503) all mean "try the
                # next candidate".
                if is_model_unusable_now(exc) and index < len(candidates) - 1:
                    cooldown = model_cooldown_seconds(exc)
                    logger.warning(
                        "Model '%s' unusable for this API key (%s); trying '%s' "
                        "and skipping it for %s.",
                        model,
                        exc,
                        candidates[index + 1],
                        f"{cooldown:.0f}s",
                    )
                    if client_key:
                        self._block_model(client_key, model, seconds=cooldown)
                    continue
                raise
        raise last_exc if last_exc else RuntimeError("No Gemini model candidates available.")

    # ------------------------------------------------------------ validation

    async def validate_key(self, api_key: str) -> Dict[str, Any]:
        """Validates a key against the live API and reports *why* it failed.

        Returns a dict with:
          valid      - whether the key authenticated successfully
          model      - the model that actually responded
          auth_error - True when the key itself was rejected
          model_error- True when the key is fine but the model is retired
          error      - human readable detail
        """
        cleaned = normalize_api_key(api_key)
        if not is_usable_api_key(cleaned):
            return {
                "valid": False,
                "model": self.model,
                "auth_error": True,
                "model_error": False,
                "error": "API key cannot be empty or a placeholder.",
            }

        try:
            client = genai.Client(api_key=cleaned)
        except Exception as exc:
            return {
                "valid": False,
                "model": self.model,
                "auth_error": True,
                "model_error": False,
                "error": f"Could not initialise Gemini client: {exc}",
            }

        candidates = self.model_candidates(cleaned)
        last_exc: Optional[BaseException] = None
        for index, model in enumerate(candidates):
            # The probe is deliberately minimal: no thinking config, no schema,
            # no sampling params. Anything that fails here is a problem with the
            # key or the model, never with our request parameters.
            try:
                res = await client.aio.models.generate_content(
                    model=model,
                    contents="Respond with 'PONG'",
                )
                if not res or not res.text:
                    return {
                        "valid": False,
                        "model": model,
                        "auth_error": False,
                        "model_error": False,
                        "error": "Empty response from Gemini.",
                    }
                self._resolved_model[self._fingerprint(cleaned)] = model
                self.mark_verified(cleaned, model)
                logger.info(
                    "API key validated successfully for key %s on model %s.",
                    self._fingerprint(cleaned),
                    model,
                )
                return {
                    "valid": True,
                    "model": model,
                    "auth_error": False,
                    "model_error": False,
                    "error": None,
                }
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "API key validation probe failed for model %s: %s",
                    model,
                    exc,
                )
                if is_auth_failure(exc):
                    # Gemini refused the credentials - remember that so the
                    # status endpoint stops reporting this key as usable.
                    self.mark_rejected(cleaned)
                if is_model_unusable_now(exc) and index < len(candidates) - 1:
                    logger.warning(
                        "Model '%s' unusable for this API key (%s); trying '%s'.",
                        model,
                        exc,
                        candidates[index + 1],
                    )
                    continue
                break

        if last_exc is None:
            return {
                "valid": False,
                "model": self.model,
                "auth_error": False,
                "model_error": False,
                "error": "Unknown validation failure.",
            }

        if is_auth_failure(last_exc):
            return {
                "valid": False,
                "model": self.model,
                "auth_error": True,
                "model_error": False,
                "error": str(last_exc),
            }
        if is_model_unavailable(last_exc):
            return {
                "valid": False,
                "model": self.model,
                "auth_error": False,
                "model_error": True,
                "error": (
                    f"Model '{self.model}' is no longer served for this API key. "
                    f"{last_exc}"
                ),
            }
        return {
            "valid": False,
            "model": self.model,
            "auth_error": False,
            "model_error": False,
            "error": str(last_exc),
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception(_retryable),
        reraise=True,
    )
    async def evaluate(
        self,
        *,
        audio: bytes,
        mime_type: str,
        topic: str,
        difficulty: str,
        side_note: str = "",
        history: Optional[List[Dict[str, Any]]] = None,
        user_side: str = "government",
        round_number: int = 1,
        thesis: Optional[str] = None,
        override_key: Optional[str] = None,
    ) -> DebateEvaluationResponse:
        """Evaluates debate turn audio using Gemini multimodal structured output."""
        active_client = self.get_client(override_key)
        if not active_client:
            raise ValueError("Spoken turns need a live Gemini key")

        hist = history or []
        system_instruction = build_adjudicator_system_prompt(difficulty=difficulty, topic=topic)
        base_context = build_audio_turn_context(
            topic=topic,
            difficulty=difficulty,
            user_side=user_side,
            round_number=round_number,
            history=hist,
            thesis=thesis,
        )
        if side_note and side_note not in base_context:
            base_context = f"{side_note}\n\n{base_context}"

        current_context = base_context
        attempts = 0
        max_attempts = 2

        while attempts < max_attempts:
            attempts += 1
            response = await self.generate(
                active_client,
                contents=[
                    types.Part.from_bytes(data=audio, mime_type=mime_type),
                    current_context,
                ],
                config_factory=lambda model: build_generation_config(
                    model,
                    temperature=0.4,
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=GeminiEvaluationResponse,
                ),
                client_key=self.effective_key(override_key),
                timeout=60,
            )

            if isinstance(response.parsed, GeminiEvaluationResponse):
                eval_res = DebateEvaluationResponse.model_validate(
                    response.parsed.model_dump()
                )
            elif isinstance(response.parsed, DebateEvaluationResponse):
                eval_res = response.parsed
            elif response.text:
                eval_res = DebateEvaluationResponse.model_validate_json(response.text)
            else:
                raise ValueError("Gemini returned no content (possibly safety-blocked).")

            # Topical guard: verify speech rebuttal engages the motion and user speech
            if eval_res.speech_detected and eval_res.transcript.strip() and eval_res.rebuttal_text.strip():
                guard_passed, guard_reason = check_topical_guard(
                    eval_res.rebuttal_text, topic, eval_res.transcript
                )
                if not guard_passed:
                    logger.warning(
                        "Audio topical guard failed on attempt %d: %s for motion '%s'.",
                        attempts,
                        guard_reason,
                        topic,
                    )
                    if attempts < max_attempts:
                        current_context = (
                            base_context
                            + f"\n\nCRITICAL GROUNDING ERROR: Your previous rebuttal failed the topical guard: {guard_reason}.\n"
                            f"You MUST directly rebut the debater's words from their speech ({eval_res.transcript[:120]}) and ground your counter-argument strictly in '{topic}'."
                        )
                        continue
                    else:
                        raise ValueError(
                            f"Topical guard failed: model rebuttal went off-topic ({guard_reason}). Please retry."
                        )

            return eval_res


    async def chat_sparring(
        self,
        *,
        messages: List[Dict[str, str]],
        topic: Optional[str] = None,
        thesis: Optional[str] = None,
        current_turn_transcript: Optional[str] = None,
        fallacies: Optional[List[Dict[str, Any]]] = None,
        rebuttal_text: Optional[str] = None,
        override_key: Optional[str] = None,
        raise_on_error: bool = False,
    ) -> str:
        """Interactive sparring chat with Gemini as collegiate debate adjudicator.

        When no key is configured at all the local heuristic coach is used (that
        is the documented offline mode). When a key IS configured but the live
        call fails, the failure is surfaced instead of being masked by the
        heuristic - otherwise the user just sees the same canned reply forever
        with no idea that Gemini was never reached.
        """
        active_client = self.get_client(override_key)
        if not active_client:
            return _heuristic_chat_reply(
                messages=messages,
                topic=topic,
                thesis=thesis,
                current_turn_transcript=current_turn_transcript,
                fallacies=fallacies,
                rebuttal_text=rebuttal_text,
            )

        context_header = (
            f"DEBATE MOTION: {topic or 'General Parliamentary Debate'}\n"
            f"OPENING THESIS: {thesis or 'N/A'}\n"
            f"LATEST SPEECH TRANSCRIPT: {current_turn_transcript or 'N/A'}\n"
            f"FLAGGED FALLACIES: {fallacies or 'None'}\n"
            f"OPPOSING REBUTTAL: {rebuttal_text or 'N/A'}"
        )

        system_instruction = (
            "You are the CrossEx Chief Parliamentary Adjudicator & Sparring Partner. "
            "Help the debater strengthen logic, fix fallacies, develop devastating "
            "cross-examination questions, or spar by taking the opposing stance. "
            "Be concise, sharp, intellectually rigorous, and actionable.\n"
            "IMPORTANT: If the user asks a casual greeting, a direct question, or a "
            "spelling/definition query (e.g. 'can you help me spell mitochondria', "
            "'how to speak', 'where to start'), ANSWER THEIR DIRECT QUESTION "
            "ACCURATELY AND HELPFULLY FIRST, then connect it back naturally to "
            "rhetoric or the motion. Never reply with rigid canned repetition.\n"
            "Answer only the debater's most recent message. Do not invent facts "
            "about the motion, the transcript, or the debate history - if you are "
            "missing context, say so and ask for it.\n"
            "Write in plain prose. Do not use Markdown headings, bullet points, "
            "bold or asterisks - your reply is shown as plain text."
        )

        # Build a real multi-turn conversation. Flattening every turn into one
        # user-role string (the previous behaviour) left the model unable to
        # tell whose turn it was answering, which is what made replies read as
        # illogical and off-topic.
        contents: List[types.Content] = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=f"[Debate context]\n{context_header}")],
            )
        ]
        for m in messages:
            role = "model" if m.get("role") == "assistant" else "user"
            text = (m.get("content") or "").strip()
            if not text:
                continue
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=text)])
            )

        # The model must always have something to answer.
        if contents and contents[-1].role == "model":
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text="Please continue.")],
                )
            )

        try:
            response = await self.generate(
                active_client,
                contents=contents,
                config_factory=lambda model: build_generation_config(
                    model,
                    max_output_tokens=2048,
                    system_instruction=system_instruction,
                ),
                client_key=self.effective_key(override_key),
                # This timeout applies PER MODEL CANDIDATE, not to the whole
                # call, so it is multiplied by the length of the fallback
                # chain. A 60s cap meant one slow candidate could leave the
                # user staring at a spinner for minutes. The primary model
                # (gemini-3.6-flash) answers in ~2s, so 25s is generous while
                # still bounding a hung candidate.
                timeout=25,
            )
            text = plain_prose((response.text or "").strip())
            if not text:
                raise GeminiLiveError(
                    "Gemini returned an empty response. This usually means the "
                    "response was cut off - try again or raise max_output_tokens."
                )
            return text
        except Exception as e:
            logger.error("Live Gemini chat call failed: %s", e, exc_info=True)
            if raise_on_error:
                raise GeminiLiveError(describe_live_failure(e)) from e
            return _heuristic_chat_reply(
                messages=messages,
                topic=topic,
                thesis=thesis,
                current_turn_transcript=current_turn_transcript,
                fallacies=fallacies,
                rebuttal_text=rebuttal_text,
            )


_evaluator_instance: Optional[GeminiEvaluator] = None


def get_evaluator() -> GeminiEvaluator:
    """Dependency injection provider for GeminiEvaluator."""
    global _evaluator_instance
    if _evaluator_instance is None:
        _evaluator_instance = GeminiEvaluator()
    return _evaluator_instance
