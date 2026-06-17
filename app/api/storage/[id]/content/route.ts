// app/api/storage/[id]/content/route.ts
//
// GET  → Returns file content. For text/*, application/json, application/pdf
//         returns the raw body. For binary types (image, video, audio) returns
//         a JSON wrapper with a presigned download URL to avoid streaming
//         large binaries through Next.js.
// PUT  → Saves edited text content back to S3 (for the text editor).

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl, uploadFile, deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const STREAMABLE_TYPES = [
  "text/plain", "text/markdown", "text/csv", "text/html", "text/xml",
  "application/json", "application/xml",
];

const MAX_TEXT_SIZE = 5 * 1024 * 1024; // 5MB

function isStreamable(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return STREAMABLE_TYPES.some((t) => {
    if (t === mime) return true;
    // text/* matches any text subtype
    if (t === "text/plain" && mime.startsWith("text/")) return true;
    return false;
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────

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

  // For streamable text types, fetch via presigned URL and return the body
  if (isStreamable(fileRecord.mimeType)) {
    if (fileRecord.sizeBytes > MAX_TEXT_SIZE) {
      const url = await getDownloadUrl(fileRecord.storageKey, 3600);
      return NextResponse.json({ url, tooLarge: true });
    }

    try {
      const url = await getDownloadUrl(fileRecord.storageKey, 300);
      const response = await fetch(url);
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch file content" }, { status: 502 });
      }
      const text = await response.text();
      return new NextResponse(text, {
        headers: {
          "Content-Type": fileRecord.mimeType,
          "X-File-Name": encodeURIComponent(fileRecord.fileName),
        },
      });
    } catch (err: any) {
      console.error("[storage/content GET] Failed:", err.message);
      return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
    }
  }

  // For binary files, return a presigned URL
  const url = await getDownloadUrl(fileRecord.storageKey, 3600);
  return NextResponse.json({ url });
}

// ─── PUT ──────────────────────────────────────────────────────────────────

export async function PUT(
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

  const isText = fileRecord.mimeType.startsWith("text/") ||
    fileRecord.mimeType === "application/json" ||
    fileRecord.mimeType === "application/xml";

  if (!isText) {
    return NextResponse.json(
      { error: "Editing is only supported for text-based files" },
      { status: 400 },
    );
  }

  try {
    const text = await request.text();
    if (text.length > MAX_TEXT_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_TEXT_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(text, "utf-8");
    // Save old key before overwriting so we can clean up
    const oldKey = fileRecord.storageKey;
    const result = await uploadFile(
      buffer,
      fileRecord.fileName,
      undefined,
      fileRecord.mimeType,
    );

    await prisma.fileRecord.update({
      where: { id: params.id },
      data: {
        storageKey: result.key,
        sizeBytes: text.length,
        updatedAt: new Date(),
      },
    });

    // Delete old S3 object (non-fatal if it fails)
    try {
      await deleteFile(oldKey);
    } catch {
      console.warn("[storage/content PUT] Failed to delete old S3 object:", oldKey);
    }

    return NextResponse.json({
      success: true,
      sizeBytes: text.length,
      storageKey: result.key,
    });
  } catch (err: any) {
    console.error("[storage/content PUT] Failed:", err.message);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
