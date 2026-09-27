export function isSafeThumbnailUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.endsWith(".local")) return false;
    const octets = host.split(".").map(Number);
    if (octets.length === 4 && octets.every(Number.isFinite) && (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)) return false;
    return true;
  } catch { return false; }
}
