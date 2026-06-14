import "react-big-calendar/lib/css/react-big-calendar.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import AuthSessionProvider from "@/components/shared/AuthSessionProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Markdown Notetaking App",
  description: "A multimodal AI-powered notetaking workspace",
  icons: {
    icon: "/brand/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} font-sans dark`}>
      <body className="font-sans">
        <AuthSessionProvider>
          {children}
          <Toaster position="bottom-right" toastOptions={{ duration: 6000 }} />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
