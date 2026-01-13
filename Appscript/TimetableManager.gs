/**
 * ====== TIMETABLE MANAGEMENT SYSTEM ======
 * This file handles all timetable and schedule functions
 * Think of this as your "Schedule Department"
 */

/**
 * Get a teacher's weekly timetable (7 days starting from today)
 */
function getTeacherWeeklyTimetable(identifier) {
  // Cache with LONG TTL - timetable structure rarely changes
  return getCachedData('teacher_weekly_' + String(identifier).toLowerCase(), function() {
    return _fetchTeacherWeeklyTimetable(identifier);
  }, CACHE_TTL.LONG);
}

function _fetchTeacherWeeklyTimetable(identifier) {
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
  
  // Get timetable data (request-scoped cache)
  const list = _getCachedSheetData('Timetable').data
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
  // Cache with SHORT TTL - includes substitutions which can change during the day
  const normalizedDate = _isoDateString(date);
  const cacheKey = 'teacher_daily_' + String(identifier).toLowerCase() + '_' + normalizedDate;
  return getCachedData(cacheKey, function() {
    return _fetchTeacherDailyTimetable(identifier, date);
  }, CACHE_TTL.SHORT);
}

function _fetchTeacherDailyTimetable(identifier, date) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);
  const idLower = identifier.toLowerCase();
  
  try { appLog('DEBUG', `[getTeacherDailyTimetable] Getting timetable for ${idLower} on ${normalizedDate}`); } catch (e) {}
  
  // Get regular timetable for this teacher (request-scoped cache)
  const regularPeriods = _getCachedSheetData('Timetable').data
    .filter(r => {
      const te = String(r.teacherEmail || '').toLowerCase();
      const tn = String(r.teacherName || '').toLowerCase();
      return (te === idLower || tn === idLower) && 
             _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName);
    });
  
  try { appLog('DEBUG', `[getTeacherDailyTimetable] Found ${regularPeriods.length} regular periods`); } catch (e) {}
  
  // Get substitutions for this date (request-scoped cache)
  const allSubstitutions = _getCachedSheetData('Substitutions').data
    .filter(r => _isoDateString(r.date) === normalizedDate);
  
  try { appLog('DEBUG', `[getTeacherDailyTimetable] Found ${allSubstitutions.length} substitutions for date`); } catch (e) {}
  
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
      try { appLog('DEBUG', `[getTeacherDailyTimetable] Excluding period ${period.period} ${period.class} - teacher is absent`); } catch (e) {}
    }
  });
  
  // Add substitution periods where this teacher is the substitute
  allSubstitutions.forEach(sub => {
    if (String(sub.substituteTeacher || '').toLowerCase() === idLower) {
      try { appLog('DEBUG', `[getTeacherDailyTimetable] Adding substitution period ${sub.period} ${sub.class}`); } catch (e) {}
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
  
  // Enrich with session progress (chapter name and session number)
  try {
    const allSessionProgress = _getCachedSheetData('SessionProgress').data;

    // Build a single-pass index of latest progress per class+subject.
    const latestByKey = new Map();
    const toKey = (cls, subj) => `${String(cls || '').trim().toLowerCase()}|${String(subj || '').trim().toLowerCase()}`;

    allSessionProgress.forEach(sp => {
      const key = toKey(sp.class, sp.subject);
      if (key === '|') return;
      const d = new Date(sp.sessionDate || 0);
      const t = isNaN(d.getTime()) ? 0 : d.getTime();
      const prev = latestByKey.get(key);
      if (!prev || t >= prev._t) {
        latestByKey.set(key, { _t: t, chapterName: sp.chapterName || '', sessionNumber: sp.sessionNumber || '' });
      }
    });

    finalPeriods.forEach(period => {
      const key = toKey(period.class, period.subject);
      const latest = latestByKey.get(key);
      if (latest) {
        period.chapterName = latest.chapterName || '';
        period.sessionNumber = latest.sessionNumber || '';
      }
    });
  } catch (error) {
    try { appLog('WARN', `[getTeacherDailyTimetable] Could not enrich with session progress`, { error: error && error.message ? error.message : String(error) }); } catch (e) {}
  }
  
  try { appLog('DEBUG', `[getTeacherDailyTimetable] Returning ${finalPeriods.length} periods (${allSubstitutions.filter(s => String(s.substituteTeacher || '').toLowerCase() === idLower).length} substitutions)`); } catch (e) {}
  
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
  
  // PERFORMANCE: Cache with SHORT TTL - substitutions change during the day
  const cacheKey = 'daily_timetable_' + normalizedDate;
  return getCachedData(cacheKey, function() {
    return _fetchDailyTimetableWithSubstitutions(normalizedDate);
  }, CACHE_TTL.SHORT);
}

function _fetchDailyTimetableWithSubstitutions(normalizedDate) {
  const dayName = _dayName(normalizedDate);
  
  try { appLog('DEBUG', `[getDailyTimetableWithSubstitutions] Date: ${normalizedDate}, DayName: ${dayName}`); } catch (e) {}
  
  // Get regular timetable (request-scoped cache)
  const timetableEntries = _getCachedSheetData('Timetable').data
    .filter(r => _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName));
  
  try { appLog('DEBUG', `[getDailyTimetableWithSubstitutions] Found ${timetableEntries.length} timetable entries for ${dayName}`); } catch (e) {}
  
  // Get substitutions for this date (request-scoped cache)
  const substitutions = _getCachedSheetData('Substitutions').data
    .filter(r => _isoDateString(r.date) === normalizedDate);
  
  try { appLog('DEBUG', `[getDailyTimetableWithSubstitutions] Found ${substitutions.length} substitutions for ${normalizedDate}`); } catch (e) {}
  if (substitutions.length > 0) {
    try { appLog('DEBUG', `[getDailyTimetableWithSubstitutions] Sample substitution`, substitutions[0]); } catch (e) {}
  }
  
  // Build substitution index for O(n+m) apply
  const subIndex = new Map();
  const subKey = (p, cls, absent) => `${String(p || '').trim()}|${String(cls || '').trim().toLowerCase()}|${String(absent || '').trim().toLowerCase()}`;
  substitutions.forEach(sub => {
    const key = subKey(sub.period, sub.class, sub.absentTeacher);
    if (!subIndex.has(key)) subIndex.set(key, sub);
  });

  // Apply substitutions
  const finalTimetable = timetableEntries.map(entry => {
    const key = subKey(entry.period, entry.class, entry.teacherEmail);
    const substitution = subIndex.get(key);
    
    if (substitution) {
      try { appLog('DEBUG', `[Substitution] Applying substitution`, { period: entry.period, class: entry.class, from: entry.teacherEmail, to: substitution.substituteTeacher }); } catch (e) {}
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
  
  try { appLog('DEBUG', `[getDailyTimetableWithSubstitutions] Returning ${finalTimetable.length} entries (${substitutions.length} with substitutions)`); } catch (e) {}
  
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
  const list = _getCachedSheetData('Timetable').data;
  
  const classes = [...new Set(list.map(r => r.class).filter(Boolean))];
  return classes.sort();
}

/**
 * Get timetable for a specific class and date
 */
function getClassTimetable(className, date) {
  const normalizedDate = _isoDateString(date);
  const dayName = _dayName(normalizedDate);

  const list = _getCachedSheetData('Timetable').data
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

  try { appLog('DEBUG', `[getAssignedSubstitutionsForDate]`, { date: normalizedDate }); } catch (e) {}

  const substitutions = _getCachedSheetData('Substitutions').data
    .filter(r => _isoDateString(r.date) === normalizedDate);

  try { appLog('DEBUG', `[getAssignedSubstitutionsForDate] Found`, { count: substitutions.length }); } catch (e) {}
  
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

  try { appLog('DEBUG', `[getAvailableTeachers] Start`, { date: normalizedDate, day: dayName, period: String(period || '') }); } catch (e) {}

  // Get all teachers from Users sheet (request-scoped cache)
  const allUsers = _getCachedSheetData('Users').data;
  
  let allTeachers = allUsers.filter(u => {
    const roles = String(u.roles || '').toLowerCase();
    const hasTeacherRole = roles.includes('teacher') || roles.includes('class teacher');
    return hasTeacherRole;
  });

  try { appLog('DEBUG', `[getAvailableTeachers] Teachers from Users`, { count: allTeachers.length }); } catch (e) {}
  
  // FALLBACK: If no teachers found in Users sheet, extract from Timetable
  if (allTeachers.length === 0) {
    try { appLog('WARN', `[getAvailableTeachers] No teachers in Users; fallback to Timetable`); } catch (e) {}
    const timetableRows = _getCachedSheetData('Timetable').data;
    
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
    try { appLog('DEBUG', `[getAvailableTeachers] Teachers from Timetable fallback`, { count: allTeachers.length }); } catch (e) {}
  }

  // Get timetable entries for this day and period (request-scoped cache)
  const allTimetableRows = _getCachedSheetData('Timetable').data;
  
  const busyTeacherRows = allTimetableRows.filter(r => 
    _normalizeDayName(r.dayOfWeek) === _normalizeDayName(dayName) &&
    String(r.period) === String(period)
  );

  try { appLog('DEBUG', `[getAvailableTeachers] Busy rows`, { count: busyTeacherRows.length }); } catch (e) {}
  
  const busyTeachers = busyTeacherRows.map(r => String(r.teacherEmail || '').toLowerCase());

  // If a substitution exists for this date/period, the absent teacher should be considered free
  // (their timetable slot is being covered by someone else).
  const absentTeachersForThisSlot = _getCachedSheetData('Substitutions').data
    .filter(r =>
      _isoDateString(r.date) === normalizedDate &&
      String(r.period) === String(period)
    )
    .map(r => String(r.absentTeacher || '').toLowerCase().trim())
    .filter(Boolean);

  const absentTeacherSet = new Set(absentTeachersForThisSlot);
  const effectiveBusyTeachers = busyTeachers.filter(t => !absentTeacherSet.has(String(t || '').toLowerCase()));

  try {
    appLog('DEBUG', `[getAvailableTeachers] Freed absent teachers`, {
      count: absentTeacherSet.size,
      freed: Array.from(absentTeacherSet).slice(0, 5)
    });
  } catch (e) {}
  
  // Get teachers already assigned as substitutes for this date/period
  const assignedSubstitutes = _getCachedSheetData('Substitutions').data
    .filter(r => 
      _isoDateString(r.date) === normalizedDate &&
      String(r.period) === String(period)
    )
    .map(r => String(r.substituteTeacher || '').toLowerCase());

  try { appLog('DEBUG', `[getAvailableTeachers] Assigned substitutes`, { count: assignedSubstitutes.length }); } catch (e) {}
  
  // Filter available teachers (not busy and not already assigned)
  const availableTeachers = allTeachers.filter(teacher => {
    const teacherEmail = String(teacher.email || '').toLowerCase();
    const isBusy = effectiveBusyTeachers.includes(teacherEmail);
    const isAssigned = assignedSubstitutes.includes(teacherEmail);

    return !isBusy && !isAssigned;
  });

  try { appLog('DEBUG', `[getAvailableTeachers] End`, { available: availableTeachers.length }); } catch (e) {}
  
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
  // Use cached timetable data (15 minute TTL - rarely changes)
  return getCachedData('timetable_full', function() {
    return _fetchFullTimetable();
  }, CACHE_TTL.LONG);
}

function _fetchFullTimetable() {
  const timetable = _getCachedSheetData('Timetable').data;
  try { appLog('DEBUG', `[getFullTimetable]`, { count: timetable.length }); } catch (e) {}
  
  // Return flat array for frontend exam subject loading
  const result = timetable.map(entry => ({
    class: entry.class || '',
    subject: entry.subject || '',
    teacher: entry.teacherName || '',
    teacherEmail: entry.teacherEmail || '',
    dayOfWeek: entry.dayOfWeek || '',
    period: entry.period || ''
  }));
  
  try { appLog('DEBUG', `[getFullTimetable] Returning`, { count: result.length }); } catch (e) {}
  
  return result;
}

/**
 * Get filtered timetable based on class, subject, teacher, or date
 * Returns structured format grouped by day and period
 * Sheet columns: class, dayOfWeek, period, subject, teacherEmail, teacherName
 */
function getFullTimetableFiltered(cls, subject, teacher, date) {
  let timetable = _getCachedSheetData('Timetable').data;
  try { appLog('DEBUG', `[getFullTimetableFiltered] Start`, { count: timetable.length, class: cls, subject: subject, teacher: teacher, date: date }); } catch (e) {}
  
  // Apply filters
  if (cls && cls !== '') {
    timetable = timetable.filter(entry => 
      String(entry.class || '').toLowerCase() === String(cls).toLowerCase()
    );
    try { appLog('DEBUG', `[getFullTimetableFiltered] After class filter`, { count: timetable.length }); } catch (e) {}
  }
  
  if (subject && subject !== '') {
    timetable = timetable.filter(entry => 
      String(entry.subject || '').toLowerCase().includes(String(subject).toLowerCase())
    );
    try { appLog('DEBUG', `[getFullTimetableFiltered] After subject filter`, { count: timetable.length }); } catch (e) {}
  }
  
  if (teacher && teacher !== '') {
    const teacherLower = String(teacher).toLowerCase();
    timetable = timetable.filter(entry => 
      String(entry.teacherEmail || '').toLowerCase().includes(teacherLower) ||
      String(entry.teacherName || '').toLowerCase().includes(teacherLower)
    );
    try { appLog('DEBUG', `[getFullTimetableFiltered] After teacher filter`, { count: timetable.length }); } catch (e) {}
  }
  
  if (date && date !== '') {
    const dayName = _dayName(date);
    timetable = timetable.filter(entry => 
      _normalizeDayName(entry.dayOfWeek) === _normalizeDayName(dayName)
    );
    try { appLog('DEBUG', `[getFullTimetableFiltered] After date filter`, { count: timetable.length }); } catch (e) {}
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
  
  try { appLog('DEBUG', `[getFullTimetableFiltered] Days`, { days: Object.keys(dayMap) }); } catch (e) {}
  
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
  
  try { appLog('DEBUG', `[getFullTimetableFiltered] Returning`, { days: result.length }); } catch (e) {}
  
  return result;
}