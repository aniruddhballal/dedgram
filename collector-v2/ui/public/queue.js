import { badge, errorBanner, esc, gridLabel, number, profileHref, progress, statusText, time } from './shared.js';

const resolvedStatuses = new Set(['deleted', 'age_restricted', 'false_identification']);

export function resolvedProfile(profile) {
  return resolvedStatuses.has(profile?.account_status);
}

export function profileDetailsReady(profile) {
  return Boolean(profile?.profile_header_complete && profile?.posts_count !== null && profile?.posts_count !== undefined);
}

export function reelCountReady(profile) {
  return Boolean(profile?.profile_complete);
}

export function reelDetailsComplete(profile) {
  const reels = profile?.reels || {};
  return reelCountReady(profile)
    && reels.grid_complete !== false
    && reels.discovered !== null
    && reels.discovered !== undefined
    && (reels.processed || 0) >= reels.discovered
    && (reels.review || 0) === 0;
}

export function reelsNeedWork(profile) {
  return reelCountReady(profile) && !reelDetailsComplete(profile);
}

export function runFailed(profile) {
  return ['failed', 'blocked'].includes(profile?.run?.status);
}

export function needsReview(profile) {
  return !resolvedProfile(profile) && (runFailed(profile) || (profile?.reels?.review || 0) > 0);
}

export function stageModeForFilter(filter) {
  return { profile_missing: 'profile_header', reel_count_missing: 'reel_grid', reel_count_ready: 'reel_details' }[filter] || null;
}

export function usernameChangeFlagged(profile) {
  return profile?.username_check?.status === 'changed' && Boolean(profile.username_check.detected_username);
}

const filterDefinitions = [
  ['all', 'All profiles', () => true],
  ['profile_missing', 'Profile details missing', (profile) => !resolvedProfile(profile) && !profileDetailsReady(profile)],
  ['reel_count_missing', 'Reel count missing', (profile) => !resolvedProfile(profile) && profileDetailsReady(profile) && !reelCountReady(profile)],
  ['reel_count_ready', 'Reel count ready', (profile) => !resolvedProfile(profile) && reelCountReady(profile) && !reelDetailsComplete(profile)],
  ['reel_details_complete', 'Reel details complete', (profile) => !resolvedProfile(profile) && reelDetailsComplete(profile)],
  ['username_changed', 'Username change flagged', usernameChangeFlagged],
  ['resolved', 'Resolved / no collection needed', (profile) => resolvedProfile(profile)],
  ['review', 'Needs review / failed', (profile) => needsReview(profile)]
];

export function filterOptions(state) {
  return filterDefinitions.map(([value, label, predicate]) => {
    const count = state.catalog.filter(predicate).length;
    return `<option value="${value}" ${state.filter === value ? 'selected' : ''}>${label} (${number(count)})</option>`;
  }).join('');
}

export function filteredCatalog(state) {
  const needle = state.search.trim().toLowerCase();
  return state.catalog.filter((profile) => {
    if (needle && ![profile.username, profile.display_name, profile.country, profile.category, profile.bio]
      .some((value) => String(value || '').toLowerCase().includes(needle))) return false;
    const definition = filterDefinitions.find(([value]) => value === state.filter);
    if (definition) return definition[2](profile);
    return true;
  });
}

function card(profile, selected, running) {
  const status = profile.account_status === 'false_identification' ? 'false_identification' : profile.account_status === 'age_restricted' ? 'age_restricted' : profile.account_status === 'deleted' ? 'deleted' : profile.profile_header_complete && !profile.profile_complete && profile.run.status === 'complete'
    ? 'counts_pending' : profile.run.status;
  return `<article class="profile-card ${selected ? 'selected' : ''}">
    <div class="card-top"><label class="check-label"><input type="checkbox" data-select="${esc(profile.username)}" ${selected ? 'checked' : ''} aria-label="Select ${esc(profile.username)}"><span></span></label>${badge(status)}</div>
    <div class="card-identity">${profile.profile_picture_url ? `<img class="avatar" src="${esc(profile.profile_picture_url)}" alt="" loading="lazy">` : `<div class="avatar fallback">${esc(profile.username[0].toUpperCase())}</div>`}
      <div><a class="profile-name" href="${profileHref(profile.username)}">@${esc(profile.username)}</a><p>${esc(profile.display_name || profile.category || profile.country || 'Profile ready for collection')}</p></div></div>
    <div class="card-levels"><span>Profile: <b>${profile.profile_complete ? 'Ready' : profile.profile_header_complete ? 'Counts pending' : profile.profile_fetched_at ? 'Needs review' : 'Not collected'}</b></span><span>Items scanned: <b>${profile.reels.processed + profile.posts.processed}</b></span>${profile.reels.review ? `<span>Reels for review: <b>${profile.reels.review}</b></span>` : ''}${usernameChangeFlagged(profile) ? `<span>Username: <b>Changed to @${esc(profile.username_check.detected_username)}</b></span>` : ''}</div>
    <div class="card-counts"><div title="${esc(profile.reels.grid_error || '')}"><strong>${profile.profile_fetched_at ? gridLabel(profile.reels, profile.run) : 'Not collected'}</strong><span>REEL GRID COUNT</span></div><div title="${esc(profile.posts_count_error || '')}"><strong>${profile.posts_count === null ? profile.profile_fetched_at ? 'Error' : 'Not collected' : number(profile.posts_count)}</strong><span>INSTAGRAM POSTS</span></div></div>
    ${profile.reels.grid_complete ? progress(profile.reels.processed, profile.reels.discovered) : ''}
    <div class="card-footer"><span>${profile.profile_fetched_at ? `Updated ${esc(time(profile.run.updated_at || profile.profile_fetched_at))}` : 'Ready to collect'}</span><div><button class="text-button" data-action="run-one" data-username="${esc(profile.username)}" ${running ? 'disabled' : ''}>Run profile + reels</button><a href="${profileHref(profile.username)}">View profile</a></div></div>
  </article>`;
}

const isDone = (status) => ['complete', 'needs_review', 'failed', 'skipped'].includes(status);
const modeLabel = { profile_header: 'PROFILE DETAILS ONLY', profile_only: 'PROFILE + REEL COUNT', depth_first: 'DEPTH FIRST', breadth_first: 'BREADTH FIRST', reels_only: 'REEL DETAILS ONLY' };

function batchPanel(state) {
  const batch = state.batch;
  if (!batch) return `<section class="batch-card empty-batch"><div><span class="eyebrow">RUN STATUS</span><h2>Ready when you are.</h2><p>Select profiles below, then start collection. Progress appears here as each stage finishes.</p></div><div class="empty-batch-art">◎</div></section>`;
  const steps = batch.steps || batch.profiles.map((username) => ({ username, stage: 'reels' }));
  const stepDone = (step) => isDone(batch.results[step.username]?.stages?.[step.stage]?.status
    || batch.results[step.username]?.status);
  const finished = batch.profiles.filter((name) => batch.results[name]?.stages
    ? Object.values(batch.results[name].stages).every((stage) => isDone(stage.status))
    : isDone(batch.results[name]?.status)).length;
  const complete = batch.profiles.filter((name) => batch.results[name]?.status === 'complete'
    && (batch.mode === 'profile_header' ? state.batchProfiles.find((profile) => profile.username === name)?.profile_header_complete
      : batch.mode !== 'profile_only' || state.batchProfiles.find((profile) => profile.username === name)?.profile_complete)).length;
  const countsPending = state.batchProfiles.filter((profile) => profile.profile_header_complete && !profile.profile_complete).length;
  const profileSteps = steps.filter((step) => step.stage === 'profile');
  const reelSteps = steps.filter((step) => step.stage === 'reels');
  const current = state.batchProfiles.find((profile) => profile.username === batch.current);
  const active = batch.status === 'running';
  const currentTitle = batch.current ? `${batch.current_stage === 'profile' ? 'Profile details' : 'Reels'}: @${batch.current}` : 'Preparing next stage';
  return `<section class="batch-card">
    <div class="batch-heading"><div><span class="eyebrow">${active ? 'COLLECTION IN PROGRESS' : 'LATEST COLLECTION RUN'} / ${esc(modeLabel[batch.mode] || 'PROFILE + REELS')}</span><h2>${active ? esc(currentTitle) : esc(statusText(batch.status))}</h2>
      <p>${active ? `${esc(current?.run?.phase || 'Preparing collection')}${current?.run?.current_url ? ` / ${esc(current.run.current_url.split('/').filter(Boolean).at(-1))}` : ''}` : `Started ${esc(time(batch.started_at))}`}</p></div>
      ${active ? `<button class="button outline small" data-action="stop" ${batch.stop_requested ? 'disabled' : ''}>${batch.stop_requested ? 'Stopping after this stage' : 'Stop after current stage'}</button>` : ''}</div>
    <div class="batch-counts"><div><strong>${finished}<span> / ${batch.profiles.length}</span></strong><small>PROFILES FINISHED</small></div><div><strong>${complete}</strong><small>FULLY COMPLETE</small></div>${profileSteps.length ? `<div><strong>${profileSteps.filter(stepDone).length}<span> / ${profileSteps.length}</span></strong><small>PROFILE STAGES DONE</small></div>` : ''}${reelSteps.length ? `<div><strong>${reelSteps.filter(stepDone).length}<span> / ${reelSteps.length}</span></strong><small>REEL STAGES DONE</small></div>` : ''}</div>
    ${progress(steps.filter(stepDone).length, steps.length)}
    ${current ? `<div class="current-breakdown"><span>@${esc(current.username)} / ${esc(batch.current_stage || 'collecting')}</span><span>Profile: <b>${current.profile_complete ? 'ready' : 'collecting or review'}</b></span><span>Reel grid: <b>${gridLabel(current.reels, current.run)}</b></span><span>Instagram posts: <b>${current.posts_count === null ? 'Error' : number(current.posts_count)}</b></span></div>` : ''}
    ${!active && batch.mode === 'profile_only' && countsPending ? `<p class="mode-note">${countsPending} selected profile${countsPending === 1 ? '' : 's'} still need a verified post or reel count. Rerun Profile details only to finish them.</p>` : ''}
    <div class="batch-list">${batch.profiles.map((name) => {
      const profile = state.batchProfiles.find((item) => item.username === name);
      const stages = batch.results[name]?.stages;
      const profileStatus = stages?.profile?.status === 'complete' && profile?.profile_header_complete && !profile.profile_complete
        ? 'counts_pending' : stages?.profile?.status;
      return `<div class="batch-row"><a href="${profileHref(name)}">@${esc(name)}</a>${stages ? `<span class="stage-tags">${stages.profile ? `Profile ${badge(profileStatus)}` : ''}${stages.reels ? `Reels ${badge(stages.reels.status)}` : ''}</span>` : badge(batch.results[name]?.status)}<span>${profile ? `Instagram posts ${profile.posts_count === null ? profile.profile_fetched_at ? 'Error' : 'Not collected' : number(profile.posts_count)} / reel grid ${profile.profile_fetched_at ? gridLabel(profile.reels, profile.run) : 'Not collected'}` : 'Waiting'}</span></div>`;
    }).join('')}</div>
    ${batch.logs?.length ? `<details class="run-log"><summary>Recent activity</summary><pre>${esc(batch.logs.slice(-18).join('\n'))}</pre></details>` : ''}
  </section>`;
}

function modeOption(state, value, title, description) {
  return `<label class="mode-option ${state.mode === value ? 'chosen' : ''}"><input type="radio" name="run-mode" value="${value}" ${state.mode === value ? 'checked' : ''}><span><strong>${title}</strong><small>${description}</small></span></label>`;
}

export function renderQueue(state) {
  const visible = filteredCatalog(state);
  const scanned = state.catalog.filter((profile) => !!profile.profile_fetched_at).length;
  const running = state.batch?.status === 'running';
  const selected = state.catalog.filter((profile) => state.selected.has(profile.username));
  const unavailable = selected.filter((profile) => !profile.profile_complete);
  const ready = state.mode !== 'reels_only' || !unavailable.length;
  return `${errorBanner(state.error)}<section class="hero"><div><span class="eyebrow"><span class="mini-dot"></span> PROFILE RESEARCH / V2</span>
    <h1>Choose your profiles.<br><em>Follow every reel.</em></h1><p>Collect account details first or move through the reel workflow in the order you choose.</p>
    <div class="hero-stats"><span><b>${number(state.catalog.length)}</b> in catalog</span><span><b>${number(scanned)}</b> profiles saved</span><span><b>${number(state.selected.size)}</b> selected</span></div></div>
    <div class="hero-orbit"><div class="orbit-center">V2<span>REELS FIRST</span></div><i class="orb one"></i><i class="orb two"></i><i class="orb three"></i></div></section>
    ${batchPanel(state)}
    <section class="mode-section"><div class="section-heading"><div><span class="eyebrow">COLLECTION STRATEGY</span><h2>Choose what to collect</h2><p>Each stage saves its result, so you can run reels later.</p></div></div>
      <div class="mode-grid">${modeOption(state, 'profile_header', 'Profile details only', 'Collect account fields and the exact Instagram post count. Skip reel URLs and reel count discovery.')}
        ${modeOption(state, 'profile_only', 'Profile + reel count', 'Collect account fields, the exact Instagram post count, and the reel grid count. Individual reel details wait.')}
        ${modeOption(state, 'depth_first', 'Profile + reels, depth first', 'Finish each account before moving to the next.')}
        ${modeOption(state, 'breadth_first', 'Profile + reels, breadth first', 'Collect every profile first, then every account\'s reels.')}
        ${modeOption(state, 'reels_only', 'Reel details only', 'Use saved profile details and reel counts; collect or retry individual reels.')}</div>
      <label class="order-control">Run order <select id="run-order" aria-label="Profile run order"><option value="posts_ascending" ${state.order === 'posts_ascending' ? 'selected' : ''}>Fewest posts first</option><option value="reels_ascending" ${state.order === 'reels_ascending' ? 'selected' : ''}>Fewest reels first</option><option value="selection" ${state.order === 'selection' ? 'selected' : ''}>Selection order</option></select></label>
      <p class="mode-note">Fewest posts first uses saved exact post counts; profiles without one run last. Individual post details will be added later.${state.mode === 'reels_only' && unavailable.length ? ` First finish profile details and reel counts for ${unavailable.length} selected account${unavailable.length === 1 ? '' : 's'}.` : ''}</p></section>
    <section class="catalog-section"><div class="section-heading"><div><span class="eyebrow">PROFILE CATALOG</span><h2>Pick a collection set</h2><p>Accounts come from the existing bot profile index.</p></div>
      <div class="selection-actions"><button class="button subtle" data-action="select-visible">Select visible</button><button class="button subtle" data-action="clear">Clear</button>
        <button class="button primary" data-action="start" ${!state.selected.size || !ready || running || state.busy ? 'disabled' : ''}>${state.busy ? 'Starting...' : `Run ${state.selected.size ? `${state.selected.size} selected` : 'selection'}`}</button></div></div>
      <div class="toolbar"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="catalog-search" type="search" placeholder="Search username, country, category..." value="${esc(state.search)}" aria-label="Search profiles"></div>
        <select id="catalog-filter" aria-label="Filter profiles">${filterOptions(state)}</select>
        <div class="layout-toggle"><button data-action="grid" class="${state.layout === 'grid' ? 'current' : ''}" aria-label="Grid view">▦</button><button data-action="list" class="${state.layout === 'list' ? 'current' : ''}" aria-label="List view">☰</button></div></div>
      <div class="catalog-meta">Showing ${number(visible.length)} of ${number(state.catalog.length)} profiles</div>
      ${visible.length ? `<div class="profile-grid ${state.layout === 'list' ? 'list-layout' : ''}">${visible.map((profile) => card(profile, state.selected.has(profile.username), running || state.busy)).join('')}</div>` : `<div class="empty-state"><strong>No profiles match that view.</strong><p>Try another search or filter.</p></div>`}</section>`;
}
