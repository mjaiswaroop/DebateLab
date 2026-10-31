"use client";

import React from "react";
import { Fallacy, FallacySeverity } from "@/types/debate";
import { AlertTriangle, CheckCircle, ShieldAlert, Wrench } from "lucide-react";

interface FallacyCardProps {
  fallacies: Fallacy[];
  verifiedCount?: number;
  totalCount?: number;
}

const severityBadges: Record<
  FallacySeverity,
  { label: string; bg: string; text: string; border: string }
> = {
  critical: {
    label: "Critical Fallacy",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    border: "border-rose-500/30",
  },
  moderate: {
    label: "Moderate Flaw",
    bg: "bg-amber-500/10",
    text: "text-amber-200",
    border: "border-amber-500/30",
  },
  minor: {
    label: "Minor Quibble",
    bg: "bg-neutral-800",
    text: "text-neutral-300",
    border: "border-neutral-700",
  },
};

export const FallacyCard: React.FC<FallacyCardProps> = ({
  fallacies,
  verifiedCount,
  totalCount,
}) => {
  const vCount = verifiedCount ?? fallacies.length;
  const tCount = totalCount ?? fallacies.length;

  if (fallacies.length === 0) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-3xl bg-neutral-900/60 border border-neutral-800 font-sans">
        <div className="p-2.5 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8] shrink-0">
          <CheckCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">
            Rigorous Logic &mdash; Zero Fallacies Flagged
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Your claims and premises held structural validity without informal fallacies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#fcdbe8]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Flagged Logical Fallacies ({fallacies.length})
          </h3>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 w-fit cursor-help"
          title="Quote matched against the transcript produced by the model."
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{vCount} of {tCount} flags verified</span>
        </div>

      </div>

      <div className="flex flex-col gap-3">
        {fallacies.map((f, idx) => {
          const badge = severityBadges[f.severity] || severityBadges.moderate;
          const formattedName = f.type
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

          return (
            <div
              key={idx}
              className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                  <span className="font-bold text-sm text-white tracking-tight">
                    {formattedName}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {badge.label}
                </span>
              </div>

              {/* Verbatim quote */}
              <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 text-xs italic text-[#fcdbe8] font-serif leading-relaxed">
                &ldquo;{f.quote}&rdquo;
              </div>

              {/* Explanation */}
              <p className="text-xs text-neutral-300 leading-relaxed">
                {f.explanation}
              </p>

              {/* Repair instruction */}
              <div className="flex items-start gap-2 pt-2 border-t border-neutral-800 text-xs text-neutral-200">
                <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#fcdbe8]" />
                <span className="leading-snug">
                  <strong className="text-[#fcdbe8]">Adjudicator Repair:</strong> {f.fix}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
