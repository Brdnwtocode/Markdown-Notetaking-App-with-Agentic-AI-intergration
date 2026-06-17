import { StateCreator } from "zustand";
import { toast } from "@/lib/toast";
import { RootStore } from "@/lib/store";
import axios from "axios";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  userId: string;
  folderId: string | null;
  entityType: string | null;
  entityId: string | null;
  fileName: string;
  mimeType: string;
  storageKey: string;
  sizeBytes: number;
  assetFolder: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadingFile {
  tempId: string;
  fileName: string;
  folderId: string | null;
  status: "uploading" | "error";
  errorMessage?: string;
}

export interface FileRecordsSlice {
  fileRecords: FileRecord[];
  /** Cache of individually fetched file records — prevents re-fetch on tab switch */
  fileRecordCache: Record<string, FileRecord>;
  /** Cache of file content text — prevents content re-fetch on tab switch */
  fileContentCache: Record<string, string>;
  uploadingFiles: UploadingFile[];
  setFileRecords: (records: FileRecord[]) => void;
  addFileRecord: (record: FileRecord) => void;
  removeFileRecord: (id: string) => void;
  /** Adds/updates a single file record in the cache (used by viewers after fetch) */
  cacheFileRecord: (record: FileRecord) => void;
  /** Store file content in the cache so it persists across tab switches */
  cacheFileContent: (fileId: string, content: string) => void;
  /** Move a file to a different folder */
  moveFileRecord: (fileId: string, folderId: string | null) => Promise<void>;
  fetchFileRecords: () => Promise<void>;
  startUpload: (tempId: string, fileName: string, folderId: string | null) => void;
  finishUpload: (tempId: string, record: FileRecord) => void;
  failUpload: (tempId: string, errorMessage: string) => void;
  uploadAndCreateFileRecord: (
    file: File,
    folderId: string | null,
    entityType?: string | null,
    entityId?: string | null,
  ) => Promise<FileRecord>;
  deleteFileRecord: (id: string) => Promise<void>;
}

// ─── Slice ──────────────────────────────────────────────────────────────────

export const createFileRecordsSlice: StateCreator<RootStore, [], [], FileRecordsSlice> = (set, get) => ({
  fileRecords: [],
  fileRecordCache: {},
  fileContentCache: {},
  uploadingFiles: [],

  setFileRecords: (records) => set({ fileRecords: records }),

  addFileRecord: (record) =>
    set((state) => ({ fileRecords: [record, ...state.fileRecords] })),

  removeFileRecord: (id) =>
    set((state) => ({
      fileRecords: state.fileRecords.filter((r) => r.id !== id),
    })),

  cacheFileRecord: (record) =>
    set((state) => ({
      fileRecordCache: { ...state.fileRecordCache, [record.id]: record },
    })),

  cacheFileContent: (fileId, content) =>
    set((state) => ({
      fileContentCache: { ...state.fileContentCache, [fileId]: content },
    })),

  moveFileRecord: async (fileId, folderId) => {
    const prev = get().fileRecords;
    // Optimistic update
    set({
      fileRecords: prev.map((r) =>
        r.id === fileId ? { ...r, folderId } : r
      ),
    });
    try {
      await axios.patch(`/api/storage/${fileId}`, { folderId });
    } catch {
      set({ fileRecords: prev });
      toast.error("Failed to move file");
    }
  },

  fetchFileRecords: async () => {
    try {
      const res = await axios.get("/api/storage");
      set({ fileRecords: res.data });
    } catch (error) {
      console.error("Failed to fetch file records", error);
      toast.error("Failed to load files");
    }
  },

  startUpload: (tempId, fileName, folderId) =>
    set((state) => ({
      uploadingFiles: [
        ...state.uploadingFiles,
        { tempId, fileName, folderId, status: "uploading" as const },
      ],
    })),

  finishUpload: (tempId, record) => {
    get().addFileRecord(record);
    set((state) => ({
      uploadingFiles: state.uploadingFiles.filter((f) => f.tempId !== tempId),
    }));
  },

  failUpload: (tempId, errorMessage) => {
    set((state) => ({
      uploadingFiles: state.uploadingFiles.map((f) =>
        f.tempId === tempId
          ? { ...f, status: "error" as const, errorMessage }
          : f,
      ),
    }));
    // Auto-dismiss error ghost after 6 seconds
    setTimeout(() => {
      set((state) => ({
        uploadingFiles: state.uploadingFiles.filter((f) => f.tempId !== tempId),
      }));
    }, 6000);
  },

  uploadAndCreateFileRecord: async (file, folderId, entityType, entityId) => {
    const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    get().startUpload(tempId, file.name, folderId);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) formData.append("folderId", folderId);
      if (entityType) formData.append("entityType", entityType);
      if (entityId) formData.append("entityId", entityId);

      const res = await axios.post("/api/storage/upload", formData);
      const record: FileRecord = {
        id: res.data.id,
        userId: "",
        folderId: res.data.folderId ?? null,
        entityType: res.data.entityType ?? null,
        entityId: res.data.entityId ?? null,
        fileName: res.data.fileName,
        mimeType: res.data.mimeType,
        storageKey: res.data.storageKey,
        sizeBytes: res.data.sizeBytes,
        assetFolder: res.data.assetFolder ?? null,
        createdAt: res.data.createdAt,
        updatedAt: res.data.createdAt,
      };

      get().finishUpload(tempId, record);
      return record;
    } catch (err: any) {
      get().failUpload(tempId, err?.response?.data?.error || err?.message || "Upload failed");
      throw err;
    }
  },

  deleteFileRecord: async (id) => {
    const snapshot = get();
    const prev = snapshot.fileRecords;
    // Optimistic removal
    set({ fileRecords: prev.filter((r) => r.id !== id) });
    try {
      await axios.delete(`/api/storage/${id}`);
      toast.success("File deleted");
    } catch {
      set({ fileRecords: prev });
      toast.error("Failed to delete file");
    }
  },
});
