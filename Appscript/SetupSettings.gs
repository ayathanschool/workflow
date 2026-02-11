/**
 * Setup Settings Sheet with required configuration
 * Run this ONCE to add the required settings if they don't exist
 */
function setupLessonPlanSettings() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Define required settings
    const requiredSettings = [
      {
        key: 'lessonplan_bulk_only',
        value: 'false',
        description: 'If true, disable single session prep - only allow bulk chapter preparation (all sessions together)'
      },
      {
        key: 'lessonplan_summary_first',
        value: 'true',
        description: 'If true, load scheme summary first (lighter payload) before full details'
      },
      {
        key: 'lessonplan_use_teacher_scheme_progress',
        value: 'true',
        description: 'If true, use TeacherSchemeProgress sheet for summary plannedSessions (falls back if missing)'
      },
      {
        key: 'LESSONPLAN_NOTIFY_ENABLED',
        value: 'false',
        description: 'If true, send lesson plan notification emails based on roles/emails/events'
      },
      {
        key: 'LESSONPLAN_NOTIFY_ROLES',
        value: 'h m',
        description: 'Comma-separated roles to receive lesson plan notifications'
      },
      {
        key: 'LESSONPLAN_NOTIFY_EMAILS',
        value: '',
        description: 'Comma-separated emails to receive lesson plan notifications (in addition to roles)'
      },
      {
        key: 'LESSONPLAN_NOTIFY_EVENTS',
        value: 'submitted,approved,rejected',
        description: 'Comma-separated lesson plan events that trigger notifications'
      }
    ];
    
    // Check and add missing settings
    requiredSettings.forEach(setting => {
      const exists = settingsData.find(row => (row.key || '').trim() === setting.key);
      
      if (!exists) {
        settingsSheet.appendRow([setting.key, setting.value, setting.description]);
      } else {
      }
    });
    
    return { success: true, message: 'Settings configured successfully' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Setup Period Times in Settings Sheet
 * Run this to configure period timings for the school day
 */
function setupPeriodTimes() {
  try {
    const settingsSheet = _getSheet('Settings');
    
    // Ensure Settings sheet has proper headers
    const expectedHeaders = ['key', 'value', 'description'];
    _ensureHeaders(settingsSheet, expectedHeaders);
    
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Define period times for Monday to Thursday (8 periods)
    const periodTimesWeekday = [
      { period: 1, start: "08:50", end: "09:35" },
      { period: 2, start: "09:35", end: "10:20" },
      { period: 3, start: "10:30", end: "11:15" },
      { period: 4, start: "11:15", end: "12:00" },
      { period: 5, start: "12:00", end: "12:45" },
      { period: 6, start: "13:15", end: "14:00" },
      { period: 7, start: "14:00", end: "14:40" },
      { period: 8, start: "14:45", end: "15:25" }
    ];
    
    // Define period times for Friday (8 periods)
    const periodTimesFriday = [
      { period: 1, start: "08:50", end: "09:35" },
      { period: 2, start: "09:35", end: "10:20" },
      { period: 3, start: "10:30", end: "11:15" },
      { period: 4, start: "11:15", end: "12:00" },
      { period: 5, start: "12:00", end: "12:45" },
      { period: 6, start: "13:15", end: "14:00" },
      { period: 7, start: "14:00", end: "14:40" },
      { period: 8, start: "14:45", end: "15:25" }
    ];
    
    // Check if period times already exist and update or create
    const weekdayKey = 'periodTimes (Monday to Thursday)';
    const fridayKey = 'periodTimes (Friday)';
    
    const existingWeekday = settingsData.find(row => (row.key || '').trim() === weekdayKey);
    const existingFriday = settingsData.find(row => (row.key || '').trim() === fridayKey);
    
    // Find or insert weekday period times
    if (existingWeekday) {
      const rowIndex = settingsData.indexOf(existingWeekday) + 2; // +2 because: +1 for header, +1 for 0-index
      settingsSheet.getRange(rowIndex, 1, 1, 3).setValues([[
        weekdayKey,
        JSON.stringify(periodTimesWeekday),
        'Period start and end times for Monday to Thursday'
      ]]);
    } else {
      settingsSheet.appendRow([
        weekdayKey,
        JSON.stringify(periodTimesWeekday),
        'Period start and end times for Monday to Thursday'
      ]);
    }
    
    // Find or insert Friday period times
    if (existingFriday) {
      const rowIndex = settingsData.indexOf(existingFriday) + 2;
      settingsSheet.getRange(rowIndex, 1, 1, 3).setValues([[
        fridayKey,
        JSON.stringify(periodTimesFriday),
        'Period start and end times for Friday'
      ]]);
    } else {
      settingsSheet.appendRow([
        fridayKey,
        JSON.stringify(periodTimesFriday),
        'Period start and end times for Friday'
      ]);
    }
    
    return { success: true, message: 'Period times configured successfully' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Setup Missing Daily Reports settings (HM-controlled)
 * Run once to add keys if they don't exist.
 */
function setupMissingDailyReportSettings() {
  try {
    const settingsSheet = _getSheet('Settings');
    const expectedHeaders = ['key', 'value', 'description'];
    _ensureHeaders(settingsSheet, expectedHeaders);

    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));

    const requiredSettings = [
      {
        key: 'MISSING_DAILY_REPORT_LOOKBACK_DAYS',
        value: '7',
        description: 'Teacher dashboard: default missing report range length (days), ending at yesterday'
      },
      {
        key: 'MISSING_DAILY_REPORT_ESCALATION_DAYS',
        value: '2',
        description: 'Teacher dashboard: show "Meet the HM" when missingDays > this value (missingDays = distinct dates with any missing period)'
      },
      {
        key: 'MISSING_DAILY_REPORT_MAX_RANGE_DAYS',
        value: '31',
        description: 'Teacher dashboard: maximum allowed custom date range length (days)'
      },
      {
        key: 'MISSING_DAILY_REPORT_ALLOW_CUSTOM_RANGE',
        value: 'true',
        description: 'Teacher dashboard: if false, hide from/to controls and always use default lookback range'
      }
    ];

    requiredSettings.forEach(setting => {
      const exists = settingsData.find(row => (row.key || '').trim() === setting.key);
      if (!exists) {
        settingsSheet.appendRow([setting.key, setting.value, setting.description]);
      } else {
      }
    });
    return { success: true, message: 'Missing daily report settings configured successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
