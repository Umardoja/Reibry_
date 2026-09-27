import test from "node:test";
import assert from "node:assert/strict";
import { canonicalTikTokUrl, tiktokUrl } from "../src/lib/sources/tiktok-url.ts";
import { resolveTikTokUrl, enrichTikTok, canonicalizeTikTokCapture, publicAddress, type TikTokRequest } from "../src/lib/sources/tiktok.ts";
import { captureDedupeKey } from "../src/lib/integration/dedupe.ts";
import { normalizeCaptureBase } from "../src/lib/sources/adapters.ts";
import { sourceEvidence } from "../src/lib/integration/schemas.ts";
import { prepareCaptureSource, sourceAnalysisStatus } from "../src/lib/sources/prepare-capture.ts";
import type { Memory } from "../src/types/reibry.ts";
const video = "https://www.tiktok.com/@creator/video/1234567890";
const short = "https://vm.tiktok.com/ZExample/";
test("TikTok canonical and short forms are recognized; deceptive hosts and protocols rejected", () => {
  for (const url of [video, short, "https://vt.tiktok.com/ZExample/", "https://www.tiktok.com/t/ZExample/"]) assert.ok(tiktokUrl(url));
  for (const url of ["http://vm.tiktok.com/a", "https://www.tiktok.com.evil.example/a", "https://user@vm.tiktok.com/a", "https://vm.tiktok.com:444/a", "https://127.0.0.1/a"]) assert.equal(tiktokUrl(url), null);
  assert.equal(canonicalTikTokUrl(video + "?is_from_webapp=1#x"), video);
});
test("TikTok short resolver follows only bounded manually validated hops", async () => {
  const seen: string[] = [];
  const fetcher: TikTokRequest = async (url, options) => { seen.push(url); assert.equal(options.redirect, "manual"); assert.equal(options.readBody, false); return { status: 302, location: seen.length === 1 ? "https://www.tiktok.com/t/middle/" : video, body: "" }; };
  assert.equal(await resolveTikTokUrl(short, fetcher), video); assert.equal(seen.length, 2);
});
test("TikTok resolver rejects external and private redirect destinations without requesting them", async () => {
  for (const location of ["https://example.com/video", "https://localhost/video", "https://127.0.0.1/video", "http://www.tiktok.com/@a/video/1"]) {
    let calls = 0; const fetcher: TikTokRequest = async () => { calls++; return { status: 302, location, body: "" }; };
    assert.equal(await resolveTikTokUrl(short, fetcher), null); assert.equal(calls, 1);
  }
});
test("TikTok redirect loops stop at three hops", async () => {
  let calls = 0; const fetcher: TikTokRequest = async () => { calls++; return { status: 302, location: short, body: "" }; };
  assert.equal(await resolveTikTokUrl(short, fetcher), null); assert.equal(calls, 3);
});
test("TikTok metadata has bounded timeouts", async () => {
  const hanging: TikTokRequest = async () => new Promise(() => {});
  assert.equal(await resolveTikTokUrl(short, hanging, 10), null);
});
test("TikTok DNS policy rejects loopback, private, link-local, mapped IPv6 and multicast", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1"]) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true); assert.equal(publicAddress("2606:4700:4700::1111"), true);
});
test("TikTok oEmbed maps public metadata and preserves the original caption/URL", async () => {
  const base = await normalizeCaptureBase({ rawText: `A programming tutorial ${short}` });
  assert.equal(base.sourceType, "social_post");
  const normalized = await canonicalizeTikTokCapture(base, async () => ({ status: 302, location: video, body: "" }));
  const result = await enrichTikTok(normalized, async (url, options) => {
    assert.equal(url, `https://www.tiktok.com/oembed?url=${encodeURIComponent(video)}`); assert.equal(options.redirect, "manual");
    return { status: 200, contentType: "application/json", body: JSON.stringify({ title: "Learn asynchronous programming", author_name: "Creator", author_url: "https://www.tiktok.com/@creator", thumbnail_url: "https://cdn.tiktok.com/thumb.jpg", provider_name: "TikTok", html: "<script>not executed</script>" }) };
  });
  assert.equal(result.title, "Learn asynchronous programming"); assert.equal(result.evidence[0].platform, "tiktok");
  assert.equal(result.evidence[0].mediaUrl, short); assert.equal(result.evidence[0].canonicalUrl, video);
  assert.equal(result.evidence[0].caption, `A programming tutorial ${short}`);
  assert.equal(result.evidence[0].author, "Creator"); assert.equal(result.evidence[0].metadataSource, "tiktok-oembed");
  assert.ok(sourceEvidence.safeParse(result.evidence[0]).success);
});
test("TikTok oEmbed error or malformed body preserves limited evidence without failing Capture", async () => {
  const base = await normalizeCaptureBase({ sourceUrl: video, rawText: "Shared caption" });
  for (const reply of [{ status: 503, body: "" }, { status: 200, contentType: "application/json", body: "invalid" }]) assert.deepEqual(await enrichTikTok(base, async () => reply), base);
  assert.equal(base.evidence[0].sourceQuality, "low");
});
test("resolved short, canonical, tracking and fragment variants have the same dedupe key", async () => {
  const input = await normalizeCaptureBase({ sourceUrl: short });
  const normalized = await canonicalizeTikTokCapture(input, async () => ({ status: 302, location: video + "?tracking=abc#x", body: "" }));
  assert.equal(captureDedupeKey(normalized), captureDedupeKey({ sourceUrl: video }));
  assert.equal(captureDedupeKey({ sourceUrl: video + "?is_from_webapp=1#x" }), captureDedupeKey({ sourceUrl: video }));
});
test("canonical TikTok URL needs no redirect network call", async () => {
  let calls = 0; assert.equal(await resolveTikTokUrl(video, async () => { calls++; throw new Error(); }), video); assert.equal(calls, 0);
});
test("owned canonical duplicate returns existing Memory before oEmbed or AI processing", async () => {
  const input = await normalizeCaptureBase({ sourceUrl: short });
  const memory = { id: "saved-memory" } as Memory;
  const keys: string[] = [];
  const prepared = await prepareCaptureSource(input, async (key) => { keys.push(key); return key === captureDedupeKey({ sourceUrl: video }) ? memory : null; }, (base) => canonicalizeTikTokCapture(base, async () => ({ status: 302, location: video, body: "" })));
  assert.equal(prepared.existing?.id, "saved-memory"); assert.equal(keys.length, 2);
  assert.equal(prepared.dedupeKey, captureDedupeKey({ sourceUrl: video }));
});
test("an exact existing URL skips even short-link resolution", async () => {
  const input = await normalizeCaptureBase({ sourceUrl: short });
  let resolutions = 0;
  const prepared = await prepareCaptureSource(input, async () => ({ id: "existing" } as Memory), async (base) => { resolutions++; return base; });
  assert.equal(prepared.existing?.id, "existing"); assert.equal(resolutions, 0);
});
test("failed TikTok enrichment finalizes successful limited analysis as partial", async () => {
  const input = await normalizeCaptureBase({ sourceUrl: video });
  const limited = await enrichTikTok(input, async () => ({ status: 503, body: "" }));
  assert.equal(sourceAnalysisStatus(limited, "complete"), "partial");
  assert.equal(sourceAnalysisStatus({ ...limited, rawText: "A useful shared description" }, "complete"), "complete");
});
