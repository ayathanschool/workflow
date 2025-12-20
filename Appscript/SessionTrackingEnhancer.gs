/**
 * SessionTrackingEnhancer.gs
 * Enhanced session completion tracking and teacher performance analytics
 * Handles partial completion, cascading delays, and performance evaluation
 */

/**
 * Update session completion status and progress
 * Handles Rema's scenario: partial completion affecting subsequent sessions
 * 
 * SIMPLIFIED VERSION: Only tracks cascading dependencies, does NOT modify LessonPlans columns
 * This prevents data corruption when columns are added/modified
 */
function updateSessionCompletion(sessionData) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(5000);
    
    Logger.log(`Updating session completion (cascading tracking only): ${JSON.stringify(sessionData)}`);
    
    // Validate required fields
    const requiredFields = ['lpId', 'completionPercentage', 'teacherEmail', 'completionDate'];
    const missing = requiredFields.filter(field => !sessionData[field]);
    if (missing.length) {
      return { success: false, error: `Missing required fields: ${missing.join(', ')}` };
    }
    
    // Get the lesson plans sheet
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const rows = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    
    // Find the lesson plan to update
    const planIndex = rows.findIndex(row => row.lpId === sessionData.lpId);
    if (planIndex === -1) {
      return { success: false, error: 'Lesson plan not found' };
    }
    
    const currentPlan = rows[planIndex];
    
    // Calculate new status based on completion percentage
    let newStatus = 'In Progress';
    if (sessionData.completionPercentage >= 100) {
      newStatus = 'Completed';
    } else if (sessionData.completionPercentage >= 75) {
      newStatus = 'Mostly Completed';
    } else if (sessionData.completionPercentage >= 25) {
      newStatus = 'Partially Completed';
    } else if (sessionData.completionPercentage > 0) {
      newStatus = 'Started';
    }
    
    Logger.log(`✅ Lesson plan found: ${currentPlan.lpId}, Status: ${newStatus}`);
    
    // === CRITICAL FIX: DO NOT MODIFY LESSONPLANS SHEET COLUMNS ===
    // The LessonPlans sheet has a fixed structure. Adding/modifying columns causes data corruption.
    // Instead, we only track cascading dependencies in the SessionDependencies sheet.
    
    // Handle cascading effects if session is incomplete
    if (sessionData.completionPercentage < 100) {
      Logger.log(`⚠️ Session incomplete (${sessionData.completionPercentage}%) - tracking cascading effects`);
      _handleCascadingDelays(currentPlan, sessionData);
    } else {
      Logger.log(`✅ Session complete (100%) - no cascading effects`);
    }
    
    // TeacherPerformance tracking removed
    
    return {
      success: true,
      message: 'Cascading tracking completed successfully',
      newStatus: newStatus,
      cascadingEffects: sessionData.completionPercentage < 100 ? 'Tracked in SessionDependencies sheet' : 'No cascading effects',
      note: 'LessonPlans sheet not modified to prevent data corruption'
    };
    
  } catch (error) {
    Logger.log(`Error updating session completion: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log(`Error releasing lock: ${e.message}`);
    }
  }
}

/**
 * Handle cascading delays when a session is incomplete
 * Rema's scenario: Monday session 1 incomplete affects Tuesday session 2
 * 
 * FIXED VERSION: Only creates SessionDependencies entries, does NOT modify LessonPlans sheet
 */
function _handleCascadingDelays(incompletePlan, sessionData) {
  try {
    Logger.log(`Handling cascading delays for incomplete session: ${incompletePlan.lpId}`);
    
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const allPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    
    // Find subsequent sessions in the same chapter/scheme
    const subsequentSessions = allPlans.filter(plan => 
      plan.schemeId === incompletePlan.schemeId &&
      plan.chapter === incompletePlan.chapter &&
      parseInt(plan.session || '0') > parseInt(incompletePlan.session || '0') &&
      plan.teacherEmail === incompletePlan.teacherEmail
    );
    
    Logger.log(`Found ${subsequentSessions.length} subsequent sessions that may be affected`);
    
    // === CRITICAL FIX: DO NOT MODIFY LESSONPLANS SHEET ===
    // Only create session dependency tracking entries
    // This prevents data corruption from column misalignment
    
    if (subsequentSessions.length > 0) {
      // Create session dependency tracking in separate sheet
      _trackSessionDependencies(incompletePlan, subsequentSessions, sessionData.completionPercentage);
      Logger.log(`✅ Created ${subsequentSessions.length} cascading dependency entries in SessionDependencies sheet`);
    } else {
      Logger.log(`No subsequent sessions found - no cascading tracking needed`);
    }
    
  } catch (error) {
    Logger.log(`Error handling cascading delays: ${error.message}`);
  }
}

// TeacherPerformance tracking and dashboard functions removed

/**
 * Track session dependencies for better planning
 */
function _trackSessionDependencies(incompletePlan, subsequentSessions, completionPercentage) {
  try {
    const dependencySheet = _getOrCreateSheet('SessionDependencies');
    
    const depHeaders = [
      'prerequisiteSession', 'dependentSession', 'completionPercentage', 
      'impactLevel', 'recommendedAction', 'createdAt'
    ];
    _ensureHeaders(dependencySheet, depHeaders);
    
    const timestamp = new Date().toISOString();
    
    subsequentSessions.forEach(session => {
      const impactLevel = completionPercentage >= 75 ? 'Low' :
                         completionPercentage >= 50 ? 'Medium' : 'High';
      
      const recommendedAction = completionPercentage >= 75 ? 
        'Brief review before proceeding' :
        completionPercentage >= 50 ?
        'Extended review and catch-up time required' :
        'Consider rescheduling or intensive remediation';
      
      const rowData = [
        incompletePlan.lpId,
        session.lpId,
        completionPercentage,
        impactLevel,
        recommendedAction,
        timestamp
      ];
      
      dependencySheet.appendRow(rowData);
    });
    
  } catch (error) {
    Logger.log(`Error tracking session dependencies: ${error.message}`);
  }
}

/**
 * Get session completion analytics for a scheme
 */
function getSchemeCompletionAnalytics(schemeId) {
  try {
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const plans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers))
      .filter(plan => plan.schemeId === schemeId);
    
    if (plans.length === 0) {
      return { success: false, error: 'No lesson plans found for this scheme' };
    }
    
    const analytics = {
      totalSessions: plans.length,
      completedSessions: 0,
      partialSessions: 0,
      notStartedSessions: 0,
      overallProgress: 0,
      averageCompletion: 0,
      sessionDetails: []
    };
    
    let totalCompletionPercentage = 0;
    
    plans.forEach(plan => {
      const completion = parseInt(plan.completionPercentage || 0);
      totalCompletionPercentage += completion;
      
      if (completion >= 100) {
        analytics.completedSessions++;
      } else if (completion > 0) {
        analytics.partialSessions++;
      } else {
        analytics.notStartedSessions++;
      }
      
      analytics.sessionDetails.push({
        session: plan.session,
        chapter: plan.chapter,
        completionPercentage: completion,
        status: plan.sessionStatus || 'Not Started',
        selectedDate: plan.selectedDate,
        actualCompletionDate: plan.actualCompletionDate,
        difficulties: plan.difficultiesEncountered,
        adjustments: plan.nextSessionAdjustments
      });
    });
    
    analytics.overallProgress = Math.round((analytics.completedSessions / analytics.totalSessions) * 100);
    analytics.averageCompletion = Math.round(totalCompletionPercentage / plans.length);
    
    return {
      success: true,
      analytics: analytics
    };
    
  } catch (error) {
    Logger.log(`Error getting scheme completion analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ===== HM MONITORING & ANALYTICS FUNCTIONS =====

/**
 * Get all teachers' performance data (HM only)
 */
// Lightweight TeacherPerformance (sheet-based) function removed

/**
 * Get school-wide session analytics (HM only)
 */
function getSchoolSessionAnalytics(filters = {}) {
  try {
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    let plans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    
    // Apply filters if provided
    if (filters.subject) {
      plans = plans.filter(plan => (plan.subject || '').toLowerCase() === filters.subject.toLowerCase());
    }
    if (filters.class) {
      plans = plans.filter(plan => (plan.class || '').toLowerCase() === filters.class.toLowerCase());
    }
    if (filters.teacher) {
      plans = plans.filter(plan => (plan.teacherEmail || '').toLowerCase() === filters.teacher.toLowerCase());
    }
    
    const analytics = {
      totalSessions: plans.length,
      completedSessions: 0,
      partialSessions: 0,
      notStartedSessions: 0,
      subjectBreakdown: {},
      classBreakdown: {},
      teacherBreakdown: {},
      cascadingIssues: [],
      completionTrends: []
    };
    
    plans.forEach(plan => {
      const completion = parseInt(plan.completionPercentage || 0);
      
      if (completion >= 100) {
        analytics.completedSessions++;
      } else if (completion > 0) {
        analytics.partialSessions++;
      } else {
        analytics.notStartedSessions++;
      }
      
      // Subject breakdown
      if (!analytics.subjectBreakdown[plan.subject]) {
        analytics.subjectBreakdown[plan.subject] = { total: 0, completed: 0 };
      }
      analytics.subjectBreakdown[plan.subject].total++;
      if (completion >= 100) analytics.subjectBreakdown[plan.subject].completed++;
      
      // Class breakdown
      if (!analytics.classBreakdown[plan.class]) {
        analytics.classBreakdown[plan.class] = { total: 0, completed: 0 };
      }
      analytics.classBreakdown[plan.class].total++;
      if (completion >= 100) analytics.classBreakdown[plan.class].completed++;
      
      // Teacher breakdown
      if (!analytics.teacherBreakdown[plan.teacherEmail]) {
        analytics.teacherBreakdown[plan.teacherEmail] = { 
          name: plan.teacherName, 
          total: 0, 
          completed: 0,
          cascadingIssues: 0
        };
      }
      analytics.teacherBreakdown[plan.teacherEmail].total++;
      if (completion >= 100) analytics.teacherBreakdown[plan.teacherEmail].completed++;
      
      // Check for cascading issues
      if (completion < 75 && plan.cascadingWarning) {
        analytics.cascadingIssues.push({
          teacher: plan.teacherName,
          subject: plan.subject,
          class: plan.class,
          chapter: plan.chapter,
          session: plan.session,
          completionPercentage: completion,
          date: plan.selectedDate
        });
        analytics.teacherBreakdown[plan.teacherEmail].cascadingIssues++;
      }
    });
    
    // Calculate completion rates
    Object.keys(analytics.subjectBreakdown).forEach(subject => {
      const data = analytics.subjectBreakdown[subject];
      data.completionRate = Math.round((data.completed / data.total) * 100);
    });
    
    Object.keys(analytics.classBreakdown).forEach(className => {
      const data = analytics.classBreakdown[className];
      data.completionRate = Math.round((data.completed / data.total) * 100);
    });
    
    Object.keys(analytics.teacherBreakdown).forEach(email => {
      const data = analytics.teacherBreakdown[email];
      data.completionRate = Math.round((data.completed / data.total) * 100);
    });
    
    analytics.overallCompletionRate = analytics.totalSessions > 0 ? 
      Math.round((analytics.completedSessions / analytics.totalSessions) * 100) : 0;
    
    return {
      success: true,
      analytics: analytics
    };
    
  } catch (error) {
    Logger.log(`Error getting school session analytics: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get cascading issues report (HM only)
 */
function getCascadingIssuesReport() {
  try {
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const plans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    
    const cascadingIssues = plans
      .filter(plan => {
        const completion = parseInt(plan.completionPercentage || 0);
        return completion < 75 && (plan.cascadingWarning || plan.difficultiesEncountered);
      })
      .map(plan => ({
        teacher: plan.teacherName || plan.teacherEmail,
        subject: plan.subject,
        class: plan.class,
        chapter: plan.chapter,
        session: plan.session,
        completionPercentage: parseInt(plan.completionPercentage || 0),
        difficulties: plan.difficultiesEncountered,
        adjustments: plan.nextSessionAdjustments,
        estimatedCatchup: plan.estimatedCatchupTime,
        date: plan.selectedDate,
        severity: parseInt(plan.completionPercentage || 0) < 50 ? 'High' : 
                 parseInt(plan.completionPercentage || 0) < 75 ? 'Medium' : 'Low'
      }))
      .sort((a, b) => a.completionPercentage - b.completionPercentage);
    
    const summary = {
      totalIssues: cascadingIssues.length,
      highSeverity: cascadingIssues.filter(i => i.severity === 'High').length,
      mediumSeverity: cascadingIssues.filter(i => i.severity === 'Medium').length,
      lowSeverity: cascadingIssues.filter(i => i.severity === 'Low').length,
      affectedTeachers: [...new Set(cascadingIssues.map(i => i.teacher))].length,
      affectedSubjects: [...new Set(cascadingIssues.map(i => i.subject))].length
    };
    
    return {
      success: true,
      issues: cascadingIssues,
      summary: summary
    };
    
  } catch (error) {
    Logger.log(`Error getting cascading issues report: ${error.message}`);
    return { success: false, error: error.message };
  }
}