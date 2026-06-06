// app/api/search/route.ts
//
// Search API for @mention system
// Provides title-based search across notes, stacks, and tasks

import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const typesParam = searchParams.get("types") || "NOTE,STACK,TASK";
  const limit = parseInt(searchParams.get("limit") || "10");

  const types = typesParam.split(",").map((t) => t.trim());

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results: Array<{
    type: string;
    id: string;
    title: string;
    relevance: number;
  }> = [];

  try {
    // Search Notes
    if (types.includes("NOTE")) {
      const notes = await prisma.note.findMany({
        where: {
          userId: session.user.id,
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
        take: limit,
      });

      for (const note of notes) {
        results.push({
          type: "NOTE",
          id: note.id,
          title: note.title,
          relevance: calculateRelevance(query, note.title),
        });
      }
    }

    // Search Stacks
    if (types.includes("STACK")) {
      const stacks = await prisma.stack.findMany({
        where: {
          userId: session.user.id,
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          updatedAt: true,
        },
        take: limit,
      });

      for (const stack of stacks) {
        results.push({
          type: "STACK",
          id: stack.id,
          title: stack.name,
          relevance: calculateRelevance(query, stack.name),
        });
      }
    }

    // Search Tasks
    if (types.includes("TASK")) {
      const tasks = await prisma.task.findMany({
        where: {
          userId: session.user.id,
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
        take: limit,
      });

      for (const task of tasks) {
        results.push({
          type: "TASK",
          id: task.id,
          title: task.title,
          relevance: calculateRelevance(query, task.title),
        });
      }
    }

    // Sort by relevance (highest first) and limit total results
    results.sort((a, b) => b.relevance - a.relevance);
    const limitedResults = results.slice(0, limit);

    return NextResponse.json({ results: limitedResults });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

/**
 * Simple relevance calculation
 * Returns higher score for exact matches and prefix matches
 */
function calculateRelevance(query: string, title: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact match
  if (titleLower === queryLower) return 100;
  
  // Starts with query
  if (titleLower.startsWith(queryLower)) return 80;
  
  // Contains query
  if (titleLower.includes(queryLower)) return 60;
  
  // Fuzzy: count matching words
  const queryWords = queryLower.split(/\s+/);
  const titleWords = titleLower.split(/\s+/);
  let matchCount = 0;
  for (const qw of queryWords) {
    if (titleWords.some((tw) => tw.includes(qw) || qw.includes(tw))) {
      matchCount++;
    }
  }
  
  return (matchCount / queryWords.length) * 40;
}
