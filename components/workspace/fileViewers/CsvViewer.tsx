"use client";

// components/workspace/fileViewers/CsvViewer.tsx
//
// Renders CSV as a HTML table with "Convert to Stack" / "View Only" banner.

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Loader2, Table, ArrowRight } from "lucide-react";

interface CsvViewerProps {
  fileId: string;
  fileName: string;
  onConvert: (headers: string[], rows: string[][]) => void;
}

export default function CsvViewer({ fileId, onConvert }: CsvViewerProps) {
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
          transformResponse: [(d) => d],
        });
        if (cancelled) return;
        setContent(res.data);
      } catch (err: any) {
        if (!cancelled) setError("Failed to load CSV");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);

  const { headers, rows } = useMemo(() => {
    if (!content) return { headers: [] as string[], rows: [] as string[][] };
    const lines = content.trim().split("\n");
    if (lines.length === 0) return { headers: [], rows: [] };
    const parseCSV = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };
    const h = parseCSV(lines[0]);
    const r = lines.slice(1).map(parseCSV);
    return { headers: h, rows: r };
  }, [content]);

  const handleConvert = () => {
    onConvert(headers, rows);
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
            <Table className="h-3.5 w-3.5" />
            CSV file — can be imported as a Stack
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

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#131313] border-b border-[#27272A]">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[#10B981] font-semibold uppercase tracking-wider whitespace-nowrap border-r border-[#27272A]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[#27272A]/50 hover:bg-white/[0.02] transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-zinc-300 whitespace-nowrap border-r border-[#27272A]/30">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6 text-center text-zinc-600 text-xs">No data rows</div>
        )}
      </div>
    </div>
  );
}
