"use client";

// BackgroundRecorder.tsx
//
// Persistent recording manager mounted in the workspace layout.
// Owns the mic stream and STT connection so recording survives
// tab navigation (Notes → Records → Tasks → etc.).
//
// Controlled entirely via Zustand — the RecordsWorkstation UI just
// dispatches setIsRecording(true/false) and this component reacts.

import { useEffect, useRef, useCallback } from "react";
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

  // Track STT state at start time — locked for the session duration
  const sttLockedRef = useRef(false);

  // ─── Helper: start mic-only recording (no STT / Deepgram) ────────────
  const startMicOnlyRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }).then((stream) => {
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
      toast.success("Recording audio (STT off)");
    }).catch((err) => {
      console.error("[BackgroundRecorder] Mic access failed:", err);
      toast.error(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Microphone access denied — please allow mic permissions"
        : `Microphone error: ${err.message}`);
      setIsRecording(false);
    });
  }, [setIsRecording]);

  // ─── STT Hook (persistent — won't unmount on tab switch) ──────────────
  const stt = useContinuousSTT({
    onInterimTranscript: useCallback(
      (text: string) => { setLiveTranscript(text); },
      [setLiveTranscript],
    ),
    onFinalizedSegment: useCallback(
      (text: string) => { appendLiveTranscript(" " + text); },
      [appendLiveTranscript],
    ),
    onTranscriptComplete: useCallback(
      (full: string) => { setLiveTranscript(full); },
      [setLiveTranscript],
    ),
  });

  // ─── React to isRecording changes ────────────────────────────────────
  useEffect(() => {
    const wasRecording = wasRecordingRef.current;
    wasRecordingRef.current = isRecording;

    // START recording
    if (isRecording && !wasRecording) {
      // Lock STT state for this session — can't change mid-record
      sttLockedRef.current = sttEnabled;

      if (sttLockedRef.current) {
        stt.start().catch((err) => {
          console.error("[BackgroundRecorder] STT start failed:", err);
          // Fall back to recording without STT (MediaRecorder-only mode)
          const message = err instanceof Error ? err.message : "Speech-to-text unavailable";
          toast.error(`${message} — recording audio only`);
          // Retry without STT: flip the locked ref and start mic-only recording
          sttLockedRef.current = false;
          startMicOnlyRecording();
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
        // STT was on — use stt.stop() which returns transcript + blob
        stt.stop().then(({ transcript, audioBlob }) => {
          setLiveTranscript(transcript);
          if (audioBlob && audioBlob.size > 0) {
            const blobId = "bg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            pendingBlobIdRef.current = blobId;
            storeBlob(blobId, audioBlob);
          }
        }).catch(console.error);
      } else {
        // STT was off — collect MediaRecorder blob manually
        const recorder = (window as any).__bgMediaRecorder as MediaRecorder | undefined;
        const stream = (window as any).__bgMediaStream as MediaStream | undefined;
        const chunks = ((window as any).__bgChunks as Blob[]) || [];
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size > 0) {
              const blobId = "bg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
              pendingBlobIdRef.current = blobId;
              storeBlob(blobId, blob);
            }
          };
          recorder.stop();
        }
        stream?.getTracks().forEach((t) => t.stop());
        delete (window as any).__bgMediaRecorder;
        delete (window as any).__bgMediaStream;
        delete (window as any).__bgChunks;
      }
    }
  }, [isRecording, sttEnabled, stt, setIsRecording, setLiveTranscript, startMicOnlyRecording]);

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
      stt.pause();
    } else if (isRecording && !isPaused) {
      stt.resume();
    }
  }, [isPaused, isRecording, stt]);

  // ─── Expose pending blob getter ──────────────────────────────────────
  useEffect(() => {
    // Store a getter on the store so RecordsWorkstation can retrieve the blob
    const store = useWorkspaceStore.getState() as any;
    store._getPendingBlobId = () => pendingBlobIdRef.current;
    store._clearPendingBlobId = () => { pendingBlobIdRef.current = null; };
  }, []);

  // This component renders nothing — it's invisible
  return null;
}
