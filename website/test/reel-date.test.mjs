import test from 'node:test';
import assert from 'node:assert/strict';
import { dayFromDescription, normalizeReelDate, resolveReelDate } from '../lib/reel-date.mjs';

test('metadata calendar dates do not require a trailing colon', () => {
  assert.equal(dayFromDescription('Caption - @positive.mpire on August 8, 2026'), '2026-08-08');
  assert.equal(dayFromDescription('12 likes - example on October 1, 2026: "We met on August 8, 2025"'), '2026-10-01');
  assert.equal(dayFromDescription('「Caption」 - 2026年10月12日、example'), '2026-10-12');
  assert.equal(dayFromDescription('example on February 30, 2026'), null);
  assert.equal(dayFromDescription('example on February 29, 2028'), '2028-02-29');
});

test('saved metadata repairs the primary date and its missing-field flags', () => {
  const record = { status: 'partial', date: null, missing: ['date', 'likes', 'comments'],
    missing_reasons: { date: 'Parser missed date', likes: 'Missing likes', comments: 'Missing comments' },
    raw: { description: 'Caption - @positive.mpire on August 8, 2026' } };
  const result = normalizeReelDate(record);
  assert.equal(result.date, '2026-08-08');
  assert.equal(result.date_precision, 'day');
  assert.equal(result.date_source, 'og_description');
  assert.deepEqual(result.missing, ['likes', 'comments']);
  assert.equal(result.missing_reasons.date, undefined);
  assert.equal(result.status, 'partial');
  assert.equal(record.date, null);
});

test('a date-only structured value remains a calendar day instead of invented midnight', () => {
  assert.deepEqual(resolveReelDate({ json_ld: ['{"uploadDate":"2026-08-08"}'] }),
    { date: '2026-08-08', date_precision: 'day', date_source: 'json_ld' });
  assert.equal(resolveReelDate({ datetime: 'invalid', json_ld: { datePublished: '2026-08-08T12:30:00Z' } }).date,
    '2026-08-08T12:30:00.000Z');
});

test('known timestamps and manually checked IST dates take priority over metadata', () => {
  const exact = normalizeReelDate({ date: '2026-08-08T12:30:00.000Z', date_precision: 'timestamp',
    raw: { description: 'example on August 9, 2026' } });
  assert.equal(exact.date, '2026-08-08T12:30:00.000Z');
  const manual = normalizeReelDate({ date: '2026-10-14', date_source: 'og_description',
    manual_verification: { date: { value: '2026-10-15', timezone: 'Asia/Kolkata', verified_by: 'user' } },
    raw: { description: 'example on October 14, 2026' } });
  assert.equal(manual.date, '2026-10-15');
  assert.equal(manual.date_source, 'user_manual_check');
  assert.equal(manual.date_timezone, 'Asia/Kolkata');
  assert.equal(manual.raw.description, 'example on October 14, 2026');
});

test('a secondary observation for the same reel fills a missing primary date', () => {
  const result = normalizeReelDate({ shortcode: 'SAME', date: null, status: 'partial', missing: ['date'],
    likes: { value: 1 }, comments: { value: 0 }, views: { value: 50 },
    deletion_check: { status: 'exists', observed_details: { page_url: 'https://www.instagram.com/reel/SAME/',
      date: '2026-08-08', date_precision: 'day', date_source: 'og_description' } } });
  assert.equal(result.date, '2026-08-08');
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.missing, []);
});

test('a known primary date fills an empty secondary date for the same reel', () => {
  const result = normalizeReelDate({ shortcode: 'SAME', date: '2026-08-08', date_precision: 'day',
    deletion_check: { status: 'exists', page_url: 'https://www.instagram.com/reel/SAME/',
      observed_details: { date: null, available_fields: ['views'] } } });
  assert.equal(result.deletion_check.observed_details.date, result.date);
  assert.deepEqual(result.deletion_check.observed_details.available_fields, ['views', 'date']);
});

test('a secondary metadata date fills both empty date fields without another fetch', () => {
  const result = normalizeReelDate({ shortcode: 'SAME', date: null,
    deletion_check: { status: 'exists', page_url: 'https://www.instagram.com/reel/SAME/',
      observed_details: { date: null, raw: { description: 'example on August 8, 2026' } } } });
  assert.equal(result.date, '2026-08-08');
  assert.equal(result.deletion_check.observed_details.date, result.date);
});

test('an unavailable or different reel cannot supply the missing date', () => {
  for (const [status, shortcode] of [['deleted', 'SAME'], ['exists', 'OTHER']]) {
    const record = { shortcode: 'SAME', date: null, deletion_check: { status,
      observed_details: { page_url: `https://www.instagram.com/reel/${shortcode}/`, date: '2026-08-08' } } };
    assert.equal(normalizeReelDate(record).date, null);
  }
});

test('recovering a date never reopens or completes a manually deleted reel', () => {
  const result = normalizeReelDate({ status: 'archived', missing: [],
    raw: { description: 'example on August 8, 2026' } });
  assert.equal(result.date, '2026-08-08');
  assert.equal(result.status, 'archived');
});
