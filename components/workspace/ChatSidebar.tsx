"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, Send, Mic, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceStore } from "@/lib/store";
import { packContext } from "@/lib/voice/contextHelpers";
import { buildVoiceFormData, getFormDataContext } from "@/lib/voice/buildFormData";
import { handleResponseActions } from "@/lib/voice/handleResponseActions";
import ReactMarkdown from "react-markdown";
import { apiClient } from "@/lib/httpClient";
import { toast } from "@/lib/toast";
import { useDeepgramSTT } from "@/lib/hooks/useDeepgramSTT";

/** Format a Date for display in chat */
function formatTime(d: Date): string {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Human-readable label for context item type */
const contextTypeIcon: Record<string, string> = {
  NOTE: "📄", STACK: "📊", TASK: "✅", TASKS: "✅", CALENDAR: "📅",
};

export default function ChatSidebar() {
  const {
    isChatOpen,
    setIsChatOpen,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    currentNoteId,
    currentStackId,
    currentFocusedTaskId,
    cursorPosition,
    tasks,
    taskChildrenMap,
    noteCache,
    stacks,
    addVoiceMutatingId,
    removeVoiceMutatingId,
  } = useWorkspaceStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // ─── Send text message ────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      const entityId = currentNoteId || currentStackId || currentFocusedTaskId || "chat";
      addVoiceMutatingId(entityId);

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
        removeVoiceMutatingId(entityId);
      }
    },
    [addChatMessage, updateChatMessage, currentNoteId, currentStackId,
     currentFocusedTaskId, tasks, taskChildrenMap,
     noteCache, stacks, addVoiceMutatingId, removeVoiceMutatingId]
  );

  // Handle text input submit (button click)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    sendMessage(inputText.trim());
    setInputText("");
  };

  // Intercept Enter key: Enter sends, Shift+Enter inserts newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!inputText.trim() || isProcessing) return;
      sendMessage(inputText.trim());
      setInputText("");
    }
  };

  // ─── Voice STT integration ────────────────────────────────────────

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
  const isSTTProcessing = sttStatus === "minting" || sttStatus === "connecting" || sttStatus === "finalizing";

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopSTT();
    } else {
      const packed = await packContext();
      const primary = packed.items[0];
      const extras = new FormData();
      extras.append("contextType", primary.type);
      extras.append("contextId", primary.id);
      if (primary.type === "NOTE") {
        extras.append("cursorPosition", String(cursorPosition));
      }
      await startSTT(primary.type, primary.id, extras);
    }
  }, [isRecording, stopSTT, startSTT, cursorPosition]);

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 md:w-96 glass-panel shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-in-out z-[100] flex flex-col border-l border-white/5 ${
        isChatOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#131313]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 text-[#10B981]">
          <div className="h-2 w-2 rounded-full bg-[#10B981] glow-emerald-subtle animate-pulse" />
          <h2 className="text-xs font-bold tracking-widest text-white font-technical uppercase">
            AI Companion
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsChatOpen(false)}
          className="text-zinc-500 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg transition-colors duration-150"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-6 px-4">
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-[#10B981]/5 border border-[#10B981]/20 glow-emerald-subtle">
                <Sparkles className="h-6 w-6 text-[#10B981] animate-pulse" />
              </div>
              <h3 className="text-xs font-semibold tracking-wider text-white font-technical uppercase">
                AI Companion Active
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center max-w-[220px] leading-relaxed">
                Ask questions or command the workspace
              </p>
            </div>
            
            <div className="w-full space-y-2 max-w-[280px]">
              <p className="text-[9px] text-zinc-600 font-technical uppercase tracking-widest text-center">
                Quick Actions
              </p>
              {[
                { label: "Summarize active note", text: "Summarize this note" },
                { label: "Create a task for tomorrow", text: "Create a task for tomorrow to " },
                { label: "Analyze my stacks", text: "Show me a summary of my stacks" }
              ].map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInputText(action.text);
                    const inputEl = document.getElementById("chat-input");
                    if (inputEl) inputEl.focus();
                  }}
                  className="w-full text-left px-3.5 py-2.5 bg-[#131313]/50 hover:bg-[#1c1c1c]/80 border border-white/5 hover:border-[#10B981]/35 rounded-xl transition-all duration-200 group flex items-center justify-between text-xs text-zinc-400 hover:text-white"
                >
                  <span className="font-technical truncate">{action.label}</span>
                  <span className="text-[#10B981] translate-x-1 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all font-technical">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="space-y-2 animate-in fade-in-50 duration-200">
              {/* Timestamp & Sender */}
              <div className={`flex items-center gap-1.5 text-[9px] font-technical uppercase tracking-wider text-zinc-500 ${
                msg.type === "user" ? "justify-end" : "justify-start"
              }`}>
                {msg.type === "user" ? (
                  <>
                    <span>User</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
                    <span>{formatTime(new Date(msg.timestamp))}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#10B981] font-semibold">AI Assistant</span>
                    <span className="h-1 w-1 rounded-full bg-[#10B981]/30"></span>
                    <span>{formatTime(new Date(msg.timestamp))}</span>
                  </>
                )}
              </div>

              {msg.type === "user" && (
                <div className="flex justify-end">
                  <div className="glass-bubble-user text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[90%] shadow-lg">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.context && msg.context.items && msg.context.items.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-white/5">
                        <button
                          onClick={() => setExpandedContextId(expandedContextId === msg.id ? null : msg.id)}
                          className="text-[10px] font-technical text-[#10B981] hover:text-[#10B981]/80 flex items-center gap-1.5 uppercase tracking-wider transition-colors duration-150"
                        >
                          <span>📎</span>
                          <span>Context ({msg.context.items.length})</span>
                          {expandedContextId === msg.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        {expandedContextId === msg.id && (
                          <div className="mt-2 text-[11px] font-technical bg-[#0E0E0E]/80 backdrop-blur-sm border border-white/5 p-2 rounded-xl space-y-1.5">
                            {msg.context.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 transition-all">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-[#10B981] shrink-0 text-sm">
                                    {contextTypeIcon[item.type] || "📄"}
                                  </span>
                                  <span className="font-semibold text-white truncate max-w-[130px]">
                                    {item.title || item.id}
                                  </span>
                                </div>
                                {item.source && (
                                  <span className="text-[8px] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-1.5 py-0.5 rounded font-technical uppercase shrink-0 tracking-wider">
                                    {item.source === "active_tab" ? "Tab" : item.source === "user_mention" ? "@Mention" : "Recent"}
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
                  <div className={`max-w-[90%] px-4 py-3 rounded-2xl rounded-tl-none shadow-xl border transition-all duration-300 ${
                    msg.status === "error"
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : msg.status === "processing"
                      ? "glass-bubble-ai border-[#10B981]/25 text-zinc-400 glow-emerald-subtle"
                      : "glass-bubble-ai border-white/5 text-slate-200"
                  }`}>
                    {msg.status === "processing" ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                        </div>
                        <span className="text-xs font-technical uppercase tracking-widest text-[#10B981] animate-pulse">
                          Thinking...
                        </span>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900/60 prose-pre:border prose-pre:border-white/5 text-slate-200">
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

      {/* Input area */}
      <div className="p-4 border-t border-white/5 bg-[#131313]/95 backdrop-blur-md shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative flex items-start bg-[#0E0E0E]/90 border border-white/10 focus-within:border-[#10B981]/50 focus-within:ring-1 focus-within:ring-[#10B981]/20 transition-all rounded-xl p-1">
            <Textarea
              ref={textareaRef}
              id="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening…" : "Message AI Companion…"}
              disabled={isProcessing}
              rows={1}
              className="flex-1 bg-transparent border-0 text-white text-sm resize-none rounded-lg placeholder:text-zinc-500 font-technical focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 pl-3 py-2 pr-2 min-h-[40px] max-h-[200px]"
            />
            {/* Send button */}
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={!inputText.trim() || isProcessing}
              className="h-8 w-8 rounded-lg shrink-0 text-[#10B981] hover:bg-[#10B981]/15 disabled:text-zinc-700 disabled:hover:bg-transparent transition-all duration-200"
              title="Send message"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-technical px-1">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleRecording}
                disabled={isProcessing}
                className={`h-7 px-2.5 rounded-lg text-xs font-technical flex items-center gap-1.5 transition-all duration-200 ${
                  isRecording
                    ? "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 border border-[#10B981]/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
                title={isRecording ? "Stop voice input" : "Start voice input"}
              >
                {isSTTProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isRecording ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]"></span>
                    </span>
                    <span>Stop Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3 text-zinc-500" />
                    <span>Voice Input</span>
                  </>
                )}
              </Button>
            </div>
            
            <div className="uppercase tracking-widest text-[8px] text-zinc-600">
              Flow State Active
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
