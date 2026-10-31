"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Minus,
  ArrowRight,
  Activity,
  AlertTriangle,
  ShieldAlert,
  Play,
  Volume2,
  Sparkles,
  Scale,
  CheckCircle2,
  Layers,
  User,
  LogOut,
} from "lucide-react";
import { getGeminiConfigStatus } from "@/lib/api";
import { AnimatedText } from "@/components/AnimatedText";
import { useInView } from "@/hooks/useInView";

const methodItems = [
  {
    title: "Strategic.",
    description:
      "CrossEx evaluates arguments like a seasoned parliamentary adjudicator. It focuses on substantive warrants, impact weight, and structural clarity rather than superficial keyword matching.",
  },
  {
    title: "Less talk, more action.",
    description:
      "Zero-disk audio transit. Raw Opus/WebM audio streams straight to Gemini in RAM. Vocal confidence, pitch stability, and speech hesitations are extracted directly from the acoustics in under 2 seconds.",
  },
  {
    title: "Argument-centric.",
    description:
      "Strict verbatim quotation standards. Fallacies (ad hominem, false dilemmas, straw man, hasty generalizations) are never hallucinated; they are only flagged when the exact offending words can be quoted verbatim.",
  },
  {
    title: "Circuit-calibrated.",
    description:
      "Scoring calibrated across Novice, Intermediate, and National Championship Parliamentary standards. A score of 50 reflects baseline competence; 75+ represents elite varsity performance.",
  },
  {
    title: "Socratic sparring.",
    description:
      "An automated chief adjudicator immediately synthesizes the opposing stance, dismantles your weakest premise in spoken prose and issues a probing Socratic cross-examination question.",
  },
  {
    title: "Trajectory memory.",
    description:
      "Maintains context across up to six consecutive debate rounds to track rebuttal consistency, clash resolution, and long-term rhetorical improvement.",
  },
];

export const EditorialHero: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { ref: signalsRef, isInView: signalsInView } = useInView({ threshold: 0.12 });
  const { ref: methodRef, isInView: methodInView } = useInView({ threshold: 0.12 });
  const { ref: platformRef, isInView: platformInView } = useInView({ threshold: 0.12 });

  useEffect(() => {
    getGeminiConfigStatus().then(setConfig).catch(() => setConfig(null));
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      setIsLoggedIn(Boolean(token));
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      setIsLoggedIn(false);
      window.location.reload();
    }
  };

  const dynamicPhrases = [
    "DEBATE LAB.",
    "SPEECH COACH.",
    "LOGIC REFEREE.",
    "PARLIAMENTARY ARENA.",
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = dynamicPhrases[phraseIndex];
    let timer: NodeJS.Timeout;

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, 90);
      } else {
        // Pause at complete word
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length - 1));
        }, 45);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % dynamicPhrases.length);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIndex]);

  return (
    <div className="w-full flex flex-col font-sans selection:bg-black selection:text-pink-200">
      {/* ============================================================== */}
      {/* SECTION 1: BLUSH PINK HERO BLOCK (#fcdbe8)                     */}
      {/* ============================================================== */}
      <section className="w-full bg-[#fcdbe8] text-black px-6 sm:px-12 md:px-20 pt-8 pb-16 md:pb-24 border-b border-black/10 overflow-hidden">
        {/* Floating background blobs */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#fcdbe8]/30 rounded-full blur-[120px] pointer-events-none animate-blob" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-black/20 rounded-full blur-[100px] pointer-events-none animate-blob-delay-2" />
        <div className="absolute top-[30%] left-[-10%] w-[400px] h-[400px] bg-black/15 rounded-full blur-[80px] pointer-events-none animate-blob-delay-1" />

        {/* Ultra-Frosted Translucent Glass Menu Bar */}
        <div className="max-w-[1720px] mx-auto pb-10 sm:pb-16 relative z-30">
          <header className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 rounded-full liquid-glass transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
            {/* Brand Logo & Pill */}
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/40 hover:bg-white/60 border border-white/60 shadow-sm transition-all duration-300 group cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-black text-[#fcdbe8] font-black text-[11px] flex items-center justify-center shadow group-hover:scale-105 transition-transform">
                CX
              </div>
              <span className="font-extrabold text-xs sm:text-sm tracking-tight text-black">
                crossex.debatelab.com
              </span>
            </Link>

            {/* Navigation Links with Glass Pills */}
            <nav className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold tracking-tight text-black">
              <Link
                href="/arena?mode=chat"
                className="px-3.5 py-1.5 rounded-full text-black/80 hover:text-black hover:bg-white/50 border border-transparent hover:border-white/60 transition-all cursor-pointer hidden md:inline-block font-medium"
              >
                Endless Text Spar
              </Link>
              <Link
                href="/arena?mode=text"
                className="px-3.5 py-1.5 rounded-full text-black/80 hover:text-black hover:bg-white/50 border border-transparent hover:border-white/60 transition-all cursor-pointer hidden sm:inline-block font-medium"
              >
                Parliamentary Arena
              </Link>
              <Link
                href="/arena?mode=voice"
                className="px-3.5 py-1.5 rounded-full text-black/80 hover:text-black hover:bg-white/50 border border-transparent hover:border-white/60 transition-all cursor-pointer hidden sm:inline-block font-medium"
              >
                Speech Adjudicator
              </Link>
              <Link
                href="/drills"
                className="px-3.5 py-1.5 rounded-full text-black/80 hover:text-black hover:bg-white/50 border border-transparent hover:border-white/60 transition-all cursor-pointer hidden lg:inline-block font-medium"
              >
                Practice Drills
              </Link>

              {/* Auth State Button */}
              {isLoggedIn ? (
                <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                  <Link
                    href="/profile"
                    className="px-4 py-2 rounded-full bg-white/60 hover:bg-white text-black font-bold text-xs tracking-tight shadow-sm hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5 border border-white/80"
                    title="View Debater Portfolio"
                  >
                    <User className="w-3.5 h-3.5 text-black" />
                    <span>Profile</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-black/10 hover:bg-black/20 text-black hover:text-red-600 transition-all cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="ml-1 sm:ml-2 px-5 py-2 rounded-full bg-black hover:bg-neutral-900 text-[#fcdbe8] hover:text-white font-bold text-xs tracking-tight shadow-md hover:shadow-xl hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5 border border-white/20"
                >
                  <span>Sign in</span>
                </Link>
              )}

              {/* Glass Status Chip */}
              <div className="hidden sm:flex items-center gap-1.5 ml-1.5 pl-2 border-l border-black/10">
                <span className="px-2.5 py-0.5 rounded-full bg-white/50 border border-white/70 text-black text-[10px] font-mono font-bold shadow-xs">
                  AI 2.5
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="System Online" />
              </div>
            </nav>
          </header>
        </div>

        {/* Hero Title & Subtext with Dynamic Typewriter Animation */}
        <div className="max-w-[1720px] mx-auto pt-12 sm:pt-16 flex flex-col gap-8 animate-fade-in-up delay-900">
          <div className="min-h-[1.1em] flex items-baseline">
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.92] text-black uppercase animate-text-shimmer">
              {displayText}
              <span className="inline-block w-2 sm:w-3 md:w-4 h-[0.85em] bg-black ml-1.5 align-middle animate-pulse" />
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-4 animate-fade-in-up delay-1000">
            <div className="max-w-md">
              <p className="text-base sm:text-lg font-medium text-black/85 leading-snug">
                {"The AI-powered parliamentary debate adjudicator & speech coach. Record your speech, get instant multimodal evaluation from Gemini, spar with an AI adjudicator, and track your progress round by round."
                  .split(" ")
                  .map((word, idx) => (
                    <span
                      key={idx}
                      className="animate-word-entry"
                      style={{
                        animationDelay: `${0.8 + idx * 0.045}s`,
                        marginRight: "0.28em",
                      }}
                    >
                      {word}
                    </span>
                  ))}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap animate-fade-in-up delay-1100">
              <Link
                href="/arena?mode=chat"
                className="px-6 py-2.5 rounded-full border border-black bg-black text-[#fcdbe8] hover:bg-white hover:scale-105 hover:shadow-[0_0_40px_rgba(252,219,232,0.4)] transition-all duration-300 pulse-glow flex items-center gap-1.5 shadow-md shadow-black/10 inline-block text-center cursor-pointer"
              >
                <span>Endless Text Spar</span>
                <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
              </Link>
              <Link
                href="/arena?mode=text"
                className="px-5 py-2.5 rounded-full border border-black/40 hover:border-black text-black text-xs font-semibold tracking-tight transition-all bg-white/40 hover:bg-white inline-block text-center cursor-pointer animate-scale"
              >
                3-Round Tournament
              </Link>
              <Link
                href="/arena?mode=voice"
                className="px-5 py-2.5 rounded-full border border-black/40 hover:border-black text-black text-xs font-semibold tracking-tight transition-all bg-white/40 hover:bg-white inline-block text-center cursor-pointer animate-scale"
              >
                Speech Adjudication
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* TICKER STRIP                                                   */}
      {/* ============================================================== */}
      <div className="w-full bg-white text-black py-4 px-6 border-b border-black/10 overflow-hidden animate-fade-in-up delay-1300">
        <div className="max-w-[1720px] mx-auto flex items-center justify-center text-center text-xs sm:text-sm font-semibold tracking-tight text-neutral-800 flex-wrap gap-x-3 gap-y-1 animate-pulse">
          <span>Live Text Arena.</span>
          <span>Acoustic Confidence.</span>
          <span>Verbatim Fallacies.</span>
          <span>Socratic Rebuttals.</span>
          <span>Championship Ballots &amp; Stats.</span>
          <span>Circuit Calibration.</span>
          <span className="text-neutral-400">Voice &amp; Text Coaching.</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: CRISP WHITE "THE WORK / THE SIGNALS" BLOCK          */}
      {/* ============================================================== */}
      <section
        id="signals"
        ref={signalsRef}
        className="w-full bg-white text-black px-6 sm:px-12 md:px-20 py-16 sm:py-24"
      >
        <div className={`max-w-[1720px] mx-auto flex flex-col gap-12 sm:gap-16 transition-all duration-1000 ${
          signalsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}>
          {/* Header & Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 border-b border-black/10 pb-10">
            <div className="flex flex-col gap-3">
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-none text-black uppercase">
                The
                <br />
                Signals.
              </h2>
              <p className="text-sm sm:text-base font-medium text-neutral-700 max-w-md pt-2">
                {signalsInView && (
                  <AnimatedText
                    text="One great thing about rigorous parliamentary debate is that sound logic and authoritative delivery speak for themselves."
                    delayMs={200}
                    staggerMs={28}
                  />
                )}
              </p>
            </div>

            <Link
              href="/arena"
              className="px-6 py-2.5 rounded-full border border-black hover:bg-black hover:text-white text-black text-xs font-semibold tracking-tight transition-all flex items-center gap-2 animate-scale"
            >
              <span>Explore debate signals in arena</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 3 Visual Showcase Cards (Custom High-Impact Debate Adjudication Modules) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            {/* ============================================================ */}
            {/* Card 1: Acoustic Delivery Signals (Visual Spectrum & WPM)    */}
            {/* ============================================================ */}
            <Link
              href="/arena?mode=voice"
              className={`flex flex-col gap-3 group cursor-pointer transition-all duration-700 delay-100 ${
                signalsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#090a0f] border border-neutral-800 p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group-hover:border-neutral-600 group-hover:shadow-2xl relative">
                {/* Subtle blush ambient glow */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#fcdbe8]/10 rounded-full blur-2xl pointer-events-none animate-blob" />

                {/* Card Top Strip */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                      Acoustic Spectrogram
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#fcdbe8]/15 text-[#fcdbe8] text-[10px] font-mono font-bold border border-[#fcdbe8]/30">
                    162.5 WPM
                  </span>
                </div>

                {/* Animated Simulated Waveform Spectrogram Bars */}
                <div className="flex items-end justify-between gap-1 h-24 my-auto px-1 relative z-10">
                  {[
                    28, 45, 60, 38, 72, 85, 95, 65, 40, 55, 80, 92, 100, 78, 62,
                    48, 70, 88, 94, 76, 52, 68, 84, 90, 72, 58, 42, 64, 82, 50,
                  ].map((height, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-t from-neutral-800 via-[#fcdbe8]/70 to-[#fcdbe8] animate-waveform-pulse"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${(i % 5) * 0.15}s`,
                        animationDuration: `${0.8 + ((i % 4) * 0.2)}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Bottom Delivery Metric Pills */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-neutral-800/80 relative z-10">
                  <div className="flex flex-col bg-neutral-900/80 p-2 rounded-xl border border-neutral-800 text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-mono font-bold">Confidence</span>
                    <span className="text-xs font-mono font-bold text-[#fcdbe8]">84 / 100</span>
                  </div>
                  <div className="flex flex-col bg-neutral-900/80 p-2 rounded-xl border border-neutral-800 text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-mono font-bold">Hesitation</span>
                    <span className="text-xs font-mono font-bold text-white">16 (Low)</span>
                  </div>
                  <div className="flex flex-col bg-neutral-900/80 p-2 rounded-xl border border-neutral-800 text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-mono font-bold">Fillers</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">0 in 30s</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col pt-1">
                <h3 className="font-bold text-base text-black tracking-tight">
                  Acoustic Delivery Signals
                </h3>
                <div className="flex items-center gap-1 text-xs text-neutral-600 group-hover:text-black font-semibold mt-0.5">
                  <span>Inspect pacing, vocal confidence &amp; hesitations</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>

            {/* ============================================================ */}
            {/* Card 2: Logic & Verbatim Fallacy Extraction                   */}
            {/* ============================================================ */}
            <Link
              href="/arena?mode=text"
              className={`flex flex-col gap-3 group cursor-pointer transition-all duration-700 delay-200 ${
                signalsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#0a0a0f] border border-neutral-800 p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group-hover:border-neutral-600 group-hover:shadow-2xl relative">
                {/* Subtle amber ambient glow */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none animate-blob-delay-1" />

                {/* Card Top Strip */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#fcdbe8]" />
                    <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                      Verbatim Fallacy Engine
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    Hasty Generalization
                  </span>
                </div>

                {/* Verbatim Quote Highlight Callout */}
                <div className="flex flex-col gap-2 my-auto relative z-10">
                  <div className="p-3.5 rounded-2xl bg-black/80 border border-neutral-800 text-xs font-serif italic text-neutral-200 leading-snug">
                    &ldquo;<mark className="bg-[#fcdbe8] text-black px-1 rounded font-sans font-bold not-italic">Everyone knows</mark> traditional news media had editorial gatekeepers...&rdquo;
                  </div>

                  {/* Causal Mechanism Bridge */}
                  <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-400 font-mono px-1">
                    <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
                      Ad Monetization
                    </span>
                    <span className="text-[#fcdbe8] font-bold">&rarr;</span>
                    <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
                      Outrage Virality
                    </span>
                    <span className="text-[#fcdbe8] font-bold">&rarr;</span>
                    <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
                      Erosion
                    </span>
                  </div>
                </div>

                {/* Bottom Verification Stamp */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 text-[10px] font-mono relative z-10">
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Strict Verbatim Quotes Only
                  </span>
                  <span className="text-neutral-500">Zero Hallucinations</span>
                </div>
              </div>

              <div className="flex flex-col pt-1">
                <h3 className="font-bold text-base text-black tracking-tight">
                  Logic &amp; Fallacy Extraction
                </h3>
                <div className="flex items-center gap-1 text-xs text-neutral-600 group-hover:text-black font-semibold mt-0.5">
                  <span>View premise chains, warrants &amp; repair advice</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>

            {/* ============================================================ */}
            {/* Card 3: Socratic Counter-Rebuttal & Circuit Rating           */}
            {/* ============================================================ */}
            <Link
              href="/arena?mode=text"
              className={`flex flex-col gap-3 group cursor-pointer transition-all duration-700 delay-300 ${
                signalsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#07070b] border border-neutral-800 p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group-hover:border-neutral-600 group-hover:shadow-2xl relative">
                {/* Subtle blush ambient glow */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#fcdbe8]/15 rounded-full blur-2xl pointer-events-none animate-blob-delay-2" />

                {/* Card Top Strip */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8] flex items-center justify-center text-[9px] font-black">
                      ADJ
                    </div>
                    <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                      Chief Adjudicator
                    </span>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full bg-black text-[#fcdbe8] border border-[#fcdbe8]/40 text-[10px] font-mono font-black flex items-center gap-1">
                    <span>Circuit:</span>
                    <span className="text-white">85.5</span>
                  </div>
                </div>

                {/* Socratic Cross-Examination Dialogue */}
                <div className="flex flex-col gap-2.5 my-auto relative z-10">
                  <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-200 leading-relaxed font-sans">
                    &ldquo;If outrage is an inherent human cognitive bias, how can you prove the algorithmic mechanism itself is the primary cause rather than a mirror?&rdquo;
                  </div>

                  {/* Synthesized Voice Player Bar */}
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-black/70 border border-neutral-800">
                    <div className="flex items-center gap-2 text-[11px] text-[#fcdbe8] font-bold">
                      <Play className="w-3 h-3 fill-current" />
                      <span>Listen Spoken Socratic POI</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500">0:24 &bull; Opus</span>
                  </div>
                </div>

                {/* Bottom Parliamentary Calibration Pill */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 text-[10px] font-mono relative z-10">
                  <span className="text-[#fcdbe8] flex items-center gap-1 font-bold">
                    <Scale className="w-3.5 h-3.5" />
                    Comparative Weighing Active
                  </span>
                  <span className="text-neutral-500">Varsity Calibrated</span>
                </div>
              </div>

              <div className="flex flex-col pt-1">
                <h3 className="font-bold text-base text-black tracking-tight">
                  Socratic Counter-Rebuttal
                </h3>
                <div className="flex items-center gap-1 text-xs text-neutral-600 group-hover:text-black font-semibold mt-0.5">
                  <span>Synthesize adversarial POIs &amp; spoken prose</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 3: DEEP BLACK "THE PLATFORM" BLOCK WITH BLUSH ACCENTS    */}
      {/* ============================================================== */}
      <section
        id="platform"
        ref={platformRef}
        className="w-full bg-[#0a0a0a] text-white px-6 sm:px-12 md:px-20 py-16 sm:py-24 border-t border-neutral-800"
      >
        <div className={`max-w-[1720px] mx-auto flex flex-col gap-12 sm:gap-16 transition-all duration-1000 ${
          platformInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}>
          {/* Header & Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 border-b border-neutral-800 pb-10">
            <div className="flex flex-col gap-3">
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-none text-[#fcdbe8] uppercase">
                The
                <br />
                Platform.
              </h2>
              <p className="text-sm sm:text-base font-medium text-neutral-400 max-w-md pt-2">
                {platformInView && (
                  <AnimatedText
                    text="Everything you need to win your debate round — from recording to final verdict."
                    delayMs={200}
                    staggerMs={28}
                  />
                )}
              </p>
            </div>

            <Link
              href="/arena"
              className="px-6 py-2.5 rounded-full border border-[#fcdbe8]/40 hover:border-[#fcdbe8] text-[#fcdbe8] text-xs font-semibold tracking-tight transition-all flex items-center gap-2 hover:bg-[#fcdbe8]/10 animate-scale"
            >
              <span>Start speech evaluation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Platform Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className={`rounded-2xl border border-neutral-800 bg-[#050505]/50 p-6 transition-all duration-700 delay-100 hover:border-neutral-700 hover:shadow-xl hover:-translate-y-1 ${
              platformInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#fcdbe8]/10 text-[#fcdbe8] flex items-center justify-center">
                  🎤
                </div>
                <h3 className="text-lg font-bold text-white">Live Adjudication</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Record your speech and get instant multimodal evaluation
                from Gemini — confidence, logic, hesitation, fillers,
                and more.
              </p>
            </div>

            <div className={`rounded-2xl border border-neutral-800 bg-[#050505]/50 p-6 transition-all duration-700 delay-200 hover:border-neutral-700 hover:shadow-xl hover:-translate-y-1 ${
              platformInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#fcdbe8]/10 text-[#fcdbe8] flex items-center justify-center">
                  💬
                </div>
                <h3 className="text-lg font-bold text-white">AI Sparring</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Cross-examine your premises, repair flagged fallacies,
                and spar with an AI adjudicator that takes the opposing
                stance.
              </p>
            </div>

            <div className={`rounded-2xl border border-neutral-800 bg-[#050505]/50 p-6 transition-all duration-700 delay-300 hover:border-neutral-700 hover:shadow-xl hover:-translate-y-1 ${
              platformInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#fcdbe8]/10 text-[#fcdbe8] flex items-center justify-center">
                  📊
                </div>
                <h3 className="text-lg font-bold text-white">Progress Tracking</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Persistent sessions track your round-by-round evolution
                of confidence, soundness, hesitation, and fillers with
                interactive analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* FOOTER: EDITORIAL CLOSING BLOCK                                 */}
      {/* ============================================================== */}
      <footer className="w-full bg-[#050505] text-neutral-400 border-t border-neutral-900 px-6 sm:px-12 md:px-20 py-12 animate-fade-in-up delay-2200">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-white tracking-wider uppercase">
              CrossEx DebateLab
            </span>
            <p className="text-xs text-neutral-500">
              Multimodal Parliamentary Speech Adjudication &amp; Logic Sparring Engine
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/arena?mode=text"
              className="text-xs text-neutral-400 hover:text-white transition-colors animate-scale"
            >
              Parliamentary Arena
            </Link>
            <span className="text-neutral-700">|</span>
            <Link
              href="/arena?mode=voice"
              className="text-xs text-neutral-400 hover:text-white transition-colors animate-scale"
            >
              Speech Adjudicator
            </Link>
            <span className="text-neutral-700">|</span>
            <Link
              href="/arena"
              className="flex items-center gap-1.5 text-xs font-bold text-[#fcdbe8] hover:underline animate-scale"
            >
              <span>Launch Arena</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
