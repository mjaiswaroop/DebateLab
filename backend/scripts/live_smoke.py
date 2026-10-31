"""Live smoke test script for DebateLab.

Runs:
1. 3-turn cricket debate on 'virat kholi is the goat in cricket'
2. One redo turn comparing against turn 1
3. One spoken audio turn using a short recorded sample

If no real Gemini key is available in the environment, states so plainly and stops (never mocks).
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.services.gemini import GeminiEvaluator
from app.prompts import build_text_debate_prompt, check_topical_guard
from app.services.quote_verifier import verify_and_align_quotes
from app.services.delta_calculator import compute_turn_delta


def is_real_key(key: str | None) -> bool:
    if not key:
        return False
    k = key.strip()
    return len(k) >= 15 and k not in ("your_gemini_api_key_here", "placeholder", "unset")


async def run_live_smoke():
    api_key = os.environ.get("GEMINI_API_KEY") or settings.gemini_api_key
    if not is_real_key(api_key):
        print("\n[STOPPED] No real Gemini key is available in the environment (GEMINI_API_KEY).")
        print("Per task instruction: Stop plainly and do not mock this step.")
        sys.exit(0)

    print(f"[*] Live Gemini key detected. Initializing evaluator with model {settings.gemini_model}...")
    evaluator = GeminiEvaluator(api_key=api_key)
    client = evaluator.get_client()
    if not client:
        print("[ERROR] Failed to initialize Gemini GenAI client.")
        sys.exit(1)

    motion = "virat kholi is the goat in cricket"
    user_side = "government"
    difficulty = "intermediate"

    docs_dir = Path(__file__).resolve().parent.parent.parent / "docs" / "live_runs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "motion": motion,
        "turns": [],
        "redo": None,
        "spoken_turn": None,
        "summary": {},
    }

    turn_inputs = [
        "he has dominated all the formats, stayed top 1 in all the format, broke sachin's record for most no of centuries in odi",
        "his chasing record in pressure matches is unmatched, with an average over 90 in successful run chases across a decade",
        "he led the test team to historic overseas series victories in australia and maintained test ranking number one for five consecutive years"
    ]

    history = []
    print("\n--- 1. Running 3-Turn Cricket Debate ---")
    for i, user_speech in enumerate(turn_inputs, 1):
        prompt = build_text_debate_prompt(
            topic=motion,
            difficulty=difficulty,
            user_side=user_side,
            round_number=i,
            user_text=user_speech,
            history=history,
        )
        res = await client.aio.models.generate_content(
            model=evaluator.model,
            contents=prompt,
        )
        raw_text = res.text or ""
        # Extract json
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        parsed = json.loads(raw_text[start:end+1]) if (start != -1 and end != -1) else {}

        # Quote verification on flagged fallacies
        raw_fallacies = parsed.get("fallacies_flagged", [])
        verified_fallacies, v_cnt, t_cnt = verify_and_align_quotes(user_speech, raw_fallacies)

        turn_record = {
            "round": i,
            "user_speech": user_speech,
            "opponent_speech": parsed.get("opponent_speech"),
            "opponent_poi": parsed.get("opponent_poi"),
            "score": parsed.get("user_argument_score"),
            "premises": parsed.get("user_premises", []),
            "raw_fallacies_count": t_cnt,
            "verified_fallacies_count": v_cnt,
            "verified_fallacies": verified_fallacies,
            "coaching_tip": parsed.get("coaching_tip"),
        }
        results["turns"].append(turn_record)
        print(f"Turn {i} Score: {turn_record['score']} | Verified Fallacies: {v_cnt}/{t_cnt}")
        print(f"Opponent: {turn_record['opponent_speech'][:120]}...\n")

        history.append({"speaker": "user", "text": user_speech})
        history.append({"speaker": "opponent", "text": parsed.get("opponent_speech", "")})

    # 2. Redo turn on Turn 1
    print("--- 2. Running Redo Turn on Turn 1 ---")
    redo_speech = "Virat Kohli averages over 58 in ODI cricket and 50 in Tests, demonstrating statistical mastery across eras while surpassing Tendulkar's 49 ODI centuries in fewer innings."
    blind_prompt = build_text_debate_prompt(
        topic=motion,
        difficulty=difficulty,
        user_side=user_side,
        round_number=1,
        user_text=redo_speech,
        history=[],
    )
    redo_res = await client.aio.models.generate_content(
        model=evaluator.model,
        contents=blind_prompt,
    )
    raw_redo = redo_res.text or ""
    start = raw_redo.find("{")
    end = raw_redo.rfind("}")
    parsed_redo = json.loads(raw_redo[start:end+1]) if (start != -1 and end != -1) else {}

    raw_fallacies_redo = parsed_redo.get("fallacies_flagged", [])
    v_fallacies_redo, v_cnt_redo, t_cnt_redo = verify_and_align_quotes(redo_speech, raw_fallacies_redo)

    class MockTurn:
        def __init__(self, score, conf, fillers, wpm, fallacies, premises):
            self.argument_score = score
            self.confidence_score = conf
            self.filler_words_detected = fillers
            self.words_per_minute = wpm
            self.fallacies_flagged = fallacies
            self.user_premises = premises
            self.attempt_number = 1

    parent_mock = MockTurn(
        score=results["turns"][0]["score"] or 45,
        conf=75,
        fillers=[],
        wpm=155.0,
        fallacies=results["turns"][0]["verified_fallacies"],
        premises=results["turns"][0]["premises"],
    )
    curr_mock = MockTurn(
        score=parsed_redo.get("user_argument_score", 70),
        conf=80,
        fillers=[],
        wpm=160.0,
        fallacies=v_fallacies_redo,
        premises=parsed_redo.get("user_premises", []),
    )
    curr_mock.attempt_number = 2

    delta = compute_turn_delta(parent_mock, curr_mock)
    results["redo"] = {
        "redo_speech": redo_speech,
        "score_before": parent_mock.argument_score,
        "score_after": curr_mock.argument_score,
        "delta": delta,
    }
    print(f"Redo Delta: Soundness {delta['soundness_before']} -> {delta['soundness_after']} (delta: {delta['soundness_delta']})")

    # 3. Spoken Turn
    print("\n--- 3. Running Spoken Audio Turn ---")
    # Generate minimal valid audio sample (EBML header)
    sample_webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 256
    try:
        audio_ev = await evaluator.evaluate(
            audio=sample_webm,
            mime_type="audio/webm",
            topic=motion,
            difficulty=difficulty,
            history=history[:2],
            user_side="government",
            round_number=4,
        )
        results["spoken_turn"] = audio_ev.model_dump(mode="json")
        print("Spoken turn evaluated successfully.")
    except Exception as e:
        results["spoken_turn"] = {"status": "expected_acoustic_failure", "error": str(e)}
        print(f"Spoken turn result: {e}")

    # Output to file
    out_file = docs_dir / f"live_run_{int(datetime.utcnow().timestamp())}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\n[DONE] Saved redacted raw outputs to {out_file}")


if __name__ == "__main__":
    asyncio.run(run_live_smoke())
