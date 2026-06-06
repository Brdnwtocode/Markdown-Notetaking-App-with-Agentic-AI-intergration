// lib/context/packer.ts
// Main ContextPacker class — packs workspace context for AI processing.
// Only handles data FORMATTING (CSV/Markdown/JSON), NOT meaning/intent detection.
// Intent detection is left entirely to the AI model on the FastAPI side.

import { RootStore } from "@/lib/store";
import { 
  ContextItem, 
  PackedContext, 
  ContextPackerOptions, 
  DataFormat,
} from "./types";
import { formatData } from "./dataFormatter";

const DEFAULT_OPTIONS: ContextPackerOptions = {
  maxItems: 5,
  includeContent: true,
  includeMetadata: true,
  dataFormat: "csv", // Default to CSV (most compact for AI token usage)
  maxRowsForFullData: 100,
};

export class ContextPacker {
  private store: RootStore;

  constructor(store: RootStore) {
    this.store = store;
  }

  /**
   * Pack context from multiple sources.
   * Always includes full data — no command-type-based filtering.
   * The AI is responsible for understanding user intent.
   */
  async pack(
    options: {
      tabIds?: string[];
      mentions?: string[];
      includeRecent?: boolean;
      /** Accept transcript for API compatibility but no longer used for intent detection */
      transcript?: string;
    },
    packerOptions?: ContextPackerOptions
  ): Promise<PackedContext> {
    const opts = { ...DEFAULT_OPTIONS, ...packerOptions };
    const items: ContextItem[] = [];
    const seenIds = new Set<string>();

    // 1. Pack from selected tabs
    if (options.tabIds && options.tabIds.length > 0) {
      const tabItems = await this.packFromTabs(options.tabIds, opts);
      for (const item of tabItems) {
        if (!seenIds.has(item.id) && items.length < opts.maxItems!) {
          items.push(item);
          seenIds.add(item.id);
        }
      }
    }

    // 2. Pack from @mentions
    if (options.mentions && options.mentions.length > 0) {
      const mentionItems = await this.packFromMentions(options.mentions, opts);
      for (const item of mentionItems) {
        if (!seenIds.has(item.id) && items.length < opts.maxItems!) {
          items.push(item);
          seenIds.add(item.id);
        }
      }
    }

    // 3. Pack recent activity (if requested)
    if (options.includeRecent) {
      const recentItems = await this.packFromRecentActivity(opts);
      for (const item of recentItems) {
        if (!seenIds.has(item.id) && items.length < opts.maxItems!) {
          items.push(item);
          seenIds.add(item.id);
        }
      }
    }

    return {
      items,
      packedAt: new Date(),
      totalItems: items.length,
    };
  }

  /**
   * Pack context from tab IDs
   */
  private async packFromTabs(
    tabIds: string[], 
    opts: ContextPackerOptions
  ): Promise<ContextItem[]> {
    const { openTabs } = this.store;
    const items: ContextItem[] = [];

    for (const tabId of tabIds) {
      const tab = openTabs.find((t) => t.id === tabId);
      if (!tab) continue;

      const item = await this.buildContextItem(
        tab.type, 
        tab.id, 
        tab.title, 
        "active_tab", 
        opts
      );
      if (item) items.push(item);
    }

    return items;
  }

  /**
   * Pack context from @mentions
   */
  private async packFromMentions(
    mentions: string[], 
    opts: ContextPackerOptions
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const { noteCache, stacks, tasks, taskChildrenMap } = this.store;

    // Collect all available materials
    const allNotes = Object.values(noteCache);
    const allStacks = stacks;
    const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];

    for (const mention of mentions) {
      // Clean mention (remove @ if present)
      const searchTerm = mention.replace(/^@/, "").toLowerCase();

      // Try to match by title (case-insensitive)
      let matched = false;

      // Search in notes
      const note = allNotes.find((n) => n.title.toLowerCase().includes(searchTerm));
      if (note && !matched) {
        const item = await this.buildContextItem("NOTE", note.id, note.title, "user_mention", opts);
        if (item) items.push(item);
        matched = true;
      }

      // Search in stacks
      const stack = allStacks.find((s) => s.name.toLowerCase().includes(searchTerm));
      if (stack && !matched) {
        const item = await this.buildContextItem("STACK", stack.id, stack.name, "user_mention", opts);
        if (item) items.push(item);
        matched = true;
      }

      // Search in tasks
      const task = allTasks.find((t) => t.title.toLowerCase().includes(searchTerm));
      if (task && !matched) {
        const item = await this.buildContextItem("TASK", task.id, task.title, "user_mention", opts);
        if (item) items.push(item);
        matched = true;
      }
    }

    return items;
  }

  /**
   * Pack from recent activity (placeholder)
   */
  private async packFromRecentActivity(opts: ContextPackerOptions): Promise<ContextItem[]> {
    // TODO: Implement recent activity tracking
    return [];
  }

  /**
   * Build a ContextItem for a given type and ID.
   * ALWAYS includes full data — the AI decides what's relevant.
   */
  private async buildContextItem(
    type: string,
    id: string,
    title: string,
    source: "active_tab" | "user_mention" | "recent_activity",
    opts: ContextPackerOptions
  ): Promise<ContextItem | null> {
    const { noteCache, stacks, tasks, taskChildrenMap, calendarEvents, cursorPosition } = this.store;

    const base: ContextItem = {
      type: type as any,
      id,
      title,
      source,
    };

    try {
      switch (type) {
        case "NOTE": {
          const note = noteCache[id];
          if (!note) return null;

          // NOTES: Always send content (they're small)
          base.content = note.content || "";
          base.metadata = {
            cursorPosition,
            title: note.title,
          };
          break;
        }

        case "STACK": {
          const stack = stacks.find((s) => s.id === id);
          if (!stack) return null;

          // Strip redundant stackId and sort by order (user-arranged column order)
          const cleanColumns = stack.columns
            .map(({ stackId, ...col }: any) => col)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
          const rows = (stack.rows || []).slice(0, opts.maxRowsForFullData);
          const formattedData = formatData(
            "stack",
            rows,
            opts.dataFormat || "csv",
            cleanColumns
          );

          base.content = {
            schema: { columns: cleanColumns },
            stats: {
              rowCount: stack.rows?.length || 0,
              columnCount: cleanColumns.length,
            },
            dataFormat: opts.dataFormat || "csv",
            data: formattedData,
          };

          base.metadata = {
            dataFormat: opts.dataFormat || "csv",
            rowCount: stack.rows?.length || 0,
          };
          break;
        }

        case "TASK": {
          const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
          const task = allTasks.find((t) => t.id === id);
          if (!task) return null;

          // TASKS: Send content (usually small)
          base.content = JSON.stringify({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            parentId: task.parentId || null,
            children: task.children?.map((t: any) => ({
              id: t.id,
              title: t.title,
              status: t.status,
            })) || [],
          });

          base.metadata = {
            isSubtask: !!task.parentId,
            subtaskCount: task.children?.length || 0,
          };
          break;
        }

        case "TASKS": {
          // Special case: TASKS tab (no specific task)
          base.type = "TASK";
          base.id = "tasks-overview";
          const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
          base.metadata = {
            taskCount: allTasks.length,
            completedCount: allTasks.filter((t) => t.status === "DONE").length,
          };
          break;
        }

        case "CALENDAR": {
          base.type = "CALENDAR";
          base.id = "calendar-overview";
          
          // CALENDAR: Always send events as CSV
          const formattedData = formatData(
            "event",
            calendarEvents,
            opts.dataFormat || "csv"
          );

          base.content = {
            dataFormat: opts.dataFormat || "csv",
            data: formattedData,
            eventCount: calendarEvents.length,
          };
          
          base.metadata = {
            eventCount: calendarEvents.length,
          };
          break;
        }

        default:
          return null;
      }

      return base;
    } catch (error) {
      console.error(`Error building context item for ${type}:${id}`, error);
      return null;
    }
  }
}

/**
 * Helper function to extract @mentions from text (simple regex)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@([^\s@]+)/g;
  const matches: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Helper to create a PackedContext from legacy single-context format
 */
export function legacyContextToPacked(
  type: string,
  id: string,
  title?: string
): PackedContext {
  return {
    items: [
      {
        type: type as any,
        id,
        title: title || id,
        source: "active_tab",
      },
    ],
    packedAt: new Date(),
    totalItems: 1,
  };
}
