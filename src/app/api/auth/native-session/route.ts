import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUnauthenticated } from "@/lib/auth/account-policy";

/** Cookie-authenticated same-origin bridge to Keystore storage. Never includes service credentials. */
export async function POST(request: Request) {
  const options = { headers: { "Cache-Control": "no-store", "Vary": "Cookie, Origin" } };
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("x-reibry-native") !== "android") {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { ...options, status: 403 });
  }
  try {
    const client = await createClient();
    const { data: user, error } = await client.auth.getUser();
    if (error && !isUnauthenticated(error)) return NextResponse.json({ data: null, error: { code: "UNAVAILABLE" } }, { ...options, status: 503 });
    if (error || !user.user) return NextResponse.json({ data: null, error: { code: "AUTH_REQUIRED" } }, { ...options, status: 401 });
    const { data } = await client.auth.getSession();
    if (!data.session || data.session.user.id !== user.user.id) return NextResponse.json({ data: null, error: { code: "AUTH_REQUIRED" } }, { ...options, status: 401 });
    return NextResponse.json({ data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, userId: user.user.id, expiresAt: data.session.expires_at }, error: null }, options);
  } catch {
    return NextResponse.json({ data: null, error: { code: "UNAVAILABLE" } }, { ...options, status: 503 });
  }
}
