import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mergeAndroidCapture, captureTime } from '../src/android-import.mjs';
import { paths, readJson, writeJson, writeSnapshot } from '../src/store.mjs';
import { itemAnalysisHandled, profileLevelComplete } from '../src/model.mjs';
import { writeReport } from '../src/report.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg=process.argv.find(arg=>arg.startsWith('--source='));
if(!sourceArg)throw new Error('Use --source=FOLDER containing reels.json and pending_reels.json; add --apply to save');
const source=resolve(sourceArg.slice('--source='.length));
const [resultText, queueText]=await Promise.all(['reels.json','pending_reels.json'].map(name=>readFile(join(source,name),'utf8')));
const captures=JSON.parse(resultText), queue=JSON.parse(queueText);
if(!Array.isArray(captures.reels)||!Array.isArray(queue.reels))throw new Error('Invalid phone documents');
const groups=new Map(), index=new Map();
for(const dir of await readdir(join(root,'data'),{withFileTypes:true})) {
  if(!dir.isDirectory())continue;
  const path=paths(root,dir.name), items=await readJson(path.items,null);
  if(!Array.isArray(items))continue;
  const data={username:dir.name,path,items};groups.set(dir.name,data);
  for(const item of items){if(!index.has(item.shortcode))index.set(item.shortcode,[]);index.get(item.shortcode).push({data,item});}
}
const seen=new Set(), importedAt=new Date().toISOString(), changes=[];
for(const capture of captures.reels) {
  if(seen.has(capture.shortcode))throw new Error('Duplicate phone shortcode');seen.add(capture.shortcode);
  const matches=index.get(capture.shortcode)||[];
  if(matches.length!==1)throw new Error(`Expected unique saved match for ${capture.shortcode}, found ${matches.length}`);
  const {data,item}=matches[0];
  const queued=queue.reels.filter(entry=>entry.url===capture.url);
  if(queued.length!==1)throw new Error('Missing or ambiguous queue checkpoint');
  const next=mergeAndroidCapture(item,capture,queued[0],importedAt);
  if(item.android_import?.captured_at===captureTime(capture.captured_at)
      && JSON.stringify(item.raw?.android_capture)===JSON.stringify(capture))continue;
  data.changes??=[];data.changes.push({shortcode:item.shortcode,before_status:item.status,after_status:next.status,
    observed_account:capture.account, canonical_date:item.date, phone_date_label:capture.date_posted?.value||null});
  data.items=data.items.map(existing=>existing===item?next:existing);
  changes.push({profile:data.username,...data.changes.at(-1)});
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',captures:captures.reels.length,updates:changes.length,profiles:[...groups.values()].filter(d=>d.changes).map(d=>({username:d.username,count:d.changes.length,statuses:d.changes.map(c=>c.after_status)}))},null,2));
if(process.argv.includes('--apply')&&changes.length) {
  // Complete all matching/validation before making any mutation.
  const batch=join(root,'data','imports','android',importedAt.replace(/[:.]/g,'-'));
  await mkdir(batch,{recursive:true});
  await writeFile(join(batch,'reels.json'),resultText,'utf8');
  await writeFile(join(batch,'pending_reels.json'),queueText,'utf8');
  const manifest={schema_version:1,imported_at:importedAt,source:'ADB Documents/dedgram',
    sha256:{reels:createHash('sha256').update(resultText).digest('hex'),queue:createHash('sha256').update(queueText).digest('hex')},changes,profiles:[]};
  for(const data of groups.values()) {
    if(!data.changes)continue;
    const {path,username,items}=data;
    const [profile,discovery,previousRun]=await Promise.all([readJson(path.profile),readJson(path.discovery,{}),readJson(path.run,{})]);
    const before=await writeSnapshot(path,{username,phase:'before-android-reel-import',snapshotAt:importedAt,profile,discovery,items:await readJson(path.items),run:previousRun});
    const reels=items.filter(item=>item.kind==='reel');
    const complete=profileLevelComplete(profile,discovery)&&reels.every(itemAnalysisHandled);
    const run={...previousRun,updated_at:importedAt,status:complete?'complete':'partial',phase:'done',current_url:null,
      error:null,android_import:{imported_at:importedAt,source_batch:batch.slice(root.length+1).replaceAll('\\','/'),updated_reels:data.changes.length},
      ...(previousRun.error?{previous_collection_error:previousRun.error}:{}),
      progress:{task:'android_import',label:'Import Android reel captures',completed:data.changes.length,total:data.changes.length,
        detail:complete?'All saved reels complete or resolved':'Phone captures imported; unresolved saved reels remain',updated_at:importedAt}};
    await writeJson(path.items,items);await writeJson(path.run,run);await writeReport(path,profile,discovery,items,run);
    const after=await writeSnapshot(path,{username,phase:'after-android-reel-import',snapshotAt:importedAt,profile,discovery,items,run});
    const operation={schema_version:1,source_batch:run.android_import.source_batch,changes:data.changes,before_snapshot:before.slice(root.length+1),after_snapshot:after.slice(root.length+1)};
    await writeJson(join(after,'operation.json'),operation);manifest.profiles.push({username,...operation});
  }
  await writeJson(join(batch,'manifest.json'),manifest);
  console.log(`Saved source archive: ${batch}`);
}
