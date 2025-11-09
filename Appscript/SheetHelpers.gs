/**
 * ====== SHEET HELPER FUNCTIONS ======
 * These are the basic tools for working with your Google Spreadsheet
 * Think of these like a toolbox that other parts of your system use
 */

/**
 * Get the main spreadsheet
 */
function _ss() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error(`Unable to open spreadsheet with ID ${SPREADSHEET_ID}: ${err && err.message ? err.message : err}`);
  }
}

/**
 * Get a specific sheet (tab) from the spreadsheet
 */
function _getSheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * Get the column headers from the first row of a sheet
 */
function _headers(sh) {
  const range = sh.getRange(1,1,1,sh.getLastColumn() || 1);
  const values = range.getValues()[0];
  return values.map(v => String(v||'').trim());
}

/**
 * Make sure a sheet has the correct column headers
 */
function _ensureHeaders(sh, cols) {
  const h = _headers(sh);
  if (h.filter(Boolean).length === 0) {
    sh.getRange(1,1,1,cols.length).setValues([cols]);
  }
}

/**
 * Get all the data rows from a sheet (excluding the header row)
 */
function _rows(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), 1);
  
  if (lastRow < 2) return [];
  
  const numRows = lastRow - 1;
  return sh.getRange(2, 1, numRows, lastCol).getValues();
}

/**
 * Convert a row of data into an object using column headers
 * Example: ['john@school.com', 'John'] becomes {email: 'john@school.com', name: 'John'}
 */
function _indexByHeader(row, headers) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

/**
 * Generate a unique ID for records
 */
function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function _todayISO() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Convert a date to ISO string format
 */
function _isoDateString(date) {
  if (!date) return '';
  
  if (typeof date === 'string') {
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // If it's an ISO 8601 string (e.g., "2025-11-05T02:45:00.000Z"), extract date part
    if (/^\d{4}-\d{2}-\d{2}T/.test(date)) {
      return date.split('T')[0];
    }
    
    // Try to parse other formats
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  } else if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else if (typeof date === 'object' && date !== null) {
    // Handle serialized Date objects from Google Sheets API
    // These come as objects with a string representation
    const dateStr = String(date);
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
      return dateStr.split('T')[0];
    }
  }
  
  return '';
}

/**
 * Get the day name from a date string
 */
function _dayName(isoDate) {
  try {
    const date = new Date(isoDate + 'T00:00:00');
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEEE');
  } catch (err) {
    console.error('Error getting day name for:', isoDate, err);
    return '';
  }
}

/**
 * Create a JSON response for web requests
 */
function _respond(obj, status) {
  const response = {
    status: status || 200,
    data: obj,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Parse POST request data
 */
function _parsePost(e) {
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
    return {};
  } catch (err) {
    console.error('Error parsing POST data:', err);
    return {};
  }
}

/**
 * Make sure all the required sheets exist with proper headers
 */
function _bootstrapSheets() {
  Object.keys(SHEETS).forEach(name => {
    const sh = _getSheet(name);
    _ensureHeaders(sh, SHEETS[name]);
  });
}

/**
 * Alternative JSON response function
 */
function jsonResponse(obj) {
  return _respond(obj);
}

// === ENHANCED LESSON PROGRESS TRACKING FUNCTIONS ===

/**
 * Enhanced daily report submission with automatic lesson progress tracking
 */
function submitDailyReportWithProgressTracking(reportData) {
  try {
    console.log(`Submitting daily report with progress tracking: ${JSON.stringify(reportData)}`);
    
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
    
    console.log(`Daily report submitted successfully: ${reportId}`);
    
    return {
      success: true,
      reportId: reportId,
      message: 'Daily report submitted successfully',
      progressTracked: progressResult.success
    };
  } catch (error) {
    console.error(`Error submitting daily report with progress tracking: ${error.message}`);
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
    console.error(`Error getting lesson progress for dashboard: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to ensure headers exist in a sheet
 */
function _ensureHeadersEnhanced(sheet, requiredHeaders) {
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

/**
 * Get daily reports for a teacher within date range
 */
function getDailyReports(teacherEmail, startDate = null, endDate = null, cls = '', subject = '') {
  try {
    const sheet = _getSheet('DailyReports');
    const headers = _headers(sheet);
    const allReports = _rows(sheet).map(row => _indexByHeader(row, headers));
    
    let filteredReports = allReports.filter(report => {
      const emailMatch = (report.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase();
      const classMatch = !cls || (report.class || '') === cls;
      const subjectMatch = !subject || (report.subject || '') === subject;
      
      let dateMatch = true;
      if (startDate || endDate) {
        const reportDate = new Date(report.date);
        if (startDate) dateMatch = dateMatch && reportDate >= new Date(startDate);
        if (endDate) dateMatch = dateMatch && reportDate <= new Date(endDate);
      }
      
      return emailMatch && classMatch && subjectMatch && dateMatch;
    });
    
    // Sort by date descending
    filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
      success: true,
      reports: filteredReports,
      count: filteredReports.length
    };
  } catch (error) {
    console.error(`Error getting daily reports: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get all teachers function (placeholder - should be implemented in AuthManager.gs)
 */
function getAllTeachers() {
  try {
    const usersSheet = _getSheet('Users');
    const usersHeaders = _headers(usersSheet);
    const users = _rows(usersSheet).map(row => _indexByHeader(row, usersHeaders));
    
    return users.filter(user => {
      const roles = (user.roles || user.role || '').toLowerCase();
      return roles.includes('teacher') || roles.includes('hm') || roles.includes('head');
    }).map(user => ({
      email: (user.email || '').toLowerCase(),
      name: user.name || user.email,
      roles: user.roles || user.role || '',
      classes: user.classes ? user.classes.split(',').map(c => c.trim()) : [],
      subjects: user.subjects ? user.subjects.split(',').map(s => s.trim()) : []
    }));
  } catch (error) {
    console.error(`Error getting all teachers: ${error.message}`);
    return [];
  }
}