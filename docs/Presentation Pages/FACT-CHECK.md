# FACT-CHECK.md — Master Verified Facts Reference

> **Purpose**: Single source of truth for all factual claims used in presentation slides.
> Every statistic, model name, performance number, and feature claim is pinned to its source document.
> **Last updated**: 2026-06-18

---

## 1. INSTITUTIONAL & THESIS METADATA

| Fact | Value | Source |
|---|---|---|
| Institution | Ho Chi Minh City University of Technology and Education (HCMUTE) | ThesisFrontMatter.md |
| Faculty | Faculty of International Education | ThesisFrontMatter.md |
| Presenter | Pham Nam Hao | ThesisFrontMatter.md |
| Student ID | 22110023 | ThesisFrontMatter.md |
| Major | Information Technology | ThesisFrontMatter.md |
| Advisor | MSc. Nguyen Dang Quang | ThesisFrontMatter.md |
| Defense Date | June 2026 | ThesisFrontMatter.md |
| Official Thesis Title (EN) | "Developing an Agentic AI Notetaking System: A Multimodal Personal Knowledge Workspace with Schema-Aware Action Execution" | ThesisFrontMatter.md |
| Official Thesis Title (VI) | "Phát triển Hệ thống Ghi chú AI Tác tử: Không gian Làm việc Tri thức Cá nhân Đa phương thức với Thực thi Hành động Nhận biết Lược đồ" | ThesisFrontMatter.md |
| Application Name | "Lock In" | Throughout all docs |

---

## 2. PROBLEM DOMAIN — VERIFIED STATISTICS

| Fact | Value | Source | Academic Context |
|---|---|---|---|
| Productivity loss from context-switching | **97%** of people lose productivity when switching between fragmented tools | Introduction.txt, Problem and Existing System.txt | Velumyan, 2026 |
| Manual typing speed | **40–60 WPM** (words per minute) | Introduction.txt | Dhakal, Feit, Kristensson, & Oulasvirta, 2018 |
| Conversational speech speed | **125–150 WPM** | Introduction.txt | Dhakal et al., 2018 |
| Throughput gap (speech vs typing) | **~3×** advantage for speech | Introduction.txt | Derived from WPM ranges |
| Information overload impact | Directly impairs knowledge acquisition | Problem and Existing System.txt | Feroz, Zulfiqar, Noor, & Huo, 2022 |
| Traditional PKM insufficiency | Becoming "landfills of half-baked notes" | Problem and Existing System.txt | Silveira, 2026 |
| Voice-driven query speedup | **2.7×** compared to typing (when schema-aware) | Problem and Existing System.txt | Ullauri, Paudel, & Prasad, 2020 |
| Notion database learning curve | Can take "weeks of deliberate practice" | Problem and Existing System.txt | Notion User Survey, 2024 |
| Passive AI limitation | Current AI assistants are "passive chatbots rather than proactive teammates" | Problem and Existing System.txt | Nazeer, Sumbal, & Sultana, 2023; Basic Memory Blog, 2023 |

---

## 3. SYSTEM ARCHITECTURE — VERIFIED FACTS

| Fact | Value | Source |
|---|---|---|
| Frontend framework | **Next.js 14** (App Router) + React 18 | Technology Review.md, Context.md, Development and Deployment.txt |
| Styling | **Tailwind CSS** + custom components (shadcn/ui) | Context.md, Technology Review.md |
| State management | **Zustand** (10 modular slices) | Context.md, Technology Review.md |
| Editor engine | **Milkdown** (WYSIWYG Markdown with live preview) | Technology Review.md, Implementation Status.txt |
| BFF / Application server | **Node.js** with NextAuth.js + Prisma ORM | Technology Review.md |
| Database | **Neon Serverless PostgreSQL** | Technology Review.md, Context.md, Development and Deployment.txt |
| ORM | **Prisma** (type-safe queries, auto-migrations) | Technology Review.md, Context.md |
| Structured data storage | PostgreSQL **JSONB** columns (dynamic Stack rows, no schema migrations needed) | Technology Review.md, Context.md |
| Object storage | **S3-compatible** (AWS S3 / Cloudflare R2 / MinIO local) | Technology Review.md, Context.md |
| AI microservice | **Python FastAPI** (stateless, async) | Technology Review.md, Implementation Status.txt |
| AI orchestration | **LangGraph StateGraph** (compiled directed graph with MemorySaver) | Technology Review.md |
| Schema validation | **Pydantic v2** (dynamic `create_model()` runtime compilation) | Technology Review.md, ThesisFrontMatter.md |
| Model routing | **LiteLLM** (unified abstraction layer) | Technology Review.md, Problem and Existing System.txt |

---

## 4. AI MODELS — VERIFIED NAMES & ROLES

| Role | Model | Source |
|---|---|---|
| **Primary STT** | **Deepgram Nova-3** (WebSocket, linear16 PCM, 16kHz, Vietnamese-optimized) | Context.md, Implementation Contracts/Real Time STT by Deepgram.md, ThesisFrontMatter.md |
| **STT Fallback** | **Groq Whisper-large-v3** (REST fallback) | Problem and Existing System.txt, Implementation Status.txt |
| **Safety Gate / Sentinel** | **Groq Llama-3.1-8B-Instant** (prompt injection classification) | Technology Review.md, Implementation Status.txt |
| **Primary NLU Resolver** | **Google Gemini 2.5 Flash** (intent resolution, structured JSON output) | Technology Review.md, ThesisFrontMatter.md |
| **NLU Fallback** | **Groq Llama-3.3-70B** (fallback routing via LiteLLM) | Content-gemini.md, Problem and Existing System.txt |

> **⚠️ Correction note**: Many older docs and current HTML slides reference "Nova-2." The codebase and implementation contracts use **Nova-3** (better Vietnamese tonal accuracy, available since January 2026). All presentation content must use **Nova-3**.

---

## 5. PERFORMANCE METRICS — VERIFIED

| Metric | Value | Source |
|---|---|---|
| End-to-end voice command latency | **≤ 4.0 seconds** (full round-trip: speak → STT → NLU → UI proposal) | ThesisFrontMatter.md, Introduction.txt, Implementation Status.txt |
| Deepgram STT return time | **< 400ms** (streaming transcription begins near-instantly) | Implementation Status.txt |
| Gemini NLU resolution time | **< 900ms** (intent parsed and JSON generated) | Implementation Status.txt |
| Type validation accuracy | **100%** (zero hallucination in structured Stack row operations) | Implementation Status.txt, ThesisFrontMatter.md |
| Audio file size limit | **10MB** (validated at ingestion; oversized files blocked with HTTP 400) | Presentation page.tsx, test case VOICE_003 |
| Debounce autosave interval | **1,000ms** (Note editor autosave) | Presentation page.tsx, test case NOTE_002 |
| Reflexion loop threshold | **Score ≥ 0.8** (output accepted; else loops back to Resolver, max 3 retries) | Technology Review.md, page.tsx Reflexion simulation |
| Short-term memory window | **Last 10 turns** (sliding conversation buffer) | Technology Review.md |

---

## 6. FEATURE COMPLETION — VERIFIED

| Module | Status | Source |
|---|---|---|
| User Authentication & Session Management | **100% Complete** (NextAuth.js: Google OAuth + Email/Password) | Implementation Status.txt |
| Unstructured Note System | **100% Complete** (Milkdown WYSIWYG, autosave, raw toggle, image upload) | Implementation Status.txt |
| Structured Stacks Database | **100% Complete** (dynamic typed columns, JSONB rows, aggregates) | Implementation Status.txt |
| Task & Calendar Orchestration | **100% Complete** (hierarchical subtasks, calendar with color coding) | Implementation Status.txt |
| Stateless FastAPI AI Brain | **100% Complete** (audio parsing, schema enforcement, LiteLLM routing) | Implementation Status.txt |
| Speech-to-Text Integration | **100% Complete** (Deepgram Nova-3 WebSocket + Groq Whisper fallback) | Implementation Status.txt |
| Sentinel Security Layer | **100% Complete** (UUID delimiters + Llama-3.1-8B classification) | Implementation Status.txt |
| Agentic Automate BFF Route (v3) | **100% Complete** (mutual exclusivity audio/transcript, S3 resolution, null-merge) | Implementation Status.txt |
| Voice-to-Workspace State Wiring | **100% Complete** (resolved voice → client state → optimistic updates) | Implementation Status.txt |
| Confirmation Gate DB Hooks | **100% Complete** (Zustand staged changes → Prisma commit on user accept) | Implementation Status.txt |
| **Overall Feature Completion** | **100%** | Implementation Status.txt |

---

## 7. USER SCENARIOS — VERIFIED FACTS

### Scenario 1: HR & Talent Development Lead
- **Pain**: Candidate data scattered across PDFs, notes, spreadsheets; manual data entry; disconnected interview feedback
- **Lock In features used**: Stacks (candidate DB), Records (interview transcription), Agentic Automate (extract-to-Stack, candidate profiling), Tasks (recruitment tracking)
- **Key expectations**: Bulk CV import, AI candidate profiling/scoring, extract-to-Stack automation, candidate comparison, role-based access
- **Source**: SCENARIOS.md

### Scenario 2: Academic Tutor
- **Pain**: Teaching resources fragmented across folders; manual speaking assessment review; schedule conflicts across classes
- **Lock In features used**: Notes (lesson hub), Records (speaking assessment transcription), AI Companion (grammar/vocabulary analysis), Agentic Automate (lesson→task extraction), Calendar (weekly planning)
- **Key expectations**: AI pronunciation analysis, inline transcript corrections, student progress dashboards, recurring templates, color-coded calendars
- **Source**: SCENARIOS.md

### Scenario 3: Founder & Small Business Owner
- **Pain**: Ideas lost in the moment; scattered voice memos; no structure connecting insights to action; searching across multiple tools
- **Lock In features used**: Voice Input (instant capture), Records (transcription archive), Agentic Automate (thought→structured doc), Stacks (pipeline/experiments/partnerships), AI Companion (conversational querying across all data)
- **Key expectations**: AI executive dashboards, automated KPI tracking, daily briefings, meeting-to-task automation, opportunity prioritization, business intelligence across modules
- **Source**: SCENARIOS.md

---

## 8. COMPETITIVE LANDSCAPE — VERIFIED

| Dimension | Notion | Obsidian | Lock In |
|---|---|---|---|
| **Core identity** | All-in-one team workspace | Personal knowledge vault | AI-native individual workspace |
| **Editor** | Block-based (proprietary) | Plain Markdown files | Markdown WYSIWYG (Milkdown) |
| **Structured data** | Relational databases (6 views, 20+ property types) | Plugin-based (Dataview) | Stacks (typed columns, JSONB) |
| **AI integration** | Deep agents, autonomous workflows | Plugin ecosystem varies | Context-aware, voice-driven, mutation-staging |
| **AI safety model** | AI applies changes directly; agents autonomous | Depends on plugin | **User must review and approve every AI-proposed change** |
| **Voice** | Voice input for agents + AI Meeting Notes | Core audio recorder (no transcription) | Real-time STT (Nova-3) + Records Workstation |
| **Collaboration** | Real-time multiplayer | Single-user | Single-user |
| **Data ownership** | Notion's cloud | User's local files | Application database + S3 storage |
| **Offline** | Limited | Full | None |
| **Platform** | Web, desktop, mobile | Desktop, mobile | Web only |
| **Source** | Comparison-Notion-Obsidian-LockIn.md, Competitive-Comparison-Notion-Obsidian.md | | |

### Open-source competitor: files.md
- Stores everything as plain .md files locally; optional sync via iCloud/Dropbox/Go binary
- No built-in AI; codebase kept small enough for one LLM context window
- Optimizes for longevity and ownership (vs Lock In optimizing for capability)
- **Source**: Problem and Existing System.txt

---

## 9. DEPLOYMENT — VERIFIED

| Fact | Value | Source |
|---|---|---|
| Hosting | **AWS EC2** | Development and Deployment.txt |
| Containerization | **Docker** (multi-stage Node 18-slim, port 3000) | Development and Deployment.txt |
| Reverse proxy | **Nginx** (on EC2 host, HTTPS enforcement) | Development and Deployment.txt |
| SSL | **Let's Encrypt** via Certbot (auto-renewal) | Development and Deployment.txt |
| CI/CD | **GitHub Actions** (`deploy.yml`, push-to-main trigger) | Development and Deployment.txt |
| Config injection | **GitHub Repository Secrets** → `.env.local` on EC2 | Development and Deployment.txt |
| Database | **Neon Serverless PostgreSQL** (decoupled from EC2) | Development and Deployment.txt |
| Object storage | **S3** (audio records + note images) | Development and Deployment.txt |
| Orchestration | **Docker Compose** (rebuild + `npx prisma migrate deploy` on startup) | Development and Deployment.txt |

---

## 10. DEVELOPMENT METHODOLOGY — VERIFIED

| Fact | Value | Source |
|---|---|---|
| Methodology | **ABDP** (Agent-Based Developing Process) | Development and Deployment.txt |
| Architecture & Design agent | Claude | Development and Deployment.txt |
| Complex implementation agent | GitHub Copilot + DeepSeek v4 | Development and Deployment.txt |
| Documentation & aesthetics agent | Antigravity IDE + Gemini | Development and Deployment.txt |
| Small-task agents | Cursor, Trae, Junie, OpenCode Agents | Development and Deployment.txt |
| IDE tools used | VS Code, Antigravity, Trae, Cursor, WebStorm | Development and Deployment.txt |

---

## 11. USE CASES — COMPLETE LIST

From UseCaseTable.md — 20 functional use cases implemented:
1. View Workspace | 2. Create Note | 3. Edit Note | 4. Delete Note | 5. Search Workspace
6. Create Stack | 7. View Stack | 8. Manage Stack | 9. Delete Stack | 10. Voice Command
11. Confirm/Discard Note Update | 12. Confirm/Discard Stack Row | 13. View Conversational AI Reply
14. Toggle Raw Markdown View | 15. Export Note | 16. Export Stack | 17. Log Out
18. Manage Explorer (hierarchical folders, drag-drop, filter, sort)
19. Manage Audio Records (background recording, live STT, playback controls)
20. Agentic Automate (S3 persistence, parallel AI extractions, bundled mutation review)

---

## 12. CORRECTION LOG

| Date | Correction | Old Value | New Value | Reason |
|---|---|---|---|---|
| 2026-06-18 | STT model name | Nova-2 | **Nova-3** | Codebase + Implementation Contracts + ThesisFrontMatter all use Nova-3; better Vietnamese tonal accuracy |
| 2026-06-18 | Feature completion | 90% (in some older docs) | **100%** | Implementation Status.txt confirms all modules complete |
| 2026-06-18 | Deployment status | Not deployed (in some older docs) | **Fully deployed** on AWS EC2 | Development and Deployment.txt confirms live deployment with CI/CD |
