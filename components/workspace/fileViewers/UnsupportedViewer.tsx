"use client";

// components/workspace/fileViewers/UnsupportedViewer.tsx
//
// Fallback for unsupported file types. Shows a download button.

import { useState, useEffect } from "react";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, FileWarning, Download } from "lucide-react";

interface UnsupportedViewerProps {
  fileId: string;
  fileName: string;
  mimeType: string;
}

export default function UnsupportedViewer({ fileId, fileName, mimeType }: UnsupportedViewerProps) {
  const { fileContentCache, cacheFileContent } = useWorkspaceStore();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = fileContentCache[fileId];
    if (cached !== undefined) {
      try { const parsed = JSON.parse(cached); if (parsed?.url) { setUrl(parsed.url); setLoading(false); return; } } catch {}
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`);
        if (cancelled) return;
        const downloadUrl = res.data?.url || null;
        setUrl(downloadUrl);
        if (downloadUrl) cacheFileContent(fileId, JSON.stringify(res.data));
      } catch {
        // Ignore — download URL may not be available
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, fileContentCache, cacheFileContent]);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 p-8 bg-[#0E0E0E]">
      <div className="w-16 h-16 rounded-full bg-zinc-800/50 border border-[#27272A] flex items-center justify-center">
        <FileWarning className="h-7 w-7 text-zinc-600" />
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-300 font-mono truncate max-w-xs mb-1">{fileName}</p>
        <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">{mimeType || "Unknown type"}</p>
      </div>

      <p className="text-xs text-zinc-500 text-center max-w-sm">
        This file type cannot be previewed in the workspace.
        You can download it to your device.
      </p>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
      ) : url ? (
        <a
          href={url}
          download={fileName}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#10B981] text-[#0E0E0E] rounded-sm text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#10B981]/90 transition-colors"
        >
          <Download className="h-4 w-4" /> Download File
        </a>
      ) : (
        <p className="text-[10px] text-zinc-600">Download not available</p>
      )}
    </div>
  );
}
