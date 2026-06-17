"use client";

// components/workspace/FileViewer.tsx
//
// Smart dispatcher: inspects the file's MIME type and renders the appropriate
// sub-viewer. Handles "Convert to Note" / "Convert to Stack" flows by
// creating the target entity and navigating to its page.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import { getFileViewerDescriptor } from "@/lib/fileViewerRouting";
import type { FileRecord } from "@/lib/slices/fileRecordsSlice";
import { toast } from "@/lib/toast";
import axios from "axios";

// Sub-viewers
import MarkdownViewer from "./fileViewers/MarkdownViewer";
import JsonViewer from "./fileViewers/JsonViewer";
import CsvViewer from "./fileViewers/CsvViewer";
import TextViewer from "./fileViewers/TextViewer";
import ImageViewer from "./fileViewers/ImageViewer";
import VideoViewer from "./fileViewers/VideoViewer";
import AudioViewer from "./fileViewers/AudioViewer";
import PdfViewer from "./fileViewers/PdfViewer";
import UnsupportedViewer from "./fileViewers/UnsupportedViewer";
import { FileText, Braces, Table, FileType } from "lucide-react";

interface FileViewerProps {
  fileRecord: FileRecord;
}

export default function FileViewer({ fileRecord }: FileViewerProps) {
  const router = useRouter();
  const store = useWorkspaceStore();
  const descriptor = getFileViewerDescriptor(fileRecord);

  // ─── Convert to Note ──────────────────────────────────────────────────

  const handleConvertToNote = useCallback(async () => {
    try {
      // Fetch file content
      const contentRes = await axios.get(
        `/api/storage/${fileRecord.id}/content`,
        { responseType: "text", transformResponse: [(d) => d] },
      );
      const text = typeof contentRes.data === "string" ? contentRes.data : "";

      const noteTitle = fileRecord.fileName.replace(/\.(md|mdx|txt)$/i, "");
      const { tempId, promise } = store.optimisticCreateNote(noteTitle);

      // Navigate immediately to the optimistic note
      store.openTab(tempId, "NOTE", noteTitle);
      router.push(`/workspace/notes/${tempId}`);

      // Wait for the real note to be created, then update its content
      const { realId } = await promise;
      router.replace(`/workspace/notes/${realId}`);

      // Set the content on the real note
      try {
        await axios.put(`/api/notes/${realId}`, { content: text });
      } catch {
        // Content update is best-effort; the note was already created
      }

      store.closeTab(fileRecord.id); // Close the FILE tab

      toast.success("Converted to note");
    } catch (err: any) {
      toast.error("Failed to convert to note");
    }
  }, [fileRecord, router, store]);

  // ─── Convert to Stack (JSON) ──────────────────────────────────────────

  const handleConvertJsonToStack = useCallback(async (data: any) => {
    try {
      const stackName = fileRecord.fileName.replace(/\.json$/i, "");

      // Derive columns and rows from JSON data
      let columns: { id: string; name: string; type: string }[] = [];
      let rows: { id: string; data: Record<string, any> }[] = [];

      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        // Array of objects — object keys become columns
        const keys = Object.keys(data[0]);
        columns = keys.map((k) => ({ id: k, name: k, type: "TEXT" as const }));
        rows = data.map((item, i) => ({
          id: `row_${i}`,
          data: Object.fromEntries(keys.map((k) => [k, item[k] ?? ""])),
        }));
      } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        // Single object — keys become rows, values become a single column
        columns = [
          { id: "key", name: "Key", type: "TEXT" as const },
          { id: "value", name: "Value", type: "TEXT" as const },
        ];
        rows = Object.entries(data).map(([k, v], i) => ({
          id: `row_${i}`,
          data: { key: k, value: typeof v === "object" ? JSON.stringify(v) : String(v ?? "") },
        }));
      } else if (Array.isArray(data) && data.length > 0 && data.every((item) => typeof item !== "object")) {
        // Array of primitives — single "Value" column
        columns = [{ id: "value", name: "Value", type: "TEXT" as const }];
        rows = data.map((item, i) => ({
          id: `row_${i}`,
          data: { value: String(item ?? "") },
        }));
      } else {
        // Empty array, empty object, or other unrepresentable data —
        // create a minimal stack so the user can add their own data
        columns = [{ id: "col_1", name: "Column 1", type: "TEXT" as const }];
        rows = [];
      }

      const res = await axios.post("/api/stacks", {
        name: stackName,
        columns,
        rows,
      });

      const stackId = res.data?.id || res.data?.stack?.id;
      if (!stackId) throw new Error("No stack ID returned");

      store.openTab(stackId, "STACK", stackName);
      store.closeTab(fileRecord.id);
      router.push(`/workspace/stacks/${stackId}`);

      toast.success("Converted to stack");
    } catch (err: any) {
      toast.error("Failed to convert to stack");
    }
  }, [fileRecord, router, store]);

  // ─── Convert to Stack (CSV) ───────────────────────────────────────────

  const handleConvertCsvToStack = useCallback(async (headers: string[], csvRows: string[][]) => {
    try {
      const stackName = fileRecord.fileName.replace(/\.csv$/i, "");

      const columns = headers.map((h) => ({
        id: h.toLowerCase().replace(/\s+/g, "_") || `col_${Math.random().toString(36).slice(2, 6)}`,
        name: h,
        type: "TEXT" as const,
      }));

      const rows = csvRows.map((row, i) => ({
        id: `row_${i}`,
        data: Object.fromEntries(headers.map((h, ci) => [columns[ci]?.id || h, row[ci] ?? ""])),
      }));

      const res = await axios.post("/api/stacks", {
        name: stackName,
        columns,
        rows,
      });

      const stackId = res.data?.id || res.data?.stack?.id;
      if (!stackId) throw new Error("No stack ID returned");

      store.openTab(stackId, "STACK", stackName);
      store.closeTab(fileRecord.id);
      router.push(`/workspace/stacks/${stackId}`);

      toast.success("Converted to stack");
    } catch (err: any) {
      toast.error("Failed to convert to stack");
    }
  }, [fileRecord, router, store]);

  // ─── Header icon ──────────────────────────────────────────────────────

  const headerIcon = {
    markdown: FileText,
    json: Braces,
    csv: Table,
    text: FileType,
    image: FileType,
    video: FileType,
    audio: FileType,
    pdf: FileType,
    unsupported: FileType,
  }[descriptor.viewerType];

  const HeaderIcon = headerIcon;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#27272A] bg-[#131313] shrink-0">
        {HeaderIcon && <HeaderIcon className="h-3.5 w-3.5 text-[#10B981]" />}
        <span className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981] truncate">
          {fileRecord.fileName}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono ml-auto uppercase">
          {fileRecord.mimeType}
        </span>
      </div>

      {/* Viewer dispatch */}
      <div className="flex-1 overflow-hidden">
        {descriptor.viewerType === "markdown" && (
          <MarkdownViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
            onConvert={handleConvertToNote}
          />
        )}
        {descriptor.viewerType === "json" && (
          <JsonViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
            onConvert={handleConvertJsonToStack}
          />
        )}
        {descriptor.viewerType === "csv" && (
          <CsvViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
            onConvert={handleConvertCsvToStack}
          />
        )}
        {descriptor.viewerType === "text" && (
          <TextViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
          />
        )}
        {descriptor.viewerType === "image" && (
          <ImageViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
          />
        )}
        {descriptor.viewerType === "video" && (
          <VideoViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
          />
        )}
        {descriptor.viewerType === "audio" && (
          <AudioViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
          />
        )}
        {descriptor.viewerType === "pdf" && (
          <PdfViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
          />
        )}
        {descriptor.viewerType === "unsupported" && (
          <UnsupportedViewer
            fileId={fileRecord.id}
            fileName={fileRecord.fileName}
            mimeType={fileRecord.mimeType}
          />
        )}
      </div>
    </div>
  );
}
