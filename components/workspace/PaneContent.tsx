"use client";

import { useEffect, useState } from "react";
import { MilkdownProvider } from "@milkdown/react";
import LiveEditor from "@/components/workspace/LiveEditor";
import StackTable from "@/components/workspace/StackTable";
import RecordsWorkstation from "@/components/workspace/RecordsWorkstation";
import FileViewer from "@/components/workspace/FileViewer";
import { useWorkspaceStore } from "@/lib/store";
import type { OpenTab } from "@/lib/slices/uiSlice";
import type { FileRecord } from "@/lib/slices/fileRecordsSlice";
import axios from "axios";
import { Loader2 } from "lucide-react";

interface PaneContentProps {
  tab: OpenTab | null;
}

/**
 * PaneContent renders the appropriate content component for a given tab.
 * Used in split-view mode where each pane has its own active tab independent
 * of the URL route.
 */
export default function PaneContent({ tab }: PaneContentProps) {
  if (!tab) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E] text-zinc-500 text-xs font-technical">
        No tab selected
      </div>
    );
  }

  switch (tab.type) {
    case "NOTE":
      return <NotePaneContent noteId={tab.id} tabTitle={tab.title} />;
    case "STACK":
      return <StackPaneContent stackId={tab.id} tabTitle={tab.title} />;
    case "TASKS":
      return <TasksPaneContent />;
    case "CALENDAR":
      return <CalendarPaneContent />;
    case "RECORDS":
      return <RecordsPaneContent />;
    case "FILE":
      return <FilePaneContent fileId={tab.id} tabTitle={tab.title} />;
    default:
      return (
        <div className="h-full flex items-center justify-center bg-[#0E0E0E] text-zinc-500 text-xs">
          Unknown tab type
        </div>
      );
  }
}

// ─── Note Pane ────────────────────────────────────────────────────────

function NotePaneContent({ noteId, tabTitle }: { noteId: string; tabTitle: string }) {
  const { noteCache, upsertNoteCache } = useWorkspaceStore();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const cached = noteCache[noteId];

  useEffect(() => {
    if (cached) {
      setContent(cached.content ?? "");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/notes/${noteId}`);
        if (cancelled) return;
        const data = res.data;
        upsertNoteCache(data);
        setContent(data.content ?? "");
      } catch {
        if (!cancelled) setContent("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, cached?.content]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent bg-[#0E0E0E]">
      <div className="px-4 py-2 border-b border-[#27272A]">
        <h2 className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981] truncate">
          {tabTitle}
        </h2>
      </div>
      <div className="p-4">
        <MilkdownProvider>
          <LiveEditor noteId={noteId} content={content} />
        </MilkdownProvider>
      </div>
    </div>
  );
}

// ─── Stack Pane ───────────────────────────────────────────────────────

function StackPaneContent({ stackId, tabTitle }: { stackId: string; tabTitle: string }) {
  const { stacks } = useWorkspaceStore();
  const [stack, setStack] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const cached = stacks.find((s) => s.id === stackId);

  useEffect(() => {
    if (cached) {
      setStack(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/stacks/${stackId}`);
        if (cancelled) return;
        setStack(res.data);
      } catch {
        if (!cancelled) setStack(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId, cached?.id]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (!stack) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E] text-zinc-500 text-xs">
        Stack not found
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent bg-[#0E0E0E]">
      <div className="px-4 py-2 border-b border-[#27272A]">
        <h2 className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981] truncate">
          {tabTitle}
        </h2>
      </div>
      <div className="p-4">
        <StackTable
          stackId={stack.id}
          initialStack={stack}
          onSave={(updated) => {
            // Update the local stack state on save from within the pane
            setStack(updated);
          }}
        />
      </div>
    </div>
  );
}

// ─── Tasks Pane ───────────────────────────────────────────────────────

function TasksPaneContent() {
  const { tasks, setTasks } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("/api/tasks");
        if (cancelled) return;
        setTasks(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
      </div>
    );
  }

  // Build a simple tree from flat task list
  const rootTasks = tasks.filter((t: any) => !t.parentId);
  const childrenMap = new Map<string, any[]>();
  tasks.forEach((t: any) => {
    if (t.parentId) {
      const list = childrenMap.get(t.parentId) ?? [];
      list.push(t);
      childrenMap.set(t.parentId, list);
    }
  });

  const renderTask = (task: any, depth: number = 0) => (
    <div
      key={task.id}
      className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-[#27272A]/50 hover:bg-white/5 transition-colors"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          task.status === "DONE" ? "bg-[#10B981]" :
          task.status === "IN_PROGRESS" ? "bg-yellow-500" : "bg-zinc-600"
        }`}
      />
      <span className={`truncate ${task.status === "DONE" ? "line-through text-zinc-500" : "text-zinc-300"}`}>
        {task.title}
      </span>
    </div>
  );

  return (
    <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent bg-[#0E0E0E]">
      <div className="px-4 py-2 border-b border-[#27272A]">
        <h2 className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981]">
          Tasks
        </h2>
      </div>
      <div className="py-1">
        {rootTasks.length === 0 ? (
          <p className="text-xs text-zinc-500 p-4">No tasks yet.</p>
        ) : (
          rootTasks.map((task: any) => (
            <div key={task.id}>
              {renderTask(task)}
              {(childrenMap.get(task.id) ?? []).map((child: any) => renderTask(child, 1))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Calendar Pane ────────────────────────────────────────────────────

function CalendarPaneContent() {
  const { calendarEvents, setCalendarEvents } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/events?${params}`, { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setCalendarEvents(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
      </div>
    );
  }

  const upcoming = [...calendarEvents]
    .filter((e: any) => new Date(e.startAt) >= new Date())
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 20);

  return (
    <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent bg-[#0E0E0E]">
      <div className="px-4 py-2 border-b border-[#27272A]">
        <h2 className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981]">
          Calendar
        </h2>
      </div>
      <div className="py-1">
        {upcoming.length === 0 ? (
          <p className="text-xs text-zinc-500 p-4">No upcoming events.</p>
        ) : (
          upcoming.map((event: any) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-3 py-2 text-xs border-b border-[#27272A]/50 hover:bg-white/5 transition-colors"
            >
              <div
                className="w-1 h-4 rounded-full shrink-0"
                style={{ backgroundColor: event.color ?? "#10B981" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-zinc-300 truncate font-medium">{event.title}</p>
                <p className="text-zinc-500 text-[10px]">
                  {new Date(event.startAt).toLocaleDateString()}
                  {event.allDay ? " (all day)" : ` ${new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Records Pane ─────────────────────────────────────────────────────

function RecordsPaneContent() {
  return (
    <div className="h-full w-full">
      <RecordsWorkstation />
    </div>
  );
}

// ─── File Pane ────────────────────────────────────────────────────────

function FilePaneContent({ fileId }: { fileId: string; tabTitle?: string }) {
  const { fileRecords } = useWorkspaceStore();
  const [fileRecord, setFileRecord] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try cached first
    const cached = fileRecords.find((fr) => fr.id === fileId);
    if (cached) {
      setFileRecord(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("/api/storage");
        if (cancelled) return;
        const found = (res.data as FileRecord[]).find((fr: FileRecord) => fr.id === fileId);
        if (found) {
          setFileRecord(found);
        }
      } catch {
        // Will show error state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E]">
        <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (!fileRecord) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0E0E0E] text-zinc-500 text-xs">
        File not found
      </div>
    );
  }

  return <FileViewer fileRecord={fileRecord} />;
}
