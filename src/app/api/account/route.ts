import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
const headers = { "Cache-Control": "no-store" };
async function account(complete = false) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ data: null, error: { code: "AUTH_REQUIRED" } }, { status: 401, headers });
    const query = complete
      ? client.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("user_id", user.id).select("onboarding_completed_at").single()
      : client.from("profiles").select("onboarding_completed_at").eq("user_id", user.id).single();
    const { data, error } = await query;
    if (error) return NextResponse.json({ data: null, error: { code: "ACCOUNT_UNAVAILABLE", message: "We couldn’t load your account. Please try again." } }, { status: 503, headers });
    return NextResponse.json({ data: { email: user.email, onboardingCompletedAt: data.onboarding_completed_at }, error: null }, { headers });
  } catch { return NextResponse.json({ data: null, error: { code: "ACCOUNT_UNAVAILABLE" } }, { status: 503, headers }); }
}
export const GET = () => account();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403, headers });
  return account(true);
}
