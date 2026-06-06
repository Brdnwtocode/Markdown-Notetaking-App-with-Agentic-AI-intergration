
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, Send, Mic, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/lib/store";
import { ContextPacker, extractMentions } from "@/lib/context/packer";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import toast from "react-hot-toast";
import { useDeepgramSTT } from "@/lib/hooks/useDeepgramSTT";

export default function ChatSidebar() {
  const {
    isChatOpen,
    setIsChatOpen,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    currentNoteId,
    currentStackId,
    openTabs,
    activeTabId,
    openTab,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
    noteCache,
    stacks,
    setIsVoiceMutating,
    stageMutation,
    setAiReply,
  } = useWorkspaceStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Get current context using ContextPacker (modular)
  const getCurrentContext = useCallback(async (content?: string) => {
    const store = useWorkspaceStore.getState();
    const packer = new ContextPacker(store);
    
    // Collect tab IDs to pack
    const tabIds = store.selectedTabIds.length > 0 
      ? store.selectedTabIds 
      : (store.activeTabId ? [store.activeTabId] : []);
    
    // Extract @mentions from content if provided
    const mentions = content ? extractMentions(content) : [];
    
    // Pack context with transcript for command detection
    const packed = await packer.pack({
      tabIds,
      mentions: mentions.length > 0 ? mentions : undefined,
      transcript: content, // Pass content for command type detection
    });
    
    return packed;
  }, []);

  // Send message to API
  const sendMessage = useCallback(
    async (content: string) => {
      // Get packed context using ContextPacker
      const packedContext = await getCurrentContext(content);

      // Add user message with packed context
      addChatMessage({
        type: "user",
        content,
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
      const aiMsgId = addChatMessage({
        type: "ai",
        content: "",
        status: "processing",
      });

      setIsProcessing(true);
      setIsVoiceMutating(true);

      try {
        const form = new FormData();
        form.append("transcript", content);
        
        // Send packed context as JSON
        form.append("packed_context", JSON.stringify(packedContext));

        // For backward compatibility, also send primary context
        if (packedContext.items.length > 0) {
          const primary = packedContext.items[0];
          form.append("contextType", primary.type);
          form.append("contextId", primary.id);
          form.append("cursorPosition", cursorPosition.toString()); // Fix: use actual cursor position

          if (primary.type === "NOTE" && currentNoteId) {
            form.append("note_state", noteCache[currentNoteId]?.content || "");
          } else if (primary.type === "STACK" && currentStackId) {
            const stack = stacks.find((s) => s.id === currentStackId);
            if (stack)
              form.append("dynamic_schema", JSON.stringify(stack.columns));
          } else if (primary.type === "TASK" && currentFocusedTaskId) {
            const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
            const focused = allTasks.find((t) => t.id === currentFocusedTaskId);
            if (focused)
              form.append(
                "task_context",
                JSON.stringify({
                  focusedTaskId: focused.id,
                  focusedTaskTitle: focused.title,
                })
              );
          }
        }

        const res = await axios.post("/api/voice/process", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const { action, updatedData, aiReply } = res.data;

        let replyContent = aiReply || "Done!";

        if (action && updatedData) {
          if (action === "update_note") {
            // Use the note ID returned by the AI, fall back to currentNoteId
            const noteId: string = updatedData?.id || currentNoteId;
            if (!noteId) {
              replyContent = "AI suggested edits but no note is open to display them.";
            } else {
              const noteTitle = updatedData?.title || noteCache[noteId]?.title || "Note";
              // Auto-open the note tab so the diff overlay is visible
              openTab(noteId, "NOTE", noteTitle);
              stageMutation({
                type: "update_note",
                noteId,
                originalContent: noteCache[noteId]?.content || "",
                updatedData,
              });
              replyContent = `AI suggested edits to "${noteTitle}".\n\nReview the highlighted diff and click **Accept** to save or **Discard** to revert.`;
            }
          } else if (action === "add_stack_row") {
            const stackId: string = updatedData?.stackId || currentStackId;
            if (!stackId) {
              replyContent = "AI suggested a new row but no stack is open to display it.";
            } else {
              const stack = stacks.find((s: any) => s.id === stackId);
              const stackName = stack?.name || "Stack";
              openTab(stackId, "STACK", stackName);
              stageMutation({
                type: "add_stack_row",
                stackId,
                data: updatedData,
              });
              replyContent = `AI suggested a new row in "${stackName}".\n\nReview the highlighted ghost row and click **Accept** to save or **Discard** to revert.`;
            }
          } else if (action === "create_task") {
            stageMutation({ type: "create_task", data: updatedData });
            replyContent = `AI suggested a new task: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
          } else if (action === "create_calendar_event") {
            stageMutation({ type: "create_calendar_event", data: updatedData });
            replyContent = `AI suggested a new calendar event: "${updatedData?.title || "Untitled"}".\n\nReview and click **Accept** to save or **Discard** to revert.`;
          }
        }

        // Update AI message with the appropriate reply
        updateChatMessage(aiMsgId, {
          content: replyContent,
          status: "completed",
        });

        if (aiReply) setAiReply(aiReply);
      } catch (error) {
        console.error("Chat message failed:", error);
        
        let displayMessage = "Failed to process message. Please try again.";
        if (axios.isAxiosError(error)) {
          const apiError = error.response?.data?.error;
          if (apiError === "Command not recognized as a workspace action.") {
            displayMessage = "Command not recognized as a workspace action. Please clarify your request and try again.";
          } else if (typeof apiError === "string" && apiError.trim() !== "") {
            displayMessage = apiError;
          }
        }

        updateChatMessage(aiMsgId, {
          content: displayMessage,
          status: "error",
        });

        toast.error(displayMessage);
      } finally {
        setIsProcessing(false);
        setIsVoiceMutating(false);
      }
    },
    [
      addChatMessage,
      updateChatMessage,
      getCurrentContext,
      currentNoteId,
      currentStackId,
      currentFocusedTaskId,
      tasks,
      taskChildrenMap,
      noteCache,
      stacks,
      setIsVoiceMutating,
      openTab,
      stageMutation,
      setAiReply,
    ]
  );

  // Handle text input submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    sendMessage(inputText.trim());
    setInputText("");
  };

  // Voice STT integration
  const { status: sttStatus, start: startSTT, stop: stopSTT } = useDeepgramSTT({
    language: "vi",
    model: "nova-3",
    onInterimTranscript: (text) => setInputText(text),
    onTranscriptReady: (text) => {
      if (text.trim()) {
        sendMessage(text.trim());
        setInputText("");
      }
    },
  });

  const isRecording = sttStatus !== "idle";

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-[#0b1118] border-l border-white/10 shadow-2xl transition-all duration-300 ease-in-out z-[100] flex flex-col ${
        isChatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0a0f16]">
        <div className="flex items-center gap-2 text-purple-400">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-sm font-semibold tracking-tight text-slate-200">
            AI Chat
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsChatOpen(false)}
          className="text-slate-400 hover:text-white hover:bg-white/5 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
          <Sparkles className="h-10 w-10 opacity-30" />
          <p className="text-sm">Start a conversation with AI</p>
        </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.type === "user" && (
                <div className="flex justify-end">
                  <div className="bg-purple-600/20 text-purple-100 px-4 py-2 rounded-lg max-w-[85%] rounded-br-sm">
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.context && msg.context.items && msg.context.items.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedContextId(expandedContextId === msg.id ? null : msg.id)}
                          className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
                        >
                          📎 Context ({msg.context.items.length} files) {expandedContextId === msg.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {expandedContextId === msg.id && (
                          <div className="mt-1 text-xs bg-purple-900/30 border border-purple-700/30 rounded p-2 space-y-1">
                            {msg.context.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span className="text-purple-400">
                                  {item.type === "NOTE" ? "📄" : item.type === "STACK" ? "📊" : item.type === "TASK" || item.type === "TASKS" ? "✅" : "📅"}
                                </span>
                                <span className="font-medium text-purple-300">{item.title || item.id}</span>
                                {item.source && (
                                  <span className="text-purple-400/60 text-[10px] ml-1">
                                    - {item.source === "user_mention" ? "mentioned" : item.source}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {msg.type === "ai" && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800/50 text-zinc-200 px-4 py-2 rounded-lg max-w-[85%] rounded-bl-sm">
                    {msg.status === "processing" ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed text-slate-200">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-[#0a0f16]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Button
            type="button"
            size="icon"
            disabled={isProcessing}
            onMouseDown={async () => {
              if (!isRecording) {
                const context = getCurrentContext();
                if (!context) {
                  toast.error("Select a note, stack, tasks, or calendar first");
                  return;
                }
                await startSTT(context.type, context.id, new FormData());
              }
            }}
            onMouseUp={stopSTT}
            onMouseLeave={isRecording ? stopSTT : undefined}
            onTouchStart={async () => {
              if (!isRecording) {
                const context = getCurrentContext();
                if (!context) {
                  toast.error("Select a note, stack, tasks, or calendar first");
                  return;
                }
                await startSTT(context.type, context.id, new FormData());
              }
            }}
            onTouchEnd={stopSTT}
            className={`h-10 w-10 rounded transition-all ${
              isRecording ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
          </Button>
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            disabled={isProcessing || isRecording}
            className="h-10 bg-zinc-800/50 border-zinc-700 text-sm focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputText.trim() || isProcessing || isRecording}
            className="h-10 w-10 rounded bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
