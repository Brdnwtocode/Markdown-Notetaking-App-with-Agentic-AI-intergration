"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format, parse, parseISO, startOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  /** Month grid: defaultEnd is last inclusive day; form uses all-day date fields. */
  newEventFromMonthSlot?: boolean;
  onSubmit: (data: EventFormData) => void;
  onDelete?: () => void;
}

const colorSwatches = ["#5645d4", "#e03131", "#1aae39", "#dd5b00", "#2a9d99", "#ff64c8"];

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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-slate-200">
        <DialogHeader><DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
          <Input placeholder="Title" {...register("title")} className="bg-zinc-800 border-zinc-700" />
          <Textarea placeholder="Notes" {...register("notes")} className="bg-zinc-800 border-zinc-700" />
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("allDay")} /> All day
          </label>
          {!allDay ? (
            <>
              <input type="datetime-local" {...register("startAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
              <input type="datetime-local" {...register("endAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
            </>
          ) : (
            <>
              <input type="date" {...register("startAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
              <input type="date" {...register("endAt")} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 w-full" />
            </>
          )}
          <div className="flex gap-2">
            {colorSwatches.map((c) => (
              <button
                type="button"
                key={c}
                className={`w-8 h-8 rounded-full border-2 ${watch("color") === c ? "ring-2 ring-white" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setValue("color", c)}
              />
            ))}
          </div>
          <div className="flex justify-between gap-2">
            {event && onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{event ? "Save" : "Create"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
