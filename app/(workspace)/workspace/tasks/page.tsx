"use client";
import { useEffect, useState, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { TASKS_TAB_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import TaskItem from "@/components/workspace/TaskItem";
import TaskDialog from "@/components/workspace/TaskDialog";
import { Task, TaskStatus } from "@/lib/slices/tasksSlice";
import { toast } from "react-hot-toast";

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
    <div className="h-full w-full bg-[#1e1e1e] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-200">Tasks</h1>
          <Button onClick={openNewTask}>New Task</Button>
        </div>
        <div className="flex gap-2 mb-6">
          {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status.replace("_", " ")}
            </Button>
          ))}
        </div>
        <div className="space-y-0">
          {visibleTasks.map((task) => (
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
          ))}
        </div>
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
