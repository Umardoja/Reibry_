import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signupError } from "./account-policy";
import { safeNext } from "./next-destination";
const input = z.object({ email: z.email(), password: z.string().min(6).max(1024), next: z.string().optional() });
export function passwordHandler(signup: boolean) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "no-store" };
    try {
      const body = input.safeParse(await request.json());
      if (!body.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Enter a valid email and a password with at least 6 characters." } }, { status: 400, headers });
      const client = await createClient();
      const { email, password } = body.data;
      const callback = new URL("/auth/callback", request.url);
      const next = safeNext(body.data.next); if (next) callback.searchParams.set("next", next);
      const { data, error } = signup
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: callback.toString() } })
        : await client.auth.signInWithPassword({ email, password });
      if (error) {
        const safe = signupError(error.code, error.status);
        if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview") console.info("[auth]", { event: signup ? "SIGN_UP" : "SIGNED_IN", status: error.status, code: safe.code });
        return NextResponse.json({ data: null, error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
      }
      // Supabase may deliberately obscure duplicate accounts when confirmation is enabled.
      return NextResponse.json({ data, error: null }, { headers });
    } catch { const safe = signupError(); return NextResponse.json({ data: null, error: safe }, { status: safe.status, headers }); }
  };
}
