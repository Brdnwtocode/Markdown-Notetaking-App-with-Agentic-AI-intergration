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
  Scissors, Volume2, Loader2, Clock, Zap, Save,
} from "lucide-react";
import { toast } from "@/lib/toast";

export default function RecordsWorkstation() {
  const store = useWorkspaceStore();
  const {
    isRecording, isPaused, sttEnabled, recordingDurationSec, liveTranscript,
    isPlaying, playbackSpeed, playbackVolume, currentPlaybackTime,
    activeRecordingId, recordings,
    setIsRecording, setIsPaused, setSttEnabled, setRecordingDurationSec,
    setLiveTranscript, resetRecordingState,
    setIsPlaying, setPlaybackSpeed, setPlaybackVolume, setCurrentPlaybackTime,
    setRecordings, setRecordingsLoading, setActiveRecordingId,
  } = store;

  // ─── Lookup active recording for audio save status ────────────────────
  const activeRecording = activeRecordingId
    ? recordings.find((r) => r.id === activeRecordingId) ?? null
    : null;

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
  const [hasUnsavedRecording, setHasUnsavedRecording] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ─── Load persisted recordings ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setRecordingsLoading(true);
      try {
        const res = await fetch("/api/records");
        if (res.ok) setRecordings(await res.json());
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
    // Skip if already loaded (avoid re-fetching during save flow)
    setLiveTranscript(rec.transcript || "");
    setHasUnsavedRecording(false);
    if (rec.audioKey) {
      (async () => {
        try {
          const res = await fetch(`/api/records/${rec.id}/audio`);
          if (res.ok) {
            const { url } = await res.json();
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
    setLiveTranscript("");
    setRecordingDurationSec(0);
    setAudioUrl(null);
    setHasUnsavedRecording(false);
    setIsPaused(false);
    setIsRecording(true);
    toast.success("Recording started — survives tab switches");
  }, [setIsRecording, setIsPaused, setLiveTranscript, setRecordingDurationSec]);

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
    // Poll up to ~9 s (30 × 300 ms) so rapid Save-after-Stop still captures audio.
    let blob: Blob | undefined;
    let blobId: string | null = null;
    for (let i = 0; i < 30; i++) {
      blobId = (useWorkspaceStore.getState() as any)._getPendingBlobId?.();
      if (blobId) {
        blob = getBlob(blobId);
        if (blob && blob.size > 0) break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!transcript.trim() && (!blob || blob.size === 0)) {
      toast.error("Nothing to save — recording is empty");
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
  const handleSelectRecording = useCallback(async (rec: Recording) => {
    setActiveRecordingId(rec.id);
    setLiveTranscript(rec.transcript || "");
    setHasUnsavedRecording(false);
    if (rec.audioKey) {
      try {
        const res = await fetch(`/api/records/${rec.id}/audio`);
        if (res.ok) {
          const { url } = await res.json();
          setAudioUrl(url);
        } else {
          setAudioUrl(null);
        }
      } catch { setAudioUrl(null); }
    } else { setAudioUrl(null); }
  }, [setActiveRecordingId, setLiveTranscript]);

  // ─── Select local (unsaved) recording ──────────────────────────────────
  const handleSelectLocal = useCallback((local: LocalRecording, blob?: Blob) => {
    setActiveRecordingId(local.id);
    setLiveTranscript(local.transcript || "");
    setHasUnsavedRecording(true);
    if (blob) setAudioUrl(URL.createObjectURL(blob));
    else setAudioUrl(null);
  }, [setActiveRecordingId, setLiveTranscript]);

  // ─── Resolve current audio blob for Agentic Automate ──────────────────
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

  // ─── Render ─────────────────────────────────────────────────────────────
  const durationStr = fmtDuration(recordingDurationSec);

  return (
    <div className="h-full bg-[#0E0E0E] text-white font-sans overflow-hidden">
      <audio ref={audioRef} src={audioUrl || undefined} />

      <PanelGroup direction="horizontal" autoSaveId="records-layout">
        {/* ═══════════ MAIN PANEL ═══════════ */}
        <Panel defaultSize={55} minSize={35}>
          <div className="flex flex-col h-full min-w-0">
        {/* Sentinel status */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className={`${isRecording && !isPaused ? "animate-pulse" : ""} absolute inline-flex h-full w-full rounded-full opacity-75 ${isRecording ? "bg-[#10B981]" : "bg-zinc-600"}`} />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
            </span>
            <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-400 uppercase">
              {isRecording ? (isPaused ? "SENTINEL PAUSED" : "SENTINEL ACTIVE") : hasUnsavedRecording ? "UNSAVED RECORDING" : "SENTINEL STANDBY"}
            </span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#10B981]">
              <Clock className="h-3 w-3" /><span>{durationStr}</span>
            </div>
          )}
          {hasUnsavedRecording && !isRecording && (
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">⚠ Local only</span>
          )}
          {/* Audio save status badge for persisted recordings */}
          {audioSaveStatus === "saved" && formattedAudioSize && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-40" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
              </span>
              ✔ Audio Saved ({formattedAudioSize})
            </span>
          )}
          {audioSaveStatus === "failed" && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 uppercase tracking-wider">
              ⚠ Transcript Only / Audio Save Failed
            </span>
          )}
        </div>

        {/* Waveform */}
        <div className="px-3 pt-3">
          <WaveformVisualizer isActive={isRecording || isPlaying} volume={0.5} height={100}
            playbackProgress={audioRef.current?.duration ? currentPlaybackTime / audioRef.current.duration : undefined} />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A] flex-wrap">
          {!isRecording ? (
            <>
              <button onClick={handleStartRecording}
                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#0E0E0E] rounded-sm text-xs font-semibold font-mono uppercase tracking-wider hover:bg-[#10B981]/90 transition-colors">
                <Mic className="h-3.5 w-3.5" />Record
              </button>
              {/* STT Toggle — locked once recording starts */}
              <label className={`flex items-center gap-2 px-3 py-2 border rounded-sm text-xs font-mono cursor-pointer transition-colors ${sttEnabled ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/5" : "border-[#27272A] text-zinc-500 hover:border-zinc-600"}`}>
                <input
                  type="checkbox"
                  checked={sttEnabled}
                  onChange={(e) => setSttEnabled(e.target.checked)}
                  className="sr-only"
                />
                <span className={`relative inline-flex h-4 w-8 shrink-0 rounded-full border transition-colors ${sttEnabled ? "border-[#10B981] bg-[#10B981]/20" : "border-[#27272A] bg-[#27272A]/50"}`}>
                  <span className={`inline-block h-3 w-3 rounded-full transition-transform mt-[1px] ml-[1px] ${sttEnabled ? "translate-x-4 bg-[#10B981]" : "translate-x-0 bg-zinc-500"}`} />
                </span>
                <span className="select-none">STT</span>
              </label>
              {hasUnsavedRecording && (
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 border border-amber-500/50 text-amber-400 rounded-sm text-xs font-semibold font-mono uppercase tracking-wider hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isSaving ? "SAVING..." : "SAVE"}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={handlePauseRecording}
                className="flex items-center gap-2 px-3 py-2 border border-[#27272A] rounded-sm text-xs font-semibold font-mono uppercase tracking-wider text-zinc-300 hover:bg-[#131313] transition-colors">
                {isPaused ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
              </button>
              <button onClick={handleStopRecording}
                className="flex items-center gap-2 px-3 py-2 border border-red-500/50 rounded-sm text-xs font-semibold font-mono uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors">
                <Square className="h-3.5 w-3.5" />Stop
              </button>
              {/* STT locked indicator */}
              <span className={`px-2 py-1 border rounded-sm text-[10px] font-mono ${sttEnabled ? "border-[#10B981]/30 text-[#10B981]/60" : "border-[#27272A] text-zinc-600"}`}>
                STT {sttEnabled ? "ON" : "OFF"}
              </span>
            </>
          )}

          <div className="w-px h-6 bg-[#27272A] mx-1" />

          {/* Playback */}
          <button disabled={!audioUrl} onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-[#131313] disabled:opacity-30 disabled:cursor-not-allowed">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button disabled={!audioUrl} onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-[#131313] disabled:opacity-30 disabled:cursor-not-allowed">
            <SkipBack className="h-4 w-4" /></button>
          <button disabled={!audioUrl} onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration||0, audioRef.current.currentTime + 10); }}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-[#131313] disabled:opacity-30 disabled:cursor-not-allowed">
            <SkipForward className="h-4 w-4" /></button>

          {/* Speed */}
          <div className="flex items-center gap-0.5 ml-2">
            {[1, 1.5, 2].map(s => (
              <button key={s} disabled={!audioUrl} onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${playbackSpeed === s ? "border-[#10B981] text-[#10B981] bg-[#10B981]/10" : "border-[#27272A] text-zinc-500 hover:text-zinc-300"}`}>
                {s}x</button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1.5 ml-2">
            <Volume2 className="h-3.5 w-3.5 text-zinc-600" />
            <input type="range" min="0" max="1" step="0.05" value={playbackVolume}
              onChange={e => setPlaybackVolume(parseFloat(e.target.value))}
              className="w-20 h-1 appearance-none bg-[#27272A] rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:cursor-pointer" />
          </div>

          <button disabled={!audioUrl}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-[#131313] ml-1 disabled:opacity-30 disabled:cursor-not-allowed">
            <Scissors className="h-4 w-4" /></button>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-[#27272A] flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              {isRecording && !sttEnabled ? "RECORDING (STT OFF)" : isRecording ? "LIVE TRANSCRIPTION" : "TRANSCRIPT"}
            </span>
            {isRecording && !isPaused && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[#10B981]" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed text-zinc-400">
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
      <Panel defaultSize={45} minSize={25}>
        <div className="flex flex-col h-full min-w-0 bg-[#0E0E0E]">
        <PanelGroup direction="vertical" autoSaveId="records-sidebar">
          <Panel defaultSize={45} minSize={20}>
            <div className="h-full overflow-y-auto">
              <AgenticAutomatePanel
                recordingId={activeRecordingId || ""}
                transcript={liveTranscript}
                hasRecording={!!(activeRecordingId || hasUnsavedRecording)}
                audioBlob={getCurrentAudioBlob()}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="h-[3px] bg-[#27272A] hover:bg-[#10B981]/50 active:bg-[#10B981] transition-colors cursor-row-resize shrink-0" />
          <Panel defaultSize={55} minSize={20}>
            <div className="flex flex-col h-full min-h-0">
          <div className="px-3 py-2 border-b border-[#27272A]">
            <h3 className="text-[10px] font-semibold tracking-widest text-zinc-500 font-mono uppercase flex items-center gap-2">
              <Zap className="h-3 w-3" />Capture Queue
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
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
      </Panel>
    </PanelGroup>
    </div>
  );
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
