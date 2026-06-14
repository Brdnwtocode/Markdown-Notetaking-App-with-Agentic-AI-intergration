"use client";

import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { tooltipFactory, TooltipProvider } from '@milkdown/plugin-tooltip';
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

const tooltip = tooltipFactory('Text');

interface LiveEditorProps {
  noteId: string;
  content: string;
}

const TooltipMenu = ({ toolbarRef }: { toolbarRef: React.RefObject<HTMLDivElement> }) => {
  const [, get] = useInstance();

  const onFormat = (e: React.MouseEvent, command: any) => {
    e.preventDefault();
    const editor = get();
    if (!editor) return;
    editor.action(callCommand(command));
  };

  return (
    <div className="hidden">
      <div 
        ref={toolbarRef}
        className="flex items-center gap-1 bg-[#131313] border border-[#27272A] rounded-none p-1 shadow-xl"
      >
        <button onMouseDown={(e) => onFormat(e, toggleStrongCommand.key)} className="p-1.5 hover:bg-white/5 rounded-none text-slate-300 hover:text-white transition-colors">
          <Bold size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleEmphasisCommand.key)} className="p-1.5 hover:bg-white/5 rounded-none text-slate-300 hover:text-white transition-colors">
          <Italic size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleStrikethroughCommand.key)} className="p-1.5 hover:bg-white/5 rounded-none text-slate-300 hover:text-white transition-colors">
          <Strikethrough size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleInlineCodeCommand.key)} className="p-1.5 hover:bg-white/5 rounded-none text-slate-300 hover:text-white transition-colors">
          <Code size={16} />
        </button>
        {/* Link is native in gfm but requires a custom prompt if not using default milkdown link command. We just add the button for Notion UI parity for now. */}
        <button className="p-1.5 hover:bg-white/5 rounded-none text-slate-300 hover:text-white transition-colors">
          <LinkIcon size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Sticky Markdown Toolbar ─────────────────────────────────────────────
// Provides a persistent toolbar at the top of the editor so users can apply
// Markdown formatting without knowing the syntax. All buttons use Milkdown
// commands to operate on the ProseMirror document directly.

const btnBase =
  "p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]/50";
const divider = <div className="w-px h-5 bg-[#27272A] mx-1" />;

const MarkdownToolbar = () => {
  const [, get] = useInstance();

  const exec = (cmdKey: any, ...args: unknown[]) => {
    const editor = get();
    if (!editor) return;
    editor.action(callCommand(cmdKey, ...args));
  };

  const handleLink = () => {
    const editor = get();
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (!view) return;
      const { from, to, empty } = view.state.selection;
      const linkMarkType = view.state.schema.marks.link;

      if (!empty) {
        // Selection exists → check if already a link
        const hasLink = view.state.doc.rangeHasMark(from, to, linkMarkType);
        if (hasLink) {
          view.dispatch(view.state.tr.removeMark(from, to, linkMarkType));
          return;
        }
        const url = window.prompt("Enter URL:", "https://");
        if (url) {
          view.dispatch(
            view.state.tr.addMark(from, to, linkMarkType.create({ href: url }))
          );
        }
      } else {
        // No selection → insert linked text
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
    <div className="sticky top-0 z-20 flex items-center gap-0.5 bg-[#0E0E0E] border-b border-[#27272A] px-2 py-1 overflow-x-auto select-none">
      {/* ── Headings ── */}
      <button
        onClick={() => exec(wrapInHeadingCommand.key, 1)}
        title="Heading 1"
        className={btnBase}
      >
        <Heading1 size={17} />
      </button>
      <button
        onClick={() => exec(wrapInHeadingCommand.key, 2)}
        title="Heading 2"
        className={btnBase}
      >
        <Heading2 size={17} />
      </button>
      <button
        onClick={() => exec(wrapInHeadingCommand.key, 3)}
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
        onClick={() => exec(wrapInBlockquoteCommand.key)}
        title="Blockquote"
        className={btnBase}
      >
        <Quote size={17} />
      </button>
      <button
        onClick={() => exec(wrapInBulletListCommand.key)}
        title="Bullet list"
        className={btnBase}
      >
        <List size={17} />
      </button>
      <button
        onClick={() => exec(wrapInOrderedListCommand.key)}
        title="Ordered list"
        className={btnBase}
      >
        <ListOrdered size={17} />
      </button>
      <button
        onClick={() => exec(createCodeBlockCommand.key)}
        title="Code block"
        className={btnBase}
      >
        <Code2 size={17} />
      </button>

      {divider}

      {/* ── Insert ── */}
      <button
        onClick={() => exec(insertHrCommand.key)}
        title="Horizontal rule"
        className={btnBase}
      >
        <Minus size={17} />
      </button>
      <button
        onClick={() => exec(insertTableCommand.key)}
        title="Insert table"
        className={btnBase}
      >
        <Table size={16} />
      </button>
    </div>
  );
};

const EditorComponent = ({ content, noteId }: { content: string; noteId: string }) => {
  const { setIsSaving, isEntityVoiceMutating, optimisticPatchNote, cursorPosition, setCursorPosition } = useWorkspaceStore();
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const isFirstMount = useRef(true);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Ref to hold the latest ProseMirror selection position (survives across renders)
  const latestCursorPos = useRef<number>(cursorPosition);
  const restoredOnce = useRef(false);

  // ─── Get editor instance ─────────────────────────────────────────
  const [, getEditor] = useInstance();

  // ─── Restore cursor after editor is ready ────────────────────────
  // With key-based remounting, defaultValueCtx handles content loading.
  // This effect only needs to restore the cursor position.
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
        // Configure tooltip view lazily — avoids race condition with plugin init
        ctx.set(tooltip.key, {
          view: () => {
            const el = toolbarRef.current;
            if (!el) return { destroy: () => {} } as any;
            const provider = new TooltipProvider({ content: el });
            return provider;
          },
        });
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
      .use(listener)
      .use(tooltip);
  }, [noteId]);

  return (
    <>
      <Milkdown />
      <TooltipMenu toolbarRef={toolbarRef} />
    </>
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

      <MilkdownProvider>
        {/* Sticky toolbar stays interactive even during AI suggestion review */}
        <MarkdownToolbar />

        <div className={isPending ? "opacity-30 pointer-events-none select-none" : ""}>
          {/* Key-based remounting ensures editor always picks up latest content via defaultValueCtx.
              Cursor position is tracked via DOM events + Zustand store, so it survives remounts. */}
          <EditorComponent key={`active-${noteId}`} content={content} noteId={noteId} />
        </div>
      </MilkdownProvider>
    </div>
  );
}
