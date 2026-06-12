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

export default function BackgroundRecorder() {
  const isRecording = useWorkspaceStore((s) => s.isRecording);
  const isPaused = useWorkspaceStore((s) => s.isPaused);
  const appendLiveTranscript = useWorkspaceStore((s) => s.appendLiveTranscript);
  const setLiveTranscript = useWorkspaceStore((s) => s.setLiveTranscript);
  const setIsRecording = useWorkspaceStore((s) => s.setIsRecording);
  const setRecordingDurationSec = useWorkspaceStore((s) => s.setRecordingDurationSec);

  const wasRecordingRef = useRef(false);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingBlobIdRef = useRef<string | null>(null);

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
      stt.start().catch((err) => {
        console.error("[BackgroundRecorder] Start failed:", err);
        setIsRecording(false);
      });
    }

    // STOP recording
    if (!isRecording && wasRecording) {
      stt.stop().then(({ transcript, audioBlob }) => {
        setLiveTranscript(transcript);
        if (audioBlob && audioBlob.size > 0) {
          const blobId = "bg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          pendingBlobIdRef.current = blobId;
          storeBlob(blobId, audioBlob);
        }
      }).catch(console.error);
    }
  }, [isRecording, stt, setIsRecording, setLiveTranscript]);

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

  // ─── Pause/Resume ────────────────────────────────────────────────────
  useEffect(() => {
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
