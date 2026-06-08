// lib/session.ts
//
// Generates a stable session ID that persists across page navigations
// within the same browser tab/window. Uses sessionStorage so the ID
// survives full page reloads but resets when the tab is closed.
//
// This ID is sent as the x-session-id header to the FastAPI microservice,
// enabling ConversationBuffer, UserProfile, and InteractionStore to
// maintain continuity across requests.

const SESSION_KEY = "workspace_session_id";

function generateId(): string {
  // crypto.randomUUID is available in all modern browsers
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments (shouldn't be needed)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _cachedSessionId: string | undefined;

/**
 * Returns the stable session ID for the current browser session.
 * Generated once on first call, then cached for the lifetime of the tab.
 * Uses sessionStorage so the same ID is restored after a full page reload.
 */
export function getSessionId(): string {
  if (_cachedSessionId) return _cachedSessionId;

  if (typeof window === "undefined") {
    // SSR guard — return a placeholder; client will hydrate on mount
    return "ssr-placeholder";
  }

  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = generateId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    _cachedSessionId = id;
    return id;
  } catch {
    // sessionStorage may be unavailable (e.g. privacy mode in some browsers)
    const id = generateId();
    _cachedSessionId = id;
    return id;
  }
}

/**
 * Reset the session ID (e.g. on explicit logout or "new session" action).
 */
export function resetSessionId(): void {
  _cachedSessionId = undefined;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
