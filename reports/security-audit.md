# Security Audit Report

**Date:** 2026-05-23  
**Scope:** Full codebase audit (Next.js 14, TypeScript, Prisma, NextAuth v5)  
**Severity Key:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## 🔴 CRITICAL

### C-1: Live secrets exposed in `.env` file on disk

**File:** `.env` (not git-tracked, but present on filesystem)

Live production/development credentials are stored in plaintext in `.env`:

| Secret | Value (redacted) |
|--------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string with password |
| `DIRECT_URL` | Direct DB connection with password |
| `AUTH_SECRET` | Hardcoded hex string |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth client secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `OPENAI_API_KEY` | `sk-or-v1-*` API key |
| `DEEPGRAM_API_KEY` | Deepgram API key |
| `webstorm` | Another `sk-or-v1-*` API key |

**Risk:** Anyone with filesystem access (malicious insider, compromised dev machine, CI breach) can exfiltrate these credentials. The database URL grants direct PostgreSQL access. The OAuth secrets allow token forgery. The AI API keys can be used for billing abuse.

**Fix:** Rotate all credentials immediately. Never store secrets in plaintext. Use a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager) or at minimum encrypt the `.env` file.

---

### C-2: API routes lack CSRF protection

**Files:** All routes under `app/api/*/route.ts`  
**Affected:** Every POST/PUT/DELETE endpoint

All mutations rely solely on the `Session` cookie for authentication (via `auth()`). No CSRF tokens, `Origin`/`Referer` header validation, or `SameSite` cookie enforcement is implemented.

**Risk:** Any external website that a logged-in user visits can issue authenticated cross-origin requests. The NextAuth session cookie does not appear to be explicitly configured with `SameSite=Strict` or `SameSite=Lax` (default is `Lax`, which still allows top-level navigation CSRF).

**Fix:** Add CSRF token validation, enforce `SameSite=Strict` on session cookies, and validate `Origin` headers on state-changing requests.

---

### C-3: No rate limiting on any endpoint

**Files:** All `app/api/*/route.ts` files

Every API route (notes, tasks, events, stacks, deepgram token, voice process) has zero rate limiting.

**Risk:** An attacker can:
- Mass-create notes/tasks/events (resource exhaustion, database storage DoS)
- Repeatedly hit `/api/deepgram/token` to mint Deepgram API keys (billing abuse)
- Brute-force endpoints without restriction

**Fix:** Implement rate limiting (e.g., Vercel KV rate limits, `express-rate-limit`-style middleware, or edge middleware).

---

## 🟠 HIGH

### H-1: `NEXT_PUBLIC_OPENAI_API_KEY` naming in `.env.local.example`

**File:** `.env.local.example:16`

```env
NEXT_PUBLIC_OPENAI_API_KEY="sk-"
```

The `NEXT_PUBLIC_` prefix in Next.js exposes environment variables to client-side JavaScript bundles. While the example shows `sk-` (placeholder), this naming convention strongly suggests a developer might populate it with a real key, at which point **the OpenAI API key would be visible in every browser that loads the site**.

**Risk:** If populated with a real key, the OpenAI API key is trivially extractable from the browser's DevTools → Sources or Network tab, enabling billing abuse.

**Fix:** Remove the `NEXT_PUBLIC_OPENAI_API_KEY` entry entirely. The OpenAI API should only be called from server-side API routes using `OPENAI_API_KEY` (without the `NEXT_PUBLIC_` prefix). Currently the codebase only uses OpenAI through server-side API routes, so this key variable appears unused — remove it to prevent future misuse.

---

### H-2: Stacks PUT endpoint uses unsafe type assertions instead of validation

**File:** `app/api/stacks/[id]/route.ts:72-80`

```typescript
const { name, columns, rows } = body as {
  name?: string;
  columns?: Array<{ id?: string; name: string; type: "TEXT" | "INT" | "FLOAT" | "BOOLEAN" }>;
  rows?: Array<{ id?: string; data: Record<string, any> }>;
};
```

The request body is cast with `as` without Zod validation (unlike the POST handler which uses `schema.safeParse`). The `rows.data` field is typed as `Record<string, any>`, accepting arbitrary JSON without any structural validation.

**Risk:** Arbitrary data can be stored in the `StackRow.data` JSONB column. If the FastAPI or other services read this data unsafely, it could lead to injection attacks.

**Fix:** Add Zod schema validation mirroring the POST handler's approach. Validate row data structure against the stack's column definitions.

---

### H-3: No Content-Security-Policy or security headers

**File:** `next.config.js`

The Next.js config sets `reactStrictMode: true` but does not configure any security headers (CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, etc.).

**Fix:** Add security headers via `next.config.js`:

```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]
  }];
}
```

---

### H-4: Stack row schemas accept `z.any()` with zero validation

**Files:**
- `app/api/stacks/[id]/rows/route.ts:26` — `z.object({ data: z.record(z.any()) })`
- `app/api/stacks/[id]/rows/[rowId]/route.ts:34` — `z.object({ data: z.record(z.any()) })`

The `z.any()` validator accepts any JavaScript value (including nested objects, functions, dates, etc.) without any structural enforcement.

**Risk:** Storing unpredictable data in JSONB can lead to deserialization issues in downstream consumers. If the FastAPI microservice or other clients parse this data unsafely, it could cause crashes or injection vulnerabilities.

**Fix:** Validate data against the stack's defined column schema (types, required fields). At minimum, restrict to `z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))`.

---

## 🟡 MEDIUM

### M-1: No request body size limits

Most API routes accept request bodies without any size restrictions. While Zod validates string lengths in some endpoints:
- Tasks: `title` max 500, `description` max 10000
- Notes: `title` validated as `string` but no max length
- Events: `title` max 500, `notes` max 10000
- Stack PUT: name is trimmed but no length validation
- Voice process: audio limited to 10MB

**Risk:** A user could upload extremely large payloads to endpoints without length limits, causing memory exhaustion.

**Fix:** Add consistent max-length validation across all string inputs. Add a global body size middleware.

---

### M-2: Verbose error responses reveal validation schema details

**Files:** Multiple API routes including:
- `app/api/notes/[id]/route.ts:64` — `result.error.flatten()`
- `app/api/stacks/route.ts:55` — `result.error.flatten()`

Zod's `flatten()` method returns structured details about validation failures, revealing the expected field types and constraints to the client.

**Risk:** While intentional for debugging, this information helps attackers understand the API's validation surface and craft bypass attempts.

**Fix:** Return only a generic validation error message in production. Use `NODE_ENV` to conditionally include details.

---

### M-3: Voice proxy forwards arbitrary form data to internal FastAPI service

**File:** `app/api/voice/process/route.ts:44-66`

The BFF proxy forwards `contextType`, `contextId`, `note_state`, `dynamic_schema`, and `task_context` fields directly to the internal FastAPI service without sanitization.

**Risk:** If the FastAPI service trusts these inputs implicitly, an attacker could inject malicious data through the voice processing pipeline. Fields like `dynamic_schema` are raw JSON strings that get parsed downstream.

**Fix:** Validate the shape of each field before forwarding. Reject unexpected or excessively large context payloads.

---

### M-4: No audit logging for destructive operations

There is no logging infrastructure for tracking who performed DELETE or UPDATE operations across the system.

**Risk:** In the event of data loss or unauthorized access, there is no audit trail to determine the source, scope, or responsible party.

**Fix:** Add structured audit logging for all mutation operations, recording `userId`, `action`, `resourceType`, `resourceId`, and `timestamp`.

---

### M-5: Session cookie security flags not explicitly configured

**File:** `app/auth.ts`

The NextAuth configuration does not explicitly set cookie security options:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub, Google],
  callbacks: { ... }
});
```

**Risk:** Without explicit `SameSite`, `Secure`, and `HttpOnly` flags, the session cookie relies on NextAuth defaults. In production, absence of `Secure` flag means cookies can be transmitted over unencrypted HTTP.

**Fix:** Add explicit cookie configuration:

```typescript
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    }
  }
}
```

---

### M-6: Insecure `Math.random()` for temporary IDs

**Files:**
- `lib/slices/notesSlice.ts:40` — `Math.random().toString(16).slice(2)`
- `lib/slices/stacksSlice.ts:53` — `Math.random().toString(16).slice(2)`
- `lib/slices/tasksSlice.ts:42` — `Math.random().toString(16).slice(2)`
- `lib/slices/calendarSlice.ts:26` — `Math.random().toString(16).slice(2)`

Temporary/optimistic IDs are generated using `Math.random()`, which is not cryptographically secure.

**Risk:** These IDs are used temporarily client-side and replaced by server-generated UUIDs, so the practical risk is low. However, if any were relied upon for authorization decisions before replacement, collisions could be exploited.

**Fix:** Use `crypto.randomUUID()` instead, which is available in modern browsers and Node.js.

---

## 🔵 LOW

### L-1: `params.id` not validated as UUID before Prisma queries

Many endpoints use `params.id` directly in Prisma `findUnique` without validating it's a valid UUID. Prisma returns `null` for invalid UUIDs (and the ownership check handles it), but the error path provides no distinction between "not found" and "invalid ID".

**Fix:** Add a Zod schema to validate UUID format for all path parameters, returning 400 for invalid IDs.

---

### L-2: `where: any` type bypasses type safety in events GET

**File:** `app/api/events/route.ts:26`

```typescript
const where: any = { userId: session.user.id };
```

Using `any` disables TypeScript's compile-time checks for the Prisma query filter.

**Fix:** Use proper Prisma typing: `Prisma.CalendarEventWhereInput`.

---

### L-3: Error details logged server-side may contain sensitive data

Multiple API routes log errors with `console.error` including the error object which may contain stack traces, query parameters, or request body snippets.

**Risk:** In production, these logs could contain PII or secrets if a request includes them in unexpected fields.

**Fix:** Implement a structured logging solution that sanitizes sensitive fields before output.

---

### L-4: ReactMarkdown renders AI-generated content without sanitization

**File:** `components/workspace/AISidebar.tsx:38`

```tsx
<ReactMarkdown>{aiReply}</ReactMarkdown>
```

AI-generated markdown content is rendered directly. While `react-markdown` does not render raw HTML by default, it can render links (`[text](url)`) and images that could be used for phishing or tracking.

**Fix:** Add `rehype-sanitize` plugin to `ReactMarkdown` to strip unsafe content, or set `allowedElements` and `unwrapDisallowed` props.

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 4 |
| 🟡 Medium | 6 |
| 🔵 Low | 4 |
| **Total** | **17** |

### Top Priority Actions
1. Rotate all compromised credentials (C-1)
2. Implement CSRF protection (C-2)
3. Add rate limiting to all endpoints (C-3)
4. Remove `NEXT_PUBLIC_OPENAI_API_KEY` from `.env.local.example` (H-1)
5. Validate stack PUT body with Zod (H-2)
6. Add security headers (H-3)
