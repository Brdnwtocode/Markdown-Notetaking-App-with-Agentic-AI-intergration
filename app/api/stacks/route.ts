import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  try {
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
      take: 50,
    });

    return NextResponse.json(stacks);
  } catch (error) {
    console.error("GET /api/stacks error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schema = z.object({
      name: z.string().min(1),
      columns: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(["TEXT", "INT", "FLOAT", "BOOLEAN"]),
      })).min(1),
    });

    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, columns } = result.data;

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
  } catch (error) {
    console.error("POST /api/stacks error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
