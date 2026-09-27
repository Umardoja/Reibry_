import type { LifeContext, Memory, ReadyPackItem, ReadyPackType } from "../../types/reibry.ts";
import { deterministicLifeFallback } from "../integration/life-fallback.ts";
import { classifyHomeConversation } from "./conversation.ts";

export function intentionType(text: string): "travel" | "event" | "learning" | "opportunity" | "general" {
  const value = text.toLowerCase();
  if (/\b(lagos|trip|travel|travelling|traveling|flight|hotel|holiday|vacation)\b/.test(value)) return "travel";
  if (/\b(birthday|wedding|meeting|party|event)\b/.test(value)) return "event";
  if (/\b(exam|study|learn|learning|course|tutorial|presentation|revision|revise|python|backend)\b/.test(value)) return "learning";
  if (/\b(apply|application|scholarship|interview|job|opportunity)\b/.test(value)) return "opportunity";
  return "general";
}

export function classifyHomeIntent(text: string) {
  const intent = classifyHomeConversation(text);
  if (intent === "SHOW_UPCOMING") return "SHOW_UPCOMING" as const;
  if (intent === "SEARCH_MEMORY") return "SEARCH_MEMORY" as const;
  if (intent === "CREATE_INTENTION") return "CREATE_INTENTION" as const;
  return "UNKNOWN" as const;
}

export function packTypeFor(context: Pick<LifeContext, "type" | "title" | "description">): ReadyPackType | null {
  const value = `${context.title} ${context.description || ""}`.toLowerCase();
  if (context.type === "trip" || /\b(trip|travel|lagos|flight|hotel|holiday|vacation)\b/.test(value)) return "travel";
  if (/\b(learn|learning|study|tutorial|revision|exam|python|backend|presentation)\b/.test(value)) return "learning";
  if (context.type === "event" || /\b(birthday|party|wedding|event)\b/.test(value)) return "event";
  return null;
}

export function intentionFromText(text: string, timezone: string, referenceNow = new Date()) {
  const fallback = deterministicLifeFallback({ text, timezone, referenceNow });
  const context = fallback.contexts[0];
  const kind = intentionType(text);
  return { ...context, type: kind === "travel" ? "trip" : kind === "event" ? "event" : kind === "learning" ? "project" : context.type };
}

function memoryText(memory: Memory) {
  return [memory.title, memory.summary || "", memory.rawText || "", memory.tags.join(" "), memory.entities.map((item) => item.name).join(" "), memory.analysisMetadata?.semanticConcepts?.map((item) => item.concept).join(" ") || "", ...memory.evidenceSources.flatMap((source) => [source.title || "", source.caption || ""])].join(" ").toLowerCase();
}
function titleText(memory: Memory) { return `${memory.title} ${memory.tags.join(" ")} ${memory.entities.map((item) => item.name).join(" ")} ${memory.analysisMetadata?.semanticConcepts?.map((item) => item.concept).join(" ") || ""}`.toLowerCase(); }
function terms(text: string) { return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) || [])].filter((term) => term.length > 2 && !new Set(["the", "and", "for", "with", "next", "this", "that", "will", "have", "from", "presentation", "tutorial", "resource", "learning", "plan", "trip", "travel", "birthday", "event", "cake", "idea", "show", "make", "about", "going", "into", "want", "need", "mum", "mom"]).has(term)); }

export function subjectAnchors(context: Pick<LifeContext, "title" | "description">, type: ReadyPackType): string[] {
  const raw = `${context.title} ${context.description || ""}`;
  const text = raw.toLowerCase();
  if (type === "travel") {
    const known = text.match(/\b(?:lagos|london|paris|barcelona|nairobi|accra|abuja|tokyo|rome|new york|cape town|dubai|lisbon|madrid|toronto|amsterdam)\b/g) || [];
    const named = [...raw.matchAll(/\b(?:to|in|visiting|visit)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)].map((match) => match[1].toLowerCase());
    return [...new Set([...known, ...named])];
  }
  if (type === "learning") {
    const groups: Array<[RegExp, string[]]> = [
      [/\b(backend|server[- ]side|api|rest|fastapi|python)\b/, ["backend", "server", "api", "rest", "fastapi", "python"]],
      [/\b(math|mathematics|maths)\b/, ["math", "mathematics", "maths"]],
      [/\b(software engineering|programming|coding|computer science)\b/, ["software", "programming", "coding", "computer", "python", "api"]],
      [/\b(javascript|typescript|react|next\.js|nextjs)\b/, ["javascript", "typescript", "react", "next"]],
      [/\b(database|postgres|postgresql|sql)\b/, ["database", "postgres", "postgresql", "sql"]],
    ];
    return [...new Set(groups.filter(([pattern]) => pattern.test(text)).flatMap(([, aliases]) => aliases))];
  }
  return terms(text);
}

function eventSection(memory: Memory): string | null {
  const text = memoryText(memory); const title = titleText(memory);
  if (/\b(cake|cupcake|buttercream|fondant)\b/.test(title)) return "Cake ideas";
  if (/\b(gift|present|wishlist|giftable|gift idea)\b/.test(text)) return "Gift ideas";
  if (/\b(venue|restaurant|cinema|park|event space|party place|outing|attraction)\b/.test(text)) return "Places to go";
  if (/\b(activity|activities|game night|bowling|picnic|experience)\b/.test(text)) return "Activities";
  return null;
}
function travelSection(memory: Memory): string {
  const text = memoryText(memory);
  if (/\b(hotel|stay|accommodation|hostel|resort)\b/.test(text)) return "Stay";
  if (/\b(restaurant|food|eat|cafe|dining|cuisine)\b/.test(text)) return "Food";
  if (/\b(beach|museum|centre|center|attraction|park|landmark|visit|tour|place)\b/.test(text)) return "Places";
  return "Travel tips";
}
function learningSection(memory: Memory): string {
  const text = memoryText(memory);
  if (/\b(practice|exercise|revision|exam|quiz)\b/.test(text)) return "Practice";
  if (/\b(tutorial|course|lesson|guide|how to)\b/.test(text)) return "Tutorials";
  if (/\b(topic|concept|notes?)\b/.test(text)) return "Topics";
  return "Resources";
}

export function gapSections(type: ReadyPackType, items: Array<Pick<ReadyPackItem, "section">>) {
  const sections = new Set(items.map((item) => item.section));
  const expected = type === "travel" ? ["Places", "Food", "Stay", "Travel tips"] : type === "event" ? ["Cake ideas", "Gift ideas", "Places to go", "Activities"] : ["Tutorials", "Topics", "Practice", "Resources"];
  return expected.filter((section) => !sections.has(section));
}

/** Candidates are retrieved only after an intent-specific evidence gate; generic category/slot overlap is never enough. */
export async function matchPackMemories(context: LifeContext, memories: Memory[], type: ReadyPackType) {
  const anchors = subjectAnchors(context, type);
  if ((type === "travel" || type === "learning") && anchors.length === 0) return [];
  const candidates = memories.map((memory) => {
    const content = memoryText(memory); const searchable = titleText(memory);
    const anchorHits = anchors.filter((anchor) => new RegExp(`\\b${anchor.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}s?\\b`, "i").test(content));
    let section: string | null = null;
    if (type === "travel") { if (!anchorHits.length) return null; section = travelSection(memory); }
    else if (type === "learning") { if (!anchorHits.length) return null; section = learningSection(memory); }
    else { section = eventSection(memory); if (!section) return null; }
    const directTitle = anchors.filter((anchor) => new RegExp(`\\b${anchor}s?\\b`, "i").test(searchable)).length;
    const score = (anchorHits.length * 0.32) + (directTitle * 0.12) + (memory.analysisMetadata?.semanticConcepts?.some((item) => item.source === "thumbnail" && anchors.some((anchor) => item.concept.toLowerCase().includes(anchor))) ? 0.08 : 0) + (memory.analysisStatus === "complete" ? 0.02 : 0);
    return { memory, section, score };
  }).filter((item): item is { memory: Memory; section: string; score: number } => Boolean(item));
  const ranked = candidates.sort((a, b) => b.score - a.score || Date.parse(b.memory.createdAt) - Date.parse(a.memory.createdAt) || a.memory.id.localeCompare(b.memory.id));
  const max = type === "event" ? 12 : type === "travel" ? 12 : 10;
  const gated = ranked.slice(0, max);
  return gated.sort((a, b) => b.score - a.score || Date.parse(b.memory.createdAt) - Date.parse(a.memory.createdAt) || a.memory.id.localeCompare(b.memory.id)).map(({ memory, section }) => ({ memory, section, relevanceReason: type === "event" ? `This saved item fits ${section.toLowerCase()}.` : `This Memory shares subject evidence with ${context.title}.`, relevanceStrength: "strong" as const }));
}

export function optionSlice<T>(items: T[], showMore = false) { return items.slice(0, showMore ? 12 : 3); }
export function resolveNaturalSelection(text: string, options: Array<{ id: string; title: string }>) {
  const query = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  if (!query || /\b(none|skip|no thanks|not those)\b/.test(query)) return null;
  const matches = options.filter((option) => { const title = option.title.toLowerCase(); const significant = title.split(/\s+/).filter((word) => word.length > 3); return title.includes(query) || query.split(/\s+/).some((word) => word.length > 3 && significant.includes(word)); });
  return matches.length === 1 ? matches[0].id : null;
}

export function dedupePacks<T extends { id: string; userId: string; lifeContextId: string; status: string; createdAt: string }>(packs: T[]) {
  const seen = new Set<string>();
  return packs.filter((pack) => { if (pack.status !== "active") return true; const key = `${pack.userId}:${pack.lifeContextId}`; if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}
