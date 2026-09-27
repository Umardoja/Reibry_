import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const event = z.object({ eventName: z.enum(["pwa_installed"]), source: z.string().max(40).optional() });
export async function POST(request: Request) {
  const parsed = event.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Invalid analytics event." } }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return NextResponse.json({ data: null, error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const result = await supabase.from("analytics_events").insert({ user_id: data.claims.sub, event_name: parsed.data.eventName, source: parsed.data.source || "web", metadata: {} });
  if (result.error) return NextResponse.json({ data: null, error: { code: "ANALYTICS_UNAVAILABLE", message: "Analytics unavailable." } }, { status: 503 });
  return NextResponse.json({ data: { recorded: true }, error: null });
}
