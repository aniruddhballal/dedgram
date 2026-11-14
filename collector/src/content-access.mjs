export function contentBarrier(text) {
  const value = String(text || '');
  if (/age[- ]restricted content|must be (?:\d+|older)|not old enough|confirm your age|verify your age|based on your age or account settings/i.test(value)) return 'age_restricted';
  if (/log in to (?:continue|see|view)|log in or sign up|login required|security checkpoint|checkpoint_required/i.test(value)) return 'login_or_checkpoint';
  if (/^\s*sensitive content|this (?:video|reel|content) may contain|sensitive content warning|graphic or violent content/im.test(value)) return 'sensitive_content';
  return null;
}

export function confirmedMetricAbsence(record, field) {
  const evidence = record.raw?.engagement?.availability?.[field];
  return record.raw?.capture_checks?.access_clear === true
    && record.raw.capture_checks.stable === true
    && ['explicitly_hidden', 'disabled'].includes(evidence?.state)
    && Boolean(evidence?.evidence);
}

export function metricPanelEvidence(text, field) {
  const value = String(text || '');
  if (field === 'likes') {
    const message = value.match(/(?:Only\s+)?[\w.]+ can see the total number of people who liked this post\.?/i)?.[0];
    return message ? { state: 'explicitly_hidden', evidence: message } : null;
  }
  if (field === 'comments') {
    const disabled = value.match(/comments are turned off|commenting is turned off/i)?.[0];
    if (disabled) return { state: 'disabled', evidence: disabled };
    if (/^\s*(?:Close\s*)?Comments\s*No comments yet\./i.test(value)) return { state: 'measured', evidence: 'No comments yet.', raw: '0' };
  }
  return null;
}
