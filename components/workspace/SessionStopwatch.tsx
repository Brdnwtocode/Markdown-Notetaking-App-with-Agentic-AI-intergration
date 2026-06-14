"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight session stopwatch that tracks how long the current
 * browser session has been open. Resets on every page reload.
 * Non-persistent — purely local state.
 */
export default function SessionStopwatch() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  return (
    <span className="tabular-nums text-zinc-500 font-normal">
      {formatTime(elapsed)}
    </span>
  );
}
