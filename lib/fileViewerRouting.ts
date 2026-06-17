// lib/fileViewerRouting.ts
//
// MIME-type → viewer component routing table and helpers.

import type { FileRecord } from "@/lib/slices/fileRecordsSlice";

// ─── Viewer types ──────────────────────────────────────────────────────────

export type FileViewerType =
  | "markdown"
  | "json"
  | "csv"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "unsupported";

// ─── Conversion capability ─────────────────────────────────────────────────

export interface ConversionHint {
  /** Human-readable label for the convert button */
  label: string;
  /** Target TabType after conversion */
  targetType: "NOTE" | "STACK";
}

// ─── Viewer descriptor ─────────────────────────────────────────────────────

export interface FileViewerDescriptor {
  viewerType: FileViewerType;
  /** If set, the viewer will show a "Convert to X" / "View Only" banner */
  conversion?: ConversionHint;
  /** Whether this file type is editable in-place (save-back-to-S3) */
  editable: boolean;
}

// ─── MIME → Viewer routing ─────────────────────────────────────────────────

/**
 * Determine how to display a file based on its MIME type and extension.
 * Returns a descriptor that tells FileViewer which sub-component to render.
 */
export function getFileViewerDescriptor(file: FileRecord): FileViewerDescriptor {
  const mime = file.mimeType?.toLowerCase() || "";
  const ext = file.fileName?.split(".").pop()?.toLowerCase() || "";

  // ── Markdown ──
  if (
    mime === "text/markdown" ||
    mime === "text/x-markdown" ||
    ext === "md" ||
    ext === "mdx"
  ) {
    return {
      viewerType: "markdown",
      conversion: { label: "Convert to Note", targetType: "NOTE" },
      editable: false, // markdown view is read-only; conversion is the edit path
    };
  }

  // ── JSON ──
  if (mime === "application/json" || ext === "json") {
    return {
      viewerType: "json",
      conversion: { label: "Convert to Stack", targetType: "STACK" },
      editable: false,
    };
  }

  // ── CSV ──
  if (mime === "text/csv" || ext === "csv") {
    return {
      viewerType: "csv",
      conversion: { label: "Convert to Stack", targetType: "STACK" },
      editable: false,
    };
  }

  // ── Plain text ──
  if (mime.startsWith("text/")) {
    return {
      viewerType: "text",
      editable: true,
    };
  }

  // ── Images ──
  if (mime.startsWith("image/")) {
    return { viewerType: "image", editable: false };
  }

  // ── Video ──
  if (mime.startsWith("video/")) {
    return { viewerType: "video", editable: false };
  }

  // ── Audio ──
  if (mime.startsWith("audio/")) {
    return { viewerType: "audio", editable: false };
  }

  // ── PDF ──
  if (mime === "application/pdf") {
    return { viewerType: "pdf", editable: false };
  }

  // ── Fallback ──
  return { viewerType: "unsupported", editable: false };
}

/**
 * Quick helper: determine if a file can be viewed inline
 * (i.e., it maps to a real viewer, not "unsupported").
 */
export function isViewableInline(file: FileRecord): boolean {
  return getFileViewerDescriptor(file).viewerType !== "unsupported";
}
