import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, readJson, writeJson, writeSnapshot } from '../src/store.mjs';
import { profileFromSnapshot } from '../src/model.mjs';
import { writeReport } from '../src/report.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const operationAt = new Date().toISOString();
const operation = 'manual bio completion';
const reason = 'Completed truncated profile bios after identifying an issue in the profile-level data fetch.';

const isTruncatedHeader = (header) => String(header || '').split(/\r?\n/).some((line) => /^(more|see translation)$/i.test(line.trim()));

const usernames = (await readdir(join(root, 'data'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const repaired = [];
const skipped = [];

for (const username of usernames) {
  const pathSet = paths(root, username);
  const profile = await readJson(pathSet.profile);
  if (!profile?.raw?.header_text || !isTruncatedHeader(profile.raw.header_text)) continue;

  const completeBio = profileFromSnapshot(username, profile.raw).bio;
  if (!completeBio || completeBio === profile.bio) {
    skipped.push({ username, reason: completeBio ? 'bio already matches metadata' : 'no complete metadata bio available' });
    continue;
  }

  const previousBio = profile.bio || null;
  const updatedProfile = { ...profile, bio: completeBio };
  const discovery = await readJson(pathSet.discovery, {});
  const items = await readJson(pathSet.items, []);
  const run = await readJson(pathSet.run, {});

  await writeJson(pathSet.profile, updatedProfile);
  const historyDirectory = await writeSnapshot(pathSet, {
    username,
    phase: operation,
    snapshotAt: operationAt,
    profile: updatedProfile,
    discovery,
    items,
    run
  });
  await writeJson(join(historyDirectory, 'operation.json'), {
    schema_version: 1,
    operation,
    reason,
    performed_at: operationAt,
    username,
    field: 'bio',
    source: 'saved profile metadata description',
    previous_value: previousBio,
    completed_value: completeBio
  });
  await writeReport(pathSet, updatedProfile, discovery, items, run);
  repaired.push({ username, historyDirectory });
}

console.log(JSON.stringify({ operation, performed_at: operationAt, repaired: repaired.length, skipped, profiles: repaired.map(({ username }) => username) }, null, 2));
