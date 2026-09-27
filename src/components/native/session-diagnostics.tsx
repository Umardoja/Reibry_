"use client";
import { useEffect, useState } from "react";
import { Android, isNativeAndroid, nativeAuthState, nativeAuthUser, syncNativeSession } from "@/lib/native/android";

async function loadDiagnostics() {
  if (!isNativeAndroid()) return null;
  try {
    await syncNativeSession();
    const web = nativeAuthUser() ? "Signed in" : nativeAuthState() === "unauthenticated" ? "Signed out" : "Restoring";
    const data = await Android.sessionDiagnostics({ userId: nativeAuthUser() });
    return { web, data };
  } catch { return null; /* Older/release APKs do not expose diagnostics. */ }
}
export function NativeSessionDiagnostics() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadDiagnostics>>>(null);
  useEffect(() => {
    let active = true;
    void loadDiagnostics().then(result => { if (active) setSnapshot(result); });
    return () => { active = false; };
  }, []);
  const refresh = () => { void loadDiagnostics().then(setSnapshot); };
  const data = snapshot?.data;
  const web = snapshot?.web;
  // BuildConfig.DEBUG in the native plugin is authoritative, not the hosted Next build mode.
  if (!data?.available) return null;
  return <section className="card settings-section"><h2 className="section-heading">Native session (debug)</h2>
    <p>Web session: {web}</p><p>Native session: {data.nativeAuthReady ? "Ready" : data.state}</p>
    <p>User match: {data.storedUserMatchesWebUser ? "Yes" : "No"}</p>
    <p>Refresh available: {data.refreshTokenPresent ? "Yes" : "No"}</p>
    <p>Access expired: {data.accessTokenExpired ? "Yes" : "No"}</p>
    <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>Retry session sync</button>
  </section>;
}
