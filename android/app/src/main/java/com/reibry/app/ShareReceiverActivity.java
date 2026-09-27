package com.reibry.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import java.util.UUID;
import org.json.JSONObject;

public final class ShareReceiverActivity extends Activity {
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (saved == null) accept(getIntent());
        finish(); overridePendingTransition(0, 0);
    }
    @Override public void onNewIntent(Intent intent) { super.onNewIntent(intent); accept(intent); finish(); }
    private void accept(Intent intent) {
        if (intent == null) return;
        String id = null;
        try {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            JSONObject payload = CaptureContract.share(intent.getAction(), intent.getType(), text == null ? null : text.toString(), subject);
            if (payload == null) return;
            id = UUID.randomUUID().toString();
            SecureVault vault = new SecureVault(this);
            JSONObject session = vault.get("session");
            JSONObject state = vault.get("auth-state");
            String owner = session != null ? session.optString("userId") : state == null ? "" : state.optString("userId");
            JSONObject job = new JSONObject().put("payload", payload).put("owner", owner);
            vault.put(id, job);
            CaptureNotifications.show(this, id, "Remembering…", CaptureContract.sourceLabel(payload), true, null);
            ReibryCaptureWorker.enqueue(this, id);
        } catch (Exception ignored) {
            if (id != null) CaptureNotifications.show(this, id, "Couldn't remember this", "Please share this item again.", false, null);
        }
    }
}
