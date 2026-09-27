/** Split bounded search words into terms safe for the Memories OR filter. */
export function searchTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[(),.%_]/g, " ").split(/[^a-z0-9]+/).filter((term) => term.length > 1))].slice(0, 8);
}

/** Supabase `.or()` must never receive an empty expression. */
export function memorySearchFilter(value: string): string | null {
  const terms = searchTerms(value);
  if (!terms.length) return null;
  return terms.flatMap((term) => {
    const escaped = `%${term}%`;
    return [`title.ilike.${escaped}`, `summary.ilike.${escaped}`, `raw_text.ilike.${escaped}`, `tags.cs.{${term}}`];
  }).join(",");
}
