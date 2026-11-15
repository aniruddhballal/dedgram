package com.dedgram.collector;

import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Switch;
import android.widget.TextView;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadows.ShadowAlertDialog;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
@LooperMode(LooperMode.Mode.PAUSED)
public class MainScreenTest {
    private ActivityController<MainActivity> controller;
    private MainActivity activity;
    @Before public void setup(){controller=Robolectric.buildActivity(MainActivity.class).setup();activity=controller.get();}
    @After public void teardown(){controller.pause().stop().destroy();}
    @Test public void guidanceIsBehindOneInfoClickInsteadOfOnTheLandingScreen(){
        View root=activity.getWindow().getDecorView();
        assertNotNull(text(root,"BOT SCRAPER"));assertNull(text(root,"PROFILE COLLECTOR"));
        assertNull(text(root,"OPEN ACCESSIBILITY SETTINGS"));assertNull(text(root,"STOP CAPTURE AND TURN ACCESS OFF"));
        assertNull(text(root,"CAPTURE SETUP"));assertNull(text(root,"Storage and privacy"));
        View info=description(root,"App information");assertNotNull(info);info.performClick();
        AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();assertTrue(dialog.isShowing());
        assertNotNull(text(dialog.getWindow().getDecorView(),"Storage and privacy"));
        assertNotNull(text(dialog.getWindow().getDecorView(),"Pending reel queue"));
        assertNotNull(text(dialog.getWindow().getDecorView(),"Capture session"));
    }
    @Test public void enablingRequestsSettingsAndDoesNotPretendAccessIsAlreadyOn(){
        Switch toggle=ReflectionHelpers.getField(activity,"captureToggle");assertFalse(toggle.isChecked());
        toggle.setChecked(true);
        Intent launched=shadowOf(activity).getNextStartedActivity();
        assertEquals(Settings.ACTION_ACCESSIBILITY_SETTINGS,launched.getAction());
        assertTrue(activity.getSharedPreferences("capture_session_request",0).getLong("requested_at",0)>0);
        assertFalse(toggle.isChecked());
        ReflectionHelpers.callInstanceMethod(activity,"refreshCaptureStatus");
        assertNull(shadowOf(activity).getNextStartedActivity());
    }
    @Test public void disablingWithoutActiveServiceOpensSettingsWithoutArmingAnotherSession(){
        String component=new ComponentName(activity,ProfileAccessibilityService.class).flattenToString();
        Settings.Secure.putString(activity.getContentResolver(),Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,component);
        ReflectionHelpers.callInstanceMethod(activity,"refreshCaptureStatus");
        Switch toggle=ReflectionHelpers.getField(activity,"captureToggle");assertTrue(toggle.isChecked());
        assertNull(shadowOf(activity).getNextStartedActivity());
        toggle.setChecked(false);
        assertEquals(Settings.ACTION_ACCESSIBILITY_SETTINGS,shadowOf(activity).getNextStartedActivity().getAction());
        assertEquals(0,activity.getSharedPreferences("capture_session_request",0).getLong("requested_at",0));
        assertTrue(toggle.isChecked()); // Access stays visibly on until Android confirms disablement.
    }
    @Test public void headerIncludesBothTotalsAndSearchDoesNotReplaceThem(){
        ReflectionHelpers.setField(activity,"loadedProfiles",java.util.Arrays.asList(new Profile("one","one","1"),new Profile("two","two","2")));
        ReflectionHelpers.setField(activity,"savedReelCount",3);
        ReflectionHelpers.callInstanceMethod(activity,"updateHeaderCount");
        TextView header=ReflectionHelpers.getField(activity,"headerCount");assertEquals("2 PROFILES / 3 REELS",header.getText().toString());
        android.widget.EditText search=ReflectionHelpers.getField(activity,"searchInput");search.setText("one");
        assertEquals("2 PROFILES / 3 REELS",header.getText().toString());
    }
    private TextView text(View root,String label){
        if(root instanceof TextView && ((TextView)root).getText().toString().equals(label))return (TextView)root;
        if(root instanceof ViewGroup){ViewGroup group=(ViewGroup)root;for(int i=0;i<group.getChildCount();i++){TextView found=text(group.getChildAt(i),label);if(found!=null)return found;}}
        return null;
    }
    private View description(View root,String label){
        if(label.contentEquals(root.getContentDescription()==null?"":root.getContentDescription()))return root;
        if(root instanceof ViewGroup){ViewGroup group=(ViewGroup)root;for(int i=0;i<group.getChildCount();i++){View found=description(group.getChildAt(i),label);if(found!=null)return found;}}
        return null;
    }
}
