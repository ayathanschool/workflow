/**
 * ====== SHEET HELPER FUNCTIONS ======
 * These are the basic tools for working with your Google Spreadsheet
 * Think of these like a toolbox that other parts of your system use
 */

// PERFORMANCE: Request-scoped cache for sheet data
var REQUEST_SHEET_CACHE = {};
var REQUEST_SETTINGS_CACHE = null;

/**
 * Clear request cache (call at start of each request)
 */
function _clearRequestCache() {
  REQUEST_SHEET_CACHE = {};
  REQUEST_SETTINGS_CACHE = null;
}

/**
 * Get cached sheet data with headers
 * PERFORMANCE: Avoids multiple reads of same sheet in single request
 */
function _getCachedSheetData(sheetName) {
  if (!REQUEST_SHEET_CACHE[sheetName]) {
    const sheet = _getSheet(sheetName);
    const headers = _headers(sheet);
    const rows = _rows(sheet);
    REQUEST_SHEET_CACHE[sheetName] = {
      headers: headers,
      data: rows.map(row => _indexByHeader(row, headers))
    };
    Logger.log(`[CACHE] Loaded ${sheetName}: ${rows.length} rows`);
  } else {
    Logger.log(`[CACHE HIT] ${sheetName}`);
  }
  return REQUEST_SHEET_CACHE[sheetName];
}

/**
 * Get cached Settings data as key-value object
 * PERFORMANCE: Settings rarely change, cache for entire request
 */
function _getCachedSettings() {
  if (!REQUEST_SETTINGS_CACHE) {
    const settingsData = _getCachedSheetData('Settings').data;
    REQUEST_SETTINGS_CACHE = {};
    settingsData.forEach(row => {
      const key = (row.key || '').trim();
      if (key) {
        REQUEST_SETTINGS_CACHE[key] = row.value;
      }
    });
    Logger.log(`[CACHE] Loaded Settings: ${Object.keys(REQUEST_SETTINGS_CACHE).length} keys`);
  } else {
    Logger.log(`[CACHE HIT] Settings`);
  }
  return REQUEST_SETTINGS_CACHE;
}

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
 * Get or create a sheet - alias for _getSheet for consistency
 */
function _getOrCreateSheet(name) {
  return _getSheet(name);
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
  
  // If sheet is completely empty, add headers
  if (h.filter(Boolean).length === 0) {
    sh.getRange(1,1,1,cols.length).setValues([cols]);
    return;
  }
  
  // If sheet has data but headers are different, update them
  let needsUpdate = false;
  
  // Check if we need more columns
  if (cols.length > h.length) {
    needsUpdate = true;
  }
  
  // Check if any headers are missing or different
  for (let i = 0; i < cols.length; i++) {
    if (h[i] !== cols[i]) {
      needsUpdate = true;
      break;
    }
  }
  
  if (needsUpdate) {
    // Update the header row with the new headers
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    Logger.log(`Updated headers for sheet ${sh.getName()}: ${cols.join(', ')}`);
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
 * Convert a date to ISO string format
 * Note: _todayISO() is defined in MainApp.gs
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
    // Use IST timezone consistently
    const TZ = 'Asia/Kolkata';
    const date = new Date(isoDate + 'T00:00:00');
    return Utilities.formatDate(date, TZ, 'EEEE');
  } catch (err) {
    console.error('Error getting day name for:', isoDate, err);
    return '';
  }
}

/**
 * Create a JSON response with proper CORS headers
 */
function _respond(obj, status) {
  const response = {
    status: status || 200,
    data: obj,
    timestamp: new Date().toISOString()
  };
  
  const output = ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Add CORS headers to allow frontend access
  // Note: Apps Script doesn't support setHeader on ContentService, but this is for documentation
  return output;
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
      'teachingMethod', // ensure Teaching Method exists
      'submittedAt', 'lessonProgressTracked'
    ];
    // Use enhanced ensure to avoid overwriting existing header orders
    _ensureHeadersEnhanced(sheet, requiredHeaders);
    
    // Generate report ID and timestamp
    const reportId = _generateId('DR_');
    const timestamp = new Date().toISOString();
    
    // Prepare row data
    // Build row aligned to current headers to avoid column mismatch
    const rowValues = new Array(headers.length).fill('');
    const setIfExists = (colName, value) => {
      const idx = headers.indexOf(colName);
      if (idx !== -1) rowValues[idx] = value;
    };
    setIfExists('id', reportId);
    setIfExists('teacherEmail', reportData.teacherEmail || '');
    setIfExists('teacherName', reportData.teacherName || '');
    setIfExists('date', _dateToISO(reportData.date));
    setIfExists('class', reportData.class || '');
    setIfExists('subject', reportData.subject || '');
    setIfExists('topicsCovered', reportData.topicsCovered || '');
    setIfExists('studentsPresent', reportData.studentsPresent || 0);
    setIfExists('studentsAbsent', reportData.studentsAbsent || 0);
    setIfExists('remarks', reportData.remarks || '');
    setIfExists('teachingMethod', reportData.teachingMethod || reportData.activities || '');
    setIfExists('submittedAt', timestamp);
    setIfExists('lessonProgressTracked', 'pending');
    
    sheet.appendRow(rowValues);
    
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
    
    // Normalize date to IST yyyy-MM-dd for consistent display and filtering
    const TZ = 'Asia/Kolkata';
    filteredReports = filteredReports.map(r => {
      const out = Object.assign({}, r);
      try {
        if (r.date) {
          const d = new Date(r.date);
          if (!isNaN(d.getTime())) {
            out.date = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
          }
        }
      } catch (e) { /* ignore */ }
      return out;
    });

    // Sort by date descending (string yyyy-MM-dd safe lexicographically by date parse)
    filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return filteredReports;
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

/**
 * Check if a report can be deleted by the requester within a time window
 */
function _canDeleteDailyReport(report, requesterEmail, minutesWindow) {
  try {
    const owner = String(report.teacherEmail || '').toLowerCase();
    const requester = String(requesterEmail || '').toLowerCase();
    if (!owner || !requester || owner !== requester) return false;
    const submittedAt = report.submittedAt || report.createdAt || '';
    if (!submittedAt) return false;
    const submitted = new Date(submittedAt);
    if (isNaN(submitted.getTime())) return false;
    const now = new Date();
    const diffMs = now.getTime() - submitted.getTime();
    const allowedMs = (Number(minutesWindow) || 30) * 60 * 1000;
    return diffMs <= allowedMs;
  } catch (err) {
    console.error('Error in _canDeleteDailyReport', err);
    return false;
  }
}

/**
 * Delete a daily report by id if requester is owner and within allowed time window.
 * Settings key: DAILY_REPORT_DELETE_MINUTES (default 30)
 */
function deleteDailyReport(reportId, requesterEmail) {
  try {
    if (!reportId) return { success: false, error: 'Missing reportId' };
    if (!requesterEmail) return { success: false, error: 'Missing requesterEmail' };
    const sh = _getSheet('DailyReports');
    const headers = _headers(sh);
    const data = _rows(sh);
    const idxMap = {};
    headers.forEach((h, i) => idxMap[h] = i);
    const idCol = idxMap['id'] != null ? idxMap['id'] : idxMap['reportId'];
    const delMinutesSetting = _getCachedSettings()['DAILY_REPORT_DELETE_MINUTES'];
    const minutesWindow = delMinutesSetting != null ? Number(delMinutesSetting) : 30;

    let rowToDelete = -1;
    let reportObj = null;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Match by id/reportId if available
      if (idCol != null && String(row[idCol]) === String(reportId)) {
        reportObj = _indexByHeader(row, headers);
        rowToDelete = i + 2;
        break;
      }
      // Fallback: composite key match date|class|subject|period|teacherEmail
      if (idCol == null) {
        const dateVal = String(row[idxMap['date']] || '').trim();
        const classVal = String(row[idxMap['class']] || '').trim();
        const subjectVal = String(row[idxMap['subject']] || '').trim();
        const periodVal = String(row[idxMap['period']] || '').trim();
        const emailVal = String(row[idxMap['teacherEmail']] || '').trim().toLowerCase();
        const composite = [dateVal, classVal, subjectVal, periodVal, emailVal].join('|');
        if (composite === String(reportId)) {
          reportObj = _indexByHeader(row, headers);
          rowToDelete = i + 2;
          break;
        }
      }
    }
    if (rowToDelete < 0 || !reportObj) {
      return { success: false, error: 'Report not found' };
    }
    if (!_canDeleteDailyReport(reportObj, requesterEmail, minutesWindow)) {
      return { success: false, error: 'Delete not allowed (owner/time-window check failed)' };
    }

    sh.deleteRow(rowToDelete);
    return { success: true, deletedId: reportId };
  } catch (err) {
    console.error('deleteDailyReport error', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}