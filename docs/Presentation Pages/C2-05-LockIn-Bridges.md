# C2-05 — How Lock In Bridges the Gap

## The One Big Idea
Lock In automates the entire Information → Context → Knowledge pipeline. Capture thoughts by voice (3× faster than typing). AI automatically contextualizes using workspace awareness. Structured proposals appear for your approval. The full loop completes in under 4 seconds.

## Visual Concept
A clean three-step horizontal flow diagram spanning the slide. Three large circular nodes connected by arrows: Capture (microphone icon), Contextualize (brain/AI icon), Act (checkmark icon). Below each node, one line of explanation. Below the flow, a prominent metric strip: "≤ 4.0 seconds end-to-end." The flow is simple, bold, and immediately understandable.

## Content Elements

### Headline
From Thought to Action — In Under 4 Seconds

### Step 1 — CAPTURE
- **Icon**: Microphone
- **What happens**: Speak naturally — in Vietnamese or English. Voice is 3× faster than typing. Push-to-talk or continuous recording via the Records Workstation.
- **Technology**: Deepgram Nova-3 streams real-time transcription over WebSocket.

### Step 2 — CONTEXTUALIZE
- **Icon**: Brain / AI sparkle
- **What happens**: The ContextPacker resolves your active workspace — which note, which Stack, which columns, which task. The AI now knows exactly what you're working on.
- **Technology**: LangGraph orchestrates safety checks, complexity routing, and multi-expert analysis.

### Step 3 — ACT
- **Icon**: Checkmark / approve
- **What happens**: AI proposes structured changes — note text diffs, Stack ghost rows, new tasks, calendar events. You review and accept. Nothing commits without your approval.
- **Technology**: Zustand staging buffer → Prisma ORM → Neon PostgreSQL on confirmation.

### Metric Strip
**≤ 4.0 seconds** — full end-to-end latency, from speaking to seeing the proposal on screen.

## Interactive Notes
- Three nodes appear sequentially on slide entry
- Arrows animate to show flow direction
- The "≤ 4.0 seconds" metric pulses in emerald — the key performance claim

## Source Verification
- FACT-CHECK.md §5 — ≤ 4.0s end-to-end latency, Nova-3 STT, Gemini 2.5 Flash NLU
- Technology Review.md — ContextPacker, LangGraph orchestration, human-in-the-loop gate
- ThesisFrontMatter.md — verified SLA metrics
