import { auth } from "@/app/auth";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel serverless function timeout

/**
 * Backend-For-Frontend (BFF) Proxy for Voice Processing
 * 
 * This route acts as a proxy to the FastAPI microservice.
 * It translates camelCase fields to snake_case before forwarding.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const contextType = formData.get("contextType") as string;
    const contextId = formData.get("contextId") as string;
    const cursorPosition = formData.get("cursorPosition") as string;
    const noteState = formData.get("note_state") as string;
    const dynamicSchema = formData.get("dynamic_schema") as string;
    const taskContext = formData.get("task_context") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Build FormData with snake_case keys for FastAPI
    const fastApiFormData = new FormData();
    fastApiFormData.append("audio", audioFile);
    fastApiFormData.append("context_type", contextType);
    fastApiFormData.append("context_id", contextId);
    
    if (cursorPosition) {
      fastApiFormData.append("cursor_position", cursorPosition);
    }
    if (noteState) {
      fastApiFormData.append("note_state", noteState);
    }
    if (dynamicSchema) {
      fastApiFormData.append("dynamic_schema", dynamicSchema);
    }
    if (taskContext) {
      fastApiFormData.append("task_context", taskContext);
    }

    // Add user ID for backend validation
    fastApiFormData.append("user_id", session.user.id);

    const fastApiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

    // Forward to FastAPI microservice
    const fastApiResponse = await fetch(
      `${fastApiUrl}/api/v1/voice/process`,
      {
        method: "POST",
        body: fastApiFormData,
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

    const responseData = await fastApiResponse.json();
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Voice proxy error:", error);
    return NextResponse.json(
      { error: "Failed to process voice command" },
      { status: 500 }
    );
  }
}
