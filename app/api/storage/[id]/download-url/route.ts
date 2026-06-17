// app/api/storage/[id]/download-url/route.ts
//
// GET → Generate a presigned download URL for a FileRecord.

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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

  const url = await getDownloadUrl(fileRecord.storageKey, 3600);

  return NextResponse.json({ url });
}
