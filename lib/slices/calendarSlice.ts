import { StateCreator } from "zustand";
import { RootStore } from "@/lib/store";
import { apiJson } from "@/lib/api";
import toast from "react-hot-toast";

export interface CalendarEvent {
    id: string; userId: string; title: string; notes: string;
    startAt: string; endAt: string; allDay: boolean; color: string;
    createdAt: string; updatedAt: string;
}

export interface CalendarSlice {
    calendarEvents: CalendarEvent[];
    setCalendarEvents: (events: CalendarEvent[]) => void;
    optimisticCreateCalendarEvent: (data: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">) => void;
    optimisticPatchCalendarEvent: (eventId: string, patch: Partial<Pick<CalendarEvent, "title" | "notes" | "startAt" | "endAt" | "allDay" | "color">>) => void;
    optimisticDeleteCalendarEvent: (eventId: string) => void;
}

export const createCalendarSlice: StateCreator<RootStore, [], [], CalendarSlice> = (set, get) => ({
    calendarEvents: [],
    setCalendarEvents: (events) => set({ calendarEvents: events }),

    optimisticCreateCalendarEvent: (data) => {
        const snapshot = get().calendarEvents;
        const id = `temp_event_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const now = new Date().toISOString();
        const userId = get().currentUserId;
        if (!userId) {
            toast.error("Session not ready — try again in a moment");
            return;
        }
        const optimistic: CalendarEvent = { id, userId, createdAt: now, updatedAt: now, ...data };

        set((state) => ({
            calendarEvents: [...state.calendarEvents, optimistic],
            syncState: "SAVING", isSaving: true,
        }));

        void apiJson<CalendarEvent>("/api/events", { method: "POST", body: JSON.stringify(data) })
            .then((created) => {
                set((state) => ({
                    calendarEvents: state.calendarEvents.map(e => e.id === id ? created : e),
                    syncState: "SAVED", isSaving: false,
                }));
            })
            .catch(() => {
                set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
                toast.error("Failed to create event");
            });
    },

    optimisticPatchCalendarEvent: (eventId, patch) => {
        const snapshot = get().calendarEvents;
        set((state) => ({
            calendarEvents: state.calendarEvents.map(e =>
                e.id === eventId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
            ),
            syncState: "SAVING", isSaving: true,
        }));

        void apiJson<CalendarEvent>(`/api/events/${eventId}`, { method: "PUT", body: JSON.stringify(patch) })
            .then(() => set({ syncState: "SAVED", isSaving: false }))
            .catch(() => {
                set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
                toast.error("Failed to update event");
            });
    },

    optimisticDeleteCalendarEvent: (eventId) => {
        const snapshot = get().calendarEvents;
        set((state) => ({
            calendarEvents: state.calendarEvents.filter(e => e.id !== eventId),
            syncState: "SAVING", isSaving: true,
        }));

        void fetch(`/api/events/${eventId}`, { method: "DELETE", credentials: "include" })
            .then(res => { if (!res.ok) throw new Error(); set({ syncState: "SAVED", isSaving: false }); })
            .catch(() => {
                set({ calendarEvents: snapshot, syncState: "ERROR", isSaving: false });
                toast.error("Failed to delete event");
            });
    },
});