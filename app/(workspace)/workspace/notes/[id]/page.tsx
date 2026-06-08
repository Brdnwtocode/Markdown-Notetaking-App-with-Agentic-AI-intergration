"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import LiveEditor from "@/components/workspace/LiveEditor";
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
import toast from "react-hot-toast";

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
  const { setCurrentNoteId, noteCache, upsertNoteCache, optimisticPatchNote, optimisticDeleteNote, openTab, isRawMarkdownView, toggleRawMarkdownView } =
    useWorkspaceStore();

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
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading note...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Note not found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto relative scrollbar scrollbar-w-2 scrollbar-thumb-zinc-700/50 hover:scrollbar-thumb-zinc-600 scrollbar-track-transparent bg-[#1e1e1e]">
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

      <div className="max-w-4xl mx-auto px-16 py-20">
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
    </div>
  );
}
