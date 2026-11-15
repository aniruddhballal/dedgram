package com.dedgram.collector;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class CollapsibleEntryViewTest {
    private ViewGroup entry(String key,AtomicInteger builds){
        Context context=RuntimeEnvironment.getApplication();
        return (ViewGroup)CollapsibleEntryView.create(context,key,"@owner","profile @owner",false,0xFF000000,()->{
            builds.incrementAndGet();TextView body=new TextView(context);body.setText("Captured details");return body;
        });
    }
    @Test public void startsCompactAndBuildsDetailsOnlyOnceWhenExpanded(){
        AtomicInteger builds=new AtomicInteger();ViewGroup view=entry("profile:owner",builds);
        assertEquals(0,builds.get());assertEquals(View.GONE,view.getChildAt(1).getVisibility());
        view.getChildAt(0).performClick();assertEquals(1,builds.get());assertEquals(View.VISIBLE,view.getChildAt(1).getVisibility());
        view.getChildAt(0).performClick();assertEquals(View.GONE,view.getChildAt(1).getVisibility());
        view.getChildAt(0).performClick();assertEquals(1,builds.get());
    }
    @Test public void entriesAreIndependentAndRememberChoiceWhenRecreated(){
        AtomicInteger builds=new AtomicInteger();ViewGroup first=entry("profile:owner",builds),second=entry("reel:one",builds);
        first.getChildAt(0).performClick();
        assertEquals(View.GONE,second.getChildAt(1).getVisibility());
        ViewGroup restored=entry("profile:owner",builds);assertEquals(View.VISIBLE,restored.getChildAt(1).getVisibility());
        restored.getChildAt(0).performClick();
        assertEquals(View.GONE,entry("profile:owner",builds).getChildAt(1).getVisibility());
    }
    @Test public void collapseDoesNotHideFailureFromTheEntryBar(){
        Context context=RuntimeEnvironment.getApplication();
        ViewGroup view=(ViewGroup)CollapsibleEntryView.create(context,"profile:failed","@failed","profile @failed",true,0xFF000000,()->new TextView(context));
        View bar=view.getChildAt(0);
        assertTrue(bar.getContentDescription().toString().contains("capture errors"));
        assertTrue(bar.getContentDescription().toString().startsWith("Expand"));
        bar.performClick();assertTrue(bar.getContentDescription().toString().startsWith("Collapse"));
    }
    @Test public void buttonsInsideDetailsDoNotCollapseTheEntry(){
        Context context=RuntimeEnvironment.getApplication();AtomicInteger clicks=new AtomicInteger();
        ViewGroup view=(ViewGroup)CollapsibleEntryView.create(context,"profile:nested","@owner","profile @owner",false,0xFF000000,
                ()->UiStyles.button(context,"Show saved header",v->clicks.incrementAndGet(),false));
        view.getChildAt(0).performClick();
        ((ViewGroup)view.getChildAt(1)).getChildAt(0).performClick();
        assertEquals(1,clicks.get());assertEquals(View.VISIBLE,view.getChildAt(1).getVisibility());
    }
}
