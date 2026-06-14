import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/workspace/Sidebar";
import TabBar from "@/components/workspace/TabBar";
import PushToTalk from "@/components/shared/PushToTalk";
import ChatSidebar from "@/components/workspace/ChatSidebar";
import WorkspaceUserSync from "@/components/workspace/WorkspaceUserSync";
import UniversalConfirmationToast from "@/components/workspace/UniversalConfirmationToast";
import BackgroundRecorder from "@/components/workspace/BackgroundRecorder";
import DndWrapper from "@/components/workspace/DndWrapper";

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
    <DndWrapper>
      <div className="flex h-screen bg-[#0e0e0e] text-foreground font-sans">
        <WorkspaceUserSync userId={session.user.id} />
        <BackgroundRecorder />
        <Sidebar />
        <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
          <TabBar />
          <main className="flex-1 overflow-hidden p-4 sm:p-5">
            <div className="flex h-full flex-col rounded-lg border border-[#27272A] bg-[#0e0e0e] shadow-2xl overflow-hidden">
              {children}
            </div>
          </main>
          <PushToTalk />
          <UniversalConfirmationToast />
        </div>
        <ChatSidebar />
      </div>
    </DndWrapper>
  );
}
