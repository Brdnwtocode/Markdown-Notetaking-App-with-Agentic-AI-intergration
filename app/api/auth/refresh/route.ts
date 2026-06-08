// app/api/auth/refresh/route.ts
//
// POST /api/auth/refresh
// Refresh token rotation endpoint.
//
// Accepts { refreshToken: string }
// Validates the token against the DB, rotates it (revokes old, issues new),
// and returns a fresh JWT session cookie + new refresh token.
//
// Refresh tokens expire after 3 days. Each token can only be used once
// (rotation — the old token is revoked on use).

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { encode } from "@auth/core/jwt";
import crypto from "crypto";

const REFRESH_TOKEN_DAYS = 3;

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.refreshToken as string | undefined;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    // ── Look up token in DB ─────────────────────────────────────────────
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!stored) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // ── Validate expiry & revocation ────────────────────────────────────
    if (stored.revokedAt) {
      // Token reuse detected — revoke ALL user tokens (breach mitigation)
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Token has been revoked. Please sign in again." },
        { status: 401 }
      );
    }

    if (new Date(stored.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Refresh token expired. Please sign in again." },
        { status: 401 }
      );
    }

    // ── Rotate: revoke old, issue new ───────────────────────────────────
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        token: newToken,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    // ── Issue new JWT via @auth/core ────────────────────────────────────
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
      console.error("[Refresh] AUTH_SECRET is not set — cannot sign JWT");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const newJwt = await encode({
      token: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        refreshToken: newToken,
      },
      secret: authSecret,
      salt: authSecret, // required by @auth/core v0.38+
      maxAge: 15 * 60, // 15-minute access token
    });

    // ── Set session cookie ──────────────────────────────────────────────
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    const response = NextResponse.json({
      success: true,
      refreshToken: newToken,
    });

    response.cookies.set(cookieName, newJwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
    });

    return response;
  } catch (error) {
    console.error("[Refresh] Error:", error);
    return NextResponse.json(
      { error: "Token refresh failed. Please sign in again." },
      { status: 500 }
    );
  }
}
