// lib/context/packer.ts
// Main ContextPacker class — packs workspace context for AI processing.
// Only handles data FORMATTING (CSV/Markdown/JSON), NOT meaning/intent detection.
// Intent detection is left entirely to the AI model on the FastAPI side.

import { RootStore } from "@/lib/store";
import type { 
  ContextItem, 
  PackedContext, 
  ContextPackerOptions, 
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
    // Deduplicate tasks by ID (tasks array may overlap with taskChildrenMap values)
    const taskMap = new Map<string, typeof tasks[number]>();
    for (const t of tasks) taskMap.set(t.id, t);
    for (const children of Object.values(taskChildrenMap)) {
      for (const t of children) taskMap.set(t.id, t);
    }
    const allTasks = [...taskMap.values()];

    for (const mention of mentions) {
      // Clean mention (remove @ if present)
      const searchTerm = mention.replace(/^@/, "").toLowerCase();

      // Try to match by title (case-insensitive) — first match wins
      let found = false;

      // Search in notes
      const note = allNotes.find((n) => n.title.toLowerCase().includes(searchTerm));
      if (note && !found) {
        const item = await this.buildContextItem("NOTE", note.id, note.title, "user_mention", opts);
        if (item) items.push(item);
        found = true;
      }

      // Search in stacks
      const stack = allStacks.find((s) => s.name.toLowerCase().includes(searchTerm));
      if (stack && !found) {
        const item = await this.buildContextItem("STACK", stack.id, stack.name, "user_mention", opts);
        if (item) items.push(item);
        found = true;
      }

      // Search in tasks
      const task = allTasks.find((t) => t.title.toLowerCase().includes(searchTerm));
      if (task && !found) {
        const item = await this.buildContextItem("TASK", task.id, task.title, "user_mention", opts);
        if (item) items.push(item);
        found = true;
      }
    }

    return items;
  }

  /**
   * Pack from recent activity (placeholder)
   */
  private async packFromRecentActivity(_opts: ContextPackerOptions): Promise<ContextItem[]> {
    // TODO: Implement recent activity tracking (e.g. recently edited notes, last-viewed stacks)
    return [];
  }

  /**
   * Build a ContextItem for a given type and ID.
   * Respects opts.includeContent / opts.includeMetadata flags.
   */
  private async buildContextItem(
    type: string,
    id: string,
    title: string,
    source: ContextItem["source"],
    opts: ContextPackerOptions
  ): Promise<ContextItem | null> {
    const { noteCache, stacks, tasks, taskChildrenMap, calendarEvents, cursorPosition } = this.store;

    const base: ContextItem = {
      type: type as ContextItem["type"],
      id,
      title,
      source,
    };

    try {
      switch (type) {
        case "NOTE": {
          const note = noteCache[id];
          if (!note) return null;

          if (opts.includeContent) {
            base.content = note.content || "";
          }
          if (opts.includeMetadata) {
            base.metadata = {
              cursorPosition,
              title: note.title,
            };
          }
          break;
        }

        case "STACK": {
          const stack = stacks.find((s) => s.id === id);
          if (!stack) return null;

          // Strip redundant stackId and sort by order (user-arranged column order)
          const cleanColumns = (stack.columns as any[])
            .map((col: any) => {
              const { stackId, ...rest } = col;
              return rest;
            })
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const rows = (stack.rows || []).slice(0, opts.maxRowsForFullData);

          if (opts.includeContent) {
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
          }

          if (opts.includeMetadata) {
            base.metadata = {
              dataFormat: opts.dataFormat || "csv",
              rowCount: stack.rows?.length || 0,
            };
          }
          break;
        }

        case "TASK": {
          // Deduplicate tasks by ID (tasks array may overlap with taskChildrenMap)
          const taskMap = new Map<string, typeof tasks[number]>();
          for (const t of tasks) taskMap.set(t.id, t);
          for (const children of Object.values(taskChildrenMap)) {
            for (const t of children) taskMap.set(t.id, t);
          }
          const task = taskMap.get(id);
          if (!task) return null;

          if (opts.includeContent) {
            const childTasks = taskChildrenMap[id] || [];
            base.content = {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              parentId: task.parentId || null,
              children: childTasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
              })),
            };
          }

          if (opts.includeMetadata) {
            const childTasks = taskChildrenMap[id] || [];
            base.metadata = {
              isSubtask: !!task.parentId,
              subtaskCount: childTasks.length,
            };
          }
          break;
        }

        case "TASKS": {
          // Special case: TASKS tab (no specific task)
          base.type = "TASK";
          base.id = "tasks-overview";
          if (opts.includeMetadata) {
            // Deduplicate tasks by ID for accurate counts
            const taskMap = new Map<string, typeof tasks[number]>();
            for (const t of tasks) taskMap.set(t.id, t);
            for (const children of Object.values(taskChildrenMap)) {
              for (const t of children) taskMap.set(t.id, t);
            }
            const allTasks = [...taskMap.values()];
            base.metadata = {
              taskCount: allTasks.length,
              completedCount: allTasks.filter((t) => t.status === "DONE").length,
            };
          }
          break;
        }

        case "CALENDAR": {
          base.type = "CALENDAR";
          base.id = "calendar-overview";
          
          if (opts.includeContent) {
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
          }

          if (opts.includeMetadata) {
            base.metadata = {
              eventCount: calendarEvents.length,
            };
          }
          break;
        }

        default:
          return null;
      }

      return base;
    } catch (error) {
      console.error(
        `[ContextPacker] Failed to build context item — type=${type} id=${id} title="${title}" source=${source}`,
        error instanceof Error ? error.message : error
      );
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
