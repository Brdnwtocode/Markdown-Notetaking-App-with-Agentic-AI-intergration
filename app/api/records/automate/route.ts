// app/api/records/automate/route.ts
//
// POST → Agentic Automate BFF Proxy
// Accepts multipart/form-data with audio blob + metadata from the client,
// forwards everything to the stateless FastAPI microservice.
// FastAPI has no DB access — it only processes and returns mutations.

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getFileBuffer } from "@/lib/storage";
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
    const transcriptFromClient = formData.get("transcript");
    const transcript = (transcriptFromClient as string) || "";
    const hasTranscript = transcriptFromClient !== null && transcript.trim().length > 0;
    const recordingId = (formData.get("recordingId") as string) || "";
    const action = (formData.get("action") as string) || "full_automate";

    const isTempId = recordingId.startsWith("temp_");

    // ─── Resolve audio ──────────────────────────────────────────────────
    // Prefer the uploaded blob. For saved (non-temp) recordings without
    // an uploaded blob, fetch from S3 server-side before validating.
    let resolvedAudio: File | null = audioFile;

    // Only resolve S3 audio when we actually need it — skip if transcript
    // is available (Case 2: transcript-only run). hasTranscript is already
    // computed above from the client FormData.
    if ((!resolvedAudio || resolvedAudio.size === 0) && recordingId && !isTempId && !hasTranscript) {
      const rec = await prisma.recording.findUnique({
        where: { id: recordingId },
        select: { id: true, userId: true, audioKey: true },
      });

      // Ownership check (fast-fail before any S3 work)
      if (!rec || rec.userId !== session.user.id) {
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

      // Fetch audio from S3 if available
      if (rec.audioKey) {
        try {
          const { buffer, contentType } = await getFileBuffer(rec.audioKey);
          resolvedAudio = new File([buffer], "recording.webm", { type: contentType });
          console.log(`[Records Automate] Fetched audio from S3: ${rec.audioKey} (${buffer.length} bytes)`);
        } catch (err) {
          console.error("[Records Automate] Failed to fetch audio from S3:", err);
        }
      }
    }

    // ─── Validate ────────────────────────────────────────────────────────
    // Must have at least transcript or audio (possibly S3-resolved above)
    if (!hasTranscript && (!resolvedAudio || resolvedAudio.size === 0)) {
      // If we got here via a valid recording ID, revert the RESOLVING status
      if (recordingId && !isTempId) {
        await prisma.recording.update({
          where: { id: recordingId },
          data: { status: "COMMITTED" },
        }).catch(() => {});
      }
      return NextResponse.json(
        { error: "Transcript or audio is required" },
        { status: 400 },
      );
    }

    // ─── Build FastAPI payload ───────────────────────────────────────────
    const fastApiFormData = new FormData();
    fastApiFormData.append("recording_id", recordingId);
    fastApiFormData.append("user_id", session.user.id);
    fastApiFormData.append("mode", "automate");
    fastApiFormData.append("action", action);

    // Mutual exclusivity: send audio OR transcript, never both.
    // When the client provides a non-empty transcript (audioOnly OFF),
    // FastAPI skips STT and uses the transcript directly.
    // When audioOnly is ON, the transcript key is absent from the client
    // FormData so hasTranscript is false — audio is sent for re-transcription.
    if (hasTranscript) {
      fastApiFormData.append("transcript", transcript);
    } else if (resolvedAudio && resolvedAudio.size > 0) {
      fastApiFormData.append("audio", resolvedAudio);
    }

    const fastApiUrl = process.env.FASTAPI_URL || "http://0.0.0.0:8000";

    console.log(`[Records Automate] POST ${fastApiUrl}/api/v1/records/automate`);
    console.log(`[Records Automate] Audio: ${!!resolvedAudio}, Size: ${resolvedAudio?.size || 0}, Source: ${resolvedAudio === audioFile ? "client" : "S3"}`);

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
      const errorBody = await fastApiResponse.json().catch(() => ({}));
      const detail = errorBody.detail;
      console.error("[Records Automate] FastAPI error:", fastApiResponse.status, detail);

      // Revert status if we had a real (non-temp) recording
      if (recordingId && !isTempId) {
        await prisma.recording.update({
          where: { id: recordingId },
          data: { status: "COMMITTED" },
        }).catch(() => {});
      }

      // detail can be a string (FastAPI error), an array (Pydantic validation
      // errors), or undefined (non-JSON response body, e.g. nginx 502).
      return NextResponse.json(
        {
          error: typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? "Validation failed"
              : `Agentic Automate failed (${fastApiResponse.status})`,
          details: Array.isArray(detail) ? detail : undefined,
        },
        { status: fastApiResponse.status },
      );
    }

    const result = await fastApiResponse.json();

    // Deep-normalize: convert all snake_case keys to camelCase recursively
    const normalized = deepNormalize(result);

    // Store mutations on the Recording row (audit trail) — use raw result for DB.
    // Merge semantics: null → don't overwrite existing DB value (except taskMutations).
    // This ensures a transcript-only run doesn't wipe speaker labels, note mutations,
    // or calendar events generated by a previous audio-based run.
    // Skip temp IDs — they don't exist in the DB.
    if (recordingId && !isTempId) {
      const updateData: Record<string, any> = {
        status: "COMMITTED",
      };

      // Transcript: only overwrite if non-empty (Cases 3, 4)
      if (result.transcript) {
        updateData.transcript = result.transcript;
      }

      // Mutations: only overwrite if non-null
      if (result.note_mutation !== null && result.note_mutation !== undefined) {
        updateData.noteMutation = result.note_mutation;
      }
      if (result.stack_mutation !== null && result.stack_mutation !== undefined) {
        updateData.stackMutation = result.stack_mutation;
      }
      if (result.calendar_mutation !== null && result.calendar_mutation !== undefined) {
        updateData.calendarMutation = result.calendar_mutation;
      }
      if (result.speaker_labels !== null && result.speaker_labels !== undefined) {
        updateData.speakerLabels = result.speaker_labels;
      }

      // Task mutations: always overwrite (even [] — stale tasks should not persist)
      updateData.taskMutations = result.task_mutations ?? [];

      await prisma.recording.update({
        where: { id: recordingId },
        data: updateData,
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