"use client";

import React from "react";
import { Lightbulb, Mic } from "lucide-react";

interface CoachingTipsProps {
  tips: string[];
  vocalObservations?: string[];
}

export const CoachingTips: React.FC<CoachingTipsProps> = ({
  tips,
  vocalObservations = [],
}) => {
  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Prioritized Coaching Tips */}
      <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-neutral-800 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Adjudicator Coaching Directives
          </h3>
        </div>

        <div className="flex flex-col gap-2.5">
          {tips.map((tip, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800"
            >
              <span className="w-5 h-5 rounded-full bg-black text-[#fcdbe8] border border-[#fcdbe8]/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 font-mono">
                {idx + 1}
              </span>
              <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                {tip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Acoustic Vocal Observations */}
      {vocalObservations.length > 0 && (
        <div className="p-5 rounded-3xl bg-neutral-900/50 border border-neutral-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-[#fcdbe8]" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              Vocal Delivery Signals
            </h4>
          </div>
          <ul className="flex flex-col gap-2 pl-4 list-disc text-xs text-neutral-300">
            {vocalObservations.map((obs, idx) => (
              <li key={idx} className="leading-snug">
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
