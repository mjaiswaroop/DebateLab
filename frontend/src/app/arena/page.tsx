"use client";

import React, { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRecorder } from "@/hooks/useRecorder";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { RecordControl } from "@/components/RecordControl";
import { ScoreGuages } from "@/components/ScoreGuages";
import { PacingBadge } from "@/components/PacingBadge";
import { FillerChips } from "@/components/FillerChips";
import { FallacyCard } from "@/components/FallacyCard";
import { RebuttalPlayer } from "@/components/RebuttalPlayer";
import { TranscriptView } from "@/components/TranscriptView";
import { CoachingTips } from "@/components/CoachingTips";
import { SessionTrends } from "@/components/SessionTrends";
import { NewSessionModal } from "@/components/NewSessionModal";
import { AdjudicatorChat } from "@/components/AdjudicatorChat";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { TextDebateArena } from "@/components/TextDebateArena";
import { EndlessDebateArena } from "@/components/EndlessDebateArena";
import { RedoCompareCard } from "@/components/RedoCompareCard";
import { AnimatedText } from "@/components/AnimatedText";
import {
  createSession,
  evaluateAudioStateless,
  getSessionDetail,
  submitSessionTurn,
  getStoredApiKey,
  getGeminiConfigStatus,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import { SessionDetailResponse, TurnResponse } from "@/types/debate";
import {
  ShieldCheck,
  Scale,
  Sparkles,
  PlusCircle,
  Layers,
  ChevronRight,
  Info,
  Copy,
  Check,
  Mic,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Key,
  Trophy,
  Flame,
  Zap,
} from "lucide-react";

function ArenaContent() {
  const searchParams = useSearchParams();
  const [arenaMode, setArenaMode] = useState<"voice" | "text" | "chat">(() => {
    const param = searchParams.get("mode");
    if (param === "text" || param === "tournament") return "text";
    if (param === "voice") return "voice";
    return "chat"; // Default to friendly chat sparring mode
  });
  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [defaultTopic, setDefaultTopic] = useState<string>(
    "This House Would Ban Algorithmic Content Recommendation Feeds on Social Media Platforms"
  );
  const [defaultDifficulty, setDefaultDifficulty] = useState<"novice" | "intermediate" | "advanced">("intermediate");
  const [currentTurn, setCurrentTurn] = useState<TurnResponse | null>(null);
  const [selectedTurnNumber, setSelectedTurnNumber] = useState<number>(1);
  const [turnDetailsMap, setTurnDetailsMap] = useState<Record<number, TurnResponse>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [isKeyVerified, setIsKeyVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [redoParentTurnId, setRedoParentTurnId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const arenaDeckRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  // Recorder Hook with client-side measured pause detection
  const {
    status,
    setStatus,
    durationMs,
    audioBlob,
    error: recorderError,
    volumeLevel,
    pauses,
    analyserNode,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useRecorder();

  // Check API key configuration on mount
  const refreshConfigStatus = useCallback(() => {
    getGeminiConfigStatus()
      .then((s) => {
        // Trust the backend, not localStorage: it knows which keys Gemini has
        // actually rejected.
        setHasApiKey(s.gemini_configured);
        setIsKeyVerified(Boolean(s.gemini_verified));
        setActiveModel(s.active_model || s.model || "");
      })
      .catch(() => {
        // The badge is cosmetic - never break a debate turn over it.
      });
  }, []);

  useEffect(() => {
    refreshConfigStatus();
  }, [refreshConfigStatus]);

  // Create new session
  const handleStartSession = async (
    topic: string,
    difficulty: "novice" | "intermediate" | "advanced",
    thesis?: string
  ) => {
    try {
      setDefaultTopic(topic);
      setDefaultDifficulty(difficulty);
      const newSession = await createSession(topic, difficulty, thesis);
      setSession({
        ...newSession,
        turns: [],
        trend: [],
      });
      setCurrentTurn(null);
      setTurnDetailsMap({});
      setRedoParentTurnId(null);
      resetRecorder();
      setToast({ type: "success", message: `Tournament session initialized: "${topic.slice(0, 48)}..."` });
      arenaDeckRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err: unknown) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to initialize session" });
    }
  };

  // Submit audio recording for adjudication
  const handleSubmitRecording = async () => {
    if (!audioBlob) return;

    setIsSubmitting(true);
    setStatus("uploading");

    try {
      let activeSession = session;
      if (!activeSession) {
        const newSession = await createSession(defaultTopic, defaultDifficulty);
        activeSession = {
          ...newSession,
          turns: [],
          trend: [],
        };
        setSession(activeSession);
      }

      // Stateful multi-turn debate (passes motion, side, difficulty, and last 6 turns)
      const turnResult = await submitSessionTurn(
        activeSession.id,
        audioBlob,
        durationMs,
        pauses,
        redoParentTurnId || undefined
      );
      setCurrentTurn(turnResult);
      setSelectedTurnNumber(turnResult.turn_number);
      // The backend only marks a key "verified" after a live call succeeds,
      // so refresh the badge now that we know it works.
      refreshConfigStatus();
      setTurnDetailsMap((prev) => ({
        ...prev,
        [turnResult.turn_number]: turnResult,
      }));
      setRedoParentTurnId(null);

      // Refresh session details to update history and trend
      const updated = await getSessionDetail(activeSession.id);
      setSession(updated);
      setStatus("evaluated");
      setToast({
        type: "success",
        message:
          redoParentTurnId
            ? "Redo evaluation complete! Before / after delta computed below."
            : "Adjudication complete! Scroll below for breakdown and counter-rebuttal.",
      });
    } catch (err: unknown) {
      setStatus("stopped");
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Adjudication failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If query parameters change, sync mode
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "text" || mode === "tournament") {
      setArenaMode("text");
    } else if (mode === "voice") {
      setArenaMode("voice");
    } else if (mode === "chat" || mode === "endless") {
      setArenaMode("chat");
    }
  }, [searchParams]);

  const handleCopyCritique = () => {
    if (!currentTurn) return;
    const text = `# CrossEx Adjudication Report - Turn ${currentTurn.turn_number}
**Overall Score:** ${currentTurn.session_overall_score ?? "N/A"}/100
**Confidence:** ${currentTurn.delivery.confidence_score}/100 | **Argument Soundness:** ${currentTurn.logic.argument_score}/100 | **Hesitation:** ${currentTurn.delivery.hesitation_index}/100
**Pacing:** ${currentTurn.delivery.words_per_minute} WPM (${currentTurn.delivery.pacing})
**Filler Words:** ${currentTurn.delivery.filler_total}

## Transcript
${currentTurn.transcript}

## Opposing Rebuttal
"${currentTurn.rebuttal_text}"

## Socratic Question
"${currentTurn.socratic_question}"

## Coaching Tips
${currentTurn.coaching_tips.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const userTurnsCount = session
    ? session.turns.filter((t) => t.speaker === "user").length
    : currentTurn
    ? 1
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white font-sans selection:bg-black selection:text-pink-200">
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* 1. FLOATING LIQUID GLASS HEADER BAR                            */}
      {/* ============================================================== */}
      <header className="sticky top-3 z-40 px-3 sm:px-6 md:px-10 pointer-events-none mb-2">
        <div className="max-w-[1720px] mx-auto liquid-glass-dark rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-[0_12px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
          <div className="flex items-center gap-2.5 sm:gap-5">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all hover:scale-105"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-2 group cursor-pointer hidden md:flex"
            >
              <div className="w-6 h-6 rounded-full bg-black text-[#fcdbe8] font-black text-[11px] flex items-center justify-center border border-white/20">
                CX
              </div>
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white group-hover:text-[#fcdbe8] transition-colors">
                crossex.debatelab.com
              </span>
            </Link>

            {/* Arena Mode Switcher Glass Pill */}
            <div className="flex items-center p-0.5 rounded-full bg-black/60 border border-white/10 text-xs font-semibold backdrop-blur-md">
              <button
                onClick={() => setArenaMode("chat")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  arenaMode === "chat"
                    ? "bg-[#fcdbe8] text-black font-bold shadow-sm"
                    : "text-neutral-400 hover:text-[#fcdbe8]"
                }`}
                title="Continuous 1-round messaging debate. Stats generated when you end the conversation."
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Endless Text Spar</span>
              </button>
              <button
                onClick={() => setArenaMode("voice")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  arenaMode === "voice"
                    ? "bg-white/20 text-white font-bold shadow-sm border border-white/20"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Speech audio recording, pause detection & acoustic adjudication"
              >
                <Mic className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Speech Adjudicator</span>
                <span className="sm:hidden">Speech</span>
              </button>
              <button
                onClick={() => setArenaMode("text")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  arenaMode === "text"
                    ? "bg-white/20 text-white font-bold shadow-sm border border-white/20"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="3-round collegiate parliamentary tournament format"
              >
                <Scale className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline">3-Round Tournament</span>
                <span className="md:hidden">Tournament</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Gemini Key Status Button */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                hasApiKey
                  ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                  : "bg-white/5 border-white/10 hover:border-[#fcdbe8] text-neutral-300 hover:text-[#fcdbe8]"
              }`}
              title="Configure your Google Gemini API key"
            >
              <Key className="w-3.5 h-3.5 text-[#fcdbe8]" />
              <span className="hidden lg:inline">
                {hasApiKey
                  ? isKeyVerified
                    ? `${activeModel || "Gemini"}: Active`
                    : "Key set - not verified"
                  : "Connect Key"}
              </span>
            </button>

            {/* Practice Drills Link */}
            <Link
              href="/drills"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-rose-400 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-rose-300 text-xs font-semibold tracking-tight transition-all"
              title="Practice targeted conditioning sprints"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Drills</span>
            </Link>

            {/* Debater Portfolio Link */}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-[#fcdbe8] bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-[#fcdbe8] text-xs font-semibold tracking-tight transition-all"
              title="View Debater Portfolio & Skill Radar"
            >
              <Trophy className="w-3.5 h-3.5 text-[#fcdbe8]" />
              <span className="hidden sm:inline">Portfolio</span>
            </Link>

            {arenaMode === "voice" && (
              <>
                <button
                  onClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-[#fcdbe8] bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-[#fcdbe8] text-xs font-semibold tracking-tight transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">AI Sparring</span>
                </button>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold tracking-tight shadow-md transition-all hover:scale-105 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-black" />
                  <span>{session ? "New Motion" : "Start Debate"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Visible Demo Mode Banner if no API key is active */}
      {!hasApiKey && (
        <div className="bg-amber-950/60 border-b border-amber-500/30 px-4 sm:px-8 py-2.5">
          <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold uppercase tracking-wider text-[10px] border border-amber-500/30">
                Demo / Simulation Mode
              </span>
              <span>
                Operating with offline heuristic analysis engine. Connect your Google Gemini API key to activate live 2.5 Flash multimodal transcription &amp; adversarial refutation.
              </span>
            </div>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors cursor-pointer"
            >
              <Key className="w-3 h-3" />
              <span>Connect Key</span>
            </button>
          </div>
        </div>
      )}

      {arenaMode === "chat" ? (
        <main className="flex-1 flex flex-col">
          <EndlessDebateArena />
        </main>
      ) : arenaMode === "text" ? (
        <main className="flex-1 flex flex-col">
          <TextDebateArena />
        </main>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 2. BLUSH PINK HERO BANNER (#fcdbe8) — MATCHES THE HERO PAGE    */}
          {/* ============================================================== */}
          <section className="w-full bg-[#fcdbe8] text-black px-4 sm:px-8 md:px-12 py-10 sm:py-14 border-b border-black/10">
            <div className="max-w-[1720px] mx-auto flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-black/15 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-black/70">
                  Collegiate Parliamentary Adjudication Suite &bull; {activeModel || "Google Gemini"}
                </span>

            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                AI
              </span>
              <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                2.5
              </span>
              <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                SP
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-3xl">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[0.92] text-black uppercase">
                Speech
                <br />
                Delivery.
              </h1>

              <div className="pt-2">
                {session ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono font-bold tracking-wider text-black/60">
                        Active Parliamentary Motion:
                      </span>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-[11px] font-bold underline text-black/70 hover:text-black cursor-pointer"
                      >
                        [Change Motion]
                      </button>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-black leading-snug">
                      &ldquo;{session.topic}&rdquo;
                    </p>
                    {session.initial_thesis && (
                      <p className="text-xs text-black/75 italic mt-0.5">
                        Proposition Thesis: &ldquo;{session.initial_thesis}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono font-bold tracking-wider text-black/60">
                        Active Parliamentary Motion:
                      </span>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-[11px] font-bold underline text-black/70 hover:text-black cursor-pointer"
                      >
                        [Select Different Motion]
                      </button>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-black leading-snug">
                      &ldquo;{defaultTopic}&rdquo;
                    </p>
                    <p className="text-xs text-black/75 italic mt-0.5">
                      <AnimatedText
                        text="Multimodal acoustic delivery & premise validity evaluated under collegiate standards."
                        delayMs={250}
                        staggerMs={35}
                      />
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Meta Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              {session?.overall_score !== null && session?.overall_score !== undefined && (
                <div className="px-4 py-2 rounded-full bg-black text-[#fcdbe8] font-bold text-xs flex items-center gap-1.5 shadow-sm">
                  <span>Circuit Rating:</span>
                  <span className="font-mono text-white text-sm">
                    {Number(session.overall_score).toFixed(1)}
                  </span>
                  <span className="text-black/50 text-[10px]">/ 100</span>
                </div>
              )}

              <span className="px-4 py-2 rounded-full border border-black/40 bg-white/50 text-black text-xs font-bold uppercase tracking-wider">
                {session ? `${session.difficulty} tier` : `${defaultDifficulty} tier`}
              </span>

              <button
                onClick={() => arenaDeckRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="px-5 py-2 rounded-full bg-black text-[#fcdbe8] hover:bg-neutral-900 text-xs font-bold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Record Speech</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. TICKER STRIP                                                */}
      {/* ============================================================== */}
      <div className="w-full bg-white text-black py-3 px-4 sm:px-8 border-b border-black/10 overflow-hidden">
        <div className="max-w-[1720px] mx-auto flex items-center justify-center text-center text-xs font-semibold tracking-tight text-neutral-800 flex-wrap gap-x-4 gap-y-1">
          <span>Acoustic Confidence.</span>
          <span>Hesitation Index.</span>
          <span>Pacing &amp; WPM.</span>
          <span>Verbatim Fallacies.</span>
          <span>Socratic Rebuttals.</span>
          <span>Circuit Scores.</span>
          <span className="text-neutral-500 font-bold">Interactive AI Sparring below.</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. WORKSPACE DECK CONTAINER                                    */}
      {/* ============================================================== */}
      <main
        ref={arenaDeckRef}
        className="max-w-[1720px] mx-auto px-3 sm:px-6 md:px-10 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 w-full flex-1"
      >
        {/* Notification Toast */}
        {notification && (
          <div className="flex items-center gap-2 p-3.5 rounded-full bg-neutral-900 border border-[#fcdbe8]/40 text-[#fcdbe8] text-xs font-semibold animate-in slide-in-from-top-2">
            <Sparkles className="w-4 h-4 text-[#fcdbe8]" />
            <span>{notification}</span>
          </div>
        )}

        {/* Multi-Round Switcher Tabs */}
        {userTurnsCount > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 mr-1 shrink-0">
              Debate Rounds:
            </span>
            {Array.from({ length: userTurnsCount }, (_, i) => i + 1).map((roundNum) => {
              const label =
                roundNum === 1
                  ? "Round 1: Constructive"
                  : roundNum === 2
                  ? "Round 2: Rebuttal"
                  : roundNum === 3
                  ? "Round 3: Whip Summary"
                  : `Round ${roundNum}`;

              return (
                <button
                  key={roundNum}
                  onClick={() => {
                    setSelectedTurnNumber(roundNum);
                    if (turnDetailsMap[roundNum]) {
                      setCurrentTurn(turnDetailsMap[roundNum]);
                    } else if (session) {
                      const userTurn = session.turns.find(
                        (t) => t.turn_number === roundNum && t.speaker === "user"
                      );
                      const asstTurn = session.turns.find(
                        (t) => t.turn_number === roundNum && t.speaker === "assistant"
                      );
                      if (userTurn) {
                        setCurrentTurn({
                          turn_number: roundNum,
                          speech_detected: true,
                          transcript: userTurn.user_transcript || "",
                          delivery: {
                            confidence_score: userTurn.confidence_score ?? 0,
                            hesitation_index: userTurn.hesitation_index ?? 0,
                            filler_words: userTurn.filler_words_detected ?? [],
                            filler_total: (userTurn.filler_words_detected ?? []).reduce(
                              (acc: number, f: { count: number }) => acc + (f.count || 0),
                              0
                            ),
                            words_per_minute: Number(userTurn.words_per_minute ?? 0),
                            pacing: "good",
                            vocal_observations: [],
                          },
                          logic: {
                            argument_score: userTurn.argument_score ?? 0,
                            claim_summary: "",
                            premises: [],
                            fallacies: userTurn.fallacies_flagged ?? [],
                            strongest_point: "",
                            weakest_point: "",
                            unaddressed_counterarguments: [],
                          },
                          rebuttal_text: asstTurn?.rebuttal_text || "",
                          socratic_question: "",
                          coaching_tips: [],
                          session_overall_score: Number(session.overall_score),
                        });
                      }
                    }
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer shrink-0 ${
                    selectedTurnNumber === roundNum
                      ? "bg-[#fcdbe8] text-black shadow-md"
                      : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Recording Deck & Delivery Metrics */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Audio Recording Card */}
            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-neutral-800 flex flex-col gap-5 shadow-xl">
              <div className="flex flex-col gap-2 border-b border-neutral-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-300">
                      Speech Delivery Deck
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="px-2.5 py-0.5 rounded-full bg-neutral-900 hover:bg-[#fcdbe8] hover:text-black border border-neutral-700 text-[10px] font-semibold text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Change debate topic / motion"
                    >
                      <Sparkles className="w-3 h-3 text-[#fcdbe8] group-hover:text-black" />
                      <span>Change Topic</span>
                    </button>
                  </div>
                  <span className="text-xs font-mono text-[#fcdbe8] font-bold">
                    Round {selectedTurnNumber || 1}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-neutral-400 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80">
                  <span className="font-semibold text-neutral-400 shrink-0 text-[10px] uppercase tracking-wider">Motion:</span>
                  <span className="line-clamp-2 text-neutral-200 font-medium italic">
                    &ldquo;{session?.topic || defaultTopic}&rdquo;
                  </span>
                </div>
              </div>

              {/* Live Audio Visualizer with Blush Pink Waveform */}
              <AudioVisualizer
                analyserNode={analyserNode}
                isRecording={status === "recording"}
                volumeLevel={volumeLevel}
              />

              {/* Record & Submit Controls */}
              <RecordControl
                status={status}
                durationMs={durationMs}
                error={recorderError}
                audioBlob={audioBlob}
                onStart={startRecording}
                onStop={stopRecording}
                onSubmit={handleSubmitRecording}
                onReset={resetRecorder}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Real-time Delivery Gauges & Diagnostics */}
            {currentTurn && (
              <>
                <ScoreGuages
                  confidence={currentTurn.delivery.confidence_score}
                  soundness={currentTurn.logic.argument_score}
                  hesitation={currentTurn.delivery.hesitation_index}
                  overallScore={currentTurn.session_overall_score}
                />

                <PacingBadge
                  wpm={currentTurn.delivery.words_per_minute}
                  pacing={currentTurn.delivery.pacing}
                  format={session?.format || "parliamentary"}
                  targetWpmMin={session?.target_wpm_min || 140}
                  targetWpmMax={session?.target_wpm_max || 180}
                />

                <FillerChips
                  fillers={currentTurn.delivery.filler_words}
                  fillerTotal={currentTurn.delivery.filler_total}
                />

                {currentTurn.coaching_tips.length > 0 && (
                  <CoachingTips
                    tips={currentTurn.coaching_tips}
                    vocalObservations={currentTurn.delivery.vocal_observations}
                  />
                )}

                {/* Targeted Practice Drill Callout - Direct Coaching Loop */}
                {(() => {
                  const fallacies = currentTurn.logic?.fallacies || [];
                  const fillerTotal = currentTurn.delivery?.filler_total ?? 0;
                  const hesitation = currentTurn.delivery?.hesitation_index ?? 0;
                  const wpm = currentTurn.delivery?.words_per_minute ?? 150;
                  const motionTopic = session?.topic || defaultTopic;

                  let drillTitle = "60-Second Impact Weighing Matrix";
                  let triggerReason = "Sharpen comparative magnitude & timeframe impacts";
                  let drillParam = "impact_sprint";
                  let quoteQuery = "";
                  let weaknessQuery = "";

                  if (fallacies.length > 0) {
                    drillTitle = "Fallacy Repair Sprint";
                    triggerReason = `Flagged: ${fallacies[0].type.replace(/_/g, " ")}`;
                    drillParam = "fallacy_repair";
                    quoteQuery = `&quote=${encodeURIComponent(fallacies[0].quote)}`;
                    weaknessQuery = `&weakness=${encodeURIComponent(fallacies[0].type)}`;
                  } else if (fillerTotal >= 3 || hesitation > 15) {
                    drillTitle = "Filler-Free 60 Constructive";
                    triggerReason = `${fillerTotal} vocal hesitation crutches detected`;
                    drillParam = "filler_reduction";
                  } else if (wpm < 130 || wpm > 190) {
                    drillTitle = "Cadence & Pacing Conditioning";
                    triggerReason = `Pacing outlier: ${wpm.toFixed(1)} WPM`;
                    drillParam = "impact_sprint";
                  }

                  const drillUrl = `/drills?drill=${drillParam}${quoteQuery}${weaknessQuery}&topic=${encodeURIComponent(motionTopic)}`;

                  return (
                    <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col gap-3.5 font-sans shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Targeted Practice Drill
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold">
                          60s Conditioning
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {drillTitle}
                        </h4>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          Triggered by your speech: <strong className="text-rose-300">{triggerReason}</strong>.
                          Condition this specific flaw before your next tournament round.
                        </p>
                      </div>

                      <Link
                        href={drillUrl}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold transition-all shadow-md hover:scale-[1.01]"
                      >
                        <Zap className="w-3.5 h-3.5 text-black" />
                        <span>Launch Targeted Drill &rarr;</span>
                      </Link>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Right Column: Logic, Fallacies, Transcript & Rebuttal */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {currentTurn ? (
              <>
                {/* Redo & Compare Hero Card */}
                <RedoCompareCard
                  currentTurn={currentTurn}
                  redoDelta={currentTurn.redo_delta}
                  isRedoActive={Boolean(redoParentTurnId)}
                  onStartRedo={() => {
                    const userTurn = session?.turns.find(
                      (t) => t.turn_number === selectedTurnNumber && t.speaker === "user"
                    );
                    setRedoParentTurnId(userTurn?.id || "turn-" + selectedTurnNumber);
                    resetRecorder();
                    arenaDeckRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  onCancelRedo={() => setRedoParentTurnId(null)}
                />

                {/* Assistant Rebuttal & Socratic Question with Web Speech TTS */}
                {currentTurn.rebuttal_text && (
                  <RebuttalPlayer
                    rebuttalText={currentTurn.rebuttal_text}
                    socraticQuestion={currentTurn.socratic_question}
                  />
                )}

                {/* Flagged Logical Fallacies with Verified Count */}
                <FallacyCard
                  fallacies={currentTurn.logic.fallacies}
                  verifiedCount={currentTurn.verified_fallacy_count}
                  totalCount={currentTurn.total_fallacy_count}
                />

                {/* Speech Transcript with Verbatim Fallacy Quote Highlights, Measured Pauses & Logic Breakdown */}
                <TranscriptView
                  transcript={currentTurn.transcript}
                  logic={currentTurn.logic}
                  delivery={currentTurn.delivery}
                  pauses={currentTurn.pauses_detected || pauses}
                  durationMs={durationMs || 60000}
                  verifiedCount={currentTurn.verified_fallacy_count}
                  totalCount={currentTurn.total_fallacy_count}
                />

                {/* Copy / Export Critique Button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleCopyCritique}
                    className="flex items-center gap-2 px-5 py-2 rounded-full border border-neutral-700 hover:border-neutral-500 bg-neutral-900 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#fcdbe8]" />
                        <span>Adjudication Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Export Adjudication Report</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Multi-round Trajectory Chart */}
                {session && session.trend.length > 0 && (
                  <SessionTrends trend={session.trend} />
                )}
              </>
            ) : (
              /* Editorial Standby State */
              <div className="p-8 sm:p-14 rounded-3xl bg-[#0a0a0a] border border-neutral-800 flex flex-col items-center justify-center text-center gap-6 min-h-[480px]">
                <div className="w-16 h-16 rounded-full bg-black border border-[#fcdbe8] flex items-center justify-center text-[#fcdbe8] shadow-lg">
                  <Layers className="w-8 h-8" />
                </div>
                <div className="max-w-md flex flex-col gap-2">
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
                    Awaiting
                    <br />
                    <span className="text-[#fcdbe8]">Delivery.</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pt-1">
                    Deliver your address directly into the microphone. CrossEx evaluates vocal confidence, pacing (WPM), speech hesitations, and logical fallacies under varsity collegiate adjudication standards.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold tracking-tight shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <Mic className="w-4 h-4 text-black" />
                    <span>Start Recording Speech</span>
                    <ChevronRight className="w-4 h-4 text-black" />
                  </button>
                  <button
                    onClick={() => setArenaMode("text")}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-full border border-neutral-700 hover:border-neutral-500 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#fcdbe8]" />
                    <span>Switch to Parliamentary Arena</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 5. INTERACTIVE ADJUDICATOR SPARRING CHATBOT AT THE END         */}
        {/* ============================================================== */}
        <div ref={chatRef} className="pt-6">
          <AdjudicatorChat
            topic={session?.topic || defaultTopic}
            thesis={session?.initial_thesis ?? undefined}
            currentTranscript={currentTurn?.transcript ?? undefined}
            fallacies={currentTurn?.logic.fallacies}
            rebuttalText={currentTurn?.rebuttal_text ?? undefined}
          />
        </div>
      </main>
      </>
      )}

      {/* ============================================================== */}
      {/* 6. EDITORIAL FOOTER                                            */}
      {/* ============================================================== */}
      <footer className="w-full bg-[#030303] text-neutral-500 border-t border-neutral-900 px-4 sm:px-8 md:px-12 py-10">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-white tracking-wider uppercase">
              CrossEx DebateLab
            </span>
            <p className="text-xs text-neutral-500">
              Multimodal Parliamentary Speech Adjudication &amp; Logic Sparring Engine
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/" className="hover:text-white transition-colors">
              Hero Overview
            </Link>
            <span className="text-neutral-800">|</span>
            <button
              onClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="hover:text-[#fcdbe8] transition-colors cursor-pointer"
            >
              Sparring Chamber
            </button>
            <span className="text-neutral-800">|</span>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="hover:text-white text-neutral-400 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Key className="w-3 h-3 text-[#fcdbe8]" />
              <span>
                {hasApiKey
                  ? isKeyVerified
                    ? `${activeModel || "Gemini"} Active`
                    : "Key set - not verified"
                  : "Setup Gemini Key"}
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* New Debate Session Setup Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleStartSession}
      />

      {/* Api Key Setup Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={(active, verified) => {
          setHasApiKey(active);
          setIsKeyVerified(Boolean(verified));
        }}
      />
    </div>
  );
}

export default function ArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center text-neutral-400 text-sm font-sans">
          Loading Debate Arena...
        </div>
      }
    >
      <ArenaContent />
    </Suspense>
  );
}
