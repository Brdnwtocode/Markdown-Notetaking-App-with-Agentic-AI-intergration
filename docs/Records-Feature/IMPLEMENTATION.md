# Records Feature — Complete Implementation Reference

> **Feature**: Lock In Records & Agentic Automate  
> **Branch**: Main workspace at `/workspace/records`  
> **Date**: 2026-06-13  
> **Status**: Implemented (pending FastAPI `/api/v1/records/automate`)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    WORKSPACE LAYOUT (persistent)                  │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐ │
│  │ BackgroundRecorder  │  │ Sidebar  │ TabBar │ ChatSidebar   │ │
│  │ (mic + STT, never   │  │                               │ │
│  │  unmounts)          │  │                               │ │
│  └─────────────────────┘  └────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ {children} — RecordsWorkstation (mounts/unmounts freely)     │ │
│  │  ┌──────────────────────┬──────────────────────────────────┐ │ │
│  │  │ MAIN PANEL           │ RIGHT SIDEBAR (320px)            │ │ │
│  │  │ • Sentinel Status    │ • AgenticAutomatePanel           │ │ │
│  │  │ • WaveformVisualizer │   - RUN AUTOMATE trigger         │ │ │
│  │  │ • Audio Toolbar      │   - 5 action items               │ │ │
│  │  │ • Transcript Stream  │ • CaptureQueue                   │ │ │
│  │  │                      │   - Saved recordings table       │ │ │
│  │  │                      │   - Local (UNSAVED) recordings   │ │ │
│  │  │                      │   - Drop zone for audio imports  │ │ │
│  │  └──────────────────────┴──────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────┐  Zustand   ┌──────────────────┐  Deepgram WS  ┌──────────┐
│ Records  │◀─────────▶│ BackgroundRecorder│◀────────────▶│ Deepgram │
│Workstation│ setIsRec  │ (never unmounts) │  linear16 PCM │  nova-3  │
│  (UI)    │ liveTrans  │                  │               │          │
└────┬─────┘           └────────┬─────────┘               └──────────┘
     │                          │
     │ Save (explicit)          │ audioBlob (on stop)
     ▼                          ▼
┌──────────┐    ┌──────────┐   ┌───────────┐
│ POST     │    │ POST     │   │ blobMap   │
│ /records │    │ /upload  │   │ (in-mem)  │
└────┬─────┘    └────┬─────┘   └───────────┘
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│  Neon PG │    │  AWS S3  │
│ (meta)   │    │ (audio)  │
└──────────┘    └──────────┘
```

---

## 2. File Inventory

### 2.1 Data Layer

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `Recording` model (lines ~210-260), `Attachment` model, `RecordStatus` enum, `User.recordings` relation |
| `lib/slices/recordsSlice.ts` | Zustand slice — all recording state, CRUD actions, Agentic Automate types, `LocalRecording` type |
| `lib/store.ts` | Wires `RecordsSlice` into `RootStore`; exports `Recording`, `RecordStatus`, `LocalRecording` |
| `store/useStore.ts` | Re-exports Records types for convenience imports |

### 2.2 Storage Layer

| File | Purpose |
|------|---------|
| `lib/storage.ts` | S3 abstraction — `uploadFile()`, `getDownloadUrl()`, `getUploadUrl()`, `deleteFile()`, `getFileMetadata()`, `ensureBucket()` |
| `scripts/storage-setup.ts` | One-time bucket creation & connectivity check |
| `docker-compose.yml` | MinIO service (local S3 dev) + `minio_data` volume |
| `.env` / `.env.local.example` | `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_FORCE_PATH_STYLE` |

### 2.3 API Routes (Next.js BFF)

| Route | Methods | Purpose |
|-------|---------|---------|
| `app/api/records/route.ts` | `GET`, `POST` | List user's recordings; create new recording (with user-existence guard) |
| `app/api/records/[id]/route.ts` | `GET`, `PATCH`, `DELETE` | Single recording CRUD; DELETE also removes S3 audio |
| `app/api/records/upload/route.ts` | `POST` | Multipart audio upload → S3, links to recording |
| `app/api/records/automate/route.ts` | `POST` | Agentic Automate proxy → FastAPI `POST /api/v1/records/automate` |

### 2.4 Hooks

| File | Purpose |
|------|---------|
| `lib/hooks/useContinuousSTT.ts` | Long-form Deepgram STT via WebSocket (`linear16` PCM). Supports start/stop/pause/resume. Accumulates `speech_final` segments. Fallback: batch upload via `/api/voice/process`. |
| `lib/hooks/useDeepgramSTT.ts` | *(Existing)* Push-to-talk STT — used by `PushToTalk`, NOT by Records. |

### 2.5 UI Components

| File | Renders | Key Props |
|------|---------|-----------|
| `components/workspace/BackgroundRecorder.tsx` | **Nothing visible** — owns mic + STT. Mounted once in workspace layout. | *(none — reads Zustand)* |
| `components/workspace/RecordsWorkstation.tsx` | Full audio workstation UI | *(none — reads/writes Zustand)* |
| `components/workspace/WaveformVisualizer.tsx` | Canvas-based real-time waveform (60fps via `requestAnimationFrame`) | `isActive`, `volume`, `height`, `color`, `barCount`, `playbackProgress` |
| `components/workspace/AgenticAutomatePanel.tsx` | Right sidebar: RUN AUTOMATE button + 5 action items | `recordingId`, `transcript`, `hasRecording` |
| `components/workspace/CaptureQueue.tsx` | Recording sessions table + drop zone for audio file imports | `onSelect`, `onSelectLocal`, `activeId` |

### 2.6 Navigation & Routing

| File | Change |
|------|--------|
| `app/(workspace)/workspace/layout.tsx` | Added `<BackgroundRecorder />` |
| `app/(workspace)/workspace/records/page.tsx` | Route page — renders `<RecordsWorkstation />` |
| `components/workspace/TabBar.tsx` | Added `RECORDS` case → `/workspace/records` |
| `components/workspace/Sidebar.tsx` | Added `Mic` icon button → navigates to Records |
| `lib/slices/uiSlice.ts` | Added `"RECORDS"` to `TabType` union |
| `lib/constants.ts` | *(unchanged)* — singleton tab IDs for TASKS/CALENDAR only |

### 2.7 Documentation

| File | Purpose |
|------|---------|
| `docs/Records-Feature/UI-Initial-Design` | Original technical specification |
| `docs/Records-Feature/FastAPI-Agentic-Automate-Contract.md` | FastAPI contract (see §7) |
| `docs/Records-Feature/IMPLEMENTATION.md` | **This file** |

---

## 3. Recording Lifecycle (Local-First)

```
STATE: idle
  │
  │ User clicks [Record]
  ▼
STATE: recording (local only — no API call)
  │  • Zustand: setIsRecording(true)
  │  • BackgroundRecorder: getUserMedia() → mic stream
  │  • BackgroundRecorder: Deepgram WebSocket opened (linear16 PCM)
  │  • BackgroundRecorder: MediaRecorder started (fallback blobs)
  │  • RecordsWorkstation: WaveformVisualizer animating
  │  • RecordsWorkstation: Live transcript streaming
  │  • Duration timer running
  │
  │ User clicks [Pause] / [Resume]
  │  • pausedRef = true/false → blocks PCM sending
  │  • Status: "SENTINEL PAUSED" / "SENTINEL ACTIVE"
  │
  │ User clicks [Stop]
  ▼
STATE: stopped (unsaved — local only)
  │  • Zustand: setIsRecording(false)
  │  • BackgroundRecorder: ws.send(CloseStream) → final results
  │  • BackgroundRecorder: audioBlob stored in blobMap
  │  • RecordsWorkstation: hasUnsavedRecording = true
  │  • RecordsWorkstation: [Save] button appears (amber)
  │  • Sentinel: "UNSAVED RECORDING ⚠ Local only"
  │
  │ User clicks [Save]
  ▼
STATE: saved (persisted)
  │  • POST /api/records → DB record created
  │  • POST /api/records/upload → audio → S3
  │  • PATCH /api/records/:id → audioKey, status=COMMITTED
  │  • GET /api/records → refresh list
  │  • Zustand: resetRecordingState()
  │  • Toast: "Untitled Recording saved"
  │
  │ User switches tabs (Notes, Tasks, Calendar...)
  │  • RecordsWorkstation unmounts ✅
  │  • BackgroundRecorder stays mounted ✅
  │  • Recording continues uninterrupted ✅
  │
  │ User returns to /workspace/records
  │  • RecordsWorkstation remounts
  │  • Reads liveTranscript, recordingDurationSec from Zustand
  │  • UI reflects current recording state
```

### Key Design Decisions

1. **BackgroundRecorder in layout** — The `useContinuousSTT` hook owns the mic stream and WebSocket. This must live in the workspace layout (never unmounts), not in the page component (unmounts on tab switch).

2. **Zustand as control plane** — `RecordsWorkstation` only reads/writes Zustand. `BackgroundRecorder` reacts to `isRecording` changes. No direct communication between them.

3. **Local-first save** — Recording, stopping, and transcript accumulation happen entirely client-side. The user must explicitly click **Save** to persist to DB + S3.

4. **Suggestion-only mutations** — Agentic Automate results are staged as `PendingMutation` via `stageMutation()`. The existing `UniversalConfirmationToast` handles user approval.

---

## 4. Zustand State Shape (`RecordsSlice`)

```typescript
{
  // Recording lifecycle
  isRecording: boolean;           // true = mic + STT active
  isPaused: boolean;              // true = mic on but PCM sending paused
  recordingId: string | null;     // DB ID after save, null while local
  recordingTitle: string;         // default "Untitled Recording"
  recordingDurationSec: number;   // incremented every 1s while recording
  liveTranscript: string;         // accumulated transcript text

  // Playback
  isPlaying: boolean;
  playbackSpeed: number;          // 1 | 1.5 | 2
  playbackVolume: number;         // 0.0 – 1.0
  currentPlaybackTime: number;    // seconds

  // Persisted recordings (from DB)
  recordings: Recording[];
  recordingsLoading: boolean;
  activeRecordingId: string | null;

  // Local (unsaved) recordings
  localRecordings: LocalRecording[];

  // Agentic Automate
  automateLoading: boolean;
  automateResult: AutomateResponse | null;
}
```

### `Recording` (persisted, from DB)
```typescript
{
  id, userId, title, durationSec, transcript,
  status: "RECORDING" | "TRANSCRIBING" | "RESOLVING" | "COMMITTED",
  audioKey: string | null,        // S3 key
  audioSizeBytes: number | null,
  noteMutation: object | null,    // Agentic Automate result
  taskMutations: object[] | null,
  stackMutation: object | null,
  calendarMutation: object | null,
  speakerLabels: object | null,
  createdAt, updatedAt, committedAt,
  attachments: Attachment[]
}
```

### `LocalRecording` (unsaved, client-only)
```typescript
{
  id: string,                     // "local_<timestamp>_<random>"
  title: string,
  durationSec: number,
  transcript: string,
  createdAt: string,
  source: "recorded" | "imported",
  fileName?: string,              // for imported files
  fileSizeBytes?: number,
  mimeType?: string
}
```

---

## 5. API Reference

### 5.1 `GET /api/records`
Returns all recordings for the authenticated user, ordered by `createdAt` desc. Includes `attachments` relation.

**Response**: `Recording[]`

### 5.2 `POST /api/records`
Creates a new recording entry. Includes user-existence guard (returns 401 if user was deleted after DB reset).

**Body**: `{ title?, transcript?, durationSec?, audioKey?, audioSizeBytes? }`  
**Response**: `Recording` (201)

### 5.3 `GET /api/records/[id]`
Returns a single recording with attachments. 404 if not found, 403 if not owner.

### 5.4 `PATCH /api/records/[id]`
Updates recording fields. If `status` is set to `"COMMITTED"`, also sets `committedAt` to now.

**Body**: Any subset of Recording fields  
**Response**: `Recording`

### 5.5 `DELETE /api/records/[id]`
Deletes recording from DB. Also deletes the S3 audio file if `audioKey` is set.

### 5.6 `POST /api/records/upload`
Multipart upload. Accepts `audio` (File, max 500MB) and optional `recordingId`. Uploads to S3 under `records/` prefix. If `recordingId` provided, links the S3 key to the recording.

**Body**: `FormData { audio: File, recordingId?: string }`  
**Response**: `{ key, url, sizeBytes, recordingId }` (201)

### 5.7 `POST /api/records/automate`
Agentic Automate proxy. Sends transcript + context to FastAPI.

**Body**: `{ transcript: string, recordingId: string, workspaceContext?: object, action?: string }`  

Forwards to FastAPI as:
```json
{
  "transcript": "...",
  "recording_id": "...",
  "user_id": "...",
  "workspace_context": {},
  "mode": "automate",
  "action": "full_automate"
}
```

**Response** (normalized to camelCase):
```json
{
  "noteMutation": { ... } | null,
  "taskMutations": [ ... ],
  "stackMutation": { ... } | null,
  "calendarMutation": { ... } | null,
  "speakerLabels": [ ... ] | null,
  "summary": "..." | null
}
```

---

## 6. Audio File Import (Drop Zone)

The CaptureQueue includes a drag-and-drop zone at the bottom.

### Validation Rules
| Rule | Value |
|------|-------|
| Accepted extensions | `.wav`, `.mp3`, `.webm`, `.ogg`, `.m4a`, `.flac`, `.aac`, `.wma`, `.mp4` |
| Accepted MIME types | `audio/wav`, `audio/x-wav`, `audio/wave`, `audio/mpeg`, `audio/mp3`, `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/x-m4a`, `audio/flac`, `audio/aac`, `audio/x-ms-wma` |
| Max file size | 500 MB |
| Empty file rejection | Yes (size === 0) |

### Import Flow
1. User drops file(s) or clicks drop zone → file picker
2. Each file validated client-side
3. Invalid files → `toast.error()` with reason
4. Valid files → `LocalRecording` created, blob stored in `blobMap`
5. Appears in CaptureQueue as `UNSAVED` row (amber badge)
6. User can **Save** (persist to DB+S3) or **Discard** (remove from memory)

---

## 7. Prisma Schema Excerpt

```prisma
enum RecordStatus {
  RECORDING
  TRANSCRIBING
  RESOLVING
  COMMITTED
}

model Recording {
  id              String       @id @default(uuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title           String       @default("Untitled Recording")
  durationSec     Float        @default(0)
  transcript      String       @default("") @db.Text
  status          RecordStatus @default(RECORDING)
  audioKey        String?
  audioSizeBytes  Int?         @map("audio_size_bytes")
  errorLog        String?      @map("error_log") @db.Text

  noteMutation     Json?  @map("note_mutation")     @db.JsonB
  taskMutations    Json?  @map("task_mutations")    @db.JsonB
  stackMutation    Json?  @map("stack_mutation")    @db.JsonB
  calendarMutation Json?  @map("calendar_mutation") @db.JsonB
  speakerLabels    Json?  @map("speaker_labels")    @db.JsonB

  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt      @map("updated_at")
  committedAt  DateTime? @map("committed_at")

  attachments  Attachment[]

  @@map("recordings")
  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, status])
}

model Attachment {
  id          String    @id @default(uuid())
  recordingId String    @map("recording_id")
  recording   Recording @relation(fields: [recordingId], references: [id], onDelete: Cascade)
  userId      String    @map("user_id")
  fileName    String    @map("file_name")
  mimeType    String    @map("mime_type")
  storageKey  String    @map("storage_key")
  sizeBytes   Int       @map("size_bytes")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("attachments")
  @@index([recordingId])
  @@index([userId])
}
```

---

## 8. Environment Variables

```bash
# S3 Storage (AWS S3 eu-north-1 in production, MinIO in dev)
STORAGE_ENDPOINT="https://s3.eu-north-1.amazonaws.com"   # or http://localhost:9000
STORAGE_REGION="eu-north-1"                               # or us-east-1
STORAGE_BUCKET="markdown-note-app"                        # or lockin-records
STORAGE_ACCESS_KEY="AKIA..."                              # or minioadmin
STORAGE_SECRET_KEY="..."                                  # or minioadmin
STORAGE_FORCE_PATH_STYLE="false"                          # true for MinIO

# Deepgram (already configured)
DEEPGRAM_API_KEY="..."

# FastAPI (already configured)
FASTAPI_URL="http://localhost:8000"
```

---

## 9. Testing Checklist

- [ ] Start MinIO: `docker-compose up -d minio`
- [ ] Create bucket `lockin-records` at `http://localhost:9001`
- [ ] Run `npx tsx scripts/storage-setup.ts` — should show "✅ Storage is ready"
- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `/workspace/records`
- [ ] Click **Record** → Sentinel shows "SENTINEL ACTIVE", timer counts
- [ ] Switch to Notes tab → timer still counts, recording continues
- [ ] Switch back to Records → UI reflects current state
- [ ] Click **Stop** → "UNSAVED RECORDING ⚠ Local only", Save button appears
- [ ] Click **Save** → toast "Untitled Recording saved", appears in Capture Queue as COMMITTED
- [ ] Drop an audio file on the drop zone → appears as UNSAVED, can Save/Discard
- [ ] Click **RUN AUTOMATE** (with transcript) → calls FastAPI (needs FastAPI running)
- [ ] Delete a recording → removed from table + S3

---

## 10. Known Limitations & Future Work

1. **FastAPI `/api/v1/records/automate`** — The endpoint is defined in the contract but must be implemented on the FastAPI side. The Next.js BFF proxy is ready.

2. **Trim utility** — The scissors icon button is present but not yet wired to audio trimming logic.

3. **Speaker diarization** — The "Identify Speakers" action sends a hint to FastAPI but the diarization model (e.g., pyannote.audio) must be implemented on the Python side.

4. **Waveform from real audio** — The `WaveformVisualizer` currently uses simulated frequency data. To show real waveform from the mic, pass an `AnalyserNode` via the `useWaveformAnalyser` hook (already exported).

5. **Mobile support** — `getUserMedia` with `sampleRate: 16000` may not work on all mobile browsers. Fallback to default sample rate may be needed.

6. **Offline recording** — If Deepgram WebSocket fails, the fallback uses `/api/voice/process` (batch). But without network, neither works. A future enhancement could store audio locally and upload when connectivity returns.
