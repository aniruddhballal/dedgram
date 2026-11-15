package com.dedgram.collector;

import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.List;

/** Only profile-owned grid controls and the reel viewer's semantic paging actions. */
public final class CompleteAnalysisExtractor {
    private CompleteAnalysisExtractor() {}
    public static final class Viewer {
        public String owner="",signature="",issue;
        public boolean viewer,loading,forward;
        public int count=-1,index=-1;
    }
    public static Viewer viewer(AccessibilityNodeInfo root){
        Viewer v=new Viewer();ReelAccessibilityExtractor.Snapshot s=ReelAccessibilityExtractor.snapshot(root);
        v.viewer=s.isLikelyReel() && !s.hasCaptionSheet() && !s.hasLikesAndPlaysSheet() && !ReelLink.hasShareSheet(root);
        v.owner=ProfileStore.normalizeUsername(s.account());v.signature=ReelLink.fingerprint(root);v.issue=s.queueIssue();
        AccessibilityNodeInfo pager=find(root,"clips_viewer_view_pager");
        if(pager!=null){Rect viewport=new Rect();pager.getBoundsInScreen(viewport);metadata(pager,v,viewport);pager.recycle();}
        v.loading=containsLoading(root);
        return v;
    }
    private static void metadata(AccessibilityNodeInfo node,Viewer v,Rect viewport){
        Rect bounds=new Rect();node.getBoundsInScreen(bounds);
        AccessibilityNodeInfo.CollectionInfo collection=node.getCollectionInfo();
        if(bounds.equals(viewport) && collection!=null && collection.getRowCount()>0 && collection.getColumnCount()>0){
            int count=collection.getRowCount()*collection.getColumnCount();if(count>v.count)v.count=count;
        }
        AccessibilityNodeInfo.CollectionItemInfo item=node.getCollectionItemInfo();
        if(item!=null && item.getRowIndex()>=0 && node.isVisibleToUser() && bounds.contains(viewport.centerX(),viewport.centerY()))v.index=item.getRowIndex();
        if(bounds.equals(viewport) && (node.getActions()&AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)!=0)v.forward=true;
        for(int i=0;i<node.getChildCount();i++){
            AccessibilityNodeInfo child=node.getChild(i);if(child!=null){metadata(child,v,viewport);child.recycle();}
        }
    }
    private static boolean containsLoading(AccessibilityNodeInfo node){
        if(node.isVisibleToUser()){
            String text=String.valueOf(node.getText()),desc=String.valueOf(node.getContentDescription());
            if(String.valueOf(node.getClassName()).contains("ProgressBar") || text.matches("(?i)loading(?:…|\\.\\.\\.)?" ) || desc.equalsIgnoreCase("Loading"))return true;
        }
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){boolean result=containsLoading(child);child.recycle();if(result)return true;}}
        return false;
    }
    public static boolean loading(AccessibilityNodeInfo root){return containsLoading(root);}
    public static boolean selectedReels(AccessibilityNodeInfo root){
        return tab(root,false);
    }
    public static boolean openReels(AccessibilityNodeInfo root){return tab(root,true);}
    private static boolean tab(AccessibilityNodeInfo node,boolean click){
        if(String.valueOf(node.getViewIdResourceName()).endsWith(":id/profile_tab_icon_view") && "Reels".contentEquals(node.getContentDescription()==null?"":node.getContentDescription())){
            if(!click)return node.isSelected() || parentSelected(node);
            return click(node);
        }
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){boolean result=tab(child,click);child.recycle();if(result)return true;}}
        return false;
    }
    private static boolean parentSelected(AccessibilityNodeInfo node){AccessibilityNodeInfo parent=node.getParent();if(parent==null)return false;boolean selected=parent.isSelected();parent.recycle();return selected;}
    public static boolean openFirst(AccessibilityNodeInfo root){
        List<AccessibilityNodeInfo> tiles=new ArrayList<>();tiles(root,tiles);AccessibilityNodeInfo first=null;
        Rect best=new Rect();
        for(AccessibilityNodeInfo tile:tiles){Rect bounds=new Rect();tile.getBoundsInScreen(bounds);if(first==null || bounds.top<best.top || bounds.top==best.top && bounds.left<best.left){first=tile;best=bounds;}}
        boolean opened=first!=null && click(first);for(AccessibilityNodeInfo tile:tiles)tile.recycle();return opened;
    }
    public static int rewindGrid(AccessibilityNodeInfo root){
        AccessibilityNodeInfo grid=find(root,"clips_grid_recyclerview");if(grid==null)return 0;
        if((grid.getActions()&AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)==0){grid.recycle();return 0;}
        boolean moved=grid.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);grid.recycle();return moved?1:-1;
    }
    public static boolean emptyGrid(AccessibilityNodeInfo root){
        if(!selectedReels(root))return false;
        return exactText(root,"No reels yet") || exactText(root,"No reels") || exactText(root,"No videos yet");
    }
    private static boolean exactText(AccessibilityNodeInfo node,String text){
        if(text.equalsIgnoreCase(String.valueOf(node.getText())))return true;
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){boolean result=exactText(child,text);child.recycle();if(result)return true;}}
        return false;
    }
    private static void tiles(AccessibilityNodeInfo node,List<AccessibilityNodeInfo> result){
        if(String.valueOf(node.getViewIdResourceName()).endsWith(":id/preview_clip_thumbnail") && node.isVisibleToUser())result.add(AccessibilityNodeInfo.obtain(node));
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){tiles(child,result);child.recycle();}}
    }
    public static boolean advance(AccessibilityNodeInfo root){
        AccessibilityNodeInfo pager=find(root,"clips_viewer_view_pager");if(pager==null)return false;
        boolean result=pager.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
        if(!result)result=scrollChildren(pager);pager.recycle();return result;
    }
    private static boolean scrollChildren(AccessibilityNodeInfo root){
        for(int i=0;i<root.getChildCount();i++){
            AccessibilityNodeInfo child=root.getChild(i);if(child==null)continue;
            boolean result=child.isScrollable() && child.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
            if(!result)result=scrollChildren(child);child.recycle();if(result)return true;
        }
        return false;
    }
    private static AccessibilityNodeInfo find(AccessibilityNodeInfo node,String id){
        if(String.valueOf(node.getViewIdResourceName()).endsWith(":id/"+id))return AccessibilityNodeInfo.obtain(node);
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){AccessibilityNodeInfo result=find(child,id);child.recycle();if(result!=null)return result;}}
        return null;
    }
    private static boolean click(AccessibilityNodeInfo node){
        if(node.performAction(AccessibilityNodeInfo.ACTION_CLICK))return true;
        AccessibilityNodeInfo parent=node.getParent();
        for(int i=0;parent!=null && i<3;i++){
            boolean result=parent.isClickable() && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            AccessibilityNodeInfo next=result?null:parent.getParent();parent.recycle();parent=next;if(result)return true;
        }
        if(parent!=null)parent.recycle();return false;
    }
}
