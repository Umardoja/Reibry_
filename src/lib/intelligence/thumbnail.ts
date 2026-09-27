import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isSafeThumbnailUrl } from "./thumbnail-policy.ts";
export { isSafeThumbnailUrl } from "./thumbnail-policy.ts";

export const VISUAL_EVIDENCE_LIMITS = { timeoutMs: 4000, maxBytes: 2_000_000, maxConcepts: 16 } as const;
export type ThumbnailVisualEvidence = { source: "thumbnail"; analyzed: true; concepts: string[]; visualDescription?: string; primaryObjects?: string[]; attributes?: string[]; relationships?: string[]; confidence?: "high" | "medium" | "low" };

export async function fetchThumbnail(value: string, onReject?: (reason: string) => void) {
  const rejected = (reason: string) => { onReject?.(reason); if (process.env.NODE_ENV !== "production") console.info("[thumbnail] preview unavailable", { reason }); return null; };
  if (!isSafeThumbnailUrl(value)) return rejected("url-policy");
  const url = new URL(value);
  try {
    const addresses = isIP(url.hostname) ? [url.hostname] : (await lookup(url.hostname, { all: true })).map((entry) => entry.address);
    if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) return rejected("dns-address-policy");
  } catch { return rejected("dns-lookup"); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISUAL_EVIDENCE_LIMITS.timeoutMs);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { accept: "image/*" } });
    if (!response.ok || response.status >= 300) return rejected(`http-${response.status}`);
    const mimeType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) return rejected("mime-policy");
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > VISUAL_EVIDENCE_LIMITS.maxBytes) return rejected("declared-size-policy");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > VISUAL_EVIDENCE_LIMITS.maxBytes) return rejected("actual-size-policy");
    return { data: Buffer.from(bytes).toString("base64"), mimeType };
  } catch (error) { return rejected(error instanceof Error && error.name === "AbortError" ? "timeout" : "network-error"); } finally { clearTimeout(timer); }
}

function isPublicAddress(address: string) {
  if (isIP(address) === 4) { const [a, b] = address.split(".").map(Number); return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127)); }
  const lower = address.toLowerCase();
  return !lower.startsWith("::1") && !lower.startsWith("fc") && !lower.startsWith("fd") && !lower.startsWith("fe8") && !lower.startsWith("fe9") && !lower.startsWith("fea") && !lower.startsWith("feb");
}
