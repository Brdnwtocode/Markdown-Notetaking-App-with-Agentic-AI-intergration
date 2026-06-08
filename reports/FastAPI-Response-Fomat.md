Here's exactly what the NextJS app receives from `POST /api/v1/voice/process`:

### Update Note — success
```json
{
  "transcript": "thêm ghi chú cần review trước thứ 6 vào cuối",
  "action": "update_note",
  "success": true,
  "message": "Note update suggested",
  "updatedData": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "diff": {
      "action_type": "append",
      "content_to_insert": "Cần review trước thứ 6",
      "cursor_position": 842,
      "preview_surrounding": "…phiên họp lúc 5h chiều.││"
    }
  },
  "reply": null
}
```

### Add Stack Row — success
```json
{
  "transcript": "thêm dòng marketing budget 5000",
  "action": "add_stack_row",
  "success": true,
  "message": "Row suggested",
  "updatedData": {
    "id": "temp_row_1717800000000",
    "stackId": "550e8400-e29b-41d4-a716-446655440000",
    "suggestionType": "ghost_row",
    "columnOrder": [
      { "id": "col-uuid-1", "name": "Task", "type": "TEXT" },
      { "id": "col-uuid-2", "name": "Status", "type": "TEXT" }
    ],
    "data": {
      "col-uuid-1": "Marketing Budget",
      "col-uuid-2": "TODO"
    }
  },
  "reply": null
}
```

### Bulk Update Stack — success
```json
{
  "transcript": "đổi tất cả trạng thái thành done",
  "action": "bulk_update_stack",
  "success": true,
  "message": "Update suggested for 2 rows",
  "updatedData": {
    "stackId": "550e8400-e29b-41d4-a716-446655440000",
    "suggestionType": "cell_diff",
    "columnOrder": [
      { "id": "col-uuid-1", "name": "Task", "type": "TEXT" },
      { "id": "col-uuid-2", "name": "Status", "type": "TEXT" }
    ],
    "updates": [
      { "rowId": "row-uuid-1", "data": { "col-uuid-2": "DONE" } },
      { "rowId": "row-uuid-2", "data": { "col-uuid-2": "DONE" } }
    ]
  },
  "reply": null
}
```

### Update Cell — success
```json
{
  "transcript": "đổi ô này thành 5000",
  "action": "update_cell",
  "success": true,
  "message": "Cell edit suggested",
  "updatedData": {
    "stackId": "550e8400-e29b-41d4-a716-446655440000",
    "suggestionType": "cell_diff",
    "rowId": "row-uuid-1",
    "columnId": "col-uuid-2",
    "value": 5000
  },
  "reply": null
}
```

### Delete Row — success
```json
{
  "transcript": "xóa dòng này đi",
  "action": "delete_row",
  "success": true,
  "message": "Row deletion suggested",
  "updatedData": {
    "stackId": "550e8400-e29b-41d4-a716-446655440000",
    "suggestionType": "row_delete",
    "rowId": "row-uuid-1"
  },
  "reply": null
}
```

### Manage Tasks (create) — success
```json
{
  "transcript": "tạo task mua sữa ưu tiên cao hạn mai",
  "action": "manage_tasks",
  "success": true,
  "message": "Task creation suggested",
  "updatedData": {
    "suggestionType": "task_action",
    "action_type": "create",
    "title": "Mua sữa",
    "description": "Mua sữa tươi không đường",
    "priority": "HIGH",
    "dueDate": "2026-06-09T00:00:00Z"
  },
  "reply": null
}
```

### Manage Tasks (update) — success
```json
{
  "transcript": "đánh dấu task mua sữa là done",
  "action": "manage_tasks",
  "success": true,
  "message": "Task update suggested",
  "updatedData": {
    "suggestionType": "task_action",
    "action_type": "update",
    "task_id": "task-uuid-abc-123",
    "status": "DONE"
  },
  "reply": null
}
```

### Manage Tasks (delete) — success
```json
{
  "transcript": "xóa task mua sữa đi",
  "action": "manage_tasks",
  "success": true,
  "message": "Task deletion suggested",
  "updatedData": {
    "suggestionType": "task_action",
    "action_type": "delete",
    "task_id": "task-uuid-abc-123"
  },
  "reply": null
}
```

### Conversational (none) — success
```json
{
  "transcript": "cảm ơn nhé",
  "action": "none",
  "success": true,
  "message": null,
  "updatedData": null,
  "reply": "Không có gì! Bạn cần tôi giúp gì thêm không?"
}
```

### Error — blocked / bad request
```json
{
  "error": "Command not recognized as a workspace action."
}
```
> HTTP status: **400**