"use client";

// BackgroundRecorder.tsx
//
// Persistent recording manager mounted in the workspace layout.
// Owns the mic stream and STT connection so recording survives
// tab navigation (Notes → Records → Tasks → etc.).
//
// Controlled entirely via Zustand — the RecordsWorkstation UI just
// dispatches setIsRecording(true/false) and this component reacts.

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { useContinuousSTT } from "@/lib/hooks/useContinuousSTT";
import { storeBlob } from "@/components/workspace/CaptureQueue";
import { toast } from "@/lib/toast";

export default function BackgroundRecorder() {
  const isRecording = useWorkspaceStore((s) => s.isRecording);
  const isPaused = useWorkspaceStore((s) => s.isPaused);
  const sttEnabled = useWorkspaceStore((s) => s.sttEnabled);
  const appendLiveTranscript = useWorkspaceStore((s) => s.appendLiveTranscript);
  const setLiveTranscript = useWorkspaceStore((s) => s.setLiveTranscript);
  const setIsRecording = useWorkspaceStore((s) => s.setIsRecording);
  const setRecordingDurationSec = useWorkspaceStore((s) => s.setRecordingDurationSec);

  const wasRecordingRef = useRef(false);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingBlobIdRef = useRef<string | null>(null);
  const pendingStopPromiseRef = useRef<Promise<void> | null>(null);
  // Resolved when the audio blob has been stored (STT stop completes or mic-only recorder.onstop fires)
  const pendingReadyPromiseRef = useRef<Promise<void> | null>(null);

  // Track STT state at start time — locked for the session duration
  const sttLockedRef = useRef(false);
  // Track whether mic-only fallback already showed a permission error
  const micErrorShownRef = useRef(false);

  // ─── Helper: start mic-only recording (no STT / Deepgram) ────────────
  const startMicOnlyRecording = useCallback((isFallback = false) => {
    navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }).then((stream) => {
      // Mic acquired successfully — reset error flag
      micErrorShownRef.current = false;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm",
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.start(1000);
      (window as any).__bgMediaRecorder = recorder;
      (window as any).__bgMediaStream = stream;
      (window as any).__bgChunks = chunks;
      toast.success(isFallback ? "STT unavailable — recording audio only" : "Recording audio (STT off)");
    }).catch((err) => {
      console.error("[BackgroundRecorder] Mic access failed:", err);
      // If this is the fallback after STT already showed an error, suppress duplicate toast
      if (isFallback && micErrorShownRef.current) {
        setIsRecording(false);
        return;
      }
      micErrorShownRef.current = true;
      toast.error(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Microphone access denied — please allow mic permissions"
        : `Microphone error: ${err.message}`);
      setIsRecording(false);
    });
  }, [setIsRecording]);

  // ─── STT Hook (persistent — won't unmount on tab switch) ──────────────
  // Memoize callbacks at the module-ref level to keep stt object reference
  // stable across renders, preventing the main useEffect from re-firing.
  const sttCallbacks = useMemo(() => ({
    onInterimTranscript: (text: string) => { setLiveTranscript(text); },
    onFinalizedSegment: (text: string) => { appendLiveTranscript(" " + text); },
    onTranscriptComplete: (full: string) => { setLiveTranscript(full); },
  }), [setLiveTranscript, appendLiveTranscript]);

  const stt = useContinuousSTT(sttCallbacks);

  // Stable references to stt methods to avoid useEffect dependency churn
  const sttStartRef = useRef(stt.start);
  const sttStopRef = useRef(stt.stop);
  const sttPauseRef = useRef(stt.pause);
  const sttResumeRef = useRef(stt.resume);
  sttStartRef.current = stt.start;
  sttStopRef.current = stt.stop;
  sttPauseRef.current = stt.pause;
  sttResumeRef.current = stt.resume;

  // ─── React to isRecording changes ────────────────────────────────────
  useEffect(() => {
    const wasRecording = wasRecordingRef.current;
    wasRecordingRef.current = isRecording;

    // START recording
    if (isRecording && !wasRecording) {
      // Lock STT state for this session — can't change mid-record
      sttLockedRef.current = sttEnabled;

      if (sttLockedRef.current) {
        sttStartRef.current().catch((err) => {
          console.error("[BackgroundRecorder] STT start failed:", err);
          // Fall back to recording without STT (MediaRecorder-only mode)
          const message = err instanceof Error ? err.message : "Speech-to-text unavailable";
          micErrorShownRef.current = true; // suppress duplicate mic error in fallback
          toast.error(`${message} — recording audio only`);
          // Retry without STT: flip the locked ref and start mic-only recording
          sttLockedRef.current = false;
          startMicOnlyRecording(true);
        });
      }
      // If STT disabled (or fell back), start mic-only recording
      if (!sttLockedRef.current) {
        startMicOnlyRecording();
      }
    }

    // STOP recording
    if (!isRecording && wasRecording) {
      if (sttLockedRef.current) {
        // STT was on — use stt.stop() which returns transcript + blob.
        // Track the promise so we don't lose it if the component remounts.
        // Also expose a ready-promise so RecordsWorkstation can await blob availability.
        let resolveReady: () => void;
        pendingReadyPromiseRef.current = new Promise<void>((r) => { resolveReady = r; });
        pendingStopPromiseRef.current = sttStopRef.current().then(({ transcript, audioBlob }) => {
          setLiveTranscript(transcript);
          if (audioBlob && audioBlob.size > 0) {
            const blobId = "bg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            pendingBlobIdRef.current = blobId;
            storeBlob(blobId, audioBlob);
          }
          // Clean up window globals (may have been set by fallback path)
          delete (window as any).__bgMediaRecorder;
          delete (window as any).__bgMediaStream;
          delete (window as any).__bgChunks;
          resolveReady!();
        }).catch((err) => {
          console.error("[BackgroundRecorder] STT stop failed:", err);
          // Ensure cleanup still happens on failure
          delete (window as any).__bgMediaRecorder;
          delete (window as any).__bgMediaStream;
          delete (window as any).__bgChunks;
          resolveReady!();
        });
      } else {
        // STT was off — collect MediaRecorder blob manually
        const recorder = (window as any).__bgMediaRecorder as MediaRecorder | undefined;
        const stream = (window as any).__bgMediaStream as MediaStream | undefined;
        const chunks = ((window as any).__bgChunks as Blob[]) || [];

        // Expose a ready-promise that resolves when recorder.onstop fires
        let resolveReady: () => void;
        pendingReadyPromiseRef.current = new Promise<void>((r) => { resolveReady = r; });

        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size > 0) {
              const blobId = "bg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
              pendingBlobIdRef.current = blobId;
              storeBlob(blobId, blob);
            }
            resolveReady!();
          };
          recorder.stop();
        } else {
          // No active recorder — resolve immediately (nothing to wait for)
          resolveReady!();
        }
        stream?.getTracks().forEach((t) => t.stop());
        delete (window as any).__bgMediaRecorder;
        delete (window as any).__bgMediaStream;
        delete (window as any).__bgChunks;
      }
    }
  }, [isRecording, sttEnabled, setIsRecording, setLiveTranscript, startMicOnlyRecording]);

  // ─── Duration timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording && !isPaused) {
      durationTimerRef.current = setInterval(() => {
        setRecordingDurationSec(
          useWorkspaceStore.getState().recordingDurationSec + 1,
        );
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isRecording, isPaused, setRecordingDurationSec]);

  // ─── Pause/Resume (only when STT is active) ─────────────────────────
  useEffect(() => {
    if (!sttLockedRef.current) return;
    if (isRecording && isPaused) {
      sttPauseRef.current();
    } else if (isRecording && !isPaused) {
      sttResumeRef.current();
    }
  }, [isPaused, isRecording]);

  // ─── Expose pending blob getter & ready-promise ──────────────────────
  useEffect(() => {
    // Store getters on the Zustand store so RecordsWorkstation can retrieve
    // the blob without polling. _getPendingBlobReadyPromise resolves when
    // BackgroundRecorder has finished storing the audio blob (STT or mic-only).
    const store = useWorkspaceStore.getState() as any;
    store._getPendingBlobId = () => pendingBlobIdRef.current;
    store._clearPendingBlobId = () => { pendingBlobIdRef.current = null; };
    store._getPendingBlobReadyPromise = () => pendingReadyPromiseRef.current;
  }, []);

  // This component renders nothing — it's invisible
  return null;
}
