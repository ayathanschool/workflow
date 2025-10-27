// ============================================================================
// IT LAB SEMI-AUTOMATIC SUBSTITUTION FEATURE
// ============================================================================
// Add this code to your Code.gs file (append at the end, before the final closing brace)

/**
 * SEMI-AUTOMATIC IT LAB SUBSTITUTIONS
 * 
 * HOW IT WORKS:
 * 1. System automatically generates DRAFT substitutions for IT Lab periods
 * 2. Drafts are saved in a new sheet: "IT Lab Drafts"
 * 3. HM reviews the drafts, can modify teacher assignments
 * 4. HM clicks "Submit" to move approved drafts to actual Substitutions sheet
 * 
 * SETUP INSTRUCTIONS:
 * 1. In "Timetable" sheet, add column: "isITLab" (mark IT Lab periods as TRUE)
 * 2. Create new sheet: "IT Lab Drafts" with columns:
 *    date | period | class | subject | absentTeacher | suggestedTeacher | status | notes
 * 3. Copy this code to end of Code.gs (before final })
 * 4. Deploy as Version 30
 */

function generateITLabDrafts(targetDate) {
  try {
    if (!targetDate) {
      targetDate = _isoDateString(new Date());
    }
    
    const date = new Date(targetDate + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    
    Logger.log(`Generating IT Lab drafts for ${targetDate} (${dayOfWeek})`);
    
    // Get or create IT Lab Drafts sheet
    let draftsSheet;
    try {
      draftsSheet = _getSheet('IT Lab Drafts');
    } catch (e) {
      // Create sheet if it doesn't exist
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      draftsSheet = ss.insertSheet('IT Lab Drafts');
      draftsSheet.appendRow(['date', 'period', 'class', 'subject', 'absentTeacher', 'suggestedTeacher', 'status', 'notes']);
    }
    
    // Get timetable
    const ttSheet = _getSheet('Timetable');
    const ttHeaders = _headers(ttSheet);
    const ttRecords = _rows(ttSheet).map(r => _indexByHeader(r, ttHeaders));
    
    // Filter for IT Lab periods
    const itLabPeriods = ttRecords.filter(record => {
      const recordDay = _normalizeDayName(String(record.dayOfWeek || ''));
      const isITLab = String(record.isITLab || '').toUpperCase() === 'TRUE';
      return recordDay === dayOfWeek && isITLab;
    });
    
    if (itLabPeriods.length === 0) {
      return { success: true, message: 'No IT Lab periods for this day', count: 0 };
    }
    
    // Get existing substitutions
    const subSheet = _getSheet('Substitutions');
    const subHeaders = _headers(subSheet);
    const existingSubs = _rows(subSheet).map(r => _indexByHeader(r, subHeaders));
    
    // Get existing drafts
    const draftHeaders = _headers(draftsSheet);
    const existingDrafts = _rows(draftsSheet).map(r => _indexByHeader(r, draftHeaders));
    
    let generated = 0;
    let skipped = 0;
    
    itLabPeriods.forEach(itLab => {
      const period = Number(itLab.period || 0);
      const className = String(itLab.class || '');
      const itTeacher = String(itLab.teacherName || '');
      
      // Check if already exists in substitutions
      const existsInSubs = existingSubs.some(sub => {
        const subDate = _isoDateString(sub.date);
        return subDate === targetDate && Number(sub.period) === period && String(sub.class) === className;
      });
      
      // Check if draft already exists
      const existsInDrafts = existingDrafts.some(draft => {
        const draftDate = _isoDateString(draft.date);
        return draftDate === targetDate && Number(draft.period) === period && String(draft.class) === className;
      });
      
      if (existsInSubs || existsInDrafts) {
        Logger.log(`Already exists: ${className} Period ${period}`);
        skipped++;
        return;
      }
      
      // Find suggested free teacher
      const freeTeacher = _findFreeTeacherForPeriod(targetDate, period, dayOfWeek, ttRecords, existingSubs);
      
      const newDraft = [
        targetDate,
        period,
        className,
        'Classroom Supervision',
        itTeacher,
        freeTeacher ? freeTeacher.name : 'NO FREE TEACHER',
        'pending',
        'IT Lab - Classroom Supervision'
      ];
      
      draftsSheet.appendRow(newDraft);
      generated++;
      Logger.log(`Generated draft: ${className} Period ${period} -> ${freeTeacher ? freeTeacher.name : 'NO TEACHER'}`);
    });
    
    return {
      success: true,
      message: `Generated ${generated} drafts, skipped ${skipped}`,
      generated: generated,
      skipped: skipped
    };
    
  } catch (error) {
    Logger.log(`Error generating IT Lab drafts: ${error}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Helper: Find a free teacher for a specific period
 */
function _findFreeTeacherForPeriod(date, period, dayOfWeek, timetableRecords, existingSubstitutions) {
  // Get all teachers
  const teachersSheet = _getSheet('Users');
  const teachersHeaders = _headers(teachersSheet);
  const allTeachers = _rows(teachersSheet)
    .map(r => _indexByHeader(r, teachersHeaders))
    .filter(u => String(u.role || '').toLowerCase() === 'teacher');
  
  // Find teachers who are scheduled for this period
  const busyTeachers = new Set();
  
  // Check timetable
  timetableRecords.forEach(record => {
    const recordDay = _normalizeDayName(String(record.dayOfWeek || ''));
    const recordPeriod = Number(record.period || 0);
    if (recordDay === dayOfWeek && recordPeriod === period) {
      busyTeachers.add(String(record.teacherName || '').toLowerCase());
    }
  });
  
  // Check existing substitutions
  existingSubstitutions.forEach(sub => {
    const subDate = _isoDateString(sub.date);
    const subPeriod = Number(sub.period || 0);
    if (subDate === date && subPeriod === period) {
      busyTeachers.add(String(sub.substituteTeacher || '').toLowerCase());
    }
  });
  
  // Find first free teacher
  for (let i = 0; i < allTeachers.length; i++) {
    const teacher = allTeachers[i];
    const teacherName = String(teacher.name || '');
    if (!busyTeachers.has(teacherName.toLowerCase())) {
      return { name: teacherName, email: String(teacher.email || '') };
    }
  }
  
  return null;
}

/**
 * HM submits approved IT Lab drafts to actual Substitutions sheet
 */
function submitITLabDrafts(targetDate, userName) {
  try {
    if (!targetDate) {
      targetDate = _isoDateString(new Date());
    }
    
    const draftsSheet = _getSheet('IT Lab Drafts');
    const draftHeaders = _headers(draftsSheet);
    const draftRows = _rows(draftsSheet);
    const draftRecords = draftRows.map(r => _indexByHeader(r, draftHeaders));
    
    // Filter pending drafts for target date
    const pendingDrafts = draftRecords.filter(draft => {
      const draftDate = _isoDateString(draft.date);
      const status = String(draft.status || '').toLowerCase();
      return draftDate === targetDate && status === 'pending';
    });
    
    if (pendingDrafts.length === 0) {
      return { success: true, message: 'No pending drafts to submit', count: 0 };
    }
    
    // Submit to Substitutions sheet
    const subSheet = _getSheet('Substitutions');
    let submitted = 0;
    
    pendingDrafts.forEach(draft => {
      const newRow = [
        _isoDateString(draft.date),
        Number(draft.period),
        String(draft.class),
        String(draft.subject || 'Classroom Supervision'),
        String(draft.absentTeacher),
        String(draft.suggestedTeacher),
        String(draft.notes || ''),
        'IT Lab',
        _timestampIST(),
        userName || 'HM'
      ];
      
      subSheet.appendRow(newRow);
      submitted++;
    });
    
    // Mark drafts as submitted
    draftRows.forEach((row, index) => {
      const draft = draftRecords[index];
      const draftDate = _isoDateString(draft.date);
      const status = String(draft.status || '').toLowerCase();
      
      if (draftDate === targetDate && status === 'pending') {
        const rowIndex = index + 2; // +2 because of header and 0-indexing
        const statusCol = draftHeaders.indexOf('status') + 1;
        draftsSheet.getRange(rowIndex, statusCol).setValue('submitted');
      }
    });
    
    return {
      success: true,
      message: `Submitted ${submitted} IT Lab substitutions`,
      count: submitted
    };
    
  } catch (error) {
    Logger.log(`Error submitting IT Lab drafts: ${error}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Update a specific draft (HM can change suggested teacher)
 */
function updateITLabDraft(draftId, newTeacher) {
  try {
    const draftsSheet = _getSheet('IT Lab Drafts');
    const rowIndex = Number(draftId) + 2; // Convert to sheet row (header + 0-index)
    const draftHeaders = _headers(draftsSheet);
    const teacherCol = draftHeaders.indexOf('suggestedTeacher') + 1;
    
    draftsSheet.getRange(rowIndex, teacherCol).setValue(newTeacher);
    
    return { success: true, message: 'Draft updated' };
  } catch (error) {
    Logger.log(`Error updating draft: ${error}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Optional: Set up daily trigger to auto-generate drafts
 */
function setupITLabDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyITLabDraftJob') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('dailyITLabDraftJob')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();
  
  Logger.log('IT Lab daily draft trigger set up at 6 AM');
  return 'Daily draft generation enabled at 6 AM';
}

function dailyITLabDraftJob() {
  const today = _isoDateString(new Date());
  Logger.log(`Running daily IT Lab draft generation for ${today}`);
  const result = generateITLabDrafts(today);
  Logger.log(`Result: ${JSON.stringify(result)}`);
}

// ADD TO YOUR doPost HANDLER (inside the main doPost function, add these actions):
/*
  // Generate draft IT Lab substitutions (HM can review)
  if (action === 'generateITLabDrafts') {
    const date = (e.parameter.date || '').trim() || _isoDateString(new Date());
    return _respond(generateITLabDrafts(date));
  }
  
  // Get pending drafts for HM review
  if (action === 'getITLabDrafts') {
    try {
      const date = (e.parameter.date || '').trim();
      const draftsSheet = _getSheet('IT Lab Drafts');
      const draftHeaders = _headers(draftsSheet);
      const draftRows = _rows(draftsSheet);
      const drafts = draftRows.map((row, index) => {
        const draft = _indexByHeader(row, draftHeaders);
        return {
          id: index,
          date: _isoDateString(draft.date),
          period: Number(draft.period),
          class: String(draft.class),
          subject: String(draft.subject),
          absentTeacher: String(draft.absentTeacher),
          suggestedTeacher: String(draft.suggestedTeacher),
          status: String(draft.status || 'pending'),
          notes: String(draft.notes || '')
        };
      });
      
      // Filter by date if provided
      const filtered = date 
        ? drafts.filter(d => d.date === date && d.status === 'pending')
        : drafts.filter(d => d.status === 'pending');
      
      return _respond(filtered);
    } catch (error) {
      return _respondError(error.toString());
    }
  }
  
  // HM submits approved drafts
  if (action === 'submitITLabDrafts') {
    const date = (e.parameter.date || '').trim() || _isoDateString(new Date());
    const userName = (e.parameter.userName || '').trim();
    return _respond(submitITLabDrafts(date, userName));
  }
  
  // HM updates a draft (change teacher)
  if (action === 'updateITLabDraft') {
    const draftId = (e.parameter.draftId || '').trim();
    const newTeacher = (e.parameter.newTeacher || '').trim();
    return _respond(updateITLabDraft(draftId, newTeacher));
  }
  
  // Get all free teachers for a period (for HM to choose alternative)
  if (action === 'getFreeTeachers') {
    const date = (e.parameter.date || '').trim();
    const period = Number(e.parameter.period || 0);
    
    const dateObj = new Date(date + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];
    
    const ttSheet = _getSheet('Timetable');
    const ttHeaders = _headers(ttSheet);
    const ttRecords = _rows(ttSheet).map(r => _indexByHeader(r, ttHeaders));
    
    const subSheet = _getSheet('Substitutions');
    const subHeaders = _headers(subSheet);
    const existingSubs = _rows(subSheet).map(r => _indexByHeader(r, subHeaders));
    
    // Get all teachers
    const teachersSheet = _getSheet('Users');
    const teachersHeaders = _headers(teachersSheet);
    const allTeachers = _rows(teachersSheet)
      .map(r => _indexByHeader(r, teachersHeaders))
      .filter(u => String(u.role || '').toLowerCase() === 'teacher');
    
    // Find busy teachers
    const busyTeachers = new Set();
    ttRecords.forEach(record => {
      const recordDay = _normalizeDayName(String(record.dayOfWeek || ''));
      const recordPeriod = Number(record.period || 0);
      if (recordDay === dayOfWeek && recordPeriod === period) {
        busyTeachers.add(String(record.teacherName || '').toLowerCase());
      }
    });
    
    existingSubs.forEach(sub => {
      const subDate = _isoDateString(sub.date);
      const subPeriod = Number(sub.period || 0);
      if (subDate === date && subPeriod === period) {
        busyTeachers.add(String(sub.substituteTeacher || '').toLowerCase());
      }
    });
    
    // Return free teachers
    const freeTeachers = allTeachers
      .filter(t => !busyTeachers.has(String(t.name || '').toLowerCase()))
      .map(t => ({ name: String(t.name), email: String(t.email) }));
    
    return _respond(freeTeachers);
  }
*/
