"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown, Check, Circle, Edit, Trash2, Plus, MinusCircle } from "lucide-react";
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

const statusConfig = {
  TODO: { icon: Circle, class: "border-2 border-zinc-600 text-transparent" },
  IN_PROGRESS: { icon: MinusCircle, class: "border-2 border-yellow-500 text-yellow-500" },
  DONE: { icon: Check, class: "bg-primary text-white border-primary" },
};

const priorityClasses = {
  HIGH: "text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400",
  MEDIUM: "text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400",
  LOW: "text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400",
};

export default function TaskItem({ task, depth, onEdit, onDelete, onAddSubtask }: TaskItemProps) {
  const { taskChildrenMap, loadedParents, fetchTaskChildren, optimisticPatchTask, setCurrentFocusedTaskId, currentFocusedTaskId } = useWorkspaceStore();
  const [expanded, setExpanded] = useState(false);
  const children = taskChildrenMap[task.id] ?? [];
  const isLoaded = loadedParents[task.id];
  const hasChildren = children.length > 0;

  const handleExpand = async () => {
    if (!expanded && !isLoaded) await fetchTaskChildren(task.id);
    setExpanded(!expanded);
  };

  const cycleStatus = () => {
    const order: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    optimisticPatchTask(task.id, { status: next });
  };

  const StatusIcon = statusConfig[task.status].icon;

  return (
    <div className="group">
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer ${currentFocusedTaskId === task.id ? "bg-white/10" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setCurrentFocusedTaskId(task.id)}
      >
        <button type="button" onClick={(e) => { e.stopPropagation(); void handleExpand(); }} className="w-6 h-6 flex items-center justify-center">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-4" />}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); cycleStatus(); }} className="w-5 h-5 flex items-center justify-center">
          <StatusIcon className={`w-4 h-4 ${statusConfig[task.status].class}`} />
        </button>
        <span className={`flex-1 text-sm ${task.status === "DONE" ? "line-through text-zinc-500" : "text-slate-300"}`}>
          {task.title}
        </span>
        {task.priority && <span className={priorityClasses[task.priority]}>{task.priority}</span>}
        {task.assignee && <span className="text-xs text-zinc-400">@{task.assignee}</span>}
        {task.dueDate && <span className="text-xs text-zinc-500">{new Date(task.dueDate).toLocaleDateString()}</span>}
        <div className="hidden group-hover:flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(task); }}><Edit size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}><Trash2 size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onAddSubtask(task.id); }}><Plus size={12} /></Button>
        </div>
      </div>
      {expanded && children.map((child) => (
        <TaskItem key={child.id} task={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddSubtask={onAddSubtask} />
      ))}
    </div>
  );
}
