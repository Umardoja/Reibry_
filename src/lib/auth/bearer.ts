/** Reject malformed credentials rather than falling back to a different cookie user. */
export function bearerToken(value: string | null): string | null {
  if (value === null) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(value);
  if (!match || match[0].length !== value.length) throw new Error("Invalid bearer credential");
  return match[1];
}
