import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyHomeIntent, dedupePacks, gapSections, intentionFromText, intentionType, matchPackMemories, optionSlice, packTypeFor, resolveNaturalSelection } from "../src/lib/plans/service.ts";
import { classifyHomeConversation, extractDateCorrectionPhrase, groundedVisualMatchExplanation, homeFastReply, homeSearchQuery, isChefJacketThemeCandidate, isExplicitIntention, isHomeLocalFastIntent, replaceSectionSelection, resolveConversationSelection, shouldSupersedePackDraft } from "../src/lib/plans/conversation.ts";
import { isDuplicateLifeContext } from "../src/lib/life/management.ts";
import type { LifeContext, Memory } from "../src/types/reibry.ts";
import { controlledPackSections, packSections, reconcilePackItems, selectSectionMemory, selectedPackMemoryIds } from "../src/lib/plans/finalization.ts";
import { compactSessionMemory } from "../src/lib/plans/session.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function memory(title: string, summary = title): Memory { return { id: crypto.randomUUID(), userId, title, summary, category: "Other", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: summary, possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: 0.8, evidenceSources: [], analysisMetadata: null, createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z" }; }
function context(title: string, type: LifeContext["type"] = "trip"): LifeContext { return { id: crypto.randomUUID(), userId, type, title, description: title, startDate: "2026-10-03T09:00:00.000Z", endDate: null, status: "active", confidence: null, createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z" }; }

test("intention routing recognizes travel, event, and learning", () => { assert.equal(intentionType("I'm going to Lagos next Saturday"), "travel"); assert.equal(intentionType("Mum's birthday is Saturday"), "event"); assert.equal(intentionType("My backend presentation is Friday"), "learning"); });
test("deterministic intention fallback preserves subject, correct travel type, and date", () => { const result = intentionFromText("I'm going to Lagos next Saturday", "Africa/Lagos", new Date("2026-09-25T10:00:00.000Z")); assert.equal(result.title, "Lagos"); assert.equal(result.type, "trip"); assert.ok(result.startDate); assert.equal(result.status, "active"); const birthday = intentionFromText("Mum's birthday is Saturday", "Africa/Lagos", new Date("2026-09-25T10:00:00.000Z")); assert.equal(birthday.title, "Mum's birthday"); });
test("pack types extend existing Life contexts", () => { assert.equal(packTypeFor(context("Lagos trip", "trip")), "travel"); assert.equal(packTypeFor(context("Mum birthday", "event")), "event"); assert.equal(packTypeFor(context("Backend learning project", "project")), "learning"); });
test("travel pack matches grounded memories and rejects unrelated content", async () => { const life = context("Lagos trip", "trip"); const matches = await matchPackMemories(life, [memory("Lagos restaurant recommendation"), memory("Lagos hotel review"), memory("FastAPI tutorial"), memory("Chocolate cake")], "travel"); assert.equal(matches.length, 2); assert.deepEqual(matches.map((match) => match.section).sort(), ["Food", "Stay"]); });
test("travel matching requires the destination anchor and has a valid zero-match state", async () => { const life = context("I'm going to Lagos next Saturday", "trip"); assert.deepEqual(await matchPackMemories(life, [memory("Restaurant recommendations"), memory("Hotel review"), memory("Python tutorial")], "travel"), []); });
test("learning matching requires backend subject overlap and rejects cake tutorials", async () => { const life = context("My backend presentation", "project"); const matches = await matchPackMemories(life, [memory("Python backend tutorial"), memory("FastAPI tutorial"), memory("Red Velvet Cake tutorial"), memory("No-Bake Cake tutorial")], "learning"); assert.deepEqual(matches.map((item) => item.memory.title).sort(), ["FastAPI tutorial", "Python backend tutorial"]); });
test("birthday role classifier rejects shawarma and kebab from cake ideas", async () => { const life = context("Mum birthday", "event"); const matches = await matchPackMemories(life, [memory("Moist Chocolate Cake"), memory("Butterfly Cake"), memory("Vanilla Cake"), memory("Beef Shawarma recipe"), memory("Doner Kebab recipe")], "event"); assert.deepEqual(matches.map((item) => item.memory.title).sort(), ["Butterfly Cake", "Moist Chocolate Cake", "Vanilla Cake"]); assert.ok(matches.every((item) => item.section === "Cake ideas")); });
test("event role classifier accepts a visual cake but not arbitrary food", async () => { const life = context("Mum birthday", "event"); const cake = memory("Made this today", "Heart-shaped decorated cake"); cake.analysisMetadata = { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "butterfly cake", source: "thumbnail", strength: "direct" }] }; const matches = await matchPackMemories(life, [cake, memory("Chicken recipe")], "event"); assert.equal(matches[0]?.section, "Cake ideas"); });
test("gift and place role gates require role evidence", async () => { const life = context("Mum birthday", "event"); const matches = await matchPackMemories(life, [memory("Gift ideas for Mum"), memory("Restaurant for a birthday"), memory("Pancake recipe")], "event"); assert.deepEqual(matches.map((item) => item.section).sort(), ["Gift ideas", "Places to go"]); });
test("gap detection stays advisory and does not create fake memories", () => { assert.deepEqual(gapSections("travel", [{ section: "Places" }, { section: "Food" }]), ["Stay", "Travel tips"]); assert.deepEqual(gapSections("event", [{ section: "Cake ideas" }]), ["Gift ideas", "Places to go", "Activities"]); });
test("selection prompt initially caps at three and supports show more", () => { const options = [1, 2, 3, 4, 5]; assert.deepEqual(optionSlice(options), [1, 2, 3]); assert.equal(optionSlice(options, true).length, 5); });
test("natural-language selection resolves one unique option only", () => { const options = [{ id: "cake", title: "Butterfly Cake" }, { id: "pie", title: "Banana Pie" }]; assert.equal(resolveNaturalSelection("the butterfly one", options), "cake"); assert.equal(resolveNaturalSelection("none of them", options), null); });
test("active duplicate Packs canonicalize to one per intention", () => { const packs = [{ id: "one", userId, lifeContextId: "ctx", status: "active", createdAt: "2026-09-25T00:00:00Z" }, { id: "two", userId, lifeContextId: "ctx", status: "active", createdAt: "2026-09-26T00:00:00Z" }]; assert.deepEqual(dedupePacks(packs).map((item) => item.id), ["one"]); });
test("scoped Home routing leaves generic knowledge questions unpersisted", () => { assert.equal(classifyHomeIntent("Who is the president of France?"), "UNKNOWN"); assert.equal(classifyHomeIntent("Where is that orange juice video?"), "SEARCH_MEMORY"); });

test("hey hi is a deterministic greeting and is not an intention", () => {
  assert.equal(classifyHomeConversation("Hey hi"), "GREETING");
  assert.equal(isHomeLocalFastIntent(classifyHomeConversation("Hey hi")), true);
  assert.equal(isExplicitIntention("Hey hi"), false);
  assert.match(homeFastReply("GREETING", "Hey hi") || "", /What are you working on today/);
  assert.equal(classifyHomeIntent("Hey hi"), "UNKNOWN");
});
test("casual acknowledgements, help, and capability questions stay out of persistence", () => {
  for (const text of ["Thanks", "Okay", "Cool", "Tell me what you can do", "Help", "What do you mean?", "Why did you recommend that?", "Show me more", "No", "Yes"]) assert.notEqual(classifyHomeConversation(text), "CREATE_INTENTION", text);
  assert.equal(classifyHomeConversation("Thanks"), "ACKNOWLEDGEMENT");
  assert.equal(classifyHomeConversation("What can you help me with?"), "CAPABILITY_QUESTION");
  assert.match(homeFastReply("CAPABILITY_QUESTION") || "", /find things you've saved/);
});
test("explicit plan statements still route to intention creation", () => {
  assert.equal(classifyHomeConversation("I'm going to Lagos next Saturday"), "CREATE_INTENTION");
  assert.equal(classifyHomeConversation("Mum's birthday is Saturday"), "CREATE_INTENTION");
  assert.equal(classifyHomeConversation("My backend presentation is Friday"), "CREATE_INTENTION");
  assert.equal(classifyHomeConversation("What did I save about my maths exam?"), "SEARCH_MEMORY");
  assert.equal(classifyHomeConversation("What do you remember about Lagos?"), "SEARCH_MEMORY");
  assert.equal(shouldSupersedePackDraft("I'm going to Lagos next Saturday", true), true);
  assert.equal(shouldSupersedePackDraft("the butterfly one", true), false);
});
test("conversational memory selection resolves second and named options", () => {
  const options = [{ id: "chocolate", title: "Moist Chocolate Cake" }, { id: "butterfly", title: "Butterfly Cake" }, { id: "velvet", title: "Red Velvet Cake" }];
  assert.equal(classifyHomeConversation("the second one", { hasOptions: true }), "MEMORY_SELECTION");
  assert.equal(resolveConversationSelection("the second one", options), "butterfly");
  assert.equal(resolveConversationSelection("I like the butterfly one", options), "butterfly");
  assert.equal(resolveConversationSelection("actually use the red velvet one", options), "velvet");
  assert.deepEqual(replaceSectionSelection(["butterfly"], "velvet", [{ id: "butterfly", section: "Cake ideas" }, { id: "velvet", section: "Cake ideas" }]), ["velvet"]);
});
test("natural imperfect visual searches route to Memory search and normalize the cake-apron relationship", () => {
  const query = "I am looking for a Cake video where the cake was an apron";
  assert.equal(classifyHomeConversation(query), "SEARCH_MEMORY");
  assert.equal(homeSearchQuery(query), "apron shaped cake");
  const options = [{ id: "owerri", title: "Cakes in Owerri", concepts: ["apron-shaped cake", "cake designed to resemble a chef apron"] }, { id: "other", title: "Chocolate cake", concepts: ["cake"] }];
  assert.equal(resolveConversationSelection("No, the apron-shaped one", options), "owerri");
});
test("visual follow-up explanation uses only analyzed relationship evidence", () => {
  const cake = memory("Cakes in Owerri");
  cake.analysisMetadata = { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [], visualEvidence: { source: "thumbnail", analyzed: true, visualDescription: "A chef jacket-themed cake on a table.", concepts: ["novelty cake"] } };
  assert.equal(groundedVisualMatchExplanation(cake), "The source preview describes the cake as chef-jacket-themed.");
  cake.analysisMetadata.visualEvidence = { source: "thumbnail", analyzed: false, concepts: ["chef jacket-themed cake"] };
  assert.equal(groundedVisualMatchExplanation(cake), null);
});
test("chef-jacket clarification candidate requires analyzed visual evidence", () => {
  const item = memory("Cakes in Owerri");
  item.analysisMetadata = { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [], visualEvidence: { source: "thumbnail", analyzed: true, visualDescription: "A chef jacket-themed cake on a table.", concepts: ["novelty cake"] } };
  assert.equal(isChefJacketThemeCandidate(item), true);
  const unverified = memory("Cakes in Owerri");
  unverified.analysisMetadata = { ...item.analysisMetadata, visualEvidence: { ...item.analysisMetadata.visualEvidence!, analyzed: false } };
  assert.equal(isChefJacketThemeCandidate(unverified), false);
});
test("Account bottom navigation uses the dedicated profile icon", () => {
  const navigation = readFileSync(new URL("../src/components/layout/navigation.tsx", import.meta.url), "utf8");
  assert.match(navigation, /label: "Account", icon: IC\.account/);
  assert.match(readFileSync(new URL("../src/components/design/icons.tsx", import.meta.url), "utf8"), /account:\s*<svg/);
});
test("show more and yes/no use pending conversational context without creating plans", () => {
  assert.equal(classifyHomeConversation("show me more", { hasOptions: true }), "SHOW_MORE");
  assert.equal(classifyHomeConversation("yes", { awaitingConfirmation: true }), "PACK_SELECTION");
  assert.equal(classifyHomeConversation("no"), "ACKNOWLEDGEMENT");
});
test("greetings and general questions have deterministic fast replies", () => {
  assert.equal(classifyHomeConversation("How are you?"), "GREETING");
  assert.equal(classifyHomeConversation("Who invented the telephone?"), "OUT_OF_SCOPE");
  assert.match(homeFastReply("OUT_OF_SCOPE") || "", /things you've saved/);
});
test("no-match plan acknowledgement stays attached to the current plan", () => {
  assert.match(homeFastReply("ACKNOWLEDGEMENT", "Okay", { hasPlan: true, planTitle: "Lagos Trip" }) || "", /Lagos Trip/);
});

function packItem(memoryId: string, section: string, packId = "pack") {
  return { id: crypto.randomUUID(), userId, readyPackId: packId, memoryId, section, relevanceReason: "Grounded match", relevanceStrength: "strong" as const, createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z" };
}
test("Ready Pack keeps 11 candidates separate and finalizes only the explicitly selected Memory", () => {
  const candidates = Array.from({ length: 11 }, (_, index) => ({ id: `m${index}`, section: "Cake ideas" }));
  const sections = packSections("event", candidates);
  const selected = selectSectionMemory({}, "Cake ideas", "m4");
  const persisted = reconcilePackItems(candidates.slice(0, 7).map((item) => packItem(item.id, item.section)), [{ memoryId: "m4", section: "Cake ideas" }], sections);
  assert.equal(candidates.length, 11);
  assert.deepEqual(selected, { "Cake ideas": ["m4"] });
  assert.deepEqual(persisted.map((item) => item.memoryId), ["m4"]);
});
test("multi-section Ready Pack persists one selected Memory per chosen section, not all candidates", () => {
  const candidates = ["Places", "Places", "Places", "Food", "Food", "Stay", "Stay"].map((section, index) => ({ id: `m${index}`, section }));
  const sections = packSections("travel", candidates);
  const selections = { Places: ["m1"], Food: ["m4"], Stay: ["m5"] };
  const persisted = reconcilePackItems([], Object.entries(selections).flatMap(([section, ids]) => ids.map((memoryId) => ({ memoryId, section }))), sections);
  assert.equal(candidates.length, 7);
  assert.equal(persisted.length, 3);
  assert.deepEqual(persisted.map((item) => item.memoryId), ["m1", "m4", "m5"]);
});
test("reselecting within one section replaces the previous draft choice", () => {
  const selected = selectSectionMemory({ "Cake ideas": ["old"] }, "Cake ideas", "new");
  assert.deepEqual(selected, { "Cake ideas": ["new"] });
  assert.deepEqual(selectedPackMemoryIds(selected), ["new"]);
});
test("rebuilding a legacy Pack reconciles handled sections and preserves untouched sections", () => {
  const old = [packItem("old-cake-1", "Cake ideas"), packItem("old-cake-2", "Cake ideas"), packItem("manual-note", "Personal notes")];
  const next = reconcilePackItems(old, [{ memoryId: "new-cake", section: "Cake ideas" }], ["Cake ideas"]);
  assert.deepEqual(next.map((item) => item.memoryId), ["manual-note", "new-cake"]);
});
test("explicitly rebuilding cake ideas also replaces the legacy generated cake section", () => {
  const controlled = controlledPackSections(["Cake ideas"]);
  const old = [packItem("old-cake", "Cake / food ideas"), packItem("newer-cake", "Cake ideas"), packItem("personal", "Personal notes")];
  const next = reconcilePackItems(old, [{ memoryId: "chosen", section: "Cake ideas" }], controlled);
  assert.deepEqual(next.map((item) => item.memoryId), ["personal", "chosen"]);
});
test("confirmed empty roles clear stale generated choices while unrelated manual sections survive", () => {
  const roles = controlledPackSections(["Cake ideas", "Gift ideas", "Places to go", "Activities"]);
  const old = [packItem("old-cake", "Cake / food ideas"), packItem("old-gift", "Gift ideas"), packItem("note", "Personal notes")];
  const next = reconcilePackItems(old, [{ memoryId: "chosen-cake", section: "Cake ideas" }], roles);
  assert.deepEqual(next.map((item) => item.memoryId), ["note", "chosen-cake"]);
});
test("date corrections extract only explicit replacement dates", () => {
  assert.equal(extractDateCorrectionPhrase("No, I meant next Friday."), "next Friday");
  assert.equal(extractDateCorrectionPhrase("Actually use the red velvet one."), null);
});
test("near-duplicate intentions merge while different dates remain separate", () => { const first = context("Lagos", "trip"); const same = { ...first, title: "My Lagos trip", startDate: first.startDate }; const later = { ...same, startDate: "2026-12-03T09:00:00.000Z" }; assert.equal(isDuplicateLifeContext(first, same), true); assert.equal(isDuplicateLifeContext(first, later), false); });
test("Home session Memory payload is bounded while retaining card and recipe fields", () => {
  const source = { ...memory("Red Velvet Cake", "A saved recipe"), rawText: "private source text".repeat(10000), evidenceSources: [{ caption: "long caption".repeat(10000), transcript: "long transcript".repeat(10000), thumbnail: "https://example.com/thumb.jpg" }], analysisMetadata: { status: "complete" as const, confidence: 0.9, warnings: [], evidenceSources: [], structuredContent: { ingredients: ["flour"], steps: ["mix"] } } };
  const compact = compactSessionMemory(source);
  assert.equal(compact.rawText, null);
  assert.equal(compact.evidenceSources[0]?.caption, undefined);
  assert.equal(compact.evidenceSources[0]?.thumbnail, "https://example.com/thumb.jpg");
  assert.deepEqual(compact.analysisMetadata?.structuredContent, { ingredients: ["flour"], steps: ["mix"] });
  assert.ok(JSON.stringify(compact).length < 10_000);
});
test("Home session compaction tolerates legacy analysis metadata without evidenceSources", () => {
  const legacy = { ...memory("Older saved cake"), analysisMetadata: { status: "partial" as const, confidence: null, warnings: [] } as unknown as Memory["analysisMetadata"] };
  assert.deepEqual(compactSessionMemory(legacy).analysisMetadata?.evidenceSources, []);
});
test("Home session compaction tolerates malformed optional legacy evidence arrays", () => {
  const legacy = { ...memory("Older saved cake"), analysisMetadata: { status: "partial" as const, confidence: null, warnings: [undefined], visualEvidence: { source: "thumbnail", analyzed: true } } as unknown as Memory["analysisMetadata"] };
  const compact = compactSessionMemory(legacy);
  assert.deepEqual(compact.analysisMetadata?.warnings, []);
  assert.deepEqual(compact.analysisMetadata?.visualEvidence?.concepts, []);
});
