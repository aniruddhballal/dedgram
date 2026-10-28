import { badge, errorBanner, esc, gridLabel, metric, number, profileHref, renderStageStatus, reportHref, time } from './shared.js';

function reviewReason(item) {
  const parts = (item.missing || []).map((field) => `${field}: ${item.missing_reasons?.[field] || 'No readable value found.'}`);
  if (item.last_error) parts.push(`Retry: ${item.last_error}`);
  return parts.join(' · ');
}

function reelCoverUrl(item) {
  const shortcode = String(item.shortcode || '');
  return /^[A-Za-z0-9_-]+$/.test(shortcode) ? `/media/${encodeURIComponent(shortcode)}.jpg` : item.thumbnail_url || '';
}

function filteredItems(state) {
  const needle = state.itemSearch.trim().toLowerCase();
  const filter = state.itemFilter === 'review' ? 'review' : 'all';
  const items = state.detail.items.filter((item) => {
    if (item.kind !== 'reel') return false;
    if (filter === 'review' && !reviewReason(item)) return false;
    return !needle || [item.shortcode, item.caption, item.url].some((value) => String(value || '').toLowerCase().includes(needle));
  });
  if (state.itemSort === 'views') items.sort((a, b) => (b.views?.value ?? -1) - (a.views?.value ?? -1));
  else if (state.itemSort === 'likes') items.sort((a, b) => (b.likes?.value ?? -1) - (a.likes?.value ?? -1));
  else if (state.itemSort === 'oldest') items.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return items;
}

export function renderProfile(state) {
  const data = state.detail;
  if (!data) return '<div class="empty-state"><h1>Profile unavailable</h1><p>This account is not in the catalog.</p><a href="/">Back to collection</a></div>';
  const p = data.summary;
  const reelItems = data.items.filter((item) => item.kind === 'reel');
  const review = reelItems.filter((item) => !!reviewReason(item));
  const rows = filteredItems(state);
  const batchResult = state.batch?.results?.[p.username];
  const runDisabled = state.busy || state.readOnly || state.batch?.status === 'running';
  const usernameJob = data.username_job;
  const usernameCheck = p.username_check;
  const usernameCheckRunning = usernameJob?.status === 'running';
  const usernameChangeConfirmed = usernameCheck?.status === 'changed';
  const usernameMigrationApplied = usernameCheck?.status === 'applied';
  const hasSavedReel = Boolean(data.discovery?.reel?.items?.some((item) => item.url));
  const usernameCheckButton = usernameCheckRunning
    ? `<button class="button secondary" disabled>Checking username…</button>`
    : usernameChangeConfirmed
      ? `<button class="button primary" data-action="apply-username-change" data-username="${esc(p.username)}" data-detected-username="${esc(usernameCheck.detected_username)}" ${runDisabled ? 'disabled' : ''}>Apply username change to @${esc(usernameCheck.detected_username)}</button>`
      : `<button class="button secondary" data-action="check-username" data-username="${esc(p.username)}" ${runDisabled || !hasSavedReel ? 'disabled' : ''}>Check username change</button>`;
  const identityUsername = p.current_username || p.username;
  const currentUsernameNote = p.current_username && p.current_username !== p.username ? `<p>Previous username: @${esc(p.username)}</p>` : `<p>${esc(p.display_name || p.category || 'Instagram profile')}</p>`;
  const profileNeedsReelRefresh = p.profile_header_complete && p.posts_count !== null && !p.reels.grid_complete;
  const reportStatus = p.account_status === 'false_identification' ? 'false_identification' : p.account_status === 'age_restricted' ? 'age_restricted' : p.account_status === 'deleted' ? 'deleted' : p.profile_header_complete && !p.profile_complete && p.run.status === 'complete'
    ? 'counts_pending' : batchResult?.status || p.run.status;
  const reelUrlsSection = reelItems.length ? '' : `<section class="items-section"><div class="section-heading"><div><span class="eyebrow">REEL URLS</span><h2>${number(data.discovery?.reel?.items?.length || 0)} saved links</h2><p>${data.discovery?.reel?.complete ? `Grid finalized ${esc(time(data.discovery.reel.attempted_at))}` : 'Grid scan pending or incomplete'} · ${p.posts_count_observed_at ? `Post count observed ${esc(time(p.posts_count_observed_at))}` : 'Separate post count time not recorded for this snapshot'}</p></div></div><div class="saved-urls">${(data.discovery?.reel?.items || []).map((item, index) => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span>${String(index + 1).padStart(3, '0')}</span><strong>${esc(item.shortcode)}</strong><small>${esc(item.url)} ↗</small></a>`).join('')}</div></section>`;
  return `${errorBanner(state.error)}<div class="breadcrumbs"><a href="/">Collection</a><span>/</span><span>@${esc(p.route_username || p.username)}</span></div>${renderStageStatus(p)}
    <section class="detail-hero"><div class="detail-identity">${p.profile_picture_url ? `<img class="detail-avatar" src="${esc(p.profile_picture_url)}" alt="">` : `<div class="detail-avatar fallback">${esc(p.username[0].toUpperCase())}</div>`}
      <div><span class="eyebrow">PROFILE REPORT</span><h1>@${esc(identityUsername)}</h1>${currentUsernameNote}
        <div class="detail-links">${badge(reportStatus)}<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="${reportHref(p.username)}" target="_blank" rel="noopener noreferrer">HTML report ↗</a></div></div></div>
      <div class="detail-note"><span>LAST SCAN</span><strong>${esc(time(p.run.updated_at || p.profile_fetched_at))}</strong><small>${esc(p.run.phase || 'Awaiting first run')}</small></div></section>
    <div class="detail-actions"><button class="button secondary" data-action="run-profile-stage" data-username="${esc(p.username)}" data-mode="profile_header" ${runDisabled ? 'disabled' : ''}>Rerun profile details</button><button class="button secondary" data-action="run-profile-stage" data-username="${esc(p.username)}" data-mode="reel_grid" ${runDisabled ? 'disabled' : ''}>Rerun reel URLs</button><button class="button secondary" data-action="run-profile-stage" data-username="${esc(p.username)}" data-mode="reel_details" ${runDisabled ? 'disabled' : ''}>Rerun reel details</button><button class="button primary" data-action="run-profile-stage" data-username="${esc(p.username)}" data-mode="depth_first" ${runDisabled ? 'disabled' : ''}>Rerun all</button>${usernameCheckButton}</div>
    <section class="stat-grid detail-stats"><div class="stat"><span>FOLLOWERS</span><strong>${esc(metric(p.followers))}</strong><small>${p.followers?.approximate ? 'Displayed estimate' : 'Exact when available'}</small></div>
      <div class="stat"><span>FOLLOWING</span><strong>${esc(metric(p.following))}</strong><small>Visible profile header</small></div>
      <div class="stat"><span>REELS IN GRID</span><strong>${gridLabel(p.reels, p.run)}</strong><small>${p.reels.grid_complete ? `${p.reels.processed} item details scanned · ${p.reels.review} review` : p.run.status === 'running' && p.run.phase === 'reel discovery' ? 'Grid scan in progress' : esc(p.reels.grid_error)}</small></div>
      <div class="stat"><span>INSTAGRAM POSTS</span><strong>${p.posts_count === null ? 'Error' : number(p.posts_count)}</strong><small>${p.posts_count_error ? esc(p.posts_count_error) : 'Exact profile header count'}</small></div></section>
    <div class="detail-columns"><section class="panel"><span class="eyebrow">ACCOUNT DETAILS</span><h2>About this profile</h2><dl class="details-list">
      <div><dt>Category</dt><dd>${esc(p.category || '—')}</dd></div><div><dt>Based in</dt><dd>${esc(p.country || '—')}</dd></div><div><dt>Joined</dt><dd>${esc(p.date_joined || '—')}</dd></div>
      <div><dt>Former usernames</dt><dd>${esc(data.profile?.former_usernames_count?.raw ?? '—')}</dd></div><div><dt>AI label</dt><dd>${data.profile?.ai_generated_profile ? 'Shown' : 'Not shown'}</dd></div></dl></section>
      <section class="panel"><span class="eyebrow">PROFILE BIO</span><h2>What the account says</h2><p class="bio">${esc(p.bio || 'No bio available.')}</p></section></div>
    ${p.run.error ? `<section class="notice danger"><strong>Collection issue</strong><p>${esc(p.run.error)}</p></section>` : ''}
    ${p.reels.refresh_required ? `<section class="notice soft"><strong>Current username reel grid refresh available</strong><p>The saved reel URLs and older reel details are preserved. Run Reel URLs to discover additions from @${esc(p.current_username || p.username)}; the reel-details stage will skip already complete records.</p></section>` : ''}
    ${usernameMigrationApplied ? `<section class="notice soft"><strong>Username migration applied</strong><p>The saved profile now follows @${esc(p.current_username)}. The previous username and all earlier reel records remain in the migration history.</p></section>` : usernameChangeConfirmed ? `<section class="notice"><strong>Username change detected</strong><p>${esc(usernameCheck.message)} Click “Apply username change” to fetch the current profile, update the record, preserve history, and prepare the current reel grid for a refresh.</p></section>` : usernameCheck?.status === 'no_change' ? `<section class="notice soft"><strong>Username check complete</strong><p>${esc(usernameCheck.message)}</p></section>` : usernameCheck?.status === 'stale_history' ? `<section class="notice soft"><strong>Older username found on the reel</strong><p>${esc(usernameCheck.message)}</p></section>` : usernameJob?.status === 'failed' ? `<section class="notice danger"><strong>Username check failed</strong><p>${esc(usernameJob.error)}</p></section>` : ''}
    ${p.profile_header_complete && !p.profile_complete && p.run.status !== 'running' ? `<section class="notice soft"><strong>${profileNeedsReelRefresh ? 'Profile details complete; reel URLs need refresh' : 'Profile counts unavailable'}</strong><p>${profileNeedsReelRefresh ? 'Run Reel URLs to scan the current username. Existing reel details remain saved.' : 'Use the Profile details or Reel URLs step to retry the missing count.'}</p><ul>${p.posts_count_error ? `<li>Instagram posts: ${esc(p.posts_count_error)}</li>` : ''}${!p.reels.grid_complete ? `<li>Reels: ${esc(p.reels.grid_error)}</li>` : ''}</ul></section>` : ''}
    ${review.length ? `<section class="notice"><div><span class="eyebrow">MANUAL REVIEW</span><h2>${review.length} item${review.length === 1 ? '' : 's'} need attention</h2></div><ul>${review.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.shortcode)} ↗</a><span>${esc(reviewReason(item))}</span></li>`).join('')}</ul></section>` : ''}
    ${data.profile?.issues?.length ? `<section class="notice soft"><strong>Profile source notes</strong><ul>${data.profile.issues.map((issue) => `<li>${esc(issue)}</li>`).join('')}</ul></section>` : ''}
    ${reelUrlsSection}
    <section class="items-section"><div class="section-heading"><div><span class="eyebrow">CONTENT INVENTORY</span><h2>Reels</h2><p>${number(reelItems.length)} saved reels · click an ID to open Instagram.</p></div></div>
      <div class="toolbar"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="item-search" type="search" placeholder="Search reel ID or caption…" value="${esc(state.itemSearch)}" aria-label="Search reels"></div>
        <select id="item-filter" aria-label="Filter reels"><option value="all" ${state.itemFilter !== 'review' ? 'selected' : ''}>All reels</option><option value="review" ${state.itemFilter === 'review' ? 'selected' : ''}>Needs review</option></select>
        <select id="item-sort" aria-label="Sort content"><option value="newest" ${state.itemSort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${state.itemSort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="views" ${state.itemSort === 'views' ? 'selected' : ''}>Most views</option><option value="likes" ${state.itemSort === 'likes' ? 'selected' : ''}>Most likes</option></select></div>
      <div class="table-wrap"><table><thead><tr><th>REEL</th><th>DATE</th><th>LIKES</th><th>COMMENTS</th><th>VIEWS</th><th>STATUS</th><th>CAPTION</th></tr></thead><tbody>
      ${rows.map((item) => `<tr class="${reviewReason(item) ? 'row-review' : ''}"><td><div class="content-cell">${reelCoverUrl(item) ? `<img src="${esc(reelCoverUrl(item))}" data-cover-fallback="${esc(item.thumbnail_url || '')}" alt="Cover image for reel ${esc(item.shortcode)}" loading="lazy"><div class="thumb-fallback" hidden>REEL</div>` : '<div class="thumb-fallback">REEL</div>'}<span><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.shortcode)} ↗</a><small>${esc(item.kind)}</small></span></div></td>
        <td>${esc(item.date || '—')}${item.date_precision === 'day' ? '<small class="cell-note">Day only</small>' : ''}</td><td>${esc(metric(item.likes))}</td><td>${esc(metric(item.comments))}</td><td><strong>${esc(metric(item.views))}</strong></td><td>${badge(item.status)}${reviewReason(item) ? `<small class="cell-note review-note">${esc(reviewReason(item))}</small>` : ''}</td><td class="caption" title="${esc(item.caption || '')}">${esc((item.caption || '—').slice(0, 120))}</td></tr>`).join('')}
      </tbody></table></div>${!rows.length ? '<div class="empty-state"><strong>No content matches this filter.</strong></div>' : ''}</section>`;
}
