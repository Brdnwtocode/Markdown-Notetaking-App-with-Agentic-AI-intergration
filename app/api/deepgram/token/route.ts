// app/api/deepgram/token/route.ts
//
// Mints a short-lived Deepgram token scoped to this user's PTT session.
// The API key never leaves the server. Each token lives 30 seconds —
// enough for one recording session; stolen tokens expire before misuse.

import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // fetch to Deepgram needs full Node runtime

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("DEEPGRAM_API_KEY is not set");
    return NextResponse.json({ error: "STT not configured" }, { status: 503 });
  }

  try {
    // 1. Get the list of projects to find the project ID
    const projectsResponse = await fetch("https://api.deepgram.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      console.error("Failed to list Deepgram projects:", projectsResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to list Deepgram projects" },
        { status: 502 }
      );
    }

    const projectsData = await projectsResponse.json();
    const projectId = projectsData.projects?.[0]?.project_id;
    if (!projectId) {
      console.error("No Deepgram projects found for the provided API key");
      return NextResponse.json(
        { error: "No Deepgram project found" },
        { status: 502 }
      );
    }

    // 2. Generate a temporary project API key that expires in 60 seconds
    const expirationDate = new Date(Date.now() + 60 * 1000).toISOString();
    const keyResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Temporary client PTT key",
        scopes: ["usage:write"],
        expiration_date: expirationDate,
      }),
    });

    if (!keyResponse.ok) {
      const errorText = await keyResponse.text();
      console.error("Failed to create temporary Deepgram key:", keyResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to create temporary key" },
        { status: 502 }
      );
    }

    const keyData = await keyResponse.json();
    const token = keyData.key;
    if (!token) {
      console.error("Deepgram response missing API key:", keyData);
      return NextResponse.json(
        { error: "Invalid key received from Deepgram" },
        { status: 502 }
      );
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error("STT token route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
