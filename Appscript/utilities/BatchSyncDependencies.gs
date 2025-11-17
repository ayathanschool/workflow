/**
 * BatchSyncDependencies.gs
 * Retroactively populate SessionDependencies from existing DailyReports
 * Run this once to sync historical data
 */

/**
 * Batch sync function to populate SessionDependencies from existing DailyReports
 * Use this to retroactively populate cascading data for historical reports
 * 
 * HOW TO USE:
 * 1. Open Apps Script editor
 * 2. Select this function from dropdown
 * 3. Click Run
 * 4. Check Execution Log for results
 */
function syncSessionDependenciesFromReports() {
  try {
    Logger.log('=== STARTING BATCH SYNC: SessionDependencies ===');
    
    const dailyReportsSheet = _getSheet('DailyReports');
    const lessonPlansSheet = _getSheet('LessonPlans');
    
    if (!dailyReportsSheet || !lessonPlansSheet) {
      Logger.log('ERROR: Required sheets not found');
      return { success: false, error: 'Required sheets not found' };
    }
    
    const reportHeaders = _headers(dailyReportsSheet);
    const planHeaders = _headers(lessonPlansSheet);
    
    const reports = _rows(dailyReportsSheet).map(row => _indexByHeader(row, reportHeaders));
    const plans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, planHeaders));
    
    Logger.log(`Found ${reports.length} reports and ${plans.length} lesson plans`);
    
    let processed = 0;
    let cascadingDetected = 0;
    let skipped = 0;
    
    // Process each report that has incomplete sessions
    reports.forEach(report => {
      const completion = Number(report.completionPercentage || 100);
      const lpId = String(report.lessonPlanId || '').trim();
      
      if (!lpId) {
        skipped++;
        return; // Skip reports without lesson plans
      }
      
      if (completion >= 100) {
        processed++;
        return; // Skip complete sessions - no cascading effect
      }
      
      // Find the lesson plan - use string comparison with trim
      const lessonPlan = plans.find(p => String(p.lpId || '').trim() === lpId);
      if (!lessonPlan) {
        Logger.log(`Warning: Lesson plan not found for lpId: "${lpId}"`);
        skipped++;
        return;
      }
      
      // Find subsequent sessions in same scheme
      const subsequentSessions = plans.filter(plan => 
        plan.schemeId === lessonPlan.schemeId &&
        plan.chapter === lessonPlan.chapter &&
        parseInt(plan.session || '0') > parseInt(lessonPlan.session || '0') &&
        plan.teacherEmail === lessonPlan.teacherEmail
      );
      
      if (subsequentSessions.length > 0) {
        Logger.log(`Processing incomplete session: lpId=${lpId}, completion=${completion}%, subsequent=${subsequentSessions.length}`);
        
        // Track the dependencies (calls _trackSessionDependencies from SessionTrackingEnhancer.gs)
        _trackSessionDependencies(lessonPlan, subsequentSessions, completion);
        
        cascadingDetected++;
      }
      
      processed++;
    });
    
    Logger.log(`=== BATCH SYNC COMPLETE ===`);
    Logger.log(`Total reports: ${reports.length}`);
    Logger.log(`Processed: ${processed} incomplete sessions`);
    Logger.log(`Skipped: ${skipped} (no lesson plan linked)`);
    Logger.log(`Cascading effects detected: ${cascadingDetected}`);
    
    return {
      success: true,
      message: 'SessionDependencies synced successfully',
      stats: {
        totalReports: reports.length,
        processedReports: processed,
        skippedReports: skipped,
        cascadingIssuesDetected: cascadingDetected
      }
    };
    
  } catch (error) {
    Logger.log(`ERROR in batch sync: ${error.message}`);
    Logger.log(`Stack trace: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all existing SessionDependencies data
 * Use this if you want to start fresh before running sync
 */
function clearSessionDependencies() {
  try {
    const sheet = _getSheet('SessionDependencies');
    if (!sheet) {
      return { success: false, error: 'SessionDependencies sheet not found' };
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Delete all rows except header
      sheet.deleteRows(2, lastRow - 1);
      Logger.log(`Cleared ${lastRow - 1} rows from SessionDependencies`);
    }
    
    return { success: true, message: `Cleared ${lastRow - 1} dependencies` };
  } catch (error) {
    Logger.log(`Error clearing dependencies: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sync completion percentages from DailyReports to LessonPlans
 * This updates the LessonPlans sheet with actual completion data
 */
function syncCompletionPercentagesToLessonPlans() {
  try {
    Logger.log('=== SYNCING COMPLETION PERCENTAGES TO LESSON PLANS ===');
    
    const dailyReportsSheet = _getSheet('DailyReports');
    const lessonPlansSheet = _getSheet('LessonPlans');
    
    if (!dailyReportsSheet || !lessonPlansSheet) {
      return { success: false, error: 'Required sheets not found' };
    }
    
    const reportHeaders = _headers(dailyReportsSheet);
    const planHeaders = _headers(lessonPlansSheet);
    
    const reports = _rows(dailyReportsSheet).map(row => _indexByHeader(row, reportHeaders));
    
    Logger.log(`Found ${reports.length} daily reports`);
    
    // Ensure completionPercentage column exists in LessonPlans
    _ensureHeaders(lessonPlansSheet, ['completionPercentage', 'actualCompletionDate', 'sessionStatus']);
    
    // Refresh headers after ensuring they exist
    const finalHeaders = _headers(lessonPlansSheet);
    const completionCol = finalHeaders.indexOf('completionPercentage') + 1;
    const dateCol = finalHeaders.indexOf('actualCompletionDate') + 1;
    const statusCol = finalHeaders.indexOf('sessionStatus') + 1;
    
    let updated = 0;
    let skipped = 0;
    
    // Get all lesson plans
    const allPlans = _rows(lessonPlansSheet);
    
    // Process each report
    reports.forEach(report => {
      const lpId = String(report.lessonPlanId || '').trim();
      const completion = Number(report.completionPercentage || 0);
      
      if (!lpId || completion === 0) {
        skipped++;
        return;
      }
      
      // Find the lesson plan row - use string comparison with trim
      const planRowIndex = allPlans.findIndex(planRow => {
        const planData = _indexByHeader(planRow, finalHeaders);
        const planLpId = String(planData.lpId || '').trim();
        return planLpId === lpId;
      });
      
      if (planRowIndex === -1) {
        Logger.log(`Warning: Lesson plan not found for lpId: "${lpId}"`);
        Logger.log(`Available lpIds: ${allPlans.slice(0, 5).map(p => _indexByHeader(p, finalHeaders).lpId).join(', ')}`);
        skipped++;
        return;
      }
      
      const rowNum = planRowIndex + 2; // +2 for 0-based index and header row
      
      // Calculate status
      let status = 'In Progress';
      if (completion >= 100) {
        status = 'Completed';
      } else if (completion >= 75) {
        status = 'Mostly Completed';
      } else if (completion >= 25) {
        status = 'Partially Completed';
      } else if (completion > 0) {
        status = 'Started';
      }
      
      // Update the lesson plan
      if (completionCol > 0) {
        lessonPlansSheet.getRange(rowNum, completionCol).setValue(completion);
      }
      if (dateCol > 0 && report.date) {
        lessonPlansSheet.getRange(rowNum, dateCol).setValue(report.date);
      }
      if (statusCol > 0) {
        lessonPlansSheet.getRange(rowNum, statusCol).setValue(status);
      }
      
      Logger.log(`Updated lpId ${lpId}: ${completion}% (${status})`);
      updated++;
    });
    
    SpreadsheetApp.flush();
    
    Logger.log(`=== SYNC COMPLETE ===`);
    Logger.log(`Updated: ${updated} lesson plans`);
    Logger.log(`Skipped: ${skipped}`);
    
    return {
      success: true,
      message: 'Completion percentages synced successfully',
      stats: {
        updated: updated,
        skipped: skipped
      }
    };
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Complete sync: Both dependencies and completion percentages
 * Run this to do a full historical data sync
 */
function fullHistoricalSync() {
  try {
    Logger.log('=== STARTING FULL HISTORICAL SYNC ===');
    Logger.log('');
    
    // Step 1: Sync completion percentages
    Logger.log('STEP 1: Syncing completion percentages to LessonPlans...');
    const completionResult = syncCompletionPercentagesToLessonPlans();
    Logger.log(`Result: ${completionResult.success ? 'SUCCESS' : 'FAILED'}`);
    Logger.log('');
    
    // Step 2: Sync dependencies
    Logger.log('STEP 2: Syncing session dependencies...');
    const depsResult = syncSessionDependenciesFromReports();
    Logger.log(`Result: ${depsResult.success ? 'SUCCESS' : 'FAILED'}`);
    Logger.log('');
    
    Logger.log('=== FULL SYNC COMPLETE ===');
    
    return {
      success: completionResult.success && depsResult.success,
      completionSync: completionResult,
      dependenciesSync: depsResult
    };
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}
