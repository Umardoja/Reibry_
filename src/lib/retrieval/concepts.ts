export type ConceptStrength = "exact" | "direct" | "related";
export type SemanticConcept = { concept: string; source: string; strength: ConceptStrength };

const STOP = new Set("a an and are as at by for from how i in is it me my of on or that the this to was what where which you your with want get make learn save saved thing something ultimate extremely demonstrating youtube tiktok short easy".split(" "));
const ALIASES: Record<string, string> = {
  oranges: "orange", cakes: "cake", bananas: "banana", recipes: "recipe", ingredients: "ingredient",
  baking: "bake", baked: "bake", cooking: "cook", cooked: "cook", drinks: "drink", juices: "juice",
  tutorials: "tutorial", videos: "video", articles: "article", programs: "program", programming: "program", redvelvet: "red velvet", lagos: "lagos",
};
const DIRECT: Record<string, string[]> = {
  "orange juice": ["orange", "juice", "drink", "citrus"],
  "banana pie": ["banana", "pie", "dessert"],
  "vanilla cake": ["cake", "bake", "dessert", "vanilla"],
  "butterfly cake": ["cake", "butterfly", "cake decoration", "shaped cake"],
};
const PHRASES = [...Object.keys(DIRECT), "red velvet cake", "red velvet", "heart shaped cake", "sifting powder", "baking preparation", "apron shaped cake", "chef apron cake", "decorated cake", "novelty cake"];

export function canonicalConcept(value: string) {
  const word = value.toLowerCase().trim().replace(/[^a-z0-9 -]/g, "");
  return ALIASES[word] || (word.endsWith("es") && word.length > 4 ? word.slice(0, -2) : word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word);
}

export function conceptTokens(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).map(canonicalConcept).filter((token) => token.length > 1 && !STOP.has(token)));
}

export function expandConcepts(tokens: Iterable<string>) {
  const result = new Set<string>(tokens);
  for (const phrase of Object.keys(DIRECT)) {
    const phraseTokens = phrase.split(" ").map(canonicalConcept);
    if (phraseTokens.every((token) => result.has(token))) for (const related of DIRECT[phrase]) result.add(related);
  }
  return result;
}

function phraseConcepts(value: string) {
  const words = value.toLowerCase().split(/[^a-z0-9]+/).map(canonicalConcept).filter(Boolean);
  return PHRASES.filter((phrase) => {
    const phraseTokens = phrase.split(" ").map(canonicalConcept);
    return words.some((_, index) => phraseTokens.every((token, offset) => words[index + offset] === token));
  });
}

export function semanticConcepts(fields: Array<{ text?: string | null; source: string }>, limit = 32): SemanticConcept[] {
  const out: SemanticConcept[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    const direct = [...conceptTokens(field.text || ""), ...phraseConcepts(field.text || "")];
    for (const concept of direct) {
      if (seen.has(concept) || out.length >= limit) continue;
      seen.add(concept);
      out.push({ concept, source: field.source, strength: field.source === "title" ? "exact" : "direct" });
    }
    const expanded = expandConcepts(conceptTokens(field.text || ""));
    for (const concept of expanded) if (!direct.includes(concept)) {
      if (seen.has(concept) || out.length >= limit) continue;
      seen.add(concept);
      out.push({ concept, source: "relationship", strength: "related" });
    }
  }
  return out;
}

export function conceptScore(query: string, fields: Array<{ text?: string | null; source: string }>) {
  const queryConcepts = conceptTokens(query);
  const indexed = semanticConcepts(fields);
  const concepts = new Set(indexed.map((entry) => entry.concept));
  if (!queryConcepts.size) return 0;
  let score = 0;
  for (const queryConcept of queryConcepts) {
    if (concepts.has(queryConcept)) {
      const strength = indexed.find((entry) => entry.concept === queryConcept)?.strength;
      score += strength === "exact" ? 1 : strength === "direct" ? 0.8 : 0.55;
    }
    else if ([...concepts].some((candidate) => DIRECT[candidate]?.includes(queryConcept))) score += 0.55;
  }
  return Math.min(1, score / queryConcepts.size);
}
