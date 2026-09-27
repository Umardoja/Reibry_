"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { MemoryCard } from "@/components/design/memory";
import { IC } from "@/components/design/icons";
import { MEMORY_CATEGORIES } from "@/lib/sources/categories";
import { memoryDateRange, type MemoryDatePreset } from "@/lib/memories/filters";
import type { Memory } from "@/types/reibry";
import { readQueryCache, writeQueryCache } from "@/lib/client/query-cache";
import { ChoiceRows, Modal } from "@/components/ui/modal";
type MemoryPage = { items: Memory[]; nextCursor: string | null; hasMore: boolean };
export default function Memories() {
  const initialPage = readQueryCache<MemoryPage>("memories:default");
  const [items, setItems] = useState<Memory[]>(() => initialPage?.items || []); const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [source, setSource] = useState("all"); const [datePreset, setDatePreset] = useState<MemoryDatePreset>("all"); const [month, setMonth] = useState(""); const [customFrom, setCustomFrom] = useState(""); const [customTo, setCustomTo] = useState(""); const [cursor, setCursor] = useState<string | null>(initialPage?.nextCursor || null); const [hasMore, setHasMore] = useState(Boolean(initialPage?.hasMore)); const [error, setError] = useState(""); const [loading, setLoading] = useState(!initialPage); const [loadingMore, setLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); const [draft, setDraft] = useState({ category: "All", source: "all", datePreset: "all" as MemoryDatePreset, month: "", customFrom: "", customTo: "" });
  const range = useMemo(() => memoryDateRange({ preset: datePreset, month, customFrom, customTo }), [customFrom, customTo, datePreset, month]);
  const activeFilters = [category !== "All" ? category : null, source !== "all" ? ({ tiktok: "TikTok", youtube: "YouTube", web: "Web", text: "Text / Note" } as Record<string, string>)[source] : null, datePreset !== "all" ? ({ today: "Today", week: "This week", month: "This month", "choose-month": month || "Choose month", custom: "Custom range" } as Record<string, string>)[datePreset] : null].filter(Boolean) as string[];
  const load = useCallback(async (nextCursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("search", search); if (category !== "All") params.set("category", category); if (source !== "all") params.set("source", source); if (range.from) params.set("from", range.from); if (range.to) params.set("to", range.to); if (nextCursor) params.set("cursor", nextCursor);
      if (!append) window.history.replaceState(null, "", `${window.location.pathname}${params.size > 1 ? `?${params.toString()}` : ""}`);
      const response = await fetch(`/api/memories?${params.toString()}`, { cache: "no-store" });
      const body = await response.json() as { data?: MemoryPage; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "Unable to load memories.");
      setItems((current) => append ? [...new Map([...current, ...body.data!.items].map((memory) => [memory.id, memory])).values()] : body.data!.items);
      setCursor(body.data.nextCursor); setHasMore(body.data.hasMore);
      if (!append && !search && category === "All" && source === "all" && !range.from && !range.to) writeQueryCache("memories:default", body.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load memories."); }
    finally { if (append) setLoadingMore(false); else setLoading(false); }
  }, [category, range.from, range.to, search, source]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(null, false); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(query.trim()); };
  return <RequireAuth><PageContainer>
    <h1 className="page-h1">Memories</h1><p className="page-sub">Everything you&apos;ve saved, organized for you.</p><div className="gap-sm" />
    <form onSubmit={submitSearch} className="search-row"><span aria-hidden="true">{IC.search}</span><label className="sr-only" htmlFor="library-search">Search memories</label><input id="library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your memories…" /><button className="search-submit" type="submit" aria-label="Search memories">{IC.arrowR}</button></form>
    <div className="memory-filter-bar"><button type="button" className="btn-ghost" onClick={() => { setDraft({ category, source, datePreset, month, customFrom, customTo }); setFiltersOpen(true); }}><span aria-hidden="true">{IC.filter}</span>Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>{activeFilters.length > 0 && <button type="button" className="filter-clear" onClick={() => { setCategory("All"); setSource("all"); setDatePreset("all"); setMonth(""); setCustomFrom(""); setCustomTo(""); }}>Clear all</button>}</div>
    {activeFilters.length > 0 && <div className="chips-scroll" aria-label="Active filters">{activeFilters.map((value) => <span className="chip active" key={value}>{value} <span aria-hidden="true">×</span></span>)}</div>}
    <div className="gap-sm" />
    {loading && <StatePanel>Loading your memories…</StatePanel>}
    {!loading && error && <StatePanel tone="error"><p>{error}</p><button className="btn-ghost" onClick={() => void load(null, false)}>Try again</button></StatePanel>}
    {!loading && !error && !items.length && <StatePanel>No memories match this view. Try another search or capture something to begin.</StatePanel>}
    {!loading && !error && <div className="stack">{items.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}</div>}
    {!loading && !error && hasMore && <div className="mem-load-more"><button type="button" disabled={loadingMore} onClick={() => void load(cursor, true)}>{loadingMore ? "Loading…" : "Load more memories"}</button></div>}
    <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter Memories" labelledBy="memory-filters-title"><div className="modal-scroll"><ChoiceRows label="Category" value={draft.category} options={[{ value: "All", label: "All categories" }, ...MEMORY_CATEGORIES.map((value) => ({ value, label: value }))]} onChange={(value) => setDraft({ ...draft, category: value })} /><ChoiceRows label="Source" value={draft.source} options={[{ value: "all", label: "All sources" }, { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" }, { value: "web", label: "Web" }, { value: "text", label: "Text / Note" }]} onChange={(value) => setDraft({ ...draft, source: value })} /><ChoiceRows label="Date" value={draft.datePreset} options={[{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "choose-month", label: "Choose month" }, { value: "custom", label: "Custom range" }]} onChange={(value) => setDraft({ ...draft, datePreset: value as MemoryDatePreset })} />{draft.datePreset === "choose-month" && <label>Month<input type="month" value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} /></label>}{draft.datePreset === "custom" && <><label>From<input type="date" value={draft.customFrom} onChange={(event) => setDraft({ ...draft, customFrom: event.target.value })} /></label><label>To<input type="date" value={draft.customTo} onChange={(event) => setDraft({ ...draft, customTo: event.target.value })} /></label></>}</div><div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setDraft({ category: "All", source: "all", datePreset: "all", month: "", customFrom: "", customTo: "" })}>Reset</button><button type="button" className="btn-primary" onClick={() => { setCategory(draft.category); setSource(draft.source); setDatePreset(draft.datePreset); setMonth(draft.month); setCustomFrom(draft.customFrom); setCustomTo(draft.customTo); setFiltersOpen(false); }}>Apply filters</button></div></Modal>
  </PageContainer></RequireAuth>;
}
