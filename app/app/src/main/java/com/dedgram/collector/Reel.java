package com.dedgram.collector;

import org.json.JSONException;
import org.json.JSONObject;

/** A reel capture. Nullable values are paired with a field-level error. */
public final class Reel {
    private JSONObject savedDocument;
    public String shortcode = "";
    public String url = "";
    public String urlError;
    public JSONObject urlObservation;
    public String identitySource = "accessibility";
    public JSONObject retainedObservations;
    public JSONObject metricAvailability;
    JSONObject initialAbsentControls;
    JSONObject confirmedAbsentControls;
    long initialMetricObservationAt, confirmedMetricObservationAt;
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
    public JSONObject publicationObservation;
    public boolean captionExpanded;
    boolean captionBackUsed;
    public String navigationError;
    public String captureStage = "initial";
    public String likesAvailability = "unknown";
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
        try { reel.savedDocument=new JSONObject(object.toString()); } catch(JSONException ignored){}
        reel.url = object.optString("url", "");
        reel.urlError=object.isNull("url_error")?null:object.optString("url_error",null);
        reel.urlObservation=object.optJSONObject("url_observation");
        reel.identitySource = object.optString("identity_source", "accessibility");
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
        reel.retainedObservations = object.optJSONObject("retained_observations");
        reel.metricAvailability = object.optJSONObject("metric_availability");
        reel.publicationObservation = object.optJSONObject("publication_observation");
        reel.navigationError = object.isNull("navigation_error") ? null : object.optString("navigation_error", null);
        reel.captionExpanded = object.optBoolean("caption_expanded", false);
        reel.captureStage = object.optString("capture_stage", "legacy");
        reel.likesAvailability = object.optString("likes_availability", "unknown");
        return reel;
    }

    public JSONObject toJson() throws JSONException {
        JSONObject object = savedDocument==null?new JSONObject():new JSONObject(savedDocument.toString());
        object.put("shortcode", shortcode);
        object.put("url", url);
        object.put("url_error",urlError==null?JSONObject.NULL:urlError);
        object.put("url_observation",urlObservation==null?JSONObject.NULL:urlObservation);
        object.put("identity_source", identitySource);
        object.put("retained_observations", retainedObservations == null ? JSONObject.NULL : retainedObservations);
        object.put("metric_availability", metricAvailability == null ? JSONObject.NULL : metricAvailability);
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
        object.put("publication_observation", publicationObservation == null ? JSONObject.NULL : publicationObservation);
        object.put("caption_expanded", captionExpanded);
        object.put("navigation_error", navigationError == null ? JSONObject.NULL : navigationError);
        object.put("capture_stage", captureStage);
        object.put("likes_availability", likesAvailability);
        return object;
    }

    public void retainMissingFrom(Reel old) {
        if(likes==null&&old.likes!=null&&old.likesError==null){likes=old.likes;retained("likes",old);}
        if(comments==null&&old.comments!=null&&old.commentsError==null){comments=old.comments;retained("comments",old);}
        if(viewsOrPlays==null&&old.viewsOrPlays!=null&&old.viewsOrPlaysError==null){viewsOrPlays=old.viewsOrPlays;retained("views_or_plays",old);}
        if(shares==null&&old.shares!=null&&old.sharesError==null){shares=old.shares;retained("shares",old);}
        if(reposts==null&&old.reposts!=null&&old.repostsError==null){reposts=old.reposts;retained("reposts",old);}
        if(saves==null&&old.saves!=null&&old.savesError==null){saves=old.saves;retained("saves",old);}
        if((caption.isEmpty()||captionError!=null)&&!old.caption.isEmpty()&&old.captionError==null){caption=old.caption;retained("caption",old);}
        if((datePosted.isEmpty()||datePostedError!=null)&&!old.datePosted.isEmpty()&&old.datePostedError==null){datePosted=old.datePosted;publicationObservation=old.publicationObservation;retained("date_posted",old);}
    }
    private void retained(String field,Reel old) {
        try{if(retainedObservations==null)retainedObservations=new JSONObject();
            JSONObject observation=old.retainedObservations==null?null:old.retainedObservations.optJSONObject(field);
            if(observation==null)observation=new JSONObject().put("captured_at",old.capturedAt).put("reason","Latest capture did not expose a reliable replacement; previous valid observation retained");
            retainedObservations.put(field,observation);
        }catch(JSONException ignored){}
    }

    public boolean hasErrors() {
        return likesError != null || commentsError != null || viewsOrPlaysError != null
                || sharesError != null || repostsError != null || savesError != null
                || datePostedError != null || captionError != null || navigationError != null || urlError != null;
    }

    public boolean metricNotExposed(String field) {
        JSONObject evidence=metricAvailability==null?null:metricAvailability.optJSONObject(field);
        return evidence!=null && "not_exposed".equals(evidence.optString("status"))
                && "verified_reel_controls".equals(evidence.optString("source"))
                && evidence.optInt("samples",0)>=2 && evidence.optBoolean("details_capture_verified",false)
                && evidence.optLong("confirmed_at",0)-evidence.optLong("first_observed_at",0)>=500
                && !evidence.optString("control_evidence", "").isEmpty();
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
