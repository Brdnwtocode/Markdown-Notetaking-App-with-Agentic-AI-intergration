import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const row = await prisma.stackRow.create({
      data: {
        stackId: params.id,
        data,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("POST /api/stacks/[id]/rows error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
