// lib/context/types.ts
// Type definitions for the Context Grabber system

export type ContextSource = "active_tab" | "user_mention" | "recent_activity";

export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR";

export type CommandType = 
  | "precision_edit"   // Single cell/row edit (minimal context)
  | "add_item"         // Add new row/task/event
  | "delete_item"       // Delete row/task/event
  | "summarize"        // Summarize data (needs full data)
  | "insight"          // Find insights (needs full data)
  | "bulk_update"      // Update multiple items
  | "unknown";

export type DataFormat = "json" | "csv" | "markdown";

export interface ContextItem {
  type: TabType | "TASK" | "CALENDAR";
  id: string;
  title: string;
  content?: string | object;  // Can be string (CSV/MD) or object (JSON)
  metadata?: Record<string, any>;
  source: ContextSource;
}

export interface PackedContext {
  items: ContextItem[];
  packedAt: Date;
  totalItems: number;
}

export interface ContextPackerOptions {
  maxItems?: number;
  includeContent?: boolean;
  includeMetadata?: boolean;
  dataFormat?: DataFormat;  // csv, markdown, or json
  maxRowsForFullData?: number;  // Limit rows for full data mode
}

export interface FocusedTarget {
  rowId?: string;
  columnId?: string;
  currentValue?: any;
  rowIndex?: number;
  columnIndex?: number;
}
