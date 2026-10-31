"use client";

import React from "react";
import { FillerWord } from "@/types/debate";
import { MessageSquareOff, CheckCircle2 } from "lucide-react";

interface FillerChipsProps {
  fillers: FillerWord[];
  fillerTotal: number;
}

export const FillerChips: React.FC<FillerChipsProps> = ({
  fillers,
  fillerTotal,
}) => {
  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-3xl bg-neutral-900/60 border border-neutral-800 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareOff className="w-4 h-4 text-[#fcdbe8]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Detected Filler Words
          </h4>
        </div>
        <span
          className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
            fillerTotal === 0
              ? "bg-[#fcdbe8] text-black"
              : fillerTotal <= 4
              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
              : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
          }`}
        >
          {fillerTotal} Total
        </span>
      </div>

      {fillers.length === 0 ? (
        <div className="flex items-center gap-2 py-1 text-xs text-neutral-300">
          <CheckCircle2 className="w-4 h-4 text-[#fcdbe8]" />
          <span>Zero fillers detected &mdash; authoritative cadence throughout.</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {fillers.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/90 border border-neutral-700 text-xs text-white"
            >
              <span className="font-semibold italic text-[#fcdbe8]">
                &ldquo;{f.word}&rdquo;
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-black text-[#fcdbe8] text-[10px] font-mono font-bold">
                &times;{f.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
