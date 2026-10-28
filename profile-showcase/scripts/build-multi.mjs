import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'snapshot');
const output = join(root, 'dist');
const fullProfiles = ['edlt.shox', 'pexe.bh', 'pigeon.flac', 'reposted', 'pichypeapp', 'printamovie'];
const profileLevelProfiles = ['illmisguideyou'];
const resolvedProfiles = ['hnvx.07', 'prime_senchui', 'vlad.aep_', 'nxx._.nmercy', 'dexea.100k', 'igpostinggang', 'rzk.mp4', 'renyajichu', 'hammergag', 'caodogsfofo', 'back'];
const publishedProfiles = [...fullProfiles, ...profileLevelProfiles, ...resolvedProfiles];
const profileLevelSet = new Set(profileLevelProfiles);
const resolvedSet = new Set(resolvedProfiles);
const files = ['profile.json', 'discovery.json', 'items.json', 'run.json', 'profile.csv', 'items.csv', 'report.html'];
const readJson = async (name) => JSON.parse(await readFile(join(source, name), 'utf8'));
const resolutions = await readJson('resolutions.json');
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

const partialPublishedProfiles = new Set(['edlt.shox', 'pichypeapp', 'printamovie']);
const snapshotData = new Map();
for (const username of [...fullProfiles, ...profileLevelProfiles]) {
  const [profile, discovery, items, run] = await Promise.all([
    readJson(`${username}/profile.json`), readJson(`${username}/discovery.json`),
    readJson(`${username}/items.json`), readJson(`${username}/run.json`)
  ]);
  snapshotData.set(username, { profile, discovery, items, run });
}

const numberMetric = (value) => Number.isFinite(value?.value) ? value.value : null;
const publishedSnapshotProfiles = [...fullProfiles, ...profileLevelProfiles];
const publishedReelRows = publishedSnapshotProfiles.flatMap((username) => {
  const snapshot = snapshotData.get(username);
  return (snapshot.items || []).filter((item) => item.kind === 'reel').map((item) => ({ username, ...item }));
});
const publishedReelUrls = publishedSnapshotProfiles.reduce((sum, username) => sum + (snapshotData.get(username).discovery.reel.items || []).length, 0);
const completeReels = publishedReelRows.filter((item) => item.status === 'complete' && !item.last_error);
const reviewReels = publishedReelRows.filter((item) => item.status !== 'complete' || item.last_error);
const totalMetric = (rows, key) => rows.reduce((sum, row) => sum + (numberMetric(row[key]) || 0), 0);
const measuredMetric = (rows, key) => rows.filter((row) => numberMetric(row[key]) !== null);
const metricTotal = (rows, kind, key) => {
  const measured = rows.filter((row) => row.kind === kind && numberMetric(row[key]) !== null);
  return measured.length ? fmt(totalMetric(measured, key)) : 'Unavailable';
};
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
  profileRecords: publishedSnapshotProfiles.length,
  resolvedRecords: resolvedProfiles.length,
  futureCandidates: index.profile_keys.length - publishedProfiles.length,
  nearTerm: [...partialPublishedProfiles, ...profileLevelProfiles].length,
  reelUrls: publishedReelUrls,
  reelDetails: completeReels.length,
  reelReview: reviewReels.length,
  posts: exactPostRows.reduce((sum, value) => sum + numberMetric(value), 0),
  views: totalMetric(publishedReelRows, 'views'),
  viewsCovered: measuredMetric(publishedReelRows, 'views').length,
  likes: totalMetric(publishedReelRows, 'likes'),
  likesCovered: measuredMetric(publishedReelRows, 'likes').length,
  comments: totalMetric(publishedReelRows, 'comments'),
  commentsCovered: measuredMetric(publishedReelRows, 'comments').length
};

function shell({ title, description, base, active, profileKey, content }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><meta name="description" content="${esc(description)}"><title>${esc(title)}</title><link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/site.css"><script src="${base}assets/site.js" defer></script></head><body><a class="skip-link" href="#main">Skip to content</a><header class="topbar"><div class="topbar-inner"><a class="brand" href="${base}" aria-label="deadgram atlas home"><img class="brand-icon" src="${base}assets/favicon.svg" alt=""><span>deadgram <small>ATLAS</small></span></a><nav aria-label="Main navigation"><a class="${active === 'catalog' ? 'active' : ''}" href="${base}profiles/">Profiles</a><a class="${active === 'overview' ? 'active' : ''}" href="${base}">Overview</a>${profileKey ? `<a class="${active === 'profile' ? 'active' : ''}" href="./">Profile record</a>` : ''}</nav><span class="nav-status">COLLECTION IN PROGRESS</span></div></header><main id="main">${content}</main><footer class="footer"><div><strong>deadgram ATLAS</strong><p>Saved profile records.</p></div><div><span>Updated ${esc(buildDate)}</span><span>Metrics reflect the saved snapshot.</span></div></footer></body></html>`;
}

const publishedSet = new Set(publishedProfiles);
const catalogCard = (username, i, ready) => {
  const resolved = resolutions.profiles?.[username];
  const label = resolved ? `Account status: ${resolved.status}` : profileLevelSet.has(username) ? 'Profile saved; reel analysis pending' : partialPublishedProfiles.has(username) ? 'Some reels analyzed' : ready ? 'Profile and reels analyzed' : 'Not analyzed yet';
  const tag = resolved ? 'Status confirmed' : profileLevelSet.has(username) ? 'Profile saved' : ready ? 'View record' : 'Not analyzed';
  const inner = `<span class="row-number">${String(i + 1).padStart(3, '0')}</span><span class="row-title"><strong>@${esc(username)}</strong><small>${esc(label)}</small></span><span class="row-tag ${ready ? 'live' : ''}">${esc(tag)}</span>`;
  return `<article class="profile-row" data-catalog-row><div class="profile-row-main">${ready ? `<a class="profile-internal" href="./profiles/${username}/" aria-label="View saved profile data for @${username}">${inner}</a>` : `<div class="profile-internal">${inner}</div>`}</div><div class="row-external">${external(instagram(username), 'Instagram', 'external-link')}</div></article>`;
};
const publishedCards = publishedProfiles.map((username) => catalogCard(username, index.profile_keys.indexOf(username), true)).join('');
const futureCards = index.profile_keys.filter((username) => !publishedSet.has(username))
  .map((username) => catalogCard(username, index.profile_keys.indexOf(username), false)).join('');
const publishedCount = publishedProfiles.length;
const catalogCards = `${publishedCards}<details class="future-directory" data-catalog-future><summary>Show ${fmt(index.profile_keys.length - publishedCount)} future collection candidates</summary><div class="profile-list future-profile-list">${futureCards}</div></details>`;
const catalogHtml = shell({ title: 'Profiles Â· deadgram atlas', description: 'Explore the deadgram profile catalog and the published research profiles.', base: './', active: 'catalog', content: `<section class="hero catalog-hero"><div class="hero-copy"><div class="eyebrow">PROFILE INDEX / PUBLIC PREVIEW</div><h1>Profiles,<br>on record.</h1><p>${fmt(index.profile_keys.length)} accounts indexed. ${fmt(publishedCount)} profile records are available; the rest are being collected.</p><div class="hero-actions"><a class="button primary" href="#published">View published profiles</a><a class="button secondary" href="#directory">Browse profiles</a></div></div><div class="hero-count" aria-label="${fmt(publishedCount)} of ${fmt(index.profile_keys.length)} profiles published"><strong>${String(publishedCount).padStart(2, '0')}</strong><span>/ ${fmt(index.profile_keys.length)} PUBLISHED</span></div></section><section class="stat-strip" aria-label="Publishing status"><div><span>CATALOG</span><strong>${fmt(index.profile_keys.length)}</strong><small>profile URLs indexed</small></div><div><span>PUBLISHED</span><strong>${fmt(publishedCount)}</strong><small>profile records available</small></div><div><span>IN PROGRESS</span><strong>${fmt(index.profile_keys.length - publishedCount)}</strong><small>more profiles to publish</small></div></section><section class="process-note"><div><h2>Collection in progress</h2><p>More profile records will appear here as they are checked.</p></div></section><section class="directory" id="published"><div class="section-head"><div><span class="overline">01 / PUBLISHED RECORDS</span><h2>Ready to explore</h2><p>Completed records and partial reel coverage are labeled below.</p></div></div><div class="profile-list">${publishedProfiles.map((username) => `<article class="profile-row"><div class="profile-row-main"><a class="profile-internal" href="./profiles/${username}/" aria-label="View saved profile data for @${username}"><span class="row-title"><strong>@${esc(username)}</strong><small>${partialPublishedProfiles.has(username) ? 'Partial reel coverage' : 'Profile and reel analysis complete'}</small></span><span class="row-tag live">View record</span></a></div><div class="row-external">${external(instagram(username), 'Instagram', 'external-link')}</div></article>`).join('')}</div></section><section class="directory" id="directory"><div class="section-head"><div><span class="overline">02 / DIRECTORY</span><h2>Profile index</h2><p>Direct Instagram links for all ${fmt(index.profile_keys.length)} accounts.</p></div><div class="directory-search"><label for="catalog-search">Find a profile</label><input id="catalog-search" type="search" placeholder="Search @username" autocomplete="off"></div></div><div class="directory-toolbar"><span id="catalog-count">${fmt(index.profile_keys.length)} profiles shown</span><span>SAVED RECORDS APPEAR WHEN READY</span></div><div class="profile-list" id="profile-list">${catalogCards}</div><p class="empty-state" id="catalog-empty" hidden>No profiles match that search.</p></section>` });

const catalogHtmlForOutput = publishedProfiles.reduce((html, username) => {
  const resolved = resolutions.profiles?.[username];
  const label = resolved ? `Account status: ${resolved.status}` : profileLevelSet.has(username) ? 'Profile saved; reel analysis pending' : partialPublishedProfiles.has(username) ? 'Some reels analyzed' : 'Profile and reels analyzed';
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(<strong>@${escapedUsername}<\\/strong><small>)[^<]*(</small>)`, 'g'), `$1${esc(label)}$2`);
}, catalogHtml);
const publicCatalogHtml = catalogHtmlForOutput
  .replace(`${fmt(index.profile_keys.length)} profiles shown`, `${fmt(publishedCount)} profiles shown`)
  .replace('<strong>@illmisguideyou</strong><small>Profile and reel analysis complete</small>', '<strong>@illmisguideyou</strong><small>Profile saved; reel analysis pending</small>')
  .replaceAll('Profile and reel analysis complete', 'Profile and reels analyzed')
  .replaceAll('Partial reel coverage', 'Some reels analyzed')
  .replaceAll('Resolved:', 'Account status:')
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
  const complete = details.filter((item) => item.status === 'complete' && !item.last_error).length;
  const status = profileLevelSet.has(username) ? 'Profile level complete' : partialPublishedProfiles.has(username) ? 'Partial reel coverage' : 'Reel analysis complete';
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a><small class="cell-note">${esc(status)}</small></td><td>${esc(metric(profile.posts_count))}</td><td>${fmt(reels.length)}</td><td>${fmt(complete)} / ${fmt(reels.length)}</td><td>${metricTotal(items, 'post', 'likes')}</td><td>${metricTotal(items, 'reel', 'likes')}</td><td>${metricTotal(items, 'reel', 'views')}</td><td>${fmt(details.filter((item) => numberMetric(item.views) !== null).length)}</td><td>${esc(metric(profile.followers_count))}</td></tr>`;
}).join('');
const deletedProfiles = resolvedProfiles.filter((username) => resolutions.profiles?.[username]?.status === 'Deleted account');
const ageRestrictedProfiles = resolvedProfiles.filter((username) => resolutions.profiles?.[username]?.status === 'Age restricted');
const falseIdentificationProfiles = resolvedProfiles.filter((username) => resolutions.profiles?.[username]?.status === 'False identification');
const overviewDeletedRow = (username) => {
  const resolved = resolutions.profiles?.[username] || {};
  const firstUnavailable = resolved.deletion_date_range?.before_first_unavailable_at || resolved.observed_at;
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${esc(date(resolved.last_fetched_at || resolved.observed_at))}</td><td>${esc(date(firstUnavailable))}</td></tr>`;
};
const overviewDeletedRows = deletedProfiles.map(overviewDeletedRow).join('');
const overviewAgeRestrictedRows = ageRestrictedProfiles.map((username) => {
  const resolved = resolutions.profiles?.[username] || {};
  const firstRestricted = resolved.age_restriction?.before_initial_blocked_or_failed_at || resolved.observed_at;
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${resolved.minimum_age ? `${fmt(resolved.minimum_age)}+` : 'Age restricted'}</td><td>${esc(date(resolved.last_fetched_at || resolved.observed_at))}</td><td>${esc(date(firstRestricted))}</td></tr>`;
}).join('');
const overviewFalseIdentificationRows = falseIdentificationProfiles.map((username) => {
  const resolved = resolutions.profiles?.[username] || {};
  return `<tr><td><a href="../profiles/${username}/">@${esc(username)}</a></td><td>${esc(date(resolved.last_fetched_at || resolved.observed_at))}</td><td>${esc(date(resolved.false_identification?.identified_at || resolved.observed_at))}</td><td>${esc(resolved.false_identification?.reason || 'Manual review')}</td></tr>`;
}).join('');
const overviewReelRows = (await Promise.all(topReels.map(async (item) => {
  const thumb = await localImage(`${item.shortcode}.jpg`);
  const image = thumb ? `<img class="overview-reel-thumb" src="../media/${esc(thumb)}" alt="Cover image for reel ${esc(item.shortcode)}" loading="lazy">` : '<span class="overview-thumb-fallback" aria-hidden="true">REEL</span>';
  return `<tr><td><div class="content-cell">${image}<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.shortcode)} ↗</a></div></td><td><a href="../profiles/${item.username}/">@${esc(item.username)}</a></td><td>${esc(date(item.date, item.date_precision))}</td><td><strong>${esc(metric(item.views))}</strong></td><td>${esc(metric(item.likes))}</td><td>${esc(metric(item.comments))}</td></tr>`;
}))).join('');
const overviewHtml = shell({ title: 'Overview · deadgram atlas', description: 'Overall statistics for the completed deadgram public snapshot.', base: '../', active: 'overview', content: `
  <section class="hero overview-hero"><div class="hero-copy"><div class="eyebrow">COLLECTION OVERVIEW / PUBLIC SNAPSHOT</div><h1>The whole picture,<br><em>one reel at a time.</em></h1><p>These totals reflect the research records currently available on the public site. Uncollected candidates stay out of the first view until you choose to reveal them.</p><div class="hero-actions"><a class="button primary" href="../">View published profiles</a><a class="button secondary" href="../#future">Show future candidates</a></div></div><div class="hero-count" aria-label="${fmt(overview.publicRecords)} public records"><strong>${String(overview.publicRecords).padStart(2, '0')}</strong><span>PUBLIC RECORDS</span></div></section>
  <section class="stat-strip overview-stat-strip" aria-label="Overall collection statistics"><div><span>PROFILES WITH DATA</span><strong>${fmt(overview.profileRecords)}</strong><small>Saved profile information</small></div><div><span>REELS FOUND</span><strong>${fmt(overview.reelUrls)}</strong><small>Reels found on profile pages</small></div><div><span>REELS ANALYZED</span><strong>${fmt(overview.reelDetails)}</strong><small>Full reel information captured</small></div><div><span>PARTIALLY ANALYZED</span><strong>${fmt(overview.reelReview)}</strong><small>Reels with some information missing</small></div><div><span>ACCOUNT STATUS CONFIRMED</span><strong>${fmt(overview.resolvedRecords)}</strong><small>Finished account outcomes</small></div></section>
  <section class="stat-strip overview-stat-strip secondary-stats" aria-label="Collected metrics"><div><span>INSTAGRAM POSTS</span><strong>${fmt(overview.posts)}</strong><small>${fmt(overview.profileRecords)} profiles with saved counts</small></div><div><span>TOTAL REEL VIEWS</span><strong>${fmt(overview.views)}</strong><small>${fmt(overview.viewsCovered)} reels with readable views</small></div><div><span>TOTAL REEL LIKES</span><strong>${fmt(overview.likes)}</strong><small>${fmt(overview.likesCovered)} reels with readable likes</small></div><div><span>NEXT TO ANALYZE</span><strong>${fmt(overview.nearTerm)}</strong><small>Published profiles with more work queued</small></div></section>
  <section class="overview-grid"><div class="overview-panel"><span class="overline">PROFILE MAP</span><h2>Accounts by country</h2>${overviewBars(countryRows, overview.profileRecords)}</div><div class="overview-panel"><span class="overline">REEL LANGUAGE</span><h2>Frequent hashtags</h2>${overviewBars(hashtagRows, completeReels.length)}<p class="panel-foot">From completed reel captions.</p></div></section>
  <section class="overview-table"><div class="section-head"><div><span class="overline">ANALYZED PROFILES</span><h2>Profile performance</h2><p>This table contains only profiles with saved analysis data. Totals use the information captured from their posts and reels.</p></div></div><div class="table-wrap"><table><thead><tr><th>PROFILE</th><th>POSTS</th><th>REELS FOUND</th><th>REELS ANALYZED</th><th>TOTAL POST LIKES</th><th>TOTAL REEL LIKES</th><th>TOTAL REEL VIEWS</th><th>REELS WITH VIEW COUNTS</th><th>FOLLOWERS</th></tr></thead><tbody>${overviewAccountRows}</tbody></table></div></section>
  <section class="status-panels" aria-label="Profiles excluded from analysis"><div class="status-intro"><span class="overline">PROFILES NO LONGER AVAILABLE FOR ANALYSIS</span><p>These profiles were available during the initial scan. They were later found to be deleted, age-restricted, or incorrectly identified, so they are kept as status records and excluded from the analysis totals below.</p></div><div class="status-panel-grid"><section class="status-panel"><span class="overline">DELETED PROFILES</span><h3>Later found unavailable</h3><p>Collected first, then flagged when the Instagram profile was no longer available.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>COLLECTED ON</th><th>FLAGGED AS POSSIBLY DELETED</th></tr></thead><tbody>${overviewDeletedRows}</tbody></table></div></section><section class="status-panel"><span class="overline">AGE-RESTRICTED PROFILES</span><h3>Later became age-restricted</h3><p>Collected first, then found behind Instagram’s age restriction.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>AGE REQUIREMENT</th><th>COLLECTED ON</th><th>FLAGGED AS AGE-RESTRICTED</th></tr></thead><tbody>${overviewAgeRestrictedRows}</tbody></table></div></section><section class="status-panel status-panel-full"><span class="overline">FALSE IDENTIFICATION</span><h3>Removed from the analysis set</h3><p>This capture did not provide enough evidence that the username represented a real Instagram profile.</p><div class="table-wrap"><table><thead><tr><th>USERNAME</th><th>COLLECTED ON</th><th>FLAGGED AS FALSE IDENTIFICATION</th><th>REASON</th></tr></thead><tbody>${overviewFalseIdentificationRows}</tbody></table></div></section></div></section>
  <section class="overview-table"><div class="section-head"><div><span class="overline">TOP REELS</span><h2>Most viewed reels</h2><p>Based on view counts captured from Instagram.</p></div></div><div class="table-wrap"><table><thead><tr><th>REEL</th><th>PROFILE</th><th>DATE</th><th>VIEWS</th><th>LIKES</th><th>COMMENTS</th></tr></thead><tbody>${overviewReelRows || '<tr><td colspan="6">No reel information is available yet.</td></tr>'}</tbody></table></div></section>
  <section class="process-note"><div><h2>${fmt(overview.futureCandidates)} future candidates are hidden by default</h2><p>They are indexed but do not have a public saved record yet. Use the Profiles tab or the button above to reveal them.</p></div></section>
  <p class="method-note">Totals are from the current saved snapshot, not a time series. Instagram's abbreviated K/M counts are kept where applicable; missing metrics are shown as unavailable.</p>` });
const overviewAliasHtml = overviewHtml
  .replace('href="../">View published profiles', 'href="../profiles/">View published profiles')
  .replace('href="../#future"', 'href="../profiles/#future"');
const overviewHomeHtml = overviewAliasHtml.replaceAll('../', './');

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
  .replaceAll('Record details', 'More information')
  .replaceAll('Individual reel pages have not been scraped yet', 'The individual reels have not been analyzed yet')
  .replaceAll('the saved discovery JSON is ready for the next reel-details run', 'the saved reel list is ready for the next analysis')
  .replaceAll('href="../../">All profiles', 'href="../../profiles/">All profiles')
  .replaceAll('Profile-level record', 'Saved profile information')
  .replaceAll('profile-level record', 'saved profile information');

function resolvedProfilePage(resolved, recordNumber) {
  const status = resolved.status || 'Resolved';
  const range = resolved.deletion_date_range || resolved.age_restriction;
  const reason = status === 'Deleted account' ? 'Instagram reported the profile as unavailable after its earlier bot classification.'
    : status === 'Age restricted' ? `Instagram access was age restricted to users ${resolved.minimum_age || 25}+.`
      : resolved.false_identification?.reason || 'Manual review concluded that this capture should not be treated as a confirmed Instagram profile.';
  const timing = range ? `${date(range.after_classified_at)} to ${date(range.before_first_unavailable_at || range.before_initial_blocked_or_failed_at)}` : date(resolved.observed_at);
  return shell({ title: `@${resolved.username} · deadgram atlas`, description: `${status} resolution record for @${resolved.username}.`, base: '../../', active: 'profile', profileKey: resolved.username, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">RESOLVED ${esc(date(resolved.observed_at))}</span></div><div class="profile-title-row"><div class="profile-avatar"><span aria-hidden="true">@</span></div><div><div class="eyebrow">RESOLUTION RECORD / ${recordNumber}</div><h1>@${esc(resolved.username)}</h1><p>${esc(status)}</p></div><div class="profile-hero-link">${external(instagram(resolved.username), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>RESOLVED RECORD</span><span>${esc(status)}</span><span>Observed ${esc(date(resolved.observed_at))}</span></div></section><section class="profile-stats" aria-label="Resolution status"><div><span>STATUS</span><strong>${esc(status)}</strong><small>Collection resolved</small></div><div><span>OBSERVED</span><strong>${esc(date(resolved.observed_at))}</strong><small>Status evidence</small></div><div><span>REEL DETAILS</span><strong>Not collected</strong><small>No further scrape required</small></div><div><span>PUBLIC RECORD</span><strong>Finished</strong><small>Resolution preserved</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / RESOLUTION DETAILS</span><h2>${esc(status)}</h2><dl class="account-facts">${field('Reason', reason)}${field('Observed', date(resolved.observed_at))}${field('Relevant interval', timing)}${field('Minimum age', resolved.minimum_age ? `${resolved.minimum_age}+` : null)}${field('Posts captured', resolved.posts_count)}${field('Date joined', resolved.date_joined)}</dl></div><div class="context-card bio-card"><span class="overline">EVIDENCE</span><h2>Why this record is finished</h2><p class="bio-text">${esc(reason)}</p>${resolved.profile_text ? `<p class="bio-text">Original captured profile text is preserved in the source record.</p>` : ''}</div></section><section class="evidence-note"><span class="note-symbol">i</span><div><h2>No further collection required</h2><p>This profile is included as a resolved record because its final state is known. It is not counted as an unfinished profile in the public catalog.</p></div></section>` });
}

async function profileLevelPage(published, profile, discovery, items, run, recordNumber) {
  const reels = discovery.reel.items || [];
  const reelDetails = items.filter((item) => item.kind === 'reel');
  const avatarFile = await localImage(`avatar-${published}.jpg`);
  const avatar = avatarFile ? `<img src="../../media/${avatarFile}" alt="Profile picture of @${published}" width="92" height="92">` : `<span aria-hidden="true">@</span>`;
  return shell({ title: `@${published} · deadgram atlas`, description: `Profile-level record and ${reels.length} saved reel URLs for @${published}.`, base: '../../', active: 'profile', profileKey: published, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">SAVED ${esc(date(profile.fetched_at))}</span></div><div class="profile-title-row"><div class="profile-avatar">${avatar}</div><div><div class="eyebrow">PROFILE LEVEL RECORD / ${recordNumber}</div><h1>@${published}</h1>${profile.category ? `<p>${esc(profile.category)}</p>` : ''}</div><div class="profile-hero-link">${external(profile.url || instagram(published), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>PROFILE LEVEL COMPLETE</span><span>REEL DETAILS PENDING</span><span>Collected ${esc(date(profile.fetched_at))}</span></div></section><section class="profile-stats" aria-label="Profile metrics"><div><span>FOLLOWERS</span><strong>${esc(metric(profile.followers_count))}</strong><small>Saved count</small></div><div><span>FOLLOWING</span><strong>${esc(metric(profile.following_count))}</strong><small>Profile header</small></div><div><span>POSTS</span><strong>${esc(metric(profile.posts_count))}</strong><small>Exact header count</small></div><div><span>REEL URLS</span><strong>${fmt(reels.length)}</strong><small>Full grid confirmed</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / ACCOUNT DETAILS</span><h2>Profile level complete</h2><dl class="account-facts">${field('Category', profile.category)}${field('Account based in', profile.account_based_in)}${field('Date joined', profile.date_joined)}${field('Last profile scan', date(profile.fetched_at))}${field('Reel grid verified', date(discovery.reel.attempted_at))}${field('Collection run', `${run.status || 'Unknown'} · ${reelDetails.length}/${reels.length} reel details complete`)}</dl></div><div class="context-card bio-card"><span class="overline">PROFILE BIO</span><h2>What the account says</h2><p class="bio-text">${esc(profile.bio || 'No bio captured.')}</p></div></section><section class="evidence-note"><span class="note-symbol">i</span><div><h2>Reel-level analysis pending</h2><p>${fmt(reels.length)} reel URLs are saved and counted. Individual reel pages have not been scraped yet; the saved discovery JSON is ready for the next reel-details run.</p></div></section><section class="downloads"><div><span class="overline">03 / SOURCE FILES</span><h2>Source files</h2><p>Original profile-level records and exports.</p></div><div class="download-links">${files.map((name) => `<a href="../../downloads/${published}/${name}" ${name.endsWith('.json') || name.endsWith('.csv') ? 'download' : ''}>${esc(name)}</a>`).join('')}</div></section>` });
}

const profilePages = [];
for (const published of publishedProfiles) {
  const resolved = resolutions.profiles?.[published];
  if (resolved) {
    profilePages.push({ published, html: resolvedProfilePage(resolved, String(publishedProfiles.indexOf(published) + 1).padStart(3, '0')) });
    continue;
  }
  const profile = await readJson(`${published}/profile.json`);
  const discovery = await readJson(`${published}/discovery.json`);
  const items = await readJson(`${published}/items.json`);
  const run = await readJson(`${published}/run.json`);
  if (profile.username !== published || !Array.isArray(items) || !discovery.reel?.complete) throw new Error(`Published snapshot is incomplete for ${published}.`);
  if (profileLevelSet.has(published)) {
    profilePages.push({ published, html: await profileLevelPage(published, profile, discovery, items, run, String(publishedProfiles.indexOf(published) + 1).padStart(3, '0')) });
    continue;
  }
  const reels = items.filter((item) => item.kind === 'reel');
  if (reels.length !== discovery.reel.items.length) throw new Error(`Published reel records do not match the confirmed grid for ${published}.`);
  const complete = reels.filter((item) => item.status === 'complete' && !item.last_error).length;
  const review = reels.length - complete;
  const avatarFile = await localImage(`avatar-${published}.jpg`);
  const avatar = avatarFile ? `<img src="../../media/${avatarFile}" alt="Profile picture of @${published}" width="92" height="92">` : `<span aria-hidden="true">@</span>`;
  const displayName = plainText(profile.display_name).trim();
  const profileIssues = (profile.issues || []).map((issue) => `<li>${esc(issue)}</li>`).join('');
  const reviewItems = reels.filter((item) => item.status !== 'complete' || item.last_error);
  const reviewDetails = reviewItems.map((item) => {
    const missingReasons = (item.missing || []).map((missingField) => `${missingField}: ${item.missing_reasons?.[missingField] || 'No readable value was found.'}`);
    const reason = item.last_error || missingReasons.join('; ') || 'Record is incomplete and needs review.';
    return `<li><strong>${esc(item.shortcode)}:</strong> ${esc(reason)}</li>`;
  }).join('');
  const collectionNote = reviewItems.length ? `<section class="evidence-note"><span class="note-symbol">!</span><div><h2>Incomplete reel coverage</h2><p>${fmt(complete)} of ${fmt(reels.length)} reels have complete detail records. ${fmt(reviewItems.length)} need review.</p><ul>${reviewDetails}</ul><p>Incomplete records remain visible below and are labeled for manual review.</p></div></section>` : '';
  const reelCards = await Promise.all(reels.map(async (item, itemIndex) => {
    const thumb = await localImage(`${item.shortcode}.jpg`);
    const dateLabel = date(item.date, item.date_precision);
    const missing = (item.missing || []).map((missingField) => `<li><strong>${esc(missingField)}:</strong> ${esc(item.missing_reasons?.[missingField] || 'No readable value was found.')}</li>`).join('');
    const hashtags = (item.hashtags || []).map((tag) => `#${tag}`).join(' ') || 'None captured';
    const mentions = (item.mentions || []).map((tag) => `@${tag}`).join(' ') || 'None captured';
    const itemError = item.last_error ? `<li><strong>Collection error:</strong> ${esc(item.last_error)}</li>` : '';
    const warning = missing || itemError ? `<div class="reel-warning"><strong>Manual review needed</strong><ul>${itemError}${missing}</ul></div>` : '';
    return `<article class="reel-card" data-reel-card data-status="${esc(item.status)}" data-date="${esc(item.date || '')}" data-views="${Number.isFinite(item.views?.value) ? item.views.value : -1}"><div class="reel-visual">${thumb ? `<img src="../../media/${esc(thumb)}" alt="Thumbnail for reel ${esc(item.shortcode)}" loading="lazy">` : `<span class="visual-placeholder">NO IMAGE</span>`}<span class="reel-index">${String(itemIndex + 1).padStart(2, '0')} / ${String(reels.length).padStart(2, '0')}</span><span class="reel-status ${item.status === 'complete' ? 'complete' : 'review'}">${item.status === 'complete' ? 'Complete' : 'Needs review'}</span></div><div class="reel-content"><div class="reel-top"><span class="reel-date">${esc(dateLabel)}${item.date_precision === 'day' ? ' Â· date only' : ''}</span>${external(item.url, 'Open reel', 'reel-link')}</div><h3>${esc(item.shortcode)}</h3><p class="reel-caption">${esc(item.caption || 'No caption captured.')}</p><div class="reel-metrics"><div><span>VIEWS</span><strong>${esc(metric(item.views))}</strong></div><div><span>LIKES</span><strong>${esc(metric(item.likes))}</strong></div><div><span>COMMENTS</span><strong>${esc(metric(item.comments))}</strong></div></div>${warning}<details class="reel-details"><summary>Record details <span aria-hidden="true">+</span></summary><dl>${field('Reel URL', item.url)}${field('Published date precision', item.date_precision || 'Unavailable')}${field('Views source', item.views?.source)}${field('Views observed', item.views?.observed_at ? date(item.views.observed_at) : null)}${field('Grid views label', item.grid_views_raw)}${field('Likes source', item.likes?.source)}${field('Comments source', item.comments?.source)}${field('Fetched', item.fetched_at ? date(item.fetched_at) : null)}${field('Hashtags', hashtags)}${field('Mentions', mentions)}${field('Thumbnail URL', item.thumbnail_url)}${field('Media URL', item.media_url)}${field('Status', item.status)}</dl></details></div></article>`;
  }));
  const recordNumber = String(publishedProfiles.indexOf(published) + 1).padStart(3, '0');
  const profileHtml = shell({ title: `@${published} Â· deadgram atlas`, description: `Saved profile details and ${reels.length} reel records for @${published}.`, base: '../../', active: 'profile', profileKey: published, content: `<section class="profile-hero"><div class="profile-hero-top"><a class="back-link" href="../../">All profiles</a><span class="snapshot-label">SAVED ${esc(date(profile.fetched_at))}</span></div><div class="profile-title-row"><div class="profile-avatar">${avatar}</div><div><div class="eyebrow">PROFILE RECORD / ${recordNumber}</div><h1>@${published}</h1>${displayName ? `<p>${esc(displayName)}</p>` : ''}</div><div class="profile-hero-link">${external(profile.url || instagram(published), 'Instagram profile', 'button secondary')}</div></div><div class="profile-meta"><span>${esc(profile.category || 'Category unavailable')}</span><span>${profile.ai_generated_profile ? 'AI-generated profile' : 'AI label not shown'}</span><span>Collected ${esc(date(profile.fetched_at))}</span></div></section><section class="profile-stats" aria-label="Profile metrics"><div><span>FOLLOWERS</span><strong>${esc(metric(profile.followers_count))}</strong><small>Saved count</small></div><div><span>FOLLOWING</span><strong>${esc(metric(profile.following_count))}</strong><small>Profile header</small></div><div><span>POSTS</span><strong>${esc(metric(profile.posts_count))}</strong><small>Saved count</small></div><div><span>REELS</span><strong>${fmt(reels.length)}</strong><small>Full grid confirmed</small></div></section><section class="profile-context"><div class="context-card"><span class="overline">02 / ACCOUNT DETAILS</span><h2>Account details</h2><dl class="account-facts">${field('Category', profile.category)}${field('Account based in', profile.account_based_in)}${field('Date joined', profile.date_joined)}${field('Former usernames', metric(profile.former_usernames_count))}${field('AI-generated label', profile.ai_generated_profile ? 'Shown on Instagram' : 'Not shown')}${field('Last profile scan', date(profile.fetched_at))}${field('Reel grid verified', date(discovery.reel.attempted_at))}${field('Collection run', `${run.status || 'Unknown'} Â· ${complete}/${reels.length} reels complete`)}</dl></div><div class="context-card bio-card"><span class="overline">PROFILE BIO</span><h2>Bio</h2><p class="bio-text">${esc(profile.bio || 'No bio captured.')}</p></div></section>${collectionNote}${profileIssues ? `<section class="evidence-note"><span class="note-symbol">i</span><div><h2>Source note</h2><ul>${profileIssues}</ul><p>These notes come from the saved collection record.</p></div></section>` : ''}<section class="reels-section" id="reels"><div class="section-head"><div><span class="overline">03 / REEL RECORDS</span><h2>${fmt(reels.length)} reels</h2><p>${fmt(complete)} complete Â· ${fmt(review)} need review Â· Metrics retain Instagram's displayed precision.</p></div><div class="reel-controls"><div class="control-field"><label for="reel-search">Search reels</label><input id="reel-search" type="search" placeholder="Shortcode or caption" autocomplete="off"></div><div class="control-field"><label for="reel-filter">Show</label><select id="reel-filter"><option value="all">All records</option><option value="complete">Complete</option><option value="review">Needs review</option></select></div><div class="control-field"><label for="reel-sort">Sort</label><select id="reel-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="views">Most views</option></select></div></div></div><div class="directory-toolbar"><span id="reel-count">${fmt(reels.length)} reels shown</span><span>SAVED SNAPSHOT</span></div><div class="reel-grid" id="reel-grid">${reelCards.join('')}</div><p class="empty-state" id="reel-empty" hidden>No reels match those filters.</p></section><section class="downloads"><div><span class="overline">04 / SOURCE FILES</span><h2>Source files</h2><p>Original records and exports.</p></div><div class="download-links">${files.map((name) => `<a href="../../downloads/${published}/${name}" ${name.endsWith('.json') || name.endsWith('.csv') ? 'download' : ''}>${esc(name)}</a>`).join('')}</div></section>` });
  profilePages.push({ published, html: profileHtml });
}

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets'), { recursive: true });
await mkdir(join(output, 'media'), { recursive: true });
await mkdir(join(output, 'overview'), { recursive: true });
await mkdir(join(output, 'profiles'), { recursive: true });
await writeFile(join(output, 'index.html'), overviewHomeHtml);
await writeFile(join(output, 'overview', 'index.html'), overviewAliasHtml);
await writeFile(join(output, 'profiles', 'index.html'), publicCatalogHtml);
for (const page of profilePages) {
  await mkdir(join(output, 'profiles', page.published), { recursive: true });
  await mkdir(join(output, 'downloads', page.published), { recursive: true });
  await writeFile(join(output, 'profiles', page.published, 'index.html'), publicProfileHtml(page.html));
  if (!resolvedSet.has(page.published)) {
    for (const file of files) await copyFile(join(source, page.published, file), join(output, 'downloads', page.published, file));
  }
}
for (const file of ['site.css', 'site.js', 'favicon.svg']) await copyFile(join(root, 'src', file), join(output, 'assets', file));
for (const file of await readdir(join(source, 'media'))) await copyFile(join(source, 'media', file), join(output, 'media', file));
console.log(`Built ${output}: ${index.profile_keys.length} indexed profiles, ${publishedProfiles.length} published profiles.`);
