import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { canonicalItemUrl, clean } from './model.mjs';
import { engagementFromDocument } from './reel-engagement.mjs';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRateLimitText(text) {
  return /\b(?:HTTP(?:\s+error)?|error(?:\s+code)?|status(?:\s+code)?)\s*[:=-]?\s*429\b|\b429\s*[:=-]?\s*too many requests\b|\btoo many requests\b|\brate[ -]?limit(?:ed|ing)?\b/i.test(String(text || ''));
}

export function installRateLimitHandling(context) {
  context.on('response', (response) => {
    if (context.preserveReelGridOnRateLimit) return;
    if (response.status() !== 429 || !/(^|\.)instagram\.com$/.test(new URL(response.url()).hostname)) return;
    const headers = response.headers();
    const retryAfter = headers['retry-after'];
    const retryAfterMs = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : 0;
    const event = { url: response.url(), retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0 };
    if (context.reelGridRecovery) {
      context.reelGridRecovery.pending = event;
      return;
    }
    context.rateLimitError = `Instagram returned HTTP 429 (rate limit). URL: ${event.url}`;
    void context.close().catch(() => {});
  });
}

function profileTarget(value) {
  const raw = String(value || '').trim();
  const parsed = /^https?:\/\//i.test(raw)
    ? new URL(raw)
    : new URL(`https://www.instagram.com/${raw.replace(/^\/+|\/+$/g, '')}/`);
  const username = parsed.pathname.split('/').filter(Boolean)[0];
  if (!username || !/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new Error(`Invalid Instagram profile target: ${value}`);
  return { username, url: `https://www.instagram.com/${username}/` };
}

export async function launch(root, { headless = false } = {}) {
  const context = await chromium.launchPersistentContext(join(root, '.auth', 'browser'), {
    headless,
    viewport: { width: 1320, height: 950 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    slowMo: 0
  });
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);
  installRateLimitHandling(context);
  return { context, page };
}

function blocked(url, text) {
  if (/\/accounts\/login|\/challenge\//.test(new URL(url).pathname)) return 'Instagram requires login or a security checkpoint.';
  if (isRateLimitText(text)) return 'Instagram returned HTTP 429 (rate limit).';
  if (/please wait a few minutes|try again later|challenge_required|checkpoint_required/i.test(text)) return 'Instagram showed a temporary limit or checkpoint.';
  if (/sorry, this page isn't available|page may have been removed/i.test(text)) return 'Instagram reports this page is unavailable.';
  return '';
}

async function open(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (response?.status() === 429) throw new Error('Instagram returned HTTP 429 (rate limit).');
  await page.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await pause(900);
  const text = await page.locator('body').innerText().catch(() => '');
  const reason = blocked(page.url(), text.slice(0, 10000));
  if (reason) throw new Error(reason);
  if (!text.trim()) throw new Error('Instagram rendered an empty page.');
}

async function aboutText(page) {
  const selectors = [
    page.locator('main header [role="button"]').filter({ has: page.locator('svg[aria-label*="options" i]') }).first(),
    page.locator('main header button').filter({ has: page.locator('svg[aria-label*="options" i]') }).first(),
    page.getByRole('button', { name: /^(options|more options|profile options)$/i }).first()
  ];
  let opened = false;
  for (const button of selectors) {
    try { if (await button.isVisible({ timeout: 1200 })) { await button.click(); opened = true; break; } }
    catch (error) { if (process.env.DEDGRAM_DEBUG) console.warn('Options click:', error.message); }
  }
  if (!opened) {
    if (process.env.DEDGRAM_DEBUG) console.warn('No visible profile options control');
    return '';
  }
  try {
    const about = page.getByText(/about this (account|profile)/i).last();
    await about.click({ timeout: 5000 });
    const dialog = page.getByRole('dialog').last();
    await dialog.waitFor({ timeout: 8000 });
    let value = '';
    for (let attempt = 0; attempt < 30; attempt++) {
      value = await dialog.innerText();
      if (/About this account/i.test(value) && value.length > 40) break;
      await pause(200);
    }
    return value;
  } catch (error) {
    if (process.env.DEDGRAM_DEBUG) console.warn('About dialog extraction:', error.message);
    return '';
  }
  finally { await page.keyboard.press('Escape').catch(() => {}); }
}

export async function captureProfile(page, username) {
  const target = profileTarget(username);
  await open(page, target.url);
  const header = page.locator('main header').first();
  await header.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  const headerText = await header.innerText().catch(() => '');
  if (!headerText.trim()) throw new Error('Instagram did not show the profile header.');
  const about = await aboutText(page);
  const meta = await page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.content || '',
    profile_picture_url: document.querySelector('main header img')?.src || document.querySelector('meta[property="og:image"]')?.content || '',
    stat_evidence: Object.fromEntries(['posts', 'followers', 'following'].map((name) => {
      const element = [...document.querySelectorAll('main header a, main header button')]
        .find((candidate) => new RegExp(`\\b${name}\\b`, 'i').test(candidate.innerText || ''));
      return [name, {
        label: element?.innerText || '',
        exact_title: element?.querySelector('[title]')?.getAttribute('title') || ''
      }];
    }))
  }));
  return { header_text: headerText, about_text: about, ...meta };
}

export async function saveProfilePicture(page, destination) {
  const image = page.locator('main header img').first();
  if (!await image.isVisible({ timeout: 1500 }).catch(() => false)) return false;
  const buffer = await image.screenshot({ type: 'jpeg', quality: 88 });
  await writeFile(destination, buffer);
  return true;
}

export async function discover(page, username, kind, onProgress,
  options = {}) {
  const context = page.context();
  const recovery = kind === 'reel' ? { pending: null, attempts: 0, lastUrl: null } : null;
  if (recovery) context.reelGridRecovery = recovery;
  try {
    const result = await discoverGrid(page, username, kind, onProgress, options, recovery);
    if (recovery && /429|rate limit|too many requests/i.test(result.error || '')) context.preserveReelGridOnRateLimit = true;
    return result;
  } catch (error) {
    if (recovery && (recovery.pending || /429|rate limit|too many requests/i.test(error.message))) context.preserveReelGridOnRateLimit = true;
    throw error;
  }
  finally { if (recovery) delete context.reelGridRecovery; }
}

async function discoverGrid(page, username, kind, onProgress,
  { maxPasses = Infinity, maxIdleMs = 60_000, pauseMs = 850, bottomUp = false,
    rateLimitWaitMs = () => 5000 + Math.floor(Math.random() * 5001), wait = pause } = {}, recovery) {
  const target = profileTarget(username);
  const url = `${target.url}${kind === 'reel' ? 'reels/' : ''}`;
  await open(page, url);
  const found = new Map();
  let stable = 0;
  let complete = false;
  let reason = '';
  let lastProgressAt = Date.now();
  let lastY = -1;
  let lastHeight = -1;
  let awaitingRecoveryProgress = false;
  let seekingBottom = bottomUp && kind === 'reel';
  const scroll = () => page.evaluate(({ seekingBottom, bottomUp }) => {
    if (seekingBottom) window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    else window.scrollBy(0, (bottomUp ? -1 : 1) * Math.max(500, Math.floor(window.innerHeight * .8)));
  }, { seekingBottom, bottomUp: bottomUp && kind === 'reel' });
  for (let pass = 0; pass < maxPasses; pass++) {
    const raw = seekingBottom ? [] : await page.evaluate(() => [...document.querySelectorAll('main a[href]')].map((anchor) => ({
      href: anchor.href,
      label: anchor.getAttribute('aria-label') || '',
      text: anchor.innerText || '',
      sensitive_overlay: !!anchor.querySelector('[aria-label*="sensitive content" i]')
    })));
    if (bottomUp) raw.reverse();
    const sizeBefore = found.size;
    for (const anchor of raw) {
      const pathname = new URL(anchor.href).pathname;
      const owner = pathname.match(/^\/([^/]+)\/(?:p|reel|reels)\//)?.[1];
      if (owner && owner.toLowerCase() !== target.username.toLowerCase()) continue;
      const item = canonicalItemUrl(anchor.href);
      if (item?.kind !== kind) continue;
      const tileText = clean(anchor.label || anchor.text);
      const views = kind === 'reel' ? (tileText.match(/([\d,.]+\s*[KMB]?)\s*(?:views?|plays?)/i)?.[1]
        || (/^[\d,.]+\s*[KMB]?$/i.test(tileText) ? tileText : null)) : null;
      const gridViews = views || found.get(item.url)?.grid_views_raw || null;
      found.set(item.url, { ...found.get(item.url), ...item, grid_views_raw: gridViews,
        grid_views_issue: !gridViews && anchor.sensitive_overlay
          ? 'Sensitive Content overlay hides the profile grid view label; the reel page showed no readable view count.' : null });
    }
    if (found.size !== sizeBefore) await onProgress([...found.values()], false);
    const state = await page.evaluate(() => ({
      y: window.scrollY,
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewport: window.innerHeight,
      loading: !!document.querySelector('[role="progressbar"]'),
      text: (document.querySelector('main')?.innerText || '').slice(0, 1500),
      gate: /Sign up and never miss a post|See photos, videos and more from/i.test(document.body.innerText || ''),
      tiles: document.querySelectorAll('main a[href]').length
    }));
    reason = blocked(page.url(), state.text);
    if (recovery && (recovery.pending || /429|rate limit|too many requests/i.test(reason))) {
      const event = recovery.pending;
      recovery.lastUrl = event?.url || recovery.lastUrl || page.url();
      if (recovery.attempts >= 3 || event?.retryAfterMs > 10_000) {
        reason = `Instagram returned HTTP 429 (rate limit). Reel grid recovery stopped after ${recovery.attempts} retries. URL: ${recovery.lastUrl}${event?.retryAfterMs > 10_000 ? ' Server Retry-After exceeds the short recovery window.' : ''}`;
        break;
      }
      const delay = Math.max(5000, Math.min(10_000, rateLimitWaitMs()), event?.retryAfterMs || 0);
      recovery.pending = null;
      recovery.attempts++;
      console.log(`Reel grid HTTP 429: waiting ${delay / 1000}s before scroll retry ${recovery.attempts}/3. URL: ${recovery.lastUrl}`);
      await onProgress([...found.values()], false, `Reel grid HTTP 429: waiting ${delay / 1000}s before scroll retry ${recovery.attempts}/3. URL: ${recovery.lastUrl}`);
      await wait(delay);
      await scroll();
      await pause(pauseMs);
      stable = 0;
      lastProgressAt = Date.now();
      awaitingRecoveryProgress = true;
      reason = '';
      continue;
    }
    if (reason) break;
    if (found.size > sizeBefore || (seekingBottom && state.height > lastHeight && lastHeight >= 0)) awaitingRecoveryProgress = false;
    if (state.gate) { reason = 'The logged out preview showed a limited grid. Sign in to discover the full list.'; break; }
    const empty = kind === 'reel' ? /no reels|hasn't posted any reels|no content to show/i.test(state.text)
      : /no posts yet|hasn't posted/i.test(state.text);
    if (!found.size && empty) { complete = true; break; }
    const atBottom = state.y + state.viewport >= state.height - 12;
    const atEnd = bottomUp && !seekingBottom ? state.y <= 1 : atBottom;
    stable = atEnd && state.height === lastHeight && found.size === sizeBefore && !state.loading ? stable + 1 : 0;
    if (!awaitingRecoveryProgress && stable >= 5 && (found.size > 0 || state.tiles > 0)) {
      if (seekingBottom) {
        seekingBottom = false;
        stable = 0;
        lastProgressAt = Date.now();
        console.log('Bottom confirmed. Starting reel URL collection from the bottom upward.');
        continue;
      }
      complete = true;
      break;
    }
    if (found.size > sizeBefore || Math.abs(state.y - lastY) > 1 || state.height > lastHeight + 1) {
      lastProgressAt = Date.now();
    }
    lastY = state.y;
    lastHeight = state.height;
    if (seekingBottom && pass % 20 === 0) {
      console.log(`Seeking grid bottom: scroll ${Math.round(state.y)}/${Math.round(state.height)}; URL collection deferred.`);
      await onProgress([...found.values()], false, '', { phase: 'seeking_bottom', scroll_y: state.y, scroll_height: state.height });
    }
    if (Date.now() - lastProgressAt >= maxIdleMs) {
      reason = `${awaitingRecoveryProgress ? `Instagram returned HTTP 429 (rate limit); no new reel URLs after recovery. URL: ${recovery.lastUrl}. ` : ''}Grid made no progress for ${Math.round(maxIdleMs / 1000)} seconds at scroll ${Math.round(state.y)}/${Math.round(state.height)} with ${found.size} ${kind} links${state.loading ? ' while Instagram showed a loading indicator' : ''}.`;
      break;
    }
    await scroll();
    await pause(pauseMs);
  }
  if (!complete && !reason) reason = `${awaitingRecoveryProgress ? `Instagram returned HTTP 429 (rate limit); recovery did not confirm further reel URLs. URL: ${recovery.lastUrl}. ` : ''}Grid reached the configured ${maxPasses}-pass limit before confirming the last item.`;
  await onProgress([...found.values()], complete, reason);
  return { items: [...found.values()], complete, error: reason };
}

export async function captureItem(page, item) {
  await open(page, item.url);
  if (canonicalItemUrl(page.url())?.shortcode !== item.shortcode) throw new Error('Instagram redirected to a different item.');
  const snapshot = await page.evaluate(() => {
    const article = document.querySelector('main article, [role="dialog"] article, article, main') || document.body;
    const meta = (selector) => document.querySelector(selector)?.content || '';
    const time = article.querySelector('time[datetime]') || document.querySelector('time[datetime]');
    return {
      datetime: time?.getAttribute('datetime') || '',
      article_text: article.innerText || '',
      aria_text: [...article.querySelectorAll('[aria-label], [title]')].slice(0, 200)
        .map((element) => [element.getAttribute('aria-label'), element.getAttribute('title')].filter(Boolean).join(' ')).join('\n'),
      caption: article.querySelector('h1')?.innerText || '',
      og_description: meta('meta[property="og:description"]'),
      og_image: meta('meta[property="og:image"]'),
      og_video: meta('meta[property="og:video"]'),
      json_ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((element) => element.textContent || '')
    };
  });
  snapshot.engagement = await page.evaluate(engagementFromDocument, { shortcode: item.shortcode });
  if (!clean(snapshot.article_text)) throw new Error('Item page rendered no readable content.');
  return snapshot;
}

function profileUsernameFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length !== 1 || !/^[A-Za-z0-9._]{1,30}$/.test(parts[0])) return null;
  if (/^(accounts|about|direct|explore|reel|reels|p|stories|web)$/i.test(parts[0])) return null;
  return parts[0];
}

export async function captureItemOwner(page, item) {
  await open(page, item.url);
  if (canonicalItemUrl(page.url())?.shortcode !== item.shortcode) throw new Error('Instagram redirected to a different item.');
  const evidence = await page.evaluate(() => {
    const article = document.querySelector('main article, [role="dialog"] article, article') || document.querySelector('main') || document.body;
    const description = document.querySelector('meta[property="og:description"]')?.content || '';
    const links = [...article.querySelectorAll('a[href]')].map((anchor) => ({ href: anchor.href, text: anchor.innerText || '' }));
    return { description, article_text: article.innerText || '', links, page_url: location.href };
  });
  const descriptionMatch = evidence.description.match(/(?:likes?|comments?)[\s\S]*?[-–]\s*([A-Za-z0-9._]{1,30})(?:\s+on\b|:)/i);
  const textMatch = evidence.article_text.match(/(?:likes?|comments?)[\s\S]*?[-–]\s*([A-Za-z0-9._]{1,30})(?:\s+on\b|:)/i);
  const linkUsername = evidence.links.map((link) => {
    try { return profileUsernameFromPath(new URL(link.href).pathname); } catch { return null; }
  }).find(Boolean) || null;
  const posterUsername = descriptionMatch?.[1] || textMatch?.[1] || linkUsername;
  if (!posterUsername) throw new Error('Instagram opened the reel but no poster username was readable.');
  return { poster_username: posterUsername, item_url: item.url, page_url: evidence.page_url,
    source: descriptionMatch ? 'og_description' : textMatch ? 'visible_text' : 'profile_link',
    evidence: { description: evidence.description, article_text: evidence.article_text.slice(0, 2000), profile_link: linkUsername } };
}
