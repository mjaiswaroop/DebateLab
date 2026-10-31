"use client";

import React, { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  volumeLevel: number; // 0 to 1
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserNode,
  isRecording,
  volumeLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    if (!isRecording || !analyserNode) {
      // Draw smooth idle baseline
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(252, 219, 232, 0.2)";
      ctx.lineWidth = 2;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Create glowing blush pink and white gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.5, "#fcdbe8");
      gradient.addColorStop(1, "#ffffff");

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(252, 219, 232, 0.7)";
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isRecording]);

  return (
    <div className={`relative w-full rounded-3xl bg-neutral-900/60 border transition-all duration-300 p-5 overflow-hidden ${
      isRecording ? "border-[#fcdbe8]/40 shadow-[0_0_30px_rgba(252,219,232,0.12)]" : "border-neutral-800"
    }`}>
      {/* Dynamic ambient background glow */}
      {isRecording && (
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#fcdbe8]/10 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />
      )}

      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRecording
                ? "bg-rose-500 animate-ping"
                : "bg-neutral-600"
            }`}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
            {isRecording ? "Live Multimodal Audio Stream" : "Acoustic Stream Standby"}
          </span>

          {/* Equalizer animation when recording */}
          {isRecording && (
            <div className="flex items-end gap-0.5 h-4 ml-1">
              <span className="w-1 bg-[#fcdbe8] rounded-full animate-eq-1" />
              <span className="w-1 bg-[#fcdbe8] rounded-full animate-eq-2" />
              <span className="w-1 bg-[#fcdbe8] rounded-full animate-eq-3" />
              <span className="w-1 bg-[#fcdbe8] rounded-full animate-eq-4" />
              <span className="w-1 bg-[#fcdbe8] rounded-full animate-eq-5" />
            </div>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-medium">Mic Level:</span>
            <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
              <div
                className="h-full bg-gradient-to-r from-[#fcdbe8] to-white transition-all duration-75"
                style={{ width: `${Math.min(100, volumeLevel * 100 * 2.5)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="h-28 w-full relative z-10">
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-2xl bg-black/60 border border-neutral-800/80 shadow-inner"
        />
        {!isRecording && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#fcdbe8]/40 animate-pulse" />
              <span>Microphone standby &mdash; Click Deliver Speech to stream acoustics</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
