import { auth } from "@/app/auth";
import { redirect } from "next/navigation";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/workspace");
  }

  return <>{children}</>;
}
