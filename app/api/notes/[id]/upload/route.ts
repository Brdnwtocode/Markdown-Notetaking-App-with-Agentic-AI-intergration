import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/notes/[id]/upload
 *
 * Accepts a multipart image file and uploads it to S3 via the backend
 * (server-to-server — avoids browser CORS issues with direct-to-S3 PUT).
 *
 * Returns the relative path key so the client can store
 * `/api/images/{noteId}/{key}` in the markdown.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = randomUUID().slice(0, 8);
  console.log(`\n[upload:${requestId}] ═══ REQUEST START ═══`);
  console.log(`[upload:${requestId}] noteId=${params.id}`);

  try {
    // ── Step 1: Auth ──────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      console.log(`[upload:${requestId}] ❌ STEP 1 AUTH: No session → 401`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[upload:${requestId}] ✅ STEP 1 AUTH: userId=${session.user.id}`);

    // ── Step 2: Note ownership ────────────────────────────────────
    const note = await prisma.note.findUnique({
      where: { id: params.id },
      select: { userId: true, title: true },
    });

    if (!note) {
      console.log(`[upload:${requestId}] ❌ STEP 2 NOTE: Not found → 404`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (note.userId !== session.user.id) {
      console.log(`[upload:${requestId}] ❌ STEP 2 NOTE: Owner mismatch → 404`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.log(`[upload:${requestId}] ✅ STEP 2 NOTE: title="${note.title}"`);

    // ── Step 3: Parse multipart form ──────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      console.log(`[upload:${requestId}] ❌ STEP 3 FORM: Not multipart → 400`);
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      console.log(`[upload:${requestId}] ❌ STEP 3 FORM: No 'file' field → 400`);
      return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }
    console.log(`[upload:${requestId}] ✅ STEP 3 FORM: file="${file.name}", type="${file.type}", size=${(file.size / 1024).toFixed(1)}KB`);

    // ── Step 4: Validate ──────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[upload:${requestId}] ❌ STEP 4 VALIDATE: File too large (${(file.size / 1024 / 1024).toFixed(1)}MB) → 400`);
      return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 });
    }

    const ext = ALLOWED_CONTENT_TYPES[file.type];
    if (!ext) {
      console.log(`[upload:${requestId}] ❌ STEP 4 VALIDATE: Unsupported type "${file.type}" → 400`);
      return NextResponse.json(
        { error: `Unsupported content type: ${file.type}. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}` },
        { status: 400 }
      );
    }
    console.log(`[upload:${requestId}] ✅ STEP 4 VALIDATE: ext=".${ext}"`);

    // ── Step 5: Upload to S3 via storage.ts ───────────────────────
    // uploadFile generates its own random UUID for the key; we just
    // pass the original filename for extension detection.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[upload:${requestId}] STEP 5 S3: uploading ${(buffer.length / 1024).toFixed(1)}KB`);

    let uploadResult;
    try {
      uploadResult = await uploadFile(
        buffer,
        file.name,
        `notes/${params.id}`,
        file.type,
      );
    } catch (s3Err: any) {
      console.error(`[upload:${requestId}] ❌ STEP 5 S3: uploadFile failed`, {
        name: s3Err.name,
        message: s3Err.message,
        code: s3Err.Code,
        statusCode: s3Err.$metadata?.httpStatusCode,
      });
      return NextResponse.json(
        { error: `S3 upload failed: ${s3Err.message}` },
        { status: 500 }
      );
    }

    // Extract just the filename portion from the full S3 key
    // uploadFile generates key as "notes/{noteId}/{uuid}.{ext}"
    const keyParts = uploadResult.key.split("/");
    const filename = keyParts[keyParts.length - 1];

    console.log(`[upload:${requestId}] ✅ STEP 5 S3: uploaded, key="${uploadResult.key}", filename="${filename}"`);
    console.log(`[upload:${requestId}] ═══ REQUEST SUCCESS ═══\n`);

    return NextResponse.json({ key: filename });
  } catch (error: any) {
    console.error(`[upload:${requestId}] ❌ UNHANDLED ERROR:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 3).join("\n"),
    });
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
