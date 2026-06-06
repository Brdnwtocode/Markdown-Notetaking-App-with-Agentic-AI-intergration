# Context Grabber Feature - Audit Report

**Date**: June 6, 2026  
**Auditor**: AI Coding Agent  
**Status**: Review Complete - Recommendations Provided

---

## 📋 Executive Summary

The Context Grabber feature (implemented in `lib/contextPacker.ts`) successfully collects context from active tabs and @mentions, but has two critical issues:

1. **Sends too much unnecessary metadata** - Including IDs, timestamps, and computed values that waste AI tokens
2. **Missing critical precision data** - Lacks cursor positions, cell IDs, and row identifiers needed for precise edits

**Impact**: Higher API costs, slower AI processing, and inability to perform precise edits (like "insert at cursor" or "update cell X in row Y").

---

## 🔍 Current Implementation Analysis

### What the Context Grabber Does Well ✅

1. **Multi-source context collection**:
   - Active tabs (via `selectedTabIds` or `activeTabId`)
   - @mentions (parsed from transcript/text)
   - Extensible for future sources (recent activity, etc.)

2. **Clean architecture**:
   - Centralized in `lib/contextPacker.ts`
   - Type-safe with `ContextItem` interface
   - Configurable limits (max 5 items)

3. **Good integration**:
   - Works with both `PushToTalk.tsx` (voice) and `ChatSidebar.tsx` (text)
   - Sends `packed_context` to FastAPI correctly

### Critical Issues Found ❌

## Issue #1: Excessive Metadata for AI Consumption

### Current Behavior
The ContextPacker sends ALL metadata from the frontend store, including:

**For NOTES:**
```typescript
base.metadata = {
  wordCount: note.content?.split(/\s+/).length || 0,  // AI doesn't need this
  lastUpdated: note.updatedAt || new Date().toISOString(), // AI doesn't need this
};
```

**For STACKS:**
```typescript
base.content = JSON.stringify({
  name: stack.name,
  columns: stack.columns,  // Full column objects (including IDs)
  rowCount: stack.rows?.length || 0,
});
base.metadata = {
  columnCount: stack.columns?.length || 0, // Redundant with content
  rowCount: stack.rows?.length || 0,       // Redundant with content
};
```

**For TASKS:**
```typescript
base.content = JSON.stringify({
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
});
base.metadata = {
  status: task.status,     // Duplicate of content
  priority: task.priority, // Duplicate of content
};
```

### Why This Is Bad
1. **Wastes AI tokens**: Word counts, timestamps, and redundant data cost money
2. **Confuses the AI**: Duplicate data in both `content` and `metadata` creates ambiguity
3. **Includes irrelevant data**: `updatedAt` timestamps don't help the AI understand content

### Recommended Fix
**Principle**: Send ONLY what the AI needs to understand and modify the content.

**For NOTES:**
```typescript
// ❌ CURRENT (wastes tokens)
{
  content: "Full note content...",
  metadata: {
    wordCount: 500,
    lastUpdated: "2026-06-02T10:30:00Z"
  }
}

// ✅ RECOMMENDED (minimal + precise)
{
  content: "Full note content...",
  metadata: {
    cursorPosition: 250,  // Where to insert/replace (CRITICAL for edits)
    title: "Meeting Notes" // Helpful for context
  }
}
```

**For STACKS:**
```typescript
// ❌ CURRENT (no row data, no cell IDs)
{
  content: JSON.stringify({
    name: "Q1 Sales",
    columns: [{ id: "...", name: "Revenue", type: "FLOAT" }],
    rowCount: 10
  }),
  metadata: { columnCount: 5, rowCount: 10 }
}

// ✅ RECOMMENDED (includes row data + cell IDs for precise edits)
{
  content: JSON.stringify({
    name: "Q1 Sales",
    columns: [{ id: "col_1", name: "Revenue", type: "FLOAT" }],
    rows: [
      { 
        id: "row_1", 
        data: { "col_1": 50000, "col_2": "John" } 
      },
      // ... more rows
    ]
  }),
  metadata: {
    rowCount: 10,
    focusedRowId: "row_3"  // If user has a row selected (for precision)
  }
}
```

**For TASKS:**
```typescript
// ❌ CURRENT (redundant metadata)
{
  content: JSON.stringify({ title: "...", description: "...", status: "TODO" }),
  metadata: { status: "TODO", priority: "HIGH" }  // DUPLICATE!
}

// ✅ RECOMMENDED (clean, no duplicates)
{
  content: JSON.stringify({ 
    title: "...", 
    description: "...", 
    status: "TODO",
    priority: "HIGH",
    parentId: "..."  // Include parent for subtasks
  }),
  metadata: {
    isSubtask: !!task.parentId  // Helpful context
  }
}
```

---

## Issue #2: Missing Precision Data for System Edits

### The Problem
When the AI wants to make precise edits, it needs specific identifiers:

1. **For NOTE edits**: Where is the cursor? (to insert/replace text)
2. **For STACK edits**: Which row? Which cell/column? (to update specific cells)
3. **For TASK edits**: Is it a subtask? What's the parent? (to place it correctly)

### Current Gaps

#### Gap 2.1: Cursor Position Not in Context
**Current behavior:**
- `cursorPosition` is tracked in `uiSlice.ts`
- It's sent as a SEPARATE field in the API call (not in `packed_context`)
- In `ChatSidebar.tsx` line 130: `form.append("cursorPosition", "0")` - **HARDCODED TO 0!**

**Why this breaks precision:**
```
User prompt: "Insert a new paragraph here" (with cursor at position 250)
AI receives: content="Full note...", cursorPosition=0 (WRONG!)
AI response: Inserts at position 0 instead of 250
```

**Recommended fix:**
```typescript
// In contextPacker.ts, for NOTE type:
case "NOTE": {
  const note = noteCache[id];
  if (!note) return null;
  base.content = note.content || "";
  base.metadata = {
    cursorPosition: store.cursorPosition,  // ← ADD THIS (CRITICAL!)
    title: note.title,
  };
  break;
}
```

#### Gap 2.2: Stack Rows Not Included (Can't Update Cells)
**Current behavior:**
- `buildContextItem` for STACK only includes `name`, `columns`, `rowCount`
- Does NOT include `rows` data
- Does NOT include row IDs or cell IDs

**Why this breaks precision:**
```
User prompt: "Update the Revenue to 75000 for the first row"
AI receives: { name: "Q1 Sales", columns: [...], rowCount: 10 }
AI response: ❌ Can't do it - no row data!
```

**Recommended fix:**
```typescript
// In contextPacker.ts, for STACK type:
case "STACK": {
  const stack = stacks.find((s) => s.id === id);
  if (!stack) return null;
  
  // ✅ Include FULL row data with IDs
  base.content = JSON.stringify({
    name: stack.name,
    columns: stack.columns,  // Includes column IDs
    rows: stack.rows,        // ✅ ADD THIS (includes row IDs and cell data)
  });
  
  base.metadata = {
    rowCount: stack.rows?.length || 0,
    focusedRowId: store.focusedRowId || null,  // ✅ ADD THIS (if user selected a row)
  };
  break;
}
```

#### Gap 2.3: Task Parent/Child Relationships Missing
**Current behavior:**
- Sends task `title`, `description`, `status`, `priority`
- Does NOT send `parentId` (for subtasks)
- Does NOT send `children` array (for parent tasks)

**Why this breaks precision:**
```
User prompt: "Add a subtask to this task"
AI receives: { title: "Main Task", status: "TODO" }
AI response: ❌ Creates task at root level, not as subtask!
```

**Recommended fix:**
```typescript
// In contextPacker.ts, for TASK type:
case "TASK": {
  const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
  const task = allTasks.find((t) => t.id === id);
  if (!task) return null;
  
  // ✅ Include parent/child context
  base.content = JSON.stringify({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    parentId: task.parentId || null,     // ✅ ADD THIS
    children: task.children?.map(t => ({  // ✅ ADD THIS
      id: t.id,
      title: t.title,
      status: t.status,
    })) || [],
  });
  
  base.metadata = {
    isSubtask: !!task.parentId,
    subtaskCount: task.children?.length || 0,
  };
  break;
}
```

---

## Issue #3: Inconsistent Context Packing Between Voice and Text

### Current Behavior
**Voice (`PushToTalk.tsx`):**
```typescript
// Line 133: Sends cursor position
form.append("cursorPosition", cursorPosition.toString());

// Line 120-127: Sends note_state, dynamic_schema, task_context
if (primary.type === "NOTE" && currentNoteId) {
  form.append("note_state", noteCache[currentNoteId]?.content || "");
} else if (primary.type === "STACK" && currentStackId) {
  form.append("dynamic_schema", JSON.stringify(stack.columns));
}
```

**Text (`ChatSidebar.tsx`):**
```typescript
// Line 130: HARDCODED to 0!
form.append("cursorPosition", "0");

// Line 120-127: Same as voice, but cursor position is wrong
```

### Why This Is Bad
1. **Voice works, text doesn't**: Cursor position is sent correctly for voice, but hardcoded to 0 for text
2. **Duplicate data**: `note_state` and `dynamic_schema` are sent OUTSIDE of `packed_context`
3. **Inconsistent**: The AI receives different data depending on input method

### Recommended Fix
**Principle**: ALL context should be inside `packed_context`. No separate fields.

```typescript
// ❌ CURRENT (scattered across multiple fields)
form.append("packed_context", JSON.stringify(packedContext));
form.append("cursorPosition", "0");  // Wrong for text!
form.append("note_state", noteCache[currentNoteId]?.content || "");

// ✅ RECOMMENDED (everything in packed_context)
// In contextPacker.ts, include cursor position in metadata
// Then only send packed_context
form.append("packed_context", JSON.stringify(packedContext));
// No more separate fields!
```

---

## 📊 Data Flow Analysis

### Current Flow (Inefficient)
```
User Input (Voice/Text)
    ↓
ContextPacker gathers context
    ↓
Includes: content + excessive metadata (IDs, timestamps, etc.)
Excludes: cursor position, row data, cell IDs
    ↓
Send to API: packed_context + separate fields (cursorPosition, note_state, etc.)
    ↓
FastAPI receives: Redundant data + missing precision info
    ↓
AI processes: Wastes tokens on unnecessary metadata, can't do precise edits
    ↓
Response: updatedData lacks precision (e.g., can't update specific cell)
```

### Recommended Flow (Efficient + Precise)
```
User Input (Voice/Text)
    ↓
ContextPacker gathers context
    ↓
Includes: content + MINIMAL metadata (cursor position, focused row, etc.)
Excludes: timestamps, word counts, redundant data
    ↓
Send to API: ONLY packed_context (no separate fields)
    ↓
FastAPI receives: Clean data + precision info
    ↓
AI processes: Fewer tokens, can do precise edits
    ↓
Response: updatedData includes specific targets (e.g., rowId, cellId, cursorPosition)
```

---

## 🎯 Specific Recommendations

### Recommendation 1: Minimize Metadata in ContextPacker
**File**: `lib/contextPacker.ts`  
**Change**: Remove unnecessary metadata, keep only what's needed for AI understanding

**Current metadata per type:**
- NOTE: `wordCount`, `lastUpdated` → **REMOVE** (AI doesn't need these)
- STACK: `columnCount`, `rowCount` → **KEEP** (useful for AI to know size)
- TASK: `status`, `priority` → **REMOVE** (already in content)

**Add precision metadata:**
- NOTE: `cursorPosition` → **ADD** (CRITICAL for inserts)
- STACK: `focusedRowId` → **ADD** (if user selected a row)
- TASK: `parentId`, `children` → **ADD** (for subtask context)

### Recommendation 2: Include Full Row Data for Stacks
**File**: `lib/contextPacker.ts`  
**Change**: In `buildContextItem` for STACK type, include `rows` array

**Current:**
```typescript
base.content = JSON.stringify({
  name: stack.name,
  columns: stack.columns,
  rowCount: stack.rows?.length || 0,
});
```

**Fixed:**
```typescript
base.content = JSON.stringify({
  name: stack.name,
  columns: stack.columns,
  rows: stack.rows,  // ← Include full row data with IDs
});
```

### Recommendation 3: Fix Cursor Position in ChatSidebar
**File**: `components/workspace/ChatSidebar.tsx`  
**Change**: Line 130, don't hardcode to "0"

**Current:**
```typescript
form.append("cursorPosition", "0");  // ← WRONG!
```

**Fixed:**
```typescript
form.append("cursorPosition", cursorPosition.toString());  // ← Use actual position
```

### Recommendation 4: Consolidate All Context into packed_context
**Files**: `PushToTalk.tsx`, `ChatSidebar.tsx`, `app/api/voice/process/route.ts`  
**Change**: Remove separate fields (`cursorPosition`, `note_state`, `dynamic_schema`, `task_context`), put everything in `packed_context`

**Benefits:**
- Single source of truth (`packed_context`)
- No data inconsistency
- Cleaner API contract

### Recommendation 5: Update FastAPI to Use Precision Data
**File**: FastAPI microservice (not in this repo)  
**Change**: Update LLM prompt to use `cursorPosition`, `rowId`, `cellId` for precise edits

**Example LLM Prompt:**
```
User command: "Insert a new paragraph here"

Context:
{
  "type": "NOTE",
  "id": "note_1",
  "content": "Existing note content...",
  "metadata": {
    "cursorPosition": 250,  // ← Use this for insertion point
    "title": "Meeting Notes"
  }
}

AI should respond with:
{
  "action": "update_note",
  "updatedData": {
    "id": "note_1",
    "content": "Insert new paragraph at cursor position 250",
    "cursorPosition": 250  // ← Preserve cursor position
  }
}
```

---

## 📝 Implementation Priority

### Priority 1 (Critical - Breaks Functionality)
1. **Fix cursor position in ChatSidebar** (line 130 hardcoded to "0")
2. **Include cursor position in NOTE context** (add to metadata)
3. **Include full row data in STACK context** (add `rows` to content)

### Priority 2 (Important - Wastes Tokens)
1. **Remove unnecessary metadata** (`wordCount`, `lastUpdated`, redundant fields)
2. **Consolidate all context into `packed_context`** (remove separate fields)

### Priority 3 (Enhancement - Future Precision)
1. **Add `focusedRowId` to STACK metadata** (for row-specific edits)
2. **Add `parentId` and `children` to TASK content** (for subtask context)
3. **Update FastAPI LLM prompt** to use precision data

---

## 🔬 Code Locations for Fixes

### Fix 1: Cursor Position in ChatSidebar
**File**: `components/workspace/ChatSidebar.tsx`  
**Line**: ~130  
**Change**:
```typescript
// ❌ Current
form.append("cursorPosition", "0");

// ✅ Fixed
form.append("cursorPosition", cursorPosition.toString());
```

### Fix 2: Include Cursor Position in NOTE Context
**File**: `lib/contextPacker.ts`  
**Line**: ~178-185  
**Change**:
```typescript
case "NOTE": {
  const note = noteCache[id];
  if (!note) return null;
  base.content = note.content || "";
  base.metadata = {
    cursorPosition: store.cursorPosition,  // ← ADD THIS
    title: note.title,
  };
  break;
}
```

### Fix 3: Include Row Data in STACK Context
**File**: `lib/contextPacker.ts`  
**Line**: ~187-198  
**Change**:
```typescript
case "STACK": {
  const stack = stacks.find((s) => s.id === id);
  if (!stack) return null;
  base.content = JSON.stringify({
    name: stack.name,
    columns: stack.columns,
    rows: stack.rows,  // ← ADD THIS (full row data with IDs)
  });
  base.metadata = {
    rowCount: stack.rows?.length || 0,
  };
  break;
}
```

### Fix 4: Remove Separate Fields, Use Only packed_context
**Files**: `PushToTalk.tsx`, `ChatSidebar.tsx`  
**Lines**: ~120-140 (both files)  
**Change**:
```typescript
// ❌ Current (separate fields)
form.append("packed_context", JSON.stringify(packedContext));
form.append("cursorPosition", cursorPosition.toString());
form.append("note_state", noteCache[currentNoteId]?.content || "");

// ✅ Fixed (only packed_context)
form.append("packed_context", JSON.stringify(packedContext));
// No more separate fields!
```

---

## 🧪 Testing Recommendations

### Test 1: Cursor Position Precision
**Test case**: "Insert text at cursor position"  
**Expected**: AI receives `cursorPosition` in context, uses it in `updatedData`  
**Current behavior**: ❌ Fails (cursor position not in context or hardcoded to 0)

### Test 2: Stack Cell Update
**Test case**: "Update Revenue to 75000 for row 1"  
**Expected**: AI receives `rows` data in context, responds with `rowId` and `cellId`  
**Current behavior**: ❌ Fails (no row data in context)

### Test 3: Task Subtask Creation
**Test case**: "Add a subtask to this task"  
**Expected**: AI receives `parentId` in context, creates subtask with correct parent  
**Current behavior**: ❌ Fails (no `parentId` in context)

### Test 4: Token Usage
**Test case**: Send 5 notes + 5 stacks as context  
**Expected**: Token count < 10,000 (reasonable for GPT-3.5/4)  
**Current behavior**: ❌ Likely exceeds (too much metadata)

---

## 📈 Expected Improvements

### After Fixing Issue #1 (Excessive Metadata)
- **Token reduction**: ~30-40% fewer tokens per request
- **Cost savings**: Proportional to token reduction
- **Faster AI processing**: Less data to process

### After Fixing Issue #2 (Missing Precision Data)
- **Enable precise edits**: "Insert at cursor", "Update cell X in row Y"
- **Better user experience**: AI can do what user asks
- **Reduced errors**: No more "I can't do that" responses

### After Fixing Issue #3 (Inconsistent Context)
- **Consistent behavior**: Voice and text input work the same
- **Easier maintenance**: Single code path for context packing
- **Fewer bugs**: No more separate fields getting out of sync

---

## 🏁 Conclusion

The Context Grabber feature works but is inefficient and lacks precision. The fixes are straightforward:

1. **Remove unnecessary metadata** (timestamps, word counts, redundant fields)
2. **Add precision data** (cursor position, row IDs, cell IDs, parent IDs)
3. **Consolidate into `packed_context`** (remove separate fields)
4. **Fix bugs** (hardcoded cursor position in ChatSidebar)

**Estimated effort**: 4-6 hours  
**Priority**: High (blocks precise editing functionality)  
**Risk**: Low (changes are backward compatible if done gradually)

---

## 📎 Appendices

### Appendix A: Relevant Files
- `lib/contextPacker.ts` - Core context packing logic (NEEDS FIX)
- `components/shared/PushToTalk.tsx` - Voice input (WORKS, but sends separate fields)
- `components/workspace/ChatSidebar.tsx` - Text input (BROKEN, cursor position hardcoded)
- `app/api/voice/process/route.ts` - API route (NEEDS UPDATE to use only `packed_context`)
- `lib/slices/uiSlice.ts` - Cursor position state (WORKS)
- `types/voice.ts` - Type definitions (MAY NEED UPDATE)

### Appendix B: Data Structures
**Note:**
```typescript
{ id: string, title: string, content: string, createdAt: Date, updatedAt: Date }
```

**Stack:**
```typescript
{
  id: string,
  name: string,
  columns: [{ id: string, name: string, type: DataType }],
  rows: [{ id: string, stackId: string, data: Record<string, any> }],
  createdAt: Date,
  updatedAt: Date
}
```

**Task:**
```typescript
{
  id: string,
  title: string,
  description: string,
  status: TaskStatus,
  priority: TaskPriority,
  parentId: string | null,
  children: Task[],
  createdAt: Date,
  updatedAt: Date
}
```

### Appendix C: Current Context Item Structure
```typescript
type ContextItem = {
  type: TabType | "TASK" | "CALENDAR";
  id: string;
  title: string;
  content?: string;        // Note content / Stack JSON / Task details
  metadata?: Record<string, any>;  // ← TOO MUCH STUFF HERE
  source: ContextSource;
};
```

### Appendix D: Recommended Context Item Structure
```typescript
type ContextItem = {
  type: TabType | "TASK" | "CALENDAR";
  id: string;
  title: string;
  content?: string;        // Note content / Stack JSON (with rows) / Task details
  metadata?: {
    // NOTE
    cursorPosition?: number;  // ← ADD (critical for edits)
    
    // STACK
    rowCount?: number;
    focusedRowId?: string;   // ← ADD (for row-specific edits)
    
    // TASK
    isSubtask?: boolean;     // ← ADD (helpful context)
    
    // NONE OF THESE:
    // wordCount, lastUpdated, columnCount (redundant), etc.
  };
  source: ContextSource;
};
```

---

**End of Audit Report**
