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
import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from "@/lib/store";

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

export default function LiveEditor({ noteId, content }: LiveEditorProps) {
  return (
    <div className="prose prose-invert prose-lg max-w-none w-full bg-transparent text-slate-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none focus:[&_.ProseMirror]:outline-none focus:[&_.ProseMirror]:ring-0 focus-visible:[&_.ProseMirror]:outline-none focus-visible:[&_.ProseMirror]:ring-0 pb-64" 
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <MilkdownProvider>
        <EditorComponent content={content} noteId={noteId} />
      </MilkdownProvider>
    </div>
  );
}
