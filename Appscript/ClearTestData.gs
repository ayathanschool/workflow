/**
 * UTILITY SCRIPT TO CLEAR TEST DATA
 * Run this from Apps Script Editor: Extensions > Apps Script > Run > clearAllTestData
 * 
 * This will delete all data from:
 * - Schemes
 * - LessonPlans
 * - Substitutions
 * - DailyReports
 * 
 * CAUTION: This will keep headers but delete all data rows!
 */

function clearAllTestData() {
  try {
    Logger.log('=== CLEARING ALL TEST DATA ===');
    
    // Clear Schemes (keep header row)
    const schemesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schemes');
    if (schemesSheet && schemesSheet.getLastRow() > 1) {
      schemesSheet.deleteRows(2, schemesSheet.getLastRow() - 1);
      Logger.log('✅ Cleared Schemes sheet');
    }
    
    // Clear LessonPlans (keep header row)
    const lessonPlansSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LessonPlans');
    if (lessonPlansSheet && lessonPlansSheet.getLastRow() > 1) {
      lessonPlansSheet.deleteRows(2, lessonPlansSheet.getLastRow() - 1);
      Logger.log('✅ Cleared LessonPlans sheet');
    }
    
    // Clear Substitutions (keep header row)
    const substitutionsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Substitutions');
    if (substitutionsSheet && substitutionsSheet.getLastRow() > 1) {
      substitutionsSheet.deleteRows(2, substitutionsSheet.getLastRow() - 1);
      Logger.log('✅ Cleared Substitutions sheet');
    }
    
    // Clear DailyReports (keep header row)
    const dailyReportsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DailyReports');
    if (dailyReportsSheet && dailyReportsSheet.getLastRow() > 1) {
      dailyReportsSheet.deleteRows(2, dailyReportsSheet.getLastRow() - 1);
      Logger.log('✅ Cleared DailyReports sheet');
    }
    
    Logger.log('=== ALL TEST DATA CLEARED SUCCESSFULLY ===');
    Logger.log('You can now start fresh with scheme submission → lesson planning → daily reports');
    
    return { success: true, message: 'All test data cleared successfully' };
    
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clear only DailyReports (for testing daily report submissions)
 */
function clearDailyReportsOnly() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DailyReports');
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
      Logger.log('✅ Cleared DailyReports sheet');
      return { success: true };
    }
    return { success: true, message: 'Sheet already empty' };
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clear only Substitutions (for testing substitution workflow)
 */
function clearSubstitutionsOnly() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Substitutions');
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
      Logger.log('✅ Cleared Substitutions sheet');
      return { success: true };
    }
    return { success: true, message: 'Sheet already empty' };
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    return { success: false, error: error.message };
  }
}
