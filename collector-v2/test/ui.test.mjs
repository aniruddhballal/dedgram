import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSummary } from '../ui/data.mjs';
import { renderProfile } from '../ui/public/profile.js';
import { batchStrip } from '../ui/public/flow.js';
import { gridLabel } from '../ui/public/shared.js';

test('the profile page never displays a partial grid count as a result', () => {
  const discovery = { post: { items: [{ url: 'one' }, { url: 'two' }], complete: false,
    error: 'Grid scan stopped early.' }, reel: { items: [{ url: 'one' }], complete: false,
    error: 'Reel scan stopped early.' } };
  const profile = { username: 'example', fetched_at: '2026-10-23T00:00:00Z',
    raw: { header_text: 'example\n2,894 posts\n10 followers\n0 following' },
    posts_count: { value: 2894, raw: '2,894' }, followers_count: { value: 10, raw: '10' },
    following_count: { value: 0, raw: '0' } };
  const data = { username: 'example', profile, discovery, items: [], run: { status: 'partial' } };
  const summary = profileSummary(data);
  assert.equal(summary.posts.discovered, null);
  assert.equal(summary.posts.grid_error, 'Grid scan stopped early.');
  assert.equal(gridLabel({ discovered: null, grid_complete: false,
    grid_error: 'Grid has not been scanned.' }), 'Not scanned');
  assert.equal(gridLabel({ discovered: null, grid_complete: false,
    grid_error: 'Grid scan did not finish.' }, { status: 'running', phase: 'reel discovery' }), 'Counting');
  assert.equal(gridLabel({ discovered: null, grid_complete: false,
    grid_error: 'Reel scan stopped early.' }), 'Error');
  const html = renderProfile({ detail: { ...data, summary }, itemSearch: '', itemFilter: 'all',
    itemSort: 'newest', batch: null, error: null });
  assert.match(html, /INSTAGRAM POSTS<\/span><strong>2,894<\/strong>/);
  assert.match(html, /REELS IN GRID<\/span><strong>Error<\/strong>/);
  assert.doesNotMatch(html, /2\+|>2 posts/);
});

test('the live batch strip shows extraction detail, percentage and remaining work', () => {
  const html = batchStrip({
    batch: {
      status: 'running', current: 'example', current_stage: 'reels', mode: 'depth_first',
      profiles: ['example', 'later'], steps: [{ username: 'example', stage: 'reels' }, { username: 'later', stage: 'reels' }],
      results: { example: { stages: { reels: { status: 'running' } } }, later: { stages: { reels: { status: 'queued' } } } }
    },
    batchProfiles: [
      { username: 'example', reels: { discovered: 10, complete: 4 }, run: { progress: {
        action: 'Extracting date, caption, views, likes and comments from the current reel', completed: 5, total: 10, percent: 50, remaining: 5,
        current_item: { index: 6, total: 10, shortcode: 'ABC123' }, detail: 'Opening reel ABC123'
      } } },
      { username: 'later', reels: { discovered: 3, complete: 0 }, run: { progress: null } }
    ],
    readOnly: false, busy: false
  });
  assert.match(html, /Extracting date, caption, views, likes and comments/);
  assert.match(html, />50%<\/span>/);
  assert.match(html, /Reel 6 of 10/);
  assert.match(html, /1 stage after this/);
  assert.match(html, /8 scrapes after this/);
});

test('a profile page shows live reel counts instead of only a one-stage counter', () => {
  const html = batchStrip({
    batch: { status: 'running', current: 'example', current_stage: 'reel_grid', profiles: ['example'],
      steps: [{ username: 'example', stage: 'reel_grid' }], results: { example: { stages: { reel_grid: { status: 'running' } } } } },
    batchProfiles: [{ username: 'example', reels: { discovered: null, complete: 0 }, run: {} }],
    detail: { username: 'example', summary: { reels: { discovered: null, complete: 0 } }, run: { started_at: '2026-10-28T06:00:00.000Z', progress: {
      task: 'reel_grid', label: 'Reel URL discovery', action: 'Finding every reel URL in the profile grid', completed: 180, total: null, percent: null,
      remaining: null, detail: '180 reel URLs found so far'
    } } },
    readOnly: false, busy: false
  });
  assert.match(html, /180 reel URLs found so far/);
  assert.match(html, /Live count/);
  assert.doesNotMatch(html, /0 \/ 1 stages finished/);
});
