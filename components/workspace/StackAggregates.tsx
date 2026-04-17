"use client";

import { useMemo } from "react";
import { Stack, StackColumn } from "@/lib/store";

interface StackAggregatesProps {
  stack: Stack;
}

export default function StackAggregates({ stack }: StackAggregatesProps) {
  const aggregates = useMemo(() => {
    const result: Record<string, { type: string; value: number | null }> = {};

    stack.columns.forEach((col) => {
      if (col.type === "INT" || col.type === "FLOAT") {
        const values = stack.rows
          .map((row) => row.data[col.id])
          .filter((val) => val !== null && val !== undefined)
          .map((val) => parseFloat(val));

        if (values.length > 0) {
          result[col.id] = {
            type: col.type,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
          };
        }
      }
    });

    return result;
  }, [stack.columns, stack.rows]);

  const numericColumns = stack.columns.filter(
    (col) => col.type === "INT" || col.type === "FLOAT"
  );

  if (numericColumns.length === 0) return null;

  return (
    <div className="border-t border-border p-4 bg-muted/30">
      <h4 className="text-sm font-semibold mb-3">Aggregates</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {numericColumns.map((col) => {
          const agg = aggregates[col.id];
          if (!agg) return null;

          return (
            <div
              key={col.id}
              className="p-3 bg-background border border-border rounded"
            >
              <p className="text-xs text-muted-foreground">{col.name}</p>
              <div className="space-y-1 mt-2">
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground">Sum: </span>
                  <span className="font-semibold">
                    {agg.sum.toLocaleString()}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground">Avg: </span>
                  <span className="font-semibold">
                    {agg.avg.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
