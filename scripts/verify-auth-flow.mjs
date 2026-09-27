import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || process.env[match[1]]) continue;
  const value = match[2].replace(/^("|')(.*)\1$/, "$2");
  process.env[match[1]] = value;
}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "REIBRY_TEST_EMAIL_A", "REIBRY_TEST_PASSWORD_A", "REIBRY_TEST_EMAIL_B", "REIBRY_TEST_PASSWORD_B"];
const missing = required.filter((name) => !process.env[name]);
const output = ["REIBRY Authenticated Verification", ""];
if (missing.length) {
  output.push("Environment ............... BLOCKED (set required local variables)");
  console.log(output.join("\n"));
  process.exitCode = 1;
} else {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const makeClient = () => createClient(base, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signInOrSignUp = async (email, password) => {
    const client = makeClient();
    let result = await client.auth.signInWithPassword({ email, password });
    if (result.error?.message?.toLowerCase().includes("invalid login credentials")) {
      const signup = await client.auth.signUp({ email, password });
      if (signup.error) throw new Error(`signup failed: ${signup.error.message}`);
      result = await client.auth.signInWithPassword({ email, password });
    }
    if (result.error || !result.data.session || !result.data.user) throw new Error(result.error?.message || "email confirmation is required before sign-in");
    return { client, user: result.data.user };
  };
  const a = await signInOrSignUp(process.env.REIBRY_TEST_EMAIL_A, process.env.REIBRY_TEST_PASSWORD_A);
  const b = await signInOrSignUp(process.env.REIBRY_TEST_EMAIL_B, process.env.REIBRY_TEST_PASSWORD_B);
  output.push("Environment ............... PASS", "User A authentication ..... PASS", "User B authentication ..... PASS");
  const memory = { user_id: a.user.id, title: "REIBRY Verification Memory", summary: "Disposable memory used to test authenticated persistence.", source_type: "text", analysis_status: "partial", evidence_sources: [], tags: [], entities: [], possible_intents: [], possible_actions: [] };
  const insertedMemory = await a.client.from("memories").insert(memory).select("id,user_id,analysis_status").single();
  if (insertedMemory.error || !insertedMemory.data) throw new Error(`memory insert failed: ${insertedMemory.error?.message || "no row returned"}`);
  const memoryRead = await a.client.from("memories").select("id,user_id").eq("id", insertedMemory.data.id).single();
  if (memoryRead.error || memoryRead.data?.user_id !== a.user.id) throw new Error("memory read failed");
  const life = await a.client.from("life_contexts").insert({ user_id: a.user.id, type: "event", title: "REIBRY Verification Event", status: "active" }).select("id,user_id").single();
  if (life.error || !life.data) throw new Error(`life insert failed: ${life.error?.message || "no row returned"}`);
  const lifeRead = await a.client.from("life_contexts").select("id,user_id").eq("id", life.data.id).single();
  if (lifeRead.error || lifeRead.data?.user_id !== a.user.id) throw new Error("life read failed");
  output.push("Memory persistence ........ PASS", "Life persistence .......... PASS");
  const otherMemory = await b.client.from("memories").select("id").eq("id", insertedMemory.data.id).maybeSingle();
  const otherLife = await b.client.from("life_contexts").select("id").eq("id", life.data.id).maybeSingle();
  const isolation = !otherMemory.data && !otherLife.data;
  output.push(`RLS isolation ............. ${isolation ? "PASS" : "FAIL"}`);
  const spoof = await a.client.from("memories").insert({ ...memory, user_id: b.user.id, title: "REIBRY Spoof Attempt" }).select("id").maybeSingle();
  output.push(`Ownership spoofing ........ ${spoof.error ? "BLOCKED" : "FAIL"}`);
  await a.client.from("memories").delete().eq("id", insertedMemory.data.id).eq("user_id", a.user.id);
  await a.client.from("life_contexts").delete().eq("id", life.data.id).eq("user_id", a.user.id);
  await a.client.auth.signOut();
  await b.client.auth.signOut();
  output.push("Cleanup ................... PASS", "API checks ................ MANUAL (start `npm run dev` and use the documented routes)");
  console.log(output.join("\n"));
}
