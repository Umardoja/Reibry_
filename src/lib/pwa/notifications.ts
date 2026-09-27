import { Android, isNativeAndroid } from "../native/android.ts";
export function notificationPayload(memory: { id: string; title: string }) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(memory.id)) return null;
  return { title: "Remembered", options: {
    body: memory.title.replace(/[\r\n\t]/g, " ").slice(0, 100), tag: `reibry-memory-${memory.id}`,
    icon: "/icons/icon-192.png", badge: "/icons/badge-96.png",
    data: { url: `/memories/${memory.id}`, memoryId: memory.id },
  } };
}
export async function askNotificationPermission(api: Pick<typeof Notification, "permission" | "requestPermission"> | undefined): Promise<NotificationPermission | "unsupported"> {
  if (!api) return "unsupported";
  if (api.permission !== "default") return api.permission;
  try { return await api.requestPermission(); } catch { return "default"; }
}
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function registerReibryWorker(): Promise<ServiceWorkerRegistration> {
  if (!registration) {
    registration = navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => { registration = undefined; throw error; });
  }
  return registration;
}
export async function notifyRemembered(memory: { id: string; title: string }) {
  if (isNativeAndroid()) return false; // Native external shares are notified by their Worker.
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return false;
  const payload = notificationPayload(memory);
  if (!payload) return false;
  try {
    const reg = await registerReibryWorker();
    if (!reg.active) return false;
    await reg.showNotification(payload.title, payload.options);
    return true;
  } catch { return false; }
}

export function shareNotificationPayload(id: string, state: "processing" | "complete" | "error", memory?: { id: string; title: string }) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) return null;
  if (state === "complete" && (!memory || !notificationPayload(memory))) return null;
  return { title: state === "processing" ? "Remembering…" : state === "complete" ? "Remembered" : "Couldn't remember this",
    options: { tag: `reibry-capture-${id}`, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png",
      body: state === "processing" ? "Saving your shared source" : state === "complete" ? memory!.title.replace(/\s+/g, " ").slice(0, 100) : "Tap to retry",
      data: state === "complete" ? { state, memoryId: memory!.id, url: `/memories/${memory!.id}` } : { state, pendingId: id, url: `/capture?share=${id}` },
    } };
}
const notificationQueue = new Map<string, Promise<unknown>>();
export function notifySharedCapture(id: string, state: "processing" | "complete" | "error", memory?: { id: string; title: string }) {
  if (isNativeAndroid()) return Android.updateNotification({ pendingId: id, state, memoryId: memory?.id, title: memory?.title }).then(() => true).catch(() => false);
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return Promise.resolve(false);
  const payload = shareNotificationPayload(id, state, memory);
  if (!payload) return Promise.resolve(false);
  const task = (notificationQueue.get(id) || Promise.resolve()).then(async () => {
    try { const reg = await registerReibryWorker(); if (!reg.active) return false; await reg.showNotification(payload.title, payload.options); return true; }
    catch { return false; }
  });
  notificationQueue.set(id, task);
  void task.finally(() => { if (notificationQueue.get(id) === task) notificationQueue.delete(id); });
  return task;
}
