"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearNativeSession } from "@/lib/native/android";
import { createClient } from "@/lib/supabase/client";
import { useAuthSession } from "@/components/auth/auth-session-provider";
export function SignOutButton() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  const authSession = useAuthSession();
  return <><button className="btn-ghost" disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await clearNativeSession();
      const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      await createClient().auth.signOut({ scope: "local" });
      authSession.unauthenticated();
      router.push("/auth"); router.refresh();
    } catch { setError("Could not sign out. Please try again."); }
    finally { setBusy(false); }
  }}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</>;
}
