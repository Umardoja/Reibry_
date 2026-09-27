# NVIDIA AI provider

## Temporary Gemini provider

For development when NVIDIA access is unavailable, set `AI_PROVIDER=gemini` and provide the server-only `GEMINI_API_KEY`. The optional `GEMINI_MODEL` defaults to `gemini-2.5-flash-lite`; `GEMINI_REQUEST_TIMEOUT_MS` is bounded like other provider requests. Gemini implements the same reasoning contract for Memory analysis, Life parsing, Context relevance, and Action proposals. Embeddings remain the existing deterministic 2048-dimensional implementation, so no vector migration is required. With `AI_ALLOW_MOCK_FALLBACK=true`, transient Gemini/provider or structured-output failures use the existing mock fallback; set it to `false` for strict Gemini checks. Keys are never exposed through `NEXT_PUBLIC_*` variables.

Set `AI_PROVIDER=mock` for deterministic local development or `AI_PROVIDER=nvidia` to activate the server-only provider. Set `NVIDIA_API_KEY` only in server environment variables; never expose it to browser code.

Defaults:

- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` for future multimodal evidence analysis.
- `nvidia/nemotron-3.5-lightning-30b-a3b` for structured reasoning, Life parsing, and action proposals.
- `nvidia/nemotron-3-embed-1b` for embeddings, validated at exactly 2048 dimensions.

The provider is implemented in `src/lib/ai/nvidia/` and is selected centrally by `activeAI()` in `src/lib/integration/mock.ts`. The existing interfaces remain stable: `AIService` in `src/lib/ai/service.ts`, `RetrievalService` in `src/lib/retrieval/service.ts`, `ContextService` in `src/lib/context/service.ts`, and `ActionService` in `src/lib/actions/service.ts`.

Requests use `https://integrate.api.nvidia.com/v1`, use the configured request timeout (60 seconds by default, or `NVIDIA_STRUCTURED_TIMEOUT_MS` when set), with at most two total attempts, map rate limits and unavailable responses to integration errors, and validate structured JSON and embedding dimensions. Prompts require evidence-grounded output; weak or missing evidence must produce partial/low-confidence output rather than invented facts. No external actions execute automatically.

Memory and LifeContext embeddings are generated after successful analysis/parsing and written through the existing Store embedding hooks. In NVIDIA mode an embedding failure returns `AI_UNAVAILABLE` after the record has been created, leaving no vector write; mock mode continues without requiring NVIDIA. Apply the additive migration `supabase/migrations/20260920000002_vector_search.sql` to install the authenticated-user-scoped exact pgvector search RPC. It uses cosine similarity and does not add an ANN index.

Run local verification with `npm run verify:nvidia`. The script reports reachability and embedding dimensions without printing credentials or response tokens.

## Multimodal evidence

The Omni provider is `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`. Evidence with an image, thumbnail, supplied frame, directly accessible MP4, or WAV/MP3 media URL routes to Omni. Text-only and metadata-only evidence continue through the existing structured text reasoning model. The public `AIService` and Memory-analysis contract do not change.

Supported image inputs are public JPEG, PNG, WebP, or GIF URLs and supported image data URLs. Supplied frames are bounded to eight items. Direct MP4, WAV, and MP3 evidence is accepted when its URL, MIME type, and optional duration are present; MP4 evidence over ten minutes is rejected. Server-side fetching, FFmpeg execution, automatic frame extraction, and transcription are deferred. Frames and transcripts already supplied by a source adapter are fused without requiring manual screenshots.

Multimodal prompts require grounding in supplied evidence only. They prohibit invented events, dialogue, people, preferences, or claims that a video was watched when only metadata or frames were supplied. Evidence sources record the modality actually used. If Omni fails and useful caption, title, transcript, or metadata text exists, text analysis is retried and the result is marked partial with reduced confidence and an explicit warning. Unsupported media, private-network URLs, and excessive frame counts are rejected rather than silently downgraded.

The source-adapter boundary remains unchanged: adapters determine which public metadata or media can be safely supplied, while the AI layer only interprets that evidence. No TikTok, Instagram, or other protected-media scraping, session-cookie bypass, or anti-bot workaround is implemented. HTTP/HTTPS URLs are checked against localhost/private-network targets, supported MIME/extensions are allowlisted, and no shell commands or temporary media files are used.

`npm run verify:nvidia` performs live text and image checks using the same app provider and a public non-personal image fixture. Video and audio checks are reported as skipped until explicit fixtures are configured; they are never reported as passing without a live request.


Strict verification sets AI_ALLOW_MOCK_FALLBACK=false; NVIDIA failures then propagate instead of being reported as mock-backed success. Hosted latency can vary significantly, and a stalled request may consume the configured timeout and one retry. Core text analysis, embeddings, vector retrieval, relevance, action proposals, and supplied-evidence multimodal analysis are implemented. TikTok/Instagram extraction and automatic video frame extraction remain deferred.
## Verification modes

Strict verification mode proves real NVIDIA execution:

```bash
AI_PROVIDER=nvidia
AI_ALLOW_MOCK_FALLBACK=false
```

Demo resilience mode keeps the product usable during temporary hosted-provider failures:

```bash
AI_PROVIDER=nvidia
AI_ALLOW_MOCK_FALLBACK=true
```

In resilience mode the application first attempts NVIDIA, then uses the documented deterministic fallback only after the existing timeout/retry policy is exhausted. Analysis metadata records `providerUsed: "fallback"` and a normalized `fallbackReason`; fallback output is never represented as NVIDIA output. Strict mode propagates the provider error instead.

No database or API schema change is required for this provenance; it is retained in existing analysis metadata. Hosted NVIDIA latency remains variable. Core text analysis, embeddings, vector retrieval, relevance, and action proposals are implemented. Multimodal analysis, social media extraction, and automatic video/audio frame extraction remain deferred.
