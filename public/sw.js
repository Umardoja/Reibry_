/* Network-only worker. Never intercept/cache API, auth, capture, or private pages. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
  const retry = data?.state === "error" && uuid.test(data.pendingId || "");
  if (!data || (!retry && !uuid.test(data.memoryId || ""))) return;
  let url;
  try { url = new URL(data.url, self.location.origin); } catch { return; }
  if (url.origin !== self.location.origin || url.username || url.password || (retry ? url.pathname !== "/capture" || url.search !== `?share=${data.pendingId}` : url.pathname !== `/memories/${data.memoryId}` || url.search) || url.hash) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try { const navigated = await client.navigate(url.href); if (navigated) { await navigated.focus(); return; } } catch { /* Try another client or open one. */ }
    }
    await self.clients.openWindow(url.href);
  })());
});
