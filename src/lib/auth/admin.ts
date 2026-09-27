import "server-only";
import { createClient } from "@/lib/supabase/server";
import { IntegrationError } from "@/lib/integration/errors";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) throw new IntegrationError("AUTH_REQUIRED", "Admin authentication required");
  const profile = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (profile.error || profile.data?.role !== "admin") throw new IntegrationError("AUTH_REQUIRED", "Admin role required");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = serviceKey ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey) : null;
  return { supabase, adminClient, userId };
}
