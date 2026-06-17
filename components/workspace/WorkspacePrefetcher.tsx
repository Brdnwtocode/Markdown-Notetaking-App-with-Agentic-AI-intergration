"use client";

// components/workspace/WorkspacePrefetcher.tsx
//
// Silent background pre-fetcher. Fires all data fetches in parallel when the
// workspace first loads so every tab has instant data. Runs once, never shows
// loading states or errors to the user — panes will fall back to their own
// fetch if the pre-fetch didn't complete in time.

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/lib/store";
import axios from "axios";

export default function WorkspacePrefetcher() {
  const ranRef = useRef(false);
  const store = useWorkspaceStore();

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    // Fire all fetches in parallel — results populate Zustand caches so
    // individual panes find data instantly without their own API calls.
    Promise.allSettled([
      // Notes
      axios.get("/api/notes").then((r) => {
        store.setNotes(r.data);
        // Also populate noteCache for individual note lookups
        if (Array.isArray(r.data)) {
          r.data.forEach((note: any) => store.upsertNoteCache(note));
        }
      }),

      // Stacks
      axios.get("/api/stacks").then((r) => store.setStacks(r.data)),

      // Tasks
      axios.get("/api/tasks").then((r) => store.setTasks(r.data)),

      // Calendar events (current month range)
      axios.get("/api/events", { params: { from, to } }).then((r) =>
        store.setCalendarEvents(r.data)
      ),

      // Recordings
      axios.get("/api/records").then((r) => store.setRecordings(r.data)),

      // File records
      axios.get("/api/storage").then((r) => store.setFileRecords(r.data)),

    ]);
    // Silent — individual panes will fetch on demand if any pre-fetch failed
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // Invisible — no UI
}
