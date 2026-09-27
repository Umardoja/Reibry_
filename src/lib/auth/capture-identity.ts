import "server-only";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { IntegrationError } from "@/lib/integration/errors";
import { bearerToken } from "./bearer";

export async function captureIdentity() {
  let token: string | null;
  try { token = bearerToken((await headers()).get("authorization")); }
  catch { throw new IntegrationError("AUTH_REQUIRED", "Sign in to remember this."); }
  if (token) {
    const { url, key } = getSupabaseEnv();
    const client = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new IntegrationError("AUTH_REQUIRED", "Sign in to remember this.");
    return { client, userId: data.user.id };
  }
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) throw new IntegrationError("AUTH_REQUIRED", "Sign in to remember this.");
  return { client, userId: data.claims.sub };
}
