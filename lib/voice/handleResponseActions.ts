// lib/voice/handleResponseActions.ts
//
// Processes the FastAPI response and returns a reply string + dispatches
// mutations via the Zustand store. Used by both PushToTalk and ChatSidebar.

import { useWorkspaceStore } from "@/lib/store";
import type { VoiceResponse } from "@/types/voice";
import { toast } from "@/lib/toast";

export interface ActionContext {
  currentNoteId: string | null;
  currentStackId: string | null;
  currentFocusedTaskId: string | null;
  noteCache: Record<string, { content?: string; title?: string } | undefined>;
  stacks: Array<{ id: string; name: string }>;
  tasks: any[];
  taskChildrenMap: Record<string, any[]>;
  originalContent: string; // note content at time of request
}

/**
 * Process the FastAPI voice response — dispatches store mutations and
 * returns the human-readable reply string for the chat message.
 */
export function handleResponseActions(
  response: VoiceResponse,
  ctx: ActionContext
): string {
  const { action, updatedData, aiReply } = response;
  const store = useWorkspaceStore.getState();

  // Pure conversational reply (no action/mutation)
  if (!action && !updatedData && aiReply) {
    return aiReply;
  }

  // Action-driven replies
  if (!action) {
    return aiReply || "Done!";
  }

  // ── Actions that return updatedData ──
  if (updatedData) {
    return handleDataAction(action, updatedData, ctx, store);
  }

  // ── Actions with no updatedData ──
  switch (action) {
    case "summarize_context":
      return aiReply || "Summary could not be generated. Please try with more specific context.";
    case "none":
      return aiReply || "I couldn't determine what action to take. Try being more specific about what you want to create or modify.";
    default:
      return aiReply || "Action completed, but no details were returned. Check your workspace for changes.";
  }
}

// ─── Action dispatchers ──────────────────────────────────────────────────

function handleDataAction(
  action: string,
  updatedData: any,
  ctx: ActionContext,
  store: ReturnType<typeof useWorkspaceStore.getState>
): string {
  switch (action) {
    case "update_note": {
      const noteId: string = updatedData?.id || ctx.currentNoteId || "";
      if (!noteId) return "AI suggested edits but no note is open to display them.";

      const diff = updatedData?.diff;
      if (!diff || !diff.content_to_insert) {
        return "AI suggested edits but no inline suggestion was returned.";
      }

      const noteTitle = ctx.noteCache[noteId]?.title || "Note";
      store.openTab(noteId, "NOTE", noteTitle);
      store.stageMutation({
        type: "update_note",
        noteId,
        originalContent: ctx.noteCache[noteId]?.content || ctx.originalContent || "",
        diff,
      });
      toast.persistent(`AI suggestion ready in "${noteTitle}" — press Tab to accept`);
      return `AI suggests: "${diff.content_to_insert}"\n\nPress **Tab** to accept or **Esc** to dismiss.`;
    }

    case "add_stack_row": {
      const stackId: string = updatedData?.stackId || ctx.currentStackId || "";
      if (!stackId) return "AI suggested a new row but no stack is open to display it.";
      const stack = ctx.stacks.find((s) => s.id === stackId);
      const stackName = stack?.name || "Stack";
      store.openTab(stackId, "STACK", stackName);
      store.stageMutation({ type: "add_stack_row", stackId, data: updatedData });
      toast.persistent(`AI suggested a new row in "${stackName}" — review and accept`);
      return `AI suggested a new row in "${stackName}".\n\nReview the highlighted ghost row and click **Accept** to save or **Discard** to revert.`;
    }

    case "create_task":
      store.stageMutation({ type: "create_task", data: updatedData });
      toast.persistent(`AI suggested a new task: "${updatedData?.title || "Untitled"}" — review and accept`);
      return `AI suggested a new task: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;

    case "create_calendar_event":
      store.stageMutation({ type: "create_calendar_event", data: updatedData });
      toast.persistent(`AI suggested a calendar event: "${updatedData?.title || "Untitled"}" — review and accept`);
      return `AI suggested a new calendar event: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;

    case "bulk_update_stack": {
      const stackId: string = updatedData?.stackId || ctx.currentStackId || "";
      if (!stackId || !updatedData?.updates) return "AI suggested bulk updates but no stack is open.";
      const stack = ctx.stacks.find((s) => s.id === stackId);
      const stackName = stack?.name || "Stack";
      store.openTab(stackId, "STACK", stackName);
      store.stageMutation({ type: "bulk_update_stack", stackId, updates: updatedData.updates });
      toast.persistent(`AI suggested updates to ${updatedData.updates.length} row(s) in "${stackName}" — review and accept`);
      return `AI suggested bulk updates to ${updatedData.updates.length} row(s) in "${stackName}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
    }

    case "manage_tasks":
      store.stageMutation({ type: "manage_tasks", action: updatedData?.action || "create", data: updatedData });
      toast.persistent(`AI suggested a task ${updatedData?.action || "update"} — review and accept`);
      return `AI suggested a task ${updatedData?.action || "update"}.\n\nReview and click **Accept** to save or **Discard** to revert.`;

    default:
      return "Done!";
  }
}
