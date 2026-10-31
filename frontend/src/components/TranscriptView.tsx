"use client";

import React, { useState } from "react";
import { DeliveryAnalysis, Fallacy, LogicAnalysis, MeasuredPause } from "@/types/debate";
import {
  FileText,
  Target,
  ListTree,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  X,
  Volume2,
} from "lucide-react";

interface TranscriptViewProps {
  transcript: string;
  logic: LogicAnalysis;
  delivery?: DeliveryAnalysis;
  pauses?: MeasuredPause[];
  durationMs?: number;
  verifiedCount?: number;
  totalCount?: number;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  logic,
  delivery,
  pauses = [],
  durationMs = 60000,
  verifiedCount,
  totalCount,
}) => {
  const [selectedFallacy, setSelectedFallacy] = useState<Fallacy | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "fallacies" | "pauses">("all");

  const vCount = verifiedCount ?? (logic.fallacies ? logic.fallacies.length : 0);
  const tCount = totalCount ?? (logic.fallacies ? logic.fallacies.length : 0);

  const renderAnnotatedTranscript = () => {
    if (!transcript) return null;

    // Tokenize text into words with character offsets
    interface WordToken {
      word: string;
      start: number;
      end: number;
      fallacy?: Fallacy;
      isFiller?: boolean;
    }

    const words: WordToken[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(transcript)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    if (words.length === 0) {
      return <span>{transcript}</span>;
    }

    // Map fallacies to character ranges (using start_char/end_char or quote search)
    const fallacySpans: { start: number; end: number; fallacy: Fallacy }[] = [];
    const lowerTranscript = transcript.toLowerCase();

    for (const f of logic.fallacies || []) {
      if (f.start_char != null && f.end_char != null && f.end_char > f.start_char) {
        fallacySpans.push({ start: f.start_char, end: f.end_char, fallacy: f });
      } else if (f.quote && f.quote.trim().length > 2) {
        const qLower = f.quote.trim().toLowerCase();
        let idx = lowerTranscript.indexOf(qLower);
        if (idx !== -1) {
          fallacySpans.push({ start: idx, end: idx + qLower.length, fallacy: f });
        }
      }
    }

    // Filler word matcher
    const fillerWordsSet = new Set(
      (delivery?.filler_words || [])
        .map((f) => f.word.toLowerCase())
        .concat(["um", "uh", "er", "ah", "like", "you know"])
    );

    // Tag words
    words.forEach((w) => {
      const cleanWord = w.word.toLowerCase().replace(/[^a-z]/g, "");
      if (fillerWordsSet.has(cleanWord)) {
        w.isFiller = true;
      }
      for (const fs of fallacySpans) {
        if (w.start >= fs.start && w.end <= fs.end + 2) {
          w.fallacy = fs.fallacy;
          break;
        }
      }
    });

    // Map measured pauses to word-proportional insertion indices
    const totalRecordedMs = Math.max(1000, durationMs);
    const pauseInsertions: { wordIndex: number; pause: MeasuredPause }[] = [];

    if (pauses && pauses.length > 0 && filterMode !== "fallacies") {
      pauses.forEach((p) => {
        // Find closest word by temporal ratio
        const ratio = Math.max(0, Math.min(1, p.start_ms / totalRecordedMs));
        const targetWordIdx = Math.min(
          words.length - 1,
          Math.max(0, Math.floor(ratio * words.length))
        );
        pauseInsertions.push({ wordIndex: targetWordIdx, pause: p });
      });
    }

    // Group pauses by wordIndex
    const pausesAtWord: Record<number, MeasuredPause[]> = {};
    pauseInsertions.forEach((pi) => {
      if (!pausesAtWord[pi.wordIndex]) pausesAtWord[pi.wordIndex] = [];
      pausesAtWord[pi.wordIndex].push(pi.pause);
    });

    // Render word stream with inline badges
    const elements: React.ReactNode[] = [];

    words.forEach((w, idx) => {
      // Check for pause badge before this word
      if (pausesAtWord[idx]) {
        pausesAtWord[idx].forEach((p, pIdx) => {
          elements.push(
            <span
              key={`pause-${idx}-${pIdx}`}
              title={`Measured client-side silence via Web Audio AnalyserNode: ${(p.duration_ms / 1000).toFixed(1)}s (at ~${(p.start_ms / 1000).toFixed(1)}s into speech)`}
              className="inline-flex items-center gap-1 mx-1.5 my-0.5 px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold select-none cursor-help hover:border-cyan-400 transition-colors"
            >
              <Clock className="w-2.5 h-2.5 text-cyan-400" />
              <span>[Approx. Pause {(p.duration_ms / 1000).toFixed(1)}s]</span>
            </span>
          );
        });
      }

      // Check if word is part of a fallacy
      if (w.fallacy && filterMode !== "pauses") {
        elements.push(
          <span
            key={`word-${idx}`}
            onClick={() => setSelectedFallacy(w.fallacy!)}
            className="cursor-pointer bg-[#fcdbe8] text-black font-semibold px-1 py-0.5 rounded mx-0.5 hover:bg-white hover:shadow-md transition-all inline-block"
            title="Click to view fallacy diagnosis & adjudicator repair"
          >
            {w.word}
          </span>
        );
      } else if (w.isFiller && filterMode === "all") {
        elements.push(
          <span
            key={`word-${idx}`}
            title="Hesitation filler token detected"
            className="bg-amber-950/60 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded mx-0.5 text-xs font-mono inline-block"
          >
            {w.word}
          </span>
        );
      } else {
        elements.push(
          <span key={`word-${idx}`}>
            {w.word}{" "}
          </span>
        );
      }
    });

    return elements;
  };

  return (
    <div className="flex flex-col gap-5 p-6 rounded-3xl bg-[#0a0a0a] border border-neutral-800 font-sans">
      {/* Transcript Header with Verification Counter & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#fcdbe8]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300">
            Interactive Annotated Transcript
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quote Verification Pill */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 cursor-help"
            title="Quote matched against the transcript produced by the model."
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {vCount} of {tCount} flags verified
            </span>
          </div>


          {/* Measured Pauses Pill */}
          {pauses.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/40 text-[11px] font-semibold text-cyan-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{pauses.length} measured pauses (&gt;0.8s)</span>
            </div>
          )}

          {/* Display Filter Toggle */}
          <div className="flex items-center p-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                filterMode === "all" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("fallacies")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                filterMode === "fallacies" ? "bg-[#fcdbe8] text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              Fallacies
            </button>
            <button
              onClick={() => setFilterMode("pauses")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                filterMode === "pauses" ? "bg-cyan-400 text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              Pauses
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Text Deck */}
      <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-sm text-neutral-200 leading-relaxed font-mono selection:bg-[#fcdbe8] selection:text-black">
        {renderAnnotatedTranscript()}
      </div>

      {/* Fallacy Inspection Drawer Modal */}
      {selectedFallacy && (
        <div className="p-5 rounded-2xl bg-neutral-950 border border-[#fcdbe8]/40 shadow-xl flex flex-col gap-3 relative animate-in fade-in duration-150">
          <button
            onClick={() => setSelectedFallacy(null)}
            className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <h4 className="text-sm font-bold text-white tracking-tight uppercase">
              {selectedFallacy.type.replace(/_/g, " ")}
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Verified Quote
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black border border-neutral-800 text-xs italic text-[#fcdbe8] font-serif">
            &ldquo;{selectedFallacy.quote}&rdquo;
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            {selectedFallacy.explanation}
          </p>

          <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start gap-2.5 text-xs text-neutral-200">
            <Wrench className="w-4 h-4 text-[#fcdbe8] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#fcdbe8]">Adjudicator Repair: </span>
              {selectedFallacy.fix}
            </div>
          </div>
        </div>
      )}

      {/* Logic Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Central Claim & Premises */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#fcdbe8]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Core Claim &amp; Premises
            </h4>
          </div>

          {logic.claim_summary && (
            <p className="text-xs text-neutral-300 font-medium italic border-l-2 border-[#fcdbe8] pl-2.5">
              &ldquo;{logic.claim_summary}&rdquo;
            </p>
          )}

          {logic.premises && logic.premises.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                Underlying Premises:
              </span>
              <ul className="flex flex-col gap-1.5 text-xs text-neutral-300">
                {logic.premises.map((p, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-[#fcdbe8] border border-neutral-700 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Strongest & Weakest Points */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center gap-2">
            <ListTree className="w-4 h-4 text-[#fcdbe8]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Adjudicator Clash Analysis
            </h4>
          </div>

          {logic.strongest_point && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#fcdbe8]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Strongest Point:</span>
              </div>
              <p className="text-xs text-neutral-300 leading-snug pl-5">
                {logic.strongest_point}
              </p>
            </div>
          )}

          {logic.weakest_point && (
            <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Weakest Point:</span>
              </div>
              <p className="text-xs text-neutral-300 leading-snug pl-5">
                {logic.weakest_point}
              </p>
            </div>
          )}

          {logic.unaddressed_counterarguments && logic.unaddressed_counterarguments.length > 0 && (
            <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Vulnerable Flank:</span>
              </div>
              <p className="text-xs text-neutral-300 leading-snug pl-5">
                {logic.unaddressed_counterarguments[0]}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
