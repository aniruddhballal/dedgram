package com.dedgram.collector;

import android.os.Handler;
import android.view.accessibility.AccessibilityNodeInfo;

/** Composes existing captures; only verified terminal collection positions establish a total. */
public final class CompleteAnalysisRunner {
    public interface Host {
        AccessibilityNodeInfo root();void profile();void reel();
        boolean checkpoint(String username,org.json.JSONObject state);
        void progress(String text);void finished(String message,boolean complete);
        default boolean back(){return false;}
    }
    private final Handler handler;private final Host host;
    private CompleteAnalysisRun run;
    private boolean running,capturing;
    private String phase="",stable="",lastSignature="";
    private int attempts,logicalPosition,activePosition=-1,lastCount=-1,eventCount=-1,eventIndex=-1,terminalChecks,duplicates,captureGeneration,rewinds,recoveredPanels;
    private long lastTerminalAt;
    public CompleteAnalysisRunner(Handler handler,Host host){this.handler=handler;this.host=host;}
    public boolean isRunning(){return running;}
    public boolean isCapturing(){return running&&capturing;}
    public boolean awaitingProfile(){return running&&phase.equals("profile");}
    public void start(){if(running)return;running=true;phase="profile";host.progress("Capturing profile");host.profile();}
    public void cancel(String reason){if(running)stop(reason);}
    public void observeScroll(int count,int from,int to){
        if(!running || capturing || phase.equals("profile") || phase.equals("grid"))return;
        if(count>0 && from>=0 && from<count && to>=from && to<count){eventCount=count;eventIndex=from;}
    }
    private void later(Runnable action){handler.postDelayed(()->{if(running)action.run();},650L);}
    private void reset(){attempts=0;stable="";}
    public void profileFinished(ProfileCaptureRecord profile,boolean saved){
        if(!awaitingProfile())return;
        if(profile==null || !saved){stop("Profile capture could not be saved.");return;}
        run=new CompleteAnalysisRun(profile.username,!profile.hasFailures());
        if(!profile.json.isNull("navigation_error")){stop("Profile navigation failed; reels were not opened.");return;}
        phase="grid";run.phase="reel_grid";if(!checkpoint())return;
        AccessibilityNodeInfo root=host.root();
        boolean opened=root!=null && ProfileAccessibilityExtractor.snapshot(root).isHeader(run.username) && CompleteAnalysisExtractor.openReels(root);
        if(root!=null)root.recycle();
        if(!opened){stop("Could not open this profile's Reels tab.");return;}
        progress("Opening first reel");reset();later(this::grid);
    }
    private void grid(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){retry(this::grid,"Reel grid did not load.");return;}
        if(!CompleteAnalysisExtractor.selectedReels(root)){root.recycle();retry(this::grid,"Profile Reels tab could not be verified.");return;}
        if(CompleteAnalysisExtractor.loading(root)){root.recycle();retry(this::grid,"Profile Reels grid is still loading.");return;}
        int rewind=CompleteAnalysisExtractor.rewindGrid(root);
        if(rewind!=0){
            root.recycle();
            if(rewind<0 || ++rewinds>100){stop("Could not return the profile's reel grid to its first row.");return;}
            later(this::grid);return;
        }
        if(CompleteAnalysisExtractor.emptyGrid(root)){
            root.recycle();if(++terminalChecks<2){later(this::grid);return;}finishScan(0,"Explicit empty Reels grid verified twice.");return;
        }
        boolean opened=CompleteAnalysisExtractor.openFirst(root);root.recycle();
        if(!opened){retry(this::grid,"No first reel or explicit empty-grid message was exposed.");return;}
        phase="viewer";logicalPosition=0;eventCount=-1;eventIndex=-1;reset();later(this::viewer);
    }
    private void retry(Runnable action,String error){if(++attempts<12)later(action);else stop(error);}
    private void viewer(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){retry(this::viewer,"Reel viewer did not become readable.");return;}
        CompleteAnalysisExtractor.Viewer view=CompleteAnalysisExtractor.viewer(root);
        android.util.Log.i("dedgramAnalysis","viewer owner="+view.owner+" index="+view.index+" count="+view.count+" event="+eventIndex+"/"+eventCount+" forward="+view.forward+" loading="+view.loading);
        if(view.issue!=null){root.recycle();stop("Instagram requires attention: "+view.issue);return;}
        if(phase.equals("viewer") && run.username.equals(view.owner) && view.count>0 && view.index>=0){
            ReelAccessibilityExtractor.Snapshot restored=ReelAccessibilityExtractor.snapshot(root);
            boolean share=ReelLink.hasShareSheet(root);
            boolean panel=restored.hasLikesAndPlaysSheet() || (restored.hasCaptionSheet() && !restored.datePosted().isEmpty() && !restored.caption().isEmpty());
            if(share || panel){
                boolean closed=share?ReelLink.dismiss(root):ReelAccessibilityExtractor.dismissSheet(root);
                if(!closed && panel)closed=host.back();root.recycle();
                if(!closed || ++recoveredPanels>3){stop("Could not dismiss a restored reel panel from an earlier interrupted capture.");return;}
                stable="";later(this::viewer);return;
            }
        }
        if(ReelLink.isAd(root)){root.recycle();stop("An ad interrupted the profile's reel list; total remains unverified.");return;}
        if(!view.viewer || view.loading){root.recycle();retry(this::viewer,"A normal reel did not finish loading.");return;}
        if(!run.username.equals(view.owner)){root.recycle();stop("Viewer left @"+run.username+"; no other account was captured. Total remains unverified.");return;}
        if(view.signature.isEmpty() || !view.signature.equals(stable)){stable=view.signature;root.recycle();retry(this::viewer,"Reel observations did not stabilize.");return;}
        if(phase.equals("next") && view.signature.equals(lastSignature)){
            root.recycle();retry(this::viewer,"Viewer did not advance; total remains unverified.");return;
        }
        activePosition=view.index>=0?view.index:eventIndex>=0?eventIndex:logicalPosition;
        lastCount=view.count>0?view.count:eventCount;
        if(activePosition!=logicalPosition){root.recycle();stop("Viewer position skipped or repeated; total remains unverified.");return;}
        lastSignature=view.signature;root.recycle();capturing=true;phase="capture";run.phase="reel_capture";
        int generation=++captureGeneration;progress("Capturing reel "+(run.codes.size()+1));host.reel();
        handler.postDelayed(()->{if(running && capturing && generation==captureGeneration)stop("Reel capture timed out; partial progress is saved.");},90_000L);
    }
    public void reelFinished(Reel reel,boolean saved){
        if(!isCapturing())return;capturing=false;
        if(!saved){stop("Reel save failed; capture stopped before advancing.");return;}
        try{
            if(!run.accept(reel,activePosition)){if(++duplicates>1){stop("Repeated reels encountered without a verified end.");return;}}
            else duplicates=0;
        }catch(Exception invalid){stop(invalid.getMessage());return;}
        if(reel.navigationError!=null){stop("Reel navigation failed; captured data is saved.");return;}
        run.phase="advancing";if(!checkpoint())return;progress("Reel saved");reset();terminalChecks=0;lastTerminalAt=0;later(this::advance);
    }
    private void advance(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){retry(this::advance,"Could not return to the reel viewer.");return;}
        CompleteAnalysisExtractor.Viewer view=CompleteAnalysisExtractor.viewer(root);
        if(!view.viewer || view.loading){root.recycle();retry(this::advance,"Reel panels did not close or content is still loading.");return;}
        if(!run.username.equals(view.owner) || !lastSignature.equals(view.signature)){
            root.recycle();stop("Reel changed before automatic paging.");return;
        }
        int count=view.count>0?view.count:lastCount>0?lastCount:eventCount;
        int index=view.index>=0?view.index:activePosition;
        if(!view.forward && run.covers(count,index)){
            root.recycle();long now=android.os.SystemClock.elapsedRealtime();
            if(terminalChecks==0){terminalChecks=1;lastTerminalAt=now;later(this::advance);return;}
            if(now-lastTerminalAt<1200L){later(this::advance);return;}
            finishScan(run.codes.size(),"Terminal collection position "+index+" of "+count+"; every position saved; next action unavailable on repeated stable observations.");return;
        }
        boolean moved=CompleteAnalysisExtractor.advance(root);root.recycle();
        android.util.Log.i("dedgramAnalysis","advance index="+index+" count="+count+" moved="+moved+" covered="+run.covers(count,index));
        if(!moved && run.covers(count,index)){
            long now=android.os.SystemClock.elapsedRealtime();
            if(terminalChecks==0){lastTerminalAt=now;terminalChecks=1;later(this::advance);return;}
            if(now-lastTerminalAt<1200L){later(this::advance);return;}
            finishScan(run.codes.size(),"Terminal collection position "+index+" of "+count+"; every position saved; repeated forward actions refused.");return;
        }
        if(!moved){retry(this::advance,"Next-reel action failed without verified end evidence.");return;}
        phase="next";logicalPosition++;eventIndex=-1;eventCount=-1;reset();later(this::viewer);
    }
    private boolean checkpoint(){
        if(run==null)return true;
        if(host.checkpoint(run.username,run.json()))return true;
        running=false;capturing=false;host.finished("Analysis checkpoint could not be saved; stopped.",false);return false;
    }
    private void finishScan(int count,String evidence){
        run.total=count;run.phase="finished";run.status=run.profileComplete&&run.fieldErrors==0?"complete":"partial";run.note=evidence;
        if(!checkpoint())return;running=false;capturing=false;
        host.finished(count+" reels captured"+(run.status.equals("complete")?" · complete":" · some fields need attention"),run.status.equals("complete"));
    }
    private void progress(String action){host.progress("@"+run.username+" · "+run.codes.size()+" reels captured"+(run.fieldErrors>0?" · "+run.fieldErrors+" with errors":"")+"\n"+action);}
    private void stop(String reason){
        if(!running)return;running=false;capturing=false;
        if(run!=null){run.status="partial";run.phase="stopped";run.note=reason;run.total=null;host.checkpoint(run.username,run.json());}
        host.finished((run==null?"Analysis stopped":run.codes.size()+" reels captured · partial")+"\n"+reason,false);
    }
}
