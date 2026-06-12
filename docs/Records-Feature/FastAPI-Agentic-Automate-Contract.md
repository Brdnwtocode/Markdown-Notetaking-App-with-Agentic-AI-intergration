# Agentic Automate — FastAPI Contract

> **Endpoint**: `POST /api/v1/records/automate`  
> **Purpose**: Receive a full transcript + workspace context, return cross-module  
> mutations (Notes, Tasks, Stacks, Calendar) for user approval.  
> **Pattern**: Suggestion-Only — mutations are NOT auto-committed. The Next.js  
> frontend renders them as ghost rows / confirmation toasts.

---

## 1. Request (Next.js → FastAPI)

```json
{
  "transcript": "string (required, max 100000 chars)",
  "recording_id": "string (required, UUID v4)",
  "user_id": "string (required)",
  "mode": "automate",
  "workspace_context": {
    "active_note_id": "string | null",
    "active_stack_id": "string | null",
    "active_task_ids": ["string"],
    "recent_notes": [
      { "id": "string", "title": "string" }
    ],
    "recent_stacks": [
      { "id": "string", "name": "string" }
    ]
  },
  "action": "full_automate | summarize | extract_tasks | populate_stack | identify_speakers | create_calendar"
}
```

### Headers
| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-session-id` | Stable per-tab session ID |
| `x-user-id` | Authenticated user ID |

---

## 2. Response (FastAPI → Next.js)

```json
{
  "note_mutation": {
    "title": "string",
    "content": "string (markdown)",
    "folder_id": "string | null"
  },
  "task_mutations": [
    {
      "title": "string",
      "description": "string | null",
      "status": "TODO | IN_PROGRESS | DONE",
      "priority": "LOW | MEDIUM | HIGH",
      "assignee": "string | null",
      "due_date": "ISO8601 string | null"
    }
  ],
  "stack_mutation": {
    "stack_id": "string | null",
    "stack_name": "string",
    "columns": [
      { "name": "string", "type": "TEXT | INT | FLOAT | BOOLEAN | DATE | SELECT" }
    ],
    "rows": [
      { "column_id": "value" }
    ]
  },
  "calendar_mutation": {
    "title": "string",
    "notes": "string | null",
    "start_at": "ISO8601 string",
    "end_at": "ISO8601 string",
    "all_day": "boolean"
  },
  "speaker_labels": [
    {
      "speaker": "string",
      "segments": [
        { "start": "float (seconds)", "end": "float (seconds)", "text": "string" }
      ]
    }
  ],
  "summary": "string (AI-generated summary of the transcript)"
}
```

### Rules
- **Mutual Exclusivity**: If the transcript is purely conversational (no actionable items), only `summary` should be populated.
- **Empty Arrays**: `task_mutations` should be `[]` (not null) when no tasks are extracted.
- **Null Fields**: Any mutation type that is not applicable should be `null`.
- **Suggestion-Only**: The FastAPI response is treated as a **suggestion**. The Next.js frontend wraps each mutation in `UniversalConfirmationToast` for user approval before committing to the database.

---

## 3. Pydantic Models (Python/FastAPI Reference)

```python
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ActionType(str, Enum):
    FULL_AUTOMATE = "full_automate"
    SUMMARIZE = "summarize"
    EXTRACT_TASKS = "extract_tasks"
    POPULATE_STACK = "populate_stack"
    IDENTIFY_SPEAKERS = "identify_speakers"
    CREATE_CALENDAR = "create_calendar"

class WorkspaceContext(BaseModel):
    active_note_id: Optional[str] = None
    active_stack_id: Optional[str] = None
    active_task_ids: List[str] = []
    recent_notes: List[dict] = []
    recent_stacks: List[dict] = []

class AutomateRequest(BaseModel):
    transcript: str
    recording_id: str
    user_id: str
    mode: str = "automate"
    workspace_context: WorkspaceContext = WorkspaceContext()
    action: ActionType = ActionType.FULL_AUTOMATE

class NoteMutation(BaseModel):
    title: str
    content: str
    folder_id: Optional[str] = None

class TaskMutation(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "TODO"
    priority: str = "MEDIUM"
    assignee: Optional[str] = None
    due_date: Optional[str] = None

class ColumnDef(BaseModel):
    name: str
    type: str

class StackMutation(BaseModel):
    stack_id: Optional[str] = None
    stack_name: str
    columns: List[ColumnDef] = []
    rows: List[dict] = []

class CalendarMutation(BaseModel):
    title: str
    notes: Optional[str] = None
    start_at: str
    end_at: str
    all_day: bool = False

class SpeakerSegment(BaseModel):
    start: float
    end: float
    text: str

class SpeakerLabel(BaseModel):
    speaker: str
    segments: List[SpeakerSegment]

class AutomateResponse(BaseModel):
    note_mutation: Optional[NoteMutation] = None
    task_mutations: List[TaskMutation] = []
    stack_mutation: Optional[StackMutation] = None
    calendar_mutation: Optional[CalendarMutation] = None
    speaker_labels: Optional[List[SpeakerLabel]] = None
    summary: Optional[str] = None
```

---

## 4. Processing Pipeline (FastAPI Implementation Guide)

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│  Transcript  │────▶│  NLU Resolver   │────▶│  Mutation Gen   │
│  + Context   │     │  (Gemini/Llama) │     │  (Pydantic)     │
└──────────────┘     └────────────────┘     └─────────────────┘
                                                    │
                    ┌───────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────┐
│  Structured Output (JSON)                             │
│  • note_mutation      → Note title + markdown content │
│  • task_mutations[]   → Extracted action items        │
│  • stack_mutation     → Mapped table data             │
│  • calendar_mutation  → Date/time extraction          │
│  • speaker_labels[]   → Diarization segments          │
│  • summary            → Conversational summary        │
└──────────────────────────────────────────────────────┘
```

### Key Implementation Notes
1. **Prompt Engineering**: The LLM prompt should instruct the model to output valid JSON matching the `AutomateResponse` schema. Use structured output / function calling if available.
2. **Dynamic Schema Compilation**: For `stack_mutation`, columns should be dynamically generated from the transcript content (e.g., if transcript mentions "Name, Role, Department", those become columns).
3. **Speaker Diarization**: If `identify_speakers` action is requested, run a diarization model (e.g., pyannote.audio) on the audio file stored in S3.
4. **Error Handling**: Return HTTP 422 with `{"detail": "error message"}` on validation failures. Return HTTP 500 on LLM/processing failures.
5. **Memory**: Use `x-session-id` and `x-user-id` headers to maintain ConversationBuffer context across multiple automate calls.

---

## 5. Example Flow

### Request
```json
{
  "transcript": "Let's discuss the Q3 roadmap. Alice will handle frontend refactoring by June 30. Bob needs to review the API docs. We should track these in a table with columns: Task, Owner, Deadline, Priority.",
  "recording_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "user_xyz",
  "mode": "automate",
  "action": "full_automate"
}
```

### Response
```json
{
  "note_mutation": {
    "title": "Q3 Roadmap Discussion",
    "content": "# Q3 Roadmap Discussion\n\n## Key Points\n- Alice will handle frontend refactoring (deadline: June 30)\n- Bob to review API documentation\n- Need tracking table for tasks\n\n## Action Items\n- [ ] Frontend refactoring — Alice — June 30\n- [ ] API docs review — Bob — TBD"
  },
  "task_mutations": [
    {
      "title": "Frontend refactoring",
      "description": "Alice to handle frontend refactoring",
      "status": "TODO",
      "priority": "HIGH",
      "assignee": "Alice",
      "due_date": "2026-06-30T00:00:00Z"
    },
    {
      "title": "Review API documentation",
      "description": "Bob needs to review the API docs",
      "status": "TODO",
      "priority": "MEDIUM",
      "assignee": "Bob",
      "due_date": null
    }
  ],
  "stack_mutation": {
    "stack_name": "Q3 Roadmap Tasks",
    "columns": [
      { "name": "Task", "type": "TEXT" },
      { "name": "Owner", "type": "TEXT" },
      { "name": "Deadline", "type": "DATE" },
      { "name": "Priority", "type": "SELECT" }
    ],
    "rows": [
      { "Task": "Frontend refactoring", "Owner": "Alice", "Deadline": "2026-06-30", "Priority": "High" },
      { "Task": "API docs review", "Owner": "Bob", "Deadline": "", "Priority": "Medium" }
    ]
  },
  "calendar_mutation": {
    "title": "Frontend Refactoring Deadline",
    "notes": "Alice to complete Q3 frontend refactoring",
    "start_at": "2026-06-30T00:00:00Z",
    "end_at": "2026-06-30T23:59:59Z",
    "all_day": true
  },
  "speaker_labels": null,
  "summary": "The team discussed the Q3 roadmap. Two action items were identified: Alice will handle frontend refactoring by June 30, and Bob will review the API documentation. A tracking table was requested with Task, Owner, Deadline, and Priority columns."
}
```
