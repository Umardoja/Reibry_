import type { Memory } from "@/types/reibry";
import type { NormalizedCapture } from "./adapters";
import { canonicalizeTikTokCapture } from "./tiktok.ts";
import { captureDedupeKey } from "../integration/dedupe.ts";

/** Cheap exact lookup first; resolve only TikTok short links before the second owned lookup. */
export async function prepareCaptureSource(
  input: NormalizedCapture,
  find: (key: string) => Promise<Memory | null>,
  canonicalize = canonicalizeTikTokCapture,
) {
  const originalKey = captureDedupeKey(input);
  const existing = await find(originalKey);
  if (existing) return { normalized: input, dedupeKey: originalKey, existing };
  const normalized = await canonicalize(input);
  const dedupeKey = captureDedupeKey(normalized);
  return { normalized, dedupeKey, existing: dedupeKey === originalKey ? null : await find(dedupeKey) };
}
export function sourceAnalysisStatus(input: NormalizedCapture, status: Memory["analysisStatus"]): Memory["analysisStatus"] {
  const meaningful = !input.sourceUrl || Boolean(input.rawText || input.title || input.evidence.some((item) => item.title || item.caption || item.author || item.transcript));
  return meaningful ? status : "partial";
}
