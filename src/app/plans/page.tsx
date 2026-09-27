"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import type { LifeContext, ReadyPack } from "@/types/reibry";

type IntentionView = LifeContext;
type PackView = ReadyPack & { items?: unknown[]; context?: LifeContext | null; memoryCount?: number };

function dateLabel(value: string | null | undefined) {
  if (!value) return "No date set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date set" : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function localDateValue(iso: string | null) { if (!iso) return ""; const date = new Date(iso); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function PlanCard({ context, state, detail, href, onComplete, onDelete, onRefresh }: { context: LifeContext; state: string; detail: string; href: string; onComplete?: () => void; onDelete: () => Promise<void>; onRefresh: () => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false); const [confirmingDelete, setConfirmingDelete] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const [title, setTitle] = useState(context.title); const [description, setDescription] = useState(context.description || ""); const [startDate, setStartDate] = useState(localDateValue(context.startDate));
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); try { const response = await fetch(`/api/life/${context.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: description.trim() || null, startDate: startDate ? new Date(startDate).toISOString() : null }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "Unable to update this plan."); setEditing(false); await onRefresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update this plan."); } finally { setSaving(false); } }
  return <><article className="life-event-card plan-card"><div className="life-event-body"><span className="life-type-badge">{context.type}</span><h2 className="life-event-title">{context.title}</h2><p className="life-event-when">{dateLabel(context.startDate)}</p><p className="plan-state"><strong>{state}</strong><span> · {detail}</span></p><Link className="home-action-chip" href={href}>{state === "Ready Pack" ? "Open Ready Pack" : state === "Completed" ? "View plan" : "Continue"}</Link><div className="plan-menu-wrap"><button type="button" className="btn-ghost" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>Plan options</button>{menu && <div className="plan-menu"><button type="button" onClick={() => { setTitle(context.title); setDescription(context.description || ""); setStartDate(localDateValue(context.startDate)); setEditing(true); setMenu(false); }}>Edit or add a date</button>{onComplete && <button type="button" onClick={onComplete}>{context.status === "completed" ? "Reopen plan" : "Mark done"}</button>}<button type="button" className="danger-text" onClick={() => { setConfirmingDelete(true); setMenu(false); }}>Delete plan</button></div>}</div></div></article>
    <Modal open={editing} onClose={() => setEditing(false)} title="Edit plan" labelledBy={`edit-plan-${context.id}`}><form onSubmit={(event) => void save(event)}><div className="modal-scroll"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={3} /></label><label>Date and time<input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>{message && <p role="alert" className="form-error">{message}</p>}</div><div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save plan"}</button></div></form></Modal>
    <Modal open={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Delete this plan?" labelledBy={`delete-plan-${context.id}`} alert><div className="modal-scroll"><p>This removes {context.title} and its Ready Pack from REIBRY. This can&apos;t be undone.</p>{message && <p role="alert" className="form-error">{message}</p>}</div><div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button><button type="button" className="btn-danger" onClick={() => { void onDelete().then(() => setConfirmingDelete(false)).catch((cause) => setMessage(cause instanceof Error ? cause.message : "Unable to delete this plan.")); }}>Delete plan</button></div></Modal>
  </>;
}

export default function Plans() {
  const [packs, setPacks] = useState<PackView[]>([]);
  const [intentions, setIntentions] = useState<IntentionView[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    const [packResponse, lifeResponse] = await Promise.all([fetch("/api/ready-packs", { cache: "no-store" }), fetch("/api/life", { cache: "no-store" })]);
    const [packBody, lifeBody] = await Promise.all([packResponse.json(), lifeResponse.json()]);
    if (!packResponse.ok) throw new Error(packBody.error?.message || "Unable to load plans.");
    if (!lifeResponse.ok) throw new Error(lifeBody.error?.message || "Unable to load intentions.");
    setPacks(packBody.data || []); setIntentions(lifeBody.data || []); setNow(Date.now());
  }, []);
  // Initial data loading is asynchronous; the state updates occur after the no-store requests resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load plans.")); }, [load]);

  const packedContexts = new Set(packs.map((pack) => pack.lifeContextId));
  const unpacked = intentions.filter((item) => item.status === "active" && !packedContexts.has(item.id));
  const activePacks = packs.filter((pack) => pack.status === "active");
  const completedPacks = packs.filter((pack) => pack.status !== "active");
  const coming = activePacks.filter((pack) => pack.context?.startDate && Date.parse(pack.context.startDate) >= now).sort((a, b) => Date.parse(a.context?.startDate || "") - Date.parse(b.context?.startDate || ""));
  const noDatePacks = activePacks.filter((pack) => !pack.context?.startDate);
  const pastPacks = activePacks.filter((pack) => pack.context?.startDate && Date.parse(pack.context.startDate) < now);
  const comingIntentions = unpacked.filter((item) => item.startDate && Date.parse(item.startDate) >= now);
  const undatedIntentions = unpacked.filter((item) => !item.startDate);
  const pastIntentions = intentions.filter((item) => item.status === "completed" || item.status === "archived" || item.status === "cancelled" || (item.status === "active" && item.startDate && Date.parse(item.startDate) < now));

  async function updateIntention(id: string, patch: { status?: "active" | "completed" }) {
    const response = await fetch(`/api/life/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Unable to update this plan.");
    await load();
  }
  async function deletePlan(id: string) {
    const response = await fetch(`/api/life/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete this plan.");
    await load();
  }
  const renderPack = (pack: PackView, state = pack.context?.status === "completed" ? "Completed" : "Ready Pack") => pack.context ? <PlanCard key={pack.id} context={pack.context} state={state} detail={`${pack.memoryCount ?? pack.items?.length ?? 0} ${(pack.memoryCount ?? pack.items?.length ?? 0) === 1 ? "Memory" : "Memories"}`} href={`/plans/${pack.id}`} onComplete={() => void updateIntention(pack.context!.id, { status: pack.context!.status === "completed" ? "active" : "completed" }).catch((cause) => setError(cause.message))} onDelete={async () => { try { await deletePlan(pack.lifeContextId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this plan."); throw cause; } }} onRefresh={load} /> : null;
  const renderIntention = (item: IntentionView, state: string, detail: string) => <PlanCard key={item.id} context={item} state={state} detail={detail} href="/life" onComplete={() => void updateIntention(item.id, { status: item.status === "completed" ? "active" : "completed" }).catch((cause) => setError(cause.message))} onDelete={async () => { try { await deletePlan(item.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this plan."); throw cause; } }} onRefresh={load} />;

  return <RequireAuth><PageContainer><p className="section-label">From saved to done</p><h1 className="page-h1">Plans</h1><p className="page-sub">Keep useful things close to what you&apos;re trying to do.</p>{error && <StatePanel tone="error">{error}</StatePanel>}{!error && packs.length === 0 && intentions.length === 0 && <StatePanel>Tell REIBRY what you&apos;re preparing for and it can connect useful things you&apos;ve saved.</StatePanel>}
    {(coming.length + comingIntentions.length > 0) && <section className="stack"><h2 className="section-heading">Coming up</h2>{coming.map((pack) => renderPack(pack))}{comingIntentions.map((item) => renderIntention(item, "Plan only", "No Ready Pack yet"))}</section>}
    {(noDatePacks.length + undatedIntentions.length > 0) && <section className="stack"><h2 className="section-heading">No date</h2>{noDatePacks.map((pack) => renderPack(pack))}{undatedIntentions.map((item) => renderIntention(item, "Plan only", "No date set · No Ready Pack yet"))}</section>}
    {(pastPacks.length + pastIntentions.length + completedPacks.length > 0) && <section className="stack"><h2 className="section-heading">Past / completed</h2>{pastPacks.map((pack) => renderPack(pack))}{completedPacks.map((pack) => renderPack(pack, "Completed"))}{pastIntentions.map((item) => renderIntention(item, "Completed", "Plan kept for reference"))}</section>}
  </PageContainer></RequireAuth>;
}
