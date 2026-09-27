import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  try {
    const { supabase, adminClient } = await requireAdmin();
    const db = adminClient || supabase;
    const [memories, life, profiles] = await Promise.all([
      db.from("memories").select("id, analysis_status, source_platform, category", { count: "exact", head: true }),
      db.from("life_contexts").select("id", { count: "exact", head: true }),
      db.from("profiles").select("user_id", { count: "exact", head: true }),
    ]);
    if (memories.error || life.error || profiles.error) return NextResponse.json({ data: null, error: { code: "ADMIN_UNAVAILABLE", message: "Admin metrics are unavailable." } }, { status: 503 });
    return NextResponse.json({ data: { accounts: profiles.count || 0, memories: memories.count || 0, lifeContexts: life.count || 0, trackedPwaInstalls: null }, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Admin access required." } }, { status: 403 });
  }
}
