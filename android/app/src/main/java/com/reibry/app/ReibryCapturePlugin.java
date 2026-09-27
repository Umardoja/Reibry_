package com.reibry.app;

import android.Manifest;
import android.os.Build;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.WorkManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;

@CapacitorPlugin(name = "ReibryCapture", permissions = @Permission(alias = "notifications", strings = Manifest.permission.POST_NOTIFICATIONS))
public class ReibryCapturePlugin extends Plugin {
    private boolean trusted(PluginCall call) {
        try {
            java.util.concurrent.FutureTask<Boolean> check = new java.util.concurrent.FutureTask<>(() -> CaptureContract.trusted(getBridge().getWebView().getUrl()));
            getActivity().runOnUiThread(check);
            if (check.get(2, java.util.concurrent.TimeUnit.SECONDS)) return true;
        } catch (Exception ignored) {}
        call.reject("Unavailable origin"); return false;
    }
    @PluginMethod public void beginSessionSync(PluginCall call) {
        if (!trusted(call)) return;
        String user = call.getString("userId");
        if (!CaptureContract.uuid(user)) { call.reject("Invalid session"); return; }
        try {
            String ticket = java.util.UUID.randomUUID().toString();
            synchronized (SecureVault.class) {
                SecureVault vault = new SecureVault(getContext());
                JSONObject old = vault.get("session");
                if (old != null && !user.equals(old.optString("userId"))) {
                    vault.remove("session");
                    WorkManager.getInstance(getContext()).cancelAllWorkByTag(ReibryCaptureWorker.TAG);
                }
                vault.put("auth-state", new JSONObject().put("state", "restoring").put("userId", user).put("ticket", ticket));
            }
            if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "state=restoring webUserPresent=true");
            JSObject result = new JSObject(); result.put("ticket", ticket); call.resolve(result);
        } catch (Exception ignored) { call.reject("Secure session storage unavailable"); }
    }
    @PluginMethod public void sessionUnavailable(PluginCall call) {
        if (!trusted(call)) return;
        try {
            synchronized (SecureVault.class) {
                SecureVault vault = new SecureVault(getContext()); JSONObject state = vault.get("auth-state");
                if (state != null && state.optString("ticket").equals(call.getString("ticket"))) {
                    vault.put("auth-state", state.put("state", "temporary-error"));
                    if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "state=temporary-error");
                }
            }
            call.resolve();
        } catch (Exception ignored) { call.reject("Secure session storage unavailable"); }
    }
    @PluginMethod public void sessionDiagnostics(PluginCall call) {
        if (!trusted(call)) return;
        if (!BuildConfig.DEBUG) { JSObject hidden = new JSObject(); hidden.put("available", false); call.resolve(hidden); return; }
        SecureVault vault = new SecureVault(getContext());
        JSONObject safe = SessionPolicy.diagnostics(vault.get("session"), vault.get("auth-state"), call.getString("userId"), System.currentTimeMillis()/1000);
        try { call.resolve(JSObject.fromJSONObject(safe)); } catch (Exception ignored) { call.reject("Diagnostics unavailable"); }
    }
    @PluginMethod public void setSession(PluginCall call) {
        if (!trusted(call)) return;
        try {
            String token = call.getString("accessToken"), user = call.getString("userId"), refresh = call.getString("refreshToken");
            Long expires = SessionPolicy.expiry(call.getData().opt("expiresAt"));
            if (token == null || token.length() > 8192 || !token.matches("[A-Za-z0-9._~-]+") || !CaptureContract.uuid(user) || expires == null || expires <= System.currentTimeMillis()/1000) { call.reject("Invalid session"); return; }
            if (refresh == null || refresh.isEmpty() || refresh.length() > 8192) { call.reject("Invalid session"); return; }
            synchronized (SecureVault.class) {
                SecureVault vault = new SecureVault(getContext());
                JSONObject state = vault.get("auth-state");
                if (state == null || !state.optString("ticket").equals(call.getString("ticket")) || !user.equals(state.optString("userId"))) { call.reject("Session changed"); return; }
                JSONObject current = vault.get("session");
                if (current == null || !user.equals(current.optString("userId")) || expires >= current.optLong("expiresAt"))
                    vault.put("session", new JSONObject().put("accessToken", token).put("refreshToken", refresh).put("userId", user).put("expiresAt", expires));
                SecureVault confirmed = new SecureVault(getContext());
                JSONObject stored = confirmed.get("session");
                if (stored == null || !user.equals(stored.optString("userId"))) { call.reject("Secure session storage unavailable"); return; }
                confirmed.put("auth-state", state.put("state", "authenticated"));
            }
            if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "session present=true expiry=" + expires);
            call.resolve();
        } catch (Exception ignored) { call.reject("Secure session storage unavailable"); }
    }
    @PluginMethod public void clearSession(PluginCall call) {
        if (!trusted(call)) return;
        synchronized (SecureVault.class) {
            SecureVault vault = new SecureVault(getContext());
            vault.remove("session");
            try { vault.put("auth-state", new JSONObject().put("state", "unauthenticated").put("ticket", java.util.UUID.randomUUID().toString())); }
            catch (Exception ignored) { vault.remove("auth-state"); call.reject("Secure session storage unavailable"); return; }
        }
        WorkManager.getInstance(getContext()).cancelAllWorkByTag(ReibryCaptureWorker.TAG);
        NotificationManagerCompat.from(getContext()).cancelAll();
        call.resolve();
    }
    @PluginMethod public void getSession(PluginCall call) {
        if (!trusted(call)) return;
        try {
            JSONObject session = NativeSession.resolve(getContext(), false);
            JSObject result = new JSObject(); result.put("session", session == null ? JSONObject.NULL : session); call.resolve(result);
        } catch (java.io.IOException unavailable) { call.reject("Session temporarily unavailable"); }
    }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        if (!trusted(call)) return;
        CaptureNotifications.channel(getContext());
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        Intent settings = new Intent(Build.VERSION.SDK_INT >= 26 ? enabled ? android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS : android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS : android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        if (Build.VERSION.SDK_INT >= 26) { settings.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()); settings.putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, CaptureNotifications.CHANNEL); }
        else settings.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(settings); call.resolve();
    }
    @PluginMethod public void notificationDiagnostics(PluginCall call) {
        if (!trusted(call)) return;
        if (!BuildConfig.DEBUG) { call.reject("Development only"); return; }
        JSObject data = new JSObject();
        data.put("enabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled()); data.put("channelId", CaptureNotifications.CHANNEL);
        android.app.NotificationChannel channel = Build.VERSION.SDK_INT >= 26 ? getContext().getSystemService(android.app.NotificationManager.class).getNotificationChannel(CaptureNotifications.CHANNEL) : null;
        data.put("channelExists", channel != null);
        data.put("permissionGranted", Build.VERSION.SDK_INT < 33 || androidx.core.content.ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED);
        if (Build.VERSION.SDK_INT >= 26 && channel != null) {
            data.put("importance", channel.getImportance()); data.put("sound", channel.getSound() != null); data.put("vibration", channel.shouldVibrate());
        } else { data.put("importance", 0); data.put("sound", false); data.put("vibration", false); }
        call.resolve(data);
    }
    private void permissionResult(PluginCall call) {
        android.app.NotificationChannel channel = Build.VERSION.SDK_INT >= 26 ? getContext().getSystemService(android.app.NotificationManager.class).getNotificationChannel(CaptureNotifications.CHANNEL) : null;
        if (Build.VERSION.SDK_INT >= 26 && channel != null && channel.getImportance() == android.app.NotificationManager.IMPORTANCE_NONE) { JSObject blocked = new JSObject(); blocked.put("permission", "denied"); call.resolve(blocked); return; }
        String state = NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" :
            Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.DENIED ? "default" : "denied";
        JSObject result = new JSObject(); result.put("permission", state); call.resolve(result);
    }
    @PluginMethod public void notificationPermission(PluginCall call) { if (trusted(call)) permissionResult(call); }
    @PluginMethod public void requestNotifications(PluginCall call) {
        if (!trusted(call)) return;
        CaptureNotifications.channel(getContext());
        if (Build.VERSION.SDK_INT >= 33) requestPermissionForAlias("notifications", call, "notificationResult");
        else permissionResult(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) { permissionResult(call); }
    @PluginMethod public void takeLaunch(PluginCall call) {
        if (!trusted(call)) return;
        try {
            Intent intent = getActivity().getIntent();
            JSObject result = new JSObject();
            String memory = intent.getStringExtra("memoryId"), pending = intent.getStringExtra("retryId");
            if (CaptureContract.uuid(memory)) {
                result.put("path", CaptureContract.memoryPath(memory)); intent.removeExtra("memoryId");
            } else if (CaptureContract.uuid(pending)) {
                SecureVault vault = new SecureVault(getContext());
                JSONObject job = vault.get(pending), session = vault.session();
                if (job != null && session != null && (job.optString("owner").isEmpty() || job.optString("owner").equals(session.optString("userId")))) {
                    JSONObject body = job.getJSONObject("payload");
                    JSObject payload = new JSObject(); payload.put("text", body.optString("rawText")); payload.put("url", body.optString("sourceUrl")); payload.put("title", body.optString("title"));
                    result.put("pendingId", pending); result.put("payload", payload);
                    intent.removeExtra("retryId");
                }
            }
            call.resolve(result);
        } catch (Exception ignored) { call.reject("Capture could not be opened"); }
    }
    @PluginMethod public void updateNotification(PluginCall call) {
        if (!trusted(call)) return;
        String id = call.getString("pendingId"), state = call.getString("state"), memory = call.getString("memoryId");
        if (!CaptureContract.uuid(id)) { call.reject("Invalid capture"); return; }
        SecureVault vault = new SecureVault(getContext());
        JSONObject job = vault.get(id), session = vault.session();
        if (job == null || session == null || (!job.optString("owner").isEmpty() && !job.optString("owner").equals(session.optString("userId")))) { call.reject("Unavailable capture"); return; }
        if ("complete".equals(state) && CaptureContract.uuid(memory)) {
            CaptureNotifications.show(getContext(), id, "Remembered", CaptureContract.boundedTitle(call.getString("title", "Saved memory")), false, memory); vault.remove(id);
        } else if ("processing".equals(state)) CaptureNotifications.show(getContext(), id, "Remembering…", "Saving shared item", true, null);
        else if ("error".equals(state)) CaptureNotifications.show(getContext(), id, "Couldn't remember this", "Tap to retry.", false, null);
        call.resolve();
    }
}
