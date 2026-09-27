import type { AIService } from "../ai/service.ts";
import type { NormalizedCapture } from "../sources/adapters.ts";
import { deriveCategory, deriveTags, evidenceText } from "../sources/enrichment.ts";
import { conciseSourceTitle } from "./title.ts";

function excerpt(value: string, limit: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > limit ? clean.slice(0, limit - 1).trimEnd() + "…" : clean;
}

export function sourceDerivedSummary(value: string, title: string, category: string) {
  const clean = excerpt(value, 420);
  if (category === "Food & Cooking" && /\b(recipe|cake|bake|baking|ingredients?)\b/i.test(clean)) {
    const subject = /\bvanilla\b/i.test(clean) ? "vanilla cake" : /\bcake\b/i.test(clean) ? "cake" : "recipe";
    const details = /\b\d+(?:\.\d+)?\s*(?:g|kg|ml|cups?|tbsp|tsp)\b/i.test(clean) ? " with ingredient quantities" : "";
    return `A ${subject} recipe${details}, saved from the original source.`;
  }
  const withoutTitle = clean.toLowerCase().startsWith(title.toLowerCase()) ? clean.slice(title.length).replace(/^\s*[-:–—.]\s*/, "") : clean;
  return excerpt(withoutTitle || clean, 280);
}

export async function analyzeOrPreserve(source: NormalizedCapture, analyze: () => ReturnType<AIService["analyze"]>) {
  try { return { result: await analyze(), preserved: false }; }
  catch {
    if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview") console.warn("[capture] source-preserved", { status: "partial" });
    return { result: sourcePreservation(source), preserved: true };
  }
}

/** Source preservation is not mock analysis. Original evidence remains unabridged. */
export function sourcePreservation(source: NormalizedCapture): Awaited<ReturnType<AIService["analyze"]>> {
  const title = source.evidence.find((item) => item.title?.trim())?.title || source.title;
  const caption = source.evidence.find((item) => item.caption?.trim())?.caption || source.rawText;
  const platform = source.evidence.find((item) => item.platform)?.platform;
  const allEvidence = evidenceText(source.evidence, source.rawText, source.title);
  const category = deriveCategory(allEvidence);
  const safeTitle = conciseSourceTitle(title || caption || (platform ? `Saved ${platform} link` : "Saved source"));
  return {
    memory: {
      title: safeTitle,
      summary: caption ? sourceDerivedSummary(caption, safeTitle, category) : title ? sourceDerivedSummary(title, safeTitle, category) : null,
      category, tags: [...new Set([...deriveTags(allEvidence), ...(platform ? [platform.toLowerCase()] : [])])].slice(0, 8),
      entities: [], possibleIntents: [], possibleActions: [],
    },
    metadata: { status: "partial", confidence: null, provider: "source-preservation", providerUsed: "fallback",
      warnings: ["Original source saved without AI analysis."], evidenceSources: source.evidence },
  };
}
