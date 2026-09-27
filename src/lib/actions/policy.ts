import type { ActionType, LifeContext, Memory } from "@/types/reibry";

export interface MeaningfulAction { type: ActionType; label: string; title: string; description: string; payload: Record<string, string | string[]> }

function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : []; }

export function meaningfulAction(memory: Memory, life: LifeContext, suggested?: ActionType | null): MeaningfulAction | null {
  const hay = `${memory.title} ${memory.summary || ""} ${memory.category || ""} ${memory.tags.join(" ")} ${life.type} ${life.title} ${life.description || ""}`.toLowerCase();
  const ingredients = strings(memory.analysisMetadata?.structuredContent?.ingredients);
  if ((memory.analysisMetadata?.contentType === "recipe" || memory.category === "Food & Cooking") && ingredients.length) {
    return { type: "shopping_list", label: "Create ingredient list", title: `Ingredients for ${memory.title}`, description: "A saved ingredient list from this recipe.", payload: { items: ingredients } };
  }
  if (/\b(presentation|presenting|slides?|talk)\b/.test(hay)) return { type: "checklist", label: "Create presentation checklist", title: `Prepare for ${life.title}`, description: "A focused checklist for this presentation.", payload: { items: ["Review the material", "Prepare the final version", "Practice the presentation"] } };
  if (/\b(exam|revision|revise|study|studying)\b/.test(hay)) return { type: "revision_plan", label: "Create revision plan", title: `Revision plan for ${life.title}`, description: "A plan based on this saved resource and Life context.", payload: { topics: [memory.title] } };
  if (life.type === "trip" || /\b(trip|travel|flight|hotel)\b/.test(hay)) return { type: "itinerary", label: "Create itinerary", title: `Plan ${life.title}`, description: "A proposed itinerary linked to this Memory.", payload: { references: [memory.title] } };
  if ((life.type === "project" || life.type === "task") && memory.analysisMetadata?.contentType !== "recipe" && memory.category !== "Food & Cooking") return { type: "checklist", label: "Create task checklist", title: `Checklist for ${life.title}`, description: "A focused checklist linked to this Memory.", payload: { items: [memory.title] } };
  if (suggested === "reminder" && /\b(remind|remember|deadline|due)\b/.test(hay)) return { type: "reminder", label: "Create reminder", title: `Reminder: ${life.title}`, description: "A reminder linked to this Memory.", payload: { reference: memory.title } };
  return null;
}
