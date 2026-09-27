const hosts = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
export function tiktokUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && hosts.has(url.hostname) ? url : null;
  } catch { return null; }
}
export function canonicalTikTokUrl(value: string): string | null {
  const url = tiktokUrl(value);
  if (!url || !/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)) return null;
  return `https://www.tiktok.com${url.pathname.replace(/\/$/, "")}`;
}
