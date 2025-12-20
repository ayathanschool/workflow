// src/api.js
// Apps Script Web App URL (ends with /exec)
// MUST be provided via env var: VITE_API_BASE_URL (preferred) or VITE_GAS_WEB_APP_URL or VITE_APP_SCRIPT_URL
// Remove legacy hardcoded fallback to avoid accidental calls to old deployments.
const BASE_URL = (import.meta && import.meta.env && (
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_GAS_WEB_APP_URL || import.meta.env.VITE_APP_SCRIPT_URL
)) ? (
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_GAS_WEB_APP_URL || import.meta.env.VITE_APP_SCRIPT_URL
) : (() => { throw new Error('Missing API base URL. Set VITE_API_BASE_URL in .env'); })();

// Export BASE_URL for components that need to build direct URLs
// Delegate to the canonical utility to avoid drift across modules
import { getBaseUrl as getBaseUrlUtil } from './utils/apiUtils.js';
export function getBaseUrl() {
  return getBaseUrlUtil();
}

// Import advanced caching system
import { cacheManager, CacheTTL, invalidateCache } from './utils/cacheManager.js';
export { invalidateCache }; // Export for components to use

// Lightweight logger: disabled in production build to avoid noise
const __DEV_LOG__ = !!import.meta.env.DEV && (import.meta.env.VITE_VERBOSE_API === 'true');
const devLog = (...args) => { if (__DEV_LOG__) console.log('[api]', ...args); };

// Legacy cache system (keep for backward compatibility, but new code should use cacheManager)
const apiCache = new Map();
const pendingRequests = new Map();

// Cache duration presets - mapped to new cache manager
const CACHE_DURATION = CacheTTL.MEDIUM;        // 5 minutes
const SHORT_CACHE_DURATION = CacheTTL.SHORT;   // 2 minutes
const LONG_CACHE_DURATION = CacheTTL.LONG;     // 15 minutes
const NO_CACHE = 0;                             // No caching

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
  // Skip caching for NO_CACHE requests
  if (cacheDuration === NO_CACHE) {
    devLog('GET (no cache)', url);
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      return res.json();
    } catch (err) {
      console.error('API GET failed', url, err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message: String(err.message || err), url } }));
      }
      throw new Error(`Failed to fetch ${url}: ${String(err && err.message ? err.message : err)}`);
    }
  }

  const cacheKey = getCacheKey(url);

  // Use advanced cache manager with background refresh
  return cacheManager.fetchWithCache(
    cacheKey,
    async () => {
      devLog('GET', url);
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      return res.json();
    },
    {
      ttl: cacheDuration,
      acceptStale: true, // Show stale data while refreshing
      onRefresh: (freshData) => {
        // Optional: notify components that fresh data arrived
        devLog('Background refresh completed for', url);
      }
    }
  ).catch(err => {
    console.error('API GET failed', url, err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: String(err.message || err), url } }));
    }
    throw new Error(`Failed to fetch ${url}: ${String(err && err.message ? err.message : err)}`);
  });
}

async function postJSON(url, payload) {
  // Smart cache invalidation using advanced cache manager
  const action = payload?.action || '';

  if (action.includes('submit') || action.includes('create') || action.includes('update') || action.includes('delete')) {
    // Clear all caches related to the action using pattern matching
    if (action.includes('DailyReport')) {
      cacheManager.deletePattern('getDailyReport');
      cacheManager.deletePattern('getTeacherDailyData');
      cacheManager.deletePattern('getPlannedLessons');
      invalidateCache.onLessonPlanChange(); // Also invalidate lesson plans
    }
    if (action.includes('LessonPlan') || action.includes('SchemeLessonPlan')) {
      invalidateCache.onLessonPlanChange();
      cacheManager.deletePattern('getApprovedSchemes');
      cacheManager.deletePattern('getAvailablePeriods');
    }
    if (action.includes('Substitution') || action === 'assignSubstitution') {
      invalidateCache.onSubstitutionChange();
      cacheManager.deletePattern('VacantSlots');
      cacheManager.deletePattern('FreeTeachers');
      cacheManager.deletePattern('AvailableTeachers');
    }
    if (action.includes('Exam') || action.includes('Marks')) {
      cacheManager.deletePattern('Exam');
      cacheManager.deletePattern('Marks');
      cacheManager.deletePattern('ReportCard');
    }
    if (action.includes('Scheme')) {
      invalidateCache.onSchemeChange();
      cacheManager.deletePattern('getAllApprovedSchemes');
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
  // Use advanced cache manager for pattern-based clearing
  if (pattern) {
    cacheManager.deletePattern(pattern);
    // Also clear legacy cache for backward compatibility
    for (const [key] of apiCache) {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    }
  } else {
    cacheManager.clearAll();
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
  const res = await getJSON(fullUrl);
  return res?.data || res;
}

// Google OAuth exchange: send auth info to backend; backend validates and returns user profile & roles
export async function googleLogin(googleAuthInfo) {
  try {
    devLog('Sending Google auth info to backend (POST)');
    const postRes = await postJSON(`${BASE_URL}?action=googleLogin`, googleAuthInfo);
    return postRes?.data || postRes;
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
      const getRes = await getJSON(`${BASE_URL}?action=googleLogin&${params.toString()}`);
      return getRes?.data || getRes;
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
    // Note: inner fallback path already throws; no further action here.
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

export async function getTeacherLessonPlans(email, subject = '', cls = '', status = '', search = '') {
  const q = new URLSearchParams({ action: 'getTeacherLessonPlans', email, subject, class: cls, status, search })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function submitPlan(email, planData) {
  return postJSON(`${BASE_URL}?action=submitPlan`, { email, ...planData })
}

export async function deleteScheme(schemeId, teacherEmail) {
  clearCache('getTeacherSchemes');
  return postJSON(`${BASE_URL}?action=deleteScheme`, { schemeId, teacherEmail })
}

export async function updateScheme(schemeId, teacherEmail, planData) {
  clearCache('getTeacherSchemes');
  return postJSON(`${BASE_URL}?action=updateScheme`, { schemeId, teacherEmail, ...planData })
}

export async function deleteLessonPlan(lpId, teacherEmail) {
  clearCache('getTeacherLessonPlans');
  return postJSON(`${BASE_URL}?action=deleteLessonPlan`, { lpId, teacherEmail })
}

export async function getPendingPlans(page = 1, pageSize = 10, teacher = '', cls = '', subject = '', month = '') {
  const q = new URLSearchParams({ action: 'getPendingPlans', page, pageSize, teacher, class: cls, subject, month })
  const result = await getJSON(`${BASE_URL}?${q.toString()}`)
  // Unwrap response: backend wraps in {status, data, timestamp}
  return result?.data || result || []
}

export async function getAllPlans(page = 1, pageSize = 10, teacher = '', cls = '', subject = '', status = '', month = '') {
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

export async function getPendingLessonReviews(teacher = '', cls = '', subject = '', status = 'Pending Review', options = {}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getPendingLessonReviews', teacher, class: cls, subject, status });
  if (noCache) q.append('_', String(Date.now()));
  const response = await getJSON(`${BASE_URL}?${q.toString()}`);
  return response?.data || response || [];
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

export async function updateLessonPlanDetailsStatus(lpId, status, remarks = '') {
  return postJSON(`${BASE_URL}?action=updateLessonPlanDetailsStatus`, { lpId, status, remarks })
}

// Update single lesson plan status (for HM approval with validation)
export async function updateLessonPlanStatus(lpId, status, reviewComments = '') {
  return postJSON(`${BASE_URL}?action=updateLessonPlanStatus`, { lpId, status, reviewComments })
}

// Batch update lesson plan statuses (for HM approval)
export async function batchUpdateLessonPlanStatus(lessonPlanIds, status, reviewComments = '') {
  return postJSON(`${BASE_URL}?action=batchUpdateLessonPlanStatus`, { lessonPlanIds, status, reviewComments })
}

// Chapter-scoped bulk update for lesson plan statuses (HM only)
export async function chapterBulkUpdateLessonPlanStatus(schemeId, chapter, status, reviewComments = '', requesterEmail = '') {
  return postJSON(`${BASE_URL}?action=chapterBulkUpdateLessonPlanStatus`, {
    schemeId,
    chapter,
    status,
    reviewComments,
    requesterEmail
  })
}

// Grouped lesson plans by chapter
export async function getLessonPlansByChapter({ teacher = '', class: cls = '', subject = '', status = 'Pending Review', dateFrom = '', dateTo = '', noCache = false } = {}) {
  const q = new URLSearchParams({ action: 'getLessonPlansByChapter' });
  if (teacher) q.append('teacher', teacher);
  if (cls) q.append('class', cls);
  if (subject) q.append('subject', subject);
  if (status && status !== 'All') q.append('status', status);
  if (dateFrom) q.append('dateFrom', dateFrom);
  if (dateTo) q.append('dateTo', dateTo);
  if (noCache) q.append('_', String(Date.now()));
  const res = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return res?.data || res || { groups: [] };
}

// Grouped lesson plans by class with subject•chapter subgroups
export async function getLessonPlansByClass({ teacher = '', class: cls = '', subject = '', status = 'Pending Review', dateFrom = '', dateTo = '', noCache = false } = {}) {
  const q = new URLSearchParams({ action: 'getLessonPlansByClass' });
  if (teacher) q.append('teacher', teacher);
  if (cls) q.append('class', cls);
  if (subject) q.append('subject', subject);
  if (status && status !== 'All') q.append('status', status);
  if (dateFrom) q.append('dateFrom', dateFrom);
  if (dateTo) q.append('dateTo', dateTo);
  if (noCache) q.append('_', String(Date.now()));
  const res = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return res?.data || res || { groups: [] };
}

// HM: Get pending lesson plans (raw lesson plans awaiting review/approval)
// Supports filters: teacher (email fragment or name), class, subject, status.
// When status === 'All' we omit the status param so backend returns every status.
// Returns an array of lesson plan objects; unwraps {status,data,timestamp} wrapper.
export async function getPendingLessonPlans({ teacher = '', class: cls = '', subject = '', status = 'Pending Review' } = {}) {
  try {
    const q = new URLSearchParams({ action: 'getPendingLessonPlans' });
    if (teacher) q.append('teacher', teacher);
    if (cls) q.append('class', cls);
    if (subject) q.append('subject', subject);
    if (status && status !== 'All') q.append('status', status);
    const res = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE);
    const unwrapped = res?.data || res;
    return Array.isArray(unwrapped) ? unwrapped : (Array.isArray(unwrapped?.plans) ? unwrapped.plans : []);
  } catch (err) {
    console.warn('getPendingLessonPlans failed:', err?.message || err);
    throw err;
  }
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

// HM: Merged Plan vs Actual (timetable + plans + reports) for a date
export async function getHMDailyOversightData(date) {
  const q = new URLSearchParams({ action: 'getHMDailyOversightData', date })
  const res = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE)
  return res?.data || res || { success: false }
}

// HM: Missing submissions for a date
export async function getMissingSubmissions(date) {
  const q = new URLSearchParams({ action: 'getMissingSubmissions', date })
  const res = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION)
  return res?.data || res || { success: false };
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
export async function getVacantSlotsForAbsent(date, absent = [], options = {}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getVacantSlotsForAbsent', date })
  absent.forEach(a => q.append('absent', a))
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

export async function getPotentialAbsentTeachers() {
  return getJSON(`${BASE_URL}?action=getPotentialAbsentTeachers`)
}

export async function getFreeTeachers(date, period, absent = []) {
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

export async function getDailyTimetableWithSubstitutions(date, options = {}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getDailyTimetableWithSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

export async function getAssignedSubstitutions(date, options = {}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'getAssignedSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

// Debug endpoint to check raw substitutions data
export async function debugSubstitutions(date, options = {}) {
  const { noCache = false } = options || {};
  const q = new URLSearchParams({ action: 'debugSubstitutions', date })
  if (noCache) q.append('_', String(Date.now()))
  return getJSON(`${BASE_URL}?${q.toString()}`)
}

// New substitution management functions
export async function getDailyTimetableForDate(date, options = {}) {
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

export async function getSubstitutionsForDate(date, options = {}) {
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

export async function getAvailableTeachers(date, period, options = {}) {
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

// Delete an exam (Super Admin only)
export async function deleteExam(email, examId) {
  const result = await postJSON(`${BASE_URL}?action=deleteExam`, { email, examId });
  return result?.data || result;
}

// Delete a daily report (Super Admin only)
export async function deleteReport(email, reportId) {
  const result = await postJSON(`${BASE_URL}?action=deleteReport`, { email, reportId });
  return result?.data || result;
}

// === USER MANAGEMENT (Super Admin only) ===
export async function getAllUsers(email) {
  const result = await getJSON(`${BASE_URL}?action=getAllUsers&email=${encodeURIComponent(email)}`);
  return result?.data || result || [];
}

export async function addUser(email, userData) {
  const result = await postJSON(`${BASE_URL}?action=addUser`, { email, ...userData });
  return result?.data || result;
}

export async function updateUser(adminEmail, userEmail, userData) {
  const result = await postJSON(`${BASE_URL}?action=updateUser`, { 
    email: adminEmail,  // Admin email for permission check
    userEmail: userEmail,  // Email of user to update
    ...userData 
  });
  return result?.data || result;
}

export async function deleteUser(email, userEmail) {
  const result = await postJSON(`${BASE_URL}?action=deleteUser`, { email, userEmail });
  return result?.data || result;
}

// === AUDIT LOG FUNCTIONS ===

// Get audit logs with optional filters
export async function getAuditLogs(filters = {}) {
  console.log('[API] getAuditLogs called with filters:', filters);
  
  // Extract email from stored user object (check both basic login and Google OAuth storage)
  let userEmail = null;
  
  // Check basic login storage first
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try {
      userEmail = JSON.parse(basicUser).email;
      console.log('[API] Email from basic login:', userEmail);
    } catch (e) {
      console.error('[API] Failed to parse basic user:', e);
    }
  }
  
  // If not found, check Google OAuth storage
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try {
        const session = JSON.parse(googleSession);
        userEmail = session.user?.email;
        console.log('[API] Email from Google session:', userEmail);
      } catch (e) {
        console.error('[API] Failed to parse Google session:', e);
      }
    }
  }
  
  console.log('[API] Final extracted user email:', userEmail);
  
  const payload = { 
    email: userEmail,
    filters 
  };
  
  const result = await postJSON(`${BASE_URL}?action=getAuditLogs`, payload);
  // Backend wraps response as { status, data, timestamp }
  const finalResult = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
  return finalResult;
}

// Get audit trail for a specific entity
export async function getEntityAuditTrail(entityType, entityId) {
  // Extract email from stored user object (check both basic login and Google OAuth storage)
  let userEmail = null;
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { userEmail = JSON.parse(basicUser).email; } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { userEmail = JSON.parse(googleSession).user?.email; } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=getEntityAuditTrail`, {
    email: userEmail,
    entityType,
    entityId
  });
  return result?.data || result || [];
}

// Get audit summary statistics
export async function getAuditSummary(filters = {}) {
  // Extract email from stored user object (check both basic login and Google OAuth storage)
  let userEmail = null;
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { userEmail = JSON.parse(basicUser).email; } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { userEmail = JSON.parse(googleSession).user?.email; } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=getAuditSummary`, {
    email: userEmail,
    filters
  });
  return result?.data || result || {};
}

// Export audit logs for compliance
export async function exportAuditLogs(filters = {}) {
  // Extract email from stored user object (check both basic login and Google OAuth storage)
  let userEmail = null;
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { userEmail = JSON.parse(basicUser).email; } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { userEmail = JSON.parse(googleSession).user?.email; } catch (e) {}
    }
  }
  const result = await postJSON(`${BASE_URL}?action=exportAuditLogs`, {
    email: userEmail,
    filters
  });
  return result?.data || result || [];
}

// === HOLIDAY MANAGEMENT FUNCTIONS ===

// Mark a date as undeclared holiday
export async function markUndeclaredHoliday(date, reason) {
  let userEmail = null;
  let userName = null;
  
  // Extract user from stored session
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      const user = JSON.parse(basicUser);
      userEmail = user.email;
      userName = user.name;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        const session = JSON.parse(googleSession);
        userEmail = session.user?.email;
        userName = session.user?.name;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=markUndeclaredHoliday`, {
    date,
    reason,
    email: userEmail,
    name: userName
  });
  return result?.data || result;
}

// Get all undeclared holidays
export async function getUndeclaredHolidays(activeOnly = true) {
  let userEmail = null;
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { userEmail = JSON.parse(basicUser).email; } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { userEmail = JSON.parse(googleSession).user?.email; } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=getUndeclaredHolidays`, {
    email: userEmail,
    activeOnly
  });
  return result?.data || result || [];
}

// Delete an undeclared holiday
export async function deleteUndeclaredHoliday(holidayId) {
  let userEmail = null;
  let userName = null;
  
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      const user = JSON.parse(basicUser);
      userEmail = user.email;
      userName = user.name;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        const session = JSON.parse(googleSession);
        userEmail = session.user?.email;
        userName = session.user?.name;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=deleteUndeclaredHoliday`, {
    holidayId,
    email: userEmail,
    name: userName
  });
  return result?.data || result;
}

// Cascade lesson plans from a start date, skipping undeclared holidays
export async function cascadeLessonPlans(startDate) {
  let userEmail = null;
  let userName = null;
  
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      const user = JSON.parse(basicUser);
      userEmail = user.email;
      userName = user.name;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        const session = JSON.parse(googleSession);
        userEmail = session.user?.email;
        userName = session.user?.name;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=cascadeLessonPlans`, {
    startDate,
    email: userEmail,
    name: userName
  });
  return result?.data || result;
}

// Get affected lesson plans for a start date (preview before cascading)
export async function getAffectedLessonPlans(startDate) {
  let userEmail = null;
  
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      userEmail = JSON.parse(basicUser).email;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        userEmail = JSON.parse(googleSession).user?.email;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=getAffectedLessonPlans`, {
    startDate,
    email: userEmail
  });
  return result?.data || result;
}

// Get recent cascade operations
export async function getRecentCascades(limit = 10) {
  let userEmail = null;
  
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      userEmail = JSON.parse(basicUser).email;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        userEmail = JSON.parse(googleSession).user?.email;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=getRecentCascades`, {
    limit,
    email: userEmail
  });
  return result?.data || result;
}

// Undo a cascade operation
export async function undoCascade(cascadeId) {
  let userEmail = null;
  let userName = null;
  
  const basicUser = localStorage.getItem('user');
  if (basicUser) {
    try { 
      const user = JSON.parse(basicUser);
      userEmail = user.email;
      userName = user.name;
    } catch (e) {}
  }
  if (!userEmail) {
    const googleSession = localStorage.getItem('sf_google_session');
    if (googleSession) {
      try { 
        const session = JSON.parse(googleSession);
        userEmail = session.user?.email;
        userName = session.user?.name;
      } catch (e) {}
    }
  }
  
  const result = await postJSON(`${BASE_URL}?action=undoCascade`, {
    cascadeId,
    email: userEmail,
    name: userName
  });
  return result?.data || result;
}

// === EXAM FUNCTIONS ===

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
export async function getAllSchemes(page = 1, pageSize = 10, teacher = '', cls = '', subject = '', status = '', month = '') {
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
  // Handle multiple response formats: direct array, {data: [...]}, {reports: [...]}
  if (Array.isArray(result)) return result;
  if (result?.data) return Array.isArray(result.data) ? result.data : (result.data.reports || []);
  if (result?.reports) return result.reports;
  return [];
}

export async function deleteDailyReport(reportId, email) {
  const payload = { action: 'deleteDailyReport', reportId, email };
  const res = await postJSON(`${BASE_URL}?action=deleteDailyReport`, payload);
  const unwrapped = res?.data || res;
  return unwrapped;
}

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
  const result = await getJSON(`${BASE_URL}?action=getGradeTypes`);
  return result?.data || result || [];
}

// Fetch grade boundaries used to assign letter grades based on percentage
export async function getGradeBoundaries() {
  const result = await getJSON(`${BASE_URL}?action=getGradeBoundaries`);
  return result?.data || result || [];
}

// Fetch subjects for a specific class from ClassSubjects sheet
export async function getClassSubjects(className) {
  const result = await getJSON(`${BASE_URL}?action=getClassSubjects&class=${encodeURIComponent(className)}`, CACHE_DURATION);
  return result?.data || result;
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

// Create bulk scheme-based lesson plans (all sessions at once)
export async function createBulkSchemeLessonPlans(bulkPlanData) {
  return postJSON(BASE_URL, {
    action: 'createBulkSchemeLessonPlans',
    bulkPlanData
  });
}

// Get AI-powered lesson plan suggestions
export async function getAILessonSuggestions(context) {
  console.log('[api.js] Calling getAILessonSuggestions with:', context);
  const result = await postJSON(BASE_URL, {
    action: 'getAILessonSuggestions',
    context
  });
  console.log('[api.js] getAILessonSuggestions result:', result);
  return result;
}

// Get all teachers
export async function getAllTeachers() {
  const q = new URLSearchParams({
    action: 'getAllTeachers'
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, LONG_CACHE_DURATION);
}

// Get daily readiness status for lesson plans and reports
export async function getDailyReadinessStatus(date = null) {
  const q = new URLSearchParams({
    action: 'getDailyReadinessStatus'
  });
  if (date) {
    q.append('date', date);
  }
  return getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE);
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
// Note: TeacherPerformance sheet and related endpoints removed.

// Get daily submission metrics and trends (HM only)
export async function getDailySubmissionMetrics(daysBack = 30) {
  const q = new URLSearchParams({
    action: 'getDailySubmissionMetrics',
    daysBack: String(daysBack)
  });
  return getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
}

// Get class/subject performance analytics (HM only)
export async function getClassSubjectPerformance() {
  const q = new URLSearchParams({
    action: 'getClassSubjectPerformance'
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, SHORT_CACHE_DURATION);
  return result?.data || result; // Expect { success, classMetrics: [...] }
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

// HM: Verify/reopen daily reports
export async function verifyDailyReport(reportId, verifierEmail) {
  const res = await postJSON(`${BASE_URL}?action=verifyDailyReport`, { action: 'verifyDailyReport', reportId, verifierEmail });
  return res?.data || res;
}

export async function reopenDailyReport(reportId, requesterEmail, reason = '') {
  const res = await postJSON(`${BASE_URL}?action=reopenDailyReport`, { action: 'reopenDailyReport', reportId, requesterEmail, reason });
  return res?.data || res;
}

export async function notifyMissingSubmissions(date, requesterEmail) {
  const res = await postJSON(`${BASE_URL}?action=notifyMissingSubmissions`, { action: 'notifyMissingSubmissions', date, requesterEmail });
  return res?.data || res;
}

// ====== MISSING LESSON PLAN NOTIFICATIONS ======
export async function getMissingLessonPlans(teacherEmail, daysAhead = 7) {
  const q = new URLSearchParams({
    action: 'getMissingLessonPlans',
    teacherEmail,
    daysAhead
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE);
  return result?.data || result;
}

export async function getAllMissingLessonPlans(daysAhead = 7) {
  const q = new URLSearchParams({
    action: 'getAllMissingLessonPlans',
    daysAhead
  });
  const result = await getJSON(`${BASE_URL}?${q.toString()}`, NO_CACHE);
  return result?.data || result;
}

