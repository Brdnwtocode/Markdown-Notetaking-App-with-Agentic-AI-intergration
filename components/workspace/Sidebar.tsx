"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { apiJson } from "@/lib/api";
import { toast } from "@/lib/toast";
import { 
  Plus, LogOut, Database, PanelLeftOpen, PanelLeftClose, 
  FileText, Table2, Search, ArrowUpAZ, ArrowDownAZ, 
  Calendar, Filter, CheckSquare, CalendarDays, MessageSquare,
  ChevronRight, Folder, FolderPlus, Trash2, Edit, GripVertical, Loader2, Disc
} from "lucide-react";
import { TASKS_TAB_ID, CALENDAR_TAB_ID } from "@/lib/constants";
import { useDrag, useDrop } from "react-dnd";
import { Folder as FolderType } from "@/lib/slices/foldersSlice";
import SessionStopwatch from "@/components/workspace/SessionStopwatch";
import { Note } from "@/lib/slices/notesSlice";
import { Stack } from "@/lib/slices/stacksSlice";

type SortMethod = "a-z" | "z-a" | "date-new" | "date-old" | "type";

interface TreeNode {
  id: string;
  name: string;
  type: "FOLDER" | "NOTE" | "STACK";
  parentId: string | null;
  level: number;
  item: any;
  children?: TreeNode[];
}

// Helper to detect cyclic moves on the client
function isDescendantFolder(folderId: string, potentialParentId: string, folders: FolderType[]): boolean {
  if (folderId === potentialParentId) return true;
  let currentParentId: string | null = potentialParentId;
  const visited = new Set<string>();
  while (currentParentId) {
    if (visited.has(currentParentId)) return true;
    visited.add(currentParentId);
    const parentFolder = folders.find((f) => f.id === currentParentId);
    if (!parentFolder) break;
    if (parentFolder.parentId === folderId) return true;
    currentParentId = parentFolder.parentId;
  }
  return false;
}

// Tree construction and sorting function
function buildTree(
  folders: FolderType[],
  notes: Note[],
  stacks: Stack[],
  searchQuery: string,
  sortMethod: SortMethod
): TreeNode[] {
  const folderMap: Record<string, TreeNode[]> = {};
  folders.forEach((f) => {
    folderMap[f.id] = [];
  });

  const rootNodes: TreeNode[] = [];
  const folderNodesMap: Record<string, TreeNode> = {};

  folders.forEach((f) => {
    const node: TreeNode = {
      id: f.id,
      name: f.name,
      type: "FOLDER",
      parentId: f.parentId,
      level: 0,
      item: f,
      children: folderMap[f.id],
    };
    folderNodesMap[f.id] = node;
  });

  folders.forEach((f) => {
    const node = folderNodesMap[f.id];
    if (f.parentId && folderNodesMap[f.parentId]) {
      folderNodesMap[f.parentId].children?.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  notes.forEach((n) => {
    const node: TreeNode = {
      id: n.id,
      name: n.title || "Untitled Note",
      type: "NOTE",
      parentId: n.folderId,
      level: 0,
      item: n,
    };
    if (n.folderId && folderNodesMap[n.folderId]) {
      folderNodesMap[n.folderId].children?.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  stacks.forEach((s) => {
    const node: TreeNode = {
      id: s.id,
      name: s.name || "Untitled Stack",
      type: "STACK",
      parentId: s.folderId,
      level: 0,
      item: s,
    };
    if (s.folderId && folderNodesMap[s.folderId]) {
      folderNodesMap[s.folderId].children?.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  function setLevels(nodes: TreeNode[], level: number) {
    nodes.forEach((node) => {
      node.level = level;
      if (node.children) {
        setLevels(node.children, level + 1);
      }
    });
  }
  setLevels(rootNodes, 0);

  if (searchQuery.trim() !== "") {
    const query = searchQuery.toLowerCase();
    
    function filterNode(node: TreeNode): boolean {
      const selfMatches = node.name.toLowerCase().includes(query);
      if (node.type === "FOLDER" && node.children) {
        const filteredChildren = node.children.filter((child) => filterNode(child));
        node.children = filteredChildren;
        return selfMatches || filteredChildren.length > 0;
      }
      return selfMatches;
    }

    return rootNodes.filter((node) => filterNode(node));
  }

  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type === "FOLDER" && b.type !== "FOLDER") return -1;
      if (a.type !== "FOLDER" && b.type === "FOLDER") return 1;

      switch (sortMethod) {
        case "a-z":
          return a.name.localeCompare(b.name);
        case "z-a":
          return b.name.localeCompare(a.name);
        case "date-new":
          return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
        case "date-old":
          return new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
        case "type":
          if (a.type !== b.type) {
            return a.type.localeCompare(b.type);
          }
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    nodes.forEach((node) => {
      if (node.children) {
        sortTree(node.children);
      }
    });
  }
  sortTree(rootNodes);

  return rootNodes;
}

// SHARED INTERFACES FOR DRAG & DROP SUBCOMPONENTS
interface TreeNodeActions {
  setCreateFolderParentId: (id: string | null) => void;
  setShowFolderCreateDialog: (show: boolean) => void;
  createNoteInFolder: (folderId: string | null) => void;
  setStackTargetFolderId: (id: string | null) => void;
  setShowStackDialog: (show: boolean) => void;
  setRenameFolderId: (id: string | null) => void;
  setRenameFolderName: (name: string) => void;
  setShowFolderRenameDialog: (show: boolean) => void;
  handleDeleteFolder: (e: React.MouseEvent, folderId: string, name: string) => void;
}

function FolderNodeRow({ node, level, actions }: { node: TreeNode; level: number; actions: TreeNodeActions }) {
  const {
    folders,
    expandedFolderIds,
    toggleFolderExpanded,
    optimisticMoveFolder,
    optimisticMoveStack,
    optimisticPatchNote,
  } = useWorkspaceStore();

  const isExpanded = expandedFolderIds.has(node.id);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "NODE",
    item: { id: node.id, type: "FOLDER" },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [node.id]);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: "NODE",
    canDrop: (item: { id: string; type: "FOLDER" | "NOTE" | "STACK" }) => {
      if (item.id === node.id) return false;
      if (item.type === "FOLDER") {
        return !isDescendantFolder(item.id, node.id, folders);
      }
      return true;
    },
    drop: (item: { id: string; type: "FOLDER" | "NOTE" | "STACK" }, monitor) => {
      if (monitor.didDrop()) return;
      
      if (item.type === "FOLDER") {
        optimisticMoveFolder(item.id, node.id);
        toast.success("Folder moved");
      } else if (item.type === "NOTE") {
        optimisticPatchNote(item.id, { folderId: node.id });
        toast.success("Note moved");
      } else if (item.type === "STACK") {
        optimisticMoveStack(item.id, node.id);
        toast.success("Stack moved");
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [node.id, folders]);

  const isHighlight = isOver && canDrop;

  return (
    <div ref={(el) => { drag(drop(el)); }} className="group relative">
      {/* Indentation Guidelines */}
      {Array.from({ length: level }).map((_, idx) => (
        <div
          key={idx}
          className="absolute top-0 bottom-0 border-l border-[#27272A]"
          style={{ left: `${(idx * 16) + 12}px` }}
        />
      ))}
      
      <div
        className={`flex items-center gap-1.5 py-1 pr-2 text-sm select-none transition-colors duration-75 cursor-pointer relative border border-transparent ${
          isHighlight 
            ? "border-dashed border-[#10B981] bg-[#10B9810D] glow-emerald-subtle" 
            : isDragging
              ? "opacity-50 border border-[#10B981] bg-transparent cursor-grabbing"
              : "hover:bg-[#131313] hover:text-white"
        }`}
        style={{ paddingLeft: `${(level * 16) + 8}px` }}
        onClick={() => toggleFolderExpanded(node.id)}
      >
        <span className="flex items-center gap-1 flex-1 min-w-0">
          <ChevronRight
            className={`h-3.5 w-3.5 text-zinc-500 hover:text-white transition-transform duration-150 flex-shrink-0 ${
              isExpanded ? "rotate-90" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFolderExpanded(node.id);
            }}
          />
          <Folder className="h-4 w-4 text-[#10B981] fill-[#10B981]/10 flex-shrink-0" />
          <span className="truncate text-[#FFFFFF] font-sans font-medium text-[14px]">
            {node.name}
          </span>
        </span>

        {/* Context Actions */}
        <div className="hidden group-hover:flex items-center gap-0.5 ml-auto pl-1 bg-[#131313] md:bg-transparent rounded z-10">
          <button
            title="New Subfolder"
            onClick={(e) => {
              e.stopPropagation();
              actions.setCreateFolderParentId(node.id);
              actions.setShowFolderCreateDialog(true);
            }}
            className="p-1 text-[#A1A1AA] hover:text-white hover:bg-white/10 rounded"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            title="New Note"
            onClick={(e) => {
              e.stopPropagation();
              actions.createNoteInFolder(node.id);
            }}
            className="p-1 text-[#A1A1AA] hover:text-white hover:bg-white/10 rounded"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            title="New Stack — Structured table with typed columns"
            onClick={(e) => {
              e.stopPropagation();
              actions.setStackTargetFolderId(node.id);
              actions.setShowStackDialog(true);
            }}
            className="p-1 text-[#A1A1AA] hover:text-white hover:bg-white/10 rounded"
          >
            <Database className="h-3.5 w-3.5" />
          </button>
          <button
            title="Rename Folder"
            onClick={(e) => {
              e.stopPropagation();
              actions.setRenameFolderId(node.id);
              actions.setRenameFolderName(node.name);
              actions.setShowFolderRenameDialog(true);
            }}
            className="p-1 text-[#A1A1AA] hover:text-white hover:bg-white/10 rounded"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            title="Delete Folder"
            onClick={(e) => actions.handleDeleteFolder(e, node.id, node.name)}
            className="p-1 text-[#A1A1AA] hover:text-rose-500 hover:bg-rose-500/10 rounded"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} level={level + 1} actions={actions} />
          ))}
        </div>
      )}
      {isExpanded && node.children && node.children.length === 0 && (
        <div
          className="py-1 text-[11px] text-zinc-500 italic relative"
          style={{ paddingLeft: `${((level + 1) * 16) + 24}px` }}
        >
          {Array.from({ length: level + 1 }).map((_, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 border-l border-[#27272A]"
              style={{ left: `${(idx * 16) + 12}px` }}
            />
          ))}
          Empty Folder
        </div>
      )}
    </div>
  );
}

function FileNodeRow({ node, level }: { node: TreeNode; level: number }) {
  const {
    currentNoteId,
    currentStackId,
    optimisticDeleteNote,
  } = useWorkspaceStore();

  const isActive = node.type === "NOTE" 
    ? currentNoteId === node.id 
    : currentStackId === node.id;

  const href = node.type === "NOTE"
    ? `/workspace/notes/${node.id}`
    : `/workspace/stacks/${node.id}`;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "NODE",
    item: { id: node.id, type: node.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [node.id, node.type]);

  const handleDeleteFile = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete this ${node.type === 'NOTE' ? 'note' : 'stack'}?`)) {
      if (node.type === "NOTE") {
        optimisticDeleteNote(node.id);
        toast.success("Note deleted");
      } else {
        try {
          await axios.delete(`/api/stacks/${node.id}`);
          useWorkspaceStore.getState().deleteStack(node.id);
          toast.success("Stack deleted");
        } catch {
          toast.error("Failed to delete stack");
        }
      }
    }
  };

  const isOptimisticTemp = node.id.startsWith("temp_");

  return (
    <div ref={drag as any} className="group relative">
      {Array.from({ length: level }).map((_, idx) => (
        <div
          key={idx}
          className="absolute top-0 bottom-0 border-l border-[#27272A]"
          style={{ left: `${(idx * 16) + 12}px` }}
        />
      ))}

      {isOptimisticTemp ? (
        <div
          className="flex items-center gap-1.5 py-1 px-3 text-sm text-zinc-500 select-none relative"
          style={{ paddingLeft: `${(level * 16) + 8}px` }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
          <span className="truncate flex-1 font-sans font-medium text-[14px]">
            {node.name}
          </span>
        </div>
      ) : (
        <Link
          href={href}
          className={`flex items-center gap-1.5 py-1 pr-3 text-sm select-none border-l-2 relative transition-colors duration-75 ${
            isActive
              ? "bg-[#131313] text-white border-l-[#10B981] pl-[6px]"
              : "text-[#A1A1AA] border-l-transparent hover:text-white hover:bg-[#131313] pl-2"
          } ${isDragging ? "opacity-50 border border-[#10B981] bg-transparent cursor-grabbing" : ""}`}
          style={{ paddingLeft: `${(level * 16) + 8}px`, cursor: isDragging ? "grabbing" : "grab" }}
        >
          {/* Grip Handle */}
          <GripVertical className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />

          {node.type === "NOTE" ? (
            <FileText className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          ) : (
            <Table2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
          )}
          
          <span className="truncate flex-1 font-sans font-medium text-[14px]">
            {node.name}
          </span>

          {/* Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-0.5 ml-auto pl-1 z-10 bg-[#131313] rounded">
            <button
              title="Delete"
              onClick={handleDeleteFile}
              className="p-1 text-[#A1A1AA] hover:text-rose-500 hover:bg-rose-500/10 rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Extension Badge */}
          <span className="ml-1 font-mono text-[10px] text-[#A1A1AA] uppercase flex-shrink-0 tracking-wider font-semibold">
            {node.type === "NOTE" ? "[.MD]" : "[.STK]"}
          </span>
        </Link>
      )}
    </div>
  );
}

function TreeNodeRow({ node, level, actions }: { node: TreeNode; level: number; actions: TreeNodeActions }) {
  if (node.type === "FOLDER") {
    return <FolderNodeRow node={node} level={level} actions={actions} />;
  }
  return <FileNodeRow node={node} level={level} />;
}

function ExplorerTree({ searchQuery, sortMethod, actions }: { searchQuery: string; sortMethod: SortMethod; actions: TreeNodeActions }) {
  const {
    folders,
    notes,
    stacks,
    optimisticMoveFolder,
    optimisticMoveStack,
    optimisticPatchNote,
  } = useWorkspaceStore();

  const treeData = useMemo(() => {
    return buildTree(folders, notes, stacks, searchQuery, sortMethod);
  }, [folders, notes, stacks, searchQuery, sortMethod]);

  const [{ isOverRoot }, dropRoot] = useDrop(() => ({
    accept: "NODE",
    drop: (item: { id: string; type: "FOLDER" | "NOTE" | "STACK" }, monitor) => {
      if (monitor.didDrop()) return;
      
      if (item.type === "FOLDER") {
        optimisticMoveFolder(item.id, null);
        toast.success("Folder moved to root");
      } else if (item.type === "NOTE") {
        optimisticPatchNote(item.id, { folderId: null });
        toast.success("Note moved to root");
      } else if (item.type === "STACK") {
        optimisticMoveStack(item.id, null);
        toast.success("Stack moved to root");
      }
    },
    collect: (monitor) => ({
      isOverRoot: monitor.isOver({ shallow: true }),
    }),
  }), [folders]);

  return (
    <div 
      ref={dropRoot as any}
      className={`flex-1 overflow-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800 relative min-h-[250px] ${
        isOverRoot ? "bg-white/5 border border-dashed border-[#10B981] rounded-none" : ""
      }`}
    >
      {treeData.map((node) => (
        <TreeNodeRow key={node.id} node={node} level={0} actions={actions} />
      ))}
      
      {treeData.length === 0 && (
        <div className="px-3 py-8 text-sm text-zinc-500 text-center font-technical">
          {searchQuery ? "No files found" : "No files yet"}
        </div>
      )}
    </div>
  );
}

// MAIN SIDEBAR COMPONENT
export default function Sidebar() {
  const router = useRouter();
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [creatingStack, setCreatingStack] = useState(false);
  const [stackName, setStackName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState<SortMethod>("a-z");

  // Folder Dialogs & State
  const [showFolderCreateDialog, setShowFolderCreateDialog] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [createFolderName, setCreateFolderName] = useState("");

  const [showFolderRenameDialog, setShowFolderRenameDialog] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  const [stackTargetFolderId, setStackTargetFolderId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  const {
    notes,
    stacks,
    setNotes,
    setStacks,
    optimisticCreateNote,
    openTab,
    isChatOpen,
    setIsChatOpen,
    folders,
    fetchFolders,
    optimisticCreateFolder,
    optimisticRenameFolder,
    syncState,
  } = useWorkspaceStore();

  const fetchNotes = useCallback(async () => {
    try {
      const res = await axios.get("/api/notes");
      setNotes(res.data);
    } catch (error) {
      console.error("Failed to fetch notes", error);
    }
  }, [setNotes]);

  const fetchStacks = useCallback(async () => {
    try {
      const res = await axios.get("/api/stacks");
      setStacks(res.data);
    } catch (error) {
      console.error("Failed to fetch stacks", error);
    }
  }, [setStacks]);

  useEffect(() => {
    fetchNotes();
    fetchStacks();
    fetchFolders();
    setMounted(true);
  }, [fetchNotes, fetchStacks, fetchFolders]);

  const createNoteInFolder = useCallback(async (folderId: string | null = null) => {
    try {
      const { tempId, promise } = optimisticCreateNote("Untitled Note", folderId);
      router.push(`/workspace/notes/${tempId}`);
      void promise.then(({ realId }) => {
        router.replace(`/workspace/notes/${realId}`);
      });
    } catch (error) {
      toast.error("Failed to create note");
    }
  }, [optimisticCreateNote, router]);

  const handleCreateStack = (columns: ColumnDefinition[]) => {
    setCreatingStack(true);
    axios
      .post("/api/stacks", {
        name: stackName || "New Stack",
        columns,
        folderId: stackTargetFolderId || null,
      })
      .then((res) => {
        setStacks([res.data, ...stacks]);
        toast.success("Stack created!");
        router.push(`/workspace/stacks/${res.data.id}`);
        setShowStackDialog(false);
        setStackName("");
        setStackTargetFolderId(null);
      })
      .catch(() => {
        toast.error("Failed to create stack");
      })
      .finally(() => {
        setCreatingStack(false);
      });
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFolderName.trim()) return;
    optimisticCreateFolder(createFolderName, createFolderParentId);
    setShowFolderCreateDialog(false);
    setCreateFolderName("");
    setCreateFolderParentId(null);
  };

  const handleRenameFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolderName.trim() || !renameFolderId) return;
    optimisticRenameFolder(renameFolderId, renameFolderName);
    setShowFolderRenameDialog(false);
    setRenameFolderName("");
    setRenameFolderId(null);
  };

  const handleDeleteFolder = useCallback(async (e: React.MouseEvent, folderId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete folder "${name}" and all its contents?`)) {
      const snapshot = useWorkspaceStore.getState();
      
      const deleteFolderRecursive = (id: string, allFolders: FolderType[]): string[] => {
        let ids = [id];
        const children = allFolders.filter((f) => f.parentId === id);
        children.forEach((c) => {
          ids = [...ids, ...deleteFolderRecursive(c.id, allFolders)];
        });
        return ids;
      };
      
      const folderIdsToDelete = deleteFolderRecursive(folderId, folders);
      
      const nextFolders = folders.filter((f) => !folderIdsToDelete.includes(f.id));
      const nextNotes = notes.filter((n) => !n.folderId || !folderIdsToDelete.includes(n.folderId));
      const nextStacks = stacks.filter((s) => !s.folderId || !folderIdsToDelete.includes(s.folderId));
      
      useWorkspaceStore.setState({
        folders: nextFolders,
        notes: nextNotes,
        stacks: nextStacks,
        syncState: "SAVING",
        isSaving: true,
      });
      
      try {
        await apiJson(`/api/folders/${folderId}`, { method: "DELETE" });
        useWorkspaceStore.setState({ syncState: "SAVED", isSaving: false });
        toast.success("Folder deleted");
      } catch {
        useWorkspaceStore.setState({
          folders: snapshot.folders,
          notes: snapshot.notes,
          stacks: snapshot.stacks,
          syncState: "ERROR",
          isSaving: false,
        });
        toast.error("Failed to delete folder");
      }
    }
  }, [folders, notes, stacks]);

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

  const treeActions = useMemo(() => ({
    setCreateFolderParentId,
    setShowFolderCreateDialog,
    createNoteInFolder,
    setStackTargetFolderId,
    setShowStackDialog,
    setRenameFolderId,
    setRenameFolderName,
    setShowFolderRenameDialog,
    handleDeleteFolder,
  }), [
    createNoteInFolder,
    handleDeleteFolder,
  ]);

  return (
    <div className="flex h-screen select-none">
      {/* Level 1: Ribbon - Actionable Buttons */}
      <div className="w-12 bg-[#0E0E0E] border-r border-[#27272A] flex flex-col items-center py-4 space-y-2 flex-shrink-0 z-20">
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
          onClick={() => createNoteInFolder(null)}
          className="h-10 w-10 rounded-none hover:bg-white/5"
          title="New Note"
        >
          <FileText className="h-5 w-5 text-[#A1A1AA]" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setStackTargetFolderId(null);
            setShowStackDialog(true);
          }}
          className="h-10 w-10 rounded-none hover:bg-white/5"
          title="New Stack — Create a structured table (spreadsheet-like) with typed columns"
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
          onClick={() => {
            openTab("singleton-records", "RECORDS", "Records");
            router.push("/workspace/records");
          }}
          className="h-10 w-10 rounded-none hover:bg-white/5"
          title="Records"
        >
          <Disc className="h-5 w-5 text-[#A1A1AA]" />
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
          className="h-10 w-10 rounded-none hover:bg-red-500/10 group"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 text-zinc-500 group-hover:text-red-400 transition-colors" />
        </Button>
      </div>

      {/* Level 2: Unified Explorer */}
      {isExplorerOpen && (
        <div className="w-72 bg-[#0E0E0E] border-r border-[#27272A] flex flex-col h-full relative flex-shrink-0 z-10">
          <div className="p-3 border-b border-[#27272A] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-tighter text-white uppercase font-technical">Workspace</h2>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-none hover:bg-white/5 text-[#A1A1AA] hover:text-white"
                  title="New Folder"
                  onClick={() => {
                    setCreateFolderParentId(null);
                    setShowFolderCreateDialog(true);
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
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
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search workspace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-[#131313] border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {mounted ? (
            <ExplorerTree searchQuery={searchQuery} sortMethod={sortMethod} actions={treeActions} />
          ) : (
            <div className="flex-1 overflow-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="flex justify-center items-center h-32 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}

          {/* Technical Status Bar */}
          <div className="p-3 border-t border-[#27272A] bg-[#0E0E0E] flex items-center justify-between text-xs font-mono text-[#A1A1AA] tracking-tight uppercase select-none">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
              </span>
              <SessionStopwatch />
            </div>
            <div>
              Sync: {syncState === "SAVING" ? "99%" : syncState === "ERROR" ? "ERR" : "100%"}
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Dialog */}
      <Dialog open={showFolderCreateDialog} onOpenChange={setShowFolderCreateDialog}>
        <DialogContent className="max-w-md bg-[#0E0E0E] border-[#27272A] p-4 text-white rounded-none">
          <DialogTitle className="text-sm font-semibold uppercase font-technical">Create Folder</DialogTitle>
          <form onSubmit={handleCreateFolderSubmit} className="space-y-4 mt-2">
            <Input
              type="text"
              placeholder="Folder name..."
              value={createFolderName}
              onChange={(e) => setCreateFolderName(e.target.value)}
              className="bg-[#131313] border-[#27272A] text-white focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" className="rounded-none hover:bg-white/5 text-zinc-400 hover:text-white" onClick={() => setShowFolderCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-none bg-[#10B981] text-[#0E0E0E] hover:bg-[#10B981]/90 font-medium">
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Folder Rename Dialog */}
      <Dialog open={showFolderRenameDialog} onOpenChange={setShowFolderRenameDialog}>
        <DialogContent className="max-w-md bg-[#0E0E0E] border-[#27272A] p-4 text-white rounded-none">
          <DialogTitle className="text-sm font-semibold uppercase font-technical">Rename Folder</DialogTitle>
          <form onSubmit={handleRenameFolderSubmit} className="space-y-4 mt-2">
            <Input
              type="text"
              placeholder="Folder name..."
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              className="bg-[#131313] border-[#27272A] text-white focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" className="rounded-none hover:bg-white/5 text-zinc-400 hover:text-white" onClick={() => setShowFolderRenameDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-none bg-[#10B981] text-[#0E0E0E] hover:bg-[#10B981]/90 font-medium">
                Rename
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stack Creation Dialog */}
      <Dialog open={showStackDialog} onOpenChange={setShowStackDialog}>
        <DialogContent className="max-w-5xl bg-[#0E0E0E] border-[#27272A] p-0 text-white overflow-hidden rounded-none">
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
