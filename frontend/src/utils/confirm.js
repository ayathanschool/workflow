// Simple confirm helper for destructive actions.
// Uses native window.confirm for reliability and to avoid UI regressions.

export function confirmDestructive({ title, lines }) {
  const t = String(title || 'Are you sure?');
  const details = Array.isArray(lines) ? lines.filter(Boolean).map(String) : [];
  const msg = details.length ? `${t}\n\n${details.join('\n')}` : t;

  // SSR safety
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(msg);
}
