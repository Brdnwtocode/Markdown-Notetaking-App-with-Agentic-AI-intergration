"use client";

// CaptureQueue.tsx
//
// High-density data table of recording sessions (both saved & local).
// Includes a drag-and-drop zone for importing external audio files.
//
// File validation:
//   Accepted: .wav, .mp3, .webm, .ogg, .m4a, .flac, .aac
//   Max size: 500 MB
//
// Local recordings show an "UNSAVED" badge until explicitly persisted.

import { useCallback, useState, useRef } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Recording, RecordStatus, LocalRecording } from "@/lib/slices/recordsSlice";
import {
  Circle,
  CheckCircle2,
  Loader2,
  FileAudio,
  Trash2,
  ChevronRight,
  Upload,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Accepted audio types ─────────────────────────────────────────────────
const ACCEPTED_EXTENSIONS = [
  ".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".mp4",
];
const ACCEPTED_MIME = [
  "audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/flac",
  "audio/aac", "audio/x-ms-wma",
];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

function isValidAudioFile(file: File): string | null {
  if (!file || file.size === 0) return "File is empty";
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const mimeOk = ACCEPTED_MIME.includes(file.type);
  const extOk = ACCEPTED_EXTENSIONS.includes(ext || "");
  if (!mimeOk && !extOk) {
    return `Unsupported: ${file.type || ext}. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 500MB`;
  }
  return null;
}

// ─── In-memory blob store (outside Zustand — Blobs aren't serializable) ──
const blobMap = new Map<string, Blob>();
export function storeBlob(id: string, blob: Blob) { blobMap.set(id, blob); }
export function getBlob(id: string): Blob | undefined { return blobMap.get(id); }
export function removeBlob(id: string) { blobMap.delete(id); }

// ─── Props ─────────────────────────────────────────────────────────────────

interface CaptureQueueProps {
  onSelect: (recording: Recording) => void;
  onSelectLocal: (local: LocalRecording, blob?: Blob) => void;
  activeId: string | null;
}

export default function CaptureQueue({ onSelect, onSelectLocal, activeId }: CaptureQueueProps) {
  const {
    recordings,
    recordingsLoading,
    localRecordings,
    deleteRecording,
    addLocalRecording,
    removeLocalRecording,
    setRecordings,
  } = useWorkspaceStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Process dropped/selected files ────────────────────────────────────
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      let added = 0;
      for (const file of Array.from(files)) {
        const error = isValidAudioFile(file);
        if (error) { toast.error(error); continue; }
        const id = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        const local: LocalRecording = {
          id,
          title: file.name.replace(/\.[^.]+$/, ""),
          durationSec: 0,
          transcript: "",
          createdAt: new Date().toISOString(),
          source: "imported",
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "audio/webm",
        };
        storeBlob(id, file);
        addLocalRecording(local);
        added++;
      }
      if (added > 0) toast.success(`${added} file(s) imported — unsaved`);
    },
    [addLocalRecording],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; }
  }, [processFiles]);

  // ─── Save local → persist to DB + S3 ───────────────────────────────────
  const handleSaveLocal = useCallback(async (e: React.MouseEvent, local: LocalRecording) => {
    e.stopPropagation();
    const blob = getBlob(local.id);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: local.title, transcript: local.transcript, durationSec: local.durationSec }),
      });
      if (!res.ok) throw new Error("Failed to create record");
      const saved = await res.json();

      if (blob && blob.size > 0) {
        const fd = new FormData();
        fd.append("audio", blob, local.fileName || `recording-${saved.id}.webm`);
        fd.append("recordingId", saved.id);
        const upRes = await fetch("/api/records/upload", { method: "POST", body: fd });
        if (upRes.ok) {
          const upData = await upRes.json();
          await fetch(`/api/records/${saved.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioKey: upData.key, audioSizeBytes: upData.sizeBytes, status: "COMMITTED" }),
          });
        }
      }

      removeLocalRecording(local.id);
      removeBlob(local.id);
      toast.success(`"${local.title}" saved`);
      const listRes = await fetch("/api/records");
      if (listRes.ok) setRecordings(await listRes.json());
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    }
  }, [removeLocalRecording, setRecordings]);

  // ─── Status badge ───────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: RecordStatus }) => {
    const map: Record<RecordStatus, { Icon: React.ElementType; label: string; cls: string }> = {
      RECORDING: { Icon: Circle, label: "RECORDING", cls: "border-red-500/50 text-red-400" },
      TRANSCRIBING: { Icon: Circle, label: "TRANSCRIBING", cls: "border-[#10B981]/50 text-[#10B981]" },
      RESOLVING: { Icon: Loader2, label: "RESOLVING", cls: "border-amber-500/50 text-amber-400" },
      COMMITTED: { Icon: CheckCircle2, label: "COMMITTED", cls: "border-[#27272A] text-zinc-500" },
    };
    const { Icon, label, cls } = map[status];
    const isPulse = status === "RECORDING" || status === "TRANSCRIBING";
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[9px] font-mono font-semibold tracking-wider ${cls}`}>
        {isPulse ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
          </span>
        ) : (
          <Icon className={`h-2.5 w-2.5 ${status === "RESOLVING" ? "animate-spin" : ""}`} />
        )}
        {label}
      </span>
    );
  };

  const hasItems = recordings.length > 0 || localRecordings.length > 0;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {recordingsLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 text-[#10B981] animate-spin" /></div>
        ) : !hasItems ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
            <FileAudio className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs font-mono">NO RECORDINGS YET</p>
            <p className="text-[10px] mt-1 text-center px-4">Press Record or drop audio below</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#27272A] text-zinc-500 font-mono uppercase tracking-wider sticky top-0 bg-[#0E0E0E]">
                <th className="text-left py-2 px-3 w-[90px]">Status</th>
                <th className="text-left py-2 px-3">Title</th>
                <th className="text-left py-2 px-3 w-[70px]">Duration</th>
                <th className="text-right py-2 px-1 w-[60px]" />
              </tr>
            </thead>
            <tbody>
              {recordings.map((rec) => (
                <tr key={rec.id} onClick={() => onSelect(rec)}
                  className={`border-b border-[#27272A]/50 cursor-pointer transition-colors group ${rec.id === activeId ? "bg-[#10B981]/5" : "hover:bg-[#131313]"}`}>
                  <td className="py-2 px-3"><StatusBadge status={rec.status} /></td>
                  <td className="py-2 px-3"><div className="font-medium text-zinc-300 group-hover:text-white truncate max-w-[140px]">{rec.title}</div></td>
                  <td className="py-2 px-3 font-mono text-zinc-500">{fmtDuration(rec.durationSec)}</td>
                  <td className="py-2 px-1 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); deleteRecording(rec.id); fetch(`/api/records/${rec.id}`, { method: "DELETE" }).catch(() => {}); }}
                        className="p-1 hover:bg-red-500/10 rounded-sm text-zinc-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                      <ChevronRight className="h-3 w-3 text-zinc-700" />
                    </div>
                  </td>
                </tr>
              ))}
              {localRecordings.map((loc) => (
                <tr key={loc.id} onClick={() => onSelectLocal(loc, getBlob(loc.id))}
                  className={`border-b border-[#27272A]/50 cursor-pointer transition-colors group ${loc.id === activeId ? "bg-amber-500/5" : "hover:bg-[#131313]"}`}>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[9px] font-mono font-semibold tracking-wider border-amber-500/40 text-amber-400">
                      <Circle className="h-2 w-2 fill-amber-400" />UNSAVED
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-amber-300/80 group-hover:text-amber-200 truncate max-w-[140px]">{loc.title}</div>
                    {loc.fileName && <div className="text-[9px] text-zinc-600 font-mono truncate">{loc.fileName}</div>}
                  </td>
                  <td className="py-2 px-3 font-mono text-zinc-500">{loc.durationSec > 0 ? fmtDuration(loc.durationSec) : "--:--"}</td>
                  <td className="py-2 px-1 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleSaveLocal(e, loc)}
                        className="p-1 hover:bg-[#10B981]/10 rounded-sm text-zinc-600 hover:text-[#10B981]" title="Save to cloud"><Save className="h-3 w-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeLocalRecording(loc.id); removeBlob(loc.id); }}
                        className="p-1 hover:bg-red-500/10 rounded-sm text-zinc-600 hover:text-red-400" title="Discard"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Drop Zone ──────────────────────────────────────────────────── */}
      <div
        className={`border-t border-[#27272A] p-3 transition-colors cursor-pointer ${isDragOver ? "bg-[#10B981]/10 border-[#10B981]/50" : "bg-[#0E0E0E] hover:bg-[#131313]"}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} multiple className="hidden" onChange={handleFileSelect} />
        <div className="flex flex-col items-center gap-1.5 py-2">
          <Upload className={`h-5 w-5 ${isDragOver ? "text-[#10B981]" : "text-zinc-600"}`} />
          <p className="text-[10px] font-mono text-zinc-500 text-center">{isDragOver ? "DROP TO IMPORT" : "DROP AUDIO FILES HERE"}</p>
          <p className="text-[9px] text-zinc-700 font-mono">WAV, MP3, WEBM, OGG, M4A, FLAC — max 500MB</p>
        </div>
      </div>
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
