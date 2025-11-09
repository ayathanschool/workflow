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
