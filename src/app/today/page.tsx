"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatePanel } from "@/components/ui/primitives";
import { SourceBadge, thumbnailFor } from "@/components/design/memory";
import type { ActionType, SuggestedAction, TodayFeed } from "@/types/reibry";
import { meaningfulAction } from "@/lib/actions/policy";
import { invalidateQueryCache, readQueryCache, writeQueryCache } from "@/lib/client/query-cache";
type Item = TodayFeed["resurfacedMemories"][number];
type ActionResult = { id: string; type: ActionType; title: string; description?: string | null; payload: Record<string, unknown>; status: string };
function CompactLifeRow({ context }: { context: TodayFeed["upcomingLifeContexts"][number] }) { const date = context.startDate ? new Date(context.startDate) : null; const day = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(date) : "Soon"; const time = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date) : ""; return <Link href="/life" className="today-life-row"><span className="today-life-date">{day}</span><span className="today-life-title">{context.title}</span><span className="today-life-time">{time}</span></Link>; }
function ActionContent({ action }: { action: Pick<ActionResult, "title" | "description" | "payload"> }) {
  const entries = Object.entries(action.payload).flatMap(([key, value]) => {
    if (/^(source|.*id|.*ids|provider|metadata)$/i.test(key)) return [];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") return [Object.values(item).filter((part) => typeof part === "string" || typeof part === "number").join(" · ")].filter(Boolean);
      return [];
    });
    return typeof value === "number" ? [key.replaceAll("_", " ") + ": " + value] : [];
  });
  return <div className="action-result"><h3 className="section-heading">{action.title}</h3>{action.description && action.description !== "Mock action proposal requiring confirmation." && <p>{action.description}</p>}<p>Saved proposal · Review before taking action</p>{entries.length > 0 && <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}</div>;
}
function TodayCard({ item, hero, onCreate, loading, error, created }: { item: Item; hero: boolean; onCreate: (item: Item, type: ActionType) => void; loading: boolean; error?: string; created?: ActionResult }) {
  const preferred: SuggestedAction | null = item.suggestedAction || null;
  const action = meaningfulAction(item.memory, item.lifeContext, preferred?.type);
  const thumbnail = thumbnailFor(item.memory);
  return <article className={hero ? "hero-card" : "compact-card"}>
    {hero && thumbnail && <div className="hero-img-wrap"><Image unoptimized src={thumbnail} alt="" width={600} height={400} className="hero-img" /></div>}
    <div className={hero ? "hero-body" : ""}>
      <div className="compact-source-row"><SourceBadge memory={item.memory} /></div>
      <span className="why-now-pill">Why now</span><span className="life-pill">{item.lifeContext.title}</span>
      <h2 className={hero ? "hero-title" : "compact-title"}><Link href={"/memories/" + item.memory.id}>{item.memory.title}</Link></h2>
      {item.memory.summary && <p className={hero ? "hero-desc" : "compact-desc"}>{item.memory.summary}</p>}
      <div className="why-box"><h3 className="why-box-title">Why this came back</h3><p className="why-box-text">{item.reason}</p></div>
      {action && <button className="btn-primary" disabled={loading} onClick={() => onCreate(item, action.type)}>{loading ? "Creating…" : action.label}</button>}
      {created && <ActionContent action={created} />}{error && <StatePanel tone="error">{error} Try again when you&apos;re ready.</StatePanel>}
    </div>
  </article>;
}
export default function Today() {
  const [data, setData] = useState<TodayFeed | null>(() => readQueryCache<TodayFeed>("today")); const [errors, setErrors] = useState<Record<string, string>>({}); const [loading, setLoading] = useState<Record<string, boolean>>({}); const [created, setCreated] = useState<Record<string, ActionResult>>({}); const [feedError, setFeedError] = useState("");
  useEffect(() => { fetch("/api/today", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.error?.message || "Unable to load Today."); writeQueryCache("today", body.data as TodayFeed); setData(body.data as TodayFeed); }).catch((error) => setFeedError(error instanceof Error ? error.message : "Unable to load Today.")); }, []);
  async function createAction(item: Item, type: ActionType) { const key = `${item.memory.id}-${item.lifeContext.id}`; if (loading[key]) return; setLoading((current) => ({ ...current, [key]: true })); setErrors((current) => ({ ...current, [key]: "" })); try { const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, memoryId: item.memory.id, lifeContextId: item.lifeContext.id }) }); const body = await response.json(); if (!response.ok || !body.data?.action) throw new Error(body.error?.message || "Action could not be created."); setCreated((current) => ({ ...current, [key]: body.data.action })); invalidateQueryCache("today"); } catch (error) { setErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Action could not be created." })); } finally { setLoading((current) => ({ ...current, [key]: false })); } }
  return <RequireAuth>
    <div className="today-meta-row"><p className="section-label">Why now</p></div>
    <div className="today-greeting"><h1 className="greeting-h">Here&apos;s what matters today</h1><p className="greeting-hint">A few things you saved, ready when they matter.</p></div>
    {feedError ? <div className="px"><StatePanel tone="error">{feedError}<button className="btn-ghost" onClick={() => window.location.reload()}>Try again</button></StatePanel></div> : !data ? <div className="px"><StatePanel>Loading your day…</StatePanel></div> : <>
      <section className="resurfaced-list" aria-label="Resurfaced for you">
        {!data.resurfacedMemories.length ? <StatePanel>No resurfaced Memories yet. Save something and add a Life event — REIBRY will connect them when they become relevant.</StatePanel> : data.resurfacedMemories.map((item, index) => { const key = item.memory.id + "-" + item.lifeContext.id; return <TodayCard key={key} item={item} hero={index === 0} onCreate={createAction} loading={Boolean(loading[key])} error={errors[key]} created={created[key]} />; })}
      </section>
      {data.upcomingLifeContexts.length > 0 && <section className="today-secondary"><div className="results-header"><h2 className="section-heading">Upcoming Life</h2><Link href="/life">View Life</Link></div><div className="today-life-list">{data.upcomingLifeContexts.slice(0, 3).map((context) => <CompactLifeRow key={context.id} context={context} />)}</div></section>}
    </>}
  </RequireAuth>;
}
