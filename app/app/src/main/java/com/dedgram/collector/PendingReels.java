package com.dedgram.collector;

import org.json.*;
import java.net.URI;
import java.util.*;

/** Lossless queue document model. Only null-status entries are eligible. */
public final class PendingReels {
    public final JSONObject document;
    public final JSONArray reels;
    public PendingReels(String json) throws JSONException {
        Object parsed = new JSONTokener(json).nextValue();
        document = parsed instanceof JSONArray ? new JSONObject().put("version",1).put("reels",parsed) : (JSONObject)parsed;
        reels = document.getJSONArray("reels");
        Set<String> seen = new HashSet<>();
        for (int i=0;i<reels.length();i++) {
            JSONObject entry=reels.getJSONObject(i);
            String url=canonicalUrl(entry.getString("url"));
            if (!seen.add(url)) throw new JSONException("Duplicate reel URL: "+url);
            String status=entry.isNull("status")?null:entry.getString("status");
            if (status!=null && !Arrays.asList("collected","partial","failed","deleted","needs_review","rate_limited").contains(status)) throw new JSONException("Unknown queue status: "+status);
        }
    }
    public static String canonicalUrl(String input) throws JSONException {
        try {
            URI u=new URI(input.trim());String host=u.getHost();
            if (!"https".equalsIgnoreCase(u.getScheme()) || !("instagram.com".equalsIgnoreCase(host)||"www.instagram.com".equalsIgnoreCase(host)) || u.getUserInfo()!=null || u.getPort()!=-1) throw new Exception();
            java.util.regex.Matcher m=java.util.regex.Pattern.compile("^/(?:reel|reels|p)/([A-Za-z0-9_-]+)/?$").matcher(u.getPath());
            if(!m.matches())throw new Exception();
            return "https://www.instagram.com/reel/"+m.group(1)+"/";
        }catch(Exception e){throw new JSONException("Expected an Instagram reel URL: "+input);}
    }
    public static String shortcode(String url) throws JSONException {String[] p=canonicalUrl(url).split("/");return p[p.length-1];}
    public int done(){int n=0;for(int i=0;i<reels.length();i++)if(!reels.optJSONObject(i).isNull("status"))n++;return n;}
    public JSONObject next(){for(int i=0;i<reels.length();i++){JSONObject e=reels.optJSONObject(i);if(e.isNull("status"))return e;}return null;}
    public void result(String url,String status,String detail,String capturedAt) throws JSONException {
        for(int i=0;i<reels.length();i++){JSONObject e=reels.getJSONObject(i);if(canonicalUrl(e.getString("url")).equals(canonicalUrl(url))){
            e.put("status",status).put("updated_at",System.currentTimeMillis()).put("detail",detail==null?JSONObject.NULL:detail).put("captured_at",capturedAt==null?JSONObject.NULL:capturedAt);return;}}
        throw new JSONException("Active URL was removed from queue");
    }
    public static String outcome(Reel r){
        return r.hasErrors() || !r.captionExpanded || r.caption.isEmpty() || r.datePosted.isEmpty()
            || r.viewsOrPlays==null || (r.comments==null&&!r.metricNotExposed("comments")) || (r.likes==null&&!"owner_only".equals(r.likesAvailability))
            || (r.shares==null&&!r.metricNotExposed("shares")) || (r.reposts==null&&!r.metricNotExposed("reposts"))
            || (r.saves==null&&!r.metricNotExposed("saves")) ? "partial" : "collected";
    }
}
