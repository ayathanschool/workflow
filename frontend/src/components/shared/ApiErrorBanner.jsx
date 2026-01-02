import React from 'react';
import { XCircle, X } from 'lucide-react';

function formatLocalTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Global API error banner/toast.
 * Accepts either a string message or an object:
 * { message, requestId, time, url, status }
 */
export default function ApiErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  const normalized = typeof error === 'string' ? { message: error } : (error || {});
  const message = String(normalized.message || 'Request failed');
  const requestId = normalized.requestId ? String(normalized.requestId) : '';
  const time = normalized.time ? String(normalized.time) : '';

  return (
    <div className="fixed top-4 right-4 z-[2000] max-w-[92vw] sm:max-w-md">
      <div className="bg-red-50 text-red-900 border border-red-200 px-4 py-3 rounded-lg shadow flex gap-3">
        <div className="mt-0.5">
          <XCircle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Something went wrong</div>
          <div className="text-sm break-words">{message}</div>
          {(requestId || time) && (
            <div className="mt-1 text-xs text-red-700/80">
              {requestId ? <>Ref: <span className="font-mono">{requestId}</span></> : null}
              {requestId && time ? <span className="mx-1">•</span> : null}
              {time ? <>Time: {formatLocalTime(time)}</> : null}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="self-start p-1 rounded hover:bg-red-100"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4 text-red-700" />
        </button>
      </div>
    </div>
  );
}
