"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatePanel } from "@/components/ui/primitives";
import { useAuthSession } from "@/components/auth/auth-session-provider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, retry } = useAuthSession();

  useEffect(() => {
    if (state === "unauthenticated") router.replace("/auth?next=" + encodeURIComponent(window.location.pathname + window.location.search));
  }, [router, state]);

  if (state === "error") {
    return <div className="px"><StatePanel tone="error">Unable to verify your session.<button className="btn-ghost" onClick={retry}>Try again</button></StatePanel></div>;
  }

  return state === "authenticated" ? children : <div className="px route-skeleton" aria-label="Loading page"><span /><span /><span /></div>;
}
