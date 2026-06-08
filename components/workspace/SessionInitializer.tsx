"use client";

import { useEffect } from "react";
import { getSessionId } from "@/lib/session";

/**
 * Eagerly initializes the session ID on workspace mount.
 *
 * Without this, the session ID is generated lazily on the first API call —
 * meaning the very first voice/chat request could go out without a session ID
 * if the API call triggers before getSessionId() has been called elsewhere.
 *
 * This component calls getSessionId() once on mount, guaranteeing that every
 * subsequent request in this tab carries a stable x-session-id header.
 */
export default function SessionInitializer() {
  useEffect(() => {
    getSessionId(); // generates and caches if not already done
  }, []);

  return null; // renders nothing — side-effect only
}
