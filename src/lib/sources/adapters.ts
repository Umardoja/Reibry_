import type { SourceEvidence } from "@/types/reibry";
import { IntegrationError } from "../integration/errors.ts";
import { enrichCapture } from "./enrichment.ts";
import { normalizeSharedPayload } from "../share/payload.ts";
import { canonicalizeTikTokCapture } from "./tiktok.ts";

export type CaptureRequest = { sourceType?: string; sourceUrl?: string; rawText?: string; title?: string; imageReference?: string };
export type NormalizedCapture = { sourceType: "link" | "social_post" | "video" | "article" | "screenshot" | "document" | "text"; sourceUrl?: string; rawText?: string; title?: string; evidence: SourceEvidence[] };
export interface SourceAdapter { supports(input: CaptureRequest): boolean; normalize(input: CaptureRequest): Promise<NormalizedCapture>; }

function inferUrlInput(input: CaptureRequest): CaptureRequest {
  const shared = normalizeSharedPayload({ url: input.sourceUrl, text: input.rawText, title: input.title });
  return shared.url ? { ...input, sourceType: input.sourceType === "text" ? "link" : input.sourceType, sourceUrl: shared.url, rawText: shared.text, title: shared.title } : input;
}

function hasHost(input: CaptureRequest, hosts: string[]) {
  if (!input.sourceUrl) return false;
  try {
    const hostname = new URL(input.sourceUrl).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch { return false; }
}

const platform = (name: string, hosts: string[]): SourceAdapter => ({
  supports: (input) => hasHost(input, hosts),
  async normalize(input) {
    return { sourceType: "social_post", sourceUrl: input.sourceUrl, rawText: input.rawText, title: input.title, evidence: [{ title: input.title, caption: input.rawText, mediaUrl: input.sourceUrl, platform: name, sourceQuality: "low" }] };
  },
});

export const sourceAdapters: SourceAdapter[] = [
  platform("tiktok", ["tiktok.com"]),
  platform("youtube", ["youtube.com", "youtu.be"]),
  platform("instagram", ["instagram.com"]),
  { supports: (input) => Boolean(input.sourceUrl), async normalize(input) { return { sourceType: (input.sourceType && input.sourceType !== "text" ? input.sourceType : "link") as NormalizedCapture["sourceType"], sourceUrl: input.sourceUrl, rawText: input.rawText, title: input.title, evidence: [{ title: input.title, caption: input.rawText, mediaUrl: input.sourceUrl, sourceQuality: "unknown" }] }; } },
  { supports: (input) => Boolean(input.imageReference), async normalize(input) { return { sourceType: "screenshot", title: input.title, evidence: [{ thumbnail: input.imageReference, sourceQuality: "unknown" }] }; } },
  { supports: (input) => Boolean(input.rawText), async normalize(input) { return { sourceType: "text", rawText: input.rawText, title: input.title, evidence: [{ caption: input.rawText, sourceQuality: "medium" }] }; } },
];

export async function normalizeCaptureBase(input: CaptureRequest) {
  const normalizedInput = inferUrlInput(input);
  const adapter = sourceAdapters.find((candidate) => candidate.supports(normalizedInput));
  if (!adapter) throw new IntegrationError("SOURCE_UNAVAILABLE", "No supported source was supplied.");
  try { return await adapter.normalize(normalizedInput); }
  catch { throw new IntegrationError("SOURCE_UNAVAILABLE", "Source evidence was unavailable."); }
}

export async function normalizeCapture(input: CaptureRequest) {
  return enrichCapture(await canonicalizeTikTokCapture(await normalizeCaptureBase(input)));
}
