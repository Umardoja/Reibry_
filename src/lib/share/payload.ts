/** Shared by the Android receiver, composer and server normalization. No browser APIs. */
export type SharedPayload = { title?: string; text?: string; url?: string };
export function publicShareUrl(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return;
    return url.toString();
  } catch { return; }
}
export function normalizeSharedPayload(input: SharedPayload): SharedPayload {
  const title = input.title?.trim().slice(0, 300) || undefined;
  const text = input.text?.trim().slice(0, 20000) || undefined;
  const embedded = text?.match(/https?:\/\/[^\s<>"“”]+/i)?.[0]?.replace(/[.,!?;:)]+$/, "");
  const url = publicShareUrl(input.url) || publicShareUrl(embedded);
  // Keep captions, including their original embedded URL; never turn a caption into a URL.
  return { title, text: text === url ? undefined : text, url };
}
export function capturePayload(value: string) {
  const shared = normalizeSharedPayload({ text: value });
  return shared.url
    ? { sourceType: "link" as const, sourceUrl: shared.url, rawText: shared.text }
    : { sourceType: "text" as const, rawText: value.trim() };
}
