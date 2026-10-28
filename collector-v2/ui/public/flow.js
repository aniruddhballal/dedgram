import { badge, esc, gridLabel, number, profileHref, progress, statusText, time } from './shared.js';
import { filteredCatalog, filterOptions, stageModeForFilter, usernameChangeFlagged } from './queue.js';

export const steps = [
  { path: '/', label: 'Choose profiles', short: 'Select', number: '01' },
  { path: '/collect/profiles', label: 'Profile details', short: 'Profiles', number: '02', mode: 'profile_header', stage: 'profile_header', action: 'Collect profile details', description: 'Read each account header and About this account. Save the exact post count and the time it was observed.' },
  { path: '/collect/reel-urls', label: 'Reel URLs', short: 'Reel URLs', number: '03', mode: 'reel_grid', stage: 'reel_grid', action: 'Discover reel URLs', description: 'Scan each reel grid to the end. Save every reel URL, the final count, and when the scan finished.' },
  { path: '/collect/reel-details', label: 'Reel details', short: 'Details', number: '04', mode: 'reel_details', stage: 'reels', action: 'Collect reel details', description: 'Visit the saved reel URLs to collect dates, captions, views, likes, and comments.' },
  { path: '/collection/review', label: 'Review results', short: 'Review', number: '05' }
];

const selected = (state) => state.catalog.filter((profile) => state.selected.has(profile.username));
const date = (value) => value ? time(value) : 'Time not recorded';
const count = (value) => value == null ? '—' : number(value);
const running = (state) => state.batch?.status === 'running';
const terminalStatus = (value) => ['complete', 'needs_review', 'failed', 'skipped'].includes(value);
const usernameMigration = (state) => state.workflow === 'username_migration';
const flaggedSelected = (state) => selected(state).filter((profile) => usernameChangeFlagged(profile));
const profileDetailsReady = (profile) => Boolean(profile?.profile_header_complete && profile?.posts_count !== null && profile?.posts_count !== undefined);
const stageLabel = (stage) => ({
  profile: 'Profile details',
  profile_header: 'Profile details',
  reel_grid: 'Reel URLs + count',
  reels: 'Reel details'
}[stage] || String(stage || 'collecting').replaceAll('_', ' '));
const friendlyProgressMarkup = (markup) => markup
  .replaceAll('profile_header', stageLabel('profile_header'))
  .replaceAll('Profile Header', stageLabel('profile_header'))
  .replaceAll('profile header', stageLabel('profile_header'))
  .replaceAll('reel_grid', 'Reel URLs + count')
  .replaceAll('reel grid', stageLabel('reel_grid'));

function stageDone(batch, step) {
  return terminalStatus(batch.results?.[step.username]?.stages?.[step.stage]?.status);
}

function knownScrapes(profile, step, batch) {
  if (step.stage !== 'reels') return 1;
  const discovered = profile?.reels?.discovered;
  if (discovered == null) return null;
  return batch.mode === 'reel_details' ? discovered : Math.max(0, discovered - (profile.reels.complete || 0) - (profile.reels.resolved || 0));
}

function workAfterCurrent(state, currentProfile) {
  const batch = state.batch;
  if (!batch?.steps?.length) return { stages: 0, scrapes: 0, unknown: false };
  const pending = batch.steps.filter((step) => !stageDone(batch, step));
  const after = pending.filter((step) => !(step.username === batch.current && step.stage === batch.current_stage));
  let scrapes = currentProfile?.run?.progress?.remaining ?? 0;
  let unknown = currentProfile?.run?.progress?.remaining == null;
  for (const step of after) {
    const profile = state.batchProfiles.find((item) => item.username === step.username);
    const amount = knownScrapes(profile, step, batch);
    if (amount == null) unknown = true;
    else scrapes += amount;
  }
  return { stages: after.length, scrapes, unknown };
}

function elapsed(startedAt) {
  if (!startedAt) return 'Elapsed time unavailable';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} elapsed`;
}

function liveTitle(progress) {
  if (progress?.task === 'reel_grid') return `${number(progress.completed)} reel URLs found so far`;
  if (progress?.task === 'profile') return 'Reading profile fields and exact post count';
  if (progress?.task === 'item_details') return `Reel ${progress.current_item?.index || progress.completed} of ${progress.total || '?'} details`;
  return progress?.label || 'Collection in progress';
}

export function stepNav(index) {
  return `<nav class="step-nav" aria-label="Collection steps">${steps.map((step, i) => `<a href="${step.path}" class="${i === index ? 'active' : ''}" ${i === index ? 'aria-current="step"' : ''}><span>${step.number}</span>${step.short}</a>`).join('')}</nav>`;
}

function hero(index, title, description, countText = '') {
  return `<section class="flow-hero"><div><span class="eyebrow"><span class="brand-word">dedgram</span> / COLLECTION ${steps[index].number}</span><h1>${title}</h1><p>${esc(description)}</p></div><strong>${esc(countText || steps[index].number)}</strong></section>`;
}

function legacyBatchStrip(state) {
  const batch = state.batch;
  if (!batch) return '';
  const active = running(state);
  const done = batch.steps?.filter((step) => ['complete', 'needs_review', 'failed', 'skipped'].includes(batch.results?.[step.username]?.stages?.[step.stage]?.status)).length || 0;
  return `<section class="flow-batch ${active ? 'active' : ''}" aria-live="polite"><div><span class="eyebrow">${active ? 'COLLECTION RUNNING' : 'LATEST RUN'}</span><strong>${active ? `@${esc(batch.current || 'preparing')} · ${esc(batch.current_stage?.replaceAll('_', ' ') || 'preparing')}` : esc(statusText(batch.status))}</strong><small>${active ? `${number(done)} / ${number(batch.steps?.length || 0)} stages finished` : `${esc(batch.mode?.replaceAll('_', ' ') || 'collection')} · ${esc(date(batch.finished_at || batch.updated_at))}`}</small></div>${active && !state.readOnly ? `<button class="button secondary" data-action="stop" ${batch.stop_requested || state.busy ? 'disabled' : ''}>${batch.stop_requested ? 'Stopping after this stage' : 'Stop after this stage'}</button>` : ''}</section>`;
}

function legacyDetailedBatchStrip(state) {
  const batch = state.batch;
  if (!batch) return '';
  const active = running(state);
  const done = batch.steps?.filter((step) => stageDone(batch, step)).length || 0;
  const current = state.batchProfiles.find((profile) => profile.username === batch.current);
  const detailCurrent = state.detail?.username === batch.current ? { ...current, run: state.detail.run, reels: current?.reels || state.detail.summary?.reels } : current;
  const live = active ? detailCurrent?.run?.progress : null;
  const after = active ? workAfterCurrent(state, detailCurrent) : null;
  const percent = live?.percent == null ? 'Progress calculating' : `${live.percent}%`;
  const currentItem = live?.current_item ? `Reel ${live.current_item.index} of ${live.current_item.total} · ${live.current_item.shortcode || live.current_item.url}` : '';
  const afterText = after ? `${after.stages} stage${after.stages === 1 ? '' : 's'} after this${after.unknown ? ' · scrape total pending' : ` · ${after.scrapes} scrape${after.scrapes === 1 ? '' : 's'} after this`}` : '';
  const liveDetails = live ? `<div class="live-progress"><div class="live-progress-heading"><strong>${esc(live.action || live.label || 'Collecting')}</strong><span>${percent}</span></div><div class="live-track ${live.percent == null ? 'indeterminate' : ''}"><span style="width:${live.percent == null ? 35 : live.percent}%"></span></div><small>${esc([live.detail, currentItem, live.remaining != null ? `${live.remaining} scrape${live.remaining === 1 ? '' : 's'} left in this stage` : 'Total becomes known when this scan finishes', afterText].filter(Boolean).join(' · '))}</small></div>` : '';
  return `<section class="flow-batch ${active ? 'active' : ''}" aria-live="polite"><div><span class="eyebrow">${active ? 'COLLECTION RUNNING' : 'LATEST RUN'}</span><strong>${active ? `@${esc(batch.current || 'preparing')} · ${esc(batch.current_stage?.replaceAll('_', ' ') || 'preparing')}` : esc(statusText(batch.status))}</strong><small>${active ? `${number(done)} / ${number(batch.steps?.length || 0)} stages finished` : `${esc(batch.mode?.replaceAll('_', ' ') || 'collection')} · ${esc(date(batch.finished_at || batch.updated_at))}`}</small>${liveDetails}</div>${active && !state.readOnly ? `<button class="button secondary" data-action="stop" ${batch.stop_requested || state.busy ? 'disabled' : ''}>${batch.stop_requested ? 'Stopping after this stage' : 'Stop after this stage'}</button>` : ''}</section>`;
}

function enhancedBatchStrip(state) {
  const batch = state.batch;
  if (!batch) return '';
  const active = running(state);
  const done = batch.steps?.filter((step) => stageDone(batch, step)).length || 0;
  const current = state.batchProfiles.find((profile) => profile.username === batch.current);
  const detailCurrent = state.detail?.username === batch.current ? { ...current, run: state.detail.run, reels: current?.reels || state.detail.summary?.reels } : current;
  const live = active ? detailCurrent?.run?.progress : null;
  const after = active ? workAfterCurrent(state, detailCurrent) : null;
  const progressLabel = live?.task === 'reel_grid' && live.percent == null ? 'Live count' : live?.percent == null ? 'Progress calculating' : `${live.percent}%`;
  const currentItem = live?.current_item ? `Reel ${live.current_item.index} of ${live.current_item.total} / ${live.current_item.shortcode || live.current_item.url}` : '';
  const afterText = after ? after.stages === 0 ? 'No later stages' : `${after.stages} stage${after.stages === 1 ? '' : 's'} after this${after.unknown ? ' / scrape total pending' : ` / ${after.scrapes} scrape${after.scrapes === 1 ? '' : 's'} after this`}` : '';
  const liveDetails = live ? `<div class="live-progress"><div class="live-progress-heading"><strong>${esc(liveTitle(live))}</strong><span>${progressLabel}</span></div><div class="live-track ${live.percent == null ? 'indeterminate' : ''}"><span style="width:${live.percent == null ? 35 : live.percent}%"></span></div><small>${esc([live.action, live.detail, currentItem, elapsed(detailCurrent?.run?.started_at), live.remaining != null ? `${live.remaining} scrape${live.remaining === 1 ? '' : 's'} left in this stage` : 'Final total is determined when the grid scan finishes', afterText].filter(Boolean).join(' / '))}</small></div>` : '';
  const activeSummary = live ? `${esc(live.label || 'Current task')} / ${elapsed(detailCurrent?.run?.started_at)}` : `${number(done)} / ${number(batch.steps?.length || 0)} stages finished`;
  return `<section class="flow-batch ${active ? 'active' : ''}" aria-live="polite"><div><span class="eyebrow">${active ? 'COLLECTION RUNNING' : 'LATEST RUN'}</span><strong>${active ? `@${esc(batch.current || 'preparing')} / ${esc(batch.current_stage?.replaceAll('_', ' ') || 'preparing')}` : esc(statusText(batch.status))}</strong><small>${active ? activeSummary : `${esc(batch.mode?.replaceAll('_', ' ') || 'collection')} / ${esc(date(batch.finished_at || batch.updated_at))}`}</small>${liveDetails}</div>${active && !state.readOnly ? `<button class="button secondary" data-action="stop" ${batch.stop_requested || state.busy ? 'disabled' : ''}>${batch.stop_requested ? 'Stopping after this stage' : 'Stop after this stage'}</button>` : ''}</section>`;
}

export function batchStrip(state) {
  return friendlyProgressMarkup(enhancedBatchStrip(state));
}

export function visibleCatalog(state) {
  return filteredCatalog(state);
}

const modeOptions = [
  ['profile_header', 'Profile details only', 'Collect account fields and the exact Instagram post count. Skip reel URLs and reel count discovery.'],
  ['reel_grid', 'Reel URLs + count only', 'Use saved profile details, then discover and save every reel URL and finalize the reel count.'],
  ['profile_only', 'Profile + reel count', 'Collect account fields, the exact Instagram post count, and the reel grid count. Individual reel details wait.'],
  ['depth_first', 'Profile + reels, depth first', 'Finish each account before moving to the next.'],
  ['breadth_first', 'Profile + reels, breadth first', "Collect every profile first, then every account's reels."],
  ['reels_only', 'Reel details only', 'Use saved profile details and reel counts; collect or retry individual reels.']
];

function strategy(state) {
  const unavailable = selected(state).filter((profile) => !profile.profile_complete);
  return `<section class="strategy-section"><p class="strategy-intro"><span class="eyebrow">COLLECTION STRATEGY</span>Each stage saves its result, so you can run reels later.</p>
    <div class="strategy-options">${modeOptions.map(([mode, title, description]) => `<label class="strategy-option ${state.mode === mode ? 'chosen' : ''}"><input type="radio" name="run-mode" value="${mode}" ${state.mode === mode ? 'checked' : ''}><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span></label>`).join('')}</div>
    ${state.mode === 'reels_only' && unavailable.length ? `<p class="flow-warning">Finish profile details and reel counts first for ${unavailable.length} selected account${unavailable.length === 1 ? '' : 's'}.</p>` : ''}
  </section>`;
}

function orderControl(state) {
  return `<label class="flow-order">Run order <select id="run-order" aria-label="Profile run order"><option value="posts_ascending" ${state.order === 'posts_ascending' ? 'selected' : ''}>Fewest posts first</option><option value="reels_ascending" ${state.order === 'reels_ascending' ? 'selected' : ''}>Fewest reels first</option><option value="selection" ${state.order === 'selection' ? 'selected' : ''}>Selection order</option></select></label>`;
}

function runPanel(state) {
  const batch = state.batch;
  if (!batch) return `<section class="run-panel"><span class="eyebrow">RUN STATUS</span><h2>Ready when you are.</h2><p>Select profiles below, then start collection. Progress appears here as each stage finishes.</p></section>`;
  const steps = batch.steps || batch.profiles.map((username) => ({ username, stage: 'reels' }));
  const done = (step) => ['complete', 'needs_review', 'failed', 'skipped'].includes(batch.results?.[step.username]?.stages?.[step.stage]?.status || batch.results?.[step.username]?.status);
  const finished = batch.profiles.filter((name) => batch.results?.[name]?.stages
    ? Object.values(batch.results[name].stages).every((stage) => ['complete', 'needs_review', 'failed', 'skipped'].includes(stage.status))
    : ['complete', 'needs_review', 'failed', 'skipped'].includes(batch.results?.[name]?.status)).length;
  const complete = batch.profiles.filter((name) => batch.results?.[name]?.status === 'complete'
    && (batch.mode === 'profile_header' ? state.batchProfiles.find((profile) => profile.username === name)?.profile_header_complete
      : batch.mode !== 'profile_only' || state.batchProfiles.find((profile) => profile.username === name)?.profile_complete)).length;
  const profileSteps = steps.filter((step) => ['profile', 'profile_header'].includes(step.stage));
  const reelSteps = steps.filter((step) => ['reel_grid', 'reels'].includes(step.stage));
  const current = state.batchProfiles.find((profile) => profile.username === batch.current);
  const active = running(state);
  return `<section class="run-panel"><div class="run-panel-top"><div><span class="eyebrow">${active ? 'COLLECTION IN PROGRESS' : 'LATEST COLLECTION RUN'} / ${esc(batch.mode?.replaceAll('_', ' ') || 'collection')}</span>
    <h2>${active ? `@${esc(batch.current || 'Preparing next stage')}` : esc(statusText(batch.status))}</h2><p>${active ? `${esc(current?.run?.phase || batch.current_stage || 'Preparing collection')}${current?.run?.current_url ? ` / ${esc(current.run.current_url.split('/').filter(Boolean).at(-1))}` : ''}` : `Started ${esc(date(batch.started_at))}`}</p></div>
    ${active && !state.readOnly ? `<button class="button secondary" data-action="stop" ${batch.stop_requested || state.busy ? 'disabled' : ''}>${batch.stop_requested ? 'Stopping after this stage' : 'Stop after current stage'}</button>` : ''}</div>
    <div class="run-counts"><div><strong>${finished}<small> / ${batch.profiles.length}</small></strong><span>PROFILES FINISHED</span></div><div><strong>${complete}</strong><span>FULLY COMPLETE</span></div>${profileSteps.length ? `<div><strong>${profileSteps.filter(done).length}<small> / ${profileSteps.length}</small></strong><span>PROFILE STAGES DONE</span></div>` : ''}${reelSteps.length ? `<div><strong>${reelSteps.filter(done).length}<small> / ${reelSteps.length}</small></strong><span>REEL STAGES DONE</span></div>` : ''}</div>
    ${progress(steps.filter(done).length, steps.length)}
    ${current ? `<p class="run-current">@${esc(current.username)} / ${esc(batch.current_stage || 'collecting')} · Profile ${current.profile_complete ? 'ready' : 'collecting or review'} · Reel grid ${gridLabel(current.reels, current.run)} · Instagram posts ${current.posts_count === null ? 'Error' : number(current.posts_count)}</p>` : ''}
    <div class="run-accounts">${batch.profiles.map((name) => { const profile = state.batchProfiles.find((item) => item.username === name); const stages = batch.results?.[name]?.stages || {}; return `<div><a href="${profileHref(name)}">@${esc(name)}</a><span>${Object.entries(stages).map(([stage, info]) => `${esc(stage.replaceAll('_', ' '))} ${badge(info.status)}`).join(' ')}</span><small>${profile ? `Posts ${profile.posts_count === null ? 'Error' : number(profile.posts_count)} / reel grid ${gridLabel(profile.reels, profile.run)}` : 'Waiting'}</small></div>`; }).join('')}</div>
    ${batch.logs?.length ? `<details class="run-log"><summary>Recent activity</summary><pre>${esc(batch.logs.slice(-18).join('\n'))}</pre></details>` : ''}</section>`;
}

const setupSteps = [
  ['profiles', 'Profiles'], ['mode', 'Collection mode'], ['order', 'Run order'], ['review', 'Review & start'], ['progress', 'Progress']
];

function setupHeader(state, title, description, actions = '') {
  const index = setupSteps.findIndex(([key]) => key === state.setupStep);
  const migration = usernameMigration(state);
  const labels = migration ? ['Profiles', 'Migration mode', 'Run order', 'Review & start', 'Progress'] : setupSteps.map(([, label]) => label);
  return `<header class="setup-header"><div><span class="eyebrow"><span class="brand-word">dedgram</span> / NEW COLLECTION</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions || (state.batch && state.setupStep !== 'progress' ? `<button class="setup-latest" data-action="setup-progress">View latest run →</button>` : '')}</header>
    <ol class="setup-steps" aria-label="${migration ? 'Username migration setup' : 'Collection setup'}">${setupSteps.map(([key], i) => `<li class="${i === index ? 'active' : i < index ? 'done' : ''}" ${i === index ? 'aria-current="step"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${esc(labels[i])}</li>`).join('')}</ol>`;
}

function setupActions(back, next, nextDisabled = false, extra = '') {
  return `<div class="setup-actions">${back ? `<button class="button secondary" data-action="setup-back">← Back</button>` : '<span></span>'}<span>${extra}</span>${next ? `<button class="button primary" data-action="setup-next" ${nextDisabled ? 'disabled' : ''}>${esc(next)} →</button>` : ''}</div>`;
}

function modeStep(state) {
  if (usernameMigration(state)) return usernameModeStep(state);
  const unavailable = selected(state).filter((profile) => !profile.profile_complete);
  const missingProfileDetails = selected(state).filter((profile) => !profileDetailsReady(profile));
  const blocked = (state.mode === 'reels_only' && unavailable.length) || (state.mode === 'reel_grid' && missingProfileDetails.length);
  const strategyWarning = state.mode === 'reel_grid' && missingProfileDetails.length
    ? `<p class="flow-warning">Finish Profile details only first for ${missingProfileDetails.length} selected account${missingProfileDetails.length === 1 ? '' : 's'}.</p>` : '';
  return `${setupHeader(state, 'Choose what to collect', 'Choose one collection strategy for the selected accounts.')}${strategy(state)}
    ${strategyWarning}${setupActions(true, 'Choose run order', !state.selected.size || blocked, `${number(state.selected.size)} profile${state.selected.size === 1 ? '' : 's'} selected`)}`;
}

const migrationModes = [
  ['depth_first', 'Profile by profile', 'Finish the complete username migration for one account before moving to the next.'],
  ['breadth_first', 'Queued migration', 'Queue every selected account in order; each account is still migrated atomically.']
];

function usernameModeStep(state) {
  const profiles = flaggedSelected(state);
  return `${setupHeader(state, 'Choose migration mode', 'Choose how the flagged username changes should be applied.')}
    <section class="setup-choice"><span class="eyebrow">MIGRATION MODE</span><div class="mode-grid">${migrationModes.map(([mode, title, description]) => `<label class="mode-option ${state.mode === mode ? 'chosen' : ''}"><input type="radio" name="run-mode" value="${mode}" ${state.mode === mode ? 'checked' : ''}><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span></label>`).join('')}</div></section>
    ${setupActions(true, 'Choose run order', !profiles.length, `${number(profiles.length)} flagged profile${profiles.length === 1 ? '' : 's'} selected`)}`;
}

function orderStep(state) {
  if (usernameMigration(state)) return usernameOrderStep(state);
  return `${setupHeader(state, 'Choose run order', 'Choose how the selected accounts will be queued.')}
    <section class="setup-choice"><span class="eyebrow">RUN ORDER</span>${orderControl(state)}
      <p>Fewest posts first uses saved exact post counts. Fewest reels first uses saved finalized reel grid counts. Profiles without the chosen count run last. Selection order follows the order you selected accounts.</p></section>
    ${setupActions(true, 'Review collection', !state.selected.size, `${number(state.selected.size)} profile${state.selected.size === 1 ? '' : 's'} · ${esc(modeOptions.find(([mode]) => mode === state.mode)?.[1] || state.mode)}`)}`;
}

function usernameOrderStep(state) {
  const profiles = flaggedSelected(state);
  return `${setupHeader(state, 'Choose run order', 'Choose the order for the flagged username migrations.')}
    <section class="setup-choice"><span class="eyebrow">RUN ORDER</span>${orderControl(state)}
      <p>Fewest posts first uses saved post counts. Fewest reels first uses saved reel counts. Selection order follows the accounts you selected.</p></section>
    ${setupActions(true, 'Review migration', !profiles.length, `${number(profiles.length)} flagged profile${profiles.length === 1 ? '' : 's'} · ${esc(state.mode === 'depth_first' ? 'Profile by profile' : 'Queued migration')}`)}`;
}

function reviewStep(state) {
  if (usernameMigration(state)) return usernameReviewStep(state);
  const profiles = selected(state);
  const unavailable = profiles.filter((profile) => !profile.profile_complete);
  const missingProfileDetails = profiles.filter((profile) => !profileDetailsReady(profile));
  const canRun = profiles.length && !running(state) && !state.busy && !state.readOnly
    && (state.mode !== 'reels_only' || !unavailable.length) && (state.mode !== 'reel_grid' || !missingProfileDetails.length);
  const mode = modeOptions.find(([value]) => value === state.mode)?.[1] || state.mode;
  const order = state.order === 'posts_ascending' ? 'Fewest posts first' : state.order === 'reels_ascending' ? 'Fewest reels first' : 'Selection order';
  return `${setupHeader(state, 'Review and start', 'Check your choices before starting collection.')}
    <section class="setup-review"><div><span class="eyebrow">PROFILES</span><strong>${number(profiles.length)} selected</strong><p>${profiles.slice(0, 7).map((profile) => `@${esc(profile.username)}`).join(', ')}${profiles.length > 7 ? `, and ${profiles.length - 7} more` : ''}</p><button data-action="setup-step" data-step="profiles">Edit profiles</button></div>
      <div><span class="eyebrow">COLLECTION MODE</span><strong>${esc(mode)}</strong><p>${esc(modeOptions.find(([value]) => value === state.mode)?.[2] || '')}</p><button data-action="setup-step" data-step="mode">Edit mode</button></div>
      <div><span class="eyebrow">RUN ORDER</span><strong>${esc(order)}</strong><p>${state.order === 'posts_ascending' ? 'Saved exact post counts determine order.' : state.order === 'reels_ascending' ? 'Saved finalized reel counts determine order.' : 'Accounts run in the order selected.'}</p><button data-action="setup-step" data-step="order">Edit order</button></div></section>
    ${state.mode === 'reels_only' && unavailable.length ? `<p class="flow-warning">${unavailable.length} selected account${unavailable.length === 1 ? '' : 's'} still need profile details and reel counts before a reels-only run.</p>` : ''}${state.mode === 'reel_grid' && missingProfileDetails.length ? `<p class="flow-warning">${missingProfileDetails.length} selected account${missingProfileDetails.length === 1 ? '' : 's'} still need Profile details only before reel URL discovery can run.</p>` : ''}
    <div class="setup-actions"><button class="button secondary" data-action="setup-back">← Back</button><a class="button secondary ${profiles.length ? '' : 'disabled'}" href="/collect/profiles">Collect step by step →</a><button class="button primary" data-action="start" ${canRun ? '' : 'disabled'}>${state.busy ? 'Starting…' : `Run ${number(profiles.length)} selected →`}</button></div>`;
}

function usernameReviewStep(state) {
  const profiles = flaggedSelected(state);
  const canRun = profiles.length && !state.busy && !state.readOnly && state.usernameMigration?.status !== 'running';
  const order = state.order === 'posts_ascending' ? 'Fewest posts first' : state.order === 'reels_ascending' ? 'Fewest reels first' : 'Selection order';
  const mode = state.mode === 'depth_first' ? 'Profile by profile' : 'Queued migration';
  return `${setupHeader(state, 'Review and start', 'Check the old and detected usernames before changing any stored records.')}
    <section class="setup-review"><div><span class="eyebrow">PROFILES</span><strong>${number(profiles.length)} selected</strong><p>${profiles.slice(0, 7).map((profile) => `@${esc(profile.username)} → @${esc(profile.username_check.detected_username)}`).join(', ')}${profiles.length > 7 ? `, and ${profiles.length - 7} more` : ''}</p><button data-action="setup-step" data-step="profiles">Edit profiles</button></div>
      <div><span class="eyebrow">MIGRATION MODE</span><strong>${esc(mode)}</strong><p>Each migration preserves the old record, folder, URLs, and public snapshot history.</p><button data-action="setup-step" data-step="mode">Edit mode</button></div>
      <div><span class="eyebrow">RUN ORDER</span><strong>${esc(order)}</strong><p>The migration engine applies one account at a time.</p><button data-action="setup-step" data-step="order">Edit order</button></div></section>
    <section class="username-migration-list">${profiles.map((profile) => `<div><strong>@${esc(profile.username)}</strong><span>→</span><strong>@${esc(profile.username_check.detected_username)}</strong><small>Confirmed ${esc(date(profile.username_check.checked_at))}</small></div>`).join('')}</section>
    <div class="setup-actions"><button class="button secondary" data-action="setup-back">← Back</button><button class="button primary" data-action="start" ${canRun ? '' : 'disabled'}>${state.busy ? 'Starting…' : `Start migration for ${number(profiles.length)} →`}</button></div>`;
}

function progressStep(state) {
  if (usernameMigration(state)) return usernameMigrationProgress(state);
  const actions = '<div class="setup-header-actions"><button class="button secondary" data-action="setup-new">New collection</button><a class="button secondary" href="/collection/review">View saved results →</a></div>';
  return `${setupHeader(state, 'Collection progress', 'Follow the current run and inspect its saved results.', actions)}
    ${friendlyProgressMarkup(runPanel(state))}`;
}

function usernameMigrationProgress(state) {
  const job = state.usernameMigration;
  const active = job?.status === 'running';
  const done = job?.completed || 0;
  const total = job?.profiles?.length || 0;
  const current = job?.profiles?.find((profile) => profile.username === job.current);
  const actions = '<div class="setup-header-actions"><button class="button secondary" data-action="setup-new">New collection</button></div>';
  return `${setupHeader(state, 'Username migration progress', 'Follow each confirmed username change as the local and public records are updated.', actions)}
    <section class="run-panel"><div class="run-panel-top"><div><span class="eyebrow">${active ? 'USERNAME MIGRATION RUNNING' : 'LATEST USERNAME MIGRATION'}</span><h2>${active ? `@${esc(job.current || 'Preparing')}` : esc(job?.status || 'No migration run')}</h2><p>${active ? esc(current?.detail || current?.phase || 'Preparing migration') : `${number(done)} of ${number(total)} migrations finished`}</p></div></div>
      <div class="run-counts"><div><strong>${number(done)}<small> / ${number(total)}</small></strong><span>PROFILES FINISHED</span></div><div><strong>${number(job?.profiles?.filter((profile) => profile.status === 'complete').length || 0)}</strong><span>MIGRATED</span></div><div><strong>${number(job?.profiles?.filter((profile) => profile.status === 'failed').length || 0)}</strong><span>NEEDS REVIEW</span></div></div>
      ${progress(done, total)}
      <div class="run-accounts">${(job?.profiles || []).map((profile) => `<div><span><strong>@${esc(profile.username)}</strong> → <strong>@${esc(profile.detected_username)}</strong></span><span>${badge(profile.status)}</span><small>${esc(profile.error || profile.detail || 'Queued')}</small></div>`).join('')}</div>
    </section>`;
}

function usernameScanPanel(state) {
  const scan = state.usernameScan;
  const active = scan?.status === 'running';
  const flagged = state.catalog.filter((profile) => usernameChangeFlagged(profile)).length;
  const selectedFlagged = flaggedSelected(state).length;
  return `<section class="username-workflow-panel"><div><span class="eyebrow">USERNAME WORKFLOW</span><h2>Find renamed accounts without changing anything</h2><p>Run a global check to label accounts whose saved reel now shows a different username. This check only records evidence; it does not rename folders or refetch profiles.</p>${scan ? `<p class="username-scan-status">${active ? `Checking ${number(scan.completed)} of ${number(scan.total)}${scan.current ? ` · @${esc(scan.current)}` : ''}` : `Last check: ${number(scan.changed || 0)} change${scan.changed === 1 ? '' : 's'} flagged · ${number(scan.no_change || 0)} unchanged · ${number(scan.skipped || 0)} skipped — no saved reel URL · ${number(scan.failed || 0)} failed`}</p>` : ''}<p class="username-scan-note">Profiles without a saved reel URL are skipped because there is no current reel poster username to compare. Run Reel URLs first for those profiles.</p></div><div class="username-workflow-actions"><button class="button secondary" data-action="scan-usernames" ${active || state.busy || state.readOnly ? 'disabled' : ''}>${active ? 'Checking usernames…' : 'Run global username check'}</button><button class="button primary" data-action="begin-username-migration" ${!selectedFlagged || state.busy || state.readOnly ? 'disabled' : ''}>Review ${number(selectedFlagged)} flagged for migration</button></div></section>`;
}

export function renderUsernameReview(state) {
  return usernameReviewStep(state);
}

export function renderSelect(state) {
  if (state.setupStep === 'mode') return modeStep(state);
  if (state.setupStep === 'order') return orderStep(state);
  if (state.setupStep === 'review') return reviewStep(state);
  if (state.setupStep === 'progress') return progressStep(state);
  const visible = visibleCatalog(state);
  const filteredStageMode = stageModeForFilter(state.filter);
  const filteredStageLabel = state.filter === 'profile_missing' ? 'profile details' : state.filter === 'reel_count_missing' ? 'reel URLs / count' : 'reel details';
  const canRunFilteredStage = filteredStageMode && visible.length && !running(state) && !state.busy && !state.readOnly;
  const landingActions = `<div class="setup-header-actions"><button class="button primary" data-action="setup-new">New collection</button>${state.batch ? '<button class="button secondary" data-action="setup-progress">View latest run →</button>' : ''}</div>`;
  return `${setupHeader(state, 'Choose profiles', 'Find and select the accounts you want to collect.', landingActions)}
    ${usernameScanPanel(state)}
    <section class="flow-head"><div><span class="eyebrow">PROFILE CATALOG</span><h2>Pick a collection set</h2><p>Filter by the next missing stage, then run that stage or select the set for a combined depth-first or breadth-first run.</p></div><div class="flow-actions">${filteredStageMode ? `<button class="button primary" data-action="run-filtered-stage" data-mode="${filteredStageMode}" ${canRunFilteredStage ? '' : 'disabled'}>Run visible ${filteredStageLabel} (${number(visible.length)})</button>` : ''}<button class="button secondary" data-action="select-visible">Select visible</button><button class="button secondary" data-action="clear">Clear</button></div></section>
    <div class="setup-dock"><span><strong>${number(state.selected.size)}</strong> selected</span><button class="button primary" data-action="setup-next" ${state.selected.size ? '' : 'disabled'}>Continue to mode →</button></div>
     <div class="flow-filters"><label>SEARCH PROFILES<input id="catalog-search" type="search" placeholder="Username, country, category, bio" value="${esc(state.search)}"></label><label>SHOW<select id="catalog-filter" aria-label="Filter profiles">${filterOptions(state)}</select></label><div class="flow-layout" role="group" aria-label="Profile layout"><button data-action="grid" class="${state.layout === 'grid' ? 'current' : ''}" aria-label="Grid view" aria-pressed="${state.layout === 'grid'}">▦</button><button data-action="list" class="${state.layout === 'list' ? 'current' : ''}" aria-label="List view" aria-pressed="${state.layout === 'list'}">☰</button></div></div>
    <div class="flow-list-title"><span>SHOWING ${number(visible.length)} OF ${number(state.catalog.length)} PROFILES</span><span>${number(state.selected.size)} SELECTED</span></div>
    <div class="flow-profile-list ${state.layout === 'list' ? 'list-layout' : ''}">${visible.map((profile) => {
      const checked = state.selected.has(profile.username);
      const status = profile.account_status === 'false_identification' ? 'false_identification' : profile.account_status === 'age_restricted' ? 'age_restricted' : profile.account_status === 'deleted' ? 'deleted' : profile.profile_header_complete && !profile.profile_complete && profile.run.status === 'complete' ? 'counts_pending' : profile.run.status;
      const localAvatar = profile.profile_picture_local_url || `/avatars/${encodeURIComponent(profile.username)}.jpg`;
      const avatar = profile.profile_picture_url
        ? `<img src="${esc(profile.profile_picture_url)}" data-avatar-local="${esc(localAvatar)}" data-avatar-fallback="${esc(profile.username[0].toUpperCase())}" alt="" loading="lazy">`
        : `<img src="${esc(localAvatar)}" data-avatar-fallback="${esc(profile.username[0].toUpperCase())}" alt="" loading="lazy">`;
      return `<article class="flow-profile-card ${checked ? 'selected' : ''}"><div class="card-top"><label><input type="checkbox" data-select="${esc(profile.username)}" ${checked ? 'checked' : ''} aria-label="Select ${esc(profile.username)}"><span>Select</span></label>${badge(status)}</div><div class="card-identity">${avatar}<div><a href="${profileHref(profile.username)}">@${esc(profile.username)}</a><small>${esc(profile.display_name || profile.category || profile.country || 'Instagram profile')}</small></div></div><div class="card-facts"><span>Profile: <strong>${profile.profile_complete ? 'Ready' : profile.profile_header_complete ? 'Counts pending' : profile.profile_fetched_at ? 'Needs review' : 'Not collected'}</strong></span><span>Items scanned: <strong>${number(profile.reels.processed + profile.posts.processed)}</strong></span>${profile.reels.review ? `<span>Reels for review: <strong>${number(profile.reels.review)}</strong></span>` : ''}</div><div class="card-metrics"><div title="${esc(profile.reels.grid_error || '')}"><strong>${profile.profile_fetched_at ? gridLabel(profile.reels, profile.run) : 'Not collected'}</strong><small>REEL GRID COUNT</small></div><div title="${esc(profile.posts_count_error || '')}"><strong>${profile.posts_count === null ? profile.profile_fetched_at ? 'Error' : 'Not collected' : number(profile.posts_count)}</strong><small>INSTAGRAM POSTS</small></div></div>${profile.reels.grid_complete ? progress(profile.reels.processed, profile.reels.discovered) : ''}<div class="card-bottom"><small>${profile.profile_fetched_at ? `Updated ${esc(date(profile.run.updated_at || profile.profile_fetched_at))}` : 'Ready to collect'}</small><span><button data-action="run-one" data-username="${esc(profile.username)}" ${running(state) || state.busy || state.readOnly ? 'disabled' : ''}>Run profile + reels</button><a href="${profileHref(profile.username)}">View profile →</a></span></div></article>`;
    }).join('')}</div>${visible.length ? '' : '<p class="flow-empty">No profiles match this view. Try another search or filter.</p>'}`;
}

function stageInfo(profile, stage) {
  if (stage === 'profile_header') return { value: count(profile.posts_count), unit: 'EXACT POSTS', timestamp: profile.posts_count_observed_at, ready: profile.profile_header_complete && profile.posts_count !== null, issue: profile.posts_count_error };
  if (stage === 'reel_grid') return { value: count(profile.reels.discovered), unit: 'REEL URLS', timestamp: profile.reels.grid_complete ? profile.reels.attempted_at : null, ready: profile.reels.grid_complete, issue: profile.reels.grid_error };
  return { value: `${number(profile.reels.processed)} / ${count(profile.reels.discovered)}`, unit: 'REELS VISITED', timestamp: profile.run.updated_at, ready: profile.reels.grid_complete && profile.reels.processed >= profile.reels.discovered && profile.reels.review === 0, issue: profile.reels.review ? `${profile.reels.review} need review` : null };
}

export function renderStage(state, index) {
  const step = steps[index];
  const profiles = selected(state);
  const missing = step.stage === 'reel_grid' ? profiles.filter((p) => !p.profile_header_complete || p.posts_count === null)
    : step.stage === 'reels' ? profiles.filter((p) => !p.profile_complete) : [];
  const ready = profiles.length && !missing.length && !running(state) && !state.busy && !state.readOnly;
  const allDone = profiles.length && profiles.every((p) => stageInfo(p, step.stage).ready);
  return `${hero(index, `${step.label}<br><em>${index === 1 ? '& post count.' : index === 2 ? '& count.' : '& metrics.'}</em>`, step.description)}
    ${stepNav(index)}${batchStrip(state)}
    <section class="flow-head"><div><span class="eyebrow">STEP ${step.number} / ${number(profiles.length)} SELECTED</span><h2>${esc(step.label)}</h2><p>This screen saves only its own stage of collection.</p></div><div class="flow-actions"><a class="button secondary" href="${steps[index - 1].path}">← Back</a><button class="button primary" data-action="run-stage" data-mode="${step.mode}" ${ready ? '' : 'disabled'}>${running(state) && state.batch?.mode === step.mode ? 'Collecting…' : allDone ? `Run ${esc(step.label)} again` : step.action}</button></div></section>
    ${orderControl(state)}
    ${!profiles.length ? '<p class="flow-warning">Choose profiles on the first screen before starting a stage.</p>' : ''}
    ${missing.length ? `<p class="flow-warning">Finish the previous step for ${number(missing.length)} account${missing.length === 1 ? '' : 's'} first: ${missing.slice(0, 6).map((p) => `@${esc(p.username)}`).join(', ')}${missing.length > 6 ? '…' : ''}.</p>` : ''}
    <div class="scope-strip">${index === 1 ? '<div><span>PROFILE</span><strong>Name, bio, location, followers</strong></div><div><span>POSTS</span><strong>Exact header count</strong></div><div><span>TIME</span><strong>When observed</strong></div>' : index === 2 ? '<div><span>DISCOVERY</span><strong>Every reel URL</strong></div><div><span>COUNT</span><strong>Final saved URL count</strong></div><div><span>TIME</span><strong>When grid scan finished</strong></div>' : '<div><span>DETAILS</span><strong>Date, caption, hashtags</strong></div><div><span>METRICS</span><strong>Views, likes, comments</strong></div><div><span>REVIEW</span><strong>Missing or unreadable values</strong></div>'}</div>
    <div class="flow-table"><div class="flow-table-head"><span>ACCOUNT</span><span>${index === 1 ? 'POST COUNT' : index === 2 ? 'REEL URLS' : 'REEL DETAILS'}</span><span>OBSERVED</span><span>STATUS</span></div>${profiles.map((p, i) => {
      const info = stageInfo(p, step.stage);
      const runStatus = state.batch?.results?.[p.username]?.stages?.[step.stage]?.status;
      return `<div class="flow-table-row"><span class="account"><small>${String(i + 1).padStart(2, '0')}</small><a href="${profileHref(p.username)}">@${esc(p.username)}</a></span><span class="value"><strong>${esc(info.value)}</strong><small>${info.unit}</small></span><span class="when">${esc(date(info.timestamp))}</span><span>${badge(runStatus || (info.ready ? 'complete' : 'queued'))}${!info.ready && info.issue ? `<small class="issue">${esc(info.issue)}</small>` : ''}</span></div>`;
    }).join('')}</div>
    <div class="flow-next"><span>${allDone ? 'Saved results are ready for the next step.' : running(state) ? 'Collection is running. Results update here automatically.' : 'Return to this screen to retry or refresh its data.'}</span><a class="button ${allDone ? 'primary' : 'secondary'}" href="${steps[index + 1].path}">Next: ${esc(steps[index + 1].label)} →</a></div>`;
}

export function renderReview(state) {
  const profiles = selected(state);
  const total = profiles.reduce((sum, p) => sum + (p.reels.discovered || 0), 0);
  const processed = profiles.reduce((sum, p) => sum + p.reels.processed, 0);
  return `${hero(4, 'Review your<br>collection.', 'Check the saved counts and open an account to inspect its reel records.')}${stepNav(4)}${batchStrip(state)}
    <div class="flow-stats"><div><span>SELECTED PROFILES</span><strong>${number(profiles.length)}</strong></div><div><span>REEL URLS SAVED</span><strong>${number(total)}</strong></div><div><span>REELS VISITED</span><strong>${number(processed)}</strong></div></div>
    <section class="flow-head"><div><span class="eyebrow">RESULTS BY ACCOUNT</span><h2>Collection records</h2></div><div class="flow-actions"><a class="button secondary" href="/collect/reel-details">← Reel details</a><a class="button primary" href="/overview">Open overview →</a></div></section>
    <div class="flow-table"><div class="flow-table-head"><span>ACCOUNT</span><span>EXACT POSTS</span><span>REEL URLS</span><span>REELS VISITED</span></div>${profiles.map((p) => `<div class="flow-table-row"><span class="account"><a href="${profileHref(p.username)}">@${esc(p.username)} ↗</a></span><span class="value"><strong>${count(p.posts_count)}</strong><small>${esc(date(p.posts_count_observed_at))}</small></span><span class="value"><strong>${count(p.reels.discovered)}</strong><small>${esc(p.reels.grid_complete ? date(p.reels.attempted_at) : 'Not finalized')}</small></span><span class="value"><strong>${number(p.reels.processed)}</strong><small>${number(p.reels.review)} need review</small></span></div>`).join('')}</div>${profiles.length ? '' : '<p class="flow-empty">No profiles selected. <a href="/">Choose profiles</a> to review a collection.</p>'}`;
}
