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
 * ADDITIVE APPROACH: Only adds missing columns, preserves existing headers
 */
function _ensureHeaders(sh, cols) {
  const h = _headers(sh);
  
  // If sheet is completely empty, add headers
  if (h.filter(Boolean).length === 0) {
    sh.getRange(1,1,1,cols.length).setValues([cols]);
    return;
  }
  
  // ADDITIVE: Only add columns that are missing at the end
  const currentLength = h.length;
  const requiredLength = cols.length;
  
  if (requiredLength > currentLength) {
    // Add missing columns at the end
    const missingCols = cols.slice(currentLength);
    const startCol = currentLength + 1;
    sh.getRange(1, startCol, 1, missingCols.length).setValues([missingCols]);
    Logger.log(`Added ${missingCols.length} new columns to ${sh.getName()}: ${missingCols.join(', ')}`);
  }
  
  // NOTE: If columns exist with different names, we preserve user's choice
  // This prevents overwriting manual corrections
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

/**
 * Read a sheet and return an array of row objects indexed by headers.
 * Uses request-scoped caching to avoid repeated reads within the same request.
 */
function _readSheet(sheetName) {
  try {
    const cached = _getCachedSheetData(sheetName);
    return cached && Array.isArray(cached.data) ? cached.data : [];
  } catch (e) {
    Logger.log('[SheetHelpers._readSheet] Error reading sheet ' + sheetName + ': ' + (e && e.message ? e.message : e));
    return [];
  }
}

// (Removed) Enhanced lesson progress helpers archived in archive/appscript-backups/unused-helpers-2025-11-28.gs

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
      // Safety: ensure report is object and teacherEmail coerced to string
      if (!report || typeof report !== 'object') return false;
      const emailMatch = String(report.teacherEmail || '').toLowerCase() === String(teacherEmail || '').toLowerCase();
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

    // Attempt cascade rollback for related lesson plan (if any)
    var rollbackInfo = { updatedCount: 0, lpIds: [], warnings: [] };
    try {
      const reportDateISO = _isoDateString(reportObj.date || '');
      const teacherEmailLower = String(reportObj.teacherEmail || '').toLowerCase();
      const cls = String(reportObj.class || '');
      const subject = String(reportObj.subject || '');
      const chapter = String(reportObj.chapter || '');
      const sessionNo = Number(reportObj.sessionNo || reportObj.session || 0);
      const lessonPlanId = String(reportObj.lessonPlanId || '').trim();

      const lpSh = _getSheet('LessonPlans');
      const lpHdr = _headers(lpSh);
      const lpRows = _rows(lpSh);
      const lpIdx = {};
      lpHdr.forEach((h, i) => lpIdx[h] = i);
      const col = (name) => lpHdr.indexOf(name) + 1; // 1-based for getRange

      // Find matching plan: prefer lessonPlanId, else by teacher/class/subject/chapter/session, else by originalDate+teacher
      let targetRow = -1;
      let targetObj = null;

      if (lessonPlanId && lpIdx['lpId'] != null) {
        for (let i = 0; i < lpRows.length; i++) {
          if (String(lpRows[i][lpIdx['lpId']]) === lessonPlanId) {
            targetRow = i + 2; targetObj = _indexByHeader(lpRows[i], lpHdr); break;
          }
        }
      }
      if (targetRow < 0) {
        // try semantic match
        const idx = {
          teacherEmail: lpHdr.indexOf('teacherEmail'),
          class: lpHdr.indexOf('class'),
          subject: lpHdr.indexOf('subject'),
          chapter: lpHdr.indexOf('chapter'),
          session: lpHdr.indexOf('session'),
          originalDate: lpHdr.indexOf('originalDate')
        };
        for (let i = 0; i < lpRows.length; i++) {
          const r = lpRows[i];
          const t = String(r[idx.teacherEmail] || '').toLowerCase();
          const c = String(r[idx.class] || '');
          const s = String(r[idx.subject] || '');
          const ch = String(r[idx.chapter] || '');
          const sess = Number(r[idx.session] || 0);
          const od = _isoDateString(r[idx.originalDate] || '');
          const chapterMatch = chapter ? (String(ch).toLowerCase() === String(chapter).toLowerCase()) : true;
          const sessionMatch = sessionNo ? (Number(sess) === Number(sessionNo)) : true;
          const teacherMatch = t === teacherEmailLower;
          const csMatch = (c === cls) && (s === subject);
          const origDateMatch = reportDateISO && od ? (od === reportDateISO) : false;

          // Prefer exact chapter/session match; else allow originalDate+teacher match
          if (teacherMatch && csMatch && chapterMatch && sessionMatch) {
            targetRow = i + 2; targetObj = _indexByHeader(r, lpHdr); break;
          }
          if (targetRow < 0 && teacherMatch && csMatch && origDateMatch) {
            targetRow = i + 2; targetObj = _indexByHeader(r, lpHdr); /* continue looking for chapter/session exact */
          }
        }
      }

      if (targetRow > 0 && targetObj) {
        const selDateCol = col('selectedDate');
        const selPeriodCol = col('selectedPeriod');
        const origDateCol = col('originalDate');
        const origPeriodCol = col('originalPeriod');
        const statusCol = col('status');

        // Helper to restore a single row by index with its object
        const restoreRow = (rowIndex1Based, obj) => {
          let changed = false;
          if (origDateCol > 0 && selDateCol > 0 && obj.originalDate) {
            let restoreDate = obj.originalDate;
            if (restoreDate instanceof Date) {
              restoreDate = Utilities.formatDate(restoreDate, 'Asia/Kolkata', 'yyyy-MM-dd');
            } else if (typeof restoreDate === 'string') {
              restoreDate = _isoDateString(restoreDate);
            }
            lpSh.getRange(rowIndex1Based, selDateCol).setValue(restoreDate || '');
            lpSh.getRange(rowIndex1Based, origDateCol).setValue('');
            changed = true;
          }
          if (origPeriodCol > 0 && selPeriodCol > 0 && (obj.originalPeriod !== undefined && obj.originalPeriod !== '')) {
            let restorePeriod = obj.originalPeriod || '';
            restorePeriod = String(restorePeriod).replace(/^Period\s*/i, '').trim();
            lpSh.getRange(rowIndex1Based, selPeriodCol).setValue(restorePeriod);
            lpSh.getRange(rowIndex1Based, origPeriodCol).setValue('');
            changed = true;
          }
          if (changed && statusCol > 0) {
            const curStatus = String(obj.status || '').trim().toLowerCase();
            if (curStatus === 'rescheduled (cascade)'.toLowerCase()) {
              // Use 'Ready' so the reporting form recognizes the session as available again
              lpSh.getRange(rowIndex1Based, statusCol).setValue('Ready');
            }
          }
          return changed;
        };

        // 1) Restore the specific reported session if it was cascaded
        const changedTarget = restoreRow(targetRow, targetObj);
        if (changedTarget) {
          rollbackInfo.updatedCount += 1;
          rollbackInfo.lpIds.push(String(targetObj.lpId || lessonPlanId || 'UNKNOWN'));
        } else {
          rollbackInfo.warnings.push('No originalDate/originalPeriod to rollback for target');
        }

        // 2) Restore any subsequently cascaded sessions for the same teacher/class/subject/chapter
        // We detect cascaded sessions by presence of originalDate/originalPeriod.
        const tEmail = String(targetObj.teacherEmail || '').toLowerCase();
        const tClass = String(targetObj.class || '');
        const tSubject = String(targetObj.subject || '');
        const tChapter = String(targetObj.chapter || '');

        for (let i = 0; i < lpRows.length; i++) {
          const obj = _indexByHeader(lpRows[i], lpHdr);
          const rowIdx1 = i + 2;
          const sameTeacher = String(obj.teacherEmail || '').toLowerCase() === tEmail;
          const sameClass = String(obj.class || '') === tClass;
          const sameSubject = String(obj.subject || '') === tSubject;
          const sameChapter = tChapter ? (String(obj.chapter || '').toLowerCase() === String(tChapter).toLowerCase()) : true;
          const hadOrig = !!(obj.originalDate) || (obj.originalPeriod !== undefined && obj.originalPeriod !== '');
          if (!sameTeacher || !sameClass || !sameSubject || !sameChapter || !hadOrig) continue;

          // Skip the already restored target row
          if (rowIdx1 === targetRow) continue;

          const changed = restoreRow(rowIdx1, obj);
          if (changed) {
            rollbackInfo.updatedCount += 1;
            rollbackInfo.lpIds.push(String(obj.lpId || 'UNKNOWN'));
          }
        }
      } else {
        rollbackInfo.warnings.push('Related lesson plan not found');
      }
    } catch (rbErr) {
      console.error('Cascade rollback warning:', rbErr && rbErr.message ? rbErr.message : String(rbErr));
    }

    // Perform report deletion after attempted rollback
    sh.deleteRow(rowToDelete);
    return { success: true, deletedId: reportId, rollback: rollbackInfo };
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

    // Fallback 2: Try match by lessonPlanId when provided
    if (rowIndex < 0) {
      const lpCol = idxMap['lessonPlanId'];
      if (lpCol != null) {
        console.log('[verifyDailyReport] Trying lessonPlanId match');
        for (let i = 0; i < data.length; i++) {
          if (String(data[i][lpCol] || '') === reportIdStr) {
            rowObj = _indexByHeader(data[i], headers);
            rowIndex = i + 2;
            console.log('[verifyDailyReport] lessonPlanId match found at row', rowIndex);
            break;
          }
        }
      }
    }

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
    let rowObj = null;
    const reportIdStr = String(reportId);
    // Try ID match first (when 'id' column exists)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (idCol != null && String(row[idCol]) === reportIdStr) { rowIndex = i + 2; rowObj = _indexByHeader(row, headers); break; }
    }
    // Composite key fallback
    if (rowIndex < 0) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowDate = _isoDateString(row[idxMap['date']] || '');
        const rowClass = String(row[idxMap['class']] || '').trim();
        const rowSubject = String(row[idxMap['subject']] || '').trim();
        const rowPeriodRaw = String(row[idxMap['period']] || '').trim();
        const rowPeriod = rowPeriodRaw.replace(/^Period\s*/i, '');
        const rowEmail = String(row[idxMap['teacherEmail']] || '').trim().toLowerCase();
        const composite = [rowDate, rowClass, rowSubject, rowPeriod, rowEmail].join('|');
        if (composite === reportIdStr) { rowIndex = i + 2; rowObj = _indexByHeader(row, headers); break; }
      }
    }
    // lessonPlanId fallback
    if (rowIndex < 0) {
      const lpCol = idxMap['lessonPlanId'];
      if (lpCol != null) {
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (String(row[lpCol] || '') === reportIdStr) { rowIndex = i + 2; rowObj = _indexByHeader(row, headers); break; }
        }
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

    // Add notification + optional email to teacher
    try {
      const teacherEmail = rowObj ? String(rowObj.teacherEmail || '').trim() : '';
      if (teacherEmail) {
        _addNotification(teacherEmail, 'report-reopened', 'Daily report reopened for correction', {
          reportId: reportId,
            reason: reason || '',
            reopenedBy: requesterEmail,
            reopenedAt: new Date().toISOString()
        });
        try {
          if (typeof sendEmailNotification === 'function') {
            sendEmailNotification(
              teacherEmail,
              'Report Reopened for Correction',
              'Your daily report was reopened by HM/headmaster. Reason: ' + (reason || 'No reason provided.')
            );
          }
        } catch (mailErr) { /* ignore email failures */ }
      }
    } catch (notifyErr) { console.error('Notification (reopen) error', notifyErr); }

    return { success: true, reopenedId: reportId };
  } catch (err) {
    console.error('reopenDailyReport error', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

// (Removed) Progress stub functions archived with unused helpers

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

// ===== In-app Notifications Helper =====
function _addNotification(email, type, message, payloadObj) {
  try {
    if (!email || !type) return;
    const sh = _getSheet('Notifications');
    _ensureHeaders(sh, ['email','type','message','payload','createdAt','readAt']);
    const row = [
      email,
      type,
      message || '',
      JSON.stringify(payloadObj || {}),
      new Date().toISOString(),
      ''
    ];
    sh.appendRow(row);
  } catch (e) {
    console.error('_addNotification error', e);
  }
}

// ===== Email Notification Helper =====
// Lightweight wrapper so callers can safely check typeof sendEmailNotification === 'function'
function sendEmailNotification(toEmail, subject, body) {
  try {
    if (!toEmail) return false;
    subject = subject || 'Notification';
    body = body || '';
    // MailApp is available in Google Apps Script runtime
    MailApp.sendEmail({
      to: String(toEmail),
      subject: String(subject),
      htmlBody: String(body),
      name: 'EnhanceFlow'
    });
    return true;
  } catch (e) {
    // Keep silent failures from breaking flow; log for diagnostics
    try { console.error('sendEmailNotification error', e && e.message ? e.message : String(e)); } catch (ee) {}
    return false;
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
    var tEmail = String(r[idx.teacherEmail] || '').toLowerCase().trim();
    if (tEmail !== String(teacherEmail || '').toLowerCase().trim()) continue;
    // Normalize class/subject/chapter comparisons (trim + case-insensitive)
    if (idx.class !== -1 && String(r[idx.class] || '').trim() !== String(cls || '').trim()) continue;
    if (idx.subject !== -1 && String(r[idx.subject] || '').trim() !== String(subject || '').trim()) continue;
    if (idx.chapter !== -1) {
      var planChapter = String(r[idx.chapter] || '').trim().toLowerCase();
      var targetChapter = String(chapter || '').trim().toLowerCase();
      if (planChapter !== targetChapter) continue;
    }
    var dtStr = idx.selectedDate !== -1 ? _isoDateString(r[idx.selectedDate] || '') : '';
    if (cutoff && dtStr) {
      var d = new Date(dtStr);
      if (!(d >= cutoff)) continue;
    }
    var st = idx.status !== -1 ? String(r[idx.status] || '').trim() : '';
    // Consider a session remaining unless it is clearly cancelled/completed/reported
    var notRemaining = /(cancel|completed|done|reported)/i.test(st);
    var planned = !notRemaining; // everything else counts as remaining (Ready, Planned, Scheduled, Pending Review, Revision, etc.)
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
      } else if (action === 'keep' || action === 'keep_revision') {
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

// ===== Google Sign-In: Token Verification =====
function _verifyGoogleIdToken(idToken, expectedClientId) {
  try {
    if (!idToken) return { success: false, error: 'Missing id_token' };
    var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, method: 'get' });
    var status = res.getResponseCode();
    if (status < 200 || status >= 300) {
      return { success: false, error: 'Tokeninfo request failed', status: status, body: res.getContentText() };
    }
    var info = JSON.parse(res.getContentText() || '{}');
    var aud = String(info.aud || '');
    var email = String(info.email || '').toLowerCase();
    var emailVerified = String(info.email_verified || '').toLowerCase();
    if (expectedClientId && aud !== expectedClientId) {
      return { success: false, error: 'Invalid audience', aud: aud };
    }
    if (!email) {
      return { success: false, error: 'Email missing in token' };
    }
    return { success: true, tokenInfo: info, email: email, emailVerified: emailVerified === 'true' || emailVerified === '1' };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

function _getUserByEmail(email) {
  try {
    var sh = _getSheet('Users');
    var hdr = _headers(sh);
    var rows = _rows(sh).map(function(r){ return _indexByHeader(r, hdr); });
    var target = String(email || '').toLowerCase().trim();
    var u = rows.find(function(row){ return String(row.email || '').toLowerCase().trim() === target; });
    if (!u) return null;
    return {
      email: String(u.email || '').toLowerCase(),
      name: u.name || u.email || '',
      roles: u.roles || u.role || '',
      classes: u.classes || '',
      subjects: u.subjects || ''
    };
  } catch (e) {
    return null;
  }
}

// Public helper: verify token and return user profile + roles
function verifyGoogleLogin(idToken) {
  try {
    var settings = _getCachedSettings();
    var expectedClientId = settings['GOOGLE_OAUTH_CLIENT_ID'] || '';
    var check = _verifyGoogleIdToken(idToken, expectedClientId);
    if (!check.success) return { success: false, error: check.error || 'Token verification failed', details: check };
    var user = _getUserByEmail(check.email);
    if (!user) return { success: false, error: 'User not found in directory', email: check.email };
    return { success: true, user: user, emailVerified: check.emailVerified };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

// ===== AI Lesson Plan Suggestions (Deterministic Templates) =====

/**
 * Build a deterministic lesson plan suggestion when external AI is unavailable.
 */
function _buildLessonSuggestion(params) {
  var subject = String((params && params.subject) || '').trim();
  var chapter = String((params && params.chapter) || '').trim();
  var cls = String((params && params.class) || '').trim();
  var sessionNo = Number((params && (params.session || params.sessionNo)) || 1);

  var title = (subject && chapter) ? (subject + ' - ' + chapter + ' (Session ' + sessionNo + ')') : ('Lesson Session ' + sessionNo);

  // Basic signal extraction from class for grade-level tuning
  var grade = (function(c){
    try {
      var m = String(c||'').match(/\d{1,2}/);
      return m ? Number(m[0]) : null;
    } catch(e){ return null; }
  })(cls);

  var subj = subject.toLowerCase();
  var ch = chapter;

  function join() {
    return Array.prototype.slice.call(arguments).filter(Boolean);
  }

  function timeBlock(label, minutes, detail) {
    return label + ' (' + minutes + 'm): ' + detail;
  }

  // Subject-aware objectives/activities/materials/assessment
  var objectives = [];
  var activities = [];
  var materials = [];
  var assessment = [];

  if (/math|arithmetic|algebra|geometry|trigonometry|statistics|probabil/i.test(subj)) {
    objectives = join(
      'Recall prior knowledge related to ' + (ch || 'the concept'),
      'Apply formulae/strategies to problems from ' + (ch || 'this topic'),
      (grade && grade >= 9 ? 'Solve word problems and justify steps clearly' : 'Solve guided problems with step-by-step reasoning')
    );
    activities = join(
      timeBlock('Warm-up', 5, 'Quick recap: 2 mental-math questions linked to ' + (ch || 'today’s topic')),
      timeBlock('Teach', 15, 'Explain the key idea with 1–2 worked examples from ' + (ch || 'the chapter')),
      timeBlock('Guided Practice', 10, 'Students solve 2–3 questions (odd roll call numbers attempt Q1, even attempt Q2)') ,
      timeBlock('Discuss/Misconceptions', 5, 'Review common errors; share correct methods'),
      timeBlock('Exit Ticket', 5, 'One problem testing core idea of ' + (ch || 'the topic'))
    );
    materials = join('Board/Marker', 'Textbook: ' + (ch || 'relevant section'), 'Prepared problem set (3–5 items)');
    assessment = join('Observe methods during guided practice', 'Exit ticket: 1 problem with steps', 'Homework: 4 problems from textbook');
  } else if (/science|physics|chemistry|biology|general science/i.test(subj)) {
    objectives = join(
      'Describe the key concept(s) in ' + (ch || 'this lesson'),
      (grade && grade >= 8 ? 'Relate concept to real-world application or experiment' : 'Identify examples from daily life'),
      'Demonstrate understanding via short responses/diagram'
    );
    activities = join(
      timeBlock('Engage', 5, 'Prompt/question related to ' + (ch || 'the phenomenon')),
      timeBlock('Explain', 15, 'Concept explanation with diagram/model demonstration'),
      timeBlock('Explore', 10, 'Mini activity: predict/observe/record (table with 2–3 observations)'),
      timeBlock('Elaborate', 5, 'Connect to daily life or lab safety/usage'),
      timeBlock('Evaluate', 5, '2 short questions or lab sheet checkpoint')
    );
    materials = join('Board/Marker', 'Textbook: ' + (ch || 'topic section'), 'Simple demo materials (as available)');
    assessment = join('Observation notes during Explore', '2 VSAQs on concept/diagram', 'Homework: 5 lines summary with one example');
  } else if (/english|language|literature|grammar|reading/i.test(subj)) {
    objectives = join(
      'Improve comprehension of the text: ' + (ch || 'selected passage'),
      'Acquire 3–5 new vocabulary items in context',
      (grade && grade >= 9 ? 'Analyze theme/tone with textual evidence' : 'Identify main idea and supporting details')
    );
    activities = join(
      timeBlock('Activate Prior Knowledge', 5, 'Starter prompt related to ' + (ch || 'the text')),
      timeBlock('Read/Model', 10, 'Teacher model read; annotate difficult words/phrases'),
      timeBlock('Guided Practice', 10, 'Pair read and answer 3 comprehension questions'),
      timeBlock('Language Focus', 10, 'Highlight grammar/vocab from passage; quick drill'),
      timeBlock('Exit Ticket', 5, 'One inference question or 2 vocab usages')
    );
    materials = join('Textbook/printed passage: ' + (ch || 'selection'), 'Dictionary list (5 words)', 'Notebook');
    assessment = join('Oral responses during reading', '3 written answers (short)', 'Vocabulary usage in 2 original sentences');
  } else if (/social|history|geography|civics|economics/i.test(subj)) {
    // Vary content based on session progression
    var sessionPhases = [
      { phase: 'Introduction', focus: 'introduce key concepts and vocabulary', activity: 'brainstorm what students already know' },
      { phase: 'Exploration', focus: 'explore main ideas with examples', activity: 'analyze primary sources or case studies' },
      { phase: 'Analysis', focus: 'analyze causes and effects', activity: 'create comparison charts or timelines' },
      { phase: 'Application', focus: 'connect concepts to real-world situations', activity: 'role-play or scenario analysis' },
      { phase: 'Synthesis', focus: 'synthesize information from multiple sources', activity: 'group discussion and presentation prep' },
      { phase: 'Evaluation', focus: 'evaluate different perspectives', activity: 'debate or written argument on key questions' },
      { phase: 'Review', focus: 'review and consolidate learning', activity: 'quiz and concept mapping' },
      { phase: 'Assessment', focus: 'assess understanding through application', activity: 'project work or extended response questions' }
    ];
    
    // Use modulo to cycle through phases for sessions beyond 8
    var phaseIndex = (sessionNo - 1) % sessionPhases.length;
    var currentPhase = sessionPhases[phaseIndex];
    
    objectives = join(
      'Identify and explain key terms/concepts from ' + (ch || 'the unit') + ' (Session ' + sessionNo + ': ' + currentPhase.phase + ')',
      currentPhase.phase === 'Introduction' ? 'Build background knowledge and activate prior learning' :
      currentPhase.phase === 'Exploration' ? 'Examine main ideas through examples and evidence' :
      currentPhase.phase === 'Analysis' ? 'Analyze relationships between events/concepts' :
      currentPhase.phase === 'Application' ? 'Apply concepts to new contexts or problems' :
      currentPhase.phase === 'Synthesis' ? 'Combine information from multiple sources' :
      currentPhase.phase === 'Evaluation' ? 'Evaluate arguments and form reasoned conclusions' :
      currentPhase.phase === 'Review' ? 'Consolidate and review key learning points' :
      'Demonstrate mastery through comprehensive assessment',
      
      sessionNo <= 2 ? 'Locate key terms and basic facts' :
      sessionNo <= 4 ? 'Compare/contrast ideas or events with supporting details' :
      sessionNo <= 6 ? 'Analyze causes, effects, and patterns' :
      'Synthesize information and form independent conclusions'
    );
    
    var hookActivity = sessionNo === 1 ? 'Opening image/question to spark curiosity' :
                       sessionNo <= 3 ? 'Quick recall of previous session\'s key points' :
                       sessionNo <= 5 ? 'Thought-provoking scenario or current event link' :
                       'Connect to previous sessions and bridge to new learning';
    
    var teachActivity = sessionNo === 1 ? 'Introduce core vocabulary and concepts with visuals' :
                        sessionNo <= 3 ? 'Explain main ideas with 2-3 diverse examples' :
                        sessionNo <= 5 ? 'Deeper analysis with cause-effect relationships' :
                        'Synthesis of key themes and critical perspectives';
    
    var practiceActivity = sessionNo === 1 ? 'Fill vocabulary table (term | definition | simple example)' :
                           sessionNo <= 3 ? 'Create comparison chart or simple timeline' :
                           sessionNo <= 5 ? 'Analyze primary source excerpt or case study' :
                           'Prepare argument or presentation outline';
    
    var applyActivity = sessionNo === 1 ? 'Match images/labels to basic concepts' :
                        sessionNo <= 3 ? 'Map/timeline activity with 3-4 items' :
                        sessionNo <= 5 ? 'Apply concept to real-world example or role-play' :
                        'Create original example or evaluate different viewpoints';
    
    var exitActivity = sessionNo === 1 ? 'List 3 new terms learned today' :
                       sessionNo <= 3 ? 'Write 3-4 line summary of main idea' :
                       sessionNo <= 5 ? 'Answer one analytical question (5-6 lines)' :
                       'Reflect on learning or pose thoughtful question';
    
    activities = join(
      timeBlock('Hook', 5, hookActivity + ' about ' + (ch || 'the topic')),
      timeBlock('Teach', 15, teachActivity),
      timeBlock('Practice', 10, practiceActivity),
      timeBlock('Apply', 5, applyActivity),
      timeBlock('Exit Ticket', 5, exitActivity)
    );
    
    materials = join(
      'Board/Marker', 
      'Textbook: ' + (ch || 'section') + ' (Session ' + sessionNo + ')',
      sessionNo === 1 ? 'Vocabulary cards or visual aids' :
      sessionNo <= 3 ? 'Map/timeline handout' :
      sessionNo <= 5 ? 'Primary source excerpts or case study sheets' :
      'Project rubric or assessment guidelines'
    );
    
    assessment = join(
      sessionNo === 1 ? 'Check vocabulary table completion' :
      sessionNo <= 3 ? 'Review comparison charts/timelines for accuracy' :
      sessionNo <= 5 ? 'Assess depth of analysis and use of evidence' :
      'Evaluate synthesis, argumentation, and critical thinking',
      
      'Exit ticket quality and understanding',
      
      sessionNo === 1 ? 'Homework: Define 5 key terms with examples' :
      sessionNo <= 3 ? 'Homework: Read next section and note 3 main points' :
      sessionNo <= 5 ? 'Homework: Answer 2 analytical questions' :
      'Homework: Complete project component or prepare presentation'
    );
  } else if (/computer|ict|information technology|cs/i.test(subj)) {
    objectives = join(
      'Understand core idea of ' + (ch || 'the topic'),
      'Perform basic hands-on task demonstrating the concept',
      'Follow lab etiquette and save work properly'
    );
    activities = join(
      timeBlock('Intro', 5, 'Connect prior knowledge; show quick demo'),
      timeBlock('Explain', 10, 'Step-by-step walkthrough of commands/screens'),
      timeBlock('Hands-on', 15, 'Students replicate task and extend with one variation'),
      timeBlock('Share', 5, '2 students present outputs briefly'),
      timeBlock('Exit Ticket', 5, 'Screenshot or answer 2 “how-to” questions')
    );
    materials = join('Lab systems/projector', 'Handout with steps', 'Sample files if needed');
    assessment = join('Observe hands-on task completion', '2 QA items from lab handout', 'Saved file in correct folder');
  } else {
    // Generic (fallback)
    objectives = join(
      'Understand key ideas of ' + (ch || 'the topic'),
      'Connect with real-life examples suitable for class ' + (cls || ''),
      'Demonstrate understanding through a short task'
    );
    activities = join(
      timeBlock('Warm-up', 5, 'Quick recap related to ' + (ch || 'today’s concept')),
      timeBlock('Teach', 15, 'Explain core idea with 1–2 examples'),
      timeBlock('Practice', 10, 'Small-group activity applying the idea'),
      timeBlock('Discuss', 5, 'Share outputs and clarify misconceptions'),
      timeBlock('Exit Ticket', 5, '1 question testing today’s outcome')
    );
    materials = join('Board/Marker', 'Textbook: ' + (ch || 'relevant section'), 'Worksheet (3–5 items)');
    assessment = join('Observe practice task', 'Exit ticket correctness', 'Homework: 3 questions from textbook');
  }

  return {
    title: title,
    objectives: objectives,
    activities: activities,
    materials: materials,
    assessment: assessment
  };
}

/**
 * Single-session suggestion for teacher (no external AI dependency).
 * params: { teacherEmail, class, subject, chapter, session }
 */
function suggestLessonPlan(params) {
  try {
    if (!params || !params.teacherEmail) return { success: false, error: 'Missing teacherEmail' };
    var suggestion = _buildLessonSuggestion(params);
    return { success: true, suggestion: suggestion };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * Bulk generate suggestions and write to LessonPlans.
 * params: { teacherEmail, class, subject, chapter, sessions: number, startSession?: number }
 */
function suggestLessonPlansBulk(params) {
  var lock;
  try {
    var teacherEmail = params && params.teacherEmail;
    var teacherName = params && params.teacherName;
    var cls = params && params.class;
    var subject = params && params.subject;
    var chapter = params && params.chapter;
    var sessions = Number(params && params.sessions);
    var startSession = Number(params && params.startSession) || 1;
    var schemeId = params && params.schemeId;
    if (!teacherEmail || !cls || !subject || !chapter || !sessions) {
      return { success: false, error: 'Missing required parameters (teacherEmail/class/subject/chapter/sessions)' };
    }

    lock = LockService.getDocumentLock();
    lock.waitLock(28000);

    var lpSh = _getSheet('LessonPlans');
    // Use existing headers as-is; don't mutate schema here
    var headers = _headers(lpSh);
    var col = function(names) { return _getIdx(headers, Array.isArray(names) ? names : [names]); };

    var idx = {
      lpId: col(['lpId','lessonPlanId','planId','id']),
      schemeId: col(['schemeId']),
      teacherEmail: col(['teacherEmail','teacher']),
      teacherName: col(['teacherName','teacher']),
      class: col(['class','className']),
      subject: col(['subject','subjectName']),
      chapter: col(['chapter','topic']),
      session: col(['session','sessionNo']),
      selectedDate: col(['selectedDate','date']),
      selectedPeriod: col(['selectedPeriod','period']),
      learningObjectives: col(['learningObjectives','objectives']),
      teachingMethods: col(['teachingMethods','methods','activities']),
      resourcesRequired: col(['resourcesRequired','resources','materials']),
      assessmentMethods: col(['assessmentMethods','assessment']),
      status: col(['status']),
      createdAt: col(['createdAt']),
      notes: col(['notes','note'])
    };

    var created = [];
    for (var s = 0; s < sessions; s++) {
      var sessNo = startSession + s;
      var sug = _buildLessonSuggestion({ class: cls, subject: subject, chapter: chapter, session: sessNo });
      var lpId = _uuid();
      var row = new Array(headers.length);
      for (var i = 0; i < headers.length; i++) row[i] = '';

      if (idx.lpId !== -1) row[idx.lpId] = lpId;
      if (idx.schemeId !== -1) row[idx.schemeId] = schemeId || '';
      if (idx.teacherEmail !== -1) row[idx.teacherEmail] = String(teacherEmail).toLowerCase();
      if (idx.teacherName !== -1) row[idx.teacherName] = teacherName || '';
      if (idx.class !== -1) row[idx.class] = cls;
      if (idx.subject !== -1) row[idx.subject] = subject;
      if (idx.chapter !== -1) row[idx.chapter] = chapter;
      if (idx.session !== -1) row[idx.session] = sessNo;
      if (idx.selectedDate !== -1) row[idx.selectedDate] = '';
      if (idx.selectedPeriod !== -1) row[idx.selectedPeriod] = '';

      // Map suggestion details into dedicated columns when present
      var objectivesText = (sug && sug.objectives && sug.objectives.join) ? sug.objectives.join('\n') : '';
      var activitiesText = (sug && sug.activities && sug.activities.join) ? sug.activities.join('\n') : '';
      var materialsText = (sug && sug.materials && sug.materials.join) ? sug.materials.join('\n') : '';
      var assessmentText = (sug && sug.assessment && sug.assessment.join) ? sug.assessment.join('\n') : '';
      if (idx.learningObjectives !== -1) row[idx.learningObjectives] = objectivesText;
      if (idx.teachingMethods !== -1) row[idx.teachingMethods] = activitiesText;
      if (idx.resourcesRequired !== -1) row[idx.resourcesRequired] = materialsText;
      if (idx.assessmentMethods !== -1) row[idx.assessmentMethods] = assessmentText;

      if (idx.status !== -1) row[idx.status] = 'Pending Review';
      if (idx.createdAt !== -1) row[idx.createdAt] = new Date().toISOString();
      if (idx.notes !== -1) row[idx.notes] = JSON.stringify(sug);

      lpSh.appendRow(row);
      created.push({ lpId: lpId, session: sessNo });
    }

    return { success: true, created: created };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  } finally {
    try { if (lock) lock.releaseLock(); } catch (ee) {}
  }
}