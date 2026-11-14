// Runs inside page.evaluate; keep all helpers inside this function.
export function engagementFromDocument({ shortcode } = {}) {
  const kindOf = (label) => {
    const normalized = String(label || '').trim().toLowerCase()
      .replace(/^[\d,.]+\s*[kmb]?\s*/i, '').replace(/[\s:：]*[\d,.]+\s*[kmb]?$/i, '').trim();
    if (/^(like|likes|unlike)$/.test(normalized)) return 'likes';
    if (/^(comment|comments)$/.test(normalized)) return 'comments';
    if (/^(repost|reposts|reshare|reshares)$/.test(normalized)) return 'reshares';
    if (/^(share|shares)$/.test(normalized)) return 'shares';
    return null;
  };
  const number = (text) => /^[\d]+(?:[,.]\d+)*\s*[KMB]?$/i.test(String(text || '').trim()) ? String(text).trim() : null;
  const permalink = (element) => [...element.querySelectorAll('a[href]')].some((link) => {
    try { return new URL(link.href).pathname.match(/\/(?:reel|reels|p)\/([\w-]+)/)?.[1] === shortcode; }
    catch { return false; }
  });
  const articles = [...document.querySelectorAll('article')];
  const explicit = [...document.querySelectorAll('[data-shortcode]')].find((element) => element.getAttribute('data-shortcode') === shortcode);
  let scope = explicit || articles.find(permalink) || articles[0] || document.querySelector('main') || document.body;
  if (!scope) return {};
  const markersIn = (element) => [...element.querySelectorAll('[aria-label]')]
    .filter((node) => kindOf(node.getAttribute('aria-label')));
  // When reels have no article elements, find a single action rail first.
  if (!explicit && !articles.length) {
    const first = markersIn(scope)[0];
    let rail = first?.parentElement;
    let found = null;
    while (rail && scope.contains(rail)) {
      const controls = new Map();
      for (const node of markersIn(rail)) {
        const kind = kindOf(node.getAttribute('aria-label'));
        const control = node.closest('button, [role="button"], a') || node;
        if (!controls.has(kind)) controls.set(kind, new Set());
        controls.get(kind).add(control);
      }
      if (controls.size >= 2 && [...controls.values()].every((values) => values.size === 1)) { found = rail; break; }
      rail = rail.parentElement;
    }
    if (!found) return { scope: 'unavailable', likes_visibility: 'unknown' };
    scope = found;
  }
  const ownArticle = scope.closest('article');
  const markers = markersIn(scope).filter((node) => !ownArticle || node.closest('article') === ownArticle);
  const result = { scope: 'reel_action_controls', availability: {} };
  const seen = new Set();
  for (const marker of markers) {
    const label = marker.getAttribute('aria-label');
    const kind = kindOf(label);
    if (seen.has(kind)) continue;
    seen.add(kind); // Never fill a missing count from a later recommended reel.
    const labelCount = label.match(/^([\d,.]+\s*[KMB]?)\s+\D+$/i)?.[1]
      || label.match(/^[A-Za-z]+[\s:：]+([\d,.]+\s*[KMB]?)$/i)?.[1];
    let raw = number(labelCount);
    const control = marker.closest('button, [role="button"], a') || marker;
    const candidates = [control, control.parentElement];
    if (!raw) for (const candidate of candidates) {
      if (!candidate || !scope.contains(candidate)) continue;
      const controls = new Set(markersIn(candidate).map((node) => kindOf(node.getAttribute('aria-label'))));
      if (controls.size !== 1 || !controls.has(kind)) continue;
      const numbers = (candidate.innerText || candidate.textContent || '').split(/\r?\n/).map(number).filter(Boolean);
      if (numbers.length === 1) { raw = numbers[0]; break; }
    }
    if (raw !== null) {
      result[kind] = { raw, source: 'dom_action_control', label };
      result.availability[kind] = { state: 'measured', evidence: label };
    } else {
      const nearby = (control.parentElement?.innerText || control.innerText || '').trim();
      const parent = control.parentElement;
      const isolated = parent && !parent.matches('article, main, body') && !parent.querySelector('h1, [data-caption]')
        && markersIn(parent).every(node => kindOf(node.getAttribute('aria-label')) === kind);
      const hidden = isolated && kind === 'likes' && /^(?:like count hidden|likes? (?:are )?hidden|only .{1,100} can see (?:the )?(?:total )?(?:number of )?likes?)\.?$/im.test(nearby);
      const disabled = isolated && kind === 'comments' && /^(?:comments are turned off|commenting is turned off|comments (?:are )?disabled)\.?$/im.test(nearby);
      result.availability[kind] = { state: hidden ? 'explicitly_hidden' : disabled ? 'disabled' : 'not_captured',
        evidence: hidden || disabled ? nearby.slice(0, 500) : 'Control located but no reliable numeric value parsed.' };
      if (kind === 'likes') result.likes_visibility = 'not_shown';
    }
  }
  return result;
}
