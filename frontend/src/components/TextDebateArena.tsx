"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TextDebateTurnRequest,
  TextDebateTurnResponse,
  DebateVerdictResponse,
  Fallacy,
} from "@/types/debate";
import { submitTextDebateTurn, getDebateVerdict } from "@/lib/api";
import { AnimatedText } from "@/components/AnimatedText";
import {
  Trophy,
  Scale,
  Sparkles,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  Award,
  Zap,
  ArrowRight,
  Shield,
  MessageSquare,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Play,
  BookOpen,
  Dices,
} from "lucide-react";

interface TurnRecord {
  round: number;
  user_speech: string;
  response: TextDebateTurnResponse;
}

const PRESET_MOTIONS = [
  {
    topic: "Social Media Does More Harm Than Good to Teenagers",
    category: "Beginner Friendly",
    side: "government" as const,
  },
  {
    topic: "Remote Working Is Better Than Traditional 9-to-5 Office Work",
    category: "Beginner Friendly",
    side: "government" as const,
  },
  {
    topic: "College Degrees Are No Longer Worth the Financial Debt",
    category: "Beginner Friendly",
    side: "government" as const,
  },
  {
    topic: "Fast Food and Sugary Drinks Should Face Heavy Public Health Taxes",
    category: "Beginner Friendly",
    side: "government" as const,
  },
  {
    topic: "This House Would Ban Algorithmic Content Recommendation Feeds on Social Media",
    category: "Tech & Society",
    side: "government" as const,
  },
  {
    topic: "This House Believes Artificial Intelligence Poses an Existential Threat to Open Elections",
    category: "AI & Politics",
    side: "government" as const,
  },
  {
    topic: "This House Would Ban Targeted Political Advertising on Digital Platforms",
    category: "Democracy & Tech",
    side: "government" as const,
  },
  {
    topic: "This House Would Implement a Universal Basic Income Funded by Automation Taxes",
    category: "Economics",
    side: "government" as const,
  },
  {
    topic: "This House Would Prohibit AI Systems in High-Stakes Judicial Sentencing",
    category: "Law & Ethics",
    side: "government" as const,
  },
];

const ARGUMENT_PROMPTS = [
  {
    label: "P-E-E-L Framework",
    insert: "\n\n1. Point: \n2. Explanation: \n3. Evidence: \n4. Link: ",
  },
  {
    label: "Causal Warrant",
    insert: " This operates through a direct behavioral mechanism: because stakeholders face perverse incentives, ",
  },
  {
    label: "Comparative Impact",
    insert: " On comparative impact calculus: the irreversible societal harm of inaction vastly outweighs the temporary compliance friction because ",
  },
  {
    label: "Refute Opponent POI",
    insert: " In direct response to the opponent's Point of Information: ",
  },
];

export const TextDebateArena: React.FC = () => {
  // Debate Configuration State
  const [topic, setTopic] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  const [userSide, setUserSide] = useState<"government" | "opposition">("government");
  const [difficulty, setDifficulty] = useState<"novice" | "intermediate" | "advanced">("intermediate");
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [isCustomTopic, setIsCustomTopic] = useState<boolean>(false);
  const [isTopicConfirmed, setIsTopicConfirmed] = useState<boolean>(false);
  const [showBeginnerGuide, setShowBeginnerGuide] = useState<boolean>(false);

  const handlePickRandomTopic = () => {
    const chosen = PRESET_MOTIONS[Math.floor(Math.random() * PRESET_MOTIONS.length)];
    setTopic(chosen.topic);
    setCustomInput(chosen.topic);
    setUserSide(chosen.side);
  };

  // Active Debate Progress State
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  // Verdict & Stats State
  const [verdict, setVerdict] = useState<DebateVerdictResponse | null>(null);
  const [isVerdictLoading, setIsVerdictLoading] = useState<boolean>(false);
  const [showVerdictModal, setShowVerdictModal] = useState<boolean>(false);
  const [copiedBallot, setCopiedBallot] = useState<boolean>(false);

  // Timer & UI references
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  // Turn timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Auto scroll to latest exchange
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isLoading]);

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingText === text) {
      window.speechSynthesis.cancel();
      setSpeakingText(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingText(null);
    utterance.onerror = () => setSpeakingText(null);
    setSpeakingText(text);
    window.speechSynthesis.speak(utterance);
  };

  const handleInsertPrompt = (snippet: string) => {
    setUserInput((prev) => prev + snippet);
  };

  const handleSubmitTurn = async () => {
    if (!userInput.trim() || isLoading) return;

    const currentSpeech = userInput.trim();
    setIsLoading(true);
    setIsTimerRunning(false);

    // Prepare history payload
    const historyPayload = turns.flatMap((t) => [
      { speaker: "user", text: t.user_speech, round: t.round },
      { speaker: "assistant", text: t.response.opponent_speech, round: t.round },
    ]);

    const req: TextDebateTurnRequest = {
      topic,
      difficulty,
      user_side: userSide,
      round_number: roundNumber,
      user_text: currentSpeech,
      history: historyPayload,
    };

    try {
      const response = await submitTextDebateTurn(req);
      const newRecord: TurnRecord = {
        round: roundNumber,
        user_speech: currentSpeech,
        response,
      };

      const updatedTurns = [...turns, newRecord];
      setTurns(updatedTurns);
      setUserInput("");
      setSecondsElapsed(0);

      // If finished round 3 (or user reached max rounds), automatically adjudicate match!
      if (roundNumber >= 3) {
        setRoundNumber(4);
        await handleRequestVerdict(updatedTurns);
      } else {
        setRoundNumber((prev) => prev + 1);
        setIsTimerRunning(true);
      }
    } catch (err: unknown) {
      console.error("Text debate turn failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestVerdict = async (recordsToJudge?: TurnRecord[]) => {
    const list = recordsToJudge || turns;
    if (list.length === 0) return;

    setIsVerdictLoading(true);
    const fullHistory = list.flatMap((t) => [
      { speaker: "user", text: t.user_speech, round: t.round },
      { speaker: "assistant", text: t.response.opponent_speech, round: t.round },
    ]);

    try {
      const result = await getDebateVerdict({
        topic,
        difficulty,
        user_side: userSide,
        history: fullHistory,
      });
      setVerdict(result);
      setShowVerdictModal(true);
    } catch (err) {
      console.error("Failed to generate verdict", err);
    } finally {
      setIsVerdictLoading(false);
    }
  };

  const resetBattle = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingText(null);
    setTurns([]);
    setRoundNumber(1);
    setUserInput("");
    setVerdict(null);
    setShowVerdictModal(false);
    setSecondsElapsed(0);
    setIsTimerRunning(false);
    setIsTopicConfirmed(false);
    setTopic("");
    setCustomInput("");
  };

  const copyBallotMarkdown = () => {
    if (!verdict) return;
    const text = `# Chief Adjudicator Championship Ruling
**Motion:** "${topic}"
**Your Side:** ${userSide === "government" ? "Government / Affirmative" : "Opposition / Negative"}
**Verdict:** ${verdict.outcome.toUpperCase()} (${verdict.user_score} vs ${verdict.opponent_score})
**Rank:** ${verdict.speaker_rank}

## Reason For Decision (RFD)
${verdict.rfd}

## Key Clashes
${verdict.clashes.map((c) => `- **${c.clash_name}** [Winner: ${c.winner.toUpperCase()}]: ${c.analysis}`).join("\n")}

## Skill Breakdown
- Soundness: ${verdict.skill_breakdown.soundness}/100
- Responsiveness: ${verdict.skill_breakdown.responsiveness}/100
- Warrants: ${verdict.skill_breakdown.warrants}/100
- Fallacy Discipline: ${verdict.skill_breakdown.fallacy_discipline}/100
- Impact Calculus: ${verdict.skill_breakdown.impact_calculus}/100

## Highlights
- **Strongest Point:** ${verdict.strongest_user_point}
- **Opponent's Best Blow:** ${verdict.opponent_best_blow}
- **Chief Adjudicator's Coaching Advice:** ${verdict.key_coaching_advice}
`;
    navigator.clipboard.writeText(text);
    setCopiedBallot(true);
    setTimeout(() => setCopiedBallot(false), 2200);
  };

  const userRoleTitle = userSide === "government" ? "Government (Affirmative)" : "Opposition (Negative)";
  const oppRoleTitle = userSide === "government" ? "Opposition (Negative)" : "Government (Affirmative)";
  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  if (!isTopicConfirmed && turns.length === 0) {
    return (
      <div className="w-full flex flex-col font-sans selection:bg-black selection:text-pink-200">
        {/* ============================================================== */}
        {/* SECTION 1: EDITORIAL BLUSH PINK HERO BLOCK (#fcdbe8)           */}
        {/* ============================================================== */}
        <section className="relative w-full bg-[#fcdbe8] text-black px-6 sm:px-12 md:px-20 pt-10 pb-14 border-b border-black/10 overflow-hidden">
          {/* Subtle ambient blur glow blobs */}
          <div className="absolute -top-24 -right-12 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none animate-blob" />
          <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-white/40 rounded-full blur-2xl pointer-events-none animate-blob-delay-1" />

          <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10">
            {/* Top metadata strip */}
            <div className="flex items-center justify-between border-b border-black/15 pb-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-black/80">
                <Scale className="w-4 h-4 text-black" />
                <span>Collegiate Parliamentary Arena &bull; 3-Round Tournament</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  AI
                </span>
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  2.5
                </span>
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  PARL
                </span>
              </div>
            </div>

            {/* Headline and Intro */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-2">
              <div className="flex flex-col gap-3 max-w-3xl">
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[0.94] text-black uppercase animate-fade-in-up">
                  Configure Your
                  <br />
                  Parliamentary Match.
                </h1>
                <p className="text-sm sm:text-base font-medium text-black/80 max-w-2xl leading-relaxed pt-1">
                  <AnimatedText
                    text="Select an official collegiate proposition or enter your custom motion. Compete across Prime Minister Constructive, Opposition Rebuttal, and Whip Crystallization rounds with live Gemini adjudication."
                    delayMs={250}
                    staggerMs={22}
                  />
                </p>
              </div>

              {/* Beginner Helper Toggle Pill */}
              <button
                onClick={() => setShowBeginnerGuide(!showBeginnerGuide)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border border-black/30 hover:border-black bg-white/60 hover:bg-white text-xs font-bold text-black tracking-tight transition-all duration-300 shadow-sm hover:scale-105 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-black" />
                <span>{showBeginnerGuide ? "Close Debate Guide" : "Debate Guide (60s)"}</span>
                {showBeginnerGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Debate Guide Card */}
            {showBeginnerGuide && (
              <div className="mt-4 p-5 sm:p-6 rounded-2xl bg-black text-white border border-neutral-800 shadow-xl flex flex-col gap-4 text-xs leading-relaxed animate-fade-in-up">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h4 className="font-bold text-sm text-[#fcdbe8] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#fcdbe8]" />
                    <span>Collegiate Parliamentary Debate 101</span>
                  </h4>
                  <span className="text-[10px] font-mono text-neutral-400">APDA / BP Standards</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-emerald-300 uppercase font-mono text-[10px] tracking-wider">
                      1. Government (Aff)
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      Argue <strong>YES / Support</strong>. Introduce status quo harms, your policy model, and core impact mechanisms.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-rose-300 uppercase font-mono text-[10px] tracking-wider">
                      2. Opposition (Neg)
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      Argue <strong>NO / Oppose</strong>. Expose fallacies, ungrounded warrants, and secondary unintended impacts.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-cyan-300 uppercase font-mono text-[10px] tracking-wider">
                      3. The 3 Rounds
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      <strong>R1:</strong> Constructive thesis.<br />
                      <strong>R2:</strong> Rebuttals &amp; clash.<br />
                      <strong>R3:</strong> Whip crystallization.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-[#fcdbe8] uppercase font-mono text-[10px] tracking-wider">
                      4. Winning Strategy
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      State your warrants clearly: link cause to effect, weigh impact magnitude, and respond to opponent points directly.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 2: CONFIGURATION & MOTION SELECTION SECTION            */}
        {/* ============================================================== */}
        <section className="w-full bg-[#050505] text-white px-6 sm:px-12 md:px-20 py-12 flex-1">
          <div className="max-w-6xl mx-auto flex flex-col gap-10">

            {/* Option A: Custom Motion Builder Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#090a0f] border border-neutral-800 shadow-2xl flex flex-col gap-6 relative overflow-hidden transition-all duration-300 hover:border-neutral-700 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fcdbe8] animate-pulse" />
                  <label className="text-xs font-bold uppercase tracking-wider text-[#fcdbe8] font-mono">
                    Option A &bull; Custom Proposition
                  </label>
                </div>
                <button
                  onClick={handlePickRandomTopic}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-mono border border-neutral-700 hover:border-[#fcdbe8] transition-all hover:scale-105 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5 text-[#fcdbe8]" />
                  <span>Surprise Me / Random Motion</span>
                </button>
              </div>

              {/* Input Area */}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    setTopic(e.target.value);
                  }}
                  placeholder="Type any proposition e.g., 'This House Would Ban Algorithmic Feeds on Social Media'..."
                  className="w-full px-5 py-4 rounded-2xl bg-black border border-neutral-800 text-sm sm:text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] focus:ring-1 focus:ring-[#fcdbe8] transition-all shadow-inner"
                />
              </div>

              {/* Controls Strip: Assigned Side, Tier, and CTA */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pt-3 border-t border-neutral-800/80">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Assigned Side */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-neutral-400">Assigned Side:</span>
                    <div className="flex items-center p-1 rounded-full bg-black border border-neutral-800 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setUserSide("government")}
                        className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                          userSide === "government"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Government (Aff)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserSide("opposition")}
                        className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                          userSide === "opposition"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Opposition (Neg)
                      </button>
                    </div>
                  </div>

                  {/* Circuit Tier */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-neutral-400">Circuit Tier:</span>
                    <div className="flex items-center p-1 rounded-full bg-black border border-neutral-800 text-xs font-semibold">
                      {(["novice", "intermediate", "advanced"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setDifficulty(lvl)}
                          className={`px-3.5 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                            difficulty === lvl
                              ? "bg-[#fcdbe8] text-black font-bold shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Begin Tournament Match Button */}
                <button
                  onClick={() => {
                    const final = (customInput || topic).trim();
                    if (final) {
                      setTopic(final);
                      setIsTopicConfirmed(true);
                    }
                  }}
                  disabled={!customInput.trim() && !topic.trim()}
                  className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs tracking-tight shadow-lg shadow-[#fcdbe8]/10 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span>Begin Tournament Match</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Option B: Curated Collegiate Motions */}
            <div className="flex flex-col gap-5 pt-2 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#fcdbe8]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
                    Option B &bull; Curated Collegiate Parliamentary Motions
                  </span>
                </div>
                <span className="text-xs text-neutral-500 font-mono">Click card to instantly launch</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PRESET_MOTIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTopic(preset.topic);
                      setCustomInput(preset.topic);
                      setUserSide(preset.side);
                      setIsTopicConfirmed(true);
                    }}
                    className="p-5 rounded-2xl bg-[#090a0f] hover:bg-neutral-900 border border-neutral-800 hover:border-[#fcdbe8] text-left transition-all duration-300 cursor-pointer group flex flex-col justify-between gap-4 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-black text-[#fcdbe8] border border-neutral-800 group-hover:border-[#fcdbe8]/50 transition-colors">
                        {preset.category}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono group-hover:text-[#fcdbe8] transition-colors flex items-center gap-1">
                        <span>1-Click Start</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-[#fcdbe8] leading-snug transition-colors">
                      {preset.topic}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono pt-1 border-t border-neutral-900">
                      <span>Standard 3-Round Format</span>
                      <span>&bull;</span>
                      <span className="capitalize">{preset.side}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col font-sans selection:bg-black selection:text-pink-200">
      {/* ============================================================== */}
      {/* 1. TOP STATUS & CONTROLS BAR                                    */}
      {/* ============================================================== */}
      <div className="w-full bg-[#0d0f18] border-b border-neutral-800 px-4 sm:px-8 py-4">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fcdbe8]/20 text-[#fcdbe8] border border-[#fcdbe8]/30 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#fcdbe8]" />
                Collegiate Text Arena
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700 capitalize">
                {difficulty} Division
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  userSide === "government"
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-950/40 text-rose-300 border-rose-500/30"
                }`}
              >
                You: {userRoleTitle}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 pt-1">
              <span>&ldquo;{topic}&rdquo;</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsConfiguring(!isConfiguring)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Match Settings</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isConfiguring ? "rotate-180" : ""}`} />
            </button>

            {turns.length > 0 && (
              <button
                onClick={resetBattle}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all flex items-center gap-1 cursor-pointer"
                title="Reset debate"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {turns.length > 0 && (
              <button
                onClick={() => {
                  if (verdict) {
                    setShowVerdictModal(true);
                  } else {
                    handleRequestVerdict();
                  }
                }}
                disabled={isVerdictLoading}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>{verdict ? "View Ballot & Stats" : isVerdictLoading ? "Judging..." : "Adjudicate Match"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Configuration Drawer */}
        {isConfiguring && (
          <div className="max-w-[1720px] mx-auto mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-in fade-in duration-200">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-neutral-400 font-semibold block">Parliamentary Motion</label>
                <button
                  type="button"
                  onClick={() => setIsCustomTopic(!isCustomTopic)}
                  className="text-[10px] font-bold text-[#fcdbe8] hover:underline cursor-pointer"
                >
                  {isCustomTopic ? "Pick Curated" : "+ Custom Motion"}
                </button>
              </div>
              {isCustomTopic ? (
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    resetBattle();
                  }}
                  placeholder="Type any tournament motion..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#fcdbe8]"
                />
              ) : (
                <select
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    resetBattle();
                  }}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#fcdbe8]"
                >
                  {PRESET_MOTIONS.map((m, idx) => (
                    <option key={idx} value={m.topic}>
                      [{m.category}] {m.topic.slice(0, 50)}...
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-neutral-400 font-semibold block mb-1.5">Your Assigned Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserSide("government");
                    resetBattle();
                  }}
                  className={`py-2 px-3 rounded-lg border font-bold transition-all text-center cursor-pointer ${
                    userSide === "government"
                      ? "bg-emerald-950/50 border-emerald-500 text-emerald-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  Government (Aff)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserSide("opposition");
                    resetBattle();
                  }}
                  className={`py-2 px-3 rounded-lg border font-bold transition-all text-center cursor-pointer ${
                    userSide === "opposition"
                      ? "bg-rose-950/50 border-rose-500 text-rose-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  Opposition (Neg)
                </button>
              </div>
            </div>

            <div>
              <label className="text-neutral-400 font-semibold block mb-1.5">Tournament Circuit Standard</label>
              <div className="grid grid-cols-3 gap-2">
                {(["novice", "intermediate", "advanced"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`py-2 px-2 rounded-lg border font-bold capitalize transition-all text-center cursor-pointer ${
                      difficulty === lvl
                        ? "bg-[#fcdbe8]/20 border-[#fcdbe8] text-[#fcdbe8]"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN DEBATE ARENA (SPLIT TRANSCRIPT & REALTIME JUDGING)     */}
      {/* ============================================================== */}
      <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): The Floor & Transcript Stream */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Round Indicator Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Parliamentary Floor Transcript
              </h2>
            </div>
            <div className="text-xs font-semibold text-neutral-400 flex items-center gap-3">
              <span>
                Round {Math.min(roundNumber, 3)} of 3
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                {roundNumber === 1
                  ? "Constructive Phase"
                  : roundNumber === 2
                  ? "Rebuttal & Extension"
                  : roundNumber === 3
                  ? "Whip & Crystallization"
                  : "Match Concluded"}
              </span>
            </div>
          </div>

          {/* Transcript History */}
          <div className="flex flex-col gap-6">
            {turns.length === 0 && (
              <div className="p-7 sm:p-9 rounded-3xl bg-gradient-to-b from-[#0b0e1a] to-[#07080f] border border-neutral-800 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                {/* Subtle blush ambient glow in top-right */}
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#fcdbe8]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-black border border-[#fcdbe8]/40 text-[#fcdbe8] flex items-center justify-center shadow-inner shrink-0">
                      <Scale className="w-5 h-5 text-[#fcdbe8]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">
                        Collegiate Championship Chamber
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        Parliamentary Match Briefing
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-700 text-[#fcdbe8]">
                      3 Tournament Rounds
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-700 text-neutral-300">
                      {difficulty} tier
                    </span>
                  </div>
                </div>

                {/* Motion Spotlight Card */}
                <div className="p-5 rounded-2xl bg-black/60 border border-neutral-800 flex flex-col gap-3 relative">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#fcdbe8] font-bold">
                    Official Parliamentary Motion
                  </span>
                  <p className="text-base sm:text-lg font-bold text-white font-serif leading-snug">
                    &ldquo;{topic}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800/80">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 font-medium">Assigned Bench:</span>
                      <div className="flex items-center p-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setUserSide("government")}
                          className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                            userSide === "government"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Government (Aff)
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserSide("opposition")}
                          className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                            userSide === "opposition"
                              ? "bg-rose-950 text-rose-300 border border-rose-500/50 shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Opposition (Neg)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsConfiguring(true)}
                      className="text-xs font-bold text-[#fcdbe8] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Change Motion / Settings</span>
                    </button>
                  </div>
                </div>

                {/* Round Protocol Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Round 1</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        Opening Constructive
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-snug">
                      Frame the policy model, define stakeholder incentives, and deliver your prime warrants.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Round 2</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                        Rebuttal &amp; POI
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-snug">
                      Dismantle adversary claims and directly address the opponent&apos;s Point of Information.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Round 3</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800">
                        Whip Crystallization
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-snug">
                      Collapse clashes and execute comparative impact weighing to secure the judicial ballot.
                    </p>
                  </div>
                </div>

                {/* Direct Action Button */}
                <div className="flex items-center justify-center pt-1">
                  <button
                    onClick={() => {
                      const textarea = document.querySelector("textarea");
                      textarea?.focus();
                    }}
                    className="px-7 py-2.5 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs sm:text-sm tracking-tight transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02]"
                  >
                    <span>Take The Floor: Deliver Round 1 Speech</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.round} className="flex flex-col gap-4">
                {/* Round Badge Divider */}
                <div className="flex items-center gap-3 my-2">
                  <div className="h-px bg-neutral-800 flex-1" />
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-neutral-900 text-neutral-400 border border-neutral-800">
                    Round {turn.round} Exchanges
                  </span>
                  <div className="h-px bg-neutral-800 flex-1" />
                </div>

                {/* 1. User Speech Card */}
                <div className="p-5 rounded-2xl bg-[#080d1a] border border-emerald-900/40 relative group hover:border-emerald-700/60 transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        {userRoleTitle} [You]
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {turn.user_speech.split(/\s+/).length} words
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
                      Soundness: {turn.response.user_argument_score}/100
                    </span>
                  </div>
                  <p className="text-sm text-neutral-200 leading-relaxed font-serif whitespace-pre-line">
                    {turn.user_speech}
                  </p>
                </div>

                {/* 2. Opponent Rebuttal Card */}
                <div className="p-5 rounded-2xl bg-[#14080e] border border-rose-900/40 relative group hover:border-rose-700/60 transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                        {oppRoleTitle} [Collegiate Adversary]
                      </span>
                    </div>
                    <button
                      onClick={() => handleSpeak(turn.response.opponent_speech)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                      title="Listen to speech"
                    >
                      {speakingText === turn.response.opponent_speech ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[10px] text-rose-400">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span className="text-[10px]">Speak</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-neutral-200 leading-relaxed font-serif whitespace-pre-line">
                    &ldquo;{turn.response.opponent_speech}&rdquo;
                  </p>

                  {/* Opponent Point of Information (POI) */}
                  {turn.response.opponent_poi && (
                    <div className="mt-4 p-3.5 rounded-xl bg-neutral-900/90 border border-rose-500/30 flex items-start gap-3">
                      <div className="p-1 rounded bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                          Piercing Point of Information (POI)
                        </span>
                        <p className="text-xs text-neutral-200 font-medium italic">
                          &ldquo;{turn.response.opponent_poi}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator while AI Opponent evaluates and responds */}
            {isLoading && (
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-center gap-3 text-neutral-400 animate-pulse">
                <div className="w-4 h-4 border-2 border-[#fcdbe8] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">
                  Opponent is formulating adversarial rebuttal &amp; collegiate adjudicator is analyzing logic...
                </span>
              </div>
            )}

            <div ref={transcriptBottomRef} />
          </div>

          {/* Active Round Input Deck (Only shown while match is active) */}
          {roundNumber <= 3 && (
            <div className="p-5 rounded-2xl bg-[#0a0c16] border border-neutral-800 shadow-xl mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#fcdbe8] text-black font-bold text-xs flex items-center justify-center">
                    {roundNumber}
                  </span>
                  <span className="text-xs font-bold text-white tracking-tight">
                    {roundNumber === 1
                      ? "Deliver Opening Constructive Speech"
                      : roundNumber === 2
                      ? "Deliver Rebuttal & Address Opponent POI"
                      : "Deliver Whip Speech & Final Crystallization"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    {Math.floor(secondsElapsed / 60)}:{(secondsElapsed % 60).toString().padStart(2, "0")}
                  </span>
                  <span>{userInput.trim().split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>

              {/* Argument Helper Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-neutral-500 mr-1 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-[#fcdbe8]" />
                  Scaffolding:
                </span>
                {ARGUMENT_PROMPTS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertPrompt(chip.insert)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-all cursor-pointer"
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>

              {/* Text Area */}
              <textarea
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  if (!isTimerRunning && e.target.value.length > 0) {
                    setIsTimerRunning(true);
                  }
                }}
                rows={5}
                placeholder={
                  roundNumber === 1
                    ? "Mr. Speaker, the proposition stands for... We present two structural contentions. First, on stakeholder incentives..."
                    : roundNumber === 2
                    ? "In direct response to the opposition's challenge on regulatory displacement, we prove that statutory enforcement..."
                    : "Members of the panel, this debate collapses onto two final clashes: the feasibility of enforcement versus the catastrophic magnitude of inaction..."
                }
                className="w-full bg-[#05070d] border border-neutral-800 rounded-xl p-4 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] transition-all resize-y leading-relaxed font-sans"
              />

              {/* Submit Row */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-neutral-500 hidden sm:block">
                  Tips: Ground arguments in empirical warrants rather than moral assertions.
                </p>

                <div className="flex items-center gap-3 ml-auto">
                  {turns.length >= 1 && (
                    <button
                      type="button"
                      onClick={() => handleRequestVerdict()}
                      disabled={isVerdictLoading || isLoading}
                      className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-all cursor-pointer"
                    >
                      Conclude Early &amp; Judge
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitTurn}
                    disabled={!userInput.trim() || isLoading}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#fcdbe8] to-[#f9b8d2] hover:opacity-90 text-black text-xs font-bold tracking-tight transition-all flex items-center gap-2 shadow-lg shadow-pink-500/10 cursor-pointer disabled:opacity-40"
                  >
                    <span>{isLoading ? "Opponent Formulating..." : `Submit Round ${roundNumber} Speech`}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {roundNumber > 3 && (
            <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">All 3 Rounds Complete!</h3>
              <p className="text-xs text-neutral-400 max-w-md">
                The championship match has concluded. Review the official Chief Adjudicator ruling and skill breakdown.
              </p>
              <button
                onClick={() => setShowVerdictModal(true)}
                className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Open Full Adjudicator Ballot &amp; Stats</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Live Round Analytics & Fallacy Diagnostics */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-24">
          {/* Card: Current Round Diagnostics */}
          <div className="p-6 rounded-2xl bg-[#090a12] border border-neutral-800 flex flex-col gap-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#fcdbe8]" />
                Live Logic Scorecard
              </h3>
              <span className="text-[10px] text-neutral-500 font-mono">Turn Diagnostics</span>
            </div>

            {latestTurn ? (
              <div className="flex flex-col gap-5">
                {/* Score Big Display */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/70 border border-neutral-800">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-neutral-400 font-semibold uppercase">Round {latestTurn.round} Quality</span>
                    <span className="text-xs text-neutral-500">Argument Soundness</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-emerald-400">
                      {latestTurn.response.user_argument_score}
                    </span>
                    <span className="text-xs text-neutral-500 font-semibold">/100</span>
                  </div>
                </div>

                {/* Core Extracted Premises */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Warranted Premises
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {latestTurn.response.user_premises.map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flagged Fallacies */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Fallacies Flagged
                  </span>
                  {latestTurn.response.fallacies_flagged.length === 0 ? (
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Clean rhetoric! No formal or informal fallacies detected.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {latestTurn.response.fallacies_flagged.map((f, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                              {f.type.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-amber-400/80 font-mono capitalize">
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 italic">
                            &ldquo;{f.quote}&rdquo;
                          </p>
                          <p className="text-[11px] text-neutral-400 leading-tight">
                            {f.explanation}
                          </p>
                          <div className="mt-1 pt-1 border-t border-amber-500/20 text-[11px] text-amber-200">
                            <strong>How to fix:</strong> {f.fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tactical Coaching Tip */}
                {latestTurn.response.coaching_tip && (
                  <div className="p-3.5 rounded-xl bg-[#fcdbe8]/10 border border-[#fcdbe8]/30 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-[#fcdbe8] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Coach&apos;s Strategic Tip
                    </span>
                    <p className="text-xs text-neutral-200 leading-relaxed">
                      {latestTurn.response.coaching_tip}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
                <HelpCircle className="w-8 h-8 text-neutral-700" />
                <p>Deliver your Round 1 speech to activate live argumentation metrics and fallacy scans.</p>
              </div>
            )}
          </div>

          {/* Quick Parliamentary Guide Card */}
          <div className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-400 flex flex-col gap-2.5">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Tournament Scoring Criteria</h4>
            <ul className="space-y-1.5 list-disc list-inside text-[11px]">
              <li><strong>Soundness (0-100):</strong> Causal depth and premise plausibility.</li>
              <li><strong>Responsiveness (0-100):</strong> Direct engagement with opponent arguments.</li>
              <li><strong>Warrants (0-100):</strong> Explaining *why* incentives cause the stated harm.</li>
              <li><strong>Impact Calculus:</strong> Magnitude, likelihood, and reversibility weighing.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FULL CHAMPIONSHIP BALLOT & STATS MODAL                      */}
      {/* ============================================================== */}
      {showVerdictModal && verdict && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#090b14] border border-neutral-800 rounded-3xl max-w-4xl w-full p-6 sm:p-10 max-h-[90vh] overflow-y-auto flex flex-col gap-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 uppercase">
                    <Trophy className="w-3.5 h-3.5" />
                    Official Judicial Ballot
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 text-neutral-300 border border-neutral-700">
                    {verdict.speaker_rank}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
                  National Championship Adjudication Ruling
                </h2>
                <p className="text-xs text-neutral-400">
                  Motion: &ldquo;{topic}&rdquo;
                </p>
              </div>

              <button
                onClick={() => setShowVerdictModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Victory / Outcome Banner */}
            <div
              className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-6 ${
                verdict.outcome === "win"
                  ? "bg-gradient-to-r from-emerald-950/60 to-emerald-900/20 border-emerald-500/50"
                  : verdict.outcome === "close_split"
                  ? "bg-gradient-to-r from-amber-950/60 to-amber-900/20 border-amber-500/50"
                  : "bg-gradient-to-r from-rose-950/60 to-rose-900/20 border-rose-500/50"
              }`}
            >
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-amber-400 text-2xl shadow-inner shrink-0">
                  <Trophy className="w-7 h-7" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Match Decision
                  </span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                    {verdict.outcome === "win"
                      ? "Ballot Cast for Debater (Win)"
                      : verdict.outcome === "close_split"
                      ? "Split Judicial Decision"
                      : "Ballot Cast for Opposition"}
                  </span>
                </div>
              </div>

              {/* Head-to-Head Scoreboard */}
              <div className="flex items-center gap-4 bg-black/50 border border-white/10 px-6 py-3 rounded-xl shrink-0">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">You</span>
                  <span className="text-2xl font-black text-white">{verdict.user_score}</span>
                </div>
                <span className="text-neutral-500 font-bold text-sm">vs</span>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-rose-400 uppercase">Opponent</span>
                  <span className="text-2xl font-black text-white">{verdict.opponent_score}</span>
                </div>
              </div>
            </div>

            {/* Official RFD (Reason For Decision) */}
            <div className="flex flex-col gap-2 p-6 rounded-2xl bg-[#0e101b] border border-neutral-800">
              <span className="text-xs font-bold text-[#fcdbe8] uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[#fcdbe8]" />
                Reason For Decision (RFD)
              </span>
              <p className="text-sm text-neutral-200 leading-relaxed font-serif whitespace-pre-line pt-1">
                {verdict.rfd}
              </p>
            </div>

            {/* Clashes Breakdown Matrix */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Key Clash Adjudications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {verdict.clashes.map((c, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Clash {idx + 1}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          c.winner === "user"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : c.winner === "opponent"
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : "bg-amber-950 text-amber-300 border border-amber-800"
                        }`}
                      >
                        Winner: {c.winner}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{c.clash_name}</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{c.analysis}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Collegiate Skill Breakdown */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Tournament Skill Mastery
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { label: "Soundness", score: verdict.skill_breakdown.soundness },
                  { label: "Responsiveness", score: verdict.skill_breakdown.responsiveness },
                  { label: "Warrants", score: verdict.skill_breakdown.warrants },
                  { label: "Fallacy Discipline", score: verdict.skill_breakdown.fallacy_discipline },
                  { label: "Impact Calculus", score: verdict.skill_breakdown.impact_calculus },
                ].map((sk, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5 text-center">
                    <span className="text-[11px] text-neutral-400 font-semibold">{sk.label}</span>
                    <span className="text-2xl font-black text-white">{sk.score}%</span>
                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-[#fcdbe8] h-full rounded-full"
                        style={{ width: `${sk.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Highlights & Next Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-emerald-300 uppercase">Your Strongest Point</span>
                <p className="text-xs text-neutral-300 leading-snug">{verdict.strongest_user_point}</p>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-rose-300 uppercase">Opponent&apos;s Best Blow</span>
                <p className="text-xs text-neutral-300 leading-snug">{verdict.opponent_best_blow}</p>
              </div>
            </div>

            {/* Strategic Advice */}
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#fcdbe8]/10 text-[#fcdbe8] shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-[#fcdbe8] uppercase tracking-wider">
                  Adjudicator&apos;s Recommendation For Future Tournaments
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {verdict.key_coaching_advice}
                </p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between border-t border-neutral-800 pt-6 flex-wrap gap-4">
              <button
                onClick={copyBallotMarkdown}
                className="px-4 py-2.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                {copiedBallot ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedBallot ? "Copied Ballot to Clipboard!" : "Copy Official Ballot"}</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowVerdictModal(false);
                    resetBattle();
                  }}
                  className="px-5 py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Start New Match
                </button>

                <button
                  onClick={() => {
                    setShowVerdictModal(false);
                    setUserSide(userSide === "government" ? "opposition" : "government");
                    resetBattle();
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Rematch (Switch Sides)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
