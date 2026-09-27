import { z } from "zod";

const uuid = z.uuid();
const text = z.string().trim().min(1).max(20000);
const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS URL");
export const captureSchema = z.strictObject({
  sourceType: z.enum(["link", "social_post", "video", "article", "screenshot", "document", "text"]),
  sourceUrl: httpUrl.optional(),
  rawText: text.optional(),
  title: z.string().trim().min(1).max(300).optional(),
}).refine((value) => Boolean(value.sourceUrl || value.rawText), "Provide sourceUrl or rawText");
export const analyzeSchema = z.strictObject({ memoryId: uuid });
export const searchSchema = z.strictObject({ query: text, limit: z.number().int().min(1).max(50).default(10) });
export const parseLifeSchema = z.strictObject({ text, timezone: z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Use an IANA timezone").default("UTC") });
export const matchSchema = z.strictObject({ lifeContextId: uuid, memoryIds: z.array(uuid).min(1).max(100).optional() });
export const feedbackSchema = z.strictObject({ matchId: uuid, feedback: z.enum(["useful", "not_useful", "dismissed"]) });
export const actionSchema = z.strictObject({
  type: z.enum(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]),
  memoryId: uuid.optional(),
  lifeContextId: uuid.optional(),
  matchId: uuid.optional(),
}).refine((value) => Boolean(value.memoryId || value.lifeContextId || value.matchId), "Provide at least one source ID");

export type CaptureRequest = z.infer<typeof captureSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeSchema>;
export type SearchRequest = z.infer<typeof searchSchema>;
export type ParseLifeRequest = z.infer<typeof parseLifeSchema>;
export type MatchRequest = z.infer<typeof matchSchema>;
export type FeedbackRequest = z.infer<typeof feedbackSchema>;
export type ActionRequest = z.infer<typeof actionSchema>;
export type ApiResponse<T> = { data: T; error: null } | {
  data: null;
  error: { code: string; message: string; details?: { path: string; message: string }[] };
};
