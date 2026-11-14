package com.dedgram.collector;

import org.json.JSONObject;
import org.json.JSONException;

/** Resolves only absence verified on two readable views of the same reel. */
final class ReelMetricAvailability {
    private static final String[] FIELDS={"comments","reposts","shares","saves"};
    private static final String[] LABELS={"comment","repost","share","save"};

    static void observe(Reel reel, ReelAccessibilityExtractor.Snapshot snapshot, boolean initial) {
        if (!ProfileStore.normalizeUsername(reel.account).equals(ProfileStore.normalizeUsername(snapshot.account()))) return;
        if (!snapshot.shortcode().isEmpty() && !reel.shortcode.isEmpty() && !snapshot.shortcode().equals(reel.shortcode)) return;
        JSONObject observations=new JSONObject();
        for(int i=0;i<FIELDS.length;i++) {
            String evidence=snapshot.absentCountControl(LABELS[i]);
            if(evidence!=null)try{observations.put(FIELDS[i],evidence);}catch(JSONException ignored){}
        }
        if(initial){reel.initialAbsentControls=observations;reel.initialMetricObservationAt=System.currentTimeMillis();}
        else{reel.confirmedAbsentControls=observations;reel.confirmedMetricObservationAt=System.currentTimeMillis();}
    }

    static void resolve(Reel reel) {
        // Successful caption/date and numeric panel reads establish a loaded,
        // readable reel. A missing panel, gate or navigation failure cannot pass.
        if(!"finished".equals(reel.captureStage)||!reel.captionExpanded||reel.caption.isEmpty()
                ||reel.captionError!=null||reel.datePosted.isEmpty()||reel.datePostedError!=null
                ||reel.viewsOrPlays==null||reel.viewsOrPlaysError!=null||reel.navigationError!=null
                ||(reel.likes==null&&!"owner_only".equals(reel.likesAvailability))||reel.likesError!=null
                ||reel.initialAbsentControls==null||reel.confirmedAbsentControls==null
                ||reel.confirmedMetricObservationAt-reel.initialMetricObservationAt<500) return;
        for(String field:FIELDS) {
            String first=reel.initialAbsentControls.optString(field,"");
            if(first.isEmpty()||!first.equals(reel.confirmedAbsentControls.optString(field,"")))continue;
            Long value=field.equals("comments")?reel.comments:field.equals("reposts")?reel.reposts:field.equals("shares")?reel.shares:reel.saves;
            if(value!=null)continue;
            try {
                if(reel.metricAvailability==null)reel.metricAvailability=new JSONObject();
                reel.metricAvailability.put(field,new JSONObject().put("status","not_exposed")
                    .put("source","verified_reel_controls").put("samples",2).put("details_capture_verified",true)
                    .put("first_observed_at",reel.initialMetricObservationAt).put("confirmed_at",reel.confirmedMetricObservationAt)
                    .put("control_evidence",first).put("scope","Observed Instagram Android UI; not a claim that the metric can never be exposed elsewhere"));
                if(field.equals("comments"))reel.commentsError=null;
                else if(field.equals("reposts"))reel.repostsError=null;
                else if(field.equals("shares"))reel.sharesError=null;
                else reel.savesError=null;
            }catch(JSONException ignored){}
        }
    }
}
