# Exact Code Snippets for Apps Script Integration - Part 2

## 📁 **FILE 2: SchemeLessonManager.gs** (CREATE NEW FILE)

```javascript
/**
 * SchemeLessonManager.gs
 * Manages scheme-based lesson plan preparation
 * Implements reverse flow: Schemes → Chapters → Sessions → Select Period
 */

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
            (plan.chapter || '').toLowerCase() === chapter.name.toLowerCase() &&
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
    
    return {
      success: true,
      schemes: schemesWithProgress,
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
 */
function getAvailablePeriodsForLessonPlan(teacherEmail, startDate, endDate, excludeExistingPlans = true) {
  try {
    Logger.log(`Getting available periods for ${teacherEmail} from ${startDate} to ${endDate}`);
    
    // Get teacher's timetable
    const timetableSheet = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSheet);
    const timetableData = _rows(timetableSheet).map(row => _indexByHeader(row, timetableHeaders));
    
    const teacherTimetable = timetableData.filter(slot =>
      (slot.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );
    
    // Get existing lesson plans to check occupied slots
    let occupiedSlots = [];
    if (excludeExistingPlans) {
      const lessonPlansSheet = _getSheet('LessonPlans');
      const lessonPlansHeaders = _headers(lessonPlansSheet);
      const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
      
      occupiedSlots = existingPlans.filter(plan =>
        (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
        plan.selectedDate && plan.selectedPeriod
      ).map(plan => ({
        date: plan.selectedDate,
        period: plan.selectedPeriod,
        class: plan.class,
        subject: plan.subject
      }));
    }
    
    // Generate available slots within date range
    const availableSlots = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dateString = date.toISOString().split('T')[0];
      
      // Skip weekends (assuming school runs Monday-Friday)
      if (dayName === 'Saturday' || dayName === 'Sunday') continue;
      
      // Find periods for this day
      const dayPeriods = teacherTimetable.filter(slot =>
        (slot.day || '').toLowerCase() === dayName.toLowerCase()
      );
      
      dayPeriods.forEach(period => {
        const slotKey = `${dateString}_${period.period}`;
        const isOccupied = occupiedSlots.some(occupied =>
          occupied.date === dateString && occupied.period === period.period
        );
        
        availableSlots.push({
          date: dateString,
          dayName: dayName,
          period: period.period,
          startTime: period.startTime,
          endTime: period.endTime,
          class: period.class,
          subject: period.subject,
          isAvailable: !isOccupied,
          isOccupied: isOccupied,
          occupiedBy: isOccupied ? occupiedSlots.find(o => o.date === dateString && o.period === period.period) : null
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
      }
    };
  } catch (error) {
    Logger.log(`Error getting available periods: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Create lesson plan for specific scheme chapter session
 */
function createSchemeLessonPlan(lessonPlanData) {
  try {
    Logger.log(`Creating scheme-based lesson plan: ${JSON.stringify(lessonPlanData)}`);
    
    // Validate required fields
    const requiredFields = ['schemeId', 'chapter', 'session', 'teacherEmail', 'selectedDate', 'selectedPeriod'];
    for (let field of requiredFields) {
      if (!lessonPlanData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Check for duplicates
    const duplicateCheck = _checkForDuplicateLessonPlan(
      lessonPlanData.schemeId,
      lessonPlanData.chapter,
      lessonPlanData.session,
      lessonPlanData.teacherEmail
    );
    
    if (!duplicateCheck.success) {
      return duplicateCheck;
    }
    
    // Validate period availability
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
    
    // Ensure required columns exist
    const requiredHeaders = [
      'lpId', 'schemeId', 'teacherEmail', 'teacherName', 'class', 'subject',
      'chapter', 'session', 'selectedDate', 'selectedPeriod',
      'learningObjectives', 'teachingMethods', 'resourcesRequired', 'assessmentMethods',
      'status', 'createdAt', 'submittedAt', 'isDuplicate', 'lessonType'
    ];
    _ensureHeaders(lessonPlansSheet, requiredHeaders);
    
    // Generate lesson plan ID
    const lpId = _generateId('LP_');
    const timestamp = new Date().toISOString();
    
    // Get scheme details for class/subject
    const schemeDetails = _getSchemeDetails(lessonPlanData.schemeId);
    
    // Prepare row data
    const rowData = [
      lpId,
      lessonPlanData.schemeId,
      lessonPlanData.teacherEmail,
      lessonPlanData.teacherName || '',
      schemeDetails.class || lessonPlanData.class || '',
      schemeDetails.subject || lessonPlanData.subject || '',
      lessonPlanData.chapter,
      lessonPlanData.session,
      lessonPlanData.selectedDate,
      lessonPlanData.selectedPeriod,
      lessonPlanData.learningObjectives || '',
      lessonPlanData.teachingMethods || '',
      lessonPlanData.resourcesRequired || '',
      lessonPlanData.assessmentMethods || '',
      lessonPlanData.status || 'draft',
      timestamp,
      lessonPlanData.status === 'submitted' ? timestamp : '',
      false, // isDuplicate
      'scheme-based' // lessonType
    ];
    
    // Append the row
    lessonPlansSheet.appendRow(rowData);
    
    Logger.log(`Scheme-based lesson plan created successfully: ${lpId}`);
    
    return {
      success: true,
      lessonPlanId: lpId,
      message: 'Lesson plan created successfully',
      data: {
        lpId: lpId,
        schemeId: lessonPlanData.schemeId,
        chapter: lessonPlanData.chapter,
        session: lessonPlanData.session,
        selectedDate: lessonPlanData.selectedDate,
        selectedPeriod: lessonPlanData.selectedPeriod
      }
    };
  } catch (error) {
    Logger.log(`Error creating scheme lesson plan: ${error.message}`);
    return { success: false, error: error.message };
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
    
    // If no chapters found, create default structure
    if (chapters.length === 0) {
      const subject = (scheme.subject || '').toLowerCase();
      const defaultChapterCount = subject.includes('math') ? 8 : subject.includes('science') ? 10 : 6;
      
      for (let i = 1; i <= defaultChapterCount; i++) {
        chapters.push({
          number: i,
          name: `Chapter ${i}`,
          description: `Chapter ${i} from ${scheme.subject || 'Subject'}`
        });
      }
    }
    
    return chapters;
  } catch (error) {
    Logger.log(`Error parsing scheme chapters: ${error.message}`);
    return [{ number: 1, name: 'Chapter 1', description: 'Default Chapter' }];
  }
}

/**
 * Generate sessions for a chapter
 */
function _generateSessionsForChapter(chapter, scheme) {
  try {
    // Calculate sessions based on chapter complexity
    const chapterName = chapter.name.toLowerCase();
    let sessionCount = 2; // Default
    
    // Increase sessions for complex topics
    if (chapterName.includes('algebra') || chapterName.includes('geometry') || 
        chapterName.includes('physics') || chapterName.includes('chemistry')) {
      sessionCount = 4;
    } else if (chapterName.includes('practice') || chapterName.includes('revision')) {
      sessionCount = 2;
    } else if (chapterName.includes('introduction') || chapterName.includes('basics')) {
      sessionCount = 3;
    }
    
    const sessions = [];
    for (let i = 1; i <= sessionCount; i++) {
      let sessionName;
      if (sessionCount <= 2) {
        sessionName = i === 1 ? 'Introduction & Concepts' : 'Practice & Assessment';
      } else if (sessionCount === 3) {
        sessionName = i === 1 ? 'Introduction' : i === 2 ? 'Development' : 'Practice';
      } else {
        sessionName = i === 1 ? 'Introduction' : i === 2 ? 'Core Concepts' : 
                     i === 3 ? 'Applications' : 'Practice & Assessment';
      }
      
      sessions.push({
        sessionNumber: i,
        sessionName: sessionName,
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
 */
function _validatePeriodAvailability(teacherEmail, date, period) {
  try {
    // Check if teacher has this period in timetable
    const timetableSheet = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSheet);
    const timetableData = _rows(timetableSheet).map(row => _indexByHeader(row, timetableHeaders));
    
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    const timetableSlot = timetableData.find(slot =>
      (slot.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
      (slot.day || '').toLowerCase() === dayName.toLowerCase() &&
      slot.period === period
    );
    
    if (!timetableSlot) {
      return {
        success: false,
        error: `No timetable slot found for ${dayName} Period ${period}`
      };
    }
    
    // Check if slot is already occupied by another lesson plan
    const lessonPlansSheet = _getSheet('LessonPlans');
    const lessonPlansHeaders = _headers(lessonPlansSheet);
    const existingPlans = _rows(lessonPlansSheet).map(row => _indexByHeader(row, lessonPlansHeaders));
    
    const occupiedSlot = existingPlans.find(plan =>
      (plan.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase() &&
      plan.selectedDate === date &&
      plan.selectedPeriod === period
    );
    
    if (occupiedSlot) {
      return {
        success: false,
        error: `Period ${period} on ${date} is already occupied by another lesson plan`,
        occupiedBy: {
          lpId: occupiedSlot.lpId,
          chapter: occupiedSlot.chapter,
          session: occupiedSlot.session
        }
      };
    }
    
    return { success: true };
  } catch (error) {
    Logger.log(`Error validating period availability: ${error.message}`);
    return { success: true }; // Assume available if error
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
```

Copy this entire code block into a new file called **SchemeLessonManager.gs** in your Apps Script project.

---

Continue to Part 3 for the modifications to existing files...