package com.dedgram.collector;

import org.json.JSONException;
import org.json.JSONObject;

public final class Profile {
    public final String username;
    public final String normalizedUsername;
    public final String firstSeenAt;
    // Preserve complete captures and unknown metadata when reading older catalogs.
    public final JSONObject details;

    public Profile(String username, String normalizedUsername, String firstSeenAt) {
        this(username, normalizedUsername, firstSeenAt, new JSONObject());
    }

    public Profile(String username, String normalizedUsername, String firstSeenAt, JSONObject details) {
        this.username = username;
        this.normalizedUsername = normalizedUsername;
        this.firstSeenAt = firstSeenAt;
        this.details = details;
    }

    public JSONObject toJson() throws JSONException {
        JSONObject object = new JSONObject(details.toString());
        object.put("username", username);
        object.put("normalized_username", normalizedUsername);
        object.put("first_seen_at", firstSeenAt);
        return object;
    }

    public static Profile fromJson(JSONObject object) throws JSONException {
        String username = object.optString("username", "").trim();
        String normalized = object.optString("normalized_username", "").trim();
        String firstSeenAt = object.optString("first_seen_at", "").trim();
        if (normalized.isEmpty()) normalized = ProfileStore.normalizeUsername(username);
        if (username.isEmpty()) username = normalized;
        return new Profile(username, normalized, firstSeenAt, new JSONObject(object.toString()));
    }

    public boolean captureFailed() { return "failed".equals(details.optString("capture_status")); }
}
