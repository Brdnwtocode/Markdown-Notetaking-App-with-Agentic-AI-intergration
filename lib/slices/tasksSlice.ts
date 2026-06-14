import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";
import { toast } from "@/lib/toast";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
    id: string; userId: string; parentId: string | null;
    title: string; description: string; status: TaskStatus;
    priority: TaskPriority; assignee: string | null; dueDate: string | null;
    createdAt: string; updatedAt: string;
}

export interface TasksSlice {
    tasks: Task[];
    taskChildrenMap: Record<string, Task[]>;
    loadedParents: Record<string, boolean>;
    currentFocusedTaskId: string | null;

    setTasks: (tasks: Task[]) => void;
    setCurrentFocusedTaskId: (id: string | null) => void;
    optimisticCreateTask: (data: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">) => void;
    optimisticPatchTask: (taskId: string, patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assignee" | "dueDate">>) => void;
    optimisticDeleteTask: (taskId: string) => void;
    fetchTaskChildren: (parentId: string) => Promise<void>;
}

export const createTasksSlice: StateCreator<RootStore, [], [], TasksSlice> = (set, get) => ({
    tasks: [],
    taskChildrenMap: {},
    loadedParents: {},
    currentFocusedTaskId: null,

    setTasks: (tasks) => set({ tasks }),

    setCurrentFocusedTaskId: (id) => set({ currentFocusedTaskId: id }),

    optimisticCreateTask: (data) => {
        const snapshot = { tasks: get().tasks, taskChildrenMap: get().taskChildrenMap };
        const id = `temp_task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const now = new Date().toISOString();
        const userId = get().currentUserId;
        if (!userId) {
            toast.error("Session not ready — try again in a moment");
            return;
        }
        const optimistic: Task = {
            id, userId, createdAt: now, updatedAt: now,
            title: data.title, description: data.description ?? "",
            status: data.status ?? "TODO", priority: data.priority ?? "MEDIUM",
            assignee: data.assignee ?? null, dueDate: data.dueDate ?? null,
            parentId: data.parentId ?? null,
        };

        set((state) => {
            if (data.parentId) {
                const existing = state.taskChildrenMap[data.parentId] ?? [];
                return {
                    taskChildrenMap: { ...state.taskChildrenMap, [data.parentId]: [...existing, optimistic] },
                    syncState: "SAVING", isSaving: true,
                };
            }
            return { tasks: [optimistic, ...state.tasks], syncState: "SAVING", isSaving: true };
        });

        void apiJson<Task>("/api/tasks", {
            method: "POST",
            body: JSON.stringify({
                title: data.title, description: data.description,
                status: data.status, priority: data.priority,
                assignee: data.assignee, dueDate: data.dueDate,
                parentId: data.parentId,
            }),
        })
            .then((created) => {
                set((state) => {
                    if (data.parentId) {
                        const children = (state.taskChildrenMap[data.parentId] ?? []).map(t => t.id === id ? created : t);
                        return {
                            taskChildrenMap: { ...state.taskChildrenMap, [data.parentId]: children },
                            syncState: "SAVED", isSaving: false,
                        };
                    }
                    return { tasks: state.tasks.map(t => t.id === id ? created : t), syncState: "SAVED", isSaving: false };
                });
            })
            .catch(() => {
                set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
                toast.error("Failed to create task");
            });
    },

    optimisticPatchTask: (taskId, patch) => {
        const snapshot = { tasks: get().tasks, taskChildrenMap: get().taskChildrenMap };
        const applyPatch = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t);

        set((state) => ({
            tasks: applyPatch(state.tasks),
            taskChildrenMap: Object.fromEntries(Object.entries(state.taskChildrenMap).map(([k, v]) => [k, applyPatch(v)])),
            syncState: "SAVING", isSaving: true,
        }));

        void apiJson<Task>(`/api/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(patch) })
            .then(() => set({ syncState: "SAVED", isSaving: false }))
            .catch(() => {
                set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
                toast.error("Failed to update task");
            });
    },

    optimisticDeleteTask: (taskId) => {
        const snapshot = { tasks: get().tasks, taskChildrenMap: get().taskChildrenMap };
        const removeFromMap = (map: Record<string, Task[]>): Record<string, Task[]> => {
            const next: Record<string, Task[]> = {};
            for (const [k, v] of Object.entries(map)) {
                if (k === taskId) continue;
                next[k] = v.filter(t => t.id !== taskId);
            }
            return next;
        };

        set((state) => ({
            tasks: state.tasks.filter(t => t.id !== taskId),
            taskChildrenMap: removeFromMap(state.taskChildrenMap),
            syncState: "SAVING", isSaving: true,
        }));

        void fetch(`/api/tasks/${taskId}`, { method: "DELETE", credentials: "include" })
            .then(res => { if (!res.ok) throw new Error(); set({ syncState: "SAVED", isSaving: false }); })
            .catch(() => {
                set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
                toast.error("Failed to delete task");
            });
    },

    fetchTaskChildren: async (parentId) => {
        if (get().loadedParents[parentId]) return;
        try {
            const children = await apiJson<Task[]>(`/api/tasks/${parentId}/children`);
            set((state) => ({
                taskChildrenMap: { ...state.taskChildrenMap, [parentId]: children },
                loadedParents: { ...state.loadedParents, [parentId]: true },
            }));
        } catch {
            toast.error("Failed to load subtasks");
        }
    },
});