package com.reibry.app;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public final class CaptureNotifications {
    public static final String CHANNEL = "reibry_memory_capture_v2";
    public static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Memory saves", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Updates when REIBRY remembers shared items.");
            channel.enableVibration(true);
            channel.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION), new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).build());
            c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    public static int id(String job) { return job.hashCode() & 0x7fffffff; }
    public static int completedId(String job) { return id(job) | 0x80000000; }
    public static Notification build(Context c, String job, String title, String body, boolean progress, String memoryId) {
        channel(c);
        Intent intent = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.setData(android.net.Uri.parse("reibry-internal://capture/" + job));
        if (CaptureContract.uuid(memoryId)) intent.putExtra("memoryId", memoryId);
        else intent.putExtra("retryId", job);
        PendingIntent click = PendingIntent.getActivity(c, id(job), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(c, CHANNEL).setSmallIcon(R.drawable.ic_capture_notification)
            .setContentTitle(title).setContentText(body).setContentIntent(click).setOngoing(progress).setAutoCancel(!progress)
            .setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setOnlyAlertOnce(progress).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setProgress(0, 0, progress).build();
    }
    public static void show(Context c, String job, String title, String body, boolean progress, String memoryId) {
        try {
            NotificationManagerCompat manager = NotificationManagerCompat.from(c);
            if (!progress) manager.cancel(id(job)); else manager.cancel(completedId(job));
            manager.notify(progress ? id(job) : completedId(job), build(c, job, title, body, progress, memoryId));
        }
        catch (SecurityException ignored) { /* User has not granted notification permission. Save still runs. */ }
    }
}
