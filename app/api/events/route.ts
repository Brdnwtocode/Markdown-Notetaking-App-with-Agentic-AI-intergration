import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateEventSchema = z.object({
    title: z.string().min(1).max(500),
    notes: z.string().max(10000).default(""),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    allDay: z.boolean().default(false),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5645d4"),
}).refine((data) => new Date(data.startAt) <= new Date(data.endAt), {
    message: "startAt must be before endAt",
    path: ["endAt"],
});

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: any = { userId: session.user.id };
    if (from) where.startAt = { gte: new Date(from) };
    if (to) where.endAt = { lte: new Date(to) };
    const events = await prisma.calendarEvent.findMany({
        where,
        orderBy: { startAt: "asc" },
    });
    return NextResponse.json(events);
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const parsed = CreateEventSchema.parse(body);
    const event = await prisma.calendarEvent.create({
        data: {
            ...parsed,
            userId: session.user.id,
            startAt: new Date(parsed.startAt),
            endAt: new Date(parsed.endAt),
        },
    });
    return NextResponse.json(event, { status: 201 });
}