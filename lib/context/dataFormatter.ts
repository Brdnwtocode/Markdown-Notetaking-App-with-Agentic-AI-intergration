// lib/context/dataFormatter.ts
// Formats data into compact formats (CSV, Markdown) for efficient token usage.
// Row IDs are intentionally omitted — the AI works with data, not internal keys.

import { DataFormat } from "./types";

/** Column type values that can appear in a stack schema */
type ColumnType = "TEXT" | "INT" | "FLOAT" | "BOOLEAN" | "SELECT" | "DATE";

/**
 * Format a single cell value based on its declared column type.
 * Ensures all types are human-readable in the AI context.
 */
function formatCellValue(raw: unknown, columnType: ColumnType): string {
  // Null/undefined → empty
  if (raw === null || raw === undefined) return "";

  switch (columnType) {
    case "BOOLEAN":
      return String(Boolean(raw));
    case "INT":
    case "FLOAT": {
      const n = Number(raw);
      return isNaN(n) ? String(raw) : String(n);
    }
    case "DATE":
      // If it's already an ISO string, return date portion; otherwise pass through
      try {
        const d = new Date(raw as string);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      } catch { /* fall through */ }
      return String(raw);
    case "SELECT":
    case "TEXT":
    default:
      return String(raw);
  }
}

// ─── Stack formatters ─────────────────────────────────────────────────────

/**
 * Build a header label that includes the column type so the AI
 * can distinguish identically-named columns of different types.
 * e.g. "New Column (BOOLEAN)" vs "New Column (DATE)"
 */
function typedHeader(col: { name: string; type: string }): string {
  return `${col.name} (${col.type})`;
}

/**
 * Formats stack data as CSV.
 * Header = "ColumnName (TYPE)" so the AI sees the schema.
 * Each data row = formatted values per column type.
 */
export function formatStackAsCSV(columns: any[], rows: any[]): string {
  // Header row — "Name (TYPE)" format
  const headers = columns.map((c) => escapeCSV(typedHeader(c)));
  const lines = [headers.join(",")];

  // Data rows
  for (const row of rows) {
    const values = columns.map((col) => {
      const raw = row.data?.[col.id];
      return escapeCSV(formatCellValue(raw, col.type as ColumnType));
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Formats stack data as Markdown table.
 * Header = "ColumnName (TYPE)".
 */
export function formatStackAsMarkdown(columns: any[], rows: any[]): string {
  const headers = columns.map((c) => typedHeader(c));
  const separator = headers.map(() => "---");

  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
  ];

  for (const row of rows) {
    const values = columns.map((col) => {
      const raw = row.data?.[col.id];
      return formatCellValue(raw, col.type as ColumnType);
    });
    lines.push(`| ${values.join(" | ")} |`);
  }

  return lines.join("\n");
}

// ─── Task formatters ──────────────────────────────────────────────────────

/**
 * Formats task data as CSV (no row id).
 */
export function formatTasksAsCSV(tasks: any[]): string {
  const headers = ["title", "description", "status", "priority", "dueDate", "parentId"];
  const lines = [headers.join(",")];

  for (const task of tasks) {
    const values = [
      escapeCSV(task.title),
      escapeCSV(task.description || ""),
      task.status,
      task.priority,
      task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      task.parentId || "",
    ];
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Formats task data as Markdown table (no row id).
 */
export function formatTasksAsMarkdown(tasks: any[]): string {
  const headers = ["title", "status", "priority", "dueDate"];
  const separator = headers.map(() => "---");

  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
  ];

  for (const task of tasks) {
    const values = [
      task.title,
      task.status,
      task.priority,
      task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    ];
    lines.push(`| ${values.join(" | ")} |`);
  }

  return lines.join("\n");
}

// ─── Calendar event formatters ────────────────────────────────────────────

/**
 * Formats calendar events as CSV (no row id).
 */
export function formatEventsAsCSV(events: any[]): string {
  const headers = ["title", "notes", "startAt", "endAt", "allDay", "color"];
  const lines = [headers.join(",")];

  for (const event of events) {
    const values = [
      escapeCSV(event.title),
      escapeCSV(event.notes || ""),
      new Date(event.startAt).toISOString(),
      new Date(event.endAt).toISOString(),
      event.allDay ? "true" : "false",
      event.color,
    ];
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Escapes a value for CSV format.
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Formats data based on specified format.
 */
export function formatData(
  dataType: "stack" | "task" | "event",
  data: any,
  format: DataFormat,
  columns?: any[]
): string {
  if (format === "csv") {
    switch (dataType) {
      case "stack":
        return formatStackAsCSV(columns!, data);
      case "task":
        return formatTasksAsCSV(data);
      case "event":
        return formatEventsAsCSV(data);
    }
  } else if (format === "markdown") {
    switch (dataType) {
      case "stack":
        return formatStackAsMarkdown(columns!, data);
      case "task":
        return formatTasksAsMarkdown(data);
      case "event":
        // Events are better as CSV (Markdown tables get messy with dates)
        return formatEventsAsCSV(data);
    }
  }

  // Default to JSON
  return JSON.stringify(data, null, 2);
}
