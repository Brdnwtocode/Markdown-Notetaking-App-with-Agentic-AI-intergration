# Technical Design Contract
## Features: Tasks & Calendar
### Project: Markdown Notetaking App with Agentic AI Integration
**Contract Version:** 1.0 — FINAL  
**Audience:** Coding AI agents. Execute exactly as written. No design decisions permitted. No deviations. If a specification is unclear, halt and report — do not assume.

---

## SECTION 0 — GROUND RULES FOR THE EXECUTING AGENT

1. **Read the entire contract before writing a single line of code.**
2. **Execute in the phase order defined in Section 1.** Do not skip phases. Do not reorder them.
3. **Do not install any library not listed in Section 2.** The library list is final.
4. **Do not modify any file not listed in the per-phase file manifest.** If a file is not in the manifest for a phase, do not touch it.
5. **After completing Phase A (store refactor), run the manual verification checklist in Section 1.1 before proceeding.** Do not continue if any check fails.
6. **The public import surface of the store does not change during Phase A.** Every component that currently imports from `@/lib/store` or `@/store/useStore` must continue to work without any import path changes.
7. **All API routes follow the exact security pattern described in Section 5.0.** No exceptions.
8. **All optimistic store actions follow the snapshot-rollback pattern described in Section 4.3.** No exceptions.

---

## SECTION 1 — EXECUTION PHASES

Implementation must proceed in this exact order:

| Phase | Name | Blocking? |
|---|---|---|
| A | Store Refactor | ✅ Must pass verification before Phase B |
| B | Database Schema + Migration | ✅ Must complete before Phase C |
| C | API Routes — Tasks | depends on B |
| D | API Routes — Calendar Events | depends on B |
| E | Store Slices — Tasks + Calendar | depends on A |
| F | Sidebar + TabBar + Routing | depends on A |
| G | UI — Tasks Feature | depends on C, E, F |
| H | UI — Calendar Feature | depends on D, E, F |
| I | Voice Integration — Next.js BFF | depends on E |
| J | FastAPI Microservice Extension | depends on I |

---

### Section 1.1 — Phase A Manual Verification Checklist

After completing Phase A (store refactor) and before writing any new feature code, manually verify the following in the running development server (`npm run dev`):

- [ ] Create a new Note → note appears in sidebar → tab opens
- [ ] Edit note title → title updates in tab bar
- [ ] Edit note content → sync indicator shows SAVING then SAVED
- [ ] Delete a note → note removed from sidebar → tab closes
- [ ] Create a new Stack → stack appears in sidebar → tab opens
- [ ] Switch between an open Note tab and an open Stack tab → correct content renders
- [ ] Hold Ctrl+Space → microphone activates → release → "Processing..." appears
- [ ] AI reply panel opens when voice returns a response
- [ ] Close a tab → adjacent tab activates correctly

**If any item fails: stop. Fix the regression before continuing. Do not proceed to Phase B with a broken store.**

---

## SECTION 2 — LIBRARY INSTALLATIONS

Run these commands exactly. No other libraries may be installed.

```bash
npm install react-big-calendar date-fns react-dnd react-dnd-html5-backend
npm install --save-dev @types/react-big-calendar
```

**Justification (for auditability — agent does not need to re-evaluate):**
- `react-big-calendar`: Calendar UI with month/week/agenda views, full CSS override capability, dark-theme compatible.
- `date-fns`: Required localizer for `react-big-calendar`. Also used for all date formatting in Tasks and Calendar features.
- `react-dnd` + `react-dnd-html5-backend`: Required peer dependencies for `react-big-calendar`'s drag-and-drop addon. No alternative; these are the documented peer deps.
- `@types/react-big-calendar`: TypeScript definitions.

---

## SECTION 3 — PHASE A: STORE REFACTOR

### 3.0 Objective

Split `lib/store.ts` from one monolithic Zustand `create()` call into composable slice files. The public API — what components import and how they import it — must not change.

### 3.1 New File Structure

Create the following new files. Do not delete `lib/store.ts` — it becomes the composition root.

```
lib/
  store.ts              ← MODIFIED: becomes composition root only
  slices/
    notesSlice.ts       ← NEW
    stacksSlice.ts      ← NEW
    voiceSlice.ts       ← NEW
    uiSlice.ts          ← NEW
    aiSlice.ts          ← NEW
    tasksSlice.ts       ← NEW (empty slice, populated in Phase E)
    calendarSlice.ts    ← NEW (empty slice, populated in Phase E)
```

### 3.2 Slice Pattern

Every slice file must follow this exact pattern using Zustand's slice pattern with `StateCreator`:

```typescript
// lib/slices/notesSlice.ts
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export interface NotesSlice {
  // ... all types and method signatures from current store
}

export const createNotesSlice: StateCreator<
  RootStore,
  [],
  [],
  NotesSlice
> = (set, get) => ({
  // ... all implementations verbatim from current store
});
```

The `RootStore` type is defined in `lib/store.ts` as the union of all slice interfaces. Slices receive the full `RootStore` generic so cross-slice calls (e.g., `optimisticCreateNote` calling `get().openTab`) continue to work.

### 3.3 Slice Assignments

Move each existing store member to its slice exactly as follows. Do not rename, restructure, or refactor any logic during this phase.

**`notesSlice.ts`** — move verbatim:
- Types: `Note`
- State: `notes`, `noteCache`, `currentNoteId`
- Actions: `setCurrentNoteId`, `addNote`, `updateNote`, `deleteNote`, `setNotes`, `upsertNoteCache`, `optimisticCreateNote`, `optimisticPatchNote`, `optimisticDeleteNote`

**`stacksSlice.ts`** — move verbatim:
- Types: `StackColumn`, `StackRow`, `Stack`
- State: `stacks`, `currentStackId`
- Actions: `setCurrentStackId`, `addStack`, `updateStack`, `deleteStack`, `setStacks`, `optimisticRenameStack`, `optimisticAddStackRow`, `optimisticPatchStackRow`, `optimisticDeleteStackRow`

**`voiceSlice.ts`** — move verbatim:
- State: `isRecording`, `recordingTranscript`
- Actions: `setIsRecording`, `setRecordingTranscript`

**`uiSlice.ts`** — move verbatim:
- Types: `SyncState`, `OpenTab`, `TabType`
- State: `openTabs`, `activeTabId`, `syncState`, `isSaving`, `cursorPosition`, `isVoiceMutating`, `isRawMarkdownView`
- Actions: `openTab`, `closeTab`, `setActiveTab`, `updateTabTitle`, `setIsSaving`, `setCursorPosition`, `setIsVoiceMutating`, `setIsRawMarkdownView`, `toggleRawMarkdownView`

**`aiSlice.ts`** — move verbatim:
- Types: `PendingAction`, `PendingActionType`
- State: `aiReply`, `pendingAction`
- Actions: `setAiReply`, `setPendingAction`, `commitPendingAction`, `clearPendingAction`

**`tasksSlice.ts`** — create as empty slice:
```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export interface TasksSlice {}

export const createTasksSlice: StateCreator<RootStore, [], [], TasksSlice> = () => ({});
```

**`calendarSlice.ts`** — create as empty slice:
```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export interface CalendarSlice {}

export const createCalendarSlice: StateCreator<RootStore, [], [], CalendarSlice> = () => ({});
```

### 3.4 Revised `lib/store.ts` — Composition Root

Replace the entire content of `lib/store.ts` with the following structure:

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

// Re-export all types so existing imports continue to work
export type {
  Note,
} from "@/lib/slices/notesSlice";
export type {
  Stack,
  StackColumn,
  StackRow,
} from "@/lib/slices/stacksSlice";
export type {
  OpenTab,
  TabType,
  SyncState,
} from "@/lib/slices/uiSlice";
export type {
  PendingAction,
  PendingActionType,
} from "@/lib/slices/aiSlice";
```

### 3.5 `store/useStore.ts` — No Change to Exports

`store/useStore.ts` currently re-exports from `lib/store`. It must continue to do so without modification. After Phase A, verify this file still exports `useWorkspaceStore` and all types correctly.

---

## SECTION 4 — PHASE B: DATABASE SCHEMA

### 4.0 File to Modify

`prisma/schema.prisma` — edit in place. Do not replace the file.

### 4.1 Extend the `User` Model

Add two lines after the existing `stacks Stack[]` line:

```prisma
  tasks         Task[]
  calendarEvents CalendarEvent[]
```

### 4.2 New Enums — Add After Existing `DataType` Enum

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

### 4.3 New `Task` Model — Add After New Enums

```prisma
model Task {
  id       String @id @default(uuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentId String?
  parent   Task?  @relation("TaskSubtasks", fields: [parentId], references: [id], onDelete: Cascade)
  children Task[] @relation("TaskSubtasks")

  title       String
  description String       @default("") @db.Text
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

**Critical notes on this schema:**
- `parentId` is nullable. Root tasks have `parentId = null`.
- `onDelete: Cascade` on the self-relation means deleting a parent in the DB automatically deletes all descendants recursively. The application layer does not need to handle cascade deletes — only the store's optimistic update does (see Section 8.3).
- `assignee` is a plain nullable string. No foreign key. No user lookup.

### 4.4 New `CalendarEvent` Model — Add After `Task` Model

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

### 4.5 Migration Command

Run after editing the schema:

```bash
npx prisma migrate dev --name add_tasks_and_calendar
```

Then regenerate the client:

```bash
npx prisma generate
```

---

## SECTION 5 — PHASES C & D: API ROUTES

### 5.0 Security Pattern — Mandatory on Every Route Handler

Every single route handler must begin with this exact block before any other logic:

```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

For routes operating on a single resource, ownership must be verified after fetch:

```typescript
const record = await prisma.task.findUnique({ where: { id: params.id } });
if (!record || record.userId !== session.user.id) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

The 404 (not 403) on ownership failure is intentional — it does not reveal existence of other users' records.

`userId` is ALWAYS sourced from `session.user.id`. It must never appear in request bodies or be accepted from client input.

### 5.1 Phase C — Tasks API

#### File: `app/api/tasks/route.ts`

**GET** — List all root-level tasks for the current user. Children are not included; they are fetched lazily.

```typescript
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      parentId: null,          // Root tasks only
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(tasks);
}
```

**POST** — Create a task. May be a root task (`parentId` omitted) or a subtask (`parentId` provided).

Zod validation schema:
```typescript
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
```

When `parentId` is provided, verify it exists and belongs to the current user before creating:

```typescript
if (body.parentId) {
  const parent = await prisma.task.findUnique({ where: { id: body.parentId } });
  if (!parent || parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
  }
}
```

Response: created `Task` object, HTTP 201.

---

#### File: `app/api/tasks/[id]/route.ts`

**GET** — Return a single task. Does not include children.

**PUT** — Update task fields.

Zod validation schema:
```typescript
const UpdateTaskSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status:      z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority:    z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignee:    z.string().max(200).nullable().optional(),
  dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
});
```

`parentId` is not updatable via PUT. Task reparenting is not supported in this version.

Response: updated `Task` object, HTTP 200.

**DELETE** — Delete a task. DB cascade handles descendant deletion.

Response: HTTP 204, no body.

---

#### File: `app/api/tasks/[id]/children/route.ts`

This is the lazy-load endpoint. It returns direct children only — not grandchildren.

**GET** — Return direct children of a task.

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify parent ownership
  const parent = await prisma.task.findUnique({ where: { id: params.id } });
  if (!parent || parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const children = await prisma.task.findMany({
    where: {
      parentId: params.id,
      userId: session.user.id,
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "asc" },
    ],
  });

  return NextResponse.json(children);
}
```

### 5.2 Phase D — Calendar Events API

#### File: `app/api/events/route.ts`

**GET** — List events within a date range.

Query parameters (both optional, both ISO datetime strings):
- `from` — if provided, only return events where `endAt >= from`
- `to` — if provided, only return events where `startAt <= to`

```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.CalendarEventWhereInput = {
    userId: session.user.id,
  };

  if (from) {
    where.endAt = { gte: new Date(from) };
  }
  if (to) {
    where.startAt = { lte: new Date(to) };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json(events);
}
```

**POST** — Create a calendar event.

Zod validation schema:
```typescript
const CreateEventSchema = z.object({
  title:   z.string().min(1).max(500),
  notes:   z.string().max(10000).default(""),
  startAt: z.string().datetime({ offset: true }),
  endAt:   z.string().datetime({ offset: true }),
  allDay:  z.boolean().default(false),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5645d4"),
}).refine(
  (data) => new Date(data.startAt) <= new Date(data.endAt),
  { message: "startAt must be before or equal to endAt", path: ["endAt"] }
);
```

Response: created `CalendarEvent` object, HTTP 201.

---

#### File: `app/api/events/[id]/route.ts`

**GET** — Return single event (ownership check required).

**PUT** — Update event fields.

Zod validation schema:
```typescript
const UpdateEventSchema = z.object({
  title:   z.string().min(1).max(500).optional(),
  notes:   z.string().max(10000).optional(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt:   z.string().datetime({ offset: true }).optional(),
  allDay:  z.boolean().optional(),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(
  (data) => {
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) <= new Date(data.endAt);
    }
    return true;
  },
  { message: "startAt must be before or equal to endAt", path: ["endAt"] }
);
```

Response: updated `CalendarEvent` object, HTTP 200.

**DELETE** — Delete event.

Response: HTTP 204, no body.

---

## SECTION 6 — PHASE E: STORE SLICES — TASKS & CALENDAR

### 6.0 Types to Add

Add these type definitions to `lib/slices/tasksSlice.ts`:

```typescript
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
  id:          string;
  userId:      string;
  parentId:    string | null;
  title:       string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  assignee:    string | null;
  dueDate:     string | null;   // ISO string
  createdAt:   string;
  updatedAt:   string;
}
```

Add these to `lib/slices/calendarSlice.ts`:

```typescript
export interface CalendarEvent {
  id:        string;
  userId:    string;
  title:     string;
  notes:     string;
  startAt:   string;   // ISO string, UTC
  endAt:     string;   // ISO string, UTC
  allDay:    boolean;
  color:     string;
  createdAt: string;
  updatedAt: string;
}
```

### 6.1 TabType Extension

In `lib/slices/uiSlice.ts`, change:

```typescript
export type TabType = "NOTE" | "STACK";
```

To:

```typescript
export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR";
```

`TASKS` and `CALENDAR` are singleton tab types. Their tab IDs are fixed string constants defined in Section 7.1.

### 6.2 PendingAction Extension

In `lib/slices/aiSlice.ts`, add to the `PendingAction` union:

```typescript
| {
    type: "create_task";
    data: {
      title:       string;
      description?: string;
      status?:     TaskStatus;
      priority?:   TaskPriority;
      assignee?:   string | null;
      dueDate?:    string | null;
      parentId?:   string | null;
    };
  }
| {
    type: "create_calendar_event";
    data: {
      title:   string;
      notes?:  string;
      startAt: string;
      endAt:   string;
      allDay?: boolean;
      color?:  string;
    };
  }
```

In `commitPendingAction`, add to the existing if-else chain:

```typescript
} else if (pendingAction?.type === "create_task") {
  get().optimisticCreateTask(pendingAction.data);
} else if (pendingAction?.type === "create_calendar_event") {
  get().optimisticCreateCalendarEvent(pendingAction.data);
}
```

### 6.3 TasksSlice Full Implementation

Replace the empty `tasksSlice.ts` with:

```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
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
  // Map of parentId → children. Populated lazily as user expands nodes.
  taskChildrenMap: Record<string, Task[]>;
  // Set of parentIds whose children have been fetched.
  loadedParents: Set<string>;
  currentFocusedTaskId: string | null;

  setTasks:                (tasks: Task[]) => void;
  setCurrentFocusedTaskId: (id: string | null) => void;
  optimisticCreateTask:    (data: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  optimisticPatchTask:     (taskId: string, patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assignee" | "dueDate">>) => void;
  optimisticDeleteTask:    (taskId: string) => void;
  fetchTaskChildren:       (parentId: string) => Promise<void>;
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const createTasksSlice: StateCreator<RootStore, [], [], TasksSlice> = (set, get) => ({
  tasks: [],
  taskChildrenMap: {},
  loadedParents: new Set(),
  currentFocusedTaskId: null,

  setTasks: (tasks) => set({ tasks }),

  setCurrentFocusedTaskId: (id) => set({ currentFocusedTaskId: id }),

  optimisticCreateTask: (data) => {
    const snapshot = {
      tasks: get().tasks,
      taskChildrenMap: get().taskChildrenMap,
    };

    const id = `temp_task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const optimistic: Task = {
      id, userId: "me", createdAt: now, updatedAt: now,
      title: data.title, description: data.description ?? "",
      status: data.status ?? "TODO", priority: data.priority ?? "MEDIUM",
      assignee: data.assignee ?? null, dueDate: data.dueDate ?? null,
      parentId: data.parentId ?? null,
    };

    set((state) => {
      if (data.parentId) {
        // Insert into children map
        const existing = state.taskChildrenMap[data.parentId] ?? [];
        return {
          taskChildrenMap: {
            ...state.taskChildrenMap,
            [data.parentId]: [...existing, optimistic],
          },
          syncState: "SAVING",
          isSaving: true,
        };
      }
      return {
        tasks: [optimistic, ...state.tasks],
        syncState: "SAVING",
        isSaving: true,
      };
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
            const children = (state.taskChildrenMap[data.parentId] ?? [])
              .map((t) => (t.id === id ? created : t));
            return {
              taskChildrenMap: { ...state.taskChildrenMap, [data.parentId]: children },
              syncState: "SAVED", isSaving: false,
            };
          }
          return {
            tasks: state.tasks.map((t) => (t.id === id ? created : t)),
            syncState: "SAVED", isSaving: false,
          };
        });
      })
      .catch(() => {
        set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
        toast.error("Failed to create task");
      });
  },

  optimisticPatchTask: (taskId, patch) => {
    const snapshot = { tasks: get().tasks, taskChildrenMap: get().taskChildrenMap };

    const applyPatch = (arr: Task[]) =>
      arr.map((t) => t.id === taskId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t);

    set((state) => ({
      tasks: applyPatch(state.tasks),
      taskChildrenMap: Object.fromEntries(
        Object.entries(state.taskChildrenMap).map(([k, v]) => [k, applyPatch(v)])
      ),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson<Task>(`/api/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    })
      .then(() => set({ syncState: "SAVED", isSaving: false }))
      .catch(() => {
        set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
        toast.error("Failed to update task");
      });
  },

  optimisticDeleteTask: (taskId) => {
    // Remove only known nodes. DB cascade handles unseen descendants.
    const snapshot = { tasks: get().tasks, taskChildrenMap: get().taskChildrenMap };

    const removeFromMap = (map: Record<string, Task[]>): Record<string, Task[]> => {
      const next: Record<string, Task[]> = {};
      for (const [k, v] of Object.entries(map)) {
        if (k === taskId) continue;                          // drop this node's children entry
        next[k] = v.filter((t) => t.id !== taskId);         // remove from any parent's children list
      }
      return next;
    };

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      taskChildrenMap: removeFromMap(state.taskChildrenMap),
      syncState: "SAVING",
      isSaving: true,
    }));

    void fetch(`/api/tasks/${taskId}`, { method: "DELETE", credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error();
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({ tasks: snapshot.tasks, taskChildrenMap: snapshot.taskChildrenMap, syncState: "ERROR", isSaving: false });
        toast.error("Failed to delete task");
      });
  },

  fetchTaskChildren: async (parentId) => {
    // Skip if already loaded
    if (get().loadedParents.has(parentId)) return;

    try {
      const children = await apiJson<Task[]>(`/api/tasks/${parentId}/children`);
      set((state) => ({
        taskChildrenMap: { ...state.taskChildrenMap, [parentId]: children },
        loadedParents: new Set([...state.loadedParents, parentId]),
      }));
    } catch {
      toast.error("Failed to load subtasks");
    }
  },
});
```

### 6.4 CalendarSlice Full Implementation

Replace the empty `calendarSlice.ts` with:

```typescript
import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
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
  optimisticPatchCalendarEvent:  (eventId: string, patch: Partial<Pick<CalendarEvent, "title" | "notes" | "startAt" | "endAt" | "allDay" | "color">>) => void;
  optimisticDeleteCalendarEvent: (eventId: string) => void;
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) { const text = await res.text().catch(() => ""); throw new Error(text || `Request failed: ${res.status}`); }
  return (await res.json()) as T;
}

export const createCalendarSlice: StateCreator<RootStore, [], [], CalendarSlice> = (set, get) => ({
  calendarEvents: [],
  setCalendarEvents: (events) => set({ calendarEvents: events }),

  optimisticCreateCalendarEvent: (data) => {
    const snapshot = get().calendarEvents;
    const id = `temp_event_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const optimistic: CalendarEvent = { id, userId: "me", createdAt: now, updatedAt: now, ...data };

    set((state) => ({ calendarEvents: [...state.calendarEvents, optimistic], syncState: "SAVING", isSaving: true }));

    void apiJson<CalendarEvent>("/api/events", { method: "POST", body: JSON.stringify(data) })
      .then((created) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.map((e) => (e.id === id ? created : e)),
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
      calendarEvents: state.calendarEvents.map((e) =>
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
      calendarEvents: state.calendarEvents.filter((e) => e.id !== eventId),
      syncState: "SAVING", isSaving: true,
    }));

    void fetch(`/api/events/${eventId}`, { method: "DELETE", credentials: "include" })
      .then((res) => { if (!res.ok) throw new Error(); set({ syncState: "SAVED", isSaving: false }); })
      .catch(() => {
        set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
        toast.error("Failed to delete event");
      });
  },
});
```

### 6.5 Re-export New Types from `store/useStore.ts`

Add to the existing re-export block:

```typescript
export type { Task, TaskStatus, TaskPriority } from "@/lib/slices/tasksSlice";
export type { CalendarEvent } from "@/lib/slices/calendarSlice";
```

---

## SECTION 7 — PHASE F: SIDEBAR, TABBAR & ROUTING

### 7.0 Singleton Tab Constants

Define these constants. They are referenced in Sidebar, TabBar, and page components.

**Create file `lib/constants.ts`:**

```typescript
export const TASKS_TAB_ID     = "singleton-tasks" as const;
export const CALENDAR_TAB_ID  = "singleton-calendar" as const;
```

### 7.1 Sidebar Modifications

**File to modify:** `components/workspace/Sidebar.tsx`

**Step 1 — Add imports:**

```typescript
import { CheckSquare, CalendarDays } from "lucide-react";
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";
```

**Step 2 — Add `openTab` to the destructured store values:**

The current destructure is:
```typescript
const { notes, stacks, setNotes, setStacks, currentNoteId, currentStackId, optimisticCreateNote } = useWorkspaceStore();
```

Change to:
```typescript
const { notes, stacks, setNotes, setStacks, currentNoteId, currentStackId, optimisticCreateNote, openTab } = useWorkspaceStore();
```

**Step 3 — Add two buttons to the ribbon** (`w-12` div), after the existing Stack (Database icon) button and before the `flex-1` spacer div:

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

**No changes to the explorer panel.** Tasks and Calendar are singleton views and must not appear in the file list.

### 7.2 TabBar Modifications

**File to modify:** `components/workspace/TabBar.tsx`

**Add import:**
```typescript
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";
```

**Replace the inline href logic** inside the `<Link>` component. Currently the href is generated inline as a template literal. Extract it into a function defined outside the component:

```typescript
function getTabHref(tab: OpenTab): string {
  switch (tab.type) {
    case "NOTE":     return `/workspace/notes/${tab.id}`;
    case "STACK":    return `/workspace/stacks/${tab.id}`;
    case "TASKS":    return `/workspace/tasks`;
    case "CALENDAR": return `/workspace/calendar`;
    default:         return `/workspace`;
  }
}
```

Replace the existing `<Link href={...}>` with `<Link href={getTabHref(tab)}>`.

### 7.3 New Page Routes

Create these two files. Both are inside the `(workspace)` route group and automatically inherit `workspace/layout.tsx`.

```
app/(workspace)/workspace/tasks/page.tsx
app/(workspace)/workspace/calendar/page.tsx
```

Both are `"use client"` components. Implementation is specified in Sections 8 and 9.

---

## SECTION 8 — PHASE G: TASKS UI

### 8.0 Global CSS — No Change Required for Tasks

No CSS imports needed for the Tasks feature.

### 8.1 Tasks Page: `app/(workspace)/workspace/tasks/page.tsx`

On mount:
1. Call `openTab(TASKS_TAB_ID, "TASKS", "Tasks")` from the store.
2. Fetch `GET /api/tasks` → call `setTasks(data)`.

Layout:
```
div.h-full.w-full.bg-[#1e1e1e].overflow-y-auto
  (same scrollbar classes as notes page)
  div.max-w-4xl.mx-auto.px-8.py-8
    Header: "Tasks" h1 + "New Task" Button (primary color)
    FilterBar: status filter (All / Todo / In Progress / Done)
    TaskList: root-level tasks rendered as TaskItem components
    TaskDialog (controlled open/close state)
```

State in this component:
```typescript
const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
const [dialogOpen, setDialogOpen] = useState(false);
const [editingTask, setEditingTask] = useState<Task | null>(null);
```

Filtered tasks:
```typescript
const visibleTasks = useMemo(() =>
  filterStatus === "ALL"
    ? tasks
    : tasks.filter((t) => t.status === filterStatus),
  [tasks, filterStatus]
);
```

### 8.2 TaskItem Component

**File:** `components/workspace/TaskItem.tsx`

This component renders a single task and handles recursive expansion. It is self-referential — an expanded `TaskItem` renders child `TaskItem` components.

Props:
```typescript
interface TaskItemProps {
  task: Task;
  depth: number;   // 0 = root. Used for left padding: depth * 20px
  onEdit: (task: Task) => void;
}
```

Internal state:
```typescript
const [expanded, setExpanded] = useState(false);
```

Children:
```typescript
const children = taskChildrenMap[task.id] ?? [];
const isLoaded = loadedParents.has(task.id);
```

On expand toggle:
```typescript
const handleExpand = async () => {
  if (!expanded && !isLoaded) {
    await fetchTaskChildren(task.id);
  }
  setExpanded((prev) => !prev);
};
```

Visual structure:
```
div (paddingLeft: depth * 20px)
  div.flex.items-center.gap-2.group
    ChevronRight/ChevronDown icon button → handleExpand (hidden if leaf with no children yet loaded, show if has children or isLoaded and children.length > 0)
    StatusCircle button → cycle status: TODO → IN_PROGRESS → DONE → TODO
    Title text (line-through + text-zinc-500 when DONE)
    Priority badge
    Assignee text (text-xs text-zinc-400, if not null)
    DueDate text (text-xs, red if past due and status !== DONE)
    Edit icon button (opacity-0 group-hover:opacity-100) → onEdit(task)
    Delete icon button (opacity-0 group-hover:opacity-100, Trash2 icon) → optimisticDeleteTask(task.id)
    Plus icon button (opacity-0 group-hover:opacity-100) → open TaskDialog in create-subtask mode with parentId = task.id

  {expanded && children.map(child =>
    <TaskItem key={child.id} task={child} depth={depth + 1} onEdit={onEdit} />
  )}
```

Status circle visual:
- `TODO`: empty circle, `border-2 border-zinc-600 rounded-full w-5 h-5`
- `IN_PROGRESS`: half-filled, `border-2 border-yellow-500 bg-yellow-500/30 rounded-full w-5 h-5`
- `DONE`: filled checkmark, `bg-primary rounded-full w-5 h-5 flex items-center justify-center` with `Check` icon (lucide)

Priority badge classes:
- `HIGH`: `text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400`
- `MEDIUM`: `text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400`
- `LOW`: `text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400`

### 8.3 TaskDialog Component

**File:** `components/workspace/TaskDialog.tsx`

Uses `@radix-ui/react-dialog` (already installed). Uses `react-hook-form` + `zod` (already installed).

Props:
```typescript
interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;           // defined = edit mode
  parentId?: string;     // defined = create subtask mode
  onSubmit: (data: TaskFormData) => void;
}

interface TaskFormData {
  title:       string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  assignee:    string;
  dueDate:     string;   // "YYYY-MM-DD" from date input, or "" for no date
}
```

Client-side Zod schema:
```typescript
const TaskFormSchema = z.object({
  title:       z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000),
  status:      z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority:    z.enum(["LOW", "MEDIUM", "HIGH"]),
  assignee:    z.string().max(200),
  dueDate:     z.string(),
});
```

Dialog title: "New Task" / "New Subtask" / "Edit Task" based on props.

Fields:
- **Title**: `<Input>` component
- **Description**: `<Textarea>` component
- **Status**: three button pills (Todo / In Progress / Done), one selected at a time
- **Priority**: three button pills (Low / Medium / High), one selected at a time
- **Assignee**: `<Input>` with placeholder "Assign to..."
- **Due Date**: native `<input type="date">` styled to match: `bg-zinc-800/50 border border-zinc-700 rounded px-3 py-2 text-sm text-slate-300 w-full`
- **Submit**: "Create Task", "Create Subtask", or "Save Changes"

On submit, convert `dueDate` string:
```typescript
const dueDate = formData.dueDate
  ? new Date(formData.dueDate + "T00:00:00.000Z").toISOString()
  : null;
```

---

## SECTION 9 — PHASE H: CALENDAR UI

### 9.0 Global CSS — Required

Add to `app/globals.css` at the **top of the file**, before `@tailwind base`:

```css
@import 'react-big-calendar/lib/css/react-big-calendar.css';
```

Then add these dark-theme overrides at the **bottom** of `app/globals.css`:

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

### 9.1 Localizer Setup

Create **`lib/calendarLocalizer.ts`**:

```typescript
import { dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});
```

This file is imported by the Calendar page. It must not be defined inside a component.

### 9.2 Calendar Page: `app/(workspace)/workspace/calendar/page.tsx`

On mount:
1. Call `openTab(CALENDAR_TAB_ID, "CALENDAR", "Calendar")`.
2. Compute the visible date range for the default month view (first day of current month to last day).
3. Fetch `GET /api/events?from=<ISO>&to=<ISO>` → `setCalendarEvents(data)`.

State in this component:
```typescript
const [dialogOpen,    setDialogOpen]    = useState(false);
const [editingEvent,  setEditingEvent]  = useState<CalendarEvent | null>(null);
const [defaultStart,  setDefaultStart]  = useState<Date | undefined>();
const [defaultEnd,    setDefaultEnd]    = useState<Date | undefined>();
const fetchTimeoutRef = useRef<NodeJS.Timeout>();
```

**Fetch function with 300ms debounce:**
```typescript
const fetchEvents = useCallback((from: Date, to: Date) => {
  clearTimeout(fetchTimeoutRef.current);
  fetchTimeoutRef.current = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to:   to.toISOString(),
      });
      const res = await fetch(`/api/events?${params}`, { credentials: "include" });
      const data = await res.json();
      setCalendarEvents(data);
    } catch {
      toast.error("Failed to load events");
    }
  }, 300);
}, [setCalendarEvents]);
```

Clean up timeout on unmount:
```typescript
useEffect(() => () => clearTimeout(fetchTimeoutRef.current), []);
```

**Event mapping** — `react-big-calendar` requires `{ title, start, end, allDay, resource }`:
```typescript
const rbcEvents = useMemo(() =>
  calendarEvents.map((e) => ({
    title:    e.title,
    start:    new Date(e.startAt),
    end:      new Date(e.endAt),
    allDay:   e.allDay,
    resource: e,       // Full CalendarEvent attached for access in handlers
  })),
  [calendarEvents]
);
```

**DnD Setup:**
```typescript
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const DnDCalendar = withDragAndDrop(Calendar);
```

Wrap the calendar in `<DndProvider backend={HTML5Backend}>`.

**On event drop (drag to reschedule):**
```typescript
const handleEventDrop = ({ event, start, end, allDay }: EventInteractionArgs) => {
  const calEvent: CalendarEvent = event.resource;
  optimisticPatchCalendarEvent(calEvent.id, {
    startAt: (start as Date).toISOString(),
    endAt:   (end as Date).toISOString(),
    allDay:  allDay ?? calEvent.allDay,
  });
};
```

**On event resize:**
```typescript
const handleEventResize = ({ event, start, end }: EventInteractionArgs) => {
  const calEvent: CalendarEvent = event.resource;
  optimisticPatchCalendarEvent(calEvent.id, {
    startAt: (start as Date).toISOString(),
    endAt:   (end as Date).toISOString(),
  });
};
```

**On slot select (create new event):**
```typescript
const handleSelectSlot = ({ start, end }: SlotInfo) => {
  setDefaultStart(start as Date);
  setDefaultEnd(end as Date);
  setEditingEvent(null);
  setDialogOpen(true);
};
```

**On event click (edit):**
```typescript
const handleSelectEvent = (event: { resource: CalendarEvent }) => {
  setEditingEvent(event.resource);
  setDefaultStart(undefined);
  setDefaultEnd(undefined);
  setDialogOpen(true);
};
```

**On navigate (view range change):**
```typescript
const handleNavigate = (date: Date, view: string) => {
  const { from, to } = computeVisibleRange(date, view);
  fetchEvents(from, to);
};
```

**`computeVisibleRange` helper** (define outside component):
```typescript
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";

function computeVisibleRange(date: Date, view: string): { from: Date; to: Date } {
  switch (view) {
    case "month":
      // Month view shows ~6 weeks. Expand by one week on each side to catch edge events.
      return {
        from: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
        to:   endOfWeek(endOfMonth(date),     { weekStartsOn: 1 }),
      };
    case "week":
      return {
        from: startOfWeek(date, { weekStartsOn: 1 }),
        to:   endOfWeek(date,   { weekStartsOn: 1 }),
      };
    case "agenda":
      return { from: date, to: addDays(date, 30) };
    default:
      return { from: startOfMonth(date), to: endOfMonth(date) };
  }
}
```

**Full `<DnDCalendar>` props:**
```tsx
<DndProvider backend={HTML5Backend}>
  <DnDCalendar
    localizer={calendarLocalizer}
    events={rbcEvents}
    defaultView="month"
    views={["month", "week", "agenda"]}
    style={{ height: "100%", padding: "16px" }}
    eventPropGetter={(event) => ({
      style: {
        backgroundColor: (event as any).resource.color,
        borderColor:     (event as any).resource.color,
        color:           "#ffffff",
      },
    })}
    selectable
    resizable
    onSelectSlot={handleSelectSlot}
    onSelectEvent={handleSelectEvent}
    onEventDrop={handleEventDrop}
    onEventResize={handleEventResize}
    onNavigate={handleNavigate}
    onView={(view) => {
      // Re-fetch for current date with new view
      handleNavigate(new Date(), view);
    }}
  />
</DndProvider>
```

### 9.3 EventDialog Component

**File:** `components/workspace/EventDialog.tsx`

Uses `@radix-ui/react-dialog` (already installed). Uses `react-hook-form` + `zod`.

Props:
```typescript
interface EventDialogProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  event?:         CalendarEvent;
  defaultStart?:  Date;
  defaultEnd?:    Date;
  onSubmit:       (data: EventFormData) => void;
  onDelete?:      () => void;
}

interface EventFormData {
  title:   string;
  notes:   string;
  startAt: string;   // ISO string
  endAt:   string;   // ISO string
  allDay:  boolean;
  color:   string;   // hex
}
```

Client-side Zod schema:
```typescript
const EventFormSchema = z.object({
  title:   z.string().min(1, "Title is required").max(500),
  notes:   z.string().max(10000),
  startAt: z.string().min(1, "Start time required"),
  endAt:   z.string().min(1, "End time required"),
  allDay:  z.boolean(),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
```

Fields:
- **Title**: `<Input>`
- **Notes**: `<Textarea>`
- **All Day**: native `<input type="checkbox">` — when checked, show `<input type="date">` for start/end; when unchecked, show `<input type="datetime-local">`
- **Color**: 6 swatch buttons, no external library. Colors: `["#5645d4", "#e03131", "#1aae39", "#dd5b00", "#2a9d99", "#ff64c8"]`. Selected swatch shows `ring-2 ring-offset-2 ring-offset-zinc-900`
- **Delete button**: only rendered in edit mode. Uses `window.confirm("Delete this event?")` before calling `onDelete`. Styled with `text-red-400 hover:text-red-300`

`datetime-local` input value format conversion:
```typescript
// Date → input value
const toDatetimeLocal = (iso: string) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

// Input value → ISO
const fromDatetimeLocal = (val: string) =>
  val ? new Date(val).toISOString() : "";
```

---

## SECTION 10 — PHASE I: VOICE INTEGRATION — NEXT.JS BFF

### 10.0 Context: How PushToTalk Works Today

`PushToTalk.tsx` determines context from `currentNoteId` and `currentStackId`. If neither is set, it shows an error. Context is sent to the BFF as `contextType` (`"NOTE"` or `"STACK"`) and `contextId`.

### 10.1 Store Additions for Voice Context

In `lib/slices/uiSlice.ts`, add:

```typescript
// State
currentFocusedTaskId: string | null;   // tracks which task has keyboard/click focus on Tasks page

// Action
setCurrentFocusedTaskId: (id: string | null) => void;
```

Implementation:
```typescript
currentFocusedTaskId: null,
setCurrentFocusedTaskId: (id) => set({ currentFocusedTaskId: id }),
```

**Note:** `currentFocusedTaskId` is set by the `TaskItem` component when a task row is clicked/focused, and cleared when the Tasks page unmounts.

### 10.2 PushToTalk Modifications

**File to modify:** `components/shared/PushToTalk.tsx`

Add to store destructure:
```typescript
const {
  // existing...
  currentFocusedTaskId,
  taskChildrenMap,
} = useWorkspaceStore();
```

Replace the context determination logic:

```typescript
// Existing logic (keep):
const contextType = currentNoteId
  ? "NOTE"
  : currentStackId
  ? "STACK"
  : null;
const contextId = currentNoteId || currentStackId;

// New logic (replace the above with):
let contextType: string | null = null;
let contextId: string | null = null;

if (currentNoteId) {
  contextType = "NOTE";
  contextId = currentNoteId;
} else if (currentStackId) {
  contextType = "STACK";
  contextId = currentStackId;
} else {
  // Determine from active tab type
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  if (activeTab?.type === "TASKS") {
    contextType = "TASK";
    contextId = currentFocusedTaskId ?? "none";
  } else if (activeTab?.type === "CALENDAR") {
    contextType = "CALENDAR";
    contextId = "none";
  }
}
```

Add `openTabs` and `activeTabId` to the store destructure.

**Change the error condition:**
```typescript
// Old:
if (!contextType || !contextId) {
  toast.error("Please select a note or stack first");
  return;
}

// New:
if (!contextType) {
  toast.error("Please select a note, stack, tasks, or calendar first");
  return;
}
```

**Add task context payload** to the FormData:
```typescript
if (contextType === "TASK" && currentFocusedTaskId) {
  // Send the focused task's data so AI knows which task is active
  const parentTask = [
    ...tasks,
    ...Object.values(taskChildrenMap).flat(),
  ].find((t) => t.id === currentFocusedTaskId);

  if (parentTask) {
    formData.append("task_context", JSON.stringify({
      focusedTaskId:    parentTask.id,
      focusedTaskTitle: parentTask.title,
    }));
  }
}
```

Add `tasks` to the store destructure.

**Extend the action handler** after the existing `if/else if` blocks:
```typescript
} else if (action === "create_task" && updatedData) {
  setPendingAction({
    type: "create_task",
    data: updatedData,
  });
} else if (action === "create_calendar_event" && updatedData) {
  setPendingAction({
    type: "create_calendar_event",
    data: updatedData,
  });
}
```

### 10.3 Voice BFF Route Modification

**File to modify:** `app/api/voice/process/route.ts`

Add extraction of new fields from FormData (after the existing field extractions):

```typescript
const taskContext = formData.get("task_context") as string;
```

Forward to FastAPI:
```typescript
if (taskContext) {
  fastApiFormData.append("task_context", taskContext);
}
```

---

## SECTION 11 — PHASE J: FASTAPI MICROSERVICE CONTRACT

### 11.0 Scope

This section specifies what the FastAPI Python service must do to support Tasks and Calendar voice commands. The Next.js side is complete after Phase I. This section is the contract for the Python service modification.

### 11.1 New Incoming Fields

The FastAPI endpoint `POST /api/v1/voice/process` will now receive two additional optional form fields:

| Field | Type | When Present |
|---|---|---|
| `context_type` | string | Now includes `"TASK"` and `"CALENDAR"` in addition to existing values |
| `task_context` | JSON string | When `context_type == "TASK"` and a task is focused |

`task_context` JSON structure:
```json
{
  "focusedTaskId": "uuid-string",
  "focusedTaskTitle": "string"
}
```

### 11.2 New GPT-4o Tool Definitions

Add these two tool definitions to the existing GPT-4o tool call configuration:

```python
{
  "type": "function",
  "function": {
    "name": "create_task",
    "description": "Create a new task or subtask. If focusedTaskId is present in context, this creates a subtask under the focused task.",
    "parameters": {
      "type": "object",
      "properties": {
        "title":       { "type": "string",  "description": "Task title" },
        "description": { "type": "string",  "description": "Task description" },
        "status":      { "type": "string",  "enum": ["TODO", "IN_PROGRESS", "DONE"] },
        "priority":    { "type": "string",  "enum": ["LOW", "MEDIUM", "HIGH"] },
        "assignee":    { "type": "string",  "description": "Free text assignee name" },
        "dueDate":     { "type": "string",  "description": "ISO 8601 datetime string or null" },
        "parentId":    { "type": "string",  "description": "UUID of parent task if creating subtask, else null" }
      },
      "required": ["title"]
    }
  }
},
{
  "type": "function",
  "function": {
    "name": "create_calendar_event",
    "description": "Create a new calendar event.",
    "parameters": {
      "type": "object",
      "properties": {
        "title":   { "type": "string" },
        "notes":   { "type": "string" },
        "startAt": { "type": "string", "description": "ISO 8601 datetime string" },
        "endAt":   { "type": "string", "description": "ISO 8601 datetime string" },
        "allDay":  { "type": "boolean" },
        "color":   { "type": "string", "description": "Hex color string #RRGGBB" }
      },
      "required": ["title", "startAt", "endAt"]
    }
  }
}
```

### 11.3 System Prompt Additions

Add the following to the existing GPT-4o system prompt, after the existing context instructions:

```
When context_type is "TASK":
- The user is working in the Tasks view.
- If task_context is provided, there is a focused task with the given title and ID.
- Use the "create_task" tool to create tasks.
- If a task is focused and the user says "add subtask" or similar, set parentId to the focusedTaskId from task_context.
- If no task is focused, create a root task (parentId = null).
- For due dates, interpret relative expressions ("tomorrow", "next Friday") relative to today's date.
- Return dueDate as a UTC ISO 8601 string.

When context_type is "CALENDAR":
- The user is working in the Calendar view.
- Use the "create_calendar_event" tool.
- Interpret relative time expressions ("tomorrow at 3pm", "next Monday") relative to today's date and the user's apparent timezone.
- Default event duration is 1 hour if end time is not specified.
- Return startAt and endAt as UTC ISO 8601 strings.
```

### 11.4 FastAPI Response Payload — Extended

The existing response shape is:
```json
{ "transcript": "...", "aiReply": "...", "action": "...", "updatedData": {} }
```

This shape does not change. The `action` field will now also carry `"create_task"` and `"create_calendar_event"` as values, with `updatedData` containing the tool call arguments. The Next.js BFF already handles this generically — no BFF changes are needed beyond Phase I.

---

## SECTION 12 — COMPLETE FILE MANIFEST

### New Files to Create

```
lib/constants.ts
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
prisma/schema.prisma               → Section 4
lib/store.ts                       → Section 3.4
store/useStore.ts                  → Section 6.5
components/workspace/Sidebar.tsx   → Section 7.1
components/workspace/TabBar.tsx    → Section 7.2
components/shared/PushToTalk.tsx   → Section 10.2
app/api/voice/process/route.ts     → Section 10.3
app/globals.css                    → Section 9.0
```

### Files That Must Not Be Changed

Every file not listed above. Specifically: all existing page components, all existing API routes, all existing UI components, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`.

---

## SECTION 13 — SECURITY FINAL CHECKLIST

Before considering implementation complete, verify each API route against this checklist:

| Check | Requirement |
|---|---|
| Auth first | `auth()` called before any DB or business logic |
| No user-supplied userId | `userId` always from `session.user.id` |
| Ownership verified | Single-resource routes check `record.userId === session.user.id` |
| Zod validation | All write routes validate body with Zod before Prisma |
| 404 not 403 on ownership fail | Prevents existence disclosure |
| No raw SQL | No `$queryRaw` with string interpolation |
| Date inputs validated | All datetime fields go through Zod `.datetime({ offset: true })` |
| Color inputs validated | `color` field validated with `/^#[0-9A-Fa-f]{6}$/` |
| parentId verified | POST /api/tasks verifies parentId ownership before creating child |
