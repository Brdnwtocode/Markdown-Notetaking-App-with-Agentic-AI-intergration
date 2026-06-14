// app/api/records/automate/route.ts
//
// POST → Agentic Automate BFF Proxy
// Accepts multipart/form-data with audio blob + metadata from the client,
// forwards everything to the stateless FastAPI microservice.
// FastAPI has no DB access — it only processes and returns mutations.

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const audioFile = formData.get("audio") as File | null;
    const transcript = (formData.get("transcript") as string) || "";
    const recordingId = (formData.get("recordingId") as string) || "";
    const action = (formData.get("action") as string) || "full_automate";

    if (!transcript.trim() && !audioFile) {
      return NextResponse.json(
        { error: "Transcript or audio is required" },
        { status: 400 },
      );
    }

    // Verify recording ownership if an ID was provided (may be empty for unsaved)
    if (recordingId) {
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });
      if (!recording || recording.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Recording not found" },
          { status: 404 },
        );
      }

      // Mark as resolving
      await prisma.recording.update({
        where: { id: recordingId },
        data: { status: "RESOLVING" },
      });
    }

    // Build multipart payload for FastAPI
    const fastApiFormData = new FormData();
    fastApiFormData.append("transcript", transcript);
    fastApiFormData.append("recording_id", recordingId);
    fastApiFormData.append("user_id", session.user.id);
    fastApiFormData.append("mode", "automate");
    fastApiFormData.append("action", action);

    if (audioFile && audioFile.size > 0) {
      fastApiFormData.append("audio", audioFile);
    }

    const fastApiUrl = process.env.FASTAPI_URL || "http://0.0.0.0:8000";

    console.log(`[Records Automate] POST ${fastApiUrl}/api/v1/records/automate`);
    console.log(`[Records Automate] Audio: ${!!audioFile}, Size: ${audioFile?.size || 0}`);

    const fastApiResponse = await fetch(
      `${fastApiUrl}/api/v1/records/automate`,
      {
        method: "POST",
        headers: {
          "x-session-id": request.headers.get("x-session-id") || "",
          "x-user-id": session.user.id,
        },
        body: fastApiFormData,
      },
    );

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      console.error("[Records Automate] FastAPI error:", fastApiResponse.status, errorText);

      // Revert status if we had a recording
      if (recordingId) {
        await prisma.recording.update({
          where: { id: recordingId },
          data: { status: "COMMITTED" },
        }).catch(() => {});
      }

      return NextResponse.json(
        { error: "Agentic Automate processing failed" },
        { status: fastApiResponse.status },
      );
    }

    const result = await fastApiResponse.json();

    // Deep-normalize: convert all snake_case keys to camelCase recursively
    const normalized = deepNormalize(result);

    // Store mutations on the Recording row (audit trail) — use raw result for DB
    if (recordingId) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "COMMITTED",
          noteMutation: result.note_mutation || result.noteMutation || null,
          taskMutations: result.task_mutations || result.taskMutations || null,
          stackMutation: result.stack_mutation || result.stackMutation || null,
          calendarMutation: result.calendar_mutation || result.calendarMutation || null,
          speakerLabels: result.speaker_labels || result.speakerLabels || null,
        },
      }).catch((err) => {
        console.error("[Records Automate] Failed to store mutations:", err);
      });
    }

    console.log("[Records Automate] Success:", JSON.stringify(normalized).slice(0, 200));
    return NextResponse.json(normalized);
  } catch (error) {
    console.error("[Records Automate] Error:", error);
    return NextResponse.json(
      { error: "Agentic Automate failed" },
      { status: 500 },
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function deepNormalize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepNormalize);
  // Guard instanceof checks — File and Blob are browser-only globals,
  // undefined in the Node.js server runtime used by Next.js route handlers.
  const isFile = typeof File !== "undefined" && obj instanceof File;
  const isBlob = typeof Blob !== "undefined" && obj instanceof Blob;
  if (typeof obj === "object" && !isFile && !isBlob) {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      out[toCamel(key)] = deepNormalize(value);
    }
    return out;
  }
  return obj;
}