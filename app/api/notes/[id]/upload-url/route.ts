import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { getUploadUrl } from "@/lib/storage";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * POST /api/notes/[id]/upload-url
 *
 * Returns a presigned PUT URL for direct-to-S3 image upload.
 * The client PUTs the raw bytes, then stores the relative path
 * `/api/images/{noteId}/{key}` in the markdown.
 *
 * Auth: same ownership check as other /notes/[id] write routes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = randomUUID().slice(0, 8);
  console.log(`\n[upload-url:${requestId}] ═══ REQUEST START ═══`);
  console.log(`[upload-url:${requestId}] noteId=${params.id}`);

  try {
    // ── Step 1: Auth ──────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      console.log(`[upload-url:${requestId}] ❌ STEP 1 AUTH: No session → 401`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[upload-url:${requestId}] ✅ STEP 1 AUTH: userId=${session.user.id}`);

    // ── Step 2: Note ownership ────────────────────────────────────
    const note = await prisma.note.findUnique({
      where: { id: params.id },
      select: { userId: true, title: true },
    });

    if (!note) {
      console.log(`[upload-url:${requestId}] ❌ STEP 2 NOTE: Not found in DB → 404`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (note.userId !== session.user.id) {
      console.log(`[upload-url:${requestId}] ❌ STEP 2 NOTE: Owner mismatch (note.userId=${note.userId}, session.userId=${session.user.id}) → 404`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.log(`[upload-url:${requestId}] ✅ STEP 2 NOTE: title="${note.title}", owner matches`);

    // ── Step 3: Parse body ────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.log(`[upload-url:${requestId}] ❌ STEP 3 BODY: Invalid JSON → 400`);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.log(`[upload-url:${requestId}] ✅ STEP 3 BODY: parsed, keys=${Object.keys(body as object).join(",")}`);

    const schema = z.object({
      contentType: z.string().min(1, "contentType is required"),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      console.log(`[upload-url:${requestId}] ❌ STEP 3 BODY: Validation failed`, result.error.flatten());
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { contentType } = result.data;
    console.log(`[upload-url:${requestId}] ✅ STEP 3 BODY: contentType="${contentType}"`);

    // ── Step 4: Validate content type ─────────────────────────────
    const ext = ALLOWED_CONTENT_TYPES[contentType];
    if (!ext) {
      console.log(`[upload-url:${requestId}] ❌ STEP 4 MIME: Unsupported contentType="${contentType}" → 400`);
      return NextResponse.json(
        {
          error: `Unsupported content type: ${contentType}. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}`,
        },
        { status: 400 }
      );
    }
    console.log(`[upload-url:${requestId}] ✅ STEP 4 MIME: ext=".${ext}"`);

    // ── Step 5: Generate key & presigned URL ──────────────────────
    const key = `notes/${params.id}/${randomUUID()}.${ext}`;
    console.log(`[upload-url:${requestId}] STEP 5 S3: generating presigned URL for key="${key}"`);

    let uploadUrl: string;
    try {
      uploadUrl = await getUploadUrl(key, contentType, 300);
    } catch (s3Err: any) {
      console.error(`[upload-url:${requestId}] ❌ STEP 5 S3: getUploadUrl failed`, {
        name: s3Err.name,
        message: s3Err.message,
        code: s3Err.Code,
        statusCode: s3Err.$metadata?.httpStatusCode,
      });
      return NextResponse.json(
        { error: `S3 presigned URL generation failed: ${s3Err.message}` },
        { status: 500 }
      );
    }
    console.log(`[upload-url:${requestId}] ✅ STEP 5 S3: presigned URL generated (length=${uploadUrl.length})`);
    console.log(`[upload-url:${requestId}] ═══ REQUEST SUCCESS ═══\n`);

    return NextResponse.json({ uploadUrl, key });
  } catch (error: any) {
    console.error(`[upload-url:${requestId}] ❌ UNHANDLED ERROR:`, {
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
