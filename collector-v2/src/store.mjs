import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { count, reasonsForMissing } from './model.mjs';

export async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  try {
    for (let attempt = 0; ; attempt++) {
      try { await rename(temporary, path); return; }
      catch (error) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 7) throw error;
        await delay(Math.min(800, 50 * 2 ** attempt));
      }
    }
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export function paths(root, username) {
  const base = join(root, 'data', username);
  return {
    base,
    history: join(base, 'history'),
    profile: join(base, 'profile.json'),
    profilePicture: join(base, 'profile.jpg'),
    discovery: join(base, 'discovery.json'),
    items: join(base, 'items.json'),
    run: join(base, 'run.json'),
    report: join(base, 'report.html'),
    csv: join(base, 'items.csv'),
    profileCsv: join(base, 'profile.csv')
  };
}

export async function writeSnapshot(pathSet, { username, phase, snapshotAt, profile, discovery, items, run }) {
  const observedAt = snapshotAt || new Date().toISOString();
  const directory = join(pathSet.history, `${observedAt.replace(/[:.]/g, '-')}-${phase}-${randomUUID()}`);
  const savedItems = Array.isArray(items) ? items : [];
  const savedDiscovery = discovery && typeof discovery === 'object' ? discovery : {};
  const manifest = {
    schema_version: 1,
    username,
    phase,
    snapshot_at: observedAt,
    run_status: run?.status || null,
    run_updated_at: run?.updated_at || null,
    profile_fetched_at: profile?.fetched_at || null,
    item_count: savedItems.length,
    complete_item_count: savedItems.filter((item) => item.status === 'complete').length,
    discovery: Object.fromEntries(Object.entries(savedDiscovery).map(([kind, value]) => [kind, {
      count: Array.isArray(value?.items) ? value.items.length : 0,
      complete: value?.complete ?? false,
      error: value?.error || null,
      attempted_at: value?.attempted_at || null
    }]))
  };
  await writeJson(join(directory, 'profile.json'), profile ?? null);
  await writeJson(join(directory, 'discovery.json'), savedDiscovery);
  await writeJson(join(directory, 'items.json'), savedItems);
  await writeJson(join(directory, 'run.json'), run || {});
  await writeJson(join(directory, 'manifest.json'), manifest);
  return directory;
}

export function mergeItem(previous, current) {
  if (!previous) return current;
  const result = { ...previous, ...current };
  for (const field of ['date', 'caption', 'likes', 'comments', 'views', 'thumbnail_url', 'media_url']) {
    if (result[field] == null && previous[field] != null) result[field] = previous[field];
  }
  if ((previous.date_precision === 'timestamp' || /^\d{4}-\d{2}-\d{2}T/.test(previous.date || ''))
    && current.date_precision !== 'timestamp') {
    result.date = previous.date;
    result.date_precision = 'timestamp';
  }
  result.status = ['date', 'likes', 'comments', 'views'].every((field) => result[field] != null) ? 'complete' : 'partial';
  result.missing = ['date', 'likes', 'comments', 'views'].filter((field) => result[field] == null);
  result.missing_reasons = reasonsForMissing(result.missing, result);
  return result;
}

export function syncGridViews(previous, discovered, observedAt) {
  const raw = discovered.grid_views_raw;
  if (!raw) {
    const result = { ...previous, grid_views_raw: previous.grid_views_raw || null,
    grid_views_issue: Object.hasOwn(discovered, 'grid_views_issue')
      ? discovered.grid_views_issue : previous.grid_views_issue || null };
    result.missing_reasons = reasonsForMissing(result.missing || [], result);
    return result;
  }
  const parsed = count(raw);
  const result = { ...previous, grid_views_raw: raw, grid_views_issue: null };
  if (parsed && (!previous.views || previous.views.source === 'profile_grid')) {
    result.views = { ...parsed, source: 'profile_grid', observed_at: observedAt };
    result.status = ['date', 'likes', 'comments', 'views'].every((field) => result[field] != null) ? 'complete' : 'partial';
    result.missing = ['date', 'likes', 'comments', 'views'].filter((field) => result[field] == null);
  }
  result.missing_reasons = reasonsForMissing(result.missing || [], result);
  return result;
}

export function mergeProfile(previous, current) {
  if (!previous) return current;
  const result = { ...previous, ...current };
  for (const field of ['display_name', 'bio', 'posts_count', 'followers_count', 'category', 'ai_generated_profile',
    'profile_picture_url', 'date_joined', 'account_based_in', 'former_usernames_count']) {
    if (result[field] == null && previous[field] != null) result[field] = previous[field];
  }
  if (current.posts_count == null) result.posts_count_observed_at = previous.posts_count_observed_at || null;
  return result;
}

export function mergeDiscoveryItems(previous, found, complete) {
  const saved = new Map(previous.map((item) => [item.url, item]));
  const observed = new Map(found.map((item) => [item.url, { ...saved.get(item.url), ...item }]));
  return [...(complete ? observed : new Map([...saved, ...observed])).values()];
}
