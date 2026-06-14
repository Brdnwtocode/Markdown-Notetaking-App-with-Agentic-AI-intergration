import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const [users, accounts, notes, stacks, folders, tasks, events, recordings] = await Promise.all([
  p.user.count(),
  p.account.count(),
  p.note.count(),
  p.stack.count(),
  p.folder.count(),
  p.task.count(),
  p.calendarEvent.count(),
  p.recording.count(),
]);

console.log("Users:         ", users);
console.log("Accounts:      ", accounts);
console.log("Notes:         ", notes);
console.log("Stacks:        ", stacks);
console.log("Folders:       ", folders);
console.log("Tasks:         ", tasks);
console.log("CalendarEvents:", events);
console.log("Recordings:    ", recordings);

// Also check for orphaned data (userId that no longer exists)
const allUserIds = new Set((await p.user.findMany({ select: { id: true } })).map(u => u.id));

const orphanNotes = await p.note.findMany({ select: { userId: true } });
const orphanStacks = await p.stack.findMany({ select: { userId: true } });
const orphanFolders = await p.folder.findMany({ select: { userId: true } });
const orphanTasks = await p.task.findMany({ select: { userId: true } });
const orphanEvents = await p.calendarEvent.findMany({ select: { userId: true } });
const orphanRecordings = await p.recording.findMany({ select: { userId: true } });

const check = (label, items) => {
  const orphans = items.filter(i => !allUserIds.has(i.userId));
  if (orphans.length > 0) console.log(`ORPHANED ${label}:`, orphans.length, "rows (dangling userIds)");
};

check("Notes", orphanNotes);
check("Stacks", orphanStacks);
check("Folders", orphanFolders);
check("Tasks", orphanTasks);
check("CalendarEvents", orphanEvents);
check("Recordings", orphanRecordings);

await p.$disconnect();
