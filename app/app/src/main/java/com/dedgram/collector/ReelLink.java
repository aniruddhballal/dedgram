package com.dedgram.collector;

import android.view.accessibility.AccessibilityNodeInfo;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Only canonical destinations survive; share parameters and clipboard prose are never stored. */
public final class ReelLink {
    private ReelLink() {}
    public static String canonical(String text) throws Exception {
        Matcher links=Pattern.compile("https://(?:www\\.)?instagram\\.com/[^\\s<>\"']+",Pattern.CASE_INSENSITIVE).matcher(text==null?"":text);
        String result=null;
        while(links.find()){
            String candidate=PendingReels.canonicalUrl(links.group());
            if(result!=null && !result.equals(candidate))throw new Exception("Copied text contains different reel links.");
            result=candidate;
        }
        if(result==null)throw new Exception("Copy link did not expose a valid Instagram reel URL.");
        return result;
    }
    public static String fingerprint(AccessibilityNodeInfo root){
        ReelAccessibilityExtractor.Snapshot s=ReelAccessibilityExtractor.snapshot(root);
        return s.isLikelyReel() && !s.hasCaptionSheet() && !s.hasLikesAndPlaysSheet()
                ? s.account()+"\n"+s.caption()+"\n"+s.metric("like")+"\n"+s.metric("comment"):"";
    }
    public static boolean isAd(AccessibilityNodeInfo root){
        String id=String.valueOf(root.getViewIdResourceName());
        if((id.endsWith(":id/clips_video_container") || id.endsWith(":id/clips_media_component"))
                && String.valueOf(root.getContentDescription()).startsWith("Sponsored Reel by "))return true;
        for(int i=0;i<root.getChildCount();i++){
            AccessibilityNodeInfo child=root.getChild(i);
            if(child!=null){boolean ad=isAd(child);child.recycle();if(ad)return true;}
        }
        return false;
    }
    public static boolean hasCopy(AccessibilityNodeInfo root){return control(root,"button","Copy link",false) || control(root,"label","Copy link",false);}
    public static boolean copy(AccessibilityNodeInfo root){return control(root,"button","Copy link",true) || control(root,"label","Copy link",true);}
    public static boolean share(AccessibilityNodeInfo root){return control(root,"direct_share_button","Share",true);}
    public static boolean dismiss(AccessibilityNodeInfo root){return control(root,"background_dimmer","Dismiss",true);}
    public static boolean hasShareSheet(AccessibilityNodeInfo root){return control(root,"background_dimmer","Dismiss",false);}
    private static boolean control(AccessibilityNodeInfo root,String id,String label,boolean click){
        if(("com.instagram.android:id/"+id).equals(root.getViewIdResourceName()) && root.isVisibleToUser()
                && (label.equalsIgnoreCase(String.valueOf(root.getText())) || label.equalsIgnoreCase(String.valueOf(root.getContentDescription())))){
                boolean result=!click || root.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                if(click && !result){
                    AccessibilityNodeInfo parent=root.getParent();
                    for(int i=0;parent!=null && i<3;i++){
                        boolean ok=parent.isClickable() && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                        AccessibilityNodeInfo next=ok?null:parent.getParent();parent.recycle();parent=next;
                        if(ok){result=true;break;}
                    }
                    if(parent!=null)parent.recycle();
                }
                if(result)return true;
        }
        for(int i=0;i<root.getChildCount();i++){
            AccessibilityNodeInfo child=root.getChild(i);
            if(child!=null){boolean result=control(child,id,label,click);child.recycle();if(result)return true;}
        }
        return false;
    }
}
