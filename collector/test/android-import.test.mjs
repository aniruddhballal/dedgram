import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAndroidCapture } from '../src/android-import.mjs';
import { itemAnalysisHandled } from '../src/model.mjs';

const at=Date.parse('2026-11-14T19:30:00Z');
function fixture(){
  const previous={kind:'reel',shortcode:'CODE',url:'https://www.instagram.com/reel/CODE/',date:'2026-09-28',date_precision:'day',status:'needs_review',
    views:{value:8000000,source:'profile_grid'},access_review:{kind:'age_restricted'},raw:{article_text:'Age-restricted content'},last_error:'Old navigation failure'};
  const capture={shortcode:'CODE',url:previous.url,account:'new_owner',captured_at:String(at),identity_source:'queue_deep_link_and_account_check',
    caption_expanded:true,caption:{value:'Full caption',error:null},date_posted:{value:'29 September',error:null},likes:{value:42,error:null},comments:{value:0,error:null},views_or_plays:{value:8182603,error:null},
    publication_observation:{raw_text:'29 September',timezone:'Asia/Kolkata',observed_at_epoch_ms:at}};
  const queue={url:capture.url,expected_account:'new_owner',captured_at:String(at),status:'collected'};
  return {previous,capture,queue};
}
const merge=f=>mergeAndroidCapture(f.previous,f.capture,f.queue,'2026-11-15T00:00:00Z');
test('maps exact counts, clears resolved barriers and retains canonical date plus native observation',()=>{
  const f=fixture(), r=merge(f);assert.equal(r.status,'complete');assert.equal(r.comments.value,0);assert.equal(r.views.value,8182603);
  assert.equal(r.date,'2026-09-28');assert.equal(r.publication_observation.raw_text,'29 September');assert.equal(r.access_review,null);assert.equal(r.last_error,null);
  assert.equal(r.observed_owner_username,'new_owner');assert.equal(r.raw.android_capture,f.capture);assert(itemAnalysisHandled(r));
});
test('missing native values retain valid old observations and do not become invented zeros',()=>{
  const f=fixture();f.capture.likes={value:null,error:'Could not open panel'};f.capture.views_or_plays={value:null,error:'Unreadable'};f.queue.status='partial';
  const r=merge(f);assert.equal(r.status,'partial');assert.equal(r.likes,null);assert.equal(r.views.value,8000000);
  f.previous.likes={value:17,source:'visible_control',observed_at:'2026-11-14T10:00:00Z'};assert.equal(merge(f).likes.value,17);
});
test('verified native count absence resolves missing core metric; unsupported evidence stays partial',()=>{
  const f=fixture();f.capture.comments={value:null,error:null};f.capture.metric_availability={comments:{status:'not_exposed',source:'verified_reel_controls',samples:2,
    details_capture_verified:true,first_observed_at:at-2000,confirmed_at:at-1000,control_evidence:'visible_comment_control_without_count_before_repost'}};
  const r=merge(f);assert.equal(r.status,'metrics_unavailable');assert.equal(r.comments,null);assert(itemAnalysisHandled(r));
  f.capture.metric_availability.comments.samples=1;assert.equal(merge(f).status,'partial');
});
test('rejects mismatched identity, checkpoint and invalid numeric values',()=>{
  for(const mutate of [f=>f.capture.shortcode='OTHER',f=>f.queue.captured_at='1',f=>f.capture.account='other',f=>f.capture.likes.value=-1,f=>f.capture.likes.value='42',f=>f.capture.navigation_error='Wrong sheet']){
    const f=fixture();mutate(f);assert.throws(()=>merge(f));
  }
});
test('older retained phone observations do not overwrite newer valid collector numbers',()=>{
  const f=fixture();f.capture.retained_observations={likes:{captured_at:String(at-100000)}};f.previous.likes={value:90,observed_at:new Date(at-1000).toISOString()};
  assert.equal(merge(f).likes.value,90);
});
