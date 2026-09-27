import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/next-destination";
export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next || "/onboarding", url.origin));
  }
  const destination = new URL("/auth", url.origin);
  destination.searchParams.set("confirmation", "return");
  if (next) destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}
