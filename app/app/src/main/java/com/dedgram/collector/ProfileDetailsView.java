package com.dedgram.collector;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.util.Base64;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Presents the latest capture, keeping failed extraction distinct from verified absence. */
public final class ProfileDetailsView {
    private static final int MUTED=0xFF666666, ERROR=0xFF9A3412;
    private ProfileDetailsView() {}

    public static View create(Context context, Profile profile) {
        LinearLayout content=column(context);
        if(profile.details.has("capture_status"))appendFields(context,content,profile.details);
        text(context,content,"First saved · "+dateTime(profile.firstSeenAt),11,MUTED,false);
        JSONObject previous=profile.details.optJSONObject("last_successful_capture");
        if(profile.captureFailed() && previous!=null){
            LinearLayout saved=column(context);
            // Build previous values on demand, keeping long catalogs inexpensive to open.
            TextView toggle=UiStyles.button(context,"Show previous successful capture",v->{
                if(saved.getChildCount()==0)appendFields(context,saved,previous);
                boolean show=saved.getVisibility()!=View.VISIBLE;
                saved.setVisibility(show?View.VISIBLE:View.GONE);
                ((TextView)v).setText(show?"HIDE PREVIOUS SUCCESSFUL CAPTURE":"SHOW PREVIOUS SUCCESSFUL CAPTURE");
            },false);
            add(context,content,toggle,10);saved.setVisibility(View.GONE);add(context,content,saved,8);
        }
        return content;
    }

    private static void appendFields(Context context,LinearLayout content,JSONObject details) {
        JSONObject picture=details.optJSONObject("profile_picture");
        if(picture!=null && "available".equals(status(details,"profile_picture"))){
            Bitmap bitmap=decodePicture(picture);
            if(bitmap!=null){
                ImageView image=new ImageView(context);image.setImageBitmap(bitmap);
                image.setContentDescription("Captured profile picture");image.setScaleType(ImageView.ScaleType.CENTER_CROP);
                LinearLayout.LayoutParams size=new LinearLayout.LayoutParams(UiStyles.dp(context,80),UiStyles.dp(context,80));
                size.bottomMargin=UiStyles.dp(context,8);content.addView(image,size);
                text(context,content,"Profile picture · Captured",11,MUTED,false);
            }else text(context,content,"Profile picture · Saved image could not be displayed",12,ERROR,true);
        }else field(context,content,details,"profile_picture","Profile picture");

        field(context,content,details,"display_name","Display name");
        field(context,content,details,"posts_count","Exact posts");
        field(context,content,details,"followers_count","Followers");
        field(context,content,details,"following_count","Following");
        JSONObject analysis=details.optJSONObject("complete_analysis");
        if(analysis!=null){
            String state=analysis.optString("status","partial");
            text(context,content,"Complete analysis · "+(state.equals("complete")?"Complete":state.equals("running")?"Scan unfinished":"Partial"),12,state.equals("complete")?0xFF166534:ERROR,true);
            text(context,content,analysis.isNull("total_reels")?"Reels captured · "+analysis.optInt("captured_count")+" (partial count)":"Total reels · "+analysis.optInt("total_reels"),12,Color.BLACK,true);
            int errors=analysis.optInt("reels_with_errors");if(errors>0)text(context,content,"Reels with field errors · "+errors,12,ERROR,true);
            if(state.equals("partial") && !string(analysis,"detail").isEmpty())text(context,content,string(analysis,"detail"),12,ERROR,false);
            if(analysis.has("updated_at_epoch_ms"))text(context,content,"Analysis updated · "+dateTime(string(analysis,"updated_at_epoch_ms")),11,MUTED,false);
        }
        field(context,content,details,"category","Category");
        field(context,content,details,"account_based_in","Country");
        field(context,content,details,"date_joined","Date joined");
        field(context,content,details,"former_usernames_count","Former usernames");
        field(context,content,details,"bio","Bio");
        field(context,content,details,"profile_header_text","Saved header");
        String navigation=string(details,"navigation_error");
        if(!navigation.isEmpty())text(context,content,"Navigation failed · "+navigation,12,ERROR,true);
        text(context,content,"Captured · "+dateTime(string(details,"fetched_at")),11,MUTED,false);
        String finished=string(details,"capture_finished_at");
        if(!finished.isEmpty())text(context,content,"Finished · "+dateTime(finished),11,MUTED,false);
    }

    private static void field(Context context,LinearLayout content,JSONObject details,String key,String label) {
        String state=status(details,key);
        String value=displayValue(details,key);
        boolean failed="failed".equals(state);
        if(key.equals("profile_header_text") && !failed && !value.equals("Not shown") && !value.equals("Not captured")){
            expandable(context,content,"Show saved header",value);return;
        }
        text(context,content,label+" · "+value, key.equals("bio")?14:12,
                failed?ERROR:"not_shown".equals(state)?MUTED:Color.BLACK,failed);
    }

    static String displayValue(JSONObject details,String key) {
        String state=status(details,key);
        JSONObject availability=details.optJSONObject("field_availability");
        JSONObject field=availability==null?null:availability.optJSONObject(key);
        if("failed".equals(state)){
            String reason=field==null?"":string(field,"error");
            if(reason.isEmpty() && field!=null)reason=string(field,"evidence");
            return reason.isEmpty()?"Failed":"Failed — "+reason;
        }
        if("not_shown".equals(state)){
            JSONObject displayed=details.optJSONObject("posts_count_displayed");
            return key.equals("posts_count") && displayed!=null
                    ? "Not shown (Instagram displays "+string(displayed,"raw")+")":"Not shown";
        }
        if(details.isNull(key))return "Not captured";
        JSONObject metric=details.optJSONObject(key);
        if(metric!=null){
            if(metric.isNull("value"))return "Not captured";
            String raw=string(metric,"raw");
            if(metric.optBoolean("approximate"))return (raw.isEmpty()?string(metric,"value"):raw)+" (rounded)";
            return java.text.NumberFormat.getIntegerInstance().format(metric.optLong("value"));
        }
        String value=string(details,key);
        return value.isEmpty()?"Not captured":value;
    }

    private static String status(JSONObject details,String field) {
        JSONObject availability=details.optJSONObject("field_availability");
        JSONObject state=availability==null?null:availability.optJSONObject(field);
        return state==null?"":state.optString("status","");
    }
    private static String string(JSONObject object,String key){return object.isNull(key)?"":object.optString(key,"");}

    static Bitmap decodePicture(JSONObject picture) {
        try {
            byte[] bytes=Base64.decode(picture.getString("base64"),Base64.DEFAULT);
            byte[] signature={(byte)137,80,78,71,13,10,26,10};
            if(bytes.length<signature.length)return null;
            for(int i=0;i<signature.length;i++)if(bytes[i]!=signature[i])return null;
            BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
            if(options.outWidth<=0 || options.outHeight<=0)return null;
            options.inSampleSize=1;
            while(options.outWidth/options.inSampleSize>320 || options.outHeight/options.inSampleSize>320)options.inSampleSize*=2;
            options.inJustDecodeBounds=false;
            return BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        }catch(Exception error){return null;}
    }

    static String dateTime(String value) {
        if(value==null || value.isEmpty())return "Not captured";
        try {
            Date date;
            if(value.matches("[0-9]+"))date=new Date(Long.parseLong(value));
            else {
                String normalized=value.replaceFirst("(\\.[0-9]{3})[0-9]+Z$","$1Z");
                SimpleDateFormat parser=new SimpleDateFormat(normalized.contains(".")?"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'":"yyyy-MM-dd'T'HH:mm:ss'Z'",Locale.US);
                parser.setTimeZone(TimeZone.getTimeZone("UTC"));parser.setLenient(false);date=parser.parse(normalized);
            }
            return DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.MEDIUM).format(date);
        }catch(Exception error){return value;}
    }

    private static void expandable(Context context,LinearLayout content,String label,String value) {
        TextView source=UiStyles.text(context,value,12,MUTED,false);source.setTextIsSelectable(true);source.setVisibility(View.GONE);
        TextView toggle=UiStyles.button(context,label,v->{
            boolean show=source.getVisibility()!=View.VISIBLE;source.setVisibility(show?View.VISIBLE:View.GONE);
            ((TextView)v).setText(show?"HIDE SAVED HEADER":"SHOW SAVED HEADER");
        },false);
        add(context,content,toggle,10);add(context,content,source,8);
    }
    private static LinearLayout column(Context context){LinearLayout view=new LinearLayout(context);view.setOrientation(LinearLayout.VERTICAL);return view;}
    private static void text(Context context,LinearLayout content,String value,int size,int color,boolean bold){
        TextView view=UiStyles.text(context,value,size,color,bold);view.setTextIsSelectable(true);view.setLineSpacing(UiStyles.dp(context,2),1f);add(context,content,view,6);
    }
    private static void add(Context context,LinearLayout content,View child,int top){
        LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.topMargin=UiStyles.dp(context,top);content.addView(child,params);
    }
}
