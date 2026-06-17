"use client";

// components/workspace/fileViewers/MarkdownViewer.tsx
//
// Renders markdown content with a "Convert to Note" / "View Only" banner.

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, FileText, ArrowRight } from "lucide-react";

interface MarkdownViewerProps {
  fileId: string;
  fileName: string;
  onConvert: () => void;
}

export default function MarkdownViewer({ fileId, fileName: _fileName, onConvert }: MarkdownViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`, {
          responseType: "text",
          transformResponse: [(data) => data], // don't parse as JSON
        });
        if (cancelled) return;
        const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        setContent(text);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || "Failed to load markdown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  const handleConvert = async () => {
    if (!content) return;
    // Parent FileViewer handles the actual note creation & navigation
    onConvert();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Conversion banner */}
      {showBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/20">
          <div className="flex items-center gap-2 text-xs text-[#10B981] font-technical uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Markdown file — editable as a Note
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBanner(false)}
              className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-[#27272A] rounded-sm font-mono uppercase tracking-wider transition-colors"
            >
              View Only
            </button>
            <button
              onClick={handleConvert}
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90 rounded-sm font-mono font-bold uppercase tracking-wider transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
              Convert to Note
            </button>
          </div>
        </div>
      )}

      {/* Markdown render */}
      <div className="flex-1 overflow-auto p-6">
        <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
}
