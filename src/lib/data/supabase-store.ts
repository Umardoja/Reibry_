import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { records, type Store, type Table, type RecordFor, type NewRecord, type MemoryListOptions } from "./store.ts";
import { IntegrationError } from "../integration/errors.ts";
import { vector } from "../integration/schemas.ts";
import { normalizeCategory } from "../sources/enrichment.ts";
import { memorySearchFilter } from "./search-terms.ts";
// Map only top-level database columns. Nested JSON evidence/payloads retain their contract keys.
const columns: Record<string, string> = { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at", sourceUrl: "source_url", sourcePlatform: "source_platform", sourceType: "source_type", rawText: "raw_text", possibleIntents: "possible_intents", possibleActions: "possible_actions", analysisStatus: "analysis_status", evidenceSources: "evidence_sources", analysisMetadata: "analysis_metadata", dedupeKey: "dedupe_key", startDate: "start_date", endDate: "end_date", memoryId: "memory_id", lifeContextId: "life_context_id", matchId: "match_id", actionId: "action_id", suggestedAction: "suggested_action", shownAt: "shown_at", readyPackId: "ready_pack_id", relevanceReason: "relevance_reason", relevanceStrength: "relevance_strength", packType: "pack_type" };
const reverse = Object.fromEntries(Object.entries(columns).map(([a,b]) => [b,a]));
function toRow(value: object) { return Object.fromEntries(Object.entries(value).map(([k,v]) => [columns[k] ?? k,v])); }
function decode<T extends Table>(table: T, value: Record<string, unknown>): RecordFor<T> {
  const decoded = Object.fromEntries(Object.entries(value).map(([k,v]) => [reverse[k] ?? k,v]));
  if (table === "memories" && "category" in decoded) decoded.category = decoded.category == null ? null : normalizeCategory(decoded.category);
  return records[table].parse(decoded) as RecordFor<T>;
}
function diagnosticsEnabled() { return process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview"; }
function safeDbText(value: string | undefined) {
  return value?.replace(/"[^"]*"/g, '"[redacted]"').slice(0, 300);
}
function check(error: { code?: string; message?: string; details?: string; hint?: string } | null, stage = "database") {
  if (!error) return;
  if (diagnosticsEnabled()) console.error("[supabase] failure", {
    stage,
    code: error.code,
    message: safeDbText(error.message),
    details: safeDbText(error.details),
    hint: safeDbText(error.hint),
  });
  throw new IntegrationError(error.code === "42501" ? "AUTH_REQUIRED" : "INTERNAL_ERROR", "Database operation failed.");
}
function requireRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new IntegrationError("INTERNAL_ERROR", "Database did not return the saved record.");
  return data as Record<string, unknown>;
}
function parseCursor(cursor: string | undefined) {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
function boundedLimit(limit: number) { return Math.min(Math.max(Math.trunc(limit || 20), 1), 50); }
export function createStore(client: SupabaseClient, userId: string): Store {
  const store: Store = {
    userId,
    async list(table) {
      const all = []; // Paginate to avoid silently truncating context suppression or ownership checks.
      for (let start = 0; ; start += 500) {
        const { data, error } = await client.from(table).select("*").eq("user_id", userId).order("id").range(start, start + 499);
        check(error); const rows = data ?? []; all.push(...rows.map(r => decode(table,r)));
        if (rows.length < 500) return all;
      }
    },
    async listForToday(table) {
      let query = client.from(table).select("*").eq("user_id", userId);
      if (table === "life_contexts") query = query.eq("status", "active").order("start_date", { ascending: true, nullsFirst: false });
      if (table === "memory_context_matches") query = query.neq("status", "dismissed").order("similarity", { ascending: false });
      if (table === "actions") query = query.eq("status", "suggested").order("created_at", { ascending: false });
      const { data, error } = await query.range(0, 49);
      check(error, `today.${table}`);
      return (data ?? []).map((row) => decode(table, row));
    },
    async getMemories(ids) {
      if (!ids.length) return [];
      const { data, error } = await client.from("memories").select("*").eq("user_id", userId).in("id", ids.slice(0, 50));
      check(error, "today.memories");
      return (data ?? []).map((row) => decode("memories", row));
    },
    async listMemories(options: MemoryListOptions) {
      const limit = boundedLimit(options.limit);
      const offset = parseCursor(options.cursor);
      let query = client.from("memories").select("*").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false });
      const category = options.category?.trim();
      if (category && category !== "All") query = query.eq("category", category);
      if (options.from) query = query.gte("created_at", options.from);
      if (options.to) query = query.lt("created_at", options.to);
      if (options.source === "text") query = query.eq("source_type", "text");
      if (options.source === "tiktok") query = query.ilike("source_platform", "%tiktok%");
      if (options.source === "youtube") query = query.ilike("source_platform", "%youtube%");
      if (options.source === "web") query = query.in("source_type", ["link", "article"]);
      const search = options.search?.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ").slice(0, 120);
      if (search) {
        const filter = memorySearchFilter(search);
        if (!filter) return { items: [], nextCursor: null };
        query = query.or(filter);
      }
      const { data, error } = await query.range(offset, offset + limit);
      check(error, "memories.list-page");
      const rows = data ?? [];
      const hasMore = rows.length > limit;
      return { items: rows.slice(0, limit).map((row) => decode("memories", row)), nextCursor: hasMore ? String(offset + limit) : null };
    },
    async get(table, id) { const { data, error } = await client.from(table).select("*").eq("user_id",userId).eq("id",id).maybeSingle(); check(error); if (!data) throw new IntegrationError("NOT_FOUND", "Record not found."); return decode(table,data); },
    async insert(table, value) { const { data, error } = await client.from(table).insert({ ...toRow(value), user_id: userId }).select().single(); check(error); return decode(table, requireRow(data)); },
    async findMemoryByDedupeKey(key) { const { data, error } = await client.from("memories").select("*").eq("user_id", userId).eq("dedupe_key", key).maybeSingle(); check(error); return data ? decode("memories", data) : null; },
    async insertMemory(value) {
      const { data, error } = await client.from("memories").insert({ ...toRow(value), user_id: userId }).select().single();
      if (error?.code === "23505") {
        const existing = await store.findMemoryByDedupeKey(value.dedupeKey);
        if (existing) return { memory: existing, duplicate: true };
      }
      check(error);
      return { memory: decode("memories", requireRow(data)), duplicate: false };
    },
    async insertLife(values) { const { data, error } = await client.from("life_contexts").insert(values.map(v => ({ ...toRow(v), user_id: userId }))).select(); check(error, "life.insert"); return (data ?? []).map(v => decode("life_contexts",v)); },
    async update(table,id,value) { const { data,error } = await client.from(table).update(toRow(value)).eq("id",id).eq("user_id",userId).select().maybeSingle(); check(error); if (!data) throw new IntegrationError("NOT_FOUND","Record not found."); return decode(table,data); },
    async delete(table,id) { const { data,error } = await client.from(table).delete().eq("id",id).eq("user_id",userId).select("id").maybeSingle(); check(error); if (!data) throw new IntegrationError("NOT_FOUND","Record not found."); },
    async saveMatch(value: NewRecord<"memory_context_matches">) {
      const { error } = await client.from("memory_context_matches").upsert({ ...toRow(value), user_id: userId }, { onConflict: "user_id,memory_id,life_context_id", ignoreDuplicates: true }); check(error);
      const { data,error: readError } = await client.from("memory_context_matches").select("*").eq("user_id",userId).eq("memory_id",value.memoryId).eq("life_context_id",value.lifeContextId).single(); check(readError); return decode("memory_context_matches",data);
    },
    async setEmbedding(id,embedding) { vector.parse(embedding); const { data,error } = await client.from("memories").update({ embedding: JSON.stringify(embedding) }).eq("user_id",userId).eq("id",id).select("id").maybeSingle(); check(error); if (!data) throw new IntegrationError("NOT_FOUND","Memory not found."); },
    async setLifeEmbedding(id,embedding) { vector.parse(embedding); const { data,error } = await client.from("life_contexts").update({ embedding: JSON.stringify(embedding) }).eq("user_id",userId).eq("id",id).select("id").maybeSingle(); check(error); if (!data) throw new IntegrationError("NOT_FOUND","Life context not found."); },
    async vectorSearch(embedding,minimumScore,limit) { vector.parse(embedding); const { data,error } = await client.rpc("match_memories",{query_embedding:JSON.stringify(embedding),match_threshold:minimumScore,match_count:Math.min(limit,50)}); check(error); return (data??[]).map((row:{id:string;similarity:number})=>({id:row.id,similarity:row.similarity})); },
  }; return store;
}
