# 00-BACKBONE.md — Presentation Master Backbone

> **Replaces**: `Content Ideas to follow.md`
> **Purpose**: The definitive presentation structure. 4 Content Ideas, 18 slides, business-style. Every slide has a thesis, evidence chain, and transition to the next.

---

## Content Idea 1: THE PROBLEM, SOLUTION & USERS
### *"What is the pain? What solves it? Who needs it?"*

**Thesis**: Modern knowledge workers suffer a measurable, research-backed cognitive penalty from fragmented tools and passive AI. Lock In unifies unstructured and structured thinking under a voice-driven, agentic interface — serving three distinct, real-world user profiles.

| # | Slide Title | One Big Idea | Evidence Anchor |
|---|---|---|---|
| C1-01 | Title Hero | Capstone defense: developing an agentic AI notetaking system at HCMUTE, June 2026 | ThesisFrontMatter.md |
| C1-02 | The Pain Point | Three points of contact: 97% context-switch productivity loss, 3× typing gap, AI stuck as passive chatbots | Introduction.txt, lit review stats |
| C1-03 | What Is Lock In | A multimodal personal knowledge workspace — Notes + Stacks + AI voice companion — that unifies thinking and acting | Project overview synthesis |
| C1-04 | Existing Solutions & Remaining Gaps | Notion is powerful but complex, Obsidian owns your data but lacks native AI — Lock In fills the agentic, safe, voice-first gap | Competitive comparison docs |
| C1-05 | Three User Profiles | HR Lead managing candidate pipelines, Academic Tutor assessing students, Founder capturing business ideas — three real workflows, one tool | SCENARIOS.md |

**Transition to C2**: These three users share one root problem — the gap between raw information and actionable knowledge. Content Idea 2 explains why AI, specifically agentic AI, is the bridge.

---

## Content Idea 2: THE AI STORY
### *"From classifiers to agents — and why context makes AI actually useful"*

**Thesis**: AI has evolved from simple pattern matchers to multi-agent reasoning systems. But its real-world value depends entirely on context. Lock In bridges the Information → Context → Knowledge gap by giving AI deep, automatic workspace awareness — turning a brilliant stranger into a capable partner.

| # | Slide Title | One Big Idea | Evidence Anchor |
|---|---|---|---|
| C2-01 | The Evolution of AI | From classifiers (pattern matching) → LLMs (language) → Agents (tool use) → Multi-Agent (collaboration) → AGI (future). Lock In operates at stages 3–4 with LangGraph-orchestrated expert agents | Technology Review.md LangGraph architecture |
| C2-02 | How People Use AI Today | A bell curve: most users stuck in passive chat (summarize this, write that). Few reach agentic workflows where AI executes operations. Lock In makes agentic AI accessible via voice | AI adoption patterns, Context.md |
| C2-03 | Context Is Everything | Without context: "add a row" → AI asks "which table? what columns?" — useless. With Lock In's ContextPacker: AI already knows your active tab, schema, and data — immediately useful | Technology Review.md ContextPacker |
| C2-04 | The Information → Context → Knowledge Friction | Raw information is abundant. Turning it into actionable knowledge requires manual connecting work — the cognitive bottleneck. Most tools leave users stranded between Information and Context | Funnel model concept |
| C2-05 | How Lock In Bridges the Gap | Capture (voice, 3× faster than typing) → Contextualize (AI understands your workspace automatically) → Act (structured proposals, human-confirmed) — all under 4 seconds | Implementation Status, ThesisFrontMatter |

**Transition to C3**: The AI story sets the stage. Content Idea 3 shows exactly which features deliver this bridge for each of the three users.

---

## Content Idea 3: FEATURES MAPPED TO USERS
### *"What features does Lock In have, and how do they solve real problems for real people?"*

**Thesis**: Lock In's features are not a checklist — they are direct answers to specific user pain points. The same five-module platform (Notes, Stacks, Tasks, Calendar, Records) serves three completely different workflows through AI-powered adaptation.

| # | Slide Title | One Big Idea | Evidence Anchor |
|---|---|---|---|
| C3-01 | Feature Overview | Five integrated modules, one AI layer: Notes (Markdown), Stacks (typed tables), Tasks (hierarchical), Calendar (scheduling), Records (audio workstation) — all wrapped by Agentic Automate + AI Companion | UseCaseTable.md (20 use cases) |
| C3-02 | HR & Talent Lead Workflow | From scattered CVs → structured candidate intelligence: Stacks for evaluation database, Records for interview transcription, Agentic Automate for AI extraction into ghost rows, Tasks for recruitment pipeline | SCENARIOS.md Scenario 1 |
| C3-03 | Academic Tutor Workflow | From fragmented materials → AI-assisted instruction: Notes for lesson hub, Records for speaking assessment analysis, AI Companion for grammar/vocab feedback, Calendar for weekly planning | SCENARIOS.md Scenario 2 |
| C3-04 | Founder & Business Owner Workflow | From fleeting thoughts → centralized operating system: Voice capture on-the-go, Records for searchable archive, Agentic Automate for thought structuring, Stacks for pipeline tracking, AI Companion for conversational business queries | SCENARIOS.md Scenario 3 |
| C3-05 | Cross-Map: One Platform, Three Superpowers | The features don't change — the workflows do. Notes serve all three users differently; Stacks power HR and Founder tracking; Records transforms how all three capture and process audio | Synthesized from all scenarios |

**Transition to C4**: The features work because the AI underneath is genuinely different. Content Idea 4 reveals what makes Lock In's AI special.

---

## Content Idea 4: THE AI DIFFERENTIATOR
### *"What makes Lock In's AI special — and how does it actually help?"*

**Thesis**: Lock In's AI is not a ChatGPT wrapper. It is a purpose-built, schema-aware, voice-driven, safety-gated agentic system with three concrete engineering innovations that competitors lack — delivering measurable, verified results.

| # | Slide Title | One Big Idea | Evidence Anchor |
|---|---|---|---|
| C4-01 | AI Capabilities in Lock In | Five capabilities: Voice-to-Action (speak → execute), Sentinel Security (injection-proof), Schema Enforcement (zero hallucinations), Multi-Expert Reasoning (parallel deliberation), Human-in-the-Loop (you decide) | Technology Review.md, Implementation Status |
| C4-02 | What Makes It Special | Three innovations competitors don't have: Dynamic Schema Compiler (runtime Pydantic forces correct types), ContextPacker (automatic workspace injection), Suggestion-Only Architecture (AI proposes, database never mutated without consent) | Technology Review.md, Comparison docs |
| C4-03 | Measurable Outcomes | ≤ 4.0s end-to-end latency ✓ 100% type validation accuracy ✓ < 400ms STT return ✓ < 900ms NLU resolution ✓ Security tests passing (injection blocked, oversized files rejected, autosave verified) | ThesisFrontMatter, Implementation Status, test results |
| C4-04 | Conclusion: What Was Built & What's Next | Lock In proves agentic AI can be fast, safe, and useful. Achievements: unified workspace, voice-driven AI with data sovereignty, 100% complete, deployed on AWS. Roadmap: production optimization, offline caching, mobile expansion. Closing: "A blueprint for the future of productivity — AI as an active co-pilot, not a passive sidebar chatbot." | Conclusion.txt, Development and Deployment.txt |

---

## Slide Count Summary

| Content Idea | Slides | Range |
|---|---|---|
| C1: Problem, Solution & Users | 5 | C1-01 to C1-05 |
| C2: The AI Story | 5 | C2-01 to C2-05 |
| C3: Features × Users | 5 | C3-01 to C3-05 |
| C4: AI Differentiator | 4 | C4-01 to C4-04 |
| **Total** | **19 slides** (18 content + 1 title) | |

---

## Design Constraint: Business-Style

Every slide must follow these rules:
- **One big idea** — the headline alone should tell the story
- **One dominant visual** — illustration, diagram, big number, or icon cluster
- **Supporting text ≤ 3 short lines**
- **No code blocks** — conceptual visuals replace technical artifacts
- **No font size below `text-sm`**
- **Spacious, not crammed**
