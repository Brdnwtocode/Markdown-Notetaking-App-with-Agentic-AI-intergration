// lib/context/types.ts
// Type definitions for the Context Grabber system
//
// Note: CommandType and FocusedTarget were removed — intent detection
// is now handled by the AI model on the FastAPI side, not client-side.

export type ContextSource = "active_tab" | "user_mention" | "recent_activity";

export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR";

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
