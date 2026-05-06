import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/workspace/Sidebar";
import TabBar from "@/components/workspace/TabBar";
import PushToTalk from "@/components/shared/PushToTalk";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="flex h-screen bg-[#050505] text-foreground">
      <Sidebar />
      <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
        <TabBar />
        <main className="flex-1 overflow-hidden p-5 sm:p-6">
          <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[#0b1118] shadow-2xl shadow-black/40 overflow-hidden">
            {children}
          </div>
        </main>
        <PushToTalk />
      </div>
    </div>
  );
}
