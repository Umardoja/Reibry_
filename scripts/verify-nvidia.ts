import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { nvidiaAI } from "../src/lib/ai/nvidia/service.ts";
import { analyzeMemory } from "../src/lib/ai/nvidia/reasoning.ts";
import { analyzeMultimodal } from "../src/lib/ai/nvidia/multimodal.ts";
import { parseLife, evaluateRelevance, generateAction } from "../src/lib/ai/nvidia/reasoning.ts";
import { embedMemory, embedLifeContext } from "../src/lib/ai/nvidia/embeddings.ts";
import { nvidiaConfig } from "../src/lib/ai/nvidia/config.ts";
import { formatCheck, runCheck, runImageCheck, type CheckResult } from "./verify-nvidia-runner.ts";
import type { Memory } from "../src/types/reibry.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) { const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (!match || process.env[match[1]]) continue; let value = match[2].trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1); process.env[match[1]] = value; }
const memory: Memory = { id: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", title: "Red Velvet Cake Tutorial", summary: "Red Velvet Cake Tutorial recipe for birthday celebration", category: null, tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: "Red Velvet Cake Tutorial recipe for birthday celebration", possibleIntents: [], possibleActions: [], analysisStatus: "processing", confidence: null, evidenceSources: [], analysisMetadata: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
const life = { id: memory.id, userId: memory.userId, type: "event" as const, title: "Mum's Birthday celebration", description: "Mum's Birthday celebration", startDate: null, endDate: null, status: "active" as const, confidence: 0.8, createdAt: memory.createdAt, updatedAt: memory.updatedAt };
const textEvidence = [{ title: memory.rawText ?? undefined, sourceQuality: "high" as const, platform: "text", modality: "text" as const }];
const imageEvidence = [{ thumbnail: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg", caption: "A public landscape test fixture", modality: "image" as const, mimeType: "image/jpeg", sourceQuality: "high" as const }];
const results: CheckResult[] = [];
let analyzedMemory: Memory = memory;

if (!process.env.NVIDIA_API_KEY) {
  console.log(["REIBRY NVIDIA Verification", "", "Environment ................. BLOCKED (NVIDIA_API_KEY missing)"].join("\n"));
  process.exitCode = 1;
} else {
  results.push(await runCheck("Memory Analysis", async () => { const result = await nvidiaAI.analyze({ memory, evidence: textEvidence }); analyzedMemory = { ...memory, ...result.memory }; }));
  results.push(await runCheck("Memory Embedding", async () => { const vector = await embedMemory(analyzedMemory); if (vector.length !== 2048) throw new Error("Embedding dimension mismatch."); }));
  results.push(await runCheck("Life Parsing", async () => { await parseLife(life.description, "UTC"); }));
  results.push(await runCheck("Life Embedding", async () => { const vector = await embedLifeContext(life); if (vector.length !== 2048) throw new Error("Embedding dimension mismatch."); }));
  results.push(await runCheck("Context Relevance", async () => { const result = await evaluateRelevance(analyzedMemory, life, 0.8); if (!result.reason || result.confidence < 0) throw new Error("Invalid relevance result."); }));
  results.push(await runCheck("Action Generation", async () => { const result = await generateAction("shopping_list", analyzedMemory, life); if (result.type !== "shopping_list" || !result.title) throw new Error("Invalid action result."); }));
  results.push(await runCheck("Multimodal Model", async () => { if (!nvidiaConfig().multimodalModel.includes("omni")) throw new Error("Configured NVIDIA model is not Omni."); }));
  results.push(await runImageCheck(async () => { const result = await analyzeMultimodal(memory, imageEvidence); if (result.metadata.provider !== "nvidia-omni") throw new Error("Image did not use the Omni provider."); }, async () => { await analyzeMemory(memory, imageEvidence); }));
  console.log(["REIBRY NVIDIA Verification", "", "Environment ................. PASS", ...results.map(formatCheck), "Video Analysis ............. SKIPPED", "Reason ..................... No configured non-personal video fixture; frame extraction is deferred.", "Audio Analysis ............. SKIPPED", "Reason ..................... No configured non-personal audio fixture."].join("\n"));
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}