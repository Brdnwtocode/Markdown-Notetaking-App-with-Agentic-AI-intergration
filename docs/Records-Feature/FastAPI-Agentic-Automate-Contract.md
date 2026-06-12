# Agentic Automate — FastAPI Contract

> `POST /api/v1/records/automate`  
> BFF: `app/api/records/automate/route.ts`  
> FastAPI is **stateless** — no DB access. It receives everything it needs in the request.

---

## BFF → FastAPI (Request)

**Multipart/form-data** — the BFF forwards the audio blob + metadata directly.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `audio` | File (binary) | no* | Raw audio blob (webm/opus). *Required if no `transcript`. |
| `transcript` | string | no* | Pre-transcribed text. *Required if no `audio`. |
| `recording_id` | string | no | DB Recording UUID (empty for unsaved recordings) |
| `user_id` | string | yes | Authenticated user UUID |
| `mode` | string | yes | Always `"automate"` |
| `action` | string | yes | `full_automate` / `summarize` / `extract_tasks` / `populate_stack` / `identify_speakers` / `create_calendar` |
| `workspace_context` | string (JSON) | no | `{"active_note_id":..., "active_stack_id":...}` |

**Headers**: `x-session-id`, `x-user-id`

---

## FastAPI → BFF (Response)

Return **snake_case** JSON. The BFF normalizes to camelCase for the client.

```json
{
  "note_mutation": { "title": "...", "content": "... (markdown)", "folder_id": "..." },
  "task_mutations": [
    { "title": "...", "description": "...", "status": "TODO|IN_PROGRESS|DONE", "priority": "LOW|MEDIUM|HIGH", "assignee": "...", "due_date": "ISO8601" }
  ],
  "stack_mutation": { "stack_name": "...", "columns": [{"name":"...","type":"TEXT|INT|..."}], "rows": [{}] },
  "calendar_mutation": { "title": "...", "start_at": "ISO8601", "end_at": "ISO8601", "all_day": false },
  "speaker_labels": [{ "speaker": "...", "segments": [{"start":0.0,"end":0.0,"text":"..."}] }],
  "summary": "..."
}
```

### Rules
- All mutation fields **nullable** — omit or set to `null` when not applicable
- `task_mutations` → `[]` (empty array, never null)
- `summary` → always populated
- **Suggestion-only** — never auto-commit; the frontend asks the user to approve
- Errors: `422` validation, `500` processing failure

---

## Processing Logic

```
audio blob ──▶ [STT if needed] ──▶ transcript ──▶ [LLM] ──▶ structured JSON
     │                                                          │
transcript ─────────────────────────────────────────────────────┘
```

FastAPI receives both audio and transcript. If transcript is empty, run STT on the audio first. Then pass the transcript through the LLM to extract mutations.

---

## Pydantic Stub

```python
class AutomateResponse(BaseModel):
    note_mutation: Optional[dict] = None
    task_mutations: list[dict] = []
    stack_mutation: Optional[dict] = None
    calendar_mutation: Optional[dict] = None
    speaker_labels: Optional[list[dict]] = None
    summary: Optional[str] = None
```
