"use client";

import React from "react";
import { PacingCategory } from "@/types/debate";
import { Gauge, CheckCircle2, AlertTriangle } from "lucide-react";

interface PacingBadgeProps {
  wpm: number;
  pacing?: PacingCategory;
  format?: string;
  targetWpmMin?: number;
  targetWpmMax?: number;
}

export const PacingBadge: React.FC<PacingBadgeProps> = ({
  wpm,
  pacing = "good",
  format = "parliamentary",
  targetWpmMin = 140,
  targetWpmMax = 180,
}) => {
  // Determine cadence evaluation relative to format's target WPM band
  const isOptimal = wpm >= targetWpmMin && wpm <= targetWpmMax;
  const isFast = wpm > targetWpmMax;
  const isSlow = wpm < targetWpmMin;

  const formatName =
    format === "policy"
      ? "Policy"
      : format === "lincoln_douglas"
      ? "Lincoln-Douglas"
      : format === "novice_spar"
      ? "Novice Spar"
      : "Parliamentary";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800 font-sans">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-full bg-neutral-800 border border-neutral-700 text-[#fcdbe8]">
          <Gauge className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black font-mono text-white tracking-tight">
              {wpm.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-400 font-mono">WPM</span>
            <span className="text-[11px] text-neutral-500 font-mono">
              (Target: {targetWpmMin}&ndash;{targetWpmMax} WPM)
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            {formatName} debate cadence standard
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <div
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight border ${
            isOptimal
              ? "bg-[#fcdbe8] text-black border-black font-bold"
              : isFast
              ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
              : "bg-neutral-800 text-neutral-300 border-neutral-700"
          }`}
        >
          {isOptimal ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
              <span>Optimal Format Cadence</span>
            </>
          ) : isFast ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <span>Slightly Fast for {formatName}</span>
            </>
          ) : (
            <>
              <Gauge className="w-3.5 h-3.5 text-neutral-400" />
              <span>Deliberate Cadence</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
