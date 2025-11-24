// src/api.js
// Configure this to your deployed Google Apps Script Web App URL (ends with /exec)
// PRODUCTION: Uses this URL for both development and Vercel deployment
const BASE_URL = 'https://script.google.com/macros/s/AKfycbyfKlfWqiDRkNF_Cjft73qHpGQm8tQ-nHjPSPHOKfuC1l8H5JH5gfippuhNqjvtx5dsDg/exec';

// Export BASE_URL for components that need to build direct URLs
export function getBaseUrl() {
  return BASE_URL;
}

// Lightweight logger: disabled in production build to avoid noise
const __DEV_LOG__ = !!import.meta.env.DEV && (import.meta.env.VITE_VERBOSE_API === 'true');
const devLog = (...args) => { if (__DEV_LOG__) console.log('[api]', ...args); };

// Cache for API responses to reduce duplicate calls
const apiCache = new Map();
const pendingRequests = new Map();

// Cache duration in milliseconds - Optimized for speed
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (increased for better performance)
const SHORT_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (increased from 60s)
const LONG_CACHE_DURATION = 60 * 60 * 1000; // 60 minutes for rarely changing data (doubled)
const NO_CACHE = 0; // No caching - always fetch fresh data

function getCacheKey(url) {
  return url;
}

function isCacheValid(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < cacheEntry.duration;
}

function setCacheEntry(key, data, duration = CACHE_DURATION) {
  apiCache.set(key, {
    data,
    timestamp: Date.now(),
    duration
  });
}

async function getJSON(url, cacheDuration = CACHE_DURATION) {
  const cacheKey = getCacheKey(url);
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (isCacheValid(cached)) {
  devLog('cache hit', url);
    return cached.data;
  }
  
  // Check if request is already pending to avoid duplicates
  if (pendingRequests.has(cacheKey)) {
  devLog('dedupe', url);
    return pendingRequests.get(cacheKey);
  }
  
  try {
  devLog('GET', url);
    const requestPromise = fetch(url, { method: 'GET' })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const err = new Error(`HTTP ${res.status} ${text}`);
          throw err;
        }
        return res.json();
      });
    
    // Store pending request
    pendingRequests.set(cacheKey, requestPromise);
    
    const result = await requestPromise;
    
    // Cache the result with specified duration
    setCacheEntry(cacheKey, result, cacheDuration);
    
    // Clear pending request
    pendingRequests.delete(cacheKey);
    
    return result;
  } catch (err) {
    // Clear pending request on error
    pendingRequests.delete(cacheKey);
    
    console.error('API GET failed', url, err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: String(err.message || err), url } }));
    }
    const e2 = new Error(`Failed to fetch ${url}: ${String(err && err.message ? err.message : err)}`);
    throw e2;
  }
}

async function postJSON(url, payload) {
  // Smart cache invalidation - clear related caches on mutations
  const action = payload?.action || '';
  
  if (action.includes('submit') || action.includes('create') || action.includes('update') || action.includes('delete')) {
    // Clear all caches related to the action
    if (action.includes('DailyReport')) {
      clearCache('getDailyReport');
      clearCache('getTeacherDailyData');
      clearCache('getPlannedLessons');
    }
    if (action.includes('LessonPlan') || action.includes('SchemeLessonPlan')) {
      clearCache('getLessonPlan');
      clearCache('getTeacherLessonPlan');
      clearCache('getApprovedSchemes');
      clearCache('getAvailablePeriods');
    }
    if (action.includes('Substitution') || action === 'assignSubstitution') {
      clearCache('Substitution');
      clearCache('VacantSlots');
      clearCache('Timetable');
      clearCache('FreeTeachers');
      clearCache('AvailableTeachers');
    }
    if (action.includes('Exam') || action.includes('Marks')) {
      clearCache('Exam');
      clearCache('Marks');
      clearCache('ReportCard');
    }
    if (action.includes('Scheme')) {
      clearCache('Scheme');
      clearCache('getTeacherSchemes');
      clearCache('getAllApprovedSchemes');
    }
  }
  
  const body = JSON.stringify(payload);
  try {
  devLog('POST', url, payload);
    // Use text/plain to avoid CORS preflight with Apps Script
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} ${text}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message: err.message, url, status: res.status } }));
      }
      throw err;
    }
    return await res.json()
  } catch (err) {
    console.error('API POST failed', url, err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: String(err.message || err), url } }));
    }
    const e2 = new Error(`Failed to post ${url}: ${String(err && err.message ? err.message : err)}`);
    throw e2;
  }
}

// Utility to clear cache
export function clearCache(pattern) {
  if (pattern) {
    for (const [key] of apiCache) {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    }
  } else {
    apiCache.clear();
  }
}

export async function ping() {
  return getJSON(`${BASE_URL}?action=ping`)
}

// Basic auth by email and password (server maps to Users sheet)
export async function login(email, password = '') {
  const url = `${BASE_URL}?action=login&email=${encodeURIComponent(email)}`;
  const fullUrl = password ? `${url}&password=${encodeURIComponent(password)}` : url;
  return getJSON(fullUrl);
}

// Google OAuth exchange: send auth info to backend; backend validates and returns user profile & roles
export async function googleLogin(googleAuthInfo) {
  try {
    devLog('Sending Google auth info to backend (POST)');
    return await postJSON(`${BASE_URL}?action=googleLogin`, googleAuthInfo);
  } catch (err) {
    devLog('googleLogin POST failed, attempting GET fallback');
    try {
      // For GET, send all user info as query parameters
      if (!googleAuthInfo?.email) throw err;
      devLog('Sending Google auth info via GET fallback');
      const params = new URLSearchParams({
        email: googleAuthInfo.email,
        name: googleAuthInfo.name || '',
        google_id: googleAuthInfo.google_id || '',
        picture: googleAuthInfo.picture || ''
      });
      return await getJSON(`${BASE_URL}?action=googleLogin&${params.toString()}`);
    } catch (err2) {
      console.error('Both POST and GET Google login attempts failed:', 
                    { postError: err?.message, getError: err2?.message });
      // Improved error messages
      let errorMessage = String(err?.message || '');
      if (errorMessage.includes('Invalid Google token')) {
        throw new Error('Authentication failed. Your Google token could not be verified. Please sign in again.');
      }
      throw new Error(`Google login failed. Please ensure your Apps Script Web App is deployed (doPost handler active) and that your browser allows third-party cookies/popups.`);
    }
    
    // Improved error message for common issues
    let errorMessage = String(err.message || '');
    if (errorMessage.includes('Invalid Google token')) {
      console.error('Invalid Google token error. Token might be expired or malformed.');
      throw new Error('Authentication failed. Your Google authentication token could not be verified. Please try signing in again or check if cookies are enabled.');
    } else if (errorMessage.includes('Email not verified') || errorMessage.includes('Token missing email')) {
      throw new Error('Your Google account email is either not verified or not available. Please ensure you have a verified email in your Google account.');
    } else if (errorMessage.includes('User not registered')) {
      throw new Error('Your Google account is not registered in the system. Please contact your administrator to register your email.');
    }
    
    throw err;
  }
}

export async function getTeacherWeeklyTimetable(email) {
  const result = await getJSON(`${BASE_URL}?action=getTeacherWeeklyTimetable&email=${encodeURIComponent(email)}`);
  // Unwrap if backend sends wrapped response
  return result?.data || result || [];
}

export async function getTeacherDailyTimetable(email, date) {
  const result = await getJSON(`${BASE_URL}?action=getTeacherDailyTimetable&email=${encodeURIComponent(email)}&date=${encodeURIComponent(date)}`, SHORT_CACHE_DURATION);
  // Unwrap if backend sends wrapped response
  return result?.data || result || [];
}

export async function getTeacherLessonPlanFilters(email) {
  return getJSON(`${BASE_URL}?action=getTeacherLessonPlanFilters&email=${encodeURIComponent(email)}`)
}

export async function getTeacherLessonPlans(email, subject='', cls='', status='', search='') {
  const q = new URLSearchParams({ action: 'getTeacherLessonPlans', email, subject, class: cls, status, search })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function submitPlan(email, planData) {
  return postJSON(`${BASE_URL}?action=submitPlan`, { email, ...planData })
}

export async function getPendingPlans(page=1, pageSize=10, teacher='', cls='', subject='', month='') {
  const q = new URLSearchParams({ action: 'getPendingPlans', page, pageSize, teacher, class: cls, subject, month })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function getAllPlans(page=1, pageSize=10, teacher='', cls='', subject='', status='', month='') {
  const q = new URLSearchParams({ action: 'getAllPlans', page, pageSize, teacher, class: cls, subject, status, month })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function updatePlanStatus(schemeId, status) {
  return postJSON(`${BASE_URL}?action=updatePlanStatus`, { schemeId, status })
}

export async function getLessonReviewFilters() {
  const result = await getJSON(`${BASE_URL}?action=getLessonReviewFilters`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || {}
}

export async function getPendingLessonReviews(teacher='', cls='', subject='', status='Pending Review') {
  const q = new URLSearchParams({ action: 'getPendingLessonReviews', teacher, class: cls, subject, status })
  const response = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || []
}

export async function getPendingPreparationLessonPlans(email) {
  const result = await getJSON(`${BASE_URL}?action=getPendingPreparationLessonPlans&email=${encodeURIComponent(email)}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function submitLessonPlanDetails(lpId, data) {
  return postJSON(`${BASE_URL}?action=submitLessonPlanDetails`, { lpId, ...data })
}

// NOTE: The client performs duplicate detection before calling submitLessonPlanDetails
// to prevent creating lesson plans with the same class/subject/session and scheme.
// It's strongly recommended to implement the same duplicate check on the server
// (Apps Script) inside `submitLessonPlanDetails` to ensure data integrity when
// multiple clients or retries are involved.

export async function updateLessonPlanDetailsStatus(lpId, status, remarks='') {
  return postJSON(`${BASE_URL}?action=updateLessonPlanDetailsStatus`, { lpId, status, remarks })
}

// Get approved lesson plans for report
export async function getApprovedLessonPlansForReport(email, cls, subject) {
  const q = new URLSearchParams({ action: "getApprovedLessonPlansForReport", email, class: cls, subject });
  return getJSON(`${BASE_URL}?${q.toString()}`);
}

// Get planned lesson for a specific period (for auto-fill in daily report)
export async function getPlannedLessonForPeriod(email, date, period, className, subject) {
  const q = new URLSearchParams({ 
    action: "getPlannedLessonForPeriod", 
    email, 
    date, 
    period, 
    class: className, 
    subject 
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`);
  return result?.data || result || { success: false, hasPlannedLesson: false };
}

// BATCH: Get all planned lessons for a date (replaces multiple getPlannedLessonForPeriod calls)
// Performance: Reduces 6-8 API calls to 1 call
export async function getPlannedLessonsForDate(email, date) {
  const q = new URLSearchParams({ 
    action: "getPlannedLessonsForDate", 
    email, 
    date 
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE);
  return result?.data || result || { success: false, lessonsByPeriod: {} };
}

// BATCH: Get teacher's full daily data (timetable + reports) in ONE call
// Performance: Reduces 2 API calls to 1 call
export async function getTeacherDailyData(email, date) {
  const q = new URLSearchParams({ 
    action: "getTeacherDailyData", 
    email, 
    date 
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return result?.data || result || { success: false, timetable: {}, reports: [] };
}

// Debug function to check exam marks data
export async function debugExamMarks() {
  return getJSON(`${BASE_URL}?action=debugExamMarks`);
}

export async function submitDailyReport(data) {
  return postJSON(`${BASE_URL}?action=submitDailyReport`, data)
}

export async function checkChapterCompletion(data) {
  return postJSON(`${BASE_URL}?action=checkChapterCompletion`, data)
}

export async function applyChapterCompletionAction(data) {
  console.log('🔧 API: applyChapterCompletionAction called');
  console.log('   URL:', `${BASE_URL}?action=applyChapterCompletionAction`);
  console.log('   Data:', JSON.stringify(data));
  console.log('   User Action:', data.userAction);
  console.log('   IDs:', data.lessonPlanIds);
  const result = await postJSON(`${BASE_URL}?action=applyChapterCompletionAction`, data);
  console.log('   Result:', result);
  return result;
}

export async function getTeacherDailyReportsForDate(email, date) {
  const q = new URLSearchParams({ action: 'getTeacherDailyReportsForDate', email, date })
  return getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
}

export async function getDailyReportsForDate(date) {
  const q = new URLSearchParams({ action: 'getDailyReportsForDate', date })
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION)
}

export async function getLessonPlansForDate(date) {
  const q = new URLSearchParams({ action: 'getLessonPlansForDate', date })
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION)
}

export async function getAllClasses() {
  const response = await getJSON(`${BASE_URL}?action=getAllClasses`);
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || [];
}

export async function getAllSubjects() {
  const response = await getJSON(`${BASE_URL}?action=getAllSubjects`);
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || [];
}

export async function getDailyReportSummary(cls, date) {
  const q = new URLSearchParams({ action: 'getDailyReportSummary', class: cls, date })
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

// Substitutions
export async function getVacantSlotsForAbsent(date, absent=[], options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getVacantSlotsForAbsent', date })
  absent.forEach(a => q.append('absent', a))
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

export async function getPotentialAbsentTeachers() {
  return getJSON(`${BASE_URL}?action=getPotentialAbsentTeachers`)
}

export async function getFreeTeachers(date, period, absent=[]) {
  const q = new URLSearchParams({ action: 'getFreeTeachers', date, period })
  absent.forEach(a => q.append('absent', a))
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  return result?.data || result || []
}

export async function assignSubstitution(data) {
  const response = await postJSON(`${BASE_URL}?action=assignSubstitution`, data);
  return response?.data || response;
}

// Fetch all schemes submitted by a particular teacher (regardless of status).
// Returns an array of scheme objects with fields: schemeId, class, subject,
// chapter, month, term, unit, noOfSessions, and status.  This allows
// teachers and class teachers to view all of their submitted schemes and
// their current approval status.
export async function getTeacherSchemes(email) {
  const q = new URLSearchParams({ action: 'getTeacherSchemes', email })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function getDailyTimetableWithSubstitutions(date, options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getDailyTimetableWithSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

export async function getAssignedSubstitutions(date, options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getAssignedSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

// Debug endpoint to check raw substitutions data
export async function debugSubstitutions(date, options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'debugSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

// New substitution management functions
export async function getDailyTimetableForDate(date, options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getDailyTimetableForDate', date })
  if (noCache) q.append('_', String(Date.now()))
  const response = await getJSON(`${BASE_URL}?${q.toString()}`);
  // Backend returns { status, data: { date, dayName, timetable: [...] }, timestamp }
  // Unwrap and extract the timetable array
  const unwrapped = response?.data || response;
  if (unwrapped && Array.isArray(unwrapped.timetable)) {
    return unwrapped.timetable;
  }
  return Array.isArray(unwrapped) ? unwrapped : [];
}

export async function getSubstitutionsForDate(date, options={}) {
  const { noCache = false } = options || {};
  
  // Clear cache for this specific endpoint
  if (noCache) {
    for (const [key] of apiCache) {
      if (key.includes('getSubstitutionsForDate')) {
        apiCache.delete(key);
      }
    }
  }
  
  // Enforce date format consistency
  const normalizedDate = typeof date === 'string' ? date.trim() : String(date || '');
  
  const q = new URLSearchParams({ 
    action: 'getSubstitutionsForDate', 
    date: normalizedDate 
  });
  
  // Force cache bypass
  q.append('_', String(Date.now()));
  
  try {
    const result = await getJSON(`${BASE_URL}?${q.toString()}`);
    
    // Backend returns { status, data: { date, substitutions }, timestamp }
    // Unwrap the response
    const unwrapped = result?.data || result;
    
    // Handle different response formats after unwrapping
    if (Array.isArray(unwrapped)) {
      return unwrapped;
    } else if (unwrapped && Array.isArray(unwrapped.substitutions)) {
      // Expected format: { date: "...", substitutions: [...] }
      return unwrapped.substitutions;
    } else if (Array.isArray(result)) {
      return result;
    } else {
      if (import.meta.env.DEV) {
        console.warn(`[API] Unexpected substitution data format:`, result);
      }
      return [];
    }
  } catch (err) {
    console.error(`[API] Error fetching substitutions:`, err);
    // Rethrow with helpful context
    throw new Error(`Failed to fetch substitutions for ${normalizedDate}: ${err.message || String(err)}`);
  }
}

export async function getAvailableTeachers(date, period, options={}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getAvailableTeachers', date, period })
  if (noCache) q.append('_', String(Date.now()))
  const response = await getJSON(`${BASE_URL}?${q.toString()}`);
  // Backend returns { status, data: [...teachers], timestamp }
  // Unwrap and return the teachers array
  return response?.data || response || [];
}

export async function addSubstitution(data) {
  // Use GET with URL parameters for better browser compatibility with Google Apps Script
  const params = new URLSearchParams({
    action: 'assignSubstitution',
    date: data.date || '',
    period: String(data.period || ''),
    class: data.class || '',
    absentTeacher: data.absentTeacher || '',
    regularSubject: data.regularSubject || '',
    substituteTeacher: data.substituteTeacher || '',
    substituteSubject: data.substituteSubject || '',
    note: data.note || ''
  });
  const response = await getJSON(`${BASE_URL}?${params.toString()}`);
  return response?.data || response;
}

export async function deleteSubstitution(substitutionId) {
  return postJSON(`${BASE_URL}?action=deleteSubstitution`, { substitutionId })
}

// HM Insights (basic)
export async function getHmInsights() {
  const response = await getJSON(`${BASE_URL}?action=getHmInsights`);
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || {};
}

export async function getFullTimetable() {
  const response = await getJSON(`${BASE_URL}?action=getFullTimetable`);
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || [];
}

export async function getFullTimetableFiltered(cls = '', subject = '', teacher = '', date = '') {
  const q = new URLSearchParams({ action: 'getFullTimetableFiltered', class: cls, subject, teacher, date })
  const response = await getJSON(`${BASE_URL}?${q.toString()}`);
  // Unwrap the response: backend returns { status, data, timestamp }
  return response?.data || response || [];
}

// App settings (used to control lesson planning rules and period times)
export async function getAppSettings() {
  // Expect either an object with settings or { settings: { ... } }
  const res = await getJSON(`${BASE_URL}?action=getAppSettings`);
  
  // Check if response has the period times directly
  if (res && (res.periodTimesWeekday || res.periodTimesFriday)) {
    return res;
  }
  
  // Check if wrapped in settings object
  if (res && res.settings && typeof res.settings === 'object') {
    return res.settings;
  }
  
  return res || {};
}

// Exams API

// Retrieve a list of exams.  Optional filters (class, subject, examType) can
// be provided to limit the results.  Returns an array of exam objects.
export async function getExams(options = {}) {
  // Handle both object parameter and legacy positional parameters
  let cls = '', subject = '', examType = '', teacherEmail = '', role = '', _ts;
  
  if (typeof options === 'object') {
    ({ class: cls = '', subject = '', examType = '', teacherEmail = '', role = '', _ts } = options);
  } else {
    // Legacy support for positional parameters
    cls = options || '';
    // Additional parameters are ignored in legacy mode
  }
  
  const q = new URLSearchParams({ 
    action: 'getExams', 
    class: cls, 
    subject,
    examType,
    ...(teacherEmail ? { teacherEmail } : {}),
    ...(role ? { role } : {}),
    ...(_ts ? { _ts } : {})
  });
  
  // CRITICAL: Unwrap response from {status, data, timestamp} wrapper
  const result = await getJSON(`${BASE_URL}?${q.toString()}`);
  return result?.data || result || [];
}

// Create a new exam.  Requires the creator's email and a payload with
// creatorName, class, subject, examType, internalMax, externalMax,
// totalMax and date.  Returns { ok: true, examId } on success.
export async function createExam(email, examData) {
  return postJSON(`${BASE_URL}?action=createExam`, { email, ...examData })
}

// Create exam with custom ID (for bulk upload)
export async function createExamWithId(email, examData) {
  return postJSON(`${BASE_URL}?action=createExamWithId`, { email, ...examData })
}

// Create multiple exams at once for different subjects with the same grading settings.
// Payload should include class, examType, hasInternalMarks, internalMax, externalMax, 
// and an array of subject+date pairs.
export async function createBulkExams(email, bulkExamData) {
  return postJSON(`${BASE_URL}?action=createBulkExams`, { email, ...bulkExamData })
}

// Update an existing exam. Requires examId and updated exam details.
// Returns { ok: true } on success.
export async function updateExam(examData) {
  return postJSON(`${BASE_URL}?action=updateExam`, examData)
}

// Submit exam marks.  The payload must include examId, class, subject,
// teacherEmail, teacherName and an array of marks ({ admNo, studentName,
// internal, external }).  Returns { ok: true } on success.
export async function submitExamMarks(data) {
  const result = await postJSON(`${BASE_URL}?action=submitExamMarks`, data);
  // Backend wraps response in { status, data, timestamp }, so unwrap it
  return result?.data || result;
}

// Retrieve all marks for a given examId.  Returns an array of mark records.
export async function getExamMarks(examId) {
  const q = new URLSearchParams({ action: 'getExamMarks', examId })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  return result?.data || result || []
}

// Get all exams - using working getExams function directly
export async function getAllExams() {
  try {
    // Use the existing getExams function that works in ExamManagement
    // Call getExams with empty parameters to get all exams (no filtering)
    const examData = await getExams('', '', ''); // empty strings for class, subject, examType
    
    // Transform the data to match the expected format for getAllExams
    const transformed = Array.isArray(examData) ? examData.map(exam => ({
      examId: exam.examId,
      examName: exam.examName || `${exam.examType || 'Exam'} - ${exam.class || ''} - ${exam.subject || ''}`,
      class: exam.class,
      subject: exam.subject,
      examType: exam.examType,
      examDate: exam.date,
      creatorEmail: exam.creatorEmail,
      creatorName: exam.creatorName,
      internalMax: exam.internalMax,
      externalMax: exam.externalMax,
      totalMax: exam.totalMax,
      createdAt: exam.date // Use date as fallback for createdAt
    })) : [];
    
    return transformed;
  } catch (error) {
    console.error('getAllExams using getExams failed:', error);
    throw error;
  }
}

// Get student report card data
export async function getStudentReportCard(examType, admNo = '', cls = '') {
  const q = new URLSearchParams({ action: 'getStudentReportCard', examType });
  if (admNo) q.append('admNo', admNo);
  if (cls) q.append('class', cls);
  const result = await getJSON(`${BASE_URL}?${q.toString()}`);
  return result?.data || result || {};
}

// Administrative API
// Fetch all plans (schemes and lesson plans) with optional filters.
// Parameters: teacher (email or part of name), class, subject, status.
// Fetch all approved schemes across the school, used to populate teacher dropdowns
export async function getAllApprovedSchemes() {
  try {
    const res = await getJSON(`${BASE_URL}?action=getAllPlans&status=Approved`);
    // Some deployments return { plans: [...] }, others return an array directly
    const plans = Array.isArray(res) ? res : (Array.isArray(res?.plans) ? res.plans : []);
    // Heuristic: schemes have schemeId and typically noOfSessions/month info
    const approvedSchemes = plans.filter((item) => {
      const isApproved = String(item?.status || '').toLowerCase() === 'approved';
      const looksLikeScheme = !!(item?.schemeId) || (item?.noOfSessions != null);
      return isApproved && looksLikeScheme;
    });
    return approvedSchemes;
  } catch (err) {
    // Surface API error and rethrow so callers can fallback
    console.warn('getAllApprovedSchemes failed:', err?.message || err);
    throw err;
  }
}

// Fetch all schemes (not lesson plans) with optional filters
export async function getAllSchemes(page=1, pageSize=10, teacher='', cls='', subject='', status='', month='') {
  try {
    const q = new URLSearchParams({ action: 'getAllSchemes', page, pageSize, teacher, class: cls, subject, status, month })
    const res = await getJSON(`${BASE_URL}?${q.toString()}`);
    // Backend wraps response in {status, data, timestamp}, so extract data
    const data = res?.data || res;
    // Handle both array format and {plans: [...]} format
    const plans = Array.isArray(data) ? data : (Array.isArray(data?.plans) ? data.plans : []);
    return plans;
  } catch (err) {
    console.warn('getAllSchemes failed:', err?.message || err);
    throw err;
  }
}

// Retrieve daily reports across the school.  Useful for headmasters to
// browse all reports.  Optional filters: teacher, class, subject,
// date, fromDate, toDate, status (completion status).
export async function getDailyReports({ teacher = '', cls = '', subject = '', date = '', fromDate = '', toDate = '', status = '' } = {}) {
  const params = new URLSearchParams({ action: 'getDailyReports', teacher, class: cls, subject, date, fromDate, toDate, status })
  const result = await getJSON(`${BASE_URL}?${params.toString()}`)
  return result?.data || result || []
}

// Students and Attendance

// Get a centralized list of all subjects from all data sources
export async function getSubjects() {
  return getJSON(`${BASE_URL}?action=getSubjects`)
    .then(result => result.subjects || [])
}

// Get a list of students.  If a class is supplied, return only students in
// that class; otherwise return all students.
export async function getStudents(cls = '') {
  const q = new URLSearchParams({ action: 'getStudents', class: cls })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  return result?.data || result || []
}

// Retrieve exam grade types from the GradeTypes sheet.  Each entry contains
// examType and the maximum marks.  Useful for populating dynamic exam
// creation forms.
export async function getGradeTypes() {
  return getJSON(`${BASE_URL}?action=getGradeTypes`)
}

// Fetch grade boundaries used to assign letter grades based on percentage
export async function getGradeBoundaries() {
  return getJSON(`${BASE_URL}?action=getGradeBoundaries`)
}

// Submit attendance records.  The payload should include date, class,
// teacherEmail, teacherName and an array of records with admNo,
// studentName and status (e.g. "Present" or "Absent").
export async function submitAttendance(data) {
  return postJSON(`${BASE_URL}?action=submitAttendance`, data)
}

// Retrieve attendance records.  Optional filters: class and date.
export async function getAttendance(cls = '', date = '') {
  const q = new URLSearchParams({ action: 'getAttendance', class: cls, date })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  return result?.data || result || []
}

// Retrieve student performance data for a class.  Returns an array of
// { admNo, name, average, examCount } sorted by average descending.
export async function getStudentPerformance(cls) {
  const q = new URLSearchParams({ action: 'getStudentPerformance', class: cls })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  return result?.data || result || []
}





// Get recent activities for analytics
export async function getRecentActivities() {
  try {
    return await getJSON(`${BASE_URL}?action=getRecentActivities`);
  } catch (error) {
    console.warn('getRecentActivities endpoint not available:', error);
    return [];
  }
}

// Send custom notification (HM only)
export async function sendCustomNotification(userEmail, title, message, priority = 'NORMAL', recipients = 'all') {
  const q = new URLSearchParams({
    action: 'sendCustomNotification',
    userEmail,
    title,
    message,
    priority,
    recipients
  });
  return getJSON(`${BASE_URL}?${q.toString()}`);
}

// Get substitution notifications for the current user
export async function getSubstitutionNotifications(userEmail) {
  const response = await postJSON(BASE_URL, {
    action: 'getSubstitutionNotifications',
    email: userEmail
  });
  
  // Backend returns { status, data: { success, notifications, count }, timestamp }
  // After postJSON unwrapping: { success, notifications, count }
  const data = response?.data || response;
  
  // If data has notifications array, return it directly
  if (data && Array.isArray(data.notifications)) {
    return data; // Return { success, notifications, count }
  }
  
  // Fallback for different formats
  if (Array.isArray(data)) {
    return { success: true, notifications: data, count: data.length };
  }
  
  // Empty state
  return { success: true, notifications: [], count: 0 };
}

// Acknowledge a substitution notification
export async function acknowledgeSubstitutionNotification(userEmail, notificationId) {
  return postJSON(BASE_URL, {
    action: 'acknowledgeSubstitutionNotification',
    email: userEmail,
    notificationId
  });
}

// Generic API caller for custom actions
export async function callAPI(action, params = {}) {
  return await postJSON(BASE_URL, { action, ...params });
}

// ===== SCHEME-BASED LESSON PLANNING API =====

// Get approved schemes for lesson planning with chapter/session breakdown
export async function getApprovedSchemesForLessonPlanning(teacherEmail) {
  const q = new URLSearchParams({
    action: 'getApprovedSchemesForLessonPlanning',
    teacherEmail
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get available periods for lesson plan scheduling
export async function getAvailablePeriodsForLessonPlan(teacherEmail, startDate, endDate, excludeExisting = true, schemeClass = '', schemeSubject = '') {
  const q = new URLSearchParams({
    action: 'getAvailablePeriodsForLessonPlan',
    teacherEmail,
    startDate,
    endDate,
    excludeExisting: excludeExisting.toString(),
    class: schemeClass,          // ✅ Add class parameter
    subject: schemeSubject        // ✅ Add subject parameter
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Create scheme-based lesson plan
export async function createSchemeLessonPlan(lessonPlanData) {
  return postJSON(BASE_URL, {
    action: 'createSchemeLessonPlan',
    lessonPlanData
  });
}

// Get all teachers
export async function getAllTeachers() {
  const q = new URLSearchParams({
    action: 'getAllTeachers'
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, LONG_CACHE_DURATION);
}

// Get scheme submission helper (planning assistant)
export async function getSchemeSubmissionHelper(teacherEmail, className, subject, term) {
  const q = new URLSearchParams({
    action: 'getSchemeSubmissionHelper',
    teacherEmail,
    class: className,
    subject,
    term
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get syllabus pace tracking for HM dashboard
export async function getSyllabusPaceTracking(term) {
  const q = new URLSearchParams({
    action: 'getSyllabusPaceTracking',
    term
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// ===== SESSION COMPLETION TRACKING API =====

// Update session completion status and progress
export async function updateSessionCompletion(sessionData) {
  return postJSON(BASE_URL, {
    action: 'updateSessionCompletion',
    ...sessionData
  });
}

// Get teacher performance dashboard
export async function getTeacherPerformanceDashboard(teacherEmail) {
  const q = new URLSearchParams({
    action: 'getTeacherPerformanceDashboard',
    teacherEmail
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get scheme completion analytics
export async function getSchemeCompletionAnalytics(schemeId) {
  const q = new URLSearchParams({
    action: 'getSchemeCompletionAnalytics',
    schemeId
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get session completion history for a teacher
export async function getSessionCompletionHistory(teacherEmail, dateRange = {}) {
  const q = new URLSearchParams({
    action: 'getSessionCompletionHistory',
    teacherEmail,
    ...dateRange
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// ===== HM MONITORING & ANALYTICS API =====

// Get all teachers performance data (HM only)
export async function getAllTeachersPerformance() {
  const q = new URLSearchParams({
    action: 'getAllTeachersPerformance'
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get class/subject-level performance metrics (HM only)
export async function getClassSubjectPerformance() {
  const q = new URLSearchParams({
    action: 'getClassSubjectPerformance'
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get daily submission metrics and trends (HM only)
export async function getDailySubmissionMetrics(daysBack = 30) {
  const q = new URLSearchParams({
    action: 'getDailySubmissionMetrics',
    daysBack: String(daysBack)
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get comprehensive HM analytics dashboard (HM only)
export async function getHMAnalyticsDashboard() {
  const q = new URLSearchParams({
    action: 'getHMAnalyticsDashboard'
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get school session analytics (HM only)
export async function getSchoolSessionAnalytics(filters = {}) {
  const q = new URLSearchParams({
    action: 'getSchoolSessionAnalytics',
    ...filters
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return result?.data || result;
}

// Get cascading issues report (HM only)
export async function getCascadingIssuesReport() {
  const q = new URLSearchParams({
    action: 'getCascadingIssuesReport'
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return result?.data || result;
}

// ====== SUBSTITUTION ACKNOWLEDGMENT ======
export async function getTeacherSubstitutions(email, date) {
  const q = new URLSearchParams({ action: 'getTeacherSubstitutions', email, date })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
  return result?.data || result || { assignedSubstitutions: [] }
}

export async function getTeacherSubstitutionsRange(email, startDate, endDate) {
  const q = new URLSearchParams({ 
    action: 'getTeacherSubstitutionsRange', 
    email, 
    startDate, 
    endDate 
  })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
  return result?.data || result || { substitutions: [] }
}

export async function getAllSubstitutions() {
  const q = new URLSearchParams({ action: 'getAllSubstitutions' })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
  return result?.data || result || { total: 0, data: [] }
}

export async function acknowledgeSubstitutionAssignment(data) {
  return postJSON(`${BASE_URL}?action=acknowledgeSubstitutionAssignment`, data);
}

