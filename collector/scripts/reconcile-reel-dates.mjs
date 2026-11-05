import { access, copyFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemAnalysisHandled, normalizeReelDate, profileLevelComplete } from '../src/model.mjs';
import { paths, readJson, writeJson } from '../src/store.mjs';
import { writeReport } from '../src/report.mjs';

// Offline migration: only reuse dates already in each reel's saved evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotRoot = resolve(root, '..', 'website', 'snapshot');
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const changes = [];
for (const entry of await readdir(join(root, 'data'), { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^[A-Za-z0-9._]{1,30}$/.test(entry.name)) continue;
  const pathSet = paths(root, entry.name);
  const original = await readJson(pathSet.items, []);
  const items = original.map(normalizeReelDate);
  const changed = items.filter((item, index) => item !== original[index]);
  if (!changed.length) continue;
  const snapshot = join(snapshotRoot, entry.name);
  const published = await exists(join(snapshot, 'items.json'));
  if (published && JSON.stringify(await readJson(join(snapshot, 'items.json'))) !== JSON.stringify(original)) {
    throw new Error(`Collector and website records differ for ${entry.name}; reconcile them before migrating.`);
  }
  changes.push({ username: entry.name, pathSet, snapshot, published, original, items, changed });
}

const updatedAt = new Date().toISOString();
let recovered = 0;
let completed = 0;
for (const change of changes) {
  const { pathSet, snapshot, published, original, items, changed, username } = change;
  const profile = await readJson(pathSet.profile);
  const discovery = await readJson(pathSet.discovery, {});
  const run = await readJson(pathSet.run, {});
  const promoted = items.filter((item, index) => item.status === 'complete' && original[index].status !== 'complete').length;
  const reels = items.filter((item) => item.kind === 'reel');
  if (!profile?.excluded_from_analysis && run.status === 'partial' && profileLevelComplete(profile, discovery)
    && discovery.reel.items.length === reels.length && reels.every(itemAnalysisHandled)) {
    run.status = 'complete';
    run.completion_basis = 'All available reel data analyzed; missing dates recovered from saved evidence.';
  }
  run.updated_at = updatedAt;
  run.metadata_date_recovery = { updated_at: updatedAt, recovered_reels: changed.map((item) => item.shortcode),
    newly_complete_reels: promoted, network_requests: 0 };
  if (run.progress) run.progress = { ...run.progress, updated_at: updatedAt,
    detail: `${changed.length} reel dates recovered from saved evidence. ${reels.filter((item) => !itemAnalysisHandled(item)).length} reels still need analysis or review.` };
  await writeJson(pathSet.items, items);
  await writeJson(pathSet.run, run);
  await writeReport(pathSet, profile, discovery, items, run);
  if (published) for (const file of ['items.json', 'run.json', 'items.csv', 'report.html']) {
    await copyFile(join(pathSet.base, file), join(snapshot, file));
  }
  recovered += changed.length;
  completed += promoted;
  console.log(`${username}: ${changed.length} dates recovered; ${promoted} reels now complete.`);
}
console.log(`Recovered ${recovered} dates across ${changes.length} profiles; ${completed} reels now complete. No network requests.`);
