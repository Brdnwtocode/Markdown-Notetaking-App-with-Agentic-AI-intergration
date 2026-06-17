"use client";

// RecordsWorkstation.tsx
//
// Main audio workstation UI — local-first recording with explicit save.
// Recording is managed by BackgroundRecorder (mounted in workspace layout),
// so it survives tab switches. This component is just the UI controller.
//
// Flow:
//   1. Click Record → Zustand setIsRecording(true) → BackgroundRecorder starts mic+STT
//   2. Click Stop    → Zustand setIsRecording(false) → BackgroundRecorder stops, stores blob
//   3. Click Save    → POST /api/records + upload blob to S3

import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useWorkspaceStore } from "@/lib/store";
import WaveformVisualizer from "./WaveformVisualizer";
import AgenticAutomatePanel from "./AgenticAutomatePanel";
import CaptureQueue, { getBlob, removeBlob } from "./CaptureQueue";
import type { Recording, LocalRecording } from "@/lib/slices/recordsSlice";
import {
  Play, Pause, Square, Mic, SkipBack, SkipForward,
  Scissors, Volume2, Loader2, Clock, Zap, Save, X,
  FileText, CheckSquare, Table2, Users, CalendarDays,
  Paperclip, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { fmtDuration } from "@/lib/utils";

// Module-level audio URL cache — persists across tab switches.
// Maps recording ID → presigned audio URL. URLs expire after ~1 hour
// but tab switching within a session benefits from instant restore.
// Limited to 50 entries (LRU-style: delete oldest on overflow).
const audioUrlCache = new Map<string, string>();
const AUDIO_URL_CACHE_MAX = 50;
const audioUrlCacheOrder: string[] = []; // insertion-order tracking for LRU eviction
function cacheAudioUrl(id: string, url: string) {
  if (!audioUrlCache.has(id)) {
    if (audioUrlCacheOrder.length >= AUDIO_URL_CACHE_MAX) {
      const oldest = audioUrlCacheOrder.shift();
      if (oldest) audioUrlCache.delete(oldest);
    }
    audioUrlCacheOrder.push(id);
  }
  audioUrlCache.set(id, url);
}
// Module-level flag: once recordings have been fetched, skip re-fetch.
// Invalidated on tab visibility change so returning users see fresh data.
let recordingsFetched = false;
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recordingsFetched = false;
  });
}

export default function RecordsWorkstation() {
  const store = useWorkspaceStore();
  const {
    isRecording, isPaused, sttEnabled, recordingDurationSec, liveTranscript,
    isPlaying, playbackSpeed, playbackVolume, currentPlaybackTime,
    activeRecordingId, recordingId, recordings,
    setIsRecording, setIsPaused, setSttEnabled, setRecordingDurationSec,
    setLiveTranscript, resetRecordingState,
    setIsPlaying, setPlaybackSpeed, setPlaybackVolume, setCurrentPlaybackTime,
    setRecordings, setRecordingsLoading, setActiveRecordingId,
  } = store;

  // ─── Lookup active recording for audio save status ────────────────────
  const activeRecording = activeRecordingId
    ? recordings.find((r) => r.id === activeRecordingId) ?? null
    : null;

  // ─── Local UI state ────────────────────────────────────────────────────
  const [hasUnsavedRecording, setHasUnsavedRecording] = useState(false);

  // ─── Sync stored mutations into AgenticAutomatePanel's result view ────
  // Depend on the full recording object so PATCH updates (after Agentic Automate
  // completes) are reflected immediately in the result panel.
  // IMPORTANT: do NOT clear automateResult for unsaved recordings — the result
  // was just set by AgenticAutomatePanel and must persist for display.
  useEffect(() => {
    if (!activeRecording) {
      // Only clear if there's no unsaved recording (user hasn't just run automate
      // on a fresh recording). hasUnsavedRecording is managed by local useState.
      if (!hasUnsavedRecording) {
        store.setAutomateResult(null);
      }
      return;
    }
    const hasMutations =
      activeRecording.noteMutation ||
      (activeRecording.taskMutations && (activeRecording.taskMutations as any[]).length > 0) ||
      activeRecording.calendarMutation ||
      activeRecording.stackMutation ||
      activeRecording.speakerLabels;
    if (hasMutations) {
      store.setAutomateResult({
        noteMutation: activeRecording.noteMutation ?? undefined,
        taskMutations: activeRecording.taskMutations ?? undefined,
        calendarMutation: activeRecording.calendarMutation ?? undefined,
        stackMutation: activeRecording.stackMutation ?? undefined,
        speakerLabels: activeRecording.speakerLabels ?? undefined,
      });
    } else {
      store.setAutomateResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRecording?.id, activeRecording?.noteMutation, activeRecording?.taskMutations, activeRecording?.calendarMutation, activeRecording?.stackMutation, activeRecording?.speakerLabels, hasUnsavedRecording]);

  const audioSaveStatus: "none" | "saved" | "failed" =
    !activeRecording
      ? "none"
      : activeRecording.audioKey && (activeRecording.audioSizeBytes ?? 0) > 0
        ? "saved"
        : "failed";

  const formattedAudioSize = activeRecording?.audioSizeBytes
    ? activeRecording.audioSizeBytes >= 1_000_000
      ? `${(activeRecording.audioSizeBytes / 1_000_000).toFixed(1)} MB`
      : `${(activeRecording.audioSizeBytes / 1_000).toFixed(0)} KB`
    : null;

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ─── Load persisted recordings ─────────────────────────────────────────
  useEffect(() => {
    // Already fetched (either by pre-fetcher or previous tab visit)
    if (recordingsFetched || recordings.length > 0) {
      if (recordings.length > 0) recordingsFetched = true; // pre-fetcher populated them
      setRecordingsLoading(false);
      return;
    }

    (async () => {
      setRecordingsLoading(true);
      try {
        const res = await fetch("/api/records");
        if (res.ok) setRecordings(await res.json());
        recordingsFetched = true;
      } catch { /* silent */ }
      finally { setRecordingsLoading(false); }
    })();
  }, [setRecordings, setRecordingsLoading]);

  // ─── Auto-scroll transcript ────────────────────────────────────────────
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveTranscript]);

  // ─── Auto-load recording when activeRecordingId changes (e.g. from sidebar) ──
  useEffect(() => {
    if (!activeRecordingId) return;
    const rec = recordings.find((r) => r.id === activeRecordingId);
    if (!rec) return;

    setLiveTranscript(rec.transcript || "");
    setHasUnsavedRecording(false);

    if (rec.audioKey) {
      // Check module-level cache first — prevents re-fetch on tab switch
      const cachedUrl = audioUrlCache.get(rec.id);
      if (cachedUrl) {
        setAudioUrl(cachedUrl);
        return;
      }

      (async () => {
        try {
          const res = await fetch(`/api/records/${rec.id}/audio`);
          if (res.ok) {
            const { url } = await res.json();
            cacheAudioUrl(rec.id, url);
            setAudioUrl(url);
          } else {
            setAudioUrl(null);
          }
        } catch { setAudioUrl(null); }
      })();
    } else {
      setAudioUrl(null);
    }
  }, [activeRecordingId, recordings, setLiveTranscript]);

  // ─── Audio playback sync ───────────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (isPlaying) { a.playbackRate = playbackSpeed; a.volume = playbackVolume; a.play().catch(() => {}); }
    else a.pause();
  }, [isPlaying, playbackSpeed, playbackVolume]);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const tick = () => { if (a) setCurrentPlaybackTime(a.currentTime); };
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, [setCurrentPlaybackTime]);

  // ─── START (dispatches to BackgroundRecorder) ──────────────────────────
  const handleStartRecording = useCallback(() => {
    // Generate a temp client-side ID so AgenticAutomatePanel has a recordingId
    // to reference even before the recording is persisted.
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    store.setRecordingId(tempId);
    setLiveTranscript("");
    setRecordingDurationSec(0);
    setAudioUrl(null);
    setHasUnsavedRecording(false);
    setIsPaused(false);
    setIsRecording(true);
    toast.success("Recording started — survives tab switches");
  }, [setIsRecording, setIsPaused, setLiveTranscript, setRecordingDurationSec, store]);

  // ─── PAUSE / RESUME ────────────────────────────────────────────────────
  const handlePauseRecording = useCallback(() => {
    setIsPaused(!isPaused);
    toast(isPaused ? "Resumed" : "Paused");
  }, [isPaused, setIsPaused]);

  // ─── STOP (BackgroundRecorder handles the actual stop) ─────────────────
  const handleStopRecording = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setHasUnsavedRecording(true);
    toast.success("Recording stopped — click Save to persist");
  }, [setIsRecording, setIsPaused]);

  // ─── Detect when BackgroundRecorder stores a blob ──────────────────────
  // After stopping, BackgroundRecorder asynchronously stores the blob.
  // We poll for it briefly.
  useEffect(() => {
    if (!hasUnsavedRecording) return;
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      const blobId = (useWorkspaceStore.getState() as any)._getPendingBlobId?.();
      if (blobId) {
        const blob = getBlob(blobId);
        if (blob) {
          setAudioUrl(URL.createObjectURL(blob));
          clearInterval(interval);
          return;
        }
      }
      attempts++;
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, [hasUnsavedRecording]);

  // ─── SAVE to DB + S3 ───────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const transcript = useWorkspaceStore.getState().liveTranscript;
    const duration = useWorkspaceStore.getState().recordingDurationSec;
    const title = useWorkspaceStore.getState().recordingTitle;

    setIsSaving(true);

    // Wait for BackgroundRecorder's async stt.stop() to store the blob.
    // Poll up to ~10 s (33 × 300 ms) so rapid Save-after-Stop still captures audio.
    let blob: Blob | undefined;
    let blobId: string | null = null;
    let blobTimedOut = false;
    for (let i = 0; i < 33; i++) {
      blobId = (useWorkspaceStore.getState() as any)._getPendingBlobId?.();
      if (blobId) {
        blob = getBlob(blobId);
        if (blob && blob.size > 0) break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    // If we exhausted all attempts and still have no blob, flag the timeout
    if (!blob || blob.size === 0) {
      blobTimedOut = !blob; // true if blobId never appeared at all
    }

    if (!transcript.trim() && (!blob || blob.size === 0)) {
      if (blobTimedOut) {
        toast.error("Audio capture timed out — the recording may still be processing. Wait a moment and try Save again.");
      } else {
        toast.error("Nothing to save — recording is empty");
      }
      setIsSaving(false);
      return;
    }

    try {
      // 1. Persist recording metadata
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, transcript, durationSec: duration }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Save failed"); }
      const saved = await res.json();

      // 2. Upload audio blob to S3 (if one was captured)
      let audioUploaded = false;
      if (blob && blob.size > 0) {
        const fd = new FormData();
        fd.append("audio", blob, `recording-${saved.id}.webm`);
        fd.append("recordingId", saved.id);
        try {
          const upRes = await fetch("/api/records/upload", { method: "POST", body: fd });
          if (upRes.ok) {
            audioUploaded = true;
          } else {
            const errBody = await upRes.json().catch(() => ({}));
            console.error("[RecordsWorkstation] Audio upload failed:", upRes.status, errBody);
          }
        } catch (uploadErr: any) {
          console.error("[RecordsWorkstation] Audio upload network error:", uploadErr);
        }
      }

      // 3. Clean up local state
      if (blobId) { removeBlob(blobId); (useWorkspaceStore.getState() as any)._clearPendingBlobId?.(); }
      setHasUnsavedRecording(false);
      resetRecordingState();

      if (audioUploaded) {
        toast.success(`"${title}" saved with audio`);
      } else if (blob && blob.size > 0) {
        toast.success(`"${title}" saved (audio upload failed — metadata saved)`);
      } else {
        toast.success(`"${title}" saved (no audio file — transcript saved)`);
      }

      // 4. Refresh the recordings list
      const listRes = await fetch("/api/records");
      if (listRes.ok) setRecordings(await listRes.json());
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [resetRecordingState, setRecordings]);

  // ─── Select persisted recording ────────────────────────────────────────
  // setLiveTranscript is handled by the useEffect on activeRecordingId below;
  // duplicating it here would cause a double-render. Let the effect own it.
  const handleSelectRecording = useCallback(async (rec: Recording) => {
    setActiveRecordingId(rec.id);
    setHasUnsavedRecording(false);
    if (rec.audioKey) {
      const cachedUrl = audioUrlCache.get(rec.id);
      if (cachedUrl) {
        setAudioUrl(cachedUrl);
        return;
      }
      try {
        const res = await fetch(`/api/records/${rec.id}/audio`);
        if (res.ok) {
          const { url } = await res.json();
          cacheAudioUrl(rec.id, url);
          setAudioUrl(url);
        } else {
          setAudioUrl(null);
        }
      } catch { setAudioUrl(null); }
    } else { setAudioUrl(null); }
  }, [setActiveRecordingId]);

  // ─── Select local (unsaved) recording ──────────────────────────────────
  const handleSelectLocal = useCallback((local: LocalRecording, blob?: Blob) => {
    setActiveRecordingId(local.id);
    setLiveTranscript(local.transcript || "");
    setHasUnsavedRecording(true);
    if (blob) setAudioUrl(URL.createObjectURL(blob));
    else setAudioUrl(null);
  }, [setActiveRecordingId, setLiveTranscript]);

  // ─── Clear UI for a fresh recording ────────────────────────────────────
  const handleNewRecording = useCallback(() => {
    setActiveRecordingId(null);
    setLiveTranscript("");
    store.setAutomateResult(null);
    setHasUnsavedRecording(false);
    setAudioUrl(null);
    resetRecordingState();
  }, [setActiveRecordingId, setLiveTranscript, store, resetRecordingState]);

  // ─── Resolve current audio blob for Agentic Automate ──────────────────
  // Synchronous check: returns immediately-available blobs (pending/locally imported).
  // Used for the UI disabled state so the button responds instantly.
  const getCurrentAudioBlob = useCallback((): Blob | null => {
    // 1. Pending blob from BackgroundRecorder (just-stopped recording)
    const blobId = (useWorkspaceStore.getState() as any)._getPendingBlobId?.();
    if (blobId) {
      const blob = getBlob(blobId);
      if (blob) return blob;
    }
    // 2. Selected local recording (imported/dropped file)
    const activeLocal = useWorkspaceStore.getState().localRecordings.find(
      (r) => r.id === activeRecordingId,
    );
    if (activeLocal) {
      const blob = getBlob(activeLocal.id);
      if (blob) return blob;
    }
    return null;
  }, [activeRecordingId]);

  // ─── Async audio resolver: also fetches from S3 for saved recordings ──
  // Called at action-click time so we don't pre-download large files.
  const getAudioBlobAsync = useCallback(async (): Promise<Blob | null> => {
    // 1. Try sync sources first (pending blob / local recording)
    const immediate = getCurrentAudioBlob();
    if (immediate) return immediate;

    // 2. If we have an unsaved recording, BackgroundRecorder may still be
    //    asynchronously storing the blob. Await the ready-promise exposed
    //    by BackgroundRecorder (resolves when blob is stored), then retry.
    if (hasUnsavedRecording) {
      try {
        const readyPromise = (useWorkspaceStore.getState() as any)._getPendingBlobReadyPromise?.();
        if (readyPromise) {
          await readyPromise;
          // Blob should be ready now — try the immediate getter again
          const afterWait = getCurrentAudioBlob();
          if (afterWait) return afterWait;
        }
      } catch { /* promise may not be available yet — fall through to polling */ }

      // Fallback polling (for edge cases where the ready-promise isn't available)
      for (let i = 0; i < 33; i++) {
        const blobId = (useWorkspaceStore.getState() as any)._getPendingBlobId?.();
        if (blobId) {
          const blob = getBlob(blobId);
          if (blob && blob.size > 0) return blob;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      // Timed out — blob never materialized
      return null;
    }

    // 3. For saved recordings with audio in S3, do NOT download here.
    //    S3 presigned URLs don't support CORS from the browser. Instead,
    //    the BFF (/api/records/automate) fetches the audio server-side
    //    using the recording's audioKey. Return null — caller handles this.
    return null;
  }, [activeRecordingId, hasUnsavedRecording, recordings, getCurrentAudioBlob]);

  // ─── Render ─────────────────────────────────────────────────────────────
  const durationStr = fmtDuration(recordingDurationSec);

  return (
    <div className="h-full bg-[#0E0E0E] text-white font-sans overflow-hidden">
      <audio ref={audioRef} src={audioUrl || undefined} />

      <PanelGroup direction="horizontal" autoSaveId="records-layout">
        {/* ═══════════ MAIN PANEL ═══════════ */}
        <Panel defaultSize={55} minSize={35}>
          <div className="h-full min-w-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {/* ═══════════ Recording Zone ═══════════════════════════════════ */}
        <div className="px-6 pt-6 pb-5 space-y-5">
          {/* ── Recording indicator + timer ── */}
          {isRecording && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`${!isPaused ? "animate-pulse" : ""} absolute inline-flex h-full w-full rounded-full opacity-75 bg-[#10B981]`} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
                </span>
                <span className="text-xs font-mono font-semibold tracking-widest text-zinc-300 uppercase">
                  {isPaused ? "Paused" : "Recording"}
                </span>
              </div>
              <span className="text-xl font-mono font-semibold text-[#10B981] tracking-wider tabular-nums">{durationStr}</span>
            </div>
          )}

          {/* ── Unsaved indicator ── */}
          {!isRecording && hasUnsavedRecording && (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500/60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="text-xs font-mono font-semibold tracking-widest text-amber-400 uppercase">Unsaved Recording</span>
              <span className="text-[10px] font-mono text-amber-500/60">⚠ Local only</span>
            </div>
          )}

          {/* ── Waveform ── */}
          {isRecording && (
            <WaveformVisualizer isActive={isRecording} volume={0.5} height={90}
              playbackProgress={audioRef.current?.duration ? currentPlaybackTime / audioRef.current.duration : undefined} />
          )}

          {/* ── Recording controls ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {!isRecording ? (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={handleStartRecording}
                    className="flex items-center gap-2.5 px-5 py-2.5 border border-[#10B981]/30 text-[#10B981] rounded-lg text-xs font-semibold font-mono uppercase tracking-wider hover:bg-[#10B981]/10 hover:border-[#10B981]/50 transition-all duration-200">
                    <Mic className="h-4 w-4" />Record
                  </button>

                  {(activeRecordingId || hasUnsavedRecording) && (
                    <button onClick={handleNewRecording}
                      className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1A1A1A] transition-colors"
                      title="Clear UI">
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono cursor-pointer transition-colors border ${
                    sttEnabled
                      ? "border-[#10B981]/20 text-[#10B981]/80 bg-[#10B981]/5"
                      : "border-[#27272A] text-zinc-500 hover:border-zinc-600"
                  }`}>
                    <input type="checkbox" checked={sttEnabled} onChange={(e) => setSttEnabled(e.target.checked)} className="sr-only" />
                    <span className={`relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors ${sttEnabled ? "bg-[#10B981]/30" : "bg-[#27272A]"}`}>
                      <span className={`inline-block h-3 w-3 rounded-full transition-transform mt-0.5 ml-0.5 ${sttEnabled ? "translate-x-4 bg-[#10B981]" : "translate-x-0 bg-zinc-500"}`} />
                    </span>
                    <span className="select-none">STT</span>
                  </label>
                </div>

                {hasUnsavedRecording && (
                  <button onClick={handleSave} disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold font-mono uppercase tracking-wider hover:bg-amber-500/10 hover:border-amber-500/50 transition-all duration-200 disabled:opacity-40">
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={handlePauseRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono uppercase tracking-wider transition-colors border ${
                      isPaused
                        ? "border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-zinc-600 text-zinc-300 hover:border-zinc-400"
                    }`}>
                    {isPaused ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
                  </button>

                  <button onClick={handleStopRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono uppercase tracking-wider border border-zinc-600 text-zinc-300 hover:border-red-500/40 hover:text-red-400 transition-colors">
                    <Square className="h-3.5 w-3.5" />Stop
                  </button>
                </div>

                <span className="text-[10px] font-mono text-zinc-500">
                  STT {sttEnabled ? "ON" : "OFF"}
                </span>
              </>
            )}
          </div>

          {/* ── Playback controls ── */}
          <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <button disabled={!audioUrl} onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button disabled={!audioUrl} onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1A1A1A] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                  <SkipBack className="h-3.5 w-3.5" /></button>
                <button disabled={!audioUrl} onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration||0, audioRef.current.currentTime + 10); }}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1A1A1A] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                  <SkipForward className="h-3.5 w-3.5" /></button>
              </div>

              <div className="flex items-center gap-3">
                {[1, 1.5, 2].map(s => (
                  <button key={s} disabled={!audioUrl} onClick={() => setPlaybackSpeed(s)}
                    className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
                      playbackSpeed === s ? "text-[#10B981] bg-[#10B981]/10" : "text-zinc-500 hover:text-zinc-300"
                    }`}>
                    {s}×</button>
                ))}

                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-zinc-600" />
                  <input type="range" min="0" max="1" step="0.05" value={playbackVolume}
                    onChange={e => setPlaybackVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 appearance-none bg-[#27272A] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:cursor-pointer" />
                </div>

                <button disabled={!audioUrl}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1A1A1A] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                  <Scissors className="h-3.5 w-3.5" /></button>
              </div>
            </div>

          {/* ── Audio save status ── */}
          {audioSaveStatus === "saved" && formattedAudioSize && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#10B981]/60">
              <CheckSquare className="h-3 w-3" />
              Audio saved ({formattedAudioSize})
            </div>
          )}
          {audioSaveStatus === "failed" && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-red-400/70">
              <AlertTriangle className="h-3 w-3" />
              Audio save failed — transcript only
            </div>
          )}

          {/* ── Agentic Automate ── */}
          <AgenticAutomatePanel
            recordingId={hasUnsavedRecording ? (recordingId || "") : (activeRecordingId || "")}
            transcript={liveTranscript}
            hasRecording={!!(activeRecordingId || hasUnsavedRecording)}
            immediateAudioBlob={getCurrentAudioBlob()}
            hasS3Audio={audioSaveStatus === "saved"}
            getAudioBlob={getAudioBlobAsync}
          />
        </div>

        {/* ─── Recording Insights ─────────────────────────────────────── */}
        {activeRecording && (
          <div className="px-5 pb-4">
            {/* Header — click to toggle */}
            <button
              onClick={() => setInsightsExpanded(!insightsExpanded)}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#131313]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
                  Recording Insights
                </span>
                {/* Status pill */}
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase tracking-wider border ${
                  activeRecording.status === "COMMITTED" ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/5" :
                  activeRecording.status === "RESOLVING" ? "border-amber-500/40 text-amber-400 bg-amber-500/5" :
                  activeRecording.status === "TRANSCRIBING" ? "border-blue-500/40 text-blue-400 bg-blue-500/5" :
                  "border-red-500/40 text-red-400 bg-red-500/5"
                }`}>
                  {activeRecording.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Compact mutation badges */}
                {activeRecording.noteMutation && (
                  <span className="text-[9px] font-mono text-[#10B981]/60 flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />Note
                  </span>
                )}
                {activeRecording.taskMutations && (activeRecording.taskMutations as any[]).length > 0 && (
                  <span className="text-[9px] font-mono text-[#10B981]/60 flex items-center gap-1">
                    <CheckSquare className="h-2.5 w-2.5" />{(activeRecording.taskMutations as any[]).length}
                  </span>
                )}
                {activeRecording.calendarMutation && (
                  <span className="text-[9px] font-mono text-[#10B981]/60 flex items-center gap-1">
                    <CalendarDays className="h-2.5 w-2.5" />Event
                  </span>
                )}
                {activeRecording.speakerLabels && (
                  <span className="text-[9px] font-mono text-[#10B981]/60 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />Speakers
                  </span>
                )}
                {activeRecording.attachments && activeRecording.attachments.length > 0 && (
                  <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1">
                    <Paperclip className="h-2.5 w-2.5" />{activeRecording.attachments.length}
                  </span>
                )}
                {insightsExpanded ? <ChevronUp className="h-3 w-3 text-zinc-600" /> : <ChevronDown className="h-3 w-3 text-zinc-600" />}
              </div>
            </button>

            {/* Expanded content */}
            {insightsExpanded && (
              <div className="px-4 pb-3 space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {/* Error log */}
                {activeRecording.errorLog && (
                  <div className="flex items-start gap-2 p-2 rounded-sm bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-mono text-red-400/80 leading-relaxed">{activeRecording.errorLog}</p>
                  </div>
                )}

                {/* Note Mutation */}
                {activeRecording.noteMutation && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="h-3 w-3 text-[#10B981]" />
                      <span className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider">Generated Note</span>
                    </div>
                    <p className="text-[11px] font-mono font-semibold text-zinc-300 mb-1">
                      {(activeRecording.noteMutation as any).title}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 leading-relaxed line-clamp-4">
                      {(activeRecording.noteMutation as any).content?.slice(0, 400)}
                    </p>
                  </div>
                )}

                {/* Task Mutations */}
                {activeRecording.taskMutations && (activeRecording.taskMutations as any[]).length > 0 && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckSquare className="h-3 w-3 text-[#10B981]" />
                      <span className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider">
                        Extracted Tasks ({(activeRecording.taskMutations as any[]).length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {(activeRecording.taskMutations as any[]).map((task: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-[10px] font-mono">
                          <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                            task.status === "DONE" ? "bg-[#10B981]" :
                            task.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-zinc-600"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-zinc-300">{task.title}</span>
                            {task.dueDate && (
                              <span className="ml-2 text-zinc-600">{new Date(task.dueDate).toLocaleDateString()}</span>
                            )}
                          </div>
                          {task.priority && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase ${
                              task.priority === "HIGH" ? "text-red-400 bg-red-500/10" :
                              task.priority === "MEDIUM" ? "text-amber-400 bg-amber-500/10" :
                              "text-zinc-400 bg-zinc-500/10"
                            }`}>{task.priority}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calendar Mutation */}
                {activeRecording.calendarMutation && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CalendarDays className="h-3 w-3 text-[#10B981]" />
                      <span className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider">Calendar Event</span>
                    </div>
                    <p className="text-[11px] font-mono font-semibold text-zinc-300 mb-1">
                      {(activeRecording.calendarMutation as any).title}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                      <span>{(activeRecording.calendarMutation as any).startAt ? new Date((activeRecording.calendarMutation as any).startAt).toLocaleString() : "—"}</span>
                      <span className="text-zinc-700">→</span>
                      <span>{(activeRecording.calendarMutation as any).endAt ? new Date((activeRecording.calendarMutation as any).endAt).toLocaleString() : "—"}</span>
                      {(activeRecording.calendarMutation as any).allDay && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase bg-blue-500/10 text-blue-400">All Day</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Stack Mutation */}
                {activeRecording.stackMutation && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Table2 className="h-3 w-3 text-[#10B981]" />
                      <span className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider">Stack Mutation</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400">
                      {(activeRecording.stackMutation as any).stackName || "Stack data available"}
                    </p>
                  </div>
                )}

                {/* Speaker Labels */}
                {activeRecording.speakerLabels && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="h-3 w-3 text-[#10B981]" />
                      <span className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider">
                        Speaker Diarization
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(activeRecording.speakerLabels as any[]).map((sp: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] text-[9px] font-semibold">
                            {sp.speaker}
                          </span>
                          <span className="text-zinc-500">{sp.segments?.length ?? 0} segments</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {activeRecording.attachments && activeRecording.attachments.length > 0 && (
                  <div className="p-2.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Paperclip className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                        Attachments ({activeRecording.attachments.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {activeRecording.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                          <span className="truncate flex-1">{att.fileName}</span>
                          <span className="text-zinc-700 shrink-0">{att.mimeType}</span>
                          <span className="text-zinc-700 shrink-0">{att.sizeBytes >= 1000000 ? `${(att.sizeBytes / 1000000).toFixed(1)} MB` : `${Math.round(att.sizeBytes / 1000)} KB`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state — no mutations at all */}
                {!activeRecording.noteMutation &&
                 !(activeRecording.taskMutations && (activeRecording.taskMutations as any[]).length > 0) &&
                 !activeRecording.calendarMutation &&
                 !activeRecording.stackMutation &&
                 !activeRecording.speakerLabels &&
                 !activeRecording.errorLog &&
                 !(activeRecording.attachments && activeRecording.attachments.length > 0) && (
                  <p className="text-[10px] font-mono text-zinc-700 text-center py-3">
                    No AI results or attachments yet. Run Agentic Automate to generate insights.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transcript */}
        <div className="border-t border-[#1A1A1A]">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              {isRecording && !sttEnabled ? "Recording (STT Off)" : isRecording ? "Live Transcription" : "Transcript"}
            </span>
            {isRecording && !isPaused && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-500" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
            )}
          </div>
          <div className="px-5 pb-5 font-mono text-sm leading-relaxed text-zinc-400">
            {liveTranscript ? (
              <div className="whitespace-pre-wrap">{liveTranscript}</div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-700 text-xs">
                {isRecording && !sttEnabled
                  ? "Recording audio only — STT is off"
                  : isRecording
                    ? "Listening..."
                    : "Select a recording or start a new one"}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
      </Panel>

      {/* ─── Resize Handle ──────────────────────────────────────────── */}
      <PanelResizeHandle className="w-[3px] bg-[#27272A] hover:bg-[#10B981]/50 active:bg-[#10B981] transition-colors cursor-col-resize shrink-0" />

      {/* ═══════════ RIGHT SIDEBAR ═══════════ */}
      <Panel defaultSize={35} minSize={22}>
        <div className="flex flex-col h-full min-w-0 bg-[#0E0E0E]">
          <div className="px-3 py-2 border-b border-[#27272A]">
            <h3 className="text-[10px] font-semibold tracking-widest text-zinc-500 font-mono uppercase flex items-center gap-2">
              <Zap className="h-3 w-3" />Capture Queue
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <CaptureQueue
              onSelect={handleSelectRecording}
              onSelectLocal={handleSelectLocal}
              activeId={activeRecordingId}
            />
          </div>
        </div>
      </Panel>
    </PanelGroup>
    </div>
  );
}


