"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SchemaBuilder, {
  ColumnDefinition,
} from "@/components/workspace/SchemaBuilder";
import axios from "axios";
import toast from "react-hot-toast";
import { Plus, LogOut, Database, PanelLeftOpen, PanelLeftClose, FileText, Table2, Search, ArrowUpAZ, ArrowDownAZ, Calendar, Filter, CheckSquare, CalendarDays, MessageSquare } from "lucide-react";
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";


type SortMethod = "a-z" | "z-a" | "date-new" | "date-old" | "type";

export default function Sidebar() {
  const router = useRouter();
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [creatingStack, setCreatingStack] = useState(false);
  const [stackName, setStackName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState<SortMethod>("a-z");
  
  const {
    notes,
    stacks,
    setNotes,
    setStacks,
    currentNoteId,
    currentStackId,
    optimisticCreateNote,
    openTab,
    isChatOpen,
    setIsChatOpen,
  } = useWorkspaceStore();

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
      const { tempId, promise } = optimisticCreateNote("Untitled Note");
      router.push(`/workspace/notes/${tempId}`);
      void promise.then(({ realId }) => {
        router.replace(`/workspace/notes/${realId}`);
      });
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

  const filteredAndSortedItems = useMemo(() => {
    // Combine notes and stacks
    const allItems = [
      ...notes.map((note) => ({
        id: note.id,
        type: "NOTE" as const,
        title: note.title || "Untitled Note",
        href: `/workspace/notes/${note.id}`,
        isActive: currentNoteId === note.id,
        createdAt: note.createdAt,
      })),
      ...stacks.map((stack) => ({
        id: stack.id,
        type: "STACK" as const,
        title: stack.name,
        href: `/workspace/stacks/${stack.id}`,
        isActive: currentStackId === stack.id,
        createdAt: stack.createdAt,
      })),
    ];

    // Filter
    const filtered = allItems.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortMethod) {
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        case "date-new":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date-old":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "type":
          if (a.type !== b.type) {
            return a.type === "NOTE" ? -1 : 1;
          }
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return sorted;
  }, [notes, stacks, searchQuery, sortMethod, currentNoteId, currentStackId]);

  const getSortIcon = () => {
    switch (sortMethod) {
      case "a-z":
        return <ArrowUpAZ className="h-4 w-4" />;
      case "z-a":
        return <ArrowDownAZ className="h-4 w-4" />;
      case "date-new":
      case "date-old":
        return <Calendar className="h-4 w-4" />;
      case "type":
        return <Filter className="h-4 w-4" />;
      default:
        return <ArrowUpAZ className="h-4 w-4" />;
    }
  };

  return (
      <div className="flex h-screen">
        {/* Level 1: Ribbon - Actionable Buttons */}
        <div className="w-12 bg-[#0E0E0E] border-r border-[#27272A] flex flex-col items-center py-4 space-y-2">
          <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title={isExplorerOpen ? "Close Explorer" : "Open Explorer"}
          >
            {isExplorerOpen ? <PanelLeftClose className="h-5 w-5 text-[#A1A1AA]" /> : <PanelLeftOpen className="h-5 w-5 text-[#A1A1AA]" />}
          </Button>
          <Button
              size="icon"
              variant="ghost"
              onClick={createNote}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title="New Note"
          >
            <Plus className="h-5 w-5 text-[#A1A1AA]" />
          </Button>
          <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowStackDialog(true)}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title="New Stack"
          >
            <Database className="h-5 w-5 text-[#A1A1AA]" />
          </Button>
          <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                openTab(TASKS_TAB_ID, "TASKS", "Tasks");
                router.push("/workspace/tasks");
              }}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title="Tasks"
          >
            <CheckSquare className="h-5 w-5 text-[#A1A1AA]" />
          </Button>
          <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                openTab(CALENDAR_TAB_ID, "CALENDAR", "Calendar");
                router.push("/workspace/calendar");
              }}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title="Calendar"
          >
            <CalendarDays className="h-5 w-5 text-[#A1A1AA]" />
          </Button>
          <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`h-10 w-10 rounded-none transition-all ${isChatOpen ? 'bg-[#10B981] hover:bg-[#10B981]/90' : 'hover:bg-white/5'}`}
              title="AI Chat"
          >
            <MessageSquare className={`h-5 w-5 ${isChatOpen ? 'text-[#0E0E0E]' : 'text-[#A1A1AA]'}`} />
          </Button>
          <div className="flex-1" />
          <Button
              size="icon"
              variant="ghost"
              onClick={() => signOut({ redirectTo: "/" })}
              className="h-10 w-10 rounded-none hover:bg-white/5"
              title="Sign Out"
          >
            <LogOut className="h-5 w-5 text-[#A1A1AA]" />
          </Button>
        </div>
        {/* Level 2: Unified Explorer */}
      {isExplorerOpen && (
        <div className="w-72 bg-[#131313] border-r border-[#27272A] flex flex-col">
          <div className="p-3 border-b border-[#27272A] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-tighter text-white uppercase font-technical">Files</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none hover:bg-white/5 text-[#A1A1AA] hover:text-white">
                    {getSortIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#131313] border-[#27272A] rounded-none">
                  <DropdownMenuItem onClick={() => setSortMethod("a-z")} className="hover:bg-white/5 text-white rounded-none">
                    <ArrowUpAZ className="h-4 w-4 mr-2" />
                    A - Z
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMethod("z-a")} className="hover:bg-white/5 text-white rounded-none">
                    <ArrowDownAZ className="h-4 w-4 mr-2" />
                    Z - A
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMethod("date-new")} className="hover:bg-white/5 text-white rounded-none">
                    <Calendar className="h-4 w-4 mr-2" />
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMethod("date-old")} className="hover:bg-white/5 text-white rounded-none">
                    <Calendar className="h-4 w-4 mr-2" />
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMethod("type")} className="hover:bg-white/5 text-white rounded-none">
                    <Filter className="h-4 w-4 mr-2" />
                    By Type
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-[#0E0E0E] border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
            {filteredAndSortedItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-75 truncate border-l-2 rounded-none ${
                  item.isActive
                    ? "bg-white/5 text-white border-l-[#10B981] pl-2.5"
                    : "text-[#A1A1AA] border-l-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                {item.type === "NOTE" ? (
                  <FileText className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Table2 className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate">{item.title}</span>
              </Link>
            ))}
            {filteredAndSortedItems.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-500 text-center font-technical">
                {searchQuery ? "No files found" : "No files yet"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stack Creation Dialog */}
      <Dialog open={showStackDialog} onOpenChange={setShowStackDialog}>
        <DialogContent className="max-w-4xl bg-[#0E0E0E] border-[#27272A] p-0 text-white overflow-hidden rounded-none">
          <DialogTitle className="sr-only">Create New Stack</DialogTitle>
          <SchemaBuilder
            onConfirm={handleCreateStack}
            onCancel={() => setShowStackDialog(false)}
            isLoading={creatingStack}
            stackName={stackName}
            setStackName={setStackName}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
