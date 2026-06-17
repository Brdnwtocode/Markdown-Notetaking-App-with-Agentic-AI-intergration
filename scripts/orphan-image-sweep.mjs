// scripts/orphan-image-sweep.mjs
//
// Nightly cron job: deletes S3 images under notes/ that are no longer
// referenced by any note's current content.
//
// Usage:  node scripts/orphan-image-sweep.mjs
//
// Schedule via cron (Linux) or Task Scheduler (Windows).
// Fully decoupled from request-handling code — never blocks save/load/edit.
// One note's failure (e.g. S3 list error) logs and continues.

import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const NOTE_BATCH_SIZE = 50; // process notes in batches to avoid memory pressure

// ─── S3 Client (replicates storage.ts config) ────────────────────────────────

function getS3Client() {
  const rawEndpoint = process.env.STORAGE_ENDPOINT || "";
  const region = process.env.STORAGE_REGION || "us-east-1";
  const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE !== "false";

  const creds = {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
  };

  if (rawEndpoint && !rawEndpoint.includes("amazonaws.com")) {
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

function getBucket() {
  return process.env.STORAGE_BUCKET || "lockin-records";
}

// ─── Regex ───────────────────────────────────────────────────────────────────

/**
 * Extracts all `/api/images/{noteId}/{key}` references from note content.
 * Returns the S3 key portion: `notes/{noteId}/{key}` (the key is just the filename).
 */
function extractImageRefs(content, noteId) {
  const regex = /\/api\/images\/([^/]+)\/([^)\s"']+)/g;
  const refs = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    // match[1] is the noteId in the URL, match[2] is the key (filename)
    // Only collect refs belonging to THIS note
    if (match[1] === noteId) {
      refs.add(`notes/${noteId}/${match[2]}`);
    }
  }
  return refs;
}

// ─── S3 Helpers ──────────────────────────────────────────────────────────────

async function listS3Objects(s3Client, bucket, prefix) {
  const keys = [];
  let continuationToken;

  do {
    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    if (result.Contents) {
      for (const obj of result.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function deleteS3Object(s3Client, bucket, key) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete: ${key}`);
    return;
  }
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
  console.log(`  Deleted: ${key}`);
}

// ─── Main Sweep ──────────────────────────────────────────────────────────────

async function sweepNote(s3Client, bucket, prisma, note) {
  const prefix = `notes/${note.id}/`;

  try {
    // List all S3 objects for this note
    const s3Keys = await listS3Objects(s3Client, bucket, prefix);

    if (s3Keys.length === 0) {
      return { noteId: note.id, totalS3: 0, orphans: 0, deleted: 0, errors: 0 };
    }

    // Extract referenced images from note content
    const refs = extractImageRefs(note.content || "", note.id);

    // Find orphans: S3 keys not in the extracted references
    const orphans = s3Keys.filter((key) => !refs.has(key));

    // Delete orphans
    let deleted = 0;
    let errors = 0;
    for (const orphanKey of orphans) {
      try {
        await deleteS3Object(s3Client, bucket, orphanKey);
        deleted++;
      } catch (err) {
        console.error(`  Failed to delete ${orphanKey}:`, err.message);
        errors++;
      }
    }

    return {
      noteId: note.id,
      totalS3: s3Keys.length,
      orphans: orphans.length,
      deleted,
      errors,
    };
  } catch (err) {
    console.error(`  Sweep failed for note ${note.id}:`, err.message);
    return { noteId: note.id, totalS3: 0, orphans: 0, deleted: 0, errors: 1 };
  }
}

async function main() {
  console.log(`\n=== Orphan Image Sweep ===`);
  console.log(`Started: ${new Date().toISOString()}`);
  if (DRY_RUN) console.log(`MODE: DRY RUN (no deletions)`);
  console.log("");

  const prisma = new PrismaClient();
  const s3Client = getS3Client();
  const bucket = getBucket();

  console.log(`Bucket: ${bucket}`);

  try {
    // Get total note count
    const totalNotes = await prisma.note.count();
    console.log(`Total notes in database: ${totalNotes}\n`);

    let cursor;
    let processedBatches = 0;
    let grandTotal = { totalS3: 0, orphans: 0, deleted: 0, errors: 0 };

    do {
      // Fetch a batch of notes
      const notes = await prisma.note.findMany({
        select: { id: true, content: true, title: true },
        take: NOTE_BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (notes.length === 0) break;

      for (const note of notes) {
        const result = await sweepNote(s3Client, bucket, prisma, note);
        grandTotal.totalS3 += result.totalS3;
        grandTotal.orphans += result.orphans;
        grandTotal.deleted += result.deleted;
        grandTotal.errors += result.errors;
      }

      cursor = notes[notes.length - 1].id;
      processedBatches++;
      console.log(`  Batch ${processedBatches}: processed ${notes.length} notes`);
    } while (cursor);

    console.log(`\n=== Sweep Complete ===`);
    console.log(`Total S3 objects scanned: ${grandTotal.totalS3}`);
    console.log(`Orphans found: ${grandTotal.orphans}`);
    console.log(`Deleted: ${grandTotal.deleted}`);
    console.log(`Errors: ${grandTotal.errors}`);
    console.log(`Finished: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("Fatal sweep error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
