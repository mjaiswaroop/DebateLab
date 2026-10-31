"use client";

import React, { useState, useEffect } from "react";
import { X, Key, CheckCircle2, Sparkles, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { getStoredApiKey, saveGeminiApiKey, getGeminiConfigStatus, testGeminiApiKey } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (hasKey: boolean, verified?: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiKey();
      setApiKey(stored);
      getGeminiConfigStatus().then((res) => {
        setIsConfigured(res.gemini_configured);
        setIsVerified(Boolean(res.gemini_verified));
      });
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setStatusMessage({
        type: "error",
        text: "Please enter an API key to test.",
      });
      addToast("error", "Please enter an API key to test.");
      return;
    }
    if (
      trimmed === "your_gemini_api_key_here" ||
      trimmed === "placeholder" ||
      trimmed === "unset"
    ) {
      setStatusMessage({
        type: "error",
        text: "Placeholder API key detected. Please enter your real Gemini key.",
      });
      addToast("error", "Invalid API key - please check and try again");
      return;
    }

    setIsTesting(true);
    setStatusMessage({
      type: "info",
      text: "Testing API key connection to Gemini...",
    });

    try {
      const res = await testGeminiApiKey(trimmed);
      if (res.valid) {
        setIsConfigured(true);
        setIsVerified(true);
        onKeyUpdated?.(true, true);
        setStatusMessage({
          type: "success",
          text: `Success: API key verified with model ${res.model || "gemini"}.`,
        });
        addToast("success", "Gemini key tested & activated successfully");
      } else {
        // The key failed. The badge must not keep claiming it is active.
        const stillConfigured = Boolean(getStoredApiKey());
        setIsConfigured(stillConfigured);
        setIsVerified(false);
        onKeyUpdated?.(stillConfigured, false);
        setStatusMessage({
          type: "error",
          text: `Key verification failed: ${res.error || res.message}`,
        });
        addToast("error", "Invalid API key - please check and try again");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error testing key.";
      setStatusMessage({
        type: "error",
        text: errMsg,
      });
      addToast("error", "Invalid API key - please check and try again");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const trimmed = apiKey.trim().replace(/^["']|["']$/g, "").trim();
      const isPlaceholder =
        trimmed.toLowerCase() === "your_gemini_api_key_here" ||
        trimmed.toLowerCase() === "placeholder" ||
        trimmed.toLowerCase() === "unset";
      const keyToSave = isPlaceholder ? "" : trimmed;

      const res = await saveGeminiApiKey(keyToSave);

      if (!res.success) {
        // The backend rejected the key - show the real reason and do NOT
        // pretend the key is active.
        const stillConfigured = Boolean(getStoredApiKey());
        setIsConfigured(stillConfigured);
        setIsVerified(false);
        onKeyUpdated?.(stillConfigured, false);
        setStatusMessage({
          type: "error",
          text: res.message || "The backend rejected this API key.",
        });
        addToast("error", "Invalid API key - please check and try again");
        return;
      }

      const nowActive = Boolean(keyToSave);
      const nowVerified = nowActive && !res.degraded;
      setIsConfigured(nowActive);
      setIsVerified(nowVerified);
      setStatusMessage({
        type: res.degraded ? "info" : "success",
        text: keyToSave
          ? res.degraded
            ? res.message
            : "Gemini API key activated! Live multimodal AI is now active."
          : "API key cleared. System reverted to intelligent heuristic coach.",
      });
      if (keyToSave) {
        addToast("success", "Gemini key activated successfully");
      } else {
        addToast("info", "API key cleared - using local heuristic coach");
      }
      onKeyUpdated?.(nowActive, nowVerified);
      if (!res.degraded) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to activate API key.";
      setStatusMessage({
        type: "error",
        text: errMsg,
      });
      addToast("error", "Invalid API key - please check and try again");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#0a0a0a] border border-neutral-800 flex flex-col gap-5 relative shadow-2xl">
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
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-white">
              Gemini Live Setup
            </h3>
            <p className="text-xs text-neutral-400">
              Configure your Google Gemini API key for live multimodal adjudication
            </p>
          </div>
        </div>

        {/* Current Status Pill */}
        <div
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold ${
            isVerified
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
              : isConfigured
              ? "bg-amber-950/30 border-amber-500/30 text-amber-200"
              : "bg-amber-950/30 border-amber-500/30 text-amber-200"
          }`}
        >
          {isVerified ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Live Gemini connected and active</span>
            </>
          ) : isConfigured ? (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>API key set but not verified against Gemini - test it</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Using local heuristic adjudicator (add key for live AI)</span>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fcdbe8] transition-colors font-mono"
            />
            <div className="flex items-center justify-between pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#fcdbe8] hover:underline flex items-center gap-1"
              >
                <span>Get a free API key at Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setApiKey("")}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Clear key
                </button>
              )}
            </div>
          </div>

          {/* Privacy & Tier Disclosure */}
          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex gap-2.5 items-start text-[11px] leading-relaxed text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-[#fcdbe8] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-300">Privacy & Data Governance</p>
              <p>
                CrossEx never retains your audio recordings on disk. Under Google AI Studio terms: <span className="text-neutral-200">Free Tier</span> keys permit Google to sample prompts for model improvements; <span className="text-neutral-200">Paid Tier</span> keys are protected under commercial confidentiality and are not used for model training.
              </p>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : statusMessage.type === "error"
                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                  : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
              }`}
            >
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || isSaving || !apiKey.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fcdbe8]" />
              <span>{isTesting ? "Testing key..." : "Test Key"}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isTesting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fcdbe8] hover:bg-white text-black font-bold text-xs tracking-tight shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSaving ? "Activating..." : "Save & Activate"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
