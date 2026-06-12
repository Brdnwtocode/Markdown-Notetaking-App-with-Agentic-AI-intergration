"use client";

// app/(workspace)/workspace/records/page.tsx
//
// Records feature main route. Renders the full audio workstation.

import RecordsWorkstation from "@/components/workspace/RecordsWorkstation";

export default function RecordsPage() {
  return <div className="h-full w-full"><RecordsWorkstation /></div>;
}
