package com.dedgram.collector;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.LinkedHashSet;
import java.util.Set;

/** A lightweight durable checkpoint; reel payloads remain in the existing reel catalog. */
public final class CompleteAnalysisRun {
    public final String username;
    public final Set<String> codes=new LinkedHashSet<>();
    public final Set<Integer> positions=new LinkedHashSet<>();
    public final long startedAt=System.currentTimeMillis();
    public boolean profileComplete;
    public int fieldErrors;
    public String phase="profile",status="running",note="";
    public Integer total;
    public CompleteAnalysisRun(String username,boolean profileComplete){this.username=username;this.profileComplete=profileComplete;}
    public boolean accept(Reel reel,int position)throws Exception{
        if(!username.equals(ProfileStore.normalizeUsername(reel.account)))throw new Exception("Reel belongs to a different account.");
        if(reel.urlError!=null || reel.url.isEmpty() || !PendingReels.canonicalUrl(reel.url).equals(reel.url))throw new Exception("Reel URL was not verified; traversal stopped.");
        String code=PendingReels.shortcode(reel.url);
        if(!code.equals(reel.shortcode))throw new Exception("Reel URL and shortcode disagree.");
        if(position>=0)positions.add(position);
        boolean added=codes.add(code);if(added && reel.hasErrors())fieldErrors++;return added;
    }
    public boolean covers(int count,int last){
        if(count<=0 || last!=count-1 || positions.size()!=count)return false;
        for(int i=0;i<count;i++)if(!positions.contains(i))return false;
        return !codes.isEmpty() && codes.size()<=count;
    }
    public JSONObject json(){
        JSONObject result=new JSONObject();
        ProfileCaptureRecord.put(result,"status",status);ProfileCaptureRecord.put(result,"phase",phase);
        ProfileCaptureRecord.put(result,"username",username);ProfileCaptureRecord.put(result,"started_at_epoch_ms",startedAt);
        ProfileCaptureRecord.put(result,"updated_at_epoch_ms",System.currentTimeMillis());
        ProfileCaptureRecord.put(result,"captured_count",codes.size());ProfileCaptureRecord.put(result,"reels_with_errors",fieldErrors);
        ProfileCaptureRecord.put(result,"profile_complete",profileComplete);ProfileCaptureRecord.put(result,"scan_complete",total!=null);
        ProfileCaptureRecord.put(result,"total_reels",total);ProfileCaptureRecord.put(result,"detail",note);
        ProfileCaptureRecord.put(result,"captured_shortcodes",new JSONArray(codes));
        ProfileCaptureRecord.put(result,"visited_positions",new JSONArray(positions));return result;
    }
}
