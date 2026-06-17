"use client";

// components/workspace/fileViewers/CsvViewer.tsx
//
// Editable CSV viewer with Save-to-S3, table preview toggle, and "Convert to Stack" banner.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, Table, ArrowRight, Save, Check, Edit3, Eye } from "lucide-react";

interface CsvViewerProps {
  fileId: string;
  fileName: string;
  onConvert: (headers: string[], rows: string[][]) => void;
}

export default function CsvViewer({ fileId, onConvert }: CsvViewerProps) {
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
        const text = typeof res.data === "string" ? res.data : "";
        setContent(text);
        setOriginalContent(text);
        cacheFileContent(fileId, text);
      } catch (err: any) {
        if (!cancelled) setError("Failed to load CSV");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, fileContentCache, cacheFileContent]);

  const isDirty = content !== originalContent;

  const { headers, rows } = useMemo(() => {
    if (!content) return { headers: [] as string[], rows: [] as string[][] };
    const lines = content.trim().split("\n");
    if (lines.length === 0) return { headers: [], rows: [] };
    const parseCSV = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    };
    const h = parseCSV(lines[0]);
    const r = lines.slice(1).map(parseCSV);
    return { headers: h, rows: r };
  }, [content]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleConvert = () => { onConvert(headers, rows); };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#10B981]" /></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {showBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/20 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#10B981] font-technical uppercase tracking-wider">
            <Table className="h-3.5 w-3.5" />
            CSV — editable · Convert to Stack for rich table editing
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBanner(false)} className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-[#27272A] rounded-sm font-mono uppercase tracking-wider transition-colors">Dismiss</button>
            <button onClick={handleConvert} className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90 rounded-sm font-mono font-bold uppercase tracking-wider transition-colors"><ArrowRight className="h-3 w-3" />Convert to Stack</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313] shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-technical uppercase tracking-wider">
          <span className="text-[#10B981]">CSV</span>
          {isDirty && <span className="text-yellow-500">• Unsaved</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditMode(!editMode)} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm border transition-colors ${editMode ? "border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5" : "border-[#27272A] text-zinc-500 hover:text-zinc-300"}`}>
            {editMode ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}{editMode ? "Preview" : "Edit"}
          </button>
          <button onClick={handleSave} disabled={!isDirty || saving} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors ${saved ? "text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5" : isDirty ? "text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90" : "text-zinc-600 border border-[#27272A] cursor-not-allowed"}`}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}{saved ? "Saved" : saving ? "..." : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[10px] font-mono shrink-0">{error}</div>}

      {editMode ? (
        <textarea value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} className="flex-1 w-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent" placeholder="CSV content..." spellCheck={false} />
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          <table className="w-full border-collapse font-mono text-xs">
            <thead className="sticky top-0 z-10"><tr className="bg-[#131313] border-b border-[#27272A]">{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left text-[#10B981] font-semibold uppercase tracking-wider whitespace-nowrap border-r border-[#27272A]">{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, ri) => <tr key={ri} className="border-b border-[#27272A]/50 hover:bg-white/[0.02] transition-colors">{row.map((cell, ci) => <td key={ci} className="px-3 py-1.5 text-zinc-300 whitespace-nowrap border-r border-[#27272A]/30">{cell}</td>)}</tr>)}</tbody>
          </table>
          {rows.length === 0 && <div className="p-6 text-center text-zinc-600 text-xs">No data rows</div>}
        </div>
      )}
    </div>
  );
}
