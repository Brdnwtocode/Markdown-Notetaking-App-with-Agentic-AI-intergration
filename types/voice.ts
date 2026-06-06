/**
 * Voice processing type definitions
 * 
 * These types enforce contract alignment between the BFF (Next.js) and
 * the FastAPI microservice, as well as the client-side consumers.
 */

// ─── Outbound Request to FastAPI ────────────────────────────────────────────

export interface VoiceProcessRequest {
  /** Audio blob for STT (mutually exclusive with transcript) */
  audio?: Blob | File;
  /** Pre-transcribed text (mutually exclusive with audio) */
  transcript?: string;
  
  // Context fields (legacy single context or packed context)
  /** Legacy: context type (NOTE, STACK, TASK) */
  context_type?: string;
  /** Legacy: context ID */
  context_id?: string;
  /** New: packed context JSON string with multiple context items */
  packed_context?: string;
  
  /** Cursor position in the active editor */
  cursor_position?: string;
  
  // Typed request fields for FastAPI
  /** Current note content when a note is open (sent when contextType is NOTE) */
  note_state?: string | null;
  /** Stack column schema when a stack is open (sent when contextType is STACK) */
  dynamic_schema?: string | null;
  /** Task context when a task is focused (sent when contextType is TASK) */
  task_context?: string | null;
  
  /** User ID for backend validation */
  user_id?: string;
}

// ─── Inbound Response from FastAPI ──────────────────────────────────────────

export interface VoiceResponse {
  /** 
   * Action to perform:
   * - Legacy: update_note, add_stack_row, create_task, create_calendar_event
   * - New NLU: bulk_update_stack, manage_tasks, summarize_context, none
   */
  action: string;
  
  /**
   * Updated data for the action (mutually exclusive with aiReply).
   * Present when the voice command results in a data mutation.
   * 
   * For bulk_update_stack: Array of row updates with dynamic column mappings
   * For manage_tasks: Task action (create/update/delete) with parameters
   * For summarize_context: Summary output (typically in aiReply instead)
   */
  updatedData?: unknown | null;
  
  /**
   * AI-generated reply text (mutually exclusive with updatedData).
   * Present when the voice command is a query or conversation.
   * 
   * For summarize_context: Contains the generated summary
   * For none action: Contains guidance message (e.g., "Please select tabs or use @mentions")
   */
  aiReply?: string | null;
  
  /** Optional error message */
  error?: string;
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function hasUpdatedData(response: VoiceResponse): boolean {
  return response.updatedData != null && response.updatedData !== undefined;
}

export function hasAiReply(response: VoiceResponse): boolean {
  return !!response.aiReply && response.aiReply.trim().length > 0;
}

/**
 * Asserts that updatedData and aiReply are mutually exclusive.
 * Logs a warning if both are present (contract violation).
 */
export function assertMutualExclusivity(response: VoiceResponse): void {
  const hasData = hasUpdatedData(response);
  const hasReply = hasAiReply(response);
  
  if (hasData && hasReply) {
    console.warn(
      "[Voice Contract] Both updatedData and aiReply present in response. " +
      "They should be mutually exclusive.",
      { action: response.action, updatedData: response.updatedData, aiReply: response.aiReply }
    );
  }
}
