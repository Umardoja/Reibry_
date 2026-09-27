import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "@/lib/supabase/env";
const input = z.object({ refreshToken: z.string().min(1).max(8192), userId: z.uuid() }).strict();
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number) => NextResponse.json({ data: null, error: { code: status === 401 ? "AUTH_REQUIRED" : "AUTH_UNAVAILABLE" } }, { status, headers });
  try {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return fail(400);
    const raw = await request.text(); if (raw.length > 10000) return fail(400);
    const parsed = input.safeParse(JSON.parse(raw)); if (!parsed.success) return fail(400);
    const { url, key } = getSupabaseEnv();
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.refreshSession({ refresh_token: parsed.data.refreshToken });
    if (error) return fail(error.status === 429 || !error.status || error.status >= 500 ? 503 : 401);
    if (!data.session || data.user?.id !== parsed.data.userId) return fail(401);
    const verified = await client.auth.getUser(data.session.access_token);
    if (verified.error) return fail(verified.error.status && verified.error.status < 500 && verified.error.status !== 429 ? 401 : 503);
    if (verified.data.user?.id !== parsed.data.userId) return fail(401);
    return NextResponse.json({ data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, userId: data.user.id, expiresAt: data.session.expires_at }, error: null }, { headers });
  } catch { return fail(503); }
}
