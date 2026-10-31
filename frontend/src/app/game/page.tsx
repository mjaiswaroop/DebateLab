"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TextDebateArena } from "@/components/TextDebateArena";
import { ArrowLeft, Mic, Sparkles } from "lucide-react";

function GamePageContent() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white font-sans selection:bg-black selection:text-pink-200">
      {/* Header bar */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>

            <Link
              href="/"
              className="font-bold text-sm tracking-tight text-white hover:text-[#fcdbe8] transition-colors hidden sm:block"
            >
              crossex.debatelab.com
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Toggle to Voice Arena */}
            <Link
              href="/arena?mode=voice"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold tracking-tight transition-all"
            >
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>Switch to Speech Adjudicator</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <TextDebateArena />
      </main>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading Arena...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
