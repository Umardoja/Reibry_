import { createHash } from "node:crypto";
import { canonicalTikTokUrl } from "../sources/tiktok-url.ts";

const trackingParameters = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]);

export function normalizeCaptureUrl(value: string): string {
  const tiktok = canonicalTikTokUrl(value.trim());
  if (tiktok) return tiktok;
  const url = new URL(value.trim());
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (trackingParameters.has(key.toLowerCase())) url.searchParams.delete(key);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function normalizeCaptureText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function captureDedupeKey(input: { sourceUrl?: string; rawText?: string }): string {
  const normalized = input.sourceUrl ? `url:${normalizeCaptureUrl(input.sourceUrl)}` : `text:${normalizeCaptureText(input.rawText || "")}`;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
