package com.reibry.app;

import android.content.Context;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Single rotating user session, never service credentials. Network failures retain it. */
public final class NativeSession {
    private static final Object REFRESH_LOCK = new Object();
    public static boolean fresh(JSONObject session, long now) {
        return session != null && session.optLong("expiresAt") > now + 60;
    }
    interface Store {
        JSONObject get(String key);
        void put(String key, JSONObject value) throws Exception;
        void remove(String key);
    }
    interface Exchange { RefreshResponse refresh(JSONObject old) throws IOException; }
    static final class RefreshResponse {
        final int status; final JSONObject session;
        RefreshResponse(int status, JSONObject session) { this.status = status; this.session = session; }
    }
    public static JSONObject resolve(Context context, boolean force) throws IOException {
        SecureVault vault = new SecureVault(context);
        return resolve(new Store() {
            public JSONObject get(String key) { return vault.get(key); }
            public void put(String key, JSONObject value) throws Exception { vault.put(key, value); }
            public void remove(String key) { vault.remove(key); }
        }, NativeSession::requestRefresh, force, System.currentTimeMillis()/1000);
    }
    static JSONObject resolve(Store vault, Exchange exchange, boolean force, long now) throws IOException {
        synchronized (REFRESH_LOCK) {
            JSONObject old = vault.get("session");
            if (old == null) return null;
            if (!force && fresh(old, now)) return old;
            if (old.optString("refreshToken").isEmpty()) {
                synchronized (SecureVault.class) {
                    if (same(old, vault.get("session"))) {
                        vault.remove("session");
                        try { markUnauthenticated(vault, old); }
                        catch (Exception ignored) { throw new IOException("Secure storage unavailable"); }
                    }
                }
                return null;
            }
            RefreshResponse response = exchange.refresh(old);
            synchronized (SecureVault.class) {
                JSONObject current = vault.get("session");
                // Sign-out/account switching wins over an in-flight refresh.
                if (current == null || !current.optString("userId").equals(old.optString("userId"))) return null;
                if (!same(old, current)) return current;
                try {
                    int status = response.status;
                    if (status == 401) {
                        vault.remove("session");
                        markUnauthenticated(vault, old);
                        return null;
                    }
                    if (status != 200) throw new IOException("Session temporarily unavailable");
                    JSONObject updated = response.session;
                    if (!SessionPolicy.sameUser(old, updated) || updated.optString("accessToken").isEmpty() || updated.optString("refreshToken").isEmpty() || !fresh(updated, now)) throw new IOException("Invalid session response");
                    vault.put("session", updated);
                    return updated;
                } catch (IOException error) { throw error; }
                catch (Exception ignored) { throw new IOException("Secure storage unavailable"); }
            }
        }
    }
    private static void markUnauthenticated(Store vault, JSONObject old) throws Exception {
        JSONObject state = vault.get("auth-state");
        // A cookie-authenticated handoff can repair rejected old native credentials.
        if (state != null && "restoring".equals(state.optString("state")) && old.optString("userId").equals(state.optString("userId"))) return;
        vault.put("auth-state", new JSONObject().put("state", "unauthenticated"));
    }
    private static RefreshResponse requestRefresh(JSONObject old) throws IOException {
            HttpsURLConnection connection = null;
            try {
                connection = (HttpsURLConnection) new URL(CaptureContract.ORIGIN + "/api/auth/native-refresh").openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
                connection.setRequestMethod("POST"); connection.setRequestProperty("Content-Type", "application/json"); connection.setDoOutput(true);
                JSONObject body = new JSONObject().put("refreshToken", old.getString("refreshToken")).put("userId", old.getString("userId"));
                try (OutputStream out = connection.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                int status = connection.getResponseCode();
                if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "refresh HTTP status=" + status);
                if (status == 401) return new RefreshResponse(status, null);
                if (status != 200) throw new IOException("Session temporarily unavailable");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream in = connection.getInputStream()) {
                    byte[] buffer = new byte[4096]; int n;
                    while ((n = in.read(buffer)) != -1) { if (bytes.size()+n > 30000) throw new IOException("Invalid session response"); bytes.write(buffer,0,n); }
                }
                return new RefreshResponse(status, new JSONObject(bytes.toString("UTF-8")).getJSONObject("data"));
            } catch (IOException error) { throw error; }
            catch (Exception ignored) { throw new IOException("Session temporarily unavailable"); }
            finally { if (connection != null) connection.disconnect(); }
    }
    private static boolean same(JSONObject a, JSONObject b) { return b != null && a.optString("refreshToken").equals(b.optString("refreshToken")) && a.optString("accessToken").equals(b.optString("accessToken")); }
}
