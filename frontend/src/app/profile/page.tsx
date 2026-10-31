"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Activity,
  Target,
  ShieldCheck,
  RotateCcw,
  Gauge,
  Flame,
  Award,
  BookOpen,
  Scale,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Mic,
} from "lucide-react";
import { getDebaterProfile, getSessionBallots } from "@/lib/api";
import { DebaterProfileResponse, BallotResponse } from "@/types/debate";
import { AnimatedText } from "@/components/AnimatedText";

export default function ProfilePage() {
  const [profile, setProfile] = useState<DebaterProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionBallots, setSessionBallots] = useState<BallotResponse[]>([]);
  const [loadingBallots, setLoadingBallots] = useState(false);

  useEffect(() => {
    getDebaterProfile()
      .then((data) => {
        setProfile(data);
        if (data.recent_sessions && data.recent_sessions.length > 0) {
          const firstId = data.recent_sessions[0].id;
          setSelectedSessionId(firstId);
          fetchBallots(firstId);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load debater profile");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchBallots = async (sessionId: string) => {
    setLoadingBallots(true);
    try {
      const ballots = await getSessionBallots(sessionId);
      setSessionBallots(ballots);
    } catch {
      setSessionBallots([]);
    } finally {
      setLoadingBallots(false);
    }
  };

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    fetchBallots(id);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#fcdbe8] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
            Loading Debater Portfolio &bull; CrossEx Analytics
          </p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-2xl bg-red-900/20 border border-red-500/30 p-6 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-base font-bold">Could not load debater profile</h2>
          </div>
          <p className="text-xs text-neutral-400">{error || "Please run database seed script"}</p>
          <Link
            href="/arena"
            className="py-2.5 px-6 rounded-lg bg-[#fcdbe8] text-black font-bold text-xs hover:bg-white transition-all shadow-md"
          >
            Return to Arena
          </Link>
        </div>
      </main>
    );
  }

  // Requirement 3: Empty State for Profile when user has no debates yet
  const hasNoDebates = profile.total_sessions === 0 && (!profile.recent_sessions || profile.recent_sessions.length === 0);

  if (hasNoDebates) {
    return (
      <main className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
        {/* Header Bar */}
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/arena"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Arena</span>
              </Link>
              <Link
                href="/"
                className="font-bold text-sm tracking-tight text-white hover:text-[#fcdbe8] transition-colors hidden sm:block"
              >
                crossex.debatelab.com
              </Link>
            </div>
          </div>
        </header>

        {/* Empty State Card */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-neutral-900/80 border border-neutral-800 text-center flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#fcdbe8]/10 border border-[#fcdbe8]/30 flex items-center justify-center text-[#fcdbe8] shadow-lg">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                🎤 No debates yet
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Record your first speech to see your scores and progress here.
              </p>
            </div>
            <Link
              href="/arena"
              className="mt-2 py-3 px-8 rounded-lg bg-[#fcdbe8] text-black font-bold text-sm hover:bg-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#fcdbe8]/20 flex items-center gap-2"
            >
              <Mic className="w-4 h-4 text-black" />
              <span>Start Debating</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-black selection:text-pink-200">
      {/* 1. Floating Liquid Glass Header Bar */}
      <header className="sticky top-3 z-40 px-3 sm:px-6 md:px-10 pointer-events-none mb-2">
        <div className="max-w-[1720px] mx-auto liquid-glass-dark rounded-full px-5 sm:px-7 py-2.5 flex items-center justify-between shadow-[0_12px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
          <div className="flex items-center gap-3.5">
            <Link
              href="/arena"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all hover:scale-105"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arena</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 group cursor-pointer hidden sm:flex"
            >
              <div className="w-6 h-6 rounded-full bg-black text-[#fcdbe8] font-black text-[11px] flex items-center justify-center border border-white/20">
                CX
              </div>
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white group-hover:text-[#fcdbe8] transition-colors">
                crossex.debatelab.com
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>{profile.current_tier}</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Hero Banner */}
      <section className="w-full bg-[#fcdbe8] text-black px-4 sm:px-8 md:px-12 py-10 sm:py-14 border-b border-black/10">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-black/70">
              Collegiate Competitor Dossier &bull; Verified Historical Metrics
            </span>
            <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter text-black leading-none">
              Debater
              <br />
              Portfolio.
            </h1>
            <p className="text-sm font-medium text-black/85 max-w-xl pt-1">
              <AnimatedText
                text="Multi-round trajectory analysis, 5-vector collegiate skill radar, verified quote integrity, and 3-judge persona adjudications."
                delayMs={250}
                staggerMs={35}
              />
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-5 py-3 rounded-2xl bg-black text-[#fcdbe8] flex flex-col items-center">
              <span className="text-3xl font-black font-mono leading-none">
                {profile.average_score.toFixed(1)}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-neutral-400">
                Composite Score
              </span>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-black/10 border border-black/20 text-black flex flex-col items-center">
              <span className="text-3xl font-black font-mono leading-none">
                {profile.total_sessions}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-black/70">
                Matches Logged
              </span>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-black/10 border border-black/20 text-black flex flex-col items-center">
              <span className="text-3xl font-black font-mono leading-none text-emerald-900">
                {profile.fallacies_eliminated_count}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-black/70">
                Flaws Repaired
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Analytics Container */}
      <div className="max-w-[1720px] mx-auto px-4 sm:px-8 md:px-12 py-8 sm:py-10 flex flex-col gap-10">
        {/* 5-Metric Skill Radar Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#fcdbe8]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                5-Vector Parliamentary Skill Radar
              </h2>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              Calibrated to American Parliamentary Debate Association (APDA)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3 interactive-card group">
              <span className="text-[11px] font-mono uppercase text-neutral-400 group-hover:text-emerald-400 transition-colors">
                Logic Soundness
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white group-hover:scale-105 transition-transform">
                  {profile.skill_radar.logic_soundness}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  style={{ width: `${profile.skill_radar.logic_soundness}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3 interactive-card group">
              <span className="text-[11px] font-mono uppercase text-neutral-400 group-hover:text-[#fcdbe8] transition-colors">
                Delivery Confidence
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white group-hover:scale-105 transition-transform">
                  {profile.skill_radar.delivery_confidence}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#fcdbe8] h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(252,219,232,0.5)]"
                  style={{ width: `${profile.skill_radar.delivery_confidence}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3 interactive-card group">
              <span className="text-[11px] font-mono uppercase text-neutral-400 group-hover:text-cyan-400 transition-colors">
                Cadence Stability
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white group-hover:scale-105 transition-transform">
                  {profile.skill_radar.cadence_stability}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  style={{ width: `${profile.skill_radar.cadence_stability}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3 interactive-card group">
              <span className="text-[11px] font-mono uppercase text-neutral-400 group-hover:text-amber-400 transition-colors">
                Fallacy Discipline
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white group-hover:scale-105 transition-transform">
                  {profile.skill_radar.fallacy_discipline}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  style={{ width: `${profile.skill_radar.fallacy_discipline}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3 interactive-card group">
              <span className="text-[11px] font-mono uppercase text-neutral-400 group-hover:text-indigo-400 transition-colors">
                POI Responsiveness
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white group-hover:scale-105 transition-transform">
                  {profile.skill_radar.responsiveness}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(129,140,248,0.5)]"
                  style={{ width: `${profile.skill_radar.responsiveness}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 14-Day Progression Timeline */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#fcdbe8]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Multi-Session Trajectory (14-Day Performance Window)
              </h2>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              Score progression across consecutive tournament matches
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800 flex flex-col gap-6">
            {profile.progression.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">
                <TrendingUp className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-sm">No progression data yet</p>
                <p className="text-xs mt-1">Complete your first debate to see your performance trajectory</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {profile.progression.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col gap-1.5"
                  >
                    <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                      {p.date}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-mono font-black text-[#fcdbe8]">
                        {p.overall_score}
                      </span>
                      <span className="text-[10px] text-neutral-500">pts</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 flex flex-col gap-0.5 pt-1 border-t border-neutral-800/80 font-mono">
                      <span>{p.wpm} WPM</span>
                      <span className="text-emerald-400">{p.filler_rate} fillers/min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 60-Second Practice Drills Completed */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#fcdbe8]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Targeted 60-Second Skill Drills
              </h2>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              Automated drills triggered by past debate weaknesses
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.recent_drills.length === 0 ? (
              <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-neutral-400">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No drills completed yet</p>
                <p className="text-xs mt-1">Record your first speech to unlock automated skill drills</p>
              </div>
            ) : (
              profile.recent_drills.map((drill) => (
                <div
                  key={drill.id}
                  className="p-5 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-[10px] font-mono font-bold uppercase text-[#fcdbe8]">
                        {drill.drill_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        {drill.duration_seconds}s Sprint
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                      <span>Score: {drill.score}/100</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-white leading-relaxed">
                      &ldquo;{drill.prompt_text}&rdquo;
                    </p>
                    {drill.triggering_weakness && (
                      <div className="p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-200/90">
                        <span className="font-bold text-amber-300">Triggering Match Weakness:</span>{" "}
                        {drill.triggering_weakness}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
                    <span className="font-bold text-[#fcdbe8]">Coach Feedback:</span> {drill.feedback}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Matches & Multi-Judge Persona Ballots */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#fcdbe8]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Tournament Match Log &bull; Multi-Judge Ballots
              </h2>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              Inspect Lay, Flow, and Technical judicial rulings
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Session Selector List */}
            <div className="lg:col-span-5 flex flex-col gap-2.5">
              {profile.recent_sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-neutral-900/50 border border-neutral-800 mb-4 flex items-center justify-center mx-auto">
                    <Scale className="w-8 h-8 text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-300">No sessions yet</h3>
                  <p className="text-neutral-500 text-sm mt-2">
                    Record your first debate to appear here. <Link href="/arena" className="text-[#fcdbe8] font-medium">Start a debate now</Link>
                  </p>
                </div>
              ) : (
                profile.recent_sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-2 ${
                      selectedSessionId === s.id
                        ? "bg-neutral-900 border-[#fcdbe8] shadow-lg shadow-black/40"
                        : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] font-mono font-bold uppercase text-neutral-300">
                        {s.format || "parliamentary"}
                      </span>
                      <span className="text-xs font-mono font-black text-[#fcdbe8]">
                        {s.overall_score ? `${s.overall_score} pts` : "Active"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {s.topic}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1">
                      <span>{s.date}</span>
                      <span className="text-neutral-500 capitalize">{s.difficulty}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Ballots Breakdown for Selected Session */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {loadingBallots ? (
                <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#fcdbe8] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessionBallots.length === 0 ? (
                <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-400">
                  Select a session to view the 3-judge persona rulings.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sessionBallots.map((b) => (
                    <div
                      key={b.id}
                      className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              b.persona === "flow"
                                ? "bg-cyan-950/50 text-cyan-300 border border-cyan-500/30"
                                : b.persona === "technical"
                                ? "bg-purple-950/50 text-purple-300 border border-purple-500/30"
                                : "bg-amber-950/50 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {b.persona} Judge
                          </span>
                          <span className="text-xs font-bold text-emerald-400">
                            Winner: {b.winner.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-xs font-mono font-bold text-neutral-300">
                          {b.user_score} &ndash; {b.opponent_score}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-mono uppercase font-bold text-neutral-400">
                          Reason for Decision (RFD)
                        </span>
                        <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                          {b.rfd}
                        </p>
                      </div>

                      {b.key_factors && b.key_factors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {b.key_factors.map((kf, kfIdx) => (
                            <span
                              key={kfIdx}
                              className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-300 border border-neutral-700"
                            >
                              &bull; {kf}
                            </span>
                          ))}
                        </div>
                      )}

                      {b.what_would_change_decision && (
                        <div className="p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 text-[11px] text-neutral-400">
                          <span className="font-bold text-[#fcdbe8]">What would change this ballot:</span>{" "}
                          {b.what_would_change_decision}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
