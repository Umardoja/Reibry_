package com.reibry.app;

import org.json.JSONObject;

/** Pure bridge/worker policy, shared by real code and JVM regression tests. */
public final class SessionPolicy {
    private SessionPolicy() {}
    public static Long expiry(Object value) {
        if (!(value instanceof Number)) return null;
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number <= 0 || number > 9007199254740991d || number != Math.floor(number)) return null;
        return ((Number) value).longValue();
    }
    public static boolean sameUser(JSONObject a, JSONObject b) {
        return a != null && b != null && !a.optString("userId").isEmpty() && a.optString("userId").equals(b.optString("userId"));
    }
    public static String workerDecision(JSONObject session, JSONObject state, String owner) {
        if (session != null) return owner.isEmpty() ? "retry" : owner.equals(session.optString("userId")) ? "capture" : "auth";
        if (state != null && "unauthenticated".equals(state.optString("state"))) return "auth";
        // Missing storage is not evidence of logout. Bounded worker retries end in retry UI.
        return "retry";
    }
    public static JSONObject diagnostics(JSONObject session, JSONObject state, String webUser, long now) {
        JSONObject result = new JSONObject();
        try {
            boolean matches = session != null && webUser != null && webUser.equals(session.optString("userId"));
            result.put("available", true);
            result.put("nativeSessionPresent", session != null);
            result.put("accessTokenPresent", session != null && !session.optString("accessToken").isEmpty());
            result.put("refreshTokenPresent", session != null && !session.optString("refreshToken").isEmpty());
            result.put("accessTokenExpired", !NativeSession.fresh(session, now));
            result.put("storedUserMatchesWebUser", matches);
            String readiness = state == null ? "restoring" : state.optString("state", "restoring");
            result.put("state", readiness);
            result.put("nativeAuthReady", matches && NativeSession.fresh(session, now) && "authenticated".equals(readiness));
        } catch (Exception ignored) { /* All keys/values above are fixed primitive fields. */ }
        return result;
    }
}
