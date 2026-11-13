import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { chromium } from 'playwright';
import { discover, installRateLimitHandling } from '../src/browser.mjs';

const limitedResponse = (retryAfter = null) => ({
  status: () => 429,
  url: () => 'https://www.instagram.com/grid-load/',
  headers: () => retryAfter ? { 'retry-after': retryAfter } : {}
});

test('429 closes the context immediately outside reel discovery', async () => {
  const context = new EventEmitter();
  let closed = 0;
  context.close = async () => { closed++; };
  installRateLimitHandling(context);
  context.emit('response', limitedResponse());
  assert.equal(closed, 1);
  assert.match(context.rateLimitError, /429.*URL: https:\/\/www.instagram.com\/grid-load\//);
});

for (const scenario of ['recovers', 'persistent', 'no-progress', 'retry-after']) {
  test(`reel-grid 429 recovery: ${scenario}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    installRateLimitHandling(context);
    const page = await context.newPage();
    const delays = [];
    const saved = [];
    await context.route('https://www.instagram.com/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<main><a href="/reel/FIRST/">1 view</a></main>'
    }));
    try {
      let injected = false;
      const result = await discover(page, 'example', 'reel', async (items) => {
        saved.push(items.length);
        if (!injected && items.length) {
          injected = true;
          context.emit('response', limitedResponse(scenario === 'retry-after' ? '60' : null));
        }
      }, {
        pauseMs: 0, maxPasses: 12,
        rateLimitWaitMs: () => 7500,
        wait: async delay => {
          delays.push(delay);
          if (scenario === 'recovers') await page.evaluate(() => {
            document.querySelector('main').insertAdjacentHTML('beforeend', '<a href="/reel/SECOND/">2 views</a>');
          });
          if (scenario === 'persistent') context.emit('response', limitedResponse());
        }
      });
      assert.equal(result.complete, scenario === 'recovers');
      assert.equal(result.items.length, scenario === 'recovers' ? 2 : 1);
      assert(saved.includes(1));
      assert.equal(delays.length, scenario === 'retry-after' ? 0 : scenario === 'persistent' ? 3 : 1);
      assert(delays.every(delay => delay >= 5000 && delay <= 10000));
      if (!result.complete) assert.match(result.error, /429/);
      if (scenario === 'retry-after') assert.match(result.error, /Retry-After/);
      assert.equal(context.reelGridRecovery, undefined);
      assert.equal(context.rateLimitError, undefined);
      assert.equal(Boolean(context.preserveReelGridOnRateLimit), scenario !== 'recovers');
      if (scenario !== 'recovers') {
        const scrollBefore = await page.evaluate(() => window.scrollY);
        context.emit('response', limitedResponse());
        assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
        assert.equal(page.isClosed(), false);
      }
    } finally { await browser.close(); }
  });
}
