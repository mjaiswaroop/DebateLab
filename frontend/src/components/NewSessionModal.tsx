"use client";

import React, { useState } from "react";
import { X, Sparkles, BookOpen, Layers, Check, ArrowRight } from "lucide-react";

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topic: string, difficulty: "novice" | "intermediate" | "advanced", thesis?: string) => Promise<void>;
}

interface PresetMotion {
  tag: string;
  topic: string;
  thesis: string;
}

const PRESET_MOTIONS: PresetMotion[] = [
  {
    tag: "Technology",
    topic: "This House Would Ban Algorithmic Content Recommendation Feeds on Social Media Platforms",
    thesis: "Maximizing algorithmic attention retention creates structural incentives for societal polarization that cannot be resolved through market self-regulation.",
  },
  {
    tag: "Economy",
    topic: "Universal Basic Income is vital for post-automation labor markets",
    thesis: "Technological displacement of cognitive and physical labor necessitates decoupling subsistence from employment.",
  },
  {
    tag: "Climate",
    topic: "Direct carbon capture should take funding precedence over voluntary carbon credit markets",
    thesis: "Market-based offsets introduce systemic moral hazard without physically sequestering verified atmospheric carbon.",
  },
  {
    tag: "AI & Law",
    topic: "Generative AI fair-use exemptions must be curtailed for commercial copyrighted training data",
    thesis: "Uncompensated scraping of creative labor threatens the economic foundation of human authorship.",
  },
  {
    tag: "Security",
    topic: "Democratic states should establish a binding treaty prohibiting autonomous lethal weapon systems",
    thesis: "Delegating kill-chain decisions to automated algorithms eliminates moral accountability in warfare.",
  },
];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"novice" | "intermediate" | "advanced">("intermediate");
  const [thesis, setThesis] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (p: PresetMotion) => {
    setTopic(p.topic);
    setThesis(p.thesis);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg("Please enter or select a debate motion.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(topic.trim(), difficulty, thesis.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to initialize debate session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-[#0a0a0a] border border-neutral-800 flex flex-col gap-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white">
              Initialize Debate Session
            </h3>
            <p className="text-xs text-neutral-400">
              Configure parliamentary motion, circuit tier calibration, and proposition thesis
            </p>
          </div>
        </div>

        {/* Quick Presets Carousel/Grid */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Tournament Motion Presets (1-Click Fill)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_MOTIONS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  topic === preset.topic
                    ? "bg-[#fcdbe8]/10 border-[#fcdbe8] text-white"
                    : "bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black border border-neutral-800 text-[#fcdbe8]">
                    {preset.tag}
                  </span>
                  {topic === preset.topic && <Check className="w-3.5 h-3.5 text-[#fcdbe8]" />}
                </div>
                <p className="text-xs font-semibold line-clamp-2 mt-1 leading-snug">
                  {preset.topic}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Motion Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
              <span>Debate Motion / Proposition</span>
              <span className="text-[#fcdbe8] text-[10px] font-normal">*Required</span>
            </label>
            <textarea
              rows={2}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. This House Would Ban Algorithmic Content Recommendation Feeds..."
              className="px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] transition-colors resize-none leading-snug"
            />
          </div>

          {/* Difficulty Tier */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Adjudication Calibration Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["novice", "intermediate", "advanced"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDifficulty(tier)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold capitalize border transition-all ${
                    difficulty === tier
                      ? "bg-[#fcdbe8] border-[#fcdbe8] text-black shadow-md"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400 italic">
              {difficulty === "novice" && "Novice tier: Focuses on core clarity and delivery confidence."}
              {difficulty === "intermediate" && "Collegiate varsity: Scrutinizes warrants, mechanisms, and fallacies."}
              {difficulty === "advanced" && "National championship: Uncompromising scrutiny of comparative impact weighing."}
            </p>
          </div>

          {/* Opening Thesis */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Opening Stance / Proposition Thesis (Optional)
            </label>
            <textarea
              rows={2}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="State your opening claim or causal mechanism..."
              className="px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] resize-none transition-colors leading-snug"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !topic.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#fcdbe8] hover:bg-white disabled:opacity-40 text-black font-bold text-xs tracking-tight shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>{isSubmitting ? "Initializing Motion..." : "Launch Debate Session"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
