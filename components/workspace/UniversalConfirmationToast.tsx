"use client";

import { useWorkspaceStore } from "@/lib/store";
import { adjustCursorPosition, applySuggestionPadding } from "@/lib/utils";
import * as Diff from "diff";
import { useEffect, useState } from "react";

export default function UniversalConfirmationToast() {
  const { pendingMutation, confirmMutation, discardMutation, undoLastMutation, lastConfirmedMutation, isChatOpen } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (pendingMutation) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [pendingMutation]);

  if (!isOpen || !pendingMutation) return null;

  let title = "AI SUGGESTION READY";
  let summary = "";

  if (pendingMutation.type === "update_note") {
    title = "AI SUGGESTION READY";
    const guardPos = adjustCursorPosition(
      pendingMutation.originalContent,
      pendingMutation.diff.cursor_position
    );
    const { paddedSuggestion, adjustedPos } = applySuggestionPadding(
      pendingMutation.originalContent,
      guardPos,
      pendingMutation.diff.content_to_insert
    );
    const diffs = Diff.diffWordsWithSpace(
      pendingMutation.originalContent,
      pendingMutation.originalContent.slice(0, adjustedPos) +
        paddedSuggestion +
        pendingMutation.originalContent.slice(adjustedPos)
    );
    let insertions = 0;
    let deletions = 0;
    diffs.forEach((part) => {
      if (part.added) insertions++;
      if (part.removed) deletions++;
    });
    summary = `Review ${insertions} insertions and ${deletions} deletions`;
  } else if (pendingMutation.type === "add_stack_row") {
    title = "AI DATA READY";
    summary = "Review 1 proposed row addition";
  } else if (pendingMutation.type === "bulk_update_stack") {
    title = "AI DATA READY";
    summary = `Review ${pendingMutation.updates.length} proposed row updates`;
  } else if (pendingMutation.type === "create_task") {
    title = "AI TASK READY";
    summary = `Review proposed task: "${pendingMutation.data.title}"`;
  } else if (pendingMutation.type === "create_calendar_event") {
    title = "AI EVENT READY";
    summary = `Review proposed calendar event: "${pendingMutation.data.title}"`;
  } else if (pendingMutation.type === "create_note") {
    title = "AI NOTE READY";
    const preview = pendingMutation.data.content?.slice(0, 120) || "";
    summary = `"${pendingMutation.data.title}"\n${preview}${preview.length >= 120 ? "…" : ""}`;
  } else if (pendingMutation.type === "manage_tasks") {
    title = "AI TASK READY";
    const actionStr = pendingMutation.action === "create" ? "creation" : pendingMutation.action === "update" ? "update" : "deletion";
    summary = `Review proposed task ${actionStr}: "${pendingMutation.data?.title || "Untitled"}"`;
  }

  const rightOffset = isChatOpen ? "right-[344px] md:right-[408px]" : "right-6";

  return (
    <div className={`fixed z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 transition-all ${
      rightOffset
    }`}
      style={{ bottom: "calc(6rem + 4px)" }}>
      <div className="w-[350px] bg-[#131313] border border-[#27272A] rounded-sm p-4 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
          </span>
          <span className="text-xs font-semibold text-[#10B981] font-mono tracking-wider">
            {title}
          </span>
        </div>

        {/* Summary Text */}
        <p className="text-sm text-[#A1A1AA] leading-snug">
          {summary}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => confirmMutation()}
            className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 text-[#0E0E0E] text-xs font-semibold py-2 px-3 rounded-sm transition-colors uppercase tracking-wider"
          >
            Accept
          </button>
          <button
            onClick={() => discardMutation()}
            className="flex-1 border border-[#27272A] text-white hover:bg-[#EF44441A] text-xs font-semibold py-2 px-3 rounded-sm transition-colors uppercase tracking-wider"
          >
            Discard
          </button>
        </div>
      </div>

      {/* Undo toast — shown after confirming a mutation */}
      {lastConfirmedMutation && (
        <div className="mt-2 w-[350px] bg-[#131313] border border-[#27272A] rounded-sm p-3 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center justify-between">
          <span className="text-xs text-zinc-400">Change applied.</span>
          <button
            onClick={() => undoLastMutation()}
            className="text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 uppercase tracking-wider transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
