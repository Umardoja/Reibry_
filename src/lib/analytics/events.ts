import "server-only";
import { createClient } from "@/lib/supabase/server";

const names = new Set(["account_created", "signed_in", "memory_saved", "memory_partial", "memory_failed", "life_created", "ask_performed", "ask_no_match", "android_share_capture", "pwa_installed", "native_app_open"]);
export async function recordAnalyticsEvent(input: { userId?: string | null; eventName: string; source?: string; metadata?: Record<string, string | number | boolean | null> }) {
  if (!names.has(input.eventName)) return;
  const metadata = Object.fromEntries(Object.entries(input.metadata || {}).slice(0, 8));
  const supabase = await createClient();
  await supabase.from("analytics_events").insert({ user_id: input.userId || null, event_name: input.eventName, source: input.source || null, metadata });
}
