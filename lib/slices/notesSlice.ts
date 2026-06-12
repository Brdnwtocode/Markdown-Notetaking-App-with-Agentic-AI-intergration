import { StateCreator } from "zustand";
import toast from "react-hot-toast";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotesSlice {
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

  optimisticCreateNote: (
    title: string,
    folderId?: string | null
  ) => {
    tempId: string;
    promise: Promise<{ tempId: string; realId: string }>;
  };
  optimisticPatchNote: (
    noteId: string,
    patch: Partial<Pick<Note, "title" | "content" | "folderId">>
  ) => void;
  optimisticDeleteNote: (noteId: string) => void;
}

function tempId(prefix: string) {
  return `temp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const createNotesSlice: StateCreator<RootStore, [], [], NotesSlice> = (set, get) => ({
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

  optimisticCreateNote: (title: string, folderId: string | null = null) => {
    const snapshot = get();
    const id = tempId("note");
    const now = new Date().toISOString();
    const optimistic: Note = {
      id,
      userId: "me",
      title,
      content: "",
      folderId,
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
      body: JSON.stringify({ title, folderId }),
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
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
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
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
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
          voiceMutatingIds: new Set(snapshot.voiceMutatingIds),
      });
      toast.error("Failed to delete note");
    });
  },
});
