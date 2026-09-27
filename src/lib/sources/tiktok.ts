import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { canonicalTikTokUrl, tiktokUrl } from "./tiktok-url.ts";
import type { NormalizedCapture } from "./adapters";

export type TikTokReply = { status: number; location?: string; contentType?: string; body: string };
export type TikTokRequest = (url: string, options: { signal: AbortSignal; redirect: "manual"; readBody: boolean }) => Promise<TikTokReply>;

/** DNS is checked AND pinned to this connection, preventing DNS rebinding between validation and fetch. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19));
  }
  // Fail closed for all IPv6 other than global unicast, including IPv4-mapped addresses.
  return isIP(address) === 6 && /^[23][\da-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
}
export const requestTikTok: TikTokRequest = async (value, options) => {
  const url = tiktokUrl(value);
  if (!url) throw new Error("Unsafe TikTok destination");
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some(({ address }) => !publicAddress(address))) throw new Error("Unsafe TikTok address");
  options.signal.throwIfAborted();
  const pinned = records[0];
  return new Promise((resolve, reject) => {
    // https.request never follows redirects; every Location is handled manually below.
    const req = request(url, {
      signal: options.signal, method: "GET", family: pinned.family, headers: { accept: options.readBody ? "application/json" : "text/html" },
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
    }, (res) => {
      const result = { status: res.statusCode || 0, location: res.headers.location, contentType: res.headers["content-type"], body: "" };
      if (!options.readBody || result.status !== 200 || !result.contentType?.includes("application/json")) { res.destroy(); resolve(result); return; }
      if (Number(res.headers["content-length"]) > 128000) { res.destroy(); reject(new Error("Metadata too large")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 128000) { res.destroy(); reject(new Error("Metadata too large")); } else chunks.push(chunk); });
      res.on("end", () => resolve({ ...result, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject); req.end();
  });
};

async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Metadata timeout")); }, timeoutMs); });
  try { return await Promise.race([work(controller.signal), timeout]); } finally { clearTimeout(timer!); }
}
export async function resolveTikTokUrl(value: string, fetcher: TikTokRequest = requestTikTok, timeoutMs = 2500): Promise<string | null> {
  const direct = canonicalTikTokUrl(value);
  if (direct) return direct;
  const initial = tiktokUrl(value);
  if (!initial || !(["vm.tiktok.com", "vt.tiktok.com"].includes(initial.hostname) || initial.pathname.startsWith("/t/"))) return null;
  try {
    return await bounded(async (signal) => {
      let current = initial.toString();
      for (let hop = 0; hop < 3; hop++) {
        const response = await fetcher(current, { signal, redirect: "manual", readBody: false });
        if (![301, 302, 303, 307, 308].includes(response.status) || !response.location) return null;
        const next = new URL(response.location, current).toString();
        if (!tiktokUrl(next)) return null;
        const canonical = canonicalTikTokUrl(next);
        // A canonical destination is not fetched here. oEmbed fetch has its own pinned DNS check.
        if (canonical) return canonical;
        current = next;
      }
      return null;
    }, timeoutMs);
  } catch { return null; }
}

export async function canonicalizeTikTokCapture(input: NormalizedCapture, fetcher: TikTokRequest = requestTikTok): Promise<NormalizedCapture> {
  if (!input.sourceUrl || !tiktokUrl(input.sourceUrl)) return input;
  const canonical = await resolveTikTokUrl(input.sourceUrl, fetcher);
  return { ...input, sourceUrl: canonical || input.sourceUrl, evidence: input.evidence.map((item) => ({ ...item, platform: "tiktok", mediaUrl: input.sourceUrl, ...(canonical ? { canonicalUrl: canonical } : {}) })) };
}
function clean(value: unknown, max: number): string | undefined { return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined; }
function publicHttps(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const u = new URL(value); if (u.protocol === "https:" && !u.username && !u.password && !isIP(u.hostname) && u.hostname.includes(".") && !u.hostname.endsWith(".localhost")) return u.toString(); } catch { /* Omit malformed metadata. */ }
}
export async function enrichTikTok(input: NormalizedCapture, fetcher: TikTokRequest = requestTikTok, timeoutMs = 2500): Promise<NormalizedCapture> {
  const canonical = input.sourceUrl && canonicalTikTokUrl(input.sourceUrl);
  if (!canonical) return input;
  try {
    const reply = await bounded((signal) => fetcher(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`, { signal, redirect: "manual", readBody: true }), timeoutMs);
    if (reply.status !== 200 || !reply.contentType?.includes("application/json")) return input;
    const data: unknown = JSON.parse(reply.body);
    if (!data || typeof data !== "object" || Array.isArray(data)) return input;
    const fields = data as Record<string, unknown>;
    const title = clean(fields.title, 300);
    const author = clean(fields.author_name, 300);
    if (!title && !author) return input;
    return { ...input, title: input.title || title, evidence: [{ ...input.evidence[0], title: title || input.evidence[0]?.title, author, authorUrl: publicHttps(fields.author_url), thumbnail: publicHttps(fields.thumbnail_url), platform: "tiktok", metadataSource: "tiktok-oembed", sourceQuality: "medium", canonicalUrl: canonical }] };
  } catch { return input; }
}
