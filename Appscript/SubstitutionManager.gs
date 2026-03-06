/**
 * ====== SUBSTITUTION MANAGEMENT SYSTEM ======
 * This file handles teacher substitutions and notifications
 * Think of this as your "Substitute Teacher Coordinator"
 * 
 * Key Features:
 * - Batch substitution assignments with automatic email notifications
 * - Subject dropdown based on teacher's timetable (via getTeacherSubjectsForClass)
 * - Automatic lesson plan cascading for absent teachers
 * - Substitution effectiveness analytics
 * - Single acknowledgment system (no duplicate notifications)
 */

/**
 * Get subjects that a substitute teacher teaches in a specific class
 * Used to populate dropdown when assigning substitutions
 * 
 * @param {string} teacherEmail - Email of the substitute teacher
 * @param {string} className - Class name (e.g., "5", "Class 5")
 * @returns {Object} { success: true, subjects: ['English', 'English Grammar'], hasSubjects: true }
 * 
 * Frontend workflow example:
 * 1. User selects substitute teacher (e.g., "rema@school.com") and class (e.g., "5")
 * 2. Call: getTeacherSubjectsForClass("rema@school.com", "5")
 * 3. Response: { subjects: ["English", "English Grammar", "Other"] }
 * 4. Display these subjects in a dropdown for user to select
 * 5. If user selects "Other", show a text input for custom subject entry
 * 6. Submit substitution with selected/entered subject
 */
function getTeacherSubjectsForClass(teacherEmail, className) {
  try {
    if (!teacherEmail || !className) {
      return { success: false, error: 'teacherEmail and className are required', subjects: [] };
    }

    const email = String(teacherEmail || '').toLowerCase().trim();
    const cls = String(className || '').trim();

    // Query Timetable to get subjects this teacher teaches in this class
    const timetableData = _getCachedSheetData('Timetable').data;
    
    const subjectsSet = new Set();
    const matchedClasses = new Set(); // For debugging
    
    timetableData.forEach(row => {
      const rowTeacher = String(row.teacherEmail || '').toLowerCase().trim();
      const rowClass = String(row.class || '').trim();
      const rowSubject = String(row.subject || '').trim();
      
      // Flexible class matching: handle "8A", "Class 8A", "8 A", "Std 8A", etc.
      const normalizedRowClass = rowClass.toLowerCase().replace(/^(std|class)\s*/i, '').replace(/\s+/g, '');
      const normalizedInputClass = cls.toLowerCase().replace(/^(std|class)\s*/i, '').replace(/\s+/g, '');
      
      // Match teacher and class (case-insensitive, space-insensitive)
      if (rowTeacher === email && normalizedRowClass === normalizedInputClass && rowSubject) {
        subjectsSet.add(rowSubject);
        matchedClasses.add(rowClass); // Track what we matched
      }
    });

    const subjects = Array.from(subjectsSet).sort();
    
    // Always include "Other" as the last option
    subjects.push('Other');

    return {
      success: true,
      teacherEmail: teacherEmail,
      class: className,
      subjects: subjects,
      hasSubjects: subjects.length > 1, // More than just "Other"
      count: subjects.length,
      matchedClasses: Array.from(matchedClasses), // For debugging
      debug: {
        inputClass: cls,
        normalizedInput: cls.toLowerCase().replace(/^(std|class)\s*/i, '').replace(/\s+/g, ''),
        totalTimetableRows: timetableData.length
      }
    };

  } catch (error) {
    console.error('Error getting teacher subjects for class:', error);
    return {
      success: false,
      error: error.message,
      subjects: ['Other']
    };
  }
}

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
      false, // acknowledged
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

  // Best-effort: email notifications + cascades
  const cascadeResults = [];
  for (let i = 0; i < createdItems.length; i++) {
    const item = createdItems[i];
    try {
      if (item.substituteTeacher) _sendSubstitutionEmail(item);
    } catch (notifyErr) {
      // Don't fail batch on notification errors
      console.error('Failed to send substitution email:', notifyErr);
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
  const allRows = _getCachedSheetData('Substitutions').data;
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    return rowDate === normalizedDate;
  });
  
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
  
  const allRows = _getCachedSheetData('Substitutions').data;
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
    return rowDate === normalizedDate && rowTeacher === teacherEmail.toLowerCase();
  });
  
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
  
  const allRows = _getCachedSheetData('Substitutions').data;
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
    return rowTeacher === teacherEmail.toLowerCase() && rowDate >= normalizedStart && rowDate <= normalizedEnd;
  });
  
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
 * Get substitutions for all teachers within a date range (HM/Admin analytics).
 * Optional filters: teacherEmail (substitute teacher), cls.
 */
function getSubstitutionsRange(startDate, endDate, teacherEmail = '', cls = '') {
  const normalizedStart = _isoDateString(startDate);
  const normalizedEnd = _isoDateString(endDate);
  const tEmail = String(teacherEmail || '').toLowerCase().trim();
  const c = String(cls || '').trim();

  const rows = _getCachedSheetData('Substitutions').data;
  const filtered = rows.filter(r => {
    if (!r) return false;
    if (_isItLabSupportRow_(r)) return false;
    const rowDate = _isoDateString(r.date);
    if (normalizedStart && rowDate < normalizedStart) return false;
    if (normalizedEnd && rowDate > normalizedEnd) return false;
    if (tEmail) {
      const rowTeacher = String(r.substituteTeacher || '').toLowerCase().trim();
      if (rowTeacher !== tEmail) return false;
    }
    if (c) {
      const rowClass = String(r.class || '').trim();
      if (rowClass.toLowerCase() !== c.toLowerCase()) return false;
    }
    return true;
  });

  // Sort by date descending, then by period
  filtered.sort((a, b) => {
    const dateCompare = _isoDateString(b.date).localeCompare(_isoDateString(a.date));
    if (dateCompare !== 0) return dateCompare;
    return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
  });

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    teacherEmail: tEmail,
    class: c,
    substitutions: filtered
  };
}

/**
 * Get all substitutions (debug/admin use). Avoid using this on large datasets.
 */
function getAllSubstitutions() {
  const rows = _getCachedSheetData('Substitutions').data;
  return {
    total: rows.length,
    data: rows
  };
}

function _normEmail(s) {
  return String(s || '').trim().toLowerCase();
}

function _normText(s) {
  return String(s || '').trim().toLowerCase();
}

function _isItLabSupportRow_(row) {
  try {
    const a = _normText(row && row.absentTeacher);
    const rs = _normText(row && row.regularSubject);
    const ss = _normText(row && row.substituteSubject);
    const n = _normText(row && row.note);
    return (
      (a && a.indexOf('it lab support') !== -1) ||
      (rs && rs.indexOf('it lab support') !== -1) ||
      (ss && ss.indexOf('it lab support') !== -1) ||
      (n && n.indexOf('it lab support') !== -1)
    );
  } catch (_e) {
    return false;
  }
}

function _normClass(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

function _subJoinKey(dateIso, period, cls, substituteTeacher) {
  return [
    String(dateIso || '').trim(),
    String(period || '').trim(),
    _normClass(cls),
    _normEmail(substituteTeacher)
  ].join('|');
}

/**
 * Substitution effectiveness analytics.
 * Computes assigned vs reported substitution periods by joining Substitutions + DailyReports.
 *
 * Params:
 *  - startDate, endDate: YYYY-MM-DD
 *  - teacherEmail: optional (substitute teacher)
 *  - class: optional
 *  - subject: optional (matches substitution subject OR report subject)
 *  - chapter: optional (only applies when a report exists)
 *  - includeDetails: '1'/'true' to include row-level details
 */
function getSubstitutionEffectiveness(params) {
  const startDate = _isoDateString(params && params.startDate);
  const endDate = _isoDateString(params && params.endDate);
  const teacherEmail = _normEmail(params && params.teacherEmail);
  const clsFilterRaw = String(params && (params.class || params.cls) || '').trim();
  const clsFilter = _normClass(clsFilterRaw);
  const subjectFilter = _normText(params && params.subject);
  const chapterFilter = _normText(params && params.chapter);
  const includeDetails = String(params && params.includeDetails || '').toLowerCase().trim();
  const wantDetails = includeDetails === '1' || includeDetails === 'true' || includeDetails === 'yes';

  if (!startDate || !endDate) {
    return { success: false, error: 'startDate and endDate are required' };
  }
  if (endDate < startDate) {
    return { success: false, error: 'endDate must be >= startDate' };
  }

  const subs = _getCachedSheetData('Substitutions').data || [];
  const reports = _getCachedSheetData('DailyReports').data || [];

  // Build a map of (date|period|class|teacher) -> report
  const reportMap = new Map();
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    if (!r) continue;
    const rDate = _isoDateString(r.date);
    if (rDate < startDate || rDate > endDate) continue;

    const rTeacher = _normEmail(r.teacherEmail);
    const key = _subJoinKey(rDate, r.period, r.class, rTeacher);

    // Prefer substitution-marked reports if duplicates exist.
    if (!reportMap.has(key)) {
      reportMap.set(key, r);
    } else {
      const existing = reportMap.get(key);
      const isSub = String(r.isSubstitution || '').toLowerCase() === 'true' || r.isSubstitution === true;
      const exIsSub = String(existing.isSubstitution || '').toLowerCase() === 'true' || existing.isSubstitution === true;
      if (isSub && !exIsSub) reportMap.set(key, r);
    }
  }

  const details = [];
  const totals = { assigned: 0, reported: 0, pending: 0, reportedPct: 0 };

  const teacherAgg = new Map();
  const classAgg = new Map();

  function _bumpAgg(map, k, deltaAssigned, deltaReported) {
    if (!map.has(k)) map.set(k, { assigned: 0, reported: 0, pending: 0, reportedPct: 0 });
    const obj = map.get(k);
    obj.assigned += deltaAssigned;
    obj.reported += deltaReported;
    obj.pending = obj.assigned - obj.reported;
    obj.reportedPct = obj.assigned ? Math.round((obj.reported / obj.assigned) * 1000) / 10 : 0;
  }

  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    if (!s) continue;
    if (_isItLabSupportRow_(s)) continue;

    const sDate = _isoDateString(s.date);
    if (sDate < startDate || sDate > endDate) continue;

    const sTeacher = _normEmail(s.substituteTeacher);
    if (teacherEmail && sTeacher !== teacherEmail) continue;

    const sClassNorm = _normClass(s.class);
    if (clsFilter && sClassNorm !== clsFilter) continue;

    const sSubject = _normText(s.substituteSubject || s.regularSubject || s.subject);
    if (subjectFilter && sSubject !== subjectFilter) {
      // Also accept match against regularSubject (some rows may store only there)
      const alt = _normText(s.regularSubject || '');
      if (alt !== subjectFilter) continue;
    }

    const key = _subJoinKey(sDate, s.period, s.class, sTeacher);
    const r = reportMap.get(key) || null;

    // Chapter filter applies only when a report exists.
    if (chapterFilter) {
      const repChapter = _normText(r && r.chapter);
      if (!repChapter || repChapter !== chapterFilter) continue;
    }

    totals.assigned += 1;
    const hasReport = !!r;
    if (hasReport) totals.reported += 1;

    _bumpAgg(teacherAgg, sTeacher || '(unknown)', 1, hasReport ? 1 : 0);
    _bumpAgg(classAgg, String(s.class || '').trim() || '(unknown)', 1, hasReport ? 1 : 0);

    if (wantDetails) {
      const markedSub = !!(r && (r.isSubstitution === true || String(r.isSubstitution || '').toLowerCase() === 'true'));
      details.push({
        date: sDate,
        period: String(s.period || '').trim(),
        class: String(s.class || '').trim(),
        absentTeacher: String(s.absentTeacher || '').trim(),
        substituteTeacher: String(s.substituteTeacher || '').trim(),
        substituteSubject: String(s.substituteSubject || s.regularSubject || '').trim(),
        reported: hasReport,
        reportMarkedSubstitution: markedSub,
        reportId: r && (r.id || r.reportId) ? (r.id || r.reportId) : '',
        reportChapter: r && r.chapter ? String(r.chapter) : '',
        reportSessionNo: r && r.sessionNo ? String(r.sessionNo) : '',
        reportNotes: r && r.notes ? String(r.notes) : ''
      });
    }
  }

  totals.pending = totals.assigned - totals.reported;
  totals.reportedPct = totals.assigned ? Math.round((totals.reported / totals.assigned) * 1000) / 10 : 0;

  const teacherStats = Array.from(teacherAgg.entries()).map(([email, agg]) => ({
    teacherEmail: email,
    assigned: agg.assigned,
    reported: agg.reported,
    pending: agg.pending,
    reportedPct: agg.reportedPct
  })).sort((a, b) => (b.pending - a.pending) || (b.assigned - a.assigned) || String(a.teacherEmail).localeCompare(String(b.teacherEmail)));

  const classStats = Array.from(classAgg.entries()).map(([cls, agg]) => ({
    class: cls,
    assigned: agg.assigned,
    reported: agg.reported,
    pending: agg.pending,
    reportedPct: agg.reportedPct
  })).sort((a, b) => (b.pending - a.pending) || (b.assigned - a.assigned) || String(a.class).localeCompare(String(b.class)));

  return {
    success: true,
    startDate,
    endDate,
    filters: {
      teacherEmail: teacherEmail,
      class: clsFilterRaw,
      subject: subjectFilter,
      chapter: chapterFilter
    },
    totals,
    teacherStats,
    classStats,
    details: wantDetails ? details : undefined
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
      
      // Invalidate caches after deletion
      invalidateCache('substitutions');
      invalidateCache('timetable');
      
      return { success: true };
    }
  }
  
  return { error: 'Substitution not found' };
}

/**
 * Get teacher's name from Users sheet for personalized emails
 */
function _getTeacherName(email) {
  try {
    const usersData = _getCachedSheetData('Users').data;
    const user = usersData.find(u => String(u.email || '').toLowerCase() === email.toLowerCase());
    return user && user.name ? user.name : email.split('@')[0];
  } catch (e) {
    return email.split('@')[0];
  }
}

/**
 * Send email notification for substitution
 */
function _sendSubstitutionEmail(substitutionData) {
  try {
    const teacherName = _getTeacherName(substitutionData.substituteTeacher);
    const subject = `Substitution Assignment - ${substitutionData.class} (${substitutionData.date})`;
    const body = `
Dear ${teacherName},

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
    
    sendEmailNotification(substitutionData.substituteTeacher, subject, body);
    
  } catch (error) {
    console.error('Error sending substitution email:', error);
  }
}

/**
 * Get unacknowledged substitutions for a teacher
 * Reads from Substitutions sheet (single source of truth)
 */
function getUnacknowledgedSubstitutions(teacherEmail) {
  const allRows = _getCachedSheetData('Substitutions').data;
  const email = String(teacherEmail || '').toLowerCase();
  
  const unacknowledged = allRows.filter(r => {
    const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
    const isAcknowledged = r.acknowledged === true || String(r.acknowledged || '').toLowerCase() === 'true';
    return rowTeacher === email && !isAcknowledged;
  });
  
  // Sort by date descending (newest first), then by period
  unacknowledged.sort((a, b) => {
    const dateCompare = _isoDateString(b.date).localeCompare(_isoDateString(a.date));
    if (dateCompare !== 0) return dateCompare;
    return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
  });
  
  return unacknowledged;
}

/**
 * Acknowledge a substitution assignment
 * Single function for acknowledgment (replaces both old functions)
 */
function acknowledgeSubstitution(data) {
  try {
    const sh = _getSheet('Substitutions');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();
    
    const normalizedDate = _isoDateString(data.date);
    const teacherEmail = String(data.teacherEmail || '').toLowerCase();
    
    // Find the substitution row
    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      const rowDate = _isoDateString(row.date);
      const rowSubstitute = String(row.substituteTeacher || '').toLowerCase();
      
      if (rowDate === normalizedDate &&
          String(row.period) === String(data.period) &&
          String(row.class || '').toLowerCase() === String(data.class || '').toLowerCase() &&
          rowSubstitute === teacherEmail) {
        
        // Update acknowledgment fields
        const acknowledgedColIndex = headers.indexOf('acknowledged') + 1;
        const acknowledgedByColIndex = headers.indexOf('acknowledgedBy') + 1;
        const acknowledgedAtColIndex = headers.indexOf('acknowledgedAt') + 1;
        
        sh.getRange(i + 1, acknowledgedColIndex).setValue(true);
        sh.getRange(i + 1, acknowledgedByColIndex).setValue(data.teacherEmail);
        sh.getRange(i + 1, acknowledgedAtColIndex).setValue(new Date().toISOString());
        
        // Invalidate caches
        invalidateCache('substitutions');
        invalidateCache('sub_notifications');
        
        return { success: true, message: 'Substitution acknowledged successfully' };
      }
    }
    return { error: 'Substitution not found' };
    
  } catch (error) {
    return { error: 'Failed to acknowledge substitution: ' + error.toString() };
  }
}

/**
 * Get all substitution assignments for a teacher (acknowledged and unacknowledged)
 * Reads from Substitutions sheet (single source of truth)
 */
function getSubstitutionNotifications(teacherEmail) {
  const cacheKey = generateCacheKey('sub_notifications', { email: teacherEmail });
  return getCachedData(cacheKey, function() {
    return _fetchTeacherSubstitutionNotifications(teacherEmail);
  }, CACHE_TTL.SHORT);
}

/**
 * Alias for backwards compatibility
 */
function getTeacherSubstitutionNotifications(teacherEmail) {
  return getSubstitutionNotifications(teacherEmail);
}

/**
 * Internal: Fetch teacher's substitution assignments from Substitutions sheet
 */
function _fetchTeacherSubstitutionNotifications(teacherEmail) {
  try {
    const allRows = _getCachedSheetData('Substitutions').data;
    const email = String(teacherEmail || '').toLowerCase();
    
    const substitutions = allRows.filter(r => {
      const rowTeacher = String(r.substituteTeacher || '').toLowerCase();
      return rowTeacher === email;
    });
    
    // Sort by date descending (newest first), then by period
    substitutions.sort((a, b) => {
      const dateCompare = _isoDateString(b.date).localeCompare(_isoDateString(a.date));
      if (dateCompare !== 0) return dateCompare;
      return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
    });
    
    // Transform to notification-like format for frontend compatibility
    const notifications = substitutions.map(s => ({
      id: `${s.date}_${s.period}_${s.class}`, // Composite key for identification
      date: s.date,
      period: s.period,
      class: s.class,
      absentTeacher: s.absentTeacher,
      regularSubject: s.regularSubject,
      substituteSubject: s.substituteSubject,
      note: s.note,
      acknowledged: s.acknowledged === true || String(s.acknowledged || '').toLowerCase() === 'true',
      acknowledgedBy: s.acknowledgedBy,
      acknowledgedAt: s.acknowledgedAt,
      createdAt: s.createdAt,
      // Legacy fields for compatibility
      title: `Substitution Assignment - ${s.class}`,
      message: `Period ${s.period} for ${s.class} - ${s.substituteSubject || s.regularSubject}`
    }));
    
    return {
      success: true,
      notifications: notifications,
      count: notifications.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      notifications: []
    };
  }
}

/**
 * Legacy alias for acknowledgeSubstitution (backwards compatibility)
 */
function acknowledgeSubstitutionAssignment(data) {
  return acknowledgeSubstitution(data);
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
      return { handled: false, reason: 'no_plan_found' };
    }
    // Check if this is a scheme-based plan that can be cascaded
    if (absentPlan.lessonType !== 'scheme-based' || !absentPlan.schemeId) {
      return { handled: false, reason: 'not_scheme_based' };
    }
    
    // Get cascade preview
    const preview = getCascadePreview(absentPlan.lpId, absentEmail, normalizedDate);
    
    if (!preview || !preview.success) {
      return { handled: false, reason: 'preview_failed', details: preview };
    }
    
    if (!preview.needsCascade) {
      return { handled: false, reason: 'no_cascade_needed' };
    }
    
    if (!preview.canCascade || !Array.isArray(preview.sessionsToReschedule) || !preview.sessionsToReschedule.length) {
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
    return { 
      handled: false, 
      error: error.message 
    };
  }
}