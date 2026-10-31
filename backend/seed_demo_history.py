"""
CrossEx DebateLab - Demo Day Seed Script
Populates 10 realistic past collegiate debate sessions, turns with redos,
targeted drill practices, and 3-judge persona ballots for the guest debater.
"""

import asyncio
import datetime
import random
import sys
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import User, DebateSession, DebateTurn, UserDrill, JudgeBallot


MOTIONS = [
    (
        "THW Ban Algorithmic Content Recommendation Feeds on Social Media Platforms",
        "Algorithmic optimization creates systemic negative externalities that cannot be mitigated by voluntary user choice.",
        "parliamentary",
        150,
        185,
    ),
    (
        "THW Impose a Universal Carbon Dividend Financed by Corporate Carbon Tariffs",
        "Progressive carbon taxation with direct consumer redistribution eliminates regressive fuel poverty while penalizing emissions.",
        "parliamentary",
        140,
        180,
    ),
    (
        "THBT Central Banks Should Adopt Sovereign Digital Currencies (CBDCs)",
        "Sovereign digital currency modernizes cross-border settlements and bypasses predatory commercial banking fees.",
        "policy",
        170,
        210,
    ),
    (
        "THW Prohibit Private Equity Acquisition of Healthcare Facilities",
        "Short-term leveraged debt extractive models directly compromise patient safety and clinical nurse staffing ratios.",
        "lincoln_douglas",
        135,
        170,
    ),
    (
        "THBT Emerging Democracies Should Prefer Compulsory Voting Over Voluntary Systems",
        "Mandatory participation prevents oligarchical capture by mobilizing marginalized working-class voters.",
        "parliamentary",
        145,
        180,
    ),
    (
        "THW Make Artificial Intelligence Developers Strictly Liable for Downstream Autonomous Harms",
        "Enterprise developers possess the sole technical capability to evaluate and insure against catastrophic emergent risks.",
        "policy",
        160,
        205,
    ),
    (
        "THBT International Sporting Bodies Should Boycott Authoritarian Host States",
        "Mega-event sportswashing legitimizes human rights violations and displaces democratic scrutiny.",
        "parliamentary",
        140,
        175,
    ),
    (
        "THW Legalize Market Compensation for Living Organ Donors",
        "Regulated institutional compensation eliminates chronic organ shortages while eradicating dangerous black markets.",
        "lincoln_douglas",
        130,
        165,
    ),
    (
        "THBT Gene Editing in Human Embryos for Enhancement Should Be Globally Prohibited",
        "Genetic enhancement exacerbates permanent biological caste divides that undermine democratic equality.",
        "parliamentary",
        145,
        180,
    ),
    (
        "THW Abolish Standardized Academic Admissions Testing in Higher Education",
        "Standardized exams track familial income rather than academic curiosity or persistent cognitive aptitude.",
        "novice_spar",
        125,
        160,
    ),
]


async def seed_data():
    print("🌱 Connecting to database to seed demo day debate history...")
    async with AsyncSessionLocal() as db:
        # 1. Fetch or create guest user
        result = await db.execute(select(User).where(User.username == "guest_debater"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                id=uuid.uuid4(),
                username="guest_debater",
                email="guest@debatelab.local",
            )
            db.add(user)
            await db.flush()

        print(f"👤 User: {user.username} (ID: {user.id})")

        # Clean existing sessions for guest user to ensure fresh seed
        existing_sessions = (
            await db.execute(select(DebateSession).where(DebateSession.user_id == user.id))
        ).scalars().all()
        for s in existing_sessions:
            await db.delete(s)
        await db.flush()

        now = datetime.datetime.now(datetime.timezone.utc)

        # 2. Generate 10 past debate sessions spanning 14 days showing clear progression
        for i, (topic, thesis, fmt, min_wpm, max_wpm) in enumerate(MOTIONS):
            day_offset = 14 - int((i / 9.0) * 14)  # from 14 days ago up to today
            session_date = now - datetime.timedelta(days=day_offset, hours=random.randint(1, 10))

            # Progression curves:
            progress_ratio = i / 9.0  # 0.0 to 1.0
            base_score = 72.0 + (progress_ratio * 18.0) + random.uniform(-1.5, 2.0)
            overall_score = round(min(96.0, max(68.0, base_score)), 1)

            session = DebateSession(
                id=uuid.uuid4(),
                user_id=user.id,
                topic=topic,
                initial_thesis=thesis,
                difficulty="intermediate" if i < 6 else "advanced",
                format=fmt,
                target_wpm_min=min_wpm,
                target_wpm_max=max_wpm,
                status="completed",
                overall_score=overall_score,
                created_at=session_date,
                updated_at=session_date + datetime.timedelta(minutes=25),
                completed_at=session_date + datetime.timedelta(minutes=25),
            )
            db.add(session)
            await db.flush()

            # 3. Turns per session (2 to 3 turns)
            # In session 7 and 9, add an explicit REDO attempt turn!
            num_rounds = 3 if i % 2 == 0 else 2
            for round_num in range(1, num_rounds + 1):
                # Calculate turn metrics
                round_score = round(min(96, overall_score + (round_num * 1.5) + random.uniform(-2, 2)), 1)
                conf = int(min(96, round_score + random.randint(-3, 4)))
                arg = int(min(98, round_score + random.randint(-2, 3)))
                hesitation = int(max(10, 48 - (progress_ratio * 30) + random.randint(-4, 4)))
                wpm = round(min_wpm + ((max_wpm - min_wpm) * (0.4 + (progress_ratio * 0.5))), 1)

                # Fillers decrease as debater improves
                filler_count = max(0, int(9 - (progress_ratio * 7) + random.randint(-1, 2)))
                fillers = (
                    [{"word": "um", "count": max(1, filler_count // 2)}, {"word": "like", "count": max(1, filler_count // 2)}]
                    if filler_count > 0
                    else []
                )

                # Fallacies present early on, eliminated later
                fallacies = []
                if i < 4 and round_num == 1:
                    fallacies.append({
                        "fallacy_type": "hasty_generalization",
                        "type": "hasty_generalization",
                        "quote": "everyone knows status quo systems are failing",
                        "explanation": "Universal consensus assertion without empirical citation.",
                        "severity": "moderate",
                        "fix": "Cite empirical regulatory reports rather than appealing to popular consensus.",
                        "verified": True,
                        "start_char": 25,
                        "end_char": 71,
                    })
                elif i < 3 and round_num == 2:
                    fallacies.append({
                        "fallacy_type": "ad_hominem",
                        "type": "ad_hominem",
                        "quote": "our opponents are willfully naive",
                        "explanation": "Attacking opponent motives rather than addressing institutional incentives.",
                        "severity": "minor",
                        "fix": "Focus refutation strictly on the counter-model's deadweight economic friction.",
                        "verified": True,
                        "start_char": 10,
                        "end_char": 43,
                    })

                pauses = []
                if round_num == 1:
                    pauses = [
                        {"start_ms": 12400, "duration_ms": 1150},
                        {"start_ms": 31200, "duration_ms": 950},
                    ]

                user_turn = DebateTurn(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    turn_number=round_num,
                    speaker="user",
                    attempt_number=1,
                    parent_turn_id=None,
                    user_transcript=(
                        f"In opening this round on '{topic[:40]}...', our affirmative model directly addresses "
                        f"the underlying market failure. When profit margins prioritize short-term returns over public welfare, "
                        f"systemic externalities compound irreversibly. We warrant this through three structural links..."
                    ),
                    filler_words_detected=fillers,
                    fallacies_flagged=fallacies,
                    confidence_score=conf,
                    argument_score=arg,
                    hesitation_index=hesitation,
                    words_per_minute=wpm,
                    duration_ms=58000,
                    pauses_detected=pauses,
                    verified_fallacy_count=len(fallacies),
                    total_fallacy_count=len(fallacies),
                    raw_evaluation={},
                    created_at=session_date + datetime.timedelta(minutes=round_num * 6),
                )
                asst_turn = DebateTurn(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    turn_number=round_num,
                    speaker="assistant",
                    attempt_number=1,
                    parent_turn_id=None,
                    rebuttal_text=(
                        f"Side Opposition rejects the affirmative mandate on '{topic[:35]}'. "
                        "The speaker fundamentally conflates market friction with market failure. "
                        "By imposing statutory bans, this intervention drives activity into unmonitored shadow markets."
                    ),
                    created_at=session_date + datetime.timedelta(minutes=round_num * 6 + 1),
                )
                db.add_all([user_turn, asst_turn])
                await db.flush()

                # Add a Redo Turn for session 7 and session 9 on round 1!
                if i in (6, 8) and round_num == 1:
                    redo_conf = min(98, conf + 6)
                    redo_arg = min(98, arg + 8)
                    redo_turn = DebateTurn(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        turn_number=1,
                        speaker="user",
                        attempt_number=2,
                        parent_turn_id=user_turn.id,
                        user_transcript=(
                            f"Redo constructive on '{topic[:40]}...': By grounding our solvency in documented institutional precedents "
                            "rather than speculative assumptions, side government proves that statutory guardrails produce net positive welfare "
                            "even under conservative compliance estimates."
                        ),
                        filler_words_detected=[{"word": "um", "count": 1}],
                        fallacies_flagged=[],  # Eliminated fallacies!
                        confidence_score=redo_conf,
                        argument_score=redo_arg,
                        hesitation_index=max(8, hesitation - 12),
                        words_per_minute=wpm + 4.0,
                        duration_ms=56000,
                        pauses_detected=[{"start_ms": 22000, "duration_ms": 850}],
                        verified_fallacy_count=0,
                        total_fallacy_count=0,
                        raw_evaluation={},
                        created_at=session_date + datetime.timedelta(minutes=14),
                    )
                    db.add(redo_turn)
                    await db.flush()

            # 4. Add 3-Judge Persona Ballots for recent sessions (e.g. sessions 6, 8, 9)
            if i >= 6:
                ballots = [
                    JudgeBallot(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        persona="lay",
                        winner="user",
                        user_score=int(overall_score + 1.5),
                        opponent_score=int(overall_score - 2.0),
                        rfd="The affirmative debater provided clear real-world examples and accessible explanations. Their pacing was persuasive and easy to follow without technical jargon.",
                        key_factors=["Clarity of real-world impact", "Persuasive rhetorical cadence", "Accessible metaphors"],
                        what_would_change_decision="If the opposition had shown relatable human consequences rather than citing abstract economic indices.",
                        created_at=session_date + datetime.timedelta(minutes=24),
                    ),
                    JudgeBallot(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        persona="flow",
                        winner="user",
                        user_score=int(overall_score + 0.5),
                        opponent_score=int(overall_score - 1.5),
                        rfd="Affirmative effectively collapsed on the second clash, extending their primary causal mechanism clean through round 3. Opposition dropped the cross-border displacement counter-warrant on line 4 of the flow.",
                        key_factors=["Line-by-line coverage", "Unanswered warrant on institutional insolvency", "Comparative impact weighing"],
                        what_would_change_decision="If negative debater cleanly pulled their turn on the third speech rather than re-asserting broad assertions.",
                        created_at=session_date + datetime.timedelta(minutes=24),
                    ),
                    JudgeBallot(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        persona="technical",
                        winner="user",
                        user_score=int(overall_score + 2.0),
                        opponent_score=int(overall_score - 3.0),
                        rfd="Detailed comparative analysis carried the ballot. The government's impact calculus on reversibility and timeframe clearly outweighed the opposition's short-term administrative cost claims.",
                        key_factors=["Irreversibility weighing", "Burden of proof solvency", "Incentive alignment"],
                        what_would_change_decision="Direct challenge to the uniqueness of the status quo baseline harm.",
                        created_at=session_date + datetime.timedelta(minutes=24),
                    ),
                ]
                db.add_all(ballots)
                await db.flush()

        # 5. Seed 5 Targeted Drill Practices in UserDrill
        drills = [
            UserDrill(
                id=uuid.uuid4(),
                user_id=user.id,
                drill_type="filler_reduction",
                prompt_text="Deliver a 60-second constructive defense without relying on vocal hesitations ('um', 'uh', 'like').",
                duration_seconds=60,
                score=92,
                target_metric="fillers_per_min",
                triggering_weakness="Opening round constructive hesitation (9 fillers detected in match)",
                metrics={"fillers_detected": 1, "wpm": 162, "hesitation_index": 12},
                feedback="Outstanding discipline: reduced fillers from 9/min down to 1/min while maintaining 162 WPM rhythm.",
                created_at=now - datetime.timedelta(days=1, hours=3),
            ),
            UserDrill(
                id=uuid.uuid4(),
                user_id=user.id,
                drill_type="fallacy_repair",
                prompt_text="Reframe an unsubstantiated consensus assertion ('everyone knows...') into an institutional empirical warrant.",
                duration_seconds=60,
                score=95,
                target_metric="fallacy_discipline",
                triggering_weakness="Hasty generalization flagged during Carbon Dividend debate",
                metrics={"fallacies_repaired": 1, "score": 95},
                feedback="Perfect repair: substituted broad consensus appeal with OECD tariff enforcement data.",
                created_at=now - datetime.timedelta(days=2, hours=5),
            ),
            UserDrill(
                id=uuid.uuid4(),
                user_id=user.id,
                drill_type="impact_sprint",
                prompt_text="Execute a 60-second impact weighing sprint comparing irreversible environmental harm against short-term compliance costs.",
                duration_seconds=60,
                score=89,
                target_metric="impact_calculus",
                triggering_weakness="Dropped comparative timeframe weighing in round 3 whip",
                metrics={"impact_dimensions_weighed": 3, "score": 89},
                feedback="Clean comparative analysis: successfully demonstrated magnitude and irreversibility outweigh transition friction.",
                created_at=now - datetime.timedelta(days=4, hours=2),
            ),
            UserDrill(
                id=uuid.uuid4(),
                user_id=user.id,
                drill_type="poi_reflex",
                prompt_text="Respond immediately to an aggressive POI regarding jurisdictional flight without conceding core ground.",
                duration_seconds=45,
                score=91,
                target_metric="responsiveness",
                triggering_weakness="Hesitation and concession on opponent cross-examination POI",
                metrics={"response_delay_ms": 780, "substantive_rebuttal": True},
                feedback="Rapid 0.8s reaction time with immediate pivot to multilateral treaty safeguards.",
                created_at=now - datetime.timedelta(days=5, hours=7),
            ),
            UserDrill(
                id=uuid.uuid4(),
                user_id=user.id,
                drill_type="filler_reduction",
                prompt_text="Maintain optimal parliamentary tempo (150-175 WPM) under 60-second speech pressure.",
                duration_seconds=60,
                score=94,
                target_metric="wpm_stability",
                triggering_weakness="Cadence slowed to 128 WPM during rebuttal",
                metrics={"wpm": 168, "fillers_detected": 0},
                feedback="Rock-solid pacing at 168 WPM with zero filler words.",
                created_at=now - datetime.timedelta(days=7, hours=4),
            ),
        ]
        db.add_all(drills)

        await db.commit()
        print("✅ Demo day seed completed successfully:")
        print(f"   • 10 realistic past tournament sessions across 14-day progression")
        print(f"   • 26 debate turns with redos and before/after metrics")
        print(f"   • 9 multi-judge persona ballots (Lay, Flow, Technical)")
        print(f"   • 5 targeted skill drills with metrics and feedback")


if __name__ == "__main__":
    asyncio.run(seed_data())
