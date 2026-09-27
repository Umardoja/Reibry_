import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(scriptRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const report = ["REIBRY Supabase Verification", "", `Environment ........ ${url && anonKey ? "PASS" : "FAIL"}`];
if (!url || !anonKey) {
  report.push("Connection ......... SKIPPED (required variables are missing)");
  console.log(report.join("\n"));
  process.exitCode = 1;
} else {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: anonKey } });
    report.push(`Connection ......... ${response.ok || response.status === 401 ? "PASS" : "FAIL"}`);
  } catch {
    report.push("Connection ......... FAIL (endpoint unreachable)");
  }
  const tables = [["memories", "memories"], ["life_contexts", "life_contexts"], ["matches", "memory_context_matches"], ["actions", "actions"], ["feedback", "feedback"]];
  for (const [label, table] of tables) {
    const { error } = await client.from(table).select("id").limit(1);
    if (!error) report.push(`${label.padEnd(19, ".")} EXISTS / ACCESSIBLE`);
    else if (["42501", "401", "403"].includes(error.code) || /row-level security|permission denied|JWT/i.test(error.message)) report.push(`${label.padEnd(19, ".")} EXISTS / RLS PROTECTED`);
    else if (error.code === "42P01" || /relation .* does not exist|table .* does not exist/i.test(error.message)) { report.push(`${label.padEnd(19, ".")} MISSING`); process.exitCode = 1; }
    else { report.push(`${label.padEnd(19, ".")} CHECK FAILED (${error.code || "unknown database error"})`); process.exitCode = 1; }
  }
  console.log(report.join("\n"));
}
