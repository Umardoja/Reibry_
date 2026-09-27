package com.reibry.app;

import org.json.JSONObject;
import java.net.URI;
import java.util.regex.*;

/** Pure transport policy. Enrichment, analysis and deduplication stay on the server. */
public final class CaptureContract {
    public static final String ORIGIN = "https://reibry.vercel.app";
    public static final int MAX_TEXT = 20000;
    private static final Pattern URL = Pattern.compile("https?://[^\\s<>]+", Pattern.CASE_INSENSITIVE);
    public static boolean uuid(String value) { return value != null && value.matches("(?i)[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}"); }
    public static String memoryPath(String id) { return uuid(id) ? "/memories/" + id : null; }
    public static boolean trusted(String url) {
        try { URI u = URI.create(url); return "https".equals(u.getScheme()) && "reibry.vercel.app".equals(u.getHost()) && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443); }
        catch (Exception e) { return false; }
    }
    public static JSONObject share(String action, String mime, String text, String subject) throws Exception {
        if (!"android.intent.action.SEND".equals(action) || !"text/plain".equals(mime)) return null;
        text = text == null ? "" : text.trim(); subject = subject == null ? "" : subject.trim();
        if (text.length() > MAX_TEXT || subject.length() > 300 || (text.isEmpty() && subject.isEmpty())) return null;
        String url = null;
        Matcher match = URL.matcher(text.isEmpty() ? subject : text);
        if (match.find()) {
            String candidate = match.group().replaceAll("[.,;!?)\\]]+$", "");
            URI u = URI.create(candidate);
            if (u.getHost() == null || u.getUserInfo() != null || candidate.length() > 4096) return null;
            url = candidate;
        }
        JSONObject payload = new JSONObject();
        payload.put("sourceType", url == null ? "text" : "link");
        if (url != null) payload.put("sourceUrl", url);
        if (!text.isEmpty()) payload.put("rawText", text);
        else if (url == null) payload.put("rawText", subject);
        if (!subject.isEmpty()) payload.put("title", subject);
        return payload;
    }
    public static String sourceLabel(JSONObject payload) {
        try {
            String host = URI.create(payload.optString("sourceUrl")).getHost();
            if (host != null && (host.equals("tiktok.com") || host.endsWith(".tiktok.com"))) return "Saving from TikTok";
            if (host != null && (host.equals("youtu.be") || host.equals("youtube.com") || host.endsWith(".youtube.com"))) return "Saving from YouTube";
        } catch (Exception ignored) {}
        return payload.has("sourceUrl") ? "Saving shared link" : "Saving shared text";
    }
    public static JSONObject remembered(JSONObject body) {
        JSONObject data = body.optJSONObject("data");
        JSONObject memory = data == null ? null : data.optJSONObject("memory");
        if (memory == null || !uuid(memory.optString("id"))) return null;
        String status = memory.optString("analysisStatus");
        return ("complete".equals(status) || "partial".equals(status) || data.optBoolean("duplicate")) ? memory : null;
    }
    public static String boundedTitle(String title) { String clean = title.replaceAll("\\s+", " ").trim(); return clean.substring(0, Math.min(100, clean.length())); }
}
