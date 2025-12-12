/**
 * HolidayManager.gs
 * Manages undeclared/sudden holidays and cascades lesson plans
 */

/**
 * Mark a date as undeclared holiday
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} reason - Reason for holiday
 * @param {string} userEmail - User marking the holiday
 * @param {string} userName - User name
 * @returns {Object} Result with ok or error
 */
function markUndeclaredHoliday(dateStr, reason, userEmail, userName) {
  try {
    if (!dateStr || !reason) {
      return { error: 'Date and reason are required' };
    }
    
    const sh = _getSheet('UndeclaredHolidays');
    _ensureHeaders(sh, SHEETS.UndeclaredHolidays);
    
    // Check if holiday already exists for this date
    const headers = _headers(sh);
    const existing = _rows(sh).find(row => {
      const data = _indexByHeader(row, headers);
      return data.date === dateStr;
    });
    
    if (existing) {
      return { error: 'Holiday already marked for this date' };
    }
    
    const now = new Date().toISOString();
    const holidayId = 'HOL_' + Date.now();
    
    // Add holiday record
    sh.appendRow([
      holidayId,      // id
      dateStr,        // date
      reason,         // reason
      userEmail,      // markedBy
      now,            // markedAt
      'active'        // status
    ]);
    
    // Log audit
    logAudit({
      action: 'marked_undeclared_holiday',
      entityType: 'Holiday',
      entityId: holidayId,
      userEmail: userEmail,
      userName: userName,
      userRole: 'HM',
      afterData: { date: dateStr, reason: reason },
      description: `Marked undeclared holiday on ${dateStr}: ${reason}`,
      severity: AUDIT_SEVERITY.WARNING
    });
    
    return { ok: true, holidayId: holidayId, message: 'Holiday marked successfully' };
    
  } catch (error) {
    console.error('Error marking undeclared holiday:', error);
    return { error: error.toString() };
  }
}

/**
 * Get all undeclared holidays
 * @param {boolean} activeOnly - Return only active holidays (default: true)
 * @returns {Array} List of holidays
 */
function getUndeclaredHolidays(activeOnly = true) {
  try {
    const sh = _getSheet('UndeclaredHolidays');
    _ensureHeaders(sh, SHEETS.UndeclaredHolidays);
    
    const headers = _headers(sh);
    let holidays = _rows(sh).map(r => _indexByHeader(r, headers));
    
    if (activeOnly) {
      holidays = holidays.filter(h => h.status === 'active');
    }
    
    // Sort by date descending
    holidays.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return holidays;
    
  } catch (error) {
    console.error('Error getting undeclared holidays:', error);
    return [];
  }
}

/**
 * Delete/deactivate an undeclared holiday
 * @param {string} holidayId - Holiday ID
 * @param {string} userEmail - User email
 * @param {string} userName - User name
 * @returns {Object} Result with ok or error
 */
function deleteUndeclaredHoliday(holidayId, userEmail, userName) {
  try {
    const sh = _getSheet('UndeclaredHolidays');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      if (data.id === holidayId) {
        const rowNum = i + 2; // +1 for header, +1 for 0-index
        
        // Update status to 'deleted' instead of actually deleting
        const statusCol = headers.indexOf('status') + 1;
        sh.getRange(rowNum, statusCol).setValue('deleted');
        
        // Log audit
        logAudit({
          action: 'deleted_holiday',
          entityType: 'Holiday',
          entityId: holidayId,
          userEmail: userEmail,
          userName: userName,
          userRole: 'HM',
          beforeData: data,
          description: `Deleted undeclared holiday: ${data.date}`,
          severity: AUDIT_SEVERITY.WARNING
        });
        
        return { ok: true, message: 'Holiday deleted successfully' };
      }
    }
    
    return { error: 'Holiday not found' };
    
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return { error: error.toString() };
  }
}

/**
 * Check if a date is an undeclared holiday
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {boolean} True if date is a holiday
 */
function isUndeclaredHoliday(dateStr) {
  const holidays = getUndeclaredHolidays(true);
  return holidays.some(h => h.date === dateStr);
}

/**
 * Get next working day (skipping undeclared holidays and weekends)
 * @param {string} dateStr - Starting date (YYYY-MM-DD)
 * @returns {string} Next working day (YYYY-MM-DD)
 */
function getNextWorkingDay(dateStr) {
  const date = new Date(dateStr);
  let nextDate = new Date(date);
  
  // Get all undeclared holidays
  const holidays = getUndeclaredHolidays(true);
  const holidayDates = holidays.map(h => h.date);
  
  do {
    nextDate.setDate(nextDate.getDate() + 1);
    const day = nextDate.getDay();
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    // Skip Sunday (0) and check if not a holiday
    if (day !== 0 && !holidayDates.includes(nextDateStr)) {
      return nextDateStr;
    }
  } while (true);
}

/**
 * Cascade lesson plans from a specific date onwards, skipping undeclared holidays
 * @param {string} startDate - Date from which to start cascading (YYYY-MM-DD)
 * @param {string} userEmail - User email
 * @param {string} userName - User name
 * @returns {Object} Result with count of affected lessons
 */
function cascadeLessonPlansFromDate(startDate, userEmail, userName) {
  try {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    // Get all undeclared holidays from start date onwards
    const holidays = getUndeclaredHolidays(true);
    const holidayDates = holidays
      .filter(h => h.date >= startDate)
      .map(h => h.date);
    
    if (holidayDates.length === 0) {
      return { ok: true, message: 'No holidays to cascade', affectedCount: 0 };
    }
    
    console.log('Cascading lesson plans, skipping holidays:', holidayDates);
    
    let affectedCount = 0;
    const updates = [];
    
    // Find all lesson plans on or after the start date that are not completed
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      const lessonDate = data.scheduledDate || data.date;
      
      // Skip if no date or lesson is already completed
      if (!lessonDate || data.status === 'completed' || data.status === 'Completed') {
        continue;
      }
      
      // Only process lessons on or after start date
      if (lessonDate >= startDate) {
        let newDate = lessonDate;
        
        // If lesson is on a holiday, shift it forward
        while (holidayDates.includes(newDate)) {
          newDate = getNextWorkingDay(newDate);
          affectedCount++;
        }
        
        // Update if date changed
        if (newDate !== lessonDate) {
          updates.push({
            rowNum: i + 2, // +1 for header, +1 for 0-index
            oldDate: lessonDate,
            newDate: newDate,
            lessonId: data.id || data.lessonId,
            teacher: data.teacherEmail,
            class: data.class,
            subject: data.subject
          });
        }
      }
    }
    
    // Apply updates
    const dateCol = headers.indexOf('scheduledDate') !== -1 
      ? headers.indexOf('scheduledDate') + 1 
      : headers.indexOf('date') + 1;
    
    updates.forEach(update => {
      sh.getRange(update.rowNum, dateCol).setValue(update.newDate);
    });
    
    // Log audit for cascade operation
    if (affectedCount > 0) {
      logAudit({
        action: 'cascaded_lesson_plans',
        entityType: 'LessonPlan',
        entityId: 'CASCADE_' + Date.now(),
        userEmail: userEmail,
        userName: userName,
        userRole: 'HM',
        afterData: {
          startDate: startDate,
          holidays: holidayDates,
          affectedCount: affectedCount,
          updates: updates.map(u => ({ lessonId: u.lessonId, oldDate: u.oldDate, newDate: u.newDate }))
        },
        description: `Cascaded ${affectedCount} lesson plans to skip ${holidayDates.length} undeclared holidays`,
        severity: AUDIT_SEVERITY.WARNING
      });
    }
    
    return { 
      ok: true, 
      affectedCount: affectedCount,
      updatedLessons: updates.length,
      holidays: holidayDates,
      message: `Successfully cascaded ${affectedCount} lesson plans`
    };
    
  } catch (error) {
    console.error('Error cascading lesson plans:', error);
    return { error: error.toString() };
  }
}
