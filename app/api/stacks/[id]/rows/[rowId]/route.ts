import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; rowId: string } }
) {
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

  const { data } = await request.json();

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const updated = await prisma.stackRow.update({
    where: { id: params.rowId },
    data: { data },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; rowId: string } }
) {
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
}
