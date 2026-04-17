"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export interface ColumnDefinition {
  name: string;
  type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN";
}

const DATA_TYPES = ["TEXT", "INT", "FLOAT", "BOOLEAN"] as const;

interface SchemaBuilderProps {
  onConfirm: (columns: ColumnDefinition[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function SchemaBuilder({
  onConfirm,
  onCancel,
  isLoading = false,
}: SchemaBuilderProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: "Name", type: "TEXT" },
  ]);

  const addColumn = () => {
    setColumns([...columns, { name: "", type: "TEXT" }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const updateColumn = (
    index: number,
    field: keyof ColumnDefinition,
    value: string
  ) => {
    const updatedColumns = [...columns];
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value,
    };
    setColumns(updatedColumns);
  };

  const isValid = columns.every((col) => col.name.trim() !== "");

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold mb-3">Define Stack Columns</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {columns.map((col, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">
                  Column Name
                </label>
                <Input
                  value={col.name}
                  onChange={(e) =>
                    updateColumn(index, "name", e.target.value)
                  }
                  placeholder="e.g., Product Name"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={col.type}
                  onChange={(e) =>
                    updateColumn(
                      index,
                      "type",
                      e.target.value as ColumnDefinition["type"]
                    )
                  }
                  className="w-full px-2 py-2 border border-input rounded text-sm"
                >
                  {DATA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeColumn(index)}
                disabled={columns.length === 1}
                className="h-10 w-10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={addColumn}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" /> Add Column
      </Button>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(columns)}
          disabled={!isValid || isLoading}
          className="flex-1"
        >
          {isLoading ? "Creating..." : "Create Stack"}
        </Button>
      </div>
    </div>
  );
}
