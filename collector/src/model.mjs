import { dayFromDescription, normalizeReelDate, resolveReelDate } from '../../website/lib/reel-date.mjs';
export { dayFromDescription, normalizeReelDate };

export const now = () => new Date().toISOString();
export const itemAnalysisHandled = (item) => ['complete', 'archived', 'age_restricted'].includes(item?.status) && !item.last_error;
export const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').trim();

export function count(raw) {
  const match = clean(raw).replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase()] || 1;
  const value = Math.round(Number(match[1]) * scale);
  return Number.isSafeInteger(value) ? { value, raw: clean(raw), approximate: scale !== 1 } : null;
}

function metric(text, names) {
  for (const line of String(text).split(/\r?\n/)) for (const name of names) {
    const forward = new RegExp(`(\\d[\\d,.]*\\s*[KMB]?)[ \\t]+${name}\\b`, 'i').exec(line);
    const reverse = new RegExp(`${name}[ \\t]*[:：]?[ \\t]*(\\d[\\d,.]*\\s*[KMB]?)\\b`, 'i').exec(line);
    const parsed = count((forward || reverse)?.[1]);
    if (parsed) return parsed;
  }
  return null;
}

function localizedMetric(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escaped}[!！]?[」”"']?[ \\t]*[:：]?[ \\t]*(\\d[\\d,.]*\\s*[KMB]?)(?:件)?`, 'i').exec(text);
    const parsed = count(match?.[1]);
    if (parsed) return parsed;
  }
  return null;
}

function afterLabel(text, label) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const i = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  return i >= 0 && lines[i + 1] ? lines[i + 1] : null;
}

function bioFromDescription(description) {
  const match = String(description || '').match(/\bon Instagram:\s*(.*)$/is);
  if (!match) return null;
  let bio = match[1].trim();
  if (bio.startsWith('"') && bio.endsWith('"')) bio = bio.slice(1, -1);
  return bio.replace(/\\"/g, '"').trim() || null;
}

export function profileFromSnapshot(username, snapshot) {
  const header = snapshot.header_text || '';
  const lines = header.split(/\r?\n/).map(clean).filter(Boolean);
  const statIndex = lines.findIndex((line) => /\bposts?\b/i.test(line) && metric(line, ['posts?']));
  const bioStart = lines.findIndex((line) => /\bfollowing\b/i.test(line));
  const bioStop = lines.findIndex((line, i) => i > bioStart && /^(more|see translation|follow|following|message|contact|edit profile|share profile|posts|reels|tagged)$/i.test(line));
  const bioLines = bioStart >= 0 ? lines.slice(bioStart + 1, bioStop >= 0 ? bioStop : undefined) : [];
  const category = snapshot.category || bioLines.find((line) => /^(reel creator|digital creator|video creator|blogger|editor|artist|public figure|entrepreneur|personal blog)\s*•?$/i.test(line))?.replace(/\s*•$/, '') || null;
  const bioContent = bioLines.filter((line) => line !== category && line !== `${category} •` && !/^AI-generated profile$/i.test(line));
  const about = snapshot.about_text || '';
  const description = snapshot.description || '';
  const metadataBio = bioFromDescription(description);
  const headerBio = bioContent.length ? bioContent.join('\n') : null;
  const selectedBio = metadataBio && lines.some((line) => /^(more|see translation)$/i.test(line)) ? metadataBio : headerBio || metadataBio;
  const former = afterLabel(about, 'Former usernames');
  const headerPosts = metric(header, ['posts?']);
  const metadataPosts = metric(description, ['posts?']);
  const headerFollowing = metric(header, ['following']);
  const metadataFollowing = metric(description, ['following']);
  const followingConflict = headerFollowing && metadataFollowing && headerFollowing.value !== metadataFollowing.value;
  const exactFollowers = count(snapshot.stat_evidence?.followers?.exact_title);
  const headerFollowers = metric(header, ['followers?']);
  const metadataFollowers = metric(description, ['followers?']);
  const observedAt = now();
  return {
    username,
    url: `https://www.instagram.com/${username}/`,
    fetched_at: observedAt,
    display_name: statIndex > 1 ? lines.slice(1, statIndex).join(' ') : null,
    bio: selectedBio,
    posts_count: headerPosts || metadataPosts,
    posts_count_observed_at: headerPosts || metadataPosts ? observedAt : null,
    followers_count: exactFollowers ? { ...exactFollowers, source: 'header_title' }
      : headerFollowers ? { ...headerFollowers, source: 'header_text' } : null,
    following_count: headerFollowing ? { ...headerFollowing, source: 'header_text' }
      : metadataFollowing ? { ...metadataFollowing, source: 'page_metadata' } : null,
    count_evidence: {
      followers: { header: headerFollowers, exact_title: exactFollowers, metadata: metadataFollowers },
      following: { header: headerFollowing, metadata: metadataFollowing, conflict: Boolean(followingConflict) },
      posts: { header: headerPosts, metadata: metadataPosts }
    },
    category,
    ai_generated_profile: lines.some((line) => /^AI-generated profile$/i.test(line)),
    profile_picture_url: snapshot.profile_picture_url || null,
    date_joined: afterLabel(about, 'Date joined'),
    account_based_in: afterLabel(about, 'Account based in'),
    former_usernames_count: count(former),
    raw: { header_text: header, about_text: about, description, stat_evidence: snapshot.stat_evidence || {} },
    issues: [
      ...(!header ? ['profile header unavailable'] : []),
      ...(!about ? ['About this account unavailable'] : []),
      ...(!headerPosts && !metadataPosts ? ['Post count unavailable in the profile header and page metadata.'] : []),
      ...(!exactFollowers && !headerFollowers ? ['Follower count unavailable in the profile header.'] : []),
      ...(!headerFollowing && !metadataFollowing ? ['Following count unavailable in the profile header and page metadata.'] : [])
    ]
  };
}

export function profileHeaderComplete(profile) {
  return Boolean(profile?.fetched_at && profile?.raw?.header_text?.trim()
    && profile.posts_count && profile.followers_count && profile.following_count);
}

export function exactPostCount(profile) {
  const evidence = profile?.count_evidence?.posts;
  const metric = evidence ? evidence.header : profile?.raw?.header_text ? profile?.posts_count : null;
  return metric && !metric.approximate && Number.isSafeInteger(metric.value) && metric.value >= 0
    ? metric.value : null;
}

export function postCountError(profile) {
  if (exactPostCount(profile) !== null) return null;
  const displayed = profile?.count_evidence?.posts?.header || profile?.posts_count;
  return displayed?.approximate
    ? `Instagram displays ${displayed.raw} posts, a rounded value; the exact count is unavailable.`
    : 'Exact post count unavailable in the Instagram profile header.';
}

export function profileLevelComplete(profile, discovery) {
  return profileHeaderComplete(profile) && exactPostCount(profile) !== null
    && gridCount(discovery?.reel) !== null;
}

export function gridCount(grid) {
  return grid?.complete === true && Array.isArray(grid.items) ? grid.items.length : null;
}

export function gridCountError(grid) {
  if (gridCount(grid) !== null) return null;
  if (!grid) return 'Grid has not been scanned.';
  return grid.error || (grid.complete ? 'The scan ended without a saved item list.' : 'Grid scan did not finish.');
}

export function canonicalItemUrl(href) {
  try {
    const url = new URL(href, 'https://www.instagram.com');
    if (!['www.instagram.com', 'instagram.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) return null;
    const kind = match[1] === 'p' ? 'post' : 'reel';
    return { kind, shortcode: match[2], url: `https://www.instagram.com/${kind === 'post' ? 'p' : 'reel'}/${match[2]}/` };
  } catch { return null; }
}


export function reasonsForMissing(missing, item = {}) {
  const defaults = {
    date: 'No readable timestamp or calendar date was found on the content page or in its metadata.',
    likes: 'No readable like count was found on the content page or in its metadata.',
    comments: 'No readable comment count was found on the content page or in its metadata.',
    views: item.kind === 'reel'
      ? 'No readable view count was found on the reel page or profile grid.'
      : 'No readable view count was found on the content page.'
  };
  return Object.fromEntries(missing.map((field) => [field,
    field === 'likes' && item.likes_visibility === 'not_shown' ? 'The like control displayed no numeric like count; nearby comment or reshare counts are not likes.'
      : field === 'views' && item.grid_views_issue ? item.grid_views_issue : defaults[field] || 'No readable value was found.']));
}

function jsonLdData(scripts) {
  for (const source of scripts || []) {
    try {
      const root = JSON.parse(source);
      const nodes = Array.isArray(root) ? root : root['@graph'] || [root];
      for (const item of nodes) {
        if (item && (item.uploadDate || item.datePublished || item.caption || item.description)) return item;
      }
    } catch { /* A malformed script is just unavailable evidence. */ }
  }
  return {};
}

export function itemFromSnapshot(item, snapshot) {
  const structured = jsonLdData(snapshot.json_ld);
  const description = snapshot.og_description || '';
  const text = snapshot.article_text || '';
  const aria = snapshot.aria_text || '';
  // A caption may mention counts; only parse the metadata's engagement summary.
  const localizedDate = [...description.matchAll(/\d{4}年\d{1,2}月\d{1,2}日/g)].at(-1);
  const engagementDescription = localizedDate ? description.slice(localizedDate.index + localizedDate[0].length)
    : description.split(/\s[-–]\s/).findLast((part) => /^\d[\d,.]*\s*[KMB]?\s+(likes?|comments?|views?|plays?|reposts?|reshares?)\b|^Liked by\b/i.test(part.trim())) || '';
  const fields = [engagementDescription, aria, text];
  const findMetric = (names, includeBody = false) => {
    // Unscoped body/ARIA text can include comments and recommended reels.
    for (let i = 0; i < (includeBody ? fields.length : 1); i++) {
      const parsed = metric(fields[i], names);
      if (parsed) return { ...parsed, source: ['og_description', 'aria_label', 'visible_text'][i] };
    }
    return null;
  };
  const controlMetric = (kind) => {
    const evidence = snapshot.engagement?.[kind];
    const parsed = count(evidence?.raw);
    return parsed ? { ...parsed, source: 'dom_action_control', label: evidence.label } : null;
  };
  const localizedLikes = localizedMetric(engagementDescription, ['いいね']);
  let likes = controlMetric('likes') || (localizedLikes ? { ...localizedLikes, source: 'og_description_localized' } : findMetric(['likes?']));
  if (!likes) {
    const others = /\band\s+(\d[\d,.]*\s*[KMB]?)\s+others?\b/i.exec(engagementDescription);
    const parsed = count(others?.[1]);
    if (parsed) likes = { ...parsed, value: parsed.value + 1, source: 'others_plus_one' };
  }
  const localizedComments = localizedMetric(engagementDescription, ['コメント']);
  const comments = findMetric(['comments?']);
  const resolvedComments = controlMetric('comments') || (localizedComments ? { ...localizedComments, source: 'og_description_localized' } : comments);
  const reshares = controlMetric('reshares') || findMetric(['reposts?', 'reshares?']);
  const shares = controlMetric('shares');
  const views = findMetric(['views?', 'plays?']) || (snapshot.grid_views_raw
    ? { ...count(snapshot.grid_views_raw), source: 'profile_grid' } : null) || findMetric(['views?', 'plays?'], true);
  const dateEvidence = resolveReelDate({ ...snapshot, json_ld: structured });
  const date = dateEvidence?.date || null;
  const date_precision = dateEvidence?.date_precision || null;
  const ogCaption = description.match(/:\s*[“"']([\s\S]*)[”"']\.?\s*$/)?.[1]
    || description.match(/:\s*([\s\S]+)$/)?.[1]?.trim();
  const caption = snapshot.caption || structured.caption || structured.description || ogCaption || null;
  const hashtags = [...new Set((caption || '').match(/#[\p{L}\p{N}_]+/gu) || [])];
  const mentions = [...new Set((caption || '').match(/@[A-Za-z0-9._]+/g) || [])];
  const missing = [!date && 'date', !likes && 'likes', !resolvedComments && 'comments', !views && 'views'].filter(Boolean);
  return {
    ...item,
    fetched_at: now(),
    status: missing.length ? 'partial' : 'complete',
    date,
    date_precision,
    date_source: dateEvidence?.date_source || null,
    caption,
    hashtags,
    mentions,
    likes,
    comments: resolvedComments,
    reshares,
    shares,
    likes_visibility: snapshot.engagement?.likes_visibility || (likes ? 'count_available' : 'unknown'),
    views,
    thumbnail_url: snapshot.og_image || null,
    media_url: snapshot.og_video || null,
    missing,
    missing_reasons: reasonsForMissing(missing, { ...item, likes_visibility: snapshot.engagement?.likes_visibility }),
    raw: { description, article_text: text.slice(0, 20000), aria_text: aria.slice(0, 10000), json_ld: structured,
      engagement: snapshot.engagement || null }
  };
}

function observedMetric(metricValue, observedAt) {
  return metricValue ? { ...metricValue, observed_at: observedAt } : null;
}

export function publicDetailsFromSnapshot(item, snapshot, observedAt = now()) {
  const parsed = itemFromSnapshot(item, snapshot);
  const savedDate = resolveReelDate(item);
  if (savedDate && (!parsed.date || item.manual_verification?.date || savedDate.date_precision === 'timestamp'
    || parsed.date_precision !== 'timestamp')) Object.assign(parsed, savedDate);
  const localizedDate = String(snapshot.og_description || '').match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
  return {
    observed_at: observedAt,
    date: parsed.date || null,
    date_precision: parsed.date_precision || null,
    date_source: parsed.date_source || (parsed.date ? 'saved_record' : null),
    date_timezone: parsed.date_source === 'user_manual_check' ? item.manual_verification?.date?.timezone || item.date_timezone || null : null,
    date_original: localizedDate?.[1] || null,
    date_translation: localizedDate ? dayFromDescription(snapshot.og_description) : null,
    caption: parsed.caption || null,
    hashtags: parsed.hashtags || [],
    mentions: parsed.mentions || [],
    likes: observedMetric(parsed.likes, observedAt),
    comments: observedMetric(parsed.comments, observedAt),
    reshares: observedMetric(parsed.reshares, observedAt),
    shares: observedMetric(parsed.shares, observedAt),
    likes_visibility: parsed.likes_visibility,
    views: observedMetric(parsed.views, observedAt),
    thumbnail_url: parsed.thumbnail_url || null,
    media_url: parsed.media_url || null,
    available_fields: ['date', 'caption', 'likes', 'comments', 'views', 'reshares', 'shares', 'thumbnail_url', 'media_url']
      .filter((field) => parsed[field] != null),
    raw: {
      description: snapshot.og_description || '',
      page_title: snapshot.page_title || '',
      meta: snapshot.meta || {},
      article_text: (snapshot.article_text || '').slice(0, 20000),
      aria_text: (snapshot.aria_text || '').slice(0, 10000),
      json_ld: parsed.raw?.json_ld || {},
      engagement: snapshot.engagement || null,
      json_ld_scripts: (snapshot.json_ld || []).map((source) => String(source).slice(0, 10000)).slice(0, 20)
    }
  };
}
