import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('reel filters distinguish pending retries from failed or partial results', async () => {
  const cards = ['complete', 'archived', 'pending', 'partial', 'failed'].map((status) => ({
    dataset: { status, date: '', views: '0' }, textContent: status, hidden: false
  }));
  const control = (value) => ({ value, listeners: {}, addEventListener(event, callback) { this.listeners[event] = callback; } });
  const filter = control('all');
  const nodes = {
    '#reel-grid': { querySelectorAll: (selector) => selector === 'img' ? [] : cards, replaceChildren() {} },
    '#reel-search': control(''), '#reel-filter': filter, '#reel-sort': control('newest'),
    '#reel-count': {}, '#reel-empty': {}
  };
  runInNewContext(await readFile(new URL('../src/site.js', import.meta.url), 'utf8'), {
    document: { querySelector: (selector) => nodes[selector] || null }
  });
  const visible = () => cards.filter((card) => !card.hidden).map((card) => card.dataset.status);
  assert.equal(visible().length, 5);
  for (const [value, expected] of [['pending', ['pending']], ['review', ['partial', 'failed']],
    ['resolved', ['archived']], ['complete', ['complete']]]) {
    filter.value = value;
    filter.listeners.change();
    assert.deepEqual(visible(), expected);
  }
});
