# API contracts

All endpoints accept POST with `Content-Type: application/json` and Supabase SSR session cookies. Do not send `userId`; identity comes from verified claims. Unknown fields fail validation. IDs are UUIDs. Text is trimmed, nonempty, and at most 20,000 characters unless stated otherwise.

Success envelope (future implementation): `{"data": <typed result>, "error": null}`.

Error envelope:

```json
{"data":null,"error":{"code":"VALIDATION_ERROR","message":"Request validation failed.","details":[{"path":"memoryId","message":"Invalid UUID"}]}}
```

`details` appears only when helpful for validation. Responses use `Cache-Control: no-store`. No provider messages, secrets, or stack traces are exposed.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_JSON | Malformed JSON |
| 400 | VALIDATION_ERROR | Invalid body or extra fields |
| 401 | UNAUTHENTICATED | Missing/invalid verified session |
| 415 | UNSUPPORTED_MEDIA_TYPE | Use application/json |
| 501 | NOT_IMPLEMENTED | Valid authenticated request reached a placeholder service |
| 503 | CONFIGURATION_ERROR | Supabase URL/public key missing or invalid |
| 500 | INTERNAL_ERROR | Unexpected failure, sanitized |

Validation precedes configuration/authentication. Every endpoint is a stub and performs no persistence or AI work. Success shapes below are integration contracts, not currently returned responses. Next.js handles unsupported HTTP methods with 405 outside this POST envelope.

## POST /api/capture

```json
{"sourceType":"link","sourceUrl":"https://example.com/article","title":"Optional title"}
```

`sourceType`: link | social_post | video | article | screenshot | document | text. Supply at least one of `sourceUrl` (HTTP/HTTPS) or `rawText`. Optional title: 1–300 characters. Future result: `{ memory: Memory }`. No URL is fetched, and file uploads are not part of this contract.

## POST /api/memory/analyze

```json
{"memoryId":"123e4567-e89b-42d3-a456-426614174000"}
```

Future result: `{ memory: Memory, metadata: AIAnalysisMetadata }`. Integrator loads an owned record; Person 2 analyzes content and evidence. Partial analysis is an explicit state, not fabricated completeness.

## POST /api/memory/search

```json
{"query":"recipes for a weekend trip","limit":10}
```

`limit`: optional integer 1–50, default 10. Future result: `{ results: Array<{ memory: Memory, similarity: number }> }`. Only owned memories; similarity is cosine similarity in [-1, 1]. Person 2 supplies retrieval.

## POST /api/life/parse

```json
{"text":"I am travelling next Friday","timezone":"Africa/Lagos"}
```

`timezone`: optional valid IANA timezone, default UTC. Future result: `{ contexts: Array<Omit<LifeContext, "id" | "userId" | "createdAt" | "updatedAt">>, metadata: AIAnalysisMetadata }`. Parsing proposes context drafts without saving them. Dates are ISO 8601 instants or null; the future parser must account for the supplied timezone and current time.

## POST /api/context/match

```json
{"lifeContextId":"123e4567-e89b-42d3-a456-426614174000"}
```

Optional `memoryIds`: 1–100 UUIDs; omitted means consider owned memories. Future result: `{ matches: ContextMatch[] }`. Person 1 orchestrates matching using Person 2's retrieval/reasoning. All referenced IDs must be ownership-checked during implementation.

## POST /api/actions

```json
{"type":"checklist","memoryId":"123e4567-e89b-42d3-a456-426614174000"}
```

`type`: shopping_list | revision_plan | itinerary | checklist | reminder. At least one of `memoryId`, `lifeContextId`, or `matchId` is required. Future result: `{ action: SuggestedAction }`. This generates a proposal; it does not schedule, purchase, or send anything. Integrator must ensure any supplied match and other IDs describe the same context before persistence.

Canonical types: `src/types/reibry.ts`. Runtime request schemas and exported inferred request types: `src/lib/api/contracts.ts`. Provider-independent interfaces: `src/lib/ai/service.ts`, `src/lib/retrieval/service.ts`, `src/lib/context/service.ts`, `src/lib/actions/service.ts`.
