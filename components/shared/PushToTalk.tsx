// components/shared/PushToTalk.tsx
//
// Thin UI shell for Push-to-Talk voice commands.
//   - Keyboard binding: Ctrl+Space (press to talk, release Space to stop)
//   - STT via Deepgram (streaming) with fallback
//   - Delegates context packing → lib/voice/contextHelpers
//   - Delegates form building  → lib/voice/buildFormData
//   - Delegates response handling → lib/voice/handleResponseActions

"use client";

import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useDeepgramSTT, STTStatus } from "@/lib/hooks/useDeepgramSTT";
import { packContext } from "@/lib/voice/contextHelpers";
import { buildVoiceFormData, getFormDataContext } from "@/lib/voice/buildFormData";
import { handleResponseActions } from "@/lib/voice/handleResponseActions";
import { apiClient } from "@/lib/httpClient";
import { toast } from "@/lib/toast";

export default function PushToTalk() {
  const store = useWorkspaceStore();
  const {
    setIsRecording, recordingTranscript, setRecordingTranscript,
    setIsChatOpen,
    addChatMessage, updateChatMessage,
    noteCache, stacks,
    addVoiceMutatingId, removeVoiceMutatingId,
    setSttStatus,
  } = store;

  // Determine which entity is being mutated based on active context
  const getActiveEntityId = useCallback((): string | null => {
    return store.currentNoteId || store.currentStackId || store.currentFocusedTaskId || "workspace";
  }, [store]);

  // ─── Transcript → API pipeline ───────────────────────────────────────

  const handleTranscriptReady = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;

      const entityId = getActiveEntityId();
      if (entityId) addVoiceMutatingId(entityId);
      setRecordingTranscript(transcript);
      setIsChatOpen(true);

      toast.loading("Transcribing & analyzing…", { id: "voice-processing" });

      let aiMsgId: string | null = null;
      try {
        // 1. Pack context
        toast.loading("Packing context…", { id: "voice-processing" });
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
        toast.loading("AI is thinking…", { id: "voice-processing" });
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
        if (entityId) removeVoiceMutatingId(entityId);
      }
    },
    [getActiveEntityId, addVoiceMutatingId, removeVoiceMutatingId, setRecordingTranscript, setIsChatOpen,
     addChatMessage, updateChatMessage, noteCache, stacks, store]
  );

  // ─── STT hook ──────────────────────────────────────────────────────

  const { status, start, stop } = useDeepgramSTT({
    model: "nova-3",
    onInterimTranscript: (text) => {
      setRecordingTranscript(text);
      setSttStatus(status);
    },
    onTranscriptReady: (text) => {
      setSttStatus("finalizing");
      handleTranscriptReady(text);
    },
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
    setSttStatus("minting");
    await start(primary.type, primary.id, extras);
  }, [status, setIsRecording, setRecordingTranscript, start, store, setSttStatus]);

  const handleStop = useCallback(async () => {
    if (status === "idle") return;
    setIsRecording(false);
    await stop();
  }, [status, setIsRecording, stop]);

  // ─── Keyboard binding (Ctrl+Space) ─────────────────────────────────
  // FIXED: Only Space keyup triggers stop, not arbitrary Control release.
  // This prevents false stops during Ctrl+C/V/Z editing operations.

  const spaceHeldRef = useRef(false);
  const handleStartRef = useRef(handleStart);
  const handleStopRef = useRef(handleStop);
  handleStartRef.current = handleStart;
  handleStopRef.current = handleStop;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && !e.repeat) {
        e.preventDefault();
        spaceHeldRef.current = true;
        handleStartRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceHeldRef.current) {
        spaceHeldRef.current = false;
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

  const isIdle = status === "idle";

  // Clear floating transcript when STT returns to idle
  useEffect(() => {
    if (status === "idle" && recordingTranscript) {
      // Small delay so the user sees the final transcript briefly before it fades
      const timer = setTimeout(() => setRecordingTranscript(""), 800);
      return () => clearTimeout(timer);
    }
  }, [status, recordingTranscript, setRecordingTranscript]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 group flex flex-col items-center gap-3 z-50">
      {/* Transcript / Status bubble — only visible while actively recording/processing */}
      {isActive && (
        <div className="flex flex-col items-center gap-2.5 glass-card text-white text-xs font-medium px-4 py-3.5 shadow-2xl rounded-2xl pointer-events-none select-none transition-all duration-300 max-w-[320px] w-max border-white/10 glow-emerald-subtle">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-[#10B981]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-technical uppercase tracking-wider text-[10px]">
                {statusLabel[status]}
              </span>
            </div>
          ) : status === "streaming" ? (
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                </span>
                <span className="text-[#10B981] font-technical uppercase tracking-wider text-[10px]">
                  Listening…
                </span>
              </div>
              {/* Soundwave Jumping Bar Indicator */}
              <div className="flex items-end gap-1 h-8 px-2 py-0.5 border border-white/5 bg-black/30 rounded-lg">
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-1"></div>
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-2"></div>
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-3"></div>
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-4"></div>
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-2"></div>
                <div className="w-[3px] bg-[#10B981] rounded-full animate-soundwave-3"></div>
              </div>
            </div>
          ) : null}
          {recordingTranscript && (
            <p className="text-slate-300 text-sm leading-relaxed max-w-[280px] break-words text-center font-technical py-1">
              &ldquo;{recordingTranscript}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* PTT Button with Concentric Glowing Ripples */}
      <div className="relative">
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-full border border-[#10B981] animate-ripple opacity-60 pointer-events-none" />
            <div className="absolute inset-0 rounded-full border border-[#10B981]/50 animate-ripple opacity-40 pointer-events-none [animation-delay:0.7s]" />
          </>
        )}
        <Button
          onClick={isIdle ? handleStart : handleStop}
          variant={isActive ? "default" : "secondary"}
          size="icon"
          className={`h-14 w-14 rounded-full shadow-xl transition-all duration-300 relative z-10 ${
            isActive
              ? "bg-[#10B981] hover:bg-[#10B981]/90 text-[#0E0E0E] scale-110 glow-emerald-strong"
              : "bg-[#131313] border border-white/10 hover:border-[#10B981]/40 hover:bg-[#1c1c1c] text-zinc-400 hover:text-white"
          }`}
          title="Hold Ctrl+Space or click to talk"
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isActive ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Keyboard shortcut hint */}
      {isIdle && (
        <span className="text-[10px] text-zinc-600 font-technical uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
          Ctrl+Space
        </span>
      )}
    </div>
  );
}
