
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
    cursorPosition,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
    noteCache,
    stacks,
    setIsVoiceMutating,
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

        const res = await axios.post("/api/voice/process", form, {
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
        if (axios.isAxiosError(error)) {
          const apiError = error.response?.data?.error;
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
                const packed = await packContext();
                const primary = packed.items[0];
                const extras = new FormData();
                extras.append("contextType", primary.type);
                extras.append("contextId", primary.id);
                if (primary.type === "NOTE") {
                  extras.append("cursorPosition", cursorPosition.toString());
                }
                await startSTT(primary.type, primary.id, extras);
              }
            }}
            onMouseUp={stopSTT}
            onMouseLeave={isRecording ? stopSTT : undefined}
            onTouchStart={async () => {
              if (!isRecording) {
                const packed = await packContext();
                const primary = packed.items[0];
                const extras = new FormData();
                extras.append("contextType", primary.type);
                extras.append("contextId", primary.id);
                if (primary.type === "NOTE") {
                  extras.append("cursorPosition", cursorPosition.toString());
                }
                await startSTT(primary.type, primary.id, extras);
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
