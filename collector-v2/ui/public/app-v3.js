import { api, esc } from './shared.js';
import { steps, visibleCatalog, renderSelect, renderStage, renderReview, renderUsernameReview, renderFailedReels, batchStrip } from './flow.js';
import { renderProfile } from './profile-v3.js';
import { renderOverview } from './overview.js';

const app = document.querySelector('#app');
const selectionKey = 'dedgram-selected-v2';
const setupKey = 'dedgram-setup-step-v1';
const workflowKey = 'dedgram-workflow-v1';
const saved = (() => { try { return JSON.parse(localStorage.getItem(selectionKey) || '[]'); } catch { return []; } })();
const savedMode = localStorage.getItem('dedgram-mode-v2');
const savedOrder = localStorage.getItem('dedgram-order-v2');
const savedSetup = sessionStorage.getItem(setupKey);
const savedWorkflow = sessionStorage.getItem(workflowKey);
const state = {
  catalog: [], batch: null, batchProfiles: [], detail: null, overview: null, failedReels: null, deletionCheck: null, usernameScan: null, usernameMigration: null,
  selected: new Set(Array.isArray(saved) ? saved : []),
  search: '', filter: 'all', layout: 'grid',
  mode: ['profile_header', 'reel_grid', 'profile_only', 'depth_first', 'breadth_first', 'reels_only'].includes(savedMode) ? savedMode : 'depth_first',
  order: ['selection', 'posts_ascending', 'reels_ascending'].includes(savedOrder) ? savedOrder : 'posts_ascending',
  workflow: savedWorkflow === 'username_migration' ? 'username_migration' : 'collection',
  setupStep: ['profiles', 'mode', 'order', 'review', 'progress'].includes(savedSetup) ? savedSetup : 'profiles',
  itemSearch: '', itemFilter: 'all', itemSort: 'newest', failedReelProfile: 'all', failedReelIssueType: 'all', failedReelSort: 'newest', busy: false, error: null, readOnly: false, popup: null, confirmation: null
};
const observed = { batchId: null, batchStatus: null, usernameJobs: new Map(), usernameScan: null, usernameMigration: null };
const sound = { context: null };
const path = () => location.pathname === '/summary' ? '/overview' : location.pathname;
const saveSelection = () => localStorage.setItem(selectionKey, JSON.stringify([...state.selected]));
const setupSteps = ['profiles', 'mode', 'order', 'review', 'progress'];
function playNotificationSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    sound.context ||= new AudioContext();
    const context = sound.context;
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = type === 'error' ? 220 : type === 'success' ? 880 : 660;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch { /* Audio is optional; the visual popup remains the source of truth. */ }
}

function notify(message, type = 'info') {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  state.popup = { id, message, type };
  playNotificationSound(type);
  render();
}

function popupMarkup() {
  if (!state.popup) return '';
  const title = state.popup.type === 'success' ? 'TASK COMPLETE' : state.popup.type === 'error' ? 'TASK ERROR' : 'TASK IN PROGRESS';
  return `<div class="dos-popup-layer" data-popup-kind="notification" role="presentation"><section class="dos-popup ${state.popup.type}" role="alertdialog" aria-modal="true" aria-label="${title}"><div class="dos-popup-title">[ ${title} ]</div><p class="dos-popup-message">${esc(state.popup.message)}</p><button class="dos-popup-ok" data-action="dismiss-popup">OK</button></section></div>`;
}

function confirmationMarkup() {
  const confirmation = state.confirmation;
  if (!confirmation) return '';
  return `<div class="dos-popup-layer confirmation-layer" data-popup-kind="confirmation" role="presentation"><section class="dos-popup confirmation-popup" role="alertdialog" aria-modal="true" aria-labelledby="deletion-confirmation-title" aria-describedby="deletion-confirmation-message"><div class="dos-popup-title" id="deletion-confirmation-title">[ CLEAR PREVIOUS CHECK ]</div><p class="dos-popup-message" id="deletion-confirmation-message">A previous deletion check for ${esc(confirmation.issueType)} is complete (${esc(confirmation.completed)}). Clear its details from the UI before changing filters?</p><div class="dos-popup-actions"><button class="dos-popup-ok" data-action="confirm-deletion-filter-change">Clear and change filters</button><button class="dos-popup-cancel" data-action="cancel-deletion-filter-change">Keep current filter</button></div></section></div>`;
}

function syncPopup() {
  const existing = document.querySelector('[data-popup-kind="notification"]');
  if (!state.popup) {
    existing?.remove();
    return;
  }
  const title = state.popup.type === 'success' ? 'TASK COMPLETE' : state.popup.type === 'error' ? 'TASK ERROR' : 'TASK IN PROGRESS';
  if (!existing) {
    document.body.insertAdjacentHTML('beforeend', popupMarkup());
    return;
  }
  const dialog = existing.querySelector('.dos-popup');
  dialog.className = `dos-popup ${state.popup.type}`;
  dialog.setAttribute('aria-label', title);
  existing.querySelector('.dos-popup-title').textContent = `[ ${title} ]`;
  existing.querySelector('.dos-popup-message').textContent = state.popup.message;
}

function syncConfirmation() {
  const existing = document.querySelector('[data-popup-kind="confirmation"]');
  if (!state.confirmation) {
    existing?.remove();
    return;
  }
  if (!existing) {
    document.body.insertAdjacentHTML('beforeend', confirmationMarkup());
    return;
  }
  const message = `A previous deletion check for ${state.confirmation.issueType} is complete (${state.confirmation.completed}). Clear its details from the UI before changing filters?`;
  existing.querySelector('.dos-popup-message').textContent = message;
}

function observeAsyncState() {
  const batch = state.batch;
  if (batch?.id) {
    if (observed.batchId !== batch.id) {
      observed.batchId = batch.id;
      observed.batchStatus = batch.status;
    } else if (observed.batchStatus === 'running' && batch.status !== 'running') {
      const label = batch.status === 'complete' ? 'Collection complete.' : batch.status === 'failed'
        ? `Collection failed${batch.error ? `: ${batch.error}` : '.'}` : `Collection ${batch.status}.`;
      notify(label, batch.status === 'complete' ? 'success' : batch.status === 'failed' ? 'error' : 'info');
      observed.batchStatus = batch.status;
    } else observed.batchStatus = batch.status;
  }
  const scan = state.usernameScan;
  if (scan?.started_at) {
    if (!observed.usernameScan) observed.usernameScan = scan.status;
    else if (observed.usernameScan === 'running' && scan.status !== 'running') {
      notify(scan.status === 'complete' ? `Global username check complete: ${scan.changed || 0} change${scan.changed === 1 ? '' : 's'} flagged.` : `Global username check failed${scan.error ? `: ${scan.error}` : '.'}`, scan.status === 'complete' ? 'success' : 'error');
      observed.usernameScan = scan.status;
    } else observed.usernameScan = scan.status;
  }
  const migration = state.usernameMigration;
  if (migration?.started_at) {
    if (!observed.usernameMigration) observed.usernameMigration = migration.status;
    else if (observed.usernameMigration === 'running' && migration.status !== 'running') {
      const failed = migration.profiles?.filter((profile) => profile.status === 'failed').length || 0;
      notify(migration.status === 'complete' ? `Username migration complete for ${migration.completed} profile${migration.completed === 1 ? '' : 's'}.` : `Username migration finished with ${failed} profile${failed === 1 ? '' : 's'} needing review.`, migration.status === 'complete' ? 'success' : 'error');
      observed.usernameMigration = migration.status;
    } else observed.usernameMigration = migration.status;
  }
  const profile = state.detail;
  const job = profile?.username_job;
  if (profile?.username && job?.started_at) {
    const key = `${job.kind}:${job.started_at}`;
    const previous = observed.usernameJobs.get(key);
    if (!previous) observed.usernameJobs.set(key, job.status);
    else if (previous === 'running' && job.status !== 'running') {
      const result = job.result || {};
      if (job.status === 'failed') notify(`${job.kind === 'apply' ? 'Username migration' : 'Username check'} failed${job.error ? `: ${job.error}` : '.'}`, 'error', 10000);
      else if (job.kind === 'check' && result.status === 'no_change') notify(`No username change found. The reel still shows @${result.stored_username}.`, 'success');
      else if (job.kind === 'check' && result.status === 'changed') notify(`Username change detected: @${result.stored_username} → @${result.detected_username}.`, 'success', 10000);
      else if (job.kind === 'apply') notify(`Username migration complete: @${result.previous_username} → @${result.current_username}.`, 'success', 10000);
      else notify('Username task finished.', 'success');
      observed.usernameJobs.set(key, job.status);
    }
  }
}
function setSetupStep(step) {
  state.setupStep = step;
  sessionStorage.setItem(setupKey, step);
  render();
  window.scrollTo(0, 0);
}

function render() {
  const focusId = document.activeElement?.id;
  let cursor = null;
  try { cursor = document.activeElement?.selectionStart; } catch {}
  const current = path();
  const step = steps.findIndex((item) => item.path === current);
  document.querySelectorAll('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === (current === '/overview' ? 'overview' : 'collection')));
  const content = current === '/overview' ? renderOverview(state)
    : (current === '/failed-reels' || current === '/failed-reels/') ? renderFailedReels(state)
    : current.startsWith('/profiles/') ? `${batchStrip(state)}${renderProfile(state)}`
      : step === 0 ? renderSelect(state) : step === 4 ? (state.workflow === 'username_migration' ? renderUsernameReview(state) : renderReview(state))
        : step > 0 ? renderStage(state, step) : '<p class="loading">Page not found.</p>';
  app.innerHTML = `${state.readOnly ? '<div class="preview-banner">PREVIEW · Collection actions are disabled while the original batch runs.</div>' : ''}${state.error ? `<div class="error-banner" role="alert"><strong>Something needs attention.</strong> ${esc(state.error)} <button data-action="dismiss" aria-label="Dismiss">×</button></div>` : ''}${content}`;
  app.querySelectorAll('img[data-avatar-fallback]').forEach((image) => {
    image.addEventListener('error', () => {
      const local = image.dataset.avatarLocal;
      if (local && !image.dataset.avatarLocalTried) { image.dataset.avatarLocalTried = '1'; image.src = local; return; }
      const fallback = document.createElement('span');
      fallback.className = `${image.className} fallback`.trim();
      fallback.textContent = image.dataset.avatarFallback || '?';
      image.replaceWith(fallback);
    });
  });
  app.querySelectorAll('img[data-cover-fallback]').forEach((image) => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.coverFallback;
      if (fallback && !image.dataset.fallbackTried) { image.dataset.fallbackTried = '1'; image.src = fallback; return; }
      image.hidden = true;
      image.nextElementSibling?.removeAttribute('hidden');
    });
  });
  syncPopup();
  syncConfirmation();
  if (focusId) {
    const input = document.getElementById(focusId);
    if (input) { input.focus(); if (typeof cursor === 'number' && typeof input.setSelectionRange === 'function') input.setSelectionRange(cursor, cursor); }
  }
}

function renderAfterRefresh() {
  // Replacing the DOM while a native select menu is open closes that menu.
  // Keep the current controls alive until the user finishes choosing an option.
  if (document.activeElement?.tagName === 'SELECT') return;
  render();
}

function confirmDeletionCheckFilterChange(nextIssueType, nextProfile) {
  const job = state.deletionCheck;
  if (!job || job.status === 'running') return true;
  const sameSelection = job.issue_type === (nextIssueType || 'all') && job.profile === (nextProfile || 'all');
  if (sameSelection) return true;
  const label = job.issue_type || 'the previous issue type';
  const completed = `${job.completed || 0} / ${job.total || 0}`;
  state.confirmation = { issueType: label, completed, nextIssueType: nextIssueType || 'all', nextProfile: nextProfile || 'all' };
  render();
  return false;
}

async function refresh() {
  const current = path();
  const calls = [
    api('/api/health').then((result) => { state.readOnly = Boolean(result.read_only); }),
    api('/api/run').then(({ batch, profiles }) => { state.batch = batch; state.batchProfiles = profiles; }),
    api('/api/catalog').then(({ profiles }) => {
      state.catalog = profiles;
      const valid = new Set(profiles.map((profile) => profile.username));
      for (const name of state.selected) if (!valid.has(name)) state.selected.delete(name);
      saveSelection();
    }),
    api('/api/username-scan').then((result) => { state.usernameScan = result; }),
    api('/api/username-migration').then((result) => { state.usernameMigration = result; })
  ];
  if (current === '/overview') calls.push(api('/api/summary').then((result) => { state.overview = result; }));
  if (current === '/failed-reels' || current === '/failed-reels/') {
    calls.push(api('/api/failed-reels').then(({ reels }) => { state.failedReels = reels; }));
    calls.push(api('/api/deletion-check').then((result) => { state.deletionCheck = result; }));
  }
  if (current.startsWith('/profiles/')) calls.push(api(`/api/profiles/${encodeURIComponent(decodeURIComponent(current.slice('/profiles/'.length)))}`).then((result) => { state.detail = result; }));
  await Promise.all(calls);
  if (!sessionStorage.getItem(setupKey) && state.batch?.status === 'running') {
    state.setupStep = 'progress';
    sessionStorage.setItem(setupKey, 'progress');
  }
  if (!state.selected.size && ['mode', 'order', 'review'].includes(state.setupStep)) {
    state.setupStep = 'profiles';
    sessionStorage.setItem(setupKey, 'profiles');
  }
  observeAsyncState();
  renderAfterRefresh();
}

document.addEventListener('input', (event) => {
  if (event.target.id === 'catalog-search') { state.search = event.target.value; render(); }
  if (event.target.id === 'item-search') { state.itemSearch = event.target.value; render(); }
});
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.name === 'run-mode') { state.mode = target.value; localStorage.setItem('dedgram-mode-v2', state.mode); render(); return; }
  if (target.id === 'run-order') { state.order = target.value; localStorage.setItem('dedgram-order-v2', state.order); render(); return; }
  if (target.dataset.select) { target.checked ? state.selected.add(target.dataset.select) : state.selected.delete(target.dataset.select); saveSelection(); render(); }
  if (target.id === 'catalog-filter') { state.filter = target.value; render(); }
  if (target.id === 'item-filter') { state.itemFilter = target.value; render(); }
  if (target.id === 'item-sort') { state.itemSort = target.value; render(); }
  if (target.id === 'failed-reel-profile') {
    if (!confirmDeletionCheckFilterChange(state.failedReelIssueType, target.value)) return;
    state.failedReelProfile = target.value; render();
  }
  if (target.id === 'failed-reel-sort') { state.failedReelSort = target.value; render(); }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'dismiss') { state.error = null; render(); return; }
  if (action === 'dismiss-popup') { state.popup = null; render(); return; }
  if (action === 'confirm-deletion-filter-change') {
    const pending = state.confirmation;
    if (pending) {
      state.deletionCheck = null;
      state.failedReelIssueType = pending.nextIssueType;
      state.failedReelProfile = pending.nextProfile;
    }
    state.confirmation = null;
    render();
    return;
  }
  if (action === 'cancel-deletion-filter-change') { state.confirmation = null; render(); return; }
  if (action === 'open-reel-private') {
    try {
      await api('/api/open-reel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: button.dataset.url }) });
      notify('Opened the reel in a new Firefox private window.', 'success');
    } catch (error) { state.error = error.message; render(); }
    return;
  }
  if (action === 'filter-failed-issue') {
    const nextIssueType = button.dataset.issueType || 'all';
    if (!confirmDeletionCheckFilterChange(nextIssueType, state.failedReelProfile)) return;
    state.failedReelIssueType = nextIssueType; render(); return;
  }
  if (action === 'reset-failed-reel-filters') {
    if (!confirmDeletionCheckFilterChange('all', state.failedReelProfile)) return;
    state.failedReelIssueType = 'all'; render(); return;
  }
  if (action === 'start-failed-reel-deletion-check') {
    state.busy = true; state.error = null;
    notify('Deletion check started. Each selected reel will be opened one at a time in a fresh private context.');
    try {
      const accepted = await api('/api/deletion-check', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_type: button.dataset.issueType, profile: state.failedReelProfile }) });
      state.deletionCheck = accepted;
      await refresh();
    } catch (error) { state.error = error.message; }
    finally { state.busy = false; render(); }
    return;
  }
  if (action === 'setup-progress' && state.batch) { setSetupStep('progress'); return; }
  if (action === 'setup-new') { state.workflow = 'collection'; sessionStorage.setItem(workflowKey, 'collection'); setSetupStep('profiles'); return; }
  if (action === 'scan-usernames') {
    state.busy = true; state.error = null; notify('Global username check started. It will only label and record evidence.'); render();
    try { await api('/api/username-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); await refresh(); }
    catch (error) { state.error = error.message; }
    finally { state.busy = false; render(); }
    return;
  }
  if (action === 'begin-username-migration') {
    const flagged = state.catalog.filter((profile) => state.selected.has(profile.username) && profile.username_check?.status === 'changed');
    if (!flagged.length) { notify('Select profiles from the Username change flagged filter first.', 'error'); return; }
    state.workflow = 'username_migration';
    state.mode = 'depth_first';
    sessionStorage.setItem(workflowKey, 'username_migration');
    localStorage.setItem('dedgram-mode-v2', state.mode);
    setSetupStep('mode');
    return;
  }
  if (action === 'setup-step' && setupSteps.includes(button.dataset.step)) { setSetupStep(button.dataset.step); return; }
  if (action === 'setup-back') { setSetupStep(setupSteps[Math.max(0, setupSteps.indexOf(state.setupStep) - 1)]); return; }
  if (action === 'setup-next') {
    if (!state.selected.size) return;
    if (state.workflow === 'username_migration' && !state.catalog.some((profile) => state.selected.has(profile.username) && profile.username_check?.status === 'changed')) return;
    if (state.setupStep === 'mode' && state.mode === 'reels_only'
      && state.catalog.some((profile) => state.selected.has(profile.username) && !profile.profile_complete)) return;
    if (state.setupStep === 'mode' && state.mode === 'reel_grid'
      && state.catalog.some((profile) => state.selected.has(profile.username)
        && (!profile.profile_header_complete || profile.posts_count === null || profile.posts_count === undefined))) return;
    setSetupStep(setupSteps[Math.min(3, setupSteps.indexOf(state.setupStep) + 1)]);
    return;
  }
  if (action === 'grid' || action === 'list') { state.layout = action; render(); return; }
  if (action === 'clear') { state.selected.clear(); saveSelection(); render(); return; }
  if (action === 'select-visible') { for (const profile of visibleCatalog(state)) state.selected.add(profile.username); saveSelection(); render(); return; }
  if (!['run-stage', 'run-filtered-stage', 'start', 'run-one', 'run-profile-stage', 'stop', 'check-username', 'apply-username-change'].includes(action)) return;
  state.busy = true; state.error = null; render();
  if (action === 'check-username') notify('Username check started. Opening a saved reel...');
  if (action === 'apply-username-change') notify('Username migration started. Fetching the current profile and preserving history...');
  if (action === 'stop') notify('Stop requested. The current stage will finish first.');
  if (action === 'start' && state.workflow === 'username_migration') notify('Username migration started. Each confirmed rename is preserved and applied one profile at a time.');
  else if (action === 'start' || action === 'run-one' || action === 'run-filtered-stage' || action === 'run-profile-stage') notify('Collection started. Live progress is shown on this page.');
  try {
    const usernameAction = action === 'check-username' || action === 'apply-username-change';
    const migrationAction = action === 'start' && state.workflow === 'username_migration';
    const endpoint = action === 'stop' ? '/api/runs/stop' : action === 'check-username' ? '/api/username-check'
      : action === 'apply-username-change' ? '/api/username-change/apply' : migrationAction ? '/api/username-change/bulk' : '/api/runs';
    const profileAction = action === 'run-profile-stage';
    const filteredStageAction = action === 'run-filtered-stage';
    const body = action === 'stop' ? {} : usernameAction ? { username: button.dataset.username, detected_username: button.dataset.detectedUsername }
      : migrationAction ? { profiles: state.catalog.filter((profile) => state.selected.has(profile.username) && profile.username_check?.status === 'changed')
        .map((profile) => ({ username: profile.username, detected_username: profile.username_check.detected_username })), mode: state.mode, order: state.order }
      : { profiles: action === 'run-one' || profileAction ? [button.dataset.username]
      : filteredStageAction ? visibleCatalog(state).map((profile) => profile.username) : [...state.selected],
      mode: action === 'run-one' ? 'depth_first' : action === 'start' || filteredStageAction ? (filteredStageAction ? button.dataset.mode : state.mode) : button.dataset.mode,
      order: state.order };
    const accepted = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (usernameAction && accepted?.started_at) observed.usernameJobs.set(`${accepted.kind}:${accepted.started_at}`, 'running');
    if (action === 'start' || action === 'run-one' || filteredStageAction) {
      state.setupStep = 'progress';
      sessionStorage.setItem(setupKey, 'progress');
      window.scrollTo(0, 0);
    }
    await refresh();
  } catch (error) { state.error = error.message; }
  finally { state.busy = false; render(); }
});

refresh().catch((error) => { state.error = error.message; renderAfterRefresh(); });
setInterval(() => { if (document.visibilityState !== 'hidden') refresh().catch((error) => { state.error = error.message; renderAfterRefresh(); }); }, 3000);
