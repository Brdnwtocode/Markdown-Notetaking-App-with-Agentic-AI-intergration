import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const users = await p.user.findMany({
  select: { id: true, email: true, name: true, password: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
console.log("=== USERS ===");
users.forEach((u, i) => {
  console.log(`[${i + 1}] ${u.email} | id=${u.id.slice(0, 8)}... | pwd=${u.password ? "YES" : "null"} | ${u.createdAt.toISOString()}`);
});

const accounts = await p.account.findMany({
  select: { id: true, userId: true, provider: true, providerAccountId: true },
});
console.log("\n=== ACCOUNTS ===");
accounts.forEach((a, i) => {
  const user = users.find(u => u.id === a.userId);
  console.log(`[${i + 1}] ${a.provider}:${a.providerAccountId.slice(0, 12)}... → user=${user?.email || "ORPHAN"}`);
});

// Check for orphaned accounts
const allUserIds = new Set(users.map(u => u.id));
const orphans = accounts.filter(a => !allUserIds.has(a.userId));
if (orphans.length > 0) {
  console.log(`\n⚠️  ${orphans.length} ORPHANED Account row(s) — userId doesn't exist in User table!`);
}

// Show notes & recordings
const notes = await p.note.findMany({ select: { id: true, title: true, userId: true } });
const recs = await p.recording.findMany({ select: { id: true, title: true, userId: true } });
console.log(`\n=== DATA ===`);
console.log(`Notes: ${notes.length}, Recordings: ${recs.length}`);

await p.$disconnect();
