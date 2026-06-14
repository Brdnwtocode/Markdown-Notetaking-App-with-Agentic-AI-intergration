import { StateCreator } from "zustand";
import toast from "react-hot-toast";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";

export interface Folder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoldersSlice {
  folders: Folder[];
  expandedFolderIds: Set<string>;
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  setFolderExpanded: (id: string, expanded: boolean) => void;
  fetchFolders: () => Promise<void>;
  
  optimisticCreateFolder: (
    name: string,
    parentId: string | null
  ) => {
    tempId: string;
    promise: Promise<{ tempId: string; realId: string }>;
  };
  optimisticRenameFolder: (folderId: string, name: string) => void;
  optimisticMoveFolder: (folderId: string, parentId: string | null) => void;
}

function tempId(prefix: string) {
  return `temp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const createFoldersSlice: StateCreator<RootStore, [], [], FoldersSlice> = (set, get) => ({
  folders: [],
  expandedFolderIds: new Set<string>(),

  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
  updateFolder: (folder) =>
    set((state) => ({
      folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
    })),
  deleteFolder: (id) =>
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
    })),

  toggleFolderExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedFolderIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedFolderIds: next };
    }),

  setFolderExpanded: (id, expanded) =>
    set((state) => {
      const next = new Set(state.expandedFolderIds);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { expandedFolderIds: next };
    }),

  fetchFolders: async () => {
    try {
      const data = await apiJson<Folder[]>("/api/folders");
      set({ folders: data });
    } catch (error) {
      console.error("Failed to fetch folders", error);
      toast.error("Failed to load folders");
    }
  },

  optimisticCreateFolder: (name: string, parentId: string | null) => {
    const snapshot = get();
    const id = tempId("folder");
    const now = new Date().toISOString();
    const optimistic: Folder = {
      id,
      userId: "me",
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      // Auto-expand parent folder if creating nested folder
      const nextExpanded = new Set(state.expandedFolderIds);
      if (parentId) {
        nextExpanded.add(parentId);
      }
      return {
        folders: [...state.folders, optimistic],
        expandedFolderIds: nextExpanded,
        syncState: "SAVING",
        isSaving: true,
      };
    });

    const promise = apiJson<Folder>("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    })
      .then((created) => {
        set((state) => {
          const folders = state.folders.map((f) => (f.id === id ? created : f));
          const nextExpanded = new Set(state.expandedFolderIds);
          if (nextExpanded.has(id)) {
            nextExpanded.delete(id);
            nextExpanded.add(created.id);
          }
          return {
            folders,
            expandedFolderIds: nextExpanded,
            syncState: "SAVED",
            isSaving: false,
          };
        });
        return { tempId: id, realId: created.id };
      })
      .catch((e) => {
        // Revert only folder-related state to snapshot (don't touch notes/stacks)
        set({
          folders: snapshot.folders,
          expandedFolderIds: snapshot.expandedFolderIds,
          syncState: "ERROR",
          isSaving: false,
        });
        toast.error("Failed to create folder");
        throw e;
      });

    return { tempId: id, promise };
  },

  optimisticRenameFolder: (folderId, name) => {
    const snapshot = get();
    set((state) => ({
      folders: state.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson(`/api/folders/${folderId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    })
      .then(() => {
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          folders: snapshot.folders,
          syncState: "ERROR",
          isSaving: false,
        });
        toast.error("Failed to rename folder");
      });
  },

  optimisticMoveFolder: (folderId, parentId) => {
    const snapshot = get();
    set((state) => ({
      folders: state.folders.map((f) => (f.id === folderId ? { ...f, parentId } : f)),
      syncState: "SAVING",
      isSaving: true,
    }));

    void apiJson(`/api/folders/${folderId}`, {
      method: "PUT",
      body: JSON.stringify({ parentId }),
    })
      .then(() => {
        set({ syncState: "SAVED", isSaving: false });
      })
      .catch(() => {
        set({
          folders: snapshot.folders,
          syncState: "ERROR",
          isSaving: false,
        });
        toast.error("Failed to move folder");
      });
  },
});
