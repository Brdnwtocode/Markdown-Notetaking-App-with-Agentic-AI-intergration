// components/shared/PushToTalk.tsx
//
// Thin UI shell for Push-to-Talk voice commands.
//   - Keyboard binding: Ctrl+Space (press to talk, release to stop)
//   - STT via Deepgram (streaming)
//   - Delegates context packing → lib/voice/contextHelpers
//   - Delegates form building  → lib/voice/buildFormData
//   - Delegates response handling → lib/voice/handleResponseActions

"use client";

import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useDeepgramSTT, STTStatus } from "@/lib/hooks/useDeepgramSTT";
import { packContext } from "@/lib/voice/contextHelpers";
import { buildVoiceFormData, getFormDataContext } from "@/lib/voice/buildFormData";
import { handleResponseActions } from "@/lib/voice/handleResponseActions";
import { apiClient } from "@/lib/httpClient";
import toast from "react-hot-toast";

export default function PushToTalk() {
  const store = useWorkspaceStore();
  const {
    setIsRecording, recordingTranscript, setRecordingTranscript,
    setIsVoiceMutating, setIsChatOpen,
    addChatMessage, updateChatMessage,
    noteCache, stacks,
    setAiReply,
  } = store;

  // ─── Transcript → API pipeline ───────────────────────────────────────

  const handleTranscriptReady = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;

      setIsVoiceMutating(true);
      setRecordingTranscript(transcript);
      setIsChatOpen(true);

      toast.loading("Processing voice command...", { id: "voice-processing" });

      let aiMsgId: string | null = null;
      try {
        // 1. Pack context
        const packedContext = await packContext(transcript);

        // 2. Add user chat message
        addChatMessage({
          type: "user",
          content: transcript,
          context: {
            items: packedContext.items.map((item: any) => ({
              type: item.type, id: item.id,
              title: item.title, source: item.source,
            })),
            packedAt: packedContext.packedAt,
            totalItems: packedContext.totalItems,
          },
          status: "completed",
        });

        // 3. Add AI placeholder message
        aiMsgId = addChatMessage({
          type: "ai", content: "", status: "processing",
        });

        // 4. Build & send FormData
        const form = buildVoiceFormData(transcript, packedContext, getFormDataContext());

        const res = await apiClient.post("/api/voice/process", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // 5. Handle response actions
        const replyContent = handleResponseActions(res.data, {
          currentNoteId: store.currentNoteId,
          currentStackId: store.currentStackId,
          currentFocusedTaskId: store.currentFocusedTaskId,
          noteCache,
          stacks,
          tasks: store.tasks,
          taskChildrenMap: store.taskChildrenMap,
          originalContent: "",
        });

        updateChatMessage(aiMsgId, { content: replyContent, status: "completed" });
        if (res.data.aiReply) setAiReply(res.data.aiReply);

        toast.dismiss("voice-processing");
      } catch (err: unknown) {
        console.error("[PushToTalk] Pipeline failed:", err);
        toast.dismiss("voice-processing");

        let msg = "Failed to process voice command. Please try again.";
        if (err && typeof err === "object" && "isAxiosError" in err) {
          const apiError = (err as any).response?.data?.error;
          if (apiError === "Command not recognized as a workspace action.") {
            msg = "Command not recognized as a workspace action. Please clarify your request and try again.";
          } else if (typeof apiError === "string" && apiError.trim() !== "") {
            msg = apiError;
          }
        }

        if (aiMsgId) updateChatMessage(aiMsgId, { content: msg, status: "error" });
        toast.error(msg);
      } finally {
        setIsVoiceMutating(false);
      }
    },
    // Stable store refs — Zustand selectors are stable
    [setIsVoiceMutating, setRecordingTranscript, setIsChatOpen,
     addChatMessage, updateChatMessage, setAiReply, noteCache, stacks,
     store]
  );

  // ─── STT hook ──────────────────────────────────────────────────────

  const { status, start, stop } = useDeepgramSTT({
    language: "vi",
    model: "nova-3",
    onInterimTranscript: (text) => setRecordingTranscript(text),
    onTranscriptReady: handleTranscriptReady,
  });

  // ─── Start / Stop handlers ─────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (status !== "idle") return;

    // Gather context for the fallback (raw-audio) path
    const packed = await packContext();
    const primary = packed.items[0];

    const extras = new FormData();
    extras.append("contextType", primary.type);
    extras.append("contextId", primary.id);
    if (primary.type === "NOTE") {
      extras.append("cursorPosition", store.cursorPosition.toString());
    }

    setIsRecording(true);
    setRecordingTranscript("");
    await start(primary.type, primary.id, extras);
  }, [status, setIsRecording, setRecordingTranscript, start, store]);

  const handleStop = useCallback(async () => {
    if (status === "idle") return;
    setIsRecording(false);
    await stop();
  }, [status, setIsRecording, stop]);

  // ─── Keyboard binding (Ctrl+Space) ─────────────────────────────────

  const handleStartRef = useRef(handleStart);
  const handleStopRef = useRef(handleStop);
  handleStartRef.current = handleStart;
  handleStopRef.current = handleStop;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && !e.repeat) {
        e.preventDefault();
        handleStartRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Control") {
        handleStopRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ─── Derived UI state ──────────────────────────────────────────────

  const isActive = status !== "idle";
  const isProcessing =
    status === "minting" || status === "connecting" ||
    status === "finalizing" || status === "fallback";

  const statusLabel: Record<STTStatus, string> = {
    idle: "", minting: "Connecting…", connecting: "Connecting…",
    streaming: "Listening…", finalizing: "Processing…",
    fallback: "Processing (batch)…",
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 group flex flex-col items-center gap-3">
      {(isActive || recordingTranscript) && (
        <div className="flex flex-col items-center gap-2 bg-charcoal/90 text-on-dark text-xs font-medium px-4 py-2 rounded-2xl shadow-2xl pointer-events-none select-none transition-all duration-300 max-w-[300px] w-max">
          {isActive && statusLabel[status] && (
            <span className="text-purple-400 animate-pulse">{statusLabel[status]}</span>
          )}
          {recordingTranscript && (
            <span className="text-slate-300 break-words text-center line-clamp-3">
              {recordingTranscript}
            </span>
          )}
          {isProcessing && (
            <span className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <span className="block h-full bg-purple-500 animate-progress" />
            </span>
          )}
        </div>
      )}

      <Button
        onMouseDown={handleStart}
        onMouseUp={handleStop}
        onMouseLeave={isActive ? handleStop : undefined}
        onTouchStart={handleStart}
        onTouchEnd={handleStop}
        disabled={isProcessing}
        size="lg"
        className={`rounded-full w-16 h-16 p-0 transition-all duration-300 shadow-2xl ${
          isActive
            ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40"
            : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/40 hover:scale-105"
        }`}
        aria-label={isActive ? "Stop recording" : "Start recording"}
      >
        <Mic className={`h-6 w-6 transition-colors ${isActive ? "text-white" : "text-purple-100"}`} />
      </Button>
    </div>
  );
}
