import React, { useMemo, useState } from 'react';

/**
 * ReopenedReportBanner
 * Shows a dismissible banner listing daily reports that were reopened by HM.
 * A report is considered reopened if it has a reopenReason and is not verified again.
 *
 * Props:
 *  - reports: Array of report objects containing at least:
 *      id | reportId, class, subject, period, reopenReason, reopenedAt, verified
 *  - onOpenReport(report): optional callback when user clicks Open
 *  - maxVisible (number): limit list items shown before "+ X more" summary (default 3)
 *  - onDismiss(report): optional callback when a single report is dismissed
 *  - className: extra class names for outer container
 */
export default function ReopenedReportBanner({
  reports = [],
  onOpenReport,
  maxVisible = 3,
  onDismiss,
  className = ''
}) {
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  const reopened = useMemo(() => {
    return reports.filter(r => {
      const verifiedFlag = String(r.verified || '').trim().toLowerCase() === 'true';
      const reason = (r.reopenReason || '').trim();
      const id = r.id || r.reportId || buildCompositeId(r);
      return reason && !verifiedFlag && !dismissedIds.has(id);
    });
  }, [reports, dismissedIds]);

  if (!reopened.length) return null;

  const visible = reopened.slice(0, maxVisible);
  const hiddenCount = reopened.length - visible.length;

  function buildCompositeId(r) {
    const parts = [r.date, r.class, r.subject, r.period, (r.teacherEmail || '').toLowerCase()].map(v => String(v || '').trim());
    return parts.join('|');
  }

  function dismissReport(r) {
    const id = r.id || r.reportId || buildCompositeId(r);
    dismissedIds.add(id);
    setDismissedIds(new Set(dismissedIds));
    if (onDismiss) onDismiss(r);
  }

  return (
    <div className={`mb-4 rounded-md border border-amber-300 bg-amber-50 shadow-sm overflow-hidden ${className}`}>      
      <div className="flex items-start gap-3 p-4">
        <div className="text-xl leading-none">⚠️</div>
        <div className="flex-1">
          <div className="font-semibold text-amber-900 text-sm mb-1">
            {reopened.length === 1 ? 'A daily report was reopened for correction' : `${reopened.length} daily reports were reopened for correction`}
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {visible.map(r => {
              const id = r.id || r.reportId || buildCompositeId(r);
              const reopenedAt = r.reopenedAt ? formatDateTime(r.reopenedAt) : '';
              return (
                <li key={id} className="text-amber-800 text-sm">
                  <span className="font-medium">{r.class} / {r.subject} / Period {normalizePeriod(r.period)}</span>{' — '}
                  <em>{r.reopenReason || 'No reason given'}</em>
                  {reopenedAt && <span className="text-amber-700 ml-1">({reopenedAt})</span>}
                  <div className="inline-flex ml-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReport && onOpenReport(r)}
                      className="px-2 py-0.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 focus:outline-none"
                    >Open</button>
                    <button
                      type="button"
                      onClick={() => dismissReport(r)}
                      className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 hover:bg-amber-200 focus:outline-none"
                    >Dismiss</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 && (
            <div className="text-xs text-amber-700 mt-2">+ {hiddenCount} more reopened report{hiddenCount > 1 ? 's' : ''}</div>
          )}
          <div className="mt-3 text-xs text-amber-700 flex flex-wrap gap-2">
            <span>Action required: review & re-submit the reopened report(s).</span>
            <span className="opacity-70">Resolved once re-verified.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { hour12: false });
  } catch { return ''; }
}

function normalizePeriod(p) {
  if (p == null) return '';
  return String(p).replace(/^Period\s*/i, '').trim();
}
