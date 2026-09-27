import type { AIAnalysisMetadata, LifeContextType } from "@/types/reibry";
import { resolveLifeDateRange } from "./relative-date.ts";

const DATE_WORDS = /\b(?:today|tomorrow|tonight|morning|afternoon|evening|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in\s+\d+\s+(?:days?|weeks?))(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi;
const LEADING = /^(?:i\s+(?:would\s+really\s+like|would\s+like|want|need|have|am\s+planning|am\s+(?:going|travelling|traveling)|will\s+(?:go|travel)|plan|must)\s+to?|my\s+|please)\s+/i;

export function fallbackLifeTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const withoutDate = compact.replace(DATE_WORDS, " ").replace(/[.,!?]+$/g, "").replace(/\s+/g, " ").trim();
  const direct = withoutDate.replace(LEADING, "").replace(/\s+(?:is|are|will be)$/i, "").replace(/^i'm\s+(?:going|travelling|traveling)\s+(?:to\s+)?/i, "").trim() || compact;
  return (direct.charAt(0).toUpperCase() + direct.slice(1)).slice(0, 120);
}

function fallbackLifeType(text: string): LifeContextType {
  const lower = text.toLowerCase();
  if (/\b(deadline|due|submit|exam|interview|presentation)\b/.test(lower)) return "deadline";
  if (/\b(trip|travel|flight|holiday|vacation)\b/.test(lower)) return "trip";
  if (/\b(project)\b/.test(lower)) return "project";
  if (/\b(goal|aim|hope)\b/.test(lower)) return "goal";
  if (/\b(birthday|appointment|meeting|event)\b/.test(lower)) return "event";
  if (/\b(remind|remember to)\b/.test(lower)) return "reminder";
  return "task";
}

export function deterministicLifeFallback(input: { text: string; timezone: string; referenceNow: Date | string }) {
  const dates = resolveLifeDateRange({ startValue: input.text, endValue: null, referenceNow: input.referenceNow, timeZone: input.timezone });
  const metadata: AIAnalysisMetadata = {
    status: "partial",
    confidence: null,
    provider: "deterministic",
    providerUsed: "fallback",
    fallbackReason: "provider_error",
    warnings: ["Life context saved with limited analysis."],
    evidenceSources: [],
  };
  return {
    contexts: [{
      type: fallbackLifeType(input.text),
      title: fallbackLifeTitle(input.text),
      description: input.text,
      startDate: dates.startDate,
      endDate: dates.endDate,
      status: "active" as const,
      confidence: null,
    }],
    metadata,
  };
}
