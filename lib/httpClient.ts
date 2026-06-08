// lib/httpClient.ts
//
// Shared HTTP client that automatically attaches the x-session-id header
// to every outgoing request. The session ID is stable across page reloads
// within the same browser tab (stored in sessionStorage).
//
// This enables the FastAPI microservice's memory infrastructure:
//   - ConversationBuffer (multi-turn memory)
//   - UserProfile (user-specific context)
//   - InteractionStore (analytics & history)
//
// Without this header, every request creates a fresh MemoryManager
// with an empty buffer — the memory system is never actually used.

import axios from "axios";
import { getSessionId } from "./session";

// ─── Axios instance ──────────────────────────────────────────────────────────

export const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Attach x-session-id to every request (client-side only)
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const sessionId = getSessionId();
    if (sessionId && sessionId !== "ssr-placeholder") {
      config.headers["x-session-id"] = sessionId;
    }
  }
  return config;
});

// ─── Fetch wrapper ──────────────────────────────────────────────────────────

/**
 * Fetch wrapper that attaches x-session-id to every request.
 * Use this for one-off fetch calls that don't go through axios.
 */
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (typeof window !== "undefined") {
    const sessionId = getSessionId();
    if (sessionId && sessionId !== "ssr-placeholder") {
      headers.set("x-session-id", sessionId);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

/**
 * JSON fetch helper with automatic x-session-id.
 * Replacement for the bare apiJson in lib/api.ts.
 */
export async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await sessionFetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody.error || errorMessage;
    } catch {
      errorMessage = await res.text().catch(() => errorMessage);
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
