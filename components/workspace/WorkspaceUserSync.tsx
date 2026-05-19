"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/lib/store";

/** Hydrates Zustand with the signed-in user id for optimistic task/event payloads. */
export default function WorkspaceUserSync({ userId }: { userId: string }) {
  const setCurrentUserId = useWorkspaceStore((s) => s.setCurrentUserId);

  useEffect(() => {
    setCurrentUserId(userId);
    return () => setCurrentUserId(null);
  }, [userId, setCurrentUserId]);

  return null;
}
