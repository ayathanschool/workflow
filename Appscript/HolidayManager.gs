/**
 * HolidayManager.gs
 * Manages lesson plan cascading with flexible next-day or next-period options
 */

/**
 * Get lesson plans by date range with optional filters
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {Object} filters - Optional filters {teacherEmail, class}
 * @returns {Array} List of lesson plans
 */
function getLessonsByDateRange(startDate, endDate, filters = {}) {
  try {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    const lessons = [];
    
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      const lessonDate = data.selectedDate || data.scheduledDate || data.date;
      
      // Skip if no date or lesson is completed
      if (!lessonDate || data.status === 'completed' || data.status === 'Completed') {
        continue;
      }
      
      // Convert date to string format
      let dateStr = lessonDate;
      if (lessonDate instanceof Date) {
        const year = lessonDate.getFullYear();
        const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
        const day = String(lessonDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      
      // Check date range
      if (dateStr >= startDate && dateStr <= endDate) {
        // Apply filters
        if (filters.teacherEmail && data.teacherEmail !== filters.teacherEmail) continue;
        if (filters.class && data.class !== filters.class) continue;
        
        lessons.push({
          lpId: data.lpId,
          date: dateStr,
          period: data.selectedPeriod || 'N/A',
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
    
    // Sort by date, then period
    lessons.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.period || 0) - (b.period || 0);
    });
    
    return lessons;
    
  } catch (error) {
    console.error('Error getting lessons by date range:', error);
    return [];
  }
}

/**
 * Get next working day (skipping Sundays)
 * @param {string} dateStr - Starting date (YYYY-MM-DD)
 * @returns {string} Next working day (YYYY-MM-DD)
 */
function getNextWorkingDay(dateStr) {
  const date = new Date(dateStr);
  let nextDate = new Date(date);
  
  do {
    nextDate.setDate(nextDate.getDate() + 1);
    const day = nextDate.getDay();
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    // Skip Sunday (0)
    if (day !== 0) {
      return nextDateStr;
    }
  } while (true);
}

/**
 * Get day of week name from date string
 * @param {string} dateStr - Date (YYYY-MM-DD)
 * @returns {string} Day name (Monday, Tuesday, etc)
 */
function getDayName(dateStr) {
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Find next timetable slot for a teacher-class-subject combination
 * @param {string} teacherEmail - Teacher email
 * @param {string} className - Class name
 * @param {string} subject - Subject name
 * @param {string} currentDate - Current date (YYYY-MM-DD)
 * @param {number} currentPeriod - Current period number
 * @param {string} mode - 'skip-day' or 'next-period'
 * @returns {Object} {date: string, period: number, dayOfWeek: string} or null if not found
 */
function getNextTimetableSlot(teacherEmail, className, subject, currentDate, currentPeriod, mode) {
  try {
    // Get timetable entries for this teacher-class-subject
    const timetable = _getCachedSheetData('Timetable').data;
    const slots = timetable.filter(entry => 
      (entry.teacherEmail || '').toLowerCase() === (teacherEmail || '').toLowerCase() &&
      (entry.class || '') === (className || '') &&
      (entry.subject || '') === (subject || '')
    );
    
    if (slots.length === 0) {
      console.warn(`No timetable slots found for ${teacherEmail}, ${className}, ${subject}`);
      return null;
    }
    
    // Map day names to numbers (Sunday=0, Monday=1, etc.)
    const dayMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    // Convert current date to day number
    const currentDayNum = new Date(currentDate).getDay();
    
    // Sort slots by day of week, then by period
    slots.sort((a, b) => {
      const dayA = dayMap[_normalizeDayName(a.dayOfWeek)] || 0;
      const dayB = dayMap[_normalizeDayName(b.dayOfWeek)] || 0;
      if (dayA !== dayB) return dayA - dayB;
      return parseInt(a.period) - parseInt(b.period);
    });
    
    if (mode === 'skip-day') {
      // MODE 1: Skip current day completely, go to next day in timetable
      for (let slot of slots) {
        const slotDayNum = dayMap[_normalizeDayName(slot.dayOfWeek)] || 0;
        const slotPeriod = parseInt(slot.period);
        
        // Only consider slots on DIFFERENT day (later in week)
        if (slotDayNum > currentDayNum) {
          const daysAhead = slotDayNum - currentDayNum;
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + daysAhead);
          return {
            date: nextDate.toISOString().split('T')[0],
            period: slotPeriod,
            dayOfWeek: slot.dayOfWeek
          };
        }
      }
      
      // If no slot found later this week, take first slot of next week
      const firstSlot = slots[0];
      const firstDayNum = dayMap[_normalizeDayName(firstSlot.dayOfWeek)] || 0;
      const daysToAdd = (7 - currentDayNum + firstDayNum) % 7 || 7;
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      
      return {
        date: nextDate.toISOString().split('T')[0],
        period: parseInt(firstSlot.period),
        dayOfWeek: firstSlot.dayOfWeek
      };
      
    } else {
      // MODE 2: Next period (can be same day if later period exists)
      for (let slot of slots) {
        const slotDayNum = dayMap[_normalizeDayName(slot.dayOfWeek)] || 0;
        const slotPeriod = parseInt(slot.period);
        
        // If same day but later period - TAKE IT
        if (slotDayNum === currentDayNum && slotPeriod > currentPeriod) {
          return {
            date: currentDate,
            period: slotPeriod,
            dayOfWeek: slot.dayOfWeek
          };
        }
        
        // If slot is on a later day this week
        if (slotDayNum > currentDayNum) {
          const daysAhead = slotDayNum - currentDayNum;
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + daysAhead);
          return {
            date: nextDate.toISOString().split('T')[0],
            period: slotPeriod,
            dayOfWeek: slot.dayOfWeek
          };
        }
      }
      
      // If no slot found in current week, take the first slot of next week
      const firstSlot = slots[0];
      const firstDayNum = dayMap[_normalizeDayName(firstSlot.dayOfWeek)] || 0;
      const daysToAdd = (7 - currentDayNum + firstDayNum) % 7 || 7;
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      
      return {
        date: nextDate.toISOString().split('T')[0],
        period: parseInt(firstSlot.period),
        dayOfWeek: firstSlot.dayOfWeek
      };
    }
    
  } catch (error) {
    console.error('Error finding next timetable slot:', error);
    return null;
  }
}

/**
 * Cascade selected lesson plans with mode (next-day or next-period)
 * @param {Array} lessonIds - Array of lesson plan IDs to cascade
 * @param {string} mode - 'next-day' or 'next-period'
 * @param {string} userEmail - User email
 * @param {string} userName - User name
 * @returns {Object} Result with count of affected lessons
 */
function cascadeSelectedLessons(lessonIds, mode, userEmail, userName) {
  try {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    const updates = [];
    const errors = [];
    
    // Find lessons with matching IDs
    for (let i = 0; i < allRows.length; i++) {
      const data = _indexByHeader(allRows[i], headers);
      
      if (lessonIds.includes(data.lpId)) {
        const lessonDate = data.selectedDate || data.scheduledDate || data.date;
        let dateStr = lessonDate;
        if (lessonDate instanceof Date) {
          const year = lessonDate.getFullYear();
          const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
          const day = String(lessonDate.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
        
        let newDate = dateStr;
        let newPeriod = data.selectedPeriod;
        
        // Use timetable-based cascading with mode
        const nextSlot = getNextTimetableSlot(
          data.teacherEmail,
          data.class,
          data.subject,
          dateStr,
          parseInt(data.selectedPeriod),
          mode // Pass mode: 'skip-day' or 'next-period'
        );
        
        if (nextSlot) {
          newDate = nextSlot.date;
          newPeriod = nextSlot.period;
          
          updates.push({
            rowNum: i + 2,
            oldDate: dateStr,
            newDate: newDate,
            oldPeriod: data.selectedPeriod,
            newPeriod: newPeriod,
            lessonId: data.lpId,
            teacher: data.teacherEmail,
            class: data.class,
            subject: data.subject
          });
        } else {
          errors.push({
            lessonId: data.lpId,
            teacher: data.teacherEmail,
            class: data.class,
            subject: data.subject,
            reason: 'No timetable slot found'
          });
        }
      }
    }
    
    if (updates.length === 0) {
      if (errors.length > 0) {
        return { 
          error: `Could not cascade ${errors.length} lesson(s). No matching timetable slots found.`,
          details: errors
        };
      }
      return { error: 'No matching lessons found' };
    }
    
    // Apply updates
    const dateCol = headers.indexOf('selectedDate') !== -1 
      ? headers.indexOf('selectedDate') + 1 
      : (headers.indexOf('scheduledDate') !== -1 
        ? headers.indexOf('scheduledDate') + 1 
        : headers.indexOf('date') + 1);
    
    const periodCol = headers.indexOf('selectedPeriod') + 1;
    
    const cascadeId = 'CAS_' + Date.now();
    const cascadeDate = new Date().toISOString();
    
    // Store cascade history
    const historySheet = _getSheet('CascadeHistory');
    _ensureHeaders(historySheet, SHEETS.CascadeHistory);
    
    updates.forEach(update => {
      // Update lesson plan date
      sh.getRange(update.rowNum, dateCol).setValue(update.newDate);
      
      // Update period (always update since it's from timetable)
      if (periodCol > 0) {
        sh.getRange(update.rowNum, periodCol).setValue(update.newPeriod);
      }
      
      // Record in cascade history
      historySheet.appendRow([
        cascadeId,
        cascadeDate,
        update.oldDate,
        userEmail,
        cascadeDate,
        update.lessonId,
        update.oldDate,
        update.newDate,
        update.oldPeriod,
        update.newPeriod,
        update.teacher,
        update.class,
        update.subject,
        'cascaded'
      ]);
    });
    
    // Log audit
    logAudit({
      action: 'cascaded_lesson_plans',
      entityType: 'LessonPlan',
      entityId: cascadeId,
      userEmail: userEmail,
      userName: userName,
      userRole: 'Admin',
      afterData: {
        mode: mode,
        count: updates.length,
        errors: errors.length,
        updates: updates.map(u => ({ 
          lessonId: u.lessonId, 
          oldDate: u.oldDate, 
          newDate: u.newDate,
          oldPeriod: u.oldPeriod,
          newPeriod: u.newPeriod
        }))
      },
      description: `Cascaded ${updates.length} lesson plans to next timetable slots${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      severity: AUDIT_SEVERITY.WARNING
    });
    
    const message = `Successfully cascaded ${updates.length} lesson plan(s) to their next timetable slots.` +
      (errors.length > 0 ? ` ${errors.length} lesson(s) could not be cascaded (no timetable slots found).` : '');
    
    return { 
      ok: true, 
      updatedLessons: updates.length,
      failedLessons: errors.length,
      mode: mode,
      message: message,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('Error cascading lessons:', error);
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
    
    // Restore lesson plans to original dates and periods
    const lpSheet = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSheet);
    const lpRows = _rows(lpSheet);
    
    const dateCol = lpHeaders.indexOf('selectedDate') !== -1 
      ? lpHeaders.indexOf('selectedDate') + 1 
      : (lpHeaders.indexOf('scheduledDate') !== -1 
        ? lpHeaders.indexOf('scheduledDate') + 1 
        : lpHeaders.indexOf('date') + 1);
    
    const periodCol = lpHeaders.indexOf('selectedPeriod') + 1;
    
    let restoredCount = 0;
    
    cascadeEntries.forEach(entry => {
      // Find the lesson plan and restore its date and period
      for (let i = 0; i < lpRows.length; i++) {
        const lpData = _indexByHeader(lpRows[i], lpHeaders);
        if (lpData.lpId === entry.data.lessonPlanId) {
          // Restore date
          lpSheet.getRange(i + 2, dateCol).setValue(entry.data.oldDate);
          
          // Restore period if we have the old period data
          if (periodCol > 0 && entry.data.oldPeriod) {
            lpSheet.getRange(i + 2, periodCol).setValue(entry.data.oldPeriod);
          }
          
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
      userRole: 'Admin',
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
      message: `Successfully restored ${restoredCount} lesson plan(s) to their original dates and periods`
    };
    
  } catch (error) {
    console.error('Error undoing cascade:', error);
    return { error: error.toString() };
  }
}
