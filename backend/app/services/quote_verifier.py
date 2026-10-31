import re
import string
from typing import Any, Dict, List, Tuple
from rapidfuzz import fuzz

MULTI_WORD_FILLERS = ["you know", "sort of", "kind of"]
SINGLE_WORD_FILLERS = {"um", "uh", "er", "ah", "like", "basically", "actually", "right"}


def normalize_text_for_verification(text: str, remove_fillers: bool = True) -> str:
    """
    Normalizes text for robust quote verification:
    - lowercase
    - strip punctuation (replacing with spaces to prevent word concatenation)
    - collapse whitespace
    - ignore filler words (e.g. um, uh, like, you know, basically)
    """
    if not text:
        return ""

    lowered = text.lower()

    if remove_fillers:
        for phrase in MULTI_WORD_FILLERS:
            lowered = re.sub(rf"\b{re.escape(phrase)}\b", " ", lowered)

    # Replace punctuation characters with whitespace
    cleaned = re.sub(r"[^\w\s]", " ", lowered)

    words = cleaned.split()
    if remove_fillers:
        words = [w for w in words if w not in SINGLE_WORD_FILLERS]

    return " ".join(words)


def verify_and_align_quotes(
    transcript: str,
    fallacies: List[Dict[str, Any]],
    fuzzy_threshold: float = 90.0,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Server-side verification of every fallacy quote against the model-produced transcript:
    - Normalizes both strings (lowercase, strip punctuation, collapse whitespace, ignore fillers).
    - Checks whether raw or normalized quote is an exact substring of the transcript.
    - SHORT QUOTE RULE: For normalized quotes shorter than 4 words (< 4 words), requires an EXACT
      substring match. Fuzzy fallback is strictly disabled for short phrases to eliminate false
      positives where generic words accidentally match unrelated sentences.
    - LONGER QUOTE FUZZY MATCH: For normalized quotes of 4 or more words (>= 4 words), allows
      fuzzy fallback using rapidfuzz partial_ratio >= 90.0 (fuzzy_threshold). The 90.0 threshold
      tolerates minor ASR / formatting discrepancies (e.g., singular/plural, contracted forms)
      while maintaining rigorous adjudicator integrity.
    - Discards unverified fallacies entirely.
    - Computes character offsets [start_char, end_char] in the original transcript where possible.
    - Returns: (verified_fallacies, verified_count, total_count)
    """
    if not fallacies:
        return [], 0, 0

    if not transcript or not transcript.strip():
        return [], 0, len(fallacies)

    total_count = len(fallacies)
    verified_fallacies: List[Dict[str, Any]] = []

    norm_transcript = normalize_text_for_verification(transcript, remove_fillers=True)
    lower_transcript = transcript.lower()

    for item in fallacies:
        quote = item.get("quote", "").strip() if isinstance(item, dict) else getattr(item, "quote", "").strip()
        if not quote:
            continue

        norm_quote = normalize_text_for_verification(quote, remove_fillers=True)
        if not norm_quote:
            # If quote was only filler words or punctuation, also check non-filler stripped version
            norm_quote_raw = normalize_text_for_verification(quote, remove_fillers=False)
            norm_trans_raw = normalize_text_for_verification(transcript, remove_fillers=False)
            if norm_quote_raw and norm_quote_raw in norm_trans_raw:
                is_verified = True
            else:
                continue
        else:
            is_verified = False

        start_char = -1
        end_char = -1
        norm_tokens = norm_quote.split()
        word_count = len(norm_tokens)

        # 1. Exact raw substring check (case-insensitive)
        raw_idx = lower_transcript.find(quote.lower())
        if raw_idx != -1:
            is_verified = True
            start_char = raw_idx
            end_char = raw_idx + len(quote)
        elif norm_quote in norm_transcript:
            # 2. Exact normalized substring match
            is_verified = True
            # Attempt to locate approximate bounds in original transcript
            first_w = norm_tokens[0]
            last_w = norm_tokens[-1]
            first_idx = lower_transcript.find(first_w)
            if first_idx != -1:
                last_idx = lower_transcript.find(last_w, first_idx)
                if last_idx != -1:
                    start_char = first_idx
                    end_char = last_idx + len(last_w)
                else:
                    start_char = first_idx
                    end_char = min(len(transcript), first_idx + len(quote))
        elif word_count >= 4:
            # 3. Fuzzy fallback ONLY for longer quotes (>= 4 words) with threshold >= 90.0
            ratio = fuzz.partial_ratio(norm_quote, norm_transcript)
            if ratio >= fuzzy_threshold:
                is_verified = True
                first_idx = lower_transcript.find(norm_tokens[0])
                if first_idx != -1:
                    start_char = first_idx
                    end_char = min(len(transcript), first_idx + len(quote))
        else:
            # Short quotes (< 4 words) require exact match; fuzzy fallback is disabled
            is_verified = False

        if is_verified:
            enriched = dict(item) if isinstance(item, dict) else item.model_dump(mode="json")
            enriched["verified"] = True
            enriched["start_char"] = start_char if start_char != -1 else None
            enriched["end_char"] = end_char if end_char != -1 else None
            verified_fallacies.append(enriched)

    return verified_fallacies, len(verified_fallacies), total_count
