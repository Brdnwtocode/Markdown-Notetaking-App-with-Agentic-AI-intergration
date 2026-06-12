"use client";

import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import toast from "react-hot-toast";
import { SecondaryLogo } from "@/components/shared/BrandAssets";
import { Plus, MessageSquare, Terminal } from "lucide-react";

export default function WorkspacePage() {
  const router = useRouter();
  const { optimisticCreateNote, isChatOpen, setIsChatOpen } = useWorkspaceStore();

  const createNote = async () => {
    try {
      const { tempId, promise } = optimisticCreateNote("Untitled Note");
      router.push(`/workspace/notes/${tempId}`);
      void promise.then(({ realId }) => {
        router.replace(`/workspace/notes/${realId}`);
      });
    } catch (error) {
      toast.error("Failed to create note");
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[#0E0E0E] relative overflow-hidden select-none">
      {/* Subtle tech background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#131313_1px,transparent_1px),linear-gradient(to_bottom,#131313_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-30"></div>
      
      <div className="relative max-w-md w-full text-center space-y-8 flex flex-col items-center">
        {/* Animated Stacked Logo */}
        <div className="relative group">
          <div className="absolute inset-0 bg-[#10B981]/10 rounded-full blur-xl group-hover:bg-[#10B981]/20 transition-all duration-500"></div>
          <SecondaryLogo className="relative w-40 h-40 transition-transform duration-500 group-hover:scale-105" />
        </div>

        <div className="space-y-2">
          <h1 className="text-sm font-semibold tracking-widest text-[#10B981] font-technical uppercase flex items-center justify-center gap-2">
            <Terminal className="h-4 w-4 animate-pulse" /> SYSTEM READY // NO ACTIVE FILE
          </h1>
          <p className="text-xs text-zinc-400 font-technical uppercase tracking-wider">
            Initiate flow state by creating a new note or exploring tools.
          </p>
        </div>

        <div className="flex flex-col w-full gap-3 max-w-xs pt-4">
          <button
            onClick={createNote}
            className="h-10 w-full border border-[#10B981]/40 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-white font-technical text-xs uppercase tracking-wider font-semibold transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Plus className="h-4 w-4 text-[#10B981] group-hover:rotate-90 transition-transform duration-200" />
            Create New Note
          </button>
          
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="h-10 w-full border border-[#27272A] bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white font-technical text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-4 w-4 text-[#10B981]" />
            {isChatOpen ? "Close AI Companion" : "Open AI Companion"}
          </button>
        </div>
      </div>
    </div>
  );
}
