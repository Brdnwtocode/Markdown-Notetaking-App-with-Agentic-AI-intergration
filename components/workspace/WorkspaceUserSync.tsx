"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { getSessionId } from "@/lib/session";

/** Hydrates Zustand with the signed-in user id and eagerly initializes the session ID. */
export default function WorkspaceUserSync({ userId }: { userId: string }) {
  const setCurrentUserId = useWorkspaceStore((s) => s.setCurrentUserId);

  useEffect(() => {
    setCurrentUserId(userId);
    // Eagerly initialize session ID so the first API call carries the header
    getSessionId();
    return () => setCurrentUserId(null);
  }, [userId, setCurrentUserId]);

  return null;
}
