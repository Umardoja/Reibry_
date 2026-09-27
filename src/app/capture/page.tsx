"use client";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { IC } from "@/components/design/icons";
import type { Memory } from "@/types/reibry";
import { invalidateQueryCache } from "@/lib/client/query-cache";
import { normalizeSharedPayload } from "@/lib/share/payload";
import { readPendingShare } from "@/lib/share/pending";
import { createSubmissionGate, type CaptureState } from "@/lib/capture/submission";
import { notifyRemembered, notifySharedCapture } from "@/lib/pwa/notifications";
import { NotificationControl } from "@/components/pwa/notification-control";
import { startSharedCapture, submitCapture } from "@/lib/share/capture";
export default function Capture() { return <RequireAuth><CaptureContent /></RequireAuth>; }
function CaptureContent() {
  return <Suspense fallback={<StatePanel>Opening Capture…</StatePanel>}><CaptureFromQuery /></Suspense>;
}
function CaptureFromQuery() {
  const params = useSearchParams();
  return <CaptureBody key={params.get("share") || "manual"} />;
}
function CaptureBody() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<CaptureState>("idle");
  const gate = useRef(createSubmissionGate());
  const prefilled = useRef(false);
  const pendingId = useRef<string | null>(null);
  const busy = state === "submitting" || ["complete", "partial", "duplicate"].includes(state);
  const [shared, setShared] = useState(false);
  const [sharedReceiver, setSharedReceiver] = useState(false);
  const [savedMemory, setSavedMemory] = useState<Memory | null>(null);
  const [recent, setRecent] = useState<Memory[]>([]);
  const router = useRouter();
  useEffect(() => { queueMicrotask(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const params = new URLSearchParams(window.location.search);
    pendingId.current = params.get("share");
    let payload = normalizeSharedPayload({ text: params.get("text") || params.get("rawText") || undefined, url: params.get("url") || params.get("sourceUrl") || undefined, title: params.get("title") || undefined });
    try { if (pendingId.current) payload = readPendingShare(sessionStorage, pendingId.current) || {}; } catch { /* Manual Capture still works if storage is unavailable. */ }
    if (payload.text || payload.url || payload.title) { setValue([...new Set([payload.url, payload.title, payload.text].filter(Boolean))].join("\n")); setShared(true);
      if (pendingId.current) { setSharedReceiver(true); void rememberShared(pendingId.current); }
    }
  }); }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/memories?limit=3", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!cancelled && response.ok && Array.isArray(body.data?.items)) setRecent(body.data.items);
    }).catch(() => { /* Recent items are optional; Capture remains available. */ });
    return () => { cancelled = true; };
  }, []);
  const url = normalizeSharedPayload({ text: value }).url;
  let hostname = "";
  try { if (url) hostname = new URL(url).hostname; } catch { /* The API validates input. */ }
  async function rememberShared(id: string, retry = false) {
    if (!gate.current.start()) return;
    setState("submitting"); setError("");
    try {
      const request = startSharedCapture(sessionStorage, id, async (text) => {
        void notifySharedCapture(id, "processing");
        try {
          const result = await submitCapture(text);
          void notifySharedCapture(id, "complete", result.memory);
          return result;
        } catch (cause) { void notifySharedCapture(id, "error"); throw cause; }
      }, retry);
      if (!request) throw new Error("This share may have been interrupted. Retry to check and save it.");
      const result = await request;
      const outcome = result.duplicate ? "duplicate" : result.memory.analysisStatus === "partial" ? "partial" : "complete";
      gate.current.finish(outcome); setState(outcome); setSavedMemory(result.memory); invalidateQueryCache("memories"); invalidateQueryCache("today");
    } catch {
      gate.current.fail(); setState("error"); setError("We couldn’t finish remembering this. Your shared source is available to retry.");
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || !gate.current.start()) return;
    setState("submitting"); setError(""); setNotice("");
    if (process.env.NODE_ENV === "development") console.info("[capture] submitting");
    try {
      const result = await submitCapture(value);
      const outcome = result.duplicate ? "duplicate" : result.memory.analysisStatus === "partial" ? "partial" : "complete";
      if (!gate.current.finish(outcome)) return;
      setState(outcome);
      setNotice(result.duplicate ? "Already remembered. Opening the existing Memory…" : outcome === "partial" ? "Remembered with limited understanding." : "Remembered.");
      void notifyRemembered(result.memory); invalidateQueryCache("memories"); invalidateQueryCache("today");
      router.push("/memories/" + result.memory.id);    } catch (cause) { gate.current.fail(); setError(cause instanceof Error ? cause.message : "We couldn’t remember this. Please try again."); setState("error"); }
  }
  if (sharedReceiver) return <PageContainer className="share-receiver">
    <h1 className="page-h1">{savedMemory ? "Remembered" : error ? "Couldn't remember this" : "Remembering…"}</h1>
    <div className="processing-card" role="status">
      <p className="processing-label">Shared with REIBRY</p>
      <p className="page-sub">{savedMemory ? savedMemory.title : hostname || "Your shared source"}</p>
      <p className="processing-note">{savedMemory?.analysisStatus === "partial" ? "Your original source is saved with limited understanding." : "You can return to what you were doing."}</p>
    </div>
    {error && <StatePanel tone="error"><p>{error}</p><button className="btn-primary" onClick={() => { if (pendingId.current) void rememberShared(pendingId.current, true); }}>Retry</button></StatePanel>}
    {savedMemory && <Link className="btn-primary" href={"/memories/" + savedMemory.id}>View memory</Link>}
  </PageContainer>;
  return <PageContainer>
    <h1 className="page-h1">Save a thought,<br />link, or plan.</h1><p className="page-sub">Paste a recipe, article, or note. REIBRY understands and connects it to your world.</p>
    <div className="gap-sm" />
    <form onSubmit={submit}>
      <div className="capture-composer">
        <div className="composer-header"><label className="composer-header-label" htmlFor="capture-input">Capture</label><span className="composer-char-count">{value.length} characters</span></div>
        <textarea id="capture-input" className="capture-textarea" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} placeholder="Paste a link, save a thought, or tell REIBRY something worth remembering…" />
        {shared && <p className="px page-sub">Shared with REIBRY</p>}
        {hostname && <div className="url-preview-card"><span className="url-icon" aria-hidden="true">{hostname.includes("youtu") ? IC.yt : IC.link}</span><div className="url-preview-info"><p className="url-preview-title">{hostname}</p><p className="url-preview-src">{url}</p></div></div>}
      </div>
      <div className="gap-sm" />
      {busy && <div className="processing-card" role="status"><div className="processing-label">Remembering</div><div className="proc-step active"><span className="proc-step-dot" />{notice || "Understanding…"}</div><p className="processing-note">Your source is being saved and understood. This may take a moment.</p></div>}
      {error && <StatePanel tone="error">{error}</StatePanel>}
      <div className="gap-sm" /><button type="submit" disabled={!value.trim() || busy} className="btn-primary">{busy ? notice ? "Remembered" : "Remembering…" : error ? "Retry — Remember this" : "Remember this"}<span aria-hidden="true">{IC.arrowR}</span></button>
    </form>
    <NotificationControl />
    {recent.length > 0 && <section className="recent-section"><div className="recent-row"><h2 className="recent-label">Recently remembered</h2><Link className="recent-view-all" href="/memories">View all</Link></div>{recent.map((memory) => <Link className="recent-item" key={memory.id} href={"/memories/" + memory.id}><span className="recent-item-icon" aria-hidden="true">{memory.sourceUrl ? IC.link : IC.file}</span><div className="recent-item-info"><h3 className="recent-item-title">{memory.title}</h3><p className="recent-item-sub">{memory.sourcePlatform || memory.category || "Saved note"}</p></div><span className="recent-item-arrow" aria-hidden="true">{IC.arrowR}</span></Link>)}</section>}
  </PageContainer>;
}
