# Context Grabber - Ultra-Efficient Design (Precision-First)

**Date**: June 6, 2026  
**Status**: Redesign Proposal  
**Author**: AI Coding Agent

> **📋 AUDIT STATUS (2026-06-16): DESIGN PROPOSAL — NOT IMPLEMENTED**
> 
> This is the most radical redesign proposal — sending only the focused cell instead of row data.
> The actual implementation takes a middle-ground approach: sends full data (CSV/Markdown) but limits rows.
> 
> The `focusedCell` / `focusedTarget` concepts are NOT in the current implementation.
> This document is valuable as an optimization direction for future iterations.

---

## 🚨 The Core Problem

**Current approach**: Send 10 rows × 8 columns = 80 cells of data  
**Reality**: AI only needs to edit 1 specific cell  
**Waste**: 79 cells of unnecessary data (98% waste!)

---

## 💡 New Design Philosophy

### Principle: **Instruction-Over-Data**
Instead of sending DATA, send **INSTRUCTIONS + PRECISE TARGET**.

### Key Insight:
For 90% of commands, the AI doesn't need to see all the data. It just needs:
1. **Schema** (column definitions)
2. **Target** (which cell/row to edit)
3. **Current value** (for reference)

---

## 📦 Ultra-Minimal Context Structure

### For STACK Type (Precision Edit Design):

```json
{
  "type": "STACK",
  "id": "107c8c18-9ce0-4e15-ad77-1ffae69934eb",
  "title": "asd",
  "source": "active_tab",
  
  "content": {
    "schema": {
      "columns": [
        {
          "id": "2e74e82c-a87c-4a63-846c-9a37c5b3c79a",
          "name": "Name",
          "type": "TEXT"
        },
        {
          "id": "6e2ffef7-8fde-404d-aeb8-fe73b3c7ef09",
          "name": "Revenue",
          "type": "INT"
        }
      ]
    },
    "rowCount": 14,
    "focusedCell": {
      "rowId": "row_7",
      "columnId": "6e2ffef7-8fde-404d-aeb8-fe73b3c7ef09",
      "currentValue": 50000
    }
  },
  
  "metadata": {
    "editMode": "single_cell",
    "hasMoreRows": true
  }
}
```

### What's Included (Minimal):
✅ **Column schema** (IDs + names + types) - 200 tokens  
✅ **Focused cell** (1 cell only) - 50 tokens  
✅ **Row count** (for awareness) - 10 tokens  

**Total**: ~260 tokens (vs 5000+ tokens for 10 rows of data)

### What's NOT Included (Efficiency):
❌ No row data (unless explicitly requested)  
❌ No sample rows (unless summarization command)  
❌ No cell values (unless focused cell)  

---

## 🎯 Context Strategies by Command Type

### Strategy 1: **Single Cell Edit** (Most Common)
**User command**: "Update this cell to 75000"  
**Context sent**: Schema + focused cell only  
**Token usage**: ~260 tokens  

```json
{
  "content": {
    "schema": { "columns": [...] },
    "rowCount": 14,
    "focusedCell": {
      "rowId": "row_7",
      "columnId": "col_2",
      "currentValue": 50000
    }
  }
}
```

**AI Response**:
```json
{
  "action": "update_cell",
  "stackId": "107c8c18-...",
  "rowId": "row_7",
  "columnId": "6e2ffef7-...",
  "value": 75000
}
```

---

### Strategy 2: **Add New Row**
**User command**: "Add a new company Acme with revenue 100000"  
**Context sent**: Schema only (no row data needed)  
**Token usage**: ~200 tokens  

```json
{
  "content": {
    "schema": { "columns": [...] },
    "rowCount": 14
  }
}
```

**AI Response**:
```json
{
  "action": "add_row",
  "stackId": "107c8c18-...",
  "data": {
    "2e74e82c-...": "Acme",
    "6e2ffef7-...": 100000
  }
}
```

---

### Strategy 3: **Delete Row**
**User command**: "Delete this row"  
**Context sent**: Schema + focused row ID  
**Token usage**: ~220 tokens  

```json
{
  "content": {
    "schema": { "columns": [...] },
    "rowCount": 14,
    "focusedCell": {
      "rowId": "row_7"
    }
  }
}
```

**AI Response**:
```json
{
  "action": "delete_row",
  "stackId": "107c8c18-...",
  "rowId": "row_7"
}
```

---

### Strategy 4: **Summarization** (Only Case for Row Data)
**User command**: "Summarize this stack"  
**Context sent**: Schema + sample rows (5-10 rows)  
**Token usage**: ~2000 tokens  

```json
{
  "content": {
    "schema": { "columns": [...] },
    "rowCount": 14,
    "sampleRows": [
      { "id": "row_1", "data": {...} },
      { "id": "row_2", "data": {...} }
    ]
  }
}
```

**AI Response**:
```json
{
  "action": "summary",
  "content": "This stack contains 14 companies with total revenue of $1.2M..."
}
```

---

### Strategy 5: **Bulk Update** (Explicit Request)
**User command**: "Increase all revenue by 10%"  
**Context sent**: Schema + ALL rows (user explicitly requests bulk operation)  
**Token usage**: ~5000 tokens  

```json
{
  "content": {
    "schema": { "columns": [...] },
    "rows": [...],  // All 14 rows
    "rowCount": 14
  }
}
```

**AI Response**:
```json
{
  "action": "bulk_update",
  "stackId": "107c8c18-...",
  "updates": [
    { "rowId": "row_1", "columnId": "col_2", "value": 55000 },
    { "rowId": "row_2", "columnId": "col_2", "value": 82500 }
  ]
}
```

---

## 🏗️ Implementation Design

### Step 1: Detect Command Type (Frontend)

```typescript
// lib/contextPacker.ts

type CommandType = 
  | "single_edit"    // "update this cell"
  | "add_row"        // "add a new row"
  | "delete_row"      // "delete this row"
  | "summarize"       // "summarize this stack"
  | "bulk_update"     // "update all rows"
  | "unknown";

function detectCommandType(transcript: string): CommandType {
  const lower = transcript.toLowerCase();
  
  if (lower.includes("summarize") || lower.includes("summary")) {
    return "summarize";
  }
  
  if (lower.includes("all") || lower.includes("every")) {
    return "bulk_update";
  }
  
  if (lower.includes("delete") || lower.includes("remove")) {
    return "delete_row";
  }
  
  if (lower.includes("add") || lower.includes("new") || lower.includes("create")) {
    return "add_row";
  }
  
  if (lower.includes("update") || lower.includes("change") || lower.includes("set")) {
    return "single_edit";
  }
  
  return "unknown";
}
```

---

### Step 2: Pack Context Based on Command Type

```typescript
// lib/contextPacker.ts

private async buildStackContextItem(
  stack: Stack,
  transcript: string  // Add this parameter
): Promise<ContextItem> {
  const commandType = detectCommandType(transcript);
  
  // Base context (always included)
  const content: any = {
    schema: {
      columns: stack.columns,
    },
    rowCount: stack.rows?.length || 0,
  };
  
  // Add focused cell (for single edit/delete)
  if (commandType === "single_edit" || commandType === "delete_row") {
    if (this.store.focusedRowId && this.store.focusedColumnId) {
      const focusedRow = stack.rows.find(r => r.id === this.store.focusedRowId);
      content.focusedCell = {
        rowId: this.store.focusedRowId,
        columnId: this.store.focusedColumnId,
        currentValue: focusedRow?.data[this.store.focusedColumnId],
      };
    }
  }
  
  // Add sample rows (for summarization)
  if (commandType === "summarize") {
    content.sampleRows = (stack.rows || []).slice(0, 10);
  }
  
  // Add all rows (for bulk update)
  if (commandType === "bulk_update") {
    content.rows = stack.rows;
  }
  
  return {
    type: "STACK",
    id: stack.id,
    title: stack.name,
    source: "active_tab",
    content,
    metadata: {
      commandType,
      editMode: commandType === "single_edit" ? "single_cell" : "multiple",
    },
  };
}
```

---

### Step 3: Update API Call to Include Transcript

```typescript
// components/shared/PushToTalk.tsx

const handleTranscriptReady = async (transcript: string) => {
  // ... existing code
  
  // Pass transcript to context packer
  const packedContext = await packer.pack({
    tabIds,
    mentions: mentions.length > 0 ? mentions : undefined,
    transcript,  // ← Add this
  });
  
  // ... rest of code
};
```

```typescript
// components/workspace/ChatSidebar.tsx

const sendMessage = async (content: string) => {
  // ... existing code
  
  // Pass content to context packer
  const packedContext = await getCurrentContext(content);
  
  // ... rest of code
};
```

---

### Step 4: Update ContextPacker.pack() Method

```typescript
// lib/contextPacker.ts

async pack(
  options: {
    tabIds?: string[];
    mentions?: string[];
    includeRecent?: boolean;
    transcript?: string;  // ← Add this
  },
  packerOptions?: ContextPackerOptions
): Promise<PackedContext> {
  const opts = { ...DEFAULT_OPTIONS, ...packerOptions };
  const items: ContextItem[] = [];
  const seenIds = new Set<string>();
  
  // ... existing code for tabIds and mentions...
  
  // When building context items, pass transcript
  if (options.tabIds && options.tabIds.length > 0) {
    const tabItems = await this.packFromTabs(options.tabIds, options.transcript);
    // ...
  }
  
  // ...
}

private async packFromTabs(tabIds: string[], transcript?: string): Promise<ContextItem[]> {
  // ...
  
  for (const tabId of tabIds) {
    const tab = openTabs.find((t) => t.id === tabId);
    if (!tab) continue;
    
    const item = await this.buildContextItem(tab.type, tab.id, tab.title, "active_tab", transcript);
    // ...
  }
  
  // ...
}

private async buildContextItem(
  type: string,
  id: string,
  title: string,
  source: ContextSource,
  transcript?: string  // ← Add this
): Promise<ContextItem | null> {
  // ...
  
  switch (type) {
    case "STACK": {
      const stack = stacks.find((s) => s.id === id);
      if (!stack) return null;
      
      // Pass transcript to determine command type
      return await this.buildStackContextItem(stack, transcript || "");
    }
    
    // ... other types ...
  }
}
```

---

## 📊 Token Usage Comparison

### Current Design (Inefficient):
```
Stack with 14 rows, 8 columns:
  - Rows included: 10
  - Cells: 10 × 8 = 80 cells
  - Token usage: ~5000 tokens
  - Waste: 98% (only need 1 cell for most commands)
```

### New Design (Ultra-Efficient):
```
Stack with 14 rows, 8 columns:
  
  Command: "Update this cell" (single_edit)
    - Rows included: 0 (only focused cell)
    - Cells: 1 cell
    - Token usage: ~260 tokens
    - Savings: 95%
  
  Command: "Add a new row" (add_row)
    - Rows included: 0
    - Cells: 0
    - Token usage: ~200 tokens
    - Savings: 96%
  
  Command: "Summarize this stack" (summarize)
    - Rows included: 10 (sample)
    - Cells: 10 × 8 = 80 cells
    - Token usage: ~2000 tokens
    - Savings: 60%
  
  Command: "Update all revenue" (bulk_update)
    - Rows included: 14 (all)
    - Cells: 14 × 8 = 112 cells
    - Token usage: ~5000 tokens
    - Savings: 0% (need all data)
```

**Average Savings**: ~80-90% token reduction for most commands!

---

## 🔄 Two-Phase Approach (Advanced)

For even more efficiency, implement **context negotiation**:

### Phase 1: Send Minimal Context
```json
{
  "type": "STACK",
  "content": {
    "schema": {...},
    "rowCount": 14
  }
}
```

### Phase 2: AI Requests More Context (If Needed)
```json
{
  "action": "request_more_context",
  "reason": "Need to see sample rows for summarization",
  "contextType": "sample_rows",
  "rowCount": 5
}
```

### Phase 3: Frontend Sends Requested Context
```json
{
  "type": "STACK",
  "content": {
    "schema": {...},
    "sampleRows": [...]
  }
}
```

This adds latency but saves massive tokens for rare commands.

---

## ✅ Benefits of This Design

### 1. **Ultra-Low Token Usage**
- 95% reduction for single-cell edits
- 96% reduction for add/delete row
- Only send data when absolutely necessary

### 2. **Precise Edits**
- AI knows exactly which cell to update (via `focusedCell`)
- No ambiguity about row/column IDs

### 3. **Scalable**
- Works for 14 rows or 14,000 rows (schema is always small)
- Only send row data when user requests bulk operations

### 4. **Fast AI Processing**
- Less data = faster inference
- Lower latency for voice commands

### 5. **Cost Effective**
- 80-90% reduction in API costs
- Pay only for necessary context

---

## 🚀 Implementation Priority

### Priority 1 (This Week):
1. ✅ Implement `detectCommandType()` function
2. ✅ Update `buildStackContextItem()` to pack minimal context
3. ✅ Add `focusedCell` tracking to store
4. ✅ Test with single-cell edit commands

### Priority 2 (Next Week):
1. ✅ Add support for `summarize` command (send sample rows)
2. ✅ Add support for `bulk_update` command (send all rows)
3. ✅ Update FastAPI to handle new context structure

### Priority 3 (Future):
1. ✅ Implement two-phase context negotiation
2. ✅ Add semantic search for large stacks
3. ✅ Optimize for 1000+ row stacks

---

## 📝 Example Conversations

### Example 1: Single Cell Edit
```
User: "Update this cell to 75000"
Context sent: Schema + focused cell (260 tokens)
AI response: { "action": "update_cell", "rowId": "...", "columnId": "...", "value": 75000 }
Result: ✅ Precise edit, ultra-fast
```

### Example 2: Add Row
```
User: "Add a new company called Acme with revenue 100000"
Context sent: Schema only (200 tokens)
AI response: { "action": "add_row", "data": {...} }
Result: ✅ New row added, no row data needed
```

### Example 3: Summarization
```
User: "Summarize this stack"
Context sent: Schema + 10 sample rows (2000 tokens)
AI response: { "action": "summary", "content": "..." }
Result: ✅ Good summary, reasonable token usage
```

### Example 4: Bulk Update
```
User: "Increase all revenue by 10%"
Context sent: Schema + all 14 rows (5000 tokens)
AI response: { "action": "bulk_update", "updates": [...] }
Result: ✅ Bulk update, necessary data sent
```

---

## 🔚 Conclusion

This design sends **minimal context** (schema + focused cell) for 90% of commands, and only sends row data when absolutely necessary (summarization, bulk updates).

**Expected Results**:
- ✅ 80-90% token reduction
- ✅ Faster AI processing
- ✅ Lower costs
- ✅ Precise edits (no ambiguity)
- ✅ Scalable to 1000+ row stacks

---

**End of Ultra-Efficient Design Document**
