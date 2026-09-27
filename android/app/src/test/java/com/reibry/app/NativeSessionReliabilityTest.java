package com.reibry.app;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import java.io.IOException;
import java.util.HashMap;

public class NativeSessionReliabilityTest {
    static class Vault implements NativeSession.Store {
        final HashMap<String, JSONObject> values = new HashMap<>();
        public JSONObject get(String key) { return values.get(key); }
        public void put(String key, JSONObject value) { values.put(key, value); }
        public void remove(String key) { values.remove(key); }
    }
    private JSONObject session(long expiry) throws Exception { return new JSONObject().put("userId", "owner").put("accessToken", "test-access").put("refreshToken", "test-refresh").put("expiresAt", expiry); }
    @Test public void reproducesCapacitorIntegerExpiryRejection() throws Exception {
        JSObject json = new JSObject("{\"expiresAt\":1800000000}");
        assertTrue(json.opt("expiresAt") instanceof Integer);
        PluginCall call = new PluginCall(null, "plugin", "callback", "setSession", json);
        assertNull(call.getLong("expiresAt"));
        assertEquals(Long.valueOf(1800000000L), SessionPolicy.expiry(json.opt("expiresAt")));
    }
    @Test public void expirySupportsLongAndWholeDoubleOnly() {
        assertEquals(Long.valueOf(2200000000L), SessionPolicy.expiry(2200000000L));
        assertEquals(Long.valueOf(1800000000L), SessionPolicy.expiry(1800000000d));
        for (Object invalid : new Object[]{"1800000000", 1.5, Double.NaN, Double.POSITIVE_INFINITY, -1}) assertNull(SessionPolicy.expiry(invalid));
    }
    @Test public void validSessionCapturesWithoutRefresh() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(5000));
        JSONObject result = NativeSession.resolve(vault, old -> { throw new AssertionError("Unexpected refresh"); }, false, 1000);
        assertEquals("capture", SessionPolicy.workerDecision(result, null, "owner"));
    }
    @Test public void expiredSessionRotatesWholeRecordAndCaptures() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(900));
        JSONObject rotated = session(5000).put("accessToken", "rotated-access").put("refreshToken", "rotated-refresh");
        JSONObject result = NativeSession.resolve(vault, old -> new NativeSession.RefreshResponse(200, rotated), false, 1000);
        assertSame(rotated, vault.get("session")); assertSame(rotated, result);
        assertEquals("capture", SessionPolicy.workerDecision(result, null, "owner"));
    }
    @Test public void temporaryFiveHundredRetainsSession() throws Exception {
        Vault vault = new Vault(); JSONObject old = session(900); vault.put("session", old);
        assertThrows(IOException.class, () -> NativeSession.resolve(vault, s -> new NativeSession.RefreshResponse(503, null), false, 1000));
        assertSame(old, vault.get("session")); assertNull(vault.get("auth-state"));
    }
    @Test public void timeoutRetainsSession() throws Exception {
        Vault vault = new Vault(); JSONObject old = session(900); vault.put("session", old);
        assertThrows(IOException.class, () -> NativeSession.resolve(vault, s -> { throw new java.net.SocketTimeoutException(); }, false, 1000));
        assertSame(old, vault.get("session"));
    }
    @Test public void revokedRefreshClearsSessionAndRequiresAuth() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(900));
        assertNull(NativeSession.resolve(vault, s -> new NativeSession.RefreshResponse(401, null), false, 1000));
        assertNull(vault.get("session")); assertEquals("auth", SessionPolicy.workerDecision(null, vault.get("auth-state"), "owner"));
    }
    @Test public void rejectedOldNativeSessionDoesNotCancelActiveWebRestoration() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(900));
        JSONObject handoff = new JSONObject().put("state", "restoring").put("userId", "owner").put("ticket", "handoff");
        vault.put("auth-state", handoff);
        assertNull(NativeSession.resolve(vault, s -> new NativeSession.RefreshResponse(401, null), false, 1000));
        assertSame(handoff, vault.get("auth-state"));
        assertEquals("retry", SessionPolicy.workerDecision(null, handoff, "owner"));
    }
    @Test public void refreshCannotRestoreAfterSignOut() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(900)); JSONObject rotated = session(5000);
        assertNull(NativeSession.resolve(vault, s -> { vault.remove("session"); return new NativeSession.RefreshResponse(200, rotated); }, false, 1000));
        assertNull(vault.get("session"));
    }
    @Test public void refreshCannotOverwriteDifferentAccount() throws Exception {
        Vault vault = new Vault(); vault.put("session", session(900)); JSONObject other = session(5000).put("userId", "other");
        JSONObject rotated = session(5000);
        assertNull(NativeSession.resolve(vault, s -> { vault.put("session", other); return new NativeSession.RefreshResponse(200, rotated); }, false, 1000));
        assertSame(other, vault.get("session"));
    }
    @Test public void wrongUserRefreshResponseIsRejected() throws Exception {
        Vault vault = new Vault(); JSONObject old = session(900); vault.put("session", old); JSONObject other = session(5000).put("userId", "other");
        assertThrows(IOException.class, () -> NativeSession.resolve(vault, s -> new NativeSession.RefreshResponse(200, other), false, 1000));
        assertSame(old, vault.get("session"));
    }
    @Test public void missingVaultDuringRestoreRetriesWithoutAuthNotification() throws Exception {
        assertEquals("retry", SessionPolicy.workerDecision(null, null, ""));
        for (String state : new String[]{"restoring", "temporary-error"}) assertEquals("retry", SessionPolicy.workerDecision(null, new JSONObject().put("state", state), "owner"));
    }
    @Test public void restoredOwnerCanCaptureButAnotherOwnerCannot() throws Exception {
        assertEquals("capture", SessionPolicy.workerDecision(session(5000), null, "owner"));
        assertEquals("auth", SessionPolicy.workerDecision(session(5000), null, "other"));
        assertEquals("retry", SessionPolicy.workerDecision(session(5000), null, ""));
    }
    @Test public void diagnosticsExposePresenceNotCredentials() throws Exception {
        JSONObject result = SessionPolicy.diagnostics(session(5000), new JSONObject().put("state", "authenticated"), "owner", 1000);
        assertTrue(result.getBoolean("nativeAuthReady")); assertTrue(result.getBoolean("refreshTokenPresent"));
        assertFalse(result.toString().contains("test-access")); assertFalse(result.toString().contains("test-refresh"));
        assertFalse(result.has("accessToken")); assertFalse(result.has("refreshToken")); assertFalse(result.has("userId"));
    }
}
