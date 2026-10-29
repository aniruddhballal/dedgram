import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(site, '..');
const snapshot = join(site, 'snapshot');
const usernameAliases = {
  'edlt.shox': 'coldex7.ae'
};
const sourceUsername = (username) => Object.entries(usernameAliases).find(([, current]) => current === username)?.[0] || username;
const fullProfiles = [
  'pexe.bh',
  'pigeon.flac',
  'reposted',
  'pichypeapp',
  'printamovie',
  'crick_video_07',
  'damn_nigas',
  'james_basas',
  'mikre_film',
  'scoobyjacks_',
  'the.ravshanbek_',
  'blunt.fun4'
];
const profileLevelProfiles = ['coldex7.ae', 'illmisguideyou'];
const resolvedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back', 'short_vibesz', 'oooiway', 'zuxxie.pov', 'extreme.laugh8', 'iron_block2', 'memes.fatafat'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...resolvedProfiles];
const files = ['profile.json', 'discovery.json', 'items.json', 'run.json', 'profile.csv', 'items.csv', 'report.html'];
const sourceCatalog = JSON.parse(await readFile(join(repo, 'data', 'database', 'profiles', 'index.json'), 'utf8'));
const catalog = {
  ...sourceCatalog,
  profile_keys: sourceCatalog.profile_keys.map((username) => usernameAliases[username] || username)
};
if (!Array.isArray(catalog.profile_keys) || publishedProfiles.some((username) => !catalog.profile_keys.includes(username))) {
  throw new Error(`The profile catalog must contain ${publishedProfiles.join(', ')}.`);
}
await writeFile(join(snapshot, 'index.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
const resolved = {};
for (const username of resolvedProfiles) {
  const profile = JSON.parse(await readFile(join(repo, 'data', 'database', 'profiles', `profile-${username}.json`), 'utf8'));
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
  const source = join(repo, 'collectorV2', 'data', sourceUsername(username));
  await mkdir(join(snapshot, username), { recursive: true });
  for (const file of files) {
    if (file === 'profile.json' || file === 'profile.csv') continue;
    await copyFile(join(source, file), join(snapshot, username, file));
  }
  const profile = JSON.parse(await readFile(join(source, 'profile.json'), 'utf8'));
  profile.username = username;
  await writeFile(join(snapshot, username, 'profile.json'), JSON.stringify(profile, null, 2) + '\n', 'utf8');
  const profileCsv = await readFile(join(source, 'profile.csv'), 'utf8');
  const profileCsvLines = profileCsv.split(/\r?\n/);
  if (profileCsvLines[1]) profileCsvLines[1] = profileCsvLines[1].replace(/^"[^"]*"/, JSON.stringify(username));
  await writeFile(join(snapshot, username, 'profile.csv'), profileCsvLines.join('\n'), 'utf8');
  const items = JSON.parse(await readFile(join(source, 'items.json'), 'utf8'));
  images.push({ file: `avatar-${username}.jpg`, url: profile.profile_picture_url });
  images.push(...items.filter((item) => item.kind === 'reel' && /^[\w-]+$/.test(item.shortcode))
    .map((item) => ({ file: `${item.shortcode}.jpg`, url: item.thumbnail_url })));
}
for (const previousUsername of Object.keys(usernameAliases)) {
  await rm(join(snapshot, previousUsername), { recursive: true, force: true });
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
