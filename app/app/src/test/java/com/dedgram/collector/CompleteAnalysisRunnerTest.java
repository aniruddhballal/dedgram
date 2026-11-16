package com.dedgram.collector;

import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28) @LooperMode(LooperMode.Mode.PAUSED)
public class CompleteAnalysisRunnerTest {
    private static AccessibilityNodeInfo node(String id,String text){
        AccessibilityNodeInfo n=AccessibilityNodeInfo.obtain();n.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);
        n.setVisibleToUser(true);n.setBoundsInScreen(new Rect(0,0,1080,2200));n.setText(text);
        if(id!=null)n.setViewIdResourceName("com.instagram.android:id/"+id);return n;
    }
    private static class Host implements CompleteAnalysisRunner.Host {
        final Handler handler=new Handler(Looper.getMainLooper());
        CompleteAnalysisRunner runner;
        String screen="profile",finished;
        int index,count=2,captures,actions;boolean wrongOwner,blocked,noMetadata,empty,failSave,stall,fieldError,acceptAtEnd,failCheckpoint,restoredShare;
        long captureDelay;
        boolean changingCounts,identicalCaptions;
        int stallAfter=Integer.MAX_VALUE;
        final List<JSONObject> states=new ArrayList<>();
        final List<String> progress=new ArrayList<>();
        public AccessibilityNodeInfo root(){
            AccessibilityNodeInfo root=node(null,"");
            if(screen.equals("profile") || screen.equals("grid")){
                shadowOf(root).addChild(node("action_bar_title","owner"));shadowOf(root).addChild(node("row_profile_header",""));
                shadowOf(root).addChild(node("profile_header_metrics_full_width",""));shadowOf(root).addChild(node("profile_header_actions_top_row",""));
                AccessibilityNodeInfo tab=node("profile_tab_icon_view","");tab.setContentDescription("Reels");tab.setSelected(screen.equals("grid"));tab.setClickable(true);
                shadowOf(tab).setOnPerformActionListener((a,b)->{screen="grid";return true;});shadowOf(root).addChild(tab);
                if(screen.equals("grid")){
                    if(empty)shadowOf(root).addChild(node(null,"No reels yet"));
                    else{
                        AccessibilityNodeInfo tile=node("preview_clip_thumbnail","");tile.setClickable(true);
                        shadowOf(tile).setOnPerformActionListener((a,b)->{screen="viewer";return true;});shadowOf(root).addChild(tile);
                    }
                }
                return root;
            }
            AccessibilityNodeInfo pager=node("clips_viewer_view_pager","");pager.setScrollable(true);
            if(!noMetadata)pager.setCollectionInfo(AccessibilityNodeInfo.CollectionInfo.obtain(count,1,false));
            if(index<count-1)pager.addAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
            shadowOf(pager).setOnPerformActionListener((a,b)->{
                if(a!=AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)return false;actions++;
                if(blocked)return false;if(index>=count-1)return acceptAtEnd;index++;return true;
            });
            shadowOf(root).addChild(pager);AccessibilityNodeInfo item=node(null,"");
            if(!noMetadata)item.setCollectionItemInfo(AccessibilityNodeInfo.CollectionItemInfo.obtain(index,1,0,1,false));
            shadowOf(pager).addChild(item);
            shadowOf(item).addChild(node("clips_author_username",wrongOwner&&index>0?"other":"owner"));
            shadowOf(item).addChild(node("clips_caption","Original caption "+(identicalCaptions?0:index)));
            if(changingCounts){shadowOf(item).addChild(node(null,"Like"));shadowOf(item).addChild(node(null,Integer.toString(10+captures)));}
            for(String control:new String[]{"Repost","Share","Save"})shadowOf(item).addChild(node(null,control));
            if(restoredShare){
                AccessibilityNodeInfo dismiss=node("background_dimmer","");dismiss.setContentDescription("Dismiss");dismiss.setClickable(true);
                shadowOf(dismiss).setOnPerformActionListener((a,b)->{restoredShare=false;return true;});shadowOf(root).addChild(dismiss);
            }
            return root;
        }
        public void profile(){
            ProfileCaptureRecord profile=new ProfileCaptureRecord("owner");for(String field:ProfileCaptureRecord.FIELDS)profile.absent(field,"Not shown");
            runner.profileFinished(profile,true);
        }
        public void reel(){
            captures++;if(stall || captures>stallAfter)return;
            Reel r=new Reel();r.account="owner";r.shortcode="CODE"+index;r.url="https://www.instagram.com/reel/"+r.shortcode+"/";
            if(fieldError)r.captionError="Unreadable caption";
            if(captureDelay>0)handler.postDelayed(()->runner.reelFinished(r,!failSave),captureDelay);else runner.reelFinished(r,!failSave);
        }
        public boolean checkpoint(String username,JSONObject state){try{states.add(new JSONObject(state.toString()));return !failCheckpoint;}catch(Exception e){throw new RuntimeException(e);}}
        public void progress(String text){progress.add(text);}
        public void finished(String text,boolean complete){finished=text;}
        void start(){runner=new CompleteAnalysisRunner(handler,this);runner.start();}
        JSONObject last(){return states.get(states.size()-1);}
        void idle(int seconds){shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(seconds));}
    }
    @Test public void oneStartCapturesProfileAndEveryReelAndVerifiesEnd()throws Exception{
        Host host=new Host();host.start();host.idle(30);
        assertEquals(2,host.captures);assertFalse(host.runner.isRunning());
        assertEquals("complete",host.last().getString("status"));assertEquals(2,host.last().getInt("total_reels"));
        for(int i=0;i<host.states.size()-1;i++)assertTrue(host.states.get(i).isNull("total_reels"));
        assertTrue(host.progress.stream().anyMatch(text->text.contains("2 reels captured")));
    }
    @Test public void failedScrollBeforeLastIsPartialNotACompletedCount()throws Exception{
        Host host=new Host();host.blocked=true;host.start();host.idle(30);
        assertEquals(1,host.captures);assertEquals("partial",host.last().getString("status"));assertTrue(host.last().isNull("total_reels"));
    }
    @Test public void liveCountsCanChangeDuringCaptureAtTheSameVerifiedPosition()throws Exception{
        Host host=new Host();host.changingCounts=true;host.start();host.idle(30);
        assertEquals(2,host.captures);assertEquals("complete",host.last().getString("status"));
    }
    @Test public void identicalCaptionsAdvanceOnlyWithChangedCollectionPosition()throws Exception{
        Host host=new Host();host.identicalCaptions=true;host.start();host.idle(30);
        assertEquals(2,host.captures);assertEquals("complete",host.last().getString("status"));
    }
    @Test public void missingCollectionEvidenceCannotProduceAFinalTotal()throws Exception{
        Host host=new Host();host.noMetadata=true;host.count=1;host.start();host.idle(30);
        assertEquals(1,host.captures);assertTrue(host.last().isNull("total_reels"));assertEquals("partial",host.last().getString("status"));
    }
    @Test public void foreignAccountStopsBeforeCapturingItsReels()throws Exception{
        Host host=new Host();host.wrongOwner=true;host.start();host.idle(30);
        assertEquals(1,host.captures);assertTrue(host.last().isNull("total_reels"));assertTrue(host.finished.contains("other account"));
    }
    @Test public void stopCancelsPendingCallbacksAndLateResultsAreIgnored()throws Exception{
        Host host=new Host();host.stall=true;host.start();host.idle(5);assertTrue(host.runner.isCapturing());
        host.runner.cancel("User stopped");int writes=host.states.size();host.runner.reelFinished(new Reel(),true);host.idle(120);
        assertEquals(writes,host.states.size());assertTrue(host.last().isNull("total_reels"));assertFalse(host.runner.isRunning());
    }
    @Test public void failedDurableSaveStopsBeforeAdvancing()throws Exception{
        Host host=new Host();host.failSave=true;host.start();host.idle(30);
        assertEquals(0,host.actions);assertEquals(0,host.last().getInt("captured_count"));assertTrue(host.last().isNull("total_reels"));
    }
    @Test public void explicitEmptyGridIsVerifiedAsZero()throws Exception{
        Host host=new Host();host.empty=true;host.start();host.idle(10);
        assertEquals(0,host.captures);assertEquals(0,host.last().getInt("total_reels"));assertEquals("complete",host.last().getString("status"));
    }
    @Test public void previousReelTimeoutCannotAbortALaterReel()throws Exception{
        Host host=new Host();host.captureDelay=75_000L;host.start();host.idle(175);
        assertEquals(2,host.captures);assertEquals("complete",host.last().getString("status"));
    }
    @Test public void terminalMetadataWinsOverFalselyAcceptedForwardAction()throws Exception{
        Host host=new Host();host.acceptAtEnd=true;host.start();host.idle(30);
        assertEquals("complete",host.last().getString("status"));assertEquals(1,host.actions);
    }
    @Test public void verifiedInventoryWithFieldErrorsKeepsTotalButIsNotCompleteAnalysis()throws Exception{
        Host host=new Host();host.fieldError=true;host.start();host.idle(30);
        assertEquals(2,host.last().getInt("total_reels"));assertTrue(host.last().getBoolean("scan_complete"));
        assertEquals("partial",host.last().getString("status"));assertEquals(2,host.last().getInt("reels_with_errors"));
    }
    @Test public void checkpointFailureStopsBeforeCapturingAnything()throws Exception{
        Host host=new Host();host.failCheckpoint=true;host.start();host.idle(30);
        assertEquals(0,host.captures);assertEquals(0,host.actions);assertFalse(host.runner.isRunning());
    }
    @Test public void stoppingDuringReelEightPersistsSevenAndNoConfirmedTotal()throws Exception{
        Host host=new Host();host.count=10;host.stallAfter=7;host.start();host.idle(30);
        assertEquals(8,host.captures);assertTrue(host.runner.isCapturing());host.runner.cancel("User stopped during reel 8");
        assertEquals(7,host.last().getInt("captured_count"));assertEquals(7,host.last().getJSONArray("captured_shortcodes").length());
        assertTrue(host.last().isNull("total_reels"));assertFalse(host.last().getBoolean("scan_complete"));
    }
    @Test public void restoredShareSheetFromAnInterruptedRunIsDismissedAutomatically()throws Exception{
        Host host=new Host();host.restoredShare=true;host.start();host.idle(30);
        assertEquals(2,host.captures);assertEquals("complete",host.last().getString("status"));assertFalse(host.restoredShare);
    }
}
