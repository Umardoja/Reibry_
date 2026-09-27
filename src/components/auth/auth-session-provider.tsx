"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { syncNativeSession } from "@/lib/native/android";
import { clearQueryCache, setQueryScope } from "@/lib/client/query-cache";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "error";
const AuthContext = createContext<{ state: AuthState; userId: string | null; retry: () => void; authenticated: (userId?: string) => void; unauthenticated: () => void } | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking"); const [attempt, setAttempt] = useState(0); const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { let active = true; syncNativeSession().then(() => fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })).then(async (response) => { if (!response.ok) throw new Error("Session check failed"); const body = await response.json() as { data?: { user?: { id?: string } | null } }; if (!active) return; if (body.data?.user) { const id = body.data.user.id || null; setQueryScope(id); setUserId(id); setState("authenticated"); } else { clearQueryCache(); setUserId(null); setState("unauthenticated"); } }).catch(() => { if (active) setState("error"); }); return () => { active = false; }; }, [attempt]);
  const value = useMemo(() => ({ state, userId, retry: () => { setState("checking"); setAttempt((value) => value + 1); }, authenticated: (nextUserId?: string) => { const id = nextUserId || null; setQueryScope(id); setUserId(id); setState("authenticated"); }, unauthenticated: () => { clearQueryCache(); setUserId(null); setState("unauthenticated"); } }), [state, userId]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuthSession() { const value = useContext(AuthContext); if (!value) throw new Error("AuthSessionProvider is missing"); return value; }
