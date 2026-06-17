"use client";

import { useRef, useCallback, useEffect } from "react";
import { useDrag } from "react-dnd";
import { useWorkspaceStore } from "@/lib/store";
import {
  X, Cloud, Loader, CheckSquare, CalendarDays, Check, Minus, Disc,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Columns,
} from "lucide-react";
import { useRouter } from "next/navigation";

function getTabHref(tab: { id: string; type: string; title: string }): string {
  switch (tab.type) {
    case "NOTE": return `/workspace/notes/${tab.id}`;
    case "STACK": return `/workspace/stacks/${tab.id}`;
    case "TASKS": return `/workspace/tasks`;
    case "CALENDAR": return `/workspace/calendar`;
    case "RECORDS": return `/workspace/records`;
    case "FILE": return `/workspace/files/${tab.id}`;
    default: {
      void (tab.type as never);
      return `/workspace`;
    }
  }
}

// ── Draggable Tab sub-component ───────────────────────────────────────

interface DraggableTabProps {
  tab: { id: string; type: string; title: string };
  isActive: boolean;
  isSelected: boolean;
  onTabClick: (tabId: string, e: React.MouseEvent) => void;
  onToggleSelect: (tabId: string, e: React.MouseEvent) => void;
  onCloseTab: (e: React.MouseEvent, tabId: string) => void;
}

function DraggableTab({ tab, isActive, isSelected, onTabClick, onToggleSelect, onCloseTab }: DraggableTabProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "TAB",
    item: { id: tab.id, type: tab.type, title: tab.title },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [tab.id, tab.type, tab.title]);

  return (
    <div
      ref={drag as any}
      title={tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}
      className={`group flex items-center gap-2 px-3 h-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border-r border-[#27272A] ${
          isActive
              ? "bg-[#0E0E0E] text-white border-t-2 border-t-[#10B981] border-b border-b-transparent"
              : "bg-transparent text-zinc-400 border-t-2 border-t-transparent hover:text-white hover:bg-white/5"
      } ${isSelected ? "border-b-2 border-b-[#10B981]/50" : ""} ${
        isDragging ? "opacity-50 border border-[#10B981] bg-transparent cursor-grabbing" : ""
      }`}
      onClick={(e) => onTabClick(tab.id, e)}
    >
      {/* Selection checkbox — only for NOTE and STACK tabs */}
      {(tab.type === "NOTE" || tab.type === "STACK") && (
        <button
            type="button"
            onClick={(e) => onToggleSelect(tab.id, e)}
            className={`shrink-0 w-3.5 h-3.5 rounded-none border transition-colors flex items-center justify-center ${
              isSelected 
                ? "bg-[#10B981] border-[#10B981]" 
                : "border-[#27272A] hover:border-zinc-500"
            }`}
            title={isSelected ? "Deselect tab" : "Select tab for context"}
        >
          {isSelected && <Check className="h-2.5 w-2.5 text-[#0E0E0E] stroke-[3px]" />}
        </button>
      )}

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
      ) : tab.type === "RECORDS" ? (
        <>
          <Disc className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          <span className="truncate max-w-[120px]">
            {tab.id === "singleton-records" ? (
              <span className="font-technical uppercase text-[10px]">Records</span>
            ) : (
              tab.title
            )}
          </span>
        </>
      ) : (
        <span className="truncate max-w-[120px]">{tab.title}</span>
      )}
      <button
          type="button"
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0 ml-1"
          title={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
          aria-label={`Close ${tab.type === "TASKS" ? "Tasks" : tab.type === "CALENDAR" ? "Calendar" : tab.title}`}
          onClick={(e) => onCloseTab(e, tab.id)}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export interface TabBarProps {
  /** When provided, only show tabs assigned to this pane in split view. */
  paneId?: "left" | "right";
}

export default function TabBar({ paneId }: TabBarProps) {
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
    tabHistory,
    tabHistoryIndex,
    navigateBack,
    navigateForward,
    tabPaneAssignments,
    leftPaneActiveId,
    rightPaneActiveId,
    setPaneActiveTab,
    isSplitView,
    toggleSplitView,
    focusPane,
  } = useWorkspaceStore();
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter tabs by pane assignment when in split view
  const visibleTabs = paneId
    ? openTabs.filter((t) => (tabPaneAssignments[t.id] ?? "left") === paneId)
    : openTabs;

  // Determine which active ID to use for highlighting
  const effectiveActiveId = paneId === "left"
    ? leftPaneActiveId
    : paneId === "right"
    ? rightPaneActiveId
    : activeTabId;

  // ── Horizontal scroll controls ──────────────────────────────────────
  const scrollBy = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -200 : 200;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const wasActive = paneId
      ? (paneId === "left" ? leftPaneActiveId : rightPaneActiveId) === tabId
      : useWorkspaceStore.getState().activeTabId === tabId;
    closeTab(tabId);
    if (!wasActive) return;

    if (paneId) {
      // For pane-specific tabbar, find next active in that pane
      const state = useWorkspaceStore.getState();
      const paneTabs = state.openTabs.filter(
        (t) => (state.tabPaneAssignments[t.id] ?? "left") === paneId && t.id !== tabId
      );
      const nextId = paneTabs[0]?.id ?? null;
      setPaneActiveTab(paneId, nextId);
      if (nextId) {
        const next = paneTabs[0];
        router.push(getTabHref(next));
      }
      return;
    }

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
      if (paneId) {
        focusPane(paneId);
        setPaneActiveTab(paneId, tabId);
      } else if (isSplitView) {
        // In split view, activate the tab in its assigned pane
        const store = useWorkspaceStore.getState();
        const assignedPane = store.tabPaneAssignments[tabId] ?? "left";
        setPaneActiveTab(assignedPane, tabId);
      } else {
        setActiveTab(tabId);
      }
      const tab = openTabs.find((t) => t.id === tabId);
      if (tab) router.push(getTabHref(tab));
    }
  };

  const handleToggleSelect = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleTabSelection(tabId);
  };

  // ── Keyboard shortcut: Ctrl+Shift+Left/Right for history navigation ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const prevId = navigateBack();
          if (prevId && !paneId) {
            const tab = useWorkspaceStore.getState().openTabs.find((t) => t.id === prevId);
            if (tab) router.push(getTabHref(tab));
          }
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          const nextId = navigateForward();
          if (nextId && !paneId) {
            const tab = useWorkspaceStore.getState().openTabs.find((t) => t.id === nextId);
            if (tab) router.push(getTabHref(tab));
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigateBack, navigateForward, paneId, router]);

  if (visibleTabs.length === 0) return null;

  const isAllSelected = visibleTabs.length > 0 && selectedTabIds.length === visibleTabs.length;

  // History navigation state
  const canGoBack = tabHistoryIndex > 0;
  const canGoForward = tabHistoryIndex < tabHistory.length - 1;

  return (
      <div className="flex items-center h-10 bg-[#131313] border-b border-[#27272A] px-1 select-none">
        {/* ── Back / Forward history buttons ── */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => {
              const prevId = navigateBack();
              if (prevId && !paneId) {
                const tab = openTabs.find((t) => t.id === prevId);
                if (tab) router.push(getTabHref(tab));
              }
            }}
            className="p-1 rounded-none hover:bg-white/10 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Back (Ctrl+Shift+←)"
          >
            <ArrowLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => {
              const nextId = navigateForward();
              if (nextId && !paneId) {
                const tab = openTabs.find((t) => t.id === nextId);
                if (tab) router.push(getTabHref(tab));
              }
            }}
            className="p-1 rounded-none hover:bg-white/10 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Forward (Ctrl+Shift+→)"
          >
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* ── Split View toggle (main TabBar only) ── */}
        {!paneId && (
          <button
            type="button"
            onClick={toggleSplitView}
            className={`p-1 rounded-none transition-colors shrink-0 ${
              isSplitView
                ? "bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30"
                : "text-zinc-500 hover:text-white hover:bg-white/10"
            }`}
            title={isSplitView ? "Exit split view" : "Split view"}
          >
            <Columns className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ── Left scroll button ── */}
        <button
          type="button"
          onClick={() => scrollBy("left")}
          className="p-1 rounded-none hover:bg-white/10 text-zinc-500 hover:text-white transition-colors shrink-0"
          title="Scroll tabs left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Selection controls */}
        {visibleTabs.length > 1 && (
          <div className="flex items-center gap-1 mx-1">
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
        
        {/* ── Scrollable tab container ── */}
        <div
          ref={scrollRef}
          className="flex items-center h-full overflow-x-auto flex-1 scrollbar-none"
        >
          {visibleTabs.map((tab) => {
            const isSelected = selectedTabIds.includes(tab.id);
            const isActive = effectiveActiveId === tab.id;
            
            return (
              <DraggableTab
                key={tab.id}
                tab={tab}
                isActive={isActive}
                isSelected={isSelected}
                onTabClick={handleTabClick}
                onToggleSelect={handleToggleSelect}
                onCloseTab={handleCloseTab}
              />
            );
          })}
        </div>

        {/* ── Right scroll button ── */}
        <button
          type="button"
          onClick={() => scrollBy("right")}
          className="p-1 rounded-none hover:bg-white/10 text-zinc-500 hover:text-white transition-colors shrink-0"
          title="Scroll tabs right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* ── Sync indicator ── */}
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