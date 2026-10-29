package com.dedgram.collector;

import org.json.JSONException;
import org.json.JSONObject;

/** A reel capture. Nullable values are paired with a field-level error. */
public final class Reel {
    public String shortcode = "";
    public String account = "";
    public String capturedAt = "";
    public Long likes;
    public Long comments;
    public Long viewsOrPlays;
    public Long shares;
    public Long reposts;
    public Long saves;
    public String datePosted = "";
    public String caption = "";
    public String likesError;
    public String commentsError;
    public String viewsOrPlaysError;
    public String sharesError;
    public String repostsError;
    public String savesError;
    public String datePostedError;
    public String captionError;

    public static Reel fromJson(JSONObject object) {
        Reel reel = new Reel();
        reel.shortcode = object.optString("shortcode", "");
        reel.account = object.optString("account", "");
        reel.capturedAt = object.optString("captured_at", "");
        reel.likes = longValue(object, "likes");
        reel.comments = longValue(object, "comments");
        reel.viewsOrPlays = longValue(object, "views_or_plays");
        reel.shares = longValue(object, "shares");
        reel.reposts = longValue(object, "reposts");
        reel.saves = longValue(object, "saves");
        reel.datePosted = fieldText(object, "date_posted");
        reel.caption = fieldText(object, "caption");
        reel.likesError = fieldError(object, "likes");
        reel.commentsError = fieldError(object, "comments");
        reel.viewsOrPlaysError = fieldError(object, "views_or_plays");
        reel.sharesError = fieldError(object, "shares");
        reel.repostsError = fieldError(object, "reposts");
        reel.savesError = fieldError(object, "saves");
        reel.datePostedError = fieldError(object, "date_posted");
        reel.captionError = fieldError(object, "caption");
        return reel;
    }

    public JSONObject toJson() throws JSONException {
        JSONObject object = new JSONObject();
        object.put("shortcode", shortcode);
        object.put("account", account);
        object.put("captured_at", capturedAt);
        object.put("likes", field(likes, likesError));
        object.put("comments", field(comments, commentsError));
        object.put("views_or_plays", field(viewsOrPlays, viewsOrPlaysError));
        object.put("shares", field(shares, sharesError));
        object.put("reposts", field(reposts, repostsError));
        object.put("saves", field(saves, savesError));
        object.put("date_posted", field(datePosted, datePostedError));
        object.put("caption", field(caption, captionError));
        return object;
    }

    public boolean hasErrors() {
        return likesError != null || commentsError != null || viewsOrPlaysError != null
                || sharesError != null || repostsError != null || savesError != null
                || datePostedError != null || captionError != null;
    }

    private static JSONObject field(Object value, String error) throws JSONException {
        JSONObject result = new JSONObject();
        result.put("value", value == null ? JSONObject.NULL : value);
        result.put("error", error == null ? JSONObject.NULL : error);
        return result;
    }

    private static Long longValue(JSONObject object, String key) {
        JSONObject field = object.optJSONObject(key);
        if (field == null || field.isNull("value")) return null;
        return field.optLong("value");
    }

    private static String fieldText(JSONObject object, String key) {
        JSONObject field = object.optJSONObject(key);
        if (field == null || field.isNull("value")) return "";
        return field.optString("value", "");
    }

    private static String fieldError(JSONObject object, String key) {
        JSONObject field = object.optJSONObject(key);
        if (field == null || field.isNull("error")) return null;
        String error = field.optString("error", "");
        return error.isEmpty() ? null : error;
    }
}
