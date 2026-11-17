package com.dedgram.collector;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.util.ReflectionHelpers;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
@LooperMode(LooperMode.Mode.PAUSED)
public class QuickBallOverlayTest {
    private Context context;
    private QuickBallOverlay ball;
    private final List<String> invoked=new ArrayList<>();
    private QuickBallOverlay create(){
        return new QuickBallOverlay(context,(WindowManager)context.getSystemService(Context.WINDOW_SERVICE),new Handler(Looper.getMainLooper()),new QuickBallOverlay.Actions(){
            public void profile(TextView source){assertFalse(ball.expanded());invoked.add("profile");}
            public void reel(TextView source){assertFalse(ball.expanded());invoked.add("reel");}
            public void analysis(){assertFalse(ball.expanded());invoked.add("analysis");}
        });
    }
    @Before public void setup(){context=RuntimeEnvironment.getApplication();context.getSharedPreferences("quick_ball_position",0).edit().clear().commit();ball=create();ball.show();}
    @After public void teardown(){ball.dispose();}
    @Test public void outsideDismissalNeverInvokesCaptureAndMenuCanReopen(){
        ball.handle.performClick();assertTrue(ball.expanded());
        FrameLayout panel=ReflectionHelpers.getField(ball,"menu");panel.performClick();assertFalse(ball.expanded());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(300));assertTrue(invoked.isEmpty());
        ball.handle.performClick();assertTrue(ball.expanded());
    }
    @Test public void eachActionCollapsesBeforeDispatchAndKeepsItsOriginalMeaning(){
        for(TextView action:new TextView[]{ball.profileButton,ball.reelButton,ball.analysisButton}){
            ball.expand();action.performClick();assertFalse(ball.expanded());
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(110));
        }
        assertEquals(java.util.Arrays.asList("profile","reel","analysis"),invoked);
    }
    @Test public void sessionEndingCancelsPendingSelection(){
        ball.expand();ball.analysisButton.performClick();ball.dispose();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1));assertTrue(invoked.isEmpty());
    }
    @Test public void busyCaptureCannotStartAnotherActionAndAvatarCaptureHidesMenu(){
        ball.expand();ball.state(true,true);ball.reelButton.performClick();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(200));assertTrue(invoked.isEmpty());
        ball.hidden(true);assertFalse(ball.expanded());assertEquals(android.view.View.INVISIBLE,ball.handle.getVisibility());
        ball.hidden(false);assertEquals(android.view.View.VISIBLE,ball.handle.getVisibility());
    }
    @Test public void draggingDocksAndSurvivesRecreationWithoutSelectingAnAction(){
        WindowManager.LayoutParams initial=ReflectionHelpers.getField(ball,"position");int width=context.getResources().getDisplayMetrics().widthPixels;
        ball.handle.dispatchTouchEvent(MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,8,initial.y+12,0));
        ball.handle.dispatchTouchEvent(MotionEvent.obtain(0,100,MotionEvent.ACTION_MOVE,width-8,initial.y+80,0));
        ball.handle.dispatchTouchEvent(MotionEvent.obtain(0,120,MotionEvent.ACTION_UP,width-8,initial.y+80,0));
        assertFalse(ball.expanded());assertTrue(invoked.isEmpty());assertTrue(context.getSharedPreferences("quick_ball_position",0).getBoolean("right",false));
        ball.dispose();ball=create();ball.show();WindowManager.LayoutParams restored=ReflectionHelpers.getField(ball,"position");
        assertEquals(width-restored.width,restored.x);
    }
}
