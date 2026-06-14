-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('RECORDING', 'TRANSCRIBING', 'RESOLVING', 'COMMITTED');

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Recording',
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transcript" TEXT NOT NULL DEFAULT '',
    "status" "RecordStatus" NOT NULL DEFAULT 'RECORDING',
    "audioKey" TEXT,
    "audio_size_bytes" INTEGER,
    "error_log" TEXT,
    "note_mutation" JSONB,
    "task_mutations" JSONB,
    "stack_mutation" JSONB,
    "calendar_mutation" JSONB,
    "speaker_labels" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "recording_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recordings_userId_created_at_idx" ON "recordings"("userId", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recordings_userId_status_idx" ON "recordings"("userId", "status");

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
