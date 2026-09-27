package com.reibry.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import org.json.JSONObject;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

public final class ReibryCaptureWorker extends Worker {
    public static final String TAG = "reibry-capture";
    private volatile HttpsURLConnection connection;
    public ReibryCaptureWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    public static void enqueue(Context context, String id) {
        OneTimeWorkRequest.Builder builder = new OneTimeWorkRequest.Builder(ReibryCaptureWorker.class)
            .setInputData(new Data.Builder().putString("jobId", id).build()).addTag(TAG)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS);
        // Older Android uses ordinary work so foreground-service teardown cannot remove the result notification.
        if (android.os.Build.VERSION.SDK_INT >= 31) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
        OneTimeWorkRequest work = builder.build();
        WorkManager.getInstance(context).enqueueUniqueWork(TAG + "-" + id, ExistingWorkPolicy.KEEP, work);
    }
    @NonNull @Override public ForegroundInfo getForegroundInfo() {
        String id = getInputData().getString("jobId");
        return new ForegroundInfo(CaptureNotifications.id(id == null ? "capture" : id), CaptureNotifications.build(getApplicationContext(), id, "Remembering…", "Saving shared item", true, null));
    }
    private Result failure(String id, boolean auth) {
        CaptureNotifications.show(getApplicationContext(), id, auth ? "Open REIBRY to continue" : "Couldn't remember this", auth ? "Sign in to finish saving this item." : "Tap to retry.", false, null);
        return Result.failure();
    }
    @NonNull @Override public Result doWork() {
        String id = getInputData().getString("jobId");
        if (!CaptureContract.uuid(id)) return Result.failure();
        SecureVault vault = new SecureVault(getApplicationContext());
        JSONObject job = vault.get(id), session;
        if (job == null) return failure(id, false);
        try { session = NativeSession.resolve(getApplicationContext(), false); }
        catch (IOException unavailable) { return retry(id); }
        if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "worker sessionPresent=" + (session != null));
        String decision = SessionPolicy.workerDecision(session, vault.get("auth-state"), job.optString("owner"));
        if ("retry".equals(decision)) return retry(id);
        if (!"capture".equals(decision)) return failure(id, true);
        try {
            CaptureNotifications.show(getApplicationContext(), id, "Remembering…", CaptureContract.sourceLabel(job.getJSONObject("payload")), true, null);
            connection = (HttpsURLConnection) new URL(CaptureContract.ORIGIN + "/api/capture").openConnection();
            connection.setInstanceFollowRedirects(false); connection.setRequestMethod("POST"); connection.setConnectTimeout(15000); connection.setReadTimeout(180000);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + session.getString("accessToken"));
            connection.setDoOutput(true);
            if (isStopped() || !SessionPolicy.sameUser(session, vault.session())) return Result.failure();
            try (OutputStream output = connection.getOutputStream()) { output.write(job.getJSONObject("payload").toString().getBytes(StandardCharsets.UTF_8)); }
            int status = connection.getResponseCode();
            if (BuildConfig.DEBUG) android.util.Log.d("ReibryAuth", "worker HTTP status=" + status);
            if (status == 401 || status == 403) {
                JSONObject restored = NativeSession.resolve(getApplicationContext(), true);
                if (restored != null) return retry(id);
                return failure(id, true);
            }
            if (status == 429 || status >= 500) return retry(id);
            if (status != 200) return failure(id, false);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) { if (bytes.size() + count > 1024 * 1024) return failure(id, false); bytes.write(buffer, 0, count); }
            }
            JSONObject memory = CaptureContract.remembered(new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())));
            if (memory == null) return failure(id, false);
            CaptureNotifications.show(getApplicationContext(), id, "Remembered", CaptureContract.boundedTitle(memory.optString("title", "Saved memory")), false, memory.getString("id"));
            vault.remove(id);
            return Result.success();
        } catch (IOException error) { return retry(id); }
        catch (Exception error) { return failure(id, false); }
        finally { if (connection != null) connection.disconnect(); }
    }
    private Result retry(String id) {
        if (isStopped()) return Result.failure();
        if (getRunAttemptCount() >= 2) return failure(id, false);
        CaptureNotifications.show(getApplicationContext(), id, "Waiting to remember…", "We'll retry when a connection is available.", true, null);
        return Result.retry();
    }
    @Override public void onStopped() { if (connection != null) connection.disconnect(); }
}
