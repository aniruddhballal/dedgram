import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeReelDate } from '../lib/reel-date.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'snapshot');
const output = join(root, 'dist');
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
  'coldex7.ae',
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
  'jellyfish.m3mes',
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
const excludedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back', '41.3k', 'short_vibesz', 'oooiway', 'zuxxie.pov', 'extreme.laugh8', 'iron_block2', 'memes.fatafat', 'waytoway__', 'luffytheegear5', 'chir.eze'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...excludedProfiles];
const profileLevelSet = new Set(profileLevelProfiles);
const excludedSet = new Set(excludedProfiles);
const files = ['profile.json', 'discovery.json', 'items.json', 'run.json', 'profile.csv', 'items.csv', 'report.html'];
const readJson = async (name) => {
  const value = JSON.parse(await readFile(join(source, name), 'utf8'));
  return name.endsWith('/items.json') ? value.map(normalizeReelDate) : value;
};
const exclusionRecords = await readJson('resolutions.json');
const plainText = (value) => String(value ?? '').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u20E3]/gu, '');
const esc = (value) => plainText(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmt = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-IN').format(value) : 'Unavailable';
const instagram = (username) => `https://www.instagram.com/${encodeURIComponent(username)}/`;
const external = (url, label, className = '') => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(parsed.hostname)) throw new Error(`Invalid Instagram URL: ${url}`);
  return `<a class="${className}" href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
};
const metric = (value) => value?.raw || (Number.isFinite(value?.value) ? fmt(value.value) : 'Unavailable');
const date = (value, precision) => {
  if (!value) return 'Date unavailable';
  const dateOnly = precision === 'day' || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dateOnly ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
  const timeZone = dateOnly ? 'UTC' : 'Asia/Kolkata';
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(parsed);
};
const field = (label, value) => `<div class="fact"><dt>${esc(label)}</dt><dd>${esc(value ?? 'Unavailable')}</dd></div>`;
const localImage = async (file) => { try { await access(join(source, 'media', file)); return file; } catch { return null; } };

const index = await readJson('index.json');
if (!Array.isArray(index.profile_keys) || publishedProfiles.some((username) => !index.profile_keys.includes(username))) throw new Error('A published profile is missing from the catalog.');
if (!index.profile_keys.every((username) => /^[A-Za-z0-9._]{1,30}$/.test(username))) throw new Error('Catalog contains an invalid username.');
if (new Set(index.profile_keys).size !== index.profile_keys.length) throw new Error('Catalog contains duplicate usernames.');
const buildDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());

const snapshotData = new Map();
const excludedSnapshotProfiles = excludedProfiles.filter((username) => exclusionRecords.profiles?.[username]?.saved_data_available);
const snapshotProfiles = [...fullProfiles, ...profileLevelProfiles, ...excludedSnapshotProfiles];
for (const username of snapshotProfiles) {
  const [profile, discovery, items, run] = await Promise.all([
    readJson(`${username}/profile.json`), readJson(`${username}/discovery.json`),
    readJson(`${username}/items.json`), readJson(`${username}/run.json`)
  ]);
  snapshotData.set(username, { profile, discovery, items, run });
}
const zeroReelProfiles = new Set([...fullProfiles, ...profileLevelProfiles].filter((username) => {
  const snapshot = snapshotData.get(username);
  return snapshot?.discovery.reel?.complete === true && (snapshot.discovery.reel.items || []).length === 0;
}));

const numberMetric = (value) => Number.isFinite(value?.value) ? value.value : null;
const publishedSnapshotProfiles = [...fullProfiles, ...profileLevelProfiles];
const profileInstagramUrl = (username) => snapshotData.get(username)?.profile?.url || instagram(username);
const publishedReelRows = publishedSnapshotProfiles.flatMap((username) => {
  const snapshot = snapshotData.get(username);
  return (snapshot.items || []).filter((item) => item.kind === 'reel').map((item) => ({ username, ...item }));
});
// Discovery is historical: excluding an account must not erase its saved URLs.
const publishedReelUrls = snapshotProfiles.reduce((sum, username) => sum + (snapshotData.get(username).discovery.reel.items || []).length, 0);
const resolvedReelStatuses = new Set(['archived', 'age_restricted']);
const isCompleteReel = (item) => item.status === 'complete' && !item.last_error;
const isResolvedReel = (item) => resolvedReelStatuses.has(item.status) && !item.last_error;
const completelyAnalyzedProfiles = new Set(publishedSnapshotProfiles.filter((username) => {
  const snapshot = snapshotData.get(username);
  const discoveredReels = snapshot.discovery.reel.items || [];
  const reelItems = (snapshot.items || []).filter((item) => item.kind === 'reel');
  return snapshot.discovery.reel.complete === true
    && discoveredReels.length === reelItems.length
    && reelItems.every((item) => isCompleteReel(item) || isResolvedReel(item));
}));
const partialPublishedProfiles = new Set([...fullProfiles, ...profileLevelProfiles].filter((username) => {
  const snapshot = snapshotData.get(username);
  return (snapshot?.items || []).some((item) => item.kind === 'reel' && !isCompleteReel(item) && !isResolvedReel(item));
}));
const completeReels = publishedReelRows.filter(isCompleteReel);
const reviewReels = publishedReelRows.filter((item) => !isCompleteReel(item) && !isResolvedReel(item));
const totalMetric = (rows, key) => rows.reduce((sum, row) => sum + (numberMetric(row[key]) || 0), 0);
const measuredMetric = (rows, key) => rows.filter((row) => numberMetric(row[key]) !== null);
const compactTotal = (value) => {
  if (!Number.isFinite(value)) return 'Unavailable';
  const units = [[1e12, 'tn'], [1e9, 'bn'], [1e6, 'mn'], [1e3, 'k']];
  const unit = units.find(([threshold]) => value >= threshold);
  if (!unit) return fmt(value);
  const scaled = value / unit[0];
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${Number(scaled.toFixed(decimals))}${unit[1]}`;
};
const metricTotal = (rows, kind, key) => {
  const measured = rows.filter((row) => row.kind === kind && numberMetric(row[key]) !== null);
  if (!measured.length) return { display: 'Unavailable', actual: 'Unavailable', title: 'No saved value is available.' };
  const total = totalMetric(measured, key);
  const approximate = measured.some((row) => row[key]?.approximate);
  return {
    display: compactTotal(total),
    actual: fmt(total),
    title: `Full stored total: ${fmt(total)}${approximate ? ' · Some source labels were abbreviated by Instagram.' : ''}`
  };
};
const totalCell = (summary, label) => `<span class="compact-total" title="${esc(summary.title)}" aria-label="${esc(`${label}: ${summary.actual}`)}">${esc(summary.display)}</span>`;
const countValues = (values) => Object.entries(values.reduce((counts, value) => {
  if (value) counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const countryRows = countValues(publishedSnapshotProfiles.map((username) => snapshotData.get(username).profile.account_based_in));
const hashtagRows = countValues(completeReels.flatMap((item) => item.hashtags || []));
const topReels = [...publishedReelRows].filter((item) => numberMetric(item.views) !== null)
  .sort((a, b) => numberMetric(b.views) - numberMetric(a.views)).slice(0, 10);
const exactPostRows = publishedSnapshotProfiles.map((username) => snapshotData.get(username).profile.posts_count).filter((value) => numberMetric(value) !== null);
const overview = {
  publicRecords: publishedProfiles.length,
  completelyAnalyzedProfiles: completelyAnalyzedProfiles.size,
  profileRecords: publishedSnapshotProfiles.length,
  excludedRecords: excludedProfiles.length,
  futureCandidates: index.profile_keys.length - publishedProfiles.length,
  nearTerm: [...partialPublishedProfiles, ...profileLevelProfiles].length,
  reelUrls: publishedReelUrls,
  reelDetails: completeReels.length,
  reelPending: publishedSnapshotProfiles.reduce((total, username) => {
    const saved = snapshotData.get(username);
    const detailed = new Map(saved.items.filter((item) => item.kind === 'reel').map((item) => [item.url, item]));
    return total + (saved.discovery.reel.items || []).filter((item) => !detailed.has(item.url) || detailed.get(item.url).status === 'pending').length;
  }, 0),
  reelPartial: reviewReels.filter((item) => item.status === 'partial').length,
  reelFailed: reviewReels.filter((item) => item.status === 'failed').length,
  reelResolved: publishedReelRows.filter(isResolvedReel).length,
  reelExcluded: excludedSnapshotProfiles.reduce((sum, username) => sum + (snapshotData.get(username).discovery.reel.items || []).length, 0),
  posts: exactPostRows.reduce((sum, value) => sum + numberMetric(value), 0),
  views: totalMetric(publishedReelRows, 'views'),
  viewsCovered: measuredMetric(publishedReelRows, 'views').length,
  likes: totalMetric(publishedReelRows, 'likes'),
  likesCovered: measuredMetric(publishedReelRows, 'likes').length,
  comments: totalMetric(publishedReelRows, 'comments'),
  commentsCovered: measuredMetric(publishedReelRows, 'comments').length,
  viewsApproximate: measuredMetric(publishedReelRows, 'views').some((item) => item.views.approximate),
  likesApproximate: measuredMetric(publishedReelRows, 'likes').some((item) => item.likes.approximate),
  commentsApproximate: measuredMetric(publishedReelRows, 'comments').some((item) => item.comments.approximate)
};
const reelStatusTotal = overview.reelDetails + overview.reelPending + overview.reelPartial + overview.reelFailed + overview.reelResolved + overview.reelExcluded;
if (reelStatusTotal !== overview.reelUrls) throw new Error(`Reel status totals cover ${reelStatusTotal} of ${overview.reelUrls} discovered URLs.`);


function shell({ title, description, base, active, profileKey, content }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><meta name="description" content="${esc(description)}"><title>${esc(title)}</title><link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/site.css"><script src="${base}assets/site.js" defer></script></head><body><a class="skip-link" href="#main">Skip to content</a><header class="topbar"><div class="topbar-inner"><a class="brand" href="${base}" aria-label="dedgram atlas home"><img class="brand-icon" src="${base}assets/favicon.svg" alt=""><span>dedgram <small>ATLAS</small></span></a><nav aria-label="Main navigation"><a class="${active === 'catalog' ? 'active' : ''}" href="${base}profiles/">Profiles</a><a class="${active === 'overview' ? 'active' : ''}" href="${base}">Overview</a>${profileKey ? `<a class="${active === 'profile' ? 'active' : ''}" href="./">Profile record</a>` : ''}</nav><span class="nav-status">COLLECTION IN PROGRESS</span></div></header><main id="main">${content}</main><footer class="footer"><div><strong>dedgram ATLAS</strong><p>Saved profile records.</p></div><div><span>Updated ${esc(buildDate)}</span><span>Metrics reflect the saved snapshot.</span></div></footer></body></html>`;
}

const publishedSet = new Set(publishedProfiles);
const catalogCard = (username, i, ready) => {
  const excludedRecord = exclusionRecords.profiles?.[username];
  const label = excludedRecord ? (excludedRecord.deletion_assessment?.status === 'suspected_deleted' ? 'Unavailable; suspected deleted' : `Excluded after initial collection: ${excludedRecord.status}`) : profileLevelSet.has(username) ? 'Profile saved; reel analysis pending' : partialPublishedProfiles.has(username) ? 'Some reels analyzed' : ready ? 'Profile and reels analyzed' : 'Not analyzed yet';
  const tag = excludedRecord ? 'Excluded from analysis' : profileLevelSet.has(username) ? 'Profile saved' : ready ? 'View record' : 'Not analyzed';
  const inner = `<span class="row-number">${String(i + 1).padStart(3, '0')}</span><span class="row-title"><strong>@${esc(username)}</strong><small>${esc(label)}</small></span><span class="row-tag ${ready ? 'live' : ''}">${esc(tag)}</span>`;
  return `<article class="profile-row" data-catalog-row><div class="profile-row-main">${ready ? `<a class="profile-internal" href="./profiles/${username}/" aria-label="View saved profile data for @${username}">${inner}</a>` : `<div class="profile-internal">${inner}</div>`}</div><div class="row-external">${external(profileInstagramUrl(username), 'Instagram', 'external-link')}</div></article>`;
};
const publishedCards = publishedProfiles.map((username) => catalogCard(username, index.profile_keys.indexOf(username), true)).join('');
const futureCards = index.profile_keys.filter((username) => !publishedSet.has(username))
  .map((username) => catalogCard(username, index.profile_keys.indexOf(username), false)).join('');
const publishedCount = publishedProfiles.length;
const catalogCards = `${publishedCards}<details class="future-directory" data-catalog-future><summary>Show ${fmt(index.profile_keys.length - publishedCount)} future collection candidates</summary><div class="profile-list future-profile-list">${futureCards}</div></details>`;
const catalogHtml = shell({ title: 'Profiles Â· dedgram atlas', description: 'Explore the dedgram profile catalog and the published research profiles.', base: './', active: 'catalog', content: `<section class="hero catalog-hero"><div class="hero-copy"><div class="eyebrow">PROFILE INDEX / PUBLIC PREVIEW</div><h1>Profiles,<br>on record.</h1><p>${fmt(index.profile_keys.length)} accounts indexed. ${fmt(publishedCount)} profile records are available; the rest are being collected.</p><div class="hero-actions"><a class="button primary" href="#published">View published profiles</a><a class="button secondary" href="#directory">Browse profiles</a></div></div><div class="hero-count" aria-label="${fmt(publishedCount)} of ${fmt(index.profile_keys.length)} profiles published"><strong>${String(publishedCount).padStart(2, '0')}</strong><span>/ ${fmt(index.profile_keys.length)} PUBLISHED</span></div></section><section class="stat-strip" aria-label="Publishing status"><div><span>CATALOG</span><strong>${fmt(index.profile_keys.length)}</strong><small>profile URLs indexed</small></div><div><span>PUBLISHED</span><strong>${fmt(publishedCount)}</strong><small>profile records available</small></div><div><span>IN PROGRESS</span><strong>${fmt(index.profile_keys.length - publishedCount)}</strong><small>more profiles to publish</small></div></section><section class="process-note"><div><h2>Collection in progress</h2><p>More profile records will appear here as they are checked.</p></div></section><section class="directory" id="published"><div class="section-head"><div><span class="overline">01 / PUBLISHED RECORDS</span><h2>Ready to explore</h2><p>Completed records and partial reel coverage are labeled below.</p></div></div><div class="profile-list">${publishedProfiles.map((username) => `<article class="profile-row"><div class="profile-row-main"><a class="profile-internal" href="./profiles/${username}/" aria-label="View saved profile data for @${username}"><span class="row-title"><strong>@${esc(username)}</strong><small>${partialPublishedProfiles.has(username) ? 'Partial reel coverage' : 'Profile and reel analysis complete'}</small></span><span class="row-tag live">View record</span></a></div><div class="row-external">${external(profileInstagramUrl(username), 'Instagram', 'external-link')}</div></article>`).join('')}</div></section><section class="directory" id="directory"><div class="section-head"><div><span class="overline">02 / DIRECTORY</span><h2>Profile index</h2><p>Direct Instagram links for all ${fmt(index.profile_keys.length)} accounts.</p></div><div class="directory-search"><label for="catalog-search">Find a profile</label><input id="catalog-search" type="search" placeholder="Search @username" autocomplete="off"></div></div><div class="directory-toolbar"><span id="catalog-count">${fmt(index.profile_keys.length)} profiles shown</span><span>SAVED RECORDS APPEAR WHEN READY</span></div><div class="profile-list" id="profile-list">${catalogCards}</div><p class="empty-state" id="catalog-empty" hidden>No profiles match that search.</p></section>` });

const zeroReelLabelledCatalogHtml = [...zeroReelProfiles].reduce((html, username) => {
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(<strong>@${escapedUsername}<\\/strong><small>)[^<]*(</small>)`, 'g'), '$1Profile saved; no reels found$2');
}, catalogHtml);
const catalogHtmlForOutput = publishedProfiles.reduce((html, username) => {
  const excludedRecord = exclusionRecords.profiles?.[username];
  const label = excludedRecord ? (excludedRecord.deletion_assessment?.status === 'suspected_deleted' ? 'Unavailable; suspected deleted' : `Excluded after initial collection: ${excludedRecord.status}`) : profileLevelSet.has(username) ? 'Profile saved; reel analysis pending' : partialPublishedProfiles.has(username) ? 'Some reels analyzed' : 'Profile and reels analyzed';
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(<strong>@${escapedUsername}<\\/strong><small>)[^<]*(</small>)`, 'g'), `$1${esc(label)}$2`);
}, zeroReelLabelledCatalogHtml);
const publicCatalogHtml = catalogHtmlForOutput
  .replace(`${fmt(index.profile_keys.length)} profiles shown`, `${fmt(publishedCount)} profiles shown`)
  .replace('<strong>@illmisguideyou</strong><small>Profile and reel analysis complete</small>', '<strong>@illmisguideyou</strong><small>Profile saved; reel analysis pending</small>')
  .replaceAll('Profile and reel analysis complete', 'Profile and reels analyzed')
  .replaceAll('Partial reel coverage', 'Some reels analyzed')
  .replaceAll('Resolved:', 'Excluded after initial collection:')
  .replace('<a class="brand" href="./"', '<a class="brand" href="../"')
  .replace('<a class="active" href="./profiles/">Profiles', '<a class="active" href="../profiles/">Profiles')
  .replace('<a class="" href="./">Overview', '<a class="" href="../">Overview')
  .replaceAll('href="./assets/', 'href="../assets/')
  .replaceAll('src="./assets/', 'src="../assets/')
  .replaceAll('href="./profiles/', 'href="./');

const overviewBars = (rows, total) => rows.length ? rows.slice(0, 8).map(([name, count]) => `<div class="bar-row"><div><span>${esc(name)}</span><strong>${fmt(count)}</strong></div><div class="bar-track"><span style="width:${Math.max(5, Math.round(count / Math.max(total, 1) * 100))}%"></span></div></div>`).join('') : '<p class="muted">No completed data yet.</p>';
const overviewAccountRows = publishedSnapshotProfiles.map((username) => {
  const { profile, discovery, items } = snapshotData.get(username);
  const reels = discovery.reel.items || [];
  const details = items.filter((item) => item.kind === 'reel');
  const complete = details.filter(isCompleteReel).length;
  const handled = details.filter((item) => isCompleteReel(item) || isResolvedReel(item)).length;
  const status = profileLevelSet.has(username) ? (discovery.reel.complete ? 'Profile and reel grid complete' : 'Profile details complete; reel grid pending') : partialPublishedProfiles.has(username) ? 'Partial reel coverage' : 'Reel analysis complete';
  const reelLikes = metricTotal(items, 'reel', 'likes');
  const reelComments = metricTotal(items, 'reel', 'comments');
  const reelViews = metricTotal(items, 'reel', 'views');
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a><small class="cell-note">${esc(status)}</small></td><td>${esc(profile.account_based_in || 'Unavailable')}</td><td>${esc(profile.date_joined || 'Unavailable')}</td><td>${esc(metric(profile.posts_count))}</td><td>${discovery.reel.complete ? fmt(reels.length) : discovery.reel.attempted_at ? `${fmt(reels.length)}+ (partial)` : 'Not scanned'}</td><td>${fmt(handled)} / ${discovery.reel.complete ? fmt(reels.length) : 'unknown'}</td><td>${totalCell(reelLikes, 'Total reel likes')}</td><td>${totalCell(reelComments, 'Total reel comments')}</td><td>${totalCell(reelViews, 'Total reel views')}</td><td>${esc(metric(profile.followers_count))}</td></tr>`;
}).join('');
const deletedProfiles = excludedProfiles.filter((username) => exclusionRecords.profiles?.[username]?.status === 'Deleted or username changed');
const ageRestrictedProfiles = excludedProfiles.filter((username) => exclusionRecords.profiles?.[username]?.status === 'Age restricted');
const falseIdentificationProfiles = excludedProfiles.filter((username) => exclusionRecords.profiles?.[username]?.status === 'False identification');
const overviewDeletedRow = (username) => {
  const excludedRecord = exclusionRecords.profiles?.[username] || {};
  const firstUnavailable = excludedRecord.deletion_date_range?.before_first_unavailable_at || excludedRecord.observed_at;
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${esc(date(excludedRecord.last_fetched_at || excludedRecord.observed_at))}</td><td>${esc(date(firstUnavailable))}</td></tr>`;
};
const overviewDeletedRows = deletedProfiles.map(overviewDeletedRow).join('');
const overviewAgeRestrictedRows = ageRestrictedProfiles.map((username) => {
  const excludedRecord = exclusionRecords.profiles?.[username] || {};
  const firstRestricted = excludedRecord.age_restriction?.before_initial_blocked_or_failed_at || excludedRecord.observed_at;
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${excludedRecord.minimum_age ? `${fmt(excludedRecord.minimum_age)}+` : 'Age restricted'}</td><td>${esc(date(excludedRecord.last_fetched_at || excludedRecord.observed_at))}</td><td>${esc(date(firstRestricted))}</td></tr>`;
}).join('');
const overviewFalseIdentificationRows = falseIdentificationProfiles.map((username) => {
  const excludedRecord = exclusionRecords.profiles?.[username] || {};
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${esc(date(excludedRecord.last_fetched_at || excludedRecord.observed_at))}</td><td>${esc(date(excludedRecord.false_identification?.identified_at || excludedRecord.observed_at))}</td><td>${esc(excludedRecord.false_identification?.reason || 'Manual review')}</td></tr>`;
}).join('');
const overviewReelRows = (await Promise.all(topReels.map(async (item) => {
  const thumb = await localImage(`${item.shortcode}.jpg`);
  const image = thumb ? `<img class="overview-reel-thumb" src="../media/${esc(thumb)}" alt="Cover image for reel ${esc(item.shortcode)}" loading="lazy">` : '<span class="overview-thumb-fallback" aria-hidden="true">REEL</span>';
  return `<tr><td><div class="content-cell">${image}<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.shortcode)} ↗</a></div></td><td><a href="../profiles/${item.username}/">@${esc(item.username)}</a></td><td>${esc(date(item.date, item.date_precision))}</td><td><strong>${esc(metric(item.views))}</strong></td><td>${esc(metric(item.likes))}</td><td>${esc(metric(item.comments))}</td></tr>`;
}))).join('');
const reelAnalysisPendingCount = publishedSnapshotProfiles.filter((username) => {
  const { discovery, items } = snapshotData.get(username);
  return (discovery.reel.items || []).length > 0 && !items.some((item) => item.kind === 'reel');
}).length;
const reelRecordProfileCount = publishedSnapshotProfiles.filter((username) => snapshotData.get(username).items.some((item) => item.kind === 'reel')).length;
const profileDetailsOnlyCount = publishedSnapshotProfiles.filter((username) => {
  const { discovery, items } = snapshotData.get(username);
  return !zeroReelProfiles.has(username) && !(discovery.reel.items || []).length
    && !items.some((item) => item.kind === 'reel');
}).length;
const profileStatusRows = [
  { label: 'Reel discovery pending', count: profileDetailsOnlyCount, note: 'Profile details saved; reel count not verified', className: 'discovery' },
  { label: 'Reel analysis pending', count: reelAnalysisPendingCount, note: 'URLs saved; reel pages not analyzed', className: 'pending' },
  { label: 'Reel records collected', count: reelRecordProfileCount, note: 'Reel-level records exist', className: 'analyzed' },
  { label: 'Confirmed zero reels', count: zeroReelProfiles.size, note: 'Profile details saved; no reels posted', className: 'zero' },
  { label: 'Excluded after initial collection', count: excludedProfiles.length, note: 'Status records kept outside analysis', className: 'excluded' }
];
if (overview.futureCandidates) profileStatusRows.push({ label: 'Not collected', count: overview.futureCandidates, note: 'Cataloged; profile details not collected', className: 'uncollected' });
const profileStatusTotal = profileStatusRows.reduce((sum, row) => sum + row.count, 0);
if (profileStatusTotal !== index.profile_keys.length) throw new Error(`Profile status breakdown covers ${profileStatusTotal} of ${index.profile_keys.length} catalog records.`);
const profileStatusBar = profileStatusRows.map((row) => `<span class="profile-status-segment ${row.className}" style="width:${row.count / Math.max(profileStatusTotal, 1) * 100}%" title="${esc(`${row.label}: ${row.count}`)}"></span>`).join('');
const profileStatusLegend = profileStatusRows.map((row) => `<div class="profile-status-key"><div><span class="profile-status-swatch ${row.className}" aria-hidden="true"></span><strong>${fmt(row.count)}</strong><span>${esc(row.label)}</span></div><small>${esc(row.note)}</small></div>`).join('');
const profileStatusBreakdownHtml = `<section class="profile-status-breakdown" aria-labelledby="profile-status-heading"><div class="section-head"><div><span class="overline">PROFILE STATUS / ${fmt(profileStatusTotal)} RECORDS</span><h2 id="profile-status-heading">Where every profile stands.</h2><p>The complete catalog, separated by the deepest collection state currently saved.</p></div></div><div class="profile-status-bar" role="img" aria-label="${esc(profileStatusRows.map((row) => `${row.label}: ${row.count}`).join('; '))}">${profileStatusBar}</div><div class="profile-status-legend">${profileStatusLegend}</div></section>`;
const overviewHtml = shell({ title: 'How dead is the internet? One reel at a time. · dedgram atlas', description: 'A public snapshot testing the theory that bot accounts are creating an internet of bots, one reel at a time.', base: '../', active: 'overview', content: `
  <section class="hero overview-hero"><div class="hero-copy"><div class="eyebrow">BOT CULTURE / PUBLIC SNAPSHOT</div><h1><span class="headline-line">How dead is the <em>internet?</em></span><br><span class="headline-line"><em>One reel at a time.</em></span></h1><p>This atlas tests a theory: the internet is filling with bot accounts posting for other bot accounts, manufacturing the views and likes that keep the cycle going. These totals reflect the research records currently available on the public site.</p><div class="hero-actions"><a class="button primary" href="../">View published profiles</a><a class="button secondary" href="../#future">Show future candidates</a></div></div><div class="hero-count" aria-label="${fmt(overview.completelyAnalyzedProfiles)} public records completely analyzed"><strong>${fmt(overview.completelyAnalyzedProfiles)}</strong><span>PUBLIC RECORDS COMPLETELY ANALYZED</span></div></section>
  <section class="stat-strip overview-stat-strip availability-stat-strip" aria-label="Overall collection statistics"><div><span>AVAILABLE PROFILES</span><strong>${fmt(overview.publicRecords - overview.excludedRecords)}/${fmt(overview.publicRecords)}</strong><small>Identified profiles available on Instagram</small></div><div><span>REELS DISCOVERED</span><strong>${fmt(overview.reelUrls)}</strong></div><div><span>REELS ANALYZED</span><strong>${fmt(overview.reelDetails)}</strong><small>Full reel information captured</small></div><div><span>REELS PENDING</span><strong>${fmt(overview.reelPending)}</strong><small>URLs saved; reel-detail collection not completed</small></div><div><span>PARTIALLY ANALYZED</span><strong>${fmt(overview.reelPartial)}</strong><small>Some details collected; required information missing</small></div><div><span>REELS FAILED</span><strong>${fmt(overview.reelFailed)}</strong><small>Collection attempts failed</small></div><div><span>REELS RESOLVED</span><strong>${fmt(overview.reelResolved)}</strong><small>Deleted, archived, or age restricted; no further analysis</small></div><div><span>REELS EXCLUDED</span><strong>${fmt(overview.reelExcluded)}</strong><small>Saved URLs from profiles excluded from analysis</small></div></section>
  <section class="metric-note"><span class="overline">ACTUAL STORED NUMBERS</span><h2>Engagement totals are not rounded estimates</h2><p>They are the values stored from the collected reel records. Hover over a compact total to see the full stored number.</p></section>
  <section class="stat-strip overview-stat-strip secondary-stats" aria-label="Collected metrics"><div><span>INSTAGRAM POSTS</span><strong>${fmt(overview.posts)}</strong><small>${fmt(overview.profileRecords)} profiles with saved counts</small></div><div><span>TOTAL REEL VIEWS</span><strong class="compact-total" title="Full stored total: ${fmt(overview.views)}${overview.viewsApproximate ? ' · Some source labels were abbreviated by Instagram.' : ''}" aria-label="Total reel views: ${fmt(overview.views)}">${compactTotal(overview.views)}</strong><small>${fmt(overview.viewsCovered)} reels with readable views</small></div><div><span>TOTAL REEL LIKES</span><strong class="compact-total" title="Full stored total: ${fmt(overview.likes)}${overview.likesApproximate ? ' · Some source labels were abbreviated by Instagram.' : ''}" aria-label="Total reel likes: ${fmt(overview.likes)}">${compactTotal(overview.likes)}</strong><small>${fmt(overview.likesCovered)} reels with readable likes</small></div><div><span>TOTAL REEL COMMENTS</span><strong class="compact-total" title="Full stored total: ${fmt(overview.comments)}${overview.commentsApproximate ? ' · Some source labels were abbreviated by Instagram.' : ''}" aria-label="Total reel comments: ${fmt(overview.comments)}">${compactTotal(overview.comments)}</strong><small>${fmt(overview.commentsCovered)} reels with readable comments</small></div><div><span>NEXT TO ANALYZE</span><strong>${fmt(overview.nearTerm)}</strong><small>Published profiles with more work queued</small></div></section>
  <section class="overview-grid"><div class="overview-panel"><span class="overline">PROFILE MAP</span><h2>Accounts by country</h2>${overviewBars(countryRows, overview.profileRecords)}</div><div class="overview-panel"><span class="overline">REEL LANGUAGE</span><h2>Frequent hashtags</h2>${overviewBars(hashtagRows, completeReels.length)}<p class="panel-foot">From completed reel captions.</p></div></section>
  <section class="overview-table"><div class="section-head"><div><span class="overline">ANALYZED PROFILES</span><h2>Profile performance</h2><p>This table contains saved profile information and reel analysis. The post figure is the profile’s total post count; individual posts are not analyzed.</p></div></div><div class="table-wrap"><table><thead><tr><th>PROFILE</th><th>COUNTRY</th><th>JOINED INSTAGRAM</th><th>POSTS</th><th>REELS FOUND</th><th>REELS ANALYZED</th><th>TOTAL REEL LIKES</th><th>TOTAL REEL COMMENTS</th><th>TOTAL REEL VIEWS</th><th>FOLLOWERS</th></tr></thead><tbody>${overviewAccountRows}</tbody></table></div></section>
  <section class="status-panels" aria-label="Profiles excluded from analysis"><div class="status-intro"><span class="overline">PROFILES NO LONGER AVAILABLE FOR ANALYSIS</span><p>These profiles were available during the initial scan. They were later found unavailable under the original username, age-restricted, or incorrectly identified, so they are kept as status records and excluded from the analysis totals below.</p></div><div class="status-panel-grid"><section class="status-panel"><span class="overline">DELETED OR RENAMED PROFILES</span><h3>Original username unavailable</h3><p>Collected first, then found unavailable under the original username. The account may have been deleted or the username may have changed.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>COLLECTED ON</th><th>FLAGGED AS UNAVAILABLE</th></tr></thead><tbody>${overviewDeletedRows}</tbody></table></div></section><section class="status-panel"><span class="overline">AGE-RESTRICTED PROFILES</span><h3>Later became age-restricted</h3><p>Collected first, then found behind Instagram’s age restriction.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>AGE REQUIREMENT</th><th>COLLECTED ON</th><th>FLAGGED AS AGE-RESTRICTED</th></tr></thead><tbody>${overviewAgeRestrictedRows}</tbody></table></div></section><section class="status-panel status-panel-full"><span class="overline">FALSE IDENTIFICATION</span><h3>Removed from the analysis set</h3><p>This capture did not provide enough evidence that the username represented a real Instagram profile.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>COLLECTED ON</th><th>FLAGGED AS FALSE IDENTIFICATION</th><th>REASON</th></tr></thead><tbody>${overviewFalseIdentificationRows}</tbody></table></div></section></div></section>
  <section class="overview-table"><div class="section-head"><div><span class="overline">TOP REELS</span><h2>Most viewed reels</h2><p>Based on view counts captured from Instagram.</p></div></div><div class="table-wrap"><table><thead><tr><th>REEL</th><th>PROFILE</th><th>POSTED ON</th><th>VIEWS</th><th>LIKES</th><th>COMMENTS</th></tr></thead><tbody>${overviewReelRows || '<tr><td colspan="6">No reel information is available yet.</td></tr>'}</tbody></table></div></section>
  <section class="process-note"><div><h2>${fmt(overview.futureCandidates)} future candidates are hidden by default</h2><p>They are indexed but do not have a public saved record yet. Use the Profiles tab or the button above to reveal them.</p></div></section>
  <p class="method-note">Totals are from the current saved snapshot, not a time series. Instagram's abbreviated K/M counts are kept where applicable; missing metrics are shown as unavailable.</p>` });
const overviewWithStatusBreakdown = overviewHtml.replace('<section class="metric-note">', `${profileStatusBreakdownHtml}<section class="metric-note">`);
const overviewAliasHtml = overviewWithStatusBreakdown
  .replace('href="../">View published profiles', 'href="../profiles/">View published profiles')
  .replace('href="../#future"', 'href="../profiles/#future"');
const overviewWithExclusionTerminology = overviewAliasHtml
  .replaceAll('PROFILES NO LONGER AVAILABLE FOR ANALYSIS', 'EXCLUDED AFTER INITIAL COLLECTION')
  .replaceAll('These profiles were available during the initial scan. They were later found unavailable under the original username, age-restricted, or incorrectly identified, so they are kept as status records and excluded from the analysis totals below.', 'These profiles were collected initially, then stopped from active analysis because they became unavailable under the original username, age-restricted, or were identified as false captures. Their original evidence is preserved as status records, but they are excluded from the analysis totals below.')
  .replaceAll('Collected first, then found unavailable under the original username.', 'Collected first, then excluded after the original username became unavailable.')
  .replaceAll('Collected first, then found behind Instagram', 'Collected first, then excluded after Instagram')
  .replaceAll('This capture did not provide enough evidence that the username represented a real Instagram profile.', 'This capture did not provide enough evidence that the username represented a real Instagram profile, so it was excluded after initial collection.');
const overviewHomeHtml = overviewWithExclusionTerminology.replaceAll('../', './');

const publicProfileHtml = (html) => html
  .replaceAll('PROFILE LEVEL RECORD', 'PROFILE SNAPSHOT')
  .replaceAll('PROFILE LEVEL COMPLETE', 'PROFILE INFORMATION SAVED')
  .replaceAll('PROFILE RECORD /', 'PROFILE PAGE /')
  .replaceAll('REEL DETAILS PENDING', 'REEL ANALYSIS PENDING')
  .replaceAll('REEL URLS', 'REELS FOUND')
  .replaceAll('REEL RECORDS', 'ANALYZED REELS')
  .replaceAll('Incomplete reel coverage', 'Some reels need more information')
  .replaceAll('complete detail records', 'full information')
  .replaceAll('Needs review', 'Partially analyzed')
  .replaceAll('need review', 'partially analyzed')
  .replaceAll('Manual review needed', 'Some information is missing')
  .replaceAll('RESOLVED RECORD', 'EXCLUDED RECORD')
  .replaceAll('RESOLVED ', 'EXCLUDED AFTER INITIAL COLLECTION ')
  .replaceAll('RESOLUTION RECORD', 'EXCLUSION RECORD')
  .replaceAll('Collection resolved', 'Excluded from analysis')
  .replaceAll('Resolution status', 'Exclusion status')
  .replaceAll('RESOLUTION DETAILS', 'EXCLUSION DETAILS')
  .replaceAll('Why this record is finished', 'Why this record is excluded')
  .replaceAll('Resolution preserved', 'Initial collection preserved')
  .replaceAll('No further collection required', 'Collection stopped after initial capture')
  .replaceAll('This profile is included as a resolved record because its final state is known. It is not counted as an unfinished profile in the public catalog.', 'This profile was collected initially, then excluded from active analysis because its final state is known. The original evidence is preserved.')
  .replaceAll('resolution record', 'exclusion record')
  .replaceAll('Record details', 'More information')
  .replaceAll('Individual reel pages have not been scraped yet', 'The individual reels have not been analyzed yet')
  .replaceAll('the saved discovery JSON is ready for the next reel-details run', 'the saved reel list is ready for the next analysis')
  .replaceAll('href="../../">All profiles', 'href="../../profiles/">All profiles')
  .replaceAll('Profile-level record', 'Saved profile information')
  .replaceAll('profile-level record', 'saved profile information');

async function excludedSnapshotPage(excludedRecord, recordNumber) {
  const username = excludedRecord.username;
  const { profile, discovery, items } = snapshotData.get(username);
  const reels = discovery.reel.items || [];
  const savedItems = new Map(items.map((item) => [item.url, item]));
  const suspectedDeleted = excludedRecord.deletion_assessment?.status === 'suspected_deleted';
  const status = suspectedDeleted ? 'Suspected deleted' : excludedRecord.status;
  const reason = excludedRecord.resolution_note || 'This profile is unavailable and excluded from analysis.';
  const missingDetail = suspectedDeleted ? 'Unavailable — suspected profile deletion' : 'Unavailable — profile excluded from analysis';
  const savedMetric = (value) => numberMetric(value) === null ? esc(missingDetail) : esc(metric(value));
  const avatarFile = await localImage(`avatar-${username}.jpg`);
  const avatar = avatarFile ? `<img src="../../media/${esc(avatarFile)}" alt="Saved profile picture of @${esc(username)}" width="92" height="92">` : '<span aria-hidden="true">@</span>';
  const evidence = (excludedRecord.deletion_assessment?.checked_urls || []).map((url) => `<li>${external(url, url)}</li>`).join('');
  const rows = reels.map((reel) => {
    const item = savedItems.get(reel.url) || reel;
    return `<tr><td>${external(reel.url, reel.shortcode)}</td><td>${item.date ? esc(date(item.date, item.date_precision)) : esc(missingDetail)}</td><td>${item.caption ? esc(item.caption) : esc(missingDetail)}</td><td>${item.views ? savedMetric(item.views) : esc(item.grid_views_raw || missingDetail)}</td><td>${savedMetric(item.likes)}</td><td>${savedMetric(item.comments)}</td><td>${esc(missingDetail)}</td></tr>`;
  }).join('');
  return shell({ title: `@${username} · dedgram atlas`, description: `Saved information and ${reels.length} discovered reel URLs for @${username}, excluded from analysis: ${status}.`, base: '../../', active: 'profile', profileKey: username, content: `
    <section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../profiles/">All profiles</a><span class="snapshot-label">LAST SAVED ${esc(date(profile.fetched_at))}</span></div><div class="profile-title-row"><div class="profile-avatar">${avatar}</div><div><div class="eyebrow">EXCLUSION RECORD / ${recordNumber}</div><h1>@${esc(username)}</h1>${profile.display_name ? `<p>${esc(profile.display_name)}</p>` : ''}</div><div class="profile-hero-link">${external(profile.url || instagram(username), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>UNAVAILABLE — ${esc(status)}</span><span>EXCLUDED FROM ANALYSIS</span><span>Manually reported ${esc(date(excludedRecord.observed_at))}</span></div></section>
    <section class="evidence-note"><span class="note-symbol">!</span><div><h2>${esc(status)} — analysis stopped</h2><p>${esc(reason)}</p><p>The figures below are historical saved data. These reels are excluded because the profile is unavailable; they are not completed analysis or pending work.</p>${evidence ? `<details><summary>Links checked manually by the user</summary><ul>${evidence}</ul></details>` : ''}</div></section>
    <section class="profile-stats" aria-label="Historical saved profile metrics"><div><span>FOLLOWERS</span><strong>${esc(metric(profile.followers_count))}</strong><small>Last saved count</small></div><div><span>FOLLOWING</span><strong>${esc(metric(profile.following_count))}</strong><small>Last saved count</small></div><div><span>POSTS</span><strong>${esc(metric(profile.posts_count))}</strong><small>Last saved count</small></div><div><span>REELS DISCOVERED</span><strong>${fmt(reels.length)}</strong><small>Saved URLs retained in discovery totals</small></div></section>
    <section class="profile-context"><div class="context-card"><span class="overline">SAVED ACCOUNT DETAILS</span><h2>Historical profile information</h2><dl class="account-facts">${field('Category', profile.category)}${field('Account based in', profile.account_based_in)}${field('Date joined', profile.date_joined)}${field('Former usernames', metric(profile.former_usernames_count))}${field('AI-generated label', profile.ai_generated_profile ? 'Shown on Instagram' : 'Not shown')}${field('Last profile scan', date(profile.fetched_at))}${field('Reel grid saved', date(discovery.reel.attempted_at))}${field('Availability', status)}${field('Assessment source', 'User manual check')}${field('Observed', date(excludedRecord.observed_at))}</dl></div><div class="context-card bio-card"><span class="overline">SAVED PROFILE BIO</span><h2>Bio</h2><p class="bio-text">${esc(profile.bio || 'No bio captured.')}</p>${profile.issues?.length ? `<ul>${profile.issues.map((issue) => `<li>${esc(issue)}</li>`).join('')}</ul>` : ''}</div></section>
    <section class="overview-table"><div class="section-head"><div><span class="overline">PRESERVED REEL URLS</span><h2>${fmt(reels.length)} discovered reels</h2><p>Saved values remain visible. Missing details are unavailable because the profile is suspected deleted.</p></div></div><div class="table-wrap"><table><thead><tr><th>REEL</th><th>DATE</th><th>CAPTION</th><th>SAVED VIEWS</th><th>SAVED LIKES</th><th>SAVED COMMENTS</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="downloads"><div><span class="overline">SOURCE FILES</span><h2>Preserved records</h2><p>Saved profile information, reel URLs, raw evidence and exclusion details.</p></div><div class="download-links">${files.map((name) => `<a href="../../downloads/${username}/${name}" ${name.endsWith('.json') || name.endsWith('.csv') ? 'download' : ''}>${esc(name)}</a>`).join('')}</div></section>` });
}

function excludedProfilePage(excludedRecord, recordNumber) {
  const resolved = excludedRecord;
  const status = resolved.status || 'Excluded after initial collection';
  const range = resolved.deletion_date_range || resolved.age_restriction;
  const reason = status === 'Deleted or username changed' ? (resolved.resolution_note || 'The original username was unavailable during the follow-up check. The account may have been deleted or the username may have changed.')
    : status === 'Age restricted' ? `Instagram access was age restricted to users ${resolved.minimum_age || 25}+.`
      : resolved.false_identification?.reason || 'Manual review concluded that this capture should not be treated as a confirmed Instagram profile.';
  const timing = range ? `${date(range.after_classified_at)} to ${date(range.before_first_unavailable_at || range.before_initial_blocked_or_failed_at)}` : date(resolved.observed_at);
  return shell({ title: `@${resolved.username} · dedgram atlas`, description: `${status} resolution record for @${resolved.username}.`, base: '../../', active: 'profile', profileKey: resolved.username, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">RESOLVED ${esc(date(resolved.observed_at))}</span></div><div class="profile-title-row"><div class="profile-avatar"><span aria-hidden="true">@</span></div><div><div class="eyebrow">RESOLUTION RECORD / ${recordNumber}</div><h1>@${esc(resolved.username)}</h1><p>${esc(status)}</p></div><div class="profile-hero-link">${external(instagram(resolved.username), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>RESOLVED RECORD</span><span>${esc(status)}</span><span>Observed ${esc(date(resolved.observed_at))}</span></div></section><section class="profile-stats" aria-label="Resolution status"><div><span>STATUS</span><strong>${esc(status)}</strong><small>Collection resolved</small></div><div><span>OBSERVED</span><strong>${esc(date(resolved.observed_at))}</strong><small>Status evidence</small></div><div><span>REEL DETAILS</span><strong>Not collected</strong><small>No further scrape required</small></div><div><span>PUBLIC RECORD</span><strong>Finished</strong><small>Resolution preserved</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / RESOLUTION DETAILS</span><h2>${esc(status)}</h2><dl class="account-facts">${field('Reason', reason)}${field('Observed', date(resolved.observed_at))}${field('Relevant interval', timing)}${field('Minimum age', resolved.minimum_age ? `${resolved.minimum_age}+` : null)}${field('Posts captured', resolved.posts_count)}${field('Date joined', resolved.date_joined)}</dl></div><div class="context-card bio-card"><span class="overline">EVIDENCE</span><h2>Why this record is finished</h2><p class="bio-text">${esc(reason)}</p>${resolved.profile_text ? `<p class="bio-text">Original captured profile text is preserved in the source record.</p>` : ''}</div></section><section class="evidence-note"><span class="note-symbol">i</span><div><h2>No further collection required</h2><p>This profile is included as a resolved record because its final state is known. It is not counted as an unfinished profile in the public catalog.</p></div></section>` });
}

async function profileLevelPage(published, profile, discovery, items, run, recordNumber) {
  const reels = discovery.reel.items || [];
  const reelDetails = items.filter((item) => item.kind === 'reel');
  const avatarFile = await localImage(`avatar-${published}.jpg`);
  const avatar = avatarFile ? `<img src="../../media/${avatarFile}" alt="Profile picture of @${published}" width="92" height="92">` : `<span aria-hidden="true">@</span>`;
  const currentUsername = profile.current_username && profile.current_username !== published ? profile.current_username : null;
  const gridComplete = discovery.reel?.complete === true;
  const gridAttempted = Boolean(discovery.reel?.attempted_at);
  const gridLabel = discovery.reel?.refresh_required ? 'Previous grid saved; refresh pending' : gridComplete ? 'Full grid confirmed' : gridAttempted ? 'Partial inventory; final count unknown' : 'Grid not scanned; count unknown';
  const gridNote = discovery.reel?.refresh_required ? `${fmt(reels.length)} previously discovered reel URLs are retained; a fresh scan is pending.` : gridComplete ? `${fmt(reels.length)} reel URLs are saved and counted.` : gridAttempted ? `${fmt(reels.length)} reel URLs are preserved from an incomplete scan. The final reel count is unknown. ${discovery.reel?.error || ''}` : 'Profile details and the exact post count are saved. Reel URL discovery has not started; the reel count is unknown.';
  const reelCountLabel = gridComplete || gridAttempted ? fmt(reels.length) : 'Not scanned';
  const stageLabel = gridComplete ? 'PROFILE AND REEL GRID COMPLETE' : 'PROFILE DETAILS COMPLETE';
  const nextStage = gridComplete ? 'REEL DETAILS PENDING' : 'REEL URL DISCOVERY PENDING';
  const gridVerified = gridComplete ? date(discovery.reel.attempted_at) : 'Not verified';
  return shell({ title: `@${published} · dedgram atlas`, description: `Profile-level record and ${reels.length} saved reel URLs for @${published}.`, base: '../../', active: 'profile', profileKey: published, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">SAVED ${esc(date(profile.fetched_at))}</span></div><div class="profile-title-row"><div class="profile-avatar">${avatar}</div><div><div class="eyebrow">PROFILE LEVEL RECORD / ${recordNumber}</div><h1>@${published}</h1>${currentUsername ? `<p>Current username: @${esc(currentUsername)}</p>` : profile.category ? `<p>${esc(profile.category)}</p>` : ''}</div><div class="profile-hero-link">${external(profile.url || instagram(published), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>${stageLabel}</span><span>${nextStage}</span><span>Collected ${esc(date(profile.fetched_at))}</span></div></section><section class="profile-stats" aria-label="Profile metrics"><div><span>FOLLOWERS</span><strong>${esc(metric(profile.followers_count))}</strong><small>Saved count</small></div><div><span>FOLLOWING</span><strong>${esc(metric(profile.following_count))}</strong><small>Profile header</small></div><div><span>POSTS</span><strong>${esc(metric(profile.posts_count))}</strong><small>Exact header count</small></div><div><span>REEL URLS</span><strong>${reelCountLabel}</strong><small>${gridLabel}</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / ACCOUNT DETAILS</span><h2>Profile level complete</h2><dl class="account-facts">${field('Category', profile.category)}${field('Account based in', profile.account_based_in)}${field('Date joined', profile.date_joined)}${currentUsername ? field('Current username', `@${currentUsername}`) : ''}${field('Last profile scan', date(profile.fetched_at))}${field('Reel grid verified', gridVerified)}${field('Collection run', `${run.status || 'Unknown'} · ${reelDetails.length}/${reels.length} reel details complete`)}</dl></div><div class="context-card bio-card"><span class="overline">PROFILE BIO</span><h2>What the account says</h2><p class="bio-text">${esc(profile.bio || 'No bio captured.')}</p></div></section><section class="evidence-note"><span class="note-symbol">i</span><div><h2>Reel-level analysis pending</h2><p>${gridNote} Individual reel details have not been collected. Finish reel URL discovery before starting reel-detail analysis.</p></div></section><section class="downloads"><div><span class="overline">03 / SOURCE FILES</span><h2>Source files</h2><p>Original profile-level records and exports.</p></div><div class="download-links">${files.map((name) => `<a href="../../downloads/${published}/${name}" ${name.endsWith('.json') || name.endsWith('.csv') ? 'download' : ''}>${esc(name)}</a>`).join('')}</div></section>` });
}

async function zeroAwareProfileLevelPage(published, profile, discovery, items, run, recordNumber) {
  const html = await profileLevelPage(published, profile, discovery, items, run, recordNumber);
  if (discovery.reel?.complete !== true || (discovery.reel.items || []).length !== 0) return html;
  return html
    .replaceAll('REEL DETAILS PENDING', 'NO REELS FOUND')
    .replaceAll('Individual reel details have not been collected. Finish reel URL discovery before starting reel-detail analysis.', 'The completed reel scan found no reels; no reel-detail analysis applies.')
    .replaceAll('Reel-level analysis pending', 'No reels posted')
    .replaceAll('Individual reel pages have not been scraped yet; the saved discovery JSON is ready for the next reel-details run.', 'The completed reel scan found no reels posted; no reel-level analysis applies.');
}

const profilePages = [];
for (const published of publishedProfiles) {
  const excludedRecord = exclusionRecords.profiles?.[published];
  if (excludedRecord) {
    const recordNumber = String(publishedProfiles.indexOf(published) + 1).padStart(3, '0');
    profilePages.push({ published, html: snapshotData.has(published) ? await excludedSnapshotPage(excludedRecord, recordNumber) : excludedProfilePage(excludedRecord, recordNumber) });
    continue;
  }
  const profile = await readJson(`${published}/profile.json`);
  const discovery = await readJson(`${published}/discovery.json`);
  const items = await readJson(`${published}/items.json`);
  const run = await readJson(`${published}/run.json`);
  if (profile.username !== published || !Array.isArray(items)) throw new Error(`Published snapshot is incomplete for ${published}.`);
  if (profileLevelSet.has(published)) {
    profilePages.push({ published, html: await zeroAwareProfileLevelPage(published, profile, discovery, items, run, String(publishedProfiles.indexOf(published) + 1).padStart(3, '0')) });
    continue;
  }
  if (!discovery.reel?.complete) throw new Error(`Published snapshot is incomplete for ${published}.`);
  const reels = items.filter((item) => item.kind === 'reel');
  if (reels.length !== discovery.reel.items.length) throw new Error(`Published reel records do not match the confirmed grid for ${published}.`);
  const complete = reels.filter(isCompleteReel).length;
  const resolvedCount = reels.filter(isResolvedReel).length;
  const pendingItems = reels.filter((item) => item.status === 'pending' && !item.last_error);
  const retryCount = pendingItems.filter((item) => item.retry_review?.action === 'retry_reel_details').length;
  const review = reels.length - complete - resolvedCount - pendingItems.length;
  const avatarFile = await localImage(`avatar-${published}.jpg`);
  const avatar = avatarFile ? `<img src="../../media/${avatarFile}" alt="Profile picture of @${published}" width="92" height="92">` : `<span aria-hidden="true">@</span>`;
  const displayName = plainText(profile.display_name).trim();
  const profileIssues = (profile.issues || []).map((issue) => `<li>${esc(issue)}</li>`).join('');
  const reviewItems = reels.filter((item) => !isCompleteReel(item) && !isResolvedReel(item) && !pendingItems.includes(item));
  const resolvedItems = reels.filter(isResolvedReel);
  const reviewDetails = reviewItems.map((item) => {
    const missingReasons = (item.missing || []).map((missingField) => `${missingField}: ${item.missing_reasons?.[missingField] || 'No readable value was found.'}`);
    const reason = item.last_error || missingReasons.join('; ') || 'Record is incomplete and needs review.';
    return `<li><strong>${esc(item.shortcode)}:</strong> ${esc(reason)}</li>`;
  }).join('');
  const resolvedDetails = resolvedItems.map((item) => `<li><strong>${esc(item.shortcode)}:</strong> ${esc(item.status === 'archived' ? 'Deleted / archived' : 'Age restricted')} · manually checked</li>`).join('');
  const collectionNote = reviewItems.length || resolvedItems.length || pendingItems.length ? `<section class="evidence-note"><span class="note-symbol">!</span><div><h2>Reel coverage</h2><p>${fmt(complete)} of ${fmt(reels.length)} reels have complete detail records. ${fmt(resolvedItems.length)} manually resolved; ${fmt(reviewItems.length)} still need review.${pendingItems.length ? ` ${fmt(pendingItems.length)} await reel analysis; ${fmt(retryCount)} were manually confirmed to exist and are ready for retry.` : ''} </p>${resolvedDetails ? `<ul>${resolvedDetails}</ul>` : ''}${reviewDetails ? `<ul>${reviewDetails}</ul><p>Incomplete records remain visible below and are labeled for manual review.</p>` : ''}</div></section>` : '';
  const reelCards = await Promise.all(reels.map(async (item, itemIndex) => {
    const thumb = await localImage(`${item.shortcode}.jpg`);
    const dateLabel = date(item.date, item.date_precision);
    const missing = (item.missing || []).map((missingField) => `<li><strong>${esc(missingField)}:</strong> ${esc(item.missing_reasons?.[missingField] || 'No readable value was found.')}</li>`).join('');
    const hashtags = (item.hashtags || []).map((tag) => `#${tag}`).join(' ') || 'None captured';
    const mentions = (item.mentions || []).map((tag) => `@${tag}`).join(' ') || 'None captured';
    const itemError = item.last_error ? `<li><strong>Collection error:</strong> ${esc(item.last_error)}</li>` : '';
    const statusLabel = item.status === 'complete' ? 'Complete' : item.status === 'archived' ? 'Deleted / archived' : item.status === 'age_restricted' ? 'Age restricted' : item.status === 'pending' ? (item.retry_review?.action === 'retry_reel_details' ? 'Retry pending' : 'Analysis pending') : 'Needs review';
    const statusClass = item.status === 'complete' ? 'complete' : isResolvedReel(item) ? 'resolved' : item.status === 'pending' ? 'pending' : 'review';
    const warning = missing || itemError ? `<div class="reel-warning"><strong>Manual review needed</strong><ul>${itemError}${missing}</ul></div>` : '';
    return `<article class="reel-card" data-reel-card data-status="${esc(item.status)}" data-date="${esc(item.date || '')}" data-views="${Number.isFinite(item.views?.value) ? item.views.value : -1}"><div class="reel-visual">${thumb ? `<img src="../../media/${esc(thumb)}" alt="Thumbnail for reel ${esc(item.shortcode)}" loading="lazy">` : `<span class="visual-placeholder">NO IMAGE</span>`}<span class="reel-index">${String(itemIndex + 1).padStart(2, '0')} / ${String(reels.length).padStart(2, '0')}</span><span class="reel-status ${statusClass}">${statusLabel}</span></div><div class="reel-content"><div class="reel-top"><span class="reel-date">${esc(dateLabel)}${item.date_precision === 'day' ? ' Â· date only' : ''}</span>${external(item.url, 'Open reel', 'reel-link')}</div><h3>${esc(item.shortcode)}</h3><p class="reel-caption">${esc(item.caption || 'No caption captured.')}</p><div class="reel-metrics"><div><span>VIEWS</span><strong>${esc(metric(item.views))}</strong></div><div><span>LIKES</span><strong>${esc(metric(item.likes))}</strong></div><div><span>COMMENTS</span><strong>${esc(metric(item.comments))}</strong></div></div>${warning}<details class="reel-details"><summary>Record details <span aria-hidden="true">+</span></summary><dl>${field('Reel URL', item.url)}${item.retry_review ? field('Availability', 'Exists; manually confirmed by user') + field('Analysis', item.status === 'pending' ? 'Ready for retry' : statusLabel) + field('Availability checked', date(item.deletion_check?.checked_at)) : ''}${field('Published date precision', item.date_precision || 'Unavailable')}${item.manual_verification?.date ? field('Date manually checked by', 'User') + field('Date check recorded', date(item.manual_verification.date.verified_at)) : ''}${field('Views source', item.views?.source)}${field('Views observed', item.views?.observed_at ? date(item.views.observed_at) : null)}${field('Grid views label', item.grid_views_raw)}${field('Likes source', item.likes?.source)}${field('Comments source', item.comments?.source)}${item.reshares ? field('Reshares', metric(item.reshares)) + field('Reshares source', item.reshares.source) : ''}${item.likes_visibility ? field('Like count visibility', item.likes_visibility) : ''}${field('Fetched', item.fetched_at ? date(item.fetched_at) : null)}${field('Hashtags', hashtags)}${field('Mentions', mentions)}${field('Thumbnail URL', item.thumbnail_url)}${field('Media URL', item.media_url)}${field('Status', item.status)}</dl></details></div></article>`;
  }));
  const recordNumber = String(publishedProfiles.indexOf(published) + 1).padStart(3, '0');
  const profileHtml = shell({ title: `@${published} Â· dedgram atlas`, description: `Saved profile details and ${reels.length} reel records for @${published}.`, base: '../../', active: 'profile', profileKey: published, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">SAVED ${esc(date(profile.fetched_at))}</span></div><div class="profile-title-row"><div class="profile-avatar">${avatar}</div><div><div class="eyebrow">PROFILE RECORD / ${recordNumber}</div><h1>@${published}</h1>${displayName ? `<p>${esc(displayName)}</p>` : ''}</div><div class="profile-hero-link">${external(profile.url || instagram(published), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>${esc(profile.category || 'Category unavailable')}</span><span>${profile.ai_generated_profile ? 'AI-generated profile' : 'AI label not shown'}</span><span>Collected ${esc(date(profile.fetched_at))}</span></div></section><section class="profile-stats" aria-label="Profile metrics"><div><span>FOLLOWERS</span><strong>${esc(metric(profile.followers_count))}</strong><small>Saved count</small></div><div><span>FOLLOWING</span><strong>${esc(metric(profile.following_count))}</strong><small>Profile header</small></div><div><span>POSTS</span><strong>${esc(metric(profile.posts_count))}</strong><small>Saved count</small></div><div><span>REELS</span><strong>${fmt(reels.length)}</strong><small>Full grid confirmed</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / ACCOUNT DETAILS</span><h2>Account details</h2><dl class="account-facts">${field('Category', profile.category)}${field('Account based in', profile.account_based_in)}${field('Date joined', profile.date_joined)}${field('Former usernames', metric(profile.former_usernames_count))}${field('AI-generated label', profile.ai_generated_profile ? 'Shown on Instagram' : 'Not shown')}${field('Last profile scan', date(profile.fetched_at))}${field('Reel grid verified', date(discovery.reel.attempted_at))}${field('Collection run', `${run.status || 'Unknown'} Â· ${complete}/${reels.length} reels complete`)}</dl></div><div class="context-card bio-card"><span class="overline">PROFILE BIO</span><h2>Bio</h2><p class="bio-text">${esc(profile.bio || 'No bio captured.')}</p></div></section>${collectionNote}${profileIssues ? `<section class="evidence-note"><span class="note-symbol">i</span><div><h2>Source note</h2><ul>${profileIssues}</ul><p>These notes come from the saved collection record.</p></div></section>` : ''}<section class="reels-section" id="reels"><div class="section-head"><div><span class="overline">03 / REEL RECORDS</span><h2>${fmt(reels.length)} reels</h2><p>${fmt(complete)} complete · ${fmt(resolvedCount)} manually resolved · ${fmt(review)} need review${pendingItems.length ? ` · ${fmt(pendingItems.length)} pending (${fmt(retryCount)} retries)` : ''} · Metrics retain Instagram's displayed precision.</p></div><div class="reel-controls"><div class="control-field"><label for="reel-search">Search reels</label><input id="reel-search" type="search" placeholder="Shortcode or caption" autocomplete="off"></div><div class="control-field"><label for="reel-filter">Show</label><select id="reel-filter"><option value="all">All records</option><option value="complete">Complete</option><option value="resolved">Manually resolved</option><option value="pending">Analysis / retry pending</option><option value="review">Needs review</option></select></div><div class="control-field"><label for="reel-sort">Sort</label><select id="reel-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="views">Most views</option></select></div></div></div><div class="directory-toolbar"><span id="reel-count">${fmt(reels.length)} reels shown</span><span>SAVED SNAPSHOT</span></div><div class="reel-grid" id="reel-grid">${reelCards.join('')}</div><p class="empty-state" id="reel-empty" hidden>No reels match those filters.</p></section><section class="downloads"><div><span class="overline">04 / SOURCE FILES</span><h2>Source files</h2><p>Original records and exports.</p></div><div class="download-links">${files.map((name) => `<a href="../../downloads/${published}/${name}" ${name.endsWith('.json') || name.endsWith('.csv') ? 'download' : ''}>${esc(name)}</a>`).join('')}</div></section>` });
  profilePages.push({ published, html: profileHtml });
}

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets'), { recursive: true });
await mkdir(join(output, 'media'), { recursive: true });
await mkdir(join(output, 'overview'), { recursive: true });
await mkdir(join(output, 'profiles'), { recursive: true });
await writeFile(join(output, 'index.html'), overviewHomeHtml);
await writeFile(join(output, 'overview', 'index.html'), overviewWithExclusionTerminology);
await writeFile(join(output, 'profiles', 'index.html'), publicCatalogHtml);
for (const page of profilePages) {
  await mkdir(join(output, 'profiles', page.published), { recursive: true });
  await mkdir(join(output, 'downloads', page.published), { recursive: true });
  await writeFile(join(output, 'profiles', page.published, 'index.html'), publicProfileHtml(page.html));
  if (!excludedSet.has(page.published) || snapshotData.has(page.published)) {
    for (const file of files) {
      const destination = join(output, 'downloads', page.published, file);
      if (file === 'items.json') await writeFile(destination, JSON.stringify(snapshotData.get(page.published).items, null, 2) + '\n');
      else await copyFile(join(source, page.published, file), destination);
    }
  }
}
for (const file of ['site.css', 'site.js', 'favicon.svg']) await copyFile(join(root, 'src', file), join(output, 'assets', file));
for (const file of await readdir(join(source, 'media'))) await copyFile(join(source, 'media', file), join(output, 'media', file));
console.log(`Built ${output}: ${index.profile_keys.length} indexed profiles, ${publishedProfiles.length} published profiles.`);
