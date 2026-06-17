"use client";

// components/workspace/fileViewers/MarkdownViewer.tsx
//
// Editable markdown viewer with Save-back-to-S3 and "Convert to Note" banner.

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, FileText, ArrowRight, Save, Check, Edit3, Eye } from "lucide-react";

interface MarkdownViewerProps {
  fileId: string;
  fileName: string;
  onConvert: () => void;
}

export default function MarkdownViewer({ fileId, fileName: _fileName, onConvert }: MarkdownViewerProps) {
  const { fileContentCache, cacheFileContent } = useWorkspaceStore();
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const contentRef = useRef(content);
  contentRef.current = content;
  const originalRef = useRef(originalContent);
  originalRef.current = originalContent;

  useEffect(() => {
    // Check content cache first — prevents re-fetch on tab switch
    const cachedContent = fileContentCache[fileId];
    if (cachedContent !== undefined) {
      setContent(cachedContent);
      setOriginalContent(cachedContent);
      setLoading(false);
      return;
    }

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
        cacheFileContent(fileId, text);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || "Failed to load markdown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, fileContentCache, cacheFileContent]);

  const isDirty = content !== originalContent;

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
      cacheFileContent(fileId, current);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [fileId, cacheFileContent]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Conversion banner */}
      {showBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/20 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#10B981] font-technical uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Markdown — editable · Convert to Note for rich editing
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBanner(false)}
              className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-[#27272A] rounded-sm font-mono uppercase tracking-wider transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={onConvert}
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90 rounded-sm font-mono font-bold uppercase tracking-wider transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
              Convert to Note
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313] shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-technical uppercase tracking-wider">
          <span className="text-[#10B981]">MD</span>
          {isDirty && <span className="text-yellow-500">• Unsaved</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm border transition-colors ${
              editMode
                ? "border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5"
                : "border-[#27272A] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {editMode ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {editMode ? "Preview" : "Edit"}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors ${
              saved
                ? "text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5"
                : isDirty
                  ? "text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90"
                  : "text-zinc-600 border border-[#27272A] cursor-not-allowed"
            }`}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved" : saving ? "..." : "Save"}
          </button>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[10px] font-mono shrink-0">
          {error}
        </div>
      )}

      {/* Content */}
      {editMode ? (
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
          className="flex-1 w-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
          placeholder="Markdown content..."
          spellCheck={false}
        />
      ) : (
        <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
