import { access, rename, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { captureItemOwner, captureProfile, launch, saveProfilePicture } from './browser.mjs';
import { now, profileFromSnapshot } from './model.mjs';
import { mergeProfile, paths, readJson, writeJson, writeSnapshot } from './store.mjs';
import { writeReport } from './report.mjs';

const collectorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exec = promisify(execFile);
const validUsername = (value) => typeof value === 'string' && /^[A-Za-z0-9._]{1,30}$/.test(value);

function usernameFromUrl(value) {
  try {
    const part = new URL(value).pathname.split('/').filter(Boolean)[0];
    return validUsername(part) ? part : null;
  } catch { return null; }
}

function currentStoredUsername(recordUsername, profile) {
  return profile?.current_username || usernameFromUrl(profile?.url) || recordUsername;
}

function historyWithCurrent(profile, previous, current, observedAt) {
  const history = Array.isArray(profile?.username_history) && profile.username_history.length
    ? profile.username_history.map((entry) => ({ ...entry }))
    : [{ username: previous, role: 'previous username', first_seen_at: profile?.fetched_at || observedAt }];
  for (const entry of history) if (entry.username === previous) {
    entry.role = 'previous username';
    entry.last_seen_at = observedAt;
  }
  const existing = history.find((entry) => entry.username === current);
  if (existing) { existing.role = 'current username'; existing.last_seen_at = observedAt; }
  else history.push({ username: current, role: 'current username', first_seen_at: observedAt });
  return history;
}

function appendUnique(list, value, key = 'checked_at') {
  const values = Array.isArray(list) ? list : [];
  return [...values, value].filter((entry, index, all) => all.findIndex((candidate) => candidate[key] === entry[key]) === index);
}

async function dataFor(root, username) {
  const path = paths(root, username);
  const [profile, discovery, items, run] = await Promise.all([
    readJson(path.profile), readJson(path.discovery, {}), readJson(path.items, []), readJson(path.run, {})
  ]);
  return { path, profile, discovery, items, run };
}

function savedReel(discovery, items) {
  return discovery?.reel?.items?.find((item) => item?.url) || items.find((item) => item.kind === 'reel' && item.url) || null;
}

export async function checkUsernameChange(root, recordUsername, { headless = true } = {}) {
  const data = await dataFor(root, recordUsername);
  if (!data.profile) throw new Error(`No saved profile record exists for @${recordUsername}.`);
  const item = savedReel(data.discovery, data.items);
  if (!item) throw new Error('No saved reel URL is available for this profile. Discover reel URLs first.');
  const storedUsername = currentStoredUsername(recordUsername, data.profile);
  const checkedAt = now();
  let owner;
  let context;
  try {
    const launched = await launch(root, { headless });
    context = launched.context;
    owner = await captureItemOwner(launched.page, item);
  } finally { if (context) await context.close(); }
  const detectedUsername = owner.poster_username;
  const knownPrevious = (data.profile.username_history || []).some((entry) => entry.username?.toLowerCase() === detectedUsername.toLowerCase()
    && entry.username?.toLowerCase() !== storedUsername.toLowerCase());
  const changed = detectedUsername.toLowerCase() !== storedUsername.toLowerCase() && !knownPrevious;
  const result = {
    status: changed ? 'changed' : knownPrevious ? 'stale_history' : 'no_change',
    checked_at: checkedAt, record_username: recordUsername, stored_username: storedUsername,
    detected_username: detectedUsername, reel_url: item.url, source: owner.source,
    evidence: owner.evidence, page_url: owner.page_url,
    message: changed ? `Instagram shows @${detectedUsername} on the saved reel; the record points to @${storedUsername}.`
      : knownPrevious ? `The saved reel still identifies a previous username (@${detectedUsername}); no migration was applied.`
        : `The saved reel identifies the same username currently stored: @${storedUsername}.`
  };
  const profile = { ...data.profile, username_check: result,
    username_checks: appendUnique(data.profile.username_checks, result) };
  await writeJson(data.path.profile, profile);
  return result;
}

async function renameIfPresent(from, to) {
  try { await access(from); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  try { await access(to); throw new Error(`Cannot migrate because the target already exists: ${to}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rename(from, to);
  return true;
}

async function replaceActiveReference(file, previous, current) {
  try {
    const text = await readFile(file, 'utf8');
    if (text.includes(previous)) await writeFile(file, text.replaceAll(previous, current), 'utf8');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function updateMirror(root, previous, current, profile) {
  const directory = resolve(root, '..', 'data', 'database', 'profiles');
  const oldFile = join(directory, `profile-${previous}.json`);
  const newFile = join(directory, `profile-${current}.json`);
  let mirror = await readJson(oldFile, await readJson(newFile, {}));
  mirror = { ...mirror, username: current, previous_username: previous, current_username: current,
    url: profile.url, bio: profile.bio, country: profile.account_based_in, date_joined: profile.date_joined,
    posts_count: profile.posts_count?.raw ?? profile.posts_count?.value ?? null,
    last_fetched_at: profile.fetched_at, profile_text: profile.raw?.header_text || mirror.profile_text,
    about_text: profile.raw?.about_text || mirror.about_text, display_name: profile.display_name,
    username_history: profile.username_history, username_migrations: profile.username_migrations,
    followers_count: profile.followers_count, following_count: profile.following_count,
    category: profile.category, profile_picture_url: profile.profile_picture_url,
    former_usernames_count: profile.former_usernames_count };
  await writeJson(newFile, mirror);
  await renameIfPresent(oldFile, `${oldFile}.username-history.json`).catch(() => {});
}

async function updateCatalog(root, previous, current) {
  const catalogFile = resolve(root, '..', 'data', 'database', 'profiles', 'index.json');
  const catalog = await readJson(catalogFile);
  const keys = (catalog.profile_keys || []).map((key) => key === previous ? current : key);
  if (new Set(keys).size !== keys.length) throw new Error(`Cannot migrate @${previous}: @${current} is already in the catalog.`);
  await writeJson(catalogFile, { ...catalog, profile_keys: keys });
  return { ...catalog, profile_keys: keys };
}

export async function applyUsernameChange(root, recordUsername, requestedUsername, { headless = true, onProgress = () => {} } = {}) {
  if (!validUsername(requestedUsername)) throw new Error('Instagram returned an invalid username.');
  const data = await dataFor(root, recordUsername);
  const check = data.profile?.username_check;
  if (check?.status !== 'changed' || check.detected_username?.toLowerCase() !== requestedUsername.toLowerCase()) {
    throw new Error('Run the username-change checker first and apply the confirmed result.');
  }
  if (recordUsername.toLowerCase() === requestedUsername.toLowerCase()) throw new Error('The detected username is already the record username.');
  const previousUsername = currentStoredUsername(recordUsername, data.profile);
  if (previousUsername.toLowerCase() === requestedUsername.toLowerCase()) throw new Error('The profile already stores this username.');
  const oldBase = data.path.base;
  const newPath = paths(root, requestedUsername);
  const observedAt = now();
  await onProgress({ phase: 'history', detail: 'Saving the pre-migration profile, reel URLs, and reel details' });
  await writeSnapshot(data.path, { username: recordUsername, phase: 'before-username-migration', profile: data.profile,
    discovery: data.discovery, items: data.items, run: data.run });
  let context;
  let snapshot;
  try {
    await onProgress({ phase: 'profile', detail: `Fetching the current profile from @${requestedUsername}` });
    const launched = await launch(root, { headless });
    context = launched.context;
    snapshot = await captureProfile(launched.page, `https://www.instagram.com/${requestedUsername}/`);
    if (snapshot.profile_picture_url) {
      try { await saveProfilePicture(launched.page, data.path.profilePicture); }
      catch (error) { if (process.env.DEDGRAM_DEBUG) console.warn('Profile picture cache:', error.message); }
    }
  } finally { if (context) await context.close(); }
  const fresh = profileFromSnapshot(recordUsername, snapshot);
  const profile = { ...mergeProfile(data.profile, fresh), username: requestedUsername,
    original_username: data.profile.original_username || recordUsername,
    url: `https://www.instagram.com/${requestedUsername}/`, current_username: requestedUsername,
    username_history: historyWithCurrent(data.profile, previousUsername, requestedUsername, observedAt),
    username_change_observed_at: data.profile.username_change_observed_at || check.checked_at || observedAt,
    username_migrations: appendUnique(data.profile.username_migrations, {
      from: previousUsername, to: requestedUsername, detected_at: check.checked_at || observedAt,
      applied_at: observedAt, reel_url: check.reel_url, status: 'applied' }, 'applied_at'),
    username_check: { ...check, status: 'applied', applied_at: observedAt } };
  const discovery = { ...data.discovery,
    reel: data.discovery.reel ? { ...data.discovery.reel, refresh_required: true,
      refresh_reason: `Username changed from @${previousUsername} to @${requestedUsername}; rescan the current reel grid.`,
      previous_username: previousUsername } : data.discovery.reel };
  const run = { ...data.run, phase: 'profile', scope: ['profile'], updated_at: observedAt, status: 'complete', error: null };
  await writeJson(data.path.profile, profile);
  await writeJson(data.path.discovery, discovery);
  await writeJson(data.path.run, run);
  await writeReport(data.path, profile, discovery, data.items, run);
  await writeSnapshot(data.path, { username: requestedUsername, phase: 'after-username-migration', profile, discovery, items: data.items, run });
  await onProgress({ phase: 'storage', detail: 'Renaming the active profile record and preserving the old username in history' });
  await renameIfPresent(oldBase, newPath.base);
  const mirrorDirectory = resolve(root, '..', 'data', 'database', 'profiles');
  const oldMirror = join(mirrorDirectory, `profile-${recordUsername}.json`);
  const newMirror = join(mirrorDirectory, `profile-${requestedUsername}.json`);
  await renameIfPresent(oldMirror, newMirror);
  const showcase = resolve(root, '..', 'profile-showcase');
  await renameIfPresent(join(showcase, 'snapshot', recordUsername), join(showcase, 'snapshot', requestedUsername));
  await renameIfPresent(join(showcase, 'snapshot', 'media', `avatar-${recordUsername}.jpg`), join(showcase, 'snapshot', 'media', `avatar-${requestedUsername}.jpg`));
  await updateMirror(root, recordUsername, requestedUsername, profile);
  const catalog = await updateCatalog(root, recordUsername, requestedUsername);
  await writeJson(join(showcase, 'snapshot', 'index.json'), catalog);
  await replaceActiveReference(join(root, 'targets.json'), recordUsername, requestedUsername);
  await replaceActiveReference(join(showcase, 'scripts', 'sync.mjs'), recordUsername, requestedUsername);
  await replaceActiveReference(join(showcase, 'scripts', 'build-multi.mjs'), recordUsername, requestedUsername);
  await onProgress({ phase: 'public_snapshot', detail: 'Refreshing the public snapshot and static profile pages' });
  await exec(process.execPath, ['scripts', 'sync.mjs'], { cwd: showcase, maxBuffer: 4 * 1024 * 1024 });
  await exec(process.execPath, ['scripts', 'build.mjs'], { cwd: showcase, maxBuffer: 4 * 1024 * 1024 });
  return { previous_username: previousUsername, current_username: requestedUsername, profile, discovery, migration: profile.username_migrations.at(-1) };
}
