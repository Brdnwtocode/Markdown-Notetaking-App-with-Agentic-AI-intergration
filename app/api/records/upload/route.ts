// app/api/records/upload/route.ts
//
// POST → Upload audio file to S3 storage and link to a recording.
// Accepts multipart/form-data with an "audio" file field and "recordingId".

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, getDownloadUrl } from "@/lib/storage";
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
    const recordingId = formData.get("recordingId") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 },
      );
    }

    if (audioFile.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large (max 500MB)" },
        { status: 400 },
      );
    }

    // Verify recording ownership if recordingId provided
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
    }

    // Upload to S3
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const result = await uploadFile(
      buffer,
      audioFile.name || "recording.webm",
      "records",
      audioFile.type || "audio/webm",
    );

    // Link to recording if provided
    if (recordingId) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          audioKey: result.key,
          audioSizeBytes: result.sizeBytes,
        },
      });
    }

    return NextResponse.json({
      key: result.key,
      url: result.url,
      sizeBytes: result.sizeBytes,
      recordingId,
    }, { status: 201 });
  } catch (error) {
    console.error("[Records Upload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
