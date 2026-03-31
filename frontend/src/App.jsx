/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable import/order */
import { 
  User, 
  BookOpen, 
  Calendar, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Book,
  BarChart2,
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
  Target,
  Settings
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import * as api from './api'
import LoadingSplash from './auth/LoadingSplash';
import LoginForm from './auth/LoginForm';
import AnimatedPage from './components/AnimatedPage';
import PerformanceDebugger from './components/PerformanceDebugger';
import PWAControls from './components/PWAControls';
import PWAInstallBanner from './components/PWAInstallBanner';
import { hasRole as userHasRole, hasAnyRole as userHasAnyRole, isAdmin, isClassTeacher } from './utils/roles';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { ToastProvider, useToast } from './hooks/useToast';
import ApiErrorBanner from './components/shared/ApiErrorBanner';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
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
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AuditLog = lazy(() => import('./components/AuditLog'));
const AdminDataEditor = lazy(() => import('./components/AdminDataEditor'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const SchemeApprovalsView = lazy(() => import('./views/SchemeApprovalsView'));
const LessonApprovalsView = lazy(() => import('./views/LessonApprovalsView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const SubstitutionsView = lazy(() => import('./views/SubstitutionsView'));
const ReportsView = lazy(() => import('./views/ReportsView'));
const SchemesView = lazy(() => import('./views/SchemesView'));
const LessonPlansView = lazy(() => import('./views/LessonPlansView'));
const ClassStudentsView = lazy(() => import('./views/ClassStudentsView'));
const DailyReportsManagementView = lazy(() => import('./views/DailyReportsManagementView'));
const MyDailyReportsView = lazy(() => import('./views/MyDailyReportsView'));
const FeeCollectionView = lazy(() => import('./views/FeeCollectionView'));
const HMDashboardView = lazy(() => import('./views/HMDashboardView'));
const SubstitutionAnalyticsView = lazy(() => import('./components/SubstitutionAnalyticsView'));
const MissingDailyReportsTeacherwiseView = lazy(() => import('./components/MissingDailyReportsTeacherwiseView'));
const FundCollectionModule = lazy(() => import('./components/FundCollectionModule'));
const ExpenseManagementModule = lazy(() => import('./components/ExpenseManagementModule'));
const FinancialDashboard = lazy(() => import('./components/FinancialDashboard'));
const LessonCascading = lazy(() => import('./components/LessonCascading'));

// Keep lightweight components as regular imports
import { periodToTimeString, todayIST, formatDateForInput, formatLocalDate } from './utils/dateUtils';
// moved 'lucide-react' import above to satisfy import ordering

// Common utility functions to avoid duplication
const appNormalize = (s) => (s || '').toString().trim().toLowerCase();

// ---------------------------------------------------------------------------
// Module-scope pure utilities — no App state, stable across renders
// ---------------------------------------------------------------------------
const stripStdPrefix = (className) => {
  if (!className) return '';
  const v = Array.isArray(className) ? className[0] : className;
  return String(v).trim().replace(/^STD\s*/i, '').trim();
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Kolkata'
    });
  } catch (e) {
    return dateString;
  }
};

const subjectDisplayName = (subject) => {
  const s = String(subject || '').trim();
  if (!s) return '';
  if (/^english\s+grammar$/i.test(s)) return 'Eng G';
  return s;
};

// ---------------------------------------------------------------------------
// Module-scope components — stable identities prevent unmount/remount on
// every parent re-render (unlike components defined inside App()).
// ---------------------------------------------------------------------------
const Detail = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-gray-900 dark:text-gray-100">{value ?? '-'}</div>
  </div>
);

const SubmitOverlay = ({ submitting }) => (
  submitting && submitting.active ? (
    <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 flex items-center space-x-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <div className="text-sm text-gray-700">{submitting.message || 'Submitting...'}</div>
      </div>
    </div>
  ) : null
);

const LessonModal = ({ show, lesson, onClose }) => (
  show && lesson ? (
    <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-lg p-4 md:p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{lesson.title || lesson.chapter || lesson.lpId || lesson.schemeId || lesson.class || 'Details'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <Detail label="Class" value={stripStdPrefix(lesson.class)} />
            <Detail label="Subject" value={lesson.subject} />
            <Detail label="Chapter" value={lesson.chapter} />
            <Detail label="Session" value={
              lesson.session && lesson.noOfSessions
                ? `${lesson.session} of ${lesson.noOfSessions}`
                : lesson.session
                  ? lesson.session
                  : lesson.noOfSessions
                    ? `${lesson.noOfSessions} sessions`
                    : '-'
            } />
            <Detail label="Teacher" value={lesson.teacherName || lesson.teacher || ''} />
            <Detail label="Status" value={lesson.status} />
            {lesson.selectedDate && <Detail label="Date" value={formatDate(lesson.selectedDate)} />}
            {lesson.selectedPeriod && <Detail label="Period" value={lesson.selectedPeriod} />}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Learning Objectives</h4>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-3 rounded">
              {lesson.learningObjectives || lesson.objectives || '-'}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teaching Methods</h4>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-3 rounded">
              {lesson.teachingMethods || lesson.activities || '-'}
            </div>
          </div>
          {lesson.resourcesRequired && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Resources Required</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">{lesson.resourcesRequired}</div>
            </div>
          )}
          {lesson.assessmentMethods && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Assessment Methods</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">{lesson.assessmentMethods}</div>
            </div>
          )}
          {lesson.reviewComments && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-red-700 mb-2">Review Comments</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-red-50 p-3 rounded">{lesson.reviewComments}</div>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
        </div>
      </div>
    </div>
  ) : null
);

const App = () => {
  
  // Get toast functions for notifications
  const { success, error, warning, info } = useToast();
  
  // Theme styling relies on 'dark' class on <html>; avoid consuming theme in App to prevent re-renders on toggle
  
  // API error banner state
  const [apiError, setApiError] = useState(null);
  
  // App settings for the whole application
  const [appSettings, setAppSettings] = useState({
    allowNextWeekOnly: false,    // Next-week-only restriction disabled
    allowBackfillReporting: false,
    dailyReportDeleteMinutes: 0,
    cascadeAutoEnabled: false,
    lessonplanBulkOnly: false,
    lessonplanNotifyEnabled: false,
    lessonplanNotifyRoles: '',
    lessonplanNotifyEmails: '',
    lessonplanNotifyEvents: '',
    periodTimes: null,           // Will store custom period times if available
    periodTimesWeekday: null,    // Monday-Thursday period times
    periodTimesFriday: null,     // Friday period times
    periodTimesByClassRaw: '',

    // Missing Daily Reports (teacher dashboard)
    // Controlled by HM via Settings sheet (served from getAppSettings)
    missingDailyReports: {
      lookbackDays: 7,
      escalationDays: 2,
      maxRangeDays: 31,
      allowCustomRange: true
    }
  });
  
  const memoizedSettings = useMemo(() => appSettings, [appSettings]);

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

  const normalizeSettings = (settings) => {
    const s = settings || {};
    return {
      allowNextWeekOnly: false, // Ignore sheet value; do not restrict to next week
      allowBackfillReporting: !!s.allowBackfillReporting,
      dailyReportDeleteMinutes: Number(s.dailyReportDeleteMinutes ?? 0) || 0,
      cascadeAutoEnabled: !!s.cascadeAutoEnabled,
      lessonplanBulkOnly: !!s.lessonplanBulkOnly,
      lessonplanNotifyEnabled: !!s.lessonplanNotifyEnabled,
      lessonplanNotifyRoles: String(s.lessonplanNotifyRoles || ''),
      lessonplanNotifyEmails: String(s.lessonplanNotifyEmails || ''),
      lessonplanNotifyEvents: String(s.lessonplanNotifyEvents || ''),
      periodTimes: s.periodTimes || s.periodTimesWeekday || null,
      periodTimesWeekday: s.periodTimesWeekday || null,
      periodTimesFriday: s.periodTimesFriday || null,
      periodTimesByClassRaw: String(s.periodTimesByClassRaw || ''),
      missingDailyReports: {
        lookbackDays: Number(s?.missingDailyReports?.lookbackDays ?? 7) || 7,
        escalationDays: Number(s?.missingDailyReports?.escalationDays ?? 2) || 2,
        maxRangeDays: Number(s?.missingDailyReports?.maxRangeDays ?? 31) || 31,
        allowCustomRange: s?.missingDailyReports?.allowCustomRange !== false
      }
    };
  };

  const handleSettingsUpdated = (response) => {
    const settings = response?.data || response;
    if (settings) {
      setAppSettings(normalizeSettings(settings));
    }
  };
  
  // Fetch app settings from the API
  useEffect(() => {
    async function fetchAppSettings() {
      try {
        const response = await api.getAppSettings();
        
        // Backend wraps response in {status, data, timestamp}
        const settings = response?.data || response;
        
        if (settings) {
          setAppSettings(normalizeSettings(settings));
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
  const submitInFlightRef = useRef(null);

  const withSubmit = useCallback(async (message, fn) => {
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
  }, [success, error]);


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

  // Role helpers — use helpers from utils/roles.js
  const currentUser = effectiveUser || user || null;
  const hasCurrentUserRole = (role) => userHasRole(currentUser, role);
  const hasCurrentUserAnyRole = (roles) => userHasAnyRole(currentUser, roles);

  // Backward compatibility callbacks (used in getNavigationItems and other places)
  const hasRole = useCallback(
    (token) => userHasRole(effectiveUser || user, token),
    [effectiveUser, user]
  );

  const hasAnyRole = useCallback(
    (tokens) => userHasAnyRole(effectiveUser || user, tokens),
    [effectiveUser, user]
  );

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
        if (hasCurrentUserRole('teacher') && currentUser?.email) {
          promises.push(
            api.getApprovedSchemesForLessonPlanning(currentUser.email)
              .catch((err) => { console.warn('Failed to prefetch approved schemes:', err); return null; })
          );
        }
      } catch {}

      Promise.all(promises).catch((err) => { console.warn('Prefetch failed:', err); });
    }
  }, [currentUser?.email]);

  // Navigation items based on user role
  const getNavigationItems = useCallback(() => {
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

    // Admin gets access to everything (monitoring & management, not teacher workflows)
    if (hasAnyRole(['admin'])) {
      items.push(
        // User Management
        { id: 'users', label: 'User Management', icon: Users },
        // Academic Oversight Group
        { 
          id: 'academic-oversight-group', 
          label: 'Academic Oversight', 
          icon: BookCheck, 
          isGroup: true,
          children: [
            { id: 'scheme-approvals', label: 'Scheme Approvals', icon: FileCheck },
            { id: 'lesson-approvals', label: 'Lesson Approvals', icon: BookCheck },
            { id: 'daily-oversight', label: 'Daily Oversight', icon: ClipboardCheck },
            { id: 'missing-daily-reports', label: 'Missing Reports', icon: AlertTriangle }
          ]
        },
        // Substitutions Group
        { 
          id: 'substitutions-group', 
          label: 'Substitutions', 
          icon: UserPlus, 
          isGroup: true,
          children: [
            { id: 'substitutions', label: 'Manage Substitutions', icon: UserPlus },
            { id: 'substitution-analytics', label: 'Analytics', icon: BarChart2 }
          ]
        },
        // Timetable Group
        { 
          id: 'timetable-group', 
          label: 'Timetable', 
          icon: CalendarDays, 
          isGroup: true,
          children: [
            { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
            { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays }
          ]
        },
        // Standalone Items
        { id: 'assessments', label: 'Assessments', icon: Award },
        { id: 'class-data', label: 'School Data', icon: UserCheck },
        { id: 'admin-data', label: 'Admin Data', icon: Edit2 },
        // Financial Group
        { 
          id: 'financial-group', 
          label: 'Financial', 
          icon: DollarSign, 
          isGroup: true,
          children: [
            { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign },
            { id: 'fund-collection', label: 'Fund Collection', icon: DollarSign },
            { id: 'expense-management', label: 'Expense Management', icon: DollarSign },
            { id: 'financial-dashboard', label: 'Dashboard', icon: Target }
          ]
        },
        // System Group
        { 
          id: 'system-group', 
          label: 'System', 
          icon: Settings, 
          isGroup: true,
          children: [
            { id: 'lesson-cascading', label: 'Lesson Cascading', icon: Calendar },
            { id: 'audit-log', label: 'Audit Log', icon: Shield },
            { id: 'settings', label: 'Settings', icon: Settings }
          ]
        }
      );
      return items;
    }

    // Accounts role: Fee Collection + Financial
    if (hasAnyRole(['accounts', 'accountant', 'account'])) {
      items.push(
        { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign },
        { id: 'fund-collection', label: 'Fund Collection', icon: DollarSign },
        { id: 'expense-management', label: 'Expense Management', icon: DollarSign },
        { id: 'financial-dashboard', label: 'Financial Dashboard', icon: Target }
      );
      return items;
    }

    // HR role: Substitutions, Timetable, Financial
    if (hasAnyRole(['hr', 'h r'])) {
      items.push(
        // Substitutions Group
        { 
          id: 'substitutions-group', 
          label: 'Substitutions', 
          icon: UserPlus, 
          isGroup: true,
          children: [
            { id: 'substitutions', label: 'Manage Substitutions', icon: UserPlus },
            { id: 'substitution-analytics', label: 'Analytics', icon: BarChart2 }
          ]
        },
        // Timetable Group
        { 
          id: 'timetable-group', 
          label: 'Timetable', 
          icon: CalendarDays, 
          isGroup: true,
          children: [
            { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
            { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays }
          ]
        },
        // Financial
        { id: 'fee-collection', label: 'Fee Defaulters', icon: DollarSign },
        { id: 'fund-collection', label: 'Fund Collection', icon: DollarSign },
        { id: 'expense-management', label: 'Expense Management', icon: DollarSign }
      );
      return items;
    }

    if (hasAnyRole(['teacher','class teacher'])) {
      items.push(
        { id: 'schemes', label: 'Schemes of Work', icon: Book },
        { id: 'lessonplans', label: 'Lesson Plans', icon: BookOpen },
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'my-substitutions', label: 'My Substitutions', icon: UserPlus },
        { id: 'reports', label: 'Daily Reports (Enhanced)', icon: FileText },
        { id: 'my-daily-reports', label: 'My Reports History', icon: FileClock },
        { id: 'fund-collection', label: 'Fund Collection', icon: DollarSign },
        { id: 'expense-management', label: 'Expense Claims', icon: DollarSign }
      );
      // Teachers and class teachers can also manage exams: view available exams,
      // enter marks for their classes and subjects, and view marks.
      items.push({ id: 'assessments', label: 'Assessments', icon: Award });
    }

    if (hasCurrentUserRole('class teacher')) {
      items.push(
        { id: 'class-data', label: 'Class Data', icon: UserCheck },
        { id: 'class-students', label: 'Students', icon: Users },
        { id: 'fee-collection', label: 'Fee Defaulters', icon: DollarSign }
      );
    }

    if (hasCurrentUserRole('h m')) {
      items.push(
        // Academic Oversight Group
        { 
          id: 'academic-oversight-group', 
          label: 'Academic Oversight', 
          icon: BookCheck, 
          isGroup: true,
          children: [
            { id: 'scheme-approvals', label: 'Scheme Approvals', icon: FileCheck },
            { id: 'lesson-approvals', label: 'Lesson Approvals', icon: BookCheck },
            { id: 'daily-oversight', label: 'Daily Oversight', icon: ClipboardCheck },
            { id: 'missing-daily-reports', label: 'Missing Reports', icon: AlertTriangle },
            { id: 'daily-reports-management', label: 'All Reports', icon: FileText }
          ]
        },
        // Substitutions Group
        { 
          id: 'substitutions-group', 
          label: 'Substitutions', 
          icon: UserPlus, 
          isGroup: true,
          children: [
            { id: 'substitutions', label: 'Manage Substitutions', icon: UserPlus },
            { id: 'substitution-analytics', label: 'Analytics', icon: BarChart2 }
          ]
        },
        // Timetable Group
        { 
          id: 'timetable-group', 
          label: 'Timetable', 
          icon: CalendarDays, 
          isGroup: true,
          children: [
            { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
            { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays }
          ]
        },
        // Standalone Items
        { id: 'assessments', label: 'Assessments', icon: Award },
        { id: 'class-data', label: 'School Data', icon: UserCheck },
        { id: 'fee-collection', label: 'Fee Defaulters', icon: DollarSign },
        // Financial Group
        { 
          id: 'financial-group', 
          label: 'Financial', 
          icon: DollarSign, 
          isGroup: true,
          children: [
            { id: 'fund-collection', label: 'Fund Collection', icon: DollarSign },
            { id: 'expense-management', label: 'Expense Management', icon: DollarSign },
            { id: 'financial-dashboard', label: 'Dashboard', icon: Target }
          ]
        },
        // System Group
        { 
          id: 'system-group', 
          label: 'System', 
          icon: Settings, 
          isGroup: true,
          children: [
            { id: 'lesson-cascading', label: 'Lesson Cascading', icon: Calendar },
            { id: 'audit-log', label: 'Audit Log', icon: Shield },
            { id: 'settings', label: 'Settings', icon: Settings }
          ]
        }
      );
    }

    // Students can view their report cards
    if (hasAnyRole(['student'])) {
      items.push({ id: 'assessments', label: 'My Report Card', icon: FileText });
    }

    return items;
  }, [effectiveUser, user, hasRole, hasAnyRole]);

  const navigationItems = useMemo(() => getNavigationItems(), [getNavigationItems]);

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

    // Lesson plan warning removed from teacher dashboard

    const [todaysPlansState, setTodaysPlansState] = useState({
      loading: false,
      periods: [],
      lessonsByPeriod: {},
      error: null,
      isNonTeachingDay: false,
      reason: '',
      date: todayIST()
    });

    // Live period (teacher dashboard)
    const [liveTimetableState, setLiveTimetableState] = useState({ loading: false, periods: [], error: null });
    const [nowTick, setNowTick] = useState(0);

    // Missing daily reports moved to My Reports History

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
          if (hasCurrentUserRole('h m')) {
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
          } else if (hasCurrentUserAnyRole(['teacher','class teacher'])) {
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
              : (hasCurrentUserRole('class teacher') ? classTeacherFor : []);

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

              if (hasCurrentUserRole('class teacher') && uniqueTeachingClasses.length > 0) {
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
                      if (hasCurrentUserRole('class teacher') && classTeacherFor.length > 0) {
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

    // Lesson plan pending summary removed from teacher dashboard

    // Teacher dashboard: load today's timetable + plans in a single call.
    useEffect(() => {
      if (!currentUser?.email) return;
      if (!hasCurrentUserAnyRole(['teacher', 'class teacher'])) return;
      if (isAdmin(currentUser) || hasCurrentUserRole('h m')) return;

      let cancelled = false;

      const normalizeDailyTimetable = (timetableRes) => {
        if (Array.isArray(timetableRes)) return timetableRes;
        if (Array.isArray(timetableRes?.periods)) return timetableRes.periods;
        if (Array.isArray(timetableRes?.data)) return timetableRes.data;
        if (Array.isArray(timetableRes?.timetable)) return timetableRes.timetable;
        return [];
      };

      const normalizePlanPayload = (plansRes) => {
        const data = plansRes?.data || plansRes || {};
        return {
          lessonsByPeriod: data.lessonsByPeriod || {},
          isNonTeachingDay: !!data.isNonTeachingDay,
          reason: String(data.reason || '').trim()
        };
      };

      const normalizeKey = (period, cls, subject) => {
        const p = String(period ?? '').trim();
        const c = stripStdPrefix(String(cls ?? '').trim()).toLowerCase().replace(/\s+/g, '');
        const s = String(subject ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
        return `${p}|${c}|${s}`;
      };

      const load = async () => {
        setLiveTimetableState(prev => ({ ...prev, loading: true, error: null }));
        setTodaysPlansState(prev => ({ ...prev, loading: true, error: null, date: todayIST() }));

        try {
          const res = await api.getTeacherDashboardData(currentUser.email, { date: todayIST() });
          if (cancelled) return;
          const payload = res?.data || res || {};
          if (payload.success === false) throw new Error(payload.error || 'Failed to load dashboard data');

          const timetableRes = payload.timetable || payload.timetableWithReports || payload.timetableData || payload.timetableRes;
          const timetableData = normalizeDailyTimetable(timetableRes);
          setLiveTimetableState({
            loading: false,
            periods: Array.isArray(timetableData) ? timetableData : [],
            error: null
          });

          const plansPayload = normalizePlanPayload(payload.plannedLessons || payload.plans || payload.plannedLessonsForDate);
          const normalizedLessons = {};
          Object.entries(plansPayload.lessonsByPeriod || {}).forEach(([key, plan]) => {
            const parts = String(key || '').split('|');
            const period = parts[0];
            const cls = parts[1];
            const subj = parts.slice(2).join('|');
            const normalizedKey = normalizeKey(period, cls, subj);
            normalizedLessons[normalizedKey] = plan;
          });

          const periods = (Array.isArray(timetableData) ? timetableData : []).map(p => {
            const periodVal = p?.period ?? p?.Period ?? p?.periodNumber ?? p?.slot ?? p?.slotNumber ?? p?.index;
            const classVal = p?.class ?? p?.Class ?? p?.className ?? p?.standard ?? p?.grade ?? p?.Grade ?? p?.Standard;
            const subjectVal = p?.subject ?? p?.Subject ?? p?.subjectName ?? p?.subj ?? p?.course ?? p?.topic ?? p?.Topic;
            return {
              period: periodVal,
              class: classVal,
              subject: subjectVal,
              startTime: p?.startTime ?? p?.begin ?? p?.StartTime ?? '',
              endTime: p?.endTime ?? p?.finish ?? p?.EndTime ?? '',
              isSubstitution: !!(p?.isSubstitution || p?.absentTeacher || p?.regularSubject || p?.substituteSubject),
              _key: normalizeKey(periodVal, classVal, subjectVal),
              _raw: p
            };
          });

          periods.sort((a, b) => {
            const ap = Number(String(a.period ?? '').trim());
            const bp = Number(String(b.period ?? '').trim());
            if (Number.isFinite(ap) && Number.isFinite(bp)) return ap - bp;
            return String(a.period ?? '').localeCompare(String(b.period ?? ''));
          });

          setTodaysPlansState({
            loading: false,
            periods,
            lessonsByPeriod: normalizedLessons,
            error: null,
            isNonTeachingDay: plansPayload.isNonTeachingDay,
            reason: plansPayload.reason,
            date: todayIST()
          });
        } catch (e) {
          if (cancelled) return;
          setLiveTimetableState({ loading: false, periods: [], error: String(e?.message || e || 'Failed to load timetable') });
          setTodaysPlansState(prev => ({
            ...prev,
            loading: false,
            periods: [],
            lessonsByPeriod: {},
            error: String(e?.message || e || 'Failed to load lesson plans')
          }));
        }
      };

      load();
      return () => { cancelled = true; };
    }, [
      currentUser?.email,
      Array.isArray(currentUser?.roles) ? currentUser.roles.join('|') : String(currentUser?.roles || '')
    ]);

    useEffect(() => {
      if (!currentUser?.email) return;
      if (!hasCurrentUserAnyRole(['teacher', 'class teacher'])) return;
      if (isAdmin(currentUser) || hasCurrentUserRole('h m')) return;

      const t = setInterval(() => setNowTick(Date.now()), 30_000);
      return () => clearInterval(t);
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
        isSubstitution: !!(p?.isSubstitution || p?.absentTeacher || p?.regularSubject || p?.substituteSubject),
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

    const getPlanStatusMeta = (status) => {
      const s = String(status || '').trim().toLowerCase();
      if (!s) return { label: 'Not Prepared', className: 'bg-red-100 text-red-800' };
      if (s.includes('pending review')) return { label: 'Pending Review', className: 'bg-blue-100 text-blue-800' };
      if (s.includes('pending preparation') || s === 'draft') return { label: 'Pending Prep', className: 'bg-amber-100 text-amber-800' };
      if (s.includes('ready') || s.includes('approved')) return { label: 'Ready', className: 'bg-green-100 text-green-800' };
      if (s.includes('rescheduled') || s.includes('cascade')) return { label: 'Cascaded', className: 'bg-orange-100 text-orange-800' };
      if (s.includes('rework')) return { label: 'Needs Rework', className: 'bg-orange-100 text-orange-800' };
      return { label: status, className: 'bg-gray-100 text-gray-800' };
    };

    const getTodayPeriodTimes = () => {
      const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const isFriday = nowIst.getDay() === 5;
      if (isFriday && Array.isArray(memoizedSettings?.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
        return memoizedSettings.periodTimesFriday;
      }
      if (Array.isArray(memoizedSettings?.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
        return memoizedSettings.periodTimesWeekday;
      }
      if (Array.isArray(memoizedSettings?.periodTimes) && memoizedSettings.periodTimes.length) {
        return memoizedSettings.periodTimes;
      }
      return null;
    };

    return (
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Send Notification Button - HM Only */}
            {currentUser && hasCurrentUserRole('h m') && (
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

  {/* Check admin FIRST - highest priority */}
  {isAdmin(currentUser) ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
              <AdminDashboard user={currentUser} onNavigate={setActiveView} />
            </Suspense>
          </div>
    ) : currentUser && hasCurrentUserRole('h m') ? (
      <HMDashboardView insights={insights} memoizedSettings={memoizedSettings} setActiveView={setActiveView} />
    ) : currentUser && hasCurrentUserAnyRole(['teacher','class teacher']) ? (
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
                <div className={`grid grid-cols-2 ${hasCurrentUserRole('class teacher') ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3 md:gap-4`}>
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


                  {hasCurrentUserRole('class teacher') && (
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

              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Today</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{todaysPlansState.date}</span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Lesson Plans</h4>
                    {todaysPlansState.loading && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading
                      </span>
                    )}
                  </div>

                  {liveTimetableState.loading ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading timetable...
                    </div>
                  ) : liveTimetableState.error ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Unable to load today’s timetable.
                    </div>
                  ) : todaysPlansState.error ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300">Unable to load lesson plans.</div>
                  ) : todaysPlansState.isNonTeachingDay && todaysPlansState.periods.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      No classes scheduled today.{todaysPlansState.reason ? ` ${todaysPlansState.reason}` : ''}
                    </div>
                  ) : todaysPlansState.periods.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300">No timetable periods found for today.</div>
                  ) : (
                    <div className="space-y-3">
                      {todaysPlansState.periods.map((p, idx) => {
                        const plan = todaysPlansState.lessonsByPeriod[p._key] || null;
                        const statusMeta = getPlanStatusMeta(plan?.status);
                        const periodTimes = getTodayPeriodTimes();
                        const timeLabel = periodTimes ? periodToTimeString(p.period, periodTimes) : '';
                        const isSub = !!p.isSubstitution;
                        const liveMatch = livePeriodInfo?.status === 'live' && livePeriodInfo?.period
                          ? String(p.period ?? '').trim() === String(livePeriodInfo.period.period ?? '').trim()
                            && String(p.class ?? '').trim().toLowerCase() === String(livePeriodInfo.period.class ?? '').trim().toLowerCase()
                            && String(p.subject ?? '').trim().toLowerCase() === String(livePeriodInfo.period.subject ?? '').trim().toLowerCase()
                          : false;
                        return (
                          <button
                            key={`${p._key}-${idx}`}
                            type="button"
                            onClick={() => {
                              if (!plan) return;
                              openLessonView({
                                ...plan,
                                class: plan.class || p.class,
                                subject: plan.subject || p.subject,
                                selectedDate: plan.selectedDate || todaysPlansState.date,
                                selectedPeriod: plan.selectedPeriod || p.period,
                                session: plan.session || plan.sessionNo,
                                learningObjectives: plan.learningObjectives || '',
                                teachingMethods: plan.teachingMethods || '',
                                resourcesRequired: plan.resourcesRequired || '',
                                assessmentMethods: plan.assessmentMethods || ''
                              });
                            }}
                            className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                              plan ? 'hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-gray-700' : 'cursor-default'
                            } ${plan ? 'border-gray-200 dark:border-gray-700' : 'border-red-200 bg-red-50/40 dark:border-red-900/40'} ${
                              isSub ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700/60' : ''
                            } ${liveMatch ? 'ring-2 ring-emerald-400/70 shadow-[0_0_18px_rgba(16,185,129,0.25)]' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  Period {String(p.period ?? '').trim() || '-'}
                                  {timeLabel ? <span className="ml-2 text-xs text-gray-500">{timeLabel}</span> : null}
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {stripStdPrefix(String(p.class ?? '').trim() || '—')} · {String(p.subject ?? '').trim() || '—'}
                                </div>
                                {liveMatch && (
                                  <div className="text-xs text-emerald-700 mt-1 font-semibold">Live now</div>
                                )}
                                {isSub && (
                                  <div className="text-xs text-amber-700 mt-1 font-medium">Substitution period</div>
                                )}
                                {plan ? (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {plan.chapter ? `Chapter: ${plan.chapter}` : 'Chapter: —'}
                                    {plan.session || plan.sessionNo ? ` · Session ${plan.session || plan.sessionNo}` : ''}
                                  </div>
                                ) : (
                                  <div className={`text-xs mt-1 ${isSub ? 'text-amber-700' : 'text-red-700'}`}>
                                    {isSub
                                      ? 'Substitution period: you can attach a ready lesson plan while submitting the report (optional).'
                                      : 'You have not prepared a lesson plan for this period.'}
                                  </div>
                                )}
                              </div>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                                {statusMeta.label || 'Status'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Lesson plan warning removed from dashboard */}
            
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
            {hasCurrentUserRole('class teacher') && insights.classPerformance && Object.keys(insights.classPerformance).length > 0 && (
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

  const redirectToViewWithTab = (view, tab, mode = 'push') => {
    setTimeout(() => {
      setActiveView(view);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location);

        if (tab) {
          url.searchParams.set('tab', tab);
        } else {
          url.searchParams.delete('tab');
        }

        if (mode === 'replace') {
          window.history.replaceState({}, '', url);
        } else {
          window.history.pushState({}, '', url);
        }
      }
    }, 0);
  };

  const renderDashboardView = () => (
    <Dashboard
      showSendNotification={showSendNotification}
      setShowSendNotification={setShowSendNotification}
      notificationData={notificationData}
      setNotificationData={setNotificationData}
    />
  );

  const renderHMDashboardView = () => (
    <HMDashboardView memoizedSettings={memoizedSettings} setActiveView={setActiveView} />
  );

  const renderFeeCollectionView = () => (
    <FeeCollectionView user={currentUser} />
  );

  const renderMyDailyReportsView = () => (
    <MyDailyReportsView currentUser={currentUser} memoizedSettings={memoizedSettings} stripStdPrefix={stripStdPrefix} />
  );

  const renderDailyReportsManagementView = () => (
    <DailyReportsManagementView user={user} />
  );

  const renderClassStudentsView = () => (
    <ClassStudentsView user={user} withSubmit={withSubmit} openLessonView={openLessonView} />
  );

  const renderLessonApprovalsView = () => (
    <LessonApprovalsView
      memoizedUser={memoizedUser}
      stripStdPrefix={stripStdPrefix}
      openLessonView={openLessonView}
      withSubmit={withSubmit}
    />
  );

  const renderAnalyticsView = () => (
    <AnalyticsView />
  );

  const renderSubstitutionsView = () => (
    <EnhancedSubstitutionView user={currentUser} periodTimes={memoizedSettings.periodTimes} />
  );

  const renderSchemesView = () => (
    <SchemesView
      user={user}
      currentUser={currentUser}
      setSubmitting={setSubmitting}
      success={success}
      error={error}
      warning={warning}
      info={info}
      openLessonView={openLessonView}
      stripStdPrefix={stripStdPrefix}
    />
  );

  const renderLessonPlansView = () => (
    <LessonPlansView
      user={user}
      currentUser={currentUser}
      withSubmit={withSubmit}
      success={success}
      error={error}
      warning={warning}
      openLessonView={openLessonView}
      stripStdPrefix={stripStdPrefix}
      memoizedSettings={memoizedSettings}
    />
  );

  const renderReportsView = () => (
    <ReportsView memoizedUser={memoizedUser} memoizedSettings={memoizedSettings} />
  );

  const renderLessonPlanningView = () => (
    <SchemeLessonPlanning
      userEmail={currentUser?.email}
      userName={currentUser?.name}
    />
  );

  const renderAssessmentsView = () => (
    <AssessmentsManager user={currentUser} withSubmit={withSubmit} hasRole={hasCurrentUserRole} />
  );

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
              default:
                return renderDashboardView();
              case 'schemes':
                return renderSchemesView();
              case 'lessonplans':
                return (
                  <LessonPlansManager 
                    user={currentUser}
                    SchemeLessonPlanning={SchemeLessonPlanning}
                    LessonPlansView={LessonPlansView}
                    onNavigate={(view) => setActiveView(view)}
                  />
                );
              case 'lesson-plans':
                redirectToViewWithTab('lessonplans', 'submitted', 'replace');
                return renderLessonPlansView();
              case 'scheme-lesson-planning':
                redirectToViewWithTab('lessonplans', 'draft', 'replace');
                return renderLessonPlanningView();
              case 'session-tracking':
                return <SessionCompletionTracker user={currentUser} />;
              case 'timetable':
                return <TimetableView />;
              case 'my-substitutions':
                return <MySubstitutionsView user={currentUser} periodTimes={memoizedSettings.periodTimes} />;
              case 'reports':
                return renderReportsView();
              case 'hm-dashboard':
                return renderHMDashboardView();
              case 'day-timetable':
                return <DayTimetableView periodTimes={memoizedSettings.periodTimes} />;
              case 'scheme-approvals':
                return <SchemeApprovalsViewWrapper />;
              case 'lesson-approvals':
                return renderLessonApprovalsView();
              case 'my-daily-reports':
                return renderMyDailyReportsView();
              case 'daily-oversight':
                return <HMDailyOversight user={currentUser} />;
              
              case 'substitutions':
                return renderSubstitutionsView();
              case 'analytics':
                return renderAnalyticsView();
              case 'substitution-analytics':
                return <SubstitutionAnalyticsView user={currentUser} />;
              case 'missing-daily-reports':
                return <MissingDailyReportsTeacherwiseView user={currentUser} />;
              case 'full-timetable':
                return <FullTimetableView />;
              case 'users':
                return <UserManagement user={currentUser} />;
              case 'audit-log':
                return <AuditLog user={currentUser} />;
              
              // New unified assessments module
              case 'assessments':
                return renderAssessmentsView();
              
              // Old routes - redirect to unified module with appropriate tab
              case 'exam-marks':
                redirectToViewWithTab('assessments', null);
                return renderAssessmentsView();
              case 'report-card':
                redirectToViewWithTab('assessments', 'reports');
                return renderAssessmentsView();
              case 'marklist':
                redirectToViewWithTab('assessments', 'marklists');
                return renderAssessmentsView();
              case 'class-data':
                return <ClassDataView />;
              case 'admin-data':
                return <AdminDataEditor user={currentUser} />;
              case 'settings':
                return <SettingsPanel user={currentUser} settings={memoizedSettings} onSettingsUpdated={handleSettingsUpdated} />;
              case 'class-students':
                return renderClassStudentsView();
              case 'daily-reports-management':
                return renderDailyReportsManagementView();
              case 'class-period-timetable':
                return <ClassPeriodSubstitutionView user={currentUser} periodTimes={memoizedSettings.periodTimes} />;
              case 'fee-collection':
                return renderFeeCollectionView();
              case 'fund-collection':
                return <FundCollectionModule user={currentUser} />;
              case 'expense-management':
                return <ExpenseManagementModule user={currentUser} />;
              case 'financial-dashboard':
                return <FinancialDashboard user={currentUser} />;
              case 'lesson-cascading':
                return <LessonCascading user={currentUser} />;
            }
          })()}
        </AnimatedPage>
      </Suspense>
    );
  };

  // LessonPlansView extracted to src/views/LessonPlansView.jsx

  // Timetable View
  const TimetableView = () => {
    const [timetable, setTimetable] = useState([]);

    useEffect(() => {
      async function fetchTimetable() {
        try {
          if (!user) return;
          
          // For HM role, don't fetch teacher timetable (they won't have entries)
          if (user.role === 'hm') {
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

        {/* Show appropriate view for HM */}
        {user?.role === 'hm' ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-8">
            <div className="text-center">
              <Calendar className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                View School Timetables
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                As the head master, you can view the full school timetable or daily schedules.
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

  // Scheme Approvals View - extracted to separate file
  const SchemeApprovalsViewWrapper = () => {
    return <SchemeApprovalsView stripStdPrefix={stripStdPrefix} openLessonView={openLessonView} withSubmit={withSubmit} />;
  };


  // Enhanced Substitutions View for HM
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
          {currentUser && hasCurrentUserRole('h m') && (
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
          if (currentUser) {
            if (isAdmin(currentUser) || hasCurrentUserRole('h m')) {
              const cls = await api.getAllClasses();
              setAvailableClasses(Array.isArray(cls) ? cls : []);
            } else {
              setAvailableClasses(currentUser.classes || []);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
      fetchData();
    }, [user]);

    // Load subjects based on selected class (or teacher's own subjects)
    useEffect(() => {
      async function fetchSubjects() {
        // Non-HM teachers: always use their own assigned subjects
        if (currentUser && !isAdmin(currentUser) && !hasCurrentUserRole('h m')) {
          setAvailableSubjects(Array.isArray(currentUser.subjects) ? currentUser.subjects : []);
          return;
        }
        // HM/Admin: load subjects for the selected class from backend
        const cls = (examFormData.class || '').toString().trim();
        if (!cls) {
          // No class selected yet — derive all unique subjects from existing exams
          const subjectsSet = new Set();
          (Array.isArray(exams) ? exams : []).forEach(ex => {
            const subj = String(ex.subject || '').trim();
            if (subj) subjectsSet.add(subj);
          });
          setAvailableSubjects(Array.from(subjectsSet).sort());
          return;
        }
        try {
          const result = await api.getClassSubjects(cls);
          const subjects = Array.isArray(result?.subjects) ? result.subjects : (Array.isArray(result) ? result : []);
          if (subjects.length > 0) {
            setAvailableSubjects(subjects);
          } else {
            // Fallback: derive from existing exams for this class
            const subjectsSet = new Set();
            (Array.isArray(exams) ? exams : []).forEach(ex => {
              if (String(ex.class || '').trim() === cls) {
                const subj = String(ex.subject || '').trim();
                if (subj) subjectsSet.add(subj);
              }
            });
            setAvailableSubjects(Array.from(subjectsSet).sort());
          }
        } catch (err) {
          console.error('Failed to load subjects for class', cls, err);
          const subjectsSet = new Set();
          (Array.isArray(exams) ? exams : []).forEach(ex => {
            const subj = String(ex.subject || '').trim();
            if (subj) subjectsSet.add(subj);
          });
          setAvailableSubjects(Array.from(subjectsSet).sort());
        }
      }
      fetchSubjects();
    }, [examFormData.class, currentUser, exams]);

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
            internal: m.internal ?? m.ce ?? '',
            external: m.external ?? m.te ?? '',
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
            internal: m.internal ?? m.ce ?? '',
            external: m.external ?? m.te ?? '',
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
      // Refresh exam list so marks-entry status badges update
      reloadExams();
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
  const userRolesNorm = (currentUser?.roles || []).map(r => appNormalize(r));
  const userClassesSet = new Set((currentUser?.classes || []).map(c => normKey(c)));
  const userSubjectsSet = new Set((currentUser?.subjects || []).map(s => normKey(s)));

    // Filter exams based on user role and permissions

  const examsForTeacher = exams.filter(ex => {
    if (!currentUser) return false;
    if (isAdmin(currentUser) || hasCurrentUserRole('h m')) return true;
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
            {currentUser && (isAdmin(currentUser) || hasCurrentUserRole('h m')) && (
              <button
                onClick={() => setShowExamForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Exam
              </button>
            )}
            {currentUser && (isAdmin(currentUser) || hasCurrentUserRole('h m') || (userRolesNorm || []).some(r => r.includes('teacher'))) && (
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
                  const isHmOrAdmin = isAdmin(currentUser) || hasCurrentUserRole('h m');
                  const isClassTeacher = hasCurrentUserRole('class teacher') || hasCurrentUserAnyRole(['classteacher']);
                  const isSubjectTeacher = hasCurrentUserAnyRole(['teacher']);
                  // Enhanced class match: include classTeacherFor and allow section-insensitive match by standard number
                  const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/std\s*/g, '').replace(/\s+/g, '');
                  const num = (s) => { const m = (s || '').toString().match(/\d+/); return m ? m[0] : ''; };
                  const examClassNorm = norm(exam.class);
                  const examClassNum = num(exam.class);
                  const userClasses = Array.isArray(currentUser?.classes) ? currentUser.classes : [];
                  const userCTFor = Array.isArray(currentUser?.classTeacherFor) ? currentUser.classTeacherFor : [];
                  const teachesClass = [...userClasses, ...userCTFor].some(c => norm(c) === examClassNorm || (examClassNum && num(c) === examClassNum));
                  const teachesSubject = new Set((currentUser?.subjects||[]).map(s => appNormalize(s))).has(appNormalize(exam.subject));
                  let canEnter = false;
                  if (!currentUser) canEnter = false;
                  else if (isHmOrAdmin) canEnter = true;
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
                        <td className="px-4 py-2 text-sm text-gray-900">{m.internal ?? m.ce}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{m.external ?? m.te}</td>
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


  // Class Data View (Class Teacher only)
  const ClassDataView = () => {
    // IMPORTANT: use the effective logged-in user (Google login / local login / restored state)
    // Otherwise HM/admin may be treated as a class teacher with no assigned class.
    const currentUser = effectiveUser || user;

    // Check if user is admin or HM - they can access all classes
    const isadminOrHM = isAdmin(currentUser) || hasCurrentUserRole('h m');
    
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

    // Fetch available classes for admin/HM
    useEffect(() => {
      if (isadminOrHM) {
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
    }, [isadminOrHM, defaultClassName, selectedClass]);

    // If class teacher class arrives after login state hydration, sync it once.
    useEffect(() => {
      if (!isadminOrHM && defaultClassName && !selectedClass) {
        setSelectedClass(defaultClassName);
      }
    }, [isadminOrHM, defaultClassName, selectedClass]);

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

    // For HM/admin: Show loading state while fetching classes (check this FIRST)
    if (isadminOrHM && loading && !selectedClass) {
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
    if (!isadminOrHM && !defaultClassName) {
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
            {isadminOrHM ? 'School Data' : 'Class Data'} – {stripStdPrefix(selectedClass)}
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
            {isadminOrHM ? 'School Data' : 'Class Data'} {selectedClass && `– ${stripStdPrefix(selectedClass)}`}
          </h1>
          
          {/* Class Selector for admin/HM */}
          {isadminOrHM && availableClasses.length > 0 && (
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
        <SubmitOverlay submitting={submitting} />
        <LessonModal show={showLessonModal} lesson={viewLesson} onClose={closeLessonView} />
        <ApiErrorBanner error={apiError} onDismiss={() => setApiError(null)} />
        
        <div className="flex h-screen min-w-0">
          <AppSidebar
            navigationItems={navigationItems}
            sidebarOpen={sidebarOpen}
            sidebarOpenedAt={sidebarOpenedAt}
            setSidebarOpen={setSidebarOpen}
            setActiveView={setActiveView}
            activeView={activeView}
          />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <AppHeader
              activeView={activeView}
              setSidebarOpen={setSidebarOpen}
              setSidebarOpenedAt={setSidebarOpenedAt}
              user={user}
              googleAuth={googleAuth}
              onLogout={logout}
              onNotification={() => setShowSendNotification(true)}
            />
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


