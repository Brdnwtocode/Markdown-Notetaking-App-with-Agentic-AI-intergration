"use client";

// components/workspace/fileViewers/VideoViewer.tsx
//
// Inline video player using a presigned URL.

import { useState, useEffect } from "react";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, Download } from "lucide-react";

interface VideoViewerProps {
  fileId: string;
  fileName: string;
}

export default function VideoViewer({ fileId, fileName }: VideoViewerProps) {
  const { fileContentCache, cacheFileContent } = useWorkspaceStore();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (res.data?.url) {
          setUrl(res.data.url);
          cacheFileContent(fileId, JSON.stringify(res.data));
        } else {
          setError("No viewable URL");
        }
      } catch {
        if (!cancelled) setError("Failed to load video");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">{error || "No video"}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
        <span className="text-xs text-zinc-500 font-technical uppercase tracking-wider">
          VID · {fileName}
        </span>
        <a
          href={url}
          download={fileName}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-[10px] font-mono"
        >
          <Download className="h-3 w-3" /> Download
        </a>
      </div>

      {/* Video player */}
      <div className="flex-1 flex items-center justify-center p-4">
        <video
          src={url}
          controls
          className="max-w-full max-h-full rounded-sm shadow-2xl"
          playsInline
        >
          Your browser does not support the video element.
        </video>
      </div>
    </div>
  );
}
