/**
 * SchemeLessonManager.gs
 * Manages scheme-based lesson plan preparation
 * Implements reverse flow: Schemes → Chapters → Sessions → Select Period
 */

// ===== SchemeLessonManager shared helpers =====
function _slmSafeDateMs_(v) {
  try {
    if (v == null || v === '') return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  } catch (e) {
    return 0;
  }
}

function _slmSchemeStartMs_(scheme) {
  // Use approvedAt first (when present), else createdAt. If missing/invalid, return 0 (no filtering).
  const a = scheme && (scheme.approvedAt || scheme.createdAt);
  return _slmSafeDateMs_(a);
}

function _slmTeacherEmailFromRow_(row) {
  return String(
    row && (
      row.teacherEmail ||
      row.email ||
      row.teacher ||
      row.TeacherEmail ||
      row['Teacher Email'] ||
      row['Teacher email']
    ) || ''
  ).toLowerCase().trim();
}

function _slmNormalizePlanRow_(plan) {
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
}

function _slmNormalizeReportRow_(report) {
  if (!report || typeof report !== 'object') return report;
  if (!report.teacherEmail) report.teacherEmail = report.email || report.teacher || report.TeacherEmail || report['Teacher Email'] || report['Teacher email'] || '';
  if (!report.class) report.class = report.Class || report['Class'] || '';
  if (!report.subject) report.subject = report.Subject || report['Subject'] || '';
  if (!report.chapter) report.chapter = report.Chapter || report.chapterName || report.ChapterName || '';
  if (!report.sessionNo) report.sessionNo = report.session || report.Session || report.SessionNo || report['Session No'] || '';
  if (!report.lessonPlanId) report.lessonPlanId = report.lpId || report.planId || report.id || report['Lesson Plan Id'] || '';
  if (!report.schemeId) report.schemeId = report.SchemeId || report.schemeID || report['Scheme Id'] || '';
  if (!report.completed) report.completed = report.Completed || report['Completed'] || report['completed'] || '';
  if (!report.chapterStatus) report.chapterStatus = report.ChapterStatus || report['Chapter Status'] || report['chapterStatus'] || '';
  if (!report.chapterCompleted) report.chapterCompleted = report.ChapterCompleted || report['Chapter Completed'] || report['chapterCompleted'] || '';
  return report;
}

/**
 * Shared helper: check whether a DailyReport row signals "Chapter Complete".
 * Extracted from three previously-duplicate inline closures.
 */
function _slmIsChapterMarkedComplete_(report) {
  if (!report || typeof report !== 'object') return false;
  const v = String(report.chapterCompleted || '').toLowerCase().trim();
  return (
    String(report.completed || '').toLowerCase().indexOf('chapter complete') !== -1 ||
    report.chapterCompleted === true ||
    v === 'true' ||
    v === 'yes' ||
    v === 'y' ||
    v === '1'
  );
}

/**
 * Calculate lesson planning date range - next 30 days rolling
 * SIMPLIFIED: No preparation day restriction, show available periods for next 30 days
 */
function _calculateLessonPlanningDateRange() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get AcademicCalendar to check term dates
    const calendarSheet = _getSheet('AcademicCalendar');
    const calendarHeaders = _headers(calendarSheet);
    const calendarRows = _rows(calendarSheet).map(row => _indexByHeader(row, calendarHeaders));
    
    // Find the current/upcoming term based on today's date
    let activeTerm = null;
    let upcomingTerm = null;
    
    for (const term of calendarRows) {
      // Skip rows without a valid term name, startDate, or endDate
      if (!term.term || !String(term.term).trim() || !term.startDate || !term.endDate) continue;
      
      const termStart = _coerceToDate(term.startDate);
      const termEnd = _coerceToDate(term.endDate);
      if (!termStart || !termEnd) continue; // Skip if dates couldn't be parsed
      termStart.setHours(0, 0, 0, 0);
      termEnd.setHours(0, 0, 0, 0);
      
      // Current term: today is between start and end
      if (today >= termStart && today <= termEnd) {
        activeTerm = { ...term, termStart, termEnd };
        break;
      }
      
      // Upcoming term: starts in the future and closest to today
      if (termStart > today) {
        if (!upcomingTerm || termStart < upcomingTerm.termStart) {
          upcomingTerm = { ...term, termStart, termEnd };
        }
      }
    }
    
    // Determine planning window
    let startDate, endDate, termInfo;
    
    if (activeTerm) {
      // We're in an active term - plan from today to term end (or +30 days, whichever is sooner)
      startDate = new Date(today);
      const thirtyDaysOut = new Date(today);
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      
      endDate = thirtyDaysOut <= activeTerm.termEnd ? thirtyDaysOut : activeTerm.termEnd;
      termInfo = `Term ${activeTerm.term} (Active)`;
      
    } else if (upcomingTerm) {
      // No active term, but there's an upcoming term - plan from term start
      startDate = new Date(upcomingTerm.termStart);
      const thirtyDaysFromStart = new Date(upcomingTerm.termStart);
      thirtyDaysFromStart.setDate(thirtyDaysFromStart.getDate() + 30);
      
      endDate = thirtyDaysFromStart <= upcomingTerm.termEnd ? thirtyDaysFromStart : upcomingTerm.termEnd;
      termInfo = `Term ${upcomingTerm.term} (Upcoming)`;
      
    } else {
      // No term data found - fallback to today + 30 days
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
      termInfo = 'No Term Data';
      
    }
    
    const startDateString = _isoDateString(startDate);
    const endDateString = _isoDateString(endDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      startDate: startDateString,
      endDate: endDateString,
      deferredDays: 0,
      daysAhead: totalDays,
      preparationDay: 'Any',
      isPreparationDay: true,
      canSubmit: true,
      termInfo: termInfo // Add term info for debugging
    };
  } catch (error) {
    // Default: next 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    
    return {
      startDate: _isoDateString(today),
      endDate: _isoDateString(endDate),
      deferredDays: 0,
      daysAhead: Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) + 1,
      preparationDay: 'Any',
      isPreparationDay: true,
      canSubmit: true,
      termInfo: 'Error - Using fallback'
    };
  }
}

/**
 * Get approved schemes for a teacher with chapter/session breakdown
 */
function getApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly) {
  // Cache-buster: bump this string whenever the payload/gating rules change.
  // Apps Script caches can otherwise serve stale "schemes" objects without new fields.
  const APPROVED_SCHEMES_CACHE_VERSION = 'v2026-02-06-sparse-sessions-and-gating-fix';
  const mode = summaryOnly ? 'summary' : 'full';
  const cacheKey = generateCacheKey('approved_schemes', { email: teacherEmail, mode: mode, v: APPROVED_SCHEMES_CACHE_VERSION });

  // PERFORMANCE: For summary mode, use SHORT cache (60s) to ensure fast responses
  // For full mode, use MEDIUM cache (5min) as before
  const cacheTTL = summaryOnly ? CACHE_TTL.SHORT : CACHE_TTL.MEDIUM;

  // NOTE: The heavy schemes+progress payload is cached, but Settings-driven flags
  // (bulkOnly mode, planningDateRange) must reflect sheet edits immediately.
  const res = getCachedData(cacheKey, function() {
    const fetchStart = Date.now();
    const result = _fetchApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly);
    return result;
  }, cacheTTL);

  try {
    if (res && typeof res === 'object' && res.success !== false) {
      // Always refresh settings (e.g., lessonplan_bulk_only) even on cache hits.
      res.settings = _getLessonPlanSettings();

      // Preserve summaryOnly flag (important for frontend to know response type)
      if (summaryOnly) {
        res.summaryOnly = true;
      }

      // Always refresh planning date range because it is computed from Settings.
      try {
        const dateRange = _calculateLessonPlanningDateRange();
        res.planningDateRange = {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          deferredDays: dateRange.deferredDays,
          daysAhead: dateRange.daysAhead,
          preparationDay: dateRange.preparationDay,
          isPreparationDay: dateRange.isPreparationDay,
          canSubmit: dateRange.canSubmit
        };
      } catch (_drErr) {
        // Keep cached planningDateRange (or null) if compute fails.
      }
    }
  } catch (_e) {
    // Best-effort only; never fail the call due to settings refresh.
  }

  return res;
}

function _fetchApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly) {
  try {
    if (!teacherEmail) {
      return { success: false, error: 'Teacher email is required' };
    }

    const teacherEmailNorm = String(teacherEmail || '').toLowerCase().trim();
    
    // PERFORMANCE: Fetch only this teacher's scheme rows via TextFinder (avoid full sheet reads)
    let approvedSchemes = [];
    try {
      const fetched = _slmFetchRowsByColumnExact_('Schemes', 'teacherEmail', teacherEmailNorm, [
        'schemeId', 'teacherEmail', 'status', 'class', 'subject', 'academicYear', 'term',
        'chapter', 'content', 'chapters', 'noOfSessions', 'createdAt', 'approvedAt'
      ]);
      const teacherSchemes = (fetched && Array.isArray(fetched.rows)) ? fetched.rows : [];
      approvedSchemes = teacherSchemes
        .filter(s => {
          if (!s || typeof s !== 'object') return false;
          const email = String(s.teacherEmail || '').toLowerCase().trim();
          const status = String(s.status || '').toLowerCase().trim();
          return email === teacherEmailNorm && status === 'approved';
        });
    } catch (_tfErr) {
      // Fallback: legacy full-sheet scan
      const sheet = _getSheet('Schemes');
      const headers = _headers(sheet);
      const emailColIndex = headers.findIndex(h => String(h).toLowerCase().trim() === 'teacheremail');
      const statusColIndex = headers.findIndex(h => String(h).toLowerCase().trim() === 'status');
      if (emailColIndex === -1 || statusColIndex === -1) {
        return { success: false, error: 'Invalid Schemes sheet structure' };
      }
      const allRows = _rows(sheet);
      approvedSchemes = allRows
        .filter(row => {
          const email = String(row[emailColIndex] || '').toLowerCase().trim();
          const status = String(row[statusColIndex] || '').toLowerCase().trim();
          return email === teacherEmailNorm && status === 'approved';
        })
        .map(row => _indexByHeader(row, headers));
    }
    
    // OPTIMIZATION: If summary-only mode, return lightweight payload immediately
    if (summaryOnly) {
      const result = _buildSummaryOnlyResponse(approvedSchemes, teacherEmailNorm);
      return result;
    }

    // Get existing lesson plans (FAST PATH: teacherEmail exact match via TextFinder)
    let teacherPlans = [];
    try {
      const fetchedPlans = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmailNorm, [
        'lpId', 'lessonPlanId', 'schemeId', 'teacherEmail', 'class', 'subject', 'chapter',
        'session', 'sessionNo', 'status', 'selectedDate', 'selectedPeriod',
        'originalDate', 'originalPeriod', 'createdAt', 'updatedAt'
      ]);
      if (fetchedPlans && Array.isArray(fetchedPlans.rows)) teacherPlans = fetchedPlans.rows.map(_slmNormalizePlanRow_);
    } catch (_e) {
      // Ignore and fall back below
    }

    // FALLBACK: cached full sheet (legacy)
    if (!teacherPlans || teacherPlans.length === 0) {
      const existingPlans = _getCachedSheetData('LessonPlans').data;
      teacherPlans = (existingPlans || []).filter(plan => {
        if (!plan || typeof plan !== 'object') return false;
        const teacherVal = _slmTeacherEmailFromRow_(plan);
        return teacherVal === teacherEmailNorm;
      }).map(_slmNormalizePlanRow_);
    }

    // Get daily reports (FAST PATH: teacherEmail exact match via TextFinder)
    let teacherReports = [];
    try {
      const fetchedReports = _slmFetchRowsByColumnExact_('DailyReports', 'teacherEmail', teacherEmailNorm, [
        'teacherEmail', 'class', 'subject', 'chapter', 'sessionNo', 'session',
        'lessonPlanId', 'schemeId', 'date', 'createdAt',
        'chapterStatus', 'chapterCompleted', 'completed'
      ]);
      if (fetchedReports && Array.isArray(fetchedReports.rows)) teacherReports = fetchedReports.rows.map(_slmNormalizeReportRow_);
    } catch (_e2) {
      // Ignore and fall back below
    }

    // FALLBACK: cached full sheet (legacy)
    if (!teacherReports || teacherReports.length === 0) {
      const allReports = _getCachedSheetData('DailyReports').data;
      teacherReports = (allReports || []).filter(report => {
        if (!report || typeof report !== 'object') return false;
        return _slmTeacherEmailFromRow_(report) === teacherEmailNorm;
      }).map(_slmNormalizeReportRow_);
    }

    // Seed request cache so _generateSessionsForChapter can reuse this data without another fetch.
    try {
      if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
        if (!REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher) REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher = {};
        REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher[teacherEmailNorm] = teacherReports;
      }
    } catch (e) {}

    // PERFORMANCE: build indexes for O(1) lookups instead of repeated .find/.some
    const normKey = function(v) { return String(v || '').toLowerCase().trim(); };
    const csKey = function(cls, subj) { return `${normKey(cls)}|${normKey(subj)}`; };
    const chapterKey = function(cls, subj, chapter) { return `${csKey(cls, subj)}|${normKey(chapter)}`; };
    const reportSessionKey = function(cls, subj, chapter, sessionNo) {
      const s = Number(sessionNo);
      return `${csKey(cls, subj)}|${normKey(chapter)}|${isNaN(s) ? 0 : s}`;
    };
    const planKey = function(schemeId, chapter, sessionNo) {
      const s = Number(sessionNo);
      return `${String(schemeId || '').trim()}|${normKey(chapter)}|${isNaN(s) ? 0 : s}`;
    };

    const relevantClassSubjects = new Set(approvedSchemes.map(s => csKey(s.class, s.subject)));

    // Index daily reports by lessonPlanId so we can scope reporting/completion to the correct scheme.
    // This avoids false “Chapter Complete” when older-term reports share class/subject/chapter text.
    const reportsByLessonPlanId = new Map();
    for (const rr of (teacherReports || [])) {
      if (!rr || typeof rr !== 'object') continue;
      const lpId = String(rr.lessonPlanId || rr.lpId || rr.planId || rr.id || '').trim();
      if (!lpId) continue;
      if (!reportsByLessonPlanId.has(lpId)) reportsByLessonPlanId.set(lpId, []);
      reportsByLessonPlanId.get(lpId).push(rr);
    }

    // Plans indexed by (schemeId + chapter + session)
    const plansByKey = new Map();
    for (const p of teacherPlans) {
      if (!p || typeof p !== 'object') continue;
      const planSchemeId = p.schemeId || p.SchemeId || p.schemeID;
      const planChapter = p.chapter || p.Chapter || p.chapterName || p.ChapterName;
      const planSession = p.session || p.sessionNo || p.sessionNumber || p.Session || p.SessionNo;
      const key = planKey(planSchemeId, planChapter, planSession);
      if (!key) continue;
      // If duplicates exist, keep the most recently updated/created if possible
      const existing = plansByKey.get(key);
      if (!existing) {
        plansByKey.set(key, p);
      } else {
        const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const nextTs = new Date(p.updatedAt || p.createdAt || 0).getTime();
        if (nextTs >= existingTs) plansByKey.set(key, p);
      }
    }

    // Use shared top-level helper (avoids duplicate inline definitions)
    const isChapterMarkedComplete = _slmIsChapterMarkedComplete_;

    // Pre-group teacher reports by schemeId for accurate per-scheme filtering.
    // Fallback to class|subject+date filtering for reports without schemeId (legacy).
    const reportsBySchemeId = new Map();
    const reportsByCs = new Map();
    for (const r of teacherReports) {
      if (!r || typeof r !== 'object') continue;
      const cs = csKey(r.class, r.subject);
      if (!relevantClassSubjects.has(cs)) continue;
      
      // Group by schemeId if available
      const rSchemeId = String(r.schemeId || '').trim();
      if (rSchemeId) {
        if (!reportsBySchemeId.has(rSchemeId)) reportsBySchemeId.set(rSchemeId, []);
        reportsBySchemeId.get(rSchemeId).push(r);
      } else {
        // Legacy: group by class+subject with date for fallback
        const dateMs = _slmSafeDateMs_(r.date || r.createdAt);
        if (!reportsByCs.has(cs)) reportsByCs.set(cs, []);
        reportsByCs.get(cs).push({ r, dateMs });
      }
    }
    
    // Process each scheme to show chapter/session breakdown
    const schemesWithProgress = approvedSchemes.map(scheme => {
      const schemeChapters = _parseSchemeChapters(scheme);

      // Get scheme-specific reports (prefer schemeId match, fallback to class/subject+date)
      const schemeId = String(scheme.schemeId || '').trim();
      let schemeReports = [];
      
      if (schemeId && reportsBySchemeId.has(schemeId)) {
        // Direct schemeId match - most accurate
        schemeReports = reportsBySchemeId.get(schemeId) || [];
      } else {
        // Fallback: filter by class+subject and start time (legacy for reports without schemeId)
        const schemeStartMs = _slmSchemeStartMs_(scheme);
        const cs = csKey(scheme.class, scheme.subject);
        const raw = reportsByCs.get(cs) || [];
        schemeReports = schemeStartMs
          ? raw.filter(x => x && x.dateMs && x.dateMs >= schemeStartMs).map(x => x.r)
          : raw.map(x => x.r);
      }

      // Fallback index: reports by chapter/session text (only used when lessonPlanId is missing).
      const hasReportBySessionFallback = new Set();
      const reportBySlotKey = new Map();
      const _normPeriod_ = function(v) { return String(v || '').replace(/^Period\s*/i, '').trim(); };
      try {
        for (const rr of (schemeReports || [])) {
          if (!rr || typeof rr !== 'object') continue;
          const rDate = _isoDateString(rr.date || rr.createdAt || '');
          const rPeriod = _normPeriod_(rr.period || rr.selectedPeriod || rr.sessionPeriod || rr.periodNumber || '');
          const rClass = String(rr.class || '').trim().toLowerCase();
          const rSubject = String(rr.subject || '').trim().toLowerCase();
          if (rDate && rPeriod && rClass && rSubject) {
            const slotKey = `${rDate}|${rPeriod}|${rClass}|${rSubject}`;
            if (!reportBySlotKey.has(slotKey)) reportBySlotKey.set(slotKey, rr);
          }

          if (String(rr.lessonPlanId || '').trim()) continue; // prefer lpId-based matching
          const sessKey = reportSessionKey(scheme.class, scheme.subject, rr.chapter, rr.sessionNo);
          if (sessKey) hasReportBySessionFallback.add(sessKey);
        }
      } catch (e) {}

      // PERFORMANCE: Precompute chapter completion status once per scheme
      const chapterCompletionMap = new Map();
      for (const chapter of schemeChapters) {
        const chKey = chapterKey(scheme.class, scheme.subject, chapter.name);
        const chapterReports = (schemeReports || []).filter(r => normKey(r.chapter) === normKey(chapter.name));
        const isComplete = chapterReports.some(r => isChapterMarkedComplete(r));
        chapterCompletionMap.set(chKey, isComplete);
      }

      const chaptersWithSessions = [];
      let previousChapterComplete = true; // first chapter is always allowed
      
      for (let chapterIndex = 0; chapterIndex < schemeChapters.length; chapterIndex++) {
        const chapter = schemeChapters[chapterIndex];

        // canPrepare: always true for approved schemes.
        // Gate is enforced at SCHEME SUBMISSION level (canSubmitNewScheme),
        // not at lesson-plan preparation level.
        const canPrepare = true;
        const gate = null;
        
        // Update completion status for next iteration
        const chKey = chapterKey(scheme.class, scheme.subject, chapter.name);
        previousChapterComplete = chapterCompletionMap.get(chKey) || false;

        const sessions = _generateSessionsForChapter(chapter, scheme);
        const sessionsWithStatus = sessions.map(session => {
          const existingPlan = plansByKey.get(planKey(scheme.schemeId, chapter.name, session.sessionNumber));

          let status = 'not-planned';
          let cascadeMarked = false;
          if (existingPlan) {
            const rawStatus = String(existingPlan.status || existingPlan.Status || existingPlan.lessonPlanStatus || 'planned').trim();
            const statusLower = rawStatus.toLowerCase();
            const originalDateRaw = existingPlan.originalDate || existingPlan.OriginalDate || existingPlan['Original Date'] || '';
            const selectedDateRaw = existingPlan.selectedDate || existingPlan.date || '';
            const originalDateNorm = _isoDateString(originalDateRaw);
            const selectedDateNorm = _isoDateString(selectedDateRaw);
            const originalPeriodRaw = existingPlan.originalPeriod || existingPlan.OriginalPeriod || existingPlan['Original Period'] || '';
            const hasOriginalSlotChange = !!(originalDateNorm && selectedDateNorm && originalDateNorm !== selectedDateNorm);
            const isOriginalCascade = /rescheduled\s*\(cascade\)/i.test(rawStatus); // only original missed session
            const cascadeEligible = isOriginalCascade && (hasOriginalSlotChange || String(originalPeriodRaw || '').trim());

            // Check for daily report for this session (prefer lessonPlanId match)
            const lpId = String(existingPlan.lpId || existingPlan.lessonPlanId || existingPlan.planId || existingPlan.id || '').trim();
            let hasReport = lpId
              ? reportsByLessonPlanId.has(lpId)
              : hasReportBySessionFallback.has(reportSessionKey(scheme.class, scheme.subject, chapter.name, session.sessionNumber));
            if (!hasReport && existingPlan) {
              const pDate = _isoDateString(existingPlan.selectedDate || existingPlan.date || '');
              const pPeriod = _normPeriod_(existingPlan.selectedPeriod || existingPlan.period || '');
              const pClass = String(existingPlan.class || scheme.class || '').trim().toLowerCase();
              const pSubject = String(existingPlan.subject || scheme.subject || '').trim().toLowerCase();
              if (pDate && pPeriod && pClass && pSubject) {
                const slotKey = `${pDate}|${pPeriod}|${pClass}|${pSubject}`;
                if (reportBySlotKey.has(slotKey)) hasReport = true;
              }
            }

            // Decide displayed status:
            // - If a session was the ORIGINAL cascaded session, keep a cascade marker.
            // - If that cascaded session has already been reported, display as 'Reported' (so UI shows ✓ Reported)
            //   while still allowing the UI to show a cascade indicator via originalDate/originalPeriod/cascadeMarked.
            if (cascadeEligible) {
              cascadeMarked = true;
              if (hasReport && !['cancelled','rejected'].includes(statusLower)) {
                status = 'Reported';
              } else {
                status = 'Cascaded';
              }
            } else if (hasReport && !['cancelled','rejected'].includes(statusLower)) {
              status = 'Reported';
            } else {
              status = rawStatus; // Planned / Ready / Pending Review etc.
            }
          }

          return {
            sessionNumber: session.sessionNumber,
            sessionName: session.sessionName,
            estimatedDuration: session.estimatedDuration,
            status: status,
            plannedDate: existingPlan ? existingPlan.selectedDate : null,
            plannedPeriod: existingPlan ? existingPlan.selectedPeriod : null,
            originalDate: existingPlan ? (_isoDateString(existingPlan.originalDate || existingPlan.OriginalDate || existingPlan['Original Date'] || '') || existingPlan.originalDate || null) : null,
            originalPeriod: existingPlan ? (existingPlan.originalPeriod || existingPlan.OriginalPeriod || existingPlan['Original Period'] || null) : null,
            lessonPlanId: existingPlan ? (existingPlan.lpId || existingPlan.lessonPlanId || existingPlan.planId || existingPlan.id || null) : null,
            cascadeMarked: cascadeMarked
          };
        });
        
        // EXTENDED SESSIONS: Check for lesson plans beyond original numberOfSessions
        const originalSessionCount = sessions.length;
        const extendedPlans = [];
        for (const [key, plan] of plansByKey.entries()) {
          if (!key.startsWith(String(scheme.schemeId || '') + '|' + normKey(chapter.name) + '|')) continue;
          const sessionNum = Number(plan.session || plan.sessionNo || 0);
          if (sessionNum > originalSessionCount) {
            extendedPlans.push({ sessionNum, plan });
          }
        }
        
        // Sort extended plans by session number
        extendedPlans.sort((a, b) => a.sessionNum - b.sessionNum);
        
        // Add extended sessions to sessionsWithStatus
        for (const { sessionNum, plan } of extendedPlans) {
          const rawStatus = String(plan.status || plan.Status || plan.lessonPlanStatus || 'planned').trim();
          const statusLower = rawStatus.toLowerCase();
          const originalDateRaw = plan.originalDate || plan.OriginalDate || plan['Original Date'] || '';
          const selectedDateRaw = plan.selectedDate || plan.date || '';
          const originalDateNorm = _isoDateString(originalDateRaw);
          const selectedDateNorm = _isoDateString(selectedDateRaw);
          const originalPeriodRaw = plan.originalPeriod || plan.OriginalPeriod || plan['Original Period'] || '';
          const hasOriginalSlotChange = !!(originalDateNorm && selectedDateNorm && originalDateNorm !== selectedDateNorm);
          const isOriginalCascade = /rescheduled\s*\(cascade\)/i.test(rawStatus);
          const cascadeEligible = isOriginalCascade && (hasOriginalSlotChange || String(originalPeriodRaw || '').trim());
          
          const lpId = String(plan.lpId || plan.lessonPlanId || plan.planId || plan.id || '').trim();
          let hasReport = lpId
            ? reportsByLessonPlanId.has(lpId)
            : hasReportBySessionFallback.has(reportSessionKey(scheme.class, scheme.subject, chapter.name, sessionNum));
          if (!hasReport && plan) {
            const pDate = _isoDateString(plan.selectedDate || plan.date || '');
            const pPeriod = _normPeriod_(plan.selectedPeriod || plan.period || '');
            const pClass = String(plan.class || scheme.class || '').trim().toLowerCase();
            const pSubject = String(plan.subject || scheme.subject || '').trim().toLowerCase();
            if (pDate && pPeriod && pClass && pSubject) {
              const slotKey = `${pDate}|${pPeriod}|${pClass}|${pSubject}`;
              if (reportBySlotKey.has(slotKey)) hasReport = true;
            }
          }
          
          let status = 'not-planned';
          let cascadeMarked = false;
          
          if (cascadeEligible) {
            cascadeMarked = true;
            status = hasReport && !['cancelled','rejected'].includes(statusLower) ? 'Reported' : 'Cascaded';
          } else if (hasReport && !['cancelled','rejected'].includes(statusLower)) {
            status = 'Reported';
          } else {
            status = rawStatus;
          }
          
          sessionsWithStatus.push({
            sessionNumber: sessionNum,
            sessionName: `Session ${sessionNum} (Extended)`,
            estimatedDuration: '45 minutes',
            status: status,
            plannedDate: plan.selectedDate || null,
            plannedPeriod: plan.selectedPeriod || null,
            originalDate: _isoDateString(plan.originalDate || plan.OriginalDate || plan['Original Date'] || '') || plan.originalDate || null,
            originalPeriod: plan.originalPeriod || plan.OriginalPeriod || plan['Original Period'] || null,
            lessonPlanId: plan.lpId || plan.lessonPlanId || plan.planId || plan.id || null,
            cascadeMarked: cascadeMarked,
            isExtended: true
          });
        }

        // PERFORMANCE: return a sparse sessions array by default (only planned/reported/cascaded/etc).
        // Frontend can reconstruct placeholders using totalSessions.
        const sparseSessionsWithStatus = sessionsWithStatus.filter(s => {
          const st = String(s && s.status || '').toLowerCase().trim();
          if (!st || st === 'not-planned') return false;
          return true;
        });
        
        const totalSessions = sessions.length;
        // Count all sessions that have been planned (excluding 'not-planned' and 'Cancelled')
        const plannedSessions = sessionsWithStatus.filter(s => {
          const status = String(s.status || '').toLowerCase();
          return status !== 'not-planned' && status !== 'cancelled' && status !== 'rejected';
        }).length;
        
        // Chapter completion should be scoped to this scheme's lessonPlanIds.
        // Mark complete only if any DailyReport tied to this chapter's lessonPlanIds has “Chapter Complete”.
        let currentChapterCompleted = false;
        for (const s of sessionsWithStatus) {
          const lpId = String(s && s.lessonPlanId || '').trim();
          if (!lpId) continue;
          const reps = reportsByLessonPlanId.get(lpId);
          if (reps && reps.some(isChapterMarkedComplete)) {
            currentChapterCompleted = true;
            break;
          }
        }

        chaptersWithSessions.push({
          chapterNumber: chapter.number,
          chapterName: chapter.name,
          chapterDescription: chapter.description,
          totalSessions: totalSessions,
          plannedSessions: plannedSessions,
          completionPercentage: totalSessions > 0 ? Math.round((plannedSessions / totalSessions) * 100) : 0,
          sessions: sparseSessionsWithStatus,
          sessionsSparse: true,
          numberOfSessions: parseInt(scheme.noOfSessions || 2, 10),
          // NEW: chapter-level gating for preparation
          chapterCompleted: currentChapterCompleted,
          canPrepare: canPrepare,
          lockReason: canPrepare ? '' : (gate && gate.message ? gate.message : 'Previous chapter should be completed')
        });
      }
      
      const totalSessions = chaptersWithSessions.reduce((sum, ch) => sum + ch.totalSessions, 0);
      const totalPlanned = chaptersWithSessions.reduce((sum, ch) => sum + ch.plannedSessions, 0);
      
      return {
        schemeId: scheme.schemeId,
        class: scheme.class,
        subject: scheme.subject,
        academicYear: scheme.academicYear,
        term: scheme.term,
        totalChapters: chaptersWithSessions.length,
        totalSessions: totalSessions,
        plannedSessions: totalPlanned,
        overallProgress: totalSessions > 0 ? Math.round((totalPlanned / totalSessions) * 100) : 0,
        chapters: chaptersWithSessions,
        createdAt: scheme.createdAt,
        approvedAt: scheme.approvedAt
      };
    });
    
    // Calculate planning date range from Settings
    let planningDateRange = null;
    try {
      const dateRange = _calculateLessonPlanningDateRange();
      planningDateRange = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        deferredDays: dateRange.deferredDays,
        daysAhead: dateRange.daysAhead,
        preparationDay: dateRange.preparationDay,
        isPreparationDay: dateRange.isPreparationDay,
        canSubmit: dateRange.canSubmit
      };
    } catch (dateError) {
      // Return null so frontend uses fallback
      planningDateRange = null;
    }
    
    // Get lesson plan settings to include bulk-only mode status
    const settings = _getLessonPlanSettings();
    
    return {
      success: true,
      schemes: schemesWithProgress,
      planningDateRange: planningDateRange,
      settings: settings,  // Include settings for frontend to check bulk-only mode
      summary: {
        totalSchemes: schemesWithProgress.length,
        totalSessions: schemesWithProgress.reduce((sum, s) => sum + s.totalSessions, 0),
        plannedSessions: schemesWithProgress.reduce((sum, s) => sum + s.plannedSessions, 0),
        overallProgress: schemesWithProgress.length > 0 ? 
          Math.round(schemesWithProgress.reduce((sum, s) => sum + s.overallProgress, 0) / schemesWithProgress.length) : 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Build lightweight summary-only response (no session details)
 * PERFORMANCE: Reduces payload from ~500KB to ~50KB for typical teacher
 */
function _buildSummaryOnlyResponse(approvedSchemes, teacherEmail) {
  // SUMMARY MODE: return scheme metadata + progress numbers (but NOT full session arrays)
  // Goal: render chapter name + progress bar immediately on load.

  const normKey = function(v) { return String(v || '').toLowerCase().trim(); };
  const teacherEmailNorm = String(teacherEmail || '').toLowerCase().trim();
  const settings = _getLessonPlanSettings();
  const useIndex = !!settings.useTeacherSchemeProgressIndex;

  // OPTIONAL INDEX (safe, additive): If a TeacherSchemeProgress sheet exists and is populated,
  // use it to avoid scanning LessonPlans on every request. If missing/invalid, fall back to
  // current behavior with no functional changes.
  function _slmTryGetSheetNoCreate_(name) {
    try {
      const ss = _ss();
      return ss ? ss.getSheetByName(name) : null;
    } catch (e) {
      return null;
    }
  }

  function _slmReadTeacherSchemeProgressIndexSafe_(teacherEmailNormLocal) {
    try {
      const sh = _slmTryGetSheetNoCreate_('TeacherSchemeProgress');
      if (!sh) return null;
      const headers = _headers(sh);
      const teacherCol = _slmFindColumnIndex_(headers, 'teacherEmail');
      const schemeCol = _slmFindColumnIndex_(headers, 'schemeId');
      const plannedCol = _slmFindColumnIndex_(headers, 'plannedSessions');
      if (teacherCol === -1 || schemeCol === -1 || plannedCol === -1) return null;

      const rowNumbers = _slmRowNumbersByExactValue_(sh, teacherCol, teacherEmailNormLocal);
      if (!rowNumbers || rowNumbers.length === 0) return null;
      const rows = _slmReadRowsBatched_(sh, headers, rowNumbers);
      if (!rows || rows.length === 0) return null;

      const out = new Map(); // schemeId -> plannedSessions
      for (const r of rows) {
        if (!r || typeof r !== 'object') continue;
        const sid = String(r.schemeId || '').trim();
        if (!sid) continue;
        const n = Number(r.plannedSessions);
        // If duplicates exist, last write wins (reads are in sheet order).
        out.set(sid, isNaN(n) ? 0 : n);
      }
      return out.size > 0 ? out : null;
    } catch (e) {
      return null;
    }
  }

  function _parseSchemeChaptersLite_(scheme) {
    try {
      const chapters = [];
      if (scheme && scheme.chapter && String(scheme.chapter).trim() !== '') {
        chapters.push({ number: 1, name: String(scheme.chapter).trim() });
        return chapters;
      }
      const content = (scheme && (scheme.content || scheme.chapters)) ? String(scheme.content || scheme.chapters) : '';
      if (!content) return chapters;
      const lines = content.split('\n').map(s => String(s || '').trim()).filter(Boolean);
      const chapterLines = lines.filter(line =>
        line.toLowerCase().includes('chapter') ||
        line.toLowerCase().includes('unit') ||
        /^\d+\.\s+/.test(line)
      );
      for (let i = 0; i < chapterLines.length; i++) {
        const line = chapterLines[i];
        const m = line.match(/(\d+)[\.:]\s*(.+)/);
        if (m) chapters.push({ number: parseInt(m[1], 10), name: String(m[2] || '').trim() });
        else chapters.push({ number: i + 1, name: line });
      }
      return chapters;
    } catch (e) {
      return [];
    }
  }

  // Planned sessions counts (prefer index if available)
  const plannedCountByScheme = useIndex
    ? _slmReadTeacherSchemeProgressIndexSafe_(teacherEmailNorm)
    : null;

  // FALLBACK: Fetch ONLY this teacher's lesson plans and compute planned counts.
  // Prefer TextFinder-based fetch (does not scan whole sheet).
  let plannedByScheme = null; // schemeId -> Set(chapter|session)
  if (!plannedCountByScheme) {
    let teacherPlans = [];
    try {
      const fetched = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmailNorm);
      if (fetched && Array.isArray(fetched.rows)) teacherPlans = fetched.rows;
    } catch (e) {}
    if (!teacherPlans || teacherPlans.length === 0) {
      try {
        const all = _getCachedSheetData('LessonPlans').data;
        teacherPlans = (all || []).filter(p => String(p.teacherEmail || '').toLowerCase().trim() === teacherEmailNorm);
      } catch (e) {
        teacherPlans = [];
      }
    }

    plannedByScheme = new Map();
    const isActivePlan = function(p) {
      const st = normKey(p && p.status);
      return st && !['cancelled', 'rejected', 'completed early', 'skipped'].includes(st);
    };
    for (const p of teacherPlans) {
      if (!p || typeof p !== 'object') continue;
      const sid = String(p.schemeId || '').trim();
      if (!sid) continue;
      if (!isActivePlan(p)) continue;
      const ch = normKey(p.chapter);
      const sess = Number(p.session || 0);
      const key = `${ch}|${isNaN(sess) ? 0 : sess}`;
      if (!plannedByScheme.has(sid)) plannedByScheme.set(sid, new Set());
      plannedByScheme.get(sid).add(key);
    }
  }

  const schemes = approvedSchemes.map(scheme => {
    let totalChapters = 0;
    let firstChapterName = '';
    let firstChapterNumber = '';

    const chaptersLite = _parseSchemeChaptersLite_(scheme);
    totalChapters = Array.isArray(chaptersLite) ? chaptersLite.length : 0;
    if (totalChapters > 0) {
      const first = chaptersLite[0] || {};
      firstChapterName = String(first.name || '').trim();
      firstChapterNumber = first.number != null ? String(first.number) : '';
    }

    const baseSessions = parseInt(scheme && scheme.noOfSessions ? scheme.noOfSessions : 0, 10);
    const sessionsPerChapter = isNaN(baseSessions) ? 0 : baseSessions;
    const computedTotalSessions = sessionsPerChapter * Math.max(1, totalChapters || 0);

    const sid = String(scheme.schemeId || '').trim();
    let plannedSessions = 0;
    if (plannedCountByScheme) {
      const n = Number(plannedCountByScheme.get(sid) || 0);
      plannedSessions = isNaN(n) ? 0 : n;
    } else if (plannedByScheme) {
      const plannedSet = plannedByScheme.get(sid);
      plannedSessions = plannedSet ? plannedSet.size : 0;
    }
    plannedSessions = Math.max(0, Math.min(computedTotalSessions, Number(plannedSessions) || 0));
    const overallProgress = computedTotalSessions > 0 ? Math.min(100, Math.round((plannedSessions / computedTotalSessions) * 100)) : 0;

    return {
      schemeId: scheme.schemeId,
      class: scheme.class,
      subject: scheme.subject,
      academicYear: scheme.academicYear,
      term: scheme.term,
      totalChapters: totalChapters,
      firstChapterName: firstChapterName,
      firstChapterNumber: firstChapterNumber,
      totalSessions: computedTotalSessions,
      plannedSessions: plannedSessions,
      overallProgress: overallProgress,
      createdAt: scheme.createdAt,
      approvedAt: scheme.approvedAt,
      // No chapters array - lazy load on demand
      chaptersLoaded: false
    };
  });
  
  const dateRange = _calculateLessonPlanningDateRange();
  
  return {
    success: true,
    summaryOnly: true,
    schemes: schemes,
    planningDateRange: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      deferredDays: dateRange.deferredDays,
      daysAhead: dateRange.daysAhead,
      preparationDay: dateRange.preparationDay,
      isPreparationDay: dateRange.isPreparationDay,
      canSubmit: dateRange.canSubmit
    },
    settings: settings,
    summary: {
      totalSchemes: schemes.length,
      totalSessions: schemes.reduce((sum, s) => sum + s.totalSessions, 0),
      plannedSessions: schemes.reduce((sum, s) => sum + s.plannedSessions, 0),
      overallProgress: schemes.length > 0 ? 
        Math.round(schemes.reduce((sum, s) => sum + s.overallProgress, 0) / schemes.length) : 0
    }
  };
}

/**
 * OPTIONAL/SAFE: Build or refresh the TeacherSchemeProgress index for one teacher.
 * This is not called automatically by production flows to avoid side effects.
 * Run manually (Apps Script editor) or wire into write-paths later if desired.
 *
 * Index sheet: TeacherSchemeProgress
 * Columns (minimum): teacherEmail, schemeId, plannedSessions, updatedAt
 */
function rebuildTeacherSchemeProgressIndexForTeacher(teacherEmail) {
  const normKey = function(v) { return String(v || '').toLowerCase().trim(); };
  const teacherEmailNorm = normKey(teacherEmail);
  if (!teacherEmailNorm) return { success: false, error: 'teacherEmail is required' };

  // Fetch teacher lesson plans (fast path by teacherEmail)
  let teacherPlans = [];
  try {
    const fetched = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmailNorm);
    if (fetched && Array.isArray(fetched.rows)) teacherPlans = fetched.rows;
  } catch (e) {}
  if (!teacherPlans || teacherPlans.length === 0) {
    try {
      const all = _getCachedSheetData('LessonPlans').data;
      teacherPlans = (all || []).filter(p => normKey(p.teacherEmail) === teacherEmailNorm);
    } catch (e) {
      teacherPlans = [];
    }
  }

  const isActivePlan = function(p) {
    const st = normKey(p && p.status);
    return st && !['cancelled', 'rejected', 'completed early', 'skipped'].includes(st);
  };

  // schemeId -> Set(chapter|session)
  const plannedByScheme = new Map();
  for (const p of teacherPlans) {
    if (!p || typeof p !== 'object') continue;
    const sid = String(p.schemeId || '').trim();
    if (!sid) continue;
    if (!isActivePlan(p)) continue;
    const ch = normKey(p.chapter);
    const sess = Number(p.session || 0);
    const key = `${ch}|${isNaN(sess) ? 0 : sess}`;
    if (!plannedByScheme.has(sid)) plannedByScheme.set(sid, new Set());
    plannedByScheme.get(sid).add(key);
  }

  // Ensure index sheet + headers
  const sh = _getSheet('TeacherSchemeProgress');
  _ensureHeaders(sh, ['teacherEmail', 'schemeId', 'plannedSessions', 'updatedAt']);
  const headers = _headers(sh);
  const teacherCol = _slmFindColumnIndex_(headers, 'teacherEmail');
  const schemeCol = _slmFindColumnIndex_(headers, 'schemeId');
  const plannedCol = _slmFindColumnIndex_(headers, 'plannedSessions');
  const updatedCol = _slmFindColumnIndex_(headers, 'updatedAt');
  if (teacherCol === -1 || schemeCol === -1 || plannedCol === -1 || updatedCol === -1) {
    return { success: false, error: 'TeacherSchemeProgress headers missing/invalid' };
  }

  // Find existing rows for this teacher and map schemeId -> row
  const existingRowByScheme = new Map();
  const existingRows = _slmRowNumbersByExactValue_(sh, teacherCol, teacherEmailNorm);
  for (const r of existingRows) {
    const sid = String(sh.getRange(r, schemeCol + 1).getValue() || '').trim();
    if (sid && !existingRowByScheme.has(sid)) existingRowByScheme.set(sid, r);
  }

  const nowIso = new Date().toISOString();
  const toAppend = [];
  let updated = 0;

  for (const [sid, set] of plannedByScheme.entries()) {
    const count = set ? set.size : 0;
    const existingRow = existingRowByScheme.get(sid);
    if (existingRow) {
      sh.getRange(existingRow, plannedCol + 1).setValue(count);
      sh.getRange(existingRow, updatedCol + 1).setValue(nowIso);
      // keep normalized teacherEmail/schemeId consistent
      sh.getRange(existingRow, teacherCol + 1).setValue(teacherEmailNorm);
      sh.getRange(existingRow, schemeCol + 1).setValue(sid);
      updated++;
    } else {
      const row = [];
      row[teacherCol] = teacherEmailNorm;
      row[schemeCol] = sid;
      row[plannedCol] = count;
      row[updatedCol] = nowIso;
      // Fill any other columns with blank
      const full = new Array(headers.length).fill('');
      for (let i = 0; i < row.length; i++) if (row[i] !== undefined) full[i] = row[i];
      toAppend.push(full);
    }
  }

  if (toAppend.length > 0) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, toAppend.length, headers.length).setValues(toAppend);
  }

  return {
    success: true,
    teacherEmail: teacherEmailNorm,
    schemesIndexed: plannedByScheme.size,
    updatedRows: updated,
    appendedRows: toAppend.length
  };
}

/**
 * Get detailed chapter/session breakdown for a specific scheme (lazy loading)
 * PERFORMANCE: Only fetches details for one scheme instead of all schemes
 */
function getSchemeDetails(schemeId, teacherEmail) {
  try {
    if (!schemeId || !teacherEmail) {
      return { success: false, error: 'schemeId and teacherEmail are required' };
    }
    
    const cacheKey = generateCacheKey('scheme_details', { id: schemeId, email: teacherEmail, v: 'v2026-02-10-report-fallback' });
    
    return getCachedData(cacheKey, function() {
      return _fetchSchemeDetails(schemeId, teacherEmail);
    }, CACHE_TTL.MEDIUM);
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== FAST ROW FETCH HELPERS (avoid full-sheet reads) =====
function _slmNormHeader_(h) {
  return String(h || '').trim().toLowerCase();
}

function _slmEscapeRegex_(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _slmFindColumnIndex_(headers, headerName) {
  const want = _slmNormHeader_(headerName);
  for (let i = 0; i < headers.length; i++) {
    if (_slmNormHeader_(headers[i]) === want) return i;
  }
  return -1;
}

function _slmRowNumbersByExactValue_(sh, colIndex0, value) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const want = String(value || '').trim();
  if (!want) return [];
  const colRange = sh.getRange(2, colIndex0 + 1, lastRow - 1, 1);
  const re = `^\\s*${_slmEscapeRegex_(want)}\\s*$`;
  const finder = colRange.createTextFinder(re).useRegularExpression(true).matchCase(false);
  const matches = finder.findAll();
  const rows = [];
  for (const m of matches) {
    const r = m.getRow();
    if (r >= 2) rows.push(r);
  }
  // Unique + sort
  return Array.from(new Set(rows)).sort((a, b) => a - b);
}

function _slmReadRowsBatched_(sh, headers, rowNumbers, colNamesFilter) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  if (!rowNumbers || rowNumbers.length === 0) return [];

  // If colNamesFilter provided, compute column indexes to extract
  let colIndexes = null;
  if (Array.isArray(colNamesFilter) && colNamesFilter.length > 0) {
    colIndexes = [];
    for (const name of colNamesFilter) {
      const idx = _slmFindColumnIndex_(headers, name);
      if (idx !== -1) colIndexes.push(idx);
    }
    if (colIndexes.length === 0) colIndexes = null;
  }

  // Batch contiguous row segments to minimize calls.
  const segments = [];
  let segStart = rowNumbers[0];
  let segPrev = rowNumbers[0];
  for (let i = 1; i < rowNumbers.length; i++) {
    const r = rowNumbers[i];
    if (r === segPrev + 1) {
      segPrev = r;
    } else {
      segments.push([segStart, segPrev]);
      segStart = r;
      segPrev = r;
    }
  }
  segments.push([segStart, segPrev]);

  const out = [];
  for (const [start, end] of segments) {
    const numRows = end - start + 1;
    if (colIndexes && colIndexes.length > 0) {
      // Read only the needed column span to reduce data transfer.
      const minIdx = Math.min.apply(null, colIndexes);
      const maxIdx = Math.max.apply(null, colIndexes);
      const span = maxIdx - minIdx + 1;
      const values = sh.getRange(start, minIdx + 1, numRows, span).getValues();

      for (const row of values) {
        const obj = {};
        for (const colIdx of colIndexes) {
          obj[headers[colIdx]] = row[colIdx - minIdx];
        }
        out.push(obj);
      }
    } else {
      // Batch-read ALL columns (one fast API call)
      const values = sh.getRange(start, 1, numRows, lastCol).getValues();
      for (const row of values) out.push(_indexByHeader(row, headers));
    }
  }
  return out;
}

function _slmFetchRowsByColumnExact_(sheetName, headerName, value, colNamesFilter) {
  const sh = _getSheet(sheetName);
  const headers = _headers(sh);
  const colIndex = _slmFindColumnIndex_(headers, headerName);
  if (colIndex === -1) {
    return { headers, rows: null, error: `Column not found: ${headerName}` };
  }
  const rowNumbers = _slmRowNumbersByExactValue_(sh, colIndex, value);
  const rows = _slmReadRowsBatched_(sh, headers, rowNumbers, colNamesFilter);
  return { headers, rows, rowNumbers };
}

function _fetchSchemeDetails(schemeId, teacherEmail) {
  const normKey = function(v) { return String(v || '').toLowerCase().trim(); };
  const schemeIdNorm = String(schemeId || '').trim();
  const teacherEmailNorm = String(teacherEmail || '').toLowerCase();

  // FAST PATH: locate the scheme row by schemeId using TextFinder
  let scheme = null;
  try {
    const sh = _getSheet('Schemes');
    const headers = _headers(sh);
    const schemeIdCol = _slmFindColumnIndex_(headers, 'schemeId');
    if (schemeIdCol !== -1) {
      const rowNumbers = _slmRowNumbersByExactValue_(sh, schemeIdCol, schemeIdNorm);
      const candidates = _slmReadRowsBatched_(sh, headers, rowNumbers);
      scheme = (candidates || []).find(s =>
        String(s.schemeId || '').trim() === schemeIdNorm &&
        String(s.teacherEmail || '').toLowerCase().trim() === teacherEmailNorm &&
        String(s.status || '').toLowerCase().trim() === 'approved'
      ) || null;
    }
  } catch (e) {
    // Fall back below
  }

  // FALLBACK: full-sheet scan (legacy behavior)
  if (!scheme) {
    const schemesData = _getCachedSheetData('Schemes').data;
    scheme = schemesData.find(s =>
      String(s.schemeId || '').trim() === schemeIdNorm &&
      String(s.teacherEmail || '').toLowerCase().trim() === teacherEmailNorm &&
      String(s.status || '').toLowerCase().trim() === 'approved'
    );
  }
  
  if (!scheme) {
    return { success: false, error: 'Scheme not found or not approved' };
  }
  
  // OPTIMIZATION: Filter plans and reports EARLY to only this scheme's class/subject
  const schemeClass = normKey(scheme.class);
  const schemeSubject = normKey(scheme.subject);
  
  // Get existing lesson plans - FAST PATH by teacherEmail (avoid full-sheet read)
  let schemePlans = [];
  try {
    const teacherPlansFetch = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmailNorm);
    if (teacherPlansFetch && Array.isArray(teacherPlansFetch.rows)) {
      schemePlans = teacherPlansFetch.rows.map(_slmNormalizePlanRow_).filter(plan => {
        if (!plan || typeof plan !== 'object') return false;
        const matchesSchemeId = String(plan.schemeId || '').trim() === schemeIdNorm;
        const matchesClassSubject = (
          normKey(plan.class) === schemeClass &&
          normKey(plan.subject) === schemeSubject
        );
        return matchesSchemeId || matchesClassSubject;
      });
    }
  } catch (e) {
    // ignore
  }

  // FALLBACK: full-sheet scan
  if (!schemePlans || schemePlans.length === 0) {
    const existingPlans = _getCachedSheetData('LessonPlans').data;
    schemePlans = existingPlans.filter(plan => {
      if (!plan || typeof plan !== 'object') return false;
      const matchesSchemeId = String(plan.schemeId || '').trim() === schemeIdNorm;
      const matchesClassSubject = (
        normKey(plan.class) === schemeClass &&
        normKey(plan.subject) === schemeSubject &&
        _slmTeacherEmailFromRow_(plan) === teacherEmailNorm
      );
      return matchesSchemeId || matchesClassSubject;
    }).map(_slmNormalizePlanRow_);
  }
  
  // Get daily reports - FAST PATH by teacherEmail
  let schemeReports = [];
  try {
    const teacherReportsFetch = _slmFetchRowsByColumnExact_('DailyReports', 'teacherEmail', teacherEmailNorm);
    if (teacherReportsFetch && Array.isArray(teacherReportsFetch.rows)) {
      schemeReports = teacherReportsFetch.rows.map(_slmNormalizeReportRow_).filter(report => {
        if (!report || typeof report !== 'object') return false;
        return (
          normKey(report.class) === schemeClass &&
          normKey(report.subject) === schemeSubject
        );
      });
    }
  } catch (e) {
    // ignore
  }

  // FALLBACK: full-sheet scan
  if (!schemeReports || schemeReports.length === 0) {
    const allReports = _getCachedSheetData('DailyReports').data;
    schemeReports = allReports.filter(report => {
      if (!report || typeof report !== 'object') return false;
      return (
        normKey(report.class) === schemeClass &&
        normKey(report.subject) === schemeSubject &&
        _slmTeacherEmailFromRow_(report) === teacherEmailNorm
      );
    }).map(_slmNormalizeReportRow_);
  }

  // Filter reports to this scheme window (avoid old reports affecting new scheme)
  const schemeStartMs = _slmSchemeStartMs_(scheme);
  if (schemeStartMs) {
    schemeReports = (schemeReports || []).filter(r => {
      if (!r || typeof r !== 'object') return false;
      const ms = _slmSafeDateMs_(r.date || r.createdAt);
      return !ms || ms >= schemeStartMs;
    });
  }
  
  // Build indexes (only for filtered data)
  const csKey = function(cls, subj) { return `${normKey(cls)}|${normKey(subj)}`; };
  const chapterKey = function(cls, subj, chapter) { return `${csKey(cls, subj)}|${normKey(chapter)}`; };
  const reportSessionKey = function(cls, subj, chapter, sessionNo) {
    const s = Number(sessionNo);
    return `${csKey(cls, subj)}|${normKey(chapter)}|${isNaN(s) ? 0 : s}`;
  };
  const planKey = function(sid, chapter, sessionNo) {
    const s = Number(sessionNo);
    return `${String(sid || '').trim()}|${normKey(chapter)}|${isNaN(s) ? 0 : s}`;
  };
  
  // Plans indexed by (schemeId + chapter + session) - much smaller now!
  const plansByKey = new Map();
  for (const p of schemePlans) {
    if (!p || typeof p !== 'object') continue;
    const planSchemeId = p.schemeId || p.SchemeId || p.schemeID;
    const planChapter = p.chapter || p.Chapter || p.chapterName || p.ChapterName;
    const planSession = p.session || p.sessionNo || p.sessionNumber || p.Session || p.SessionNo;
    const key = planKey(planSchemeId, planChapter, planSession);
    if (!key) continue;
    const existing = plansByKey.get(key);
    if (!existing) {
      plansByKey.set(key, p);
    } else {
      const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const nextTs = new Date(p.updatedAt || p.createdAt || 0).getTime();
      if (nextTs >= existingTs) plansByKey.set(key, p);
    }
  }
  
  // Use shared top-level helper (avoids duplicate inline definitions)
  const isChapterMarkedComplete = _slmIsChapterMarkedComplete_;
  
  // Reports indexed by (class + subject + chapter [+ session]) - much smaller now!
  const hasReportBySession = new Set();
  const reportBySlotKey = new Map();
  const reportsByLessonPlanId = new Map();
  const completedChapters = new Set();
  const _normPeriod_ = function(v) { return String(v || '').replace(/^Period\s*/i, '').trim(); };
  
  for (const r of schemeReports) {
    if (!r || typeof r !== 'object') continue;
    
    const chKey = chapterKey(r.class, r.subject, r.chapter);
    if (chKey && isChapterMarkedComplete(r)) completedChapters.add(chKey);

    const lpId = String(r.lessonPlanId || r.lpId || r.planId || r.id || '').trim();
    if (lpId) {
      if (!reportsByLessonPlanId.has(lpId)) reportsByLessonPlanId.set(lpId, []);
      reportsByLessonPlanId.get(lpId).push(r);
    }

    const rDate = _isoDateString(r.date || r.createdAt || '');
    const rPeriod = _normPeriod_(r.period || r.selectedPeriod || r.sessionPeriod || r.periodNumber || '');
    const rClass = String(r.class || '').trim().toLowerCase();
    const rSubject = String(r.subject || '').trim().toLowerCase();
    if (rDate && rPeriod && rClass && rSubject) {
      const slotKey = `${rDate}|${rPeriod}|${rClass}|${rSubject}`;
      if (!reportBySlotKey.has(slotKey)) reportBySlotKey.set(slotKey, r);
    }
    
    const sessKey = reportSessionKey(r.class, r.subject, r.chapter, r.sessionNo);
    if (sessKey) hasReportBySession.add(sessKey);
  }
  
  // Build chapter details
  const schemeChapters = _parseSchemeChapters(scheme);

  // Implicit completion: if any later chapter has any report, earlier chapters are treated as complete.
  const startedChapterNames = new Set();
  for (const r of schemeReports) {
    if (!r || typeof r !== 'object') continue;
    const name = normKey(r.chapter);
    if (name) startedChapterNames.add(name);
  }

  let maxStartedChapterNumber = 0;
  for (const ch of schemeChapters) {
    const name = normKey(ch && ch.name);
    if (!name) continue;
    if (startedChapterNames.has(name)) {
      const n = Number(ch.number);
      if (Number.isFinite(n) && n > maxStartedChapterNumber) maxStartedChapterNumber = n;
    }
  }

  const completionByChapter = {};
  for (const ch of schemeChapters) {
    const key = normKey(ch && ch.name);
    if (!key) continue;
    const explicitComplete = completedChapters.has(chapterKey(scheme.class, scheme.subject, key));
    const implicitComplete = (Number(ch.number) || 0) < maxStartedChapterNumber;
    completionByChapter[key] = explicitComplete || implicitComplete;
  }
  
  const chaptersWithSessions = [];
  for (let chapterIndex = 0; chapterIndex < schemeChapters.length; chapterIndex++) {
    const chapter = schemeChapters[chapterIndex];
    
    // canPrepare: always true — gate is at scheme submission, not LP preparation.
    const canPrepare = true;
    const gate = null;
    
    const sessions = _generateSessionsForChapter(chapter, scheme);
    const sessionsWithStatus = sessions.map(session => {
      const existingPlan = plansByKey.get(planKey(scheme.schemeId, chapter.name, session.sessionNumber));
      
      let status = 'not-planned';
      let cascadeMarked = false;
      if (existingPlan) {
        const rawStatus = String(existingPlan.status || existingPlan.Status || existingPlan.lessonPlanStatus || 'planned').trim();
        const statusLower = rawStatus.toLowerCase();
        const originalDateRaw = existingPlan.originalDate || existingPlan.OriginalDate || existingPlan['Original Date'] || '';
        const selectedDateRaw = existingPlan.selectedDate || existingPlan.date || '';
        const originalDateNorm = _isoDateString(originalDateRaw);
        const selectedDateNorm = _isoDateString(selectedDateRaw);
        const originalPeriodRaw = existingPlan.originalPeriod || existingPlan.OriginalPeriod || existingPlan['Original Period'] || '';
        const hasOriginalSlotChange = !!(originalDateNorm && selectedDateNorm && originalDateNorm !== selectedDateNorm);
        const isOriginalCascade = /rescheduled\\s*\\(cascade\\)/i.test(rawStatus);
        const cascadeEligible = isOriginalCascade && (hasOriginalSlotChange || String(originalPeriodRaw || '').trim());
        
        let hasReport = hasReportBySession.has(reportSessionKey(scheme.class, scheme.subject, chapter.name, session.sessionNumber));
        const lpId = String(existingPlan.lpId || existingPlan.lessonPlanId || existingPlan.planId || existingPlan.id || '').trim();
        if (!hasReport && lpId && reportsByLessonPlanId.has(lpId)) {
          hasReport = true;
        }
        if (!hasReport) {
          const pDate = _isoDateString(existingPlan.selectedDate || existingPlan.date || '');
          const pPeriod = _normPeriod_(existingPlan.selectedPeriod || existingPlan.period || '');
          const pClass = String(existingPlan.class || scheme.class || '').trim().toLowerCase();
          const pSubject = String(existingPlan.subject || scheme.subject || '').trim().toLowerCase();
          if (pDate && pPeriod && pClass && pSubject) {
            const slotKey = `${pDate}|${pPeriod}|${pClass}|${pSubject}`;
            if (reportBySlotKey.has(slotKey)) hasReport = true;
          }
        }
        
        if (cascadeEligible) {
          cascadeMarked = true;
          if (hasReport && !['cancelled','rejected'].includes(statusLower)) {
            status = 'Reported';
          } else {
            status = 'Cascaded';
          }
        } else if (hasReport && !['cancelled','rejected'].includes(statusLower)) {
          status = 'Reported';
        } else {
          status = rawStatus;
        }
      }
      
      return {
        sessionNumber: session.sessionNumber,
        sessionName: session.sessionName,
        estimatedDuration: session.estimatedDuration,
        status: status,
        plannedDate: existingPlan ? existingPlan.selectedDate : null,
        plannedPeriod: existingPlan ? existingPlan.selectedPeriod : null,
        originalDate: existingPlan ? (_isoDateString(existingPlan.originalDate || existingPlan.OriginalDate || existingPlan['Original Date'] || '') || existingPlan.originalDate || null) : null,
        originalPeriod: existingPlan ? (existingPlan.originalPeriod || existingPlan.OriginalPeriod || existingPlan['Original Period'] || null) : null,
        lessonPlanId: existingPlan ? (existingPlan.lpId || existingPlan.lessonPlanId || existingPlan.planId || existingPlan.id || null) : null,
        cascadeMarked: cascadeMarked
      };
    });
    
    const totalSessions = sessions.length;
    const plannedSessions = sessionsWithStatus.filter(s => {
      const status = String(s.status || '').toLowerCase();
      return status !== 'not-planned' && status !== 'cancelled' && status !== 'rejected';
    }).length;
    
    const currentChapterKey = normKey(chapter && chapter.name);
    const currentChapterCompleted = !!completionByChapter[currentChapterKey];
    
    chaptersWithSessions.push({
      chapterNumber: chapter.number,
      chapterName: chapter.name,
      chapterDescription: chapter.description,
      totalSessions: totalSessions,
      plannedSessions: plannedSessions,
      completionPercentage: totalSessions > 0 ? Math.round((plannedSessions / totalSessions) * 100) : 0,
      sessions: sessionsWithStatus,
      chapterCompleted: currentChapterCompleted,
      canPrepare: canPrepare,
      lockReason: canPrepare ? '' : (gate && gate.message ? gate.message : 'Previous chapter should be completed')
    });
  }
  
  const totalSessions = chaptersWithSessions.reduce((sum, ch) => sum + ch.totalSessions, 0);
  const totalPlanned = chaptersWithSessions.reduce((sum, ch) => sum + ch.plannedSessions, 0);
  
  return {
    success: true,
    schemeId: scheme.schemeId,
    class: scheme.class,
    subject: scheme.subject,
    academicYear: scheme.academicYear,
    term: scheme.term,
    totalChapters: chaptersWithSessions.length,
    totalSessions: totalSessions,
    plannedSessions: totalPlanned,
    overallProgress: totalSessions > 0 ? Math.round((totalPlanned / totalSessions) * 100) : 0,
    chapters: chaptersWithSessions,
    createdAt: scheme.createdAt,
    approvedAt: scheme.approvedAt
  };
}

/**
 * Get available periods for lesson plan scheduling
 * Implements weekly planning cycle: Teachers prepare on configured day for upcoming week
 * NOW FILTERS BY CLASS AND SUBJECT - only shows periods matching the scheme
 */
function getAvailablePeriodsForLessonPlan(teacherEmail, startDate, endDate, excludeExistingPlans = true, schemeClass = '', schemeSubject = '') {
  try {
    // Use the dates passed from frontend (already calculated as next week)
    const planningStartDate = new Date(startDate + 'T00:00:00');
    const planningEndDate = new Date(endDate + 'T00:00:00');
    
    // Get teacher's timetable
    const timetableSheet = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSheet);
    const timetableData = _rows(timetableSheet).map(row => _indexByHeader(row, timetableHeaders));
    
    const teacherTimetable = timetableData.filter(slot =>
      (slot.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );
    
    // Get existing lesson plans to check occupied slots
    let occupiedSlots = [];
    let totalPlansInSheet = 0;
    if (excludeExistingPlans) {
      // Fast path: fetch only this teacher's plans via TextFinder
      let existingPlans = [];
      try {
        const fetched = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmail.toLowerCase().trim(),
          ['lpId', 'teacherEmail', 'class', 'subject', 'status', 'selectedDate', 'selectedPeriod']);
        if (fetched && Array.isArray(fetched.rows)) existingPlans = fetched.rows;
      } catch (_lpFetchErr) {}
      if (existingPlans.length === 0) {
        const lessonPlansSheet = _getSheet('LessonPlans');
        const lessonPlansHeaders = _headers(lessonPlansSheet);
        existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
      }

      totalPlansInSheet = existingPlans.length;
      
      occupiedSlots = existingPlans
        .filter(p => {
          const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail.toLowerCase();
          const hasDate    = p.selectedDate !== undefined && p.selectedDate !== '';
          const hasPeriod  = p.selectedPeriod !== undefined && p.selectedPeriod !== '';
          const statusNorm = String(p.status || '').trim().toLowerCase();
          const active     = !['cancelled','rejected','completed early','skipped'].includes(statusNorm);
          
          return emailMatch && hasDate && hasPeriod && active;
        })
        .map(p => {
          const normalizedDate = _normalizeQueryDate(p.selectedDate);
          const normalizedPeriod = parseInt(String(p.selectedPeriod).trim(), 10);
          return {
            date: normalizedDate,
            period: normalizedPeriod,
            class: p.class,
            subject: p.subject,
            lpId: p.lpId
          };
        });
    }
    
    // Get blocked dates from AcademicCalendar (ExamsHolidaysEventsStart/End)
    const blockedDateRanges = [];
    try {
      const calendarSheet = _getSheet('AcademicCalendar');
      const calendarHeaders = _headers(calendarSheet);
      const calendarRows = _rows(calendarSheet).map(row => _indexByHeader(row, calendarHeaders));
      
      for (const row of calendarRows) {
        const blockStart = row.ExamsHolidaysEventsStart || row.examsHolidaysEventsStart;
        const blockEnd = row.ExamsHolidaysEventsEnd || row.examsHolidaysEventsEnd;
        
        if (blockStart && blockEnd) {
          const startDate = new Date(blockStart);
          const endDate = new Date(blockEnd);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          
          blockedDateRanges.push({
            start: startDate,
            end: endDate,
            startStr: _isoDateString(startDate),
            endStr: _isoDateString(endDate)
          });
        }
      }
    } catch (calErr) {
    }
    
    // Helper function to check if a date is blocked
    const isDateBlocked = (dateStr) => {
      const checkDate = new Date(dateStr);
      checkDate.setHours(0, 0, 0, 0);
      
      return blockedDateRanges.some(range => {
        return checkDate >= range.start && checkDate <= range.end;
      });
    };
    
    // Generate available slots within planning window (Monday-Friday only)
    const availableSlots = [];
    
    for (let date = new Date(planningStartDate); date <= planningEndDate; date.setDate(date.getDate() + 1)) {
      const dateString = _normalizeQueryDate(date); // IST-safe date normalization
      const dayName = _dayNameIST(dateString); // IST-safe day name
      
      // Only show Monday to Friday (weekdays only)
      if (dayName === 'Saturday' || dayName === 'Sunday') continue;
      
      // Skip blocked dates (exams/holidays/events from AcademicCalendar)
      if (isDateBlocked(dateString)) {
        continue;
      }
      
      // Find periods for this day that match the scheme's class and subject
      const dayPeriods = teacherTimetable.filter(slot => {
        const dayMatch = _normalizeDayName(slot.dayOfWeek || '') === _normalizeDayName(dayName);
        // ONLY show periods that match the scheme's class and subject (trim + case-insensitive)
        const classMatch = String(slot.class || '').toLowerCase().trim() === String(schemeClass || '').toLowerCase().trim();
        const subjectMatch = String(slot.subject || '').toLowerCase().trim() === String(schemeSubject || '').toLowerCase().trim();
        
        return dayMatch && classMatch && subjectMatch;
      });
      
      dayPeriods.forEach(period => {
        const periodNum = parseInt(String(period.period).trim(), 10);
        const isOccupied = occupiedSlots.some(occupied => {
          return occupied.date === dateString && occupied.period === periodNum;
        });
        
        const periodTiming = _getPeriodTiming(period.period, dayName, period.class);
        
        availableSlots.push({
          date: dateString,
          dayName: dayName,
          period: period.period,
          startTime: periodTiming.start,
          endTime: periodTiming.end,
          class: period.class,
          subject: period.subject,
          isAvailable: !isOccupied,
          isOccupied: isOccupied,
          occupiedBy: isOccupied ? occupiedSlots.find(o => o.date === dateString && o.period === periodNum) : null
        });
      });
    }
    
    // Sort by date and period
    availableSlots.sort((a, b) => {
      if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
      return parseInt(a.period) - parseInt(b.period);
    });
    
    // Get lesson planning settings including bulkOnly flag
    const settings = _getLessonPlanSettings();
    
    return {
      success: true,
      availableSlots: availableSlots,
      settings: {
        bulkOnly: settings.bulkOnly || false
      },
      summary: {
        totalSlots: availableSlots.length,
        availableSlots: availableSlots.filter(s => s.isAvailable).length,
        occupiedSlots: availableSlots.filter(s => s.isOccupied).length
      },
      debug: {
        totalLessonPlansInSheet: totalPlansInSheet,
        occupiedSlotsFound: occupiedSlots,
        teacherEmail: teacherEmail,
        requestedDateRange: `${startDate} to ${endDate}`,
        schemeFilter: `${schemeClass} ${schemeSubject}`
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get the next available day/period for a specific class and subject.
 * Finds the earliest slot that is free within a rolling 30-day window starting from fromDate (default today).
 * Returns: { success, nextSlot: { date, dayName, period, startTime, endTime, class, subject } | null, searchedRange }
 */
function getNextAvailablePeriodForLessonPlan(teacherEmail, schemeClass, schemeSubject, fromDate) {
  try {
    if (!teacherEmail) return { success: false, error: 'Missing teacherEmail' };
    if (!schemeClass || !schemeSubject) return { success: false, error: 'Missing class or subject' };

    var startISO = _normalizeQueryDate(fromDate || _todayISO());
    var d = new Date(startISO + 'T00:00:00');
    d.setDate(d.getDate() + 30);
    var endISO = Utilities.formatDate(d, _tz_(), 'yyyy-MM-dd');

    var res = getAvailablePeriodsForLessonPlan(teacherEmail, startISO, endISO, true, schemeClass, schemeSubject);
    if (!res || res.success === false) {
      return { success: false, error: (res && res.error) || 'Failed to compute available periods' };
    }

    var slots = Array.isArray(res.availableSlots) ? res.availableSlots : [];
    var next = slots.find(function(s){ return s && s.isAvailable; }) || null;
    return {
      success: true,
      nextSlot: next ? {
        date: next.date,
        dayName: next.dayName,
        period: next.period,
        startTime: next.startTime,
        endTime: next.endTime,
        class: next.class,
        subject: next.subject
      } : null,
      searchedRange: { startDate: startISO, endDate: endISO }
    };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * Create lesson plan for specific scheme chapter session
 * WITH DOCUMENT LOCK AND INTELLIGENT PREPARATION DAY CHECK
 */
function createSchemeLessonPlan(lessonPlanData) {
  var lock = LockService.getDocumentLock();
  try {
    // Get scheme details first to check if this is an extended session
    const schemeDetails = _getSchemeDetails(lessonPlanData.schemeId);
    if (!schemeDetails) {
      return { success: false, error: 'Scheme not found' };
    }
    
    // Parse scheme chapters to get chapter info
    const schemeChapters = _parseSchemeChapters(schemeDetails);
    const chapter = schemeChapters.find(ch => 
      String(ch.name || '').toLowerCase() === String(lessonPlanData.chapter || '').toLowerCase()
    );
    
    if (!chapter) {
      return { success: false, error: 'Chapter not found in scheme' };
    }
    
    // Check if this is an extended session (session number > original scheme session count)
    const sessionNumber = parseInt(lessonPlanData.session, 10) || 0;
    const originalSessionCount = Math.max(0, parseInt(schemeDetails.noOfSessions || 0, 10) || 0);
    const isExtendedSession = sessionNumber > originalSessionCount;
    
    // Check if single session preparation is restricted (but allow extended sessions)
    const settings = _getLessonPlanSettings();
    if (settings.bulkOnly && !isExtendedSession) {
      return { 
        success: false, 
        error: 'Single session preparation is disabled. Please use "Prepare All Sessions Together" for the entire chapter.',
        reason: 'bulk_only_mode'
      };
    }
    
    // Validate required fields first
    const requiredFields = ['schemeId', 'chapter', 'session', 'teacherEmail', 'selectedDate', 'selectedPeriod'];
    const missing = requiredFields.filter(field => !String(lessonPlanData[field] ?? '').trim());
    if (missing.length) {
      const errorMsg = `Missing required field(s): ${missing.join(', ')}`;
      return { success: false, error: errorMsg };
    }

    // Enforce mandatory pedagogy fields
    const pedagogyMissing = [];
    if (!String(lessonPlanData.learningObjectives || '').trim()) pedagogyMissing.push('learningObjectives');
    if (!String(lessonPlanData.teachingMethods || '').trim()) pedagogyMissing.push('teachingMethods');
    if (pedagogyMissing.length) {
      const errorMsg = `Missing required field(s): ${pedagogyMissing.join(', ')}`;
      return { success: false, error: errorMsg };
    }
    
    // Pre-checks BEFORE acquiring lock (fast fail)
    const duplicateCheck = _checkForDuplicateLessonPlan(
      lessonPlanData.schemeId,
      lessonPlanData.chapter,
      lessonPlanData.session,
      lessonPlanData.teacherEmail
    );
    if (!duplicateCheck.success) {
      return duplicateCheck;
    }
    
    const fastPeriodCheck = _validatePeriodAvailability(
      lessonPlanData.teacherEmail,
      lessonPlanData.selectedDate,
      lessonPlanData.selectedPeriod
    );
    if (!fastPeriodCheck.success) {
      return fastPeriodCheck;
    }
    
    // Acquire document lock to prevent race conditions
    lock.waitLock(5000);
    
    // Re-validate period availability inside the lock
    const periodCheck = _validatePeriodAvailability(
      lessonPlanData.teacherEmail,
      lessonPlanData.selectedDate,
      lessonPlanData.selectedPeriod
    );
    if (!periodCheck.success) {
      return periodCheck;
    }
    
    // Get lesson plans sheet
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    
    // Ensure required columns exist (INCLUDING uniqueKey)
    const requiredHeaders = [
      'lpId', 'schemeId', 'teacherEmail', 'teacherName', 'class', 'subject',
      'chapter', 'session', 'selectedDate', 'selectedPeriod',
      'learningObjectives', 'teachingMethods', 'resourcesRequired', 'assessmentMethods',
      'status', 'createdAt', 'submittedAt', 'isDuplicate', 'lessonType',
      'reviewComments', 'reviewedAt', 'uniqueKey' // NEW: Unique constraint column
    ];
    _ensureHeaders(lessonPlansSheet, requiredHeaders);
    
    // Refresh headers after ensuring they exist
    const finalHeaders = _headers(lessonPlansSheet);
    
    // Generate lesson plan ID and unique key
    const lpId = _generateId('LP_');
    const timestamp = new Date().toISOString();
    const isoDate = _isoDateString(lessonPlanData.selectedDate);
    const periodStr = String(lessonPlanData.selectedPeriod).trim();
    const uniqueKey = `${(lessonPlanData.teacherEmail || '').toLowerCase()}|${isoDate}|${periodStr}`;
    
    // Hard guard: Check for existing record with same unique key
    const rows = _rows(lessonPlansSheet);
    const records = rows.map(r => _indexByHeader(r, finalHeaders));
    const clash = records.find(rec =>
      (rec.uniqueKey || '').toLowerCase() === uniqueKey.toLowerCase() &&
      !['Cancelled', 'Rejected'].includes(String(rec.status || '').trim())
    );
    
    if (clash) {
      const errorMsg = `Period ${periodStr} on ${isoDate} is already occupied by ${clash.class || ''} ${clash.subject || ''} (Lesson Plan: ${clash.lpId || ''})`;
      return { success: false, error: errorMsg };
    }
    
    // Prepare row data
    const finalStatus = lessonPlanData.status === 'submitted' ? 'Pending Review' : (lessonPlanData.status || 'draft');
    
    // Get teacher name from Users sheet instead of using the passed name
    let teacherName = lessonPlanData.teacherName || '';
    try {
      const usersSheet = _getSheet('Users');
      const usersHeaders = _headers(usersSheet);
      const usersRows = _rows(usersSheet);
      const userRecord = usersRows
        .map(r => _indexByHeader(r, usersHeaders))
        .find(u => (u.email || '').toLowerCase() === (lessonPlanData.teacherEmail || '').toLowerCase());
      if (userRecord && userRecord.name) {
        teacherName = userRecord.name;
      }
    } catch (err) {
    }
    
    const rowObject = {
      lpId: lpId,
      schemeId: lessonPlanData.schemeId,
      teacherEmail: lessonPlanData.teacherEmail,
      teacherName: teacherName,
      class: schemeDetails.class || lessonPlanData.class || '',
      subject: schemeDetails.subject || lessonPlanData.subject || '',
      chapter: lessonPlanData.chapter,
      session: lessonPlanData.session,
      selectedDate: isoDate,
      selectedPeriod: periodStr,
      learningObjectives: lessonPlanData.learningObjectives || '',
      teachingMethods: lessonPlanData.teachingMethods || '',
      resourcesRequired: lessonPlanData.resourcesRequired || '',
      assessmentMethods: lessonPlanData.assessmentMethods || '',
      status: finalStatus,
      createdAt: timestamp,
      submittedAt: finalStatus === 'Pending Review' ? timestamp : '',
      isDuplicate: false,
      lessonType: 'scheme-based',
      reviewComments: '',
      reviewedAt: '',
      uniqueKey: uniqueKey
    };
    
    // Align row data to header order
    const rowData = finalHeaders.map(h => rowObject[h] !== undefined ? rowObject[h] : '');
    
    // Append the row
    lessonPlansSheet.appendRow(rowData);

    try {
      logAudit({
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITIES.LESSON_PLAN,
        entityId: lpId,
        userEmail: String(lessonPlanData.teacherEmail || '').toLowerCase().trim(),
        userName: String(teacherName || '').trim(),
        userRole: 'Teacher',
        description: `Lesson plan created for ${lessonPlanData.chapter} session ${lessonPlanData.session}`,
        severity: AUDIT_SEVERITY.INFO
      });
    } catch (auditErr) { /* ignore audit failures */ }
    
    return {
      success: true,
      lessonPlanId: lpId,
      message: `Lesson plan created successfully (${preparationCheck.reason})`,
      data: {
        lpId: lpId,
        schemeId: lessonPlanData.schemeId,
        chapter: lessonPlanData.chapter,
        session: lessonPlanData.session,
        selectedDate: isoDate,
        selectedPeriod: periodStr,
        uniqueKey: uniqueKey,
        preparationReason: preparationCheck.reason
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    // Always release the lock
    try {
      lock.releaseLock();
    } catch (e) {
    }
  }
}

/**
 * Check if a teacher can submit a new scheme for a given class/subject.
 * GATE: All previously started schemes for this class/subject must have:
 *   1. All lesson-plan sessions covered by daily reports
 *   2. Last session marked "Chapter Complete"
 *
 * @param {string} teacherEmail
 * @param {string} classValue
 * @param {string} subject
 * @returns {{ allowed: boolean, reason?: string, message?: string }}
 */
function canSubmitNewScheme(teacherEmail, classValue, subject) {
  try {
    if (!teacherEmail || !classValue || !subject) return { allowed: true };

    const norm = function(v) { return String(v || '').toLowerCase().trim(); };
    const teacherKey = norm(teacherEmail);
    const classKey   = norm(classValue);
    const subjectKey = norm(subject);

    // ── 1. Fetch all approved schemes for this teacher / class / subject ──────
    let teacherSchemes = [];
    try {
      const f = _slmFetchRowsByColumnExact_('Schemes', 'teacherEmail', teacherKey);
      if (f && Array.isArray(f.rows)) teacherSchemes = f.rows;
    } catch (e) {}
    if (!teacherSchemes.length) {
      try { teacherSchemes = (_getCachedSheetData('Schemes').data || []); } catch (e) {}
    }

    const relevantSchemes = teacherSchemes.filter(function(s) {
      return norm(s.teacherEmail) === teacherKey &&
             norm(s.class)        === classKey &&
             norm(s.subject)      === subjectKey &&
             norm(s.status)       === 'approved';
    });

    if (!relevantSchemes.length) return { allowed: true };

    // ── 2. Fetch lesson plans ─────────────────────────────────────────────────
    let teacherPlans = [];
    try {
      const f = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherKey);
      if (f && Array.isArray(f.rows)) teacherPlans = f.rows.map(_slmNormalizePlanRow_);
    } catch (e) {}
    if (!teacherPlans.length) {
      try { teacherPlans = (_getCachedSheetData('LessonPlans').data || []).map(_slmNormalizePlanRow_); } catch (e) {}
    }

    // ── 3. Fetch daily reports ────────────────────────────────────────────────
    let teacherReports = [];
    try {
      const f = _slmFetchRowsByColumnExact_('DailyReports', 'teacherEmail', teacherKey);
      if (f && Array.isArray(f.rows)) teacherReports = f.rows.map(_slmNormalizeReportRow_);
    } catch (e) {}
    if (!teacherReports.length) {
      try { teacherReports = (_getCachedSheetData('DailyReports').data || []).map(_slmNormalizeReportRow_); } catch (e) {}
    }

    // ── 4. Build lookup maps (schemeId → sessions) ────────────────────────────
    // Planned sessions per schemeId
    const plansByScheme = new Map();
    for (var _p of teacherPlans) {
      if (norm(_p.class) !== classKey || norm(_p.subject) !== subjectKey) continue;
      var _sid = String(_p.schemeId || '').trim();
      var _sess = Number(_p.session || 0);
      if (!_sid || !_sess) continue;
      if (!plansByScheme.has(_sid)) plansByScheme.set(_sid, new Set());
      plansByScheme.get(_sid).add(_sess);
    }

    // Reports per schemeId
    const reportsByScheme = new Map();
    for (var _r of teacherReports) {
      if (norm(_r.class) !== classKey || norm(_r.subject) !== subjectKey) continue;
      var _rsid = String(_r.schemeId || '').trim();
      var _rsess = Number(_r.sessionNo || 0);
      if (!_rsid || !_rsess) continue;
      if (!reportsByScheme.has(_rsid)) reportsByScheme.set(_rsid, []);
      reportsByScheme.get(_rsid).push(_r);
    }

    // ── 5. Check each relevant scheme ─────────────────────────────────────────
    var incomplete = [];
    for (var _s of relevantSchemes) {
      var sid = String(_s.schemeId || '').trim();
      var chapterName = String(_s.chapter || sid);
      var plans   = plansByScheme.get(sid);
      var reports  = reportsByScheme.get(sid) || [];

      // No lesson plans yet → scheme not started → skip
      if (!plans || plans.size === 0) continue;

      var plannedSessions = Array.from(plans).sort(function(a, b) { return a - b; });
      var lastSessionNo   = Math.max.apply(null, plannedSessions);

      // Check every planned session has a daily report
      var missingSessions = plannedSessions.filter(function(s) {
        return !reports.find(function(r) { return Number(r.sessionNo) === s; });
      });

      if (missingSessions.length > 0) {
        incomplete.push(chapterName + ' (Sessions not yet reported: ' + missingSessions.join(', ') + ')');
        continue;
      }

      // Check the last session is marked "Chapter Complete"
      var lastReports = reports
        .filter(function(r) { return Number(r.sessionNo) === lastSessionNo; })
        .sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
      var lastReport = lastReports[0];

      if (!lastReport || !_slmIsChapterMarkedComplete_(lastReport)) {
        incomplete.push(chapterName + ' (Last session not marked "Chapter Complete")');
      }
    }

    if (incomplete.length > 0) {
      return {
        allowed: false,
        reason: 'previous_scheme_incomplete',
        message: 'Cannot submit new scheme. Complete the previous chapter(s) first:\n• ' + incomplete.join('\n• ')
      };
    }

    return { allowed: true };
  } catch (e) {
    console.error('canSubmitNewScheme error:', e);
    return { allowed: true }; // fail-open: don't block on unexpected errors
  }
}

/**
 * Create multiple lesson plans for all sessions of a chapter at once
 * BULK OPERATION: Auto-assigns next N available periods
 */
function createBulkSchemeLessonPlans(bulkData) {
  var lock = LockService.getDocumentLock();
  try {
    // Validate required bulk fields
    const requiredFields = ['schemeId', 'chapter', 'sessionCount', 'teacherEmail'];
    const missing = requiredFields.filter(field => !String(bulkData[field] ?? '').trim());
    if (missing.length) {
      return { success: false, error: `Missing required fields: ${missing.join(', ')}` };
    }
    
    // Validate pedagogy fields (common for all sessions)
    if (!String(bulkData.learningObjectives || '').trim()) {
      return { success: false, error: 'Learning objectives are required' };
    }
    if (!String(bulkData.teachingMethods || '').trim()) {
      return { success: false, error: 'Teaching methods are required' };
    }
    
    // Get scheme details
    const schemeDetails = _getSchemeDetails(bulkData.schemeId);
    if (!schemeDetails) {
      return { success: false, error: 'Scheme not found' };
    }

    // Get available periods for this class/subject
    const sessionCount = parseInt(bulkData.sessionCount);
    const dateRange = _calculateLessonPlanningDateRange();
    
    const periodsResult = getAvailablePeriodsForLessonPlan(
      bulkData.teacherEmail,
      dateRange.startDate,
      dateRange.endDate,
      true, // exclude existing
      schemeDetails.class,
      schemeDetails.subject
    );
    
    if (!periodsResult.success) {
      return { success: false, error: 'Failed to fetch available periods: ' + periodsResult.error };
    }
    
    const availablePeriods = periodsResult.availableSlots.filter(p => p.isAvailable);
    
    if (availablePeriods.length < sessionCount) {
      return { 
        success: false, 
        error: `Not enough available periods. Need ${sessionCount}, found ${availablePeriods.length}` 
      };
    }
    
    // Acquire lock before creating multiple records
    lock.waitLock(10000);
    
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    _ensureHeaders(lessonPlansSheet, [
      'lpId', 'schemeId', 'teacherEmail', 'teacherName', 'class', 'subject',
      'chapter', 'session', 'selectedDate', 'selectedPeriod',
      'learningObjectives', 'teachingMethods', 'resourcesRequired', 'assessmentMethods',
      'status', 'createdAt', 'submittedAt', 'isDuplicate', 'lessonType',
      'reviewComments', 'reviewedAt', 'uniqueKey'
    ]);
    
    const finalHeaders = _headers(lessonPlansSheet);
    const timestamp = new Date().toISOString();
    const createdPlans = [];
    const errors = [];
    
    // Get teacher name from Users sheet instead of using the passed name
    let teacherName = bulkData.teacherName || '';
    try {
      const usersSheet = _getSheet('Users');
      const usersHeaders = _headers(usersSheet);
      const usersRows = _rows(usersSheet);
      const userRecord = usersRows
        .map(r => _indexByHeader(r, usersHeaders))
        .find(u => (u.email || '').toLowerCase() === (bulkData.teacherEmail || '').toLowerCase());
      if (userRecord && userRecord.name) {
        teacherName = userRecord.name;
      }
    } catch (err) {
    }
    
    // Create lesson plans for each session
    for (let i = 0; i < sessionCount; i++) {
      const sessionNumber = i + 1;
      const period = availablePeriods[i];
      
      try {
        const lpId = _generateId('LP_');
        const isoDate = _isoDateString(period.date);
        const periodStr = String(period.period).trim();
        const uniqueKey = `${(bulkData.teacherEmail || '').toLowerCase()}|${isoDate}|${periodStr}`;
        
        // Get session-specific data if provided, otherwise use common/first session data
        const sessionObjectives = (bulkData.sessionObjectives && bulkData.sessionObjectives[i]) 
          ? bulkData.sessionObjectives[i] 
          : bulkData.learningObjectives;
        
        const sessionMethods = (bulkData.sessionMethods && bulkData.sessionMethods[i])
          ? bulkData.sessionMethods[i]
          : bulkData.teachingMethods;
        
        const sessionResources = (bulkData.sessionResources && bulkData.sessionResources[i])
          ? bulkData.sessionResources[i]
          : bulkData.resourcesRequired || '';
        
        const sessionAssessments = (bulkData.sessionAssessments && bulkData.sessionAssessments[i])
          ? bulkData.sessionAssessments[i]
          : bulkData.assessmentMethods || '';
        
        const rowObject = {
          lpId: lpId,
          schemeId: bulkData.schemeId,
          teacherEmail: bulkData.teacherEmail,
          teacherName: teacherName,
          class: schemeDetails.class,
          subject: schemeDetails.subject,
          chapter: bulkData.chapter,
          session: sessionNumber,
          selectedDate: isoDate,
          selectedPeriod: periodStr,
          learningObjectives: sessionObjectives,
          teachingMethods: sessionMethods,
          resourcesRequired: sessionResources,
          assessmentMethods: sessionAssessments,
          status: 'Pending Review',
          createdAt: timestamp,
          submittedAt: timestamp,
          isDuplicate: false,
          lessonType: 'scheme-based',
          reviewComments: '',
          reviewedAt: '',
          uniqueKey: uniqueKey
        };
        
        const rowData = finalHeaders.map(h => rowObject[h] !== undefined ? rowObject[h] : '');
        lessonPlansSheet.appendRow(rowData);
        
        createdPlans.push({
          lpId: lpId,
          session: sessionNumber,
          date: isoDate,
          period: periodStr,
          dayName: period.dayName
        });
        
      } catch (sessionError) {
        errors.push(`Session ${sessionNumber}: ${sessionError.message}`);
      }
    }
    
    if (createdPlans.length === 0) {
      return { 
        success: false, 
        error: 'Failed to create any lesson plans', 
        errors: errors 
      };
    }

    try {
      logAudit({
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITIES.LESSON_PLAN,
        entityId: `bulk:${bulkData.schemeId || ''}:${bulkData.chapter || ''}:${timestamp}`,
        userEmail: String(bulkData.teacherEmail || '').toLowerCase().trim(),
        userName: String(teacherName || '').trim(),
        userRole: 'Teacher',
        description: `Bulk lesson plans created (${createdPlans.length} sessions)`,
        severity: AUDIT_SEVERITY.INFO
      });
    } catch (auditErr) { /* ignore audit failures */ }
    
    return {
      success: true,
      message: `Created ${createdPlans.length} lesson plans successfully`,
      createdCount: createdPlans.length,
      requestedCount: sessionCount,
      plans: createdPlans,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    try { if (lock) lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Parse scheme chapters from scheme content
 */
function _parseSchemeChapters(scheme) {
  try {
    // Try to parse chapters from scheme content
    const content = scheme.content || scheme.chapters || '';
    const chapters = [];
    
    // FIRST: Check if scheme has a direct 'chapter' field (single chapter scheme)
    if (scheme.chapter && String(scheme.chapter).trim() !== '') {
      const chapterName = String(scheme.chapter).trim();
      
      // Create a single chapter entry
      chapters.push({
        number: 1,
        name: chapterName,
        description: `${chapterName} - ${scheme.subject || 'Subject'} for ${scheme.class || ''}`
      });
      
      return chapters;
    }
    
    // SECOND: Try to parse structured content
    if (content) {
      // Split by chapter indicators
      const chapterLines = content.split('\n').filter(line => 
        line.toLowerCase().includes('chapter') || 
        line.toLowerCase().includes('unit') ||
        line.match(/^\d+\.\s/)
      );
      
      chapterLines.forEach((line, index) => {
        const chapterMatch = line.match(/(\d+)[\.\:]\s*(.+)/);
        if (chapterMatch) {
          chapters.push({
            number: parseInt(chapterMatch[1]),
            name: chapterMatch[2].trim(),
            description: chapterMatch[2].trim()
          });
        } else {
          chapters.push({
            number: index + 1,
            name: line.trim(),
            description: line.trim()
          });
        }
      });
    }
    
    // If still no chapters found, return error - NO MOCK DATA
    if (chapters.length === 0) {
      // Return a clear error instead of generating fake data
      return [{
        number: 1,
        name: 'ERROR: No Chapter Data',
        description: 'This scheme has no chapter information. Please edit the scheme to add chapter details.'
      }];
    }
    
    return chapters;
  } catch (error) {
    return [{ number: 1, name: 'Chapter 1', description: 'Default Chapter' }];
  }
}

/**
 * Generate sessions for a chapter
 * Includes original sessions + extended sessions if needed based on completion rates
 */
function _generateSessionsForChapter(chapter, scheme) {
  try {
    // USE THE SCHEME'S noOfSessions FIELD - this is the actual number the teacher specified
    let originalSessionCount = parseInt(scheme.noOfSessions || 2);
    
    // Check daily reports to see if extended sessions are needed
    // LOGIC: Show extended session if all original sessions have reports BUT chapter is NOT marked complete
    // AND the teacher has NOT started any later chapter (reports) in this scheme.
    let extendedSessionCount = originalSessionCount;

    const _norm = (v) => String(v || '').toLowerCase().trim();
    // Use shared top-level helper (avoids duplicate inline definitions)
    const _isChapterMarkedCompleteReport = _slmIsChapterMarkedComplete_;
    try {
      const teacherEmailNorm = String(scheme.teacherEmail || '').toLowerCase().trim();
      const classNorm = String(scheme.class || '').trim();
      const subjectNorm = String(scheme.subject || '').trim();
      const chapterNameNorm = String(chapter.name || '').trim();
      const classKey = String(classNorm || '').toLowerCase().trim();
      const subjectKey = String(subjectNorm || '').toLowerCase().trim();
      const chapterKey = String(chapterNameNorm || '').toLowerCase().trim();

      // PERFORMANCE: Fetch only this teacher's DailyReports (TextFinder) and cache per-request.
      let teacherReports = null;
      try {
        if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher) REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher = {};
          teacherReports = REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher[teacherEmailNorm] || null;
        }
      } catch (e) {}

      if (!teacherReports) {
        try {
          const fetched = _slmFetchRowsByColumnExact_('DailyReports', 'teacherEmail', teacherEmailNorm);
          if (fetched && Array.isArray(fetched.rows)) teacherReports = fetched.rows;
        } catch (e) {}
      }

      // Fallback: request-scoped full-sheet cache (still only one read per request)
      if (!teacherReports) {
        teacherReports = (_getCachedSheetData('DailyReports').data || []);
      }

      try {
        if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE && teacherReports && teacherEmailNorm) {
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher) REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher = {};
          REQUEST_SHEET_CACHE.__slmDailyReportsByTeacher[teacherEmailNorm] = teacherReports;
        }
      } catch (e) {}

      // Build (and cache) lessonPlanId -> schemeId map so we can scope reports by schemeId.
      let schemeIdByLpId = null;
      try {
        if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
          if (!REQUEST_SHEET_CACHE.__slmSchemeIdByLpId) REQUEST_SHEET_CACHE.__slmSchemeIdByLpId = {};
          schemeIdByLpId = REQUEST_SHEET_CACHE.__slmSchemeIdByLpId[teacherEmailNorm] || null;
        }
      } catch (e) {}

      if (!schemeIdByLpId) {
        schemeIdByLpId = new Map();
        try {
          const fetchedPlans = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', teacherEmailNorm, [
            'lpId', 'lessonPlanId', 'planId', 'id', 'schemeId', 'teacherEmail'
          ]);
          const rows = fetchedPlans && Array.isArray(fetchedPlans.rows) ? fetchedPlans.rows : [];
          rows.forEach(p => {
            if (!p || typeof p !== 'object') return;
            const lpId = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
            const scId = String(p.schemeId || '').trim();
            if (lpId && scId) schemeIdByLpId.set(lpId, scId);
          });
        } catch (e) {
          const allPlans = _getCachedSheetData('LessonPlans').data || [];
          allPlans.forEach(p => {
            if (!p || typeof p !== 'object') return;
            if (String(p.teacherEmail || '').toLowerCase().trim() !== teacherEmailNorm) return;
            const lpId = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
            const scId = String(p.schemeId || '').trim();
            if (lpId && scId) schemeIdByLpId.set(lpId, scId);
          });
        }
        try {
          if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE && teacherEmailNorm) {
            if (!REQUEST_SHEET_CACHE.__slmSchemeIdByLpId) REQUEST_SHEET_CACHE.__slmSchemeIdByLpId = {};
            REQUEST_SHEET_CACHE.__slmSchemeIdByLpId[teacherEmailNorm] = schemeIdByLpId;
          }
        } catch (e) {}
      }

      const getReportSchemeId = (r) => {
        if (!r || typeof r !== 'object') return '';
        const raw = String(r.schemeId || '').trim();
        if (raw) return raw;
        const lpId = String(r.lessonPlanId || '').trim();
        if (lpId && schemeIdByLpId && schemeIdByLpId.get) return String(schemeIdByLpId.get(lpId) || '').trim();
        return '';
      };
      
      // PERFORMANCE: Avoid scanning teacherReports for every chapter.
      // Build a request-scoped index once: (class|subject|chapter) -> [reports]
      let byCsc = null;
      let byScheme = null;
      try {
        if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByCsc) REQUEST_SHEET_CACHE.__slmDailyReportsByCsc = {};
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByCsc[teacherEmailNorm] && teacherReports) {
            const idx = {};
            for (const r of teacherReports) {
              if (!r || typeof r !== 'object') continue;
              if (String(r.teacherEmail || '').toLowerCase().trim() !== teacherEmailNorm) continue;
              const k = `${String(r.class || '').toLowerCase().trim()}|${String(r.subject || '').toLowerCase().trim()}|${String(r.chapter || '').toLowerCase().trim()}`;
              if (!idx[k]) idx[k] = [];
              idx[k].push(r);
            }
            REQUEST_SHEET_CACHE.__slmDailyReportsByCsc[teacherEmailNorm] = idx;
          }
          byCsc = REQUEST_SHEET_CACHE.__slmDailyReportsByCsc[teacherEmailNorm] || null;
        }
      } catch (e) {
        byCsc = null;
      }

      try {
        if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByScheme) REQUEST_SHEET_CACHE.__slmDailyReportsByScheme = {};
          if (!REQUEST_SHEET_CACHE.__slmDailyReportsByScheme[teacherEmailNorm] && teacherReports) {
            const idx = {};
            for (const r of teacherReports) {
              if (!r || typeof r !== 'object') continue;
              if (String(r.teacherEmail || '').toLowerCase().trim() !== teacherEmailNorm) continue;
              const sid = getReportSchemeId(r);
              if (!sid) continue;
              if (!idx[sid]) idx[sid] = [];
              idx[sid].push(r);
            }
            REQUEST_SHEET_CACHE.__slmDailyReportsByScheme[teacherEmailNorm] = idx;
          }
          byScheme = REQUEST_SHEET_CACHE.__slmDailyReportsByScheme[teacherEmailNorm] || null;
        }
      } catch (e) {
        byScheme = null;
      }

      const schemeIdKey = String(scheme && scheme.schemeId || '').trim();
      const wantKey = `${classKey}|${subjectKey}|${chapterKey}`;
      const bySchemeReports = (byScheme && schemeIdKey) ? (byScheme[schemeIdKey] || []) : null;
      const chapterReports = bySchemeReports
        ? bySchemeReports.filter(report => String(report.chapter || '').toLowerCase().trim() === chapterKey)
        : (byCsc ? (byCsc[wantKey] || []) : (teacherReports || []).filter(report => {
            if (!report || typeof report !== 'object') return false;
            const matchesTeacher = String(report.teacherEmail || '').toLowerCase().trim() === teacherEmailNorm;
            const matchesChapter = String(report.chapter || '').toLowerCase().trim() === chapterKey;
            const matchesClass = String(report.class || '').toLowerCase().trim() === classKey;
            const matchesSubject = String(report.subject || '').toLowerCase().trim() === subjectKey;
            return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
          }));
      
      if (chapterReports.length > 0) {

        // Build O(1) lookup by sessionNo
        const reportBySession = {};
        for (const r of chapterReports) {
          const n = Number(r.sessionNo);
          if (!isNaN(n) && !reportBySession[n]) reportBySession[n] = r;
        }
        
        // Check if ALL original sessions (1 to originalSessionCount) have daily reports
        let allOriginalSessionsHaveReports = true;
        let missingSessions = [];
        
        for (let i = 1; i <= originalSessionCount; i++) {
          const sessionReport = reportBySession[i];
          
          if (!sessionReport) {
            allOriginalSessionsHaveReports = false;
            missingSessions.push(i);
          }
        }
        
        // IMPORTANT: Some sheets mark Chapter Complete in dedicated fields (chapterStatus/chapterCompleted)
        // and it may not always be on the last-session row due to entry quirks.
        // If ANY report row indicates Chapter Complete, do NOT show an extended session.
        const chapterMarkedComplete = chapterReports.some(_isChapterMarkedCompleteReport);

        // If teacher has started a later chapter (has reports), treat this chapter as complete for session generation.
        // This prevents extended sessions appearing for already-moved-on chapters.
        let laterChapterStarted = false;
        try {
          const schemeId = String(scheme && scheme.schemeId || '').trim();

          // Build (and cache per request) chapterName->number map for this scheme
          let numByName = null;
          if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
            if (!REQUEST_SHEET_CACHE.__slmChapterNumByScheme) REQUEST_SHEET_CACHE.__slmChapterNumByScheme = {};
            numByName = REQUEST_SHEET_CACHE.__slmChapterNumByScheme[schemeId] || null;
          }
          if (!numByName) {
            numByName = {};
            const chapters = _parseSchemeChapters(scheme) || [];
            for (const ch of chapters) {
              const nName = String(ch && ch.name || '').toLowerCase().trim();
              const nNum = Number(ch && ch.number);
              if (nName && Number.isFinite(nNum)) numByName[nName] = nNum;
            }
            if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE && schemeId) {
              if (!REQUEST_SHEET_CACHE.__slmChapterNumByScheme) REQUEST_SHEET_CACHE.__slmChapterNumByScheme = {};
              REQUEST_SHEET_CACHE.__slmChapterNumByScheme[schemeId] = numByName;
            }
          }

          const currentNum = Number(chapter && chapter.number) || numByName[String(chapterNameNorm || '').toLowerCase().trim()] || 0;

          // Build started-chapter-name set for this teacher|class|subject once
          const startedKey = `${teacherEmailNorm}|${classKey}|${subjectKey}|${schemeId}`;
          let startedSet = null;
          if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
            if (!REQUEST_SHEET_CACHE.__slmStartedChaptersByCs) REQUEST_SHEET_CACHE.__slmStartedChaptersByCs = {};
            startedSet = REQUEST_SHEET_CACHE.__slmStartedChaptersByCs[startedKey] || null;
          }
          if (!startedSet) {
            startedSet = new Set();
            for (const r of (teacherReports || [])) {
              if (!r || typeof r !== 'object') continue;
              if (String(r.teacherEmail || '').toLowerCase().trim() !== teacherEmailNorm) continue;
              if (String(r.class || '').toLowerCase().trim() !== classKey) continue;
              if (String(r.subject || '').toLowerCase().trim() !== subjectKey) continue;
              const cn = String(r.chapter || '').toLowerCase().trim();
              if (cn) startedSet.add(cn);
            }
            if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
              if (!REQUEST_SHEET_CACHE.__slmStartedChaptersByCs) REQUEST_SHEET_CACHE.__slmStartedChaptersByCs = {};
              REQUEST_SHEET_CACHE.__slmStartedChaptersByCs[startedKey] = startedSet;
            }
          }

          let maxStartedNum = 0;
          startedSet.forEach((cn) => {
            const n = Number(numByName[cn]);
            if (Number.isFinite(n) && n > maxStartedNum) maxStartedNum = n;
          });

          laterChapterStarted = (maxStartedNum > currentNum);
        } catch (_lcErr) {
          laterChapterStarted = false;
        }

        if (allOriginalSessionsHaveReports) {
          // All original sessions have reports - show extended session ONLY if chapter is NOT marked complete
          // and no later chapter has started.
          const lastSessionReport = reportBySession[originalSessionCount];
          const lastSessionMarkedComplete = _isChapterMarkedCompleteReport(lastSessionReport);
          
          if (!laterChapterStarted && !chapterMarkedComplete && !lastSessionMarkedComplete) {
            // All sessions have reports BUT last not marked complete - show extended session
            extendedSessionCount = originalSessionCount + 1;
          }
        }
      }
      
    } catch (drError) {
      // Continue with original session count if error
    }
    
    const sessions = [];
    for (let i = 1; i <= extendedSessionCount; i++) {
      const isExtended = i > originalSessionCount;
      sessions.push({
        sessionNumber: i,
        sessionName: `Session ${i}${isExtended ? ' (Extended)' : ''}`,
        estimatedDuration: '45 minutes',
        isExtended: isExtended
      });
    }
    
    return sessions;
  } catch (error) {
    return [{ sessionNumber: 1, sessionName: 'Session 1', estimatedDuration: '45 minutes', isExtended: false }];
  }
}

/**
 * Check for duplicate lesson plans
 */
function _checkForDuplicateLessonPlan(schemeId, chapter, session, teacherEmail) {
  try {
    const emailNorm = String(teacherEmail || '').toLowerCase().trim();
    const sessionNum = parseInt(session || '1');

    // Fast path: fetch only this teacher's plans via TextFinder (avoids full sheet scan)
    let existingPlans = [];
    try {
      const fetched = _slmFetchRowsByColumnExact_('LessonPlans', 'teacherEmail', emailNorm,
        ['lpId', 'schemeId', 'chapter', 'session', 'selectedDate', 'selectedPeriod', 'status', 'teacherEmail']);
      if (fetched && Array.isArray(fetched.rows)) existingPlans = fetched.rows;
    } catch (_e) {}
    if (!existingPlans || existingPlans.length === 0) {
      const lessonPlansSheet = _getSheet('LessonPlans');
      const headers = _headers(lessonPlansSheet);
      existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    }
    
    const duplicate = existingPlans.find(plan =>
      String(plan.schemeId || '') === String(schemeId || '') &&
      (plan.chapter || '').toLowerCase() === chapter.toLowerCase() &&
      parseInt(plan.session || '1') === sessionNum &&
      (plan.teacherEmail || '').toLowerCase() === emailNorm
    );
    
    if (duplicate) {
      return {
        success: false,
        error: `Lesson plan already exists for ${chapter} Session ${session}`,
        existingPlan: {
          lpId: duplicate.lpId,
          selectedDate: duplicate.selectedDate,
          selectedPeriod: duplicate.selectedPeriod,
          status: duplicate.status
        }
      };
    }
    
    return { success: true };
  } catch (error) {
    return { success: true }; // Assume no duplicate if error
  }
}

/**
 * Validate period availability
 * IMPROVED: IST-safe date handling with fail-closed error handling
 */
function _validatePeriodAvailability(teacherEmail, date, period) {
  try {
    const emailNorm = String(teacherEmail || '').trim().toLowerCase();
    const dateNorm = _normalizeQueryDate(date);
    const periodNorm = String(period).trim();
    const periodNum = parseInt(periodNorm, 10);

    // 1) Must exist in timetable
    const timetableSheet = _getSheet('Timetable');
    const th = _headers(timetableSheet);
    const tt = _rows(timetableSheet).map(r => _indexByHeader(r, th));

    const dayName = _dayNameIST(dateNorm);
    
    const slot = tt.find(s =>
      String(s.teacherEmail || '').trim().toLowerCase() === emailNorm &&
      _normalizeDayName(s.dayOfWeek || '') === _normalizeDayName(dayName) &&
      String(s.period || '').trim() === String(periodNum)
    );

    if (!slot) {
      return { success: false, error: `No timetable slot for ${dayName} Period ${periodNum}` };
    }

    // 2) Block if already taken by ANY non-cancelled LP of this teacher
    const lpSheet = _getSheet('LessonPlans');
    const lh = _headers(lpSheet);
    const plans = _rows(lpSheet).map(r => _indexByHeader(r, lh));

    const clash = plans.find(p => {
      const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === emailNorm;
      const planDateNorm = _normalizeQueryDate(p.selectedDate);
      const dateMatch  = planDateNorm === dateNorm;
      const periodMatch= parseInt(String(p.selectedPeriod || '').trim(),10) === periodNum;
      const statusNorm = String(p.status || '').trim().toLowerCase();
      const active     = !['cancelled','rejected','completed early','skipped'].includes(statusNorm);
      
      return emailMatch && dateMatch && periodMatch && active;
    });

    if (clash) {
      const errorMsg = `Period ${periodNum} on ${dateNorm} is already taken (LP: ${clash.lpId}, ${clash.class} ${clash.subject}, Chapter ${clash.chapter}, Session ${clash.session})`;
      return {
        success: false,
        error: errorMsg,
        occupiedBy: {
          lpId: clash.lpId,
          chapter: clash.chapter,
          session: clash.session,
          class: clash.class,
          subject: clash.subject,
          status: clash.status
        }
      };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Validation error: ${e && e.message ? e.message : e}` };
  }
}

/**
 * Get scheme details
 * OPTIMIZED: Uses TextFinder for fast exact-match lookup instead of full sheet scan.
 */
function _getSchemeDetails(schemeId) {
  try {
    const schemeIdNorm = String(schemeId || '').trim();
    if (!schemeIdNorm) return {};
    // Fast path: TextFinder exact match
    try {
      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      const col = _slmFindColumnIndex_(headers, 'schemeId');
      if (col !== -1) {
        const rowNums = _slmRowNumbersByExactValue_(sh, col, schemeIdNorm);
        const candidates = _slmReadRowsBatched_(sh, headers, rowNums);
        const found = (candidates || []).find(s => String(s.schemeId || '').trim() === schemeIdNorm);
        if (found) return found;
      }
    } catch (_e) {}
    // Fallback: request-scoped full-sheet cache
    const schemesData = _getCachedSheetData('Schemes').data;
    return (schemesData || []).find(s => String(s.schemeId || '').trim() === schemeIdNorm) || {};
  } catch (error) {
    return {};
  }
}

/**
 * Get lesson planning settings from Settings sheet
 */
function _getLessonPlanSettings() {
  try {
    // Per-request cache: Settings sheet is read-only during a request; avoid repeated reads.
    try {
      if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
        if (REQUEST_SHEET_CACHE.__slmLessonPlanSettings) return REQUEST_SHEET_CACHE.__slmLessonPlanSettings;
      }
    } catch (e) {}

    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));

    const readBool = function(key, defaultValue) {
      const row = settingsData.find(r => (r.key || '').toLowerCase() === String(key).toLowerCase());
      if (!row) return defaultValue;
      const raw = String(row.value || '').toLowerCase().trim();
      return raw === 'true' || raw === 'yes' || raw === '1';
    };

    const bulkOnly = readBool('lessonplan_bulk_only', false);
    const summaryLoadingFirst = readBool('lessonplan_summary_first', true);
    const useTeacherSchemeProgressIndex = readBool('lessonplan_use_teacher_scheme_progress', false);

    const result = {
      bulkOnly: bulkOnly,
      summaryLoadingFirst: summaryLoadingFirst,
      useTeacherSchemeProgressIndex: useTeacherSchemeProgressIndex
    };

    try {
      if (typeof REQUEST_SHEET_CACHE === 'object' && REQUEST_SHEET_CACHE) {
        REQUEST_SHEET_CACHE.__slmLessonPlanSettings = result;
      }
    } catch (e) {}

    return result;
  } catch (error) {
    return {
      bulkOnly: false,
      summaryLoadingFirst: true,
      useTeacherSchemeProgressIndex: false
    };
  }
}

/**
 * Get next Monday from a given date
 */
function _getNextMonday(fromDate) {
  const date = new Date(fromDate);
  const day = date.getDay();
  
  // Calculate days until next Monday (1 = Monday)
  let daysUntilMonday;
  if (day === 0) { // Sunday
    daysUntilMonday = 1;
  } else if (day === 1) { // Already Monday
    daysUntilMonday = 7; // Next Monday
  } else {
    daysUntilMonday = 8 - day; // Days until next Monday
  }
  
  return _addDays(date, daysUntilMonday);
}

/**
 * Add days to a date
 */
function _addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format time from Excel serial number to HH:MM format
 */
function _formatTime(timeValue) {
  try {
    if (!timeValue) {
      return '';
    }
    
    // If it's already a string in HH:MM format, return it
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      return timeValue;
    }
    
    // Handle Date objects (from Google Sheets time cells)
    if (timeValue instanceof Date) {
      // Use local time (not UTC) to avoid timezone conversion issues
      const hours = timeValue.getHours();
      const minutes = timeValue.getMinutes();
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return result;
    }
    
    // Handle numeric fractions (Excel/Sheets time as decimal)
    if (typeof timeValue === 'number') {
      // Excel stores time as fraction of a day (e.g., 0.5 = 12:00 PM)
      const totalMinutes = Math.round(timeValue * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return result;
    }
    
    // Try parsing as date string
    const date = new Date(timeValue);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return result;
  } catch (error) {
    return '';
  }
}

/**
 * Get period timing from Settings sheet
 */
// Cache for period timings (300 seconds = 5 minutes)
const PERIOD_TIMING_CACHE_KEY = 'periodTimingsCache';
const PERIOD_TIMING_CACHE_TTL = 300;

function _getPeriodTiming(periodNumber, dayName, className) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = `${PERIOD_TIMING_CACHE_KEY}_${dayName}_${className || 'default'}`;
    
    // Try to get from cache first
    let periodTimingsData = cache.get(cacheKey);
    if (periodTimingsData) {
      try {
        const cached = JSON.parse(periodTimingsData);
        const periodTiming = cached.find(p => String(p.period) === String(periodNumber));
        if (periodTiming) {
          return { start: periodTiming.start, end: periodTiming.end };
        }
      } catch (cacheParseError) {
        // Cache corrupted, continue to fetch fresh
        
      }
    }
    
    // Not in cache, fetch from Settings sheet
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Check for class-specific timing first (if className provided)
    if (className) {
      const classByClassSetting = settingsData.find(row => (row.key || '').trim() === 'periodTimesByClass');
      if (classByClassSetting && classByClassSetting.value) {
        try {
          const classTimings = JSON.parse(classByClassSetting.value);
          if (classTimings[className]) {
            let classSchedule = classTimings[className];
            // Handle both array format and object format (weekday/friday)
            if (Array.isArray(classSchedule)) {
              // Direct array format
              cache.put(cacheKey, JSON.stringify(classSchedule), PERIOD_TIMING_CACHE_TTL);
              const periodTiming = classSchedule.find(p => String(p.period) === String(periodNumber));
              if (periodTiming) {
                return { start: periodTiming.start, end: periodTiming.end };
              }
            } else if (classSchedule.weekday || classSchedule.friday) {
              // Object format with weekday/friday keys
              const isFriday = _normalizeDayName(dayName) === 'friday';
              const daySchedule = isFriday ? (classSchedule.friday || classSchedule.weekday) : classSchedule.weekday;
              if (daySchedule) {
                cache.put(cacheKey, JSON.stringify(daySchedule), PERIOD_TIMING_CACHE_TTL);
                const periodTiming = daySchedule.find(p => String(p.period) === String(periodNumber));
                if (periodTiming) {
                  return { start: periodTiming.start, end: periodTiming.end };
                }
              }
            }
          }
        } catch (parseError) {
        }
      }
    }
    
    // Fall back to global period times
    const isFriday = _normalizeDayName(dayName) === 'friday';
    const settingKey = isFriday ? 'periodTimes (Friday)' : 'periodTimes (Monday to Thursday)';
    
    const periodTimesSetting = settingsData.find(row => (row.key || '').trim() === settingKey);
    
    if (!periodTimesSetting || !periodTimesSetting.value) {
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    let periodTimings;
    try {
      periodTimings = JSON.parse(periodTimesSetting.value);
      // Cache the parsed timings
      cache.put(cacheKey, JSON.stringify(periodTimings), PERIOD_TIMING_CACHE_TTL);
    } catch (parseError) {
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    const periodTiming = periodTimings.find(p => String(p.period) === String(periodNumber));
    
    if (periodTiming) {
      return { start: periodTiming.start, end: periodTiming.end };
    }
    
    return _getDefaultPeriodTiming(periodNumber);
    
  } catch (error) {
    return _getDefaultPeriodTiming(periodNumber);
  }
}

/**
 * Get default period timing (fallback)
 */
function _getDefaultPeriodTiming(periodNumber) {
  const defaults = {
    1: { start: '08:50', end: '09:35' },
    2: { start: '09:35', end: '10:20' },
    3: { start: '10:30', end: '11:15' },
    4: { start: '11:15', end: '12:00' },
    5: { start: '12:00', end: '12:45' },
    6: { start: '13:15', end: '14:00' },
    7: { start: '14:00', end: '14:40' },
    8: { start: '14:45', end: '15:25' }
  };
  
  return defaults[periodNumber] || { start: '00:00', end: '00:00' };
}

/**
 * Find remaining lesson plans for a chapter after completion
 * Returns lesson plans that haven't been used yet
 */
function _findRemainingLessonPlans(teacherEmail, classValue, subject, chapter, afterDate) {
  try {
    const lpSheet = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSheet);
    const allPlans = _rows(lpSheet).map(row => _indexByHeader(row, lpHeaders));
    
    const afterDateNorm = _normalizeQueryDate(afterDate);
    
    // First, find all plans for this teacher/class/subject/chapter
    const chapterPlans = allPlans.filter(plan => {
      const emailMatch = String(plan.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
      const classMatch = String(plan.class || '') === String(classValue || '');
      const subjectMatch = String(plan.subject || '') === String(subject || '');
      const chapterMatch = String(plan.chapter || '').toLowerCase() === String(chapter || '').toLowerCase();
      
      return emailMatch && classMatch && subjectMatch && chapterMatch;
    });
    
    const remainingPlans = chapterPlans.filter(plan => {
      const statusNorm = String(plan.status || '').trim().toLowerCase();
      const isActive = !['cancelled', 'rejected', 'completed early', 'skipped'].includes(statusNorm);
      const planDateNorm = _normalizeQueryDate(plan.selectedDate);
      const isAfterDate = planDateNorm > afterDateNorm;
      
      return isActive && isAfterDate;
    });
    
    return remainingPlans.map(plan => ({
      lpId: plan.lpId,
      selectedDate: _normalizeQueryDate(plan.selectedDate), // Ensure YYYY-MM-DD format
      selectedPeriod: plan.selectedPeriod,
      session: plan.session,
      status: plan.status,
      learningObjectives: plan.learningObjectives
    }));
    
  } catch (error) {
    return [];
  }
}

/**
 * Skip remaining sessions when a chapter is completed early
 * Called when teacher checks "Chapter Fully Completed" before the final session
 */
function _skipRemainingSessionsForCompletedChapter(reportData) {
  try {
    const lessonPlanId = reportData.lessonPlanId;
    const currentSession = Number(reportData.sessionNo || 0);
    const totalSessions = Number(reportData.totalSessions || 1);
    
    // If this is already the last session, nothing to skip
    if (currentSession >= totalSessions) {
      return { success: true, sessionsSkipped: 0 };
    }
    
    // Find the lesson plan
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const lessonPlans = _rows(lpSh).map(row => _indexByHeader(row, lpHeaders));
    
    const baseLessonPlan = lessonPlans.find(lp => 
      String(lp.lpId || '').toLowerCase() === String(lessonPlanId || '').toLowerCase() &&
      Number(lp.session || 0) === currentSession
    );
    
    if (!baseLessonPlan) {
      return { success: false, error: 'Lesson plan not found' };
    }
    
    // Find and mark all remaining sessions as "Skipped"
    let skippedCount = 0;
    const rowsData = _rows(lpSh);
    
    for (let i = 0; i < rowsData.length; i++) {
      const lp = _indexByHeader(rowsData[i], lpHeaders);
      const lpSession = Number(lp.session || 0);
      const statusNorm = String(lp.status || '').trim().toLowerCase();
      
      // Check if this is a remaining session of the same scheme/class/subject/chapter
      if (lp.schemeId === baseLessonPlan.schemeId &&
          lp.teacherEmail === baseLessonPlan.teacherEmail &&
          lp.class === baseLessonPlan.class &&
          lp.subject === baseLessonPlan.subject &&
          lp.chapter === baseLessonPlan.chapter &&
          lpSession > currentSession &&
          lpSession <= totalSessions &&
          !['cancelled','rejected','skipped'].includes(statusNorm)) {
        
        // Mark as Skipped
        const rowIndex = i + 2; // +1 for header, +1 for 0-based index
        const statusColIndex = lpHeaders.indexOf('status') + 1;
        
        if (statusColIndex > 0) {
          lpSh.getRange(rowIndex, statusColIndex).setValue('Skipped');
          skippedCount++;
        }
      }
    }
    return { success: true, sessionsSkipped: skippedCount };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Normalize day name for comparison
 * NOTE: This function is defined in TimetableManager.gs
 * All .gs files are compiled together in Apps Script, so it's available globally.
 * Using the TimetableManager.gs version to avoid duplicate definitions.
 */
// function _normalizeDayName() - REMOVED DUPLICATE - See TimetableManager.gs

