"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface CanvasShape {
  id: string;
  type: "rectangle" | "circle" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export default function Canvas() {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [selectedColor, setSelectedColor] = useState("#3b82f6");

  const addShape = (type: "rectangle" | "circle" | "line") => {
    const newShape: CanvasShape = {
      id: Math.random().toString(36),
      type,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      color: selectedColor,
    };
    setShapes([...shapes, newShape]);
  };

  const deleteShape = (id: string) => {
    setShapes(shapes.filter((shape) => shape.id !== id));
  };

  const renderShape = (shape: CanvasShape) => {
    const key = shape.id;

    if (shape.type === "rectangle") {
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={shape.color}
          opacity="0.8"
          stroke="black"
          strokeWidth="1"
          className="cursor-move"
        />
      );
    } else if (shape.type === "circle") {
      return (
        <circle
          key={key}
          cx={shape.x + shape.width / 2}
          cy={shape.y + shape.height / 2}
          r={shape.width / 2}
          fill={shape.color}
          opacity="0.8"
          stroke="black"
          strokeWidth="1"
          className="cursor-move"
        />
      );
    } else if (shape.type === "line") {
      return (
        <line
          key={key}
          x1={shape.x}
          y1={shape.y}
          x2={shape.x + shape.width}
          y2={shape.y + shape.height}
          stroke={shape.color}
          strokeWidth="2"
          className="cursor-move"
        />
      );
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#0E0E0E] text-white">
      <div className="flex items-center gap-3 mb-4 border-b border-[#27272A] pb-3">
        <h2 className="text-sm font-semibold font-technical uppercase tracking-wider text-[#10B981]">Canvas</h2>
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="w-6 h-6 border border-[#27272A] bg-transparent cursor-pointer"
        />
        <Button
          onClick={() => addShape("rectangle")}
          size="sm"
          variant="secondary"
        >
          <Plus className="h-3.5 w-3.5 mr-1 text-[#10B981]" /> Rectangle
        </Button>
        <Button
          onClick={() => addShape("circle")}
          size="sm"
          variant="secondary"
        >
          <Plus className="h-3.5 w-3.5 mr-1 text-[#10B981]" /> Circle
        </Button>
        <Button
          onClick={() => addShape("line")}
          size="sm"
          variant="secondary"
        >
          <Plus className="h-3.5 w-3.5 mr-1 text-[#10B981]" /> Line
        </Button>
      </div>

      <div className="flex-1 border border-[#27272A] rounded-none bg-[#131313]">
        <svg className="w-full h-full" style={{ backgroundColor: "#131313" }}>
          {shapes.map((shape) => renderShape(shape))}
        </svg>
      </div>

      {/* Shape Properties */}
      {shapes.length > 0 && (
        <div className="mt-4 p-3 border border-[#27272A] rounded-none bg-[#131313]">
          <p className="text-xs font-semibold mb-2 font-technical uppercase tracking-wider text-zinc-400">Shapes ({shapes.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {shapes.map((shape) => (
              <div
                key={shape.id}
                className="flex items-center justify-between text-xs p-2 bg-[#0E0E0E] border border-[#27272A] rounded-none font-technical text-zinc-300"
              >
                <span>
                  {shape.type} @ ({shape.x}, {shape.y})
                </span>
                <Button
                  onClick={() => deleteShape(shape.id)}
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
