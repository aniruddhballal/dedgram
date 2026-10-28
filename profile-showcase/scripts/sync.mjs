import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(site, '..');
const snapshot = join(site, 'snapshot');
const fullProfiles = ['edlt.shox', 'pexe.bh', 'pigeon.flac', 'reposted', 'pichypeapp', 'printamovie'];
const profileLevelProfiles = ['illmisguideyou'];
const resolvedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back', 'short_vibesz', 'oooiway', 'zuxxie.pov', 'extreme.laugh8', 'iron_block2', 'memes.fatafat'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...resolvedProfiles];
const files = ['profile.json', 'discovery.json', 'items.json', 'run.json', 'profile.csv', 'items.csv', 'report.html'];
const catalog = JSON.parse(await readFile(join(repo, 'bot-info', 'database', 'profiles', 'index.json'), 'utf8'));
if (!Array.isArray(catalog.profile_keys) || publishedProfiles.some((username) => !catalog.profile_keys.includes(username))) {
  throw new Error(`The profile catalog must contain ${publishedProfiles.join(', ')}.`);
}
await copyFile(join(repo, 'bot-info', 'database', 'profiles', 'index.json'), join(snapshot, 'index.json'));
const resolved = {};
for (const username of resolvedProfiles) {
  const profile = JSON.parse(await readFile(join(repo, 'bot-info', 'database', 'profiles', `profile-${username}.json`), 'utf8'));
  resolved[username] = {
    username,
    status: profile.status,
    observed_at: profile.account_status_observed_at || profile.last_fetched_at,
    last_fetched_at: profile.last_fetched_at,
    profile_text: profile.profile_text || null,
    bio: profile.bio || null,
    country: profile.country || null,
    date_joined: profile.date_joined || null,
    posts_count: profile.posts_count || null,
    deletion_date_range: profile.deletion_date_range || null,
    age_restriction: profile.age_restriction || null,
    minimum_age: profile.minimum_age || profile.age_restriction?.minimum_age || null,
    false_identification: profile.false_identification || null,
    resolution_note: profile.resolution_note || null,
    reason: profile.last_error || null
  };
}
await writeFile(join(snapshot, 'resolutions.json'), JSON.stringify({ schema_version: 1, profiles: resolved }, null, 2) + '\n', 'utf8');
const mediaDir = join(snapshot, 'media');
await mkdir(mediaDir, { recursive: true });
const images = [];
for (const username of [...fullProfiles, ...profileLevelProfiles]) {
  const source = join(repo, 'collector-v2', 'data', username);
  await mkdir(join(snapshot, username), { recursive: true });
  for (const file of files) await copyFile(join(source, file), join(snapshot, username, file));
  const profile = JSON.parse(await readFile(join(source, 'profile.json'), 'utf8'));
  const items = JSON.parse(await readFile(join(source, 'items.json'), 'utf8'));
  images.push({ file: `avatar-${username}.jpg`, url: profile.profile_picture_url });
  images.push(...items.filter((item) => item.kind === 'reel' && /^[\w-]+$/.test(item.shortcode))
    .map((item) => ({ file: `${item.shortcode}.jpg`, url: item.thumbnail_url })));
}
let saved = 0;
let failed = 0;
for (let i = 0; i < images.length; i += 6) {
  await Promise.all(images.slice(i, i + 6).map(async ({ file, url }) => {
    if (!url) { failed++; return; }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`HTTP ${response.status}`);
      await writeFile(join(mediaDir, file), Buffer.from(await response.arrayBuffer()));
      saved++;
    } catch (error) {
      failed++;
      console.warn(`Could not refresh ${file}: ${error.message}`);
    }
  }));
}
console.log(`Snapshot updated: ${catalog.profile_keys.length} profiles, ${publishedProfiles.length} published records (${resolvedProfiles.length} resolved), ${saved} images saved, ${failed} unavailable.`);
