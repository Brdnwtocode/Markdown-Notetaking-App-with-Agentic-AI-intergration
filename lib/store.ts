import { create } from "zustand";
import { createNotesSlice, NotesSlice } from "@/lib/slices/notesSlice";
import { createStacksSlice, StacksSlice } from "@/lib/slices/stacksSlice";
import { createFoldersSlice, FoldersSlice } from "@/lib/slices/foldersSlice";
import { createVoiceSlice, VoiceSlice } from "@/lib/slices/voiceSlice";
import { createUiSlice, UiSlice } from "@/lib/slices/uiSlice";
import { createAiSlice, AiSlice } from "@/lib/slices/aiSlice";
import { createTasksSlice, TasksSlice } from "@/lib/slices/tasksSlice";
import { createCalendarSlice, CalendarSlice } from "@/lib/slices/calendarSlice";
import { createPendingMutationSlice, PendingMutationSlice } from "@/lib/slices/pendingMutationSlice";
import { createRecordsSlice, RecordsSlice } from "@/lib/slices/recordsSlice";

export type RootStore =
  & NotesSlice
  & StacksSlice
  & FoldersSlice
  & VoiceSlice
  & UiSlice
  & AiSlice
  & TasksSlice
  & CalendarSlice
  & PendingMutationSlice
  & RecordsSlice;

export const useWorkspaceStore = create<RootStore>()((...a) => ({
  ...createNotesSlice(...a),
  ...createStacksSlice(...a),
  ...createFoldersSlice(...a),
  ...createVoiceSlice(...a),
  ...createUiSlice(...a),
  ...createAiSlice(...a),
  ...createTasksSlice(...a),
  ...createCalendarSlice(...a),
  ...createPendingMutationSlice(...a),
  ...createRecordsSlice(...a),
}));

// Re-export all types exactly as before
export type { Note } from "@/lib/slices/notesSlice";
export type { Stack, StackColumn, StackRow } from "@/lib/slices/stacksSlice";
export type { Folder } from "@/lib/slices/foldersSlice";
export type { OpenTab, TabType, SyncState } from "@/lib/slices/uiSlice";
export type { ChatMessage, MessageStatus, MessageContext } from "@/lib/slices/aiSlice";
export type { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";
export type { CalendarEvent } from "@/lib/slices/calendarSlice";
export type { MutationStatus, PendingMutationSlice, PendingMutation } from "@/lib/slices/pendingMutationSlice";
export type { Recording, RecordStatus, RecordsSlice, LocalRecording } from "@/lib/slices/recordsSlice";
