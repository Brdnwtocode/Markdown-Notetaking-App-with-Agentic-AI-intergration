"use client";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format, parse, parseISO, startOfDay } from "date-fns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Code, Mic, Users, Edit2, Link2, EyeOff } from "lucide-react";
import type { CalendarEvent } from "@/lib/slices/calendarSlice";

const EventFormSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).default(""),
  startAt: z.string().min(1, "Start time required"),
  endAt: z.string().min(1, "End time required"),
  allDay: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5645d4"),
}).refine((data) => {
  if (data.allDay) {
    const s = data.startAt.length > 10 ? data.startAt.slice(0, 10) : data.startAt;
    const e = data.endAt.length > 10 ? data.endAt.slice(0, 10) : data.endAt;
    return s <= e;
  }
  return new Date(data.startAt) <= new Date(data.endAt);
}, {
  message: "Start must be before or equal to end",
  path: ["endAt"],
});

type EventFormData = z.infer<typeof EventFormSchema>;

const mapAnchorAndPriorityToColor = (anchor: string, priority: "LOW" | "CRITICAL"): string => {
  if (priority === "CRITICAL") {
    return anchor === "edit" ? "#ff64c8" : "#e03131";
  }
  switch (anchor) {
    case "mic":
      return "#1aae39";
    case "users":
      return "#2a9d99";
    case "edit":
      return "#dd5b00";
    case "code":
    default:
      return "#5645d4";
  }
};

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  newEventFromMonthSlot?: boolean;
  onSubmit: (data: EventFormData) => void;
  onDelete?: () => void;
}

export default function EventDialog({
  open,
  onOpenChange,
  event,
  defaultStart,
  defaultEnd,
  newEventFromMonthSlot,
  onSubmit,
  onDelete,
}: EventDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<EventFormData>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: { title: "", notes: "", startAt: "", endAt: "", allDay: false, color: "#5645d4" },
  });
  const allDay = watch("allDay");
  const startAt = watch("startAt");
  const endAt = watch("endAt");
  const eventColor = watch("color");
  const notesText = watch("notes") || "";

  // Derive visual anchor and priority state from current color value
  const getDerivedState = (color: string) => {
    switch (color) {
      case "#e03131": // Red
        return { anchor: "code", priority: "CRITICAL" as const };
      case "#ff64c8": // Pink
        return { anchor: "edit", priority: "CRITICAL" as const };
      case "#1aae39": // Green
        return { anchor: "mic", priority: "LOW" as const };
      case "#2a9d99": // Teal
        return { anchor: "users", priority: "LOW" as const };
      case "#dd5b00": // Orange
        return { anchor: "edit", priority: "LOW" as const };
      case "#5645d4": // Purple
      default:
        return { anchor: "code", priority: "LOW" as const };
    }
  };

  const { anchor: selectedAnchor, priority: selectedPriority } = getDerivedState(eventColor);

  const handleAnchorClick = (anchorId: string) => {
    const nextColor = mapAnchorAndPriorityToColor(anchorId, selectedPriority);
    setValue("color", nextColor);
  };

  const handlePriorityClick = (priorityState: "LOW" | "CRITICAL") => {
    const nextColor = mapAnchorAndPriorityToColor(selectedAnchor, priorityState);
    setValue("color", nextColor);
  };

  // Parse hours & minutes from startAt/endAt strings to construct slider values
  const [startMin, setStartMin] = useState<number>(540); // 09:00 AM default (9 * 60)
  const [endMin, setEndMin] = useState<number>(690); // 11:30 AM default (11.5 * 60)

  useEffect(() => {
    if (event) {
      setValue("title", event.title);
      setValue("notes", event.notes);
      setValue("allDay", event.allDay);
      setValue("color", event.color);
      if (event.allDay) {
        setValue("startAt", format(parseISO(event.startAt), "yyyy-MM-dd"));
        setValue("endAt", format(addDays(parseISO(event.endAt), -1), "yyyy-MM-dd"));
      } else {
        setValue("startAt", event.startAt.slice(0, 16));
        setValue("endAt", event.endAt.slice(0, 16));
      }
      return;
    }
    if (!defaultStart || !defaultEnd) {
      reset();
      return;
    }
    if (newEventFromMonthSlot) {
      reset({
        title: "",
        notes: "",
        startAt: format(defaultStart, "yyyy-MM-dd"),
        endAt: format(defaultEnd, "yyyy-MM-dd"),
        allDay: true,
        color: "#5645d4",
      });
      return;
    }
    reset({
      title: "",
      notes: "",
      startAt: defaultStart.toISOString().slice(0, 16),
      endAt: defaultEnd.toISOString().slice(0, 16),
      allDay: false,
      color: "#5645d4",
    });
  }, [event, defaultStart, defaultEnd, newEventFromMonthSlot, setValue, reset]);

  // Sync startAt and endAt strings with slider minutes when startAt/endAt values are set
  useEffect(() => {
    if (startAt && startAt.includes("T")) {
      const timePart = startAt.split("T")[1];
      if (timePart) {
        const [h, m] = timePart.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) setStartMin(h * 60 + m);
      }
    }
    if (endAt && endAt.includes("T")) {
      const timePart = endAt.split("T")[1];
      if (timePart) {
        const [h, m] = timePart.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) setEndMin(h * 60 + m);
      }
    }
  }, [startAt, endAt]);

  const handleSliderChange = (newStart: number, newEnd: number) => {
    setStartMin(newStart);
    setEndMin(newEnd);

    // Update form values
    const baseDate = startAt?.split("T")[0] || format(new Date(), "yyyy-MM-dd");
    
    const startH = Math.floor(newStart / 60);
    const startM = newStart % 60;
    const startStr = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    setValue("startAt", `${baseDate}T${startStr}`);

    const endH = Math.floor(newEnd / 60);
    const endM = newEnd % 60;
    const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    const endBaseDate = endAt?.split("T")[0] || baseDate;
    setValue("endAt", `${endBaseDate}T${endStr}`);
  };

  // Convert minutes into AM/PM string
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(displayHours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;
  };

  const getDurationString = () => {
    const durationHours = (endMin - startMin) / 60;
    const h = Math.floor(durationHours);
    const m = Math.round((durationHours - h) * 60);
    if (h === 0) return `${m} MINUTES SELECTED`;
    if (m === 0) return `${h} HOUR${h > 1 ? "S" : ""} SELECTED`;
    return `${h}.${Math.round((m / 60) * 10)} HOURS SELECTED`;
  };

  // Extract hashtags from Notes context
  const parsedTags = notesText.match(/#[a-zA-Z0-9_-]+/g) || [];

  const submitHandler = (data: EventFormData) => {
    if (data.allDay) {
      const parseDay = (raw: string) => {
        const ymd = raw.length > 10 ? raw.slice(0, 10) : raw;
        return startOfDay(parse(ymd, "yyyy-MM-dd", new Date()));
      };
      let start = parseDay(data.startAt);
      let endInclusive = parseDay(data.endAt);
      if (endInclusive < start) endInclusive = start;
      const endExclusive = addDays(endInclusive, 1);
      onSubmit({
        ...data,
        startAt: start.toISOString(),
        endAt: endExclusive.toISOString(),
      });
      reset();
      return;
    }
    onSubmit({
      ...data,
      startAt: new Date(data.startAt).toISOString(),
      endAt: new Date(data.endAt).toISOString(),
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#131313] border border-[#27272A] p-6 text-white overflow-hidden rounded-none shadow-2xl">
        <DialogTitle className="sr-only">{event ? "Edit Event" : "New Event"}</DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272A] mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-[#10B981]"></span>
            <h2 className="text-lg font-bold uppercase tracking-tight font-technical">
              {event ? "Edit Orchestration" : "New Orchestration"}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit(submitHandler)} className="space-y-5">
          {/* Event Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
              Event Title
            </label>
            <Input
              placeholder="What are we locking in?"
              {...register("title")}
              className="h-10 bg-[#0E0E0E] border-[#27272A] text-sm text-white focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Timeline Range Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
                Duration & Timeline
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-technical hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("allDay")}
                  className="accent-[#10B981] border-[#27272A] bg-[#131313] rounded-none focus:ring-0"
                />
                ALL DAY
              </label>
            </div>

            {!allDay ? (
              <div className="bg-[#0E0E0E] border border-[#27272A] p-4 space-y-4 rounded-none">
                {/* Visual slider control */}
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-technical text-[#10B981] w-20 text-right">
                    {formatMinutes(startMin)}
                  </span>
                  
                  <div className="relative flex-1 h-6 flex items-center">
                    {/* Track background */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2"></div>
                    
                    {/* Selected Range track */}
                    <div
                      className="absolute top-1/2 h-1 bg-[#10B981] -translate-y-1/2"
                      style={{
                        left: `${(startMin / 1440) * 100}%`,
                        right: `${100 - (endMin / 1440) * 100}%`,
                      }}
                    ></div>

                    {/* Start range slider */}
                    <input
                      type="range"
                      min="0"
                      max="1440"
                      step="15"
                      value={startMin}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), endMin - 15);
                        handleSliderChange(val, endMin);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 w-full appearance-none bg-transparent pointer-events-none focus:outline-none 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:glow-emerald
                        [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer"
                      style={{ zIndex: startMin > 720 ? 5 : 4 }}
                    />
                    
                    {/* End range slider */}
                    <input
                      type="range"
                      min="0"
                      max="1440"
                      step="15"
                      value={endMin}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), startMin + 15);
                        handleSliderChange(startMin, val);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 w-full appearance-none bg-transparent pointer-events-none focus:outline-none 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:glow-emerald
                        [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer"
                      style={{ zIndex: 4 }}
                    />
                  </div>

                  <span className="text-[11px] font-technical text-zinc-400 w-20">
                    {formatMinutes(endMin)}
                  </span>
                </div>

                {/* Subtitle details */}
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-technical uppercase">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-zinc-400">DATE:</span>
                    <input
                      type="date"
                      value={startAt?.split("T")[0] || ""}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (newDate) {
                          const startH = Math.floor(startMin / 60);
                          const startM = startMin % 60;
                          const startStr = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
                          setValue("startAt", `${newDate}T${startStr}`);

                          const endH = Math.floor(endMin / 60);
                          const endM = endMin % 60;
                          const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
                          setValue("endAt", `${newDate}T${endStr}`);
                        }
                      }}
                      className="bg-transparent border border-[#27272A] hover:border-zinc-500 rounded-none px-2 py-0.5 text-[10px] font-technical focus:border-[#10B981] focus:outline-none text-white uppercase cursor-pointer"
                    />
                  </div>
                  <span>{getDurationString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="date"
                  {...register("startAt")}
                  className="bg-[#0E0E0E] border border-[#27272A] rounded-none px-3 py-2 w-full text-sm font-technical focus:border-[#10B981] focus:outline-none"
                />
                <input
                  type="date"
                  {...register("endAt")}
                  className="bg-[#0E0E0E] border border-[#27272A] rounded-none px-3 py-2 w-full text-sm font-technical focus:border-[#10B981] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Visual Anchor and Priority */}
          <div className="grid grid-cols-2 gap-4">
            {/* Visual Anchor Buttons */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
                Visual Anchor
              </label>
              <div className="flex border border-[#27272A] bg-[#0E0E0E] p-1 gap-1 w-max">
                {[
                  { id: "code", icon: Code },
                  { id: "mic", icon: Mic },
                  { id: "users", icon: Users },
                  { id: "edit", icon: Edit2 },
                ].map((anchor) => {
                  const IconComp = anchor.icon;
                  const isActive = selectedAnchor === anchor.id;
                  return (
                    <button
                      type="button"
                      key={anchor.id}
                      onClick={() => handleAnchorClick(anchor.id)}
                      className={`h-8 w-8 flex items-center justify-center border transition-all ${
                        isActive
                          ? "bg-[#10B981]/10 border-[#10B981] text-[#10B981]"
                          : "border-transparent text-zinc-500 hover:text-white"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority State */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
                  Priority State
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePriorityClick("LOW")}
                  className={`flex-1 h-9 font-technical text-[10px] font-bold border transition-all ${
                    selectedPriority === "LOW"
                      ? "border-zinc-500 text-zinc-300 bg-white/5"
                      : "border-[#27272A] text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  LOW
                </button>
                <button
                  type="button"
                  onClick={() => handlePriorityClick("CRITICAL")}
                  className={`flex-1 h-9 font-technical text-[10px] font-bold border transition-all ${
                    selectedPriority === "CRITICAL"
                      ? "border-[#EF4444] text-[#EF4444] bg-[#EF4444]/10"
                      : "border-[#27272A] text-zinc-500 hover:text-[#EF4444]"
                  }`}
                >
                  CRITICAL
                </button>
              </div>
            </div>
          </div>

          {/* Hashtags visualization */}
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-technical px-1.5 py-0.5 border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] font-semibold uppercase tracking-wider"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Scope & Context Textarea */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-technical">
              Scope & Context
            </label>
            <Textarea
              placeholder="Deep work session objectives, reference materials, and required outputs..."
              {...register("notes")}
              className="min-h-24 bg-[#0E0E0E] border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus-visible:border-[#10B981] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed font-technical"
            />
          </div>

          {/* Linked Context Block */}
          <div className="border border-[#27272A] bg-[#0E0E0E] p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-16 bg-[#131313] border border-[#27272A] flex items-center justify-center text-zinc-500">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#10B981] font-technical font-bold uppercase tracking-wider">
                  Linked Context
                </div>
                <div className="text-xs font-semibold text-white font-technical truncate max-w-[200px]">
                  system_architecture_draft_v3.png
                </div>
                <div className="text-[9px] text-zinc-500 font-technical">
                  Added from &apos;Stacks&apos; • 2.4MB
                </div>
              </div>
            </div>
            <button
              type="button"
              className="h-8 w-8 border border-[#27272A] flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-between items-center pt-2 border-t border-[#27272A]">
            {event && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                className="h-10 rounded-none font-technical text-xs font-semibold uppercase tracking-wider border border-transparent hover:border-red-600"
              >
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-10 text-xs text-zinc-400 hover:text-white rounded-none hover:bg-white/5 uppercase tracking-wider font-semibold"
              >
                Discard
              </Button>
              <Button
                type="submit"
                className="h-10 bg-white hover:bg-white/95 text-[#0E0E0E] rounded-none text-xs uppercase tracking-wider font-bold"
              >
                {event ? "Initiate Flow" : "Initiate Flow"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
