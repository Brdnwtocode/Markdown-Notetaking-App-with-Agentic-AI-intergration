# C2-03 — Context Is Everything

## The One Big Idea
AI without context is a brilliant stranger — knowledgeable but irrelevant. AI with context is a capable partner — it knows your workspace, your data, and exactly what you need. Lock In's ContextPacker automatically injects workspace awareness into every AI request.

## Visual Concept
Two large side-by-side panels showing a contrast. Left panel (red-tinted, dim) shows "Without Context" — a user says "add a row for today's meeting" and the AI responds with confusion. Right panel (emerald-tinted, bright) shows "With Lock In's ContextPacker" — the same command, but the AI already knows which Stack is open, what columns exist, and proposes a perfectly typed row. The difference is stark and immediate.

## Content Elements

### Headline
AI Without Context vs. AI That Knows Your Workspace

### Left Panel — Without Context
- **User says**: "Add a row for today's meeting"
- **AI responds**: "Which table? What columns? What data type? I need more information."
- **Result**: Useless. User must manually specify everything — defeating the purpose.

### Right Panel — With Lock In's ContextPacker
- **User says**: "Add a row for today's meeting"
- **AI already knows**: The active Stack is "Client Meetings" with columns: Client Name (Text), Date (Date), Duration (Int), Notes (Text)
- **AI proposes**: A correctly typed row with today's date — staged as a ghost row for approval
- **Result**: Immediate. Accurate. One click to confirm.

### How It Works (one line)
The ContextPacker automatically resolves your active workspace tabs — extracting note content, Stack schemas, task metadata, and @mentions — and injects it all into every AI request.

## Interactive Notes
- Left panel appears dimmed; right panel glows on entry
- The contrast should be visually striking — this is the "aha" slide

## Source Verification
- Technology Review.md — ContextPacker mechanism: resolves active tabs, extracts content/schema/metadata, assembles structured payload
- FACT-CHECK.md §4 — AI model pipeline with context injection
