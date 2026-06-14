/**
 * scripts/clean-auth-tables.mjs
 *
 * SAFE cleanup: only removes orphaned/expired auth records.
 * Does NOT delete any User records or their data (notes, stacks, tasks, etc).
 *
 * Fixes OAuthAccountNotLinked by removing:
 *   1. Orphaned Account rows (provider link pointing to a deleted user)
 *   2. Expired sessions
 *   3. Revoked or expired refresh tokens
 *
 * Run with: node scripts/clean-auth-tables.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Scanning for orphaned & expired auth records...\n");

  // ── 1. Find Account rows whose userId no longer exists in User table ──
  const allAccounts = await prisma.account.findMany({
    select: { id: true, userId: true, provider: true, providerAccountId: true },
  });

  const userIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id)
  );

  const orphanedAccounts = allAccounts.filter((a) => !userIds.has(a.userId));

  if (orphanedAccounts.length > 0) {
    const orphanedIds = orphanedAccounts.map((a) => a.id);
    await prisma.account.deleteMany({
      where: { id: { in: orphanedIds } },
    });
    console.log(`  🗑  Deleted ${orphanedAccounts.length} orphaned OAuth account(s):`);
    for (const a of orphanedAccounts) {
      console.log(`     - ${a.provider}:${a.providerAccountId} → missing userId=${a.userId}`);
    }
  } else {
    console.log("  ✓ No orphaned OAuth accounts found");
  }

  // ── 2. Expired sessions ──
  const deletedSessions = await prisma.session.deleteMany({
    where: { expires: { lt: new Date() } },
  });
  console.log(`  🗑  Deleted ${deletedSessions.count} expired session(s)`);

  // ── 3. Revoked or expired refresh tokens ──
  const deletedTokens = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { not: null } },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });
  console.log(`  🗑  Deleted ${deletedTokens.count} revoked/expired refresh token(s)`);

  // ── 4. Summary ──
  const remainingUsers = await prisma.user.count();
  console.log(`\n✅ Done. ${remainingUsers} user(s) and all their data are untouched.`);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
