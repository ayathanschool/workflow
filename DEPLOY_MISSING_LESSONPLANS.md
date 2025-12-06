# Deploy Missing Lesson Plan Notification System

## Backend Deployment (Google Apps Script)

### Step 1: Add API Routes (in doGet function)
Find the line with `// Daily readiness summary for HM (GET-friendly)` around line 377-381, and add these routes after it:

```javascript
// === MISSING LESSON PLAN NOTIFICATIONS ===
if (action === 'getMissingLessonPlans') {
  const teacherEmail = e.parameter.teacherEmail || '';
  const daysAhead = parseInt(e.parameter.daysAhead || 7);
  return _respond(getMissingLessonPlans(teacherEmail, daysAhead));
}

if (action === 'getAllMissingLessonPlans') {
  const daysAhead = parseInt(e.parameter.daysAhead || 7);
  return _respond(getAllMissingLessonPlans(daysAhead));
}
```

### Step 2: Add Backend Functions (at the end of MainApp.gs)
Go to the very end of MainApp.gs file (after line 5593) and add these two functions:

```javascript
/**
 * Get missing lesson plans for a specific teacher
 * Compares teacher's timetable against existing lesson plans for upcoming periods
 * @param {string} teacherEmail - Teacher's email
 * @param {number} daysAhead - Number of days to look ahead (default: 7)
 * @returns {Object} - List of periods without lesson plans
 */
function getMissingLessonPlans(teacherEmail, daysAhead = 7) {
  try {
    Logger.log(`Getting missing lesson plans for ${teacherEmail}, ${daysAhead} days ahead`);
    
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
    
    // Get date range (today to daysAhead days from now)
    const today = new Date();
    const startDate = _todayISO();
    const endDate = new Date(today.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    const endDateISO = _isoDateIST(endDate);
    
    Logger.log(`Date range: ${startDate} to ${endDateISO}`);
    
    // Get existing lesson plans
    const lessonPlansSheet = _getSheet('LessonPlans');
    const lessonPlansHeaders = _headers(lessonPlansSheet);
    const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
    
    // Get substitutions to exclude substituted periods
    const substitutionsSheet = _getSheet('Substitutions');
    const substitutionsHeaders = _headers(substitutionsSheet);
    const substitutions = _rows(substitutionsSheet).map(row => _indexByHeader(row, substitutionsHeaders));
    
    // Get holidays from Academic Calendar
    const calendarSheet = _getSheet('AcademicCalendar');
    const calendarHeaders = _headers(calendarSheet);
    const calendarData = _rows(calendarSheet).map(row => _indexByHeader(row, calendarHeaders));
    
    const holidays = calendarData
      .filter(row => String(row.type || '').toLowerCase() === 'holiday')
      .map(row => _isoDateIST(row.date));
    
    // Generate list of school days in range
    const schoolDays = [];
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDateISO);
    
    while (currentDate <= endDateObj) {
      const dayName = _dayNameIST(currentDate);
      const dateISO = _isoDateIST(currentDate);
      
      // Skip weekends and holidays
      if (dayName !== 'Saturday' && dayName !== 'Sunday' && !holidays.includes(dateISO)) {
        schoolDays.push({ date: dateISO, dayName: dayName });
      }
      
      currentDate = new Date(currentDate.getTime() + (24 * 60 * 60 * 1000));
    }
    
    // Find missing lesson plans
    const missing = [];
    
    schoolDays.forEach(day => {
      // Get periods for this teacher on this day
      const dayPeriods = teacherTimetable.filter(slot =>
        String(slot.day || '').toLowerCase() === day.dayName.toLowerCase()
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
    Logger.log(`ERROR in getMissingLessonPlans: ${error.message}\n${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all missing lesson plans across all teachers (for HM dashboard)
 * @param {number} daysAhead - Number of days to look ahead (default: 7)
 * @returns {Object} - Missing lesson plans grouped by teacher
 */
function getAllMissingLessonPlans(daysAhead = 7) {
  try {
    Logger.log(`Getting all missing lesson plans, ${daysAhead} days ahead`);
    
    // Get all teachers
    const usersSheet = _getSheet('Users');
    const usersHeaders = _headers(usersSheet);
    const users = _rows(usersSheet).map(row => _indexByHeader(row, usersHeaders));
    
    const teachers = users.filter(user => {
      const roles = String(user.role || '').toLowerCase();
      return roles.includes('teacher') || roles.includes('class teacher');
    });
    
    Logger.log(`Found ${teachers.length} teachers`);
    
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
    Logger.log(`ERROR in getAllMissingLessonPlans: ${error.message}\n${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Step 3: Deploy
1. Click **Deploy** → **Manage deployments**
2. Click ⚙️ (gear icon) next to your active deployment
3. Select **New version**
4. Click **Deploy**

---

## Testing

### Test Teacher View:
1. Login as any teacher (e.g., shilpa@ayathanschool.com)
2. Check dashboard - banner will show if there are missing lesson plans for next 7 days
3. Banner shows urgency: Critical (≤1 day), High (2-3 days), Medium (4-5 days), Low (6-7 days)

### Test HM View:
1. Login as HM
2. Dashboard shows system-wide overview
3. Filter by urgency: All / Critical / High Priority
4. Expand per teacher to see details

---

## Frontend (Already Deployed)
✅ Frontend pushed to GitHub
✅ Vercel auto-deployment triggered
✅ Changes live at: https://yourapp.vercel.app

---

## Files Modified:
- `Appscript/MainApp.gs` - Added getMissingLessonPlans and getAllMissingLessonPlans functions
- `frontend/src/api.js` - Added API bindings
- `frontend/src/App.jsx` - Integrated notification components
- `frontend/src/components/MissingLessonPlansAlert.jsx` - Teacher banner (NEW)
- `frontend/src/components/HMMissingLessonPlansOverview.jsx` - HM overview (NEW)
