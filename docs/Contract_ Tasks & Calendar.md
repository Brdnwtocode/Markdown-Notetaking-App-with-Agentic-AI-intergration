# Contract: Tasks & Calendar

# **Technical Design Contract: Tasks & Calendar Features**

## **For AI Coding Agents**

This contract specifies exact implementation requirements for adding **Tasks** and **Calendar** features to the existing Markdown Notetaking App with Agentic AI. You must follow every section precisely. Do not assume, deviate, or optimize differently unless explicitly instructed.

***

## **1. Overview**

* **Existing stack:** Next.js (App Router), TypeScript, Zustand (monolithic store), Prisma (SQLite/Postgres), FastAPI microservice for voice/AI.
* **New features:** Tasks (hierarchical with unlimited subtasks) and Calendar (personal events, drag-drop, lazy loading).
* **Key constraints:** Singleton tabs, context-aware voice (focusedTaskId), flat task storage with client-side tree building, lazy load calendar events by date range.
* **Design:** Inherit existing UI components and styling (Tailwind CSS, same sidebar, same TabBar pattern).

***

## **2. Prerequisite: Zustand Store Refactor into Slices**

**Do not** add Tasks/Calendar directly into the existing monolithic `store.ts`. Refactor first, then add features.

### **2.1 Slice Structure**

Create `lib/store/slices/` with:

* `notesSlice.ts` – move all note-related state and actions
* `stacksSlice.ts` – move all stack-related state and actions
* `voiceSlice.ts` – voice recording state, AI reply state
* `uiSlice.ts` – cursor position, active tab IDs, sidebar open state, sync status
* `tasksSlice.ts` – (will be added, see section 3)
* `calendarSlice.ts` – (will be added, see section 4)

### **2.2 Composing the Store**

Use Zustand's `create` with slice composition pattern:

typescript

```
// lib/store/index.ts
import { create } from 'zustand';
import { createNotesSlice, NotesSlice } from './slices/notesSlice';
import { createStacksSlice, StacksSlice } from './slices/stacksSlice';
import { createVoiceSlice, VoiceSlice } from './slices/voiceSlice';
import { createUiSlice, UiSlice } from './slices/uiSlice';

export type StoreState = NotesSlice & StacksSlice & VoiceSlice & UiSlice;

export const useAppStore = create<StoreState>()((...a) => ({
  ...createNotesSlice(...a),
  ...createStacksSlice(...a),
  ...createVoiceSlice(...a),
  ...createUiSlice(...a),
}));
```

**After refactor, before adding new features**, manually verify (see section 7). No existing behavior must break.

***

## **3. Tasks Feature**

### **3.1 Prisma Schema**

Add to `prisma/schema.prisma`:

prisma

```
model Task {
  id          String   @id @default(cuid())
  title       String
  description String?   // rich text or plain? Use String for now
  completed   Boolean  @default(false)
  priority    String   @default("medium") // "low", "medium", "high"
  assignee    String?  // free text, self-label only
  parentId    String?  // null for root tasks
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  parent   Task?  @relation("TaskHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children Task[] @relation("TaskHierarchy")
}
```

**Run** `prisma migrate dev` after adding.

### **3.2 API Routes**

Create `app/api/tasks/route.ts`:

* `GET /api/tasks` → returns all tasks (flat list) for current user (associate with userId if auth exists; if not, use session or global)
* `POST /api/tasks` → create task (body: { title, description?, priority?, assignee?, parentId? })
* `PUT /api/tasks/[id]` → update task (body: partial fields, including completed)
* `DELETE /api/tasks/[id]` → delete task (cascade handled by DB)

No nested endpoints needed.

### **3.3 Store Slice:** **`tasksSlice.ts`**

typescript

```
export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  assignee?: string;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TasksSlice {
  tasks: Task[];                    // flat list from API
  focusedTaskId: string | null;    // for voice context
  isLoadingTasks: boolean;
  fetchTasks: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;  // optimistic removal of self and known children (see mitigation 3.5)
  setFocusedTaskId: (id: string | null) => void;
  // Helper to build tree on demand (not stored)
}
```

**Optimistic cascade on delete:** Remove the deleted task from `tasks` array. Also remove any task whose `parentId` equals the deleted id (recursively, but only for tasks currently in the store). The DB will delete all descendants regardless. After API success, do nothing; after API failure, refetch tasks.

### **3.4 Client-Side Tree Building**

Create a memoized selector in the component using `useMemo`:

typescript

```
function buildTaskTree(tasks: Task[]): TaskNode[] {
  const taskMap = new Map<string, Task & { children: TaskNode[] }>();
  const roots: TaskNode[] = [];

  // First pass: create map entries with empty children
  for (const task of tasks) {
    taskMap.set(task.id, { ...task, children: [] });
  }
  // Second pass: attach children to parents
  for (const task of tasks) {
    const node = taskMap.get(task.id)!;
    if (task.parentId && taskMap.has(task.parentId)) {
      taskMap.get(task.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
```

Use this in the `TaskList` component. Performance: O(n) with Map.

### **3.5 UI Components**

* `app/workspace/tasks/page.tsx` – main tasks page (singleton tab, no ID in URL). Use `useAppStore` to get tasks, focusedTaskId.
* `components/tasks/TaskTree.tsx` – recursive component rendering roots and children.
* `components/tasks/TaskItem.tsx` – displays title, priority, assignee, checkbox, buttons for add subtask, edit, delete.
* `components/tasks/TaskForm.tsx` – modal or inline form for create/edit with title, description, priority dropdown, assignee text field, parent selection (optional, for root tasks only; subtask creation uses the parent's focused context).

**Focused task:** When a task is selected/clicked, call `setFocusedTaskId(task.id)`. Highlight it visually.

### **3.6 Voice Integration for Tasks**

#### **3.6.1 Store additions:** **`focusedTaskId`** **(already in** **`tasksSlice`)**

#### **3.6.2 Modify** **`components/PushToTalk.tsx`**

When sending audio to BFF, include additional context:

typescript

```
const context = {
  type: "TASK",  // or "CALENDAR", "NOTE", "STACK"
  focusedTaskId: useAppStore.getState().focusedTaskId,
  // ... existing cursorPosition for notes if applicable
};
```

Send this to `/api/voice/process` (existing endpoint) in the request body.

#### **3.6.3 FastAPI modifications (you handle separately – but outline here for completeness)**

The Python microservice must:

* Add `TASK` and `CALENDAR` to allowed `context_type` enum.
* For `TASK`: use `focused_task_id` (rename field to snake\_case) to resolve parent for "add subtask" commands. If no `focused_task_id`, create root-level tasks.
* Define prompt templates for task operations: create, update, delete, complete, add subtask.
* Return actions in the same format as existing note/stack actions (e.g., `{ action: "create_task", data: {...} }`).

**Note:** This contract does not detail the FastAPI changes; they are your responsibility as the repo owner. But the Next.js side expects the same action format.

***

## **4. Calendar Feature**

### **4.1 Prisma Schema**

prisma

```
model CalendarEvent {
  id          String   @id @default(cuid())
  title       String
  description String?
  start       DateTime
  end         DateTime
  allDay      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### **4.2 API Routes**

Create `app/api/calendar/route.ts`:

* `GET /api/calendar?from=ISO&to=ISO` → returns events whose start or end falls within \[from, to]. No auth unless required.
* `POST /api/calendar` → create event
* `PUT /api/calendar/[id]` → update event
* `DELETE /api/calendar/[id]` → delete event

### **4.3 Store Slice:** **`calendarSlice.ts`**

typescript

```
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface CalendarSlice {
  events: CalendarEvent[];
  isLoadingEvents: boolean;
  fetchEvents: (from: Date, to: Date) => Promise<void>; // merges into events, does not replace all
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  clearEventsNotInRange: (from: Date, to: Date) => void; // optional: keep cache limited
}
```

**Note:** The `events` array accumulates fetched ranges. To avoid unbounded growth, implement LRU or simply refetch on mount and clear old ranges after a threshold. Simpler: fetch only current month, and when user navigates, fetch new range and replace events entirely (clear previous). **Recommended:** Replace entire events array on each range fetch (simpler, less cache bugs). Accept that navigation causes refetch.

### **4.4 Lazy Loading with Debouncing**

Create `components/calendar/CalendarView.tsx` using `react-big-calendar`. Use `moment` or `date-fns` localizer (already present? Check package.json; if not, install `date-fns` and `@date-fns/tz`).

**Debounce logic:**

typescript

```
import { useDebouncedCallback } from 'use-debounce'; // or implement with setTimeout

const fetchRange = useDebouncedCallback(async (range: { start: Date; end: Date }) => {
  await fetchEvents(range.start, range.end);
}, 300);
```

Attach to calendar's `onNavigate` and `onView` events.

### **4.5 Drag-and-Drop**

Install:

bash

```
npm install react-dnd react-dnd-html5-backend
```

Wrap the calendar component with `DndProvider` (in `app/workspace/calendar/page.tsx`). Use `react-big-calendar`'s `withDragAndDrop` HOC:

typescript

```
import { withDragAndDrop } from 'react-big-calendar';
const DragAndDropCalendar = withDragAndDrop(Calendar);
```

Implement `onEventDrop` and `onEventResize` to call API update.

### **4.6 CSS Import**

In `app/globals.css`, add at the top:

css

```
@import 'react-big-calendar/lib/css/react-big-calendar.css';
```

Do **not** import inside any component.

### **4.7 UI Page**

* `app/workspace/calendar/page.tsx` – singleton tab, URL `/workspace/calendar`.
* Render `DragAndDropCalendar` with events from store, localizer, views={\['month', 'week', 'day']}.

***

## **5. Tab Bar Modifications for Singleton Tabs**

Edit `components/TabBar.tsx`:

typescript

```
function getTabHref(tab: Tab): string {
  switch (tab.type) {
    case "NOTE":
      return `/workspace/notes/${tab.id}`;
    case "STACK":
      return `/workspace/stacks/${tab.id}`;
    case "TASKS":
      return `/workspace/tasks`;
    case "CALENDAR":
      return `/workspace/calendar`;
    default:
      return `/workspace/notes/${tab.id}`;
  }
}
```

In `WorkspaceLayout` or wherever `openTab` is defined, when sidebar button for Tasks/Calendar is clicked, call:

typescript

```
openTab({
  type: "TASKS",
  id: "singleton-tasks",   // fixed id for internal use
  title: "Tasks",
});
```

Similarly for Calendar with id `"singleton-calendar"`.

**URL syncing:** Add a `useEffect` in the root layout that listens to `pathname` and ensures the store's `activeTabs` reflect the current singleton tab if none exists. This handles back/forward navigation.

***

## **6. FastAPI Modifications (Outline for Owner)**

You must implement these in the Python microservice:

* Add `TASK` and `CALENDAR` to `ContextType` enum.
* For `TASK`: use `focused_task_id` to resolve parent for "add subtask" commands. If not provided, create root. Support commands: "add task X with priority high", "mark task X as done", "add subtask to current task: Y", "delete task X".
* For `CALENDAR`: support "add event tomorrow at 3pm called Review", "move event X to Monday", "delete event X". Typically requires date parsing.

Return actions as JSON objects that match existing pattern, e.g.:

json

```
{ "action": "create_task", "data": { "title": "...", "priority": "high", "parentId": "..." } }
```

***

## **7. Manual Verification Checklist (No Automated Tests)**

After completing refactor and before adding features, verify:

* Create a new note, type content, see it saved.
* Edit an existing note, see changes persist.
* Create a stack, add rows.
* Switch between notes/stacks via tabs, no crashes.
* Voice recording: press button, speak, get AI reply.
* Reload page – state restores correctly (sync works).

After adding Tasks:

* Create root tasks, edit, delete.
* Add subtasks (unlimited depth) – verify tree renders correctly.
* Mark task as completed – UI updates, store persists.
* Delete a task with children – verify UI removes only known children, no errors.
* Voice: “add task review PR tomorrow” (global) – creates root task.
* Voice: focus a task (click on it), then “add subtask write tests” – creates subtask under focused task.
* Voice: “mark current task as done” – toggles focused task.

After adding Calendar:

* View month grid, navigate to prev/next month – events load with debounce.
* Create event by clicking on a time slot – modal appears, event appears.
* Drag event to new time – updates start/end, API called.
* Resize event – updates end.
* Delete event – removed.
* Voice: “add event tomorrow at 2pm called design review” – creates event (FastAPI must handle).
* Voice: “move event design review to Friday” – updates.

***

## **8. Risk Mitigations & Edge Cases (Explicit Instructions)**

### **8.1 Optimistic Task Delete Cascade**

Implement `deleteTask` in store as:

typescript

```
deleteTask: async (id: string) => {
  const originalTasks = get().tasks;
  // Remove target task
  let newTasks = originalTasks.filter(t => t.id !== id);
  // Remove any tasks whose parentId equals deleted id (only one level of immediate children is enough because those children's own children will be removed when we recursively filter? Actually simpler: remove all tasks where parentId chain leads to deleted id. But with flat list, you can loop: let changed = true; while changed { changed = false; for each task if task.parentId in setOfDeletedIds, delete it and add its id to set }.
  // For performance and simplicity, accept that only immediate children are removed from UI if deeper children were not loaded. The DB cascade will delete them. The next fetch will restore consistency.
  // Recommended: only remove tasks whose parentId === id (immediate children). Do not attempt deep removal. The store will be inconsistent but user will refetch on next load or after error recovery.
  // To be safe, after API failure, call fetchTasks().
  set({ tasks: newTasks });
  try {
    await api.delete(`/api/tasks/${id}`);
  } catch {
    await get().fetchTasks();
  }
}
```

### **8.2 Calendar Timezone Handling**

Store all `Date` objects in JavaScript as local time. Send to API as ISO strings with timezone offset (e.g., `new Date().toISOString()`). Prisma stores DateTime in UTC. When reading, convert to local for display. `react-big-calendar` will handle local display automatically.

### **8.3 Calendar Cache Invalidation**

When user creates/updates/deletes an event, after API success, refetch the currently visible range (via `fetchEvents` with current start/end). Do not manually modify the events array unless optimistic (optional). Simpler: just refetch.

### **8.4 Drag-and-Drop on Calendar**

Ensure `DndProvider` is placed high enough (e.g., in `app/workspace/calendar/page.tsx`). The drag-and-drop handler must call `updateEvent` with new start/end times.

### **8.5 Subtask Unlimited Depth UI**

Use recursive `TaskTree` component that calls itself for `children`. To avoid deep recursion performance issues, React handles it fine up to thousands of levels (practically not a problem). Use `React.memo` on `TaskItem` to prevent unnecessary re-renders.

***

## **9. Dependencies to Install**

Run these commands in order:

bash

```
npm install react-dnd react-dnd-html5-backend
npm install react-big-calendar date-fns @date-fns/tz  # if date-fns not already present
npm install use-debounce   # optional, can implement own debounce
```

If `date-fns` already in project, skip. Check `package.json`.

***

## **10. Completion Criteria**

The coding AI agent's job is done when:

1. All code changes are made, no TypeScript errors, no lint errors.
2. Prisma migration applied successfully.
3. Manual verification checklist (section 7) passes.
4. Existing features (notes, stacks, voice, sync) remain functional.
5. New features work as specified.

Do not deviate from this contract. If any ambiguity arises, assume the simplest interpretation that matches existing patterns in the codebase.

**End of Contract**
