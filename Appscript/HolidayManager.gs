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
    let holidays = _rows(sh).map(r => {
      const holiday = _indexByHeader(r, headers);
      // Convert date to YYYY-MM-DD string format to avoid timezone issues
      if (holiday.date instanceof Date) {
        const year = holiday.date.getFullYear();
        const month = String(holiday.date.getMonth() + 1).padStart(2, '0');
        const day = String(holiday.date.getDate()).padStart(2, '0');
        holiday.date = `${year}-${month}-${day}`;
      }
      return holiday;
    });
    
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
      const lessonDate = data.selectedDate || data.scheduledDate || data.date;
      
      // Skip if no date or lesson is already completed
      if (!lessonDate || data.status === 'completed' || data.status === 'Completed') {
        continue;
      }
      
      // Convert date to string format for comparison
      let dateStr = lessonDate;
      if (lessonDate instanceof Date) {
        const year = lessonDate.getFullYear();
        const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
        const day = String(lessonDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      
      // Only process lessons on or after start date
      if (dateStr >= startDate) {
        let newDate = dateStr;
        
        // If lesson is on a holiday, shift it forward
        while (holidayDates.includes(newDate)) {
          newDate = getNextWorkingDay(newDate);
          affectedCount++;
        }
        
        // Update if date changed
        if (newDate !== dateStr) {
          updates.push({
            rowNum: i + 2, // +1 for header, +1 for 0-index
            oldDate: dateStr,
            newDate: newDate,
            lessonId: data.lpId || data.id || data.lessonId,
            teacher: data.teacherEmail,
            class: data.class,
            subject: data.subject
          });
        }
      }
    }
    
    // Apply updates
    const dateCol = headers.indexOf('selectedDate') !== -1 
      ? headers.indexOf('selectedDate') + 1 
      : (headers.indexOf('scheduledDate') !== -1 
        ? headers.indexOf('scheduledDate') + 1 
        : headers.indexOf('date') + 1);
    
    const cascadeId = 'CAS_' + Date.now();
    const cascadeDate = new Date().toISOString();
    
    // Store cascade history before applying updates
    const historySheet = _getSheet('CascadeHistory');
    _ensureHeaders(historySheet, SHEETS.CascadeHistory);
    
    updates.forEach(update => {
      // Update lesson plan date
      sh.getRange(update.rowNum, dateCol).setValue(update.newDate);
      
      // Record in cascade history
      historySheet.appendRow([
        cascadeId,
        cascadeDate,
        startDate,
        userEmail,
        cascadeDate,
        update.lessonId,
        update.oldDate,
        update.newDate,
        update.teacher,
        update.class,
        update.subject,
        'cascaded'
      ]);
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

/**
 * Get preview of lesson plans that will be affected by cascading from a date
 * @param {string} startDate - Date from which to preview cascading (YYYY-MM-DD)
 * @returns {Object} Preview data with affected lessons
 */
function getAffectedLessonPlans(startDate) {
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
      return { 
        affectedLessons: [], 
        holidays: [],
        message: 'No holidays found from this date onwards'
      };
    }
    
    const affectedLessons = [];
    
    // Find all lesson plans on holiday dates that are not completed
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      const lessonDate = data.selectedDate || data.scheduledDate || data.date;
      
      // Skip if no date or lesson is already completed
      if (!lessonDate || data.status === 'completed' || data.status === 'Completed') {
        continue;
      }
      
      // Convert date to string format for comparison
      let dateStr = lessonDate;
      if (lessonDate instanceof Date) {
        const year = lessonDate.getFullYear();
        const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
        const day = String(lessonDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      
      // Check if lesson is on a holiday date
      if (holidayDates.includes(dateStr)) {
        affectedLessons.push({
          lpId: data.lpId,
          date: dateStr,
          period: data.selectedPeriod,
          teacher: data.teacherName || data.teacherEmail,
          teacherEmail: data.teacherEmail,
          class: data.class,
          subject: data.subject,
          chapter: data.chapter,
          session: data.session,
          status: data.status
        });
      }
    }
    
    return {
      affectedLessons: affectedLessons,
      holidays: holidays.filter(h => h.date >= startDate),
      totalCount: affectedLessons.length,
      message: `Found ${affectedLessons.length} lesson plans on ${holidayDates.length} holiday dates`
    };
    
  } catch (error) {
    console.error('Error getting affected lesson plans:', error);
    return { error: error.toString() };
  }
}

/**
 * Get recent cascade operations
 * @param {number} limit - Number of recent cascades to return
 * @returns {Array} List of cascade operations
 */
function getRecentCascades(limit = 10) {
  try {
    const historySheet = _getSheet('CascadeHistory');
    _ensureHeaders(historySheet, SHEETS.CascadeHistory);
    
    const headers = _headers(historySheet);
    const allRows = _rows(historySheet);
    
    // Group by cascadeId
    const cascadeMap = {};
    allRows.forEach(row => {
      const data = _indexByHeader(row, headers);
      if (!cascadeMap[data.cascadeId]) {
        cascadeMap[data.cascadeId] = {
          cascadeId: data.cascadeId,
          cascadeDate: data.cascadeDate,
          startDate: data.startDate,
          performedBy: data.performedBy,
          lessons: [],
          status: data.status
        };
      }
      cascadeMap[data.cascadeId].lessons.push({
        lessonPlanId: data.lessonPlanId,
        oldDate: data.oldDate,
        newDate: data.newDate,
        teacher: data.teacherEmail,
        class: data.class,
        subject: data.subject
      });
    });
    
    // Convert to array and sort by date
    const cascades = Object.values(cascadeMap)
      .sort((a, b) => new Date(b.cascadeDate) - new Date(a.cascadeDate))
      .slice(0, limit);
    
    return cascades;
    
  } catch (error) {
    console.error('Error getting cascade history:', error);
    return [];
  }
}

/**
 * Undo a specific cascade operation
 * @param {string} cascadeId - Cascade ID to undo
 * @param {string} userEmail - User performing the undo
 * @param {string} userName - User name
 * @returns {Object} Result with success or error
 */
function undoCascade(cascadeId, userEmail, userName) {
  try {
    const historySheet = _getSheet('CascadeHistory');
    const headers = _headers(historySheet);
    const allRows = _rows(historySheet);
    
    // Find all entries for this cascade
    const cascadeEntries = [];
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      if (data.cascadeId === cascadeId && data.status === 'cascaded') {
        cascadeEntries.push({
          rowNum: i + 2,
          data: data
        });
      }
    }
    
    if (cascadeEntries.length === 0) {
      return { error: 'Cascade not found or already undone' };
    }
    
    // Restore lesson plans to original dates
    const lpSheet = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSheet);
    const lpRows = _rows(lpSheet);
    
    const dateCol = lpHeaders.indexOf('selectedDate') !== -1 
      ? lpHeaders.indexOf('selectedDate') + 1 
      : (lpHeaders.indexOf('scheduledDate') !== -1 
        ? lpHeaders.indexOf('scheduledDate') + 1 
        : lpHeaders.indexOf('date') + 1);
    
    let restoredCount = 0;
    
    cascadeEntries.forEach(entry => {
      // Find the lesson plan and restore its date
      for (let i = 0; i < lpRows.length; i++) {
        const lpData = _indexByHeader(lpRows[i], lpHeaders);
        if (lpData.lpId === entry.data.lessonPlanId) {
          lpSheet.getRange(i + 2, dateCol).setValue(entry.data.oldDate);
          restoredCount++;
          break;
        }
      }
      
      // Mark as undone in history
      const statusCol = headers.indexOf('status') + 1;
      historySheet.getRange(entry.rowNum, statusCol).setValue('undone');
    });
    
    // Log audit
    logAudit({
      action: 'undid_cascade',
      entityType: 'LessonPlan',
      entityId: cascadeId,
      userEmail: userEmail,
      userName: userName,
      userRole: 'HM',
      afterData: {
        cascadeId: cascadeId,
        restoredCount: restoredCount
      },
      description: `Undid cascade operation ${cascadeId}, restored ${restoredCount} lesson plans`,
      severity: AUDIT_SEVERITY.WARNING
    });
    
    return {
      ok: true,
      restoredCount: restoredCount,
      message: `Successfully restored ${restoredCount} lesson plans to their original dates`
    };
    
  } catch (error) {
    console.error('Error undoing cascade:', error);
    return { error: error.toString() };
  }
}
