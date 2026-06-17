"use client";

// app/(workspace)/workspace/files/[id]/page.tsx
//
// File viewer route page. Fetches file metadata and renders the
// multi-type FileViewer component.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import FileViewer from "@/components/workspace/FileViewer";
import type { FileRecord } from "@/lib/slices/fileRecordsSlice";
import axios from "axios";
import { Loader2, ArrowLeft } from "lucide-react";

export default function FileViewerPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;
  const { fileRecords, fileRecordCache, cacheFileRecord, openTab } = useWorkspaceStore();
  const [fileRecord, setFileRecord] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check cache first (persists across tab switches)
    const cached = fileRecordCache[fileId];
    if (cached) {
      setFileRecord(cached);
      openTab(fileId, "FILE", cached.fileName);
      setLoading(false);
      return;
    }

    // 2. Check fileRecords array (populated by sidebar)
    const fromList = fileRecords.find((fr) => fr.id === fileId);
    if (fromList) {
      setFileRecord(fromList);
      cacheFileRecord(fromList);
      openTab(fileId, "FILE", fromList.fileName);
      setLoading(false);
      return;
    }

    // 3. Fetch from API
    let cancelled = false;
    (async () => {
      try {
        const listRes = await axios.get("/api/storage");
        if (cancelled) return;
        const found = (listRes.data as FileRecord[]).find((fr: FileRecord) => fr.id === fileId);
        if (found) {
          setFileRecord(found);
          cacheFileRecord(found);
          openTab(fileId, "FILE", found.fileName);
        } else {
          setError("File not found");
        }
      } catch {
        if (!cancelled) setError("Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error || !fileRecord) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0E0E0E] gap-4">
        <p className="text-zinc-500 text-sm font-technical uppercase">{error || "File not found"}</p>
        <button
          onClick={() => router.push("/workspace")}
          className="flex items-center gap-2 px-4 py-2 border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 rounded-sm text-xs font-mono uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0E0E0E] overflow-hidden">
      <FileViewer fileRecord={fileRecord} />
    </div>
  );
}
