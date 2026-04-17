import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; rowId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stack = await prisma.stack.findUnique({
      where: { id: params.id },
    });

    if (!stack || stack.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = await prisma.stackRow.findUnique({
      where: { id: params.rowId },
    });

    if (!row || row.stackId !== params.id) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const schema = z.object({
      data: z.record(z.any()),
    });

    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { data } = result.data;

    const updated = await prisma.stackRow.update({
      where: { id: params.rowId },
      data: { data },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/stacks/[id]/rows/[rowId] error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; rowId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stack = await prisma.stack.findUnique({
      where: { id: params.id },
    });

    if (!stack || stack.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = await prisma.stackRow.findUnique({
      where: { id: params.rowId },
    });

    if (!row || row.stackId !== params.id) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    await prisma.stackRow.delete({
      where: { id: params.rowId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/stacks/[id]/rows/[rowId] error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
