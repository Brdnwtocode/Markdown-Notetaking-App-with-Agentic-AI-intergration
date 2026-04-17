"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceStore } from "@/lib/store";
import axios from "axios";
import toast from "react-hot-toast";

interface SplitEditorProps {
  noteId: string;
  title: string;
  content: string;
  onSave: (content: string) => void;
}

export default function SplitEditor({
  noteId,
  title,
  content,
  onSave,
}: SplitEditorProps) {
  const [markdown, setMarkdown] = useState(content);
  const [isSynced, setIsSynced] = useState(true);
  const { setIsSaving, isVoiceMutating, setCursorPosition } = useWorkspaceStore();
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstMount = useRef(true);

  const handleCursorUpdate = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  };

  // Memoize ReactMarkdown components to prevent remounting on every render
  const markdownComponents = useMemo(
    () => ({
      h1: ({ node, ...props }: any) => (
        <h1 className="text-2xl font-bold my-4" {...props} />
      ),
      h2: ({ node, ...props }: any) => (
        <h2 className="text-xl font-bold my-3" {...props} />
      ),
      h3: ({ node, ...props }: any) => (
        <h3 className="text-lg font-bold my-2" {...props} />
      ),
      p: ({ node, ...props }: any) => (
        <p className="my-2 leading-relaxed" {...props} />
      ),
      ul: ({ node, ...props }: any) => (
        <ul className="list-disc list-inside my-2" {...props} />
      ),
      ol: ({ node, ...props }: any) => (
        <ol className="list-decimal list-inside my-2" {...props} />
      ),
      li: ({ node, ...props }: any) => <li className="my-1" {...props} />,
      code: ({ inline, node, ...props }: any) =>
        inline ? (
          <code
            className="bg-muted px-1 py-0.5 rounded text-sm font-mono"
            {...props}
          />
        ) : (
          <code
            className="block bg-muted p-3 rounded my-2 font-mono text-sm overflow-auto"
            {...props}
          />
        ),
      a: ({ node, ...props }: any) => (
        <a className="text-primary underline" {...props} />
      ),
      blockquote: ({ node, ...props }: any) => (
        <blockquote
          className="border-l-4 border-primary pl-4 my-2 italic"
          {...props}
        />
      ),
    }),
    []
  );

  useEffect(() => {
    setMarkdown(content);
  }, [content, noteId]);

  useEffect(() => {
    // Prevent autosave on initial mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (isVoiceMutating) return; // block autosave while voice is processing

    // Debounced autosave (1000ms)
    setIsSaving(true);
    setIsSynced(false);

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(async () => {
      try {
        await axios.put(`/api/notes/${noteId}`, { content: markdown });
        setIsSynced(true);
        setIsSaving(false);
      } catch (error) {
        toast.error("Failed to save note");
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [markdown, noteId]);

  return (
    <div className="flex flex-1 gap-4 p-4">
      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Editor</h3>
          {!isSynced && <div className="text-xs text-orange-500">Saving...</div>}
          {isSynced && <div className="text-xs text-green-500">Saved</div>}
        </div>
        <Textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            handleCursorUpdate();
          }}
          onKeyUp={handleCursorUpdate}
          onClick={handleCursorUpdate}
          placeholder="Start typing in markdown..."
          className="flex-1 font-mono text-sm resize-none"
        />
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          Preview
        </h3>
        <div className="flex-1 border border-border rounded-md p-4 bg-muted/30 overflow-auto prose prose-sm dark:prose-invert w-full">
          <ReactMarkdown components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
