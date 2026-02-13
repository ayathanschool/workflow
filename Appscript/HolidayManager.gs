/**
 * HolidayManager.gs
 * Manages undeclared/sudden holidays and cascades lesson plans
 */


/**
 * Get all undeclared holidays
 * @param {boolean} activeOnly - Return only active holidays (default: true)
 * @returns {Array} List of holidays
 */
function getUndeclaredHolidays(activeOnly = true) {
  try {
    const sh = _getSheet('UndeclaredHolidays');
    if (!sh) {
      console.log('UndeclaredHolidays sheet not found, returning empty array');
      return [];
    }
    
    _ensureHeaders(sh, SHEETS.UndeclaredHolidays);
    
    const headers = _headers(sh);
    if (!headers || headers.length === 0) {
      console.log('No headers found in UndeclaredHolidays sheet');
      return [];
    }
    
    const rows = _rows(sh);
    if (!rows || rows.length === 0) {
      console.log('No data rows found in UndeclaredHolidays sheet');
      return [];
    }
    
    let holidays = rows.map(r => {
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
 * Check if a date is an undeclared holiday
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {boolean} True if date is a holiday
 */
function isUndeclaredHoliday(dateStr) {
  const holidays = getUndeclaredHolidays(true);
  return holidays.some(h => h.date === dateStr);
}

/**
 * Declare today as an undeclared holiday and cascade lesson plans
 * @param {string} reason - Reason for the holiday
 * @param {string} userEmail - User email (optional)
 * @param {string} userName - User name (optional)
 * @returns {Object} Result with holiday info and cascade results
 */
function declareTodayAsHoliday(reason, userEmail, userName) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return declareHoliday(todayStr, reason, userEmail, userName);
  } catch (error) {
    console.error('Error declaring today as holiday:', error);
    return {
      ok: false,
      error: error.toString()
    };
  }
}

/**
 * Declare any date as an undeclared holiday and cascade lesson plans
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} reason - Reason for the holiday
 * @param {string} userEmail - User email (optional)
 * @param {string} userName - User name (optional)
 * @returns {Object} Result with holiday info and cascade results
 */
function declareHoliday(dateStr, reason, userEmail, userName) {
  try {
    // Use provided user info or fallback to system defaults
    const declareUserEmail = userEmail || 'system@holiday.auto';
    const declareUserName = userName || 'Holiday Manager';
    
    // Validate and normalize date
    if (!dateStr) {
      return {
        ok: false,
        error: 'Date is required'
      };
    }
    
    const holidayDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    
    // Check if date is already declared as a holiday
    if (isUndeclaredHoliday(holidayDate)) {
      return {
        ok: false,
        error: `${holidayDate} is already declared as a holiday`
      };
    }
    
    // Add holiday to UndeclaredHolidays sheet
    const sh = _getSheet('UndeclaredHolidays');
    _ensureHeaders(sh, SHEETS.UndeclaredHolidays);
    
    const holidayId = 'HOL_' + Date.now();
    const createdAt = new Date().toISOString();
    
    sh.appendRow([
      holidayId,
      holidayDate,
      reason || 'Undeclared holiday',
      'active',
      declareUserEmail,
      createdAt,
      createdAt
    ]);
    
    console.log(`✓ Declared ${holidayDate} as holiday: ${reason}`);
    
    // Cascade all lesson plans from this date
    const cascadeResult = cascadeLessonPlansFromDate(holidayDate, declareUserEmail, declareUserName);
    
    return {
      ok: true,
      holiday: {
        holidayId: holidayId,
        date: holidayDate,
        reason: reason,
        declaredBy: declareUserEmail
      },
      cascadeResult: cascadeResult,
      message: `Declared ${holidayDate} as holiday and cascaded ${cascadeResult.affectedCount || 0} lesson plans`
    };
    
  } catch (error) {
    console.error('Error declaring holiday:', error);
    return {
      ok: false,
      error: error.toString()
    };
  }
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
 * CONVENIENCE FUNCTION: Cascade all lessons from today to next available day
 * Use this when declaring today as a sudden holiday
 * 
 * @param {string} userEmail - Optional: User email (defaults to 'System')
 * @param {string} userName - Optional: User name (defaults to 'Auto-Cascade')
 * @returns {Object} Result with count of affected lessons
 */
function cascadeTodaysLessonsToNextDay(userEmail, userName) {
  try {
    // Use provided user info or fallback to system defaults
    const cascadeUserEmail = userEmail || 'system@cascade.auto';
    const cascadeUserName = userName || 'Auto-Cascade System';
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`Cascading all lessons from today (${todayStr}) to next available day`);
    console.log(`Initiated by: ${cascadeUserName} (${cascadeUserEmail})`);
    
    // Call the main cascade function starting from today
    const result = cascadeLessonPlansFromDate(todayStr, cascadeUserEmail, cascadeUserName);
    
    return result;
    
  } catch (error) {
    console.error('Error cascading today\'s lessons:', error);
    return { 
      error: error.toString(),
      ok: false 
    };
  }
}

/**
 * Cascade lesson plans from a specific date onwards, skipping undeclared holidays
 * ENHANCED: Finds next available period on next DAY (not just next period)
 * Handles teachers with multiple periods per day correctly
 * 
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
    const errors = [];
    
    // Find all lesson plans on holiday dates that are not completed
    const lessonsToReschedule = [];
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
      
      // Only process lessons on holiday dates
      if (holidayDates.includes(dateStr)) {
        lessonsToReschedule.push({
          rowNum: i + 2, // +1 for header, +1 for 0-index
          oldDate: dateStr,
          oldPeriod: data.selectedPeriod,
          lessonId: data.lpId || data.id || data.lessonId,
          teacherEmail: data.teacherEmail,
          class: data.class,
          subject: data.subject,
          chapter: data.chapter,
          session: data.session,
          schemeId: data.schemeId
        });
      }
    }
    
    if (lessonsToReschedule.length === 0) {
      return { 
        ok: true, 
        message: 'No lesson plans found on holiday dates',
        affectedCount: 0,
        updatedLessons: 0
      };
    }
    
    console.log(`Found ${lessonsToReschedule.length} lessons to reschedule`);
    
    // Get column indices for updates
    const dateCol = headers.indexOf('selectedDate') !== -1 
      ? headers.indexOf('selectedDate') + 1 
      : (headers.indexOf('scheduledDate') !== -1 
        ? headers.indexOf('scheduledDate') + 1 
        : headers.indexOf('date') + 1);
    
    const periodCol = headers.indexOf('selectedPeriod') !== -1
      ? headers.indexOf('selectedPeriod') + 1
      : (headers.indexOf('period') !== -1
        ? headers.indexOf('period') + 1
        : -1);
    
    if (periodCol === -1) {
      return { 
        error: 'Could not find period column in LessonPlans sheet',
        ok: false 
      };
    }
    
    // For each lesson, find the next available period on the next working day (not just next period)
    for (const lesson of lessonsToReschedule) {
      try {
        // Find next working day (skip weekends and holidays)
        const nextWorkingDay = getNextWorkingDay(lesson.oldDate);
        
        // Use getNextAvailablePeriodForLessonPlan to find the proper slot
        // This checks timetable and existing lesson plans
        const result = getNextAvailablePeriodForLessonPlan(
          lesson.teacherEmail,
          lesson.class,
          lesson.subject,
          nextWorkingDay // Start search from next working day
        );
        
        if (result && result.success && result.nextSlot) {
          const newDate = result.nextSlot.date;
          const newPeriod = result.nextSlot.period;
          
          // Apply updates to the sheet
          sh.getRange(lesson.rowNum, dateCol).setValue(newDate);
          sh.getRange(lesson.rowNum, periodCol).setValue(newPeriod);
          
          affectedCount++;
          updates.push({
            rowNum: lesson.rowNum,
            lessonId: lesson.lessonId,
            oldDate: lesson.oldDate,
            oldPeriod: lesson.oldPeriod,
            newDate: newDate,
            newPeriod: newPeriod,
            teacher: lesson.teacherEmail,
            class: lesson.class,
            subject: lesson.subject,
            chapter: lesson.chapter,
            session: lesson.session
          });
          
          console.log(`✓ Rescheduled ${lesson.class} ${lesson.subject} from ${lesson.oldDate} P${lesson.oldPeriod} → ${newDate} P${newPeriod}`);
          
        } else {
          // Could not find available slot
          const errorMsg = (result && result.error) || 'No available period found';
          errors.push({
            lessonId: lesson.lessonId,
            class: lesson.class,
            subject: lesson.subject,
            teacher: lesson.teacherEmail,
            oldDate: lesson.oldDate,
            error: errorMsg
          });
          console.error(`✗ Failed to reschedule ${lesson.class} ${lesson.subject}: ${errorMsg}`);
        }
        
      } catch (lessonError) {
        errors.push({
          lessonId: lesson.lessonId,
          class: lesson.class,
          subject: lesson.subject,
          error: lessonError.toString()
        });
        console.error(`Error rescheduling lesson ${lesson.lessonId}:`, lessonError);
      }
    }
    
    // Store cascade history
    const cascadeId = 'CAS_' + Date.now();
    const cascadeDate = new Date().toISOString();
    const historySheet = _getSheet('CascadeHistory');
    _ensureHeaders(historySheet, SHEETS.CascadeHistory);
    
    updates.forEach(update => {
      // Record in cascade history (extended with period info)
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
        'cascaded',
        update.oldPeriod || '',  // Old period
        update.newPeriod || ''   // New period
      ]);
    });
    
    // Log audit for cascade operation
    if (affectedCount > 0 || errors.length > 0) {
      logAudit({
        action: 'cascaded_lesson_plans',
        entityType: 'LessonPlan',
        entityId: cascadeId,
        userEmail: userEmail,
        userName: userName,
        userRole: 'HM',
        afterData: {
          startDate: startDate,
          holidays: holidayDates,
          successCount: affectedCount,
          errorCount: errors.length,
          updates: updates.map(u => ({ 
            lessonId: u.lessonId, 
            oldDate: u.oldDate, 
            oldPeriod: u.oldPeriod,
            newDate: u.newDate,
            newPeriod: u.newPeriod,
            class: u.class,
            subject: u.subject
          })),
          errors: errors
        },
        description: `Cascaded ${affectedCount} lesson plans to skip ${holidayDates.length} holidays. ${errors.length} errors.`,
        severity: errors.length > 0 ? AUDIT_SEVERITY.ERROR : AUDIT_SEVERITY.WARNING
      });
    }
    
    return { 
      ok: true, 
      affectedCount: affectedCount,
      updatedLessons: updates.length,
      errorCount: errors.length,
      errors: errors,
      holidays: holidayDates,
      message: `Successfully cascaded ${affectedCount} lesson plans to next day. ${errors.length > 0 ? `${errors.length} lessons could not be rescheduled.` : ''}`
    };
    
  } catch (error) {
    console.error('Error cascading lesson plans:', error);
    return { error: error.toString(), ok: false };
  }
}

/**
 * Get preview of lesson plans that will be affected by cascading from a date
 * @param {string} startDate - Date from which to preview cascading (YYYY-MM-DD)
 * @returns {Object} Preview data with affected lessons
 */
function getAffectedLessonPlans(startDate, checkSpecificDateOnly) {
  try {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    // If checking a specific date (preview mode), just check that date
    // Otherwise, check all declared holidays from startDate onwards
    let datesToCheck = [];
    
    if (checkSpecificDateOnly) {
      // Preview mode: check only the specific date provided
      datesToCheck = [startDate];
    } else {
      // Normal mode: check all declared holidays
      const holidays = getUndeclaredHolidays(true);
      datesToCheck = holidays
        .filter(h => h.date >= startDate)
        .map(h => h.date);
      
      if (datesToCheck.length === 0) {
        return { 
          affectedLessons: [], 
          holidays: [],
          message: 'No holidays found from this date onwards'
        };
      }
    }
    
    const affectedLessons = [];
    
    // Find all lesson plans on the dates to check that are not completed
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
      
      // Check if lesson is on one of the dates to check
      if (datesToCheck.includes(dateStr)) {
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
    
    const holidays = checkSpecificDateOnly ? [] : getUndeclaredHolidays(true).filter(h => h.date >= startDate);
    
    return {
      affectedLessons: affectedLessons,
      holidays: holidays,
      totalCount: affectedLessons.length,
      message: `Found ${affectedLessons.length} lesson plans on ${datesToCheck.length} date(s)`
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
 * Restores both date AND period to their original values
 * 
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
    
    // Restore lesson plans to original dates AND periods
    const lpSheet = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSheet);
    const lpRows = _rows(lpSheet);
    
    const dateCol = lpHeaders.indexOf('selectedDate') !== -1 
      ? lpHeaders.indexOf('selectedDate') + 1 
      : (lpHeaders.indexOf('scheduledDate') !== -1 
        ? lpHeaders.indexOf('scheduledDate') + 1 
        : lpHeaders.indexOf('date') + 1);
    
    const periodCol = lpHeaders.indexOf('selectedPeriod') !== -1
      ? lpHeaders.indexOf('selectedPeriod') + 1
      : (lpHeaders.indexOf('period') !== -1
        ? lpHeaders.indexOf('period') + 1
        : -1);
    
    let restoredCount = 0;
    
    cascadeEntries.forEach(entry => {
      // Find the lesson plan and restore its date and period
      for (let i = 0; i < lpRows.length; i++) {
        const lpData = _indexByHeader(lpRows[i], lpHeaders);
        if (lpData.lpId === entry.data.lessonPlanId) {
          // Restore date
          lpSheet.getRange(i + 2, dateCol).setValue(entry.data.oldDate);
          
          // Restore period if we have the column and old period value
          if (periodCol !== -1 && entry.data.oldPeriod) {
            lpSheet.getRange(i + 2, periodCol).setValue(entry.data.oldPeriod);
          }
          
          restoredCount++;
          console.log(`Restored ${lpData.class} ${lpData.subject} to ${entry.data.oldDate} P${entry.data.oldPeriod || 'N/A'}`);
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
      description: `Undid cascade operation ${cascadeId}, restored ${restoredCount} lesson plans to their original dates and periods`,
      severity: AUDIT_SEVERITY.WARNING
    });
    
    return {
      ok: true,
      restoredCount: restoredCount,
      message: `Successfully restored ${restoredCount} lesson plans to their original dates and periods`
    };
    
  } catch (error) {
    console.error('Error undoing cascade:', error);
    return { error: error.toString() };
  }
}
