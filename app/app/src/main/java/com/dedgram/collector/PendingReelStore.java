package com.dedgram.collector;
import android.content.*;import android.net.Uri;import android.provider.OpenableColumns;import android.database.Cursor;import org.json.*;import java.io.*;import java.nio.charset.StandardCharsets;

/** A persisted SAF grant allows updating a computer-created Documents JSON. */
public final class PendingReelStore {
    private static final String PREFS="pending_reel_queue";
    public static Uri uri(Context c){if(SharedReelDocuments.folder(c)!=null)try{return SharedReelDocuments.file(c,"pending_reels.json",false);}catch(Exception e){return null;}String s=c.getSharedPreferences(PREFS,0).getString("uri",null);return s==null?null:Uri.parse(s);}
    public static void choose(Context c,Uri u)throws Exception {
        try(Cursor cursor=c.getContentResolver().query(u,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
            if(cursor==null||!cursor.moveToFirst()||!"pending_reels.json".equals(cursor.getString(0)))throw new IOException("Choose Documents/dedgram/pending_reels.json");}
        read(c,u);c.getContentResolver().takePersistableUriPermission(u,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        c.getSharedPreferences(PREFS,0).edit().putString("uri",u.toString()).commit();
    }
    public static PendingReels read(Context c)throws Exception {Uri u=uri(c);if(u==null)throw new IOException("Choose pending_reels.json first");return read(c,u);}
    static PendingReels read(Context c,Uri u)throws Exception{
        try(InputStream in=c.getContentResolver().openInputStream(u);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            if(in==null)throw new IOException("Queue cannot be read");byte[] b=new byte[8192];int n;
            while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>4*1024*1024)throw new IOException("Queue exceeds 4 MB");}
            return new PendingReels(new String(out.toByteArray(),StandardCharsets.UTF_8));}
    }
    public static synchronized void result(Context c,String url,String status,String detail,String capturedAt)throws Exception{
        PendingReels q=read(c);
        try(FileOutputStream backup=c.openFileOutput("pending-reels-last-good.json",0)){backup.write(q.document.toString(2).getBytes(StandardCharsets.UTF_8));backup.getFD().sync();}
        q.result(url,status,detail,capturedAt);
        byte[] bytes=(q.document.toString(2)+"\n").getBytes(StandardCharsets.UTF_8);
        try(OutputStream out=c.getContentResolver().openOutputStream(uri(c),"rwt")){if(out==null)throw new IOException("Queue is not writable");out.write(bytes);out.flush();}
        PendingReels verified=read(c);if(verified.done()!=q.done())throw new IOException("Queue write verification failed");
    }
    public static void progress(Context c,String text){c.getSharedPreferences(PREFS,0).edit().putString("progress",text).apply();}
    public static String progress(Context c){return c.getSharedPreferences(PREFS,0).getString("progress","Ready");}
    public static void arm(Context c){c.getSharedPreferences(PREFS,0).edit().putBoolean("armed",true).putLong("armed_at",System.currentTimeMillis()).commit();}
    public static boolean consumeArm(Context c){boolean b=c.getSharedPreferences(PREFS,0).getBoolean("armed",false);c.getSharedPreferences(PREFS,0).edit().remove("armed").commit();return b && System.currentTimeMillis()-c.getSharedPreferences(PREFS,0).getLong("armed_at",0)>=0 && System.currentTimeMillis()-c.getSharedPreferences(PREFS,0).getLong("armed_at",0)<=120000;}
}
