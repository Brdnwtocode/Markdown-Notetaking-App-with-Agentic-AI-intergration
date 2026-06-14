"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { TASKS_TAB_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import TaskItem from "@/components/workspace/TaskItem";
import TaskDialog from "@/components/workspace/TaskDialog";
import { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";
import { toast } from "@/lib/toast";
import {
  Plus, Terminal, ArrowUpDown, Calendar, Flag,
  FileText, CheckCircle2, MoreHorizontal,
  PanelRightOpen, PanelRightClose, PieChart,
} from "lucide-react";

type TaskFormData = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee: string;
  dueDate: string;
};

type SortMethod = "dueDate" | "priority" | "default";

function dueDateToApi(dueDate: string): string | null {
  if (!dueDate) return null;
  return new Date(`${dueDate}T00:00:00.000Z`).toISOString();
}

/** Priority weight for sorting: HIGH=3, MEDIUM=2, LOW=1 */
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function sortTasks(tasks: Task[], method: SortMethod): Task[] {
  const sorted = [...tasks];
  switch (method) {
    case "dueDate":
      // Primary: due date (nulls last), Secondary: priority (high first)
      sorted.sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aDate !== bDate) return aDate - bDate;
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      });
      break;
    case "priority":
      // Primary: priority (high first), Secondary: due date (nulls last)
      sorted.sort((a, b) => {
        const pDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (pDiff !== 0) return pDiff;
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return aDate - bDate;
      });
      break;
    case "default":
    default:
      // Server order preserved (status → dueDate → createdAt)
      break;
  }
  return sorted;
}

export default function TasksPage() {
  const { tasks, setTasks, openTab, optimisticCreateTask, optimisticPatchTask, optimisticDeleteTask } = useWorkspaceStore();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [sortMethod, setSortMethod] = useState<SortMethod>("dueDate");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

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
    const filtered = filterStatus === "ALL" ? tasks : tasks.filter((t) => t.status === filterStatus);
    return sortTasks(filtered, sortMethod);
  }, [tasks, filterStatus, sortMethod]);

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

  // ── Analytics: status & priority counts ──
  const stats = useMemo(() => {
    const statusCounts = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    const priorityCounts: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    let overdue = 0;
    const now = Date.now();
    for (const t of tasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
      priorityCounts[t.priority] = (priorityCounts[t.priority] ?? 0) + 1;
      if (t.dueDate && t.status !== "DONE" && new Date(t.dueDate).getTime() < now) overdue++;
    }
    const total = tasks.length;
    const donePct = total > 0 ? Math.round((statusCounts.DONE / total) * 100) : 0;
    return { statusCounts, priorityCounts, total, donePct, overdue };
  }, [tasks]);

  const openNewTask = () => {
    setEditingTask(null);
    setParentIdForNew(null);
    setDialogOpen(true);
  };

  // ── Simple SVG donut segment helper ──
  const DonutSegment = ({ pct, color, offset }: { pct: number; color: string; offset: number }) => {
    if (pct <= 0) return null;
    const r = 36; const cx = 44; const cy = 44;
    const circumference = 2 * Math.PI * r;
    const dashLen = (pct / 100) * circumference;
    const dashOffset = circumference - (offset / 100) * circumference;
    return (
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
        strokeDashoffset={dashOffset}
        className="transition-all duration-500"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
    );
  };

  return (
    <div className="h-full w-full bg-[#0E0E0E] overflow-hidden flex">
      {/* ===== MAIN TASK PANEL (65%) ===== */}
      <div className={`flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 transition-all duration-300 ${sidePanelOpen ? "w-[65%]" : "w-full"}`}>
      <div className="px-6 py-6 flex flex-col gap-5 flex-1">
        
        {/* Header Section */}
        <div className="flex justify-between items-start pb-4 border-b border-[#27272A]">
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-tight text-white font-technical">
              Sprint Task Execution
            </h1>
            <p className="text-xs text-zinc-400 font-sans max-w-xl leading-relaxed">
              High-utility task management focused on engineering excellence and flow-state productivity.
            </p>
          </div>

          {/* Toggle side panel button */}
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            title={sidePanelOpen ? "Close analytics panel" : "Open analytics panel"}
            className="h-8 px-3 border border-[#27272A] bg-[#131313] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1.5 font-technical text-[10px] uppercase"
          >
            {sidePanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            {sidePanelOpen ? "Hide Analytics" : "Analytics"}
          </button>
        </div>

        {/* Filters, Sort Controls, and Add Button */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
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

            {/* Sort Controls */}
            <div className="flex gap-1 bg-[#131313] p-1 border border-[#27272A]">
              <span className="px-2 py-1 text-[9px] font-technical uppercase text-zinc-500 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Sort:
              </span>
              {([
                { value: "dueDate" as const, label: "Due Date", icon: Calendar },
                { value: "priority" as const, label: "Priority", icon: Flag },
                { value: "default" as const, label: "Default", icon: ArrowUpDown },
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSortMethod(value)}
                  title={
                    value === "dueDate"
                      ? "Sort by due date first, then priority"
                      : value === "priority"
                      ? "Sort by priority first, then due date"
                      : "Keep server/default order"
                  }
                  className={`px-2.5 py-1 font-technical text-[9px] uppercase font-bold transition-all rounded-none flex items-center gap-1 ${
                    sortMethod === value
                      ? "bg-white text-[#0E0E0E]"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
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
          <div className="py-2 px-3 border-b border-[#27272A] bg-[#1C1C1E] text-zinc-500 flex items-center">
            <div className="flex-1 pl-14 flex items-center gap-1.5" title="Task Identity">
              <FileText size={12} />
            </div>
            <div className="w-28 flex justify-center" title="Status">
              <CheckCircle2 size={12} />
            </div>
            <div className="w-24 flex justify-center" title="Priority">
              <Flag size={12} />
            </div>
            <div className="w-24 flex justify-center" title="Due Date">
              <Calendar size={12} />
            </div>
            <div className="w-20 flex justify-center" title="Actions">
              <MoreHorizontal size={12} />
            </div>
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

      {/* ===== TOGGLEABLE SIDE PANEL (35%) ===== */}
      {sidePanelOpen && (
        <div className="w-[35%] border-l border-[#27272A] bg-[#0A0A0A] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 flex-shrink-0">
          <div className="p-5 flex flex-col gap-5">

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#27272A] bg-[#131313] p-3 text-center">
                <div className="text-[9px] font-technical uppercase text-zinc-500 tracking-wider">Total Tasks</div>
                <div className="text-xl font-bold text-white font-technical mt-1">{stats.total}</div>
              </div>
              <div className="border border-[#27272A] bg-[#131313] p-3 text-center">
                <div className="text-[9px] font-technical uppercase text-zinc-500 tracking-wider">Completed</div>
                <div className="text-xl font-bold text-[#10B981] font-technical mt-1">{stats.donePct}%</div>
              </div>
              <div className="border border-[#27272A] bg-[#131313] p-3 text-center">
                <div className="text-[9px] font-technical uppercase text-zinc-500 tracking-wider">In Progress</div>
                <div className="text-xl font-bold text-[#F59E0B] font-technical mt-1">{stats.statusCounts.IN_PROGRESS}</div>
              </div>
              <div className="border border-[#27272A] bg-[#131313] p-3 text-center">
                <div className="text-[9px] font-technical uppercase text-zinc-500 tracking-wider">Overdue</div>
                <div className={`text-xl font-bold font-technical mt-1 ${stats.overdue > 0 ? "text-[#EF4444]" : "text-zinc-400"}`}>{stats.overdue}</div>
              </div>
            </div>

            {/* Donut: By Status */}
            <div className="border border-[#27272A] bg-[#131313] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <PieChart size={13} className="text-[#10B981]" />
                <span className="text-[10px] font-technical uppercase text-zinc-400 tracking-wider">By Status</span>
              </div>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 88 88" className="w-[88px] h-[88px] flex-shrink-0">
                  {(() => {
                    const segments = [
                      { pct: stats.total > 0 ? (stats.statusCounts.TODO / stats.total) * 100 : 0, color: "#52525B" },
                      { pct: stats.total > 0 ? (stats.statusCounts.IN_PROGRESS / stats.total) * 100 : 0, color: "#F59E0B" },
                      { pct: stats.total > 0 ? (stats.statusCounts.DONE / stats.total) * 100 : 0, color: "#10B981" },
                    ];
                    let offset = 0;
                    return segments.map((seg, i) => {
                      const el = <DonutSegment key={i} pct={seg.pct} color={seg.color} offset={offset} />;
                      offset += seg.pct;
                      return el;
                    });
                  })()}
                  {stats.total === 0 && (
                    <circle cx={44} cy={44} r={36} fill="none" stroke="#27272A" strokeWidth="10" />
                  )}
                </svg>
                <div className="flex flex-col gap-2 text-[10px] font-technical">
                  {[
                    { label: "TODO", count: stats.statusCounts.TODO, color: "#52525B" },
                    { label: "IN PROGRESS", count: stats.statusCounts.IN_PROGRESS, color: "#F59E0B" },
                    { label: "DONE", count: stats.statusCounts.DONE, color: "#10B981" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-zinc-400 w-20">{s.label}</span>
                      <span className="text-white font-bold ml-auto">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut: By Priority */}
            <div className="border border-[#27272A] bg-[#131313] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Flag size={13} className="text-[#EF4444]" />
                <span className="text-[10px] font-technical uppercase text-zinc-400 tracking-wider">By Priority</span>
              </div>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 88 88" className="w-[88px] h-[88px] flex-shrink-0">
                  {(() => {
                    const segments = [
                      { pct: stats.total > 0 ? (stats.priorityCounts.HIGH / stats.total) * 100 : 0, color: "#EF4444" },
                      { pct: stats.total > 0 ? (stats.priorityCounts.MEDIUM / stats.total) * 100 : 0, color: "#10B981" },
                      { pct: stats.total > 0 ? (stats.priorityCounts.LOW / stats.total) * 100 : 0, color: "#52525B" },
                    ];
                    let offset = 0;
                    return segments.map((seg, i) => {
                      const el = <DonutSegment key={i} pct={seg.pct} color={seg.color} offset={offset} />;
                      offset += seg.pct;
                      return el;
                    });
                  })()}
                  {stats.total === 0 && (
                    <circle cx={44} cy={44} r={36} fill="none" stroke="#27272A" strokeWidth="10" />
                  )}
                </svg>
                <div className="flex flex-col gap-2 text-[10px] font-technical">
                  {[
                    { label: "HIGH", count: stats.priorityCounts.HIGH, color: "#EF4444" },
                    { label: "MEDIUM", count: stats.priorityCounts.MEDIUM, color: "#10B981" },
                    { label: "LOW", count: stats.priorityCounts.LOW, color: "#52525B" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-zinc-400 w-16">{s.label}</span>
                      <span className="text-white font-bold ml-auto">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
