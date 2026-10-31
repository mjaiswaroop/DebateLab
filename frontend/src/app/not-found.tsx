import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050811] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-4">
        <span className="text-4xl font-extrabold text-[#fcdbe8]">404</span>
        <h1 className="text-xl font-bold text-white">Page Not Found</h1>
        <p className="text-xs text-slate-400">
          The requested debate resource or adjudication report could not be found.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all mt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}
