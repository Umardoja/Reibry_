import { readPendingShare, completePendingShare } from "./pending.ts";
import { capturePayload } from "./payload.ts";
import type { Memory } from "../../types/reibry.ts";

export type CaptureResult = { memory: Memory; duplicate: boolean };
export async function submitCapture(value: string): Promise<CaptureResult> {
  const response = await fetch("/api/capture", { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(capturePayload(value)) });
  const body = await response.json();
  if (!response.ok || !body.data?.memory?.id || !["complete", "partial"].includes(body.data.memory.analysisStatus)) {
    throw new Error("We couldn’t remember this. Please try again.");
  }
  return body.data;
}

const running = new Map<string, Promise<CaptureResult>>();
/** Synchronous claim survives reload; an interrupted attempt requires an explicit retry. */
export function startSharedCapture(storage: Storage, id: string | null, submit: (value: string) => Promise<CaptureResult>, retry = false): Promise<CaptureResult> | null {
  if (!id) return null;
  if (running.has(id)) return running.get(id)!;
  const payload = readPendingShare(storage, id);
  if (!payload || !(payload.url || payload.text || payload.title)) return null;
  const key = `REIBRY_SHARE_ATTEMPT:${id}`;
  if (!retry && storage.getItem(key)) return null;
  storage.setItem(key, "started");
  const value = [...new Set([payload.url, payload.title, payload.text].filter(Boolean))].join("\n");
  const promise = Promise.resolve().then(() => submit(value)).then((result) => {
    completePendingShare(storage, id);
    storage.removeItem(key);
    return result;
  }).finally(() => { running.delete(id); });
  running.set(id, promise);
  return promise;
}
