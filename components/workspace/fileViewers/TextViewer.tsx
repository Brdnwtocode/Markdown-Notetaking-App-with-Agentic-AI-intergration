"use client";

// components/workspace/fileViewers/TextViewer.tsx
//
// Editable textarea with save-back-to-S3 capability.

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Loader2, Save, Check } from "lucide-react";

interface TextViewerProps {
  fileId: string;
  fileName: string;
}

export default function TextViewer({ fileId, fileName }: TextViewerProps) {
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Refs for values the save callback needs — avoids recreating the
  // callback on every keystroke (which would re-register the Ctrl+S listener).
  const contentRef = useRef(content);
  contentRef.current = content;
  const originalRef = useRef(originalContent);
  originalRef.current = originalContent;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`, {
          responseType: "text",
          transformResponse: [(d) => d],
        });
        if (cancelled) return;
        const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        setContent(text);
        setOriginalContent(text);
      } catch (err: any) {
        if (!cancelled) setError("Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  const isDirty = content !== originalContent;

  // Stable callback — reads current values from refs
  const handleSave = useCallback(async () => {
    const current = contentRef.current;
    const original = originalRef.current;
    if (current === original) return;

    setSaving(true);
    setError(null);
    try {
      await axios.put(`/api/storage/${fileId}/content`, current, {
        headers: { "Content-Type": "text/plain" },
      });
      setOriginalContent(current);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [fileId]);

  // Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">{error}</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313]">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-technical uppercase tracking-wider">
          <span className="text-[#10B981]">TXT</span>
          <span>{fileName}</span>
          {isDirty && <span className="text-yellow-500">• Unsaved</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors ${
            saved
              ? "text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5"
              : isDirty
                ? "text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90"
                : "text-zinc-600 border border-[#27272A] cursor-not-allowed"
          }`}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saved ? (
            <Check className="h-3 w-3" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {saved ? "Saved" : saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[10px] font-mono">
          {error}
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        className="flex-1 w-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed placeholder:text-zinc-700"
        placeholder="File content..."
        spellCheck={false}
      />
    </div>
  );
}
