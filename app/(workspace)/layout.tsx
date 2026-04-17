import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/workspace/Sidebar";
import PushToTalk from "@/components/shared/PushToTalk";
import DynamicLayout from "@/components/workspace/DynamicLayout";

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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <DynamicLayout>{children}</DynamicLayout>
        </main>
        <PushToTalk />
      </div>
    </div>
  );
}
