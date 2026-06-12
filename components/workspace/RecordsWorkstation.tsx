"use client";

// RecordsWorkstation.tsx
//
// Main audio workstation interface for the Records feature.
// Composes:
//   - WaveformVisualizer (real-time canvas)
//   - Audio Toolbar (playback, speed, volume, trim)
//   - Transcription Stream (auto-scrolling live transcript)
//   - AgenticAutomatePanel (right sidebar)
//   - CaptureQueue (recent sessions)
//
// Design: Anthropic-meets-Brutalist — #0E0E0E background, #10B981 accents,
// Geist Sans labels, Geist Mono technical data.

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import { useContinuousSTT } from "@/lib/hooks/useContinuousSTT";
import WaveformVisualizer from "./WaveformVisualizer";
import AgenticAutomatePanel from "./AgenticAutomatePanel";
import CaptureQueue from "./CaptureQueue";
import type { Recording } from "@/lib/slices/recordsSlice";
import {
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  SkipBack,
  SkipForward,
  Scissors,
  Volume2,
  Loader2,
  Clock,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

export default function RecordsWorkstation() {
  const router = useRouter();
  const store = useWorkspaceStore();
  const {
    isRecording,
    isPaused,
    recordingId,
    recordingTitle,
    recordingDurationSec,
    liveTranscript,
    isPlaying,
    playbackSpeed,
    playbackVolume,
    currentPlaybackTime,
    recordings,
    recordingsLoading,
    activeRecordingId,
    automateLoading,
    setIsRecording,
    setIsPaused,
    setRecordingId,
    setRecordingTitle,
    setRecordingDurationSec,
    appendLiveTranscript,
    setLiveTranscript,
    resetRecordingState,
    setIsPlaying,
    setPlaybackSpeed,
    setPlaybackVolume,
    setCurrentPlaybackTime,
    setRecordings,
    setRecordingsLoading,
    setActiveRecordingId,
    upsertRecording,
    updateRecordingStatus,
    openTab,
    setActiveTab,
  } = store;

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ─── Continuous STT Hook ──────────────────────────────────────────────
  const stt = useContinuousSTT({
    onInterimTranscript: useCallback(
      (text: string) => {
        // Update live display with interim results
        setLiveTranscript(text);
      },
      [setLiveTranscript],
    ),
    onFinalizedSegment: useCallback(
      (text: string) => {
        appendLiveTranscript(" " + text);
        // Persist transcript to DB if recording exists
        const rid = useWorkspaceStore.getState().recordingId;
        if (rid) {
          const full = useWorkspaceStore.getState().liveTranscript;
          fetch(`/api/records/${rid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: full }),
          }).catch(() => { /* silent */ });
        }
      },
      [appendLiveTranscript],
    ),
    onTranscriptComplete: useCallback(
      async (fullTranscript: string) => {
        setLiveTranscript(fullTranscript);
      },
      [setLiveTranscript],
    ),
    language: "vi",
    model: "nova-3",
    autoReconnect: true,
  });

  // ─── Duration Timer ────────────────────────────────────────────────────
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

  // ─── Auto-scroll transcript ────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveTranscript]);

  // ─── Load recordings on mount ──────────────────────────────────────────
  useEffect(() => {
    const loadRecordings = async () => {
      setRecordingsLoading(true);
      try {
        const res = await fetch("/api/records");
        if (res.ok) {
          const data = await res.json();
          setRecordings(data);
        }
      } catch (err) {
        console.error("[Records] Failed to load recordings:", err);
      } finally {
        setRecordingsLoading(false);
      }
    };
    loadRecordings();
  }, [setRecordings, setRecordingsLoading]);

  // ─── Audio playback effect ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.playbackRate = playbackSpeed;
      audio.volume = playbackVolume;
      audio.play().catch(() => { /* ignore autoplay blocks */ });
    } else {
      audio.pause();
    }
  }, [isPlaying, playbackSpeed, playbackVolume]);

  // Sync playback time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      if (audio) setCurrentPlaybackTime(audio.currentTime);
    };
    audio.addEventListener("timeupdate", tick);
    return () => audio.removeEventListener("timeupdate", tick);
  }, [setCurrentPlaybackTime]);

  // ─── Recording Controls ────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    try {
      // Create a recording entry in DB
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recordingTitle,
          durationSec: 0,
          transcript: "",
        }),
      });

      if (!res.ok) throw new Error("Failed to create recording");

      const recording = await res.json();
      setRecordingId(recording.id);
      setIsRecording(true);
      setIsPaused(false);
      setLiveTranscript("");
      setRecordingDurationSec(0);

      // Start continuous STT
      await stt.start();

      toast.success("Recording started");
    } catch (err: any) {
      toast.error(err.message || "Failed to start recording");
      console.error("[Records] Start error:", err);
    }
  }, [recordingTitle, setRecordingId, setIsRecording, setIsPaused, setLiveTranscript, setRecordingDurationSec, stt]);

  const handlePauseRecording = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      stt.resume();
      toast("Recording resumed");
    } else {
      setIsPaused(true);
      stt.pause();
      toast("Recording paused");
    }
  }, [isPaused, setIsPaused, stt]);

  const handleStopRecording = useCallback(async () => {
    try {
      const { transcript, audioBlob } = await stt.stop();
      setIsRecording(false);
      setIsPaused(false);
      setLiveTranscript(transcript);

      const rid = useWorkspaceStore.getState().recordingId;
      if (!rid) return;

      const duration = useWorkspaceStore.getState().recordingDurationSec;

      // Upload audio to S3
      let audioKey: string | null = null;
      let audioSizeBytes: number | null = null;

      if (audioBlob && audioBlob.size > 0) {
        const formData = new FormData();
        formData.append("audio", audioBlob, `recording-${rid}.webm`);
        formData.append("recordingId", rid);

        const uploadRes = await fetch("/api/records/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          audioKey = uploadData.key;
          audioSizeBytes = uploadData.sizeBytes;
          setAudioUrl(uploadData.url);
        }
      }

      // Update DB with final transcript + audio info
      const updateRes = await fetch(`/api/records/${rid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          durationSec: duration,
          status: "COMMITTED",
          audioKey,
          audioSizeBytes,
        }),
      });

      if (updateRes.ok) {
        const updated = await updateRes.json();
        upsertRecording(updated);
        toast.success(`Recording saved — ${formatDuration(duration)}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to stop recording");
      console.error("[Records] Stop error:", err);
    }
  }, [stt, setIsRecording, setIsPaused, setLiveTranscript, upsertRecording]);

  // ─── Playback Controls ──────────────────────────────────────────────────

  const handleSelectRecording = useCallback(
    async (rec: Recording) => {
      setActiveRecordingId(rec.id);
      setLiveTranscript(rec.transcript || "");

      // Load audio from S3 if available
      if (rec.audioKey) {
        try {
          const res = await fetch(
            `/api/records/${rec.id}`,
          );
          // Use presigned URL from storage
          const { getDownloadUrl } = await import("@/lib/storage");
          const url = await getDownloadUrl(rec.audioKey);
          setAudioUrl(url);
        } catch {
          setAudioUrl(null);
        }
      } else {
        setAudioUrl(null);
      }
    },
    [setActiveRecordingId, setLiveTranscript],
  );

  // ─── Open as Tab ─────────────────────────────────────────────────────────
  const handleOpenAsTab = useCallback(() => {
    const rid = activeRecordingId;
    if (!rid) return;
    const rec = recordings.find((r) => r.id === rid);
    if (!rec) return;
    openTab(rid, "RECORDS" as any, rec.title);
    setActiveTab(rid);
    router.push(`/workspace/records`);
  }, [activeRecordingId, recordings, openTab, setActiveTab, router]);

  // ─── Duration Display ──────────────────────────────────────────────────
  const durationStr = formatDuration(recordingDurationSec);

  return (
    <div className="flex h-full bg-[#0E0E0E] text-white font-sans overflow-hidden">
      {/* ─── Hidden audio element for playback ──────────────────────── */}
      <audio ref={audioRef} src={audioUrl || undefined} />

      {/* ═══════════════════════════════════════════════════════════════
          MAIN PANEL — Waveform + Toolbar + Transcript
          ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#27272A]">
        {/* ─── Sentinel Status Bar ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span
                className={`${
                  isRecording && !isPaused ? "animate-pulse" : ""
                } absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isRecording ? "bg-[#10B981]" : "bg-zinc-600"
                }`}
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
            </span>
            <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-400 uppercase">
              {isRecording
                ? isPaused
                  ? "SENTINEL PAUSED"
                  : "SENTINEL ACTIVE"
                : "SENTINEL STANDBY"}
            </span>
          </div>

          {isRecording && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#10B981]">
              <Clock className="h-3 w-3" />
              <span>{durationStr}</span>
            </div>
          )}
        </div>

        {/* ─── Waveform ─────────────────────────────────────────────── */}
        <div className="px-3 pt-3">
          <WaveformVisualizer
            isActive={isRecording || isPlaying}
            volume={0.5}
            height={100}
            playbackProgress={
              audioRef.current && audioRef.current.duration
                ? currentPlaybackTime / audioRef.current.duration
                : undefined
            }
          />
        </div>

        {/* ─── Audio Toolbar ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A]">
          {/* Record / Stop */}
          {!isRecording ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#0E0E0E] rounded-sm
                         text-xs font-semibold font-mono uppercase tracking-wider
                         hover:bg-[#10B981]/90 transition-colors"
            >
              <Mic className="h-3.5 w-3.5" />
              Record
            </button>
          ) : (
            <>
              {/* Pause/Resume */}
              <button
                type="button"
                onClick={handlePauseRecording}
                className="flex items-center gap-2 px-3 py-2 border border-[#27272A] rounded-sm
                           text-xs font-semibold font-mono uppercase tracking-wider
                           text-zinc-300 hover:bg-[#131313] transition-colors"
              >
                {isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </>
                )}
              </button>

              {/* Stop */}
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-3 py-2 border border-red-500/50 rounded-sm
                           text-xs font-semibold font-mono uppercase tracking-wider
                           text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            </>
          )}

          {/* Spacer */}
          <div className="w-px h-6 bg-[#27272A] mx-1" />

          {/* Playback controls (for committed recordings) */}
          <button
            type="button"
            disabled={!audioUrl}
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400
                       hover:text-white hover:bg-[#131313] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            disabled={!audioUrl}
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.max(
                  0,
                  audioRef.current.currentTime - 10,
                );
              }
            }}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400
                       hover:text-white hover:bg-[#131313] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="Rewind 10s"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={!audioUrl}
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.min(
                  audioRef.current.duration || 0,
                  audioRef.current.currentTime + 10,
                );
              }
            }}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400
                       hover:text-white hover:bg-[#131313] transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="Forward 10s"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Speed toggles */}
          <div className="flex items-center gap-0.5 ml-2">
            {[1, 1.5, 2].map((speed) => (
              <button
                key={speed}
                type="button"
                disabled={!audioUrl}
                onClick={() => setPlaybackSpeed(speed)}
                className={`
                  px-2 py-1 text-[10px] font-mono rounded-sm border
                  transition-colors
                  ${
                    playbackSpeed === speed
                      ? "border-[#10B981] text-[#10B981] bg-[#10B981]/10"
                      : "border-[#27272A] text-zinc-500 hover:text-zinc-300"
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Volume scrubber */}
          <div className="flex items-center gap-1.5 ml-2">
            <Volume2 className="h-3.5 w-3.5 text-zinc-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={playbackVolume}
              onChange={(e) => setPlaybackVolume(parseFloat(e.target.value))}
              className="w-20 h-1 appearance-none bg-[#27272A] rounded-full
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-[#10B981]
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Trim utility */}
          <button
            type="button"
            disabled={!audioUrl}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400
                       hover:text-white hover:bg-[#131313] transition-colors ml-1
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="Trim audio"
          >
            <Scissors className="h-4 w-4" />
          </button>
        </div>

        {/* ─── Transcription Stream ──────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-[#27272A] flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              {isRecording ? "LIVE TRANSCRIPTION" : "TRANSCRIPT"}
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
              <div className="whitespace-pre-wrap">
                {formatTranscriptWithTimestamps(liveTranscript)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-700 text-xs">
                {isRecording
                  ? "Listening..."
                  : "Select a recording or start a new one"}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT SIDEBAR — Agentic Automate + Capture Queue
          ═══════════════════════════════════════════════════════════════ */}
      <div className="w-[320px] flex flex-col min-h-0 bg-[#0E0E0E]">
        {/* Agentic Automate Panel */}
        <div className="flex-1 min-h-0 border-b border-[#27272A] overflow-y-auto">
          <AgenticAutomatePanel
            recordingId={activeRecordingId || recordingId || ""}
            transcript={liveTranscript}
            hasRecording={!!(activeRecordingId || recordingId)}
          />
        </div>

        {/* Capture Queue */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-[#27272A]">
            <h3 className="text-[10px] font-semibold tracking-widest text-zinc-500 font-mono uppercase flex items-center gap-2">
              <Zap className="h-3 w-3" />
              Capture Queue
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CaptureQueue
              onSelect={handleSelectRecording}
              activeId={activeRecordingId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Rudimentary timestamp insertion for transcript display.
 * If the transcript contains [mm:ss] patterns, renders them highlighted.
 */
function formatTranscriptWithTimestamps(text: string): React.ReactNode {
  const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);
  return parts.map((part, i) => {
    if (/^\[\d{1,2}:\d{2}(?::\d{2})?\]$/.test(part)) {
      return (
        <span
          key={i}
          className="text-[10px] text-[#10B981] font-semibold mr-1"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
