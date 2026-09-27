import { ConfigurationError } from "../utils/errors";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ConfigurationError();
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
  } catch { throw new ConfigurationError(); }
  return { url, key };
}
