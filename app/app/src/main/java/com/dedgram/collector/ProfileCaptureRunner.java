package com.dedgram.collector;

import android.graphics.Rect;
import android.os.Handler;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.function.BiConsumer;

/** A bounded, serialized capture; every action uses the active Instagram window. */
public final class ProfileCaptureRunner {
    public interface Host {
        AccessibilityNodeInfo root();
        void picture(Rect bounds, String username, BiConsumer<Object,String> result);
        boolean back();
        void finished(ProfileCaptureRecord record);
    }
    private final Handler handler;
    private final Host host;
    private ProfileCaptureRecord record;
    private boolean running;
    private int attempts, scrolls;
    private String previous="";
    private boolean bioExpanded;
    private boolean formerAttempted;
    public ProfileCaptureRunner(Handler handler,Host host){this.handler=handler;this.host=host;}
    public boolean isRunning(){return running;}
    public void start(){if(running)return;running=true;header();}
    public void cancel(){if(running){if(record!=null)record.failUnverified("Capture session ended before verification.");finish();}}
    private void later(Runnable task){handler.postDelayed(()->{if(running)task.run();},600L);}
    private void reset(){attempts=0;previous="";}
    private boolean stable(String value){boolean match=value.equals(previous);previous=value;return match;}
    private void fail(String message){
        if(record!=null){record.failUnverified(message);ProfileCaptureRecord.put(record.json,"navigation_error",message);}
        finish();
    }
    private void header(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::header);else fail("Could not read the active profile header.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        android.util.Log.i("dedgramProfile", "Header verification attempt="+attempts+" username="+snapshot.username
                +" header="+(snapshot.header!=null)+" metrics="+(snapshot.tree.id("profile_header_metrics_full_width")!=null)
                +" actions="+(snapshot.tree.id("profile_header_actions_top_row")!=null));
        if(record==null && snapshot.isHeader(snapshot.username) && !snapshot.username.isEmpty())record=new ProfileCaptureRecord(snapshot.username);
        if(record==null || !snapshot.isHeader(record.username)){
            root.recycle();if(++attempts<8)later(this::header);else fail("Open a profile at its header before capturing.");return;
        }
        if(snapshot.bioTruncated() && !bioExpanded){
            bioExpanded=true;
            boolean opened=ProfileAccessibilityExtractor.expandBio(root);root.recycle();
            if(!opened)record.failed("bio","Visible truncated bio could not be expanded using its control.");
            reset();later(this::header);return;
        }
        root.recycle();
        if(!stable(snapshot.headerText())){if(++attempts<8)later(this::header);else fail("Profile header did not stabilize.");return;}
        snapshot.readHeader(record);
        Rect picture=snapshot.pictureBounds();
        reset();
        if(picture==null || picture.isEmpty()){
            record.failed("profile_picture","Profile picture control was not accessible.");openMenu();return;
        }
        final boolean[] pictureFinished={false};
        laterPictureTimeout(pictureFinished);
        host.picture(picture,record.username,(value,error)->{
            if(!running || pictureFinished[0])return;
            pictureFinished[0]=true;
            if(error!=null)record.failed("profile_picture",error);
            else record.available("profile_picture",value,"PNG crop of visible profile avatar from the verified header; not an original image URL.");
            openMenu();
        });
    }
    private void laterPictureTimeout(boolean[] finished) {
        handler.postDelayed(()->{
            if(running && !finished[0]){
                finished[0]=true;record.failed("profile_picture","Visible avatar capture timed out.");openMenu();
            }
        },5_000L);
    }
    private void openMenu(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){fail("Profile disappeared before Options could open.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        boolean opened=snapshot.isHeader(record.username) && ProfileAccessibilityExtractor.click(root,"Options");
        root.recycle();
        if(!opened){fail("Could not open the profile Options control.");return;}
        reset();later(this::menu);
    }
    private void menu(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::menu);else fail("Profile menu did not load.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        boolean menu=snapshot.tree.find(n->n.text.equals("Copy profile URL") || n.description.equals("Copy profile URL"))!=null;
        if(!menu || !stable(snapshot.fingerprint())){
            root.recycle();if(++attempts<8)later(this::menu);else fail("Profile menu was not verified or did not stabilize.");return;
        }
        boolean hasAbout=snapshot.tree.find(n->n.text.equals("About this account") || n.description.equals("About this account"))!=null;
        if(!hasAbout){
            root.recycle();
            for(String field:new String[]{"account_based_in","date_joined","former_usernames_count"})record.absent(field,"About this account is absent from the verified profile Options menu.");
            if(!host.back()){fail("Could not dismiss the verified profile Options menu.");return;}
            reset();later(this::returned);return;
        }
        boolean clicked=ProfileAccessibilityExtractor.click(root,"About this account");root.recycle();
        if(!clicked){fail("Visible About this account control could not be opened.");return;}
        reset();later(this::about);
    }
    private void about(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::about);else fail("About this account did not load.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        if(!snapshot.isAbout(record.username) || !stable(snapshot.fingerprint())){
            root.recycle();if(++attempts<8)later(this::about);else fail("About screen identity or stable content could not be verified.");return;
        }
        snapshot.readAbout(record,false);
        // Read all visible About rows and use semantic scroll only within this verified page.
        if(snapshot.canScrollAbout() && scrolls<4 && ProfileAccessibilityExtractor.scrollAbout(root)){
            scrolls++;root.recycle();reset();later(this::about);return;
        }
        boolean endVerified=!snapshot.canScrollAbout() || scrolls<4;
        for(String field:new String[]{"account_based_in","date_joined","former_usernames_count"}){
            org.json.JSONObject state=record.json.optJSONObject("field_availability").optJSONObject(field);
            if("failed".equals(state.optString("status")) && state.optString("evidence").equals("Capture has not verified this field.")){
                if(endVerified)record.absent(field,"Row absent from fully inspected, stable About this account screen.");
                else record.failed(field,"About screen inspection did not reach the end; absence is unverified.");
            }
        }
        org.json.JSONObject formerState=record.json.optJSONObject("field_availability").optJSONObject("former_usernames_count");
        if(!formerAttempted && "failed".equals(formerState.optString("status"))
                && snapshot.tree.find(n->n.text.equalsIgnoreCase("Former usernames"))!=null){
            formerAttempted=true;
            boolean opened=ProfileAccessibilityExtractor.click(root,"Former usernames");
            if(opened){root.recycle();reset();later(this::formerUsernames);return;}
            record.failed("former_usernames_count","Visible Former usernames row could not be opened to read its count.");
        }
        boolean back=ProfileAccessibilityExtractor.click(root,"Back");root.recycle();
        if(!back){fail("Could not return from the verified About screen.");return;}
        reset();later(this::returned);
    }
    private void formerUsernames(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::formerUsernames);else fail("Former usernames screen did not load.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        Long count=snapshot.formerUsernameCount(record.username);
        if(!snapshot.isFormerUsernames() || count==null || !stable(snapshot.fingerprint())){
            root.recycle();if(++attempts<8)later(this::formerUsernames);else fail("Could not verify Former usernames count for the captured account.");return;
        }
        record.available("former_usernames_count",count,"Former usernames detail screen; matching account sentence on two stable observations.");
        record.available("former_usernames_text",snapshot.fingerprint(),"Former usernames detail evidence.");
        boolean back=ProfileAccessibilityExtractor.click(root,"Back");root.recycle();
        if(!back){fail("Could not return from Former usernames to About this account.");return;}
        reset();later(this::returnedToAbout);
    }
    private void returnedToAbout(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::returnedToAbout);else fail("Could not return to About this account.");return;}
        ProfileAccessibilityExtractor.Snapshot snapshot=ProfileAccessibilityExtractor.snapshot(root);
        if(!snapshot.isAbout(record.username)){
            root.recycle();if(++attempts<8)later(this::returnedToAbout);else fail("About screen identity changed after Former usernames.");return;
        }
        boolean back=ProfileAccessibilityExtractor.click(root,"Back");root.recycle();
        if(!back){fail("Could not return from About this account to the profile.");return;}
        reset();later(this::returned);
    }
    private void returned(){
        AccessibilityNodeInfo root=host.root();
        boolean match=root!=null && ProfileAccessibilityExtractor.snapshot(root).isHeader(record.username);
        if(root!=null)root.recycle();
        if(!match){if(++attempts<8)later(this::returned);else fail("Could not verify return to the original profile.");return;}
        finish();
    }
    private void finish(){if(!running)return;running=false;host.finished(record);}
}
