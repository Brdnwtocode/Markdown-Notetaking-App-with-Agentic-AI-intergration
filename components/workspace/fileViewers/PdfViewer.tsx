"use client";

// components/workspace/fileViewers/PdfViewer.tsx
//
// Inline PDF viewer via iframe embed of the presigned URL.

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Download, ExternalLink } from "lucide-react";

interface PdfViewerProps {
  fileId: string;
  fileName: string;
}

export default function PdfViewer({ fileId, fileName }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`);
        if (cancelled) return;
        if (res.data?.url) {
          setUrl(res.data.url);
        } else {
          setError("No viewable URL");
        }
      } catch {
        if (!cancelled) setError("Failed to load PDF");
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
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">{error || "No PDF"}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
        <span className="text-xs text-zinc-500 font-technical uppercase tracking-wider">
          PDF · {fileName}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-[10px] font-mono"
          >
            <Download className="h-3 w-3" /> Download
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-[10px] font-mono"
          >
            <ExternalLink className="h-3 w-3" /> Open in new tab
          </a>
        </div>
      </div>

      {/* PDF iframe */}
      <iframe
        src={url}
        className="flex-1 w-full border-0"
        title={fileName}
      />
    </div>
  );
}
