"use client";

import { Milkdown, useEditor, useInstance } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { callCommand } from '@milkdown/utils';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  insertHrCommand,
  createCodeBlockCommand,
} from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code2,
  Table,
} from 'lucide-react';
import { useRef, useEffect } from 'react';
import { TextSelection } from 'prosemirror-state';
import { useWorkspaceStore } from "@/lib/store";
import * as Diff from 'diff';
import { adjustCursorPosition, applySuggestionPadding } from "@/lib/utils";

interface LiveEditorProps {
  noteId: string;
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MarkdownToolbar — Sticky formatting toolbar
// ═══════════════════════════════════════════════════════════════════════════
//
//  PURPOSE:
//    Persistent toolbar at the top of the editor so users can apply Markdown
//    formatting (headings, bold, lists, tables, etc.) without knowing the
//    raw syntax. Replaces the old floating TooltipMenu (removed 2026-06-14).
//
//  INTEGRATION:
//    Rendered inside <MilkdownProvider> but OUTSIDE the dimmed <div> in the
//    main LiveEditor return. This keeps it interactive even during AI
//    suggestion review (DiffOverlay). Uses useInstance() to access the
//    Milkdown editor — the editor ref is populated asynchronously by
//    EditorComponent's useEditor() hook, so get() may return undefined on
//    the very first render cycle (guarded in exec/handleLink).
//
//  DEPENDENCIES (DO NOT REMOVE without understanding the full chain):
//    - useInstance()         → React context from MilkdownProvider; provides
//                              get() to access the Milkdown Editor instance.
//    - editor.action(cb)     → Milkdown's wrapper: calls cb(this.#ctx)
//                              synchronously. Used to access editorViewCtx
//                              and to dispatch commands.
//    - callCommand(key,args) → from @milkdown/utils; returns (ctx)=>boolean.
//                              Resolves the command via commandsCtx.call().
//    - editorViewCtx         → Milkdown ctx slice holding the ProseMirror
//                              EditorView. The view.dispatch(tr) chain goes
//                              through ALL ProseMirror plugins including
//                              history (enabling Ctrl+Z undo).
//
//  CURSOR / FOCUS (critical for AI insert-at-cursor feature):
//    EditorComponent tracks cursor position via ProseMirror DOM events
//    (keyup/mouseup/blur) and writes to Zustand store (setCursorPosition).
//    The ChatSidebar reads cursorPosition to send with voice/AI requests.
//    DO NOT add blur-triggering side effects here — exec() explicitly
//    refocuses the editor when needed via view.focus() to keep keyboard
//    shortcuts working without disturbing cursor tracking.
//
//  BLOCK-LEVEL BUTTONS (headings, lists, blockquote, codeblock, hr, table):
//    Use onMouseDown + e.preventDefault() — same as inline buttons — to
//    prevent the editor from losing focus/selection before the command runs.
//    Milkdown commands (wrapInHeadingCommand, etc.) read from state.selection
//    which ProseMirror preserves even across blur events, but keeping focus
//    is safer and avoids visual flicker.
//
//  EXPORTED: This component is imported by the note page and rendered above
//    the title, outside LiveEditor's DOM tree. It must be inside a
//    <MilkdownProvider> (provided by the note page) for useInstance() to work.
// ═══════════════════════════════════════════════════════════════════════════

const btnBase =
  "p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-300 transition-colors focus:outline-none";
const divider = <div className="w-px h-4 bg-[#27272A]/30 mx-0.5" />;

export function MarkdownToolbar() {
  // ── useInstance(): [loading, getEditor] tuple ────────────────────
  // The editor ref is populated when EditorComponent's useEditor()
  // finishes creating the Milkdown instance. On first render get()
  // may return undefined — all handlers guard against this.
  //
  // IMPORTANT: This component MUST be rendered inside a <MilkdownProvider>
  // (provided by the note page) for useInstance() to resolve.
  const [, get] = useInstance();

  // ── exec(cmdKey, ...args) — central command dispatcher ───────────
  // Step 1: Ensure the ProseMirror editorView has focus so keyboard
  //         shortcuts (Ctrl+Z, Ctrl+B, etc.) work after toolbar use.
  // Step 2: Dispatch the Milkdown command via editor.action(callCommand()).
  //         This goes through commandsCtx.call() → command(state,dispatch,view)
  //         → view.dispatch(tr) → all ProseMirror plugins (history, etc.).
  //         Every call creates a history entry → fully undoable.
  const exec = (cmdKey: any, ...args: unknown[]) => {
    const editor = get();
    if (!editor) return;
    // Phase 1: focus check (must happen in same editor.action context
    // to access editorViewCtx; separate from command dispatch so focus
    // is restored even if the command is a no-op)
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (view && !view.hasFocus()) {
        view.focus();
      }
    });
    // Phase 2: dispatch the actual command
    editor.action(callCommand(cmdKey, ...args));
  };

  // ── handleLink() — custom link insertion/removal ─────────────────
  // Milkdown's toggleLinkCommand toggles a link mark on selection but
  // doesn't handle the "no selection" case (insert new linked text).
  // This handler covers all three scenarios:
  //   A) Selection + existing link  → remove the link mark
  //   B) Selection + no link        → prompt URL, add link mark
  //   C) No selection               → prompt text + URL, insert linked node
  // Uses view.dispatch() directly (not callCommand) because the link
  // mark payload (href) varies per interaction. Transactions dispatched
  // via view.dispatch() still pass through the history plugin.
  const handleLink = () => {
    const editor = get();
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (!view) return;
      if (!view.hasFocus()) {
        view.focus();
      }
      const { from, to, empty } = view.state.selection;
      const linkMarkType = view.state.schema.marks.link;

      if (!empty) {
        // Case A/B: text is selected
        const hasLink = view.state.doc.rangeHasMark(from, to, linkMarkType);
        if (hasLink) {
          // Case A: remove existing link
          view.dispatch(view.state.tr.removeMark(from, to, linkMarkType));
          return;
        }
        // Case B: add link to selection
        const url = window.prompt("Enter URL:", "https://");
        if (url) {
          view.dispatch(
            view.state.tr.addMark(from, to, linkMarkType.create({ href: url }))
          );
        }
      } else {
        // Case C: no selection — insert new linked text at cursor
        const text = window.prompt("Enter link text:", "");
        if (!text) return;
        const url = window.prompt("Enter URL:", "https://");
        if (!url) return;
        const linkMark = linkMarkType.create({ href: url });
        const linkNode = view.state.schema.text(text, [linkMark]);
        view.dispatch(view.state.tr.insert(from, linkNode));
      }
    });
  };

  return (
    <div className="sticky top-0 z-20 flex items-center gap-0 bg-transparent border-b border-[#27272A]/20 px-2 py-0.5 overflow-x-auto select-none">
      {/* ── Headings ── */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInHeadingCommand.key, 1);
        }}
        title="Heading 1"
        className={btnBase}
      >
        <Heading1 size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInHeadingCommand.key, 2);
        }}
        title="Heading 2"
        className={btnBase}
      >
        <Heading2 size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInHeadingCommand.key, 3);
        }}
        title="Heading 3"
        className={btnBase}
      >
        <Heading3 size={17} />
      </button>

      {divider}

      {/* ── Inline formatting ── */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(toggleStrongCommand.key);
        }}
        title="Bold"
        className={btnBase}
      >
        <Bold size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(toggleEmphasisCommand.key);
        }}
        title="Italic"
        className={btnBase}
      >
        <Italic size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(toggleStrikethroughCommand.key);
        }}
        title="Strikethrough"
        className={btnBase}
      >
        <Strikethrough size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(toggleInlineCodeCommand.key);
        }}
        title="Inline code"
        className={btnBase}
      >
        <Code size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          handleLink();
        }}
        title="Link"
        className={btnBase}
      >
        <LinkIcon size={17} />
      </button>

      {divider}

      {/* ── Block elements ── */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInBlockquoteCommand.key);
        }}
        title="Blockquote"
        className={btnBase}
      >
        <Quote size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInBulletListCommand.key);
        }}
        title="Bullet list"
        className={btnBase}
      >
        <List size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(wrapInOrderedListCommand.key);
        }}
        title="Ordered list"
        className={btnBase}
      >
        <ListOrdered size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(createCodeBlockCommand.key);
        }}
        title="Code block"
        className={btnBase}
      >
        <Code2 size={17} />
      </button>

      {divider}

      {/* ── Insert ── */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(insertHrCommand.key);
        }}
        title="Horizontal rule"
        className={btnBase}
      >
        <Minus size={17} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          exec(insertTableCommand.key);
        }}
        title="Insert table"
        className={btnBase}
      >
        <Table size={16} />
      </button>
    </div>
  );
};

const EditorComponent = ({ content, noteId }: { content: string; noteId: string }) => {
  // ═══════════════════════════════════════════════════════════════════
  //  EditorComponent — Milkdown editor lifecycle + cursor tracking
  // ═══════════════════════════════════════════════════════════════════
  //
  //  CURSOR TRACKING (DO NOT REMOVE — used by AI insert-at-cursor):
  //    latestCursorPos ref + DOM event listeners (keyup/mouseup/blur)
  //    feed cursorPosition into Zustand store (setCursorPosition).
  //    ChatSidebar reads cursorPosition → sends to voice/AI API →
  //    UniversalConfirmationToast inserts AI response at cursor.
  //    The cursor restore effect (restoredOnce) re-applies cursor
  //    position after note-switch key-based remounts.
  //
  //  AUTOSAVE (listenerCtx.markdownUpdated):
  //    1-second debounce. Blocked during voice mutation
  //    (isEntityVoiceMutating) to prevent overwriting AI edits.
  // ═══════════════════════════════════════════════════════════════════
  const { setIsSaving, isEntityVoiceMutating, optimisticPatchNote, cursorPosition, setCursorPosition } = useWorkspaceStore();
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const isFirstMount = useRef(true);

  // Ref to hold the latest ProseMirror selection position (survives across renders)
  const latestCursorPos = useRef<number>(cursorPosition);
  const restoredOnce = useRef(false);

  // ─── Get editor instance ─────────────────────────────────────────
  const [, getEditor] = useInstance();

  // ─── Restore cursor after editor is ready ────────────────────────
  // With key-based remounting, defaultValueCtx handles content loading.
  // This effect only needs to restore the cursor position.
  //
  // NOTE FOR AGENTS: This is part of the AI insert-at-cursor pipeline.
  // cursorPosition (Zustand) → ChatSidebar sends to voice API →
  // AI response inserted at that position. Do not remove this effect
  // or change the position tracking without updating the full chain.
  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;

    // Poll until the editor is available (Milkdown creates it asynchronously)
    let attempts = 0;
    const maxAttempts = 30; // 30 × 100ms = 3s max wait
    const timer = setInterval(() => {
      const editor = getEditor();
      attempts++;

      if (editor) {
        clearInterval(timer);

        // Restore saved cursor position
        const savedPos = cursorPosition;
        if (savedPos > 0) {
          try {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              if (!view) return;
              const docSize = view.state.doc.content.size;
              const pos = Math.min(savedPos, docSize);
              view.dispatch(
                view.state.tr.setSelection(
                  TextSelection.create(view.state.doc, pos)
                )
              );
            });
          } catch (e) {
            console.warn('[LiveEditor] Failed to restore cursor:', e);
          }
        }
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.warn('[LiveEditor] Timed out waiting for editor');
      }
    }, 100);

    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Track cursor position via ProseMirror view ──────────────────
  // Instead of a raw ProseMirror Plugin (which can conflict with Milkdown),
  // we access the view directly through editorViewCtx and set up event listeners.
  //
  // NOTE FOR AGENTS: latestCursorPos → setCursorPosition → Zustand store.
  // This is the SOURCE of cursorPosition used by ChatSidebar for AI voice
  // insert-at-cursor. The handleBlur listener captures position on blur
  // so the cursor is known even when the user clicks away to use chat.
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupCursorTracking = () => {
      const editor = getEditor();
      if (!editor) return false;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (!view) return;

          // Track cursor on selection change
          const handleSelectionChange = () => {
            const pos = view.state.selection.$head.pos;
            latestCursorPos.current = pos;
            setCursorPosition(pos);
          };

          // Track cursor on blur
          const handleBlur = () => {
            const pos = view.state.selection.$head.pos;
            latestCursorPos.current = pos;
            setCursorPosition(pos);
          };

          view.dom.addEventListener('keyup', handleSelectionChange);
          view.dom.addEventListener('mouseup', handleSelectionChange);
          view.dom.addEventListener('blur', handleBlur);

          cleanup = () => {
            view.dom.removeEventListener('keyup', handleSelectionChange);
            view.dom.removeEventListener('mouseup', handleSelectionChange);
            view.dom.removeEventListener('blur', handleBlur);
          };
        });
        return true;
      } catch (e) {
        console.warn('[LiveEditor] Failed to setup cursor tracking:', e);
        return false;
      }
    };

    // Poll until editor is ready
    let attempts = 0;
    const maxAttempts = 30;
    const timer = setInterval(() => {
      attempts++;
      if (setupCursorTracking() || attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(timer);
      cleanup?.();
    };
  }, [getEditor, setCursorPosition]);

  // ─── Milkdown editor ─────────────────────────────────────────────
  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        root.className = 'ProseMirror-container px-4 py-2 text-white';
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
          }

          if (isEntityVoiceMutating(noteId)) return; // block autosave while voice is processing

          setIsSaving(true);

          if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
          }

          autoSaveTimer.current = setTimeout(async () => {
            optimisticPatchNote(noteId, { content: markdown });
            setIsSaving(false);
          }, 1000);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener);
  }, [noteId]);

  return (
    <Milkdown />
  );
};

// ─── Visual Diff Overlay ─────────────────────────────────────────────────
// Shows ONLY changed regions (not the entire note) with inline highlighting.
// Uses line-level diff for better markdown readability.

interface DiffOverlayProps {
  originalContent: string;
  newContent: string;
}

const DiffOverlay = ({ originalContent, newContent }: DiffOverlayProps) => {
  // Use line-level diff for markdown — word-level splits markdown syntax tokens
  const diffs = Diff.diffLines(originalContent, newContent);

  // Count statistics
  let addedLines = 0;
  let removedLines = 0;
  diffs.forEach((part) => {
    const lines = part.value.split("\n").filter((l) => l.length > 0);
    if (part.added) addedLines += lines.length;
    if (part.removed) removedLines += lines.length;
  });

  // Filter to only show changed regions (context of 1 unchanged line around changes)
  const visibleDiffs: (Diff.Change & { skipped?: boolean })[] = [];
  for (let i = 0; i < diffs.length; i++) {
    const part = diffs[i];
    const hasChanges = part.added || part.removed;
    const prevChanged = i > 0 && (diffs[i - 1].added || diffs[i - 1].removed);
    const nextChanged = i < diffs.length - 1 && (diffs[i + 1].added || diffs[i + 1].removed);

    if (hasChanges || prevChanged || nextChanged) {
      visibleDiffs.push(part);
    } else if (visibleDiffs.length > 0 && !visibleDiffs[visibleDiffs.length - 1].skipped) {
      // Add a skip marker between distant changed regions
      visibleDiffs.push({ ...part, value: "", added: undefined, removed: undefined, skipped: true } as any);
    }
  }

  return (
    <div className="absolute inset-0 bg-[#0E0E0E]/95 overflow-y-auto px-4 py-3 z-10 font-sans select-text">
      {/* Summary header */}
      <div className="sticky top-0 bg-[#131313] border border-[#10B981]/30 px-3 py-2 mb-3 flex items-center gap-3 text-xs z-20">
        <span className="relative flex h-2 w-2">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
        </span>
        <span className="text-[#10B981] font-mono font-semibold tracking-wider uppercase">
          AI SUGGESTION
        </span>
        <span className="text-zinc-500 font-technical">
          <span className="text-[#10B981]">+{addedLines}</span> / <span className="text-[#EF4444]">-{removedLines}</span> lines changed
        </span>
      </div>

      {/* Diff content — only changed regions */}
      <div className="space-y-0 font-mono text-sm leading-relaxed">
        {visibleDiffs.map((part, index) => {
          if ((part as any).skipped) {
            return (
              <div key={index} className="text-zinc-600 text-center py-1 select-none">
                ···
              </div>
            );
          }

          const lines = part.value.split("\n");
          return lines.filter((l) => l.length > 0 || part.added || part.removed).map((line, lineIdx) => {
            const key = `${index}-${lineIdx}`;
            if (part.added) {
              return (
                <div key={key} className="bg-[#10B981]/10 border-l-2 border-[#10B981] pl-3 pr-2 py-0.5 text-[#10B981]">
                  + {line}
                </div>
              );
            }
            if (part.removed) {
              return (
                <div key={key} className="bg-[#EF4444]/10 border-l-2 border-[#EF4444] pl-3 pr-2 py-0.5 text-[#EF4444] line-through">
                  - {line}
                </div>
              );
            }
            return (
              <div key={key} className="pl-3 pr-2 py-0.5 text-zinc-500 border-l-2 border-transparent">
                &nbsp;&nbsp;{line}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};

// ─── Main LiveEditor ───────────────────────────────────────────────────
//
//  STRUCTURE (important for understanding z-index / sticky / dimming):
//    <div.prose relative>           ← scroll container, positioning context
//      {DiffOverlay absolute z-10}  ← shown during pending AI mutations
//      <div dimmed?>                ← only wraps EditorComponent
//        <EditorComponent>          ← Milkdown editor + cursor tracking
//      </div>
//    </div>
//
//  NOTE: MarkdownToolbar + MilkdownProvider are now rendered in the
//  note page (app/(workspace)/workspace/notes/[id]/page.tsx) so the
//  toolbar sits ABOVE the title. The provider wraps both toolbar and
//  LiveEditor there.
// ═══════════════════════════════════════════════════════════════════════════

export default function LiveEditor({ noteId, content }: LiveEditorProps) {
  const { pendingMutation } = useWorkspaceStore();
  const isPending = pendingMutation?.type === "update_note" && pendingMutation.noteId === noteId;

  const getProposedContent = () => {
    if (!pendingMutation || pendingMutation.type !== "update_note") return "";
    const { originalContent, diff } = pendingMutation;
    const guardPos = adjustCursorPosition(originalContent, diff.cursor_position);
    const { paddedSuggestion, adjustedPos } = applySuggestionPadding(
      originalContent,
      guardPos,
      diff.content_to_insert
    );
    return (
      originalContent.slice(0, adjustedPos) +
      paddedSuggestion +
      originalContent.slice(adjustedPos)
    );
  };

  return (
    <div className="prose prose-invert prose-lg max-w-none w-full bg-transparent text-slate-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none focus:[&_.ProseMirror]:outline-none focus:[&_.ProseMirror]:ring-0 focus-visible:[&_.ProseMirror]:outline-none focus-visible:[&_.ProseMirror]:ring-0 pb-64 relative min-h-[500px]" 
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {isPending && pendingMutation.type === "update_note" && (
        <DiffOverlay
          originalContent={pendingMutation.originalContent}
          newContent={getProposedContent()}
        />
      )}

      <div className={isPending ? "opacity-30 pointer-events-none select-none" : ""}>
        {/* Key-based remounting ensures editor always picks up latest content via defaultValueCtx.
            Cursor position is tracked via DOM events + Zustand store, so it survives remounts. */}
        <EditorComponent key={`active-${noteId}`} content={content} noteId={noteId} />
      </div>
    </div>
  );
}
