# C4-02 — What Makes It Special

## The One Big Idea
Three engineering innovations set Lock In's AI apart from every competitor. These are not marketing features — they are architectural decisions with concrete, verifiable outcomes that Notion and Obsidian cannot replicate today.

## Visual Concept
Three large, vertically-stacked distinguishing cards — each taking roughly one-third of the slide height. Each card has: a large icon on the left, a bold innovation name, a one-sentence "what it is" description, and a one-sentence "why competitors can't do this." The Lock In card has the emerald accent; competitor logos appear in muted gray below each comparison.

## Content Elements

### Headline
Three Innovations Competitors Don't Have

### Innovation 1 — Dynamic Schema Compiler
- **Icon**: Gear + code (conceptual — blueprint transforming into a lock)
- **What it is**: At runtime, Lock In's FastAPI reads your Stack schema and compiles a Pydantic validator — forcing the LLM to output perfectly typed data matching your columns.
- **Why it matters**: Notion's AI can generate text — but it can hallucinate column names and wrong data types. Lock In achieves **100% type accuracy** because the LLM is mathematically constrained, not prompted.
- **Competitor gap**: Notion AI lacks schema enforcement at generation time. Obsidian has no native structured data engine.

### Innovation 2 — ContextPacker
- **Icon**: Eye / awareness
- **What it is**: Before every AI request, Lock In automatically resolves your active tab — extracting the note content, Stack schema, column types, task metadata, and @mentions — and injects it into the prompt.
- **Why it matters**: Other AI tools require you to copy-paste context manually. Lock In's AI always knows where you are and what you're working on — no manual setup needed.
- **Competitor gap**: Notion AI has workspace search but not automatic tab-level context injection. Obsidian plugins require manual configuration.

### Innovation 3 — Suggestion-Only Architecture
- **Icon**: Lock + user silhouette
- **What it is**: Lock In's AI is structurally barred from writing to the database. Every proposed change is staged in a Zustand buffer and rendered as a visual diff or ghost row. Only user acceptance triggers a Prisma database commit.
- **Why it matters**: Notion's AI agents can act autonomously on schedules. Obsidian's AI safety depends entirely on which plugin you installed. Lock In guarantees: **you are always the final decision-maker.**
- **Competitor gap**: Notion AI agents are designed for autonomy. No other PKM tool enforces a mandatory human confirmation gate on every AI mutation.

## Interactive Notes
- Cards appear top to bottom, each revealing with a subtle slide-up
- Competitor gap notes appear in smaller, muted text — they support, not dominate
- Three is the right number — memorable, digestible

## Source Verification
- FACT-CHECK.md §3 — Dynamic Schema Compiler (Pydantic create_model), ContextPacker mechanism, Suggestion-Only (Zustand staging → user accept → Prisma commit)
- Technology Review.md — full descriptions of all three innovations
- Comparison-Notion-Obsidian-LockIn.md — competitive gaps verified
