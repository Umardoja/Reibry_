export type CaptureState = "idle" | "submitting" | "complete" | "partial" | "duplicate" | "error";
/** Synchronous lock acquired before React renders. Completion cannot navigate twice. */
export function createSubmissionGate() {
  let state: CaptureState = "idle";
  return {
    start() { if (state !== "idle" && state !== "error") return false; state = "submitting"; return true; },
    finish(outcome: "complete" | "partial" | "duplicate") { if (state !== "submitting") return false; state = outcome; return true; },
    fail() { if (state === "submitting") state = "error"; },
    state: () => state,
  };
}
