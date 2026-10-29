import { join } from 'node:path';
import { chromium } from 'playwright';
import { now } from './model.mjs';
import { paths, readJson, writeJson, writeSnapshot } from './store.mjs';
import { writeReport } from './report.mjs';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const operation = 'automated reel availability check';

async function profileFiles(root, username) {
  const pathSet = paths(root, username);
  const [profile, discovery, items, run] = await Promise.all([
    readJson(pathSet.profile), readJson(pathSet.discovery, {}), readJson(pathSet.items, []), readJson(pathSet.run, {})
  ]);
  return { pathSet, profile, discovery, items, run };
}

function classifyPage(pageUrl, statusCode, text) {
  const lower = String(text || '').toLowerCase();
  if (statusCode === 404 || /sorry, this page isn't available|page may have been removed|this page is unavailable/.test(lower)) {
    return { status: 'deleted', reason: 'Instagram reported this reel page as unavailable.' };
  }
  if (/\/accounts\/login|\/challenge\//.test(pageUrl)
    || /please wait a few minutes|try again later|challenge_required|checkpoint_required|log in to continue|log in to see/.test(lower)) {
    return { status: 'check_failed', reason: 'Instagram showed a login, checkpoint, or temporary-limit page.' };
  }
  if (!String(text || '').trim()) return { status: 'check_failed', reason: 'The reel page rendered no readable content.' };
  return { status: 'exists', reason: 'The reel page opened without Instagram\'s unavailable-page message.' };
}

async function checkOne(browser, item) {
  const checkedAt = now();
  const context = await browser.newContext({ viewport: { width: 1320, height: 950 }, locale: 'en-US', timezoneId: 'Asia/Kolkata' });
  const page = await context.newPage();
  try {
    const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1_400);
    const pageUrl = page.url();
    const text = await page.locator('body').innerText().catch(() => '');
    const classification = classifyPage(pageUrl, response?.status() || null, text);
    return {
      ...classification,
      checked_at: checkedAt,
      page_url: pageUrl,
      source: 'fresh_incognito_context',
      evidence: text.slice(0, 800)
    };
  } catch (error) {
    return {
      status: 'check_failed',
      reason: `The reel could not be checked: ${error instanceof Error ? error.message : String(error)}`,
      checked_at: checkedAt,
      page_url: page.url(),
      source: 'fresh_incognito_context',
      evidence: ''
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function handled(item) {
  return (item.status === 'complete' && !item.last_error)
    || (['archived', 'age_restricted'].includes(item.status) && !item.last_error);
}

function applyResult(item, result) {
  const next = {
    ...item,
    deletion_check: result
  };
  if (result.status === 'deleted') {
    next.status = 'archived';
    next.last_error = null;
    next.missing = [];
    next.missing_reasons = {};
  }
  return next;
}

function runAfterCheck(run, items, issueType, startedAt, completedAt, counts) {
  const reels = items.filter((item) => item.kind === 'reel');
  return {
    ...run,
    updated_at: completedAt,
    phase: 'done',
    current_url: null,
    status: reels.every(handled) ? 'complete' : 'partial',
    error: null,
    deletion_check: {
      operation,
      issue_type: issueType,
      started_at: startedAt,
      completed_at: completedAt,
      counts
    }
  };
}

async function saveProfile(data) {
  await writeJson(data.pathSet.items, data.items);
  await writeJson(data.pathSet.run, data.run);
  await writeReport(data.pathSet, data.profile, data.discovery, data.items, data.run);
}

export async function runReelDeletionCheck(root, candidates, { issueType, startedAt, onProgress = () => {} } = {}) {
  const names = [...new Set(candidates.map((item) => item.username))];
  const profiles = new Map();
  const beforeSnapshots = new Map();
  const changes = new Map(names.map((username) => [username, []]));
  for (const username of names) {
    const data = await profileFiles(root, username);
    profiles.set(username, data);
    beforeSnapshots.set(username, await writeSnapshot(data.pathSet, {
      username,
      phase: 'before-reel-deletion-check',
      snapshotAt: startedAt,
      profile: data.profile,
      discovery: data.discovery,
      items: data.items,
      run: data.run
    }));
  }

  const browser = await chromium.launch({ headless: true });
  const counts = { deleted: 0, exists: 0, check_failed: 0 };
  try {
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      onProgress({ completed: index, total: candidates.length, current: candidate, phase: 'checking', detail: `Opening ${candidate.shortcode} in a fresh private context` });
      const result = await checkOne(browser, candidate);
      counts[result.status] = (counts[result.status] || 0) + 1;
      const data = profiles.get(candidate.username);
      const itemIndex = data.items.findIndex((item) => item.kind === 'reel' && (item.shortcode === candidate.shortcode || item.url === candidate.url));
      if (itemIndex < 0) throw new Error(`Saved reel ${candidate.shortcode} was not found for @${candidate.username}.`);
      data.items[itemIndex] = applyResult(data.items[itemIndex], result);
      changes.get(candidate.username).push({ shortcode: candidate.shortcode, status: result.status, checked_at: result.checked_at, reason: result.reason });
      const completedAt = result.checked_at;
      data.run = runAfterCheck(data.run, data.items, issueType, startedAt, completedAt, counts);
      await saveProfile(data);
      onProgress({ completed: index + 1, total: candidates.length, current: null, counts, phase: 'checking', detail: `${index + 1} of ${candidates.length} reels checked` });
      if (index < candidates.length - 1) await pause(1_600);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  for (const username of names) {
    const data = profiles.get(username);
    const completedAt = now();
    data.run = runAfterCheck(data.run, data.items, issueType, startedAt, completedAt, counts);
    await saveProfile(data);
    const afterSnapshot = await writeSnapshot(data.pathSet, {
      username,
      phase: 'after-reel-deletion-check',
      snapshotAt: completedAt,
      profile: data.profile,
      discovery: data.discovery,
      items: data.items,
      run: data.run
    });
    await writeJson(join(afterSnapshot, 'operation.json'), {
      schema_version: 1,
      operation,
      issue_type: issueType,
      performed_at: completedAt,
      username,
      source: 'fresh incognito context',
      changes: changes.get(username),
      before_snapshot: beforeSnapshots.get(username),
      after_snapshot: afterSnapshot
    });
  }
  return { counts, results: [...changes.values()].flat() };
}
