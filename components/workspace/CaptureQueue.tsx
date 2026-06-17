"use client";

// CaptureQueue.tsx
//
// High-density data table of recording sessions (both saved & local).
// Includes a drag-and-drop zone for importing external audio files.
//
// Interactions per row:
//   Click → load audio + transcript into main workstation
//   Rename (pencil) → inline edit title
//   Save (cloud) → persist local recording to DB + S3
//   Delete (trash) → remove from DB (saved) or discard (local)
//
// File validation:
//   Accepted: .wav, .mp3, .webm, .ogg, .m4a, .flac, .aac
//   Max size: 500 MB

import { useCallback, useState, useRef, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Recording, RecordStatus, LocalRecording } from "@/lib/slices/recordsSlice";
import {
  Circle, CheckCircle2, Loader2, FileAudio,
  Trash2, Upload, Save, Pencil, Check, X, Play,
  Search, ArrowUpDown,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { fmtDuration } from "@/lib/utils";

// ─── Accepted audio types ─────────────────────────────────────────────────
const ACCEPTED_EXTENSIONS = [
  ".wav", ".mp3", ".webm", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".mp4",
];
const ACCEPTED_MIME = [
  "audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/flac",
  "audio/aac", "audio/x-ms-wma",
];
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function isValidAudioFile(file: File): string | null {
  if (!file || file.size === 0) return "File is empty";
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_MIME.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext || "")) {
    return `Unsupported: ${file.type || ext}. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 500MB`;
  }
  return null;
}

// ─── In-memory blob store ──────────────────────────────────────────────────
const blobMap = new Map<string, Blob>();
export function storeBlob(id: string, blob: Blob) { blobMap.set(id, blob); }
export function getBlob(id: string): Blob | undefined { return blobMap.get(id); }
export function removeBlob(id: string) { blobMap.delete(id); }

/** Extract audio duration (seconds) from a Blob via a temporary Audio element. */
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    audio.addEventListener(
      "loadedmetadata",
      () => { cleanup(); resolve(Math.round(audio.duration) || 0); },
      { once: true },
    );
    audio.addEventListener(
      "error",
      () => { cleanup(); reject(new Error("Failed to load audio for duration")); },
      { once: true },
    );
  });
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface CaptureQueueProps {
  onSelect: (recording: Recording) => void;
  onSelectLocal: (local: LocalRecording, blob?: Blob) => void;
  activeId: string | null;
}

export default function CaptureQueue({ onSelect, onSelectLocal, activeId }: CaptureQueueProps) {
  const {
    recordings, recordingsLoading, localRecordings,
    deleteRecording, addLocalRecording, removeLocalRecording,
    setRecordings, upsertRecording,
  } = useWorkspaceStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingLocalId, setSavingLocalId] = useState<string | null>(null);
  const savingRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ─── Search & Sort ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title-asc" | "title-desc" | "duration-asc" | "duration-desc">("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const sortOptions: { value: typeof sortBy; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
    { value: "duration-asc", label: "Duration ↑" },
    { value: "duration-desc", label: "Duration ↓" },
  ];

  const sortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? "Sort";

  // ─── Filter & sort recordings ──────────────────────────────────────────
  const filteredRecordings = useMemo(() => {
    let list = [...recordings];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case "oldest": list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "title-asc": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "title-desc": list.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "duration-asc": list.sort((a, b) => a.durationSec - b.durationSec); break;
      case "duration-desc": list.sort((a, b) => b.durationSec - a.durationSec); break;
      case "newest":
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return list;
  }, [recordings, searchQuery, sortBy]);

  const filteredLocalRecordings = useMemo(() => {
    let list = [...localRecordings];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case "oldest": list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "title-asc": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "title-desc": list.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "duration-asc": list.sort((a, b) => a.durationSec - b.durationSec); break;
      case "duration-desc": list.sort((a, b) => b.durationSec - a.durationSec); break;
      case "newest":
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return list;
  }, [localRecordings, searchQuery, sortBy]);

  // ─── Process dropped/selected files ────────────────────────────────────
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      let added = 0;
      for (const file of Array.from(files)) {
        const error = isValidAudioFile(file);
        if (error) { toast.error(error); continue; }
        const id = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        const local: LocalRecording = {
          id, title: file.name.replace(/\.[^.]+$/, ""), durationSec: 0,
          transcript: "", createdAt: new Date().toISOString(),
          source: "imported", fileName: file.name,
          fileSizeBytes: file.size, mimeType: file.type || "audio/webm",
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
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; }
  }, [processFiles]);

  // ─── Save local → DB + S3 ──────────────────────────────────────────────
  const handleSaveLocal = useCallback(async (e: React.MouseEvent, local: LocalRecording) => {
    e.stopPropagation();
    // Guard via ref — keeps useCallback deps stable (no savingLocalId)
    if (savingRef.current === local.id) return;
    savingRef.current = local.id;
    setSavingLocalId(local.id);

    const blob = getBlob(local.id);
    console.log("[CaptureQueue] Saving local recording:", { id: local.id, title: local.title, hasBlob: !!blob, blobSize: blob?.size });

    // Extract real audio duration from the blob (imported files have durationSec: 0)
    let durationSec = local.durationSec;
    if (blob && durationSec === 0) {
      try {
        durationSec = await getAudioDuration(blob);
        console.log("[CaptureQueue] Extracted audio duration:", durationSec, "s");
      } catch { /* keep 0 */ }
    }

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: local.title, transcript: local.transcript, durationSec }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[CaptureQueue] Create record failed:", res.status, errBody);
        throw new Error(errBody.error || `Server error ${res.status}`);
      }
      const saved = await res.json();
      console.log("[CaptureQueue] Record created:", saved.id);

      let audioUploaded = false;
      if (blob && blob.size > 0) {
        const fd = new FormData();
        fd.append("audio", blob, local.fileName || `recording-${saved.id}.webm`);
        fd.append("recordingId", saved.id);
        console.log("[CaptureQueue] Uploading audio...");
        try {
          const upRes = await fetch("/api/records/upload", { method: "POST", body: fd });
          if (upRes.ok) {
            const upData = await upRes.json();
            console.log("[CaptureQueue] Audio uploaded:", upData.key);
            // Note: the upload route already updates the recording with audioKey
            // and audioSizeBytes in the DB — no need to PATCH again
            audioUploaded = true;
          } else {
            const errBody = await upRes.json().catch(() => ({}));
            console.error("[CaptureQueue] Audio upload failed:", upRes.status, errBody);
            toast.error(`Upload error: ${errBody.error || upRes.status}`);
          }
        } catch (uploadErr: any) {
          console.error("[CaptureQueue] Audio upload network error:", uploadErr);
          toast.error(`Upload failed: ${uploadErr.message || "Network error"}`);
        }
      }

      // Only discard the local recording if the save fully succeeded
      if (audioUploaded || !blob) {
        removeLocalRecording(local.id);
        removeBlob(local.id);
        if (audioUploaded) {
          toast.success(`"${local.title}" saved with audio`);
        } else {
          toast.success(`"${local.title}" saved`);
        }
      } else {
        // Audio upload failed — keep the local recording so user can retry
        toast.error(`"${local.title}" saved but audio upload failed — click Save to retry`);
      }

      const listRes = await fetch("/api/records");
      if (listRes.ok) setRecordings(await listRes.json());
    } catch (err: any) {
      console.error("[CaptureQueue] Save failed:", err);
      toast.error(err.message || "Save failed");
    } finally {
      savingRef.current = null;
      setSavingLocalId(null);
    }
  }, [removeLocalRecording, setRecordings]);

  // ─── Rename ────────────────────────────────────────────────────────────
  const startRename = useCallback((e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const commitRename = useCallback(async (id: string, isLocal: boolean) => {
    const newTitle = renameValue.trim() || "Untitled Recording";
    if (isLocal) {
      // Update local recording title in Zustand
      const store = useWorkspaceStore.getState();
      const updated = store.localRecordings.map((r) =>
        r.id === id ? { ...r, title: newTitle } : r,
      );
      useWorkspaceStore.setState({ localRecordings: updated });
    } else {
      // PATCH the server
      try {
        const res = await fetch(`/api/records/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (res.ok) {
          const updated = await res.json();
          upsertRecording(updated);
          toast.success("Renamed");
        }
      } catch { toast.error("Rename failed"); }
    }
    setRenamingId(null);
  }, [renameValue, upsertRecording]);

  const cancelRename = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingId(null);
  }, []);

  const handleRenameKey = useCallback((e: React.KeyboardEvent, id: string, isLocal: boolean) => {
    if (e.key === "Enter") commitRename(id, isLocal);
    if (e.key === "Escape") cancelRename();
  }, [commitRename, cancelRename]);

  // ─── Delete persisted recording ─────────────────────────────────────────
  const handleDeletePersisted = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/records/${id}`, { method: "DELETE" });
      deleteRecording(id);
      toast.success("Deleted");
    } catch { toast.error("Delete failed"); }
  }, [deleteRecording]);

  // ─── Status badge (icon-only, label in tooltip) ───────────────────────
  const StatusBadge = ({ status }: { status: RecordStatus }) => {
    const map: Record<RecordStatus, { Icon: React.ElementType; label: string; cls: string }> = {
      RECORDING: { Icon: Circle, label: "Recording", cls: "border-red-500/50 text-red-400" },
      TRANSCRIBING: { Icon: Circle, label: "Transcribing", cls: "border-[#10B981]/50 text-[#10B981]" },
      RESOLVING: { Icon: Loader2, label: "Resolving", cls: "border-amber-500/50 text-amber-400" },
      COMMITTED: { Icon: CheckCircle2, label: "Saved", cls: "border-[#27272A] text-zinc-500" },
    };
    const { Icon, label, cls } = map[status];
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 border rounded-sm ${cls}`}
        title={label}
      >
        {(status === "RECORDING" || status === "TRANSCRIBING") ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
          </span>
        ) : (
          <Icon className={`h-3 w-3 ${status === "RESOLVING" ? "animate-spin" : ""}`} />
        )}
      </span>
    );
  };

  const hasItems = filteredRecordings.length > 0 || filteredLocalRecordings.length > 0;
  const totalFiltered = filteredRecordings.length + filteredLocalRecordings.length;
  const totalAll = recordings.length + localRecordings.length;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ─── Search & Sort Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#27272A] bg-[#0A0A0A]/30">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recordings…"
            className="w-full pl-7 pr-2 py-1.5 bg-[#0E0E0E] border border-[#27272A] rounded-sm text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-[#10B981]/50 transition-colors"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-sm border text-[10px] font-mono transition-colors ${sortBy !== "newest" ? "border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5" : "border-[#27272A] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"}`}
          >
            <ArrowUpDown className="h-2.5 w-2.5" />
            {sortLabel}
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#131313] border border-[#27272A] rounded-sm shadow-lg z-20 overflow-hidden">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors ${sortBy === opt.value ? "text-[#10B981] bg-[#10B981]/10" : "text-zinc-400 hover:bg-[#1A1A1A] hover:text-zinc-200"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {searchQuery && (
          <span className="text-[9px] font-mono text-zinc-600">
            {totalFiltered}/{totalAll}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
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
                <th className="text-left py-2 px-2 w-[40px]">Status</th>
                <th className="text-left py-2 px-2">Title</th>
                <th className="text-left py-2 px-2 w-[60px]">Time</th>
                <th className="text-right py-2 px-1 w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* ─── Persisted recordings ──────────────────────────────── */}
              {filteredRecordings.map((rec) => {
                const isActive = rec.id === activeId;
                const isRenaming = renamingId === rec.id;
                return (
                  <tr
                    key={rec.id}
                    onClick={() => { if (!isRenaming) onSelect(rec); }}
                    className={`border-b border-[#27272A]/50 cursor-pointer transition-colors group ${isActive ? "bg-[#10B981]/5 border-l-2 border-l-[#10B981]" : "hover:bg-[#131313]"}`}
                  >
                    <td className="py-2 px-2"><StatusBadge status={rec.status} /></td>
                    <td className="py-2 px-2">
                      {isRenaming ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => handleRenameKey(e, rec.id, false)}
                            className="bg-[#0E0E0E] border border-[#10B981]/50 rounded-sm px-1.5 py-0.5 text-xs text-white font-mono w-full outline-none"
                            maxLength={100}
                          />
                          <button onClick={() => commitRename(rec.id, false)} className="p-0.5 hover:bg-[#10B981]/10 rounded-sm text-[#10B981]" title="Confirm"><Check className="h-3 w-3" /></button>
                          <button onClick={cancelRename} className="p-0.5 hover:bg-red-500/10 rounded-sm text-zinc-500 hover:text-red-400" title="Cancel"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isActive && <Play className="h-2.5 w-2.5 text-[#10B981] shrink-0" />}
                          <span className="font-medium text-zinc-300 group-hover:text-white truncate max-w-[120px]">{rec.title}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-zinc-500">{fmtDuration(rec.durationSec)}</td>
                    <td className="py-2 px-1 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startRename(e, rec.id, rec.title)}
                          className="p-1 hover:bg-white/5 rounded-sm text-zinc-600 hover:text-zinc-300" title="Rename"
                        ><Pencil className="h-3 w-3" /></button>
                        <button
                          onClick={(e) => handleDeletePersisted(e, rec.id)}
                          className="p-1 hover:bg-red-500/10 rounded-sm text-zinc-600 hover:text-red-400" title="Delete"
                        ><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* ─── Local (unsaved) recordings ────────────────────────── */}
              {filteredLocalRecordings.map((loc) => {
                const isActive = loc.id === activeId;
                const isRenaming = renamingId === loc.id;
                return (
                  <tr
                    key={loc.id}
                    onClick={() => { if (!isRenaming) onSelectLocal(loc, getBlob(loc.id)); }}
                    className={`border-b border-[#27272A]/50 cursor-pointer transition-colors group ${isActive ? "bg-amber-500/5 border-l-2 border-l-amber-500" : "hover:bg-[#131313]"}`}
                  >
                    <td className="py-2 px-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 border rounded-sm border-amber-500/40 text-amber-400"
                        title="Unsaved — local only"
                      >
                        <Circle className="h-2.5 w-2.5 fill-amber-400" />
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {isRenaming ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => handleRenameKey(e, loc.id, true)}
                            className="bg-[#0E0E0E] border border-amber-500/50 rounded-sm px-1.5 py-0.5 text-xs text-white font-mono w-full outline-none"
                            maxLength={100}
                          />
                          <button onClick={() => commitRename(loc.id, true)} className="p-0.5 hover:bg-[#10B981]/10 rounded-sm text-[#10B981]" title="Confirm"><Check className="h-3 w-3" /></button>
                          <button onClick={cancelRename} className="p-0.5 hover:bg-red-500/10 rounded-sm text-zinc-500 hover:text-red-400" title="Cancel"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isActive && <Play className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                          <span className="font-medium text-amber-300/80 group-hover:text-amber-200 truncate max-w-[120px]">{loc.title}</span>
                          {loc.fileName && <span className="text-[9px] text-zinc-600 font-mono truncate hidden sm:inline">({loc.fileName})</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-zinc-500">{loc.durationSec > 0 ? fmtDuration(loc.durationSec) : "--:--"}</td>
                    <td className="py-2 px-1 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => startRename(e, loc.id, loc.title)}
                          className="p-1 hover:bg-white/5 rounded-sm text-zinc-600 hover:text-zinc-300" title="Rename"
                        ><Pencil className="h-3 w-3" /></button>
                        <button onClick={(e) => handleSaveLocal(e, loc)}
                          disabled={savingLocalId === loc.id}
                          className="p-1 hover:bg-[#10B981]/10 rounded-sm text-zinc-600 hover:text-[#10B981] disabled:opacity-40 disabled:cursor-not-allowed" title="Save to cloud"
                        >{savingLocalId === loc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}</button>
                        <button onClick={(e) => { e.stopPropagation(); removeLocalRecording(loc.id); removeBlob(loc.id); }}
                          className="p-1 hover:bg-red-500/10 rounded-sm text-zinc-600 hover:text-red-400" title="Discard"
                        ><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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


