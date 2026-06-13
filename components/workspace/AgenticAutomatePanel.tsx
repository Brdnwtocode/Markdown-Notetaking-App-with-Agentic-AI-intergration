"use client";

// AgenticAutomatePanel.tsx
//
// Right sidebar panel for the Records workstation.
// Contains the "Agentic Automate" trigger button (high-priority, Emerald
// glow) and action items for cross-module orchestration.
//
// Actions:
//   - Summarize to Note   → creates a Note from transcript
//   - Extract Tasks       → parses transcript into Task items
//   - Populate Stack      → maps transcript data into a Stack
//   - Identify Speakers   → speaker diarization
//   - Create Calendar     → extracts date/time into Calendar events

import { useState, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";
import {
  Sparkles,
  FileText,
  CheckSquare,
  Table2,
  Users,
  CalendarDays,
  Loader2,
  ChevronRight,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

interface AgenticAutomatePanelProps {
  recordingId: string;
  transcript: string;
  hasRecording: boolean;
  /** Audio blob to forward to FastAPI for processing (diarization, own STT, etc.) */
  audioBlob?: Blob | null;
}

type ActionName =
  | "summarize"
  | "extractTasks"
  | "populateStack"
  | "identifySpeakers"
  | "createCalendar"
  | "fullAutomate";

export default function AgenticAutomatePanel({
  recordingId,
  transcript,
  hasRecording,
  audioBlob,
}: AgenticAutomatePanelProps) {
  const {
    automateLoading,
    automateResult,
    setAutomateLoading,
    setAutomateResult,
    stageMutation,
  } = useWorkspaceStore();

  const [activeAction, setActiveAction] = useState<ActionName | null>(null);

  // ─── Call Agentic Automate API ──────────────────────────────────────────
  const runAutomate = useCallback(
    async (action: ActionName) => {
      if (!transcript.trim() && !audioBlob) {
        toast.error("No transcript or audio to process");
        return;
      }

      setActiveAction(action);
      setAutomateLoading(true);

      try {
        // Send as FormData so the audio blob reaches FastAPI directly
        const formData = new FormData();
        formData.append("transcript", transcript);
        formData.append("recordingId", recordingId);
        formData.append("action", action);
        if (audioBlob && audioBlob.size > 0) {
          formData.append("audio", audioBlob, "recording.webm");
        }

        const res = await fetch("/api/records/automate", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Automate failed");
        }

        const result = await res.json();
        setAutomateResult(result);
        setActiveAction(null);

        // Stage mutations for user confirmation (suggestion-only pattern)
        if (result.noteMutation) {
          stageMutation({
            type: "update_note",
            noteId: "",
            originalContent: "",
            diff: {
              action_type: "append",
              content_to_insert: `# ${result.noteMutation.title}\n\n${result.noteMutation.content}`,
              cursor_position: 0,
            },
          });
          toast.success("Note suggestion ready for review");
        }

        if (result.taskMutations?.length > 0) {
          result.taskMutations.forEach((task: any) => {
            stageMutation({
              type: "create_task",
              data: {
                title: task.title,
                description: task.description,
                status: task.status || "TODO",
                priority: task.priority || "MEDIUM",
                assignee: task.assignee,
                dueDate: task.dueDate,
              },
            });
          });
          toast.success(`${result.taskMutations.length} task(s) ready for review`);
        }

        if (result.calendarMutation) {
          stageMutation({
            type: "create_calendar_event",
            data: {
              title: result.calendarMutation.title,
              notes: result.calendarMutation.notes,
              startAt: result.calendarMutation.startAt,
              endAt: result.calendarMutation.endAt,
              allDay: result.calendarMutation.allDay,
            },
          });
          toast.success("Calendar event ready for review");
        }

        if (!result.noteMutation && !result.taskMutations?.length && !result.calendarMutation) {
          toast(result.summary || "Agentic Automate completed — no mutations generated", {
            icon: "🤖",
          });
        }
      } catch (err: any) {
        toast.error(err.message || "Agentic Automate failed");
        console.error("[AgenticAutomate] Error:", err);
      } finally {
        setAutomateLoading(false);
      }
    },
    [transcript, recordingId, audioBlob, setAutomateLoading, setAutomateResult, stageMutation],
  );

  const isDisabled = !hasRecording || (!transcript.trim() && !audioBlob);

  const actions: {
    id: ActionName;
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      id: "summarize",
      label: "Summarize to Note",
      icon: FileText,
      desc: "Generate a markdown note from transcript",
    },
    {
      id: "extractTasks",
      label: "Extract Tasks",
      icon: CheckSquare,
      desc: "Parse action items into task list",
    },
    {
      id: "populateStack",
      label: "Populate Stack",
      icon: Table2,
      desc: "Map transcript data into a structured stack",
    },
    {
      id: "identifySpeakers",
      label: "Identify Speakers",
      icon: Users,
      desc: "Label speakers via diarization",
    },
    {
      id: "createCalendar",
      label: "Create Calendar Event",
      icon: CalendarDays,
      desc: "Extract date/time into calendar",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-[#27272A]">
        <h3 className="text-xs font-semibold tracking-widest text-zinc-500 font-mono uppercase flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-[#10B981]" />
          Agentic Automate
        </h3>
      </div>

      {/* ─── Priority Trigger ────────────────────────────────────────── */}
      <div className="p-3">
        <button
          type="button"
          disabled={isDisabled || automateLoading}
          onClick={() => runAutomate("fullAutomate")}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3
            text-sm font-semibold font-mono uppercase tracking-wider
            border-2 rounded-sm transition-all duration-200
            ${
              isDisabled
                ? "border-[#27272A] text-zinc-600 bg-[#0E0E0E] cursor-not-allowed"
                : "border-[#10B981] text-[#10B981] bg-[#0E0E0E] hover:bg-[#10B981] hover:text-[#0E0E0E] shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            }
          `}
        >
          {automateLoading && activeAction === "fullAutomate" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {automateLoading && activeAction === "fullAutomate"
            ? "PROCESSING..."
            : "RUN AUTOMATE"}
        </button>
        <p className="text-[10px] text-zinc-600 font-mono mt-1.5 text-center">
          Cross-module AI orchestration
        </p>
      </div>

      {/* ─── Divider ──────────────────────────────────────────────────── */}
      <div className="border-t border-[#27272A] mx-3" />

      {/* ─── Action Items ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {actions.map((action) => {
          const isLoading = automateLoading && activeAction === action.id;
          return (
            <button
              key={action.id}
              type="button"
              disabled={isDisabled || automateLoading}
              onClick={() => runAutomate(action.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-left
                rounded-sm border border-transparent
                transition-all duration-150 group
                ${
                  isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-[#131313] hover:border-[#27272A]"
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 text-[#10B981] animate-spin shrink-0" />
              ) : (
                <action.icon className="h-4 w-4 text-zinc-500 group-hover:text-[#10B981] shrink-0 transition-colors" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                  {action.label}
                </div>
                <div className="text-[10px] text-zinc-600 font-mono truncate">
                  {action.desc}
                </div>
              </div>
              <ChevronRight className="h-3 w-3 text-zinc-700 group-hover:text-[#10B981] shrink-0 transition-colors" />
            </button>
          );
        })}
      </div>

      {/* ─── Result Preview ───────────────────────────────────────────── */}
      {automateResult && (
        <div className="border-t border-[#27272A] p-3">
          <div className="text-[10px] font-mono font-semibold text-[#10B981] uppercase tracking-wider mb-2">
            Last Result
          </div>
          <div className="space-y-1 text-[10px] font-mono text-zinc-500">
            {automateResult.noteMutation && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-[#10B981]" />
                Note: {automateResult.noteMutation.title}
              </div>
            )}
            {automateResult.taskMutations && automateResult.taskMutations.length > 0 && (
              <div className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3 text-[#10B981]" />
                Tasks: {automateResult.taskMutations.length} extracted
              </div>
            )}
            {automateResult.stackMutation && (
              <div className="flex items-center gap-1">
                <Table2 className="h-3 w-3 text-[#10B981]" />
                Stack populated
              </div>
            )}
            {automateResult.calendarMutation && (
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-[#10B981]" />
                Event: {automateResult.calendarMutation.title}
              </div>
            )}
            {automateResult.summary && (
              <div className="mt-1 text-zinc-400 leading-relaxed line-clamp-3">
                {automateResult.summary}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
