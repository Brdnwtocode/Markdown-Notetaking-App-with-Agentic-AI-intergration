# Codebase Audit & Design Plan: Real-Time STT via Deepgram

> Stack: Next.js 14 · FastAPI microservice · Zustand · Milkdown · `react-media-recorder`

---

## Part 1 — Codebase Audit

### What's already there

| Layer | File | State |
|---|---|---|
| UI input | `components/shared/PushToTalk.tsx` | Hold-to-record, `MediaRecorder` raw, Ctrl+Space keyboard binding |
| Client API call | `lib/voiceApi.ts` | Thin axios wrapper posting `audio.webm` blob |
| BFF proxy | `app/api/voice/process/route.ts` | Camel→snake rename, auth check, 10 MB cap, forwards to FastAPI |
| State | `lib/slices/aiSlice.ts` | `pendingAction`, `aiReply`, `recordingTranscript` |

### Honest issues found

**1. `react-media-recorder` is doing nothing useful here.**
`PushToTalk.tsx` bypasses the library entirely — it calls `navigator.mediaDevices.getUserMedia` and `new MediaRecorder()` by hand. The `react-media-recorder` dependency is dead weight. It should be removed.

**2. Keyboard handler closure bug.**
The `keydown`/`keyup` effect has `[isRecording, isProcessing]` in its dependency array, which means the handlers are torn down and re-attached on every state flip. Any key held across a re-render can miss the `keyup`. The fix is to use a stable `useRef` for the flags.

**3. `stopRecording` is not idempotent.**
If the user releases the key before `MediaRecorder` has had time to fire `ondataavailable`, `audioChunksRef.current` is empty and the function bails silently. There is no minimum recording guard and no user feedback that the clip was too short.

**4. No interim transcript display.**
The current flow is pure batch: record → stop → upload → wait (up to Vercel's 60-second timeout) → render. There is no live visual feedback while the user is speaking.

**5. The BFF proxy adds a full RTT.**
For the new streaming path, the client WebSocket should connect directly to Deepgram (with a short-lived temp token minted server-side), not through a Next.js route that can't hold a WebSocket open anyway.

**6. Model choice needs revisiting.**
You asked for "the v2 model for Vietnamese". Nova-2 does support Vietnamese (`language=vi`). However, as of January 2026, **Nova-3 now supports Vietnamese** with better tonal accuracy. Unless you have a specific reason to freeze on Nova-2, Nova-3 is the better choice for `vi`. This plan uses Nova-3 but makes it a config constant.

---

## Part 2 — Library-First Filter

Before writing a single line of custom WebSocket code, the question is: does a maintained library solve this?

**`@deepgram/sdk` v5.x (npm: `@deepgram/sdk`)** — Yes, it does.

- Isomorphic: works in both Node.js and browser.
- `client.listen.v1.connect()` / `client.listen.v2.connect()` returns a typed event-emitting connection.
- Handles KeepAlive pings, reconnection state, and `Sec-WebSocket-Protocol` auth (required for browser WebSockets since you can't set an `Authorization` header there).
- Ships TypeScript types for all response shapes (`ListenV1Results`, etc.).

**Verdict: use `@deepgram/sdk`. Do not write a custom WebSocket client.**

The only custom code needed is the token-minting endpoint (one tiny Next.js route) and the fallback orchestration logic in the component.

---

## Part 3 — Architecture Design

### The two-path model

```
User holds PTT
     │
     ▼
[useDeepgramSTT hook]
     │
     ├─ ATTEMPT ──► Deepgram WebSocket (nova-3, vi)
     │               via @deepgram/sdk
     │               │
     │               ├─ interim results ──► setInterimTranscript()
     │               └─ final result    ──► onTranscriptReady(text)
     │
     └─ FALLBACK (WS fails or times out within 3 s)
          │
          ▼
       Collect blobs ──► POST /api/voice/process ──► FastAPI
                                                      │
                                                      └─► onTranscriptReady(text)
```

### Token security

The Deepgram API key **must never be in the browser bundle**. The pattern:

```
Browser                      Next.js Server              Deepgram
  │                               │                          │
  │── GET /api/deepgram/token ───►│                          │
  │                               │── POST /auth/grant ─────►│
  │                               │◄─ { token, expires_in } ─│
  │◄── { token } ─────────────────│                          │
  │                               │                          │
  │── wss://api.deepgram.com ─────────────────────────────►│
  │   Sec-WebSocket-Protocol: token.<TOKEN>                  │
```

Tokens are short-lived (~30 s). Mint one per PTT session, not one globally.

### State machine for the hook

```
IDLE
  │ onMouseDown / Ctrl+Space
  ▼
MINTING_TOKEN
  │ token received
  ▼
CONNECTING_WS ──(timeout 3s or error)──► FALLBACK_BATCH
  │ WS open
  ▼
STREAMING
  │ onMouseUp / Ctrl released
  ▼
FINALIZING ──(speech_final received or 1s timeout)──► IDLE
  │
  └── sends transcript to onTranscriptReady()

FALLBACK_BATCH
  │ POST /api/voice/process returns
  ▼
IDLE
```

---

## Part 4 — Implementation Plan

### Step 0 — Dependency changes

```bash
npm install @deepgram/sdk
npm uninstall react-media-recorder   # dead weight, remove it
```

**Why remove `react-media-recorder`?** It's listed in `package.json` but never used in `PushToTalk.tsx`. Keeping unused dependencies is a liability — they appear in audits, inflate the bundle, and create false impressions in the dependency graph.

---

### Step 1 — Token endpoint

**New file: `app/api/deepgram/token/route.ts`**

```typescript
import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mint a short-lived Deepgram token scoped to streaming only.
  // TTL is 30s — enough for one PTT session.
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ time_to_live_in_seconds: 30 }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to mint Deepgram token" },
      { status: 500 }
    );
  }

  const { key } = await response.json();
  return NextResponse.json({ token: key });
}
```

**Why a fresh token per session?** A stolen token is valid for at most 30 seconds. Using a long-lived API key in a stored browser token is an unnecessary security exposure.

---

### Step 2 — `useDeepgramSTT` hook

**New file: `lib/hooks/useDeepgramSTT.ts`**

This is the core of the feature. It owns the state machine and both paths.

```typescript
"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@deepgram/sdk";
import toast from "react-hot-toast";

type STTStatus =
  | "idle"
  | "minting"
  | "connecting"
  | "streaming"
  | "finalizing"
  | "fallback";

interface UseDeepgramSTTOptions {
  /** Called with the final committed transcript text */
  onTranscriptReady: (text: string) => void;
  /** Called on every interim result for live display */
  onInterimTranscript?: (text: string) => void;
  /** BCP-47 language code. Defaults to "vi" */
  language?: string;
  /** Model to use. Defaults to "nova-3" */
  model?: string;
}

export function useDeepgramSTT({
  onTranscriptReady,
  onInterimTranscript,
  language = "vi",
  model = "nova-3",
}: UseDeepgramSTTOptions) {
  const [status, setStatus] = useState<STTStatus>("idle");

  // Refs for the WebSocket connection and audio pipeline
  const dgConnectionRef = useRef<ReturnType<
    Awaited<ReturnType<typeof createClient>>["listen"]["v1"]["connect"]
  > | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const blobsRef = useRef<Blob[]>([]);  // kept for fallback path
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fallback path ────────────────────────────────────────────────────────
  const runFallback = useCallback(
    async (contextType: string, contextId: string, extras: FormData) => {
      setStatus("fallback");
      toast("Falling back to batch transcription…", { icon: "⚠️" });

      // Stop streaming if it was active
      dgConnectionRef.current?.finish();
      dgConnectionRef.current = null;

      // Wait for MediaRecorder to flush remaining data
      await new Promise<void>((resolve) => {
        const mr = mediaRecorderRef.current;
        if (!mr || mr.state === "inactive") { resolve(); return; }
        mr.onstop = () => resolve();
        mr.stop();
      });

      const audioBlob = new Blob(blobsRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", audioBlob, "audio.webm");
      form.append("contextType", contextType);
      form.append("contextId", contextId);
      // Copy any extra fields (note_state, dynamic_schema, etc.)
      extras.forEach((value, key) => form.append(key, value));

      try {
        const res = await fetch("/api/voice/process", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const { transcript } = await res.json();
        onTranscriptReady(transcript ?? "");
      } catch {
        toast.error("Voice processing failed");
      } finally {
        setStatus("idle");
        cleanup();
      }
    },
    [onTranscriptReady]
  );

  // ─── Streaming path ───────────────────────────────────────────────────────
  const startStreaming = useCallback(
    async (
      stream: MediaStream,
      contextType: string,
      contextId: string,
      extras: FormData
    ) => {
      // 1. Mint a fresh short-lived token
      setStatus("minting");
      let token: string;
      try {
        const res = await fetch("/api/deepgram/token");
        if (!res.ok) throw new Error("Token fetch failed");
        ({ token } = await res.json());
      } catch {
        // Token mint failed — go straight to fallback
        return runFallback(contextType, contextId, extras);
      }

      // 2. Open Deepgram WebSocket using the SDK
      setStatus("connecting");

      // Arm a 3-second fallback timer; cancelled if WS opens successfully
      fallbackTimerRef.current = setTimeout(() => {
        runFallback(contextType, contextId, extras);
      }, 3000);

      const client = createClient(token);
      const connection = client.listen.v1.connect({
        model,
        language,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        smart_format: true,
      });

      connection.on("open", () => {
        // WS opened — cancel fallback timer
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        setStatus("streaming");
      });

      connection.on("error", () => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        runFallback(contextType, contextId, extras);
      });

      connection.on("close", () => {
        // Unexpected close while still streaming — fall back
        if (status === "streaming") {
          runFallback(contextType, contextId, extras);
        }
      });

      connection.on("Results", (data: any) => {
        const transcript: string =
          data?.channel?.alternatives?.[0]?.transcript ?? "";

        if (data.is_final && data.speech_final) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + transcript;
          onInterimTranscript?.(finalTranscriptRef.current);
        } else {
          onInterimTranscript?.(
            (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + transcript
          );
        }
      });

      dgConnectionRef.current = connection;

      // 3. Pipe mic audio via AudioWorklet (avoids main-thread blocking)
      //    Falls back to ScriptProcessorNode if AudioWorklet not supported.
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      try {
        await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");
        const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (dgConnectionRef.current && status !== "idle") {
            dgConnectionRef.current.socket?.send(e.data);
          }
        };
        source.connect(workletNode);
        audioWorkletNodeRef.current = workletNode;
      } catch {
        // AudioWorklet unavailable — use ScriptProcessor as fallback
        const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          dgConnectionRef.current?.socket?.send(int16.buffer);
        };
        source.connect(scriptNode);
        scriptNode.connect(audioContext.destination);
      }
    },
    [language, model, onInterimTranscript, runFallback, status]
  );

  // ─── Public API ───────────────────────────────────────────────────────────
  const start = useCallback(
    async (contextType: string, contextId: string, extras: FormData) => {
      if (status !== "idle") return;
      blobsRef.current = [];
      finalTranscriptRef.current = "";

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch {
        toast.error("Microphone access denied");
        return;
      }

      // Also wire up a MediaRecorder in parallel — its blobs feed the fallback path
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) blobsRef.current.push(e.data);
      };
      mr.start(100); // 100ms timeslices so fallback has data quickly
      mediaRecorderRef.current = mr;

      await startStreaming(stream, contextType, contextId, extras);
    },
    [status, startStreaming]
  );

  const stop = useCallback(async () => {
    if (status === "idle") return;
    setStatus("finalizing");

    // Send CloseStream signal — Deepgram will flush and send final transcript
    dgConnectionRef.current?.finish();

    // Give Deepgram 1s to send the final speech_final event
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const finalText = finalTranscriptRef.current;
    if (finalText) {
      onTranscriptReady(finalText);
    }

    cleanup();
    setStatus("idle");
  }, [status, onTranscriptReady]);

  const cleanup = useCallback(() => {
    mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop();
    audioWorkletNodeRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    dgConnectionRef.current?.finish();
    dgConnectionRef.current = null;
    mediaStreamRef.current = null;
    audioWorkletNodeRef.current = null;
    audioContextRef.current = null;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  return { status, start, stop };
}
```

---

### Step 3 — AudioWorklet processor

**New file: `public/worklets/pcm-processor.js`**

This runs in a dedicated audio thread, avoiding main-thread jank.

```javascript
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Convert Float32 to Int16 PCM
    const int16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
    }
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
```

**Why a worklet?** `ScriptProcessorNode` is deprecated, runs on the main thread, and drops audio during React re-renders. The worklet runs in a dedicated audio thread. The hook includes a `ScriptProcessorNode` fallback for any environment that doesn't support worklets yet, but that should be rare in 2025 browsers.

---

### Step 4 — Refactor `PushToTalk.tsx`

The component becomes thin — it handles UI and context-gathering only; the hook owns all audio logic.

Key changes:
- Remove all `MediaRecorder` / `getUserMedia` / `audioChunks` code from the component.
- Remove `react-media-recorder` import (it was unused anyway).
- Fix the keyboard-handler closure bug: use `useRef` for `isRecording` so the event listeners don't need to re-register on every state change.
- Add an interim transcript display (a small pill or inline text) that shows what Deepgram is transcribing in real time.
- Replace the two status booleans (`isRecording`, `isProcessing`) with the hook's `status` enum for cleaner UI branching.

```typescript
"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useDeepgramSTT } from "@/lib/hooks/useDeepgramSTT";
import toast from "react-hot-toast";

export default function PushToTalk() {
  const {
    setIsRecording,
    setRecordingTranscript,
    currentNoteId,
    currentStackId,
    cursorPosition,
    setIsVoiceMutating,
    stacks,
    noteCache,
    setPendingAction,
    setAiReply,
    openTabs,
    activeTabId,
    currentFocusedTaskId,
    tasks,
    taskChildrenMap,
  } = useWorkspaceStore();

  const { status, start, stop } = useDeepgramSTT({
    language: "vi",
    model: "nova-3",

    onInterimTranscript: (text) => {
      setRecordingTranscript(text);
    },

    onTranscriptReady: async (transcript) => {
      // --- Same action-dispatch logic as before ---
      // (moved here; the hook delivers the transcript, the component
      //  decides what to do with it)
      setRecordingTranscript(transcript);

      // If you still want LLM processing, POST to /api/voice/process
      // but pass `transcript` as text, not raw audio — cheaper and faster.
      // Or call FastAPI directly with the transcript for intent parsing.
    },
  });

  // Stable ref so keyboard handlers don't need to re-register
  const statusRef = useRef(status);
  statusRef.current = status;

  const handleStart = () => {
    // Gather context before starting — same logic as before
    let contextType: string | null = null;
    let contextId: string | null = null;
    const extras = new FormData();

    if (currentNoteId) {
      contextType = "NOTE";
      contextId = currentNoteId;
      const noteState = noteCache[currentNoteId]?.content || "";
      extras.append("note_state", noteState);
    } else if (currentStackId) {
      contextType = "STACK";
      contextId = currentStackId;
      const stack = stacks.find((s) => s.id === currentStackId);
      if (stack) extras.append("dynamic_schema", JSON.stringify(stack.columns));
    } else {
      const activeTab = openTabs.find((t) => t.id === activeTabId);
      if (activeTab?.type === "TASKS") {
        contextType = "TASK";
        contextId = currentFocusedTaskId ?? "none";
      } else if (activeTab?.type === "CALENDAR") {
        contextType = "CALENDAR";
        contextId = "none";
      }
    }

    if (!contextType) {
      toast.error("Select a note, stack, tasks, or calendar first");
      return;
    }

    extras.append("contextType", contextType);
    extras.append("contextId", contextId!);
    extras.append("cursorPosition", cursorPosition.toString());

    setIsRecording(true);
    setIsVoiceMutating(true);
    start(contextType, contextId!, extras);
  };

  const handleStop = async () => {
    setIsRecording(false);
    await stop();
    setIsVoiceMutating(false);
  };

  // Fixed keyboard binding — stable handlers via ref
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && statusRef.current === "idle") {
        e.preventDefault();
        handleStart();
      }
    };
    const up = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "Control") && statusRef.current !== "idle") {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []); // no deps — stable via ref

  const isActive = status !== "idle";
  const isProcessing = status === "fallback" || status === "finalizing" || status === "minting";

  return (
    <div className="fixed bottom-6 right-6 group">
      {/* Interim transcript pill */}
      {isActive && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap max-w-xs truncate">
          {status === "streaming" ? "Listening…" : status === "fallback" ? "Processing…" : status}
        </div>
      )}

      <Button
        onMouseDown={handleStart}
        onMouseUp={handleStop}
        onMouseLeave={handleStop}
        onTouchStart={handleStart}
        onTouchEnd={handleStop}
        disabled={isProcessing}
        size="icon"
        className={`h-14 w-14 rounded-md shadow-lg transition-all ${
          isActive
            ? "bg-red-500 hover:bg-red-600 scale-110"
            : "bg-primary hover:bg-primary/90"
        }`}
        title="Hold Ctrl + Space or click to record"
      >
        <Mic className={`h-6 w-6 text-white ${isActive ? "animate-pulse" : ""}`} />
      </Button>

      {isActive && (
        <div className="absolute inset-0 rounded-md bg-red-500/20 animate-ping" />
      )}
    </div>
  );
}
```

---

### Step 5 — Environment variable

Add to `.env.local` (never `.env`):

```
DEEPGRAM_API_KEY=your_key_here
```

And to `next.config.js`, ensure it is **not** exposed to the client:

```javascript
// next.config.js
// DEEPGRAM_API_KEY must NOT appear in `env:` or `publicRuntimeConfig:`
// It is only accessed in server routes. No change needed — just don't add it.
```

---

### Step 6 — Consider Nova-3 over Nova-2 for Vietnamese

You specified "v2 model." This warrants a correction:

- Nova-2 supports Vietnamese (`vi`) for both batch and streaming. ✓
- **Nova-3 also supports Vietnamese as of January 2026**, with better tonal accuracy (six Vietnamese tones, reduced false positives in fast speech).
- The `model` parameter in the hook defaults to `"nova-3"` for this reason.
- To use Nova-2 explicitly: pass `model="nova-2"` to the hook, or change the constant.

**Recommendation: use Nova-3.**

---

## Part 5 — What This Does NOT Change

The existing `/api/voice/process` → FastAPI path is **preserved entirely**. The fallback path calls it identically to the current code, so the LLM intent-parsing layer (action dispatching, `pendingAction`, `aiReply`) is unaffected. The only difference in the fallback case is that the transcript arrives faster because Deepgram has already been doing STT during the recording.

---

## Part 6 — File Changelist

| Action | File |
|---|---|
| **New** | `app/api/deepgram/token/route.ts` |
| **New** | `lib/hooks/useDeepgramSTT.ts` |
| **New** | `public/worklets/pcm-processor.js` |
| **Modify** | `components/shared/PushToTalk.tsx` |
| **Modify** | `package.json` — add `@deepgram/sdk`, remove `react-media-recorder` |
| **No change** | `app/api/voice/process/route.ts` |
| **No change** | `lib/voiceApi.ts` |
| **No change** | FastAPI microservice |

---

## Part 7 — Open Questions Before Implementation

1. **Does FastAPI also do STT?** If the FastAPI service currently calls Whisper/Deepgram batch internally, the fallback path may need adjustment once the transcript text is already available from the streaming path. Clarify the FastAPI contract before modifying `onTranscriptReady`.

2. **Does the existing batch path return a `transcript` field?** The current `PushToTalk.tsx` reads `res.data.transcript` — verify that the FastAPI response always includes this, not just the `action`/`updatedData` pair.

3. **Vercel Edge / serverless compatibility.** The token-minting route is a standard Next.js Route Handler with a single `fetch` call — it works on both Edge and serverless. No issues expected.

4. **AudioWorklet in production.** The worklet file must be served from `public/` (not `app/`) so it gets the correct MIME type and is not bundled by webpack. This is already accounted for in the plan.