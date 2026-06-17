// app/api/storage/upload/route.ts
//
// POST → Upload any file type (image, video, PDF, document, etc.) to S3 storage.
// Accepts multipart/form-data with a "file" field and optional entity links.
//
// Unlike the records-specific upload endpoint, this endpoint auto-categorizes
// files into logical folders (images/, videos/, documents/, audio/, other/)
// based on MIME type and creates a polymorphic FileRecord.
//
// Polymorphic linking (future-proof — no schema changes for new entity types):
//   • folderId              → places the file in the explorer tree
//   • entityType + entityId → links to any entity (note, recording, task, …)

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, getFolderByMimeType } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Buffer, crypto, @aws-sdk are Node.js only
export const maxDuration = 60;

/** Maximum file size for general uploads: 100 MB */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Entity types that support ownership verification via their Prisma model. */
const VERIFIABLE_ENTITY_TYPES = [
  "note",
  "recording",
  "task",
  "stack",
  "calendar_event",
] as const;

type VerifiableEntityType = (typeof VERIFIABLE_ENTITY_TYPES)[number];

/** Maps entityType → Prisma delegate name for ownership checks. */
const ENTITY_DELEGATE_MAP: Record<VerifiableEntityType, keyof typeof prisma> = {
  note: "note",
  recording: "recording",
  task: "task",
  stack: "stack",
  calendar_event: "calendarEvent",
};

/** Allowed MIME type patterns for general uploads (wildcard supported). */
const ALLOWED_MIME_PATTERNS = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
  "application/json",
  "application/xml",
  "application/zip",
  "text/",
];

function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME_PATTERNS.some(
    (pattern) =>
      mimeType === pattern ||
      (pattern.endsWith("/") && mimeType.startsWith(pattern)),
  );
}

/**
 * Verify that an entity exists and belongs to the current user.
 * Uses the polymorphic entityType to look up the correct Prisma model.
 * Unknown entity types are allowed through (future-proof — the caller
 * is responsible for their own validation).
 */
async function verifyEntityOwnership(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<{ valid: boolean; error?: string }> {
  // Unknown entity types: skip server-side validation (future extensibility)
  if (!VERIFIABLE_ENTITY_TYPES.includes(entityType as VerifiableEntityType)) {
    return { valid: true };
  }

  const delegateName = ENTITY_DELEGATE_MAP[entityType as VerifiableEntityType];
  const delegate = prisma[delegateName] as any;

  if (typeof delegate?.findUnique !== "function") {
    console.warn("[Storage Upload] No findUnique on delegate:", delegateName);
    return { valid: true }; // let it through — might be a future model
  }

  const record = await delegate.findUnique({ where: { id: entityId } });

  if (!record) {
    return { valid: false, error: `${entityType} not found` };
  }
  if (record.userId !== userId) {
    return { valid: false, error: `${entityType} not found` };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let file: File | null = null;
  let folderId: string | null = null;
  let entityType: string | null = null;
  let entityId: string | null = null;

  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
    folderId = formData.get("folderId") as string | null;
    entityType = formData.get("entityType") as string | null;
    entityId = formData.get("entityId") as string | null;

    // ── Validation ──────────────────────────────────────────────────────

    if (!file) {
      return NextResponse.json(
        { error: "File is required (use 'file' field in multipart/form-data)" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 },
      );
    }

    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 },
      );
    }

    // entityType and entityId must be provided together (or both omitted)
    if ((entityType && !entityId) || (!entityType && entityId)) {
      return NextResponse.json(
        { error: "entityType and entityId must be provided together" },
        { status: 400 },
      );
    }

    // ── Verify entity ownership (polymorphic lookup) ────────────────────

    if (entityType && entityId) {
      const ownership = await verifyEntityOwnership(
        entityType,
        entityId,
        session.user.id,
      );
      if (!ownership.valid) {
        return NextResponse.json(
          { error: ownership.error || "Entity not found" },
          { status: 404 },
        );
      }
    }

    // ── Verify folder ownership (explorer-tree placement) ───────────────

    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder || folder.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 },
        );
      }
    }

    // ── Upload to S3 ────────────────────────────────────────────────────

    console.log("[Storage Upload] Starting upload:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folderId,
      entityType,
      entityId,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const assetFolder = getFolderByMimeType(file.type);
    console.log("[Storage Upload] Auto-detected S3 folder:", assetFolder);

    const result = await uploadFile(
      buffer,
      file.name || "untitled",
      assetFolder,
      file.type || "application/octet-stream",
    );

    console.log("[Storage Upload] S3 upload result:", {
      key: result.key,
      sizeBytes: result.sizeBytes,
    });

    // ── Create FileRecord in DB ─────────────────────────────────────────

    const fileRecord = await prisma.fileRecord.create({
      data: {
        userId: session.user.id,
        folderId: folderId || null,
        entityType: entityType || null,
        entityId: entityId || null,
        fileName: file.name || "untitled",
        mimeType: file.type || "application/octet-stream",
        storageKey: result.key,
        sizeBytes: result.sizeBytes,
        assetFolder,
      },
    });

    console.log("[Storage Upload] FileRecord created:", fileRecord.id);

    return NextResponse.json(
      {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        storageKey: fileRecord.storageKey,
        sizeBytes: fileRecord.sizeBytes,
        assetFolder: fileRecord.assetFolder,
        url: result.url,
        folderId: fileRecord.folderId,
        entityType: fileRecord.entityType,
        entityId: fileRecord.entityId,
        createdAt: fileRecord.createdAt,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[Storage Upload] Error:", {
      message: error?.message,
      name: error?.name,
      code: error?.Code || error?.code,
      statusCode: error?.$metadata?.httpStatusCode,
      requestId: error?.$metadata?.requestId,
      fileName: file?.name,
      fileSize: file?.size,
    });
    const errorMessage =
      error?.message || error?.Code || error?.code || "Upload failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
