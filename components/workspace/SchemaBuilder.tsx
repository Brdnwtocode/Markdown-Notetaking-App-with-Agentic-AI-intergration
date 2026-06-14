"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, ChevronDown, Check, Info, BookOpen, Lightbulb } from "lucide-react";
import { toast } from "@/lib/toast";

export interface ColumnDefinition {
  name: string;
  type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN" | "DATE" | "SELECT" | "FORMULA" | "RELATION";
}

const DATA_TYPES: ColumnDefinition["type"][] = [
  "TEXT",
  "INT",
  "FLOAT",
  "BOOLEAN",
  "DATE",
  "SELECT",
  "FORMULA",
  "RELATION"
];

// Helper to get capsule badge styles and labels for each datatype
const getTypeDetails = (type: ColumnDefinition["type"]) => {
  switch (type) {
    case "TEXT":
      return { label: "TEXT", prefix: "Tt", class: "bg-teal-500/10 border-teal-500/30 text-teal-400" };
    case "INT":
      return { label: "INT", prefix: "#", class: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" };
    case "FLOAT":
      return { label: "DECIMAL", prefix: "#", class: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" };
    case "BOOLEAN":
      return { label: "BOOL", prefix: "☑", class: "bg-purple-500/10 border-purple-500/30 text-purple-400" };
    case "DATE":
      return { label: "DATE", prefix: "📅", class: "bg-amber-500/10 border-amber-500/30 text-amber-400" };
    case "SELECT":
      return { label: "TAG", prefix: "🏷", class: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" };
    case "FORMULA":
      return { label: "CALC", prefix: "ƒ", class: "bg-rose-500/10 border-rose-500/30 text-rose-400" };
    case "RELATION":
      return { label: "RELATION", prefix: "🔗", class: "bg-blue-500/10 border-blue-500/30 text-blue-400" };
    default:
      return { label: "TEXT", prefix: "Tt", class: "bg-teal-500/10 border-teal-500/30 text-teal-400" };
  }
};

const getDummyValue = (type: ColumnDefinition["type"]) => {
  switch (type) {
    case "TEXT":
      return "Research Paper Alpha";
    case "INT":
      return "42";
    case "FLOAT":
      return "0.98";
    case "BOOLEAN":
      return "TRUE";
    case "DATE":
      return "2026-06-07";
    case "SELECT":
      return "Active";
    case "FORMULA":
      return "SUM(12.5, 45.1)";
    case "RELATION":
      return "system_architecture_draft_v3.png";
    default:
      return "Value";
  }
};

interface SchemaBuilderProps {
  onConfirm: (columns: ColumnDefinition[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  stackName: string;
  setStackName: (val: string) => void;
}

export default function SchemaBuilder({
  onConfirm,
  onCancel,
  isLoading = false,
  stackName,
  setStackName,
}: SchemaBuilderProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: "Source_Title", type: "TEXT" },
    { name: "Confidence_Score", type: "FLOAT" },
  ]);

  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showInfo, setShowInfo] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleConfirm = () => {
    const lowerCaseNames = columns.map((col) => col.name.toLowerCase().trim());
    const uniqueNames = new Set(lowerCaseNames);

    if (uniqueNames.size !== lowerCaseNames.length) {
      toast.error("Column names must be unique (case-insensitive)");
      return;
    }

    onConfirm(columns);
  };

  return (
    <div className="grid grid-cols-12 w-full text-white bg-[#0E0E0E]">
      {/* ── Left Panel: Schema Definition (col-span-5, 4:6 ratio) ── */}
      <div className="col-span-5 p-6 flex flex-col border-r border-[#27272A] min-h-[600px]">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-0.5">
            <div className="text-[10px] text-[#10B981] font-technical uppercase tracking-wider flex items-center gap-1.5">
              <span className="bg-[#10B981]/15 px-1.5 py-0.5 border border-[#10B981]/30">CMD + N</span>
              <span>Stack Creation</span>
            </div>
            <h2 className="text-lg font-bold uppercase tracking-tight font-technical text-white">
              Define Schema
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowInfo(!showInfo)}
              className={`h-8 w-8 rounded-none ${showInfo ? "bg-[#10B981]/10 text-[#10B981]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
              title="What is a Stack?"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-none"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toggleable Onboarding / Info Panel */}
        {showInfo && (
          <div className="mb-4 p-4 border border-[#10B981]/20 bg-[#10B981]/5 space-y-3">
            <div className="flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">What is a Stack?</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  A Stack is a <strong className="text-zinc-200">structured data table</strong> — like a spreadsheet but with strong typing. Each column has a fixed data type and each row is a record.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">How to define a Stack</p>
                <ul className="text-xs text-zinc-400 mt-0.5 space-y-0.5 leading-relaxed list-disc list-inside">
                  <li>Give each <strong className="text-zinc-200">column</strong> a unique name and a data type below</li>
                  <li>Use <strong className="text-zinc-200">TEXT</strong> for strings, <strong className="text-zinc-200">INT/FLOAT</strong> for numbers, <strong className="text-zinc-200">BOOLEAN</strong> for true/false</li>
                  <li>Use <strong className="text-zinc-200">DATE</strong> for calendar dates, <strong className="text-zinc-200">SELECT</strong> for tag-like values</li>
                  <li><strong className="text-zinc-200">FORMULA</strong> computes values from other columns; <strong className="text-zinc-200">RELATION</strong> links to notes</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Primary use cases</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  Research data tracking • Task inventories • Experiment logs • Structured note companions • AI-populated datasets
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Schema Definition — prominent title */}
        <div className="flex items-center justify-between mb-2 mt-1">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 bg-[#10B981]" />
            <label className="text-xs text-[#10B981] uppercase tracking-wider font-technical font-semibold">
              Schema Definition
            </label>
          </div>
          <span className="text-[10px] text-zinc-500 font-technical tabular-nums">
            {columns.length}/20
          </span>
        </div>

        {/* Properties Table */}
        <div className="flex-1 overflow-y-auto max-h-[350px] border border-[#27272A] bg-[#131313] mb-4 relative" ref={dropdownRef}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1C1C1E] border-b border-[#27272A] text-[10px] text-zinc-500 font-technical uppercase">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Property Name</th>
                <th className="py-3 px-4 w-44">Type</th>
                <th className="py-3 px-4 w-14 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => {
                const typeInfo = getTypeDetails(col.type);
                const isDropdownOpen = activeDropdownIndex === idx;

                return (
                  <tr key={idx} className="border-b border-[#27272A] hover:bg-white/5 transition-colors">
                    {/* Index */}
                    <td className="py-3 px-4 text-center font-technical text-zinc-500">
                      {String(idx + 1).padStart(2, "0")}
                    </td>

                    {/* Name Input */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => updateColumn(idx, "name", e.target.value)}
                        placeholder="property_name"
                        className="w-full h-9 bg-transparent border-0 focus:outline-none focus:ring-0 text-white font-technical placeholder:text-zinc-700"
                      />
                    </td>

                    {/* Type Selector Dropdown */}
                    <td className="py-2 px-4 relative">
                      <button
                        type="button"
                        onClick={() => setActiveDropdownIndex(isDropdownOpen ? null : idx)}
                        className="flex items-center justify-between w-full h-9 px-3 bg-[#0E0E0E] border border-[#27272A] hover:border-zinc-500 font-technical text-[10px]"
                      >
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-semibold ${typeInfo.class}`}>
                          <span className="opacity-70">{typeInfo.prefix}</span>
                          <span>{typeInfo.label}</span>
                        </div>
                        <ChevronDown className="h-3 w-3 text-zinc-500" />
                      </button>

                      {/* Floating custom dropdown */}
                      {isDropdownOpen && (
                        <div className="absolute left-4 top-full mt-1.5 w-44 bg-[#0E0E0E] border border-[#27272A] z-50 p-1 shadow-2xl space-y-0.5">
                          {DATA_TYPES.map((typeOption) => {
                            const optDetails = getTypeDetails(typeOption);
                            return (
                              <button
                                type="button"
                                key={typeOption}
                                onClick={() => {
                                  updateColumn(idx, "type", typeOption);
                                  setActiveDropdownIndex(null);
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 font-technical text-left"
                              >
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-semibold ${optDetails.class}`}>
                                  <span className="opacity-70">{optDetails.prefix}</span>
                                  <span>{optDetails.label}</span>
                                </div>
                                {col.type === typeOption && <Check className="h-3.5 w-3.5 text-[#10B981]" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Delete action */}
                    <td className="py-2 px-4 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeColumn(idx)}
                        disabled={columns.length === 1}
                        className="h-8 w-8 rounded-none hover:bg-[#EF4444]/10 hover:text-[#EF4444] text-zinc-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Append button */}
        <button
          type="button"
          onClick={addColumn}
          className="w-full h-11 border border-dashed border-[#27272A] hover:border-[#10B981]/60 text-zinc-500 hover:text-white flex items-center justify-center gap-2 text-xs font-technical uppercase tracking-wider transition-colors mt-auto"
        >
          <Plus className="h-3.5 w-3.5 text-[#10B981]" /> Add Column
        </button>
      </div>

      {/* ── Right Panel: Label + Live Preview + Confirm (col-span-7, 4:6 ratio) ── */}
      <div className="col-span-7 p-6 bg-[#131313] flex flex-col min-h-[600px]">
        {/* Stack Label — moved to right panel */}
        <div className="space-y-1.5 mb-4">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
            Stack Label
          </label>
          <Input
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            placeholder="e.g., Research_Engine_v1"
            className="h-10 bg-[#0E0E0E] border-[#27272A] text-sm text-white placeholder:text-zinc-600 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Live Preview */}
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-technical">
              Live Preview
            </h3>
            <span className="text-[9px] text-zinc-600 font-technical uppercase">8 sample rows</span>
          </div>

          {/* Multi-Row Table Preview */}
          <div className="border border-[#27272A] bg-[#0E0E0E] flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Table header */}
            <div className="flex border-b border-[#27272A] bg-[#1C1C1E] shrink-0">
              {columns.filter(c => c.name.trim()).length > 0 ? (
                columns.filter(c => c.name.trim()).map((col, idx) => (
                  <div
                    key={idx}
                    className="flex-1 px-2 py-1.5 text-[9px] text-zinc-400 font-technical uppercase tracking-wider truncate border-r border-[#27272A] last:border-r-0"
                    title={col.name}
                  >
                    {col.name.replace(/\s+/g, "_")}
                  </div>
                ))
              ) : (
                <div className="flex-1 px-2 py-1.5 text-[9px] text-zinc-600 font-technical italic text-center">
                  Define columns to preview...
                </div>
              )}
            </div>
            {/* Table rows (8 sample rows) */}
            <div className="flex-1 overflow-y-auto">
              {columns.filter(c => c.name.trim()).length > 0 ? (
                Array.from({ length: 8 }).map((_, rowIdx) => {
                  const rowVariants = [
                    "bg-transparent",
                    "bg-white/[0.02]",
                    "bg-transparent",
                    "bg-white/[0.02]",
                    "bg-transparent",
                    "bg-white/[0.02]",
                    "bg-transparent",
                    "bg-white/[0.02]",
                  ];
                  return (
                    <div
                      key={rowIdx}
                      className={`flex border-b border-[#27272A]/50 last:border-b-0 ${rowVariants[rowIdx]}`}
                    >
                      {columns.filter(c => c.name.trim()).map((col, colIdx) => {
                        const value = getDummyValue(col.type);
                        const isBool = col.type === "BOOLEAN";

                        return (
                          <div
                            key={colIdx}
                            className="flex-1 px-2 py-1.5 border-r border-[#27272A]/30 last:border-r-0 min-w-0"
                          >
                            {isBool ? (
                              <div className="flex items-center gap-1">
                                <div className={`h-3 w-3 border flex items-center justify-center flex-shrink-0 ${rowIdx % 2 === 0 ? "bg-[#10B981]/20 border-[#10B981]" : "border-[#27272A]"}`}>
                                  {rowIdx % 2 === 0 && <Check className="h-2 w-2 text-[#10B981]" />}
                                </div>
                                <span className="text-[9px] text-zinc-500 font-technical">
                                  {rowIdx % 2 === 0 ? "TRUE" : "FALSE"}
                                </span>
                              </div>
                            ) : col.type === "SELECT" ? (
                              <span className={`inline-block text-[8px] font-technical px-1.5 py-0.5 border font-semibold uppercase tracking-wider ${
                                rowIdx % 3 === 0
                                  ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5"
                                  : rowIdx % 3 === 1
                                  ? "border-amber-500/30 text-amber-400 bg-amber-500/5"
                                  : "border-indigo-500/30 text-indigo-400 bg-indigo-500/5"
                              }`}>
                                {["Active", "Pending", "Review"][rowIdx % 3]}
                              </span>
                            ) : col.type === "RELATION" ? (
                              <span className="text-[9px] text-[#10B981]/70 underline truncate block font-technical">
                                {value}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-300 font-technical truncate block">
                                {col.type === "INT" ? String(Number(value) + rowIdx * 7) :
                                 col.type === "FLOAT" ? (Number(value) + rowIdx * 0.13).toFixed(2) :
                                 col.type === "DATE" ? `2026-06-${String(rowIdx + 1).padStart(2, "0")}` :
                                 value}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full py-12 text-xs text-zinc-600 font-technical italic">
                  Define columns to preview table...
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="border-t border-[#27272A] px-3 py-1.5 text-[9px] text-zinc-600 font-technical italic flex justify-between shrink-0">
              <span>● {columns.filter(c => c.name.trim()).length} cols × 8 rows</span>
              <span>READY</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2 mt-6">
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isLoading || !stackName.trim()}
            className="w-full h-11 bg-white hover:bg-white/95 text-[#0E0E0E] rounded-none font-semibold text-sm uppercase tracking-wider disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isLoading ? "Compiling Stack..." : "Compile Stack"}
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full h-10 border border-[#27272A] hover:bg-white/5 text-white rounded-none font-semibold text-xs uppercase tracking-wider"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
