"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { TASKS_TAB_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import TaskItem from "@/components/workspace/TaskItem";
import TaskDialog from "@/components/workspace/TaskDialog";
import { Task, TaskStatus } from "@/lib/slices/tasksSlice";
import { toast } from "react-hot-toast";
import { Plus, Users, BarChart3, Terminal } from "lucide-react";

type TaskFormData = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee: string;
  dueDate: string;
};

function dueDateToApi(dueDate: string): string | null {
  if (!dueDate) return null;
  return new Date(`${dueDate}T00:00:00.000Z`).toISOString();
}

export default function TasksPage() {
  const { tasks, setTasks, openTab, optimisticCreateTask, optimisticPatchTask, optimisticDeleteTask } = useWorkspaceStore();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);

  useEffect(() => {
    openTab(TASKS_TAB_ID, "TASKS", "Tasks");
    fetch("/api/tasks", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<Task[]>;
      })
      .then(setTasks)
      .catch(() => toast.error("Failed to load tasks"));
  }, [openTab, setTasks]);

  const visibleTasks = useMemo(() => {
    return filterStatus === "ALL" ? tasks : tasks.filter((t) => t.status === filterStatus);
  }, [tasks, filterStatus]);

  const handleCreate = (data: TaskFormData) => {
    optimisticCreateTask({
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee || null,
      dueDate: dueDateToApi(data.dueDate),
      parentId: parentIdForNew,
    });
    setDialogOpen(false);
    setParentIdForNew(null);
  };

  const handleUpdate = (id: string, data: TaskFormData) => {
    optimisticPatchTask(id, {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee || null,
      dueDate: dueDateToApi(data.dueDate),
    });
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this task and all its subtasks?")) {
      optimisticDeleteTask(id);
    }
  };

  const openNewTask = () => {
    setEditingTask(null);
    setParentIdForNew(null);
    setDialogOpen(true);
  };

  return (
    <div className="h-full w-full bg-[#0E0E0E] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
      <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex justify-between items-start pb-4 border-b border-[#27272A]">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold uppercase tracking-tight text-white font-technical">
              Sprint Task Execution
            </h1>
            <p className="text-xs text-zinc-400 font-sans max-w-xl leading-relaxed">
              High-utility task management focused on engineering excellence and flow-state productivity. All dependencies are active.
            </p>
          </div>

          {/* Technical Status Widget */}
          <div className="flex gap-4 border border-[#27272A] bg-[#131313] px-4 py-2 text-right">
            <div className="space-y-0.5">
              <div className="text-[8px] font-technical uppercase tracking-wider text-zinc-500">
                Efficiency
              </div>
              <div className="text-sm font-semibold text-[#10B981] font-technical">
                94.2%
              </div>
            </div>
            <div className="w-px bg-[#27272A] self-stretch"></div>
            <div className="space-y-0.5">
              <div className="text-[8px] font-technical uppercase tracking-wider text-zinc-500">
                Remaining
              </div>
              <div className="text-sm font-semibold text-white font-technical">
                12h 40m
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Add Button */}
        <div className="flex justify-between items-center">
          <div className="flex gap-1.5 bg-[#131313] p-1 border border-[#27272A]">
            {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 font-technical text-[10px] uppercase font-bold transition-all rounded-none ${
                  filterStatus === status
                    ? "bg-white text-[#0E0E0E]"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
          <Button
            onClick={openNewTask}
            variant="technical"
            className="h-8 rounded-none text-xs uppercase font-bold"
          >
            <Plus className="h-4.5 w-4.5 mr-1" /> New Task
          </Button>
        </div>

        {/* Task List Header Row */}
        <div className="border border-[#27272A] bg-[#131313] overflow-hidden">
          <div className="py-2 px-3 border-b border-[#27272A] bg-[#1C1C1E] text-[10px] font-technical uppercase tracking-wider text-zinc-500 flex items-center">
            <div className="flex-1 pl-14">Task Identity</div>
            <div className="w-28 text-center">Status</div>
            <div className="w-24 text-center">Priority</div>
            <div className="w-20 text-center">Assignee</div>
          </div>

          {/* Task Items */}
          <div className="divide-y divide-[#27272A]">
            {visibleTasks.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 font-technical text-xs uppercase tracking-wider">
                No active tasks found in current sprint
              </div>
            ) : (
              visibleTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  depth={0}
                  onEdit={(t) => { setParentIdForNew(null); setEditingTask(t); setDialogOpen(true); }}
                  onDelete={handleDelete}
                  onAddSubtask={(parentId) => {
                    setEditingTask(null);
                    setParentIdForNew(parentId);
                    setDialogOpen(true);
                  }}
                />
              ))
            )}
          </div>

          {/* Dashed Add New Entry at the Bottom */}
          <button
            type="button"
            onClick={openNewTask}
            className="w-full py-3 bg-[#131313]/30 border-t border-[#27272A] border-dashed hover:bg-[#131313]/60 text-zinc-500 hover:text-white flex items-center justify-center gap-2 text-xs font-technical uppercase tracking-wider transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-[#10B981]" /> Add new entry at the bottom
          </button>
        </div>

        {/* Bottom Widgets Row */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Card 1: Collaborators */}
          <div className="border border-[#27272A] bg-[#131313] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-technical flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#10B981]" />
                Active Collaborators
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Real-time sync enabled for currently active task blocks.
              </p>
            </div>
            
            {/* Visual Overlapping Avatars */}
            <div className="flex items-center">
              {[
                { label: "HA", bg: "bg-emerald-500" },
                { label: "NH", bg: "bg-blue-500" },
                { label: "PA", bg: "bg-orange-500" },
              ].map((av, idx) => (
                <div
                  key={idx}
                  className={`h-7 w-7 rounded-full ${av.bg} text-[#0E0E0E] text-[10px] font-bold flex items-center justify-center border border-[#131313] -mr-2.5 last:mr-0 z-[${idx + 1}]`}
                >
                  {av.label}
                </div>
              ))}
              <div className="h-7 w-7 rounded-full bg-[#27272A] text-zinc-400 text-[9px] font-bold flex items-center justify-center border border-[#131313] ml-4 font-technical">
                +8
              </div>
            </div>
          </div>

          {/* Card 2: Velocity Trend */}
          <div className="border border-[#27272A] bg-[#131313] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-technical flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-[#10B981]" />
                  Velocity Trend
                </span>
                <span className="text-[9px] px-1.5 py-0.5 border border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981] font-semibold">
                  +24% vs last sprint
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Calculated completion rates of core pipelines.
              </p>
            </div>

            {/* Visual Bar Chart */}
            <div className="flex items-end gap-1.5 h-8 pt-1">
              {[12, 18, 10, 24, 32, 28, 40, 16].map((h, idx) => (
                <div
                  key={idx}
                  className={`w-3.5 rounded-none transition-all ${
                    idx === 4 || idx === 5 || idx === 6
                      ? "bg-[#10B981]"
                      : "bg-[#27272A]"
                  }`}
                  style={{ height: `${(h / 40) * 100}%` }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Command Palette Bar */}
        <div className="border border-[#27272A] bg-[#131313] p-3 flex items-center justify-between gap-3 text-zinc-500 font-technical text-xs hover:border-[#10B981]/40 transition-colors select-none">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-4 w-4 text-[#10B981]" />
            <span>Type &apos;/&apos; for commands (e.g. /subtask, /status, /assign)...</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-[#0E0E0E] px-1.5 py-0.5 border border-[#27272A] text-zinc-400 text-[10px] rounded-none">⌘</kbd>
            <kbd className="bg-[#0E0E0E] px-1.5 py-0.5 border border-[#27272A] text-zinc-400 text-[10px] rounded-none">K</kbd>
          </div>
        </div>

        {/* Dialog Panel */}
        <TaskDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingTask(null);
              setParentIdForNew(null);
            }
          }}
          task={editingTask}
          onSubmit={(data) => {
            if (editingTask) handleUpdate(editingTask.id, data);
            else handleCreate(data);
          }}
        />
      </div>
    </div>
  );
}
