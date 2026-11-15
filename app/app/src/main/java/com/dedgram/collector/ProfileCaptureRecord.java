package com.dedgram.collector;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Availability describes this observed UI, never an assumption about hidden account data. */
public final class ProfileCaptureRecord {
    public static final String[] FIELDS = {"posts_count", "followers_count", "following_count",
            "profile_header_text", "bio", "display_name", "category", "account_based_in",
            "date_joined", "profile_picture", "former_usernames_count"};
    public final String username;
    public final JSONObject json = new JSONObject();
    private final JSONObject availability = new JSONObject();

    public ProfileCaptureRecord(String username) {
        this.username = username;
        put(json, "fetched_at", timestamp());
        put(json, "capture_scope", "profile_details_without_reel_inventory");
        put(json, "navigation_error", null);
        put(json, "posts_count_displayed", null);
        put(json, "about_text", null);
        put(json, "former_usernames_text", null);
        put(json, "field_availability", availability);
        for (String field : FIELDS) failed(field, "Capture has not verified this field.");
    }

    public void field(String name, Object value, String status, String evidence) {
        put(json, name, value);
        JSONObject state = new JSONObject();
        put(state, "status", status);
        put(state, "evidence", evidence);
        put(state, "observed_at", timestamp());
        put(state, "error", "failed".equals(status) ? evidence : null);
        put(availability, name, state);
    }
    public void available(String name, Object value, String evidence) { field(name, value, "available", evidence); }
    public void absent(String name, String evidence) { field(name, null, "not_shown", evidence); }
    public void failed(String name, String error) { field(name, null, "failed", error); }
    public void failUnverified(String error) {
        for (String field : FIELDS) if ("Capture has not verified this field.".equals(availability.optJSONObject(field).optString("evidence"))) failed(field, error);
    }
    public boolean hasFailures() {
        if (!json.isNull("navigation_error")) return true;
        for (String field : FIELDS) if ("failed".equals(availability.optJSONObject(field).optString("status"))) return true;
        return false;
    }
    public String failures() {
        JSONArray fields = new JSONArray();
        for (String field : FIELDS) if ("failed".equals(availability.optJSONObject(field).optString("status"))) fields.put(field);
        if (!json.isNull("navigation_error")) fields.put("navigation");
        return fields.toString();
    }
    public String failureSummary() {
        String[] labels={"posts count","followers","following","profile header","bio","display name","category","country","join date","profile picture","former usernames"};
        java.util.List<String> names=new java.util.ArrayList<>();
        for(int i=0;i<FIELDS.length;i++)if("failed".equals(availability.optJSONObject(FIELDS[i]).optString("status")))names.add(labels[i]);
        if(!json.isNull("navigation_error"))names.add("screen navigation");
        return String.join(", ",names);
    }
    public Profile finish() {
        put(json, "capture_status", hasFailures() ? "failed" : "complete");
        put(json, "capture_finished_at", timestamp());
        return new Profile(username, ProfileStore.normalizeUsername(username), Long.toString(System.currentTimeMillis()), json);
    }
    static void put(JSONObject object, String key, Object value) {
        try { object.put(key, value == null ? JSONObject.NULL : value); }
        catch (JSONException error) { throw new IllegalStateException(error); }
    }
    private static String timestamp() {
        java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",java.util.Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return format.format(new java.util.Date());
    }
}
