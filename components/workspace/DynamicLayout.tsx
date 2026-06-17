"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDrop } from "react-dnd";
import { useWorkspaceStore } from "@/lib/store";
import TabBar from "@/components/workspace/TabBar";
import PaneContent from "@/components/workspace/PaneContent";

interface DynamicLayoutProps {
  children: React.ReactNode;
}

// ── Drop-target pane wrapper ──────────────────────────────────────────

interface PaneDropTargetProps {
  paneId: "left" | "right";
  children: React.ReactNode;
}

function PaneDropTarget({ paneId, children }: PaneDropTargetProps) {
  const { assignTabToPane, setPaneActiveTab } = useWorkspaceStore();

  const [, drop] = useDrop(() => ({
    accept: "TAB",
    drop: (item: { id: string }) => {
      assignTabToPane(item.id, paneId);
      setPaneActiveTab(paneId, item.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [paneId, assignTabToPane, setPaneActiveTab]);

  return (
    <div ref={drop as any} className="h-full flex flex-col bg-[#0E0E0E]">
      {children}
    </div>
  );
}

export default function DynamicLayout({ children }: DynamicLayoutProps) {
  const {
    isSplitView,
    openTabs,
    leftPaneActiveId,
    rightPaneActiveId,
  } = useWorkspaceStore();

  const leftTab = leftPaneActiveId
    ? openTabs.find((t) => t.id === leftPaneActiveId) ?? null
    : null;
  const rightTab = rightPaneActiveId
    ? openTabs.find((t) => t.id === rightPaneActiveId) ?? null
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {isSplitView ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* ── Left Pane ── */}
            <Panel defaultSize={50} minSize={25}>
              <PaneDropTarget paneId="left">
                <TabBar paneId="left" />
                <div className="flex-1 overflow-hidden">
                  <PaneContent tab={leftTab} />
                </div>
              </PaneDropTarget>
            </Panel>

            {/* ── Resize Handle ── */}
            <PanelResizeHandle className="w-1.5 bg-[#27272A] hover:bg-[#10B981]/50 active:bg-[#10B981] transition-colors cursor-col-resize relative group">
              <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-0.5 h-8 rounded-full bg-[#10B981]/60" />
              </div>
            </PanelResizeHandle>

            {/* ── Right Pane ── */}
            <Panel defaultSize={50} minSize={25}>
              <PaneDropTarget paneId="right">
                <TabBar paneId="right" />
                <div className="flex-1 overflow-hidden">
                  <PaneContent tab={rightTab} />
                </div>
              </PaneDropTarget>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="h-full">{children}</div>
        )}
      </div>
    </div>
  );
}
