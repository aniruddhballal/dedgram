import { mergeItem } from './store.mjs';

export function captureTime(value) {
  const number = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
  const date = new Date(number);
  if (!Number.isFinite(number) || !Number.isFinite(date.getTime())) throw new Error('Invalid Android observation time');
  return date.toISOString();
}

function observedMetric(record, field) {
  const metric = record[field];
  if (metric?.value == null) return null;
  if (!Number.isSafeInteger(metric.value) || metric.value < 0) throw new Error(`Invalid ${field} count on ${record.shortcode}`);
  const retained = record.retained_observations?.[field];
  if (metric.error && !retained) return null;
  return { value: metric.value, raw: String(metric.value), approximate: false,
    source: 'instagram_android_ui', observed_at: captureTime(retained?.captured_at || record.captured_at) };
}

function preferRecent(previous, current, previousTime) {
  if (!current) return previous ?? null;
  const oldTime = Date.parse(previous?.observed_at || previousTime || '');
  return previous && Number.isFinite(oldTime) && oldTime > Date.parse(current.observed_at) ? previous : current;
}

export function mergeAndroidCapture(previous, capture, queueEntry, importedAt) {
  if (capture.shortcode !== previous.shortcode || !capture.url?.includes(`/reel/${previous.shortcode}/`)) throw new Error('Reel shortcode mismatch');
  if (!queueEntry || captureTime(queueEntry.captured_at) !== captureTime(capture.captured_at)) throw new Error('Queue/result checkpoint mismatch');
  if (!['collected', 'partial'].includes(queueEntry.status)) throw new Error('Unverified capture cannot replace a collector item');
  if (!capture.caption_expanded || capture.caption?.error || !capture.caption?.value || capture.navigation_error
      || !capture.account || !['queue_deep_link_and_account_check', 'manual_copy_link_and_account_confirmation'].includes(capture.identity_source)) {
    throw new Error(`Capture identity/caption was not verified: ${capture.shortcode}`);
  }
  if (queueEntry.expected_account?.toLowerCase() !== capture.account.toLowerCase()) throw new Error('Capture account mismatch');
  const fetchedAt = captureTime(capture.captured_at);
  const metrics = {};
  for (const [target, source] of Object.entries({ likes: 'likes', comments: 'comments', views: 'views_or_plays', reshares: 'reposts', shares: 'shares', saves: 'saves' })) {
    metrics[target] = preferRecent(previous[target], observedMetric(capture, source), previous.fetched_at);
  }
  const caption = capture.caption.value;
  const available = Object.fromEntries(Object.entries(capture.metric_availability || {}).map(([field, value]) => [field, value]));
  const availability = {};
  if (capture.likes_availability === 'owner_only') availability.likes = {
    state: 'explicitly_hidden', evidence: 'Instagram Android Likes and plays explicitly indicated owner-only likes', source: 'instagram_android_ui'
  };
  const current = {
    ...previous, ...metrics, caption, fetched_at: fetchedAt, last_attempt_at: fetchedAt,
    last_error: null, access_review: null, extraction_review: null, analysis_resolution: null,
    hashtags: [...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) || [])],
    mentions: [...new Set(caption.match(/@[A-Za-z0-9._]+/g) || [])],
    observed_owner_username: capture.account,
    owner_identity_observation: { source: capture.identity_source, observed_at: fetchedAt,
      historical_account: capture.historical_account || queueEntry.historical_expected_account || null,
      verification: queueEntry.identity_verification || null },
    publication_observation: capture.publication_observation || null,
    metric_availability: available,
    android_import: { imported_at: importedAt, captured_at: fetchedAt, phone_status: queueEntry.status,
      source: 'Documents/dedgram/reels.json', capture_method: capture.capture_method || 'android_queue' },
    raw: { ...previous.raw, android_capture: capture,
      article_text: `Android reel capture by ${capture.account}\n${caption}\n${capture.date_posted?.value || ''}`,
      engagement: { availability }, capture_checks: { access_clear: true, stable: true,
        source: capture.identity_source, caption_expanded: true } }
  };
  // Keep established canonical dates. A yearless/relative phone label is an
  // observation, not an independently established calendar date or timestamp.
  const result = mergeItem(previous, current);
  if (result.status === 'partial') result.extraction_review = 'Android capture remains incomplete; unresolved fields are not confirmed unavailable.';
  return result;
}
