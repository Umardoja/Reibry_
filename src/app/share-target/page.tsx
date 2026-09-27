"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizeSharedPayload } from "@/lib/share/payload";
import { savePendingShare } from "@/lib/share/pending";
import { StatePanel } from "@/components/ui/primitives";
export default function ShareTarget() {
  const received = useRef(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (received.current) return;
    received.current = true;
    const params = new URLSearchParams(window.location.search);
    const payload = normalizeSharedPayload({ title: params.get("title") || undefined, text: params.get("text") || undefined, url: params.get("url") || undefined });
    if (!payload.url && !payload.text && !payload.title) { queueMicrotask(() => setError(true)); return; }
    try {
      const id = crypto.randomUUID();
      savePendingShare(sessionStorage, id, payload);
      router.replace(`/capture?share=${id}`);
    } catch {
      // Restricted browser storage: retain explicit prefill through the safe auth return URL.
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) if (value) query.set(key, value);
      router.replace(`/capture?${query}`);
    }
  }, [router]);
  return <div className="px"><StatePanel>{error ? <>There was nothing to share. <Link href="/capture">Open Capture</Link></> : "Opening your shared content…"}</StatePanel></div>;
}
