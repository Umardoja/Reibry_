import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa/registration";
import { AndroidSession } from "@/components/native/android-session";
import { AuthSessionProvider } from "@/components/auth/auth-session-provider";
import { HomeConversationProvider } from "@/components/home/home-conversation-provider";

export const metadata: Metadata = {
  title: { default: "REIBRY", template: "%s | REIBRY" },
  description: "Your personal AI memory system.",
  applicationName: "REIBRY",
};
export const viewport: Viewport = { themeColor: "#0F6B5C" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="min-h-screen">
    <a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
    <PwaRegistration /><AuthSessionProvider><HomeConversationProvider><AndroidSession /><AppShell>{children}</AppShell></HomeConversationProvider></AuthSessionProvider>
  </body></html>;
}
