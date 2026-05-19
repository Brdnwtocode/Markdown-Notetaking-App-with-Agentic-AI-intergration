import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateEventSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    notes: z.string().max(10000).optional(),
    startAt: z.string().datetime({ offset: true }).optional(),
    endAt: z.string().datetime({ offset: true }).optional(),
    allDay: z.boolean().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) return new Date(data.startAt) <= new Date(data.endAt);
      return true;
    },
    { message: "startAt must be before endAt", path: ["endAt"] }
  );

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const parsed = UpdateEventSchema.parse(body);
  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...parsed,
      startAt: parsed.startAt ? new Date(parsed.startAt) : undefined,
      endAt: parsed.endAt ? new Date(parsed.endAt) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
