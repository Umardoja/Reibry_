package com.reibry.app;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import org.json.JSONObject;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** AES-GCM files in no-backup storage; key never leaves Android Keystore. */
public final class SecureVault {
    private static final String ALIAS = "reibry.capture.v1";
    private final File directory;
    public SecureVault(Context context) { directory = new File(context.getNoBackupFilesDir(), "capture"); directory.mkdirs(); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    private File file(String name) {
        if (!"session".equals(name) && !"auth-state".equals(name) && !CaptureContract.uuid(name)) throw new IllegalArgumentException("Invalid storage identifier");
        return new File(directory, name);
    }
    public void put(String name, JSONObject value) throws Exception {
        synchronized (SecureVault.class) {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
            android.util.AtomicFile target = new android.util.AtomicFile(file(name));
            FileOutputStream output = target.startWrite();
            try { output.write(cipher.getIV()); output.write(encrypted); target.finishWrite(output); }
            catch (Exception e) { target.failWrite(output); throw e; }
        }
    }
    public JSONObject get(String name) {
        synchronized (SecureVault.class) {
            try {
                File target = file(name); if (!target.exists() || target.length() > 150000) return null;
                byte[] bytes = new android.util.AtomicFile(target).readFully();
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, bytes, 0, 12));
                return new JSONObject(new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8));
            } catch (Exception ignored) { return null; }
        }
    }
    public void remove(String name) { synchronized (SecureVault.class) { new android.util.AtomicFile(file(name)).delete(); } }
    public JSONObject session() {
        JSONObject value = get("session");
        return value != null && value.optLong("expiresAt") > System.currentTimeMillis() / 1000 + 30 ? value : null;
    }
}
