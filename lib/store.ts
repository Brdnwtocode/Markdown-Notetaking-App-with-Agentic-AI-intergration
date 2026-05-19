import { create } from "zustand";
import { createNotesSlice, NotesSlice } from "@/lib/slices/notesSlice";
import { createStacksSlice, StacksSlice } from "@/lib/slices/stacksSlice";
import { createVoiceSlice, VoiceSlice } from "@/lib/slices/voiceSlice";
import { createUiSlice, UiSlice } from "@/lib/slices/uiSlice";
import { createAiSlice, AiSlice } from "@/lib/slices/aiSlice";
import { createTasksSlice, TasksSlice } from "@/lib/slices/tasksSlice";
import { createCalendarSlice, CalendarSlice } from "@/lib/slices/calendarSlice";

export type RootStore =
  & NotesSlice
  & StacksSlice
  & VoiceSlice
  & UiSlice
  & AiSlice
  & TasksSlice
  & CalendarSlice;

export const useWorkspaceStore = create<RootStore>()((...a) => ({
  ...createNotesSlice(...a),
  ...createStacksSlice(...a),
  ...createVoiceSlice(...a),
  ...createUiSlice(...a),
  ...createAiSlice(...a),
  ...createTasksSlice(...a),
  ...createCalendarSlice(...a),
}));

// Re-export all types exactly as before
export type { Note } from "@/lib/slices/notesSlice";
export type { Stack, StackColumn, StackRow } from "@/lib/slices/stacksSlice";
export type { OpenTab, TabType, SyncState } from "@/lib/slices/uiSlice";
export type { PendingAction } from "@/lib/slices/aiSlice";
export type { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";
export type { CalendarEvent } from "@/lib/slices/calendarSlice";
