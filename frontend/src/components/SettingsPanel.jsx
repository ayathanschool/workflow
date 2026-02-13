import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { useToast } from '../hooks/useToast';

const formatJsonValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value || '');
  }
};

const buildFormState = (settings = {}) => ({
  lessonplanBulkOnly: !!settings.lessonplanBulkOnly,
  cascadeAutoEnabled: !!settings.cascadeAutoEnabled,
  dailyReportDeleteMinutes: String(settings.dailyReportDeleteMinutes ?? 0),
  allowBackfillReporting: !!settings.allowBackfillReporting,
  periodTimesWeekdayJson: formatJsonValue(settings.periodTimesWeekday || ''),
  periodTimesFridayJson: formatJsonValue(settings.periodTimesFriday || ''),
  periodTimesByClassJson: formatJsonValue(settings.periodTimesByClassRaw || settings.periodTimesByClass || ''),
  missingDailyReportLookbackDays: String(settings?.missingDailyReports?.lookbackDays ?? 7),
  missingDailyReportEscalationDays: String(settings?.missingDailyReports?.escalationDays ?? 2),
  missingDailyReportMaxRangeDays: String(settings?.missingDailyReports?.maxRangeDays ?? 31),
  missingDailyReportAllowCustomRange: settings?.missingDailyReports?.allowCustomRange !== false,
  lessonplanNotifyEnabled: !!settings.lessonplanNotifyEnabled,
  lessonplanNotifyRoles: String(settings.lessonplanNotifyRoles || '').trim(),
  lessonplanNotifyEmails: String(settings.lessonplanNotifyEmails || '').trim(),
  lessonplanNotifyEvents: String(settings.lessonplanNotifyEvents || '').trim()
});

const SettingsPanel = ({ user, settings, onSettingsUpdated }) => {
  const { success, error } = useToast();
  const [form, setForm] = useState(() => buildFormState(settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildFormState(settings));
  }, [settings]);

  const updateField = (field) => (e) => {
    const value = e && e.target ? e.target.value : '';
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateToggle = (field) => (e) => {
    const value = !!(e && e.target ? e.target.checked : false);
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setForm(buildFormState(settings));
  };

  const handleSave = async () => {
    if (!user || !user.email) {
      error('Missing user email for settings update.');
      return;
    }

    const jsonFields = [
      { label: 'Weekday period times', value: form.periodTimesWeekdayJson },
      { label: 'Friday period times', value: form.periodTimesFridayJson },
      { label: 'Class period overrides', value: form.periodTimesByClassJson }
    ];

    for (const field of jsonFields) {
      const raw = String(field.value || '').trim();
      if (!raw) continue;
      try {
        JSON.parse(raw);
      } catch (err) {
        error(`${field.label} JSON is invalid.`);
        return;
      }
    }

    const updates = [
      { key: 'lessonplan_bulk_only', value: form.lessonplanBulkOnly ? 'true' : 'false' },
      { key: 'cascade_auto_enabled', value: form.cascadeAutoEnabled ? 'true' : 'false' },
      { key: 'DAILY_REPORT_DELETE_MINUTES', value: String(form.dailyReportDeleteMinutes ?? 0).trim() },
      { key: 'allow_backfill_reporting', value: form.allowBackfillReporting ? 'true' : 'false' },
      { key: 'MISSING_DAILY_REPORT_LOOKBACK_DAYS', value: String(form.missingDailyReportLookbackDays ?? 7).trim() },
      { key: 'MISSING_DAILY_REPORT_ESCALATION_DAYS', value: String(form.missingDailyReportEscalationDays ?? 2).trim() },
      { key: 'MISSING_DAILY_REPORT_MAX_RANGE_DAYS', value: String(form.missingDailyReportMaxRangeDays ?? 31).trim() },
      { key: 'MISSING_DAILY_REPORT_ALLOW_CUSTOM_RANGE', value: form.missingDailyReportAllowCustomRange ? 'true' : 'false' },
      { key: 'periodTimes (Monday to Thursday)', value: String(form.periodTimesWeekdayJson || '').trim() },
      { key: 'periodTimes (Friday)', value: String(form.periodTimesFridayJson || '').trim() },
      { key: 'periodTimesByClass', value: String(form.periodTimesByClassJson || '').trim() },
      { key: 'LESSONPLAN_NOTIFY_ENABLED', value: form.lessonplanNotifyEnabled ? 'true' : 'false' },
      { key: 'LESSONPLAN_NOTIFY_ROLES', value: String(form.lessonplanNotifyRoles || '').trim() },
      { key: 'LESSONPLAN_NOTIFY_EMAILS', value: String(form.lessonplanNotifyEmails || '').trim() },
      { key: 'LESSONPLAN_NOTIFY_EVENTS', value: String(form.lessonplanNotifyEvents || '').trim() }
    ];

    try {
      setSaving(true);
      await api.updateAppSettings(user.email, updates, user.name || '');
      const refreshed = await api.getAppSettings();
      if (typeof onSettingsUpdated === 'function') {
        onSettingsUpdated(refreshed);
      }
      success('Settings updated.');
    } catch (err) {
      error(String(err?.message || err || 'Failed to update settings.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Manage lesson plan rules and notification preferences.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lesson Plan Rules</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                id="lessonplan-bulk-only"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                checked={form.lessonplanBulkOnly}
                onChange={updateToggle('lessonplanBulkOnly')}
              />
              <label htmlFor="lessonplan-bulk-only" className="text-sm text-gray-700 dark:text-gray-300">
                Bulk-only preparation
              </label>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reporting Controls</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                id="cascade-auto-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                checked={form.cascadeAutoEnabled}
                onChange={updateToggle('cascadeAutoEnabled')}
              />
              <label htmlFor="cascade-auto-enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Auto-cascade lesson plans
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="allow-backfill-reporting"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                checked={form.allowBackfillReporting}
                onChange={updateToggle('allowBackfillReporting')}
              />
              <label htmlFor="allow-backfill-reporting" className="text-sm text-gray-700 dark:text-gray-300">
                Allow backfill reporting
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily report delete minutes</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                type="number"
                min="0"
                value={form.dailyReportDeleteMinutes}
                onChange={updateField('dailyReportDeleteMinutes')}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Period Timings</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Paste JSON arrays (period, start, end). Class overrides are optional.</p>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weekday timings (Mon-Thu)</label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono min-h-[140px]"
                placeholder='[ { "period": 1, "start": "08:50", "end": "09:35" } ]'
                value={form.periodTimesWeekdayJson}
                onChange={updateField('periodTimesWeekdayJson')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Friday timings</label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono min-h-[140px]"
                placeholder='[ { "period": 1, "start": "08:50", "end": "09:35" } ]'
                value={form.periodTimesFridayJson}
                onChange={updateField('periodTimesFridayJson')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Class-specific overrides (optional)</label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono min-h-[160px]"
                placeholder={'{\n  "STD 1": {\n    "weekday": [ { "period": 1, "start": "08:50", "end": "09:35" } ],\n    "friday": [ { "period": 1, "start": "08:50", "end": "09:35" } ]\n  }\n}'}
                value={form.periodTimesByClassJson}
                onChange={updateField('periodTimesByClassJson')}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Missing Daily Reports</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lookback days</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                type="number"
                min="1"
                value={form.missingDailyReportLookbackDays}
                onChange={updateField('missingDailyReportLookbackDays')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Escalation days</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                type="number"
                min="0"
                value={form.missingDailyReportEscalationDays}
                onChange={updateField('missingDailyReportEscalationDays')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max range days</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                type="number"
                min="1"
                value={form.missingDailyReportMaxRangeDays}
                onChange={updateField('missingDailyReportMaxRangeDays')}
              />
            </div>
            <div className="flex items-center gap-3 mt-6 md:mt-0">
              <input
                id="missing-daily-report-allow-custom"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                checked={form.missingDailyReportAllowCustomRange}
                onChange={updateToggle('missingDailyReportAllowCustomRange')}
              />
              <label htmlFor="missing-daily-report-allow-custom" className="text-sm text-gray-700 dark:text-gray-300">
                Allow custom date ranges
              </label>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lesson Plan Notifications</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                id="lessonplan-notify-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                checked={form.lessonplanNotifyEnabled}
                onChange={updateToggle('lessonplanNotifyEnabled')}
              />
              <label htmlFor="lessonplan-notify-enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Enable notifications
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notify roles</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="h m, admin"
                value={form.lessonplanNotifyRoles}
                onChange={updateField('lessonplanNotifyRoles')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notify emails</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="principal@school.org"
                value={form.lessonplanNotifyEmails}
                onChange={updateField('lessonplanNotifyEmails')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notify events</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="submitted, approved, rejected"
                value={form.lessonplanNotifyEvents}
                onChange={updateField('lessonplanNotifyEvents')}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
            onClick={handleReset}
            disabled={saving}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
