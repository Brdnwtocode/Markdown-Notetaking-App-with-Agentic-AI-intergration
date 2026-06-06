# Context Grabber - Scalable Design Recommendation

**Date**: June 6, 2026  
**Status**: Design Proposal  
**Author**: AI Coding Agent

---

## 🔍 Current Design Issues (Based on Your Example)

### What Your Current Output Looks Like:
```json
{
  "type": "STACK",
  "id": "107c8c18-9ce0-4e15-ad77-1ffae69934eb",
  "title": "asd",
  "source": "active_tab",
  "content": "{\"name\":\"asd\",\"columns\":[...],\"rowCount\":14}",
  "metadata": {
    "columnCount": 8,
    "rowCount": 14
  }
}
```

### Critical Problems:
1. ❌ **No Row Data**: You have 14 rows but NONE are included in context
2. ❌ **Stringified JSON**: `content` is a string, not parsed JSON (hard for AI to parse)
3. ❌ **Missing Cell IDs**: Can't update specific cells without column IDs
4. ❌ **No Focused Row**: Don't know which row the user is working on
5. ❌ **Redundant Metadata**: `columnCount` and `rowCount` are duplicated
6. ❌ **Not Scalable**: If you have 1000 rows, this will blow up token limits

---

## 🎯 Design Principles for Scalable Context

### Principle 1: **Minimal Viable Context**
Only send what the AI needs to fulfill the user's request.

### Principle 2: **Precision Over Completeness**
Include IDs and positions for precise edits, not just data.

### Principle 3: **Scalable Pagination**
For large datasets (100+ rows), send summary + sample rows + focused row.

### Principle 4: **Clean Structure**
Use parsed JSON, not stringified strings. Make it easy for AI to parse.

---

## 📦 Recommended Data Structure

### For STACK Type (Scalable Design):

```json
{
  "type": "STACK",
  "id": "107c8c18-9ce0-4e15-ad77-1ffae69934eb",
  "title": "asd",
  "source": "active_tab",
  "content": {
    "name": "asd",
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
    ],
    "rows": [
      {
        "id": "row_1",
        "data": {
          "2e74e82c-a87c-4a63-846c-9a37c5b3c79a": "Acme Corp",
          "6e2ffef7-8fde-404d-aeb8-fe73b3c7ef09": 50000
        }
      },
      {
        "id": "row_2",
        "data": {
          "2e74e82c-a87c-4a63-846c-9a37c5b3c79a": "Globex",
          "6e2ffef7-8fde-404d-aeb8-fe73b3c7ef09": 75000
        }
      }
    ],
    "totalRowCount": 14,
    "includedRowCount": 2,
    "hasMoreRows": true
  },
  "metadata": {
    "focusedRowId": "row_2",
    "focusedColumnId": "6e2ffef7-8fde-404d-aeb8-fe73b3c7ef09",
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

### Key Improvements:
1. ✅ **Parsed JSON**: `content` is an object, not a string
2. ✅ **Row Data Included**: Actual rows with IDs and cell data
3. ✅ **Precision Data**: `focusedRowId` and `focusedColumnId` for edits
4. ✅ **Scalable**: `hasMoreRows` flag + pagination support
5. ✅ **Minimal Metadata**: Only what's needed for precision

---

## 🏗️ Scalable Architecture Design

### Layer 1: Context Packer (Frontend - `lib/contextPacker.ts`)

```typescript
// Scalable context packing with pagination
private async buildStackContextItem(
  stack: Stack,
  options: ContextPackerOptions = {}
): Promise<ContextItem> {
  const {
    maxRows = 10,           // Limit rows to prevent token overflow
    includeFocusedRow = true, // Always include the row user is editing
    includeSampleRows = true, // Include a few sample rows for context
  } = options;

  // Always include all columns (they're small)
  const columns = stack.columns;

  // Smart row selection for scalability
  let rowsToInclude: StackRow[] = [];

  // 1. Always include focused row (if user is editing a specific row)
  if (includeFocusedRow && this.store.focusedRowId) {
    const focusedRow = stack.rows.find(r => r.id === this.store.focusedRowId);
    if (focusedRow) rowsToInclude.push(focusedRow);
  }

  // 2. Include sample rows (first N rows for context)
  if (includeSampleRows && rowsToInclude.length < maxRows) {
    const remainingSlots = maxRows - rowsToInclude.length;
    const sampleRows = stack.rows
      .filter(r => r.id !== this.store.focusedRowId)
      .slice(0, remainingSlots);
    rowsToInclude.push(...sampleRows);
  }

  // 3. If still space, include more rows
  if (rowsToInclude.length < maxRows) {
    const remainingSlots = maxRows - rowsToInclude.length;
    const additionalRows = stack.rows
      .filter(r => !rowsToInclude.includes(r))
      .slice(0, remainingSlots);
    rowsToInclude.push(...additionalRows);
  }

  return {
    type: "STACK",
    id: stack.id,
    title: stack.name,
    source: "active_tab",
    content: {
      name: stack.name,
      columns: columns,              // Always include all columns
      rows: rowsToInclude,           // Smart selection (max 10 rows)
      totalRowCount: stack.rows.length,
      includedRowCount: rowsToInclude.length,
      hasMoreRows: stack.rows.length > maxRows,
    },
    metadata: {
      focusedRowId: this.store.focusedRowId || null,
      focusedColumnId: this.store.focusedColumnId || null,
      totalRowCount: stack.rows.length,
      includedRowCount: rowsToInclude.length,
    },
  };
}
```

### Layer 2: Context Enrichment (FastAPI - Optional)

```python
# FastAPI can further optimize context for token limits
def enrich_stack_context(context_item: dict, max_tokens: int = 4000) -> dict:
    """
    Further compact context if it exceeds token limits.
    """
    content = context_item["content"]
    
    # Estimate token count (rough: 1 token ≈ 4 chars)
    estimated_tokens = len(json.dumps(content)) / 4
    
    if estimated_tokens > max_tokens:
        # Strategy 1: Reduce sample rows
        if len(content["rows"]) > 5:
            content["rows"] = content["rows"][:5]
            content["includedRowCount"] = 5
            content["hasMoreRows"] = True
        
        # Strategy 2: Remove column descriptions (keep only IDs and names)
        if len(json.dumps(content)) / 4 > max_tokens:
            content["columns"] = [
                {"id": col["id"], "name": col["name"]}
                for col in content["columns"]
            ]
    
    return context_item
```

### Layer 3: AI Prompt Engineering

```
You are editing a stack table. Here's the context:

Stack: {title} (ID: {id})
Columns: {columns}
Total Rows: {totalRowCount} (showing {includedRowCount})

{focused_row_info}

Sample Rows:
{rows}

User command: "{transcript}"

Instructions:
1. If user says "update cell X", use the column ID and row ID from above
2. If user says "add a new row", create a new row with unique ID
3. If user says "delete row", use the row ID (not position)
4. Always return rowId and columnId in your response for precise updates
```

---

## 🚀 Implementation Plan

### Phase 1: Fix Immediate Issues (Week 1)

#### Task 1.1: Update `buildContextItem` for STACK Type
**File**: `lib/contextPacker.ts` (lines ~187-198)

**Current (Broken):**
```typescript
case "STACK": {
  const stack = stacks.find((s) => s.id === id);
  if (!stack) return null;
  base.content = JSON.stringify({
    name: stack.name,
    columns: stack.columns,
    rowCount: stack.rows?.length || 0,
  });
  base.metadata = {
    columnCount: stack.columns?.length || 0,
    rowCount: stack.rows?.length || 0,
  };
  break;
}
```

**Fixed (Scalable):**
```typescript
case "STACK": {
  const stack = stacks.find((s) => s.id === id);
  if (!stack) return null;
  
  // Smart row selection (max 10 rows for token limits)
  const MAX_ROWS = 10;
  let rowsToInclude = [...(stack.rows || [])];
  
  // Always include focused row first
  if (store.focusedRowId) {
    const focusedRow = rowsToInclude.find(r => r.id === store.focusedRowId);
    if (focusedRow) {
      rowsToInclude = [
        focusedRow,
        ...rowsToInclude.filter(r => r.id !== store.focusedRowId)
      ].slice(0, MAX_ROWS);
    }
  }
  
  // Limit to MAX_ROWS
  rowsToInclude = rowsToInclude.slice(0, MAX_ROWS);
  
  base.content = {
    name: stack.name,
    columns: stack.columns,          // Always include all columns
    rows: rowsToInclude,             // Smart selection
    totalRowCount: stack.rows?.length || 0,
    includedRowCount: rowsToInclude.length,
    hasMoreRows: (stack.rows?.length || 0) > MAX_ROWS,
  };
  
  base.metadata = {
    focusedRowId: store.focusedRowId || null,
    focusedColumnId: store.focusedColumnId || null,
    totalRowCount: stack.rows?.length || 0,
  };
  
  break;
}
```

#### Task 1.2: Add Focused Row/Column Tracking to Store
**File**: `lib/slices/stacksSlice.ts`

**Add to store:**
```typescript
export interface StacksSlice {
  // ... existing fields
  
  // Track focused row/column for precision edits
  focusedRowId: string | null;
  focusedColumnId: string | null;
  setFocusedRow: (rowId: string | null) => void;
  setFocusedColumn: (columnId: string | null) => void;
}

// Implementation
focusedRowId: null,
focusedColumnId: null,
setFocusedRow: (rowId) => set({ focusedRowId: rowId }),
setFocusedColumn: (columnId) => set({ focusedColumnId: columnId }),
```

#### Task 1.3: Update UI to Track Focused Row/Column
**File**: `components/workspace/StackTable.tsx`

**Add click handlers:**
```typescript
// When user clicks on a row
const handleRowClick = (rowId: string) => {
  setFocusedRow(rowId);
};

// When user focuses on a cell (column)
const handleCellFocus = (rowId: string, columnId: string) => {
  setFocusedRow(rowId);
  setFocusedColumn(columnId);
};
```

---

### Phase 2: Optimize for Token Limits (Week 2)

#### Task 2.1: Add Token Estimation
**File**: `lib/contextPacker.ts`

**Add helper:**
```typescript
// Rough token estimation (1 token ≈ 4 chars for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Check if context exceeds token limit
function isContextTooLarge(context: PackedContext, maxTokens: number = 16000): boolean {
  const jsonString = JSON.stringify(context);
  return estimateTokens(jsonString) > maxTokens;
}
```

#### Task 2.2: Implement Smart Truncation
**File**: `lib/contextPacker.ts`

**Add truncation logic:**
```typescript
async pack(options, packerOptions): Promise<PackedContext> {
  let packed = await this.packFull(options, packerOptions);
  
  // If context is too large, truncate
  if (isContextTooLarge(packed)) {
    packed = this.truncateContext(packed);
  }
  
  return packed;
}

private truncateContext(context: PackedContext): PackedContext {
  // Strategy 1: Reduce rows per stack to 5
  context.items = context.items.map(item => {
    if (item.type === "STACK" && item.content.rows) {
      item.content.rows = item.content.rows.slice(0, 5);
      item.content.includedRowCount = 5;
      item.content.hasMoreRows = item.content.totalRowCount > 5;
    }
    return item;
  });
  
  return context;
}
```

---

### Phase 3: FastAPI Enrichment (Week 3)

#### Task 3.1: Update FastAPI to Process Stack Context
**File**: FastAPI microservice (not in this repo)

**Add endpoint:**
```python
@app.post("/api/v1/context/enrich")
async def enrich_context(packed_context: dict, max_tokens: int = 4000):
    """
    Enrich and optimize context for token limits.
    """
    enriched_items = []
    
    for item in packed_context.get("items", []):
        if item["type"] == "STACK":
            item = enrich_stack_context(item, max_tokens)
        enriched_items.append(item)
    
    return {
        "items": enriched_items,
        "packedAt": packed_context["packedAt"],
        "totalItems": len(enriched_items),
    }

def enrich_stack_context(item: dict, max_tokens: int) -> dict:
    # Remove unnecessary column metadata
    if "content" in item and "columns" in item["content"]:
        item["content"]["columns"] = [
            {"id": col["id"], "name": col["name"]}
            for col in item["content"]["columns"]
        ]
    
    return item
```

---

## 📊 Scalability Comparison

### Current Design (Broken):
```
Stack with 1000 rows:
  - Rows included: 0 ❌
  - Token usage: ~500 tokens (columns only)
  - Can AI edit cells? NO ❌
  - Scalable? NO ❌
```

### Recommended Design (Scalable):
```
Stack with 1000 rows:
  - Rows included: 10 (focused + 9 samples) ✅
  - Token usage: ~2000 tokens (estimated)
  - Can AI edit cells? YES ✅
  - Scalable? YES ✅ (always ≤10 rows)
```

---

## 🎨 UI/UX Considerations

### Show Context Summary in Chat
When user sends a voice/text command, show what context was grabbed:

```
📎 Context (1 item):
  📊 Stack: "asd" (14 rows, showing 10)
    Focused Row: Row 2
    Columns: Name, Revenue, Date, ...
```

### Allow User to Expand Context
```
[Button] "Include more rows" → Sends another request with `maxRows=50`
[Button] "Include all rows" → Sends full context (warning: high token usage)
```

---

## 🔮 Future Enhancements

### Enhancement 1: Semantic Search in Stack
For very large stacks (10,000+ rows), implement semantic search:
```
User: "Find rows where Revenue > 100000"
AI: Searches stack, returns matching row IDs
```

### Enhancement 2: Lazy Loading
Load rows on-demand:
```
User: "Update row 500"
AI: Requests row 500 from frontend
Frontend: Sends row 500 data
```

### Enhancement 3: Column Selection
Let user choose which columns to include in context:
```
User: "Only include Name and Revenue columns"
AI: Filters columns in context
```

---

## ✅ Actionable Next Steps

### Immediate (This Week):
1. ✅ Update `buildContextItem` for STACK to include row data
2. ✅ Add `focusedRowId` and `focusedColumnId` to store
3. ✅ Update `StackTable.tsx` to track focused row/column
4. ✅ Fix `content` to be parsed JSON (not stringified)

### Short Term (Next Week):
1. ✅ Add token estimation and truncation logic
2. ✅ Test with stacks of 50+ rows
3. ✅ Update FastAPI to handle new context structure

### Long Term (Next Month):
1. ✅ Implement semantic search for large stacks
2. ✅ Add lazy loading for 1000+ row stacks
3. ✅ Allow user to customize context (which rows/columns to include)

---

## 📝 Summary

Your current Context Grabber **doesn't include row data** for stacks, making it impossible for the AI to perform precise edits like "update cell X in row Y".

### The fix is straightforward:
1. **Include row data** in `content.rows` (with IDs)
2. **Track focused row/column** for precision
3. **Limit rows to 10** for token scalability
4. **Use parsed JSON** (not stringified strings)

### Expected improvements:
- ✅ AI can now update specific cells
- ✅ Token usage stays under control (max 10 rows)
- ✅ Scales to 1000+ row stacks
- ✅ Clean, parseable JSON structure

---

**End of Design Document**
