# Bug Report: LiveEditor Shows Blank Content (Only Title Visible)

## Symptom
When opening a Note in the workspace, only the title is rendered. The Milkdown editor area below the title is **empty/blank** — the note's markdown content does not appear.

## Root Cause Summary
The `LiveEditor.tsx` was recently refactored to add cursor-position tracking. The refactoring introduced **three interacting problems** that prevent the Milkdown editor from rendering content:

1. **Stable `key={noteId}`** replaced the old `key={isPending ? 'pending' : 'active-${noteId}'}`. The old key caused remounts (which destroyed cursor), but it also guaranteed the editor always picked up the latest `content` prop via `defaultValueCtx`. Now with a stable key, the editor is created ONCE per `noteId` — if `content` is empty at creation time, the editor stays empty forever unless the content-sync `useEffect` successfully updates it.

2. **Milkdown creates the editor asynchronously** — `useEditor()` does NOT set the editor into context synchronously. `useInstance().getEditor()` returns `undefined` on the first few effect runs. The polling `useEffect` (100ms interval, max 30 attempts) tries to wait for it, but there are edge cases where the timing still fails.

3. **The content-sync `useEffect` has `[content, getEditor]` deps** — `getEditor` (from `useInstance()`) may change reference and trigger re-runs that call `replaceAll(content)` before the editor is truly ready, potentially corrupting the editor's internal state.

## Expected Behavior
- When a note loads, the Milkdown editor should display the note's markdown content immediately.
- Cursor position should persist when the user clicks away to the AI chat sidebar or uses voice commands.
- Ghost suggestions (from voice commands) should show a diff overlay, and accepting should update the editor content without losing cursor.

## Files Involved

### Primary: `components/workspace/LiveEditor.tsx`
The entire file was modified. The `EditorComponent` inner component now includes:
- `cursorTrackerPlugin` — a raw ProseMirror `Plugin` that tracks `$head.pos`
- Polling `useEffect` — waits for Milkdown editor to become available, then syncs content + restores cursor
- Content-sync `useEffect` — watches `content` prop for external changes (ghost acceptance)
- Stable `key={noteId}` instead of the old toggling key

Full current file: `d:\SCHOOL\Year4\SEM2\KLTN\Markdown-Notetaking-App-with-Agentic-AI-intergration\components\workspace\LiveEditor.tsx`

### Supporting: Note page
`app\(workspace)\workspace\notes\[id]\page.tsx` — fetches the note, passes `note.content` as the `content` prop to `<LiveEditor>`.

### Supporting: Zustand store
- `lib/slices/uiSlice.ts` — `cursorPosition: number` + `setCursorPosition`
- `lib/slices/pendingMutationSlice.ts` — `PendingMutation` type has `update_note` variant with `diff: NoteDiff`

## Key Observations for Debugging

1. **Check browser console** for these warnings (they were added during the refactor):
   - `[LiveEditor] Timed out waiting for editor` — means the polling never found the editor
   - `[LiveEditor] Failed to sync initial content:` — means `replaceAll()` threw
   - `[LiveEditor] Failed to restore cursor:` — means cursor restoration threw
   - `[LiveEditor] Failed to sync external content:` — means external content sync threw

2. **Check if the `Milkdown` component renders at all** — inspect the DOM. The `<Milkdown />` component renders a `<div class="milkdown">` that ProseMirror attaches to. If this div is empty (no `.ProseMirror` child), the editor failed to initialize. If `.ProseMirror` exists but is empty, `defaultValueCtx` didn't work.

3. **Test removing `cursorTrackerPlugin`** — comment out `.use(cursorTrackerPlugin)` in the `useEditor` chain. If content appears after this, the raw ProseMirror `Plugin` is incompatible with this version of Milkdown.

4. **Test reverting to the old key pattern** — change `key={noteId}` back to `key={isPending ? 'pending' : 'active-${noteId}'}` in the main `LiveEditor` component. If content appears, the content-sync mechanism is broken.

## Potential Fixes to Try (in order of likelihood)

### Fix A: Revert to key-based remounting + keep cursor tracking
Keep the old key pattern (`isPending ? 'pending' : 'active-${noteId}'`) so the editor remounts and picks up content via `defaultValueCtx`. The cursor tracking (saving to Zustand on blur) and cursor restoration (in the polling `useEffect`) should then preserve cursor across remounts. Remove the content-sync `useEffect` (it's no longer needed since `defaultValueCtx` handles it).

### Fix B: Use `content` as a `useEditor` dependency
Change `useEditor` deps from `[noteId]` to `[noteId, content]`. This recreates the editor whenever content changes externally, but also on every autosave. To prevent that, debounce by comparing with `lastSavedMarkdown` ref and only recreating if the content change is external.

### Fix C: Fix the content-sync polling
The polling `useEffect` has `[]` deps and uses `contentRef` to read latest content. But the polling itself might not be reliable. Instead, use a callback ref pattern: when the editor DOM mounts, detect it via `MutationObserver` or a callback ref, then sync content.

### Fix D: Remove raw ProseMirror Plugin, use Milkdown's listener instead
Instead of `new Plugin({...})`, use Milkdown's existing `listener` plugin (already imported) to track cursor. The `listenerCtx` supports `markdownUpdated` — check if it also supports selection change events. Or use the ProseMirror view directly through `editorViewCtx` in a `useEffect`.

## Environment
- **Framework**: Next.js (App Router)
- **Editor**: Milkdown v7.x (React wrapper `@milkdown/react`)
- **State**: Zustand (`useWorkspaceStore`)
- **ProseMirror**: Bundled with Milkdown (`prosemirror-state`, `prosemirror-view`)
- **OS**: Windows
