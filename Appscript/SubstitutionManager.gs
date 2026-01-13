/**
 * ====== SUBSTITUTION MANAGEMENT SYSTEM ======
 * This file handles teacher substitutions and notifications
 * Think of this as your "Substitute Teacher Coordinator"
 */

/**
 * Assign a substitute teacher for an absent teacher
 */
function assignSubstitution(data) {
  const result = assignSubstitutionsBatch({ date: data && data.date, substitutions: [data] });
  if (!result || result.success !== true) {
    const firstErr = Array.isArray(result && result.errors) && result.errors.length
      ? (result.errors[0].error || result.errors[0].message)
      : null;
    return { error: (result && result.error) || firstErr || 'Failed to assign substitution' };
  }
  if (Number(result.createdCount || 0) <= 0) {
    const firstErr = Array.isArray(result && result.errors) && result.errors.length
      ? (result.errors[0].error || result.errors[0].message)
      : null;
    return { error: firstErr || 'Substitution already exists for this time slot' };
  }
  const cascadeInfo = Array.isArray(result.cascadeResults) && result.cascadeResults.length
    ? result.cascadeResults[0]
    : null;
  return { submitted: true, cascadeInfo: cascadeInfo };
}

function _subKey(dateIso, period, className, absentTeacher) {
  return [
    String(dateIso || '').trim(),
    String(period || '').trim(),
    String(className || '').trim(),
    String(absentTeacher || '').trim().toLowerCase()
  ].join('|');
}

/**
 * Bulk assign substitutions for a full day in one click.
 * Payload format:
 * {
 *   date: 'YYYY-MM-DD', // optional; used as fallback for items
 *   substitutions: [
 *     {
 *       date, period, class, absentTeacher, regularSubject,
 *       substituteTeacher, substituteSubject, note
 *     }
 *   ]
 * }
 */
function assignSubstitutionsBatch(payload) {
  const sh = _getSheet('Substitutions');
  _ensureHeaders(sh, SHEETS.Substitutions);

  const baseDate = _isoDateString(payload && payload.date);
  const substitutions = Array.isArray(payload && payload.substitutions)
    ? payload.substitutions
    : [];

  if (!substitutions.length) {
    return { success: false, error: 'No substitutions provided', createdCount: 0, errors: [] };
  }

  const headers = _headers(sh);
  const now = new Date().toISOString();

  // Build existing keys for the target date(s) to prevent duplicates.
  const existingKeys = new Set();
  try {
    _rows(sh)
      .map(r => _indexByHeader(r, headers))
      .forEach(r => {
        const rowDate = _isoDateString(r.date);
        // If baseDate exists, focus on it; otherwise include all rows.
        if (baseDate && rowDate !== baseDate) return;
        existingKeys.add(_subKey(rowDate, r.period, r.class, r.absentTeacher));
      });
  } catch (e) {
    // If reading rows fails, proceed without duplicate set (worst case duplicates prevented by frontend).
  }

  const rowsToAppend = [];
  const createdItems = [];
  const errors = [];

  for (let idx = 0; idx < substitutions.length; idx++) {
    const s = substitutions[idx] || {};
    const normalizedDate = _isoDateString(s.date || baseDate);
    if (!normalizedDate) {
      errors.push({ index: idx, error: 'Valid date is required' });
      continue;
    }

    const period = String(s.period || '').trim();
    const className = String(s.class || '').trim();
    const absentTeacher = String(s.absentTeacher || '').trim();

    if (!period || !className || !absentTeacher) {
      errors.push({ index: idx, error: 'period, class, and absentTeacher are required' });
      continue;
    }

    const key = _subKey(normalizedDate, period, className, absentTeacher);
    if (existingKeys.has(key)) {
      errors.push({ index: idx, error: 'Substitution already exists for this time slot' });
      continue;
    }

    const row = [
      normalizedDate,
      period,
      className,
      absentTeacher,
      s.regularSubject || '',
      s.substituteTeacher || '',
      s.substituteSubject || s.regularSubject || '',
      s.note || '',
      'FALSE', // acknowledged
      '', // acknowledgedBy
      '', // acknowledgedAt
      now // createdAt
    ];

    rowsToAppend.push(row);
    createdItems.push({
      date: normalizedDate,
      period: period,
      class: className,
      absentTeacher: absentTeacher,
      regularSubject: s.regularSubject || '',
      substituteTeacher: s.substituteTeacher || '',
      substituteSubject: s.substituteSubject || s.regularSubject || '',
      note: s.note || ''
    });
    existingKeys.add(key);
  }

  if (!rowsToAppend.length) {
    return { success: false, error: 'No substitutions created', createdCount: 0, errors: errors };
  }

  // Single sheet write for performance
  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  // Store date column as text
  sh.getRange(startRow, 1, rowsToAppend.length, 1).setNumberFormat('@STRING@');

  // Best-effort: notifications + cascades
  const cascadeResults = [];
  for (let i = 0; i < createdItems.length; i++) {
    const item = createdItems[i];
    try {
      if (item.substituteTeacher) _sendSubstitutionNotification(item);
    } catch (notifyErr) {
      // Don't fail batch on notification errors
    }

    let cascadeResult = null;
    try {
      cascadeResult = _handleAbsentTeacherLessonPlan(
        item.absentTeacher,
        item.date,
        item.period,
        item.class,
        item.regularSubject
      );
    } catch (cascadeErr) {
      Logger.log(`[assignSubstitutionsBatch] Cascade error: ${cascadeErr.message}`);
    }
    cascadeResults.push(cascadeResult);
  }

  invalidateCache('substitutions');
  invalidateCache('timetable');

  return {
    success: true,
    createdCount: rowsToAppend.length,
    errors: errors,
    cascadeResults: cascadeResults
  };
}

/**
 * Get substitutions for a specific date
 */
function getSubstitutionsForDate(date) {
  const normalizedDate = _isoDateString(date);
  
  // Cache substitutions for 1 minute (changes frequently)
  const cacheKey = generateCacheKey('substitutions', { date: normalizedDate });
  return getCachedData(cacheKey, function() {
    return _fetchSubstitutionsForDate(normalizedDate);
  }, CACHE_TTL.SHORT);
}

function _fetchSubstitutionsForDate(normalizedDate) {
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    return rowDate === normalizedDate;
  });
  
  Logger.log(`[getSubstitutionsForDate] Found ${substitutions.length} substitutions for ${normalizedDate}`);
  
  // Sort by period and class
  substitutions.sort((a, b) => {
    const periodCompare = (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
    if (periodCompare !== 0) return periodCompare;
    return (a.class || '').localeCompare(b.class || '');
  });
  
  return {
    date: normalizedDate,
    substitutions
  };
}

/**
 * Get substitutions assigned to a specific teacher
 */
function getTeacherSubstitutions(teacherEmail, date) {
  const normalizedDate = _isoDateString(date);
  
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
    return rowDate === normalizedDate && rowTeacher === teacherEmail.toLowerCase();
  });
  
  Logger.log(`[getTeacherSubstitutions] Found ${substitutions.length} substitutions for ${teacherEmail}`);
  
  // Sort by period
  substitutions.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));
  
  return {
    date: normalizedDate,
    teacherEmail,
    assignedSubstitutions: substitutions
  };
}

/**
 * Get all substitutions assigned to a specific teacher within a date range
 * More efficient than calling getTeacherSubstitutions multiple times
 */
function getTeacherSubstitutionsRange(teacherEmail, startDate, endDate) {
  const normalizedStart = _isoDateString(startDate);
  const normalizedEnd = _isoDateString(endDate);
  
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
    return rowTeacher === teacherEmail.toLowerCase() && rowDate >= normalizedStart && rowDate <= normalizedEnd;
  });
  
  Logger.log(`[getTeacherSubstitutionsRange] Found ${substitutions.length} substitutions for ${teacherEmail}`);
  
  // Sort by date descending, then by period
  substitutions.sort((a, b) => {
    const dateCompare = _isoDateString(b.date).localeCompare(_isoDateString(a.date));
    if (dateCompare !== 0) return dateCompare;
    return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
  });
  
  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    teacherEmail,
    substitutions
  };
}

/**
 * Delete a substitution
 */
function deleteSubstitution(data) {
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const rows = sh.getDataRange().getValues();
  
  const normalizedDate = _isoDateString(data.date);
  
  // Find the row to delete
  for (let i = 1; i < rows.length; i++) {
    const row = _indexByHeader(rows[i], headers);
    if (_isoDateString(row.date) === normalizedDate &&
        row.period === data.period &&
        row.class === data.class &&
        String(row.absentTeacher || '').toLowerCase() === String(data.absentTeacher || '').toLowerCase()) {
      
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Substitution not found' };
}

/**
 * Send notification to substitute teacher
 */
function _sendSubstitutionNotification(substitutionData) {
  try {
    const notificationSh = _getSheet('SubstitutionNotifications');
    _ensureHeaders(notificationSh, SHEETS.SubstitutionNotifications);
    
    const notificationId = _uuid();
    const now = new Date().toISOString();
    
    const title = `Substitution Assignment - ${substitutionData.class}`;
    const message = `You have been assigned to substitute for ${substitutionData.absentTeacher} on ${substitutionData.date} during Period ${substitutionData.period} for Class ${substitutionData.class}. Subject: ${substitutionData.substituteSubject || substitutionData.regularSubject}`;
    
    const notificationData = [
      notificationId,
      substitutionData.substituteTeacher,
      title,
      message,
      'substitution',
      JSON.stringify({
        date: substitutionData.date,
        period: substitutionData.period,
        class: substitutionData.class,
        absentTeacher: substitutionData.absentTeacher,
        subject: substitutionData.substituteSubject || substitutionData.regularSubject
      }),
      'FALSE', // acknowledged
      '', // acknowledgedAt
      now
    ];
    
    notificationSh.appendRow(notificationData);
    
    // Also send email notification
    _sendSubstitutionEmail(substitutionData);
    
  } catch (error) {
    console.error('Error sending substitution notification:', error);
  }
}

/**
 * Send email notification for substitution
 */
function _sendSubstitutionEmail(substitutionData) {
  try {
    const subject = `Substitution Assignment - ${substitutionData.class} (${substitutionData.date})`;
    const body = `
Dear ${substitutionData.substituteTeacher},

You have been assigned to substitute for ${substitutionData.absentTeacher} with the following details:

📅 Date: ${substitutionData.date}
⏰ Period: ${substitutionData.period}
🎓 Class: ${substitutionData.class}
📚 Subject: ${substitutionData.substituteSubject || substitutionData.regularSubject}
📝 Note: ${substitutionData.note || 'No additional notes'}

Please acknowledge this assignment by logging into the school system.

Thank you for your cooperation.

Best regards,
School Administration
    `;
    
    // Send email using the basic email function
    sendEmailNotification(substitutionData.substituteTeacher, subject, body);
    
  } catch (error) {
    console.error('Error sending substitution email:', error);
  }
}

/**
 * Get unacknowledged substitution notifications for a teacher
 */
function getUnacknowledgedSubstitutions(teacherEmail) {
  const sh = _getSheet('SubstitutionNotifications');
  const headers = _headers(sh);
  const notifications = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => 
      String(r.recipient || '').toLowerCase() === teacherEmail.toLowerCase() &&
      String(r.acknowledged || '').toLowerCase() !== 'true'
    );
  
  return notifications;
}

/**
 * Acknowledge a substitution notification
 */
function acknowledgeSubstitution(notificationId, teacherEmail) {
  const sh = _getSheet('SubstitutionNotifications');
  const headers = _headers(sh);
  const rows = sh.getDataRange().getValues();
  
  // Find and update the notification
  for (let i = 1; i < rows.length; i++) {
    const row = _indexByHeader(rows[i], headers);
    if (row.id === notificationId && 
        String(row.recipient || '').toLowerCase() === teacherEmail.toLowerCase()) {
      
      // Update acknowledged status
      const acknowledgedColIndex = headers.indexOf('acknowledged') + 1;
      const acknowledgedAtColIndex = headers.indexOf('acknowledgedAt') + 1;
      
      sh.getRange(i + 1, acknowledgedColIndex).setValue('TRUE');
      sh.getRange(i + 1, acknowledgedAtColIndex).setValue(new Date().toISOString());
      
      return { success: true };
    }
  }
  
  return { error: 'Notification not found' };
}

/**
 * Get all substitution notifications for a teacher (acknowledged and unacknowledged)
 * Alias for getTeacherSubstitutionNotifications for frontend compatibility
 */
function getSubstitutionNotifications(teacherEmail) {
  const cacheKey = generateCacheKey('sub_notifications', { email: teacherEmail });
  return getCachedData(cacheKey, function() {
    return getTeacherSubstitutionNotifications(teacherEmail);
  }, CACHE_TTL.SHORT);
}

/**
 * Get all substitution notifications for a teacher (acknowledged and unacknowledged)
 */
function getTeacherSubstitutionNotifications(teacherEmail) {
  try {
    const sh = _getSheet('SubstitutionNotifications');
    const headers = _headers(sh);
    const notifications = _rows(sh)
      .map(r => _indexByHeader(r, headers))
      .filter(r => String(r.recipient || '').toLowerCase() === teacherEmail.toLowerCase());
    
    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    Logger.log(`[getTeacherSubstitutionNotifications] Found ${notifications.length} notifications for ${teacherEmail}`);
    
    // Return in expected format with notifications array
    return {
      success: true,
      notifications: notifications,
      count: notifications.length
    };
  } catch (error) {
    Logger.log(`[getTeacherSubstitutionNotifications] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      notifications: []
    };
  }
}

/**
 * Acknowledge a substitution assignment (in Substitutions sheet)
 */
function acknowledgeSubstitutionAssignment(data) {
  try {
    const sh = _getSheet('Substitutions');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();
    
    const normalizedDate = _isoDateString(data.date);
    const teacherEmail = String(data.teacherEmail || '').toLowerCase();
    
    Logger.log(`[acknowledgeSubstitutionAssignment] Looking for: date=${normalizedDate}, period=${data.period}, class=${data.class}, teacher=${teacherEmail}`);
    
    // Find the substitution row
    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      const rowDate = _isoDateString(row.date);
      const rowSubstitute = String(row.substituteTeacher || '').toLowerCase();
      
      if (rowDate === normalizedDate &&
          String(row.period) === String(data.period) &&
          String(row.class || '').toLowerCase() === String(data.class || '').toLowerCase() &&
          rowSubstitute === teacherEmail) {
        
        Logger.log(`[acknowledgeSubstitutionAssignment] Found matching row at index ${i}`);
        
        // Update acknowledgment fields
        const acknowledgedColIndex = headers.indexOf('acknowledged') + 1;
        const acknowledgedByColIndex = headers.indexOf('acknowledgedBy') + 1;
        const acknowledgedAtColIndex = headers.indexOf('acknowledgedAt') + 1;
        
        sh.getRange(i + 1, acknowledgedColIndex).setValue('TRUE');
        sh.getRange(i + 1, acknowledgedByColIndex).setValue(data.teacherEmail);
        sh.getRange(i + 1, acknowledgedAtColIndex).setValue(new Date().toISOString());
        
        // Invalidate cache for this teacher
        invalidateCache('sub_notifications_email:' + teacherEmail);
        
        Logger.log(`[acknowledgeSubstitutionAssignment] Successfully acknowledged`);
        
        return { success: true, message: 'Substitution acknowledged successfully' };
      }
    }
    
    Logger.log(`[acknowledgeSubstitutionAssignment] No matching substitution found`);
    return { error: 'Substitution not found' };
    
  } catch (error) {
    Logger.log(`[acknowledgeSubstitutionAssignment] Error: ${error}`);
    return { error: 'Failed to acknowledge substitution: ' + error.toString() };
  }
}

/**
 * Handle absent teacher's lesson plan when substitution is assigned
 * Automatically cascades scheme-based lesson plans to preserve preparation work
 */
function _handleAbsentTeacherLessonPlan(absentTeacher, date, period, className, subject) {
  try {
    // Find the absent teacher's lesson plan for this slot
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const allPlans = _rows(lessonPlansSheet).map(r => _indexByHeader(r, headers));
    
    const absentEmail = String(absentTeacher || '').toLowerCase().trim();
    const normalizedDate = _isoDateString(date);
    
    const absentPlan = allPlans.find(p => {
      const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === absentEmail;
      const dateMatch = _isoDateString(p.selectedDate) === normalizedDate;
      const periodMatch = String(p.selectedPeriod || '').trim() === String(period).trim();
      const classMatch = String(p.class || '').trim() === String(className).trim();
      const subjectMatch = String(p.subject || '').trim().toLowerCase() === String(subject).toLowerCase();
      const statusMatch = ['Ready', 'Approved'].includes(p.status);
      
      return emailMatch && dateMatch && periodMatch && classMatch && subjectMatch && statusMatch;
    });
    
    if (!absentPlan) {
      Logger.log('[_handleAbsentTeacherLessonPlan] No lesson plan found for absent teacher');
      return { handled: false, reason: 'no_plan_found' };
    }
    
    Logger.log(`[_handleAbsentTeacherLessonPlan] Found plan: ${absentPlan.lpId}, Chapter: ${absentPlan.chapter}, Session: ${absentPlan.session}`);
    
    // Check if this is a scheme-based plan that can be cascaded
    if (absentPlan.lessonType !== 'scheme-based' || !absentPlan.schemeId) {
      Logger.log('[_handleAbsentTeacherLessonPlan] Plan is not scheme-based, skipping cascade');
      return { handled: false, reason: 'not_scheme_based' };
    }
    
    // Get cascade preview
    const preview = getCascadePreview(absentPlan.lpId, absentEmail, normalizedDate);
    
    if (!preview || !preview.success) {
      Logger.log('[_handleAbsentTeacherLessonPlan] Cascade preview failed');
      return { handled: false, reason: 'preview_failed', details: preview };
    }
    
    if (!preview.needsCascade) {
      Logger.log('[_handleAbsentTeacherLessonPlan] No cascade needed');
      return { handled: false, reason: 'no_cascade_needed' };
    }
    
    if (!preview.canCascade || !Array.isArray(preview.sessionsToReschedule) || !preview.sessionsToReschedule.length) {
      Logger.log('[_handleAbsentTeacherLessonPlan] Cannot cascade');
      return { handled: false, reason: 'cannot_cascade', details: preview };
    }
    
    // Execute the cascade
    const execPayload = {
      sessionsToReschedule: preview.sessionsToReschedule,
      mode: preview.mode,
      dailyReportContext: {
        date: normalizedDate,
        teacherEmail: absentEmail,
        class: className,
        subject: subject,
        period: period,
        reason: 'teacher_absent_substitution'
      }
    };
    
    const result = executeCascade(execPayload);
    
    Logger.log(`[_handleAbsentTeacherLessonPlan] Cascade executed: ${JSON.stringify(result)}`);
    
    return {
      handled: true,
      cascaded: result && result.success,
      updatedCount: result && result.updatedCount,
      errors: result && result.errors,
      planId: absentPlan.lpId,
      chapter: absentPlan.chapter,
      originalSession: absentPlan.session
    };
    
  } catch (error) {
    Logger.log(`[_handleAbsentTeacherLessonPlan] Error: ${error.message}`);
    return { 
      handled: false, 
      error: error.message 
    };
  }
}