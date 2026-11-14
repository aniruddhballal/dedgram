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
