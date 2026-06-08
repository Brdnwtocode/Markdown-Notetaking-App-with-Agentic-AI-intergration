"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";

const TaskFormSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assignee: z.string().max(200).default(""),
  dueDate: z.string().default(""),
});
type TaskFormData = z.infer<typeof TaskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (data: TaskFormData) => void;
}

export default function TaskDialog({ open, onOpenChange, task, onSubmit }: TaskDialogProps) {
  const { register, handleSubmit, reset, setValue } = useForm<TaskFormData>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues: { title: "", description: "", status: "TODO", priority: "MEDIUM", assignee: "", dueDate: "" },
  });

  useEffect(() => {
    if (task) {
      setValue("title", task.title);
      setValue("description", task.description);
      setValue("status", task.status);
      setValue("priority", task.priority);
      setValue("assignee", task.assignee ?? "");
      setValue("dueDate", task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
    } else {
      reset();
    }
  }, [task, setValue, reset]);

  const submitHandler = (data: TaskFormData) => {
    onSubmit(data);
    reset();
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#131313] border border-[#27272A] text-white rounded-none">
          <DialogHeader>
            <DialogTitle className="text-white font-technical uppercase text-sm tracking-wider">
              {task ? "Edit Task" : "New Task"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
            <Input placeholder="Title" {...register("title")} />
            <Textarea placeholder="Description" {...register("description")} />
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-technical uppercase text-zinc-400">Status</label>
              <div className="flex gap-2">
                {(["TODO", "IN_PROGRESS", "DONE"] as const).map((s) => (
                  <Button type="button" key={s} variant="secondary" className="flex-1 text-xs font-technical uppercase rounded-none" onClick={() => setValue("status", s as TaskStatus)}>
                    {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-technical uppercase text-zinc-400">Priority</label>
              <div className="flex gap-2">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                  <Button type="button" key={p} variant="secondary" className="flex-1 text-xs font-technical uppercase rounded-none" onClick={() => setValue("priority", p as TaskPriority)}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <Input placeholder="Assignee (text)" {...register("assignee")} />
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-technical uppercase text-zinc-400">Due Date</label>
              <input type="date" {...register("dueDate")} className="bg-[#0E0E0E] border border-[#27272A] rounded-none px-3 py-2 text-sm text-white w-full font-technical" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="rounded-none">
                Cancel
              </Button>
              <Button type="submit" variant="technical" className="rounded-none">
                {task ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
