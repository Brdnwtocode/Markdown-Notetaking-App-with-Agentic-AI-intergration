"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

/** Single DndProvider for the entire workspace — avoids "Cannot have two HTML5 backends" error. */
export default function DndWrapper({ children }: { children: React.ReactNode }) {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
