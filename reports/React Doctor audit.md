# 🔬 React Doctor — Comprehensive Project Audit Report

**Date:** 2026-06-14  
**Tool:** `npx react-doctor@latest . --yes --json` (v0.5.4)  
**Scan Mode:** Full codebase (104 files scanned)

---

## 📊 Overall Score & Summary

| Metric | Value |
|---|---|
| **Overall Score** | **34 / 100 (`Critical`)** |
| Total Diagnostics | 318 |
| Errors (blocking) | 5 |
| Warnings | 313 |
| Affected Files | 60 |
| Scan Duration | ~70 seconds |

> **Verdict:** The project has a **critical** level of technical debt. While the application architecture is sound (Next.js 14 + Zustand + Prisma + Deepgram), the codebase suffers from widespread anti-patterns across security, state management, performance, accessibility, and maintainability. Immediate attention is needed on the 5 blocking errors (security & CSRF), followed by a systematic cleanup of the 313 warnings.

---

## 🔴 CRITICAL / ERROR Severity (5 issues — must fix)

### 1. 🔒 CSRF Vulnerability — Side Effect in GET Handler
**File:** `app/api/deepgram/token/route.ts` (line 15)  
**Rule:** `nextjs-no-side-effect-in-get-handler`  
**Severity:** ❌ ERROR

The `GET` handler makes a downstream `POST` request to Deepgram's API to mint temporary keys. GET requests are safe & idempotent by HTTP spec — browsers may prefetch or replay them, making this vulnerable to CSRF attacks. A malicious site could trigger key minting on behalf of an authenticated user.

**Fix:** Move the `POST fetch(...)` side effect to a dedicated `POST` handler and call it from the client with a CSRF token.

### 2. 🔒 Stale Server Fetch — No Cache Revalidation (x2)
**File:** `app/api/deepgram/token/route.ts` (lines 31, 61)  
**Rule:** `server-fetch-without-revalidate`  
**Severity:** ⚠️ WARNING → treated as blocking due to security context

Two `fetch()` calls to `https://api.deepgram.com/v1/projects/...` are cached **forever** by default in Next.js 14. This means tokens and project data can become stale, silently breaking STT functionality.

**Fix:** Add `{ next: { revalidate: 30 } }` or `{ cache: "no-store" }` to both fetch calls.

### 3. 🔒 Stale Server Fetch — No Cache Revalidation
**File:** `app/api/records/automate/route.ts` (line 71)  
**Rule:** `server-fetch-without-revalidate`

Same issue — fetch to an automation endpoint is permanently cached.

### 4. 🔒 Credentials in Version Control
**File:** `.env` (line 31)  
**Severity:** ❌ CRITICAL (from prior audit)

Hardcoded AWS credentials (`STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`) and Deepgram API key are stored in the **tracked** `.env` file. This is a serious security incident — anyone with repository access can read these secrets.

**Fix:** Rotate all exposed credentials immediately. Add `.env` to `.gitignore`. Use `.env.example` with placeholder values for documentation.

### 5. 🔒 Vulnerable Next.js Version
**File:** `package.json`  
**Severity:** ❌ CRITICAL (from prior audit)

Next.js 14.2.35 is **unpatched** for known React Server Components (RSC) security advisories. Upgrade to **15.5.18+** or **16.2.6+**.

---

## 🟠 BUGS & ANTI-PATTERNS

### Prop/Derived State via useEffect (Stale UI)
| File | Line | Issue |
|---|---|---|
| `components/workspace/StackTable.tsx` | 114, 123 | `isDirty` and `columnWidths` adjusted in `useEffect` → extra render cycle with stale values |
| `app/(workspace)/workspace/notes/[id]/page.tsx` | 24–26 | `content` prop mirrored into `text` state via effect → editor flashes stale content |

**Root cause:** Props are being synced into local state through `useEffect`, which always runs **after** render. Users see the old value briefly before the effect corrects it.

### Prop Used as useState Initializer (Ignores Updates)
| File | Line | Issue |
|---|---|---|
| `components/workspace/StackTable.tsx` | 74–75 | `useState(content)` — ignores future prop changes |
| `app/(workspace)/workspace/notes/[id]/page.tsx` | 20 | Same pattern |

**Root cause:** `useState(initialValue)` only reads the prop on first render. If the parent passes a new value, it's silently ignored.

### Component Defined Inside Another Component
**File:** `components/workspace/CaptureQueue.tsx` (line 241)  
`StatusBadge` is defined **inside** `CaptureQueue`. React recreates it on every parent render, resetting its internal state and breaking memoization.

### Missing Effect Dependencies
| File | Line | Missing Dep |
|---|---|---|
| `components/workspace/BackgroundRecorder.tsx` | 136 | `startMicOnlyRecording` — stale closure bug |
| `components/workspace/WaveformVisualizer.tsx` | 59 | Variables from outer scope |
| `lib/hooks/useContinuousSTT.ts` | 301 | Variables from outer scope |

**Risk:** Stale closures cause handlers to operate on outdated state, leading to silent data corruption or incorrect behavior.

### Buttons Missing Explicit `type` Attribute
**Files:** `app/(marketing)/page.tsx` (10 occurrences), `app/(workspace)/workspace/page.tsx` (2 occurrences)  

`<button>` without `type` defaults to `type="submit"`, which can accidentally submit parent forms.

### Too Many `useState` Calls — 7 in One Component
**File:** `components/auth/RegisterForm.tsx` (line 14)  
7 separate `useState` calls each trigger independent re-renders. Group related form state with `useReducer`.

---

## ⚡ PERFORMANCE ISSUES

### `await` in Loops (Serialized I/O)
| File | Lines | Impact |
|---|---|---|
| `app/api/stacks/[id]/route.ts` | 107, 117 | Sequential DB/API calls block each other |
| `lib/context/packer.ts` | 100, 194 | Context packing runs serially despite independent operations |

**Fix:** Use `await Promise.all(items.map(...))` for independent async work.

### `array.find()` Inside Loops (O(n·m) → O(n+m))
| File | Lines |
|---|---|
| `lib/context/packer.ts` | 97, 142, 158 |

Building a `Map` before the loop reduces lookup from O(n) to O(1).

### Expensive Ref Initializers Evaluated Every Render
| File | Line | Issue |
|---|---|---|
| `components/workspace/WaveformVisualizer.tsx` | 40 | `useRef(new Uint8Array(...))` — recreated each render |
| `lib/hooks/useContinuousSTT.ts` | 63 | `useRef(new Set())` — same issue |

**Fix:** Lazy-initialize: `useRef<Uint8Array | null>(null)` and check before use.

### State Set But Never Rendered (Wasted Re-renders)
**File:** `app/(marketing)/page.tsx` (lines 15, 17)  
`currentWordIndex` and `isDeleting` are set via `useState` but never displayed on screen. Use `useRef` instead.

### Static Values Rebuilt Every Render
| File | Line |
|---|---|
| `components/workspace/CaptureQueue.tsx` | 242 |
| `components/workspace/AgenticAutomatePanel.tsx` | 159 |
| `components/shared/PushToTalk.tsx` | 206 |

Static config objects/lookups defined inside component body are recreated on every render, invalidating child memoization. Move them **outside** the component or wrap in `useMemo`.

---

## ♿ ACCESSIBILITY ISSUES

### Low Contrast Text
**File:** `components/workspace/CaptureQueue.tsx` (lines 312, 328)  
`text-zinc-500` on `bg-red-500` — insufficient contrast for visually impaired users. Needs at least 4.5:1 ratio.

### Labels Missing `htmlFor` / Control Association
| File | Lines |
|---|---|
| `components/workspace/SchemaBuilder.tsx` | 174 |
| `components/workspace/CaptureQueue.tsx` | 303 |
| `components/auth/RegisterForm.tsx` | 96, 113, 130, 147 |

Screen readers cannot associate labels with their inputs without `htmlFor` or nesting.

### Click Handlers Missing Keyboard Handlers
**File:** `components/workspace/TabBar.tsx` (line 90)  
`onClick` without `onKeyUp`/`onKeyDown` excludes keyboard-only users.

### Interactive Static Elements Missing `role`
**File:** `components/workspace/TabBar.tsx` (line 90)  
A `<div>` with `onClick` but no `role="button"` — screen readers don't announce it as interactive.

---

## 🛠️ MAINTAINABILITY ISSUES

### Circular Import Dependencies (10 slices!)
| Slice File | Cycle With |
|---|---|
| `aiSlice.ts`, `calendarSlice.ts`, `foldersSlice.ts`, `notesSlice.ts`, `pendingMutationSlice.ts`, `recordsSlice.ts`, `stacksSlice.ts`, `tasksSlice.ts`, `uiSlice.ts`, `voiceSlice.ts` | `lib/store.ts` |

**Pattern:** Every Zustand slice imports `RootStore` from `lib/store.ts`, and `lib/store.ts` imports back from every slice to compose the store. This creates a circular dependency graph that can cause order-of-initialization bugs.

**Fix:** Move `RootStore` type to a separate `lib/storeTypes.ts` that both files import.

### Unused Files (Dead Code — 7 files)
| File | Notes |
|---|---|
| `components/workspace/Canvas.tsx` | Unused component |
| `components/workspace/DynamicLayout.tsx` | Unused component |
| `components/workspace/StackAggregates.tsx` | Unused component |
| `lib/context/commandDetector.ts` | Unreachable from any entry point |
| `lib/voiceApi.ts` | Unreachable |
| `public/worklets/pcm-processor.js` | Unreachable |
| `store/useStore.ts` | Unreachable |

These files add maintenance surface without shipping any code. Either wire them up or remove them.

### Unused Exports (18 exports across 8 files)
| File | Unused Exports |
|---|---|
| `app/auth.ts` | `signIn`, `signOut` |
| `components/shared/BrandAssets.tsx` | `Submark`, `Favicon` |
| `components/workspace/WaveformVisualizer.tsx` | `useWaveformAnalyser` |
| `lib/context/dataFormatter.ts` | `formatStackAsCSV`, `formatStackAsMarkdown`, `formatTasksAsCSV`, `formatTasksAsMarkdown`, `formatEventsAsCSV` |
| `lib/context/packer.ts` | `legacyContextToPacked` |
| `lib/httpClient.ts` | `sessionFetch` |
| `lib/session.ts` | `resetSessionId` |
| `lib/storage.ts` | `getUploadUrl`, `getFileMetadata` |
| `lib/voice/contextHelpers.ts` | `resolveTabIds` |
| `types/voice.ts` | `hasUpdatedData`, `hasAiReply` |

### Unused Dependencies (8 packages)
| Package | Notes |
|---|---|
| `@milkdown/components`, `@milkdown/ctx`, `@milkdown/theme-nord` | Milkdown editor libraries — not imported anywhere |
| `@radix-ui/react-popover` | Not imported |
| `openai` | OpenAI SDK unused |
| `prosemirror-view` | ProseMirror not imported directly |
| `reactflow` | Flow chart library not imported |
| `recharts` | Charting library not imported |

**Impact:** 8 unused packages bloat `node_modules`, slow installs, and increase supply-chain attack surface.

---

## 📋 FIX PRIORITY MATRIX

| Priority | Category | # Issues | Effort | Risk if Ignored |
|---|---|---|---|---|
| 🔴 **P0 — Immediate** | Security (CSRF, credentials, Next.js vuln) | 5 | 1–2 days | Data breach, account takeover |
| 🟠 **P1 — This Sprint** | Bugs (stale effects, missing deps) | ~15 | 2–3 days | Broken UX, silent data loss |
| 🟡 **P2 — Next Sprint** | Performance (loops, refs, wasted renders) | ~12 | 2–3 days | Degraded UX at scale |
| 🟢 **P3 — Backlog** | Accessibility (labels, contrast, keyboard) | ~10 | 1–2 days | Exclusion of disabled users |
| 🔵 **P4 — Cleanup** | Maintainability (dead code, circular deps, unused deps) | ~40 | 3–5 days | Growing technical debt |

---

## 📈 PROJECT HEALTH ASSESSMENT

### ✅ Strengths
- **Sound architecture:** Next.js 14 App Router + Zustand slices + Prisma ORM is a well-chosen stack
- **Good separation of concerns:** API routes, lib utilities, components are well-organized
- **Modern tooling:** TypeScript, Tailwind CSS, react-hook-form, zod validation
- **Agentic AI integration:** Novel use of Deepgram STT + context-aware LLM interactions
- **TypeScript compiles cleanly:** `npx tsc --noEmit` passes without errors

### ❌ Weaknesses
- **Security negligence:** Credentials in source control and a CSRF-vulnerable endpoint are show-stoppers
- **React anti-patterns pervasive:** Props-in-state, missing effect deps, components-inside-components are scattered across the codebase
- **Performance debt:** Serialized async loops, repeated `array.find()` calls, and wasteful re-renders will compound as data grows
- **Dead code sprawl:** 7 unreachable files and 18 unused exports create confusion and maintenance drag
- **Dependency bloat:** 8 unused npm packages add unnecessary supply-chain risk
- **No accessibility strategy:** Missing labels, poor contrast, and keyboard-inaccessible controls exclude users

### 🔮 Recommendations
1. **Rotate all exposed secrets immediately** and set up `.env` in `.gitignore`
2. **Upgrade Next.js** to 15.5.18+ to patch RSC vulnerabilities
3. **Fix the CSRF vulnerability** by converting the Deepgram token endpoint to POST
4. **Audit all `useEffect` usage** — most prop-to-state syncs should use derived values or `useMemo`
5. **Extract `RootStore` type** to break the 10-file circular dependency graph
6. **Run `depcheck` or `knip`** to validate unused dependencies before removing them
7. **Add `eslint-plugin-jsx-a11y`** and `@next/eslint-plugin-next` to catch regressions early
8. **Consider React Compiler (React 19)** for automatic memoization of static values

---

*Report generated by combining a prior `react-doctor` diagnostic scan with a fresh `npx react-doctor@latest . --yes --json` run (v0.5.4, scan date 2026-06-14).*