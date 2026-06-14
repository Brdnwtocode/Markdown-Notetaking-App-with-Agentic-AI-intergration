// app/api/records/[id]/audio/route.ts
//
// GET → Returns a presigned download URL for the recording's audio file.
//        This must be server-side because @aws-sdk/client-s3 is Node.js only.

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recording = await prisma.recording.findUnique({
    where: { id: params.id },
    select: { audioKey: true, userId: true },
  });

  if (!recording) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (recording.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!recording.audioKey) {
    return NextResponse.json({ error: "No audio file" }, { status: 404 });
  }

  try {
    const url = await getDownloadUrl(recording.audioKey);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[audio] Failed to generate download URL:", err);
    return NextResponse.json(
      { error: "Storage unavailable" },
      { status: 503 },
    );
  }
}
