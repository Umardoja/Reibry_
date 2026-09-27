import { safeNext } from "./next-destination.ts";
export function isUnauthenticated(error: { name?: string; status?: number; code?: string }) {
  return error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 ||
    ["bad_jwt", "session_not_found", "refresh_token_not_found", "refresh_token_already_used"].includes(error.code || "");
}
export function accountDestination(next: string | null, completedAt: string | null) {
  return safeNext(next) || (completedAt ? "/today" : "/onboarding");
}
export function signupError(code?: string, status?: number) {
  if (code === "over_email_send_rate_limit") return { status: 429, code: "EMAIL_RATE_LIMIT", message: "Confirmation emails are temporarily rate limited. Please wait before trying again." };
  if (status === 429) return { status: 429, code: "RATE_LIMIT", message: "Too many attempts. Please wait before trying again." };
  if (["user_already_exists", "email_exists"].includes(code || "")) return { status: 409, code: "EMAIL_EXISTS", message: "An account with this email already exists. Sign in instead." };
  if (code === "weak_password") return { status: 400, code: "WEAK_PASSWORD", message: "Choose a stronger password with at least 6 characters, including letters, numbers and symbols." };
  if (["email_address_invalid", "validation_failed"].includes(code || "")) return { status: 400, code: "INVALID_EMAIL", message: "Check your email address and try again." };
  if (code === "email_address_not_authorized") return { status: 503, code: "EMAIL_DELIVERY", message: "We could not deliver a confirmation email. Please try again later." };
  if (code === "email_not_confirmed") return { status: 401, code: "EMAIL_UNCONFIRMED", message: "Confirm your email before signing in." };
  if (code === "invalid_credentials") return { status: 401, code: "INVALID_CREDENTIALS", message: "That email or password didn’t match. Try again." };
  return { status: 503, code: "AUTH_UNAVAILABLE", message: "Account access is temporarily unavailable. Please try again." };
}
