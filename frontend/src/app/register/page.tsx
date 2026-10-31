"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AnimatedText } from "@/components/AnimatedText";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8001/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        setIsSubmitting(false);
        const data = await res.json();
        const msg = data.detail || "Registration failed";
        setError(msg);
        addToast("error", msg);
        return;
      }
      // Auto-login after registration
      const loginRes = await fetch("http://localhost:8001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setIsSubmitting(false);
      if (!loginRes.ok) {
        setError("Registered but login failed. Please log in manually.");
        addToast("info", "Account created! Please sign in manually.");
        return;
      }
      const data = await loginRes.json();
      localStorage.setItem("access_token", data.access_token);
      addToast("success", "Account created and signed in!");
      window.location.href = "/";
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err.message || "Registration failed";
      setError(msg);
      addToast("error", msg);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050811] text-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#fcdbe8] flex items-center justify-center text-black font-bold text-xl mx-auto mb-4 shadow-lg shadow-[#fcdbe8]/20">
            CX
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">Create account</h1>
          <p className="text-sm text-neutral-400 max-w-md mt-1">
            <AnimatedText
              text="Join Debate Lab to track your debate sessions and collegiate speech progress."
              delayMs={200}
              staggerMs={25}
            />
          </p>
        </div>

        {/* Enhanced Error Card */}
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-400 text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {isSubmitting ? (
          <div className="flex flex-col gap-4 p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 animate-pulse">
            <div className="h-4 bg-neutral-800 rounded w-1/3" />
            <div className="h-10 bg-neutral-800/60 rounded w-full" />
            <div className="h-4 bg-neutral-800 rounded w-1/4" />
            <div className="h-10 bg-neutral-800/60 rounded w-full" />
            <div className="h-4 bg-neutral-800 rounded w-1/4" />
            <div className="h-10 bg-neutral-800/60 rounded w-full" />
            <div className="h-12 bg-neutral-800 rounded w-full mt-2" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold tracking-tight text-white/80 mb-1.5 uppercase">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-neutral-700 text-white focus:border-[#fcdbe8] focus:outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-tight text-white/80 mb-1.5 uppercase">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-neutral-700 text-white focus:border-[#fcdbe8] focus:outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-tight text-white/80 mb-1.5 uppercase">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-neutral-700 text-white focus:border-[#fcdbe8] focus:outline-none transition-colors text-sm"
              />
            </div>

            {/* Primary button style: #fcdbe8 bg, black text */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 rounded-lg bg-[#fcdbe8] text-black font-bold hover:bg-white transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-50 text-sm cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#fcdbe8]/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Creating account...</span>
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-2">
          <span>Already have an account?</span>
          <Link
            href="/login"
            className="py-2 px-4 rounded-lg bg-transparent border border-neutral-700 hover:border-[#fcdbe8] text-white font-bold transition-all text-xs hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
