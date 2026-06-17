"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { MilkdownProvider } from "@milkdown/react";
import LiveEditor, { MarkdownToolbar } from "@/components/workspace/LiveEditor";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store";
import { Trash2, Download, MoreVertical, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";
import { toast } from "@/lib/toast";

function RawMarkdownEditor({ content, noteId }: { content: string; noteId: string }) {
  const [text, setText] = useState(content);
  const { setIsSaving, optimisticPatchNote } = useWorkspaceStore();
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setText(content);
  }, [content, noteId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    setIsSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      optimisticPatchNote(noteId, { content: val });
      setIsSaving(false);
    }, 1000);
  };

  return (
    <TextareaAutosize
      value={text}
      onChange={handleChange}
      className="font-mono bg-transparent w-full min-h-[600px] resize-none outline-none text-slate-300 placeholder:text-slate-600 mt-4 border-none focus:ring-0 p-0"
      placeholder="Start typing markdown..."
    />
  );
}

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const [note, setNote] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const { setCurrentNoteId, noteCache, upsertNoteCache, optimisticPatchNote, optimisticDeleteNote, openTab, isRawMarkdownView, toggleRawMarkdownView, saveTabScrollPosition, getTabScrollPosition } =
    useWorkspaceStore();

  // ── Scroll position persistence ──────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<NodeJS.Timeout>();
  const scrollRestoreAttemptRef = useRef(0);
  const scrollRestoreTimerRef = useRef<NodeJS.Timeout>();

  // Restore saved scroll position ONLY after the editor is fully mounted
  // AND the DOM has sufficient height. The Milkdown editor loads async,
  // so a naive scrollTop assignment on mount gets clamped to 0 because
  // the container's scrollHeight is still tiny. We poll scrollHeight
  // until it exceeds the saved position, then apply with smooth behavior.
  useEffect(() => {
    // Reset state for new noteId
    scrollRestoreAttemptRef.current = 0;
    if (scrollRestoreTimerRef.current) {
      clearTimeout(scrollRestoreTimerRef.current);
      scrollRestoreTimerRef.current = undefined;
    }

    if (loading || !note) return;

    const savedPos = getTabScrollPosition(noteId);
    if (savedPos <= 0) return;

    const MAX_ATTEMPTS = 60; // 60 × 100ms = 6s max wait for editor to render
    const POLL_INTERVAL = 100; // ms

    const tryRestore = () => {
      const el = scrollRef.current;
      if (!el) return;

      // Only apply when the container is tall enough to hold the saved position
      if (el.scrollHeight > savedPos) {
        el.scrollTo({ top: savedPos, behavior: "smooth" });
        return;
      }

      scrollRestoreAttemptRef.current++;
      if (scrollRestoreAttemptRef.current < MAX_ATTEMPTS) {
        scrollRestoreTimerRef.current = setTimeout(tryRestore, POLL_INTERVAL);
      }
    };

    // Delay initial attempt to let React commit + Milkdown start rendering
    scrollRestoreTimerRef.current = setTimeout(tryRestore, 200);

    return () => {
      if (scrollRestoreTimerRef.current) {
        clearTimeout(scrollRestoreTimerRef.current);
      }
    };
  }, [loading, note, noteId, getTabScrollPosition]);

  // ── Fade-in content after loading completes ──────────────────────
  // Stagger: show content with a short delay after loading resolves
  // to avoid the jarring flash of unstyled editor mount.
  useEffect(() => {
    if (!loading && note) {
      // Small delay so the DOM has a frame to paint the layout skeleton
      const timer = setTimeout(() => setContentVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setContentVisible(false);
    }
  }, [loading, note]);

  // Save scroll position on scroll (debounced 150ms)
  const handleScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (scrollRef.current) {
        saveTabScrollPosition(noteId, scrollRef.current.scrollTop);
      }
    }, 150);
  }, [noteId, saveTabScrollPosition]);

  // ── Keep local note state in sync with Zustand noteCache ─────────
  // When confirmMutation (or any other flow) updates noteCache,
  // the local `note` state must reflect the latest content so
  // LiveEditor receives the correct `content` prop after accept.
  const cachedNote = noteCache[noteId];
  useEffect(() => {
    if (cachedNote) {
      setNote((prev: any) => {
        // Only update if content or title actually changed (avoid re-render loops)
        if (prev?.content === cachedNote.content && prev?.title === cachedNote.title) return prev;
        return cachedNote;
      });
      setTitle((prev) => (prev !== cachedNote.title ? cachedNote.title : prev));
    }
  }, [cachedNote]);

  useEffect(() => {
    setCurrentNoteId(noteId);
    fetchNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const fetchNote = async () => {
    const cached = noteCache[noteId];
    if (cached) {
      setNote(cached);
      setTitle(cached.title);
      openTab(noteId, "NOTE", cached.title || "Untitled Note");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`/api/notes/${noteId}`);
      setNote(res.data);
      setTitle(res.data.title);
      openTab(noteId, "NOTE", res.data.title || "Untitled Note");
      upsertNoteCache(res.data);
    } catch {
      toast.error("Failed to load note");
    } finally {
      setLoading(false);
    }
  };

  const updateTitle = async (newTitle: string) => {
    setTitle(newTitle);
    optimisticPatchNote(noteId, { title: newTitle });
  };

  const exportAsMarkdown = async () => {
    try {
      const res = await axios.get(`/api/notes/${noteId}`);
      const { title, content } = res.data;

      const markdown = `# ${title}\n\n${content}`;
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "note"}.md`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Note exported as Markdown");
    } catch (error) {
      toast.error("Failed to export note");
    }
  };

  const deleteNote = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    optimisticDeleteNote(noteId);
    toast.success("Note deleted");
    router.push("/workspace");
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-[#1e1e1e] flex items-center justify-center">
        {/* ── Loading skeleton that mimics the final layout ─────── */}
        <div className="max-w-4xl mx-auto px-16 py-20 w-full animate-pulse space-y-8">
          {/* Title skeleton */}
          <div className="h-12 bg-white/5 rounded-lg w-2/3" />
          {/* Content skeleton lines */}
          <div className="space-y-3 pt-4">
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-5/6" />
            <div className="h-4 bg-white/5 rounded w-4/6" />
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-3/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
        <p className="text-muted-foreground">Note not found</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full w-full overflow-y-auto relative scrollbar scrollbar-w-2 scrollbar-thumb-zinc-700/50 hover:scrollbar-thumb-zinc-600 scrollbar-track-transparent bg-[#1e1e1e]">
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={toggleRawMarkdownView}>
              <Eye className="h-4 w-4 mr-2" />
              {isRawMarkdownView ? "Hide Raw Markdown" : "View Raw Markdown"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportAsMarkdown}>
              <Download className="h-4 w-4 mr-2" />
              Export as MD
            </DropdownMenuItem>
            <DropdownMenuItem onClick={deleteNote} className="text-red-400 focus:text-red-400">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MilkdownProvider>
        {/* MarkdownToolbar rendered above the title; uses useInstance()
            which resolves via MilkdownProvider context shared with LiveEditor below */}
        <MarkdownToolbar />

        {/* ── Content wrapper with fade-in transition ────────────── */}
        <div
          className={`
            max-w-4xl mx-auto px-16 py-20
            transition-all duration-500 ease-out
            ${contentVisible
              ? "opacity-100 translate-y-0 blur-none"
              : "opacity-0 translate-y-4 blur-sm"
            }
          `}
        >
        <div className="space-y-8">
          <TextareaAutosize
            value={title}
            onChange={(e) => updateTitle(e.target.value)}
            placeholder="Untitled Note"
            className="w-full bg-transparent border-none text-5xl font-bold text-slate-200 placeholder:text-slate-600 focus:ring-0 focus:outline-none outline-none resize-none"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
          />
          <div className="outline-none border-none">
            {isRawMarkdownView ? (
              <RawMarkdownEditor noteId={noteId} content={note.content} />
            ) : (
              <LiveEditor noteId={noteId} content={note.content} />
            )}
          </div>
        </div>
      </div>
      </MilkdownProvider>
    </div>
  );
}
