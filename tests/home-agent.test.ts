import assert from "node:assert/strict";
import test from "node:test";
import { boundedHomeAgentContext, filterRejectedMemories, homeAgentPlanSchema, homeAgentToolForPlan, homeCandidateEvidence, isHomeRejection, isPresentActivityGoal, isSearchRefinement, lastRejectedCandidate, refinedSearchQuery, shouldPlanHomeMessage } from "../src/lib/agent/home-agent.ts";
import { classifyHomeConversation, groundedVisualMatchExplanation, homeFastReply, resolveConversationSelection } from "../src/lib/plans/conversation.ts";
import { readyPackStepOrder } from "../src/lib/plans/finalization.ts";
import { boundedVisualCandidates, exactCakeVisualEvidence } from "../src/lib/agent/visual-match.ts";
import { readFileSync } from "node:fs";

const validPlan = { intent: "SEARCH_MEMORY", tool: "searchMemories", searchQuery: "butterfly cake", requiredConcepts: ["butterfly", "cake"], needsClarification: false, reply: "I’ll check your cake Memories." };

test("agent planning schema is bounded and rejects arbitrary tools", () => {
  assert.deepEqual(homeAgentPlanSchema.parse(validPlan).requiredConcepts, ["butterfly", "cake"]);
  assert.throws(() => homeAgentPlanSchema.parse({ ...validPlan, tool: "querySupabase" }));
  assert.throws(() => homeAgentPlanSchema.parse({ ...validPlan, requiredConcepts: Array(9).fill("term") }));
});

test("agent tool dispatch only maps intent-compatible fixed tools", () => {
  assert.equal(homeAgentToolForPlan(homeAgentPlanSchema.parse(validPlan)), "searchMemories");
  assert.equal(homeAgentToolForPlan(homeAgentPlanSchema.parse({ ...validPlan, intent: "SHOW_UPCOMING", tool: "listUpcomingPlans" })), "listUpcomingPlans");
  assert.equal(homeAgentToolForPlan(homeAgentPlanSchema.parse({ ...validPlan, intent: "CREATE_INTENTION", tool: "searchMemories" })), "none");
});

test("clear Memory searches bypass generative planning while ambiguous chat keeps the bounded planner", () => {
  assert.equal(shouldPlanHomeMessage("SEARCH_MEMORY", false, false), false);
  assert.equal(shouldPlanHomeMessage("SEARCH_MEMORY", true, false), false);
  assert.equal(shouldPlanHomeMessage("SCOPED_CONVERSATION", false, false), true);
  assert.equal(shouldPlanHomeMessage("SHOW_UPCOMING", false, false), false);
  assert.equal(isPresentActivityGoal("I want to bake something today"), true);
  assert.equal(shouldPlanHomeMessage("CREATE_INTENTION", false, false, "I want to bake something today"), true);
  assert.equal(shouldPlanHomeMessage("CREATE_INTENTION", false, false, "I'm going to Lagos next Saturday"), false);
});

test("conversation context and candidates are bounded before planning", () => {
  const result = boundedHomeAgentContext({ message: "m".repeat(2000), recentTurns: Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, text: "t".repeat(800) })), currentTopic: "cake", candidateTitles: Array(12).fill("title"), rejectedMemoryIds: Array(20).fill("id"), hasPlan: true });
  assert.equal(result.message.length, 1200);
  assert.equal(result.recentTurns.length, 8);
  assert.equal(result.recentTurns[0].text.length, 500);
  assert.equal(result.candidateTitles.length, 8);
  assert.equal(result.rejectedMemoryIds.length, 12);
});

test("rejected Memories stay excluded from the active result set", () => {
  const items = [{ memory: { id: "a" } }, { memory: { id: "b" } }];
  assert.deepEqual(filterRejectedMemories(items, ["a"]), [items[1]]);
  assert.deepEqual(filterRejectedMemories(items, ["a", "b"]), []);
  assert.equal(isHomeRejection("No, that's not it"), true);
  assert.equal(isHomeRejection("Thanks"), false);
});

test("why follow-up after rejection refers to the last shown candidate without reopening search", () => {
  const candidate = { id: "butterfly-cake" };
  const turns = [
    { role: "assistant", block: { kind: "search", text: "I found one close Memory.", results: [{ memory: candidate }] } },
    { role: "assistant", block: { kind: "text", text: "Got it — not that one. What detail do you remember?" } },
  ];
  assert.deepEqual(lastRejectedCandidate(turns), candidate);
  assert.equal(lastRejectedCandidate([{ role: "assistant", block: { kind: "text", text: "Anything else?" } }]), null);
});

test("visual refinement retains the existing subject while requiring the new detail", () => {
  assert.equal(isSearchRefinement("Yes, a butterfly cake", "a cake I previously stored"), true);
  assert.equal(refinedSearchQuery("Yes, a butterfly cake", "a cake I previously stored"), "butterfly cake");
  assert.equal(refinedSearchQuery("Butterfly", "cake"), "Butterfly cake");
  assert.equal(isSearchRefinement("orange juice", "a cake I saved"), false);
});

test("semantic refinements keep the active concept chain baking to cake to butterfly cake", () => {
  assert.equal(isSearchRefinement("What about a cake?", "baking recipes"), true);
  assert.equal(refinedSearchQuery("What about a cake?", "baking recipes"), "cake");
  const candidates = [{ id: "ordinary", title: "Chocolate Cake", concepts: ["cake"] }, { id: "visual", title: "Cake Decoration", concepts: ["butterfly cake"] }];
  assert.equal(resolveConversationSelection("the butterfly one", candidates), "visual");
  assert.equal(resolveConversationSelection("the second one", candidates), "visual");
  assert.equal(resolveConversationSelection("the butterfly one", [{ id: "visual", title: "Butterfly Cake Decoration Tutorial", concepts: ["butterfly cake"] }, { id: "legacy", title: "Red Velvet Cake", concepts: ["butterfly", "cake"] }]), "visual");
  assert.equal(classifyHomeConversation("the butterfly one", { hasOptions: true }), "MEMORY_SELECTION");
});

test("candidate evidence is bounded and drawn only from actual returned Memory fields", () => {
  const evidence = homeCandidateEvidence({ title: "Butterfly Cake", summary: "A decorated cake.", tags: ["cake"], entities: [{ name: "dessert" }], sourcePlatform: "YouTube", analysisMetadata: { visualEvidence: { analyzed: true, concepts: ["butterfly-shaped cake"], visualDescription: "A cake with butterfly decoration." } } });
  assert.match(evidence, /Title: Butterfly Cake/);
  assert.match(evidence, /Thumbnail concepts: butterfly-shaped cake/);
  assert.doesNotMatch(evidence, /ingredient|recipe steps/i);
  assert.ok(homeCandidateEvidence({ title: "x".repeat(1000) }).length <= 600);
});

test("immediate action goals use semantic planning before no-match messaging, without a baked-in synonym mapping", () => {
  const route = readFileSync(new URL("../src/app/api/home/route.ts", import.meta.url), "utf8");
  const provider = readFileSync(new URL("../src/lib/integration/gemini.ts", import.meta.url), "utf8");
  assert.match(route, /shouldPlanHomeMessage\(intent, refinement, isHomeRejection\(input\.text\), input\.text\)/);
  assert.match(route, /presentActivityGoal && intent !== "SEARCH_MEMORY"/);
  assert.ok(route.indexOf("await searchMemories({ query: searchQuery") < route.indexOf("return privateJson({ data: { intent, results: exactResults"));
  assert.match(provider, /interpret the broader goal semantically and search the user's saved Memories/);
  assert.doesNotMatch(provider, /bake\s*(?:=>|->)\s*cake/i);
});

test("Ready Pack guides follow a stable order and retain saved custom steps", () => {
  assert.deepEqual(readyPackStepOrder("travel", ["Travel tips", "Places", "Custom section"]), ["Places", "Travel tips", "Custom section"]);
  assert.deepEqual(readyPackStepOrder("event", ["Activities", "Cake ideas", "Gift ideas"]), ["Cake ideas", "Gift ideas", "Activities"]);
});

test("greeting and acknowledgement remain deterministic fast paths", () => {
  assert.equal(classifyHomeConversation("Hey hi"), "GREETING");
  assert.match(homeFastReply("GREETING") || "", /What are you working on today/);
  assert.equal(classifyHomeConversation("Thanks", { hasPlan: true }), "ACKNOWLEDGEMENT");
  assert.equal(homeFastReply("ACKNOWLEDGEMENT", "Thanks", { hasPlan: true, planTitle: "Mum's Birthday" }), "You're welcome. Your Mum's Birthday is here whenever you want to continue.");
});

function visualMemory(title: string, description: string, concepts: string[] = []) {
  return { id: title, userId: "user-a", title, summary: null, category: "Food & Cooking", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "video", rawText: null, possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: 0.8, evidenceSources: [], analysisMetadata: { status: "complete", confidence: 0.8, warnings: [], evidenceSources: [], visualEvidence: { source: "thumbnail", analyzed: true, concepts, visualDescription: description }, semanticConcepts: concepts.map((concept) => ({ concept, source: "thumbnail", strength: "direct" as const })) }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as never;
}

test("distinctive cake matching needs the design on the cake, not an incidental object", () => {
  const exact = visualMemory("Cake idea", "A decorated cake with a butterfly-shaped design", ["butterfly-shaped cake"]);
  const incidental = visualMemory("Cake decorating", "A person wears a butterfly apron beside a normal cake", ["butterfly", "cake"]);
  assert.equal(exactCakeVisualEvidence(exact, "butterfly"), true);
  assert.equal(exactCakeVisualEvidence(incidental, "butterfly"), false);
  assert.equal(exactCakeVisualEvidence(visualMemory("Chef jacket cake", "A cake designed like a chef jacket"), "butterfly"), false);
});

test("query-time visual candidate count is hard capped at three", () => {
  assert.deepEqual(boundedVisualCandidates([1, 2, 3, 4, 5], 9), [1, 2, 3]);
});

test("why-this-memory copy can cite only stored visual evidence", () => {
  const memory = visualMemory("Cake idea", "", ["butterfly cake design"]);
  assert.match(groundedVisualMatchExplanation(memory) || "", /thumbnail evidence identifies a butterfly cake design/);
  const unsupported = visualMemory("Cake idea", "", ["decorated cake"]);
  assert.equal(groundedVisualMatchExplanation(unsupported), null);
});

test("Home conversation has no browser-storage persistence and is hosted above routed pages", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const provider = readFileSync(new URL("../src/components/home/home-conversation-provider.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /sessionStorage|localStorage|home-session/);
  assert.doesNotMatch(provider, /setItem\s*\(/);
  assert.match(layout, /HomeConversationProvider/);
  assert.match(provider, /useCallback\(\(\)\s*=>\s*setState\(initialState\)/);
  assert.match(page, /showOpenAction/);
  assert.match(page, /Why this one\?/);
  assert.match(page, /Not this one/);
  assert.match(page, /MEMORY_REJECTION.*searchCandidates\.length > 0/);
  assert.match(page, /Putting your Ready Pack together/);
  assert.match(page, /Open Ready Pack/);
  assert.match(readFileSync(new URL("../src/app/plans/[id]/page.tsx", import.meta.url), "utf8"), /Open Memory|showOpenAction/);
  const memoryCard = readFileSync(new URL("../src/components/design/memory.tsx", import.meta.url), "utf8");
  assert.match(memoryCard, /mem-open-action">Open/);
  assert.match(provider, /useCallback\(\(\)\s*=>\s*setState\(initialState\)/);
  assert.match(provider, /searchCandidates: HomeMatch\[\]\s*;/);
  assert.doesNotMatch(page.match(/function startNewChat\(\)[^\n]+/)?.[0] || "", /delete|DELETE|ready-packs/);
});
