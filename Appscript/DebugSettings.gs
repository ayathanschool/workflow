/**
 * Debug function to check current settings
 * Run this to see what values are in your Settings sheet
 */
function debugLessonPlanSettings() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    Logger.log('=== ALL SETTINGS ===');
    settingsData.forEach(row => {
      Logger.log(`Key: "${row.key}" | Value: "${row.value}" | Description: "${row.description}"`);
    });
    
    Logger.log('\n=== CHECKING lessonplan_bulk_only ===');
    const bulkOnlySetting = settingsData.find(row =>
      (row.key || '').toLowerCase() === 'lessonplan_bulk_only'
    );
    
    if (bulkOnlySetting) {
      Logger.log(`✅ Found setting!`);
      Logger.log(`   Key: "${bulkOnlySetting.key}"`);
      Logger.log(`   Value: "${bulkOnlySetting.value}"`);
      Logger.log(`   Value type: ${typeof bulkOnlySetting.value}`);
      
      const bulkOnlyValue = String(bulkOnlySetting.value).toLowerCase();
      const bulkOnly = bulkOnlyValue === 'true' || bulkOnlyValue === 'yes' || bulkOnlyValue === '1';
      
      Logger.log(`   Parsed value: "${bulkOnlyValue}"`);
      Logger.log(`   Result (bulkOnly): ${bulkOnly}`);
    } else {
      Logger.log(`❌ Setting NOT found!`);
    }
    
    Logger.log('\n=== TESTING _getLessonPlanSettings() ===');
    const settings = _getLessonPlanSettings();
    Logger.log(`bulkOnly returned: ${settings.bulkOnly}`);
    Logger.log(`Full settings: ${JSON.stringify(settings)}`);
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}
