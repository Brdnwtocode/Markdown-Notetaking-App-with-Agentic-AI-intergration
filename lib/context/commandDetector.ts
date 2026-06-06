// lib/context/commandDetector.ts
// Detects command type from user transcript to determine context packing strategy

import { CommandType } from "./types";

/**
 * Detects the command type from user transcript
 * Used to determine whether to send minimal (precision) or full context
 */
export function detectCommandType(transcript: string): CommandType {
  const lower = transcript.toLowerCase();
  
  // Summarization/insight commands (need full data)
  const summaryKeywords = [
    "summarize", "summary", "insight", "analyze", 
    "find", "pattern", "trend", "overview", "report"
  ];
  if (summaryKeywords.some(keyword => lower.includes(keyword))) {
    return "summarize";
  }
  
  // Bulk operations (need full data)
  const bulkKeywords = ["all", "every", "each", "bulk", "entire"];
  if (bulkKeywords.some(keyword => lower.includes(keyword))) {
    return "bulk_update";
  }
  
  // Delete operations (need ID only)
  const deleteKeywords = ["delete", "remove", "eliminate"];
  if (deleteKeywords.some(keyword => lower.includes(keyword))) {
    return "delete_item";
  }
  
  // Add operations (need schema only)
  const addKeywords = ["add", "new", "create", "insert"];
  if (addKeywords.some(keyword => lower.includes(keyword))) {
    return "add_item";
  }
  
  // Single cell/row edits (need schema + focused target)
  const editKeywords = ["update", "change", "set", "modify", "edit"];
  if (editKeywords.some(keyword => lower.includes(keyword))) {
    return "precision_edit";
  }
  
  return "unknown";
}

/**
 * Checks if the command needs full data context
 */
export function needsFullData(commandType: CommandType): boolean {
  return commandType === "summarize" || commandType === "bulk_update";
}

/**
 * Checks if the command needs only precision context (schema + focused target)
 */
export function needsPrecisionContext(commandType: CommandType): boolean {
  return commandType === "precision_edit" || commandType === "delete_item";
}

/**
 * Checks if the command needs schema only (no row data)
 */
export function needsSchemaOnly(commandType: CommandType): boolean {
  return commandType === "add_item";
}
