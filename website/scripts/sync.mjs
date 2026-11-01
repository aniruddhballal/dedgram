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
  'prxctm0l',
  'funny.exe07',
  'nhiftbl',
  'coopyyz',
  'movi.egaze',
  'kanika_s.0711',
  'pixa.300k',
  'madarameme0',
  'extreme_laugh_07',
  'jellyfish.m3mes'
];
const profileLevelProfiles = [
  'coldex7.ae',
  'illmisguideyou',
  '0ggyyyy__07',
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
  'bubble_tuanzi',
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
  'fun_fineee',
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
  'kabir.chaudhary69',
  'kanyeglazerwest',
  'kiddcat68',
  'kujo__o',
  'luffytheegear5',
  'manas.8x_',
  'maxx.__.zx4',
  'me_me_s31',
  'melonphernelia',
  'memeehubx69',
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
  'notmemezz',
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
  'positive.mpire',
  'puffinvalley',
  'raffater7',
  'reddyannacare_',
  'reellbuddy',
  'reelscantheal',
  'rokymental.1',
  'rooxxi.1',
  'ryumaaa_ae',
  'sallusmemer',
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
  'waytoway__',
  'woe_almighty',
  'xkenshutsu',
  'yapbaaz_',
  'yervin8_',
  'z4rxk0',
  'zennnooxx',
  'zkyus_',
  'zoya._100x',
  'zyr1x1',
  'turtle.4223253',
  'damon.maxx',
  'yearning.ok',
  'oproceve.br',
  'u1tron7',
  'herogram_50k',
];
const excludedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back', 'short_vibesz', 'oooiway', 'zuxxie.pov', 'extreme.laugh8', 'iron_block2', 'memes.fatafat'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...excludedProfiles];
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
for (const username of excludedProfiles) {
  const profile = JSON.parse(await readFile(join(repo, 'data', 'database', 'profiles', `profile-${username}.json`), 'utf8'));
  excludedRecords[username] = {
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
await writeFile(join(snapshot, 'resolutions.json'), JSON.stringify({ schema_version: 1, profiles: excludedRecords }, null, 2) + '\n', 'utf8');
const mediaDir = join(snapshot, 'media');
await mkdir(mediaDir, { recursive: true });
const images = [];
for (const username of [...fullProfiles, ...profileLevelProfiles]) {
  const source = join(repo, 'collector', 'data', sourceUsername(username));
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
console.log(`Snapshot updated: ${catalog.profile_keys.length} profiles, ${publishedProfiles.length} published records (${excludedProfiles.length} excluded after initial collection), ${saved} images saved, ${failed} unavailable.`);
