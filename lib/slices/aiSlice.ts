import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";

export type MessageStatus = "pending" | "processing" | "completed" | "error";

export type MessageContextItem = {
  type: "NOTE" | "STACK" | "TASK" | "CALENDAR" | "TASKS";
  id: string;
  title?: string;
  source?: "active_tab" | "user_mention" | "recent_activity";
};

export type MessageContext = {
  items: MessageContextItem[];
  packedAt?: Date;
  totalItems: number;
};

export type ChatMessage = {
  id: string;
  type: "user" | "ai";
  content: string;
  context?: MessageContext;
  status: MessageStatus;
  timestamp: Date;
};

export interface AiSlice {
  // AI Conversational UI (legacy)
  aiReply: string | null;
  setAiReply: (reply: string | null) => void;
  
  // Chat UI (new)
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChatMessages: () => void;
};

export const createAiSlice: StateCreator<RootStore, [], [], AiSlice> = (set, get) => ({
  // AI Conversational UI (legacy)
  aiReply: null,
  setAiReply: (reply) => set({ aiReply: reply }),
  
  // Chat UI (new)
  isChatOpen: false,
  setIsChatOpen: (open) => set({ isChatOpen: open }),
  chatMessages: [],
  addChatMessage: (message) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          ...message,
          id,
          timestamp: new Date(),
        },
      ],
    }));
    return id;
  },
  updateChatMessage: (id, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),
  clearChatMessages: () => set({ chatMessages: [] }),
});
