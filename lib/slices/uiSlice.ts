import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR" | "RECORDS" | "FILE";

export interface OpenTab {
  id: string;
  type: TabType;
  title: string;
}

export type SyncState = "SAVED" | "SAVING" | "ERROR";

export interface UiSlice {
  // Tabs
  openTabs: OpenTab[];
  activeTabId: string | null;
  selectedTabIds: string[]; // For multi-tab context selection
  openTab: (id: string, type: TabType, title: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabTitle: (id: string, newTitle: string) => void;
  toggleTabSelection: (tabId: string) => void;
  clearTabSelection: () => void;
  selectAllTabs: () => void;

  // Tab navigation history (Back/Forward)
  tabHistory: string[];          // Ordered list of visited tab IDs
  tabHistoryIndex: number;       // Current position in history (-1 = no history)
  navigateBack: () => string | null;
  navigateForward: () => string | null;

  // Split view / dual pane
  isSplitView: boolean;
  toggleSplitView: () => void;
  leftPaneActiveId: string | null;
  rightPaneActiveId: string | null;
  /** Which pane each tab belongs to. Unassigned tabs default to "left". */
  tabPaneAssignments: Record<string, "left" | "right">;
  /** Tracks which pane was last interacted with (for routing new tabs in split view). */
  lastFocusedPane: "left" | "right";
  focusPane: (pane: "left" | "right") => void;
  setPaneActiveTab: (pane: "left" | "right", tabId: string | null) => void;
  assignTabToPane: (tabId: string, pane: "left" | "right") => void;
  moveTabToOtherPane: (tabId: string) => void;

  // Sync status
  syncState: SyncState;

  // Current user
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;

  // UI state
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  /** Per-entity voice mutation tracking — prevents autosave only for the entity being mutated by AI */
  voiceMutatingIds: Set<string>;
  addVoiceMutatingId: (id: string) => void;
  removeVoiceMutatingId: (id: string) => void;
  isEntityVoiceMutating: (id: string) => boolean;
  isRawMarkdownView: boolean;
  setIsRawMarkdownView: (isRaw: boolean) => void;
  toggleRawMarkdownView: () => void;

  /** Per-tab scroll position persistence (tabId → scrollTop in px) */
  tabScrollPositions: Record<string, number>;
  saveTabScrollPosition: (tabId: string, scrollTop: number) => void;
  getTabScrollPosition: (tabId: string) => number;
}

export const createUiSlice: StateCreator<RootStore, [], [], UiSlice> = (set, get) => ({
  // Tabs
  openTabs: [],
  activeTabId: null,
  selectedTabIds: [], // Initialize empty selection
  openTab: (id, type, title) => {
    set((state) => {
      const exists = state.openTabs.some((t) => t.id === id);
      const openTabs = exists
        ? state.openTabs.map((t) => (t.id === id ? { ...t, type, title } : t))
        : [...state.openTabs, { id, type, title }];

      // In split view, assign new tabs to the last-focused pane
      const targetPane = state.isSplitView ? state.lastFocusedPane : "left";
      const tabPaneAssignments = exists
        ? state.tabPaneAssignments // keep existing assignment
        : { ...state.tabPaneAssignments, [id]: targetPane };

      // Determine which pane this tab belongs to
      const assignedPane = tabPaneAssignments[id] ?? "left";

      // Update the appropriate pane's active tab in split view
      // For new tabs: activate in the target pane
      // For existing tabs: activate in their assigned pane
      const leftPaneActiveId = state.isSplitView && assignedPane === "left"
        ? id
        : state.leftPaneActiveId;
      const rightPaneActiveId = state.isSplitView && assignedPane === "right"
        ? id
        : state.rightPaneActiveId;

      // Push to navigation history (avoid duplicate consecutive entries)
      const history = state.tabHistory;
      const histIdx = state.tabHistoryIndex;
      const lastEntry = histIdx >= 0 ? history[histIdx] : null;
      if (lastEntry === id) {
        // Same tab already at top of history — don't push duplicate
        return {
          openTabs,
          activeTabId: state.isSplitView ? state.activeTabId : id,
          currentNoteId: type === "NOTE" ? id : null,
          currentStackId: type === "STACK" ? id : null,
          activeRecordingId: type === "RECORDS" ? id : null,
          tabPaneAssignments,
          leftPaneActiveId,
          rightPaneActiveId,
        };
      }
      const newHistory = histIdx >= 0
        ? [...history.slice(0, histIdx + 1), id]
        : [...history, id];
      if (newHistory.length > 50) newHistory.shift();

      return {
        openTabs,
        activeTabId: state.isSplitView ? state.activeTabId : id,
        currentNoteId: type === "NOTE" ? id : null,
        currentStackId: type === "STACK" ? id : null,
        activeRecordingId: type === "RECORDS" ? id : null,
        tabHistory: newHistory,
        tabHistoryIndex: newHistory.length - 1,
        tabPaneAssignments,
        leftPaneActiveId,
        rightPaneActiveId,
      };
    });
  },
  closeTab: (id) => {
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.id === id);
      if (idx === -1) return state;

      const openTabs = state.openTabs.filter((t) => t.id !== id);
      const nextActiveId =
        state.activeTabId === id
          ? openTabs[Math.min(idx, openTabs.length - 1)]?.id ?? null
          : state.activeTabId;

      const nextActiveTab = nextActiveId
        ? openTabs.find((t) => t.id === nextActiveId)
        : undefined;

      // Clean up history for closed tab: remove it, clamp index to valid range
      const newHistory = state.tabHistory.filter((hId) => hId !== id);
      // If we removed the current history entry, step back one; otherwise keep position
      const removedCurrentEntry = state.tabHistory[state.tabHistoryIndex] === id;
      const newHistIdx = removedCurrentEntry
        ? Math.min(state.tabHistoryIndex, newHistory.length - 1)
        : (newHistory.length > 0
            ? newHistory.findIndex((hId) => hId === state.tabHistory[state.tabHistoryIndex])
            : -1);
      // Clamp to valid range
      const clampedHistIdx = newHistory.length === 0 ? -1
        : Math.max(0, Math.min(newHistIdx, newHistory.length - 1));
      // Also clean up left/right pane active + pane assignments for closed tab
      const { [id]: _, ...restPaneAssignments } = state.tabPaneAssignments;
      const leftPaneActiveId = state.leftPaneActiveId === id ? nextActiveId : state.leftPaneActiveId;
      const rightPaneActiveId = state.rightPaneActiveId === id ? null : state.rightPaneActiveId;

      return {
        openTabs,
        activeTabId: nextActiveId,
        currentNoteId: nextActiveTab?.type === "NOTE" ? nextActiveId : null,
        currentStackId: nextActiveTab?.type === "STACK" ? nextActiveId : null,
        activeRecordingId: nextActiveTab?.type === "RECORDS" ? nextActiveId : null,
        tabHistory: newHistory,
        tabHistoryIndex: clampedHistIdx,
        tabPaneAssignments: restPaneAssignments,
        leftPaneActiveId,
        rightPaneActiveId,
      };
    });
  },
  setActiveTab: (id) => {
    set((state) => {
      if (!id) {
        return {
          activeTabId: null,
          currentNoteId: null,
          currentStackId: null,
          activeRecordingId: null,
        };
      }

      const tab = state.openTabs.find((t) => t.id === id);
      if (!tab) return { activeTabId: id };

      // Push to navigation history (avoid duplicate consecutive entries)
      const history = state.tabHistory;
      const histIdx = state.tabHistoryIndex;
      const lastEntry = histIdx >= 0 ? history[histIdx] : null;
      if (lastEntry === id) {
        // Same tab, no history change needed
        return {
          activeTabId: id,
          currentNoteId: tab.type === "NOTE" ? id : null,
          currentStackId: tab.type === "STACK" ? id : null,
          activeRecordingId: tab.type === "RECORDS" ? id : null,
        };
      }
      const newHistory = histIdx >= 0
        ? [...history.slice(0, histIdx + 1), id]
        : [...history, id];
      if (newHistory.length > 50) newHistory.shift();

      return {
        activeTabId: id,
        currentNoteId: tab.type === "NOTE" ? id : null,
        currentStackId: tab.type === "STACK" ? id : null,
        activeRecordingId: tab.type === "RECORDS" ? id : null,
        tabHistory: newHistory,
        tabHistoryIndex: newHistory.length - 1,
      };
    });
  },
  updateTabTitle: (id, newTitle) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, title: newTitle } : t
      ),
    }));
  },

  // Tab navigation history
  tabHistory: [],
  tabHistoryIndex: -1,
  navigateBack: () => {
    const { tabHistory, tabHistoryIndex, openTabs } = get();
    if (tabHistoryIndex <= 0) return null;
    const newIdx = tabHistoryIndex - 1;
    const prevId = tabHistory[newIdx];
    const tab = openTabs.find((t) => t.id === prevId);
    set({
      tabHistoryIndex: newIdx,
      activeTabId: prevId,
      currentNoteId: tab?.type === "NOTE" ? prevId : null,
      currentStackId: tab?.type === "STACK" ? prevId : null,
      activeRecordingId: tab?.type === "RECORDS" ? prevId : null,
    });
    return prevId;
  },
  navigateForward: () => {
    const { tabHistory, tabHistoryIndex, openTabs } = get();
    if (tabHistoryIndex >= tabHistory.length - 1) return null;
    const newIdx = tabHistoryIndex + 1;
    const nextId = tabHistory[newIdx];
    const tab = openTabs.find((t) => t.id === nextId);
    set({
      tabHistoryIndex: newIdx,
      activeTabId: nextId,
      currentNoteId: tab?.type === "NOTE" ? nextId : null,
      currentStackId: tab?.type === "STACK" ? nextId : null,
      activeRecordingId: tab?.type === "RECORDS" ? nextId : null,
    });
    return nextId;
  },

  // Split view / dual pane
  isSplitView: false,
  toggleSplitView: () => set((state) => {
    const nextSplit = !state.isSplitView;
    if (nextSplit) {
      // ── Entering split view ──
      const currentActive = state.activeTabId;
      // Assign all currently unassigned tabs to "left" as default
      const assignments: Record<string, "left" | "right"> = { ...state.tabPaneAssignments };
      state.openTabs.forEach((t) => {
        if (!(t.id in assignments)) assignments[t.id] = "left";
      });
      // Put the active tab in the left pane
      const leftId = currentActive ?? state.openTabs[0]?.id ?? null;
      // Put the second tab (if any) in the right pane
      const rightCandidate = state.openTabs.find((t) => t.id !== leftId);
      const rightId = rightCandidate?.id ?? null;
      if (rightId) assignments[rightId] = "right";
      return {
        isSplitView: nextSplit,
        leftPaneActiveId: leftId,
        rightPaneActiveId: rightId,
        tabPaneAssignments: assignments,
        lastFocusedPane: "left",
      };
    }
    // ── Exiting split view → restore single active tab from last-focused pane ──
    const restoreId = state.lastFocusedPane === "left"
      ? state.leftPaneActiveId
      : state.rightPaneActiveId;
    return {
      isSplitView: nextSplit,
      activeTabId: restoreId ?? state.activeTabId,
    };
  }),
  leftPaneActiveId: null,
  rightPaneActiveId: null,
  tabPaneAssignments: {},
  lastFocusedPane: "left",
  focusPane: (pane) => set({ lastFocusedPane: pane }),
  setPaneActiveTab: (pane, tabId) => {
    if (pane === "left") {
      set({ leftPaneActiveId: tabId, lastFocusedPane: "left" });
    } else {
      set({ rightPaneActiveId: tabId, lastFocusedPane: "right" });
    }
  },
  assignTabToPane: (tabId, pane) => {
    set((state) => ({
      tabPaneAssignments: { ...state.tabPaneAssignments, [tabId]: pane },
    }));
  },
  moveTabToOtherPane: (tabId) => {
    set((state) => {
      const currentPane = state.tabPaneAssignments[tabId] ?? "left";
      const newPane = currentPane === "left" ? "right" : "left";
      return {
        tabPaneAssignments: { ...state.tabPaneAssignments, [tabId]: newPane },
      };
    });
  },

  // Sync status
  syncState: "SAVED",

  // UI state
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),
  cursorPosition: 0,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  voiceMutatingIds: new Set<string>(),
  addVoiceMutatingId: (id) => set((state) => {
    const next = new Set(state.voiceMutatingIds);
    next.add(id);
    return { voiceMutatingIds: next };
  }),
  removeVoiceMutatingId: (id) => set((state) => {
    const next = new Set(state.voiceMutatingIds);
    next.delete(id);
    return { voiceMutatingIds: next };
  }),
  isEntityVoiceMutating: (id) => {
    return get().voiceMutatingIds.has(id);
  },
  isRawMarkdownView: false,
  setIsRawMarkdownView: (is) => set({ isRawMarkdownView: is }),
  toggleRawMarkdownView: () => set((state) => ({ isRawMarkdownView: !state.isRawMarkdownView })),

  // Per-tab scroll position persistence
  tabScrollPositions: {},
  saveTabScrollPosition: (tabId, scrollTop) => {
    set((state) => ({
      tabScrollPositions: { ...state.tabScrollPositions, [tabId]: scrollTop },
    }));
  },
  getTabScrollPosition: (tabId) => {
    return get().tabScrollPositions[tabId] ?? 0;
  },

  // Current user
  currentUserId: null,
  setCurrentUserId: (id) => set({ currentUserId: id }),


  toggleTabSelection: (tabId) => {
    set((state) => {
      const isSelected = state.selectedTabIds.includes(tabId);
      const selectedTabIds = isSelected
        ? state.selectedTabIds.filter((id) => id !== tabId)
        : [...state.selectedTabIds, tabId];
      return { selectedTabIds };
    });
  },
  clearTabSelection: () => set({ selectedTabIds: [] }),
  selectAllTabs: () => {
    set((state) => ({
      selectedTabIds: state.openTabs.map((t) => t.id),
    }));
  },
});
