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
    let headers = _headers(sheet);
    
    // Ensure required columns exist
    const requiredHeaders = [
      'id', 'teacherEmail', 'teacherName', 'date', 'class', 'subject',
      'topicsCovered', 'studentsPresent', 'studentsAbsent', 'remarks',
      'teachingMethod', // ensure Teaching Method exists
      'submittedAt', 'lessonProgressTracked'
    ];
    // Use enhanced ensure to avoid overwriting existing header orders
    _ensureHeadersEnhanced(sheet, requiredHeaders);
    // Refresh headers after ensuring, so indexes align with current sheet
    headers = _headers(sheet);
    
    // Generate report ID and timestamp (use UUID for consistency across system)
    const reportId = _uuid();
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
    // Some sheets use 'createdAt'; populate when present for compatibility
    setIfExists('createdAt', timestamp);
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
    // Allow HM/headmaster role to delete any report without time-window/ownership restriction
    var isHM = false;
    try {
      isHM = userHasRole(requesterEmail, 'hm') || userHasRole(requesterEmail, 'headmaster');
    } catch (e) { /* role check unavailable, default false */ }

    // If verified, block deletion for teachers unless HM or the report has been reopened
    const verifiedVal = String(reportObj.verified || '').trim().toUpperCase() === 'TRUE';
    const reopenedFlag = !!(reportObj.reopenReason || reportObj.reopenedAt);
    if (!isHM && verifiedVal && !reopenedFlag) {
      return { success: false, error: 'Delete not allowed: report is verified. Please request HM to reopen.' };
    }

    // If reopened, allow owner to delete even if time-window elapsed (since HM requested correction)
    if (!isHM) {
      const canDeleteByWindow = _canDeleteDailyReport(reportObj, requesterEmail, minutesWindow);
      if (!reopenedFlag && !canDeleteByWindow) {
        return { success: false, error: 'Delete not allowed (owner/time-window check failed)' };
      }
    }

    sh.deleteRow(rowToDelete);
    return { success: true, deletedId: reportId };
  } catch (err) {
    console.error('deleteDailyReport error', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * Ensure verification/reopen columns exist in DailyReports
 */
function _ensureDailyReportVerificationHeaders(sheet) {
  const required = ['verified', 'verifiedBy', 'verifiedAt', 'reopenReason', 'reopenedBy', 'reopenedAt'];
  _ensureHeadersEnhanced(sheet, required);
}

/**
 * Verify a daily report (HM/headmaster only)
 */
function verifyDailyReport(reportId, verifierEmail) {
  try {
    if (!reportId) return { success: false, error: 'Missing reportId' };
    if (!verifierEmail) return { success: false, error: 'Missing verifierEmail' };

    var isHM = false;
    try {
      isHM = userHasRole(verifierEmail, 'hm') || userHasRole(verifierEmail, 'headmaster');
    } catch (e) { /* ignore */ }
    if (!isHM) {
      // Provide enriched debug info when authorization fails
      var roleInfo = {};
      try { roleInfo = debugUserRoles(verifierEmail); } catch (e) { roleInfo = { debugError: e && e.message ? e.message : String(e) }; }
      return { success: false, error: 'Not authorized (HM role not detected)', roleInfo: roleInfo };
    }

    const sh = _getSheet('DailyReports');
    const headers = _headers(sh);
    const data = _rows(sh);
    const idxMap = {};
    headers.forEach((h, i) => idxMap[h] = i);
    const idCol = idxMap['id'] != null ? idxMap['id'] : idxMap['reportId'];

    console.log('[verifyDailyReport] Headers:', headers.join(', '));
    console.log('[verifyDailyReport] Total rows:', data.length);

    let rowIndex = -1;
    let rowObj = null;
    
    const reportIdStr = String(reportId);
    console.log('[verifyDailyReport] Looking for:', reportIdStr);
    
    // Try direct ID match first if ID column exists and looks like UUID
    const hasUuidFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reportIdStr);
    if (idCol != null && hasUuidFormat) {
      console.log('[verifyDailyReport] Attempting direct ID match');
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][idCol]) === reportIdStr) {
          rowObj = _indexByHeader(data[i], headers);
          rowIndex = i + 2;
          console.log('[verifyDailyReport] Direct ID match found at row', rowIndex);
          break;
        }
      }
    }
    
    // Fall back to composite key matching if no ID match
    if (rowIndex < 0) {
      console.log('[verifyDailyReport] Falling back to composite key matching');
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Build composite from row (normalize date to YYYY-MM-DD)
      const rowDate = _isoDateString(row[idxMap['date']] || '');
      const rowClass = String(row[idxMap['class']] || '').trim();
      const rowSubject = String(row[idxMap['subject']] || '').trim();
      // Strip 'Period ' prefix if present to match numeric-only format from frontend
      const rowPeriodRaw = String(row[idxMap['period']] || '').trim();
      const rowPeriod = rowPeriodRaw.replace(/^Period\s*/i, '');
      const rowEmail = String(row[idxMap['teacherEmail']] || '').trim().toLowerCase();
      const composite = [rowDate, rowClass, rowSubject, rowPeriod, rowEmail].join('|');
      
      if (composite === reportIdStr) {
        rowObj = _indexByHeader(row, headers);
        rowIndex = i + 2;
        console.log('[verifyDailyReport] Composite key match found at row', rowIndex);
        break;
      }
    }
    } // End composite key matching block

    if (rowIndex < 0) {
      console.log('[verifyDailyReport] No match found.');
      console.log('[verifyDailyReport] Searched for:', reportIdStr);
      console.log('[verifyDailyReport] Total rows in DailyReports:', data.length);
      if (data.length > 0) {
        // Log first 3 composites for debugging
        for (let i = 0; i < Math.min(3, data.length); i++) {
          const sampleDate = _isoDateString(data[i][idxMap['date']] || '');
          const sampleClass = String(data[i][idxMap['class']] || '').trim();
          const sampleSubject = String(data[i][idxMap['subject']] || '').trim();
          const samplePeriodRaw = String(data[i][idxMap['period']] || '').trim();
          const samplePeriod = samplePeriodRaw.replace(/^Period\s*/i, '');
          const sampleEmail = String(data[i][idxMap['teacherEmail']] || '').trim().toLowerCase();
          console.log(`[verifyDailyReport] Row ${i+1} composite:`, [sampleDate, sampleClass, sampleSubject, samplePeriod, sampleEmail].join('|'));
        }
      }
      return { success: false, error: 'Report not found', debug: { reportId: reportIdStr, rowCount: data.length } };
    }

    _ensureDailyReportVerificationHeaders(sh);
    const hdrs = _headers(sh);
    const set = (col, val) => {
      const cIdx = hdrs.indexOf(col);
      if (cIdx !== -1) sh.getRange(rowIndex, cIdx + 1).setValue(val);
    };
    set('verified', 'TRUE');
    set('verifiedBy', verifierEmail);
    set('verifiedAt', new Date().toISOString());
    // Clear any previous reopen flags
    set('reopenReason', '');
    set('reopenedBy', '');
    set('reopenedAt', '');

    return { success: true, verifiedId: reportId };
  } catch (err) {
    console.error('verifyDailyReport error', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * Reopen a daily report (HM/headmaster only)
 */
function reopenDailyReport(reportId, requesterEmail, reason) {
  try {
    if (!reportId) return { success: false, error: 'Missing reportId' };
    if (!requesterEmail) return { success: false, error: 'Missing requesterEmail' };

    var isHM = false;
    try {
      isHM = userHasRole(requesterEmail, 'hm') || userHasRole(requesterEmail, 'headmaster');
    } catch (e) { /* ignore */ }
    if (!isHM) return { success: false, error: 'Not authorized' };

    const sh = _getSheet('DailyReports');
    const headers = _headers(sh);
    const data = _rows(sh);
    const idxMap = {};
    headers.forEach((h, i) => idxMap[h] = i);
    const idCol = idxMap['id'] != null ? idxMap['id'] : idxMap['reportId'];

    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (idCol != null && String(row[idCol]) === String(reportId)) { rowIndex = i + 2; break; }
      if (idCol == null) {
        const composite = [
          String(row[idxMap['date']] || '').trim(),
          String(row[idxMap['class']] || '').trim(),
          String(row[idxMap['subject']] || '').trim(),
          String(row[idxMap['period']] || '').trim(),
          String(row[idxMap['teacherEmail']] || '').trim().toLowerCase()
        ].join('|');
        if (composite === String(reportId)) { rowIndex = i + 2; break; }
      }
    }
    if (rowIndex < 0) return { success: false, error: 'Report not found' };

    _ensureDailyReportVerificationHeaders(sh);
    const hdrs = _headers(sh);
    const set = (col, val) => {
      const cIdx = hdrs.indexOf(col);
      if (cIdx !== -1) sh.getRange(rowIndex, cIdx + 1).setValue(val);
    };
    set('verified', '');
    set('verifiedBy', '');
    set('verifiedAt', '');
    set('reopenReason', reason || '');
    set('reopenedBy', requesterEmail);
    set('reopenedAt', new Date().toISOString());

    return { success: true, reopenedId: reportId };
  } catch (err) {
    console.error('reopenDailyReport error', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

// ==== SAFE STUBS to avoid missing reference errors ====
function _trackLessonProgress(progressData, timestamp) {
  try {
    return { success: true, details: [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getLessonProgressSummary(teacherEmail) {
  try {
    return { success: true, summary: {}, details: [], teacherStats: {} };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Robust role check: case-insensitive, ignores spaces and punctuation.
 * Examples: 'HM', 'h m', 'Headmaster' all match when appropriate.
 */
function userHasRole(email, role) {
  try {
    if (!email || !role) return false;
    const targetEmail = String(email).toLowerCase().trim();
    const targetNorm = String(role).toLowerCase().replace(/[^a-z]/g, '');

    const usersSheet = _getSheet('Users');
    const headers = _headers(usersSheet);
    const rows = _rows(usersSheet).map(r => _indexByHeader(r, headers));
    const user = rows.find(u => String(u.email || '').toLowerCase().trim() === targetEmail);
    if (!user) return false;

    const rawRoles = String(user.roles || user.role || '');
    // Tokenize on any non-letter separator and also keep a joined form without separators
    const tokens = rawRoles.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const joined = tokens.join('');

    // Helper checks
    const hasToken = (t) => tokens.includes(t);
    const joinedHas = (t) => joined.indexOf(t) !== -1;
    const hasPair = (a, b) => hasToken(a) && hasToken(b);

    // Direct match by tokens or joined string
    if (hasToken(targetNorm) || joinedHas(targetNorm)) return true;

    // HM/headmaster synonyms
    const hmSynonyms = ['hm', 'headmaster', 'headteacher', 'headmistress', 'principal'];
    const targetIsHM = ['hm', 'headmaster', 'headteacher', 'headmistress', 'principal'].includes(targetNorm);
    if (targetIsHM) {
      if (hmSynonyms.some(s => hasToken(s) || joinedHas(s))) return true;
      // Handle split-word variants like "head master", "head teacher"
      if (hasPair('head', 'master') || hasPair('head', 'teacher') || hasPair('head', 'mistress')) return true;
    }

    return false;
  } catch (err) {
    console.error('userHasRole error', err);
    return false;
  }
}

/**
 * Debug helper: inspect how roles are parsed for a user and if HM matches
 */
function debugUserRoles(email) {
  try {
    const targetEmail = String(email || '').toLowerCase().trim();
    const usersSheet = _getSheet('Users');
    const headers = _headers(usersSheet);
    const rows = _rows(usersSheet).map(r => _indexByHeader(r, headers));
    const user = rows.find(u => String(u.email || '').toLowerCase().trim() === targetEmail);
    if (!user) return { found: false, email: targetEmail };
    const rawRoles = String(user.roles || user.role || '');
    const tokens = rawRoles.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const joined = tokens.join('');
    const hmSynonyms = ['hm', 'headmaster', 'headteacher', 'headmistress', 'principal'];
    const has = (t) => tokens.includes(t) || joined.indexOf(t) !== -1;
    const hmMatched = hmSynonyms.some(has) || (tokens.includes('head') && (tokens.includes('master') || tokens.includes('teacher') || tokens.includes('mistress')));
    return {
      found: true,
      email: targetEmail,
      rawRoles: rawRoles,
      tokens: tokens,
      joined: joined,
      hmMatched: hmMatched
    };
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

// ===== Chapter Completion: Remaining Sessions & Apply Action =====

function _getIdx(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headers.indexOf(names[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function _ensureLessonPlanCancellationHeaders(sheet) {
  _ensureHeadersEnhanced(sheet, ['cancelledAt', 'cancelReason', 'forRevision']);
}

function _collectRemainingPlansForChapter(teacherEmail, cls, subject, chapter, dateISO) {
  var lpSh = _getSheet('LessonPlans');
  var lpHdr = _headers(lpSh);
  var lpRows = _rows(lpSh);
  var out = [];
  var idx = {
    lpId: _getIdx(lpHdr, ['lpId','lessonPlanId','planId','id']),
    teacherEmail: _getIdx(lpHdr, ['teacherEmail','teacher']),
    class: _getIdx(lpHdr, ['class','className']),
    subject: _getIdx(lpHdr, ['subject','subjectName']),
    chapter: _getIdx(lpHdr, ['chapter','topic']),
    session: _getIdx(lpHdr, ['session','sessionNo']),
    selectedDate: _getIdx(lpHdr, ['selectedDate','date']),
    selectedPeriod: _getIdx(lpHdr, ['selectedPeriod','period']),
    status: _getIdx(lpHdr, ['status'])
  };
  var cutoff = dateISO ? new Date(dateISO) : null;
  for (var i = 0; i < lpRows.length; i++) {
    var r = lpRows[i];
    var tEmail = String(r[idx.teacherEmail] || '').toLowerCase();
    if (tEmail !== String(teacherEmail || '').toLowerCase()) continue;
    if (idx.class !== -1 && String(r[idx.class] || '') !== String(cls || '')) continue;
    if (idx.subject !== -1 && String(r[idx.subject] || '') !== String(subject || '')) continue;
    if (idx.chapter !== -1 && String(r[idx.chapter] || '') !== String(chapter || '')) continue;
    var dtStr = idx.selectedDate !== -1 ? _isoDateString(r[idx.selectedDate] || '') : '';
    if (cutoff && dtStr) {
      var d = new Date(dtStr);
      if (!(d >= cutoff)) continue;
    }
    var st = idx.status !== -1 ? String(r[idx.status] || '') : '';
    var planned = !st || /ready|approved|planned|scheduled/i.test(st);
    if (!planned) continue;
    out.push({
      lpId: idx.lpId !== -1 ? String(r[idx.lpId] || '') : '',
      class: idx.class !== -1 ? r[idx.class] : '',
      subject: idx.subject !== -1 ? r[idx.subject] : '',
      chapter: idx.chapter !== -1 ? r[idx.chapter] : '',
      session: idx.session !== -1 ? r[idx.session] : '',
      selectedDate: dtStr,
      selectedPeriod: idx.selectedPeriod !== -1 ? r[idx.selectedPeriod] : '',
      status: st
    });
  }
  return out;
}

function checkChapterCompletion(params) {
  try {
    var teacherEmail = params && params.teacherEmail;
    var cls = params && params.class;
    var subject = params && params.subject;
    var chapter = params && params.chapter;
    var date = params && params.date;
    if (!teacherEmail || !cls || !subject || !chapter) {
      return { success: false, error: 'Missing required parameters' };
    }
    var remainingPlans = _collectRemainingPlansForChapter(teacherEmail, cls, subject, chapter, _isoDateString(date || ''));
    return { success: true, hasRemainingPlans: remainingPlans.length > 0, remainingPlans: remainingPlans };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

function applyChapterCompletionAction(params) {
  var lock;
  try {
    var action = params && params.action;
    var lessonPlanIds = params && (params.lessonPlanIds || params.ids || []);
    var requesterEmail = params && params.requesterEmail;
    if (!action || !Array.isArray(lessonPlanIds)) {
      return { success: false, error: 'Missing action or lessonPlanIds' };
    }
    lock = LockService.getDocumentLock();
    lock.waitLock(28000);

    var lpSh = _getSheet('LessonPlans');
    var lpHdr = _headers(lpSh);
    _ensureLessonPlanCancellationHeaders(lpSh);
    lpHdr = _headers(lpSh);
    var data = _rows(lpSh);
    var idx = {
      lpId: _getIdx(lpHdr, ['lpId','lessonPlanId','planId','id']),
      status: _getIdx(lpHdr, ['status']),
      selectedDate: _getIdx(lpHdr, ['selectedDate','date']),
      selectedPeriod: _getIdx(lpHdr, ['selectedPeriod','period']),
      cancelledAt: _getIdx(lpHdr, ['cancelledAt']),
      cancelReason: _getIdx(lpHdr, ['cancelReason']),
      forRevision: _getIdx(lpHdr, ['forRevision'])
    };

    var drSh = _getSheet('DailyReports');
    var drHdr = _headers(drSh);
    var drData = _rows(drSh);
    var drIdx = { lessonPlanId: _getIdx(drHdr, ['lessonPlanId','lpId','planId']) };

    var updated = 0;
    var skipped = [];
    var nowISO = new Date().toISOString();

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowId = idx.lpId !== -1 ? String(row[idx.lpId] || '') : '';
      if (!rowId || lessonPlanIds.indexOf(rowId) === -1) continue;

      if (action === 'cancel') {
        var hasReport = false;
        if (drIdx.lessonPlanId !== -1) {
          for (var j = 0; j < drData.length; j++) {
            if (String(drData[j][drIdx.lessonPlanId] || '') === rowId) { hasReport = true; break; }
          }
        }
        if (hasReport) { skipped.push({ lpId: rowId, reason: 'Already reported' }); continue; }
        if (idx.status !== -1) lpSh.getRange(i+2, idx.status+1).setValue('Cancelled (Chapter Complete)');
        if (idx.selectedDate !== -1) lpSh.getRange(i+2, idx.selectedDate+1).setValue('');
        if (idx.selectedPeriod !== -1) lpSh.getRange(i+2, idx.selectedPeriod+1).setValue('');
        if (idx.cancelledAt !== -1) lpSh.getRange(i+2, idx.cancelledAt+1).setValue(nowISO);
        if (idx.cancelReason !== -1) lpSh.getRange(i+2, idx.cancelReason+1).setValue('Chapter completed');
        updated++;
      } else if (action === 'keep') {
        if (idx.forRevision !== -1) lpSh.getRange(i+2, idx.forRevision+1).setValue('TRUE');
        // Optionally mark status
        if (idx.status !== -1 && !String(row[idx.status] || '').toLowerCase().includes('revision')) {
          lpSh.getRange(i+2, idx.status+1).setValue('Revision');
        }
        updated++;
      } else {
        skipped.push({ lpId: rowId, reason: 'Unknown action' });
      }
    }

    return { success: true, action: action, updatedCount: updated, skipped: skipped };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  } finally {
    try { if (lock) lock.releaseLock(); } catch (ee) {}
  }
}