import axios from "axios";

export const processVoiceCommand = async (
  audioBlob: Blob,
  contextType: string,
  contextId: string,
  cursorPosition: number,
  noteState: string | null,
  dynamicSchema: string | null
) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("contextType", contextType);
  formData.append("contextId", contextId);
  formData.append("cursorPosition", cursorPosition.toString());

  // Contract alignment: Send note_state if a note is currently open/cached, regardless of contextType.
  if (noteState) {
    formData.append("note_state", noteState);
  }
  
  if (dynamicSchema && contextType === "STACK") {
    formData.append("dynamic_schema", dynamicSchema);
  }

  const res = await axios.post("/api/voice/process", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};
