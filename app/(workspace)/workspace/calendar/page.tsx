"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, SlotInfo, Event as RBCEvent, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { useDebouncedCallback } from "use-debounce";
import { useWorkspaceStore } from "@/lib/store";
import { CALENDAR_TAB_ID } from "@/lib/constants";
import { calendarLocalizer } from "@/lib/calendarLocalizer";
import { toast } from "react-hot-toast";
import EventDialog from "@/components/workspace/EventDialog";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/lib/slices/calendarSlice";

const DnDCalendar = withDragAndDrop(Calendar);

type CalendarRbcEvent = RBCEvent & {
  id: string;
  resource: CalendarEvent;
};

function computeVisibleRange(date: Date, view: View | string): { from: Date; to: Date } {
  switch (view) {
    case "month":
      return {
        from: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
        to: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
      };
    case "week":
      return {
        from: startOfWeek(date, { weekStartsOn: 1 }),
        to: endOfWeek(date, { weekStartsOn: 1 }),
      };
    default:
      return { from: date, to: addDays(date, 30) };
  }
}

export default function CalendarPage() {
  const { calendarEvents, setCalendarEvents, openTab, optimisticCreateCalendarEvent, optimisticPatchCalendarEvent, optimisticDeleteCalendarEvent } = useWorkspaceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>();
  /** Month pick: `defaultEnd` is last inclusive calendar day (not RBC exclusive end). */
  const [newEventFromMonthSlot, setNewEventFromMonthSlot] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>("month");

  const debouncedFetchEvents = useDebouncedCallback(
    async (from: Date, to: Date) => {
      try {
        const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
        const res = await fetch(`/api/events?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as CalendarEvent[];
        setCalendarEvents(data);
      } catch {
        toast.error("Failed to load events");
      }
    },
    300
  );

  useEffect(() => {
    openTab(CALENDAR_TAB_ID, "CALENDAR", "Calendar");
    const range = computeVisibleRange(currentDate, currentView);
    debouncedFetchEvents(range.from, range.to);
    return () => {
      debouncedFetchEvents.cancel();
    };
  }, [openTab, debouncedFetchEvents, currentDate, currentView]);

  const rbcEvents: CalendarRbcEvent[] = useMemo(
    () =>
      calendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.startAt),
        end: new Date(e.endAt),
        allDay: e.allDay,
        resource: e,
      })),
    [calendarEvents]
  );

  const isPersistedCalendarEvent = useCallback(
    (ev: RBCEvent) =>
      typeof (ev as CalendarRbcEvent).id === "string" &&
      !(ev as CalendarRbcEvent).id.startsWith("temp_event_"),
    []
  );

  const handleNavigate = useCallback(
    (date: Date, view: View) => {
      setCurrentDate(date);
      setCurrentView(view);
      const range = computeVisibleRange(date, view);
      debouncedFetchEvents(range.from, range.to);
    },
    [debouncedFetchEvents]
  );

  const handleSelectSlot = (slot: SlotInfo) => {
    setEditingEvent(null);
    if (currentView === "month") {
      setNewEventFromMonthSlot(true);
      let first: Date;
      let lastInclusive: Date;
      if (Array.isArray(slot.slots) && slot.slots.length > 0) {
        const days = slot.slots.map((s) =>
          startOfDay(typeof s === "string" ? new Date(s) : (s as Date))
        );
        first = days.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
        lastInclusive = days.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
      } else {
        const a = startOfDay(slot.start as Date);
        const b = startOfDay(slot.end as Date);
        first = a.getTime() <= b.getTime() ? a : b;
        lastInclusive = a.getTime() >= b.getTime() ? a : b;
      }
      setDefaultStart(first);
      setDefaultEnd(lastInclusive);
    } else {
      setNewEventFromMonthSlot(false);
      setDefaultStart(slot.start as Date);
      setDefaultEnd(slot.end as Date);
    }
    setDialogOpen(true);
  };

  const handleSelectEvent = (event: RBCEvent) => {
    const cal = (event as CalendarRbcEvent).resource;
    setEditingEvent(cal);
    setNewEventFromMonthSlot(false);
    setDefaultStart(undefined);
    setDefaultEnd(undefined);
    setDialogOpen(true);
  };

  const handleEventDrop = (args: EventInteractionArgs<object>) => {
    const ev = args.event as CalendarRbcEvent;
    const calEvent = ev.resource;
    let start = args.start instanceof Date ? args.start : new Date(args.start);
    let end = args.end instanceof Date ? args.end : new Date(args.end);
    const allDay = args.isAllDay ?? calEvent.allDay;
    if (allDay) {
      start = startOfDay(start);
      const endDay = startOfDay(end);
      const spanDays = Math.max(1, Math.round((endDay.getTime() - start.getTime()) / 86400000));
      end = addDays(start, spanDays);
    }
    optimisticPatchCalendarEvent(calEvent.id, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay,
    });
  };

  const handleEventResize = (args: EventInteractionArgs<object>) => {
    const ev = args.event as CalendarRbcEvent;
    const calEvent = ev.resource;
    const start = args.start instanceof Date ? args.start : new Date(args.start);
    const end = args.end instanceof Date ? args.end : new Date(args.end);
    optimisticPatchCalendarEvent(calEvent.id, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
  };

  const handleCreate = (data: Parameters<typeof optimisticCreateCalendarEvent>[0]) => {
    optimisticCreateCalendarEvent(data);
    setDialogOpen(false);
  };

  const handleUpdate = (id: string, data: Parameters<typeof optimisticPatchCalendarEvent>[1]) => {
    optimisticPatchCalendarEvent(id, data);
    setDialogOpen(false);
    setEditingEvent(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this event?")) {
      optimisticDeleteCalendarEvent(id);
      setDialogOpen(false);
      setEditingEvent(null);
    }
  };

  return (
      <div className="h-full w-full bg-[#1e1e1e] p-4">
        <DnDCalendar
          localizer={calendarLocalizer}
          events={rbcEvents}
          date={currentDate}
          view={currentView}
          defaultView="month"
          views={["month", "week", "agenda"]}
          style={{ height: "calc(100% - 20px)" }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: (event as CalendarRbcEvent).resource.color,
              borderColor: (event as CalendarRbcEvent).resource.color,
              color: "#ffffff",
            },
          })}
          selectable
          resizable={false}
          draggableAccessor={isPersistedCalendarEvent}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onNavigate={handleNavigate}
          onView={(view) => {
            setCurrentView(view);
            const range = computeVisibleRange(currentDate, view);
            debouncedFetchEvents(range.from, range.to);
          }}
        />
        <EventDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setNewEventFromMonthSlot(false);
          }}
          event={editingEvent}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          newEventFromMonthSlot={newEventFromMonthSlot}
          onSubmit={(data) => {
            if (editingEvent) {
              handleUpdate(editingEvent.id, {
                title: data.title,
                notes: data.notes,
                startAt: data.startAt,
                endAt: data.endAt,
                allDay: data.allDay,
                color: data.color,
              });
            } else {
              handleCreate({
                title: data.title,
                notes: data.notes,
                startAt: data.startAt,
                endAt: data.endAt,
                allDay: data.allDay,
                color: data.color,
              });
            }
          }}
          onDelete={editingEvent ? () => handleDelete(editingEvent.id) : undefined}
        />
      </div>
  );
}
