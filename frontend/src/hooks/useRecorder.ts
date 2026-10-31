"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopped"
  | "uploading"
  | "evaluated"
  | "error";

export interface MeasuredPause {
  start_ms: number;
  duration_ms: number;
}

interface UseRecorderOptions {
  maxDurationMs?: number; // default 120,000 (120s)
  minDurationMs?: number; // default 3,000 (3s)
  onAutoStop?: (blob: Blob, durationMs: number) => void;
}

export function useRecorder(options: UseRecorderOptions = {}) {
  const { maxDurationMs = 120000, minDurationMs = 3000, onAutoStop } = options;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // 0 to 1
  const [pauses, setPauses] = useState<MeasuredPause[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerFrameRef = useRef<number | null>(null);
  const pausesRef = useRef<MeasuredPause[]>([]);
  const silenceStartRef = useRef<number | null>(null);

  // Helper to fully release hardware resources
  const cleanupStream = useCallback(() => {
    if (timerFrameRef.current) {
      cancelAnimationFrame(timerFrameRef.current);
      timerFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setDurationMs(0);
      setPauses([]);
      pausesRef.current = [];
      silenceStartRef.current = null;
      setStatus("requesting_permission");

      // Verify browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      // MIME type negotiation
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];
      let selectedMimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        selectedMimeType =
          preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup Web Audio AnalyserNode for live visualization & pause detection
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Handle suspended audio context (Safari requirement)
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Setup MediaRecorder
      const options: MediaRecorderOptions = selectedMimeType
        ? { mimeType: selectedMimeType }
        : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalDuration = Math.round(performance.now() - startTimeRef.current);
        const mime = recorder.mimeType || selectedMimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });

        // Capture trailing pause if user stopped after a silence window
        if (silenceStartRef.current !== null) {
          const pauseDuration = finalDuration - silenceStartRef.current;
          if (pauseDuration >= 800 && pauseDuration < 4000) {
            pausesRef.current.push({
              start_ms: Math.round(silenceStartRef.current),
              duration_ms: Math.round(pauseDuration),
            });
          }
          silenceStartRef.current = null;
        }

        setPauses([...pausesRef.current]);
        setAudioBlob(blob);
        setDurationMs(finalDuration);
        setStatus("stopped");
        cleanupStream();
      };

      // Start recording with 1-second chunks for memory buffering
      startTimeRef.current = performance.now();
      recorder.start(1000);
      setStatus("recording");

      // High precision timer loop using performance.now()
      const updateTimer = () => {
        const elapsed = performance.now() - startTimeRef.current;
        setDurationMs(elapsed);

        // Compute volume level for meter and detect pauses
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalizedEnergy = Math.min(1, avg / 128);
          setVolumeLevel(normalizedEnergy);

          // Measured pause detection via Web Audio AnalyserNode energy threshold:
          // Silence threshold at 0.04 RMS/energy; duration > 800ms counts as a measured debate pause.
          const SILENCE_THRESHOLD = 0.04;
          if (normalizedEnergy < SILENCE_THRESHOLD) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = elapsed;
            }
          } else {
            if (silenceStartRef.current !== null) {
              const pauseDuration = elapsed - silenceStartRef.current;
              if (pauseDuration >= 800) {
                pausesRef.current.push({
                  start_ms: Math.round(silenceStartRef.current),
                  duration_ms: Math.round(pauseDuration),
                });
              }
              silenceStartRef.current = null;
            }
          }
        }

        if (elapsed >= maxDurationMs) {
          if (recorder.state === "recording") {
            recorder.stop();
            if (onAutoStop && chunksRef.current.length) {
              const blob = new Blob(chunksRef.current, {
                type: recorder.mimeType || "audio/webm",
              });
              onAutoStop(blob, elapsed);
            }
          }
        } else {
          timerFrameRef.current = requestAnimationFrame(updateTimer);
        }
      };

      timerFrameRef.current = requestAnimationFrame(updateTimer);
    } catch (err: unknown) {
      cleanupStream();
      setStatus("error");
      const errMessage =
        err instanceof Error
          ? err.message
          : "Could not access microphone. Please check permissions.";
      setError(errMessage);
    }
  }, [cleanupStream, maxDurationMs, onAutoStop]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed < minDurationMs) {
        setError(
          `Recording too short (${(elapsed / 1000).toFixed(1)}s). Must be at least ${minDurationMs / 1000}s.`
        );
        cleanupStream();
        setStatus("error");
        return;
      }
      mediaRecorderRef.current.stop();
    }
  }, [cleanupStream, minDurationMs]);

  const reset = useCallback(() => {
    cleanupStream();
    setStatus("idle");
    setAudioBlob(null);
    setDurationMs(0);
    setError(null);
    setVolumeLevel(0);
    setPauses([]);
    pausesRef.current = [];
    silenceStartRef.current = null;
  }, [cleanupStream]);

  return {
    status,
    setStatus,
    durationMs,
    audioBlob,
    error,
    volumeLevel,
    pauses,
    pausesRef,
    analyserNode: analyserRef.current,
    startRecording,
    stopRecording,
    reset,
  };
}
