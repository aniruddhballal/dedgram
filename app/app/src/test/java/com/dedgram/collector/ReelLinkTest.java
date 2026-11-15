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
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import javax.xml.parsers.DocumentBuilderFactory;
import java.time.Duration;
import java.util.function.BiConsumer;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28) @LooperMode(LooperMode.Mode.PAUSED)
public class ReelLinkTest {
    private java.util.function.BiFunction<String,Integer,Boolean> actions;
    private AccessibilityNodeInfo fixture(String name,String before,String after)throws Exception{
        String xml=new String(getClass().getResourceAsStream("/reel-link/"+name+".xml").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).replace(before,after);
        Element root=DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new java.io.ByteArrayInputStream(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8))).getDocumentElement();
        return node((Element)root.getElementsByTagName("node").item(0));
    }
    private AccessibilityNodeInfo node(Element element){
        AccessibilityNodeInfo n=AccessibilityNodeInfo.obtain();n.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);
        n.setViewIdResourceName(element.getAttribute("resource-id"));n.setText(element.getAttribute("text"));n.setContentDescription(element.getAttribute("content-desc"));
        n.setVisibleToUser(true);n.setClickable(Boolean.parseBoolean(element.getAttribute("clickable")));
        java.util.regex.Matcher bounds=java.util.regex.Pattern.compile("[0-9]+").matcher(element.getAttribute("bounds"));int[] b=new int[4];for(int i=0;i<4 && bounds.find();i++)b[i]=Integer.parseInt(bounds.group());n.setBoundsInScreen(new Rect(b[0],b[1],b[2],b[3]));
        String label=element.getAttribute("content-desc").isEmpty()?element.getAttribute("text"):element.getAttribute("content-desc");
        if(actions!=null)shadowOf(n).setOnPerformActionListener((action,args)->actions.apply(label,action));
        NodeList children=element.getChildNodes();for(int i=0;i<children.getLength();i++)if(children.item(i) instanceof Element)shadowOf(n).addChild(node((Element)children.item(i)));
        return n;
    }
    @Test public void removesTrackingAndCanonicalizesPluralRoutes()throws Exception{
        assertEquals("https://www.instagram.com/reel/DSuwCXpDJ_v/",ReelLink.canonical("https://www.instagram.com/reels/DSuwCXpDJ_v/?igsh=tracking&utm_source=share#tail"));
        assertEquals("https://www.instagram.com/reel/ABC_12-/",ReelLink.canonical("Watch this: https://instagram.com/reel/ABC_12-/?igsh=abc"));
    }
    @Test public void refusesLookalikesRedirectsAndAmbiguousClipText()throws Exception{
        for(String value:new String[]{"https://instagram.com.evil.test/reel/ABC/","https://instagram.com/share/reel/ABC/","https://instagram.com/reel/ABC/extra/","https://instagram.com/reel/ABC/ https://instagram.com/reel/DEF/","old clipboard text"}){
            try{ReelLink.canonical(value);fail(value);}catch(Exception expected){}
        }
    }
    @Test public void rejectsStaleAndFutureClipboardObservations(){
        assertFalse(ReelClipboardReader.fresh(99,100,200));assertFalse(ReelClipboardReader.fresh(201,100,200));assertTrue(ReelClipboardReader.fresh(100,100,200));
    }
    @Test public void urlErrorsAndEvidenceRoundTripWithoutRawTrackingText()throws Exception{
        Reel r=new Reel();r.url="https://www.instagram.com/reel/ABC/";r.shortcode="ABC";r.urlError="Copy failed";
        r.urlObservation=new JSONObject().put("source","instagram_android_share_copy_link");
        Reel restored=Reel.fromJson(r.toJson());assertEquals(r.url,restored.url);assertEquals(r.urlError,restored.urlError);assertTrue(restored.hasErrors());
        assertEquals("instagram_android_share_copy_link",restored.urlObservation.getString("source"));
    }
    @Test public void selectorDoesNotTreatOtherShareActionsAsCopy()throws Exception{
        AccessibilityNodeInfo root=fixture("share","Copy link","Send");assertFalse(ReelLink.hasCopy(root));assertFalse(ReelLink.copy(root));
    }
    @Test public void skipsExplicitSponsoredReelsWithoutTreatingOrdinaryCaptionTextAsAnAd()throws Exception{
        assertFalse(ReelLink.isAd(fixture("reel","__none__","")));
        assertTrue(ReelLink.isAd(fixture("reel","Reel by reposted.","Sponsored Reel by reposted.")));
        assertFalse(ReelLink.isAd(fixture("reel","Once a rug","An ad about a rug")));
    }
    @Test public void oneStartCopiesLinkAndVerifiesReturnToOriginalReel()throws Exception{run(false,false,null);}
    @Test public void changedReelDiscardsCopiedUrl()throws Exception{run(true,false,null);}
    @Test public void staleClipboardFailureIsRetainedWhileReturningToReel()throws Exception{run(false,false,"Stale clipboard ignored");}
    @Test public void changedReelBeforeSharePreventsAnyCopy()throws Exception{run(false,true,null);}
    private void run(boolean changedAfter,boolean changedBefore,String clipboardError)throws Exception{
        String baseline=ReelLink.fingerprint(fixture("reel","__none__",""));assertFalse(baseline.isEmpty());
        final String[] page={"reel"};final int[] copies={0};final String[] result={null,null};final boolean[] returned={false},finished={false};
        actions=(label,action)->{
            if(action!=AccessibilityNodeInfo.ACTION_CLICK)return false;
            if(label.equals("Share")){page[0]="share";return true;}
            if(label.equals("Copy link")){page[0]="reel";copies[0]++;return true;}
            if(label.equals("Dismiss")){page[0]="reel";return true;}
            throw new AssertionError("Unexpected action: "+label);
        };
        ReelLinkCapture.Host host=new ReelLinkCapture.Host(){
            public AccessibilityNodeInfo root(){try{return fixture(page[0],(changedBefore || changedAfter && copies[0]>0)?"reposted":"__none__","different_owner");}catch(Exception e){throw new RuntimeException(e);}}
            public void clipboard(long at,BiConsumer<String,String> callback){callback.accept(clipboardError==null?"https://www.instagram.com/reel/DSuwCXpDJ_v/":null,clipboardError);}
            public void finished(String url,String error,boolean same,long at){finished[0]=true;result[0]=url;result[1]=error;returned[0]=same;}
        };
        new ReelLinkCapture(new Handler(Looper.getMainLooper()),host,baseline).start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(15));assertTrue(finished[0]);
        if(changedBefore || changedAfter){assertNull(result[0]);assertNotNull(result[1]);assertFalse(returned[0]);}
        else if(clipboardError!=null){assertNull(result[0]);assertEquals(clipboardError,result[1]);assertTrue(returned[0]);}
        else{assertEquals("https://www.instagram.com/reel/DSuwCXpDJ_v/",result[0]);assertNull(result[1]);assertTrue(returned[0]);}
        assertEquals(changedBefore?0:1,copies[0]);
    }
}
