import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await prisma.note.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await request.json();

  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { error: "Invalid title" },
      { status: 400 }
    );
  }

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      title,
      content: "",
    },
  });

  return NextResponse.json(note, { status: 201 });
}
