// app/api/storage/[id]/route.ts
//
// DELETE → Remove a FileRecord (and its S3 object).

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
