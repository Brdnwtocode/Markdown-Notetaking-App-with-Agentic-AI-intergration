import { auth } from "@/app/auth";
import { SessionProvider } from "next-auth/react";

/**
 * Server component that wraps children with SessionProvider
 * and passes the server-side session to avoid initial client-side fetch.
 */
export default async function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SessionProvider 
      session={session}
      refetchInterval={0} // Disable client-side polling
      refetchOnWindowFocus={false} // Don't refetch when window regains focus
    >
      {children}
    </SessionProvider>
  );
}
