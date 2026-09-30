"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import {
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  HelpCircle,
  ListChecks,
  MessageSquare,
  Move,
  Search,
  Sparkles,
  X,
} from "lucide-react";

const STORAGE_KEY = "lock-in:workspace-tutorial-v3-complete";

type GoalId = "capture" | "organize" | "plan" | "ai" | "examples";

const goals: Array<{
  id: GoalId;
  icon: typeof FileText;
  label: string;
  description: string;
  accent: string;
  action: string;
  detail: string;
}> = [
  {
    id: "capture",
    icon: FileText,
    label: "Capture an idea",
    description: "Get a thought out of your head and into a useful note.",
    accent: "#10B981",
    action: "Create my first note",
    detail: "You will start with a real note you can keep, edit, and share with the AI companion.",
  },
  {
    id: "organize",
    icon: FolderOpen,
    label: "Organize my work",
    description: "See how notes, folders, and files fit together.",
    accent: "#60A5FA",
    action: "Open Explorer",
    detail: "The Explorer is your map: move material into folders, search by name, and use sorting and filters to find it again quickly.",
  },
  {
    id: "plan",
    icon: ListChecks,
    label: "Plan next steps",
    description: "Turn a loose idea into tasks you can move forward.",
    accent: "#FBBF24",
    action: "Open Tasks",
    detail: "Tasks give your thinking a place to become action, with status and priority in view.",
  },
  {
    id: "ai",
    icon: MessageSquare,
    label: "Work with AI",
    description: "Ask for a summary, a next step, or a sharper draft.",
    accent: "#A78BFA",
    action: "Open AI companion",
    detail: "The companion is most useful when you bring it a real note or question from your work.",
  },
  {
    id: "examples",
    icon: Sparkles,
    label: "See examples",
    description: "Browse starter notes before creating anything.",
    accent: "#F472B6",
    action: "Open workspace",
    detail: "Starter examples live in Explorer when available. You can open, copy, or delete them freely.",
  },
];

export default function WorkspaceTutorial() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalId | null>(null);
  const { folders, optimisticCreateNote, setFolderExpanded, setIsChatOpen } = useWorkspaceStore();

  useEffect(() => {
    setIsOpen(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  const closeTutorial = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  const openTutorial = () => {
    setSelectedGoal(null);
    setIsOpen(true);
  };

  const completeGoal = () => {
    if (!selectedGoal) return;
    closeTutorial();

    if (selectedGoal === "capture") {
      const { tempId, promise } = optimisticCreateNote("My first idea");
      router.push(`/workspace/notes/${tempId}`);
      void promise.then(({ realId }) => router.replace(`/workspace/notes/${realId}`));
      return;
    }
    if (selectedGoal === "organize") {
      folders.forEach((folder) => setFolderExpanded(folder.id, true));
      window.dispatchEvent(new CustomEvent("lock-in:open-explorer"));
      router.push("/workspace");
    }
    if (selectedGoal === "plan") router.push("/workspace/tasks");
    if (selectedGoal === "ai") setIsChatOpen(true);
    if (selectedGoal === "examples") router.push("/workspace");
  };

  const selected = goals.find((goal) => goal.id === selectedGoal);
  const SelectedIcon = selected?.icon;

  return (
    <>
      <button
        type="button"
        onClick={openTutorial}
        aria-label="Open workspace onboarding"
        title="Open workspace onboarding"
        className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center border border-[#27272A] bg-[#131313] text-zinc-400 shadow-lg transition-colors hover:border-[#10B981]/60 hover:text-[#10B981] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-onboarding-title"
        >
          <div className="relative w-full max-w-3xl overflow-hidden border border-[#27272A] bg-[#0E0E0E] shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#10B981]" />
            <button
              type="button"
              onClick={closeTutorial}
              aria-label="Close workspace onboarding"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-[#27272A] bg-[#131313] p-6 md:border-b-0 md:border-r md:p-8">
                <p className="font-technical text-[10px] uppercase tracking-[0.22em] text-[#10B981]">
                  Lock In / first session
                </p>
                <h1 className="mt-4 max-w-xs text-2xl font-semibold tracking-tight text-white">
                  Make one useful thing.
                </h1>
                <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">
                  Choose what brought you here. I will take you to the right first action, then get out of the way.
                </p>
                <div className="mt-7 border border-[#27272A] bg-[#0E0E0E] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center gap-2 border border-[#27272A] px-2 py-1.5 text-[10px] text-zinc-500">
                    <Search className="h-3.5 w-3.5" />
                    <span>Search workspace...</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex items-center gap-2 font-medium text-white"><FolderOpen className="h-3.5 w-3.5 text-[#10B981]" /> HR &amp; Recruitment</div>
                    <div className="ml-4 border-l border-[#27272A] pl-3 text-zinc-400">
                      <div className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5 text-[#60A5FA]" /> Compliance</div>
                      <div className="mt-2 flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-zinc-500" /> Case log</div>
                      <div className="mt-2 flex items-center gap-2"><Move className="h-3.5 w-3.5 text-[#FBBF24]" /> Drag to move material</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#27272A] pt-2 font-technical text-[9px] uppercase tracking-wider text-zinc-600">
                    <span>Folders / files</span>
                    <span>Sort + filter</span>
                  </div>
                </div>
                <div className="mt-8 border border-[#27272A] bg-[#0E0E0E] p-4">
                  <div className="flex items-center gap-2 text-[#10B981]">
                    <Check className="h-4 w-4" />
                    <span className="font-technical text-[10px] uppercase tracking-wider">Your first win</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    End this setup with a real note, a clear plan, or a useful conversation.
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {!selected ? (
                  <>
                    <p className="font-technical text-[10px] uppercase tracking-[0.2em] text-zinc-500">Choose a starting point</p>
                    <h2 id="workspace-onboarding-title" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                      What do you want to do first?
                    </h2>
                    <div className="mt-6 grid gap-2">
                      {goals.map((goal) => {
                        const GoalIcon = goal.icon;
                        return (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => setSelectedGoal(goal.id)}
                            className="group flex items-center gap-3 border border-[#27272A] bg-[#131313] p-3 text-left transition-colors hover:border-[#10B981]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#27272A] text-zinc-400 transition-colors group-hover:text-white" style={{ color: goal.accent }}>
                              <GoalIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-white">{goal.label}</span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">{goal.description}</span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-[#10B981]" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setSelectedGoal(null)} className="font-technical text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]">
                      Back to choices
                    </button>
                    <div className="mt-6 flex h-12 w-12 items-center justify-center border" style={{ color: selected.accent, borderColor: `${selected.accent}55`, backgroundColor: `${selected.accent}12` }}>
                      {SelectedIcon && <SelectedIcon className="h-5 w-5" />}
                    </div>
                    <p className="mt-6 font-technical text-[10px] uppercase tracking-[0.2em] text-zinc-500">Your first action</p>
                    <h2 id="workspace-onboarding-title" className="mt-3 text-2xl font-semibold tracking-tight text-white">{selected.label}</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">{selected.detail}</p>
                    <button
                      type="button"
                      onClick={completeGoal}
                      className="mt-8 inline-flex h-11 items-center gap-2 bg-[#10B981] px-5 font-technical text-xs font-semibold uppercase tracking-wider text-[#0E0E0E] transition-colors hover:bg-[#34D399] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {selected.action}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <p className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
                      <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
                      You can reopen this guide anytime from the help button.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
