// lib/voice/buildFormData.ts
//
// Builds the multipart FormData payload for POST /api/voice/process.
// Both PushToTalk and ChatSidebar use identical form-building logic.

import { useWorkspaceStore } from "@/lib/store";
import type { PackedContext, ContextItem } from "@/lib/context/types";
import { isNoContextItem } from "./contextHelpers";

export interface FormDataContext {
  currentNoteId: string | null;
  currentStackId: string | null;
  currentFocusedTaskId: string | null;
  cursorPosition: number;
  noteCache: Record<string, { content?: string } | undefined>;
  tasks: any[];
  taskChildrenMap: Record<string, any[]>;
}

/**
 * Build the FormData payload sent to /api/voice/process.
 * Sends packed_context (JSON) + legacy backward-compat fields.
 */
export function buildVoiceFormData(
  transcript: string,
  packedContext: PackedContext,
  ctx: FormDataContext
): FormData {
  const form = new FormData();
  form.append("transcript", transcript);
  form.append("packed_context", JSON.stringify(packedContext));

  // Backward-compatible legacy fields
  const primary: ContextItem | undefined = packedContext.items[0];
  if (!primary) return form;

  form.append("contextType", primary.type);
  form.append("contextId", primary.id);

  // Cursor position only relevant for NOTE context
  if (primary.type === "NOTE") {
    form.append("cursorPosition", ctx.cursorPosition.toString());
  }

  // Typed aux payloads
  if (primary.type === "NOTE" && ctx.currentNoteId && !isNoContextItem(primary.id)) {
    form.append("note_state", ctx.noteCache[ctx.currentNoteId]?.content ?? "");
  } else if (primary.type === "TASK" && ctx.currentFocusedTaskId && !isNoContextItem(primary.id)) {
    const allTasks = [...ctx.tasks, ...Object.values(ctx.taskChildrenMap).flat()];
    const focused = allTasks.find((t) => t.id === ctx.currentFocusedTaskId);
    if (focused) {
      form.append("task_context", JSON.stringify({
        focusedTaskId: focused.id,
        focusedTaskTitle: focused.title,
      }));
    }
  }
  // Note: dynamic_schema is NOT sent separately — it's inside packed_context

  return form;
}

/** Snapshot the store fields needed by buildVoiceFormData */
export function getFormDataContext(): FormDataContext {
  const s = useWorkspaceStore.getState();
  return {
    currentNoteId: s.currentNoteId,
    currentStackId: s.currentStackId,
    currentFocusedTaskId: s.currentFocusedTaskId,
    cursorPosition: s.cursorPosition,
    noteCache: s.noteCache,
    tasks: s.tasks,
    taskChildrenMap: s.taskChildrenMap,
  };
}
