"use client";

import React from "react";
import { FixedFallacyItem, RedoDelta, TurnResponse } from "@/types/debate";
import {
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Flame,
  X,
  ArrowUp,
  ArrowDown,
  Info,
  BookOpen,
} from "lucide-react";

interface RedoCompareCardProps {
  currentTurn: TurnResponse;
  redoDelta?: RedoDelta | null;
  onStartRedo: () => void;
  isRedoActive?: boolean;
  onCancelRedo?: () => void;
}

export const RedoCompareCard: React.FC<RedoCompareCardProps> = ({
  currentTurn,
  redoDelta,
  onStartRedo,
  isRedoActive = false,
  onCancelRedo,
}) => {
  const delta = redoDelta || currentTurn.redo_delta;
  const isRedoAttempt = (currentTurn.attempt_number && currentTurn.attempt_number > 1) || Boolean(delta);

  const currentAttempt = currentTurn.attempt_number || delta?.attempt_number || 1;
  const nextAttempt = currentAttempt + 1;

  // Extract delta numbers
  const soundnessDelta = delta?.soundness_delta ?? delta?.argument_score_delta;
  const soundnessBefore = delta?.soundness_before;
  const soundnessAfter = delta?.soundness_after ?? currentTurn.logic?.argument_score;

  const fillerDelta = delta?.filler_delta ?? delta?.filler_count_delta;
  const fillerBefore = delta?.filler_before;
  const fillerAfter = delta?.filler_after ?? currentTurn.delivery?.filler_total;

  const wpmDelta = delta?.wpm_delta;
  const wpmBefore = delta?.wpm_before;
  const wpmAfter = delta?.wpm_after ?? currentTurn.delivery?.words_per_minute;

  const warrantsAdded = delta?.warrants_added ?? 0;
  const isDemo = delta?.is_demo || delta?.delta_available === false;

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* 1. Redo Action Callout / Active Redo Banner */}
      {isRedoActive ? (
        <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900 border-2 border-[#fcdbe8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-full bg-[#fcdbe8] text-black shrink-0 animate-pulse">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#fcdbe8]">
                  Redo Mode Active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black text-[#fcdbe8] border border-[#fcdbe8]/40 text-[10px] font-mono font-bold">
                  Attempt #{nextAttempt}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5">
                Revise your argument addressing the adjudicator&apos;s critique. We will compute the exact before/after delta.
              </p>
            </div>
          </div>

          {onCancelRedo && (
            <button
              onClick={onCancelRedo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold self-start sm:self-auto cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Redo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-full bg-neutral-800 border border-neutral-700 text-[#fcdbe8] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Turn Critique Received &bull; Ready to Improve?
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Execute a <strong>Redo</strong> of this turn to eliminate flagged fallacies and substantiate premises.
              </p>
            </div>
          </div>

          <button
            onClick={onStartRedo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs tracking-tight shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Redo This Speech (Attempt #{nextAttempt})</span>
          </button>
        </div>
      )}

      {/* 2. Before / After Delta Display Card (if turn is a redo result) */}
      {isRedoAttempt && delta && (
        <div className="p-6 rounded-3xl bg-black border border-emerald-500/40 shadow-2xl flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>Redo &amp; Compare &bull; Attempt #{currentAttempt}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    Delta Computed
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Direct delta measurements against Attempt #{delta.parent_attempt_number || (currentAttempt - 1)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400">
                Attempt #{delta.parent_attempt_number || (currentAttempt - 1)} &rarr; Attempt #{currentAttempt}
              </span>
            </div>
          </div>

          {/* Demo Mode Explanation Banner if scores are null */}
          {isDemo ? (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider block text-amber-300">
                  Demo Mode Redo: Numerical Delta Hidden
                </span>
                <p className="mt-1 text-neutral-300 leading-relaxed">
                  {delta.explanation ||
                    "Quantitative score delta is hidden in Demo Mode (scores are null without API key). Connect your Gemini API key in the top bar to activate live scoring, WPM tracking, and delta measurements."}
                </p>
              </div>
            </div>
          ) : (
            /* 4-Stat Metric Delta Grid with Before / After and Green / Red Arrows */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Soundness Delta */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase font-bold text-neutral-400">
                  Soundness Delta
                </span>
                <div className="flex items-center gap-2">
                  {soundnessDelta !== undefined && soundnessDelta !== null && (
                    <span
                      className={`flex items-center gap-0.5 text-2xl font-black font-mono ${
                        soundnessDelta >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {soundnessDelta >= 0 ? (
                        <ArrowUp className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-5 h-5 text-rose-400" />
                      )}
                      {soundnessDelta >= 0 ? `+${soundnessDelta}` : soundnessDelta}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500">pts</span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {soundnessBefore !== undefined && soundnessBefore !== null ? (
                    <span>
                      {soundnessBefore} &rarr; <strong className="text-white">{soundnessAfter}</strong>
                    </span>
                  ) : (
                    <span>Current: {soundnessAfter}/100</span>
                  )}
                </div>
              </div>

              {/* Filler Reduction Delta */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase font-bold text-neutral-400">
                  Filler Words
                </span>
                <div className="flex items-center gap-2">
                  {fillerDelta !== undefined && fillerDelta !== null && (
                    <span
                      className={`flex items-center gap-0.5 text-2xl font-black font-mono ${
                        fillerDelta < 0
                          ? "text-emerald-400"
                          : fillerDelta > 0
                          ? "text-rose-400"
                          : "text-neutral-200"
                      }`}
                    >
                      {fillerDelta < 0 ? (
                        <ArrowDown className="w-5 h-5 text-emerald-400" />
                      ) : fillerDelta > 0 ? (
                        <ArrowUp className="w-5 h-5 text-rose-400" />
                      ) : null}
                      {fillerDelta <= 0 ? `${fillerDelta}` : `+${fillerDelta}`}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500">words</span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {fillerBefore !== undefined && fillerBefore !== null ? (
                    <span>
                      {fillerBefore} &rarr; <strong className="text-white">{fillerAfter}</strong>
                    </span>
                  ) : (
                    <span>Current: {fillerAfter} fillers</span>
                  )}
                </div>
              </div>

              {/* WPM Cadence (Neutral comparative against target band, no up/down arrows) */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase font-bold text-neutral-400">
                  Pacing (WPM)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black font-mono text-neutral-200">
                    {wpmAfter ?? "--"}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {wpmDelta !== undefined && wpmDelta !== null && (
                      <span>({wpmDelta >= 0 ? `+${wpmDelta}` : wpmDelta})</span>
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300">
                    Target: 140&ndash;180 WPM
                  </span>
                </div>
              </div>

              {/* Premises Identified (before -> after) */}
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase font-bold text-neutral-400">
                  Premises Identified (before &rarr; after)
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-2xl font-black font-mono text-emerald-400">
                    {(delta.premises_before ?? 0)} &rarr; {(delta.premises_after ?? currentTurn.logic?.premises?.length ?? warrantsAdded)}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  <span>
                    {(delta.premises_delta !== undefined && delta.premises_delta !== null)
                      ? (delta.premises_delta >= 0 ? `+${delta.premises_delta} premises identified` : `${delta.premises_delta} premises identified`)
                      : "Substantiated mechanisms"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Fallacy Repair Accomplishment Box */}
          {delta.fallacies_fixed && delta.fallacies_fixed.length > 0 ? (
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {delta.fallacies_fixed_count || delta.fallacies_fixed.length} Fallacy Flaw(s) Eliminated on Redo:
                </span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {delta.fallacies_fixed.map((f, idx) => {
                  const isObj = typeof f === "object" && f !== null;
                  const type = isObj ? (f as FixedFallacyItem).type : (f as string);
                  const quote = isObj ? (f as FixedFallacyItem).quote : null;
                  const fix = isObj ? (f as FixedFallacyItem).fix : null;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-100 flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2 font-bold text-emerald-300">
                        <span>&check; Fixed: {type.replace(/_/g, " ")}</span>
                      </div>
                      {quote && (
                        <p className="text-[11px] text-neutral-400 italic">
                          Prior quote eliminated: &ldquo;{quote}&rdquo;
                        </p>
                      )}
                      {fix && (
                        <p className="text-[11px] text-emerald-200/80">
                          Repair applied: {fix}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#fcdbe8]" />
              <span>Logic structure preserved without new fallacy introduction.</span>
            </div>
          )}

          {/* Fallacies Still Flagged or Reworded */}
          {delta.fallacies_still_flagged && delta.fallacies_still_flagged.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {delta.fallacies_still_flagged.length} Fallacy Flag(s) Persisting on Redo:
                </span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {delta.fallacies_still_flagged.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-100 flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <span className="px-2 py-0.5 rounded-full bg-amber-900/60 text-[10px] uppercase border border-amber-500/30">
                        {f.status}
                      </span>
                      <span>{f.type.replace(/_/g, " ")}</span>
                    </div>
                    {f.original_quote && f.new_quote && f.original_quote !== f.new_quote ? (
                      <p className="text-[11px] text-neutral-300">
                        Wording changed from &ldquo;{f.original_quote}&rdquo; to &ldquo;{f.new_quote}&rdquo;, but the same fallacy type is still flagged.
                      </p>
                    ) : f.original_quote ? (
                      <p className="text-[11px] text-neutral-300">
                        Quote still flagged: &ldquo;{f.original_quote}&rdquo;
                      </p>
                    ) : null}
                    {f.explanation && (
                      <p className="text-[11px] text-amber-200/80">
                        {f.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
