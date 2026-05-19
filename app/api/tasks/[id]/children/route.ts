import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parent = await prisma.task.findUnique({ where: { id: params.id } });
    if (!parent || parent.userId !== session.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const children = await prisma.task.findMany({
        where: { parentId: params.id, userId: session.user.id },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(children);
}