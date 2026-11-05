// Shared by collection, saved-record reconciliation and the standalone website.
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function calendarDay(year, month, day) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? parsed.toISOString().slice(0, 10) : null;
}

export function dayFromDescription(description) {
  const text = String(description || '');
  const matches = [...text.matchAll(/\bon\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/gi)];
  const english = matches.find((match) => /^\s*:/.test(text.slice(match.index + match[0].length))) || matches.at(-1);
  if (english) {
    const month = months.indexOf(english[1].slice(0, 3).toLowerCase()) + 1;
    if (month) return calendarDay(Number(english[3]), month, Number(english[2]));
  }
  const localized = [...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)].at(-1);
  return localized ? calendarDay(Number(localized[1]), Number(localized[2]), Number(localized[3])) : null;
}

function parsedDate(value, source) {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return calendarDay(year, month, day) ? { date: value, date_precision: 'day', date_source: source } : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return { date: new Date(value).toISOString(), date_precision: 'timestamp', date_source: source };
}

function structuredDate(value) {
  if (typeof value === 'string') {
    try { return structuredDate(JSON.parse(value)); } catch { return null; }
  }
  if (Array.isArray(value)) {
    for (const node of value) { const date = structuredDate(node); if (date) return date; }
  } else if (value && typeof value === 'object') {
    return parsedDate(value.uploadDate, 'json_ld') || parsedDate(value.datePublished, 'json_ld')
      || structuredDate(value['@graph']);
  }
  return null;
}

function ownDate(record) {
  const manual = record.manual_verification?.date;
  const known = parsedDate(manual?.value, 'user_manual_check') || parsedDate(record.date, record.date_source);
  if (known) return known;
  const timestamp = parsedDate(record.datetime || record.raw?.datetime, 'page_timestamp');
  if (timestamp) return timestamp;
  const structured = structuredDate(record.raw?.json_ld || record.json_ld);
  if (structured) return structured;
  for (const description of [record.raw?.description, record.og_description,
    record.raw?.meta?.['og:description'], record.meta?.['og:description'], record.meta?.description]) {
    const day = dayFromDescription(description);
    if (day) return { date: day, date_precision: 'day',
      date_source: /\d{4}年\d{1,2}月\d{1,2}日/.test(description) ? 'og_description_localized' : 'og_description' };
  }
  return null;
}

function sameReelObservation(record) {
  const check = record.deletion_check;
  if (check?.status !== 'exists' || !check.observed_details) return null;
  const shortcode = (url) => String(url || '').match(/\/(?:reel|reels|p)\/([\w-]+)(?:\/|$|\?)/)?.[1];
  const expected = record.shortcode || shortcode(record.url);
  const observed = shortcode(check.observed_details.page_url || check.page_url);
  return expected && observed === expected ? check.observed_details : null;
}

export function resolveReelDate(record) {
  return ownDate(record) || ownDate(sameReelObservation(record) || {});
}

export function normalizeReelDate(record) {
  const date = resolveReelDate(record);
  if (!date) return record;
  const next = { ...record, date: date.date, date_precision: date.date_precision };
  if (date.date_source) next.date_source = date.date_source;
  if (record.manual_verification?.date?.timezone) next.date_timezone = record.manual_verification.date.timezone;
  if (record.missing?.includes('date')) {
    next.missing = record.missing.filter((field) => field !== 'date');
    const { date: oldReason, ...remainingReasons } = record.missing_reasons || {};
    next.missing_reasons = remainingReasons;
  }
  if (record.status === 'partial' && !record.last_error
    && ['date', 'likes', 'comments', 'views'].every((field) => next[field] != null)) {
    next.status = 'complete';
  }
  // Fill a missing secondary date from the canonical record for this same reel.
  const observed = sameReelObservation(record);
  if (observed && !parsedDate(observed.date, observed.date_source)) {
    const secondaryDate = ownDate(observed) || date;
    next.deletion_check = { ...record.deletion_check, observed_details: { ...observed,
      date: secondaryDate.date, date_precision: secondaryDate.date_precision, date_source: secondaryDate.date_source || 'saved_record',
      ...(next.date_timezone ? { date_timezone: next.date_timezone } : {}),
      available_fields: [...new Set([...(observed.available_fields || []), 'date'])] } };
  }
  return JSON.stringify(next) === JSON.stringify(record) ? record : next;
}
