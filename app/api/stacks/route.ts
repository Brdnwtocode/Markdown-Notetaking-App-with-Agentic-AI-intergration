import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stacks = await prisma.stack.findMany({
    where: { userId: session.user.id },
    include: {
      columns: true,
      rows: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(stacks);
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, columns } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    return NextResponse.json(
      { error: "At least one column is required" },
      { status: 400 }
    );
  }

  const stack = await prisma.stack.create({
    data: {
      userId: session.user.id,
      name,
      columns: {
        create: columns.map((col) => ({
          name: col.name,
          type: col.type,
        })),
      },
    },
    include: {
      columns: true,
      rows: true,
    },
  });

  return NextResponse.json(stack, { status: 201 });
}
