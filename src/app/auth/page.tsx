"use client";
import { EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/next-destination";
import { IC } from "@/components/design/icons";
import { StatePanel } from "@/components/ui/primitives";
import { syncNativeSession } from "@/lib/native/android";
import { accountDestination } from "@/lib/auth/account-policy";
import { useAuthSession } from "@/components/auth/auth-session-provider";

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-input-wrap password">
    <span aria-hidden="true">{IC.lock}</span><input id={id} required minLength={6} autoComplete={autoComplete} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} />
    <button className="eye" type="button" aria-label={visible ? "Hide " + label.toLowerCase() : "Show " + label.toLowerCase()} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <span aria-hidden="true">{IC.eye}</span>}</button>
  </div></div>;
}
function authMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) return "That email or password didn’t match. Try again.";
  if (lower.includes("already registered") || lower.includes("already exists")) return "An account with this email already exists. Sign in instead.";
  if (lower.includes("password")) return "Choose a password with at least 6 characters.";
  if (lower.includes("rate") || lower.includes("too many")) return "Please wait a moment before trying again.";
  if (lower.includes("email")) return "Check your email address and whether your account is confirmed.";
  return "We couldn’t complete that request. Please try again.";
}
export default function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const authSession = useAuthSession();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(""); setConfirmation(false);
    if (mode === "up" && password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/" + (mode === "in" ? "sign-in" : "sign-up"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: safeNext(new URLSearchParams(window.location.search).get("next")) || undefined }), credentials: "same-origin",
      });
      const body = await response.json();
      if (!response.ok) { setError(["EMAIL_RATE_LIMIT", "RATE_LIMIT", "EMAIL_EXISTS", "WEAK_PASSWORD", "INVALID_EMAIL", "EMAIL_DELIVERY", "EMAIL_UNCONFIRMED", "INVALID_CREDENTIALS", "AUTH_UNAVAILABLE", "VALIDATION_ERROR"].includes(body.error?.code) ? body.error.message : authMessage("")); return; }
      if (mode === "up" && !body.data?.session) { setConfirmation(true); return; }
      await syncNativeSession();
      authSession.authenticated(body.data?.user?.id);
      const destination = safeNext(new URLSearchParams(window.location.search).get("next"));
      if (destination) router.push(destination);
      else {
        let target = "/onboarding";
        try {
          const account = await fetch("/api/account", { credentials: "same-origin", cache: "no-store" });
          const profile = await account.json();
          if (account.ok) target = accountDestination(null, profile.data.onboardingCompletedAt);
        } catch { /* Account screen offers retry; successful authentication stays successful. */ }
        router.push(target);
      }
      router.refresh();
    } catch { setError("We couldn’t reach REIBRY right now. Please try again."); }
    finally { setLoading(false); }
  }
  return <section className="auth-wrap">
    <div className="auth-logo-ring" aria-hidden="true">{IC.brain}</div><h1 className="auth-brand">REIBRY</h1>
    <p className="auth-tagline">Remember what you discover.<br />Bring it back when it matters.</p>
    <div className="auth-tabs" aria-label="Account access">{(["in", "up"] as const).map((value) => <button key={value} type="button" disabled={loading} aria-pressed={mode === value} className={"auth-tab" + (mode === value ? " active" : "")} onClick={() => { setMode(value); setError(""); setConfirmation(false); }}>{value === "in" ? "Sign In" : "Sign Up"}</button>)}</div>
    <form onSubmit={submit} className="auth-form">
      <div className="auth-field"><label htmlFor="email">Email</label><div className="auth-input-wrap"><span aria-hidden="true">{IC.mail}</span><input id="email" required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></div>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete={mode === "in" ? "current-password" : "new-password"} />
      {mode === "up" && <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />}
      {error && <StatePanel tone="error">{error}</StatePanel>}
      {confirmation && <StatePanel><h2 className="section-heading">Check your email</h2><p>We sent a confirmation link to {email}. Confirm your email, then come back to sign in.</p></StatePanel>}
      <button disabled={loading} className="btn-primary">{loading ? "Working…" : mode === "in" ? "Sign In" : "Create account"}<span aria-hidden="true">{IC.arrowR}</span></button>
    </form>
  </section>;
}
