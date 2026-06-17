"use client";

// components/workspace/fileViewers/JsonViewer.tsx
//
// Editable JSON viewer with Save-to-S3, tree preview toggle,
// "Convert to Stack" banner, and clear conversion-failure diagnostics.

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useWorkspaceStore } from "@/lib/store";
import { Loader2, Braces, ArrowRight, Save, Check, Edit3, Eye, AlertTriangle } from "lucide-react";

interface JsonViewerProps {
  fileId: string;
  fileName: string;
  onConvert: (data: any) => void;
}

// ─── JSON Tree Preview (read-only, collapsed by default) ──────────────────

function JsonNode({ label, value, depth = 0 }: { label?: string; value: any; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  if (value === null) return <JsonLeaf label={label} value="null" type="null" depth={depth} />;
  if (value === undefined) return <JsonLeaf label={label} value="undefined" type="null" depth={depth} />;
  const type = Array.isArray(value) ? "array" : typeof value === "object" ? "object" : typeof value;
  if (type === "object") {
    const entries = Object.entries(value as Record<string, any>);
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors select-none" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <span className="text-zinc-600 text-xs">&#9656;</span> : <span className="text-zinc-600 text-xs">&#9662;</span>}
          {label && <span className="text-[#10B981] font-mono text-xs">{label}: </span>}
          <span className="text-zinc-500 text-xs">{collapsed ? `{${entries.length} keys}` : "{"}</span>
        </div>
        {!collapsed && <>{entries.map(([k, v]) => <JsonNode key={k} label={k} value={v} depth={depth + 1} />)}<div style={{ paddingLeft: depth * 16 }} className="text-zinc-500 text-xs">{"}"}</div></>}
      </div>
    );
  }
  if (type === "array") {
    const arr = value as any[];
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors select-none" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <span className="text-zinc-600 text-xs">&#9656;</span> : <span className="text-zinc-600 text-xs">&#9662;</span>}
          {label && <span className="text-[#10B981] font-mono text-xs">{label}: </span>}
          <span className="text-zinc-500 text-xs">{collapsed ? `[${arr.length} items]` : "["}</span>
        </div>
        {!collapsed && <>{arr.map((item, i) => <JsonNode key={i} label={String(i)} value={item} depth={depth + 1} />)}<div style={{ paddingLeft: depth * 16 }} className="text-zinc-500 text-xs">{"]"}</div></>}
      </div>
    );
  }
  return <JsonLeaf label={label} value={String(value)} type={type} depth={depth} />;
}

function JsonLeaf({ label, value, type, depth }: { label?: string; value: string; type: string; depth: number }) {
  const color = type === "string" ? "text-yellow-400" : type === "number" ? "text-blue-400" : type === "boolean" ? "text-purple-400" : "text-zinc-500";
  return <div style={{ paddingLeft: depth * 16 }} className="font-mono text-xs">{label && <span className="text-[#10B981]">{label}: </span>}<span className={color}>{type === "string" ? `"${value}"` : value}</span></div>;
}

// ─── Conversion-viability check ───────────────────────────────────────────

function getConversionDiagnostic(data: any): { convertible: boolean; reason?: string } {
  if (data === null || data === undefined) return { convertible: false, reason: "JSON value is null or undefined — nothing to build a table from." };
  if (Array.isArray(data)) {
    if (data.length === 0) return { convertible: false, reason: "JSON is an empty array. A stack needs at least one row of data to derive columns." };
    const firstObj = data.find((item) => typeof item === "object" && item !== null);
    if (!firstObj) return { convertible: false, reason: "JSON is an array of primitives (no objects). Consider converting manually or editing the JSON first." };
    const keyCount = Object.keys(firstObj).length;
    if (keyCount === 0) return { convertible: false, reason: "JSON array contains objects with no keys — cannot derive stack columns." };
    return { convertible: true };
  }
  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) return { convertible: false, reason: "JSON is an empty object — no data to tabulate." };
    return { convertible: true };
  }
  return { convertible: false, reason: `JSON root is a ${typeof data}, not an object or array. A stack requires structured tabular data.` };
}

// ─── Main component ───────────────────────────────────────────────────────

export default function JsonViewer({ fileId, onConvert }: JsonViewerProps) {
  const { fileContentCache, cacheFileContent } = useWorkspaceStore();
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [parsed, setParsed] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
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
      try { setParsed(JSON.parse(cachedContent)); setParseError(null); } catch { setParsed(null); setParseError("Invalid JSON syntax"); }
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
        try { setParsed(JSON.parse(text)); setParseError(null); } catch { setParsed(null); setParseError("Invalid JSON syntax"); }
      } catch (err: any) {
        if (!cancelled) setError("Failed to load file");
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
      await axios.put(`/api/storage/${fileId}/content`, current, { headers: { "Content-Type": "text/plain" } });
      setOriginalContent(current);
      cacheFileContent(fileId, current);
      // Re-parse after save
      try { setParsed(JSON.parse(current)); setParseError(null); } catch { setParsed(null); setParseError("Invalid JSON syntax"); }
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

  // Re-parse on content change (debounced via the ref pattern in save; for live feedback we parse on each change)
  useEffect(() => {
    if (!content) { setParsed(null); setParseError(null); return; }
    try { const p = JSON.parse(content); setParsed(p); setParseError(null); } catch { setParsed(null); setParseError("Invalid JSON — fix syntax errors before saving or converting."); }
  }, [content]);

  const conversionDiag = parsed ? getConversionDiagnostic(parsed) : { convertible: false, reason: parseError || "No valid JSON data" };

  const handleConvert = () => {
    if (!parsed) return;
    onConvert(parsed);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#10B981]" /></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Conversion banner */}
      {showBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/20 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#10B981] font-technical uppercase tracking-wider">
            <Braces className="h-3.5 w-3.5" />
            JSON — editable · Convert to Stack for rich table editing
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBanner(false)} className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-[#27272A] rounded-sm font-mono uppercase tracking-wider transition-colors">Dismiss</button>
            {conversionDiag.convertible ? (
              <button onClick={handleConvert} className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-[#0E0E0E] bg-[#10B981] hover:bg-[#10B981]/90 rounded-sm font-mono font-bold uppercase tracking-wider transition-colors"><ArrowRight className="h-3 w-3" />Convert to Stack</button>
            ) : (
              <span className="px-3 py-1 text-[10px] text-yellow-500/80 border border-yellow-500/20 bg-yellow-500/5 rounded-sm font-mono uppercase tracking-wider flex items-center gap-1" title={conversionDiag.reason}><AlertTriangle className="h-3 w-3" />Not stack-convertible</span>
            )}
          </div>
        </div>
      )}

      {/* Non-convertible reason (shown when banner is dismissed but conversion not possible) */}
      {!showBanner && !conversionDiag.convertible && conversionDiag.reason && (
        <div className="px-4 py-1.5 bg-yellow-500/5 border-b border-yellow-500/10 text-yellow-500/70 text-[10px] font-mono shrink-0 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {conversionDiag.reason}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#131313] shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-technical uppercase tracking-wider">
          <span className="text-[#10B981]">JSON</span>
          {parseError && <span className="text-red-400">• {parseError}</span>}
          {!parseError && isDirty && <span className="text-yellow-500">• Unsaved</span>}
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

      {/* Content */}
      {editMode ? (
        <textarea value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} className="flex-1 w-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent" placeholder="JSON content..." spellCheck={false} />
      ) : (
        <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {parsed ? <JsonNode value={parsed} /> : <div className="text-zinc-600 text-xs p-4">{parseError || "No data"}</div>}
        </div>
      )}
    </div>
  );
}
