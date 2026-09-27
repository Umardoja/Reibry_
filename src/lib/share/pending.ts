import { normalizeSharedPayload, type SharedPayload } from "./payload.ts";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const prefix = "REIBRY_PENDING_SHARE:";
const ttl = 24 * 60 * 60 * 1000;
export function savePendingShare(storage: StorageLike, id: string, payload: SharedPayload, now = Date.now()) {
  storage.setItem(prefix + id, JSON.stringify({ payload: normalizeSharedPayload(payload), expires: now + ttl }));
}
/** Read is intentionally non-consuming: auth, reload and a failed capture must not lose the share. */
export function readPendingShare(storage: StorageLike, id: string, now = Date.now()): SharedPayload | null {
  const raw = storage.getItem(prefix + id);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.expires !== "number" || data.expires < now || !data.payload || typeof data.payload !== "object") throw new Error();
    const { title, text, url } = data.payload;
    if ([title, text, url].some((v) => v !== undefined && typeof v !== "string")) throw new Error();
    return normalizeSharedPayload({ title, text, url });
  } catch { storage.removeItem(prefix + id); return null; }
}
/** Only the successful capture acknowledges this ID; other tabs/shares are unaffected. */
export function completePendingShare(storage: StorageLike, id: string): boolean {
  if (!storage.getItem(prefix + id)) return false;
  storage.removeItem(prefix + id); return true;
}
