export function normalizeLifeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Supabase stores timestamptz. Preserve only unambiguous ISO values here;
  // natural-language values remain in the description instead of being sent
  // to Postgres as invalid timestamp literals.
  const timestamp = /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
