"""Redo & Compare delta calculations between debate turns."""

from typing import Any, Dict, List, Optional
import re


def _normalize_fallacy_type(ft: Any) -> str:
    if not ft:
        return ""
    # Normalize enum, snake_case, spaces and dashes
    s = str(getattr(ft, "value", ft)).lower().strip()
    return re.sub(r"[\s\-]+", "_", s)


def compute_turn_delta(parent: Any, current: Any) -> Dict[str, Any]:
    """
    Computes read-time delta between a parent turn and a redo turn attempt:
    - soundness (argument_score delta)
    - filler count delta (fewer = negative/green, more = positive/red)
    - words per minute (WPM) delta (neutral comparative against target band)
    - fallacies fixed: an original fallacy counts as fixed only if the new evaluation's
      verified fallacies do NOT contain the same fallacy type. If wording changed but
      same type is flagged, it is classified as 'reworded, still flagged'.
      Never infers fixed from quote absence alone.
    - premises identified (before -> after): count of extracted structured premises.
    - demo mode handling: if scores are null, hides delta and provides clear explanation.
    """
    parent_score = getattr(parent, "argument_score", None)
    curr_score = getattr(current, "argument_score", None)

    parent_attempt = getattr(parent, "attempt_number", 1) or 1
    curr_attempt = getattr(current, "attempt_number", parent_attempt + 1) or (parent_attempt + 1)
    parent_id_str = str(getattr(parent, "id", ""))

    # If in demo mode or scores null: hide delta with explanation
    if parent_score is None or curr_score is None:
        return {
            "parent_turn_id": parent_id_str,
            "parent_attempt_number": parent_attempt,
            "attempt_number": curr_attempt,
            "is_demo": True,
            "delta_available": False,
            "explanation": "Numerical score delta comparison is unavailable in Demo Mode. Connect your Gemini API key to activate live scoring and delta metrics.",
            "soundness_before": None,
            "soundness_after": None,
            "soundness_delta": None,
            "confidence_before": None,
            "confidence_after": None,
            "confidence_delta": None,
            "filler_before": None,
            "filler_after": None,
            "filler_delta": None,
            "wpm_before": None,
            "wpm_after": None,
            "wpm_delta": None,
            "fallacies_fixed": [],
            "fallacies_fixed_count": 0,
            "fallacies_still_flagged": [],
            "premises_before": 0,
            "premises_after": 0,
            "premises_delta": 0,
            "warrants_added": 0,
        }

    # 1. Soundness Delta
    soundness_delta = round(float(curr_score - parent_score), 1)

    # 2. Confidence Delta
    parent_conf = getattr(parent, "confidence_score", None) or 0
    curr_conf = getattr(current, "confidence_score", None) or 0
    confidence_delta = round(float(curr_conf - parent_conf), 1)

    # 3. Filler Count Delta (fewer fillers = negative delta)
    parent_fillers_list = getattr(parent, "filler_words_detected", []) or []
    curr_fillers_list = getattr(current, "filler_words_detected", []) or []
    parent_fillers = sum(
        f.get("count", 0) if isinstance(f, dict) else getattr(f, "count", 0)
        for f in parent_fillers_list
    )
    curr_fillers = sum(
        f.get("count", 0) if isinstance(f, dict) else getattr(f, "count", 0)
        for f in curr_fillers_list
    )
    filler_delta = curr_fillers - parent_fillers

    # 4. WPM Delta (neutral display against band)
    parent_wpm = float(getattr(parent, "words_per_minute", 0) or 0)
    curr_wpm = float(getattr(current, "words_per_minute", 0) or 0)
    wpm_delta = round(curr_wpm - parent_wpm, 1)

    # 5. Fallacies Fixed & Reworded Detection:
    # An original fallacy counts as fixed ONLY if the new evaluation's verified fallacies
    # do NOT contain the same fallacy type.
    # If the wording changed but the same type is still flagged, show as "reworded, still flagged".
    parent_fallacies = getattr(parent, "fallacies_flagged", []) or []
    curr_fallacies = getattr(current, "fallacies_flagged", []) or []

    # Map current verified fallacies by normalized type
    curr_by_type: Dict[str, Dict[str, Any]] = {}
    for cf in curr_fallacies:
        cf_dict = cf if isinstance(cf, dict) else (cf.model_dump(mode="json") if hasattr(cf, "model_dump") else {})
        norm_type = _normalize_fallacy_type(cf_dict.get("type") or cf_dict.get("fallacy_type"))
        if norm_type:
            curr_by_type[norm_type] = cf_dict

    fallacies_fixed: List[Dict[str, Any]] = []
    fallacies_still_flagged: List[Dict[str, Any]] = []

    for pf in parent_fallacies:
        pf_dict = pf if isinstance(pf, dict) else (pf.model_dump(mode="json") if hasattr(pf, "model_dump") else {})
        p_type = _normalize_fallacy_type(pf_dict.get("type") or pf_dict.get("fallacy_type"))
        quote = pf_dict.get("quote", "").strip()

        if p_type in curr_by_type:
            matching_cf = curr_by_type[p_type]
            new_quote = matching_cf.get("quote", "").strip()
            # If quote text changed but fallacy type is still flagged
            is_reworded = bool(quote and new_quote and quote.lower() != new_quote.lower())
            status_text = "reworded, still flagged" if is_reworded else "still flagged"
            fallacies_still_flagged.append({
                "type": pf_dict.get("type") or pf_dict.get("fallacy_type", "Logical Fallacy"),
                "original_quote": quote,
                "new_quote": new_quote,
                "status": status_text,
                "explanation": matching_cf.get("explanation") or pf_dict.get("explanation", ""),
            })
        else:
            # Fallacy type is absent in the new evaluation: truly fixed
            fallacies_fixed.append({
                "type": pf_dict.get("type") or pf_dict.get("fallacy_type", "Logical Fallacy"),
                "quote": quote,
                "status": "fixed",
                "explanation": pf_dict.get("explanation", ""),
                "fix": pf_dict.get("fix", ""),
            })

    # 6. Premises identified (before -> after)
    parent_raw = getattr(parent, "raw_evaluation", {}) or {}
    curr_raw = getattr(current, "raw_evaluation", {}) or {}
    parent_premises: List[str] = []
    curr_premises: List[str] = []

    if isinstance(parent_raw, dict):
        parent_premises = (parent_raw.get("logic", {}) or {}).get("premises", []) or []
    if not parent_premises and hasattr(parent, "user_premises"):
        parent_premises = getattr(parent, "user_premises", []) or []

    if isinstance(curr_raw, dict):
        curr_premises = (curr_raw.get("logic", {}) or {}).get("premises", []) or []
    if not curr_premises and hasattr(current, "user_premises"):
        curr_premises = getattr(current, "user_premises", []) or []

    premises_before = len(parent_premises)
    premises_after = len(curr_premises)
    premises_delta = premises_after - premises_before
    warrants_added = max(0, premises_delta)

    return {
        "parent_turn_id": parent_id_str,
        "parent_attempt_number": parent_attempt,
        "attempt_number": curr_attempt,
        "is_demo": False,
        "delta_available": True,
        "explanation": None,
        "soundness_before": parent_score,
        "soundness_after": curr_score,
        "soundness_delta": soundness_delta,
        "confidence_before": parent_conf,
        "confidence_after": curr_conf,
        "confidence_delta": confidence_delta,
        "filler_before": parent_fillers,
        "filler_after": curr_fillers,
        "filler_delta": filler_delta,
        "wpm_before": parent_wpm,
        "wpm_after": curr_wpm,
        "wpm_delta": wpm_delta,
        "fallacies_fixed": fallacies_fixed,
        "fallacies_fixed_count": len(fallacies_fixed),
        "fallacies_still_flagged": fallacies_still_flagged,
        "premises_before": premises_before,
        "premises_after": premises_after,
        "premises_delta": premises_delta,
        "warrants_added": warrants_added,
    }
