import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { engagementFromDocument } from '../src/reel-engagement.mjs';
import { itemFromSnapshot, publicDetailsFromSnapshot } from '../src/model.mjs';

test('count extraction uses the target reel controls, never adjacent counts or recommended reels', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.abort());
  try {
    await page.setContent(`<main><article data-shortcode="TARGET">
      <p>Caption mentions 123 likes and 456 comments.</p>
      <div><button><svg aria-label="Like"></svg></button><span>Likes</span></div>
      <div><button><svg aria-label="Comment"></svg></button><span>5</span></div>
      <div><button><svg aria-label="Repost"></svg></button><span>3</span></div>
      <div><button aria-label="Share"></button><span>9</span></div>
      </article><article data-shortcode="OTHER"><button aria-label="999 likes"></button>
      <button aria-label="888 comments"></button><button aria-label="777 reposts"></button></article></main>`);
    const engagement = await page.evaluate(engagementFromDocument, { shortcode: 'TARGET' });
    assert.equal(engagement.likes, undefined);
    assert.equal(engagement.likes_visibility, 'not_shown');
    assert.equal(engagement.comments.raw, '5');
    assert.equal(engagement.reshares.raw, '3');
    assert.equal(engagement.shares.raw, '9');
    const snapshot = { engagement, article_text: 'Likes\n5\n3\nOTHER\n999 likes\n888 comments',
      og_description: 'example on August 13, 2026', json_ld: [], grid_views_raw: '12.7K' };
    for (const parsed of [itemFromSnapshot({ kind: 'reel' }, snapshot), publicDetailsFromSnapshot({ kind: 'reel' }, snapshot)]) {
      assert.equal(parsed.likes, null);
      assert.equal(parsed.comments.value, 5);
      assert.equal(parsed.reshares.value, 3);
      assert.equal(parsed.shares.value, 9);
    }

    await page.setContent(`<article data-shortcode="TARGET"><button aria-label="Like">Likes</button>
      <button aria-label="Comment"></button></article><article><button aria-label="99 comments"></button></article>`);
    const absent = await page.evaluate(engagementFromDocument, { shortcode: 'TARGET' });
    assert.equal(absent.comments, undefined);
    assert.equal(absent.likes, undefined);

    await page.setContent(`<article data-shortcode="TARGET"><button aria-label="0 likes"></button>
      <button aria-label="Comments: 0"></button><button aria-label="Repost 0"></button></article>`);
    const zero = await page.evaluate(engagementFromDocument, { shortcode: 'TARGET' });
    assert.equal(zero.likes.raw, '0');
    assert.equal(zero.comments.raw, '0');
    assert.equal(zero.reshares.raw, '0');

    await page.setContent(`<main><div><div><button aria-label="Like">Likes</button></div>
      <div><button aria-label="Comment"></button><span>1</span></div>
      <div><button aria-label="Repost"></button><span>2</span></div></div>
      <div><button aria-label="900 comments"></button></div></main>`);
    const rail = await page.evaluate(engagementFromDocument, { shortcode: 'TARGET' });
    assert.equal(rail.likes, undefined);
    assert.equal(rail.comments.raw, '1');
    assert.equal(rail.reshares.raw, '2');
  } finally { await browser.close(); }
});

test('unscoped saved text cannot identify likes or comments', () => {
  const parsed = itemFromSnapshot({ kind: 'reel' }, { json_ld: [],
    og_description: 'example on August 13, 2026: "Our caption mentions 123 likes and 456 comments"',
    article_text: 'Likes\n5\n3\nSuggested reel\n123 likes\n456 comments',
    aria_text: 'Suggested reel\n789 likes\n987 comments' });
  assert.equal(parsed.likes, null);
  assert.equal(parsed.comments, null);
  const summary = itemFromSnapshot({ kind: 'reel' }, { json_ld: [],
    og_description: 'A caption mentioning 999 likes - 35K likes, 143 comments - @example on August 13, 2026' });
  assert.equal(summary.likes.value, 35000);
  assert.equal(summary.comments.value, 143);
});
