# FastAPI Context Processing Contract

**Date**: June 2, 2026  
**Status**: Feature Request for FastAPI Microservice  
**Related Next.js Implementation**: `docs/Implementation Contracts/Context-Grabber-Implementation-Plan.md`

**⚠️ IMPORTANT RULE**: NO DB CONTACT FOR AI FEATURE - FastAPI must NOT access SQL/database directly. All data comes from the frontend.

---

## 🎯 **Feature Overview**

The Next.js frontend now sends `packed_context` (multiple context items) to the voice processing endpoint. The FastAPI microservice needs to be updated to:

1. Accept `packed_context` JSON in the voice process endpoint
2. Process/parse/format the context data provided by the frontend (NO database queries)
3. Pass all context items to the LLM for processing
4. Optionally compact or optimize context for LLM token limits

---

## 📦 **1. Updated Voice Process Endpoint**

### Endpoint: `POST /api/v1/voice/process`

**New Field in Request**:

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `packed_context` | string (JSON) | Optional | JSON string of packed context items (new) |
| `context_type` | string | Optional* | Single context type (legacy, fallback) |
| `context_id` | string | Optional* | Single context ID (legacy, fallback) |

*At least one of `packed_context` or (`context_type` + `context_id`) must be provided.

### `packed_context` JSON Structure:

```json
{
  "items": [
    {
      "type": "NOTE",
      "id": "uuid-string",
      "title": "Meeting Notes",
      "content": "Full note content...",
      "metadata": {
        "word_count": 500,
        "last_updated": "2026-06-02T10:30:00Z"
      },
      "source": "active_tab"
    },
    {
      "type": "STACK",
      "id": "uuid-string",
      "title": "Q1 Sales",
      "content": "{\"name\": \"Q1 Sales\", \"columns\": [...], \"rowCount\": 10}",
      "metadata": {
        "columnCount": 5,
        "rowCount": 10
      },
      "source": "user_mention"
    }
  ],
  "packedAt": "2026-06-02T10:30:00Z",
  "totalItems": 2
}
```

---

## 🔗 **2. Context Processing (No Database Access)**

### ⚠️ **NO DB CONTACT FOR AI FEATURE**
FastAPI must **NOT** query the database. All context data is provided by the frontend in the `packed_context` field.

### What FastAPI CAN do with the context:
1. **Parse/Format**: Restructure the context data for optimal LLM consumption
2. **Compact**: Truncate or summarize large content to fit LLM token limits
3. **Validate**: Check context items for required fields, warn about missing data
4. **Prioritize**: Reorder context items by relevance or source priority

### Example Processing (No DB):
```python
# Example: Compact context for LLM token limits
def process_context(packed_context: dict) -> dict:
    """
    Process context without DB access.
    - Truncate large content
    - Validate structure
    - Add processing metadata
    """
    processed_items = []
    for item in packed_context.get("items", []):
        # Validate required fields
        if not item.get("type") or not item.get("id"):
            continue
        
        # Compact content if too long (e.g., truncate to 2000 chars)
        if item.get("content") and len(item["content"]) > 2000:
            item["content"] = item["content"][:2000] + "...[truncated]"
            item["metadata"] = item.get("metadata", {})
            item["metadata"]["truncated"] = True
        
        # Add processing metadata
        item["metadata"] = item.get("metadata", {})
        item["metadata"]["processed_at"] = datetime.utcnow().isoformat()
        
        processed_items.append(item)
    
    return {
        "items": processed_items,
        "packedAt": packed_context.get("packedAt"),
        "totalItems": len(processed_items),
        "warnings": []  # Add any validation warnings
    }
```

---

## 🤖 **3. LLM Prompt Update**

When processing voice commands with multiple context items, the LLM prompt should be updated to:

```
You are the AI engine for a multimodal workspace. The user is dictating commands in Vietnamese or English.

Context materials provided (${contextCount} items):
${JSON.stringify(processedContext.items, null, 2)}

User's command (transcribed): "${transcript}"

Execute the user's intent by calling the appropriate tool. Consider all context materials when relevant.
Do not respond with conversational text.
```

**Note**: `processedContext` is the context after FastAPI processing (formatting/compaction) - NO database queries.

---

## 📝 **4. Implementation Notes for FastAPI Team**

**⚠️ CRITICAL RULE**: NO DB CONTACT FOR AI FEATURE - Do NOT query any database. All data comes from the frontend.

### Priority 1: Accept `packed_context` in voice process
- Parse `packed_context` JSON string from form data
- If present, use it instead of single `context_type`/`context_id`
- Process/format/compact the context data (NO database queries)
- Pass all context items to LLM

### Priority 2: Context Processing (No DB)
- Parse and validate the context structure
- Compact/truncate large content for LLM token limits
- Reorder or prioritize context items if needed
- Add processing metadata (NO database enrichment)

### What NOT to do:
- ❌ Do NOT query SQL/database for additional data
- ❌ Do NOT fetch "related materials" from DB
- ❌ Do NOT look up user history from DB
- ❌ Do NOT access Prisma, SQLAlchemy, or any DB ORM

### Backward Compatibility
- Keep supporting legacy `context_type` + `context_id` fields
- If both legacy and `packed_context` provided, prefer `packed_context`

---

## 🧪 **5. Testing Checklist**

- [ ] Voice command with single context (legacy) still works
- [ ] Voice command with multiple contexts (`packed_context`) works
- [ ] @mentions in transcript are correctly parsed and context is packed by frontend
- [ ] Context items limit (max 5) is respected by frontend
- [ ] FastAPI correctly processes/passes context without DB access
- [ ] Large content is properly truncated by FastAPI
- [ ] Invalid/missing context fields are handled gracefully with warnings

---

## 📞 **Contact**

For questions about the Next.js implementation, refer to:
- `lib/contextPacker.ts` - Context packing logic (frontend-only, no DB)
- `components/workspace/TabBar.tsx` - Multi-tab selection UI
- `components/workspace/ChatSidebar.tsx` - Context display in chat
- `components/shared/PushToTalk.tsx` - Voice command integration

---

## 🎯 **Summary for FastAPI Team**

### What you need to do:
1. **Accept `packed_context`** JSON in `/api/v1/voice/process`
2. **Process the context** (parse, validate, compact) - NO database queries
3. **Pass to LLM** - Include all context items in the prompt

### What you MUST NOT do:
- ❌ Query any database (SQL, NoSQL, etc.)
- ❌ Use Prisma, SQLAlchemy, or any DB ORM
- ❌ Fetch additional data from DB
- ❌ Access user history or related materials from DB

### What you CAN do:
- ✅ Parse and validate the JSON structure
- ✅ Truncate/compact large content for LLM token limits
- ✅ Reorder context items by priority
- ✅ Add processing metadata (timestamps, warnings, etc.)

---

**Next Steps**: FastAPI team to implement `packed_context` processing (Priority 1) with NO database access.
