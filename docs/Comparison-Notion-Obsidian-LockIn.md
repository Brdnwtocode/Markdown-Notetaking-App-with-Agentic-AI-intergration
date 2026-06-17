# Comparative Analysis: Notion, Obsidian, and Lock In

> **Document Type**: Academic Reference — Product Comparison  
> **Date**: June 2026  
> **Context**: Graduation Thesis (KLTN) — Markdown Notetaking App with Agentic AI Integration

---

## 1. Overview

This document compares three productivity tools — **Notion**, **Obsidian**, and **Lock In** — not by listing technical specifications, but by examining *what each tool does*, *who it is for*, and *why each one takes a fundamentally different approach* to the same problem: helping people organize knowledge, manage work, and think more clearly.

These three applications are not competing in the same market. They represent three distinct philosophies about how digital tools should relate to their users.

---

## 2. Three Philosophies

### Notion — The Team Operating System

Notion is a cloud-based all-in-one workspace designed for teams. Its core belief is that **a single tool should replace the entire productivity stack** — documents, spreadsheets, project boards, wikis, meeting notes, and now AI agents — all inside one platform.

Everything in Notion is a "block" that can be rearranged, nested, and composed. A heading is a block, a paragraph is a block, a database is a block. This block model allows non-technical users to build complex internal tools (CRMs, project trackers, company wikis) without writing code. Notion's databases are especially powerful: a single dataset can be viewed as a table, a Kanban board, a timeline, a calendar, or a gallery.

Since 2023, Notion has aggressively integrated AI. As of 2026, Notion offers **AI Agents** — both personal assistants (reactive, triggered by the user) and custom agents (proactive, running autonomously on schedules or triggers). Notion also provides **AI Meeting Notes** that capture system audio in real time, transcribe it, and generate summaries and action items — all without a third-party bot joining the call. Users can interact with Notion AI via voice input on desktop and mobile.

**Who it's for**: Teams, startups, and organizations who want everyone on the same page — literally. Notion excels when many people need to collaborate on shared knowledge and workflows.

**What it costs**: Free for individuals (limited for teams). Plus plan at $10/member/month (annual), Business at $18–20/member/month (annual, includes AI). Enterprise at custom pricing. Custom AI Agents use a separate credit-based system.

### Obsidian — The Personal Knowledge Vault

Obsidian takes the opposite stance from Notion on nearly every dimension. Its core belief is that **your notes are yours** — they should be plain text files on your own computer, readable by any text editor, owned by you forever.

Obsidian stores everything as standard Markdown `.md` files in a local folder (called a "vault"). There is no cloud account required, no subscription needed to use the core app, and no vendor lock-in. If Obsidian disappeared tomorrow, your files would still be there.

What makes Obsidian more than a text editor is its **linking system**. Users create `[[wikilinks]]` between notes, and Obsidian visualizes these connections as an interactive knowledge graph. This turns a folder of notes into a web of interconnected ideas — a "second brain" that reveals patterns and connections the user might not have noticed.

Obsidian is also highly extensible. With over **4,000 community plugins and themes** as of mid-2026, users can add databases (Dataview), task management (Tasks plugin), calendars, kanban boards, AI assistants, and more. The core app includes built-in features like an **audio recorder** (core plugin) and Canvas (a spatial thinking tool).

**Who it's for**: Individual thinkers, researchers, writers, and developers who care deeply about data ownership and want to build a personal knowledge system over years or decades.

**What it costs**: Free for personal and commercial use. Optional paid services: Sync ($4–10/month depending on tier) for encrypted cloud sync, Publish ($8/month) for publishing notes as a website.

### Lock In — The AI-Native Workspace

Lock In is a web-based workspace built from the ground up around a different question: **what if AI could safely participate in your workflow — not just answer questions, but actually propose changes to your notes, tasks, tables, and calendar?**

Lock In combines a Markdown editor, structured data tables ("Stacks"), a task manager with subtask hierarchies, and a calendar into one workspace. These four modules share a common AI layer: the **AI Companion**, a chat sidebar that understands what the user is currently looking at and can propose context-aware modifications across all modules.

What makes Lock In distinct is its **human-in-the-loop mutation model**. When the AI suggests a change — inserting text into a note, adding a row to a table, creating a task, or scheduling an event — it doesn't apply the change immediately. Instead, it stages the suggestion as a visual diff or ghost row that the user must explicitly **accept or reject** before anything is saved. This puts the user in the position of reviewer, not passenger.

Lock In also integrates **real-time voice input** (via Deepgram speech-to-text, supporting Vietnamese and English) directly into its workspace, and includes a **Records Workstation** for long-form audio recording with transcription and AI-driven content extraction.

**Who it's for**: Individual users (particularly Vietnamese-speaking) who want an integrated workspace where AI acts as a proactive but controlled collaborator — suggesting, not deciding.

**What it costs**: Free and open source. Self-hosted (Vercel or Docker). Users pay only for third-party services (database hosting, Deepgram API, OpenAI API).

---

## 3. Why They Are Different

The fundamental differences between these three tools are not about features — they are about **design values**.

### 3.1 Where Does Your Data Live?

| | Notion | Obsidian | Lock In |
|---|---|---|---|
| **Data location** | Notion's cloud servers | Your local filesystem | Your own PostgreSQL database + S3 storage |
| **Data format** | Proprietary blocks (exportable to Markdown) | Plain `.md` files — universal, portable | Markdown text in database, structured data as JSON |
| **Offline access** | Limited (cached pages) | Full — it's a local app | None — requires a running server |
| **What happens if the company disappears** | You lose real-time access; must export | Nothing — your files are still on your disk | You keep the server and database; source code is open |

Notion prioritizes convenience and collaboration over data ownership. Obsidian prioritizes data ownership above all else. Lock In sits in between — users own their infrastructure, but data requires a running server to be useful.

### 3.2 How Does AI Fit In?

This is where the three tools diverge most sharply.

| | Notion | Obsidian | Lock In |
|---|---|---|---|
| **AI philosophy** | AI as a platform service — deeply integrated, increasingly autonomous | AI as an opt-in plugin — user chooses what to install | AI as a controlled collaborator — suggests but never acts alone |
| **What AI can do** | Write, summarize, translate, answer questions, run autonomous multi-step agents, transcribe meetings in real time | Depends on installed plugins (e.g., Copilot, Smart Connections) — quality varies | Propose edits to notes (visual diff), add/modify table rows (ghost rows), create tasks, schedule events — all staged for review |
| **Voice capabilities** | Voice input for AI agents + AI Meeting Notes (live transcription of system audio) | Audio recording (core plugin) — no transcription or AI integration | Real-time speech-to-text (Deepgram) as input to AI pipeline — voice commands create workspace actions |
| **User control over AI actions** | AI applies changes inline; Agents can act autonomously | Plugin-dependent | **Explicit accept/reject required** — AI never writes to the database without user confirmation |
| **AI context awareness** | Current page content | Plugin-dependent (some use vault-wide RAG) | Active note content + current table schema and data + focused task + recent workspace items |

**Notion** is moving toward AI autonomy — agents that run on schedules, respond to triggers, and take actions without waiting for the user. This is powerful for teams but requires trust.

**Obsidian** leaves AI entirely to the plugin ecosystem. The quality and safety of AI features depend on which third-party plugin the user installs.

**Lock In** takes a middle path: AI is deeply integrated and context-aware, but every proposed mutation must be reviewed. The user is always the final decision-maker. This is a deliberate design choice rooted in the thesis research: exploring how agentic AI can participate in productivity workflows without removing human oversight.

### 3.3 Single User vs. Team

| | Notion | Obsidian | Lock In |
|---|---|---|---|
| **Primary mode** | Multiplayer — real-time collaboration is a core feature | Single-player — designed for one person's thinking | Single-player — designed for one person's workflow |
| **Sharing** | Built-in: share pages, guest access, team workspaces, permissions | Optional: Obsidian Publish ($8/month) for static websites | Not implemented |
| **Comments** | Inline and page-level comments | Not available | Not available |

Notion is fundamentally a team tool that also works for individuals. Obsidian and Lock In are fundamentally individual tools.

### 3.4 How Do You Structure Data?

| | Notion | Obsidian | Lock In |
|---|---|---|---|
| **Structured data** | Relational databases with 20+ property types, 6 view types (table, board, timeline, calendar, gallery, list), formulas, relations, rollups | Community plugin (Dataview) — query-based, read-only virtual tables from YAML frontmatter | **Stacks** — editable tables with typed columns, sorting, filtering, grouping, formulas, and AI-assisted row creation |
| **Note linking** | Backlinks panel (limited) | Core feature: `[[wikilinks]]` + interactive knowledge graph | Not implemented |
| **Task management** | Database with status/date properties; any view type | Community plugin (Tasks) — checkbox syntax with dates and priorities | Dedicated module with hierarchical subtasks, status, priority, assignee, due dates |
| **Calendar** | Calendar view of any database with date properties | Community plugin (Full Calendar) | Dedicated calendar module with event CRUD, all-day support, color coding |

Notion's strength is the database system — it's the most powerful structured data tool of the three. Obsidian's strength is the linking system — it's the only one that reveals connections between ideas. Lock In integrates structured data, tasks, and calendar natively, and uniquely allows AI to propose changes across all of them from a single voice command.

---

## 4. Summary Comparison

| Dimension | Notion | Obsidian | Lock In |
|---|---|---|---|
| **Core identity** | All-in-one team workspace | Personal knowledge vault | AI-native individual workspace |
| **Design philosophy** | Convenience + collaboration | Data ownership + extensibility | Human-in-the-loop AI assistance |
| **Editor** | Block-based (proprietary) | Plain Markdown files | Markdown WYSIWYG (Milkdown/ProseMirror) |
| **Structured data** | Relational databases (6 views, 20+ property types) | Plugin-based (Dataview) | Stacks (editable tables with typed columns) |
| **Task management** | Database-driven | Plugin-based | Native hierarchical task system |
| **Calendar** | Database view | Plugin-based | Native calendar module |
| **AI integration** | Deep — agents, meeting transcription, autonomous workflows | Plugin ecosystem — varies | Deep — context-aware, voice-driven, mutation-staging |
| **Voice / Audio** | Voice input for agents + AI Meeting Notes (system audio capture) | Core audio recorder (no transcription) | Real-time STT (Deepgram) + Records Workstation with transcription and AI extraction |
| **AI safety model** | AI applies changes directly; agents can act autonomously | Depends on plugin | User must review and approve every AI-proposed change |
| **Collaboration** | Real-time multiplayer | Single-user | Single-user |
| **Data ownership** | Notion's cloud | User's local files | User's own database and storage |
| **Offline** | Limited | Full | None |
| **Extensibility** | Integrations + public API | 4,000+ community plugins | No plugin system (open source codebase) |
| **Platform** | Web, desktop, mobile (all native) | Desktop, mobile (native) | Web only |
| **Pricing** | Free to $20+/member/month | Free (Sync/Publish optional) | Free (self-hosted, open source) |

---

## 5. What Lock In Contributes

Lock In does not attempt to compete with Notion on breadth or with Obsidian on ecosystem. Its contribution is narrower and more specific:

1. **Staged AI mutations as a design pattern** — demonstrating that AI can propose workspace changes (across notes, tables, tasks, and calendar) that users review before committing, combining the power of agentic AI with the safety of human oversight.

2. **Voice-to-workspace-action pipeline** — showing that a user can speak a command in Vietnamese or English, and the system will understand the workspace context, determine the appropriate action, and present it for approval — bridging unstructured voice input with structured data manipulation.

3. **Dynamic context packing** — when the AI processes a request, it automatically gathers relevant context (the content of the active note, the schema and data of the current table, the focused task) and sends it alongside the user's command, enabling context-aware responses without manual prompting.

These are not features that make Lock In a better product than Notion or Obsidian. They are **research contributions** that explore a specific question: *how should agentic AI participate in a user's workspace without taking away control?*

---

## Sources and Verification

| Claim | Source |
|---|---|
| Notion AI Agents (personal + custom, 2026) | Web search: Notion features 2026 — confirmed autonomous agents with triggers/schedules |
| Notion AI Meeting Notes (live system audio capture) | Web search: Notion AI meeting notes — confirmed real-time transcription without third-party bot |
| Notion voice input | Web search: confirmed voice dictation for AI agents on desktop and mobile |
| Notion pricing (Free, Plus $10, Business $18–20, Enterprise custom) | Web search: Notion pricing 2026 — confirmed per-member annual billing |
| Obsidian Audio Recorder is a **core plugin** | Web search: confirmed as core plugin (disabled by default, enable in Settings) |
| Obsidian community plugins: **4,000+** | Web search: confirmed "over 4,000 plugins and themes" as of mid-2026 |
| Obsidian pricing (free for personal and commercial use) | Web search: confirmed commercial use is free |
| Obsidian Sync pricing ($4–10/month) | Web search: confirmed Standard $4/mo, Plus $8/mo (annual billing) |
| Obsidian Publish pricing ($8/month) | Web search: confirmed $8/mo (annual billing) |
| Lock In: Milkdown editor with CommonMark + GFM | Codebase: `components/workspace/LiveEditor.tsx` — imports `commonmark`, `gfm` presets |
| Lock In: Stacks with typed columns | Codebase: `components/workspace/StackTable.tsx` line 53 — 8 column types |
| Lock In: Hierarchical tasks | Codebase: `prisma/schema.prisma` lines 100-122 — self-referential Task model |
| Lock In: Calendar events | Codebase: `prisma/schema.prisma` lines 124-141 — CalendarEvent model |
| Lock In: Staged mutations (DiffOverlay + UniversalConfirmationToast) | Codebase: `components/workspace/LiveEditor.tsx` (DiffOverlay), `lib/voice/handleResponseActions.ts` (stageMutation calls) |
| Lock In: Deepgram STT (Nova-3, Vietnamese) | Codebase: `components/workspace/ChatSidebar.tsx` lines 148-149 |
| Lock In: Records Workstation with S3 storage | Codebase: `docs/Records-Feature/IMPLEMENTATION.md`, `lib/storage.ts` |
| Lock In: No offline support | Codebase: no service worker, no local-first architecture |
| Lock In: No bidirectional links | Codebase: Milkdown configured with `commonmark` + `gfm` only, no wikilink plugin |
| Lock In: Single-user, no collaboration | Codebase: no WebSocket multiplayer, no sharing endpoints |
