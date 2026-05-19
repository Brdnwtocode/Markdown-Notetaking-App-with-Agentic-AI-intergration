import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export type PendingAction = {
  type: "add_stack_row";
  stackId: string;
  data: Record<string, any>;
} | {
  type: "update_note";
  noteId: string;
  updatedData: { content: string; title?: string; id: string };
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
} | null;

export interface AiSlice {
  // AI Conversational UI
  aiReply: string | null;
  setAiReply: (reply: string | null) => void;
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  commitPendingAction: () => void;
  clearPendingAction: () => void;
}

export const createAiSlice: StateCreator<RootStore, [], [], AiSlice> = (set, get) => ({
  // AI Conversational UI
  aiReply: null,
  setAiReply: (reply) => set({ aiReply: reply }),
  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),
  commitPendingAction: () => {
    const { pendingAction, optimisticAddStackRow, optimisticPatchNote } = get();
    if (pendingAction?.type === "add_stack_row") {
      optimisticAddStackRow(pendingAction.stackId, pendingAction.data);
    } else if (pendingAction?.type === "update_note") {
      optimisticPatchNote(pendingAction.noteId, {
        content: pendingAction.updatedData.content,
        title: pendingAction.updatedData.title,
      });
    } else if (pendingAction?.type === "create_task") {
      const d = pendingAction.data;
      get().optimisticCreateTask({
        title: d.title,
        description: d.description ?? "",
        status: d.status ?? "TODO",
        priority: d.priority ?? "MEDIUM",
        assignee: d.assignee ?? null,
        dueDate: d.dueDate ?? null,
        parentId: d.parentId ?? null,
      });
    } else if (pendingAction?.type === "create_calendar_event") {
      const d = pendingAction.data;
      get().optimisticCreateCalendarEvent({
        title: d.title,
        notes: d.notes ?? "",
        startAt: d.startAt,
        endAt: d.endAt,
        allDay: d.allDay ?? false,
        color: d.color ?? "#5645d4",
      });
    }
    set({ pendingAction: null, aiReply: null });
  },
  clearPendingAction: () => set({ pendingAction: null }),
});
