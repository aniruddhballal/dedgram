import test from 'node:test';
import assert from 'node:assert/strict';
import { orderProfiles, resultStatus, stepsFor } from './plan.mjs';
import { filteredCatalog, profileDetailsReady, reelCountReady, reelDetailsComplete, reelsNeedWork } from './public/queue.js';

const selected = ['alpha', 'beta'];
const labels = (mode) => stepsFor(selected, mode).map(({ username, stage }) => `${username}:${stage}`);

test('collection strategies schedule profile and reel stages in the requested order', () => {
  assert.deepEqual(labels('profile_header'), ['alpha:profile_header', 'beta:profile_header']);
  assert.deepEqual(labels('reel_grid'), ['alpha:reel_grid', 'beta:reel_grid']);
  assert.deepEqual(labels('reel_details'), ['alpha:reels', 'beta:reels']);
  assert.deepEqual(labels('profile_only'), ['alpha:profile', 'beta:profile']);
  assert.deepEqual(labels('depth_first'), ['alpha:profile', 'alpha:reels', 'beta:profile', 'beta:reels']);
  assert.deepEqual(labels('breadth_first'), ['alpha:profile', 'beta:profile', 'alpha:reels', 'beta:reels']);
  assert.deepEqual(labels('reels_only'), ['alpha:reels', 'beta:reels']);
  assert.throws(() => stepsFor(selected, 'unknown'), /valid collection mode/);
});

test('a profile result reflects incomplete and review stages', () => {
  assert.equal(resultStatus({ profile: { status: 'complete' }, reels: { status: 'queued' } }), 'queued');
  assert.equal(resultStatus({ profile: { status: 'complete' }, reels: { status: 'running' } }), 'running');
  assert.equal(resultStatus({ profile: { status: 'complete' }, reels: { status: 'needs_review' } }), 'needs_review');
  assert.equal(resultStatus({ profile: { status: 'failed' }, reels: { status: 'skipped' } }), 'failed');
  assert.equal(resultStatus({ profile: { status: 'complete' }, reels: { status: 'complete' } }), 'complete');
});

test('post count order sorts saved exact counts and puts unknown counts last', () => {
  const selected = ['unknown', 'large', 'zero', 'small', 'tied', 'another_unknown'];
  const counts = new Map([['large', 500], ['zero', 0], ['small', 10], ['tied', 10]]);
  assert.deepEqual(orderProfiles(selected, 'posts_ascending', counts),
    ['zero', 'small', 'tied', 'large', 'unknown', 'another_unknown']);
  assert.deepEqual(orderProfiles(selected, 'selection', counts), selected);
  assert.throws(() => orderProfiles(selected, 'other', counts), /valid profile order/);
});

test('reel count order puts smaller complete grids first and keeps ties stable', () => {
  const names = ['large', 'unknown', 'small', 'zero', 'same', 'another_unknown'];
  const reelCounts = new Map([['large', 800], ['small', 12], ['zero', 0], ['same', 12]]);
  assert.deepEqual(orderProfiles(names, 'reels_ascending', reelCounts),
    ['zero', 'small', 'same', 'large', 'unknown', 'another_unknown']);
});

test('reel work includes only ready profiles with pending or reviewable reel details', () => {
  const profiles = [
    { username: 'pending', profile_complete: true, reels: { discovered: 5, processed: 2, review: 0 } },
    { username: 'review', profile_complete: true, reels: { discovered: 5, processed: 5, review: 1 } },
    { username: 'done', profile_complete: true, reels: { discovered: 5, processed: 5, review: 0 } },
    { username: 'profile_pending', profile_complete: false, reels: { discovered: 5, processed: 2, review: 0 } }
  ];
  assert.deepEqual(profiles.filter(reelsNeedWork).map(({ username }) => username), ['pending', 'review']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'reel_count_ready' }).map(({ username }) => username),
    ['pending', 'review']);
});

test('catalog filters expose the next missing collection stage', () => {
  const profiles = [
    { username: 'profile_missing', profile_header_complete: false, posts_count: null, profile_complete: false, run: { status: 'not_started' }, reels: { processed: 0, review: 0 } },
    { username: 'count_missing', profile_header_complete: true, posts_count: 10, profile_complete: false, run: { status: 'complete' }, reels: { processed: 0, review: 0 } },
    { username: 'details_pending', profile_header_complete: true, posts_count: 10, profile_complete: true, reels: { discovered: 5, processed: 2, review: 0 }, run: { status: 'complete' } },
    { username: 'details_complete', profile_header_complete: true, posts_count: 10, profile_complete: true, reels: { discovered: 5, processed: 5, review: 0 }, run: { status: 'complete' } },
    { username: 'resolved', account_status: 'deleted', profile_header_complete: false, posts_count: null, profile_complete: false, run: { status: 'complete' }, reels: { processed: 0, review: 0 } },
    { username: 'failed', profile_header_complete: false, posts_count: null, profile_complete: false, run: { status: 'failed' }, reels: { processed: 0, review: 0 } }
  ];
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'profile_missing' }).map(({ username }) => username), ['profile_missing', 'failed']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'reel_count_missing' }).map(({ username }) => username), ['count_missing']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'reel_count_ready' }).map(({ username }) => username), ['details_pending']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'reel_details_complete' }).map(({ username }) => username), ['details_complete']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'resolved' }).map(({ username }) => username), ['resolved']);
  assert.deepEqual(filteredCatalog({ catalog: profiles, search: '', filter: 'review' }).map(({ username }) => username), ['failed']);
});

test('stage readiness helpers map directly to the three collection stages', () => {
  const profile = { profile_header_complete: true, posts_count: 10, profile_complete: true,
    reels: { grid_complete: true, discovered: 2, processed: 2, review: 0 } };
  assert.equal(profileDetailsReady(profile), true);
  assert.equal(reelCountReady(profile), true);
  assert.equal(reelDetailsComplete(profile), true);
});
