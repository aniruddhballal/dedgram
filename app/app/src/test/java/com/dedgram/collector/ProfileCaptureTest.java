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

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
@LooperMode(LooperMode.Mode.PAUSED)
public class ProfileCaptureTest {
    private java.util.function.BiFunction<String,Integer,Boolean> actions;
    // Fixtures are actual connected-phone UI trees, not replicas of implementation selectors.
    private AccessibilityNodeInfo fixture(String name) throws Exception {
        return fixture(name, "__no_replacement__", "");
    }
    private AccessibilityNodeInfo fixture(String name,String before,String after) throws Exception {
        String source=new String(getClass().getResourceAsStream("/profiles/"+name+".xml").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).replace(before,after);
        Element root=DocumentBuilderFactory.newInstance().newDocumentBuilder()
                .parse(new java.io.ByteArrayInputStream(source.getBytes(java.nio.charset.StandardCharsets.UTF_8))).getDocumentElement();
        return xml((Element)root.getElementsByTagName("node").item(0));
    }
    private AccessibilityNodeInfo xml(Element element) {
        AccessibilityNodeInfo node=AccessibilityNodeInfo.obtain();
        node.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);
        node.setText(element.getAttribute("text"));node.setContentDescription(element.getAttribute("content-desc"));
        node.setViewIdResourceName(element.getAttribute("resource-id"));
        node.setClickable(Boolean.parseBoolean(element.getAttribute("clickable")));
        node.setScrollable(Boolean.parseBoolean(element.getAttribute("scrollable")));node.setVisibleToUser(true);
        String label=element.getAttribute("text").isEmpty()?element.getAttribute("content-desc"):element.getAttribute("text");
        if(actions!=null)shadowOf(node).setOnPerformActionListener((action,args)->actions.apply(label,action));
        String[] bounds=element.getAttribute("bounds").replaceAll("[^0-9,]",",").split(",+");
        java.util.List<Integer> ints=new java.util.ArrayList<>();for(String s:bounds)if(!s.isEmpty())ints.add(Integer.parseInt(s));
        node.setBoundsInScreen(new Rect(ints.get(0),ints.get(1),ints.get(2),ints.get(3)));
        NodeList children=element.getChildNodes();
        for(int i=0;i<children.getLength();i++)if(children.item(i) instanceof Element)shadowOf(node).addChild(xml((Element)children.item(i)));
        return node;
    }
    private String status(ProfileCaptureRecord r,String field)throws Exception {
        return r.json.getJSONObject("field_availability").getJSONObject(field).getString("status");
    }
    @Test public void realHeaderCapturesExactCountsBioNameAndAbsentCategory()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("reposted");
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("header"));
        assertTrue(s.isHeader("reposted"));assertFalse(s.isHeader("different"));s.readHeader(r);
        assertEquals(11,r.json.getJSONObject("posts_count").getLong("value"));
        assertEquals(77,r.json.getJSONObject("followers_count").getLong("value"));
        assertEquals(0,r.json.getJSONObject("following_count").getLong("value"));
        assertEquals("Reposted",r.json.getString("display_name"));
        assertEquals("Get your content reposted @clippingculture",r.json.getString("bio"));
        assertEquals("not_shown",status(r,"category"));
        assertFalse(r.json.getString("profile_header_text").contains("row 1, column"));
    }
    @Test public void unicodeBioAndCategoryStaySeparateAndAbsentNameIsNotFailure()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("illmisguideyou");
        ProfileAccessibilityExtractor.snapshot(fixture("creator")).readHeader(r);
        assertEquals("Reel creator",r.json.getString("category"));
        assertTrue(r.json.getString("bio").contains("ONE PIECE"));
        assertFalse(r.json.getString("bio").contains("See translation"));
        assertEquals("not_shown",status(r,"display_name"));
        assertEquals("available",status(r,"bio"));
    }
    @Test public void truncatedVisibleBioIsFailure()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("illmisguideyou");
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("truncated"));
        assertTrue(s.bioTruncated());s.readHeader(r);assertEquals("failed",status(r,"bio"));
    }
    @Test public void aboutNotSharedResolvesAbsenceAndReadsFormerUsernames()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("reposted");
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("about"));
        assertTrue(s.isAbout("reposted"));assertFalse(s.isAbout("other"));s.readAbout(r,true);
        assertEquals("November 2025",r.json.getString("date_joined"));
        assertEquals(28,r.json.getLong("former_usernames_count"));
        assertEquals("not_shown",status(r,"account_based_in"));assertTrue(r.json.isNull("account_based_in"));
    }
    @Test public void actualMisspAboutScreenIdentityAndFieldsAreReadable()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("missp.riyax1");
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("about-missp"));
        assertTrue(s.isAbout("missp.riyax1"));
        s.readAbout(r,true);
        assertEquals("October 2026",r.json.getString("date_joined"));
        assertEquals("India",r.json.getString("account_based_in"));
        assertEquals("not_shown",status(r,"former_usernames_count"));
    }
    @Test public void shortAboutPageNeverScrollsInstagramNavigationPager()throws Exception {
        final int[] scrollActions={0};
        actions=(label,action)->{if(action==AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)scrollActions[0]++;return true;};
        AccessibilityNodeInfo root=fixture("about-missp");
        assertFalse(ProfileAccessibilityExtractor.snapshot(root).canScrollAbout());
        assertFalse(ProfileAccessibilityExtractor.scrollAbout(root));
        assertEquals(0,scrollActions[0]);
    }
    @Test public void hiddenScreensCannotSupplyAboutTitleOrReceiveScrolls()throws Exception {
        AccessibilityNodeInfo wrapper=AccessibilityNodeInfo.obtain();wrapper.setVisibleToUser(true);
        AccessibilityNodeInfo hidden=fixture("header");hidden.setVisibleToUser(false);
        shadowOf(wrapper).addChild(hidden);shadowOf(wrapper).addChild(fixture("about-missp"));
        assertTrue(ProfileAccessibilityExtractor.snapshot(wrapper).isAbout("missp.riyax1"));
        assertFalse(ProfileAccessibilityExtractor.snapshot(wrapper).fingerprint().contains("77followers"));
    }
    @Test public void unreadableVisibleCountFailsAndRoundedPostsDoNotInventExactCount()throws Exception {
        AccessibilityNodeInfo root=fixture("header","text=\"11\"","text=\"1.2K\"");
        ProfileCaptureRecord r=new ProfileCaptureRecord("reposted");ProfileAccessibilityExtractor.snapshot(root).readHeader(r);
        assertEquals("not_shown",status(r,"posts_count"));assertTrue(r.json.isNull("posts_count"));
        assertTrue(r.json.getJSONObject("posts_count_displayed").getBoolean("approximate"));
        AccessibilityNodeInfo malformed=fixture("header","text=\"77\"","text=\"--\"");
        ProfileAccessibilityExtractor.snapshot(malformed).readHeader(r);
        assertEquals("failed",status(r,"followers_count"));
    }
    private void change(AccessibilityNodeInfo node,String id,String text){
        if(String.valueOf(node.getViewIdResourceName()).endsWith(":id/"+id))node.setText(text);
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo c=node.getChild(i);if(c!=null){change(c,id,text);c.recycle();}}
    }
    @Test public void onlyExtractionFailuresFailTheRecordAndOldMetadataSurvives()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("reposted");
        for(String field:ProfileCaptureRecord.FIELDS)r.absent(field,"Not shown in verified UI");
        assertFalse(r.hasFailures());assertEquals("complete",r.finish().details.getString("capture_status"));
        r.failed("bio","Visible bio could not be read");assertTrue(r.hasFailures());
        assertEquals("failed",r.finish().details.getString("capture_status"));
        String old="{\"profiles\":[{\"username\":\"reposted\",\"first_seen_at\":\"original\",\"custom\":7,\"bio\":\"saved\"}]}";
        Profile p=ProfileStore.parse(old).get(0);assertEquals(7,p.toJson().getInt("custom"));assertEquals("original",p.firstSeenAt);
        assertEquals("saved",p.toJson().getString("bio"));
    }
    @Test public void missingAboutRowNeedsFullPageEvidenceAndVisibleEmptyRowFails()throws Exception {
        AccessibilityNodeInfo root=fixture("about","text=\"November 2025\"","text=\"\"");
        ProfileCaptureRecord r=new ProfileCaptureRecord("reposted");
        ProfileAccessibilityExtractor.snapshot(root).readAbout(r,true);
        assertEquals("failed",status(r,"date_joined"));
    }
    private void clearText(AccessibilityNodeInfo node,String text){
        if(text.equals(String.valueOf(node.getText())))node.setText("");
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo c=node.getChild(i);if(c!=null){clearText(c,text);c.recycle();}}
    }
    @Test public void failedMenuNavigationSavesFailureInsteadOfResolvingMissingFields()throws Exception {
        final ProfileCaptureRecord[] saved={null};
        ProfileCaptureRunner.Host host=new ProfileCaptureRunner.Host(){
            public AccessibilityNodeInfo root(){try{return fixture("header");}catch(Exception e){throw new RuntimeException(e);}}
            public void picture(Rect b,String u,BiConsumer<Object,String> cb){cb.accept(new JSONObject(),null);}
            public boolean back(){return false;}
            public void finished(ProfileCaptureRecord r){saved[0]=r;}
        };
        ProfileCaptureRunner runner=new ProfileCaptureRunner(new Handler(Looper.getMainLooper()),host);
        runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(15));
        assertNotNull(saved[0]);assertTrue(saved[0].hasFailures());assertEquals("failed",status(saved[0],"date_joined"));
        assertFalse(runner.isRunning());
    }
    @Test public void musicAndPromptsBelowTheBioAreNotAccountCategories()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("edlt.shox");
        ProfileAccessibilityExtractor.snapshot(fixture("music")).readHeader(r);
        assertEquals("not_shown",status(r,"category"));
        assertTrue(r.json.isNull("category"));
    }
    @Test public void explicitCountryIsCapturedWithoutConfusingAiGeneratedLabelWithIdentity()throws Exception {
        ProfileCaptureRecord r=new ProfileCaptureRecord("edlt.shox");
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("country"));
        assertTrue(s.isAbout("edlt.shox"));s.readAbout(r,true);
        assertEquals("Tajikistan",r.json.getString("account_based_in"));
        assertEquals("available",status(r,"account_based_in"));
        assertEquals(18,r.json.getInt("former_usernames_count"));
    }
    @Test public void formerDetailRequiresMatchingAccountSentence()throws Exception {
        ProfileAccessibilityExtractor.Snapshot s=ProfileAccessibilityExtractor.snapshot(fixture("former"));
        assertTrue(s.isFormerUsernames());assertEquals(Long.valueOf(18),s.formerUsernameCount("edlt.shox"));
        assertNull(s.formerUsernameCount("different_account"));
    }
    @Test public void oneStartAutomaticallyOpensFormerUsernamesWhenAboutCountIsUnreadable()throws Exception {
        final String[] page={"header"};final ProfileCaptureRecord[] saved={null};
        java.util.List<String> taps=new java.util.ArrayList<>();
        actions=(label,action)->{
            if(action!=AccessibilityNodeInfo.ACTION_CLICK)return false;
            if(label.equals("Options")){page[0]="menu";taps.add(label);return true;}
            if(label.equals("About this account")){page[0]="country";taps.add(label);return true;}
            if(label.equals("Former usernames")){page[0]="former";taps.add(label);return true;}
            if(label.equals("Back")){page[0]=page[0].equals("former")?"country":"header";taps.add(label);return true;}
            return false;
        };
        ProfileCaptureRunner.Host host=new ProfileCaptureRunner.Host(){
            public AccessibilityNodeInfo root(){try{
                if(page[0].equals("header"))return fixture("header","reposted","edlt.shox");
                if(page[0].equals("country"))return fixture("country","text=\"18\"","text=\"\"");
                return fixture(page[0]);
            }catch(Exception e){throw new RuntimeException(e);}}
            public void picture(Rect b,String u,BiConsumer<Object,String> cb){cb.accept(new JSONObject(),null);}
            public boolean back(){throw new AssertionError("This flow uses semantic Back buttons");}
            public void finished(ProfileCaptureRecord r){saved[0]=r;}
        };
        ProfileCaptureRunner runner=new ProfileCaptureRunner(new Handler(Looper.getMainLooper()),host);
        runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));
        assertNotNull(saved[0]);assertFalse(saved[0].failures(),saved[0].hasFailures());
        assertEquals(18,saved[0].json.getInt("former_usernames_count"));
        assertEquals(java.util.Arrays.asList("Options","About this account","Former usernames","Back","Back"),taps);
        assertEquals("header",page[0]);
    }
    @Test public void fullRunnerReturnsToTheOriginalProfileAndResolvesNotShared()throws Exception {
        simulate(false);
    }
    @Test public void verifiedMenuWithoutAboutIsSuccessfulWithUnavailableAboutFields()throws Exception {
        simulate(true);
    }
    private void simulate(boolean withoutAbout)throws Exception {
        final String[] page={"header"};final ProfileCaptureRecord[] saved={null};
        actions=(label,action)->{
            if(action!=AccessibilityNodeInfo.ACTION_CLICK)return false;
            if(label.equals("Options")){page[0]="menu";return true;}
            if(label.equals("About this account")){page[0]="about";return true;}
            if(label.equals("Back")){page[0]="header";return true;}
            return false;
        };
        ProfileCaptureRunner.Host host=new ProfileCaptureRunner.Host(){
            public AccessibilityNodeInfo root(){try{
                return withoutAbout && page[0].equals("menu")?fixture("menu","About this account","Different menu action"):fixture(page[0]);
            }catch(Exception e){throw new RuntimeException(e);}}
            public void picture(Rect b,String u,BiConsumer<Object,String> cb){cb.accept(new JSONObject(),null);}
            public boolean back(){page[0]="header";return true;}
            public void finished(ProfileCaptureRecord r){saved[0]=r;}
        };
        ProfileCaptureRunner runner=new ProfileCaptureRunner(new Handler(Looper.getMainLooper()),host);
        runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));
        assertNotNull(saved[0]);assertFalse(saved[0].failures(),saved[0].hasFailures());
        assertEquals("header",page[0]);assertFalse(runner.isRunning());
        assertEquals("not_shown",status(saved[0],"account_based_in"));
        assertEquals(withoutAbout?"not_shown":"available",status(saved[0],"date_joined"));
    }
}
