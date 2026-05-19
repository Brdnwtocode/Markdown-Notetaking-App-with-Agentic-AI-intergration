import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateTaskSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignee: z.string().max(200).nullable().optional(),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task || task.userId !== session.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(task);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task || task.userId !== session.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const parsed = UpdateTaskSchema.parse(body);
    const updated = await prisma.task.update({
        where: { id: params.id },
        data: {
            ...parsed,
            dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        },
    });
    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task || task.userId !== session.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.task.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
}