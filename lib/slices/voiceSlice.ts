// lib/slices/voiceSlice.ts
//
// Adds `sttStatus` to Zustand so components beyond PushToTalk can observe
// the streaming state (e.g., a status bar, a transcript display panel).
//
// All existing fields (isRecording, recordingTranscript) are preserved
// for backward compatibility with the existing notesSlice / stacksSlice
// snapshot logic that explicitly includes them.

import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import type { STTStatus } from "@/lib/hooks/useDeepgramSTT";

export interface VoiceSlice {
  // Existing — preserved unchanged
  isRecording: boolean;
  recordingTranscript: string;
  setIsRecording: (recording: boolean) => void;
  setRecordingTranscript: (transcript: string) => void;

  // New — granular STT state for components that want more than a boolean
  sttStatus: STTStatus;
  setSttStatus: (status: STTStatus) => void;
}

export const createVoiceSlice: StateCreator<RootStore, [], [], VoiceSlice> = (set) => ({
  isRecording: false,
  recordingTranscript: "",
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingTranscript: (transcript) => set({ recordingTranscript: transcript }),

  sttStatus: "idle",
  setSttStatus: (status) => set({ sttStatus: status }),
});
