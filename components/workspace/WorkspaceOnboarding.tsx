"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Mic,
  X,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";

const STORAGE_KEY = "lock-in:workspace-onboarding-v3-complete";

type GoalId = "capture" | "organize" | "plan" | "voice";

const goals: Array<{
  id: GoalId;
  label: string;
  description: string;
  icon: typeof FileText;
  accent: string;
}> = [
  { id: "capture", label: "Capture an idea", description: "Create a real note and get it out of your head.", icon: FileText, accent: "#10B981" },
  { id: "organize", label: "Organize my work", description: "See how Explorer keeps related work together.", icon: FolderOpen, accent: "#60A5FA" },
  { id: "plan", label: "Turn notes into action", description: "Use the AI companion to find a useful next step.", icon: MessageSquare, accent: "#FBBF24" },
  { id: "voice", label: "Capture by voice", description: "Record a thought now and refine it later.", icon: Mic, accent: "#F472B6" },
];

const guidance: Record<GoalId, { title: string; body: string; action: string; example: string }> = {
  capture: {
    title: "Let us make your first note",
    body: "Give the idea a name. We will create the real Markdown note and take you straight into it.",
    action: "Create my first note",
    example: "A note you can edit, search, and give to the AI companion.",
  },
  organize: {
    title: "Your Explorer is the map",
    body: "Start Here contains examples, but your workspace is yours to shape. Open the Explorer, then create a folder for the work that matters now.",
    action: "Open Explorer",
    example: "Folders keep notes, stacks, records, and files close to their project.",
  },
  plan: {
    title: "Make one idea actionable",
    body: "Open the AI companion after you have a note selected. Ask for a summary, a decision, or the next three actions.",
    action: "Open AI companion",
    example: "Try: Summarize this note and suggest my next action.",
  },
  voice: {
    title: "Capture while your hands are busy",
    body: "Push to talk is built for rough capture. Record first, then return to the transcript when you have time to refine it.",
    action: "Show me the recorder",
    example: "A short recording becomes a searchable starting point for your work.",
  },
};

export default function WorkspaceOnboarding() {
  const router = useRouter();
  const setIsChatOpen = useWorkspaceStore((state) => state.setIsChatOpen);
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState<GoalId | null>(null);
  const [noteTitle, setNoteTitle] = useState("My first idea");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsOpen(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  const finish = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  const open = () => {
    setGoal(null);
    setError("");
    setIsOpen(true);
  };

  const createFirstNote = async () => {
    if (!noteTitle.trim()) {
      setError("Give your note a name first.");
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle.trim(),
          content: "# " + noteTitle.trim() + "\n\nStart here. What do you want to remember?",
        }),
      });
      if (!response.ok) throw new Error("Could not create note");
      const note = await response.json();
      finish();
      router.push(`/workspace/notes/${note.id}`);
    } catch {
      setError("The note could not be created. Check your connection and try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const runGoalAction = () => {
    if (goal === "capture") return void createFirstNote();
    if (goal === "plan") {
      setIsChatOpen(true);
      finish();
      return;
    }
    finish();
  };

  const selectedGoal = goal ? goals.find((item) => item.id === goal) : null;
  const selectedGuidance = goal ? guidance[goal] : null;
  const GoalIcon = selectedGoal?.icon ?? Lightbulb;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Open onboarding guide"
        title="Open onboarding guide"
        className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center border border-[#27272A] bg-[#131313] text-zinc-400 shadow-lg transition-colors hover:border-[#10B981]/60 hover:text-[#10B981]"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <div className="relative w-full max-w-2xl overflow-hidden border border-[#27272A] bg-[#0E0E0E] shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#10B981]" />
            <button type="button" onClick={finish} aria-label="Close onboarding guide" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]">
              <X className="h-4 w-4" />
            </button>

            {!goal ? (
              <div className="p-6 sm:p-9">
                <p className="font-technical text-[10px] uppercase tracking-[0.22em] text-[#10B981]">Lock In / first session</p>
                <h2 id="onboarding-title" className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-white">What would make this workspace useful today?</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">Pick one starting point. We will help you complete it, then leave the rest of the workspace ready when you need it.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {goals.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} type="button" onClick={() => setGoal(item.id)} className="group flex min-h-28 items-start gap-4 border border-[#27272A] bg-[#131313] p-4 text-left transition-colors hover:border-[#10B981]/60 hover:bg-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ color: item.accent, borderColor: `${item.accent}55`, backgroundColor: `${item.accent}12` }}><Icon className="h-4 w-4" /></span>
                        <span><span className="block text-sm font-medium text-white">{item.label}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{item.description}</span></span>
                        <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-[#10B981]" />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-8 flex items-center gap-2 text-xs text-zinc-500"><Lightbulb className="h-4 w-4 text-[#10B981]" /> You can reopen this guide from the help button anytime.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-[0.8fr_1.2fr]">
                <div className="border-b border-[#27272A] bg-[#131313] p-6 md:border-b-0 md:border-r md:p-8">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center border border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]"><GoalIcon className="h-4 w-4" /></span><span className="font-technical text-[10px] uppercase tracking-wider text-zinc-500">Your first outcome</span></div>
                  <div className="mt-10 border border-[#27272A] bg-[#0E0E0E] p-4"><p className="font-technical text-[10px] uppercase tracking-wider text-[#10B981]">{selectedGoal?.label}</p><p className="mt-3 text-sm leading-6 text-zinc-300">{selectedGuidance?.example}</p><div className="mt-6 h-1 bg-[#27272A]"><div className="h-1 w-1/2 bg-[#10B981]" /></div><p className="mt-3 font-technical text-[10px] text-zinc-600">ONE USEFUL RESULT</p></div>
                  <p className="mt-6 text-xs leading-5 text-zinc-500">You do not need to learn everything today. Finish this one small action and the rest will make more sense.</p>
                </div>
                <div className="p-6 sm:p-8">
                  <button type="button" onClick={() => setGoal(null)} className="mb-7 inline-flex items-center gap-2 font-technical text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"><ArrowLeft className="h-3 w-3" /> Change goal</button>
                  <p className="font-technical text-[10px] uppercase tracking-[0.2em] text-zinc-500">{selectedGoal?.label}</p>
                  <h2 id="onboarding-title" className="mt-3 text-2xl font-semibold tracking-tight text-white">{selectedGuidance?.title}</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">{selectedGuidance?.body}</p>
                  {goal === "capture" && <label className="mt-7 block text-xs text-zinc-400">Name your first note<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} className="mt-2 h-11 w-full border border-[#27272A] bg-[#131313] px-3 text-sm text-white outline-none focus:border-[#10B981]" autoFocus /></label>}
                  {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
                  <div className="mt-8 flex items-center justify-between gap-4"><button type="button" onClick={finish} className="font-technical text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white">Skip for now</button><button type="button" onClick={runGoalAction} disabled={isCreating} className="inline-flex h-11 items-center gap-2 bg-[#10B981] px-4 font-technical text-xs font-semibold uppercase tracking-wider text-[#0E0E0E] hover:bg-[#34D399] disabled:opacity-60">{isCreating ? "Creating..." : selectedGuidance?.action}{goal === "capture" ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</button></div>
                  <p className="mt-6 text-right text-xs text-zinc-600">One step, then you are free to explore.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
