/**
 * ====== CONFIG ======
 * Replace with your Spreadsheet ID.
 */
const SPREADSHEET_ID = '1fQTTbwhox4sTLXLAImD9945cIU4E1IEXq4P6s8yrC_8';

/**
 * ====== Helpers ======
 */
function _ss() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error(`Unable to open spreadsheet with ID ${SPREADSHEET_ID}: ${err && err.message ? err.message : err}`);
  }
}

function _getSheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function _headers(sh) {
  const range = sh.getRange(1,1,1,sh.getLastColumn() || 1);
  const values = range.getValues()[0];
  return values.map(v => String(v||'').trim());
}

function _ensureHeaders(sh, cols) {
  const h = _headers(sh);
  if (h.filter(Boolean).length === 0) {
    sh.getRange(1,1,1,cols.length).setValues([cols]);
  }
}

/**
 * One-time migration function to add the hasInternalMarks column to existing Exams sheet
 * Call this function manually in Apps Script editor to update the sheet structure
 */
function addHasInternalMarksColumnToExams() {
  try {
    const sh = _getSheet('Exams');
    const headers = _headers(sh);
    const expectedHeaders = SHEETS.Exams;
    
    // Check if hasInternalMarks column already exists
    if (headers.includes('hasInternalMarks')) {
      return 'hasInternalMarks column already exists';
    }
    
    // Find the position where hasInternalMarks should be inserted (after 'examType')
    const examTypeIndex = headers.indexOf('examType');
    const insertIndex = examTypeIndex !== -1 ? examTypeIndex + 1 : headers.length;
    
    // Insert the hasInternalMarks column header
    sh.insertColumnAfter(insertIndex);
    sh.getRange(1, insertIndex + 1).setValue('hasInternalMarks');
    
    // If there are existing rows, populate hasInternalMarks values based on internalMax
    const lastRow = sh.getLastRow();
    if (lastRow > 1) {
      // Get the updated headers after adding the column
      const newHeaders = _headers(sh);
      const internalMaxIndex = newHeaders.indexOf('internalMax');
      const hasInternalMarksIndex = newHeaders.indexOf('hasInternalMarks');
      
      // Read all data to determine hasInternalMarks values
      const dataRange = sh.getRange(2, 1, lastRow - 1, newHeaders.length);
      const data = dataRange.getValues();
      
      // Update each row's hasInternalMarks based on internalMax value
      const updatedData = data.map(row => {
        const internalMax = Number(row[internalMaxIndex]) || 0;
        // If internalMax > 0, then hasInternalMarks should be true
        row[hasInternalMarksIndex] = internalMax > 0;
        return row;
      });
      
      // Write the updated data back to the sheet
      dataRange.setValues(updatedData);
      
    }
    
    return `Successfully added hasInternalMarks column to Exams sheet at position ${insertIndex + 1} and populated ${lastRow - 1} rows`;
    
  } catch (error) {
    console.error('Error adding hasInternalMarks column:', error);
    return `Error adding hasInternalMarks column: ${error.message}`;
  }
}

/**
 * Migration function to update ExamMarks sheet structure
 * - Add examType column
 * - Remove ut1, ut2 columns
 * - Ensure ce, te columns exist
 * Call this function manually in Apps Script editor to update the sheet structure
 */
function migrateExamMarksSheetStructure() {
  try {
    const sh = _getSheet('ExamMarks');
    const headers = _headers(sh);
    const expectedHeaders = SHEETS.ExamMarks;
    
    let changes = [];
    
    // Step 1: Add examType column if it doesn't exist
    if (!headers.includes('examType')) {
      // Insert examType after studentName
      const studentNameIndex = headers.indexOf('studentName');
      const insertIndex = studentNameIndex !== -1 ? studentNameIndex + 1 : 7; // Default position
      
      sh.insertColumnAfter(insertIndex);
      sh.getRange(1, insertIndex + 1).setValue('examType');
      changes.push('Added examType column');
      
      // Update headers array for subsequent operations
      headers.splice(insertIndex, 0, 'examType');
    }
    
    // Step 2: Add ce column if it doesn't exist
    if (!headers.includes('ce')) {
      const examTypeIndex = headers.indexOf('examType');
      const insertIndex = examTypeIndex !== -1 ? examTypeIndex + 1 : headers.length;
      
      sh.insertColumnAfter(insertIndex);
      sh.getRange(1, insertIndex + 1).setValue('ce');
      changes.push('Added ce column');
      headers.splice(insertIndex, 0, 'ce');
    }
    
    // Step 3: Add te column if it doesn't exist
    if (!headers.includes('te')) {
      const ceIndex = headers.indexOf('ce');
      const insertIndex = ceIndex !== -1 ? ceIndex + 1 : headers.length;
      
      sh.insertColumnAfter(insertIndex);
      sh.getRange(1, insertIndex + 1).setValue('te');
      changes.push('Added te column');
      headers.splice(insertIndex, 0, 'te');
    }
    
    // Step 4: Remove ut1 column if it exists
    const ut1Index = headers.indexOf('ut1');
    if (ut1Index !== -1) {
      sh.deleteColumn(ut1Index + 1); // +1 because Google Sheets columns are 1-indexed
      changes.push('Removed ut1 column');
      headers.splice(ut1Index, 1);
    }
    
    // Step 5: Remove ut2 column if it exists (check again after ut1 removal)
    const ut2Index = headers.indexOf('ut2');
    if (ut2Index !== -1) {
      sh.deleteColumn(ut2Index + 1);
      changes.push('Removed ut2 column');
      headers.splice(ut2Index, 1);
    }
    
    // Step 6: Check if internal/external columns exist and suggest manual rename
    const internalIndex = headers.indexOf('internal');
    const externalIndex = headers.indexOf('external');
    if (internalIndex !== -1 || externalIndex !== -1) {
      changes.push('MANUAL ACTION NEEDED: Rename "internal" column to "ce" and "external" column to "te" in Google Sheets');
    }
    
    // Step 7: Populate examType for existing rows
    const lastRow = sh.getLastRow();
    if (lastRow > 1 && changes.includes('Added examType column')) {
      // Get exam data to match examIds with examTypes
      const examsSh = _getSheet('Exams');
      const examsHeaders = _headers(examsSh);
      const examsData = _rows(examsSh).map(r => _indexByHeader(r, examsHeaders));
      
      // Create examId -> examType mapping
      const examTypeMap = {};
      examsData.forEach(exam => {
        if (exam.examId && exam.examType) {
          examTypeMap[exam.examId] = exam.examType;
        }
      });
      
      // Update ExamMarks rows with examType
      const updatedHeaders = _headers(sh);
      const examIdIndex = updatedHeaders.indexOf('examId');
      const examTypeIndex = updatedHeaders.indexOf('examType');
      
      if (examIdIndex !== -1 && examTypeIndex !== -1) {
        const dataRange = sh.getRange(2, 1, lastRow - 1, updatedHeaders.length);
        const data = dataRange.getValues();
        
        let updatedCount = 0;
        data.forEach((row, index) => {
          const examId = row[examIdIndex];
          if (examId && examTypeMap[examId]) {
            row[examTypeIndex] = examTypeMap[examId];
            updatedCount++;
          }
        });
        
        if (updatedCount > 0) {
          dataRange.setValues(data);
          changes.push(`Populated examType for ${updatedCount} rows`);
        }
      }
    }
    
    if (changes.length === 0) {
      return 'ExamMarks sheet structure is already up to date';
    }
    
    return `Successfully updated ExamMarks sheet structure:\n- ${changes.join('\n- ')}`;
    
  } catch (error) {
    console.error('Error migrating ExamMarks sheet structure:', error);
    return `Error migrating ExamMarks sheet structure: ${error.message}`;
  }
}

function _rows(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), 1);
  
  // If no data (only header row or empty sheet), return empty array
  if (lastRow < 2) return [];
  
  // Calculate number of rows to fetch properly
  const numRows = lastRow - 1; // We're starting from row 2, so subtract 1 
  
  // Get all data rows (starting from row 2 to lastRow)
  return sh.getRange(2, 1, numRows, lastCol).getValues();
}

function _indexByHeader(row, headers) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function _uuid() {
  return Utilities.getUuid();
}

/**
 * Test function for exam ID generation - can be called manually from Apps Script editor
 */
/**
 * Generate a readable exam ID from exam details
 * Format: ExamType_Class_Subject (e.g., T1_10A_ENG, UT2_9B_MATH)
 */
function _generateExamId(examType, className, subject) {
  // Helper function to abbreviate exam types
  function abbreviateExamType(type) {
    const typeMap = {
      'term 1': 'T1',
      'term1': 'T1', 
      'term 2': 'T2',
      'term2': 'T2',
      'term 3': 'T3',
      'term3': 'T3',
      'unit test 1': 'UT1',
      'unit test1': 'UT1',
      'unit test 2': 'UT2', 
      'unit test2': 'UT2',
      'unit test 3': 'UT3',
      'unit test3': 'UT3',
      'quarterly': 'Q',
      'half yearly': 'HY',
      'annual': 'ANN',
      'revision test': 'RT',
      'model exam': 'ME'
    };
    
    const normalized = (type || '').toLowerCase().trim();
    return typeMap[normalized] || type.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  
  // Helper function to abbreviate subjects
  function abbreviateSubject(subj) {
    const subjectMap = {
      'english': 'ENG',
      'english grammar': 'ENGG',
      'mathematics': 'MATH',
      'maths': 'MATH',
      'science': 'SCI',
      'physics': 'PHY',
      'chemistry': 'CHEM',
      'biology': 'BIO',
      'malayalam': 'MAL',
      'hindi': 'HIN',
      'social science': 'SS',
      'history': 'HIST',
      'geography': 'GEO',
      'computer science': 'CS',
      'it theory': 'ITT',
      'it lab': 'ITL',
      'physical education': 'PE',
      'moral science': 'MS'
    };
    
    const normalized = (subj || '').toLowerCase().trim();
    return subjectMap[normalized] || subj.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  
  // Helper function to clean class name
  function cleanClassName(cls) {
    // Extract just the class and section (e.g., "STD 10A" -> "10A")
    const match = (cls || '').match(/(\d+[A-Z]?)/i);
    return match ? match[1].toUpperCase() : cls.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  
  const examTypeAbbr = abbreviateExamType(examType);
  const classAbbr = cleanClassName(className);
  const subjectAbbr = abbreviateSubject(subject);
  
  return `${examTypeAbbr}_${classAbbr}_${subjectAbbr}`;
}

/**
 * Check if an exam ID already exists and generate a unique one if needed
 */
function _generateUniqueExamId(examType, className, subject) {
  const baseId = _generateExamId(examType, className, subject);
  const sh = _getSheet('Exams');
  const headers = _headers(sh);
  const examIdIndex = headers.indexOf('examId');
  
  if (examIdIndex === -1) {
    return baseId; // No existing exams
  }
  
  // Get all existing exam IDs
  const data = sh.getDataRange().getValues();
  const existingIds = data.slice(1).map(row => row[examIdIndex]).filter(Boolean);
  
  // If base ID doesn't exist, use it
  if (!existingIds.includes(baseId)) {
    return baseId;
  }
  
  // If it exists, add a suffix
  let counter = 1;
  let uniqueId = `${baseId}_${counter}`;
  while (existingIds.includes(uniqueId)) {
    counter++;
    uniqueId = `${baseId}_${counter}`;
  }
  
  return uniqueId;
}

function _todayISO() {
  const tz = Session.getScriptTimeZone();
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function _dayName(isoDate) {
  // Use Utilities.formatDate to compute the day name in the script's timezone
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE');
  } catch (e) {
    // Fallback: attempt a simple Date conversion
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

/**
 * Normalize a day name (or abbreviation) to the full English weekday name
 * e.g. 'fri', 'FRIDAY', ' friday ' -> 'Friday'. Returns empty string for falsy input.
 */
function _normalizeDayName(input) {
  if (!input && input !== 0) return '';
  const s = String(input).trim().toLowerCase();
  if (!s) return '';
  const map = {
    'mon': 'Monday', 'monday': 'Monday',
    'tue': 'Tuesday', 'tues': 'Tuesday', 'tuesday': 'Tuesday',
    'wed': 'Wednesday', 'weds': 'Wednesday', 'wednesday': 'Wednesday',
    'thu': 'Thursday', 'thurs': 'Thursday', 'thursday': 'Thursday',
    'fri': 'Friday', 'friday': 'Friday',
    'sat': 'Saturday', 'saturday': 'Saturday',
    'sun': 'Sunday', 'sunday': 'Sunday'
  };
  if (map[s]) return map[s];
  // As a fallback, capitalize first letter of trimmed string
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Normalize any date-like value to ISO yyyy-MM-dd.
 * Falls back to string if parsing fails.
 */
function _isoDateString(date) {
  if (!date) return '';
  
  // If it's already a clean YYYY-MM-DD string, return as-is without any processing
  const dateStr = String(date).trim();
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  let d;
  if (typeof date === 'string') {
    // Handle various date string formats
    if (date.includes('T') || date.includes('Z')) {
      // This is an ISO timestamp, parse it
      d = new Date(date);
    } else if (date.includes('-') && date.split('-').length === 3) {
      // This looks like YYYY-MM-DD format - but still need to validate
      const parts = date.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD format - Return directly without timezone conversion
        // This avoids timezone issues when dates are stored as strings
        const normalized = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        // Validate it's a real date
        const testDate = new Date(`${normalized}T00:00:00`);
        if (!isNaN(testDate.getTime())) {
          return normalized;
        }
      }
      // Fall through to regular parsing if validation fails
      d = new Date(date);
    } else {
      // Parse as regular date
      d = new Date(date);
    }
  } else if (date instanceof Date) {
    d = date;
  } else {
    // Try to convert whatever we got
    d = new Date(date);
  }
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return String(date || '');
  }
  
  // CRITICAL: For Date objects, we need to handle the IST timezone context
  // Google Sheets stores dates as Date objects at 18:30 UTC (which is midnight IST the next day)
  // We should interpret these as LOCAL dates (IST), not UTC dates
  
  // Check if this looks like a midnight-ish time in IST (stored as 18:30-19:00 UTC prev day)
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  
  // If time is 18:00-19:59 UTC (which maps to 23:30-01:29 IST), this is likely a date stored in IST context
  // Add 5.5 hours to convert from UTC to IST and use that date
  if (utcHours >= 18 && utcHours < 20) {
    // This is likely stored as IST midnight (which is 18:30 UTC previous day)
    // Use IST interpretation by adding 5.5 hours
    const istTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Otherwise use UTC date (for timestamps that are clearly not date-only values)
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Determine a grade standard group string for a class name.
 * Examples: "Std 3A" -> "Std 1-4", "10A" -> "Std 9-12".
 * This is a simple heuristic so grade boundaries lookup can select
 * the appropriate group. Returns empty string if unknown.
 */
function _standardGroup(cls) {
  if (!cls) return '';
  try {
    // extract the first number found in the class string
    const m = String(cls).match(/(\d+)/);
    if (!m) return '';
    const n = Number(m[1]);
    if (isNaN(n)) return '';
    if (n <= 4) return 'Std 1-4';
    if (n <= 8) return 'Std 5-8';
    return 'Std 9-12';
  } catch (e) {
    return '';
  }
}

/**
 * Determine if a class should have internal marks (CE/TE system)
 * Only STD 8, STD 9, and STD 10 have internal marks
 * Returns true for standards 8, 9, 10; false for standards 1-7
 */
function _classHasInternalMarks(cls) {
  if (!cls) return false;
  try {
    // Extract the first number found in the class string
    const m = String(cls).match(/(\d+)/);
    if (!m) return false;
    const n = Number(m[1]);
    if (isNaN(n)) return false;
    // Only standards 8, 9, and 10 have internal marks (CE and TE)
    return n >= 8 && n <= 10;
  } catch (e) {
    return false;
  }
}

/**
 * Setup standard grade types for Terms 1, 2, and 3
 * This function ensures the GradeTypes sheet has proper configurations
 * for the three standard exam terms with appropriate internal/external marks
 * Call this function manually to initialize grade types
 */
function setupStandardGradeTypes() {
  try {
    const sh = _getSheet('GradeTypes');
    _ensureHeaders(sh, SHEETS.GradeTypes);
    
    const headers = _headers(sh);
    const existingData = _rows(sh).map(r => _indexByHeader(r, headers));
    
    // Standard grade type configurations
    const standardGradeTypes = [
      // For STD 8, 9, 10 (with internal marks - CE and TE)
      { examType: 'Term 1', internalMax: 20, externalMax: 80, totalMax: 100 },
      { examType: 'Term 2', internalMax: 20, externalMax: 80, totalMax: 100 },
      { examType: 'Term 3', internalMax: 20, externalMax: 80, totalMax: 100 },
      
      // For STD 1-7 (no internal marks - only external/total)
      { examType: 'Term 1 (Primary)', internalMax: 0, externalMax: 100, totalMax: 100 },
      { examType: 'Term 2 (Primary)', internalMax: 0, externalMax: 100, totalMax: 100 },
      { examType: 'Term 3 (Primary)', internalMax: 0, externalMax: 100, totalMax: 100 }
    ];
    
    let addedCount = 0;
    
    // Add grade types that don't already exist
    for (const gradeType of standardGradeTypes) {
      const exists = existingData.some(g => String(g.examType || '').trim() === gradeType.examType);
      if (!exists) {
        sh.appendRow([
          gradeType.examType,
          gradeType.internalMax,
          gradeType.externalMax,
          gradeType.totalMax
        ]);
        addedCount++;
      }
    }
    
    return `Setup complete. Added ${addedCount} new grade types. Total grade types: ${existingData.length + addedCount}`;
    
  } catch (error) {
    return `Error setting up grade types: ${error.message}`;
  }
}

/**
 * Convert a date string (yyyy-mm-dd) to day of week name
 * Returns full day name (e.g., "Monday", "Tuesday", etc.)
 */
function _getDayOfWeek(dateString) {
  try {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  } catch (e) {
    return '';
  }
}

/**
 * CORS helper function for JSON responses
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Calculate grade based on percentage using GradeBoundaries sheet
 * @param {number} percentage - The percentage score (0-100)
 * @param {string} className - The class name to determine standard group
 * @returns {string} - The grade letter (A+, A, B, etc.)
 */
function _calculateGradeFromBoundaries(percentage, className) {
  try {
    const stdGroup = _standardGroup(className);
    
    if (!stdGroup) {
      // Fallback if no standard group can be determined
      return _calculateGradeFallback(percentage);
    }

    const gbSh = _getSheet('GradeBoundaries');
    _ensureHeaders(gbSh, SHEETS.GradeBoundaries);
    const gbHeaders = _headers(gbSh);
    
    const boundaries = _rows(gbSh).map(r => _indexByHeader(r, gbHeaders))
      .filter(b => {
        const sheetGroup = String(b.standardGroup || '').trim();
        // Handle both hyphen and en-dash formats
        const normalizedSheetGroup = sheetGroup.replace(/[–—−]/g, '-'); // Replace en-dash, em-dash, minus with hyphen
        const normalizedStdGroup = stdGroup.replace(/[–—−]/g, '-');
        return normalizedSheetGroup === normalizedStdGroup;
      })
      .map(b => ({
        grade: String(b.grade || ''),
        minPercentage: Number(b.minPercentage || 0),
        maxPercentage: Number(b.maxPercentage || 0)
      }))
      .sort((a, b) => b.minPercentage - a.minPercentage); // Sort descending

    // Find the appropriate grade boundary
    for (const boundary of boundaries) {
      if (percentage >= boundary.minPercentage && percentage <= boundary.maxPercentage) {
        return boundary.grade;
      }
    }

    // If no boundary found, return lowest grade or fallback
    return boundaries.length > 0 ? boundaries[boundaries.length - 1].grade : _calculateGradeFallback(percentage);
  } catch (error) {
    Logger.log('Error calculating grade from boundaries: ' + error);
    return _calculateGradeFallback(percentage);
  }
}

/**
 * Fallback grade calculation (used when GradeBoundaries is not available)
 * @param {number} percentage - The percentage score (0-100) 
 * @returns {string} - The grade letter
 */
function _calculateGradeFallback(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 35) return 'D';
  return 'F';
}



function _respond(obj, status) {
  // Try to use the CORS helper if available
  try {
    if (typeof jsonResponse === 'function') {
      return jsonResponse(obj);
    }
  } catch (e) {
    // If jsonResponse isn't defined yet, fall back to basic response
  }
  
  // Default response without CORS headers
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _parsePost(e) {
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (err) {}
  return {};
}

/**
 * Initialize proper Indian school grade boundaries if they don't exist
 * Call this function manually to set up grade boundaries for different standards
 */
function initializeGradeBoundaries() {
  const sh = _getSheet('GradeBoundaries');
  _ensureHeaders(sh, SHEETS.GradeBoundaries);
  
  // Check if data already exists
  const existingData = _rows(sh);
  if (existingData.length > 0) {
    Logger.log('Grade boundaries already exist');
    return 'Grade boundaries already exist';
  }
  
  // Define proper Indian school grade boundaries
  const gradeBoundaries = [
    // Standards 1-4 (Elementary) - Simple grading
    { standardGroup: 'Std 1-4', grade: 'Excellent', minPercentage: 90, maxPercentage: 100 },
    { standardGroup: 'Std 1-4', grade: 'Very Good', minPercentage: 80, maxPercentage: 89 },
    { standardGroup: 'Std 1-4', grade: 'Good', minPercentage: 70, maxPercentage: 79 },
    { standardGroup: 'Std 1-4', grade: 'Satisfactory', minPercentage: 60, maxPercentage: 69 },
    { standardGroup: 'Std 1-4', grade: 'Needs Improvement', minPercentage: 35, maxPercentage: 59 },
    { standardGroup: 'Std 1-4', grade: 'Unsatisfactory', minPercentage: 0, maxPercentage: 34 },
    
    // Standards 5-8 (Middle School) - Grade points
    { standardGroup: 'Std 5-8', grade: 'A1', minPercentage: 91, maxPercentage: 100 },
    { standardGroup: 'Std 5-8', grade: 'A2', minPercentage: 81, maxPercentage: 90 },
    { standardGroup: 'Std 5-8', grade: 'B1', minPercentage: 71, maxPercentage: 80 },
    { standardGroup: 'Std 5-8', grade: 'B2', minPercentage: 61, maxPercentage: 70 },
    { standardGroup: 'Std 5-8', grade: 'C1', minPercentage: 51, maxPercentage: 60 },
    { standardGroup: 'Std 5-8', grade: 'C2', minPercentage: 41, maxPercentage: 50 },
    { standardGroup: 'Std 5-8', grade: 'D', minPercentage: 33, maxPercentage: 40 },
    { standardGroup: 'Std 5-8', grade: 'E', minPercentage: 0, maxPercentage: 32 },
    
    // Standards 9-12 (High School) - Traditional letter grades
    { standardGroup: 'Std 9-12', grade: 'A+', minPercentage: 95, maxPercentage: 100 },
    { standardGroup: 'Std 9-12', grade: 'A', minPercentage: 85, maxPercentage: 94 },
    { standardGroup: 'Std 9-12', grade: 'B+', minPercentage: 75, maxPercentage: 84 },
    { standardGroup: 'Std 9-12', grade: 'B', minPercentage: 65, maxPercentage: 74 },
    { standardGroup: 'Std 9-12', grade: 'C+', minPercentage: 55, maxPercentage: 64 },
    { standardGroup: 'Std 9-12', grade: 'C', minPercentage: 45, maxPercentage: 54 },
    { standardGroup: 'Std 9-12', grade: 'D', minPercentage: 35, maxPercentage: 44 },
    { standardGroup: 'Std 9-12', grade: 'F', minPercentage: 0, maxPercentage: 34 }
  ];
  
  // Add the data to the sheet
  gradeBoundaries.forEach(boundary => {
    sh.appendRow([
      boundary.standardGroup,
      boundary.grade,
      boundary.minPercentage,
      boundary.maxPercentage
    ]);
  });
  
  Logger.log('Grade boundaries initialized successfully');
  return 'Grade boundaries initialized successfully';
}

/**
 * ====== Data Model ======
 * Sheets and expected columns
 */
const SHEETS = {
  // NOTE: Added 'password' as third column to align with UserManagement.gs addUser() logic
  Users: ['email','name','password','roles','classes','subjects','classTeacherFor'],
  // Settings: simple key/value configuration used by the frontend (e.g., lessonPlanningDay)
  // Example rows:
  //   key                | value
  //   lessonPlanningDay  | Friday
  //   allowNextWeekOnly  | true
  //   periodTimes        | [{"period":1,"start":"08:30","end":"09:15"}, ...]
  Settings: ['key','value'],
  // Timetable now uses a weekly repeating schedule.  Each row represents
  // a period on a particular day of the week for a specific class and teacher.
  // Columns: class – the class name; dayOfWeek – the day name (e.g. Monday);
  // period – the period number; subject – subject taught; teacherEmail – email
  // address used to match against logged‑in teacher; teacherName – optional
  // display name for reference.  When computing weekly timetables we map the
  // upcoming seven calendar dates to their dayOfWeek and return matching rows.
  Timetable: ['class','dayOfWeek','period','subject','teacherEmail','teacherName'],
  Schemes: ['schemeId','teacherEmail','teacherName','class','subject','term','unit','chapter','month','noOfSessions','status','createdAt'],
  LessonPlans: ['lpId','teacherEmail','teacherName','class','subject','chapter','session','objectives','activities','status','reviewerRemarks','date','createdAt'],
  DailyReports: ['date','teacherEmail','teacherName','class','subject','period','planType','lessonPlanId','chapter','objectives','activities','completed','notes','createdAt'],
  Substitutions: ['date','period','class','absentTeacher','regularSubject','substituteTeacher','substituteSubject','note','createdAt'],
  CalendarEvents: ['eventId','userEmail','title','startTime','endTime','class','subject','notes','type','color','allDay','createdAt'],
  // LessonProgress: tracks the actual progress of lesson plans and scheme sessions
  // Columns: progressId - unique ID; schemeId - reference to parent scheme;
  //   lpId - reference to lesson plan; teacherEmail, teacherName, class, subject;
  //   chapter - chapter/topic; session - planned session number;
  //   plannedDate - originally planned date; actualDate - actual completion date;
  //   status - 'Pending', 'InProgress', 'Completed', 'Delayed', 'Skipped';
  //   delayDays - number of days delayed from planned date;
  //   completionPercentage - 0-100% how much was completed;
  //   notes - teacher's notes about progress/delays; createdAt, updatedAt
  LessonProgress: ['progressId','schemeId','lpId','teacherEmail','teacherName','class','subject','chapter','session','plannedDate','actualDate','status','delayDays','completionPercentage','notes','createdAt','updatedAt']
  ,
  // Exams: metadata for each exam created by the headmaster or authorized staff.
  // Columns: examId – unique ID; creatorEmail – the email of the user who created
  //   the exam; creatorName – the name of the creator; class – the class for which
  //   the exam is conducted; subject – the subject; examType – e.g. Midterm,
  //   Final, Quiz; hasInternalMarks – boolean flag if exam has internal marks;
  //   internalMax – maximum marks for the internal component;
  //   externalMax – maximum marks for the external component; totalMax – the
  //   total marks (internalMax + externalMax); date – the exam date; createdAt –
  //   timestamp of record creation; examName - descriptive name in format "ExamType - Class - Subject".
  Exams: ['examId','creatorEmail','creatorName','class','subject','examType','hasInternalMarks','internalMax','externalMax','totalMax','date','createdAt','examName'],
  // ExamMarks: stores individual student marks for a given exam.  Columns:
  //   examId – reference to Exams.examId; class – class name; subject – subject;
  //   teacherEmail – email of the teacher submitting marks; teacherName – their name;
  //   admNo – student admission number; studentName – student name;
  //   examType – type of exam (from parent Exams table) for easy report grouping;
  //   ce – continuous evaluation marks (internal); te – terminal evaluation marks (external);
  //   total – computed total marks (ce + te); grade – calculated letter grade; createdAt – timestamp of record creation.
  //   NOTE: Removed ut1, ut2 as unit tests should be separate exam entries
  //   NOTE: ce = internal, te = external (no need for separate internal/external columns)
  ExamMarks: ['examId','class','subject','teacherEmail','teacherName','admNo','studentName','examType','ce','te','total','grade','createdAt']
  ,
  // Students: a master list of students with their admission number, name, class
  // assignment and optional contact details.  This sheet is used to populate
  // class rosters and performance reports.
  Students: ['admNo','name','class','email','parentContact'],
  // GradeTypes: defines exam grading schemes.  Each row specifies the exam type
  // and the maximum internal and external marks as well as the computed total.
  GradeTypes: ['examType','internalMax','externalMax','totalMax'],
  // Attendance: daily attendance records for each student.  Columns store the
  // date, class, student admission number and name, present/absent status,
  // and the teacher who recorded the attendance.
  Attendance: ['date','class','admNo','studentName','status','teacherEmail','teacherName','createdAt']
  ,
  // GradeBoundaries: defines percentage ranges for letter grades per standard group.
  // Each row specifies the standardGroup (e.g. "Std 1-4"), the grade label (e.g. "A"),
  // and the minimum and maximum percentages for that grade.  These ranges are used
  // when computing exam grades from raw marks.
  GradeBoundaries: ['standardGroup','grade','minPercentage','maxPercentage']
};

/**
 * Ensure all tabs exist with headers
 */
function _bootstrapSheets() {
  Object.keys(SHEETS).forEach(name => {
    const sh = _getSheet(name);
    _ensureHeaders(sh, SHEETS[name]);
  });
}

/**
 * ====== Public Web App ======
 */
function doGet(e) {
  const action = (e.parameter.action || '').trim();
  try {
    _bootstrapSheets();
    
    if (action === 'ping') {
      // Use jsonResponse directly if available
      try {
        if (typeof jsonResponse === 'function') {
          return jsonResponse({ ok: true, now: new Date().toISOString() });
        }
      } catch (e) {
        // Fall back to _respond if jsonResponse isn't available
      }
      return _respond({ ok: true, now: new Date().toISOString() });
    }

    if (action === 'login') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const password = (e.parameter.password || '').trim();
      const sh = _getSheet('Users');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      const found = list.find(u => String(u.email||'').toLowerCase() === email);
      if (!found) return _respond({ error: 'User not found' });
      
      // Verify password (you can add hashing here for security)
      if (password && String(found.password || '') !== '') {
        // Hash the input password to compare with stored hash
        const hashedInput = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
        if (hashedInput !== String(found.password || '')) {
          return _respond({ error: 'Invalid password' });
        }
      }
      // Normalize role, classes and subjects.  Support both lowercase
      // field names (roles, classes, subjects) and the singular/Title case
      // versions used in some spreadsheets (Role, Class, Classes, Subject, Subjects).
      const roleStr = (found.roles || found.role || '').toString();
      const roles = roleStr.split(',').map(s => s.trim()).filter(Boolean);
      const classStr = (found.classes || found.Class || found.Classes || '').toString();
      const classes = classStr.split(',').map(s => s.trim()).filter(Boolean);
      const subjStr = (found.subjects || found.Subject || found.Subjects || '').toString();
      const subjects = subjStr.split(',').map(s => s.trim()).filter(Boolean);
      const classTeacherFor = found.classTeacherFor || found['Class Teacher For'] || '';
      return _respond({ 
        name: found.name || '',
        email: found.email || '',
        roles,
        classes,
        subjects,
        classTeacherFor
      });
    }
    
    // Fallback GET handler for googleLogin (primarily for troubleshooting / legacy)
    if (action === 'googleLogin') {
      // Handle ID token authentication
      if (e.parameter.idToken) {
        return _handleGoogleLogin({ idToken: e.parameter.idToken });
      }
      // Handle email-based authentication
      else if (e.parameter.email) {
        return _handleGoogleLogin({ 
          email: e.parameter.email,
          google_id: e.parameter.google_id || 'email_auth', // Placeholder for email-only auth
          name: e.parameter.name || '',
          picture: e.parameter.picture || ''
        });
      }
      else {
        return _respond({ error: 'Missing idToken or email parameter' });
      }
    }

    // Fallback GET handler for googleLogin (primarily for troubleshooting / legacy).
    // Prefer POST for security, but allow GET with idToken parameter so the
    // client can retry when POST returns 404 (e.g. stale deployment without doPost).
    if (action === 'googleLogin' && e.parameter.idToken) {
      return _handleGoogleLogin({ idToken: e.parameter.idToken });
    }
    
    // Get a centralized list of all subjects from all data sources
    if (action === 'getSubjects') {
      // Get subjects from timetable
      const ttSheet = _getSheet('Timetable');
      const ttHeaders = _headers(ttSheet);
      const ttList = _rows(ttSheet).map(r => _indexByHeader(r, ttHeaders));
      const timetableSubjects = ttList.map(x => String(x.subject || '')).filter(Boolean);
      
      // Get subjects from exams 
      const exSheet = _getSheet('Exams');
      const exHeaders = _headers(exSheet);
      const exList = _rows(exSheet).map(r => _indexByHeader(r, exHeaders));
      const examSubjects = exList.map(x => String(x.subject || '')).filter(Boolean);
      
      // Get subjects from schemes
      const schSheet = _getSheet('Schemes');
      const schHeaders = _headers(schSheet);
      const schList = _rows(schSheet).map(r => _indexByHeader(r, schHeaders));
      const schemeSubjects = schList.map(x => String(x.subject || '')).filter(Boolean);
      
      // Get subjects from lesson plans
      const lpSheet = _getSheet('LessonPlans');
      const lpHeaders = _headers(lpSheet);
      const lpList = _rows(lpSheet).map(r => _indexByHeader(r, lpHeaders));
      const lessonPlanSubjects = lpList.map(x => String(x.subject || '')).filter(Boolean);
      
      // Merge all subjects and deduplicate
      const allSubjectsSet = new Set([
        ...timetableSubjects,
        ...examSubjects, 
        ...schemeSubjects,
        ...lessonPlanSubjects
      ]);
      
      // Enhanced: Add mapped subjects for exam creation
      const enhancedSubjects = new Set(allSubjectsSet);
      
      allSubjectsSet.forEach(subject => {
        // Add exam-specific subjects for broad timetable subjects
        getExamSubjectsFromTimetableSubject(subject).forEach(mappedSubject => {
          enhancedSubjects.add(mappedSubject);
        });
      });
      
      const subjects = Array.from(enhancedSubjects).sort();
      
      return _respond({ subjects });
    }

    /**
     * Map timetable subjects to specific exam subjects
     * Handles cases where timetable shows broad subjects (e.g., "Social") 
     * but exams need specific subjects (e.g., "History", "Geography")
     */
    function getExamSubjectsFromTimetableSubject(timetableSubject) {
      const subjectMappings = {
        'Malayalam': ['Mal 1', 'Mal 2'],
        'Social': ['History', 'Geography'],
        'Social Science': ['History', 'Geography'],
        'Science': ['Physics', 'Chemistry', 'Biology'],
        'English': ['English Literature', 'English Grammar'],
        // Add more mappings as needed
      };
      
      const subject = String(timetableSubject || '').trim();
      return subjectMappings[subject] || [subject];
    }

    if (action === 'getTeacherWeeklyTimetable') {
      // Weekly timetable: map the upcoming 7 calendar days to their day names
      // and return periods based on the dayOfWeek column.  Because the timetable
      // repeats weekly, we do not store specific dates in the sheet.  Instead,
      // we compute the day name (e.g. Monday) for each of the next seven days
      // starting from today and fetch matching rows for the logged‑in teacher.
      // Accept either teacher email or display name as the identifier.
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      const days = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() + i * 24 * 3600 * 1000);
        const iso = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const dayName = Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE');
        days.push({ date: iso, dayName });
      }
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      const list = _rows(sh)
        .map(r => _indexByHeader(r, headers))
        .filter(r => {
          const te = String(r.teacherEmail || '').toLowerCase();
          const tn = String(r.teacherName || '').toLowerCase();
          return identifier && (te === identifier || tn === identifier);
        });
      const grouped = days.map(({ date, dayName }) => {
        const normalizedDay = _normalizeDayName(dayName);
        const periods = list
          .filter(x => _normalizeDayName(String(x.dayOfWeek || '')) === normalizedDay)
          .map(x => ({
            period: Number(x.period),
            class: String(x.class || ''),
            subject: String(x.subject || ''),
            teacherName: String(x.teacherName || '')
          }))
          .sort((a, b) => a.period - b.period);
        return { day: dayName, date, periods };
      });
      return _respond(grouped);
    }

    if (action === 'getAppSettings') {
      // Read key/value settings and return normalized object
      const sh = _getSheet('Settings');
      _ensureHeaders(sh, SHEETS.Settings);
      const headers = _headers(sh);
      const rows = _rows(sh).map(r => _indexByHeader(r, headers));
      const map = {};
      rows.forEach(r => {
        const k = String(r.key || '').trim();
        if (!k) return;
        map[k] = r.value;
      });

      // Normalize types and provide sensible defaults
  // lessonPlanningDay: if unset in Settings, return empty (no restriction on client)
  const lessonPlanningDay = _normalizeDayName(map.lessonPlanningDay);
  // allowNextWeekOnly: default to false unless explicitly set to 'true'
  const allowNextWeekOnly = String(map.allowNextWeekOnly || '').toLowerCase() === 'true';

      // periodTimes may be a JSON string; attempt to parse if present
      let periodTimes = null;
      if (map.periodTimes && typeof map.periodTimes === 'string') {
        try {
          const parsed = JSON.parse(map.periodTimes);
          if (Array.isArray(parsed)) periodTimes = parsed;
        } catch (e) {
          // leave as null if parsing fails
        }
      }

      return _respond({ settings: { lessonPlanningDay, allowNextWeekOnly, periodTimes } });
    }

    if (action === 'getTeacherDailyTimetable') {
      // Daily timetable for weekly schedule: compute the day name from the
      // provided date (or today) and return all periods matching that dayOfWeek.
      // Accept either teacher email or display name as the identifier.
      // ALSO include substitution assignments where this teacher is the substitute.
      const identifier = (e.parameter.email || '').toLowerCase().trim();
      const date = (e.parameter.date || _todayISO()).trim();
      // Get the day name for the supplied date in the script's timezone.
      const dayName = _dayName(date);
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      
      // Get regular timetable periods
      const allRows = _rows(sh);
      const regularPeriods = allRows
        .map(r => _indexByHeader(r, headers))
        .filter(r => {
          const te = String(r.teacherEmail || '').toLowerCase();
          const tn = String(r.teacherName || '').toLowerCase();
          const rowDay = _normalizeDayName(String(r.dayOfWeek || ''));
          const normalizedDayName = _normalizeDayName(dayName);
          return identifier && (te === identifier || tn === identifier) && rowDay === normalizedDayName;
        })
        .map(x => ({
          period: Number(x.period),
          class: x.class,
          subject: x.subject,
          teacherName: x.teacherName || '',
          isSubstitution: false
        }));
      
      // Get substitution assignments where this teacher is the substitute
      const subSh = _getSheet('Substitutions');
      const subHeaders = _headers(subSh);
      const substitutionPeriods = _rows(subSh)
        .map(r => _indexByHeader(r, subHeaders))
        .filter(r => {
          if (_isoDateString(r.date) !== _isoDateString(date)) return false;
          const ste = String(r.substituteTeacher || '').toLowerCase();
          return identifier && (ste === identifier || ste.indexOf(identifier) !== -1);
        })
        .map(x => ({
          period: Number(x.period),
          class: String(x.class || ''),
          subject: String(x.substituteSubject || x.regularSubject || ''),
          teacherName: String(x.substituteTeacher || ''),
          isSubstitution: true,
          absentTeacher: String(x.absentTeacher || ''),
          regularSubject: String(x.regularSubject || '')
        }));
      
      // Combine regular and substitution periods, sort by period
      const allPeriods = [...regularPeriods, ...substitutionPeriods].sort((a, b) => a.period - b.period);
      
      // Debug information
      const debugInfo = {
        searchIdentifier: identifier,
        searchDate: date,
        dayName: dayName,
        normalizedDayName: _normalizeDayName(dayName),
        totalTimetableRows: allRows.length,
        regularPeriodsFound: regularPeriods.length,
        substitutionPeriodsFound: substitutionPeriods.length
      };
      
      return _respond({ 
        identifier, 
        date, 
        dayName,
        periods: allPeriods,
        debug: debugInfo
      });
    }

    if (action === 'getTeacherLessonPlanFilters') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(r => String(r.teacherEmail||'').toLowerCase() === email);
      const subjects = Array.from(new Set(list.map(x => String(x.subject||'')).filter(Boolean))).sort();
      const classes = Array.from(new Set(list.map(x => String(x.class||'')).filter(Boolean))).sort();
      return _respond({ subjects, classes });
    }

    if (action === 'getTeacherLessonPlans') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const subject = (e.parameter.subject || '').trim();
      const cls = (e.parameter['class'] || '').trim();
      const status = (e.parameter.status || '').trim();
      const search = (e.parameter.search || '').toLowerCase().trim();
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.teacherEmail||'').toLowerCase() === email);
      if (subject) list = list.filter(p => p.subject === subject);
      if (cls) list = list.filter(p => p.class === cls);
      if (status) list = list.filter(p => p.status === status);
      if (search) list = list.filter(p => String(p.chapter||'').toLowerCase().indexOf(search) !== -1);
      // normalize
      list = list.map(p => ({
        lpId: String(p.lpId),
        class: String(p.class),
        subject: String(p.subject),
        chapter: String(p.chapter),
        session: Number(p.session),
        status: String(p.status||''),
        objectives: String(p.objectives||''),
        activities: String(p.activities||'')
      }));
      return _respond(list);
    }

    if (action === 'getPendingPlans') {
      const page = Number(e.parameter.page || 1);
      const pageSize = Number(e.parameter.pageSize || 10);
      const teacher = (e.parameter.teacher || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const month = (e.parameter.month || '').trim();

      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.status || 'Pending') === 'Pending');
      if (teacher) list = list.filter(p => String(p.teacherEmail||'').toLowerCase() === teacher || String(p.teacherName||'').toLowerCase().indexOf(teacher) !== -1);
      if (cls) list = list.filter(p => p.class === cls);
      if (subject) list = list.filter(p => p.subject === subject);
      if (month) list = list.filter(p => p.month === month);
      const totalCount = list.length;
      const start = (page-1)*pageSize;
      const end = start + pageSize;
      const pageItems = list.slice(start, end).map(p => ({
        schemeId: String(p.schemeId),
        teacherName: String(p.teacherName||''),
        class: String(p.class||''),
        subject: String(p.subject||''),
        chapter: String(p.chapter||''),
        month: String(p.month||''),
        noOfSessions: Number(p.noOfSessions||0),
        status: String(p.status || 'Pending')
      }));
      return _respond({ plans: pageItems, totalCount, page, pageSize });
    }

    if (action === 'getAllPlans') {
      const page = Number(e.parameter.page || 1);
      const pageSize = Number(e.parameter.pageSize || 10);
      const teacher = (e.parameter.teacher || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const status = (e.parameter.status || '').trim();
      const month = (e.parameter.month || '').trim();

      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers));
      
      // Filter by status only if specified
      if (status) {
        list = list.filter(p => String(p.status || 'Pending') === status);
      }
      
      if (teacher) list = list.filter(p => String(p.teacherEmail||'').toLowerCase() === teacher || String(p.teacherName||'').toLowerCase().indexOf(teacher) !== -1);
      if (cls) list = list.filter(p => p.class === cls);
      if (subject) list = list.filter(p => p.subject === subject);
      if (month) list = list.filter(p => p.month === month);
      const totalCount = list.length;
      const start = (page-1)*pageSize;
      const end = start + pageSize;
      const pageItems = list.slice(start, end).map(p => ({
        schemeId: String(p.schemeId),
        teacherName: String(p.teacherName||''),
        class: String(p.class||''),
        subject: String(p.subject||''),
        chapter: String(p.chapter||''),
        month: String(p.month||''),
        noOfSessions: Number(p.noOfSessions||0),
        status: String(p.status || 'Pending')
      }));
      return _respond({ plans: pageItems, totalCount, page, pageSize });
    }

    if (action === 'getAllSchemes') {
      // Same as getAllPlans but only returns schemes, not lesson plans
      const page = Number(e.parameter.page || 1);
      const pageSize = Number(e.parameter.pageSize || 10);
      const teacher = (e.parameter.teacher || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const status = (e.parameter.status || '').trim();
      const month = (e.parameter.month || '').trim();

      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers));
      
      // Filter by status only if specified
      if (status) {
        list = list.filter(p => String(p.status || 'Pending') === status);
      }
      
      if (teacher) list = list.filter(p => String(p.teacherEmail||'').toLowerCase() === teacher || String(p.teacherName||'').toLowerCase().indexOf(teacher) !== -1);
      if (cls) list = list.filter(p => p.class === cls);
      if (subject) list = list.filter(p => p.subject === subject);
      if (month) list = list.filter(p => p.month === month);
      const totalCount = list.length;
      const start = (page-1)*pageSize;
      const end = start + pageSize;
      const pageItems = list.slice(start, end).map(p => ({
        schemeId: String(p.schemeId),
        teacherName: String(p.teacherName||''),
        class: String(p.class||''),
        subject: String(p.subject||''),
        chapter: String(p.chapter||''),
        month: String(p.month||''),
        noOfSessions: Number(p.noOfSessions||0),
        status: String(p.status || 'Pending')
      }));
      return _respond({ plans: pageItems, totalCount, page, pageSize });
    }

    if (action === 'getLessonReviewFilters') {
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      const teachers = Array.from(new Set(list.map(p => p.teacherName).filter(Boolean))).sort();
      const classes = Array.from(new Set(list.map(p => p.class).filter(Boolean))).sort();
      const subjects = Array.from(new Set(list.map(p => p.subject).filter(Boolean))).sort();
      return _respond({ teachers, classes, subjects });
    }

    if (action === 'getPendingLessonReviews') {
      const teacher = (e.parameter.teacher || '').trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const status = (e.parameter.status || 'Pending Review').trim();
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.status||'') === status);
      if (teacher) list = list.filter(p => p.teacherName === teacher);
      if (cls) list = list.filter(p => p.class === cls);
      if (subject) list = list.filter(p => p.subject === subject);
      list = list.map(p => ({
        lpId: String(p.lpId),
        teacherName: String(p.teacherName||''),
        class: String(p.class||''),
        subject: String(p.subject||''),
        chapter: String(p.chapter||''),
        session: Number(p.session||0),
        objectives: String(p.objectives||''),
        activities: String(p.activities||''),
        status: String(p.status||'')
      }));
      return _respond(list);
    }

    if (action === 'getPendingPreparationLessonPlans') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.teacherEmail||'').toLowerCase() === email && String(p.status||'') === 'Pending Preparation')
        .map(p => ({
          lessonPlanId: String(p.lpId),
          class: String(p.class||''),
          subject: String(p.subject||''),
          chapter: String(p.chapter||''),
          session: Number(p.session||0),
          objectives: String(p.objectives||''),
          activities: String(p.activities||'')
        }));
      return _respond(list);
    }

    if (action === 'getApprovedLessonPlansForReport') {
      const email = (e.parameter.email || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.teacherEmail||'').toLowerCase() === email && String(p.status||'') === 'Ready');
      if (cls) list = list.filter(p => p.class === cls);
      if (subject) list = list.filter(p => p.subject === subject);
      list = list.map(p => ({
        lpId: String(p.lpId),
        session: Number(p.session||0),
        chapter: String(p.chapter||''),
        objectives: String(p.objectives||''),
        activities: String(p.activities||'')
      }));
      return _respond(list);
    }

    if (action === 'getAllClasses') {
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      const classes = Array.from(new Set(list.map(x => x.class).filter(Boolean))).sort();
      return _respond(classes);
    }

    if (action === 'getAllSubjects') {
      const subjectsSet = new Set();
      // From Timetable
      try {
        const tSh = _getSheet('Timetable');
        const tHeaders = _headers(tSh);
        const tList = _rows(tSh).map(r => _indexByHeader(r, tHeaders));
        tList.forEach(x => { if (x.subject) subjectsSet.add(String(x.subject)); });
      } catch (e) {}
      // From Schemes
      try {
        const sSh = _getSheet('Schemes');
        const sHeaders = _headers(sSh);
        const sList = _rows(sSh).map(r => _indexByHeader(r, sHeaders));
        sList.forEach(x => { if (x.subject) subjectsSet.add(String(x.subject)); });
      } catch (e) {}
      // From LessonPlans
      try {
        const lSh = _getSheet('LessonPlans');
        const lHeaders = _headers(lSh);
        const lList = _rows(lSh).map(r => _indexByHeader(r, lHeaders));
        lList.forEach(x => { if (x.subject) subjectsSet.add(String(x.subject)); });
      } catch (e) {}
      const subjects = Array.from(subjectsSet).filter(Boolean).sort();
      return _respond(subjects);
    }

  if (action === 'getTeacherDailyReportsForDate') {
      // Return daily report entries for a teacher on a given date.  Each entry
      // includes class, subject, period, planType, lessonPlanId and a
      // status string indicating whether the report has been submitted.
      const email = (e.parameter.email || '').toLowerCase().trim();
      const date = (e.parameter.date || '').trim();
      const sh = _getSheet('DailyReports');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      const filteredList = list.filter(r => String(r.teacherEmail || '').toLowerCase() === email && String(r.date || '') === date)
        .map(r => {
          // Determine if report fields have data to infer submission
          const isSubmitted = String(r.objectives || '').trim() || String(r.activities || '').trim() || String(r.completed || '').trim();
          return {
            class: String(r.class || ''),
            subject: String(r.subject || ''),
            period: Number(r.period || 0),
            planType: String(r.planType || ''),
            lessonPlanId: String(r.lessonPlanId || ''),
            chapter: String(r.chapter || ''),
            status: isSubmitted ? 'Submitted' : 'Not Submitted'
          };
        });
      return _respond(filteredList);
    }

  if (action === 'getDailyReportSummary') {
      const cls = (e.parameter['class'] || '').trim();
      const date = (e.parameter.date || '').trim();
      const sh = _getSheet('DailyReports');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers))
          .filter(r => String(r.class || '') === cls && String(r.date || '') === date)
          .map(r => {
            const submitted = String(r.objectives || '').trim() || String(r.activities || '').trim() || String(r.completed || '').trim();
            return {
              class: String(r.class || ''),
              subject: String(r.subject || ''),
              period: Number(r.period || 0),
              planType: String(r.planType || ''),
              lessonPlanId: String(r.lessonPlanId || ''),
              chapter: String(r.chapter || ''),
              teacherName: String(r.teacherName || ''),
              completed: String(r.completed || ''),
              status: submitted ? 'Submitted' : 'Not Submitted'
            };
          });
      let lines = [`Summary for ${cls} on ${date}`, ''];
      list.forEach(r => {
        lines.push(`P${r.period} ${r.subject} — ${r.teacherName} — ${r.completed || r.status}`);
      });
      return _respond(lines.join('\n'));
    }

    if (action === 'getLessonProgressSummary') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      
      if (!teacherEmail) {
        return _respond({ error: 'Teacher email is required' });
      }
      
      const progressData = getLessonProgressSummary(teacherEmail, cls, subject);
      return _respond(progressData);
    }

    if (action === 'getTeacherLessonDelays') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      
      if (!teacherEmail) {
        return _respond({ error: 'Teacher email is required' });
      }
      
      try {
        const progressSh = _getSheet('LessonProgress');
        const headers = _headers(progressSh);
        const progressEntries = _rows(progressSh).map(r => _indexByHeader(r, headers));
        
        let filtered = progressEntries.filter(p => 
          String(p.teacherEmail || '').toLowerCase() === teacherEmail &&
          (p.status === 'Delayed' || Number(p.delayDays) > 0)
        );
        
        if (cls) filtered = filtered.filter(p => p.class === cls);
        if (subject) filtered = filtered.filter(p => p.subject === subject);
        
        // Sort by delay days (highest first)
        filtered.sort((a, b) => (Number(b.delayDays) || 0) - (Number(a.delayDays) || 0));
        
        const delays = filtered.map(p => ({
          progressId: p.progressId,
          class: p.class,
          subject: p.subject,
          chapter: p.chapter,
          session: p.session,
          plannedDate: p.plannedDate,
          actualDate: p.actualDate,
          delayDays: Number(p.delayDays) || 0,
          status: p.status,
          completionPercentage: Number(p.completionPercentage) || 0,
          notes: p.notes
        }));
        
        return _respond({ delays });
        
      } catch (error) {
        console.error('Error getting lesson delays:', error);
        return _respond({ error: 'Failed to get lesson delays' });
      }
    }

    // HM-specific lesson progress endpoints
    if (action === 'getAllLessonProgressSummary') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      
      try {
        const progressData = getAllLessonProgressSummary(teacherEmail, cls, subject);
        return _respond(progressData);
      } catch (error) {
        console.error('Error getting all lesson progress summary:', error);
        return _respond({ error: 'Failed to get lesson progress summary' });
      }
    }

    if (action === 'getAllTeacherLessonDelays') {
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const cls = (e.parameter.class || '').trim();
      const subject = (e.parameter.subject || '').trim();
      
      try {
        const progressSh = _getSheet('LessonProgress');
        const headers = _headers(progressSh);
        const progressEntries = _rows(progressSh).map(r => _indexByHeader(r, headers));
        
        let filtered = progressEntries.filter(p => {
          const delayDays = Number(p.delayDays) || 0;
          if (delayDays <= 0) return false; // Only show actual delays
          
          let matches = true;
          if (teacherEmail) {
            const pTeacher = String(p.teacherEmail || '').toLowerCase();
            matches = matches && pTeacher.includes(teacherEmail);
          }
          if (cls) matches = matches && (String(p.class || '') === cls);
          if (subject) matches = matches && (String(p.subject || '') === subject);
          
          return matches;
        });
        
        // Sort by delay days (highest first)
        filtered.sort((a, b) => (Number(b.delayDays) || 0) - (Number(a.delayDays) || 0));
        
        const delays = filtered.map(p => ({
          progressId: p.progressId,
          teacherEmail: p.teacherEmail,
          teacherName: p.teacherName || p.teacherEmail,
          class: p.class,
          subject: p.subject,
          chapter: p.chapter,
          session: p.session,
          plannedDate: p.plannedDate,
          actualDate: p.actualDate,
          delayDays: Number(p.delayDays) || 0,
          status: p.status,
          completionPercentage: Number(p.completionPercentage) || 0,
          notes: p.notes
        }));
        
        return _respond({ delays });
        
      } catch (error) {
        console.error('Error getting all teacher lesson delays:', error);
        return _respond({ error: 'Failed to get lesson delays' });
      }
    }

    if (action === 'getAllTeachers') {
      try {
        const usersSh = _getSheet('Users');
        const headers = _headers(usersSh);
        const users = _rows(usersSh).map(r => _indexByHeader(r, headers));
        
        const teachers = users
          .filter(u => {
            const roles = String(u.roles || '').toLowerCase();
            return roles.includes('teacher') || roles.includes('class teacher');
          })
          .map(u => ({
            email: u.email,
            name: u.name || u.email,
            roles: u.roles
          }));
        
        return _respond(teachers);
        
      } catch (error) {
        console.error('Error getting all teachers:', error);
        return _respond({ error: 'Failed to get teachers list' });
      }
    }

    if (action === 'getVacantSlotsForAbsent') {
      const date = (e.parameter.date || '').trim();
      // absents list may contain teacher names or emails (case insensitive)
      const absents = [].concat(e.parameter.absent || []).map(a => String(a).toLowerCase());
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      // Determine the day of week based on the provided date since timetable repeats weekly
      const dayName = _dayName(date);
      const records = _rows(sh).map(r => _indexByHeader(r, headers));
      // Select timetable entries matching the day of week and where the teacher is absent
      const vacant = records
        .filter(r => {
          const rowDay = _normalizeDayName(String(r.dayOfWeek || ''));
          if (rowDay !== _normalizeDayName(dayName)) return false;
          const teacherNameLower = String(r.teacherName || '').toLowerCase();
          const teacherEmailLower = String(r.teacherEmail || '').toLowerCase();
          return absents.indexOf(teacherNameLower) !== -1 || (teacherEmailLower && absents.indexOf(teacherEmailLower) !== -1);
        })
        .map(x => ({
          period: Number(x.period || 0),
          class: String(x.class || ''),
          absentTeacher: String(x.teacherName || ''),
          regularSubject: String(x.subject || '')
        }));
      // Fetch already assigned substitutions for the date from Substitutions sheet
      const subSh = _getSheet('Substitutions');
      const subHeaders = _headers(subSh);
      const assigned = _rows(subSh)
        .map(r => _indexByHeader(r, subHeaders))
        .filter(r => _isoDateString(r.date) === _isoDateString(date));
      return _respond({ date, vacantSlots: vacant, assignedSubstitutions: assigned });
    }

    if (action === 'getPotentialAbsentTeachers') {
      const sh = _getSheet('Users');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      // Return array of { name, email } for better client-side handling
      const persons = Array.from(new Map(list
        .filter(u => u.name)
        .map(u => [String(u.email || '').toLowerCase() || String(u.name || ''), { name: String(u.name || ''), email: String(u.email || '') }])
      ).values());
      // sort by name
      persons.sort((a,b) => a.name.localeCompare(b.name));
      return _respond(persons);
    }

    if (action === 'getFreeTeachers') {
      const date = (e.parameter.date || '').trim();
      const period = Number(e.parameter.period || 0);
      // absents list may contain teacher names or emails (case insensitive)
      const absents = [].concat(e.parameter.absent || []).map(a => String(a).toLowerCase());
      const userSh = _getSheet('Users');
      const userHeaders = _headers(userSh);
      const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));

      const tSh = _getSheet('Timetable');
      const tHeaders = _headers(tSh);
      const dayName = _dayName(date);
      // Determine which teachers have a class at the given day and period
      const dayRecords = _rows(tSh)
        .map(r => _indexByHeader(r, tHeaders))
        .filter(r => _normalizeDayName(String(r.dayOfWeek || '')) === _normalizeDayName(dayName) && Number(r.period || 0) === period);
      // Build a set of busy identifiers (both name and email lowercased) so we can match users by either field
      const busy = new Set();
      dayRecords.forEach(r => {
        const tn = String(r.teacherName || '').toLowerCase();
        const te = String(r.teacherEmail || '').toLowerCase();
        if (tn) busy.add(tn);
        if (te) busy.add(te);
      });
      const free = users.filter(u => {
        const nameLower = String(u.name || '').toLowerCase();
        const emailLower = String(u.email || '').toLowerCase();
        // Exclude teachers who are busy at this slot or are in the absents list (match by name or email)
        const isBusy = (nameLower && busy.has(nameLower)) || (emailLower && busy.has(emailLower));
        const isAbsent = (nameLower && absents.indexOf(nameLower) !== -1) || (emailLower && absents.indexOf(emailLower) !== -1);
        return (nameLower || emailLower) && !isBusy && !isAbsent;
      });
      // Return objects { name, email } for richer client usage
      const persons = free.map(u => ({ name: String(u.name || ''), email: String(u.email || '') })).filter(p => p.name || p.email);
      persons.sort((a,b) => a.name.localeCompare(b.name));
      return _respond(persons);
    }

    if (action === 'getDailyTimetableWithSubstitutions') {
      const date = (e.parameter.date || '').trim();
      // For weekly schedules, compute the day name from the date
      const dayName = _dayName(date);
      const tSh = _getSheet('Timetable');
      const tHeaders = _headers(tSh);
      // Base schedule: rows whose dayOfWeek matches the computed day name
      const base = _rows(tSh)
        .map(r => _indexByHeader(r, tHeaders))
        .filter(r => _normalizeDayName(String(r.dayOfWeek || '')) === _normalizeDayName(dayName));
      const sSh = _getSheet('Substitutions');
      const sHeaders = _headers(sSh);
      const subs = _rows(sSh)
        .map(r => _indexByHeader(r, sHeaders))
        .filter(s => _isoDateString(s.date) === _isoDateString(date));
      const result = base.map(slot => {
        const m = subs.find(s => Number(s.period) === Number(slot.period) && String(s.class) === String(slot.class));
        if (m) {
          return {
            period: Number(slot.period),
            class: String(slot.class),
            teacher: String(m.substituteTeacher || ''),
            subject: String(m.substituteSubject || ''),
            isSubstitution: true
          };
        }
        return {
          period: Number(slot.period),
          class: String(slot.class),
          teacher: String(slot.teacherName || ''),
          subject: String(slot.subject || ''),
          isSubstitution: false
        };
      }).sort((a, b) => a.period - b.period);
      return _respond({ date, timetable: result });
    }

    // Return only assigned substitutions for a specific date
    if (action === 'getAssignedSubstitutions') {
      const date = (e.parameter.date || '').trim();
      const sSh = _getSheet('Substitutions');
      const sHeaders = _headers(sSh);
      const allSubs = _rows(sSh).map(r => _indexByHeader(r, sHeaders));
      
      // More flexible date matching
      const subs = allSubs.filter(s => {
        const subDate = String(s.date || '').trim();
        const targetDate = String(date).trim();
        
        // Try multiple comparison methods
        if (subDate === targetDate) return true;
        if (_isoDateString(subDate) === _isoDateString(targetDate)) return true;
        
        // Also try simple string contains for partial matches
        if (subDate.includes(targetDate) || targetDate.includes(subDate)) return true;
        
        return false;
      });
      
      return _respond({ date, assignedSubstitutions: subs });
    }

    if (action === 'getHmInsights') {
      const sSh = _getSheet('Schemes');
      const sHeaders = _headers(sSh);
      const schemes = _rows(sSh).map(r => _indexByHeader(r, sHeaders));
      const pendingPlanCount = schemes.filter(s => String(s.status||'') === 'Pending').length;

      const lSh = _getSheet('LessonPlans');
      const lHeaders = _headers(lSh);
      const lps = _rows(lSh).map(r => _indexByHeader(r, lHeaders));
      const pendingLessonCount = lps.filter(p => String(p.status||'') === 'Pending Review').length;

      return _respond({ planCount: pendingPlanCount, lessonCount: pendingLessonCount });
    }

    if (action === 'runExamMarksMigration') {
      const result = migrateExamMarksSheetStructure();
      return _respond({ 
        success: true, 
        message: result 
      });
    }

    if (action === 'getAnalyticsData') {
      try {
        // Get data from various sheets to calculate real analytics
        const usersSh = _getSheet('Users');
        const usersHeaders = _headers(usersSh);
        const allUsers = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
        
        const schemesSh = _getSheet('Schemes');
        const schemesHeaders = _headers(schemesSh);
        const allSchemes = _rows(schemesSh).map(r => _indexByHeader(r, schemesHeaders));
        
        const lessonsSh = _getSheet('LessonPlans');
        const lessonsHeaders = _headers(lessonsSh);
        const allLessons = _rows(lessonsSh).map(r => _indexByHeader(r, lessonsHeaders));
        
        const reportsSh = _getSheet('DailyReports');
        const reportsHeaders = _headers(reportsSh);
        const allReports = _rows(reportsSh).map(r => _indexByHeader(r, reportsHeaders));
        
        // Calculate system overview
        const totalUsers = allUsers.filter(u => u.email && u.name).length;
        const pendingSchemes = allSchemes.filter(s => s.status === 'pending').length;
        const pendingLessons = allLessons.filter(l => l.status === 'pending').length;
        const pendingApprovals = pendingSchemes + pendingLessons;
        
        // Calculate active users today (users with activity in last 24 hours)
        const currentDate = new Date();
        const yesterday = new Date(currentDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const todayStr = currentDate.toISOString().split('T')[0];
        
        const activeToday = allUsers.filter(u => {
          // Check if user has submitted schemes, lessons, or reports today
          const userEmail = String(u.email || '').toLowerCase();
          return allSchemes.some(s => String(s.teacherEmail || '').toLowerCase() === userEmail && 
                                    (s.submittedAt || s.createdAt || '').startsWith(todayStr)) ||
                 allLessons.some(l => String(l.teacherEmail || '').toLowerCase() === userEmail && 
                                    (l.submittedAt || l.createdAt || '').startsWith(todayStr)) ||
                 allReports.some(r => String(r.teacherEmail || '').toLowerCase() === userEmail && 
                                    (r.submittedAt || r.date || '').startsWith(todayStr));
        }).length;
        
        // Calculate overdue items (pending items older than 7 days)
        const weekAgo = new Date(currentDate);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        
        const overdueSchemes = allSchemes.filter(s => s.status === 'pending' && 
                                                (s.createdAt || '').split('T')[0] < weekAgoStr).length;
        const overdueLessons = allLessons.filter(l => l.status === 'pending' && 
                                                (l.createdAt || '').split('T')[0] < weekAgoStr).length;
        const overdueItems = overdueSchemes + overdueLessons;
        
        // Calculate submission trends for last 7 days
        const today = new Date();
        const submissionTrends = [];
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const daySchemes = allSchemes.filter(s => {
            const submittedDate = s.submittedAt || s.createdAt || '';
            return submittedDate.startsWith(dateStr);
          }).length;
          
          const dayLessons = allLessons.filter(l => {
            const submittedDate = l.submittedAt || l.createdAt || '';
            return submittedDate.startsWith(dateStr);
          }).length;
          
          const dayReports = allReports.filter(r => {
            const submittedDate = r.submittedAt || r.date || '';
            return submittedDate.startsWith(dateStr);
          }).length;
          
          submissionTrends.push({
            date: dateStr,
            schemes: daySchemes,
            lessonPlans: dayLessons,
            reports: dayReports
          });
        }
        
        // Calculate approval rates
        const approvedSchemes = allSchemes.filter(s => s.status === 'approved').length;
        const rejectedSchemes = allSchemes.filter(s => s.status === 'rejected').length;
        const approvedLessons = allLessons.filter(l => l.status === 'approved').length;
        const rejectedLessons = allLessons.filter(l => l.status === 'rejected').length;
        
        return _respond({
          systemOverview: {
            totalUsers: totalUsers,
            activeToday: activeToday,
            pendingApprovals: pendingApprovals,
            overdueItems: overdueItems,
            systemHealth: totalUsers > 0 ? Math.round((totalUsers - overdueItems) / totalUsers * 100) : 100 // Health based on overdue ratio
          },
          submissionTrends: submissionTrends,
          approvalRates: {
            approved: approvedSchemes + approvedLessons,
            rejected: rejectedSchemes + rejectedLessons,
            pending: pendingSchemes + pendingLessons
          },
          statistics: {
            totalSchemes: allSchemes.length,
            totalLessons: allLessons.length,
            totalReports: allReports.length,
            totalUsers: totalUsers
          }
        });
        
      } catch (error) {
        Logger.log('Error calculating analytics: ' + error.message);
        // Fallback to minimal data
        return _respond({
          submissionTrends: [],
          approvalRates: { approved: 0, rejected: 0, pending: 0 },
          systemOverview: { totalUsers: 0, activeToday: 0, pendingApprovals: 0, overdueItems: 0, systemHealth: 95 },
          statistics: { totalSchemes: 0, totalLessons: 0, totalReports: 0, totalUsers: 0 }
        });
      }
    }

    if (action === 'getRecentActivities') {
      try {
        const activities = [];
        const currentDate = new Date();
        
        // Get recent schemes (last 24 hours)
        const schemesSh = _getSheet('Schemes');
        const schemesHeaders = _headers(schemesSh);
        const recentSchemes = _rows(schemesSh).map(r => _indexByHeader(r, schemesHeaders))
          .filter(s => {
            const submittedAt = s.submittedAt || s.createdAt || '';
            if (!submittedAt) return false;
            const submittedDate = new Date(submittedAt);
            const hoursDiff = (currentDate - submittedDate) / (1000 * 60 * 60);
            return hoursDiff <= 24 && hoursDiff >= 0;
          })
          .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
          .slice(0, 3);
        
        // Get recent lesson plans (last 24 hours)
        const lessonsSh = _getSheet('LessonPlans');
        const lessonsHeaders = _headers(lessonsSh);
        const recentLessons = _rows(lessonsSh).map(r => _indexByHeader(r, lessonsHeaders))
          .filter(l => {
            const submittedAt = l.submittedAt || l.createdAt || '';
            if (!submittedAt) return false;
            const submittedDate = new Date(submittedAt);
            const hoursDiff = (currentDate - submittedDate) / (1000 * 60 * 60);
            return hoursDiff <= 24 && hoursDiff >= 0;
          })
          .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
          .slice(0, 3);
        
        // Get recent daily reports (last 24 hours)
        const reportsSh = _getSheet('DailyReports');
        const reportsHeaders = _headers(reportsSh);
        const recentReports = _rows(reportsSh).map(r => _indexByHeader(r, reportsHeaders))
          .filter(r => {
            const submittedAt = r.submittedAt || r.date || '';
            if (!submittedAt) return false;
            const submittedDate = new Date(submittedAt);
            const hoursDiff = (currentDate - submittedDate) / (1000 * 60 * 60);
            return hoursDiff <= 24 && hoursDiff >= 0;
          })
          .sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date))
          .slice(0, 3);
        
        // Get users data to get teacher names
        const usersSh = _getSheet('Users');
        const usersHeaders = _headers(usersSh);
        const allUsers = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
        
        // Helper function to get teacher name from email
        function getTeacherName(email) {
          const user = allUsers.find(u => String(u.email || '').toLowerCase() === String(email || '').toLowerCase());
          return user ? (user.name || user.teacherName || 'Unknown') : 'Unknown';
        }
        
        // Helper function to format time ago
        function formatTimeAgo(dateStr) {
          if (!dateStr) return 'Unknown time';
          const date = new Date(dateStr);
          const now = new Date();
          const diffInMinutes = Math.floor((now - date) / (1000 * 60));
          
          if (diffInMinutes < 1) return 'Just now';
          if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
          
          const diffInHours = Math.floor(diffInMinutes / 60);
          if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
          
          const diffInDays = Math.floor(diffInHours / 24);
          return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
        }
        
        // Add scheme activities
        recentSchemes.forEach(scheme => {
          activities.push({
            action: scheme.status === 'approved' ? 'Scheme Approved' : 'New Scheme Submitted',
            user: getTeacherName(scheme.teacherEmail),
            time: formatTimeAgo(scheme.submittedAt || scheme.createdAt),
            type: scheme.status === 'approved' ? 'success' : 'info',
            details: `${scheme.class} - ${scheme.subject}`,
            timestamp: scheme.submittedAt || scheme.createdAt
          });
        });
        
        // Add lesson plan activities
        recentLessons.forEach(lesson => {
          activities.push({
            action: lesson.status === 'approved' ? 'Lesson Plan Approved' : 'New Lesson Plan Submitted',
            user: getTeacherName(lesson.teacherEmail),
            time: formatTimeAgo(lesson.submittedAt || lesson.createdAt),
            type: lesson.status === 'approved' ? 'success' : 'info',
            details: `${lesson.class} - ${lesson.subject}`,
            timestamp: lesson.submittedAt || lesson.createdAt
          });
        });
        
        // Add daily report activities
        recentReports.forEach(report => {
          activities.push({
            action: 'Daily Report Submitted',
            user: getTeacherName(report.teacherEmail),
            time: formatTimeAgo(report.submittedAt || report.date),
            type: 'info',
            details: `Report for ${report.date}`,
            timestamp: report.submittedAt || report.date
          });
        });
        
        // Sort all activities by timestamp (most recent first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Return top 5 activities
        return _respond(activities.slice(0, 5));
        
      } catch (error) {
        Logger.log('Error getting recent activities: ' + error.message);
        return _respond([]);
      }
    }

    if (action === 'getTeacherSchemes') {
      // Return all schemes submitted by the teacher, regardless of status
      const email = (e.parameter.email || '').toLowerCase().trim();
      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(p => String(p.teacherEmail||'').toLowerCase() === email)
        .map(p => ({
          schemeId: String(p.schemeId),
          class: String(p.class||''),
          subject: String(p.subject||''),
          chapter: String(p.chapter||''),
          month: String(p.month||''),
          term: Number(p.term||0),
          unit: Number(p.unit||0),
          noOfSessions: Number(p.noOfSessions||0),
          status: String(p.status||'')
        }));
      return _respond(list);
    }

    if (action === 'getFullTimetable') {
      // Return a weekly timetable for all classes grouped by day and period.  Each
      // day contains an array of periods, and each period contains an array of
      // entries with class, subject and teacher.  This is used by the
      // headmaster to view the full school timetable.
      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      const records = _rows(sh).map(r => _indexByHeader(r, headers));
      // Collect unique day names from the timetable
      const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const uniqueDays = Array.from(new Set(records.map(r => _normalizeDayName(r.dayOfWeek)).filter(Boolean)));
    const days = dayOrder.filter(d => uniqueDays.indexOf(d) !== -1);
      const result = [];
      days.forEach(dayName => {
  const dayEntries = records.filter(r => _normalizeDayName(String(r.dayOfWeek || '')) === _normalizeDayName(dayName));
        if (dayEntries.length > 0) {
          const periodMap = {};
          dayEntries.forEach(e => {
            const p = Number(e.period || 0);
            if (!periodMap[p]) periodMap[p] = [];
            periodMap[p].push({
              class: String(e.class || ''),
              subject: String(e.subject || ''),
              teacher: String(e.teacherName || '')
            });
          });
          const periods = Object.keys(periodMap).map(k => ({
            period: Number(k),
            entries: periodMap[k]
          })).sort((a,b) => a.period - b.period);
          result.push({ day: dayName, periods });
        }
      });
      return _respond(result);
    }

    // Server-side filtered full timetable for HM
    // Accepts optional query parameters: class, subject, teacher, date
    if (action === 'getFullTimetableFiltered') {
      const cls = (e.parameter['class'] || '').toString().trim();
      const subject = (e.parameter.subject || '').toString().trim();
      const teacherParam = (e.parameter.teacher || '').toString().trim().toLowerCase();
      const dateParam = (e.parameter.date || '').toString().trim();

      const sh = _getSheet('Timetable');
      const headers = _headers(sh);
      const records = _rows(sh).map(r => _indexByHeader(r, headers));

      // If date provided, convert to day name
      let dayFilter = '';
      if (dateParam) {
        try {
          dayFilter = _dayName(dateParam);
        } catch (err) { dayFilter = '' }
      }

      // Apply row-level filters
      const filtered = records.filter(r => {
        if (cls && String(r.class || '').trim() !== cls) return false;
        if (subject && String(r.subject || '').trim() !== subject) return false;
        if (teacherParam) {
          const te = String(r.teacherEmail || '').toLowerCase();
          const tn = String(r.teacherName || '').toLowerCase();
          if (te !== teacherParam && tn.indexOf(teacherParam) === -1) return false;
        }
  if (dayFilter && _normalizeDayName(String(r.dayOfWeek || '')) !== _normalizeDayName(dayFilter)) return false;
        return true;
      });

      // Build weekly grouped result like getFullTimetable
      const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const uniqueDays = Array.from(new Set(filtered.map(r => _normalizeDayName(r.dayOfWeek)).filter(Boolean)));
  const days = dayOrder.filter(d => uniqueDays.indexOf(d) !== -1);
      const result = [];
      days.forEach(dayName => {
  const dayEntries = filtered.filter(r => _normalizeDayName(String(r.dayOfWeek || '')) === _normalizeDayName(dayName));
        if (dayEntries.length > 0) {
          const periodMap = {};
          dayEntries.forEach(e => {
            const p = Number(e.period || 0);
            if (!periodMap[p]) periodMap[p] = [];
            periodMap[p].push({
              class: String(e.class || ''),
              subject: String(e.subject || ''),
              teacher: String(e.teacherName || '')
            });
          });
          const periods = Object.keys(periodMap).map(k => ({ period: Number(k), entries: periodMap[k] })).sort((a,b) => a.period - b.period);
          result.push({ day: dayName, periods });
        }
      });
      return _respond(result);
    }

    // ===== All Plans =====
    // Return a combined list of all schemes and lesson plans with optional
    // filters.  Allows the headmaster to view every plan regardless of
    // status.  Optional query parameters:
    //   teacher: filter by teacher email or name (case‑insensitive)
    //   class:   filter by class name
    //   subject: filter by subject
    //   status:  filter by status (e.g. Pending, Approved, Rejected, Ready, Pending Review)
    if (action === 'getAllPlans') {
      const teacher = (e.parameter.teacher || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const status = (e.parameter.status || '').trim();
      // fetch schemes
      const shS = _getSheet('Schemes');
      const hdrS = _headers(shS);
      let schemes = _rows(shS).map(r => _indexByHeader(r, hdrS)).map(p => ({
        type: 'Scheme',
        schemeId: String(p.schemeId),
        lpId: '',
        teacherEmail: String(p.teacherEmail||'').toLowerCase(),
        teacherName: String(p.teacherName||''),
        class: String(p.class||''),
        subject: String(p.subject||''),
        chapter: String(p.chapter||''),
        term: String(p.term||''),
        unit: String(p.unit||''),
        month: String(p.month||''),
        noOfSessions: Number(p.noOfSessions||0),
        session: '',
        status: String(p.status||''),
        objectives: '',
        activities: '',
        createdAt: String(p.createdAt||'')
      }));
      // fetch lesson plans
      const shL = _getSheet('LessonPlans');
      const hdrL = _headers(shL);
      let lessons = _rows(shL).map(r => _indexByHeader(r, hdrL)).map(lp => ({
        type: 'LessonPlan',
        schemeId: '',
        lpId: String(lp.lpId),
        teacherEmail: String(lp.teacherEmail||'').toLowerCase(),
        teacherName: String(lp.teacherName||''),
        class: String(lp.class||''),
        subject: String(lp.subject||''),
        chapter: String(lp.chapter||''),
        term: '',
        unit: '',
        month: '',
        noOfSessions: '',
        session: String(lp.session||''),
        status: String(lp.status||''),
        objectives: String(lp.objectives||''),
        activities: String(lp.activities||''),
        createdAt: String(lp.createdAt||'')
      }));
      // apply filters
      if (teacher) {
        schemes = schemes.filter(p => p.teacherEmail === teacher || p.teacherName.toLowerCase().indexOf(teacher) !== -1);
        lessons = lessons.filter(lp => lp.teacherEmail === teacher || lp.teacherName.toLowerCase().indexOf(teacher) !== -1);
      }
      if (cls) {
        schemes = schemes.filter(p => p.class === cls);
        lessons = lessons.filter(lp => lp.class === cls);
      }
      if (subject) {
        schemes = schemes.filter(p => p.subject === subject);
        lessons = lessons.filter(lp => lp.subject === subject);
      }
      if (status) {
        schemes = schemes.filter(p => p.status === status);
        lessons = lessons.filter(lp => lp.status === status);
      }
      const combined = schemes.concat(lessons);
      return _respond(combined);
    }

    // ===== Daily Reports management =====
    // Return all daily reports with optional filters for teacher, class, subject,
    // date (exact), fromDate/toDate and status (based on 'completed' field).
    // Query parameters:
    //   teacher: filter by teacher email or name (case‑insensitive)
    //   class: filter by class name
    //   subject: filter by subject
    //   date: filter reports matching exact date (yyyy‑mm‑dd)
    //   fromDate/toDate: inclusive date range filter (yyyy‑mm‑dd)
    //   status: filter by completion status (e.g. Fully Completed, Partially Completed, Not Started)
    if (action === 'getDailyReports') {
      const teacher = (e.parameter.teacher || '').toLowerCase().trim();
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const date = (e.parameter.date || '').trim();
      const fromDate = (e.parameter.fromDate || '').trim();
      const toDate = (e.parameter.toDate || '').trim();
      const status = (e.parameter.status || '').trim();
      const sh = _getSheet('DailyReports');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers)).map(dr => ({
        date: String(dr.date||''),
        teacherEmail: String(dr.teacherEmail||'').toLowerCase(),
        teacherName: String(dr.teacherName||''),
        class: String(dr.class||''),
        subject: String(dr.subject||''),
        period: String(dr.period||''),
        planType: String(dr.planType||''),
        lessonPlanId: String(dr.lessonPlanId||''),
        chapter: String(dr.chapter||''),
        objectives: String(dr.objectives||''),
        activities: String(dr.activities||''),
        completed: String(dr.completed||''),
        notes: String(dr.notes||''),
        createdAt: String(dr.createdAt||'')
      }));
      if (teacher) {
        list = list.filter(r => r.teacherEmail === teacher || r.teacherName.toLowerCase().indexOf(teacher) !== -1);
      }
      if (cls) {
        list = list.filter(r => r.class === cls);
      }
      if (subject) {
        list = list.filter(r => r.subject === subject);
      }
      if (date) {
        list = list.filter(r => r.date === date);
      }
      if (fromDate) {
        list = list.filter(r => r.date >= fromDate);
      }
      if (toDate) {
        list = list.filter(r => r.date <= toDate);
      }
      if (status) {
        list = list.filter(r => r.completed === status);
      }
      return _respond(list);
    }

    if (action === 'getExams') {
      // Retrieve all exams, optionally filtered by class, subject or examType and role-based permissions.
      const cls = (e.parameter['class'] || '').trim();
      const subject = (e.parameter.subject || '').trim();
      const examType = (e.parameter.examType || '').trim();
      
      // Role-based filtering parameters from frontend
      const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
      const role = (e.parameter.role || '').toLowerCase().trim();
      const classTeacherFor = (e.parameter.classTeacherFor || '').trim();
      const teacherSubjectsStr = (e.parameter.teacherSubjects || '');
      const teacherSubjects = teacherSubjectsStr ? (Array.isArray(teacherSubjectsStr) ? teacherSubjectsStr : teacherSubjectsStr.split(',').map(s => s.trim()).filter(Boolean)) : [];
      
      const sh = _getSheet('Exams');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      let filtered = list;
      
      // Apply basic filters first
      if (cls) filtered = filtered.filter(ex => String(ex.class||'') === cls);
      if (subject) filtered = filtered.filter(ex => String(ex.subject||'') === subject);
      if (examType) filtered = filtered.filter(ex => String(ex.examType||'') === examType);
      
      // Apply role-based filtering if user information is provided
      if (teacherEmail && role !== 'headmaster') {
        // Get user information from Users sheet for additional validation
        const usersSh = _getSheet('Users');
        const usersHeaders = _headers(usersSh);
        const users = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
        const currentUser = users.find(u => String(u.email||'').toLowerCase() === teacherEmail);
        
        if (currentUser) {
          // Parse user's classes and subjects
          const userClassesStr = (currentUser.classes || currentUser.Class || currentUser.Classes || '').toString();
          const userClasses = userClassesStr ? userClassesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
          const userSubjectsStr = (currentUser.subjects || currentUser.Subject || currentUser.Subjects || '').toString();
          const userSubjects = userSubjectsStr ? userSubjectsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
          const userClassTeacherFor = currentUser.classTeacherFor || currentUser['Class Teacher For'] || '';
          
          // Utility function to normalize strings for comparison
          const normKey = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
          
          // Filter based on role
          if (role === 'classteacher') {
            // Class Teacher: can view exams for their class teacher class OR subjects they teach in classes they are assigned to
            filtered = filtered.filter(ex => {
              const exClass = normKey(ex.class);
              const exSubject = normKey(ex.subject);
              
              // Access to all subjects in the class they are class teacher for
              const isClassTeacherForThisClass = userClassTeacherFor && normKey(userClassTeacherFor) === exClass;
              
              // Access to subjects they teach, but only in classes they are assigned to
              const teachesClass = userClasses.some(c => normKey(c) === exClass);
              const teachesSubject = userSubjects.some(s => normKey(s) === exSubject);
              const teachesThisSubjectInThisClass = teachesClass && teachesSubject;
              
              return isClassTeacherForThisClass || teachesThisSubjectInThisClass;
            });
          } else if (role === 'teacher') {
            // Regular Teacher: can only view exams for classes AND subjects they teach
            filtered = filtered.filter(ex => {
              const exClass = normKey(ex.class);
              const exSubject = normKey(ex.subject);
              
              const teachesClass = userClasses.some(c => normKey(c) === exClass);
              const teachesSubject = userSubjects.some(s => normKey(s) === exSubject);
              
              return teachesClass && teachesSubject;
            });
          }
        }
      }
      const result = filtered.map(ex => {
        // Generate exam name if it doesn't exist in the data (for backward compatibility)
        const examName = ex.examName || `${ex.examType || 'Exam'} - ${ex.class || ''} - ${ex.subject || ''}`;
        
        // More comprehensive check for "false" values
        const isFalseValue = (
          ex.hasInternalMarks === false ||
          ex.hasInternalMarks === 'false' ||
          ex.hasInternalMarks === 'FALSE' ||
          ex.hasInternalMarks === 'False' ||
          String(ex.hasInternalMarks).toLowerCase() === 'false' ||
          ex.hasInternalMarks === 0 ||
          ex.hasInternalMarks === '0'
        );
        
        const processedHasInternalMarks = !isFalseValue;
        
        return {
          examId: String(ex.examId||''),
          creatorEmail: String(ex.creatorEmail||''),
          creatorName: String(ex.creatorName||''),
          class: String(ex.class||''),
          subject: String(ex.subject||''),
          examType: String(ex.examType||''),
          hasInternalMarks: processedHasInternalMarks, // Include hasInternalMarks field
          internalMax: Number(ex.internalMax||0),
          externalMax: Number(ex.externalMax||0),
          totalMax: Number(ex.totalMax||0),
          date: String(ex.date||''),
          examName: examName
        };
      });
      return _respond(result);
    }

    if (action === 'getExamMarks') {
      // Return all marks for a given examId.  Provide basic fields for
      // rendering marks tables in the UI.
      const examId = (e.parameter.examId || '').trim();
      if (!examId) return _respond([]);
      const sh = _getSheet('ExamMarks');
      const headers = _headers(sh);
      // Fetch exam metadata to compute percentage and grade boundaries
      const exSh = _getSheet('Exams');
      const exHeaders = _headers(exSh);
      const exList = _rows(exSh).map(r => _indexByHeader(r, exHeaders));
      const exam = exList.find(ex => String(ex.examId||'') === examId);
      // Determine exam total and class for grade calculation
      const examTotalMax = exam && exam.totalMax ? Number(exam.totalMax) : 0;
      const examClass = exam && exam.class ? String(exam.class) : '';
      const stdGroup = _standardGroup(examClass);
      const list = _rows(sh).map(r => _indexByHeader(r, headers))
        .filter(m => String(m.examId||'') === examId)
        .map(m => {
          const internal = Number(m.internal||0);
          const external = Number(m.external||0);
          const total = Number(m.total|| (internal + external));
          // Compute percentage and grade using our unified function
          let grade = '';
          let percentage = 0;
          if (examTotalMax > 0 && total > 0) {
            percentage = Math.round((total / examTotalMax) * 100);
            grade = _calculateGradeFromBoundaries(percentage, examClass);
          }
          return {
            admNo: String(m.admNo||''),
            studentName: String(m.studentName||''),
            internal: internal,
            external: external,
            total: total,
            percentage: percentage, // Add percentage field
            teacherName: String(m.teacherName||''),
            grade: grade
          };
        });
      return _respond(list);
    }

    if (action === 'getStudents') {
      // Fetch students.  If a class is provided as a parameter, only return
      // students in that class.  Otherwise return all students.
      const cls = (e.parameter['class'] || '').trim();
      const sh = _getSheet('Students');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers)).map(s => ({
        admNo: String(s.admNo||''),
        name: String(s.name||''),
        class: String(s.class||''),
        email: String(s.email||''),
        parentContact: String(s.parentContact||'')
      }));
      if (cls) list = list.filter(s => s.class === cls);
      return _respond(list);
    }

    if (action === 'getGradeTypes') {
      // Return the list of exam grading schemes.  Each entry contains the
      // examType and the maximum internal, external and total marks.
      const sh = _getSheet('GradeTypes');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers)).map(g => ({
        examType: String(g.examType||''),
        internalMax: Number(g.internalMax||0),
        externalMax: Number(g.externalMax||0),
        totalMax: Number(g.totalMax||0)
      }));
      return _respond(list);
    }

    if (action === 'getGradeBoundaries') {
      // Return the grade boundary definitions.  Each entry describes
      // a percentage range for a given standard group and grade label.
      const sh = _getSheet('GradeBoundaries');
      _ensureHeaders(sh, SHEETS.GradeBoundaries);
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers)).map(b => ({
        standardGroup: String(b.standardGroup||''),
        grade: String(b.grade||''),
        minPercentage: Number(b.minPercentage||0),
        maxPercentage: Number(b.maxPercentage||0)
      }));
      return _respond(list);
    }

    if (action === 'getAttendance') {
      // Retrieve attendance records.  Optional filters include class and date.
      const cls = (e.parameter['class'] || '').trim();
      const date = (e.parameter.date || '').trim();
      const sh = _getSheet('Attendance');
      const headers = _headers(sh);
      let list = _rows(sh).map(r => _indexByHeader(r, headers)).map(a => ({
        date: String(a.date||''),
        class: String(a.class||''),
        admNo: String(a.admNo||''),
        studentName: String(a.studentName||''),
        status: String(a.status||''),
        teacherName: String(a.teacherName||'')
      }));
      if (cls) list = list.filter(a => a.class === cls);
      if (date) list = list.filter(a => a.date === date);
      return _respond(list);
    }

    if (action === 'getStudentPerformance') {
      // Compute average performance for students in a class across all exams.
      const cls = (e.parameter['class'] || '').trim();
      if (!cls) return _respond([]);
      const marksSh = _getSheet('ExamMarks');
      const marksHeaders = _headers(marksSh);
      const marks = _rows(marksSh)
        .map(r => _indexByHeader(r, marksHeaders))
        .filter(m => String(m.class||'') === cls);
      const perfMap = {};
      marks.forEach(m => {
        const adm = String(m.admNo||'');
        const name = String(m.studentName||'');
        const total = Number(m.total||0);
        if (!perfMap[adm]) perfMap[adm] = { name, totalSum: 0, count: 0 };
        perfMap[adm].totalSum += total;
        perfMap[adm].count += 1;
      });
      const results = Object.keys(perfMap).map(adm => {
        const entry = perfMap[adm];
        const average = entry.count > 0 ? entry.totalSum / entry.count : 0;
        return {
          admNo: adm,
          name: entry.name,
          average: average,
          examCount: entry.count
        };
      });
      // Sort by average descending
      results.sort((a,b) => b.average - a.average);
      return _respond(results);
    }
    
    if (action === 'getCalendarEvents') {
      // Combine timetable, lesson plans, substitutions, and personal events into calendar events
      const email = (e.parameter.email || '').toLowerCase().trim();
      const startDate = (e.parameter.startDate || '').trim();
      const endDate = (e.parameter.endDate || '').trim();
      
      // Array to hold all calendar events
      const calendarEvents = [];
      
      try {
        // Get teacher's weekly timetable directly
        const tSh = _getSheet('Timetable');
        const tHeaders = _headers(tSh);
        
        // Compute the next 7 days for timetable events
        const days = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(today.getTime() + i * 24 * 3600 * 1000);
          const iso = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          const dayName = Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE');
          days.push({ date: iso, dayName });
        }
        
        // Get timetable entries for this teacher
        const timetableRows = _rows(tSh)
          .map(r => _indexByHeader(r, tHeaders))
          .filter(r => {
            const te = String(r.teacherEmail || '').toLowerCase();
            const tn = String(r.teacherName || '').toLowerCase();
            return email && (te === email || tn === email);
          });
        
        // Create events for each day's periods from timetable
        days.forEach(({ date, dayName }) => {
          const normalizedDay = _normalizeDayName(dayName);
          const periods = timetableRows
            .filter(x => _normalizeDayName(String(x.dayOfWeek || '')) === normalizedDay);
          
          periods.forEach(period => {
            // Create event for each period
            const startHour = 7 + Number(period.period);
            const endHour = startHour + 1;
            
            const dayDate = new Date(date);
            const start = new Date(dayDate);
            start.setHours(startHour, 0, 0);
            
            const end = new Date(dayDate);
            end.setHours(endHour, 0, 0);
            
            calendarEvents.push({
              id: `${date}-${period.period}`,
              type: 'timetable',
              title: `${period.class} - ${period.subject}`,
              date: date,
              day: dayName,
              period: period.period,
              class: period.class || '',
              subject: period.subject || '',
              start: start.toISOString(),
              end: end.toISOString()
            });
          });
        });
        
        // Get lesson plans
        const lpSh = _getSheet('LessonPlans');
        const lpHeaders = _headers(lpSh);
        const lessonPlans = _rows(lpSh)
          .map(r => _indexByHeader(r, lpHeaders))
          .filter(lp => String(lp.teacherEmail || '').toLowerCase() === email);

        // Process lesson plans into events or mark existing events
        lessonPlans.forEach(plan => {
          // Find matching timetable slots by class and subject only
          calendarEvents.forEach(event => {
            if (event.class === plan.class &&
                event.subject === plan.subject) {
              // Update the matching event with lesson plan information
              event.lessonPlan = true;
              event.lpId = plan.lpId;
              event.status = plan.status || '';
              event.objectives = plan.objectives || '';
              event.activities = plan.activities || '';
              event.sessionNumber = Number(plan.session || 0); // Track actual session number
            }
          });
        });        // Get substitutions for today and tomorrow
        const dates = [_todayISO()];
        
        // Add tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        dates.push(tomorrowISO);
        
        // Process substitutions
        const subSh = _getSheet('Substitutions');
        const subHeaders = _headers(subSh);
        const substitutions = _rows(subSh)
          .map(r => _indexByHeader(r, subHeaders))
          .filter(s => dates.includes(String(s.date || '')) && 
                       String(s.substituteTeacher || '').toLowerCase().indexOf(email) !== -1);
        
        // Add substitution events
        substitutions.forEach(sub => {
          const startHour = 7 + Number(sub.period);
          const endHour = startHour + 1;
          
          const dayDate = new Date(sub.date);
          const start = new Date(dayDate);
          start.setHours(startHour, 0, 0);
          
          const end = new Date(dayDate);
          end.setHours(endHour, 0, 0);
          
          calendarEvents.push({
            id: `substitution-${sub.date}-${sub.period}-${sub.class}`,
            type: 'substitution',
            title: `${sub.class} - ${sub.substituteSubject || sub.regularSubject} (Substitution)`,
            date: sub.date,
            period: sub.period,
            class: sub.class,
            subject: sub.substituteSubject || sub.regularSubject,
            start: start.toISOString(),
            end: end.toISOString()
          });
        });
        
        // Get personal calendar events
        const calSh = _getSheet('CalendarEvents');
        const calHeaders = _headers(calSh);
        const personalEvents = _rows(calSh)
          .map(r => _indexByHeader(r, calHeaders))
          .filter(e => String(e.userEmail || '').toLowerCase() === email);
        
        // Add personal events to the response
        personalEvents.forEach(e => {
          let start, end;
          
          try {
            start = new Date(e.startTime);
            end = new Date(e.endTime);
          } catch (err) {
            console.warn('Invalid date format for event:', e.eventId);
            return; // Skip this event
          }
          
          calendarEvents.push({
            id: e.eventId,
            type: e.type || 'personal',
            title: e.title || 'Untitled Event',
            class: e.class || '',
            subject: e.subject || '',
            notes: e.notes || '',
            color: e.color || '#8b5cf6', // Default purple for personal events
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: e.allDay === 'true' || e.allDay === true,
            isPersonalEvent: true
          });
        });
        
        return _respond(calendarEvents);
      } catch (err) {
        console.error("Calendar error:", err);
        return _respond({ error: String(err.message || err) });
      }
    }

    // Enhanced Substitution Management Endpoints
    if (action === 'getDailyTimetableForDate') {
      const date = (e.parameter.date || '').trim();
      if (!date) return _respond({ error: 'Date parameter required' });
      
      try {
        const dayOfWeek = _getDayOfWeek(date);
        const sh = _getSheet('Timetable');
        const headers = _headers(sh);
        
        let timetable = _rows(sh)
          .map(r => _indexByHeader(r, headers))
          .filter(row => String(row.dayOfWeek || '').toLowerCase() === dayOfWeek.toLowerCase())
          .map(row => ({
            class: String(row.class || ''),
            dayOfWeek: String(row.dayOfWeek || ''),
            period: parseInt(row.period || 0),
            subject: String(row.subject || ''),
            teacherEmail: String(row.teacherEmail || ''),
            teacherName: String(row.teacherName || '')
          }))
          .sort((a, b) => a.period - b.period);
        
        return _respond(timetable);
      } catch (err) {
        return _respond({ error: String(err.message || err) });
      }
    }

    if (action === 'getSubstitutionsForDate') {
      const date = (e.parameter.date || '').trim();
      if (!date) return _respond({ error: 'Date parameter required' });
      
      // Log all URL parameters for debugging
      Logger.log(`getSubstitutionsForDate - All parameters: ${JSON.stringify(e.parameter)}`);
      
      try {
        // Use the standalone function that handles everything properly
        const substitutions = getSubstitutionsForDate(date);
        return _respond(substitutions);
      } catch (err) {
        Logger.log(`getSubstitutionsForDate - ERROR: ${err.message || err}`);
        return _respond({ error: String(err.message || err) });
      }
    }

    // Data migration action to fix substitution dates
    if (action === 'fixSubstitutionDates') {
      try {
        const result = fixSubstitutionDates();
        Logger.log(`fixSubstitutionDates result: ${JSON.stringify(result)}`);
        return _respond(result);
      } catch (err) {
        Logger.log(`fixSubstitutionDates ERROR: ${err.message || err}`);
        return _respond({ error: String(err.message || err) });
      }
    }
    
    /**
     * Get all substitutions for a specific date
     * 
     * @param {string} date - The date to get substitutions for in YYYY-MM-DD format
     * @return {Array<Object>} - List of substitutions for the date
     */
    function getSubstitutionsForDate(date) {
      // Normalize input date to ensure consistent format
      const searchDate = _isoDateString(date);
      
      // Log debugging information
      Logger.log(`Getting substitutions for date: ${date}, normalized: ${searchDate}`);
      
      // Get the substitution sheet
      const sh = _getSheet('Substitutions');
      if (!sh) {
        Logger.log('Substitutions sheet not found');
        return [];
      }
      
      // Log sheet information
      Logger.log(`Substitutions sheet found with ${sh.getLastRow()} rows and ${sh.getLastColumn()} columns`);
      
      try {
        // Get all data for better debugging
        const headers = _headers(sh);
        const values = _rows(sh);
        
        Logger.log(`Headers: ${JSON.stringify(headers)}`);
        Logger.log(`Total rows in sheet (excluding header): ${values.length}`);
        
        // Debug the first few rows
        for (let i = 0; i < Math.min(values.length, 5); i++) {
          const rowObj = _indexByHeader(values[i], headers);
          const rowDate = rowObj.date;
          const normalizedRowDate = _isoDateString(rowDate);
          Logger.log(`Row ${i+2}: ${JSON.stringify(rowObj)}`);
          Logger.log(`Date comparison: Sheet date "${rowDate}" (normalized: "${normalizedRowDate}") vs Search date "${searchDate}" => Match: ${normalizedRowDate === searchDate}`);
        }
        
        // Find substitutions that match our date
        const substitutions = values
          .map(row => _indexByHeader(row, headers))
          .filter(row => {
            if (!row.date) return false;
            const rowDateNormalized = _isoDateString(row.date);
            
            // Also check if the date when converted to Date and back matches
            // This handles cases where dates were stored incorrectly due to timezone issues
            if (rowDateNormalized === searchDate) return true;
            
            // Additional check: if the original date is a Date object that represents the same day
            if (row.date instanceof Date || (typeof row.date === 'string' && row.date.includes('GMT'))) {
              const d = new Date(row.date);
              if (!isNaN(d.getTime())) {
                // Check both UTC and local interpretations
                const utcDateStr = d.toISOString().split('T')[0];
                const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                if (utcDateStr === searchDate || localDateStr === searchDate) {
                  Logger.log(`Date match found via Date object conversion: ${row.date} -> ${utcDateStr} or ${localDateStr} matches ${searchDate}`);
                  return true;
                }
              }
            }
            
            return false;
          })
          .map(row => ({
            id: row.id || row.substitutionId || `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: _isoDateString(row.date), // Normalize the date in output
            period: parseInt(row.period || 0),
            class: String(row.class || ''),
            absentTeacher: String(row.absentTeacher || ''),
            regularSubject: String(row.regularSubject || ''),
            substituteTeacher: String(row.substituteTeacher || ''),
            substituteSubject: String(row.substituteSubject || ''),
            note: String(row.note || ''),
            createdAt: String(row.createdAt || '')
          }));
        
        Logger.log(`Returning ${substitutions.length} substitutions for date ${searchDate}`);
        return substitutions;
        
      } catch (error) {
        Logger.log(`Error in getSubstitutionsForDate: ${error.toString()}`);
        return [];
      }
    }

    if (action === 'getAvailableTeachers') {
      const date = (e.parameter.date || '').trim();
      const period = parseInt(e.parameter.period || 0);
      
      if (!date || !period) {
        return _respond({ error: 'Date and period parameters required' });
      }
      
      try {
        const dayOfWeek = _getDayOfWeek(date);
        
        // Get all teachers
        const usersSh = _getSheet('Users');
        const usersHeaders = _headers(usersSh);
        const allTeachers = _rows(usersSh)
          .map(r => _indexByHeader(r, usersHeaders))
          .filter(user => {
            const roles = String(user.roles || '').toLowerCase();
            return roles.includes('teacher') || roles.includes('hm');
          })
          .map(user => ({
            email: String(user.email || ''),
            name: String(user.name || ''),
            subjects: String(user.subjects || '').split(',').map(s => s.trim()).filter(s => s)
          }));
        
        // Get busy teachers for this period
        const timetableSh = _getSheet('Timetable');
        const timetableHeaders = _headers(timetableSh);
        const busyTeachers = _rows(timetableSh)
          .map(r => _indexByHeader(r, timetableHeaders))
          .filter(row => 
            String(row.dayOfWeek || '').toLowerCase() === dayOfWeek.toLowerCase() &&
            parseInt(row.period || 0) === period
          )
          .map(row => String(row.teacherEmail || '').toLowerCase());
        
        // Filter available teachers
        const availableTeachers = allTeachers.filter(teacher => 
          !busyTeachers.includes(teacher.email.toLowerCase())
        );
        
        return _respond(availableTeachers);
      } catch (err) {
        return _respond({ error: String(err.message || err) });
      }
    }

    if (action === 'getStudentReportCard') {
      // Get report card data using examType + class instead of examId
      // Parameters: examType, admNo (optional, for specific student), class
      const examType = e.parameter.examType || '';
      const admNo = e.parameter.admNo || '';
      const cls = e.parameter.class || '';
      
      if (!examType) {
        return _respond({ error: 'examType is required' });
      }
      
      if (!cls) {
        return _respond({ error: 'class is required' });
      }
      
      try {
        // Find ALL exams that match the examType and class
        const examsSh = _getSheet('Exams');
        const examsHeaders = _headers(examsSh);
        const allExams = _rows(examsSh).map(r => _indexByHeader(r, examsHeaders));
        
        // Filter exams by examType and class
        const matchingExams = allExams.filter(exam => {
          const examTypeMatch = (exam.examType || '').toString().toLowerCase().trim() === examType.toLowerCase().trim();
          const classMatch = (exam.class || '').toString().toLowerCase().trim() === cls.toLowerCase().trim();
          return examTypeMatch && classMatch;
        });
        
        Logger.log(`Found ${matchingExams.length} exams matching examType="${examType}" and class="${cls}"`);
        matchingExams.forEach((exam, index) => {
          Logger.log(`Exam ${index + 1}: ID=${exam.examId}, Type=${exam.examType}, Class=${exam.class}, Subject=${exam.subject}`);
        });
        
        if (matchingExams.length === 0) {
          return _respond({ 
            students: [], 
            subjects: [],
            message: `No exams found for examType "${examType}" in class "${cls}"`
          });
        }
        
        // Get all examIds for this examType + class combination
        const examIds = matchingExams.map(exam => exam.examId).filter(Boolean);
        
        // Get marks for all these exams
        const examMarksSh = _getSheet('ExamMarks');
        const marksHeaders = _headers(examMarksSh);
        const allMarks = _rows(examMarksSh).map(r => _indexByHeader(r, marksHeaders));
        
        // Get student names from Students sheet if needed
        const studentsSh = _getSheet('Students');
        const studentsHeaders = _headers(studentsSh);
        const allStudents = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders));
        const studentNamesMap = {};
        allStudents.forEach(student => {
          const admNo = (student.admNo || student.admissionNumber || '').toString();
          const name = student.name || student.studentName || '';
          if (admNo && name) {
            studentNamesMap[admNo] = name;
          }
        });
        
        // Filter marks by examIds and optionally by admNo
        let relevantMarks = allMarks.filter(mark => 
          examIds.includes(mark.examId)
        );
        
        if (admNo) {
          // Filter for specific student
          relevantMarks = relevantMarks.filter(mark => 
            (mark.admNo || '').toString().toLowerCase().trim() === admNo.toLowerCase().trim()
          );
        }
        
        // Group marks by student
        const studentMarksMap = {};
        const subjectsSet = new Set();
        
        Logger.log(`Processing ${relevantMarks.length} marks for examType "${examType}" and class "${cls}"`);
        
        relevantMarks.forEach(mark => {
          const studentAdmNo = mark.admNo || '';
          const studentName = mark.studentName || studentNamesMap[studentAdmNo] || `Student ${studentAdmNo}`;
          const subject = mark.subject || '';
          
          Logger.log(`Processing mark: AdmNo=${studentAdmNo}, Subject=${subject}, Internal=${mark.internal}, External=${mark.external}, Total=${mark.total}`);
          
          if (!studentMarksMap[studentAdmNo]) {
            studentMarksMap[studentAdmNo] = {
              admNo: studentAdmNo,
              name: studentName,
              subjects: {}
            };
          }
          
          // Aggregate marks for this subject across all exams of this examType
          if (!studentMarksMap[studentAdmNo].subjects[subject]) {
            studentMarksMap[studentAdmNo].subjects[subject] = {
              subject: subject,
              ce: 0,
              te: 0,
              total: 0,
              grade: 'N/A',
              count: 0
            };
          }
          
          const subjectData = studentMarksMap[studentAdmNo].subjects[subject];
          
          // Better parsing for numeric values with absent handling
          const parseNumber = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            // Handle absent students (-1 stored value)
            if (String(val).toUpperCase() === 'A' || Number(val) === -1) return -1;
            const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
            return isNaN(num) ? 0 : num;
          };
          
          const ceValue = parseNumber(mark.ce);
          const teValue = parseNumber(mark.te);
          const totalValue = parseNumber(mark.total);
          
          // Check if any value indicates absent
          const isAbsent = ceValue === -1 || teValue === -1 || totalValue === -1;
          
          if (isAbsent) {
            // If student is absent, mark the entire subject as absent
            subjectData.ce = -1;
            subjectData.te = -1;
            subjectData.total = -1;
            subjectData.grade = 'Absent';
          } else {
            // Only add if not already marked as absent
            if (subjectData.ce !== -1) subjectData.ce += ceValue;
            if (subjectData.te !== -1) subjectData.te += teValue;
            if (subjectData.total !== -1) subjectData.total += totalValue;
          }
          subjectData.count += 1;
          
          // Use the latest grade (assuming all exams of same type have same grading)
          if (mark.grade && mark.grade !== 'N/A') {
            subjectData.grade = mark.grade;
          }
          
          subjectsSet.add(subject);
        });
        
        // Convert to array format and average the marks if multiple exams
        const students = Object.values(studentMarksMap).map(student => {
          const avgSubjects = {};
          Object.values(student.subjects).forEach(subjectData => {
            if (subjectData.count > 0) {
              // Handle absent students
              if (subjectData.ce === -1 || subjectData.te === -1 || subjectData.total === -1) {
                avgSubjects[subjectData.subject] = {
                  ce: 'Absent',
                  te: 'Absent',
                  total: 'Absent',
                  grade: 'Absent'
                };
              } else {
                avgSubjects[subjectData.subject] = {
                  ce: Math.round(subjectData.ce / subjectData.count),
                  te: Math.round(subjectData.te / subjectData.count),
                  total: Math.round(subjectData.total / subjectData.count),
                  grade: subjectData.grade
                };
              }
            }
          });
          
          return {
            admNo: student.admNo,
            name: student.name,
            subjects: avgSubjects
          };
        });
        
        const subjects = Array.from(subjectsSet);
        
        return _respond({
          students: students,
          subjects: subjects,
          examType: examType,
          class: cls,
          examCount: matchingExams.length
        });
        
      } catch (error) {
        return _respond({ 
          error: `Failed to generate report card: ${error.message || error}` 
        });
      }
    }

    return _respond({ error: 'Unknown action' });
  } catch (err) {
    return _respond({ error: String(err && err.message ? err.message : err) });
  }
}

// (Removed earlier duplicate doPost definition to avoid overriding the main doPost below.)

/**
 * Handle Google authentication with either direct user info or access token.
 * New approach: frontend gets user info directly from Google using access token,
 * then sends the info to the backend directly.
 * 
 * Expects payload with either:
 * 1. { email, name, google_id, picture, access_token } - Direct user info from Google
 * 2. { idToken } - Legacy support for ID tokens
 * 
 * Updated with improved error handling and detailed logging
 */
function _handleGoogleLogin(payload) {
  try {
    // Input validation with detailed error
    if (!payload) {
      Logger.log("googleLogin error: Empty payload");
      return _respond({ error: 'Missing payload' });
    }
    
    Logger.log("Received auth payload from client: " + JSON.stringify(payload));
    
    // Handle direct user info (new approach)
    if (payload.email && payload.google_id) {
      Logger.log("Using direct user info authentication method");
      
      const email = String(payload.email || '').toLowerCase().trim();
      const name = String(payload.name || '').trim();
      const picture = String(payload.picture || '').trim();
      
      if (!email) {
        Logger.log("googleLogin error: Missing email in payload");
        return _respond({ error: 'Missing email in authentication payload' });
      }
      
      Logger.log("Looking up user with email: " + email);
      
      // Lookup user in Users sheet
      const sh = _getSheet('Users');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      
      // Log all users for debugging (email only)
      Logger.log("Available users: " + list.map(u => String(u.email || '')).join(', '));
      
      const found = list.find(u => String(u.email || '').toLowerCase() === email);
      if (!found) {
        Logger.log("googleLogin error: User not registered - " + email);
        return _respond({ error: 'User not registered' });
      }
      
      Logger.log("User found: " + found.name);
      
      // Normalize roles/classes/subjects
      const roleStr = (found.roles || found.role || '').toString();
      const roles = roleStr.split(',').map(s => s.trim()).filter(Boolean);
      const classStr = (found.classes || found.Class || found.Classes || '').toString();
      const classes = classStr.split(',').map(s => s.trim()).filter(Boolean);
      const subjStr = (found.subjects || found.Subject || found.Subjects || '').toString();
      const subjects = subjStr.split(',').map(s => s.trim()).filter(Boolean);
      const classTeacherFor = found.classTeacherFor || found['Class Teacher For'] || '';
      
      Logger.log("Login successful for: " + email + ", roles: " + roles.join(', '));
      
      return _respond({
        email,
        name: found.name || name || '',
        roles,
        classes,
        subjects,
        classTeacherFor,
        picture: picture || ''
      });
    }
    
    // Legacy support for ID token authentication
    if (payload.idToken) {
      Logger.log("Using legacy ID token authentication method");
      
      const token = String(payload.idToken || '').trim();
      if (!token) {
        Logger.log("googleLogin error: Empty token");
        return _respond({ error: 'Empty authentication token' });
      }
      
      Logger.log("Received token from client...");
      Logger.log("Length: " + token.length);
      Logger.log("Prefix: " + token.substring(0, 10) + "...");
      
      // First determine if we received an authorization code (starts with '4/') or ID token (longer JWT format)
      let isAuthCode = token.startsWith('4/');
      let tokenInfo;
      
      if (isAuthCode) {
        Logger.log("Auth code format detected but not supported in this version");
        return _respond({ error: 'Authorization code flow not supported. Please update the frontend.' });
      } else {
        // Handle as ID token directly
        Logger.log("Handling as ID token. Validating with tokeninfo endpoint...");
        
        // Try ID token validation
        const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
        Logger.log("Fetching token info from: " + url);
        
        const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        const responseCode = resp.getResponseCode();
        Logger.log("Google token validation response code: " + responseCode);
        
        // Enhanced error handling with specific errors
        if (responseCode !== 200) {
          const responseText = resp.getContentText();
          Logger.log("Token validation failed with response: " + responseText);
          
          // Try to parse the error for better error messages
          try {
            const errorInfo = JSON.parse(responseText);
            if (errorInfo.error) {
              Logger.log("Token validation error: " + errorInfo.error);
              Logger.log("Error description: " + (errorInfo.error_description || 'No description'));
              return _respond({ 
                error: 'Invalid Google token: ' + errorInfo.error, 
                details: errorInfo.error_description 
              });
            }
          } catch (e) {
            // Parsing failed, just continue with generic error
          }
          
          return _respond({ error: 'Invalid Google token (HTTP ' + responseCode + ')' });
        }
        
        tokenInfo = JSON.parse(resp.getContentText());
      }
    
      // For legacy ID token flow, continue with token validation
      // Log critical fields for debugging
      Logger.log("Token validation successful. Processing token info...");
      Logger.log("Token issued to: " + (tokenInfo.email || 'Unknown'));
      Logger.log("Email verified: " + (tokenInfo.email_verified || tokenInfo.emailVerified || 'unknown'));
      Logger.log("Audience: " + (tokenInfo.aud || 'Unknown'));
      Logger.log("Issuer: " + (tokenInfo.iss || 'Unknown'));
      
      // Verify email is verified
      const verified = String(tokenInfo.email_verified || tokenInfo.emailVerified || '').toLowerCase();
      if (verified !== 'true') {
        Logger.log("googleLogin error: Email not verified");
        return _respond({ error: 'Email not verified' });
      }
      
      // Extract and normalize email
      const email = String(tokenInfo.email || '').toLowerCase().trim();
      if (!email) {
        Logger.log("googleLogin error: Token missing email");
        return _respond({ error: 'Token missing email' });
      }
      
      // Get name and picture from token info
      const userName = tokenInfo.name || '';
      const userPicture = tokenInfo.picture || '';
      
      Logger.log("Looking up user with email: " + email);
      
      // Lookup user in Users sheet
      const sh = _getSheet('Users');
      const headers = _headers(sh);
      const list = _rows(sh).map(r => _indexByHeader(r, headers));
      
      // Log all users for debugging (email only)
      Logger.log("Available users: " + list.map(u => String(u.email || '')).join(', '));
      
      const found = list.find(u => String(u.email || '').toLowerCase() === email);
      if (!found) {
        Logger.log("googleLogin error: User not registered - " + email);
        return _respond({ error: 'User not registered' });
      }
      
      Logger.log("User found: " + found.name);
      
      // Normalize roles/classes/subjects
      const roleStr = (found.roles || found.role || '').toString();
      const roles = roleStr.split(',').map(s => s.trim()).filter(Boolean);
      const classStr = (found.classes || found.Class || found.Classes || '').toString();
      const classes = classStr.split(',').map(s => s.trim()).filter(Boolean);
      const subjStr = (found.subjects || found.Subject || found.Subjects || '').toString();
      const subjects = subjStr.split(',').map(s => s.trim()).filter(Boolean);
      const classTeacherFor = found.classTeacherFor || found['Class Teacher For'] || '';
      
      Logger.log("Login successful for: " + email + ", roles: " + roles.join(', '));
      
      return _respond({
        email,
        name: found.name || userName || '',
        roles,
        classes,
        subjects,
        classTeacherFor,
        picture: userPicture || ''
      });
    }
    
    return _respond({ error: 'Invalid authentication payload format' });
  } catch (err) {
    Logger.log("googleLogin critical error: " + (err && err.message ? err.message : String(err)));
    Logger.log("Stack trace: " + (err && err.stack ? err.stack : 'No stack trace'));
    return _respond({ 
      error: 'googleLogin failed: ' + (err && err.message ? err.message : String(err)),
      details: 'Check Apps Script logs for more information'
    });
  }
  
  // ===== Smart Reminders =====
  if (action === 'getSmartReminders') {
    const teacherEmail = (e.parameter.teacherEmail || '').toLowerCase().trim();
    const advanceNotice = parseInt(e.parameter.advanceNotice || 7);
    
    if (!teacherEmail) {
      return _respond({ error: 'Teacher email is required' });
    }
    
    const result = getSmartReminders(teacherEmail, { advanceNotice });
    return _respond(result);
  }
}

function doPost(e) {
  const data = _parsePost(e);
  const action = (data.action || e.parameter.action || '').trim();
  try {
    Logger.log("Handling POST request for action: " + action);
    Logger.log("POST data: " + JSON.stringify(data));
    
    _bootstrapSheets();
    
    // Handle ping action
    if (action === 'ping') {
      // Use jsonResponse directly if available
      try {
        if (typeof jsonResponse === 'function') {
          return jsonResponse({ ok: true, now: new Date().toISOString() });
        }
      } catch (e) {
        // Fall back to _respond if jsonResponse isn't available
      }
      return _respond({ ok: true, now: new Date().toISOString() });
    }
    
    // googleLogin moved into unified doPost handler
    if (action === 'googleLogin') {
      // The _handleGoogleLogin function already uses _respond internally, which will use jsonResponse if available
      return _handleGoogleLogin(data);
    }
    if (action === 'submitPlan') {
      const sh = _getSheet('Schemes');
      _ensureHeaders(sh, SHEETS.Schemes);
      const now = new Date().toISOString();
      const schemeId = _uuid();
      const line = [
        schemeId,
        (data.email||'').toLowerCase().trim(),
        data.teacherName || '',
        data.class || '',
        data.subject || '',
        Number(data.term||0),
        Number(data.unit||0),
        data.chapter || '',
        data.month || '',
        Number(data.noOfSessions||0),
        'Pending',
        now
      ];
  sh.appendRow(line);
  return _respond({ ok: true });
  }

    if (action === 'updatePlanStatus') {
      const { schemeId, status } = data;
      const sh = _getSheet('Schemes');
      const headers = _headers(sh);
      const idIdx = headers.indexOf('schemeId');
      const statusIdx = headers.indexOf('status');
      const nameIdx = headers.indexOf('teacherName');
      const emailIdx = headers.indexOf('teacherEmail');
      const classIdx = headers.indexOf('class');
      const subjectIdx = headers.indexOf('subject');
      const chapterIdx = headers.indexOf('chapter');
      const sessionsIdx = headers.indexOf('noOfSessions');

      const last = sh.getLastRow();
      if (last < 2) return _respond({ error: 'Not found' });
      const values = sh.getRange(2,1,last-1,headers.length).getValues();
      for (let i=0;i<values.length;i++) {
        if (String(values[i][idIdx]) === String(schemeId)) {
          values[i][statusIdx] = status;
          sh.getRange(2+i,1,1,headers.length).setValues([values[i]]);
          return _respond({ submitted: true });
        }
      }
      return _respond({ error: 'Scheme not found' });
    }

    if (action === 'submitLessonPlanDetails') {
      // Add debug logging
      Logger.log("LP_SUBMIT: Starting lesson plan submission");

      // Accepts payload: lpId, class, subject, session, schemeId (optional),
      // objectives, activities, date, teacherEmail, teacherName, notes
      const { lpId, objectives, activities, date, class: cls, subject, session, schemeId, teacherEmail, teacherName, notes } = data;

      Logger.log(`LP_SUBMIT: Received - class:"${cls}", subject:"${subject}", session:${session}, lpId:${lpId || 'new'}`);
      Logger.log(`LP_SUBMIT: Received - objectives:"${objectives}", activities:"${activities}", date:"${date}"`);
      
      const sh = _getSheet('LessonPlans');
      _ensureHeaders(sh, SHEETS.LessonPlans);
      const headers = _headers(sh);
      const idIdx = headers.indexOf('lpId');
      const classIdx = headers.indexOf('class');
      const subjIdx = headers.indexOf('subject');
      const sessionIdx = headers.indexOf('session');
      const chapterIdx = headers.indexOf('chapter');
      const objIdx = headers.indexOf('objectives');
      const actIdx = headers.indexOf('activities');
      const dateIdx = headers.indexOf('date');
      const statusIdx = headers.indexOf('status');
      const createdAtIdx = headers.indexOf('createdAt');

      const last = sh.getLastRow();
      const values = last >= 2 ? sh.getRange(2,1,last-1,headers.length).getValues() : [];

      // Determine chapter from provided schemeId (if available) to include in duplicate check
      let chapterFromScheme = '';
      if (schemeId) {
        try {
          const sSh = _getSheet('Schemes');
          const sHdr = _headers(sSh);
          const sVals = _rows(sSh).map(r => _indexByHeader(r, sHdr));
          const foundScheme = sVals.find(s => String(s.schemeId || '') === String(schemeId));
          if (foundScheme) chapterFromScheme = String(foundScheme.chapter || '');
        } catch (e) {
          // ignore and continue
        }
      }

      const clsStr = String(cls || '').trim();
      const subjStr = String(subject || '').trim();
      
      // IMPORTANT FIX: Ensure session number is properly converted to a number
      // and never gets lost in the process
      const sessNum = Number(session || 0);
      
      Logger.log(`LP_SUBMIT: Using normalized values - class:"${clsStr}", subject:"${subjStr}", session:${sessNum}`);
      
      // DEBUG HELPER: Show all rows with matching class/subject/session to see why we're not finding them
      Logger.log(`LP_SUBMIT: DEBUG - Showing all rows matching class:${clsStr}, subject:${subjStr}, session:${sessNum}`);
      for (let i=0; i<values.length; i++) {
        const rowClass = String(values[i][classIdx] || '').trim();
        const rowSubj = String(values[i][subjIdx] || '').trim();
        const rowSession = Number(values[i][sessionIdx] || 0);
        
        if (rowClass === clsStr && rowSubj === subjStr && rowSession === sessNum) {
          Logger.log(`LP_SUBMIT: DEBUG MATCH at row ${i+2}:`);
          Logger.log(`  - lpId: ${values[i][idIdx] || '(empty)'}`);
          Logger.log(`  - class: "${rowClass}"`);
          Logger.log(`  - subject: "${rowSubj}"`);
          Logger.log(`  - session: ${rowSession}`);
          Logger.log(`  - chapter: "${values[i][chapterIdx] || '(empty)'}"}`);
          Logger.log(`  - status: "${values[i][statusIdx] || '(empty)'}"}`);
          Logger.log(`  - objectives: "${values[i][objIdx] || '(empty)'}"}`);
          Logger.log(`  - activities: "${values[i][actIdx] || '(empty)'}"}`);
        }
      }
      
      // If explicit lpId is provided, search for that specific row to update first
      if (lpId) {
        Logger.log(`LP_SUBMIT: Looking for exact lpId match: ${lpId}`);
        for (let i=0; i<values.length; i++) {
          const rowLpId = String(values[i][idIdx] || '');
          if (rowLpId === String(lpId)) {
            Logger.log(`LP_SUBMIT: Updating existing row with lpId ${lpId} at position ${i+2}`);
            values[i][objIdx] = objectives || '';
            values[i][actIdx] = activities || '';
            values[i][dateIdx] = date || '';
            values[i][statusIdx] = 'Pending Review';
            // IMPORTANT FIX: Always update the session number if provided
            if (sessNum > 0) {
              values[i][sessionIdx] = sessNum;
              Logger.log(`LP_SUBMIT: Setting session to ${sessNum} for row ${i+2}`);
            }
            // Update other fields if provided
            if (clsStr) values[i][classIdx] = clsStr;
            if (subjStr) values[i][subjIdx] = subjStr;
            if (chapterFromScheme) values[i][chapterIdx] = chapterFromScheme;
            
            sh.getRange(2+i,1,1,headers.length).setValues([values[i]]);
            Logger.log(`LP_SUBMIT: Successfully updated row with lpId ${lpId}`);
            return _respond({ submitted: true });
          }
        }
        Logger.log(`LP_SUBMIT: No existing row found with lpId ${lpId}`);
      }

      // SPECIAL CASE: For STD 7A/English submissions, completely bypass duplicate detection and always create new rows
      // REMOVE THIS AFTER TESTING IS COMPLETE
      Logger.log(`LP_SUBMIT: Checking special case: clsStr="${clsStr}", subjStr="${subjStr}"`);
      Logger.log(`LP_SUBMIT: Special case check: clsStr === 'STD  7A' is ${clsStr === 'STD  7A'}`);
      Logger.log(`LP_SUBMIT: Special case check: clsStr === 'STD 7A' is ${clsStr === 'STD 7A'}`);
      Logger.log(`LP_SUBMIT: Special case check: subjStr === 'English' is ${subjStr === 'English'}`);
      Logger.log(`LP_SUBMIT: DEBUG - Actual values: clsStr=[${clsStr}], subjStr=[${subjStr}]`);
      
      if ((clsStr === 'STD  7A' || clsStr === 'STD 7A') && subjStr === 'English') {
        Logger.log(`LP_SUBMIT: *** SPECIAL CASE *** Bypassing duplicate detection for ${clsStr}/${subjStr}`);
        Logger.log(`LP_SUBMIT: *** SPECIAL CASE *** clsStr: "${clsStr}", subjStr: "${subjStr}", sessNum: ${sessNum}`);
        
        // Create a new row for special case
        const now = new Date().toISOString();
        const newLpId = _uuid();
        const newRow = [];
        newRow[0] = newLpId;
        newRow[1] = (teacherEmail||'').toLowerCase().trim();
        newRow[2] = teacherName || '';
        newRow[3] = clsStr;
        newRow[4] = subjStr;
        newRow[5] = chapterFromScheme || '';
        newRow[6] = sessNum; // IMPORTANT FIX: Explicitly assign the session number
        newRow[7] = objectives || '';
        newRow[8] = activities || '';
        newRow[9] = 'Pending Review';
        newRow[10] = '';
        newRow[11] = date || '';
        newRow[12] = now;
        sh.appendRow(newRow);
        Logger.log(`LP_SUBMIT: Created new row with lpId ${newLpId} for ${clsStr}/${subjStr} with session ${sessNum} (special case)`);
        return _respond({ submitted: true });
      } else {
        Logger.log(`LP_SUBMIT: Special case NOT triggered for clsStr="${clsStr}", subjStr="${subjStr}"`);
      }

      // Search for a matching placeholder row based on class/subject/session combination
      Logger.log(`LP_SUBMIT: Looking for matching placeholder with class:${clsStr}, subject:${subjStr}, session:${sessNum}`);
      for (let i=0; i<values.length; i++) {
        const rowClass = String(values[i][classIdx] || '').trim();
        const rowSubj = String(values[i][subjIdx] || '').trim();
        const rowSession = Number(values[i][sessionIdx] || 0);
        const rowStatus = String(values[i][statusIdx] || '').trim();
        
        // Check for a placeholder (empty or Pending Preparation) with matching class, subject, session
        if (rowClass === clsStr && 
            rowSubj === subjStr && 
            rowSession === sessNum &&
            (rowStatus === 'Pending Preparation' || !values[i][objIdx] || !values[i][actIdx])) {
          
          Logger.log(`LP_SUBMIT: Found matching placeholder at row ${i+2}`);
          values[i][objIdx] = objectives || '';
          values[i][actIdx] = activities || '';
          values[i][dateIdx] = date || '';
          values[i][statusIdx] = 'Pending Review';
          // IMPORTANT FIX: Always ensure session is preserved
          values[i][sessionIdx] = sessNum;
          if (chapterFromScheme) values[i][chapterIdx] = chapterFromScheme;
          
          sh.getRange(2+i,1,1,headers.length).setValues([values[i]]);
          Logger.log(`LP_SUBMIT: Successfully updated placeholder row at ${i+2} with session ${sessNum}`);
          return _respond({ submitted: true });
        }
      }

      // Check for duplicates with exact class/subject/session/chapter
      for (let i=0; i<values.length; i++) {
        const rowClass = String(values[i][classIdx] || '').trim();
        const rowSubj = String(values[i][subjIdx] || '').trim();
        const rowSession = Number(values[i][sessionIdx] || 0);
        const rowChapter = String(values[i][chapterIdx] || '').trim();
        
        // Only consider non-placeholder rows with actual content
        if (rowClass === clsStr && 
            rowSubj === subjStr && 
            rowSession === sessNum &&
            rowChapter === chapterFromScheme &&
            String(values[i][statusIdx] || '') !== 'Pending Preparation') {
          
          Logger.log(`LP_SUBMIT: Found duplicate at row ${i+2} - class:${rowClass}, subject:${rowSubj}, session:${rowSession}, chapter:${rowChapter}`);
          return _respond({ error: 'Duplicate lesson plan exists for this class/subject/session/chapter' });
        }
      }

      // Create a new lesson plan row
      Logger.log(`LP_SUBMIT: No matching row found, creating new lesson plan with session ${sessNum}`);
      const now = new Date().toISOString();
      const newLpId = lpId && String(lpId).trim() ? String(lpId).trim() : _uuid();
      const newRow = [];
      // Build row in the SHEETS.LessonPlans order
      newRow[0] = newLpId; // lpId
      newRow[1] = (teacherEmail||'').toLowerCase().trim(); // teacherEmail
      newRow[2] = teacherName || ''; // teacherName
      newRow[3] = clsStr; // class
      newRow[4] = subjStr; // subject
      newRow[5] = chapterFromScheme || ''; // chapter
      newRow[6] = sessNum; // IMPORTANT FIX: Explicitly assign the session number
      newRow[7] = objectives || '';
      newRow[8] = activities || '';
      newRow[9] = 'Pending Review'; // status
      newRow[10] = ''; // reviewerRemarks
      newRow[11] = date || '';
      newRow[12] = now;
      
      Logger.log(`LP_SUBMIT: Creating new row with session ${sessNum}`);
      sh.appendRow(newRow);
      Logger.log(`LP_SUBMIT: Successfully created new row with lpId ${newLpId} and session ${sessNum}`);
      return _respond({ submitted: true });
    }

    if (action === 'updateLessonPlanDetailsStatus') {
      const { lpId, status, remarks } = data;
      const sh = _getSheet('LessonPlans');
      const headers = _headers(sh);
      const idIdx = headers.indexOf('lpId');
      const statusIdx = headers.indexOf('status');
      const remarksIdx = headers.indexOf('reviewerRemarks');
      const last = sh.getLastRow();
      if (last < 2) return _respond({ error: 'Not found' });
      const values = sh.getRange(2,1,last-1,headers.length).getValues();
      for (let i=0;i<values.length;i++) {
        if (String(values[i][idIdx]) === String(lpId)) {
          values[i][statusIdx] = status;
          if (remarksIdx >= 0) values[i][remarksIdx] = remarks || '';
          sh.getRange(2+i,1,1,headers.length).setValues([values[i]]);
          return _respond({ submitted: true });
        }
      }
      return _respond({ error: 'Lesson plan not found' });
    }

    if (action === 'submitDailyReport') {
      const sh = _getSheet('DailyReports');
      _ensureHeaders(sh, SHEETS.DailyReports);
      const now = new Date().toISOString();
      sh.appendRow([
        data.date || '',
        data.teacherEmail || '',
        data.teacherName || '',
        data.class || '',
        data.subject || '',
        Number(data.period||0),
        data.planType || '',
        data.lessonPlanId || '',
        data.chapter || '',
        data.objectives || '',
        data.activities || '',
        data.completed || '',
        data.notes || '',
        now
      ]);
      
      // Track lesson progress if this was a planned lesson
      if (data.lessonPlanId && data.planType === 'in plan') {
        _trackLessonProgress(data, now);
      }
      
      return _respond({ ok: true });
    }

    if (action === 'assignSubstitution') {
      const sh = _getSheet('Substitutions');
      _ensureHeaders(sh, SHEETS.Substitutions);
      const now = new Date().toISOString();
      
      // Normalize the date to ensure consistent storage
      const normalizedDate = _isoDateString(data.date || '');
      
      Logger.log(`assignSubstitution - Input date: ${data.date}, Normalized: ${normalizedDate}`);
      
      sh.appendRow([
        normalizedDate,
        Number(data.period||0),
        data.class || '',
        data.absentTeacher || '',
        data.regularSubject || '',
        data.substituteTeacher || '',
        data.substituteSubject || '',
        data.note || '',
        now
      ]);
      return _respond({ submitted: true });
    }

    if (action === 'createExam') {
      // Create a new exam.  The payload should include email, creatorName,
      // class, subject, examType, hasInternalMarks, internalMax, externalMax, totalMax and date.
      
      // Check permission before creating exam
      const creatorEmail = (data.email||'').toLowerCase().trim();
      const examClass = data.class || '';
      const examSubject = data.subject || '';
      
      if (!creatorEmail) {
        return _respond({ error: 'Creator email is required' });
      }
      
      // Get user information from Users sheet to validate permissions
      const usersSh = _getSheet('Users');
      const usersHeaders = _headers(usersSh);
      const users = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
      const currentUser = users.find(u => String(u.email||'').toLowerCase() === creatorEmail);
      
      if (!currentUser) {
        return _respond({ error: 'User not found or not authorized' });
      }
      
      // Parse user's role, classes and subjects
      const roleStr = (currentUser.roles || currentUser.role || '').toString().toLowerCase();
      const userClassesStr = (currentUser.classes || currentUser.Class || currentUser.Classes || '').toString();
      const userClasses = userClassesStr ? userClassesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const userSubjectsStr = (currentUser.subjects || currentUser.Subject || currentUser.Subjects || '').toString();
      const userSubjects = userSubjectsStr ? userSubjectsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const userClassTeacherFor = currentUser.classTeacherFor || currentUser['Class Teacher For'] || '';
      
      // Utility function to normalize strings for comparison
      const normKey = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      
      // Check permissions based on role
      const isHeadmaster = roleStr.includes('h m') || roleStr === 'hm' || roleStr.includes('headmaster');
      const isClassTeacher = roleStr.includes('class teacher') || roleStr === 'classteacher';
      
      let hasPermission = false;
      
      if (isHeadmaster) {
        // HM can create exams for any class and subject
        hasPermission = true;
      } else if (isClassTeacher) {
        // Class Teacher can create exams for their class teacher class OR any subject they teach
        const exClass = normKey(examClass);
        const exSubject = normKey(examSubject);
        
        const isClassTeacherForThisClass = userClassTeacherFor && normKey(userClassTeacherFor) === exClass;
        const teachesThisSubject = userSubjects.some(s => normKey(s) === exSubject);
        
        hasPermission = isClassTeacherForThisClass || teachesThisSubject;
      } else {
        // Regular Teacher: can only create exams for classes AND subjects they teach
        const exClass = normKey(examClass);
        const exSubject = normKey(examSubject);
        
        const teachesClass = userClasses.some(c => normKey(c) === exClass);
        const teachesSubject = userSubjects.some(s => normKey(s) === exSubject);
        
        hasPermission = teachesClass && teachesSubject;
      }
      
      if (!hasPermission) {
        return _respond({ error: 'You do not have permission to create an exam for this class and subject' });
      }
      
      const sh = _getSheet('Exams');
      _ensureHeaders(sh, SHEETS.Exams);
      const now = new Date().toISOString();
      
      // Generate readable exam ID based on exam details
      const examId = _generateUniqueExamId(data.examType, data.class, data.subject);
      
      // Normalize date to ISO format (YYYY-MM-DD)
      let examDate = '';
      if (data.date) {
        // If already in ISO format, use as is
        if (/^\d{4}-\d{2}-\d{2}/.test(data.date)) {
          examDate = data.date;
        } else {
          // Try to parse and convert to ISO
          const parsed = new Date(data.date);
          if (!isNaN(parsed.getTime())) {
            examDate = parsed.toISOString().slice(0, 10);
          } else {
            examDate = '';
          }
        }
      }
      
      // Create descriptive exam name in the format: "ExamType - Class - Subject"
      // This makes exams easier to identify in lists and reports
      const examName = `${data.examType || 'Exam'} - ${data.class || ''} - ${data.subject || ''}`;
      
      // Automatically determine if this class has internal marks based on standard
      // Only STD 8, STD 9, and STD 10 have internal marks (CE and TE)
      const autoHasInternalMarks = _classHasInternalMarks(data.class || '');
      const finalHasInternalMarks = data.hasInternalMarks !== undefined ? Boolean(data.hasInternalMarks) : autoHasInternalMarks;
      
      sh.appendRow([
        examId,
        (data.email||'').toLowerCase().trim(),
        data.creatorName || '',
        data.class || '',
        data.subject || '',
        data.examType || '',
        finalHasInternalMarks, // Use class-based logic
        Number(data.internalMax||0),
        Number(data.externalMax||0),
        Number(data.totalMax||0),
        examDate,
        now,
        examName // Add the descriptive exam name
      ]);
      // Populate ExamMarks with a placeholder row for each student in the class.
      try {
        const emSh = _getSheet('ExamMarks');
        _ensureHeaders(emSh, SHEETS.ExamMarks);
        const studentsSh = _getSheet('Students');
        const sHeaders = _headers(studentsSh);
        const students = _rows(studentsSh).map(r => _indexByHeader(r, sHeaders));
        const cls = data.class || '';
        const createdAt = new Date().toISOString();
        students
          .filter(s => String(s.class || '') === String(cls))
          .forEach(s => {
            // Append a placeholder ExamMarks row for each student. DO NOT
            // include teacher details here; marks will be filled when a
            // teacher submits them. This ensures the UI can show the class
            // roster immediately after exam creation.
            emSh.appendRow([
              examId,
              cls,
              data.subject || '',
              '', // teacherEmail (empty until submission)
              '', // teacherName
              s.admNo || '',
              s.name || '',
              data.examType || '', // examType
              '', // internal (ce)
              '', // external (te)
              '', // total
              '', // grade (empty until marks are submitted)
              createdAt
            ]);
          });
      } catch (err) {
        // Non-fatal: if populating ExamMarks fails, log and continue returning examId
        // so exam creation still succeeds. Caller can populate later.
        // Note: Apps Script logging is available via console.log or Logger.
        try { console && console.error && console.error('Failed to populate ExamMarks:', err); } catch (e) {}
      }
  return _respond({ submitted: true, examId });
    }

    if (action === 'createExamWithId') {
      // Create exam with custom ID (for bulk upload)
      // Similar to createExam but uses provided examId instead of generating UUID
      
      const creatorEmail = (data.email||'').toLowerCase().trim();
      const customExamId = data.examId || '';
      
      if (!creatorEmail || !customExamId) {
        return _respond({ error: 'Creator email and examId are required' });
      }
      
      // Check if exam with this ID already exists
      const sh = _getSheet('Exams');
      _ensureHeaders(sh, SHEETS.Exams);
      const headers = _headers(sh);
      const examIdIdx = headers.indexOf('examId');
      
      if (examIdIdx >= 0) {
        const last = sh.getLastRow();
        if (last >= 2) {
          const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
          const existingExam = values.find(row => String(row[examIdIdx]) === String(customExamId));
          if (existingExam) {
            return _respond({ error: `Exam with ID '${customExamId}' already exists` });
          }
        }
      }
      
      const now = new Date().toISOString();
      let examDate = '';
      if (data.date) {
        if (/^\d{4}-\d{2}-\d{2}/.test(data.date)) {
          examDate = data.date;
        } else {
          const parsed = new Date(data.date);
          if (!isNaN(parsed.getTime())) {
            examDate = parsed.toISOString().slice(0, 10);
          }
        }
      }
      
      // Create descriptive exam name
      const examName = `${data.examType || 'Exam'} - ${data.class || ''} - ${data.subject || ''}`;
      
      // Use class-based logic for internal marks if not specified
      const autoHasInternalMarks = _classHasInternalMarks(data.class || '');
      const finalHasInternalMarks = data.hasInternalMarks !== undefined ? Boolean(data.hasInternalMarks) : autoHasInternalMarks;
      
      sh.appendRow([
        customExamId, // Use provided ID instead of UUID
        creatorEmail,
        data.creatorName || '',
        data.class || '',
        data.subject || '',
        data.examType || '',
        finalHasInternalMarks,
        Number(data.internalMax||0),
        Number(data.externalMax||0),
        Number(data.totalMax||0),
        examDate,
        now,
        examName
      ]);
      
      return _respond({ submitted: true, examId: customExamId });
    }
    
    if (action === 'createBulkExams') {
      // Create multiple exams at once for different subjects with the same grading settings
      // Payload should include: email, creatorName, class, examType, hasInternalMarks,
      // internalMax, externalMax, and an array of subjects with their exam dates
      try {
        const { 
          email, 
          creatorName, 
          class: cls, 
          examType, 
          hasInternalMarks, 
          internalMax, 
          externalMax, 
          totalMax,
          subjectExams // Array of {subject, date} objects
        } = data;
        
        if (!email || !cls || !examType || !Array.isArray(subjectExams) || subjectExams.length === 0) {
          return _respond({ error: 'Missing required fields for bulk exam creation' });
        }
        
        const sh = _getSheet('Exams');
        _ensureHeaders(sh, SHEETS.Exams);
        const now = new Date().toISOString();
        
        // Get students for this class (we'll need them for each exam's mark placeholders)
        const studentsSh = _getSheet('Students');
        const sHeaders = _headers(studentsSh);
        const students = _rows(studentsSh)
          .map(r => _indexByHeader(r, sHeaders))
          .filter(s => String(s.class || '') === String(cls));
        
        // Create an exam for each subject
        const examIds = [];
        const emSh = _getSheet('ExamMarks');
        _ensureHeaders(emSh, SHEETS.ExamMarks);
        
        for (const subjectExam of subjectExams) {
          const { subject, date } = subjectExam;
          if (!subject) continue;
          
          // Generate readable exam ID for each subject
          const examId = _generateUniqueExamId(examType, cls, subject);
          examIds.push(examId);
          
          // Normalize date to ISO format (YYYY-MM-DD)
          let examDate = '';
          if (date) {
            // If already in YYYY-MM-DD format, use as-is
            if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
              examDate = date;
            } else {
              // Special handling for common problematic dates
              if (date.includes('31 Dec 99') || date === '31 Dec 1999' || date === '12/31/99' || date === '12/31/1999') {
                // Replace with today's date
                examDate = new Date().toISOString().slice(0, 10);
              } else if (date.includes('1 Jan 1950') || date === '01 Jan 1950' || date === '1/1/1950' || date === '01/01/1950') {
                // Replace with today's date
                examDate = new Date().toISOString().slice(0, 10);
              } else {
                // Try to parse the date
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) {
                  // If date is very old (before 2000), it's likely a placeholder or incorrect date
                  // Replace with current date
                  if (parsed.getFullYear() < 2000) {
                    examDate = new Date().toISOString().slice(0, 10);
                  } else {
                    examDate = parsed.toISOString().slice(0, 10);
                  }
                } else {
                  // If parsing fails, use today's date
                  examDate = new Date().toISOString().slice(0, 10);
                }
              }
            }
          } else {
            // If no date provided, use today's date
            examDate = new Date().toISOString().slice(0, 10);
          }
          
          // Create descriptive exam name
          const examName = `${examType || 'Exam'} - ${cls || ''} - ${subject || ''}`;
          
          // Add the exam to the Exams sheet
          sh.appendRow([
            examId,
            (email || '').toLowerCase().trim(),
            creatorName || '',
            cls || '',
            subject || '',
            examType || '',
            Boolean(hasInternalMarks !== false),
            Number(internalMax || 0),
            Number(externalMax || 0),
            Number(totalMax || 0),
            examDate,
            now,
            examName
          ]);
          
          // Create placeholder mark rows for this exam
          const createdAt = new Date().toISOString();
          try {
            students.forEach(s => {
              emSh.appendRow([
                examId,
                cls,
                subject,
                '', // teacherEmail
                '', // teacherName
                s.admNo || '',
                s.name || '',
                examType || '', // examType
                '', // internal (ce)
                '', // external (te)
                '', // total
                '', // grade (empty until marks are submitted)
                createdAt
              ]);
            });
          } catch (err) {
            console.error(`Failed to create placeholders for ${subject} exam:`, err);
            // Non-fatal error, continue with other subjects
          }
        }
        
        return _respond({ 
          submitted: true, 
          examIds,
          count: examIds.length
        });
      } catch (err) {
        console.error('Error in bulk exam creation:', err);
        return _respond({ error: `Failed to create bulk exams: ${err.message || String(err)}` });
      }
    }

    if (action === 'updateExam') {
      // Update an existing exam. Payload should contain examId and updated fields.
      try {
        const { examId, userEmail, class: cls, subject, examType, hasInternalMarks, internalMax, externalMax, totalMax, date } = data;
        
        if (!examId) {
          return _respond({ error: 'Missing examId' });
        }
        
        if (!userEmail) {
          return _respond({ error: 'User email is required' });
        }
        
        const sh = _getSheet('Exams');
        const headers = _headers(sh);
        const examIdIdx = headers.indexOf('examId');
        const classIdx = headers.indexOf('class');
        const subjectIdx = headers.indexOf('subject');
        const examTypeIdx = headers.indexOf('examType');
        const hasInternalMarksIdx = headers.indexOf('hasInternalMarks');
        const internalMaxIdx = headers.indexOf('internalMax');
        const externalMaxIdx = headers.indexOf('externalMax');
        const totalMaxIdx = headers.indexOf('totalMax');
        const dateIdx = headers.indexOf('date');
        const examNameIdx = headers.indexOf('examName');
        
        const last = sh.getLastRow();
        if (last < 2) {
          return _respond({ error: 'No exams found' });
        }
        
        const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
        
        // Find the exam first to check current class/subject for permission validation
        let examToUpdate = null;
        let examRowIndex = -1;
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][examIdIdx]) === String(examId)) {
            examToUpdate = {
              examId: values[i][examIdIdx],
              class: values[i][classIdx],
              subject: values[i][subjectIdx]
            };
            examRowIndex = i;
            break;
          }
        }
        
        if (!examToUpdate) {
          return _respond({ error: 'Exam not found' });
        }
        
        // Check permission before updating exam
        const editorEmail = userEmail.toLowerCase().trim();
        
        // Get user information from Users sheet to validate permissions
        const usersSh = _getSheet('Users');
        const usersHeaders = _headers(usersSh);
        const users = _rows(usersSh).map(r => _indexByHeader(r, usersHeaders));
        const currentUser = users.find(u => String(u.email||'').toLowerCase() === editorEmail);
        
        if (!currentUser) {
          return _respond({ error: 'User not found or not authorized' });
        }
        
        // Parse user's role, classes and subjects
        const roleStr = (currentUser.roles || currentUser.role || '').toString().toLowerCase();
        const userClassesStr = (currentUser.classes || currentUser.Class || currentUser.Classes || '').toString();
        const userClasses = userClassesStr ? userClassesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const userSubjectsStr = (currentUser.subjects || currentUser.Subject || currentUser.Subjects || '').toString();
        const userSubjects = userSubjectsStr ? userSubjectsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const userClassTeacherFor = currentUser.classTeacherFor || currentUser['Class Teacher For'] || '';
        
        // Utility function to normalize strings for comparison
        const normKey = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        
        // Check permissions based on role - use current exam class/subject for permission check
        const isHeadmaster = roleStr.includes('h m') || roleStr === 'hm' || roleStr.includes('headmaster');
        const isClassTeacher = roleStr.includes('class teacher') || roleStr === 'classteacher';
        
        let hasPermission = false;
        
        if (isHeadmaster) {
          // HM can update any exam
          hasPermission = true;
        } else if (isClassTeacher) {
          // Class Teacher can update exams for their class teacher class OR any subject they teach
          const exClass = normKey(examToUpdate.class);
          const exSubject = normKey(examToUpdate.subject);
          
          const isClassTeacherForThisClass = userClassTeacherFor && normKey(userClassTeacherFor) === exClass;
          const teachesThisSubject = userSubjects.some(s => normKey(s) === exSubject);
          
          hasPermission = isClassTeacherForThisClass || teachesThisSubject;
        } else {
          // Regular Teacher: can only update exams for classes AND subjects they teach
          const exClass = normKey(examToUpdate.class);
          const exSubject = normKey(examToUpdate.subject);
          
          const teachesClass = userClasses.some(c => normKey(c) === exClass);
          const teachesSubject = userSubjects.some(s => normKey(s) === exSubject);
          
          hasPermission = teachesClass && teachesSubject;
        }
        
        if (!hasPermission) {
          return _respond({ error: 'You do not have permission to update this exam' });
        }
        
        // Normalize date to ISO format (YYYY-MM-DD)
        let examDate = '';
        if (date) {
          // If already in ISO format, use as is
          if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
            examDate = date;
          } else {
            // Try to parse and convert to ISO
            const parsed = new Date(date);
            if (!isNaN(parsed.getTime())) {
              examDate = parsed.toISOString().slice(0, 10);
            } else {
              examDate = date; // Keep original value if parsing fails
            }
          }
        }
        
        // Update the exam properties using the found row index
        if (cls) values[examRowIndex][classIdx] = cls;
        if (subject) values[examRowIndex][subjectIdx] = subject;
        if (examType) values[examRowIndex][examTypeIdx] = examType;
        
        // Auto-determine hasInternalMarks based on class if not explicitly provided
        if (hasInternalMarks !== undefined) {
          values[examRowIndex][hasInternalMarksIdx] = Boolean(hasInternalMarks);
        } else if (cls) {
          // If class is being updated, auto-determine internal marks for the new class
          const autoHasInternalMarks = _classHasInternalMarks(cls);
          values[examRowIndex][hasInternalMarksIdx] = autoHasInternalMarks;
        }
        
        if (internalMax !== undefined) values[examRowIndex][internalMaxIdx] = Number(internalMax);
        if (externalMax !== undefined) values[examRowIndex][externalMaxIdx] = Number(externalMax);
        if (totalMax !== undefined) values[examRowIndex][totalMaxIdx] = Number(totalMax);
        if (examDate) values[examRowIndex][dateIdx] = examDate;
        
        // Update exam name to follow the format: "ExamType - Class - Subject"
        const newExamType = examType || String(values[examRowIndex][examTypeIdx]) || 'Exam';
        const newClass = cls || String(values[examRowIndex][classIdx]) || '';
        const newSubject = subject || String(values[examRowIndex][subjectIdx]) || '';
        const newExamName = `${newExamType} - ${newClass} - ${newSubject}`;
        
        if (examNameIdx !== -1) {
          values[examRowIndex][examNameIdx] = newExamName;
        }
        
        // Update the row in the sheet
        sh.getRange(2 + examRowIndex, 1, 1, headers.length).setValues([values[examRowIndex]]);
        
        // Also update class and subject in ExamMarks if they've changed
        if (cls || subject) {
          const originalClass = String(values[examRowIndex][classIdx]);
          const originalSubject = String(values[examRowIndex][subjectIdx]);
          
          if (cls !== originalClass || subject !== originalSubject) {
            try {
              const emSh = _getSheet('ExamMarks');
              const emHeaders = _headers(emSh);
              const emExamIdIdx = emHeaders.indexOf('examId');
              const emClassIdx = emHeaders.indexOf('class');
              const emSubjectIdx = emHeaders.indexOf('subject');
              
              const emLast = emSh.getLastRow();
              if (emLast >= 2) {
                const emValues = emSh.getRange(2, 1, emLast - 1, emHeaders.length).getValues();
                let hasUpdates = false;
                
                for (let j = 0; j < emValues.length; j++) {
                  if (String(emValues[j][emExamIdIdx]) === String(examId)) {
                    // Update class and subject if they've changed
                    if (cls && cls !== originalClass) emValues[j][emClassIdx] = cls;
                    if (subject && subject !== originalSubject) emValues[j][emSubjectIdx] = subject;
                    hasUpdates = true;
                  }
                }
                
                // Write back updates if any were made
                if (hasUpdates) {
                  emSh.getRange(2, 1, emValues.length, emHeaders.length).setValues(emValues);
                }
              }
            } catch (err) {
              console.error('Failed to update ExamMarks:', err);
              // Non-fatal error, continue with success response
            }
          }
        }
        
        return _respond({ updated: true });
      } catch (err) {
        console.error('Error updating exam:', err);
        return _respond({ error: 'Failed to update exam: ' + (err.message || String(err)) });
      }
    }

    if (action === 'getAllExams') {
      // Get all exams
      try {
        const sh = _getSheet('Exams');
        const headers = _headers(sh);
        const exams = _rows(sh).map(r => _indexByHeader(r, headers));
        
        // Format exam data for frontend
        const formattedExams = exams.map(exam => {
          // Normalize date to ISO format (YYYY-MM-DD)
          let examDate = '';
          if (exam.date) {
            // If already in ISO format, use as is
            if (/^\d{4}-\d{2}-\d{2}/.test(exam.date)) {
              examDate = exam.date;
            } else {
              // Try to parse and convert to ISO
              try {
                const parsed = new Date(exam.date);
                if (!isNaN(parsed.getTime())) {
                  examDate = parsed.toISOString().slice(0, 10);
                } else {
                  examDate = exam.date; // Keep as is if can't parse
                }
              } catch (e) {
                examDate = exam.date; // Keep as is if any error
              }
            }
          }
          
          return {
            examId: exam.examId,
            examName: exam.examName || `${exam.examType || 'Exam'} - ${exam.class || ''} - ${exam.subject || ''}`,
            class: exam.class,
            subject: exam.subject,
            examType: exam.examType,
            date: examDate, // Use normalized date
            creatorEmail: exam.creatorEmail,
            creatorName: exam.creatorName,
            hasInternalMarks: exam.hasInternalMarks,
            internalMax: exam.internalMax,
            externalMax: exam.externalMax,
            totalMax: exam.totalMax,
            createdAt: exam.createdAt
          };
        });
        
        // Sort by creation date (newest first)
        formattedExams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return _respond(formattedExams);
        
      } catch (error) {
        console.error('Error getting all exams:', error);
        return _respond({ error: 'Failed to get exams' });
      }
    }

    if (action === 'submitExamMarks') {
      // Submit marks for a given exam.  The payload includes examId,
      // class, subject, teacherEmail, teacherName and an array of marks.
      const examId = data.examId || '';
      const cls = data.class || '';
      const subject = data.subject || '';
      const teacherEmail = (data.teacherEmail||'').toLowerCase().trim();
      const teacherName = data.teacherName || '';
      const marks = Array.isArray(data.marks) ? data.marks : [];
      if (!examId) return _respond({ error: 'Missing examId' });
      
      // Get exam data to check if it has internal marks
      const examsSh = _getSheet('Exams');
      const examHeaders = _headers(examsSh);
      const examRows = _rows(examsSh).map(r => _indexByHeader(r, examHeaders));
      const exam = examRows.find(e => e.examId === examId);
      const hasInternalMarks = exam ? (exam.hasInternalMarks !== false) : true; // Default to true for backwards compatibility
      
      const sh = _getSheet('ExamMarks');
      _ensureHeaders(sh, SHEETS.ExamMarks);
      const now = new Date().toISOString();

      // Read existing rows so we can update (upsert) instead of always appending.
      const headers = _headers(sh);
      const last = sh.getLastRow();
      let values = [];
      if (last >= 2) {
        values = sh.getRange(2, 1, last - 1, headers.length).getValues();
      }

      const examIdIdx = headers.indexOf('examId');
      const admNoIdx = headers.indexOf('admNo');
      const examTypeIdx = headers.indexOf('examType');
      const ceIdx = headers.indexOf('ce');
      const teIdx = headers.indexOf('te');
      const totalIdx = headers.indexOf('total');
      const gradeIdx = headers.indexOf('grade');
      const teacherEmailIdx = headers.indexOf('teacherEmail');
      const teacherNameIdx = headers.indexOf('teacherName');
      const createdAtIdx = headers.indexOf('createdAt');

      // For each incoming mark, try to find an existing row for same examId and admNo
      marks.forEach(m => {
        const adm = String(m.admNo || '');
        const name = String(m.studentName || '');
        
        // Handle absent students (marked with 'A' in external marks)
        const externalValue = m.te || m.external || '';
        const isAbsent = String(externalValue).toUpperCase() === 'A';
        
        // Support both old format (ce/te) and new format (internal/external)
        const ce = isAbsent ? -1 : Number(m.ce || m.internal || 0);
        const te = isAbsent ? -1 : Number(m.te || m.external || 0);
        const total = isAbsent ? -1 : ce + te;
        
        // Calculate grade using the exam's total max marks and class
        let grade = '';
        if (isAbsent) {
          grade = 'Absent';
        } else if (exam && exam.totalMax && total > 0) {
          const percentage = (total / Number(exam.totalMax)) * 100;
          grade = _calculateGradeFromBoundaries(percentage, exam.class || cls);
        }

        let found = -1;
        for (let i = 0; i < values.length; i++) {
          const rowExamId = String(values[i][examIdIdx] || '');
          const rowAdm = String(values[i][admNoIdx] || '');
          const rowName = String(values[i][headers.indexOf('studentName')] || '');
          if (rowExamId === String(examId) && rowAdm && adm && rowAdm === adm) {
            found = i;
            break;
          }
        }

        // If not found by admNo, try matching by studentName (case-insensitive)
        if (found === -1 && name) {
          for (let i = 0; i < values.length; i++) {
            const rowExamId = String(values[i][examIdIdx] || '');
            const rowName = String(values[i][headers.indexOf('studentName')] || '');
            if (rowExamId === String(examId) && rowName && rowName.toLowerCase() === name.toLowerCase()) {
              found = i;
              break;
            }
          }
        }

        if (found >= 0) {
          // Update the in-memory values array; we'll write back the block later.
          if (examTypeIdx >= 0) values[found][examTypeIdx] = exam.examType || '';
          if (ceIdx >= 0) values[found][ceIdx] = ce;
          if (teIdx >= 0) values[found][teIdx] = te;
          values[found][totalIdx] = total;
          if (gradeIdx >= 0) values[found][gradeIdx] = grade;
          if (teacherEmailIdx >= 0) values[found][teacherEmailIdx] = teacherEmail;
          if (teacherNameIdx >= 0) values[found][teacherNameIdx] = teacherName;
          if (createdAtIdx >= 0) values[found][createdAtIdx] = now;
        } else {
          // No existing row: append a new row
          sh.appendRow([
            examId,
            cls,
            subject,
            teacherEmail,
            teacherName,
            m.admNo || '',
            m.studentName || '',
            exam.examType || '',
            ce,
            te,
            total,
            grade,
            now
          ]);
        }
      });

      // Write back any updates we made to the existing block of rows
      if (values.length > 0) {
        sh.getRange(2, 1, values.length, headers.length).setValues(values);
      }

      return _respond({ ok: true });
    }

    if (action === 'submitAttendance') {
      // Record attendance for a class on a given date.  The payload should
      // include date, class, teacherEmail, teacherName and an array of
      // attendance records ({ admNo, studentName, status }).  Each record is
      // appended to the Attendance sheet.
      const { date, class: cls, teacherEmail, teacherName, records } = data;
      const recs = Array.isArray(records) ? records : [];
      const sh = _getSheet('Attendance');
      _ensureHeaders(sh, SHEETS.Attendance);
      const now = new Date().toISOString();
      recs.forEach(r => {
        sh.appendRow([
          date || '',
          cls || '',
          r.admNo || '',
          r.studentName || '',
          r.status || '',
          (teacherEmail||'').toLowerCase().trim(),
          teacherName || '',
          now
        ]);
      });
      return _respond({ ok: true });
    }

    if (action === 'getStudentReportCard') {
      // Get report card data for a student or class
      // Parameters: examType (e.g., "Term 1"), class, admNo (optional for specific student)
      const admNo = e.parameter.admNo || '';
      const cls = e.parameter.class || '';
      const examType = e.parameter.examType || '';
      
      if (!examType) {
        return _respond({ error: 'ExamType is required' });
      }
      
      if (!admNo && !cls) {
        return _respond({ error: 'Either admNo or class is required' });
      }
      
      try {
        // First, get all exams matching the examType and class
        const examSh = _getSheet('Exams');
        const examHeaders = _headers(examSh);
        const examData = _rows(examSh).map(r => _indexByHeader(r, examHeaders));
        
        // Filter exams by examType and class
        const matchingExams = examData.filter(ex => {
          const exType = String(ex.examType || '').trim();
          const exClass = String(ex.class || '').trim();
          
          // Match examType
          if (exType !== examType) return false;
          
          // If class specified, match class
          if (cls && exClass !== cls) return false;
          
          return true;
        });
        
        if (matchingExams.length === 0) {
          return _respond({ error: 'No exams found for this exam type and class' });
        }
        
        // Get examIds for all matching exams
        const examIds = matchingExams.map(ex => String(ex.examId || ''));
        
        const marksSh = _getSheet('ExamMarks');
        const marksHeaders = _headers(marksSh);
        const marksData = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));
        
        // Filter marks by examIds and admNo/class
        let filteredMarks = marksData.filter(mark => {
          const markExamId = String(mark.examId || '');
          
          // Check if mark's examId is in our list of matching examIds
          if (!examIds.includes(markExamId)) return false;
          
          // If admNo specified, filter by it
          if (admNo) {
            return String(mark.admNo || '') === String(admNo);
          }
          
          // If class specified, filter by it
          if (cls) {
            return String(mark.class || '') === String(cls);
          }
          
          return false;
        });
        
        if (filteredMarks.length === 0) {
          return _respond({ students: [], subjects: [] });
        }
        
        // Get all unique subjects for this exam type
        const subjects = [...new Set(filteredMarks.map(mark => String(mark.subject || '')).filter(Boolean))].sort();
        
        // Group marks by student (admNo)
        const studentMap = {};
        filteredMarks.forEach(mark => {
          const studentAdm = String(mark.admNo || '');
          const studentName = String(mark.studentName || '');
          const subject = String(mark.subject || '');
          
          // Handle absent students properly (-1 stored value means absent)
          const internal = Number(mark.internal || 0);
          const external = Number(mark.external || 0);
          const total = Number(mark.total || 0);
          const grade = String(mark.grade || 'N/A').trim();
          
          // Check if student was absent (stored as -1)
          const isAbsent = internal === -1 || external === -1 || total === -1;
          
          if (!studentMap[studentAdm]) {
            studentMap[studentAdm] = {
              admNo: studentAdm,
              studentName: studentName,
              subjects: {}
            };
          }
          
          studentMap[studentAdm].subjects[subject] = {
            internal: isAbsent ? 'Absent' : internal,
            external: isAbsent ? 'Absent' : external,
            total: isAbsent ? 'Absent' : total,
            grade: isAbsent ? 'Absent' : grade
          };
        });
        
        // Convert to array and ensure all students have entries for all subjects
        const students = Object.values(studentMap).map(student => {
          subjects.forEach(subject => {
            if (!student.subjects[subject]) {
              student.subjects[subject] = {
                internal: 0,
                external: 0,
                total: 0,
                grade: 'N/A'
              };
            }
          });
          return student;
        });
        
        // Sort students by name
        students.sort((a, b) => a.studentName.localeCompare(b.studentName));
        
        return _respond({ students: students, subjects: subjects });
        
      } catch (error) {
        console.error('Error getting report card:', error);
        return _respond({ error: 'Failed to get report card data' });
      }
    }
    
    if (action === 'saveCalendarEvent') {
      // Save a personal calendar event
      // Required data fields: userEmail, title, startTime, endTime
      // Optional fields: class, subject, notes, type, color, allDay
      const sh = _getSheet('CalendarEvents');
      _ensureHeaders(sh, SHEETS.CalendarEvents);
      const now = new Date().toISOString();
      const eventId = data.eventId || _uuid();
      
      // Check if this is an update to existing event
      if (data.eventId) {
        const headers = _headers(sh);
        const idIdx = headers.indexOf('eventId');
        const last = sh.getLastRow();
        if (last >= 2) {
          const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
          
          for (let i = 0; i < values.length; i++) {
            if (String(values[i][idIdx]) === String(eventId)) {
              // Found existing event, update it
              const row = [];
              for (let j = 0; j < headers.length; j++) {
                const field = headers[j];
                if (field === 'eventId') {
                  row.push(eventId);
                } else if (field === 'createdAt') {
                  row.push(values[i][j] || now); // Keep original creation date
                } else if (data[field] !== undefined) {
                  row.push(data[field]);
                } else {
                  row.push(values[i][j] || ''); // Keep existing value
                }
              }
              
              sh.getRange(i + 2, 1, 1, headers.length).setValues([row]);
              return _respond({ saved: true, eventId });
            }
          }
        }
      }
      
      // If not found or new event, create a new row
      sh.appendRow([
        eventId,
        (data.userEmail || '').toLowerCase().trim(),
        data.title || 'Untitled Event',
        data.startTime || now,
        data.endTime || now,
        data.class || '',
        data.subject || '',
        data.notes || '',
        data.type || 'personal',
        data.color || '#8b5cf6', // Default purple for personal events
        data.allDay === true ? 'true' : 'false',
        now
      ]);
      
      return _respond({ saved: true, eventId });
    }
    
    if (action === 'deleteCalendarEvent') {
      // Delete a personal calendar event by ID
      const eventId = data.eventId;
      if (!eventId) return _respond({ error: 'Missing eventId' });
      
      const sh = _getSheet('CalendarEvents');
      const headers = _headers(sh);
      const idIdx = headers.indexOf('eventId');
      const last = sh.getLastRow();
      
      if (last < 2) return _respond({ error: 'No events found' });
      
      const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][idIdx]) === String(eventId)) {
          // Found the event, delete the row
          sh.deleteRow(i + 2);
          return _respond({ deleted: true });
        }
      }
      
      return _respond({ error: 'Event not found' });
    }

    if (action === 'addSubstitution') {
      // Add a new substitution record
      const {
        date,
        period,
        class: className,
        absentTeacher,
        regularSubject,
        substituteTeacher,
        substituteSubject,
        note
      } = data;
      
      Logger.log(`addSubstitution - Request data: ${JSON.stringify(data)}`);
      
      // Validate required fields
      if (!date || !period || !className || !absentTeacher || !substituteTeacher) {
        const missing = [];
        if (!date) missing.push('date');
        if (!period) missing.push('period');
        if (!className) missing.push('class');
        if (!absentTeacher) missing.push('absentTeacher');
        if (!substituteTeacher) missing.push('substituteTeacher');
        
        Logger.log(`addSubstitution - Missing fields: ${missing.join(', ')}`);
        return _respond({ error: 'Missing required fields: ' + missing.join(', ') });
      }
      
      try {
        const sh = _getSheet('Substitutions');
        _ensureHeaders(sh, SHEETS.Substitutions);
        const now = new Date().toISOString();
        
        // Normalize the date for consistent storage and comparison
        const normalizedDate = _isoDateString(date);
        Logger.log(`addSubstitution - Original date: ${date}, normalized: ${normalizedDate}`);
        
        // Check if substitution already exists for this date/period/class
        const headers = _headers(sh);
        Logger.log(`addSubstitution - Sheet headers: ${headers.join(', ')}`);
        
        // Get all data directly to ensure we see everything
        const lastRow = sh.getLastRow();
        const lastCol = sh.getLastColumn();
        
        let existingRows = [];
        if (lastRow > 1) {
          // Get all data rows (skip header)
          const allData = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
          
          // Convert to indexed objects
          existingRows = allData.map(row => {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = row[i];
            });
            return obj;
          });
        }
        
        Logger.log(`addSubstitution - Existing rows count: ${existingRows.length}`);
        
        const duplicate = existingRows.find(row => 
          _isoDateString(row.date || '') === normalizedDate &&
          parseInt(row.period || 0) === parseInt(period) &&
          String(row.class || '') === String(className)
        );
        
        if (duplicate) {
          Logger.log(`addSubstitution - Found duplicate: ${JSON.stringify(duplicate)}`);
          return _respond({ error: 'Substitution already exists for this date, period, and class' });
        }
        
        // Data to add
        const newRow = [
          normalizedDate,
          parseInt(period),
          String(className),
          String(absentTeacher),
          String(regularSubject || ''),
          String(substituteTeacher),
          String(substituteSubject || regularSubject || ''),
          String(note || ''),
          now
        ];
        
        Logger.log(`addSubstitution - Adding new row: ${newRow.join(', ')}`);
        
        // Add the new substitution
        sh.appendRow(newRow);
        
        // Verify the row was added - use direct sheet access
        const newLastRow = sh.getLastRow();
        Logger.log(`addSubstitution - Sheet rows before: ${lastRow}, after: ${newLastRow}`);
        
        // Force flush to ensure changes are committed
        SpreadsheetApp.flush();
        
        // Get newly added row directly
        let justAdded = null;
        if (newLastRow > lastRow) {
          const newRowData = sh.getRange(newLastRow, 1, 1, lastCol).getValues()[0];
          const newRowObj = {};
          headers.forEach((h, i) => {
            newRowObj[h] = newRowData[i];
          });
          justAdded = newRowObj;
          Logger.log(`addSubstitution - Successfully added new row: ${JSON.stringify(justAdded)}`);
        } else {
          Logger.log(`addSubstitution - WARNING: Row count didn't increase after append!`);
        }
        
        // Return the success response along with the newly added data for verification
        return _respond({ 
          success: true, 
          message: 'Substitution assigned successfully',
          date: normalizedDate,
          period: parseInt(period),
          class: className,
          substituteTeacher: substituteTeacher,
          newRow: justAdded,
          refreshNeeded: true
        });
      } catch (err) {
        Logger.log(`addSubstitution - ERROR: ${err.message || err}`);
        return _respond({ error: String(err.message || err) });
      }
    }

    if (action === 'deleteSubstitution') {
      // Delete a substitution record
      const { date, period, class: className } = data;
      
      if (!date || !period || !className) {
        return _respond({ error: 'Missing required fields: date, period, class' });
      }
      
      try {
        const sh = _getSheet('Substitutions');
        const headers = _headers(sh);
        const last = sh.getLastRow();
        
        if (last < 2) return _respond({ error: 'No substitutions found' });
        
        const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
        const dateIdx = headers.indexOf('date');
        const periodIdx = headers.indexOf('period');
        const classIdx = headers.indexOf('class');
        
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][dateIdx]) === String(date) &&
              parseInt(values[i][periodIdx]) === parseInt(period) &&
              String(values[i][classIdx]) === String(className)) {
            sh.deleteRow(i + 2);
            return _respond({ success: true, message: 'Substitution deleted successfully' });
          }
        }
        
        return _respond({ error: 'Substitution not found' });
      } catch (err) {
        return _respond({ error: String(err.message || err) });
      }
    }

    if (action === 'debugExamMarks') {
      return _respond(debugExamMarks());
    }

    if (action === 'addGradeColumn') {
      return _respond({ result: addGradeColumnToExamMarks() });
    }

    if (action === 'addHasInternalMarksColumn') {
      return _respond({ result: addHasInternalMarksColumnToExams() });
    }
    
    // IT Lab - Get all free teachers for a period
    if (action === 'getFreeTeachers') {
      try {
        const date = (data.date || '').trim();
        const period = Number(data.period || 0);
        
        const userSh = _getSheet('Users');
        const userHeaders = _headers(userSh);
        const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));

        const tSh = _getSheet('Timetable');
        const tHeaders = _headers(tSh);
        const dayName = _dayName(date);
        
        // Determine which teachers have a class at the given day and period
        const dayRecords = _rows(tSh)
          .map(r => _indexByHeader(r, tHeaders))
          .filter(r => _normalizeDayName(String(r.dayOfWeek || '')) === _normalizeDayName(dayName) && Number(r.period || 0) === period);
        
        // Build a set of busy identifiers (both name and email lowercased)
        const busy = new Set();
        dayRecords.forEach(r => {
          const tn = String(r.teacherName || '').toLowerCase();
          const te = String(r.teacherEmail || '').toLowerCase();
          if (tn) busy.add(tn);
          if (te) busy.add(te);
        });
        
        // Check existing substitutions for this date/period
        const subSh = _getSheet('Substitutions');
        const subHeaders = _headers(subSh);
        const existingSubs = _rows(subSh)
          .map(r => _indexByHeader(r, subHeaders))
          .filter(r => _isoDateString(r.date) === _isoDateString(date) && Number(r.period || 0) === period);
        
        // Add substitute teachers to busy list
        existingSubs.forEach(sub => {
          const st = String(sub.substituteTeacher || '').toLowerCase();
          if (st) busy.add(st);
        });
        
        const free = users.filter(u => {
          const nameLower = String(u.name || '').toLowerCase();
          const emailLower = String(u.email || '').toLowerCase();
          // Exclude teachers who are busy at this slot
          const isBusy = (nameLower && busy.has(nameLower)) || (emailLower && busy.has(emailLower));
          return (nameLower || emailLower) && !isBusy;
        });
        
        // Return objects { name, email }
        const freeTeachers = free
          .map(u => ({ name: String(u.name || ''), email: String(u.email || '') }))
          .filter(p => p.name || p.email);
        freeTeachers.sort((a,b) => a.name.localeCompare(b.name));
        
        return _respond(freeTeachers);
      } catch (error) {
        return _respond({ error: error.toString() });
      }
    }

    return _respond({ error: 'Unknown action' });
  } catch (err) {
    return _respond({ error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Create test users for development/testing
 * Call this function once to set up initial users
 */
function createTestUsers() {
  const sh = _getSheet('Users');
  _ensureHeaders(sh, SHEETS.Users);
  
  // Check if test users already exist
  const headers = _headers(sh);
  const existingUsers = _rows(sh).map(r => _indexByHeader(r, headers));
  
  const testUsers = [
    {
      email: 'test@test.com',
      name: 'Test User',
      roles: 'h m',
      classes: '10A,10B',
      subjects: 'Math,Science',
      classTeacherFor: '10A',
      password: '' // No password for easy testing
    },
    {
      email: 'teacher@test.com', 
      name: 'Test Teacher',
      roles: 'teacher',
      classes: '9A,9B',
      subjects: 'English,History',
      classTeacherFor: '9A',
      password: ''
    }
  ];
  
  testUsers.forEach(user => {
    const exists = existingUsers.find(u => String(u.email || '').toLowerCase() === user.email.toLowerCase());
    if (!exists) {
      sh.appendRow([
        user.email,
        user.name,
        user.roles,
        user.classes,
        user.subjects,
        user.classTeacherFor,
        user.password
      ]);
      Logger.log(`Created test user: ${user.email}`);
    } else {
      Logger.log(`Test user already exists: ${user.email}`);
    }
  });
  
  Logger.log('Test users setup complete');
}

/**
 * TEST FUNCTIONS - Use these in Apps Script editor to verify functionality
 */

/**
 * Test the substitution workflow manually
 * Run this function in Apps Script editor to verify everything works
 */
function testSubstitutionWorkflow() {
  try {
    console.log('=== Testing Substitution Workflow ===');
    
    // Test 1: Get potential absent teachers
    console.log('1. Testing getPotentialAbsentTeachers...');
    const e1 = { parameter: { action: 'getPotentialAbsentTeachers' } };
    const teachers = JSON.parse(doGet(e1).getContent());
    console.log('Potential absent teachers:', teachers);
    
    if (!teachers || teachers.length === 0) {
      throw new Error('No teachers found in Users sheet');
    }
    
    // Test 2: Get teacher daily timetable for today (Friday)
    console.log('2. Testing getTeacherDailyTimetable...');
    const testDate = '2025-10-03'; // Friday
    const testTeacher = teachers[0]; // Use first teacher
    const teacherIdentifier = testTeacher.email || testTeacher.name;
    console.log('Testing with teacher:', testTeacher, 'on date:', testDate);
    
    const e2 = { parameter: { action: 'getTeacherDailyTimetable', email: teacherIdentifier, date: testDate } };
    const timetable = JSON.parse(doGet(e2).getContent());
    console.log('Teacher timetable:', timetable);
    
    // Test 3: Get free teachers for a specific period
    if (timetable && timetable.length > 0) {
      console.log('3. Testing getFreeTeachers...');
      const testPeriod = timetable[0].period;
      const e3 = { 
        parameter: { 
          action: 'getFreeTeachers', 
          date: testDate, 
          period: testPeriod,
          absent: [teacherIdentifier]
        } 
      };
      const freeTeachers = JSON.parse(doGet(e3).getContent());
      console.log(`Free teachers for period ${testPeriod}:`, freeTeachers);
    }
    
    // Test 4: Day name normalization
    console.log('4. Testing day name normalization...');
    const dayName = _dayName(testDate);
    const normalized = _normalizeDayName(dayName);
    console.log(`Date: ${testDate}, Day: ${dayName}, Normalized: ${normalized}`);
    
    console.log('=== All tests completed successfully! ===');
    return 'Tests passed!';
    
  } catch (error) {
    console.error('Test failed:', error);
    return `Test failed: ${error.message}`;
  }
}

/**
 * Track lesson progress when a daily report is submitted
 */
function _trackLessonProgress(reportData, timestamp) {
  try {
    const progressSh = _getSheet('LessonProgress');
    _ensureHeaders(progressSh, SHEETS.LessonProgress);
    
    // Get the lesson plan details to find the scheme
    const lpSh = _getSheet('LessonPlans');
    const lpHeaders = _headers(lpSh);
    const lessonPlans = _rows(lpSh).map(r => _indexByHeader(r, lpHeaders));
    
    const lessonPlan = lessonPlans.find(lp => lp.lpId === reportData.lessonPlanId);
    if (!lessonPlan) return; // Lesson plan not found
    
    // Find the associated scheme
    const schemesSh = _getSheet('Schemes');
    const schemesHeaders = _headers(schemesSh);
    const schemes = _rows(schemesSh).map(r => _indexByHeader(r, schemesHeaders));
    
    const scheme = schemes.find(s => 
      s.teacherEmail === lessonPlan.teacherEmail &&
      s.class === lessonPlan.class &&
      s.subject === lessonPlan.subject &&
      s.chapter === lessonPlan.chapter
    );
    
    if (!scheme) return; // No matching scheme found
    
    // Check if progress entry already exists
    const progressHeaders = _headers(progressSh);
    const progressEntries = _rows(progressSh).map(r => _indexByHeader(r, progressHeaders));
    
    const existingProgress = progressEntries.find(p => 
      p.lpId === reportData.lessonPlanId && 
      p.teacherEmail === reportData.teacherEmail
    );
    
    // Calculate completion percentage and status
    const completionStatus = String(reportData.completed || '').toLowerCase();
    let completionPercentage = 0;
    let status = 'Pending';
    
    if (completionStatus.includes('fully completed')) {
      completionPercentage = 100;
      status = 'Completed';
    } else if (completionStatus.includes('partially completed')) {
      completionPercentage = 50;
      status = 'InProgress';
    } else {
      completionPercentage = 0;
      status = 'Pending';
    }
    
    // Calculate delay days (if the lesson was supposed to be done earlier)
    const reportDate = new Date(reportData.date);
    const plannedDate = new Date(lessonPlan.date || reportData.date);
    const delayDays = Math.max(0, Math.floor((reportDate - plannedDate) / (1000 * 60 * 60 * 24)));
    
    if (delayDays > 0 && status !== 'Completed') {
      status = 'Delayed';
    }
    
    const progressId = existingProgress ? existingProgress.progressId : _uuid();
    
    const progressData = [
      progressId,
      scheme.schemeId || '',
      reportData.lessonPlanId || '',
      reportData.teacherEmail || '',
      reportData.teacherName || '',
      reportData.class || '',
      reportData.subject || '',
      reportData.chapter || '',
      lessonPlan.session || 1,
      lessonPlan.date || reportData.date,
      reportData.date,
      status,
      delayDays,
      completionPercentage,
      reportData.notes || '',
      existingProgress ? existingProgress.createdAt : timestamp,
      timestamp
    ];
    
    if (existingProgress) {
      // Update existing progress
      const progressRows = progressSh.getDataRange().getValues();
      for (let i = 1; i < progressRows.length; i++) {
        if (progressRows[i][0] === progressId) {
          progressSh.getRange(i + 1, 1, 1, progressData.length).setValues([progressData]);
          break;
        }
      }
    } else {
      // Create new progress entry
      progressSh.appendRow(progressData);
    }
    
  } catch (error) {
    console.error('Error tracking lesson progress:', error);
  }
}

/**
 * Get lesson progress summary for a teacher
 */
function getLessonProgressSummary(teacherEmail, cls = '', subject = '') {
  try {
    const progressSh = _getSheet('LessonProgress');
    const headers = _headers(progressSh);
    const progressEntries = _rows(progressSh).map(r => _indexByHeader(r, headers));
    
    let filtered = progressEntries.filter(p => 
      String(p.teacherEmail || '').toLowerCase() === teacherEmail.toLowerCase()
    );
    
    if (cls) {
      filtered = filtered.filter(p => p.class === cls);
    }
    
    if (subject) {
      filtered = filtered.filter(p => p.subject === subject);
    }
    
    // Calculate summary statistics
    const total = filtered.length;
    const completed = filtered.filter(p => p.status === 'Completed').length;
    const delayed = filtered.filter(p => p.status === 'Delayed').length;
    const inProgress = filtered.filter(p => p.status === 'InProgress').length;
    const pending = filtered.filter(p => p.status === 'Pending').length;
    
    const totalDelayDays = filtered.reduce((sum, p) => sum + (Number(p.delayDays) || 0), 0);
    const avgDelayDays = total > 0 ? (totalDelayDays / total).toFixed(1) : 0;
    
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    
    return {
      summary: {
        total,
        completed,
        delayed,
        inProgress,
        pending,
        totalDelayDays,
        avgDelayDays,
        completionRate
      },
      details: filtered.map(p => ({
        progressId: p.progressId,
        schemeId: p.schemeId,
        lpId: p.lpId,
        class: p.class,
        subject: p.subject,
        chapter: p.chapter,
        session: p.session,
        plannedDate: p.plannedDate,
        actualDate: p.actualDate,
        status: p.status,
        delayDays: p.delayDays,
        completionPercentage: p.completionPercentage,
        notes: p.notes
      }))
    };
    
  } catch (error) {
    console.error('Error getting lesson progress summary:', error);
    return { summary: {}, details: [] };
  }
}

/**
 * Get lesson progress summary for all teachers (HM view)
 */
function getAllLessonProgressSummary(teacherEmail = '', cls = '', subject = '') {
  try {
    const progressSh = _getSheet('LessonProgress');
    const headers = _headers(progressSh);
    const progressEntries = _rows(progressSh).map(r => _indexByHeader(r, headers));
    
    let filtered = progressEntries;
    
    // Apply teacher filter if specified
    if (teacherEmail) {
      filtered = filtered.filter(p => 
        String(p.teacherEmail || '').toLowerCase().includes(teacherEmail.toLowerCase())
      );
    }
    
    // Apply class filter if specified
    if (cls) {
      filtered = filtered.filter(p => p.class === cls);
    }
    
    // Apply subject filter if specified
    if (subject) {
      filtered = filtered.filter(p => p.subject === subject);
    }
    
    // Calculate summary statistics
    const total = filtered.length;
    const completed = filtered.filter(p => p.status === 'Completed').length;
    const delayed = filtered.filter(p => p.status === 'Delayed').length;
    const inProgress = filtered.filter(p => p.status === 'InProgress').length;
    const pending = filtered.filter(p => p.status === 'Pending').length;
    
    const totalDelayDays = filtered.reduce((sum, p) => sum + (Number(p.delayDays) || 0), 0);
    const avgDelayDays = total > 0 ? (totalDelayDays / total).toFixed(1) : 0;
    
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    
    // Group by teacher for HM overview
    const teacherStats = {};
    filtered.forEach(p => {
      const teacher = p.teacherEmail || 'Unknown';
      if (!teacherStats[teacher]) {
        teacherStats[teacher] = {
          teacherEmail: teacher,
          teacherName: p.teacherName || teacher,
          total: 0,
          completed: 0,
          delayed: 0,
          inProgress: 0,
          pending: 0,
          totalDelayDays: 0
        };
      }
      teacherStats[teacher].total++;
      if (p.status === 'Completed') teacherStats[teacher].completed++;
      if (p.status === 'Delayed') teacherStats[teacher].delayed++;
      if (p.status === 'InProgress') teacherStats[teacher].inProgress++;
      if (p.status === 'Pending') teacherStats[teacher].pending++;
      teacherStats[teacher].totalDelayDays += (Number(p.delayDays) || 0);
    });
    
    // Calculate completion rates for each teacher
    Object.values(teacherStats).forEach(stats => {
      stats.completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0;
      stats.avgDelayDays = stats.total > 0 ? (stats.totalDelayDays / stats.total).toFixed(1) : 0;
    });
    
    return {
      summary: {
        total,
        completed,
        delayed,
        inProgress,
        pending,
        totalDelayDays,
        avgDelayDays,
        completionRate,
        teacherCount: Object.keys(teacherStats).length
      },
      teacherStats: Object.values(teacherStats),
      details: filtered.map(p => ({
        progressId: p.progressId,
        schemeId: p.schemeId,
        lpId: p.lpId,
        teacherEmail: p.teacherEmail,
        teacherName: p.teacherName || p.teacherEmail,
        class: p.class,
        subject: p.subject,
        chapter: p.chapter,
        session: p.session,
        plannedDate: p.plannedDate,
        actualDate: p.actualDate,
        status: p.status,
        delayDays: p.delayDays,
        completionPercentage: p.completionPercentage,
        notes: p.notes
      }))
    };
    
  } catch (error) {
    console.error('Error getting all lesson progress summary:', error);
    return { summary: {}, teacherStats: [], details: [] };
  }
}

/**
 * Quick test to verify your spreadsheet data
 */
function testSpreadsheetData() {
  try {
    console.log('=== Testing Spreadsheet Data ===');
    
    // Test Users sheet
    const usersSh = _getSheet('Users');
    const usersHeaders = _headers(usersSh);
    const usersData = _rows(usersSh);
    console.log('Users sheet headers:', usersHeaders);
    console.log('Users count:', usersData.length);
    if (usersData.length > 0) {
      console.log('Sample user:', _indexByHeader(usersData[0], usersHeaders));
    }
    
    // Test Timetable sheet
    const timetableSh = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSh);
    const timetableData = _rows(timetableSh);
    console.log('Timetable sheet headers:', timetableHeaders);
    console.log('Timetable entries count:', timetableData.length);
    if (timetableData.length > 0) {
      console.log('Sample timetable entry:', _indexByHeader(timetableData[0], timetableHeaders));
    }
    
    return 'Spreadsheet data check completed!';
    
  } catch (error) {
    console.error('Spreadsheet test failed:', error);
    return `Spreadsheet test failed: ${error.message}`;
  }
}

/**
 * Debug function to check exam marks data
 */
function debugExamMarks() {
  try {
    const marksSh = _getSheet('ExamMarks');
    const marksHeaders = _headers(marksSh);
    const marksData = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));
    
    console.log('ExamMarks Headers:', marksHeaders);
    console.log('ExamMarks Data Count:', marksData.length);
    console.log('Sample ExamMarks Data:', marksData.slice(0, 3));
    
    // Also check Exams data
    const examsSh = _getSheet('Exams');
    const examsHeaders = _headers(examsSh);
    const examsData = _rows(examsSh).map(r => _indexByHeader(r, examsHeaders));
    
    console.log('Exams Headers:', examsHeaders);
    console.log('Exams Data Count:', examsData.length);
    console.log('Sample Exams Data:', examsData.slice(0, 3));
    
    return {
      examMarks: {
        headers: marksHeaders,
        count: marksData.length,
        sample: marksData.slice(0, 3)
      },
      exams: {
        headers: examsHeaders,
        count: examsData.length,
        sample: examsData.slice(0, 3)
      }
    };
  } catch (error) {
    console.error('Debug exam marks error:', error);
    return { error: error.message };
  }
}

/**
 * Test function to debug day name recognition
 */
function testDayNameRecognition() {
  const testDate = '2025-10-17';
  const dayName = _dayName(testDate);
  const normalizedDay = _normalizeDayName(dayName);
  
  console.log('Test date:', testDate);
  console.log('Day name from _dayName:', dayName);
  console.log('Normalized day name:', normalizedDay);
  console.log('Script timezone:', Session.getScriptTimeZone());
  
  // Test the Date parsing directly
  const d = new Date(testDate + 'T00:00:00');
  console.log('Date object:', d);
  console.log('Day from toLocaleDateString:', d.toLocaleDateString('en-US', { weekday: 'long' }));
  console.log('Day from Utilities.formatDate:', Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE'));
  
  return {
    testDate,
    dayName,
    normalizedDay,
    timezone: Session.getScriptTimeZone()
  };
}

/**
 * ======= EMAIL NOTIFICATION SYSTEM =======
 */

/**
 * Send email notification
 */
function sendEmailNotification(to, subject, body, options = {}) {
  try {
    const emailOptions = {
      htmlBody: body,
      name: 'AyathanWorkflow System',
      ...options
    };
    
    // Send the email
    GmailApp.sendEmail(to, subject, '', emailOptions);
    
    // Log the notification
    _logNotification({
      type: 'email',
      to: to,
      subject: subject,
      status: 'sent',
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Log the failed notification
    _logNotification({
      type: 'email',
      to: to,
      subject: subject,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Send lesson plan approval notification
 */
function sendLessonApprovalNotification(teacherEmail, teacherName, lessonPlan, status) {
  const subject = `Lesson Plan ${status} - ${lessonPlan.class} ${lessonPlan.subject}`;
  
  let body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Lesson Plan ${status}</h2>
      <p>Dear ${teacherName},</p>
      <p>Your lesson plan has been <strong>${status.toLowerCase()}</strong>:</p>
      
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Class:</strong> ${lessonPlan.class}</p>
        <p><strong>Subject:</strong> ${lessonPlan.subject}</p>
        <p><strong>Chapter:</strong> ${lessonPlan.chapter || 'N/A'}</p>
        <p><strong>Session:</strong> ${lessonPlan.session}</p>
      </div>
  `;
  
  if (status === 'Approved') {
    body += `
      <p style="color: #16a34a;">✅ Your lesson plan has been approved and is ready for implementation.</p>
    `;
  } else if (status === 'Rejected') {
    body += `
      <p style="color: #dc2626;">❌ Your lesson plan needs revision. Please check the reviewer remarks and resubmit.</p>
      ${lessonPlan.reviewerRemarks ? `<p><strong>Remarks:</strong> ${lessonPlan.reviewerRemarks}</p>` : ''}
    `;
  }
  
  body += `
      <p>Please log in to the AyathanWorkflow system to view details.</p>
      <hr style="margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated notification from AyathanWorkflow School Management System.
      </p>
    </div>
  `;
  
  return sendEmailNotification(teacherEmail, subject, body);
}

/**
 * Send deadline reminder notification
 */
function sendDeadlineReminder(teacherEmail, teacherName, item, daysRemaining) {
  const subject = `Reminder: ${item.type} Due ${daysRemaining > 0 ? `in ${daysRemaining} days` : 'Today'}`;
  
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⏰ Deadline Reminder</h2>
      <p>Dear ${teacherName},</p>
      <p>This is a reminder about an upcoming deadline:</p>
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
        <p><strong>${item.type}:</strong> ${item.title}</p>
        <p><strong>Due:</strong> ${item.dueDate}</p>
        <p><strong>Status:</strong> ${item.status}</p>
        ${daysRemaining <= 0 ? '<p style="color: #dc2626;"><strong>⚠️ OVERDUE</strong></p>' : ''}
      </div>
      
      <p>Please complete this task as soon as possible.</p>
      
      <hr style="margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated reminder from AyathanWorkflow School Management System.
      </p>
    </div>
  `;
  
  return sendEmailNotification(teacherEmail, subject, body);
}

/**
 * Log notification for tracking
 */
function _logNotification(notification) {
  try {
    const sh = _getSheet('NotificationLog');
    _ensureHeaders(sh, ['timestamp', 'type', 'to', 'subject', 'status', 'error']);
    
    sh.appendRow([
      notification.timestamp,
      notification.type,
      notification.to,
      notification.subject || '',
      notification.status,
      notification.error || ''
    ]);
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

/**
 * Get smart reminders for a teacher
 * Returns comprehensive reminder data from multiple sources
 */
function getSmartReminders(teacherEmail, options = {}) {
  try {
    const reminders = [];
    const today = new Date();
    const advanceNotice = options.advanceNotice || 7; // days
    
    // 1. Lesson Plan Reminders
    const lessonPlans = getTeacherLessonPlans(teacherEmail);
    if (lessonPlans && lessonPlans.success && Array.isArray(lessonPlans.data)) {
      lessonPlans.data
        .filter(lp => lp.status === 'Pending Preparation' || lp.status === 'Needs Rework')
        .forEach(lp => {
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + (lp.status === 'Needs Rework' ? 1 : 2));
          
          reminders.push({
            id: `lesson-${lp.lpId}`,
            type: 'lesson_plan',
            title: `Complete Lesson Plan: ${lp.class} - ${lp.subject}`,
            description: `Session ${lp.session} needs to be prepared`,
            dueDate: dueDate.toISOString(),
            priority: lp.status === 'Needs Rework' ? 'high' : 'medium',
            actionUrl: 'lesson-plans',
            status: lp.status,
            data: lp
          });
        });
    }
    
    // 2. Scheme Reminders
    const schemes = getTeacherSchemes(teacherEmail);
    if (schemes && schemes.success && Array.isArray(schemes.data)) {
      schemes.data
        .filter(s => s.status === 'Pending')
        .forEach(s => {
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + 3);
          
          reminders.push({
            id: `scheme-${s.schemeId}`,
            type: 'scheme',
            title: `Scheme Awaiting Approval: ${s.class} - ${s.subject}`,
            description: `Chapter: ${s.chapter} (${s.month})`,
            dueDate: dueDate.toISOString(),
            priority: 'medium',
            actionUrl: 'schemes',
            status: s.status,
            data: s
          });
        });
    }
    
    // 3. Daily Report Reminders
    const dailyReports = getDailyReports({
      teacherEmail: teacherEmail,
      fromDate: _formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)), // Last 7 days
      toDate: _formatDate(today)
    });
    
    if (dailyReports && dailyReports.success && Array.isArray(dailyReports.data)) {
      // Find missing reports for recent dates
      const submittedDates = new Set(dailyReports.data.map(r => r.date));
      
      for (let i = 1; i <= 3; i++) { // Check last 3 days
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = _formatDate(checkDate);
        
        if (!submittedDates.has(dateStr) && checkDate.getDay() !== 0 && checkDate.getDay() !== 6) { // Exclude weekends
          reminders.push({
            id: `report-missing-${dateStr}`,
            type: 'daily_report',
            title: `Missing Daily Report: ${dateStr}`,
            description: `Daily report not submitted for ${dateStr}`,
            dueDate: new Date(checkDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Next day
            priority: i === 1 ? 'high' : 'medium', // Yesterday is high priority
            actionUrl: 'reports',
            status: 'Missing',
            data: { date: dateStr, teacherEmail }
          });
        }
      }
    }
    
    // 4. Upcoming Exam Reminders
    // Get exam schedules that need preparation
    const examSheets = _getSheet('ExamSchedule');
    if (examSheets) {
      const examData = _getSheetData(examSheets);
      const upcomingExams = examData.filter(exam => {
        const examDate = new Date(exam.examDate);
        const daysDiff = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        return daysDiff > 0 && daysDiff <= advanceNotice && 
               (exam.teacherEmail === teacherEmail || exam.invigilator === teacherEmail);
      });
      
      upcomingExams.forEach(exam => {
        const examDate = new Date(exam.examDate);
        const daysDiff = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        
        reminders.push({
          id: `exam-${exam.examId || exam.examDate}-${exam.subject}`,
          type: 'exam_preparation',
          title: `Upcoming Exam: ${exam.subject} - ${exam.class}`,
          description: `Exam scheduled for ${_formatDate(examDate)} (${daysDiff} days)`,
          dueDate: new Date(examDate.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Day before exam
          priority: daysDiff <= 2 ? 'high' : 'medium',
          actionUrl: 'exam-marks',
          status: 'Upcoming',
          data: exam
        });
      });
    }
    
    // 5. Assignment/Assessment Deadlines
    // Check for any pending assignments or assessments
    const assignmentSheets = _getSheet('Assignments');
    if (assignmentSheets) {
      const assignments = _getSheetData(assignmentSheets);
      const teacherAssignments = assignments.filter(a => 
        a.teacherEmail === teacherEmail && 
        a.status !== 'Completed' &&
        new Date(a.dueDate) > today
      );
      
      teacherAssignments.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= advanceNotice) {
          reminders.push({
            id: `assignment-${assignment.assignmentId}`,
            type: 'assignment',
            title: `Assignment Due: ${assignment.title}`,
            description: `${assignment.class} - ${assignment.subject}`,
            dueDate: dueDate.toISOString(),
            priority: daysDiff <= 2 ? 'high' : daysDiff <= 5 ? 'medium' : 'low',
            actionUrl: 'assignments',
            status: assignment.status,
            data: assignment
          });
        }
      });
    }
    
    // Sort reminders by priority and due date
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    reminders.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    return {
      success: true,
      data: reminders,
      count: reminders.length,
      generated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting smart reminders:', error);
    return {
      success: false,
      error: error.toString(),
      data: []
    };
  }
}

/**
 * Data migration function to fix substitutions that were stored with wrong dates
 * due to timezone conversion issues. This should be run once after deploying the
 * timezone fixes to correct existing data.
 */
function fixSubstitutionDates() {
  try {
    const sh = _getSheet('Substitutions');
    if (!sh) {
      return { success: false, error: 'Substitutions sheet not found' };
    }

    const headers = _headers(sh);
    const values = _rows(sh);
    
    if (values.length === 0) {
      return { success: true, message: 'No substitutions to fix', fixed: 0 };
    }

    let fixedCount = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterdayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() - 1).padStart(2, '0')}`;
    
    Logger.log(`Migration: Today = ${todayStr}, Yesterday = ${yesterdayStr}`);
    
    // Process each row
    for (let i = 0; i < values.length; i++) {
      const rowObj = _indexByHeader(values[i], headers);
      const createdAt = rowObj.createdAt;
      const currentDate = rowObj.date;
      
      // Check if this substitution was created today but has yesterday's date
      if (createdAt && currentDate) {
        const createdDate = new Date(createdAt);
        const createdISO = createdDate.toISOString();
        
        // Debug logging for first few problematic rows
        if (i < 5 || (String(currentDate) === '2025-10-26' && createdISO.startsWith('2025-10-27'))) {
          Logger.log(`Row ${i + 2}: date="${currentDate}", createdAt="${createdAt}", createdISO="${createdISO}"`);
        }
        
        // More robust check: if creation timestamp is from today but date field shows yesterday
        const createdToday = createdISO.startsWith('2025-10-27');
        const dateIsYesterday = String(currentDate) === '2025-10-26';
        
        if (createdToday && dateIsYesterday) {
          Logger.log(`MATCH FOUND - Fixing substitution: ID ${rowObj.id}, current date: ${currentDate}, should be: ${todayStr}`);
          Logger.log(`Created: ${createdAt}, Row: ${i + 2}`);
          
          // Update the date to today's date
          const dateColumnIndex = headers.indexOf('date');
          if (dateColumnIndex >= 0) {
            try {
              sh.getRange(i + 2, dateColumnIndex + 1).setValue(todayStr); // +2 because of header row and 0-based index
              fixedCount++;
              Logger.log(`Successfully updated row ${i + 2}, column ${dateColumnIndex + 1} to ${todayStr}`);
            } catch (updateError) {
              Logger.log(`Error updating row ${i + 2}: ${updateError.message || updateError}`);
            }
          } else {
            Logger.log(`Date column not found in headers: ${JSON.stringify(headers)}`);
          }
        }
      }
    }

    // Flush changes to ensure they're saved
    SpreadsheetApp.flush();

    return { 
      success: true, 
      message: `Fixed ${fixedCount} substitution dates`,
      fixed: fixedCount,
      details: `Checked ${values.length} substitutions, fixed ${fixedCount} with incorrect dates`,
      todayStr,
      yesterdayStr
    };

  } catch (error) {
    Logger.log(`Error in fixSubstitutionDates: ${error.message || error}`);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


