"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import StackTable from "@/components/workspace/StackTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/lib/store";
import { Trash2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function StackPage() {
  const params = useParams();
  const router = useRouter();
  const stackId = params.id as string;
  const [stack, setStack] = useState<any>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const { currentStackId, setCurrentStackId } = useWorkspaceStore();

  useEffect(() => {
    setCurrentStackId(stackId);
    fetchStack();
  }, [stackId]);

  const fetchStack = async () => {
    try {
      const res = await axios.get(`/api/stacks/${stackId}`);
      setStack(res.data);
      setName(res.data.name);
    } catch (error) {
      toast.error("Failed to load stack");
    } finally {
      setLoading(false);
    }
  };

  const updateName = async (newName: string) => {
    setName(newName);
    try {
      await axios.put(`/api/stacks/${stackId}`, { name: newName });
    } catch (error) {
      toast.error("Failed to update stack name");
    }
  };

  const deleteStack = async () => {
    if (!confirm("Are you sure you want to delete this stack?")) return;

    try {
      await axios.delete(`/api/stacks/${stackId}`);
      toast.success("Stack deleted");
      router.push("/workspace");
    } catch (error) {
      toast.error("Failed to delete stack");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading stack...</p>
      </div>
    );
  }

  if (!stack) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Stack not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between gap-4 bg-background/95">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => updateName(e.target.value)}
            placeholder="Stack name..."
            className="text-lg font-semibold"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {stack.columns.length} columns • {stack.rows.length} rows
          </p>
        </div>
        <Button
          variant="destructive"
          size="icon"
          onClick={deleteStack}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <StackTable
        stack={stack}
        onRowsChange={(rows) => {
          setStack((prev: any) => ({ ...prev, rows }));
        }}
      />
    </div>
  );
}
