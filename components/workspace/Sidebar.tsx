"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store";
import { Plus, LogOut, FileText, Database } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SchemaBuilder, {
  ColumnDefinition,
} from "@/components/workspace/SchemaBuilder";
import axios from "axios";
import toast from "react-hot-toast";

export default function Sidebar() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [creatingStack, setCreatingStack] = useState(false);
  const [stackName, setStackName] = useState("");
  const { notes, stacks, setNotes, setStacks, currentNoteId, currentStackId } =
    useWorkspaceStore();

  useEffect(() => {
    fetchNotes();
    fetchStacks();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get("/api/notes");
      setNotes(res.data);
    } catch (error) {
      console.error("Failed to fetch notes", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStacks = async () => {
    try {
      const res = await axios.get("/api/stacks");
      setStacks(res.data);
    } catch (error) {
      console.error("Failed to fetch stacks", error);
    }
  };

  const createNote = async () => {
    try {
      const res = await axios.post("/api/notes", { title: "Untitled Note" });
      setNotes([res.data, ...notes]);
      router.push(`/workspace/notes/${res.data.id}`);
    } catch (error) {
      toast.error("Failed to create note");
    }
  };

  const handleCreateStack = (columns: ColumnDefinition[]) => {
    setCreatingStack(true);
    axios
      .post("/api/stacks", {
        name: stackName || "New Stack",
        columns,
      })
      .then((res) => {
        setStacks([res.data, ...stacks]);
        toast.success("Stack created!");
        router.push(`/workspace/stacks/${res.data.id}`);
        setShowStackDialog(false);
        setStackName("");
      })
      .catch(() => {
        toast.error("Failed to create stack");
      })
      .finally(() => {
        setCreatingStack(false);
      });
  };

  return (
    <div className="w-64 border-r border-border bg-background flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-bold">Your Workspace</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Notes Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notes
            </h3>
            <Button
              size="icon"
              variant="ghost"
              onClick={createNote}
              className="h-6 w-6"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {notes.map((note) => (
              <Link
                key={note.id}
                href={`/workspace/notes/${note.id}`}
                className={`block px-2 py-2 text-sm rounded transition-colors truncate ${
                  currentNoteId === note.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                {note.title || "Untitled"}
              </Link>
            ))}
          </div>
        </div>

        {/* Stacks Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" /> Stacks
            </h3>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowStackDialog(true)}
              className="h-6 w-6"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {stacks.map((stack) => (
              <Link
                key={stack.id}
                href={`/workspace/stacks/${stack.id}`}
                className={`block px-2 py-2 text-sm rounded transition-colors truncate ${
                  currentStackId === stack.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                {stack.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - Logout */}
      <div className="p-4 border-t border-border">
        <Button
          onClick={() => signOut({ redirectTo: "/" })}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>

      {/* Stack Creation Dialog */}
      <Dialog open={showStackDialog} onOpenChange={setShowStackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Stack</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Stack Name</label>
              <input
                type="text"
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="e.g., Product Inventory"
                className="w-full mt-1 px-3 py-2 border border-input rounded text-sm"
              />
            </div>
            <SchemaBuilder
              onConfirm={handleCreateStack}
              onCancel={() => setShowStackDialog(false)}
              isLoading={creatingStack}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
