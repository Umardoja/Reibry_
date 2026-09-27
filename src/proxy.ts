import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) { return updateSession(request); }

// API route handlers refresh cookies themselves and return their own structured errors.
export const config = { matcher: ["/today/:path*", "/memories/:path*", "/capture/:path*", "/ask/:path*", "/life/:path*"] };
