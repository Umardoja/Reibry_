import type { z } from "zod";
import { memoryRecord, lifeRecord, matchRecord, actionRecord, feedbackRecord, readyPackRecord, readyPackItemRecord } from "../integration/schemas.ts";
export const records = { memories: memoryRecord, life_contexts: lifeRecord, memory_context_matches: matchRecord, actions: actionRecord, feedback: feedbackRecord, ready_packs: readyPackRecord, ready_pack_items: readyPackItemRecord };
export type Table = keyof typeof records;
export type RecordFor<T extends Table> = z.output<(typeof records)[T]>;
export type NewRecord<T extends Table> = Omit<RecordFor<T>, "id" | "userId" | "createdAt" | "updatedAt">;
export interface MemoryListOptions {
  limit: number;
  cursor?: string;
  search?: string;
  category?: string;
  source?: "tiktok" | "youtube" | "web" | "text";
  from?: string;
  to?: string;
}
export interface MemoryPage {
  items: RecordFor<"memories">[];
  nextCursor: string | null;
}
/** Each instance is bound to one verified user and their non-elevated Supabase client. */
export interface Store {
  userId: string;
  list<T extends Table>(table: T): Promise<RecordFor<T>[]>;
  listForToday<T extends "life_contexts" | "memory_context_matches" | "actions">(table: T): Promise<RecordFor<T>[]>;
  getMemories(ids: string[]): Promise<RecordFor<"memories">[]>;
  listMemories(options: MemoryListOptions): Promise<MemoryPage>;
  get<T extends Table>(table: T, id: string): Promise<RecordFor<T>>;
  insert<T extends Table>(table: T, value: NewRecord<T>): Promise<RecordFor<T>>;
  findMemoryByDedupeKey(key: string): Promise<RecordFor<"memories"> | null>;
  insertMemory(value: NewRecord<"memories"> & { dedupeKey: string }): Promise<{ memory: RecordFor<"memories">; duplicate: boolean }>;
  insertLife(values: NewRecord<"life_contexts">[]): Promise<RecordFor<"life_contexts">[]>;
  update<T extends Table>(table: T, id: string, value: Partial<NewRecord<T>>): Promise<RecordFor<T>>;
  delete<T extends Table>(table: T, id: string): Promise<void>;
  saveMatch(value: NewRecord<"memory_context_matches">): Promise<RecordFor<"memory_context_matches">>;
  setEmbedding(id: string, embedding: number[]): Promise<void>;
  setLifeEmbedding(id: string, embedding: number[]): Promise<void>;
  vectorSearch(embedding: number[], minimumScore: number, limit: number): Promise<{ id: string; similarity: number }[]>;
}
