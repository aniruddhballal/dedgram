package com.dedgram.collector;

import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Selectors verified on the Android profile header and About this account screen. */
public final class ProfileAccessibilityExtractor {
    private ProfileAccessibilityExtractor() {}

    static final class Node {
        final String id, text, description;
        final Rect bounds = new Rect();
        final boolean clickable, scrollable;
        final List<Node> children = new ArrayList<>();
        Node(AccessibilityNodeInfo node) {
            id = String.valueOf(node.getViewIdResourceName());
            text = node.getText() == null ? "" : node.getText().toString().trim();
            description = node.getContentDescription() == null ? "" : node.getContentDescription().toString().trim();
            clickable = node.isClickable(); scrollable = node.isScrollable();
            node.getBoundsInScreen(bounds);
            for (int i=0; i<node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) { if(child.isVisibleToUser())children.add(new Node(child)); child.recycle(); }
            }
        }
        Node find(Predicate<Node> test) {
            if (test.test(this)) return this;
            for (Node child: children) { Node result=child.find(test); if(result!=null)return result; }
            return null;
        }
        Node id(String suffix) { return find(n -> n.id.endsWith(":id/"+suffix)); }
        void texts(List<String> values) {
            if (!text.isEmpty()) values.add(text);
            else if (!description.isEmpty()) values.add(description);
            for(Node child:children)child.texts(values);
        }
        String textTree() { List<String> lines=new ArrayList<>(); texts(lines); return String.join("\n",lines); }
    }

    public static final class Snapshot {
        final Node tree, header, info;
        public final String username;
        Snapshot(AccessibilityNodeInfo root) {
            tree = new Node(root);
            Node title=tree.id("action_bar_title");
            username=title==null ? "" : ProfileStore.normalizeUsername(title.text);
            header=tree.id("row_profile_header");
            info=tree.id("profile_user_info_compose_view");
        }
        public boolean isHeader(String expected) {
            return username.equals(expected) && header!=null && tree.id("profile_header_metrics_full_width")!=null
                    && tree.id("profile_header_actions_top_row")!=null && header.bounds.top>=0;
        }
        public boolean isAbout(String expected) {
            Node title=tree.id("action_bar_title");
            return title!=null && title.text.equalsIgnoreCase("About this account")
                    && tree.find(n->n.text.equalsIgnoreCase(expected))!=null
                    && tree.find(n->n.text.startsWith("To help keep our community authentic"))!=null;
        }
        public String headerText() { return header==null ? "" : username+"\n"+header.textTree(); }
        public String fingerprint() { return tree.textTree(); }
        public Rect pictureBounds() {
            Node image=tree.id("row_profile_header_imageview"); return image==null?null:new Rect(image.bounds);
        }
        Node bio() {
            if(info==null)return null;
            // Compose bio is inside a clickable text group; category is its nonclickable sibling.
            Node group=info.find(n->n.clickable && n.find(c->!c.text.isEmpty() && !c.text.equals("See translation"))!=null);
            return group==null?null:group.find(n->!n.text.isEmpty() && !n.text.equals("See translation"));
        }
        public boolean bioTruncated() { Node bio=bio(); return bio!=null && bio.text.matches("(?s).*(?:…|\\.\\.\\.)\\s*more$"); }
        public void readHeader(ProfileCaptureRecord record) {
            record.available("profile_header_text",headerText(),"Active profile header; two matching observations at least 500 ms apart.");
            metric(record,"posts_count","profile_header_familiar_post_count_value",true);
            metric(record,"followers_count","profile_header_familiar_followers_value",false);
            metric(record,"following_count","profile_header_familiar_following_value",false);
            Node fullName=tree.id("profile_header_full_name_above_vanity");
            if(fullName==null)record.absent("display_name","No display-name row in the verified familiar profile header.");
            else if(fullName.text.isEmpty())record.failed("display_name","Display-name row exists but its text is unreadable.");
            else record.available("display_name",fullName.text,"profile_header_full_name_above_vanity");
            if(info==null) {
                boolean unknownText=false;
                for(Node child:header.children)if(!child.id.contains("profile_header_") && !child.id.contains("row_profile_header_") && !child.textTree().isEmpty())unknownText=true;
                if(unknownText){
                    record.failed("bio","Unrecognized profile information layout; absence cannot be established.");
                    record.failed("category","Unrecognized profile information layout; absence cannot be established.");
                }else{
                    record.absent("bio","Profile header has no information container or bio text on two stable observations.");
                    record.absent("category","Profile header has no information container or category text on two stable observations.");
                }
                return;
            }
            Node bio=bio();
            if(bio==null) {
                if(info.find(n->n.clickable)==null)record.absent("bio","Verified profile information container has no bio text group.");
                else record.failed("bio","Unrecognized profile information layout; could not identify bio separately.");
            } else if(bioTruncated())record.failed("bio","Bio is still truncated after expansion.");
            else record.available("bio",bio.text,"Expanded original-language bio in profile_user_info_compose_view.");
            // Category precedes the bio. Music, links, prompts and other text below it are not categories.
            Node category=info.find(n->!n.clickable && !n.text.isEmpty() && !n.text.equals("See translation") && n!=bio
                    && (bio==null || n.bounds.bottom<=bio.bounds.top) && !n.text.equalsIgnoreCase("AI-generated profile"));
            if(category==null)record.absent("category","No separate category text in the verified profile information container.");
            else record.available("category",category.text,"Separate non-bio text in profile_user_info_compose_view.");
        }
        void metric(ProfileCaptureRecord record,String field,String id,boolean exact) {
            Node value=tree.id(id);
            if(value==null){record.failed(field,"Expected profile metric value control is missing; unknown layout or unreadable count.");return;}
            Matcher match=Pattern.compile("(?i)^([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*([KMB])?$").matcher(value.text.replace("\u00a0"," "));
            if(!match.matches()){record.failed(field,"Visible metric is not parseable: "+value.text);return;}
            String suffix=match.group(2);
            JSONObject metric=new JSONObject();
            double scale=suffix==null?1:suffix.equalsIgnoreCase("K")?1e3:suffix.equalsIgnoreCase("M")?1e6:1e9;
            double parsed=Double.parseDouble(match.group(1).replace(",",""))*scale;
            if(!Double.isFinite(parsed) || parsed<0 || parsed>9007199254740991d || (suffix==null && parsed!=Math.rint(parsed))) {
                record.failed(field,"Invalid displayed count: "+value.text);return;
            }
            ProfileCaptureRecord.put(metric,"value",Math.round(parsed));
            ProfileCaptureRecord.put(metric,"raw",value.text);
            ProfileCaptureRecord.put(metric,"approximate",suffix!=null);
            if(exact && suffix!=null){
                ProfileCaptureRecord.put(record.json,"posts_count_displayed",metric);
                record.absent(field,"Instagram exposes only a rounded posts count; exact count is not shown. Displayed value retained separately.");
            }else record.available(field,metric,id+"; displayed count captured without inventing precision.");
        }
        public void readAbout(ProfileCaptureRecord record, boolean endVerified) {
            record.available("about_text",tree.textTree(),"Verified About this account screen for @"+record.username);
            aboutField(record,"date_joined","Date joined",false,endVerified);
            aboutField(record,"account_based_in","Account based in",false,endVerified);
            aboutField(record,"former_usernames_count","Former usernames",true,endVerified);
        }
        void aboutField(ProfileCaptureRecord record,String field,String label,boolean numeric,boolean endVerified) {
            Node labelNode=tree.find(n->n.text.equalsIgnoreCase(label));
            if(labelNode==null){
                if(endVerified)record.absent(field,"Row absent from the fully inspected, stable About screen: "+label);
                return;
            }
            Node row=findParent(tree,labelNode);
            List<String> values=new ArrayList<>(); if(row!=null)for(Node child:row.children)child.texts(values);
            String value="";
            for(String text:values)if(!text.equalsIgnoreCase(label)){value=text;break;}
            if(value.isEmpty()) {record.failed(field,"Visible "+label+" row has no readable value.");return;}
            if(value.matches("(?i)not shared|not available|not shown"))record.absent(field,label+" explicitly displays: "+value);
            else if(numeric){
                if(value.matches("[0-9][0-9,]*")){
                    try {record.available(field,Long.parseLong(value.replace(",","")),label+" row: "+value);}
                    catch(NumberFormatException e){record.failed(field,"Invalid former username count: "+value);}
                }else record.failed(field,"Visible former usernames count is unreadable: "+value);
            }else if(field.equals("date_joined") && !value.matches("(?i)(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}"))
                record.failed(field,"Unrecognized visible join date: "+value);
            else record.available(field,value,label+" row");
        }
        public boolean canScrollAbout() {
            Node content=tree.id("bloks_container");
            return content!=null && content.find(n->n.scrollable)!=null;
        }
        public boolean isFormerUsernames() {
            Node title=tree.id("action_bar_title");
            return title!=null && title.text.equalsIgnoreCase("Former usernames");
        }
        public Long formerUsernameCount(String expected) {
            Pattern sentence=Pattern.compile("^"+Pattern.quote(expected)+" has changed (?:their|its) username ([0-9][0-9,]*) times?\\.?$",Pattern.CASE_INSENSITIVE);
            Node value=tree.find(n->sentence.matcher(n.text).matches());
            if(value==null)return null;
            Matcher match=sentence.matcher(value.text);
            if(!match.matches())return null;
            try{return Long.parseLong(match.group(1).replace(",",""));}catch(NumberFormatException error){return null;}
        }
    }
    static Node findParent(Node node,Node child) {
        if(node.children.contains(child))return node;
        for(Node n:node.children){Node parent=findParent(n,child);if(parent!=null)return parent;}
        return null;
    }
    public static Snapshot snapshot(AccessibilityNodeInfo root) {return new Snapshot(root);}
    public static boolean click(AccessibilityNodeInfo root,String label) {
        return action(root,n->label.equalsIgnoreCase(String.valueOf(n.getText())) || label.equalsIgnoreCase(String.valueOf(n.getContentDescription())),AccessibilityNodeInfo.ACTION_CLICK,true);
    }
    public static boolean expandBio(AccessibilityNodeInfo root) {
        return action(root,n->n.getText()!=null && n.getText().toString().matches("(?s).*(?:…|\\.\\.\\.)\\s*more$"),AccessibilityNodeInfo.ACTION_CLICK,true);
    }
    public static boolean scrollAbout(AccessibilityNodeInfo root) {
        return scrollAboutContent(root);
    }
    private static boolean scrollAboutContent(AccessibilityNodeInfo node) {
        if(!node.isVisibleToUser())return false;
        if(String.valueOf(node.getViewIdResourceName()).endsWith(":id/bloks_container"))
            return action(node,AccessibilityNodeInfo::isScrollable,AccessibilityNodeInfo.ACTION_SCROLL_FORWARD,false);
        for(int i=0;i<node.getChildCount();i++){
            AccessibilityNodeInfo child=node.getChild(i);
            if(child!=null){boolean moved=scrollAboutContent(child);child.recycle();if(moved)return true;}
        }
        return false;
    }
    private static boolean action(AccessibilityNodeInfo node,Predicate<AccessibilityNodeInfo> test,int action,boolean ancestors) {
        if(!node.isVisibleToUser())return false;
        if(test.test(node)){
            if(node.performAction(action))return true;
            if(ancestors){
                AccessibilityNodeInfo parent=node.getParent();
                for(int depth=0;parent!=null && depth<3;depth++){
                    boolean ok=parent.isClickable() && parent.performAction(action);
                    AccessibilityNodeInfo next=ok?null:parent.getParent();parent.recycle();parent=next;
                    if(ok)return true;
                }
                if(parent!=null)parent.recycle();
            }
        }
        for(int i=0;i<node.getChildCount();i++){
            AccessibilityNodeInfo child=node.getChild(i);
            if(child!=null){boolean ok=action(child,test,action,ancestors);child.recycle();if(ok)return true;}
        }
        return false;
    }
}
