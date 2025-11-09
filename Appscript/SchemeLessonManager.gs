/**
 * SchemeLessonManager.gs
 * Manages scheme-based lesson plan preparation
 * Implements reverse flow: Schemes → Chapters → Sessions → Select Period
 */

/**
 * Check if today is the designated lesson plan preparation day
 */
function _isTodayPreparationDay() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    const preparationDayRow = settingsData.find(row => (row.key || '').trim() === 'lessonplan_preparation_day');
    const preparationDay = (preparationDayRow?.value || 'Friday').trim().toLowerCase();
    
    const today = new Date();
    const todayDayName = _dayName(_isoDateString(today)).toLowerCase();
    
    Logger.log(`Today: ${todayDayName}, Preparation day: ${preparationDay}`);
    
    return todayDayName === preparationDay;
  } catch (error) {
    Logger.log(`Error checking preparation day: ${error.message}`);
    return true; // Allow by default if error
  }
}

/**
 * Calculate lesson planning date range based on Settings
 */
function _calculateLessonPlanningDateRange() {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Get configuration from Settings
    const preparationDayRow = settingsData.find(row => (row.key || '').trim() === 'lessonplan_preparation_day');
    const daysAheadRow = settingsData.find(row => (row.key || '').trim() === 'lessonplan_days_ahead');
    const deferredDaysRow = settingsData.find(row => (row.key || '').trim() === 'lessonplan_deferred_days');
    
    // Parse values with defaults
    const preparationDay = (preparationDayRow?.value || 'Monday').trim();
    const daysAhead = parseInt(daysAheadRow?.value || '7'); // Total days to show from start
    // Handle empty string or '0' for deferredDays - treat empty as 0
    let deferredDays = 5; // default
    if (deferredDaysRow && deferredDaysRow.value !== undefined && deferredDaysRow.value !== null) {
      const deferredValue = String(deferredDaysRow.value).trim();
      if (deferredValue === '' || deferredValue === '0') {
        deferredDays = 0;
      } else {
        deferredDays = parseInt(deferredValue) || 5;
      }
    }
    
    Logger.log(`Lesson planning config: Preparation day=${preparationDay}, Deferred days=${deferredDays}, Days ahead=${daysAhead}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDayName = _dayName(_isoDateString(today));
    
    // Check if today is preparation day
    const isPreparationDay = todayDayName.toLowerCase() === preparationDay.toLowerCase();
    
    // Calculate start date (today + deferred days)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + deferredDays);
    
    // Calculate end date (start date + days ahead - 1)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead - 1);
    
    // Format as ISO date strings
    const startDateString = _isoDateString(startDate);
    const endDateString = _isoDateString(endDate);
    
    Logger.log(`TODAY: ${_isoDateString(today)} (${todayDayName}), Is preparation day: ${isPreparationDay}`);
    Logger.log(`DEFERRED DAYS: ${deferredDays}, DAYS AHEAD: ${daysAhead}`);
    Logger.log(`CALCULATED START: ${startDateString} (${_dayName(startDateString)})`);
    Logger.log(`CALCULATED END: ${endDateString} (${_dayName(endDateString)})`);
    Logger.log(`Planning window: ${startDateString} to ${endDateString}`);
    
    return {
      startDate: startDateString,
      endDate: endDateString,
      deferredDays: deferredDays,
      daysAhead: daysAhead,
      preparationDay: preparationDay,
      isPreparationDay: isPreparationDay,
      canSubmit: isPreparationDay
    };
  } catch (error) {
    Logger.log(`Error calculating date range: ${error.message}, using defaults`);
    // Default: show next week (5 days from today, 7 days duration)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    return {
      startDate: _isoDateString(startDate),
      endDate: _isoDateString(endDate),
      deferredDays: 5,
      daysAhead: 7,
      preparationDay: 'Monday',
      isPreparationDay: true,
      canSubmit: true
    };
  }
}

/**
 * Get approved schemes for a teacher with chapter/session breakdown
 */
function getApprovedSchemesForLessonPlanning(teacherEmail) {
  try {
    Logger.log(`Getting approved schemes for lesson planning: ${teacherEmail}`);
    
    if (!teacherEmail) {
      return { success: false, error: 'Teacher email is required' };
    }
    
    // Get approved schemes for the teacher
    const schemesSheet = _getSheet('Schemes');
    const schemesHeaders = _headers(schemesSheet);
    const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
    
    const approvedSchemes = allSchemes.filter(scheme => 
      (scheme.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
      (scheme.status || '').toLowerCase() === 'approved'
    );
    
    // Get existing lesson plans to check what's already planned
    const lessonPlansSheet = _getSheet('LessonPlans');
    const lessonPlansHeaders = _headers(lessonPlansSheet);
    const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
    
    const teacherPlans = existingPlans.filter(plan =>
      (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );
    
    // Process each scheme to show chapter/session breakdown
    const schemesWithProgress = approvedSchemes.map(scheme => {
      const schemeChapters = _parseSchemeChapters(scheme);
      const chaptersWithSessions = schemeChapters.map(chapter => {
        const sessions = _generateSessionsForChapter(chapter, scheme);
        const sessionsWithStatus = sessions.map(session => {
          const existingPlan = teacherPlans.find(plan =>
            plan.schemeId === scheme.schemeId &&
            String(plan.chapter || '').toLowerCase() === String(chapter.name || '').toLowerCase() &&
            parseInt(plan.session || '1') === session.sessionNumber
          );
          
          return {
            sessionNumber: session.sessionNumber,
            sessionName: session.sessionName,
            estimatedDuration: session.estimatedDuration,
            status: existingPlan ? 'planned' : 'not-planned',
            plannedDate: existingPlan ? existingPlan.selectedDate : null,
            plannedPeriod: existingPlan ? existingPlan.selectedPeriod : null,
            lessonPlanId: existingPlan ? existingPlan.lpId : null
          };
        });
        
        const totalSessions = sessions.length;
        const plannedSessions = sessionsWithStatus.filter(s => s.status === 'planned').length;
        
        return {
          chapterNumber: chapter.number,
          chapterName: chapter.name,
          chapterDescription: chapter.description,
          totalSessions: totalSessions,
          plannedSessions: plannedSessions,
          completionPercentage: totalSessions > 0 ? Math.round((plannedSessions / totalSessions) * 100) : 0,
          sessions: sessionsWithStatus
        };
      });
      
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
    
    return {
      success: true,
      schemes: schemesWithProgress,
      planningDateRange: planningDateRange,
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
          const active     = !['cancelled','rejected'].includes(String(p.status || '').trim().toLowerCase());
          
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
    
    // Generate available slots within planning window (Monday-Friday only)
    const availableSlots = [];
    
    for (let date = new Date(planningStartDate); date <= planningEndDate; date.setDate(date.getDate() + 1)) {
      const dateString = _normalizeQueryDate(date); // IST-safe date normalization
      const dayName = _dayNameIST(dateString); // IST-safe day name
      
      // Only show Monday to Friday (weekdays only)
      if (dayName === 'Saturday' || dayName === 'Sunday') continue;
      
      // Find periods for this day that match the scheme's class and subject
      const dayPeriods = teacherTimetable.filter(slot => {
        const dayMatch = _normalizeDayName(slot.dayOfWeek || '') === _normalizeDayName(dayName);
        // ONLY show periods that match the scheme's class and subject
        const classMatch = (slot.class || '').toLowerCase() === (schemeClass || '').toLowerCase();
        const subjectMatch = (slot.subject || '').toLowerCase() === (schemeSubject || '').toLowerCase();
        
        return dayMatch && classMatch && subjectMatch;
      });
      
      Logger.log(`${dayName} (${dateString}): Found ${dayPeriods.length} matching periods for ${schemeClass} ${schemeSubject}`);
      
      dayPeriods.forEach(period => {
        const periodNum = parseInt(String(period.period).trim(), 10);
        const isOccupied = occupiedSlots.some(occupied => {
          return occupied.date === dateString && occupied.period === periodNum;
        });
        
        const periodTiming = _getPeriodTiming(period.period, dayName);
        
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
    
    return {
      success: true,
      availableSlots: availableSlots,
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
 * Create lesson plan for specific scheme chapter session
 * WITH DOCUMENT LOCK AND UNIQUE KEY CONSTRAINT
 */
function createSchemeLessonPlan(lessonPlanData) {
  var lock = LockService.getDocumentLock();
  try {
    Logger.log(`Creating scheme-based lesson plan: ${JSON.stringify(lessonPlanData)}`);
    
    // Check if today is the preparation day
    const isPreparationDay = _isTodayPreparationDay();
    if (!isPreparationDay) {
      const dateRange = _calculateLessonPlanningDateRange();
      const errorMsg = `Lesson plans can only be submitted on ${dateRange.preparationDay}. Today is ${_dayName(_isoDateString(new Date()))}`;
      Logger.log(`ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // Validate required fields
    const requiredFields = ['schemeId', 'chapter', 'session', 'teacherEmail', 'selectedDate', 'selectedPeriod'];
    const missing = requiredFields.filter(field => !String(lessonPlanData[field] ?? '').trim());
    if (missing.length) {
      const errorMsg = `Missing required field(s): ${missing.join(', ')}`;
      Logger.log(`ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
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
    
    // Get scheme details for class/subject
    const schemeDetails = _getSchemeDetails(lessonPlanData.schemeId) || {};
    
    // Prepare row data
    const finalStatus = lessonPlanData.status === 'submitted' ? 'Pending Review' : (lessonPlanData.status || 'draft');
    
    const rowObject = {
      lpId: lpId,
      schemeId: lessonPlanData.schemeId,
      teacherEmail: lessonPlanData.teacherEmail,
      teacherName: lessonPlanData.teacherName || '',
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
      message: 'Lesson plan created successfully',
      data: {
        lpId: lpId,
        schemeId: lessonPlanData.schemeId,
        chapter: lessonPlanData.chapter,
        session: lessonPlanData.session,
        selectedDate: isoDate,
        selectedPeriod: periodStr,
        uniqueKey: uniqueKey
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
 * NO MOCK DATA - just use session numbers
 */
function _generateSessionsForChapter(chapter, scheme) {
  try {
    // USE THE SCHEME'S noOfSessions FIELD - this is the actual number the teacher specified
    let sessionCount = parseInt(scheme.noOfSessions || 2);
    
    Logger.log(`Generating ${sessionCount} sessions for chapter: ${chapter.name}`);
    
    const sessions = [];
    for (let i = 1; i <= sessionCount; i++) {
      // NO GENERIC NAMES - just use "Session X"
      sessions.push({
        sessionNumber: i,
        sessionName: `Session ${i}`,
        estimatedDuration: '45 minutes'
      });
    }
    
    return sessions;
  } catch (error) {
    Logger.log(`Error generating sessions for chapter: ${error.message}`);
    return [{ sessionNumber: 1, sessionName: 'Session 1', estimatedDuration: '45 minutes' }];
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
      const active     = !['cancelled','rejected'].includes(String(p.status || '').trim().toLowerCase());
      
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
    const schemesSheet = _getSheet('Schemes');
    const schemesHeaders = _headers(schemesSheet);
    const allSchemes = _rows(schemesSheet).map(row => _indexByHeader(row, schemesHeaders));
    
    const scheme = allSchemes.find(s => s.schemeId === schemeId);
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
    
    return {
      preparationDay: preparationDaySetting ? preparationDaySetting.value : 'Friday',
      weeksAhead: weeksAheadSetting ? parseInt(weeksAheadSetting.value) : 1
    };
  } catch (error) {
    Logger.log(`Error reading lesson plan settings: ${error.message}`);
    return {
      preparationDay: 'Friday',
      weeksAhead: 1
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
function _getPeriodTiming(periodNumber, dayName) {
  try {
    const settingsSheet = _getSheet('Settings');
    const settingsHeaders = _headers(settingsSheet);
    const settingsData = _rows(settingsSheet).map(row => _indexByHeader(row, settingsHeaders));
    
    // Determine which setting to use based on day
    const isFriday = _normalizeDayName(dayName) === 'friday';
    const settingKey = isFriday ? 'periodTimes (Friday)' : 'periodTimes (Monday to Thursday)';
    
    // Find the setting row
    const periodTimesSetting = settingsData.find(row => 
      (row.key || '').trim() === settingKey
    );
    
    if (!periodTimesSetting || !periodTimesSetting.value) {
      Logger.log(`No period times found for ${settingKey}, using defaults`);
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    // Parse the JSON value
    let periodTimings;
    try {
      periodTimings = JSON.parse(periodTimesSetting.value);
    } catch (parseError) {
      Logger.log(`Error parsing period times JSON: ${parseError.message}`);
      return _getDefaultPeriodTiming(periodNumber);
    }
    
    // Find the specific period
    const periodTiming = periodTimings.find(p => parseInt(p.period) === parseInt(periodNumber));
    
    if (periodTiming) {
      return {
        start: periodTiming.start,
        end: periodTiming.end
      };
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
 * Normalize day name for comparison
 */
function _normalizeDayName(dayName) {
  const normalized = String(dayName || '').toLowerCase().trim();
  // Handle abbreviated forms
  const dayMap = {
    'mon': 'monday',
    'tue': 'tuesday',
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday'
  };
  return dayMap[normalized] || normalized;
}