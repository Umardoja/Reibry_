"use client";
import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { SourceBadge, thumbnailFor, savedDate } from "@/components/design/memory";
import { IC } from "@/components/design/icons";
import type { Memory } from "@/types/reibry";
type Result = { memory: Memory; similarity: number; reason?: string };
const suggestions = ["That cake recipe I saved", "Show my Python resources", "What did I save for my maths exam?"];
function ResultCard({ result }: { result: Result }) {
  const memory = result.memory;
  const thumbnail = thumbnailFor(memory);
  return <article className="result-card"><div className="result-match-row"><SourceBadge memory={memory} /></div>
    <div className="result-body">{thumbnail ? <Image unoptimized src={thumbnail} alt="" width={64} height={54} className="result-thumb" /> : <div className="result-thumb-placeholder" aria-hidden="true">{IC.file}</div>}<div className="result-content"><h2 className="result-title"><Link href={"/memories/" + memory.id}>{memory.title}</Link></h2>{memory.summary && <p className="result-desc">{memory.summary}</p>}</div></div>
    <div className="result-tags-row">{memory.category && <span className="result-cat">{memory.category}</span>}{memory.tags.slice(0, 2).map((tag) => <span className="mem-hash-tag" key={tag}>#{tag}</span>)}<span className="result-saved">{savedDate(memory.createdAt)}</span></div>
    {result.reason && <div className="why-box"><h3 className="why-box-title">Why this result?</h3><p className="why-box-text">{result.reason}</p></div>}
    <div className="result-footer"><Link href={"/memories/" + memory.id}>Open memory →</Link></div>
  </article>;
}
export default function Ask() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const requestRef = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  async function search(value = query) {
    if (!value.trim()) return;
    const requestId = requestRef.current.id + 1;
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    requestRef.current = { id: requestId, controller };
    setQuery(value); setLoading(true); setError(""); setSearched(true); setResults([]);
    try {
      const response = await fetch("/api/memory/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: value.trim(), limit: 10 }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.data?.results)) throw new Error(body.error?.message || "Search is temporarily unavailable.");
      if (requestRef.current.id === requestId) setResults(body.data.results as Result[]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (requestRef.current.id === requestId) setError(cause instanceof Error ? cause.message : "Search is temporarily unavailable.");
    } finally { if (requestRef.current.id === requestId) setLoading(false); }
  }
  return <RequireAuth><PageContainer><h1 className="page-h1">Ask REIBRY</h1><p className="page-sub">Describe it however you remember it.</p><div className="gap-sm" />
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void search(); }} className="ask-search-bar"><span aria-hidden="true">{IC.search}</span><label htmlFor="ask-query" className="sr-only">Search your memories</label><input id="ask-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A recipe, an idea, something you saved…" /><button className="ask-submit" type="submit" aria-label="Search memories" disabled={!query.trim()}><span aria-hidden="true">{IC.send}</span></button></form>
    {!searched && <><p className="ask-hint">Searching your personal memories</p><div className="gap-sm" /><h2 className="section-label">Thought prompts</h2><div className="thought-prompts ask-prompts">{suggestions.map((suggestion) => <button className="thought-pill" key={suggestion} onClick={() => void search(suggestion)}>{suggestion}</button>)}</div><div className="ask-empty-state"><div className="ask-empty-icon" aria-hidden="true">{IC.brain}</div><h2 className="ask-empty-title">Ask anything you&apos;ve saved</h2><p className="ask-empty-sub">Describe it however you remember it — what it was about, where you saw it, or why you saved it.</p></div></>}
    {loading && <StatePanel>Looking through your memories…</StatePanel>}
    {error && <StatePanel tone="error"><p>{error}</p><button className="btn-ghost" onClick={() => void search()}>Try again</button></StatePanel>}
    {!loading && !error && searched && !results.length && <div className="ask-empty-state"><h2 className="ask-empty-title">I couldn&apos;t find a strong match.</h2><p className="ask-empty-sub">Try describing what it was about, where you saw it, or why you saved it.</p></div>}
    {results.length > 0 && <><div className="gap-section" /><div className="results-header"><h2 className="section-heading">Your memories</h2><span className="results-count">{results.length} results</span></div><div className="gap-sm" /><div className="stack">{results.map((result) => <ResultCard key={result.memory.id} result={result} />)}</div></>}
  </PageContainer></RequireAuth>;
}
