# Exact Code Snippets for Apps Script Integration - Part 3

## 🔧 **FILE 3: MainApp.gs** (MODIFY EXISTING FILE)

### **ADD TO doGet() function:**
Find your existing `doGet()` function and its switch statement. Add these 2 new cases:

```javascript
// ADD these 2 cases to your existing switch statement in doGet()
case 'getApprovedSchemesForLessonPlanning':
  return _handleGetApprovedSchemesForLessonPlanning(e.parameter);
case 'getAvailablePeriodsForLessonPlan':
  return _handleGetAvailablePeriodsForLessonPlan(e.parameter);
```

### **ADD TO doPost() function:**
Find your existing `doPost()` function and its switch statement. Add this 1 new case:

```javascript
// ADD this case to your existing switch statement in doPost()
case 'createSchemeLessonPlan':
  return _handleCreateSchemeLessonPlan(data);
```

### **ADD these 3 handler functions at the END of your MainApp.gs file:**

```javascript
/**
 * Handle GET approved schemes for lesson planning
 */
function _handleGetApprovedSchemesForLessonPlanning(params) {
  try {
    const teacherEmail = params.teacherEmail;
    
    if (!teacherEmail) {
      return _createResponse({ success: false, error: 'Teacher email is required' });
    }
    
    const result = getApprovedSchemesForLessonPlanning(teacherEmail);
    return _createResponse(result);
  } catch (error) {
    Logger.log(`Error handling approved schemes for lesson planning: ${error.message}`);
    return _createResponse({ success: false, error: error.message });
  }
}

/**
 * Handle GET available periods for lesson plan
 */
function _handleGetAvailablePeriodsForLessonPlan(params) {
  try {
    const teacherEmail = params.teacherEmail;
    const startDate = params.startDate;
    const endDate = params.endDate;
    const excludeExisting = params.excludeExisting !== 'false';
    
    if (!teacherEmail || !startDate || !endDate) {
      return _createResponse({ 
        success: false, 
        error: 'Teacher email, start date, and end date are required' 
      });
    }
    
    const result = getAvailablePeriodsForLessonPlan(teacherEmail, startDate, endDate, excludeExisting);
    return _createResponse(result);
  } catch (error) {
    Logger.log(`Error handling available periods for lesson plan: ${error.message}`);
    return _createResponse({ success: false, error: error.message });
  }
}

/**
 * Handle POST create scheme lesson plan
 */
function _handleCreateSchemeLessonPlan(data) {
  try {
    const result = createSchemeLessonPlan(data.lessonPlanData);
    return _createResponse(result);
  } catch (error) {
    Logger.log(`Error handling create scheme lesson plan: ${error.message}`);
    return _createResponse({ success: false, error: error.message });
  }
}

/**
 * Test function for scheme-based lesson planning
 */
function testSchemeLessonPlanningAPI() {
  try {
    Logger.log('Testing Scheme-Based Lesson Planning API...');
    
    const teachersResult = getAllTeachers();
    Logger.log(`Teachers found: ${teachersResult.length}`);
    
    if (teachersResult.length > 0) {
      const testTeacher = teachersResult[0].email;
      Logger.log(`Testing with teacher: ${testTeacher}`);
      
      const schemesResult = getApprovedSchemesForLessonPlanning(testTeacher);
      Logger.log(`Schemes Result: ${JSON.stringify(schemesResult)}`);
      
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const periodsResult = getAvailablePeriodsForLessonPlan(testTeacher, startDate, endDate);
      Logger.log(`Periods Result: ${JSON.stringify(periodsResult)}`);
    }
    
    Logger.log('Test completed successfully');
  } catch (error) {
    Logger.log(`Error in test: ${error.message}`);
  }
}
```

---

## 🔧 **FILE 4: SheetHelpers.gs** (MODIFY EXISTING FILE)

### **ADD this enhanced function at the END of your SheetHelpers.gs file:**

```javascript
/**
 * Enhanced daily report submission with automatic lesson progress tracking
 */
function submitDailyReportWithProgressTracking(reportData) {
  try {
    Logger.log(`Submitting daily report with progress tracking: ${JSON.stringify(reportData)}`);
    
    // Validate required fields
    const requiredFields = ['teacherEmail', 'date', 'class', 'subject'];
    for (let field of requiredFields) {
      if (!reportData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Get DailyReports sheet
    const sheet = _getSheet('DailyReports');
    const headers = _headers(sheet);
    
    // Ensure required columns exist
    const requiredHeaders = [
      'id', 'teacherEmail', 'teacherName', 'date', 'class', 'subject',
      'topicsCovered', 'studentsPresent', 'studentsAbsent', 'remarks',
      'submittedAt', 'lessonProgressTracked'
    ];
    _ensureHeaders(sheet, requiredHeaders);
    
    // Generate report ID and timestamp
    const reportId = _generateId('DR_');
    const timestamp = new Date().toISOString();
    
    // Prepare row data
    const rowData = [
      reportId,
      reportData.teacherEmail || '',
      reportData.teacherName || '',
      _dateToISO(reportData.date),
      reportData.class || '',
      reportData.subject || '',
      reportData.topicsCovered || '',
      reportData.studentsPresent || 0,
      reportData.studentsAbsent || 0,
      reportData.remarks || '',
      timestamp,
      'pending' // Will be updated after progress tracking
    ];
    
    // Append the row
    sheet.appendRow(rowData);
    
    // Track lesson progress automatically
    const progressData = Object.assign({}, reportData, { id: reportId });
    const progressResult = _trackLessonProgress(progressData, timestamp);
    
    // Update lesson progress tracking status
    const rowIndex = _findRowIndex(sheet, 'id', reportId);
    if (rowIndex > 0) {
      _updateCell(sheet, rowIndex, 'lessonProgressTracked', 
        progressResult.success ? 'completed' : 'failed');
    }
    
    Logger.log(`Daily report submitted successfully: ${reportId}`);
    
    return {
      success: true,
      reportId: reportId,
      message: 'Daily report submitted successfully',
      progressTracked: progressResult.success
    };
  } catch (error) {
    Logger.log(`Error submitting daily report with progress tracking: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get lesson progress data for dashboard
 */
function getLessonProgressForDashboard(teacherEmail, days = 30) {
  try {
    // Get recent reports
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const reportsResult = getDailyReports(teacherEmail, startDate, endDate);
    if (!reportsResult.success) {
      return reportsResult;
    }
    
    // Get lesson progress summary
    const progressResult = getLessonProgressSummary(teacherEmail);
    if (!progressResult.success) {
      return progressResult;
    }
    
    return {
      success: true,
      dashboard: {
        recentReports: reportsResult.reports.slice(0, 10), // Last 10 reports
        progressSummary: progressResult.summary,
        progressDetails: progressResult.details.slice(0, 15), // Top 15 progress items
        teacherStats: progressResult.teacherStats
      }
    };
  } catch (error) {
    Logger.log(`Error getting lesson progress for dashboard: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to ensure headers exist in a sheet
 */
function _ensureHeaders(sheet, requiredHeaders) {
  const existingHeaders = _headers(sheet);
  
  if (existingHeaders.length === 0) {
    // Sheet is empty, add all headers
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  
  // Check for missing headers and add them
  let lastColumn = sheet.getLastColumn();
  requiredHeaders.forEach(header => {
    if (!existingHeaders.includes(header)) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(header);
    }
  });
}

/**
 * Generate unique ID
 */
function _generateId(prefix = '') {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}${timestamp}_${random}`;
}

/**
 * Convert date to ISO string
 */
function _dateToISO(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

/**
 * Find row index by matching criteria
 */
function _findRowIndex(sheet, searchColumn, searchValue, headers = null) {
  const data = _rows(sheet);
  const headerRow = headers || _headers(sheet);
  const columnIndex = headerRow.indexOf(searchColumn);
  
  if (columnIndex === -1) {
    throw new Error(`Column '${searchColumn}' not found`);
  }
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][columnIndex] === searchValue) {
      return i + 2; // +2 because array is 0-indexed and sheet has header row
    }
  }
  
  return -1; // Not found
}

/**
 * Update a specific cell value by row and column name
 */
function _updateCell(sheet, rowIndex, columnName, value, headers = null) {
  const headerRow = headers || _headers(sheet);
  const columnIndex = headerRow.indexOf(columnName);
  
  if (columnIndex === -1) {
    throw new Error(`Column '${columnName}' not found`);
  }
  
  sheet.getRange(rowIndex, columnIndex + 1).setValue(value);
}
```

---

## ✅ **Summary - What to Add Where:**

### **NEW FILES (Create these 2 files):**
1. **LessonProgressManager.gs** - Copy entire content from Part 1
2. **SchemeLessonManager.gs** - Copy entire content from Part 2

### **EXISTING FILES (Modify these 2 files):**
3. **MainApp.gs** - Add 3 cases to switch statements + 4 functions at end
4. **SheetHelpers.gs** - Add 6 helper functions at end

### **SAFETY NOTES:**
- ✅ **Only ADD code, never replace existing functions**
- ✅ **Add cases to switch statements, don't replace the switch**
- ✅ **Add functions at END of files**
- ✅ **Keep all existing functionality intact**

After implementing these changes, run the test function `testSchemeLessonPlanningAPI()` in Apps Script to verify everything works correctly!

🚀 **Ready for implementation!**