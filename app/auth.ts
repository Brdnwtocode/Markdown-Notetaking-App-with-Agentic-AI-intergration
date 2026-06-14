import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure opaque refresh token */
function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/** Store a new refresh token in the database (3-day expiry) */
async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    },
  });
  return token;
}

/** Revoke all refresh tokens for a user (called on fresh login) */
async function revokeUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── Auth Config ─────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "login",
        },
      },
    }),
    Google({
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, password: true },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // Rotate refresh tokens on every fresh login
        await revokeUserRefreshTokens(user.id);
        const refreshToken = await createRefreshToken(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Pass refresh token through to jwt callback via a custom field
          refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      // Allow all sign-ins; OAuthAccountNotLinked is thrown before this callback.
      // Log for debugging OAuth issues in development.
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth] signIn callback:", {
          userId: user.id,
          email: user.email,
          provider: account?.provider,
          providerAccountId: account?.providerAccountId,
        });
      }

      // Reject sign-in if OAuth account has no verified email (shouldn't happen,
      // but guards against misconfigured OAuth providers returning empty emails).
      if (account?.provider !== "credentials" && !user.email) {
        console.error("[auth] OAuth sign-in blocked — no email on user object", {
          provider: account?.provider,
          providerAccountId: account?.providerAccountId,
        });
        return false;
      }

      return true;
    },
    jwt: async ({ token, user, account }) => {
      // ── Guard: if token has an id but the user was deleted from DB, clear it ──
      // This prevents OAuthAccountNotLinked caused by stale JWT cookies
      // referencing a user that no longer exists.
      if (token.id && !user) {
        const exists = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true },
        });
        if (!exists) {
          console.warn(
            `[auth] Stale JWT detected — userId=${token.id} no longer exists. Clearing token.`
          );
          // Returning an empty token effectively signs out the stale session
          return {};
        }
      }

      // On first sign-in (Credentials or OAuth), attach user.id and refresh token
      if (user) {
        token.id = user.id;
        if ("refreshToken" in user && typeof user.refreshToken === "string") {
          token.refreshToken = user.refreshToken;
        }
      }
      // On OAuth sign-in, also generate a refresh token if not present
      if (account && account.provider !== "credentials" && !token.refreshToken) {
        try {
          const rt = await createRefreshToken(token.id as string);
          token.refreshToken = rt;
        } catch { /* non-blocking */ }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Landing page handles sign-in forms
  },
});