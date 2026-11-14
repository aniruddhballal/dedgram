import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { captureItem } from '../src/browser.mjs';
import { itemFromSnapshot, itemAnalysisHandled } from '../src/model.mjs';

const item = { kind: 'reel', shortcode: 'TARGET', url: 'https://www.instagram.com/reel/TARGET/' };
const readable = (likeContent) => `<article data-shortcode="TARGET"><h1>Caption</h1><time datetime="2026-11-01T00:00:00Z"></time><div><button aria-label="Like"></button><span>${likeContent}</span></div><div><button aria-label="Comment"></button><span>4</span></div></article>`;

async function fixture(html, fn) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('https://www.instagram.com/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  try { await fn(page); } finally { await browser.close(); }
}

test('unparsed like controls remain partial instead of claiming hidden counts', async () => {
  await fixture(`<main>${readable('Likes')}</main>`, async page => {
    const snapshot = await captureItem(page, item);
    const result = itemFromSnapshot(item, { ...snapshot, grid_views_raw: '3K' });
    assert.equal(snapshot.engagement.availability.likes.state, 'not_captured');
    assert.equal(result.status, 'partial');
    assert.equal(itemAnalysisHandled(result), false);
  });
});

test('explicit hidden-count evidence with stable reads can resolve an unavailable metric', async () => {
  await fixture(`<main>${readable('Like count hidden')}</main>`, async page => {
    const snapshot = await captureItem(page, item);
    const result = itemFromSnapshot(item, { ...snapshot, grid_views_raw: '3K' });
    assert.equal(snapshot.capture_checks.stable, true);
    assert.equal(snapshot.engagement.availability.likes.state, 'explicitly_hidden');
    assert.equal(result.status, 'metrics_unavailable');
    assert.equal(result.likes, null);
    assert.equal(itemAnalysisHandled(result), true);
  });
});

test('a normal sensitive-content confirmation is clicked and content is then captured', async () => {
  await fixture(`<main><p>Sensitive content</p><button>See video</button></main><script>document.querySelector('button').onclick=()=>{document.querySelector('main').innerHTML=${JSON.stringify(readable('6'))}}</script>`, async page => {
    const snapshot = await captureItem(page, item);
    assert(snapshot.capture_checks.access_attempts.some(a => a.clicked));
    assert.equal(snapshot.capture_checks.access_clear, true);
    const result = itemFromSnapshot(item, { ...snapshot, grid_views_raw: '3K' });
    assert.equal(result.likes.value, 6);
    assert.equal(result.status, 'complete');
  });
});

test('age confirmation is never clicked or treated as resolved data', async () => {
  await fixture('<main>Age-restricted content<button onclick="window.clicked=true">Continue</button></main>', async page => {
    await assert.rejects(captureItem(page, item), error => error.accessIssue?.kind === 'age_restricted');
    assert.equal(await page.evaluate(() => window.clicked), undefined);
    assert.equal(itemAnalysisHandled({ status: 'age_restricted' }), false);
  });
});

test('an unresolved sensitive-content overlay is sent to manual review', async () => {
  await fixture('<main>Sensitive content<button>Appeal</button></main>', async page => {
    await assert.rejects(captureItem(page, item), error => error.accessIssue?.kind === 'sensitive_content');
  });
});

test('ambiguous recommended articles are not mistaken for the target reel', async () => {
  await fixture('<main><article>999 likes</article><article>888 likes</article></main>', async page => {
    await assert.rejects(captureItem(page, item), /target article could not be identified/);
  });
});

test('read-only panels establish hidden likes and a genuine zero comment count', async () => {
  const html = `<main><article data-shortcode="TARGET"><time datetime="2026-11-01T00:00:00Z"></time>
    <div><button aria-label="Like" onclick="window.heartClicked=true"></button><span onclick="show('Likes','owner can see the total number of people who liked this post.')">Likes</span></div>
    <div><button aria-label="Comment" onclick="show('Comments','No comments yet.')"></button></div></article></main>
    <script>function show(title,text){document.querySelector('[role=dialog]')?.remove();const d=document.createElement('div');d.setAttribute('role','dialog');d.innerText=title+'\\n'+text;document.body.append(d);} document.onkeydown=e=>{if(e.key==='Escape')document.querySelector('[role=dialog]')?.remove()};</script>`;
  await fixture(html, async page => {
    const snapshot = await captureItem(page, item);
    const result = itemFromSnapshot(item, { ...snapshot, grid_views_raw: '3K' });
    assert.equal(result.comments.value, 0);
    assert.equal(result.status, 'metrics_unavailable');
    assert.equal(result.raw.engagement.availability.likes.source, 'metric_dialog');
    assert.equal(await page.evaluate(() => window.heartClicked), undefined);
  });
});
