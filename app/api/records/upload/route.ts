// app/api/records/upload/route.ts
//
// POST → Upload audio file to S3 storage and link to a recording.
// Accepts multipart/form-data with an "audio" file field and "recordingId".

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Buffer, crypto, @aws-sdk are Node.js only
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let audioFile: File | null = null;
  let recordingId: string | null = null;

  try {
    const formData = await request.formData();
    audioFile = formData.get("audio") as File | null;
    recordingId = formData.get("recordingId") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 },
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio file is empty" },
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
    console.log("[Records Upload] Starting upload:", {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      recordingId,
    });

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    console.log("[Records Upload] Buffer created, size:", buffer.byteLength);

    const result = await uploadFile(
      buffer,
      audioFile.name || "recording.webm",
      "records",
      audioFile.type || "audio/webm",
    );

    console.log("[Records Upload] S3 upload result:", {
      key: result.key,
      sizeBytes: result.sizeBytes,
    });

    // Link to recording if provided
    if (recordingId) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          audioKey: result.key,
          audioSizeBytes: result.sizeBytes,
        },
      });
      console.log("[Records Upload] Recording updated with audio key:", recordingId);
    }

    return NextResponse.json({
      key: result.key,
      url: result.url,
      sizeBytes: result.sizeBytes,
      recordingId,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[Records Upload] Error:", {
      message: error?.message,
      name: error?.name,
      code: error?.Code || error?.code,
      statusCode: error?.$metadata?.httpStatusCode,
      requestId: error?.$metadata?.requestId,
      fileName: audioFile?.name,
      fileSize: audioFile?.size,
      recordingId,
    });
    // Return the actual error message to help debugging
    const errorMessage =
      error?.message || error?.Code || error?.code || "Upload failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
