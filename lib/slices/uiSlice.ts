import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export type TabType = "NOTE" | "STACK" | "TASKS" | "CALENDAR";

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

  // Sync status
  syncState: SyncState;

  // Current user
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;

  // UI state
  // UI state
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  isVoiceMutating: boolean;
  setIsVoiceMutating: (is: boolean) => void;
  isRawMarkdownView: boolean;
  setIsRawMarkdownView: (isRaw: boolean) => void;
  toggleRawMarkdownView: () => void;
}

export const createUiSlice: StateCreator<RootStore, [], [], UiSlice> = (set) => ({
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

      return {
        openTabs,
        activeTabId: id,
        currentNoteId: type === "NOTE" ? id : null,
        currentStackId: type === "STACK" ? id : null,
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

      return {
        openTabs,
        activeTabId: nextActiveId,
        currentNoteId: nextActiveTab?.type === "NOTE" ? nextActiveId : null,
        currentStackId: nextActiveTab?.type === "STACK" ? nextActiveId : null,
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
        };
      }

      const tab = state.openTabs.find((t) => t.id === id);
      if (!tab) return { activeTabId: id };

      return {
        activeTabId: id,
        currentNoteId: tab.type === "NOTE" ? id : null,
        currentStackId: tab.type === "STACK" ? id : null,
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

  // Sync status
  syncState: "SAVED",

  // UI state
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),
  cursorPosition: 0,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  isVoiceMutating: false,
  setIsVoiceMutating: (is) => set({ isVoiceMutating: is }),
  isRawMarkdownView: false,
  setIsRawMarkdownView: (is) => set({ isRawMarkdownView: is }),
  toggleRawMarkdownView: () => set((state) => ({ isRawMarkdownView: !state.isRawMarkdownView })),
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
