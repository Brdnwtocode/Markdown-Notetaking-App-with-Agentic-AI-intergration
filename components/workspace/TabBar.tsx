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
    case "RECORDS": return `/workspace/records`;
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
      <div className="flex items-center h-10 bg-[#131313] border-b border-[#27272A] px-2 select-none">
        {/* Selection controls */}
        {openTabs.length > 1 && (
          <div className="flex items-center gap-1 mr-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                isAllSelected ? clearTabSelection() : selectAllTabs();
              }}
              className="p-1 rounded-none hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title={isAllSelected ? "Clear selection" : "Select all tabs"}
            >
              {isAllSelected ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </button>
          </div>
        )}
        
        <div className="flex items-center h-full overflow-x-auto flex-1 scrollbar-none">
          {openTabs.map((tab) => {
            const isSelected = selectedTabIds.includes(tab.id);
            const isActive = activeTabId === tab.id;
            
            return (
              <div
                  key={tab.id}
                  title={tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}
                  className={`group flex items-center gap-2 px-3 h-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border-r border-[#27272A] ${
                      isActive
                          ? "bg-[#0E0E0E] text-white border-t-2 border-t-[#10B981] border-b border-b-transparent"
                          : "bg-transparent text-zinc-400 border-t-2 border-t-transparent hover:text-white hover:bg-white/5"
                  } ${isSelected ? "border-b-2 border-b-[#10B981]/50" : ""}`}
                  onClick={(e) => handleTabClick(tab.id, e)}
              >
                {/* Selection checkbox */}
                <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTabSelection(tab.id);
                    }}
                    className={`shrink-0 w-3.5 h-3.5 rounded-none border transition-colors flex items-center justify-center ${
                      isSelected 
                        ? "bg-[#10B981] border-[#10B981]" 
                        : "border-[#27272A] hover:border-zinc-500"
                    }`}
                    title={isSelected ? "Deselect tab" : "Select tab for context"}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-[#0E0E0E] stroke-[3px]" />}
                </button>

                {tab.type === "TASKS" ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                    <span className="font-technical uppercase text-[10px]">Tasks</span>
                  </>
                ) : tab.type === "CALENDAR" ? (
                  <>
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                    <span className="font-technical uppercase text-[10px]">Calendar</span>
                  </>
                ) : (
                  <span className="truncate max-w-[120px]">{tab.title}</span>
                )}
                <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0 ml-1"
                    title={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
                    aria-label={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
                    onClick={(e) => handleCloseTab(e, tab.id)}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
          {selectedTabIds.length > 0 && (
            <span className="text-[10px] font-technical font-semibold text-[#10B981]">
              [{selectedTabIds.length} SELECTED]
            </span>
          )}
          {isSaving || syncState === "SAVING" ? (
              <Loader className="h-3.5 w-3.5 animate-spin text-[#10B981]" />
          ) : syncState === "ERROR" ? (
              <Cloud className="h-3.5 w-3.5 text-red-500" />
          ) : (
              <Cloud className="h-3.5 w-3.5 text-[#10B981]" />
          )}
        </div>
      </div>
  );
}