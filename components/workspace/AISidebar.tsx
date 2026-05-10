"use client";

import React from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";

export default function AISidebar() {
  const { aiReply, setAiReply } = useWorkspaceStore();

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-[#0a0a0a] border-l border-white/5 shadow-2xl transition-transform duration-300 ease-in-out z-[100] flex flex-col ${
        aiReply ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#111111]">
        <div className="flex items-center gap-2 text-sky-400">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            AI Assistant
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAiReply(null)}
          className="text-slate-400 hover:text-white hover:bg-white/5 h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 text-slate-300">
          {aiReply ? (
            <ReactMarkdown>{aiReply}</ReactMarkdown>
          ) : (
            <p className="text-slate-500 italic">No messages yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
