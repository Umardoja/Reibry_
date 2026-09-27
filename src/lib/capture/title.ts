/** Browser-safe title cleanup for rendering stored source captions. */
export function conciseSourceTitle(value: string) {
  const clean = value.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim();
  const boundary = clean.search(/(?:[.!?]\s+|\b\d+(?:\.\d+)?\s*(?:g|kg|ml|cups?|tbsp|tsp)\b|\bingredients?\s*:)/i);
  const bounded = (boundary > 18 ? clean.slice(0, boundary) : clean).trim();
  return bounded.length > 100 ? bounded.slice(0, 99).trimEnd() + "…" : bounded;
}
