# Tasks & Calendar Contracts Cross-Check Report

## Overview
This report compares two technical design contracts for implementing Tasks and Calendar features against the current codebase, evaluating their alignment, pros, cons, and potential issues.

---

## 1. Contracts Comparison

### Contract A: `Contract_ Tasks & Calendar.md`
- Simpler approach overall
- Monolithic store refactor into slices: notes, stacks, voice, ui, tasks, calendar
- Tasks: flat list + client-side tree building
- Calendar: `react-big-calendar` with lazy loading
- No auth integration mentioned explicitly
- No optimistic update pattern defined
- No Zod validation

### Contract B: `TDC-Tasks-Calendar-v1.md`
- More detailed and structured
- Phase-based implementation (A-J)
- Includes auth integration (next-auth) with proper session checks
- Defines strict optimistic update pattern with snapshot/rollback
- Uses Zod validation for API and forms
- Tasks: lazy loading children with `taskChildrenMap` and `loadedParents`
- Calendar: dark theme overrides included
- Includes singleton tab constants and proper TabBar/Sidebar integration
- Aligns with existing store patterns (optimistic updates, toast notifications, etc.)

---

## 2. Codebase Alignment Check

### Current State:
- Prisma schema has User, Note, Stack models
- Store: monolithic Zustand store at `lib/store.ts`
- Re-exports from `store/useStore.ts`
- Sidebar/TabBar use `useWorkspaceStore`
- Uses next-auth, react-hook-form, Zod, lucide-react, react-hot-toast
- Existing optimistic update patterns for notes/stacks

### Which Contract Aligns Better?
**Contract B (`TDC-Tasks-Calendar-v1.md`) aligns far better with the existing codebase.**

---

## 3. Pros & Cons of Each Contract

### Contract A (`Contract_ Tasks & Calendar.md`)
- **Pros**:
  - Simpler to understand
  - Faster to implement
- **Cons**:
  - No auth integration (would break existing auth flow)
  - No optimistic update pattern (inconsistent with existing code)
  - No Zod validation (risk of invalid data)
  - Flat task loading could be slow with many tasks
  - Store slice structure doesn't include aiSlice (present in current code)
  - Uses `cuid()` instead of `uuid()` (inconsistent with existing models)
  - No snapshot rollback on API failure

### Contract B (`TDC-Tasks-Calendar-v1.md`)
- **Pros**:
  - Full auth integration (matches existing API routes pattern)
  - Strict optimistic update pattern with snapshot/rollback (matches existing store)
  - Zod validation for API and forms
  - Lazy loading tasks children for better performance
  - Dark theme CSS overrides for calendar
  - Includes aiSlice in store refactor
  - Uses `uuid()` (consistent with existing models)
  - Proper singleton tab handling
  - Detailed phase-based implementation plan
- **Cons**:
  - More complex
  - Longer implementation time

---

## 4. Potential Issues & Improvements

### Issues with Contract A:
1. **Missing Auth**: Would need to add next-auth checks to all new API routes
2. **Store Inconsistency**: Doesn't account for existing aiSlice
3. **No Validation**: Risk of invalid data being stored
4. **No Snapshot Rollback**: Bad UX if API calls fail

### Issues with Contract B:
1. **Complexity**: More files to modify
2. **Phase Locking**: Strict phase order could slow down development if phases are blocked

### Improvements for Either:
- Add proper error handling
- Ensure TypeScript types are consistent
- Test edge cases (deep task hierarchies, large calendar ranges)

---

## 5. Final Verdict

### **Recommendation: Use Contract B (`TDC-Tasks-Calendar-v1.md`)**

**Why?**
- Perfectly aligns with existing codebase patterns (optimistic updates, auth, Zod, etc.)
- More maintainable in the long run
- Better user experience with snapshot rollback
- Proper performance considerations (lazy loading)
- Dark theme ready
- Detailed implementation plan reduces ambiguity

Contract A is too simplistic and would require significant retrofitting to match the existing codebase's standards and patterns.
