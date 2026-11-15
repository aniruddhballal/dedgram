package com.dedgram.collector;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class ProfileDetailsViewTest {
    @Test public void failuresTakePriorityOverStaleValuesAndAbsenceIsSeparate()throws Exception {
        ProfileCaptureRecord record=new ProfileCaptureRecord("owner");
        record.failed("bio","Visible bio could not be expanded");
        record.json.put("bio","stale text");
        record.absent("account_based_in","Not shared");
        assertEquals("Failed — Visible bio could not be expanded",ProfileDetailsView.displayValue(record.json,"bio"));
        assertEquals("Not shown",ProfileDetailsView.displayValue(record.json,"account_based_in"));
        assertEquals("Not captured",ProfileDetailsView.displayValue(new JSONObject(),"bio"));
    }
    @Test public void preservesZeroAndDistinguishesRoundedFromExactMetrics()throws Exception {
        JSONObject details=new JSONObject();
        details.put("following_count",new JSONObject().put("value",0).put("raw","0").put("approximate",false));
        details.put("followers_count",new JSONObject().put("value",26000).put("raw","26K").put("approximate",true));
        assertEquals("0",ProfileDetailsView.displayValue(details,"following_count"));
        assertEquals("26K (rounded)",ProfileDetailsView.displayValue(details,"followers_count"));
        ProfileCaptureRecord record=new ProfileCaptureRecord("owner");record.absent("posts_count","Exact count not shown");
        record.json.put("posts_count_displayed",new JSONObject().put("raw","1.2K"));
        assertEquals("Not shown (Instagram displays 1.2K)",ProfileDetailsView.displayValue(record.json,"posts_count"));
    }
    @Test public void savedHeaderAndPreviousCaptureExpandWithoutMixingLatestFailure()throws Exception {
        Context context=RuntimeEnvironment.getApplication();
        ProfileCaptureRecord record=new ProfileCaptureRecord("owner");
        for(String field:ProfileCaptureRecord.FIELDS)record.absent(field,"Not shown");
        record.available("profile_header_text","Original header text","Verified header");
        record.failed("bio","Current bio unreadable");
        JSONObject previous=new JSONObject().put("bio","Earlier bio").put("fetched_at","2026-11-15T04:44:00Z");
        record.json.put("last_successful_capture",previous);
        View content=ProfileDetailsView.create(context,record.finish());
        assertNotNull(find(content,"Bio · Failed — Current bio unreadable"));
        TextView header=find(content,"Original header text");assertEquals(View.GONE,header.getVisibility());
        find(content,"SHOW SAVED HEADER").performClick();assertEquals(View.VISIBLE,header.getVisibility());
        assertNull(find(content,"Bio · Earlier bio"));
        find(content,"SHOW PREVIOUS SUCCESSFUL CAPTURE").performClick();assertNotNull(find(content,"Bio · Earlier bio"));
    }
    @Test public void timestampsSupportLegacyEpochAndMicrosecondsAndBadImagesDoNotCrash()throws Exception {
        assertEquals(ProfileDetailsView.dateTime("2026-11-15T04:44:46.836Z"),ProfileDetailsView.dateTime("2026-11-15T04:44:46.836740Z"));
        assertFalse(ProfileDetailsView.dateTime("1794717891201").equals("1794717891201"));
        assertNull(ProfileDetailsView.decodePicture(new JSONObject().put("base64","broken image")));
        View legacy=ProfileDetailsView.create(RuntimeEnvironment.getApplication(),new Profile("owner","owner","1794717891201"));
        assertNull(find(legacy,"Bio · Not captured"));
    }
    @Test public void partialAnalysisCountIsNotPresentedAsAConfirmedTotal()throws Exception {
        ProfileCaptureRecord record=new ProfileCaptureRecord("owner");
        JSONObject analysis=new JSONObject().put("status","partial").put("captured_count",7).put("total_reels",JSONObject.NULL).put("scan_complete",false);
        record.json.put("complete_analysis",analysis);
        View partial=ProfileDetailsView.create(RuntimeEnvironment.getApplication(),record.finish());
        assertNotNull(find(partial,"Reels captured · 7 (partial count)"));assertNull(find(partial,"Total reels · 7"));
        analysis.put("status","complete").put("total_reels",11).put("scan_complete",true);
        View complete=ProfileDetailsView.create(RuntimeEnvironment.getApplication(),record.finish());
        assertNotNull(find(complete,"Total reels · 11"));assertNull(find(complete,"Reels captured · 7 (partial count)"));
    }
    private TextView find(View view,String text){
        if(view instanceof TextView && ((TextView)view).getText().toString().equals(text))return (TextView)view;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){TextView found=find(group.getChildAt(i),text);if(found!=null)return found;}}
        return null;
    }
}
