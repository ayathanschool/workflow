/**
 * ============================================================
 * GET Route Handlers  (Router_GET.gs)
 * ============================================================
 * Each _routeGet*_ function handles one domain of GET actions.
 * Returns a ContentService response if the action is handled,
 * or null to let the next handler try.
 *
 * doGet() in Main.gs is the thin dispatcher that chains these.
 * ============================================================
 */

// ─── Pre-authentication (no auth gate) ────────────────────────────────────────
  function _routeGetPreAuth_(action, e) {
    // VERSION CHECK ENDPOINT - helps verify what code is deployed
    if (action === 'version') {
      return _respond({
        success: true,
        version: '86',
        deployed: '2026-02-08T04:30:00+05:30',
        cacheVersion: 'v2026-02-08-extended-sessions-in-ui',
        optimizations: ['TextFinder', 'sparse-sessions', 'indexed-lookups', 'precomputed-completion', 'sequential-gating', 'reduced-gating-calls', 'schemeId-in-dailyreports', 'extended-session-validation-bypass', 'extended-sessions-in-response']
      });
    }

    return null;
  }

// ─── System: bootstrap, ping, date check, cache debug, auth.verify ────────────
  function _routeGetSystem_(action, e) {
    if (action === 'admin.bootstrap') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      _bootstrapSheets();
      return _respond({ success: true, message: 'Bootstrap completed' });
    }

    // === AUTH: Google ID token verification via GET (avoids preflight) ===
    if (action === 'auth.verify') {
      var token = (e.parameter.token || e.parameter.id_token || e.parameter.idToken || '').trim();
      if (!token) {
        return _respond({ success: false, error: 'Missing token' });
      }
      return _respond(verifyGoogleLogin(token));
    }

    if (action === 'ping') {
      return _respond({ ok: true, now: new Date().toISOString() });
    }

    if (action === 'checkDate') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      const now = new Date();
      const todayISO = _todayISO();
      const dayName = _dayName(todayISO);
      return _respond({
        serverTimeUTC: now.toISOString(),
        serverTimeIST: Utilities.formatDate(now, _tz_(), 'yyyy-MM-dd HH:mm:ss EEEE'),
        todayISO: todayISO,
        todayDayName: dayName,
        timezone: _tz_(),
        test: {
          input: '2025-11-24',
          parsed: _dayName('2025-11-24')
        }
      });
    }

    if (action === 'debugCache') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      try {
        const cache = CacheService.getScriptCache();
        const keysJson = cache.get('_cache_keys') || '[]';
        const keys = JSON.parse(keysJson);
        return _respond({
          success: true,
          totalKeys: keys.length,
          keys: keys.slice(0, 20), // First 20 keys
          message: 'Cache is working. Keys are being tracked.'
        });
      } catch (err) {
        return _respond({
          success: false,
          error: err.message,
          message: 'Cache system error'
        });
      }
    }

    return null;
  }

// ─── Authentication: login, googleLogin ──────────────────────────────────────
  function _routeGetAuth_(action, e) {
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

    return null;
  }

// ─── Timetable ────────────────────────────────────────────────────────────────
  function _routeGetTimetable_(action, e) {
    if (action === 'getTeacherWeeklyTimetable') {
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      return _respond(getTeacherWeeklyTimetable(identifier));
    }

    if (action === 'getTeacherDailyTimetable') {
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      const date = (e.parameter.date || _todayISO()).trim();
      try { appLog('DEBUG', '[MainApp] getTeacherDailyTimetable', { identifier: identifier, date: date }); } catch (e) {}
      const result = getTeacherDailyTimetable(identifier, date);
      try { appLog('DEBUG', '[MainApp] getTeacherDailyTimetable result', { periods: (result && result.periods) ? result.periods.length : (Array.isArray(result) ? result.length : null) }); } catch (e) {}
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

    return null;
  }

// ─── Substitutions ────────────────────────────────────────────────────────────
  function _routeGetSubstitutions_(action, e) {
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
      const startDate = (e.parameter.startDate || '').trim();
      const endDate = (e.parameter.endDate || '').trim();
      return _respond(getTeacherSubstitutionsRange(email, startDate, endDate));
    }

    if (action === 'getSubstitutionsRange') {
      // HM / Admin only
      const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(requesterEmail)) {
        return _respond({ success: false, error: 'Permission denied. HM or Admin access required.' });
      }
      const startDate = (e.parameter.startDate || '').trim();
      const endDate = (e.parameter.endDate || '').trim();
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = (e.parameter.class || '').trim();
      return _respond(getSubstitutionsRange(startDate, endDate, teacherEmail, cls));
    }

    if (action === 'getAllSubstitutions') {
      // HM / Admin only (debug)
      const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(requesterEmail)) {
        return _respond({ success: false, error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getAllSubstitutions());
    }

    if (action === 'getSubstitutionEffectiveness') {
      // Teacher can access their own analytics; HM/Admin can access any.
      const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();

      const isAdmin = _isHMOrAdminSafe(requesterEmail);
      // If teacherEmail is omitted, treat as self scope for teachers.
      const isSelfOrImplicitSelf = requesterEmail && (!teacherEmail || requesterEmail === teacherEmail);

      if (!isAdmin && !isSelfOrImplicitSelf) {
        return _respond({ success: false, error: 'Permission denied. HM/Admin or self access required.' });
      }

      // Teachers must scope to themselves; HM/Admin can query any teacher or all.
      const effectiveTeacherEmail = isAdmin ? teacherEmail : requesterEmail;
      const startDate = (e.parameter.startDate || '').trim();
      const endDate = (e.parameter.endDate || '').trim();
      const cls = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const chapter = (e.parameter.chapter || '').trim();
      const includeDetails = (e.parameter.includeDetails || '').trim();

      return _respond(getSubstitutionEffectiveness({
        startDate,
        endDate,
        teacherEmail: effectiveTeacherEmail,
        class: cls,
        subject,
        chapter,
        includeDetails
      }));
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

    // TODO: move to POST later — kept for browser back-compat, do not remove until frontend is updated
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

    return null;
  }

// ─── Period Exchange ──────────────────────────────────────────────────────────
  function _routeGetPeriodExchange_(action, e) {
    // TODO: move to POST later — kept for browser back-compat, do not remove until frontend is updated
    if (action === 'createPeriodExchange') {
      const exchangeData = {
        date: e.parameter.date || '',
        teacher1Email: e.parameter.teacher1Email || '',
        teacher1Name: e.parameter.teacher1Name || '',
        period1: e.parameter.period1 || '',
        class1: e.parameter.class1 || '',
        subject1: e.parameter.subject1 || '',
        teacher2Email: e.parameter.teacher2Email || '',
        teacher2Name: e.parameter.teacher2Name || '',
        period2: e.parameter.period2 || '',
        class2: e.parameter.class2 || '',
        subject2: e.parameter.subject2 || '',
        note: e.parameter.note || '',
        createdBy: e.parameter.createdBy || ''
      };
      return _respond(createPeriodExchange(exchangeData));
    }

    if (action === 'getPeriodExchangesForDate') {
      const date = e.parameter.date || '';
      return _respond(getPeriodExchangesForDate(date));
    }

    // TODO: move to POST later — kept for browser back-compat, do not remove until frontend is updated
    if (action === 'deletePeriodExchange') {
      const exchangeData = {
        date: e.parameter.date || '',
        teacher1Email: e.parameter.teacher1Email || '',
        teacher2Email: e.parameter.teacher2Email || '',
        period1: e.parameter.period1 || '',
        period2: e.parameter.period2 || ''
      };
      return _respond(deletePeriodExchange(exchangeData));
    }

    return null;
  }

// ─── Exams ────────────────────────────────────────────────────────────────────
  function _routeGetExams_(action, e) {
    if (action === 'getExams') {
      const key = generateCacheKey('getExams', e.parameter);
      const dataOut = getCachedData(key, function() { return getExams(e.parameter); }, CACHE_TTL.MEDIUM);
      return _respond(dataOut);
    }

    if (action === 'debugExamsSheet') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      // Debug endpoint to check Exams sheet state
      try {
        const sh = _getSheet('Exams');
        const headers = _headers(sh);
        const rows = _rows(sh);
        return _respond({
          sheetExists: true,
          sheetName: sh.getName(),
          lastRow: sh.getLastRow(),
          lastColumn: sh.getLastColumn(),
          headers: headers,
          rowCount: rows.length,
          sampleData: rows.slice(0, 3) // First 3 rows
        });
      } catch (err) {
        return _respond({ error: err.message, stack: err.stack });
      }
    }

    if (action === 'warmCache') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      // Warm up caches to improve initial load performance
      try {
        appLog('INFO', 'warmCache', 'Starting cache warming');
        // Pre-load frequently accessed data
        getFullTimetable();
        getExams({});
        appLog('INFO', 'warmCache', 'Cache warming complete');
        return _respond({ success: true, message: 'Cache warmed successfully' });
      } catch (err) {
        return _respond({ error: err.message });
      }
    }

    if (action === 'clearCache') {
      // Admin only
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(clearAllCache());
    }

    if (action === 'getExamMarks') {
      const examId = e.parameter.examId || '';
      return _respond(getExamMarks(examId));
    }

    if (action === 'getExamMarksEntryStatusBatch') {
      const raw = String(e.parameter.examIds || '');
      const examIds = raw
        .split(',')
        .map(s => String(s || '').trim())
        .filter(s => s.length > 0);
      // Cache for 2 minutes (marks status changes frequently)
      const key = generateCacheKey('examMarksStatusBatch', { ids: examIds.sort().join(',') });
      const dataOut = getCachedData(key, function() { return getExamMarksEntryStatusBatch(examIds); }, CACHE_TTL.SHORT);
      return _respond(dataOut);
    }

    if (action === 'getExamMarksEntryStatusAll') {
      const cls = e.parameter.class || '';
      const examType = e.parameter.examType || '';
      const subject = e.parameter.subject || '';
      const limit = e.parameter.limit || '';
      const teacherEmail = e.parameter.teacherEmail || '';
      const role = e.parameter.role || '';
      // Cache for 2 minutes
      const key = generateCacheKey('examMarksStatusAll', { class: cls, examType: examType, subject: subject, teacherEmail: teacherEmail, role: role });
      const dataOut = getCachedData(key, function() {
        return getExamMarksEntryStatusAll({ class: cls, examType: examType, subject: subject, limit: limit, teacherEmail: teacherEmail, role: role });
      }, CACHE_TTL.SHORT);
      return _respond(dataOut);
    }

    if (action === 'getExamMarksEntryPending') {
      const cls = e.parameter.class || '';
      const examType = e.parameter.examType || '';
      const subject = e.parameter.subject || '';
      const limit = e.parameter.limit || '';
      const teacherEmail = e.parameter.teacherEmail || '';
      const role = e.parameter.role || '';
      // Cache for 2 minutes
      const key = generateCacheKey('examMarksPending', { class: cls, examType: examType, subject: subject, teacherEmail: teacherEmail, role: role });
      const dataOut = getCachedData(key, function() {
        return getExamMarksEntryPending({ class: cls, examType: examType, subject: subject, limit: limit, teacherEmail: teacherEmail, role: role });
      }, CACHE_TTL.SHORT);
      return _respond(dataOut);
    }

    if (action === 'getGradeTypes') {
      return _respond(getGradeTypes());
    }

    if (action === 'getClassSubjects') {
      return _respond(getClassSubjects(e.parameter.class));
    }

    // DEBUG: Test endpoint for ClassSubjects
    if (action === 'testGetClassSubjects') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(testGetClassSubjectsAPI());
    }

    if (action === 'getGradeBoundaries') {
      return _respond(getGradeBoundaries());
    }

    return null;
  }

// ─── Students ─────────────────────────────────────────────────────────────────
  function _routeGetStudents_(action, e) {
    if (action === 'getStudents') {
      const cls = e.parameter.class || '';
      return _respond(getStudents(cls));
    }

    if (action === 'getStudentsBatch') {
      // PERFORMANCE: Batch fetch students for multiple classes
      const classesParam = e.parameter.classes || '';
      const classes = classesParam.split(',').map(c => c.trim()).filter(Boolean);
      const cacheKey = generateCacheKey('students_batch_v1', { classes: classes.slice().sort().join(',') });
      const dataOut = getCachedData(cacheKey, function() { return getStudentsBatch(classes); }, CACHE_TTL.LONG);
      return _respond(dataOut);
    }

    if (action === 'getStudentReportCard') {
      const examType = e.parameter.examType || '';
      const admNo = e.parameter.admNo || '';
      const cls = e.parameter.class || '';
      return _respond(getStudentReportCard(examType, admNo, cls));
    }

    // === CLASS TEACHER PERFORMANCE: Batch report cards for class ===
    if (action === 'getReportCardsBatch') {
      const cls = String(e.parameter.class || '').trim();
      const raw = String(e.parameter.examTypes || '');
      const examTypes = raw.split(',').map(s => s.trim()).filter(Boolean);

      if (!cls) return _respond({ ok: false, error: 'missing_class' });
      if (examTypes.length === 0) return _respond({ ok: false, error: 'missing_examTypes' });

      // Optional: cache for speed (10 minutes)
      const cache = CacheService.getScriptCache();
      const cacheKey = `rc_batch_v1:${cls}:${examTypes.join('|')}`;
      const cached = cache.get(cacheKey);
      if (cached) return _respond(JSON.parse(cached));

      const out = {};
      for (var i = 0; i < examTypes.length; i++) {
        const examType = examTypes[i];
        // IMPORTANT: pass admNo as '' to fetch whole class in one go
        out[examType] = getStudentReportCard(examType, '', cls);
      }

      const payload = { ok: true, class: cls, examTypes: examTypes, data: out };
      try { cache.put(cacheKey, JSON.stringify(payload), 600); } catch (ee) {}
      return _respond(payload);
    }

    return null;
  }

// ─── Fee Collection ───────────────────────────────────────────────────────────
  function _routeGetFees_(action, e) {
    if (action === 'feeheads') {
      const className = e.parameter.class || '';
      return _respond({ ok: true, data: getFeeHeads(className) });
    }

    if (action === 'transactions') {
      const filters = {
        admNo: e.parameter.admNo || '',
        className: e.parameter.class || '',
        feeHead: e.parameter.feeHead || '',
        fromDate: e.parameter.fromDate || '',
        toDate: e.parameter.toDate || ''
      };
      return _respond({ ok: true, data: getTransactions(filters) });
    }

    if (action === 'studentFeeStatus') {
      const admNo = e.parameter.admNo || '';
      if (!admNo) return _respond({ ok: false, error: 'missing_admission_number' });
      try {
        const result = getStudentFeeStatus(admNo);
        return _respond({ ok: true, ...result });
      } catch (err) {
        return _respond({ ok: false, error: String(err) });
      }
    }

    if (action === 'feeDefaulters') {
      const className = e.parameter.class || '';
      return _respond({ ok: true, data: getFeeDefaulters(className) });
    }

    return null;
  }

// ─── Fund Collection & Expense Management ────────────────────────────────────
  function _routeGetFunds_(action, e) {
    if (action === 'getStudentsForClass') {
      const className = e.parameter.class || '';
      return _respond(getStudentsForClass(className));
    }

    if (action === 'getTeacherFundRequests') {
      const email = e.parameter.email || '';
      return _respond(getTeacherFundRequests(email));
    }

    if (action === 'getAllFundRequests') {
      const email = e.parameter.email || '';
      return _respond(getAllFundRequests(email));
    }

    if (action === 'getFundDeposits') {
      const requestId = e.parameter.requestId || '';
      return _respond(getFundDeposits(requestId));
    }

    if (action === 'getStudentPayments') {
      const requestId = e.parameter.requestId || '';
      return _respond(getStudentPayments(requestId));
    }

    if (action === 'getTeacherExpenseRequests') {
      const email = e.parameter.email || '';
      return _respond(getTeacherExpenseRequests(email));
    }

    if (action === 'getAllExpenseRequests') {
      const email = e.parameter.email || '';
      return _respond(getAllExpenseRequests(email));
    }

    if (action === 'getExpenseCategories') {
      return _respond(getExpenseCategories());
    }

    if (action === 'getExpenseSummary') {
      const startDate = e.parameter.startDate || '';
      const endDate = e.parameter.endDate || '';
      const category = e.parameter.category || '';
      return _respond(getExpenseSummary(startDate, endDate, category));
    }

    if (action === 'getAdminFinancialDashboard') {
      return _respond(getAdminFinancialDashboard());
    }

    if (action === 'getAccountsFinancialDashboard') {
      return _respond(getAccountsFinancialDashboard());
    }

    if (action === 'getTeacherFinancialDashboard') {
      const email = e.parameter.email || '';
      return _respond(getTeacherFinancialDashboard(email));
    }

    if (action === 'getFinancialReport') {
      const startDate = e.parameter.startDate || '';
      const endDate = e.parameter.endDate || '';
      return _respond(getFinancialReport(startDate, endDate));
    }

    if (action === 'getPendingFinancialCount') {
      const email = e.parameter.email || '';
      return _respond(getPendingFinancialCount(email));
    }

    return null;
  }

// ─── HM Dashboard ─────────────────────────────────────────────────────────────
  function _routeGetHMDashboard_(action, e) {
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

    return null;
  }

// ─── Scheme Management ────────────────────────────────────────────────────────
  function _routeGetSchemes_(action, e) {
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

    // Grouped lesson plan views for HM approvals
    if (action === 'getLessonPlansByChapter') {
      return _handleGetLessonPlansByChapter(e.parameter);
    }

    if (action === 'getLessonPlansByClass') {
      return _handleGetLessonPlansByClass(e.parameter);
    }

    if (action === 'getAllPlans') {
      return _handleGetAllSchemes(e.parameter);
    }

    if (action === 'getAllSchemes') {
      return _handleGetAllSchemes(e.parameter);
    }

    return null;
  }

// ─── Scheme-Based Lesson Planning, Sessions, Daily Reports (GET) ──────────────
  function _routeGetLessonPlanning_(action, e) {
    if (action === 'getApprovedSchemesForLessonPlanning') {
      return _handleGetApprovedSchemesForLessonPlanning(e.parameter);
    }

    // NEW: Lazy load scheme details on demand
    if (action === 'getSchemeDetails') {
      return _handleGetSchemeDetails(e.parameter);
    }

    if (action === 'getAvailablePeriodsForLessonPlan') {
      return _handleGetAvailablePeriodsForLessonPlan(e.parameter);
    }

    // Convenience: earliest free day/period for class+subject
    if (action === 'getNextAvailablePeriod') {
      return _handleGetNextAvailablePeriod(e.parameter);
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

    if (action === 'getFirstUnreportedSession') {
      const teacherEmail = e.parameter.teacherEmail || '';
      const classVal = e.parameter.class || '';
      const subject = e.parameter.subject || '';
      const chapter = e.parameter.chapter || '';
      const totalSessions = Number(e.parameter.totalSessions || 0);
      const schemeId = e.parameter.schemeId || '';
      const firstUnreported = getFirstUnreportedSession(teacherEmail, classVal, subject, chapter, totalSessions, schemeId);
      return _respond({ success: true, session: firstUnreported, firstUnreportedSession: firstUnreported });
    }

    // NEW: Batch endpoint for teacher timetable with reports (reduces 2 calls to 1)
    if (action === 'getTeacherDailyData') {
      return _handleGetTeacherDailyData(e.parameter);
    }

    // NEW: Unified teacher dashboard data (missing reports + live period + today's plans)
    if (action === 'getTeacherDashboardData') {
      return _handleGetTeacherDashboardData(e.parameter);
    }

    // Teacher helper: suggest Ready lesson plans for substitution periods (optional attach)
    if (action === 'getSuggestedPlansForSubstitution') {
      return _handleGetSuggestedPlansForSubstitution(e.parameter);
    }

    // === SESSION COMPLETION TRACKING GET ROUTES ===
    // TeacherPerformance dashboard removed
    if (action === 'getSchemeCompletionAnalytics') {
      return _handleGetSchemeCompletionAnalytics(e.parameter);
    }

    if (action === 'getSessionCompletionHistory') {
      return _handleGetSessionCompletionHistory(e.parameter);
    }

    // === DAILY REPORT ROUTES ===
    if (action === 'getTeacherDailyReportsForDate') {
      // This handler already caches and returns a JSON TextOutput via _respond().
      // Do NOT wrap again here, otherwise the cache stores a TextOutput and the response becomes double-wrapped.
      return _handleGetTeacherDailyReportsForDate(e.parameter);
    }

    if (action === 'checkCascadingIssues') {
      return _handleCheckCascadingIssues(e.parameter);
    }

    return null;
  }

// ─── HM Oversight, Monitoring, Settings, Notifications ───────────────────────
  function _routeGetHMOversight_(action, e) {
    // === HM DAILY OVERSIGHT ROUTES ===
    if (action === 'getDailyReportsForDate') {
      return _handleGetDailyReportsForDate(e.parameter);
    }

    if (action === 'getLessonPlansForDate') {
      return _handleGetLessonPlansForDate(e.parameter);
    }

    if (action === 'getMissingSubmissions') {
      return _handleGetMissingSubmissions(e.parameter);
    }

    // HM/SuperAdmin: teacherwise missing daily reports view
    if (action === 'getMissingSubmissionsTeacherwise') {
      return _handleGetMissingSubmissionsTeacherwise(e.parameter);
    }

    // HM/SuperAdmin/Admin: teacherwise missing daily reports for a date range
    if (action === 'getMissingSubmissionsTeacherwiseRange') {
      return _handleGetMissingSubmissionsTeacherwiseRange(e.parameter);
    }

    // Daily readiness summary for HM (GET-friendly)
    if (action === 'getDailyReadinessStatus') {
      const date = (e.parameter.date || _todayISO()).trim();
      return _respond(getDailyReadinessStatus(date));
    }

    // === MISSING LESSON PLAN NOTIFICATIONS ===
    if (action === 'getMissingLessonPlans') {
      const teacherEmail = e.parameter.teacherEmail || '';
      const daysAhead = parseInt(e.parameter.daysAhead || 7);
      const key = generateCacheKey('getMissingLessonPlans', { teacherEmail: String(teacherEmail).toLowerCase().trim(), daysAhead: daysAhead });
      const dataOut = getCachedData(key, function() { return getMissingLessonPlans(teacherEmail, daysAhead); }, CACHE_TTL.SHORT);
      return _respond(dataOut);
    }

    if (action === 'getAllMissingLessonPlans') {
      const daysAhead = parseInt(e.parameter.daysAhead || 7);
      const key = generateCacheKey('getAllMissingLessonPlans', { daysAhead: daysAhead });
      const dataOut = getCachedData(key, function() { return getAllMissingLessonPlans(daysAhead); }, CACHE_TTL.SHORT);
      return _respond(dataOut);
    }

    // HM merged Plan vs Actual for a date (timetable + plans + reports)
    if (action === 'getHMDailyOversightData') {
      return _respond(_handleGetHMDailyOversightData(e.parameter));
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

    return null;
  }

// ─── Debug & Misc ─────────────────────────────────────────────────────────────
  function _routeGetDebug_(action, e) {
    // DEBUG: Get execution logs
    if (action === 'debug.logs') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      try {
        const logs = Logger.getLog();
        return _respond({ success: true, logs: logs });
      } catch (err) {
        return _respond({ success: false, error: String(err) });
      }
    }

    // BACKFILL: Populate schemeId for existing DailyReports
    if (action === 'admin.backfillSchemeIds') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      try {
        const result = backfillDailyReportSchemeIds();
        return _respond({ success: true, ...result });
      } catch (err) {
        return _respond({ success: false, error: String(err), stack: err.stack });
      }
    }

    // === DEBUG ROUTES ===
    if (action === 'debugSubstitutions') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
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

    // Lightweight storage diagnostics to verify bound spreadsheet and sheet status
    if (action === 'diagnoseStorage') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      try {
        const ss = _ss();
        const schemesSh = _getSheet('Schemes');
        const schemesHeaders = _headers(schemesSh);
        const response = {
          spreadsheetId: SPREADSHEET_ID,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
          spreadsheetName: ss.getName(),
          availableSheets: ss.getSheets().map(s => s.getName()),
          schemes: {
            headers: schemesHeaders,
            lastRow: schemesSh.getLastRow(),
            lastColumn: schemesSh.getLastColumn()
          },
          serverTimeIST: Utilities.formatDate(new Date(), _tz_(), 'yyyy-MM-dd HH:mm:ss')
        };
        return _respond(response);
      } catch (diagErr) {
        return _respond({ error: diagErr && diagErr.message ? diagErr.message : String(diagErr) });
      }
    }

    if (action === 'debugSubstitutionsForDate') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
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
      const chapter = e.parameter.chapter || '';
      const date = e.parameter.date || '';
      const fromDate = e.parameter.fromDate || '';
      const toDate = e.parameter.toDate || '';
      return _respond(getDailyReports(teacher, fromDate || date, toDate || date, cls, subject, chapter));
    }

    // Chapter completion (read-only via GET)
    if (action === 'checkChapterCompletion') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = e.parameter.class || '';
      const subject = e.parameter.subject || '';
      const chapter = e.parameter.chapter || '';
      const schemeId = e.parameter.schemeId || '';
      const date = e.parameter.date || '';
      return _respond(checkChapterCompletion({ teacherEmail: teacherEmail, class: cls, subject: subject, chapter: chapter, schemeId: schemeId, date: date }));
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

    // === USER MANAGEMENT ROUTES ===
    if (action === 'getAllUsers') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(email)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getAllUsers());
    }

    return null;
  }

// ─── Primary GET Dispatcher ────────────────────────────────────────────────────
function routeGet(action, e) {
  const _pre = _routeGetPreAuth_(action, e);
  if (_pre) return _pre;

  const authResp = _ensureAuthenticatedOrRespond_(e, null, action);
  if (authResp) return authResp;

  return _routeGetSystem_(action, e)
      || _routeGetAuth_(action, e)
      || _routeGetTimetable_(action, e)
      || _routeGetSubstitutions_(action, e)
      || _routeGetPeriodExchange_(action, e)
      || _routeGetExams_(action, e)
      || _routeGetStudents_(action, e)
      || _routeGetFees_(action, e)
      || _routeGetFunds_(action, e)
      || _routeGetHMDashboard_(action, e)
      || _routeGetSchemes_(action, e)
      || _routeGetLessonPlanning_(action, e)
      || _routeGetHMOversight_(action, e)
      || _routeGetDebug_(action, e)
      || _respond({ error: 'Unknown action: ' + action });
}
