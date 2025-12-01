/**
 * ====== DAILY READINESS STATUS FOR HM ======
 * Helps HM track lesson plan preparation and daily report submission
 * Shows time-aware metrics for better oversight
 */

/**
 * Get daily readiness status for lesson plans and reports
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 * @returns {Object} - Readiness metrics for both lesson plans and daily reports
 */
function getDailyReadinessStatus(date) {
  try {
    _bootstrapSheets();
    
    // Normalize date to IST
    const targetDate = date ? _normalizeQueryDate(date) : _todayISO();
    const dayName = _dayNameIST(targetDate);
    
    // Get today's scheduled periods from timetable
    const timetableData = _readSheet('Timetable');
    const scheduledPeriods = timetableData.filter(row => 
      row.dayOfWeek && row.dayOfWeek.toLowerCase() === dayName.toLowerCase()
    );
    
    // If no classes scheduled (weekend/holiday)
    if (scheduledPeriods.length === 0) {
      return {
        success: true,
        date: targetDate,
        dayName: dayName,
        noClassesScheduled: true,
        message: `No classes scheduled for ${dayName}`,
        lessonPlans: { ready: 0, pending: 0, total: 0, percentage: 100 },
        dailyReports: { submitted: 0, pending: 0, total: 0, percentage: 100 }
      };
    }
    
    // Get substitutions for the day
    const substitutionsData = _readSheet('Substitutions');
    const todaysSubstitutions = substitutionsData.filter(row => 
      _isoDateIST(row.date) === targetDate
    );
    
    // Apply substitutions to scheduled periods
    const finalSchedule = scheduledPeriods.map(period => {
      const substitution = todaysSubstitutions.find(sub =>
        sub.period === period.period &&
        sub.class === period.class &&
        sub.absentTeacher === period.teacherEmail
      );
      
      if (substitution) {
        return {
          ...period,
          teacherEmail: substitution.substituteTeacher,
          subject: substitution.substituteSubject || period.subject,
          isSubstitution: true,
          absentTeacher: substitution.absentTeacher
        };
      }
      
      return { ...period, isSubstitution: false };
    });
    
    // Get lesson plans for today
    const lessonPlansData = _readSheet('LessonPlans');
    const todaysLessonPlans = lessonPlansData.filter(row => 
      _isoDateIST(row.selectedDate) === targetDate &&
      row.status !== 'cancelled'
    );
    
    // Get daily reports for today
    const dailyReportsData = _readSheet('DailyReports');
    const todaysDailyReports = dailyReportsData.filter(row => 
      _isoDateIST(row.date) === targetDate
    );
    
    // Calculate lesson plan readiness
    const lessonPlanStatus = _calculateLessonPlanReadiness(
      finalSchedule, 
      todaysLessonPlans
    );
    
    // Calculate daily report status
    const dailyReportStatus = _calculateDailyReportStatus(
      finalSchedule,
      todaysDailyReports
    );
    
    return {
      success: true,
      date: targetDate,
      dayName: dayName,
      noClassesScheduled: false,
      lessonPlans: lessonPlanStatus,
      dailyReports: dailyReportStatus,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`[getDailyReadinessStatus] Error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate lesson plan readiness for scheduled periods
 * @private
 */
function _calculateLessonPlanReadiness(scheduledPeriods, lessonPlans) {
  const total = scheduledPeriods.length;
  const pendingDetails = [];
  
  let readyCount = 0;
  
  scheduledPeriods.forEach(period => {
    const hasPlan = lessonPlans.some(plan =>
      plan.teacherEmail === period.teacherEmail &&
      plan.class === period.class &&
      plan.subject === period.subject &&
      plan.selectedPeriod === period.period &&
      plan.status === 'submitted'
    );
    
    if (hasPlan) {
      readyCount++;
    } else {
      pendingDetails.push({
        teacherEmail: period.teacherEmail,
        teacherName: period.teacherName,
        class: period.class,
        subject: period.subject,
        period: period.period,
        isSubstitution: period.isSubstitution || false
      });
    }
  });
  
  const pendingCount = total - readyCount;
  const percentage = total > 0 ? Math.round((readyCount / total) * 100) : 100;
  
  // Group pending by teacher for easier follow-up
  const byTeacher = _groupByTeacher(pendingDetails);
  
  return {
    ready: readyCount,
    pending: pendingCount,
    total: total,
    percentage: percentage,
    status: percentage === 100 ? 'complete' : percentage >= 80 ? 'good' : percentage >= 50 ? 'warning' : 'critical',
    pendingDetails: pendingDetails,
    byTeacher: byTeacher
  };
}

/**
 * Calculate daily report submission status
 * @private
 */
function _calculateDailyReportStatus(scheduledPeriods, dailyReports) {
  const total = scheduledPeriods.length;
  const pendingDetails = [];
  
  let submittedCount = 0;
  
  scheduledPeriods.forEach(period => {
    const hasReport = dailyReports.some(report =>
      report.teacherEmail === period.teacherEmail &&
      report.class === period.class &&
      report.subject === period.subject &&
      report.period === period.period
    );
    
    if (hasReport) {
      submittedCount++;
    } else {
      pendingDetails.push({
        teacherEmail: period.teacherEmail,
        teacherName: period.teacherName,
        class: period.class,
        subject: period.subject,
        period: period.period,
        isSubstitution: period.isSubstitution || false
      });
    }
  });
  
  const pendingCount = total - submittedCount;
  const percentage = total > 0 ? Math.round((submittedCount / total) * 100) : 100;
  
  // Group pending by teacher
  const byTeacher = _groupByTeacher(pendingDetails);
  
  return {
    submitted: submittedCount,
    pending: pendingCount,
    total: total,
    percentage: percentage,
    status: percentage === 100 ? 'complete' : percentage >= 70 ? 'good' : percentage >= 40 ? 'warning' : 'critical',
    pendingDetails: pendingDetails,
    byTeacher: byTeacher
  };
}

/**
 * Group pending items by teacher for easier overview
 * @private
 */
function _groupByTeacher(pendingItems) {
  const grouped = {};
  
  pendingItems.forEach(item => {
    const email = item.teacherEmail;
    if (!grouped[email]) {
      grouped[email] = {
        teacherName: item.teacherName,
        teacherEmail: email,
        count: 0,
        periods: []
      };
    }
    grouped[email].count++;
    grouped[email].periods.push({
      class: item.class,
      subject: item.subject,
      period: item.period,
      isSubstitution: item.isSubstitution
    });
  });
  
  // Convert to array and sort by count (highest first)
  return Object.values(grouped).sort((a, b) => b.count - a.count);
}
