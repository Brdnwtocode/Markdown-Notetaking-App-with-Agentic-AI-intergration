// lib/slices/recordsSlice.ts
//
// Zustand slice for the Records feature — audio workstation state,
// recording lifecycle, transcript streaming, and Agentic Automate results.

import { StateCreator } from "zustand";
import { toast } from "@/lib/toast";
import { RootStore } from "@/lib/store";
import axios from "axios";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecordStatus = "RECORDING" | "TRANSCRIBING" | "RESOLVING" | "COMMITTED";

export interface Recording {
  id: string;
  userId: string;
  title: string;
  durationSec: number;
  transcript: string;
  status: RecordStatus;
  audioKey: string | null;
  audioSizeBytes: number | null;
  errorLog: string | null;
  folderId: string | null;
  noteMutation: any | null;
  taskMutations: any[] | null;
  stackMutation: any | null;
  calendarMutation: any | null;
  speakerLabels: any | null;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
  attachments: Attachment[];
}

/** A recording that exists only in local state — not yet persisted to DB/S3. */
export interface LocalRecording {
  id: string;               // temp client-side UUID
  title: string;
  durationSec: number;
  transcript: string;
  createdAt: string;        // local timestamp
  source: "recorded" | "imported";  // how it was created
  fileName?: string;        // original filename (for imports)
  fileSizeBytes?: number;   // original file size (for imports)
  mimeType?: string;        // e.g. "audio/webm"
}

export interface Attachment {
  id: string;
  recordingId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  sizeBytes: number;
  createdAt: string;
}

// Agentic Automate request/response types
export interface AutomateRequest {
  transcript: string;
  recordingId: string;
  workspaceContext?: {
    activeNoteId?: string | null;
    activeStackId?: string | null;
    activeTaskIds?: string[];
    recentNotes?: { id: string; title: string }[];
    recentStacks?: { id: string; name: string }[];
  };
}

export interface NoteMutationResult {
  title: string;
  content: string;
  folderId?: string | null;
}

export interface TaskMutationResult {
  title: string;
  description?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  assignee?: string | null;
  dueDate?: string | null;
}

export interface StackMutationResult {
  stackId?: string;
  stackName?: string;
  columns?: { name: string; type: string }[];
  rows?: Record<string, any>[];
}

export interface CalendarMutationResult {
  title: string;
  notes?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
}

export interface AutomateResponse {
  transcript?: string;
  noteMutation?: NoteMutationResult | null;
  taskMutations?: TaskMutationResult[];
  stackMutation?: StackMutationResult | null;
  calendarMutation?: CalendarMutationResult | null;
  speakerLabels?: { speaker: string; segments: { start: number; end: number; text: string }[] }[] | null;
  summary?: string;
}

// ─── Slice ──────────────────────────────────────────────────────────────────

export interface RecordsSlice {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  sttEnabled: boolean;           // toggle real-time transcription on/off
  recordingId: string | null;
  recordingTitle: string;
  recordingDurationSec: number;
  liveTranscript: string;

  // Playback state
  isPlaying: boolean;
  playbackSpeed: number; // 1, 1.5, 2
  playbackVolume: number; // 0-1
  currentPlaybackTime: number;

  // List state
  recordings: Recording[];
  recordingsLoading: boolean;
  activeRecordingId: string | null;

  // Local (unsaved) recordings
  localRecordings: LocalRecording[];
  addLocalRecording: (rec: LocalRecording) => void;
  removeLocalRecording: (id: string) => void;
  clearLocalRecordings: () => void;

  // Agentic Automate state
  automateLoading: boolean;
  automateResult: AutomateResponse | null;

  // Actions — Recording lifecycle
  setIsRecording: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setSttEnabled: (v: boolean) => void;
  setRecordingId: (id: string | null) => void;
  setRecordingTitle: (title: string) => void;
  setRecordingDurationSec: (sec: number) => void;
  appendLiveTranscript: (chunk: string) => void;
  setLiveTranscript: (t: string) => void;
  resetRecordingState: () => void;

  // Actions — Playback
  setIsPlaying: (v: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaybackVolume: (vol: number) => void;
  setCurrentPlaybackTime: (t: number) => void;

  // Actions — CRUD
  setRecordings: (list: Recording[]) => void;
  setRecordingsLoading: (v: boolean) => void;
  setActiveRecordingId: (id: string | null) => void;
  upsertRecording: (rec: Recording) => void;
  deleteRecording: (id: string) => void;
  updateRecordingStatus: (id: string, status: RecordStatus) => void;
  updateRecordingTranscript: (id: string, transcript: string) => void;
  updateRecordingDuration: (id: string, sec: number) => void;
  moveRecording: (recordingId: string, folderId: string | null) => Promise<void>;

  // Actions — Agentic Automate
  setAutomateLoading: (v: boolean) => void;
  setAutomateResult: (result: AutomateResponse | null) => void;
}

export const createRecordsSlice: StateCreator<RootStore, [], [], RecordsSlice> = (set, get) => ({
  // Recording state
  isRecording: false,
  isPaused: false,
  sttEnabled: true,
  recordingId: null,
  recordingTitle: "Untitled Recording",
  recordingDurationSec: 0,
  liveTranscript: "",

  // Playback state
  isPlaying: false,
  playbackSpeed: 1,
  playbackVolume: 0.8,
  currentPlaybackTime: 0,

  // List state
  recordings: [],
  recordingsLoading: false,
  activeRecordingId: null,
  localRecordings: [],

  // Agentic Automate state
  automateLoading: false,
  automateResult: null,

  // ─── Recording lifecycle ──────────────────────────────────────────────
  setIsRecording: (v) => set({ isRecording: v }),
  setIsPaused: (v) => set({ isPaused: v }),
  setSttEnabled: (v) => set({ sttEnabled: v }),
  setRecordingId: (id) => set({ recordingId: id }),
  setRecordingTitle: (title) => set({ recordingTitle: title }),
  setRecordingDurationSec: (sec) => set({ recordingDurationSec: sec }),
  appendLiveTranscript: (chunk) =>
    set((s) => ({ liveTranscript: s.liveTranscript + chunk })),
  setLiveTranscript: (t) => set({ liveTranscript: t }),
  resetRecordingState: () =>
    set((s) => ({
      isRecording: false,
      isPaused: false,
      // Preserve the user's STT preference across sessions — don't force it back to true
      recordingId: null,
      recordingTitle: "Untitled Recording",
      recordingDurationSec: 0,
      liveTranscript: "",
      isPlaying: false,
      playbackSpeed: 1,
      currentPlaybackTime: 0,
    })),

  // ─── Playback ─────────────────────────────────────────────────────────
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setPlaybackVolume: (vol) => set({ playbackVolume: vol }),
  setCurrentPlaybackTime: (t) => set({ currentPlaybackTime: t }),

  // ─── CRUD ─────────────────────────────────────────────────────────────
  setRecordings: (list) => set({ recordings: list }),
  setRecordingsLoading: (v) => set({ recordingsLoading: v }),
  setActiveRecordingId: (id) => set({ activeRecordingId: id }),
  upsertRecording: (rec) =>
    set((s) => {
      const idx = s.recordings.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        const next = [...s.recordings];
        next[idx] = rec;
        return { recordings: next };
      }
      return { recordings: [rec, ...s.recordings] };
    }),
  deleteRecording: (id) =>
    set((s) => ({
      recordings: s.recordings.filter((r) => r.id !== id),
      activeRecordingId: s.activeRecordingId === id ? null : s.activeRecordingId,
    })),
  updateRecordingStatus: (id, status) =>
    set((s) => ({
      recordings: s.recordings.map((r) =>
        r.id === id ? { ...r, status } : r,
      ),
    })),
  updateRecordingTranscript: (id, transcript) =>
    set((s) => ({
      recordings: s.recordings.map((r) =>
        r.id === id ? { ...r, transcript } : r,
      ),
    })),
  updateRecordingDuration: (id, sec) =>
    set((s) => ({
      recordings: s.recordings.map((r) =>
        r.id === id ? { ...r, durationSec: sec } : r,
      ),
    })),

  moveRecording: async (recordingId, folderId) => {
    const prev = get().recordings;
    // Optimistic update
    set({
      recordings: prev.map((r) =>
        r.id === recordingId ? { ...r, folderId } : r
      ),
    });
    try {
      await axios.patch(`/api/records/${recordingId}`, { folderId });
    } catch {
      set({ recordings: prev });
      toast.error("Failed to move recording");
    }
  },

  // ─── Agentic Automate ─────────────────────────────────────────────────
  setAutomateLoading: (v) => set({ automateLoading: v }),
  setAutomateResult: (result) => set({ automateResult: result }),

  // ─── Local (unsaved) recordings ─────────────────────────────────────────
  addLocalRecording: (rec) =>
    set((s) => ({
      localRecordings: [rec, ...s.localRecordings],
      activeRecordingId: rec.id,
    })),
  removeLocalRecording: (id) =>
    set((s) => ({
      localRecordings: s.localRecordings.filter((r) => r.id !== id),
      activeRecordingId: s.activeRecordingId === id ? null : s.activeRecordingId,
    })),
  clearLocalRecordings: () => set({ localRecordings: [] }),
});
