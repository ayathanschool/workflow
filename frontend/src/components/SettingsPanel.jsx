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
  
  // Holiday Management State
  const [holidays, setHolidays] = useState([]);
  const [affectedLessons, setAffectedLessons] = useState([]);
  const [recentCascades, setRecentCascades] = useState([]);
  const [holidayReason, setHolidayReason] = useState('');
  const [holidayDate, setHolidayDate] = useState(() => {
    // Default to today
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isDeclaringHoliday, setIsDeclaringHoliday] = useState(false);
  const [showHolidayPreview, setShowHolidayPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    setForm(buildFormState(settings));
  }, [settings]);
  
  // Load holidays and cascades on mount
  useEffect(() => {
    if (user && user.email) {
      loadHolidayData();
    }
  }, [user]);
  
  const loadHolidayData = async () => {
    try {
      const [holidaysData, cascadesData] = await Promise.all([
        api.getUndeclaredHolidays(true),
        api.getRecentCascades(5, user.email)
      ]);
      setHolidays(holidaysData?.holidays || []);
      setRecentCascades(cascadesData?.cascades || []);
    } catch (err) {
      console.error('Failed to load holiday data:', err);
    }
  };
  
  const checkAffectedLessons = async () => {
    if (!user || !user.email) return;
    
    setLoadingPreview(true);
    try {
      const result = await api.getAffectedLessonPlans(holidayDate, user.email);
      setAffectedLessons(result?.affectedLessons || []);
      setShowHolidayPreview(true);
    } catch (err) {
      error('Failed to load affected lessons');
    } finally {
      setLoadingPreview(false);
    }
  };
  
  const handleDeclareHoliday = async () => {
    if (!user || !user.email) {
      error('User email not found');
      return;
    }
    
    if (!holidayReason.trim()) {
      error('Please enter a reason for the holiday');
      return;
    }
    
    if (!holidayDate) {
      error('Please select a date');
      return;
    }
    
    setIsDeclaringHoliday(true);
    try {
      const result = await api.declareHoliday(
        holidayDate,
        holidayReason,
        user.email,
        user.name || ''
      );
      
      if (result && result.ok) {
        const cascaded = result.cascadeResult?.affectedCount || 0;
        const errors = result.cascadeResult?.errorCount || 0;
        
        if (errors > 0) {
          success(`Holiday declared for ${holidayDate}. ${cascaded} lessons cascaded, ${errors} had errors.`);
        } else {
          success(`Holiday declared successfully! ${cascaded} lessons rescheduled to next day.`);
        }
        
        // Reset form and reload data
        setHolidayReason('');
        setHolidayDate(new Date().toISOString().split('T')[0]);
        setShowHolidayPreview(false);
        await loadHolidayData();
      } else {
        error(result?.error || 'Failed to declare holiday');
      }
    } catch (err) {
      error(String(err?.message || err || 'Failed to declare holiday'));
    } finally {
      setIsDeclaringHoliday(false);
    }
  };
  
  const handleUndoCascade = async (cascadeId) => {
    if (!user || !user.email) return;
    if (!confirm('Undo this cascade operation? Lessons will be restored to their original dates/periods.')) return;
    
    try {
      const result = await api.undoCascade(cascadeId, user.email, user.name || '');
      if (result && result.ok) {
        success(`Cascade undone. ${result.restoredCount || 0} lessons restored.`);
        await loadHolidayData();
      } else {
        error(result?.error || 'Failed to undo cascade');
      }
    } catch (err) {
      error(String(err?.message || err || 'Failed to undo cascade'));
    }
  };

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

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            🏖️ Holiday Management
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Declare sudden holidays and automatically cascade lesson plans to the next available day
          </p>
          
          <div className="mt-4 space-y-4">
            {/* Declare Holiday Section */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Declare Holiday
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Sudden rain, Emergency, National holiday"
                    className="w-full rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={holidayReason}
                    onChange={(e) => setHolidayReason(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={checkAffectedLessons}
                    disabled={loadingPreview || !holidayReason.trim() || !holidayDate}
                    className="px-4 py-2 rounded-md border border-blue-600 text-blue-600 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                  >
                    {loadingPreview ? 'Loading...' : 'Preview Impact'}
                  </button>
                  
                  <button
                    onClick={handleDeclareHoliday}
                    disabled={isDeclaringHoliday || !holidayReason.trim() || !holidayDate}
                    className="px-4 py-2 rounded-md bg-orange-600 text-white text-sm hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isDeclaringHoliday ? 'Declaring...' : '⚠️ Declare Holiday & Cascade'}
                  </button>
                </div>
                
                {showHolidayPreview && affectedLessons.length > 0 && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      📋 {affectedLessons.length} lesson plans will be rescheduled:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {affectedLessons.slice(0, 10).map((lesson, idx) => (
                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                          • {lesson.class} - {lesson.subject} (P{lesson.period}) - {lesson.teacher}
                        </div>
                      ))}
                      {affectedLessons.length > 10 && (
                        <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                          ... and {affectedLessons.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {showHolidayPreview && affectedLessons.length === 0 && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      ✓ No lesson plans scheduled for {holidayDate}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Recent Holidays */}
            {holidays.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Recent Holidays
                </h3>
                <div className="space-y-2">
                  {holidays.slice(0, 5).map((holiday, idx) => (
                    <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="text-gray-400">📅</span>
                      <span className="font-medium">{holiday.date}</span>
                      <span>-</span>
                      <span>{holiday.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Recent Cascades */}
            {recentCascades.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Recent Cascade Operations
                </h3>
                <div className="space-y-2">
                  {recentCascades.map((cascade, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{new Date(cascade.cascadeDate).toLocaleDateString()}</span>
                        <span className="mx-2">-</span>
                        <span>{cascade.lessons?.length || 0} lessons</span>
                      </div>
                      {cascade.status === 'cascaded' && (
                        <button
                          onClick={() => handleUndoCascade(cascade.cascadeId)}
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
