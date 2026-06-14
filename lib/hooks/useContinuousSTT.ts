"use client";

// lib/hooks/useContinuousSTT.ts
//
// Continuous (long-form) Speech-to-Text hook for the Records workstation.
// Streams raw PCM Int16 audio to Deepgram WebSocket using linear16 encoding.
//
// Key design decisions:
//   - encoding=linear16 (raw PCM) — simpler than Opus, no container overhead
//   - ScriptProcessorNode for real-time PCM capture (works in all browsers)
//   - statusRef avoids stale closures in audio processing callbacks
//   - MediaRecorder runs in parallel as fallback (stores blobs for batch upload)
//
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

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
  onInterimTranscript?: (text: string) => void;
  onFinalizedSegment?: (text: string) => void;
  onTranscriptComplete?: (fullTranscript: string) => void;
  onStatusChange?: (status: ContinuousSTTStatus) => void;
  /** BCP-47 language tag. Defaults to "en" (English). */
  language?: string;
  /** Deepgram model. Defaults to "nova-3". */
  model?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useContinuousSTT({
  onInterimTranscript,
  onFinalizedSegment,
  onTranscriptComplete,
  onStatusChange,
  language = "en",
  model = "nova-3",
}: ContinuousSTTOptions = {}) {
  const [status, setStatus] = useState<ContinuousSTTStatus>("idle");

  // Refs — all mutable runtime state lives here to avoid stale closures
  const statusRef = useRef<ContinuousSTTStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const blobsRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const fullTranscriptRef = useRef("");
  const interimKeysRef = useRef<Set<string>>(new Set());
  const stoppedIntentionallyRef = useRef(false);
  const pausedRef = useRef(false);

  // Keep both state and ref in sync
  const setStatusBoth = useCallback(
    (s: ContinuousSTTStatus) => {
      statusRef.current = s;
      setStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange],
  );

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Disconnect audio processing
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    processorRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;

    // Close WebSocket
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;

    // Stop MediaRecorder
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
    } catch { /* ignore */ }

    // Stop mic tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  // ─── Start ─────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    stoppedIntentionallyRef.current = false;
    pausedRef.current = false;
    fullTranscriptRef.current = "";
    interimKeysRef.current = new Set();

    try {
      setStatusBoth("minting");

      // 1. Get Deepgram ephemeral key from our server (never exposed to browser)
      //    Must use POST — the route only accepts POST (not GET)
      const tokenRes = await fetch("/api/deepgram/token", { method: "POST" });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Deepgram token failed (HTTP ${tokenRes.status})`);
      }
      const { token } = await tokenRes.json();

      // 2. Acquire mic
      setStatusBoth("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Start MediaRecorder (fallback — stores blobs for later upload)
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
      recorder.start(1000);

      // 4. Open Deepgram WebSocket
      //    encoding=linear16 matches the raw PCM Int16 we send via ScriptProcessor
      const url = `wss://api.deepgram.com/v1/listen?model=${model}&language=${language}&interim_results=true&encoding=linear16&sample_rate=16000&channels=1`;
      console.log("[ContinuousSTT] Connecting:", url);

      const ws = new WebSocket(url, ["token", token]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[ContinuousSTT] WebSocket opened, starting audio pipe");
        setStatusBoth("streaming");

        // Create AudioContext + ScriptProcessor to pipe mic → WebSocket
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          // Use refs — never stale
          if (
            wsRef.current?.readyState === WebSocket.OPEN &&
            !pausedRef.current
          ) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
            const pcm = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            try {
              wsRef.current.send(pcm.buffer);
            } catch {
              // WebSocket might have closed
            }
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const transcript =
            data.channel?.alternatives?.[0]?.transcript || "";

          if (!transcript) return;

          if (data.is_final) {
            const key = transcript.slice(0, 40);
            if (!interimKeysRef.current.has(key)) {
              interimKeysRef.current.add(key);
              fullTranscriptRef.current += " " + transcript;
              fullTranscriptRef.current = fullTranscriptRef.current.trim();
              console.log("[ContinuousSTT] Final:", transcript.slice(0, 60));
              onFinalizedSegment?.(transcript);
            }
          } else {
            onInterimTranscript?.(transcript);
          }
        } catch {
          // Ignore non-JSON messages (e.g., binary metadata)
        }
      };

      ws.onerror = (err) => {
        console.error("[ContinuousSTT] WebSocket error:", err);
        if (!stoppedIntentionallyRef.current) {
          setStatusBoth("error");
          toast.error("Transcription connection lost");
        }
      };

      ws.onclose = (ev) => {
        console.log("[ContinuousSTT] WebSocket closed:", ev.code, ev.reason);
        if (!stoppedIntentionallyRef.current) {
          setStatusBoth("error");
        }
      };
    } catch (err: any) {
      console.error("[ContinuousSTT] Start failed:", err);
      setStatusBoth("error");
      // Clean up anything that may have been partially set up (mic stream, etc.)
      cleanup();
      // Re-throw so the caller (BackgroundRecorder) can fall back or reset state
      throw err;
    }
  }, [setStatusBoth, language, model, onInterimTranscript, onFinalizedSegment, cleanup]);

  // ─── Pause / Resume ────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    pausedRef.current = true;
    setStatusBoth("paused");
  }, [setStatusBoth]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setStatusBoth("streaming");
  }, [setStatusBoth]);

  // ─── Stop ───────────────────────────────────────────────────────────────────

  const stop = useCallback(async (): Promise<{
    transcript: string;
    audioBlob: Blob | null;
  }> => {
    stoppedIntentionallyRef.current = true;
    setStatusBoth("finalizing");

    // Close WebSocket (triggers final speech_final from Deepgram if any)
    try {
      // Send a close message to Deepgram to flush final results
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch { /* ignore */ }
    // Give Deepgram a moment to send final results
    await new Promise((r) => setTimeout(r, 500));
    try {
      wsRef.current?.close();
    } catch { /* ignore */ }
    wsRef.current = null;

    // Stop MediaRecorder
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      await new Promise((r) => setTimeout(r, 200));
    }

    const audioBlob =
      blobsRef.current.length > 0
        ? new Blob(blobsRef.current, { type: "audio/webm" })
        : null;

    const transcript = fullTranscriptRef.current.trim();

    // Clean up audio processing
    cleanup();

    mediaRecorderRef.current = null;
    blobsRef.current = [];

    onTranscriptComplete?.(transcript);
    setStatusBoth("idle");

    return { transcript, audioBlob };
  }, [setStatusBoth, cleanup, onTranscriptComplete]);

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
    getTranscript: () => fullTranscriptRef.current,
    getAudioBlob: () =>
      blobsRef.current.length > 0
        ? new Blob(blobsRef.current, { type: "audio/webm" })
        : null,
  };
}
