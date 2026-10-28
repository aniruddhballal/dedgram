import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { catalog, detail, failedReels, profileData, profileSummary, resolveUsername, root, summary, usernames } from './data.mjs';
import { MODES, ORDERS, orderProfiles, resultStatus, stepsFor, terminal } from './plan.mjs';
import { paths, readJson, writeJson } from '../src/store.mjs';
import { exactPostCount, gridCount, profileHeaderComplete, profileLevelComplete } from '../src/model.mjs';
import { applyUsernameChange, checkUsernameChange } from '../src/username-change.mjs';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
const showcaseMediaDir = join(root, '..', 'profile-showcase', 'snapshot', 'media');
const jobPath = process.env.COLLECTOR_UI_JOB_PATH || join(root, 'data', 'ui-job.json');
const port = Number(process.env.COLLECTOR_UI_PORT || 5174);
const preview = process.env.COLLECTOR_UI_PREVIEW === '1';
const usernameJobs = new Map();
let usernameScanJob = null;
let usernameMigrationJob = null;

const json = (response, status, value) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
};

async function body(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Expected a JSON request body.'); }
}

class BatchRunner {
  constructor() { this.batch = null; this.active = false; }

  async load() {
    this.batch = await readJson(jobPath);
    if (preview) return;
    if (this.batch?.status === 'running') {
      this.batch.status = 'interrupted';
      this.batch.current = null;
      this.batch.current_stage = null;
      for (const username of this.batch.profiles) {
        const result = this.batch.results[username];
        if (result?.status === 'running') result.status = 'interrupted';
        for (const stage of Object.values(result?.stages || {})) {
          if (stage.status === 'running') stage.status = 'interrupted';
        }
      }
      await this.save();
    }
  }

  async save() { await writeJson(jobPath, this.batch); }

  async start(requested, mode = 'depth_first', order = 'selection') {
    if (this.active) throw Object.assign(new Error('A batch is already running.'), { status: 409 });
    if (!Array.isArray(requested) || !requested.length) throw Object.assign(new Error('Select at least one profile.'), { status: 400 });
    if (!Object.hasOwn(MODES, mode)) throw Object.assign(new Error('Choose a valid collection mode.'), { status: 400 });
    if (!Object.hasOwn(ORDERS, order)) throw Object.assign(new Error('Choose a valid profile order.'), { status: 400 });
    const valid = await usernames();
    const lookup = new Map(valid.map((name) => [name.toLowerCase(), name]));
    let selected = [...new Set(requested.map((name) => typeof name === 'string' ? lookup.get(name.toLowerCase()) : null))];
    if (selected.includes(undefined) || selected.includes(null) || selected.length > valid.length) {
      throw Object.assign(new Error('Selection contains a profile outside the catalog.'), { status: 400 });
    }
    if (mode === 'reel_grid') {
      const missing = (await Promise.all(selected.map(async (name) => ({ name, data: await profileData(name) }))))
        .filter(({ data }) => !profileHeaderComplete(data.profile) || exactPostCount(data.profile) === null).map(({ name }) => `@${name}`);
      if (missing.length) throw Object.assign(new Error(`Finish profile details and the exact post count first: ${missing.join(', ')}.`), { status: 400 });
    }
    if (mode === 'reels_only' || mode === 'reel_details') {
      const missing = (await Promise.all(selected.map(async (name) => ({ name, data: await profileData(name) }))))
        .filter(({ data }) => !profileLevelComplete(data.profile, data.discovery)).map(({ name }) => `@${name}`);
      if (missing.length) throw Object.assign(new Error(`Finish profile details and reel counts first: ${missing.join(', ')}.`), { status: 400 });
    }
    if (order === 'posts_ascending' || order === 'reels_ascending') {
      const counts = new Map(await Promise.all(selected.map(async (name) => [name,
        order === 'posts_ascending' ? exactPostCount(await readJson(paths(root, name).profile))
          : gridCount((await readJson(paths(root, name).discovery))?.reel)])));
      selected = orderProfiles(selected, order, counts);
    }
    const steps = stepsFor(selected, mode);
    const time = new Date().toISOString();
    this.batch = { id: randomUUID(), mode, order, status: 'running', profiles: selected, steps,
      results: Object.fromEntries(selected.map((name) => [name, { status: 'queued', started_at: null,
        finished_at: null, error: null, stages: Object.fromEntries(steps.filter((step) => step.username === name)
          .map((step) => [step.stage, { status: 'queued', started_at: null, finished_at: null, error: null }])) }])),
      current: null, current_stage: null, started_at: time, updated_at: time, finished_at: null,
      stop_requested: false, logs: [] };
    await this.save();
    this.active = true;
    void this.run().catch(async (error) => {
      if (this.batch.current && this.batch.current_stage) {
        const stage = this.batch.results[this.batch.current]?.stages?.[this.batch.current_stage];
        if (stage) {
          stage.status = 'failed';
          stage.error = error.message;
          stage.finished_at = new Date().toISOString();
          this.batch.results[this.batch.current].status = 'failed';
        }
      }
      this.batch.status = 'failed';
      this.batch.error = error.message;
      this.batch.updated_at = new Date().toISOString();
      this.batch.current = null;
      this.batch.current_stage = null;
      this.active = false;
      await this.save().catch(() => {});
    });
    return this.batch;
  }

  async stop() {
    if (!this.active) throw Object.assign(new Error('No batch is running.'), { status: 409 });
    this.batch.stop_requested = true;
    this.batch.updated_at = new Date().toISOString();
    await this.save();
    return this.batch;
  }

  log(line) {
    const value = line.trim();
    if (!value) return;
    this.batch.logs.push(value.slice(0, 500));
    if (this.batch.logs.length > 60) this.batch.logs.shift();
    this.batch.updated_at = new Date().toISOString();
  }

  async run() {
    for (const { username, stage: level } of this.batch.steps) {
      if (this.batch.stop_requested) break;
      const result = this.batch.results[username];
      const stage = result.stages[level];
      if (level === 'reels' && (['failed', 'needs_review'].includes(result.stages.profile?.status)
        || !await profileData(username).then((data) => profileLevelComplete(data.profile, data.discovery)))) {
        stage.status = 'skipped';
        stage.error = 'Profile details or the reel count are incomplete.';
        stage.finished_at = new Date().toISOString();
        result.status = resultStatus(result.stages);
        result.error = stage.error;
        result.finished_at = stage.finished_at;
        this.log(`Skipped @${username} reels: ${stage.error}`);
        await this.save();
        continue;
      }
      stage.status = 'running';
      stage.started_at = new Date().toISOString();
      result.status = 'running';
      result.started_at ||= stage.started_at;
      this.batch.current = username;
      this.batch.current_stage = level;
      this.batch.updated_at = stage.started_at;
      await this.save();
      this.log(`Starting @${username} ${level}`);
      const flags = level === 'profile' ? ['--profile-only'] : level === 'profile_header' ? ['--header-only']
        : level === 'reel_grid' ? ['--reel-grid-only', '--refresh']
        : ['--reels-only', '--skip-profile'];
      const child = spawn(process.execPath,
        ['src/cli.mjs', 'collect', `--username=${username}`, ...flags, '--headless'],
        { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding('utf8');
        let pending = '';
        stream.on('data', (chunk) => {
          pending += chunk;
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() || '';
          for (const line of lines) this.log(line);
        });
        stream.on('end', () => { if (pending) this.log(pending); });
      }
      const exit = await new Promise((resolveExit) => {
        let error = null;
        child.once('error', (value) => { error = value; });
        child.once('close', (code) => resolveExit({ code, error }));
      });
      const collected = await profileData(username);
      stage.finished_at = new Date().toISOString();
      const stageComplete = level === 'profile_header' ? profileHeaderComplete(collected.profile) && exactPostCount(collected.profile) !== null
        : level === 'reel_grid' ? collected.discovery?.reel?.complete === true
        : level === 'profile' ? Boolean(collected.profile?.fetched_at) : collected.run.status === 'complete';
      stage.status = exit.code === 0 ? stageComplete && collected.run.status === 'complete' ? 'complete' : 'needs_review' : 'failed';
      stage.error = exit.error?.message || (exit.code === 0 ? collected.run.error || null
        : collected.run.error || `Collector exited with code ${exit.code}.`);
      result.status = resultStatus(result.stages);
      result.error = stage.error || result.error;
      if (Object.values(result.stages).every((value) => terminal(value.status))) result.finished_at = stage.finished_at;
      this.log(`Finished @${username} ${level}: ${stage.status}`);
      this.batch.current = null;
      this.batch.current_stage = null;
      this.batch.updated_at = stage.finished_at;
      await this.save();
    }
    this.batch.status = this.batch.stop_requested ? 'stopped' : 'complete';
    this.batch.finished_at = new Date().toISOString();
    this.batch.updated_at = this.batch.finished_at;
    await this.save();
    this.active = false;
  }
}

const runner = new BatchRunner();
await runner.load();

function queueUsernameJob(username, kind, task) {
  const existing = usernameJobs.get(username);
  if (existing?.status === 'running') throw Object.assign(new Error('A username check or migration is already running for this profile.'), { status: 409 });
  const job = { kind, status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString(), phase: 'starting', detail: 'Preparing' };
  usernameJobs.set(username, job);
  void task((progress) => Object.assign(job, progress, { updated_at: new Date().toISOString() }))
    .then((result) => Object.assign(job, { status: 'complete', result, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
    .catch((error) => Object.assign(job, { status: 'failed', error: error.message, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
  return job;
}

function usernameWorkRunning() {
  return usernameScanJob?.status === 'running' || usernameMigrationJob?.status === 'running';
}

function ensureUsernameWorkAvailable() {
  if (runner.active) throw Object.assign(new Error('Finish or stop the collection run before starting username work.'), { status: 409 });
  if (usernameWorkRunning()) throw Object.assign(new Error('Another username workflow is already running.'), { status: 409 });
}

function resolvedAccount(profile) {
  return ['deleted', 'age_restricted', 'false_identification'].includes(profile?.run?.account_status || profile?.profile?.account_status);
}

function scanResult(username, status, extra = {}) {
  return { username, status, ...extra };
}

function startUsernameScan() {
  ensureUsernameWorkAvailable();
  const startedAt = new Date().toISOString();
  usernameScanJob = { kind: 'bulk-check', status: 'running', started_at: startedAt, updated_at: startedAt,
    total: 0, completed: 0, current: null, changed: 0, no_change: 0, failed: 0, skipped: 0, results: [], error: null };
  void (async () => {
    try {
      const candidates = [];
      for (const username of await usernames()) {
        const data = await profileData(username);
        if (!resolvedAccount(data)) candidates.push({ username, data });
      }
      usernameScanJob.total = candidates.length;
      usernameScanJob.updated_at = new Date().toISOString();
      for (const { username, data } of candidates) {
        usernameScanJob.current = username;
        usernameScanJob.updated_at = new Date().toISOString();
        const hasReel = Boolean(data.discovery?.reel?.items?.some((item) => item?.url)
          || data.items?.some((item) => item.kind === 'reel' && item.url));
        if (!hasReel) {
          usernameScanJob.results.push(scanResult(username, 'skipped', { detail: 'No saved reel URL is available.' }));
          usernameScanJob.skipped += 1;
          usernameScanJob.completed += 1;
          continue;
        }
        try {
          const result = await checkUsernameChange(root, username, { headless: true });
          usernameScanJob.results.push(scanResult(username, result.status, {
            detected_username: result.detected_username, stored_username: result.stored_username,
            checked_at: result.checked_at, reel_url: result.reel_url, message: result.message
          }));
          if (result.status === 'changed') usernameScanJob.changed += 1;
          else usernameScanJob.no_change += 1;
        } catch (error) {
          usernameScanJob.results.push(scanResult(username, 'failed', { detail: error.message }));
          usernameScanJob.failed += 1;
        }
        usernameScanJob.completed += 1;
        usernameScanJob.updated_at = new Date().toISOString();
      }
      usernameScanJob.current = null;
      usernameScanJob.status = 'complete';
      usernameScanJob.finished_at = new Date().toISOString();
      usernameScanJob.updated_at = usernameScanJob.finished_at;
    } catch (error) {
      usernameScanJob.status = 'failed';
      usernameScanJob.error = error.message;
      usernameScanJob.finished_at = new Date().toISOString();
      usernameScanJob.updated_at = usernameScanJob.finished_at;
    }
  })();
  return usernameScanJob;
}

async function startUsernameMigration(input) {
  ensureUsernameWorkAvailable();
  if (!Array.isArray(input?.profiles) || !input.profiles.length) {
    throw Object.assign(new Error('Select at least one flagged username change.'), { status: 400 });
  }
  if (!Object.hasOwn(ORDERS, input.order || 'selection')) {
    throw Object.assign(new Error('Choose a valid profile order.'), { status: 400 });
  }
  const mode = input.mode || 'depth_first';
  if (!['depth_first', 'breadth_first'].includes(mode)) {
    throw Object.assign(new Error('Choose a valid username migration mode.'), { status: 400 });
  }
  const valid = await usernames();
  const lookup = new Map(valid.map((name) => [name.toLowerCase(), name]));
  const requested = input.profiles.map((entry) => ({
    username: lookup.get(String(entry?.username || '').toLowerCase()),
    detected_username: entry?.detected_username
  }));
  if (requested.some((entry) => !entry.username || !/^[A-Za-z0-9._]{1,30}$/.test(entry.detected_username || ''))) {
    throw Object.assign(new Error('Selection contains an invalid username migration.'), { status: 400 });
  }
  const unique = [...new Map(requested.map((entry) => [entry.username.toLowerCase(), entry])).values()];
  const checked = await Promise.all(unique.map(async (entry) => ({ ...entry, data: await profileData(entry.username) })));
  const invalid = checked.filter(({ data, detected_username }) => data.profile?.username_check?.status !== 'changed'
    || data.profile.username_check.detected_username?.toLowerCase() !== detected_username.toLowerCase());
  if (invalid.length) throw Object.assign(new Error(`Run the global username check first for: ${invalid.map(({ username }) => `@${username}`).join(', ')}.`), { status: 400 });
  const counts = new Map(checked.map(({ username, data }) => [username,
    input.order === 'reels_ascending' ? (data.discovery?.reel?.items?.length ?? null) : data.profile?.posts_count?.value ?? data.profile?.posts_count ?? null]));
  const orderedNames = orderProfiles(unique.map((entry) => entry.username), input.order || 'selection', counts);
  const byName = new Map(unique.map((entry) => [entry.username, entry]));
  const profiles = orderedNames.map((username) => ({ username, detected_username: byName.get(username).detected_username,
    status: 'queued', phase: null, detail: null }));
  const startedAt = new Date().toISOString();
  usernameMigrationJob = { kind: 'bulk-migration', status: 'running', started_at: startedAt, updated_at: startedAt,
    mode, order: input.order || 'selection', profiles, completed: 0, current: null, error: null };
  void (async () => {
    for (const item of usernameMigrationJob.profiles) {
      usernameMigrationJob.current = item.username;
      item.status = 'running';
      usernameMigrationJob.updated_at = new Date().toISOString();
      try {
        const result = await applyUsernameChange(root, item.username, item.detected_username, {
          headless: true,
          onProgress: (progress) => { Object.assign(item, progress); usernameMigrationJob.updated_at = new Date().toISOString(); }
        });
        Object.assign(item, { status: 'complete', result, finished_at: new Date().toISOString() });
      } catch (error) {
        Object.assign(item, { status: 'failed', error: error.message, finished_at: new Date().toISOString() });
      }
      usernameMigrationJob.completed += 1;
      usernameMigrationJob.updated_at = new Date().toISOString();
    }
    usernameMigrationJob.current = null;
    usernameMigrationJob.status = usernameMigrationJob.profiles.some((item) => item.status === 'failed') ? 'needs_review' : 'complete';
    usernameMigrationJob.finished_at = new Date().toISOString();
    usernameMigrationJob.updated_at = usernameMigrationJob.finished_at;
  })();
  return usernameMigrationJob;
}

const assets = new Map([
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/app-v3.js', ['app-v3.js', 'text/javascript; charset=utf-8']],
  ['/flow.js', ['flow.js', 'text/javascript; charset=utf-8']],
  ['/shared.js', ['shared.js', 'text/javascript; charset=utf-8']],
  ['/queue.js', ['queue.js', 'text/javascript; charset=utf-8']],
  ['/profile.js', ['profile.js', 'text/javascript; charset=utf-8']],
  ['/profile-v3.js', ['profile-v3.js', 'text/javascript; charset=utf-8']],
  ['/overview.js', ['overview.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/showcase.css', ['showcase.css', 'text/css; charset=utf-8']],
  ['/flow.css', ['flow.css', 'text/css; charset=utf-8']],
  ['/dos.css', ['dos.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

async function sendFile(response, file, type) {
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') json(response, 404, { error: 'File not found.' });
    else throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const pathname = url.pathname;
    if (request.method === 'POST') {
      if (preview) return json(response, 409, { error: 'This preview is read only. Collection continues in the original UI.' });
      const expected = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
      if (!expected.includes(request.headers.origin) || !request.headers['content-type']?.startsWith('application/json')) {
        return json(response, 403, { error: 'Use this local UI to start or stop collection.' });
      }
      if (pathname === '/api/runs') {
        const input = await body(request);
        return json(response, 202, await runner.start(input.profiles, input.mode, input.order));
      }
      if (pathname === '/api/runs/stop') return json(response, 200, await runner.stop());
      if (pathname === '/api/username-scan') return json(response, 202, startUsernameScan());
      if (pathname === '/api/username-change/bulk') {
        const input = await body(request);
        return json(response, 202, await startUsernameMigration(input));
      }
      if (pathname === '/api/username-check') {
        const input = await body(request);
        const username = await resolveUsername(input.username);
        if (!username) return json(response, 404, { error: 'Profile not in catalog.' });
        ensureUsernameWorkAvailable();
        return json(response, 202, queueUsernameJob(username, 'check', async (progress) => {
          progress({ phase: 'reel', detail: 'Opening a saved reel and reading its poster username' });
          return checkUsernameChange(root, username, { headless: true });
        }));
      }
      if (pathname === '/api/username-change/apply') {
        const input = await body(request);
        const username = await resolveUsername(input.username);
        if (!username) return json(response, 404, { error: 'Profile not in catalog.' });
        ensureUsernameWorkAvailable();
        return json(response, 202, queueUsernameJob(username, 'apply', (progress) => applyUsernameChange(root, username,
          input.detected_username, { headless: true, onProgress: progress })));
      }
      return json(response, 404, { error: 'Unknown action.' });
    }
    if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
    if (pathname === '/api/health') return json(response, 200, { ok: true, active: preview ? runner.batch?.status === 'running' : runner.active, read_only: preview });
    if (pathname === '/api/catalog') return json(response, 200, { profiles: await catalog() });
    if (pathname === '/api/failed-reels') return json(response, 200, { reels: await failedReels() });
    if (pathname === '/api/summary') return json(response, 200, await summary());
    if (pathname === '/api/username-scan') return json(response, 200, usernameScanJob);
    if (pathname === '/api/username-migration') return json(response, 200, usernameMigrationJob);
    if (pathname === '/api/run') {
      if (preview) runner.batch = await readJson(jobPath);
      const profiles = runner.batch?.profiles || [];
      const summaries = await Promise.all(profiles.map(async (username) => profileSummary(await profileData(username))));
      return json(response, 200, { batch: runner.batch, profiles: summaries });
    }
    if (pathname.startsWith('/api/profiles/')) {
      const username = await resolveUsername(decodeURIComponent(pathname.slice('/api/profiles/'.length)));
      if (!username) return json(response, 404, { error: 'Profile not in catalog.' });
      return json(response, 200, { ...(await detail(username)), username_job: usernameJobs.get(username) || null });
    }
    if (pathname.startsWith('/reports/')) {
      const username = await resolveUsername(decodeURIComponent(pathname.slice('/reports/'.length)));
      return username ? sendFile(response, paths(root, username).report, 'text/html; charset=utf-8')
        : json(response, 404, { error: 'Profile not in catalog.' });
    }
    if (assets.has(pathname)) {
      const [file, type] = assets.get(pathname);
      return sendFile(response, join(publicDir, file), type);
    }
    if (pathname.startsWith('/media/')) {
      const filename = decodeURIComponent(pathname.slice('/media/'.length));
      if (!/^[A-Za-z0-9_-]+\.jpg$/.test(filename)) return json(response, 400, { error: 'Invalid media filename.' });
      return sendFile(response, join(showcaseMediaDir, filename), 'image/jpeg');
    }
    if (pathname.startsWith('/avatars/')) {
      const filename = decodeURIComponent(pathname.slice('/avatars/'.length));
      if (!/^[A-Za-z0-9._-]+\.jpg$/.test(filename)) return json(response, 400, { error: 'Invalid avatar filename.' });
      const username = await resolveUsername(filename.slice(0, -4));
      return username ? sendFile(response, paths(root, username).profilePicture, 'image/jpeg')
        : json(response, 404, { error: 'Profile not in catalog.' });
    }
    if (pathname.startsWith('/profiles/')) {
      const requested = decodeURIComponent(pathname.slice('/profiles/'.length)).replace(/\/$/, '');
      const resolved = await resolveUsername(requested);
      if (resolved) {
        const current = (await profileData(resolved)).profile?.current_username;
        if (current && current.toLowerCase() !== requested.toLowerCase()) {
          response.writeHead(302, { Location: `/profiles/${encodeURIComponent(current)}` });
          return response.end();
        }
      }
    }
    if (pathname === '/' || pathname === '/summary' || pathname === '/overview' || pathname === '/failed-reels' || pathname === '/failed-reels/' || pathname === '/collection/review'
      || pathname === '/collect/profiles' || pathname === '/collect/reel-urls' || pathname === '/collect/reel-details'
      || pathname.startsWith('/profiles/')) {
      return sendFile(response, join(publicDir, 'index-v3.html'), 'text/html; charset=utf-8');
    }
    return json(response, 404, { error: 'Page not found.' });
  } catch (error) {
    if (!error.status) console.error(error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'The local UI encountered an error.' });
    else response.end();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Collector UI: http://127.0.0.1:${port}`);
});
