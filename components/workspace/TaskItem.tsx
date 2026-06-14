"use client";
import React, { useState } from "react";
import { ChevronRight, ChevronDown, Edit, Trash2, Plus, FileText } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { Task, TaskStatus } from "@/lib/slices/tasksSlice";
import { Button } from "@/components/ui/button";

interface TaskItemProps {
  task: Task;
  depth: number;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parentId: string) => void;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TaskItem({ task, depth, onEdit, onDelete, onAddSubtask }: TaskItemProps) {
  const { taskChildrenMap, loadedParents, fetchTaskChildren, optimisticPatchTask, setCurrentFocusedTaskId, currentFocusedTaskId } = useWorkspaceStore();
  const [expanded, setExpanded] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const children = taskChildrenMap[task.id] ?? [];
  const isLoaded = loadedParents[task.id];
  const hasChildren = children.length > 0;
  const hasDescription = task.description && task.description.trim().length > 0;

  const handleExpand = async () => {
    if (!expanded && !isLoaded) await fetchTaskChildren(task.id);
    setExpanded(!expanded);
  };

  const cycleStatus = () => {
    const order: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    optimisticPatchTask(task.id, { status: next });
  };

  const isFocused = currentFocusedTaskId === task.id;

  return (
    <div className="group w-full">
      {/* Row container */}
      <div
        className={`flex items-center py-2.5 px-3 border-l-2 cursor-pointer transition-all duration-100 ${
          isFocused ? "bg-white/5 border-l-[#10B981]" : "border-l-transparent hover:bg-white/5"
        }`}
        onClick={() => setCurrentFocusedTaskId(task.id)}
      >
        {/* Column 1: Task Identity (flex-1) */}
        <div 
          className="flex-1 min-w-0 flex items-center gap-3 pr-4"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {/* Depth Tree Connector Indicator */}
          {depth > 0 && (
            <span className="text-zinc-600 font-technical text-xs flex-shrink-0 mr-1 select-none">
              ↳
            </span>
          )}

          {/* Chevron Expand Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleExpand();
            }}
            className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors flex-shrink-0"
          >
            {hasChildren ? (
              expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-3.5" />
            )}
          </button>

          {/* Task Info (Title, ID, and description toggle) */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-sm truncate select-none ${
                  task.status === "DONE"
                    ? "line-through text-emerald-500/80 font-medium"
                    : "text-zinc-200 font-semibold"
                }`}
              >
                {task.title}
              </span>
              {/* Description toggle button */}
              {hasDescription && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDescription(!showDescription);
                  }}
                  title={showDescription ? "Hide description" : "Show description"}
                  className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm transition-colors ${
                    showDescription
                      ? "text-[#10B981] bg-[#10B981]/10"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <FileText size={10} />
                </button>
              )}
            </div>
            <span className="text-[9px] text-zinc-500 font-technical tracking-wider uppercase mt-0.5 select-none">
              LI-{task.id.slice(0, 4).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Column 2: Status Badge (w-28) */}
        <div className="w-28 flex justify-center flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cycleStatus();
            }}
            className={`text-[9px] font-technical px-2 py-0.5 border font-bold uppercase transition-all rounded-none select-none tracking-wider ${
              task.status === "TODO"
                ? "border-[#27272A] text-zinc-500 bg-transparent hover:border-zinc-400"
                : task.status === "IN_PROGRESS"
                ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5"
                : "border-[#10B981] text-[#10B981] bg-[#10B981]/15"
            }`}
          >
            {task.status.replace("_", " ")}
          </button>
        </div>

        {/* Column 3: Priority Badge (w-24) */}
        <div className="w-24 flex justify-center flex-shrink-0">
          {task.priority === "HIGH" ? (
            <span className="text-[9px] font-technical px-2 py-0.5 border border-[#EF4444] text-[#EF4444] bg-[#EF4444]/10 font-bold uppercase tracking-wider select-none shadow-[0_0_8px_rgba(239,68,68,0.15)] animate-pulse">
              CRITICAL
            </span>
          ) : task.priority === "MEDIUM" ? (
            <span className="text-[9px] font-technical px-2 py-0.5 border border-[#10B981] text-[#10B981] bg-[#10B981]/10 font-bold uppercase tracking-wider select-none">
              MEDIUM
            </span>
          ) : (
            <span className="text-[9px] font-technical px-2 py-0.5 border border-[#27272A] text-zinc-500 bg-transparent font-medium uppercase tracking-wider select-none">
              LOW
            </span>
          )}
        </div>

        {/* Column 4: Due Date (w-24) */}
        <div className="w-24 flex justify-center flex-shrink-0">
          <span
            className={`text-[9px] font-technical uppercase tracking-wider select-none ${
              !task.dueDate
                ? "text-zinc-600"
                : task.status === "DONE"
                ? "text-[#10B981]"
                : new Date(task.dueDate).getTime() < Date.now()
                ? "text-[#EF4444]"
                : "text-zinc-400"
            }`}
          >
            {formatDueDate(task.dueDate)}
          </span>
        </div>

        {/* Column 5: Actions (w-20) — visible on hover */}
        <div className="w-20 flex justify-center flex-shrink-0">
          <div className="hidden group-hover:flex items-center gap-0.5 bg-[#131313] border border-[#27272A] p-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-none hover:bg-white/5 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              title="Edit Task"
            >
              <Edit size={11} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-none hover:bg-white/5 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtask(task.id);
              }}
              title="Add Subtask"
            >
              <Plus size={11} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-none hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              title="Delete Task"
            >
              <Trash2 size={11} />
            </Button>
          </div>
        </div>
      </div>

      {/* Description expandable area */}
      {showDescription && hasDescription && (
        <div
          className="px-3 py-2.5 bg-[#0A0A0A] border-b border-[#27272A]"
          style={{ paddingLeft: `${depth * 20 + 48}px` }}
        >
          <p className="text-xs text-zinc-400 font-sans leading-relaxed whitespace-pre-wrap break-words">
            {task.description}
          </p>
        </div>
      )}

      {/* Children list */}
      {expanded && children.map((child) => (
        <TaskItem
          key={child.id}
          task={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
        />
      ))}
    </div>
  );
}
