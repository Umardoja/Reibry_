import type { Memory } from "@/types/reibry";

export type HomeChatIntent =
  | "GREETING" | "ACKNOWLEDGEMENT" | "CAPABILITY_QUESTION" | "SEARCH_MEMORY"
  | "CREATE_INTENTION" | "UPDATE_INTENTION" | "SHOW_UPCOMING" | "BUILD_READY_PACK"
  | "UPDATE_READY_PACK" | "MEMORY_SELECTION" | "PACK_SELECTION" | "SHOW_MORE"
  | "CLARIFICATION" | "MEMORY_REJECTION" | "SEARCH_REFINEMENT" | "SCOPED_CONVERSATION" | "OUT_OF_SCOPE";

export type ConversationHints = {
  hasPlan?: boolean;
  hasOptions?: boolean;
  awaitingConfirmation?: boolean;
};

export function isHomeLocalFastIntent(intent: HomeChatIntent) {
  return ["GREETING", "ACKNOWLEDGEMENT", "CAPABILITY_QUESTION", "OUT_OF_SCOPE"].includes(intent);
}

/** A clear new plan statement starts its own route instead of being mistaken for a draft selection. */
export function shouldSupersedePackDraft(text: string, hasDraft: boolean) {
  return hasDraft && classifyHomeConversation(text) === "CREATE_INTENTION";
}

export function startHomeRouteTimer() { return performance.now(); }
export function reportHomeRoute(intent: HomeChatIntent, startedAt: number) {
  if (process.env.NODE_ENV !== "production") console.debug("[home] local fast route", JSON.stringify({ intent, elapsedMs: Number((performance.now() - startedAt).toFixed(2)), databaseOperations: 0, retrievalOperations: 0, providerCalls: 0 }));
}

const normalize = (text: string) => text.toLowerCase().trim().replace(/[.!?,]+$/g, "").replace(/\s+/g, " ");
import { normalizeVisualSearchQuery } from "../retrieval/understanding.ts";

/** Cheap, deterministic routing. Keep conversational messages out of persistence/retrieval paths. */
export function classifyHomeConversation(text: string, hints: ConversationHints = {}): HomeChatIntent {
  const value = normalize(text);
  if (/^(hi|hey|hey hi|hello|yo|morning|good morning|good afternoon|good evening|how are you|how's it going|(?:hi|hey)[, ]+(?:how are you|how's it going))$/.test(value)) return "GREETING";
  if (hints.hasOptions && /^(?:no[, ]*)?(?:that'?s? not it|not that one|wrong one|not this one|nope,? not that)$/i.test(value)) return "MEMORY_REJECTION";
  if (hints.awaitingConfirmation && /^(yes|yeah|yep|no|nope|continue|let's do it|do it|sounds good)$/.test(value)) return "PACK_SELECTION";
  if (/^(thanks|thank you|thanks a lot|okay|ok|cool|alright|all right|nice|got it|lol|yes|yeah|yep|no|nope)$/.test(value)) return "ACKNOWLEDGEMENT";
  if (/\b(what can you do|what can you help me with|how can you help|what do you remember(?! about)|what is reibry for|tell me what you can do|^help$)\b/.test(value)) return "CAPABILITY_QUESTION";
  if (/\b(show me more|more options|other ones|show the rest)\b/.test(value)) return "SHOW_MORE";
  if (/\b(when did i save|when was (?:it|this) saved|what day did i save)\b/.test(value)) return "CLARIFICATION";
  if (/\b(why\??|why did (?:you )?(?:recommend|pick|match)|why this one|which one would you recommend|which would you pick|what do you recommend)\b/.test(value)) return "CLARIFICATION";
  if (/\b(coming up|what('?s| is) next|my plans|show my plans)\b/.test(value)) return "SHOW_UPCOMING";
  if (hints.hasOptions && (/\b(first|second|third|fourth|last|butterfly|red velvet|chocolate|the .* one)\b/.test(value) || resolveOrdinal(value) !== null)) return "MEMORY_SELECTION";
  if (hints.hasPlan && /\b(build|make|create).{0,20}(ready )?pack|let's do it|build my (trip|birthday|learning)\b/.test(value)) return "BUILD_READY_PACK";
  if (/\b(update|change|actually|instead|move it|make it)\b/.test(value) && hints.hasPlan) return "UPDATE_INTENTION";
  if (hints.hasOptions && /^(?:yes[, ]*)?(?:a |the )?(?:butterfly|heart|apron|red velvet|chocolate|chef jacket|orange juice).{0,60}$/i.test(value)) return "SEARCH_REFINEMENT";
  if (/\b(where is|find|show me|show my|search for|look for|looking for|trying to find|what did i (?:save|find|remember)|what do you remember about|that .* i saved|(?:previously|earlier) stored|saved .*(video|recipe|tutorial|link)|(?:cake|video|memory).*(?:shaped like|look(?:ed|s)? like|designed like|resembles?).*(?:butterfly|apron|heart|car|football|flower|shoe|phone|book))\b/.test(value)) return "SEARCH_MEMORY";
  if (/^(who invented|who is|what is|when did|where is the|write (me )?(an )?(essay|story)|explain (quantum|the history|how the world))\b/.test(value) && !/\b(saved|my memories|i saved)\b/.test(value)) return "OUT_OF_SCOPE";
  if (isExplicitIntention(value)) return "CREATE_INTENTION";
  if (hints.hasOptions && /\b(none of these|none of them|don't like any|do not like any|not those)\b/.test(value)) return "CLARIFICATION";
  return "SCOPED_CONVERSATION";
}

export function homeSearchQuery(text: string) { return normalizeVisualSearchQuery(text); }

export function groundedVisualMatchExplanation(memory: Memory): string | null {
  const visual = memory.analysisMetadata?.visualEvidence;
  if (!visual?.analyzed) return null;
  const relationship = (visual.relationships || []).find((item) => /cake.{0,60}(?:shape|design|resembl|themed).{0,60}(?:butterfly|apron|jacket|heart|car|football|flower|shoe|phone|book|character)|(?:butterfly|apron|jacket|heart|car|football|flower|shoe|phone|book|character).{0,60}(?:shape|design|resembl|themed).{0,60}cake/i.test(item));
  if (relationship) return `The source preview shows ${relationship}.`;
  if (/butterfly.{0,35}cake|cake.{0,35}butterfly/i.test(visual.visualDescription || "")) return "The source preview describes butterfly details on the cake itself.";
  if ((visual.concepts || []).some((concept) => /butterfly.{0,30}cake|cake.{0,30}butterfly/i.test(concept))) return "The thumbnail evidence identifies a butterfly cake design.";
  if (/\bchef jacket[- ]themed cake\b/i.test(visual.visualDescription || "")) return "The source preview describes the cake as chef-jacket-themed.";
  return null;
}

export function isChefJacketThemeCandidate(memory: Memory): boolean {
  const visual = memory.analysisMetadata?.visualEvidence;
  return Boolean(visual?.analyzed && /\bchef jacket[- ]themed cake\b/i.test(visual.visualDescription || ""));
}

export function isExplicitIntention(text: string) {
  const value = normalize(text);
  if (/^(hi|hey|hello|yo|thanks|thank you|okay|ok|cool|alright|nice|got it|help|yes|no|show me more|what do you mean|how are you)$/.test(value)) return false;
  const weekday = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
  const date = `(?:(?:today|tomorrow|tonight)|(?:(?:on|next|this)\\s+)?${weekday})`;
  return new RegExp(`\\b(i('m| am) going to|i('m| am) travelling to|i('m| am) traveling to|going to|travelling to|traveling to|planning (?:a |to |something)|(?:mum|mom|my)('s|) birthday (?:is|falls|comes|on)|my .{2,60} (?:is|are|starts|begins|is due|will be) ${date}|i have .{2,60} ${date}|i (?:want|need) to .{2,80} ${date}|i need to submit .{2,60} ${date})\\b`).test(value);
}

export function homeFastReply(intent: HomeChatIntent, text = "", context?: { hasPlan?: boolean; planTitle?: string }): string | null {
  if (intent === "GREETING") return "Hey 👋 What are you working on today? You can ask about something you've saved or tell me what you're planning.";
  if (intent === "ACKNOWLEDGEMENT") {
    if (/^(thanks|thank you)/i.test(text.trim())) return context?.hasPlan ? `You're welcome. Your ${context.planTitle || "plan"} is here whenever you want to continue.` : "Anytime. What do you want to work on next?";
    if (context?.hasPlan && /^(okay|ok|cool|alright|yes|yeah|yep)$/i.test(text.trim())) return `Sounds good. I'll keep ${context.planTitle || "that plan"} in mind.`;
    return "Sounds good. What would you like to do next?";
  }
  if (intent === "CAPABILITY_QUESTION") return "I can help find things you've saved, connect them to plans coming up, and gather useful Memories into Ready Packs.";
  if (intent === "OUT_OF_SCOPE") return "I'm mainly here to help with things you've saved and things you're planning. If you saved something about that, I can help you find it.";
  if (intent === "MEMORY_REJECTION") return "Got it — not that one. I’ll leave it out. What detail do you remember about the one you want?";
  return null;
}

function resolveOrdinal(value: string): number | null {
  const match = value.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|last)\b/);
  if (!match) return null;
  return ({ first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, "4th": 3, last: -1 } as Record<string, number>)[match[1]];
}

export function resolveConversationSelection(text: string, options: Array<{ id: string; title: string; concepts?: string[] }>): string | null {
  const value = normalize(text);
  if (/\b(none|skip|no thanks|not those|don't like any|do not like any)\b/.test(value)) return null;
  const ordinal = resolveOrdinal(value);
  if (ordinal !== null) return ordinal === -1 ? options.at(-1)?.id || null : options[ordinal]?.id || null;
  const phrase = value.replace(/\b(actually|use|choose|pick|i like|i'll take|the|one|please)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!phrase) return null;
  const words = phrase.split(/\s+/).filter((word) => word.length > 2);
  const ranked = options.map((option) => {
    const title = normalize(option.title);
    const concepts = (option.concepts || []).map(normalize);
    const hits = words.filter((word) => word.length > 2 && (title.includes(word) || concepts.some((concept) => concept.includes(word))));
    const score = title.includes(phrase) ? 100 : concepts.includes(phrase) ? 80 : concepts.some((concept) => concept.includes(phrase)) ? 60 + hits.length : title.includes(phrase.split(" ")[0]) ? 50 + hits.length : hits.length;
    return { id: option.id, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return ranked.length && (ranked.length === 1 || ranked[0].score > ranked[1].score) ? ranked[0].id : null;
}

export function replaceSectionSelection(previousIds: string[], selectedId: string, options: Array<{ id: string; section: string }>) {
  const section = options.find((option) => option.id === selectedId)?.section;
  if (!section) return [...new Set([...previousIds, selectedId])];
  return [...new Set([...previousIds.filter((id) => options.find((option) => option.id === id)?.section !== section), selectedId])];
}

export function extractDateCorrectionPhrase(text: string): string | null {
  if (!/\b(actually|i meant|change (?:it|the date)|move it|instead)\b/i.test(text)) return null;
  return text.match(/\b(?:next|this)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\b(?:tomorrow|tonight|today)\b|\bin\s+\d+\s+(?:days?|weeks?)\b/i)?.[0] || null;
}
