"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, User, Bot, RotateCcw, Volume2, VolumeX, CornerDownLeft, Key, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { sendChatMessage, getStoredApiKey, getGeminiConfigStatus, ApiError } from "@/lib/api";
import { useSpeech } from "@/hooks/useSpeech";
import { ApiKeyModal } from "@/components/ApiKeyModal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AdjudicatorChatProps {
  topic?: string | null;
  thesis?: string | null;
  currentTranscript?: string | null;
  fallacies?: Array<any>;
  rebuttalText?: string | null;
}

const suggestedPrompts = [
  "How do I repair the flagged fallacy in my speech?",
  "Spar: Challenge my core thesis with an opposition POI",
  "How can I dismantle the counter-rebuttal?",
  "Suggest a stronger empirical warrant for this motion",
];

export const AdjudicatorChat: React.FC<AdjudicatorChatProps> = ({
  topic,
  thesis,
  currentTranscript,
  fallacies,
  rebuttalText,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content:
        "Welcome to the Cross-Examination Chamber. I am your Chief Adjudicator. Ask me to cross-examine your premises, explain how to repair flagged fallacies, or test counter-arguments before your next speech.",
      timestamp: "Ready",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeModel, setActiveModel] = useState("");
  const [isKeyVerified, setIsKeyVerified] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { speak, stop } = useSpeech();

  const refreshConfigStatus = useCallback(() => {
    getGeminiConfigStatus()
      .then((status) => {
        // Trust the backend, not localStorage: it knows which keys Gemini has
        // actually rejected.
        setHasApiKey(status.gemini_configured);
        setIsKeyVerified(Boolean(status.gemini_verified));
        setActiveModel(status.active_model || status.model || "");
      })
      .catch(() => {
        // The badge is cosmetic - never break the chat over it.
      });
  }, []);

  useEffect(() => {
    refreshConfigStatus();
  }, [refreshConfigStatus]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = newHistory
        .filter((m) => m.id !== "initial")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChatMessage({
        messages: apiMessages,
        topic: topic || "General Parliamentary Debate",
        thesis: thesis || undefined,
        current_transcript: currentTranscript || undefined,
        fallacies: fallacies || undefined,
        rebuttal_text: rebuttalText || undefined,
      });

      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // The backend only marks a key "verified" once a live call has actually
      // succeeded, so refresh the badge now that we know it works. Otherwise
      // the header keeps saying "not verified" while the chat is live.
      refreshConfigStatus();

      if (ttsEnabled) {
        speak(res.reply);
      }
    } catch (err: unknown) {
      // A backend rejection (e.g. the live Gemini call failed) must be shown
      // verbatim - a canned reply would hide the reason and look like the
      // chatbot simply repeating itself.
      const isBackendError = err instanceof ApiError && err.status !== undefined;
      const fallbackReply = isBackendError
        ? `⚠️ ${err.message}`
        : generateFallbackReply(query, topic, thesis, fallacies);
      const fallbackMessage: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
      if (ttsEnabled) {
        speak(fallbackReply);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    stop();
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content:
          "Cross-examination reset. Submit your speech or ask any tactical question on parliamentary argumentation.",
        timestamp: "Ready",
      },
    ]);
  };

  return (
    <section className="w-full bg-[#0a0a0a] text-white rounded-3xl border border-neutral-800 p-6 sm:p-10 flex flex-col gap-8 shadow-2xl relative overflow-hidden font-sans">
      {/* Background ambient blush glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#fcdbe8]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 border-b border-neutral-800 pb-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Interactive Sparring Chamber
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#fcdbe8]" />
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:border-[#fcdbe8] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Key className="w-2.5 h-2.5 text-[#fcdbe8]" />
              <span>
                {hasApiKey
                  ? isKeyVerified
                    ? `${activeModel || "Gemini"}: Active`
                    : "Key set - not verified"
                  : "Connect Gemini Key"}
              </span>
            </button>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
            Chief Adjudicator <span className="text-[#fcdbe8]">Sparring.</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
            Socratic cross-examination calibrated to your latest speech. Test counter-arguments, resolve flagged fallacies, or spar with an uncompromising opposition debater.
          </p>
        </div>

        {/* Controls & Badges */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* TTS Audio Toggle */}
          <button
            onClick={() => {
              if (ttsEnabled) stop();
              setTtsEnabled(!ttsEnabled);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all cursor-pointer ${
              ttsEnabled
                ? "bg-[#fcdbe8] text-black shadow-md font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
            }`}
            title="Toggle spoken voice readback of adjudicator replies"
          >
            {ttsEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice Audio ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Voice Audio OFF</span>
              </>
            )}
          </button>

          {/* Reset Thread */}
          <button
            onClick={handleReset}
            className="p-2 rounded-full border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Reset Chat Transcript"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Tactical Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0 mr-1">
          Tactical Prompts:
        </span>
        {suggestedPrompts.map((promptText, i) => (
          <button
            key={i}
            onClick={() => handleSend(promptText)}
            disabled={isLoading}
            className="text-[11px] px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 whitespace-nowrap transition-all shrink-0 cursor-pointer disabled:opacity-40"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex flex-col gap-4 max-h-[460px] min-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 text-xs sm:text-sm leading-relaxed ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black tracking-tight ${
                  isUser
                    ? "bg-[#fcdbe8] text-black shadow-sm"
                    : "bg-black border border-neutral-700 text-[#fcdbe8]"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : "ADJ"}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-4 sm:p-5 rounded-3xl max-w-xl transition-all shadow-md ${
                  isUser
                    ? "bg-[#fcdbe8] text-black font-medium rounded-tr-sm"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isUser ? "text-black/70" : "text-[#fcdbe8]"
                    }`}
                  >
                    {isUser ? "Debater" : "Chief Adjudicator"}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      isUser ? "text-black/50" : "text-neutral-500"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-black border border-[#fcdbe8] text-[#fcdbe8] flex items-center justify-center shrink-0 text-xs font-black">
              ADJ
            </div>
            <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#fcdbe8] animate-bounce" />
              <span
                className="w-2 h-2 rounded-full bg-[#fcdbe8] animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#fcdbe8] animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="ml-2 font-mono text-[11px] text-neutral-400">
                Adjudicator formulating cross-examination...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Box */}
      <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question, spar on your thesis, or test a counter-argument..."
            disabled={isLoading}
            className="w-full py-3.5 pl-5 pr-12 rounded-full bg-neutral-900 border border-neutral-800 focus:border-[#fcdbe8] text-white text-xs sm:text-sm placeholder:text-neutral-600 outline-none transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#fcdbe8] hover:bg-white text-black disabled:opacity-30 disabled:hover:bg-[#fcdbe8] flex items-center justify-center transition-all cursor-pointer"
            title="Send Message (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Api Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={(active, verified) => {
          setHasApiKey(active);
          setIsKeyVerified(Boolean(verified));
        }}
      />
    </section>
  );
};

// Intelligent Fallback Logic Coach Response Generator
function generateFallbackReply(
  query: string,
  topic?: string | null,
  thesis?: string | null,
  fallacies?: Array<any>
): string {
  const q = query.toLowerCase();
  const debateTopic = topic || "the active debate motion";

  // 1. Direct spelling inquiries
  if (q.includes("spell")) {
    if (q.includes("mitocondria") || q.includes("mitochondria")) {
      return (
        "The correct spelling is **mitochondria** (singular: *mitochondrion*). " +
        "In cellular biology, they are the powerhouses generating adenosine triphosphate (ATP). " +
        "In biotechnology and bioethics debates, precision with scientific terminology significantly reinforces your ethos!"
      );
    }
    if (q.includes("parliament") || q.includes("parliment")) {
      return "The correct spelling is **parliament** (notice the 'ia' diphthong).";
    }
    if (q.includes("adjudicat")) {
      return "The correct spelling is **adjudicator** (ending in '-or').";
    }
    if (q.includes("fallacy") || q.includes("falacy")) {
      return "The correct spelling is **fallacy** (singular) or **fallacies** (plural).";
    }
    return `For rigorous debate notes in '${debateTopic}', ensure technical terms are verified. (You can connect a live Gemini API key in the chamber header for live dictionary lookups!)`;
  }

  // 2. Beginner & speaking delivery guidance
  if (
    q.includes("idk how to speak") ||
    q.includes("how to speak") ||
    q.includes("how do i speak") ||
    q.includes("how do i start") ||
    q.includes("help me speak") ||
    q.includes("speech tips") ||
    q.includes("beginner")
  ) {
    return (
      "Welcome to DebateLab! To deliver a structured, persuasive parliamentary speech, use the classic **P-E-E-L** framework:\n\n" +
      "1. **Point**: State your claim in one crisp, unequivocal sentence.\n" +
      "2. **Explanation**: Unpack the causal mechanism—why does incentive A produce outcome B?\n" +
      "3. **Evidence**: Ground the claim with empirical data, historical precedent, or economic reality.\n" +
      "4. **Link**: Connect directly back to why your outcome outweighs the opposition's harm.\n\n" +
      "Try clicking **'Start Recording Speech'** above to practice a 30-second opening turn, or ask me to spar on your motion!"
    );
  }

  if (["hi", "hello", "hey", "greetings", "yo"].includes(q.trim())) {
    return (
      `Greetings debater! I am your CrossEx Chief Adjudicator. We are evaluating '${debateTopic}'. ` +
      `Ask me to cross-examine your thesis, explain how to repair any flagged fallacies, or test a counter-argument before your next speech round.`
    );
  }

  // 3. Fallacy fixes
  if (q.includes("fallacy") || q.includes("fix") || q.includes("repair") || q.includes("flaw")) {
    if (fallacies && fallacies.length > 0) {
      const f = fallacies[0];
      const type = (f.type || "logical flaw").replace("_", " ");
      return (
        `To eliminate the flagged **${type}** in your quote \"${f.quote || ""}\": ` +
        `replace the broad assertion with a bounded mechanism. ${f.fix || "State the exact institutional conditions under which your premise holds."}`
      );
    }
    return `To fix informal fallacies in ${debateTopic}, avoid universal quantifier words like 'everyone knows' or 'inevitably'. Ground the claim with specific structural incentives.`;
  }

  // 4. Sparring & Points of Information
  if (q.includes("spar") || q.includes("poi") || q.includes("challenge") || q.includes("rebuttal")) {
    return (
      `Point of Information, speaker! If you assert that '${thesis || debateTopic}', ` +
      `how do you account for displacement effects where market actors simply route around the ban into unregulated shadow platforms? ` +
      `You have proven a flaw in the status quo, but haven't proven your alternative doesn't introduce even worse unintended consequences.`
    );
  }

  // 5. Warrants and mechanisms
  if (q.includes("warrant") || q.includes("premise") || q.includes("strengthen") || q.includes("mechanism")) {
    return (
      `In parliamentary debate on '${debateTopic}', a warrant is the bridge between your claim and the impact. ` +
      `Frame it around economic or political incentives: show why stakeholders have zero rational incentive to self-regulate without state enforcement.`
    );
  }

  // 6. Default responsive adjudication analysis
  return (
    `As your CrossEx adjudicator on '${debateTopic}', my evaluation hinges on comparative impacts: ` +
    `magnitude, probability, and timeframe. Frame your next speech around why the harms of the status quo are irreversible without your proposition.`
  );
}
