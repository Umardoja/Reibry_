"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { LifeCard } from "@/components/design/memory";
import { partitionLifeContexts } from "@/lib/life/management";
import type { LifeContext } from "@/types/reibry";
export default function ManageLife() {
  const [items, setItems] = useState<LifeContext[]>([]); const [tab, setTab] = useState<"upcoming" | "undated" | "past">("upcoming"); const [error, setError] = useState("");
  const load = async () => { const response = await fetch("/api/life", { cache: "no-store" }); const body = await response.json(); if (!response.ok || !Array.isArray(body.data)) throw new Error(body.error?.message || "Unable to load Life."); setItems(body.data); };
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load Life.")); }, 0); return () => window.clearTimeout(timer); }, []);
  const grouped = useMemo(() => partitionLifeContexts(items), [items]); const shown = tab === "upcoming" ? grouped.upcoming : tab === "undated" ? grouped.undated : grouped.past;
  async function edit(context: LifeContext) { const title = window.prompt("Edit title", context.title); if (!title?.trim() || title.trim() === context.title) return; const response = await fetch(`/api/life/${context.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim() }) }); if (!response.ok) { setError("Unable to edit this Life context."); return; } const body = await response.json(); setItems((current) => current.map((item) => item.id === context.id ? body.data : item)); }
  async function remove(id: string) { if (!window.confirm("Delete this Life context?")) return; const response = await fetch(`/api/life/${id}`, { method: "DELETE" }); if (!response.ok) { setError("Unable to delete this Life context."); return; } setItems((current) => current.filter((item) => item.id !== id)); }
  return <RequireAuth><PageContainer><Link className="back-link" href="/life">← Life</Link><h1 className="page-h1">Manage Life</h1><p className="page-sub">Keep what is coming up easy to find.</p><div className="life-manage-tabs" role="tablist">{(["upcoming", "undated", "past"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "undated" ? "No date" : value[0].toUpperCase() + value.slice(1)}</button>)}</div>{error && <StatePanel tone="error">{error}</StatePanel>}{!shown.length && <StatePanel>No Life contexts in this section.</StatePanel>}<div className="stack">{shown.map((context) => <div className="life-manage-item" key={context.id}><LifeCard context={context} /><div className="life-manage-actions"><button type="button" className="btn-ghost" onClick={() => void edit(context)}>Edit</button><button type="button" className="btn-ghost danger-text" onClick={() => void remove(context.id)}>Delete</button></div></div>)}</div></PageContainer></RequireAuth>;
}
