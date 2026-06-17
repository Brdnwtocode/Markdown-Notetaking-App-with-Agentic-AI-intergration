import { auth } from "@/app/auth";
import { NextRequest, NextResponse } from "next/server";
import type { VoiceResponse } from "../../../../types/voice";
import { assertMutualExclusivity } from "../../../../types/voice";
import { getDownloadUrl } from "@/lib/storage";

export const maxDuration = 60; // Vercel serverless function timeout

// ─── Image URL Resolution ────────────────────────────────────────────────────
//
// Before sending note content to the AI model, resolve every
// `/api/images/{noteId}/{key}` reference to a signed S3 download URL.
// The model can then fetch images directly. The render path is untouched —
// `<img src="/api/images/...">` lets the browser follow the redirect natively.

const IMAGE_REF_REGEX = /\/api\/images\/([^/]+)\/([^)\s"']+)/g;

/**
 * Resolve all `/api/images/{noteId}/{key}` references in a string
 * to signed S3 download URLs (7-day expiry). Returns the modified string.
 */
async function resolveImageRefsInText(text: string): Promise<string> {
  const matches: Array<{ full: string; noteId: string; key: string }> = [];
  let match;
  while ((match = IMAGE_REF_REGEX.exec(text)) !== null) {
    matches.push({ full: match[0], noteId: match[1], key: match[2] });
  }

  if (matches.length === 0) return text;

  // Resolve all refs in parallel
  const resolutions = await Promise.allSettled(
    matches.map(async (m) => {
      const s3Key = `notes/${m.noteId}/${m.key}`;
      const signedUrl = await getDownloadUrl(s3Key, 3600 * 24 * 7);
      return { full: m.full, signedUrl };
    })
  );

  let result = text;
  for (const r of resolutions) {
    if (r.status === "fulfilled") {
      result = result.replace(r.value.full, r.value.signedUrl);
    }
    // If a single resolution fails, keep the original reference — the
    // AI model will see a broken URL instead of crashing.
  }

  return result;
}

/**
 * Backend-For-Frontend (BFF) Proxy for Voice Processing
 * 
 * This route acts as a proxy to the FastAPI microservice.
 * It translates camelCase fields to snake_case before forwarding.
 * Now supports packed_context for multiple context items.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const transcript = formData.get("transcript") as string | null;
    const contextType = formData.get("contextType") as string;
    const contextId = formData.get("contextId") as string;
    const cursorPosition = formData.get("cursorPosition") as string;
    const noteState = formData.get("note_state") as string;
    const taskContext = formData.get("task_context") as string | null;
    const packedContextStr = formData.get("packed_context") as string | null;

    if (!audioFile && !transcript) {
      return NextResponse.json(
        { error: "No audio file or transcript provided" },
        { status: 400 }
      );
    }

    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Build FormData with snake_case keys for FastAPI
    const fastApiFormData = new FormData();
    if (audioFile) {
      fastApiFormData.append("audio", audioFile);
    }
    if (transcript) {
      fastApiFormData.append("transcript", transcript);
    }

    // Handle packed_context (new) or legacy single context (backward compatible)
    if (packedContextStr) {
      // Resolve image references before forwarding to FastAPI so the AI model
      // receives usable signed URLs instead of relative /api/images/... paths.
      const resolvedContext = await resolveImageRefsInText(packedContextStr);
      fastApiFormData.append("packed_context", resolvedContext);
      // NOTE: note_state is intentionally NOT forwarded when packed_context is present —
      // the full note content is already inside packed_context.items[0].content.
      // Sending both would double-pack the note and waste tokens.
    } else {
      // Legacy single context (no packed_context)
      fastApiFormData.append("context_type", contextType);
      fastApiFormData.append("context_id", contextId);
      // Legacy: only send note_state when packed_context is absent
      if (noteState) {
        const resolvedNoteState = await resolveImageRefsInText(noteState);
        fastApiFormData.append("note_state", resolvedNoteState);
      }
    }
    
    if (cursorPosition) {
      fastApiFormData.append("cursor_position", cursorPosition);
    }
    
    // Note: dynamic_schema is NOT forwarded separately — it's already inside
    // packed_context.items[].content.schema.columns when context_type is STACK
    // task_context: focused task context (sent when contextType is TASK)
    if (taskContext) {
      fastApiFormData.append("task_context", taskContext);
    }

    // Add user ID for backend validation
    fastApiFormData.append("user_id", session.user.id);

    // Use FastAPI URL from env, with fallback to 0.0.0.0:8000 (all interfaces)
    const fastApiUrl = process.env.FASTAPI_URL || "http://0.0.0.0:8000";

    console.log(`\n[FastAPI Request] POST ${fastApiUrl}/api/v1/voice/process`);
    console.log(`[FastAPI Request] User: ${session.user.id}, Has Audio: ${!!audioFile}, Has Transcript: ${!!transcript}`);
    console.log(`[FastAPI Request] Context: ${packedContextStr ? 'packed_context' : `${contextType}/${contextId}`}`);

    // Extract x-session-id from incoming request for memory continuity
    const sessionId = request.headers.get("x-session-id") || "";
    const userId = session.user.id;
    console.log(`[FastAPI Request] Session ID: ${sessionId || "(none)"}, User ID: ${userId}`);

    // Forward to FastAPI microservice, passing both session and user as HTTP headers.
    // These headers enable the memory infrastructure (ConversationBuffer, UserProfile,
    // InteractionStore) to scope data per-user and maintain per-tab conversation continuity.
    const fastApiHeaders: Record<string, string> = {};
    if (sessionId) {
      fastApiHeaders["x-session-id"] = sessionId;
    }
    fastApiHeaders["x-user-id"] = userId;

    const fastApiResponse = await fetch(
      `${fastApiUrl}/api/v1/voice/process`,
      {
        method: "POST",
        body: fastApiFormData,
        headers: fastApiHeaders,
      }
    );

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      console.error("FastAPI error:", fastApiResponse.status, errorText);
      return NextResponse.json(
        { error: "Voice processing failed" },
        { status: fastApiResponse.status }
      );
    }

    const rawData = await fastApiResponse.json();
    
    // Normalize FastAPI response to VoiceResponse contract:
    // FastAPI may return "reply" instead of "aiReply", or snake_case fields.
    const responseData: VoiceResponse = {
      action: rawData.action || "",
      updatedData: rawData.updatedData ?? rawData.updated_data ?? null,
      aiReply: rawData.aiReply ?? rawData.reply ?? rawData.ai_reply ?? null,
      error: rawData.error ?? null,
    };
    
    // Assert contract: updatedData and aiReply should be mutually exclusive
    assertMutualExclusivity(responseData);
    
    console.log(`[FastAPI Response] Status: ${fastApiResponse.status}`);
    console.log(`[FastAPI Response] Action: ${responseData.action}`);
    console.log(`[FastAPI Response] Has updatedData: ${responseData.updatedData != null}`);
    console.log(`[FastAPI Response] Has aiReply: ${!!responseData.aiReply}`);
    console.log(`[FastAPI Response] Full data:`, JSON.stringify(responseData, null, 2));
    console.log(`[FastAPI Response] ---\n`);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Voice proxy error:", error);
    return NextResponse.json(
      { error: "Failed to process voice command" },
      { status: 500 }
    );
  }
}
