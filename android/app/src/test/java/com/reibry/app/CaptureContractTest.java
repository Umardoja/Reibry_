package com.reibry.app;

import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
import java.nio.file.*;

public class CaptureContractTest {
    private static final String ID = "11111111-1111-4111-8111-111111111111";
    private JSONObject share(String text) throws Exception { return CaptureContract.share("android.intent.action.SEND", "text/plain", text, null); }
    private String source(String name) throws Exception { return new String(Files.readAllBytes(Path.of("src/main/java/com/reibry/app/" + name + ".java")), java.nio.charset.StandardCharsets.UTF_8); }
    private JSONObject response(String status, boolean duplicate) throws Exception { return new JSONObject().put("data", new JSONObject().put("duplicate", duplicate).put("memory", new JSONObject().put("id", ID).put("title", "Saved source").put("analysisStatus", status))); }
    @Test public void acceptsTextPlainSend() throws Exception { assertNotNull(share("A note")); }
    @Test public void rejectsOtherIntentsAndMime() throws Exception {
        assertNull(CaptureContract.share("android.intent.action.VIEW", "text/plain", "text", null));
        assertNull(CaptureContract.share("android.intent.action.SEND", "image/png", "text", null));
    }
    @Test public void extractsUrlFromCaption() throws Exception { JSONObject body = share("Useful tutorial https://vt.tiktok.com/abc/"); assertEquals("https://vt.tiktok.com/abc/", body.getString("sourceUrl")); assertTrue(body.getString("rawText").startsWith("Useful")); }
    @Test public void rejectsEmptyShare() throws Exception { assertNull(share("  ")); }
    @Test public void boundsPayload() throws Exception { assertNull(share("x".repeat(20001))); assertNotNull(share("x".repeat(20000))); }
    @Test public void acceptsSubjectOnly() throws Exception { assertEquals("A thought", CaptureContract.share("android.intent.action.SEND", "text/plain", null, "A thought").getString("rawText")); }
    @Test public void rejectsCredentialsInUrl() throws Exception { assertNull(share("https://user:secret@example.com/")); }
    @Test public void platformLabelsAreSafe() throws Exception { assertEquals("Saving from TikTok", CaptureContract.sourceLabel(share("https://vt.tiktok.com/a/"))); assertEquals("Saving from YouTube", CaptureContract.sourceLabel(share("https://youtu.be/a"))); assertEquals("Saving shared link", CaptureContract.sourceLabel(share("https://tiktok.com.evil.test/a"))); }
    @Test public void completeIsRemembered() throws Exception { assertNotNull(CaptureContract.remembered(response("complete", false))); }
    @Test public void partialIsRemembered() throws Exception { assertNotNull(CaptureContract.remembered(response("partial", false))); }
    @Test public void duplicateIsRemembered() throws Exception { assertNotNull(CaptureContract.remembered(response("partial", true))); }
    @Test public void failureIsNotRemembered() throws Exception { assertNull(CaptureContract.remembered(response("failed", false))); assertNull(CaptureContract.remembered(new JSONObject())); }
    @Test public void exactMemoryPathOnly() { assertEquals("/memories/" + ID, CaptureContract.memoryPath(ID)); assertNull(CaptureContract.memoryPath("../auth")); assertNull(CaptureContract.memoryPath(ID + "?next=https://evil.test")); }
    @Test public void trustedHttpsOriginOnly() { assertTrue(CaptureContract.trusted("https://reibry.vercel.app/today")); assertFalse(CaptureContract.trusted("http://reibry.vercel.app")); assertFalse(CaptureContract.trusted("https://reibry.vercel.app.evil.test")); assertFalse(CaptureContract.trusted("https://user@reibry.vercel.app")); }
    @Test public void receiverFinishesWithoutMainActivity() throws Exception { String code = source("ShareReceiverActivity"); assertTrue(code.contains("finish()")); assertFalse(code.contains("MainActivity")); assertFalse(code.contains("startActivity")); assertTrue(code.contains("if (saved == null)")); }
    @Test public void workerUsesUniqueConnectedExpeditedWork() throws Exception { String code = source("ReibryCaptureWorker"); assertTrue(code.contains("ExistingWorkPolicy.KEEP")); assertTrue(code.contains("NetworkType.CONNECTED")); assertTrue(code.contains("RUN_AS_NON_EXPEDITED_WORK_REQUEST")); assertTrue(code.contains("getRunAttemptCount() >= 2")); }
    @Test public void requestUsesBearerAndDoesNotFollowRedirects() throws Exception { String code = source("ReibryCaptureWorker"); assertTrue(code.contains("setInstanceFollowRedirects(false)")); assertTrue(code.contains("\"Authorization\", \"Bearer \"")); assertFalse(code.contains("SERVICE_ROLE")); assertFalse(code.contains("GEMINI")); }
    @Test public void notificationsReplaceAndUseSafeClick() throws Exception { String code = source("CaptureNotifications"); assertTrue(code.contains("reibry_memory_capture")); assertTrue(code.contains("IMPORTANCE_HIGH")); assertTrue(code.contains("manager.notify(progress ? id(job) : completedId(job)")); assertTrue(code.contains("FLAG_IMMUTABLE")); assertTrue(code.contains("CaptureContract.uuid(memoryId)")); }
    @Test public void signOutClearsEncryptedCredentialsAndWork() throws Exception { String plugin = source("ReibryCapturePlugin"); assertTrue(plugin.contains("remove(\"session\")")); assertTrue(plugin.contains("cancelAllWorkByTag")); String vault = source("SecureVault"); assertTrue(vault.contains("AndroidKeyStore")); assertTrue(vault.contains("AES/GCM/NoPadding")); assertTrue(vault.contains("getNoBackupFilesDir")); assertFalse(vault.contains("SharedPreferences")); }
    @Test public void boundedNotificationTitle() { assertEquals(100, CaptureContract.boundedTitle("x".repeat(300)).length()); assertEquals("A B", CaptureContract.boundedTitle(" A\n B ")); }
}
