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
  } = useWorkspaceStore();

  // Handle keyboard spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isRecording && !isProcessing) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isRecording) {
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

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      // Determine context
      const contextType = currentNoteId
        ? "NOTE"
        : currentStackId
          ? "STACK"
          : null;
      const contextId = currentNoteId || currentStackId;

      if (!contextType || !contextId) {
        toast.error("Please select a note or stack first");
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");
      formData.append("contextType", contextType);
      formData.append("contextId", contextId);

      // Send to voice API
      const res = await axios.post("/api/voice/process", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setRecordingTranscript(res.data.transcript);
      toast.success("Voice command processed!");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to process voice command"
      );
    } finally {
      setIsProcessing(false);
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
        className={`h-14 w-14 rounded-full shadow-lg transition-all ${
          isRecording || isProcessing
            ? "bg-red-500 hover:bg-red-600 scale-110"
            : "bg-primary hover:bg-primary/90"
        }`}
        title="Hold spacebar or click to record"
      >
        <Mic
          className={`h-6 w-6 ${
            isRecording || isProcessing ? "animate-pulse" : ""
          }`}
        />
      </Button>
      {(isRecording || isProcessing) && (
        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
      )}
      {isProcessing && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground mt-2">
          Processing...
        </div>
      )}
    </div>
  );
}
