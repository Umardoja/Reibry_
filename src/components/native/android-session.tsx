"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Android, isNativeAndroid, syncNativeSession } from "@/lib/native/android";
import { savePendingShare } from "@/lib/share/pending";
import { createClient } from "@/lib/supabase/client";
import { clearNativeSession } from "@/lib/native/android";

export function AndroidSession() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let cancelled = false;
    async function resume() {
      await syncNativeSession();
      if (cancelled) return;
      try {
        const launch = await Android.takeLaunch();
        if (launch.path && /^\/memories\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(launch.path)) {
          if (window.location.pathname !== launch.path) router.replace(launch.path);
        } else if (launch.pendingId && launch.payload) {
          savePendingShare(sessionStorage, launch.pendingId, launch.payload);
          router.replace("/capture?share=" + encodeURIComponent(launch.pendingId));
        }
      } catch { /* Retry remains accessible from its native notification. */ }
    }
    const { data } = createClient().auth.onAuthStateChange((event) => {
      queueMicrotask(() => {
        if (cancelled) return;
        if (event === "SIGNED_OUT") void clearNativeSession();
        else if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) void syncNativeSession(true);
      });
    });
    const unsubscribe = () => data.subscription.unsubscribe();
    void resume();
    const visible = () => { if (document.visibilityState === "visible") void resume(); };
    window.addEventListener("focus", resume);
    window.addEventListener("reibry-native-launch", resume);
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; unsubscribe?.(); window.removeEventListener("focus", resume); window.removeEventListener("reibry-native-launch", resume); document.removeEventListener("visibilitychange", visible); };
  }, [router]);
  return null;
}
