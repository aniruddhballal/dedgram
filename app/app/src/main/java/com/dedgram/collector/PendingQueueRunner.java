package com.dedgram.collector;
import android.content.Context;import android.os.*;import android.view.accessibility.AccessibilityNodeInfo;import org.json.*;

/** One URL, one capture, durable result, then the next URL. Never retries a block. */
public final class PendingQueueRunner {
    public interface Host {AccessibilityNodeInfo root();void open(String url);void capture();void stopService();void progress(String text);boolean save(Reel reel);}
    interface Storage {PendingReels read() throws Exception;void result(String url,String status,String detail,String capturedAt)throws Exception;void progress(String text);}
    private final Storage storage;private final Host host;private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean running,capturing;private JSONObject entry;private String url,baseline="",stable="";private int reads;private long openedAt;
    public PendingQueueRunner(final Context c,Host h){this(h,new Storage(){
        public PendingReels read()throws Exception{return PendingReelStore.read(c);}
        public void result(String u,String s,String d,String at)throws Exception{PendingReelStore.result(c,u,s,d,at);}
        public void progress(String text){PendingReelStore.progress(c,text);}
    });}
    PendingQueueRunner(Host h,Storage s){host=h;storage=s;}
    public boolean isRunning(){return running;}
    public boolean isNavigating(){return running&&!capturing&&url!=null&&openedAt>0&&SystemClock.elapsedRealtime()-openedAt<8000;}public boolean isCapturing(){return running&&capturing;}
    public void start(){running=true;handler.postDelayed(this::next,500);}
    public void stop(String reason){if(!running)return;running=false;capturing=false;handler.removeCallbacksAndMessages(null);progress(reason);}
    private void progress(String state){try{PendingReels q=storage.read();state=q.done()+" / "+q.reels.length()+" attempted - "+state;}catch(Exception ignored){}storage.progress(state);host.progress(state);}
    private static String signature(ReelAccessibilityExtractor.Snapshot s){return s.account()+"|"+s.caption()+"|"+s.metric("like")+"|"+s.metric("comment")+"|"+s.metric("repost")+"|"+s.metric("share")+"|"+s.metric("save");}
    private void next(){if(!running)return;try{
        PendingReels queue=storage.read();entry=queue.next();
        if(entry==null){stop("Queue finished");return;}
        url=PendingReels.canonicalUrl(entry.getString("url"));
        openedAt=SystemClock.elapsedRealtime();
        AccessibilityNodeInfo root=host.root();baseline="";
        if(root!=null){baseline=signature(ReelAccessibilityExtractor.snapshot(root));root.recycle();}
        if(!running)return;
        capturing=false;stable="";reads=0;openedAt=SystemClock.elapsedRealtime();progress("Opening "+PendingReels.shortcode(url));
        host.open(url);handler.postDelayed(this::poll,1000);
    }catch(Exception e){halt("Queue could not start: "+e.getMessage());}}
    private void poll(){if(!running)return;AccessibilityNodeInfo root=host.root();if(!running){if(root!=null)root.recycle();return;}
        if(root!=null){
            ReelAccessibilityExtractor.Snapshot s=ReelAccessibilityExtractor.snapshot(root);root.recycle();
            String issue=s.queueIssue();
            if(issue!=null){
                if(issue.equals("deleted")&&!capturing){finish(failure("Instagram explicitly reported this reel unavailable; deletion versus archiving is unconfirmed."),"deleted",false);return;}
                finish(failure("Instagram access requires review: "+issue),issue.equals("rate_limited")?"rate_limited":"needs_review",true);return;
            }
            if(!capturing&&s.isLikelyReel()&&!s.hasLikesAndPlaysSheet()&&!s.hasCaptionSheet()){
                String actual=s.account(),expected=entry.optString("expected_account",entry.optString("username",""));
                boolean owner=expected.isEmpty()||ProfileStore.normalizeUsername(expected).equals(ProfileStore.normalizeUsername(actual));
                String code=s.shortcode();boolean matches=code.isEmpty()||code.equals(shortcode());
                String current=signature(s);
                if(owner&&matches&&!actual.isEmpty()&&!current.equals(baseline)&&SystemClock.elapsedRealtime()-openedAt>=2000){
                    reads=current.equals(stable)?reads+1:1;stable=current;
                    if(reads>=2){capturing=true;progress("Capturing "+shortcode());host.capture();}
                }else{reads=0;stable="";}
            }
        }
        if(SystemClock.elapsedRealtime()-openedAt>45000){finish(failure("Reel did not load or identity could not be verified within 45 seconds. Queue stopped without retry."),"failed",true);return;}
        if (running && entry != null) handler.postDelayed(this::poll,500);
    }
    private String shortcode(){try{return PendingReels.shortcode(url);}catch(Exception e){return "";}}
    private Reel failure(String message){Reel r=new Reel();r.account=entry==null?"Unknown":entry.optString("expected_account",entry.optString("username","Unknown"));r.capturedAt=Long.toString(System.currentTimeMillis());r.captureStage="queue_issue";
        r.likesError=message;r.commentsError=message;r.viewsOrPlaysError=message;r.repostsError=message;r.sharesError=message;r.savesError=message;r.datePostedError=message;r.captionError=message;return r;}
    public void accept(Reel r){if(!isCapturing())return;
        String expected=entry.optString("expected_account",entry.optString("username",""));
        if(!expected.isEmpty()&&!ProfileStore.normalizeUsername(expected).equals(ProfileStore.normalizeUsername(r.account))){finish(failure("Reel account changed during capture; no metrics attributed to the queued URL."),"failed",true);return;}
        if(!r.shortcode.isEmpty()&&!r.shortcode.equals(shortcode())){finish(failure("Reel identity changed during capture."),"failed",true);return;}
        finish(r,PendingReels.outcome(r),false);
    }
    private void finish(Reel r,String status,boolean block){if(!running)return;handler.removeCallbacksAndMessages(null);capturing=false;
        try{
            r.url=url;r.shortcode=shortcode();r.identitySource=r.captureStage.equals("queue_issue")?"queue_requested_url_unverified":entry.optString("expected_account",entry.optString("username","")).isEmpty()?"queue_deep_link_and_render_check":"queue_deep_link_and_account_check";
            if(!host.save(r))throw new Exception("reels.json could not be saved");
            // A durable result precedes its queue checkpoint, so a crash cannot
            // mark an unsaved reel collected. Replaying uses shortcode identity.
            storage.result(url,status,block?r.captionError:null,r.capturedAt);
            progress(status+" - "+shortcode());
            if(block){halt("Stopped: "+status+". No retry.");return;}
            entry=null;url=null;handler.postDelayed(this::next,2500);
        }catch(Exception e){halt("Save failed; queue stopped: "+e.getMessage());}}
    private void halt(String why){stop(why);host.stopService();}
}
