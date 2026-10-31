"use client";

import React, { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050811] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-rose-400">Application Notice</h2>
        <p className="text-xs text-slate-400">
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all"
        >
          Reload Interface
        </button>
      </div>
    </div>
  );
}
