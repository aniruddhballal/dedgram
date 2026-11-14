import test from 'node:test';
import assert from 'node:assert/strict';
import { retainReelObservations, retainProfileObservations, savedReelRows } from './saved-observations.mjs';

test('missing reads retain earlier values and their actual observation time', () => {
  const prior = { likes: { value: 7, raw: '7', source: 'dom_action_control' }, comments: { value: 0, raw: '0' },
    caption: 'Saved caption', fetched_at: '2026-11-01T00:00:00Z' };
  const result = retainReelObservations({ status: 'partial', likes: null, comments: null, caption: '' },
    [{ record: prior, source: 'history' }]);
  assert.equal(result.likes.value, 7);
  assert.equal(result.comments.value, 0);
  assert.equal(result.likes.observed_at, prior.fetched_at);
  assert.equal(result.caption, prior.caption);
  assert.equal(result.status, 'partial');
  assert.equal(prior.likes.observed_at, undefined);
  assert.equal(retainReelObservations({ likes: { value: null, raw: null } },
    [{ record: prior, source: 'history' }]).likes.value, 7);
});

test('new valid values win and known-invalid historical likes are not resurrected', () => {
  const candidates = [{ record: { likes: { value: 200, raw: '200' } }, source: 'old' }];
  assert.equal(retainReelObservations({ likes: { value: 0, raw: '0' } }, candidates).likes.value, 0);
  const corrected = retainReelObservations({ likes: null, metric_corrections: { likes: { reason: 'Incorrect count' } } }, candidates);
  assert.equal(corrected.likes, null);
  const unverified = retainReelObservations({ likes: null, missing_reasons: { likes: 'Legacy like count is unverified; it may be a comment count.' } }, candidates);
  assert.equal(unverified.likes, null);
});

test('grid views are shown without inventing likes, comments, or completed detail scans', () => {
  const discovery = { reel: { attempted_at: '2026-11-01T00:00:00Z', items: [
    { url: 'https://www.instagram.com/reel/ONE/', shortcode: 'ONE', grid_views_raw: '52.5K' }
  ] } };
  const [row] = savedReelRows(discovery, []);
  assert.equal(row.views.value, 52500);
  assert.equal(row.views.approximate, true);
  assert.equal(row.views.source, 'profile_grid');
  assert.equal(row.views.observed_at, discovery.reel.attempted_at);
  assert.equal(row.likes, undefined);
  assert.equal(row.comments, undefined);
  assert.equal(row.status, 'pending');
});

test('profile fallback retains counts and text without replacing lifecycle state', () => {
  const result = retainProfileObservations({ bio: null, followers_count: null, excluded_from_collection: true },
    [{ record: { bio: 'Earlier bio', followers_count: { value: 10 }, excluded_from_collection: false }, source: 'history' }]);
  assert.equal(result.bio, 'Earlier bio');
  assert.equal(result.followers_count.value, 10);
  assert.equal(result.excluded_from_collection, true);
});
