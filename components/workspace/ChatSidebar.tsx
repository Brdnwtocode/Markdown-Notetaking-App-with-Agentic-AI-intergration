
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, Send, Mic, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/lib/store";
import { packContext } from "@/lib/voice/contextHelpers";
import { buildVoiceFormData, getFormDataContext } from "@/lib/voice/buildFormData";
import { handleResponseActions } from "@/lib/voice/handleResponseActions";
import ReactMarkdown from "react-markdown";
import { apiClient } from "@/lib/httpClient";
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
    cursorPosition,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
    noteCache,
    stacks,
    setIsVoiceMutating,
    setAiReply,
    activeTabId,
    openTabs,
  } = useWorkspaceStore();

  const getCurrentContext = () => {
    if (!activeTabId) return null;
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (!tab) return null;
    return { type: tab.type, id: tab.id };
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Send message to API
  const sendMessage = useCallback(
    async (content: string) => {
      // 1. Pack context
      const packedContext = await packContext(content);

      // 2. Add user message
      addChatMessage({
        type: "user",
        content,
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

      // 3. Add AI placeholder
      const aiMsgId = addChatMessage({
        type: "ai", content: "", status: "processing",
      });

      setIsProcessing(true);
      setIsVoiceMutating(true);

      try {
        // 4. Build & send FormData
        const form = buildVoiceFormData(content, packedContext, getFormDataContext());

        const res = await apiClient.post("/api/voice/process", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // 5. Handle response
        const replyContent = handleResponseActions(res.data, {
          currentNoteId,
          currentStackId,
          currentFocusedTaskId,
          noteCache,
          stacks,
          tasks,
          taskChildrenMap,
          originalContent: "",
        });

        updateChatMessage(aiMsgId, { content: replyContent, status: "completed" });
        if (res.data.aiReply) setAiReply(res.data.aiReply);
      } catch (error) {
        console.error("Chat message failed:", error);

        let msg = "Failed to process message. Please try again.";
        if (error && typeof error === "object" && "isAxiosError" in error) {
          const apiError = (error as any).response?.data?.error;
          if (apiError === "Command not recognized as a workspace action.") {
            msg = "Command not recognized as a workspace action. Please clarify your request and try again.";
          } else if (typeof apiError === "string" && apiError.trim() !== "") {
            msg = apiError;
          }
        }

        updateChatMessage(aiMsgId, { content: msg, status: "error" });
        toast.error(msg);
      } finally {
        setIsProcessing(false);
        setIsVoiceMutating(false);
      }
    },
    [addChatMessage, updateChatMessage, currentNoteId, currentStackId,
     currentFocusedTaskId, cursorPosition, tasks, taskChildrenMap,
     noteCache, stacks, setIsVoiceMutating, setAiReply]
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
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-[#0E0E0E] border-l border-[#27272A] shadow-2xl transition-all duration-300 ease-in-out z-[100] flex flex-col ${
        isChatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#27272A] bg-[#131313]">
        <div className="flex items-center gap-2 text-[#10B981]">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-tighter text-white font-technical uppercase">
            AI Chat
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsChatOpen(false)}
          className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-none"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 font-technical">
            <Sparkles className="h-10 w-10 text-[#10B981] opacity-35" />
            <p className="text-xs uppercase tracking-wider">Start flow state session</p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.type === "user" && (
                <div className="flex justify-end">
                  <div className="bg-[#131313] border border-[#27272A] text-white px-4 py-3 rounded-none max-w-[90%]">
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.context && msg.context.items && msg.context.items.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedContextId(expandedContextId === msg.id ? null : msg.id)}
                          className="text-[10px] font-technical text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1 uppercase tracking-wider"
                        >
                          📎 Context ({msg.context.items.length} files) {expandedContextId === msg.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {expandedContextId === msg.id && (
                          <div className="mt-1.5 text-[11px] font-technical bg-[#0E0E0E] border border-[#27272A] rounded-none p-2 space-y-1.5">
                            {msg.context.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="text-[#10B981]">
                                  {item.type === "NOTE" ? "📄" : item.type === "STACK" ? "📊" : item.type === "TASK" || item.type === "TASKS" ? "✅" : "📅"}
                                </span>
                                <span className="font-semibold text-white truncate max-w-[150px]">{item.title || item.id}</span>
                                {item.source && (
                                  <span className="text-zinc-500 text-[9px] uppercase">
                                    ({item.source === "user_mention" ? "mention" : item.source})
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
                  <div className="bg-[#131313] border border-[#27272A] text-white px-4 py-3 rounded-none max-w-[90%] shadow-lg">
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#27272A]">
                      <div className="w-5 h-5 bg-[#10B981] text-[#0E0E0E] flex items-center justify-center font-technical font-bold text-xs">AI</div>
                      <span className="text-[10px] font-technical text-zinc-400">SYSTEM RESPOND</span>
                    </div>
                    {msg.status === "processing" ? (
                      <div className="flex items-center gap-2 text-[#10B981] font-technical text-xs py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="uppercase tracking-wider">Analyzing Context...</span>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none text-zinc-100 font-sans leading-relaxed
                        [&_pre]:bg-[#0E0E0E] [&_pre]:border [&_pre]:border-[#27272A] [&_pre]:rounded-none [&_pre]:p-3 [&_pre]:my-2
                        [&_code]:font-technical [&_code]:text-xs [&_code]:text-[#10B981]">
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
      <div className="p-4 border-t border-[#27272A] bg-[#131313] flex flex-col gap-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Button
            type="button"
            variant="technical"
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
            className={`h-10 w-10 rounded-full transition-all flex-shrink-0 flex items-center justify-center border border-[#27272A] ${
              isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-[#0E0E0E] hover:bg-[#131313] text-white"
            }`}
          >
            <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
          </Button>
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a command..."
            disabled={isProcessing || isRecording}
            className="h-10 bg-[#0E0E0E] border-[#27272A] text-sm focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="icon"
            variant="technical"
            disabled={!inputText.trim() || isProcessing || isRecording}
            className="h-10 w-10 rounded-none bg-[#10B981] hover:bg-[#10B981]/90 text-[#0E0E0E] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:opacity-50 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="text-[10px] text-center text-zinc-500 font-technical uppercase tracking-wider">
          Push to talk: Press <kbd className="bg-[#0E0E0E] px-1 py-0.5 border border-[#27272A] text-zinc-400">Ctrl</kbd> + <kbd className="bg-[#0E0E0E] px-1 py-0.5 border border-[#27272A] text-zinc-400">Space</kbd>
        </div>
      </div>
    </div>
  );
}
