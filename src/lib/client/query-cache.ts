"use client";
type Entry = { value: unknown; at: number };
const cache = new Map<string, Entry>();
let scope = "anonymous";
export function setQueryScope(value: string | null) { if (scope !== (value || "anonymous")) cache.clear(); scope = value || "anonymous"; }
export function readQueryCache<T>(key: string, maxAgeMs = 60_000): T | null { const entry = cache.get(`${scope}:${key}`); return entry && Date.now() - entry.at <= maxAgeMs ? entry.value as T : null; }
export function writeQueryCache<T>(key: string, value: T) { cache.set(`${scope}:${key}`, { value, at: Date.now() }); }
export function invalidateQueryCache(prefix = "") { for (const key of cache.keys()) if (!prefix || key.startsWith(`${scope}:${prefix}`)) cache.delete(key); }
export function clearQueryCache() { cache.clear(); scope = "anonymous"; }
