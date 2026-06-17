// lib/storage.ts
//
// Abstracted S3-compatible storage layer using AWS S3 in production.
// The same @aws-sdk/client-s3 also works with S3-compatible providers
// (Cloudflare R2, Supabase Storage, etc.) — swap by changing env vars.
//
// ─── Production (AWS S3) ────────────────────────────────────────────────────
//   STORAGE_ENDPOINT="https://s3.<region>.amazonaws.com"
//   STORAGE_REGION="<region>"
//   STORAGE_BUCKET="markdown-note-app"
//   STORAGE_ACCESS_KEY="<aws-access-key>"
//   STORAGE_SECRET_KEY="<aws-secret-key>"
//   STORAGE_FORCE_PATH_STYLE="false"
// ────────────────────────────────────────────────────────────────────────────

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

function isAwsEndpoint(endpoint: string): boolean {
  return endpoint.includes("amazonaws.com");
}

function getS3Client(): S3Client {
  const rawEndpoint = process.env.STORAGE_ENDPOINT || "";
  const region = process.env.STORAGE_REGION || "us-east-1";
  const forcePathStyle =
    process.env.STORAGE_FORCE_PATH_STYLE !== "false"; // default true; set STORAGE_FORCE_PATH_STYLE=false for AWS S3

  const creds = {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || "",
    secretAccessKey: process.env.STORAGE_SECRET_KEY || "",
  };

  // For AWS S3, do NOT set an explicit endpoint — let the SDK
  // auto-resolve it from the region. Explicit endpoints are only
  // needed for S3-compatible services (MinIO, R2, etc.).
  if (rawEndpoint && !isAwsEndpoint(rawEndpoint)) {
    return new S3Client({
      endpoint: rawEndpoint,
      region,
      forcePathStyle,
      credentials: creds,
    });
  }

  return new S3Client({
    region,
    forcePathStyle,
    credentials: creds,
  });
}

function getBucket(): string {
  return process.env.STORAGE_BUCKET || "markdown-note-app";
}

// Lazy singleton — created on first use so env vars are loaded
let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) _client = getS3Client();
  return _client;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface StoredFile {
  key: string; // path within bucket, e.g. "records/abc123.wav"
  bucket: string;
  sizeBytes: number;
  contentType: string;
  etag?: string;
}

export interface UploadResult {
  key: string;
  url: string; // public or presigned URL
  sizeBytes: number;
}

/**
 * Upload a buffer or stream to S3-compatible storage.
 *
 * @param body       - The file content (Buffer, Blob, ReadableStream, etc.)
 * @param fileName   - Original filename (used to derive content-type and key)
 * @param folder     - Logical folder prefix (e.g. "records", "images", "videos").
 *                     If omitted, auto-detected from MIME type via {@link getFolderByMimeType}.
 * @param contentType - MIME type override (auto-detected from extension if omitted)
 */
export async function uploadFile(
  body: PutObjectCommandInput["Body"],
  fileName: string,
  folder?: string,
  contentType?: string,
): Promise<UploadResult> {
  const bucket = getBucket();

  // Ensure the bucket exists before attempting upload (one-time lazy check)
  await ensureBucket(bucket);

  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  const mime = contentType || mimeFromExt(ext);

  // Auto-detect logical folder from MIME type if not explicitly provided
  const resolvedFolder = folder || getFolderByMimeType(mime);
  const key = `${resolvedFolder}/${randomUUID()}.${ext}`;

  // Determine size from the body BEFORE upload (CompleteMultipartUploadOutput
  // doesn't include a Size property in the TypeScript types).
  let sizeBytes = 0;
  if (body instanceof Buffer || body instanceof Uint8Array) {
    sizeBytes = body.byteLength;
  } else if (typeof body === "string") {
    sizeBytes = Buffer.byteLength(body);
  } else if (typeof Blob !== "undefined" && body instanceof Blob) {
    sizeBytes = body.size;
  } else if (typeof File !== "undefined" && body instanceof File) {
    sizeBytes = body.size;
  } else if (body && typeof (body as any).byteLength === "number") {
    // ArrayBuffer, SharedArrayBuffer, etc.
    sizeBytes = (body as any).byteLength;
  }

  console.log("[storage] Uploading to bucket:", bucket, "key:", key, "mime:", mime, "size:", sizeBytes);

  try {
    const upload = new Upload({
      client: client(),
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      },
    });

    const result = await upload.done();
    console.log("[storage] Upload completed:", { key, location: result.Location, etag: result.ETag });
  } catch (err: any) {
    console.error("[storage] Upload failed:", err.name, err.message);
    // Log additional S3-specific error details
    if (err.$metadata) {
      console.error("[storage] S3 metadata:", {
        httpStatusCode: err.$metadata.httpStatusCode,
        requestId: err.$metadata.requestId,
        extendedRequestId: err.$metadata.extendedRequestId,
      });
    }
    throw err;
  }

  // Build the public/presigned URL
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 * 24 * 7 }, // 7-day presigned URL by default
  );

  return {
    key,
    url,
    sizeBytes,
  };
}

/**
 * Generate a presigned download URL for a stored file.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Download a file from S3 as a Buffer (server-side only).
 * Used by BFF routes that need to proxy S3 content to other services.
 */
export async function getFileBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await client().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  const body = result.Body;
  if (!body) throw new Error("Empty S3 object body");
  // Convert stream/byte array to Buffer
  const byteArray = await body.transformToByteArray();
  return {
    buffer: Buffer.from(byteArray),
    contentType: result.ContentType || "application/octet-stream",
  };
}

/**
 * Generate a presigned upload URL (client can PUT directly to S3).
 * Useful for large files — avoids proxying through Next.js server.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 300,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

/**
 * Check if a file exists and get its metadata.
 */
export async function getFileMetadata(key: string): Promise<StoredFile | null> {
  try {
    const result = await client().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    return {
      key,
      bucket: getBucket(),
      sizeBytes: result.ContentLength || 0,
      contentType: result.ContentType || "application/octet-stream",
      etag: result.ETag,
    };
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Ensure a bucket exists (idempotent — used for setup scripts).
 * Note: This requires s3:CreateBucket permission (not needed at runtime
 * if the bucket is already created manually or via IaC).
 */
export async function ensureBucket(bucketName?: string): Promise<void> {
  const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
  const bucket = bucketName || getBucket();
  try {
    await client().send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[storage] Bucket "${bucket}" created.`);
  } catch (err: any) {
    // BucketAlreadyOwnedByYou is fine
    if (
      err.name === "BucketAlreadyOwnedByYou" ||
      err.name === "BucketAlreadyExists" ||
      err.$metadata?.httpStatusCode === 409
    ) {
      console.log(`[storage] Bucket "${bucket}" already exists.`);
      return;
    }
    throw err;
  }
}

/**
 * List all object keys under a prefix (paginated).
 * Used by the orphan image sweep job.
 */
export async function listObjects(
  prefix: string,
  maxKeys: number = 1000,
): Promise<string[]> {
  const bucket = getBucket();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: Math.min(maxKeys, 1000),
      ContinuationToken: continuationToken,
    });

    const result = await client().send(command);

    if (result.Contents) {
      for (const obj of result.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken && keys.length < maxKeys);

  return keys;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a MIME type to a logical storage folder prefix.
 *
 *   audio/*     → "audio"
 *   image/*     → "images"
 *   video/*     → "videos"
 *   application/pdf, doc*, xls*, csv, txt, md, json, xml, zip → "documents"
 *   everything else → "other"
 */
export function getFolderByMimeType(mimeType: string): string {
  if (!mimeType) return "other";

  const [type] = mimeType.split("/");

  switch (type) {
    case "audio":
      return "audio";
    case "image":
      return "images";
    case "video":
      return "videos";
    case "text":
      return "documents";
    case "application": {
      // Application subtypes that are document-like
      const documentSubtypes = [
        "pdf", "msword",
        "vnd.openxmlformats-officedocument.wordprocessingml.document",
        "vnd.ms-excel",
        "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv", "json", "xml", "zip",
        "vnd.oasis.opendocument.text",
        "vnd.oasis.opendocument.spreadsheet",
        "rtf",
      ];
      const subtype = mimeType.split("/")[1]?.toLowerCase();
      if (subtype && documentSubtypes.some((d) => subtype === d || subtype.startsWith(d))) {
        return "documents";
      }
      return "other";
    }
    default:
      return "other";
  }
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    webm: "audio/webm",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    zip: "application/zip",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
  };
  return map[ext] || "application/octet-stream";
}
