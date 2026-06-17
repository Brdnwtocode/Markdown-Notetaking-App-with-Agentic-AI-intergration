# Context Grabber Implementation Plan

**Date**: June 2, 2026  
**Status**: Draft - Pending Discussion  
**Author**: AI Coding Agent

> **📋 AUDIT STATUS (2026-06-16): ~60% MATCH — IMPLEMENTATION DIVERGED**
> 
> The implementation followed this plan's spirit but diverged in structure:
> - `lib/contextPacker.ts` → actually at `lib/context/packer.ts` (organized into `lib/context/` directory)
> - `lib/mentionParser.ts` → `extractMentions()` is integrated into ContextPacker class
> - Multi-tab selection, @mentions, Search API all implemented ✅
> - FastAPI enrichment endpoint (`/api/v1/context/pack`) — not implemented (frontend-only packing)
> - The `selectedTabIds` approach was adopted as described ✅
> - Phases 4 (Backend Enrichment) not implemented as described — FastAPI gets data from frontend only
> 
> **This document is useful for:** Understanding the design rationale. See `lib/context/` for actual implementation.

---

## 🎯 **Goal Summary**

Build a **Context Packer** system that:
1. ✅ Allows **multi-tab selection** (user chooses which tabs to include)
2. ✅ Supports **@mention system** for explicitly referencing materials by name
3. ✅ **Automatically packs** selected tabs + mentioned materials as context
4. ✅ **Displays context files** clearly in chat UI with expandable file list
5. ✅ Uses **hybrid architecture** (frontend packs + backend enriches)

---

## 📊 **Current State Analysis**

### What Exists:
- **Voice Command Flow**: `PushToTalk.tsx` → `/api/voice/process` → FastAPI microservice
- **Context Handling**: Currently **single-context only** (one note, stack, task, or calendar)
- **Context in Chat UI**: Minimal display - small expandable section showing `type` and `title` only
- **State Management**: Zustand store with `openTabs[]`, `activeTabId`, `currentNoteId`, `currentStackId`
- **APIs Available**: Notes, Stacks, Tasks, Calendar all have GET endpoints (no search endpoints yet)

### Key Gap:
No "Context Packer" layer exists - context building is scattered across components.

---

## 📦 **Phase 1: Frontend Context Packer Service**

### Task 1.1: Create `lib/contextPacker.ts`
**Purpose**: Core module to collect and structure context from multiple sources

**Responsibilities**:
- Accept array of tab IDs + @mention references
- Fetch content for notes, stacks, tasks from store/API
- Structure context into standardized `ContextItem[]` format
- Support multimodal content (text, structured data, metadata)

**Output Type**:
```typescript
type ContextItem = {
  type: "NOTE" | "STACK" | "TASK" | "CALENDAR";
  id: string;
  title: string;
  content?: string;        // Note content / Stack JSON / Task details
  metadata?: Record<string, any>;
  source: "active_tab" | "user_mention" | "recent_activity";
}
```

---

## 🎨 **Phase 2: Multi-Tab Selection UI**

### Task 2.1: Extend TabBar for Multi-Selection
**File**: `components/workspace/TabBar.tsx`

**Changes**:
- Add `selectedTabIds: string[]` to UI slice
- Add `toggleTabSelection(tabId)` action
- Visual indicator for selected tabs (checkbox or highlight)
- "Select All" / "Clear Selection" controls

### Task 2.2: Update Store (uiSlice.ts)
Add to `UiSlice`:
```typescript
selectedTabIds: string[];
toggleTabSelection: (tabId: string) => void;
clearTabSelection: () => void;
selectAllTabs: () => void;
```

---

## 🔍 **Phase 3: @Mention System**

### Task 3.1: Create Mention Parser
**File**: `lib/mentionParser.ts`

**Purpose**: Parse voice transcripts and text input for @mentions

**Logic**:
- Regex: `@([^\s@]+)` to capture mentions
- Fuzzy match against note titles, stack names, task titles
- Return array of matched material IDs with confidence scores

### Task 3.2: Add Search API Endpoint
**File**: `app/api/search/route.ts`

**Purpose**: Title-based search across all material types

**Query Params**: `?q=keyword&types=NOTE,STACK,TASK&limit=10`

**Returns**: Array of matching materials with type, id, title, relevance

### Task 3.3: Integrate with Voice & Chat Input
- In `PushToTalk.tsx`: Parse transcript for @mentions before sending
- In `ChatSidebar.tsx`: Parse text input for @mentions
- Show mention suggestions dropdown while typing

---

## 🔗 **Phase 4: Backend Context Enrichment (FastAPI)**

### Task 4.1: Create Context Enrichment Endpoint
**FastAPI Endpoint**: `POST /api/v1/context/pack`

**Request Body**:
```json
{
  "user_id": "string",
  "context_items": [
    {"type": "NOTE", "id": "uuid", "source": "active_tab"},
    {"type": "STACK", "id": "uuid", "source": "user_mention"}
  ],
  "options": {
    "include_content": true,
    "include_recent_activity": true,
    "max_items": 10
  }
}
```

**Response**:
```json
{
  "packed_context": [
    {
      "type": "NOTE",
      "id": "uuid",
      "title": "Meeting Notes",
      "content": "Full note content...",
      "metadata": {"word_count": 500, "last_updated": "..."},
      "source": "active_tab"
    }
  ],
  "warnings": ["Stack uuid not found"]
}
```

### Task 4.2: Update Voice Process Endpoint
Modify `/api/v1/voice/process` to accept `packed_context` array instead of single `context_type`/`context_id`

---

## 💬 **Phase 5: Enhanced Chat UI Context Display**

### Task 5.1: Update ChatMessage Type
**File**: `lib/slices/aiSlice.ts`

Extend `MessageContext` to support multiple contexts:
```typescript
type MessageContext = {
  items: ContextItem[];
  packedAt: Date;
  totalItems: number;
}
```

### Task 5.2: Redesign Context Display in ChatSidebar
**File**: `components/workspace/ChatSidebar.tsx`

**New UI** (expandable file list per message):
```
┌─────────────────────────────────────┐
│ 💬 "Summarize these notes"          │
│ 📎 Context (3 files) ▼             │
│  ├─ 📄 Meeting Notes (NOTE)        │
│  ├─ 📊 Q1 Sales (STACK)            │
│  └─ ✅ Project Tasks (TASKS)       │
└─────────────────────────────────────┘
```

**Features**:
- Click to expand/collapse file list
- Icons per type (📄 NOTE, 📊 STACK, ✅ TASK, 📅 CALENDAR)
- Hover to see metadata (word count, last updated)
- Click file name to open it

---

## 🔄 **Phase 6: Integration & Flow Update**

### Task 6.1: Update PushToTalk Flow
**New Flow**:
1. User presses record
2. System captures `selectedTabIds` + parses @mentions from upcoming transcript
3. `ContextPacker.pack()` gathers all context
4. Send `packed_context` array to `/api/voice/process`
5. Display all context files in chat message

### Task 6.2: Update ChatSidebar Flow
Same as above but for text input

### Task 6.3: Update Next.js API Route
**File**: `app/api/voice/process/route.ts`

Accept `packed_context` JSON string in FormData, forward to FastAPI

---

## 🧪 **Phase 7: Testing & Validation**

### Task 7.1: Unit Tests
- `contextPacker.ts` logic
- `mentionParser.ts` regex and fuzzy matching
- Store actions for tab selection

### Task 7.2: Integration Tests
- Multi-tab context packing flow
- @mention detection in voice transcripts
- Chat UI context display rendering

---

## 📅 **Implementation Order & Dependencies**

```
Phase 1 (ContextPacker) 
   ↓
Phase 2 (Multi-Tab UI) ← Can parallel with Phase 3
Phase 3 (@Mention System) ← Can parallel with Phase 2
   ↓
Phase 4 (Backend Enrichment)
   ↓
Phase 5 (Chat UI Update)
   ↓
Phase 6 (Integration)
   ↓
Phase 7 (Testing)
```

---

## 🎨 **UI/UX Mockups**

### TabBar with Multi-Select:
```
[📄 Note A ✓] [📊 Stack B ✓] [✅ Tasks] [📅 Calendar]
              ↑ Selected for context
```

### Chat Message with Context:
```
User: "@Meeting Notes summarize this and @Q1 Sales compare"
─────────────────────────────────────────────────────────
📎 Context (2 files) ▼
   📄 Meeting Notes (NOTE) - mentioned
   📊 Q1 Sales (STACK) - mentioned
─────────────────────────────────────────────────────────
AI: Here's a summary of Meeting Notes...
```

---

## ❓ **Open Questions for Discussion**

1. **Priority**: Which phase should we implement first - the ContextPacker service or the multi-tab UI?

2. **@Mention UX**: Should @mentions work as you type (dropdown suggestions), or only parsed after sending?

3. **Context Limits**: Should we limit the number of context items per message (e.g., max 5-10)?

4. **Backend Priority**: Should we also implement the FastAPI context enrichment endpoint, or focus on frontend-first?

---

## 📝 **User Requirements (Confirmed)**

Based on discussion with end user:

| Requirement | Decision |
|------------|----------|
| Multi-tab context | ✅ User selects multiple tabs via UI |
| Mention detection | ✅ Manual @mention system (`@Title`) |
| Context Packer architecture | ✅ Hybrid (frontend packs + backend enriches) |
| Context display in chat | ✅ Expandable file list per message |

---

**Next Steps**: Await feedback from team, then proceed with implementation starting with Phase 1 (ContextPacker service).
