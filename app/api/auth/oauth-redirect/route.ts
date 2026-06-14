/**
 * DISABLED — This route collides with NextAuth's [...nextauth] catch-all.
 *
 * The OAuth flow now uses a reliable client-side pattern in the landing page:
 *   1. signOut({ callbackUrl: "/?oauth=google" }) — full page nav, cookie cleared
 *   2. Landing page detects ?oauth=google → calls signIn("google")
 *
 * See app/(marketing)/page.tsx for the implementation.
 */
import { NextResponse } from "next/server";

export async function GET() {
  // Fallback: redirect home — the new flow doesn't use this route anymore
  return NextResponse.redirect(new URL("/", process.env.AUTH_URL || "http://localhost:3000"));
}
