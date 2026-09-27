"use client";
import { useEffect } from "react";
import { registerReibryWorker } from "@/lib/pwa/notifications";
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) void registerReibryWorker().catch(() => { /* Capture remains usable without installation. */ });
    const onInstalled = () => { void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName: "pwa_installed", source: "web" }) }).catch(() => {}); };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
