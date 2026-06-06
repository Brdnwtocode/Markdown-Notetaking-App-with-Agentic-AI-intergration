// This file is intentionally empty - see lib/context/packer.ts for the new implementation

    return {
      items,
      packedAt: new Date(),
      totalItems: items.length,
    };
  }

  /**
   * Pack context from tab IDs
   */
  private async packFromTabs(tabIds: string[]): Promise<ContextItem[]> {
    const { openTabs, noteCache, stacks, tasks, taskChildrenMap } = this.store;
    const items: ContextItem[] = [];

    for (const tabId of tabIds) {
      const tab = openTabs.find((t) => t.id === tabId);
      if (!tab) continue;

      const item = await this.buildContextItem(tab.type, tab.id, tab.title, "active_tab");
      if (item) items.push(item);
    }

    return items;
  }

  /**
   * Pack context from @mentions (simple title matching)
   */
  private async packFromMentions(mentions: string[]): Promise<ContextItem[]> {
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
        const item = await this.buildContextItem("NOTE", note.id, note.title, "user_mention");
        if (item) items.push(item);
        matched = true;
      }

      // Search in stacks
      const stack = allStacks.find((s) => s.name.toLowerCase().includes(searchTerm));
      if (stack && !matched) {
        const item = await this.buildContextItem("STACK", stack.id, stack.name, "user_mention");
        if (item) items.push(item);
        matched = true;
      }

      // Search in tasks
      const task = allTasks.find((t) => t.title.toLowerCase().includes(searchTerm));
      if (task && !matched) {
        const item = await this.buildContextItem("TASK", task.id, task.title, "user_mention");
        if (item) items.push(item);
        matched = true;
      }
    }

    return items;
  }

  /**
   * Pack from recent activity (most recently updated materials)
   */
  private async packFromRecentActivity(): Promise<ContextItem[]> {
    // This is a placeholder for future implementation
    // Could use updatedAt timestamps from notes, stacks, tasks
    return [];
  }

  /**
   * Build a ContextItem for a given type and ID
   */
  private async buildContextItem(
    type: string,
    id: string,
    title: string,
    source: ContextSource
  ): Promise<ContextItem | null> {
    const { noteCache, stacks, tasks, taskChildrenMap } = this.store;

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
          base.content = note.content || "";
          base.metadata = {
            wordCount: note.content?.split(/\s+/).length || 0,
            lastUpdated: note.updatedAt || new Date().toISOString(),
          };
          break;
        }

        case "STACK": {
          const stack = stacks.find((s) => s.id === id);
          if (!stack) return null;
          base.content = JSON.stringify({
            name: stack.name,
            columns: stack.columns,
            rowCount: stack.rows?.length || 0,
          });
          base.metadata = {
            columnCount: stack.columns?.length || 0,
            rowCount: stack.rows?.length || 0,
          };
          break;
        }

        case "TASK": {
          const allTasks = [...tasks, ...Object.values(taskChildrenMap).flat()];
          const task = allTasks.find((t) => t.id === id);
          if (!task) return null;
          base.content = JSON.stringify({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
          });
          base.metadata = {
            status: task.status,
            priority: task.priority,
          };
          break;
        }

        case "TASKS": {
          // Special case: TASKS tab (no specific task)
          base.type = "TASK";
          base.id = "tasks-overview";
          base.metadata = {
            taskCount: tasks.length,
            completedCount: tasks.filter((t) => t.status === "DONE").length,
          };
          break;
        }

        case "CALENDAR": {
          base.type = "CALENDAR";
          base.id = "calendar-overview";
          base.metadata = {
            type: "calendar",
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
  // Match @ followed by one or more non-whitespace characters
  const mentionRegex = /@([^\s@]+)/g;
  const matches: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    matches.push(match[1]); // Push the captured group (without @)
  }

  return matches;
}

/**
 * Helper to create a PackedContext from legacy single-context format
 * (for backward compatibility)
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
