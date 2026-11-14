import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeReelDate } from '../lib/reel-date.mjs';
import { retainProfileObservations, retainReelObservations, savedReelRows } from '../lib/saved-observations.mjs';
import { writeReport } from '../../collector/src/report.mjs';

async function optionalJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function savedHistory(directory) {
  let entries;
  try { entries = await readdir(join(directory, 'history'), { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const names = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) =>
    b.slice(0, 24).localeCompare(a.slice(0, 24)) || Number(b.includes('-after')) - Number(a.includes('-after')) || b.localeCompare(a));
  const history = [];
  for (const name of names) {
    const base = join(directory, 'history', name);
    history.push({ source: `collector/history/${name}`, profile: await optionalJson(join(base, 'profile.json'), null),
      items: await optionalJson(join(base, 'items.json'), []) });
  }
  return history;
}

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(site, '..');
const snapshot = join(site, 'snapshot');
const offline = process.argv.includes('--offline');
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
  'blunt.fun4',
  'not.your.ordinary.nga',
  '9ineesss',
  'hulksmash.exe',
  'diamond_bl0ckk',
  'memesprcaf',
  'not.yourtyppee',
  'renee30287',
  'reelrestock',
  'bollyxedit.7',
  'dark_man1__',
  'hazelxpost',
  'pranto_harryson',
  'nastynigas',
  'dank.meemz420',
  'funny.exe07',
  'nhiftbl',
  'coopyyz',
  'movi.egaze',
  'kanika_s.0711',
  'pixa.300k',
  'madarameme0',
  'extreme_laugh_07',
  'damon.maxx',
  'turtle.4223253',
  'herogram_50k',
  'sallusmemer',
  'bubble_tuanzi',
  'fun_fineee',
  'notmemezz',
  'memeehubx69',
  '0ggyyyy__07',
  'positive.mpire',
  'kabir.chaudhary69',
  'relatable.fun1'
];
const profileLevelProfiles = [
  'coldex7.ae',
  'illmisguideyou',
  '1sntreal',
  '2xamca',
  '777.psps',
  'aiza.editzzz',
  'amanrajxofficial_12',
  'anngry_birrds',
  'arthurmoviegan',
  'asapcoder.exe',
  'auraaluuxx',
  'ballsitchingshi',
  'bingomovie_',
  'birobidzanih',
  'blogger',
  'borrsack',
  'brainrotnic',
  'camilaboucheryamamoto',
  'cartoon_.xhub',
  'circflix',
  'cliprotter67',
  'crustykid67',
  'doomscroll.dumpling',
  'farf_allajade',
  'fayziyevv_org',
  'femtaility',
  'filmrollstoriess',
  'freddy.memes',
  'ft.neyz',
  'futureshock3272',
  'girlsgetitt',
  'goofvault',
  'goofybara777',
  'gzfr',
  'hezciv',
  'hi.bytezen',
  'iblamealanz',
  'ijuggminors',
  'internetdamage8',
  'intr0vert.viks',
  'its_thanos.battle',
  'jace_zn',
  'kanyeglazerwest',
  'kiddcat68',
  'kujo__o',
  'manas.8x_',
  'maxx.__.zx4',
  'me_me_s31',
  'melonphernelia',
  'memekarbo',
  'memesupreme.tv',
  'memeswithsanju',
  'micro.siss',
  'moviebouncee',
  'mr_oggy_114',
  'mugiwaramemez',
  'natsukisubaru.exe',
  'nixk.xyz',
  'noglitch00',
  'nreanimnida',
  'oggy675908',
  'onlyhi_story_',
  'padrinhos.exe',
  'pastwillhunt666',
  'paystasongta',
  'pigeonlarping',
  'pinkjohnrp',
  'pop.lore_x',
  'popcornparade',
  'pophistoryhub',
  'puffinvalley',
  'raffater7',
  'reddyannacare_',
  'reellbuddy',
  'reelscantheal',
  'rokymental.1',
  'rooxxi.1',
  'ryumaaa_ae',
  'sankuro75',
  'slleep91',
  'slopcorn.exe',
  'solvik.editz9',
  'soul_reaper261',
  'starson.ig',
  'stuckonyourfyp',
  'thoughtsby.div',
  'thragg_grand_regentnumber1',
  'tom4our',
  'toyirov.40k',
  'tretinfhh',
  'twinkiewinkie3',
  'ubncu',
  'uz87b',
  'vexo.7k',
  'vviennteru',
  'wayneeeeeeeeeeeeeeeeeeeeeeq',
  'woe_almighty',
  'xkenshutsu',
  'yapbaaz_',
  'yervin8_',
  'z4rxk0',
  'zennnooxx',
  'zkyus_',
  'zoya._100x',
  'zyr1x1',
  'editor',
  'black.airforce.nigga',
  '2many_memes_in_my_camera_roll',
  'guywithbadmemes69',
  'zosttfeed',
  'slopfeed100m',
  'zosttified',
  'yearning.ok',
  'oproceve.br',
  'u1tron7',
  'cusohln',
  'the.nigaaa',
  'v.thu.viral',
  'viralxvaultt9',
  'yappersteak',
  'npcahhdiary',
  'xerrt.x6',
  'lookcrezz',
  'nkaze.kage',
  'zozo_phio',
  'alligator.97841538',
  'shiel.void1',
  'reelsorax',
  'oggyworldd3',
  'daskx.psl',
  'missp.riyax1',
  'duck.1197157',
  'cora.deep_125',
  'robloxmavix',
  'salmahayekfeetluvr',
  'kairooo605',
  'paul.edits12',
  'rayimov_04k',
  'vega.sandy_800',
  'goog.nhy',
  'witchmasuka',
  'chipmunk.46149483',
  'alligator.3224328',
  'frow.den',
  'ksoso_78',
  'gifted.camille_692',
  'emilily_ss',
  'dina4988542',
];
const retainedMetricProfiles = ['jellyfish.m3mes', 'prxctm0l'];
const excludedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back', '41.3k', 'short_vibesz', 'oooiway', 'zuxxie.pov', 'extreme.laugh8', 'iron_block2', 'memes.fatafat', 'waytoway__', 'luffytheegear5', 'chir.eze', 'dinosaur.24252627'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...retainedMetricProfiles, ...excludedProfiles];
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
const excludedRecords = {};
for (const username of [...excludedProfiles, ...retainedMetricProfiles]) {
  const profile = JSON.parse(await readFile(join(repo, 'data', 'database', 'profiles', `profile-${username}.json`), 'utf8'));
  excludedRecords[username] = {
    username,
    status: profile.account_status === 'deleted' ? 'Deleted or username changed' : profile.status,
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
    saved_data_available: profile.saved_data_available || false,
    deletion_assessment: profile.deletion_assessment || null,
    reason: profile.resolution_note || profile.last_error || null,
    exclusion: profile.exclusion || null,
    excluded_from_collection: Boolean(profile.excluded_from_collection),
    retained_metrics_in_analysis: Boolean(profile.retained_metrics_in_analysis)
  };
}
await writeFile(join(snapshot, 'resolutions.json'), JSON.stringify({ schema_version: 1, profiles: excludedRecords }, null, 2) + '\n', 'utf8');
const mediaDir = join(snapshot, 'media');
await mkdir(mediaDir, { recursive: true });
const images = [];
const excludedSnapshotProfiles = excludedProfiles.filter((username) => excludedRecords[username].saved_data_available);
for (const username of [...fullProfiles, ...profileLevelProfiles, ...retainedMetricProfiles, ...excludedSnapshotProfiles]) {
  const source = join(repo, 'collector', 'data', sourceUsername(username));
  const previousProfile = await optionalJson(join(snapshot, username, 'profile.json'), null);
  const previousItems = await optionalJson(join(snapshot, username, 'items.json'), []);
  const history = await savedHistory(source);
  await mkdir(join(snapshot, username), { recursive: true });
  for (const file of files) {
    if (file === 'profile.json' || file === 'profile.csv' || file === 'items.json') continue;
    if (file === 'discovery.json') {
      try { await copyFile(join(source, file), join(snapshot, username, file)); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await writeFile(join(snapshot, username, file), JSON.stringify({ reel: { items: [], complete: false, error: 'Grid has not been scanned.', attempted_at: null } }, null, 2) + '\n');
      }
      continue;
    }
    await copyFile(join(source, file), join(snapshot, username, file));
  }
  const profile = retainProfileObservations(JSON.parse(await readFile(join(source, 'profile.json'), 'utf8')),
    [...history.map(h => ({ record: h.profile, source: h.source })), { record: previousProfile, source: 'previous_website_snapshot' }]);
  profile.username = username;
  await writeFile(join(snapshot, username, 'profile.json'), JSON.stringify(profile, null, 2) + '\n', 'utf8');
  const profileCsv = await readFile(join(source, 'profile.csv'), 'utf8');
  const profileCsvLines = profileCsv.split(/\r?\n/);
  if (profileCsvLines[1]) profileCsvLines[1] = profileCsvLines[1].replace(/^"[^"]*"/, JSON.stringify(username));
  await writeFile(join(snapshot, username, 'profile.csv'), profileCsvLines.join('\n'), 'utf8');
  const discovery = await optionalJson(join(snapshot, username, 'discovery.json'), {});
  const grids = new Map((discovery.reel?.items || []).map(item => [item.url, item]));
  const candidates = new Map();
  for (const saved of [...history, { source: 'previous_website_snapshot', items: previousItems }]) {
    for (const record of saved.items) {
      if (!candidates.has(record.url)) candidates.set(record.url, []);
      candidates.get(record.url).push({ record, source: saved.source });
    }
  }
  const currentItems = JSON.parse(await readFile(join(source, 'items.json'), 'utf8'));
  const currentUrls = new Set(currentItems.map(item => item.url));
  for (const [url, saved] of candidates) if (!currentUrls.has(url) && grids.has(url)) {
    currentItems.push(saved[0].record);
  }
  const items = currentItems.map(item => retainReelObservations(normalizeReelDate(item), candidates.get(item.url) || [],
    grids.get(item.url), discovery.reel?.attempted_at));
  await writeFile(join(snapshot, username, 'items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');
  // Regenerate exports from the same retained observations used by the website.
  await writeReport({ base: join(snapshot, username), csv: join(snapshot, username, 'items.csv'),
    profileCsv: join(snapshot, username, 'profile.csv'), report: join(snapshot, username, 'report.html') }, profile, discovery,
    [...items.filter(item => item.kind !== 'reel'), ...savedReelRows(discovery, items)],
    await optionalJson(join(source, 'run.json'), {}));
  images.push({ file: `avatar-${username}.jpg`, url: profile.profile_picture_url });
  if (offline) {
    try { await copyFile(join(source, 'profile.jpg'), join(mediaDir, `avatar-${username}.jpg`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  images.push(...items.filter((item) => item.kind === 'reel' && /^[\w-]+$/.test(item.shortcode))
    .map((item) => ({ file: `${item.shortcode}.jpg`, url: item.thumbnail_url })));
}
for (const previousUsername of Object.keys(usernameAliases)) {
  await rm(join(snapshot, previousUsername), { recursive: true, force: true });
}
let saved = 0;
let failed = 0;
for (let i = 0; !offline && i < images.length; i += 6) {
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
console.log(`Snapshot updated: ${catalog.profile_keys.length} profiles, ${publishedProfiles.length} published records (${excludedProfiles.length} excluded after initial collection), ${saved} images saved, ${failed} unavailable.`);
