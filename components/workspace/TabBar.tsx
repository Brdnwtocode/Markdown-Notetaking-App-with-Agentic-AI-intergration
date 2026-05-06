"use client";

import { useWorkspaceStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { X, Cloud, Loader } from "lucide-react";
import Link from "next/link";

export default function TabBar() {
  const { openTabs, activeTabId, closeTab, isSaving } = useWorkspaceStore();

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeTab(tabId);
  };

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center bg-[#2a2a2a] border-b border-zinc-700/30 overflow-x-auto">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={`group flex items-center min-w-0 max-w-[24rem] border-r border-zinc-700/30 ${
            activeTabId === tab.id
              ? "bg-[#1e1e1e] text-slate-200"
              : "text-slate-500 hover:bg-zinc-700/20"
          } transition-colors duration-75`}
        >
          <Link
            href={`/workspace/${tab.type === "NOTE" ? "notes" : "stacks"}/${tab.id}`}
            className="flex items-center px-4 py-2 text-sm truncate flex-1"
          >
            <span className="truncate">{tab.title || "Untitled"}</span>
          </Link>
          <div className="flex items-center pr-3">
            {activeTabId === tab.id && (
              <div className="mr-2">
                {isSaving ? (
                  <Loader className="h-3 w-3 animate-spin text-slate-400" />
                ) : (
                  <Cloud className="h-3 w-3 text-slate-400" />
                )}
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => handleCloseTab(tab.id, e)}
              className="h-5 w-5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}