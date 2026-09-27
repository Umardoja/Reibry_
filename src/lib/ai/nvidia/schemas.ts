import { z } from "zod";
import { vector } from "../../integration/schemas.ts";
export const embeddingResponse = z.object({ data: z.array(z.object({ embedding: z.array(z.number()) })) });
export function validateEmbedding(value: unknown) { return vector.parse(value); }
