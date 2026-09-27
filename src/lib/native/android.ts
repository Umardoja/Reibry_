import { Capacitor, registerPlugin } from "@capacitor/core";
import { SessionCoordinator } from "./session-coordinator.ts";
import type { SharedPayload } from "../share/payload";
export interface NativeSession { accessToken: string; refreshToken: string; userId: string; expiresAt: number }

interface AndroidCapture {
  beginSessionSync(input: { userId: string }): Promise<{ ticket: string }>;
  sessionUnavailable(input: { ticket: string }): Promise<void>;
  sessionDiagnostics(input: { userId: string | null }): Promise<{ available: boolean; nativeSessionPresent: boolean; accessTokenPresent: boolean; refreshTokenPresent: boolean; accessTokenExpired: boolean; storedUserMatchesWebUser: boolean; nativeAuthReady: boolean; state: string }>;
  setSession(input: NativeSession & { ticket: string }): Promise<void>;
  getSession(): Promise<{ session: NativeSession | null }>;
  clearSession(): Promise<void>;
  notificationPermission(): Promise<{ permission: NotificationPermission }>;
  requestNotifications(): Promise<{ permission: NotificationPermission }>;
  openNotificationSettings(): Promise<void>;
  notificationDiagnostics(): Promise<{ enabled: boolean; importance: number; channelId: string; sound: boolean; vibration: boolean; channelExists: boolean }>;
  takeLaunch(): Promise<{ path?: string; pendingId?: string; payload?: SharedPayload }>;
  updateNotification(input: { pendingId: string; state: "processing" | "complete" | "error"; memoryId?: string; title?: string }): Promise<void>;
}
export const Android = registerPlugin<AndroidCapture>("ReibryCapture");
export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const coordinator = new SessionCoordinator({
  async read() {
    const { createClient } = await import("../supabase/client");
    const { data, error } = await createClient().auth.getSession();
    if (error) throw new Error("Browser session unavailable");
    const session = data.session;
    return session ? { accessToken: session.access_token, refreshToken: session.refresh_token, userId: session.user.id, expiresAt: session.expires_at || 0 } : null;
  },
  async begin(userId) { return (await Android.beginSessionSync({ userId })).ticket; },
  async exchange(web) {
    // Only restore a background rotation for the SAME authenticated browser user.
    // A failed native refresh must not prevent a valid browser session repairing the vault.
    const { session: native } = await Android.getSession().catch(() => ({ session: null }));
    if (native && native.userId === web.userId && native.expiresAt > web.expiresAt) {
      const { createClient } = await import("../supabase/client");
      const { error } = await createClient().auth.setSession({ access_token: native.accessToken, refresh_token: native.refreshToken });
      if (error) throw new Error("Browser session unavailable");
    }
    const response = await fetch("/api/auth/native-session", { method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "x-reibry-native": "android" } });
    if (!response.ok) throw new Error("Session exchange unavailable");
    const { data } = await response.json();
    if (typeof data?.accessToken !== "string" || typeof data?.refreshToken !== "string" || data?.userId !== web.userId || !Number.isSafeInteger(data?.expiresAt)) throw new Error("Invalid session exchange");
    return data;
  },
  write: (session, ticket) => Android.setSession({ ...session, ticket }),
  clear: () => Android.clearSession(),
  unavailable: (ticket) => Android.sessionUnavailable({ ticket }),
});
export const nativeAuthState = () => coordinator.state;
export const nativeAuthUser = () => coordinator.userId;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryCount = 0;
export async function clearNativeSession() {
  clearTimeout(retryTimer); retryTimer = undefined; retryCount = 0;
  if (isNativeAndroid()) await coordinator.clear();
}
/** Resolves after acknowledged storage or a separately exposed temporary-error state. */
export function syncNativeSession(force = false): Promise<void> {
  if (!isNativeAndroid()) return Promise.resolve();
  if (force) { clearTimeout(retryTimer); retryTimer = undefined; retryCount = 0; }
  return coordinator.sync(force).then(() => {
    if (coordinator.state === "temporary-error" && !retryTimer && retryCount < 4) {
      retryTimer = setTimeout(() => { retryTimer = undefined; void syncNativeSession(); }, [2000, 5000, 15000, 30000][retryCount++]);
    } else if (coordinator.state === "authenticated") { clearTimeout(retryTimer); retryTimer = undefined; retryCount = 0; }
  });
}
