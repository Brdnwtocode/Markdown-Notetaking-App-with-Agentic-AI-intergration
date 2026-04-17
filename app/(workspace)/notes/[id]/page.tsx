"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SplitEditor from "@/components/workspace/SplitEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store";
import { Trash2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const [note, setNote] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const { currentNoteId, setCurrentNoteId } = useWorkspaceStore();

  useEffect(() => {
    setCurrentNoteId(noteId);
    fetchNote();
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const res = await axios.get(`/api/notes/${noteId}`);
      setNote(res.data);
      setTitle(res.data.title);
    } catch (error) {
      toast.error("Failed to load note");
    } finally {
      setLoading(false);
    }
  };

  const updateTitle = async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await axios.put(`/api/notes/${noteId}`, { title: newTitle });
    } catch (error) {
      toast.error("Failed to update title");
    }
  };

  const deleteNote = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await axios.delete(`/api/notes/${noteId}`);
      toast.success("Note deleted");
      router.push("/workspace");
    } catch (error) {
      toast.error("Failed to delete note");
    }
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between gap-4 bg-background/95">
        <Input
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Note title..."
          className="text-lg font-semibold"
        />
        <Button
          variant="destructive"
          size="icon"
          onClick={deleteNote}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <SplitEditor
        noteId={noteId}
        title={title}
        content={note.content}
        onSave={(content) => {
          setNote((prev: any) => ({ ...prev, content }));
        }}
      />
    </div>
  );
}
