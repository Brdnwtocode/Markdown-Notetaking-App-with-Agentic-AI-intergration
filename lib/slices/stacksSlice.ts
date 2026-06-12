import { StateCreator } from "zustand";
import toast from "react-hot-toast";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";

export interface StackColumn {
  id: string;
  stackId: string;
  name: string;
  type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN" | "DATE" | "SELECT" | "FORMULA" | "RELATION";
  order: number;
}

export interface StackRow {
  id: string;
  stackId: string;
  data: Record<string, any>;
}

export interface Stack {
  id: string;
  userId: string;
  name: string;
  folderId: string | null;
  columns: StackColumn[];
  rows: StackRow[];
  createdAt: string;
  updatedAt: string;
}

export interface StacksSlice {
  // Stacks
  stacks: Stack[];
  currentStackId: string | null;
  setCurrentStackId: (id: string | null) => void;
  addStack: (stack: Stack) => void;
  updateStack: (stack: Stack) => void;
  deleteStack: (id: string) => void;
  setStacks: (stacks: Stack[]) => void;

  // Focus tracking for precision edits
  focusedRowId: string | null;
  focusedColumnId: string | null;
  setFocusedRow: (rowId: string | null) => void;
  setFocusedColumn: (columnId: string | null) => void;

  optimisticRenameStack: (stackId: string, name: string) => void;
  optimisticMoveStack: (stackId: string, folderId: string | null) => void;
  optimisticAddStackRow: (
    stackId: string,
    data: Record<string, any>
  ) => void;
  optimisticPatchStackRow: (
    stackId: string,
    rowId: string,
    data: Record<string, any>
  ) => void;
  optimisticDeleteStackRow: (stackId: string, rowId: string) => void;
}

function tempId(prefix: string) {
  return `temp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const createStacksSlice: StateCreator<RootStore, [], [], StacksSlice> = (set, get) => ({
  // Stacks
  stacks: [],
  currentStackId: null,
  setCurrentStackId: (id) => set({ currentStackId: id }),
  addStack: (stack) =>
    set((state) => ({ stacks: [...state.stacks, stack] })),
  updateStack: (stack) =>
    set((state) => ({
      stacks: state.stacks.map((s) => (s.id === stack.id ? stack : s)),
    })),
  deleteStack: (id) =>
    set((state) => ({ stacks: state.stacks.filter((s) => s.id !== id) })),
  setStacks: (stacks) => set({ stacks }),

  // Focus tracking
  focusedRowId: null,
  focusedColumnId: null,
  setFocusedRow: (rowId) => set({ focusedRowId: rowId }),
  setFocusedColumn: (columnId) => set({ focusedColumnId: columnId }),

  optimisticRenameStack: (stackId, name) => {
    const snapshot = get();
    set((state) => ({
      stacks: state.stacks.map((s) => (s.id === stackId ? { ...s, name } : s)),
      openTabs: state.openTabs.map((t) =>
        t.id === stackId && t.type === "STACK" ? { ...t, title: name } : t
      ),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson(`/api/stacks/${stackId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    })
      .then(() => {
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          notes: snapshot.notes,
          noteCache: snapshot.noteCache,
          currentNoteId: snapshot.currentNoteId,
          openTabs: snapshot.openTabs,
          activeTabId: snapshot.activeTabId,
          stacks: snapshot.stacks,
          currentStackId: snapshot.currentStackId,
          isRecording: snapshot.isRecording,
          recordingTranscript: snapshot.recordingTranscript,
          isSaving: snapshot.isSaving,
          syncState: "ERROR",
          cursorPosition: snapshot.cursorPosition,
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
        });
        toast.error("Failed to update stack name");
      });
  },

  optimisticMoveStack: (stackId, folderId) => {
    const snapshot = get();
    set((state) => ({
      stacks: state.stacks.map((s) => (s.id === stackId ? { ...s, folderId } : s)),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson(`/api/stacks/${stackId}`, {
      method: "PUT",
      body: JSON.stringify({ folderId }),
    })
      .then(() => {
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          notes: snapshot.notes,
          noteCache: snapshot.noteCache,
          currentNoteId: snapshot.currentNoteId,
          openTabs: snapshot.openTabs,
          activeTabId: snapshot.activeTabId,
          stacks: snapshot.stacks,
          currentStackId: snapshot.currentStackId,
          isRecording: snapshot.isRecording,
          recordingTranscript: snapshot.recordingTranscript,
          isSaving: snapshot.isSaving,
          syncState: "ERROR",
          cursorPosition: snapshot.cursorPosition,
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
        });
        toast.error("Failed to move stack");
      });
  },

  optimisticAddStackRow: (stackId, data) => {
    const snapshot = get();
    const id = tempId("row");
    const optimistic: StackRow = { id, stackId, data };

    set((state) => ({
      stacks: state.stacks.map((s) =>
        s.id === stackId ? { ...s, rows: [...s.rows, optimistic] } : s
      ),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson<StackRow>(`/api/stacks/${stackId}/rows`, {
      method: "POST",
      body: JSON.stringify({ data }),
    })
      .then((created) => {
        set((state) => ({
          stacks: state.stacks.map((s) =>
            s.id === stackId
              ? {
                  ...s,
                  rows: s.rows.map((r) => (r.id === id ? created : r)),
                }
              : s
          ),
          syncState: "SAVED",
          isSaving: false,
        }));
      })
      .catch(() => {
        set({
          notes: snapshot.notes,
          noteCache: snapshot.noteCache,
          currentNoteId: snapshot.currentNoteId,
          openTabs: snapshot.openTabs,
          activeTabId: snapshot.activeTabId,
          stacks: snapshot.stacks,
          currentStackId: snapshot.currentStackId,
          isRecording: snapshot.isRecording,
          recordingTranscript: snapshot.recordingTranscript,
          isSaving: snapshot.isSaving,
          syncState: "ERROR",
          cursorPosition: snapshot.cursorPosition,
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
        });
        toast.error("Failed to add row");
      });
  },

  optimisticPatchStackRow: (stackId, rowId, data) => {
    const snapshot = get();
    set((state) => ({
      stacks: state.stacks.map((s) =>
        s.id === stackId
          ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, data } : r)) }
          : s
      ),
      syncState: "SAVING",
      isSaving: true,
    }));

    if (rowId.startsWith("temp_")) return;

    void apiJson<StackRow>(`/api/stacks/${stackId}/rows/${rowId}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    })
      .then(() => {
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          notes: snapshot.notes,
          noteCache: snapshot.noteCache,
          currentNoteId: snapshot.currentNoteId,
          openTabs: snapshot.openTabs,
          activeTabId: snapshot.activeTabId,
          stacks: snapshot.stacks,
          currentStackId: snapshot.currentStackId,
          isRecording: snapshot.isRecording,
          recordingTranscript: snapshot.recordingTranscript,
          isSaving: snapshot.isSaving,
          syncState: "ERROR",
          cursorPosition: snapshot.cursorPosition,
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
        });
        toast.error("Failed to update row");
      });
  },

  optimisticDeleteStackRow: (stackId, rowId) => {
    const snapshot = get();
    set((state) => ({
      stacks: state.stacks.map((s) =>
        s.id === stackId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s
      ),
      syncState: "SAVING",
      isSaving: true,
    }));

    if (rowId.startsWith("temp_")) return;

    void fetch(`/api/stacks/${stackId}/rows/${rowId}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          notes: snapshot.notes,
          noteCache: snapshot.noteCache,
          currentNoteId: snapshot.currentNoteId,
          openTabs: snapshot.openTabs,
          activeTabId: snapshot.activeTabId,
          stacks: snapshot.stacks,
          currentStackId: snapshot.currentStackId,
          isRecording: snapshot.isRecording,
          recordingTranscript: snapshot.recordingTranscript,
          isSaving: snapshot.isSaving,
          syncState: "ERROR",
          cursorPosition: snapshot.cursorPosition,
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
        });
        toast.error("Failed to delete row");
      });
  },
});
