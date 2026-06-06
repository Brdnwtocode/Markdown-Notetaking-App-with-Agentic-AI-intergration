As a user, when the AI proposes a modification to an existing note, I want to review
the change as an inline red/green diff and explicitly accept or discard it before
anything is written to the database.

## Acceptance Criteria (Updated with Codebase Details)
- The AI produces a proposed note which is stored using `stageMutation()` in `pendingMutationSlice` with `type: "update_note"`; the database is NOT mutated at this point.
- The note uses the existing `DiffOverlay` component in `LiveEditor.tsx`, which already implements diffing using the `diff` npm library (already installed: "diff": "^9.0.0") via `diff.diffWordsWithSpace()`.
- Deleted text is shown with red background + strikethrough; inserted text with green background. Unchanged text is unstyled (already implemented in DiffOverlay).
- Two explicit action buttons are rendered alongside the diff: "Accept" and "Discard" (already implemented in floating bottom bar).
- "Accept" calls `confirmMutation()` which writes the proposed string to the database via `/api/notes/${noteId}` (PUT) and collapses the diff view (already implemented).
- "Discard" calls `discardMutation()` which clears the pending mutation and restores the original note display (already implemented).
- The current code allows Enter/Escape keys to accept/discard; per original story requirements, we need to REMOVE this behavior so only explicit button clicks work.
- While the diff is pending, the note field is read-only (already implemented via opacity-0/pointer-events-none on the Milkdown editor).
- If the AI call fails or times out, no diff UI is shown and an error state is surfaced (use react-hot-toast).

## Out of Scope
- Multi-step / chained AI suggestions on the same note.
- Partial acceptance (accepting only some hunks).

## Technical Implementation Notes (Codebase Specific)
- Use existing Zustand store via `useWorkspaceStore()` to access and manage `pendingMutation` and `mutationStatus`.
- The note editor uses Milkdown, so when pending, the DiffOverlay covers it completely.
- No need to install new diff libraries; `diff` is already available.

--- 

As a user, when the AI proposes a new row to be added to a table, I want to preview
it as a distinct "ghost row" and explicitly accept or discard it before anything is
written to the database.

## Acceptance Criteria (Updated with Codebase Details)
- The AI produces a proposed row which is stored using `stageMutation()` in `pendingMutationSlice` with `type: "add_stack_row"`; the database is NOT mutated at this point.
- The ghost row is already implemented in `StackTable.tsx` as a yellow-tinted row (bg-yellow-900/30 border-yellow-700/50) with pending indicator.
- Sorting, filtering, and pagination (if any) treat the ghost row as a non-data row (already implemented: it's not part of the rows array so processedData doesn't include it).
- Two explicit action buttons are rendered in/near the ghost row: "Accept" and "Discard" (already implemented).
- "Accept" calls `confirmMutation()` which writes the row to the database via `/api/stacks/${stackId}/rows` (POST) and the row becomes normal (already implemented).
- "Discard" calls `discardMutation()` which clears the pending mutation and removes the ghost row (already implemented).
- The current code allows Enter/Escape keys to accept/discard; per original story requirements, we need to REMOVE this behavior so only explicit button clicks work.
- Only one ghost row may exist at a time per table instance; triggering a second AI suggestion while one is pending replaces the existing one (already handled by the store: stageMutation overwrites any existing pendingMutation).
- If the AI call fails or times out, no ghost row is shown and an error state is surfaced (use react-hot-toast).

## Out of Scope
- Ghost rows for bulk / multi-row AI additions.
- Inline editing of the ghost row's values before acceptance.

## Technical Implementation Notes (Codebase Specific)
- Use existing Zustand store via `useWorkspaceStore()` to access and manage `pendingMutation` and `mutationStatus`.
- The table component (`StackTable.tsx`) already has ghost row UI implemented.
- The stacks API is at `/api/stacks/[stackId]/rows`.