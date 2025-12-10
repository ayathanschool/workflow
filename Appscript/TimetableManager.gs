/**
 * ====== TIMETABLE MANAGEMENT SYSTEM ======
 * This file handles all timetable and schedule functions
 * Think of this as your "Schedule Department"
 */

/**
 * Get a teacher's weekly timetable (7 days starting from today)
 */
function getTeacherWeeklyTimetable(identifier) {
  // Create array of next 7 days
  const TZ = 'Asia/Kolkata';
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 24 * 3600 * 1000);
    const iso = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    const dayName = Utilities.formatDate(d, TZ, 'EEEE');
    days.push({ date: iso, dayName });
  }
  
  // Get timetable data
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  const list = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => {
      const te = String(r.teacherEmail || '').toLowerCase();
      const tn = String(r.teacherName || '').toLowerCase();
      const id = identifier.toLowerCase();
      return te === id || tn === id;
    });
  
  // Group by day - return as array for frontend
  const result = [];
  days.forEach(day => {
    const dayEntries = list.filter(entry => 
      _normalizeDayName(entry.dayOfWeek) === _normalizeDayName(day.dayName)
    );
    
    // Sort by period number
    dayEntries.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));
    
    result.push({
      date: day.date,
      day: day.dayName,  // Frontend expects 'day' property
      dayName: day.dayName,
      periods: dayEntries
    });
  });
  
  return result;
}

/**
 * Get a teacher's timetable for a specific date WITH substitutions applied
 * This returns:
 * - Regular periods where they're teaching (EXCLUDING periods where they're absent)
 * - Substitution periods where they're the substitute teacher
 */
function getTeacherDailyTimetable(identifier, date) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);
  const idLower = identifier.toLowerCase();
  
  Logger.log(`[getTeacherDailyTimetable] Getting timetable for ${idLower} on ${normalizedDate}`);
  
  // Get regular timetable for this teacher
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  const regularPeriods = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => {
      const te = String(r.teacherEmail || '').toLowerCase();
      const tn = String(r.teacherName || '').toLowerCase();
      return (te === idLower || tn === idLower) && 
             _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName);
    });
  
  Logger.log(`[getTeacherDailyTimetable] Found ${regularPeriods.length} regular periods`);
  
  // Get substitutions for this date
  const substitutionsSh = _getSheet('Substitutions');
  const substitutionsHeaders = _headers(substitutionsSh);
  const allSubstitutions = _rows(substitutionsSh)
    .map(r => _indexByHeader(r, substitutionsHeaders))
    .filter(r => _isoDateString(r.date) === normalizedDate);
  
  Logger.log(`[getTeacherDailyTimetable] Found ${allSubstitutions.length} substitutions for date`);
  
  // Build final period list
  const finalPeriods = [];
  
  // Add regular periods EXCEPT those where teacher is absent
  regularPeriods.forEach(period => {
    const isAbsent = allSubstitutions.some(sub => 
      String(sub.period) === String(period.period) &&
      String(sub.class || '').toLowerCase() === String(period.class || '').toLowerCase() &&
      String(sub.absentTeacher || '').toLowerCase() === idLower
    );
    
    if (!isAbsent) {
      finalPeriods.push({
        ...period,
        isSubstitution: false
      });
    } else {
      Logger.log(`[getTeacherDailyTimetable] Excluding period ${period.period} ${period.class} - teacher is absent`);
    }
  });
  
  // Add substitution periods where this teacher is the substitute
  allSubstitutions.forEach(sub => {
    if (String(sub.substituteTeacher || '').toLowerCase() === idLower) {
      Logger.log(`[getTeacherDailyTimetable] Adding substitution period ${sub.period} ${sub.class}`);
      finalPeriods.push({
        class: sub.class || '',
        dayOfWeek: dayName,
        period: sub.period || '',
        subject: sub.substituteSubject || sub.regularSubject || '',
        teacherEmail: identifier,
        teacherName: identifier,
        isSubstitution: true,
        originalTeacher: sub.absentTeacher || '',
        originalSubject: sub.regularSubject || '',
        substitutionNote: sub.note || ''
      });
    }
  });
  
  // Sort by period number
  finalPeriods.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));
  
  Logger.log(`[getTeacherDailyTimetable] Returning ${finalPeriods.length} periods (${allSubstitutions.filter(s => String(s.substituteTeacher || '').toLowerCase() === idLower).length} substitutions)`);
  
  return {
    date: normalizedDate,
    dayName: dayName,
    periods: finalPeriods
  };
}

/**
 * Get the complete daily timetable with substitutions applied
 * Sheet columns: class, dayOfWeek, period, subject, teacherEmail, teacherName
 */
function getDailyTimetableWithSubstitutions(date) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);
  
  Logger.log(`[getDailyTimetableWithSubstitutions] Date: ${normalizedDate}, DayName: ${dayName}`);
  
  // Get regular timetable
  const timetableSh = _getSheet('Timetable');
  const timetableHeaders = _headers(timetableSh);
  const timetableEntries = _rows(timetableSh)
    .map(r => _indexByHeader(r, timetableHeaders))
    .filter(r => _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName));
  
  Logger.log(`[getDailyTimetableWithSubstitutions] Found ${timetableEntries.length} timetable entries for ${dayName}`);
  
  // Get substitutions for this date
  const substitutionsSh = _getSheet('Substitutions');
  const substitutionsHeaders = _headers(substitutionsSh);
  const substitutions = _rows(substitutionsSh)
    .map(r => _indexByHeader(r, substitutionsHeaders))
    .filter(r => _isoDateString(r.date) === normalizedDate);
  
  Logger.log(`[getDailyTimetableWithSubstitutions] Found ${substitutions.length} substitutions for ${normalizedDate}`);
  if (substitutions.length > 0) {
    Logger.log(`[getDailyTimetableWithSubstitutions] Sample substitution: ${JSON.stringify(substitutions[0])}`);
  }
  
  // Apply substitutions
  const finalTimetable = timetableEntries.map(entry => {
    const substitution = substitutions.find(sub => {
      // Normalize period comparison (could be string or number)
      const periodMatch = String(sub.period) === String(entry.period);
      const classMatch = String(sub.class || '').toLowerCase() === String(entry.class || '').toLowerCase();
      const teacherMatch = String(sub.absentTeacher || '').toLowerCase() === String(entry.teacherEmail || '').toLowerCase();
      
      if (periodMatch && classMatch && !teacherMatch) {
        Logger.log(`[Substitution] Period ${sub.period} Class ${sub.class}: Teacher mismatch - sub.absentTeacher="${sub.absentTeacher}" vs entry.teacherEmail="${entry.teacherEmail}"`);
      }
      
      return periodMatch && classMatch && teacherMatch;
    });
    
    if (substitution) {
      Logger.log(`[Substitution] Applying substitution for Period ${entry.period}, Class ${entry.class}: ${entry.teacherEmail} -> ${substitution.substituteTeacher}`);
      return {
        class: entry.class || '',
        dayOfWeek: entry.dayOfWeek || dayName,
        period: entry.period || '',
        subject: substitution.substituteSubject || entry.subject,
        teacherEmail: substitution.substituteTeacher,
        teacherName: substitution.substituteTeacher, // You might want to lookup the actual name
        originalTeacher: entry.teacherEmail,
        originalTeacherName: entry.teacherName,
        originalSubject: entry.subject,
        isSubstitution: true,
        substitutionNote: substitution.note || ''
      };
    }
    
    return {
      class: entry.class || '',
      dayOfWeek: entry.dayOfWeek || dayName,
      period: entry.period || '',
      subject: entry.subject || '',
      teacherEmail: entry.teacherEmail || '',
      teacherName: entry.teacherName || '',
      isSubstitution: false
    };
  });
  
  // Sort by class and period
  finalTimetable.sort((a, b) => {
    const classCompare = (a.class || '').localeCompare(b.class || '');
    if (classCompare !== 0) return classCompare;
    return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
  });
  
  Logger.log(`[getDailyTimetableWithSubstitutions] Returning ${finalTimetable.length} entries (${substitutions.length} with substitutions)`);
  
  return {
    date: normalizedDate,
    dayName: dayName,
    timetable: finalTimetable
  };
}

/**
 * Get all classes from the timetable
 */
function getAllClasses() {
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  
  const classes = [...new Set(list.map(r => r.class).filter(Boolean))];
  return classes.sort();
}

/**
 * Get timetable for a specific class and date
 */
function getClassTimetable(className, date) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);
  
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  const list = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => 
      r.class === className && 
      _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName)
    );
  
  // Sort by period number
  list.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));
  
  return {
    class: className,
    date: normalizedDate,
    dayName: dayName,
    periods: list
  };
}

/**
 * Normalize day names to handle variations
 */
function _normalizeDayName(input) {
  const day = String(input || '').toLowerCase().trim();
  
  const dayMap = {
    'mon': 'monday',
    'tue': 'tuesday', 
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday',
    'monday': 'monday',
    'tuesday': 'tuesday',
    'wednesday': 'wednesday', 
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
    'sunday': 'sunday'
  };
  
  return dayMap[day] || day;
}

/**
 * Get day of week from date string
 */
function _getDayOfWeek(dateString) {
  try {
    // Use IST timezone consistently
    const TZ = 'Asia/Kolkata';
    const date = new Date(dateString + 'T00:00:00');
    return Utilities.formatDate(date, TZ, 'EEEE');
  } catch (err) {
    console.error('Error getting day of week for:', dateString, err);
    return '';
  }
}

/**
 * Get teachers assigned to substitutions for a specific date
 * Returns list of substitution assignments
 */
function getAssignedSubstitutionsForDate(date) {
  const normalizedDate = _isoDateString(date);
  
  Logger.log(`[getAssignedSubstitutionsForDate] Getting substitutions for date: ${normalizedDate}`);
  
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const substitutions = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => _isoDateString(r.date) === normalizedDate);
  
  Logger.log(`[getAssignedSubstitutionsForDate] Found ${substitutions.length} substitutions`);
  
  return substitutions.map(sub => ({
    date: normalizedDate,
    period: sub.period || '',
    class: sub.class || '',
    absentTeacher: sub.absentTeacher || '',
    substituteTeacher: sub.substituteTeacher || '',
    regularSubject: sub.regularSubject || '',
    substituteSubject: sub.substituteSubject || '',
    note: sub.note || ''
  }));
}

/**
 * Get available teachers for substitution on a specific date and period
 * Returns teachers who are not teaching during that period
 */
function getAvailableTeachers(date, period) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);
  
  Logger.log(`[getAvailableTeachers] ========== START ==========`);
  Logger.log(`[getAvailableTeachers] Date: ${normalizedDate}, Day: ${dayName}, Period: ${period}`);
  
  // Get all teachers from Users sheet
  const usersSh = _getSheet('Users');
  const usersHeaders = _headers(usersSh);
  Logger.log(`[getAvailableTeachers] Users sheet headers: ${JSON.stringify(usersHeaders)}`);
  
  const allUsers = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
  Logger.log(`[getAvailableTeachers] Total users in Users sheet: ${allUsers.length}`);
  
  if (allUsers.length > 0) {
    Logger.log(`[getAvailableTeachers] Sample user row: ${JSON.stringify(allUsers[0])}`);
  }
  
  let allTeachers = allUsers.filter(u => {
    const roles = String(u.roles || '').toLowerCase();
    const hasTeacherRole = roles.includes('teacher') || roles.includes('class teacher');
    if (!hasTeacherRole && u.email) {
      Logger.log(`[getAvailableTeachers] User ${u.email} has roles: "${u.roles}" - excluded`);
    }
    return hasTeacherRole;
  });
  
  Logger.log(`[getAvailableTeachers] Total teachers in Users sheet: ${allTeachers.length}`);
  
  // FALLBACK: If no teachers found in Users sheet, extract from Timetable
  if (allTeachers.length === 0) {
    Logger.log(`[getAvailableTeachers] WARNING: No teachers found in Users sheet. Falling back to Timetable sheet.`);
    const timetableSh = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSh);
    const timetableRows = _rows(timetableSh).map(r => _indexByHeader(r, timetableHeaders));
    
    // Extract unique teachers from timetable
    const teacherMap = {};
    timetableRows.forEach(row => {
      const email = String(row.teacherEmail || '').trim().toLowerCase();
      const name = String(row.teacherName || '').trim();
      if (email && !teacherMap[email]) {
        teacherMap[email] = {
          email: email,
          name: name,
          roles: 'Teacher'
        };
      }
    });
    
    allTeachers = Object.values(teacherMap);
    Logger.log(`[getAvailableTeachers] Extracted ${allTeachers.length} unique teachers from Timetable`);
  }
  
  if (allTeachers.length > 0) {
    Logger.log(`[getAvailableTeachers] Sample teacher: ${JSON.stringify(allTeachers[0])}`);
  }
  
  // Get timetable entries for this day and period
  const timetableSh = _getSheet('Timetable');
  const timetableHeaders = _headers(timetableSh);
  Logger.log(`[getAvailableTeachers] Timetable sheet headers: ${JSON.stringify(timetableHeaders)}`);
  
  const allTimetableRows = _rows(timetableSh).map(r => _indexByHeader(r, timetableHeaders));
  Logger.log(`[getAvailableTeachers] Total timetable rows: ${allTimetableRows.length}`);
  
  if (allTimetableRows.length > 0) {
    Logger.log(`[getAvailableTeachers] Sample timetable row: ${JSON.stringify(allTimetableRows[0])}`);
  }
  
  const busyTeacherRows = allTimetableRows.filter(r => 
    _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName) &&
    String(r.period) === String(period)
  );
  
  Logger.log(`[getAvailableTeachers] Matching timetable rows for ${dayName} Period ${period}: ${busyTeacherRows.length}`);
  if (busyTeacherRows.length > 0) {
    Logger.log(`[getAvailableTeachers] Sample busy row: ${JSON.stringify(busyTeacherRows[0])}`);
  }
  
  const busyTeachers = busyTeacherRows.map(r => String(r.teacherEmail || '').toLowerCase());
  Logger.log(`[getAvailableTeachers] Busy teacher emails: ${JSON.stringify(busyTeachers)}`);
  
  // Get teachers already assigned as substitutes for this date/period
  const substitutionsSh = _getSheet('Substitutions');
  const substitutionsHeaders = _headers(substitutionsSh);
  const assignedSubstitutes = _rows(substitutionsSh)
    .map(r => _indexByHeader(r, substitutionsHeaders))
    .filter(r => 
      _isoDateString(r.date) === normalizedDate &&
      String(r.period) === String(period)
    )
    .map(r => String(r.substituteTeacher || '').toLowerCase());
  
  Logger.log(`[getAvailableTeachers] Assigned substitutes: ${assignedSubstitutes.length}`);
  
  // Filter available teachers (not busy and not already assigned)
  const availableTeachers = allTeachers.filter(teacher => {
    const teacherEmail = String(teacher.email || '').toLowerCase();
    const isBusy = busyTeachers.includes(teacherEmail);
    const isAssigned = assignedSubstitutes.includes(teacherEmail);
    
    if (isBusy || isAssigned) {
      Logger.log(`[getAvailableTeachers] Excluding ${teacher.name} (${teacherEmail}): busy=${isBusy}, assigned=${isAssigned}`);
    }
    
    return !isBusy && !isAssigned;
  });
  
  Logger.log(`[getAvailableTeachers] Available teachers: ${availableTeachers.length}`);
  if (availableTeachers.length > 0) {
    Logger.log(`[getAvailableTeachers] Available: ${availableTeachers.map(t => t.name).join(', ')}`);
  }
  Logger.log(`[getAvailableTeachers] ========== END ==========`);
  
  return availableTeachers.map(t => ({
    name: t.name || '',
    email: t.email || '',
    roles: t.roles || ''
  }));
}

/**
 * Get complete timetable for all classes and teachers
 * Returns structured format grouped by day and period
 * Sheet columns: class, dayOfWeek, period, subject, teacherEmail, teacherName
 */
function getFullTimetable() {
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  const timetable = _rows(sh).map(r => _indexByHeader(r, headers));
  
  Logger.log(`[getFullTimetable] Total entries from sheet: ${timetable.length}`);
  if (timetable.length > 0) {
    Logger.log(`[getFullTimetable] Sample entry: ${JSON.stringify(timetable[0])}`);
    Logger.log(`[getFullTimetable] Classes found: ${[...new Set(timetable.map(e => e.class))].join(', ')}`);
  }
  
  // Return flat array for frontend exam subject loading
  const result = timetable.map(entry => ({
    class: entry.class || '',
    subject: entry.subject || '',
    teacher: entry.teacherName || '',
    teacherEmail: entry.teacherEmail || '',
    dayOfWeek: entry.dayOfWeek || '',
    period: entry.period || ''
  }));
  
  Logger.log(`[getFullTimetable] Returning ${result.length} timetable entries`);
  
  return result;
}

/**
 * Get filtered timetable based on class, subject, teacher, or date
 * Returns structured format grouped by day and period
 * Sheet columns: class, dayOfWeek, period, subject, teacherEmail, teacherName
 */
function getFullTimetableFiltered(cls, subject, teacher, date) {
  const sh = _getSheet('Timetable');
  const headers = _headers(sh);
  let timetable = _rows(sh).map(r => _indexByHeader(r, headers));
  
  Logger.log(`[getFullTimetableFiltered] Total entries before filtering: ${timetable.length}`);
  Logger.log(`[getFullTimetableFiltered] Filters - class: ${cls}, subject: ${subject}, teacher: ${teacher}, date: ${date}`);
  
  // Apply filters
  if (cls && cls !== '') {
    timetable = timetable.filter(entry => 
      String(entry.class || '').toLowerCase() === String(cls).toLowerCase()
    );
    Logger.log(`[getFullTimetableFiltered] After class filter: ${timetable.length}`);
  }
  
  if (subject && subject !== '') {
    timetable = timetable.filter(entry => 
      String(entry.subject || '').toLowerCase().includes(String(subject).toLowerCase())
    );
    Logger.log(`[getFullTimetableFiltered] After subject filter: ${timetable.length}`);
  }
  
  if (teacher && teacher !== '') {
    const teacherLower = String(teacher).toLowerCase();
    timetable = timetable.filter(entry => 
      String(entry.teacherEmail || '').toLowerCase().includes(teacherLower) ||
      String(entry.teacherName || '').toLowerCase().includes(teacherLower)
    );
    Logger.log(`[getFullTimetableFiltered] After teacher filter: ${timetable.length}`);
  }
  
  if (date && date !== '') {
    const dayName = _dayName(date);
    timetable = timetable.filter(entry => 
      _normalizeDayName(entry.dayOfWeek) === _normalizeDayName(dayName)
    );
    Logger.log(`[getFullTimetableFiltered] After date filter: ${timetable.length}`);
  }
  
  // Group by day and period
  const dayMap = {};
  
  timetable.forEach(entry => {
    // Use exact column name from sheet: dayOfWeek
    const day = entry.dayOfWeek || 'Unknown';
    const period = parseInt(entry.period) || 0;
    
    if (!dayMap[day]) {
      dayMap[day] = {};
    }
    
    if (!dayMap[day][period]) {
      dayMap[day][period] = [];
    }
    
    dayMap[day][period].push({
      class: entry.class || '',
      subject: entry.subject || '',
      teacher: entry.teacherName || '',
      teacherEmail: entry.teacherEmail || ''
    });
  });
  
  Logger.log(`[getFullTimetableFiltered] Days after grouping: ${Object.keys(dayMap).join(', ')}`);
  
  // Convert to array format expected by frontend
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const result = [];
  
  daysOrder.forEach(day => {
    if (dayMap[day]) {
      const periods = [];
      const periodNumbers = Object.keys(dayMap[day]).map(p => parseInt(p)).sort((a, b) => a - b);
      
      periodNumbers.forEach(periodNum => {
        periods.push({
          period: periodNum,
          entries: dayMap[day][periodNum]
        });
      });
      
      result.push({
        day: day,
        periods: periods
      });
    }
  });
  
  Logger.log(`[getFullTimetableFiltered] Returning ${result.length} days with structured periods`);
  
  return result;
}