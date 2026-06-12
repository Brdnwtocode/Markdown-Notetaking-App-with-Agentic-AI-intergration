// scripts/storage-setup.ts
//
// One-time setup script to create the S3 bucket and verify connectivity.
// Run with: npx tsx scripts/storage-setup.ts
//
// For local dev: make sure MinIO is running first:
//   docker-compose up -d minio

import "dotenv/config";
import { ensureBucket } from "../lib/storage";

async function main() {
  console.log("[storage-setup] Checking S3 storage connectivity...\n");

  const endpoint = process.env.STORAGE_ENDPOINT || "http://localhost:9000";
  const bucket = process.env.STORAGE_BUCKET || "lockin-records";

  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Bucket:   ${bucket}`);
  console.log(`  Region:   ${process.env.STORAGE_REGION || "us-east-1"}`);
  console.log(`  PathStyle: ${process.env.STORAGE_FORCE_PATH_STYLE !== "false"}`);
  console.log();

  try {
    await ensureBucket(bucket);
    console.log(`✅ Storage is ready. Bucket "${bucket}" exists.\n`);
  } catch (err: any) {
    console.error(`❌ Storage setup failed: ${err.message}`);
    console.error(
      "\n  Make sure MinIO is running: docker-compose up -d minio\n" +
        "  Or check your AWS S3 credentials.\n",
    );
    process.exit(1);
  }
}

main();
