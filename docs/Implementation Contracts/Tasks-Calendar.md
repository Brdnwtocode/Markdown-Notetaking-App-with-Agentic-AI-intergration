# Final Corrected Technical Design Contract: Tasks & Calendar

## For AI Coding Agents – Execute Exactly As Written

**Contract Version:** 2.0 – FINAL  
**Audience:** Coding AI agents. No deviations permitted. If any instruction is unclear, halt and report – do not assume.

---

## Pre‑Execution Verification – Owner Must Confirm Before Agent Starts

This contract assumes the following facts about the target codebase. The owner **must** verify each item before handing this contract to the agent. The agent will **not** verify these; they are treated as ground truth.

| # | Assumption | Owner Check (☐) |
|---|------------|------------------|
| 1 | Auth import path is `import { auth } from "@/app/auth"` | ☐ |
| 2 | Prisma models use `@default(uuid())` (not `cuid()`) | ☐ |
| 3 | Store is at `lib/store.ts` and is a monolithic Zustand store | ☐ |
| 4 | `store/useStore.ts` re‑exports from `lib/store.ts` | ☐ |
| 5 | `TabType` in current store is `"NOTE" | "STACK"` | ☐ |
| 6 | `PendingAction` type exists; `PendingActionType` does NOT exist | ☐ |
| 7 | Package `react-big-calendar`, `date-fns`, `react-dnd`, `use-debounce` are NOT currently installed | ☐ |

**If any box is unchecked, stop. Do not proceed. The contract may fail.**

---

## Section 0 – Ground Rules for the Agent

1. **Execute phases in order (A → J).** Do not skip or reorder.
2. **After Phase A, run the manual verification checklist in Section 1.1. Do not continue if any check fails.**
3. **Use the exact library versions specified in Section 2.** No other installations.
4. **Do not modify any file outside the manifest in Section 12.**
5. **All API routes must include the security pattern from Section 5.1.**
6. **Use the shared `apiJson` helper from `lib/api.ts` (created in Phase A.5). Do not duplicate fetch logic.**
7. **If any instruction is ambiguous, halt and ask for clarification.**

---

## Section 1 – Execution Phases

| Phase | Name | Blocking? |
|-------|------|------------|
| A | Store Refactor | ✅ Must pass verification before Phase B |
| A.5 | Create shared `lib/api.ts` | ✅ (part of Phase A) |
| B | Database Schema + Migration | ✅ |
| C | API Routes – Tasks | depends on B |
| D | API Routes – Calendar Events | depends on B |
| E | Store Slices – Tasks + Calendar | depends on A |
| F | Sidebar + TabBar + Routing | depends on A |
| G | UI – Tasks Feature | depends on C, E, F |
| H | UI – Calendar Feature | depends on D, E, F |
| I | Voice Integration – Next.js BFF | depends on E |
| J | FastAPI Microservice Extension (owner only – agent does NOT implement) | – |

### Section 1.1 – Phase A Manual Verification Checklist

After completing Phase A (store refactor) and **before** writing any new feature code, manually test in the running dev server:

- [ ] Create a new Note → note appears → tab opens
- [ ] Edit note title → title updates in tab bar
- [ ] Edit note content → sync indicator shows SAVING → SAVED
- [ ] Delete a note → note removed → tab closes
- [ ] Create a new Stack → stack appears → tab opens
- [ ] Switch between an open Note tab and an open Stack tab → correct content renders
- [ ] Ctrl+Space → microphone activates → release → AI reply appears
- [ ] Close a tab → adjacent tab activates correctly

**If any check fails:**
1. Run `git stash` to revert all Phase A changes.
2. Report the failure with specific error output.
3. Do not proceed to Phase B.

**If all checks pass:** Continue to Phase B.

---

## Section 2 – Library Installations

Run these exact commands. Use these exact versions to avoid conflicts.

```bash
npm install react-big-calendar@1.13.0 date-fns@3.6.0 react-dnd@16.0.1 react-dnd-html5-backend@16.0.1 use-debounce@10.0.0
npm install --save-dev @types/react-big-calendar@1.13.0
```

**Rationale:** `react-big-calendar` v1.13.0 is the latest stable; its DnD addon requires `react-dnd` v16 and the HTML5 backend as peer dependencies. `use-debounce` is used for calendar lazy loading.

---

## Section 3 – Phase A: Store Refactor into Slices

### 3.1 Slice Structure

Create `lib/slices/` with these files. All slices follow the `StateCreator<RootStore, [], [], SliceName>` pattern.

```
lib/slices/
  notesSlice.ts       (move from store.ts)
  stacksSlice.ts      (move from store.ts)
  voiceSlice.ts       (move from store.ts)
  uiSlice.ts          (move from store.ts)
  aiSlice.ts          (move from store.ts)
  tasksSlice.ts       (create empty – filled in Phase E)
  calendarSlice.ts    (create empty – filled in Phase E)
```

### 3.2 Slice Implementation Pattern

Each slice file must export:
- An interface (e.g., `NotesSlice`)
- A factory function `createNotesSlice: StateCreator<RootStore, [], [], NotesSlice>`

Example for `notesSlice.ts` (all existing logic copied verbatim):

```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export interface NotesSlice {
  // ... copy all existing note state and action signatures from store.ts
}

export const createNotesSlice: StateCreator<RootStore, [], [], NotesSlice> = (set, get) => ({
  // ... copy all existing note implementations verbatim from store.ts
});
```

**Do not change any logic during this phase.** Only relocate code.

### 3.3 Revised `lib/store.ts` – Composition Root

Replace entire file with:

```typescript
import { create } from "zustand";
import { createNotesSlice, NotesSlice } from "@/lib/slices/notesSlice";
import { createStacksSlice, StacksSlice } from "@/lib/slices/stacksSlice";
import { createVoiceSlice, VoiceSlice } from "@/lib/slices/voiceSlice";
import { createUiSlice, UiSlice } from "@/lib/slices/uiSlice";
import { createAiSlice, AiSlice } from "@/lib/slices/aiSlice";
import { createTasksSlice, TasksSlice } from "@/lib/slices/tasksSlice";
import { createCalendarSlice, CalendarSlice } from "@/lib/slices/calendarSlice";

export type RootStore =
  & NotesSlice
  & StacksSlice
  & VoiceSlice
  & UiSlice
  & AiSlice
  & TasksSlice
  & CalendarSlice;

export const useWorkspaceStore = create<RootStore>()((...a) => ({
  ...createNotesSlice(...a),
  ...createStacksSlice(...a),
  ...createVoiceSlice(...a),
  ...createUiSlice(...a),
  ...createAiSlice(...a),
  ...createTasksSlice(...a),
  ...createCalendarSlice(...a),
}));

// Re-export all types exactly as before
export type { Note } from "@/lib/slices/notesSlice";
export type { Stack, StackColumn, StackRow } from "@/lib/slices/stacksSlice";
export type { OpenTab, TabType, SyncState } from "@/lib/slices/uiSlice";
export type { PendingAction } from "@/lib/slices/aiSlice";
```

**Note:** `PendingActionType` does not exist in the codebase – do not reference it.

### 3.4 `store/useStore.ts` – No Changes

This file already re‑exports from `lib/store.ts`. Leave it untouched.

### 3.5 Phase A.5 – Create Shared `lib/api.ts`

Create new file `lib/api.ts`:

```typescript
export async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    // Try to parse JSON error body first
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody.error || errorMessage;
    } catch {
      errorMessage = await res.text().catch(() => errorMessage);
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
```

**All subsequent fetch calls in slices must use this function.** Do not duplicate fetch logic.

---

## Section 4 – Phase B: Database Schema

### 4.1 Extend User Model

In `prisma/schema.prisma`, add after `stacks Stack[]`:

```prisma
  tasks         Task[]
  calendarEvents CalendarEvent[]
```

### 4.2 Add Enums (after existing `DataType` enum)

```prisma
enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}
```

### 4.3 Add Task Model

**Note:** Use `@default(uuid())` to match existing models.

```prisma
model Task {
  id        String @id @default(uuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  parentId  String?
  parent    Task?  @relation("TaskSubtasks", fields: [parentId], references: [id], onDelete: Cascade)
  children  Task[] @relation("TaskSubtasks")

  title       String
  description String   @default("") @db.Text
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  assignee    String?
  dueDate     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, parentId])
  @@index([userId, status])
  @@index([userId, dueDate])
}
```

### 4.4 Add CalendarEvent Model

```prisma
model CalendarEvent {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  title   String
  notes   String   @default("") @db.Text
  startAt DateTime
  endAt   DateTime
  allDay  Boolean  @default(false)
  color   String   @default("#5645d4")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, startAt])
  @@index([userId, endAt])
}
```

### 4.5 Run Migration

```bash
npx prisma migrate dev --name add_tasks_and_calendar
npx prisma generate
```

---

## Section 5 – Phases C & D: API Routes

### 5.1 Security Pattern – Mandatory for Every Route

Every route handler must begin with:

```typescript
import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

For single-resource routes, after fetching, verify ownership and return 404 (not 403) on mismatch:

```typescript
const record = await prisma.task.findUnique({ where: { id: params.id } });
if (!record || record.userId !== session.user.id) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

`userId` is always taken from `session.user.id`. Never accept it from request body.

### 5.2 Tasks API – File: `app/api/tasks/route.ts`

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateTaskSchema = z.object({
  title:       z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  status:      z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  priority:    z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  assignee:    z.string().max(200).nullable().optional(),
  dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
  parentId:    z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, parentId: null },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const body = await request.json();
  const parsed = CreateTaskSchema.parse(body);
  if (parsed.parentId) {
    const parent = await prisma.task.findUnique({ where: { id: parsed.parentId } });
    if (!parent || parent.userId !== session.user.id) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
  }
  const task = await prisma.task.create({
    data: { ...parsed, userId: session.user.id, dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined },
  });
  return NextResponse.json(task, { status: 201 });
}
```

### 5.3 Tasks API – `app/api/tasks/[id]/route.ts`

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateTaskSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status:      z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority:    z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignee:    z.string().max(200).nullable().optional(),
  dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== session.user.id) return notFound();
  return NextResponse.json(task);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== session.user.id) return notFound();
  const body = await req.json();
  const parsed = UpdateTaskSchema.parse(body);
  const updated = await prisma.task.update({
    where: { id: params.id },
    data: { ...parsed, dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== session.user.id) return notFound();
  await prisma.task.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

### 5.4 Tasks API – `app/api/tasks/[id]/children/route.ts`

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const parent = await prisma.task.findUnique({ where: { id: params.id } });
  if (!parent || parent.userId !== session.user.id) return notFound();
  const children = await prisma.task.findMany({
    where: { parentId: params.id, userId: session.user.id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(children);
}
```

### 5.5 Calendar Events API – `app/api/events/route.ts`

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateEventSchema = z.object({
  title:   z.string().min(1).max(500),
  notes:   z.string().max(10000).default(""),
  startAt: z.string().datetime({ offset: true }),
  endAt:   z.string().datetime({ offset: true }),
  allDay:  z.boolean().default(false),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5645d4"),
}).refine((data) => new Date(data.startAt) <= new Date(data.endAt), {
  message: "startAt must be before endAt",
  path: ["endAt"],
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where: any = { userId: session.user.id };
  if (from) where.startAt = { gte: new Date(from) };
  if (to) where.endAt = { lte: new Date(to) };
  const events = await prisma.calendarEvent.findMany({ where, orderBy: { startAt: "asc" } });
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const body = await request.json();
  const parsed = CreateEventSchema.parse(body);
  const event = await prisma.calendarEvent.create({
    data: { ...parsed, userId: session.user.id, startAt: new Date(parsed.startAt), endAt: new Date(parsed.endAt) },
  });
  return NextResponse.json(event, { status: 201 });
}
```

### 5.6 Calendar Events API – `app/api/events/[id]/route.ts`

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateEventSchema = z.object({
  title:   z.string().min(1).max(500).optional(),
  notes:   z.string().max(10000).optional(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt:   z.string().datetime({ offset: true }).optional(),
  allDay:  z.boolean().optional(),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine((data) => {
  if (data.startAt && data.endAt) return new Date(data.startAt) <= new Date(data.endAt);
  return true;
}, { message: "startAt must be before endAt", path: ["endAt"] });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) return notFound();
  return NextResponse.json(event);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) return notFound();
  const body = await req.json();
  const parsed = UpdateEventSchema.parse(body);
  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...parsed,
      startAt: parsed.startAt ? new Date(parsed.startAt) : undefined,
      endAt: parsed.endAt ? new Date(parsed.endAt) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) return notFound();
  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

---

## Section 6 – Phase E: Store Slices – Tasks & Calendar

### 6.1 Extend `TabType` in `lib/slices/uiSlice.ts`

Change from:
```typescript
export type TabType = "NOTE" | "STACK";
```
To:
```typescript
export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR";
```

### 6.2 Extend `PendingAction` in `lib/slices/aiSlice.ts`

Add to the existing union:

```typescript
| {
    type: "create_task";
    data: {
      title: string;
      description?: string;
      status?: "TODO" | "IN_PROGRESS" | "DONE";
      priority?: "LOW" | "MEDIUM" | "HIGH";
      assignee?: string | null;
      dueDate?: string | null;
      parentId?: string | null;
    };
  }
| {
    type: "create_calendar_event";
    data: {
      title: string;
      notes?: string;
      startAt: string;
      endAt: string;
      allDay?: boolean;
      color?: string;
    };
  }
```

In `commitPendingAction`, add after existing else-if chain:

```typescript
} else if (pendingAction?.type === "create_task") {
  get().optimisticCreateTask(pendingAction.data);
} else if (pendingAction?.type === "create_calendar_event") {
  get().optimisticCreateCalendarEvent(pendingAction.data);
}
```

### 6.3 `tasksSlice.ts` – Full Implementation

**Important:** This slice uses the shared `apiJson` from `lib/api.ts`. It assumes the store has a `userId` from session. Add a `userId` field to the store (or read from `session` via a separate slice). For simplicity, we will store `currentUserId` in `uiSlice.ts`. Add to `uiSlice.ts`:

```typescript
// In uiSlice.ts interface
currentUserId: string | null;
setCurrentUserId: (id: string | null) => void;
// Implementation
currentUserId: null,
setCurrentUserId: (id) => set({ currentUserId: id }),
```

Then in the app root (e.g., `app/(workspace)/layout.tsx`), fetch the session and call `setCurrentUserId`.

Now `tasksSlice.ts`:

```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";
import toast from "react-hot-toast";

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
  taskChildrenMap: Record<string, Task[]>;     // parentId -> direct children
  loadedParents: Record<string, boolean>;      // true if children fetched
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
    if (!userId) throw new Error("No current user ID");
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
```

### 6.4 `calendarSlice.ts` – Full Implementation

```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";
import toast from "react-hot-toast";

export interface CalendarEvent {
  id: string; userId: string; title: string; notes: string;
  startAt: string; endAt: string; allDay: boolean; color: string;
  createdAt: string; updatedAt: string;
}

export interface CalendarSlice {
  calendarEvents: CalendarEvent[];
  setCalendarEvents: (events: CalendarEvent[]) => void;
  optimisticCreateCalendarEvent: (data: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  optimisticPatchCalendarEvent: (eventId: string, patch: Partial<Pick<CalendarEvent, "title" | "notes" | "startAt" | "endAt" | "allDay" | "color">>) => void;
  optimisticDeleteCalendarEvent: (eventId: string) => void;
}

export const createCalendarSlice: StateCreator<RootStore, [], [], CalendarSlice> = (set, get) => ({
  calendarEvents: [],
  setCalendarEvents: (events) => set({ calendarEvents: events }),

  optimisticCreateCalendarEvent: (data) => {
    const snapshot = get().calendarEvents;
    const id = `temp_event_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const userId = get().currentUserId;
    if (!userId) throw new Error("No current user ID");
    const optimistic: CalendarEvent = { id, userId, createdAt: now, updatedAt: now, ...data };

    set((state) => ({
      calendarEvents: [...state.calendarEvents, optimistic],
      syncState: "SAVING", isSaving: true,
    }));

    void apiJson<CalendarEvent>("/api/events", { method: "POST", body: JSON.stringify(data) })
      .then((created) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.map(e => e.id === id ? created : e),
          syncState: "SAVED", isSaving: false,
        }));
      })
      .catch(() => {
        set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
        toast.error("Failed to create event");
      });
  },

  optimisticPatchCalendarEvent: (eventId, patch) => {
    const snapshot = get().calendarEvents;
    set((state) => ({
      calendarEvents: state.calendarEvents.map(e =>
        e.id === eventId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
      ),
      syncState: "SAVING", isSaving: true,
    }));

    void apiJson<CalendarEvent>(`/api/events/${eventId}`, { method: "PUT", body: JSON.stringify(patch) })
      .then(() => set({ syncState: "SAVED", isSaving: false }))
      .catch(() => {
        set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
        toast.error("Failed to update event");
      });
  },

  optimisticDeleteCalendarEvent: (eventId) => {
    const snapshot = get().calendarEvents;
    set((state) => ({
      calendarEvents: state.calendarEvents.filter(e => e.id !== eventId),
      syncState: "SAVING", isSaving: true,
    }));

    void fetch(`/api/events/${eventId}`, { method: "DELETE", credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(); set({ syncState: "SAVED", isSaving: false }); })
      .catch(() => {
        set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
        toast.error("Failed to delete event");
      });
  },
});
```

### 6.5 Re‑export New Types in `store/useStore.ts`

Add to existing exports:

```typescript
export type { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";
export type { CalendarEvent } from "@/lib/slices/calendarSlice";
```

---

## Section 7 – Phase F: Sidebar, TabBar & Routing

### 7.1 Singleton Tab Constants – Create `lib/constants.ts`

```typescript
export const TASKS_TAB_ID = "singleton-tasks" as const;
export const CALENDAR_TAB_ID = "singleton-calendar" as const;
```

### 7.2 Sidebar Modifications – `components/workspace/Sidebar.tsx`

Add imports:
```typescript
import { CheckSquare, CalendarDays } from "lucide-react";
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";
```

Add `openTab` to store destructure.

In the ribbon (vertical toolbar with stack icon), add two buttons after the stack button and before the `flex-1` spacer:

```tsx
<Button
  size="icon"
  variant="ghost"
  onClick={() => {
    openTab(TASKS_TAB_ID, "TASKS", "Tasks");
    router.push("/workspace/tasks");
  }}
  className="h-10 w-10 rounded hover:bg-white/5"
  title="Tasks"
>
  <CheckSquare className="h-5 w-5 text-slate-400" />
</Button>
<Button
  size="icon"
  variant="ghost"
  onClick={() => {
    openTab(CALENDAR_TAB_ID, "CALENDAR", "Calendar");
    router.push("/workspace/calendar");
  }}
  className="h-10 w-10 rounded hover:bg-white/5"
  title="Calendar"
>
  <CalendarDays className="h-5 w-5 text-slate-400" />
</Button>
```

### 7.3 TabBar Modifications – `components/workspace/TabBar.tsx`

Add import:
```typescript
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";
```

Define helper outside component:

```typescript
function getTabHref(tab: OpenTab): string {
  switch (tab.type) {
    case "NOTE": return `/workspace/notes/${tab.id}`;
    case "STACK": return `/workspace/stacks/${tab.id}`;
    case "TASKS": return `/workspace/tasks`;
    case "CALENDAR": return `/workspace/calendar`;
    default: {
      const _exhaustive: never = tab.type;
      return `/workspace`;
    }
  }
}
```

Replace the inline href with `href={getTabHref(tab)}`.

### 7.4 New Page Routes

Create:
- `app/(workspace)/workspace/tasks/page.tsx` (see Section 8.1)
- `app/(workspace)/workspace/calendar/page.tsx` (see Section 9)

Both are `"use client"` components.

---

## Section 8 – Phase G: Tasks UI

### 8.1 Tasks Page – `app/(workspace)/workspace/tasks/page.tsx`

```typescript
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
  title: string; description: string; status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH"; assignee: string; dueDate: string;
};

export default function TasksPage() {
  const { tasks, setTasks, openTab, optimisticCreateTask, optimisticPatchTask, optimisticDeleteTask } = useWorkspaceStore();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    openTab(TASKS_TAB_ID, "TASKS", "Tasks");
    fetch("/api/tasks", { credentials: "include" })
      .then(res => res.json())
      .then(setTasks)
      .catch(() => toast.error("Failed to load tasks"));
  }, [openTab, setTasks]);

  const visibleTasks = useMemo(() => {
    return filterStatus === "ALL" ? tasks : tasks.filter(t => t.status === filterStatus);
  }, [tasks, filterStatus]);

  const handleCreate = (data: TaskFormData) => {
    optimisticCreateTask({
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee || null,
      dueDate: data.dueDate || null,
      parentId: null,
    });
    setDialogOpen(false);
  };

  const handleUpdate = (id: string, data: TaskFormData) => {
    optimisticPatchTask(id, {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee || null,
      dueDate: data.dueDate || null,
    });
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleDelete = (id: string) => {
    // Use shadcn AlertDialog instead of confirm – we'll implement a simple modal below
    if (window.confirm("Delete this task and all its subtasks?")) {
      optimisticDeleteTask(id);
    }
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-200">Tasks</h1>
          <Button onClick={() => { setEditingTask(null); setDialogOpen(true); }}>New Task</Button>
        </div>
        <div className="flex gap-2 mb-6">
          {["ALL", "TODO", "IN_PROGRESS", "DONE"].map(status => (
            <Button key={status} variant={filterStatus === status ? "default" : "outline"} size="sm"
              onClick={() => setFilterStatus(status as any)}>
              {status.replace("_", " ")}
            </Button>
          ))}
        </div>
        <div className="space-y-0">
          {visibleTasks.map(task => (
            <TaskItem key={task.id} task={task} depth={0} onEdit={setEditingTask} onDelete={handleDelete} />
          ))}
        </div>
        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
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
```

### 8.2 TaskItem Component – `components/workspace/TaskItem.tsx`

```typescript
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

export default function TaskItem({ task, depth, onEdit, onDelete }: TaskItemProps) {
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
        <button onClick={handleExpand} className="w-6 h-6 flex items-center justify-center">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-4" />}
        </button>
        <button onClick={cycleStatus} className="w-5 h-5 flex items-center justify-center">
          <StatusIcon className={`w-4 h-4 ${statusConfig[task.status].class}`} />
        </button>
        <span className={`flex-1 text-sm ${task.status === "DONE" ? "line-through text-zinc-500" : "text-slate-300"}`}>
          {task.title}
        </span>
        {task.priority && <span className={priorityClasses[task.priority]}>{task.priority}</span>}
        {task.assignee && <span className="text-xs text-zinc-400">@{task.assignee}</span>}
        {task.dueDate && <span className="text-xs text-zinc-500">{new Date(task.dueDate).toLocaleDateString()}</span>}
        <div className="hidden group-hover:flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(task)}><Edit size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(task.id)}><Trash2 size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit({ ...task, parentId: task.id } as Task)}><Plus size={12} /></Button>
        </div>
      </div>
      {expanded && children.map(child => <TaskItem key={child.id} task={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  );
}
```

### 8.3 TaskDialog Component – `components/workspace/TaskDialog.tsx`

```typescript
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

  const submitHandler = (data: TaskFormData) => { onSubmit(data); reset(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-slate-200">
        <DialogHeader><DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
          <Input placeholder="Title" {...register("title")} className="bg-zinc-800 border-zinc-700" />
          <Textarea placeholder="Description" {...register("description")} className="bg-zinc-800 border-zinc-700" />
          <div className="flex gap-2">
            {["TODO", "IN_PROGRESS", "DONE"].map(s => (
              <Button type="button" key={s} variant="outline" className="flex-1" onClick={() => setValue("status", s as TaskStatus)}>
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {["LOW", "MEDIUM", "HIGH"].map(p => (
              <Button type="button" key={p} variant="outline" className="flex-1" onClick={() => setValue("priority", p as TaskPriority)}>
                {p}
              </Button>
            ))}
          </div>
          <Input placeholder="Assignee (text)" {...register("assignee")} className="bg-zinc-800 border-zinc-700" />
          <input type="date" {...register("dueDate")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-slate-300 w-full" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{task ? "Save" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Section 9 – Phase H: Calendar UI

### 9.1 CSS Import – Add to `app/layout.tsx`

In the root layout file, add this import before any other imports:

```typescript
import 'react-big-calendar/lib/css/react-big-calendar.css';
```

**Do not import inside `globals.css`.** This avoids PostCSS ordering issues.

### 9.2 Dark Theme Overrides – Add to `app/globals.css` (at the bottom)

```css
/* react-big-calendar dark theme overrides */
.rbc-calendar {
  background-color: transparent;
  color: hsl(var(--foreground));
  font-family: inherit;
}
.rbc-toolbar button {
  color: hsl(var(--muted-foreground));
  border-color: rgba(255,255,255,0.1);
  background: transparent;
}
.rbc-toolbar button:hover,
.rbc-toolbar button.rbc-active {
  background-color: rgba(255,255,255,0.05);
  color: hsl(var(--foreground));
  border-color: rgba(255,255,255,0.2);
}
.rbc-month-view, .rbc-time-view, .rbc-agenda-view {
  border-color: rgba(255,255,255,0.08);
}
.rbc-header { border-color: rgba(255,255,255,0.08); color: hsl(var(--muted-foreground)); }
.rbc-day-bg, .rbc-month-row { border-color: rgba(255,255,255,0.06); }
.rbc-today { background-color: rgba(86,69,212,0.12); }
.rbc-off-range-bg { background-color: rgba(255,255,255,0.02); }
.rbc-event { border-radius: 4px; padding: 2px 6px; font-size: 12px; border: none; }
.rbc-event:focus { outline: 2px solid #5645d4; }
.rbc-show-more { color: hsl(var(--muted-foreground)); background: transparent; }
.rbc-agenda-date-cell, .rbc-agenda-time-cell { color: hsl(var(--muted-foreground)); border-color: rgba(255,255,255,0.06); }
.rbc-agenda-event-cell { border-color: rgba(255,255,255,0.06); }
.rbc-time-content, .rbc-time-header { border-color: rgba(255,255,255,0.08); }
.rbc-timeslot-group { border-color: rgba(255,255,255,0.06); }
.rbc-time-gutter .rbc-label { color: hsl(var(--muted-foreground)); font-size: 11px; }
.rbc-current-time-indicator { background-color: #5645d4; }
```

### 9.3 Calendar Localizer – Create `lib/calendarLocalizer.ts`

```typescript
import { dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});
```

### 9.4 Calendar Page – `app/(workspace)/workspace/calendar/page.tsx`

```typescript
"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Calendar, dateFnsLocalizer, Views, SlotInfo, Event as RBCEvent } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useWorkspaceStore } from "@/lib/store";
import { CALENDAR_TAB_ID } from "@/lib/constants";
import { calendarLocalizer } from "@/lib/calendarLocalizer";
import { toast } from "react-hot-toast";
import EventDialog from "@/components/workspace/EventDialog";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";

const DnDCalendar = withDragAndDrop(Calendar);

function computeVisibleRange(date: Date, view: string): { from: Date; to: Date } {
  switch (view) {
    case "month":
      return {
        from: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
        to: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
      };
    case "week":
      return {
        from: startOfWeek(date, { weekStartsOn: 1 }),
        to: endOfWeek(date, { weekStartsOn: 1 }),
      };
    default:
      return { from: date, to: addDays(date, 30) };
  }
}

export default function CalendarPage() {
  const { calendarEvents, setCalendarEvents, openTab, optimisticCreateCalendarEvent, optimisticPatchCalendarEvent, optimisticDeleteCalendarEvent } = useWorkspaceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("month");
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchEvents = useCallback((from: Date, to: Date) => {
    clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
        const res = await fetch(`/api/events?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCalendarEvents(data);
      } catch {
        toast.error("Failed to load events");
      }
    }, 300);
  }, [setCalendarEvents]);

  useEffect(() => {
    openTab(CALENDAR_TAB_ID, "CALENDAR", "Calendar");
    const range = computeVisibleRange(currentDate, currentView);
    fetchEvents(range.from, range.to);
    return () => clearTimeout(fetchTimeoutRef.current);
  }, [openTab, fetchEvents, currentDate, currentView]);

  const rbcEvents = useMemo(() => calendarEvents.map(e => ({
    id: e.id,
    title: e.title,
    start: new Date(e.startAt),
    end: new Date(e.endAt),
    allDay: e.allDay,
    resource: e,
  })), [calendarEvents]);

  const handleNavigate = (date: Date, view: string) => {
    setCurrentDate(date);
    setCurrentView(view);
    const range = computeVisibleRange(date, view);
    fetchEvents(range.from, range.to);
  };

  const handleSelectSlot = ({ start, end }: SlotInfo) => {
    setDefaultStart(start as Date);
    setDefaultEnd(end as Date);
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleSelectEvent = (event: RBCEvent) => {
    setEditingEvent(event.resource);
    setDefaultStart(undefined);
    setDefaultEnd(undefined);
    setDialogOpen(true);
  };

  const handleEventDrop = ({ event, start, end, allDay }: any) => {
    const calEvent = event.resource;
    optimisticPatchCalendarEvent(calEvent.id, {
      startAt: (start as Date).toISOString(),
      endAt: (end as Date).toISOString(),
      allDay: allDay ?? calEvent.allDay,
    });
  };

  const handleEventResize = ({ event, start, end }: any) => {
    const calEvent = event.resource;
    optimisticPatchCalendarEvent(calEvent.id, {
      startAt: (start as Date).toISOString(),
      endAt: (end as Date).toISOString(),
    });
  };

  const handleCreate = (data: any) => {
    optimisticCreateCalendarEvent(data);
    setDialogOpen(false);
  };

  const handleUpdate = (id: string, data: any) => {
    optimisticPatchCalendarEvent(id, data);
    setDialogOpen(false);
    setEditingEvent(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this event?")) {
      optimisticDeleteCalendarEvent(id);
      setDialogOpen(false);
      setEditingEvent(null);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full w-full bg-[#1e1e1e] p-4">
        <DnDCalendar
          localizer={calendarLocalizer}
          events={rbcEvents}
          defaultView="month"
          views={["month", "week", "agenda"]}
          style={{ height: "calc(100% - 20px)" }}
          eventPropGetter={(event) => ({
            style: { backgroundColor: (event as any).resource.color, borderColor: (event as any).resource.color, color: "#ffffff" },
          })}
          selectable
          resizable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onNavigate={handleNavigate}
          onView={(view) => handleNavigate(currentDate, view)}
        />
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={editingEvent}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          onSubmit={(data) => {
            if (editingEvent) handleUpdate(editingEvent.id, data);
            else handleCreate(data);
          }}
          onDelete={() => editingEvent && handleDelete(editingEvent.id)}
        />
      </div>
    </DndProvider>
  );
}
```

### 9.5 EventDialog Component – `components/workspace/EventDialog.tsx`

```typescript
"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const EventFormSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).default(""),
  startAt: z.string().min(1, "Start time required"),
  endAt: z.string().min(1, "End time required"),
  allDay: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5645d4"),
}).refine((data) => new Date(data.startAt) <= new Date(data.endAt), {
  message: "Start must be before end",
  path: ["endAt"],
});

type EventFormData = z.infer<typeof EventFormSchema>;

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any;
  defaultStart?: Date;
  defaultEnd?: Date;
  onSubmit: (data: EventFormData) => void;
  onDelete?: () => void;
}

const colorSwatches = ["#5645d4", "#e03131", "#1aae39", "#dd5b00", "#2a9d99", "#ff64c8"];

export default function EventDialog({ open, onOpenChange, event, defaultStart, defaultEnd, onSubmit, onDelete }: EventDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<EventFormData>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: { title: "", notes: "", startAt: "", endAt: "", allDay: false, color: "#5645d4" },
  });
  const allDay = watch("allDay");

  useEffect(() => {
    if (event) {
      setValue("title", event.title);
      setValue("notes", event.notes);
      setValue("startAt", event.startAt.slice(0, 16)); // datetime-local format
      setValue("endAt", event.endAt.slice(0, 16));
      setValue("allDay", event.allDay);
      setValue("color", event.color);
    } else if (defaultStart && defaultEnd) {
      setValue("startAt", defaultStart.toISOString().slice(0, 16));
      setValue("endAt", defaultEnd.toISOString().slice(0, 16));
    } else {
      reset();
    }
  }, [event, defaultStart, defaultEnd, setValue, reset]);

  const submitHandler = (data: EventFormData) => {
    onSubmit({
      ...data,
      startAt: data.allDay ? new Date(data.startAt).toISOString() : new Date(data.startAt).toISOString(),
      endAt: data.allDay ? new Date(data.endAt).toISOString() : new Date(data.endAt).toISOString(),
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-slate-200">
        <DialogHeader><DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
          <Input placeholder="Title" {...register("title")} className="bg-zinc-800 border-zinc-700" />
          <Textarea placeholder="Notes" {...register("notes")} className="bg-zinc-800 border-zinc-700" />
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("allDay")} /> All day
          </label>
          {!allDay ? (
            <>
              <input type="datetime-local" {...register("startAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
              <input type="datetime-local" {...register("endAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
            </>
          ) : (
            <>
              <input type="date" {...register("startAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
              <input type="date" {...register("endAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
            </>
          )}
          <div className="flex gap-2">
            {colorSwatches.map(c => (
              <button type="button" key={c} className={`w-8 h-8 rounded-full border-2 ${watch("color") === c ? "ring-2 ring-white" : "border-transparent"}`}
                style={{ backgroundColor: c }} onClick={() => setValue("color", c)} />
            ))}
          </div>
          <div className="flex justify-between gap-2">
            {event && onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{event ? "Save" : "Create"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Section 10 – Phase I: Voice Integration – Next.js BFF

### 10.1 Add `currentUserId` to Store

In `lib/slices/uiSlice.ts`, add:

```typescript
// Interface
currentUserId: string | null;
setCurrentUserId: (id: string | null) => void;

// Implementation
currentUserId: null,
setCurrentUserId: (id) => set({ currentUserId: id }),
```

In the root workspace layout (e.g., `app/(workspace)/layout.tsx`), fetch the session and call `setCurrentUserId`:

```typescript
import { auth } from "@/app/auth";
import { useWorkspaceStore } from "@/lib/store";

// Inside a client component or useEffect
const session = await auth();
if (session?.user?.id) {
  useWorkspaceStore.getState().setCurrentUserId(session.user.id);
}
```

### 10.2 Modify `components/shared/PushToTalk.tsx`

Add to store destructure:
```typescript
const { openTabs, activeTabId, currentFocusedTaskId, tasks, taskChildrenMap, currentUserId } = useWorkspaceStore();
```

Replace context determination logic:

```typescript
let contextType: string | null = null;
let contextId: string | null = null;

if (currentNoteId) {
  contextType = "NOTE";
  contextId = currentNoteId;
} else if (currentStackId) {
  contextType = "STACK";
  contextId = currentStackId;
} else {
  const activeTab = openTabs.find(t => t.id === activeTabId);
  if (activeTab?.type === "TASKS") {
    contextType = "TASK";
    contextId = currentFocusedTaskId ?? "none";
  } else if (activeTab?.type === "CALENDAR") {
    contextType = "CALENDAR";
    contextId = "none";
  }
}

if (!contextType) {
  toast.error("Please select a note, stack, tasks, or calendar first");
  return;
}
```

Add task context payload if in TASKS mode and focused task exists:

```typescript
if (contextType === "TASK" && currentFocusedTaskId) {
  const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
  const parentTask = allTasks.find(t => t.id === currentFocusedTaskId);
  if (parentTask) {
    formData.append("task_context", JSON.stringify({
      focusedTaskId: parentTask.id,
      focusedTaskTitle: parentTask.title,
    }));
  }
}
```

Extend action handler:

```typescript
} else if (action === "create_task" && updatedData) {
  setPendingAction({ type: "create_task", data: updatedData });
} else if (action === "create_calendar_event" && updatedData) {
  setPendingAction({ type: "create_calendar_event", data: updatedData });
}
```

### 10.3 Modify `app/api/voice/process/route.ts`

Add extraction of `task_context` from FormData:

```typescript
const taskContext = formData.get("task_context") as string | null;
```

Forward to FastAPI:

```typescript
if (taskContext) {
  fastApiFormData.append("task_context", taskContext);
}
```

No other changes needed.

---

## Section 11 – Phase J: FastAPI Microservice Extension (Owner Only)

**This section is for the repo owner. The coding AI does not implement this.**

The FastAPI service must:

1. Add `"TASK"` and `"CALENDAR"` to the allowed `context_type` enum.
2. Accept an optional `task_context` JSON field (when `context_type == "TASK"`).
3. Add two new tool definitions for GPT-4o: `create_task` and `create_calendar_event` (schemas provided in original Contract B, Section 11.2).
4. Update system prompt to handle task and calendar commands, using `task_context.focusedTaskId` for subtask creation.
5. Return actions in the same format as existing note/stack actions (e.g., `{ action: "create_task", updatedData: {...} }`).

---

## Section 12 – Complete File Manifest

### New Files to Create

```
lib/constants.ts
lib/api.ts
lib/calendarLocalizer.ts
lib/slices/notesSlice.ts
lib/slices/stacksSlice.ts
lib/slices/voiceSlice.ts
lib/slices/uiSlice.ts
lib/slices/aiSlice.ts
lib/slices/tasksSlice.ts
lib/slices/calendarSlice.ts
app/(workspace)/workspace/tasks/page.tsx
app/(workspace)/workspace/calendar/page.tsx
components/workspace/TaskItem.tsx
components/workspace/TaskDialog.tsx
components/workspace/EventDialog.tsx
app/api/tasks/route.ts
app/api/tasks/[id]/route.ts
app/api/tasks/[id]/children/route.ts
app/api/events/route.ts
app/api/events/[id]/route.ts
```

### Existing Files to Modify

```
prisma/schema.prisma
lib/store.ts
store/useStore.ts
components/workspace/Sidebar.tsx
components/workspace/TabBar.tsx
components/shared/PushToTalk.tsx
app/api/voice/process/route.ts
app/globals.css
app/layout.tsx          (to add CSS import)
app/(workspace)/layout.tsx  (to set currentUserId)
```

### Files That Must Not Be Changed

Any file not listed above. Existing features must remain functional.

---

## Section 13 – Completion Criteria

The coding AI's job is complete when:

1. All new files created exactly as specified.
2. All modified files updated without breaking existing functionality.
3. No TypeScript or lint errors (including no `any` types).
4. Prisma migration applied successfully.
5. Manual verification checklist (Section 1.1) passes.
6. Tasks feature works: create root tasks, add subtasks (unlimited depth), edit, delete, filter, voice commands with context awareness.
7. Calendar feature works: month/week/agenda views, lazy load with debounce, create/edit/delete events, drag & drop, voice commands.
8. All existing features (notes, stacks, voice, sync) remain functional.

**End of Contract**