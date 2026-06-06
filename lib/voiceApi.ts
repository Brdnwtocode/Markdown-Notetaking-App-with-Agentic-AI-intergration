import axios from "axios";
import type { VoiceProcessRequest, VoiceResponse } from "@/types/voice";

export const processVoiceCommand = async (
  audioBlob: Blob,
  contextType: string,
  contextId: string,
  cursorPosition: number,
  noteState: string | null,
  dynamicSchema: string | null
): Promise<VoiceResponse> => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  
  // Use snake_case for FastAPI contract alignment
  formData.append("context_type", contextType);
  formData.append("context_id", contextId);
  formData.append("cursor_position", cursorPosition.toString());

  // Contract alignment: Send typed request fields to FastAPI
  // note_state: current note content when a note is open
  if (noteState) {
    formData.append("note_state", noteState);
  }
  
  // dynamic_schema: stack column schema when a stack is open
  if (dynamicSchema && contextType === "STACK") {
    formData.append("dynamic_schema", dynamicSchema);
  }

  const res = await axios.post<VoiceResponse>("/api/voice/process", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};
