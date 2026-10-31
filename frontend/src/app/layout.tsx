import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "CrossEx — AI Collegiate Debate Adjudicator & Speech Coach",
  description:
    "Multimodal debate speech adjudicator powered by Google Gemini. Analyze delivery confidence, hesitations, filler words, premise validity, logical fallacies, and counter-rebuttals in real time.",
  keywords: [
    "debate coaching",
    "speech adjudication",
    "parliamentary debate",
    "logical fallacies",
    "vocal delivery",
    "Gemini",
    "speech analysis",
  ],
  authors: [{ name: "CrossEx DebateLab" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased selection:bg-pink-500/30 selection:text-pink-200">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
