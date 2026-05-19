import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export interface VoiceSlice {
  // Voice state
  isRecording: boolean;
  recordingTranscript: string;
  setIsRecording: (recording: boolean) => void;
  setRecordingTranscript: (transcript: string) => void;
}

export const createVoiceSlice: StateCreator<RootStore, [], [], VoiceSlice> = (set) => ({
  // Voice state
  isRecording: false,
  recordingTranscript: "",
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingTranscript: (transcript) =>
    set({ recordingTranscript: transcript }),
});
