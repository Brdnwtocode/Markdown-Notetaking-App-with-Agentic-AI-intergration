# SLIDE-DESIGN-SPEC.md — Business-Style Design System

> **Purpose**: Design rules for the HTML coder implementing these slides. Every slide adheres to these constraints.

---

## 1. Design Philosophy

**Business-style presentation = Big ideas, big visuals, minimal text.**

This is a capstone defense — the audience should listen to the presenter, not read slides. Each slide makes ONE point. The visual carries the weight; text only supports.

**"Less fluff" principle**: Every pixel must earn its place. If an element doesn't advance the narrative, remove it.

---

## 2. Typography Scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| **Hero Headline** | `text-5xl` to `text-7xl` | `font-black` | Slide 1 title only |
| **Slide Title** | `text-3xl` to `text-4xl` | `font-bold` | Main headline on every slide |
| **Big Number** | `text-6xl` to `text-8xl` | `font-black` | Metric displays (97%, 3×, 100%, ≤4.0s) |
| **Supporting Text** | `text-lg` to `text-xl` | `font-normal` | 2-3 lines max per slide, below the headline |
| **Label / Caption** | `text-sm` | `font-medium` / `uppercase tracking-wider` | Card labels, axis labels, source citations |
| **NEVER USE** | `< text-sm` | — | If it needs to be smaller, cut the content |

**Font family**: System sans-serif stack. Monospace reserved for the top indicator bar only (not slide content).

---

## 3. Color System

| Token | Hex | Usage |
|---|---|---|
| `bg-root` | `#050505` | Page background |
| `bg-surface` | `#0A0A0A` | Card, panel, and container backgrounds |
| `bg-elevated` | `#0E0E0E` | Slide canvas background |
| `border-default` | `neutral-800` | All borders and dividers |
| `border-hover` | `neutral-600` | Hover state borders |
| `accent-primary` | `#10B981` (emerald) | **The only accent color**. Used for: key words in headlines, big numbers, active indicators, primary buttons |
| `accent-subtle` | `#10B981` at 15% opacity | Accent backgrounds (cards, badges) |
| `text-primary` | `white` | Headlines, big numbers, key statements |
| `text-body` | `neutral-300` | Supporting text |
| `text-muted` | `neutral-500` | Labels, captions, secondary info |
| `text-dim` | `neutral-600` | Tertiary info, disabled states |
| `semantic-warning` | `amber-500` | Ghost rows, pending states |
| `semantic-danger` | `rose-500` | Problem indicators, blocked states |

---

## 4. Layout Rules

### Slide Canvas
- Full viewport height (`h-screen`) or flex-1 within the app shell
- Max content width: `max-w-5xl` for text-heavy slides, full width for visual-heavy slides
- Padding: `p-8 md:p-12` minimum
- Grid overlay background: optional, subtle (`opacity-5` to `opacity-10`)

### Content Distribution
- **Text occupies ≤ 30% of slide area** — the visual dominates
- Headline at top or center, never buried
- Supporting text directly below headline, never more than 3 lines
- Visual element centered and prominent

### Spacing
- Generous white space around all elements
- Gap between cards: `gap-6` to `gap-8`
- Section padding within slides: `space-y-6` to `space-y-10`

---

## 5. Visual Element Types (ordered by preference)

1. **Big Number** — `97%`, `3×`, `100%`, `≤ 4.0s` — the most impactful business visual
2. **Conceptual Illustration** — flow diagram, funnel, timeline, hub-and-spoke, lock-and-key metaphor
3. **Icon Cluster** — 3–5 Lucide icons with single-word labels, arranged in a row or grid
4. **Comparison Layout** — 2–3 side-by-side cards showing contrast (before/after, with/without, competitor A/B)
5. **Persona Card** — user icon + name + pain statement + desired outcome
6. **Metric Dashboard** — 3–4 big numbers in a clean grid

**Forbidden**: Code blocks, dense data tables (>4 rows), bullet lists with >3 items, screenshots of the actual app UI, text walls

---

## 6. Slide Structure Template

Every slide file follows this internal structure:

```markdown
# [SLIDE-ID] — [Slide Title]

## The One Big Idea
[1 sentence — if the audience reads nothing else, they get this]

## Visual Concept
[Description of the dominant visual — illustration type, diagram structure, metaphor]

## Content Elements

### Headline
[Main title text — large, bold, tells the story]

### Supporting Lines (max 3)
1. [First supporting point]
2. [Second supporting point — optional]
3. [Third supporting point — optional]

### Visual Specification
[Detailed description of what the illustration/diagram/big-number layout looks like]

## Interactive Notes
[Any animation, transition, or interactive behavior]
```

---

## 7. Interaction & Animation Rules

- **Fade-in only** — no slide transitions, no bouncing, no spinning (except the title badge sparkle)
- **Number counters allowed** — 0→97, 1→3 on the Problem slide — subtle and purposeful
- **Hover states**: border changes from `neutral-800` to `#10B981`, subtle scale-up (`hover:scale-[1.02]`)
- **No click-to-expand** in business style — the slide should work without interaction
- **Autoplay**: 7 seconds per slide (preserved from current implementation)

---

## 8. Slide Canvas Chrome (preserved from current)

Each slide is rendered inside a chrome frame:
- **Top bar**: Green dot + "MD. CAPSTONE SLIDE DECK VIEW" + slide counter (X/18)
- **Grid overlay**: Subtle background pattern on the slide canvas
- **Bottom controls**: Play/Pause, progress bar, Previous/Next arrows, quick-jump grid
- **Left sidebar**: Slide pool browser (search, add/remove slides, drag-to-reorder)
- **Presentation mode**: Fullscreen toggle that hides sidebars with hover-to-reveal

---

## 9. Quick Reference: Slide Visual Types

| Slides | Visual Type |
|---|---|
| C1-01 | Big centered typography + metadata grid |
| C1-02 | Three big icon cards + animated number counters |
| C1-03 | Hero illustration — unified workspace concept |
| C1-04 | Three-column comparison cards |
| C1-05 | Three persona hero cards |
| C2-01 | Timeline illustration (5 evolutionary stages) |
| C2-02 | Bell curve chart (3 zones) |
| C2-03 | Side-by-side comparison (without context vs with context) |
| C2-04 | Funnel diagram (Information → Context → Knowledge) |
| C2-05 | Three-step flow (Capture → Contextualize → Act) |
| C3-01 | Hub-and-spoke diagram (5 modules + AI layer) |
| C3-02 | Before/After workflow illustration |
| C3-03 | Before/After workflow illustration |
| C3-04 | Before/After workflow illustration |
| C3-05 | Matrix grid (features × scenarios) |
| C4-01 | Five icon cards in a row |
| C4-02 | Three large distinguishing cards |
| C4-03 | Four big-number metric cards + test result strip |
| C4-04 | Split layout: achievements (left) + roadmap (right) |
