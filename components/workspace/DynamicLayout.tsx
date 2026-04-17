"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import axios from "axios";
import toast from "react-hot-toast";

interface DynamicLayoutProps {
  children: React.ReactNode;
}

export default function DynamicLayout({ children }: DynamicLayoutProps) {
  const [showSideBySide, setShowSideBySide] = useState(false);
  const { currentNoteId, currentStackId } = useWorkspaceStore();

  const exportAsMarkdown = async () => {
    if (!currentNoteId) {
      toast.error("No note selected");
      return;
    }

    try {
      const res = await axios.get(`/api/notes/${currentNoteId}`);
      const { title, content } = res.data;

      // Create markdown file with title
      const markdown = `# ${title}\n\n${content}`;
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "note"}.md`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Note exported as Markdown");
    } catch (error) {
      toast.error("Failed to export note");
    }
  };

  const exportAsCSV = async () => {
    if (!currentStackId) {
      toast.error("No stack selected");
      return;
    }

    try {
      const res = await axios.get(`/api/stacks/${currentStackId}`);
      const { name, columns, rows } = res.data;

      // Create CSV header
      const headers = columns.map((col: any) => col.name).join(",");

      // Create CSV rows
      const csvRows = rows.map((row: any) =>
        columns
          .map((col: any) => {
            const value = row.data[col.id];
            // Escape quotes and wrap in quotes if contains commas
            if (typeof value === "string" && value.includes(",")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? "";
          })
          .join(",")
      );

      const csv = [headers, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "stack"}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Stack exported as CSV");
    } catch (error) {
      toast.error("Failed to export stack");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Export Toolbar */}
      <div className="border-b border-border p-2 flex items-center gap-2 bg-muted/30">
        {currentNoteId && (
          <Button
            onClick={exportAsMarkdown}
            size="sm"
            variant="outline"
          >
            <Download className="h-3 w-3 mr-1" /> Export MD
          </Button>
        )}
        {currentStackId && (
          <Button
            onClick={exportAsCSV}
            size="sm"
            variant="outline"
          >
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
        )}
        {(currentNoteId || currentStackId) && (
          <Button
            onClick={() => setShowSideBySide(!showSideBySide)}
            size="sm"
            variant="outline"
          >
            <Eye className="h-3 w-3 mr-1" />
            {showSideBySide ? "Single View" : "Split View"}
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showSideBySide ? (
          <div className="flex h-full gap-4 p-4">
            <div className="flex-1 border border-border rounded overflow-auto">
              {children}
            </div>
            <div className="flex-1 border border-border rounded bg-muted/30 flex items-center justify-center">
              <p className="text-muted-foreground text-center p-4">
                Side-by-side preview
                <br />
                <span className="text-xs">(Workspace enhancement)</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full">{children}</div>
        )}
      </div>
    </div>
  );
}
