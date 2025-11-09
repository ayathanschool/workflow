# Exact Code Snippets for Apps Script Integration

## 📁 **FILE 1: LessonProgressManager.gs** (CREATE NEW FILE)

```javascript
/**
 * LessonProgressManager.gs
 * Enhanced Lesson Progress Tracking System
 * Handles session-level tracking, cascading delays, and smart completion analysis
 */

/**
 * Get lesson progress summary for a specific teacher
 * Supports class and subject filtering
 */
function getLessonProgressSummary(teacherEmail, cls = '', subject = '') {
  try {
    Logger.log(`Getting lesson progress for teacher: ${teacherEmail}, class: ${cls}, subject: ${subject}`);
    
    if (!teacherEmail) {
      return { success: false, error: 'Teacher email is required' };
    }
    
    const progressData = _calculateEnhancedLessonProgress(teacherEmail, cls, subject);
    
    return {
      success: true,
      summary: progressData.summary,
      details: progressData.lessonDetails,
      teacherStats: progressData.teacherStats
    };
  } catch (error) {
    Logger.log(`Error getting lesson progress summary: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get lesson progress summary for all teachers (HM view)
 */
function getAllLessonProgressSummary(teacherFilter = '', cls = '', subject = '') {
  try {
    Logger.log(`Getting all lesson progress - teacher filter: ${teacherFilter}`);
    
    const allTeachers = _getAllActiveTeachers();
    let teachersToAnalyze = allTeachers;
    
    // Apply teacher filter if specified
    if (teacherFilter) {
      teachersToAnalyze = allTeachers.filter(teacher => 
        teacher.email.toLowerCase() === teacherFilter.toLowerCase()
      );
    }
    
    const aggregatedData = {
      summary: {
        total: 0,
        completed: 0,
        delayed: 0,
        completionRate: 0,
        avgDelayDays: 0
      },
      teacherStats: [],
      details: []
    };
    
    let totalDelayDays = 0;
    let delayedLessonsCount = 0;
    
    teachersToAnalyze.forEach(teacher => {
      const teacherProgress = _calculateEnhancedLessonProgress(teacher.email, cls, subject);
      
      // Aggregate summary data
      aggregatedData.summary.total += teacherProgress.summary.total;
      aggregatedData.summary.completed += teacherProgress.summary.completed;
      aggregatedData.summary.delayed += teacherProgress.summary.delayed;
      
      if (teacherProgress.summary.avgDelayDays > 0) {
        totalDelayDays += teacherProgress.summary.avgDelayDays;
        delayedLessonsCount++;
      }
      
      // Add teacher stats
      aggregatedData.teacherStats.push({
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        total: teacherProgress.summary.total,
        completed: teacherProgress.summary.completed,
        delayed: teacherProgress.summary.delayed,
        completionRate: teacherProgress.summary.completionRate,
        avgDelayDays: teacherProgress.summary.avgDelayDays
      });
      
      // Add details
      aggregatedData.details = aggregatedData.details.concat(teacherProgress.lessonDetails);
    });
    
    // Calculate overall statistics
    if (aggregatedData.summary.total > 0) {
      aggregatedData.summary.completionRate = Math.round(
        (aggregatedData.summary.completed / aggregatedData.summary.total) * 100
      );
    }
    
    if (delayedLessonsCount > 0) {
      aggregatedData.summary.avgDelayDays = Math.round(totalDelayDays / delayedLessonsCount);
    }
    
    return {
      success: true,
      summary: aggregatedData.summary,
      teacherStats: aggregatedData.teacherStats,
      details: aggregatedData.details
    };
  } catch (error) {
    Logger.log(`Error getting all lesson progress: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Core enhanced lesson progress calculation
 */
function _calculateEnhancedLessonProgress(teacherEmail, filterClass = '', filterSubject = '') {
  try {
    // Get lesson plans for the teacher
    const lessonPlansSheet = _getSheet('LessonPlans');
    const lessonPlansHeaders = _headers(lessonPlansSheet);
    const allLessonPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
    
    let lessonPlans = allLessonPlans.filter(plan => {
      let matches = (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase();
      if (filterClass) matches = matches && (plan.class || '') === filterClass;
      if (filterSubject) matches = matches && (plan.subject || '') === filterSubject;
      return matches && plan.status === 'Ready'; // Only analyze approved lesson plans
    });

    // Get daily reports for progress tracking
    const dailyReportsSheet = _getSheet('DailyReports');
    const dailyReportsHeaders = _headers(dailyReportsSheet);
    const allDailyReports = _rows(dailyReportsSheet).map(row => _indexByHeader(row, dailyReportsHeaders));
    
    const dailyReports = allDailyReports.filter(report => 
      (report.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );

    // Initialize progress data
    const progressData = {
      summary: {
        total: lessonPlans.length,
        completed: 0,
        delayed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        completionRate: 0,
        avgDelayDays: 0
      },
      lessonDetails: [],
      cascadingDelays: []
    };

    let totalDelayDays = 0;
    let delayedCount = 0;

    // Analyze each lesson plan
    lessonPlans.forEach(plan => {
      const lessonProgress = _analyzeEnhancedLessonProgress(plan, dailyReports);
      progressData.lessonDetails.push(lessonProgress);
      
      // Update summary statistics
      switch (lessonProgress.status) {
        case 'completed':
          progressData.summary.completed++;
          if (lessonProgress.delayDays > 0) {
            totalDelayDays += lessonProgress.delayDays;
            delayedCount++;
          }
          break;
        case 'delayed':
        case 'overdue':
          progressData.summary.delayed++;
          totalDelayDays += lessonProgress.delayDays;
          delayedCount++;
          break;
        case 'in-progress':
          progressData.summary.inProgress++;
          if (lessonProgress.delayDays > 0) {
            totalDelayDays += lessonProgress.delayDays;
            delayedCount++;
          }
          break;
        case 'pending':
          progressData.summary.pending++;
          break;
      }
      
      // Track cascading delays
      if (lessonProgress.cascadingEffect && lessonProgress.cascadingEffect.affected) {
        progressData.cascadingDelays.push(lessonProgress.cascadingEffect);
      }
    });

    // Calculate final statistics
    if (progressData.summary.total > 0) {
      progressData.summary.completionRate = Math.round(
        (progressData.summary.completed / progressData.summary.total) * 100
      );
    }
    
    if (delayedCount > 0) {
      progressData.summary.avgDelayDays = Math.round(totalDelayDays / delayedCount);
    }

    return progressData;
  } catch (error) {
    Logger.log(`Error calculating enhanced lesson progress: ${error.message}`);
    return {
      summary: {
        total: 0, completed: 0, delayed: 0, inProgress: 0, pending: 0, overdue: 0,
        completionRate: 0, avgDelayDays: 0
      },
      lessonDetails: [],
      cascadingDelays: []
    };
  }
}

/**
 * Enhanced analysis of individual lesson progress
 */
function _analyzeEnhancedLessonProgress(lessonPlan, dailyReports) {
  const today = new Date();
  const plannedDate = new Date(lessonPlan.dateCreated || lessonPlan.submittedAt || today);
  
  // Find ALL reports related to this lesson plan topic
  const relatedReports = dailyReports.filter(report => {
    const reportClass = (report.class || '').trim();
    const reportSubject = (report.subject || '').trim();
    const topicsCovered = (report.topicsCovered || '').toLowerCase();
    const lessonTopic = (lessonPlan.chapter || lessonPlan.topic || '').toLowerCase();
    
    return reportClass === lessonPlan.class &&
           reportSubject === lessonPlan.subject &&
           topicsCovered.includes(lessonTopic);
  });

  let status, actualCompletionDate, delayDays, completionDetails;

  if (relatedReports.length > 0) {
    // Analyze completion across multiple reports
    const completionAnalysis = _analyzeSessionCompletion(lessonPlan, relatedReports);
    
    if (completionAnalysis.fullyCompleted) {
      // Lesson fully completed
      actualCompletionDate = new Date(completionAnalysis.finalCompletionDate);
      delayDays = Math.max(0, Math.ceil((actualCompletionDate - plannedDate) / (1000 * 60 * 60 * 24)));
      status = 'completed';
    } else if (completionAnalysis.partiallyCompleted) {
      // Lesson in progress
      delayDays = Math.max(0, Math.ceil((today - plannedDate) / (1000 * 60 * 60 * 24)));
      status = 'in-progress';
    } else {
      // Lesson mentioned but not progressing
      delayDays = Math.max(0, Math.ceil((today - plannedDate) / (1000 * 60 * 60 * 24)));
      status = delayDays > 7 ? 'overdue' : 'delayed';
    }
    
    completionDetails = completionAnalysis;
  } else if (today > plannedDate) {
    // Lesson not started and overdue
    delayDays = Math.ceil((today - plannedDate) / (1000 * 60 * 60 * 24));
    status = delayDays > 7 ? 'overdue' : 'delayed';
  } else {
    // Lesson upcoming
    delayDays = 0;
    status = 'pending';
  }

  return {
    progressId: `progress_${lessonPlan.lpId || lessonPlan.schemeId}_${Date.now()}`,
    lessonId: lessonPlan.lpId || lessonPlan.schemeId,
    teacherEmail: lessonPlan.teacherEmail,
    teacherName: lessonPlan.teacherName,
    chapter: lessonPlan.chapter || lessonPlan.topic,
    session: lessonPlan.session || '1',
    class: lessonPlan.class,
    subject: lessonPlan.subject,
    plannedDate: plannedDate.toISOString().split('T')[0],
    actualDate: actualCompletionDate ? actualCompletionDate.toISOString().split('T')[0] : null,
    status: status,
    delayDays: delayDays,
    priority: _calculateLessonPriority(status, delayDays),
    completionPercentage: _calculateCompletionPercentage(completionDetails),
    completionDetails: completionDetails || { 
      fullyCompleted: false, 
      partiallyCompleted: false, 
      sessionsCompleted: [], 
      totalReports: 0 
    },
    cascadingEffect: _calculateCascadingEffect(lessonPlan, delayDays, status)
  };
}

/**
 * Analyze session completion across multiple reports
 */
function _analyzeSessionCompletion(lessonPlan, reports) {
  const completionKeywords = ['completed', 'finished', 'done', 'covered fully', 'full coverage'];
  const partialKeywords = ['partial', 'started', 'begun', 'in progress', 'continuing'];
  
  let fullyCompleted = false;
  let partiallyCompleted = false;
  let finalCompletionDate = null;
  let sessionsCompleted = [];
  let reportSummary = [];
  
  reports.forEach(report => {
    const content = (report.topicsCovered || '').toLowerCase();
    const reportDate = report.date || report.dateSubmitted;
    
    // Check for completion indicators
    const hasCompletionKeyword = completionKeywords.some(keyword => content.includes(keyword));
    const hasPartialKeyword = partialKeywords.some(keyword => content.includes(keyword));
    
    if (hasCompletionKeyword) {
      fullyCompleted = true;
      finalCompletionDate = reportDate;
    } else if (hasPartialKeyword) {
      partiallyCompleted = true;
    }
    
    // Track session numbers
    const sessionMatch = content.match(/session\s*(\d+)/g);
    if (sessionMatch) {
      sessionMatch.forEach(match => {
        const sessionNum = parseInt(match.replace(/\D/g, ''));
        if (sessionNum && !sessionsCompleted.includes(sessionNum)) {
          sessionsCompleted.push(sessionNum);
        }
      });
    }
    
    reportSummary.push({
      date: reportDate,
      content: content,
      hasCompletion: hasCompletionKeyword,
      hasPartial: hasPartialKeyword
    });
  });
  
  // Sort sessions completed
  sessionsCompleted.sort((a, b) => a - b);
  
  return {
    fullyCompleted,
    partiallyCompleted,
    finalCompletionDate,
    sessionsCompleted,
    totalReports: reports.length,
    reportSummary
  };
}

/**
 * Calculate lesson priority based on status and delay
 */
function _calculateLessonPriority(status, delayDays) {
  if (status === 'overdue' || delayDays > 7) return 'high';
  if (status === 'delayed' || delayDays > 3) return 'medium';
  return 'low';
}

/**
 * Calculate completion percentage
 */
function _calculateCompletionPercentage(completionDetails) {
  if (!completionDetails) return 0;
  
  if (completionDetails.fullyCompleted) return 100;
  if (completionDetails.partiallyCompleted) {
    // Estimate based on session completion
    if (completionDetails.sessionsCompleted.length > 0) {
      // Assume typical lesson has 2-3 sessions
      const estimatedTotalSessions = Math.max(3, Math.max(...completionDetails.sessionsCompleted));
      return Math.min(95, Math.round((completionDetails.sessionsCompleted.length / estimatedTotalSessions) * 100));
    }
    return 50; // Default for partial completion
  }
  
  return 0;
}

/**
 * Calculate cascading effect of delays
 */
function _calculateCascadingEffect(lessonPlan, delayDays, status) {
  if (delayDays <= 0 && status !== 'delayed' && status !== 'overdue') {
    return { affected: false };
  }
  
  // Calculate impact on subsequent lessons
  const effectLevel = delayDays > 7 ? 'severe' : delayDays > 3 ? 'moderate' : 'minor';
  
  return {
    affected: true,
    delayDays: delayDays,
    effectLevel: effectLevel,
    subsequentLessonsAffected: Math.ceil(delayDays / 2),
    recommendedAction: _getRecommendedAction(delayDays, status),
    riskLevel: delayDays > 10 ? 'high' : delayDays > 5 ? 'medium' : 'low'
  };
}

/**
 * Get recommended action based on delay severity
 */
function _getRecommendedAction(delayDays, status) {
  if (delayDays > 10) return 'restructure_timeline';
  if (delayDays > 5) return 'request_extra_periods';
  if (delayDays > 3) return 'compress_future_lessons';
  if (status === 'in-progress') return 'complete_current_session';
  return 'monitor_progress';
}

/**
 * Get all active teachers from Users sheet
 */
function _getAllActiveTeachers() {
  try {
    const usersSheet = _getSheet('Users');
    const usersHeaders = _headers(usersSheet);
    const users = _rows(usersSheet).map(row => _indexByHeader(row, usersHeaders));
    
    return users.filter(user => {
      const roles = (user.roles || user.role || '').toLowerCase();
      return roles.includes('teacher') || roles.includes('hm') || roles.includes('head');
    }).map(user => ({
      email: (user.email || '').toLowerCase(),
      name: user.name || user.email,
      roles: user.roles || user.role || '',
      classes: user.classes ? user.classes.split(',').map(c => c.trim()) : [],
      subjects: user.subjects ? user.subjects.split(',').map(s => s.trim()) : []
    }));
  } catch (error) {
    Logger.log(`Error getting all teachers: ${error.message}`);
    return [];
  }
}

/**
 * Track lesson progress when daily reports are submitted
 */
function _trackLessonProgress(reportData, timestamp) {
  try {
    Logger.log(`Tracking lesson progress for report: ${JSON.stringify(reportData)}`);
    
    // Get or create LessonProgress sheet
    let progressSheet;
    try {
      progressSheet = _getSheet('LessonProgress');
    } catch (error) {
      // Create LessonProgress sheet if it doesn't exist
      Logger.log('Creating LessonProgress sheet...');
      progressSheet = _ss().insertSheet('LessonProgress');
      _ensureHeaders(progressSheet, [
        'id', 'teacherEmail', 'teacherName', 'class', 'subject', 'chapter', 'session',
        'reportDate', 'topicsCovered', 'completionStatus', 'sessionsCompleted',
        'plannedDate', 'actualCompletionDate', 'delayDays', 'status', 
        'priority', 'reportId', 'createdAt', 'updatedAt'
      ]);
    }

    // Find matching lesson plans
    const lessonPlansSheet = _getSheet('LessonPlans');
    const lessonPlansHeaders = _headers(lessonPlansSheet);
    const allLessonPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
    
    const relatedLessonPlans = allLessonPlans.filter(plan =>
      (plan.teacherEmail || '').toLowerCase() === (reportData.teacherEmail || '').toLowerCase() &&
      (plan.class || '') === (reportData.class || '') &&
      (plan.subject || '') === (reportData.subject || '') &&
      (plan.status || '') === 'Ready'
    );

    // Process each related lesson plan
    relatedLessonPlans.forEach(plan => {
      const lessonTopic = (plan.chapter || plan.topic || '').toLowerCase();
      const topicsCovered = (reportData.topicsCovered || '').toLowerCase();
      
      if (topicsCovered.includes(lessonTopic)) {
        // This report relates to this lesson plan
        const plannedDate = new Date(plan.dateCreated || plan.submittedAt || timestamp);
        const reportDate = new Date(timestamp);
        const delayDays = Math.max(0, Math.ceil((reportDate - plannedDate) / (1000 * 60 * 60 * 24)));
        
        // Determine completion status
        const completionKeywords = ['completed', 'finished', 'done', 'covered fully'];
        const partialKeywords = ['partial', 'started', 'begun', 'in progress'];
        
        let completionStatus = 'mentioned';
        if (completionKeywords.some(keyword => topicsCovered.includes(keyword))) {
          completionStatus = 'completed';
        } else if (partialKeywords.some(keyword => topicsCovered.includes(keyword))) {
          completionStatus = 'partial';
        }
        
        // Extract session information
        let sessionsCompleted = [];
        const sessionMatch = topicsCovered.match(/session\s*(\d+)/g);
        if (sessionMatch) {
          sessionMatch.forEach(match => {
            const sessionNum = parseInt(match.replace(/\D/g, ''));
            if (sessionNum) sessionsCompleted.push(sessionNum);
          });
        }
        
        // Determine overall status
        let status = 'in-progress';
        if (completionStatus === 'completed') {
          status = delayDays > 0 ? 'completed-late' : 'completed-on-time';
        } else if (delayDays > 7) {
          status = 'overdue';
        } else if (delayDays > 3) {
          status = 'delayed';
        }
        
        const priority = delayDays > 7 ? 'high' : delayDays > 3 ? 'medium' : 'low';
        
        // Create progress record
        const progressId = `LP_${plan.lpId || plan.schemeId}_${reportData.id || Date.now()}`;
        
        progressSheet.appendRow([
          progressId,
          reportData.teacherEmail || '',
          reportData.teacherName || plan.teacherName || '',
          reportData.class || '',
          reportData.subject || '',
          plan.chapter || plan.topic || '',
          plan.session || '1',
          reportData.date || reportDate.toISOString().split('T')[0],
          reportData.topicsCovered || '',
          completionStatus,
          sessionsCompleted.join(','),
          plannedDate.toISOString().split('T')[0],
          completionStatus === 'completed' ? reportDate.toISOString().split('T')[0] : '',
          delayDays,
          status,
          priority,
          reportData.id || '',
          new Date().toISOString(),
          new Date().toISOString()
        ]);
        
        Logger.log(`Progress tracked: ${progressId} - ${status} - ${delayDays} days delay`);
      }
    });
    
    return { success: true, message: 'Lesson progress tracked successfully' };
  } catch (error) {
    Logger.log(`Error tracking lesson progress: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

Copy this entire code block into a new file called **LessonProgressManager.gs** in your Apps Script project.

---

Let me continue with the next file in a separate response to keep this organized...