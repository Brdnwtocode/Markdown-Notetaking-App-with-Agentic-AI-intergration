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
import { ContextPacker, extractMentions } from "@/lib/context/packer";
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
    stageMutation,
    setAiReply,
    openTabs,
    activeTabId,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
    setIsChatOpen,
    addChatMessage,
    updateChatMessage,
    openTab,
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
      setIsChatOpen(true); // Open chat when processing voice command
      
      toast.loading("Processing voice command...", { id: "voice-processing" });

      let aiMsgId: string | null = null;
      try {
        // Build context using ContextPacker (modular)
        const store = useWorkspaceStore.getState();
        const packer = new ContextPacker(store);
        
        // Collect tab IDs to pack
        const tabIds = store.selectedTabIds.length > 0 
          ? store.selectedTabIds 
          : (store.activeTabId ? [store.activeTabId] : []);
        
        // Extract @mentions from transcript
        const mentions = extractMentions(transcript);
        
        // Pack context with transcript for command detection
        let packedContext = await packer.pack({
          tabIds,
          mentions: mentions.length > 0 ? mentions : undefined,
          transcript, // Pass transcript for command type detection
        });

        if (packedContext.items.length === 0) {
          packedContext = {
            items: [
              {
                type: "NOTE",
                id: "00000000-0000-0000-0000-000000000000",
                title: "No active context",
                content: "",
                source: "active_tab",
              }
            ],
            packedAt: new Date(),
            totalItems: 0
          };
        }

        // Add user message to chat with packed context
        addChatMessage({
          type: "user",
          content: transcript,
          context: {
            items: packedContext.items.map((item: any) => ({
              type: item.type,
              id: item.id,
              title: item.title,
              source: item.source,
            })),
            packedAt: packedContext.packedAt,
            totalItems: packedContext.totalItems,
          },
          status: "completed",
        });

        // Add AI processing message and get its ID
        aiMsgId = addChatMessage({
          type: "ai",
          content: "",
          status: "processing",
        });

  // Post transcript as text to FastAPI — FastAPI skips STT when transcript is provided
        const form = new FormData();
        form.append("transcript", transcript);          // new: text input
        form.append("packed_context", JSON.stringify(packedContext));

        // For backward compatibility, also send primary context
        const primary = packedContext.items[0];
        if (primary) {
          form.append("contextType", primary.type);
          form.append("contextId", primary.id);
          form.append("cursorPosition", cursorPosition.toString());
        }

        let originalContent = "";
        if (primary.type === "NOTE" && currentNoteId && primary.id !== "00000000-0000-0000-0000-000000000000") {
          originalContent = noteCache[currentNoteId]?.content ?? "";
          form.append("note_state", originalContent);
        } else if (primary.type === "STACK" && currentStackId && primary.id !== "00000000-0000-0000-0000-000000000000") {
          const stack = stacks.find((s) => s.id === currentStackId);
          if (stack) form.append("dynamic_schema", JSON.stringify(stack.columns));
        } else if (primary.type === "TASK" && currentFocusedTaskId && primary.id !== "00000000-0000-0000-0000-000000000000") {
          const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
          const focused = allTasks.find((t) => t.id === currentFocusedTaskId);
          if (focused) {
            form.append("task_context", JSON.stringify({
              focusedTaskId: focused.id,
              focusedTaskTitle: focused.title,
            }));
          }
        }

        console.log("[PushToTalk] Form data prepared, sending to /api/voice/process");
        console.log("[PushToTalk] Transcript:", transcript);
        console.log("[PushToTalk] Primary context:", primary);

        const res = await axios.post("/api/voice/process", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        console.log("[PushToTalk] Voice API response:", res.data);
        const { action, updatedData, aiReply } = res.data;

        let replyContent = aiReply || "Done!";

        if (action && updatedData) {
          if (action === "update_note") {
            const noteId: string = updatedData?.id || currentNoteId;
            if (!noteId) {
              replyContent = "AI suggested edits but no note is open to display them.";
            } else {
              const noteTitle = updatedData?.title || noteCache[noteId]?.title || "Note";
              openTab(noteId, "NOTE", noteTitle);
              stageMutation({
                type: "update_note",
                noteId,
                originalContent: noteCache[noteId]?.content || originalContent || "",
                updatedData,
              });
              replyContent = `AI suggested edits to "${noteTitle}".\n\nReview the highlighted diff and click **Accept** to save or **Discard** to revert.`;
            }
          } else if (action === "add_stack_row") {
            const stackId: string = updatedData?.stackId || currentStackId;
            if (!stackId) {
              replyContent = "AI suggested a new row but no stack is open to display it.";
            } else {
              const stack = stacks.find((s) => s.id === stackId);
              const stackName = stack?.name || "Stack";
              openTab(stackId, "STACK", stackName);
              stageMutation({ type: "add_stack_row", stackId, data: updatedData });
              replyContent = `AI suggested a new row in "${stackName}".\n\nReview the highlighted ghost row and click **Accept** to save or **Discard** to revert.`;
            }
          } else if (action === "create_task") {
            stageMutation({ type: "create_task", data: updatedData });
            replyContent = `AI suggested a new task: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
          } else if (action === "create_calendar_event") {
            stageMutation({ type: "create_calendar_event", data: updatedData });
            replyContent = `AI suggested a new calendar event: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
          } else if (action === "bulk_update_stack") {
            const stackId: string = updatedData?.stackId || currentStackId;
            if (stackId && updatedData?.updates) {
              const stack = stacks.find((s) => s.id === stackId);
              const stackName = stack?.name || "Stack";
              openTab(stackId, "STACK", stackName);
              stageMutation({ type: "bulk_update_stack", stackId, updates: updatedData.updates });
              replyContent = `AI suggested bulk updates to ${updatedData.updates.length} row(s) in "${stackName}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
            } else {
              replyContent = "AI suggested bulk updates but no stack is open.";
            }
          } else if (action === "manage_tasks") {
            stageMutation({ type: "manage_tasks", action: updatedData?.action || "create", data: updatedData });
            replyContent = `AI suggested a task ${updatedData?.action || "update"}.\n\nReview and click **Accept** to save or **Discard** to revert.`;
          }
          toast.dismiss("voice-processing");
        } else if (action === "summarize_context") {
          replyContent = aiReply || "Summary generated.";
          toast.dismiss("voice-processing");
        } else if (action === "none") {
          replyContent = aiReply || "Please provide more context.";
          toast.dismiss("voice-processing");
        } else if (!action && !updatedData && aiReply) {
          // Pure conversational reply — use aiReply directly (already set above)
          toast.dismiss("voice-processing");
        } else {
          toast.dismiss("voice-processing");
        }

        // Update AI message with the appropriate reply
        updateChatMessage(aiMsgId, {
          content: replyContent,
          status: "completed",
        });

        if (aiReply) setAiReply(aiReply);
      } catch (err: unknown) {
        console.error("[PushToTalk] Action pipeline failed:", err);
        toast.dismiss("voice-processing");
        
        let displayMessage = "Failed to process voice command. Please try again.";
        
        // Enhanced error logging
        if (axios.isAxiosError(err)) {
          console.error("[PushToTalk] Axios error details:", {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            url: err.config?.url,
          });
          
          const apiError = err.response?.data?.error;
          if (apiError === "Command not recognized as a workspace action.") {
            displayMessage = "Command not recognized as a workspace action. Please clarify your request and try again.";
          } else if (typeof apiError === "string" && apiError.trim() !== "") {
            displayMessage = apiError;
          }
        }
        
        // Update assistant message with the error and mark it as error status
        if (aiMsgId) {
          updateChatMessage(aiMsgId, {
            content: displayMessage,
            status: "error",
          });
        }
        
        toast.error(displayMessage);
      } finally {
        setIsVoiceMutating(false);
      }
    },
    // Stable deps — all store primitives are stable references
    [
      currentNoteId, currentStackId, cursorPosition, openTabs, activeTabId,
      currentFocusedTaskId, tasks, taskChildrenMap, noteCache, stacks,
      setIsVoiceMutating, setRecordingTranscript, stageMutation, setAiReply,
      setIsChatOpen, addChatMessage, updateChatMessage, openTab,
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

    // Use ContextPacker to check if we have valid context
    const store = useWorkspaceStore.getState();
    const packer = new ContextPacker(store);
    
    const tabIds = store.selectedTabIds.length > 0 
      ? store.selectedTabIds 
      : (store.activeTabId ? [store.activeTabId] : []);
    
    let packed = await packer.pack({ tabIds });

    if (packed.items.length === 0) {
      packed = {
        items: [
          {
            type: "NOTE",
            id: "00000000-0000-0000-0000-000000000000",
            title: "No active context",
            content: "",
            source: "active_tab",
          }
        ],
        packedAt: new Date(),
        totalItems: 0
      };
    }

    // Build extras FormData — carries optional context payload for fallback path
    const extras = new FormData();
    const primary = packed.items[0];
    extras.append("contextType", primary.type);
    extras.append("contextId", primary.id);
    extras.append("cursorPosition", cursorPosition.toString());

    if (primary.type === "NOTE" && currentNoteId && primary.id !== "00000000-0000-0000-0000-000000000000") {
      extras.append("note_state", noteCache[currentNoteId]?.content ?? "");
    } else if (primary.type === "STACK" && currentStackId && primary.id !== "00000000-0000-0000-0000-000000000000") {
      const stack = stacks.find((s) => s.id === currentStackId);
      if (stack) extras.append("dynamic_schema", JSON.stringify(stack.columns));
    } else if (primary.type === "TASK" && currentFocusedTaskId && primary.id !== "00000000-0000-0000-0000-000000000000") {
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
    await start(primary.type, primary.id, extras);
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
              {recordingTranscript}
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
