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
  AudioWaveform,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toast } from "@/lib/toast";

interface AgenticAutomatePanelProps {
  recordingId: string;
  transcript: string;
  hasRecording: boolean;
  /** Pre-resolved audio blob (pending/local — immediately available).
   *  Used for the disabled check; the async getter below handles the full resolution. */
  immediateAudioBlob?: Blob | null;
  /** Whether the active recording has audio stored in S3 (async fetch).
   *  When true the disabled check loosens — audio is available, just not synchronous. */
  hasS3Audio?: boolean;
  /** Async resolver that fetches audio from S3 for saved recordings if needed.
   *  Called at action-click time so we don't pre-download large files. */
  getAudioBlob: () => Promise<Blob | null>;
}

type ActionName =
  | "summarize"
  | "extract_tasks"
  | "populate_stack"
  | "identify_speakers"
  | "create_calendar"
  | "full_automate";

export default function AgenticAutomatePanel({
  recordingId,
  transcript,
  hasRecording,
  immediateAudioBlob,
  hasS3Audio = false,
  getAudioBlob,
}: AgenticAutomatePanelProps) {
  const {
    automateLoading,
    automateResult,
    setAutomateLoading,
    setAutomateResult,
    stageMutation,
  } = useWorkspaceStore();

  const [activeAction, setActiveAction] = useState<ActionName | null>(null);
  // Track async audio fetch state so the button stays responsive
  const [fetchingAudio, setFetchingAudio] = useState(false);
  // When true, send ONLY the audio blob to the agentic pipeline (ignore transcript)
  const [audioOnly, setAudioOnly] = useState(false);

  // ─── Call Agentic Automate API ──────────────────────────────────────────
  const runAutomate = useCallback(
    async (action: ActionName) => {
      // Resolve audio: use immediately-available blob (pending/local).
      // For saved recordings with S3 audio, skip — the BFF fetches server-side.
      setFetchingAudio(true);
      let audioBlob: Blob | null = immediateAudioBlob ?? null;
      try {
        if (!audioBlob && !hasS3Audio) {
          audioBlob = await getAudioBlob();
        }
      } catch (err) {
        console.error("[AgenticAutomate] Failed to fetch audio:", err);
      } finally {
        setFetchingAudio(false);
      }

      // Validate inputs. When hasS3Audio is true, audio exists server-side
      // so we only need transcript (or audioOnly + hasS3Audio is also fine).
      const audioAvailable = !!(audioBlob?.size) || hasS3Audio;
      if (audioOnly) {
        if (!audioAvailable) {
          toast.error("No audio available to process");
          return;
        }
      } else {
        if (!transcript.trim() && !audioAvailable) {
          toast.error("No transcript or audio to process");
          return;
        }
      }

      setActiveAction(action);
      setAutomateLoading(true);

      try {
        // Send as FormData so the audio blob reaches FastAPI directly
        const formData = new FormData();
        // In audio-only mode, skip the transcript so FastAPI runs STT itself
        if (!audioOnly) {
          formData.append("transcript", transcript);
        }
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

        // Update live transcript when Automate returns a new one (Cases 1, 3, 4)
        if (result.transcript) {
          const store = useWorkspaceStore.getState();
          store.setLiveTranscript(result.transcript);
          // Persist to DB row if this is a saved (non-temp) recording
          if (recordingId && !recordingId.startsWith("temp_")) {
            store.updateRecordingTranscript(recordingId, result.transcript);
          }
        }

        // Bundle ALL mutations into a single automate_results staging
        // (the store only holds one pendingMutation — this ensures nothing is lost)
        const hasNote = !!result.noteMutation;
        const hasTasks = (result.taskMutations?.length ?? 0) > 0;
        const hasCalendar = !!result.calendarMutation;

        if (hasNote || hasTasks || hasCalendar) {
          stageMutation({
            type: "automate_results",
            noteMutation: result.noteMutation ?? null,
            taskMutations: (result.taskMutations ?? []).map((t: any) => ({
              title: t.title ?? "",
              description: t.description ?? "",
              status: t.status ?? "TODO",
              priority: t.priority ?? "MEDIUM",
              assignee: t.assignee ?? null,
              dueDate: t.dueDate ?? t.due_date ?? null,
              parentId: t.parentId ?? t.parent_id ?? null,
            })),
            calendarMutation: result.calendarMutation ? {
              title: result.calendarMutation.title ?? "",
              notes: result.calendarMutation.notes ?? "",
              startAt: result.calendarMutation.startAt ?? result.calendarMutation.start_at ?? new Date().toISOString(),
              endAt: result.calendarMutation.endAt ?? result.calendarMutation.end_at ?? new Date().toISOString(),
              allDay: result.calendarMutation.allDay ?? result.calendarMutation.all_day ?? false,
              color: result.calendarMutation.color ?? "#5645d4",
            } : null,
            summary: result.summary ?? "",
          });

          // Show a unified toast summarizing what's ready for review
          const parts: string[] = [];
          if (hasNote) parts.push("Note");
          if (hasTasks) parts.push(`${result.taskMutations.length} task(s)`);
          if (hasCalendar) parts.push("Calendar event");
          toast.success(`${parts.join(" + ")} ready for review`);
        } else {
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
    [transcript, recordingId, immediateAudioBlob, getAudioBlob, audioOnly, hasS3Audio, setAutomateLoading, setAutomateResult, stageMutation],
  );

  // Button is disabled when there's no recording active, or when there's
  // neither transcript nor any audio (local or S3). S3 fetch happens on click.
  // In audio-only mode, only require a recording to exist — audio is resolved
  // asynchronously via getAudioBlob() and validated at click time.
  const hasAnyAudio = !!(immediateAudioBlob) || hasS3Audio;
  const isDisabled = audioOnly
    ? !hasRecording
    : (!hasRecording || (!transcript.trim() && !hasAnyAudio));

  const actions: {
    id: ActionName;
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      id: "summarize",
      label: "Summarize to Note",
      shortLabel: "Note",
      icon: FileText,
      desc: "Generate a markdown note from transcript",
    },
    {
      id: "extract_tasks",
      label: "Extract Tasks",
      shortLabel: "Tasks",
      icon: CheckSquare,
      desc: "Parse action items into task list",
    },
    {
      id: "populate_stack",
      label: "Populate Stack",
      shortLabel: "Stack",
      icon: Table2,
      desc: "Map transcript data into a structured stack",
    },
    {
      id: "identify_speakers",
      label: "Identify Speakers",
      shortLabel: "Speakers",
      icon: Users,
      desc: "Label speakers via diarization",
    },
    {
      id: "create_calendar",
      label: "Create Calendar Event",
      shortLabel: "Calendar",
      icon: CalendarDays,
      desc: "Extract date/time into calendar",
    },
  ];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* ─── RUN AUTOMATE trigger ──────────────────────────────────── */}
      <button
        type="button"
        disabled={isDisabled || automateLoading || fetchingAudio}
        onClick={() => runAutomate("full_automate")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold font-mono uppercase tracking-wider border transition-all duration-200 shrink-0 ${
          isDisabled
            ? "border-[#27272A] text-zinc-600 bg-transparent cursor-not-allowed"
            : "border-[#27272A] text-zinc-300 bg-transparent hover:border-[#10B981]/30 hover:text-[#10B981]"
        }`}
      >
        {automateLoading && activeAction === "full_automate" ? (
          <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
        ) : (
          <Sparkles className="h-3 w-3 text-[#10B981]/60" />
        )}
        {automateLoading && activeAction === "full_automate" ? "Processing…" : "Run Automate"}
      </button>

      {/* ─── Audio-only toggle ─────────────────────────────────────── */}
      <label
        title="When ON, sends only the raw audio to the AI pipeline — useful when STT transcript is wrong or in the wrong language"
        className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-mono cursor-pointer border transition-all shrink-0 select-none ${
          audioOnly
            ? "border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5"
            : "border-[#27272A] text-zinc-500 hover:border-zinc-600"
        }`}
      >
        <input
          type="checkbox"
          checked={audioOnly}
          onChange={(e) => setAudioOnly(e.target.checked)}
          className="sr-only"
        />
        <AudioWaveform className="h-3 w-3" />
        <span>Audio Only</span>
      </label>

      {/* ─── Action buttons ─────────────────────────────────────────── */}
      <span className="text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider shrink-0 select-none">Actions</span>
      {actions.map((action) => {
        const isLoading = automateLoading && activeAction === action.id;
        return (
          <button
            key={action.id}
            type="button"
            disabled={isDisabled || automateLoading || fetchingAudio}
            onClick={() => runAutomate(action.id)}
            title={action.desc}
            className={`flex items-center gap-1 py-1 text-[10px] font-mono transition-all duration-150 shrink-0 ${
              isDisabled
                ? "text-zinc-700 cursor-not-allowed"
                : "text-zinc-500 hover:text-[#10B981]"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
            ) : (
              <action.icon className="h-3 w-3" />
            )}
            <span>{action.shortLabel}</span>
          </button>
        );
      })}

      {/* ─── Results panel ────────────────────────────────────────── */}
      <AutomateResultsPanel result={automateResult} />
    </div>
  );
}

// ─── Results sub-component ──────────────────────────────────────────────────

function AutomateResultsPanel({ result }: { result: any }) {
  if (!result) return null;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasAny =
    !!result.summary ||
    !!result.noteMutation ||
    (result.taskMutations?.length ?? 0) > 0 ||
    !!result.calendarMutation ||
    !!result.stackMutation ||
    (result.speakerLabels?.length ?? 0) > 0;

  if (!hasAny) return null;

  return (
    <div className="w-full mt-2 space-y-2 text-[10px] font-mono">
      {/* ─── Summary ──────────────────────────────────────────────── */}
      {result.summary && (
        <div className="px-3 py-2 rounded-sm border border-[#10B981]/20 bg-[#10B981]/5 text-[#10B981]/80 leading-relaxed">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[#10B981]/50 mr-2">
            Summary
          </span>
          {result.summary}
        </div>
      )}

      {/* ─── Note ──────────────────────────────────────────────────── */}
      {result.noteMutation && (
        <CollapsibleSection
          icon={FileText}
          label="Note"
          title={(result.noteMutation as any).title || "Untitled"}
          expanded={!!expanded.note}
          onToggle={() => toggle("note")}
        >
          <pre className="text-zinc-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {(result.noteMutation as any).content?.slice(0, 500) || "(empty)"}
          </pre>
        </CollapsibleSection>
      )}

      {/* ─── Tasks ─────────────────────────────────────────────────── */}
      {result.taskMutations?.length > 0 && (
        <CollapsibleSection
          icon={CheckSquare}
          label="Tasks"
          title={`${result.taskMutations.length} extracted`}
          expanded={!!expanded.tasks}
          onToggle={() => toggle("tasks")}
        >
          <div className="space-y-2">
            {result.taskMutations.map((t: any, i: number) => (
              <div key={i} className="px-2 py-1.5 rounded-sm border border-[#27272A] bg-[#0E0E0E]">
                <div className="text-zinc-300 font-semibold">{t.title || "Untitled task"}</div>
                {t.description && (
                  <div className="text-zinc-500 mt-0.5">{t.description.slice(0, 200)}</div>
                )}
                <div className="flex gap-3 mt-1 text-[9px] text-zinc-600">
                  {t.status && <span>Status: {t.status}</span>}
                  {t.priority && <span>Priority: {t.priority}</span>}
                  {t.dueDate && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(t.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {t.assignee && <span>👤 {t.assignee}</span>}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Calendar ──────────────────────────────────────────────── */}
      {result.calendarMutation && (
        <CollapsibleSection
          icon={CalendarDays}
          label="Calendar"
          title={(result.calendarMutation as any).title || "Event"}
          expanded={!!expanded.calendar}
          onToggle={() => toggle("calendar")}
        >
          <div className="space-y-1 text-zinc-400">
            <div>
              <span className="text-zinc-600">Start:</span>{" "}
              {new Date((result.calendarMutation as any).startAt).toLocaleString()}
            </div>
            <div>
              <span className="text-zinc-600">End:</span>{" "}
              {new Date((result.calendarMutation as any).endAt).toLocaleString()}
            </div>
            {(result.calendarMutation as any).allDay && (
              <div className="text-zinc-500">All-day event</div>
            )}
            {(result.calendarMutation as any).notes && (
              <div className="text-zinc-500 mt-1">
                {(result.calendarMutation as any).notes.slice(0, 300)}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Speakers ──────────────────────────────────────────────── */}
      {result.speakerLabels?.length > 0 && (
        <CollapsibleSection
          icon={Users}
          label="Speakers"
          title={`${result.speakerLabels.length} identified`}
          expanded={!!expanded.speakers}
          onToggle={() => toggle("speakers")}
        >
          <div className="space-y-3">
            {result.speakerLabels.map((s: any, i: number) => (
              <div key={i}>
                <div className="text-[#10B981]/70 font-semibold mb-1">
                  {s.speaker || `Speaker ${i}`}
                </div>
                {s.segments?.map((seg: any, j: number) => (
                  <div
                    key={j}
                    className="pl-2 py-1 border-l-2 border-[#27272A] hover:border-[#10B981]/30 transition-colors mb-1"
                  >
                    <span className="text-zinc-600 text-[9px] mr-2">
                      {fmtTime(seg.start)} – {fmtTime(seg.end)}
                    </span>
                    <span className="text-zinc-400">{seg.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Stack ─────────────────────────────────────────────────── */}
      {result.stackMutation && (
        <CollapsibleSection
          icon={Table2}
          label="Stack"
          title={(result.stackMutation as any).stackName || "Stack"}
          expanded={!!expanded.stack}
          onToggle={() => toggle("stack")}
        >
          <pre className="text-zinc-500 text-[9px] whitespace-pre-wrap max-h-32 overflow-y-auto">
            {JSON.stringify(result.stackMutation, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ─── Reusable collapsible section ────────────────────────────────────────────

function CollapsibleSection({
  icon: Icon,
  label,
  title,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  label: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-[#27272A] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#131313] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
        )}
        <Icon className="h-3 w-3 text-[#10B981]/50 shrink-0" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
          {label}
        </span>
        <span className="text-zinc-400 truncate">{title}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-[#27272A] pt-2">{children}</div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
