import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma";
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers:[
    GitHub, // Auto-detects AUTH_GITHUB_ID and AUTH_GITHUB_SECRET
    Google, // Auto-detects AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});