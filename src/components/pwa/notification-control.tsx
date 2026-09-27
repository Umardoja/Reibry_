"use client";
import { useEffect, useState } from "react";
import { askNotificationPermission, registerReibryWorker } from "@/lib/pwa/notifications";
import { Android, isNativeAndroid } from "@/lib/native/android";
export function NotificationControl({ detailed = false }: { detailed?: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function refresh() {
      if (isNativeAndroid()) { void Android.notificationPermission().then((value) => setPermission(value.permission)).catch(() => setError("Unable to check notifications. Please try again.")); return; }
      setPermission("Notification" in window && "serviceWorker" in navigator && window.isSecureContext ? Notification.permission : "unsupported");
    }
    queueMicrotask(refresh);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, []);
  if (permission === "unsupported") return detailed ? <p className="page-sub">{error || "Notifications are not available in this browser."}</p> : null;
  async function enable() {
    if (busy || permission !== "default") return;
    setBusy(true); setError("");
    try {
      if (isNativeAndroid()) { setPermission((await Android.requestNotifications()).permission); return; }
      // Request permission directly in the user's gesture, never during registration or page load.
      setPermission(await askNotificationPermission(Notification));
      await registerReibryWorker();
    } catch { setError("Could not enable notifications. Please try again."); } finally { setBusy(false); }
  }
  return <section className="recent-section" aria-label="Save notifications">{detailed && <p>{permission === "granted" ? "On" : permission === "denied" ? "Blocked" : "Off"}</p>}<p className="page-sub">{permission === "granted" ? "Notifications enabled." : permission === "denied" ? isNativeAndroid() ? "Notifications are disabled in Android settings." : "Notifications are blocked. Change this in your browser’s site settings." : "Get a notification when REIBRY finishes remembering something."}</p>{permission === "default" && <button type="button" className="btn-ghost" disabled={busy} onClick={enable}>{busy ? "Checking…" : "Enable notifications"}</button>}{isNativeAndroid() && <button type="button" className="btn-ghost" onClick={() => void Android.openNotificationSettings().catch(() => setError("Unable to open Android settings."))}>Open notification settings</button>}{error && <p role="alert">{error}</p>}</section>;
}
