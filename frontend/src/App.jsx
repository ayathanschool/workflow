/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable import/order */
import { 
  User, 
  BookOpen, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Book,
  BarChart2,
  Bell,
  Search,
  Filter,
  Eye,
  Edit,
  Edit2,
  Plus,
  Trash2,
  Download,
  UserCheck,
  Award,
  School,
  CalendarDays,
  UserPlus,
  BookCheck,
  FileCheck,
  FileClock,
  RefreshCw,
  LayoutGrid,
  ClipboardCheck,
  Check,
  AlertTriangle,
  XCircle,
  Shield,
  DollarSign,
  Target
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import * as api from './api'
import LoadingSplash from './auth/LoadingSplash';
import LoginForm from './auth/LoginForm';
import AnimatedPage from './components/AnimatedPage';
import PerformanceDebugger from './components/PerformanceDebugger';
import StatsCard from './components/shared/StatsCard';
import FeeCollectionModule from './components/FeeCollectionModule';
import ModernFeeCollection from './components/FeeCollection/ModernFeeCollection';
import PWAControls from './components/PWAControls';
import PWAInstallBanner from './components/PWAInstallBanner';
import ThemeToggle from './components/ThemeToggle';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { ToastProvider, useToast } from './hooks/useToast';
import { useTheme } from './contexts/ThemeContext';
import ApiErrorBanner from './components/shared/ApiErrorBanner';
// import { useRealTimeUpdates } from './hooks/useRealTimeUpdates';

// Lazy load heavy components for better performance
const SubstitutionModule = lazy(() => import('./components/SubstitutionModule'));
const EnhancedSubstitutionView = lazy(() => import('./components/EnhancedSubstitutionView'));
const DailyReportModern = lazy(() => import('./DailyReportModern'));
const ClassPeriodSubstitutionView = lazy(() => import('./components/ClassPeriodSubstitutionView'));
const AssessmentsManager = lazy(() => import('./components/AssessmentsManager'));
const LessonPlansManager = lazy(() => import('./components/LessonPlansManager'));
const ExamManagement = lazy(() => import('./components/ExamManagement'));
const ReportCard = lazy(() => import('./components/ReportCard'));
const Marklist = lazy(() => import('./components/Marklist'));
const SchemeLessonPlanning = lazy(() => import('./components/SchemeLessonPlanning'));
const SessionCompletionTracker = lazy(() => import('./components/SessionCompletionTracker'));
const HMDailyOversight = lazy(() => import('./components/HMDailyOversightEnhanced'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AuditLog = lazy(() => import('./components/AuditLog'));
const AdminDataEditor = lazy(() => import('./components/AdminDataEditor'));
const SchemeApprovalsView = lazy(() => import('./views/SchemeApprovalsView'));
const SubstitutionAnalyticsView = lazy(() => import('./components/SubstitutionAnalyticsView'));
const MissingDailyReportsTeacherwiseView = lazy(() => import('./components/MissingDailyReportsTeacherwiseView'));

// Keep lightweight components as regular imports
import { periodToTimeString, todayIST, formatDateForInput, formatLocalDate } from './utils/dateUtils';
// moved 'lucide-react' import above to satisfy import ordering

// Common utility functions to avoid duplication
const appNormalize = (s) => (s || '').toString().trim().toLowerCase();

const App = () => {
  
  // Get toast functions for notifications
  const { success, error, warning, info } = useToast();
  
  // Theme styling relies on 'dark' class on <html>; avoid consuming theme in App to prevent re-renders on toggle
  
  // API error banner state
  const [apiError, setApiError] = useState(null);
  
  // App settings for the whole application
  const [appSettings, setAppSettings] = useState({
    lessonPlanningDay: '',       // No restriction until settings define it
    allowNextWeekOnly: false,    // Next-week-only restriction disabled
    periodTimes: null,           // Will store custom period times if available
    periodTimesWeekday: null,    // Monday-Thursday period times
    periodTimesFriday: null,     // Friday period times

    // Missing Daily Reports (teacher dashboard)
    // Controlled by HM via Settings sheet (served from getAppSettings)
    missingDailyReports: {
      lookbackDays: 7,
      escalationDays: 2,
      maxRangeDays: 31,
      allowCustomRange: true
    }
  });
  
  // Create a memoized version of appSettings to avoid unnecessary re-renders
  const memoizedSettings = useMemo(() => {
    return appSettings || {
      lessonPlanningDay: '',
      allowNextWeekOnly: false,
      allowBackfillReporting: false,
      dailyReportDeleteMinutes: 0,
      cascadeAutoEnabled: false,
      periodTimes: null,
      periodTimesWeekday: null,
      periodTimesFriday: null,
      missingDailyReports: {
        lookbackDays: 7,
        escalationDays: 2,
        maxRangeDays: 31,
        allowCustomRange: true
      }
    };
  }, [appSettings]);

  useEffect(() => {
    const handler = (e) => {
      const detail = e && e.detail ? e.detail : null;
      if (!detail) {
        setApiError({ message: 'API error' });
        return;
      }
      if (typeof detail === 'string') {
        setApiError({ message: detail });
        return;
      }
      setApiError({
        message: detail.message ? String(detail.message) : 'API error',
        requestId: detail.requestId ? String(detail.requestId) : '',
        time: detail.time ? String(detail.time) : '',
        url: detail.url ? String(detail.url) : '',
        status: detail.status
      });
    };
    window.addEventListener('api-error', handler);
    return () => window.removeEventListener('api-error', handler);
  }, []);
  
  // Fetch app settings from the API
  useEffect(() => {
    async function fetchAppSettings() {
      try {
        const response = await api.getAppSettings();
        
        // Backend wraps response in {status, data, timestamp}
        const settings = response?.data || response;
        
        if (settings) {
          const newSettings = {
            lessonPlanningDay: settings.lessonPlanningDay || '',
            allowNextWeekOnly: false, // Ignore sheet value; do not restrict to next week
            allowBackfillReporting: !!settings.allowBackfillReporting,
            dailyReportDeleteMinutes: Number(settings.dailyReportDeleteMinutes ?? 0) || 0,
            cascadeAutoEnabled: !!settings.cascadeAutoEnabled,
            periodTimes: settings.periodTimes || settings.periodTimesWeekday || null,
            periodTimesWeekday: settings.periodTimesWeekday || null,
            periodTimesFriday: settings.periodTimesFriday || null,
            missingDailyReports: {
              lookbackDays: Number(settings?.missingDailyReports?.lookbackDays ?? 7) || 7,
              escalationDays: Number(settings?.missingDailyReports?.escalationDays ?? 2) || 2,
              maxRangeDays: Number(settings?.missingDailyReports?.maxRangeDays ?? 31) || 31,
              allowCustomRange: settings?.missingDailyReports?.allowCustomRange !== false
            }
          };
          setAppSettings(newSettings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        console.warn('⚠️ Could not load app settings (offline or backend unavailable). Using defaults.');
        // Keep default settings - app will still work
      }
    }
    fetchAppSettings();
  }, []);

  // ----- GLOBAL submit overlay -----
  const [submitting, setSubmitting] = useState({ active:false, message:'' });
  const [viewModal, setViewModal] = useState(null);

  // Lesson view modal state
  const [viewLesson, setViewLesson] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);

  const openLessonView = (lesson) => {
    setViewLesson(lesson);
    setShowLessonModal(true);
  };
  const closeLessonView = () => {
    setShowLessonModal(false);
    setViewLesson(null);
  };

  // tiny helper for field rows inside the modal
  const Detail = ({ label, value }) => (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-gray-900 dark:text-gray-100">{value ?? '-'}</div>
    </div>
  );

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      // Format as: Dec 01, 2025 (date only, no time)
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: '2-digit',
        timeZone: 'Asia/Kolkata'
      };
      const formattedDate = date.toLocaleDateString('en-US', options);
      return formattedDate;
    } catch (e) {
      return dateString; // Return original if parsing fails
    }
  };

  // Strip "STD " prefix from class names for display
  const stripStdPrefix = (className) => {
    if (!className) return '';
    const v = Array.isArray(className) ? className[0] : className;
    return String(v).trim().replace(/^STD\s*/i, '').trim();
  };

  // Subject display helper (keeps stored subject values untouched)
  const subjectDisplayName = (subject) => {
    const s = String(subject || '').trim();
    if (!s) return '';

    // Prefer sheet-style abbreviation where commonly used
    if (/^english\s+grammar$/i.test(s)) return 'Eng G';

    return s;
  };

  const submitInFlightRef = useRef(null);

  const withSubmit = async (message, fn) => {
    // Prevent accidental double-submits; if clicked twice, return the same in-flight promise.
    if (submitInFlightRef.current) return submitInFlightRef.current;

    const p = (async () => {
      setSubmitting({ active:true, message });
      try {
        const result = await fn();
        success('Success!', message || 'Operation completed successfully');
        return result;
      } catch (err) {
        console.error('submit error', err);
        error('Error!', err?.message || 'An error occurred');
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message: err?.message || String(err) } }));
        throw err;
      } finally {
        setSubmitting({ active:false, message: '' });
        submitInFlightRef.current = null;
      }
    })();

    submitInFlightRef.current = p;
    return p;
  };

  const ViewModal = () => (
    viewModal ? (
      <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-lg p-6 mx-4">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{viewModal.title || 'Lesson Details'}</h3>
            <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Objectives</h4>
              <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{viewModal.objectives || '-'}</div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Activities</h4>
              <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{viewModal.activities || '-'}</div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setViewModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
          </div>
        </div>
      </div>
    ) : null
  );

  // Full-screen submit overlay displayed while `withSubmit` is active
  const SubmitOverlay = () => (
    submitting && submitting.active ? (
      <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <div className="text-sm text-gray-700">{submitting.message || 'Submitting...'}</div>
        </div>
      </div>
    ) : null
  );
  
  // Lesson detail modal (opened by Eye buttons)
  const LessonModal = () => (
    showLessonModal && viewLesson ? (
      <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-lg p-4 md:p-6 mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{viewLesson.title || viewLesson.chapter || viewLesson.lpId || viewLesson.schemeId || viewLesson.class || 'Details'}</h3>
            <button onClick={closeLessonView} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Detail label="Class" value={stripStdPrefix(viewLesson.class)} />
              <Detail label="Subject" value={viewLesson.subject} />
              <Detail label="Chapter" value={viewLesson.chapter} />
              <Detail label="Session" value={
                viewLesson.session && viewLesson.noOfSessions 
                  ? `${viewLesson.session} of ${viewLesson.noOfSessions}` 
                  : viewLesson.session 
                    ? viewLesson.session 
                    : viewLesson.noOfSessions 
                      ? `${viewLesson.noOfSessions} sessions`
                      : '-'
              } />
              <Detail label="Teacher" value={viewLesson.teacherName || viewLesson.teacher || ''} />
              <Detail label="Status" value={viewLesson.status} />
              {viewLesson.selectedDate && <Detail label="Date" value={formatDate(viewLesson.selectedDate)} />}
              {viewLesson.selectedPeriod && <Detail label="Period" value={viewLesson.selectedPeriod} />}
            </div>
            
            {/* Learning Objectives */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Learning Objectives</h4>
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-3 rounded">
                {viewLesson.learningObjectives || viewLesson.objectives || '-'}
              </div>
            </div>
            
            {/* Teaching Methods */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teaching Methods</h4>
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-3 rounded">
                {viewLesson.teachingMethods || viewLesson.activities || '-'}
              </div>
            </div>
            
            {/* Resources Required */}
            {viewLesson.resourcesRequired && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Resources Required</h4>
                <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {viewLesson.resourcesRequired}
                </div>
              </div>
            )}
            
            {/* Assessment Methods */}
            {viewLesson.assessmentMethods && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Assessment Methods</h4>
                <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {viewLesson.assessmentMethods}
                </div>
              </div>
            )}
            
            {/* Review Comments (if any) */}
            {viewLesson.reviewComments && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-red-700 mb-2">Review Comments</h4>
                <div className="text-sm text-gray-800 whitespace-pre-wrap bg-red-50 p-3 rounded">
                  {viewLesson.reviewComments}
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
            <button onClick={closeLessonView} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
          </div>
        </div>
      </div>
    ) : null
  );
  // -----------------------------------------
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarOpenedAt, setSidebarOpenedAt] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // Google Auth integration
  const googleAuth = useGoogleAuth();
  // Local user (manual login) fallback
  const [localUser, setLocalUser] = useState(null);
  // effectiveUser is the currently authenticated user (from Google Auth, local login, or state)
  const effectiveUser = googleAuth?.user || localUser || user;

  // Memoize the user object passed to child components to prevent unnecessary re-renders
  // when parent re-renders due to theme changes or other state updates
  const memoizedUser = useMemo(() => {
    if (!effectiveUser) return null;
    return {
      email: effectiveUser.email || '',
      name: effectiveUser.name || '',
      roles: effectiveUser.roles || []
    };
  }, [effectiveUser?.email, effectiveUser?.name, effectiveUser?.roles?.join(',')]);

  // Send notification modal state - moved to app level for testing
  const [showSendNotification, setShowSendNotification] = useState(false);
  const [notificationData, setNotificationData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    recipients: 'all'
  });

  // Real-time updates - temporarily disabled to prevent infinite loops
  // const { isPolling, updateCount, lastUpdate } = useRealTimeUpdates(user);
  const isPolling = false;
  const updateCount = 0;
  const lastUpdate = null;

  // Role helpers — use normalized comparisons to handle different spellings/casing
  const _normRole = (r) => (r || '').toString().toLowerCase().trim();
  const hasRole = (token) => {
    const currentUser = effectiveUser || user;
    if (!currentUser || !Array.isArray(currentUser.roles)) return false;
    const t = (token || '').toString().toLowerCase();
    return currentUser.roles.some(r => {
      const rr = _normRole(r);
      // exact match or substring match (covers 'class teacher' and 'teacher')
      if (rr === t) return true;
      if (rr.includes(t)) return true;
      // handle compact variants like 'HM' vs 'H M'
      if (t.replace(/\s+/g,'') === rr.replace(/\s+/g,'')) return true;
      return false;
    });
  };
  const hasAnyRole = (tokens) => Array.isArray(tokens) && tokens.some(tok => hasRole(tok));

  // Authentication functions
  const login = async (email, password = '') => {
    try {
      // Call the login endpoint on the Apps Script backend.  The backend
      // authenticates by email and password and returns the user object or an error.
      const result = await api.login(email, password);
      if (result && !result.error) {
        const roles = Array.isArray(result.roles) ? result.roles : (result.roles ? String(result.roles).split(',').map(s=>s.trim()).filter(Boolean) : []);
        const merged = { ...result, roles };
        setUser(merged);
        setLocalUser(merged); // Set localUser for consistency
        localStorage.setItem('user', JSON.stringify(merged));
      } else {
        throw new Error(result?.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login failed:', error);
      // Optionally you could surface this error to the UI if desired
    }
  };

  const logout = () => {
    // Clear Google Auth if present
    if (googleAuth?.user) googleAuth.logout();
    setUser(null);
    setLocalUser(null); // Clear localUser as well
    localStorage.removeItem('user');
    // Clear all cached data on logout
    api.invalidateCache.onLogout();
  };

  // Initialize app - restore user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const roles = Array.isArray(parsed.roles) ? parsed.roles : (parsed.roles ? String(parsed.roles).split(',').map(s=>s.trim()).filter(Boolean) : []);
        const merged = { ...parsed, roles };
        setUser(merged);
        setLocalUser(merged); // IMPORTANT: Also set localUser so it persists on refresh
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Prefetch common data when user logs in
  useEffect(() => {
    if (user) {
      // Prefetch common data in parallel to warm up cache - with error handling
      const promises = [
        api.getAllClasses().catch((err) => { console.warn('Failed to prefetch classes:', err); return []; }),
        api.getGradeTypes().catch((err) => { console.warn('Failed to prefetch grade types:', err); return []; })
        // Temporarily removed getSubjects() due to API issues
      ];

      // Teacher-specific warmup: Scheme lesson planning is one of the slowest endpoints on cold start.
      // Prefetch it after login so opening the tab is instant.
      try {
        if (hasRole('teacher') && user?.email) {
          promises.push(
            api.getApprovedSchemesForLessonPlanning(user.email)
              .catch((err) => { console.warn('Failed to prefetch approved schemes:', err); return null; })
          );
        }
      } catch {}

      Promise.all(promises).catch((err) => { console.warn('Prefetch failed:', err); });
    }
  }, [user?.email]);

  // Navigation items based on user role
  const getNavigationItems = () => {
    const currentUser = effectiveUser || user;
    if (!currentUser) {
      return [];
    }
    
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: Home }
    ];
    
    if (!currentUser.roles || !Array.isArray(currentUser.roles) || currentUser.roles.length === 0) {
      return items;
    }

    // Super Admin gets access to everything (monitoring & management, not teacher workflows)
    if (hasAnyRole(['super admin', 'superadmin', 'super_admin'])) {
      items.push(
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'audit-log', label: 'Audit Log', icon: Shield },
        { id: 'substitutions', label: 'Substitutions', icon: UserPlus },
        { id: 'substitution-analytics', label: 'Substitution Analytics', icon: BarChart2 },
        { id: 'missing-daily-reports', label: 'Missing Daily Reports', icon: AlertTriangle },
        { id: 'class-data', label: 'School Data', icon: UserCheck },
        { id: 'admin-data', label: 'Admin Data', icon: Edit2 },
        { id: 'daily-oversight', label: 'Daily Oversight', icon: ClipboardCheck },
        { id: 'assessments', label: 'Assessments', icon: Award },
        { id: 'scheme-approvals', label: 'Scheme Approvals', icon: FileCheck },
        { id: 'lesson-approvals', label: 'Lesson Approvals', icon: BookCheck },
        { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
        { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays },
        { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign }
      );
      return items;
    }

    // Accounts role: Only Fee Collection module (plus dashboard)
    if (hasAnyRole(['accounts', 'accountant', 'account'])) {
      items.push({ id: 'fee-collection', label: 'Fee Collection', icon: DollarSign });
      return items;
    }

    if (hasAnyRole(['teacher','class teacher'])) {
      items.push(
        { id: 'schemes', label: 'Schemes of Work', icon: Book },
        { id: 'lessonplans', label: 'Lesson Plans', icon: BookOpen },
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'my-substitutions', label: 'My Substitutions', icon: UserPlus },
        { id: 'reports', label: 'Daily Reports (Enhanced)', icon: FileText },
        { id: 'my-daily-reports', label: 'My Reports History', icon: FileClock }
      );
      // Teachers and class teachers can also manage exams: view available exams,
      // enter marks for their classes and subjects, and view marks.
      items.push({ id: 'assessments', label: 'Assessments', icon: Award });
    }

    // Daily reporting teachers should have access to daily reports functionality
    if (hasAnyRole(['daily reporting teachers'])) {
      items.push(
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'reports', label: 'Daily Reports (Enhanced)', icon: FileText }
      );
    }

    if (hasRole('class teacher')) {
      items.push(
        { id: 'class-data', label: 'Class Data', icon: UserCheck },
        { id: 'class-students', label: 'Students', icon: Users },
        { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign }
      );
    }

    if (hasRole('h m')) {
      items.push(
        { id: 'scheme-approvals', label: 'Scheme Approvals', icon: FileCheck },
        { id: 'lesson-approvals', label: 'Lesson Approvals', icon: BookCheck },
        { id: 'daily-oversight', label: 'Daily Oversight (Enhanced)', icon: ClipboardCheck },
        { id: 'substitutions', label: 'Substitutions', icon: UserPlus },
        { id: 'substitution-analytics', label: 'Substitution Analytics', icon: BarChart2 },
        { id: 'missing-daily-reports', label: 'Missing Daily Reports', icon: AlertTriangle },
        { id: 'class-data', label: 'School Data', icon: UserCheck },
        { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
        { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays },
        { id: 'assessments', label: 'Assessments', icon: Award },
        { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign }
      );
      // Additional management views for the headmaster
      items.push(
        { id: 'daily-reports-management', label: 'All Reports', icon: FileText }
      );
    }

    // Admin role should also be able to access reporting dashboards.
    // Keep this scoped (reports-only) unless explicitly expanded.
    if (!hasRole('h m') && hasAnyRole(['admin'])) {
      items.push(
        { id: 'daily-reports-management', label: 'All Reports', icon: FileText },
        { id: 'missing-daily-reports', label: 'Missing Daily Reports', icon: AlertTriangle }
      );
    }

    // Students can view their report cards
    if (hasAnyRole(['student'])) {
      items.push({ id: 'assessments', label: 'My Report Card', icon: FileText });
    }

    return items;
  };

  // Substitution notifications state (moved to App level to avoid hook issues)
  
  // Dashboard component
  const Dashboard = ({ 
    showSendNotification, 
    setShowSendNotification, 
    notificationData, 
    setNotificationData 
  }) => {

    // Use the effective logged-in user to avoid re-fetch loops / wrong role detection
    const currentUser = effectiveUser || user;

    // Insights state holds counts used to populate the summary cards. When the
    // logged-in user is the headmaster ("H M" role) we fetch global counts
    // from the API. For teachers/class teachers we compute counts based on
    // their own classes/subjects and optionally compute class performance.
    // All fields default to zero to avoid showing mock numbers.
    const [insights, setInsights] = useState({
      planCount: 0,
      lessonCount: 0,
      teacherCount: 0,
      classCount: 0,
      subjectCount: 0,
      pendingReports: 0,
      classStudentCounts: {},
      teachingClasses: [],
      teachingSubjects: [],
      studentsAboveAverage: 0,
      studentsNeedFocus: 0,
      assignedClassPerformance: null,
      classPerformance: {} // { className: { aboveAverage, needFocus, avgPercentage } }
    });
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardLoaded, setDashboardLoaded] = useState(false);

    // Lightweight lesson plan warning (teacher dashboard)
    const [missingPlansSummary, setMissingPlansSummary] = useState({ loading: false, count: 0 });

    // Live period (teacher dashboard)
    const [liveTimetableState, setLiveTimetableState] = useState({ loading: false, periods: [], error: null });
    const [nowTick, setNowTick] = useState(0);

    // Pending daily reports (teacher dashboard)
    const [pendingReportsSummary, setPendingReportsSummary] = useState({
      loading: false,
      date: todayIST(),
      count: 0,
      pending: [],
      missingDays: 0,
      range: { from: '', to: '' }
    });

    const [missingReportsExpanded, setMissingReportsExpanded] = useState(false);

    const [missingRange, setMissingRange] = useState({ from: '', to: '' });
    const [missingRangeDraft, setMissingRangeDraft] = useState({ from: '', to: '' });
    const [missingRangeTouched, setMissingRangeTouched] = useState(false);

    // Send notification modal state - now using app-level state
    // const [showSendNotification, setShowSendNotification] = useState(true); // Removed - moved to app level
    // const [notificationData, setNotificationData] = useState({
    //   title: '',
    //   message: '',
    //   priority: 'normal',
    //   recipients: 'all'
    // });

    // Test notification function for development
    const testNotifications = () => {
      success('Success!', 'Your lesson plan has been approved');
      setTimeout(() => {
        warning('Warning!', 'You have a deadline approaching in 2 days');
      }, 1000);
      setTimeout(() => {
        error('Error!', 'Failed to submit report. Please try again.');
      }, 2000);
      setTimeout(() => {
        info('Info', 'System maintenance scheduled for tonight at 10 PM');
      }, 3000);
    };

    // Send custom notification function
    const sendCustomNotification = async (title, message, priority, recipients) => {
      try {
        if (!currentUser?.email) {
          error('Send Failed', 'User not logged in');
          return;
        }
        const result = await api.sendCustomNotification(currentUser.email, title, message, priority, recipients);
        if (result.success) {
          success('Notification Sent!', result.message);
          setShowSendNotification(false);
        } else {
          error('Send Failed', result.error || 'Failed to send notification');
        }
      } catch (err) {
        error('Send Error', err.message || 'An error occurred while sending notification');
      }
    };

    // Ref to avoid duplicate dashboard fetches, but still allow re-fetch when user details load/refresh
    const dashboardFetchKeyRef = useRef('');

    useEffect(() => {
      async function fetchDashboardData() {
        if (!currentUser?.email) return;

        const rolesKey = Array.isArray(currentUser?.roles)
          ? currentUser.roles.map(r => String(r || '').toLowerCase().trim()).sort().join(',')
          : '';
        const classesKey = Array.isArray(currentUser?.classes) ? currentUser.classes.join(',') : String(currentUser?.classes || '');
        const subjectsKey = Array.isArray(currentUser?.subjects) ? currentUser.subjects.join(',') : String(currentUser?.subjects || '');
        const ctKey = Array.isArray(currentUser?.classTeacherFor)
          ? currentUser.classTeacherFor.join(',')
          : String(currentUser?.classTeacherFor || '');
        const fetchKey = `${currentUser.email}|${rolesKey}|${classesKey}|${subjectsKey}|${ctKey}`;

        // DEV-only: StrictMode can mount/unmount twice; avoid immediate duplicate fetches
        if (import.meta?.env?.DEV) {
          try {
            const prevKey = sessionStorage.getItem('dashboard.fetchKey') || '';
            const prevAt = Number(sessionStorage.getItem('dashboard.fetchAt') || 0);
            if (prevKey === fetchKey && Date.now() - prevAt < 2000) return;
            sessionStorage.setItem('dashboard.fetchKey', fetchKey);
            sessionStorage.setItem('dashboard.fetchAt', String(Date.now()));
          } catch (e) {
            // ignore storage errors
          }
        }

        // Skip if we've already fetched for the same effective user data
        if (dashboardFetchKeyRef.current === fetchKey) return;
        dashboardFetchKeyRef.current = fetchKey;
        try {
          setDashboardLoading(true);
          // Headmaster view: use HM insights and classes count
          if (hasRole('h m')) {
            const [hmData, classes] = await Promise.all([
              api.getHmInsights(),
              api.getAllClasses()
            ]);
            const newInsights = {
              planCount: hmData?.planCount || 0,
              lessonCount: hmData?.lessonCount || 0,
              teacherCount: hmData?.teacherCount || 0,
              classCount: Array.isArray(classes) ? classes.length : 0,
              subjectCount: 0,
              pendingReports: 0
            };
            setInsights(newInsights);
          } else if (hasAnyRole(['teacher','class teacher','daily reporting teachers'])) {
            // Teacher view: compute classes and subjects from user object
            // Some users (notably class teachers) may not have `user.classes` populated; fall back to classTeacherFor.
            const teachingClassesFromUser = Array.isArray(currentUser?.classes)
              ? currentUser.classes
              : (currentUser?.classes ? String(currentUser.classes).split(',').map(s => s.trim()).filter(Boolean) : []);
            const classTeacherFor = Array.isArray(currentUser?.classTeacherFor)
              ? currentUser.classTeacherFor
              : (currentUser?.classTeacherFor ? [currentUser.classTeacherFor] : []);
            const teachingClasses = (teachingClassesFromUser.length > 0)
              ? teachingClassesFromUser
              : (hasRole('class teacher') ? classTeacherFor : []);

            const teachingSubjects = Array.isArray(currentUser?.subjects)
              ? currentUser.subjects
              : (currentUser?.subjects ? String(currentUser.subjects).split(',').map(s => s.trim()).filter(Boolean) : []);

            // Normalize + de-dupe classes (prevents double API calls from mixed formats like "STD 10A" vs "10A")
            const normClassKey = (s) => stripStdPrefix(String(s || '')).trim().toLowerCase().replace(/\s+/g, '');
            const uniqueTeachingClasses = Array.from(
              new Map((Array.isArray(teachingClasses) ? teachingClasses : []).map(cls => [normClassKey(cls), cls]))
                .values()
            );
            const uniqueTeachingSubjects = Array.from(new Set(Array.isArray(teachingSubjects) ? teachingSubjects : []));

            const classCount = uniqueTeachingClasses.length;
            const subjectCount = uniqueTeachingSubjects.length;

            // Pre-populate counts to avoid initial blank UI
            setInsights(prev => ({
              ...prev,
              classCount,
              subjectCount,
              teachingClasses: uniqueTeachingClasses,
              teachingSubjects: uniqueTeachingSubjects
            }));

            // Mark dashboard as loaded quickly; do heavy fetching in background
            setDashboardLoaded(true);
            setDashboardLoading(false);

            // Background: student counts + class performance
            (async () => {
              // If user changes while this runs, skip applying stale results
              const activeKey = fetchKey;

              // Fetch student counts per class for class teacher
              let classStudentCounts = {};
              let studentsAboveAverage = 0;
              let studentsNeedFocus = 0;
              let classPerformance = {};
              let assignedClassPerformance = null;

              if (hasRole('class teacher') && uniqueTeachingClasses.length > 0) {
                try {
                  // PERFORMANCE: Batch fetch students for all classes in one API call.
                  const strippedClasses = uniqueTeachingClasses
                    .map(cls => stripStdPrefix(cls))
                    .map(s => String(s || '').trim())
                    .filter(Boolean);

                  const studentsByClass = await api.getStudentsBatch(strippedClasses).catch(() => ({}));

                  uniqueTeachingClasses.forEach((cls) => {
                    const stripped = stripStdPrefix(cls);
                    const students = studentsByClass?.[stripped] || studentsByClass?.[String(stripped || '').trim()] || [];
                    const count = Array.isArray(students) ? students.length : 0;
                    classStudentCounts[cls] = count;
                    classStudentCounts[stripped] = count;
                  });

                  // Calculate academic performance for class teacher's classes (uses newest exam with marks)
                  try {
                    uniqueTeachingClasses.forEach(className => {
                      const normKey = normClassKey(className);
                      if (!classPerformance[normKey]) {
                        classPerformance[normKey] = {
                          aboveAverage: 0,
                          needFocus: 0,
                          avgPercentage: 0,
                          totalStudents: classStudentCounts[className] || 0,
                          studentsWithMarks: 0,
                          displayName: className
                        };
                      }
                    });

                    const examsArray = [];
                    const allMarksArrays = [];

                    // PERFORMANCE: Fetch exams and status ONCE for all classes, then filter client-side
                    // This prevents N API calls (one per class) which was causing 7+ redundant getExams() calls
                    const [allExamsRaw, allStatusRaw] = await Promise.all([
                      api.getExams({}).catch(() => []),
                      api.getExamMarksEntryStatusAll({ limit: 500 }).catch(() => ({ success: false, exams: [] }))
                    ]);

                    const allExams = Array.isArray(allExamsRaw) ? allExamsRaw : [];
                    const allStatusRows = allStatusRaw && Array.isArray(allStatusRaw.exams) ? allStatusRaw.exams : [];

                    // Filter exams and status by each teaching class
                    const perClassData = uniqueTeachingClasses.map((cls) => {
                      const normCls = normClassKey(cls);
                      const exams = allExams.filter(ex => normClassKey(ex?.class || '') === normCls);
                      const statusRows = allStatusRows.filter(s => normClassKey(s?.class || '') === normCls);
                      return { cls, exams, statusRows };
                    });

                    for (const item of perClassData) {
                      const normCls = normClassKey(item.cls);
                      const statusById = {};
                      (item.statusRows || []).forEach(r => {
                        if (r && r.examId) statusById[String(r.examId)] = r;
                      });

                      const sortedExams = (item.exams || [])
                        .filter(ex => normClassKey(ex?.class) === normCls)
                        .slice()
                        .sort((a, b) => {
                          const da = new Date(a?.date || a?.createdAt || 0);
                          const db = new Date(b?.date || b?.createdAt || 0);
                          const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
                          const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
                          return tb - ta;
                        });

                      const chosenExam = sortedExams.find(ex => Number(statusById[String(ex.examId)]?.enteredCount || 0) > 0) || null;
                      if (!chosenExam) continue;

                      const chosenMarks = await api.getExamMarks(chosenExam.examId).catch(() => []);
                      examsArray.push(chosenExam);
                      allMarksArrays.push(Array.isArray(chosenMarks) ? chosenMarks : []);
                    }

                    if (examsArray.length > 0) {
                      let totalAboveAverage = 0;
                      let totalNeedFocus = 0;

                      examsArray.forEach((exam, idx) => {
                        const marks = allMarksArrays[idx];
                        const className = exam.class;
                        const normKey = normClassKey(className);
                        if (!Array.isArray(marks) || marks.length === 0) return;

                        const normAdm = (s) => String(s || '').trim().toLowerCase();
                        const byAdm = new Map();

                        marks.forEach(mark => {
                          if (mark.class && normClassKey(mark.class) !== normKey) return;
                          const totalVal = (mark && (mark.total ?? mark.Total)) ?? '';
                          const ceVal = (mark && (mark.ce ?? mark.CE)) ?? '';
                          const teVal = (mark && (mark.te ?? mark.TE)) ?? '';
                          const admKey = normAdm(mark?.admNo);
                          if (!admKey) return;

                          const teStr = String(teVal).trim().toUpperCase();
                          const gradeStr = String(mark.grade || '').trim().toLowerCase();
                          if (teStr === 'A' || gradeStr === 'absent') return;

                          const totalNum = Number(totalVal);
                          const ceNum = Number(ceVal || 0);
                          const teNum = Number(teVal || 0);
                          const total = (Number.isFinite(totalNum) && String(totalVal).trim() !== '') ? totalNum : (ceNum + teNum);
                          if (ceNum === 0 && teNum === 0 && total === 0) return;

                          const totalMaxNum = Number(exam?.totalMax);
                          const max = (Number.isFinite(totalMaxNum) && totalMaxNum > 0)
                            ? totalMaxNum
                            : ((Number(exam?.internalMax) || 0) + (Number(exam?.externalMax) || 0) || 100);

                          if (total >= 0 && max > 0) {
                            const entry = { total, max, percentage: (total / max) * 100 };
                            if (!byAdm.has(admKey)) {
                              byAdm.set(admKey, entry);
                            } else {
                              const prev = byAdm.get(admKey);
                              if ((entry.total || 0) > (prev.total || 0)) byAdm.set(admKey, entry);
                            }
                          }
                        });

                        const studentMarks = Array.from(byAdm.values());
                        if (studentMarks.length === 0) return;
                        const percentages = studentMarks.map(m => m.percentage);
                        const avgPercentage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
                        const aboveAverage = percentages.filter(p => p >= avgPercentage).length;
                        const needFocus = percentages.filter(p => p < 50).length;
                        const actualTotal = classStudentCounts[className] || studentMarks.length;

                        classPerformance[normKey] = {
                          aboveAverage,
                          needFocus,
                          avgPercentage: Math.round(avgPercentage),
                          totalStudents: actualTotal,
                          studentsWithMarks: studentMarks.length,
                          aboveAveragePct: actualTotal > 0 ? Math.round((aboveAverage / actualTotal) * 100) : 0,
                          needFocusPct: actualTotal > 0 ? Math.round((needFocus / actualTotal) * 100) : 0,
                          displayName: className
                        };

                        totalAboveAverage += aboveAverage;
                        totalNeedFocus += needFocus;
                      });

                      studentsAboveAverage = totalAboveAverage;
                      studentsNeedFocus = totalNeedFocus;

                      // Summary cards should reflect ONLY the class teacher's assigned class.
                      // Keep class-wise performance for all teaching classes.
                      if (hasRole('class teacher') && classTeacherFor.length > 0) {
                        const assignedNormKey = normClassKey(classTeacherFor[0]);
                        assignedClassPerformance = classPerformance?.[assignedNormKey] || null;
                        if (assignedClassPerformance) {
                          studentsAboveAverage = Number(assignedClassPerformance.aboveAverage || 0);
                          studentsNeedFocus = Number(assignedClassPerformance.needFocus || 0);
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('Unable to fetch performance data:', err);
                  }
                } catch (err) {
                  console.warn('Unable to fetch student counts:', err);
                }
              }

              if (dashboardFetchKeyRef.current !== activeKey) return;
              setInsights(prev => ({
                ...prev,
                classStudentCounts,
                studentsAboveAverage,
                studentsNeedFocus,
                assignedClassPerformance,
                classPerformance
              }));
            })();

            return;
            
          }
        } catch (err) {
          console.error('Error loading dashboard data:', err);
        } finally {
          setDashboardLoading(false);
        }
      }
      
      if (currentUser?.email) fetchDashboardData();
    }, [
      currentUser?.email,
      Array.isArray(currentUser?.roles) ? currentUser.roles.join('|') : String(currentUser?.roles || ''),
      Array.isArray(currentUser?.classes) ? currentUser.classes.join('|') : String(currentUser?.classes || ''),
      Array.isArray(currentUser?.subjects) ? currentUser.subjects.join('|') : String(currentUser?.subjects || ''),
      Array.isArray(currentUser?.classTeacherFor) ? currentUser.classTeacherFor.join('|') : String(currentUser?.classTeacherFor || '')
    ]);

    // Fetch missing lesson plan summary for next 2 days (today + tomorrow)
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        if (!currentUser?.email) return;
        if (!hasAnyRole(['teacher', 'class teacher', 'daily reporting teachers'])) return;
        // HM/Super Admin should not see teacher prep warnings
        if (hasAnyRole(['h m', 'super admin', 'superadmin', 'super_admin'])) return;

        try {
          setMissingPlansSummary(prev => ({ ...prev, loading: true }));
          const res = await api.getMissingLessonPlans(currentUser.email, 2);
          if (cancelled) return;
          const count = Number(res?.missingCount || 0);
          setMissingPlansSummary({ loading: false, count: Number.isFinite(count) ? count : 0 });
        } catch (e) {
          if (cancelled) return;
          setMissingPlansSummary({ loading: false, count: 0 });
        }
      };
      run();
      return () => { cancelled = true; };
    }, [currentUser?.email, Array.isArray(currentUser?.roles) ? currentUser.roles.join('|') : String(currentUser?.roles || '')]);

    // Missing daily reports: compute for recent past days up to yesterday (11:59pm IST). Excludes today.
    useEffect(() => {
      if (!currentUser?.email) return;
      if (!hasAnyRole(['teacher', 'class teacher', 'daily reporting teachers'])) return;
      if (hasAnyRole(['h m', 'super admin', 'superadmin', 'super_admin'])) return;

      let cancelled = false;

      const normalizeText = (v) => String(v || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, '');

      const normalizePeriod = (v) => {
        const s = String(v ?? '').trim();
        const m = s.match(/(\d+)/);
        return m ? m[1] : s;
      };

      const normalizePeriods = (timetableRes) => {
        if (Array.isArray(timetableRes)) return timetableRes;
        if (Array.isArray(timetableRes?.periods)) return timetableRes.periods;
        if (Array.isArray(timetableRes?.data)) return timetableRes.data;
        return [];
      };

      const buildKey = (obj) => {
        const period = normalizePeriod(obj?.period ?? obj?.Period ?? obj?.selectedPeriod ?? obj?.periodNumber ?? obj?.slot);
        const cls = normalizeText(obj?.class ?? obj?.Class ?? obj?.className ?? obj?.standard ?? obj?.grade);
        const subjRaw = obj?.isSubstitution
          ? (obj?.substituteSubject ?? obj?.subject ?? obj?.Subject ?? obj?.subjectName)
          : (obj?.subject ?? obj?.Subject ?? obj?.subjectName);
        const subj = normalizeText(subjRaw);
        return `${period}|${cls}|${subj}`;
      };

      const istNow = () => {
        try {
          return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        } catch {
          return new Date();
        }
      };

      const yesterdayIST = () => {
        const base = istNow();
        base.setDate(base.getDate() - 1);
        return base;
      };

      const formatIST = (d) => {
        try {
          return d.toLocaleString('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).split(',')[0];
        } catch {
          return todayIST();
        }
      };

      const addDaysIso = (iso, deltaDays) => {
        const d = new Date(`${iso}T00:00:00Z`);
        if (isNaN(d.getTime())) return iso;
        d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
        return d.toISOString().slice(0, 10);
      };

      const clampToYesterday = (iso) => {
        const y = formatIST(yesterdayIST());
        if (!iso) return y;
        return String(iso) > String(y) ? y : String(iso);
      };

      const getDatesInRangeDesc = (fromIso, toIso, maxDays) => {
        const out = [];
        const from = String(fromIso || '').trim();
        const to = String(toIso || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return out;
        if (from > to) return out;
        const max = Math.max(1, Number(maxDays || 1));
        let cur = to;
        for (let i = 0; i < max; i++) {
          out.push(cur);
          if (cur === from) break;
          cur = addDaysIso(cur, -1);
        }
        return out;
      };

      const isWeekendIST = (iso) => {
        try {
          const dayName = new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
          return dayName === 'Saturday' || dayName === 'Sunday';
        } catch {
          return false;
        }
      };

      // Initialize default range from HM settings (lookbackDays), ending at yesterday.
      // Only applies if the teacher has not manually changed the range.
      const maybeInitRange = () => {
        if (missingRangeTouched) return;
        const y = formatIST(yesterdayIST());
        const lookback = Math.max(1, Number(memoizedSettings?.missingDailyReports?.lookbackDays ?? 7) || 7);
        const from = addDaysIso(y, -(lookback - 1));
        const nextRange = { from, to: y };

        // Avoid unnecessary state churn
        if (missingRange.from !== nextRange.from || missingRange.to !== nextRange.to) {
          setMissingRange(nextRange);
          setMissingRangeDraft(nextRange);
        }
      };

      const run = async () => {
        maybeInitRange();

        const maxRangeDays = Math.max(1, Number(memoizedSettings?.missingDailyReports?.maxRangeDays ?? 31) || 31);
        const from = String(missingRange.from || '').trim();
        const to = clampToYesterday(String(missingRange.to || '').trim());
        if (!from || !to) return;

        const dates = getDatesInRangeDesc(from, to, maxRangeDays).filter(d => !isWeekendIST(d));
        setPendingReportsSummary(prev => ({
          ...prev,
          loading: true,
          date: to,
          range: { from, to }
        }));

        try {
          const results = await Promise.all(
            dates.map(async (date) => {
              try {
                const daily = await api.getTeacherDailyData(currentUser.email, date);
                const timetableRes = daily?.timetableWithReports || daily?.timetable || daily?.timetableData || daily?.timetableRes || daily;
                const periods = normalizePeriods(timetableRes);
                const reports = Array.isArray(daily?.reports) ? daily.reports : [];

                const submitted = new Set(
                  reports
                    .map(r => buildKey(r))
                    .filter(k => String(k).split('|').every(part => String(part || '').trim()))
                );

                const teachPeriods = (Array.isArray(periods) ? periods : [])
                  .filter(p => {
                    const k = buildKey(p);
                    const parts = String(k).split('|');
                    if (parts.length !== 3) return false;
                    const [pp, cc, ss] = parts;
                    if (!String(pp || '').trim() || !String(cc || '').trim() || !String(ss || '').trim()) return false;
                    // ignore obvious free periods
                    if (ss === 'free' || ss === 'no class' || ss === 'noclass') return false;
                    return true;
                  })
                  .map(p => ({
                    date,
                    period: p?.period ?? p?.Period ?? p?.periodNumber ?? p?.slot ?? '',
                    class: p?.class ?? p?.Class ?? p?.className ?? '',
                    subject: p?.isSubstitution ? (p?.substituteSubject ?? p?.subject ?? p?.Subject ?? '') : (p?.subject ?? p?.Subject ?? ''),
                    isSubstitution: !!p?.isSubstitution
                  }));

                const missing = teachPeriods.filter(p => !submitted.has(buildKey(p)));
                return { date, missing };
              } catch {
                return { date, missing: [] };
              }
            })
          );

          const allMissing = results
            .flatMap(r => Array.isArray(r?.missing) ? r.missing : [])
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(a.period || 0) - Number(b.period || 0)));

          const totalMissing = allMissing.length;
          const missingDays = new Set(allMissing.map(m => String(m?.date || '').trim()).filter(Boolean)).size;

          if (cancelled) return;

          setPendingReportsSummary({
            loading: false,
            date: to,
            count: totalMissing,
            pending: allMissing,
            missingDays,
            range: { from, to }
          });

          setInsights(prev => ({
            ...prev,
            pendingReports: totalMissing
          }));
        } catch (_e) {
          if (cancelled) return;
          setPendingReportsSummary(prev => ({ ...prev, loading: false, count: 0, pending: [], missingDays: 0 }));
          setInsights(prev => ({ ...prev, pendingReports: 0 }));
        }
      };

      run();
      return () => { cancelled = true; };
    }, [
      currentUser?.email,
      Array.isArray(currentUser?.roles) ? currentUser.roles.join('|') : String(currentUser?.roles || ''),
      missingRange.from,
      missingRange.to,
      memoizedSettings?.missingDailyReports?.lookbackDays,
      memoizedSettings?.missingDailyReports?.maxRangeDays
    ]);

    // Live period data: fetch today's timetable (lightweight) and recompute periodically.
    useEffect(() => {
      if (!currentUser?.email) return;
      if (!hasAnyRole(['teacher', 'class teacher', 'daily reporting teachers'])) return;
      if (hasAnyRole(['h m', 'super admin', 'superadmin', 'super_admin'])) return;

      let cancelled = false;

      const normalizeDailyTimetable = (timetableRes) => {
        if (Array.isArray(timetableRes)) return timetableRes;
        if (Array.isArray(timetableRes?.periods)) return timetableRes.periods;
        if (Array.isArray(timetableRes?.data)) return timetableRes.data;
        return [];
      };

      const load = async () => {
        try {
          setLiveTimetableState(prev => ({ ...prev, loading: true, error: null }));
          const date = todayIST();
          const timetableRes = await api.getTeacherDailyTimetable(currentUser.email, date);
          const periods = normalizeDailyTimetable(timetableRes);
          if (cancelled) return;
          setLiveTimetableState({ loading: false, periods: Array.isArray(periods) ? periods : [], error: null });
        } catch (e) {
          if (cancelled) return;
          setLiveTimetableState({ loading: false, periods: [], error: String(e?.message || e || 'Failed to load timetable') });
        }
      };

      load();

      const t = setInterval(() => setNowTick(Date.now()), 30_000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }, [
      currentUser?.email,
      Array.isArray(currentUser?.roles) ? currentUser.roles.join('|') : String(currentUser?.roles || '')
    ]);

    const livePeriodInfo = useMemo(() => {
      const periods = Array.isArray(liveTimetableState?.periods) ? liveTimetableState.periods : [];
      
      if (periods.length === 0) return { status: 'empty', period: null, timeLabel: '' };

      const toIstDate = (d) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const nowIst = toIstDate(new Date());
      const nowMinutes = (nowIst.getHours() * 60) + nowIst.getMinutes();

      const isFridayIst = nowIst.getDay() === 5;

      let selectedPeriodTimes = null;
      if (isFridayIst && memoizedSettings?.periodTimesFriday && Array.isArray(memoizedSettings.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
        selectedPeriodTimes = memoizedSettings.periodTimesFriday;
      } else if (memoizedSettings?.periodTimesWeekday && Array.isArray(memoizedSettings.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
        selectedPeriodTimes = memoizedSettings.periodTimesWeekday;
      } else if (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length) {
        selectedPeriodTimes = memoizedSettings.periodTimes;
      }

      const parseTimeToMinutes = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const s = raw.replace(/\./g, ':').replace(/\s+/g, ' ').trim();
        const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
        if (!m) return null;
        let hh = Number(m[1]);
        const mm = Number(m[2] ?? '0');
        const ap = (m[3] ?? '').toLowerCase();
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
        if (mm < 0 || mm > 59) return null;
        if (ap) {
          if (hh === 12) hh = 0;
          if (ap === 'pm') hh += 12;
        }
        if (hh < 0 || hh > 23) return null;
        return (hh * 60) + mm;
      };

      const normalized = periods.map(p => ({
        period: p?.period ?? p?.Period ?? p?.periodNumber ?? p?.slot ?? p?.slotNumber ?? p?.index,
        class: p?.class ?? p?.Class ?? p?.className ?? p?.standard ?? p?.grade ?? p?.Grade ?? p?.Standard,
        subject: p?.subject ?? p?.Subject ?? p?.subjectName ?? p?.subj ?? p?.course ?? p?.topic ?? p?.Topic,
        startTime: p?.startTime ?? p?.begin ?? p?.StartTime ?? '',
        endTime: p?.endTime ?? p?.finish ?? p?.EndTime ?? '',
        chapterName: p?.chapterName ?? '',
        sessionNumber: p?.sessionNumber ?? '',
        _raw: p
      }));

      // Prefer period time ranges from Settings.
      if (selectedPeriodTimes) {
        const ranges = selectedPeriodTimes
          .map(p => {
            if (!p || (!p.start && !p.end)) return null;
            const start = parseTimeToMinutes(p.start);
            const end = parseTimeToMinutes(p.end);
            if (start == null || end == null) return null;
            return { period: p.period, start, end };
          })
          .filter(Boolean);

        const current = ranges.find(r => nowMinutes >= r.start && nowMinutes < r.end);
        
        if (current) {
          // Match period by converting both to integers for comparison
          const currentPeriodNum = parseInt(String(current.period ?? '').trim());
          const match = normalized.find(x => {
            const xPeriodNum = parseInt(String(x.period ?? '').trim());
            return !isNaN(xPeriodNum) && !isNaN(currentPeriodNum) && xPeriodNum === currentPeriodNum;
          }) || null;
          
          return {
            status: 'live',
            period: match || { period: current.period, class: '', subject: '', startTime: '', endTime: '', _raw: null },
            timeLabel: periodToTimeString(current.period, selectedPeriodTimes)
          };
        }
        return { status: 'none', period: null, timeLabel: '' };
      }

      // Fallback: use timetable-provided start/end (if settings are missing).
      for (const p of normalized) {
        const start = parseTimeToMinutes(p.startTime);
        const end = parseTimeToMinutes(p.endTime);
        if (start == null || end == null) continue;
        if (nowMinutes >= start && nowMinutes < end) {
          const label = (String(p.startTime || '').trim() || String(p.endTime || '').trim())
            ? `${String(p.startTime || '').trim() || '—'} - ${String(p.endTime || '').trim() || '—'}`
            : '';
          return { status: 'live', period: p, timeLabel: label };
        }
      }
      return { status: 'none', period: null, timeLabel: '' };
    }, [liveTimetableState?.periods, nowTick, memoizedSettings?.periodTimes, memoizedSettings?.periodTimesWeekday, memoizedSettings?.periodTimesFriday]);

    return (
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Send Notification Button - HM Only */}
            {user && hasRole('h m') && (
              <button 
                onClick={() => setShowSendNotification(true)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                title="Send Notification"
              >
                📢 Send Notice
              </button>
            )}
          </div>
        </div>

  {/* Check Super Admin FIRST - highest priority */}
  {user?.roles && (user.roles.includes('super admin') || user.roles.includes('superadmin') || user.roles.includes('super_admin')) ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
              <SuperAdminDashboard user={user} onNavigate={setActiveView} />
            </Suspense>
          </div>
    ) : user && hasRole('h m') ? (
      <HMDashboardView insights={insights} />
    ) : user && hasAnyRole(['teacher','class teacher','daily reporting teachers']) ? (
      <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Insights</h3>
                  {dashboardLoading && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading
                    </span>
                  )}
                </div>
                <div className={`grid grid-cols-2 ${hasRole('class teacher') ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3 md:gap-4`}>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <School className="w-4 h-4 text-blue-600" /> Classes
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{insights.classCount}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Teaching classes</div>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <Book className="w-4 h-4 text-green-600" /> Subjects
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{insights.subjectCount}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Subjects assigned</div>
                  </div>

                  <div
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    onClick={() => setMissingReportsExpanded(v => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMissingReportsExpanded(v => !v); }}
                    aria-expanded={missingReportsExpanded ? 'true' : 'false'}
                    title={missingReportsExpanded ? 'Hide missing reports' : 'Show missing reports'}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <FileText className="w-4 h-4 text-purple-600" /> Missing Reports
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {pendingReportsSummary.loading ? '—' : insights.pendingReports}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {pendingReportsSummary.loading
                        ? 'Checking till yesterday…'
                        : (insights.pendingReports > 0
                          ? `Range ${pendingReportsSummary?.range?.from || '-'} → ${pendingReportsSummary?.range?.to || pendingReportsSummary.date}`
                          : `No missing reports up to ${pendingReportsSummary.date}`)}
                    </div>
                    {!pendingReportsSummary.loading && pendingReportsSummary.missingDays > Number(memoizedSettings?.missingDailyReports?.escalationDays ?? 2) && (
                      <div className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">
                        Meet the HM
                      </div>
                    )}
                    {!pendingReportsSummary.loading && insights.pendingReports > 0 && Array.isArray(pendingReportsSummary.pending) && pendingReportsSummary.pending.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {pendingReportsSummary.pending.slice(0, 3).map((p, idx) => (
                          <div key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                            {String(p.date || '').trim() || '-'} · P{String(p.period || '').trim() || '-'} · {stripStdPrefix(String(p.class || '').trim() || '—')} · {String(p.subject || '').trim() || '—'}
                          </div>
                        ))}
                        {pendingReportsSummary.pending.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{pendingReportsSummary.pending.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveView('reports'); }}
                      className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      type="button"
                    >
                      Open Daily Reports
                    </button>
                  </div>

                  {hasRole('class teacher') && (
                    <>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                          <Award className="w-4 h-4 text-emerald-600" /> Above Avg
                        </div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{insights.studentsAboveAverage}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {Number.isFinite(insights?.assignedClassPerformance?.aboveAveragePct)
                            ? `${insights.assignedClassPerformance.aboveAveragePct}% of class`
                            : 'Performing well'}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                          <AlertCircle className="w-4 h-4 text-amber-600" /> Need Focus
                        </div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{insights.studentsNeedFocus}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Require attention</div>
                      </div>
                    </>
                  )}
                </div>

                {missingReportsExpanded && (
                  <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/10">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Missing Daily Reports
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          ({pendingReportsSummary?.range?.from || '-'} → {pendingReportsSummary?.range?.to || pendingReportsSummary.date})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const rows = Array.isArray(pendingReportsSummary?.pending) ? pendingReportsSummary.pending : [];
                              const header = ['date','period','class','subject'];
                              const csv = [header.join(',')]
                                .concat(rows.map(r => {
                                  const vals = [r?.date, r?.period, r?.class, r?.subject].map(v => {
                                    const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
                                    const escaped = s.replace(/"/g, '""');
                                    return `"${escaped}"`;
                                  });
                                  return vals.join(',');
                                }))
                                .join('\n');
                              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `missing-daily-reports_${pendingReportsSummary?.range?.from || 'from'}_${pendingReportsSummary?.range?.to || 'to'}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch (_err) {
                              // ignore download failures
                            }
                          }}
                          className="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                        >
                          Download CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => setMissingReportsExpanded(false)}
                          className="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                        >
                          Hide
                        </button>
                      </div>
                    </div>

                    {!pendingReportsSummary.loading && (
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Missing days: <span className="font-semibold">{pendingReportsSummary.missingDays}</span>
                          {' · '}
                          Escalation threshold: <span className="font-semibold">{Number(memoizedSettings?.missingDailyReports?.escalationDays ?? 2)}</span>
                        </div>

                        {pendingReportsSummary.missingDays > Number(memoizedSettings?.missingDailyReports?.escalationDays ?? 2) && (
                          <div className="text-xs font-semibold text-red-700 dark:text-red-300">
                            Meet the HM
                          </div>
                        )}

                        {memoizedSettings?.missingDailyReports?.allowCustomRange !== false && (
                          <div className="flex items-center gap-2 text-xs">
                            <label className="text-gray-600 dark:text-gray-300">
                              From
                              <input
                                type="date"
                                value={missingRangeDraft.from || ''}
                                onChange={(e) => {
                                  setMissingRangeTouched(true);
                                  setMissingRangeDraft(prev => ({ ...prev, from: e.target.value }));
                                }}
                                className="ml-2 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                            </label>
                            <label className="text-gray-600 dark:text-gray-300">
                              To
                              <input
                                type="date"
                                value={missingRangeDraft.to || ''}
                                onChange={(e) => {
                                  setMissingRangeTouched(true);
                                  setMissingRangeDraft(prev => ({ ...prev, to: e.target.value }));
                                }}
                                className="ml-2 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setMissingRangeTouched(true);
                                setMissingRange({
                                  from: String(missingRangeDraft.from || '').trim(),
                                  to: String(missingRangeDraft.to || '').trim()
                                });
                              }}
                              className="px-2 py-1 rounded bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {pendingReportsSummary.loading ? (
                      <div className="p-3 text-sm text-gray-600 dark:text-gray-300">Loading…</div>
                    ) : (!Array.isArray(pendingReportsSummary.pending) || pendingReportsSummary.pending.length === 0) ? (
                      <div className="p-3 text-sm text-gray-600 dark:text-gray-300">No missing reports found.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200">
                            <tr>
                              <th className="text-left font-medium px-3 py-2">Date</th>
                              <th className="text-left font-medium px-3 py-2">Period</th>
                              <th className="text-left font-medium px-3 py-2">Class</th>
                              <th className="text-left font-medium px-3 py-2">Subject</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingReportsSummary.pending.map((p, idx) => (
                              <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{String(p.date || '').trim() || '—'}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{String(p.period || '').trim() ? `P${String(p.period || '').trim()}` : '—'}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{stripStdPrefix(String(p.class || '').trim() || '—')}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{String(p.subject || '').trim() || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Live Period</h3>
                {liveTimetableState.loading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading timetable...
                  </div>
                ) : liveTimetableState.error ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Unable to load live period.
                  </div>
                ) : livePeriodInfo.status === 'live' && livePeriodInfo.period ? (
                  <div
                    className={`space-y-2 rounded-lg p-3 md:p-4 ${
                      livePeriodInfo?.period?.isSubstitution
                        ? 'ring-2 ring-blue-400/60 dark:ring-blue-500/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                        : ''
                    }`}
                  >
                    <div className="text-sm text-gray-600 dark:text-gray-300">Now teaching</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Period {String(livePeriodInfo.period.period ?? '').trim() || '-'}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      {stripStdPrefix(String(livePeriodInfo.period.class ?? '').trim() || '—')} · {String(livePeriodInfo.period.subject ?? '').trim() || '—'}
                    </div>
                    {livePeriodInfo.period.chapterName && (
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        📖 {livePeriodInfo.period.chapterName}
                        {livePeriodInfo.period.sessionNumber && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
                            Session {livePeriodInfo.period.sessionNumber}
                          </span>
                        )}
                      </div>
                    )}
                    {String(livePeriodInfo.timeLabel || '').trim() && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {String(livePeriodInfo.timeLabel || '').trim()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-300">No live period right now</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Based on today’s timetable.
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Lesson plan warning (next 2 days) */}
            {!hasAnyRole(['h m', 'super admin', 'superadmin', 'super_admin']) && missingPlansSummary.count > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 rounded-xl p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                      Lesson plans pending
                    </div>
                    <div className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      You have {missingPlansSummary.count} period{missingPlansSummary.count === 1 ? '' : 's'} without lesson plans (today + tomorrow).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('lessonplans');
                      const params = new URLSearchParams(window.location.search);
                      params.set('tab', 'draft');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    className="px-3 py-2 text-sm bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                  >
                    Open Lesson Plans
                  </button>
                </div>
              </div>
            )}
            
            {/* Detailed Teaching Assignment - Shows specific classes and subjects */}
            {(insights.teachingClasses.length > 0 || insights.teachingSubjects.length > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Teaching Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {insights.teachingClasses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Classes</p>
                      <div className="flex flex-wrap gap-2">
                        {insights.teachingClasses.map((cls, idx) => {
                          const studentCount = insights.classStudentCounts[cls];
                          return (
                            <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                              <span>{stripStdPrefix(cls)}</span>
                              {studentCount !== undefined && (
                                <span className="px-2 py-0.5 bg-blue-100 rounded-full text-xs">
                                  {studentCount} {studentCount === 1 ? 'student' : 'students'}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {insights.teachingSubjects.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {insights.teachingSubjects.map((subject, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                            {subjectDisplayName(subject)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Class-wise Performance Breakdown - Only for class teachers */}
            {hasRole('class teacher') && insights.classPerformance && Object.keys(insights.classPerformance).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Class-wise Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {Object.entries(insights.classPerformance).map(([normKey, perf]) => (
                    <div key={normKey} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 md:p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{stripStdPrefix(perf.displayName || normKey)}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Class Average:</span>
                          <span className="text-sm font-semibold text-blue-600">{Number(perf.studentsWithMarks || 0) === 0 ? '-' : `${perf.avgPercentage}%`}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Students:</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{perf.totalStudents}</span>
                        </div>
                        {perf.studentsWithMarks !== undefined && perf.studentsWithMarks !== perf.totalStudents && (
                          <div className="flex justify-between items-center text-amber-600">
                            <span className="text-xs">Students with marks:</span>
                            <span className="text-xs font-semibold">{perf.studentsWithMarks}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <Award className="w-3 h-3" /> Above Average
                            </span>
                            <span className="text-sm font-bold text-emerald-600">{perf.aboveAverage} <span className="text-xs text-gray-500">({perf.aboveAveragePct || Math.round(((perf.aboveAverage || 0) / (perf.totalStudents || 1)) * 100)}%)</span></span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Need Focus
                            </span>
                            <span className="text-sm font-bold text-amber-600">{perf.needFocus} <span className="text-xs text-gray-500">({perf.needFocusPct || Math.round(((perf.needFocus || 0) / (perf.totalStudents || 1)) * 100)}%)</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Welcome, {user?.name}</h2>
            <p className="text-gray-600 dark:text-gray-400">Use the navigation menu to access your school workflow tools.</p>
          </div>
        )}
      </div>
    );
  };

  const handleManualLoginSuccess = (data) => {
    // Normalize roles to array
    const roles = Array.isArray(data.roles) ? data.roles : (data.roles ? String(data.roles).split(',').map(s=>s.trim()).filter(Boolean) : []);
    const merged = { ...data, roles };
    setLocalUser(merged);
    setUser(merged);
    try {
      localStorage.setItem('user', JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to persist user session', e);
    }
  };

  const handleLogout = () => {
    if (googleAuth?.user) googleAuth.logout();
    setLocalUser(null);
    setUser(null);
    try {
      localStorage.removeItem('user');
    } catch (e) {
      console.warn('Failed to clear user session', e);
    }
    // Clear all cached data on logout
    api.invalidateCache.onLogout();
  };

  // Keep root user state in sync when googleAuth.user changes (first login or restore)
  useEffect(() => {
    if (googleAuth?.user) {
      const gu = googleAuth.user;
      const roles = Array.isArray(gu.roles) ? gu.roles : (gu.roles ? String(gu.roles).split(',').map(s=>s.trim()).filter(Boolean) : []);
      setUser(prev => {
        if (!prev || prev.email !== gu.email) {
          return { ...gu, roles };
        }
        return prev;
      });
      // Clear loading state explicitly
      setLoading(false);
    }
  }, [googleAuth?.user?.email]);

  // Sidebar component
  const Sidebar = () => {
    const navigationItems = getNavigationItems();
    
    // Debug: Log navigation items
    if (navigationItems.length === 0) {
      console.error('[Sidebar Debug] No navigation items:', {
        user: user?.email,
        userRoles: user?.roles,
        effectiveUser: effectiveUser?.email,
        effectiveUserRoles: effectiveUser?.roles,
        googleAuthUser: googleAuth?.user?.email,
        localUser: localUser?.email
      });
    }

    return (
      <>
        {/* Drawer sidebar (auto-hidden by default; works on all screen sizes) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-[60]">
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity z-[65]"
              onClick={() => {
                if (Date.now() - sidebarOpenedAt < 300) return;
                setSidebarOpen(false);
              }}
            />
            <div
              className="fixed inset-y-0 left-0 flex flex-col w-72 max-w-[85vw] bg-white dark:bg-gray-800 z-[70] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <School className="h-7 w-7 text-blue-600" />
                  <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">SchoolFlow</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3">
                <nav className="px-2 space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveView(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`${
                          activeView === item.id
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white'
                        } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left transition-colors duration-200`}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // Header component
  const Header = () => {
    return (
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center">
          <button
            onClick={() => { setSidebarOpen(true); setSidebarOpenedAt(Date.now()); }}
            className="mr-3 p-2 rounded-md transition-colors duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold capitalize text-gray-900 dark:text-white">
            {activeView.replace('-', ' ')}
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <button className="p-2 transition-colors duration-200 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300">
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-2 hidden md:block text-gray-700 dark:text-gray-300">
              <div className="text-sm font-medium">{user?.name}</div>
              {user?.roles && user.roles.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {user.roles.join(', ')}
                </div>
              )}
              {googleAuth?.user ? (
                <div className="text-xs text-blue-600 dark:text-blue-400">Google Login</div>
              ) : (
                <div className="text-xs text-green-600 dark:text-green-400">Password Login</div>
              )}
            </div>
            <button
              onClick={logout}
              className="ml-4 text-sm flex items-center transition-colors duration-200 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Main content router
  const renderContent = () => {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        <AnimatedPage transitionKey={activeView}>
          {(() => {
            switch (activeView) {
              case 'dashboard':
                return (
                  <Dashboard
                    showSendNotification={showSendNotification}
                    setShowSendNotification={setShowSendNotification}
                    notificationData={notificationData}
                    setNotificationData={setNotificationData}
                  />
                );
              case 'schemes':
                return <SchemesView />;
              case 'lessonplans':
                const lpTab = new URLSearchParams(window.location.search).get('tab');
                return (
                  <LessonPlansManager 
                    user={user}
                    SchemeLessonPlanning={SchemeLessonPlanning}
                    LessonPlansView={LessonPlansView}
                    onNavigate={(view) => setActiveView(view)}
                  />
                );
              case 'lesson-plans':
                // Redirect to unified lessonplans with submitted tab
                setTimeout(() => setActiveView('lessonplans'), 0);
                if (typeof window !== 'undefined') {
                  const params = new URLSearchParams(window.location.search);
                  params.set('tab', 'submitted');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }
                return <LessonPlansView />;
              case 'scheme-lesson-planning':
                // Redirect to unified lessonplans with draft tab
                setTimeout(() => setActiveView('lessonplans'), 0);
                if (typeof window !== 'undefined') {
                  const params = new URLSearchParams(window.location.search);
                  params.set('tab', 'draft');
                  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                }
                return <SchemeLessonPlanning userEmail={user?.email} userName={user?.name} />;
              case 'session-tracking':
                return <SessionCompletionTracker user={user} />;
              case 'timetable':
                return <TimetableView />;
              case 'my-substitutions':
                return <MySubstitutionsView user={user} periodTimes={memoizedSettings.periodTimes} />;
              case 'reports':
                // Render reporting directly to avoid remounts on parent re-renders
                return (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Reports</h1>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Complete your daily reports based on your timetable
                      </div>
                    </div>
                    <div className="bg-transparent">
                      <DailyReportModern user={memoizedUser} settings={memoizedSettings} />
                    </div>
                  </div>
                );
              case 'hm-dashboard':
                return <HMDashboardView />;
              case 'day-timetable':
                return <DayTimetableView periodTimes={memoizedSettings.periodTimes} />;
              case 'scheme-approvals':
                return <SchemeApprovalsViewWrapper />;
              case 'lesson-approvals':
                return <LessonApprovalsView />;
              case 'my-daily-reports':
                return <MyDailyReportsView />;
              case 'daily-oversight':
                return <HMDailyOversight user={user} />;
              
              case 'substitutions':
                return <EnhancedSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
              case 'substitution-analytics':
                return <SubstitutionAnalyticsView user={user} />;
              case 'missing-daily-reports':
                return <MissingDailyReportsTeacherwiseView user={user} />;
              case 'full-timetable':
                return <FullTimetableView />;
              case 'users':
                return <UserManagement user={user} />;
              case 'audit-log':
                return <AuditLog user={user} />;
              
              // New unified assessments module
              case 'assessments':
                return <AssessmentsManager user={user} withSubmit={withSubmit} />;
              
              // Old routes - redirect to unified module with appropriate tab
              case 'exam-marks':
                // Auto-redirect to assessments with marks-entry tab
                setTimeout(() => setActiveView('assessments'), 0);
                return <AssessmentsManager user={user} withSubmit={withSubmit} />;
              case 'report-card':
                // Auto-redirect to assessments with reports tab
                setTimeout(() => {
                  setActiveView('assessments');
                  const url = new URL(window.location);
                  url.searchParams.set('tab', 'reports');
                  window.history.pushState({}, '', url);
                }, 0);
                return <AssessmentsManager user={user} withSubmit={withSubmit} />;
              case 'marklist':
                // Auto-redirect to assessments with marklists tab
                setTimeout(() => {
                  setActiveView('assessments');
                  const url = new URL(window.location);
                  url.searchParams.set('tab', 'marklists');
                  window.history.pushState({}, '', url);
                }, 0);
                return <AssessmentsManager user={user} withSubmit={withSubmit} />;
              case 'class-data':
                return <ClassDataView />;
              case 'admin-data':
                return <AdminDataEditor user={user} />;
              case 'class-students':
                return <ClassStudentsView />;
              case 'daily-reports-management':
                return <DailyReportsManagementView />;
              case 'class-period-timetable':
                return <ClassPeriodSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
              case 'fee-collection':
                return <ModernFeeCollection user={user} apiBaseUrl={api.getBaseUrl()} />;
              default:
                return <Dashboard />;
            }
          })()}
        </AnimatedPage>
      </Suspense>
    );
  };

  // Schemes of Work View
  const SchemesView = () => {
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingScheme, setEditingScheme] = useState(null);
    const [deletingScheme, setDeletingScheme] = useState(null);
    const [formData, setFormData] = useState({
      class: '',
      subject: '',
      term: '',
      unit: '',
      chapter: '',
      month: '',
      noOfSessions: ''
    });
    const [planningHelper, setPlanningHelper] = useState(null);
    const [loadingHelper, setLoadingHelper] = useState(false);
    
    // Filter states for submitted schemes
    const [schemeFilters, setSchemeFilters] = useState({
      class: 'all',
      term: 'all'
    });
    
    // Filtered schemes based on selected filters
    const filteredSchemes = useMemo(() => {
      return schemes.filter(scheme => {
        const classMatch = schemeFilters.class === 'all' || scheme.class === schemeFilters.class;
        const termMatch = schemeFilters.term === 'all' || scheme.term === schemeFilters.term;
        return classMatch && termMatch;
      });
    }, [schemes, schemeFilters]);
    
    // Get unique classes and terms from schemes
    const availableClasses = useMemo(() => {
      return [...new Set(schemes.map(s => s.class))].filter(Boolean).sort();
    }, [schemes]);
    
    const availableTerms = useMemo(() => {
      return [...new Set(schemes.map(s => s.term))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    }, [schemes]);

    // Handle delete scheme
    const handleDeleteScheme = async (scheme) => {
      if (!window.confirm(`Delete scheme "${scheme.chapter}"? This cannot be undone.`)) {
        return;
      }

      setDeletingScheme(scheme.schemeId);
      try {
        const result = await api.deleteScheme(scheme.schemeId, user.email);
        if (result.success) {
          success('Deleted', 'Scheme deleted successfully');
          // Refresh the list
          const list = await api.getTeacherSchemes(user.email);
          const sorted = Array.isArray(list) ? list.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          }) : [];
          setSchemes(sorted);
        } else {
          error('Delete Failed', result.error || 'Failed to delete scheme');
        }
      } catch (err) {
        console.error('Failed to delete scheme:', err);
        error('Delete Failed', err.message || 'Failed to delete scheme');
      } finally {
        setDeletingScheme(null);
      }
    };

    // Handle edit scheme - open form with existing data
    const handleEditScheme = (scheme) => {
      setEditingScheme(scheme);
      setFormData({
        class: scheme.class || '',
        subject: scheme.subject || '',
        term: scheme.term || '',
        unit: scheme.unit || '',
        chapter: scheme.chapter || '',
        month: scheme.month || '',
        noOfSessions: scheme.noOfSessions || ''
      });
      setShowForm(true);
    };

    // Cancel edit
    const cancelEdit = () => {
      setEditingScheme(null);
      setShowForm(false);
      setFormData({
        class: '',
        subject: '',
        term: '',
        unit: '',
        chapter: '',
        month: '',
        noOfSessions: ''
      });
    };

    // Load planning helper when class, subject, and term are selected
    useEffect(() => {
      const loadPlanningHelper = async () => {
        if (formData.class && formData.subject && formData.term && user?.email) {
          try {
            setLoadingHelper(true);
            const termStr = `Term ${formData.term}`;
            const response = await api.getSchemeSubmissionHelper(
              user.email,
              formData.class,
              formData.subject,
              termStr
            );
            const data = response.data || response;
            if (data.success) {
              setPlanningHelper(data);
            } else {
              console.log('Planning helper not available:', data.error);
              setPlanningHelper(null);
            }
          } catch (err) {
            console.error('Error loading planning helper:', err);
            setPlanningHelper(null);
          } finally {
            setLoadingHelper(false);
          }
        } else {
          setPlanningHelper(null);
        }
      };
      loadPlanningHelper();
    }, [formData.class, formData.subject, formData.term, user?.email]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!user) return;
      
      let shouldCloseForm = true;

      try {
        setSubmitting({ active: true, message: editingScheme ? 'Updating scheme...' : 'Submitting scheme...' });
        
        // Submit the scheme with timetable validation
        const schemeData = {
          teacherName: user.name || '',
          class: stripStdPrefix(formData.class),
          subject: formData.subject,
          term: formData.term,
          unit: formData.unit,
          chapter: formData.chapter,
          month: formData.month,
          noOfSessions: formData.noOfSessions
        };
        
        let result;
        
        if (editingScheme) {
          // Update existing scheme
          const response = await api.updateScheme(editingScheme.schemeId, user.email, schemeData);
          result = response?.data || response;
          if (result?.success) {
            success('Updated', 'Scheme updated successfully');
          } else {
            throw new Error(result?.error || 'Update failed');
          }
        } else {
          // Submit new scheme
          const response = await api.submitPlan(user.email, schemeData);
          result = response?.data || response; // Unwrap {status,data,timestamp}
        }
        
        // Check if validation failed (only for new submissions)
        if (!editingScheme && result && !result.ok && result.error === 'Session count mismatch') {
          const validation = result.validation;
          
          let confirmMessage = `${validation.message}\n\n`;
          
          if (validation.timetableDetails && validation.timetableDetails.length > 0) {
            confirmMessage += `Your allocated periods:\n`;
            confirmMessage += validation.timetableDetails.map(d => `• ${d.day} Period ${d.period}`).join('\n');
            confirmMessage += `\n\n`;
          }
          
          confirmMessage += `You requested ${validation.requestedSessions} sessions but have ${validation.actualPeriodsPerWeek} periods allocated.\n\n`;
          
          if (validation.noTimetableFound) {
            confirmMessage += `No timetable found for ${formData.class} ${formData.subject}.\nPlease contact administration to verify timetable setup.\n\n`;
            confirmMessage += `Click OK to submit anyway, or Cancel to review.`;
          } else {
            confirmMessage += `Options:\n`;
            confirmMessage += `• Click OK to change sessions to ${validation.suggestion} (recommended)\n`;
            confirmMessage += `• Click Cancel to submit anyway (requires HM approval)`;
          }
          
          const userChoice = confirm(confirmMessage);
          
          if (userChoice && !validation.noTimetableFound) {
            // Update form with recommended sessions
            setFormData(prev => ({
              ...prev,
              noOfSessions: validation.suggestion
            }));
            info('Timetable Adjustment', `Sessions updated to ${validation.suggestion} to match your timetable.`);
            shouldCloseForm = false;
            return;
          } else if (!userChoice || validation.noTimetableFound) {
            // Force submit with override
            const overrideData = {
              ...schemeData,
              forceSubmit: true,
              validationWarning: validation.message
            };
            
            const overrideResponse = await api.submitPlan(user.email, overrideData);
            const overrideResult = overrideResponse?.data || overrideResponse;
            if (!overrideResult?.ok) {
              throw new Error(overrideResult?.error || 'Override submission failed');
            }
            warning('Override Required', 'Scheme submitted with timetable override. HM review required.');
          }
        } else if (result?.ok) {
          // Success - normal submission
          const message = result.validation?.message || 'Scheme submitted successfully!';
          success('Scheme Submitted', message);
        } else {
          // Other error
          throw new Error(result?.error || 'Submission failed');
        }
        
        // Refresh schemes list
        const list = await api.getTeacherSchemes(user.email);
        const sorted = Array.isArray(list) ? list.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        }) : [];
        setSchemes(sorted);
        
      } catch (err) {
        console.error('Failed to submit scheme:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          response: err.response
        });
        error('Submission Failed', `Failed to submit scheme: ${err.message}`);
      } finally {
        setSubmitting({ active: false, message: '' });
        if (shouldCloseForm) {
          setEditingScheme(null);
          setShowForm(false);
          setFormData({
            class: '',
            subject: '',
            term: '',
            unit: '',
            chapter: '',
            month: '',
            noOfSessions: ''
          });
        }
      }
    };

    // Load all schemes for this teacher from the API on mount.  We use
    // getTeacherSchemes() so teachers can see the status of previously
    // submitted schemes (Pending, Approved, Rejected).
    useEffect(() => {
      async function fetchSchemes() {
        try {
          if (!user) return;
          setLoading(true);
          const list = await api.getTeacherSchemes(user.email);
          // Sort by createdAt descending (latest first)
          const sorted = Array.isArray(list) ? list.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA; // Descending order
          }) : [];
          setSchemes(sorted);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      fetchSchemes();
    }, [user]);

    return (
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading schemes...</p>
          </div>
        ) : (
          <>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Schemes of Work</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Scheme
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editingScheme ? 'Edit Scheme of Work' : 'Submit New Scheme of Work'}</h2>
              <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Planning Assistant Panel */}
            {planningHelper && planningHelper.success && (
              <div className={`mb-6 p-4 rounded-lg border-2 ${
                planningHelper.feasibility.riskLevel === 'LOW' ? 'bg-green-50 border-green-300' :
                planningHelper.feasibility.riskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-300' :
                'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {planningHelper.feasibility.riskLevel === 'LOW' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : planningHelper.feasibility.riskLevel === 'MEDIUM' ? (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">📊 Planning Assistant</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Available Periods</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {planningHelper.timetableInfo.usablePeriods}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.timetableInfo.periodsPerWeek} per week
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Required Sessions</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {planningHelper.syllabusRequirement.minSessionsRequired}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.syllabusRequirement.totalChapters} chapters
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Capacity</div>
                        <div className={`text-2xl font-bold ${
                          planningHelper.feasibility.riskLevel === 'LOW' ? 'text-green-600' :
                          planningHelper.feasibility.riskLevel === 'MEDIUM' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {planningHelper.feasibility.capacityUtilization}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.feasibility.riskLevel} Risk
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-md mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">💡 Recommendation</div>
                      <div className="text-sm text-gray-600">{planningHelper.feasibility.recommendation}</div>
                    </div>
                    
                    {planningHelper.upcomingEvents && planningHelper.upcomingEvents.length > 0 && (
                      <div className="bg-white p-3 rounded-md mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">📅 Upcoming Events</div>
                        {planningHelper.upcomingEvents.map((event, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            • {event.name} ({event.date}) - {event.periodsLost} period(s) lost
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {planningHelper.warnings && planningHelper.warnings.length > 0 && (
                      <div className="bg-yellow-100 p-3 rounded-md">
                        <div className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important Notices</div>
                        {planningHelper.warnings.map((warning, idx) => (
                          <div key={idx} className="text-sm text-yellow-700">{warning}</div>
                        ))}
                      </div>
                    )}
                    
                    {planningHelper.syllabusRequirement.chapterDetails && planningHelper.syllabusRequirement.chapterDetails.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                          View Chapter Breakdown ({planningHelper.syllabusRequirement.totalChapters} chapters)
                        </summary>
                        <div className="mt-2 bg-white p-3 rounded-md max-h-48 overflow-y-auto">
                          {planningHelper.syllabusRequirement.chapterDetails.map((ch, idx) => (
                            <div key={idx} className="text-sm text-gray-600 py-1 border-b border-gray-100 last:border-0">
                              <span className="font-medium">Ch {ch.chapterNo}: {ch.chapterName}</span>
                              <span className="text-blue-600 ml-2">({ch.minSessions} sessions)</span>
                              {ch.topics && <div className="text-xs text-gray-500 mt-1">{ch.topics}</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {loadingHelper && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-blue-700">Loading planning context...</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mobile-stack">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({...formData, class: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Class</option>
                  {user?.classes?.map(cls => (
                    <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Subject</option>
                  {user?.subjects?.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={formData.term}
                  onChange={(e) => setFormData({...formData, term: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Term</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="number"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
                <input
                  type="text"
                  value={formData.chapter}
                  onChange={(e) => setFormData({...formData, chapter: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({...formData, month: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. of Sessions</label>
                <input
                  type="number"
                  value={formData.noOfSessions}
                  onChange={(e) => setFormData({...formData, noOfSessions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div className="md:col-span-2 flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit Scheme
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Submitted Schemes</h2>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="text-gray-600 dark:text-gray-400 whitespace-nowrap">Filter by:</label>
                <select
                  value={schemeFilters.class}
                  onChange={(e) => setSchemeFilters(prev => ({ ...prev, class: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Classes</option>
                  {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                    ))}
                </select>
                
                <select
                  value={schemeFilters.term}
                  onChange={(e) => setSchemeFilters(prev => ({ ...prev, term: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Terms</option>
                  {availableTerms.map(term => (
                    <option key={term} value={term}>Term {term}</option>
                  ))}
                </select>
                
                {(schemeFilters.class !== 'all' || schemeFilters.term !== 'all') && (
                  <button
                    onClick={() => setSchemeFilters({ class: 'all', term: 'all' })}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs underline"
                  >
                    Clear filters
                  </button>
                )}
                
                <span className="text-gray-500 dark:text-gray-400 text-xs">({filteredSchemes.length} of {schemes.length})</span>
              </div>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {filteredSchemes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {schemes.length === 0 ? 'No schemes submitted yet.' : 'No schemes match the selected filters.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSchemes.map((scheme) => (
                  <div key={scheme.schemeId || scheme.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{stripStdPrefix(scheme.class)} - {scheme.subject}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{scheme.chapter}</div>
                      </div>
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scheme.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        scheme.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        scheme.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {scheme.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Month:</span>
                        <span className="ml-1 text-gray-900 dark:text-gray-100">{scheme.month}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Sessions:</span>
                        <span className="ml-1 text-gray-900 dark:text-gray-100">{scheme.noOfSessions || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openLessonView(scheme)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                      {scheme.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleEditScheme(scheme)}
                            className="bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-200 px-3 py-2 rounded-lg"
                            title="Edit scheme"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteScheme(scheme)}
                            disabled={deletingScheme === scheme.schemeId}
                            className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
                            title="Delete scheme"
                          >
                            {deletingScheme === scheme.schemeId ? '...' : <Trash2 className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.schemeId || scheme.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(scheme.class)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.noOfSessions || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scheme.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        scheme.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        scheme.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {scheme.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <button type="button" className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3" onClick={() => openLessonView(scheme)} title="View scheme">
                        <Eye className="h-4 w-4" />
                      </button>
                      {scheme.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleEditScheme(scheme)}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 mr-3"
                            title="Edit scheme"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteScheme(scheme)}
                            disabled={deletingScheme === scheme.schemeId}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                            title="Delete scheme"
                          >
                            {deletingScheme === scheme.schemeId ? '...' : <Trash2 className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                      {schemes.length === 0 ? 'No schemes submitted yet.' : 'No schemes match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    );
  };

  // Lesson Plans View - Based on Timetable with Approved Schemes Dropdown
  const LessonPlansView = () => {
    const [loading, setLoading] = useState(true);
    const [lessonPlans, setLessonPlans] = useState([]);
    const [approvedSchemes, setApprovedSchemes] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showPreparationForm, setShowPreparationForm] = useState(false);
    const [deletingPlan, setDeletingPlan] = useState(null);
    const [preparationData, setPreparationData] = useState({
      schemeId: '',
      session: '1',
      objectives: '',
      activities: '',
      notes: ''
    });
    // Grouping toggles (mutually exclusive)
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [groupByClassChapter, setGroupByClassChapter] = useState(false);
    
    // Filter states for lesson plans
    const [lessonPlanFilters, setLessonPlanFilters] = useState({
      class: '',
      subject: '',
      status: '',
      chapter: ''
    });

    // Handle delete lesson plan
    const handleDeleteLessonPlan = async (plan) => {
      if (!window.confirm(`Delete lesson plan for "${plan.chapter}" Session ${plan.session}? This cannot be undone.`)) {
        return;
      }

      setDeletingPlan(plan.lpId);
      try {
        const result = await api.deleteLessonPlan(plan.lpId, user.email);
        if (result.success) {
          success('Deleted', 'Lesson plan deleted successfully');
          // Refresh the list
          const plans = await api.getTeacherLessonPlans(user.email);
          setLessonPlans(Array.isArray(plans) ? plans : []);
        } else {
          error('Delete Failed', result.error || 'Failed to delete lesson plan');
        }
      } catch (err) {
        console.error('Failed to delete lesson plan:', err);
        error('Delete Failed', err.message || 'Failed to delete lesson plan');
      } finally {
        setDeletingPlan(null);
      }
    };

    // App settings for lesson plan preparation (using parent memoizedSettings)
    // No planning restrictions - teachers can plan anytime

    // Fetch real timetable slots, lesson plans, approved schemes, and app settings from the API
    useEffect(() => {
      async function fetchData() {
        setLoading(true);
        try {
          if (!user) return;
          // Teacher lesson plans
          const plans = await api.getTeacherLessonPlans(user.email);
          setLessonPlans(Array.isArray(plans) ? plans : []);
          
          // Load data silently
          // Fetch all schemes submitted by this teacher and filter to approved
          try {
            // Use the teacher's own schemes (this was the original working approach)
            const teacherSchemes = await api.getTeacherSchemes(user.email);
            const approved = Array.isArray(teacherSchemes)
              ? teacherSchemes.filter(s => String(s.status || '').toLowerCase() === 'approved')
              : [];
            setApprovedSchemes(approved);
          } catch (err) {
            console.warn('Error loading approved schemes:', err);
            // Fall back to teacher's own schemes if getAllApprovedSchemes fails
            try {
              const teacherSchemes = await api.getTeacherSchemes(user.email);
              const approved = Array.isArray(teacherSchemes)
                ? teacherSchemes.filter(s => String(s.status || '').toLowerCase() === 'approved')
                : [];
              setApprovedSchemes(approved);
            } catch (innerErr) {
              console.warn('Error loading teacher schemes:', innerErr);
              setApprovedSchemes([]);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    }, [user]);

    // Helper to force-refresh lesson plans when status updates elsewhere (e.g., HM approvals)
    const refreshTeacherLessonPlans = useCallback(async () => {
      if (!user) return;
      try {
        api.clearCache('getTeacherLessonPlans');
        const fresh = await api.getTeacherLessonPlans(user.email);
        setLessonPlans(Array.isArray(fresh) ? fresh : []);
      } catch (e) {
        console.warn('Refresh lesson plans failed:', e);
      }
    }, [user]);

    // Listen for global lesson plan status update events
    useEffect(() => {
      const handler = (e) => {
        // Optionally inspect e.detail.lpId/e.detail.status
        refreshTeacherLessonPlans();
      };
      window.addEventListener('lesson-plan-status-updated', handler);
      return () => window.removeEventListener('lesson-plan-status-updated', handler);
    }, [refreshTeacherLessonPlans]);

    const handlePrepareLesson = (slot) => {
      // Find existing lesson plan for this class, subject, and date
      const existingPlan = lessonPlans.find(
        plan => appNormalize(plan.class) === appNormalize(slot.class) &&
                appNormalize(plan.subject) === appNormalize(slot.subject) &&
                String(plan.date || '') === String(slot.date || '')
      );
      
      setSelectedSlot(slot);
      setShowPreparationForm(true);
      
      // Filter relevant schemes outside the if/else to make it available for both paths
      const relevantSchemes = approvedSchemes.filter(
        scheme => appNormalize(scheme.class) === appNormalize(slot.class) && appNormalize(scheme.subject) === appNormalize(slot.subject)
      );
      
      if (existingPlan) {
        setPreparationData({
          schemeId: existingPlan.schemeId || '',
          session: String(existingPlan.session || '1'),
          objectives: existingPlan.objectives || '',
          activities: existingPlan.activities || '',
          notes: existingPlan.notes || ''
        });
      } else {
        const defaultSchemeId = relevantSchemes.length > 0 ? relevantSchemes[0].schemeId : '';
        
        // Calculate next session number for the selected scheme's chapter
        let nextSessionNumber = 1;
        if (defaultSchemeId && lessonPlans.length > 0) {
          // Find existing lesson plans for this scheme to determine next session
          const existingSessionsForScheme = lessonPlans
            .filter(lp => lp.schemeId === defaultSchemeId)
            .map(lp => Number(lp.session || 0))
            .filter(session => session > 0);
          
          if (existingSessionsForScheme.length > 0) {
            nextSessionNumber = Math.max(...existingSessionsForScheme) + 1;
          }
        }
        
        setPreparationData({
          schemeId: defaultSchemeId,
          // Use sequential session number for the chapter, not timetable period
          session: String(nextSessionNumber), 
          objectives: '',
          activities: '',
          notes: ''
        });
      }
      // Pre-filled data ready for form
    };

    const handleSchemeChange = (schemeId) => {
      const scheme = approvedSchemes.find(s => s.schemeId === schemeId);
      
      if (scheme) {
        // Calculate next session number for the selected scheme's chapter
        let nextSessionNumber = 1;
        if (lessonPlans.length > 0) {
          // Find existing lesson plans for this scheme to determine next session
          const existingSessionsForScheme = lessonPlans
            .filter(lp => lp.schemeId === schemeId)
            .map(lp => Number(lp.session || 0))
            .filter(session => session > 0);
          
          if (existingSessionsForScheme.length > 0) {
            nextSessionNumber = Math.max(...existingSessionsForScheme) + 1;
          }
        }
        
        // Use sequential session number for the chapter, not timetable period
        setPreparationData(prev => ({
          ...prev,
          schemeId: schemeId,
          session: String(nextSessionNumber)
        }));
      } else {
        setPreparationData(prev => ({ ...prev, schemeId: schemeId }));
      }
    };

    // When the session changes, update preparation data and pre-fill
    // objectives/activities if an existing lesson plan exists for the
    // selected class/subject/session.
    const handleSessionChange = (sess) => {
      if (!selectedSlot) return;
      // Check if there is an existing plan for the selected session
      const existingPlan = lessonPlans.find(
        plan => appNormalize(plan.class) === appNormalize(selectedSlot.class) && 
                appNormalize(plan.subject) === appNormalize(selectedSlot.subject) && 
                Number(plan.session) === Number(sess) &&
                String(plan.date || '') === String(selectedSlot.date || '')
      );
      if (existingPlan) {
        setPreparationData(prev => ({
          ...prev,
          session: String(sess),
          objectives: existingPlan.objectives || '',
          activities: existingPlan.activities || ''
        }));
      } else {
        setPreparationData(prev => ({
          ...prev,
          session: String(sess),
          objectives: '',
          activities: ''
        }));
      }
    };

    const handleSubmitPreparation = async (e) => {
      e.preventDefault();
      if (!selectedSlot) return;
      
      // Get the selected scheme to access its chapter
      const selectedScheme = approvedSchemes.find(s => s.schemeId === preparationData.schemeId);
      const selectedChapter = selectedScheme?.chapter || '';
      
  // Enhanced duplicate prevention
  // Prevent duplicates based on class/subject/session/date/chapter combination
      // Allow editing existing lesson plans (when lpId matches)
      if (!selectedSlot.lpId) {
        const normalizedClass = appNormalize(selectedSlot.class);
        const normalizedSubject = appNormalize(selectedSlot.subject);
        // Use only the session number from the scheme, not timetable period
        const sessionNumber = Number(preparationData.session || 1);
        
        const duplicate = lessonPlans.find(lp => {
          // Get the chapter for the plan's scheme
          const planScheme = approvedSchemes.find(s => s.schemeId === lp.schemeId);
          const planChapter = planScheme?.chapter || '';
          
          return (
            appNormalize(lp.class) === normalizedClass &&
            appNormalize(lp.subject) === normalizedSubject &&
            Number(lp.session) === sessionNumber &&
            String(lp.date || '') === String(selectedSlot.date || '') &&
            // Check if the chapters match (strict duplicate check)
            planChapter === selectedChapter
          );
        });
        
        if (duplicate) {
          error('Duplicate Detected', 'A lesson plan already exists for this class/subject/session/date/chapter combination. Duplicate not allowed.');
          return;
        }
      }
      try {
        // Use withSubmit so the overlay/toast appears during submission
        await withSubmit('Submitting lesson plan...', async () => {
          const res = await api.submitLessonPlanDetails(selectedSlot.lpId, {
            class: selectedSlot.class,
            subject: selectedSlot.subject,
            session: Number(preparationData.session || 1), // Use scheme session number, not timetable period
            date: selectedSlot.date,
            schemeId: preparationData.schemeId,
            objectives: preparationData.objectives,
            activities: preparationData.activities,
            notes: preparationData.notes,
            teacherEmail: user?.email || '',
            teacherName: user?.name || ''
          });
          
          // Unwrap the response (backend wraps in {status, data, timestamp})
          const result = res.data || res;
          
          // If server responded with an error payload, throw to trigger error handling
          if (result && result.error) throw new Error(result.error);
          return result;
        });
        // Refresh lesson plans list from backend
        if (user) {
          const updatedPlans = await api.getTeacherLessonPlans(user.email);
          setLessonPlans(Array.isArray(updatedPlans) ? updatedPlans : []);
        }
        // On success, close the form
        setShowPreparationForm(false);
        setSelectedSlot(null);
        setPreparationData({ schemeId: '', session: '1', objectives: '', activities: '', notes: '' });
      } catch (err) {
        console.error('Error submitting lesson plan details:', err);
  // If duplicate detected (server returned a duplicate error), refresh plans and open the existing plan for editing
  if (String(err.message || '').toLowerCase().indexOf('duplicate') !== -1) {
          try {
            if (user) {
              const updatedPlans = await api.getTeacherLessonPlans(user.email);
              setLessonPlans(Array.isArray(updatedPlans) ? updatedPlans : []);
              const normalizedClass = (selectedSlot.class || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
              const normalizedSubject = (selectedSlot.subject || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
              const sessNum = Number(preparationData.session || 1); // Use scheme session number, not timetable period
              const dup = (updatedPlans || []).find(p => {
                return (p.class || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === normalizedClass &&
                       (p.subject || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === normalizedSubject &&
                       Number(p.session) === sessNum;
              });
              if (dup) {
                // Open editor for existing plan
                setSelectedSlot({
                  class: dup.class,
                  subject: dup.subject,
                  period: dup.session,
                  date: todayIST(),
                  day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                  lpId: dup.lpId
                });
                setPreparationData(prev => ({
                  ...prev,
                  schemeId: preparationData.schemeId || '',
                  session: String(dup.session || '1'),
                  objectives: dup.objectives || '',
                  activities: dup.activities || '',
                  notes: ''
                }));
                setShowPreparationForm(true);
                warning('Duplicate Plan', 'Duplicate detected: opened existing lesson plan for editing.');
                return;
              }
            }
          } catch (e) {
            console.warn('Failed to recover from duplicate error:', e);
          }
        }
        // For other errors, close the form to avoid leaving stale state
        setShowPreparationForm(false);
        setSelectedSlot(null);
        setPreparationData({ schemeId: '', session: '1', objectives: '', activities: '', notes: '' });
      }
    };

    return (
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading lesson plans...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
              <div className="flex space-x-3">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

        {showPreparationForm && selectedSlot && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              Prepare Lesson Plan for {selectedSlot.class} - {selectedSlot.subject}
            </h2>
            <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Date:</strong> {selectedSlot.date} ({selectedSlot.day})
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Period {selectedSlot.period}:</strong> {periodToTimeString(selectedSlot.period, memoizedSettings.periodTimes)}
                </p>
              </div>
            </div>
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This lesson plan applies only to this specific period. You'll need to create separate lesson plans for other periods of the same class.
              </p>
            </div>
            <form onSubmit={handleSubmitPreparation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approved Scheme of Work
                </label>
                <select
                  value={preparationData.schemeId}
                  onChange={(e) => handleSchemeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Approved Scheme</option>
                  {approvedSchemes
                    .filter(scheme => appNormalize(scheme.class) === appNormalize(selectedSlot.class) && appNormalize(scheme.subject) === appNormalize(selectedSlot.subject))
                    .map(scheme => (
                      <option key={scheme.schemeId} value={scheme.schemeId}>
                        {scheme.chapter} - {scheme.month} ({scheme.noOfSessions} sessions)
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select from approved schemes for this class and subject
                </p>
              </div>

              {/* Session dropdown based on selected scheme's number of sessions + extensions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session
                </label>
                <select
                  value={preparationData.session}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  {(() => {
                    const scheme = approvedSchemes.find(s => s.schemeId === preparationData.schemeId);
                    const originalMax = scheme ? Number(scheme.noOfSessions || 1) : 1;
                    
                    // Calculate extended max: include existing sessions + 1 for continuation
                    let extendedMax = originalMax;
                    if (scheme && lessonPlans.length > 0) {
                      const existingSessionsForScheme = lessonPlans
                        .filter(lp => lp.schemeId === scheme.schemeId)
                        .map(lp => Number(lp.session || 0))
                        .filter(session => session > 0);
                      
                      if (existingSessionsForScheme.length > 0) {
                        const maxExisting = Math.max(...existingSessionsForScheme);
                        extendedMax = Math.max(originalMax, maxExisting + 1);
                      }
                    }
                    
                    const options = [];
                    for (let i = 1; i <= extendedMax; i++) {
                      const isExtended = i > originalMax;
                      options.push(
                        <option key={i} value={String(i)}>
                          Session {i} - {scheme ? scheme.chapter : ''}{isExtended ? ' (Extended)' : ''}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Sessions beyond the original plan are marked as extended
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Learning Objectives</label>
                <textarea
                  value={preparationData.objectives}
                  onChange={(e) => setPreparationData(prev => ({...prev, objectives: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  placeholder="What students should learn..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activities/Methods</label>
                <textarea
                  value={preparationData.activities}
                  onChange={(e) => setPreparationData(prev => ({...prev, activities: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="4"
                  placeholder="Teaching methods, activities, resources..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={preparationData.notes}
                  onChange={(e) => setPreparationData(prev => ({...prev, notes: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="2"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreparationForm(false);
                    setSelectedSlot(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Submitted Lesson Plans Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Your Submitted Lesson Plans</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage all your submitted lesson plans</p>
            
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
                <select
                  value={lessonPlanFilters.class}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, class: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Classes</option>
                  {[...new Set(lessonPlans.map(plan => plan.class))].sort().map(cls => (
                    <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <select
                  value={lessonPlanFilters.subject}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, subject: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Subjects</option>
                  {[...new Set(lessonPlans.map(plan => plan.subject))].sort().map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={lessonPlanFilters.status}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, status: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  {[...new Set(lessonPlans.map(plan => plan.status))].sort().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chapter</label>
                <select
                  value={lessonPlanFilters.chapter}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, chapter: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Chapters</option>
                  {[...new Set(lessonPlans.map(plan => plan.chapter).filter(Boolean))].sort().map(chapter => (
                    <option key={chapter} value={chapter}>{chapter}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setLessonPlanFilters({ class: '', subject: '', status: '', chapter: '' })}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Clear Filters
                </button>
              </div>
              <div className="flex items-end gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => { setGroupByClass(v => { const next = !v; if (next) setGroupByChapter(false); return next; }); }}
                  className={`px-3 py-2 text-sm rounded-md border ${groupByClass ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                  title="Group by Class"
                >
                  Group by Class
                </button>
                <button
                  type="button"
                  onClick={() => { setGroupByChapter(v => { const next = !v; if (next) setGroupByClass(false); return next; }); }}
                  className={`px-3 py-2 text-sm rounded-md border ${groupByChapter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                  title="Group by Chapter"
                >
                  Group by Chapter
                </button>
              </div>
            </div>
          </div>
          {(() => {
            const filtered = lessonPlans.filter(plan => (
              (!lessonPlanFilters.class || plan.class === lessonPlanFilters.class) &&
              (!lessonPlanFilters.subject || plan.subject === lessonPlanFilters.subject) &&
              (!lessonPlanFilters.status || plan.status === lessonPlanFilters.status) &&
              (!lessonPlanFilters.chapter || plan.chapter === lessonPlanFilters.chapter)
            ));

            if (groupByClass || groupByChapter) {
              const keyFn = (p) => groupByClass ? (p.class || 'Unknown Class') : (p.chapter || 'Unknown Chapter');
              const groups = {};
              for (const p of filtered) {
                const k = keyFn(p);
                if (!groups[k]) groups[k] = [];
                groups[k].push(p);
              }
              const sortedKeys = Object.keys(groups).sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
              return (
                <div className="px-6 py-4 space-y-6">
                  {sortedKeys.map(key => {
                    const items = groups[key].slice().sort((a,b)=> {
                      // sort by subject then session
                      const s = (a.subject||'').localeCompare(b.subject||'');
                      if (s !== 0) return s;
                      return Number(a.session||0) - Number(b.session||0);
                    });
                    return (
                      <div key={key} className="border rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                          <div className="font-semibold text-gray-900">
                            {groupByClass ? `Class: ${key}` : `Chapter: ${key}`}
                          </div>
                          <div className="text-xs text-gray-600">{items.length} plan(s)</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                {!groupByClass && (<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>)}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                {!groupByChapter && (<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>)}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {items.map(plan => (
                                <tr key={plan.lpId}>
                                  {!groupByClass && (<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.class}</td>)}
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.subject}</td>
                                  {!groupByChapter && (<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.chapter || 'N/A'}</td>)}
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.session}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      plan.status === 'Pending Preparation' 
                                        ? 'bg-yellow-100 text-yellow-800' 
                                        : plan.status === 'Pending Review' 
                                          ? 'bg-blue-100 text-blue-800'
                                          : plan.status === 'Ready'
                                            ? 'bg-green-100 text-green-800'
                                            : plan.status === 'Needs Rework'
                                              ? 'bg-orange-100 text-orange-800'
                                              : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {plan.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    <button
                                      onClick={() => handlePrepareLesson({
                                        class: plan.class,
                                        subject: plan.subject,
                                        period: plan.session,
                                        date: todayIST(),
                                        day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                        lpId: plan.lpId
                                      })}
                                      className={`${
                                        plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                          ? 'bg-gray-300 cursor-not-allowed'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      } text-white px-3 py-1 rounded text-sm mr-2`}
                                      disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                                    >
                                      Edit
                                    </button>
                                    <button type="button" className="text-blue-600 hover:text-blue-900 mr-2" onClick={() => openLessonView(plan)} title="View lesson plan">
                                      <Eye className="h-4 w-4 inline" />
                                    </button>
                                    {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                                      <button
                                        onClick={() => handleDeleteLessonPlan(plan)}
                                        disabled={deletingPlan === plan.lpId}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                        title="Delete lesson plan"
                                      >
                                        {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4 inline" />}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Default flat table view
            return (
              <>
                {/* Mobile Card Layout */}
                <div className="block md:hidden">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No lesson plans found.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.map((plan) => (
                        <div key={plan.lpId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{stripStdPrefix(plan.class)} - {plan.subject}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{plan.chapter || 'N/A'}</div>
                            </div>
                            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              plan.status === 'Pending Preparation' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                : plan.status === 'Pending Review' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : plan.status === 'Ready'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : plan.status === 'Needs Rework'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {plan.status}
                            </span>
                          </div>
                          
                          <div className="text-sm mb-3">
                            <span className="text-gray-500 dark:text-gray-400">Session:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">{plan.session}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePrepareLesson({
                                class: plan.class,
                                subject: plan.subject,
                                period: plan.session,
                                date: todayIST(),
                                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                lpId: plan.lpId
                              })}
                              className={`flex-1 ${
                                plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              } text-white px-3 py-2 rounded-lg text-sm font-medium`}
                              disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openLessonView(plan)}
                              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg"
                              title="View lesson plan"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                              <button
                                onClick={() => handleDeleteLessonPlan(plan)}
                                disabled={deletingPlan === plan.lpId}
                                className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
                                title="Delete lesson plan"
                              >
                                {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Chapter</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Session</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.map((plan) => (
                        <tr key={plan.lpId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(plan.class)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.subject}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.chapter || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.session}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              plan.status === 'Pending Preparation' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                : plan.status === 'Pending Review' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : plan.status === 'Ready'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : plan.status === 'Needs Rework'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {plan.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <button
                              onClick={() => handlePrepareLesson({
                                class: plan.class,
                                subject: plan.subject,
                                period: plan.session,
                                date: todayIST(),
                                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                lpId: plan.lpId
                              })}
                              className={`${
                                plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              } text-white px-3 py-1 rounded text-sm mr-2`}
                              disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                            >
                              Edit
                            </button>
                            <button type="button" className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-2" onClick={() => openLessonView(plan)} title="View lesson plan">
                              <Eye className="h-4 w-4 inline" />
                            </button>
                            {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                              <button
                                onClick={() => handleDeleteLessonPlan(plan)}
                                disabled={deletingPlan === plan.lpId}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                                title="Delete lesson plan"
                              >
                                {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4 inline" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                          {lessonPlans.length === 0 ? 'No lesson plans submitted yet.' : 'No lesson plans match the selected filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )
          })()}
        </div>
          </>
        )}
      </div>
    );
  };

  // Timetable View
  const TimetableView = () => {
    const [timetable, setTimetable] = useState([]);

    useEffect(() => {
      async function fetchTimetable() {
        try {
          if (!user) return;
          
          // For HM/Admin role, don't fetch teacher timetable (they won't have entries)
          if (user.role === 'hm' || user.role === 'admin') {
            setTimetable([]);
            return;
          }
          
          const data = await api.getTeacherWeeklyTimetable(user.email);
          setTimetable(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchTimetable();
    }, [user]);

    // Determine the maximum number of periods across the week to build the table header dynamically
    const maxPeriods = Math.max(
      0,
      ...timetable.map(day =>
        Array.isArray(day.periods) ? Math.max(0, ...day.periods.map(p => p.period)) : 0
      )
    );
    const periodHeaders = Array.from({ length: maxPeriods }, (_, i) => i + 1);

    // Helper to get period time string
    const getPeriodTime = (periodNum) => {
      const periodTimes = memoizedSettings?.periodTimes || memoizedSettings?.periodTimesWeekday;
      return periodToTimeString(periodNum, periodTimes);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Weekly Timetable</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 text-sm md:text-base">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Show appropriate view for HM/Admin */}
        {(user?.role === 'hm' || user?.role === 'admin') ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-8">
            <div className="text-center">
              <Calendar className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                View School Timetables
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                As an administrator, you can view the full school timetable or daily schedules.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setActiveView('day-timetable')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Calendar className="h-5 w-5" />
                  Day Timetable
                </button>
                <button
                  onClick={() => setActiveView('full-timetable')}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-5 w-5" />
                  Full Timetable
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">This Week</h2>
            </div>

            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              {timetable.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No timetable data available.
                </div>
              ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {timetable.map((day, index) => (
                  <div key={index} className="p-4">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{day.day}</div>
                    {Array.isArray(day.periods) && day.periods.length > 0 ? (
                      <div className="space-y-2">
                        {day.periods.map((p, idx) => (
                          <div key={idx} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">P{p.period}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{getPeriodTime(p.period)}</span>
                            </div>
                            <div className="text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(p.class)} - {p.subject}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No classes scheduled</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day</th>
                  {periodHeaders.map(period => (
                    <th key={period} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <div>Period {period}</div>
                      <div className="text-xs font-normal text-gray-400 dark:text-gray-500 mt-0.5">{getPeriodTime(period)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {timetable.map((day, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {day.day}
                    </td>
                    {periodHeaders.map(periodNumber => {
                      const p = Array.isArray(day.periods)
                        ? day.periods.find(x => x.period === periodNumber)
                        : undefined;
                      return (
                        <td key={periodNumber} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {p ? `${stripStdPrefix(p.class)} - ${p.subject}` : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    );
  };

  // Day Timetable View (additional view requested) - shows timetable for a single day as a table
  const DayTimetableView = ({ periodTimes }) => {
    const [rows, setRows] = useState([]);
    const [date, setDate] = useState(formatDateForInput(todayIST()));
    const [loadingDay, setLoadingDay] = useState(false);
    // Use the period times passed as props directly instead of maintaining separate state
    const customPeriodTimes = periodTimes;

    useEffect(() => {
      async function fetchDay() {
        try {
          setLoadingDay(true);
          const data = await api.getDailyTimetableWithSubstitutions(date);
          // API returns { date, timetable } in some deployments, or an array
          let table = [];
          if (Array.isArray(data)) table = data;
          else if (data && Array.isArray(data.timetable)) table = data.timetable;
          setRows(table);
        } catch (err) {
          console.error('Failed to load day timetable', err);
          setRows([]);
        } finally {
          setLoadingDay(false);
        }
      }
      fetchDay();
    }, [date]);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Day Timetable</h1>
          <div className="flex items-center space-x-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border rounded" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Timetable for {formatLocalDate(date, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'long' })}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingDay ? (
                  <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-4 text-center">No timetable entries for this date.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{periodToTimeString(r.period, customPeriodTimes)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stripStdPrefix(r.class)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.teacher || r.teacherName || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.subject || r.regularSubject || r.substituteSubject || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.isSubstitution ? 'Substitution' : 'Regular'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // My Substitutions View - For teachers to see their assigned substitutions
  const MySubstitutionsView = ({ user, periodTimes }) => {
    const [substitutions, setSubstitutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [acknowledgingId, setAcknowledgingId] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [effectiveness, setEffectiveness] = useState(null);
    const [effectivenessLoading, setEffectivenessLoading] = useState(false);

    useEffect(() => {
      // Set default date range: last 30 days to today
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
      if (user?.email && startDate && endDate) {
        loadSubstitutions();
      }
    }, [user, startDate, endDate]);

    const loadSubstitutions = async () => {
      setLoading(true);
      setDebugInfo(null);
      try {
        // Use single range query instead of multiple date queries
        const result = await api.getTeacherSubstitutionsRange(user.email, startDate, endDate);
        
        const allSubs = result?.substitutions || [];
        
        if (allSubs.length === 0) {
          // Load debug info to help troubleshoot
          const debugData = await api.getAllSubstitutions();
          setDebugInfo({
            totalInSheet: debugData.total,
            allData: debugData.data,
            searchedEmail: user.email,
            searchedRange: `${startDate} to ${endDate}`
          });
        }
        
        setSubstitutions(allSubs);

        // Also load reporting effectiveness for the same range.
        try {
          setEffectivenessLoading(true);
          const eff = await api.getSubstitutionEffectiveness({
            email: user.email,
            startDate,
            endDate,
            teacherEmail: user.email,
            includeDetails: '1'
          });
          if (eff?.success === false) {
            setEffectiveness(null);
          } else {
            setEffectiveness(eff);
          }
        } catch {
          setEffectiveness(null);
        } finally {
          setEffectivenessLoading(false);
        }
      } catch (error) {
        console.error('Error loading substitutions:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleAcknowledge = async (sub) => {
      const uniqueId = `${sub.date}-${sub.period}-${sub.class}`;
      setAcknowledgingId(uniqueId);
      
      try {
        const response = await api.acknowledgeSubstitutionAssignment({
          date: sub.date,
          period: sub.period,
          class: sub.class,
          teacherEmail: user.email
        });

        if (response?.success || response?.data?.success) {
          // Update local state
          setSubstitutions(prev => prev.map(s => {
            const sId = `${s.date}-${s.period}-${s.class}`;
            if (sId === uniqueId) {
              return { ...s, acknowledged: 'TRUE', acknowledgedBy: user.email, acknowledgedAt: new Date().toISOString() };
            }
            return s;
          }));
        } else {
          console.error('Failed to acknowledge:', response);
          alert('Failed to acknowledge substitution. Please try again.');
        }
      } catch (error) {
        console.error('Error acknowledging substitution:', error);
        alert('Error acknowledging substitution. Please try again.');
      } finally {
        setAcknowledgingId(null);
      }
    };

    const getPeriodTime = (period) => {
      if (!periodTimes || !Array.isArray(periodTimes)) return '';
      const periodInfo = periodTimes.find(p => parseInt(p.period) === parseInt(period));
      return periodInfo ? `${periodInfo.start} - ${periodInfo.end}` : '';
    };

    const isAcknowledged = (sub) => {
      return String(sub.acknowledged).toLowerCase() === 'true';
    };

    const normClass = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    const reportInfoByKey = useMemo(() => {
      const m = new Map();
      const details = Array.isArray(effectiveness?.details) ? effectiveness.details : [];
      for (const d of details) {
        if (!d) continue;
        const k = `${String(d.date || '').trim()}|${String(d.period || '').trim()}|${normClass(d.class)}`;
        m.set(k, d);
      }
      return m;
    }, [effectiveness]);

    const getReportInfo = (sub) => {
      const k = `${String(sub?.date || '').trim()}|${String(sub?.period || '').trim()}|${normClass(sub?.class)}`;
      return reportInfoByKey.get(k) || null;
    };

    const effTotals = effectiveness?.totals || null;
    const effClassStats = Array.isArray(effectiveness?.classStats) ? effectiveness.classStats : [];
    const effChapterStats = useMemo(() => {
      const details = Array.isArray(effectiveness?.details) ? effectiveness.details : [];
      const agg = new Map();
      for (const d of details) {
        if (!d || d.reported !== true) continue;
        const ch = String(d.reportChapter || '').trim() || 'No chapter';
        if (!agg.has(ch)) agg.set(ch, { chapter: ch, count: 0 });
        agg.get(ch).count += 1;
      }
      return Array.from(agg.values()).sort((a, b) => b.count - a.count || a.chapter.localeCompare(b.chapter));
    }, [effectiveness]);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">My Substitutions</h1>
          <div className="text-sm text-gray-600">
            View and acknowledge substitution assignments
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={loadSubstitutions}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Reporting Effectiveness */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900">Substitution reporting effectiveness</div>
              <div className="text-xs text-gray-600">Assigned vs daily reports submitted for substitutions</div>
            </div>
            {effectivenessLoading && <div className="text-xs text-gray-500">Loading...</div>}
          </div>
          {effTotals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Assigned</div>
                <div className="text-lg font-semibold text-gray-900">{effTotals.assigned}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Reported</div>
                <div className="text-lg font-semibold text-green-700">{effTotals.reported}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Pending</div>
                <div className="text-lg font-semibold text-amber-700">{effTotals.pending}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Reported %</div>
                <div className="text-lg font-semibold text-gray-900">{effTotals.reportedPct}%</div>
              </div>
            </div>
          )}
          {!effTotals && !effectivenessLoading && (
            <div className="mt-3 text-sm text-gray-500">No analytics available for this range.</div>
          )}

          {effClassStats.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-900 mb-2">Classwise breakdown</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Assigned</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reported</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {effClassStats.map((r) => (
                      <tr key={r.class}>
                        <td className="px-3 py-2 text-sm text-gray-900">{r.class}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 text-right">{r.assigned}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 text-right">{r.reported}</td>
                        <td className="px-3 py-2 text-sm text-amber-700 text-right">{r.pending}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 text-right">{r.reportedPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {effChapterStats.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-900 mb-2">Chapterwise (reported substitutions only)</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chapter</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {effChapterStats.map((r) => (
                      <tr key={r.chapter}>
                        <td className="px-3 py-2 text-sm text-gray-900">{r.chapter}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 text-right">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Substitutions List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Assigned Substitutions ({substitutions.length})</h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-400 mt-4">Loading substitutions...</p>
              </div>
            ) : substitutions.length === 0 ? (
              <div>
                <div className="text-center py-12">
                  <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">No substitutions found for the selected period</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">Showing results for: {startDate} to {endDate}</p>
                </div>
                
                {/* Debug Info */}
                {debugInfo && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Debug Information:</h3>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>• Total substitutions in sheet: <strong>{debugInfo.totalInSheet}</strong></p>
                      <p>• Searching for teacher: <strong>{debugInfo.searchedEmail}</strong></p>
                      <p>• Date range: <strong>{debugInfo.searchedRange}</strong></p>
                      {debugInfo.allData && debugInfo.allData.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium mb-1">All substitutions in sheet:</p>
                          <div className="max-h-60 overflow-y-auto">
                            {debugInfo.allData.map((sub, idx) => (
                              <div key={idx} className="pl-4 py-1 border-l-2 border-gray-300 dark:border-gray-600 mb-2">
                                <p>Date: {sub.date} | Period: {sub.period} | Class: {sub.class}</p>
                                <p>Substitute: <strong>{sub.substituteTeacher}</strong></p>
                                <p className="text-gray-500 dark:text-gray-400">Absent: {sub.absentTeacher}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="block md:hidden space-y-3">
                  {substitutions.map((sub, index) => {
                    const uniqueId = `${sub.date}-${sub.period}-${sub.class}`;
                    const acknowledged = isAcknowledged(sub);
                    const acknowledging = acknowledgingId === uniqueId;
                    const rep = getReportInfo(sub);
                    const repSubmitted = rep ? !!rep.reported : null;
                    const repMarked = rep ? !!rep.reportMarkedSubstitution : null;
                    
                    return (
                      <div key={index} className={`p-4 rounded-lg border ${acknowledged ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {new Date(sub.date).toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })} • Period {sub.period}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stripStdPrefix(sub.class)}</div>
                          </div>
                          {acknowledged ? (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              Acknowledged
                            </span>
                          ) : (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Pending
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm mb-3">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Time:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">{getPeriodTime(sub.period)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Subject:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100 font-medium">{sub.substituteSubject || sub.regularSubject}</span>
                            {sub.substituteSubject !== sub.regularSubject && (
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(Original: {sub.regularSubject})</span>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Absent Teacher:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">{sub.absentTeacher}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Report:</span>
                            <span className={`ml-1 font-medium ${repSubmitted === true ? 'text-green-700 dark:text-green-400' : repSubmitted === false ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {repSubmitted === true ? 'Submitted' : repSubmitted === false ? 'Pending' : '—'}
                            </span>
                            {repSubmitted === true && repMarked === false && (
                              <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">(not marked substitution)</span>
                            )}
                          </div>
                          {sub.note && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Note:</span>
                              <span className="ml-1 text-gray-900 dark:text-gray-100">{sub.note}</span>
                            </div>
                          )}
                        </div>

                        {!acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(sub)}
                            disabled={acknowledging}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                          </button>
                        )}
                        {acknowledged && sub.acknowledgedAt && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Acknowledged on {new Date(sub.acknowledgedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Period</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Absent Teacher</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Note</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Report</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {substitutions.map((sub, index) => {
                        const uniqueId = `${sub.date}-${sub.period}-${sub.class}`;
                        const acknowledged = isAcknowledged(sub);
                        const acknowledging = acknowledgingId === uniqueId;
                        const rep = getReportInfo(sub);
                        const repSubmitted = rep ? !!rep.reported : null;
                        const repMarked = rep ? !!rep.reportMarkedSubstitution : null;
                        
                        return (
                          <tr key={index} className={acknowledged ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {new Date(sub.date).toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              Period {sub.period}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {getPeriodTime(sub.period)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {stripStdPrefix(sub.class)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              <div className="flex flex-col">
                                <span className="font-medium">{sub.substituteSubject || sub.regularSubject}</span>
                                {sub.substituteSubject !== sub.regularSubject && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">(Original: {sub.regularSubject})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {sub.absentTeacher}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {sub.note || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {acknowledged ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <Check className="w-3 h-3 mr-1" />
                                  Acknowledged
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`${repSubmitted === true ? 'text-green-700 dark:text-green-400' : repSubmitted === false ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {repSubmitted === true ? 'Submitted' : repSubmitted === false ? 'Pending' : '—'}
                              </span>
                              {repSubmitted === true && repMarked === false && (
                                <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">not marked substitution</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {!acknowledged && (
                                <button
                                  onClick={() => handleAcknowledge(sub)}
                                  disabled={acknowledging}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-xs"
                                >
                                  {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                                </button>
                              )}
                              {acknowledged && sub.acknowledgedAt && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(sub.acknowledgedAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary Statistics */}
        {!loading && substitutions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Substitutions</p>
                  <p className="text-2xl font-bold text-gray-900">{substitutions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Acknowledged</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {substitutions.filter(s => isAcknowledged(s)).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unique Classes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {[...new Set(substitutions.map(s => s.class))].length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <BookOpen className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unique Subjects</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {[...new Set(substitutions.map(s => s.substituteSubject || s.regularSubject))].length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reports View - Enhanced Daily Report with Timetable Integration
  const ReportsView = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Daily Reports</h1>
          <div className="text-sm text-gray-600">
            Complete your daily reports based on your timetable
          </div>
        </div>
        
        {/* Modern daily reporting with smooth UX - NO PAGE REFRESH */}
        <div className="bg-transparent">
          <DailyReportModern user={memoizedUser} settings={memoizedSettings} />
        </div>
      </div>
    );
  };

  const HMDashboardView = ({ insights: insightsProp }) => {
    console.debug('🚀 HMDashboardView rendering with insights:', insightsProp);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dailyReportsData, setDailyReportsData] = useState({ reports: [], stats: {} });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [paceTracking, setPaceTracking] = useState(null);
    const [loadingPaceTracking, setLoadingPaceTracking] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    const [lessonPlansToday, setLessonPlansToday] = useState([]);
    const [loadingLessonPlansToday, setLoadingLessonPlansToday] = useState(false);

    // Live schedule focused period (Prev/Next controls). Auto-follows current period until user navigates.
    const [focusedPeriod, setFocusedPeriod] = useState(1);
    const [focusedPeriodPinned, setFocusedPeriodPinned] = useState(false);

    // Modal for lesson plan details
    const [selectedLessonPlan, setSelectedLessonPlan] = useState(null);
    const [showLessonPlanModal, setShowLessonPlanModal] = useState(false);

    // Missing lesson plans overview
    const [missingPlans, setMissingPlans] = useState(null);
    const [loadingMissingPlans, setLoadingMissingPlans] = useState(false);

    // Insights state - fetch if not provided as prop
    const [localInsights, setLocalInsights] = useState(null);
    const insights = insightsProp || localInsights || {
      planCount: 0,
      lessonCount: 0,
      teacherCount: 0,
      classCount: 0
    };

    // Fetch insights if not provided
    useEffect(() => {
      if (!insightsProp) {
        async function fetchInsights() {
          try {
            const [hmData, classes] = await Promise.all([
              api.getHmInsights(),
              api.getAllClasses()
            ]);
            setLocalInsights({
              planCount: hmData?.planCount || 0,
              lessonCount: hmData?.lessonCount || 0,
              teacherCount: hmData?.teacherCount || 0,
              classCount: Array.isArray(classes) ? classes.length : 0
            });
          } catch (err) {
            console.error('Failed to fetch HM insights:', err);
          }
        }
        fetchInsights();
      }
    }, [insightsProp]);

    useEffect(() => {
      async function loadMissingPlans() {
        try {
          setLoadingMissingPlans(true);
          const result = await api.getAllMissingLessonPlans(7);
          setMissingPlans(result?.data || result);
        } catch (err) {
          console.error('Failed to load missing lesson plans:', err);
        } finally {
          setLoadingMissingPlans(false);
        }
      }
      loadMissingPlans();
    }, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh daily reports every 5 minutes (pauses when tab hidden)
  useEffect(() => {
    if (!autoRefresh) return;
    
    const refreshData = async () => {
      // Skip if tab is hidden to save resources
      if (document.hidden) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;
        setDailyReportsData({
          reports: data.reports || [],
          stats: data.stats || {}
        });
        setLastRefresh(new Date());
      } catch (err) {
        console.error('Auto-refresh failed:', err);
      }
    };
    
    const refreshTimer = setInterval(refreshData, 5 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, [autoRefresh]);

  // Load daily reports on mount
  useEffect(() => {
    async function loadTodayReports() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;

        if (!Array.isArray(data?.reports) || data.reports.length === 0) {
          console.warn('⚠️ NO REPORTS FOUND - Check backend logs for timetable data');
        }
        
        setDailyReportsData({
          reports: data.reports || [],
          stats: data.stats || {}
        });
        setLastRefresh(new Date());
      } catch (err) {
        console.error('❌ Failed to load daily reports:', err);
      }
    }
    loadTodayReports();
  }, []);
  
  // Load syllabus pace tracking
  useEffect(() => {
    async function loadPaceTracking() {
      setLoadingPaceTracking(true);
      try {
        const response = await api.getSyllabusPaceTracking('Term 2');
        if (response?.success) {
          setPaceTracking(response);
        }
      } catch (err) {
        console.error('Failed to load pace tracking:', err);
      } finally {
        setLoadingPaceTracking(false);
      }
    }
    loadPaceTracking();
  }, []);

  // Determine current period based on time
  const getCurrentPeriod = () => {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const time = hour * 60 + minute;

    // Check if today is Friday (0 = Sunday, 5 = Friday)
    const today = new Date();
    const isFriday = today.getDay() === 5;

    // Use Friday-specific period times if available and today is Friday
    let selectedPeriodTimes = null;
    if (isFriday && memoizedSettings?.periodTimesFriday && Array.isArray(memoizedSettings.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesFriday;
    } else if (memoizedSettings?.periodTimesWeekday && Array.isArray(memoizedSettings.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesWeekday;
    } else if (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length) {
      selectedPeriodTimes = memoizedSettings.periodTimes;
    }

    // Prefer dynamic period times from settings if available
    const dynamicTimes = selectedPeriodTimes
      ? selectedPeriodTimes.map(p => {
          if (!p.start || !p.end) return null;
          const [sh, sm] = p.start.split(':').map(Number);
          const [eh, em] = p.end.split(':').map(Number);
          return { period: p.period, start: sh * 60 + sm, end: eh * 60 + em };
        }).filter(Boolean)
      : null;

    const fallbackTimes = [
      { period: 1, start: 8 * 60 + 50, end: 9 * 60 + 35 },
      { period: 2, start: 9 * 60 + 35, end: 10 * 60 + 20 },
      { period: 3, start: 10 * 60 + 30, end: 11 * 60 + 15 },
      { period: 4, start: 11 * 60 + 15, end: 12 * 60 },
      { period: 5, start: 12 * 60, end: 12 * 60 + 45 },
      { period: 6, start: 13 * 60 + 15, end: 14 * 60 },
      { period: 7, start: 14 * 60, end: 14 * 60 + 40 },
      { period: 8, start: 14 * 60 + 45, end: 15 * 60 + 25 }
    ];

    const ranges = dynamicTimes || fallbackTimes;
    const current = ranges.find(r => time >= r.start && time < r.end);
    return current ? current.period : null;
  };

  const currentPeriod = getCurrentPeriod();

  // Keep focused period synced to current period unless user has navigated.
  useEffect(() => {
    if (focusedPeriodPinned) return;
    setFocusedPeriod(currentPeriod || 1);
  }, [currentPeriod, focusedPeriodPinned]);

  // Lazy-load lesson plans for today so we can show chapter/session in live and selected periods.
  useEffect(() => {
    const shouldLoad = Boolean(currentPeriod || selectedPeriod);
    if (!shouldLoad) return;
    if (Array.isArray(lessonPlansToday) && lessonPlansToday.length > 0) return;

    let cancelled = false;
    async function loadLessonPlansForToday() {
      try {
        setLoadingLessonPlansToday(true);
        const today = new Date().toISOString().split('T')[0];
        const response = await api.getLessonPlansForDate(today);
        const result = response?.data || response;
        const plans = Array.isArray(result?.lessonPlans) ? result.lessonPlans : (Array.isArray(result) ? result : []);
        if (!cancelled) setLessonPlansToday(plans);
      } catch (err) {
        console.warn('Failed to load lesson plans for HM live period:', err);
        if (!cancelled) setLessonPlansToday([]);
      } finally {
        if (!cancelled) setLoadingLessonPlansToday(false);
      }
    }

    loadLessonPlansForToday();
    return () => { cancelled = true; };
  }, [currentPeriod, selectedPeriod, lessonPlansToday]);

  const normalizeKeyPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  const normalizeSubjectKey = (value) => {
    const s = normalizeKeyPart(value).replace(/[^a-z0-9]/g, '');
    if (!s) return '';
    if (s === 'eng' || s === 'english' || s === 'engg' || s === 'englishg' || s === 'englishgrammar') return 'english';
    if (s === 'mal' || s === 'malayalam') return 'malayalam';
    if (s === 'math' || s === 'maths' || s === 'mathematics') return 'maths';
    return s;
  };

  const buildLiveKey = (row) => {
    const period = String(row?.period || '').replace(/^Period\s*/i, '').trim();
    const cls = normalizeKeyPart(row?.class);
    const subj = normalizeSubjectKey(row?.subject);
    return `${period}|${cls}|${subj}`;
  };

  const plansByLiveKey = useMemo(() => {
    const map = new Map();
    (Array.isArray(lessonPlansToday) ? lessonPlansToday : []).forEach((p) => {
      const row = {
        period: p?.selectedPeriod || p?.period,
        class: p?.class,
        subject: p?.subject
      };
      map.set(buildLiveKey(row), p);
    });
    return map;
  }, [lessonPlansToday]);

  const getDisplayChapter = (row, matchingPlan) =>
    row?.chapterName || row?.chapter || (matchingPlan && matchingPlan.chapter) || '';

  const getDisplaySessionNo = (row, matchingPlan) =>
    row?.sessionNo || row?.sessionNumber || row?.session || (matchingPlan && (matchingPlan.session || matchingPlan.sessionNo || matchingPlan.sessionNumber)) || '';

  const getDisplayTeacher = (row) => row?.teacherName || row?.teacher || row?.teacherEmail || '';

  const getPeriodTimeLabel = (periodNumber) => {
    const p = Number(periodNumber);
    if (!p) return '';

    const today = new Date();
    const isFriday = today.getDay() === 5;

    let selectedPeriodTimes = null;
    if (isFriday && memoizedSettings?.periodTimesFriday && Array.isArray(memoizedSettings.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesFriday;
    } else if (memoizedSettings?.periodTimesWeekday && Array.isArray(memoizedSettings.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesWeekday;
    } else if (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length) {
      selectedPeriodTimes = memoizedSettings.periodTimes;
    }

    const fromSettings = selectedPeriodTimes
      ? selectedPeriodTimes.find(x => Number(x?.period) === p)
      : null;
    if (fromSettings?.start && fromSettings?.end) return `${fromSettings.start} - ${fromSettings.end}`;

    const fallback = {
      1: '08:50 - 09:35',
      2: '09:35 - 10:20',
      3: '10:30 - 11:15',
      4: '11:15 - 12:00',
      5: '12:00 - 12:45',
      6: '13:15 - 14:00',
      7: '14:00 - 14:40',
      8: '14:45 - 15:25'
    };
    return fallback[p] || '';
  };

  const lateSubmissions =
    dailyReportsData?.stats?.lateSubmissions ??
    dailyReportsData?.stats?.late ??
    dailyReportsData?.stats?.lateCount ??
    0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-gray-800 dark:text-gray-100" />
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">Headmaster</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Live monitoring • {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}
              {` • Live Period: ${currentPeriod || '—'}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center border transition-colors ${
                autoRefresh
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
              }`}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
            </button>
            <button
              onClick={() => setActiveView('daily-oversight')}
              className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center hover:bg-gray-800 dark:hover:bg-gray-600 border border-transparent"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Detailed View
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Activity Monitor */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📊 Live Class Schedule <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <span className="text-xs text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        
        {/* Live Period - Class-wise View Only */}
        {(() => {
          const focusPeriod = focusedPeriod || 1;
          const maxPeriodFromReports = Math.max(
            1,
            ...(dailyReportsData?.reports || [])
              .map(r => Number(r?.period || 0))
              .filter(n => Number.isFinite(n) && n > 0)
          );
          const maxPeriod = Number.isFinite(maxPeriodFromReports) && maxPeriodFromReports > 0 ? maxPeriodFromReports : 8;

          const periodRows = (dailyReportsData?.reports || [])
            .filter(r => String(r?.period || '').trim() === String(focusPeriod))
            .sort((a, b) => {
              const classA = String(a?.class || '');
              const classB = String(b?.class || '');
              const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
              const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
              if (numA !== numB) return numA - numB;
              return classA.localeCompare(classB);
            });

          return (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    📊 Period {focusPeriod}
                    {getPeriodTimeLabel(focusPeriod) && (
                      <span className="text-base font-normal text-blue-600 dark:text-blue-400 ml-2">
                        {getPeriodTimeLabel(focusPeriod)}
                      </span>
                    )}
                    {currentPeriod === focusPeriod && (
                      <span className="ml-3 text-sm bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                        LIVE
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} • Last updated: {lastRefresh.toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedPeriodPinned(true);
                        setFocusedPeriod(p => Math.max(1, Number(p || 1) - 1));
                      }}
                      disabled={focusPeriod <= 1}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                        focusPeriod <= 1
                          ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Previous period"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedPeriodPinned(true);
                        setFocusedPeriod(p => Math.min(maxPeriod, Number(p || 1) + 1));
                      }}
                      disabled={focusPeriod >= maxPeriod}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                        focusPeriod >= maxPeriod
                          ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Next period"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  {loadingLessonPlansToday && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Loading lesson plans…</div>
                  )}
                </div>
              </div>

              {dailyReportsData.reports.length === 0 && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">No Timetable Data for Today</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        The system cannot find any timetable periods scheduled for today ({new Date().toLocaleDateString('en-US', {weekday: 'long'})}). 
                        Please ensure:
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc space-y-1">
                        <li>Timetable data is uploaded in the Timetable sheet</li>
                        <li>Today's day name matches the timetable day entries</li>
                        <li>Period numbers are correctly assigned (1-8)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {periodRows.length === 0 && dailyReportsData.reports.length > 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No classes scheduled for Period {focusPeriod} today.</p>
                  {!currentPeriod && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Currently outside school hours.
                    </p>
                  )}
                </div>
              ) : periodRows.length > 0 ? (
                <div className="space-y-2">
                  {periodRows.map((row, idx) => {
                    const matchingPlan = plansByLiveKey.get(buildLiveKey(row)) || null;
                    const chapter = getDisplayChapter(row, matchingPlan);
                    const sessionNo = getDisplaySessionNo(row, matchingPlan);
                    const teacher = getDisplayTeacher(row);
                    const subject = row?.subject || '';
                    const cls = row?.class || '';
                    const isSubmitted = row?.submitted || false;
                    const isSubstitution = !!row?.isSubstitution;

                    return (
                      <div
                        key={`${buildLiveKey(row)}|${idx}`}
                        onClick={() => {
                          if (matchingPlan) {
                            setSelectedLessonPlan(matchingPlan);
                            setShowLessonPlanModal(true);
                          }
                        }}
                        className={`p-3 md:p-4 rounded-lg border transition-all ${
                          matchingPlan ? 'cursor-pointer hover:shadow-md' : ''
                        } ${
                          isSubmitted
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40'
                        } ${
                          isSubstitution
                            ? 'ring-2 ring-blue-400/60 dark:ring-blue-500/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                            : ''
                        }`}
                      >
                        {/* Mobile: Vertical card layout */}
                        <div className="flex md:hidden flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{cls}</span>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                isSubmitted
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                              }`}
                            >
                              {isSubmitted ? '✓' : '○'}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-400">{subject}</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">{teacher || '—'}</div>
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{chapter || '—'}</span>
                            <span className="text-purple-700 dark:text-purple-400 font-medium">
                              {sessionNo ? `S${sessionNo}` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Desktop: Horizontal grid layout */}
                        <div className="hidden md:grid grid-cols-6 gap-4 items-center text-sm">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{cls}</div>
                          <div className="text-gray-700 dark:text-gray-300">{teacher || '—'}</div>
                          <div className="font-medium text-blue-700 dark:text-blue-400">{subject}</div>
                          <div className="text-gray-700 dark:text-gray-300">{chapter || '—'}</div>
                          <div className="text-purple-700 dark:text-purple-400 font-medium">
                            {sessionNo ? `Session ${sessionNo}` : '—'}
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                isSubmitted
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                              }`}
                            >
                              {isSubmitted ? '✓ Reported' : '○ Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          );
        })()}
      </div>

      {/* Today's Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dailyReportsData.stats.submitted || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Submitted</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dailyReportsData.stats.pending || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{lateSubmissions}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Late</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {dailyReportsData.stats.totalPeriods > 0 ? Math.round((dailyReportsData.stats.submitted / dailyReportsData.stats.totalPeriods) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completion</div>
          </div>
        </div>
      </div>

      {/* Period Detail Modal */}
      {selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPeriod(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="text-xl font-bold text-white">
                Period {selectedPeriod}{getPeriodTimeLabel(selectedPeriod) ? ` (${getPeriodTimeLabel(selectedPeriod)})` : ''} - Class Schedule
              </h2>
              <button 
                onClick={() => setSelectedPeriod(null)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {(() => {
                const periodClasses = dailyReportsData.reports
                  .filter(r => parseInt(r.period) === selectedPeriod)
                  .sort((a, b) => {
                    const classA = String(a.class || '');
                    const classB = String(b.class || '');
                    const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
                    const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
                    if (numA !== numB) return numA - numB;
                    return classA.localeCompare(classB);
                  });
                
                if (periodClasses.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-3">
                        <Calendar className="h-16 w-16 mx-auto" />
                      </div>
                      <p className="text-gray-500 text-lg">No classes scheduled for Period {selectedPeriod}</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-blue-900">Period {selectedPeriod} Overview</h3>
                          <p className="text-sm text-blue-700">{periodClasses.length} classes running</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round((periodClasses.filter(c => c.submitted).length / periodClasses.length) * 100)}%
                          </div>
                          <div className="text-xs text-blue-700">Reports Submitted</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {periodClasses.map((classData, idx) => (
                        <div 
                          key={idx}
                          className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                            classData.submitted 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-orange-300 bg-orange-50'
                          } ${
                            classData?.isSubstitution
                              ? 'ring-2 ring-blue-400/60 dark:ring-blue-500/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                              : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{classData.class}</h4>
                              <p className="text-sm font-medium text-blue-600">{classData.subject}</p>
                              {(() => {
                                const matchingPlan = plansByLiveKey.get(buildLiveKey({
                                  period: selectedPeriod,
                                  class: classData?.class,
                                  subject: classData?.subject
                                })) || null;
                                const chapter = getDisplayChapter(classData, matchingPlan);
                                const sessionNo = getDisplaySessionNo(classData, matchingPlan);
                                return (
                                  <div className="text-xs text-gray-700 mt-1">
                                    <span className="font-medium">Chapter:</span> {chapter || '—'}
                                    {sessionNo ? <span className="text-purple-700"> • Session {sessionNo}</span> : null}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              classData.submitted 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-orange-200 text-orange-800'
                            }`}>
                              {classData.submitted ? '✓ Reported' : '○ Pending'}
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <User className="h-4 w-4" />
                              <span className="font-medium">{getDisplayTeacher(classData) || '—'}</span>
                            </div>
                            {classData.isSubstitution && (
                              <div className="mt-2 text-xs bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-yellow-800">
                                🔄 Substitution Class
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedPeriod(null)}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Plan Details Modal */}
      {showLessonPlanModal && selectedLessonPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowLessonPlanModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-blue-600">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Lesson Plan Details
                </h2>
                <p className="text-sm text-blue-100 mt-1">
                  {selectedLessonPlan.class} • {selectedLessonPlan.subject} • Chapter: {selectedLessonPlan.chapter} • Session {selectedLessonPlan.session || selectedLessonPlan.sessionNo}
                </p>
              </div>
              <button 
                onClick={() => setShowLessonPlanModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)] space-y-6">
              {/* Teacher Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Teacher</p>
                    <p className="text-blue-700 dark:text-blue-300">{selectedLessonPlan.teacherName || selectedLessonPlan.teacher || selectedLessonPlan.teacherEmail}</p>
                  </div>
                </div>
              </div>

              {/* Learning Objectives */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Learning Objectives</h3>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900/40 rounded-lg p-4">
                  {selectedLessonPlan.objectives || selectedLessonPlan.learningObjectives ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedLessonPlan.objectives || selectedLessonPlan.learningObjectives}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No learning objectives specified</p>
                  )}
                </div>
              </div>

              {/* Teaching Methods / Activities */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Teaching Methods</h3>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-lg p-4">
                  {selectedLessonPlan.teachingMethods || selectedLessonPlan.activities ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedLessonPlan.teachingMethods || selectedLessonPlan.activities}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No teaching methods specified</p>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {selectedLessonPlan.status && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-3 py-1 rounded-full font-medium ${
                    selectedLessonPlan.status === 'Approved' || selectedLessonPlan.status === 'Ready'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : selectedLessonPlan.status === 'Pending Review'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                  }`}>
                    Status: {selectedLessonPlan.status}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setShowLessonPlanModal(false)}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Schemes</p>
              <p className="text-2xl font-bold text-gray-900">{insights.planCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Lessons</p>
              <p className="text-2xl font-bold text-gray-900">{insights.lessonCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{insights.teacherCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Classes</p>
              <p className="text-2xl font-bold text-gray-900">{insights.classCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Command Center */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveView('scheme-approvals')}
            className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <BookCheck className="h-6 w-6 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-900">Approve Schemes</span>
            {insights.planCount > 0 && (
              <span className="mt-1 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">{insights.planCount}</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveView('lesson-approvals')}
            className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <FileCheck className="h-6 w-6 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Approve Lessons</span>
            {insights.lessonCount > 0 && (
              <span className="mt-1 px-2 py-0.5 text-xs bg-green-600 text-white rounded-full">{insights.lessonCount}</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveView('substitution')}
            className="flex flex-col items-center p-4 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-6 w-6 text-amber-600 mb-2" />
            <span className="text-sm font-medium text-amber-900">Substitutions</span>
          </button>
          
          <button 
            onClick={() => setActiveView('daily-oversight')}
            className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <BarChart2 className="h-6 w-6 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-900">Analytics</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Completion Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">🎯 Completion Distribution <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <div className="space-y-4">
            {(() => {
              const submittedReports = dailyReportsData.reports.filter(r => r.submitted && r.completionPercentage != null);
              const excellent = submittedReports.filter(r => r.completionPercentage >= 80).length;
              const good = submittedReports.filter(r => r.completionPercentage >= 60 && r.completionPercentage < 80).length;
              const moderate = submittedReports.filter(r => r.completionPercentage >= 40 && r.completionPercentage < 60).length;
              const poor = submittedReports.filter(r => r.completionPercentage < 40).length;
              const total = submittedReports.length || 1;
              
              const ranges = [
                { label: 'Excellent (80-100%)', count: excellent, color: 'bg-green-500', textColor: 'text-green-700' },
                { label: 'Good (60-79%)', count: good, color: 'bg-blue-500', textColor: 'text-blue-700' },
                { label: 'Moderate (40-59%)', count: moderate, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
                { label: 'Poor (<40%)', count: poor, color: 'bg-red-500', textColor: 'text-red-700' }
              ];
              
              return (
                <>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    {ranges.map((range, idx) => {
                      const percent = Math.round((range.count / total) * 100);
                      return percent > 0 ? (
                        <div
                          key={idx}
                          className={range.color}
                          style={{ width: `${percent}%` }}
                          title={`${range.label}: ${range.count}`}
                        />
                      ) : null;
                    })}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {ranges.map((range, idx) => {
                      const percent = Math.round((range.count / total) * 100);
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${range.color}`}></div>
                            <span className="text-sm text-gray-700">{range.label.split(' ')[0]}</span>
                          </div>
                          <div className={`text-sm font-bold ${range.textColor}`}>
                            {range.count} ({percent}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
  // Scheme Approvals View - extracted to separate file
  const SchemeApprovalsViewWrapper = () => {
    return <SchemeApprovalsView stripStdPrefix={stripStdPrefix} openLessonView={openLessonView} withSubmit={withSubmit} />;
  };

  // Lesson Approvals View
  const LessonApprovalsView = () => {
    const [allLessons, setAllLessons] = useState([]); // Store all lessons loaded once
    const [loading, setLoading] = useState(true); // Add loading state
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [groupByClassChapter, setGroupByClassChapter] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newLessonsCount, setNewLessonsCount] = useState(0);
    const [showNewLessonsNotif, setShowNewLessonsNotif] = useState(false);
    const [showTeacherStats, setShowTeacherStats] = useState(false);
    // Removed: timetable date view UI
    const [rowSubmitting, setRowSubmitting] = useState({});
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleLesson, setRescheduleLesson] = useState(null);
    const [newDate, setNewDate] = useState('');
    const [newPeriod, setNewPeriod] = useState('');
    const [rescheduleAvailablePeriods, setRescheduleAvailablePeriods] = useState([]);
    const [loadingPeriods, setLoadingPeriods] = useState(false);
    const [reschedulePlannedPeriods, setReschedulePlannedPeriods] = useState([]);
    const [showOtherClassPeriods, setShowOtherClassPeriods] = useState(false);
    const [showBulkRescheduleModal, setShowBulkRescheduleModal] = useState(false);
    const [bulkRescheduleChapter, setBulkRescheduleChapter] = useState(null);
    const [bulkRescheduleDates, setBulkRescheduleDates] = useState([]);
    const [bulkTimetables, setBulkTimetables] = useState({});
    const [bulkPlannedPeriods, setBulkPlannedPeriods] = useState({});
    const [showOtherClassPeriodsBulk, setShowOtherClassPeriodsBulk] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      subject: '',
      status: 'Pending Review', // Default to pending for approvals
      dateFrom: '',
      dateTo: ''
    });
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [autoFillLoading, setAutoFillLoading] = useState(false);
    // View-only: open a modal showing all sessions in the same chapter
    const viewChapterSessions = (baseLesson) => {
      if (!baseLesson) return;
      const keyScheme = baseLesson.schemeId || '';
      const keyChapter = baseLesson.chapter || '';
      // Prefer schemeId + chapter; fallback to class+subject+chapter
      const lessons = filteredLessons.filter(l => {
        const sameScheme = keyScheme && String(l.schemeId || '') === String(keyScheme);
        const sameChapter = String(l.chapter || '') === String(keyChapter);
        const fallbackMatch = !keyScheme && sameChapter && String(l.class||'')===String(baseLesson.class||'') && String(l.subject||'')===String(baseLesson.subject||'');
        return (sameScheme && sameChapter) || fallbackMatch;
      }).sort((a,b) => parseInt(a.session||0) - parseInt(b.session||0));

      setSelectedChapter({
        schemeId: keyScheme,
        chapter: keyChapter,
        class: baseLesson.class,
        subject: baseLesson.subject,
        teacherName: baseLesson.teacherName,
        lessons
      });
      setShowChapterModal(true);
    };

    const closeChapterModal = () => {
      setShowChapterModal(false);
      setSelectedChapter(null);
    };

    const bulkUpdateChapter = async (status) => {
      if (!selectedChapter) return;
      const pendingCount = selectedChapter.lessons.filter(l => l.status === 'Pending Review').length;
      if (pendingCount === 0) { alert('No pending sessions to update.'); return; }
      let remarks = '';
      if (status === 'Needs Rework' || status === 'Rejected') {
        remarks = window.prompt(`Enter remarks for ${status} (required):`, '') || '';
        if (!remarks.trim()) { alert('Remarks are required.'); return; }
      }
      if (!window.confirm(`${status} all ${pendingCount} pending session(s) in this chapter?`)) return;
      try {
        setBulkSubmitting(true);
        const res = await api.chapterBulkUpdateLessonPlanStatus(
          selectedChapter.schemeId,
          selectedChapter.chapter,
          status,
          remarks,
          (memoizedUser && memoizedUser.email) || ''
        );
        const result = res?.data || res;
        if (result && result.success === false && result.error) {
          alert(result.error);
          return;
        }
        // Update modal list locally
        setSelectedChapter(prev => prev ? ({
          ...prev,
          lessons: prev.lessons.map(l => l.status === 'Pending Review' ? { ...l, status } : l)
        }) : prev);
        // Refresh table below
        await refreshApprovals();
      } catch (e) {
        console.error('Bulk update failed', e);
        alert(e?.message || 'Bulk update failed');
      } finally {
        setBulkSubmitting(false);
      }
    };

    // Ensure sidebar state doesn't auto-toggle here to avoid flicker on mobile

    // Get unique values for dropdowns - optimized with useMemo
    const uniqueTeachers = useMemo(() => {
      return [...new Set(allLessons.map(l => l.teacherName).filter(Boolean))].sort();
    }, [allLessons]);
    
    const uniqueClasses = useMemo(() => {
      return [...new Set(allLessons.map(l => l.class).filter(Boolean))].sort();
    }, [allLessons]);
    
    const uniqueSubjects = useMemo(() => {
      return [...new Set(allLessons.map(l => l.subject).filter(Boolean))].sort();
    }, [allLessons]);

    // Load all lessons ONCE on component mount
    useEffect(() => {
      async function fetchAllLessons() {
        setLoading(true);
        try {
          const data = await api.getPendingLessonReviews('', '', '', ''); // Get all lessons
          let lessons = Array.isArray(data) ? data : [];
          
          // Sort by selectedDate in descending order (latest first)
          lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
          
          setAllLessons(lessons);
        } catch (err) {
          console.error('Error fetching lessons:', err);
          setAllLessons([]);
        } finally {
          setLoading(false);
        }
      }
      fetchAllLessons();
    }, []); // Empty dependency - load only once

    // Auto-refresh every 2 minutes to check for new lessons
    useEffect(() => {
      const interval = setInterval(async () => {
        try {
          const data = await api.getPendingLessonReviews('', '', '', '', { noCache: true });
          let lessons = Array.isArray(data) ? data : [];
          lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
          
          // Check if there are new lessons
          const currentCount = allLessons.length;
          const newCount = lessons.length;
          if (newCount > currentCount) {
            const diff = newCount - currentCount;
            setNewLessonsCount(diff);
            setShowNewLessonsNotif(true);
            // Auto-hide notification after 10 seconds
            setTimeout(() => setShowNewLessonsNotif(false), 10000);
          }
          
          setAllLessons(lessons);
        } catch (err) {
          console.error('Auto-refresh error:', err);
        }
      }, 120000); // 2 minutes
      
      return () => clearInterval(interval);
    }, [allLessons.length]);

    // CLIENT-SIDE FILTERING - no API calls
    const filteredLessons = useMemo(() => {
      return allLessons.filter(lesson => {
        // Filter by teacher (from simple dropdown)
        if (selectedTeacher && lesson.teacherName !== selectedTeacher) return false;
        
        // Filter by search query (chapter or teacher name)
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchesChapter = String(lesson.chapter || '').toLowerCase().includes(q);
          const matchesTeacher = String(lesson.teacherName || '').toLowerCase().includes(q);
          const matchesSubject = String(lesson.subject || '').toLowerCase().includes(q);
          if (!matchesChapter && !matchesTeacher && !matchesSubject) return false;
        }
        
        // Filter by advanced filters (when showFilters is true)
        if (filters.teacher && lesson.teacherName !== filters.teacher) return false;
        if (filters.class && lesson.class !== filters.class) return false;
        if (filters.subject && lesson.subject !== filters.subject) return false;
        if (filters.status && filters.status !== 'All') {
          if (lesson.status !== filters.status) return false;
        }
        if (filters.dateFrom && lesson.selectedDate < filters.dateFrom) return false;
        if (filters.dateTo && lesson.selectedDate > filters.dateTo) return false;
        
        return true;
      });
    }, [allLessons, selectedTeacher, searchQuery, filters]);

    // CLIENT-SIDE GROUPING - Compute groups from filteredLessons
    const computedChapterGroups = useMemo(() => {
      const groupMap = {};
      filteredLessons.forEach(lesson => {
        const key = `${lesson.class}|${lesson.subject}|${lesson.chapter}|${lesson.teacherName}`;
        if (!groupMap[key]) {
          groupMap[key] = {
            key,
            class: lesson.class,
            subject: lesson.subject,
            chapter: lesson.chapter,
            teacherName: lesson.teacherName,
            schemeId: lesson.schemeId,
            lessons: [],
            counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
          };
        }
        groupMap[key].lessons.push(lesson);
        if (lesson.status === 'Pending Review') groupMap[key].counts.pending++;
        if (lesson.status === 'Ready') groupMap[key].counts.ready++;
        if (lesson.status === 'Needs Rework') groupMap[key].counts.needsRework++;
        if (lesson.status === 'Rejected') groupMap[key].counts.rejected++;
      });
      return Object.values(groupMap).sort((a, b) => String(a.chapter || '').localeCompare(String(b.chapter || '')));
    }, [filteredLessons]);

    const computedClassGroups = useMemo(() => {
      const classMap = {};
      filteredLessons.forEach(lesson => {
        const cls = lesson.class;
        if (!classMap[cls]) {
          classMap[cls] = {
            class: cls,
            subgroups: [],
            counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
          };
        }
        const subKey = `${lesson.subject}|${lesson.chapter}|${lesson.teacherName}`;
        let subgroup = classMap[cls].subgroups.find(sg => sg.key === subKey);
        if (!subgroup) {
          subgroup = {
            key: subKey,
            subject: lesson.subject,
            chapter: lesson.chapter,
            teacherName: lesson.teacherName,
            lessons: [],
            counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
          };
          classMap[cls].subgroups.push(subgroup);
        }
        subgroup.lessons.push(lesson);
        if (lesson.status === 'Pending Review') {
          subgroup.counts.pending++;
          classMap[cls].counts.pending++;
        }
        if (lesson.status === 'Ready') {
          subgroup.counts.ready++;
          classMap[cls].counts.ready++;
        }
        if (lesson.status === 'Needs Rework') {
          subgroup.counts.needsRework++;
          classMap[cls].counts.needsRework++;
        }
        if (lesson.status === 'Rejected') {
          subgroup.counts.rejected++;
          classMap[cls].counts.rejected++;
        }
      });
      return Object.values(classMap).sort((a, b) => {
        const classA = String(a.class || '');
        const classB = String(b.class || '');
        const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
        const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
        if (numA !== numB) return numA - numB;
        return classA.localeCompare(classB);
      });
    }, [filteredLessons]);

    const computedClassChapterGroups = useMemo(() => {
      const groupMap = {};
      filteredLessons.forEach(lesson => {
        const cls = lesson.class || 'Unknown Class';
        const chapter = lesson.chapter || 'Unknown Chapter';
        const subject = lesson.subject || 'Unknown Subject';
        const key = `${cls}|${subject}|${chapter}`;
        if (!groupMap[key]) {
          groupMap[key] = {
            key,
            class: cls,
            subject,
            chapter,
            teacherNames: new Set(),
            schemeId: lesson.schemeId,
            lessons: [],
            counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
          };
        }
        groupMap[key].teacherNames.add(lesson.teacherName || '');
        groupMap[key].lessons.push(lesson);
        if (lesson.status === 'Pending Review') groupMap[key].counts.pending++;
        if (lesson.status === 'Ready') groupMap[key].counts.ready++;
        if (lesson.status === 'Needs Rework') groupMap[key].counts.needsRework++;
        if (lesson.status === 'Rejected') groupMap[key].counts.rejected++;
      });
      return Object.values(groupMap)
        .map(g => ({ ...g, teacherNames: Array.from(g.teacherNames).filter(Boolean) }))
        .sort((a, b) => String(a.class || '').localeCompare(String(b.class || '')) || String(a.chapter || '').localeCompare(String(b.chapter || '')));
    }, [filteredLessons]);

    // Teacher Statistics - computed from allLessons (not filtered)
    const teacherStats = useMemo(() => {
      const statsMap = {};
      allLessons.forEach(lesson => {
        const teacher = lesson.teacherName || 'Unknown';
        if (!statsMap[teacher]) {
          statsMap[teacher] = {
            teacher,
            pending: 0,
            approved: 0,
            needsRework: 0,
            rejected: 0,
            total: 0
          };
        }
        statsMap[teacher].total++;
        if (lesson.status === 'Pending Review') statsMap[teacher].pending++;
        if (lesson.status === 'Ready') statsMap[teacher].approved++;
        if (lesson.status === 'Needs Rework') statsMap[teacher].needsRework++;
        if (lesson.status === 'Rejected') statsMap[teacher].rejected++;
      });
      return Object.values(statsMap)
        .sort((a, b) => b.pending - a.pending); // Sort by pending count (most pending first)
    }, [allLessons]);

    const handleApproveLesson = async (lpId, status) => {
      try {
        console.debug('🔵 Single approval - lpId:', lpId, 'status:', status);
        setRowSubmitting(prev => ({ ...prev, [lpId]: true }));
        const requesterEmail = memoizedUser?.email || '';
        const response = await api.updateLessonPlanStatus(lpId, status, '', requesterEmail);
        console.debug('🔵 Single approval response:', response);
        
        // Check for error in response
        const result = response.data || response;
        if (result.error) {
          // Show error to user
          alert(result.error);
          setRowSubmitting(prev => ({ ...prev, [lpId]: false }));
          return;
        }
        
        await withSubmit('Updating lesson status...', async () => {
          // Already called above, just for UI feedback
        });
        
        setAllLessons(prev => {
          return prev
            .map(lesson => lesson.lpId === lpId ? { ...lesson, status } : lesson)
            .filter(lesson => {
              // If current filter is explicitly pending review, remove non-pending lessons
              if (filters.status === 'Pending Review') {
                return lesson.status === 'Pending Review';
              }
              return true;
            });
        });
        // Broadcast status update so other views can reload
        window.dispatchEvent(new CustomEvent('lesson-plan-status-updated', { detail: { lpId, status } }));
        // Clear caches explicitly (defensive)
        api.clearCache('getPendingLessonReviews');
        api.clearCache('getTeacherLessonPlans');
        api.clearCache('getLessonPlan');
        // Immediate refetch (cache-busting)
        const teacherFilter = filters.teacher === '' ? '' : filters.teacher;
        const classFilter = filters.class === '' ? '' : filters.class;
        const subjectFilter = filters.subject === '' ? '' : filters.subject;
        const statusFilter = filters.status === '' || filters.status === 'All' ? '' : filters.status;
        const fresh = await api.getPendingLessonReviews(teacherFilter, classFilter, subjectFilter, statusFilter, { noCache: true });
        // Apply date filters again (reuse logic)
        let lessons = Array.isArray(fresh) ? fresh : [];
        const fromStr = filters.dateFrom || '';
        const toStr = filters.dateTo || '';
        const singleDay = fromStr && toStr && fromStr === toStr;
        const normalizeDate = (raw) => {
          if (!raw) return '';
          if (typeof raw === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.split('T')[0];
            const dm = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/); if (dm) return `${dm[3]}-${dm[2]}-${dm[1]}`;
            const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
          }
          try { const d = new Date(raw); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; } catch (e) {}
          return '';
        };
        if (fromStr || toStr) {
          lessons = lessons.filter(lesson => {
            const raw = lesson.selectedDate || lesson.plannedDate || lesson.date || '';
            const dateStr = normalizeDate(raw);
            if (!dateStr) return false;
            if (singleDay) return dateStr === fromStr;
            if (fromStr && dateStr < fromStr) return false;
            if (toStr && dateStr > toStr) return false;
            return true;
          });
        }
        lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
        // If still filtering by Pending Review, drop updated item
        if (filters.status === 'Pending Review') {
          lessons = lessons.filter(l => l.status === 'Pending Review');
        }
        setAllLessons(lessons);
        // If grouped view is active, refresh groups to reflect changes
        if (groupByChapter || groupByClass || groupByClassChapter) {
          await refreshApprovals();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setRowSubmitting(prev => ({ ...prev, [lpId]: false }));
      }
    };

    // Manual refresh (cache-busting, does not change filters)
    const refreshApprovals = async () => {
      setRefreshing(true);
      try {
        api.clearCache('getPendingLessonReviews');
        const data = await api.getPendingLessonReviews('', '', '', '', { noCache: true });
        let lessons = Array.isArray(data) ? data : [];
        lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
        setAllLessons(lessons);
        setShowNewLessonsNotif(false);
        setNewLessonsCount(0);
      } catch (e) {
        console.warn('Manual refresh failed:', e);
      } finally {
        setRefreshing(false);
      }
    };

    // Export to Excel
    const exportToExcel = () => {
      if (filteredLessons.length === 0) {
        alert('No data to export');
        return;
      }
      
      // Prepare CSV data
      const headers = ['Teacher', 'Class', 'Subject', 'Chapter', 'Session', 'Date', 'Period', 'Status', 'Learning Objectives'];
      const rows = filteredLessons.map(l => [
        l.teacherName || '',
        l.class || '',
        l.subject || '',
        l.chapter || '',
        l.session || '',
        l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN') : '',
        l.selectedPeriod || '',
        l.status || '',
        (l.learningObjectives || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `lesson_approvals_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // Batch selection, chapter grouping, and modal approval removed per request

    // Show loading spinner while fetching data
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading lesson plans...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-full">
        {/* New Lessons Notification */}
        {showNewLessonsNotif && newLessonsCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">
                {newLessonsCount} new lesson plan{newLessonsCount > 1 ? 's' : ''} submitted!
              </span>
            </div>
            <button
              onClick={() => setShowNewLessonsNotif(false)}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lesson Plan Approvals</h1>
          <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
            <button
              onClick={refreshApprovals}
              disabled={refreshing}
              className={`flex-1 sm:flex-initial bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
              title="Force refresh (bypass cache)"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
              <span className="sm:hidden">{refreshing ? '...' : 'Refresh'}</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex-1 sm:flex-initial bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-green-700 text-sm"
              title="Export to Excel (CSV)"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">CSV</span>
            </button>
            <button 
              onClick={() => {
                setShowFilters(!showFilters);
              }}
              className="flex-1 sm:flex-initial bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-blue-700 text-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
              <span className="sm:hidden">{showFilters ? 'Hide' : 'Filters'}</span>
            </button>
          </div>
        </div>

        {/* Teacher Statistics Dashboard */}
        {showTeacherStats && teacherStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-purple-600" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900">Teacher Statistics</h3>
                <span className="text-xs text-gray-500">({teacherStats.length} teachers)</span>
              </div>
              <button
                onClick={() => setShowTeacherStats(false)}
                className="text-gray-400 hover:text-gray-600"
                title="Hide statistics"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Teacher</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Pending</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Approved</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Rework</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {teacherStats.map((stat, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900 font-medium">{stat.teacher}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          stat.pending > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {stat.pending}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {stat.approved}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          stat.needsRework > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {stat.needsRework}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 font-medium">{stat.total}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            setSelectedTeacher(stat.teacher);
                            setFilters(prev => ({ ...prev, teacher: stat.teacher }));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>Sorted by pending count (highest first)</span>
                <span>Click "View" to filter by teacher</span>
              </div>
            </div>
          </div>
        )}

        {!showTeacherStats && (
          <button
            onClick={() => setShowTeacherStats(true)}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <BarChart2 className="h-4 w-4" />
            Show Teacher Statistics
          </button>
        )}

        {/* Simple Filter Bar - Always Visible */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
            {/* Quick Search */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search chapter, teacher, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[200px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Teacher Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Teacher:</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[150px]"
              >
                <option value="">All Teachers</option>
                {uniqueTeachers.map(teacher => (
                  <option key={teacher} value={teacher}>{teacher}</option>
                ))}
              </select>
            </div>

            {/* Group Toggle Buttons */}
            <div className="flex gap-2 w-full md:w-auto md:ml-4">
              <button
                onClick={() => {
                  const newValue = !groupByClass;
                  setGroupByClass(newValue);
                  if (newValue) { setGroupByChapter(false); setGroupByClassChapter(false); }
                }}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                  groupByClass
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-3 w-3 md:h-4 md:w-4 inline mr-1" />
                <span className="hidden sm:inline">Class-wise</span>
                <span className="sm:hidden">Class</span>
              </button>
              <button
                onClick={() => {
                  const newValue = !groupByChapter;
                  setGroupByChapter(newValue);
                  if (newValue) { setGroupByClass(false); setGroupByClassChapter(false); }
                }}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                  groupByChapter
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <BookOpen className="h-3 w-3 md:h-4 md:w-4 inline mr-1" />
                <span className="hidden sm:inline">Chapter-wise</span>
                <span className="sm:hidden">Chapter</span>
              </button>
              <button
                onClick={() => {
                  const newValue = !groupByClassChapter;
                  setGroupByClassChapter(newValue);
                  if (newValue) { setGroupByClass(false); setGroupByChapter(false); }
                }}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                  groupByClassChapter
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="hidden sm:inline">Class + Chapter</span>
                <span className="sm:hidden">C+Ch</span>
              </button>
            </div>

            {/* Active Filter Badge */}
            {selectedTeacher && (
              <span className="px-2 md:px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                Teacher: {selectedTeacher}
              </span>
            )}
            {groupByClass && (
              <span className="px-2 md:px-3 py-1 text-xs bg-teal-100 text-teal-800 rounded-full font-medium">
                Grouped by Class
              </span>
            )}
            {groupByChapter && (
              <span className="px-2 md:px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
                Grouped by Chapter
              </span>
            )}
            {groupByClassChapter && (
              <span className="px-2 md:px-3 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full font-medium">
                Grouped by Class + Chapter
              </span>
            )}
          </div>
        </div>


        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Lesson Plans</h3>
            <div className="space-y-4">
              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Pending Review' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Pending Review' && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ⏳ Pending Review
                </button>
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Ready' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Ready' && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ✓ Approved
                </button>
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Needs Rework' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Needs Rework' && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ⚠ Needs Rework
                </button>
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: '' , dateFrom: '', dateTo: ''})}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    !filters.status && !filters.teacher && !filters.class && !filters.subject && !filters.dateFrom && !filters.dateTo
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Plans
                </button>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setFilters({ teacher: '', class: '', subject: '', status: 'Pending Review', dateFrom: today, dateTo: today });
                  }}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Pending Review' && filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo && filters.dateFrom === new Date().toISOString().split('T')[0]
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📅 Today's Pending
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(today.getDate() + 7);
                    setFilters({ 
                      teacher: '', 
                      class: '', 
                      subject: '', 
                      status: 'Pending Review', 
                      dateFrom: today.toISOString().split('T')[0], 
                      dateTo: weekFromNow.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                >
                  📆 Next 7 Days
                </button>
              </div>
              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teacher</label>
                  <select
                    value={filters.teacher}
                    onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    {uniqueTeachers.map(teacher => (
                      <option key={teacher} value={teacher}>{teacher}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                  <select
                    value={filters.class}
                    onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <select
                    value={filters.subject}
                    onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    {uniqueSubjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Pending Review">Pending Review</option>
                    <option value="Ready">Ready</option>
                    <option value="Needs Rework">Needs Rework</option>
                    <option value="Rejected">Rejected</option>
                    <option value="">All Statuses</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {!groupByChapter && !groupByClass && !groupByClassChapter && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-gray-900">
                {filters.status === 'Ready' ? 'Approved Lesson Plans' : 
                 filters.status === 'Pending Review' ? 'Pending Lesson Plans' : 'All Lesson Plans'} 
                ({filteredLessons.length})
              </h2>
              {/* Active Filter Status Display */}
              {(filters.teacher || filters.class || filters.subject || (filters.status && filters.status !== 'Pending Review') || filters.dateFrom || filters.dateTo) && (
                <div className="flex flex-wrap gap-1 text-xs">
                  {filters.teacher && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Teacher: {filters.teacher}</span>
                  )}
                  {filters.class && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Class: {filters.class}</span>
                  )}
                  {filters.subject && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Subject: {filters.subject}</span>
                  )}
                  {filters.status && filters.status !== 'Pending Review' && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded">Status: {filters.status}</span>
                  )}
                  {filters.dateFrom && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">From: {filters.dateFrom}</span>
                  )}
                  {filters.dateTo && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">To: {filters.dateTo}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredLessons.map((lesson) => (
              <div key={lesson.lpId} className="border-b border-gray-200 p-3 hover:bg-gray-50">
                {/* Header: Teacher & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm text-gray-900">{lesson.teacherName}</div>
                  {lesson.status === 'Ready' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Ready
                    </span>
                  ) : lesson.status === 'Needs Rework' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⚠ Rework
                    </span>
                  ) : lesson.status === 'Rejected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      ✗ Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      ⏳ Pending
                    </span>
                  )}
                </div>
                
                {/* Class & Subject */}
                <div className="text-xs text-gray-600 mb-1.5">
                  {stripStdPrefix(lesson.class)} • {lesson.subject}
                </div>
                
                {/* Chapter */}
                <div className="text-sm text-gray-900 font-medium mb-1.5 line-clamp-2 break-words">{lesson.chapter}</div>
                
                {/* Session, Date, Period - Compact */}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                  <span>Session {lesson.noOfSessions ? `${lesson.session}/${lesson.noOfSessions}` : lesson.session}</span>
                  <span>{lesson.selectedDate ? new Date(lesson.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                  <span>P{lesson.selectedPeriod || '-'}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100" 
                    onClick={() => openLessonView(lesson)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button 
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100" 
                    onClick={() => viewChapterSessions(lesson)}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Chapter
                  </button>
                  {lesson.status === 'Pending Review' && (
                    <>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        title="Approve"
                      >
                        {rowSubmitting[lesson.lpId] ? '...' : '✓'}
                      </button>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Needs Rework')}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className="px-2.5 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                        title="Needs Rework"
                      >
                        {rowSubmitting[lesson.lpId] ? '...' : '⚠'}
                      </button>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        title="Reject"
                      >
                        {rowSubmitting[lesson.lpId] ? '...' : '✗'}
                      </button>
                    </>
                  )}
                  {lesson.status === 'Needs Rework' && (
                    <>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        title="Approve"
                      >
                        {rowSubmitting[lesson.lpId] ? '...' : '✓'}
                      </button>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        title="Reject"
                      >
                        {rowSubmitting[lesson.lpId] ? '...' : '✗'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredLessons.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No lesson plans found
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[80px]">Teacher</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Class</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[100px]">Subject</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[150px]">Chapter</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-10">Sess</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Submit</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Plan</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-20">Status</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLessons.map((lesson) => {
                  return (
                    <tr key={lesson.lpId} className="hover:bg-gray-50">
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[80px] truncate" title={lesson.teacherName}>{lesson.teacherName}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 w-16">{stripStdPrefix(lesson.class)}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[100px] truncate" title={lesson.subject}>{lesson.subject}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[150px] truncate" title={lesson.chapter}>{lesson.chapter}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 text-center font-medium w-10">
                        {lesson.noOfSessions ? `${lesson.session}/${lesson.noOfSessions}` : lesson.session}
                      </td>
                      <td className="px-1 py-2 text-xs text-gray-600 w-16">{lesson.submittedAt ? new Date(lesson.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                      <td className="px-1 py-2 text-xs text-gray-600 w-16">
                        <div className="flex flex-col">
                          <span>{lesson.selectedDate ? new Date(lesson.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                          <span className="text-xs text-gray-500">P{lesson.selectedPeriod || '-'}</span>
                        </div>
                      </td>
                    <td className="px-1 py-2 w-20">
                      {lesson.status === 'Ready' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          ✓
                        </span>
                      ) : lesson.status === 'Needs Rework' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Rwk
                        </span>
                      ) : lesson.status === 'Rejected' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          ✗
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Pend
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-2 text-xs text-gray-500 w-24">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        <button type="button" 
                          className="text-blue-600 hover:text-blue-900 p-1" 
                          onClick={() => openLessonView(lesson)} 
                          title="View lesson details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                          <button type="button" 
                            className="text-purple-600 hover:text-purple-900 p-1" 
                            onClick={() => viewChapterSessions(lesson)} 
                            title="View all chapter sessions"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </button>
                        {lesson.status === 'Pending Review' && (
                          <>
                            <button 
                              onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                              disabled={!!rowSubmitting[lesson.lpId]}
                              className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                              title="Approve"
                            >
                              {rowSubmitting[lesson.lpId] ? '…' : '✓'}
                            </button>
                            <button 
                              onClick={() => handleApproveLesson(lesson.lpId, 'Needs Rework')}
                              disabled={!!rowSubmitting[lesson.lpId]}
                              className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                              title="Send for rework"
                            >
                              {rowSubmitting[lesson.lpId] ? '…' : '⚠'}
                            </button>
                            <button 
                              onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                              disabled={!!rowSubmitting[lesson.lpId]}
                              className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                              title="Reject"
                            >
                              {rowSubmitting[lesson.lpId] ? '…' : '✗'}
                            </button>
                          </>
                        )}
                        {lesson.status === 'Needs Rework' && (
                          <>
                            <button 
                              onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                              disabled={!!rowSubmitting[lesson.lpId]}
                              className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                              title="Approve"
                            >
                              {rowSubmitting[lesson.lpId] ? '…' : '✓'}
                            </button>
                            <button 
                              onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                              disabled={!!rowSubmitting[lesson.lpId]}
                              className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                              title="Reject"
                            >
                              {rowSubmitting[lesson.lpId] ? '…' : '✗'}
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => {
                            setRescheduleLesson(lesson);
                            setNewDate(lesson.selectedDate || lesson.date || '');
                            setNewPeriod(String(lesson.selectedPeriod || lesson.period || ''));
                            setShowOtherClassPeriods(false);
                            setRescheduleAvailablePeriods([]);
                            setReschedulePlannedPeriods([]);
                            setShowRescheduleModal(true);
                          }}
                          disabled={!!rowSubmitting[lesson.lpId]}
                          className={`text-blue-600 px-1.5 py-0.5 bg-blue-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-900'}`}
                          title="Reschedule"
                        >
                          📅
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {groupByChapter && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            {computedChapterGroups.length === 0 ? (
              <p className="text-gray-700">No lesson plans match the current filters.</p>
            ) : (
              <div className="space-y-4">
                {computedChapterGroups.map(g => {
                  const pending = g.counts?.pending || 0;
                  const approved = g.counts?.ready || 0;
                  return (
                    <div key={g.key} className="border rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm text-gray-600 truncate">{g.class} • {g.subject} • {g.teacherName}</div>
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{g.chapter}</div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                          <button
                            onClick={() => {
                              const lessons = (g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                              setSelectedChapter({ schemeId: g.schemeId || '', chapter: g.chapter, class: g.class, subject: g.subject, teacherName: g.teacherName, lessons });
                              setShowChapterModal(true);
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                            title="Open Chapter"
                          ><BookOpen className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="divide-y">
                        {(g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                          <div key={l.lpId} className="px-3 py-2 md:px-4 md:py-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              {/* Mobile: Stack info vertically */}
                              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <span className="font-medium">Session {l.session}</span>
                                  <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                  <span>P{l.selectedPeriod || '-'}</span>
                                </div>
                                <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                              </div>
                              {/* Status and Actions */}
                              <div className="flex items-center gap-2 self-start md:self-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                                {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                  <>
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                      title="Approve"
                                    >✓</button>
                                    {l.status === 'Pending Review' && (
                                      <button 
                                        onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                        disabled={!!rowSubmitting[l.lpId]}
                                        className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                        title="Needs Rework"
                                      >⚠</button>
                                    )}
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                      title="Reject"
                                    >✗</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {groupByClassChapter && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Lesson Plans (Class + Chapter)</h2>
            {computedClassChapterGroups.length === 0 ? (
              <p className="text-gray-700">No lesson plans match the current filters.</p>
            ) : (
              <div className="space-y-4">
                {computedClassChapterGroups.map(g => {
                  const pending = g.counts?.pending || 0;
                  const approved = g.counts?.ready || 0;
                  const teachersLabel = (g.teacherNames || []).length > 0 ? g.teacherNames.join(', ') : '';
                  return (
                    <div key={g.key} className="border rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm text-gray-600 truncate">{stripStdPrefix(g.class)} • {g.subject}</div>
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{g.chapter}</div>
                          {teachersLabel && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">Teachers: {teachersLabel}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                          <button
                            onClick={() => {
                              const lessons = (g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                              setSelectedChapter({ schemeId: g.schemeId || '', chapter: g.chapter, class: g.class, subject: g.subject, teacherName: teachersLabel || 'Multiple Teachers', lessons });
                              setShowChapterModal(true);
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                            title="Open Chapter"
                          ><BookOpen className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="divide-y">
                        {(g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                          <div key={l.lpId} className="px-3 py-2 md:px-4 md:py-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <span className="font-medium">Session {l.session}</span>
                                  <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                  <span>P{l.selectedPeriod || '-'}</span>
                                  {l.teacherName && <span className="text-gray-500">• {l.teacherName}</span>}
                                </div>
                                <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                              </div>
                              <div className="flex items-center gap-2 self-start md:self-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                                {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                  <>
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                      title="Approve"
                                    >✓</button>
                                    {l.status === 'Pending Review' && (
                                      <button 
                                        onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                        disabled={!!rowSubmitting[l.lpId]}
                                        className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                        title="Needs Rework"
                                      >⚠</button>
                                    )}
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                      title="Reject"
                                    >✗</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {groupByClass && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Lesson Plans (Class-wise)</h2>
            {computedClassGroups.length === 0 ? (
              <p className="text-gray-700">No lesson plans match the current filters.</p>
            ) : (
              <div className="space-y-4">
                {computedClassGroups.map(clsGroup => {
                  const totalPending = clsGroup.counts?.pending || 0;
                  const totalApproved = clsGroup.counts?.ready || 0;
                  return (
                    <div key={clsGroup.class} className="border rounded-lg">
                      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b">
                        <div>
                          <div className="text-base font-semibold text-gray-900">{stripStdPrefix(clsGroup.class)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Subject • Chapter groups</div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {totalPending}</span>
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {totalApproved}</span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {(clsGroup.subgroups || []).map(sub => {
                          const pending = sub.counts?.pending || 0;
                          const approved = sub.counts?.ready || 0;
                          return (
                            <div key={sub.key} className="px-3 py-2 sm:px-4 sm:py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs sm:text-sm text-gray-600">{sub.subject}</div>
                                  <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{sub.chapter}</div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                                  <button
                                    onClick={() => {
                                      const lessons = (sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                                      setSelectedChapter({ schemeId: lessons[0]?.schemeId || '', chapter: sub.chapter, class: clsGroup.class, subject: sub.subject, teacherName: sub.teacherName, lessons });
                                      setShowChapterModal(true);
                                    }}
                                    className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                                    title="Open Chapter"
                                  ><BookOpen className="h-4 w-4" /></button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {(sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                                  <div key={l.lpId} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-1">
                                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                                      <div className="flex items-center gap-3 text-xs text-gray-600">
                                        <span className="font-medium">Session {l.session}</span>
                                        <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                        <span>P{l.selectedPeriod || '-'}</span>
                                      </div>
                                      <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                                    </div>
                                    <div className="flex items-center gap-2 self-start md:self-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                                      {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                        <>
                                          <button 
                                            onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                            disabled={!!rowSubmitting[l.lpId]}
                                            className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                            title="Approve"
                                          >✓</button>
                                          {l.status === 'Pending Review' && (
                                            <button 
                                              onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                              disabled={!!rowSubmitting[l.lpId]}
                                              className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                              title="Needs Rework"
                                            >⚠</button>
                                          )}
                                          <button 
                                            onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                            disabled={!!rowSubmitting[l.lpId]}
                                            className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                            title="Reject"
                                          >✗</button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Chapter Sessions Modal (view-only) */}
        {showChapterModal && selectedChapter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeChapterModal}>
              <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl p-4 md:p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-words">{selectedChapter.chapter}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {stripStdPrefix(selectedChapter.class)} • {selectedChapter.subject} • {selectedChapter.teacherName}
                    </p>
                  </div>
                  <button onClick={closeChapterModal} className="text-gray-500 hover:text-gray-700">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedChapter.lessons.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {selectedChapter.lessons.filter(l => l.status === 'Pending Review').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Approved</p>
                      <p className="text-2xl font-bold text-green-600">
                        {selectedChapter.lessons.filter(l => l.status === 'Ready').length}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => { const pc = selectedChapter.lessons.filter(l => l.status === 'Pending Review').length; return (
                        <span className="text-xs text-gray-600 w-full sm:w-auto">Pending: {pc}</span>
                      ); })()}
                      <button
                        onClick={() => {
                          setBulkRescheduleChapter(selectedChapter);
                          const sortedLessons = selectedChapter.lessons.sort((a,b) => parseInt(a.session||0) - parseInt(b.session||0));
                          setBulkRescheduleDates(sortedLessons.map(l => ({ 
                            lpId: l.lpId, 
                            session: l.session, 
                            teacherEmail: l.teacherEmail || '',
                            date: l.selectedDate || '', 
                            period: l.selectedPeriod || '',
                            newDate: '',
                            newPeriod: ''
                          })));
                          setBulkTimetables({});
                          setBulkPlannedPeriods({});
                          setShowOtherClassPeriodsBulk(false);
                          setShowBulkRescheduleModal(true);
                        }}
                        className="px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 flex-1 sm:flex-initial whitespace-nowrap"
                        title="Reschedule all sessions in this chapter"
                      >📅 Reschedule Chapter</button>
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Ready')}
                        className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                        title="Approve all pending in this chapter"
                      >{bulkSubmitting ? 'Working…' : 'Approve All'}</button>
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Needs Rework')}
                        className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                        title="Send all pending for rework"
                      >Rework All</button>
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Rejected')}
                        className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                        title="Reject all pending in this chapter"
                      >Reject All</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedChapter.lessons.map((l) => (
                    <div key={l.lpId} className={`border rounded-lg p-3 md:p-4 ${
                      l.status === 'Ready' ? 'border-green-300 bg-green-50' :
                      l.status === 'Pending Review' ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-300 bg-gray-50'
                    }`}>
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">Session {l.session}</h3>
                          <p className="text-sm text-gray-600">
                            {l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled'} 
                            {l.selectedPeriod && ` • Period ${l.selectedPeriod}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                            l.status === 'Ready' ? 'bg-green-100 text-green-800' :
                            l.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' :
                            l.status === 'Needs Rework' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {l.status}
                          </span>
                          {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button 
                                onClick={async () => { await handleApproveLesson(l.lpId, 'Ready'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Ready'} : x)}) : prev); }}
                                disabled={!!rowSubmitting[l.lpId]}
                                className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                title="Approve"
                              >
                                {rowSubmitting[l.lpId] ? '…' : <CheckCircle className="h-4 w-4" />}
                              </button>
                              {l.status === 'Pending Review' && (
                                <button 
                                  onClick={async () => { await handleApproveLesson(l.lpId, 'Needs Rework'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Needs Rework'} : x)}) : prev); }}
                                  disabled={!!rowSubmitting[l.lpId]}
                                  className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                  title="Send for rework"
                                >
                                  {rowSubmitting[l.lpId] ? '…' : <AlertTriangle className="h-4 w-4" />}
                                </button>
                              )}
                              <button 
                                onClick={async () => { await handleApproveLesson(l.lpId, 'Rejected'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Rejected'} : x)}) : prev); }}
                                disabled={!!rowSubmitting[l.lpId]}
                                className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                title="Reject"
                              >
                                {rowSubmitting[l.lpId] ? '…' : <XCircle className="h-4 w-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-700 mb-1">Learning Objectives:</p>
                        <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.learningObjectives || '-'}</p>
                      </div>
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-700 mb-1">Teaching Methods:</p>
                        <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.teachingMethods || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {l.resourcesRequired && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Resources:</p>
                            <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.resourcesRequired}</p>
                          </div>
                        )}
                        {l.assessmentMethods && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Assessment:</p>
                            <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.assessmentMethods}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
                  <button onClick={closeChapterModal} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Reschedule Modal */}
      {showRescheduleModal && rescheduleLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reschedule Lesson Plan</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Teacher:</strong> {rescheduleLesson.teacherName}<br/>
                  <strong>Class:</strong> {rescheduleLesson.class}<br/>
                  <strong>Subject:</strong> {rescheduleLesson.subject}<br/>
                  <strong>Chapter:</strong> {rescheduleLesson.chapter} (Session {rescheduleLesson.session})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={async (e) => {
                    const selectedDate = e.target.value;
                    setNewDate(selectedDate);
                    setNewPeriod('');
                    
                    // Fetch teacher's timetable and lesson plans for selected date
                    if (selectedDate && rescheduleLesson.teacherEmail) {
                      setLoadingPeriods(true);
                      try {
                        // Fetch timetable
                        const timetableData = await api.getTeacherDailyTimetable(rescheduleLesson.teacherEmail, selectedDate);
                        const periods = timetableData?.periods || [];
                        setRescheduleAvailablePeriods(periods);
                        
                        // Fetch lesson plans for this date to check which periods are already scheduled
                        const lessonPlansData = await api.getLessonPlansForDate(selectedDate);
                        const teacherPlans = (lessonPlansData?.lessonPlans || []).filter(
                          lp => (lp.teacherEmail || '').toLowerCase() === rescheduleLesson.teacherEmail.toLowerCase()
                        );
                        const plannedPeriods = teacherPlans.map(lp => String(lp.period || lp.selectedPeriod || ''));
                        setReschedulePlannedPeriods(plannedPeriods);
                      } catch (err) {
                        console.error('Error loading timetable:', err);
                        setRescheduleAvailablePeriods([]);
                        setReschedulePlannedPeriods([]);
                      } finally {
                        setLoadingPeriods(false);
                      }
                    } else {
                      setRescheduleAvailablePeriods([]);
                      setReschedulePlannedPeriods([]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {loadingPeriods && (
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600 mt-2">Loading periods...</p>
                </div>
              )}
              
              {!loadingPeriods && newDate && rescheduleAvailablePeriods.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Period</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={showOtherClassPeriods}
                      onChange={(e) => setShowOtherClassPeriods(e.target.checked)}
                    />
                    Show other class periods (from timetable)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {rescheduleAvailablePeriods.map((period) => {
                      const norm = (v) => String(v || '').toLowerCase().trim();
                      const targetClass = norm(rescheduleLesson?.class);
                      const targetSubject = norm(rescheduleLesson?.subject);

                      const periodNum = period.period || period.Period || period.periodNumber;
                      const isFree = !period.class || period.class === 'Free' || period.subject === 'Free';
                      const hasLessonPlan = reschedulePlannedPeriods.includes(String(periodNum));
                      const isTarget = !isFree && norm(period.class) === targetClass && (!targetSubject || norm(period.subject) === targetSubject);
                      const isSelected = String(newPeriod) === String(periodNum);

                      if (!showOtherClassPeriods && !isFree && !isTarget) {
                        return null;
                      }
                      
                      return (
                        <button
                          key={periodNum}
                          type="button"
                          onClick={() => setNewPeriod(String(periodNum))}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : hasLessonPlan
                              ? 'border-orange-200 bg-orange-50 hover:border-orange-400'
                              : isTarget
                              ? 'border-green-200 bg-green-50 hover:border-green-400'
                              : isFree
                              ? 'border-gray-200 bg-gray-50 hover:border-gray-400'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <div className="font-semibold text-sm">
                            Period {periodNum}
                            {isSelected && <span className="ml-2 text-blue-600">✓</span>}
                          </div>
                          <div className="text-xs mt-1">
                            {hasLessonPlan ? (
                              <span className="text-orange-700">📅 Lesson Scheduled</span>
                            ) : isTarget ? (
                              <span className="text-green-700">✅ {rescheduleLesson.class} ({rescheduleLesson.subject})</span>
                            ) : isFree ? (
                              <span className="text-gray-700">Free</span>
                            ) : (
                              <>
                                <div className="text-gray-700">{period.class}</div>
                                <div className="text-gray-600">{period.subject}</div>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="text-green-600">● Green</span> = {rescheduleLesson.class} ({rescheduleLesson.subject}),
                    <span className="text-gray-600 ml-2">● Gray</span> = Free period,
                    <span className="text-orange-600 ml-2">● Orange</span> = Lesson already scheduled
                  </p>
                </div>
              )}
              
              {!loadingPeriods && newDate && rescheduleAvailablePeriods.length === 0 && (
                <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                  No timetable found for this date. You can still enter a period number manually.
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Number</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(e.target.value)}
                      placeholder="Enter period (1-10)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    if (!newDate) {
                      alert('Please select a date');
                      return;
                    }
                    if (!newPeriod) {
                      alert('Please enter a period number');
                      return;
                    }
                    
                    try {
                      setRowSubmitting(prev => ({ ...prev, [rescheduleLesson.lpId]: true }));
                      const response = await api.rescheduleLessonPlan(
                        rescheduleLesson.lpId,
                        newDate,
                        newPeriod,
                        memoizedUser?.email || ''
                      );
                      
                      if (response.data?.success || response.success) {
                        alert('Lesson plan rescheduled successfully!');
                        setShowRescheduleModal(false);
                        setRescheduleLesson(null);
                        refreshApprovals();
                      } else {
                        alert('Failed to reschedule: ' + (response.data?.error || response.error || 'Unknown error'));
                      }
                    } catch (err) {
                      console.error('Error rescheduling:', err);
                      alert('Error rescheduling lesson plan: ' + err.message);
                    } finally {
                      setRowSubmitting(prev => ({ ...prev, [rescheduleLesson.lpId]: false }));
                    }
                  }}
                  disabled={rowSubmitting[rescheduleLesson.lpId]}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rowSubmitting[rescheduleLesson.lpId] ? 'Rescheduling...' : 'Reschedule'}
                </button>
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleLesson(null);
                  }}
                  disabled={rowSubmitting[rescheduleLesson.lpId]}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    
      {/* Bulk Reschedule Chapter Modal */}
      {showBulkRescheduleModal && bulkRescheduleChapter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reschedule Chapter: {bulkRescheduleChapter.chapter}</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Class:</strong> {bulkRescheduleChapter.class}<br/>
                  <strong>Subject:</strong> {bulkRescheduleChapter.subject}<br/>
                  <strong>Total Sessions:</strong> {bulkRescheduleDates.length}
                </p>
              </div>
              
              {autoFillLoading && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-blue-800 font-medium">Auto-filling sessions based on timetable...</span>
                </div>
              )}
              
              <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg">
                <div className="mb-3">
                  ℹ️ <strong>Auto-fill Mode:</strong> Set the starting date and period for Session 1, and the system will automatically schedule subsequent sessions based on the teacher's timetable.
                </div>
                <div className="mb-2">
                  <span className="text-green-600">● Green</span> = {bulkRescheduleChapter.class} ({bulkRescheduleChapter.subject}), <span className="text-gray-600">● Gray</span> = Free, <span className="text-orange-600">● Orange</span> = Lesson already scheduled.
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={showOtherClassPeriodsBulk}
                    onChange={(e) => setShowOtherClassPeriodsBulk(e.target.checked)}
                  />
                  Show other class periods (from timetable)
                </label>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Period</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Period</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bulkRescheduleDates.map((item, idx) => (
                      <tr key={item.lpId} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.session}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{item.date || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{item.period || '-'}</td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={bulkRescheduleDates[idx]?.newDate || ''}
                            onChange={async (e) => {
                              const selectedDate = e.target.value;
                              const updated = [...bulkRescheduleDates];
                              updated[idx] = { ...updated[idx], newDate: selectedDate, newPeriod: '' };
                              setBulkRescheduleDates(updated);
                              
                              // Fetch teacher timetable and lesson plans for this date
                              if (selectedDate && item.teacherEmail) {
                                const key = `${idx}-${selectedDate}`;
                                setBulkTimetables(prev => ({ ...prev, [key]: { loading: true, periods: [] } }));
                                try {
                                  // Fetch timetable
                                  const timetableData = await api.getTeacherDailyTimetable(item.teacherEmail, selectedDate);
                                  const periods = timetableData?.periods || [];
                                  setBulkTimetables(prev => ({ ...prev, [key]: { loading: false, periods } }));
                                  
                                  // Fetch lesson plans for this date
                                  const lessonPlansData = await api.getLessonPlansForDate(selectedDate);
                                  const teacherPlans = (lessonPlansData?.lessonPlans || []).filter(
                                    lp => (lp.teacherEmail || '').toLowerCase() === item.teacherEmail.toLowerCase()
                                  );
                                  const plannedPeriods = teacherPlans.map(lp => String(lp.period || lp.selectedPeriod || ''));
                                  setBulkPlannedPeriods(prev => ({ ...prev, [key]: plannedPeriods }));
                                } catch (err) {
                                  console.error('Error loading timetable:', err);
                                  setBulkTimetables(prev => ({ ...prev, [key]: { loading: false, periods: [] } }));
                                  setBulkPlannedPeriods(prev => ({ ...prev, [key]: [] }));
                                }
                              }
                            }}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            disabled={idx > 0 || autoFillLoading}
                            title={idx === 0 ? "Select date for Session 1 (will auto-fill subsequent sessions)" : "Auto-filled based on Session 1"}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {idx > 0 ? (
                              // For sessions 2+, show read-only auto-filled value
                              <div className="px-2 py-1 text-sm bg-gray-100 border border-gray-300 rounded text-gray-700">
                                {bulkRescheduleDates[idx]?.newPeriod 
                                  ? `Period ${bulkRescheduleDates[idx].newPeriod} (Auto)`
                                  : 'Auto-fill from Session 1'}
                              </div>
                            ) : (
                              // Only Session 1 is editable
                              (() => {
                                const key = `${idx}-${bulkRescheduleDates[idx]?.newDate || ''}`;
                                const timetableData = bulkTimetables[key];
                                const periods = timetableData?.periods || [];
                                const loading = timetableData?.loading;
                                
                                if (loading) {
                                  return <span className="text-xs text-gray-500">Loading...</span>;
                                }
                                
                                if (bulkRescheduleDates[idx]?.newDate && periods.length > 0) {
                                  const norm = (v) => String(v || '').toLowerCase().trim();
                                  const targetClass = norm(bulkRescheduleChapter?.class);
                                  const targetSubject = norm(bulkRescheduleChapter?.subject);
                                  const plannedPeriods = bulkPlannedPeriods[key] || [];
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {periods.map((p) => {
                                        const periodNum = p.period || p.Period || p.periodNumber;
                                        const isFree = !p.class || p.class === 'Free' || p.subject === 'Free';
                                        const hasLessonPlan = plannedPeriods.includes(String(periodNum));
                                        const isTarget = !isFree && norm(p.class) === targetClass && (!targetSubject || norm(p.subject) === targetSubject);
                                        const isSelected = String(bulkRescheduleDates[idx]?.newPeriod) === String(periodNum);

                                        if (!showOtherClassPeriodsBulk && !isFree && !isTarget) {
                                          return null;
                                        }
                                        return (
                                          <button
                                            key={periodNum}
                                            type="button"
                                            onClick={async () => {
                                              // Check if this period already has a lesson plan
                                              if (hasLessonPlan && idx === 0) {
                                                if (!window.confirm(
                                                  `⚠️ Warning: Period ${periodNum} already has a lesson plan scheduled.\n\n` +
                                                  `Do you want to proceed with this period anyway?`
                                                )) {
                                                  return;
                                                }
                                              }
                                              
                                              const updated = [...bulkRescheduleDates];
                                              updated[idx] = { ...updated[idx], newPeriod: String(periodNum) };
                                              
                                              // Auto-fill subsequent sessions when session 1 period is selected
                                              if (idx === 0 && bulkRescheduleDates[0]?.newDate) {
                                                setAutoFillLoading(true);
                                                try {
                                                  const teacherEmail = item.teacherEmail;
                                                  const startDate = bulkRescheduleDates[0].newDate;
                                                  const endDate = new Date(startDate);
                                                  endDate.setDate(endDate.getDate() + 30);
                                                  const endDateStr = endDate.toISOString().split('T')[0];
                                                  
                                                  const response = await api.getAvailablePeriodsForLessonPlan(
                                                    teacherEmail,
                                                    startDate,
                                                    endDateStr,
                                                    false, // Don't exclude existing - we want to include the selected starting slot
                                                    bulkRescheduleChapter.class,
                                                    bulkRescheduleChapter.subject
                                                  );
                                                  
                                                  const actualData = response?.data || response;
                                                  if (actualData.success && actualData.availableSlots) {
                                                    // Filter to start from selected date/period
                                                    const allSlots = actualData.availableSlots;
                                                    const startIdx = allSlots.findIndex(
                                                      s => s.date === startDate && String(s.period) === String(periodNum)
                                                    );
                                                    
                                                    if (startIdx >= 0) {
                                                      // Start from the selected slot and take subsequent available slots
                                                      const slotsFromStart = allSlots.slice(startIdx).filter(p => p.isAvailable);
                                                      for (let i = 0; i < updated.length && i < slotsFromStart.length; i++) {
                                                        updated[i].newDate = slotsFromStart[i].date;
                                                        updated[i].newPeriod = String(slotsFromStart[i].period);
                                                      }
                                                    } else {
                                                      // Fallback: just use available slots from start date onwards
                                                      const available = allSlots.filter(p => 
                                                        p.isAvailable && p.date >= startDate
                                                      );
                                                      // Manually set first session to selected slot
                                                      updated[0].newDate = startDate;
                                                      updated[0].newPeriod = String(periodNum);
                                                      // Fill rest with available slots
                                                      for (let i = 1; i < updated.length && i - 1 < available.length; i++) {
                                                        updated[i].newDate = available[i - 1].date;
                                                        updated[i].newPeriod = String(available[i - 1].period);
                                                      }
                                                    }
                                                  }
                                                } catch (err) {
                                                  console.error('Error auto-filling sessions:', err);
                                                  alert('Failed to auto-fill sessions. Please try again.');
                                                } finally {
                                                  setAutoFillLoading(false);
                                                }
                                              }
                                              
                                              setBulkRescheduleDates(updated);
                                            }}
                                            disabled={autoFillLoading}
                                            className={`px-2 py-1 text-xs rounded border ${
                                              isSelected
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : hasLessonPlan
                                                ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                                                : isTarget
                                                ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                                : isFree
                                                ? 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                            }`}
                                            title={hasLessonPlan ? `Period ${periodNum} - Lesson scheduled` : isTarget ? `Period ${periodNum} - ${bulkRescheduleChapter.class} ${bulkRescheduleChapter.subject}` : isFree ? `Period ${periodNum} - Free` : `Period ${periodNum} - ${p.class} ${p.subject}`}
                                          >
                                            {periodNum}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                
                                return (
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={bulkRescheduleDates[idx]?.newPeriod || ''}
                                    onChange={(e) => {
                                      const updated = [...bulkRescheduleDates];
                                      updated[idx] = { ...updated[idx], newPeriod: e.target.value };
                                      setBulkRescheduleDates(updated);
                                    }}
                                    placeholder="1-10"
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  />
                                );
                              })()
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    // Validate all entries
                    const incomplete = bulkRescheduleDates.filter(item => !item.newDate || !item.newPeriod);
                    if (incomplete.length > 0) {
                      alert(`Please set date and period for all ${incomplete.length} session(s)`);
                      return;
                    }
                    
                    try {
                      setBulkSubmitting(true);
                      let successCount = 0;
                      let failCount = 0;
                      
                      for (const item of bulkRescheduleDates) {
                        try {
                          const response = await api.rescheduleLessonPlan(
                            item.lpId,
                            item.newDate,
                            item.newPeriod,
                            memoizedUser?.email || ''
                          );
                          
                          const result = response.data || response;
                          if (result.success) {
                            successCount++;
                          } else {
                            failCount++;
                            console.error('Failed to reschedule session', item.session, result.error || 'Unknown error', response);
                          }
                        } catch (err) {
                          failCount++;
                          console.error('Error rescheduling session', item.session, err);
                        }
                      }
                      
                      alert(`Bulk reschedule complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
                      setShowBulkRescheduleModal(false);
                      setBulkRescheduleChapter(null);
                      setBulkRescheduleDates([]);
                      setBulkTimetables({});
                      setBulkPlannedPeriods({});
                      refreshApprovals();
                    } catch (err) {
                      console.error('Error in bulk reschedule:', err);
                      alert('Error during bulk reschedule: ' + err.message);
                    } finally {
                      setBulkSubmitting(false);
                    }
                  }}
                  disabled={bulkSubmitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSubmitting ? 'Rescheduling All Sessions...' : 'Reschedule All Sessions'}
                </button>
                <button
                  onClick={() => {
                    setShowBulkRescheduleModal(false);
                    setBulkRescheduleChapter(null);
                    setBulkRescheduleDates([]);
                    setBulkTimetables({});
                    setBulkPlannedPeriods({});
                  }}
                  disabled={bulkSubmitting}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  // Enhanced Substitutions View for HM
  const SubstitutionsView = () => {
    const [substitutions, setSubstitutions] = useState([]);
    const [dailyTimetable, setDailyTimetable] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Enhanced form state for better UX
    const [selectedTeacherTimetable, setSelectedTeacherTimetable] = useState([]);
    const [availableSubstitutes, setAvailableSubstitutes] = useState([]);
    const [loadingTeacherTimetable, setLoadingTeacherTimetable] = useState(false);
    
    // Data fetched from the API; initially empty
    const [absentTeachers, setAbsentTeachers] = useState([]);
    const [freeTeachers, setFreeTeachers] = useState([]);
    const [vacantSlots, setVacantSlots] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);

    // Filters for timetable view
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      date: todayIST()
    });

    const [formData, setFormData] = useState({
      date: todayIST(),
      absentTeacher: '',
      period: '',
      class: '',
      regularSubject: '',
      substituteTeacher: '',
      substituteSubject: ''
    });

    // Helper function to refresh substitutions
    const refreshSubstitutions = async (targetDate = null) => {
      const dateToUse = targetDate || formData.date;
      setRefreshing(true);
      try {
        // Try multiple endpoints for robustness
        let subs = [];
        
        // Method 1: Direct substitutions endpoint
        try {
          // console.log('🔍 Fetching substitutions for date:', dateToUse);
          const direct = await api.getAssignedSubstitutions(dateToUse, { noCache: true });
          // console.log('🔍 API Response:', direct);
          
          if (direct && Array.isArray(direct.assignedSubstitutions)) {
            subs = direct.assignedSubstitutions;
            // console.log('✅ Found', subs.length, 'substitutions:', subs);
          } else {
            // console.log('⚠️ No assignedSubstitutions array in response');
          }
        } catch (e1) {
          console.warn('getAssignedSubstitutions failed:', e1?.message || e1);
        }
        
        // Method 2: Fallback to merged timetable if no direct results
        if (subs.length === 0) {
          try {
            // console.log('🔄 Trying fallback method...');
            const merged = await api.getDailyTimetableWithSubstitutions(dateToUse, { noCache: true });
            // console.log('🔍 Merged timetable response:', merged);
            
            if (merged && Array.isArray(merged.timetable)) {
              subs = merged.timetable.filter(item => item && item.isSubstitution);
              // console.log('✅ Found', subs.length, 'substitutions from timetable');
            }
          } catch (e2) {
            console.warn('getDailyTimetableWithSubstitutions failed:', e2?.message || e2);
          }
        }
        
        // console.log('🎯 Final substitutions to display:', subs);
        setSubstitutions(subs);
        return subs;
      } catch (err) {
        console.error('Error refreshing substitutions:', err);
        return [];
      } finally {
        setRefreshing(false);
      }
    };

    // Load daily timetable with substitutions for the filtered date
    const loadDailyTimetable = async () => {
      setLoading(true);
      try {
        // Get full timetable with filters
        const timetableData = await api.getFullTimetableFiltered(
          filters.class, 
          '', 
          filters.teacher, 
          filters.date
        );
        
        if (Array.isArray(timetableData)) {
          setDailyTimetable(timetableData);
        } else {
          // Fallback to daily timetable with substitutions
          const merged = await api.getDailyTimetableWithSubstitutions(filters.date);
          if (merged && Array.isArray(merged.timetable)) {
            let filtered = merged.timetable;
            
            // Apply client-side filters if needed
            if (filters.teacher) {
              filtered = filtered.filter(item => 
                (item.teacher || '').toLowerCase().includes(filters.teacher.toLowerCase()) ||
                (item.substituteTeacher || '').toLowerCase().includes(filters.teacher.toLowerCase())
              );
            }
            
            if (filters.class) {
              filtered = filtered.filter(item => 
                (item.class || '').toLowerCase().includes(filters.class.toLowerCase())
              );
            }
            
            setDailyTimetable(filtered);
          } else {
            setDailyTimetable([]);
          }
        }
      } catch (err) {
        console.error('Error loading daily timetable:', err);
        setDailyTimetable([]);
      } finally {
        setLoading(false);
      }
    };

    // Load teacher's timetable when teacher is selected in form
    const loadTeacherTimetable = async (teacherEmail, date) => {
      if (!teacherEmail || !date) {
        setSelectedTeacherTimetable([]);
        return;
      }
      
      setLoadingTeacherTimetable(true);
      try {
        // console.log('🔍 Loading teacher timetable for:', teacherEmail, 'on date:', date);
        const timetable = await api.getTeacherDailyTimetable(teacherEmail, date);
        // console.log('🔍 Teacher timetable response:', timetable);
        
        if (timetable && Array.isArray(timetable.periods)) {
          // console.log('✅ Found', timetable.periods.length, 'periods for teacher');
          setSelectedTeacherTimetable(timetable.periods);
        } else {
          // console.log('⚠️ No periods found in response structure');
          setSelectedTeacherTimetable([]);
        }
      } catch (err) {
        console.error('❌ Error loading teacher timetable:', err);
        setSelectedTeacherTimetable([]);
      } finally {
        setLoadingTeacherTimetable(false);
      }
    };

    // Load available substitutes for a specific period
    const loadAvailableSubstitutes = async (date, period) => {
      if (!date || !period) {
        setAvailableSubstitutes([]);
        return;
      }
      
      try {
        const free = await api.getFreeTeachers(date, period, [formData.absentTeacher]);
        setAvailableSubstitutes(Array.isArray(free) ? free : []);
      } catch (err) {
        console.error('Error loading available substitutes:', err);
        setAvailableSubstitutes([]);
      }
    };

    // Initial data load when component mounts
    useEffect(() => {
      async function initializeData() {
        try {
          // Load basic data
          const [absents, teachers, classes] = await Promise.all([
            api.getPotentialAbsentTeachers().catch(() => []),
            api.getPotentialAbsentTeachers().catch(() => []), // Reuse for all teachers
            api.getAllClasses().catch(() => [])
          ]);
          
          setAbsentTeachers(Array.isArray(absents) ? absents : []);
          setAllTeachers(Array.isArray(teachers) ? teachers : []);
          setAllClasses(Array.isArray(classes) ? classes : []);
          
          // Load substitutions immediately
          await refreshSubstitutions();
          
          // Load daily timetable
          await loadDailyTimetable();
          
        } catch (err) {
          console.error('Error initializing substitution data:', err);
        }
      }
      
      initializeData();
    }, []); // Only run on mount

    // Fetch data when form date changes
    useEffect(() => {
      async function fetchSubstitutionData() {
        try {
          // Build identifier list (prefer email when available)
          const absentIds = absentTeachers.map(a => (a && (a.email || a.name)) || '').filter(Boolean);
          
          // Vacant slots for the current date and absent teachers
          const vacantRes = await api.getVacantSlotsForAbsent(formData.date, absentIds);
          const vacSlots = vacantRes && Array.isArray(vacantRes.vacantSlots) ? vacantRes.vacantSlots : [];
          setVacantSlots(vacSlots);
          
          // Free teachers for the selected date/period and current absent list
          const free = await api.getFreeTeachers(formData.date, formData.period || '', absentIds);
          setFreeTeachers(Array.isArray(free) ? free : []);
          
          // Refresh substitutions for the new date
          await refreshSubstitutions(formData.date);
          
        } catch (err) {
          console.error('Error fetching substitution data:', err);
        }
      }
      
      if (absentTeachers.length > 0) {
        fetchSubstitutionData();
      }
    }, [formData.date, formData.period, absentTeachers]);

    // Load timetable when filters change
    useEffect(() => {
      loadDailyTimetable();
    }, [filters.date, filters.teacher, filters.class]);

    // Load teacher timetable when absent teacher is selected
    useEffect(() => {
      if (formData.absentTeacher && formData.date) {
        loadTeacherTimetable(formData.absentTeacher, formData.date);
      }
    }, [formData.absentTeacher, formData.date]);

    // Load available substitutes when period is selected
    useEffect(() => {
      if (formData.date && formData.period && formData.absentTeacher) {
        loadAvailableSubstitutes(formData.date, formData.period);
      }
    }, [formData.date, formData.period, formData.absentTeacher]);

    const handleSubmitSubstitution = async (e) => {
      e.preventDefault();
      try {
        // Persist the substitution using the global submit helper for
        // consistent UX.
        await withSubmit('Assigning substitution...', () => api.assignSubstitution(formData));
        
        // Immediately refresh the substitution list for the selected date
        await refreshSubstitutions(formData.date);
        
        // Also reload the daily timetable to show updates
        await loadDailyTimetable();
        
        // Close the form and reset inputs
        setShowForm(false);
        setFormData({
          date: todayIST(),
          absentTeacher: '',
          period: '',
          class: '',
          regularSubject: '',
          substituteTeacher: '',
          substituteSubject: ''
        });
      } catch (err) {
        console.error('Failed to assign substitution:', err);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Substitutions Management</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshSubstitutions()}
              className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 flex items-center hover:bg-gray-200 transition-colors duration-300"
              disabled={refreshing}
            >
              {refreshing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Substitution
            </button>
          </div>
        </div>

        {/* Filters for Timetable View */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Timetable with Substitutions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({...filters, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Teacher</label>
              <select
                value={filters.teacher}
                onChange={(e) => setFilters({...filters, teacher: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Teachers</option>
                {allTeachers.map((teacher, idx) => (
                  <option key={`teacher-${idx}`} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Class</label>
              <select
                value={filters.class}
                onChange={(e) => setFilters({...filters, class: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Classes</option>
                {allClasses.map((cls, idx) => (
                  <option key={`class-${idx}`} value={cls}>
                    {stripStdPrefix(cls)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Daily Timetable Display */}
          {loading ? (
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyTimetable.map((slot, index) => (
                    <tr key={`timetable-${slot.period}-${slot.class}-${index}`} 
                        className={slot.isSubstitution ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{slot.period}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stripStdPrefix(slot.class)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slot.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {slot.isSubstitution ? (
                          <span className="text-red-600 line-through">{slot.originalTeacher || slot.absentTeacher}</span>
                        ) : (
                          slot.teacher
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {slot.isSubstitution ? (
                          <span className="text-green-600 font-medium">{slot.substituteTeacher || slot.teacher}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {slot.isSubstitution ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Substitution
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dailyTimetable.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No timetable data found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Current Substitutions Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Active Substitutions for {new Date(formData.date).toLocaleDateString()}
            </h2>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
              {substitutions.length} substitution{substitutions.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {substitutions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {substitutions.map((sub, index) => (
                    <tr key={`sub-${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.period}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-red-600">{sub.absentTeacher || sub.originalTeacher}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-green-600 font-medium">{sub.substituteTeacher || sub.teacher}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No substitutions assigned for this date.
            </div>
          )}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Assign Substitution</h2>
            <form onSubmit={handleSubmitSubstitution} className="space-y-6">
              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Absent Teacher</label>
                  <select
                    value={formData.absentTeacher}
                    onChange={(e) => setFormData({...formData, absentTeacher: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Teacher</option>
                    {absentTeachers.map(teacher => (
                      <option key={(teacher.email||teacher.name)} value={(teacher.name)}>{teacher.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Teacher Timetable */}
              {formData.absentTeacher && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    {formData.absentTeacher.split('@')[0]}'s Timetable for {formData.date}
                  </h3>
                  {loadingTeacherTimetable ? (
                    <div className="flex justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : selectedTeacherTimetable.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {selectedTeacherTimetable.map((period, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded border cursor-pointer transition-colors ${
                            formData.period === String(period.period) 
                              ? 'bg-blue-100 border-blue-300' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => setFormData({
                            ...formData, 
                            period: String(period.period),
                            class: period.class || '',
                            regularSubject: period.subject || ''
                          })}
                        >
                          <div className="text-sm font-medium">Period {period.period}</div>
                          <div className="text-xs text-gray-600">{period.class}</div>
                          <div className="text-xs text-gray-600">{period.subject}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No timetable available for this teacher</p>
                  )}
                </div>
              )}

              {/* Period Selection and Subject Details */}
              {formData.absentTeacher && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select
                      value={formData.period}
                      onChange={(e) => setFormData({...formData, period: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Period</option>
                      <option value="1">Period 1</option>
                      <option value="2">Period 2</option>
                      <option value="3">Period 3</option>
                      <option value="4">Period 4</option>
                      <option value="5">Period 5</option>
                      <option value="6">Period 6</option>
                      <option value="7">Period 7</option>
                      <option value="8">Period 8</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select
                      value={formData.class}
                      onChange={(e) => setFormData({...formData, class: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Class</option>
                      {allClasses.map((cls, idx) => (
                        <option key={`form-class-${idx}`} value={cls}>{stripStdPrefix(cls)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regular Subject</label>
                    <input
                      type="text"
                      value={formData.regularSubject}
                      onChange={(e) => setFormData({...formData, regularSubject: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Available Substitutes */}
              {formData.period && formData.absentTeacher && (
                <div className="border rounded-lg p-4 bg-green-50">
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    Available Teachers for Period {formData.period}
                  </h3>
                  {availableSubstitutes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {availableSubstitutes.map((teacher, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded border cursor-pointer transition-colors ${
                            formData.substituteTeacher === (teacher.email || teacher.name) 
                              ? 'bg-green-200 border-green-400' 
                              : 'bg-white border-gray-200 hover:bg-green-100'
                          }`}
                          onClick={() => setFormData({
                            ...formData, 
                            substituteTeacher: teacher.email || teacher.name,
                            substituteSubject: formData.regularSubject // Default to same subject
                          })}
                        >
                          <div className="text-sm font-medium">{teacher.name}</div>
                          <div className="text-xs text-gray-600">Available</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No teachers available for this period</p>
                  )}
                </div>
              )}

              {/* Substitute Details */}
              {formData.substituteTeacher && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Substitute Teacher</label>
                    <input
                      type="text"
                      value={formData.substituteTeacher}
                      onChange={(e) => setFormData({...formData, substituteTeacher: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Substitute Subject</label>
                    <input
                      type="text"
                      value={formData.substituteSubject}
                      onChange={(e) => setFormData({...formData, substituteSubject: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      date: todayIST(),
                      absentTeacher: '',
                      period: '',
                      class: '',
                      regularSubject: '',
                      substituteTeacher: '',
                      substituteSubject: ''
                    });
                    setSelectedTeacherTimetable([]);
                    setAvailableSubstitutes([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!formData.absentTeacher || !formData.period || !formData.substituteTeacher}
                >
                  Assign Substitution
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  // Full Timetable View
  const FullTimetableView = () => {
    const [fullTimetable, setFullTimetable] = useState([]);
    // HM filters
    const [filterDay, setFilterDay] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterTeacher, setFilterTeacher] = useState('');
    const [searchDate, setSearchDate] = useState(formatDateForInput(todayIST()));
    const [availableDays, setAvailableDays] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [availableTeachers, setAvailableTeachers] = useState([]);

    // Load timetable: unfiltered weekly by default; use server filtering when class/teacher/date are provided
    useEffect(() => {
      let cancelled = false;
      async function fetchData() {
        try {
          let data;
          const needServerFilter = !!(filterClass || filterTeacher || searchDate);
          if (needServerFilter) {
            data = await api.getFullTimetableFiltered(filterClass || '', '', filterTeacher || '', searchDate || '');
          } else {
            data = await api.getFullTimetable();
          }
          if (cancelled) return;
          const ft = Array.isArray(data) ? data : [];
          setFullTimetable(ft);
          // Derive filter lists from current data
          const classes = new Set();
          const teachers = new Set();
          const days = new Set();
          ft.forEach(day => {
            if (day && day.day) days.add(String(day.day));
            (day.periods || []).forEach(p => {
              (p.entries || []).forEach(e => {
                if (e.class) classes.add(e.class);
                if (e.teacher) teachers.add(e.teacher);
              });
            });
          });
          setAvailableClasses(Array.from(classes).sort());
          setAvailableTeachers(Array.from(teachers).sort());
          setAvailableDays(Array.from(days));
        } catch (err) {
          if (cancelled) return;
          console.error(err);
          setFullTimetable([]);
          setAvailableClasses([]);
          setAvailableTeachers([]);
          setAvailableDays([]);
        }
      }
      fetchData();
      return () => { cancelled = true };
    }, [filterClass, filterTeacher, searchDate]);

    // Determine the maximum number of periods across all days
    const maxPeriods = Math.max(
      0,
      ...fullTimetable.map(day =>
        Array.isArray(day.periods)
          ? Math.max(0, ...day.periods.map(p => p.period))
          : 0
      )
    );
    const periodHeaders = Array.from({ length: maxPeriods }, (_, i) => i + 1);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Full School Timetable</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
        <div className="mb-4">
          {user && user.roles && hasRole('h m') && (
            <div className="bg-white rounded-lg p-4 flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs text-gray-500">Day</label>
                <select className="ml-2 px-2 py-1 border rounded" value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                  <option value="">All</option>
                  {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Class</label>
                <select className="ml-2 px-2 py-1 border rounded" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                  <option value="">All</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Teacher</label>
                <select className="ml-2 px-2 py-1 border rounded" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
                  <option value="">All</option>
                  {availableTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <input type="date" className="ml-2 px-2 py-1 border rounded" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
              </div>
              <div className="ml-auto">
                <button type="button" className="px-3 py-1 bg-gray-100 rounded" onClick={() => { setFilterDay(''); setFilterClass(''); setFilterTeacher(''); setSearchDate(''); }}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {(() => {
          // Apply filters client-side to fullTimetable
          const filtered = fullTimetable
            // Filter by day-of-week if selected
            .filter(d => !filterDay || String(d.day) === String(filterDay))
            // Filter entries by class/teacher client-side (server already filtered when applicable)
            .map(day => ({
              ...day,
              periods: (day.periods || []).map(p => ({
                ...p,
                entries: (p.entries || []).filter(e => {
                  if (filterClass && e.class !== filterClass) return false;
                  if (filterTeacher && e.teacher !== filterTeacher) return false;
                  return true;
                })
              }))
            }))
            .filter(day => (day.periods || []).some(p => (p.entries || []).length > 0) || (!filterDay && !filterClass && !filterTeacher && !searchDate));
          return filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-gray-700">No timetable entries match the selected filters.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                      {periodHeaders.map(period => (
                        <th key={period} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period {period}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.map((day, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{day.day}</td>
                        {periodHeaders.map(periodNumber => {
                          const p = Array.isArray(day.periods) ? day.periods.find(x => x.period === periodNumber) : undefined;
                          const cellText = p ? (p.entries || []).map(e => `${e.class} - ${e.subject}${e.teacher ? ' (' + e.teacher + ')' : ''}`).join('\n') : '';
                          return (
                            <td key={periodNumber} className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-500">{cellText}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        
      </div>
    );
  };

  // Analytics View
  const AnalyticsView = () => {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Submission Trends</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Submission trends chart would appear here</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Approval Rates</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Approval rates chart would appear here</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Lesson Plan Status</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Lesson plan status chart would appear here</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Plan Status Distribution</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Plan status distribution chart would appear here</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Exam Marks View
  const ExamMarksView = () => {
    const [exams, setExams] = useState([]);
    const [showExamForm, setShowExamForm] = useState(false);
    const [examFormData, setExamFormData] = useState({
      examType: '',
      class: '',
      subject: '',
      internalMax: 20,
      externalMax: 80,
      date: todayIST()
    });
    const [availableClasses, setAvailableClasses] = useState([]);
    // List of grading schemes loaded from the GradeTypes sheet.  Each entry
    // contains examType and the maximum internal/external marks.  Used to
    // populate the exam type dropdown dynamically and auto-fill mark limits.
    const [gradeTypes, setGradeTypes] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  const [showMarksForm, setShowMarksForm] = useState(false);
  const [marksRows, setMarksRows] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [gradeBoundaries, setGradeBoundaries] = useState([]);

    const [viewExamMarks, setViewExamMarks] = useState(null);
    const [examMarks, setExamMarks] = useState([]);

    // Load grade types once on component mount.  This allows the exam
    // creation form to offer dynamic exam type options and automatically
    // populate max marks based on the selected grading scheme.
    useEffect(() => {
      async function fetchGradeTypes() {
        try {
          const types = await api.getGradeTypes();
          setGradeTypes(Array.isArray(types) ? types : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchGradeTypes();
    }, []);

    // Load exams and class list on mount
    useEffect(() => {
      async function fetchData() {
        try {
          // Fetch all exams
          const examList = await api.getExams();
          setExams(Array.isArray(examList) ? examList : []);
          // Fetch classes for HM or use teacher's classes
          if (user) {
            if (hasRole('h m')) {
              const cls = await api.getAllClasses();
              setAvailableClasses(Array.isArray(cls) ? cls : []);
            } else {
              setAvailableClasses(user.classes || []);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
      fetchData();
    }, [user]);

    // Load subjects from centralized API
    useEffect(() => {
      async function fetchAllSubjects() {
        try {
          // Get all available subjects from the centralized API endpoint
          const allSubjects = await api.getSubjects();
          
          // If user is a teacher (not HM), restrict to their subjects
          if (user && !hasRole('h m')) {
            const teacherSubjects = Array.isArray(user.subjects) ? user.subjects : [];
            setAvailableSubjects(teacherSubjects);
          } else {
            // Headmaster: show all subjects
            setAvailableSubjects(allSubjects);
          }
        } catch (error) {
          console.error("Error fetching subjects:", error);
          fallbackToExamBasedSubjects();
        }
      }
      
      // Fallback method if API call fails
      function fallbackToExamBasedSubjects() {
        const cls = (examFormData.class || '').toString().trim();
        
        // If user is a teacher (not HM), restrict to their subjects
        if (user && !hasRole('h m')) {
          const teacherSubjects = Array.isArray(user.subjects) ? user.subjects : [];
          setAvailableSubjects(teacherSubjects);
          return;
        }
  
        // Headmaster: derive subjects from the fetched exams for the selected class
        const subjectsSet = new Set();
        if (Array.isArray(exams)) {
          // First pass: add subjects for the selected class
          let matchingClassCount = 0;
          exams.forEach(ex => {
            if (!ex) return;
            if (cls) {
              if (String(ex.class || '').trim() === cls) {
                matchingClassCount++;
                const subj = String(ex.subject || '').trim();
                if (subj) subjectsSet.add(subj);
              }
            } else {
              const subj = String(ex.subject || '').trim();
              if (subj) subjectsSet.add(subj);
            }
          });
          // If no subjects found and a class is selected, fall back to all subjects
          if (subjectsSet.size === 0 && cls) {
            exams.forEach(ex => {
              if (!ex) return;
              const subj = String(ex.subject || '').trim();
              if (subj) subjectsSet.add(subj);
            });
          }
        }
  
        // No default subjects - just warn if no subjects found
        if (subjectsSet.size === 0) {
          if (typeof window !== 'undefined' && console.debug) {
            console.debug('DEBUG: No subjects found in exams');
          }
        }
  
        const list = Array.from(subjectsSet).filter(Boolean).sort();
        setAvailableSubjects(list);
      }
      
      // Call the function to fetch subjects
      fetchAllSubjects();
    }, [examFormData.class, user, exams, hasRole]);

    // Handlers for Exam Creation
    const handleExamFormChange = (field, value) => {
      // When the exam type changes, update the max marks based on the
      // selected grading scheme. If no matching scheme is found, leave
      // existing values unchanged. For other fields, simply update the
      // value as provided.
      if (field === 'examType') {
        const gt = gradeTypes.find(g => g.examType === value);
        if (gt) {
          setExamFormData({ ...examFormData, examType: value, internalMax: gt.internalMax, externalMax: gt.externalMax });
        } else {
          setExamFormData({ ...examFormData, examType: value });
        }
      } else {
        setExamFormData({ ...examFormData, [field]: value });
      }
    };
    const handleCreateExam = async (e) => {
      e.preventDefault();
      if (!user) return;
      try {
        const totalMax = Number(examFormData.internalMax || 0) + Number(examFormData.externalMax || 0);
        // Create exam and show overlay/toast while the request runs
        await withSubmit('Creating exam...', () => api.createExam(user.email, {
          creatorName: user.name || '',
          class: examFormData.class,
          subject: examFormData.subject,
          examType: examFormData.examType,
          internalMax: Number(examFormData.internalMax),
          externalMax: Number(examFormData.externalMax),
          totalMax: totalMax,
          date: examFormData.date
        }));
        // Refresh exams list
        const examList = await api.getExams();
        setExams(Array.isArray(examList) ? examList : []);
        setShowExamForm(false);
        setExamFormData({ examType: '', class: '', subject: '', internalMax: 20, externalMax: 80, date: todayIST() });
      } catch (err) {
        console.error('Error creating exam:', err);
      }
    };

    // Helper to reload exams list from backend and set local state
    const reloadExams = async () => {
      try {
        // If your backend supports filtering by teacher, pass teacherEmail
        const list = await api.getExams({
          teacherEmail: user?.email || undefined,
          role: user?.role || undefined,
          // prevent CDN/browser cache on Apps Script
        });
        setExams(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to reload exams', e);
      }
    };

    // Handlers for Marks Entry
    const openMarksForm = async (exam) => {
      setSelectedExam(exam);
      setShowMarksForm(true);
      try {
        const [students, existingMarks, boundaries] = await Promise.all([
          api.getStudents(stripStdPrefix(exam.class)),
          api.getExamMarks(exam.examId),
          api.getGradeBoundaries()
        ]);
        setGradeBoundaries(Array.isArray(boundaries) ? boundaries : []);

        // Build quick lookup maps for existing marks by admNo and by lowercase name
        const existingByAdm = {};
        const existingByName = {};
        (Array.isArray(existingMarks) ? existingMarks : []).forEach(m => {
          if (!m) return;
          const id = m.markId || null; // keep identity if backend provides
          const base = {
            admNo: m.admNo || '',
            studentName: m.studentName || '',
            internal: m.internal ?? '',
            external: m.external ?? '',
            total: m.total ?? '',
            grade: m.grade ?? '',
            markId: id,
            existing: true
          };
          if (m.admNo) existingByAdm[String(m.admNo)] = base;
          if (m.studentName) existingByName[String(m.studentName).toLowerCase()] = base;
        });

        let rows = [];
        if (Array.isArray(students) && students.length > 0) {
          rows = students.map(s => {
            const admKey = String(s.admNo || '');
            const nameKey = String(s.name || '').toLowerCase();
            const ex = (admKey && existingByAdm[admKey]) || (nameKey && existingByName[nameKey]) || null;
            return ex ? { ...ex } : {
              admNo: s.admNo || '',
              studentName: s.name || '',
              internal: '',
              external: '',
              total: '',
              grade: '',
              existing: false,
              markId: null
            };
          });
        }

        // fallback: if no students returned but we have existing marks, show them to edit
        if ((rows.length === 0) && Array.isArray(existingMarks) && existingMarks.length > 0) {
          rows = (existingMarks || []).map(m => ({
            admNo: m.admNo || '',
            studentName: m.studentName || '',
            internal: m.internal ?? '',
            external: m.external ?? '',
            total: m.total ?? '',
            grade: m.grade ?? '',
            existing: true,
            markId: m.id || m.markId || null
          }));
        }

        setMarksRows(rows);
      } catch (err) {
        console.error('Error preparing marks form:', err);
        setMarksRows([]);
      }
    };
    const addMarkRow = () => {
      setMarksRows([...marksRows, { admNo: '', studentName: '', internal: '', external: '', total: '', grade: '' }]);
    };

    const computeGradeFor = (exam, boundaries, total) => {
      const tot = Number(total || 0);
      if (!exam) return '';
      const totalMax = Number(exam.totalMax || (Number(exam.internalMax||0) + Number(exam.externalMax||0)));
      if (!totalMax) return '';
      const perc = (tot / totalMax) * 100;
      if (!Array.isArray(boundaries) || boundaries.length === 0) return '';

      // Try to match standardGroup heuristically using class string
      const cls = String(exam.class || '').toLowerCase();
      let candidates = boundaries;
      const exact = boundaries.filter(b => String(b.standardGroup || '').toLowerCase() === cls);
      if (exact.length > 0) candidates = exact;

      const found = candidates.find(b => perc >= Number(b.minPercentage||0) && perc <= Number(b.maxPercentage||100));
      return found ? String(found.grade || '') : '';
    };

    const updateMarkRow = (index, field, value) => {
      const updated = marksRows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === 'internal' || field === 'external') {
          const internal = Number(field === 'internal' ? value : (next.internal || 0));
          const external = Number(field === 'external' ? value : (next.external || 0));
          const total = (Number(internal) || 0) + (Number(external) || 0);
          next.total = total;
          next.grade = computeGradeFor(selectedExam, gradeBoundaries, total);
        }
        return next;
      });
      setMarksRows(updated);
    };
    const removeMarkRow = (index) => {
      const updated = marksRows.filter((_, i) => i !== index);
      setMarksRows(updated);
    };
    const handleSubmitMarks = async (e) => {
      e.preventDefault();
      if (!selectedExam || !user) return;

      // build diff: rows that are new or edited
      const changed = marksRows
        .map(r => {
          const internal = r.internal === '' || r.internal == null ? null : Number(r.internal);
          const external = r.external === '' || r.external == null ? null : Number(r.external);
          return {
            admNo: r.admNo || '',
            studentName: r.studentName || '',
            internal,
            external,
            markId: r.markId || null,
            action: r.markId ? 'update' : 'insert'
          };
        })
        // keep only rows where at least one numeric value is present
        .filter(r => (r.internal != null) || (r.external != null));

      if (changed.length === 0) {
        info('No Changes', 'No changes to save.');
        return;
      }

      await withSubmit('Saving marks...', async () => {
        await api.submitExamMarks({
          examId: selectedExam.examId,
          class: selectedExam.class,
          subject: selectedExam.subject,
          teacherEmail: user.email,
          teacherName: user.name || '',
          mode: 'upsert',           // hint for backend (safe to ignore)
          replaceAll: false,        // do NOT recreate whole class
          marks: changed
        });
      });

      setShowMarksForm(false);
      setSelectedExam(null);
      setMarksRows([]);
    };

    // Handler to view marks for an exam
    const handleViewMarks = async (exam) => {
      try {
        const marks = await api.getExamMarks(exam.examId);
        setViewExamMarks(exam.examId);
        setExamMarks(Array.isArray(marks) ? marks : []);
      } catch (err) {
        console.error('Error fetching exam marks:', err);
      }
    };
    const closeViewMarks = () => {
      setViewExamMarks(null);
      setExamMarks([]);
    };

  // Filter exams for marks entry (teacher/class teacher) if not HM.
  // Use a stronger normalization that removes spaces and non-alphanumeric
  // characters so values like "6 A" and "6A" match reliably.
  const normKey = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').replace(/^std/, '');
  // Use appNormalize defined at the top level of the app
  const userRolesNorm = (user?.roles || []).map(r => appNormalize(r));
  const userClassesSet = new Set((user?.classes || []).map(c => normKey(c)));
  const userSubjectsSet = new Set((user?.subjects || []).map(s => normKey(s)));

    // Filter exams based on user role and permissions

  const examsForTeacher = exams.filter(ex => {
    if (!user) return false;
    if (hasRole('h m')) return true;
    const exClass = normKey(ex.class);
    const exSubject = normKey(ex.subject);
    const teachesClass = userClassesSet.has(exClass);
    const teachesSubject = userSubjectsSet.has(exSubject);
    // If user is a Class Teacher, allow based on class match alone.
    const isClassTeacher = (userRolesNorm || []).some(r => r.includes('class teacher') || r === 'classteacher');
    if (isClassTeacher) return teachesClass;
    // Regular subject teacher: require both class and subject match.
    return teachesClass && teachesSubject;
  });

    // (debug helpers removed - use the normalized values defined earlier)

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
          <div className="flex space-x-3">
            {user && hasRole('h m') && (
              <button
                onClick={() => setShowExamForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Exam
              </button>
            )}
            {user && ((userRolesNorm || []).some(r => r.includes('teacher'))) && (
              <button
                onClick={() => {
                  // If there are no exams matching this teacher's classes/subjects, show feedback
                  if (!examsForTeacher || examsForTeacher.length === 0) {
                    setApiError('No exams available for your classes or subjects to enter marks.');
                    return;
                  }
                  // Teacher selects exam to enter marks; if only one exam, open directly, else pick the first
                  if (examsForTeacher.length >= 1) {
                    openMarksForm(examsForTeacher[0]);
                  }
                }}
                disabled={!examsForTeacher || examsForTeacher.length === 0}
                className={`bg-green-600 text-white px-4 py-2 rounded-lg flex items-center ${(!examsForTeacher || examsForTeacher.length === 0) ? 'opacity-50 cursor-not-allowed hover:bg-green-600' : 'hover:bg-green-700'}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Edit Marks
              </button>
            )}
          </div>
        </div>

        {/* Exam Creation Form */}
        {showExamForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Exam</h2>
            <form onSubmit={handleCreateExam} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                  <select
                    value={examFormData.examType}
                    onChange={(e) => handleExamFormChange('examType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Exam Type</option>
                    {gradeTypes.map((gt) => (
                      <option key={gt.examType} value={gt.examType}>{gt.examType}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={examFormData.class}
                    onChange={(e) => handleExamFormChange('class', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  {availableSubjects && availableSubjects.length > 0 ? (
                    <>
                      <select
                        value={examFormData.subject}
                        onChange={(e) => handleExamFormChange('subject', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map((subj) => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <div className="flex space-x-1">
                        <input
                          type="text"
                          value={examFormData.subject}
                          onChange={(e) => handleExamFormChange('subject', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Enter subject manually"
                          required
                        />
                      </div>
                      <div className="mt-1 text-xs text-amber-500">No subjects available for selection. Enter manually.</div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={examFormData.date}
                    onChange={(e) => handleExamFormChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Internal Max Marks</label>
                  <input
                    type="number"
                    value={examFormData.internalMax}
                    onChange={(e) => handleExamFormChange('internalMax', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">External Max Marks</label>
                  <input
                    type="number"
                    value={examFormData.externalMax}
                    onChange={(e) => handleExamFormChange('externalMax', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowExamForm(false);
                    setExamFormData({ examType: '', class: '', subject: '', internalMax: 20, externalMax: 80, date: todayIST() });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Marks Entry Form */}
        {showMarksForm && selectedExam && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Enter Marks – {selectedExam.subject} ({selectedExam.class})</h2>
            <p className="text-sm text-gray-600 mb-4">
              Exam: {selectedExam.examType} | Date: {selectedExam.date} | Max: {selectedExam.internalMax + selectedExam.externalMax}
            </p>
            <form onSubmit={handleSubmitMarks} className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Internal Marks</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">External Marks</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {marksRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={row.admNo}
                            onChange={(e) => updateMarkRow(index, 'admNo', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={row.studentName}
                            onChange={(e) => updateMarkRow(index, 'studentName', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={row.internal}
                            onChange={(e) => updateMarkRow(index, 'internal', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            min="0"
                            max={selectedExam.internalMax}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={row.external}
                            onChange={(e) => updateMarkRow(index, 'external', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            min="0"
                            max={selectedExam.externalMax}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-900">{row.total !== undefined && row.total !== '' ? row.total : '-'}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-900">{row.grade || '-'}</div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button type="button" onClick={() => removeMarkRow(index)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-center">
                        <button type="button" onClick={addMarkRow} className="text-blue-600 hover:text-blue-800">
                          <Plus className="h-4 w-4 inline-block mr-1" /> Add Student
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMarksForm(false);
                    setSelectedExam(null);
                    setMarksRows([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Submit Marks
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Exam List and Marks View */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Exams</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exams.map((exam) => {
                  // Use appNormalize defined at the top level of the app
                  // Determine permissions: HM can enter for any exam; Class Teacher by class; regular Teacher by class+subject
                  const isHm = hasRole('h m');
                  const isClassTeacher = hasRole('class teacher') || hasAnyRole(['classteacher']);
                  const isSubjectTeacher = hasAnyRole(['teacher']);
                  // Enhanced class match: include classTeacherFor and allow section-insensitive match by standard number
                  const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/std\s*/g, '').replace(/\s+/g, '');
                  const num = (s) => { const m = (s || '').toString().match(/\d+/); return m ? m[0] : ''; };
                  const examClassNorm = norm(exam.class);
                  const examClassNum = num(exam.class);
                  const userClasses = Array.isArray(user?.classes) ? user.classes : [];
                  const userCTFor = Array.isArray(user?.classTeacherFor) ? user.classTeacherFor : [];
                  const teachesClass = [...userClasses, ...userCTFor].some(c => norm(c) === examClassNorm || (examClassNum && num(c) === examClassNum));
                  const teachesSubject = new Set((user?.subjects||[]).map(s => appNormalize(s))).has(appNormalize(exam.subject));
                  let canEnter = false;
                  if (!user) canEnter = false;
                  else if (isHm) canEnter = true;
                  else if (isClassTeacher) canEnter = teachesClass; // Class teachers can manage their class (all sections)
                  else if (isSubjectTeacher) canEnter = teachesClass && teachesSubject;
                  // Permission check completed
                  return (
                    <tr key={exam.examId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.class}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.examType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.totalMax}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                        {canEnter && (
                          <button
                            onClick={() => openMarksForm(exam)}
                            className="text-amber-600 hover:text-amber-900 ml-2"
                          >
                            Edit Marks
                          </button>
                        )}
                        <button
                          onClick={() => handleViewMarks(exam)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Marks
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {exams.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No exams available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Marks View Table */}
        {viewExamMarks && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Marks – Exam {viewExamMarks}</h2>
            {examMarks.length === 0 ? (
              <p className="text-sm text-gray-500">No marks submitted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Internal</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">External</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {examMarks.map((m, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.admNo}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.studentName}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.internal}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.external}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.total}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.grade || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.teacherName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={closeViewMarks}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Fee Collection View - Integrated module
  const FeeCollectionView = () => {
    // Use modern fee collection UI
    return <ModernFeeCollection user={user} apiBaseUrl={api.getBaseUrl()} />;
  };

  // Class Data View (Class Teacher only)
  const ClassDataView = () => {
    // IMPORTANT: use the effective logged-in user (Google login / local login / restored state)
    // Otherwise HM/Super Admin may be treated as a class teacher with no assigned class.
    const currentUser = effectiveUser || user;

    // Check if user is Super Admin or HM - they can access all classes
    const isSuperAdminOrHM = hasAnyRole(['super admin', 'superadmin', 'super_admin', 'h m']);
    
    // Fix: Ensure className is a string, not an array
    const rawClassName = currentUser?.classTeacherFor || '';
    const defaultClassName = Array.isArray(rawClassName) ? rawClassName[0] : rawClassName;
    
    const [selectedClass, setSelectedClass] = useState(defaultClassName || '');
    const [availableClasses, setAvailableClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [performance, setPerformance] = useState(null);
    const [exams, setExams] = useState([]);
    const [error, setError] = useState(null);
    const [expandedStudents, setExpandedStudents] = useState({});

    // Fetch available classes for Super Admin/HM
    useEffect(() => {
      if (isSuperAdminOrHM) {
        const fetchClasses = async () => {
          try {
            setLoading(true);
            const studentsData = await api.getStudents('');
            const classes = [...new Set(studentsData.map(s => s.class))].sort();
            setAvailableClasses(classes);
            if (!selectedClass && classes.length > 0) {
              setSelectedClass(classes[0]);
            }
          } catch (err) {
            console.error('Error fetching classes:', err);
            setError('Failed to load classes');
          } finally {
            setLoading(false);
          }
        };
        fetchClasses();
      } else {
        // For regular class teachers, if they have a class, mark as loaded
        if (defaultClassName) {
          setLoading(false);
        }
      }
    }, [isSuperAdminOrHM, defaultClassName, selectedClass]);

    // If class teacher class arrives after login state hydration, sync it once.
    useEffect(() => {
      if (!isSuperAdminOrHM && defaultClassName && !selectedClass) {
        setSelectedClass(defaultClassName);
      }
    }, [isSuperAdminOrHM, defaultClassName, selectedClass]);

    useEffect(() => {
      const fetchClassData = async () => {
        if (!selectedClass) return;
        
        console.debug('[ClassDataView] Fetching data for class:', selectedClass);
        setLoading(true);
        setError(null);
        
        try {
          // Fetch students
          const studentsData = await api.getStudents(selectedClass);
          setStudents(Array.isArray(studentsData) ? studentsData : []);

          // Fetch performance data
          const perfData = await api.getStudentPerformance(selectedClass);
          setPerformance(perfData);

          // Fetch exams for this class
          const examsData = await api.getExams(selectedClass);
          // Filter exams for this specific class only
          const selNorm = stripStdPrefix(selectedClass).trim().toLowerCase().replace(/\s+/g, '');
          const classExams = Array.isArray(examsData) 
            ? examsData.filter(exam => stripStdPrefix(exam.class).trim().toLowerCase().replace(/\s+/g, '') === selNorm)
            : [];
          setExams(classExams);
        } catch (err) {
          console.error('[ClassDataView] Error fetching class data:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchClassData();
    }, [selectedClass]);

    const toggleStudent = (admNo) => {
      setExpandedStudents(prev => ({
        ...prev,
        [admNo]: !prev[admNo]
      }));
    };

    // For HM/Super Admin: Show loading state while fetching classes (check this FIRST)
    if (isSuperAdminOrHM && loading && !selectedClass) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">School Data</h1>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 dark:text-gray-400 ml-3">Loading classes...</p>
            </div>
          </div>
        </div>
      );
    }

    // Show error only for regular class teachers without assigned class
    if (!isSuperAdminOrHM && !defaultClassName) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Class Data</h1>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <p className="text-gray-600 dark:text-gray-400">No class assigned as class teacher.</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuperAdminOrHM ? 'School Data' : 'Class Data'} – {stripStdPrefix(selectedClass)}
          </h1>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-600">Loading class data...</p>
          </div>
        </div>
      );
    }

    const performanceStudents = performance?.students || [];
    const analytics = performance?.analytics || {};

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuperAdminOrHM ? 'School Data' : 'Class Data'} {selectedClass && `– ${stripStdPrefix(selectedClass)}`}
          </h1>
          
          {/* Class Selector for Super Admin/HM */}
          {isSuperAdminOrHM && availableClasses.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Class</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
              ))}
            </select>
          )}
        </div>

        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-900">Debug Info:</p>
          <p className="text-blue-700">Class Name: <span className="font-mono">{stripStdPrefix(selectedClass)}</span></p>
          <p className="text-blue-700">Students Found: {students.length}</p>
          <p className="text-blue-700">Exams Found: {exams.length}</p>
          <p className="text-blue-700">Check browser console for detailed logs</p>
          {error && <p className="text-red-600 mt-2">Error: {error}</p>}
        </div>

        {/* Class Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Students</h3>
            <p className="text-3xl font-bold text-blue-600">{students.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Exams Conducted</h3>
            <p className="text-3xl font-bold text-green-600">{exams.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Class Average</h3>
            <p className="text-3xl font-bold text-purple-600">
              {analytics.averagePercentage || 0}%
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        {analytics.totalStudents > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Highest</p>
                <p className="text-2xl font-bold text-green-600">{analytics.highestPercentage}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Lowest</p>
                <p className="text-2xl font-bold text-red-600">{analytics.lowestPercentage}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Pass</p>
                <p className="text-2xl font-bold text-green-600">{analytics.passCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Fail</p>
                <p className="text-2xl font-bold text-red-600">{analytics.failCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Student Performance with Term-wise Subject Breakdown */}
        {performanceStudents.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Student Performance - Term-wise</h2>
            <div className="space-y-3">
              {performanceStudents.map(student => {
                const isExpanded = expandedStudents[student.admNo];
                
                // Get all exam marks for this student grouped by subject and exam type
                const selNorm = stripStdPrefix(selectedClass).trim().toLowerCase().replace(/\s+/g, '');
                const classExamsForStudent = exams.filter(exam => stripStdPrefix(exam.class).trim().toLowerCase().replace(/\s+/g, '') === selNorm);
                const studentExamMarks = {};
                
                // Build structure: { subject: { examType: { marks, maxMarks, percentage } } }
                classExamsForStudent.forEach(exam => {
                  const subjectPerf = student.subjectPerformance?.[exam.subject];
                  if (subjectPerf) {
                    if (!studentExamMarks[exam.subject]) {
                      studentExamMarks[exam.subject] = {};
                    }
                    // For now, aggregate by subject (we'll enhance backend to give term-wise data)
                    if (!studentExamMarks[exam.subject][exam.examType]) {
                      studentExamMarks[exam.subject][exam.examType] = {
                        totalMarks: 0,
                        maxMarks: 0,
                        percentage: 0,
                        count: 0
                      };
                    }
                  }
                });
                
                // Calculate term-wise data from subjectPerformance
                // Note: Backend aggregates all exams per subject, we show overall for now
                const subjects = Object.keys(student.subjectPerformance || {});
                
                return (
                  <div key={student.admNo} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Student Header - Always Visible */}
                    <div 
                      className="flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => toggleStudent(student.admNo)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <button className="text-gray-600 hover:text-gray-900 transition-transform">
                          <svg 
                            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{student.name}</h3>
                          <p className="text-sm text-gray-600">Adm No: {student.admNo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Marks</div>
                          <div className="text-sm font-medium text-gray-900">
                            {student.totalMarks}/{student.maxMarks}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Percentage</div>
                          <div className={`text-2xl font-bold ${
                            student.percentage >= 75 ? 'text-green-600' :
                            student.percentage >= 50 ? 'text-blue-600' :
                            student.percentage >= 40 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {student.percentage}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Grade</div>
                          <div className={`text-xl font-bold ${
                            ['A+', 'A', 'B+'].includes(student.grade) ? 'text-green-600' :
                            ['B', 'C+', 'C'].includes(student.grade) ? 'text-blue-600' :
                            student.grade === 'D' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {student.grade}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Subject & Term Breakdown - Collapsible */}
                    {isExpanded && subjects.length > 0 && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        <div className="space-y-4">
                          {subjects.map(subject => {
                            const subjectPerf = student.subjectPerformance[subject];
                            const terms = subjectPerf.terms || {};
                            const termKeys = Object.keys(terms);
                            
                            return (
                              <div key={subject} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="font-semibold text-gray-900 text-base">{subject}</h4>
                                  <div className="text-right">
                                    <div className="text-xs text-gray-600">Overall</div>
                                    <div className={`text-lg font-bold ${
                                      subjectPerf.percentage >= 75 ? 'text-green-600' :
                                      subjectPerf.percentage >= 50 ? 'text-blue-600' :
                                      subjectPerf.percentage >= 40 ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      {subjectPerf.percentage}%
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {subjectPerf.totalMarks}/{subjectPerf.maxMarks}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Term-wise breakdown */}
                                {termKeys.length > 0 && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {termKeys.map(termType => {
                                      const termData = terms[termType];
                                      return (
                                        <div key={termType} className="bg-white rounded p-2 border border-gray-200">
                                          <div className="text-xs font-medium text-gray-700 mb-1">
                                            {termType}
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <div className="text-xs text-gray-600">
                                              {termData.marks}/{termData.maxMarks}
                                            </div>
                                            <div className={`text-sm font-bold ${
                                              termData.percentage >= 75 ? 'text-green-600' :
                                              termData.percentage >= 50 ? 'text-blue-600' :
                                              termData.percentage >= 40 ? 'text-yellow-600' :
                                              'text-red-600'
                                            }`}>
                                              {termData.percentage}%
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {students.length === 0 && exams.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-600 text-center">
              No data available yet. Students and exam data will appear here once added.
            </p>
          </div>
        )}
      </div>
    );
  };

  // Class Students View (Class Teacher only)
  const ClassStudentsView = () => {
    // Students state starts empty and is populated from the backend.
    const [students, setStudents] = useState([]);
    const className = user?.classTeacherFor || '';
    // Attendance form state
    const [showAttendanceForm, setShowAttendanceForm] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(todayIST());
    const [attendanceRows, setAttendanceRows] = useState([]);
    // Performance data
    const [performance, setPerformance] = useState([]);
    const [showPerformance, setShowPerformance] = useState(false);

    // Load students on mount or when the classTeacherFor changes
    useEffect(() => {
      async function fetchStudents() {
        try {
          if (user && user.classTeacherFor) {
            const data = await api.getStudents(user.classTeacherFor);
            setStudents(Array.isArray(data) ? data : []);
          }
        } catch (err) {
          console.error(err);
        }
      }
      fetchStudents();
    }, [user?.classTeacherFor]);

    // Load performance data when requested
    const loadPerformance = async () => {
      try {
        if (user && user.classTeacherFor) {
          const data = await api.getStudentPerformance(user.classTeacherFor);
          setPerformance(Array.isArray(data) ? data : []);
          setShowPerformance(true);
        }
      } catch (err) {
        console.error(err);
      }
    };

    // Initialize attendance rows when opening the form
    const openAttendanceForm = () => {
      const rows = students.map(s => ({ admNo: s.admNo, studentName: s.name, status: 'Present' }));
      setAttendanceRows(rows);
      setShowAttendanceForm(true);
    };
    const updateAttendanceRow = (index, status) => {
      const updated = attendanceRows.map((r, i) => (i === index ? { ...r, status } : r));
      setAttendanceRows(updated);
    };
    const handleSubmitAttendance = async (e) => {
      e.preventDefault();
      if (!user || !user.classTeacherFor) return;
      try {
        await withSubmit('Submitting attendance...', () => api.submitAttendance({
          date: attendanceDate,
          class: user.classTeacherFor,
          teacherEmail: user.email,
          teacherName: user.name || '',
          records: attendanceRows
        }));
        setShowAttendanceForm(false);
      } catch (err) {
        console.error('Error submitting attendance:', err);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Students{className ? ` – ${className}` : ''}</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            {user && user.classTeacherFor && (
              <button
                onClick={openAttendanceForm}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Attendance
              </button>
            )}
            {user && user.classTeacherFor && (
              <button
                onClick={loadPerformance}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-purple-700"
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                View Performance
              </button>
            )}
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Student List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No students to display.
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.admNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button type="button" className="text-blue-600 hover:text-blue-900 mr-3" onClick={() => openLessonView(student)} title="View student">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attendance Form */}
        {showAttendanceForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4">Record Attendance – {className}</h2>
            <form onSubmit={handleSubmitAttendance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">{row.admNo}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{row.studentName}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          <select
                            value={row.status}
                            onChange={(e) => updateAttendanceRow(index, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttendanceForm(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Submit Attendance
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Performance Overview */}
        {showPerformance && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4">Performance Overview – {className}</h2>
            {performance.length === 0 ? (
              <p className="text-sm text-gray-500">No performance data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Average Marks</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exams</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {performance.map((p, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.admNo}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.average.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{p.examCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowPerformance(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // All Plans View (HM only)
  // Displays all schemes and lesson plans across the school.  Allows filtering
  // by teacher email/name, class, subject and status.  The status filter
  // accepts any status string (e.g. Pending, Approved, Rejected, Ready, Pending Review).
  const AllPlansView = () => {
    const [plans, setPlans] = useState([]);
    const [filters, setFilters] = useState({ teacher: '', class: '', subject: '', status: '' });
    const [loadingPlans, setLoadingPlans] = useState(false);

    // Fetch all plans when component mounts or user changes
    useEffect(() => {
      if (!user) return;
      loadPlans();
    }, [user]);

    const loadPlans = async () => {
      try {
        setLoadingPlans(true);
        const data = await api.getAllPlans(filters.teacher, filters.class, filters.subject, filters.status);
        setPlans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading all plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };

    const handlePlanFilterChange = (field, value) => {
      setFilters(prev => ({ ...prev, [field]: value }));
    };
    // Safe no-op handler for report filter fields to satisfy lint; routes to plan filters
    const handleReportFilterChange = (field, value) => {
      setFilters(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">All Plans</h1>
          <div className="flex space-x-3">
            <button
              onClick={loadPlans}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Filter form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher (email or name)</label>
              <input
                type="text"
                value={filters.teacher}
                onChange={(e) => handleReportFilterChange('teacher', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Search teacher"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <input
                type="text"
                value={filters.class}
                onChange={(e) => handleReportFilterChange('class', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g. 10A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={filters.subject}
                onChange={(e) => handleReportFilterChange('subject', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleReportFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Ready">Ready</option>
                <option value="Needs Rework">Needs Rework</option>
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Plan Records</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term/Unit/Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.teacherName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {p.term || p.unit || p.month || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {p.noOfSessions || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {p.session || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.status}</td>
                  </tr>
                ))}
                {plans.length === 0 && !loadingPlans && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No plans found.
                    </td>
                  </tr>
                )}
                {loadingPlans && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      Loading plans...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Daily Reports Management View (HM only)
  // Allows browsing of daily reports across the school with filters for
  // teacher, class, subject, date range and completion status.
  const DailyReportsManagementView = () => {
    const [allReports, setAllReports] = useState([]); // Store all reports loaded once
    const [loadingReports, setLoadingReports] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // Empty = All
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Load all reports ONCE on component mount with default 30-day range
    useEffect(() => {
      async function fetchAllReports() {
        setLoadingReports(true);
        try {
          // Default to last 30 days if no dates set
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const defaultFrom = thirtyDaysAgo.toISOString().split('T')[0];
          const defaultTo = today.toISOString().split('T')[0];
          
          setFromDate(defaultFrom);
          setToDate(defaultTo);
          
          const data = await api.getDailyReports({
            teacher: '',
            cls: '',
            subject: '',
            fromDate: defaultFrom,
            toDate: defaultTo
          });
          const reports = Array.isArray(data) ? data : [];
          
          // Sort by date descending (newest first)
          reports.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
          });
          
          setAllReports(reports);
        } catch (err) {
          console.error('Error fetching reports:', err);
          setAllReports([]);
        } finally {
          setLoadingReports(false);
        }
      }
      if (user) {
        fetchAllReports();
      }
    }, [user]);

    // CLIENT-SIDE FILTERING
    const filteredReports = useMemo(() => {
      let result = allReports;
      
      // Filter by status
      if (statusFilter) {
        result = result.filter(r => r.completed === statusFilter);
      }
      
      // Filter by teacher
      if (selectedTeacher) {
        result = result.filter(r => r.teacherName === selectedTeacher);
      }
      
      // Filter by class
      if (selectedClass) {
        result = result.filter(r => r.class === selectedClass);
      }
      
      // Filter by subject
      if (selectedSubject) {
        result = result.filter(r => r.subject === selectedSubject);
      }

      // Filter by chapter
      if (selectedChapter) {
        result = result.filter(r => String(r.chapter || '').trim() === selectedChapter);
      }
      
      return result;
    }, [allReports, statusFilter, selectedTeacher, selectedClass, selectedSubject, selectedChapter]);

    // Get unique values for dropdowns
    const uniqueTeachers = useMemo(() => {
      return [...new Set(allReports.map(r => r.teacherName).filter(Boolean))].sort();
    }, [allReports]);

    const uniqueClasses = useMemo(() => {
      return [...new Set(allReports.map(r => r.class).filter(Boolean))].sort();
    }, [allReports]);

    const uniqueSubjects = useMemo(() => {
      return [...new Set(allReports.map(r => r.subject).filter(Boolean))].sort();
    }, [allReports]);

    const uniqueChapters = useMemo(() => {
      return [...new Set(allReports.map(r => String(r.chapter || '').trim()).filter(Boolean))].sort();
    }, [allReports]);

    // Reload reports with new date range
    const handleApplyDateFilter = async () => {
      if (!fromDate || !toDate) {
        alert('Please select both From and To dates');
        return;
      }
      
      setLoadingReports(true);
      try {
        const data = await api.getDailyReports({
          teacher: '',
          cls: '',
          subject: '',
          fromDate: fromDate,
          toDate: toDate
        });
        const reports = Array.isArray(data) ? data : [];
        
        // Sort by date descending (newest first)
        reports.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateB - dateA;
        });
        
        setAllReports(reports);
        // Reset other filters when loading new date range
        setSelectedTeacher('');
        setSelectedClass('');
        setSelectedSubject('');
        setSelectedChapter('');
        setStatusFilter('');
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoadingReports(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">All Daily Reports</h1>
          <button
            onClick={handleApplyDateFilter}
            disabled={loadingReports}
            className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {loadingReports ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Load Range
              </>
            )}
          </button>
        </div>

        {/* Date Range Filter - Primary */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm p-3 md:p-4 border border-purple-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">From Date:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex-1 sm:flex-initial px-2 md:px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">To Date:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 sm:flex-initial px-2 md:px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              />
            </div>
            <div className="text-xs text-gray-600">
              Showing {allReports.length} reports
            </div>
          </div>
        </div>

        {/* Secondary Filters - Dropdowns and Status */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
            {/* Teacher Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Teacher:</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[180px]"
              >
                <option value="">All Teachers</option>
                {uniqueTeachers.map(teacher => (
                  <option key={teacher} value={teacher}>{teacher}</option>
                ))}
              </select>
            </div>

            {/* Class Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Class:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[120px]"
              >
                <option value="">All Classes</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Subject Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Subject:</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[150px]"
              >
                <option value="">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            {/* Chapter Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Chapter:</label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[180px]"
              >
                <option value="">All Chapters</option>
                {uniqueChapters.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            {/* Status Quick Filters */}
            <div className="flex gap-2 w-full md:w-auto md:ml-auto flex-wrap">
              <button
                onClick={() => setStatusFilter('Fully Completed')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  statusFilter === 'Fully Completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ✓ Completed
              </button>
              <button
                onClick={() => setStatusFilter('Partially Completed')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  statusFilter === 'Partially Completed'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ◐ Partial
              </button>
              <button
                onClick={() => setStatusFilter('Not Started')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  statusFilter === 'Not Started'
                    ? 'bg-gray-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ○ Not Started
              </button>
              <button
                onClick={() => setStatusFilter('')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  !statusFilter
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                All Status
              </button>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(selectedTeacher || selectedClass || selectedSubject || selectedChapter) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedTeacher && (
                <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                  Teacher: {selectedTeacher}
                  <button onClick={() => setSelectedTeacher('')} className="ml-1 hover:text-blue-900">×</button>
                </span>
              )}
              {selectedClass && (
                <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                  Class: {selectedClass}
                  <button onClick={() => setSelectedClass('')} className="ml-1 hover:text-green-900">×</button>
                </span>
              )}
              {selectedSubject && (
                <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
                  Subject: {selectedSubject}
                  <button onClick={() => setSelectedSubject('')} className="ml-1 hover:text-purple-900">×</button>
                </span>
              )}
              {selectedChapter && (
                <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded-full font-medium">
                  Chapter: {selectedChapter}
                  <button onClick={() => setSelectedChapter('')} className="ml-1 hover:text-amber-900">×</button>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Daily Report Records ({filteredReports.length})</h2>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredReports.map((r, idx) => {
              const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
              const onDelete = async () => {
                if (!id) return alert('Missing report id');
                if (!confirm(
                  `Delete this report? This cannot be undone.\n\n` +
                  `Date: ${r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}\n` +
                  `Teacher: ${r.teacherName || r.teacherEmail || '-'}\n` +
                  `Class: ${r.class || '-'}\n` +
                  `Subject: ${r.subject || '-'}\n` +
                  `Period: ${r.period || '-'}\n`
                )) return;
                try {
                  setDeletingId(id);
                  const res = await api.deleteDailyReport(id, user.email);
                  if (res && res.success) {
                    setAllReports(prev => prev.filter(x => (x.id || x.reportId || `${(x.date||'').toString()}|${x.class||''}|${x.subject||''}|${x.period||''}|${String(x.teacherEmail||'').toLowerCase()}`) !== id));
                  } else {
                    alert('Delete failed: ' + (res && res.error ? res.error : 'Not allowed'));
                  }
                } catch (err) {
                  alert('Delete failed: ' + (err && err.message ? err.message : String(err)));
                } finally {
                  setDeletingId(null);
                }
              };
              return (
                <div key={idx} className="border-b border-gray-200 p-3 hover:bg-gray-50">
                  {/* Header: Date & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">
                      {r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                    {r.completed === 'Fully Completed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Fully Completed
                      </span>
                    ) : r.completed === 'Partially Completed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        ◐ Partial
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        ○ Not Started
                      </span>
                    )}
                  </div>
                  
                  {/* Teacher Name */}
                  <div className="text-sm font-medium text-gray-900 mb-1.5">{r.teacherName}</div>
                  
                  {/* Class, Subject & Period */}
                  <div className="text-xs text-gray-600 mb-1.5">
                    {r.class} • {r.subject} • Period {r.period}
                  </div>

                  {/* Chapter */}
                  {r.chapter && (
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                        Chapter: {r.chapter}
                      </span>
                    </div>
                  )}
                  
                  {/* Plan Type */}
                  {r.planType && (
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {r.planType}
                      </span>
                    </div>
                  )}
                  
                  {/* Objectives */}
                  {r.objectives && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-gray-700 mb-0.5">Objectives:</div>
                      <div className="text-xs text-gray-600 line-clamp-2 break-words">{r.objectives}</div>
                    </div>
                  )}
                  
                  {/* Activities */}
                  {r.activities && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-0.5">Activities:</div>
                      <div className="text-xs text-gray-600 line-clamp-2 break-words">{r.activities}</div>
                    </div>
                  )}
                  
                  {/* Action Button */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={onDelete} 
                      disabled={!id || deletingId === id} 
                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-40"
                    >
                      {deletingId === id ? (
                        <>
                          <span className="inline-block h-3 w-3 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>
                          Deleting…
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredReports.length === 0 && !loadingReports && (
              <div className="px-4 py-8 text-sm text-gray-500 text-center">
                No reports found.
              </div>
            )}
            {loadingReports && (
              <div className="px-4 py-8 text-sm text-gray-500 text-center">
                Loading reports...
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objectives</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((r, idx) => {
                  const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                  const onDelete = async () => {
                    if (!id) return alert('Missing report id');
                    if (!confirm(
                      `Delete this report? This cannot be undone.\n\n` +
                      `Date: ${r.date || '-'}\n` +
                      `Teacher: ${r.teacherName || r.teacherEmail || '-'}\n` +
                      `Class: ${r.class || '-'}\n` +
                      `Subject: ${r.subject || '-'}\n` +
                      `Period: ${r.period || '-'}\n`
                    )) return;
                    try {
                      setDeletingId(id);
                      const res = await api.deleteDailyReport(id, user.email);
                      if (res && res.success) {
                        setAllReports(prev => prev.filter(x => (x.id || x.reportId || `${(x.date||'').toString()}|${x.class||''}|${x.subject||''}|${x.period||''}|${String(x.teacherEmail||'').toLowerCase()}`) !== id));
                      } else {
                        alert('Delete failed: ' + (res && res.error ? res.error : 'Not allowed'));
                      }
                    } catch (err) {
                      alert('Delete failed: ' + (err && err.message ? err.message : String(err)));
                    } finally {
                      setDeletingId(null);
                    }
                  };
                  return (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.teacherName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.chapter || ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.planType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.completed}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.objectives}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.activities}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <button onClick={onDelete} disabled={!id || deletingId === id} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 disabled:opacity-40 inline-flex items-center">
                        {deletingId === id && (
                          <span className="inline-block h-3 w-3 mr-1 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>
                        )}
                        {deletingId === id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )})}
                {filteredReports.length === 0 && !loadingReports && (
                  <tr>
                    <td colSpan={11} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No reports found.
                    </td>
                  </tr>
                )}
                {loadingReports && (
                  <tr>
                    <td colSpan={11} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      Loading reports...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // My Daily Reports (Teacher self-history)
  const MyDailyReportsView = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rangeMode, setRangeMode] = useState('7d'); // 7d | month | custom
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [chapterFilter, setChapterFilter] = useState('');
    const [substitutionOnly, setSubstitutionOnly] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(1);
    const [maxDisplay, setMaxDisplay] = useState(1000); // soft cap
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [schemeLookup, setSchemeLookup] = useState({});
    const email = user?.email || '';

    const isSubstitutionReport = useCallback((r) => {
      if (!r) return false;
      const v = r.isSubstitution;
      if (v === true) return true;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['true', 'yes', '1', 'y', 't'].includes(s)) return true;
        if (s.includes('substitution')) return true;
      }
      // Backward compatibility: some older reports may miss isSubstitution but include metadata
      if (r.absentTeacher) return true;
      if (r.regularSubject || r.substituteSubject) return true;
      if (String(r.planType || '').toLowerCase().includes('substi')) return true;
      return false;
    }, []);

    const getChapterDisplay = useCallback((r) => {
      if (!r) return '-';
      const raw = String(r.chapter || '').trim();
      if (raw) return raw;
      if (isSubstitutionReport(r)) return 'Substitution period (no plan)';
      return 'Unknown Chapter';
    }, [isSubstitutionReport]);

    const computeDates = useCallback(() => {
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      if (rangeMode === '7d') {
        const past = new Date(); past.setDate(past.getDate() - 6);
        return { from: past.toISOString().split('T')[0], to: isoToday };
      }
      if (rangeMode === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: start.toISOString().split('T')[0], to: isoToday };
      }
      if (rangeMode === 'custom' && customFrom && customTo) {
        return { from: customFrom, to: customTo };
      }
      return { from: isoToday, to: isoToday };
    }, [rangeMode, customFrom, customTo]);

    const loadMyReports = useCallback(async () => {
      if (!email) return;
      const { from, to } = computeDates();
      setLoading(true);
      try {
        const data = await api.getDailyReports({ teacher: email, fromDate: from, toDate: to, cls: classFilter, subject: subjectFilter });
        let arr = Array.isArray(data) ? data : [];
        if (arr.length > maxDisplay) arr = arr.slice(0, maxDisplay);
        setReports(arr);
      } catch (e) {
        console.warn('Failed to load my reports', e);
        setReports([]);
      } finally {
        setLoading(false);
      }
    }, [email, computeDates, classFilter, subjectFilter, maxDisplay]);

    useEffect(() => { 
      setPage(1); 
      loadMyReports(); 
    }, [rangeMode, customFrom, customTo, subjectFilter, classFilter, email, maxDisplay, refreshTrigger, loadMyReports]);

    // Load teacher schemes to map total sessions by class/subject/chapter
    useEffect(() => {
      const loadSchemes = async () => {
        if (!email) return;
        try {
          const teacherSchemes = await api.getTeacherSchemes(email);
          const arr = Array.isArray(teacherSchemes) ? teacherSchemes : [];
          const map = {};
          for (const s of arr) {
            const key = `${(s.class||'').toLowerCase()}|${(s.subject||'').toLowerCase()}|${(s.chapter||'').toLowerCase()}`;
            const nos = Number(s.noOfSessions || s.totalSessions || 0);
            if (key && !isNaN(nos) && nos > 0) map[key] = nos;
          }
          setSchemeLookup(map);
        } catch (e) {
          console.warn('Failed to load teacher schemes for total sessions', e);
          setSchemeLookup({});
        }
      };
      loadSchemes();
    }, [email]);

    const getTotalSessionsForReport = useCallback((r) => {
      // Prefer value directly from report if backend provides
      const direct = Number(r.totalSessions || r.noOfSessions || 0);
      if (!isNaN(direct) && direct > 0) return direct;
      const key = `${(r.class||'').toLowerCase()}|${(r.subject||'').toLowerCase()}|${(r.chapter||'').toLowerCase()}`;
      return schemeLookup[key] || '';
    }, [schemeLookup]);

    const filteredReports = reports
      .filter(r => {
        if (!r) return false;
        if (substitutionOnly && !isSubstitutionReport(r)) return false;
        if (chapterFilter) {
          const needle = chapterFilter.toLowerCase().trim();
          const hay = getChapterDisplay(r).toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });

    const total = filteredReports.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginated = filteredReports.slice((page - 1) * pageSize, page * pageSize);

    const exportCSV = () => {
      if (!filteredReports.length) return;
      const headers = ['Date','Class','Subject','Period','Chapter','Session','Completed','Notes'];
      const lines = [headers.join(',')].concat(filteredReports.map(r => [r.date, r.class, r.subject, `P${r.period}`, (getChapterDisplay(r)||'').replace(/,/g,';'), r.sessionNo||'', r.completed||'', (r.notes||'').replace(/\n/g,' ').replace(/,/g,';')].join(',')));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const { from, to } = computeDates();
      a.download = `daily-reports-${email}-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const getCompletionLabel = useCallback((r) => {
      const pct = Number(r?.completionPercentage);
      if (!isNaN(pct)) {
        if (pct <= 0) return 'Not Started';
        if (pct < 50) return 'Started';
        if (pct < 75) return 'Half Done';
        if (pct < 100) return 'Almost Done';
        return 'Complete';
      }
      return r?.chapterStatus || r?.completed || r?.lessonProgressTracked || r?.status || '-';
    }, []);

    const isVerifiedReport = useCallback((r) => {
      const v = r?.verified;
      if (v === true) return true;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') return ['true', 'yes', '1', 'y', 't', 'verified', 'TRUE'].includes(v.trim().toLowerCase()) || v.trim() === 'TRUE';
      return false;
    }, []);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">My Daily Reports History</h1>
          <button onClick={() => setRefreshTrigger(t => t + 1)} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-2">
              <button onClick={() => setRangeMode('7d')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='7d' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Last 7 Days</button>
              <button onClick={() => setRangeMode('month')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>This Month</button>
              <button onClick={() => setRangeMode('custom')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Custom</button>
            </div>
            {rangeMode === 'custom' && (
              <div className="flex gap-2 items-center">
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                <span className="text-gray-500">to</span>
                <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              </div>
            )}
            <input placeholder="Class" value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Subject" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Chapter" value={chapterFilter} onChange={e=>setChapterFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
              <input type="checkbox" checked={substitutionOnly} onChange={e=>setSubstitutionOnly(e.target.checked)} />
              Substitution only
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Page size</span>
              <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1);}} className="px-2 py-1 border rounded-lg">
                {[25,50,100,200].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Max</span>
              <select value={maxDisplay} onChange={e=> setMaxDisplay(Number(e.target.value))} className="px-2 py-1 border rounded-lg">
                {[200,500,1000].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={exportCSV} disabled={!filteredReports.length} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-40">Export CSV</button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setGroupByClass(v => { const next = !v; if (next) setGroupByChapter(false); return next; }); }}
                className={`px-3 py-2 text-sm rounded-md border ${groupByClass ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                title="Group by Class"
              >
                Group by Class
              </button>
              <button
                type="button"
                onClick={() => { setGroupByChapter(v => { const next = !v; if (next) setGroupByClass(false); return next; }); }}
                className={`px-3 py-2 text-sm rounded-md border ${groupByChapter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                title="Group by Chapter"
              >
                Group by Chapter
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600">Showing reports for <strong>{email}</strong> {(() => { const {from,to}=computeDates(); return `(${from} → ${to})`; })()} • {total} total</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {(() => {
            const base = filteredReports;
            if (groupByClass || groupByChapter) {
              const keyFn = (r) => groupByClass ? (r.class || 'Unknown Class') : getChapterDisplay(r);
              const groups = {};
              for (const r of base) {
                const k = keyFn(r);
                if (!groups[k]) groups[k] = [];
                groups[k].push(r);
              }
              const keys = Object.keys(groups).sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
              return (
                <div className="divide-y divide-gray-200">
                  {keys.map(k => {
                    const list = groups[k].slice().sort((a,b)=> {
                      // sort by date then period
                      const ad = String(a.date||'');
                      const bd = String(b.date||'');
                      const ds = ad.localeCompare(bd);
                      if (ds !== 0) return ds;
                      return Number(a.period||0) - Number(b.period||0);
                    });
                    return (
                      <div key={k} className="">
                        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                          <div className="font-semibold text-gray-900">{groupByClass ? `Class: ${k}` : `Chapter: ${k}`}</div>
                          <div className="text-xs text-gray-600">{list.length} report(s)</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                                {!groupByClass && (<th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>)}
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Period</th>
                                {!groupByChapter && (<th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>)}
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Session</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Total Sessions</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Completed</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {list.map(r => {
                                const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                                const displayDate = (() => {
                                  const d = r.date;
                                  if (!d) return '-';
                                  const s = String(d);
                                  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                                  try { const dt = new Date(s); if (!isNaN(dt.getTime())) return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); } catch {}
                                  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
                                  return s;
                                })();
                                const completedVal = getCompletionLabel(r);
                                const subTag = isSubstitutionReport(r);
                                return (
                                  <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}>
                                    <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                                    {!groupByClass && (<td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>)}
                                    <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                                    <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                                    {!groupByChapter && (
                                      <td className="px-2 py-2 text-xs text-gray-700 truncate" title={subTag ? 'Substitution period' : ''}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          {subTag && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">Substitution</span>
                                          )}
                                          <span className="truncate">{getChapterDisplay(r)}</span>
                                        </div>
                                      </td>
                                    )}
                                    <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                                    <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                                    <td className="px-2 py-2 text-xs">{completedVal}</td>
                                    <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                                    <td className="px-2 py-2 text-xs">
                                      {isVerifiedReport(r) ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Verified</span>
                                          {r.verifiedBy && (<span className="text-[10px] text-gray-500">by {r.verifiedBy.split('@')[0]}</span>)}
                                        </div>
                                      ) : r.reopenReason ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Reopened</span>
                                          <span className="text-[10px] text-gray-600 cursor-help max-w-[120px] truncate" title={r.reopenReason}>{r.reopenReason}</span>
                                          {r.reopenedBy && (<span className="text-[10px] text-gray-500">by {r.reopenedBy.split('@')[0]}</span>)}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-700">Submitted</span>
                                      )}
                                    </td>
                                      <td className="px-2 py-2 text-xs text-right"></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Flat, paginated table when grouping is off
            return (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Reports ({total})</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <button onClick={()=> setPage(p=> Math.max(1, p-1))} disabled={page===1} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                    <span>Page {page}/{totalPages}</span>
                    <button onClick={()=> setPage(p=> Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Period</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Session</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Total Sessions</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Completed</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading && (<tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">Loading...</td></tr>)}
                      {!loading && filteredReports.length === 0 && (<tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No reports in this range.</td></tr>)}
                      {!loading && paginated.map(r => {
                        const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                        const displayDate = (() => {
                          const d = r.date;
                          if (!d) return '-';
                          const s = String(d);
                          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                          try { const dt = new Date(s); if (!isNaN(dt.getTime())) return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); } catch {}
                          if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
                          return s;
                        })();
                        const completedVal = getCompletionLabel(r);
                        const subTag = isSubstitutionReport(r);
                        return (
                        <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}> 
                          <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 truncate" title={subTag ? 'Substitution period' : ''}>
                            <div className="flex items-center gap-2 min-w-0">
                              {subTag && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">Substitution</span>
                              )}
                              <span className="truncate">{getChapterDisplay(r)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                          <td className="px-2 py-2 text-xs">{completedVal}</td>
                          <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                          <td className="px-2 py-2 text-xs">
                            {isVerifiedReport(r) ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Verified</span>
                                {r.verifiedBy && (<span className="text-[10px] text-gray-500">by {r.verifiedBy.split('@')[0]}</span>)}
                              </div>
                            ) : r.reopenReason ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Reopened</span>
                                <span className="text-[10px] text-gray-600 cursor-help max-w-[120px] truncate" title={r.reopenReason}>{r.reopenReason}</span>
                                {r.reopenedBy && (<span className="text-[10px] text-gray-500">by {r.reopenedBy.split('@')[0]}</span>)}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-700">Submitted</span>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  // Main render wrapped in try/catch so render-time exceptions surface visibly
  try {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!effectiveUser) {
      return (
        <>
          <ApiErrorBanner error={apiError} onDismiss={() => setApiError(null)} />
          {googleAuth?.loading && !effectiveUser ? (
            <LoadingSplash message="Restoring session..." />
          ) : (
            <LoginForm onSuccess={handleManualLoginSuccess} />
          )}
        </>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        {/* Send Notification Modal */}
        {showSendNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[99999] flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Send Notice</h3>
                  <button
                    onClick={() => setShowSendNotification(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const response = await api.sendCustomNotification(
                      effectiveUser.email,
                      notificationData.title,
                      notificationData.message,
                      notificationData.priority.toUpperCase(),
                      notificationData.recipients
                    );
                    
                    // Show success message
                    alert(`Notice "${notificationData.title}" sent successfully to ${notificationData.recipients}!`);
                    
                    // Reset form and close modal
                    setNotificationData({
                      title: '',
                      message: '',
                      priority: 'normal',
                      recipients: 'all'
                    });
                    setShowSendNotification(false);
                  } catch (error) {
                    console.error('Error sending notification:', error);
                    alert('Error sending notification: ' + error.message);
                  }
                }}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="notificationTitle" className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        id="notificationTitle"
                        value={notificationData.title}
                        onChange={(e) => setNotificationData({...notificationData, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Assembly Notice"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="notificationMessage" className="block text-sm font-medium text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        id="notificationMessage"
                        rows="3"
                        value={notificationData.message}
                        onChange={(e) => setNotificationData({...notificationData, message: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., All should assemble in main hall at 10:30 AM"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="notificationPriority" className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        id="notificationPriority"
                        value={notificationData.priority}
                        onChange={(e) => setNotificationData({...notificationData, priority: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="notificationRecipients" className="block text-sm font-medium text-gray-700 mb-1">
                        Send To
                      </label>
                      <select
                        id="notificationRecipients"
                        value={notificationData.recipients}
                        onChange={(e) => setNotificationData({...notificationData, recipients: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Staff</option>
                        <option value="teachers">Teachers Only</option>
                        <option value="class_teachers">Class Teachers Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowSendNotification(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      Send Notice
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        
        {/* Global submit overlay rendered at app root */}
        <SubmitOverlay />
        <LessonModal />
        <ApiErrorBanner error={apiError} onDismiss={() => setApiError(null)} />
        
        <div className="flex h-screen min-w-0">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 min-w-0 overflow-auto p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
              {renderContent()}
            </main>
          </div>
        </div>
        <PWAInstallBanner />
        <PWAControls />
      </div>
    );
  } catch (err) {
    // Log full error to console and render a visible fallback so the developer can copy the stack
    console.error('App render error:', err);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-3xl w-full bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-red-600 mb-3">Application render error</h2>
          <p className="text-sm text-gray-700 mb-4">An error occurred while rendering the application. The error stack is shown below — please paste it into the chat.</p>
          <pre className="text-xs text-gray-900 whitespace-pre-wrap bg-gray-100 rounded p-3 overflow-auto" style={{maxHeight: '50vh'}}>{err && (err.stack || err.message || String(err))}</pre>
        </div>
      </div>
    );
  }
}

// Main App component wrapped with ToastProvider
const AppWithToast = () => {
  return (
    <ToastProvider>
      <App />
      <PerformanceDebugger />
    </ToastProvider>
  );
};

export default AppWithToast;


