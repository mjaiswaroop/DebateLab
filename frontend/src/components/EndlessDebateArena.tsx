"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Send,
  Trophy,
  RotateCcw,
  Sparkles,
  Zap,
  Flame,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  Dices,
  Info,
  Mic,
  MicOff,
  Clock,
  FileText,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  ShieldAlert,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Key,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  submitTextDebateTurn,
  getDebateVerdict,
  createSession,
  submitSessionTurn,
  getStoredApiKey,
} from "@/lib/api";
import {
  TextDebateTurnResponse,
  DebateVerdictResponse,
  Fallacy,
  DeliveryAnalysis,
  RedoDelta,
} from "@/types/debate";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { AnimatedText } from "@/components/AnimatedText";

interface ChatMessage {
  id: string;
  speaker: "user" | "opponent";
  text: string;
  poi?: string;
  score?: number | null;
  fallacies?: Fallacy[];
  verified_fallacy_count?: number;
  total_fallacy_count?: number;
  attempt_number?: number;
  parent_turn_id?: string;
  redo_delta?: RedoDelta | null;
  coaching_tip?: string;
  timestamp: string;
  is_demo?: boolean;
  demo_reason?: string | null;
  premises?: string[];
}

function formatMotionDisplay(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const BEGINNER_TOPICS = [
  {
    category: "Sports, Culture & Values",
    motions: [
      {
        topic: "virat kholi is the goat in cricket",
        side: "government" as const,
        description: "Debate cricket records, era differences, consistency, and clutch chases.",
      },
      {
        topic: "Social Media Does More Harm Than Good to Teenagers",
        side: "government" as const,
        description: "Argue whether social networks damage mental health or provide vital community.",
      },
      {
        topic: "Remote Working Is Superior to Traditional 9-to-5 Office Work",
        side: "government" as const,
        description: "Debate work-life flexibility against collaborative in-person team culture.",
      },
      {
        topic: "College Degrees Are No Longer Worth the Financial Debt",
        side: "government" as const,
        description: "Debate university tuition inflation against career earnings and trade alternatives.",
      },
    ],
  },
  {
    category: "Technology & Artificial Intelligence",
    motions: [
      {
        topic: "Artificial Intelligence Poses an Existential Threat to Free Elections",
        side: "government" as const,
        description: "Address generative deepfakes, micro-targeted voter manipulation, and media trust.",
      },
      {
        topic: "Social Media Platforms Must Ban Algorithmic Recommendation Feeds",
        side: "government" as const,
        description: "Debate chronological feeds versus algorithmic engagement optimization.",
      },
      {
        topic: "AI Developers Must Bear Strict Legal Liability for Autonomous Actions",
        side: "government" as const,
        description: "Examine who carries legal liability when autonomous AI algorithms cause damage.",
      },
    ],
  },
  {
    category: "Society & Governance",
    motions: [
      {
        topic: "Governments Should Implement a Universal Basic Income",
        side: "government" as const,
        description: "Debate post-automation safety nets, inflation, and incentives to work.",
      },
      {
        topic: "Democratic Nations Should Make Voting Mandatory for All Eligible Citizens",
        side: "government" as const,
        description: "Compare compulsory civic participation against individual liberty.",
      },
      {
        topic: "Commercial Targeted Political Advertising on the Internet Should Be Banned",
        side: "government" as const,
        description: "Analyze dark-money advertising, voter micro-profiling, and electoral transparency.",
      },
    ],
  },
];

export const EndlessDebateArena: React.FC = () => {
  // Topic & Setup State
  const [topic, setTopic] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  const [userSide, setUserSide] = useState<"government" | "opposition">("government");
  const [difficulty, setDifficulty] = useState<"novice" | "intermediate" | "advanced">("intermediate");
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(true);
  const [showBeginnerGuide, setShowBeginnerGuide] = useState<boolean>(false);

  // Key Status & First-Run Banner
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [exchangeCount, setExchangeCount] = useState<number>(0);
  const [hasDemoActive, setHasDemoActive] = useState<boolean>(false);
  const [activeDemoReason, setActiveDemoReason] = useState<string>("");

  // Robustness: Failed Turn Draft Preservation
  const [failedTurn, setFailedTurn] = useState<{ text: string; error: string } | null>(null);

  // Opponent Display Animation State (Typewriter visual animation - not server-side streaming)
  const [displayAnimMsgId, setDisplayAnimMsgId] = useState<string | null>(null);
  const [displayAnimLength, setDisplayAnimLength] = useState<number>(0);

  // Redo Speech State
  const [redoTurn, setRedoTurn] = useState<{ id: string; text: string; coaching_tip?: string; round: number } | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Spoken Turns: MediaRecorder -> Stateful /api/sessions/{session_id}/turn Evaluation
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);
  const [deliveryMetrics, setDeliveryMetrics] = useState<DeliveryAnalysis | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Input bar enhancements: Timer, Right Rail
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState<boolean>(true);
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  // Verdict & End-of-Debate State
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<DebateVerdictResponse | null>(null);
  const [isVerdictOpen, setIsVerdictOpen] = useState<boolean>(false);
  const [copiedVerdict, setCopiedVerdict] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const STORAGE_SESSION_KEY = "cross_ex_endless_session";

  // Check stored API key on mount
  useEffect(() => {
    const key = getStoredApiKey();
    setHasApiKey(Boolean(key));
  }, []);

  // Restore active in-progress debate session across page refresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.topic && Array.isArray(data.messages) && data.messages.length > 0) {
          setTopic(data.topic);
          setCustomInput(data.customInput || data.topic);
          setUserSide(data.userSide || "government");
          setDifficulty(data.difficulty || "intermediate");
          setMessages(data.messages);
          setExchangeCount(data.exchangeCount || 0);
          setSecondsElapsed(data.secondsElapsed || 0);
          setHasDemoActive(data.hasDemoActive || false);
          setActiveDemoReason(data.activeDemoReason || "");
          setIsSetupOpen(false);
          setIsTimerRunning(true);
        }
      }
    } catch {
      // Ignore corrupted localStorage data
    }
  }, []);

  // Persist active in-progress debate session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSetupOpen && topic && messages.length > 0) {
      try {
        localStorage.setItem(
          STORAGE_SESSION_KEY,
          JSON.stringify({
            topic,
            customInput,
            userSide,
            difficulty,
            messages,
            exchangeCount,
            secondsElapsed,
            hasDemoActive,
            activeDemoReason,
          })
        );
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [
    topic,
    customInput,
    userSide,
    difficulty,
    messages,
    exchangeCount,
    secondsElapsed,
    isSetupOpen,
    hasDemoActive,
    activeDemoReason,
  ]);

  // Turn Timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, displayAnimLength]);

  // Opponent Display Animation (Typewriter visual presentation - skippable on click or keypress)
  useEffect(() => {
    if (!displayAnimMsgId) return;

    // Check prefers-reduced-motion: if enabled, immediately skip display animation
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayAnimMsgId(null);
      return;
    }

    const oppMsg = messages.find((m) => m.id === displayAnimMsgId);
    if (!oppMsg || displayAnimLength >= oppMsg.text.length) {
      setDisplayAnimMsgId(null);
      return;
    }

    // Skip display animation on any keypress
    const handleKeyDown = () => {
      setDisplayAnimMsgId(null);
    };
    window.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      setDisplayAnimLength((prev) => Math.min(oppMsg.text.length, prev + 4));
    }, 18);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [displayAnimMsgId, displayAnimLength, messages]);

  // MediaRecorder Voice Input -> Stateful debate turn endpoint (grounded with motion, side, difficulty, and last 6 turns)
  const startRecording = async () => {
    setAudioError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setAudioError("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const durationMs = Math.max(1000, Date.now() - recordingStartTimeRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Release mic track immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        setIsProcessingAudio(true);
        try {
          // Ensure debate session exists with motion, side, difficulty
          let activeSid = activeSessionIdRef.current;
          if (!activeSid) {
            const newSess = await createSession(
              topic || "General Parliamentary Debate",
              difficulty as "novice" | "intermediate" | "advanced",
              undefined,
              "parliamentary",
              140,
              180,
              userSide
            );
            activeSid = newSess.id;
            activeSessionIdRef.current = newSess.id;
          }


          // Route through the debate turn endpoint with audio attached
          const evalRes = await submitSessionTurn(
            activeSid,
            audioBlob,
            durationMs
          );

          if (evalRes.transcript && evalRes.transcript.trim()) {
            setUserInput((prev) =>
              prev ? `${prev.trim()} ${evalRes.transcript.trim()}` : evalRes.transcript.trim()
            );
          }
          if (evalRes.delivery) {
            setDeliveryMetrics(evalRes.delivery);
          }
        } catch (err: unknown) {
          setAudioError(
            err instanceof Error ? err.message : "Voice evaluation endpoint failed."
          );
        } finally {
          setIsProcessingAudio(false);
        }
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      setAudioError("Microphone access denied. Please allow microphone permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle Pick Random Motion
  const handleRandomTopic = () => {
    const all = BEGINNER_TOPICS.flatMap((c) => c.motions);
    const chosen = all[Math.floor(Math.random() * all.length)];
    setTopic(chosen.topic);
    setCustomInput(chosen.topic);
    setUserSide(chosen.side);
  };

  // Start Debate Session
  const handleStartDebate = (selectedTopic?: string) => {
    const finalTopic = (selectedTopic || customInput || topic).trim();
    if (!finalTopic) return;
    setTopic(finalTopic);
    setIsSetupOpen(false);
    setFailedTurn(null);

    const oppRoleName = userSide === "government" ? "Opposition" : "Government";
    const formattedTopic = formatMotionDisplay(finalTopic);

    setMessages([
      {
        id: "intro-msg",
        speaker: "opponent",
        text: `I'll take the ${oppRoleName} on: "${formattedTopic}". You represent the ${
          userSide === "government" ? "Government / Affirmative" : "Opposition / Negative"
        }. Deliver your opening argument to begin the sparring round.`,
        poi: `What is your primary evidentiary standard for asserting this on "${formattedTopic}"?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setExchangeCount(0);
    setVerdict(null);
    setSecondsElapsed(0);
    setIsTimerRunning(true);
  };

  // Reset or Change Topic
  const handleResetSession = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
    setIsSetupOpen(true);
    setMessages([]);
    setExchangeCount(0);
    setVerdict(null);
    setFailedTurn(null);
    setIsTimerRunning(false);
  };

  // Send message (or retry turn)
  const handleSendMessage = async (retryText?: string) => {
    const text = (retryText || userInput).trim();
    if (!text || isSubmitting) return;

    if (isRecording) {
      stopRecording();
    }

    setFailedTurn(null);
    const newExchange = exchangeCount + 1;
    setExchangeCount(newExchange);
    // Clear user input now that submission starts, but retain text in variable
    setUserInput("");
    setSecondsElapsed(0);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;

    // Filter prior turns before adding the current message
    const priorHistory = messages
      .filter((m) => m.id !== "intro-msg")
      .map((m) => ({
        speaker: m.speaker === "user" ? userSide : userSide === "government" ? "opposition" : "government",
        text: m.text,
      }));

    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        speaker: "user",
        text,
        timestamp: now,
      },
    ];
    setMessages(newMessages);
    setIsSubmitting(true);

    try {
      const response: TextDebateTurnResponse = await submitTextDebateTurn({
        topic,
        difficulty,
        user_side: userSide,
        round_number: newExchange,
        user_text: text,
        history: priorHistory,
      });

      if (response.is_demo) {
        setHasDemoActive(true);
        setActiveDemoReason(response.demo_reason || "Heuristic demo mode");
      }

      // Update user message with score & diagnostics
      let computedDelta: RedoDelta | null = null;
      if (redoTurn) {
        const prevMsg = messages.find((m) => m.id === redoTurn.id);
        const prevScore = prevMsg?.score ?? null;
        const newScore = response.user_argument_score ?? null;
        const prevFallacies = prevMsg?.fallacies || [];
        const normNewText = text.toLowerCase();
        const fixed = prevFallacies.filter(
          (f) => !normNewText.includes(f.quote.toLowerCase())
        );

        computedDelta = {
          parent_turn_id: redoTurn.id,
          attempt_number: 2,
          is_demo: response.is_demo,
          delta_available: !response.is_demo && newScore !== null && prevScore !== null,
          soundness_before: prevScore,
          soundness_after: newScore,
          soundness_delta: newScore !== null && prevScore !== null ? newScore - prevScore : null,
          warrants_added: Math.max(0, response.user_premises.length - (prevMsg?.premises?.length || 1)),
          fallacies_fixed: fixed.map((f) => ({
            type: f.type,
            quote: f.quote,
            explanation: f.explanation,
          })),
          fallacies_fixed_count: fixed.length,
        };
        setRedoTurn(null);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId
            ? {
                ...m,
                score: response.user_argument_score,
                fallacies: response.fallacies_flagged,
                verified_fallacy_count: response.verified_fallacy_count,
                total_fallacy_count: response.total_fallacy_count,
                coaching_tip: response.coaching_tip,
                premises: response.user_premises,
                attempt_number: computedDelta ? 2 : 1,
                redo_delta: computedDelta,
              }
            : m
        )
      );

      // Append opponent response
      const oppMsgId = `opp-${Date.now()}`;
      const opponentMsg: ChatMessage = {
        id: oppMsgId,
        speaker: "opponent",
        text: response.opponent_speech,
        poi: response.opponent_poi,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        is_demo: response.is_demo,
        demo_reason: response.demo_reason,
      };

      setMessages((prev) => [...prev, opponentMsg]);
      setDisplayAnimMsgId(oppMsgId);
      setDisplayAnimLength(0);
    } catch (err: unknown) {
      // Robustness: Preserves user draft and sets up Retry button
      setUserInput(text);
      setFailedTurn({
        text,
        error: err instanceof Error ? err.message : "Failed to generate opponent response.",
      });

      // Show the REAL reason instead of a canned rebuttal that looks like an
      // answer. A generic template here made a broken Gemini connection look
      // like the adjudicator giving a (nonsensical) reply.
      const reason =
        err instanceof Error ? err.message : "Failed to generate opponent response.";
      const fallbackOpponentMsg: ChatMessage = {
        id: `opp-fallback-${Date.now()}`,
        speaker: "opponent",
        text: `⚠️ Live adjudication failed: ${reason}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        is_demo: true,
        demo_reason: reason,
      };
      setMessages((prev) => [...prev, fallbackOpponentMsg]);
    } finally {
      setIsSubmitting(false);
      setIsTimerRunning(true);
    }
  };

  // Conclude Debate & Tally Verdict Stats
  const handleEndDebate = async () => {
    if (messages.length < 2) {
      setIsSetupOpen(true);
      return;
    }

    setIsEnding(true);
    const historyPayload = messages
      .filter((m) => m.id !== "intro-msg")
      .map((m) => ({
        speaker: m.speaker === "user" ? userSide : userSide === "government" ? "opposition" : "government",
        text: m.text,
      }));

    try {
      const result = await getDebateVerdict({
        topic,
        difficulty,
        user_side: userSide,
        history: historyPayload,
      });
      setVerdict(result);
      setIsVerdictOpen(true);
    } catch {
      const userExchanges = messages.filter((m) => m.speaker === "user");
      const fallbackVerdict: DebateVerdictResponse = {
        outcome: "close_split",
        user_score: 75.0,
        opponent_score: 74.0,
        speaker_rank: "Varsity Debater",
        rfd: `Official Chief Adjudicator Decision on "${topic}":\n\nAcross ${exchangeCount} exchanges, the debaters contested core definitions and comparative standards on "${topic}". In this simulated ballot evaluation, the decision reflects responsiveness to opponent cross-examination and comparative framing.`,
        clashes: [
          {
            clash_name: "Comparative Standards & Definition of Terms",
            winner: "user",
            analysis: `You defended your criteria on "${topic.slice(0, 40)}", maintaining consistent comparative framing.`,
          },
          {
            clash_name: "Evidentiary Substantiation & Rebuttal Depth",
            winner: "draw",
            analysis: "Both sides exchanged claims that required deeper warrants and empirical proof.",
          },
        ],
        skill_breakdown: {
          soundness: 74,
          responsiveness: 76,
          warrants: 72,
          fallacy_discipline: 82,
          impact_calculus: 75,
        },
        strongest_user_point:
          userExchanges[userExchanges.length - 1]?.text.slice(0, 100) + "..." ||
          `Core argument addressing "${topic.slice(0, 40)}".`,
        opponent_best_blow: "Opponent challenge demanding comparative metrics rather than standalone assertions.",
        key_coaching_advice:
          "Always substantiate claims with comparative benchmarks and explicit warrants.",
        is_demo: true,
        demo_reason: "Offline fallback mode",
      };
      setVerdict(fallbackVerdict);
      setIsVerdictOpen(true);
    } finally {
      setIsEnding(false);
    }
  };

  // Get latest user diagnostics for the logic scorecard
  const latestUserMessage = [...messages].reverse().find((m) => m.speaker === "user");
  const latestScore = latestUserMessage?.score;
  const latestPremises = latestUserMessage?.premises || [];
  const latestFallacies = latestUserMessage?.fallacies || [];
  const wordCount = userInput.trim() ? userInput.trim().split(/\s+/).length : 0;
  const formattedMinutes = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
  const formattedSeconds = String(secondsElapsed % 60).padStart(2, "0");

  // =========================================================================
  // =========================================================================
  // RENDER: SETUP MODAL / SCREEN
  // =========================================================================
  if (isSetupOpen) {
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
                <MessageSquare className="w-4 h-4 text-black" />
                <span>Endless Text Spar &bull; Adversarial Cross-Examination</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  AI
                </span>
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  2.5
                </span>
                <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] flex items-center justify-center text-[10px] font-bold">
                  SPAR
                </span>
              </div>
            </div>

            {/* Headline and Intro */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-2">
              <div className="flex flex-col gap-3 max-w-3xl">
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[0.94] text-black uppercase animate-fade-in-up">
                  Continuous Sparring.
                  <br />
                  Adjudicator Clash.
                </h1>
                <p className="text-sm sm:text-base font-medium text-black/80 max-w-2xl leading-relaxed pt-1">
                  <AnimatedText
                    text="Engage in unlimited turns of adversarial cross-examination. Gemini immediately refutes your warrants, tests your logic with Points of Information (POIs), and flags verbatim fallacies in real time."
                    delayMs={250}
                    staggerMs={22}
                  />
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-black/30 hover:border-black bg-white/60 hover:bg-white text-xs font-bold text-black tracking-tight transition-all duration-300 shadow-sm hover:scale-105 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-black" />
                  <span>{hasApiKey ? "API Key Configured" : "Connect Gemini Key"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBeginnerGuide(!showBeginnerGuide)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/30 hover:border-black bg-white/60 hover:bg-white text-xs font-bold text-black tracking-tight transition-all duration-300 shadow-sm hover:scale-105 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-black" />
                  <span>{showBeginnerGuide ? "Close Guide" : "Debate Guide"}</span>
                  {showBeginnerGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Collapsible Debate Guide Card */}
            {showBeginnerGuide && (
              <div className="mt-4 p-5 sm:p-6 rounded-2xl bg-black text-white border border-neutral-800 shadow-xl flex flex-col gap-4 text-xs leading-relaxed animate-fade-in-up">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h4 className="font-bold text-sm text-[#fcdbe8] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#fcdbe8]" />
                    <span>How Endless Sparring Works</span>
                  </h4>
                  <span className="text-[10px] font-mono text-neutral-400">Dynamic Adversarial Sparring</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-emerald-300 uppercase font-mono text-[10px] tracking-wider">
                      1. Open Any Motion
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      Choose sports, politics, economics, technology, or ethics. Type any proposition or pick from curated motions.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-cyan-300 uppercase font-mono text-[10px] tracking-wider">
                      2. Socratic Refutations &amp; POIs
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      Each turn, the AI adjudicator responds in character, questions your warrants, and serves a high-stakes Point of Information.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                    <span className="font-bold text-[#fcdbe8] uppercase font-mono text-[10px] tracking-wider">
                      3. Instant RFD &amp; Ballots
                    </span>
                    <p className="text-neutral-300 text-[11px] leading-snug">
                      When you conclude sparring, generate an official Reason For Decision (RFD) with clash analysis and score breakdown.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 2: CONFIGURATION & TOPIC SELECTION                     */}
        {/* ============================================================== */}
        <section className="w-full bg-[#050505] text-white px-6 sm:px-12 md:px-20 py-12 flex-1">
          <div className="max-w-6xl mx-auto flex flex-col gap-10">

            {/* First-Run Banner if No Valid API Key Exists */}
            {!hasApiKey && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in-up">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-100">Running in Heuristic Offline Mode</p>
                    <p className="text-[11px] text-amber-300/80">
                      CrossEx is currently using offline fallbacks. Add your free Gemini API key for live multimodal argumentation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Connect Gemini Key</span>
                </button>
              </div>
            )}

            {/* Option A: Custom Motion Builder Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#090a0f] border border-neutral-800 shadow-2xl flex flex-col gap-6 relative overflow-hidden transition-all duration-300 hover:border-neutral-700 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fcdbe8] animate-pulse" />
                  <label className="text-xs font-bold uppercase tracking-wider text-[#fcdbe8] font-mono">
                    Option A &bull; Enter Custom Sparring Proposition
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleRandomTopic}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-mono border border-neutral-700 hover:border-[#fcdbe8] transition-all hover:scale-105 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5 text-[#fcdbe8]" />
                  <span>Pick Random Motion</span>
                </button>
              </div>

              {/* Input Area */}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInput.trim()) {
                      handleStartDebate(customInput);
                    }
                  }}
                  placeholder="e.g., 'Virat Kohli is the greatest of all time in cricket' or 'This House Would Ban Targeted Political Advertising'..."
                  className="w-full px-5 py-4 rounded-2xl bg-black border border-neutral-800 text-sm sm:text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] focus:ring-1 focus:ring-[#fcdbe8] transition-all shadow-inner"
                />
              </div>

              {/* Controls Strip: Assigned Side, Tier, and CTA */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pt-3 border-t border-neutral-800/80">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Stance Toggle */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-neutral-400">Your Stance:</span>
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
                        Government (For)
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
                        Opposition (Against)
                      </button>
                    </div>
                  </div>

                  {/* Circuit Tier */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-neutral-400">Adjudicator Tier:</span>
                    <div className="flex items-center p-1 rounded-full bg-black border border-neutral-800 text-xs font-semibold">
                      {(["novice", "intermediate", "advanced"] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setDifficulty(diff)}
                          className={`px-3.5 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                            difficulty === diff
                              ? "bg-[#fcdbe8] text-black font-bold shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Start Sparring CTA */}
                <button
                  type="button"
                  onClick={() => handleStartDebate(customInput)}
                  disabled={!customInput.trim()}
                  className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs tracking-tight shadow-lg shadow-[#fcdbe8]/10 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span>Start Sparring Match</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Option B: Popular Sparring Motions */}
            <div className="flex flex-col gap-5 pt-2 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#fcdbe8]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">
                    Option B &bull; Curated Sparring Topics
                  </span>
                </div>
                <span className="text-xs text-neutral-500 font-mono">1-click to begin sparring</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {BEGINNER_TOPICS.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#090a0f] border border-neutral-800 flex flex-col gap-3.5 hover:border-neutral-700 transition-colors"
                  >
                    <span className="text-xs font-bold font-mono text-[#fcdbe8] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black border border-neutral-800 w-fit">
                      {cat.category}
                    </span>
                    <div className="flex flex-col gap-2.5">
                      {cat.motions.map((m, mIdx) => (
                        <button
                          key={mIdx}
                          type="button"
                          onClick={() => {
                            setTopic(m.topic);
                            setCustomInput(m.topic);
                            setUserSide(m.side);
                            handleStartDebate(m.topic);
                          }}
                          className="p-3.5 rounded-xl bg-black/60 hover:bg-neutral-900 border border-neutral-800 hover:border-[#fcdbe8] text-left transition-all duration-300 cursor-pointer group flex flex-col gap-1.5 hover:shadow-md hover:-translate-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white group-hover:text-[#fcdbe8] leading-snug transition-colors">
                              {formatMotionDisplay(m.topic)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-neutral-500 group-hover:text-[#fcdbe8] group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
                          </div>
                          <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">
                            {m.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* API Key Modal */}
        <ApiKeyModal
          isOpen={isKeyModalOpen}
          onClose={() => setIsKeyModalOpen(false)}
          onKeyUpdated={(has) => setHasApiKey(has)}
        />
      </div>
    );
  }

  // =========================================================================
  // RENDER: ACTIVE ENDLESS CHAT DEBATE
  // =========================================================================
  return (
    <div className="flex-1 w-full max-w-[1720px] mx-auto px-3 sm:px-6 md:px-8 py-3 sm:py-4 flex flex-col font-sans h-[calc(100vh-4.5rem)]">
      {/* 1. Header Bar */}
      <header className="p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shrink-0 mb-4 backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-neutral-800 text-[#fcdbe8] shrink-0 border border-neutral-700">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Endless Sparring &bull; Exchange #{exchangeCount}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  userSide === "government"
                    ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-950/70 text-rose-300 border border-rose-500/40"
                }`}
              >
                You: {userSide.toUpperCase()}
              </span>

              {hasDemoActive && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Info className="w-3 h-3 text-amber-400" />
                  <span>Demo Mode: Not Live AI ({activeDemoReason})</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              &ldquo;{formatMotionDisplay(topic)}&rdquo;
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
          <button
            onClick={() => setIsScorecardOpen(!isScorecardOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
            title="Toggle Logic Scorecard"
          >
            {isScorecardOpen ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5 text-[#fcdbe8]" />
                <span className="hidden sm:inline">Hide Scorecard</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5 text-[#fcdbe8]" />
                <span className="hidden sm:inline">Show Scorecard</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
            title="Configure Gemini API Key"
          >
            <Key className="w-3.5 h-3.5 text-[#fcdbe8]" />
            <span className="hidden sm:inline">{hasApiKey ? "API Key" : "Add Key"}</span>
          </button>

          <button
            onClick={handleResetSession}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Change Topic</span>
          </button>

          <button
            onClick={handleEndDebate}
            disabled={isEnding || messages.length < 2}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-40"
          >
            <Trophy className="w-3.5 h-3.5 text-black" />
            <span>{isEnding ? "Tallying..." : "End Debate & View Stats"}</span>
          </button>
        </div>
      </header>

      {/* First-Run Banner if No Valid API Key Exists */}
      {!hasApiKey && (
        <div className="mb-3 px-4 py-2.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 shrink-0 animate-in fade-in motion-reduce:animate-none">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Demo Mode Active:</strong> No API key detected. Sparring runs with offline rule-based heuristics.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className="px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition-colors cursor-pointer shrink-0"
          >
            Configure API Key
          </button>
        </div>
      )}

      {/* Main Workspace: Chat Stream + Collapsible Right Rail */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* 2. Centered Conversation Column */}
        <div className="flex-1 flex flex-col min-w-0 bg-neutral-950 rounded-2xl border border-neutral-800 shadow-inner overflow-hidden">
          {/* Scrollable Thread Area with aria-live="polite" */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5"
            aria-live="polite"
            role="log"
          >
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
              {messages.map((m) => {
                const isUser = m.speaker === "user";
                const isTipExpanded = expandedTipId === m.id;
                const isScoreExpanded = expandedScoreId === m.id;
                const isDisplayAnimating = displayAnimMsgId === m.id;
                const displayText = isDisplayAnimating ? m.text.slice(0, displayAnimLength) : m.text;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-1.5 w-full ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Speaker Metadata Label (12-13px, high contrast) */}
                    <div className="flex items-center gap-2 px-1 text-xs font-medium text-neutral-300">
                      <span className="font-semibold text-white">
                        {isUser
                          ? `You (${userSide === "government" ? "Government" : "Opposition"})${m.attempt_number && m.attempt_number > 1 ? ` • Attempt #${m.attempt_number}` : ""}`
                          : `Opponent (${userSide === "government" ? "Opposition" : "Government"})`}
                      </span>
                      <span className="text-neutral-500">&bull;</span>
                      <span className="text-neutral-400">{m.timestamp}</span>

                      {/* Opponent Demo Badge */}
                      {!isUser && m.is_demo && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          Demo mode: not live AI ({m.demo_reason || "Offline"})
                        </span>
                      )}
                    </div>

                    {/* Message Bubble (max-w-[720px]) */}
                    <div
                      onClick={() => {
                        if (isDisplayAnimating) setDisplayAnimMsgId(null);
                      }}
                      className={`p-5 rounded-2xl text-sm leading-relaxed shadow-md max-w-[720px] w-full cursor-default ${
                        isUser
                          ? "bg-neutral-900 text-white border border-neutral-800 rounded-tr-none ml-auto"
                          : "bg-neutral-900/90 text-neutral-100 border border-[#fcdbe8]/25 rounded-tl-none mr-auto"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                        {displayText}
                        {isDisplayAnimating && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#fcdbe8] animate-pulse align-middle motion-reduce:animate-none" />
                        )}
                      </p>

                      {/* POI Challenge Card (WCAG AA Contrast, Accent Border, 14px Text) */}
                      {m.poi && (!isDisplayAnimating || displayAnimLength >= m.text.length) && (
                        <div className="mt-4 p-4 rounded-xl bg-amber-950/25 border-l-4 border-amber-400 text-amber-100 text-sm flex flex-col gap-1.5 animate-in fade-in motion-reduce:animate-none">
                          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-300 uppercase">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Point of Information (POI Challenge)</span>
                          </div>
                          <p className="font-medium text-amber-50 text-[14px] leading-normal italic">
                            &ldquo;{m.poi}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* User Speech Diagnostics Pill & Expandable Coach Tip */}
                    {isUser && (
                      <div className="flex flex-col gap-2 max-w-[720px] w-full mt-0.5">
                        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                          {/* Score Pill: ONLY shown if score != null */}
                          {m.score !== null && m.score !== undefined && (
                            <button
                              type="button"
                              onClick={() => setExpandedScoreId(isScoreExpanded ? null : m.id)}
                              className="px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                            >
                              <span>Argument Score: {m.score}/100</span>
                              {isScoreExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}

                          {/* Fallacy Flag Pill showing X of Y flags verified */}
                          {m.fallacies && m.fallacies.length > 0 && (
                            <span
                              className="px-3 py-1 rounded-full bg-rose-950/70 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1.5 cursor-help"
                              title="Quote matched against the transcript produced by the model."
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              <span>
                                {m.verified_fallacy_count ?? m.fallacies.length} of {m.total_fallacy_count ?? m.fallacies.length} flags verified: {m.fallacies[0].type.replace(/_/g, " ")}
                              </span>
                            </span>
                          )}


                          {/* Redo This Speech Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setRedoTurn({
                                id: m.id,
                                text: m.text,
                                coaching_tip: m.coaching_tip,
                                round: Math.ceil((messages.indexOf(m) + 1) / 2),
                              });
                              setUserInput(m.text);
                            }}
                            className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-[#fcdbe8] hover:text-black border border-neutral-700 text-neutral-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Redo this speech</span>
                          </button>

                          {/* Coaching Tip Expand Button */}
                          {m.coaching_tip && (
                            <button
                              type="button"
                              onClick={() => setExpandedTipId(isTipExpanded ? null : m.id)}
                              className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Lightbulb className="w-3 h-3 text-[#fcdbe8]" />
                              <span>{isTipExpanded ? "Hide Tip" : "View Coaching Tip"}</span>
                              {isTipExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        {/* Redo Delta Card (Before / After with Green / Red Arrows & Fixed Fallacies) */}
                        {m.redo_delta && (
                          <div className="p-4 rounded-xl bg-black border border-emerald-500/40 text-xs flex flex-col gap-2.5">
                            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Redo &amp; Compare Delta (Attempt #{m.attempt_number || 2})
                              </span>
                              <span className="text-[11px] font-mono text-neutral-400">
                                Original &rarr; Redo
                              </span>
                            </div>
                            {m.redo_delta.is_demo ? (
                              <p className="text-amber-300/90 text-xs italic">
                                Score delta hidden in Demo Mode (scores null). Connect Gemini API key for quantitative metrics.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                                  <span className="text-neutral-400">Soundness:</span>
                                  <span className={`font-mono font-bold flex items-center gap-0.5 ${(m.redo_delta.soundness_delta || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {(m.redo_delta.soundness_delta || 0) >= 0 ? "↑ +" : "↓ "}{m.redo_delta.soundness_delta ?? 0} pts
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                                  <span className="text-neutral-400">Warrants Added:</span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    +{m.redo_delta.warrants_added || 0}
                                  </span>
                                </div>
                              </div>
                            )}
                            {m.redo_delta.fallacies_fixed && m.redo_delta.fallacies_fixed.length > 0 && (
                              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] flex flex-col gap-1">
                                <span className="font-bold">&check; Fallacy Fixed (Quotes eliminated):</span>
                                {m.redo_delta.fallacies_fixed.map((f: any, i: number) => (
                                  <span key={i} className="text-neutral-300">
                                    &bull; {typeof f === "string" ? f : f.type}: &ldquo;{typeof f === "object" ? f.quote : ""}&rdquo;
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expandable Score Breakdown */}
                        {isScoreExpanded && m.score !== null && m.score !== undefined && (
                          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 flex flex-col gap-2 animate-in fade-in motion-reduce:animate-none">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Scoring Analysis ({m.score}/100)
                            </span>
                            <p className="text-neutral-400 leading-relaxed">
                              {m.score < 50
                                ? "Score < 50: This turn offered a standalone claim without sufficient evidentiary warrants or comparative mechanisms. Ground claims in empirical benchmarks to score above 65."
                                : m.score < 75
                                ? "Score 50-74: Sound baseline claim, but vulnerable to comparative pressure from opponent counter-examples."
                                : "Score 75+: Strong argumentative grounding with causal mechanisms and clear debate standards."}
                            </p>
                          </div>
                        )}

                        {/* Expandable Full Coaching Tip Card (No Truncation) */}
                        {isTipExpanded && m.coaching_tip && (
                          <div className="p-4 rounded-xl bg-neutral-900/90 border border-amber-500/30 text-xs sm:text-sm text-neutral-200 flex flex-col gap-1.5 animate-in fade-in motion-reduce:animate-none">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                              <span>Adjudicator Coaching Recommendation</span>
                            </div>
                            <p className="text-neutral-300 leading-relaxed text-[13.5px]">
                              {m.coaching_tip}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing / Adjudicating Skeleton Indicator */}
              {isSubmitting && (
                <div className="flex flex-col gap-1.5 items-start mr-auto max-w-[720px] w-full">
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 px-1">
                    <span>Opponent &bull; Formulating Rebuttal...</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col gap-2.5 w-full animate-pulse motion-reduce:animate-none">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#fcdbe8] animate-ping motion-reduce:animate-none" />
                      <span className="text-xs font-semibold text-neutral-300">
                        Analyzing warrants, cross-checking claims, and framing opposition rebuttal...
                      </span>
                    </div>
                    <div className="h-3 bg-neutral-800 rounded-full w-3/4" />
                    <div className="h-3 bg-neutral-800 rounded-full w-1/2" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 3. Pinned Speech Input Bar at Bottom */}
          <div className="p-4 bg-neutral-900/95 border-t border-neutral-800 shrink-0 shadow-2xl backdrop-blur-md">
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-2.5">
              {/* Active Redo Speech Callout Banner */}
              {redoTurn && (
                <div className="p-3 rounded-xl bg-neutral-900 border-2 border-[#fcdbe8] text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in motion-reduce:animate-none">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RotateCcw className="w-4 h-4 text-[#fcdbe8] shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-[#fcdbe8]">Redoing Speech:</span>{" "}
                      <span className="text-neutral-300">
                        Keeps motion &amp; side. Address critique: &ldquo;{redoTurn.coaching_tip || "Deepen warrants and evidence"}&rdquo;
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedoTurn(null)}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold cursor-pointer shrink-0 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Robustness: Retry Button on Failed Turns (Draft Preserved) */}
              {failedTurn && (
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in motion-reduce:animate-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">
                      Turn error: {failedTurn.error} (Your draft is preserved below)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(failedTurn.text)}
                    className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Turn</span>
                  </button>
                </div>
              )}

              {/* Audio Evaluation Error Banner */}
              {audioError && (
                <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in motion-reduce:animate-none">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-medium">{audioError}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {audioError.toLowerCase().includes("gemini key") && (
                      <button
                        type="button"
                        onClick={() => setIsKeyModalOpen(true)}
                        className="px-3 py-1 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs transition-colors cursor-pointer"
                      >
                        Add Key
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAudioError(null)}
                      className="px-2 py-1 rounded text-neutral-400 hover:text-white font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}


              {/* Delivery Metrics Badge from Spoken Turn */}
              {deliveryMetrics && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 flex-wrap animate-in fade-in motion-reduce:animate-none">
                  <span className="font-bold text-[#fcdbe8]">Voice Delivery:</span>
                  <span className="font-mono text-emerald-400">{deliveryMetrics.words_per_minute} WPM</span>
                  <span className="text-neutral-600">&bull;</span>
                  <span>{deliveryMetrics.filler_total} fillers</span>
                  <span className="text-neutral-600">&bull;</span>
                  <span>{deliveryMetrics.confidence_score}% confidence</span>
                  <span className="text-neutral-600">&bull;</span>
                  <span className="capitalize">{deliveryMetrics.pacing.replace(/_/g, " ")}</span>
                </div>
              )}

              {/* Active Speech Bar Controls: Timer, Word Count, Dictation Status */}
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-mono text-neutral-300">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{formattedMinutes}:{formattedSeconds}</span>
                  </span>
                  <span className="text-neutral-500">&bull;</span>
                  <span className="flex items-center gap-1 text-neutral-300">
                    <FileText className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{wordCount} words</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isRecording && (
                    <span className="flex items-center gap-1.5 text-rose-400 font-semibold animate-pulse motion-reduce:animate-none text-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Recording speech... Click mic to transcribe
                    </span>
                  )}
                  {isProcessingAudio && (
                    <span className="flex items-center gap-1.5 text-neutral-300 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#fcdbe8]" />
                      Transcribing audio & analyzing metrics...
                    </span>
                  )}
                  <span className="text-[11px] text-neutral-500 hidden sm:inline">
                    Enter to send &bull; Shift+Enter for new line
                  </span>
                </div>
              </div>

              {/* Textarea + Action Buttons */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2.5"
              >
                <div className="flex-1 relative rounded-2xl bg-neutral-950 border border-neutral-700 focus-within:border-[#fcdbe8] transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Deliver your argument as ${userSide.toUpperCase()} on "${formatMotionDisplay(topic)}"...`}
                    rows={2}
                    className="w-full px-4 py-3 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none resize-none font-sans leading-relaxed"
                  />
                </div>

                {/* Spoken Turns: MediaRecorder Button */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  disabled={isProcessingAudio}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isRecording
                      ? "bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-md animate-pulse motion-reduce:animate-none"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
                  }`}
                  title={isRecording ? "Stop recording & transcribe speech" : "Record voice turn"}
                >
                  {isProcessingAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#fcdbe8]" />
                  ) : isRecording ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!userInput.trim() || isSubmitting || isProcessingAudio}
                  className="px-5 py-3 rounded-xl bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-md shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send Speech</span>
                </button>
              </form>

              {/* Quick Starter Prompts for Rapid Sparring */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-neutral-400 no-scrollbar">
                <span className="shrink-0 text-neutral-500 font-semibold text-[11px]">Starters:</span>
                <button
                  type="button"
                  onClick={() => setUserInput((prev) => (prev ? `${prev} ` : "") + "My primary contention is that ")}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                >
                  &ldquo;My primary contention is...&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => setUserInput((prev) => (prev ? `${prev} ` : "") + "In direct rebuttal to the opponent's challenge, ")}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                >
                  &ldquo;In direct rebuttal...&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => setUserInput((prev) => (prev ? `${prev} ` : "") + "On comparative impact weighing, ")}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                >
                  &ldquo;On comparative impact...&rdquo;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Desktop Logic Scorecard (Right Rail) */}
        {isScorecardOpen && (
          <aside className="w-80 shrink-0 hidden lg:flex flex-col gap-4 overflow-y-auto bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#fcdbe8]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Logic Scorecard
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                Turn {exchangeCount}
              </span>
            </div>

            {/* Latest Argument Soundness */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-400">
                Latest Argument Soundness
              </span>
              <div className="flex items-baseline gap-2">
                {latestScore !== null && latestScore !== undefined ? (
                  <>
                    <span className="text-3xl font-black text-emerald-400">
                      {latestScore}
                    </span>
                    <span className="text-xs text-neutral-500">/ 100</span>
                  </>
                ) : (
                  <span className="text-xs text-neutral-400 italic">
                    {hasDemoActive ? "Score hidden in Demo Mode" : "Awaiting speech..."}
                  </span>
                )}
              </div>
            </div>

            {/* Extracted Premises */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#fcdbe8]" />
                Identified Premises
              </span>
              {latestPremises.length > 0 ? (
                <ul className="flex flex-col gap-2 text-xs text-neutral-300">
                  {latestPremises.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#fcdbe8] font-bold">&bull;</span>
                      <span className="leading-snug">{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  Deliver a speech to view premise extraction.
                </p>
              )}
            </div>

            {/* Fallacy Discipline Audit */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Fallacy Audit
              </span>
              {latestFallacies.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {latestFallacies.map((f, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-rose-300 block mb-1">
                        {f.type.replace(/_/g, " ")}
                      </span>
                      <p className="italic text-[11px] mb-1">&ldquo;{f.quote}&rdquo;</p>
                      <p className="text-[11px] text-neutral-300">{f.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>No fallacies flagged in latest exchange</span>
                </p>
              )}
            </div>

            {/* Core Motion Context */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-400">
                Debate Motion
              </span>
              <p className="text-xs font-medium text-white leading-relaxed">
                {formatMotionDisplay(topic)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 capitalize">
                  {difficulty} Tier
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 capitalize">
                  {userSide}
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. FINAL ADJUDICATION VERDICT STATS MODAL ("STATS COME OFF")              */}
      {/* ========================================================================= */}
      {isVerdictOpen && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-neutral-950 border border-neutral-800 flex flex-col gap-6 relative shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#fcdbe8] text-black">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white tracking-tight">
                    Official Chief Adjudicator Decision
                  </h3>
                  <p className="text-xs text-neutral-400">
                    National Championship Collegiate Ballot
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsVerdictOpen(false)}
                className="text-neutral-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Outcome & Speaker Points */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1">
                <span className="text-xs font-semibold text-neutral-400">Ballot Award</span>
                <span className="text-xl font-black uppercase text-[#fcdbe8]">
                  {verdict.outcome === "win"
                    ? "Government Victory"
                    : verdict.outcome === "loss"
                    ? "Opposition Victory"
                    : "Close Judicial Split"}
                </span>
                <span className="text-xs text-neutral-400">{verdict.speaker_rank}</span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1">
                <span className="text-xs font-semibold text-neutral-400">Speaker Points</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{verdict.user_score}</span>
                  <span className="text-xs text-neutral-500">vs {verdict.opponent_score}</span>
                </div>
                <span className="text-xs text-emerald-400 font-semibold">
                  {verdict.user_score > verdict.opponent_score ? "+ Speaker Point Margin" : "Competitive Clash"}
                </span>
              </div>
            </div>

            {/* Reason for Decision (RFD) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#fcdbe8]">
                Adjudicator Reason For Decision (RFD)
              </span>
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                {verdict.rfd}
              </div>
            </div>

            {/* Core Clashes */}
            {verdict.clashes && verdict.clashes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Key Clashes of the Round
                </span>
                <div className="flex flex-col gap-2">
                  {verdict.clashes.map((c, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{c.clash_name}</span>
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            c.winner === "user"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                              : c.winner === "opponent"
                              ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          Winner: {c.winner}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">{c.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skill Radar Breakdown */}
            {verdict.skill_breakdown && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Skill Breakdown
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(verdict.skill_breakdown).map(([skill, val]) => (
                    <div key={skill} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-1 text-center">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                        {skill.replace(/_/g, " ")}
                      </span>
                      <span className="text-base font-black text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `DebateLab Adjudication on "${topic}"\n\nRuling: ${verdict.outcome.toUpperCase()}\nUser Score: ${verdict.user_score}\n\nRFD:\n${verdict.rfd}`
                  );
                  setCopiedVerdict(true);
                  setTimeout(() => setCopiedVerdict(false), 2000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-800 transition-colors cursor-pointer"
              >
                {copiedVerdict ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedVerdict ? "Copied Ruling!" : "Copy Ballot"}</span>
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href="/drills"
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Practice Drills</span>
                </Link>
                <button
                  onClick={() => {
                    setIsVerdictOpen(false);
                    setIsSetupOpen(true);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Start New Debate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={(has) => setHasApiKey(has)}
      />
    </div>
  );
};
