import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl, getFileMetadata } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/images/[noteId]/[key]
 *
 * Resolves a relative image path to a presigned S3 download URL via 302 redirect.
 * The markdown stores `/api/images/{noteId}/{key}` which never expires;
 * this endpoint generates a fresh signed URL on each request.
 *
 * Auth: verifies requester has read access to the note before redirecting.
 * Returns 404 if the S3 object doesn't exist.
 *
 * The `key` param captures the full filename (e.g. "abc123.png").
 * The S3 key is reconstructed as `notes/{noteId}/{key}`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { noteId: string; key: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify note exists and requester has read access
    const note = await prisma.note.findUnique({
      where: { id: params.noteId },
      select: { userId: true },
    });

    if (!note || note.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const s3Key = `notes/${params.noteId}/${params.key}`;

    // Check that the object exists in S3 before redirecting
    const exists = await getFileMetadata(s3Key);
    if (!exists) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Generate a signed download URL (reuses existing 7-day default)
    const signedUrl = await getDownloadUrl(s3Key, 3600 * 24 * 7);

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("GET /api/images/[noteId]/[key] error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
