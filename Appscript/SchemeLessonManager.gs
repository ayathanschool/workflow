/**
 * SchemeLessonManager.gs
 * Manages scheme-based lesson plan preparation
 * Implements reverse flow: Schemes → Chapters → Sessions → Select Period
 */

/**
 * Check if lesson plan preparation is allowed for this session
 * SIMPLIFIED LOGIC: Allow preparation any day if:
 * 1. It's an extended session (beyond original scheme count), OR
 * 2. For Session 1 of new chapter: Previous chapter's LAST SESSION must be marked "Chapter Complete" in daily reports
 * 3. For Session 2+: Previous session must have a daily report submitted
 * 
 * Note: Completion percentage is NOT used for validation - only "Chapter Complete" marking matters.
 */
function _isPreparationAllowedForSession(chapter, sessionNumber, scheme) {
  try {
    const _norm = (v) => String(v || '').trim().toLowerCase();
    // Ensure sessionNumber is a number
    const sessionNum = parseInt(sessionNumber);
    // Ensure noOfSessions is a number
    const originalSessionCount = parseInt(scheme.noOfSessions || '2');
    
    // DEBUG LOGGING
    Logger.log(`=== PERMISSION CHECK ===`);
    Logger.log(`Chapter: ${chapter.name || chapter}`);
    Logger.log(`Session Number: ${sessionNum} (original: ${sessionNumber}, type: ${typeof sessionNumber})`);
    Logger.log(`Original Session Count: ${originalSessionCount} (original: ${scheme.noOfSessions}, type: ${typeof scheme.noOfSessions})`);
    Logger.log(`Scheme ID: ${scheme.schemeId}`);
    Logger.log(`Comparison: ${sessionNum} > ${originalSessionCount} = ${sessionNum > originalSessionCount}`);
    
    // ALWAYS allow extended sessions (beyond original scheme count)
    if (sessionNum > originalSessionCount) {
      Logger.log(`✅ Session ${sessionNum} is EXTENDED (beyond original ${originalSessionCount}) - ALLOWED ANY DAY`);
      return {
        allowed: true,
        reason: 'extended_session',
        message: `Extended session ${sessionNum} can be prepared any day`
      };
    } else {
      Logger.log(`Session ${sessionNum} is NOT extended (${sessionNum} <= ${originalSessionCount})`);
    }
    
    // For Session 1 of any chapter: Check if there are incomplete chapters
    if (sessionNum === 1) {
      try {
        const drSh = _getSheet('DailyReports');
        const drHeaders = _headers(drSh);
        const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
        
        // Find reports for this teacher/class/subject
        const teacherReports = allReports.filter(report => {
          // Safety check: ensure report is an object
          if (!report || typeof report !== 'object') return false;
          
          const matchesTeacher = _norm(report.teacherEmail) === _norm(scheme.teacherEmail);
          const matchesClass = _norm(report.class) === _norm(scheme.class);
          const matchesSubject = _norm(report.subject) === _norm(scheme.subject);
          
          return matchesTeacher && matchesClass && matchesSubject;
        });
        
        // Check if this is the very first chapter (no reports exist yet)
        if (teacherReports.length === 0) {
          Logger.log(`No previous reports - allowing first chapter session 1`);
          return {
            allowed: true,
            reason: 'first_chapter',
            message: `First chapter of the scheme can be prepared any day`
          };
        }
        
        // Get all unique chapters that have been started (have daily reports)
        // Collect distinct non-empty chapter names previously started
        const startedChapters = [...new Set(teacherReports
          .map(r => _norm(r.chapter))
          .filter(name => name))];
        Logger.log(`Started chapters for ${scheme.teacherEmail}: ${startedChapters.join(', ')}`);
        
        // Check if the current chapter being prepared already has reports
        const currentChapterName = _norm(chapter && (chapter.name || chapter));
        const currentChapterStarted = startedChapters.includes(currentChapterName);
        
        if (currentChapterStarted) {
          // This chapter was already started, allow continuation
          Logger.log(`Chapter ${chapter.name} already started - allowing session 1 (re-preparation)`);
          return {
            allowed: true,
            reason: 'chapter_restart',
            message: `Continuing previously started chapter`
          };
        }
        
        // NEW CHAPTER - Check if ALL previously started chapters are marked complete
        const incompletedChapters = [];
        
        // Get all schemes for reference
        const schemesSheet = _getSheet('Schemes');
        const schemesHeaders = _headers(schemesSheet);
        const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
        
        for (const chapterName of startedChapters) {
          // Get all reports for this chapter
          const chapterReports = teacherReports.filter(report => _norm(report && report.chapter) === chapterName);
          
          if (chapterReports.length === 0) continue;
          
          // Find ALL session numbers that exist for this chapter (including extended)
          const sessionNumbers = chapterReports
            .map(r => Number(r.sessionNo || 0))
            .filter(n => n > 0);
          
          if (sessionNumbers.length === 0) {
            incompletedChapters.push(chapterName);
            continue;
          }
          
          // Get the HIGHEST session number (this could be an extended session)
          const lastSessionNo = Math.max(...sessionNumbers);
          
          // Get the scheme's original session count for this chapter
          const chapterScheme = allSchemes.find(s => 
            _norm(s && s.chapter) === chapterName &&
            _norm(s && s.teacherEmail) === _norm(scheme.teacherEmail) &&
            _norm(s && s.class) === _norm(scheme.class) &&
            _norm(s && s.subject) === _norm(scheme.subject)
          );
          
          const originalSessionCount = chapterScheme ? parseInt(chapterScheme.noOfSessions || 2) : 2;
          
          Logger.log(`Chapter "${chapterName}" - Original sessions: ${originalSessionCount}, Highest session with report: ${lastSessionNo}`);
          
          // Check if ALL sessions from 1 to lastSessionNo have daily reports
          let missingSessions = [];
          
          for (let i = 1; i <= lastSessionNo; i++) {
            const sessionReport = chapterReports.find(r => Number(r.sessionNo) === i);
            
            if (!sessionReport) {
              missingSessions.push(i);
            }
          }
          
          if (missingSessions.length > 0) {
            incompletedChapters.push(`${chapterName} (Missing daily reports for session(s): ${missingSessions.join(', ')})`);
            Logger.log(`Chapter "${chapterName}" incomplete - missing sessions: ${missingSessions.join(', ')}`);
            continue;
          }
          
          // Check if the LAST SESSION is marked "Chapter Complete"
          const lastSessionReport = chapterReports.find(report => 
            Number(report.sessionNo) === lastSessionNo
          );
          
          // Determine completion: explicit "Chapter Complete" OR all planned sessions reported
          const explicitComplete = lastSessionReport && String(lastSessionReport.completed || '').toLowerCase().includes('chapter complete');
          const implicitComplete = (lastSessionNo >= originalSessionCount) && missingSessions.length === 0;
          const isMarkedComplete = explicitComplete || implicitComplete;
          
          Logger.log(`Chapter "${chapterName}" - Last session ${lastSessionNo} marked complete: ${isMarkedComplete}, completed field: "${lastSessionReport?.completed}"`);
          
          if (!isMarkedComplete) {
            incompletedChapters.push(`${chapterName || 'Unnamed Chapter'} (Last session ${lastSessionNo} not marked "Chapter Complete")`);
            Logger.log(`Chapter "${chapterName}" incomplete - last session not marked complete`);
            continue;
          }
          
          Logger.log(`Chapter "${chapterName}" - All sessions complete and last session marked "Chapter Complete"`);
        }
        
        if (incompletedChapters.length > 0) {
          Logger.log(`Found incomplete chapters: ${incompletedChapters.join(', ')} - blocking new chapter`);
          return {
            allowed: false,
            reason: 'previous_chapters_incomplete',
            message: `Previous chapter must be completed before preparing session 1 of new chapter. Incomplete: ${incompletedChapters.join(', ')}. Mark "Chapter Complete" in the last session's daily report.`
          };
        }
        
        // All previous chapters completed - allow new chapter
        Logger.log(`All previous chapters completed - allowing new chapter ${chapter.name}`);
        return {
          allowed: true,
          reason: 'previous_chapters_completed',
          message: `All previous chapters completed - new chapter can be prepared`
        };
        
      } catch (drError) {
        Logger.log(`Error checking previous chapter completion: ${drError.message}`);
        // If error, allow by default to prevent blocking
        return {
          allowed: true,
          reason: 'error_fallback',
          message: 'Preparation allowed (error checking previous chapter)'
        };
      }
    }
    
    // For sessions 2+ within same chapter: Check if previous session exists in daily reports
    // This allows continuing within the same chapter
    try {
      const drSh = _getSheet('DailyReports');
      const drHeaders = _headers(drSh);
      const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
      
      // First, check if this chapter has ANY reports (is it started?)
      Logger.log(`=== LOOKING FOR CHAPTER REPORTS ===`);
      Logger.log(`Scheme teacher: "${scheme.teacherEmail}"`);
      Logger.log(`Chapter name: "${chapter.name}"`);
      Logger.log(`Scheme class: "${scheme.class}"`);
      Logger.log(`Scheme subject: "${scheme.subject}"`);
      Logger.log(`Total reports in sheet: ${allReports.length}`);
      
      const chapterReports = allReports.filter(report => {
        // Safety check: ensure report is an object
        if (!report || typeof report !== 'object') return false;
        
        const matchesTeacher = String(report.teacherEmail || '').trim().toLowerCase() === String(scheme.teacherEmail || '').trim().toLowerCase();
        const matchesChapter = String(report.chapter || '').trim().toLowerCase() === String(chapter.name || '').trim().toLowerCase();
        const matchesClass = String(report.class || '').trim().toLowerCase() === String(scheme.class || '').trim().toLowerCase();
        const matchesSubject = String(report.subject || '').trim().toLowerCase() === String(scheme.subject || '').trim().toLowerCase();
        
        if (matchesTeacher && matchesClass && matchesSubject) {
          Logger.log(`Report chapter: "${report.chapter}" -> matches chapter: ${matchesChapter}, session: ${report.sessionNo || report.session}`);
        }
        
        return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
      });
      
      Logger.log(`Found ${chapterReports.length} reports for this chapter`);
      
      // If chapter has no reports, check if previous chapters are complete
      if (chapterReports.length === 0) {
        Logger.log(`No reports for chapter ${chapter.name} yet - checking previous chapters`);
        
        // Get all reports for this teacher/class/subject
        const teacherReports = allReports.filter(report => {
          // Safety check: ensure report is an object
          if (!report || typeof report !== 'object') return false;
          
          const matchesTeacher = String(report.teacherEmail || '').toLowerCase() === String(scheme.teacherEmail || '').toLowerCase();
          const matchesClass = String(report.class || '') === String(scheme.class || '');
          const matchesSubject = String(report.subject || '') === String(scheme.subject || '');
          
          return matchesTeacher && matchesClass && matchesSubject;
        });
        
        // If no reports at all, allow (first chapter)
        if (teacherReports.length === 0) {
          Logger.log(`No previous reports - allowing first chapter`);
          return {
            allowed: true,
            reason: 'first_chapter',
            message: `First chapter can be prepared any day`
          };
        }
        
        // Check if all previous chapters are complete
        const startedChapters = [...new Set(teacherReports
          .map(r => String(r.chapter || '').trim())
          .filter(name => name))];
        const incompletedChapters = [];
        
        // Get all schemes for reference
        const schemesSheet = _getSheet('Schemes');
        const schemesHeaders = _headers(schemesSheet);
        const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
        
        for (const chapterName of startedChapters) {
          const prevChapterReports = teacherReports.filter(report => 
            String(report.chapter || '') === chapterName
          );
          
          if (prevChapterReports.length === 0) continue;
          
          const sessionNumbers = prevChapterReports
            .map(r => Number(r.sessionNo || 0))
            .filter(n => n > 0);
          
          if (sessionNumbers.length === 0) {
            incompletedChapters.push(chapterName);
            continue;
          }
          
          const lastSessionNo = Math.max(...sessionNumbers);
          
          // Get the scheme's original session count for this chapter
          const chapterScheme = allSchemes.find(s => 
            String(s.chapter || '').toLowerCase() === chapterName.toLowerCase() &&
            String(s.teacherEmail || '').toLowerCase() === String(scheme.teacherEmail || '').toLowerCase() &&
            String(s.class || '') === String(scheme.class || '') &&
            String(s.subject || '') === String(scheme.subject || '')
          );
          
          const originalSessionCount = chapterScheme ? parseInt(chapterScheme.noOfSessions || 2) : 2;
          
          // Check if ALL sessions from 1 to lastSessionNo have daily reports
          let missingSessions = [];
          
          for (let i = 1; i <= lastSessionNo; i++) {
            const sessionReport = prevChapterReports.find(r => Number(r.sessionNo) === i);
            
            if (!sessionReport) {
              missingSessions.push(i);
            }
          }
          
          if (missingSessions.length > 0) {
            incompletedChapters.push(`${chapterName} (Missing session(s): ${missingSessions.join(', ')})`);
            continue;
          }
          
          // Check if the LAST SESSION is marked "Chapter Complete"
          const lastSessionReport = prevChapterReports.find(report => 
            Number(report.sessionNo) === lastSessionNo
          );
          
          const explicitCompletePrev = lastSessionReport && String(lastSessionReport.completed || '').toLowerCase().includes('chapter complete');
          const implicitCompletePrev = (lastSessionNo >= originalSessionCount) && missingSessions.length === 0;
          const isMarkedComplete = explicitCompletePrev || implicitCompletePrev;
          
          if (!isMarkedComplete) {
            incompletedChapters.push(`${chapterName || 'Unnamed Chapter'} (Last session ${lastSessionNo} not marked "Chapter Complete")`);
            continue;
          }
        }
        
        if (incompletedChapters.length > 0) {
          Logger.log(`Previous chapters incomplete - blocking new chapter ${chapter.name}`);
          return {
            allowed: false,
            reason: 'previous_chapters_incomplete',
            message: `Previous chapter must be completed before preparing session 1 of ${chapter.name}. Incomplete: ${incompletedChapters.join(', ')}. Mark "Chapter Complete" in the last session's daily report.`
          };
        }
        
        // All previous chapters complete - allow this new chapter
        Logger.log(`All previous chapters complete - allowing new chapter ${chapter.name}`);
        return {
          allowed: true,
          reason: 'previous_chapters_completed',
          message: `All previous chapters completed - new chapter can be prepared`
        };
      }
      
      // Chapter has reports - check if previous session has daily report submitted
      // Support both 'sessionNo' and legacy 'session' column names
      Logger.log(`=== LOOKING FOR PREVIOUS SESSION ${sessionNum - 1} ===`);
      Logger.log(`Chapter reports found: ${chapterReports.length}`);
      chapterReports.forEach(r => {
        const sessNum = Number(r.sessionNo || r.session || 0);
        Logger.log(`  Report: session=${sessNum}, sessionNo="${r.sessionNo}", session="${r.session}", date=${r.date}`);
      });
      
      const previousSessionReport = chapterReports.find(report => {
        const num = Number(report.sessionNo || report.session || 0);
        Logger.log(`  Checking report: sessionNo="${report.sessionNo}", session="${report.session}" -> parsed as ${num}, looking for ${sessionNum - 1}`);
        return num === (sessionNum - 1);
      });
      
      if (!previousSessionReport) {
        Logger.log(`❌ Previous session ${sessionNum - 1} not found`);
        Logger.log(`Available sessions in reports: ${chapterReports.map(r => Number(r.sessionNo || r.session || 0)).join(', ')}`);
        return {
          allowed: false,
          reason: 'previous_session_not_completed',
          message: `Previous session ${sessionNum - 1} of "${chapter.name}" must have a daily report submitted before preparing session ${sessionNum}`
        };
      }
      
      Logger.log(`✅ Found previous session ${sessionNum - 1} report`);
      
      // CRITICAL FIX: Check if CURRENT session we're trying to create is beyond the original count
      // This means previous session MUST be the last original session and MUST be marked complete
      if (sessionNum > originalSessionCount) {
        // Trying to create extended session - previous session MUST be last original session and marked complete
        const isMarkedComplete = String(previousSessionReport.completed || '').toLowerCase().includes('chapter complete');
        
        Logger.log(`Attempting to create extended session ${sessionNum} (beyond original ${originalSessionCount}). Previous session ${sessionNum - 1} marked complete: ${isMarkedComplete}, completed field: "${previousSessionReport.completed}"`);
        
        if (!isMarkedComplete) {
          return {
            allowed: false,
            reason: 'last_session_not_marked_complete',
            message: `Cannot create extended session ${sessionNum}. Session ${sessionNum - 1} is the last original session of "${chapter.name}". Please mark it as "Chapter Complete" in the daily report first.`
          };
        }
      }
      
      Logger.log(`Previous session ${sessionNum - 1} has daily report - allowing session ${sessionNum}`);
      return {
        allowed: true,
        reason: 'continuing_chapter',
        message: `Continuing same chapter - session ${sessionNum} can be prepared any day`
      };
      
    } catch (drError) {
      Logger.log(`Error checking previous session: ${drError.message}`);
      return {
        allowed: true,
        reason: 'error_fallback',
        message: 'Preparation allowed (error checking previous session)'
      };
    }
    
  } catch (error) {
    Logger.log(`Error checking preparation permission: ${error.message}`);
    // If error, allow by default
    return {
      allowed: true,
      reason: 'error_fallback',
      message: 'Preparation allowed (error in day check)'
    };
  }
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
        Logger.log(`Found active term ${term.term}: ${_isoDateString(termStart)} to ${_isoDateString(termEnd)}`);
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
      
      Logger.log(`=== LESSON PLANNING: ACTIVE TERM ${activeTerm.term} ===`);
      Logger.log(`Term runs: ${_isoDateString(activeTerm.termStart)} to ${_isoDateString(activeTerm.termEnd)}`);
      Logger.log(`Planning window: ${_isoDateString(startDate)} to ${_isoDateString(endDate)}`);
      
    } else if (upcomingTerm) {
      // No active term, but there's an upcoming term - plan from term start
      startDate = new Date(upcomingTerm.termStart);
      const thirtyDaysFromStart = new Date(upcomingTerm.termStart);
      thirtyDaysFromStart.setDate(thirtyDaysFromStart.getDate() + 30);
      
      endDate = thirtyDaysFromStart <= upcomingTerm.termEnd ? thirtyDaysFromStart : upcomingTerm.termEnd;
      termInfo = `Term ${upcomingTerm.term} (Upcoming)`;
      
      Logger.log(`=== LESSON PLANNING: UPCOMING TERM ${upcomingTerm.term} ===`);
      Logger.log(`Term starts: ${_isoDateString(upcomingTerm.termStart)}`);
      Logger.log(`Term ends: ${_isoDateString(upcomingTerm.termEnd)}`);
      Logger.log(`Planning window: ${_isoDateString(startDate)} to ${_isoDateString(endDate)}`);
      
    } else {
      // No term data found - fallback to today + 30 days
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
      termInfo = 'No Term Data';
      
      Logger.log(`=== LESSON PLANNING: NO TERM DATA (FALLBACK) ===`);
      Logger.log(`Using default range: ${_isoDateString(startDate)} to ${_isoDateString(endDate)}`);
    }
    
    const startDateString = _isoDateString(startDate);
    const endDateString = _isoDateString(endDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    Logger.log(`TODAY: ${_isoDateString(today)}`);
    Logger.log(`START: ${startDateString}`);
    Logger.log(`END: ${endDateString}`);
    Logger.log(`TOTAL DAYS: ${totalDays}`);
    Logger.log(`TERM INFO: ${termInfo}`);
    
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
    Logger.log(`Error calculating date range: ${error.message}, using defaults`);
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
  const APPROVED_SCHEMES_CACHE_VERSION = 'v2026-02-02-ultra-fast';
  const mode = summaryOnly ? 'summary' : 'full';
  const cacheKey = generateCacheKey('approved_schemes', { email: teacherEmail, mode: mode, v: APPROVED_SCHEMES_CACHE_VERSION });

  // PERFORMANCE: For summary mode, use SHORT cache (60s) to ensure fast responses
  // For full mode, use MEDIUM cache (5min) as before
  const cacheTTL = summaryOnly ? CACHE_TTL.SHORT : CACHE_TTL.MEDIUM;

  // NOTE: The heavy schemes+progress payload is cached, but Settings-driven flags
  // (bulkOnly mode, planningDateRange) must reflect sheet edits immediately.
  const res = getCachedData(cacheKey, function() {
    return _fetchApprovedSchemesForLessonPlanning(teacherEmail, summaryOnly);
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
    Logger.log(`Getting approved schemes for lesson planning: ${teacherEmail}, summaryOnly: ${summaryOnly}`);
    
    if (!teacherEmail) {
      return { success: false, error: 'Teacher email is required' };
    }
    
    // PERFORMANCE CRITICAL: Instead of loading entire Schemes sheet (_getCachedSheetData),
    // directly query only the rows we need using TextFinder for massive speed improvement
    const sheet = _getSheet('Schemes');
    const headers = _headers(sheet);
    
    // Find email column index
    const emailColIndex = headers.findIndex(h => 
      String(h).toLowerCase().trim() === 'teacheremail'
    );
    const statusColIndex = headers.findIndex(h => 
      String(h).toLowerCase().trim() === 'status'
    );
    
    if (emailColIndex === -1) {
      Logger.log('ERROR: teacherEmail column not found in Schemes sheet');
      return { success: false, error: 'Invalid Schemes sheet structure' };
    }
    
    // Get all data once (unavoidable, but faster than multiple queries)
    const allRows = _rows(sheet);
    
    // Filter in-memory for approved schemes (much faster than multiple TextFinder queries)
    const approvedSchemes = allRows
      .filter(row => {
        const email = String(row[emailColIndex] || '').toLowerCase().trim();
        const status = String(row[statusColIndex] || '').toLowerCase().trim();
        return email === teacherEmail.toLowerCase() && status === 'approved';
      })
      .map(row => _indexByHeader(row, headers));
    
    Logger.log(`Found ${approvedSchemes.length} approved schemes for ${teacherEmail}`);
    
    // OPTIMIZATION: If summary-only mode, return lightweight payload immediately
    if (summaryOnly) {
      Logger.log('Returning summary-only response');
      return _buildSummaryOnlyResponse(approvedSchemes, teacherEmail);
    }

    // Get existing lesson plans to check what's already planned
    const existingPlans = _getCachedSheetData('LessonPlans').data;
    
    const teacherPlans = existingPlans.filter(plan => {
      if (!plan || typeof plan !== 'object') return false;
      return String(plan.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
    });
    
    // Get daily reports to check which sessions have been reported
    const allReports = _getCachedSheetData('DailyReports').data;
    
    const teacherReports = allReports.filter(report => {
      // Safety: ensure report is object and coerce teacherEmail
      if (!report || typeof report !== 'object') return false;
      return String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
    });

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

    // Plans indexed by (schemeId + chapter + session)
    const plansByKey = new Map();
    for (const p of teacherPlans) {
      if (!p || typeof p !== 'object') continue;
      const key = planKey(p.schemeId, p.chapter, p.session);
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

    const isChapterMarkedComplete = function(report) {
      const status = normKey(report && report.chapterStatus);
      const chapterCompleted = report && report.chapterCompleted;
      const chapterCompletedStr = normKey(chapterCompleted);
      return (
        status.indexOf('chapter complete') !== -1 ||
        chapterCompleted === true ||
        chapterCompletedStr === 'true' ||
        chapterCompletedStr === 'yes' ||
        chapterCompletedStr === 'y' ||
        chapterCompletedStr === '1'
      );
    };

    // Reports indexed by (class + subject + chapter [+ session])
    const hasReportBySession = new Set();
    const completedChapters = new Set();
    for (const r of teacherReports) {
      if (!r || typeof r !== 'object') continue;
      if (!relevantClassSubjects.has(csKey(r.class, r.subject))) continue;

      const chKey = chapterKey(r.class, r.subject, r.chapter);
      if (chKey && isChapterMarkedComplete(r)) completedChapters.add(chKey);

      const sessKey = reportSessionKey(r.class, r.subject, r.chapter, r.sessionNo);
      if (sessKey) hasReportBySession.add(sessKey);
    }
    
    // Process each scheme to show chapter/session breakdown
    const schemesWithProgress = approvedSchemes.map(scheme => {
      const schemeChapters = _parseSchemeChapters(scheme);

      // Determine if each chapter is marked complete (for info) using precomputed indexes.
      // IMPORTANT: preparation gating must follow _isPreparationAllowedForSession() so it also
      // blocks starting new schemes/chapters until previously started chapters are marked complete.
      const completionByChapter = {};
      for (const ch of schemeChapters) {
        const key = normKey(ch && ch.name);
        if (!key) continue;
        completionByChapter[key] = completedChapters.has(chapterKey(scheme.class, scheme.subject, key));
      }

      const chaptersWithSessions = [];
      for (let chapterIndex = 0; chapterIndex < schemeChapters.length; chapterIndex++) {
        const chapter = schemeChapters[chapterIndex];

        // Compute gating using the same function used by createSchemeLessonPlan()
        // so the UI mirrors backend restrictions.
        const gate = _isPreparationAllowedForSession(chapter, 1, scheme);
        const canPrepare = !!(gate && gate.allowed);

        const sessions = _generateSessionsForChapter(chapter, scheme);
        const sessionsWithStatus = sessions.map(session => {
          const existingPlan = plansByKey.get(planKey(scheme.schemeId, chapter.name, session.sessionNumber));

          let status = 'not-planned';
          let cascadeMarked = false;
          if (existingPlan) {
            const rawStatus = String(existingPlan.status || 'planned').trim();
            const statusLower = rawStatus.toLowerCase();
            const hasOriginalSlotChange = existingPlan.originalDate && existingPlan.originalDate !== existingPlan.selectedDate;
            const isOriginalCascade = /rescheduled\s*\(cascade\)/i.test(rawStatus); // only original missed session

            // Check for daily report for this session
            const hasReport = hasReportBySession.has(reportSessionKey(scheme.class, scheme.subject, chapter.name, session.sessionNumber));

            // Decide displayed status:
            // - If a session was the ORIGINAL cascaded session, keep a cascade marker.
            // - If that cascaded session has already been reported, display as 'Reported' (so UI shows ✓ Reported)
            //   while still allowing the UI to show a cascade indicator via originalDate/originalPeriod/cascadeMarked.
            if (isOriginalCascade && hasOriginalSlotChange) {
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
            originalDate: existingPlan ? (existingPlan.originalDate || null) : null,
            originalPeriod: existingPlan ? (existingPlan.originalPeriod || null) : null,
            lessonPlanId: existingPlan ? existingPlan.lpId : null,
            cascadeMarked: cascadeMarked
          };
        });
        
        const totalSessions = sessions.length;
        // Count all sessions that have been planned (excluding 'not-planned' and 'Cancelled')
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
      Logger.log(`Planning date range calculated: ${JSON.stringify(planningDateRange)}`);
    } catch (dateError) {
      Logger.log(`ERROR calculating date range: ${dateError.message}`);
      Logger.log(`Date error stack: ${dateError.stack}`);
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
    Logger.log(`Error getting approved schemes for lesson planning: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Build lightweight summary-only response (no session details)
 * PERFORMANCE: Reduces payload from ~500KB to ~50KB for typical teacher
 */
function _buildSummaryOnlyResponse(approvedSchemes, teacherEmail) {
  // ULTRA-FAST MODE: Return only basic scheme metadata without ANY processing
  // Progress and chapter details will be calculated on-demand when user expands a specific scheme
  const schemes = approvedSchemes.map(scheme => {
    return {
      schemeId: scheme.schemeId,
      class: scheme.class,
      subject: scheme.subject,
      academicYear: scheme.academicYear,
      term: scheme.term,
      totalChapters: 0, // Will be calculated on-demand
      totalSessions: 0, // Calculated on-demand when expanded
      plannedSessions: 0, // Calculated on-demand when expanded
      overallProgress: 0, // Calculated on-demand when expanded
      createdAt: scheme.createdAt,
      approvedAt: scheme.approvedAt,
      // No chapters array - lazy load on demand
      chaptersLoaded: false
    };
  });
  
  const dateRange = _calculateLessonPlanningDateRange();
  const settings = _getLessonPlanSettings();
  
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
 * Get detailed chapter/session breakdown for a specific scheme (lazy loading)
 * PERFORMANCE: Only fetches details for one scheme instead of all schemes
 */
function getSchemeDetails(schemeId, teacherEmail) {
  try {
    Logger.log(`Getting scheme details for: ${schemeId}`);
    
    if (!schemeId || !teacherEmail) {
      return { success: false, error: 'schemeId and teacherEmail are required' };
    }
    
    const cacheKey = generateCacheKey('scheme_details', { id: schemeId, email: teacherEmail, v: 'v2026-02-02-filtered' });
    
    return getCachedData(cacheKey, function() {
      return _fetchSchemeDetails(schemeId, teacherEmail);
    }, CACHE_TTL.MEDIUM);
    
  } catch (error) {
    Logger.log(`Error getting scheme details: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function _fetchSchemeDetails(schemeId, teacherEmail) {
  const schemesData = _getCachedSheetData('Schemes').data;
  const scheme = schemesData.find(s => 
    String(s.schemeId || '').trim() === String(schemeId || '').trim() &&
    String(s.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase() &&
    String(s.status || '').toLowerCase() === 'approved'
  );
  
  if (!scheme) {
    return { success: false, error: 'Scheme not found or not approved' };
  }
  
  // OPTIMIZATION: Filter plans and reports EARLY to only this scheme's class/subject
  const normKey = function(v) { return String(v || '').toLowerCase().trim(); };
  const schemeClass = normKey(scheme.class);
  const schemeSubject = normKey(scheme.subject);
  
  // Get existing lesson plans - FILTER EARLY by schemeId first, then class/subject
  const existingPlans = _getCachedSheetData('LessonPlans').data;
  const schemePlans = existingPlans.filter(plan => {
    if (!plan || typeof plan !== 'object') return false;
    // First filter: only this schemeId OR matching class+subject for this teacher
    const matchesSchemeId = String(plan.schemeId || '').trim() === String(schemeId || '').trim();
    const matchesClassSubject = (
      normKey(plan.class) === schemeClass && 
      normKey(plan.subject) === schemeSubject &&
      String(plan.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase()
    );
    return matchesSchemeId || matchesClassSubject;
  });
  
  // Get daily reports - FILTER EARLY by class/subject only
  const allReports = _getCachedSheetData('DailyReports').data;
  const schemeReports = allReports.filter(report => {
    if (!report || typeof report !== 'object') return false;
    return (
      normKey(report.class) === schemeClass &&
      normKey(report.subject) === schemeSubject &&
      String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase()
    );
  });
  
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
    const key = planKey(p.schemeId, p.chapter, p.session);
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
  
  const isChapterMarkedComplete = function(report) {
    const status = normKey(report && report.chapterStatus);
    const chapterCompleted = report && report.chapterCompleted;
    const chapterCompletedStr = normKey(chapterCompleted);
    return (
      status.indexOf('chapter complete') !== -1 ||
      chapterCompleted === true ||
      chapterCompletedStr === 'true' ||
      chapterCompletedStr === 'yes' ||
      chapterCompletedStr === 'y' ||
      chapterCompletedStr === '1'
    );
  };
  
  // Reports indexed by (class + subject + chapter [+ session]) - much smaller now!
  const hasReportBySession = new Set();
  const completedChapters = new Set();
  
  for (const r of schemeReports) {
    if (!r || typeof r !== 'object') continue;
    
    const chKey = chapterKey(r.class, r.subject, r.chapter);
    if (chKey && isChapterMarkedComplete(r)) completedChapters.add(chKey);
    
    const sessKey = reportSessionKey(r.class, r.subject, r.chapter, r.sessionNo);
    if (sessKey) hasReportBySession.add(sessKey);
  }
  
  // Build chapter details
  const schemeChapters = _parseSchemeChapters(scheme);
  const completionByChapter = {};
  for (const ch of schemeChapters) {
    const key = normKey(ch && ch.name);
    if (!key) continue;
    completionByChapter[key] = completedChapters.has(chapterKey(scheme.class, scheme.subject, key));
  }
  
  const chaptersWithSessions = [];
  for (let chapterIndex = 0; chapterIndex < schemeChapters.length; chapterIndex++) {
    const chapter = schemeChapters[chapterIndex];
    
    const gate = _isPreparationAllowedForSession(chapter, 1, scheme);
    const canPrepare = !!(gate && gate.allowed);
    
    const sessions = _generateSessionsForChapter(chapter, scheme);
    const sessionsWithStatus = sessions.map(session => {
      const existingPlan = plansByKey.get(planKey(scheme.schemeId, chapter.name, session.sessionNumber));
      
      let status = 'not-planned';
      let cascadeMarked = false;
      if (existingPlan) {
        const rawStatus = String(existingPlan.status || 'planned').trim();
        const statusLower = rawStatus.toLowerCase();
        const hasOriginalSlotChange = existingPlan.originalDate && existingPlan.originalDate !== existingPlan.selectedDate;
        const isOriginalCascade = /rescheduled\\s*\\(cascade\\)/i.test(rawStatus);
        
        const hasReport = hasReportBySession.has(reportSessionKey(scheme.class, scheme.subject, chapter.name, session.sessionNumber));
        
        if (isOriginalCascade && hasOriginalSlotChange) {
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
        originalDate: existingPlan ? (existingPlan.originalDate || null) : null,
        originalPeriod: existingPlan ? (existingPlan.originalPeriod || null) : null,
        lessonPlanId: existingPlan ? existingPlan.lpId : null,
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
    Logger.log(`Getting available periods for ${teacherEmail} - Class: ${schemeClass}, Subject: ${schemeSubject}`);
    Logger.log(`Date range requested: ${startDate} to ${endDate}`);
    
    // Use the dates passed from frontend (already calculated as next week)
    const planningStartDate = new Date(startDate + 'T00:00:00');
    const planningEndDate = new Date(endDate + 'T00:00:00');
    
    Logger.log(`Planning window: ${_isoDateString(planningStartDate)} to ${_isoDateString(planningEndDate)}`);
    
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
      const lessonPlansSheet = _getSheet('LessonPlans');
      const lessonPlansHeaders = _headers(lessonPlansSheet);
      const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
      
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
    
    Logger.log(`Filtering periods for class: ${schemeClass}, subject: ${schemeSubject}`);
    Logger.log(`Teacher has ${teacherTimetable.length} total timetable entries`);
    
    // DEBUG: Log first few timetable entries to see format
    if (teacherTimetable.length > 0) {
      Logger.log('Sample timetable entries:');
      teacherTimetable.slice(0, 3).forEach(slot => {
        Logger.log(`  class="${slot.class}" subject="${slot.subject}" day="${slot.dayOfWeek}" period="${slot.period}"`);
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
          
          Logger.log(`Blocked date range: ${_isoDateString(startDate)} to ${_isoDateString(endDate)}`);
        }
      }
      
      Logger.log(`Total blocked date ranges: ${blockedDateRanges.length}`);
    } catch (calErr) {
      Logger.log(`Warning: Could not load blocked dates from AcademicCalendar: ${calErr.message}`);
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
        Logger.log(`⛔ ${dayName} (${dateString}): BLOCKED by AcademicCalendar - skipping`);
        continue;
      }
      
      // Find periods for this day that match the scheme's class and subject
      const dayPeriods = teacherTimetable.filter(slot => {
        const dayMatch = _normalizeDayName(slot.dayOfWeek || '') === _normalizeDayName(dayName);
        // ONLY show periods that match the scheme's class and subject (trim + case-insensitive)
        const classMatch = String(slot.class || '').toLowerCase().trim() === String(schemeClass || '').toLowerCase().trim();
        const subjectMatch = String(slot.subject || '').toLowerCase().trim() === String(schemeSubject || '').toLowerCase().trim();
        
        // DEBUG: Log comparison for first day
        if (date.getTime() === planningStartDate.getTime()) {
          Logger.log(`${dayName}: Slot class="${slot.class}" vs scheme="${schemeClass}" → ${classMatch ? 'MATCH' : 'NO MATCH'}`);
          Logger.log(`${dayName}: Slot subject="${slot.subject}" vs scheme="${schemeSubject}" → ${subjectMatch ? 'MATCH' : 'NO MATCH'}`);
        }
        
        return dayMatch && classMatch && subjectMatch;
      });
      
      Logger.log(`${dayName} (${dateString}): Found ${dayPeriods.length} matching periods for ${schemeClass} ${schemeSubject}`);
      
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
    Logger.log(`Error getting available periods: ${error.message}`);
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
    var endISO = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');

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
    Logger.log(`Creating scheme-based lesson plan: ${JSON.stringify(lessonPlanData)}`);
    
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
    
    // Check if this is an extended session (session number > numberOfSessions)
    const sessionNumber = parseInt(lessonPlanData.session) || 0;
    const isExtendedSession = sessionNumber > (chapter.numberOfSessions || 0);
    
    // Check if single session preparation is restricted (but allow extended sessions)
    const settings = _getLessonPlanSettings();
    if (settings.bulkOnly && !isExtendedSession) {
      Logger.log(`ERROR: Single session preparation is disabled. Use bulk chapter preparation instead.`);
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
      Logger.log(`ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Enforce mandatory pedagogy fields
    const pedagogyMissing = [];
    if (!String(lessonPlanData.learningObjectives || '').trim()) pedagogyMissing.push('learningObjectives');
    if (!String(lessonPlanData.teachingMethods || '').trim()) pedagogyMissing.push('teachingMethods');
    if (pedagogyMissing.length) {
      const errorMsg = `Missing required field(s): ${pedagogyMissing.join(', ')}`;
      Logger.log(`ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // NEW: Check if preparation is allowed for this specific session
    const preparationCheck = _isPreparationAllowedForSession(
      chapter, 
      parseInt(lessonPlanData.session), 
      schemeDetails
    );
    
    if (!preparationCheck.allowed) {
      Logger.log(`ERROR: ${preparationCheck.message}`);
      return { 
        success: false, 
        error: preparationCheck.message,
        reason: preparationCheck.reason
      };
    }
    
    Logger.log(`✅ Preparation allowed: ${preparationCheck.message} (${preparationCheck.reason})`);
    
    Logger.log(`All required fields present. Proceeding with validation...`);
    
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
      Logger.log(`Warning: Could not fetch teacher name from Users sheet: ${err.message}`);
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
    Logger.log(`Error creating scheme lesson plan: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    // Always release the lock
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log(`Error releasing lock: ${e.message}`);
    }
  }
}

/**
 * Create multiple lesson plans for all sessions of a chapter at once
 * BULK OPERATION: Auto-assigns next N available periods
 */
function createBulkSchemeLessonPlans(bulkData) {
  var lock = LockService.getDocumentLock();
  try {
    Logger.log(`Creating bulk lesson plans: ${JSON.stringify(bulkData)}`);
    
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

    // ENFORCE: bulk prep must follow the same gating rules as single-session prep.
    // This will block starting a new chapter (or even a new scheme for same class/subject)
    // until previously started chapters are marked "Chapter Complete" in Daily Reports.
    try {
      const schemeChapters = _parseSchemeChapters(schemeDetails);
      const norm = function(v) { return String(v || '').toLowerCase().trim(); };
      const targetChapterName = String(bulkData.chapter || '').trim();
      const chapterObj = schemeChapters.find(ch => norm(ch && ch.name) === norm(targetChapterName)) || null;
      if (!chapterObj) {
        return { success: false, error: 'Chapter not found in scheme' };
      }

      const schemeForCheck = Object.assign({}, schemeDetails, { teacherEmail: bulkData.teacherEmail });
      const gate = _isPreparationAllowedForSession(chapterObj, 1, schemeForCheck);
      if (!gate || !gate.allowed) {
        return {
          success: false,
          error: (gate && gate.message) ? gate.message : 'Previous chapter should be completed',
          reason: (gate && gate.reason) ? gate.reason : 'previous_chapter_incomplete'
        };
      }
    } catch (gateErr) {
      Logger.log(`Warning: bulk preparation gating check failed: ${gateErr.message}`);
      // Fail safe: do not block on gating-check exceptions.
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
      Logger.log(`Warning: Could not fetch teacher name from Users sheet: ${err.message}`);
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
        Logger.log(`Error creating session ${sessionNumber}: ${sessionError.message}`);
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
    
    return {
      success: true,
      message: `Created ${createdPlans.length} lesson plans successfully`,
      createdCount: createdPlans.length,
      requestedCount: sessionCount,
      plans: createdPlans,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    Logger.log(`Bulk lesson plan creation error: ${error.message}`);
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
    
    Logger.log(`Parsing scheme chapters for ${scheme.subject} - ${scheme.class}`);
    Logger.log(`Scheme chapter field: ${scheme.chapter}`);
    Logger.log(`Scheme content: ${content}`);
    Logger.log(`Scheme noOfSessions: ${scheme.noOfSessions}`);
    
    // FIRST: Check if scheme has a direct 'chapter' field (single chapter scheme)
    if (scheme.chapter && String(scheme.chapter).trim() !== '') {
      const chapterName = String(scheme.chapter).trim();
      Logger.log(`Using direct chapter field: ${chapterName}`);
      
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
      
      Logger.log(`Found ${chapterLines.length} chapter lines in content:`, chapterLines);
      
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
      Logger.log('ERROR: No chapter data found in scheme');
      Logger.log(`Scheme data: ${JSON.stringify(scheme)}`);
      
      // Return a clear error instead of generating fake data
      return [{
        number: 1,
        name: 'ERROR: No Chapter Data',
        description: 'This scheme has no chapter information. Please edit the scheme to add chapter details.'
      }];
    }
    
    return chapters;
  } catch (error) {
    Logger.log(`Error parsing scheme chapters: ${error.message}`);
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
    
    Logger.log(`Generating sessions for chapter: ${chapter.name}, original sessions: ${originalSessionCount}`);
    
    // Check daily reports to see if extended sessions are needed
    // LOGIC: Show extended session if all original sessions have reports BUT last session NOT marked "Chapter Complete"
    let extendedSessionCount = originalSessionCount;
    try {
      const drSh = _getSheet('DailyReports');
      const drHeaders = _headers(drSh);
      const allReports = _rows(drSh).map(row => _indexByHeader(row, drHeaders));
      
      // Find daily reports for this chapter by this teacher
      const chapterReports = allReports.filter(report => {
        // Safety check: ensure report is an object
        if (!report || typeof report !== 'object') return false;
        
        const matchesTeacher = String(report.teacherEmail || '').toLowerCase() === String(scheme.teacherEmail || '').toLowerCase();
        const matchesChapter = String(report.chapter || '') === String(chapter.name || '');
        const matchesClass = String(report.class || '') === String(scheme.class || '');
        const matchesSubject = String(report.subject || '') === String(scheme.subject || '');
        
        return matchesTeacher && matchesChapter && matchesClass && matchesSubject;
      });
      
      if (chapterReports.length > 0) {
        Logger.log(`=== EXTENDED SESSION CHECK ===`);
        Logger.log(`Found ${chapterReports.length} daily reports for chapter ${chapter.name}`);
        Logger.log(`Teacher: ${scheme.teacherEmail}, Class: ${scheme.class}, Subject: ${scheme.subject}`);
        Logger.log(`Original session count: ${originalSessionCount}`);
        
        // Log all reports for debugging
        chapterReports.forEach(r => {
          Logger.log(`Report: Session ${r.sessionNo}, Date: ${r.date}, Completed: "${r.completed}"`);
        });
        
        // Check if ALL original sessions (1 to originalSessionCount) have daily reports
        let allOriginalSessionsHaveReports = true;
        let missingSessions = [];
        
        for (let i = 1; i <= originalSessionCount; i++) {
          const sessionReport = chapterReports.find(report => 
            Number(report.sessionNo) === i
          );
          
          if (sessionReport) {
            Logger.log(`✓ Session ${i}: Daily report exists (completed: "${sessionReport.completed}")`);
          } else {
            Logger.log(`✗ Session ${i}: No daily report found`);
            allOriginalSessionsHaveReports = false;
            missingSessions.push(i);
          }
        }
        
        Logger.log(`All original sessions have reports: ${allOriginalSessionsHaveReports}`);
        
        if (allOriginalSessionsHaveReports) {
          // All original sessions have reports - check if last session is marked "Chapter Complete"
          const lastSessionReport = chapterReports.find(report => 
            Number(report.sessionNo) === originalSessionCount
          );
          
          Logger.log(`Last session report found: ${!!lastSessionReport}`);
          if (lastSessionReport) {
            Logger.log(`Last session completed field raw: "${lastSessionReport.completed}"`);
            Logger.log(`Last session completed field type: ${typeof lastSessionReport.completed}`);
            Logger.log(`Last session completed field lowercase: "${String(lastSessionReport.completed || '').toLowerCase()}"`);
          }
          
          const isMarkedComplete = lastSessionReport && 
            String(lastSessionReport.completed || '').toLowerCase().includes('chapter complete');
          
          Logger.log(`Last session (${originalSessionCount}) marked "Chapter Complete": ${isMarkedComplete}`);
          
          if (!isMarkedComplete) {
            // All sessions have reports BUT last not marked complete - show extended session
            extendedSessionCount = originalSessionCount + 1;
            Logger.log(`🔄 EXTENDING: Sessions count ${originalSessionCount} → ${extendedSessionCount} (last session not marked "Chapter Complete")`);
          } else {
            Logger.log(`✅ Last session marked "Chapter Complete" - no extension needed`);
          }
        } else {
          Logger.log(`❌ Cannot show extended session - missing reports for sessions: ${missingSessions.join(', ')}`);
        }
      } else {
        Logger.log(`No daily reports found for chapter ${chapter.name} - using original session count`);
      }
      
    } catch (drError) {
      Logger.log(`Error checking daily reports for extended sessions: ${drError.message}`);
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
    
    Logger.log(`Generated ${sessions.length} sessions (${originalSessionCount} original + ${extendedSessionCount - originalSessionCount} extended)`);
    
    return sessions;
  } catch (error) {
    Logger.log(`Error generating sessions for chapter: ${error.message}`);
    return [{ sessionNumber: 1, sessionName: 'Session 1', estimatedDuration: '45 minutes', isExtended: false }];
  }
}

/**
 * Check for duplicate lesson plans
 */
function _checkForDuplicateLessonPlan(schemeId, chapter, session, teacherEmail) {
  try {
    const lessonPlansSheet = _getSheet('LessonPlans');
    const headers = _headers(lessonPlansSheet);
    const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, headers));
    
    const duplicate = existingPlans.find(plan =>
      plan.schemeId === schemeId &&
      (plan.chapter || '').toLowerCase() === chapter.toLowerCase() &&
      parseInt(plan.session || '1') === parseInt(session) &&
      (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
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
    Logger.log(`Error checking for duplicate lesson plan: ${error.message}`);
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
    Logger.log(`[VALIDATION ERROR] Exception: ${e && e.message ? e.message : e}`);
    return { success: false, error: `Validation error: ${e && e.message ? e.message : e}` };
  }
}

/**
 * Get scheme details
 */
function _getSchemeDetails(schemeId) {
  try {
    Logger.log(`=== FETCHING SCHEME DETAILS ===`);
    Logger.log(`Scheme ID: ${schemeId}`);
    
    const schemesSheet = _getSheet('Schemes');
    const schemesHeaders = _headers(schemesSheet);
    const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
    
    Logger.log(`Total schemes in sheet: ${allSchemes.length}`);
    
    const scheme = allSchemes.find(s => s.schemeId === schemeId);
    
    if (scheme) {
      Logger.log(`✅ Scheme found:`);
      Logger.log(`  - Chapter: ${scheme.chapter}`);
      Logger.log(`  - noOfSessions: ${scheme.noOfSessions} (type: ${typeof scheme.noOfSessions})`);
      Logger.log(`  - Class: ${scheme.class}`);
      Logger.log(`  - Subject: ${scheme.subject}`);
      Logger.log(`  - Teacher: ${scheme.teacherEmail}`);
    } else {
      Logger.log(`❌ Scheme NOT found with ID: ${schemeId}`);
    }
    
    return scheme || {};
  } catch (error) {
    Logger.log(`Error getting scheme details: ${error.message}`);
    return {};
  }
}

/**
 * Get lesson planning settings from Settings sheet
 */
function _getLessonPlanSettings() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Look for lesson planning settings
    const preparationDaySetting = settingsData.find(row => 
      (row.key || '').toLowerCase() === 'lessonplan_preparation_day'
    );
    
    const weeksAheadSetting = settingsData.find(row =>
      (row.key || '').toLowerCase() === 'lessonplan_weeks_ahead'
    );
    
    const bulkOnlySetting = settingsData.find(row =>
      (row.key || '').toLowerCase() === 'lessonplan_bulk_only'
    );
    
    // Parse bulk only setting (true/yes/1 = enabled)
    const bulkOnlyValue = bulkOnlySetting ? String(bulkOnlySetting.value).toLowerCase() : 'false';
    const bulkOnly = bulkOnlyValue === 'true' || bulkOnlyValue === 'yes' || bulkOnlyValue === '1';
    
    return {
      preparationDay: preparationDaySetting ? preparationDaySetting.value : 'Friday',
      weeksAhead: weeksAheadSetting ? parseInt(weeksAheadSetting.value) : 1,
      bulkOnly: bulkOnly
    };
  } catch (error) {
    Logger.log(`Error reading lesson plan settings: ${error.message}`);
    return {
      preparationDay: 'Friday',
      weeksAhead: 1,
      bulkOnly: false
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
      Logger.log('_formatTime: Empty value');
      return '';
    }
    
    Logger.log(`_formatTime: Input type = ${typeof timeValue}, value = ${timeValue}`);
    
    // If it's already a string in HH:MM format, return it
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      Logger.log(`_formatTime: Already formatted string: ${timeValue}`);
      return timeValue;
    }
    
    // Handle Date objects (from Google Sheets time cells)
    if (timeValue instanceof Date) {
      Logger.log(`_formatTime: Date object detected: ${timeValue.toISOString()}`);
      // Use local time (not UTC) to avoid timezone conversion issues
      const hours = timeValue.getHours();
      const minutes = timeValue.getMinutes();
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      Logger.log(`_formatTime: Date converted to: ${result}`);
      return result;
    }
    
    // Handle numeric fractions (Excel/Sheets time as decimal)
    if (typeof timeValue === 'number') {
      Logger.log(`_formatTime: Numeric value: ${timeValue}`);
      // Excel stores time as fraction of a day (e.g., 0.5 = 12:00 PM)
      const totalMinutes = Math.round(timeValue * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      Logger.log(`_formatTime: Numeric converted to: ${result}`);
      return result;
    }
    
    // Try parsing as date string
    Logger.log(`_formatTime: Attempting to parse as date string`);
    const date = new Date(timeValue);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    Logger.log(`_formatTime: Parsed date converted to: ${result}`);
    return result;
  } catch (error) {
    Logger.log(`_formatTime ERROR: ${error.message} for value: ${timeValue}`);
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
        Logger.log(`Cache parse error: ${cacheParseError.message}`);
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
          Logger.log(`Error parsing class-specific timings: ${parseError.message}`);
        }
      }
    }
    
    // Fall back to global period times
    const isFriday = _normalizeDayName(dayName) === 'friday';
    const settingKey = isFriday ? 'periodTimes (Friday)' : 'periodTimes (Monday to Thursday)';
    
    const periodTimesSetting = settingsData.find(row => (row.key || '').trim() === settingKey);
    
    if (!periodTimesSetting || !periodTimesSetting.value) {
      Logger.log(`No period times found for ${settingKey}, using defaults`);
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    let periodTimings;
    try {
      periodTimings = JSON.parse(periodTimesSetting.value);
      // Cache the parsed timings
      cache.put(cacheKey, JSON.stringify(periodTimings), PERIOD_TIMING_CACHE_TTL);
    } catch (parseError) {
      Logger.log(`Error parsing period times JSON: ${parseError.message}`);
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    const periodTiming = periodTimings.find(p => String(p.period) === String(periodNumber));
    
    if (periodTiming) {
      return { start: periodTiming.start, end: periodTiming.end };
    }
    
    Logger.log(`Period ${periodNumber} not found in settings, using default`);
    return _getDefaultPeriodTiming(periodNumber);
    
  } catch (error) {
    Logger.log(`Error getting period timing: ${error.message}`);
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
    Logger.log('=== FINDING REMAINING LESSON PLANS ===');
    Logger.log(`Teacher: ${teacherEmail}, Class: ${classValue}, Subject: ${subject}, Chapter: ${chapter}`);
    Logger.log(`After date: ${afterDate}`);
    
    const lpSheet = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSheet);
    const allPlans = _rows(lpSheet).map(row => _indexByHeader(row, lpHeaders));
    
    const afterDateNorm = _normalizeQueryDate(afterDate);
    Logger.log(`After date normalized: ${afterDateNorm}`);
    
    // First, find all plans for this teacher/class/subject/chapter
    const chapterPlans = allPlans.filter(plan => {
      const emailMatch = String(plan.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
      const classMatch = String(plan.class || '') === String(classValue || '');
      const subjectMatch = String(plan.subject || '') === String(subject || '');
      const chapterMatch = String(plan.chapter || '').toLowerCase() === String(chapter || '').toLowerCase();
      
      return emailMatch && classMatch && subjectMatch && chapterMatch;
    });
    
    Logger.log(`Found ${chapterPlans.length} total plans for this chapter`);
    
    // Log details of each plan
    chapterPlans.forEach(plan => {
      const planDateNorm = _normalizeQueryDate(plan.selectedDate);
      const isActive = !['Cancelled', 'Rejected', 'Completed Early'].includes(String(plan.status || ''));
      const isAfterDate = planDateNorm > afterDateNorm;
      
      Logger.log(`Plan: ${plan.lpId}`);
      Logger.log(`  Date: ${plan.selectedDate} -> ${planDateNorm}`);
      Logger.log(`  Status: ${plan.status} (Active: ${isActive})`);
      Logger.log(`  Is After ${afterDateNorm}: ${isAfterDate}`);
      Logger.log(`  Session: ${plan.session}`);
    });
    
    const remainingPlans = chapterPlans.filter(plan => {
      const statusNorm = String(plan.status || '').trim().toLowerCase();
      const isActive = !['cancelled', 'rejected', 'completed early', 'skipped'].includes(statusNorm);
      const planDateNorm = _normalizeQueryDate(plan.selectedDate);
      const isAfterDate = planDateNorm > afterDateNorm;
      
      return isActive && isAfterDate;
    });
    
    Logger.log(`Found ${remainingPlans.length} remaining lesson plans (after ${afterDateNorm}, active only)`);
    
    return remainingPlans.map(plan => ({
      lpId: plan.lpId,
      selectedDate: _normalizeQueryDate(plan.selectedDate), // Ensure YYYY-MM-DD format
      selectedPeriod: plan.selectedPeriod,
      session: plan.session,
      status: plan.status,
      learningObjectives: plan.learningObjectives
    }));
    
  } catch (error) {
    Logger.log(`Error finding remaining lesson plans: ${error.message}`);
    return [];
  }
}

/**
 * Skip remaining sessions when a chapter is completed early
 * Called when teacher checks "Chapter Fully Completed" before the final session
 */
function _skipRemainingSessionsForCompletedChapter(reportData) {
  try {
    Logger.log('=== SKIPPING REMAINING SESSIONS FOR COMPLETED CHAPTER ===');
    Logger.log('Report data: ' + JSON.stringify(reportData));
    
    const lessonPlanId = reportData.lessonPlanId;
    const currentSession = Number(reportData.sessionNo || 0);
    const totalSessions = Number(reportData.totalSessions || 1);
    
    // If this is already the last session, nothing to skip
    if (currentSession >= totalSessions) {
      Logger.log('Already at or past final session - nothing to skip');
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
      Logger.log('Base lesson plan not found');
      return { success: false, error: 'Lesson plan not found' };
    }
    
    Logger.log('Found base lesson plan: ' + JSON.stringify(baseLessonPlan));
    
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
          Logger.log(`Marked session ${lpSession} as Skipped (row ${rowIndex})`);
          skippedCount++;
        }
      }
    }
    
    Logger.log(`Successfully skipped ${skippedCount} remaining sessions`);
    return { success: true, sessionsSkipped: skippedCount };
    
  } catch (error) {
    Logger.log('Error skipping remaining sessions: ' + error.message);
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