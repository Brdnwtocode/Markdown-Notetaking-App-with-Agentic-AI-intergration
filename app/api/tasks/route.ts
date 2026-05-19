import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateTaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10000).default(""),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    assignee: z.string().max(200).nullable().optional(),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tasks = await prisma.task.findMany({
        where: { userId: session.user.id, parentId: null },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(tasks);
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const parsed = CreateTaskSchema.parse(body);

    if (parsed.parentId) {
        const parent = await prisma.task.findUnique({ where: { id: parsed.parentId } });
        if (!parent || parent.userId !== session.user.id) {
            return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
        }
    }

    const task = await prisma.task.create({
        data: {
            ...parsed,
            userId: session.user.id,
            dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        },
    });
    return NextResponse.json(task, { status: 201 });
}