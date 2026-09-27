"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { MemoryCard, savedDate, thumbnailFor } from "@/components/design/memory";
import { optionSlice } from "@/lib/plans/service";
import { classifyHomeConversation, extractDateCorrectionPhrase, groundedVisualMatchExplanation, homeFastReply, reportHomeRoute, resolveConversationSelection, shouldSupersedePackDraft, startHomeRouteTimer } from "@/lib/plans/conversation";
import { resolveRelativeDate } from "@/lib/integration/relative-date";
import { expectedPackSections, packSections, selectSectionMemory, selectedPackMemoryIds } from "@/lib/plans/finalization";
import type { LifeContext, Memory } from "@/types/reibry";
import { useHomeConversation, type HomeMatch as Match, type HomeTurn as Turn, type HomePackDraft as PackDraft } from "@/components/home/home-conversation-provider";
import { isHomeRejection, isSearchRefinement, lastRejectedCandidate } from "@/lib/agent/home-agent";

type HomeResult = { intent: string; message?: string; query?: string; exact?: boolean; results?: Array<{ memory: Memory }>; context?: LifeContext; matches?: Match[]; packType?: string | null; contexts?: LifeContext[]; packs?: Array<{ id: string; title: string; context?: LifeContext | null }> };

function packSummary(draft: PackDraft) {
  const selected = new Set(Object.values(draft.selectedBySection).flat());
  const lines = draft.sections.map((section) => {
    const choice = draft.matches.find((match) => match.section === section && selected.has(match.memory.id));
    return choice ? `${section}: ${choice.memory.title}` : `No ${section.toLowerCase()} saved yet`;
  });
  return `Here’s what we’ve got:\n${lines.join("\n")}\nReady to save this?`;
}

export default function Home() {
  const { state: conversation, setTurns, setDraft, setShowMore, setLastOptions, setSearchCandidates, setAwaitingMemoryConfirmation, setLastRecommendation, setActivePlanTitle, setSearchTopic, setRejectedMemoryIds, newChat } = useHomeConversation();
  const { turns, draft, showMore, lastOptions, searchCandidates, awaitingMemoryConfirmation, lastRecommendation, activePlanTitle, searchTopic, rejectedMemoryIds } = conversation;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proactive, setProactive] = useState<Array<{ id: string; title: string; itemCount: number; date: string | null }>>([]);
  const sequence = useRef(0);
  const turnIds = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function appendTurns(...items: Turn[]) { setTurns((current) => [...current, ...items].slice(-24)); }

  function startBuilder(context: LifeContext, matches: Match[], type: "travel" | "event" | "learning") {
    const candidateSections = packSections(type, matches.map((item) => ({ id: item.memory.id, section: item.section })));
    const sections = expectedPackSections(type);
    const missingSections = sections.filter((section) => !candidateSections.includes(section));
    const nextDraft: PackDraft = { context, matches, type, sections, candidateSections, currentSection: candidateSections[0] || null, selectedBySection: {}, handledSections: missingSections, awaitingConfirmation: candidateSections.length === 0 };
    setDraft(nextDraft); setLastOptions(matches); setSearchCandidates(matches); setShowMore(false);
    if (candidateSections.length) appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: `${type === "event" ? `Let's choose a ${candidateSections[0].toLowerCase().replace(/s$/, "")}` : `Let's choose something for ${candidateSections[0].toLowerCase()}`} first.${missingSections.length ? ` I couldn't find saved ${missingSections[0].toLowerCase()} yet.` : ""}`, context, matches: matches.filter((item) => item.section === candidateSections[0]), actions: [{ label: `Skip ${candidateSections[0].toLowerCase()}`, action: "skip-section" }] } });
    else appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "summary", text: `I couldn't find any saved items that clearly fit ${context.title}. You can keep it as a plan without a Ready Pack.`, context } });
  }

  useEffect(() => {
    fetch("/api/ready-packs", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      const packs = (body.data || []) as Array<{ id: string; title: string; status: string; memoryCount?: number; context?: { startDate: string | null } }>;
      const canonical = new Map(packs.map((pack) => [pack.id, pack]));
      setTurns((current) => current.map((turn) => {
        const saved = turn.block?.kind === "pack" && turn.block.packId ? canonical.get(turn.block.packId) : null;
        if (!saved || !turn.block) return turn;
        const count = saved.memoryCount || 0;
        return { ...turn, block: { ...turn.block, text: `Done — your ${saved.title} Ready Pack is ready with ${count} saved ${count === 1 ? "Memory" : "Memories"}.` } };
      }));
      setProactive(packs.filter((pack) => pack.status === "active" && pack.context?.startDate && Date.parse(pack.context.startDate) >= Date.now()).slice(0, 2).map((pack) => ({ id: pack.id, title: pack.title, date: pack.context?.startDate || null, itemCount: pack.memoryCount || 0 })));
    }).catch(() => undefined);
  }, [setTurns]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "end" }); }, [turns, loading]);
  useEffect(() => { if (!text && textareaRef.current) textareaRef.current.style.height = "44px"; }, [text]);

  async function finalizePack() {
    if (!draft) return;
    // Final confirmation covers every displayed role, including empty/skipped roles, so stale generated rows are cleared too.
    const selections = Object.fromEntries(draft.sections.map((section) => [section, draft.selectedBySection[section] || []]));
    setLoading(true); setError(""); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "Putting your Ready Pack together…" } });
    try {
      const response = await fetch("/api/ready-packs", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ lifeContextId: draft.context.id, selections }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "That plan could not be saved.");
      const canonical = body.data.pack;
      const count = Number.isInteger(body.data.memoryCount) ? body.data.memoryCount : body.data.items?.length || 0;
      setTurns((current) => [...current.filter((turn) => turn.block?.text !== "Putting your Ready Pack together…"), { id: ++turnIds.current, role: "assistant" as const, block: { kind: "pack" as const, text: `Done — your ${canonical.title} Ready Pack is ready with ${count} saved ${count === 1 ? "Memory" : "Memories"}.`, packId: canonical.id } }].slice(-24));
      setDraft(null);
      setProactive((current) => [{ id: canonical.id, title: canonical.title, itemCount: count, date: draft.context.startDate }, ...current.filter((item) => item.id !== canonical.id)].slice(0, 2));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That plan could not be saved."); }
    finally { setLoading(false); }
  }

  function chooseMemory(match: Match, fromButton = false) {
    if (!draft) return;
    setLastOptions([match]);
    const selectedBySection = selectSectionMemory(draft.selectedBySection, match.section, match.memory.id);
    const handledSections = [...new Set([...draft.handledSections, match.section])];
    const nextSection = draft.candidateSections.find((section) => !handledSections.includes(section)) || null;
    const nextDraft = { ...draft, selectedBySection, handledSections, currentSection: nextSection, awaitingConfirmation: !nextSection };
    setDraft(nextDraft);
    appendTurns(...(fromButton ? [{ id: ++turnIds.current, role: "user" as const, text: `Use ${match.memory.title}` }] : []), nextSection
      ? { id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: `Nice — ${match.memory.title} is in. I also found ${nextSection.toLowerCase()} you could use. Choose one or skip this section.`, context: draft.context, matches: draft.matches.filter((item) => item.section === nextSection), actions: [{ label: `Skip ${nextSection.toLowerCase()}`, action: "skip-section" }] } }
      : { id: ++turnIds.current, role: "assistant", block: { kind: "summary", text: packSummary(nextDraft), actions: [{ label: "Save Ready Pack", action: "save-pack" }] } });
  }

  function runBlockAction(action: "continue" | "show-more" | "save-pack" | "skip-section") {
    if (action === "show-more" && draft) { setShowMore(true); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: "Here are more relevant choices.", context: draft.context, matches: draft.matches } }); }
    if (action === "save-pack" && draft) void finalizePack();
    if ((action === "continue" || action === "skip-section") && draft?.currentSection) {
      const handledSections = [...new Set([...draft.handledSections, draft.currentSection])];
      const nextSection = draft.candidateSections.find((section) => !handledSections.includes(section)) || null;
      const nextDraft = { ...draft, handledSections, currentSection: nextSection, awaitingConfirmation: !nextSection };
      setDraft(nextDraft);
      if (nextSection) appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: `You can choose one ${nextSection.toLowerCase()} or skip it.`, context: draft.context, matches: draft.matches.filter((item) => item.section === nextSection), actions: [{ label: `Skip ${nextSection.toLowerCase()}`, action: "skip-section" }] } });
      else appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "summary", text: packSummary(nextDraft), actions: [{ label: "Save Ready Pack", action: "save-pack" }] } });
    }
  }

  async function handleDraftMessage(value: string) {
    if (!draft) return;
    const intent = classifyHomeConversation(value, { hasPlan: true, hasOptions: draft.matches.length > 0, awaitingConfirmation: draft.awaitingConfirmation });
    const normalized = value.toLowerCase().trim();
    if (intent === "GREETING" || intent === "ACKNOWLEDGEMENT" || intent === "CAPABILITY_QUESTION") {
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: homeFastReply(intent, value, { hasPlan: true, planTitle: draft.context.title }) || "What would you like to do next?" } }); return;
    }
    if (intent === "SHOW_MORE") { setShowMore(true); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: "Here are more relevant choices.", context: draft.context, matches: draft.matches } }); return; }
    if (/\b(show me|show) (the )?(cakes?|gifts?|places?)\b/.test(normalized)) {
      const section = /gift/.test(normalized) ? "Gift ideas" : /place/.test(normalized) ? "Places to go" : "Cake ideas";
      const matches = draft.matches.filter((item) => item.section === section);
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: matches.length ? `Here are the ${section.toLowerCase()} I found.` : `I couldn't find ${section.toLowerCase()} in your Memories yet.`, context: draft.context, matches } }); return;
    }
    const correctedDate = extractDateCorrectionPhrase(value);
    if (correctedDate) {
      const resolved = resolveRelativeDate({ value: correctedDate, referenceNow: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (resolved.iso) {
        setLoading(true);
        try {
          const response = await fetch(`/api/life/${encodeURIComponent(draft.context.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: resolved.iso }) });
          const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "That date couldn't be updated.");
          const context = body.data as LifeContext; setDraft({ ...draft, context }); setActivePlanTitle(context.title);
          appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `Updated — ${context.title} is now set for ${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(resolved.iso))}.` } });
        } catch (cause) { appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: cause instanceof Error ? cause.message : "That date couldn't be updated." } }); }
        finally { setLoading(false); }
        return;
      }
    }
    if (/\b(which one|what do you recommend|which would you pick|recommend)\b/.test(normalized)) {
      const completeRecipe = draft.matches.find(({ memory }) => {
        const data = memory.analysisMetadata?.structuredContent;
        return Array.isArray(data?.ingredients) && data.ingredients.length > 0 && Array.isArray(data?.steps) && data.steps.length > 0;
      });
      const pick = completeRecipe || draft.matches[0];
      if (!pick) { appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "I haven't found any saved options to compare yet." } }); return; }
      const data = pick.memory.analysisMetadata?.structuredContent;
      const reason = Array.isArray(data?.ingredients) && data.ingredients.length && Array.isArray(data?.steps) && data.steps.length ? "it includes ingredient and step details" : `it's the closest match I found for ${draft.context.title}`;
      setLastRecommendation({ title: pick.memory.title, reason });
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `I'd start with ${pick.memory.title} because ${reason}.` } }); return;
    }
    if (/^why\??$/.test(normalized) && lastRecommendation) { appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `${lastRecommendation.title} stood out because ${lastRecommendation.reason}.` } }); return; }
    if (/\b(none of these|none of them|don't like any|do not like any)\b/.test(normalized)) { appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "No problem. I won't add any of those. You can show me more or continue without choosing one.", actions: [{ label: "Show me more", action: "show-more" }] } }); return; }
    const selectedIds = selectedPackMemoryIds(draft.selectedBySection);
    if (draft.awaitingConfirmation && /^(yes|yeah|yep|continue|let's do it|do it|sounds good|i'll add something later|save (it|this))$/i.test(normalized)) { await finalizePack(); return; }
    if (draft.awaitingConfirmation && /^(no|nope|not yet)$/i.test(normalized)) { setDraft({ ...draft, awaitingConfirmation: false }); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "No rush. You can change a choice or come back to this Ready Pack later." } }); return; }
    if (/\b(remove|take off|delete) (?:that|it|the last one)\b/.test(normalized) && selectedIds.length) {
      const removedId = selectedIds.at(-1)!; const removed = draft.matches.find((item) => item.memory.id === removedId);
      const selectedBySection = { ...draft.selectedBySection }; if (removed) selectedBySection[removed.section] = [];
      setDraft({ ...draft, selectedBySection, handledSections: draft.handledSections.filter((section) => section !== removed?.section), currentSection: removed?.section || draft.currentSection, awaitingConfirmation: false });
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `${removed?.memory.title || "That Memory"} is out of the pack. Choose another option or skip that section.` } }); return;
    }
    if (/^(let's do it|build my ready pack|build (my )?(trip|birthday|learning) pack)$/i.test(normalized)) {
      if (draft.awaitingConfirmation) appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "summary", text: packSummary(draft), actions: [{ label: "Save Ready Pack", action: "save-pack" }] } });
      else if (draft.currentSection) appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: `Choose one ${draft.currentSection.toLowerCase()} or skip it.`, context: draft.context, matches: draft.matches.filter((item) => item.section === draft.currentSection), actions: [{ label: `Skip ${draft.currentSection.toLowerCase()}`, action: "skip-section" }] } });
      return;
    }
    const currentCandidates = draft.currentSection ? draft.matches.filter((match) => match.section === draft.currentSection) : draft.matches;
    const selection = resolveConversationSelection(value, currentCandidates.map((match) => ({ id: match.memory.id, title: match.memory.title, concepts: [...(match.memory.analysisMetadata?.visualEvidence?.concepts || []), ...(match.memory.analysisMetadata?.semanticConcepts || []).map((entry) => entry.concept)] })));
    const choice = selection;
    if (choice) { const selected = currentCandidates.find((item) => item.memory.id === choice); if (selected) { chooseMemory(selected); return; } }
    appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: draft.currentSection ? `Which ${draft.currentSection.toLowerCase()} would you like to use?` : "Which saved item would you like to use?", context: draft.context, matches: currentCandidates } });
  }

  async function submit(event?: FormEvent, overrideMessage?: string) {
    event?.preventDefault();
    const value = (overrideMessage ?? text).trim();
    if (!value) return;
    const id = ++sequence.current;
    activeController.current?.abort();
    activeController.current = null;
    setLoading(false);
    appendTurns({ id: ++turnIds.current, role: "user", text: value });
    setText("");
    if (awaitingMemoryConfirmation && /^(yes|yeah|yep|that one|that's the one|no|nope|not that one)$/i.test(value)) {
      setAwaitingMemoryConfirmation(false);
      if (/^(yes|yeah|yep|that one|that's the one)$/i.test(value) && lastOptions[0]) appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: `Okay — “${lastOptions[0].memory.title}” is the closest saved match.`, results: [{ memory: lastOptions[0].memory }] } });
      else { if (lastOptions[0]) setRejectedMemoryIds((current) => [...new Set([...current, lastOptions[0].memory.id])].slice(-12)); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "No problem — I’ll leave that one out. What shape or detail do you remember?" } }); }
      return;
    }
    if (awaitingMemoryConfirmation) setAwaitingMemoryConfirmation(false);
    const supersedesDraft = shouldSupersedePackDraft(value, Boolean(draft));
    if (draft && !supersedesDraft) { await handleDraftMessage(value); return; }
    if (supersedesDraft) setDraft(null);

    if (isHomeRejection(value) && lastOptions.length) {
      const [rejected, ...remaining] = lastOptions;
      setRejectedMemoryIds((current) => [...new Set([...current, rejected.memory.id])].slice(-12));
      setLastOptions(remaining);
      if (remaining.length) {
        appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: `Got it — I’ve left “${rejected.memory.title}” out. Here’s the next closest saved match.`, results: remaining.slice(0, 1).map(({ memory }) => ({ memory })) } });
        return;
      }
      // Ask the same bounded search again with the rejected id excluded.
    }
    const routeStarted = startHomeRouteTimer();
    const hasMemoryOptions = lastOptions.length > 0 || searchCandidates.length > 0;
    const intent = classifyHomeConversation(value, { hasOptions: hasMemoryOptions });
    const contextualCandidateTurn = hasMemoryOptions && ["CLARIFICATION", "MEMORY_SELECTION", "SHOW_MORE", "SEARCH_REFINEMENT"].includes(intent);
    const continuingSearch = isSearchRefinement(value, searchTopic) || isHomeRejection(value) || contextualCandidateTurn;
    if (!continuingSearch) { setRejectedMemoryIds([]); setLastOptions([]); setSearchCandidates([]); setSearchTopic(null); }
    const fastReply = homeFastReply(intent, value, { hasPlan: Boolean(activePlanTitle), planTitle: activePlanTitle || undefined });
    if (fastReply && !(intent === "MEMORY_REJECTION" && searchCandidates.length > 0)) {
      reportHomeRoute(intent, routeStarted);
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: fastReply } }); return;
    }
    if (intent === "SHOW_MORE" && searchCandidates.length) {
      const lastAssistant = turns.at(-1)?.block?.text || "";
      const selectedId = /^Yep — that’s “/.test(lastAssistant) ? lastOptions[0]?.memory.id : null;
      const more = searchCandidates.filter(({ memory }) => !rejectedMemoryIds.includes(memory.id) && memory.id !== selectedId);
      setLastOptions(more);
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: "Here are the other close matches I found.", results: more.map(({ memory }) => ({ memory })) } }); return;
    }
    if (intent === "CLARIFICATION" && lastRecommendation && /^why\??$/i.test(value)) {
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `${lastRecommendation.title} stood out because ${lastRecommendation.reason}.` } }); return;
    }
    if (intent === "CLARIFICATION" && (lastOptions.length || lastRejectedCandidate<Memory>(turns)) && /why did (?:you )?(?:pick|match)|why this one/i.test(value)) {
      const candidate = lastOptions[0]?.memory || lastRejectedCandidate<Memory>(turns)!;
      const visualReason = groundedVisualMatchExplanation(candidate);
      const reason = visualReason || candidate.summary || "Its saved title and details are the closest match to what you described.";
      const rejected = lastOptions.length === 0;
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: rejected ? `I suggested “${candidate.title}” because ${reason} Since you said it wasn't the one, I’ll keep it excluded. What detail should I look for instead?` : `I picked ${candidate.title} because ${reason}` } }); return;
    }
    if (intent === "CLARIFICATION" && lastOptions.length && /when did i save|when was (?:it|this) saved|what day did i save/i.test(value)) {
      const saved = lastOptions[0].memory;
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: `You saved “${saved.title}” ${savedDate(saved.createdAt)}.` } }); return;
    }
    if (intent === "CLARIFICATION" && lastOptions.length && /\b(none of these|none of them|don't like any|do not like any)\b/i.test(value)) {
      appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "No worries. Want to describe what you remember differently, or should I leave it there?" } }); return;
    }
    if (intent === "MEMORY_SELECTION" && hasMemoryOptions) {
      const options = (searchCandidates.length ? searchCandidates : lastOptions).filter((item) => !rejectedMemoryIds.includes(item.memory.id));
      const selectedId = resolveConversationSelection(value, options.map((item) => ({ id: item.memory.id, title: item.memory.title, concepts: [...(item.memory.analysisMetadata?.visualEvidence?.concepts || []), ...(item.memory.analysisMetadata?.semanticConcepts || []).map((entry) => entry.concept)] })));
      const selected = options.find((item) => item.memory.id === selectedId);
      if (selected) { setLastOptions([selected]); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: `Yep — that’s “${selected.memory.title}.”`, results: [{ memory: selected.memory }] } }); return; }
    }
    const controller = new AbortController(); activeController.current = controller;
    setLoading(true); setError("");
    try {
      const recentTurns = turns.slice(-8).map((turn) => ({ role: turn.role, text: (turn.role === "user" ? turn.text || "" : turn.block?.text || "").slice(0, 500) }));
      const excludedIds = isHomeRejection(value) && lastOptions[0] ? [...new Set([...rejectedMemoryIds, lastOptions[0].memory.id])] : rejectedMemoryIds;
      const response = await fetch("/api/home", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ text: value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, conversation: { recentTurns, currentTopic: continuingSearch ? searchTopic : null, candidateMemoryIds: continuingSearch ? searchCandidates.map((item) => item.memory.id).slice(0, 12) : [], rejectedMemoryIds: continuingSearch ? excludedIds.slice(-12) : [], selectedMemoryId: lastOptions[0]?.memory.id || null, hasPlan: Boolean(draft || activePlanTitle), planTitle: draft?.context.title || activePlanTitle } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "REIBRY could not complete that request.");
      const result = body.data as HomeResult;
      if (id !== sequence.current) return;
      if (result.intent === "SEARCH_MEMORY") {
        const results = result.results || [];
        const matches = results.map((item) => ({ memory: item.memory, section: "Memory", relevanceReason: "A close match from your Memories." }));
        if (!isSearchRefinement(value, searchTopic) && !isHomeRejection(value)) setRejectedMemoryIds([]);
        setSearchTopic(result.query || (isSearchRefinement(value, searchTopic) ? `${searchTopic} ${value}` : value));
        setLastOptions(matches); setSearchCandidates(matches);
        appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: result.message || (results.length ? `I found ${results.length} close ${results.length === 1 ? "Memory" : "Memories"}.` : "I couldn't find anything close to that in your Memories."), results } });
      } else if (result.intent === "CLARIFICATION" && result.results?.length) {
        const results = result.results;
        const matches = results.map((item) => ({ memory: item.memory, section: "Memory", relevanceReason: "A possible visual match from your saved preview." }));
        setLastOptions(matches); setSearchCandidates(matches); setAwaitingMemoryConfirmation(true);
        appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "search", text: result.message || "Is this the saved item you meant?", results } });
      } else if (result.intent === "SHOW_UPCOMING") {
        const plans = (result.packs || []).map((pack) => ({ id: pack.id, title: pack.title, date: pack.context?.startDate || null }));
        appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "upcoming", text: plans.length ? "Here are your active plans." : "You don't have any upcoming plans yet.", plans } });
      } else if (result.intent === "UNKNOWN" || result.intent === "OUT_OF_SCOPE" || result.intent === "SCOPED_CONVERSATION") {
        appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: result.message || "I'm here to help with your Memories and plans. Tell me a little more, or ask about something you've saved." } });
      } else if (result.context) {
        const context = result.context; const matches = result.matches || [];
        setActivePlanTitle(context.title);
        setLastOptions(matches); setSearchCandidates(matches);
        appendTurns({ id: ++turnIds.current, role: "assistant", block: matches.length ? { kind: "intention", text: `Got it. I found ${matches.length} saved ${matches.length === 1 ? "item" : "items"} that may help with ${context.title}.`, context, matches } : { kind: "intention", text: `Got it — ${context.title}. I don't have anything saved about it yet. If you save related ideas, I can connect them to this plan.`, context, matches: [] } });
        // Candidate Memories remain read-only until the user starts the builder.
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (id === sequence.current) { setError(cause instanceof Error ? cause.message : "REIBRY could not complete that request."); setText(value); }
    } finally { if (id === sequence.current) setLoading(false); }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const desktopKeyboard = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (desktopKeyboard && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
  }
  function chooseSuggestion(value: string) { setText(value); textareaRef.current?.focus(); }
  function startNewChat() { activeController.current?.abort(); activeController.current = null; sequence.current += 1; setLoading(false); setError(""); setText(""); newChat(); }

  return <RequireAuth><PageContainer className={`home-page${turns.length ? " home-page-conversation" : ""}`}>
    <div className="home-intro"><div className="home-intro-row"><p className="section-label">From saved to done</p>{turns.length > 0 && <button type="button" className="home-new-chat" onClick={startNewChat}>New chat</button>}</div><h1 className="page-h1">What are you trying to do?</h1><p className="page-sub">Ask about something you&apos;ve saved, or tell REIBRY what&apos;s coming up.</p></div>
    {proactive.length > 0 && <section className="home-proactive" aria-label="Coming up"><p className="section-label">Coming up</p>{proactive.map((item) => <Link key={item.id} href={`/plans/${item.id}`} className="home-proactive-item"><span><strong>{item.title}</strong><small>{item.date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(item.date)) : "Upcoming"} · {item.itemCount} {item.itemCount === 1 ? "Memory" : "Memories"}</small></span><span className="home-proactive-link">Open plan</span></Link>)}</section>}
    <section className="home-thread" aria-label="Conversation with REIBRY">
      {turns.length === 0 && <div className="home-welcome"><span className="home-assistant-label">REIBRY</span><p>Tell me what you&apos;re planning, or ask about something you&apos;ve saved.</p><div className="home-suggestions"><button type="button" onClick={() => chooseSuggestion("Where is that orange juice video?")}>Find a Memory</button><button type="button" onClick={() => chooseSuggestion("I'm planning something")}>Plan something</button><button type="button" onClick={() => chooseSuggestion("What's coming up?")}>What&apos;s coming up?</button></div></div>}
      {turns.map((turn) => <div key={turn.id} className={turn.role === "user" ? "home-turn home-turn-user" : "home-turn home-turn-assistant"}>{turn.role === "user" ? <p className="home-user-bubble">{turn.text}</p> : <div className="home-assistant-turn"><span className="home-assistant-label">REIBRY</span>
        {turn.block?.kind === "text" && <p>{turn.block.text}</p>}
        {turn.block?.kind === "search" && <><p>{turn.block.text}</p>{turn.block.results?.slice(0, 5).map(({ memory }) => <MemoryCard key={memory.id} memory={memory} showOpenAction />)}{turn.block.results?.length ? <div className="home-search-actions"><button type="button" className="home-action-chip" onClick={() => void submit(undefined, "Why this one?")}>Why this one?</button><button type="button" className="home-action-chip home-action-quiet" onClick={() => void submit(undefined, "Not this one")}>Not this one</button></div> : null}</>}
        {turn.block?.kind === "upcoming" && <><p>{turn.block.text}</p>{turn.block.plans?.map((plan) => <Link className="home-option" key={plan.id} href={`/plans/${plan.id}`}><span><strong>{plan.title}</strong><small>{plan.date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(plan.date)) : "No date set"}</small></span><span>Open</span></Link>)}</>}
        {turn.block?.kind === "intention" && <><p>{turn.block.text}</p>{turn.block.context && <Link className="home-action-chip" href="/plans">View Plans</Link>}{turn.block.matches?.length === 0 && <Link className="home-action-chip" href="/capture">Capture something</Link>}{turn.block.matches?.length ? <div className="home-match-summary"><p>{turn.block.matches.length} relevant saved {turn.block.matches.length === 1 ? "item" : "items"}</p><button type="button" className="btn-primary" onClick={() => { const context = turn.block?.context; const matches = turn.block?.matches || []; const type = context ? (context.type === "trip" ? "travel" : context.type === "event" ? "event" : "learning") : null; if (context && type) startBuilder(context, matches, type); }}>Create Ready Pack</button></div> : null}</>}
          {turn.block?.kind === "selection" && <><p>{turn.block.text}</p><div className="home-option-list">{optionSlice(turn.block.matches || [], showMore).map((match, index) => { const thumbnail = thumbnailFor(match.memory); return <article className="home-option" key={match.memory.id}><span className="home-option-thumb">{thumbnail ? <Image unoptimized src={thumbnail} alt="" width={48} height={48} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <span aria-hidden="true">{match.memory.sourceUrl ? "↗" : "✦"}</span>}</span><span className="home-option-copy"><strong>{match.memory.title}</strong><small>{match.memory.sourcePlatform || "Saved Memory"} · {match.section} · {match.relevanceReason}</small></span><span className="home-option-actions"><Link href={`/memories/${match.memory.id}`} className="home-action-chip">View</Link><button type="button" className="home-action-chip" onClick={() => chooseMemory(match, true)}>{index + 1} · Use this</button></span></article>;})}{(turn.block.matches?.length || 0) > 3 && <button type="button" className="home-action-chip" onClick={() => { setShowMore(true); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "selection", text: "Here are more relevant choices.", context: turn.block?.context, matches: turn.block?.matches } }); }}>Show more</button>}</div><button type="button" className="home-skip" onClick={() => { setDraft(null); appendTurns({ id: ++turnIds.current, role: "assistant", block: { kind: "text", text: "You can keep this plan without a Ready Pack for now." } }); }}>Skip for now</button></>}
        {turn.block?.kind === "summary" && <p className="home-pack-summary">{turn.block.text}</p>}
        {turn.block?.kind === "pack" && <><p>{turn.block.text}</p><Link className="home-action-chip" href={`/plans/${turn.block.packId}`}>Open Ready Pack</Link></>}
        {turn.block?.actions?.length ? <div className="home-message-actions">{turn.block.actions.map((action) => <button type="button" className="home-action-chip" key={action.label} onClick={() => runBlockAction(action.action)}>{action.label}</button>)}</div> : null}
      </div>}</div>)}
      {loading && <div className="home-turn home-turn-assistant" aria-live="polite"><div className="home-assistant-turn"><span className="home-assistant-label">REIBRY</span><p className="home-typing">{turns.at(-1)?.text && /ready pack|birthday pack|trip pack|learning pack/i.test(turns.at(-1)?.text || "") ? "Putting your Ready Pack together…" : turns.at(-1)?.text && /where|find|saved|stored|cake|tutorial|recipe|memory|bake|cook/i.test(turns.at(-1)?.text || "") ? "Searching your Memories…" : "Looking through your plans…"}</p></div></div>}
      {error && <StatePanel tone="error">{error} <button type="button" className="home-retry" onClick={() => void submit()}>Try again</button></StatePanel>}<div className="home-thread-end" ref={endRef} />
    </section>
    <form className="home-composer" onSubmit={(event) => void submit(event)}><label htmlFor="home-input" className="sr-only">Message REIBRY</label><textarea ref={textareaRef} id="home-input" rows={1} value={text} onChange={(event) => { setText(event.target.value); const node = event.target; node.style.height = "auto"; node.style.height = `${Math.min(node.scrollHeight, 120)}px`; }} onKeyDown={onKeyDown} placeholder="Message REIBRY…" /><button type="submit" aria-label="Send message" disabled={!text.trim()}>↑</button></form>
  </PageContainer></RequireAuth>;
}
