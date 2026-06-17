"use client";

// components/workspace/fileViewers/ImageViewer.tsx
//
// Inline image viewer using a presigned URL.

import { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, ZoomIn, ZoomOut, Download } from "lucide-react";

interface ImageViewerProps {
  fileId: string;
  fileName: string;
}

export default function ImageViewer({ fileId, fileName }: ImageViewerProps) {
  const { fileContentCache, cacheFileContent } = useWorkspaceStore();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    // Check content cache first — prevents re-fetch on tab switch
    const cached = fileContentCache[fileId];
    if (cached !== undefined) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.url) { setUrl(parsed.url); setLoading(false); return; }
      } catch { /* stale cache, fall through */ }
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
        if (!cancelled) setError("Failed to load image");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, fileContentCache, cacheFileContent]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">{error || "No image"}</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
        <span className="text-xs text-zinc-500 font-technical uppercase tracking-wider">
          IMG · {fileName}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
            className="p-1.5 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-zinc-500 font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
            className="p-1.5 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <a
            href={url}
            download={fileName}
            className="p-1.5 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors ml-2"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-[#0A0A0A] p-4 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <Image
          src={url}
          alt={fileName}
          width={1200}
          height={800}
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          className="max-w-full h-auto transition-transform duration-150"
          unoptimized
        />
      </div>
    </div>
  );
}
