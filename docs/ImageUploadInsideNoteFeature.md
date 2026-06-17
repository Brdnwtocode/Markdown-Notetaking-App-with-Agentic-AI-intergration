# Feature Spec: Direct-to-S3 Image Paste/Upload for Markdown Editor

## Context
Markdown notes currently inline pasted images as base64, bloating the Postgres content cell (1GB ceiling) and making content meaningless to AI models. This spec replaces base64 inlining with direct-to-S3 upload, keeping markdown content as plain `![alt](url)` syntax.

## Locked-In Architecture Decisions
These are settled, not open questions — implement as stated:
- Markdown stores `/api/images/{noteId}/{key}` (relative redirect path). Never raw S3 keys, never base64, never a custom URL scheme.
- Reuses the **existing 7-day presigned GET policy** already in use for recordings. No new expiry policy.
- Save/autosave is **never** blocked by upload completion.
- Orphan image cleanup is a **nightly sweep job**, fully decoupled from the save path (not eager/on-delete cleanup).

---

## P0 — Backend Routes
(Ship first — everything else depends on these. Both routes call existing `storage.ts` functions; no new S3 SDK code.)

### User Story 1: Presigned Upload URL Endpoint
As the editor, I need a backend endpoint to request a presigned PUT URL before uploading a pasted/dropped image.

**Acceptance Criteria:**
- [ ] `POST /notes/:noteId/upload-url` accepts `{ contentType: string }`
- [ ] Requires the same auth/note-access middleware as other `/notes/:noteId/*` write routes — verify requester has write access to `noteId` before issuing a URL
- [ ] Generates S3 key as `notes/{noteId}/{uuid}.{ext}`, `ext` derived from `contentType` (png/jpg/jpeg/gif/webp only; reject other content types with 400)
- [ ] Calls existing `getUploadUrl` in `storage.ts`
- [ ] Returns `{ uploadUrl: string, key: string }`
- [ ] No new env/config — reuses existing bucket/credentials setup

### User Story 2: Image Redirect Endpoint
As the renderer and AI context builder, I need a stable URL that resolves to a working signed URL, so markdown never stores an expiring URL directly.

**Acceptance Criteria:**
- [ ] `GET /api/images/:noteId/:key`
- [ ] Requires the same auth/note-access middleware as other note-read routes — verify requester has read access to `noteId` before redirecting
- [ ] Calls existing `getDownloadUrl` (alias `getSignedUrl`) with full key `notes/{noteId}/{key}` — reuses existing 7-day default, no new expiry policy
- [ ] Responds `302 Found`, `Location` header set to the signed URL
- [ ] Responds `404` if the key doesn't exist in S3 (never redirect to a broken URL)

---

## P0 — Frontend: Paste/Drop Plugin in LiveEditor.tsx

### User Story 3: Intercept Image Paste/Drop
As a user, pasting or dropping an image should upload it to S3 instead of inlining it as base64.

**Acceptance Criteria:**
- [ ] New Milkdown `$prose` plugin (new file, e.g. `imageUploadPlugin.ts`), added to `LiveEditor.tsx`'s plugin list
- [ ] Implements `props.handlePaste` and `props.handleDrop` on the ProseMirror `EditorView`
- [ ] Paste: inspect `clipboardData.items` for `type.startsWith('image/')`. Drop: inspect `event.dataTransfer.files` for image MIME types.
- [ ] Image detected → `preventDefault()` / return `true` to block ProseMirror's default base64 insertion
- [ ] Not an image → return `false`, pass through to Milkdown's default handling unchanged (must not break normal text/link paste)
- [ ] Files over 10MB → visible inline error, no upload attempt
- [ ] Accepted image → insert a standard `image` node immediately at cursor with `src` set to `URL.createObjectURL(file)` (instant local preview) and a `data-pending="true"` attribute
- [ ] `POST` to the upload-url endpoint with the file's `contentType`, then `PUT` the raw bytes to the returned `uploadUrl` with `Content-Type` header matching the file's actual MIME type
- [ ] On success: locate the node by its pending marker (not by original position, since the doc may have changed during the async upload) and dispatch a transaction setting `src` to `/api/images/{noteId}/{key}`, removing `data-pending`
- [ ] On failure: locate the node by its pending marker, set `alt` to `"[upload failed]"`. No automatic retry — user deletes and re-pastes.

### User Story 4: Save Path Must Never Block on Pending Uploads
As a user, save/autosave should never wait on an in-flight upload.

**Acceptance Criteria:**
- [ ] The markdown serializer used at save time skips/omits any image node still marked `data-pending="true"`
- [ ] Save/autosave fires and completes normally regardless of pending upload state — no awaiting
- [ ] Once an upload resolves and its node updates, the next normal save naturally includes the resolved markdown — no special trigger needed
- [ ] **Known, accepted limitation:** if the tab closes between paste and the next save firing, before upload resolves, that image reference won't have been persisted. This is an intentional tradeoff for save-speed simplicity — do not engineer around it.

---

## P1 — Sweep Job
(Ship after P0 is stable. Fully decoupled — lag of a day or two has zero user-facing impact beyond storage cost.)

### User Story 5: Nightly Orphan Image Cleanup
As the system, delete S3 images no longer referenced by any note's current content.

**Acceptance Criteria:**
- [ ] Scheduled job (nightly cron), fully separate from request-handling code — must not be triggered by or block any save/load/edit request
- [ ] Per note: extract all `/api/images/{noteId}/{key}` references from current `content` via regex
- [ ] List S3 objects under `notes/{noteId}/` prefix
- [ ] orphans = S3 keys not in extracted references → delete
- [ ] One note's failure (e.g. S3 list error) logs and continues — does not abort the run
- [ ] No UI, no user-facing trigger

---

## AI Context Handoff

### User Story 6: Resolve Images Before Sending Note Content to AI Model
As the AI integration, image references must resolve to something usable before reaching the model.

**Acceptance Criteria:**
- [ ] Before sending note content to the model, server-side fetch each `/api/images/{noteId}/{key}` reference (following the redirect) and either pass the resulting signed URL (if the model accepts image URLs) or fetch bytes and attach as an image content block (if the model requires base64) — implementer's choice based on the model API in use
- [ ] This resolution happens only at the AI-handoff boundary. Render path is untouched — `<img src="/api/images/...">` lets the browser follow the redirect natively, no JS resolver needed there.

---

## Out of Scope
Do not implement; flag back if asked to expand:
- Image resize/compression before upload
- Thumbnail generation
- Non-image file attachments (PDFs, docs) — images only
- Automatic retry-with-backoff on upload failure
- Upload progress percentage UI (blob preview + pending state is sufficient)
- Any new S3 expiry policy