/**
 * Setup Settings Sheet with required configuration
 * Run this ONCE to add the required settings if they don't exist
 */
function setupLessonPlanSettings() {
  try {
    Logger.log('=== SETTING UP LESSON PLAN SETTINGS ===');
    
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Define required settings
    const requiredSettings = [
      {
        key: 'lessonplan_preparation_day',
        value: 'Monday',
        description: 'Day when teachers can submit lesson plans'
      },
      {
        key: 'lessonplan_deferred_days',
        value: '0',
        description: 'Days to skip before showing periods (0 = show from today)'
      },
      {
        key: 'lessonplan_days_ahead',
        value: '7',
        description: 'Total days to show in period selection'
      },
      {
        key: 'lessonplan_bulk_only',
        value: 'false',
        description: 'If true, disable single session prep - only allow bulk chapter preparation (all sessions together)'
      }
    ];
    
    // Check and add missing settings
    requiredSettings.forEach(setting => {
      const exists = settingsData.find(row => (row.key || '').trim() === setting.key);
      
      if (!exists) {
        Logger.log(`❌ Missing: ${setting.key} - Adding it now...`);
        settingsSheet.appendRow([setting.key, setting.value, setting.description]);
        Logger.log(`✅ Added: ${setting.key} = ${setting.value}`);
      } else {
        Logger.log(`✅ Found: ${setting.key} = ${exists.value}`);
      }
    });
    
    Logger.log('\n=== SETUP COMPLETE ===');
    Logger.log('Your Settings sheet now has:');
    Logger.log('- lessonplan_preparation_day (controls WHEN to submit)');
    Logger.log('- lessonplan_deferred_days (controls START date)');
    Logger.log('- lessonplan_days_ahead (controls how many days to show)');
    Logger.log('\nYou can change these values directly in the Settings sheet.');
    
    return { success: true, message: 'Settings configured successfully' };
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Setup Period Times in Settings Sheet
 * Run this to configure period timings for the school day
 */
function setupPeriodTimes() {
  try {
    Logger.log('=== SETTING UP PERIOD TIMES ===');
    
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
      Logger.log(`✅ Updating existing weekday period times`);
      const rowIndex = settingsData.indexOf(existingWeekday) + 2; // +2 because: +1 for header, +1 for 0-index
      settingsSheet.getRange(rowIndex, 1, 1, 3).setValues([[
        weekdayKey,
        JSON.stringify(periodTimesWeekday),
        'Period start and end times for Monday to Thursday'
      ]]);
    } else {
      Logger.log(`❌ Missing weekday period times - Adding now...`);
      settingsSheet.appendRow([
        weekdayKey,
        JSON.stringify(periodTimesWeekday),
        'Period start and end times for Monday to Thursday'
      ]);
    }
    
    // Find or insert Friday period times
    if (existingFriday) {
      Logger.log(`✅ Updating existing Friday period times`);
      const rowIndex = settingsData.indexOf(existingFriday) + 2;
      settingsSheet.getRange(rowIndex, 1, 1, 3).setValues([[
        fridayKey,
        JSON.stringify(periodTimesFriday),
        'Period start and end times for Friday'
      ]]);
    } else {
      Logger.log(`❌ Missing Friday period times - Adding now...`);
      settingsSheet.appendRow([
        fridayKey,
        JSON.stringify(periodTimesFriday),
        'Period start and end times for Friday'
      ]);
    }
    
    Logger.log('\n=== PERIOD TIMES SETUP COMPLETE ===');
    Logger.log('Period times have been configured in the Settings sheet.');
    Logger.log(`Weekday (Mon-Thu): ${periodTimesWeekday.length} periods`);
    Logger.log(`Friday: ${periodTimesFriday.length} periods`);
    Logger.log('\nYou can modify these times directly in the Settings sheet.');
    Logger.log('The values must be valid JSON arrays.');
    
    return { success: true, message: 'Period times configured successfully' };
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Setup Missing Daily Reports settings (HM-controlled)
 * Run once to add keys if they don't exist.
 */
function setupMissingDailyReportSettings() {
  try {
    Logger.log('=== SETTING UP MISSING DAILY REPORT SETTINGS ===');

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
        Logger.log(`❌ Missing: ${setting.key} - Adding it now...`);
        settingsSheet.appendRow([setting.key, setting.value, setting.description]);
        Logger.log(`✅ Added: ${setting.key} = ${setting.value}`);
      } else {
        Logger.log(`✅ Found: ${setting.key} = ${exists.value}`);
      }
    });

    Logger.log('=== SETUP COMPLETE ===');
    return { success: true, message: 'Missing daily report settings configured successfully' };
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}
