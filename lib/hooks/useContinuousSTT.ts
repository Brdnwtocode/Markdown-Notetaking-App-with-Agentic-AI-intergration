// lib/hooks/useContinuousSTT.ts
//
// Continuous (long-form) Speech-to-Text hook optimized for the Records
// audio workstation. Unlike useDeepgramSTT (push-to-talk), this hook:
//
//   - Streams indefinitely until manually stopped
//   - Supports pause/resume of transcription
//   - Emits interim transcripts at regular intervals
//   - Accumulates final transcripts into a complete transcript
//   - Handles reconnection on network drop
//
// Happy path:   Deepgram WebSocket (nova-3) with interim results.
// Fallback:     /api/voice/process → FastAPI batch pipeline.
//
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { getSessionId } from "@/lib/session";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContinuousSTTStatus =
  | "idle"
  | "minting"
  | "connecting"
  | "streaming"
  | "paused"
  | "finalizing"
  | "fallback"
  | "error";

export interface ContinuousSTTOptions {
  /** Called with every interim transcript chunk (live display) */
  onInterimTranscript?: (text: string) => void;
  /** Called when a finalized segment is committed (accumulate into full transcript) */
  onFinalizedSegment?: (text: string) => void;
  /** Called with the complete accumulated transcript when recording stops */
  onTranscriptComplete?: (fullTranscript: string) => void;
  /** Called on status changes */
  onStatusChange?: (status: ContinuousSTTStatus) => void;
  /** BCP-47 language tag. Defaults to "vi" (Vietnamese). */
  language?: string;
  /** Deepgram model. Defaults to "nova-3". */
  model?: string;
  /** Reconnect on unexpected disconnect */
  autoReconnect?: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useContinuousSTT({
  onInterimTranscript,
  onFinalizedSegment,
  onTranscriptComplete,
  onStatusChange,
  language = "vi",
  model = "nova-3",
  autoReconnect = true,
}: ContinuousSTTOptions = {}) {
  const [status, setStatus] = useState<ContinuousSTTStatus>("idle");

  // Refs to avoid stale closures in WebSocket callbacks
  const dgConnectionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const blobsRef = useRef<Blob[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const fullTranscriptRef = useRef("");
  const interimChunksRef = useRef<Set<string>>(new Set());
  const stoppedIntentionallyRef = useRef(false);

  const setStatusAndNotify = useCallback(
    (s: ContinuousSTTStatus) => {
      setStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange],
  );

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    try { dgConnectionRef.current?.close(); } catch { /* ignore */ }
    dgConnectionRef.current = null;

    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
    } catch { /* ignore */ }

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  // ─── Start ─────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    stoppedIntentionallyRef.current = false;
    reconnectAttemptsRef.current = 0;
    fullTranscriptRef.current = "";
    interimChunksRef.current = new Set();

    try {
      setStatusAndNotify("minting");

      // Get Deepgram ephemeral token from our server
      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) throw new Error("Failed to get Deepgram token");
      const { token } = await tokenRes.json();

      // Acquire mic
      setStatusAndNotify("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Start MediaRecorder for fallback blobs
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      blobsRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) blobsRef.current.push(e.data);
      };
      recorder.start(1000); // 1s chunks

      // Open Deepgram WebSocket
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=${model}&language=${language}&interim_results=true&utterance_end_ms=1500&encoding=opus&sample_rate=16000&channels=1`,
        ["token", token],
      );
      dgConnectionRef.current = ws;

      ws.onopen = () => {
        setStatusAndNotify("streaming");
        reconnectAttemptsRef.current = 0;

        // Pipe mic audio into WebSocket via MediaRecorder or AudioContext
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && status !== "paused") {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32 to Int16 PCM
            const pcm = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            ws.send(pcm.buffer);
          }
        };

        // Store for cleanup
        (ws as any).__audioCtx = audioCtx;
        (ws as any).__processor = processor;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data.channel?.alternatives?.[0]?.transcript || "";

          if (!transcript) return;

          if (data.is_final) {
            // Deduplicate finalized segments
            const key = transcript.slice(0, 40);
            if (!interimChunksRef.current.has(key)) {
              interimChunksRef.current.add(key);
              fullTranscriptRef.current += " " + transcript;
              fullTranscriptRef.current = fullTranscriptRef.current.trim();
              onFinalizedSegment?.(transcript);
            }
          } else {
            onInterimTranscript?.(transcript);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        if (!stoppedIntentionallyRef.current && status !== "finalizing") {
          setStatusAndNotify("error");
          if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            cleanup();
            setTimeout(() => start(), 2000);
          }
        }
      };

      ws.onclose = () => {
        if (!stoppedIntentionallyRef.current && status === "streaming") {
          setStatusAndNotify("error");
        }
      };
    } catch (err: any) {
      console.error("[ContinuousSTT] Start failed:", err);
      setStatusAndNotify("error");
      toast.error("Failed to start recording: " + (err.message || "Unknown error"));
    }
  }, [
    status,
    language,
    model,
    autoReconnect,
    setStatusAndNotify,
    cleanup,
    onInterimTranscript,
    onFinalizedSegment,
  ]);

  // ─── Pause / Resume ────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    setStatusAndNotify("paused");
  }, [setStatusAndNotify]);

  const resume = useCallback(() => {
    if (dgConnectionRef.current?.readyState === WebSocket.OPEN) {
      setStatusAndNotify("streaming");
    }
  }, [setStatusAndNotify]);

  // ─── Stop ──────────────────────────────────────────────────────────────────

  const stop = useCallback(async (): Promise<{ transcript: string; audioBlob: Blob | null }> => {
    stoppedIntentionallyRef.current = true;
    setStatusAndNotify("finalizing");

    // Close WebSocket
    try { dgConnectionRef.current?.close(); } catch { /* ignore */ }
    dgConnectionRef.current = null;

    // Clean up audio context
    const ws = dgConnectionRef.current;
    try { (ws as any)?.__processor?.disconnect(); } catch { /* ignore */ }
    try { (ws as any)?.__audioCtx?.close(); } catch { /* ignore */ }

    // Stop MediaRecorder and collect blobs
    let audioBlob: Blob | null = null;
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      // Wait a tick for final dataavailable
      await new Promise((r) => setTimeout(r, 200));
    }
    if (blobsRef.current.length > 0) {
      audioBlob = new Blob(blobsRef.current, { type: "audio/webm" });
    }

    const transcript = fullTranscriptRef.current.trim();

    // Fallback to FastAPI if no transcript from Deepgram
    if (!transcript && audioBlob) {
      setStatusAndNotify("fallback");
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("transcript", "");

        const res = await fetch("/api/voice/process", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          fullTranscriptRef.current = data.aiReply || "";
        }
      } catch (err) {
        console.error("[ContinuousSTT] Fallback failed:", err);
      }
    }

    cleanup();
    mediaRecorderRef.current = null;
    blobsRef.current = [];

    const finalTranscript = fullTranscriptRef.current;
    onTranscriptComplete?.(finalTranscript);
    setStatusAndNotify("idle");

    return { transcript: finalTranscript, audioBlob };
  }, [setStatusAndNotify, cleanup, onTranscriptComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedIntentionallyRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    start,
    stop,
    pause,
    resume,
    /** Get current full transcript without stopping */
    getTranscript: () => fullTranscriptRef.current,
    /** Get accumulated audio blobs without stopping */
    getAudioBlob: () =>
      blobsRef.current.length > 0
        ? new Blob(blobsRef.current, { type: "audio/webm" })
        : null,
  };
}
