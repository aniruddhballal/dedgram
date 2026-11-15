package com.dedgram.collector;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;

/** A checklist plus play mark: profile and reel analysis in one control. */
public final class AnalysisBubbleDrawable extends Drawable {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    @Override public void draw(Canvas canvas){
        Rect b=getBounds();float s=Math.min(b.width(),b.height());canvas.save();canvas.translate(b.left,b.top);canvas.scale(s/56f,s/56f);
        paint.setStyle(Paint.Style.FILL);paint.setColor(0xFF312E81);canvas.drawRoundRect(1,1,55,55,13,13,paint);
        paint.setColor(Color.WHITE);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2.8f);paint.setStrokeCap(Paint.Cap.ROUND);
        for(int y:new int[]{16,27,38}){canvas.drawLine(11,y,14,y+3,paint);canvas.drawLine(14,y+3,19,y-3,paint);canvas.drawLine(24,y,33,y,paint);}
        paint.setStyle(Paint.Style.FILL);android.graphics.Path play=new android.graphics.Path();play.moveTo(39,29);play.lineTo(48,35);play.lineTo(39,41);play.close();canvas.drawPath(play,paint);canvas.restore();
    }
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(android.graphics.ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return android.graphics.PixelFormat.TRANSLUCENT;}
}
