import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stack = await prisma.stack.findUnique({
    where: { id: params.id },
    include: {
      columns: { orderBy: { order: "asc" } },
      rows: true,
    },
  });

  if (!stack || stack.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(stack);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
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

  await prisma.stack.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    name,
    columns,
    rows,
    folderId,
  } = body as {
    name?: string;
    columns?: Array<{ id?: string; name: string; type: string; order?: number }>;
    rows?: Array<{ id?: string; data: Record<string, any> }>;
    folderId?: string | null;
  };

  // Start transaction for bulk update
  const stack = await prisma.$transaction(async (tx) => {
    // Update stack name or folderId if provided
    if (name || folderId !== undefined) {
      await tx.stack.update({
        where: { id: params.id, userId: session.user.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(folderId !== undefined && { folderId }),
        },
      });
    }

    // Update columns if provided
    if (columns) {
      // Delete existing columns not in new list
      const existingColumns = await tx.stackColumn.findMany({
        where: { stackId: params.id },
      });
      const newColumnIds = columns.map((c) => c.id).filter((id) => id && !id.startsWith("temp_")) as string[];
      const columnsToDelete = existingColumns.filter((c) => !newColumnIds.includes(c.id));
      
      for (const col of columnsToDelete) {
        await tx.stackColumn.delete({ where: { id: col.id } });
      }

      // Upsert new/existing columns (preserve order from client)
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const colOrder = col.order ?? i;
        if (col.id && !col.id.startsWith("temp_")) {
          // Update existing column
          try {
            await tx.stackColumn.update({
              where: { id: col.id, stackId: params.id },
              data: { name: col.name, type: col.type as any, order: colOrder },
            });
          } catch {
            // Ignore if not found
          }
        } else {
          // Create new column
          await tx.stackColumn.create({
            data: {
              name: col.name,
              type: col.type as any,
              order: colOrder,
              stackId: params.id,
            },
          });
        }
      }
    }

    // Update rows if provided
    if (rows) {
      // Delete existing rows not in new list
      const existingRows = await tx.stackRow.findMany({
        where: { stackId: params.id },
      });
      const newRowIds = rows.map((r) => r.id).filter((id) => id && !id.startsWith("temp_")) as string[];
      const rowsToDelete = existingRows.filter((r) => !newRowIds.includes(r.id));
      
      for (const row of rowsToDelete) {
        await tx.stackRow.delete({ where: { id: row.id } });
      }

      // Upsert new/existing rows
      for (const row of rows) {
        if (row.id && !row.id.startsWith("temp_")) {
          // Update existing row (only if it's not a temp id)
          try {
            await tx.stackRow.update({
              where: { id: row.id, stackId: params.id },
              data: { data: row.data },
            });
          } catch {
            // Ignore if not found
          }
        } else if (!row.id || row.id.startsWith("temp_")) {
          // Create new row
          await tx.stackRow.create({
            data: {
              data: row.data,
              stackId: params.id,
            },
          });
        }
      }
    }

    // Fetch updated stack with ordered columns
    return tx.stack.findUnique({
      where: { id: params.id },
      include: { columns: { orderBy: { order: "asc" } }, rows: true },
    });
  });

  if (!stack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(stack);
}
