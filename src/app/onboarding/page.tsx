"use client";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/next-destination";
import { StatePanel } from "@/components/ui/primitives";
import { IC } from "@/components/design/icons";
import type { LifeContext } from "@/types/reibry";
import { NotificationControl } from "@/components/pwa/notification-control";
const examples = ["Exam next week", "Planning a trip", "Starting a new project", "Job interview preparation"];
export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const destination = safeNext(new URLSearchParams(window.location.search).get("next"));
    if (destination) { router.replace(destination); return; }
    fetch("/api/account", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/auth"); return; }
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (body.data.onboardingCompletedAt) { router.replace("/today"); return; }
      setReady(true);
    }).catch(() => setError("We couldn’t load your account. Please try again."));
  }, [router]);
  async function finish() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      router.push(safeNext(new URLSearchParams(window.location.search).get("next")) || "/today"); router.refresh();
    } catch { setError("We couldn’t save your progress. Please try again."); }
    finally { setLoading(false); }
  }
  async function saveLife(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!text.trim()) { setStep(3); return; }
    setLoading(true); setError("");
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await fetch("/api/life/create", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ text: text.trim(), timezone }) });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.data?.contexts)) throw new Error();
      let matches = 0;
      let unavailable = false;
      for (const context of body.data.contexts as LifeContext[]) {
        try {
          const result = await fetch("/api/context/match", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ lifeContextId: context.id }) });
          const matching = await result.json();
          if (!result.ok || !Array.isArray(matching.data?.matches)) unavailable = true;
          else matches += matching.data.matches.length;
        } catch { unavailable = true; }
      }
      setNotice(unavailable ? "Life event saved. Related Memories can be checked later." : matches ? "Life event saved. Related Memories found." : "Life event saved. No relevant Memories found yet.");
      setText(""); setStep(3);
    } catch { setError("We could not save that context right now. You can retry or skip and add it later."); }
    finally { setLoading(false); }
  }
  if (!ready) return <section className="onboarding"><StatePanel tone={error ? "error" : undefined}>{error || "Loading your account…"}{error && <><button className="btn-ghost" onClick={() => window.location.reload()}>Try again</button><button className="btn-ghost" onClick={() => router.push("/today")}>Continue to REIBRY</button></>}</StatePanel></section>;
  return <section className="onboarding">
    <div className="onboard-top"><div className="onboard-progress" aria-label={"Step " + step + " of 4"}>{[1, 2, 3, 4].map((item) => <span key={item} className={item <= step ? "done" : ""} />)}</div><button className="btn-ghost" disabled={loading} onClick={finish}>Skip</button></div>
    {step === 1 && <><div><p className="onboard-step">Step 1 of 4</p><h1 className="onboard-title">Getting Started</h1><p className="onboard-copy">Save links, thoughts, and ideas — REIBRY brings them back when they matter.</p><div className="card onboard-image-card"><Image src="/images/onboarding-workspace.png" alt="" width={800} height={400} className="onboard-image" /><div className="onboard-image-caption"><span aria-hidden="true">{IC.memories}</span><p><strong>Your personal memory library</strong><br />Keep the things you want to come back to.</p></div></div></div><div className="onboard-bottom"><button className="btn-primary" onClick={() => setStep(2)}>Continue<span aria-hidden="true">{IC.arrowR}</span></button><button className="btn-ghost" onClick={finish}>Skip</button></div></>}
    {step === 2 && <form onSubmit={saveLife} className="onboard-form"><p className="onboard-step">Step 2 of 4</p><h1 className="onboard-title">Tell us about yourself</h1><p className="onboard-copy">Tell REIBRY what&apos;s coming up or important. You can always do this later.</p><div className="gap-section" /><div className="life-composer"><label className="sr-only" htmlFor="onboard-life">Life context</label><textarea id="onboard-life" className="life-textarea" value={text} disabled={loading} onChange={(event) => setText(event.target.value)} placeholder="An exam, a trip, a new project…" /></div><div className="gap-sm" /><div className="thought-prompts">{examples.map((example) => <button disabled={loading} type="button" className="thought-pill" key={example} onClick={() => setText(example)}>{example}</button>)}</div><div className="onboard-bottom"><button disabled={loading} className="btn-primary">{loading ? "Saving…" : "Continue"}</button><button type="button" disabled={loading} className="btn-ghost" onClick={() => setStep(3)}>Skip for now</button></div></form>}
    {step === 3 && <><div><p className="onboard-step">Step 3 of 4</p><h1 className="onboard-title">You&apos;re all set</h1><p className="onboard-copy">From YouTube, your browser, or another app, share something useful with REIBRY.</p><div className="card onboard-feature"><span aria-hidden="true">{IC.link}</span><p>Share → REIBRY → Remember this</p></div><div className="card onboard-feature"><span aria-hidden="true">{IC.plus}</span><p>You can always paste a link in Capture.</p></div>{notice && <StatePanel>{notice}</StatePanel>}</div><div className="onboard-bottom"><button className="btn-primary" onClick={() => setStep(4)}>Continue<span aria-hidden="true">{IC.arrowR}</span></button></div></>}
    {step === 4 && <><div><p className="onboard-step">Step 4 of 4</p><h1 className="onboard-title">Stay in the moment</h1><p className="onboard-copy">REIBRY can let you know when something you shared has been remembered, so you can keep using the app you were already in.</p><NotificationControl detailed /></div><div className="onboard-bottom"><button className="btn-primary" disabled={loading} onClick={finish}>Start using REIBRY</button><button className="btn-ghost" disabled={loading} onClick={finish}>Not now</button></div></>}
    {error && <StatePanel tone="error">{error}</StatePanel>}
  </section>;
}
