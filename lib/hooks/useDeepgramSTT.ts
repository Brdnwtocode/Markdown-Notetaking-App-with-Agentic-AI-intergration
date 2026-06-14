// lib/hooks/useDeepgramSTT.ts
//
// Self-contained hook owning the entire two-path STT state machine:
//
//   IDLE → MINTING → CONNECTING → STREAMING → FINALIZING → IDLE
//                         └──(timeout / error)──→ FALLBACK → IDLE
//
// Happy path: Deepgram WebSocket (nova-3, language=vi) with interim results.
// Fallback: existing /api/voice/process → FastAPI batch pipeline, with the
//           pre-buffered audio from MediaRecorder that ran in parallel.
//
// The hook never exposes the Deepgram API key to the browser. It fetches a
// 30-second short-lived token from /api/deepgram/token before each session.
"use client";

import { useRef, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { getSessionId } from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export type STTStatus =
  | "idle"
  | "minting"       // fetching short-lived token from our server
  | "connecting"    // WebSocket handshake in flight
  | "streaming"     // live audio → Deepgram → interim transcripts
  | "finalizing"    // user released PTT; waiting for speech_final
  | "fallback";     // WebSocket failed; running batch path

export interface DeepgramSTTOptions {
  /** Called with every interim + rolling-final transcript for live display */
  onInterimTranscript?: (text: string) => void;
  /**
   * Called exactly once per session with the committed final transcript.
   * On the streaming path this is the accumulated speech_final text.
   * On the fallback path this is the transcript from FastAPI.
   */
  onTranscriptReady: (transcript: string) => void;
  /** BCP-47 language tag. Defaults to "vi" (Vietnamese). */
  language?: string;
  /** Deepgram model. Defaults to "nova-3" which supports vi as of 2026-01. */
  model?: string;
  /** Milliseconds to wait for the WebSocket to open before falling back. Default: 3000 */
  wsTimeoutMs?: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDeepgramSTT({
  onInterimTranscript,
  onTranscriptReady,
  language = "vi",
  model = "nova-3",
  wsTimeoutMs = 3000,
}: DeepgramSTTOptions) {
  const [status, setStatus] = useState<STTStatus>("idle");

  // All mutable, non-reactive state lives in refs to avoid stale closures
  // in event handlers without needing to re-register listeners on re-renders.
  const dgConnectionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);  // feeds fallback blobs
  const blobsRef = useRef<Blob[]>([]);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedTranscriptRef = useRef<string>("");  // speech_final segments joined
  const fallbackInProgressRef = useRef(false); // guard against duplicate fallback

  // Snapshot of context gathered at start() time — needed by the fallback
  // which may run asynchronously after the start call returns.
  const sessionContextRef = useRef<{
    contextType: string;
    contextId: string;
    extras: FormData;
  } | null>(null);

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    fallbackInProgressRef.current = false;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    // Close Deepgram connection cleanly
    try { dgConnectionRef.current?.close(); } catch { /* ignore */ }
    dgConnectionRef.current = null;

    // Stop MediaRecorder (but keep blobs for fallback — caller clears them)
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
    } catch { /* ignore */ }

    // Tear down AudioContext and mic stream
    try { audioContextRef.current?.close(); } catch { /* ignore */ }
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  // ─── Fallback path ─────────────────────────────────────────────────────────

  const runFallback = useCallback(async (fallbackCtx?: {
    contextType: string;
    contextId: string;
    extras: FormData;
  } | null) => {
    // Guard against duplicate fallback calls (e.g. WS onclose + onerror firing together)
    if (fallbackInProgressRef.current) return;
    fallbackInProgressRef.current = true;

    const ctx = fallbackCtx || sessionContextRef.current;
    if (!ctx) {
      console.warn("[useDeepgramSTT] runFallback: no context found");
      fallbackInProgressRef.current = false;
      return;
    }

    setStatus("fallback");
    // Clear context ref early so duplicate calls do not trigger multiple fallback runs
    sessionContextRef.current = null;
    toast("Network issue — using batch transcription", { icon: "⚠️" });

    // Stop WebSocket (no-op if already gone)
    try { dgConnectionRef.current?.close(); } catch { /* ignore */ }
    dgConnectionRef.current = null;

    // Wait for MediaRecorder to flush final chunk, then stop
    await new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === "inactive") { resolve(); return; }
      const prevOnStop = mr.onstop;
      mr.onstop = (e) => {
        if (typeof prevOnStop === "function") prevOnStop.call(mr, e);
        resolve();
      };
      try { mr.stop(); } catch { resolve(); }
    });

    // Stop mic tracks now that recorder is done
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    // Build multipart form for FastAPI-compatible BFF route
    const form = new FormData();
    const audioBlob = new Blob(blobsRef.current, { type: "audio/webm" });
    form.append("audio", audioBlob, "audio.webm");
    form.append("contextType", ctx.contextType);
    form.append("contextId", ctx.contextId);
    form.append("cursorPosition", ctx.extras.get("cursorPosition") as string ?? "0");
    // Copy optional fields (note_state, dynamic_schema, task_context, etc.)
    ctx.extras.forEach((value, key) => {
      if (key !== "contextType" && key !== "contextId" && key !== "cursorPosition") {
        form.append(key, value);
      }
    });

    try {
      const res = await fetch("/api/voice/process", {
        method: "POST",
        body: form,
        credentials: "include",
        headers: (() => {
          const h: Record<string, string> = {};
          const sid = getSessionId();
          if (sid && sid !== "ssr-placeholder") h["x-session-id"] = sid;
          return h;
        })(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onTranscriptReady(data.transcript ?? "");
    } catch (err) {
      console.error("[useDeepgramSTT] Fallback batch failed:", err);
      toast.error("Voice processing failed");
    } finally {
      blobsRef.current = [];
      sessionContextRef.current = null;
      fallbackInProgressRef.current = false;
      setStatus("idle");
    }
  }, [onTranscriptReady]);

  // ─── Streaming path ────────────────────────────────────────────────────────

  const startStreaming = useCallback(
    async (stream: MediaStream) => {
      // 1. Mint a short-lived token (API key stays server-side)
      setStatus("minting");
      let token: string;
      try {
        const res = await fetch("/api/deepgram/token");
        if (!res.ok) throw new Error(`Token mint HTTP ${res.status}`);
        const data = await res.json();
        token = data.token || data.key; // Fallback just in case the server returns 'key' directly
        if (!token) {
          throw new Error("Invalid token payload received from server");
        }
      } catch (err) {
        console.warn("[useDeepgramSTT] Token mint failed, falling back:", err);
        return runFallback(sessionContextRef.current);
      }

      // 2. Open Deepgram WebSocket via the official SDK.
      //    The SDK uses Sec-WebSocket-Protocol for auth — the only custom
      //    header browsers allow on WebSocket handshakes.
      setStatus("connecting");

      // Arm fallback timer — cancelled when the socket opens successfully
      fallbackTimerRef.current = setTimeout(() => {
        console.warn("[useDeepgramSTT] WS connect timeout, falling back");
        runFallback(sessionContextRef.current);
      }, wsTimeoutMs);

      const wsUrl = `wss://api.deepgram.com/v1/listen?model=${model}&language=${language}&smart_format=true&interim_results=true&endpointing=1000&punctuate=true&encoding=linear16&sample_rate=16000`;
      const socket = new WebSocket(wsUrl, ["token", token]);

      const connectPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"));
        }, wsTimeoutMs);

        socket.onopen = () => {
          clearTimeout(timeout);
          if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          setStatus("streaming");
          resolve();
        };

        socket.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });

      try {
        await connectPromise;
      } catch (err) {
        console.warn("[useDeepgramSTT] WS connect failed, falling back:", err);
        return runFallback(sessionContextRef.current);
      }

      // Track the latest status in a ref so WS handlers don't need setState updater side-effects
      const statusRef = { current: "streaming" as STTStatus };

      socket.onclose = () => {
        // Only fall back if we haven't already entered finalization/fallback
        if (statusRef.current === "streaming" && !fallbackInProgressRef.current) {
          const ctxCopy = sessionContextRef.current;
          setTimeout(() => runFallback(ctxCopy), 0);
        }
      };

      socket.onerror = (err) => {
        console.warn("[useDeepgramSTT] WS error:", err);
        if (statusRef.current === "streaming" && !fallbackInProgressRef.current) {
          const ctxCopy = sessionContextRef.current;
          setTimeout(() => runFallback(ctxCopy), 0);
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "Results") return;
          const alternative = data?.channel?.alternatives?.[0];
          const chunk: string = alternative?.transcript ?? "";

          if (data.is_final) {
            // Accumulate committed segments
            if (chunk) {
              committedTranscriptRef.current = committedTranscriptRef.current
                ? committedTranscriptRef.current + " " + chunk
                : chunk;
            }
            onInterimTranscript?.(committedTranscriptRef.current);
          } else {
            // Show committed + current interim for smooth live display
            const display = committedTranscriptRef.current
              ? committedTranscriptRef.current + " " + chunk
              : chunk;
            onInterimTranscript?.(display);
          }
        } catch (err) {
          console.error("[useDeepgramSTT] Failed to parse WebSocket message:", err);
        }
      };

      dgConnectionRef.current = socket;

      // 3. Pipe mic audio. Try AudioWorklet first (dedicated audio thread,
      //    avoids main-thread jank during React re-renders). Fall back to the
      //    deprecated ScriptProcessorNode for any environment that lacks it.
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Ensure AudioContext is active (browsers suspend it by default)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);

      const sendBuffer = (buffer: ArrayBuffer) => {
        const socket = dgConnectionRef.current;
        if (socket && socket.readyState === 1) { // 1 is OPEN
          socket.send(buffer);
        }
      };

      try {
        await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");
        const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          sendBuffer(e.data);
        };
        source.connect(workletNode);

        // Web Audio requires connecting the node to destination to trigger execution
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        workletNode.connect(silentGain);
        silentGain.connect(audioContext.destination);
      } catch (workletErr) {
        // AudioWorklet unavailable (old browser / insecure context in dev)
        console.warn("[useDeepgramSTT] AudioWorklet unavailable, using ScriptProcessorNode:", workletErr);
        // ScriptProcessorNode runs on main thread — still better than nothing
        const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const c = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = c < 0 ? c * 32768 : c * 32767;
          }
          sendBuffer(int16.buffer);
        };
        source.connect(scriptNode);
        // ScriptProcessorNode requires a destination to run
        scriptNode.connect(audioContext.destination);
      }
    },
    [language, model, wsTimeoutMs, onInterimTranscript, runFallback]
  );

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Start a PTT session. Gather context before calling — this is idempotent
   * if already active (returns immediately).
   *
   * @param contextType  "NOTE" | "STACK" | "TASK" | "CALENDAR"
   * @param contextId    The entity ID relevant to the context
   * @param extras       Any additional FormData fields (note_state, dynamic_schema, etc.)
   */
  const start = useCallback(
    async (contextType: string, contextId: string, extras: FormData) => {
      if (status !== "idle") return;

      // Reset per-session state
      blobsRef.current = [];
      committedTranscriptRef.current = "";
      sessionContextRef.current = { contextType, contextId, extras };

      // Request mic access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        mediaStreamRef.current = stream;
      } catch (err) {
        toast.error("Microphone access denied");
        console.error("[useDeepgramSTT] getUserMedia failed:", err);
        sessionContextRef.current = null;
        return;
      }

      // Wire up MediaRecorder in parallel — its blobs feed the fallback path.
      // 100ms timeslices means the buffer fills quickly; even a 200ms hold
      // gives the fallback path enough audio to work with.
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) blobsRef.current.push(e.data);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;

      // Start the streaming path (falls back internally on failure)
      await startStreaming(stream);
    },
    [status, startStreaming]
  );

  /**
   * Stop the current PTT session. On the streaming path, sends a CloseStream
   * signal and waits up to 1s for the final speech_final event before
   * committing the transcript.
   */
  const stop = useCallback(async () => {
    if (status === "idle" || status === "fallback") return;
 
    setStatus("finalizing");
 
    if (dgConnectionRef.current) {
      // Signal Deepgram to flush — it will send remaining speech_final events
      try {
        dgConnectionRef.current.send(JSON.stringify({ type: "CloseStream" }));
      } catch (err) {
        console.warn("[useDeepgramSTT] sendCloseStream failed:", err);
      }
 
      // Wait for final transcript; Deepgram typically responds in <500ms
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
 
      const finalText = committedTranscriptRef.current;
      onTranscriptReady(finalText);
      cleanup();
      blobsRef.current = [];
      sessionContextRef.current = null;
      committedTranscriptRef.current = "";
      setStatus("idle");
    } else {
      // WebSocket was not connected when stop() was called. Run fallback.
      console.warn("[useDeepgramSTT] stop() called with no active WS connection, running fallback.");
      await runFallback(sessionContextRef.current);
    }
  }, [status, onTranscriptReady, cleanup, runFallback]);

  return { status, start, stop };
}
