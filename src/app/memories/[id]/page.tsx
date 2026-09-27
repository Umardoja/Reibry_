"use client";
import Image from "next/image";
import { MemoryTitle } from "@/components/design/memory-title";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { StatePanel } from "@/components/ui/primitives";
import { SourceBadge, thumbnailFor, savedDate } from "@/components/design/memory";
import { IC } from "@/components/design/icons";
import type { Memory } from "@/types/reibry";
import { MEMORY_CATEGORIES } from "@/lib/sources/categories";
import { invalidateQueryCache } from "@/lib/client/query-cache";

function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : []; }
function StructuredMemory({ memory }: { memory: Memory }) {
  const content = memory.analysisMetadata?.structuredContent;
  if (!content) return null;
  const ingredients = stringList(content.ingredients), steps = stringList(content.steps), timing = stringList(content.timing), concepts = stringList(content.keyConcepts);
  if (memory.analysisMetadata?.contentType === "recipe" && (ingredients.length || steps.length || timing.length)) return <section className="detail-section"><div className="detail-section-card"><h2>Recipe details</h2>
    {ingredients.length > 0 && <><h3>Ingredients</h3><ul className="evidence-list">{ingredients.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
    {steps.length > 0 && <><h3>Steps</h3><ol className="evidence-list">{steps.map((item, index) => <li key={index}>{item}</li>)}</ol></>}
    {timing.length > 0 && <><h3>Timing</h3><p>{timing.join(" · ")}</p></>}
  </div></section>;
  if (concepts.length || typeof content.whatItTeaches === "string") return <section className="detail-section"><div className="detail-section-card"><h2>What you&apos;ll learn</h2>{typeof content.whatItTeaches === "string" && <p>{content.whatItTeaches}</p>}{concepts.length > 0 && <><h3>Key concepts</h3><div className="tag-group">{concepts.map((concept) => <span className="mem-cat-tag" key={concept}>{concept}</span>)}</div></>}</div></section>;
  return null;
}

function evidenceLabels(memory: Memory) {
  const labels = new Set<string>();
  if (memory.sourceType === "text" && memory.rawText) labels.add("The text you saved");
  for (const source of memory.evidenceSources) {
    if (source.metadataSource === "youtube-oembed") labels.add("Public YouTube title and channel metadata");
    else if (source.metadataSource || source.modality === "metadata") labels.add("Available public page metadata");
    if (source.caption && memory.sourceType !== "text") labels.add("Saved caption or description");
    if (source.transcript) labels.add("Available transcript");
    if (source.onScreenText) labels.add("Available on-screen text");
  }
  if (!labels.size) labels.add(memory.rawText ? "The text and source you saved" : "The original source link");
  return [...labels];
}
export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [draft, setDraft] = useState({ title: "", summary: "", category: "Other", tags: "" });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/memories/" + id, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(response.status === 404 ? "This Memory could not be found." : body.error?.message || "Unable to load memory.");
      if (!cancelled) setMemory(body.data as Memory);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load memory."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, attempt]);
  const thumbnail = memory && thumbnailFor(memory);
  const author = memory?.evidenceSources.find((source) => source.author)?.author;
  function beginEdit() {
    if (!memory) return;
    setDraft({ title: memory.title, summary: memory.summary || "", category: memory.category || "Other", tags: memory.tags.join(", ") });
    setMenu(false); setEditing(true);
  }
  async function saveEdit() {
    if (!memory || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, summary: draft.summary || null, category: draft.category, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }) });
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error?.message || "Unable to save changes.");
      setMemory(body.data as Memory); setEditing(false); invalidateQueryCache("memories"); invalidateQueryCache("today");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save changes."); }
    finally { setSaving(false); }
  }
  async function deleteMemory() {
    if (!memory || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "Unable to delete Memory."); }
      invalidateQueryCache("memories"); invalidateQueryCache("today"); router.replace("/memories"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete Memory."); setDeleting(false); setSaving(false); }
  }
  async function reanalyzePreview() {
    if (!memory || reanalyzing) return;
    setReanalyzing(true); setError(""); setMenu(false);
    try {
      const response = await fetch(`/api/memories/${memory.id}/reanalyze-preview`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error?.message || "Unable to re-analyze the source preview.");
      setMemory(body.data as Memory); invalidateQueryCache("memories");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to re-analyze the source preview."); }
    finally { setReanalyzing(false); }
  }
  return <RequireAuth>
    <div className="detail-back-row"><Link href="/memories" className="detail-back"><span aria-hidden="true">{IC.arrowL}</span>Back to Memories</Link>{memory && <div className="detail-menu-wrap"><SourceBadge memory={memory} /><button className="icon-button" type="button" aria-label="Memory options" aria-expanded={menu} onClick={() => setMenu(!menu)}>{IC.dots}</button>{menu && <div className="detail-menu"><button type="button" onClick={beginEdit}>Edit Memory</button>{memory.evidenceSources.some((source) => source.thumbnail) && <button type="button" disabled={reanalyzing} onClick={() => void reanalyzePreview()}>{reanalyzing ? "Re-analyzing preview…" : "Re-analyze preview"}</button>}<button type="button" className="danger-text" onClick={() => { setMenu(false); setDeleting(true); }}>Delete Memory</button></div>}</div>}</div>
    {loading && <div className="px"><StatePanel>Loading memory…</StatePanel></div>}
    {!loading && error && <div className="px"><StatePanel tone="error"><p>{error}</p><button className="btn-ghost" onClick={() => { setLoading(true); setError(""); setAttempt(attempt + 1); }}>Try again</button></StatePanel></div>}
    {!loading && !error && memory && <article>
      {thumbnail && <div className="detail-hero-wrap"><Image unoptimized src={thumbnail} alt="" width={600} height={400} className="detail-hero-img" /></div>}
      <div className="detail-title-block"><MemoryTitle title={memory.title} /><div className="detail-meta"><span>Saved {savedDate(memory.createdAt)}</span>{author && <span>· {author}</span>}</div>
        {memory.sourceUrl && /^https?:\/\//i.test(memory.sourceUrl) && <a href={memory.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" aria-label="Open original source in a new tab">Open original<span aria-hidden="true">{IC.arrowR}</span></a>}
      </div>
      {memory.analysisStatus !== "complete" && <section className="detail-section"><StatePanel tone={memory.analysisStatus === "failed" ? "error" : "muted"}>{memory.analysisStatus === "partial" ? "Some details may be incomplete." : memory.analysisStatus === "failed" ? "Your original source is saved, but understanding it was incomplete." : "Understanding this Memory…"}</StatePanel></section>}
      {memory.summary && <section className="detail-section"><div className="detail-section-card"><h2>Summary</h2><p className="detail-summary">{memory.summary}</p></div></section>}
      <StructuredMemory memory={memory} />
      <section className="detail-section"><div className="detail-section-card"><h2>What REIBRY understood</h2>
        {(memory.category || memory.tags.length > 0) && <><h3>Topics</h3><div className="tag-group">{memory.category && <span className="mem-cat-tag">{memory.category}</span>}{memory.tags.map((tag) => <span className="mem-cat-tag" key={tag}>{tag}</span>)}</div></>}
        {memory.entities.length > 0 && <><h3>People &amp; things</h3><div className="tag-group">{memory.entities.map((entity, index) => <span className="mem-cat-tag" key={entity.name + index}>{entity.name}</span>)}</div></>}
        {memory.possibleIntents.length > 0 && <><h3>Intent &amp; context</h3><div className="why-box"><p>{memory.possibleIntents.join(" · ")}</p></div></>}
        {memory.analysisMetadata?.visualEvidence?.analyzed && <><h3>Visual details</h3>{memory.analysisMetadata.visualEvidence.visualDescription && <p>{memory.analysisMetadata.visualEvidence.visualDescription}</p>}{stringList(memory.analysisMetadata.visualEvidence.relationships).length > 0 && <ul className="evidence-list">{stringList(memory.analysisMetadata.visualEvidence.relationships).slice(0, 6).map((relationship) => <li key={relationship}>{relationship}</li>)}</ul>}<div className="tag-group">{stringList(memory.analysisMetadata.visualEvidence.concepts).slice(0, 8).map((concept) => <span className="mem-cat-tag" key={concept}>{concept}</span>)}</div></>}
      </div></section>
      <section className="detail-section"><div className="detail-section-card"><h2>Source evidence</h2><ul className="evidence-list">{evidenceLabels(memory).map((label) => <li key={label}>{label}</li>)}</ul></div></section>
    </article>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(false)}><div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-memory-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="edit-memory-title">Edit Memory</h2><label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Summary<textarea rows={5} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{MEMORY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Tags <span className="field-hint">Comma separated</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label><div className="modal-actions"><button className="btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="btn-primary" type="button" disabled={saving || !draft.title.trim()} onClick={saveEdit}>{saving ? "Saving…" : "Save changes"}</button></div></div></div>}
    {deleting && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleting(false)}><div className="modal-sheet" role="alertdialog" aria-modal="true" aria-labelledby="delete-memory-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="delete-memory-title">Delete this memory?</h2><p>This removes it from REIBRY. This can&apos;t be undone.</p><div className="modal-actions"><button className="btn-ghost" type="button" onClick={() => setDeleting(false)}>Cancel</button><button className="btn-danger" type="button" disabled={saving} onClick={deleteMemory}>{saving ? "Deleting…" : "Delete memory"}</button></div></div></div>}
  </RequireAuth>;
}
