// app/api/records/automate/route.ts
//
// POST → Agentic Automate: send transcript + workspace context to FastAPI
//        and receive structured mutations (notes, tasks, stacks, calendar).
//
// This is the "brain" of the Records feature — it bundles the transcription
// content with current workspace context and routes it through the NLU
// resolver to produce cross-module mutations.

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
    const body = await request.json();
    const { transcript, recordingId, workspaceContext } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    if (!recordingId) {
      return NextResponse.json(
        { error: "recordingId is required" },
        { status: 400 },
      );
    }

    // Verify recording belongs to user
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording || recording.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 },
      );
    }

    // Update status to RESOLVING
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: "RESOLVING" },
    });

    // Forward to FastAPI microservice
    const fastApiUrl = process.env.FASTAPI_URL || "http://0.0.0.0:8000";

    const payload = {
      transcript,
      recording_id: recordingId,
      user_id: session.user.id,
      workspace_context: workspaceContext || {},
      mode: "automate", // signals FastAPI this is from Records, not voice
    };

    console.log(`[Records Automate] POST ${fastApiUrl}/api/v1/records/automate`);

    const fastApiResponse = await fetch(
      `${fastApiUrl}/api/v1/records/automate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": request.headers.get("x-session-id") || "",
          "x-user-id": session.user.id,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      console.error("[Records Automate] FastAPI error:", fastApiResponse.status, errorText);

      // Revert status
      await prisma.recording.update({
        where: { id: recordingId },
        data: { status: "COMMITTED" },
      });

      return NextResponse.json(
        { error: "Agentic Automate processing failed" },
        { status: fastApiResponse.status },
      );
    }

    const result = await fastApiResponse.json();

    // Store mutations on the recording for later reference
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
    });

    // Normalize response keys to camelCase for the frontend
    const normalized = {
      noteMutation: result.note_mutation || result.noteMutation || null,
      taskMutations: result.task_mutations || result.taskMutations || [],
      stackMutation: result.stack_mutation || result.stackMutation || null,
      calendarMutation: result.calendar_mutation || result.calendarMutation || null,
      speakerLabels: result.speaker_labels || result.speakerLabels || null,
      summary: result.summary || null,
    };

    console.log("[Records Automate] Success:", JSON.stringify(normalized, null, 2));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("[Records Automate] Error:", error);
    return NextResponse.json(
      { error: "Agentic Automate failed" },
      { status: 500 },
    );
  }
}
