export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
export const number = (value) => Number(value || 0).toLocaleString();
export const gridLabel = (grid, run = {}) => {
  if (grid.grid_complete) return number(grid.discovered);
  if (run.status === 'running' && run.phase === 'reel discovery') return 'Counting';
  return grid.grid_error === 'Grid has not been scanned.' ? 'Not scanned' : 'Error';
};
export const compact = (value) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
export const time = (value) => value ? new Date(value).toLocaleString() : 'Not yet';
export const metric = (value) => value?.source === 'others_plus_one'
  ? number(value.value) : value?.raw ?? (value?.value == null ? '—' : number(value.value));
export const profileHref = (name, currentUsername) => `/profiles/${encodeURIComponent(currentUsername || name)}`;
export const reportHref = (name) => `/reports/${encodeURIComponent(name)}`;
export const statusText = (value) => ({ not_started: 'Not collected', running: 'Running', complete: 'Complete',
  needs_review: 'Needs review', partial: 'Needs review', queued: 'Queued', failed: 'Failed', blocked: 'Blocked', deleted: 'Deleted or username changed', archived: 'Deleted / archived', age_restricted: 'Age restricted (25+)', false_identification: 'False identification',
  interrupted: 'Interrupted', stopped: 'Stopped', skipped: 'Skipped', counts_pending: 'Counts pending' })[value] || value || 'Not collected';
export const badge = (value) => `<span class="badge ${({ complete: 'good', running: 'active', needs_review: 'warn', partial: 'warn', failed: 'bad', blocked: 'bad', deleted: 'bad', archived: 'bad', age_restricted: 'warn', false_identification: 'bad', interrupted: 'warn', skipped: 'warn', counts_pending: 'warn' })[value] || 'quiet'}">${esc(statusText(value))}</span>`;
export const renderStageStatus = (profile) => {
  const profileDetails = profile.profile_header_complete && profile.posts_count !== null ? 'complete' : profile.profile_fetched_at ? 'needs_review' : 'not_started';
  const reelUrls = profile.reels.grid_complete ? 'complete' : profile.reels.attempted_at ? 'needs_review' : 'not_started';
  const discovered = profile.reels.discovered;
  const resolved = profile.reels.resolved || 0;
  const handled = (profile.reels.complete || 0) + resolved;
  const reelDetails = reelUrls !== 'complete' ? 'not_started' : discovered === 0 || handled >= discovered ? 'complete' : profile.reels.complete ? 'partial' : 'queued';
  const reelDetailsText = discovered == null ? 'Waiting for a completed reel URL scan' : `${number(profile.reels.complete)} fully extracted${resolved ? ` · ${number(resolved)} manually resolved` : ''} of ${number(discovered)} reels`;
  return `<section class="stage-status"><div class="stage-status-head"><div><span class="eyebrow">COLLECTION STATUS</span><h2>${profile.profile_complete ? 'Profile level complete' : 'Profile level incomplete'}</h2><p>${profile.profile_complete ? 'Profile details and reel URLs are complete. Individual reel details can still be collected below.' : 'Profile level completion requires profile details and a completed reel URL scan.'}</p></div>${badge(profile.profile_complete ? 'complete' : 'counts_pending')}</div><div class="stage-status-grid"><div><span>PROFILE DETAILS</span>${badge(profileDetails)}<small>${profileDetails === 'complete' ? 'Header and exact post count saved' : 'Profile header or post count needs attention'}</small></div><div><span>REEL URLS</span>${badge(reelUrls)}<small>${reelUrls === 'complete' ? `${number(discovered)} reel URLs counted` : 'Grid has not finished scanning'}</small></div><div><span>REEL DETAILS</span>${badge(reelDetails)}<small>${esc(reelDetailsText)}</small></div></div></section>`;
};
export const progress = (done, total) => `<div class="track"><span style="width:${total ? Math.min(100, Math.round(done / total * 100)) : 0}%"></span></div>`;
export const errorBanner = (error) => error ? `<div class="error-banner" role="alert"><strong>Something needs attention.</strong> ${esc(error)} <button data-action="dismiss" aria-label="Dismiss">×</button></div>` : '';
export async function api(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
