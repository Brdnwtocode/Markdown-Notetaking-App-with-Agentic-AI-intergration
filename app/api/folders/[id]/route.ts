import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function isDescendant(folderId: string, potentialParentId: string): Promise<boolean> {
  if (folderId === potentialParentId) return true;
  let currentId: string | null = potentialParentId;
  const visited = new Set<string>(); // Prevent infinite loop on database corruption

  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const f: { parentId: string | null } | null = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!f) break;
    if (f.parentId === folderId) return true;
    currentId = f.parentId;
  }
  return false;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: params.id },
    });

    if (!folder || folder.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, parentId } = body;

    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Folder name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        updateData.parentId = null;
      } else {
        if (typeof parentId !== "string") {
          return NextResponse.json(
            { error: "Invalid parent folder ID" },
            { status: 400 }
          );
        }

        // Cycle check: parentId cannot be this folder itself or a descendant
        if (parentId === params.id || (await isDescendant(params.id, parentId))) {
          return NextResponse.json(
            { error: "Cannot move a folder inside itself or its own subfolders" },
            { status: 400 }
          );
        }

        // Verify parent folder exists and belongs to user
        const parentFolder = await prisma.folder.findUnique({
          where: { id: parentId },
        });

        if (!parentFolder || parentFolder.userId !== session.user.id) {
          return NextResponse.json(
            { error: "Parent folder not found or unauthorized" },
            { status: 400 }
          );
        }

        updateData.parentId = parentId;
      }
    }

    const updated = await prisma.folder.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/folders/[id] error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: params.id },
    });

    if (!folder || folder.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Since onDelete: Cascade is configured on relationships in the schema, 
    // deleting the parent folder automatically deletes subfolders, notes, and stacks.
    await prisma.folder.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/folders/[id] error:", error);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
