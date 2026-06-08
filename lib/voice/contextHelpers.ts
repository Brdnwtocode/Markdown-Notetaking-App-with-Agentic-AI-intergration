// lib/voice/contextHelpers.ts
//
// Shared context-gathering helpers used by PushToTalk and ChatSidebar.
// Keeps the "how to pack context" logic in one place.

import { useWorkspaceStore } from "@/lib/store";
import { ContextPacker, extractMentions } from "@/lib/context/packer";
import type { PackedContext } from "@/lib/context/types";

/** Sentinel item used when no tab/context is active */
const NO_CONTEXT_ITEM = {
  type: "NOTE" as const,
  id: "00000000-0000-0000-0000-000000000000",
  title: "No active context",
  content: "",
  source: "active_tab" as const,
};

/** Resolve which tab IDs to pack from the current store state */
export function resolveTabIds(): string[] {
  const { selectedTabIds, activeTabId } = useWorkspaceStore.getState();
  if (selectedTabIds.length > 0) return selectedTabIds;
  if (activeTabId) return [activeTabId];
  return [];
}

/** Pack context from the current store state */
export async function packContext(transcript?: string): Promise<PackedContext> {
  const store = useWorkspaceStore.getState();
  const packer = new ContextPacker(store);
  const tabIds = resolveTabIds();
  const mentions = transcript ? extractMentions(transcript) : [];

  const packed = await packer.pack({
    tabIds,
    mentions: mentions.length > 0 ? mentions : undefined,
  });

  // Ensure at least one item so the API always has context
  if (packed.items.length === 0) {
    return {
      items: [NO_CONTEXT_ITEM],
      packedAt: new Date(),
      totalItems: 0,
    };
  }

  return packed;
}

/** Check if a context item is the sentinel "no context" item */
export function isNoContextItem(id: string): boolean {
  return id === NO_CONTEXT_ITEM.id;
}
