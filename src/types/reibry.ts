/** Domain objects use camelCase; database rows use snake_case. Dates are ISO 8601 strings. */
export type AnalysisStatus = "complete" | "partial" | "failed" | "processing";
export type LifeContextType = "event" | "goal" | "deadline" | "trip" | "task" | "project" | "interest" | "reminder";
export type LifeContextStatus = "active" | "completed" | "cancelled" | "archived";
export type MatchStatus = "pending" | "accepted" | "dismissed";
export type ActionType = "shopping_list" | "revision_plan" | "itinerary" | "checklist" | "reminder";
export type SourceType = "link" | "social_post" | "video" | "article" | "screenshot" | "document" | "text";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type MemoryContentType = "recipe" | "tutorial" | "how-to" | "learning-resource" | "article" | "reference" | "idea" | "product" | "event-information" | "travel" | "entertainment" | "general";
export type IntentionType = "travel" | "event" | "learning" | "opportunity" | "general";
export type ReadyPackType = "travel" | "event" | "learning";
export type ReadyPackStatus = "active" | "completed" | "archived";

export interface SourceEvidence {
  modality?: "text" | "image" | "video" | "audio" | "frame" | "metadata";
  mimeType?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  title?: string;
  caption?: string;
  thumbnail?: string;
  author?: string;
  mediaUrl?: string;
  transcript?: string;
  onScreenText?: string[];
  frames?: { timestampSeconds: number; imageUrl?: string; description?: string }[];
  sourceQuality?: "high" | "medium" | "low" | "unknown";
  platform?: string;
  metadataSource?: string;
  canonicalUrl?: string;
  authorUrl?: string;
}

export interface AIAnalysisMetadata {
  status: AnalysisStatus;
  confidence: number | null;
  provider?: string;
  providerUsed?: "nvidia" | "fallback" | "mock";
  fallbackReason?: "timeout" | "network_error" | "provider_error" | "invalid_response";
  model?: string;
  analyzedAt?: string;
  warnings: string[];
  evidenceSources: SourceEvidence[];
  analysisVersion?: number;
  contentType?: MemoryContentType;
  evidenceLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  structuredContent?: Record<string, JsonValue>;
  semanticConcepts?: Array<{ concept: string; source: string; strength: "exact" | "direct" | "related" }>;
    visualEvidence?: { source: "thumbnail"; analyzed: boolean; concepts: string[]; visualDescription?: string; primaryObjects?: string[]; attributes?: string[]; relationships?: string[]; confidence?: "high" | "medium" | "low" };
}

export interface SuggestedAction {
  type: ActionType;
  title: string;
  description?: string;
  payload: Record<string, JsonValue>;
}

export interface Memory {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  entities: { name: string; type: string }[];
  sourceUrl: string | null;
  sourcePlatform: string | null;
  sourceType: SourceType;
  rawText: string | null;
  possibleIntents: string[];
  possibleActions: SuggestedAction[];
  analysisStatus: AnalysisStatus;
  confidence: number | null;
  evidenceSources: SourceEvidence[];
  analysisMetadata: AIAnalysisMetadata | null;
  dedupeKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LifeContext {
  id: string;
  userId: string;
  type: LifeContextType;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: LifeContextStatus;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface ReadyPack { id: string; userId: string; lifeContextId: string; title: string; packType: ReadyPackType; status: ReadyPackStatus; createdAt: string; updatedAt: string; }
export interface ReadyPackItem { id: string; userId: string; readyPackId: string; memoryId: string; section: string; relevanceReason: string; relevanceStrength: "direct" | "strong" | "related"; createdAt: string; updatedAt: string; }

export interface ContextMatch {
  id: string;
  userId: string;
  memoryId: string;
  lifeContextId: string;
  similarity: number;
  confidence: number | null;
  reason: string;
  suggestedAction: SuggestedAction | null;
  status: MatchStatus;
  shownAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TodayResurfacedMemory { memory: Memory; lifeContext: LifeContext; reason: string; similarity: number; confidence: number | null; status: MatchStatus; suggestedAction: SuggestedAction | null; }
export interface TodayFeed { upcomingLifeContexts: LifeContext[]; resurfacedMemories: TodayResurfacedMemory[]; reminders: LifeContext[]; suggestedActions: SuggestedAction[]; }
