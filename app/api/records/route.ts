// app/api/records/route.ts
//
// GET  → List all recordings for the authenticated user
// POST → Create a new recording (metadata only, audio uploaded separately)

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recordings = await prisma.recording.findMany({
    where: { userId: session.user.id },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recordings);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user still exists in DB (session may outlive the user row
  // after a DB reset or migration issue).
  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "Session expired — user no longer exists. Please sign out and re-register." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { title, transcript, durationSec, audioKey, audioSizeBytes } = body;

  const recording = await prisma.recording.create({
    data: {
      userId: session.user.id,
      title: title || "Untitled Recording",
      transcript: transcript || "",
      durationSec: durationSec || 0,
      status: "COMMITTED",
      audioKey: audioKey || null,
      audioSizeBytes: audioSizeBytes || null,
    },
    include: { attachments: true },
  });

  return NextResponse.json(recording, { status: 201 });
}
