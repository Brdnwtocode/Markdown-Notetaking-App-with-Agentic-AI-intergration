// app/api/storage/[id]/route.ts
//
// DELETE → Remove a FileRecord (and its S3 object).
// PATCH  → Move a file to a different folder.

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: params.id },
  });

  if (!fileRecord || fileRecord.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from S3 (best-effort — don't fail if S3 delete fails)
  try {
    await deleteFile(fileRecord.storageKey);
  } catch (err: any) {
    console.warn("[Storage DELETE] S3 deletion failed (non-fatal):", err.message);
  }

  await prisma.fileRecord.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: params.id },
  });

  if (!fileRecord || fileRecord.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { folderId } = body;

  // folderId can be null (move to root) or a string (move to folder)
  if (folderId !== null && typeof folderId !== "string") {
    return NextResponse.json(
      { error: "folderId must be null or a string" },
      { status: 400 },
    );
  }

  const updated = await prisma.fileRecord.update({
    where: { id: params.id },
    data: { folderId },
  });

  return NextResponse.json(updated);
}
