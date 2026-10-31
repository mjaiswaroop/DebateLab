"use client";

import React, { useEffect, useState } from "react";
import { formatTime } from "@/lib/utils";
import { RecorderStatus } from "@/hooks/useRecorder";
import {
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  ArrowRight,
} from "lucide-react";

interface RecordControlProps {
  status: RecorderStatus;
  durationMs: number;
  maxDurationMs?: number;
  minDurationMs?: number;
  error: string | null;
  audioBlob?: Blob | null;
  onStart: () => void;
  onStop: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isSubmitting?: boolean;
}

export const RecordControl: React.FC<RecordControlProps> = ({
  status,
  durationMs,
  maxDurationMs = 120000,
  minDurationMs = 3000,
  error,
  audioBlob,
  onStart,
  onStop,
  onSubmit,
  onReset,
  isSubmitting = false,
}) => {
  const isRecording = status === "recording";
  const isStopped = status === "stopped";
  const progressPercent = Math.min(100, (durationMs / maxDurationMs) * 100);
  const isTooShort = durationMs < minDurationMs;

  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => setIsPlayingPreview(false);
      audio.onerror = () => setIsPlayingPreview(false);
      setPreviewAudio(audio);

      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewAudio(null);
      setIsPlayingPreview(false);
    }
  }, [audioBlob]);

  const togglePreview = () => {
    if (!previewAudio) return;
    if (isPlayingPreview) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudio.currentTime = 0;
      previewAudio.play().then(() => setIsPlayingPreview(true)).catch(() => {});
    }
  };

  const formattedPercent = Math.round(progressPercent);
  const totalDots = 5;
  const activeDots = Math.min(totalDots, Math.max(1, Math.round((progressPercent / 100) * totalDots)));
  const dotIndicator = "●".repeat(activeDots) + "○".repeat(Math.max(0, totalDots - activeDots));

  const isEvaluating = isSubmitting || status === "uploading";

  // Cycle through dynamic adjudication stages when analyzing speech
  const [adjudicationStage, setAdjudicationStage] = useState(0);
  const adjudicationStages = [
    { label: "Uploading audio payload to Gemini 2.5 Flash...", sub: "Lossless WebM audio stream ingested" },
    { label: "Extracting acoustic tone & hesitation metrics...", sub: "Pitch contour, cadence & filler words detection" },
    { label: "Evaluating premise validity & fallacy flags...", sub: "Auditing rhetorical soundness & warrant structure" },
    { label: "Synthesizing Chief Adjudicator scores & counter-rebuttal...", sub: "Calculating debate circuit score & feedback" },
  ];

  useEffect(() => {
    if (!isEvaluating) {
      setAdjudicationStage(0);
      return;
    }
    const interval = setInterval(() => {
      setAdjudicationStage((prev) => (prev + 1) % adjudicationStages.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isEvaluating, adjudicationStages.length]);

  return (
    <div className="flex flex-col gap-3.5 w-full font-sans">
      {/* Timer, Turn Progress & Duration Meter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-2xl font-black tracking-tight ${
              isRecording ? "text-[#fcdbe8]" : "text-white"
            }`}
          >
            {formatTime(durationMs)}
          </span>
          <span className="text-neutral-500 font-mono text-xs">/ 02:00</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/40 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold">
              <span className="tracking-widest text-[#fcdbe8]">{dotIndicator}</span>
              <span>{formattedPercent}%</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block ml-1" />
              <span className="text-[11px] uppercase tracking-wider text-rose-300">Recording...</span>
            </div>
          )}
          {isStopped && !isEvaluating && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#fcdbe8] font-bold bg-[#fcdbe8]/10 px-3 py-1 rounded-full border border-[#fcdbe8]/30">
                Captured ({(durationMs / 1000).toFixed(1)}s)
              </span>
              {previewAudio && (
                <button
                  type="button"
                  onClick={togglePreview}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors border border-neutral-700"
                >
                  {isPlayingPreview ? (
                    <>
                      <Pause className="w-3 h-3 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar with Min (3s) Marker & Percentage Fill */}
      {!isEvaluating && (
        <div className="flex flex-col gap-1">
          <div className="relative w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-100 ${
                progressPercent > 90
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-neutral-200 via-[#fcdbe8] to-white"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
            {/* Min 3s indicator line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#fcdbe8]"
              style={{ left: `${(minDurationMs / maxDurationMs) * 100}%` }}
              title="Minimum required duration (3s)"
            />
          </div>
          {isRecording && (
            <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono pt-0.5">
              <span>Speech Window Progress</span>
              <span className="font-bold text-[#fcdbe8]">{formattedPercent}% of 2 min</span>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE ADJUDICATION LOADING BAR & DYNAMIC STATUS */}
      {isEvaluating && (
        <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-black/60 border border-[#fcdbe8]/30 shadow-[0_8px_30px_rgba(252,219,232,0.08)] backdrop-blur-md animate-in fade-in duration-300">
          {/* Header indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fcdbe8] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#fcdbe8]"></span>
              </span>
              <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Adjudication Active</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#fcdbe8] font-mono font-semibold">
                  GEMINI 2.5
                </span>
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#fcdbe8] font-bold">
              Stage {adjudicationStage + 1}/4
            </div>
          </div>

          {/* Glowing Animated Loading Bar */}
          <div className="relative w-full h-2.5 bg-neutral-900/90 rounded-full overflow-hidden border border-white/10">
            {/* Pulsing Base Track */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#fcdbe8]/20 to-transparent animate-pulse" />
            
            {/* Indeterminate Shimmering Progress Bar */}
            <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-[#fcdbe8]/40 via-[#fcdbe8] to-white shadow-[0_0_15px_#fcdbe8] animate-[indeterminate-bar_1.6s_ease-in-out_infinite]" />
          </div>

          {/* Dynamic Adjudication Stage Text */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 text-[#fcdbe8] animate-spin shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-neutral-200 truncate">
                  {adjudicationStages[adjudicationStage].label}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono truncate">
                  {adjudicationStages[adjudicationStage].sub}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 shrink-0">Working...</span>
          </div>
        </div>
      )}

      {/* Action Buttons following strict button hierarchy */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
        {status === "idle" || status === "evaluated" || status === "error" ? (
          <div className="flex items-center gap-3 w-full">
            {/* Primary Button: #fcdbe8 bg, black text */}
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg sm:rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs sm:text-sm tracking-tight shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4 text-black" />
              <span>Deliver Speech (Microphone)</span>
              <ArrowRight className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        ) : isRecording ? (
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg sm:rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm tracking-tight shadow-lg transition-all animate-pulse cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop Recording ({formattedPercent}%)</span>
          </button>
        ) : isStopped ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Primary Button for Submit */}
            <button
              onClick={onSubmit}
              disabled={isEvaluating || isTooShort}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg sm:rounded-full bg-[#fcdbe8] hover:bg-white disabled:opacity-40 text-black font-bold text-xs sm:text-sm tracking-tight shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Processing Speech in Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Submit for Adjudication</span>
                  <ArrowRight className="w-3.5 h-3.5 text-black" />
                </>
              )}
            </button>
            {/* Ghost / Secondary Button for Reset */}
            <button
              onClick={onReset}
              disabled={isEvaluating}
              className="py-3 px-4 rounded-lg sm:rounded-full border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
              title="Discard & Re-record"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="sm:hidden">Reset</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Error Card per Requirement 7: colored red-900/20 card with AlertTriangle */}
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4 mt-1">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-400 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};
