"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import StackAggregates from "@/components/workspace/StackAggregates";
import axios from "axios";
import toast from "react-hot-toast";
import { Stack, StackRow } from "@/lib/store";

interface StackTableProps {
  stack: Stack;
  onRowsChange: (rows: StackRow[]) => void;
}

export default function StackTable({ stack, onRowsChange }: StackTableProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rows, setRows] = useState(stack.rows);

  const addRow = async () => {
    const newData: Record<string, any> = {};
    stack.columns.forEach((col) => {
      // Initialize numeric columns with null instead of empty string
      if (col.type === "INT" || col.type === "FLOAT") {
        newData[col.id] = null;
      } else {
        newData[col.id] = "";
      }
    });

    try {
      const res = await axios.post(`/api/stacks/${stack.id}/rows`, {
        data: newData,
      });
      const updatedRows = [...rows, res.data];
      setRows(updatedRows);
      onRowsChange(updatedRows);
      toast.success("Row added");
    } catch (error) {
      toast.error("Failed to add row");
    }
  };

  const updateCell = async (
    rowId: string,
    columnId: string,
    value: any
  ) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const newData = { ...row.data, [columnId]: value };

    try {
      const res = await axios.put(`/api/stacks/${stack.id}/rows/${rowId}`, {
        data: newData,
      });
      const updatedRows = rows.map((r) =>
        r.id === rowId ? res.data : r
      );
      setRows(updatedRows);
      onRowsChange(updatedRows);
      setEditingCell(null);
    } catch (error) {
      toast.error("Failed to update row");
    }
  };

  const deleteRow = async (rowId: string) => {
    try {
      await axios.delete(`/api/stacks/${stack.id}/rows/${rowId}`);
      const updatedRows = rows.filter((r) => r.id !== rowId);
      setRows(updatedRows);
      onRowsChange(updatedRows);
      toast.success("Row deleted");
    } catch (error) {
      toast.error("Failed to delete row");
    }
  };

  const renderCellInput = (col: any, value: any) => {
    const isEditing =
      editingCell?.rowId === value.rowId &&
      editingCell?.columnId === col.id;

    if (col.type === "BOOLEAN") {
      return (
        <input
          type="checkbox"
          checked={value.value === true}
          onChange={(e) =>
            updateCell(value.rowId, col.id, e.target.checked)
          }
          className="rounded"
        />
      );
    }

    if (col.type === "INT" || col.type === "FLOAT") {
      return (
        <input
          type="number"
          value={value.value ?? ""}
          onFocus={() =>
            setEditingCell({ rowId: value.rowId, columnId: col.id })
          }
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const numValue =
              col.type === "INT"
                ? parseInt(editValue)
                : parseFloat(editValue);
            updateCell(value.rowId, col.id, numValue);
            setEditingCell(null);
          }}
          className="w-full px-2 py-1 border border-input rounded"
        />
      );
    }

    return (
      <input
        type="text"
        value={value.value ?? ""}
        onFocus={() =>
          setEditingCell({ rowId: value.rowId, columnId: col.id })
        }
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          updateCell(value.rowId, col.id, editValue);
          setEditingCell(null);
        }}
        className="w-full px-2 py-1 border border-input rounded"
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-xl font-bold">{stack.name}</h2>
        <Button onClick={addRow} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Add Row
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                {stack.columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-4 py-2 text-left font-semibold"
                  >
                    {col.name}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({col.type})
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2 w-12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  {stack.columns.map((col) => (
                    <td key={col.id} className="px-4 py-3">
                      {renderCellInput(col, {
                        rowId: row.id,
                        value: row.data[col.id],
                      })}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRow(row.id)}
                      className="h-6 w-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aggregates */}
      <StackAggregates stack={{ ...stack, rows }} />
    </div>
  );
}
