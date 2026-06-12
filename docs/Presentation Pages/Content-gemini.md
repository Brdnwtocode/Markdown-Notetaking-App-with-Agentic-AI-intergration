Here is a structured, page-by-page slide deck presentation plan extracted directly from your capstone project materials. It is meticulously optimized for an AI coding agent to translate directly into clean, modern HTML pages (using frameworks like Tailwind CSS, Reveal.js, or custom flex/grid views).

The visual aesthetic strictly adheres to your report's design principles: an **"Obsidian-Notion Hybrid" minimalist dark mode** featuring a `#050505` background, crisp high-contrast text, and strategic **emerald green accents**.

---

## Slide 1: Title & Overview

### 1. Visual Layout Blueprint

* **Layout:** Full-screen flex centering with an ultra-minimalist grid background pattern.
* 
**Color Scheme:** Deep black background (`#050505`), high-contrast off-white typography, and glowing emerald green (`#10b981`) text highlights.


* **Structure:**
* Top-left: Institutional branding context.


* Center: Large bold typographical treatment for the main title.
* Bottom: Metadata block divided horizontally.



### 2. Slide Content

* **Branding Context:** HCMC University of Technology and Education | Faculty of International Education.


* 
**Main Title:** DEVELOPING AN AGENTIC AI NOTETAKING SYSTEM.


* 
**Subtitle:** A Multimodal Personal Knowledge Workspace with Schema-Aware Action Execution.


* **Presenter Details:**
* 
**Student:** Pham Nam Hao (ID: 22110023) 


* 
**Major:** Information Technology 


* **Instructor:** MSc. Nguyen Dang Quang 




* 
**Timeline:** June 2026.



### 3. Interactive Elements & Animations

* Fade-in transition for typography on load.
* A subtle pulsing emerald underline underneath the words "AGENTIC AI".



---

## Slide 2: The Core Problem (The Friction of Thought)

### 1. Visual Layout Blueprint

* **Layout:** 2-column split viewport.
* **Left Column:** Heavy typographical data metrics indicating cognitive penalty.
* **Right Column:** Two code-styled or block-styled problem containers comparing input friction.

### 2. Slide Content

* **Left Column Metrics:**
* 
**97%:** Productivity loss observed when users context-switch between fragmented digital tools.


* 
**3x:** Throughput bottleneck gap between manual keyboard typing (40–60 WPM) and conversational human speech (125–150 WPM).




* **Right Column Points:**
* 
**The Paradigm Split:** Existing platforms isolate free-form ideation (Markdown files) from structured data entry (relational data tracking tables).


* 
**Passive vs. Agentic AI:** Current software integrations limit AI assistants to passive text summarization chatbots rather than proactive entities that actively manipulate system state changes.





### 3. Interactive Elements & Animations

* Counters animate from 0% to 97% and 1x to 3x when the slide comes into focus.

---

## Slide 3: Project Vision & Core Objectives

### 1. Visual Layout Blueprint

* **Layout:** 3x2 symmetrical grid layout of card-styled elements.
* **Styling:** Matte dark gray cards with thin emerald borders that illuminate when highlighted or hovered.

### 2. Slide Content

* **Card 1: Unify the Paradigm Gap**
* Merges unstructured Markdown notes with relational tracking tables (Stacks) inside a single view.




* **Card 2: Eliminate Typing Friction**
* Empowers intent-driven voice execution commands working at the speed of natural speech.




* **Card 3: Deterministic Reliability**
* Completely eliminates "AI hallucinations" in user data entry via strict runtime schema validation systems.




* **Card 4: Ultra-Low Latency**
* Guarantees a processing timeline benchmark of ≤ 4 seconds end-to-end to maintain workflow flow states.




* **Card 5: Data Sovereignty**
* Enforces a mandatory human confirmation safety gate wrapper before making any destructive or mutation writes to the user database.




* **Card 6: Microservice Architecture**
* Decoupled, state-independent foundation allowing rapid model replacement and horizontal scaling pipelines.





### 3. Interactive Elements & Animations

* Staggered cascade fade-in animation for each of the 6 objective cards.

---

## Slide 4: Decentralized System Architecture

### 1. Visual Layout Blueprint

* **Layout:** 3-column structural flowchart mapping data layout properties.
* **Left Component:** Client Web App Block.
* **Center Component:** Application Web Server Block.
* **Right Component:** Stateless AI Processing Pipeline Block.
* **Visual Direction:** SVG path directional arrows pointing between blocks indicating HTTP/REST payloads.

### 2. Slide Content

* **Client Interface (Next.js 14 + Zustand):**
* Maintains layout state, captures raw microphone input using browser MediaRecorder APIs, and hosts the visual staging confirmation gates.




* **Application Core Server (Node.js BFF + Prisma ORM):**
* Validates session context via NextAuth.js, mediates persistent data transactions with the Neon PostgreSQL layer, and targets strict JSON contracts.




* **AI Core Brain (Stateless Python FastAPI Microservice):**
* Processes audio binaries, verifies network payload criteria, and uses dynamic Pydantic tools to force strict structured compiler responses from LLM interactions.





### 3. Interactive Elements & Animations

* Clicking any of the three main architectural blocks expands it to full screen, dimming the remaining paths to isolate focus.

---

## Slide 5: Technical Stack Matrix

### 1. Visual Layout Blueprint

* **Layout:** 2x2 grid presentation detailing framework layers.
* **Styling:** Clean architectural tables with subtle emerald accent typography.

### 2. Slide Content

* **Layer 1: Frontend & State Core**
* Next.js 14 (App Router) + Tailwind CSS + Radix UI.


* Zustand Client State (Staging operations & UI flow buffers).


* Milkdown WYSIWYG Editor Core engine.




* **Layer 2: Backend Automation Microservice**
* FastAPI Asynchronous Web Engine (Python).


* Pydantic v2 Core Type Engine (Dynamic serialization generation mapping structures).


* LiteLLM Abstraction Model Route Wrapper Gateway.




* **Layer 3: Storage & Data Schema Integration**
* Neon Serverless Cloud PostgreSQL Database engine.


* Prisma Type-Safe ORM Client.


* PostgreSQL native JSONB field storage arrays for customizable schema extensions.




* **Layer 4: AI Model Infrastructure Services**
* Speech-to-Text: Deepgram Nova-2 API + Groq Whisper-large-v3 fallback path.


* Security Validation: Llama-3.1-8B context guard.


* Intent Reasoning NLU: Google Gemini 2.5 Flash + Groq Llama-3.3-70B backend.





### 3. Interactive Elements & Animations

* Hovering over a stack tier reveals a list of specific project directories or source files associated with that component (e.g., `useDeepgramSTT.ts` or `AI_MICROSERVICE_CONTRACT.md`).



---

## Slide 6: The 4-Stage AI Voice-to-Action Pipeline

### 1. Visual Layout Blueprint

* **Layout:** Horizontal sequence diagram detailing step actions.
* **Graphic Elements:** Distinct chevron-shaped milestone tabs showing linear processing states.

### 2. Slide Content

1. **Stage 1: Audio Validation**
* Captures user voice prompts via a Push-to-Talk module, ensures sizing criteria falls below the 10MB limit, and verifies MIME type validity.




2. **Stage 2: Speech-to-Text (STT)**
* Streams raw audio chunks into a Vietnamese-optimized Deepgram Nova-2 engine over high-speed WebSockets for millisecond-level transcript returns.




3. **Stage 3: Sentinel Security Layer**
* Wraps raw transcript data inside per-request randomized cryptographic UUID delimiters, querying a fast Llama-3.1 model to instantly block prompt injection vector attacks.




4. **Stage 4: Resolver Tool Calling (NLU)**
* Evaluates safe transcripts against current screen context via Gemini 2.5 Flash, assigning structured execution keys (`update_note`, `add_stack_row`) or switching to a conversational response panel.





### 3. Interactive Elements & Animations

* An animated laser line sweeps horizontally from Step 1 through Step 4, simulating an active runtime execution pass.

---

## Slide 7: Stacks & The Dynamic Schema Generation Engine

### 1. Visual Layout Blueprint

* **Layout:** 2-column view showcasing the technical solution for AI hallucinations.
* **Left Column:** A code syntax window illustrating runtime schema compilation.
* **Right Column:** A visual database dictionary layout mapping field schemas.

### 2. Slide Content

* 
**The Halting Problem:** Standard LLM JSON configurations frequently hallucinate data boundaries, outputting unmapped key combinations or mismatched column types under conversational strain.


* **The Core Engineering Solution:**
1. User explicitly defines customized spreadsheet column metrics inside a dynamic schema interface configuration (`TEXT`, `INT`, `BOOLEAN`, `DATE`).


2. During a voice transaction, the FastAPI backend intercepts column rules and compiles them into an on-the-fly **dynamic Pydantic runtime data structure model** using `create_model()`.


3. This model forces the downstream LLM instance to output perfectly typed JSON strings directly mirroring the user's data table schema layout.




* 
**Storage Architecture:** Data rows populate PostgreSQL dynamically as high-velocity JSONB fields, ensuring immediate column alterations generate no schema modification structural overhead.



### 3. Interactive Elements & Animations

* The left-column code editor displays an active animation showing a database layout morphing seamlessly into an enterprise Pydantic definition block.

---

## Slide 8: Safety & Sovereignty (The Suggestion Gate)

### 1. Visual Layout Blueprint

* **Layout:** Vertical split screen with interactive before/after visual examples.
* **Top Half:** Visual rendering of unstructured Markdown edit differences.
* **Bottom Half:** Visual rendering of database spreadsheet cell data mock additions.

### 2. Slide Content

* 
**Human-In-The-Loop Architecture:** The core AI engine operates strictly as an action proposer and is structurally barred from executing direct mutations or write passes inside the PostgreSQL core databases without explicit consent.


* **Staging Mechanism for Free-Form Notes:**
* AI modifications display directly inside a WYSIWYG space as **inline text comparison markings** (deletions appear highlighted in red blocks, insertions appear in green blocks).


* A floating modal bar demands user input confirmation ("Confirm" or "Discard") to commit changes or revert text.




* **Staging Mechanism for Structured Stacks:**
* New items append onto the bottom of tabular views rendered as translucent, yellow-highlighted **Ghost Rows**.


* Clicking "Accept" converts the mock node instantly into a durable PostgreSQL database row.





### 3. Interactive Elements & Animations

* Interactive UI buttons let you sample "Accepting" or "Discarding" data alterations, watching red/green differences merge into final document layouts in real time.

---

## Slide 9: Empirical System Testing & Performance Metrics

### 1. Visual Layout Blueprint

* **Layout:** Horizontal layout split into a statistical dashboard view on the left and a functional test validation summary list on the right.

### 2. Slide Content

* **Performance SLAs & Metrics:**
* 
**100%:** Total validation data type safety achieved across complex structured table operations.


* 
**< 400ms:** Average transcription return delay using real-time Deepgram Nova-2 WebSocket connections.


* 
**< 900ms:** Total processing duration for Gemini model natural language parsing actions.


* 
**≤ 4.0s:** Strict boundary constraint met for comprehensive round-trip voice command executions.




* 
Black-Box & White-Box Test Executions:


* 
`VOICE_003 / 004`: Core validation parameters successfully rejecting oversized file configurations (>10MB) or unmapped audio structures (`audio/ogg`).


* 
`VOICE_009`: Sentinel checks successfully detecting and blocking unmapped layout mutation targets.


* 
`NOTE_002 / 003`: Verifying real-time debounce autosaving operations (1,000ms latency triggers) alongside dynamic JSONB column rendering fields.





### 3. Interactive Elements & Animations

* Clicking a test code identification string slides open an internal log snippet view showing true HTTP status code 200 pass signatures.



---

## Slide 10: Implementation Status & Future Roadmap

### 1. Visual Layout Blueprint

* **Layout:** Two distinct data sections: a feature completion matrix using structured tables on the left, and a multi-phase linear roadmap vector timeline on the right.

### 2. Slide Content

* **Current Production Status Summary:**
* Overall Prototype Feature Completion at **90%**.


* User Authentication Core & Session Gate Layers: **Completed**.


* Unstructured Note System & Live Markdown Previews: **Completed**.


* Structured Schema Builders & Table Interactions: **Completed**.


* Asynchronous AI Microservices Core Contracts: **Completed**.




* 
The MVP Critical Gap Blockers:


* Final wiring of the resolved Voice Engine results directly to user frontend state systems.


* Comprehensive testing passes of the UI Confirmation Gate hooks during live write sequences.




* **Future Engineering Milestones (The Roadmap):**
* 
**Phase 1 (High Priority):** Deploy structural binaries directly onto AWS EC2 environments, configure secure environment parameter secret keys, and resolve editor state autosave race conditions.


* 
**Phase 2 (Medium Priority):** Complete core email registration wrappers and integrate custom math summaries directly over database tables.


* 
**Phase 3 (Low Priority):** Expand agent voice actions to handle interactive task tracking layouts and drag-and-drop calendar events.





### 3. Interactive Elements & Animations

* Pending blocker line items pulse with an amber alert highlight color to emphasize exactly where development focus stands at the conclusion of the capstone pass.