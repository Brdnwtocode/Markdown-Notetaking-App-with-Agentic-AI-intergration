import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { DataType } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Vercel serverless function timeout

interface VoiceProcessRequest {
  audio: Blob;
  contextType: "NOTE" | "STACK";
  contextId: string;
  cursorPosition?: number;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const contextType = formData.get("contextType") as "NOTE" | "STACK";
    const contextId = formData.get("contextId") as string;
    const cursorPosition = formData.get("cursorPosition")
      ? parseInt(formData.get("cursorPosition") as string)
      : 0;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer for OpenAI
    const buffer = Buffer.from(await audioFile.arrayBuffer());

    // Step 1: Transcribe with Whisper
    const transcript = await transcribeAudio(buffer, audioFile.name);

    // Step 2: Fetch context data
    let contextData: any = null;
    let resource: any = null;

    if (contextType === "NOTE") {
      resource = await prisma.note.findUnique({
        where: { id: contextId },
      });

      if (!resource || resource.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }

      contextData = resource.content;
    } else if (contextType === "STACK") {
      resource = await prisma.stack.findUnique({
        where: { id: contextId },
        include: {
          columns: true,
          rows: true,
        },
      });

      if (!resource || resource.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Stack not found" },
          { status: 404 }
        );
      }

      contextData = {
        name: resource.name,
        columns: resource.columns,
        rowCount: resource.rows.length,
      };
    }

    // Step 3: Generate tool schema based on context
    const tools = generateToolSchema(contextType, resource);

    // Step 4: Call GPT-4o with tool calling
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `You are the AI engine for a multimodal workspace. The user is dictating commands in Vietnamese or English.
Current context type: ${contextType}.
Current state: ${JSON.stringify(contextData)}.
User's command (transcribed): "${transcript}"

Execute the user's intent by calling the appropriate tool. Do not respond with conversational text.`,
        },
      ],
      tools,
      tool_choice: "auto",
    });

    // Step 5: Extract tool call and execute
    const toolCall = gptResponse.choices[0].message.tool_calls?.[0];

    if (!toolCall) {
      return NextResponse.json({
        transcript,
        action: "none",
        message: "No action recognized from command",
      });
    }

    const toolArgs = JSON.parse(toolCall.function.arguments);
    let updatedData: any = null;

    if (toolCall.function.name === "update_note") {
      updatedData = await executeNoteUpdate(
        contextId,
        session.user.id,
        toolArgs,
        cursorPosition
      );
    } else if (toolCall.function.name === "add_stack_row") {
      updatedData = await executeStackRowAdd(
        contextId,
        session.user.id,
        toolArgs
      );
    }

    return NextResponse.json({
      transcript,
      action: toolCall.function.name,
      updatedData,
      success: true,
    });
  } catch (error) {
    console.error("Voice processing error:", error);
    return NextResponse.json(
      { error: "Failed to process voice command", details: String(error) },
      { status: 500 }
    );
  }
}

async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  try {
    const file = new File([buffer], filename, { type: "audio/webm" });

    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "vi", // Vietnamese
    });

    return response.text;
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

function generateToolSchema(
  contextType: string,
  resource: any
): OpenAI.Chat.ChatCompletionTool[] {
  if (contextType === "NOTE") {
    return [
      {
        type: "function",
        function: {
          name: "update_note",
          description: "Inserts or modifies Markdown text in the current note.",
          parameters: {
            type: "object",
            properties: {
              content_to_insert: {
                type: "string",
                description:
                  "The Markdown formatted string to insert or replace based on user command.",
              },
              action_type: {
                type: "string",
                enum: ["append", "insert_at_cursor", "replace_all"],
                description:
                  "append: add to end, insert_at_cursor: insert at cursor, replace_all: replace entire content",
              },
            },
            required: ["content_to_insert", "action_type"],
          },
        },
      },
    ];
  } else if (contextType === "STACK") {
    // Dynamically generate schema based on stack columns
    const properties: Record<string, any> = {};
    const required: string[] = [];

    resource.columns.forEach((col) => {
      let schema: any = {};

      switch (col.type) {
        case "INT":
          schema = { type: "integer" };
          break;
        case "FLOAT":
          schema = { type: "number" };
          break;
        case "BOOLEAN":
          schema = { type: "boolean" };
          break;
        case "TEXT":
        default:
          schema = { type: "string" };
          break;
      }

      properties[col.name] = schema;
      required.push(col.name);
    });

    return [
      {
        type: "function",
        function: {
          name: "add_stack_row",
          description: "Adds a new row of structured data to the current Stack table.",
          parameters: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties,
                required,
              },
            },
            required: ["data"],
          },
        },
      },
    ];
  }

  return [];
}

async function executeNoteUpdate(
  noteId: string,
  userId: string,
  args: any,
  cursorPosition: number
): Promise<any> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
  });

  if (!note || note.userId !== userId) {
    throw new Error("Note not found");
  }

  let newContent = note.content;

  switch (args.action_type) {
    case "append":
      newContent = newContent + "\n" + args.content_to_insert;
      break;
    case "insert_at_cursor":
      newContent =
        newContent.substring(0, cursorPosition) +
        args.content_to_insert +
        newContent.substring(cursorPosition);
      break;
    case "replace_all":
      newContent = args.content_to_insert;
      break;
  }

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: { content: newContent },
  });

  return updated;
}

async function executeStackRowAdd(
  stackId: string,
  userId: string,
  args: any
): Promise<any> {
  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    include: { columns: true },
  });

  if (!stack || stack.userId !== userId) {
    throw new Error("Stack not found");
  }

  // Map column names to column IDs
  const mappedData: Record<string, any> = {};

  stack.columns.forEach((col) => {
    if (args.data[col.name] !== undefined) {
      mappedData[col.id] = args.data[col.name];
    }
  });

  const newRow = await prisma.stackRow.create({
    data: {
      stackId,
      data: mappedData,
    },
  });

  return newRow;
}
