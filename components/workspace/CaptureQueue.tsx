"use client";

// CaptureQueue.tsx
//
// High-density data table displaying recent recording sessions.
// Each row shows status badge, title, duration, transcript preview,
// and timestamp — in the Lock In brutalist aesthetic.
//
// Status badges (Geist Mono uppercase):
//   TRANSCRIBING → Emerald border, pulsing dot
//   COMMITTED    → Solid Zinc border, muted text
//   RESOLVING    → Rotating sync icon
//   RECORDING    → Red pulsing dot

import { useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Recording, RecordStatus } from "@/lib/slices/recordsSlice";
import {
  Circle,
  CheckCircle2,
  Loader2,
  Clock,
  FileAudio,
  Trash2,
  ChevronRight,
} from "lucide-react";

interface CaptureQueueProps {
  onSelect: (recording: Recording) => void;
  activeId: string | null;
}

export default function CaptureQueue({ onSelect, activeId }: CaptureQueueProps) {
  const { recordings, recordingsLoading, deleteRecording } = useWorkspaceStore();

  const formattedList = useMemo(() => {
    return recordings.map((rec) => ({
      ...rec,
      shortDate: formatRelativeDate(rec.createdAt),
      durationFormatted: formatDuration(rec.durationSec),
      preview: rec.transcript?.slice(0, 80) || "(no transcript)",
    }));
  }, [recordings]);

  // ─── Status Badge ─────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: RecordStatus }) => {
    const config: Record<
      RecordStatus,
      { icon: React.ElementType; label: string; className: string }
    > = {
      RECORDING: {
        icon: Circle,
        label: "RECORDING",
        className: "border-red-500/50 text-red-400",
      },
      TRANSCRIBING: {
        icon: Circle,
        label: "TRANSCRIBING",
        className: "border-[#10B981]/50 text-[#10B981]",
      },
      RESOLVING: {
        icon: Loader2,
        label: "RESOLVING",
        className: "border-amber-500/50 text-amber-400",
      },
      COMMITTED: {
        icon: CheckCircle2,
        label: "COMMITTED",
        className: "border-[#27272A] text-zinc-500",
      },
    };

    const { icon: Icon, label, className } = config[status];

    return (
      <span
        className={`
          inline-flex items-center gap-1.5 px-2 py-0.5
          border rounded-sm text-[9px] font-mono font-semibold tracking-wider
          ${className}
        `}
      >
        {status === "RECORDING" || status === "TRANSCRIBING" ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
          </span>
        ) : (
          <Icon
            className={`h-2.5 w-2.5 ${
              status === "RESOLVING" ? "animate-spin" : ""
            }`}
          />
        )}
        {label}
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (recordingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 text-[#10B981] animate-spin" />
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
        <FileAudio className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-xs font-mono">NO RECORDINGS YET</p>
        <p className="text-[10px] mt-1">
          Press Record to capture your first session
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        {/* ─── Table Header ──────────────────────────────────────────── */}
        <thead>
          <tr className="border-b border-[#27272A] text-zinc-500 font-mono uppercase tracking-wider">
            <th className="text-left py-2 px-3 w-[100px]">Status</th>
            <th className="text-left py-2 px-3">Title</th>
            <th className="text-left py-2 px-3 w-[80px]">Duration</th>
            <th className="text-left py-2 px-3 hidden md:table-cell">
              Transcript
            </th>
            <th className="text-right py-2 px-3 w-[80px]">Date</th>
            <th className="py-2 px-1 w-[40px]" />
          </tr>
        </thead>

        {/* ─── Table Body ────────────────────────────────────────────── */}
        <tbody>
          {formattedList.map((rec) => {
            const isActive = rec.id === activeId;
            return (
              <tr
                key={rec.id}
                onClick={() => onSelect(rec)}
                className={`
                  border-b border-[#27272A]/50 cursor-pointer
                  transition-colors group
                  ${isActive ? "bg-[#10B981]/5" : "hover:bg-[#131313]"}
                `}
              >
                <td className="py-2.5 px-3">
                  <StatusBadge status={rec.status} />
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-zinc-300 group-hover:text-white transition-colors truncate max-w-[180px]">
                    {rec.title}
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-zinc-500">
                  {rec.durationFormatted}
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell">
                  <div className="text-zinc-600 font-mono truncate max-w-[250px]">
                    {rec.preview}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                  {rec.shortDate}
                </td>
                <td className="py-2.5 px-1 text-right">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRecording(rec.id);
                        // Also call API
                        fetch(`/api/records/${rec.id}`, { method: "DELETE" }).catch(
                          console.error,
                        );
                      }}
                      className="p-1 hover:bg-red-500/10 rounded-sm text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete recording"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <ChevronRight className="h-3 w-3 text-zinc-700" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return "--:--";
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
