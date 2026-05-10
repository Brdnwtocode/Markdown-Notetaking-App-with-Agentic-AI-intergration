"use client";

import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { tooltipFactory, TooltipProvider } from '@milkdown/plugin-tooltip';
import { callCommand } from '@milkdown/utils';
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand } from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';
import { useEffect, useRef, useMemo } from 'react';
import { useWorkspaceStore } from "@/lib/store";
import * as diff from 'diff';

const tooltip = tooltipFactory('Text');

interface LiveEditorProps {
  noteId: string;
  content: string;
}

const TooltipMenu = () => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltipProvider = useRef<TooltipProvider>();
  const [, get] = useInstance();

  useEffect(() => {
    if (!ref.current || !get()) return;

    tooltipProvider.current = new TooltipProvider({
      content: ref.current,
    });

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [get]);

  useEffect(() => {
    const editor = get();
    if (!editor || !tooltipProvider.current) return;

    editor.action((ctx) => {
      ctx.set(tooltip.key, {
        view: () => tooltipProvider.current as any,
      });
    });
  }, [get]);

  const onFormat = (e: React.MouseEvent, command: any) => {
    e.preventDefault();
    const editor = get();
    if (!editor) return;
    editor.action(callCommand(command));
  };

  return (
    <div className="hidden">
      <div 
        ref={ref} 
        className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 shadow-xl"
      >
        <button onMouseDown={(e) => onFormat(e, toggleStrongCommand.key)} className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-colors">
          <Bold size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleEmphasisCommand.key)} className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-colors">
          <Italic size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleStrikethroughCommand.key)} className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-colors">
          <Strikethrough size={16} />
        </button>
        <button onMouseDown={(e) => onFormat(e, toggleInlineCodeCommand.key)} className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-colors">
          <Code size={16} />
        </button>
        {/* Link is native in gfm but requires a custom prompt if not using default milkdown link command. We just add the button for Notion UI parity for now. */}
        <button className="p-1.5 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition-colors">
          <LinkIcon size={16} />
        </button>
      </div>
    </div>
  );
};

const EditorComponent = ({ content, noteId }: { content: string; noteId: string }) => {
  const { setIsSaving, isVoiceMutating, optimisticPatchNote } = useWorkspaceStore();
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const isFirstMount = useRef(true);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content);
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
      <TooltipMenu />
    </>
  );
};

const DiffOverlay = ({ 
  original, 
  updated, 
  onAccept, 
  onDiscard 
}: { 
  original: string, 
  updated: string, 
  onAccept: () => void, 
  onDiscard: () => void 
}) => {
  const diffs = useMemo(() => diff.diffWordsWithSpace(original, updated), [original, updated]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAccept, onDiscard]);

  return (
    <div className="absolute inset-0 z-40 bg-[#0b1118] overflow-y-auto">
      <div className="whitespace-pre-wrap font-mono text-base leading-relaxed text-slate-300 p-4 pb-32">
        {diffs.map((part, index) => {
          if (part.added) {
            return <span key={index} className="bg-green-900/50 text-green-200">{part.value}</span>;
          }
          if (part.removed) {
            return <span key={index} className="line-through text-red-500 bg-red-900/20">{part.value}</span>;
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>

      {/* Floating Controls */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900 border border-yellow-700/50 shadow-2xl rounded-full px-5 py-3 flex items-center gap-4 z-50">
        <span className="text-sm font-medium text-yellow-500 flex items-center gap-2 pr-2 border-r border-zinc-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
          </span>
          AI Suggested Edits
        </span>
        <button onClick={onAccept} className="text-sm text-slate-300 hover:text-white flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors">
          Accept <span className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">Enter</span>
        </button>
        <button onClick={onDiscard} className="text-sm text-slate-300 hover:text-white flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors">
          Discard <span className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">Esc</span>
        </button>
      </div>
    </div>
  );
};

export default function LiveEditor({ noteId, content }: LiveEditorProps) {
  const { pendingAction, commitPendingAction, clearPendingAction } = useWorkspaceStore();
  const isPending = pendingAction?.type === "update_note" && pendingAction.noteId === noteId;

  return (
    <div className="prose prose-invert prose-lg max-w-none w-full bg-transparent text-slate-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none focus:[&_.ProseMirror]:outline-none focus:[&_.ProseMirror]:ring-0 focus-visible:[&_.ProseMirror]:outline-none focus-visible:[&_.ProseMirror]:ring-0 pb-64 relative min-h-[500px]" 
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {isPending && pendingAction.type === "update_note" && (
        <DiffOverlay 
          original={content} 
          updated={pendingAction.updatedData.content} 
          onAccept={() => {
            commitPendingAction();
            // In a real scenario, you'd replace milkdown's content here.
            // Since milkdown state management varies, we rely on the parent component or the store to handle re-hydration.
          }} 
          onDiscard={clearPendingAction} 
        />
      )}

      <div className={isPending ? "opacity-0 pointer-events-none absolute inset-0" : "opacity-100"}>
        <MilkdownProvider>
          {/* We key by isPending so that Milkdown remounts exactly when returning to active state, picking up the latest content without remounting on every keystroke. */}
          <EditorComponent key={isPending ? 'pending' : `active-${noteId}`} content={content} noteId={noteId} />
        </MilkdownProvider>
      </div>
    </div>
  );
}
