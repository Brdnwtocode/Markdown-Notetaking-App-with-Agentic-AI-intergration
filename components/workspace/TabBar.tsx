"use client";

import { useWorkspaceStore } from "@/lib/store";
import { X, Cloud, Loader, CheckSquare, CalendarDays, Check, Minus } from "lucide-react";
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
  const { 
    openTabs, 
    activeTabId, 
    selectedTabIds,
    setActiveTab, 
    closeTab, 
    isSaving, 
    syncState,
    toggleTabSelection,
    clearTabSelection,
    selectAllTabs,
  } = useWorkspaceStore();
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

  const handleTabClick = (tabId: string, e: React.MouseEvent) => {
    // If Ctrl/Cmd key is pressed, toggle selection instead of activating
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleTabSelection(tabId);
    } else {
      setActiveTab(tabId);
      router.push(getTabHref(openTabs.find(t => t.id === tabId)!));
    }
  };

  if (openTabs.length === 0) return null;

  const isAllSelected = openTabs.length > 0 && selectedTabIds.length === openTabs.length;

  return (
      <div className="flex items-center h-10 bg-[#252525] border-b border-zinc-700/30 px-2">
        {/* Selection controls */}
        {openTabs.length > 1 && (
          <div className="flex items-center gap-1 mr-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                isAllSelected ? clearTabSelection() : selectAllTabs();
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              title={isAllSelected ? "Clear selection" : "Select all tabs"}
            >
              {isAllSelected ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {openTabs.map((tab) => {
            const isSelected = selectedTabIds.includes(tab.id);
            const isActive = activeTabId === tab.id;
            
            return (
              <div
                  key={tab.id}
                  title={tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                          ? "bg-white/10 text-slate-200"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  } ${isSelected ? "ring-1 ring-purple-500/50" : ""}`}
                  onClick={(e) => handleTabClick(tab.id, e)}
              >
                {/* Selection checkbox */}
                <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTabSelection(tab.id);
                    }}
                    className={`shrink-0 w-4 h-4 rounded border transition-colors ${
                      isSelected 
                        ? "bg-purple-600 border-purple-500" 
                        : "border-slate-500 hover:border-slate-300"
                    }`}
                    title={isSelected ? "Deselect tab" : "Select tab for context"}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </button>

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
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
          {selectedTabIds.length > 0 && (
            <span className="text-xs text-purple-400">
              {selectedTabIds.length} selected
            </span>
          )}
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