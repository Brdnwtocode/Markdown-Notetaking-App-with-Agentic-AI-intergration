"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, ChevronDown, Check } from "lucide-react";
import toast from "react-hot-toast";

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

  const [indexForSearch, setIndexForSearch] = useState(true);
  const [publicApiAccess, setPublicApiAccess] = useState(false);

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
      {/* Left Column: Editor Schema Details (col-span-8) */}
      <div className="col-span-8 p-6 flex flex-col justify-between border-r border-[#27272A] relative min-h-[600px]">
        {/* Header */}
        <div className="space-y-1 mb-6">
          <div className="text-[10px] text-[#10B981] font-technical uppercase tracking-wider flex items-center gap-1.5">
            <span className="bg-[#10B981]/15 px-1.5 py-0.5 border border-[#10B981]/30">CMD + N</span>
            <span>Stack Creation Workspace</span>
          </div>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-tight font-technical text-white">
              Create New Stack
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-none absolute right-4 top-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stack Label & Icon */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
              Stack Label
            </label>
            <Input
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="e.g., Research_Engine_v1"
              className="h-10 bg-[#131313] border-[#27272A] text-sm text-white placeholder:text-zinc-600 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="w-48 space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
              Icon
            </label>
            <div className="h-10 bg-[#131313] border border-[#27272A] flex items-center justify-between px-3 text-sm text-zinc-400 hover:border-zinc-500 cursor-pointer font-technical">
              <span>• Default_Stack</span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </div>
          </div>
        </div>

        {/* Schema Definition Title */}
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
            Schema Definition
          </label>
          <span className="text-[10px] text-zinc-500 font-technical">
            {columns.length}/20 PROPERTIES
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
          className="w-full h-11 border border-dashed border-[#27272A] hover:border-[#10B981]/60 text-zinc-500 hover:text-white flex items-center justify-center gap-2 text-xs font-technical uppercase tracking-wider transition-colors mb-6"
        >
          <Plus className="h-3.5 w-3.5 text-[#10B981]" /> Add Property block
        </button>

        {/* Search Checkboxes */}
        <div className="flex gap-6 mt-auto">
          <label className="flex items-center gap-2 text-xs font-technical text-zinc-400 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={indexForSearch}
              onChange={(e) => setIndexForSearch(e.target.checked)}
              className="accent-[#10B981] h-3.5 w-3.5 border-[#27272A] bg-[#131313] rounded-none focus:ring-0"
            />
            INDEX FOR SEARCH
          </label>
          <label className="flex items-center gap-2 text-xs font-technical text-zinc-400 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={publicApiAccess}
              onChange={(e) => setPublicApiAccess(e.target.checked)}
              className="accent-[#10B981] h-3.5 w-3.5 border-[#27272A] bg-[#131313] rounded-none focus:ring-0"
            />
            PUBLIC API ACCESS
          </label>
        </div>
      </div>

      {/* Right Column: Live Preview & Confirm (col-span-4) */}
      <div className="col-span-4 p-6 bg-[#131313] flex flex-col justify-between min-h-[600px]">
        {/* Title */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-technical">
            Live Preview
          </h3>

          {/* Dummy Card Display */}
          <div className="border border-[#27272A] bg-[#0E0E0E] p-4 flex flex-col gap-4 relative">
            <div className="space-y-4">
              {columns.map((col, idx) => {
                if (!col.name.trim()) return null;
                const value = getDummyValue(col.type);
                const isBool = col.type === "BOOLEAN";

                return (
                  <div key={idx} className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-technical truncate">
                      {col.name.replace(/\s+/g, "_")}
                    </div>
                    {isBool ? (
                      <div className="flex items-center gap-2 text-sm text-white font-technical font-semibold">
                        <div className="h-4.5 w-4.5 bg-[#10B981]/20 border border-[#10B981] flex items-center justify-center p-0.5">
                          <Check className="h-3 w-3 text-[#10B981]" />
                        </div>
                        <span>TRUE</span>
                      </div>
                    ) : col.type === "SELECT" ? (
                      <div className="inline-block text-[10px] font-technical px-2 py-0.5 border border-[#10B981] text-[#10B981] bg-[#10B981]/5 font-semibold uppercase tracking-wider">
                        {value}
                      </div>
                    ) : col.type === "RELATION" ? (
                      <div className="text-xs text-[#10B981] underline cursor-pointer truncate font-technical">
                        📎 {value}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-white font-technical truncate">
                        {value}
                      </div>
                    )}
                  </div>
                );
              })}

              {columns.filter(c => c.name.trim()).length === 0 && (
                <div className="text-xs text-zinc-600 font-technical italic text-center py-6">
                  Define columns to preview record...
                </div>
              )}
            </div>

            <div className="border-t border-[#27272A] pt-3 mt-4 text-[9px] text-zinc-600 font-technical italic flex justify-between">
              <span>Mock entry visualization</span>
              <span>● READY</span>
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
