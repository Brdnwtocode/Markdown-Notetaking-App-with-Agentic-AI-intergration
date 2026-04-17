import { create } from "zustand";

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
  type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN";
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

interface WorkspaceStore {
  // Notes
  notes: Note[];
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  setNotes: (notes: Note[]) => void;

  // Stacks
  stacks: Stack[];
  currentStackId: string | null;
  setCurrentStackId: (id: string | null) => void;
  addStack: (stack: Stack) => void;
  updateStack: (stack: Stack) => void;
  deleteStack: (id: string) => void;
  setStacks: (stacks: Stack[]) => void;

  // Voice state
  isRecording: boolean;
  recordingTranscript: string;
  setIsRecording: (recording: boolean) => void;
  setRecordingTranscript: (transcript: string) => void;

  // UI state
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  // Notes
  notes: [],
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

  // Voice state
  isRecording: false,
  recordingTranscript: "",
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingTranscript: (transcript) =>
    set({ recordingTranscript: transcript }),

  // UI state
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),
}));
