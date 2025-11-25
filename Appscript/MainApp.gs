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
    _clearRequestCache(); // PERFORMANCE: Clear cache at start of each request
    _bootstrapSheets();
    
    // Basic system check
    if (action === 'ping') {
      return _respond({ ok: true, now: new Date().toISOString() });
    }
    
    // Debug: Check current date/time in IST
    if (action === 'checkDate') {
      const now = new Date();
      const todayISO = _todayISO();
      const dayName = _dayName(todayISO);
      return _respond({
        serverTimeUTC: now.toISOString(),
        serverTimeIST: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss EEEE'),
        todayISO: todayISO,
        todayDayName: dayName,
        timezone: TZ,
        test: {
          input: '2025-11-24',
          parsed: _dayName('2025-11-24')
        }
      });
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
      Logger.log(`[MainApp] getTeacherDailyTimetable called: identifier=${identifier}, date=${date}`);
      const result = getTeacherDailyTimetable(identifier, date);
      Logger.log(`[MainApp] getTeacherDailyTimetable returned ${result.length} periods`);
      return _respond(result);
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
    
    if (action === 'getTeacherSubstitutionsRange') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const startDate = e.parameter.startDate || '';
      const endDate = e.parameter.endDate || '';
      return _respond(getTeacherSubstitutionsRange(email, startDate, endDate));
    }
    
    // Debug endpoint to check all substitutions
    if (action === 'getAllSubstitutions') {
      const sh = _getSheet('Substitutions');
      const headers = _headers(sh);
      const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
      
      Logger.log(`[getAllSubstitutions] Total rows: ${allRows.length}`);
      Logger.log(`[getAllSubstitutions] Headers: ${JSON.stringify(headers)}`);
      
      if (allRows.length > 0) {
        Logger.log(`[getAllSubstitutions] Sample row: ${JSON.stringify(allRows[0])}`);
      }
      
      return _respond({
        total: allRows.length,
        headers: headers,
        data: allRows,
        sampleDateNormalized: allRows.length > 0 ? _isoDateString(allRows[0].date) : null
      });
    }
    
    if (action === 'getUnacknowledgedSubstitutions') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getUnacknowledgedSubstitutions(email));
    }
    
    if (action === 'getTeacherSubstitutionNotifications') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getTeacherSubstitutionNotifications(email));
    }
    
    if (action === 'getAvailableTeachers' || action === 'getFreeTeachers') {
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
    
    // NEW: Batch endpoint for daily report performance
    if (action === 'getPlannedLessonsForDate') {
      return _handleGetPlannedLessonsForDate(e.parameter);
    }
    
    // CASCADE ROUTES
    if (action === 'getCascadePreview') {
      const lpId = e.parameter.lpId || '';
      const teacherEmail = e.parameter.teacherEmail || '';
      const originalDate = e.parameter.originalDate || '';
      return _respond(getCascadePreview(lpId, teacherEmail, originalDate));
    }
    
    // NEW: Batch endpoint for teacher timetable with reports (reduces 2 calls to 1)
    if (action === 'getTeacherDailyData') {
      return _handleGetTeacherDailyData(e.parameter);
    }
    
    // === SESSION COMPLETION TRACKING GET ROUTES ===
    if (action === 'getTeacherPerformanceDashboard') {
      return _handleGetTeacherPerformanceDashboard(e.parameter);
    }
    
    if (action === 'getSchemeCompletionAnalytics') {
      return _handleGetSchemeCompletionAnalytics(e.parameter);
    }
    
    if (action === 'getSessionCompletionHistory') {
      return _handleGetSessionCompletionHistory(e.parameter);
    }
    
    // === DAILY REPORT ROUTES ===
    if (action === 'getTeacherDailyReportsForDate') {
      return _handleGetTeacherDailyReportsForDate(e.parameter);
    }
    
    if (action === 'checkCascadingIssues') {
      return _handleCheckCascadingIssues(e.parameter);
    }
    
    // === HM DAILY OVERSIGHT ROUTES ===
    if (action === 'getDailyReportsForDate') {
      return _handleGetDailyReportsForDate(e.parameter);
    }
    
    if (action === 'getLessonPlansForDate') {
      return _handleGetLessonPlansForDate(e.parameter);
    }
    
    // === HM MONITORING ROUTES (GET) ===
    if (action === 'getAllTeachersPerformance') {
      return _handleGetAllTeachersPerformance(e.parameter);
    }
    
    if (action === 'getSchoolSessionAnalytics') {
      return _handleGetSchoolSessionAnalytics(e.parameter);
    }
    
    if (action === 'getCascadingIssuesReport') {
      return _handleGetCascadingIssuesReport(e.parameter);
    }
    
    if (action === 'getAllTeachersPerformance') {
      return _handleGetAllTeachersPerformance(e.parameter);
    }
    
    if (action === 'getClassSubjectPerformance') {
      return _respond(getClassSubjectPerformance());
    }
    
    if (action === 'getDailySubmissionMetrics') {
      const daysBack = Number(e.parameter.daysBack || 30);
      return _respond(getDailySubmissionMetrics(daysBack));
    }
    
    if (action === 'getHMAnalyticsDashboard') {
      return _respond(getHMAnalyticsDashboard());
    }
    
    if (action === 'getSchemeSubmissionHelper') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const className = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const term = (e.parameter.term || '').trim();
      return _respond(getSchemeSubmissionHelper(teacherEmail, className, subject, term));
    }
    
    if (action === 'getSyllabusPaceTracking') {
      const term = (e.parameter.term || '').trim();
      return _respond(getSyllabusPaceTracking(term));
    }
    
    if (action === 'syncSessionDependencies') {
      return _handleSyncSessionDependencies(e.parameter);
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
    _clearRequestCache(); // PERFORMANCE: Clear cache at start of each request
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
    
    if (action === 'acknowledgeSubstitutionAssignment') {
      return _respond(acknowledgeSubstitutionAssignment(data));
    }
    
    // === SCHEME MANAGEMENT ROUTES ===
    if (action === 'submitPlan') {
      return _handleSubmitScheme(data);
    }
    
    if (action === 'updatePlanStatus') {
      return _handleUpdateSchemeStatus(data);
    }
    
    // === CASCADE ROUTES ===
    if (action === 'executeCascade') {
      return _respond(executeCascade(data));
    }
    
    // === DAILY REPORT ROUTES ===
    if (action === 'submitDailyReport') {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
        appLog('INFO', 'submitDailyReport start', { version: 90 });
        appLog('DEBUG', 'payload', data);

        const sh = _getSheet('DailyReports');
        const headers = ['date', 'teacherEmail', 'teacherName', 'class', 'subject', 'period', 'planType', 'lessonPlanId', 'chapter', 'sessionNo', 'totalSessions', 'completionPercentage', 'chapterStatus', 'deviationReason', 'difficulties', 'nextSessionPlan', 'objectives', 'activities', 'completed', 'notes', 'createdAt'];
        _ensureHeaders(sh, headers);

        const reportDate = _normalizeQueryDate(data.date);
        const teacherEmail = String(data.teacherEmail || '').toLowerCase().trim();
        const reportClass = String(data.class || '').trim();
        const reportSubject = String(data.subject || '').trim();
        const reportPeriod = Number(data.period || 0);
        appLog('DEBUG', 'duplicateCheck params', { date: reportDate, email: teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod });

        SpreadsheetApp.flush();
        const existingReports = _rows(sh).map(row => _indexByHeader(row, headers));
        appLog('DEBUG', 'existingReports count', { count: existingReports.length });

        const duplicate = existingReports.find(r => {
          const rDate = _isoDateIST(r.date);
          const rEmail = String(r.teacherEmail || '').toLowerCase().trim();
          const rClass = String(r.class || '').trim();
          const rSubject = String(r.subject || '').trim();
          const rPeriod = Number(r.period || 0);
          return rDate === reportDate && rEmail === teacherEmail && rClass === reportClass && rSubject === reportSubject && rPeriod === reportPeriod;
        });

        if (duplicate) {
          appLog('INFO', 'duplicate daily report', { duplicate: duplicate });
          return _respond({ ok: false, error: 'duplicate', message: 'Report already submitted for this period' });
        }

        const now = new Date().toISOString();
        const inferredPlanType = data.lessonPlanId ? 'in plan' : 'not planned';
        const rowData = [
          data.date || '',
          data.teacherEmail || '',
          data.teacherName || '',
          data.class || '',
          data.subject || '',
          Number(data.period || 0),
          data.planType || inferredPlanType,
          data.lessonPlanId || '',
          data.chapter || '',
          Number(data.sessionNo || 0),
          Number(data.totalSessions || 1),
          Number(data.completionPercentage || 0),
          data.chapterStatus || '',
          data.deviationReason || '',
          data.difficulties || '',
          data.nextSessionPlan || '',
          data.objectives || '',
          data.activities || '',
          data.chapterCompleted ? 'Chapter Complete' : (data.completed || ''),
          data.notes || '',
          now
        ];
        // Sanitize string fields to prevent formula injection in Sheets
        var sanitizedRowData = rowData.map(function(v){
          if (v === null || v === undefined) return '';
          if (typeof v === 'string') {
            return (/^[=+\-@]/.test(v) ? ('\'' + v) : v);
          }
          return v;
        });
        sh.appendRow(sanitizedRowData);
        SpreadsheetApp.flush();
        appLog('INFO', 'daily report submitted', { email: teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod });

        // Optional AUTO-CASCADE: if 0% completion and a lessonPlanId provided, attempt cascade immediately
        let autoCascade = null;
        try {
          const completionPct = Number(data.completionPercentage || 0);
          const lpIdForCascade = String(data.lessonPlanId || '').trim();
          const autoCascadeEnabled = _isAutoCascadeEnabled();
          if (autoCascadeEnabled && completionPct === 0 && lpIdForCascade) {
            appLog('INFO', 'autoCascade trigger check passed', { lpId: lpIdForCascade });
            // Use reportDate (normalized) as originalDate reference
            const preview = getCascadePreview(lpIdForCascade, teacherEmail, reportDate);
            if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
              appLog('INFO', 'autoCascade executing', { affected: preview.sessionsToReschedule.length });
              const execPayload = {
                sessionsToReschedule: preview.sessionsToReschedule,
                mode: preview.mode,
                dailyReportContext: {
                  date: reportDate,
                  teacherEmail: teacherEmail,
                  class: reportClass,
                  subject: reportSubject,
                  period: reportPeriod
                }
              };
              const cascadeResult = executeCascade(execPayload);
              autoCascade = {
                attempted: true,
                previewSessions: preview.sessionsToReschedule.length,
                success: cascadeResult && cascadeResult.success,
                updatedCount: cascadeResult && cascadeResult.updatedCount,
                errors: cascadeResult && cascadeResult.errors,
                flagEnabled: autoCascadeEnabled
              };
              appLog('INFO', 'autoCascade result', autoCascade);
            } else {
              autoCascade = { attempted: true, success: false, reason: 'preview_not_cascadable', preview: preview, flagEnabled: autoCascadeEnabled };
              appLog('INFO', 'autoCascade preview not cascadable', { preview });
            }
          } else {
            autoCascade = { attempted: false, reason: autoCascadeEnabled ? 'completion_not_zero_or_missing_lpId' : 'auto_disabled', flagEnabled: autoCascadeEnabled };
          }
        } catch (acErr) {
          autoCascade = { attempted: true, success: false, error: acErr.message, flagEnabled: _isAutoCascadeEnabled() };
          appLog('ERROR', 'autoCascade exception', { message: acErr.message, stack: acErr.stack });
        }

        return _respond({ ok: true, submitted: true, autoCascade: autoCascade });
      } catch (err) {
        appLog('ERROR', 'submitDailyReport failed', { message: err.message, stack: err.stack });
        return _respond({ error: 'Failed to submit: ' + err.message });
      } finally {
        lock.releaseLock();
      }
    }
    
    // === CASCADE EXECUTION ROUTE ===
    if (action === 'executeCascade') {
      return _respond(executeCascade(data));
    }
    
    // === SCHEME-BASED LESSON PLANNING ROUTES ===
    if (action === 'createSchemeLessonPlan') {
      return _handleCreateSchemeLessonPlan(data);
    }
    
    // === CHAPTER COMPLETION ROUTES ===
    if (action === 'checkChapterCompletion') {
      return _handleCheckChapterCompletion(data);
    }
    
    if (action === 'applyChapterCompletionAction') {
      appLog('INFO', 'applyChapterCompletionAction', { action: data && data.action, idsCount: (data && data.lessonPlanIds && data.lessonPlanIds.length) || 0 });
      return _handleApplyChapterCompletionAction(data);
    }
    
    // === SESSION COMPLETION TRACKING ROUTES ===
    if (action === 'updateSessionCompletion') {
      return _handleUpdateSessionCompletion(data);
    }
    
    if (action === 'getTeacherPerformanceDashboard') {
      return _handleGetTeacherPerformanceDashboard(data);
    }
    
    if (action === 'getSchemeCompletionAnalytics') {
      return _handleGetSchemeCompletionAnalytics(data);
    }
    
    // === HM MONITORING ROUTES ===
    if (action === 'getAllTeachersPerformance') {
      return _handleGetAllTeachersPerformance(data);
    }
    
    if (action === 'getClassSubjectPerformance') {
      return _respond(getClassSubjectPerformance());
    }
    
    if (action === 'getDailySubmissionMetrics') {
      const daysBack = Number(data.daysBack || 30);
      return _respond(getDailySubmissionMetrics(daysBack));
    }
    
    if (action === 'getHMAnalyticsDashboard') {
      return _respond(getHMAnalyticsDashboard());
    }
    
    if (action === 'getSchoolSessionAnalytics') {
      return _handleGetSchoolSessionAnalytics(data);
    }
    
    if (action === 'getCascadingIssuesReport') {
      return _handleGetCascadingIssuesReport(data);
    }
    
    // === BATCH SYNC ROUTE (Admin/HM only) ===
    if (action === 'syncSessionDependencies') {
      return _handleSyncSessionDependencies(data);
    }
    
    if (action === 'updateLessonPlanStatus') {
      return _handleUpdateLessonPlanStatus(data);
    }
    
    if (action === 'updateLessonPlanDetailsStatus') {
      return _handleUpdateLessonPlanStatus(data); // Same handler, different name for compatibility
    }

    // Simple diagnostic: reveals LessonPlans sheet headers and detects status column
    if (action === 'diagnoseLessonPlanHeaders') {
      return _respond(_handleDiagnoseLessonPlanHeaders());
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
/**
 * Handle GET approved schemes for lesson planning
 * WITH ENHANCED BACKUP IMPLEMENTATION
 */
function _handleGetApprovedSchemesForLessonPlanning(params) {
  try {
    const teacherEmail = params.teacherEmail;
    
    if (!teacherEmail) {
      return _respond({ success: false, error: 'Teacher email is required' });
    }
    
    // Try the original function first
    try {
      if (typeof getApprovedSchemesForLessonPlanning === 'function') {
        Logger.log('Using original getApprovedSchemesForLessonPlanning function');
        const result = getApprovedSchemesForLessonPlanning(teacherEmail);
        return _respond(result);
      }
    } catch (originalError) {
      Logger.log('Original function failed, using backup implementation:', originalError.message);
    }
    
    // ENHANCED BACKUP IMPLEMENTATION WITH CACHING
    Logger.log(`Getting approved schemes for lesson planning (BACKUP): ${teacherEmail}`);
    
    // PERFORMANCE: Use cached sheet data instead of multiple _rows() calls
    const schemesData = _getCachedSheetData('Schemes').data;
    const approvedSchemes = schemesData.filter(scheme => 
      (scheme.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
      (scheme.status || '').toLowerCase() === 'approved'
    );
    
    // PERFORMANCE: Cache lesson plans data
    const lessonPlansData = _getCachedSheetData('LessonPlans').data;
    const teacherPlans = lessonPlansData.filter(plan =>
      (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );
    
    // PERFORMANCE: Cache daily reports once for all schemes
    const dailyReportsData = _getCachedSheetData('DailyReports').data;
    
    // Process each scheme with basic chapter/session breakdown
    const schemesWithProgress = approvedSchemes.map(scheme => {
      // Enhanced chapter parsing with extended session support
      let chapters = [];
      if (scheme.chapter && String(scheme.chapter).trim() !== '') {
        const chapterName = String(scheme.chapter).trim();
        let originalSessionCount = parseInt(scheme.noOfSessions || 2);
        
        // Check daily reports to see if extended sessions are needed
        let extendedSessionCount = originalSessionCount;
        try {
          // PERFORMANCE: Use cached daily reports instead of reading sheet again
          // Find daily reports for this chapter by this teacher
          const chapterReports = dailyReportsData.filter(report => {
            const matchesTeacher = String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
            const matchesChapter = String(report.chapter || '') === String(chapterName || '');
            const matchesClass = String(report.class || '') === String(scheme.class || '');
            const matchesSubject = String(report.subject || '') === String(scheme.subject || '');
            
            return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
          });
          
          if (chapterReports.length > 0) {
            Logger.log(`Found ${chapterReports.length} daily reports for chapter ${chapterName}`);
            
            // Check if any sessions are below 75% completion threshold
            let hasIncompleteSessions = false;
            let maxExistingSession = 0;
            
            for (let i = 1; i <= originalSessionCount; i++) {
              const sessionReport = chapterReports.find(report => 
                Number(report.sessionNo) === i
              );
              
              if (sessionReport) {
                maxExistingSession = Math.max(maxExistingSession, i);
                const completion = Number(sessionReport.completionPercentage || 0);
                Logger.log(`Session ${i}: ${completion}% complete`);
                
                if (completion < 75) {
                  hasIncompleteSessions = true;
                  Logger.log(`Session ${i} incomplete (${completion}% < 75%)`);
                }
              }
            }
            
            // If there are incomplete sessions, allow extended sessions
            // NEW: More permissive logic - show extended if ANY session is incomplete  
            if (hasIncompleteSessions) {
              extendedSessionCount = originalSessionCount + 1;
              Logger.log(`Extending sessions to ${extendedSessionCount} due to incomplete sessions (any session <75%)`);
            }
          } else {
            Logger.log(`No daily reports found for chapter ${chapterName} - using original session count`);
          }
          
        } catch (drError) {
          Logger.log(`Error checking daily reports for extended sessions: ${drError.message}`);
          // Continue with original session count if error
        }
        
        // Create sessions for this chapter (including extended sessions)
        const sessions = [];
        for (let i = 1; i <= extendedSessionCount; i++) {
          const isExtended = i > originalSessionCount;
          const existingPlan = teacherPlans.find(plan =>
            plan.schemeId === scheme.schemeId &&
            String(plan.chapter || '').toLowerCase() === chapterName.toLowerCase() &&
            parseInt(plan.session || '1') === i
          );
          
          sessions.push({
            sessionNumber: i,
            sessionName: `Session ${i}${isExtended ? ' (Extended)' : ''}`,
            estimatedDuration: '45 minutes',
            status: existingPlan ? 'planned' : 'not-planned',
            plannedDate: existingPlan ? existingPlan.selectedDate : null,
            plannedPeriod: existingPlan ? existingPlan.selectedPeriod : null,
            lessonPlanId: existingPlan ? existingPlan.lpId : null,
            isExtended: isExtended
          });
        }
        
        const plannedSessions = sessions.filter(s => s.status === 'planned').length;
        
        chapters.push({
          chapterNumber: 1,
          chapterName: chapterName,
          chapterDescription: chapterName,
          totalSessions: extendedSessionCount, // Use extended count, not original
          plannedSessions: plannedSessions,
          completionPercentage: extendedSessionCount > 0 ? Math.round((plannedSessions / extendedSessionCount) * 100) : 0,
          sessions: sessions
        });
      }
      
      const totalSessions = chapters.reduce((sum, ch) => sum + ch.totalSessions, 0);
      const totalPlanned = chapters.reduce((sum, ch) => sum + ch.plannedSessions, 0);
      
      return {
        schemeId: scheme.schemeId,
        class: scheme.class,
        subject: scheme.subject,
        academicYear: scheme.academicYear,
        term: scheme.term,
        totalChapters: chapters.length,
        totalSessions: totalSessions,
        plannedSessions: totalPlanned,
        overallProgress: totalSessions > 0 ? Math.round((totalPlanned / totalSessions) * 100) : 0,
        chapters: chapters,
        createdAt: scheme.createdAt,
        approvedAt: scheme.approvedAt
      };
    });
    
    // Calculate basic planning date range - show till end of current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
    endDate.setHours(0, 0, 0, 0);
    
    const result = {
      success: true,
      schemes: schemesWithProgress,
      planningDateRange: {
        startDate: _isoDateString(startDate),
        endDate: _isoDateString(endDate),
        deferredDays: 0,
        daysAhead: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
        preparationDay: 'Any',
        isPreparationDay: true,
        canSubmit: true
      },
      summary: {
        totalSchemes: schemesWithProgress.length,
        totalSessions: schemesWithProgress.reduce((sum, s) => sum + s.totalSessions, 0),
        plannedSessions: schemesWithProgress.reduce((sum, s) => sum + s.plannedSessions, 0),
        overallProgress: schemesWithProgress.length > 0 ? 
          Math.round(schemesWithProgress.reduce((sum, s) => sum + s.overallProgress, 0) / schemesWithProgress.length) : 0
      }
    };
    
    Logger.log('Backup implementation completed successfully');
    return _respond(result);
    
  } catch (error) {
    Logger.log('Error in _handleGetApprovedSchemesForLessonPlanning:', error.message);
    Logger.log('Error stack:', error.stack);
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
    
    // Find status column (case-insensitive) and update
    // Normalize headers (trim + lowercase) for flexible matching
    const normalizedHeaders = headers.map(h => String(h).trim());
    let rawStatusIdx = normalizedHeaders.findIndex(h => h === 'status');
    if (rawStatusIdx === -1) {
      rawStatusIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'status');
    }
    if (rawStatusIdx === -1) {
      Logger.log('ERROR: Could not find status column (status/Status). Headers: ' + JSON.stringify(headers));
      return _respond({ error: 'Status column not found in sheet' });
    }
    const statusColIndex = rawStatusIdx + 1; // convert to 1-based
    const previousStatus = sh.getRange(rowIndex + 2, statusColIndex).getValue();
    sh.getRange(rowIndex + 2, statusColIndex).setValue(status);
    const writtenStatus = sh.getRange(rowIndex + 2, statusColIndex).getValue();
    Logger.log(`Status cell write check: prev='${previousStatus}' new='${writtenStatus}' expected='${status}'`);
    
    // Update review comments if provided
    if (comments) {
      let commentsIdx = normalizedHeaders.findIndex(h => h === 'reviewComments');
      if (commentsIdx === -1) {
        commentsIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'reviewcomments');
      }
      if (commentsIdx >= 0) {
        sh.getRange(rowIndex + 2, commentsIdx + 1).setValue(comments);
      } else {
        Logger.log('WARNING: reviewComments column not found; skipping comment write');
      }
    }
    
    // Update reviewedAt timestamp
    let reviewedAtIdx = normalizedHeaders.findIndex(h => h === 'reviewedAt');
    if (reviewedAtIdx === -1) {
      reviewedAtIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'reviewedat');
    }
    if (reviewedAtIdx >= 0) {
      sh.getRange(rowIndex + 2, reviewedAtIdx + 1).setValue(new Date().toISOString());
    } else {
      Logger.log('INFO: reviewedAt column not present; timestamp skipped');
    }
    
    Logger.log(`Lesson plan ${lpId} status updated to ${status} (verification: '${writtenStatus}')`);
    // Include verification data for debugging on client side
    return _respond({ success: true, message: 'Lesson plan status updated successfully', lpId, previousStatus, writtenStatus });
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
    
    // Normalize planned date/period fields for consistent filtering (selectedDate/selectedPeriod)
    const normalizedPlans = allLessonPlans.map(function(plan){
      // selectedDate fallback sequence: selectedDate -> date -> parse from uniqueKey
      var selectedDateVal = plan.selectedDate || plan.date || '';
      if (!selectedDateVal && plan.uniqueKey) {
        try {
          var parts = String(plan.uniqueKey).split('|');
          if (parts.length >= 2) selectedDateVal = parts[1];
        } catch (e) {}
      }
      var normalizedDate = selectedDateVal;
      try {
        if (selectedDateVal instanceof Date) {
          normalizedDate = _isoDateIST(selectedDateVal);
        } else if (typeof selectedDateVal === 'string' && selectedDateVal.indexOf('T') >= 0) {
          normalizedDate = selectedDateVal.split('T')[0];
        }
      } catch (e) {}
      plan.selectedDate = normalizedDate || plan.selectedDate || '';
      plan.selectedPeriod = plan.selectedPeriod || plan.period || '';
      return plan;
    });

    // Apply filters
    let filteredPlans = normalizedPlans;
    
    // Status filtering rules:
    // - If params.status is undefined (missing), default to 'Pending Review'
    // - If params.status is '' or 'All', do NOT filter by status
    // - Otherwise, filter by the provided status
    var hasStatusParam = Object.prototype.hasOwnProperty.call(params, 'status');
    if (!hasStatusParam) {
      filteredPlans = filteredPlans.filter(function(plan){ return String(plan.status || '') === 'Pending Review'; });
    } else if (params.status && params.status !== 'All') {
      filteredPlans = filteredPlans.filter(function(plan){ return String(plan.status || '') === params.status; });
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
    
    Logger.log(`Filtered lesson plans: ${filteredPlans.length}`);
    
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
    Logger.log('=== Getting All Schemes with Filters ===');
    Logger.log(`Filter params: ${JSON.stringify(params)}`);
    
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    
    const allRows = _rows(sh);
    Logger.log(`Total rows found: ${allRows.length}`);
    
    let schemes = allRows
      .map(row => _indexByHeader(row, headers))
      .filter(scheme => scheme && scheme.schemeId);
    
    Logger.log(`Valid schemes before filtering: ${schemes.length}`);
    
    // Apply filters
    if (params.teacher && params.teacher !== '') {
      const teacherLower = params.teacher.toLowerCase();
      schemes = schemes.filter(scheme =>
        String(scheme.teacherName || '').toLowerCase().includes(teacherLower) ||
        String(scheme.teacherEmail || '').toLowerCase().includes(teacherLower)
      );
      Logger.log(`After teacher filter (${params.teacher}): ${schemes.length}`);
    }
    
    if (params.class && params.class !== '') {
      schemes = schemes.filter(scheme =>
        String(scheme.class || '').toLowerCase() === params.class.toLowerCase()
      );
      Logger.log(`After class filter (${params.class}): ${schemes.length}`);
    }
    
    if (params.subject && params.subject !== '') {
      schemes = schemes.filter(scheme =>
        String(scheme.subject || '').toLowerCase() === params.subject.toLowerCase()
      );
      Logger.log(`After subject filter (${params.subject}): ${schemes.length}`);
    }
    
    if (params.status && params.status !== '' && params.status !== 'All') {
      schemes = schemes.filter(scheme =>
        String(scheme.status || '') === params.status
      );
      Logger.log(`After status filter (${params.status}): ${schemes.length}`);
    }
    
    Logger.log(`Final filtered schemes: ${schemes.length}`);
    
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
/**
 * BATCH ENDPOINT: Get teacher's full daily data in ONE call
 * Combines: getTeacherDailyTimetable + getTeacherDailyReportsForDate
 * Performance: Reduces 2 API calls to 1
 */
function _handleGetTeacherDailyData(params) {
  try {
    const { email, date } = params;
    
    Logger.log(`[BATCH] Getting teacher daily data for: ${email} on ${date}`);
    
    if (!email || !date) {
      return _respond({ 
        success: false, 
        error: 'Missing required parameters: email, date' 
      });
    }
    
    // Get timetable data
    const timetableResult = getTeacherDailyTimetable(email, date);
    
    // Get submitted reports
    const reportsResult = _handleGetTeacherDailyReportsForDate({ email, date });
    const reports = reportsResult?.data || [];
    
    return _respond({
      success: true,
      date: date,
      timetable: timetableResult,
      reports: reports,
      combined: true
    });
    
  } catch (error) {
    Logger.log(`[BATCH] Error getting teacher daily data: ${error.message}`);
    return _respond({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * BATCH ENDPOINT: Get all planned lessons for a date (teacher's full day)
 * This replaces multiple getPlannedLessonForPeriod calls with ONE batch call
 * Performance: Reduces 6-8 API calls to 1 call
 */
function _handleGetPlannedLessonsForDate(params) {
  try {
    const { email, date } = params;
    
    Logger.log(`[BATCH] Getting all planned lessons for: ${email} on ${date}`);
    
    if (!email || !date) {
      return _respond({ 
        success: false, 
        error: 'Missing required parameters: email, date' 
      });
    }
    
    const queryDate = _normalizeQueryDate(date);
    
    // Get all lesson plans for this date
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allLessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
    
    Logger.log(`[BATCH] Total lesson plans in sheet: ${allLessonPlans.length}`);
    
    // Filter for Ready status and matching date
    const matchingPlans = allLessonPlans.filter(plan => {
      let selectedDateVal = plan.selectedDate || plan.date;
      
      // FALLBACK: Parse date from uniqueKey if selectedDate is missing
      // uniqueKey format: "email|YYYY-MM-DD|period"
      if (!selectedDateVal && plan.uniqueKey) {
        const parts = String(plan.uniqueKey).split('|');
        if (parts.length >= 2) {
          selectedDateVal = parts[1]; // Extract date from uniqueKey
        }
      }
      
      const planDate = _isoDateIST(selectedDateVal);
      
      const statusRaw = String(plan.status || '');
      const isFetchableStatus = statusRaw === 'Ready' || /rescheduled\s*\(cascade\)/i.test(statusRaw);
      return isFetchableStatus && planDate === queryDate;
    });
    
    Logger.log(`[BATCH] Found ${matchingPlans.length} lesson plans for ${queryDate}`);
    
    // Get scheme details for total sessions (batch lookup)
    const schemeSheet = _getSheet('Schemes');
    const schemeHeaders = _headers(schemeSheet);
    const allSchemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
    const schemeMap = {};
    allSchemes.forEach(scheme => {
      if (scheme.schemeId) {
        schemeMap[scheme.schemeId] = scheme;
      }
    });
    
    // Build response with period-indexed lessons
    const lessonsByPeriod = {};
    matchingPlans.forEach(plan => {
      const periodKey = `${plan.selectedPeriod || plan.period}|${plan.class}|${plan.subject}`;
      
      let totalSessions = 1;
      if (plan.schemeId && schemeMap[plan.schemeId]) {
        totalSessions = Number(schemeMap[plan.schemeId].noOfSessions || 1);
      }
      
      lessonsByPeriod[periodKey] = {
        lpId: plan.lpId,
        schemeId: plan.schemeId,
        chapter: plan.chapter || '',
        session: plan.session || '',
        sessionNo: Number(plan.sessionNo || plan.session || 0),
        totalSessions: totalSessions,
        learningObjectives: plan.learningObjectives || '',
        teachingMethods: plan.teachingMethods || '',
        selectedDate: plan.selectedDate,
        selectedPeriod: plan.selectedPeriod || plan.period,
        class: plan.class,
        subject: plan.subject,
        preparationDay: plan.preparationDay || ''
      };
      
      Logger.log(`[BATCH] Mapped lesson ${plan.lpId} to ${periodKey}`);
    });
    
    return _respond({
      success: true,
      date: queryDate,
      lessonsByPeriod: lessonsByPeriod,
      totalPlans: matchingPlans.length
    });
    
  } catch (error) {
    Logger.log(`[BATCH] Error getting planned lessons: ${error.message}`);
    return _respond({ 
      success: false, 
      error: error.message 
    });
  }
}

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
      let selectedDateVal = plan.selectedDate || plan.date;
      
      // FALLBACK: Parse date from uniqueKey if selectedDate is missing
      // uniqueKey format: "email|YYYY-MM-DD|period"
      if (!selectedDateVal && plan.uniqueKey) {
        const parts = String(plan.uniqueKey).split('|');
        if (parts.length >= 2) {
          selectedDateVal = parts[1]; // Extract date from uniqueKey
        }
      }
      
      const planDate = _isoDateIST(selectedDateVal);
      
      const planPeriod = String(plan.selectedPeriod || plan.period || '');
      
      // Debug logging for each plan
      Logger.log(`Checking plan ${plan.lpId}: status=${plan.status}, selectedDate=${plan.selectedDate}, selectedPeriod=${plan.selectedPeriod}, planDate=${planDate}, planPeriod=${planPeriod}, class=${plan.class}, subject=${plan.subject}`);
      
      const statusRaw = String(plan.status || '');
      const isFetchableStatus = statusRaw === 'Ready' || /rescheduled\s*\(cascade\)/i.test(statusRaw);
      const matches = 
        isFetchableStatus &&
        planDate === queryDate &&
        planPeriod === String(period) &&
        String(plan.class || '').toLowerCase() === String(className).toLowerCase() &&
        String(plan.subject || '').toLowerCase() === String(subject).toLowerCase();
      
      if (matches) {
        Logger.log(`✅ FOUND MATCHING PLAN: ${plan.lpId} for ${className}/${subject}`);
      } else if (/^(Ready|Rescheduled\s*\(Cascade\))$/i.test(String(plan.status || ''))) {
        Logger.log(`❌ No match: planDate=${planDate} vs queryDate=${queryDate}, planPeriod=${planPeriod} vs ${period}, class=${plan.class} vs ${className}, subject=${plan.subject} vs ${subject}`);
      }
      
      return matches;
    });
    
    if (matchingPlan) {
      Logger.log(`Returning lesson plan: ${matchingPlan.lpId}`);
      
      // Get scheme details to include total sessions
      let totalSessions = 1;
      if (matchingPlan.schemeId) {
        try {
          const schemeSheet = _getSheet('Schemes');
          const schemeHeaders = _headers(schemeSheet);
          const schemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
          const matchingScheme = schemes.find(scheme => scheme.schemeId === matchingPlan.schemeId);
          
          if (matchingScheme && matchingScheme.noOfSessions) {
            totalSessions = Number(matchingScheme.noOfSessions);
            Logger.log(`Found scheme with ${totalSessions} total sessions`);
          }
        } catch (schemeError) {
          Logger.log(`Error fetching scheme details: ${schemeError.message}`);
        }
      }
      
      return _respond({
        success: true,
        hasPlannedLesson: true,
        lessonPlan: {
          lpId: matchingPlan.lpId,
          schemeId: matchingPlan.schemeId,
          chapter: matchingPlan.chapter || '',
          session: matchingPlan.session || '',
          sessionNo: Number(matchingPlan.session || 0),
          totalSessions: totalSessions,
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
    
    // CRITICAL: Parse the date string correctly for IST
    // When client sends "2025-11-24", interpret as IST midnight
    const dayName = _dayName(date); // Get the day of week for this date
    
    // Enhanced logging for timezone debugging
    const now = new Date();
    const istNow = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss EEEE');
    const todayISO = _todayISO();
    const todayDayName = _dayName(todayISO);
    
    Logger.log(`=== Daily Reports Request ===`);
    Logger.log(`Current time (IST): ${istNow}`);
    Logger.log(`Today (IST): ${todayISO} = ${todayDayName}`);
    Logger.log(`Requested date: ${date} = ${dayName}`);
    Logger.log(`Date match: ${date === todayISO ? 'YES (today)' : 'NO (different day)'}`);
    
    // Verify date parsing
    const testDate = new Date(date + 'T00:00:00');
    Logger.log(`Test parse: ${date} -> ${testDate.toISOString()} -> ${Utilities.formatDate(testDate, TZ, 'EEEE, dd MMM yyyy')}`);
    
    // Get timetable periods for THIS DAY ONLY
    const ttSh = _getSheet('Timetable');
    const ttHeaders = _headers(ttSh);
    const allTimetable = _rows(ttSh).map(row => _indexByHeader(row, ttHeaders));
    
    Logger.log(`Total timetable entries: ${allTimetable.length}`);
    
    // Log unique days in timetable for debugging
    const uniqueDays = [...new Set(allTimetable.map(tt => tt.dayOfWeek))];
    Logger.log(`Days in timetable: ${uniqueDays.join(', ')}`);
    Logger.log(`Normalized days: ${uniqueDays.map(d => _normalizeDayName(d)).join(', ')}`);
    Logger.log(`Looking for day: ${dayName} (normalized: ${_normalizeDayName(dayName)})`);
    
    // Filter for today's day
    const todayTimetable = allTimetable.filter(tt => _normalizeDayName(tt.dayOfWeek) === _normalizeDayName(dayName));
    Logger.log(`Timetable entries for ${dayName}: ${todayTimetable.length}`);
    
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
    
    Logger.log(`Found ${todayTimetable.length} timetable periods and ${allReports.length} reports`);
    
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
    todayTimetable.forEach(tt => {
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
          totalSessions: report ? Number(report.totalSessions || 0) : 0,
          completionPercentage: report ? Number(report.completionPercentage || 0) : 0,
          objectives: report ? report.objectives : '',
          activities: report ? report.activities : '',
          completed: report ? report.completed : 'Not Started',
          notes: report ? report.notes : '',
          difficulties: report ? report.difficulties : '',
          nextSessionPlan: report ? report.nextSessionPlan : '',
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
 * Get all lesson plans for a specific date (for HM Daily Oversight)
 * Shows: Class, Period, Teacher, Subject, Chapter, Session No, LP Status, Completion Status, Notes
 */
function _handleGetLessonPlansForDate(params) {
  try {
    const date = params.date || _todayISO();
    const normalizedDate = _isoDateIST(date);
    Logger.log(`Getting lesson plans for date: ${normalizedDate}`);
    
    // Get all lesson plans for this date
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const allLessonPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders))
      .filter(lp => {
        if (!lp || !lp.selectedDate) return false;
        const lpDate = _isoDateIST(lp.selectedDate);
        return lpDate === normalizedDate;
      });
    
    Logger.log(`Found ${allLessonPlans.length} lesson plans for ${normalizedDate}`);
    
    // Get daily reports to check completion status
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const dailyReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders))
      .filter(report => {
        if (!report || !report.date) return false;
        const reportDate = _isoDateIST(report.date);
        return reportDate === normalizedDate;
      });
    
    // Create report map by lessonPlanId for quick lookup
    const reportMap = {};
    dailyReports.forEach(report => {
      if (report.lessonPlanId) {
        reportMap[report.lessonPlanId] = report;
      }
    });
    
    // Build result with all lesson plan details
    const result = allLessonPlans.map(lp => {
      const report = reportMap[lp.lpId];
      
      return {
        lpId: lp.lpId || '',
        class: lp.class || '',
        period: Number(lp.selectedPeriod || 0),
        teacher: lp.teacherName || '',
        teacherEmail: lp.teacherEmail || '',
        subject: lp.subject || '',
        chapter: lp.chapter || '',
        sessionNo: lp.session || '',
        lpStatus: lp.status || 'draft', // Pending Review, Approved, Rejected
        completionStatus: report ? (report.completed || 'Not Started') : 'Not Started',
        notes: report ? (report.notes || '') : '',
        reviewComments: lp.reviewComments || '',
        submittedAt: lp.submittedAt || '',
        reviewedAt: lp.reviewedAt || '',
        learningObjectives: lp.learningObjectives || '',
        teachingMethods: lp.teachingMethods || '',
        resourcesRequired: lp.resourcesRequired || '',
        assessmentMethods: lp.assessmentMethods || '',
        dailyReportSubmitted: !!report
      };
    });
    
    // Sort by period, then class
    result.sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.class.localeCompare(b.class);
    });
    
    Logger.log(`Returning ${result.length} lesson plan records`);
    
    return _respond({
      success: true,
      date: normalizedDate,
      lessonPlans: result,
      stats: {
        total: result.length,
        pendingReview: result.filter(lp => lp.lpStatus === 'Pending Review').length,
        approved: result.filter(lp => lp.lpStatus === 'Approved').length,
        rejected: result.filter(lp => lp.lpStatus === 'Rejected').length,
        completed: result.filter(lp => lp.completionStatus === 'Fully Completed').length
      }
    });
    
  } catch (error) {
    Logger.log('Error getting lesson plans for date: ' + error.message);
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
 * Handle CHECK cascading issues for a session
 * Returns warnings about incomplete previous sessions
 */
function _handleCheckCascadingIssues(params) {
  try {
    const { teacherEmail, chapter, sessionNo, class: className, subject } = params;
    
    Logger.log(`=== CHECKING CASCADING ISSUES ===`);
    Logger.log(`Teacher: ${teacherEmail}, Chapter: ${chapter}, Session: ${sessionNo}, Class: ${className}, Subject: ${subject}`);
    
    if (!teacherEmail || !chapter || !sessionNo || !className || !subject) {
      return _respond({ 
        success: false, 
        error: 'Missing required parameters: teacherEmail, chapter, sessionNo, class, subject' 
      });
    }
    
    const currentSessionNo = Number(sessionNo);
    if (currentSessionNo <= 1) {
      return _respond({
        success: true,
        hasWarnings: false,
        warnings: []
      });
    }
    
    // Get all daily reports for this teacher, class, and subject
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    Logger.log(`Total reports in sheet: ${allReports.length}`);
    
    // Filter reports for this chapter by this teacher
    const chapterReports = allReports.filter(report => {
      const matchesTeacher = String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
      const matchesChapter = String(report.chapter || '') === String(chapter || '');
      const matchesClass = String(report.class || '') === String(className || '');
      const matchesSubject = String(report.subject || '') === String(subject || '');
      
      return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
    });
    
    Logger.log(`Found ${chapterReports.length} reports for chapter "${chapter}"`);
    
    // Check previous sessions
    const warnings = [];
    const incompleteSessions = [];
    
    for (let checkSessionNo = 1; checkSessionNo < currentSessionNo; checkSessionNo++) {
      const sessionReport = chapterReports.find(report => 
        Number(report.sessionNo) === checkSessionNo
      );
      
      if (sessionReport) {
        const completion = Number(sessionReport.completionPercentage || 0);
        Logger.log(`Session ${checkSessionNo}: ${completion}% complete`);
        
        if (completion < 75) {
          incompleteSessions.push({
            session: checkSessionNo,
            completion: completion,
            date: sessionReport.date,
            difficulties: sessionReport.difficulties || '',
            incomplete: true
          });
        }
      } else {
        Logger.log(`Session ${checkSessionNo}: Not found (0% complete)`);
        
        incompleteSessions.push({
          session: checkSessionNo,
          completion: 0,
          date: 'Not completed',
          difficulties: 'Session not reported',
          incomplete: true
        });
      }
    }
    
    if (incompleteSessions.length > 0) {
      const severity = incompleteSessions.some(s => s.completion < 50) ? 'high' : 'medium';
      const message = `⚠️ ${incompleteSessions.length} previous session${incompleteSessions.length > 1 ? 's' : ''} incomplete`;
      const details = `Session${incompleteSessions.length > 1 ? 's' : ''} ${incompleteSessions.map(s => s.session).join(', ')} need${incompleteSessions.length === 1 ? 's' : ''} attention`;
      
      warnings.push({
        type: 'cascading',
        severity: severity,
        message: message,
        details: details,
        incompleteSessions: incompleteSessions
      });
    }
    
    Logger.log(`=== CASCADING CHECK RESULT: ${warnings.length} warnings ===`);
    
    return _respond({
      success: true,
      hasWarnings: warnings.length > 0,
      warnings: warnings,
      checkedSessions: currentSessionNo - 1,
      incompleteSessions: incompleteSessions
    });
    
  } catch (error) {
    Logger.log('Error checking cascading issues: ' + error.message);
    return _respond({ success: false, error: error.message });
  }
}
function _handleGetAppSettings() {
  try {
    // PERFORMANCE: Use cached Settings data
    const settingsData = _getCachedSheetData('Settings').data;
    
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

// === SESSION COMPLETION TRACKING HANDLERS ===

/**
 * Handle session completion update requests
 */
function _handleUpdateSessionCompletion(data) {
  try {
    Logger.log(`_handleUpdateSessionCompletion called with data: ${JSON.stringify(data)}`);
    
    const result = updateSessionCompletion(data);
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleUpdateSessionCompletion: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle teacher performance dashboard requests  
 */
function _handleGetTeacherPerformanceDashboard(data) {
  try {
    const teacherEmail = data.teacherEmail || '';
    Logger.log(`_handleGetTeacherPerformanceDashboard called for: ${teacherEmail}`);
    
    if (!teacherEmail) {
      return _respond({ success: false, error: 'Teacher email is required' });
    }
    
    const result = getTeacherPerformanceDashboard(teacherEmail);
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetTeacherPerformanceDashboard: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle scheme completion analytics requests
 */
function _handleGetSchemeCompletionAnalytics(data) {
  try {
    const schemeId = data.schemeId || '';
    Logger.log(`_handleGetSchemeCompletionAnalytics called for: ${schemeId}`);
    
    if (!schemeId) {
      return _respond({ success: false, error: 'Scheme ID is required' });
    }
    
    const result = getSchemeCompletionAnalytics(schemeId);
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetSchemeCompletionAnalytics: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle session completion history requests
 */
function _handleGetSessionCompletionHistory(data) {
  try {
    const teacherEmail = data.teacherEmail || '';
    Logger.log(`_handleGetSessionCompletionHistory called for: ${teacherEmail}`);
    
    if (!teacherEmail) {
      return _respond({ success: false, error: 'Teacher email is required' });
    }
    
    // Implementation would fetch session history from sheets
    // For now, return basic structure
    const result = {
      success: true,
      history: []
    };
    
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetSessionCompletionHistory: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle getting all teachers performance (HM only)
 */
function _handleGetAllTeachersPerformance(data) {
  try {
    Logger.log('_handleGetAllTeachersPerformance called');
    
    // Use the heavy computation version from raw data
    const result = computeAllTeachersPerformanceFromRaw();
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetAllTeachersPerformance: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle school session analytics (HM only)
 */
function _handleGetSchoolSessionAnalytics(data) {
  try {
    const filters = data.filters || {};
    Logger.log(`_handleGetSchoolSessionAnalytics called with filters: ${JSON.stringify(filters)}`);
    
    const result = getSchoolSessionAnalytics(filters);
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetSchoolSessionAnalytics: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle cascading issues report (HM only)
 */
function _handleGetCascadingIssuesReport(data) {
  try {
    Logger.log('_handleGetCascadingIssuesReport called');
    
    const result = getCascadingIssuesReport();
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleGetCascadingIssuesReport: ${error.message}`);
    return _respond({ success: false, error: error.message });
  }
}

/**
 * Handle batch sync of session dependencies (Admin/HM only)
 */
function _handleSyncSessionDependencies(data) {
  try {
    Logger.log('_handleSyncSessionDependencies called');
    
    const result = syncSessionDependenciesFromReports();
    return _respond(result);
  } catch (error) {
    Logger.log(`ERROR in _handleSyncSessionDependencies: ${error.message}`);
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

/**
 * ====== HM PERFORMANCE ANALYTICS ======
 * Comprehensive teacher performance data for HM oversight and analysis
 */

/**
 * Get all teachers' performance metrics (HM view)
 * Returns: { success, performances: [{teacherEmail, teacherName, totalSessions, completedSessions, ...}] }
 */
/**
 * Compute all teachers performance from raw data (LessonPlans, DailyReports, Schemes)
 * This is the HEAVY version - aggregates from multiple sheets
 * Used by: _handleGetAllTeachersPerformance (API endpoint)
 */
function computeAllTeachersPerformanceFromRaw() {
  try {
    // Load all sheets
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const allLessonPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders));
    
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    const schemeSh = _getSheet('Schemes');
    const schemeHeaders = _headers(schemeSh);
    const allSchemes = _rows(schemeSh).map(row => _indexByHeader(row, schemeHeaders));
    
    Logger.log(`getAllTeachersPerformance: LP=${allLessonPlans.length}, DR=${allReports.length}, Schemes=${allSchemes.length}`);
    
    // Build teacher data structure with Plan vs Actual tracking
    const teacherData = {};
    
    // STEP 1: Count PLANNED sessions from LessonPlans (these are the planned sessions)
    allLessonPlans.forEach(lp => {
      const email = String(lp.teacherEmail || '').toLowerCase().trim();
      const name = lp.teacherName || email;
      
      if (!email) return;
      
      if (!teacherData[email]) {
        teacherData[email] = {
          teacherEmail: email,
          teacherName: name,
          
          // PLAN metrics
          plannedSessions: 0,
          approvedPlans: 0,
          pendingPlans: 0,
          
          // ACTUAL metrics
          actualSessions: 0,
          completedSessions: 0,
          partialSessions: 0,
          notStartedSessions: 0,
          
          // Coverage
          completionPercentages: [],
          subjects: new Set(),
          classes: new Set(),
          chapters: new Set(),
          
          // Quality
          cascadingIssues: 0,
          lastSubmitDate: null
        };
      }
      
      const teacher = teacherData[email];
      teacher.plannedSessions++;
      
      if (lp.status === 'Approved' || lp.status === 'approved') {
        teacher.approvedPlans++;
      } else {
        teacher.pendingPlans++;
      }
      
      // Track subjects and classes from plans
      if (lp.subject) teacher.subjects.add(lp.subject);
      if (lp.class) teacher.classes.add(lp.class);
      if (lp.chapter) teacher.chapters.add(lp.chapter);
    });
    
    // STEP 2: Count ACTUAL sessions from DailyReports (what was actually taught)
    allReports.forEach(report => {
      const email = String(report.teacherEmail || '').toLowerCase().trim();
      const name = report.teacherName || email;
      
      if (!email) return;
      
      if (!teacherData[email]) {
        teacherData[email] = {
          teacherEmail: email,
          teacherName: name,
          plannedSessions: 0,
          approvedPlans: 0,
          pendingPlans: 0,
          actualSessions: 0,
          completedSessions: 0,
          partialSessions: 0,
          notStartedSessions: 0,
          completionPercentages: [],
          subjects: new Set(),
          classes: new Set(),
          chapters: new Set(),
          cascadingIssues: 0,
          lastSubmitDate: null
        };
      }
      
      const teacher = teacherData[email];
      teacher.actualSessions++;
      
      // Track subjects, classes, chapters
      if (report.subject) teacher.subjects.add(report.subject);
      if (report.class) teacher.classes.add(report.class);
      if (report.chapter) teacher.chapters.add(report.chapter);
      
      // Categorize by completion status
      const completion = Number(report.completionPercentage || 0);
      teacher.completionPercentages.push(completion);
      
      if (completion >= 100 || (report.completed === 'Yes' || report.completed === true)) {
        teacher.completedSessions++;
      } else if (completion >= 50) {
        teacher.partialSessions++;
      } else if (completion > 0) {
        teacher.notStartedSessions++;
      }
      
      // Update last submit date
      if (report.createdAt) {
        const submitDate = new Date(report.createdAt);
        if (!teacher.lastSubmitDate || submitDate > teacher.lastSubmitDate) {
          teacher.lastSubmitDate = submitDate;
        }
      }
    });
    
    // STEP 3: Calculate performance metrics and plan vs actual comparison
    const performances = Object.values(teacherData).map(teacher => {
      // Calculate average completion percentage
      const avgCompletion = teacher.completionPercentages.length > 0
        ? Math.round(teacher.completionPercentages.reduce((a, b) => a + b, 0) / teacher.completionPercentages.length)
        : 0;
      
      // Plan vs Actual comparison
      const planActualGap = teacher.plannedSessions - teacher.actualSessions;
      const coveragePercentage = teacher.plannedSessions > 0
        ? Math.round((teacher.actualSessions / teacher.plannedSessions) * 100)
        : 0;
      
      // Detect cascading issues (sessions with completion < 75%)
      const lowCompletions = teacher.completionPercentages.filter(c => c < 75);
      teacher.cascadingIssues = lowCompletions.length;
      
      // Calculate quality score based on:
      // 1. Coverage (how many planned sessions were actually delivered) - 50%
      // 2. Completion (how thoroughly were sessions completed) - 30%
      // 3. Consistency (how many sessions had issues) - 20%
      const coverageScore = Math.min(100, coveragePercentage);
      const completionScore = avgCompletion;
      const consistencyScore = teacher.actualSessions > 0
        ? Math.max(0, 100 - (teacher.cascadingIssues * 10))
        : 0;
      
      const qualityScore = Math.round(
        (coverageScore * 0.5) + 
        (completionScore * 0.3) + 
        (consistencyScore * 0.2)
      );
      
      // Determine performance grade
      let performanceGrade = 'No Data';
      if (teacher.actualSessions > 0) {
        if (qualityScore >= 90) performanceGrade = 'Excellent';
        else if (qualityScore >= 75) performanceGrade = 'Good';
        else if (qualityScore >= 60) performanceGrade = 'Satisfactory';
        else if (qualityScore >= 40) performanceGrade = 'Needs Improvement';
        else performanceGrade = 'At Risk';
      }
      
      return {
        teacherEmail: teacher.teacherEmail,
        teacherName: teacher.teacherName,
        
        // Plan vs Actual
        plannedSessions: teacher.plannedSessions,
        actualSessions: teacher.actualSessions,
        planActualGap: planActualGap,
        coveragePercentage: coveragePercentage,
        
        // Actual breakdown
        completedSessions: teacher.completedSessions,
        partialSessions: teacher.partialSessions,
        notStartedSessions: teacher.notStartedSessions,
        averageCompletion: avgCompletion,
        
        // Quality metrics
        cascadingIssues: teacher.cascadingIssues,
        qualityScore: qualityScore,
        performanceGrade: performanceGrade,
        
        // Additional info
        approvedPlans: teacher.approvedPlans,
        pendingPlans: teacher.pendingPlans,
        lastSubmitDate: teacher.lastSubmitDate ? Utilities.formatDate(teacher.lastSubmitDate, TZ, 'yyyy-MM-dd') : 'Never',
        subjects: Array.from(teacher.subjects).join(', '),
        classes: Array.from(teacher.classes).join(', '),
        chapters: Array.from(teacher.chapters).length
      };
    }).sort((a, b) => {
      // Sort by performance grade, then by quality score
      const gradeOrder = { 'Excellent': 5, 'Good': 4, 'Satisfactory': 3, 'Needs Improvement': 2, 'At Risk': 1, 'No Data': 0 };
      const gradeA = gradeOrder[a.performanceGrade] || 0;
      const gradeB = gradeOrder[b.performanceGrade] || 0;
      if (gradeA !== gradeB) return gradeB - gradeA;
      return b.qualityScore - a.qualityScore;
    });
    
    Logger.log(`getAllTeachersPerformance: Computed performance for ${performances.length} teachers`);
    
    return {
      success: true,
      performances: performances,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log(`ERROR in getAllTeachersPerformance: ${error.message}`);
    return {
      success: false,
      error: error.message,
      performances: []
    };
  }
}

/**
 * Get class/subject-level performance analytics
 * Returns: { success, classMetrics: [{class, subject, avgCompletion, submissionRate, teacherCount, ...}] }
 */
function getClassSubjectPerformance() {
  try {
    // Load lesson plans (PLANNED sessions by class/subject)
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const allLessonPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders));
    
    // Load daily reports (ACTUAL sessions by class/subject)
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    Logger.log(`getClassSubjectPerformance: LP=${allLessonPlans.length}, DR=${allReports.length}`);
    
    // STEP 1: Create lesson plan index for matching
    const lessonPlanIndex = {};
    
    allLessonPlans.forEach(lp => {
      const cls = String(lp.class || '').trim();
      const subject = String(lp.subject || '').trim();
      const chapter = String(lp.chapter || '').trim().toLowerCase();
      const date = String(lp.date || '').split('T')[0]; // Get date part only
      
      if (!cls || !subject) return;
      
      // Create multiple keys for flexible matching
      const keys = [
        `${cls}|${subject}|${chapter}|${date}`, // Exact match
        `${cls}|${subject}|${chapter}`, // Match without date
        `${cls}|${subject}|${date}`, // Match without chapter
      ];
      
      keys.forEach(key => {
        if (!lessonPlanIndex[key]) {
          lessonPlanIndex[key] = [];
        }
        lessonPlanIndex[key].push(lp);
      });
    });
    
    // STEP 2: Count PLANNED sessions by class/subject and track unique lesson plan IDs
    const classSubjectData = {};
    
    allLessonPlans.forEach(lp => {
      const cls = String(lp.class || '').trim();
      const subject = String(lp.subject || '').trim();
      const key = `${cls}|${subject}`;
      
      if (!cls || !subject) return;
      
      if (!classSubjectData[key]) {
        classSubjectData[key] = {
          class: cls,
          subject: subject,
          plannedSessions: 0,
          lessonPlanIds: new Set(), // Track unique lesson plans
          matchedLessonPlanIds: new Set(), // Track which plans have been taught
          unplannedSessions: 0,
          completedSessions: 0,
          partialSessions: 0,
          completionValues: [],
          teachers: new Set(),
          chapters: new Set()
        };
      }
      
      const data = classSubjectData[key];
      // Create unique ID for this lesson plan
      const lpId = `${lp.class}|${lp.subject}|${lp.chapter}|${lp.date}|${lp.teacherEmail}`;
      data.lessonPlanIds.add(lpId);
      data.plannedSessions++;
      data.teachers.add(lp.teacherEmail);
      if (lp.chapter) data.chapters.add(lp.chapter);
    });
    
    // STEP 3: Count ACTUAL sessions - match with lesson plans
    allReports.forEach(report => {
      const cls = String(report.class || '').trim();
      const subject = String(report.subject || '').trim();
      const chapter = String(report.chapter || '').trim().toLowerCase();
      const date = String(report.date || '').split('T')[0];
      const key = `${cls}|${subject}`;
      
      if (!cls || !subject) return;
      
      if (!classSubjectData[key]) {
        classSubjectData[key] = {
          class: cls,
          subject: subject,
          plannedSessions: 0,
          lessonPlanIds: new Set(),
          matchedLessonPlanIds: new Set(),
          unplannedSessions: 0,
          completedSessions: 0,
          partialSessions: 0,
          completionValues: [],
          teachers: new Set(),
          chapters: new Set()
        };
      }
      
      const data = classSubjectData[key];
      data.teachers.add(report.teacherEmail);
      if (report.chapter) data.chapters.add(report.chapter);
      
      // Check if this report has a corresponding lesson plan
      const matchKeys = [
        `${cls}|${subject}|${chapter}|${date}`,
        `${cls}|${subject}|${chapter}`,
        `${cls}|${subject}|${date}`,
      ];
      
      let matchedPlan = null;
      for (const matchKey of matchKeys) {
        if (lessonPlanIndex[matchKey] && lessonPlanIndex[matchKey].length > 0) {
          matchedPlan = lessonPlanIndex[matchKey][0]; // Get first matching plan
          break;
        }
      }
      
      if (matchedPlan) {
        // Mark this lesson plan as taught (using unique ID)
        const lpId = `${matchedPlan.class}|${matchedPlan.subject}|${matchedPlan.chapter}|${matchedPlan.date}|${matchedPlan.teacherEmail}`;
        data.matchedLessonPlanIds.add(lpId);
      } else {
        // This report has NO matching lesson plan (taught without preparation)
        data.unplannedSessions++;
      }
      
      const completion = Number(report.completionPercentage || 0);
      data.completionValues.push(completion);
      
      if (completion >= 100 || report.completed === 'Yes' || report.completed === true) {
        data.completedSessions++;
      } else if (completion >= 50) {
        data.partialSessions++;
      }
    });
    
    // STEP 4: Calculate metrics with Plan vs Actual comparison
    const classMetrics = Object.values(classSubjectData).map(data => {
      const avgCompletion = data.completionValues.length > 0
        ? Math.round(data.completionValues.reduce((a, b) => a + b, 0) / data.completionValues.length)
        : 0;
      
      // Actual = UNIQUE lesson plans that have been taught (not report count)
      const actualPlannedSessions = data.matchedLessonPlanIds.size;
      
      // Plan vs Actual comparison
      const planActualGap = data.plannedSessions - actualPlannedSessions;
      const coveragePercentage = data.plannedSessions > 0
        ? Math.round((actualPlannedSessions / data.plannedSessions) * 100)
        : 0;
      
      // Total actual includes both planned and unplanned
      const totalActualSessions = actualPlannedSessions + data.unplannedSessions;
      
      // Determine status based on coverage and completion
      let status = 'On Track';
      if (data.unplannedSessions > 0) {
        status = '⚠️ Unprepared Teaching';
      } else if (coveragePercentage < 50) {
        status = 'Behind Schedule';
      } else if (coveragePercentage < 80) {
        status = 'Slightly Behind';
      } else if (coveragePercentage === 100 && avgCompletion >= 80) {
        status = 'Excellent';
      } else if (coveragePercentage === 100 && avgCompletion >= 60) {
        status = 'Good';
      }
      
      // Determine risk level
      let riskLevel = 'Low';
      if (data.unplannedSessions > 2 || avgCompletion < 60 || coveragePercentage < 50) {
        riskLevel = 'High';
      } else if (data.unplannedSessions > 0 || avgCompletion < 75 || coveragePercentage < 75) {
        riskLevel = 'Medium';
      }
      
      // Get teacher names from the teachers set
      const teacherEmails = Array.from(data.teachers);
      const teacherNames = teacherEmails.map(email => {
        // Extract name from email or use email
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }).join(', ');
      
      return {
        class: data.class,
        subject: data.subject,
        teacherEmails: teacherEmails.join(', '), // All teacher emails
        teacherNames: teacherNames, // Display names
        
        // Plan vs Actual (unique lesson plans only)
        plannedSessions: data.plannedSessions,
        actualPlannedSessions: actualPlannedSessions,
        planActualGap: planActualGap,
        coveragePercentage: coveragePercentage,
        
        // Unplanned sessions (RED FLAG)
        unplannedSessions: data.unplannedSessions,
        totalActualSessions: totalActualSessions,
        
        // Actual completion breakdown
        completedSessions: data.completedSessions,
        partialSessions: data.partialSessions,
        avgCompletion: avgCompletion,
        
        // Additional metrics
        teacherCount: data.teachers.size,
        chapterCount: data.chapters.size,
        status: status,
        riskLevel: riskLevel
      };
    });
    
    return {
      success: true,
      classMetrics: classMetrics,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log(`ERROR in getClassSubjectPerformance: ${error.message}`);
    return {
      success: false,
      error: error.message,
      classMetrics: []
    };
  }
}

/**
 * Get daily submission metrics and trends
 * Returns: { success, dailyMetrics: [{date, totalTeachers, submittedReports, pendingReports, avgCompletion, ...}] }
 */
function getDailySubmissionMetrics(daysBack = 30) {
  try {
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    // Group by date
    const dateMetrics = {};
    
    allReports.forEach(report => {
      if (!report.date && !report.submittedAt && !report.createdAt) return;
      
      const reportDate = report.date || report.submittedAt || report.createdAt;
      const dateStr = _isoDateIST(reportDate);
      
      if (!dateMetrics[dateStr]) {
        dateMetrics[dateStr] = {
          date: dateStr,
          teachers: new Set(),
          totalReports: 0,
          completedReports: 0,
          pendingReports: 0,
          completionValues: [],
          submittedReports: 0
        };
      }
      
      const metrics = dateMetrics[dateStr];
      metrics.totalReports++;
      metrics.teachers.add(report.teacherEmail);
      
      if (report.completionPercentage || report.completed) {
        metrics.submittedReports++;
        const completion = Number(report.completionPercentage || 0);
        metrics.completionValues.push(completion);
        if (completion >= 80) {
          metrics.completedReports++;
        }
      } else {
        metrics.pendingReports++;
      }
    });
    
    // Calculate metrics and sort by date
    const dailyMetrics = Object.values(dateMetrics)
      .map(metrics => {
        const avgCompletion = metrics.completionValues.length > 0
          ? Math.round(metrics.completionValues.reduce((a, b) => a + b, 0) / metrics.completionValues.length)
          : 0;
        
        const submissionRate = metrics.totalReports > 0
          ? Math.round(100 * metrics.submittedReports / metrics.totalReports)
          : 0;
        
        return {
          date: metrics.date,
          totalTeachers: metrics.teachers.size,
          totalReports: metrics.totalReports,
          submittedReports: metrics.submittedReports,
          completedReports: metrics.completedReports,
          pendingReports: metrics.pendingReports,
          avgCompletion: avgCompletion,
          submissionRate: submissionRate
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, daysBack);
    
    return {
      success: true,
      dailyMetrics: dailyMetrics,
      daysIncluded: dailyMetrics.length,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log(`ERROR in getDailySubmissionMetrics: ${error.message}`);
    return {
      success: false,
      error: error.message,
      dailyMetrics: []
    };
  }
}

/**
 * Get comprehensive HM analytics dashboard data
 * Returns: { success, teachers, classes, dailyTrends, systemHealth }
 */
function getHMAnalyticsDashboard() {
  try {
    // Fetch all analytics in parallel concept (sequential due to Apps Script limitations)
    const teachers = computeAllTeachersPerformanceFromRaw();
    const classes = getClassSubjectPerformance();
    const dailyTrends = getDailySubmissionMetrics(30);
    
    // Calculate system health
    const teacherPerfs = teachers.performances || [];
    const avgTeacherScore = teacherPerfs.length > 0
      ? Math.round(teacherPerfs.reduce((sum, t) => sum + t.qualityScore, 0) / teacherPerfs.length)
      : 0;
    
    const classMetrics = classes.classMetrics || [];
    const avgClassCompletion = classMetrics.length > 0
      ? Math.round(classMetrics.reduce((sum, c) => sum + c.avgCompletion, 0) / classMetrics.length)
      : 0;
    
    const systemHealth = {
      overallQualityScore: avgTeacherScore,
      systemCompletionRate: avgClassCompletion,
      totalTeachers: teacherPerfs.length,
      totalClasses: classMetrics.length,
      excellentTeachers: teacherPerfs.filter(t => t.performanceGrade === 'Excellent').length,
      atRiskTeachers: teacherPerfs.filter(t => t.performanceGrade === 'At Risk').length,
      highRiskClasses: classMetrics.filter(c => c.riskLevel === 'High').length
    };
    
    return {
      success: true,
      systemHealth: systemHealth,
      teachers: teachers,
      classes: classes,
      dailyTrends: dailyTrends,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log(`ERROR in getHMAnalyticsDashboard: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ====== SCHEME SUBMISSION HELPER API ======
 * Provides planning context for teachers when creating schemes
 * Returns: syllabus requirements, available periods, timeline, warnings
 */
function getSchemeSubmissionHelper(teacherEmail, className, subject, term) {
  try {
    Logger.log(`[SchemeHelper] Request: ${teacherEmail}, ${className}, ${subject}, ${term}`);
    
    // 1. Get Academic Calendar for the term
    const calendarData = _getCachedSheetData('AcademicCalendar');
    const termInfo = calendarData.data.find(row => 
      String(row.term || '').trim().toLowerCase() === term.toLowerCase()
    );
    
    if (!termInfo) {
      return {
        success: false,
        error: `Term "${term}" not found in Academic Calendar`
      };
    }
    
    // 2. Calculate term timeline
    const startDate = _coerceToDate(termInfo.startDate);
    const endDate = _coerceToDate(termInfo.endDate);
    const examStartDate = termInfo.examStartDate ? _coerceToDate(termInfo.examStartDate) : null;
    const today = new Date();
    
    const totalWeeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000));
    const teachingWeeks = examStartDate 
      ? Math.ceil((examStartDate - startDate) / (7 * 24 * 60 * 60 * 1000))
      : totalWeeks;
    const weeksElapsed = Math.max(0, Math.ceil((today - startDate) / (7 * 24 * 60 * 60 * 1000)));
    const weeksRemaining = Math.max(0, teachingWeeks - weeksElapsed);
    
    // 3. Get teacher's periods per week from Timetable
    const timetableData = _getCachedSheetData('Timetable');
    const teacherPeriods = timetableData.data.filter(row => 
      (row.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
      (row.class || '').trim() === className.trim() &&
      (row.subject || '').trim().toLowerCase() === subject.toLowerCase()
    );
    
    const periodsPerWeek = teacherPeriods.length;
    const totalPeriods = periodsPerWeek * teachingWeeks;
    const periodsRemaining = periodsPerWeek * weeksRemaining;
    
    // Parse event dates and names
    const eventDatesStr = (termInfo.eventDates || '').trim();
    const eventNamesStr = (termInfo.eventNames || '').trim();
    const eventDates = eventDatesStr ? eventDatesStr.split(',').map(d => d.trim()) : [];
    const eventNames = eventNamesStr ? eventNamesStr.split(',').map(n => n.trim()) : [];
    
    const events = [];
    for (let i = 0; i < Math.min(eventDates.length, eventNames.length); i++) {
      const eventDate = _coerceToDate(eventDates[i]);
      if (eventDate && eventDate > today) {
        const eventDayName = _dayNameIST(eventDate);
        // Check if this event affects teacher's subject periods
        const affectedPeriods = teacherPeriods.filter(p => 
          (p.dayOfWeek || '').toLowerCase() === eventDayName.toLowerCase()
        );
        if (affectedPeriods.length > 0) {
          events.push({
            date: _isoDateIST(eventDate),
            name: eventNames[i],
            periodsLost: affectedPeriods.length
          });
        }
      }
    }
    
    const totalPeriodsLost = events.reduce((sum, e) => sum + e.periodsLost, 0);
    const usablePeriods = totalPeriods - totalPeriodsLost - Math.ceil(totalPeriods * 0.05); // 5% buffer
    const usablePeriodsRemaining = periodsRemaining - totalPeriodsLost;
    
    // 4. Get Syllabus requirements
    const syllabusData = _getCachedSheetData('Syllabus');
    const syllabusChapters = syllabusData.data.filter(row => 
      (row.standard || '').trim() === className.trim() &&
      (row.subject || '').trim().toLowerCase() === subject.toLowerCase() &&
      String(row.term || '').trim().toLowerCase() === term.toLowerCase()
    );
    
    // Sort by sequence or chapterNo
    syllabusChapters.sort((a, b) => {
      const seqA = parseInt(a.sequence || a.chapterNo || 0);
      const seqB = parseInt(b.sequence || b.chapterNo || 0);
      return seqA - seqB;
    });
    
    const totalMinSessions = syllabusChapters.reduce((sum, ch) => 
      sum + parseInt(ch.minSessions || 0), 0
    );
    
    const chapterDetails = syllabusChapters.map(ch => ({
      chapterNo: ch.chapterNo || '',
      chapterName: ch.chapterName || '',
      minSessions: parseInt(ch.minSessions || 0),
      topics: ch.topics || ''
    }));
    
    // 5. Calculate feasibility
    const capacityUtilization = usablePeriods > 0 
      ? Math.round((totalMinSessions / usablePeriods) * 100) 
      : 0;
    
    let riskLevel = 'LOW';
    let recommendation = '';
    let isAchievable = true;
    
    if (capacityUtilization > 100) {
      riskLevel = 'HIGH';
      isAchievable = false;
      const shortfall = totalMinSessions - usablePeriods;
      recommendation = `⚠️ CRITICAL: Need ${shortfall} extra periods. Request additional classes or reduce chapter sessions.`;
    } else if (capacityUtilization > 90) {
      riskLevel = 'MEDIUM';
      recommendation = `⚠️ Tight schedule (${capacityUtilization}% utilization). Plan carefully with minimal buffer.`;
    } else if (capacityUtilization < 60) {
      riskLevel = 'LOW';
      recommendation = `✅ Comfortable pace (${capacityUtilization}% utilization). Consider adding revision sessions or slower pace for difficult chapters.`;
    } else {
      riskLevel = 'LOW';
      recommendation = `✅ Achievable schedule (${capacityUtilization}% utilization). Plan ${Math.ceil(totalMinSessions / syllabusChapters.length)} sessions per chapter on average.`;
    }
    
    // 6. Generate warnings
    const warnings = [];
    
    if (weeksElapsed > 0 && weeksElapsed / teachingWeeks > 0.2) {
      warnings.push(`⏰ Term is ${Math.round(weeksElapsed / teachingWeeks * 100)}% complete. Ensure timely planning.`);
    }
    
    if (events.length > 0) {
      warnings.push(`📅 ${events.length} upcoming event(s) will affect ${totalPeriodsLost} period(s).`);
    }
    
    if (periodsPerWeek === 0) {
      warnings.push(`❌ No periods found in timetable for ${className} ${subject}. Please update timetable first.`);
    }
    
    if (syllabusChapters.length === 0) {
      warnings.push(`❌ No syllabus data found for ${className} ${subject} ${term}. Please add syllabus entries.`);
    }
    
    // 7. Build response
    return {
      success: true,
      termInfo: {
        term: termInfo.term,
        startDate: _isoDateIST(startDate),
        endDate: _isoDateIST(endDate),
        examStartDate: examStartDate ? _isoDateIST(examStartDate) : null,
        totalWeeks: totalWeeks,
        teachingWeeks: teachingWeeks,
        weeksElapsed: weeksElapsed,
        weeksRemaining: weeksRemaining
      },
      timetableInfo: {
        periodsPerWeek: periodsPerWeek,
        totalPeriods: totalPeriods,
        periodsRemaining: periodsRemaining,
        eventsImpact: totalPeriodsLost,
        usablePeriods: usablePeriods,
        usablePeriodsRemaining: usablePeriodsRemaining,
        bufferPeriods: Math.ceil(totalPeriods * 0.05)
      },
      syllabusRequirement: {
        totalChapters: syllabusChapters.length,
        minSessionsRequired: totalMinSessions,
        avgSessionsPerChapter: syllabusChapters.length > 0 
          ? Math.round(totalMinSessions / syllabusChapters.length) 
          : 0,
        chapterDetails: chapterDetails
      },
      feasibility: {
        isAchievable: isAchievable,
        capacityUtilization: `${capacityUtilization}%`,
        riskLevel: riskLevel,
        recommendation: recommendation
      },
      upcomingEvents: events,
      warnings: warnings,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`ERROR in getSchemeSubmissionHelper: ${error.message}\n${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get syllabus pace tracking for HM dashboard
 * Compares Board Syllabus → Teacher Schemes → Actual Progress
 */
function getSyllabusPaceTracking(term = 'Term 2') {
  try {
    const syllabusData = _getCachedSheetData('Syllabus');
    const schemesData = _getCachedSheetData('Schemes');
    const lessonsData = _getCachedSheetData('LessonPlans');
    const reportsData = _getCachedSheetData('DailyReports');
    const calendarData = _getCachedSheetData('AcademicCalendar');
    
    // Get term info
    const termInfo = calendarData.data.find(row => 
      String(row.term || '').trim().toLowerCase() === term.toLowerCase()
    );
    
    if (!termInfo) {
      return {
        success: false,
        error: `Term "${term}" not found in Academic Calendar`
      };
    }
    
    const startDate = _coerceToDate(termInfo.startDate);
    const endDate = _coerceToDate(termInfo.endDate);
    const today = new Date();
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
    const progressPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
    
    // Group syllabus by class-subject
    const syllabusMap = {};
    syllabusData.data.forEach(row => {
      const rowTerm = String(row.term || '').trim();
      if (rowTerm.toLowerCase() !== term.toLowerCase()) return;
      
      const key = `${row.standard}|${row.subject}`;
      if (!syllabusMap[key]) {
        syllabusMap[key] = {
          class: row.standard,
          subject: row.subject,
          chapters: [],
          totalSessions: 0
        };
      }
      
      const minSessions = parseInt(row.minSessions || 0);
      syllabusMap[key].chapters.push({
        chapterNo: row.chapterNo,
        chapterName: row.chapterName,
        minSessions: minSessions
      });
      syllabusMap[key].totalSessions += minSessions;
    });
    
    // Calculate progress for each class-subject
    const progressTracking = [];
    
    for (const key in syllabusMap) {
      const syllabus = syllabusMap[key];
      const [className, subject] = key.split('|');
      
      // Get approved schemes
      const schemes = schemesData.data.filter(row => 
        (row.class || '').trim() === className.trim() &&
        (row.subject || '').trim().toLowerCase() === subject.toLowerCase() &&
        String(row.term || '').trim() === term &&
        (row.status || '').toLowerCase() === 'approved'
      );
      
      const plannedSessions = schemes.reduce((sum, s) => 
        sum + parseInt(s.sessions || 0), 0
      );
      
      // Get completed lessons
      const lessons = lessonsData.data.filter(row => 
        (row.class || '').trim() === className.trim() &&
        (row.subject || '').trim().toLowerCase() === subject.toLowerCase() &&
        String(row.term || '').trim() === term &&
        (row.status || '').toLowerCase() === 'approved'
      );
      
      const completedSessions = lessons.reduce((sum, l) => 
        sum + parseInt(l.sessions || 0), 0
      );
      
      // Count actual completed periods from daily reports
      const reports = reportsData.data.filter(row => 
        (row.class || '').trim() === className.trim() &&
        (row.subject || '').trim().toLowerCase() === subject.toLowerCase() &&
        (row.status || '').toLowerCase() === 'completed'
      );
      
      const actualCompleted = reports.length;
      
      // Calculate percentages
      const syllabusTarget = syllabus.totalSessions;
      const plannedPercent = syllabusTarget > 0 
        ? Math.round((plannedSessions / syllabusTarget) * 100) 
        : 0;
      const completedPercent = syllabusTarget > 0 
        ? Math.round((actualCompleted / syllabusTarget) * 100) 
        : 0;
      
      // Calculate expected progress based on time elapsed
      const expectedPercent = progressPercent;
      
      // Find teacher from timetable or schemes
      const usersData = _getCachedSheetData('Users');
      const timetableData = _getCachedSheetData('Timetable');
      
      let teacherName = 'Not Assigned';
      const teacherScheme = schemes[0];
      
      if (teacherScheme && teacherScheme.teacherEmail) {
        const teacherUser = usersData.data.find(u => 
          (u.email || '').toLowerCase() === teacherScheme.teacherEmail.toLowerCase()
        );
        teacherName = teacherUser ? teacherUser.name : teacherScheme.teacherEmail;
      } else {
        // Try to find from timetable
        const timetableEntry = timetableData.data.find(row =>
          (row.standard || '').trim() === className.trim() &&
          (row.subject || '').trim().toLowerCase() === subject.toLowerCase()
        );
        if (timetableEntry && timetableEntry.teacherEmail) {
          const teacherUser = usersData.data.find(u => 
            (u.email || '').toLowerCase() === timetableEntry.teacherEmail.toLowerCase()
          );
          teacherName = teacherUser ? teacherUser.name : timetableEntry.teacherEmail;
        }
      }
      
      // Calculate weeks
      const weeksElapsed = Math.floor(elapsedDays / 7);
      const totalWeeks = Math.floor(totalDays / 7);
      
      // Determine risk level and recommendations
      const behindBy = expectedPercent - completedPercent;
      let riskLevel = 'LOW';
      let recommendation = '';
      const warnings = [];
      
      if (schemes.length === 0) {
        riskLevel = 'HIGH';
        warnings.push('No scheme submitted yet for this subject');
        recommendation = 'Teacher needs to submit a scheme of work immediately';
      } else if (behindBy > 20) {
        riskLevel = 'HIGH';
        warnings.push(`Behind schedule by ${Math.round(behindBy)}%`);
        recommendation = 'Urgent intervention needed - consider extra classes or reduced scope';
      } else if (behindBy > 10) {
        riskLevel = 'MEDIUM';
        warnings.push(`Slightly behind schedule by ${Math.round(behindBy)}%`);
        recommendation = 'Monitor closely and encourage teacher to catch up';
      } else if (behindBy < -10) {
        riskLevel = 'LOW';
        recommendation = 'Ahead of schedule - excellent progress';
      } else {
        riskLevel = 'LOW';
        recommendation = 'On track - continue current pace';
      }
      
      // Calculate projected completion
      let projectedCompletion = 'N/A';
      if (actualCompleted > 0 && weeksElapsed > 0) {
        const weeklyRate = actualCompleted / weeksElapsed;
        const remainingSessions = syllabusTarget - actualCompleted;
        const weeksNeeded = Math.ceil(remainingSessions / weeklyRate);
        const projectedWeeks = weeksElapsed + weeksNeeded;
        if (projectedWeeks <= totalWeeks) {
          projectedCompletion = `Week ${projectedWeeks} of ${totalWeeks}`;
        } else {
          projectedCompletion = `Overdue (Week ${projectedWeeks})`;
          if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        }
      }
      
      progressTracking.push({
        className: className,
        subject: subject,
        teacher: teacherName,
        syllabusTotal: syllabusTarget,
        syllabusCompleted: Math.round((completedPercent / 100) * syllabus.chapters.length),
        syllabusProgress: Math.round((completedPercent / 100) * 100),
        schemeTotal: plannedSessions,
        schemeCompleted: completedSessions,
        schemeProgress: plannedPercent,
        actualTotal: syllabusTarget,
        actualCompleted: actualCompleted,
        actualProgress: completedPercent,
        weeksElapsed: weeksElapsed,
        totalWeeks: totalWeeks,
        expectedProgress: expectedPercent,
        behindBy: Math.max(0, behindBy),
        projectedCompletion: projectedCompletion,
        riskLevel: riskLevel,
        recommendation: recommendation,
        warnings: warnings
      });
    }
    
    // Sort by risk level (HIGH first)
    const riskOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    progressTracking.sort((a, b) => {
      const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return a.className.localeCompare(b.className);
    });
    
    // Calculate summary stats
    const summary = {
      totalSubjects: progressTracking.length,
      onTrack: progressTracking.filter(p => p.riskLevel === 'LOW').length,
      atRisk: progressTracking.filter(p => p.riskLevel === 'MEDIUM').length,
      critical: progressTracking.filter(p => p.riskLevel === 'HIGH').length
    };
    
    return {
      success: true,
      term: term,
      termProgress: {
        startDate: _isoDateIST(startDate),
        endDate: _isoDateIST(endDate),
        elapsedDays: elapsedDays,
        totalDays: totalDays,
        progressPercent: progressPercent
      },
      summary: summary,
      subjects: progressTracking,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`ERROR in getSyllabusPaceTracking: ${error.message}\n${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ====== CASCADE MANAGEMENT SYSTEM ======
 * Handles automatic rescheduling of lesson plans when sessions are marked 0% complete
 */

/**
 * Get cascade preview for a specific lesson plan marked as 0% complete
 */
function getCascadePreview(lpId, teacherEmail, originalDate) {
  try {
    Logger.log(`=== GET CASCADE PREVIEW ===`);
    Logger.log(`LP ID: ${lpId}, Teacher: ${teacherEmail}, Original Date: ${originalDate}`);
    
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const allPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders));
    
    const currentPlan = allPlans.find(p => p.lpId === lpId);
    if (!currentPlan) {
      return { success: false, error: 'Lesson plan not found' };
    }
    
    const { schemeId, chapter, session, class: className, subject } = currentPlan;
    const currentSession = parseInt(session) || 1;
    
    const relatedPlans = allPlans.filter(p => 
      p.schemeId === schemeId && 
      String(p.chapter).toLowerCase() === String(chapter).toLowerCase()
    );
    
    const totalSessions = Math.max(...relatedPlans.map(p => parseInt(p.session) || 0));
    
    const remainingSessions = [];
    for (let i = currentSession; i <= totalSessions; i++) {
      const sessionPlan = allPlans.find(p => {
        return p.schemeId === schemeId &&
               String(p.chapter).toLowerCase() === String(chapter).toLowerCase() &&
               parseInt(p.session) === i;
      });
      
      if (sessionPlan) {
        let normalizedDate = sessionPlan.selectedDate;
        if (sessionPlan.selectedDate instanceof Date) {
          normalizedDate = _isoDateIST(sessionPlan.selectedDate);
        } else if (typeof sessionPlan.selectedDate === 'string') {
          normalizedDate = sessionPlan.selectedDate.split('T')[0];
        }
        
        remainingSessions.push({
          lpId: sessionPlan.lpId,
          sessionNo: i,
          currentDate: normalizedDate,
          currentPeriod: sessionPlan.selectedPeriod,
          learningObjectives: sessionPlan.learningObjectives || '',
          teachingMethods: sessionPlan.teachingMethods || ''
        });
      }
    }
    
    if (remainingSessions.length === 0) {
      return {
        success: true,
        needsCascade: false,
        message: 'No sessions found to cascade'
      };
    }

    // Helper to get next working (Mon-Fri) day string from a YYYY-MM-DD
    function _nextWorkingDay(dateStr) {
      const parts = dateStr.split('-');
      let d = new Date(parts[0], parts[1] - 1, parts[2]);
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6); // Skip Sunday(0) & Saturday(6)
      return _isoDateIST(d);
    }

    // Build proposed cascade: shift every affected session forward by ONE working day
    // and roll content so teacher restarts from session 1 while choosing NEXT AVAILABLE period for class+subject
    // Prepare timetable for teacher filtered to matching class & subject
    const timetableSheet = _getSheet('Timetable');
    const ttHeaders = _headers(timetableSheet);
    const timetableRows = _rows(timetableSheet).map(r => _indexByHeader(r, ttHeaders));
    const teacherClassSubjectPeriods = timetableRows.filter(r => {
      return (r.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
             (r.class || '').toLowerCase() === String(className).toLowerCase() &&
             (r.subject || '').toLowerCase() === String(subject).toLowerCase();
    });

    // Occupied slots excluding the ones we are cascading (they will move)
    const remainingLpIds = new Set(remainingSessions.map(s => s.lpId));
    const occupiedSlots = allPlans.filter(p => {
      if (remainingLpIds.has(p.lpId)) return false; // treat as freed
      const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail.toLowerCase();
      const hasDate = p.selectedDate !== undefined && p.selectedDate !== '';
      const hasPeriod = p.selectedPeriod !== undefined && p.selectedPeriod !== '';
      const active = !['cancelled','rejected','completed early'].includes(String(p.status || '').trim().toLowerCase());
      return emailMatch && hasDate && hasPeriod && active;
    }).map(p => {
      let normalizedDate = p.selectedDate;
      if (p.selectedDate instanceof Date) normalizedDate = _isoDateIST(p.selectedDate);
      else if (typeof p.selectedDate === 'string') normalizedDate = p.selectedDate.split('T')[0];
      return normalizedDate + '|' + parseInt(String(p.selectedPeriod).trim(),10);
    });

    const usedNewSlots = new Set();
    function _findNextAvailablePeriod(startDateStr) {
      let dStr = startDateStr;
      let safety = 0;
      while (safety < 60) { // cap search to 60 working days
        const parts = dStr.split('-');
        const dObj = new Date(parts[0], parts[1]-1, parts[2]);
        const dayName = _dayNameIST(dStr);
        if (!(dayName === 'Saturday' || dayName === 'Sunday')) {
          // periods for that day
            const periodsToday = teacherClassSubjectPeriods.filter(p => _normalizeDayName(p.dayOfWeek || '') === _normalizeDayName(dayName));
            // sort by period number
            periodsToday.sort((a,b) => parseInt(a.period)-parseInt(b.period));
            for (const per of periodsToday) {
              const key = dStr + '|' + parseInt(String(per.period).trim(),10);
              if (!occupiedSlots.includes(key) && !usedNewSlots.has(key)) {
                usedNewSlots.add(key);
                const timing = _getPeriodTiming(per.period, dayName);
                return {
                  date: dStr,
                  period: per.period,
                  dayName: dayName,
                  startTime: timing.start,
                  endTime: timing.end
                };
              }
            }
        }
        // advance to next working day
        dStr = _nextWorkingDay(dStr);
        safety++;
      }
      return null; // not found
    }

    const proposedCascade = [];
    for (let idx = 0; idx < remainingSessions.length; idx++) {
      const sess = remainingSessions[idx];
      const newDateCandidate = _nextWorkingDay(sess.currentDate); // base forward one working day
      const slot = _findNextAvailablePeriod(newDateCandidate);
      // Preserve each session's own planned content instead of rolling back
      const sourceContent = sess;
      if (!slot) {
        // If we fail to find slot, mark cascade impossible
        return {
          success: true,
          needsCascade: true,
          canCascade: false,
          warning: 'Could not find available period for all sessions',
          sessionsResolved: proposedCascade.length,
          sessionsPending: remainingSessions.length - proposedCascade.length
        };
      }
      proposedCascade.push({
        lpId: sess.lpId,
        sessionNo: sess.sessionNo,
        originalDate: sess.currentDate,
        proposedDate: slot.date,
        originalPeriod: sess.currentPeriod,
        proposedPeriod: slot.period,
        learningObjectives: sourceContent.learningObjectives,
        teachingMethods: sourceContent.teachingMethods,
        dayName: slot.dayName,
        startTime: slot.startTime,
        endTime: slot.endTime
      });
    }

    return {
      success: true,
      needsCascade: true,
      canCascade: true,
      mode: 'forward-one-day-with-content-roll',
      chapter: chapter,
      totalSessionsAffected: proposedCascade.length,
      sessionsToReschedule: proposedCascade,
      summary: {
        earliestOriginalDate: proposedCascade[0].originalDate,
        earliestNewDate: proposedCascade[0].proposedDate,
        latestOriginalDate: proposedCascade[proposedCascade.length - 1].originalDate,
        latestNewDate: proposedCascade[proposedCascade.length - 1].proposedDate
      }
    };
    
  } catch (error) {
    Logger.log(`Error in getCascadePreview: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Execute cascade: Update lesson plan dates for all affected sessions
 */
function executeCascade(cascadeData) {
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(10000);
    
    Logger.log(`=== EXECUTE CASCADE ===`);
    const cascadeId = 'CASCADE_' + Date.now();
    Logger.log(`[executeCascade] id=${cascadeId} payload keys: ${Object.keys(cascadeData || {}).join(',')}`);
    
    const { sessionsToUpdate, sessionsToReschedule, mode } = cascadeData;
    // Support both naming from preview: sessionsToReschedule or legacy sessionsToUpdate
    const updates = Array.isArray(sessionsToReschedule) && sessionsToReschedule.length ? sessionsToReschedule : sessionsToUpdate;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return { success: false, error: 'No sessions to update' };
    }
    
    const lpSh = _getSheet('LessonPlans');
    // Ensure headers include originalDate/originalPeriod to preserve pre-cascade slot
    const baseHeaders = _headers(lpSh);
    try {
      const requiredHeaders = baseHeaders.slice();
      if (!requiredHeaders.includes('originalDate')) requiredHeaders.push('originalDate');
      if (!requiredHeaders.includes('originalPeriod')) requiredHeaders.push('originalPeriod');
      _ensureHeaders(lpSh, requiredHeaders);
    } catch (ensureErr) {
      Logger.log(`[executeCascade] Header ensure warning: ${ensureErr && ensureErr.message ? ensureErr.message : ensureErr}`);
    }
    const lpHeaders = _headers(lpSh);
    const allPlans = _rows(lpSh).map((row, index) => ({ 
      ..._indexByHeader(row, lpHeaders), 
      rowIndex: index + 2 
    }));
    
    const updatedPlans = [];
    const errors = [];
    
    // Pre-compute occupancy map for post-move validation
    const teacherEmailLower = updates[0] && updates[0].teacherEmail ? String(updates[0].teacherEmail).toLowerCase() : null;
    const skippedPlans = [];
    // Identify the ORIGINAL missed session (manual cascade may pass currentLpId)
    const originalLpId = cascadeData.currentLpId || cascadeData.originalLpId || (updates.length ? updates[0].lpId : null);
    updates.forEach(session => {
      try {
        const { lpId, proposedDate, proposedPeriod, learningObjectives, teachingMethods } = session;
        if (!lpId || !proposedDate || proposedPeriod === undefined || proposedPeriod === null) {
          skippedPlans.push({ lpId: lpId || 'UNKNOWN', reason: 'missing_fields' });
          Logger.log(`[executeCascade] SKIP ${lpId} missing fields`);
          return;
        }
        
        const planIndex = allPlans.findIndex(p => p.lpId === lpId);
        if (planIndex === -1) {
          errors.push(`Plan ${lpId} not found`);
          return;
        }
        
        const plan = allPlans[planIndex];
        const rowNum = plan.rowIndex;
        
        const dateCol = lpHeaders.indexOf('selectedDate') + 1;
        if (dateCol > 0) {
          // Before overwriting, persist originalDate if not already set
          const originalDateCol = lpHeaders.indexOf('originalDate') + 1;
          try {
            if (originalDateCol > 0) {
              const existingOriginalDate = plan.originalDate || '';
              if (!existingOriginalDate) {
                // Normalize selectedDate to ISO if it's a Date
                let priorDate = plan.selectedDate;
                if (priorDate instanceof Date) priorDate = _isoDateIST(priorDate);
                else if (typeof priorDate === 'string' && priorDate.indexOf('T') >= 0) priorDate = priorDate.split('T')[0];
                lpSh.getRange(rowNum, originalDateCol).setValue(priorDate || '');
              }
            }
          } catch (odErr) {
            Logger.log(`[executeCascade] originalDate persist warning for ${lpId}: ${odErr && odErr.message ? odErr.message : odErr}`);
          }
          lpSh.getRange(rowNum, dateCol).setValue(proposedDate);
        }
        
        const periodCol = lpHeaders.indexOf('selectedPeriod') + 1;
        if (periodCol > 0) {
          // Before overwriting, persist originalPeriod if not already set
          const originalPeriodCol = lpHeaders.indexOf('originalPeriod') + 1;
          try {
            if (originalPeriodCol > 0) {
              const existingOriginalPeriod = plan.originalPeriod || '';
              if (!existingOriginalPeriod) {
                lpSh.getRange(rowNum, originalPeriodCol).setValue(plan.selectedPeriod || '');
              }
            }
          } catch (opErr) {
            Logger.log(`[executeCascade] originalPeriod persist warning for ${lpId}: ${opErr && opErr.message ? opErr.message : opErr}`);
          }
          lpSh.getRange(rowNum, periodCol).setValue(parseInt(proposedPeriod));
        }
        
        if (learningObjectives) {
          const objCol = lpHeaders.indexOf('learningObjectives') + 1;
          if (objCol > 0) {
            lpSh.getRange(rowNum, objCol).setValue(learningObjectives);
          }
        }
        
        if (teachingMethods) {
          const methodsCol = lpHeaders.indexOf('teachingMethods') + 1;
          if (methodsCol > 0) {
            lpSh.getRange(rowNum, methodsCol).setValue(teachingMethods);
          }
        }

        // Mark ONLY the originally missed session with cascade status;
        // Others keep their existing status (date/period moved silently)
        try {
          if (lpId === originalLpId) {
            const statusCol = lpHeaders.indexOf('status') + 1;
            if (statusCol > 0) {
              const existingStatus = String(plan.status || '').trim().toLowerCase();
              if (!['cancelled','rejected'].includes(existingStatus)) {
                lpSh.getRange(rowNum, statusCol).setValue('Rescheduled (Cascade)');
              }
            }
          }
        } catch (statusErr) {
          Logger.log(`[executeCascade] Status update skipped for ${lpId}: ${statusErr.message}`);
        }
        
        updatedPlans.push({
          lpId: lpId,
          oldDate: plan.selectedDate,
          newDate: proposedDate,
          oldPeriod: plan.selectedPeriod,
          newPeriod: proposedPeriod,
          oldObjectives: plan.learningObjectives,
          newObjectives: learningObjectives,
          oldMethods: plan.teachingMethods,
          newMethods: teachingMethods,
          originalDate: plan.originalDate || plan.selectedDate,
          originalPeriod: plan.originalPeriod || plan.selectedPeriod
          , cascadeMarked: lpId === originalLpId
        });
        
        Logger.log(`✅ [${cascadeId}] Updated ${lpId}: ${plan.selectedDate} P${plan.selectedPeriod} → ${proposedDate} P${proposedPeriod}`);
        
      } catch (sessionError) {
        errors.push(`Error updating ${session.lpId}: ${sessionError.message}`);
      }
    });
    
    // Optional: update the daily report row to reflect cascade (plan moved)
    try {
      if (cascadeData.dailyReportContext) {
        const ctx = cascadeData.dailyReportContext;
        const drSh = _getSheet('DailyReports');
        const drHeaders = _headers(drSh);
        const drRows = _rows(drSh);
        const dateCol = drHeaders.indexOf('date') + 1;
        const emailCol = drHeaders.indexOf('teacherEmail') + 1;
        const classCol = drHeaders.indexOf('class') + 1;
        const subjectCol = drHeaders.indexOf('subject') + 1;
        const periodCol = drHeaders.indexOf('period') + 1;
        const planTypeCol = drHeaders.indexOf('planType') + 1;
        const lessonPlanIdCol = drHeaders.indexOf('lessonPlanId') + 1;
        const notesCol = drHeaders.indexOf('notes') + 1;
        if (dateCol && emailCol && classCol && subjectCol && periodCol && planTypeCol) {
          for (let i = 0; i < drRows.length; i++) {
            const r = drRows[i];
            // Normalize date in row (may be Date object)
            const rowDate = _isoDateIST(r[dateCol - 1]);
            if (
              rowDate === ctx.date &&
              String(r[emailCol - 1]).toLowerCase().trim() === String(ctx.teacherEmail).toLowerCase().trim() &&
              String(r[classCol - 1]).trim() === String(ctx.class).trim() &&
              String(r[subjectCol - 1]).trim() === String(ctx.subject).trim() &&
              Number(r[periodCol - 1]) === Number(ctx.period)
            ) {
              // Mark as cascaded: change planType and clear lessonPlanId (optional)
              drSh.getRange(i + 2, planTypeCol).setValue('cascaded');
              if (lessonPlanIdCol) {
                drSh.getRange(i + 2, lessonPlanIdCol).setValue('');
              }
              if (notesCol) {
                const existingNotes = String(r[notesCol - 1] || '').trim();
                const appendNote = `Cascade: plan moved to new dates (${updates.length} sessions rescheduled)`;
                drSh.getRange(i + 2, notesCol).setValue(existingNotes ? (existingNotes + ' | ' + appendNote) : appendNote);
              }
              Logger.log(`DailyReport row updated for cascade (row ${i + 2})`);
              break;
            }
          }
        }
      }
    } catch (drErr) {
      Logger.log(`Warning: failed to update DailyReports for cascade context: ${drErr.message}`);
    }

    SpreadsheetApp.flush();
    
    return {
      success: true,
      mode: mode || 'forward-one-day-with-content-roll',
      updatedCount: updatedPlans.length,
      updatedPlans: updatedPlans,
      errors: errors.length > 0 ? errors : null,
      skippedPlans: skippedPlans.length ? skippedPlans : null,
      cascadeId: cascadeId,
      dailyReportUpdated: !!cascadeData.dailyReportContext,
      statusApplied: 'Rescheduled (Cascade)'
    };
    
  } catch (error) {
    Logger.log(`Error in executeCascade: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Read Settings to determine if auto-cascade is enabled.
 * Settings sheet row: key = 'cascade_auto_enabled', value in {true/false/yes/no/on/off/1/0}
 * Defaults to TRUE (enabled) if missing or on error so existing behaviour continues.
 */
function _isAutoCascadeEnabled() {
  try {
    const settingsSheet = _getSheet('Settings');
    const headers = _headers(settingsSheet);
    const rows = _rows(settingsSheet).map(r => _indexByHeader(r, headers));
    const flagRow = rows.find(r => String(r.key || '').toLowerCase().trim() === 'cascade_auto_enabled');
    if (!flagRow || flagRow.value === undefined || flagRow.value === '') {
      Logger.log('[autoCascadeFlag] Missing flag row – default ENABLED');
      return true;
    }
    const raw = String(flagRow.value).toLowerCase().trim();
    const enabled = ['1','true','yes','on','enabled'].includes(raw);
    Logger.log(`[autoCascadeFlag] Raw="${raw}" → enabled=${enabled}`);
    return enabled;
  } catch (err) {
    Logger.log(`[autoCascadeFlag] Error reading flag: ${err.message} – default ENABLED`);
    return true;
  }
}

/**
 * Diagnose LessonPlans headers and status column detection.
 * Returns headers, trimmedHeaders, detectedStatusIndex (0-based), sample first 3 row statuses.
 */
function _handleDiagnoseLessonPlanHeaders() {
  try {
    var sh = _getSheet('LessonPlans');
    var headers = _headers(sh);
    var trimmed = headers.map(function(h){ return String(h).trim(); });
    var statusIdx = trimmed.findIndex(function(h){ return h === 'status'; });
    if (statusIdx === -1) statusIdx = trimmed.findIndex(function(h){ return h.toLowerCase() === 'status'; });
    var rows = _rows(sh).slice(0,3); // sample only first 3
    var statuses = [];
    if (statusIdx !== -1) {
      for (var i=0;i<rows.length;i++) {
        statuses.push(rows[i][statusIdx]);
      }
    }
    return {
      success: true,
      headers: headers,
      trimmedHeaders: trimmed,
      detectedStatusIndex: statusIdx,
      sampleStatuses: statuses,
      suggestion: statusIdx === -1 ? 'Rename the status column header cell to "status" (lowercase) or "Status".' : 'Status column detected correctly.'
    };
  } catch (e) {
    return { success:false, error: e && e.message ? e.message : String(e) };
  }
}