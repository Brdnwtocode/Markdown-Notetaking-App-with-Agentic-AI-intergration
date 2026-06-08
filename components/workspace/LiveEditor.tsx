"use client";

import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { tooltipFactory, TooltipProvider } from '@milkdown/plugin-tooltip';
import { callCommand } from '@milkdown/utils';
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand } from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';
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

const EditorComponent = ({ content, noteId }: { content: string; noteId: string }) => {
  const { setIsSaving, isVoiceMutating, optimisticPatchNote, cursorPosition, setCursorPosition } = useWorkspaceStore();
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

          if (isVoiceMutating) return; // block autosave while voice is processing

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

interface DiffOverlayProps {
  originalContent: string;
  newContent: string;
}

const DiffOverlay = ({ originalContent, newContent }: DiffOverlayProps) => {
  const diffs = Diff.diffWordsWithSpace(originalContent, newContent);

  // Group diff parts by paragraph (split by newlines)
  const paragraphs: Diff.Change[][] = [[]];
  diffs.forEach((part) => {
    const lines = part.value.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) {
        paragraphs.push([]);
      }
      if (line !== "") {
        paragraphs[paragraphs.length - 1].push({
          ...part,
          value: line,
        });
      }
    });
  });

  return (
    <div className="absolute inset-0 bg-[#0E0E0E] overflow-y-auto px-4 py-2 z-10 font-sans select-text">
      {paragraphs
        .filter((para) => para.length > 0)
        .map((para, pIdx) => {
          const hasChanges = para.some((part) => part.added || part.removed);
          return (
            <div
              key={pIdx}
              className={`pl-3 border-l-2 mb-4 leading-relaxed text-slate-200 ${
                hasChanges
                  ? "border-transparent hover:border-[#10B981] transition-all duration-200"
                  : "border-transparent"
              }`}
            >
              {para.map((part, index) => {
                if (part.added) {
                  return (
                    <span
                      key={index}
                      className="bg-[#10B9811A] text-[#10B981] select-text"
                    >
                      {part.value}
                    </span>
                  );
                }
                if (part.removed) {
                  return (
                    <span
                      key={index}
                      className="text-[#EF4444] line-through select-text"
                    >
                      {part.value}
                    </span>
                  );
                }
                return <span key={index} className="select-text">{part.value}</span>;
              })}
            </div>
          );
        })}
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

      <div className={isPending ? "opacity-0 pointer-events-none" : ""}>
        <MilkdownProvider>
          {/* Key-based remounting ensures editor always picks up latest content via defaultValueCtx.
              Cursor position is tracked via DOM events + Zustand store, so it survives remounts. */}
          <EditorComponent key={isPending ? 'pending' : `active-${noteId}`} content={content} noteId={noteId} />
        </MilkdownProvider>
      </div>
    </div>
  );
}
