package com.dedgram.collector;
import android.content.*;import android.database.Cursor;import android.net.Uri;import android.provider.DocumentsContract;import java.io.IOException;

/** Exact sibling documents under the user-granted Documents/dedgram directory. */
public final class SharedReelDocuments {
 private static final String PREFS="pending_reel_queue";
 public static Uri folder(Context c){String s=c.getSharedPreferences(PREFS,0).getString("folder",null);return s==null?null:Uri.parse(s);}
 static boolean validFolderId(String id){return id!=null&&id.endsWith(":Documents/dedgram");}
 public static void choose(Context c,Uri tree)throws Exception{
  if(!validFolderId(DocumentsContract.getTreeDocumentId(tree)))throw new IOException("Choose Documents/dedgram, not another directory");
  c.getContentResolver().takePersistableUriPermission(tree,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
  Uri pending=file(c,tree,"pending_reels.json",false);
  if(pending==null)throw new IOException("Put pending_reels.json in Documents/dedgram first");
  PendingReelStore.read(c,pending);
  c.getSharedPreferences(PREFS,0).edit().putString("folder",tree.toString()).commit();
 }
 public static Uri file(Context c,String name,boolean create)throws Exception{Uri tree=folder(c);if(tree==null)throw new IOException("Choose Documents/dedgram to grant exact-file access");return file(c,tree,name,create);}
 private static Uri file(Context c,Uri tree,String name,boolean create)throws Exception{
  if(!name.equals("pending_reels.json")&&!name.equals("reels.json")&&!name.equals("profiles.json"))throw new IOException("Unsupported shared document");
  String id=DocumentsContract.getTreeDocumentId(tree);Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,id);
  try(Cursor cursor=c.getContentResolver().query(children,new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
   if(cursor==null)throw new IOException("Folder is not readable");
   while(cursor.moveToNext())if(name.equals(cursor.getString(1)))return DocumentsContract.buildDocumentUriUsingTree(tree,cursor.getString(0));
  }
  if(!create)return null;
  Uri created=DocumentsContract.createDocument(c.getContentResolver(),DocumentsContract.buildDocumentUriUsingTree(tree,id),"application/json",name);
  if(created==null)throw new IOException("Could not create "+name);
  try(Cursor cursor=c.getContentResolver().query(created,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
   if(cursor==null||!cursor.moveToFirst()||!name.equals(cursor.getString(0)))throw new IOException("Provider did not create the exact requested filename");
  }
  return created;
 }
}
