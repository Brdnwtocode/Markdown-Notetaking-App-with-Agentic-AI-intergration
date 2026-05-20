// components/shared/PushToTalk.tsx
//
// Thin UI shell for Push-to-Talk. All audio logic lives in useDeepgramSTT.
// This component is responsible only for:
//   - Gathering workspace context (which note/stack/task is active)
//   - Rendering the button and interim transcript pill
//   - Keyboard binding (Ctrl+Space), fixed to not re-register on every render
//   - Dispatching the final transcript → LLM action pipeline (unchanged from before)

"use client";

import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useDeepgramSTT, STTStatus } from "@/lib/hooks/useDeepgramSTT";
import axios from "axios";
import toast from "react-hot-toast";

export default function PushToTalk() {
  const {
    setIsRecording,
    recordingTranscript,
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
  } = useWorkspaceStore();

  // ─── Transcript ready → LLM action pipeline ────────────────────────────────
  //
  // The streaming path delivers a plain-text transcript. We still post it to
  // /api/voice/process so FastAPI can run intent parsing — but we pass it as
  // the `transcript` text field, skipping FastAPI's internal STT step.
  //
  // The fallback path posts raw audio to /api/voice/process exactly as before.
  // FastAPI will perform STT internally in that case.

  const handleTranscriptReady = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;

      setIsVoiceMutating(true);
      setRecordingTranscript(transcript);

      try {
        // Build context — same logic as the old processAudio()
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
          // Context check already happened in handleStart; this is a safety guard
          return;
        }

        // Post transcript as text to FastAPI — FastAPI skips STT when transcript is provided
        const form = new FormData();
        form.append("transcript", transcript);          // new: text input
        form.append("contextType", contextType);
        form.append("contextId", contextId as string);
        form.append("cursorPosition", cursorPosition.toString());

        if (contextType === "NOTE" && currentNoteId) {
          form.append("note_state", noteCache[currentNoteId]?.content ?? "");
        } else if (contextType === "STACK" && currentStackId) {
          const stack = stacks.find((s) => s.id === currentStackId);
          if (stack) form.append("dynamic_schema", JSON.stringify(stack.columns));
        } else if (contextType === "TASK" && currentFocusedTaskId) {
          const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
          const focused = allTasks.find((t) => t.id === currentFocusedTaskId);
          if (focused) {
            form.append("task_context", JSON.stringify({
              focusedTaskId: focused.id,
              focusedTaskTitle: focused.title,
            }));
          }
        }

        const res = await axios.post("/api/voice/process", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const { action, updatedData, aiReply } = res.data;

        if (action === "update_note" && updatedData && currentNoteId) {
          setPendingAction({ type: "update_note", noteId: currentNoteId, updatedData });
        } else if (action === "add_stack_row" && updatedData && currentStackId) {
          setPendingAction({ type: "add_stack_row", stackId: currentStackId, data: updatedData });
        } else if (action === "create_task" && updatedData) {
          setPendingAction({ type: "create_task", data: updatedData });
        } else if (action === "create_calendar_event" && updatedData) {
          setPendingAction({ type: "create_calendar_event", data: updatedData });
        }

        if (aiReply) setAiReply(aiReply);
        toast.success("Voice command processed!");
      } catch (err: unknown) {
        console.error("[PushToTalk] Action pipeline failed:", err);
        const message =
          axios.isAxiosError(err) &&
          typeof err.response?.data?.error === "string"
            ? err.response.data.error
            : "Failed to process voice command";
        toast.error(message);
      } finally {
        setIsVoiceMutating(false);
      }
    },
    // Stable deps — all store primitives are stable references
    [
      currentNoteId, currentStackId, cursorPosition, openTabs, activeTabId,
      currentFocusedTaskId, tasks, taskChildrenMap, noteCache, stacks,
      setIsVoiceMutating, setRecordingTranscript, setPendingAction, setAiReply,
    ]
  );

  // ─── STT hook ─────────────────────────────────────────────────────────────

  const { status, start, stop } = useDeepgramSTT({
    language: "vi",
    model: "nova-3",
    onInterimTranscript: (text) => setRecordingTranscript(text),
    onTranscriptReady: handleTranscriptReady,
  });

  // ─── Context gathering ─────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (status !== "idle") return;

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
      toast.error("Select a note, stack, tasks, or calendar first");
      return;
    }

    // Build extras FormData — carries optional context payload for fallback path
    const extras = new FormData();
    extras.append("contextType", contextType);
    extras.append("contextId", contextId as string);
    extras.append("cursorPosition", cursorPosition.toString());

    if (contextType === "NOTE" && currentNoteId) {
      extras.append("note_state", noteCache[currentNoteId]?.content ?? "");
    } else if (contextType === "STACK" && currentStackId) {
      const stack = stacks.find((s) => s.id === currentStackId);
      if (stack) extras.append("dynamic_schema", JSON.stringify(stack.columns));
    } else if (contextType === "TASK" && currentFocusedTaskId) {
      const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
      const focused = allTasks.find((t) => t.id === currentFocusedTaskId);
      if (focused) {
        extras.append("task_context", JSON.stringify({
          focusedTaskId: focused.id,
          focusedTaskTitle: focused.title,
        }));
      }
    }

    setIsRecording(true);
    setRecordingTranscript(""); // Clear previous transcript
    await start(contextType, contextId as string, extras);
  }, [
    status, currentNoteId, currentStackId, cursorPosition, openTabs, activeTabId,
    currentFocusedTaskId, tasks, taskChildrenMap, noteCache, stacks,
    setIsRecording, setRecordingTranscript, start,
  ]);

  const handleStop = useCallback(async () => {
    if (status === "idle") return;
    setIsRecording(false);
    await stop();
    // Keep transcript visible until next start or a short delay if needed
    // For now, we leave it so it can be seen while processing
  }, [status, setIsRecording, stop]);

  // ─── Keyboard binding ─────────────────────────────────────────────────────
  //
  // Fixed closure bug from the original: handlers are registered once and
  // use refs to read current status/handlers without re-registering.
  // The original had [isRecording, isProcessing] in its dep array which caused
  // the listeners to teardown/re-add on every state flip, making it possible
  // to miss keyup events during rapid state changes.

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
  }, []); // intentionally empty — stability via refs above

  // ─── Derived UI state ──────────────────────────────────────────────────────

  const isActive = status !== "idle";
  const isProcessing =
    status === "minting" ||
    status === "connecting" ||
    status === "finalizing" ||
    status === "fallback";

  const statusLabel: Record<STTStatus, string> = {
    idle: "",
    minting: "Connecting…",
    connecting: "Connecting…",
    streaming: "Listening…",
    finalizing: "Processing…",
    fallback: "Processing (batch)…",
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 group flex flex-col items-center gap-3">
      {/* Live status and transcript pill — shown while active or when transcript exists */}
      {(isActive || recordingTranscript) && (
        <div
          className="
            flex flex-col items-center gap-2
            bg-charcoal/90 text-on-dark text-xs font-medium
            px-4 py-2 rounded-2xl shadow-2xl
            pointer-events-none select-none
            transition-all duration-300
            max-w-[300px] w-max
          "
        >
          {isActive && (
            <span className="text-[10px] uppercase tracking-wider opacity-70">
              {statusLabel[status]}
            </span>
          )}
          {recordingTranscript && (
            <p className="text-sm leading-relaxed text-center italic">
              "{recordingTranscript}"
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <Button
          onMouseDown={handleStart}
          onMouseUp={handleStop}
          onMouseLeave={isActive ? handleStop : undefined}
          onTouchStart={handleStart}
          onTouchEnd={handleStop}
          disabled={isProcessing}
          size="icon"
          className={`
            h-14 w-14 rounded-md shadow-lg transition-all duration-150
            ${isActive
              ? "bg-semantic-error hover:bg-semantic-error/90 scale-110"
              : "bg-primary hover:bg-primary/90"
            }
          `}
          title="Hold Ctrl + Space or hold button to record"
          aria-label={isActive ? "Recording — release to stop" : "Push to talk"}
          aria-pressed={isActive}
        >
          <Mic
            className={`h-6 w-6 text-on-primary ${isActive ? "animate-pulse" : ""}`}
          />
        </Button>

        {/* Ripple effect while active */}
        {isActive && (
          <span className="absolute inset-0 rounded-md bg-semantic-error/20 animate-ping pointer-events-none" />
        )}
      </div>
    </div>
  );
}
