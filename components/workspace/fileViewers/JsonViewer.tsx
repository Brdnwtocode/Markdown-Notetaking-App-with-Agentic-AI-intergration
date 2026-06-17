"use client";

// components/workspace/fileViewers/JsonViewer.tsx
//
// Pretty-prints JSON with collapsible tree and "Convert to Stack" / "View Only" banner.

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Braces, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

interface JsonViewerProps {
  fileId: string;
  fileName: string;
  onConvert: (data: any) => void;
}

function JsonNode({ label, value, depth = 0 }: { label?: string; value: any; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (value === null) return <JsonLeaf label={label} value="null" type="null" depth={depth} />;
  if (value === undefined) return <JsonLeaf label={label} value="undefined" type="null" depth={depth} />;

  const type = Array.isArray(value) ? "array" : typeof value === "object" ? "object" : typeof value;

  if (type === "object") {
    const entries = Object.entries(value as Record<string, any>);
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors select-none"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3 text-zinc-600" /> : <ChevronDown className="h-3 w-3 text-zinc-600" />}
          {label && <span className="text-[#10B981] font-mono text-xs">{label}: </span>}
          <span className="text-zinc-500 text-xs">
            {collapsed ? `{${entries.length} keys}` : "{"}
          </span>
        </div>
        {!collapsed && (
          <>
            {entries.map(([k, v]) => (
              <JsonNode key={k} label={k} value={v} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: depth * 16 }} className="text-zinc-500 text-xs">{"}"}</div>
          </>
        )}
      </div>
    );
  }

  if (type === "array") {
    const arr = value as any[];
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors select-none"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3 text-zinc-600" /> : <ChevronDown className="h-3 w-3 text-zinc-600" />}
          {label && <span className="text-[#10B981] font-mono text-xs">{label}: </span>}
          <span className="text-zinc-500 text-xs">
            {collapsed ? `[${arr.length} items]` : "["}
          </span>
        </div>
        {!collapsed && (
          <>
            {arr.map((item, i) => (
              <JsonNode key={i} label={String(i)} value={item} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: depth * 16 }} className="text-zinc-500 text-xs">{"]"}</div>
          </>
        )}
      </div>
    );
  }

  return <JsonLeaf label={label} value={String(value)} type={type} depth={depth} />;
}

function JsonLeaf({ label, value, type, depth }: { label?: string; value: string; type: string; depth: number }) {
  const color =
    type === "string" ? "text-yellow-400" :
    type === "number" ? "text-blue-400" :
    type === "boolean" ? "text-purple-400" :
    "text-zinc-500";

  return (
    <div style={{ paddingLeft: depth * 16 }} className="font-mono text-xs">
      {label && <span className="text-[#10B981]">{label}: </span>}
      <span className={color}>{type === "string" ? `"${value}"` : value}</span>
    </div>
  );
}

export default function JsonViewer({ fileId, onConvert }: JsonViewerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/storage/${fileId}/content`, {
          responseType: "text",
          transformResponse: [(d) => d],
        });
        if (cancelled) return;
        const parsed = JSON.parse(res.data);
        setData(parsed);
      } catch (err: any) {
        if (!cancelled) setError(err instanceof SyntaxError ? "Invalid JSON" : "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  const handleConvert = () => {
    if (!data) return;
    onConvert(data);
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
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">{error}</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {showBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/20">
          <div className="flex items-center gap-2 text-xs text-[#10B981] font-technical uppercase tracking-wider">
            <Braces className="h-3.5 w-3.5" />
            JSON file — can be imported as a Stack
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
              Convert to Stack
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <JsonNode value={data} />
      </div>
    </div>
  );
}
