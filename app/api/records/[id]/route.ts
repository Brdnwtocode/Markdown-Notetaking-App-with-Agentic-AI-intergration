// app/api/records/[id]/route.ts
//
// GET    → Single recording detail
// PATCH  → Update recording metadata (transcript, status, duration, etc.)
// DELETE → Delete recording and its S3 audio file

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recording = await prisma.recording.findUnique({
    where: { id: params.id },
    include: { attachments: true },
  });

  if (!recording) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (recording.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(recording);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.recording.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const recording = await prisma.recording.update({
    where: { id: params.id },
    data: {
      title: body.title,
      transcript: body.transcript,
      durationSec: body.durationSec,
      status: body.status,
      audioKey: body.audioKey,
      audioSizeBytes: body.audioSizeBytes,
      errorLog: body.errorLog,
      folderId: body.folderId,
      noteMutation: body.noteMutation,
      taskMutations: body.taskMutations,
      stackMutation: body.stackMutation,
      calendarMutation: body.calendarMutation,
      speakerLabels: body.speakerLabels,
      committedAt: body.status === "COMMITTED" ? new Date() : undefined,
    },
    include: { attachments: true },
  });

  return NextResponse.json(recording);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.recording.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete audio from S3 if stored
  if (existing.audioKey) {
    try {
      await deleteFile(existing.audioKey);
    } catch (err) {
      console.error("[records] Failed to delete S3 audio file:", err);
      // Continue with DB deletion anyway
    }
  }

  // Delete attachment files from S3 before cascade-deleting the DB rows
  const attachments = await prisma.attachment.findMany({
    where: { recordingId: params.id },
    select: { storageKey: true },
  });
  for (const att of attachments) {
    try {
      await deleteFile(att.storageKey);
    } catch (err) {
      console.error("[records] Failed to delete S3 attachment:", att.storageKey, err);
    }
  }

  await prisma.recording.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
