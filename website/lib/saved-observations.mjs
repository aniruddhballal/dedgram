import { normalizeReelDate } from './reel-date.mjs';

const metrics = ['likes', 'comments', 'views', 'shares', 'reshares'];
const reelFields = ['date', 'caption', ...metrics, 'thumbnail_url', 'media_url'];
const profileFields = ['display_name', 'bio', 'category', 'account_based_in', 'date_joined',
  'posts_count', 'followers_count', 'following_count', 'profile_picture_url'];
const present = value => value !== null && value !== undefined && value !== '';
const hasValue = (field, value) => metrics.includes(field)
  ? Number.isFinite(value?.value) || Boolean(parseSavedCount(value?.raw))
  : present(value);

export function parseSavedCount(label) {
  const match = String(label ?? '').trim().match(/^(\d[\d,]*(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;
  const value = Number(match[1].replaceAll(',', '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase()] || 1);
  return Number.isFinite(value) ? { value, raw: String(label), approximate: Boolean(match[2]) } : null;
}

function invalidated(record, field) {
  return Boolean(record?.metric_corrections?.[field])
    || /incorrect|misclassif|unverified|ambiguous|manually identified/i.test(record?.missing_reasons?.[field] || '');
}

function fill(record, candidates, fields) {
  const result = structuredClone(record);
  for (const field of fields) {
    if (hasValue(field, result[field])) continue;
    // A correction is evidence against restoring older, known-bad numbers.
    if (metrics.includes(field) && [record, ...candidates.map(c => c.record)].some(r => invalidated(r, field))) continue;
    const candidate = candidates.find(c => hasValue(field, c.record?.[field]));
    if (!candidate) continue;
    result[field] = structuredClone(candidate.record[field]);
    const observedAt = candidate.record[field]?.observed_at || candidate.record.fetched_at || null;
    if (metrics.includes(field) && result[field] && typeof result[field] === 'object') {
      result[field].observed_at ||= observedAt;
    }
    result.saved_observations = { ...result.saved_observations, [field]: {
      source: candidate.record[field]?.source || 'saved_record', observed_at: observedAt,
      retained_from: candidate.source
    } };
    if (field === 'date') for (const key of ['date_precision', 'date_source', 'date_timezone', 'manual_verification']) {
      if (candidate.record[key] !== undefined) result[key] = structuredClone(candidate.record[key]);
    }
  }
  return result;
}

export function retainProfileObservations(current, candidates = []) {
  return fill(current, candidates, profileFields);
}

export function retainReelObservations(current, candidates = [], grid = null, gridObservedAt = null) {
  let result = fill(current, candidates, reelFields);
  for (const field of metrics) {
    const value = result[field];
    if (!value || typeof value !== 'object') continue;
    if (!Number.isFinite(value.value)) {
      const parsed = parseSavedCount(value.raw);
      if (parsed) Object.assign(value, parsed);
    }
    if (value.observed_at) continue;
    const observedAt = value.source === 'profile_grid'
      ? result.grid_views_observed_at || (value.raw === grid?.grid_views_raw ? gridObservedAt : null)
      : null;
    if (observedAt) value.observed_at = observedAt;
  }
  if (!hasValue('views', result.views) && !invalidated(result, 'views')) {
    const label = grid?.grid_views_raw || result.grid_views_raw;
    const metric = parseSavedCount(label);
    if (metric) result.views = { ...metric, source: 'profile_grid',
      observed_at: grid?.grid_views_observed_at || gridObservedAt || result.grid_views_observed_at || null };
  }
  // Existing status/missing fields describe collection work; display fallbacks do not promote it.
  return normalizeReelDate(result);
}

export function savedReelRows(discovery, items) {
  const byUrl = new Map(items.filter(i => i.kind === 'reel').map(i => [i.url, i]));
  const grid = discovery?.reel;
  return (grid?.items || []).map(item => retainReelObservations(
    byUrl.get(item.url) || { ...item, kind: 'reel', status: 'pending' }, [], item, grid.attempted_at));
}
