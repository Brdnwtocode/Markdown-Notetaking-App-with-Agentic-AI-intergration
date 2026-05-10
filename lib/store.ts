import { create } from "zustand";
import toast from "react-hot-toast";

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StackColumn {
  id: string;
  stackId: string;
  name: string;
  type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN" | "DATE" | "SELECT" | "FORMULA" | "RELATION";
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
  columns: StackColumn[];
  rows: StackRow[];
  createdAt: string;
  updatedAt: string;
}

export type TabType = "NOTE" | "STACK";
export interface OpenTab {
  id: string;
  type: TabType;
  title: string;
}

export type SyncState = "SAVED" | "SAVING" | "ERROR";

export type PendingAction = {
  type: "add_stack_row";
  stackId: string;
  data: Record<string, any>;
} | {
  type: "update_note";
  noteId: string;
  updatedData: { content: string; title?: string; id: string };
} | null;

interface WorkspaceStore {
  // Tabs
  openTabs: OpenTab[];
  activeTabId: string | null;
  openTab: (id: string, type: TabType, title: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabTitle: (id: string, newTitle: string) => void;

  // Sync status
  syncState: SyncState;

  // Notes
  notes: Note[];
  noteCache: Record<string, Note>;
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  setNotes: (notes: Note[]) => void;
  upsertNoteCache: (note: Note) => void;

  optimisticCreateNote: (title: string) => {
    tempId: string;
    promise: Promise<{ tempId: string; realId: string }>;
  };
  optimisticPatchNote: (
    noteId: string,
    patch: Partial<Pick<Note, "title" | "content">>
  ) => void;
  optimisticDeleteNote: (noteId: string) => void;

  // Stacks
  stacks: Stack[];
  currentStackId: string | null;
  setCurrentStackId: (id: string | null) => void;
  addStack: (stack: Stack) => void;
  updateStack: (stack: Stack) => void;
  deleteStack: (id: string) => void;
  setStacks: (stacks: Stack[]) => void;

  optimisticRenameStack: (stackId: string, name: string) => void;
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

  // Voice state
  isRecording: boolean;
  recordingTranscript: string;
  setIsRecording: (recording: boolean) => void;
  setRecordingTranscript: (transcript: string) => void;

  // UI state
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  isVoiceMutating: boolean;
  setIsVoiceMutating: (is: boolean) => void;
  isRawMarkdownView: boolean;
  setIsRawMarkdownView: (isRaw: boolean) => void;
  toggleRawMarkdownView: () => void;

  // AI Conversational UI
  aiReply: string | null;
  setAiReply: (reply: string | null) => void;
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  commitPendingAction: () => void;
  clearPendingAction: () => void;
}

function tempId(prefix: string) {
  return `temp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Tabs
  openTabs: [],
  activeTabId: null,
  openTab: (id, type, title) => {
    set((state) => {
      const exists = state.openTabs.some((t) => t.id === id);
      const openTabs = exists
        ? state.openTabs.map((t) => (t.id === id ? { ...t, type, title } : t))
        : [...state.openTabs, { id, type, title }];

      return {
        openTabs,
        activeTabId: id,
        currentNoteId: type === "NOTE" ? id : null,
        currentStackId: type === "STACK" ? id : null,
      };
    });
  },
  closeTab: (id) => {
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.id === id);
      if (idx === -1) return state;

      const openTabs = state.openTabs.filter((t) => t.id !== id);
      const nextActiveId =
        state.activeTabId === id
          ? openTabs[Math.min(idx, openTabs.length - 1)]?.id ?? null
          : state.activeTabId;

      const nextActiveTab = nextActiveId
        ? openTabs.find((t) => t.id === nextActiveId)
        : undefined;

      return {
        openTabs,
        activeTabId: nextActiveId,
        currentNoteId: nextActiveTab?.type === "NOTE" ? nextActiveId : null,
        currentStackId: nextActiveTab?.type === "STACK" ? nextActiveId : null,
      };
    });
  },
  setActiveTab: (id) => {
    set((state) => {
      if (!id) {
        return {
          activeTabId: null,
          currentNoteId: null,
          currentStackId: null,
        };
      }

      const tab = state.openTabs.find((t) => t.id === id);
      if (!tab) return { activeTabId: id };

      return {
        activeTabId: id,
        currentNoteId: tab.type === "NOTE" ? id : null,
        currentStackId: tab.type === "STACK" ? id : null,
      };
    });
  },
  updateTabTitle: (id, newTitle) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, title: newTitle } : t
      ),
    }));
  },

  // Sync status
  syncState: "SAVED",

  // Notes
  notes: [],
  noteCache: {},
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),
  addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
  updateNote: (note) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    })),
  deleteNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
  setNotes: (notes) => set({ notes }),
  upsertNoteCache: (note) =>
    set((state) => ({
      noteCache: { ...state.noteCache, [note.id]: note },
    })),

  optimisticCreateNote: (title: string) => {
    const snapshot = get();
    const id = tempId("note");
    const now = new Date().toISOString();
    const optimistic: Note = {
      id,
      userId: "me",
      title,
      content: "",
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      notes: [optimistic, ...state.notes],
      noteCache: { ...state.noteCache, [id]: optimistic },
      currentNoteId: id,
      openTabs: state.openTabs.some((t) => t.id === id)
        ? state.openTabs
        : [...state.openTabs, { id, type: "NOTE", title }],
      activeTabId: id,
      currentStackId: null,
      syncState: "SAVING",
      isSaving: true,
    }));

    const promise = apiJson<Note>("/api/notes", {
      method: "POST",
      body: JSON.stringify({ title }),
    })
      .then((created) => {
        set((state) => {
          const replaceId = (val: string | null) =>
            val === id ? created.id : val;
          const notes = state.notes.map((n) =>
            n.id === id
              ? { ...created, content: state.noteCache[id]?.content ?? "" }
              : n
          );
          const { [id]: _tmp, ...restCache } = state.noteCache;
          return {
            notes,
            noteCache: {
              ...restCache,
              [created.id]: {
                ...created,
                content:
                  state.noteCache[id]?.content ?? (created.content ?? ""),
              },
            },
            currentNoteId: replaceId(state.currentNoteId),
            openTabs: state.openTabs.map((t) =>
              t.id === id ? { ...t, id: created.id, type: "NOTE", title: created.title } : t
            ),
            activeTabId: replaceId(state.activeTabId),
            syncState: "SAVED",
            isSaving: false,
          };
        });
        return { tempId: id, realId: created.id };
      })
      .catch((e) => {
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
          isVoiceMutating: snapshot.isVoiceMutating,
        });
        toast.error("Failed to create note");
        throw e;
      });

    return { tempId: id, promise };
  },

  optimisticPatchNote: (noteId, patch) => {
    const snapshot = get();

    set((state) => {
      const cached = state.noteCache[noteId];
      const nextCached = cached ? { ...cached, ...patch, updatedAt: new Date().toISOString() } : cached;
      return {
        noteCache: cached ? { ...state.noteCache, [noteId]: nextCached } : state.noteCache,
        notes: state.notes.map((n) => (n.id === noteId ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)),
        openTabs:
          patch.title !== undefined
            ? state.openTabs.map((t) =>
                t.id === noteId && t.type === "NOTE" ? { ...t, title: patch.title ?? t.title } : t
              )
            : state.openTabs,
        syncState: "SAVING",
        isSaving: true,
      };
    });

    void apiJson<Note>(`/api/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
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
          isVoiceMutating: snapshot.isVoiceMutating,
        });
        toast.error("Failed to save note");
      });
  },

  optimisticDeleteNote: (noteId) => {
    const snapshot = get();
    set((state) => {
      const { [noteId]: _, ...rest } = state.noteCache;
      return {
        notes: state.notes.filter((n) => n.id !== noteId),
        noteCache: rest,
        currentNoteId: state.currentNoteId === noteId ? null : state.currentNoteId,
        openTabs: state.openTabs.filter((t) => !(t.id === noteId && t.type === "NOTE")),
        activeTabId: state.activeTabId === noteId ? null : state.activeTabId,
        syncState: "SAVING",
        isSaving: true,
      };
    });

    void fetch(`/api/notes/${noteId}`, { method: "DELETE", credentials: "include" }).then((res) => {
      if (!res.ok) throw new Error();
      set({ syncState: "SAVED", isSaving: false });
    }).catch(() => {
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
        isVoiceMutating: snapshot.isVoiceMutating,
      });
      toast.error("Failed to delete note");
    });
  },

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
          isVoiceMutating: snapshot.isVoiceMutating,
        });
        toast.error("Failed to update stack name");
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
          isVoiceMutating: snapshot.isVoiceMutating,
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
          isVoiceMutating: snapshot.isVoiceMutating,
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
          isVoiceMutating: snapshot.isVoiceMutating,
        });
        toast.error("Failed to delete row");
      });
  },

  // Voice state
  isRecording: false,
  recordingTranscript: "",
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingTranscript: (transcript) =>
    set({ recordingTranscript: transcript }),

  // UI state
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),
  cursorPosition: 0,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  isVoiceMutating: false,
  setIsVoiceMutating: (is) => set({ isVoiceMutating: is }),
  isRawMarkdownView: false,
  setIsRawMarkdownView: (is) => set({ isRawMarkdownView: is }),
  toggleRawMarkdownView: () => set((state) => ({ isRawMarkdownView: !state.isRawMarkdownView })),

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
    }
    set({ pendingAction: null, aiReply: null });
  },
  clearPendingAction: () => set({ pendingAction: null }),
}));
