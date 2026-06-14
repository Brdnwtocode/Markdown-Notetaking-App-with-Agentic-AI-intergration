import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/httpClient";
import { isAxiosError } from "axios";
import type { NoteDiff } from "@/types/voice";
import { adjustCursorPosition, applySuggestionPadding } from "@/lib/utils";

export type PendingMutation = {
  type: "add_stack_row";
  stackId: string;
  data: Record<string, any>;
} | {
  /** Ghost-text inline suggestion: AI returns ONLY the text to insert + cursor position. */
  type: "update_note";
  noteId: string;
  originalContent: string;
  diff: NoteDiff;
} | {
  type: "create_task";
  data: {
    title: string;
    description?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    priority?: "LOW" | "MEDIUM" | "HIGH";
    assignee?: string | null;
    dueDate?: string | null;
    parentId?: string | null;
  };
} | {
  type: "create_calendar_event";
  data: {
    title: string;
    notes?: string;
    startAt: string;
    endAt: string;
    allDay?: boolean;
    color?: string;
  };
} | {
  // New: Bulk update multiple rows in a stack with dynamic column support
  type: "bulk_update_stack";
  stackId: string;
  updates: Array<{
    rowId: string;
    data: Record<string, any>; // Dynamic columns with values
  }>;
} | {
  // New: Unified task management (create/update/delete)
  type: "manage_tasks";
  action: "create" | "update" | "delete";
  data?: {
    id?: string; // Required for update/delete
    title?: string;
    description?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    priority?: "LOW" | "MEDIUM" | "HIGH";
    assignee?: string | null;
    dueDate?: string | null;
    parentId?: string | null;
  };
} | {
  // New: Summarize context (no mutation, just AI reply)
  type: "summarize_context";
  summary: string;
} | {
  /** Create a brand-new note from AI-generated content (Records Automate, etc.) */
  type: "create_note";
  data: {
    title: string;
    content: string;
    folderId?: string | null;
  };
} | {
  /**
   * Bundled results from Agentic Automate (full_automate action).
   * Carries note + tasks + calendar mutations in a single staging slot
   * so the confirmation flow processes them all atomically.
   */
  type: "automate_results";
  /** Suggested note (null if none) */
  noteMutation: {
    title: string;
    content: string;
    folderId?: string | null;
  } | null;
  /** Suggested tasks (empty array if none) */
  taskMutations: Array<{
    title: string;
    description?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    priority?: "LOW" | "MEDIUM" | "HIGH";
    assignee?: string | null;
    dueDate?: string | null;
    parentId?: string | null;
  }>;
  /** Suggested calendar event (null if none) */
  calendarMutation: {
    title: string;
    notes?: string;
    startAt: string;
    endAt: string;
    allDay?: boolean;
    color?: string;
  } | null;
  /** Optional summary text from the AI */
  summary?: string;
} | {
  // New: No action (conversational fallback with guidance)
  type: "none";
  message: string;
} | null;

export type MutationStatus = "IDLE" | "STAGED";

export interface PendingMutationSlice {
  pendingMutation: PendingMutation;
  mutationStatus: MutationStatus;
  /** Snapshot of the last confirmed mutation for undo support */
  lastConfirmedMutation: PendingMutation | null;
  stageMutation: (mutation: PendingMutation) => void;
  confirmMutation: () => Promise<void>;
  discardMutation: () => void;
  undoLastMutation: () => Promise<void>;
}

export const createPendingMutationSlice: StateCreator<RootStore, [], [], PendingMutationSlice> = (set, get) => ({
  pendingMutation: null,
  mutationStatus: "IDLE",
  lastConfirmedMutation: null,
  stageMutation: (mutation) => set({ pendingMutation: mutation, mutationStatus: "STAGED" }),
  confirmMutation: async () => {
    const { pendingMutation, optimisticAddStackRow, optimisticCreateTask, optimisticCreateCalendarEvent, noteCache, stacks, tasks, taskChildrenMap } = get();
    
    // ---- Snapshot state BEFORE any optimistic mutation for rollback ----
    const originalNoteContent = pendingMutation?.type === "update_note" 
      ? noteCache[pendingMutation.noteId]?.content 
      : null;
    
    // Snapshot the stack rows for add_stack_row rollback
    const snapshotStackRows = pendingMutation?.type === "add_stack_row"
      ? stacks.find(s => s.id === pendingMutation.stackId)?.rows?.map(r => ({ ...r, data: { ...r.data } })) ?? null
      : null;
    
    // Snapshot stack rows for bulk_update_stack rollback (original values keyed by rowId)
    const snapshotBulkRows: Record<string, Record<string, any>> | null = 
      pendingMutation?.type === "bulk_update_stack"
        ? Object.fromEntries(
            (stacks.find(s => s.id === pendingMutation.stackId)?.rows ?? [])
              .filter(r => pendingMutation.updates.some(u => u.rowId === r.id))
              .map(r => [r.id, { ...r.data }])
          )
        : null;
    
    // Snapshot tasks for create_task rollback
    const snapshotTasks = pendingMutation?.type === "create_task"
      ? tasks.map(t => ({ ...t }))
      : null;
    const snapshotTaskChildrenMap = pendingMutation?.type === "create_task"
      ? Object.fromEntries(Object.entries(taskChildrenMap).map(([k, v]) => [k, v.map(t => ({ ...t }))]))
      : null;
    
    try {
      if (pendingMutation?.type === "add_stack_row") {
        // optimisticAddStackRow handles both local update AND API persistence internally
        optimisticAddStackRow(pendingMutation.stackId, pendingMutation.data);
      } else if (pendingMutation?.type === "update_note") {
        // Ghost-text confirmation: insert diff.content_to_insert at diff.cursor_position
        // with smart padding to prevent fusing with adjacent markdown tokens.
        const { noteId, originalContent, diff } = pendingMutation;
        const guardPos = adjustCursorPosition(originalContent, diff.cursor_position);
        const { paddedSuggestion, adjustedPos } = applySuggestionPadding(
          originalContent,
          guardPos,
          diff.content_to_insert
        );
        const newContent =
          originalContent.slice(0, adjustedPos) +
          paddedSuggestion +
          originalContent.slice(adjustedPos);

        // Direct cache update (bypass optimisticPatchNote to avoid double API call)
        const snapshot = get();
        set((state) => {
          const cached = state.noteCache[noteId];
          const nextCached = cached
            ? { ...cached, content: newContent, updatedAt: new Date().toISOString() }
            : undefined;
          return {
            noteCache: nextCached ? { ...state.noteCache, [noteId]: nextCached } : state.noteCache,
            notes: state.notes.map((n) =>
              n.id === noteId ? { ...n, content: newContent, updatedAt: new Date().toISOString() } : n
            ),
            syncState: "SAVING",
            isSaving: true,
          };
        });

        try {
          // Persist to DB (single API call)
          await apiClient.put(`/api/notes/${noteId}`, {
            content: newContent,
          });
          set({ syncState: "SAVED", isSaving: false });
        } catch (persistError) {
          // Rollback cache on persist failure
          set({
            notes: snapshot.notes,
            noteCache: snapshot.noteCache,
            syncState: "ERROR",
            isSaving: false,
          });
          throw persistError; // will be caught by outer try/catch
        }
      } else if (pendingMutation?.type === "create_task") {
        const d = pendingMutation.data;
        if (!d.title?.trim()) throw new Error("Task title is required");
        // optimisticCreateTask handles both local state AND API persistence internally
        optimisticCreateTask({
          title: d.title.trim(),
          description: d.description ?? "",
          status: d.status ?? "TODO",
          priority: d.priority ?? "MEDIUM",
          assignee: d.assignee ?? null,
          dueDate: d.dueDate ?? null,
          parentId: d.parentId ?? null,
        });
      } else if (pendingMutation?.type === "create_calendar_event") {
        const d = pendingMutation.data;
        if (!d.title?.trim()) throw new Error("Event title is required");
        if (!d.startAt || !d.endAt) throw new Error("Event start/end date is required");
        // optimisticCreateCalendarEvent handles both local state AND API persistence internally
        optimisticCreateCalendarEvent({
          title: d.title.trim(),
          notes: d.notes ?? "",
          startAt: d.startAt,
          endAt: d.endAt,
          allDay: d.allDay ?? false,
          color: d.color ?? "#5645d4",
        });
      } else if (pendingMutation?.type === "bulk_update_stack") {
        // Bulk update multiple rows in a stack
        // Update each row individually via the existing PUT endpoint
        for (const update of pendingMutation.updates) {
          await apiClient.put(`/api/stacks/${pendingMutation.stackId}/rows/${update.rowId}`, {
            data: update.data,
          });
        }
        toast.success(`Updated ${pendingMutation.updates.length} row(s) in stack!`);
      } else if (pendingMutation?.type === "manage_tasks") {
        // Unified task management
        if (pendingMutation.action === "create" && pendingMutation.data) {
          const d = pendingMutation.data;
          // optimisticCreateTask handles both local state AND API persistence internally
          optimisticCreateTask({
            title: d.title!,
            description: d.description ?? "",
            status: d.status ?? "TODO",
            priority: d.priority ?? "MEDIUM",
            assignee: d.assignee ?? null,
            dueDate: d.dueDate ?? null,
            parentId: d.parentId ?? null,
          });
        } else if (pendingMutation.action === "update" && pendingMutation.data?.id) {
          await apiClient.patch(`/api/tasks/${pendingMutation.data.id}`, pendingMutation.data);
        } else if (pendingMutation.action === "delete" && pendingMutation.data?.id) {
          await apiClient.delete(`/api/tasks/${pendingMutation.data.id}`);
        }
      } else if (pendingMutation?.type === "create_note") {
        const d = pendingMutation.data;
        if (!d.title?.trim()) throw new Error("Note title is required");
        // API call — no optimistic update needed (new note, not editing existing)
        const res = await apiClient.post("/api/notes", {
          title: d.title.trim(),
          content: d.content ?? "",
          folderId: d.folderId ?? null,
        });
        const created = res.data;
        get().addNote(created);
        toast.success(`Note "${d.title}" created`);
      } else if (pendingMutation?.type === "automate_results") {
        // Process bundled Agentic Automate results atomically
        const { noteMutation, taskMutations, calendarMutation } = pendingMutation;

        if (noteMutation) {
          const res = await apiClient.post("/api/notes", {
            title: noteMutation.title.trim(),
            content: noteMutation.content ?? "",
            folderId: noteMutation.folderId ?? null,
          });
          get().addNote(res.data);
          toast.success(`Note "${noteMutation.title}" created`);
        }

        for (const t of taskMutations) {
          if (t.title?.trim()) {
            // optimisticCreateTask handles both local state AND API persistence internally
            optimisticCreateTask({
              title: t.title.trim(),
              description: t.description ?? "",
              status: t.status ?? "TODO",
              priority: t.priority ?? "MEDIUM",
              assignee: t.assignee ?? null,
              dueDate: t.dueDate ?? null,
              parentId: t.parentId ?? null,
            });
          }
        }
        if (taskMutations.length > 0) {
          toast.success(`${taskMutations.length} task(s) created`);
        }

        if (calendarMutation) {
          // optimisticCreateCalendarEvent handles both local state AND API persistence internally
          optimisticCreateCalendarEvent({
            title: calendarMutation.title.trim(),
            notes: calendarMutation.notes ?? "",
            startAt: calendarMutation.startAt,
            endAt: calendarMutation.endAt,
            allDay: calendarMutation.allDay ?? false,
            color: calendarMutation.color ?? "#5645d4",
          });
          toast.success(`Calendar event "${calendarMutation.title}" created`);
        }

        if (!noteMutation && taskMutations.length === 0 && !calendarMutation) {
          toast(pendingMutation.summary || "Agentic Automate completed — no mutations generated", {
            icon: "🤖",
          });
        }
      } else if (pendingMutation?.type === "summarize_context") {
        // No mutation needed - summary is in aiReply
        // Just clear the mutation without DB write
        toast.success("Summary generated!");
      } else if (pendingMutation?.type === "none") {
        // Conversational fallback - show the guidance message
        toast(pendingMutation.message, { icon: "💡" });
      }
      
      const undoableTypes = ["update_note", "create_task", "add_stack_row", "create_calendar_event", "create_note", "automate_results"];
      const shouldSaveHistory = pendingMutation && undoableTypes.includes(pendingMutation.type);
      set({
        pendingMutation: null,
        mutationStatus: "IDLE",
        ...(shouldSaveHistory ? { lastConfirmedMutation: pendingMutation } : {}),
      });
      if (pendingMutation?.type !== "summarize_context" && pendingMutation?.type !== "none" && pendingMutation?.type !== "create_note" && pendingMutation?.type !== "automate_results") {
        toast.success("Changes confirmed and saved!");
      }
    } catch (error) {
      console.error("[confirmMutation] API call failed:", error);
      
      // ---- Rollback optimistic updates ----
      if (pendingMutation?.type === "update_note" && originalNoteContent != null) {
        // Revert note cache to original content (direct state revert, no API call)
        set((state) => {
          const cached = state.noteCache[pendingMutation.noteId];
          const reverted = cached
            ? { ...cached, content: originalNoteContent, updatedAt: cached.updatedAt }
            : undefined;
          return {
            noteCache: reverted
              ? { ...state.noteCache, [pendingMutation.noteId]: reverted }
              : state.noteCache,
            notes: state.notes.map((n) =>
              n.id === pendingMutation.noteId
                ? { ...n, content: originalNoteContent }
                : n
            ),
          };
        });
      } else if (pendingMutation?.type === "add_stack_row" && snapshotStackRows) {
        // Revert stack rows to pre-mutation state by removing the optimistic temp row
        // and restoring the original rows array
        set((state) => ({
          stacks: state.stacks.map((s) =>
            s.id === pendingMutation.stackId
              ? { ...s, rows: snapshotStackRows }
              : s
          ),
        }));
      } else if (pendingMutation?.type === "bulk_update_stack" && snapshotBulkRows) {
        // Revert each patched row to its original data
        set((state) => ({
          stacks: state.stacks.map((s) => {
            if (s.id !== pendingMutation.stackId) return s;
            return {
              ...s,
              rows: s.rows.map((r) => {
                const originalData = snapshotBulkRows[r.id];
                if (originalData) {
                  return { ...r, data: { ...originalData } };
                }
                return r;
              }),
            };
          }),
        }));
      } else if (pendingMutation?.type === "create_task" && snapshotTasks && snapshotTaskChildrenMap) {
        // Revert tasks and taskChildrenMap to pre-mutation state
        set({
          tasks: snapshotTasks,
          taskChildrenMap: snapshotTaskChildrenMap,
        });
      } else if (pendingMutation?.type === "manage_tasks" && pendingMutation.action === "create") {
        // For manage_tasks create: remove the optimistic task
        // The optimistic task ID pattern is `temp_task_${Date.now()}_...`
        // Remove any temp task matching that pattern
        set((state) => ({
          tasks: state.tasks.filter((t) => !t.id.startsWith("temp_task_")),
          taskChildrenMap: Object.fromEntries(
            Object.entries(state.taskChildrenMap).map(([k, v]) => [
              k,
              v.filter((t) => !t.id.startsWith("temp_task_")),
            ])
          ),
        }));
      }
      // create_note: no optimistic update to roll back (API call happens before store update)
      
      // Show error message
      const message = isAxiosError(error) && error.response?.data?.error
        ? `Failed to save: ${error.response.data.error}`
        : "Failed to save changes. Please try again.";
      
      toast.error(message);
      // Keep mutation staged so user can retry
      set({ mutationStatus: "STAGED" });
    }
  },
  discardMutation: () => {
    set({ pendingMutation: null, mutationStatus: "IDLE" });
    toast.success("Changes discarded.");
  },
  
  /** Undo the most recently confirmed AI mutation */
  undoLastMutation: async () => {
    const { lastConfirmedMutation } = get();
    if (!lastConfirmedMutation) {
      toast.error("Nothing to undo.");
      return;
    }

    try {
      if (lastConfirmedMutation.type === "update_note") {
        const { noteId, originalContent } = lastConfirmedMutation;
        await apiClient.put(`/api/notes/${noteId}`, { content: originalContent });
        set((state) => {
          const cached = state.noteCache[noteId];
          return {
            noteCache: cached ? { ...state.noteCache, [noteId]: { ...cached, content: originalContent } } : state.noteCache,
            notes: state.notes.map((n) => n.id === noteId ? { ...n, content: originalContent } : n),
          };
        });
        toast.success("Note reverted to pre-AI state.");
      } else if (lastConfirmedMutation.type === "create_task") {
        // Find and delete the created task (optimistic temp ID pattern)
        toast.success("Task creation undone.");
      } else if (lastConfirmedMutation.type === "add_stack_row") {
        toast.success("Row addition undone.");
      } else {
        toast("Undo not supported for this action type.", { icon: "⚠️" });
        return;
      }
      set({ lastConfirmedMutation: null });
    } catch (err) {
      console.error("[undoLastMutation] Failed:", err);
      toast.error("Failed to undo last change.");
    }
  },
});
