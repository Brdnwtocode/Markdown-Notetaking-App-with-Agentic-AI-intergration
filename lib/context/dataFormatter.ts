// lib/context/dataFormatter.ts
// Formats data into compact formats (CSV, Markdown) for efficient token usage

import { DataFormat } from "./types";

/**
 * Formats stack data as CSV
 * Much more compact than JSON (6-10x smaller)
 */
export function formatStackAsCSV(columns: any[], rows: any[]): string {
  // Header row
  const headers = ["id", ...columns.map(c => escapeCSV(c.name))];
  const lines = [headers.join(",")];
  
  // Data rows
  for (const row of rows) {
    const values = [row.id];
    for (const col of columns) {
      const value = row.data?.[col.id] ?? "";
      values.push(escapeCSV(String(value)));
    }
    lines.push(values.join(","));
  }
  
  return lines.join("\n");
}

/**
 * Formats stack data as Markdown table
 * More readable than CSV, still compact
 */
export function formatStackAsMarkdown(columns: any[], rows: any[]): string {
  // Header
  const headers = ["id", ...columns.map(c => c.name)];
  const separator = headers.map(() => "---");
  
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
  ];
  
  // Rows
  for (const row of rows) {
    const values = [row.id];
    for (const col of columns) {
      const value = row.data?.[col.id] ?? "";
      values.push(String(value));
    }
    lines.push(`| ${values.join(" | ")} |`);
  }
  
  return lines.join("\n");
}

/**
 * Formats task data as CSV
 */
export function formatTasksAsCSV(tasks: any[]): string {
  const headers = ["id", "title", "description", "status", "priority", "dueDate", "parentId"];
  const lines = [headers.join(",")];
  
  for (const task of tasks) {
    const values = [
      task.id,
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
 * Formats task data as Markdown table
 */
export function formatTasksAsMarkdown(tasks: any[]): string {
  const headers = ["id", "title", "status", "priority", "dueDate"];
  const separator = headers.map(() => "---");
  
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
  ];
  
  for (const task of tasks) {
    const values = [
      task.id,
      task.title,
      task.status,
      task.priority,
      task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    ];
    lines.push(`| ${values.join(" | ")} |`);
  }
  
  return lines.join("\n");
}

/**
 * Formats calendar events as CSV
 */
export function formatEventsAsCSV(events: any[]): string {
  const headers = ["id", "title", "notes", "startAt", "endAt", "allDay", "color"];
  const lines = [headers.join(",")];
  
  for (const event of events) {
    const values = [
      event.id,
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

/**
 * Escapes a value for CSV format
 */
function escapeCSV(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

/**
 * Formats data based on specified format
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
