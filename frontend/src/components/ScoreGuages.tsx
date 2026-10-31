"use client";

import React from "react";

interface GaugeProps {
  score: number;
  label: string;
  sublabel: string;
  inverted?: boolean; // If true, lower is better (e.g., hesitation)
}

const CircularGauge: React.FC<GaugeProps> = ({
  score,
  label,
  sublabel,
  inverted = false,
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let strokeColor = "#fcdbe8"; // blush pink primary
  let glowColor = "rgba(252, 219, 232, 0.5)";
  let textColor = "text-[#fcdbe8]";

  if (!inverted) {
    if (clampedScore >= 75) {
      strokeColor = "#fcdbe8";
      glowColor = "rgba(252, 219, 232, 0.6)";
      textColor = "text-[#fcdbe8]";
    } else if (clampedScore >= 50) {
      strokeColor = "#ffffff";
      glowColor = "rgba(255, 255, 255, 0.4)";
      textColor = "text-white";
    } else {
      strokeColor = "#f59e0b";
      glowColor = "rgba(245, 158, 11, 0.4)";
      textColor = "text-amber-300";
    }
  } else {
    // Inverted: lower hesitation is good
    if (clampedScore <= 30) {
      strokeColor = "#fcdbe8";
      glowColor = "rgba(252, 219, 232, 0.6)";
      textColor = "text-[#fcdbe8]";
    } else if (clampedScore <= 60) {
      strokeColor = "#f59e0b";
      glowColor = "rgba(245, 158, 11, 0.4)";
      textColor = "text-amber-300";
    } else {
      strokeColor = "#ef4444";
      glowColor = "rgba(239, 68, 68, 0.4)";
      textColor = "text-rose-400";
    }
  }

  return (
    <div className="flex flex-col items-center p-5 rounded-3xl bg-neutral-900/60 border border-neutral-800 text-center relative group interactive-card hover:bg-neutral-900/90 cursor-default">
      <div className="relative w-28 h-28 flex items-center justify-center transform transition-transform duration-300 group-hover:scale-105">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="7"
            fill="transparent"
          />
          {/* Active Meter */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={strokeColor}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease",
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
          />
        </svg>

        {/* Center Number with glow pulse */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black font-mono tracking-tight transition-all duration-300 ${textColor} group-hover:scale-110`}>
            {clampedScore}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">/ 100</span>
        </div>
      </div>

      <h4 className="mt-2 text-xs sm:text-sm font-bold text-white tracking-tight transition-colors group-hover:text-[#fcdbe8]">
        {label}
      </h4>
      <p className="text-[11px] text-neutral-400 max-w-[140px] leading-snug mt-0.5">
        {sublabel}
      </p>
    </div>
  );
};

interface ScoreGuagesProps {
  confidence: number;
  soundness: number;
  hesitation: number;
  overallScore?: number | null;
}

export const ScoreGuages: React.FC<ScoreGuagesProps> = ({
  confidence,
  soundness,
  hesitation,
  overallScore,
}) => {
  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          Adjudication Metrics
        </h3>
        {overallScore !== undefined && overallScore !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fcdbe8]/10 border border-[#fcdbe8]/30 text-[#fcdbe8] text-xs font-bold tracking-tight">
            <span>Circuit Rating:</span>
            <span className="font-mono text-white">
              {overallScore.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CircularGauge
          score={confidence}
          label="Vocal Confidence"
          sublabel="Steadiness, assertiveness & acoustic certainty"
        />
        <CircularGauge
          score={soundness}
          label="Argument Soundness"
          sublabel="Premise relevance & substantive validity"
        />
        <CircularGauge
          score={hesitation}
          label="Hesitation Index"
          sublabel="Pauses, restarts & fillers (lower is better)"
          inverted
        />
      </div>

      <p className="text-[10px] text-neutral-500 italic text-center mt-0.5">
        Acoustic confidence &amp; hesitation are calibrated model estimates from audio delivery.
      </p>
    </div>
  );
};
