"use client";

import { useWorkspaceStore } from "@/lib/store";
import { X, Cloud, Loader, CheckSquare, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

function getTabHref(tab: { id: string; type: string; title: string }): string {
  switch (tab.type) {
    case "NOTE": return `/workspace/notes/${tab.id}`;
    case "STACK": return `/workspace/stacks/${tab.id}`;
    case "TASKS": return `/workspace/tasks`;
    case "CALENDAR": return `/workspace/calendar`;
    default: {
      void (tab.type as never);
      return `/workspace`;
    }
  }
}

export default function TabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab, isSaving, syncState } = useWorkspaceStore();
  const router = useRouter();

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const wasActive = useWorkspaceStore.getState().activeTabId === tabId;
    closeTab(tabId);
    if (!wasActive) return;
    const { activeTabId: nextId, openTabs: remaining } = useWorkspaceStore.getState();
    if (nextId) {
      const next = remaining.find((t) => t.id === nextId);
      if (next) router.push(getTabHref(next));
      return;
    }
    router.push("/workspace");
  };

  if (openTabs.length === 0) return null;

  return (
      <div className="flex items-center h-10 bg-[#252525] border-b border-zinc-700/30 px-2">
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {openTabs.map((tab) => (
              <div
                  key={tab.id}
                  title={tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors cursor-pointer ${
                      activeTabId === tab.id
                          ? "bg-white/10 text-slate-200"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    router.push(getTabHref(tab));
                  }}
              >
                {tab.type === "TASKS" ? (
                  <>
                    <CheckSquare className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="sr-only">Tasks</span>
                  </>
                ) : tab.type === "CALENDAR" ? (
                  <>
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="sr-only">Calendar</span>
                  </>
                ) : (
                  <span>{tab.title}</span>
                )}
                <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
                    title={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
                    aria-label={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
                    onClick={(e) => handleCloseTab(e, tab.id)}
                >
                  <X size={14} />
                </button>
              </div>
          ))}
        </div>
        <div className="ml-auto flex items-center pr-2">
          {isSaving || syncState === "SAVING" ? (
              <Loader className="h-4 w-4 animate-spin text-slate-400" />
          ) : syncState === "ERROR" ? (
              <Cloud className="h-4 w-4 text-red-400" />
          ) : (
              <Cloud className="h-4 w-4 text-green-400" />
          )}
        </div>
      </div>
  );
}