"use client";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationControl } from "@/components/pwa/notification-control";
import { StatePanel } from "@/components/ui/primitives";
import { NativeSessionDiagnostics } from "@/components/native/session-diagnostics";
import packageInfo from "../../../package.json";
export default function SettingsPage() { return <RequireAuth><Settings /></RequireAuth>; }
function Settings() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }).then(r => r.json()).then(body => setEmail(body.data?.user?.email || "Unavailable")).catch(() => setEmail("Unavailable")); }, []);
  return <div className="px settings-content"><h1 className="page-title">Settings</h1>
    <section className="card settings-section"><h2 className="section-heading">Notifications</h2><NotificationControl detailed /></section>
    <section className="card settings-section"><h2 className="section-heading">Account</h2>{email === null ? <StatePanel>Loading account…</StatePanel> : <p className="page-sub">{email}</p>}<SignOutButton /></section>
    <NativeSessionDiagnostics />
    <section className="card settings-section"><h2 className="section-heading">App</h2><p>REIBRY</p><p className="page-sub">Web version {packageInfo.version}</p></section>
  </div>;
}
