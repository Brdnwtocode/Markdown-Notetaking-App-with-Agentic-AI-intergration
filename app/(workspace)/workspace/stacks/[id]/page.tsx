"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StackTable from "@/components/workspace/StackTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/lib/store";
import { Trash2, Download, MoreVertical, Info, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";
import { toast } from "@/lib/toast";

export default function StackPage() {
  const params = useParams();
  const router = useRouter();
  const stackId = params.id as string;
  const [stack, setStack] = useState<any>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showStackInfo, setShowStackInfo] = useState(false);
  const { setCurrentStackId, stacks, optimisticRenameStack, openTab, updateStack } = useWorkspaceStore();

  useEffect(() => {
    setCurrentStackId(stackId);
    fetchStack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId]);

  const fetchStack = async () => {
    const cached = stacks.find((s) => s.id === stackId);
    if (cached) {
      setStack(cached);
      setName(cached.name);
      openTab(stackId, "STACK", cached.name || "Untitled Stack");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`/api/stacks/${stackId}`);
      setStack(res.data);
      setName(res.data.name);
      openTab(stackId, "STACK", res.data.name || "Untitled Stack");
    } catch {
      toast.error("Failed to load stack");
    } finally {
      setLoading(false);
    }
  };

  const updateName = async (newName: string) => {
    setName(newName);
    optimisticRenameStack(stackId, newName);
  };

  const handleStackSave = (updatedStack: any) => {
    setStack(updatedStack);
    setName(updatedStack.name);
    updateStack(updatedStack);
    openTab(stackId, "STACK", updatedStack.name || "Untitled Stack");
  };

  const exportAsCSV = async () => {
    try {
      const res = await axios.get(`/api/stacks/${stackId}`);
      const { name, columns, rows } = res.data;

      // Create CSV header
      const headers = columns.map((col: any) => col.name).join(",");

      // Create CSV rows
      const csvRows = rows.map((row: any) =>
        columns
          .map((col: any) => {
            const value = row.data[col.id];
            // Escape quotes and wrap in quotes if contains commas
            if (typeof value === "string" && value.includes(",")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? "";
          })
          .join(",")
      );

      const csv = [headers, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "stack"}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Stack exported as CSV");
    } catch (error) {
      toast.error("Failed to export stack");
    }
  };

  const deleteStack = async () => {
    if (!confirm("Are you sure you want to delete this stack?")) return;

    try {
      await axios.delete(`/api/stacks/${stackId}`);
      toast.success("Stack deleted");
      router.push("/workspace");
    } catch {
      toast.error("Failed to delete stack");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
        <p className="text-muted-foreground">Loading stack...</p>
      </div>
    );
  }

  if (!stack) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
        <p className="text-muted-foreground">Stack not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Stack Info Banner */}
      {showStackInfo && (
        <div className="px-4 py-3 border-b border-[#10B981]/20 bg-[#10B981]/5 flex items-start gap-3">
          <Info className="h-4 w-4 text-[#10B981] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium">About Stacks</p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              A <strong className="text-zinc-200">Stack</strong> is a structured table where each column has a defined data type (text, number, date, checkbox, etc.). Use stacks to organize structured data like research results, task lists, or inventories.
              <br />
              <span className="text-[#10B981]">▸ Click any row</span> to focus it — the AI agent sees focused rows as context.{" "}
              <span className="text-[#10B981]">▸ Check the box</span> next to a row to multi-select for bulk copy/delete.{" "}
              <span className="text-[#10B981]">▸ Right-click</span> a column header for sort, filter, and type options.
            </p>
          </div>
          <button onClick={() => setShowStackInfo(false)} className="p-1 text-zinc-500 hover:text-white flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="border-b border-zinc-700/30 p-4 flex items-center justify-between gap-4 bg-[#262626]">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => updateName(e.target.value)}
            placeholder="Stack name..."
            className="text-lg font-semibold bg-transparent border-none focus:ring-0 text-slate-200"
          />
          <p className="text-xs text-slate-500 mt-1">
            {stack.columns.length} columns • {stack.rows.length} rows
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowStackInfo(!showStackInfo)}
            className="h-8 w-8 hover:bg-white/5"
            title="What is a Stack?"
          >
            <Info className="h-4 w-4 text-slate-400" />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                <MoreVertical className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 max-h-[60vh] overflow-y-auto"
            avoidCollisions={true}
            collisionPadding={8}
            sideOffset={4}
          >
            <DropdownMenuItem onClick={exportAsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={deleteStack} className="text-red-400 focus:text-red-400">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Stack
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>

      <StackTable
        stackId={stackId}
        initialStack={stack}
        onSave={handleStackSave}
      />
    </div>
  );
}
