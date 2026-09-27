import type { AIAnalysisMetadata, Memory, SourceEvidence } from "@/types/reibry.ts";
import { IntegrationError } from "../../integration/errors.ts";
import { nvidiaConfig } from "./config.ts";
import { json, memoryOutput } from "./reasoning.ts";
import { nvidiaRequest } from "./client.ts";
import { NvidiaDiagnosticError, logNvidiaFailure } from "./errors.ts";

const maxMediaItems = 8;
const maxVideoDurationSeconds = 600;
const imageExtensions = /\.(?:jpe?g|png|webp|gif)(?:\?.*)?$/i;
const videoExtensions = /\.(?:mp4)(?:\?.*)?$/i;
const audioExtensions = /\.(?:wav|mp3)(?:\?.*)?$/i;

type MediaKind = "image" | "video" | "audio" | "frame";
type MediaItem = { kind: MediaKind; url: string; evidence: SourceEvidence };

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\.|^192\.168\.|^169\.254\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

export function validateMediaUrl(value: string, kind: MediaKind, mimeType?: string): string {
  if (value.startsWith("data:")) {
    const prefix = value.slice(0, value.indexOf(","));
    if (kind === "image" || kind === "frame") {
      if (!/^data:image\/(?:jpeg|jpg|png|webp|gif);base64$/i.test(prefix)) throw new IntegrationError("SOURCE_UNAVAILABLE", "Unsupported image data URL.");
    } else if (kind === "audio") {
      if (!/^data:audio\/(?:wav|mpeg|mp3);base64$/i.test(prefix)) throw new IntegrationError("SOURCE_UNAVAILABLE", "Unsupported audio data URL.");
    } else {
      throw new IntegrationError("SOURCE_UNAVAILABLE", "Video data URLs are not supported.");
    }
    return value;
  }

  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new IntegrationError("SOURCE_UNAVAILABLE", "Media URL is invalid."); }
  if (!(["http:", "https:"].includes(parsed.protocol)) || isPrivateHostname(parsed.hostname)) {
    throw new IntegrationError("SOURCE_UNAVAILABLE", "Media URL must be a public HTTP or HTTPS URL.");
  }
  const pathname = parsed.pathname.toLowerCase();
  const mimeSupported = kind === "image" || kind === "frame" ? mimeType?.toLowerCase().startsWith("image/") : kind === "video" ? mimeType?.toLowerCase().startsWith("video/") : mimeType?.toLowerCase().startsWith("audio/");
  const supported = mimeSupported || (kind === "image" || kind === "frame" ? imageExtensions.test(pathname) : kind === "video" ? videoExtensions.test(pathname) : audioExtensions.test(pathname));
  if (!supported) throw new IntegrationError("SOURCE_UNAVAILABLE", `Unsupported ${kind} media URL.`);
  return parsed.toString();
}

function mediaKind(evidence: SourceEvidence, value: string, fallback: MediaKind): MediaKind | null {
  const mime = evidence.mimeType?.toLowerCase() || "";
  if (evidence.modality === fallback || (fallback === "image" && evidence.modality === "frame")) return fallback;
  if (mime.startsWith("image/")) return fallback === "video" || fallback === "audio" ? null : fallback;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (imageExtensions.test(value)) return fallback === "video" || fallback === "audio" ? null : fallback;
  if (videoExtensions.test(value)) return "video";
  if (audioExtensions.test(value)) return "audio";
  return null;
}

function collectMedia(evidence: SourceEvidence[]): MediaItem[] {
  const items: MediaItem[] = [];
  for (const source of evidence) {
    if (source.thumbnail) {
      const kind = mediaKind(source, source.thumbnail, "image");
      if (kind) items.push({ kind, url: validateMediaUrl(source.thumbnail, kind, source.mimeType), evidence: source });
    }
    if (source.mediaUrl) {
      const kind = mediaKind(source, source.mediaUrl, source.modality === "video" ? "video" : source.modality === "audio" ? "audio" : "image");
      if (kind) items.push({ kind, url: validateMediaUrl(source.mediaUrl, kind, source.mimeType), evidence: source });
    }
    for (const frame of source.frames || []) {
      if (!frame.imageUrl) continue;
      items.push({ kind: "frame", url: validateMediaUrl(frame.imageUrl, "frame", "image/*"), evidence: { ...source, modality: "frame", title: frame.description || source.title } });
    }
  }
  if (items.length > maxMediaItems) throw new IntegrationError("SOURCE_UNAVAILABLE", `At most ${maxMediaItems} media items are supported.`);
  for (const item of items) {
    if (item.kind === "video" && item.evidence.durationSeconds !== undefined && item.evidence.durationSeconds > maxVideoDurationSeconds) {
      throw new IntegrationError("SOURCE_UNAVAILABLE", "Video evidence exceeds the supported duration.");
    }
  }
  return items;
}

function textEvidence(evidence: SourceEvidence[]): string {
  return evidence.map((source) => [source.title, source.caption, source.transcript, ...(source.onScreenText || []), source.author, source.platform].filter(Boolean).join("\n")).filter(Boolean).join("\n\n").slice(0, 20000);
}

export function hasUsefulMultimodalEvidence(evidence: SourceEvidence[]): boolean {
  return collectMedia(evidence).length > 0;
}

export function hasUsefulTextEvidence(evidence: SourceEvidence[]): boolean {
  return textEvidence(evidence).trim().length > 0;
}

function annotateEvidence(evidence: SourceEvidence[], media: MediaItem[]): SourceEvidence[] {
  return evidence.map((source) => ({
    ...source,
    modality: source.modality || (media.some((item) => item.evidence === source && item.kind === "video") ? "video" : media.some((item) => item.evidence === source && item.kind === "audio") ? "audio" : media.some((item) => item.evidence === source) ? "image" : hasUsefulTextEvidence([source]) ? "text" : "metadata"),
  }));
}

function contentFor(media: MediaItem[]): Record<string, unknown>[] {
  return media.map((item) => item.kind === "video"
    ? { type: "video_url", video_url: { url: item.url } }
    : item.kind === "audio"
      ? { type: "audio_url", audio_url: { url: item.url } }
      : { type: "image_url", image_url: { url: item.url } });
}

function metadata(confidence: number | null, evidence: SourceEvidence[], warnings: string[]): AIAnalysisMetadata {
  return { status: confidence === null ? "partial" : "complete", confidence, provider: "nvidia-omni", model: nvidiaConfig().multimodalModel, warnings, evidenceSources: evidence };
}

export async function analyzeMultimodal(memory: Memory, evidence: SourceEvidence[]) {
  const media = collectMedia(evidence);
  if (!media.length) throw new IntegrationError("SOURCE_UNAVAILABLE", "No supported multimodal evidence was supplied.");
  const usedEvidence = annotateEvidence(evidence, media);
  const prompt = JSON.stringify({
    task: "analyze supplied multimodal memory evidence",
    memoryTitle: memory.title,
    evidenceText: textEvidence(evidence),
    grounding: [
      "Use only supplied text, images, frames, video, or audio.",
      "Do not invent unseen events, dialogue, people, preferences, or facts.",
      "Do not claim video was watched if only frames or metadata were supplied.",
      "Return confidence from 0 to 1 and preserve uncertainty.",
    ],
    outputShape: "{title,summary,category,tags,entities,possibleIntents,possibleActions,confidence}",
  });
  let response: unknown;
  try {
    response = await nvidiaRequest("/chat/completions", {
    model: nvidiaConfig().multimodalModel,
    temperature: 0,
    max_tokens: 768,
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return JSON only. Ground every claim in supplied evidence. Never invent facts." },
      { role: "user", content: [{ type: "text", text: prompt }, ...contentFor(media)] },
    ],
    }, "multimodal-analysis");
  } catch (error) {
    logNvidiaFailure("multimodal-analysis", "provider-request", error);
    throw error;
  }
  try {
    const result = memoryOutput.parse(json(response, "multimodal-analysis"));
    return { memory: result, metadata: metadata(typeof result.confidence === "number" ? result.confidence : null, usedEvidence, []) };
  } catch (error) {
    logNvidiaFailure("multimodal-analysis", error instanceof NvidiaDiagnosticError ? "json-parse" : "schema-validation", error);
    if (error instanceof NvidiaDiagnosticError) throw error;
    throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA multimodal analysis output failed schema validation.");
  }
}

export function failedMultimodalAnalysis(memory: Memory, evidence: SourceEvidence[], warning: string) {
  return {
    memory: { title: memory.title, summary: null, tags: [], entities: [], possibleIntents: [], possibleActions: [] },
    metadata: metadata(null, annotateEvidence(evidence, []), [warning]),
  };
}