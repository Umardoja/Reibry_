import type { LifeContext, Memory } from "../../../types/reibry.ts";
import { nvidiaRequest } from "./client.ts";
import { nvidiaConfig } from "./config.ts";
import { embeddingResponse, validateEmbedding } from "./schemas.ts";

const textMemory = (m: Memory) => [m.title, m.summary, m.category, m.tags.join(" "), m.entities.map((e) => e.name).join(" "), m.possibleIntents.join(" ")].filter(Boolean).join("\n");
const textLife = (c: LifeContext) => [c.type, c.title, c.description, c.startDate, c.endDate].filter(Boolean).join("\n");

export async function embedQuery(text: string) { return embedText(text); }
export async function embedMemory(m: Memory) { return embedText(textMemory(m)); }
export async function embedLifeContext(c: LifeContext) { return embedText(textLife(c)); }

async function embedText(input: string) {
  const { embeddingModel } = nvidiaConfig();
  const parsed = embeddingResponse.parse(await nvidiaRequest("/embeddings", { model: embeddingModel, input, encoding_format: "float" }, "embedding"));
  return validateEmbedding(parsed.data[0]?.embedding);
}
