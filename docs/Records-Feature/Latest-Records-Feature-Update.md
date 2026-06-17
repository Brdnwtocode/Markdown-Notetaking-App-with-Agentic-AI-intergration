# BFF Contract: Records Automate Proxy v3

> Contract for: `app/api/records/automate/route.ts`
> Between: **Next.js BFF** and **FastAPI `/api/v1/records/automate`**
> Version: 3.0 (2026-06-17)
>
> **Changes from v2**: Added merge semantics (null = keep old), removed `force_transcribe`, standardized error key to `detail`, documented 4-case decision matrix with speaker label preservation

---

## 1. API Contract (FastAPI Interface)

See `fastapi-contract-v3.md` for the FastAPI-side specification. This section documents what the BFF must send and expect.

### 1.1 Request (BFF → FastAPI)

**Method**: `POST {{FASTAPI_URL}}/api/v1/records/automate`
**Content-Type**: `multipart/form-data`
**Headers**: `x-user-id`, `x-session-id`

| Field | Source | When to send |
|---|---|---|
| `user_id` | `session.user.id` | Always |
| `audio` | Client blob or S3 fetch | When transcription needed (Cases 1, 3, 4) |
| `transcript` | Client FormData or DB row | When transcript exists and re-transcription NOT desired (Case 2) |
| `recording_id` | Client FormData or `""` | Always |
| `mode` | `"automate"` | Always |
| `action` | Client FormData or `"full_automate"` | Always |

**Rule**: Send EITHER `audio` OR `transcript` — never both. The BFF guarantees this.

### 1.2 Response (FastAPI → BFF)

All 7 fields mandatory. The BFF normalizes snake_case → camelCase via `deepNormalize`.

```json
{
  "transcript": "...",
  "note_mutation": null,
  "task_mutations": [],
  "stack_mutation": null,
  "calendar_mutation": null,
  "speaker_labels": null,
  "summary": ""
}
```

Error key: `detail` (string). FastAPI may also return `detail` as an array for Pydantic validation errors — BFF must handle both.

### 1.3 Audio Resolution

When the client does NOT send an audio blob (saved recording, audio in S3):

1. Look up `recording.audioKey` in DB
2. Verify ownership (`recording.userId === session.user.id`)
3. Fetch from S3 via `getFileBuffer(audioKey)`
4. Set status to `RESOLVING` before the FastAPI call

---

## 2. BFF Decision Matrix (Transcript Lifecycle)

The BFF is the sole decision-maker. FastAPI has no knowledge of recording state.

### How the BFF Infers Intent

The frontend `AgenticAutomatePanel` controls the `audioOnly` toggle:
- `audioOnly=true` → `transcript` key is **absent** from client FormData
- `audioOnly=false` → `transcript` key is **present** (may be empty `""`)

The BFF reads:
```typescript
const transcriptFromClient = formData.get("transcript"); // null | "" | "text..."
const hasTranscript = transcriptFromClient !== null && transcriptFromClient.trim().length > 0;
```

### Decision Matrix

| Case | `hasTranscript` | Recording State | BFF Sends to FastAPI | Expect `transcript` Back? |
|---|---|---|---|---|
| 1 | `false` | Unsaved (`recordingId` starts with `temp_` or `""`) | `audio` only | YES |
| 2 | `true` | Unsaved or Saved | `transcript` only | NO (echoed, BFF ignores) |
| 3 | `false` (audioOnly ON, even though DB has transcript) | Saved (has DB `recordingId`) | `audio` only | YES |
| 4 | `false` (no transcript in DB) | Saved (has DB `recordingId`) | `audio` only | YES |

### Case Details

| Case | Scenario | What Happens |
|---|---|---|
| **1** | User records audio, STT was OFF (no transcript). Toggles Audio Only → runs Automate. | Audio sent → FastAPI transcribes → transcript returned → BFF caches in response to frontend (no DB row yet) |
| **2** | User has transcript (from STT or previous run). Audio Only OFF → runs Automate. | Transcript sent → FastAPI skips STT → mutations returned → transcript echoed back (ignored) |
| **3** | Saved recording with transcript. User explicitly toggles Audio Only ON → runs Automate. | Audio sent → FastAPI re-transcribes → new transcript returned → BFF **overwrites** DB `transcript` column |
| **4** | Saved recording, no transcript (imported audio file). Runs Automate. | Audio sent → FastAPI transcribes → transcript returned → BFF **writes** DB `transcript` column |

---

## 3. Merge Semantics — BFF Response Handler

When storing FastAPI's response on the DB Recording row, the BFF must follow these rules:

### Rule: `null` means "don't overwrite"

| FastAPI Field | Non-null Value | `null` |
|---|---|---|
| `transcript` | Overwrite DB `transcript` | Leave existing unchanged |
| `note_mutation` | Overwrite DB `noteMutation` | Leave existing unchanged |
| `task_mutations` | Overwrite DB `taskMutations` | Overwrite with `[]` (previous tasks may be stale) |
| `stack_mutation` | Overwrite DB `stackMutation` | Leave existing unchanged |
| `calendar_mutation` | Overwrite DB `calendarMutation` | Leave existing unchanged |
| `speaker_labels` | Overwrite DB `speakerLabels` | Leave existing unchanged |
| `summary` | Store for frontend (no DB column) | N/A |

**Exception**: `task_mutations` is always overwritten — an empty array `[]` is a valid signal (no tasks found in this transcript), and stale tasks from a previous run should not persist.

**Rationale**: A transcript-only run (Case 2) should not wipe speaker labels, note mutations, or calendar events generated by a previous audio-based run. Each mutation field evolves independently.

### Response Handler Pseudocode

```typescript
async function handleAutomateResponse(
  fastApiResult: AutomateResponse,
  recordingId: string,
  isTempId: boolean
) {
  // Build DB update payload — only include fields that should change
  const updateData: Record<string, any> = {
    status: "COMMITTED",
  };

  // Transcript: only update if non-empty
  if (fastApiResult.transcript) {
    updateData.transcript = fastApiResult.transcript;
  }

  // Mutations: only overwrite if non-null
  if (fastApiResult.note_mutation !== null) {
    updateData.noteMutation = fastApiResult.note_mutation;
  }
  if (fastApiResult.stack_mutation !== null) {
    updateData.stackMutation = fastApiResult.stack_mutation;
  }
  if (fastApiResult.calendar_mutation !== null) {
    updateData.calendarMutation = fastApiResult.calendar_mutation;
  }
  if (fastApiResult.speaker_labels !== null) {
    updateData.speakerLabels = fastApiResult.speaker_labels;
  }

  // Task mutations: always overwrite
  updateData.taskMutations = fastApiResult.task_mutations ?? [];

  // Persist for saved recordings
  if (recordingId && !isTempId) {
    await prisma.recording.update({
      where: { id: recordingId },
      data: updateData,
    });
  }

  // Normalize and return to frontend
  return deepNormalize(fastApiResult);
}
```

---

## 4. PATCH Endpoint Interaction

`PATCH /api/records/[id]` returns the **full recording row** including all mutation fields. The frontend uses `upsertRecording()` to replace the Zustand entry.

Because the BFF merge semantics preserve existing values (null → don't overwrite), the PATCH response will always include the most recent non-null value for each field. This means:

- Renaming a recording does NOT wipe speaker labels ✅
- Renaming does NOT wipe note mutations ✅
- Renaming does NOT wipe transcript ✅
- All metadata survives CRUD operations on the recording ✅

---

## 5. Error Handling

| FastAPI Response | BFF Action |
|---|---|
| 200 OK | Process response with merge semantics |
| 422 (detail: string) | Return 422 to frontend with `{ error: detail }` |
| 422 (detail: array) | Return 422 to frontend with `{ error: "Validation failed", details: detail }` |
| 500 (detail: string) | Revert recording status to `COMMITTED`, return 500 to frontend |
| Network error / timeout | Revert status, return 500 |

```typescript
if (!fastApiResponse.ok) {
  const errorBody = await fastApiResponse.json().catch(() => ({}));
  const detail = errorBody.detail;

  // Revert status for real recordings
  if (recordingId && !isTempId) {
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: "COMMITTED" },
    }).catch(() => {});
  }

  return NextResponse.json(
    {
      error: typeof detail === "string" ? detail : "Validation failed",
      details: Array.isArray(detail) ? detail : undefined,
    },
    { status: fastApiResponse.status }
  );
}
```

---

## 6. Frontend Contract (BFF → Frontend)

### 6.1 Response Shape

After `deepNormalize`, the BFF returns camelCase JSON:

```json
{
  "transcript": "...",
  "noteMutation": null,
  "taskMutations": [],
  "stackMutation": null,
  "calendarMutation": null,
  "speakerLabels": null,
  "summary": ""
}
```

### 6.2 Frontend Responsibilities

1. **`AgenticAutomatePanel`**: On success, if `result.transcript` is non-empty → update Zustand `liveTranscript` and call `updateRecordingTranscript()` for saved recordings
2. **`AgenticAutomatePanel`**: Stage mutations via `stageMutation({ type: "automate_results", ... })` for user approval
3. **`RecordsWorkstation`**: Sync transcript from automate result into the displayed transcript area
4. **`CaptureQueue`**: Rename PATCH → `upsertRecording` naturally preserves all fields (thanks to merge semantics on the BFF side)

---

## 7. Compliance Checklist

| # | Requirement | Owner |
|---|---|---|
| R1 | Sends `user_id` on every request | BFF |
| R2 | Sends either `audio` OR `transcript` — mutual exclusivity guaranteed | BFF |
| R3 | Does NOT send `audio` when valid transcript exists and audioOnly is OFF | BFF |
| R4 | Persists returned `transcript` to DB for saved recordings (Cases 3, 4) | BFF |
| R5 | Merge semantics: `null` from FastAPI → leave existing DB value unchanged | BFF |
| R6 | `task_mutations` always overwritten (even `[]`) | BFF |
| R7 | Reverts recording status to `COMMITTED` on FastAPI failure | BFF |
| R8 | Handles `detail` as string AND array from FastAPI errors | BFF |
| R9 | Resolves audio from S3 server-side when client sends no blob | BFF |
| R10 | Normalizes snake_case → camelCase via `deepNormalize` | BFF |
| R11 | Returns `transcript` field in response to frontend | BFF |
| R12 | Frontend updates `liveTranscript` on non-empty transcript in response | Frontend |
