package com.dedgram.collector;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/** Small, density-independent outline glyphs; no bitmap assets or icon font required. */
final class QuickBallDrawable extends Drawable {
    static final int HANDLE=0,PROFILE=1,REEL=2,ANALYSIS=3,CLOSE=4,LABEL=5;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int kind;
    private boolean right,saved,busy;
    QuickBallDrawable(int kind){this.kind=kind;}
    void state(boolean right,boolean saved,boolean busy){this.right=right;this.saved=saved;this.busy=busy;invalidateSelf();}
    @Override public void draw(Canvas canvas){
        int checkpoint=canvas.save();canvas.translate(getBounds().left,getBounds().top);
        canvas.scale(getBounds().width()/48f,getBounds().height()/48f);
        paint.setStyle(Paint.Style.FILL);
        if(kind==LABEL){
            paint.setColor(0xF2171C27);canvas.drawRoundRect(new RectF(4,35,44,48),6,6,paint);
        }else if(kind==HANDLE){
            if(right){canvas.translate(48,0);canvas.scale(-1,1);}
            Path crescent=new Path();crescent.moveTo(3,9);crescent.cubicTo(35,14,35,34,3,39);
            paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeWidth(8);paint.setColor(0xA6171C27);canvas.drawPath(crescent,paint);
            paint.setColor(busy?0xFF8DDDF7:saved?0xFF9EE6BC:0xFFDEE5F0);
            paint.setStrokeWidth(3.2f);canvas.drawPath(crescent,paint);
        }else{
            paint.setColor(0xF21A202D);canvas.drawCircle(24,24,23,paint);
            paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1);paint.setColor(0xFF465064);canvas.drawCircle(24,24,22.5f,paint);
            paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setColor(kind==PROFILE?(saved?0xFF9EE6BC:0xFFDEE5F0):kind==REEL?0xFF9BDCF6:kind==ANALYSIS?0xFFC6B7FF:0xFFDEE5F0);
            if(kind==PROFILE){canvas.drawCircle(24,19,4.2f,paint);canvas.drawArc(new RectF(15,25,33,37),185,170,false,paint);}
            else if(kind==REEL){
                canvas.drawRoundRect(new RectF(14,14,34,34),5,5,paint);
                Path p=new Path();p.moveTo(22,19);p.lineTo(29,24);p.lineTo(22,29);p.close();canvas.drawPath(p,paint);
            }else if(kind==ANALYSIS){
                canvas.drawArc(new RectF(14,14,34,34),-82,296,false,paint);
                Path p=new Path();p.moveTo(19,24);p.lineTo(23,28);p.lineTo(30,20);canvas.drawPath(p,paint);
                canvas.drawLine(32,11,32,17,paint);canvas.drawLine(29,14,35,14,paint);
            }else{canvas.drawLine(19,19,29,29,paint);canvas.drawLine(29,19,19,29,paint);}
        }
        canvas.restoreToCount(checkpoint);
    }
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
