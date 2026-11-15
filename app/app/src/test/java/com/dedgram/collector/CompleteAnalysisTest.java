package com.dedgram.collector;

import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class CompleteAnalysisTest {
    private Reel reel(String code){Reel r=new Reel();r.account="owner";r.url="https://www.instagram.com/reel/"+code+"/";r.shortcode=code;return r;}
    @Test public void countsOnlyUniqueDurablyAcceptedReelsAndNeverInventsTotal()throws Exception{
        CompleteAnalysisRun run=new CompleteAnalysisRun("owner",true);
        assertTrue(run.accept(reel("ONE"),0));assertFalse(run.accept(reel("ONE"),1));assertTrue(run.accept(reel("TWO"),2));
        assertEquals(2,run.json().getInt("captured_count"));assertTrue(run.json().isNull("total_reels"));assertFalse(run.json().getBoolean("scan_complete"));
        assertTrue(run.covers(3,2));assertFalse(run.covers(4,2));
    }
    @Test public void missingPositionsAndPartialSavesCannotProveEnd()throws Exception{
        CompleteAnalysisRun run=new CompleteAnalysisRun("owner",true);run.accept(reel("ONE"),0);run.accept(reel("THREE"),2);
        assertFalse(run.covers(3,2));assertFalse(run.covers(-1,2));assertFalse(run.covers(0,0));
    }
    @Test public void rejectsWrongOwnerMissingUrlAndMismatchedShortcode()throws Exception{
        for(int kind=0;kind<3;kind++){
            CompleteAnalysisRun run=new CompleteAnalysisRun("owner",true);Reel r=reel("ONE");
            if(kind==0)r.account="different";else if(kind==1)r.url="";else r.shortcode="WRONG";
            try{run.accept(r,0);fail("Should reject unverified reel");}catch(Exception expected){}
            assertTrue(run.codes.isEmpty());
        }
    }
    @Test public void fieldErrorsDoNotBecomeSuccessfulCompleteAnalysis()throws Exception{
        CompleteAnalysisRun run=new CompleteAnalysisRun("owner",true);Reel r=reel("ONE");r.captionError="Caption failed";run.accept(r,0);
        assertEquals(1,run.json().getInt("reels_with_errors"));assertTrue(run.json().isNull("total_reels"));
    }
    private AccessibilityNodeInfo node(String id,String text){
        AccessibilityNodeInfo n=AccessibilityNodeInfo.obtain();n.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);n.setVisibleToUser(true);n.setText(text);
        if(id!=null)n.setViewIdResourceName("com.instagram.android:id/"+id);n.setBoundsInScreen(new Rect(0,0,1080,2200));return n;
    }
    @Test public void viewerMetadataUsesActiveItemAndIgnoresOffscreenOrNestedCollections(){
        AccessibilityNodeInfo root=node(null,"");AccessibilityNodeInfo pager=node("clips_viewer_view_pager","");pager.setCollectionInfo(AccessibilityNodeInfo.CollectionInfo.obtain(3,1,false));
        shadowOf(root).addChild(pager);AccessibilityNodeInfo item=node(null,"");item.setCollectionItemInfo(AccessibilityNodeInfo.CollectionItemInfo.obtain(2,1,0,1,false));shadowOf(pager).addChild(item);
        shadowOf(item).addChild(node("clips_author_username","owner"));
        for(String label:new String[]{"Repost","Share","Save"})shadowOf(item).addChild(node(null,label));
        shadowOf(item).addChild(node("clips_caption","Original reel caption"));
        AccessibilityNodeInfo offscreen=node(null,"");offscreen.setBoundsInScreen(new Rect(0,2200,1080,4400));offscreen.setCollectionItemInfo(AccessibilityNodeInfo.CollectionItemInfo.obtain(9,1,0,1,false));shadowOf(pager).addChild(offscreen);
        AccessibilityNodeInfo nested=node(null,"");nested.setBoundsInScreen(new Rect(0,0,100,100));nested.setCollectionInfo(AccessibilityNodeInfo.CollectionInfo.obtain(100,1,false));shadowOf(item).addChild(nested);
        CompleteAnalysisExtractor.Viewer view=CompleteAnalysisExtractor.viewer(root);assertTrue(view.viewer);assertEquals("owner",view.owner);assertEquals(3,view.count);assertEquals(2,view.index);
    }
}
