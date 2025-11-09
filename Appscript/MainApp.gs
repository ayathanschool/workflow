/**
 * ====== TIME / DATE HELPERS (IST SAFE) ======
 * These helpers ensure consistent date handling across all functions.
 * All dates are normalized to IST "YYYY-MM-DD" format for reliable comparisons.
 */
const TZ = 'Asia/Kolkata';

/** Returns "YYYY-MM-DD" for *today* in IST */
function _todayISO() {
  const now = new Date();
  return Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
}

/** Coerce any sheet cell (Date | string | number) to a JS Date (best effort) */
function _coerceToDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value); // serial/time value
  if (typeof value === 'string' && value.trim()) {
    // Let Date parse; fallback if needed
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Return IST "YYYY-MM-DD" for any sheet cell (Date/string/number). Null-safe. */
function _isoDateIST(value) {
  const d = _coerceToDate(value);
  if (!d) return '';
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/** Get day name in IST from any date-like input (e.g., "Monday") */
function _dayNameIST(value) {
  const d = _coerceToDate(value) || new Date(); // default now
  return Utilities.formatDate(d, TZ, 'EEEE'); // Monday, Tuesday...
}

/** Parse a client-sent date string (e.g., "2025-11-07" or ISO) to IST "YYYY-MM-DD" */
function _normalizeQueryDate(dateStr) {
  if (!dateStr) return _todayISO();
  // If a bare YYYY-MM-DD arrives, interpret as IST midnight that day
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return _todayISO();
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/**
 * ====== MAIN APPLICATION ENTRY POINT ======
 * This file is like the "reception desk" - it receives all requests
 * and routes them to the right departments (modules)
 */

/**
 * Main entry point for GET requests (when frontend asks for data)
 */
function doGet(e) {
  const action = (e.parameter.action || '').trim();
  try {
    _bootstrapSheets();
    
    // Basic system check
    if (action === 'ping') {
      return _respond({ ok: true, now: new Date().toISOString() });
    }

    // === AUTHENTICATION ROUTES ===
    if (action === 'login') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const password = (e.parameter.password || '').trim();
      return _respond(handleBasicLogin(email, password));
    }
    
    if (action === 'googleLogin') {
      if (e.parameter.idToken) {
        return handleGoogleLogin({ idToken: e.parameter.idToken });
      } else if (e.parameter.email) {
        return handleGoogleLogin({ 
          email: e.parameter.email,
          google_id: e.parameter.google_id || 'email_auth',
          name: e.parameter.name || '',
          picture: e.parameter.picture || ''
        });
      }
      return _respond({ error: 'Missing idToken or email parameter' });
    }
    
    // === TIMETABLE ROUTES ===
    if (action === 'getTeacherWeeklyTimetable') {
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getTeacherWeeklyTimetable(identifier));
    }
    
    if (action === 'getTeacherDailyTimetable') {
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getTeacherDailyTimetable(identifier, date));
    }
    
    if (action === 'getDailyTimetableWithSubstitutions') {
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getDailyTimetableWithSubstitutions(date));
    }
    
    if (action === 'getDailyTimetableForDate') {
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getDailyTimetableWithSubstitutions(date));
    }
    
    if (action === 'getAllClasses') {
      return _respond(getAllClasses());
    }
    
    if (action === 'getClassTimetable') {
      const className = e.parameter.class || '';
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getClassTimetable(className, date));
    }
    
    if (action === 'getFullTimetable') {
      return _respond(getFullTimetable());
    }
    
    if (action === 'getFullTimetableFiltered') {
      const cls = e.parameter.class || '';
      const subject = e.parameter.subject || '';
      const teacher = e.parameter.teacher || '';
      const date = e.parameter.date || '';
      return _respond(getFullTimetableFiltered(cls, subject, teacher, date));
    }
    
    // === SUBSTITUTION ROUTES ===
    if (action === 'getSubstitutionsForDate') {
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getSubstitutionsForDate(date));
    }
    
    if (action === 'getTeacherSubstitutions') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getTeacherSubstitutions(email, date));
    }
    
    if (action === 'getUnacknowledgedSubstitutions') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getUnacknowledgedSubstitutions(email));
    }
    
    if (action === 'getTeacherSubstitutionNotifications') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getTeacherSubstitutionNotifications(email));
    }
    
    if (action === 'getAvailableTeachers') {
      const date = (e.parameter.date || _todayISO()).trim();
      const period = e.parameter.period || '';
      return _respond(getAvailableTeachers(date, period));
    }
    
    // Allow assignSubstitution via GET for better browser compatibility
    if (action === 'assignSubstitution') {
      const substitutionData = {
        date: e.parameter.date || '',
        period: e.parameter.period || '',
        class: e.parameter.class || '',
        absentTeacher: e.parameter.absentTeacher || '',
        regularSubject: e.parameter.regularSubject || '',
        substituteTeacher: e.parameter.substituteTeacher || '',
        substituteSubject: e.parameter.substituteSubject || '',
        note: e.parameter.note || ''
      };
      return _respond(assignSubstitution(substitutionData));
    }
    
    // === EXAM ROUTES ===
    if (action === 'getExams') {
      return _respond(getExams(e.parameter));
    }
    
    if (action === 'getExamMarks') {
      const examId = e.parameter.examId || '';
      return _respond(getExamMarks(examId));
    }
    
    if (action === 'getGradeTypes') {
      return _respond(getGradeTypes());
    }
    
    if (action === 'getGradeBoundaries') {
      return _respond(getGradeBoundaries());
    }
    
    // === STUDENT ROUTES ===
    if (action === 'getStudents') {
      const cls = e.parameter.class || '';
      return _respond(getStudents(cls));
    }
    
    if (action === 'getStudentReportCard') {
      const examType = e.parameter.examType || '';
      const admNo = e.parameter.admNo || '';
      const cls = e.parameter.class || '';
      return _respond(getStudentReportCard(examType, admNo, cls));
    }
    
    // === HM DASHBOARD ===
    if (action === 'getHmInsights') {
      const sSh = _getSheet('Schemes');
      const sHeaders = _headers(sSh);
      const schemes = _rows(sSh).map(r => _indexByHeader(r, sHeaders));
      const pendingPlanCount = schemes.filter(s => String(s.status||'').toLowerCase() === 'pending').length;

      const lSh = _getSheet('LessonPlans');
      const lHeaders = _headers(lSh);
      const lps = _rows(lSh).map(r => _indexByHeader(r, lHeaders));
      const pendingLessonCount = lps.filter(p => String(p.status||'') === 'Pending Review').length;

      // Get teacher count (users with 'teacher' or 'class teacher' roles)
      const uSh = _getSheet('Users');
      const uHeaders = _headers(uSh);
      const users = _rows(uSh).map(r => _indexByHeader(r, uHeaders));
      const teacherCount = users.filter(u => {
        const roles = String(u.roles || '').toLowerCase();
        return roles.includes('teacher') || roles.includes('class teacher');
      }).length;

      return _respond({ planCount: pendingPlanCount, lessonCount: pendingLessonCount, teacherCount });
    }
    
    // === SCHEME MANAGEMENT ROUTES ===
    if (action === 'getTeacherSchemes') {
      return _handleGetTeacherSchemes(e.parameter);
    }
    
    if (action === 'getTeacherLessonPlans') {
      return _handleGetTeacherLessonPlans(e.parameter);
    }
    
    if (action === 'getPendingPlans') {
      return _handleGetPendingSchemes(e.parameter);
    }
    
    if (action === 'getPendingLessonPlans') {
      return _handleGetPendingLessonPlans(e.parameter);
    }
    
    if (action === 'getPendingLessonReviews') {
      return _handleGetPendingLessonPlans(e.parameter); // Same handler, different name for backward compatibility
    }
    
    if (action === 'getAllPlans') {
      return _handleGetAllSchemes(e.parameter);
    }
    
    if (action === 'getAllSchemes') {
      return _handleGetAllSchemes(e.parameter);
    }
    
    // === SCHEME-BASED LESSON PLANNING ROUTES ===
    if (action === 'getApprovedSchemesForLessonPlanning') {
      return _handleGetApprovedSchemesForLessonPlanning(e.parameter);
    }
    
    if (action === 'getAvailablePeriodsForLessonPlan') {
      return _handleGetAvailablePeriodsForLessonPlan(e.parameter);
    }
    
    if (action === 'getPlannedLessonForPeriod') {
      return _handleGetPlannedLessonForPeriod(e.parameter);
    }
    
    // === DAILY REPORT ROUTES ===
    if (action === 'getTeacherDailyReportsForDate') {
      return _handleGetTeacherDailyReportsForDate(e.parameter);
    }
    
    // === HM DAILY OVERSIGHT ROUTES ===
    if (action === 'getDailyReportsForDate') {
      return _handleGetDailyReportsForDate(e.parameter);
    }
    
    // === APP SETTINGS ROUTES ===
    if (action === 'getAppSettings') {
      return _handleGetAppSettings();
    }
    
    // === NOTIFICATION ROUTES ===
    if (action === 'sendCustomNotification') {
      return _handleSendCustomNotification(e.parameter);
    }
    
    if (action === 'getSubstitutionNotifications') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getSubstitutionNotifications(email));
    }
    
    if (action === 'acknowledgeSubstitutionNotification') {
      const notificationId = e.parameter.notificationId || '';
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      return _respond(acknowledgeSubstitution(notificationId, teacherEmail));
    }
    
    // === DEBUG ROUTES ===
    if (action === 'debugSubstitutions') {
      const sh = _getSheet('Substitutions');
      const headers = _headers(sh);
      const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
      return _respond({
        headers: headers,
        rowCount: allRows.length,
        rows: allRows,
        sampleDate: allRows.length > 0 ? allRows[0].date : null,
        sampleDateNormalized: allRows.length > 0 ? _isoDateString(allRows[0].date) : null
      });
    }
    
    if (action === 'debugSubstitutionsForDate') {
      const date = e.parameter.date || new Date().toISOString().split('T')[0];
      const normalizedQueryDate = _isoDateString(date);
      
      const sh = _getSheet('Substitutions');
      const headers = _headers(sh);
      const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
      
      const matches = allRows.filter(r => {
        const rowDate = _isoDateString(r.date);
        return rowDate === normalizedQueryDate;
      });
      
      return _respond({
        queryDate: date,
        normalizedQueryDate: normalizedQueryDate,
        totalRows: allRows.length,
        allRowDates: allRows.map(r => ({
          raw: r.date,
          normalized: _isoDateString(r.date),
          type: typeof r.date
        })),
        matchingRows: matches,
        matchCount: matches.length
      });
    }
    
    // === DAILY REPORTS ROUTES ===
    if (action === 'getDailyReports') {
      const teacher = e.parameter.teacher || '';
      const cls = e.parameter.class || '';
      const subject = e.parameter.subject || '';
      const date = e.parameter.date || '';
      const fromDate = e.parameter.fromDate || '';
      const toDate = e.parameter.toDate || '';
      return _respond(getDailyReports(teacher, fromDate || date, toDate || date, cls, subject));
    }
    
    // === ATTENDANCE ROUTES ===
    if (action === 'getAttendance') {
      const cls = e.parameter.class || '';
      const date = e.parameter.date || '';
      return _respond(getAttendance(cls, date));
    }
    
    // === STUDENT PERFORMANCE ROUTES ===
    if (action === 'getStudentPerformance') {
      const cls = e.parameter.class || '';
      return _respond(getStudentPerformance(cls));
    }
    
    // === TEACHER MANAGEMENT ROUTES ===
    if (action === 'getAllTeachers') {
      return _respond(getAllTeachers());
    }
    
    // === OTHER ESSENTIAL ROUTES ===
    // Add more routes as needed from your original Code.gs
    
    return _respond({ error: 'Unknown action: ' + action });
    
  } catch (err) {
    console.error('Error in doGet:', err);
    return _respond({ error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Main entry point for POST requests (when frontend sends data)
 */
function doPost(e) {
  const data = _parsePost(e);
  const action = (data.action || e.parameter.action || '').trim();
  
  try {
    _bootstrapSheets();
    
    // === AUTHENTICATION ROUTES ===
    if (action === 'googleLogin') {
      return handleGoogleLogin(data);
    }
    
    // === EXAM ROUTES ===
    if (action === 'createExam') {
      return _respond(createExam(data));
    }
    
    if (action === 'submitExamMarks') {
      return _respond(submitExamMarks(data));
    }
    
    // === SUBSTITUTION ROUTES ===
    if (action === 'assignSubstitution') {
      return _respond(assignSubstitution(data));
    }
    
    if (action === 'deleteSubstitution') {
      return _respond(deleteSubstitution(data));
    }
    
    if (action === 'acknowledgeSubstitution') {
      const notificationId = data.notificationId || '';
      const teacherEmail = (data.teacherEmail || '').toLowerCase().trim();
      return _respond(acknowledgeSubstitution(notificationId, teacherEmail));
    }
    
    if (action === 'getSubstitutionNotifications') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      return _respond(getSubstitutionNotifications(email));
    }
    
    if (action === 'acknowledgeSubstitutionNotification') {
      const notificationId = data.notificationId || '';
      const teacherEmail = (data.teacherEmail || '').toLowerCase().trim();
      return _respond(acknowledgeSubstitution(notificationId, teacherEmail));
    }
    
    // === SCHEME MANAGEMENT ROUTES ===
    if (action === 'submitPlan') {
      return _handleSubmitScheme(data);
    }
    
    if (action === 'updatePlanStatus') {
      return _handleUpdateSchemeStatus(data);
    }
    
    // === DAILY REPORT ROUTES ===
    if (action === 'submitDailyReport') {
      const lock = LockService.getScriptLock();
      try {
        // Wait up to 10 seconds for other submissions to complete
        lock.waitLock(10000);
        
        Logger.log('=== SUBMITTING DAILY REPORT (VERSION 90) ===');
        Logger.log('Data received: ' + JSON.stringify(data));
        
        const sh = _getSheet('DailyReports');
        Logger.log('DailyReports sheet obtained');
        
        const headers = ['date', 'teacherEmail', 'teacherName', 'class', 'subject', 'period', 'planType', 'lessonPlanId', 'chapter', 'sessionNo', 'objectives', 'activities', 'completed', 'notes', 'createdAt'];
        _ensureHeaders(sh, headers);
        Logger.log('Headers ensured');
        
        // Check for duplicate submission (same date + teacher + class + subject + period)
        const reportDate = _normalizeQueryDate(data.date);  // Use helper to normalize query date
        const teacherEmail = String(data.teacherEmail || '').toLowerCase().trim();
        const reportClass = String(data.class || '').trim();
        const reportSubject = String(data.subject || '').trim();
        const reportPeriod = Number(data.period || 0);
        
        Logger.log('=== DUPLICATE CHECK (USING IST HELPERS) ===');
        Logger.log(`Looking for duplicates: date=${reportDate}, email=${teacherEmail}, class=${reportClass}, subject=${reportSubject}, period=${reportPeriod}`);
        
        // Force sheet to flush any pending operations
        SpreadsheetApp.flush();
        
        // Get fresh data from sheet
        const existingReports = _rows(sh).map(row => _indexByHeader(row, headers));
        Logger.log(`Found ${existingReports.length} existing reports in sheet`);
        
        // Log a sample of existing reports to check data structure
        if (existingReports.length > 0) {
          Logger.log(`Sample existing report structure: ${JSON.stringify(existingReports[0])}`);
          Logger.log(`Sample date: ${existingReports[0].date} (raw type: ${typeof existingReports[0].date}), IST-normalized: ${_isoDateIST(existingReports[0].date)}`);
        } else {
          Logger.log('No existing reports found in sheet');
        }
        
        const duplicate = existingReports.find(r => {
          // Use IST helper to normalize report date - handles Date objects, strings, numbers
          const rDate = _isoDateIST(r.date);
          
          const rEmail = String(r.teacherEmail || '').toLowerCase().trim();
          const rClass = String(r.class || '').trim();
          const rSubject = String(r.subject || '').trim();
          const rPeriod = Number(r.period || 0);
          
          const dateMatch = rDate === reportDate;
          const emailMatch = rEmail === teacherEmail;
          const classMatch = rClass === reportClass;
          const subjectMatch = rSubject === reportSubject;
          const periodMatch = rPeriod === reportPeriod;
          
          // NOTE: We DO NOT include sessionNo in duplicate check because:
          // - sessionNo is auto-filled from approved lesson plans
          // - A teacher shouldn't be able to submit twice even if sessionNo changes
          // - The duplicate check is about preventing double submissions for the same period
          
          Logger.log(`Checking report: date=${rDate}(${dateMatch}), email=${rEmail}(${emailMatch}), class=${rClass}(${classMatch}), subject=${rSubject}(${subjectMatch}), period=${rPeriod}(${periodMatch}) - MATCH ALL: ${dateMatch && emailMatch && classMatch && subjectMatch && periodMatch}`);
          
          return dateMatch && emailMatch && classMatch && subjectMatch && periodMatch;
        });
        
        if (duplicate) {
          Logger.log('=== DUPLICATE FOUND - PREVENTING SUBMISSION ===');
          Logger.log('Existing report: ' + JSON.stringify(duplicate));
          return _respond({ 
            ok: false, 
            error: 'duplicate',
            message: 'Report already submitted for this period'
          });
        }
        
        Logger.log('=== NO DUPLICATE - PROCEEDING WITH SUBMISSION ===');
        
        const now = new Date().toISOString();
        const rowData = [
          data.date || '',
          data.teacherEmail || '',
          data.teacherName || '',
          data.class || '',
          data.subject || '',
          Number(data.period||0),
          data.planType || '',
          data.lessonPlanId || '',
          data.chapter || '',
          Number(data.sessionNo || 0),
          data.objectives || '',
          data.activities || '',
          data.completed || '',
          data.notes || '',
          now
        ];
        
        Logger.log('Row data prepared: ' + JSON.stringify(rowData));
        sh.appendRow(rowData);
        
        // CRITICAL: Force immediate write to sheet before releasing lock
        SpreadsheetApp.flush();
        
        Logger.log('Row appended successfully and flushed to sheet');
        
        return _respond({ ok: true, submitted: true });
      } catch (err) {
        Logger.log('ERROR in submitDailyReport: ' + err.message);
        Logger.log('Error stack: ' + err.stack);
        return _respond({ error: 'Failed to submit: ' + err.message });
      } finally {
        // Always release the lock
        lock.releaseLock();
      }
    }
    
    // === SCHEME-BASED LESSON PLANNING ROUTES ===
    if (action === 'createSchemeLessonPlan') {
      return _handleCreateSchemeLessonPlan(data);
    }
    
    if (action === 'updateLessonPlanStatus') {
      return _handleUpdateLessonPlanStatus(data);
    }
    
    if (action === 'updateLessonPlanDetailsStatus') {
      return _handleUpdateLessonPlanStatus(data); // Same handler, different name for compatibility
    }
    
    // === OTHER POST ROUTES ===
    // Add more POST routes as needed from your original Code.gs
    
    return _respond({ error: 'Unknown action: ' + action });
    
  } catch (err) {
    console.error('Error in doPost:', err);
    return _respond({ error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Send email notification (basic function that other modules use)
 */
function sendEmailNotification(to, subject, body, options = {}) {
  try {
    if (!to || !subject || !body) {
      console.error('Email notification missing required fields:', { to, subject, body: body ? 'present' : 'missing' });
      return { success: false, error: 'Missing required email fields' };
    }
    
    const emailOptions = {
      to: to,
      subject: subject,
      htmlBody: body.replace(/\n/g, '<br>'),
      ...options
    };
    
    MailApp.sendEmail(emailOptions);
    
    console.log('Email sent successfully to:', to);
    return { success: true };
    
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send lesson approval notification (used by academic workflow)
 */
function sendLessonApprovalNotification(teacherEmail, teacherName, lessonPlan, status) {
  const subject = `Lesson Plan ${status} - ${lessonPlan.class} ${lessonPlan.subject}`;
  
  let body;
  if (status === 'Approved') {
    body = `
Dear ${teacherName},

Your lesson plan has been APPROVED:

Class: ${lessonPlan.class}
Subject: ${lessonPlan.subject}
Chapter: ${lessonPlan.chapter}
Session: ${lessonPlan.session}

You can now proceed with the lesson.

Best regards,
School Administration
    `;
  } else {
    body = `
Dear ${teacherName},

Your lesson plan requires revision:

Class: ${lessonPlan.class}
Subject: ${lessonPlan.subject}
Chapter: ${lessonPlan.chapter}
Session: ${lessonPlan.session}

Reviewer Remarks: ${lessonPlan.reviewerRemarks || 'Please check with administration'}

Please make the necessary changes and resubmit.

Best regards,
School Administration
    `;
  }
  
  return sendEmailNotification(teacherEmail, subject, body);
}

// === SCHEME-BASED LESSON PLANNING HANDLERS ===

/**
 * Handle GET approved schemes for lesson planning
 */
function _handleGetApprovedSchemesForLessonPlanning(params) {
  try {
    const teacherEmail = params.teacherEmail;
    
    if (!teacherEmail) {
      return _respond({ success: false, error: 'Teacher email is required' });
    }
    
    const result = getApprovedSchemesForLessonPlanning(teacherEmail);
    return _respond(result);
  } catch (error) {
    console.error('Error handling approved schemes for lesson planning:', error);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle GET available periods for lesson plan
 */
function _handleGetAvailablePeriodsForLessonPlan(params) {
  try {
    const teacherEmail = params.teacherEmail;
    const startDate = params.startDate;
    const endDate = params.endDate;
    const excludeExisting = params.excludeExisting !== 'false';
    const schemeClass = params.class || '';  // Class from scheme
    const schemeSubject = params.subject || '';  // Subject from scheme
    
    if (!teacherEmail || !startDate || !endDate) {
      return _respond({ 
        success: false, 
        error: 'Teacher email, start date, and end date are required' 
      });
    }
    
    Logger.log(`Getting periods for ${teacherEmail} - filtering by class: ${schemeClass}, subject: ${schemeSubject}`);
    
    const result = getAvailablePeriodsForLessonPlan(teacherEmail, startDate, endDate, excludeExisting, schemeClass, schemeSubject);
    return _respond(result);
  } catch (error) {
    console.error('Error handling available periods for lesson plan:', error);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle POST submit scheme
 */
function _handleSubmitScheme(data) {
  try {
    const sh = _getSheet('Schemes');
    const headers = ['schemeId', 'teacherEmail', 'teacherName', 'class', 'subject', 'term', 'unit', 'chapter', 'month', 'noOfSessions', 'status', 'createdAt', 'approvedAt', 'academicYear', 'content'];
    _ensureHeaders(sh, headers);
    
    const now = new Date().toISOString();
    const schemeId = _generateId('SCH_');
    
    // Lookup teacher name from Users sheet to ensure consistency
    const teacherEmail = (data.email || '').toLowerCase().trim();
    let teacherName = data.teacherName || '';
    
    const usersSh = _getSheet('Users');
    const usersHeaders = _headers(usersSh);
    const users = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
    const teacher = users.find(u => String(u.email || '').toLowerCase() === teacherEmail);
    
    if (teacher && teacher.name) {
      teacherName = teacher.name; // Use name from Users sheet
      Logger.log(`Using teacher name from Users sheet: ${teacherName}`);
    }
    
    // Match the order of headers: schemeId, teacherEmail, teacherName, class, subject, term, unit, chapter, month, noOfSessions, status, createdAt, approvedAt, academicYear, content
    const line = [
      schemeId,                                      // schemeId
      teacherEmail,                                  // teacherEmail
      teacherName,                                   // teacherName (from Users sheet)
      data.class || '',                              // class
      data.subject || '',                            // subject
      Number(data.term || 0),                        // term
      Number(data.unit || 0),                        // unit
      data.chapter || '',                            // chapter
      data.month || '',                              // month
      Number(data.noOfSessions || 0),               // noOfSessions
      'Pending',                                     // status
      now,                                           // createdAt
      '',                                            // approvedAt (empty until approved)
      data.academicYear || '2024-2025',            // academicYear (default)
      data.content || ''                             // content (scheme details)
    ];
    
    sh.appendRow(line);
    return _respond({ ok: true, schemeId: schemeId });
  } catch (error) {
    Logger.log('Error submitting scheme: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle POST update scheme status
 */
function _handleUpdateSchemeStatus(data) {
  try {
    const { schemeId, status } = data;
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const schemeRows = _rows(sh).map(row => _indexByHeader(row, headers));
    
    const rowIndex = schemeRows.findIndex(row => row.schemeId === schemeId);
    
    if (rowIndex === -1) {
      return _respond({ error: 'Scheme not found' });
    }
    
    // Update status (row index + 2 because: 1 for header, 1 for 0-based to 1-based)
    const statusColIndex = headers.indexOf('status') + 1;
    sh.getRange(rowIndex + 2, statusColIndex).setValue(status);
    
    // Update approvedAt timestamp if status is Approved
    if (status.toLowerCase() === 'approved') {
      const approvedAtIdx = headers.indexOf('approvedAt');
      if (approvedAtIdx >= 0) {
        sh.getRange(rowIndex + 2, approvedAtIdx + 1).setValue(new Date().toISOString());
      }
    }
    
    return _respond({ submitted: true });
  } catch (error) {
    Logger.log('Error updating scheme status: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle UPDATE lesson plan status (HM approval/rejection)
 */
function _handleUpdateLessonPlanStatus(data) {
  try {
    Logger.log(`Updating lesson plan status: ${JSON.stringify(data)}`);
    const { lpId, status, reviewComments, remarks } = data;
    
    // Accept either reviewComments or remarks (frontend compatibility)
    const comments = reviewComments || remarks || '';
    
    if (!lpId || !status) {
      return _respond({ error: 'Lesson plan ID and status are required' });
    }
    
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
    
    const rowIndex = lessonPlans.findIndex(row => row.lpId === lpId);
    
    if (rowIndex === -1) {
      return _respond({ error: 'Lesson plan not found' });
    }
    
    // Update status (row index + 2 because: 1 for header, 1 for 0-based to 1-based)
    const statusColIndex = headers.indexOf('status') + 1;
    sh.getRange(rowIndex + 2, statusColIndex).setValue(status);
    
    // Update review comments if provided
    if (comments) {
      const commentsIdx = headers.indexOf('reviewComments');
      if (commentsIdx >= 0) {
        sh.getRange(rowIndex + 2, commentsIdx + 1).setValue(comments);
      }
    }
    
    // Update reviewedAt timestamp
    const reviewedAtIdx = headers.indexOf('reviewedAt');
    if (reviewedAtIdx >= 0) {
      sh.getRange(rowIndex + 2, reviewedAtIdx + 1).setValue(new Date().toISOString());
    }
    
    Logger.log(`Lesson plan ${lpId} status updated to ${status}`);
    return _respond({ success: true, message: 'Lesson plan status updated successfully' });
  } catch (error) {
    Logger.log('Error updating lesson plan status: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle GET teacher schemes
 */
function _handleGetTeacherSchemes(params) {
  try {
    const email = params.email;
    if (!email) {
      return _respond({ error: 'Email required' });
    }
    
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const schemes = _rows(sh).map(row => _indexByHeader(row, headers))
      .filter(scheme => (scheme.teacherEmail || '').toLowerCase() === email.toLowerCase());
    
    return _respond(schemes);
  } catch (error) {
    Logger.log('Error getting teacher schemes: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle GET teacher lesson plans
 * Returns all lesson plans submitted by a specific teacher
 */
function _handleGetTeacherLessonPlans(params) {
  try {
    const email = params.email;
    if (!email) {
      return _respond({ error: 'Email required' });
    }
    
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    let lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers))
      .filter(plan => (plan.teacherEmail || '').toLowerCase() === email.toLowerCase());
    
    // Apply optional filters
    if (params.subject && params.subject.trim()) {
      lessonPlans = lessonPlans.filter(plan => 
        (plan.subject || '').toLowerCase() === params.subject.toLowerCase()
      );
    }
    
    if (params.class && params.class.trim()) {
      lessonPlans = lessonPlans.filter(plan => 
        (plan.class || '').toLowerCase() === params.class.toLowerCase()
      );
    }
    
    if (params.status && params.status.trim()) {
      lessonPlans = lessonPlans.filter(plan => 
        (plan.status || '').toLowerCase() === params.status.toLowerCase()
      );
    }
    
    if (params.search && params.search.trim()) {
      const searchLower = params.search.toLowerCase();
      lessonPlans = lessonPlans.filter(plan =>
        (plan.chapter || '').toLowerCase().includes(searchLower) ||
        (plan.subject || '').toLowerCase().includes(searchLower) ||
        (plan.class || '').toLowerCase().includes(searchLower)
      );
    }
    
    return _respond(lessonPlans);
  } catch (error) {
    Logger.log('Error getting teacher lesson plans: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle GET pending schemes
 */
function _handleGetPendingSchemes(params) {
  try {
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const schemes = _rows(sh).map(row => _indexByHeader(row, headers))
      .filter(scheme => (scheme.status || '').toLowerCase() === 'pending');
    
    return _respond(schemes);
  } catch (error) {
    Logger.log('Error getting pending schemes: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle GET pending lesson plans for HM approval
 * Supports filtering by teacher, class, subject, and status
 */
function _handleGetPendingLessonPlans(params) {
  try {
    Logger.log('=== Getting Pending Lesson Plans ===');
    Logger.log(`Filter params: ${JSON.stringify(params)}`);
    
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    
    const allLessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
    Logger.log(`Total lesson plans found: ${allLessonPlans.length}`);
    
    // Apply filters
    let filteredPlans = allLessonPlans;
    
    // Filter by status (default to 'Pending Review')
    const statusFilter = params.status || 'Pending Review';
    if (statusFilter && statusFilter !== '' && statusFilter !== 'All') {
      filteredPlans = filteredPlans.filter(plan => 
        String(plan.status || '') === statusFilter
      );
    }
    
    // Filter by teacher (can be teacherName or teacherEmail)
    if (params.teacher && params.teacher !== '') {
      const teacherLower = params.teacher.toLowerCase();
      filteredPlans = filteredPlans.filter(plan =>
        String(plan.teacherName || '').toLowerCase().includes(teacherLower) ||
        String(plan.teacherEmail || '').toLowerCase().includes(teacherLower)
      );
    }
    
    // Filter by class
    if (params.class && params.class !== '') {
      filteredPlans = filteredPlans.filter(plan =>
        String(plan.class || '').toLowerCase() === params.class.toLowerCase()
      );
    }
    
    // Filter by subject
    if (params.subject && params.subject !== '') {
      filteredPlans = filteredPlans.filter(plan =>
        String(plan.subject || '').toLowerCase() === params.subject.toLowerCase()
      );
    }
    
    Logger.log(`Filtered lesson plans: ${filteredPlans.length} (status: ${statusFilter})`);
    
    return _respond(filteredPlans);
  } catch (error) {
    Logger.log('Error getting pending lesson plans: ' + error.message);
    return _respond({ error: error.message });
  }
}

/**
 * Handle GET all schemes
 */
function _handleGetAllSchemes(params) {
  try {
    Logger.log('=== Getting All Schemes ===');
    const sh = _getSheet('Schemes');
    Logger.log('Schemes sheet retrieved');
    
    const headers = _headers(sh);
    Logger.log(`Headers: ${JSON.stringify(headers)}`);
    
    const allRows = _rows(sh);
    Logger.log(`Total rows found: ${allRows.length}`);
    
    const schemes = allRows
      .map(row => {
        const obj = _indexByHeader(row, headers);
        Logger.log(`Row mapped: schemeId=${obj.schemeId}, status=${obj.status}`);
        return obj;
      })
      .filter(scheme => {
        const isValid = scheme && scheme.schemeId;
        Logger.log(`Filtering: schemeId=${scheme?.schemeId}, valid=${isValid}`);
        return isValid;
      });
    
    Logger.log(`Loaded ${schemes.length} schemes total`);
    Logger.log(`Schemes data: ${JSON.stringify(schemes)}`);
    
    return _respond(schemes);
  } catch (error) {
    Logger.log('Error getting all schemes: ' + error.message);
    Logger.log('Error stack: ' + error.stack);
    return _respond({ error: error.message });
  }
}

/**
 * Handle POST create scheme lesson plan
 */
function _handleCreateSchemeLessonPlan(data) {
  try {
    Logger.log(`_handleCreateSchemeLessonPlan called with data: ${JSON.stringify(data)}`);
    
    if (!data.lessonPlanData) {
      Logger.log('ERROR: No lessonPlanData in request');
      return _respond({ success: false, error: 'No lesson plan data provided' });
    }
    
    const result = createSchemeLessonPlan(data.lessonPlanData);
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleCreateSchemeLessonPlan: ${error.message}`);
    Logger.log(`Error stack: ${error.stack}`);
    console.error('Error handling create scheme lesson plan:', error);
    return _respond({ success: false, error: error.message || 'Unknown error occurred' });
  }
}

/**
 * Handle GET planned lesson for a specific period
 * Returns the approved lesson plan for a given period/class/subject combination
 */
function _handleGetPlannedLessonForPeriod(params) {
  try {
    const { email, date, period, class: className, subject } = params;
    
    Logger.log(`Getting planned lesson for: ${email}, ${date}, Period ${period}, ${className}, ${subject}`);
    
    if (!email || !date || !period || !className || !subject) {
      return _respond({ 
        success: false, 
        error: 'Missing required parameters: email, date, period, class, subject' 
      });
    }
    
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
    
    Logger.log(`Total lesson plans in sheet: ${lessonPlans.length}`);
    Logger.log(`Headers: ${JSON.stringify(headers)}`);
    
    // Find lesson plan matching the criteria
    // Status must be "Ready" (HM approved)
    // Date and period must match
    // Class and subject must match
    const queryDate = _normalizeQueryDate(date);  // Use helper to normalize query date once
    const matchingPlan = lessonPlans.find(plan => {
      // Try multiple field name variations for date and period (selectedDate is primary)
      // Use IST helper to normalize plan date - handles Date objects, strings, numbers
      const selectedDateVal = plan.selectedDate || plan.date;
      const planDate = _isoDateIST(selectedDateVal);
      
      const planPeriod = String(plan.selectedPeriod || plan.period || '');
      
      // Debug logging for each plan
      Logger.log(`Checking plan ${plan.lpId}: status=${plan.status}, selectedDate=${plan.selectedDate}, selectedPeriod=${plan.selectedPeriod}, planDate=${planDate}, planPeriod=${planPeriod}, class=${plan.class}, subject=${plan.subject}`);
      
      const matches = 
        String(plan.status || '') === 'Ready' &&
        planDate === queryDate &&
        planPeriod === String(period) &&
        String(plan.class || '').toLowerCase() === String(className).toLowerCase() &&
        String(plan.subject || '').toLowerCase() === String(subject).toLowerCase();
      
      if (matches) {
        Logger.log(`✅ FOUND MATCHING PLAN: ${plan.lpId} for ${className}/${subject}`);
      } else if (String(plan.status || '') === 'Ready') {
        Logger.log(`❌ No match: planDate=${planDate} vs queryDate=${queryDate}, planPeriod=${planPeriod} vs ${period}, class=${plan.class} vs ${className}, subject=${plan.subject} vs ${subject}`);
      }
      
      return matches;
    });
    
    if (matchingPlan) {
      Logger.log(`Returning lesson plan: ${matchingPlan.lpId}`);
      return _respond({
        success: true,
        hasPlannedLesson: true,
        lessonPlan: {
          lpId: matchingPlan.lpId,
          schemeId: matchingPlan.schemeId,
          chapter: matchingPlan.chapter || '',
          session: matchingPlan.session || '',
          sessionNo: Number(matchingPlan.session || 0),
          learningObjectives: matchingPlan.learningObjectives || matchingPlan.objectives || '',
          teachingMethods: matchingPlan.teachingMethods || matchingPlan.activities || '',
          resourcesRequired: matchingPlan.resourcesRequired || matchingPlan.resources || '',
          assessmentMethods: matchingPlan.assessmentMethods || matchingPlan.assessment || ''
        }
      });
    } else {
      Logger.log(`No planned lesson found for ${className}/${subject} on ${date} period ${period}`);
      return _respond({
        success: true,
        hasPlannedLesson: false,
        lessonPlan: null
      });
    }
    
  } catch (error) {
    Logger.log('Error getting planned lesson for period: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle GET teacher's daily reports for a specific date
 * Returns only the reports submitted by a specific teacher
 */
function _handleGetTeacherDailyReportsForDate(params) {
  try {
    const email = (params.email || '').toLowerCase().trim();
    const date = params.date || _todayISO();
    
    Logger.log(`=== GETTING TEACHER DAILY REPORTS ===`);
    Logger.log(`Email: ${email}, Date: ${date}`);
    
    if (!email) {
      Logger.log('ERROR: Teacher email is required');
      return _respond({ success: false, error: 'Teacher email is required' });
    }
    
    // Get daily reports for this teacher and date
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    Logger.log(`Total reports in sheet: ${allReports.length}`);
    
    const reports = allReports.filter(report => {
      // Skip invalid reports
      if (!report || !report.date || !report.teacherEmail) return false;
      
      // Use IST helper to normalize report date - handles Date objects, strings, numbers
      const reportDate = _isoDateIST(report.date);
      
      const reportEmail = String(report.teacherEmail || '').toLowerCase().trim();
      const queryDate = _normalizeQueryDate(date);  // Use helper to normalize query date
      const dateMatch = reportDate === queryDate;
      const emailMatch = reportEmail === email;
      
      if (emailMatch) {
        Logger.log(`Report for ${reportEmail} on ${reportDate} (type: ${typeof report.date}): dateMatch=${dateMatch}, emailMatch=${emailMatch}, queryDate=${queryDate}`);
      }
      
      return dateMatch && emailMatch;
    }).map(report => ({
      ...report,
      status: 'Submitted'  // Add status field so frontend knows this report is submitted
    }));
    
    Logger.log(`=== RETURNING ${reports.length} REPORTS FOR ${email} ON ${date} ===`);
    if (reports.length > 0) {
      Logger.log(`Sample report: ${JSON.stringify(reports[0])}`);
    }
    
    return _respond(reports);
    
  } catch (error) {
    Logger.log('Error getting teacher daily reports: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle GET daily reports for HM oversight
 * Returns all daily reports for a specific date with teacher/timetable info
 */
function _handleGetDailyReportsForDate(params) {
  try {
    const date = params.date || _todayISO();
    const dayName = _dayName(date); // Get the day of week for this date
    Logger.log(`Getting daily reports for date: ${date}, day: ${dayName}`);
    
    // Get timetable periods for THIS DAY ONLY
    const ttSh = _getSheet('Timetable');
    const ttHeaders = _headers(ttSh);
    const allTimetable = _rows(ttSh).map(row => _indexByHeader(row, ttHeaders))
      .filter(tt => _normalizeDayName(tt.dayOfWeek) === _normalizeDayName(dayName));
    
    // Get all daily reports for this date
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const queryDate = _normalizeQueryDate(date);  // Use helper to normalize query date once
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders))
      .filter(report => {
        if (!report || !report.date) return false;
        
        // Use IST helper to normalize report date - handles Date objects, strings, numbers
        const reportDate = _isoDateIST(report.date);
        
        return reportDate === queryDate;
      });
    
    Logger.log(`Found ${allTimetable.length} timetable periods and ${allReports.length} reports`);
    
    // Create a map of submitted reports by key (teacherEmail|class|subject|period)
    const reportMap = {};
    allReports.forEach(report => {
      const key = `${report.teacherEmail}|${report.class}|${report.subject}|${report.period}`;
      reportMap[key] = report;
    });
    
    // Build comprehensive report list including pending periods
    const result = [];
    
    // Group timetable by teacher
    const teacherPeriods = {};
    allTimetable.forEach(tt => {
      const teacher = String(tt.teacherEmail || tt.teacher || '').toLowerCase().trim();
      if (!teacher) return;
      
      if (!teacherPeriods[teacher]) {
        teacherPeriods[teacher] = [];
      }
      teacherPeriods[teacher].push(tt);
    });
    
    // For each teacher's periods, check if report submitted
    Object.keys(teacherPeriods).forEach(teacherEmail => {
      const periods = teacherPeriods[teacherEmail];
      
      periods.forEach(tt => {
        const key = `${teacherEmail}|${tt.class}|${tt.subject}|${tt.period}`;
        const report = reportMap[key];
        
        result.push({
          teacher: tt.teacherName || tt.teacher || teacherEmail,
          teacherEmail: teacherEmail,
          class: tt.class || '',
          subject: tt.subject || '',
          period: Number(tt.period || 0),
          chapter: report ? report.chapter : '',
          sessionNo: report ? Number(report.sessionNo || 0) : 0,
          objectives: report ? report.objectives : '',
          activities: report ? report.activities : '',
          completed: report ? report.completed : 'Not Started',
          notes: report ? report.notes : '',
          planType: report ? report.planType : '',
          lessonPlanId: report ? report.lessonPlanId : '',
          submitted: !!report,
          submittedAt: report ? report.createdAt : null
        });
      });
    });
    
    // Sort by teacher, then period
    result.sort((a, b) => {
      if (a.teacher < b.teacher) return -1;
      if (a.teacher > b.teacher) return 1;
      return a.period - b.period;
    });
    
    Logger.log(`Returning ${result.length} total period records`);
    
    return _respond({
      success: true,
      date: date,
      reports: result,
      stats: {
        totalPeriods: result.length,
        submitted: result.filter(r => r.submitted).length,
        pending: result.filter(r => !r.submitted).length
      }
    });
    
  } catch (error) {
    Logger.log('Error getting daily reports for date: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle SEND custom notification (HM broadcasts)
 * HM can send notices to all teachers or specific groups
 */
function _handleSendCustomNotification(params) {
  try {
    const { userEmail, title, message, priority, recipients } = params;
    
    Logger.log(`=== Sending Custom Notification ===`);
    Logger.log(`From: ${userEmail}, Title: ${title}, Recipients: ${recipients}, Priority: ${priority}`);
    
    if (!title || !message) {
      return _respond({ success: false, error: 'Title and message are required' });
    }
    
    // Get all users to send notifications to
    const uSh = _getSheet('Users');
    const uHeaders = _headers(uSh);
    const users = _rows(uSh).map(r => _indexByHeader(r, uHeaders));
    
    // Filter recipients based on selection
    let targetUsers = [];
    if (recipients === 'all' || !recipients) {
      // Send to all teachers
      targetUsers = users.filter(u => {
        const roles = String(u.roles || '').toLowerCase();
        return roles.includes('teacher') || roles.includes('class teacher');
      });
    } else if (recipients === 'teachers') {
      targetUsers = users.filter(u => {
        const roles = String(u.roles || '').toLowerCase();
        return roles.includes('teacher');
      });
    } else if (recipients === 'class_teachers') {
      targetUsers = users.filter(u => {
        const roles = String(u.roles || '').toLowerCase();
        return roles.includes('class teacher');
      });
    } else {
      // Default to all teachers
      targetUsers = users.filter(u => {
        const roles = String(u.roles || '').toLowerCase();
        return roles.includes('teacher') || roles.includes('class teacher');
      });
    }
    
    Logger.log(`Found ${targetUsers.length} target users for notification`);
    
    // Send email to each recipient
    let successCount = 0;
    let failCount = 0;
    
    targetUsers.forEach(user => {
      const userEmail = user.email || '';
      if (!userEmail) return;
      
      const priorityLabel = priority === 'URGENT' ? '🚨 URGENT' : priority === 'HIGH' ? '⚠️ HIGH PRIORITY' : '📢';
      const emailSubject = `${priorityLabel} Notice: ${title}`;
      
      const emailBody = `
Dear ${user.name || 'Teacher'},

${message}

---
This is an official notice from School Administration.
Priority: ${priority || 'NORMAL'}

Best regards,
School Administration
      `;
      
      try {
        const result = sendEmailNotification(userEmail, emailSubject, emailBody);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        Logger.log(`Failed to send email to ${userEmail}: ${err.message}`);
        failCount++;
      }
    });
    
    Logger.log(`Notification sent: ${successCount} successful, ${failCount} failed`);
    
    return _respond({
      success: true,
      message: `Notice sent to ${successCount} recipients`,
      sent: successCount,
      failed: failCount
    });
    
  } catch (error) {
    Logger.log('Error sending custom notification: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle GET app settings
 * Returns periodTimes from Settings sheet for frontend to use
 */
function _handleGetAppSettings() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    Logger.log(`Total settings rows: ${settingsData.length}`);
    
    // Extract period times for different days
    const mondayToThursdaySetting = settingsData.find(row => 
      (row.key || '').trim() === 'periodTimes (Monday to Thursday)'
    );
    
    const fridaySetting = settingsData.find(row => 
      (row.key || '').trim() === 'periodTimes (Friday)'
    );
    
    // Parse the JSON values if they exist
    let periodTimesWeekday = null;
    let periodTimesFriday = null;
    
    if (mondayToThursdaySetting && mondayToThursdaySetting.value) {
      try {
        periodTimesWeekday = JSON.parse(mondayToThursdaySetting.value);
        Logger.log(`✅ Parsed Monday-Thursday period times: ${JSON.stringify(periodTimesWeekday).substring(0, 100)}...`);
      } catch (e) {
        Logger.log(`⚠️ Failed to parse Monday-Thursday period times: ${e.message}`);
      }
    }
    
    if (fridaySetting && fridaySetting.value) {
      try {
        periodTimesFriday = JSON.parse(fridaySetting.value);
        Logger.log(`✅ Parsed Friday period times: ${JSON.stringify(periodTimesFriday).substring(0, 100)}...`);
      } catch (e) {
        Logger.log(`⚠️ Failed to parse Friday period times: ${e.message}`);
      }
    }
    
    return _respond({
      success: true,
      periodTimesWeekday: periodTimesWeekday,
      periodTimesFriday: periodTimesFriday,
      periodTimes: periodTimesWeekday  // Provide default weekday times
    });
    
  } catch (error) {
    Logger.log('Error getting app settings: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Test function for scheme-based lesson planning
 */
function testSchemeLessonPlanningAPI() {
  try {
    console.log('Testing Scheme-Based Lesson Planning API...');
    
    const teachersResult = getAllTeachers();
    console.log(`Teachers found: ${teachersResult.length}`);
    
    if (teachersResult.length > 0) {
      const testTeacher = teachersResult[0].email;
      console.log(`Testing with teacher: ${testTeacher}`);
      
      const schemesResult = getApprovedSchemesForLessonPlanning(testTeacher);
      console.log(`Schemes Result: ${JSON.stringify(schemesResult)}`);
      
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const periodsResult = getAvailablePeriodsForLessonPlan(testTeacher, startDate, endDate);
      console.log(`Periods Result: ${JSON.stringify(periodsResult)}`);
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error(`Error in test: ${error.message}`);
  }
}