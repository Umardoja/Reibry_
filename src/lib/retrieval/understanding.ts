import type { Memory } from "@/types/reibry";
import { conceptTokens, expandConcepts } from "./concepts.ts";

const STOP_WORDS = new Set("a an and are as at by did do for from how i in is it me my of on or roughly saved show something that the thing this to was what where which you your looking look find searching video videos clip clips shaped shape like looked designed resemble resembles resembling weird odd made was were the one".split(" "));
const CONCEPTS: Record<string, string[]> = {
  mathematics: ["math", "maths", "mathematics", "algebra", "calculus", "equation", "equations", "revision"],
  programming: ["code", "coding", "programming", "software", "python", "javascript", "fastapi", "backend", "api", "apis"],
  cooking: ["recipe", "recipes", "cook", "cooking", "bake", "baking", "cake", "cakes", "ingredients"],
  finance: ["money", "budget", "budgeting", "expense", "expenses", "saving", "finance"],
  travel: ["travel", "trip", "flight", "hotel", "hotels", "vacation"],
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function normalizedTerms(value: string) {
  const terms = new Set([...conceptTokens(value)].filter((word) => !STOP_WORDS.has(word)));
  for (const [concept, aliases] of Object.entries(CONCEPTS)) if (aliases.some((alias) => terms.has(alias))) {
    terms.add(concept);
    aliases.forEach((alias) => terms.add(alias));
  }
  return expandConcepts(terms);
}

function cakeDesign(value: string) {
  const lower = value.toLowerCase();
  if (!/\bcake\b/.test(lower)) return null;
  const patterns = [
    /\bcake\s+(?:is\s+)?(?:shaped|designed)\s+(?:like|as|to\s+resemble)\s+(?:a\s+)?(.+?)(?:[.!?,]|$)/,
    /\bcake\s+(?:was|looked)\s+(?:like|an?)\s+(.+?)(?:[.!?,]|$)/,
    /\b(.+?)\s+shaped\s+cake\b/,
    /\b(.+?)\s+cake\s+(?:design|shape)\b/,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    const design = match?.[1]?.trim().replace(/^(?:a|an|the|chef)\s+/, (prefix) => prefix.trim() === "chef" ? "chef " : "");
    if (design && design.length <= 48 && !/^(?:cake|normal|round)$/.test(design)) return design;
  }
  if (/\b(?:apron[- ]shaped|apron cake|chef apron cake)\b/.test(lower)) return "apron";
  return null;
}

/** Collapse conversational cake/design requests into a bounded object + design query. */
export function normalizeVisualSearchQuery(value: string) {
  const lower = value.toLowerCase();
  if (/\bapron[- ]shaped\b/.test(lower) && !/\bcake\b/.test(lower)) return "apron-shaped cake chef apron cake";
  const design = cakeDesign(value);
  if (design) return `${design} shaped cake`;
  return value.replace(/\b(?:i am|i'm|im) looking for\b/gi, "").replace(/\b(?:can you )?(?:find|search for|look for)\b/gi, "").replace(/\b(?:that|the) video where\b/gi, "").trim();
}

export function visualRelationQuery(value: string) {
  const design = cakeDesign(value);
  if (design) return { object: "cake", design };
  const normalized = value.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();
  const match = normalized.match(/\b(butterfly|heart|apron|chef jacket|flower|car|football|shoe|phone|book)\s+(?:shaped\s+)?cake\b/);
  return match ? { object: "cake", design: match[1] } : null;
}

export type RetrievalHints = { source?: "tiktok" | "youtube" | "web" | "text"; from?: string; to?: string };
export function parseRetrievalHints(query: string, referenceNow = new Date()): RetrievalHints {
  const lower = query.toLowerCase();
  const source = /\btiktok\b/.test(lower) ? "tiktok" : /\byoutube\b/.test(lower) ? "youtube" : /\b(?:website|web|article)\b/.test(lower) ? "web" : /\b(?:note|text)\b/.test(lower) ? "text" : undefined;
  const monthIndex = MONTHS.findIndex((month) => new RegExp(`\\b${month}\\b`).test(lower));
  if (monthIndex < 0) return { source };
  const explicitYear = lower.match(/\b(20\d{2})\b/)?.[1];
  let year = explicitYear ? Number(explicitYear) : referenceNow.getUTCFullYear();
  if (!explicitYear && monthIndex > referenceNow.getUTCMonth()) year -= 1;
  return { source, from: new Date(Date.UTC(year, monthIndex, 1)).toISOString(), to: new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString() };
}

export function sourceKind(memory: Memory): "tiktok" | "youtube" | "web" | "text" {
  const platform = (memory.sourcePlatform || "").toLowerCase();
  if (platform.includes("tiktok")) return "tiktok";
  if (platform.includes("youtube")) return "youtube";
  return memory.sourceType === "text" ? "text" : "web";
}

export function matchesHints(memory: Memory, hints: RetrievalHints) {
  if (hints.source && sourceKind(memory) !== hints.source) return false;
  const created = Date.parse(memory.createdAt);
  if (hints.from && (!Number.isFinite(created) || created < Date.parse(hints.from))) return false;
  if (hints.to && (!Number.isFinite(created) || created >= Date.parse(hints.to))) return false;
  return true;
}
