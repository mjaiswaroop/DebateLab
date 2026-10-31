"use client";

import React, { useState } from "react";
import { useSpeech } from "@/hooks/useSpeech";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  HelpCircle,
  Swords,
} from "lucide-react";

interface RebuttalPlayerProps {
  rebuttalText: string;
  socraticQuestion: string;
}

export const RebuttalPlayer: React.FC<RebuttalPlayerProps> = ({
  rebuttalText,
  socraticQuestion,
}) => {
  const {
    voices,
    selectedVoice,
    setSelectedVoice,
    isPlaying,
    isPaused,
    speak,
    pause,
    resume,
    stop,
  } = useSpeech();

  const [rate, setRate] = useState<number>(1.0);

  const handlePlayToggle = () => {
    if (isPlaying && !isPaused) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak(rebuttalText, rate);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 rounded-3xl bg-[#0a0a0a] border border-neutral-800 relative overflow-hidden font-sans">
      {/* Ambient Glow */}
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#fcdbe8]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with TTS Audio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8]">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white tracking-tight">
              Socratic Counter-Rebuttal
            </h3>
            <p className="text-[11px] text-neutral-400">
              Generated Opposition Speech &bull; Collegiate Rebuttal Persona
            </p>
          </div>
        </div>

        {/* TTS Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#fcdbe8] hover:bg-white text-black text-xs font-bold tracking-tight transition-all shadow-md cursor-pointer"
          >
            {isPlaying && !isPaused ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Audio</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Listen Spoken Speech</span>
              </>
            )}
          </button>

          {isPlaying && (
            <button
              onClick={stop}
              className="p-2 rounded-full border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Stop Speech"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Rebuttal Text Body */}
      <div className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-normal bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800">
        &ldquo;{rebuttalText}&rdquo;
      </div>

      {/* Socratic Cross-Examination Prompt */}
      {socraticQuestion && (
        <div className="p-4 rounded-2xl bg-black border border-[#fcdbe8]/30 flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-[#fcdbe8]/10 text-[#fcdbe8] shrink-0 mt-0.5">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#fcdbe8]">
              Adjudicator Socratic Cross-Examination:
            </span>
            <p className="text-xs sm:text-sm text-white font-serif italic leading-relaxed">
              &ldquo;{socraticQuestion}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
