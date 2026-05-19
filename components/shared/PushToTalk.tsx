"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import axios from "axios";
import toast from "react-hot-toast";

export default function PushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const {
    setIsRecording: setStoreRecording,
    setRecordingTranscript,
    currentNoteId,
    currentStackId,
    cursorPosition,
    setIsVoiceMutating,
    stacks,
    noteCache,
    setPendingAction,
    setAiReply,
    openTabs,
    activeTabId,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
    currentUserId,
  } = useWorkspaceStore();
  void currentUserId;

  // Handle keyboard Ctrl + Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && !isRecording && !isProcessing) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "Control") && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, isProcessing]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setStoreRecording(true);
      setRecordingTranscript("");
    } catch (error) {
      toast.error("Failed to access microphone");
      console.error(error);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setStoreRecording(false);
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        // Process audio
        await processAudio();
        resolve();
      };

      mediaRecorder.stop();
    });
  };

  const processAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      toast.error("No audio recorded");
      return;
    }

    setIsProcessing(true);
    setIsVoiceMutating(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      let contextType: string | null = null;
      let contextId: string | null = null;

      if (currentNoteId) {
        contextType = "NOTE";
        contextId = currentNoteId;
      } else if (currentStackId) {
        contextType = "STACK";
        contextId = currentStackId;
      } else {
        const activeTab = openTabs.find((t) => t.id === activeTabId);
        if (activeTab?.type === "TASKS") {
          contextType = "TASK";
          contextId = currentFocusedTaskId ?? "none";
        } else if (activeTab?.type === "CALENDAR") {
          contextType = "CALENDAR";
          contextId = "none";
        }
      }

      if (!contextType) {
        toast.error(
          "Please select a note, stack, tasks, or calendar first"
        );
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");
      formData.append("contextType", contextType);
      formData.append("contextId", contextId as string);
      formData.append("cursorPosition", cursorPosition.toString());

      // Add STT/LLM Context payload
      if (contextType === "NOTE" && currentNoteId) {
        const noteState = noteCache[currentNoteId]?.content || "";
        formData.append("note_state", noteState);
      } else if (contextType === "STACK" && currentStackId) {
        const activeStack = stacks.find((s) => s.id === currentStackId);
        if (activeStack) {
          formData.append("dynamic_schema", JSON.stringify(activeStack.columns));
        }
      }

      if (contextType === "TASK" && currentFocusedTaskId) {
        const allTasks = [
          ...tasks,
          ...Object.values(taskChildrenMap).flat(),
        ];
        const parentTask = allTasks.find(
          (t) => t.id === currentFocusedTaskId
        );
        if (parentTask) {
          formData.append(
            "task_context",
            JSON.stringify({
              focusedTaskId: parentTask.id,
              focusedTaskTitle: parentTask.title,
            })
          );
        }
      }

      // Send to voice API
      const res = await axios.post("/api/voice/process", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { action, updatedData, transcript, aiReply } = res.data;

      // Instead of mutating the store, set the pending action for the confirmation gate
      if (action === "update_note" && updatedData && currentNoteId) {
        setPendingAction({
          type: "update_note",
          noteId: currentNoteId,
          updatedData,
        });
      } else if (action === "add_stack_row" && updatedData && currentStackId) {
        setPendingAction({
          type: "add_stack_row",
          stackId: currentStackId,
          data: updatedData,
        });
      } else if (action === "create_task" && updatedData) {
        setPendingAction({ type: "create_task", data: updatedData });
      } else if (
        action === "create_calendar_event" &&
        updatedData
      ) {
        setPendingAction({
          type: "create_calendar_event",
          data: updatedData,
        });
      }

      if (aiReply) {
        setAiReply(aiReply);
      }

      setRecordingTranscript(transcript);
      toast.success("Voice command processed!");
    } catch (error: unknown) {
      console.error(error);
      const message =
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "error" in error.response.data &&
        typeof (error.response.data as { error: unknown }).error === "string"
          ? (error.response.data as { error: string }).error
          : "Failed to process voice command";
      toast.error(message);
    } finally {
      setIsProcessing(false);
      setIsVoiceMutating(false);
      audioChunksRef.current = [];
    }
  };

  return (
    <div className="fixed bottom-6 right-6 group">
      <Button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isProcessing}
        size="icon"
        className={`h-14 w-14 rounded-md shadow-lg transition-all ${
          isRecording || isProcessing
            ? "bg-red-500 hover:bg-red-600 scale-110"
            : "bg-primary hover:bg-primary/90"
        }`}
        title="Hold Ctrl + Space or click to record"
      >
        <Mic
          className={`h-6 w-6 text-white ${
            isRecording || isProcessing ? "animate-pulse" : ""
          }`}
        />
      </Button>
      {(isRecording || isProcessing) && (
        <div className="absolute inset-0 rounded-md bg-red-500/20 animate-ping" />
      )}
      {isProcessing && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-steel mt-2">
          Processing...
        </div>
      )}
    </div>
  );
}
