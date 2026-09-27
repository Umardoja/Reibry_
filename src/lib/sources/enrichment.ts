import type { SourceEvidence } from "@/types/reibry";
import type { NormalizedCapture } from "./adapters";
import { tiktokUrl } from "./tiktok-url.ts";
import { enrichTikTok } from "./tiktok.ts";

import { MEMORY_CATEGORIES, type MemoryCategory } from "./categories.ts";
export { MEMORY_CATEGORIES, type MemoryCategory } from "./categories.ts";

const categoryAliases: Record<string, MemoryCategory> = {
  education: "Education & Learning", learning: "Education & Learning", study: "Education & Learning", school: "Education & Learning",
  programming: "Technology", software: "Technology", coding: "Technology", tech: "Technology",
  cooking: "Food & Cooking", food: "Food & Cooking", recipe: "Food & Cooking", recipes: "Food & Cooking",
  money: "Finance", finance: "Finance", budgeting: "Finance", budget: "Finance",
  tourism: "Travel", travel: "Travel", fitness: "Health & Fitness", health: "Health & Fitness",
  career: "Work & Career", work: "Work & Career", media: "Entertainment", shopping: "Shopping",
  personal: "Personal", inspiration: "Ideas & Inspiration", ideas: "Ideas & Inspiration",
};

export function normalizeCategory(value: unknown): MemoryCategory {
  if (typeof value !== "string") return "Other";
  const trimmed = value.trim();
  if ((MEMORY_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed as MemoryCategory;
  return categoryAliases[trimmed.toLowerCase()] || "Other";
}

const stopWords = new Set("a an and are as at by for from how in is it of on or the this to with your you something that was were about into their simple found shared video tiktok youtube tutorial".split(" "));
const conceptAliases: Array<[RegExp, string[]]> = [
  [/\b(math|maths|mathematics|algebra|calculus|equations?)\b/i, ["mathematics", "education"]],
  [/\b(code|coding|programming|software|python|javascript|async)\b/i, ["programming", "technology"]],
  [/\b(recipe|cook|cooking|bake|baking|cake|dessert)\b/i, ["cooking", "food"]],
  [/\b(money|budget|budgeting|expenses?|saving|finance)\b/i, ["finance", "budget"]],
];

function hostIsSafe(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.includes(":")) return false;
  const octets = host.split(".");
  if (octets.length === 4 && octets.every((part) => /^\d+$/.test(part))) {
    const numbers = octets.map(Number);
    if (numbers.some((value) => value > 255) || numbers[0] === 0 || numbers[0] === 10 || numbers[0] === 127 || numbers[0] === 169 && numbers[1] === 254 || numbers[0] === 192 && numbers[1] === 168 || numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) return false;
  }
  return true;
}

export function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && hostIsSafe(url.hostname);
  } catch { return false; }
}

function extractMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+(?:[^>]*?\\s)?(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']*)["'][^>]*>|<meta\\s+(?:[^>]*?\\s)?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${escaped}["'][^>]*>`, "i");
  const match = html.match(pattern);
  return (match?.[1] || match?.[2])?.replace(/\s+/g, " ").trim();
}

function extractTitle(html: string) { return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

async function fetchText(url: string, timeoutMs = 2500): Promise<{ body: string; contentType: string } | null> {
  if (!isSafePublicUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { accept: "text/html,application/xhtml+xml,application/json" } });
    if (response.status >= 300 && response.status < 400) return null;
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml|application\/json/i.test(contentType)) return null;
    const body = (await response.text()).slice(0, 250_000);
    return { body, contentType };
  } catch { return null; } finally { clearTimeout(timer); }
}

function youtubeHost(hostname: string) { return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(hostname.toLowerCase()); }

export async function enrichCapture(input: NormalizedCapture): Promise<NormalizedCapture> {
  if (!input.sourceUrl || !isSafePublicUrl(input.sourceUrl)) return input;
  if (tiktokUrl(input.sourceUrl)) return enrichTikTok(input);
  if (input.evidence[0]?.platform === "tiktok") return input;
  let sourcePlatform = input.evidence[0]?.platform;
  const url = new URL(input.sourceUrl);
  let evidence: SourceEvidence = { ...input.evidence[0], platform: input.evidence[0]?.platform || url.hostname, sourceQuality: input.evidence[0]?.sourceQuality || "unknown" };
  if (youtubeHost(url.hostname)) {
    sourcePlatform = "youtube";
    const oembed = await fetchText(`https://www.youtube.com/oembed?url=${encodeURIComponent(input.sourceUrl)}&format=json`);
    if (oembed) {
      try {
        const data = JSON.parse(oembed.body) as { title?: string; author_name?: string; thumbnail_url?: string };
        evidence = { ...evidence, title: data.title || evidence.title, author: data.author_name, thumbnail: data.thumbnail_url, platform: "youtube", metadataSource: "youtube-oembed", sourceQuality: "medium" };
      } catch { /* keep shared evidence */ }
    }
  } else {
    const page = await fetchText(input.sourceUrl);
    if (page) {
      const pageTitle = extractTitle(page.body) || extractMeta(page.body, "og:title");
      const description = extractMeta(page.body, "og:description") || extractMeta(page.body, "description");
      const thumbnail = extractMeta(page.body, "og:image");
      evidence = { ...evidence, title: pageTitle || evidence.title, caption: description || evidence.caption, thumbnail: isSafePublicUrl(thumbnail || "") ? thumbnail : evidence.thumbnail, platform: url.hostname, metadataSource: "web-metadata", sourceQuality: pageTitle || description ? "medium" : evidence.sourceQuality };
    }
  }
  const title = input.title || evidence.title;
  return { ...input, title, evidence: evidence.title || evidence.caption || evidence.thumbnail ? [evidence] : input.evidence, sourceType: sourcePlatform === "youtube" ? "video" : input.sourceType };
}

export function evidenceText(evidence: SourceEvidence[], rawText?: string, title?: string) {
  return [title, rawText, ...evidence.flatMap((item) => [item.title, item.caption, item.author, ...(item.onScreenText || []), ...(item.frames || []).map((frame) => frame.description)])].filter(Boolean).join(" ");
}

export function deriveTags(text: string, max = 8) {
  const tags = new Set<string>();
  const lower = text.toLowerCase();
  if (/\bcake\b/.test(lower)) tags.add("cake");
  if (/\b(recipe|ingredients?|flour|sugar|baking powder)\b/.test(lower)) tags.add("recipe");
  if (/\b(bake|baking|frosting|oven)\b/.test(lower)) tags.add("baking");
  if (/\bpython\b/.test(lower)) tags.add("python");
  if (/\bfastapi\b/.test(lower)) tags.add("fastapi");
  if (/\b(api|apis)\b/.test(lower)) tags.add("api");
  for (const [pattern, values] of conceptAliases) if (pattern.test(text)) values.forEach((value) => tags.add(value));
  for (const token of lower.split(/[^a-z0-9]+/).filter((value) => value.length > 2 && !stopWords.has(value) && !/^\d+$/.test(value) && !/^(cups?|grams?|kg|ml|tbsp|tsp)$/.test(value))) tags.add(token);
  return [...tags].slice(0, max);
}

export function deriveCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  if (/\b(recipe|cook|cooking|bake|baking|food|cake|dessert)\b/.test(lower)) return "Food & Cooking";
  if (/\b(math|maths|mathematics|algebra|calculus|equation|study|learn|course)\b/.test(lower)) return "Education & Learning";
  if (/\b(code|coding|programming|software|python|javascript|technology)\b/.test(lower)) return "Technology";
  if (/\b(money|budget|finance|expense|saving)\b/.test(lower)) return "Finance";
  if (/\b(travel|trip|flight|hotel|vacation)\b/.test(lower)) return "Travel";
  return "Other";
}
