"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LifeContext, Memory } from "@/types/reibry";
import { useAuthSession } from "@/components/auth/auth-session-provider";
import type { SectionSelections } from "@/lib/plans/finalization";

export type HomeMatch = { memory: Memory; section: string; relevanceReason: string };
export type HomeBlock = {
  kind: "text" | "search" | "intention" | "selection" | "summary" | "pack" | "upcoming";
  text: string;
  results?: Array<{ memory: Memory }>;
  context?: LifeContext;
  matches?: HomeMatch[];
  packId?: string;
  plans?: Array<{ id: string; title: string; date: string | null }>;
  actions?: Array<{ label: string; action: "continue" | "show-more" | "save-pack" | "skip-section" }>;
};
export type HomeTurn = { id: number; role: "user" | "assistant"; text?: string; block?: HomeBlock };
export type HomePackDraft = { context: LifeContext; matches: HomeMatch[]; type: "travel" | "event" | "learning"; sections: string[]; candidateSections: string[]; currentSection: string | null; selectedBySection: SectionSelections; handledSections: string[]; awaitingConfirmation?: boolean };
export type HomeConversationState = {
  turns: HomeTurn[];
  draft: HomePackDraft | null;
  showMore: boolean;
  lastOptions: HomeMatch[];
  searchCandidates: HomeMatch[];
  awaitingMemoryConfirmation: boolean;
  lastRecommendation: { title: string; reason: string } | null;
  activePlanTitle: string | null;
  searchTopic: string | null;
  rejectedMemoryIds: string[];
};

const initialState: HomeConversationState = { turns: [], draft: null, showMore: false, lastOptions: [], searchCandidates: [], awaitingMemoryConfirmation: false, lastRecommendation: null, activePlanTitle: null, searchTopic: null, rejectedMemoryIds: [] };
type HomeConversationValue = HomeConversationState & { updateField: <K extends keyof HomeConversationState>(key: K, next: React.SetStateAction<HomeConversationState[K]>) => void; newChat: () => void };
const HomeConversationContext = createContext<HomeConversationValue | null>(null);

export function HomeConversationProvider({ children }: { children: React.ReactNode }) {
  const { state: authState, userId } = useAuthSession();
  return <ConversationStateProvider key={`${authState}:${userId || "anonymous"}`}>{children}</ConversationStateProvider>;
}

function ConversationStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HomeConversationState>(initialState);
  useEffect(() => {
    // Remove legacy temporary chat snapshots once; persistent Plans and Memories use separate APIs.
    try { for (let index = sessionStorage.length - 1; index >= 0; index--) { const key = sessionStorage.key(index); if (key?.startsWith("reibry:home-session:")) sessionStorage.removeItem(key); } } catch { /* Storage is no longer part of Home state. */ }
  }, []);
  const updateField = useCallback(<K extends keyof HomeConversationState>(key: K, next: React.SetStateAction<HomeConversationState[K]>) => setState((current) => ({ ...current, [key]: typeof next === "function" ? (next as (current: HomeConversationState[K]) => HomeConversationState[K])(current[key]) : next })), []);
  const newChat = useCallback(() => setState(initialState), []);
  const value = useMemo(() => ({ ...state, updateField, newChat }), [state, updateField, newChat]);
  return <HomeConversationContext.Provider value={value}>{children}</HomeConversationContext.Provider>;
}

export function useHomeConversation() {
  const value = useContext(HomeConversationContext);
  if (!value) throw new Error("HomeConversationProvider is missing");
  const updateField = value.updateField;
  const setters = useMemo(() => ({
    setTurns: (next: React.SetStateAction<HomeConversationState["turns"]>) => updateField("turns", next),
    setDraft: (next: React.SetStateAction<HomeConversationState["draft"]>) => updateField("draft", next),
    setShowMore: (next: React.SetStateAction<HomeConversationState["showMore"]>) => updateField("showMore", next),
    setLastOptions: (next: React.SetStateAction<HomeConversationState["lastOptions"]>) => updateField("lastOptions", next),
    setSearchCandidates: (next: React.SetStateAction<HomeConversationState["searchCandidates"]>) => updateField("searchCandidates", next),
    setAwaitingMemoryConfirmation: (next: React.SetStateAction<HomeConversationState["awaitingMemoryConfirmation"]>) => updateField("awaitingMemoryConfirmation", next),
    setLastRecommendation: (next: React.SetStateAction<HomeConversationState["lastRecommendation"]>) => updateField("lastRecommendation", next),
    setActivePlanTitle: (next: React.SetStateAction<HomeConversationState["activePlanTitle"]>) => updateField("activePlanTitle", next),
    setSearchTopic: (next: React.SetStateAction<HomeConversationState["searchTopic"]>) => updateField("searchTopic", next),
    setRejectedMemoryIds: (next: React.SetStateAction<HomeConversationState["rejectedMemoryIds"]>) => updateField("rejectedMemoryIds", next),
  }), [updateField]);
  return { state: value, ...setters, newChat: value.newChat };
}
