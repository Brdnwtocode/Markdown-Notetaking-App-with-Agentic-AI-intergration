"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  MoreHorizontal,
  Type,
  Hash,
  Calendar as CalendarIcon,
  CheckSquare,
  Tag,
  ArrowUp,
  ArrowDown,
  Grid3X3,
  Layers,
  Filter,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Stack, StackColumn, StackRow } from "@/lib/store";
import { useWorkspaceStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

interface StackTableProps {
  stackId: string;
  initialStack: Stack;
  onSave: (stack: Stack) => void;
}

type ColumnType = "TEXT" | "INT" | "FLOAT" | "BOOLEAN" | "DATE" | "SELECT" | "FORMULA" | "RELATION";

interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

interface FilterConfig {
  columnId: string;
  type: "contains" | "equals" | "greater" | "less";
  value: string;
}

interface GroupConfig {
  columnId: string;
}

interface FormulaConfig {
  columnId: string;
  type: "SUM" | "COUNT" | "AVERAGE" | "PRODUCT";
  operandColumnId?: string;
}

export default function StackTable({ stackId, initialStack, onSave }: StackTableProps) {
  const [columns, setColumns] = useState<StackColumn[]>(initialStack.columns);
  const [rows, setRows] = useState<StackRow[]>(initialStack.rows);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnNameInput, setColumnNameInput] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [showGridLines, setShowGridLines] = useState(true);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [formulas, setFormulas] = useState<FormulaConfig[]>([]);
  const [filterValueInputs, setFilterValueInputs] = useState<Record<string, string>>({});
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [editingFormulaColumnId, setEditingFormulaColumnId] = useState<string | null>(null);
  const [selectedFormulaType, setSelectedFormulaType] = useState<"SUM" | "COUNT" | "AVERAGE" | "PRODUCT">("SUM");
  const [selectedOperandColumnId, setSelectedOperandColumnId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(initialStack.updatedAt);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeColumnIdRef = useRef<string | null>(null);
  const resizeStartWidthRef = useRef(0);
  const dragColumnRef = useRef<string | null>(null);
  const saveInProgressRef = useRef(false);
  
  const { notes, pendingMutation, setFocusedRow, setFocusedColumn, updateStack } = useWorkspaceStore();
  const router = useRouter();

  // Sync local rows/columns to the Zustand store so ContextPacker
  // always has the latest data (even unsaved edits).
  const syncStackToStore = (cols: StackColumn[], rws: StackRow[]) => {
    const storeStack = useWorkspaceStore.getState().stacks.find((s) => s.id === stackId);
    if (!storeStack) return;
    // Shallow compare to avoid unnecessary store updates
    if (storeStack.columns === cols && storeStack.rows === rws) return;
    updateStack({ ...storeStack, columns: cols, rows: rws });
  };

  // Mark as dirty when any user-driven changes happen (skip programmatic save sync)
  useEffect(() => {
    if (saveInProgressRef.current) {
      saveInProgressRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [columns, rows]);

  // Initialize column widths only for new columns, preserving existing widths
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      columns.forEach((col) => {
        if (!(col.id in next)) {
          next[col.id] = 180;
        }
      });
      return next;
    });
  }, [columns.map((c) => c.id).join(",")]);

  // Process rows (group, sort, filter)
  const processedData = useMemo(() => {
    let result = [...rows];

    // Apply filters
    filters.forEach((filter) => {
      result = result.filter((row) => {
        const value = row.data[filter.columnId];
        if (value === undefined || value === null) return false;

        switch (filter.type) {
          case "contains":
            return String(value).toLowerCase().includes(filter.value.toLowerCase());
          case "equals":
            return String(value).toLowerCase() === filter.value.toLowerCase();
          case "greater":
            return Number(value) > Number(filter.value);
          case "less":
            return Number(value) < Number(filter.value);
          default:
            return true;
        }
      });
    });

    // Apply sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a.data[sortConfig.columnId];
        const bVal = b.data[sortConfig.columnId];

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Apply grouping
    let groups: { [key: string]: StackRow[] } = {};
    if (groupConfig) {
      result.forEach((row) => {
        const key = String(row.data[groupConfig.columnId] || "Uncategorized");
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      });
    } else {
      groups[""] = result;
    }

    return groups;
  }, [rows, sortConfig, filters, groupConfig]);

  const addColumn = (type: ColumnType = "TEXT") => {
    const newColumn: StackColumn = {
      id: `temp_col_${Date.now()}`,
      stackId,
      name: "New Column",
      type: type as any,
      order: columns.length, // append to end
    };
    const newColumns = [...columns, newColumn];

    // Initialize empty data for existing rows
    const newRows = rows.map((row) => ({
      ...row,
      data: { ...row.data, [newColumn.id]: type === "TEXT" || type === "RELATION" ? "" : null },
    }));

    setColumns(newColumns);
    setRows(newRows);
    syncStackToStore(newColumns, newRows);
  };

  const deleteColumn = (columnId: string) => {
    const newColumns = columns.filter((col) => col.id !== columnId);
    const newRows = rows.map((row) => {
      const { [columnId]: _, ...restData } = row.data;
      return { ...row, data: restData };
    });
    setColumns(newColumns);
    setRows(newRows);
    syncStackToStore(newColumns, newRows);
    // Clear sort/filter/group for deleted column
    if (sortConfig?.columnId === columnId) {
      setSortConfig(null);
    }
    setFilters(filters.filter((f) => f.columnId !== columnId));
    setFormulas(formulas.filter((f) => f.columnId !== columnId && f.operandColumnId !== columnId));
    if (groupConfig?.columnId === columnId) {
      setGroupConfig(null);
    }
  };

  const updateColumnName = (columnId: string, newName: string) => {
    const newColumns = columns.map((col) =>
      col.id === columnId ? { ...col, name: newName || "Untitled Column" } : col
    );
    setColumns(newColumns);
    syncStackToStore(newColumns, rows);
  };

  const updateColumnType = (columnId: string, newType: ColumnType) => {
    const newColumns = columns.map((col) =>
      col.id === columnId ? { ...col, type: newType as any } : col
    );
    setColumns(newColumns);
    syncStackToStore(newColumns, rows);
  };

  const addRow = () => {
    const newData: Record<string, any> = {};
    columns.forEach((col) => {
      if (col.type === "INT" || col.type === "FLOAT") {
        newData[col.id] = null;
      } else if (col.type === "BOOLEAN") {
        newData[col.id] = false;
      } else {
        newData[col.id] = "";
      }
    });

    const newRow: StackRow = {
      id: `temp_row_${Date.now()}`,
      stackId,
      data: newData,
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    syncStackToStore(columns, newRows);
  };

  const deleteRow = (rowId: string) => {
    const newRows = rows.filter((row) => row.id !== rowId);
    setRows(newRows);
    syncStackToStore(columns, newRows);
  };

  const updateCell = (rowId: string, columnId: string, value: any) => {
    const newRows = rows.map((row) =>
      row.id === rowId ? { ...row, data: { ...row.data, [columnId]: value } } : row
    );
    setRows(newRows);
    syncStackToStore(columns, newRows);
  };

  // ─── Column drag-and-drop reordering ──────────────────────────────────

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    dragColumnRef.current = columnId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnId);
    // Make the dragged element slightly transparent
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const draggedId = dragColumnRef.current;
    if (!draggedId || draggedId === targetColumnId) return;

    const fromIndex = columns.findIndex((c) => c.id === draggedId);
    const toIndex = columns.findIndex((c) => c.id === targetColumnId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...columns];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Reassign order numbers based on new positions
    const finalColumns = reordered.map((col, i) => ({ ...col, order: i }));
    setColumns(finalColumns);
    syncStackToStore(finalColumns, rows);
    dragColumnRef.current = null;
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    dragColumnRef.current = null;
  };

  const handleRelationClick = (value: string) => {
    // Find note by title
    const note = notes.find((n) => n.title.toLowerCase() === value.toLowerCase());
    if (note) {
      router.push(`/workspace/notes/${note.id}`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Map frontend-only types to TEXT for database
      const dbColumns = columns.map((col) => ({
        ...col,
        type: (col.type === "FORMULA" || col.type === "RELATION") ? "TEXT" : col.type,
      }));
      const res = await axios.put(`/api/stacks/${stackId}`, {
        columns: dbColumns,
        rows,
      });
      // Sync local state with server response (replaces temp IDs with real IDs)
      // Preserve FORMULA/RELATION types that were downgraded to TEXT for DB storage
      const syncedColumns = res.data.columns.map((col: StackColumn, i: number) => {
        const originalType = columns[i]?.type;
        if (originalType === "FORMULA" || originalType === "RELATION") {
          return { ...col, type: originalType };
        }
        return col;
      });
      // Gate the dirty/width effects so they skip this programmatic update
      saveInProgressRef.current = true;
      setColumns(syncedColumns);
      setRows(res.data.rows);
      onSave(res.data);
      setLastUpdated(new Date().toISOString());
      setIsDirty(false);
      toast.success("Stack saved!");
    } catch {
      toast.error("Failed to save stack");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, columnId: string) => {
    isResizingRef.current = true;
    resizeColumnIdRef.current = columnId;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = columnWidths[columnId] || 180;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current || !resizeColumnIdRef.current) return;
    const deltaX = e.clientX - resizeStartXRef.current;
    const newWidth = Math.max(100, resizeStartWidthRef.current + deltaX);
    setColumnWidths((prev) => ({
      ...prev,
      [resizeColumnIdRef.current!]: newWidth,
    }));
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    resizeColumnIdRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const getTypeIcon = (type: ColumnType) => {
    switch (type) {
      case "TEXT":
      case "RELATION":
        return <Type className="h-3.5 w-3.5" />;
      case "INT":
      case "FLOAT":
        return <Hash className="h-3.5 w-3.5" />;
      case "BOOLEAN":
        return <CheckSquare className="h-3.5 w-3.5" />;
      case "DATE":
        return <CalendarIcon className="h-3.5 w-3.5" />;
      case "SELECT":
        return <Tag className="h-3.5 w-3.5" />;
      case "FORMULA":
        return <Hash className="h-3.5 w-3.5" />;
      default:
        return <Type className="h-3.5 w-3.5" />;
    }
  };

  const getColumnTypeLabel = (type: ColumnType) => {
    switch (type) {
      case "TEXT":
        return "Text";
      case "INT":
        return "Number (integer)";
      case "FLOAT":
        return "Number (decimal)";
      case "BOOLEAN":
        return "Checkbox";
      case "DATE":
        return "Date";
      case "SELECT":
        return "Select/Tag";
      case "FORMULA":
        return "Formula";
      case "RELATION":
        return "Relation/Link";
      default:
        return "Text";
    }
  };

  const calculateFormula = (formula: FormulaConfig) => {
    const values = rows
      .map((row) => row.data[formula.operandColumnId || ""])
      .filter((val) => Number.isFinite(Number(val)))
      .map((val) => Number(val));

    switch (formula.type) {
      case "SUM":
        return values.reduce((a, b) => a + b, 0);
      case "COUNT":
        return values.length;
      case "AVERAGE":
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      default:
        return 0;
    }
  };

  const getFormulaResult = (columnId: string) => {
    const formula = formulas.find(f => f.columnId === columnId);
    if (!formula) return null;
    return calculateFormula(formula);
  };

  const copyTable = () => {
    const headers = columns.map((col) => col.name).join("\t");
    const csvRows = Object.values(processedData).flat().map((row) =>
      columns.map((col) => row.data[col.id] ?? "").join("\t")
    );
    const text = [headers, ...csvRows].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Table copied to clipboard!");
  };

  const copyRow = (row: StackRow) => {
    const text = columns.map((col) => row.data[col.id] ?? "").join("\t");
    navigator.clipboard.writeText(text);
    toast.success("Row copied to clipboard!");
  };

  const copyColumn = (column: StackColumn) => {
    const text = Object.values(processedData).flat().map((row) => row.data[column.id] ?? "").join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Column copied to clipboard!");
  };

  const openFormulaDialog = (columnId: string) => {
    const existingFormula = formulas.find(f => f.columnId === columnId);
    if (existingFormula) {
      setSelectedFormulaType(existingFormula.type);
      setSelectedOperandColumnId(existingFormula.operandColumnId || null);
    } else {
      setSelectedFormulaType("SUM");
      setSelectedOperandColumnId(columns.find(c => c.type === "INT" || c.type === "FLOAT")?.id || null);
    }
    setEditingFormulaColumnId(columnId);
    setFormulaDialogOpen(true);
  };

  const saveFormula = () => {
    if (!editingFormulaColumnId) return;
    setFormulas([...formulas.filter(f => f.columnId !== editingFormulaColumnId), {
      columnId: editingFormulaColumnId,
      type: selectedFormulaType,
      operandColumnId: selectedOperandColumnId || undefined,
    }]);
    setFormulaDialogOpen(false);
    setEditingFormulaColumnId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0E0E0E]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#27272A] bg-[#131313]">
        <div className="flex items-center gap-4">
          <Button
            onClick={addRow}
            variant="secondary"
            size="sm"
            className="text-white hover:border-[#10B981]"
          >
            <Plus className="h-4 w-4 mr-1 text-[#10B981]" />
            New row
          </Button>
          <Button
            onClick={() => setShowGridLines(!showGridLines)}
            variant="secondary"
            size="sm"
            className="text-white hover:border-[#10B981]"
          >
            <Grid3X3 className="h-4 w-4 mr-1 text-[#10B981]" />
            {showGridLines ? "Hide Grid" : "Show Grid"}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="text-white hover:border-[#10B981]"
              >
                <Layers className="h-4 w-4 mr-1 text-[#10B981]" />
                {groupConfig ? "Ungroup" : "Group"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="bg-[#131313] border border-[#27272A] rounded-none max-h-[60vh] overflow-y-auto"
              avoidCollisions={true}
              collisionPadding={8}
              sideOffset={4}
            >
              <DropdownMenuLabel className="font-technical text-[10px] text-[#A1A1AA] uppercase">Group by</DropdownMenuLabel>
              {columns.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() =>
                    setGroupConfig(
                      groupConfig?.columnId === col.id ? null : { columnId: col.id }
                    )
                  }
                  className="hover:bg-white/5 text-white rounded-none text-xs"
                >
                  {col.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={copyTable}
            variant="secondary"
            size="sm"
            className="text-white hover:border-[#10B981]"
          >
            <Copy className="h-4 w-4 mr-1 text-[#10B981]" />
            Copy Table
          </Button>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {isDirty && (
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isSaving}
              variant="technical"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
          <p className="text-[10px] text-zinc-500 font-technical uppercase">
            * {new Date(lastUpdated).toLocaleTimeString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto relative"
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[#27272A] bg-[#131313]">
              {columns.map((col) => (
                <th
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragEnd={handleDragEnd}
                  className={`text-left text-sm font-semibold text-white select-none relative ${
                    showGridLines ? "border-r border-[#27272A]" : ""
                  }`}
                  style={{ width: columnWidths[col.id] || 180 }}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div 
                      className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5"
                      onClick={() => {
                        if (!editingColumnId) {
                          copyColumn(col);
                        }
                      }}
                    >
                      {getTypeIcon(col.type as ColumnType)}
                      {editingColumnId === col.id ? (
                        <Input
                          type="text"
                          value={columnNameInput}
                          onChange={(e) => setColumnNameInput(e.target.value)}
                          onBlur={() => {
                            updateColumnName(col.id, columnNameInput);
                            setEditingColumnId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateColumnName(col.id, columnNameInput);
                              setEditingColumnId(null);
                            }
                          }}
                          autoFocus
                          className="h-7 bg-transparent border-none px-1 py-0 text-sm focus-visible:ring-0"
                        />
                      ) : (
                        <span
                          className="truncate cursor-pointer hover:text-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColumnNameInput(col.name);
                            setEditingColumnId(col.id);
                          }}
                        >
                          {col.name}
                        </span>
                      )}
                    </div>

                    {/* Column Menu */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-white/5"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end" 
                        side="bottom"
                        className="w-56 bg-zinc-900/100 backdrop-blur-md border border-zinc-700/100 max-h-[60vh] overflow-y-auto"
                        sideOffset={4}
                        avoidCollisions={true}
                        collisionPadding={8}
                      >
                        <DropdownMenuLabel>Sort</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            setSortConfig({ columnId: col.id, direction: "asc" })
                          }
                        >
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Sort Ascending
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setSortConfig({ columnId: col.id, direction: "desc" })
                          }
                        >
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Sort Descending
                        </DropdownMenuItem>
                        {sortConfig?.columnId === col.id && (
                          <DropdownMenuItem onClick={() => setSortConfig(null)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Sort
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Filter</DropdownMenuLabel>
                        {(col.type === "TEXT" || col.type === "SELECT" || col.type === "RELATION") && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                const existing = filters.find(f => f.columnId === col.id && f.type === "contains");
                                if (existing) return;
                                setFilters([...filters, { columnId: col.id, type: "contains", value: "" }]);
                              }}
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Contains...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const existing = filters.find(f => f.columnId === col.id && f.type === "equals");
                                if (existing) return;
                                setFilters([...filters, { columnId: col.id, type: "equals", value: "" }]);
                              }}
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Equals...
                            </DropdownMenuItem>
                          </>
                        )}
                        {(col.type === "INT" || col.type === "FLOAT") && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                const existing = filters.find(f => f.columnId === col.id && f.type === "greater");
                                if (existing) return;
                                setFilters([...filters, { columnId: col.id, type: "greater", value: "" }]);
                              }}
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Greater than...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const existing = filters.find(f => f.columnId === col.id && f.type === "less");
                                if (existing) return;
                                setFilters([...filters, { columnId: col.id, type: "less", value: "" }]);
                              }}
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Less than...
                            </DropdownMenuItem>
                          </>
                        )}
                        {filters.some(f => f.columnId === col.id) && (
                          <DropdownMenuItem onClick={() => setFilters(filters.filter(f => f.columnId !== col.id))}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Filters
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Type</DropdownMenuLabel>
                        {["TEXT", "INT", "FLOAT", "BOOLEAN", "DATE", "SELECT", "FORMULA", "RELATION"].map(
                          (type) => (
                            <DropdownMenuItem
                              key={type}
                              onClick={() => updateColumnType(col.id, type as ColumnType)}
                            >
                              {getTypeIcon(type as ColumnType)}
                              <span className="ml-2">
                                {getColumnTypeLabel(type as ColumnType)}
                              </span>
                            </DropdownMenuItem>
                          )
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => copyColumn(col)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Column
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteColumn(col.id)}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-500/30"
                      onMouseDown={(e) => handleMouseDown(e, col.id)}
                    />
                  </div>
                </th>
              ))}
              {/* Add Column Button */}
              <th className="text-left text-sm w-32 border-r-0">
                <div className="px-3 py-2">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="start" 
                      className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 max-h-[60vh] overflow-y-auto"
                      avoidCollisions={true}
                      collisionPadding={8}
                      sideOffset={4}
                    >
                      {["TEXT", "INT", "FLOAT", "BOOLEAN", "DATE", "SELECT", "FORMULA", "RELATION"].map(
                        (type) => (
                          <DropdownMenuItem
                            key={type}
                            onClick={() => addColumn(type as ColumnType)}
                          >
                            {getTypeIcon(type as ColumnType)}
                            <span className="ml-2">
                              {getColumnTypeLabel(type as ColumnType)}
                            </span>
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </th>
            </tr>
            {/* Filter inputs row */}
            {filters.length > 0 && (
              <tr className="border-b border-[#27272A] bg-[#131313]">
                {columns.map((col) => {
                  const colFilters = filters.filter(f => f.columnId === col.id);
                  return (
                    <th
                      key={`filter-${col.id}`}
                      className={`text-left text-sm font-medium text-slate-300 ${
                        showGridLines ? "border-r border-[#27272A]" : ""
                      }`}
                      style={{ width: columnWidths[col.id] || 180 }}
                    >
                      <div className="px-3 py-1">
                        {colFilters.map((filter, idx) => (
                          <Input
                            key={idx}
                            type="text"
                            value={filterValueInputs[`${col.id}-${filter.type}`] || ""}
                            onChange={(e) => {
                              setFilterValueInputs(prev => ({
                                ...prev,
                                [`${col.id}-${filter.type}`]: e.target.value
                              }));
                              setFilters(filters.map(f => 
                                f.columnId === col.id && f.type === filter.type 
                                  ? { ...f, value: e.target.value } 
                                  : f
                              ));
                            }}
                            placeholder={`${filter.type}...`}
                            className="h-6 bg-transparent border border-[#27272A] px-2 text-xs text-white placeholder:text-zinc-500 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        ))}
                      </div>
                    </th>
                  );
                })}
                <th className="text-left text-sm w-32 border-r-0" />
              </tr>
            )}
          </thead>
          <tbody>
            {Object.entries(processedData).map(([groupKey, groupRows]) => (
              <React.Fragment key={groupKey}>
                {groupConfig && groupKey && (
                  <tr className="bg-[#131313]">
                    <td
                      colSpan={columns.length + 1}
                      className="px-3 py-2 text-sm font-semibold text-slate-300 font-technical uppercase"
                    >
                      {groupKey} ({groupRows.length})
                    </td>
                  </tr>
                )}
                {groupRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`${showGridLines ? "border-b border-[#27272A]" : ""} hover:bg-[#1A1A1A] group transition-colors duration-100 ${
                      row.id === useWorkspaceStore.getState().focusedRowId ? "bg-white/5" : ""
                    }`}
                    onClick={() => {
                      setFocusedRow(row.id);
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${row.id}-${col.id}`}
                        className={`px-3 py-1.5 ${
                          showGridLines ? "border-r border-[#27272A]" : ""
                        } ${row.id === useWorkspaceStore.getState().focusedRowId && col.id === useWorkspaceStore.getState().focusedColumnId ? "ring-1 ring-[#10B981]" : ""}`}
                        style={{ width: columnWidths[col.id] || 180 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedRow(row.id);
                          setFocusedColumn(col.id);
                        }}
                      >
                        {col.type === "BOOLEAN" ? (
                          <input
                            type="checkbox"
                            checked={!!row.data[col.id]}
                            onChange={(e) => updateCell(row.id, col.id, e.target.checked)}
                            className="rounded-none h-4 w-4 accent-[#10B981] border-[#27272A] bg-transparent"
                          />
                        ) : col.type === "INT" || col.type === "FLOAT" ? (
                          <input
                            type="number"
                            step={col.type === "FLOAT" ? "any" : "1"}
                            value={row.data[col.id] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                updateCell(row.id, col.id, null);
                              } else {
                                updateCell(
                                  row.id,
                                  col.id,
                                  col.type === "INT" ? parseInt(val) : parseFloat(val)
                                );
                              }
                            }}
                            className="w-full bg-transparent border-none text-sm text-white focus-visible:ring-0 px-1 py-0.5 font-technical"
                            placeholder="0"
                          />
                        ) : col.type === "DATE" ? (
                          <input
                            type="date"
                            value={row.data[col.id] ?? ""}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            className="w-full bg-transparent border-none text-sm text-white focus-visible:ring-0 px-1 py-0.5 font-technical"
                          />
                        ) : col.type === "FORMULA" ? (
                          <div className="flex items-center gap-1 px-1 py-0.5">
                            <div className="text-sm text-white font-medium font-technical">
                              {(() => {
                                const result = getFormulaResult(col.id);
                                return result !== null ? result : "-";
                              })()}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openFormulaDialog(col.id)}
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 rounded-none hover:bg-white/5"
                            >
                              <MoreHorizontal className="h-3 w-3 text-zinc-400" />
                            </Button>
                          </div>
                        ) : col.type === "RELATION" ? (
                          <button
                            onClick={() => handleRelationClick(row.data[col.id] as string)}
                            className="text-[#10B981] hover:text-[#10B981]/80 text-sm px-1 py-0.5 underline decoration-[#10B981]/30 hover:decoration-[#10B981] transition-colors"
                          >
                            {row.data[col.id] || "Click to link..."}
                          </button>
                        ) : (
                          <input
                            type="text"
                            value={row.data[col.id] ?? ""}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            className="w-full bg-transparent border-none text-sm text-white focus-visible:ring-0 px-1 py-0.5"
                            placeholder="Text"
                          />
                        )}
                      </td>
                    ))}
                    {/* Row Actions */}
                    <td className="px-3 py-1.5 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyRow(row)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-white rounded-none border border-transparent hover:border-[#27272A] transition-all"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRow(row.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-[#EF4444]/10 hover:text-[#EF4444] rounded-none border border-transparent hover:border-[#EF4444]/30 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
                       {/* AI Confirmation Gate Row */}
            {pendingMutation?.type === "add_stack_row" && pendingMutation.stackId === stackId && (
              <tr className="bg-[#10B9810D] border-y border-[#27272A] group relative">
                {columns.map((col, index) => (
                  <td
                    key={`pending-${col.id}`}
                    className={`px-3 py-1.5 relative ${
                      showGridLines ? "border-r border-[#27272A]" : ""
                    } ${index === 0 ? "border-l-4 border-l-[#10B981]" : ""}`}
                    style={{ width: columnWidths[col.id] || 180 }}
                  >
                    <div className="w-full text-sm text-[#10B981]/90 px-1 py-0.5 cursor-not-allowed font-mono">
                      {col.type === "BOOLEAN" ? (
                        <input
                          type="checkbox"
                          checked={!!pendingMutation.data[col.id]}
                          readOnly
                          className="rounded-none h-4 w-4 opacity-70 accent-[#10B981]"
                        />
                      ) : (
                        String(pendingMutation.data[col.id] ?? "")
                      )}
                    </div>
                  </td>
                ))}
                <td className="px-3 py-1.5"></td>
              </tr>
            )}
            
            {/* AI Confirmation Gate for Bulk Update */}
            {pendingMutation?.type === "bulk_update_stack" && pendingMutation.stackId === stackId && (
              <tr className="bg-[#10B9810D] border-y border-[#27272A] group relative">
                <td colSpan={columns.length + 1} className="px-3 py-3 border-l-4 border-l-[#10B981]">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#10B981] uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                    </span>
                    AI Suggested Bulk Update ({pendingMutation.updates.length} row(s))
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
 
        {/* Empty State / Add Row */}
        {Object.values(processedData).every((g) => g.length === 0) && (
          <div className="px-6 py-12 text-center text-zinc-500 font-technical uppercase">
            <p className="text-sm">No rows yet</p>
            <Button
              onClick={addRow}
              variant="secondary"
              className="mt-4 text-white hover:border-[#10B981]"
            >
              <Plus className="h-4 w-4 mr-2 text-[#10B981]" />
              Add a row
            </Button>
          </div>
        )}
      </div>
 
      {/* Formula Configuration Dialog */}
      <Dialog open={formulaDialogOpen} onOpenChange={setFormulaDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#131313] border border-[#27272A] rounded-none">
          <DialogHeader>
            <DialogTitle className="text-white font-technical uppercase text-sm">Configure Formula</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-400 font-technical uppercase">Formula Type</label>
              <select
                value={selectedFormulaType}
                onChange={(e) => setSelectedFormulaType(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#27272A] rounded-none bg-[#0E0E0E] text-white focus:border-[#10B981] focus:outline-none text-sm font-technical"
              >
                <option value="SUM">Sum</option>
                <option value="COUNT">Count</option>
                <option value="AVERAGE">Average</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-400 font-technical uppercase">Column</label>
              <select
                value={selectedOperandColumnId || ""}
                onChange={(e) => setSelectedOperandColumnId(e.target.value || null)}
                className="w-full px-3 py-2 border border-[#27272A] rounded-none bg-[#0E0E0E] text-white focus:border-[#10B981] focus:outline-none text-sm font-technical"
              >
                {columns.filter(c => c.type === "INT" || c.type === "FLOAT").map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button onClick={() => setFormulaDialogOpen(false)} variant="secondary" className="text-white">
              Cancel
            </Button>
            <Button onClick={saveFormula} variant="technical">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
