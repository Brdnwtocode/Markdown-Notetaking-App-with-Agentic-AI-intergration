"use client";

// components/workspace/fileViewers/AudioViewer.tsx
//
// Audio player with waveform visualization placeholder and "Open in Records" button.

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import {
  Loader2, Play, Pause, SkipBack, SkipForward,
  Volume2, Download, Mic, ExternalLink,
} from "lucide-react";

interface AudioViewerProps {
  fileId: string;
  fileName: string;
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioViewer({ fileId, fileName }: AudioViewerProps) {
  const router = useRouter();
  const { openTab, setActiveRecordingId } = useWorkspaceStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`);
        if (cancelled) return;
        if (res.data?.url) {
          setUrl(res.data.url);
        } else {
          setError("No playable URL");
        }
      } catch {
        if (!cancelled) setError("Failed to load audio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  const handlePlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const handleSkip = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + sec));
  };

  const handleOpenInRecords = () => {
    setActiveRecordingId(fileId);
    openTab(fileId, "RECORDS", fileName);
    router.push("/workspace/records");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
        <p className="text-sm">{error || "No audio"}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0E0E0E]">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
        <span className="text-xs text-zinc-500 font-technical uppercase tracking-wider">
          AUD · {fileName}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-[10px] font-mono"
          >
            <Download className="h-3 w-3" /> Download
          </a>
          <button
            onClick={handleOpenInRecords}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10 transition-colors text-[10px] font-mono font-bold uppercase tracking-wider"
          >
            <ExternalLink className="h-3 w-3" /> Open in Records
          </button>
        </div>
      </div>

      {/* Player controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        {/* File icon */}
        <div className="w-20 h-20 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
          <Mic className="h-8 w-8 text-[#10B981]" />
        </div>

        <p className="text-sm text-zinc-300 font-mono truncate max-w-xs">{fileName}</p>

        {/* Progress bar */}
        <div className="w-full max-w-md flex items-center gap-3">
          <span className="text-[10px] text-zinc-600 font-mono w-10 text-right">{fmtTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(e) => {
              if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
            }}
            className="flex-1 h-1 appearance-none bg-[#27272A] rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-[10px] text-zinc-600 font-mono w-10">{fmtTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSkip(-10)}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-[#10B981] text-[#0E0E0E] hover:bg-[#10B981]/90 transition-colors"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            onClick={() => handleSkip(10)}
            className="p-2 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Speed */}
          <div className="flex items-center gap-0.5 ml-3">
            {[1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className={`px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors ${
                  speed === s
                    ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/5"
                    : "border-[#27272A] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1 ml-2">
            <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              className="w-16 h-1 appearance-none bg-[#27272A] rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
