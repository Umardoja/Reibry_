package com.reibry.app;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
public class AccountReliabilityTest {
    private String source(String name) throws Exception { return new String(Files.readAllBytes(Path.of("src/main/java/com/reibry/app/"+name+".java")), StandardCharsets.UTF_8); }
    @Test public void validSessionDoesNotNeedRefresh() throws Exception { assertTrue(NativeSession.fresh(new JSONObject().put("expiresAt", 5000), 1000)); }
    @Test public void expiredSessionNeedsRefresh() throws Exception { assertFalse(NativeSession.fresh(new JSONObject().put("expiresAt", 900), 1000)); }
    @Test public void refreshHasClockSkewMargin() throws Exception { assertFalse(NativeSession.fresh(new JSONObject().put("expiresAt", 1060), 1000)); }
    @Test public void absentSessionNeedsAuthentication() { assertFalse(NativeSession.fresh(null, 1000)); }
    @Test public void highVersionedChannelWithSoundAndVibration() throws Exception { String c=source("CaptureNotifications"); assertTrue(c.contains("reibry_memory_capture_v2")); assertTrue(c.contains("IMPORTANCE_HIGH")); assertTrue(c.contains("enableVibration(true)")); assertTrue(c.contains("setSound(")); assertTrue(c.contains("PRIORITY_HIGH")); assertFalse(c.contains("setFullScreenIntent")); }
    @Test public void completionHasDistinctJobId() { assertNotEquals(CaptureNotifications.id("job"), CaptureNotifications.completedId("job")); assertEquals(CaptureNotifications.completedId("job"), CaptureNotifications.completedId("job")); }
    @Test public void processingRemovedBeforeCompletionAlert() throws Exception { String c=source("CaptureNotifications"); assertTrue(c.contains("if (!progress) manager.cancel(id(job))")); assertTrue(c.contains("setOnlyAlertOnce(progress)")); }
    @Test public void refreshRotatesOnlySameUserAndPreservesSignOut() throws Exception { String c=source("NativeSession"); assertTrue(c.contains("/api/auth/native-refresh")); assertTrue(c.contains("vault.put(\"session\", updated)")); assertTrue(c.contains("current == null || !current.optString(\"userId\")")); assertTrue(c.contains("status == 401")); assertTrue(c.contains("throw new IOException(\"Session temporarily unavailable\")")); }
    @Test public void workerRefreshesBeforeAuthFailure() throws Exception { String c=source("ReibryCaptureWorker"); assertTrue(c.indexOf("NativeSession.resolve") < c.indexOf("return failure(id, true)")); assertTrue(c.contains("NativeSession.resolve(getApplicationContext(), true)")); }
    @Test public void channelSettingsUsesOwnPackageAndTrustedOrigin() throws Exception { String c=source("ReibryCapturePlugin"); assertTrue(c.contains("ACTION_CHANNEL_NOTIFICATION_SETTINGS")); assertTrue(c.contains("getContext().getPackageName()")); assertTrue(c.contains("if (!trusted(call)) return;")); }
    @Test public void secureVaultRefreshAndDebugOnlyDiagnostics() throws Exception { String c=source("ReibryCapturePlugin"); assertTrue(c.contains("put(\"refreshToken\", refresh)")); assertTrue(c.contains("if (!BuildConfig.DEBUG)")); assertTrue(c.contains("remove(\"session\")")); }
}
