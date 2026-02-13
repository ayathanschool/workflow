  /**
  * ====== TIME / DATE HELPERS (IST SAFE) ======
  * These helpers ensure consistent date handling across all functions.
  * All dates are normalized to IST "YYYY-MM-DD" format for reliable comparisons.
  */
  function _tz_() {
    return 'Asia/Kolkata';
  }

  // Request-scoped auth context (set per request when auth is required)
  var REQUEST_AUTH_CTX = null;

  function _getScriptProp_(key) {
    try {
      return String(PropertiesService.getScriptProperties().getProperty(key) || '');
    } catch (_e) {
      return '';
    }
  }

  function _isTruthy_(val) {
    var v = String(val || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on';
  }

  function _isProductionAuthEnabled_() {
    return _isTruthy_(_getScriptProp_('AUTH_REQUIRED')) || _isTruthy_(_getScriptProp_('PRODUCTION_MODE'));
  }

  function _actionIsPublic_(action) {
    var a = String(action || '').trim();
    if (!a) return true;
    return a === 'ping' || a === 'login' || a === 'googleLogin' || a === 'auth.verify';
  }

  function _actionIsSensitive_(action) {
    var a = String(action || '').trim();
    if (!a) return false;
    if (/^admin\./i.test(a)) return true;
    if (/^debug/i.test(a)) return true;
    if (a === 'checkDate') return true;
    // Maintenance / backfill endpoints (should never be public)
    if (a === 'syncSessionDependencies') return true;
    return false;
  }

  function _actionRequiresAuth_(action) {
    if (_actionIsPublic_(action)) return false;
    // Always protect debug/admin endpoints even when global auth is off
    if (_actionIsSensitive_(action)) return true;
    // Global enforcement for production
    return _isProductionAuthEnabled_();
  }

  function _extractRequestToken_(e, data) {
    // Token may arrive via query params, JSON body, or Authorization header (best effort)
    try {
      if (e && e.parameter) {
        var t = (e.parameter.token || e.parameter.id_token || e.parameter.idToken || '').trim();
        if (t) return t;
      }
    } catch (_e1) {}

    try {
      if (data && typeof data === 'object') {
        var dt = String(data.token || data.id_token || data.idToken || '').trim();
        if (dt) return dt;
      }
    } catch (_e2) {}

    // Apps Script doesn't reliably toggle request headers, but keep best-effort support.
    try {
      var bearer = String((e && e.headers && e.headers.Authorization) || '').trim();
      if (/^Bearer\s+/i.test(bearer)) return bearer.replace(/^Bearer\s+/i, '').trim();
    } catch (_e3) {}

    // Some clients may send "Authorization" inside JSON string (non-standard).
    try {
      var raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
      var m = raw.match(/Authorization"\s*:\s*"Bearer\s+([^\"]+)/i);
      if (m && m[1]) return String(m[1]).trim();
    } catch (_e4) {}

    return '';
  }

  function _getRequestAuthContext_(e, data) {
    if (REQUEST_AUTH_CTX) return REQUEST_AUTH_CTX;
    var token = _extractRequestToken_(e, data);
    if (!token) return { success: false, error: 'Missing token' };
    try {
      var res = verifyGoogleLogin(token);
      if (!res || !res.success) return { success: false, error: (res && res.error) ? res.error : 'Token verification failed', details: res };
      var email = String(res.email || '').toLowerCase().trim();
      if (!email) return { success: false, error: 'Email missing in token' };
      REQUEST_AUTH_CTX = {
        success: true,
        email: email,
        emailVerified: !!res.emailVerified,
        tokenInfo: res.tokenInfo || null
      };
      return REQUEST_AUTH_CTX;
    } catch (err) {
      return { success: false, error: String(err && err.message ? err.message : err) };
    }
  }

  function _ensureAuthenticatedOrRespond_(e, data, action) {
    REQUEST_AUTH_CTX = null;
    if (!_actionRequiresAuth_(action)) return null;
    var ctx = _getRequestAuthContext_(e, data);
    if (!ctx || !ctx.success) {
      return _respond({ success: false, error: (ctx && ctx.error) ? ctx.error : 'Authorization required' }, 401);
    }
    return null;
  }

  /** Returns "YYYY-MM-DD" for *today* in IST */
  function _todayISO() {
    const now = new Date();
    return Utilities.formatDate(now, _tz_(), 'yyyy-MM-dd');
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
    return Utilities.formatDate(d, _tz_(), 'yyyy-MM-dd');
  }

  /** Get day name in IST from any date-like input (e.g., "Monday") */
  function _dayNameIST(value) {
    const d = _coerceToDate(value) || new Date(); // default now
    return Utilities.formatDate(d, _tz_(), 'EEEE'); // Monday, Tuesday...
  }

  /** Parse a client-sent date string (e.g., "2025-11-07" or ISO) to IST "YYYY-MM-DD" */
  function _normalizeQueryDate(dateStr) {
    if (!dateStr) return _todayISO();
    const raw = String(dateStr || '').trim();
    if (!raw) return _todayISO();

    // Prefer strict YYYY-MM-DD (avoid JS Date quirks)
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    // Support common UI formats like DD-MM-YYYY or DD/MM/YYYY
    const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmy) {
      const dd = String(dmy[1]).padStart(2, '0');
      const mm = String(dmy[2]).padStart(2, '0');
      const yyyy = String(dmy[3]);
      return `${yyyy}-${mm}-${dd}`;
    }

    // Fallback: let JS parse and then format to IST
    const d = new Date(raw);
    if (isNaN(d.getTime())) return _todayISO();
    return Utilities.formatDate(d, _tz_(), 'yyyy-MM-dd');
  }

  /** Determine if a lesson plan status should be treated as ready for teacher actions */
  function _isPlanReadyForTeacher(status) {
    const s = String(status || '').trim();
    if (!s) return false;
    // Ready or Approved
    if (/^(Ready|Approved)$/i.test(s)) return true;
    // Rescheduled (Cascade) treated equivalent to Ready
    if (/rescheduled\s*\(cascade\)/i.test(s)) return true;
    // Future-proof: allow "Rescheduled" without explicit tag
    if (/^Rescheduled$/i.test(s)) return true;
    return false;
  }

  /**
   * Safe wrappers for privilege checks.
   * Some deployments may not include AuthManager helpers yet; these prevent
   * ReferenceError crashes and default to deny if anything is missing.
   */
  function _isSuperAdminSafe(userEmail) {
    try {
      if (typeof isSuperAdmin === 'function') {
        return !!isSuperAdmin(userEmail);
      }
    } catch (e) {
      // ignore and fall back
    }
    try {
      // Never trust client-supplied email for privilege checks.
      // If request auth context exists, it takes precedence.
      var effectiveEmail = (REQUEST_AUTH_CTX && REQUEST_AUTH_CTX.email) ? REQUEST_AUTH_CTX.email : userEmail;
      var email = String(effectiveEmail || '').toLowerCase().trim();
      if (!email) return false;
      var sh = _getSheet('Users');
      if (!sh) return false;
      var headers = _headers(sh);
      var list = _rows(sh).map(function(r) { return _indexByHeader(r, headers); });
      var user = null;
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].email || '').toLowerCase() === email) { user = list[i]; break; }
      }
      if (!user) return false;
      var roles = String(user.roles || '').toLowerCase();
      return roles.indexOf('super admin') !== -1 || roles.indexOf('superadmin') !== -1 || roles.indexOf('super_admin') !== -1;
    } catch (err) {
      try { appLog('ERROR', '_isSuperAdminSafe', String(err && err.message ? err.message : err)); } catch (ee) {}
      return false;
    }
  }

  function _isHMOrSuperAdminSafe(userEmail) {
    try {
      if (typeof isHMOrSuperAdmin === 'function') {
        return !!isHMOrSuperAdmin(userEmail);
      }
    } catch (e) {
      // ignore and fall back
    }
    try {
      if (_isSuperAdminSafe(userEmail)) return true;
      var effectiveEmail = (REQUEST_AUTH_CTX && REQUEST_AUTH_CTX.email) ? REQUEST_AUTH_CTX.email : userEmail;
      var email = String(effectiveEmail || '').toLowerCase().trim();
      if (!email) return false;
      var sh = _getSheet('Users');
      if (!sh) return false;
      var headers = _headers(sh);
      var list = _rows(sh).map(function(r) { return _indexByHeader(r, headers); });
      var user = null;
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].email || '').toLowerCase() === email) { user = list[i]; break; }
      }
      if (!user) return false;
      var roles = String(user.roles || '').toLowerCase();
      return roles.indexOf('hm') !== -1 || roles.indexOf('headmaster') !== -1 || roles.indexOf('h m') !== -1 || roles.indexOf('principal') !== -1 || roles.indexOf('admin') !== -1;
    } catch (err) {
      try { appLog('ERROR', '_isHMOrSuperAdminSafe', String(err && err.message ? err.message : err)); } catch (ee) {}
      return false;
    }
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

      // DEBUG: Get execution logs
      if (action === 'debug.logs') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        try {
          const result = backfillDailyReportSchemeIds();
          return _respond({ success: true, ...result });
        } catch (err) {
          return _respond({ success: false, error: String(err), stack: err.stack });
        }
      }

      // Enforce authentication (configurable) and always protect sensitive endpoints.
      var authResp = _ensureAuthenticatedOrRespond_(e, null, action);
      if (authResp) return authResp;

      // Run bootstrap ONLY when explicitly requested (bootstrap is expensive)
      if (action === 'admin.bootstrap') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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

      
      // Basic system check
      if (action === 'ping') {
        return _respond({ ok: true, now: new Date().toISOString() });
      }
      
      // Debug: Check current date/time in IST
      if (action === 'checkDate') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
      
      // Debug: Check cache status
      if (action === 'debugCache') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        const startDate = (e.parameter.startDate || '').trim();
        const endDate = (e.parameter.endDate || '').trim();
        return _respond(getTeacherSubstitutionsRange(email, startDate, endDate));
      }

      if (action === 'getSubstitutionsRange') {
        // HM / Super Admin only
        const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(requesterEmail)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const startDate = (e.parameter.startDate || '').trim();
        const endDate = (e.parameter.endDate || '').trim();
        const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
        const cls = (e.parameter.class || '').trim();
        return _respond(getSubstitutionsRange(startDate, endDate, teacherEmail, cls));
      }

      if (action === 'getAllSubstitutions') {
        // HM / Super Admin only (debug)
        const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(requesterEmail)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getAllSubstitutions());
      }

      if (action === 'getSubstitutionEffectiveness') {
        // Teacher can access their own analytics; HM/Super Admin can access any.
        const requesterEmail = (e.parameter.email || e.parameter.requesterEmail || '').toLowerCase().trim();
        const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();

        const isAdmin = _isHMOrSuperAdminSafe(requesterEmail);
        // If teacherEmail is omitted, treat as self scope for teachers.
        const isSelfOrImplicitSelf = requesterEmail && (!teacherEmail || requesterEmail === teacherEmail);

        if (!isAdmin && !isSelfOrImplicitSelf) {
          return _respond({ success: false, error: 'Permission denied. HM/Super Admin or self access required.' });
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
      
      // === PERIOD EXCHANGE ROUTES ===
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
      
      // === EXAM ROUTES ===
      if (action === 'getExams') {
        const key = generateCacheKey('getExams', e.parameter);
        const dataOut = getCachedData(key, function() { return getExams(e.parameter); }, CACHE_TTL.MEDIUM);
        return _respond(dataOut);
      }
      
      if (action === 'debugExamsSheet') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        // Super Admin only
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ error: 'Permission denied. Super Admin access required.' });
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
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(testGetClassSubjectsAPI());
      }
      
      if (action === 'getGradeBoundaries') {
        return _respond(getGradeBoundaries());
      }
      
      // === STUDENT ROUTES ===
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
      
      // === FEE COLLECTION ROUTES ===
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
      
      // === SCHEME-BASED LESSON PLANNING ROUTES ===
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
      
      // === HOLIDAY MANAGEMENT ROUTES ===
      if (action === 'getUndeclaredHolidays') {
        const activeOnly = e.parameter.activeOnly !== 'false';
        return _respond({ success: true, holidays: getUndeclaredHolidays(activeOnly) });
      }
      
      if (action === 'declareTodayAsHoliday') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const reason = e.parameter.reason || 'Undeclared holiday';
        const userName = e.parameter.userName || '';
        const result = declareTodayAsHoliday(reason, email, userName);
        return _respond(result);
      }
      
      if (action === 'declareHoliday') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const dateStr = e.parameter.date || '';
        const reason = e.parameter.reason || 'Undeclared holiday';
        const userName = e.parameter.userName || '';
        if (!dateStr) {
          return _respond({ success: false, error: 'Date parameter is required' });
        }
        const result = declareHoliday(dateStr, reason, email, userName);
        return _respond(result);
      }
      
      if (action === 'getAffectedLessonPlans') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const startDate = e.parameter.startDate || _todayISO();
        // Pass true to check specific date only (preview mode, date not declared yet)
        const result = getAffectedLessonPlans(startDate, true);
        return _respond({ success: true, ...result });
      }
      
      if (action === 'getRecentCascades') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const limit = parseInt(e.parameter.limit || '10');
        return _respond({ success: true, cascades: getRecentCascades(limit) });
      }
      
      if (action === 'undoCascade') {
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
        }
        const cascadeId = e.parameter.cascadeId || '';
        const userName = e.parameter.userName || '';
        if (!cascadeId) {
          return _respond({ success: false, error: 'Missing cascadeId parameter' });
        }
        const result = undoCascade(cascadeId, email, userName);
        return _respond(result);
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
        const email = (e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
        if (!_isHMOrSuperAdminSafe(email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getAllUsers());
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

      // Enforce authentication (configurable) and always protect sensitive endpoints.
      var authResp = _ensureAuthenticatedOrRespond_(e, data, action);
      if (authResp) return authResp;

      // Run bootstrap ONLY when explicitly requested (bootstrap is expensive)
      if (action === 'admin.bootstrap') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        _bootstrapSheets();
        return _respond({ success: true, message: 'Bootstrap completed' });
      }

// === AUTHENTICATION ROUTES ===
    if (action === 'googleLogin') {
  return handleGoogleLogin(data); // handleGoogleLogin already returns _respond(...)
}
      if (action === 'auth.verify') {
        // Accept token from Authorization header (Bearer) or payload
        var authHeader = (e && e.parameter && e.parameter.Authorization) || (e && e.postData && e.postData.type && e.postData.contents && (e.postData.contents.match(/Authorization":"([^"]+)/) || [])[1]) || '';
        var bearer = '';
        try {
          // Also check raw headers if available via e.headers (not standard)
          bearer = String((e && e.headers && e.headers.Authorization) || '').trim();
        } catch (ee) { /* ignore */ }
        var token = String(data.token || '').trim();
        if (!token) {
          var hVal = String(authHeader || bearer || '').trim();
          if (/^Bearer\s+/i.test(hVal)) token = hVal.replace(/^Bearer\s+/i, '').trim();
        }
        if (!token) {
          return _respond({ success: false, error: 'Missing token' });
        }
        return _respond(verifyGoogleLogin(token));
      }

      // === ADMIN DATA ROUTES (Super Admin only) ===
      // Additive endpoints to manage sheet data from the frontend.
      // Existing functions/routes are not modified.
      if (action === 'admin.listSheets') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_adminListSheets());
      }

      if (action === 'admin.getSheet') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_adminGetSheet(data.sheetName));
      }

      if (action === 'admin.appendRow') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_adminAppendRow(data.sheetName, data.row || {}, email, data.name || ''));
      }

      if (action === 'admin.updateRow') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_adminUpdateRow(data.sheetName, data.rowNumber, data.row || {}, email, data.name || ''));
      }

      if (action === 'admin.deleteRow') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_adminDeleteRow(data.sheetName, data.rowNumber, email, data.name || ''));
      }

      // === SETTINGS ROUTES (HM or Super Admin) ===
      if (action === 'updateAppSettings') {
        return _handleUpdateAppSettings(data);
      }
      
      // === EXAM ROUTES ===
      if (action === 'createExam') {
        return _respond(createExam(data));
      }
      
      if (action === 'debugExamsSheet') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
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
      
      if (action === 'createBulkExams') {
        return _respond(createBulkExams(data));
      }
      
      if (action === 'updateExam') {
        return _respond(updateExam(data));
      }
      
      if (action === 'deleteExam') {
        // Super Admin only
        if (!_isSuperAdminSafe(data.email)) {
          return _respond({ error: 'Permission denied. Super Admin access required to delete exams.' });
        }
        return _respond(deleteExam(data.examId));
      }
      
      if (action === 'submitExamMarks') {
        return _respond(submitExamMarks(data));
      }
      
      // === SUPER ADMIN MANAGEMENT ROUTES ===
      if (action === 'deleteLessonPlan') {
        // Back-compat: allow Super Admin hard-delete; non-admin flows are handled later
        // via `_handleDeleteLessonPlan(data)` which enforces teacher ownership/status.
        if (_isSuperAdminSafe(data.email)) {
          return _respond(deleteLessonPlan(data.lessonPlanId));
        }
      }
      
      if (action === 'deleteScheme') {
        // Back-compat: allow Super Admin hard-delete; non-admin flows are handled later
        // via `_handleDeleteScheme(data)` which enforces teacher ownership/status.
        if (_isSuperAdminSafe(data.email)) {
          return _respond(deleteScheme(data.schemeId));
        }
      }
      
      if (action === 'deleteReport') {
        if (!_isSuperAdminSafe(data.email)) {
          return _respond({ error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(deleteReport(data.reportId));
      }
      
      if (action === 'addUser') {
        if (!_isSuperAdminSafe(data.email)) {
          return _respond({ error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(addUser(data));
      }
      
      if (action === 'updateUser') {
        if (!_isSuperAdminSafe(data.email)) {
          return _respond({ error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(updateUser(data));
      }
      
      if (action === 'deleteUser') {
        if (!_isSuperAdminSafe(data.email)) {
          return _respond({ error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(deleteUser(data.userEmail));
      }
      
      if (action === 'getAllUsers') {
        if (!_isHMOrSuperAdminSafe(data.email || e.parameter.email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getAllUsers());
      }
      
      // === AUDIT LOG ROUTES ===
      if (action === 'getAuditLogs') {
        const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(requesterEmail)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getAuditLogsForRequester(data.filters || {}, requesterEmail));
      }
      
      if (action === 'getEntityAuditTrail') {
        if (!_isHMOrSuperAdminSafe(data.email || e.parameter.email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getEntityAuditTrail(data.entityType, data.entityId));
      }
      
      if (action === 'getAuditSummary') {
        const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(requesterEmail)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(getAuditSummaryForRequester(data.filters || {}, requesterEmail));
      }
      
      if (action === 'exportAuditLogs') {
        const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isHMOrSuperAdminSafe(requesterEmail)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(exportAuditLogsForRequester(data.filters || {}, requesterEmail));
      }


      if (action === 'getAffectedLessonPlans') {
        if (!_isHMOrSuperAdminSafe(data.email || e.parameter.email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        // Pass true to check specific date only (preview mode)
        return _respond(getAffectedLessonPlans(data.startDate, true));
      }

      if (action === 'getRecentCascades') {
        if (!_isHMOrSuperAdminSafe(data.email || e.parameter.email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond({ cascades: getRecentCascades(data.limit || 10) });
      }

      if (action === 'undoCascade') {
        if (!_isHMOrSuperAdminSafe(data.email || e.parameter.email)) {
          return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(undoCascade(data.cascadeId, data.email, data.name));
      }
      
      // === SUBSTITUTION ROUTES ===
      if (action === 'assignSubstitutionsBatch') {
        return _respond(assignSubstitutionsBatch(data));
      }

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
      
      if (action === 'deleteScheme') {
        return _handleDeleteScheme(data);
      }
      
      if (action === 'updateScheme') {
        return _handleUpdateScheme(data);
      }
      
      if (action === 'deleteLessonPlan') {
        return _handleDeleteLessonPlan(data);
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
          // Include id as first column to match configured schema and new UUID flow
          const headers = ['id', 'date', 'teacherEmail', 'teacherName', 'class', 'subject', 'schemeId', 'period', 'planType', 'lessonPlanId', 'chapter', 'sessionNo', 'totalSessions', 'completionPercentage', 'chapterStatus', 'deviationReason', 'difficulties', 'nextSessionPlan', 'objectives', 'activities', 'completed', 'notes', 'createdAt', 'isSubstitution', 'absentTeacher', 'regularSubject', 'substituteSubject'];
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

          // Enforce: a matching Ready/Approved lesson plan must exist for this period (unless valid substitution)
          const lpSheet = _getSheet('LessonPlans');
          const lpHeaders = _headers(lpSheet);
          const lessonPlans = _rows(lpSheet).map(row => _indexByHeader(row, lpHeaders));
          const isFetchableStatus = (s) => _isPlanReadyForTeacher(s);
          const matchingPlan = lessonPlans.find(p => {
            const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
            const dateMatch = _normalizeQueryDate(p.selectedDate || p.date) === reportDate;
            const periodMatch = String(p.selectedPeriod || p.period || '').trim() === String(reportPeriod);
            const classMatch = String(p.class || '').trim() === reportClass;
            const subjectMatch = String(p.subject || '').trim() === reportSubject;
            return emailMatch && dateMatch && periodMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
          });

          // Check if this is a valid substitution slot for the requester
          let isSubstitution = false;
          let subAbsentTeacher = '';
          let subRegularSubject = '';
          let subSubstituteSubject = '';
          try {
            const subSh = _getSheet('Substitutions');
            const subHeaders = _headers(subSh);
            const subs = _rows(subSh).map(r => _indexByHeader(r, subHeaders));
            const subRow = subs.find(s => {
              const dMatch = _normalizeQueryDate(s.date) === reportDate;
              const pMatch = String(s.period || '').trim() === String(reportPeriod);
              const classMatch = String(s.class || '').trim() === reportClass;
              const subTeacherMatch = String(s.substituteTeacher || '').toLowerCase().trim() === teacherEmail;
              return dMatch && pMatch && classMatch && subTeacherMatch;
            });
            if (subRow) {
              const regSubj = String(subRow.regularSubject || '').toLowerCase().trim();
              const subSubj = String(subRow.substituteSubject || '').toLowerCase().trim();
              const rptSubj = String(reportSubject || '').toLowerCase().trim();
              const subjOk = !rptSubj || rptSubj === regSubj || (subSubj && rptSubj === subSubj);
              if (subjOk) {
                isSubstitution = true;
                subAbsentTeacher = String(subRow.absentTeacher || '').trim();
                subRegularSubject = String(subRow.regularSubject || '').trim();
                subSubstituteSubject = String(subRow.substituteSubject || '').trim();
              }
            }
          } catch (subErr) {
            appLog('WARN', 'Substitution check failed', { error: subErr && subErr.message });
          }

          if (!matchingPlan && !isSubstitution) {
            appLog('WARN', 'Daily report blocked: no Ready lesson plan', { reportDate, reportPeriod, reportClass, reportSubject, teacherEmail });
            return _respond({ ok: false, error: 'plan_required', message: 'A Ready lesson plan is required for this period. Please prepare and get it approved before submitting the report.' });
          }

          // Optional: for substitution reports, allow attaching a Ready plan for the SAME teacher+class+subject
          // (teacher manually chooses a plan; not auto-cascade).
          let attachedPlan = null;
          try {
            const lpId = String(data.lessonPlanId || '').trim();
            if (isSubstitution && lpId) {
              attachedPlan = lessonPlans.find(p => {
                const idMatch = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim() === lpId;
                const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
                const classMatch = String(p.class || '').trim() === reportClass;
                const subjectMatch = String(p.subject || '').trim() === reportSubject;
                return idMatch && emailMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
              }) || null;
            }
          } catch (apErr) {
            attachedPlan = null;
          }

          // Objectives/methods: for substitution require a free-text answer; for planned, auto-fill if missing
          var objectivesVal = String(data.objectives || '').trim();
          var activitiesVal = String(data.activities || '').trim();
          if (isSubstitution) {
            // If a valid plan was attached, auto-fill from it when missing.
            if (attachedPlan) {
              if (!objectivesVal) objectivesVal = String(attachedPlan.learningObjectives || attachedPlan.objectives || '').trim();
              if (!activitiesVal) activitiesVal = String(attachedPlan.teachingMethods || attachedPlan.activities || '').trim();
            }
            if (!objectivesVal) {
              return _respond({ ok: false, error: 'sub_note_required', message: 'Please describe what you did in this substitution period (or select a lesson plan).' });
            }
          } else {
            if (!objectivesVal) objectivesVal = String(matchingPlan.learningObjectives || '').trim();
            if (!activitiesVal) activitiesVal = String(matchingPlan.teachingMethods || '').trim();
          }

          // Compute total sessions from scheme if available
          var totalSessionsVal = Number(data.totalSessions || 0);
          if (!isSubstitution && !totalSessionsVal && matchingPlan && matchingPlan.schemeId) {
            try {
              const schemeSheet = _getSheet('Schemes');
              const schemeHeaders = _headers(schemeSheet);
              const schemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
              const scheme = schemes.find(s => String(s.schemeId || '').trim() === String(matchingPlan.schemeId || '').trim());
              totalSessionsVal = Number(scheme && scheme.noOfSessions ? scheme.noOfSessions : 1);
            } catch (e3) {
              totalSessionsVal = 1;
            }
          }
          // For substitution with attached plan, allow total sessions from that plan/scheme as well.
          if (isSubstitution && attachedPlan) {
            if (!totalSessionsVal) {
              const directTs = Number(attachedPlan.totalSessions || attachedPlan.noOfSessions || 0);
              if (!isNaN(directTs) && directTs > 0) totalSessionsVal = directTs;
            }
            if (!totalSessionsVal && attachedPlan.schemeId) {
              try {
                const schemeSheet2 = _getSheet('Schemes');
                const schemeHeaders2 = _headers(schemeSheet2);
                const schemes2 = _rows(schemeSheet2).map(row => _indexByHeader(row, schemeHeaders2));
                const scheme2 = schemes2.find(s => String(s.schemeId || '').trim() === String(attachedPlan.schemeId || '').trim());
                totalSessionsVal = Number(scheme2 && scheme2.noOfSessions ? scheme2.noOfSessions : 1);
              } catch (e4) {
                // ignore
              }
            }
          }
          if (!totalSessionsVal) totalSessionsVal = 1;

          // Extract schemeId from matching plan or attached plan (needed for sequence validation)
          const reportSchemeId = String((!isSubstitution && matchingPlan && matchingPlan.schemeId) || (attachedPlan && attachedPlan.schemeId) || data.schemeId || '').trim();

          // *** SESSION SEQUENCE VALIDATION ***
          // Enforce sequential reporting (no skipping sessions)
          const reportedChapter = String((!isSubstitution && matchingPlan && matchingPlan.chapter) || (attachedPlan && attachedPlan.chapter) || data.chapter || '').trim();
          const reportedSession = Number((!isSubstitution && (data.sessionNo || matchingPlan.session)) || (attachedPlan && attachedPlan.session) || Number(data.sessionNo || 0) || 0);
          
          if (reportedChapter && reportedSession > 0 && totalSessionsVal > 0) {
            const sequenceCheck = validateSessionSequence(teacherEmail, reportClass, reportSubject, reportedChapter, reportedSession, totalSessionsVal, reportSchemeId);
            if (!sequenceCheck.valid) {
              appLog('WARN', 'Session sequence violation', { attempted: reportedSession, expected: sequenceCheck.expectedSession, chapter: reportedChapter });
              return _respond({ 
                ok: false, 
                error: 'session_sequence_violation', 
                expectedSession: sequenceCheck.expectedSession,
                message: sequenceCheck.message 
              });
            }
          }

          const now = new Date().toISOString();
          const reportId = _uuid();
          const inferredPlanType = isSubstitution ? 'substitution' : 'in plan';
          const attachedPlanId = attachedPlan ? String(attachedPlan.lpId || attachedPlan.lessonPlanId || attachedPlan.planId || attachedPlan.id || '').trim() : '';
          const attachedChapter = attachedPlan ? String(attachedPlan.chapter || '').trim() : '';
          const attachedSession = attachedPlan ? Number(attachedPlan.session || attachedPlan.sessionNo || 0) : 0;
          
          // Map binary sessionComplete to percentage for backward compatibility
          const sessionComplete = data.sessionComplete === true || data.sessionComplete === 'true';
          const completionPercentage = sessionComplete ? 100 : (Number(data.completionPercentage || 0));
          
          // reportSchemeId already computed above
          
          const rowData = [
            reportId,
            data.date || '',
            data.teacherEmail || '',
            data.teacherName || '',
            data.class || '',
            data.subject || '',
            reportSchemeId,
            Number(data.period || 0),
            inferredPlanType,
            String((!isSubstitution && matchingPlan && matchingPlan.lpId) || attachedPlanId || data.lessonPlanId || ''),
            String((!isSubstitution && matchingPlan && matchingPlan.chapter) || attachedChapter || data.chapter || ''),
            Number((!isSubstitution && (data.sessionNo || matchingPlan.session)) || attachedSession || Number(data.sessionNo || 0) || 0),
            Number(totalSessionsVal || 1),
            completionPercentage,
            data.chapterStatus || '',
            data.deviationReason || '',
            data.difficulties || '',
            data.nextSessionPlan || '',
            objectivesVal,
            activitiesVal,
            data.chapterCompleted ? 'Chapter Complete' : (data.completed || ''),
            data.notes || '',
            now,
            isSubstitution ? 'TRUE' : 'FALSE',
            subAbsentTeacher,
            subRegularSubject,
            subSubstituteSubject
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

          try {
            logAudit({
              action: AUDIT_ACTIONS.SUBMIT,
              entityType: AUDIT_ENTITIES.DAILY_REPORT,
              entityId: reportId,
              userEmail: teacherEmail,
              userName: String(data.teacherName || '').trim(),
              userRole: 'Teacher',
              description: `Daily report submitted for ${reportClass} ${reportSubject} Period ${reportPeriod}`,
              severity: AUDIT_SEVERITY.INFO
            });
          } catch (auditErr) { /* ignore audit failures */ }
          
          // *** MANUAL CASCADE OPTION FROM FRONTEND ***
          // *** SIMPLIFIED CASCADE LOGIC ***
          // Handle cascadeOption field: only 'cascade' is supported now
          // If session incomplete (sessionComplete=false) and cascade requested
          let manualCascade = null;
          try {
            const cascadeOption = String(data.cascadeOption || '').trim();
            const sessionIsComplete = (data.sessionComplete === true || data.sessionComplete === 'true') || Number(data.completionPercentage || 0) === 100;
            const completionPct = sessionIsComplete ? 100 : 0; // Map to percentage for backward compatibility
            
            if (cascadeOption === 'cascade' && !sessionIsComplete && reportedPlanId) {
              // Manual cascade trigger (reschedule remaining sessions)
              const preview = getCascadePreview(reportedPlanId, teacherEmail, reportDate);
              if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
                const execPayload = {
                  sessionsToReschedule: preview.sessionsToReschedule,
                  mode: preview.mode,
                  dailyReportContext: { date: reportDate, teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod }
                };
                const cascadeResult = executeCascade(execPayload);
                manualCascade = {
                  action: 'cascade',
                  success: cascadeResult && cascadeResult.success,
                  updatedCount: cascadeResult && cascadeResult.updatedCount,
                  errors: cascadeResult && cascadeResult.errors
                };
                appLog('INFO', 'manual cascade executed', manualCascade);
              } else {
                manualCascade = { action: 'cascade', success: false, reason: 'preview_not_cascadable' };
              }
            }
          } catch (mcErr) {
            manualCascade = { attempted: true, success: false, error: mcErr.message };
            appLog('ERROR', 'manual cascade action failed', { message: mcErr.message, stack: mcErr.stack });
          }
          
          // *** CHAPTER COMPLETION ACTION (INLINE) ***
          // If chapter completed and has remaining sessions action, apply it
          if (data.chapterCompleted && data.remainingSessionsAction && data.remainingSessions && data.remainingSessions.length > 0) {
            try {
              const completionResult = applyChapterCompletionAction({
                action: data.remainingSessionsAction,
                lessonPlanIds: data.remainingSessions,
                requesterEmail: data.teacherEmail,
                rationale: data.completionRationale || 'Chapter completed early'
              });
              
              if (completionResult.success) {
              } else {
              }
            } catch (ccErr) {
              // Don't fail report submission if chapter action fails
            }
          }

          // Optional AUTO-CASCADE: if 0% completion and a lessonPlanId provided, attempt cascade immediately
          let autoCascade = null;
          try {
            const completionPct = Number(data.completionPercentage || 0);
            const lpIdForCascade = String((matchingPlan && matchingPlan.lpId) || data.lessonPlanId || '').trim();
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

          // NEW: If this was a substitution, also cascade the ABSENT teacher's plan for this slot (if any)
          let absentCascade = null;
          try {
            if (isSubstitution && subAbsentTeacher && subRegularSubject) {
              const absentEmail = String(subAbsentTeacher || '').toLowerCase().trim();
              const absentPlan = lessonPlans.find(p => {
                const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === absentEmail;
                const dateMatch = _normalizeQueryDate(p.selectedDate || p.date) === reportDate;
                const periodMatch = String(p.selectedPeriod || p.period || '').trim() === String(reportPeriod);
                const classMatch = String(p.class || '').trim() === reportClass;
                const subjectMatch = String(p.subject || '').trim().toLowerCase() === String(subRegularSubject).toLowerCase();
                return emailMatch && dateMatch && periodMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
              });
              if (absentPlan && absentPlan.lpId) {
                const preview = getCascadePreview(absentPlan.lpId, absentEmail, reportDate);
                if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
                  const execPayload = {
                    sessionsToReschedule: preview.sessionsToReschedule,
                    mode: preview.mode,
                    dailyReportContext: {
                      date: reportDate,
                      teacherEmail: absentEmail,
                      class: reportClass,
                      subject: subRegularSubject,
                      period: reportPeriod
                    }
                  };
                  const exec = executeCascade(execPayload);
                  absentCascade = { attempted: true, success: exec && exec.success, updatedCount: exec && exec.updatedCount, errors: exec && exec.errors };
                } else {
                  absentCascade = { attempted: true, success: false, reason: 'preview_not_cascadable' };
                }
              } else {
                absentCascade = { attempted: false, reason: 'no_absent_plan_found' };
              }
            }
          } catch (abErr) {
            absentCascade = { attempted: true, success: false, error: abErr && abErr.message };
          }

          // NEW: If this was a substitution where the SUBSTITUTE teacher attached their own plan,
          // pull back the teacher's future sessions for the same chapter by shifting each session
          // into the previous session's existing scheduled slot.
          // This matches the requested behavior: show only the next session plan, and when used,
          // shift remaining sessions earlier starting from the reporting date.
          let substitutePullback = null;
          try {
            if (isSubstitution && attachedPlan && attachedPlanId) {
              const attachedIso = _isoDateIST(attachedPlan.selectedDate || attachedPlan.date);
              const reportIso = reportDate; // already normalized
              const attachedPeriod = String(attachedPlan.selectedPeriod || attachedPlan.period || '').trim();

              const compareSlot = (dateA, periodA, dateB, periodB) => {
                const a = String(dateA || '').trim();
                const b = String(dateB || '').trim();
                if (!a || !b) return 0;
                if (a < b) return -1;
                if (a > b) return 1;
                const pa = Number(periodA || 0);
                const pb = Number(periodB || 0);
                if (pa < pb) return -1;
                if (pa > pb) return 1;
                return 0;
              };

              // Only apply pullback if the attached plan was scheduled after the report slot (date+period)
              if (attachedIso && reportIso && compareSlot(reportIso, reportPeriod, attachedIso, attachedPeriod) < 0) {
                const lpSh2 = lpSheet; // already loaded
                const lpH2 = lpHeaders;
                const colSelectedDate = lpH2.indexOf('selectedDate') + 1;
                const colSelectedPeriod = lpH2.indexOf('selectedPeriod') + 1;
                const colOriginalDate = lpH2.indexOf('originalDate') + 1;
                const colOriginalPeriod = lpH2.indexOf('originalPeriod') + 1;

                const chapterKey = String(attachedPlan.chapter || '').trim();
                const targetSession = Number(attachedPlan.session || attachedPlan.sessionNo || 0);

                // Find the chain of plans in the same chapter
                const chain = lessonPlans
                  .filter(p => {
                    const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                    if (!id) return false;
                    const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
                    const classMatch = String(p.class || '').trim() === reportClass;
                    const subjectMatch = String(p.subject || '').trim() === reportSubject;
                    const chapterMatch = chapterKey ? (String(p.chapter || '').trim() === chapterKey) : true;
                    const statusOk = isFetchableStatus(p.status);
                    const sess = Number(p.session || p.sessionNo || 0);
                    return emailMatch && classMatch && subjectMatch && chapterMatch && statusOk && sess >= targetSession;
                  })
                  .sort((a, b) => Number(a.session || a.sessionNo || 0) - Number(b.session || b.sessionNo || 0));

                const idxAttach = chain.findIndex(p => {
                  const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                  return id === attachedPlanId;
                });

                if (idxAttach < 0) {
                  substitutePullback = { attempted: true, success: false, reason: 'attached_plan_not_in_chain' };
                } else {
                  const oldSlots = chain.map(p => ({
                    date: _isoDateIST(p.selectedDate || p.date),
                    period: String(p.selectedPeriod || p.period || '').trim()
                  }));

                  const moves = [];
                  let updatedCount = 0;
                  // Update each plan row
                  chain.forEach((p, i) => {
                    if (i < idxAttach) return;
                    const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                    const rowIndex = lessonPlans.findIndex(x => String(x.lpId || x.lessonPlanId || x.planId || x.id || '').trim() === id);
                    if (rowIndex < 0) return;
                    const sheetRow = rowIndex + 2;
                    const oldDate = _isoDateIST(p.selectedDate || p.date);
                    const oldPeriod = String(p.selectedPeriod || p.period || '').trim();
                    if (!oldDate) return;

                    let newDate = '';
                    let newPeriod = '';

                    // For the attached plan itself: move it to the reporting date/period
                    if (id === attachedPlanId) {
                      newDate = reportIso;
                      newPeriod = String(reportPeriod);
                    } else {
                      // Shift later sessions into the previous session's ORIGINAL scheduled slot
                      const prev = oldSlots[i - 1];
                      if (prev && prev.date) {
                        newDate = prev.date;
                        newPeriod = String(prev.period || '').trim();
                      }
                    }

                    // Only write if we have valid new date
                    if (!newDate) return;

                    // Preserve original fields if present and blank
                    try {
                      if (colOriginalDate > 0 && colOriginalPeriod > 0) {
                        const origDateVal = String(lpSh2.getRange(sheetRow, colOriginalDate).getValue() || '').trim();
                        const origPerVal = String(lpSh2.getRange(sheetRow, colOriginalPeriod).getValue() || '').trim();
                        if (!origDateVal) lpSh2.getRange(sheetRow, colOriginalDate).setValue(oldDate);
                        if (!origPerVal) lpSh2.getRange(sheetRow, colOriginalPeriod).setValue(oldPeriod);
                      }
                    } catch (_ignoreOrig) {}

                    if (colSelectedDate > 0) lpSh2.getRange(sheetRow, colSelectedDate).setValue(newDate);
                    if (colSelectedPeriod > 0) lpSh2.getRange(sheetRow, colSelectedPeriod).setValue(newPeriod);

                    moves.push({ lpId: id, oldDate: oldDate, oldPeriod: oldPeriod, newDate: newDate, newPeriod: newPeriod });
                    updatedCount++;
                  });

                  substitutePullback = {
                    attempted: true,
                    success: updatedCount > 0,
                    updatedCount: updatedCount,
                    moves: moves
                  };
                }
              } else {
                substitutePullback = { attempted: false, reason: 'not_after_report_date' };
              }
            }
          } catch (spErr) {
            substitutePullback = { attempted: true, success: false, error: spErr && spErr.message };
          }

          // CRITICAL: Invalidate caches so UI refreshes immediately
          try {
            const cache = CacheService.getScriptCache();
            const keys = [
              'teacher_reports_' + teacherEmail + '_' + reportDate,
              'teacher_daily_' + teacherEmail + '_' + reportDate,
              'daily_timetable_' + reportDate,
              'planned_lessons_' + teacherEmail + '_' + reportDate,
              generateCacheKey('getTeacherDailyReportsForDate', { email: teacherEmail, date: reportDate }),
              generateCacheKey('getTeacherDailyData', { email: teacherEmail, date: reportDate }),
              // Substitution plan picker cache (best-effort)
              generateCacheKey('suggestedPlansForSubstitution', { teacherEmail: teacherEmail, cls: reportClass, subject: reportSubject, date: reportDate, period: String(reportPeriod) })
            ];
            appLog('INFO', 'Clearing caches', { keys: keys });
            keys.forEach(k => cache.remove(k));

            // Also invalidate broader caches that depend on DailyReports/Chapter completion.
            // Without this, lesson planning availability (canPrepare/lockReason) can remain stale until TTL expiry.
            try { invalidateCache('approved_schemes'); } catch (_e1) {}
            try { if (teacherEmail) invalidateCache('teacher_lessonplans_' + teacherEmail); } catch (_e2) {}
            appLog('INFO', 'Cache cleared successfully', { count: keys.length });
          } catch (cacheErr) {
            appLog('ERROR', 'Cache invalidation failed', { error: cacheErr.message });
          }
          
          return _respond({ ok: true, submitted: true, manualCascade: manualCascade, autoCascade: autoCascade, absentCascade: absentCascade, substitutePullback: substitutePullback, isSubstitution });
        } catch (err) {
          appLog('ERROR', 'submitDailyReport failed', { message: err.message, stack: err.stack });
          return _respond({ error: 'Failed to submit: ' + err.message });
        } finally {
          lock.releaseLock();
        }
      }
      // Daily report deletion (time-window enforced in helper)
      if (action === 'deleteDailyReport') {
        const reportId = (data.reportId || e.parameter.reportId || '').trim();
        const email = (data.email || e.parameter.email || '').trim();
        return _respond(deleteDailyReport(reportId, email));
      }
      // HM verification/reopen actions
      if (action === 'verifyDailyReport') {
        const reportId = (data.reportId || e.parameter.reportId || '').trim();
        const verifierEmail = (data.verifierEmail || e.parameter.verifierEmail || '').trim();
        return _respond(verifyDailyReport(reportId, verifierEmail));
      }
      if (action === 'reopenDailyReport') {
        const reportId = (data.reportId || e.parameter.reportId || '').trim();
        const requesterEmail = (data.requesterEmail || e.parameter.requesterEmail || '').trim();
        const reason = (data.reason || e.parameter.reason || '').trim();
        return _respond(reopenDailyReport(reportId, requesterEmail, reason));
      }
      if (action === 'notifyMissingSubmissions') {
        return _respond(_handleNotifyMissingSubmissions(data));
      }
      
      // === SCHEME-BASED LESSON PLANNING ROUTES ===
      if (action === 'createSchemeLessonPlan') {
        return _handleCreateSchemeLessonPlan(data);
      }
      
      if (action === 'createBulkSchemeLessonPlans') {
        return _handleCreateBulkSchemeLessonPlans(data);
      }
      
      // === AI LESSON PLAN SUGGESTIONS ===
      if (action === 'getAILessonSuggestions') {
        return _respond(getAILessonSuggestions(data.context || data));
      }
      // Deterministic AI-like suggestion endpoints (no external keys required)
      if (action === 'suggestLessonPlan') {
        return _respond(suggestLessonPlan(data));
      }
      if (action === 'suggestLessonPlansBulk') {
        return _respond(suggestLessonPlansBulk(data));
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
      
      // TeacherPerformance dashboard removed
      
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
      
      if (action === 'getDailyReadinessStatus') {
        const date = (e && e.parameter && e.parameter.date) ? String(e.parameter.date).trim() : '';
        return _respond(getDailyReadinessStatus(date || _todayISO()));
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
      
      if (action === 'batchUpdateLessonPlanStatus') {
        return _handleBatchUpdateLessonPlanStatus(data);
      }

      // Chapter-scoped bulk lesson plan status update (HM only)
      if (action === 'chapterBulkUpdateLessonPlanStatus') {
        return _handleChapterBulkUpdateLessonPlanStatus(data);
      }

      // Reschedule lesson plan (change date and period) - HM/Admin only
      if (action === 'rescheduleLessonPlan') {
        return _handleRescheduleLessonPlan(data);
      }

      // Simple diagnostic: reveals LessonPlans sheet headers and detects status column
      if (action === 'diagnoseLessonPlanHeaders') {
        const email = (data.email || e.parameter.email || '').toLowerCase().trim();
        if (!_isSuperAdminSafe(email)) {
          return _respond({ success: false, error: 'Permission denied. Super Admin access required.' });
        }
        return _respond(_handleDiagnoseLessonPlanHeaders());
      }
      
      // === FEE COLLECTION POST ROUTES ===
      if (action === 'addPaymentBatch') {
        try {
          const result = addPayment(data);
          return _respond({ ok: true, ...result });
        } catch (err) {
          return _respond({ ok: false, error: String(err) });
        }
      }
      
      if (action === 'voidReceipt') {
        try {
          const result = voidReceipt(data.receiptNo);
          return _respond({ ok: true, ...result });
        } catch (err) {
          return _respond({ ok: false, error: String(err) });
        }
      }
      
      if (action === 'unvoidReceipt') {
        try {
          const result = unvoidReceipt(data.receiptNo);
          return _respond({ ok: true, ...result });
        } catch (err) {
          return _respond({ ok: false, error: String(err) });
        }
      }
      
      if (action === 'bulkPayment') {
        try {
          // Transform data format: map body to match addPayment format for each student
          const payments = Array.isArray(data.payments) ? data.payments : [];
          const results = [];
          
          payments.forEach(payment => {
            try {
              const result = addPayment({
                date: data.date,
                admNo: payment.admNo,
                name: payment.name,
                cls: payment.cls || payment.class,
                mode: payment.mode,
                items: payment.feeHeads || []
              });
              results.push({ ...result, admNo: payment.admNo, success: true });
            } catch (err) {
              results.push({ admNo: payment.admNo, success: false, error: String(err) });
            }
          });
          
          return _respond({
            ok: true,
            results: results,
            successCount: results.filter(r => r.success).length,
            totalCount: results.length,
            date: data.date
          });
        } catch (err) {
          return _respond({ ok: false, error: String(err) });
        }
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
  * Send email notification with raw HTML body (no newline-to-<br> conversion).
  */
  function sendEmailNotificationHtml(to, subject, htmlBody, options = {}) {
    try {
      if (!to || !subject || !htmlBody) {
        console.error('Email notification missing required fields:', { to, subject, htmlBody: htmlBody ? 'present' : 'missing' });
        return { success: false, error: 'Missing required email fields' };
      }

      const emailOptions = {
        to: to,
        subject: subject,
        htmlBody: String(htmlBody || ''),
        ...options
      };

      MailApp.sendEmail(emailOptions);
      console.log('HTML email sent successfully to:', to);
      return { success: true };
    } catch (error) {
      console.error('Error sending HTML email:', error);
      return { success: false, error: error.message };
    }
  }

  function _htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _getHMRecipientEmails() {
    try {
      const usersSheet = _getSheet('Users');
      const headers = _headers(usersSheet);
      const users = _rows(usersSheet).map(r => _indexByHeader(r, headers));

      const hmSynonyms = ['hm', 'headmaster', 'headteacher', 'headmistress', 'principal'];
      const isHMRole = (rawRoles) => {
        const tokens = String(rawRoles || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
        const joined = tokens.join('');
        const hasToken = (t) => tokens.includes(t);
        const joinedHas = (t) => joined.indexOf(t) !== -1;
        const hasPair = (a, b) => hasToken(a) && hasToken(b);
        if (hmSynonyms.some(s => hasToken(s) || joinedHas(s))) return true;
        if (hasPair('head', 'master') || hasPair('head', 'teacher') || hasPair('head', 'mistress')) return true;
        return false;
      };

      const emails = [];
      users.forEach(u => {
        const email = String(u.email || '').toLowerCase().trim();
        if (!email) return;
        const roles = u.roles || u.role || '';
        if (!isHMRole(roles)) return;
        if (!emails.includes(email)) emails.push(email);
      });

      return emails;
    } catch (err) {
      console.error('_getHMRecipientEmails error', err);
      return [];
    }
  }

  function _fetchLessonPlansForChapter(teacherEmail, schemeId, chapter) {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allPlans = _rows(sh).map(r => _indexByHeader(r, headers));
    const te = String(teacherEmail || '').toLowerCase().trim();
    const ch = String(chapter || '').toLowerCase().trim();

    const plans = allPlans.filter(p => {
      if (!p) return false;
      if (String(p.schemeId || '').trim() !== String(schemeId || '').trim()) return false;
      if (String(p.teacherEmail || '').toLowerCase().trim() !== te) return false;
      if (String(p.chapter || '').toLowerCase().trim() !== ch) return false;
      const st = String(p.status || '').trim();
      return !['Cancelled', 'Rejected'].includes(st);
    });

    plans.sort((a, b) => (Number(a.session || 0) - Number(b.session || 0)) || String(a.lpId || '').localeCompare(String(b.lpId || '')));
    return plans;
  }

  function _buildLessonPlanSubmissionEmailHtml(context, plans) {
    const safe = _htmlEscape;
    const rowsHtml = (plans || []).map(p => {
      return [
        '<tr>',
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;">${safe(p.session || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;">${safe(p.selectedDate || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;">${safe(p.selectedPeriod || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;">${safe(p.status || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;white-space:pre-wrap;">${safe(p.learningObjectives || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;white-space:pre-wrap;">${safe(p.teachingMethods || p.activities || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;white-space:pre-wrap;">${safe(p.resourcesRequired || '')}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;vertical-align:top;white-space:pre-wrap;">${safe(p.assessmentMethods || p.assessment || '')}</td>`,
        '</tr>'
      ].join('');
    }).join('');

    return [
      '<div style="font-family:Arial,sans-serif;">',
      '<h2>Lesson Plan Submitted for Review</h2>',
      '<p>',
      `<strong>Teacher:</strong> ${safe(context.teacherName || '')} (${safe(context.teacherEmail || '')})<br>`,
      `<strong>Class:</strong> ${safe(context.className || '')}<br>`,
      `<strong>Subject:</strong> ${safe(context.subject || '')}<br>`,
      `<strong>Chapter:</strong> ${safe(context.chapter || '')}<br>`,
      `<strong>Scheme ID:</strong> ${safe(context.schemeId || '')}`,
      '</p>',
      '<p style="color:#555;">Reply to this email to contact the teacher (Reply-To is set).</p>',
      '<table style="border-collapse:collapse;width:100%;">',
      '<thead>',
      '<tr>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Session</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Date</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Period</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Status</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Objectives</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Teaching Methods / Activities</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Resources</th>',
      '<th style="text-align:left;padding:8px;border:1px solid #ddd;">Assessment</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      rowsHtml || '<tr><td colspan="8" style="padding:8px;border:1px solid #ddd;">No session plans found.</td></tr>',
      '</tbody>',
      '</table>',
      '</div>'
    ].join('');
  }

  function _notifyHMOnLessonPlanSubmittedForReview(lpId) {
    try {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const allPlans = _rows(sh).map(r => _indexByHeader(r, headers));
      const plan = allPlans.find(p => String(p.lpId || '').trim() === String(lpId || '').trim());
      if (!plan) return { success: false, error: 'Lesson plan not found for email' };

      const hmEmails = _getHMRecipientEmails();
      if (!hmEmails.length) {
        console.warn('No HM recipients found; skipping submission email');
        return { success: false, error: 'No HM recipients found' };
      }

      const teacherEmail = String(plan.teacherEmail || '').toLowerCase().trim();
      const teacherName = String(plan.teacherName || '').trim();
      const schemeId = String(plan.schemeId || '').trim();
      const chapter = String(plan.chapter || '').trim();
      const className = String(plan.class || '').trim();
      const subject = String(plan.subject || '').trim();

      const chapterPlans = _fetchLessonPlansForChapter(teacherEmail, schemeId, chapter);

      const sessionNums = (chapterPlans || [])
        .map(p => Number(p && p.session ? p.session : 0))
        .filter(n => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
      const sessionLabel = sessionNums.length
        ? (sessionNums[0] === sessionNums[sessionNums.length - 1]
            ? `S${sessionNums[0]}`
            : `S${sessionNums[0]}–S${sessionNums[sessionNums.length - 1]}`)
        : '';

      const teacherLabel = (teacherName && teacherName.trim()) ? teacherName.trim() : teacherEmail;
      const subjectLine = `LP Review: ${teacherLabel}${sessionLabel ? ` ${sessionLabel}` : ''} | ${className} | ${subject} | ${chapter}`;
      const html = _buildLessonPlanSubmissionEmailHtml({ teacherEmail, teacherName, schemeId, chapter, className, subject }, chapterPlans);

      // NOTE: Apps Script typically cannot send truly "from" the teacher unless the executing account has that alias.
      // We set Reply-To so HM can reply directly to the teacher.
      return sendEmailNotificationHtml(hmEmails.join(','), subjectLine, html, {
        replyTo: teacherEmail,
        name: teacherName ? `${teacherName} (via Lesson Planner)` : 'Lesson Planner'
      });
    } catch (err) {
      console.error('_notifyHMOnLessonPlanSubmittedForReview error', err);
      return { success: false, error: err && err.message ? err.message : String(err) };
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
      const summaryOnlyRaw = String(params.summaryOnly || '').trim();
      const summaryOnly = summaryOnlyRaw
        ? (summaryOnlyRaw === 'true' || summaryOnlyRaw === '1')
        : !!(_getLessonPlanSettings && _getLessonPlanSettings().summaryLoadingFirst);
      
      if (!teacherEmail) {
        return _respond({ success: false, error: 'Teacher email is required' });
      }

      // Optional cache bypass for debugging stale responses.
      const noCache = String(params.noCache || params.nocache || '').trim() === '1';
      
      // Try the original function first
      try {
        if (typeof getApprovedSchemesForLessonPlanning === 'function') {
          const result = noCache && (typeof _fetchApprovedSchemesForLessonPlanning === 'function')
            ? _fetchApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly)
            : getApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly);
          return _respond(result);
        }
      } catch (originalError) {
      }
      
      // ENHANCED BACKUP IMPLEMENTATION WITH CACHING
      
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

      // Map lessonPlanId -> schemeId for scheme-scoped DailyReports matching
      const planSchemeByLpId = new Map();
      (teacherPlans || []).forEach(plan => {
        if (!plan || typeof plan !== 'object') return;
        const lpId = String(plan.lpId || plan.lessonPlanId || plan.planId || plan.id || '').trim();
        const scId = String(plan.schemeId || '').trim();
        if (lpId && scId) planSchemeByLpId.set(lpId, scId);
      });
      
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
            const schemeIdKey = String(scheme.schemeId || '').trim();
            const chapterReports = dailyReportsData.filter(report => {
              // Safety check: ensure report is an object
              if (!report || typeof report !== 'object') return false;
              const reportTeacher = String(report.teacherEmail || '').toLowerCase();
              const matchesTeacher = reportTeacher === String(teacherEmail || '').toLowerCase();
              const reportLpId = String(report.lessonPlanId || '').trim();
              const reportSchemeId = String(report.schemeId || '').trim() || (reportLpId ? (planSchemeByLpId.get(reportLpId) || '') : '');
              if (reportSchemeId && schemeIdKey) {
                return matchesTeacher && reportSchemeId === schemeIdKey;
              }

              const matchesChapter = String(report.chapter || '') === String(chapterName || '');
              const matchesClass = String(report.class || '') === String(scheme.class || '');
              const matchesSubject = String(report.subject || '') === String(scheme.subject || '');
              return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
            });
            
            if (chapterReports.length > 0) {
              
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
                  
                  if (completion < 75) {
                    hasIncompleteSessions = true;
                  }
                }
              }
              
              // If there are incomplete sessions, allow extended sessions
              // NEW: More permissive logic - show extended if ANY session is incomplete  
              if (hasIncompleteSessions) {
                extendedSessionCount = originalSessionCount + 1;
              }
            } else {
            }
            
          } catch (drError) {
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
        
        const overallProgress = totalSessions > 0 ? Math.round((totalPlanned / totalSessions) * 100) : 0;
        return {
          schemeId: scheme.schemeId,
          class: scheme.class,
          subject: scheme.subject,
          academicYear: scheme.academicYear,
          term: scheme.term,
          totalSessions: totalSessions,
          plannedSessions: totalPlanned,
          overallProgress: overallProgress,
          chapters: chapters
        };
      });
      
      // Build final response
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
      
      return _respond(result);
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle GET scheme details (lazy load chapters/sessions on demand)
  */
  function _handleGetSchemeDetails(params) {
    try {
      const schemeId = params.schemeId;
      const teacherEmail = params.teacherEmail;
      
      if (!schemeId || !teacherEmail) {
        return _respond({ success: false, error: 'schemeId and teacherEmail are required' });
      }
      
      // Try the dedicated function first
      try {
        if (typeof getSchemeDetails === 'function') {
          const result = getSchemeDetails(schemeId, teacherEmail);
          return _respond(result);
        }
      } catch (error) {
      }
      
      return _respond({ success: false, error: 'getSchemeDetails function not available' });
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle GET available periods for lesson plan
  */
  function _handleGetAvailablePeriodsForLessonPlan(params) {
    try {
      const teacherEmail = params.teacherEmail;
      let startDate = params.startDate;
      let endDate = params.endDate;
      const excludeExisting = params.excludeExisting !== 'false';
      const schemeClass = params.class || '';  // Class from scheme
      const schemeSubject = params.subject || '';  // Subject from scheme
      
      // Default to next 30 days if no explicit range provided
      const todayISO = _todayISO();
      if (!startDate) startDate = todayISO;
      if (!endDate) {
        const d = new Date(startDate + 'T00:00:00');
        d.setDate(d.getDate() + 30);
        endDate = Utilities.formatDate(d, _tz_(), 'yyyy-MM-dd');
      }

      if (!teacherEmail) {
        return _respond({ success: false, error: 'Teacher email is required' });
      }
      
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
      const existingSchemeIds = new Set();
      try {
        const existingRows = _rows(sh);
        const existingHeaders = _headers(sh);
        const idIdx = existingHeaders.indexOf('schemeId');
        if (idIdx !== -1) {
          for (const row of existingRows) {
            const v = row[idIdx];
            if (v) existingSchemeIds.add(String(v).trim());
          }
        }
      } catch (e) {}

      const schemeId = _generateReadableSchemeId_(data, existingSchemeIds);
      
      // Lookup teacher name from Users sheet to ensure consistency
      const teacherEmail = String(data.teacherEmail || data.email || '').toLowerCase().trim();
      let teacherName = String(data.teacherName || '').trim();


      // Prefer directory name; also self-heal if frontend sent an email in teacherName
      const u = _getUserByEmail(teacherEmail);
      const dirName = u && u.name ? String(u.name || '').trim() : '';
      if (dirName && dirName.indexOf('@') === -1) {
        teacherName = dirName;
      } else if (teacherName && teacherName.indexOf('@') !== -1 && dirName) {
        // If Users has something but it's still email-like, keep teacherName (but at least normalize)
        teacherName = teacherEmail;
      }

      if (!teacherName) teacherName = teacherEmail;
      
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
        data.academicYear || '2025-2026',            // academicYear (default)
        data.content || ''                             // content (scheme details)
      ];
      
      sh.appendRow(line);
      try {
        logAudit({
          action: AUDIT_ACTIONS.CREATE,
          entityType: AUDIT_ENTITIES.SCHEME,
          entityId: schemeId,
          userEmail: teacherEmail,
          userName: teacherName,
          userRole: 'Teacher',
          description: `Scheme submitted for ${data.class || ''} ${data.subject || ''}`,
          severity: AUDIT_SEVERITY.INFO
        });
      } catch (auditErr) { /* ignore audit failures */ }
      return _respond({ ok: true, schemeId: schemeId });
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  // ===== Scheme ID generation (readable + unique suffix) =====
  function _schemeSlugToken_(value, opts) {
    const s = String(value || '').trim();
    if (!s) return '';
    const cleaned = s.replace(/[^A-Za-z0-9 ]+/g, ' ').trim();
    if (!cleaned) return '';
    const words = cleaned.split(/\s+/g).filter(Boolean);
    if (opts && opts.mode === 'initials') {
      const initials = words.map(w => w.charAt(0).toUpperCase()).join('');
      return opts.maxLen ? initials.slice(0, opts.maxLen) : initials;
    }
    if (opts && opts.mode === 'camel') {
      const camel = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
      return opts.maxLen ? camel.slice(0, opts.maxLen) : camel;
    }
    let out = words.join('');
    if (opts && opts.upper) out = out.toUpperCase();
    return opts && opts.maxLen ? out.slice(0, opts.maxLen) : out;
  }

  function _schemeIdSuffix_(len) {
    const raw = String(Utilities.getUuid() || '').replace(/-/g, '').toUpperCase();
    const n = Number(len || 6);
    return raw.slice(0, Math.max(4, Math.min(12, n)));
  }

  function _generateReadableSchemeId_(data, existingIdsSet) {
    const cls = _schemeSlugToken_(data && (data.class || data.className || ''), { upper: true });
    const subject = _schemeSlugToken_(data && (data.subject || ''), { mode: 'initials', maxLen: 3 });
    const chapter = _schemeSlugToken_(data && (data.chapter || ''), { mode: 'camel', maxLen: 10 });
    const base = `SC_${cls || 'CLS'}_${subject || 'SUB'}_${chapter || 'CH'}`;
    let id = `${base}_${_schemeIdSuffix_(4)}`;
    if (!existingIdsSet || typeof existingIdsSet.has !== 'function') return id;
    let guard = 0;
    while (existingIdsSet.has(id) && guard < 10) {
      id = `${base}_${_schemeIdSuffix_(4)}`;
      guard++;
    }
    return id;
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

      try {
        const statusNorm = String(status || '').toLowerCase().trim();
        let actionType = AUDIT_ACTIONS.UPDATE;
        if (statusNorm === 'approved') actionType = AUDIT_ACTIONS.APPROVE;
        else if (statusNorm === 'rejected') actionType = AUDIT_ACTIONS.REJECT;

        const actorEmail = String(data.requesterEmail || data.email || '').toLowerCase().trim();
        let actorRole = 'HM';
        try {
          if (actorEmail && isSuperAdmin(actorEmail)) actorRole = 'Super Admin';
        } catch (e) {}

        logAudit({
          action: actionType,
          entityType: AUDIT_ENTITIES.SCHEME,
          entityId: String(schemeId || ''),
          userEmail: actorEmail,
          userName: String(data.requesterName || data.name || actorEmail || '').trim(),
          userRole: actorRole,
          description: `Scheme status changed to ${status}`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }
      
      return _respond({ submitted: true });
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle DELETE lesson plan (only allowed for certain statuses)
  */
  function _handleDeleteLessonPlan(data) {
    try {
      const { lpId, teacherEmail } = data;
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const allRows = _rows(sh);
      const lessonPlans = allRows.map(row => _indexByHeader(row, headers));
      
      const rowIndex = lessonPlans.findIndex(row => row.lpId === lpId);
      
      if (rowIndex === -1) {
        return _respond({ success: false, error: 'Lesson plan not found' });
      }
      
      const lessonPlan = lessonPlans[rowIndex];
      
      // Verify ownership
      if (String(lessonPlan.teacherEmail || '').toLowerCase() !== String(teacherEmail || '').toLowerCase()) {
        return _respond({ success: false, error: 'Not authorized to delete this lesson plan' });
      }
      
      // Allow deletion only for specific statuses
      const status = String(lessonPlan.status || '').toLowerCase();
      const allowedStatuses = ['pending preparation', 'pending review', 'needs rework'];
      
      if (!allowedStatuses.includes(status)) {
        return _respond({ success: false, error: 'Can only delete lesson plans that are Pending Preparation, Pending Review, or Needs Rework' });
      }
      
      // Delete the row (rowIndex + 2: 1 for header, 1 for 0-based to 1-based)
      sh.deleteRow(rowIndex + 2);

      try {
        logAudit({
          action: AUDIT_ACTIONS.DELETE,
          entityType: AUDIT_ENTITIES.LESSON_PLAN,
          entityId: String(lessonPlan.lpId || ''),
          userEmail: String(teacherEmail || lessonPlan.teacherEmail || '').toLowerCase().trim(),
          userName: String(lessonPlan.teacherName || lessonPlan.teacherEmail || '').trim(),
          userRole: 'Teacher',
          description: `Lesson plan deleted by owner (${lessonPlan.class || ''} ${lessonPlan.subject || ''} ${lessonPlan.chapter || ''} Session ${lessonPlan.session || ''})`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }

      // Invalidate caches so the UI reflects changes immediately
      try {
        const te = String(teacherEmail || lessonPlan.teacherEmail || '').toLowerCase().trim();
        if (te) invalidateCache('teacher_lessonplans_' + te);
        invalidateCache('approved_schemes');
      } catch (invErr) {
      }
      
      return _respond({ success: true, message: 'Lesson plan deleted successfully' });
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle UPDATE lesson plan status (HM approval/rejection)
  */
  /**
   * Check if all sessions of a chapter have been submitted
   * Returns {complete: true} if all sessions exist, or {complete: false, missing: [], total: N}
   */
  function _checkChapterSessionsComplete(schemeId, chapter) {
    try {
      
      // Get the scheme to find noOfSessions
      const schemesSheet = _getSheet('Schemes');
      const schemesHeaders = _headers(schemesSheet);
      const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
      
      const scheme = allSchemes.find(s => s.schemeId === schemeId);
      if (!scheme) {
        return { complete: false, error: 'Scheme not found' };
      }
      
      const totalSessions = parseInt(scheme.noOfSessions || 2);
      
      // Get all lesson plans for this scheme and chapter
      const lpSheet = _getSheet('LessonPlans');
      const lpHeaders = _headers(lpSheet);
      const allPlans = _rows(lpSheet).map(row => _indexByHeader(row, lpHeaders));
      
      const chapterPlans = allPlans.filter(plan => {
        const matchScheme = plan.schemeId === schemeId;
        const matchChapter = String(plan.chapter || '').toLowerCase().trim() === String(chapter || '').toLowerCase().trim();
        const notCancelled = !['Cancelled', 'Rejected'].includes(String(plan.status || '').trim());
        
        return matchScheme && matchChapter && notCancelled;
      });
      
      // Check which sessions exist
      const existingSessions = new Set();
      chapterPlans.forEach(plan => {
        const sessionNum = parseInt(plan.session || 0);
        if (sessionNum > 0) {
          existingSessions.add(sessionNum);
        }
      });
      
      // Find missing sessions
      const missingSessions = [];
      for (let i = 1; i <= totalSessions; i++) {
        if (!existingSessions.has(i)) {
          missingSessions.push(i);
        }
      }
      
      const isComplete = missingSessions.length === 0;
      if (!isComplete) {
      }
      
      return {
        complete: isComplete,
        missing: missingSessions,
        total: totalSessions,
        submitted: existingSessions.size
      };
      
    } catch (error) {
      return { complete: false, error: error.message };
    }
  }

  function _handleUpdateLessonPlanStatus(data) {
    try {
      const { lpId, status, reviewComments, remarks, requesterEmail } = data;
      
      // Accept either reviewComments or remarks (frontend compatibility)
      const comments = reviewComments || remarks || '';
      
      if (!lpId || !status) {
        return _respond({ error: 'Lesson plan ID and status are required' });
      }
      
      // ROLE CHECK: Only HM or Super Admin can approve lesson plans (status='Ready')
      if (status === 'Ready') {
        if (!requesterEmail) {
          return _respond({ error: 'Authorization required: User email must be provided for approval' });
        }
        
        const isAuthorized = _isHMOrSuperAdminSafe(requesterEmail);
        if (!isAuthorized) {
          return _respond({ error: 'Unauthorized: Only Headmaster or Super Admin can approve lesson plans' });
        }
      }
      
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
      
      const rowIndex = lessonPlans.findIndex(row => row.lpId === lpId);
      
      if (rowIndex === -1) {
        return _respond({ error: 'Lesson plan not found' });
      }
      
      const lessonPlan = lessonPlans[rowIndex];
      
      // CRITICAL VALIDATION: When HM tries to approve (status='Ready'), check if ALL sessions are submitted
      if (status === 'Ready' && lessonPlan.schemeId && lessonPlan.chapter) {
        const completenessCheck = _checkChapterSessionsComplete(lessonPlan.schemeId, lessonPlan.chapter);
        
        if (!completenessCheck.complete) {
          return _respond({
            error: `Cannot approve: All ${completenessCheck.total} sessions must be submitted before approval. Missing sessions: ${completenessCheck.missing.join(', ')}`,
            incomplete: true,
            missing: completenessCheck.missing,
            submitted: completenessCheck.submitted,
            total: completenessCheck.total
          });
        }
      }
      
      // Find status column (case-insensitive) and update
      // Normalize headers (trim + lowercase) for flexible matching
      const normalizedHeaders = headers.map(h => String(h).trim());
      let rawStatusIdx = normalizedHeaders.findIndex(h => h === 'status');
      if (rawStatusIdx === -1) {
        rawStatusIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'status');
      }
      if (rawStatusIdx === -1) {
        return _respond({ error: 'Status column not found in sheet' });
      }
      const statusColIndex = rawStatusIdx + 1; // convert to 1-based
      const previousStatus = sh.getRange(rowIndex + 2, statusColIndex).getValue();
      sh.getRange(rowIndex + 2, statusColIndex).setValue(status);
      const writtenStatus = sh.getRange(rowIndex + 2, statusColIndex).getValue();

      // Invalidate caches so the UI reflects changes immediately
      try {
        const te = String(lessonPlan.teacherEmail || '').toLowerCase().trim();
        if (te) invalidateCache('teacher_lessonplans_' + te);
        invalidateCache('approved_schemes');
      } catch (invErr) {
      }

      // If the teacher resubmits an existing plan for review, notify HM(s) with full session details.
      try {
        const prevNorm = String(previousStatus || '').toLowerCase().trim();
        const newNorm = String(status || '').toLowerCase().trim();
        const req = String(requesterEmail || '').toLowerCase().trim();
        const owner = String(lessonPlan.teacherEmail || '').toLowerCase().trim();
        if (newNorm === 'pending review' && prevNorm !== 'pending review' && req && owner && req === owner) {
          _notifyHMOnLessonPlanSubmittedForReview(lpId);
        }
      } catch (mailErr) {
      }
      
      // Update review comments if provided
      if (comments) {
        let commentsIdx = normalizedHeaders.findIndex(h => h === 'reviewComments');
        if (commentsIdx === -1) {
          commentsIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'reviewcomments');
        }
        if (commentsIdx >= 0) {
          sh.getRange(rowIndex + 2, commentsIdx + 1).setValue(comments);
        } else {
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
      }

      try {
        const statusNorm = String(status || '').toLowerCase().trim();
        let actionType = AUDIT_ACTIONS.UPDATE;
        if (statusNorm === 'ready') actionType = AUDIT_ACTIONS.APPROVE;
        else if (statusNorm === 'rejected' || statusNorm === 'needs rework') actionType = AUDIT_ACTIONS.REJECT;
        else if (statusNorm === 'pending review') actionType = AUDIT_ACTIONS.SUBMIT;

        const actorEmail = String(requesterEmail || lessonPlan.teacherEmail || '').toLowerCase().trim();
        let actorRole = 'Teacher';
        try {
          if (actorEmail && _isHMOrSuperAdminSafe(actorEmail)) actorRole = 'HM';
        } catch (e) {}

        logAudit({
          action: actionType,
          entityType: AUDIT_ENTITIES.LESSON_PLAN,
          entityId: String(lpId),
          userEmail: actorEmail,
          userName: String(lessonPlan.teacherName || lessonPlan.teacherEmail || '').trim(),
          userRole: actorRole,
          description: `Lesson plan status changed from ${previousStatus} to ${writtenStatus}`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }
      
      // Include verification data for debugging on client side
      return _respond({ success: true, message: 'Lesson plan status updated successfully', lpId, previousStatus, writtenStatus });
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
   * Handle batch update of lesson plan statuses
   * Allows HM to approve multiple lesson plans at once
   */
  function _handleBatchUpdateLessonPlanStatus(data) {
    try {
      // Feature disabled: batch lesson plan approval removed per requirements
      return _respond({ success: false, error: 'Batch lesson plan approvals are disabled' });
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
   * Handle reschedule lesson plan (change date and period)
   * HM/Admin only feature
   */
  function _handleRescheduleLessonPlan(data) {
    try {
      // Accept multiple payload shapes for backwards/forwards compatibility
      const lpId = data.lpId || data.lessonPlanId || data.id;
      const newDate = data.newDate || data.selectedDate || data.date;
      const newPeriod = data.newPeriod || data.selectedPeriod || data.period;
      const requesterEmail = (data.requesterEmail || data.email || '').toLowerCase().trim();

      if (!lpId) {
        return _respond({ success: false, error: 'Lesson plan ID required' });
      }
      if (!newDate) {
        return _respond({ success: false, error: 'New date required' });
      }
      if (!newPeriod) {
        return _respond({ success: false, error: 'New period required' });
      }

      // Permission check: only HM or Admin can reschedule
      if (requesterEmail && !_isHMOrSuperAdminSafe(requesterEmail)) {
        return _respond({ success: false, error: 'Permission denied. Only HM/Admin can reschedule lesson plans.' });
      }

      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const data_rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();

      const lpIdColIndex = headers.indexOf('lpId');
      const teacherEmailColIndex = headers.indexOf('teacherEmail');
      // Different deployments use different column names.
      // Prefer selectedDate/selectedPeriod (current schema), fall back to date/period (legacy schema).
      const dateColIndex = headers.indexOf('selectedDate') !== -1 ? headers.indexOf('selectedDate') : headers.indexOf('date');
      const periodColIndex = headers.indexOf('selectedPeriod') !== -1 ? headers.indexOf('selectedPeriod') : headers.indexOf('period');
      const originalDateColIndex = headers.indexOf('originalDate');
      const originalPeriodColIndex = headers.indexOf('originalPeriod');

      if (lpIdColIndex === -1 || dateColIndex === -1 || periodColIndex === -1) {
        return _respond({
          success: false,
          error: 'Required columns not found in LessonPlans sheet',
          details: {
            missing: {
              lpId: lpIdColIndex === -1,
              date: dateColIndex === -1,
              period: periodColIndex === -1
            },
            headers: headers
          }
        });
      }

      // Find the lesson plan row
      let rowIndex = -1;
      for (let i = 0; i < data_rows.length; i++) {
        if (String(data_rows[i][lpIdColIndex]) === String(lpId)) {
          rowIndex = i + 2; // +2 because arrays are 0-indexed and row 1 is headers
          break;
        }
      }

      if (rowIndex === -1) {
        return _respond({ success: false, error: 'Lesson plan not found' });
      }

      // Capture teacherEmail for targeted cache invalidation (best effort)
      let teacherEmail = '';
      try {
        if (teacherEmailColIndex !== -1) {
          teacherEmail = String(sh.getRange(rowIndex, teacherEmailColIndex + 1).getValue() || '').toLowerCase().trim();
        }
      } catch (e) {
        teacherEmail = '';
      }

      // Preserve the previous schedule in originalDate/originalPeriod (if present and empty)
      // so HM/Admin can track what was changed.
      try {
        const prevDate = sh.getRange(rowIndex, dateColIndex + 1).getValue();
        const prevPeriod = sh.getRange(rowIndex, periodColIndex + 1).getValue();
        if (originalDateColIndex !== -1) {
          const curOrigDate = sh.getRange(rowIndex, originalDateColIndex + 1).getValue();
          if (!curOrigDate && prevDate) sh.getRange(rowIndex, originalDateColIndex + 1).setValue(prevDate);
        }
        if (originalPeriodColIndex !== -1) {
          const curOrigPeriod = sh.getRange(rowIndex, originalPeriodColIndex + 1).getValue();
          if (!curOrigPeriod && prevPeriod) sh.getRange(rowIndex, originalPeriodColIndex + 1).setValue(prevPeriod);
        }
      } catch (e) {
        // Ignore preserve errors
      }

      // Update date and period (selectedDate/selectedPeriod in current schema)
      const prevDate = sh.getRange(rowIndex, dateColIndex + 1).getValue();
      const prevPeriod = sh.getRange(rowIndex, periodColIndex + 1).getValue();
      sh.getRange(rowIndex, dateColIndex + 1).setValue(newDate);
      sh.getRange(rowIndex, periodColIndex + 1).setValue(newPeriod);

      // Clear cache
      try {
        invalidateCache('teacher_lessonplans');
        invalidateCache('hm_lessonplans');
        if (teacherEmail) {
          try { invalidateCache('teacher_lessonplans_' + teacherEmail); } catch (e) {}
        }
      } catch (e) {
        // Ignore cache clear errors
      }

      try {
        logAudit({
          action: AUDIT_ACTIONS.UPDATE,
          entityType: AUDIT_ENTITIES.LESSON_PLAN,
          entityId: String(lpId),
          userEmail: requesterEmail,
          userName: requesterEmail || '',
          userRole: 'HM',
          description: `Lesson plan rescheduled to ${newDate} period ${newPeriod}`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }

      return _respond({ 
        success: true, 
        message: 'Lesson plan rescheduled successfully',
        lpId: lpId,
        newDate: newDate,
        newPeriod: newPeriod
      });
    } catch (error) {
      return _respond({ success: false, error: error.message });
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
      
      // Cache key based on email
      const cacheKey = `teacher_schemes_${email.toLowerCase()}`;
      
      // Try to get from cache (MEDIUM TTL - 5 minutes)
      const cached = getCachedData(cacheKey, () => _fetchTeacherSchemes(email), CACHE_TTL.MEDIUM);
      
      return _respond(cached);
    } catch (error) {
      return _respond({ error: error.message });
    }
  }
  
  /**
   * Fetch teacher schemes from sheet (private helper for caching)
   */
  function _fetchTeacherSchemes(email) {
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const schemes = _rows(sh).map(row => _indexByHeader(row, headers))
      .filter(scheme => (scheme.teacherEmail || '').toLowerCase() === email.toLowerCase());
    
    return schemes;
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

      // Optional cache bypass (useful when debugging "stale" UI).
      const noCache = String(params.noCache || params.nocache || '').trim() === '1';
      
      // Build cache key including filters
      const filters = [
        params.subject || '',
        params.class || '',
        params.status || '',
        params.search || ''
      ].join('_').toLowerCase();
      const cacheKey = `teacher_lessonplans_${email.toLowerCase()}_${filters}`;

      if (noCache) {
        return _respond(_fetchTeacherLessonPlans(email, params));
      }

      // Try to get from cache (MEDIUM TTL - 5 minutes)
      const cached = getCachedData(cacheKey, () => _fetchTeacherLessonPlans(email, params), CACHE_TTL.MEDIUM);
      return _respond(cached);
    } catch (error) {
      return _respond({ error: error.message });
    }
  }
  
  /**
   * Fetch teacher lesson plans from sheet (private helper for caching)
   */
  function _fetchTeacherLessonPlans(email, params) {
    const emailNorm = String(email || '').toLowerCase().trim();
    let lessonPlans = [];
    const _getTeacherEmail = function(plan) {
      return String(
        plan && (
          plan.teacherEmail ||
          plan.email ||
          plan.teacher ||
          plan.TeacherEmail ||
          plan['Teacher Email'] ||
          plan['Teacher email']
        ) || ''
      ).toLowerCase().trim();
    };
    const _normalizePlan = function(plan) {
      if (!plan || typeof plan !== 'object') return plan;
      if (!plan.teacherEmail) plan.teacherEmail = plan.email || plan.teacher || plan.TeacherEmail || plan['Teacher Email'] || plan['Teacher email'] || '';
      if (!plan.status) plan.status = plan.Status || plan.lessonPlanStatus || plan.LessonPlanStatus || '';
      if (!plan.session) plan.session = plan.sessionNo || plan.sessionNumber || plan.Session || plan.SessionNo || plan['Session No'] || '';
      if (!plan.chapter) plan.chapter = plan.Chapter || plan.chapterName || plan.ChapterName || '';
      if (!plan.class) plan.class = plan.Class || plan['Class'] || '';
      if (!plan.subject) plan.subject = plan.Subject || plan['Subject'] || '';
      if (!plan.lpId) plan.lpId = plan.lessonPlanId || plan.planId || plan.id || plan['Lesson Plan Id'] || '';
      if (!plan.selectedDate) plan.selectedDate = plan.date || plan.Date || plan['Selected Date'] || plan['SelectedDate'] || '';
      if (!plan.selectedPeriod) plan.selectedPeriod = plan.period || plan.Period || plan['Selected Period'] || plan['SelectedPeriod'] || '';
      if (!plan.originalDate) plan.originalDate = plan.OriginalDate || plan['Original Date'] || plan.original_date || plan['OriginalDate'] || '';
      if (!plan.originalPeriod) plan.originalPeriod = plan.OriginalPeriod || plan['Original Period'] || plan.original_period || plan['OriginalPeriod'] || '';
      return plan;
    };

    // FAST PATH: fetch only this teacher's rows using TextFinder (avoids full-sheet reads)
    try {
      const fetched = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', emailNorm);
      if (fetched && Array.isArray(fetched.rows)) {
        lessonPlans = fetched.rows;
      }
    } catch (e) {
      lessonPlans = [];
    }

    // FALLBACK: full-sheet scan if TextFinder failed or returned no rows
    if (!lessonPlans || lessonPlans.length === 0) {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers))
        .filter(plan => _getTeacherEmail(plan) === emailNorm)
        .map(_normalizePlan);
    } else {
      // Safety: normalize filter in case of stray whitespace/case
      lessonPlans = lessonPlans.filter(plan => _getTeacherEmail(plan) === emailNorm).map(_normalizePlan);
    }

    // Normalize legacy column names so frontend consistently reads status/session/chapter fields.
    lessonPlans = (lessonPlans || []).map(plan => {
      if (!plan || typeof plan !== 'object') return plan;
      if (!plan.teacherEmail) plan.teacherEmail = plan.email || plan.teacher || plan.TeacherEmail || plan['Teacher Email'] || plan['Teacher email'] || plan.Teacher || '';
      if (!plan.status) plan.status = plan.Status || plan.lessonPlanStatus || plan.LessonPlanStatus || '';
      if (!plan.session) plan.session = plan.sessionNo || plan.sessionNumber || plan.Session || plan.SessionNo || '';
      if (!plan.chapter) plan.chapter = plan.Chapter || plan.chapterName || plan.ChapterName || '';
      if (!plan.class) plan.class = plan.Class || '';
      if (!plan.subject) plan.subject = plan.Subject || '';
      if (!plan.lpId) plan.lpId = plan.lessonPlanId || plan.planId || plan.id || '';
      if (!plan.selectedDate) plan.selectedDate = plan.date || plan.Date || plan['Selected Date'] || plan['SelectedDate'] || '';
      if (!plan.selectedPeriod) plan.selectedPeriod = plan.period || plan.Period || plan['Selected Period'] || plan['SelectedPeriod'] || '';
      if (!plan.originalDate) plan.originalDate = plan.OriginalDate || plan['Original Date'] || plan.original_date || plan['OriginalDate'] || '';
      if (!plan.originalPeriod) plan.originalPeriod = plan.OriginalPeriod || plan['Original Period'] || plan.original_period || plan['OriginalPeriod'] || '';
      return plan;
    });
    
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
    
    return lessonPlans;
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
      return _respond({ error: error.message });
    }
  }

  /**
  * Handle GET pending lesson plans for HM approval
  * Supports filtering by teacher, class, subject, and status
  */
  function _handleGetPendingLessonPlans(params) {
    try {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      
      const allLessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
      
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
      // - If params.status is undefined (missing), default to HM-friendly pending set
      // - If params.status is '' or 'All', do NOT filter by status
      // - Otherwise, filter by the provided status
      var hasStatusParam = Object.prototype.hasOwnProperty.call(params, 'status');
      if (!hasStatusParam) {
        var pendingStatuses = ['Pending Review','Submitted','Pending'];
        filteredPlans = filteredPlans.filter(function(plan){
          var s = String(plan.status || '').trim();
          return pendingStatuses.indexOf(s) >= 0;
        });
      } else if (params.status && params.status !== 'All') {
        var target = String(params.status).trim();
        filteredPlans = filteredPlans.filter(function(plan){ return String(plan.status || '').trim() === target; });
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
      
      // Enrich with noOfSessions from Schemes sheet
      const schemesSheet = _getSheet('Schemes');
      const schemesHeaders = _headers(schemesSheet);
      const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
      
      filteredPlans = filteredPlans.map(plan => {
        if (plan.schemeId) {
          const scheme = allSchemes.find(s => s.schemeId === plan.schemeId);
          if (scheme && scheme.noOfSessions) {
            plan.noOfSessions = scheme.noOfSessions;
          }
        }
        return plan;
      });
      
      return _respond(filteredPlans);
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
  * Handle GET all schemes
  */
  function _handleGetAllSchemes(params) {
    try {
      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      
      const allRows = _rows(sh);
      
      let schemes = allRows
        .map(row => _indexByHeader(row, headers))
        .filter(scheme => scheme && scheme.schemeId);
      
      // Apply filters
      if (params.teacher && params.teacher !== '') {
        const teacherLower = params.teacher.toLowerCase();
        schemes = schemes.filter(scheme =>
          String(scheme.teacherName || '').toLowerCase().includes(teacherLower) ||
          String(scheme.teacherEmail || '').toLowerCase().includes(teacherLower)
        );
      }
      
      if (params.class && params.class !== '') {
        schemes = schemes.filter(scheme =>
          String(scheme.class || '').toLowerCase() === params.class.toLowerCase()
        );
      }
      
      if (params.subject && params.subject !== '') {
        schemes = schemes.filter(scheme =>
          String(scheme.subject || '').toLowerCase() === params.subject.toLowerCase()
        );
      }
      
      if (params.status && params.status !== '' && params.status !== 'All') {
        schemes = schemes.filter(scheme =>
          String(scheme.status || '') === params.status
        );
      }
      
      return _respond(schemes);
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
  * Handle POST create scheme lesson plan
  */
  function _handleCreateSchemeLessonPlan(data) {
    try {
      if (!data.lessonPlanData) {
        return _respond({ success: false, error: 'No lesson plan data provided' });
      }
      
      const result = createSchemeLessonPlan(data.lessonPlanData);

      // Invalidate caches so the UI reflects changes immediately
      try {
        const teacherEmail = (data.lessonPlanData && data.lessonPlanData.teacherEmail) ? String(data.lessonPlanData.teacherEmail).toLowerCase().trim() : '';
        if (teacherEmail) invalidateCache('teacher_lessonplans_' + teacherEmail);
        invalidateCache('approved_schemes');
      } catch (invErr) {
      }

      // If teacher explicitly submitted for review, notify HM(s) with full session details.
      try {
        const statusRaw = String((data.lessonPlanData && data.lessonPlanData.status) || '').toLowerCase().trim();
        if (result && result.success && statusRaw === 'submitted' && result.lessonPlanId) {
          _notifyHMOnLessonPlanSubmittedForReview(result.lessonPlanId);
        }
      } catch (mailErr) {
      }

      return _respond(result);
    } catch (error) {
      console.error('Error handling create scheme lesson plan:', error);
      return _respond({ success: false, error: error.message || 'Unknown error occurred' });
    }
  }
  
  /**
  * Handle POST create bulk scheme lesson plans
  */
  function _handleCreateBulkSchemeLessonPlans(data) {
    try {
      if (!data.bulkPlanData) {
        return _respond({ success: false, error: 'No bulk plan data provided' });
      }
      
      const result = createBulkSchemeLessonPlans(data.bulkPlanData);

      // Invalidate caches so the UI reflects changes immediately
      try {
        const teacherEmail = (data.bulkPlanData && data.bulkPlanData.teacherEmail) ? String(data.bulkPlanData.teacherEmail).toLowerCase().trim() : '';
        if (teacherEmail) invalidateCache('teacher_lessonplans_' + teacherEmail);
        invalidateCache('approved_schemes');
      } catch (invErr) {
      }

      // Bulk create puts sessions into Pending Review; notify HM once (best-effort).
      try {
        if (result && result.success && Array.isArray(result.plans) && result.plans.length) {
          // Prefer first LP id if available; otherwise skip.
          const lpId = result.plans[0].lpId;
          if (lpId) _notifyHMOnLessonPlanSubmittedForReview(lpId);
        }
      } catch (mailErr) {
      }

      return _respond(result);
    } catch (error) {
      console.error('Error handling create bulk scheme lesson plans:', error);
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
      
      if (!email || !date) {
        return _respond({ 
          success: false, 
          error: 'Missing required parameters: email, date' 
        });
      }

      const emailNorm = String(email || '').toLowerCase().trim();
      const dateNorm = _normalizeQueryDate(date);
      
      // Get timetable data
      const timetable = getTeacherDailyTimetable(emailNorm, dateNorm);
      
      // Get submitted reports
      // IMPORTANT: _handleGetTeacherDailyReportsForDate() returns a JSON TextOutput, so it can't be used here.
      // Use the raw fetcher (optionally cached) so we return a real array in this batch endpoint.
      const reportsCacheKey = 'teacher_reports_' + emailNorm + '_' + dateNorm;
      const reports = getCachedData(reportsCacheKey, function() {
        return _fetchTeacherDailyReportsForDate(emailNorm, dateNorm);
      }, CACHE_TTL.SHORT);
      
      return _respond({
        success: true,
        date: dateNorm,
        timetable: timetable,
        timetableWithReports: timetable,
        reports: Array.isArray(reports) ? reports : [],
        combined: true
      });
      
    } catch (error) {
      return _respond({ 
        success: false, 
        error: error.message 
      });
    }
  }

  function _normalizeDailyTimetablePayload_(timetableRes) {
    if (Array.isArray(timetableRes)) return timetableRes;
    if (timetableRes && Array.isArray(timetableRes.periods)) return timetableRes.periods;
    if (timetableRes && Array.isArray(timetableRes.data)) return timetableRes.data;
    if (timetableRes && Array.isArray(timetableRes.timetable)) return timetableRes.timetable;
    return [];
  }

  function _normalizeTextKey_(val) {
    return String(val || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, '');
  }

  function _normalizePeriodKey_(val) {
    const s = String(val ?? '').trim();
    const m = s.match(/(\d+)/);
    return m ? m[1] : s;
  }

  function _buildDailyReportKey_(obj) {
    const period = _normalizePeriodKey_(obj && (obj.period ?? obj.Period ?? obj.selectedPeriod ?? obj.periodNumber ?? obj.slot));
    const cls = _normalizeTextKey_(obj && (obj.class ?? obj.Class ?? obj.className ?? obj.standard ?? obj.grade));
    const subjRaw = (obj && obj.isSubstitution)
      ? (obj.substituteSubject ?? obj.subject ?? obj.Subject ?? obj.subjectName)
      : (obj.subject ?? obj.Subject ?? obj.subjectName);
    const subj = _normalizeTextKey_(subjRaw);
    return `${period}|${cls}|${subj}`;
  }

  function _dayNameFromISO_(iso) {
    const d = new Date(String(iso || '').trim() + 'T00:00:00Z');
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, _tz_(), 'EEEE');
  }

  function _isWeekendISO_(iso) {
    const dayName = _dayNameFromISO_(iso);
    return dayName === 'Saturday' || dayName === 'Sunday';
  }

  function _addDaysISO_(iso, deltaDays) {
    const d = new Date(String(iso || '').trim() + 'T00:00:00Z');
    if (isNaN(d.getTime())) return String(iso || '').trim();
    d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }

  function _diffDaysISO_(fromIso, toIso) {
    const a = new Date(String(fromIso || '').trim() + 'T00:00:00Z');
    const b = new Date(String(toIso || '').trim() + 'T00:00:00Z');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    const diffMs = b.getTime() - a.getTime();
    return Math.floor(diffMs / 86400000);
  }

  function _getDateRangeDesc_(fromIso, toIso, maxDays, includeWeekends) {
    const out = [];
    const from = String(fromIso || '').trim();
    const to = String(toIso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return out;
    if (from > to) return out;

    const limit = Math.max(1, Number(maxDays || 1));
    let cur = to;
    let tries = 0;
    while (tries < limit) {
      if (includeWeekends || !_isWeekendISO_(cur)) out.push(cur);
      if (cur === from) break;
      cur = _addDaysISO_(cur, -1);
      tries++;
    }
    return out;
  }

  function _fetchTeacherDailyReportsForDates_(email, dateList) {
    const out = {};
    if (!email || !Array.isArray(dateList) || dateList.length === 0) return out;
    const dateSet = {};
    dateList.forEach(d => { if (d) dateSet[String(d).trim()] = true; });

    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    const emailNorm = String(email || '').toLowerCase().trim();

    allReports.forEach(report => {
      if (!report || !report.date || !report.teacherEmail) return;
      const reportDate = _isoDateIST(report.date);
      if (!dateSet[reportDate]) return;
      const reportEmail = String(report.teacherEmail || '').toLowerCase().trim();
      if (reportEmail !== emailNorm) return;
      if (!out[reportDate]) out[reportDate] = [];
      out[reportDate].push({
        ...report,
        status: 'Submitted'
      });
    });

    return out;
  }

  function _computeMissingDailyReports_(email, dateList, reportsByDate) {
    const pending = [];
    if (!email || !Array.isArray(dateList) || dateList.length === 0) {
      return { pending: [], count: 0, missingDays: 0 };
    }

    dateList.forEach(date => {
      const timetableRes = getTeacherDailyTimetable(email, date);
      const periods = _normalizeDailyTimetablePayload_(timetableRes);
      const reports = Array.isArray(reportsByDate && reportsByDate[date]) ? reportsByDate[date] : [];

      const submitted = {};
      reports.forEach(r => {
        const key = _buildDailyReportKey_(r);
        if (String(key).split('|').every(part => String(part || '').trim())) submitted[key] = true;
      });

      periods.forEach(p => {
        const key = _buildDailyReportKey_(p);
        const parts = String(key).split('|');
        if (parts.length !== 3) return;
        const subjKey = parts[2];
        if (!parts[0] || !parts[1] || !subjKey) return;
        if (subjKey === 'free' || subjKey === 'no class' || subjKey === 'noclass') return;
        if (submitted[key]) return;
        pending.push({
          date: date,
          period: p && (p.period ?? p.Period ?? p.periodNumber ?? p.slot ?? ''),
          class: p && (p.class ?? p.Class ?? p.className ?? ''),
          subject: p && (p.isSubstitution ? (p.substituteSubject ?? p.subject ?? p.Subject ?? '') : (p.subject ?? p.Subject ?? '')),
          isSubstitution: !!(p && p.isSubstitution)
        });
      });
    });

    pending.sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''));
      if (d !== 0) return d;
      return Number(a.period || 0) - Number(b.period || 0);
    });

    const missingDays = Object.keys(pending.reduce((acc, item) => {
      const k = String(item.date || '').trim();
      if (k) acc[k] = true;
      return acc;
    }, {})).length;

    return { pending: pending, count: pending.length, missingDays: missingDays };
  }

  /**
  * BATCH ENDPOINT: Unified teacher dashboard data
  * Includes: missing reports (range), today's timetable, today's reports, today's plans
  */
  function _handleGetTeacherDashboardData(params) {
    try {
      const email = String(params.email || '').toLowerCase().trim();
      if (!email) {
        return _respond({ success: false, error: 'Missing required parameter: email' });
      }

      const dateNorm = _normalizeQueryDate(params.date || _todayISO());

      const settingsKv = _getCachedSettings();
      const _numSetting = (key, defVal) => {
        try {
          const raw = settingsKv && Object.prototype.hasOwnProperty.call(settingsKv, key) ? settingsKv[key] : '';
          const s = String(raw ?? '').trim();
          if (!s) return defVal;
          const n = Number(s);
          return Number.isFinite(n) ? n : defVal;
        } catch (e) {
          return defVal;
        }
      };

      const lookbackDays = Math.max(1, Math.min(60, _numSetting('MISSING_DAILY_REPORT_LOOKBACK_DAYS', 7)));
      const maxRangeDays = Math.max(1, Math.min(90, _numSetting('MISSING_DAILY_REPORT_MAX_RANGE_DAYS', 31)));
      const includeWeekends = String(params.includeWeekends || '').trim() === '1';

      const yesterdayIso = _addDaysISO_(_todayISO(), -1);
      const fromParam = String(params.from || params.startDate || '').trim();
      const toParam = String(params.to || params.endDate || '').trim();

      let rangeTo = toParam ? _normalizeQueryDate(toParam) : yesterdayIso;
      if (rangeTo > yesterdayIso) rangeTo = yesterdayIso;

      let rangeFrom = fromParam ? _normalizeQueryDate(fromParam) : _addDaysISO_(rangeTo, -(lookbackDays - 1));
      if (rangeFrom > rangeTo) rangeFrom = rangeTo;

      const diffDays = _diffDaysISO_(rangeFrom, rangeTo) + 1;
      if (diffDays > maxRangeDays) {
        rangeFrom = _addDaysISO_(rangeTo, -(maxRangeDays - 1));
      }

      const cacheKey = generateCacheKey('getTeacherDashboardData', {
        email: email,
        date: dateNorm,
        from: rangeFrom,
        to: rangeTo,
        includeWeekends: includeWeekends ? '1' : ''
      });

      const dataOut = getCachedData(cacheKey, function() {
        const dateList = _getDateRangeDesc_(rangeFrom, rangeTo, maxRangeDays, includeWeekends);
        const reportsByDate = _fetchTeacherDailyReportsForDates_(email, dateList);
        const missingReports = _computeMissingDailyReports_(email, dateList, reportsByDate);

        const timetable = getTeacherDailyTimetable(email, dateNorm);
        const todayReports = _fetchTeacherDailyReportsForDate(email, dateNorm);
        const plannedLessons = _fetchPlannedLessonsForDate(email, dateNorm, true);

        return {
          success: true,
          date: dateNorm,
          timetable: timetable,
          reports: Array.isArray(todayReports) ? todayReports : [],
          plannedLessons: plannedLessons,
          missingReports: {
            range: { from: rangeFrom, to: rangeTo },
            count: missingReports.count,
            missingDays: missingReports.missingDays,
            pending: missingReports.pending
          }
        };
      }, CACHE_TTL.SHORT);

      return _respond(dataOut);
    } catch (error) {
      return _respond({ success: false, error: error.message });
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
      const includeAll = String(params.includeAll || params.includeAllStatuses || '').trim() === '1';
      
      if (!email || !date) {
        return _respond({ 
          success: false, 
          error: 'Missing required parameters: email, date' 
        });
      }
      
      const queryDate = _normalizeQueryDate(date);
      
      // PERFORMANCE: Cache with SHORT TTL - lesson plans can change
      const cacheKey = 'planned_lessons_' + email + '_' + queryDate + '_' + (includeAll ? 'all' : 'ready');
      return _respond(getCachedData(cacheKey, function() {
        return _fetchPlannedLessonsForDate(email, queryDate, includeAll);
      }, CACHE_TTL.SHORT));
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Suggest Ready lesson plans for a substitution period.
  * Purpose: allow substitute teacher to optionally attach one of their Ready plans
  * for the same class+subject while reporting a substitution slot.
  *
  * Params:
  * - teacherEmail (required)
  * - class (required)
  * - subject (required)
  * - date (optional; used only for sorting preference)
  */
  function _handleGetSuggestedPlansForSubstitution(params) {
    try {
      const teacherEmail = String(params.teacherEmail || params.email || '').toLowerCase().trim();
      const cls = String(params.class || params.cls || '').trim();
      const subject = String(params.subject || '').trim();
      const date = params.date ? _normalizeQueryDate(params.date) : '';
      const reportPeriod = String(params.period || '').trim();

      if (!teacherEmail || !cls || !subject) {
        return _respond({ success: false, error: 'Missing required parameters: teacherEmail, class, subject' }, 400);
      }

      const cacheKey = generateCacheKey('suggestedPlansForSubstitution', { teacherEmail, cls, subject, date, period: reportPeriod });
      const out = getCachedData(cacheKey, function() {
        const sh = _getSheet('LessonPlans');
        const headers = _headers(sh);
        const rows = _rows(sh).map(r => _indexByHeader(r, headers));
        const isFetchableStatus = (s) => _isPlanReadyForTeacher(s);

        // Batch load scheme session counts so we can return accurate totalSessions
        const schemeSheet = _getSheet('Schemes');
        const schemeHeaders = _headers(schemeSheet);
        const allSchemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
        const schemeMap = {};
        allSchemes.forEach(s => {
          const sid = String(s && (s.schemeId || s.id) || '').trim();
          if (sid) schemeMap[sid] = s;
        });

        const _norm = (v) => String(v || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');

        const _normClass = (v) => _norm(v)
          .replace(/^std\s*/i, '')
          .replace(/\s+/g, '');

        const _normSubject = (v) => _norm(v)
          .replace(/\s+/g, ' ');

        const clsKey = _normClass(cls);
        const subjectKey = _normSubject(subject);

        let plans = rows.filter(p => {
          if (!p) return false;
          const emailMatch = String(p.teacherEmail || '').toLowerCase().trim() === teacherEmail;
          const classMatch = _normClass(p.class) === clsKey;
          const subjectMatch = _normSubject(p.subject) === subjectKey;
          return emailMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
        });

        const toISO = (v) => {
          const d = _normalizeQueryDate(v);
          return d || '';
        };

        // Compare two timetable slots (date+period). Returns:
        // -1 if A is before B, 1 if A is after B, 0 if equal/unknown.
        const compareSlot = (dateA, periodA, dateB, periodB) => {
          const a = String(dateA || '').trim();
          const b = String(dateB || '').trim();
          if (!a || !b) return 0;
          if (a < b) return -1;
          if (a > b) return 1;
          const pa = Number(periodA || 0);
          const pb = Number(periodB || 0);
          if (pa < pb) return -1;
          if (pa > pb) return 1;
          return 0;
        };

        const hasReportSlot = Boolean(date && reportPeriod);
        const isAfterReportSlot = (planDate, planPeriod) => {
          if (!hasReportSlot) return true;
          const pd = String(planDate || '').trim();
          const pp = String(planPeriod || '').trim();
          if (!pd || !pp) return false;
          return compareSlot(date, reportPeriod, pd, pp) < 0;
        };

        plans.sort((a, b) => {
          // Prefer plans on/after the requested date, then by date, then by period, then by session
          const ad = toISO(a.selectedDate || a.date);
          const bd = toISO(b.selectedDate || b.date);

          // Key fix: when reporting a substitution slot (date+period), avoid picking a plan
          // scheduled BEFORE the reporting slot as the default suggestion.
          // Example: teacher already taught session 1 in P1 today, then reports substitution in P4.
          // We should suggest the next session (often scheduled tomorrow) not the earlier P1 plan.
          if (hasReportSlot) {
            const ap = String(a.selectedPeriod || a.period || '').trim();
            const bp = String(b.selectedPeriod || b.period || '').trim();
            const aAfterSlot = isAfterReportSlot(ad, ap);
            const bAfterSlot = isAfterReportSlot(bd, bp);
            if (aAfterSlot !== bAfterSlot) return aAfterSlot ? -1 : 1;
          }

          const aAfter = date ? (ad >= date) : true;
          const bAfter = date ? (bd >= date) : true;
          if (aAfter !== bAfter) return aAfter ? -1 : 1;
          const ds = String(ad || '').localeCompare(String(bd || ''));
          if (ds !== 0) return ds;
          const ap = Number(a.selectedPeriod || a.period || 0);
          const bp = Number(b.selectedPeriod || b.period || 0);
          if (ap !== bp) return ap - bp;
          const asn = Number(a.session || a.sessionNo || 0);
          const bsn = Number(b.session || b.sessionNo || 0);
          return asn - bsn;
        });

        // Return a compact list (top 20)
        const compact = plans.slice(0, 20).map(p => {
          const planSchemeId = String(p.schemeId || '').trim();
          let totalSessions = Number(p.totalSessions || p.noOfSessions || 0);
          if ((!totalSessions || isNaN(totalSessions)) && planSchemeId && schemeMap[planSchemeId]) {
            totalSessions = Number(schemeMap[planSchemeId].noOfSessions || 0);
          }

          return {
          lpId: String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim(),
          schemeId: planSchemeId,
          class: String(p.class || '').trim(),
          subject: String(p.subject || '').trim(),
          chapter: String(p.chapter || '').trim(),
          sessionNo: Number(p.session || p.sessionNo || 0),
          totalSessions: totalSessions,
          selectedDate: toISO(p.selectedDate || p.date) || '',
          selectedPeriod: String(p.selectedPeriod || p.period || '').trim(),
          learningObjectives: String(p.learningObjectives || p.objectives || '').trim(),
          teachingMethods: String(p.teachingMethods || p.activities || '').trim(),
          status: String(p.status || '').trim()
          };
        }).filter(x => x.lpId);

        // Determine the next plan:
        // 1) Pick a base suggestion (prefer a plan scheduled AFTER the reporting slot).
        // 2) Enforce sequential reporting by switching to the plan matching the FIRST UNREPORTED session
        //    for that same chapter (even if that plan was scheduled earlier in the day).
        let nextPlan = null;
        if (compact.length) {
          if (hasReportSlot) {
            nextPlan = compact.find(p => isAfterReportSlot(p.selectedDate, p.selectedPeriod)) || null;
          }
          if (!nextPlan) nextPlan = compact[0] || null;

          const nextChapter = nextPlan && String(nextPlan.chapter || '').trim();
          const nextTotalSessions = nextPlan && Number(nextPlan.totalSessions || 0);
          if (nextPlan && nextChapter && nextTotalSessions) {
            const firstUnreportedSessionNo = getFirstUnreportedSession(
              teacherEmail,
              cls,
              subject,
              nextChapter,
              nextTotalSessions
            );
            if (firstUnreportedSessionNo) {
              const matching = compact.find(p => (
                String(p.chapter || '').trim() === nextChapter &&
                Number(p.sessionNo || 0) === Number(firstUnreportedSessionNo)
              ));
              if (matching) nextPlan = matching;
            }
          }
        }

        let pullbackPreview = [];
        if (nextPlan && nextPlan.chapter) {
          const chain = compact
            .filter(p => String(p.chapter || '').trim() === String(nextPlan.chapter || '').trim())
            .sort((a, b) => Number(a.sessionNo || 0) - Number(b.sessionNo || 0));

          const selectedSess = Number(nextPlan.sessionNo || 0);
          const attachedDate = String(nextPlan.selectedDate || '').trim();
          const attachedPeriod = String(nextPlan.selectedPeriod || '').trim();

          // Only show preview when the attached plan is scheduled AFTER the report slot.
          const canPullback = date && reportPeriod
            ? (compareSlot(date, reportPeriod, attachedDate, attachedPeriod) < 0)
            : (date ? (String(attachedDate || '') > String(date || '')) : true);

          if (canPullback) {
            const idx = chain.findIndex(p => String(p.lpId || '').trim() === String(nextPlan.lpId || '').trim());
            if (idx >= 0) {
              const oldSlots = chain.map(p => ({
                date: String(p.selectedDate || '').trim(),
                period: String(p.selectedPeriod || '').trim()
              }));

              pullbackPreview = chain
                .filter((p, i) => i > idx && Number(p.sessionNo || 0) > selectedSess)
                .map((p, i) => {
                  const curIdx = chain.findIndex(x => String(x.lpId || '').trim() === String(p.lpId || '').trim());
                  const prev = oldSlots[curIdx - 1];
                  const cur = oldSlots[curIdx];
                  return {
                    lpId: p.lpId,
                    chapter: p.chapter,
                    sessionNo: p.sessionNo,
                    oldDate: cur && cur.date,
                    oldPeriod: cur && cur.period,
                    newDate: prev && prev.date,
                    newPeriod: prev && prev.period
                  };
                })
                .filter(x => x.lpId && x.oldDate && x.newDate)
                .slice(0, 12);
            }
          }
        }

        return { success: true, plans: compact, nextPlan: nextPlan, pullbackPreview: pullbackPreview };
      }, CACHE_TTL.SHORT);

      return _respond(out);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }
  
  function _fetchPlannedLessonsForDate(email, queryDate, includeAll) {
    // Block lesson planning on non-teaching days (exams/holidays/events) from AcademicCalendar
    // Check if queryDate falls within any ExamsHolidaysEventsStart to ExamsHolidaysEventsEnd range
    let isNonTeachingDay = false;
    let nonTeachingReason = '';
    try {
      const calendarData = _getCachedSheetData('AcademicCalendar');
      const rows = calendarData && calendarData.data ? calendarData.data : [];
      const qd = queryDate; // already ISO yyyy-MM-dd in IST

      for (let i = 0; i < rows.length && !isNonTeachingDay; i++) {
        const r = rows[i] || {};
        
        // Check if date falls within ExamsHolidaysEventsStart to ExamsHolidaysEventsEnd range
        const blockStart = r.ExamsHolidaysEventsStart ? _isoDateIST(_coerceToDate(r.ExamsHolidaysEventsStart)) : null;
        const blockEnd = r.ExamsHolidaysEventsEnd ? _isoDateIST(_coerceToDate(r.ExamsHolidaysEventsEnd)) : null;
        
        if (blockStart && blockEnd && qd >= blockStart && qd <= blockEnd) {
          isNonTeachingDay = true;
          nonTeachingReason = 'Blocked Period (Exam/Holiday/Event)';
          break;
        }
      }
    } catch (calErr) {
    }

    // NOTE: Do NOT hard-block returning plans here.
    // Teachers may still have "Ready" plans assigned to their timetable for this date.
    // We return the non-teaching metadata, but still include any matching Ready plans.
    
    // Get all lesson plans for this date
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const allLessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
    
    // Filter for Ready status, matching date, and matching teacher
    const isActiveStatus = (statusRaw) => {
      const s = String(statusRaw || '').trim().toLowerCase();
      if (!s) return true;
      return !['cancelled', 'rejected', 'skipped', 'completed early'].includes(s);
    };

    const matchingPlans = allLessonPlans.filter(plan => {
      const planTeacher = String(plan.teacherEmail || plan.email || '').trim().toLowerCase();
      const qTeacher = String(email || '').trim().toLowerCase();
      if (!planTeacher || !qTeacher || planTeacher !== qTeacher) return false;

      let selectedDateVal = plan.selectedDate || plan.date;
      
      // FALLBACK: Parse date from uniqueKey if selectedDate is missing
      // uniqueKey format: "email|YYYY-MM-DD|period"
        if (!selectedDateVal && plan.uniqueKey) {
          const parts = String(plan.uniqueKey).split('|');
          if (parts.length >= 2) {
            selectedDateVal = parts[1]; // Extract date from uniqueKey
          }
        }
        
        let planDate = _isoDateIST(selectedDateVal);
        if (!planDate && typeof selectedDateVal === 'string') {
          const t = String(selectedDateVal).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) planDate = t;
        }
        
        const statusRaw = String(plan.status || '');
        const isFetchableStatus = includeAll ? isActiveStatus(statusRaw) : _isPlanReadyForTeacher(statusRaw);
        return isFetchableStatus && planDate === queryDate;
      });
      
      // Get scheme details for total sessions (batch lookup)
      const schemeSheet = _getSheet('Schemes');
      const schemeHeaders = _headers(schemeSheet);
      const allSchemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
      const schemeMap = {};
      allSchemes.forEach(scheme => {
        const sid = String(scheme.schemeId || '').trim();
        if (sid) schemeMap[sid] = scheme;
      });
      
      // Build response with period-indexed lessons
      const lessonsByPeriod = {};
      matchingPlans.forEach(plan => {
        const periodVal = String(plan.selectedPeriod || plan.period || '').trim();
        const classVal = String(plan.class || '').trim();
        const subjectVal = String(plan.subject || '').trim();
        const periodKey = `${periodVal}|${classVal}|${subjectVal}`;
        // Also map by uniqueKey used in the sheet: teacherEmail|YYYY-MM-DD|period
        const uniqueKey = String(plan.uniqueKey || '').trim() || `${String(email || '').trim().toLowerCase()}|${queryDate}|${periodVal}`;
        
        let totalSessions = 1;
        const planSchemeId = String(plan.schemeId || '').trim();
        if (planSchemeId && schemeMap[planSchemeId]) {
          totalSessions = Number(schemeMap[planSchemeId].noOfSessions || 1);
        }

        const entry = {
          lpId: plan.lpId,
          schemeId: plan.schemeId,
          chapter: plan.chapter || '',
          session: plan.session || '',
          sessionNo: Number(plan.sessionNo || plan.session || 0),
          totalSessions: totalSessions,
          learningObjectives: plan.learningObjectives || '',
          teachingMethods: plan.teachingMethods || '',
          resourcesRequired: plan.resourcesRequired || '',
          assessmentMethods: plan.assessmentMethods || '',
          selectedDate: plan.selectedDate,
          selectedPeriod: periodVal,
          class: classVal,
          subject: subjectVal,
          status: plan.status || '',
          uniqueKey: uniqueKey,
          preparationDay: plan.preparationDay || ''
        };

        lessonsByPeriod[periodKey] = entry;
      });

    if (isNonTeachingDay && matchingPlans.length === 0) {
      return {
        success: true,
        email: email,
        date: queryDate,
        isNonTeachingDay: true,
        reason: nonTeachingReason,
        lessonsByPeriod: {},
        totalPlans: 0
      };
    }

    return {
      success: true,
      email: email,
      date: queryDate,
      isNonTeachingDay: isNonTeachingDay,
      reason: nonTeachingReason,
      lessonsByPeriod: lessonsByPeriod,
      totalPlans: matchingPlans.length
    };
  }

  function _handleGetPlannedLessonForPeriod(params) {
    try {
      const { email, date, period, class: className, subject } = params;
      
      if (!email || !date || !period || !className || !subject) {
        return _respond({ 
          success: false, 
          error: 'Missing required parameters: email, date, period, class, subject' 
        });
      }
      
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const lessonPlans = _rows(sh).map(row => _indexByHeader(row, headers));
      
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
        
        let planDate = _isoDateIST(selectedDateVal);
        if (!planDate && typeof selectedDateVal === 'string') {
          const t = String(selectedDateVal).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) planDate = t;
        }
        
        const planPeriod = String(plan.selectedPeriod || plan.period || '');
        
        // Debug logging for each plan
        const statusRaw = String(plan.status || '');
        const isFetchableStatus = _isPlanReadyForTeacher(statusRaw);
        const matches = 
          isFetchableStatus &&
          planDate === queryDate &&
          planPeriod === String(period) &&
          String(plan.class || '').toLowerCase() === String(className).toLowerCase() &&
          String(plan.subject || '').toLowerCase() === String(subject).toLowerCase();
        
        return matches;
      });
      
      if (matchingPlan) {
        // Get scheme details to include total sessions
        let totalSessions = 1;
        if (matchingPlan.schemeId) {
          try {
            const schemeSheet = _getSheet('Schemes');
            const schemeHeaders = _headers(schemeSheet);
            const schemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
            const planSchemeId = String(matchingPlan.schemeId || '').trim();
            const matchingScheme = schemes.find(scheme => String(scheme.schemeId || '').trim() === planSchemeId);
            
            if (matchingScheme && matchingScheme.noOfSessions) {
              totalSessions = Number(matchingScheme.noOfSessions);
            }
          } catch (schemeError) {
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
        return _respond({
          success: true,
          hasPlannedLesson: false,
          lessonPlan: null
        });
      }
      
    } catch (error) {
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
      
      // PERFORMANCE: Cache with SHORT TTL - reports change during the day
      const cacheKey = 'teacher_reports_' + email + '_' + date;
      return _respond(getCachedData(cacheKey, function() {
        return _fetchTeacherDailyReportsForDate(email, date);
      }, CACHE_TTL.SHORT));
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }
  
  function _fetchTeacherDailyReportsForDate(email, date) {
    if (!email) {
      return { success: false, error: 'Teacher email is required' };
    }
    
    // Get daily reports for this teacher and date
    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
    
    const reports = allReports.filter(report => {
      // Skip invalid reports
      if (!report || !report.date || !report.teacherEmail) {
        return false;
      }
      
      // Use IST helper to normalize report date - handles Date objects, strings, numbers
      const reportDate = _isoDateIST(report.date);
      
      const reportEmail = String(report.teacherEmail || '').toLowerCase().trim();
      const queryDate = _normalizeQueryDate(date);  // Use helper to normalize query date
      const dateMatch = reportDate === queryDate;
      const emailMatch = reportEmail === email;
      
      return dateMatch && emailMatch;
    }).map(report => ({
      ...report,
      status: 'Submitted'  // Add status field so frontend knows this report is submitted
    }));
    return reports;
  }

  /**
  * Handle GET daily reports for HM oversight
  * Returns all daily reports for a specific date with teacher/timetable info
  */
  function _handleGetDailyReportsForDate(params) {
    try {
      const date = params.date || _todayISO();
      const normalizedDate = _isoDateString(date);
      
      // CRITICAL: Parse the date string correctly for IST
      // When client sends "2025-11-24", interpret as IST midnight
      const dayName = _dayName(normalizedDate); // Get the day of week for this date
      
      // Enhanced logging for timezone debugging
      const now = new Date();
      const istNow = Utilities.formatDate(now, _tz_(), 'yyyy-MM-dd HH:mm:ss EEEE');
      const todayISO = _todayISO();
      const todayDayName = _dayName(todayISO);
      
      // Verify date parsing
      const testDate = new Date(date + 'T00:00:00');
      // Get timetable periods for THIS DAY ONLY (WITH substitutions/exchanges applied)
      // IMPORTANT: HM Live Period view should reflect substitutions immediately.
      // So we bypass long-lived timetable caches and use the merged daily timetable.
      const mergedDaily = _fetchDailyTimetableWithSubstitutions(normalizedDate);
      const todayTimetable = Array.isArray(mergedDaily && mergedDaily.timetable) ? mergedDaily.timetable : [];
      
      // Get all daily reports for this date
      const drSh = _getSheet('DailyReports');
      const drHeaders = _headers(drSh);
      const queryDate = _normalizeQueryDate(normalizedDate);  // Use helper to normalize query date once
      const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders))
        .filter(report => {
          if (!report || !report.date) return false;
          
          // Use IST helper to normalize report date - handles Date objects, strings, numbers
          const reportDate = _isoDateIST(report.date);
          
          return reportDate === queryDate;
        });
      
      // Create a map of submitted reports by key (teacherEmail|class|subject|period)
      const reportMap = {};
      allReports.forEach(report => {
        const reportTeacher = String(report.teacherEmail || '').toLowerCase().trim();
        const reportClass = String(report.class || '').trim();
        const reportSubject = String(report.subject || '').trim();
        const reportPeriod = String(report.period || '').trim();
        const key = `${reportTeacher}|${reportClass}|${reportSubject}|${reportPeriod}`;
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
          const key = `${teacherEmail}|${String(tt.class || '').trim()}|${String(tt.subject || '').trim()}|${String(tt.period || '').trim()}`;
          const report = reportMap[key];
          
          result.push({
            teacher: (() => {
              const rawName = tt.teacherName || tt.teacher || teacherEmail;
              const rawStr = String(rawName || '').trim();
              // If name looks like an email, try Users directory for display name
              if (rawStr.includes('@')) {
                const u = _getUserByEmail(rawStr);
                if (u && u.name) return u.name;
              }
              return rawStr;
            })(),
            teacherEmail: teacherEmail,
            class: tt.class || '',
            subject: tt.subject || '',
            period: Number(tt.period || 0),
            // Pass through substitution metadata from merged daily timetable
            isSubstitution: !!tt.isSubstitution,
            originalTeacher: tt.originalTeacher || '',
            originalTeacherName: tt.originalTeacherName || '',
            originalSubject: tt.originalSubject || '',
            substitutionNote: tt.substitutionNote || '',
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
            submittedAt: report ? report.createdAt : null,
            // Include verification status fields if report exists
            id: report ? report.id : '', // Include report ID for verification
            verified: report ? report.verified : '',
            verifiedBy: report ? report.verifiedBy : '',
            verifiedAt: report ? report.verifiedAt : '',
            reopenReason: report ? report.reopenReason : '',
            reopenedBy: report ? report.reopenedBy : '',
            reopenedAt: report ? report.reopenedAt : ''
          });
        });
      });
      
      // Sort by teacher, then period
      result.sort((a, b) => {
        if (a.teacher < b.teacher) return -1;
        if (a.teacher > b.teacher) return 1;
        return a.period - b.period;
      });
      
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
      
      // Get all lesson plans for this date
      const lpSh = _getSheet('LessonPlans');
      const lpHeaders = _headers(lpSh);
      const allRows = _rows(lpSh);
      
      const allLessonPlans = allRows.map(row => _indexByHeader(row, lpHeaders))
        .filter(lp => {
          if (!lp || !lp.selectedDate) return false;
          const lpDate = _isoDateIST(lp.selectedDate);
          return lpDate === normalizedDate;
        });
      
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
          failCount++;
        }
      });
      return _respond({
        success: true,
        message: `Notice sent to ${successCount} recipients`,
        sent: successCount,
        failed: failCount
      });
      
    } catch (error) {
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
      
      // Filter reports for this chapter by this teacher
      const chapterReports = allReports.filter(report => {
        const matchesTeacher = String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
        const matchesChapter = String(report.chapter || '') === String(chapter || '');
        const matchesClass = String(report.class || '') === String(className || '');
        const matchesSubject = String(report.subject || '') === String(subject || '');
        
        return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
      });
      
      // Check previous sessions
      const warnings = [];
      const incompleteSessions = [];
      
      for (let checkSessionNo = 1; checkSessionNo < currentSessionNo; checkSessionNo++) {
        const sessionReport = chapterReports.find(report => 
          Number(report.sessionNo) === checkSessionNo
        );
        
        if (sessionReport) {
          const completion = Number(sessionReport.completionPercentage || 0);
          
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
      
      return _respond({
        success: true,
        hasWarnings: warnings.length > 0,
        warnings: warnings,
        checkedSessions: currentSessionNo - 1,
        incompleteSessions: incompleteSessions
      });
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }
  function _handleGetAppSettings() {
    try {
      // PERFORMANCE: Use cached Settings data
      const settingsData = _getCachedSheetData('Settings').data;
      const settingsKv = _getCachedSettings();

      const _numSetting = (key, defVal) => {
        try {
          const raw = settingsKv && Object.prototype.hasOwnProperty.call(settingsKv, key) ? settingsKv[key] : '';
          const s = String(raw ?? '').trim();
          if (!s) return defVal;
          const n = Number(s);
          return Number.isFinite(n) ? n : defVal;
        } catch (e) {
          return defVal;
        }
      };

      const _boolSetting = (key, defVal) => {
        try {
          const raw = settingsKv && Object.prototype.hasOwnProperty.call(settingsKv, key) ? settingsKv[key] : '';
          const s = String(raw ?? '').trim().toLowerCase();
          if (!s) return defVal;
          if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
          if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
          return defVal;
        } catch (e) {
          return defVal;
        }
      };

      const _stringSetting = (key, defVal) => {
        try {
          const raw = settingsKv && Object.prototype.hasOwnProperty.call(settingsKv, key) ? settingsKv[key] : '';
          const s = String(raw ?? '').trim();
          return s ? s : defVal;
        } catch (e) {
          return defVal;
        }
      };
      
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
        } catch (e) {
        }
      }
      
      if (fridaySetting && fridaySetting.value) {
        try {
          periodTimesFriday = JSON.parse(fridaySetting.value);
        } catch (e) {
        }
      }

      const periodTimesByClassRaw = _stringSetting('periodTimesByClass', '');
      let periodTimesByClass = null;
      if (periodTimesByClassRaw) {
        try {
          periodTimesByClass = JSON.parse(periodTimesByClassRaw);
        } catch (e) {
        }
      }
      
      return _respond({
        success: true,
        periodTimesWeekday: periodTimesWeekday,
        periodTimesFriday: periodTimesFriday,
        periodTimes: periodTimesWeekday,  // Provide default weekday times
        periodTimesByClass: periodTimesByClass,
        periodTimesByClassRaw: periodTimesByClassRaw,

        lessonplanBulkOnly: _boolSetting('lessonplan_bulk_only', false),

        // Reporting and cascade settings
        allowBackfillReporting: _boolSetting('allow_backfill_reporting', false),
        dailyReportDeleteMinutes: _numSetting('DAILY_REPORT_DELETE_MINUTES', 0),
        cascadeAutoEnabled: _boolSetting('cascade_auto_enabled', false),

        // Lesson plan notification settings
        lessonplanNotifyEnabled: _boolSetting('LESSONPLAN_NOTIFY_ENABLED', false),
        lessonplanNotifyRoles: _stringSetting('LESSONPLAN_NOTIFY_ROLES', ''),
        lessonplanNotifyEmails: _stringSetting('LESSONPLAN_NOTIFY_EMAILS', ''),
        lessonplanNotifyEvents: _stringSetting('LESSONPLAN_NOTIFY_EVENTS', ''),

        // Missing Daily Reports (teacher dashboard)
        // These are controlled via Settings sheet (HM-controlled).
        // Range should end at yesterday EOD; frontend enforces to<=yesterday.
        missingDailyReports: {
          lookbackDays: Math.max(1, Math.min(60, _numSetting('MISSING_DAILY_REPORT_LOOKBACK_DAYS', 7))),
          escalationDays: Math.max(0, Math.min(60, _numSetting('MISSING_DAILY_REPORT_ESCALATION_DAYS', 2))),
          maxRangeDays: Math.max(1, Math.min(90, _numSetting('MISSING_DAILY_REPORT_MAX_RANGE_DAYS', 31))),
          allowCustomRange: _boolSetting('MISSING_DAILY_REPORT_ALLOW_CUSTOM_RANGE', true)
        }
      });
      
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  function _handleUpdateAppSettings(data) {
    try {
      const email = String((data && data.email) || '').toLowerCase().trim();
      if (!_isHMOrSuperAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
      }

      let updates = [];
      if (Array.isArray(data && data.settings)) {
        updates = data.settings;
      } else if (Array.isArray(data && data.updates)) {
        updates = data.updates;
      } else if (data && data.key) {
        updates = [{ key: data.key, value: data.value, description: data.description }];
      }

      if (!updates || updates.length === 0) {
        return _respond({ success: false, error: 'No settings provided.' });
      }

      const sh = _getSheet('Settings');
      _ensureHeaders(sh, ['key', 'value', 'description']);
      const headers = _headers(sh);
      const keyIdx = headers.indexOf('key');
      const valueIdx = headers.indexOf('value');
      const descIdx = headers.indexOf('description');

      if (keyIdx < 0 || valueIdx < 0) {
        return _respond({ success: false, error: 'Settings sheet missing required headers.' });
      }

      const rows = _rows(sh);
      const keyToRow = {};
      rows.forEach(function(row, idx) {
        const obj = _indexByHeader(row, headers);
        const k = String(obj.key || '').trim();
        if (k) keyToRow[k] = idx + 2;
      });

      const updated = [];
      const added = [];

      updates.forEach(function(update) {
        const key = String(update && update.key ? update.key : '').trim();
        if (!key) return;
        const value = (update && Object.prototype.hasOwnProperty.call(update, 'value')) ? update.value : '';
        const description = (update && Object.prototype.hasOwnProperty.call(update, 'description')) ? update.description : null;

        if (Object.prototype.hasOwnProperty.call(keyToRow, key)) {
          const rowNumber = keyToRow[key];
          sh.getRange(rowNumber, valueIdx + 1).setValue(value === null || value === undefined ? '' : value);
          if (description !== null && descIdx >= 0) {
            sh.getRange(rowNumber, descIdx + 1).setValue(description === null || description === undefined ? '' : description);
          }
          updated.push(key);
        } else {
          const row = new Array(headers.length).fill('');
          row[keyIdx] = key;
          row[valueIdx] = value === null || value === undefined ? '' : value;
          if (descIdx >= 0 && description !== null) {
            row[descIdx] = description === null || description === undefined ? '' : description;
          }
          sh.appendRow(row);
          added.push(key);
        }
      });

      try {
        logAudit({
          action: AUDIT_ACTIONS.UPDATE,
          entityType: AUDIT_ENTITIES.SETTINGS,
          entityId: 'Settings',
          userEmail: email,
          userName: data.name || email || '',
          userRole: _isSuperAdminSafe(email) ? 'Super Admin' : 'HM',
          afterData: { updated: updated, added: added },
          description: `Updated ${updated.length + added.length} setting(s)`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (_auditErr) { /* ignore audit failures */ }

      return _respond({ success: true, updated: updated, added: added });
    } catch (error) {
      return _respond({ success: false, error: String(error && error.message ? error.message : error) });
    }
  }

  // === ADMIN DATA HELPERS (Super Admin only) ===
  // NOTE: These helpers are used by additive routes (admin.*) and do not change existing behavior.
  function _adminAllowedSheets() {
    try {
      return Object.keys(SHEETS || {});
    } catch (e) {
      return [];
    }
  }

  function _adminAssertAllowedSheet(sheetName) {
    const name = String(sheetName || '').trim();
    if (!name) throw new Error('Missing sheetName');
    const allowed = _adminAllowedSheets();
    if (allowed.indexOf(name) === -1) {
      throw new Error('Sheet not allowed: ' + name);
    }
    return name;
  }

  function _adminListSheets() {
    const allowed = _adminAllowedSheets();
    const ss = _ss();
    const existing = ss.getSheets().map(s => s.getName());
    return {
      success: true,
      sheets: allowed.map(name => ({
        name: name,
        exists: existing.indexOf(name) !== -1
      }))
    };
  }

  function _adminGetSheet(sheetName) {
    try {
      const name = _adminAssertAllowedSheet(sheetName);
      const sh = _getSheet(name);
      // Ensure known schema headers exist (additive only)
      if (SHEETS && SHEETS[name]) {
        _ensureHeaders(sh, SHEETS[name]);
      }

      const headers = _headers(sh);
      const values = sh.getDataRange().getValues();
      const outRows = [];
      for (let i = 1; i < values.length; i++) {
        const rowArr = values[i];
        const rowObj = _indexByHeader(rowArr, headers);
        rowObj.__rowNumber = i + 1; // sheet row number
        outRows.push(rowObj);
      }
      return {
        success: true,
        sheetName: name,
        headers: headers,
        rowCount: outRows.length,
        rows: outRows
      };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }

  function _adminAppendRow(sheetName, row, userEmail, userName) {
    try {
      const name = _adminAssertAllowedSheet(sheetName);
      const sh = _getSheet(name);
      if (SHEETS && SHEETS[name]) {
        _ensureHeaders(sh, SHEETS[name]);
      }
      const headers = _headers(sh);
      const newRow = headers.map(h => {
        const key = String(h || '').trim();
        if (!key) return '';
        const v = row && Object.prototype.hasOwnProperty.call(row, key) ? row[key] : '';
        return v === null || v === undefined ? '' : v;
      });
      sh.appendRow(newRow);
      const newRowNumber = sh.getLastRow();

      try {
        logAudit({
          action: AUDIT_ACTIONS.CREATE,
          entityType: name,
          entityId: `${name}#${newRowNumber}`,
          userEmail: userEmail || '',
          userName: userName || userEmail || '',
          userRole: 'Super Admin',
          afterData: row || {},
          description: `Admin appended row to ${name}`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }

      return { success: true, sheetName: name, rowNumber: newRowNumber };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }

  function _adminUpdateRow(sheetName, rowNumber, row, userEmail, userName) {
    try {
      const name = _adminAssertAllowedSheet(sheetName);
      const rn = Number(rowNumber);
      if (!rn || rn < 2) throw new Error('Invalid rowNumber');
      const sh = _getSheet(name);
      if (SHEETS && SHEETS[name]) {
        _ensureHeaders(sh, SHEETS[name]);
      }
      const headers = _headers(sh);
      const lastRow = sh.getLastRow();
      if (rn > lastRow) throw new Error('rowNumber out of range');

      const beforeArr = sh.getRange(rn, 1, 1, headers.length || 1).getValues()[0];
      const beforeObj = _indexByHeader(beforeArr, headers);

      // Update only known headers; ignore unknown keys
      headers.forEach((h, idx) => {
        const key = String(h || '').trim();
        if (!key) return;
        if (row && Object.prototype.hasOwnProperty.call(row, key)) {
          const v = row[key];
          sh.getRange(rn, idx + 1).setValue(v === null || v === undefined ? '' : v);
        }
      });

      const afterArr = sh.getRange(rn, 1, 1, headers.length || 1).getValues()[0];
      const afterObj = _indexByHeader(afterArr, headers);

      try {
        logAudit({
          action: AUDIT_ACTIONS.UPDATE,
          entityType: name,
          entityId: `${name}#${rn}`,
          userEmail: userEmail || '',
          userName: userName || userEmail || '',
          userRole: 'Super Admin',
          beforeData: beforeObj,
          afterData: afterObj,
          description: `Admin updated row ${rn} in ${name}`,
          severity: AUDIT_SEVERITY.WARNING
        });
      } catch (auditErr) { /* ignore audit failures */ }

      return { success: true, sheetName: name, rowNumber: rn };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }

  function _adminDeleteRow(sheetName, rowNumber, userEmail, userName) {
    try {
      const name = _adminAssertAllowedSheet(sheetName);
      const rn = Number(rowNumber);
      if (!rn || rn < 2) throw new Error('Invalid rowNumber');
      const sh = _getSheet(name);
      const headers = _headers(sh);
      const lastRow = sh.getLastRow();
      if (rn > lastRow) throw new Error('rowNumber out of range');

      const beforeArr = sh.getRange(rn, 1, 1, headers.length || 1).getValues()[0];
      const beforeObj = _indexByHeader(beforeArr, headers);

      sh.deleteRow(rn);

      try {
        logAudit({
          action: AUDIT_ACTIONS.DELETE,
          entityType: name,
          entityId: `${name}#${rn}`,
          userEmail: userEmail || '',
          userName: userName || userEmail || '',
          userRole: 'Super Admin',
          beforeData: beforeObj,
          description: `Admin deleted row ${rn} from ${name}`,
          severity: AUDIT_SEVERITY.CRITICAL
        });
      } catch (auditErr) { /* ignore audit failures */ }

      return { success: true, sheetName: name, rowNumber: rn };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }

  // === SESSION COMPLETION TRACKING HANDLERS ===

  /**
  * Handle session completion update requests
  */
  function _handleUpdateSessionCompletion(data) {
    try {
      const result = updateSessionCompletion(data);
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  // TeacherPerformance dashboard handler removed

  /**
  * Handle scheme completion analytics requests
  */
  function _handleGetSchemeCompletionAnalytics(data) {
    try {
      const schemeId = data.schemeId || '';
      if (!schemeId) {
        return _respond({ success: false, error: 'Scheme ID is required' });
      }
      
      const result = getSchemeCompletionAnalytics(schemeId);
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle session completion history requests
  */
  function _handleGetSessionCompletionHistory(data) {
    try {
      const teacherEmail = data.teacherEmail || '';
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
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle getting all teachers performance (HM only)
  */
  function _handleGetAllTeachersPerformance(data) {
    try {
      // Use the heavy computation version from raw data
      const result = computeAllTeachersPerformanceFromRaw();
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle school session analytics (HM only)
  */
  function _handleGetSchoolSessionAnalytics(data) {
    try {
      const filters = data.filters || {};
      const result = getSchoolSessionAnalytics(filters);
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle cascading issues report (HM only)
  */
  function _handleGetCascadingIssuesReport(data) {
    try {
      const result = getCascadingIssuesReport();
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
    }
  }

  /**
  * Handle batch sync of session dependencies (Admin/HM only)
  */
  function _handleSyncSessionDependencies(data) {
    try {
      const result = syncSessionDependenciesFromReports();
      return _respond(result);
    } catch (error) {
      return _respond({ success: false, error: error.message });
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
          lastSubmitDate: teacher.lastSubmitDate ? Utilities.formatDate(teacher.lastSubmitDate, _tz_(), 'yyyy-MM-dd') : 'Never',
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
      
      return {
        success: true,
        performances: performances,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
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
      return {
        success: false,
        error: error.message,
        dailyMetrics: []
      };
    }
  }

  /**
   * ====== DAILY READINESS STATUS FOR HM ======
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
    // Remove duplicate periods from timetable (same teacher+class+subject+period)
    const uniquePeriods = [];
    const seen = new Set();
    
    scheduledPeriods.forEach(period => {
      const key = `${period.teacherEmail}|${period.class}|${period.subject}|${period.period}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePeriods.push(period);
      } else {
      }
    });
    
    const total = uniquePeriods.length;
    const pendingDetails = [];
    
    let readyCount = 0;
    
    uniquePeriods.forEach(period => {
      const hasPlan = lessonPlans.some(plan => {
        // Normalize values for comparison (trim whitespace, case-insensitive status)
        const emailMatch = String(plan.teacherEmail || '').trim() === String(period.teacherEmail || '').trim();
        const classMatch = String(plan.class || '').trim() === String(period.class || '').trim();
        const subjectMatch = String(plan.subject || '').trim() === String(period.subject || '').trim();
        const periodMatch = String(plan.selectedPeriod || '') === String(period.period || '');
        const statusMatch = ['ready', 'approved'].includes(String(plan.status || '').toLowerCase());
        
        return emailMatch && classMatch && subjectMatch && periodMatch && statusMatch;
      });
      
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
    const byTeacher = _groupPendingByTeacher(pendingDetails);
    
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
    // Remove duplicate periods from timetable (same teacher+class+subject+period)
    const uniquePeriods = [];
    const seen = new Set();
    
    scheduledPeriods.forEach(period => {
      const key = `${period.teacherEmail}|${period.class}|${period.subject}|${period.period}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePeriods.push(period);
      } else {
      }
    });
    
    const total = uniquePeriods.length;
    const pendingDetails = [];
    
    let submittedCount = 0;
    
    uniquePeriods.forEach(period => {
      const hasReport = dailyReports.some(report => {
        // Normalize values for comparison (trim whitespace)
        const emailMatch = String(report.teacherEmail || '').trim() === String(period.teacherEmail || '').trim();
        const classMatch = String(report.class || '').trim() === String(period.class || '').trim();
        const subjectMatch = String(report.subject || '').trim() === String(period.subject || '').trim();
        const periodMatch = String(report.period || '') === String(period.period || '');
        
        return emailMatch && classMatch && subjectMatch && periodMatch;
      });
      
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
    const byTeacher = _groupPendingByTeacher(pendingDetails);
    
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
  function _groupPendingByTeacher(pendingItems) {
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
      const today = new Date();
      
      // Calculate teaching weeks (reserve last 2 weeks for exams)
      const totalWeeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000));
      const teachingWeeks = Math.max(1, totalWeeks - 2);
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
      
      // No additional event tracking - use only ExamsHolidaysEventsStart/End from AcademicCalendar
      const events = [];
      const totalPeriodsLost = 0;
      const usablePeriods = totalPeriods - Math.ceil(totalPeriods * 0.05); // 5% buffer
      const usablePeriodsRemaining = periodsRemaining;
      
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
      const lpSh = _getSheet('LessonPlans');
      const lpHeaders = _headers(lpSh);
      const allPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders));
      
      let currentPlan = allPlans.find(p => String(p.lpId || '').trim() === String(lpId || '').trim());
      if (!currentPlan) {
        // Fallback 1: sometimes lpId stored with surrounding quotes or hidden unicode
        const normalizedLpId = String(lpId || '').replace(/\u200B|\uFEFF/g,'').replace(/^"|"$/g,'').trim();
        currentPlan = allPlans.find(p => String(p.lpId || '').replace(/\u200B|\uFEFF/g,'').replace(/^"|"$/g,'').trim() === normalizedLpId);
      }
      if (!currentPlan) {
        // Fallback 2: match by teacher+date+period via uniqueKey format email|YYYY-MM-DD|period
        if (teacherEmail && originalDate) {
          const dateKey = String(originalDate).split('T')[0];
          const teacherKey = String(teacherEmail).trim().toLowerCase();
          const candidates = allPlans.filter(p => {
            const uk = String(p.uniqueKey || '').trim();
            if (!uk) return false;
            const parts = uk.split('|');
            if (parts.length < 3) return false;
            const [ukEmail, ukDate] = parts;
            return ukDate === dateKey && String(ukEmail).trim().toLowerCase() === teacherKey;
          });
          if (candidates.length === 1) {
            currentPlan = candidates[0];
          } else if (candidates.length > 1) {
            // Prefer matching selectedPeriod if provided via uniqueKey third part
            const periodPart = (String(lpId||'').match(/_(\d+)$/) ? RegExp.$1 : null); // attempt to grab trailing number as period hint
            if (periodPart) {
              const byPeriod = candidates.find(c => String(c.selectedPeriod || c.period || '') === periodPart);
              if (byPeriod) currentPlan = byPeriod;
            }
            if (!currentPlan) currentPlan = candidates[0]; // fallback pick first
          }
          if (!currentPlan && candidates.length) {
            return { success: false, error: 'Lesson plan not found (ambiguous candidates)', candidateLpIds: candidates.map(c => c.lpId) };
          }
        }
      }
      if (!currentPlan) {
        return { success: false, error: 'Lesson plan not found', receivedLpId: lpId };
      }
      
      const { schemeId, chapter, session, class: className, subject } = currentPlan;
      const schemeIdKey = String(schemeId || '').trim().toLowerCase();
      const chapterKey = String(chapter || '').trim().toLowerCase();
      const currentSession = parseInt(session) || 1;
      
      // Normalize related plans by schemeId + chapter (trimmed & lowercased) to avoid type/space mismatches
      const relatedPlans = allPlans.filter(p => {
        const pScheme = String(p.schemeId || p.scheme || '').trim().toLowerCase();
        const pChapter = String(p.chapter || '').trim().toLowerCase();
        return pScheme === schemeIdKey && pChapter === chapterKey;
      });
      
      const totalSessions = relatedPlans.length
        ? Math.max.apply(null, relatedPlans.map(p => parseInt(p.session) || 0))
        : (parseInt(currentSession) || 1);
      
      const remainingSessions = [];
      for (let i = currentSession; i <= totalSessions; i++) {
        const sessionPlan = relatedPlans.find(p => parseInt(p.session) === i);
        
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
      
      // Fallback: if no sessions matched via schemeId+chapter (headers/typing issues),
      // try upcoming plans by same teacher+class+subject from originalDate onwards
      if (remainingSessions.length === 0) {
        try {
          const origIso = originalDate ? String(originalDate).split('T')[0] : null;
          const teacherKey = String(teacherEmail || '').trim().toLowerCase();
          const classKey = String(className || '').trim();
          const subjectKey = String(subject || '').trim();
          const upcoming = allPlans
            .filter(p => String(p.teacherEmail || '').trim().toLowerCase() === teacherKey)
            .filter(p => String(p.class || '').trim() === classKey && String(p.subject || '').trim() === subjectKey)
            .map(p => {
              let d = p.selectedDate;
              if (d instanceof Date) d = _isoDateIST(d);
              else if (typeof d === 'string' && d.indexOf('T') >= 0) d = d.split('T')[0];
              return { ...p, _iso: d };
            })
            .filter(p => !origIso || !p._iso || p._iso >= origIso)
            .sort((a,b) => String(a._iso||'').localeCompare(String(b._iso||'')));
          if (upcoming.length) {
            for (var k=0;k<upcoming.length;k++) {
              remainingSessions.push({
                lpId: upcoming[k].lpId,
                sessionNo: parseInt(upcoming[k].session) || (k+1),
                currentDate: upcoming[k]._iso || '',
                currentPeriod: upcoming[k].selectedPeriod,
                learningObjectives: upcoming[k].learningObjectives || '',
                teachingMethods: upcoming[k].teachingMethods || ''
              });
            }
          }
        } catch (fbErr) {
        }
        if (remainingSessions.length === 0) {
          return {
            success: true,
            needsCascade: false,
            message: 'No sessions found to cascade'
          };
        }
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

      // Build proposed cascade: shift every affected session forward to the NEXT AVAILABLE timetable slot
      // (same day if there is a later period; otherwise next working day), while choosing an available period for class+subject
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
      function _findNextAvailablePeriod(startDateStr, startAfterPeriodOpt) {
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
                if (dStr === startDateStr && startAfterPeriodOpt !== undefined && startAfterPeriodOpt !== null && startAfterPeriodOpt !== '') {
                  const pNum = parseInt(String(per.period).trim(), 10);
                  const afterNum = parseInt(String(startAfterPeriodOpt).trim(), 10);
                  if (!isNaN(pNum) && !isNaN(afterNum) && pNum <= afterNum) continue;
                }
                const key = dStr + '|' + parseInt(String(per.period).trim(),10);
                if (!occupiedSlots.includes(key) && !usedNewSlots.has(key)) {
                  usedNewSlots.add(key);
                  const timing = _getPeriodTiming(per.period, dayName, per.class);
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
        // Base: same date, but after the missed period; if no later periods that day, _findNextAvailablePeriod will roll forward
        const slot = _findNextAvailablePeriod(sess.currentDate, sess.currentPeriod);
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
        mode: 'forward-to-next-slot',
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
      const cascadeId = 'CASCADE_' + Date.now();
      
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
                break;
              }
            }
          }
        }
      } catch (drErr) {
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
        return true;
      }
      const raw = String(flagRow.value).toLowerCase().trim();
      const enabled = ['1','true','yes','on','enabled'].includes(raw);
      return enabled;
    } catch (err) {
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

  /**
  * Compute missing submissions for a date by comparing timetable vs daily reports
  */
  function _computeMissingSubmissionsForDate(date) {
    const dayName = _dayName(date);

    const ttSh = _getSheet('Timetable');
    const ttHeaders = _headers(ttSh);
    const allTimetable = _rows(ttSh).map(row => _indexByHeader(row, ttHeaders));
    const todaysTT = allTimetable.filter(tt => _normalizeDayName(tt.dayOfWeek) === _normalizeDayName(dayName));

    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const queryDate = _normalizeQueryDate(date);
    const reports = _rows(drSh)
      .map(r => _indexByHeader(r, drHeaders))
      .filter(r => _isoDateIST(r.date) === queryDate);

    const submittedKeys = new Set();
    reports.forEach(r => {
      const k = `${String(r.teacherEmail||'').toLowerCase()}|${r.class}|${r.subject}|${r.period}`;
      submittedKeys.add(k);
    });

    const missing = [];
    todaysTT.forEach(tt => {
      const teacherEmail = String(tt.teacherEmail || tt.teacher || '').toLowerCase().trim();
      if (!teacherEmail) return;
      const key = `${teacherEmail}|${tt.class}|${tt.subject}|${tt.period}`;
      if (!submittedKeys.has(key)) {
        missing.push({
          teacher: tt.teacherName || tt.teacher || teacherEmail,
          teacherEmail,
          class: tt.class || '',
          subject: tt.subject || '',
          period: Number(tt.period || 0)
        });
      }
    });

    // Aggregate by teacher
    const byTeacher = {};
    missing.forEach(m => {
      if (!byTeacher[m.teacherEmail]) byTeacher[m.teacherEmail] = { teacher: m.teacher, teacherEmail: m.teacherEmail, count: 0, periods: [] };
      byTeacher[m.teacherEmail].count++;
      byTeacher[m.teacherEmail].periods.push({ class: m.class, subject: m.subject, period: m.period });
    });

    // Sort teacher list by missing count desc
    const byTeacherArr = Object.values(byTeacher).map(t => {
      t.periods.sort((a, b) => (a.period || 0) - (b.period || 0) || String(a.class || '').localeCompare(String(b.class || '')));
      return t;
    }).sort((a, b) => (b.count - a.count) || String(a.teacherEmail).localeCompare(String(b.teacherEmail)));

    return {
      success: true,
      date,
      missing,
      stats: {
        totalPeriods: todaysTT.length,
        missingCount: missing.length,
        teachersImpacted: byTeacherArr.length
      },
      byTeacher: byTeacherArr
    };
  }

  function _handleGetMissingSubmissions(params) {
    try {
      const date = params.date || _todayISO();
      return _respond(_computeMissingSubmissionsForDate(date));
    } catch (err) {
      return _respond({ success: false, error: err && err.message ? err.message : String(err) });
    }
  }

  function _handleGetMissingSubmissionsTeacherwise(params) {
    try {
      const date = (params.date || _todayISO()).trim();
      const requesterEmail = String(params.email || params.requesterEmail || '').toLowerCase().trim();
      if (!_isHMOrSuperAdminSafe(requesterEmail)) {
        return _respond({ success: false, error: 'Permission denied. HM or Super Admin access required.' });
      }
      return _respond(_computeMissingSubmissionsForDate(date));
    } catch (err) {
      return _respond({ success: false, error: err && err.message ? err.message : String(err) });
    }
  }

  function _isoToLocalDate_(iso) {
    const s = String(iso || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    // Use script local timezone date object (no UTC offset surprise).
    return new Date(y, mo - 1, d);
  }

  function _formatIsoIST_(dateObj) {
    try {
      return Utilities.formatDate(dateObj, 'Asia/Kolkata', 'yyyy-MM-dd');
    } catch (e) {
      return '';
    }
  }

  function _listIsoDatesInclusive_(fromIso, toIso) {
    const start = _isoToLocalDate_(fromIso);
    const end = _isoToLocalDate_(toIso);
    if (!start || !end) return [];
    if (start > end) return [];

    const days = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endCopy = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= endCopy) {
      days.push(_formatIsoIST_(cur));
      cur.setDate(cur.getDate() + 1);
      // safety against infinite loops
      if (days.length > 400) break;
    }
    return days.filter(Boolean);
  }

  function _computeMissingSubmissionsForRange(fromDate, toDate, filters) {
    const fromIso = _normalizeQueryDate(fromDate || '');
    const toIso = _normalizeQueryDate(toDate || '');
    if (!fromIso || !toIso) {
      return { success: false, error: 'Missing fromDate/toDate' };
    }

    const days = _listIsoDatesInclusive_(fromIso, toIso);
    if (!days.length) {
      return { success: false, error: 'Invalid date range' };
    }
    if (days.length > 45) {
      return { success: false, error: 'Date range too large (max 45 days). Please narrow the range.' };
    }

    const teacherNeedle = String((filters && filters.teacher) || '').toLowerCase().trim();
    const classNeedle = String((filters && filters.cls) || '').toLowerCase().trim();
    const subjectNeedle = String((filters && filters.subject) || '').toLowerCase().trim();

    const _normKeyPart_ = (v) => {
      return String(v ?? '').trim().replace(/\s+/g, ' ');
    };

    const ttSh = _getSheet('Timetable');
    const ttHeaders = _headers(ttSh);
    const allTimetable = _rows(ttSh).map(function(row) { return _indexByHeader(row, ttHeaders); });

    const drSh = _getSheet('DailyReports');
    const drHeaders = _headers(drSh);
    const allReports = _rows(drSh).map(function(r) { return _indexByHeader(r, drHeaders); });

    // Index submitted keys per date for the requested range.
    const submittedByDate = {};
    for (let i = 0; i < allReports.length; i++) {
      const r = allReports[i];
      const d = _isoDateIST(r.date);
      if (!d) continue;
      if (d < fromIso || d > toIso) continue;
      const teacherEmail = String(r.teacherEmail || '').toLowerCase().trim();
      if (!teacherEmail) continue;
      const key = `${teacherEmail}|${_normKeyPart_(r.class)}|${_normKeyPart_(r.subject)}|${_normKeyPart_(r.period)}`;
      if (!submittedByDate[d]) submittedByDate[d] = {};
      submittedByDate[d][key] = true;
    }

    const missing = [];
    let totalPeriods = 0;

    for (let di = 0; di < days.length; di++) {
      const dateIso = days[di];
      const dayName = _dayName(dateIso);
      const todaysTT = allTimetable.filter(function(tt) {
        return _normalizeDayName(tt.dayOfWeek) === _normalizeDayName(dayName);
      });

      const submittedKeys = submittedByDate[dateIso] || {};

      todaysTT.forEach(function(tt) {
        const tEmail = String(tt.teacherEmail || tt.teacher || '').toLowerCase().trim();
        if (!tEmail) return;

        const teacherName = tt.teacherName || tt.teacher || tEmail;
        const cls = _normKeyPart_(tt.class || '');
        const sub = _normKeyPart_(tt.subject || '');
        const per = _normKeyPart_(tt.period || 0);

        // Filters apply to BOTH total scheduled periods and missing payload.
        if (teacherNeedle) {
          const nm = String(teacherName || '').toLowerCase();
          if (nm.indexOf(teacherNeedle) === -1 && tEmail.indexOf(teacherNeedle) === -1) return;
        }
        if (classNeedle) {
          if (String(cls || '').toLowerCase().trim() !== classNeedle) return;
        }
        if (subjectNeedle) {
          if (String(sub || '').toLowerCase().trim() !== subjectNeedle) return;
        }

        totalPeriods += 1;

        const key = `${tEmail}|${cls}|${sub}|${per}`;
        if (submittedKeys[key]) return;

        missing.push({
          date: dateIso,
          teacher: teacherName,
          teacherEmail: tEmail,
          class: cls,
          subject: sub,
          period: Number(per || 0)
        });
      });
    }

    // Aggregate by teacher
    const byTeacher = {};
    missing.forEach(function(m) {
      if (!byTeacher[m.teacherEmail]) {
        byTeacher[m.teacherEmail] = { teacher: m.teacher, teacherEmail: m.teacherEmail, count: 0, periods: [] };
      }
      byTeacher[m.teacherEmail].count++;
      byTeacher[m.teacherEmail].periods.push({ date: m.date, class: m.class, subject: m.subject, period: m.period });
    });

    const byTeacherArr = Object.values(byTeacher).map(function(t) {
      t.periods.sort(function(a, b) {
        return String(a.date || '').localeCompare(String(b.date || '')) || (a.period || 0) - (b.period || 0) || String(a.class || '').localeCompare(String(b.class || ''));
      });
      return t;
    }).sort(function(a, b) {
      return (b.count - a.count) || String(a.teacherEmail).localeCompare(String(b.teacherEmail));
    });

    return {
      success: true,
      fromDate: fromIso,
      toDate: toIso,
      days: days,
      missing: missing,
      stats: {
        totalPeriods: totalPeriods,
        missingCount: missing.length,
        teachersImpacted: byTeacherArr.length
      },
      byTeacher: byTeacherArr
    };
  }

  function _handleGetMissingSubmissionsTeacherwiseRange(params) {
    try {
      const fromDate = String(params.fromDate || params.date || _todayISO()).trim();
      const toDate = String(params.toDate || params.date || fromDate).trim();
      const requesterEmail = String(params.email || params.requesterEmail || '').toLowerCase().trim();
      if (!_isHMOrSuperAdminSafe(requesterEmail)) {
        return _respond({ success: false, error: 'Permission denied. HM, Admin, or Super Admin access required.' });
      }
      const teacher = String(params.teacher || '').trim();
      const cls = String(params.class || '').trim();
      const subject = String(params.subject || '').trim();
      const out = _computeMissingSubmissionsForRange(fromDate, toDate, { teacher: teacher, cls: cls, subject: subject });
      return _respond(out);
    } catch (err) {
      return _respond({ success: false, error: err && err.message ? err.message : String(err) });
    }
  }

  /**
  * Send reminder emails for missing submissions on a date (HM only)
  */
  function _handleNotifyMissingSubmissions(params) {
    try {
      const date = params.date || _todayISO();
      const requesterEmail = (params.requesterEmail || '').toLowerCase().trim();
      var isHM = false;
      try {
        isHM = userHasRole(requesterEmail, 'hm') || userHasRole(requesterEmail, 'headmaster');
      } catch (e) { /* ignore */ }
      if (!isHM) return { success: false, error: 'Not authorized' };

      // Compute missing submissions (inline to avoid response parsing)
      const dayName = _dayName(date);
      const ttSh = _getSheet('Timetable');
      const ttHeaders = _headers(ttSh);
      const allTimetable = _rows(ttSh).map(row => _indexByHeader(row, ttHeaders));
      const todaysTT = allTimetable.filter(tt => _normalizeDayName(tt.dayOfWeek) === _normalizeDayName(dayName));

      const drSh = _getSheet('DailyReports');
      const drHeaders = _headers(drSh);
      const queryDate = _normalizeQueryDate(date);
      const reports = _rows(drSh).map(r => _indexByHeader(r, drHeaders)).filter(r => _isoDateIST(r.date) === queryDate);

      const submittedKeys = new Set();
      reports.forEach(r => {
        const k = `${String(r.teacherEmail||'').toLowerCase()}|${r.class}|${r.subject}|${r.period}`;
        submittedKeys.add(k);
      });
      const byTeacherMap = {};
      todaysTT.forEach(tt => {
        const teacherEmail = String(tt.teacherEmail || tt.teacher || '').toLowerCase().trim();
        if (!teacherEmail) return;
        const key = `${teacherEmail}|${tt.class}|${tt.subject}|${tt.period}`;
        if (!submittedKeys.has(key)) {
          if (!byTeacherMap[teacherEmail]) byTeacherMap[teacherEmail] = { teacher: tt.teacherName || tt.teacher || teacherEmail, teacherEmail, periods: [] };
          byTeacherMap[teacherEmail].periods.push({ class: tt.class || '', subject: tt.subject || '', period: Number(tt.period || 0) });
        }
      });
      const byTeacher = Object.values(byTeacherMap);
      let success = 0, failed = 0;
      byTeacher.forEach(t => {
        const to = t.teacherEmail;
        if (!to) return;
        const subject = `Reminder: Daily Report Pending for ${date}`;
        const lines = t.periods.map(p => `- Period ${p.period}: ${p.class} ${p.subject}`);
        const body = `Dear ${t.teacher || to},\n\nOur records show your daily report is pending for ${date} for the following periods:\n\n${lines.join('\n')}\n\nPlease submit at the earliest.\n\nRegards,\nSchool Administration`;
        const res = sendEmailNotification(to, subject, body);
        if (res && res.success) success++; else failed++;
      });
      return { success: true, notified: success, failed };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // ===== Handlers: Chapter Completion =====
  function _handleCheckChapterCompletion(params) {
    try {
      var teacherEmail = (params.teacherEmail || params.email || '').toLowerCase().trim();
      var cls = params.class || '';
      var subject = params.subject || '';
      var chapter = params.chapter || '';
      var schemeId = params.schemeId || '';
      var date = params.date || '';
      return _respond(checkChapterCompletion({ teacherEmail: teacherEmail, class: cls, subject: subject, chapter: chapter, schemeId: schemeId, date: date }));
    } catch (err) {
      return _respond({ success: false, error: err && err.message ? err.message : String(err) });
    }
  }

  function _handleApplyChapterCompletionAction(params) {
    try {
      var requesterEmail = (params.requesterEmail || params.email || '').toLowerCase().trim();
      var action = params.action || '';
      var ids = params.lessonPlanIds || params.ids || [];
      if (!Array.isArray(ids)) ids = [];
      // Optional: basic permission hint (teachers can act on their own; HM unrestricted)
      // For now, rely on data-layer safety checks.
      var res = applyChapterCompletionAction({ action: action, lessonPlanIds: ids, requesterEmail: requesterEmail });
      return _respond(res);
    } catch (err) {
      return _respond({ success: false, error: err && err.message ? err.message : String(err) });
    }
  }

  /**
   * HM Daily Oversight merged view for a given date
   * Combines: Timetable (with substitutions) + LessonPlans + DailyReports
   * Returns { success, date, periods: [...], summary: {...} }
   */
  function _handleGetHMDailyOversightData(params) {
    try {
      _bootstrapSheets();

      const targetDate = params && params.date ? _normalizeQueryDate(params.date) : _todayISO();
      const dayName = _dayNameIST(targetDate);

      const timetableData = _readSheet('Timetable');
      const scheduledPeriods = timetableData.filter(row => row.dayOfWeek && String(row.dayOfWeek).toLowerCase() === String(dayName).toLowerCase());

      const substitutionsData = _readSheet('Substitutions');
      const todaysSubstitutions = substitutionsData.filter(row => _isoDateIST(row.date) === targetDate);

      const finalSchedule = scheduledPeriods.map(period => {
        const substitution = todaysSubstitutions.find(sub =>
          String(sub.period) === String(period.period) &&
          String(sub.class) === String(period.class) &&
          String(sub.absentTeacher) === String(period.teacherEmail)
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

      const lessonPlansData = _readSheet('LessonPlans')
        .filter(row => _isoDateIST(row.selectedDate) === targetDate && row.status !== 'cancelled');
      const dailyReportsData = _readSheet('DailyReports')
        .filter(row => _isoDateIST(row.date) === targetDate);

      function getPlanStatus(p) {
        const found = lessonPlansData.find(lp =>
          String(lp.teacherEmail || '').toLowerCase() === String(p.teacherEmail || '').toLowerCase() &&
          String(lp.class || '') === String(p.class || '') &&
          String(lp.subject || '') === String(p.subject || '') &&
          String(lp.selectedPeriod || lp.period || '') === String(p.period || '')
        );
        return found ? (found.status || '') : '';
      }

      function getMatchingReport(p) {
        return dailyReportsData.find(r =>
          String(r.teacherEmail || '').toLowerCase() === String(p.teacherEmail || '').toLowerCase() &&
          String(r.class || '') === String(p.class || '') &&
          String(r.subject || '') === String(p.subject || '') &&
          String(r.period || '') === String(p.period || '')
        );
      }

      const periods = finalSchedule.map(p => {
        const planStatus = getPlanStatus(p);
        const hasPlan = (String(planStatus).toLowerCase() === 'ready' || String(planStatus).toLowerCase() === 'approved');
        const report = getMatchingReport(p) || {};
        const hasReport = !!report && typeof report === 'object' && (report.submitted || report.completionPercentage !== undefined || report.chapter);
        const verified = String(report.verified || report.Verified || '').toLowerCase() === 'true';
        const completion = Number(report.completionPercentage) || 0;

        return {
          date: targetDate,
          dayName: dayName,
          class: p.class,
          subject: p.subject,
          period: p.period,
          teacherEmail: p.teacherEmail,
          teacherName: p.teacherName || p.teacher || '',
          isSubstitution: !!p.isSubstitution,
          hasPlan: hasPlan,
          planStatus: planStatus || '',
          hasReport: hasReport,
          completionPercentage: completion,
          verified: verified,
          difficulties: report.difficulties || '',
          nextSessionPlan: report.nextSessionPlan || '',
          unplanned: hasReport && !hasPlan
        };
      });

      const summary = {
        total: periods.length,
        plannedReady: periods.filter(x => x.hasPlan).length,
        reported: periods.filter(x => x.hasReport).length,
        unplannedCount: periods.filter(x => x.unplanned).length,
        avgCompletion: (function(){
          const comps = periods.filter(x => x.hasReport).map(x => Number(x.completionPercentage) || 0);
          return comps.length ? Math.round(comps.reduce((a,b)=>a+b,0)/comps.length) : 0;
        })()
      };

      return { success: true, date: targetDate, periods: periods, summary: summary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
  * Handle GET next available period for class/subject
  */
  function _handleGetNextAvailablePeriod(params) {
    try {
      const teacherEmail = (params.teacherEmail || '').trim();
      const schemeClass = (params.class || '').trim();
      const schemeSubject = (params.subject || '').trim();
      const fromDate = (params.fromDate || params.startDate || '').trim();

      if (!teacherEmail) return _respond({ success: false, error: 'Teacher email is required' });
      if (!schemeClass || !schemeSubject) return _respond({ success: false, error: 'Class and subject are required' });

      const result = getNextAvailablePeriodForLessonPlan(teacherEmail, schemeClass, schemeSubject, fromDate);
      return _respond(result);
    } catch (error) {
      console.error('Error handling next available period request:', error);
      return _respond({ success: false, error: error.message });
    }
  }

  /**
   * Chapter-scoped bulk update of lesson plan statuses (HM only)
   * Accepts: { schemeId, chapter, status, reviewComments?, requesterEmail? }
   * - Only updates lessons in the specified scheme+chapter currently in 'Pending Review'
   * - For status 'Ready', enforces chapter completeness via _checkChapterSessionsComplete
   * - For 'Needs Rework' or 'Rejected', requires reviewComments/remarks
   * Returns: { success, updated, skipped, totalTargeted, lpIdsUpdated:[], missing?:[], error? }
   */
  function _handleChapterBulkUpdateLessonPlanStatus(data) {
    var lock = LockService.getScriptLock();
    try {
      const schemeId = String(data.schemeId || '').trim();
      const chapter = String(data.chapter || '').trim();
      const targetStatus = String(data.status || '').trim();
      const comments = String(data.reviewComments || data.remarks || '').trim();
      const requesterEmail = String(data.requesterEmail || '').trim().toLowerCase();

      if (!schemeId || !chapter || !targetStatus) {
        return _respond({ success: false, error: 'Missing required fields (schemeId, chapter, status)' });
      }

      const allowedStatuses = ['Ready','Needs Rework','Rejected'];
      if (allowedStatuses.indexOf(targetStatus) === -1) {
        return _respond({ success: false, error: 'Invalid target status' });
      }

      // ROLE CHECK: Only HM or Super Admin can perform bulk approvals
      if (targetStatus === 'Ready') {
        if (!requesterEmail) {
          return _respond({ success: false, error: 'Authorization required: User email must be provided for approval' });
        }
        
        const isAuthorized = _isHMOrSuperAdminSafe(requesterEmail);
        if (!isAuthorized) {
          return _respond({ success: false, error: 'Unauthorized: Only Headmaster or Super Admin can approve lesson plans' });
        }
      }

      // For approval to Ready, require completeness of chapter
      if (targetStatus === 'Ready') {
        try {
          const completeness = _checkChapterSessionsComplete(schemeId, chapter);
          if (!completeness || completeness.complete === false) {
            return _respond({
              success: false,
              error: `Cannot approve all. Chapter incomplete. Missing sessions: ${(completeness && completeness.missing || []).join(', ')}`,
              incomplete: true,
              missing: completeness && completeness.missing,
              total: completeness && completeness.total,
              submitted: completeness && completeness.submitted
            });
          }
        } catch (eComp) {
          return _respond({ success: false, error: 'Approval blocked: failed to verify chapter completeness' });
        }
      }

      // For Rework/Rejected, require comments to guide teachers
      if ((targetStatus === 'Needs Rework' || targetStatus === 'Rejected') && !comments) {
        return _respond({ success: false, error: 'Remarks are required for rework/rejection' });
      }

      lock.waitLock(10000);

      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const rows = _rows(sh);
      const plans = rows.map(r => _indexByHeader(r, headers));

      // Identify target rows: matching scheme + chapter + Pending Review
      const targets = [];
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (String(p.schemeId || '').trim() === schemeId &&
            String(p.chapter || '').trim().toLowerCase() === chapter.toLowerCase() &&
            String(p.status || '').trim() === 'Pending Review') {
          targets.push({ idx: i, plan: p });
        }
      }

      if (targets.length === 0) {
        return _respond({ success: true, updated: 0, skipped: 0, totalTargeted: 0, lpIdsUpdated: [] });
      }

      // Column indices (1-based)
      const normH = headers.map(h => String(h).trim());
      let statusColIdx = normH.findIndex(h => h === 'status');
      if (statusColIdx === -1) statusColIdx = normH.findIndex(h => h.toLowerCase() === 'status');
      if (statusColIdx === -1) return _respond({ success: false, error: 'Status column not found' });
      statusColIdx += 1;

      let commentsIdx = normH.findIndex(h => h === 'reviewComments');
      if (commentsIdx === -1) commentsIdx = normH.findIndex(h => h.toLowerCase() === 'reviewcomments');
      commentsIdx = commentsIdx >= 0 ? (commentsIdx + 1) : -1;

      let reviewedAtIdx = normH.findIndex(h => h === 'reviewedAt');
      if (reviewedAtIdx === -1) reviewedAtIdx = normH.findIndex(h => h.toLowerCase() === 'reviewedat');
      reviewedAtIdx = reviewedAtIdx >= 0 ? (reviewedAtIdx + 1) : -1;

      const nowISO = new Date().toISOString();
      let updated = 0;
      const updatedIds = [];
      for (let t of targets) {
        const rowIndex = t.idx + 2; // header + 0-based
        try {
          sh.getRange(rowIndex, statusColIdx).setValue(targetStatus);
          if (commentsIdx > 0 && comments) {
            sh.getRange(rowIndex, commentsIdx).setValue(comments);
          }
          if (reviewedAtIdx > 0) {
            sh.getRange(rowIndex, reviewedAtIdx).setValue(nowISO);
          }
          updated += 1;
          updatedIds.push(String(t.plan.lpId || ''));
        } catch (wErr) {
        }
      }

      return _respond({ success: true, updated: updated, skipped: (targets.length - updated), totalTargeted: targets.length, lpIdsUpdated: updatedIds });
    } catch (error) {
      return _respond({ success: false, error: error && error.message });
    } finally {
      try { lock.releaseLock(); } catch (e) {}
    }
  }

  /**
  * Group lesson plans by chapter (schemeId+chapter preferred; fallback class+subject+chapter)
  * Supports same filters as pending list plus optional dateFrom/dateTo (IST YYYY-MM-DD)
  */
  function _handleGetLessonPlansByChapter(params) {
    try {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const allLessonPlans = _rows(sh).map(r => _indexByHeader(r, headers));

      // Normalize selectedDate/selectedPeriod similar to pending handler
      const normalized = allLessonPlans.map(function(plan){
        var selectedDateVal = plan.selectedDate || plan.date || '';
        if (!selectedDateVal && plan.uniqueKey) {
          try { var parts = String(plan.uniqueKey).split('|'); if (parts.length>=2) selectedDateVal = parts[1]; } catch(e) {}
        }
        try {
          if (selectedDateVal instanceof Date) {
            plan.selectedDate = _isoDateIST(selectedDateVal);
          } else if (typeof selectedDateVal === 'string' && selectedDateVal.indexOf('T') >= 0) {
            plan.selectedDate = selectedDateVal.split('T')[0];
          } else {
            plan.selectedDate = _isoDateIST(selectedDateVal) || plan.selectedDate || '';
          }
        } catch (e) {}
        plan.selectedPeriod = plan.selectedPeriod || plan.period || '';
        return plan;
      });

      // Apply filters (same rules as _handleGetPendingLessonPlans)
      var filtered = normalized;
      var hasStatusParam = Object.prototype.hasOwnProperty.call(params, 'status');
      if (!hasStatusParam) {
        filtered = filtered.filter(function(p){ return String(p.status || '') === 'Pending Review'; });
      } else if (params.status && params.status !== 'All') {
        filtered = filtered.filter(function(p){ return String(p.status || '') === params.status; });
      }
      if (params.teacher && params.teacher !== '') {
        const t = String(params.teacher).toLowerCase();
        filtered = filtered.filter(p => String(p.teacherName||'').toLowerCase().includes(t) || String(p.teacherEmail||'').toLowerCase().includes(t));
      }
      if (params.class && params.class !== '') {
        filtered = filtered.filter(p => String(p.class||'').toLowerCase() === String(params.class).toLowerCase());
      }
      if (params.subject && params.subject !== '') {
        filtered = filtered.filter(p => String(p.subject||'').toLowerCase() === String(params.subject).toLowerCase());
      }
      // Optional date range filtering
      var from = String(params.dateFrom || '').trim();
      var to = String(params.dateTo || '').trim();
      if (from || to) {
        var single = from && to && from === to;
        filtered = filtered.filter(function(p){
          var ds = _isoDateIST(p.selectedDate || p.plannedDate || p.date || '');
          if (!ds) return false;
          if (single) return ds === from;
          if (from && ds < from) return false;
          if (to && ds > to) return false;
          return true;
        });
      }

      // Enrich with noOfSessions from Schemes
      const schemesSheet = _getSheet('Schemes');
      const schemesHeaders = _headers(schemesSheet);
      const allSchemes = _rows(schemesSheet).map(r => _indexByHeader(r, schemesHeaders));
      const bySchemeId = {};
      allSchemes.forEach(function(s){ if (s && s.schemeId) bySchemeId[s.schemeId] = s; });
      filtered = filtered.map(function(p){
        if (p.schemeId && bySchemeId[p.schemeId] && bySchemeId[p.schemeId].noOfSessions) {
          p.noOfSessions = bySchemeId[p.schemeId].noOfSessions;
        }
        return p;
      });

      // Group by schemeId+chapter, else class+subject+chapter
      const map = {};
      filtered.forEach(function(p){
        var key = (p.schemeId ? (p.schemeId + '|') : (String(p.class||'') + '|' + String(p.subject||'') + '|')) + String(p.chapter||'');
        if (!map[key]) {
          map[key] = {
            key: key,
            schemeId: p.schemeId || '',
            class: p.class,
            subject: p.subject,
            chapter: p.chapter,
            teacherName: p.teacherName,
            counts: { pending: 0, ready: 0, rework: 0, rejected: 0 },
            lessons: []
          };
        }
        var grp = map[key];
        var st = String(p.status||'');
        if (st === 'Pending Review') grp.counts.pending++;
        else if (st === 'Ready') grp.counts.ready++;
        else if (st === 'Needs Rework') grp.counts.rework++;
        else if (st === 'Rejected') grp.counts.rejected++;
        grp.lessons.push(p);
      });
      var groups = Object.keys(map).map(function(k){ return map[k]; });
      // Sort by class, then subject, then chapter
      groups.sort(function(a,b){
        var c = String(a.class||'').localeCompare(String(b.class||'')); if (c) return c;
        var s = String(a.subject||'').localeCompare(String(b.subject||'')); if (s) return s;
        return String(a.chapter||'').localeCompare(String(b.chapter||''));
      });

      return _respond({ total: filtered.length, groupCount: groups.length, groups: groups });
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
  * Group lesson plans by class, then subject+chapter subgroups
  */
  function _handleGetLessonPlansByClass(params) {
    try {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const allLessonPlans = _rows(sh).map(r => _indexByHeader(r, headers));

      // Normalize
      const normalized = allLessonPlans.map(function(plan){
        var selectedDateVal = plan.selectedDate || plan.date || '';
        if (!selectedDateVal && plan.uniqueKey) {
          try { var parts = String(plan.uniqueKey).split('|'); if (parts.length>=2) selectedDateVal = parts[1]; } catch(e) {}
        }
        try {
          if (selectedDateVal instanceof Date) plan.selectedDate = _isoDateIST(selectedDateVal);
          else if (typeof selectedDateVal === 'string' && selectedDateVal.indexOf('T')>=0) plan.selectedDate = selectedDateVal.split('T')[0];
          else plan.selectedDate = _isoDateIST(selectedDateVal) || plan.selectedDate || '';
        } catch(e) {}
        plan.selectedPeriod = plan.selectedPeriod || plan.period || '';
        return plan;
      });

      // Filters
      var filtered = normalized;
      var hasStatusParam = Object.prototype.hasOwnProperty.call(params, 'status');
      if (!hasStatusParam) filtered = filtered.filter(function(p){ return String(p.status||'') === 'Pending Review'; });
      else if (params.status && params.status !== 'All') filtered = filtered.filter(function(p){ return String(p.status||'') === params.status; });
      if (params.teacher && params.teacher !== '') {
        const t = String(params.teacher).toLowerCase();
        filtered = filtered.filter(p => String(p.teacherName||'').toLowerCase().includes(t) || String(p.teacherEmail||'').toLowerCase().includes(t));
      }
      if (params.class && params.class !== '') filtered = filtered.filter(p => String(p.class||'').toLowerCase() === String(params.class).toLowerCase());
      if (params.subject && params.subject !== '') filtered = filtered.filter(p => String(p.subject||'').toLowerCase() === String(params.subject).toLowerCase());
      var from = String(params.dateFrom || '').trim();
      var to = String(params.dateTo || '').trim();
      if (from || to) {
        var single = from && to && from === to;
        filtered = filtered.filter(function(p){
          var ds = _isoDateIST(p.selectedDate || p.plannedDate || p.date || '');
          if (!ds) return false;
          if (single) return ds === from;
          if (from && ds < from) return false;
          if (to && ds > to) return false;
          return true;
        });
      }

      // Enrich noOfSessions
      const schemesSheet = _getSheet('Schemes');
      const schemesHeaders = _headers(schemesSheet);
      const allSchemes = _rows(schemesSheet).map(r => _indexByHeader(r, schemesHeaders));
      const bySchemeId = {};
      allSchemes.forEach(function(s){ if (s && s.schemeId) bySchemeId[s.schemeId] = s; });
      filtered = filtered.map(function(p){
        if (p.schemeId && bySchemeId[p.schemeId] && bySchemeId[p.schemeId].noOfSessions) p.noOfSessions = bySchemeId[p.schemeId].noOfSessions;
        return p;
      });

      // Build class-wise groups with subject+chapter subgroups
      const classMap = {};
      filtered.forEach(function(p){
        var cls = String(p.class||'Unknown');
        if (!classMap[cls]) classMap[cls] = { class: cls, counts: { pending:0, ready:0, rework:0, rejected:0 }, subgroups: {} };
        var root = classMap[cls];
        var st = String(p.status||'');
        if (st==='Pending Review') root.counts.pending++; else if (st==='Ready') root.counts.ready++; else if (st==='Needs Rework') root.counts.rework++; else if (st==='Rejected') root.counts.rejected++;
        var subKey = String(p.subject||'') + '|' + String(p.chapter||'');
        if (!root.subgroups[subKey]) root.subgroups[subKey] = { key: subKey, subject: p.subject, chapter: p.chapter, teacherName: p.teacherName, counts: { pending:0, ready:0, rework:0, rejected:0 }, lessons: [] };
        var sg = root.subgroups[subKey];
        if (st==='Pending Review') sg.counts.pending++; else if (st==='Ready') sg.counts.ready++; else if (st==='Needs Rework') sg.counts.rework++; else if (st==='Rejected') sg.counts.rejected++;
        sg.lessons.push(p);
      });
      var groups = Object.keys(classMap).sort(function(a,b){ return String(a).localeCompare(String(b)); }).map(function(cls){
        var entry = classMap[cls];
        var subs = Object.keys(entry.subgroups).sort(function(a,b){ return String(a).localeCompare(String(b)); }).map(function(k){ return entry.subgroups[k]; });
        return { class: entry.class, counts: entry.counts, subgroups: subs };
      });

      return _respond({ total: filtered.length, classGroupCount: groups.length, groups: groups });
    } catch (error) {
      return _respond({ error: error.message });
    }
  }

  /**
   * Get missing lesson plans for a specific teacher
   * Compares teacher's timetable against existing lesson plans for upcoming periods
   * @param {string} teacherEmail - Teacher's email
   * @param {number} daysAhead - Number of days to look ahead (default: 7)
   * @returns {Object} - List of periods without lesson plans
   */
  function getMissingLessonPlans(teacherEmail, daysAhead = 7) {
    const cacheKey = generateCacheKey('missing_plans', { email: teacherEmail, days: daysAhead });
    return getCachedData(cacheKey, function() {
      return _fetchMissingLessonPlans(teacherEmail, daysAhead);
    }, CACHE_TTL.SHORT);
  }

  function _fetchMissingLessonPlans(teacherEmail, daysAhead) {
    try {
      // Get teacher's timetable
      const timetableSheet = _getSheet('Timetable');
      const timetableHeaders = _headers(timetableSheet);
      const timetableData = _rows(timetableSheet).map(row => _indexByHeader(row, timetableHeaders));
      
      const teacherTimetable = timetableData.filter(slot =>
        String(slot.teacherEmail || '').toLowerCase() === String(teacherEmail).toLowerCase()
      );
      
      if (teacherTimetable.length === 0) {
        return {
          success: true,
          missingCount: 0,
          missing: [],
          message: 'No timetable entries found for this teacher'
        };
      }
      
      // Get holidays from Academic Calendar
      const calendarSheet = _getSheet('AcademicCalendar');
      const calendarHeaders = _headers(calendarSheet);
      const calendarData = _rows(calendarSheet).map(row => _indexByHeader(row, calendarHeaders));
      
      const holidays = calendarData
        .filter(row => String(row.type || '').toLowerCase() === 'holiday')
        .map(row => _isoDateIST(row.date));
      
      // Generate list of NEXT N SCHOOL DAYS (not calendar days)
      const schoolDays = [];
      let currentDate = new Date();
      let schoolDaysCount = 0;
      
      // Keep looping until we have N school days
      while (schoolDaysCount < daysAhead) {
        const dayName = _dayNameIST(currentDate);
        const dateISO = _isoDateIST(currentDate);
        
        // Include only weekdays that are not holidays
        if (dayName !== 'Saturday' && dayName !== 'Sunday' && !holidays.includes(dateISO)) {
          schoolDays.push({ date: dateISO, dayName: dayName });
          schoolDaysCount++;
        }
        
        // Move to next day
        currentDate = new Date(currentDate.getTime() + (24 * 60 * 60 * 1000));
        
        // Safety check: don't loop more than 60 days
        if (schoolDays.length === 0 && currentDate > new Date(Date.now() + (60 * 24 * 60 * 60 * 1000))) {
          break;
        }
      }
      
      const today = new Date();
      const startDate = schoolDays.length > 0 ? schoolDays[0].date : _todayISO();
      const endDateISO = schoolDays.length > 0 ? schoolDays[schoolDays.length - 1].date : _todayISO();
      
      // Get existing lesson plans
      const lessonPlansSheet = _getSheet('LessonPlans');
      const lessonPlansHeaders = _headers(lessonPlansSheet);
      const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
      
      // Get substitutions to exclude substituted periods
      const substitutionsSheet = _getSheet('Substitutions');
      const substitutionsHeaders = _headers(substitutionsSheet);
      const substitutions = _rows(substitutionsSheet).map(row => _indexByHeader(row, substitutionsHeaders));
      
      // Find missing lesson plans
      const missing = [];
      schoolDays.forEach(day => {
        // Get periods for this teacher on this day
        const dayPeriods = teacherTimetable.filter(slot =>
          String(slot.dayOfWeek || slot.day || '').toLowerCase() === day.dayName.toLowerCase()
        );
        dayPeriods.forEach(period => {
          // Check if period is substituted (teacher is absent)
          const isSubstituted = substitutions.some(sub => 
            _isoDateIST(sub.date) === day.date &&
            String(sub.period || '') === String(period.period || '') &&
            String(sub.absentTeacher || '').toLowerCase() === String(teacherEmail).toLowerCase()
          );
          
          if (isSubstituted) {
            return; // Skip substituted periods
          }
          
          // Check if lesson plan exists
          const hasLessonPlan = existingPlans.some(plan =>
            String(plan.teacherEmail || '').toLowerCase() === String(teacherEmail).toLowerCase() &&
            _isoDateIST(plan.selectedDate) === day.date &&
            String(plan.selectedPeriod || '') === String(period.period || '') &&
            String(plan.class || '').toLowerCase() === String(period.class || '').toLowerCase() &&
            String(plan.subject || '').toLowerCase() === String(period.subject || '').toLowerCase()
          );
          if (!hasLessonPlan) {
            // Calculate urgency (days until period)
            const daysUntil = Math.ceil((new Date(day.date) - today) / (1000 * 60 * 60 * 24));
            let urgency = 'low';
            if (daysUntil <= 1) urgency = 'critical';
            else if (daysUntil <= 3) urgency = 'high';
            else if (daysUntil <= 5) urgency = 'medium';
            
            missing.push({
              date: day.date,
              day: day.dayName,
              period: period.period,
              class: period.class,
              subject: period.subject,
              daysUntil: daysUntil,
              urgency: urgency
            });
          }
        });
      });
      
      // Sort by date and period
      missing.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.period).localeCompare(String(b.period));
      });
      
      return {
        success: true,
        teacherEmail: teacherEmail,
        dateRange: { start: startDate, end: endDateISO },
        missingCount: missing.length,
        missing: missing,
        byCriticality: {
          critical: missing.filter(m => m.urgency === 'critical').length,
          high: missing.filter(m => m.urgency === 'high').length,
          medium: missing.filter(m => m.urgency === 'medium').length,
          low: missing.filter(m => m.urgency === 'low').length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get daily reports with filtering support (for HM "All Reports" view)
   * @param {string} teacher - Teacher email or name filter (partial match)
   * @param {string} fromDate - Start date filter (YYYY-MM-DD)
   * @param {string} toDate - End date filter (YYYY-MM-DD)
   * @param {string} cls - Class filter (exact match)
   * @param {string} subject - Subject filter (partial match)
   * @param {string} chapter - Chapter filter (partial match)
   * @returns {Array} - Filtered daily reports
   */
  function getDailyReports(teacher = '', fromDate = '', toDate = '', cls = '', subject = '', chapter = '') {
    // Cache daily reports for 1 minute
    const cacheKey = generateCacheKey('daily_reports', {
      teacher: teacher,
      fromDate: fromDate,
      toDate: toDate,
      class: cls,
      subject: subject,
      chapter: chapter
    });
    
    return getCachedData(cacheKey, function() {
      return _fetchDailyReports(teacher, fromDate, toDate, cls, subject, chapter);
    }, CACHE_TTL.SHORT);
  }
  
  function _fetchDailyReports(teacher = '', fromDate = '', toDate = '', cls = '', subject = '', chapter = '') {
    try {
      const drSh = _getSheet('DailyReports');
      const headers = _headers(drSh);
      const allReports = _rows(drSh).map(row => _indexByHeader(row, headers));
      
      // Apply filters
      let filtered = allReports.filter(report => {
        if (!report) return false;
        
        // Teacher filter (email or name, case-insensitive partial match)
        if (teacher) {
          const teacherLower = teacher.toLowerCase().trim();
          const emailMatch = String(report.teacherEmail || '').toLowerCase().includes(teacherLower);
          const nameMatch = String(report.teacherName || '').toLowerCase().includes(teacherLower);
          if (!emailMatch && !nameMatch) return false;
        }
        
        // Date range filter
        if (fromDate || toDate) {
          const reportDate = _isoDateIST(report.date);
          if (!reportDate) return false;
          
          if (fromDate) {
            const from = _normalizeQueryDate(fromDate);
            if (reportDate < from) return false;
          }
          
          if (toDate) {
            const to = _normalizeQueryDate(toDate);
            if (reportDate > to) return false;
          }
        }
        
        // Class filter (exact match, case-insensitive)
        if (cls) {
          const classMatch = String(report.class || '').toLowerCase().trim() === cls.toLowerCase().trim();
          if (!classMatch) return false;
        }
        
        // Subject filter (partial match, case-insensitive)
        if (subject) {
          const subjectLower = subject.toLowerCase().trim();
          const subjectMatch = String(report.subject || '').toLowerCase().includes(subjectLower);
          if (!subjectMatch) return false;
        }

        // Chapter filter (partial match, case-insensitive)
        if (chapter) {
          const chapterLower = String(chapter || '').toLowerCase().trim();
          const chapterMatch = String(report.chapter || '').toLowerCase().includes(chapterLower);
          if (!chapterMatch) return false;
        }
        
        return true;
      });
      
      // Sort by date (newest first), then by teacher
      filtered.sort((a, b) => {
        const dateA = _isoDateIST(a.date);
        const dateB = _isoDateIST(b.date);
        if (dateA !== dateB) return dateB.localeCompare(dateA); // Newest first
        
        const teacherA = String(a.teacherName || a.teacherEmail || '').toLowerCase();
        const teacherB = String(b.teacherName || b.teacherEmail || '').toLowerCase();
        if (teacherA < teacherB) return -1;
        if (teacherA > teacherB) return 1;
        
        return Number(a.period || 0) - Number(b.period || 0);
      });
      // Format dates for frontend display
      const result = filtered.map(report => ({
        id: report.id || '',
        reportId: report.id || '', // Alias for compatibility
        date: _isoDateIST(report.date),
        teacherEmail: report.teacherEmail || '',
        teacherName: report.teacherName || '',
        class: report.class || '',
        subject: report.subject || '',
        schemeId: report.schemeId || '',
        period: Number(report.period || 0),
        planType: report.planType || '',
        lessonPlanId: report.lessonPlanId || '',
        chapter: report.chapter || '',
        sessionNo: Number(report.sessionNo || 0),
        totalSessions: Number(report.totalSessions || 0),
        completionPercentage: Number(report.completionPercentage || 0),
        chapterStatus: report.chapterStatus || '',
        deviationReason: report.deviationReason || '',
        difficulties: report.difficulties || '',
        nextSessionPlan: report.nextSessionPlan || '',
        objectives: report.objectives || '',
        activities: report.activities || '',
        completed: report.completed || 'Not Started',
        notes: report.notes || '',
        createdAt: report.createdAt || '',
        isSubstitution: report.isSubstitution || '',
        absentTeacher: report.absentTeacher || '',
        regularSubject: report.regularSubject || '',
        substituteSubject: report.substituteSubject || '',
        verified: report.verified || '',
        verifiedBy: report.verifiedBy || '',
        verifiedAt: report.verifiedAt || '',
        reopenReason: report.reopenReason || '',
        reopenedBy: report.reopenedBy || '',
        reopenedAt: report.reopenedAt || ''
      }));
      
      return result;
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all missing lesson plans across all teachers (for HM dashboard)
   * @param {number} daysAhead - Number of days to look ahead (default: 7)
   * @returns {Object} - Missing lesson plans grouped by teacher
   */
  function getAllMissingLessonPlans(daysAhead = 7) {
    try {
      // Get all teachers
      const usersSheet = _getSheet('Users');
      const usersHeaders = _headers(usersSheet);
      const users = _rows(usersSheet).map(row => _indexByHeader(row, usersHeaders));
      
      const teachers = users.filter(user => {
        const roles = String(user.role || '').toLowerCase();
        return roles.includes('teacher') || roles.includes('class teacher');
      });
      
      // Get missing lesson plans for each teacher
      const byTeacher = [];
      let totalMissing = 0;
      let criticalTotal = 0;
      let highTotal = 0;
      
      teachers.forEach(teacher => {
        const result = getMissingLessonPlans(teacher.email, daysAhead);
        
        if (result.success && result.missingCount > 0) {
          byTeacher.push({
            teacherEmail: teacher.email,
            teacherName: teacher.name || teacher.email.split('@')[0],
            missingCount: result.missingCount,
            byCriticality: result.byCriticality,
            missing: result.missing
          });
          
          totalMissing += result.missingCount;
          criticalTotal += result.byCriticality.critical;
          highTotal += result.byCriticality.high;
        }
      });
      
      // Sort by criticality (most critical first)
      byTeacher.sort((a, b) => {
        const aCritical = a.byCriticality.critical + a.byCriticality.high;
        const bCritical = b.byCriticality.critical + b.byCriticality.high;
        if (aCritical !== bCritical) return bCritical - aCritical;
        return b.missingCount - a.missingCount;
      });
      
      return {
        success: true,
        dateRange: {
          start: _todayISO(),
          end: _isoDateIST(new Date(Date.now() + (daysAhead * 24 * 60 * 60 * 1000)))
        },
        summary: {
          teachersWithMissing: byTeacher.length,
          totalTeachers: teachers.length,
          totalMissing: totalMissing,
          criticalMissing: criticalTotal,
          highMissing: highTotal
        },
        byTeacher: byTeacher
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

/**
 * ====== SUPER ADMIN MANAGEMENT FUNCTIONS ======
 * These functions allow Super Admins to manage all system data
 */

/**
 * Delete a lesson plan
 */
function deleteLessonPlan(lessonPlanId, requesterEmail, requesterName) {
  try {
    const sh = _getSheet('LessonPlans');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = _indexByHeader(data[i], headers);
      if (row.lessonPlanId === lessonPlanId) {
        const rowObj = _indexByHeader(data[i], headers);
        sh.deleteRow(i + 1);
        try {
          logAudit({
            action: AUDIT_ACTIONS.DELETE,
            entityType: AUDIT_ENTITIES.LESSON_PLAN,
            entityId: String(lessonPlanId || ''),
            userEmail: String(requesterEmail || '').toLowerCase().trim(),
            userName: String(requesterName || requesterEmail || '').trim(),
            userRole: 'Super Admin',
            description: `Lesson plan deleted by super admin (${rowObj.class || ''} ${rowObj.subject || ''})`,
            severity: AUDIT_SEVERITY.CRITICAL
          });
        } catch (auditErr) { /* ignore audit failures */ }
        appLog('INFO', 'deleteLessonPlan', 'Deleted lesson plan: ' + lessonPlanId);
        return { success: true, message: 'Lesson plan deleted successfully' };
      }
    }
    return { error: 'Lesson plan not found' };
  } catch (err) {
    appLog('ERROR', 'deleteLessonPlan', err.message);
    return { error: 'Failed to delete lesson plan: ' + err.message };
  }
}

/**
 * Delete a scheme
 */
function deleteScheme(schemeId, requesterEmail, requesterName) {
  try {
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = _indexByHeader(data[i], headers);
      if (row.schemeId === schemeId) {
        const rowObj = _indexByHeader(data[i], headers);
        sh.deleteRow(i + 1);
        try {
          logAudit({
            action: AUDIT_ACTIONS.DELETE,
            entityType: AUDIT_ENTITIES.SCHEME,
            entityId: String(schemeId || ''),
            userEmail: String(requesterEmail || '').toLowerCase().trim(),
            userName: String(requesterName || requesterEmail || '').trim(),
            userRole: 'Super Admin',
            description: `Scheme deleted by super admin (${rowObj.class || ''} ${rowObj.subject || ''})`,
            severity: AUDIT_SEVERITY.CRITICAL
          });
        } catch (auditErr) { /* ignore audit failures */ }
        appLog('INFO', 'deleteScheme', 'Deleted scheme: ' + schemeId);
        return { success: true, message: 'Scheme deleted successfully' };
      }
    }
    return { error: 'Scheme not found' };
  } catch (err) {
    appLog('ERROR', 'deleteScheme', err.message);
    return { error: 'Failed to delete scheme: ' + err.message };
  }
}

/**
 * Delete a daily report
 */
function deleteReport(reportId, requesterEmail, requesterName) {
  try {
    const sh = _getSheet('DailyReports');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = _indexByHeader(data[i], headers);
      if (row.reportId === reportId) {
        const rowObj = _indexByHeader(data[i], headers);
        sh.deleteRow(i + 1);
        try {
          logAudit({
            action: AUDIT_ACTIONS.DELETE,
            entityType: AUDIT_ENTITIES.DAILY_REPORT,
            entityId: String(reportId || ''),
            userEmail: String(requesterEmail || '').toLowerCase().trim(),
            userName: String(requesterName || requesterEmail || '').trim(),
            userRole: 'Super Admin',
            description: `Daily report deleted by super admin (${rowObj.class || ''} ${rowObj.subject || ''} Period ${rowObj.period || ''})`,
            severity: AUDIT_SEVERITY.CRITICAL
          });
        } catch (auditErr) { /* ignore audit failures */ }
        appLog('INFO', 'deleteReport', 'Deleted report: ' + reportId);
        return { success: true, message: 'Report deleted successfully' };
      }
    }
    return { error: 'Report not found' };
  } catch (err) {
    appLog('ERROR', 'deleteReport', err.message);
    return { error: 'Failed to delete report: ' + err.message };
  }
}

/**
 * Add a new user
 */
function addUser(userData) {
  try {
    const sh = _getSheet('Users');
    _ensureHeaders(sh, SHEETS.Users);
    
    const email = (userData.email || userData.userEmail || '').toLowerCase().trim();
    const name = userData.name || userData.userName || '';
    const password = userData.password || 'password123';
    const roles = userData.roles || 'teacher';
    const classes = userData.classes || '';
    const subjects = userData.subjects || '';
    const classTeacherFor = userData.classTeacherFor || '';
    const phone = userData.phone || '';
    
    // Check if user already exists
    const headers = _headers(sh);
    const existing = _rows(sh).map(r => _indexByHeader(r, headers));
    if (existing.find(u => String(u.email||'').toLowerCase() === email)) {
      return { error: 'User already exists with this email' };
    }
    
    const now = new Date().toISOString();
    const newUserData = [
      email,
      name,
      password,
      roles,
      classes,
      subjects,
      classTeacherFor,
      phone,
      now
    ];
    
    sh.appendRow(newUserData);
    appLog('INFO', 'addUser', 'Added new user: ' + email);
    
    return { success: true, message: 'User added successfully', email: email };
  } catch (err) {
    appLog('ERROR', 'addUser', err.message);
    return { error: 'Failed to add user: ' + err.message };
  }
}

/**
 * Update an existing user
 */
function updateUser(userData) {
  try {
    const sh = _getSheet('Users');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    const email = (userData.email || userData.userEmail || '').toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const row = _indexByHeader(data[i], headers);
      if (String(row.email||'').toLowerCase() === email) {
        // Update fields
        const rowNum = i + 1;
        if (userData.name || userData.userName) {
          const nameIdx = headers.indexOf('name');
          if (nameIdx >= 0) sh.getRange(rowNum, nameIdx + 1).setValue(userData.name || userData.userName);
        }
        if (userData.password) {
          const pwIdx = headers.indexOf('password');
          if (pwIdx >= 0) sh.getRange(rowNum, pwIdx + 1).setValue(userData.password);
        }
        if (userData.roles !== undefined) {
          const rolesIdx = headers.indexOf('roles');
          if (rolesIdx >= 0) sh.getRange(rowNum, rolesIdx + 1).setValue(userData.roles);
        }
        if (userData.classes !== undefined) {
          const classesIdx = headers.indexOf('classes');
          if (classesIdx >= 0) sh.getRange(rowNum, classesIdx + 1).setValue(userData.classes);
        }
        if (userData.subjects !== undefined) {
          const subjectsIdx = headers.indexOf('subjects');
          if (subjectsIdx >= 0) sh.getRange(rowNum, subjectsIdx + 1).setValue(userData.subjects);
        }
        if (userData.classTeacherFor !== undefined) {
          const ctIdx = headers.indexOf('classTeacherFor');
          if (ctIdx >= 0) sh.getRange(rowNum, ctIdx + 1).setValue(userData.classTeacherFor);
        }
        if (userData.phone !== undefined) {
          const phoneIdx = headers.indexOf('phone');
          if (phoneIdx >= 0) sh.getRange(rowNum, phoneIdx + 1).setValue(userData.phone);
        }
        
        // Audit log: User update
        logAudit({
          action: AUDIT_ACTIONS.UPDATE,
          entityType: AUDIT_ENTITIES.USER,
          entityId: email,
          userEmail: email,
          userName: userData.name || userData.userName || row.name || '',
          userRole: userData.roles || row.roles || '',
          beforeData: row,
          afterData: userData,
          description: `User profile updated: ${email}`,
          severity: AUDIT_SEVERITY.WARNING
        });
        
        appLog('INFO', 'updateUser', 'Updated user: ' + email);
        return { success: true, message: 'User updated successfully' };
      }
    }
    return { error: 'User not found' };
  } catch (err) {
    appLog('ERROR', 'updateUser', err.message);
    return { error: 'Failed to update user: ' + err.message };
  }
}

/**
 * Delete a user
 */
function deleteUser(userEmail) {
  try {
    const sh = _getSheet('Users');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    const email = (userEmail || '').toLowerCase().trim();
    
    for (let i = 1; i < data.length; i++) {
      const row = _indexByHeader(data[i], headers);
      if (String(row.email||'').toLowerCase() === email) {
        // Audit log: User deletion (before deleting)
        logAudit({
          action: AUDIT_ACTIONS.DELETE,
          entityType: AUDIT_ENTITIES.USER,
          entityId: email,
          userEmail: email,
          userName: row.name || '',
          userRole: row.roles || '',
          beforeData: row,
          description: `User account deleted: ${row.name} (${email})`,
          severity: AUDIT_SEVERITY.CRITICAL
        });
        
        sh.deleteRow(i + 1);
        appLog('INFO', 'deleteUser', 'Deleted user: ' + email);
        return { success: true, message: 'User deleted successfully' };
      }
    }
    return { error: 'User not found' };
  } catch (err) {
    appLog('ERROR', 'deleteUser', err.message);
    return { error: 'Failed to delete user: ' + err.message };
  }
}

/**
 * Get all users (for user management)
 */
function getAllUsers() {
  try {
    const sh = _getSheet('Users');
    const headers = _headers(sh);
    const users = _rows(sh).map(r => _indexByHeader(r, headers));
    
    // Don't return passwords in the response
    return users.map(u => ({
      email: u.email,
      name: u.name,
      roles: u.roles,
      classes: u.classes,
      subjects: u.subjects,
      classTeacherFor: u.classTeacherFor
    }));
  } catch (err) {
    appLog('ERROR', 'getAllUsers', err.message);
    return { error: 'Failed to get users: ' + err.message };
  }
}

/**
 * Get first unreported session number for a chapter
 * Ensures sequential session reporting (no skipping)
 */
function getFirstUnreportedSession(teacherEmail, classVal, subject, chapter, totalSessions, schemeId) {
  try {
    const reportsSheet = _getSheet('DailyReports');
    const headers = _headers(reportsSheet);
    const reports = _rows(reportsSheet).map(r => _indexByHeader(r, headers));
    const schemeNorm = String(schemeId || '').trim();
    
    // Get all reported sessions for this teacher+class+subject+chapter
    // EXCLUDE cascaded reports (sessions that were rescheduled and need to be reported again)
    const reportedSessions = reports
      .filter(r => {
        const emailMatch = String(r.teacherEmail || '').trim().toLowerCase() === String(teacherEmail || '').trim().toLowerCase();
        const classMatch = String(r.class || '').trim() === String(classVal || '').trim();
        const subjectMatch = String(r.subject || '').trim() === String(subject || '').trim();
        const chapterMatch = String(r.chapter || '').trim() === String(chapter || '').trim();
        if (!emailMatch || !classMatch || !subjectMatch || !chapterMatch) return false;
        // Skip cascaded reports - they were rescheduled and still need to be reported
        const planType = String(r.planType || '').trim().toLowerCase();
        if (planType === 'cascaded') return false;
        if (schemeNorm) return String(r.schemeId || '').trim() === schemeNorm;
        return true;
      })
      .map(r => Number(r.sessionNo || 0))
      .filter(n => n > 0)
      .sort((a, b) => a - b);
    
    // Find first missing session starting from 1
    for (let i = 1; i <= totalSessions; i++) {
      if (!reportedSessions.includes(i)) {
        return i;
      }
    }
    
    // All sessions reported
    return null;
  } catch (error) {
    appLog('ERROR', 'getFirstUnreportedSession', error.message);
    return 1; // Default to session 1 on error
  }
}

/**
 * Validate that teacher is reporting sessions sequentially (no skipping)
 * Extended sessions (sessionNum > totalSessions) are allowed if previous session reported
 */
function validateSessionSequence(teacherEmail, classVal, subject, chapter, attemptedSession, totalSessions, schemeId) {
  try {
    // Extended sessions (beyond original totalSessions) bypass normal sequence validation
    if (attemptedSession > totalSessions) {
      // For extended sessions, verify previous session (attemptedSession - 1) is reported
      const reportsSheet = _getSheet('DailyReports');
      const headers = _headers(reportsSheet);
      const reports = _rows(reportsSheet).map(r => _indexByHeader(r, headers));
      const schemeNorm = String(schemeId || '').trim();
      
      // EXCLUDE cascaded reports (sessions that were rescheduled and need to be reported again)
      const reportedSessions = reports
        .filter(r => {
          const emailMatch = String(r.teacherEmail || '').trim().toLowerCase() === String(teacherEmail || '').trim().toLowerCase();
          const classMatch = String(r.class || '').trim() === String(classVal || '').trim();
          const subjectMatch = String(r.subject || '').trim() === String(subject || '').trim();
          const chapterMatch = String(r.chapter || '').trim() === String(chapter || '').trim();
          if (!emailMatch || !classMatch || !subjectMatch || !chapterMatch) return false;
          // Skip cascaded reports - they were rescheduled and still need to be reported
          const planType = String(r.planType || '').trim().toLowerCase();
          if (planType === 'cascaded') return false;
          if (schemeNorm) return String(r.schemeId || '').trim() === schemeNorm;
          return true;
        })
        .map(r => Number(r.sessionNo || 0))
        .filter(n => n > 0);
      
      const previousSession = attemptedSession - 1;
      if (previousSession > 0 && !reportedSessions.includes(previousSession)) {
        return {
          valid: false,
          expectedSession: previousSession,
          message: `Session ${previousSession} must be reported before extended session ${attemptedSession}.`
        };
      }
      
      return { valid: true, isExtended: true };
    }
    
    // Normal sessions: enforce sequential reporting within original totalSessions
    const expectedSession = getFirstUnreportedSession(teacherEmail, classVal, subject, chapter, totalSessions, schemeId);
    
    if (expectedSession === null) {
      // All original sessions reported - this shouldn't happen for normal sessions
      return {
        valid: false,
        expectedSession: null,
        message: 'All original sessions for this chapter have been reported. Use "Add Extended Session" if more sessions are needed.'
      };
    }
    
    if (attemptedSession !== expectedSession) {
      return {
        valid: false,
        expectedSession: expectedSession,
        message: `Session ${expectedSession} must be reported first. Sequential reporting is required (cannot skip sessions).`
      };
    }
    
    return { valid: true, expectedSession: expectedSession };
  } catch (error) {
    appLog('ERROR', 'validateSessionSequence', error.message);
    return { valid: true }; // Allow on error to prevent blocking
  }
}

/**
 * Backfill schemeId for existing DailyReports by matching to LessonPlans
 * This function populates the schemeId column for reports that don't have it yet
 */
function backfillDailyReportSchemeIds() {
  try {
    appLog('INFO', 'backfillDailyReportSchemeIds START');
    
    // Get DailyReports sheet
    const reportsSheet = _getSheet('DailyReports');
    const reportHeaders = _headers(reportsSheet);
    const reportRows = _rows(reportsSheet);
    
    // Find schemeId column index (add if missing)
    let schemeIdColIndex = reportHeaders.indexOf('schemeId');
    if (schemeIdColIndex === -1) {
      // Add schemeId column after subject
      const subjectIndex = reportHeaders.indexOf('subject');
      schemeIdColIndex = subjectIndex + 1;
      reportsSheet.insertColumnAfter(subjectIndex + 1);
      reportsSheet.getRange(1, schemeIdColIndex + 1).setValue('schemeId');
      appLog('INFO', 'Added schemeId column at index', { index: schemeIdColIndex });
    }
    
    // Get LessonPlans to lookup schemeId
    const plansSheet = _getSheet('LessonPlans');
    const planHeaders = _headers(plansSheet);
    const plans = _rows(plansSheet).map(r => _indexByHeader(r, planHeaders));
    
    // Create lookup map: lessonPlanId -> schemeId
    const lpIdToSchemeId = new Map();
    for (const plan of plans) {
      const lpId = String(plan.lpId || plan.lessonPlanId || plan.planId || plan.id || '').trim();
      const schemeId = String(plan.schemeId || '').trim();
      if (lpId && schemeId) {
        lpIdToSchemeId.set(lpId, schemeId);
      }
    }
    appLog('INFO', 'Built lessonPlan lookup map', { size: lpIdToSchemeId.size });
    
    // Process each report
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    for (let i = 0; i < reportRows.length; i++) {
      const row = reportRows[i];
      const report = _indexByHeader(row, reportHeaders);
      const rowNum = i + 2; // +1 for header, +1 for 0-index
      
      // Skip if schemeId already exists
      const existingSchemeId = String(report.schemeId || '').trim();
      if (existingSchemeId) {
        skippedCount++;
        continue;
      }
      
      // Get lessonPlanId from report
      const lessonPlanId = String(report.lessonPlanId || '').trim();
      if (!lessonPlanId) {
        notFoundCount++;
        continue; // Can't backfill without lessonPlanId
      }
      
      // Lookup schemeId
      const schemeId = lpIdToSchemeId.get(lessonPlanId);
      if (schemeId) {
        // Update the cell
        reportsSheet.getRange(rowNum, schemeIdColIndex + 1).setValue(schemeId);
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          SpreadsheetApp.flush();
          appLog('INFO', 'Backfill progress', { updated: updatedCount });
        }
      } else {
        notFoundCount++;
      }
    }
    
    SpreadsheetApp.flush();
    
    const result = {
      totalReports: reportRows.length,
      updatedCount: updatedCount,
      skippedCount: skippedCount,
      notFoundCount: notFoundCount,
      message: `Backfill complete. Updated ${updatedCount} reports, skipped ${skippedCount} (already had schemeId), ${notFoundCount} couldn't be matched.`
    };
    
    appLog('INFO', 'backfillDailyReportSchemeIds COMPLETE', result);
    return result;
    
  } catch (error) {
    appLog('ERROR', 'backfillDailyReportSchemeIds', { message: error.message, stack: error.stack });
    throw error;
  }
}