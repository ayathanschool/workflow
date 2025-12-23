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
  DollarSign
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import * as api from './api'
import LoadingSplash from './auth/LoadingSplash';
import LoginForm from './auth/LoginForm';
import AnimatedPage from './components/AnimatedPage';
import NotificationCenter from './components/NotificationCenter';
import StatsCard from './components/shared/StatsCard';
import FeeCollectionModule from './components/FeeCollectionModule';
import ModernFeeCollection from './components/FeeCollection/ModernFeeCollection';
import PWAControls from './components/PWAControls';
import PWAInstallBanner from './components/PWAInstallBanner';
import ThemeToggle from './components/ThemeToggle';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { useTheme } from './contexts/ThemeContext';
// import { useRealTimeUpdates } from './hooks/useRealTimeUpdates';

// Lazy load heavy components for better performance
const SmartReminders = lazy(() => import('./components/SmartReminders'));
const SubstitutionModule = lazy(() => import('./components/SubstitutionModule'));
const EnhancedSubstitutionView = lazy(() => import('./components/EnhancedSubstitutionView'));
const DailyReportModern = lazy(() => import('./DailyReportModern'));
const MissingLessonPlansAlert = lazy(() => import('./components/MissingLessonPlansAlert'));
const HMMissingLessonPlansOverview = lazy(() => import('./components/HMMissingLessonPlansOverview'));
const ClassPeriodSubstitutionView = lazy(() => import('./components/ClassPeriodSubstitutionView'));
const ExamManagement = lazy(() => import('./components/ExamManagement'));
const ReportCard = lazy(() => import('./components/ReportCard'));
const Marklist = lazy(() => import('./components/Marklist'));
const SchemeLessonPlanning = lazy(() => import('./components/SchemeLessonPlanning'));
const SessionCompletionTracker = lazy(() => import('./components/SessionCompletionTracker'));
const HMDailyOversight = lazy(() => import('./components/HMDailyOversightEnhanced'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AuditLog = lazy(() => import('./components/AuditLog'));

// Keep lightweight components as regular imports
import { periodToTimeString, todayIST, formatDateForInput, formatLocalDate } from './utils/dateUtils';
// moved 'lucide-react' import above to satisfy import ordering

// Common utility functions to avoid duplication
const appNormalize = (s) => (s || '').toString().trim().toLowerCase();

const App = () => {
  
  // Get notifications context
  const notificationSystem = useNotifications();
  
  // Theme styling relies on 'dark' class on <html>; avoid consuming theme in App to prevent re-renders on toggle
  
  // API error banner state
  const [apiError, setApiError] = useState(null);
  
  // App settings for the whole application
  const [appSettings, setAppSettings] = useState({
    lessonPlanningDay: '',       // No restriction until settings define it
    allowNextWeekOnly: false,    // Next-week-only restriction disabled
    periodTimes: null,           // Will store custom period times if available
    periodTimesWeekday: null,    // Monday-Thursday period times
    periodTimesFriday: null      // Friday period times
  });
  
  // Create a memoized version of appSettings to avoid unnecessary re-renders
  const memoizedSettings = useMemo(() => {
    return appSettings || {
      lessonPlanningDay: '',
      allowNextWeekOnly: false,
      periodTimes: null,
      periodTimesWeekday: null,
      periodTimesFriday: null
    };
  }, [appSettings]);

  useEffect(() => {
    const handler = (e) => {
      setApiError(e.detail && e.detail.message ? `${e.detail.message}` : String(e.detail || 'API error'));
    };
    window.addEventListener('api-error', handler);
    return () => window.removeEventListener('api-error', handler);
  }, []);
  
  // Fetch app settings from the API
  useEffect(() => {
    async function fetchAppSettings() {
      try {
        const settings = await api.getAppSettings();
        if (settings) {
          setAppSettings({
            lessonPlanningDay: settings.lessonPlanningDay || '',
            allowNextWeekOnly: false, // Ignore sheet value; do not restrict to next week
            periodTimes: settings.periodTimes || settings.periodTimesWeekday || null,
            periodTimesWeekday: settings.periodTimesWeekday || null,
            periodTimesFriday: settings.periodTimesFriday || null
          });
        }
      } catch (err) {
        console.warn('⚠️ Could not load app settings (offline or backend unavailable). Using defaults.');
        // Keep default settings - app will still work
      }
    }
    fetchAppSettings();
  }, []);

  // ----- GLOBAL submit overlay -----
  const [submitting, setSubmitting] = useState({ active:false, message:'' });
  const [viewModal, setViewModal] = useState(null);

  // Get notification functions
  const { success, error, warning, info } = useNotifications();

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
    return String(className).replace(/^STD\s+/i, '');
  };

  const withSubmit = async (message, fn) => {
    setSubmitting({ active:true, message });
    try {
      await fn();
      // Use new notification system for success
      success('Success!', message || 'Operation completed successfully');
    } catch (err) {
      console.error('submit error', err);
      // Use new notification system for errors
      error('Error!', err?.message || 'An error occurred');
      // surface as global api-error event so other parts of app can react
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: err?.message || String(err) } }));
      throw err;
    } finally {
      setSubmitting({ active:false, message: '' });
    }

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
              <Detail label="Session" value={viewLesson.noOfSessions ? `${viewLesson.session} of ${viewLesson.noOfSessions}` : viewLesson.session} />
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
        setUser(result);
        localStorage.setItem('user', JSON.stringify(result));
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
    localStorage.removeItem('user');
    // Clear all cached data on logout
    api.invalidateCache.onLogout();
  };

  // Initialize app
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Prefetch common data when user logs in
  useEffect(() => {
    if (user) {
      // Prefetch common data in parallel to warm up cache - with error handling
      Promise.all([
        api.getAllClasses().catch((err) => { console.warn('Failed to prefetch classes:', err); return []; }),
        api.getGradeTypes().catch((err) => { console.warn('Failed to prefetch grade types:', err); return []; })
        // Temporarily removed getSubjects() due to API issues
      ]).catch((err) => { console.warn('Prefetch failed:', err); });
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
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'substitutions', label: 'Substitutions', icon: UserPlus },
        { id: 'class-data', label: 'Class Data', icon: UserCheck },
        { id: 'daily-oversight', label: 'Daily Oversight', icon: ClipboardCheck },
        { id: 'exam-marks', label: 'Exam Management', icon: Award },
        { id: 'report-card', label: 'Report Cards', icon: FileCheck },
        { id: 'marklist', label: 'Marklist', icon: FileText },
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
        { id: 'lesson-plans', label: 'Lesson Plans', icon: BookOpen },
        { id: 'scheme-lesson-planning', label: 'Scheme-Based Planning', icon: BookCheck },
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'my-substitutions', label: 'My Substitutions', icon: UserPlus },
        { id: 'reports', label: 'Daily Reports (Enhanced)', icon: FileText },
        { id: 'my-daily-reports', label: 'My Reports History', icon: FileClock },
        { id: 'smart-reminders', label: 'Smart Reminders', icon: Bell }
      );
      // Teachers and class teachers can also manage exams: view available exams,
      // enter marks for their classes and subjects, and view marks.
      items.push({ id: 'exam-marks', label: 'Exam Marks', icon: Award });
      items.push({ id: 'report-card', label: 'Report Card', icon: FileText });
      items.push({ id: 'marklist', label: 'Marklist', icon: FileText });
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
        { id: 'class-data', label: 'Class Data', icon: UserCheck },
        { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
        { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays },
        { id: 'smart-reminders', label: 'Smart Reminders', icon: Bell },
        { id: 'exam-marks', label: 'Exam Marks', icon: Award },
        { id: 'report-card', label: 'Report Card', icon: FileText },
        { id: 'marklist', label: 'Marklist', icon: FileText },
        { id: 'fee-collection', label: 'Fee Collection', icon: DollarSign }
      );
      // Additional management views for the headmaster
      items.push(
        { id: 'daily-reports-management', label: 'All Reports', icon: FileText }
      );
    }

    // Students can view their report cards
    if (hasAnyRole(['student'])) {
      items.push({ id: 'report-card', label: 'My Report Card', icon: FileText });
    }

    return items;
  };

  // Substitution notifications state (moved to App level to avoid hook issues)
  const [substitutionNotifications, setSubstitutionNotifications] = useState([]);
  const [shownNotificationIds, setShownNotificationIds] = useState(new Set()); // Track shown notifications
  
  // Keep a ref in sync with shownNotificationIds so our callbacks always see the latest set
  const shownNotificationIdsRef = useRef(shownNotificationIds);
  
  useEffect(() => {
    shownNotificationIdsRef.current = shownNotificationIds;
  }, [shownNotificationIds]);
  
  // Load substitution notifications for current user and add to NotificationCenter
  const loadSubstitutionNotifications = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      const response = await api.getSubstitutionNotifications(user.email);
      
      let notificationsList = [];
      
      // Handle different response formats
      if (Array.isArray(response)) {
        notificationsList = response;
      } else if (response && response.notifications) {
        notificationsList = response.notifications;
      } else if (response && Array.isArray(response.data)) {
        notificationsList = response.data;
      }
      
      // Store for teacher dashboard display
      setSubstitutionNotifications(notificationsList);
      
    // Add unacknowledged notifications to NotificationCenter (only if not already shown)
    notificationsList.forEach(notification => {
      const isUnacknowledged = String(notification.acknowledged || '').toLowerCase() !== 'true';
      const notAlreadyShown = !shownNotificationIdsRef.current.has(notification.id);
      
      if (isUnacknowledged && notAlreadyShown) {
        // Parse the notification data
        let notifData = {};
        try {
          notifData = JSON.parse(notification.data || '{}');
        } catch (e) {
          console.warn('Failed to parse notification data:', e);
        }
        
        // Add to notification center
        info(
          notification.title || 'Substitution Assignment',
          notification.message || `Period ${notifData.period} - Class ${notifData.class}`,
          {
            autoClose: false, // Don't auto-close substitution notifications
            actions: [
              {
                label: 'Acknowledge',
                handler: () => acknowledgeNotification(notification.id)
              }
            ],
            metadata: {
              type: 'substitution',
              notificationId: notification.id,
              ...notifData
            }
          }
        );
        
        // Mark as shown (guarded so we don't trigger extra renders for same id)
        setShownNotificationIds(prev => {
          if (prev.has(notification.id)) return prev;
          const next = new Set(prev);
          next.add(notification.id);
          return next;
        });
      }
    });
    
  } catch (error) {
    console.error('Error loading substitution notifications:', error);
  }
}, [user?.email, info]);  const acknowledgeNotification = useCallback(async (notificationId) => {
    try {
      await api.acknowledgeSubstitutionNotification(user.email, notificationId);
      success('Acknowledged', 'Substitution assignment acknowledged successfully');
      
      // Remove from state
      setSubstitutionNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      
      // Reload to refresh data
      loadSubstitutionNotifications();
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      error('Error', 'Failed to acknowledge notification');
    }
  }, [user?.email, success, error, loadSubstitutionNotifications]);
  
  // Poll for substitution notifications
  useEffect(() => {
    if (user?.email) {
      loadSubstitutionNotifications();
      // Poll for new notifications every 2 minutes
      const interval = setInterval(loadSubstitutionNotifications, 2 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user?.email, loadSubstitutionNotifications]);
  
  // Dashboard component
  const Dashboard = ({ 
    showSendNotification, 
    setShowSendNotification, 
    notificationData, 
    setNotificationData 
  }) => {

    // Insights state holds counts used to populate the summary cards.  When the
    // logged‑in user is the headmaster ("H M" role) we fetch global counts
    // from the API.  For teachers/class teachers we compute counts based on
    // their own classes and subjects and optionally fetch pending report
    // counts from the API.  All fields default to zero to avoid showing mock
    // numbers.
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
      classPerformance: {} // { className: { aboveAverage, needFocus, avgPercentage } }
    });
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardLoaded, setDashboardLoaded] = useState(false);

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
        const result = await api.sendCustomNotification(user.email, title, message, priority, recipients);
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

    // Ref to guarantee single dashboard fetch per mount even if state updates quickly
    const dashboardFetchRef = useRef(false);

    useEffect(() => {
      async function fetchDashboardData() {
        // Run only once
        if (dashboardFetchRef.current) return;
        if (!user?.email) return;
        dashboardFetchRef.current = true;
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
            const teachingClasses = Array.isArray(user.classes) ? user.classes : [];
            const teachingSubjects = Array.isArray(user.subjects) ? user.subjects : [];
            const classCount = teachingClasses.length;
            const subjectCount = teachingSubjects.length;
            // Pre-populate counts to avoid initial blank UI
            setInsights(prev => ({
              ...prev,
              classCount,
              subjectCount,
              teachingClasses,
              teachingSubjects
            }));
            
            // Fetch student counts per class for class teacher
            let classStudentCounts = {};
            let studentsAboveAverage = 0;
            let studentsNeedFocus = 0;
            let classPerformance = {};
            
            if (hasRole('class teacher') && teachingClasses.length > 0) {
              try {
                // Fetch students for each class and store count per class
                const studentPromises = teachingClasses.map(cls => api.getStudents(cls));
                const studentsPerClass = await Promise.all(studentPromises);
                teachingClasses.forEach((cls, idx) => {
                  const students = studentsPerClass[idx];
                  classStudentCounts[cls] = Array.isArray(students) ? students.length : 0;
                });
                
                // Calculate academic performance for class teacher's classes
                try {
                  // Initialize classPerformance with all teaching classes (even without marks)
                  teachingClasses.forEach(className => {
                    if (!classPerformance[className]) {
                      classPerformance[className] = {
                        aboveAverage: 0,
                        needFocus: 0,
                        avgPercentage: 0,
                        totalStudents: classStudentCounts[className] || 0,
                        studentsWithMarks: 0
                      };
                    }
                  });
                  
                  // Get all exams to find latest exam for class teacher's classes
                  const allExams = await api.getExams();
                  const relevantExams = Array.isArray(allExams) 
                    ? allExams.filter(exam => teachingClasses.includes(exam.class))
                    : [];
                  
                  if (relevantExams.length > 0) {
                    // Get marks for the most recent exam of each class
                    const examsByClass = {};
                    relevantExams.forEach(exam => {
                      if (!examsByClass[exam.class] || new Date(exam.date) > new Date(examsByClass[exam.class].date)) {
                        examsByClass[exam.class] = exam;
                      }
                    });
                    
                    // Fetch marks for each class's latest exam
                    const examsArray = Object.values(examsByClass);
                    const marksPromises = examsArray.map(exam => 
                      api.getExamMarks(exam.examId).catch(() => [])
                    );
                    const allMarksArrays = await Promise.all(marksPromises);
                    
                    // Build performance data per class
                    // Use the outer classPerformance variable instead of declaring new one
                    let totalAboveAverage = 0;
                    let totalNeedFocus = 0;
                    
                    examsArray.forEach((exam, idx) => {
                      const marks = allMarksArrays[idx];
                      const className = exam.class;
                      
                      if (Array.isArray(marks) && marks.length > 0) {
                        const studentMarks = [];
                        let skippedMarks = 0;
                        
                        // Debug: Log first few marks to see their structure
                        if (className === 'STD 1A' && marks.length > 0) {
                          console.debug(`[${className}] Total marks fetched:`, marks.length);
                          console.debug(`[${className}] First mark sample:`, marks[0]);
                          console.debug(`[${className}] Exam class:`, className);
                        }
                        
                        // Filter marks to only include students from this specific class
                        marks.forEach(mark => {
                          // Skip marks that don't match this class
                          if (mark.class && mark.class !== className) {
                            skippedMarks++;
                            return;
                          }
                          
                          if (mark && (mark.total != null || mark.ce != null || mark.te != null)) {
                            // Calculate total from ce + te if total not present
                            const total = parseFloat(mark.total) || 
                                        (parseFloat(mark.ce || 0) + parseFloat(mark.te || 0));
                            const max = parseFloat(exam.totalMax || exam.internalMax + exam.externalMax || 100);
                            
                            if (total >= 0 && max > 0) {
                              studentMarks.push({
                                total: total,
                                max: max,
                                percentage: (total / max) * 100
                              });
                            }
                          }
                        });
                        
                        if (className === 'STD 1A') {
                          console.debug(`[${className}] Marks after filtering:`, studentMarks.length);
                          console.debug(`[${className}] Skipped marks (wrong class):`, skippedMarks);
                        }
                        
                        if (studentMarks.length > 0) {
                          // Calculate class average
                          const percentages = studentMarks.map(m => m.percentage);
                          const avgPercentage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
                          
                          // Categorize students for this class
                          const aboveAverage = percentages.filter(p => p >= avgPercentage).length;
                          const needFocus = percentages.filter(p => p < 50).length;
                          
                          // Use actual roster count if available, otherwise exam marks count
                          const actualTotal = classStudentCounts[className] || studentMarks.length;
                          
                          classPerformance[className] = {
                            aboveAverage,
                            needFocus,
                            avgPercentage: Math.round(avgPercentage),
                            totalStudents: actualTotal,
                            studentsWithMarks: studentMarks.length
                          };
                          
                          totalAboveAverage += aboveAverage;
                          totalNeedFocus += needFocus;
                        }
                      }
                    });
                    
                    studentsAboveAverage = totalAboveAverage;
                    studentsNeedFocus = totalNeedFocus;
                    
                    // Removed verbose console log to reduce noise in dev
                    // console.debug('📊 Class-wise Performance:', classPerformance);
                  }
                } catch (err) {
                  console.warn('Unable to fetch performance data:', err);
                }
              } catch (err) {
                console.warn('Unable to fetch student counts:', err);
              }
            }
            
            // Attempt to fetch daily reports for today to count pending submissions
            let pendingReports = 0;
            try {
              const todayIso = todayIST();
              const reports = await api.getTeacherDailyReportsForDate(user.email, todayIso);
              if (Array.isArray(reports)) {
                // Count reports that are not yet submitted (status != 'Submitted')
                pendingReports = reports.filter(r => String(r.status || '').toLowerCase() !== 'submitted').length;
              }
            } catch (err) {
              // If the endpoint is not implemented or fails, just leave pendingReports as 0
              console.warn('Unable to fetch teacher daily reports:', err);
            }
            setInsights(prev => ({
              ...prev,
              planCount: 0,
              lessonCount: 0,
              teacherCount: 0,
              pendingReports,
              classStudentCounts,
              studentsAboveAverage,
              studentsNeedFocus,
              classPerformance
            }));
          }
        } catch (err) {
          console.error('Error loading dashboard data:', err);
        } finally {
          setDashboardLoading(false);
        }
      }
      
      if (user?.email) fetchDashboardData();
    }, [user?.email]);

    return (
      <div className="space-y-4 md:space-y-6">
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
            <NotificationCenter />
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              <StatsCard
                icon={<School />}
                iconColor="blue"
                title="Classes"
                value={insights.classCount}
                subtitle="Teaching classes"
              />
              
              <StatsCard
                icon={<Book />}
                iconColor="green"
                title="Subjects"
                value={insights.subjectCount}
                subtitle="Subjects assigned"
              />
              
              <StatsCard
                icon={<FileText />}
                iconColor="purple"
                title="Pending Reports"
                value={insights.pendingReports}
                subtitle="Reports due today"
                onClick={() => setActiveView('reports')}
              />
              
              {hasRole('class teacher') && (
                <>
                  <StatsCard
                    icon={<Award />}
                    iconColor="green"
                    title="Above Average"
                    value={insights.studentsAboveAverage}
                    subtitle="Performing well"
                    trend={insights.studentsAboveAverage > 0 ? {
                      direction: 'up',
                      value: `${Math.round((insights.studentsAboveAverage / Math.max(1, insights.studentsAboveAverage + insights.studentsNeedFocus)) * 100)}%`,
                      label: 'of class'
                    } : undefined}
                  />
                  
                  <StatsCard
                    icon={<AlertCircle />}
                    iconColor="orange"
                    title="Need Focus"
                    value={insights.studentsNeedFocus}
                    subtitle="Require attention"
                    variant="bordered"
                  />
                </>
              )}
            </div>
            {/* Missing Lesson Plans Alert - Teacher View (moved below stats) */}
            <Suspense fallback={<div className="animate-pulse bg-gray-100 h-32 rounded-lg"></div>}>
              <MissingLessonPlansAlert 
                user={user} 
                onPrepareClick={() => setActiveView('lesson-planning')}
              />
            </Suspense>
            
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
                              <span>{cls}</span>
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
                      <p className="text-sm font-medium text-gray-600 mb-2">Subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {insights.teachingSubjects.map((subject, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                            {subject}
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
                  {Object.entries(insights.classPerformance).map(([className, perf]) => (
                    <div key={className} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 md:p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{className}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Class Average:</span>
                          <span className="text-sm font-semibold text-blue-600">{perf.avgPercentage}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Students:</span>
                          <span className="text-sm font-semibold">{perf.totalStudents}</span>
                        </div>
                        {perf.studentsWithMarks && perf.studentsWithMarks !== perf.totalStudents && (
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
                            <span className="text-sm font-bold text-emerald-600">{perf.aboveAverage}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Need Focus
                            </span>
                            <span className="text-sm font-bold text-amber-600">{perf.needFocus}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
  };

  const handleLogout = () => {
    if (googleAuth?.user) googleAuth.logout();
    setLocalUser(null);
    setUser(null);
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
        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity z-[65]"
              onClick={() => {
                if (Date.now() - sidebarOpenedAt < 300) return;
                setSidebarOpen(false);
              }}
            />
            <div 
              className="fixed inset-y-0 left-0 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 z-[70] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <School className="h-8 w-8 text-blue-600" />
                  <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">SchoolFlow</span>
                </div>
                <nav className="mt-5 px-2 space-y-1">
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
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                        } group flex items-center px-2 py-2 text-base font-medium rounded-md w-full text-left transition-colors duration-200`}
                      >
                        <Icon className="mr-4 h-6 w-6" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transition-colors duration-300">
              <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
                <School className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">SchoolFlow</span>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto">
                <nav className="flex-1 px-2 py-4 space-y-1 bg-white dark:bg-gray-800 transition-colors duration-300">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`${
                          activeView === item.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors duration-200`}
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
        </div>
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
            className="lg:hidden mr-3 p-2 rounded-md transition-colors duration-200 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
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
              case 'lesson-plans':
                return <LessonPlansView />;
              case 'scheme-lesson-planning':
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
                      <DailyReportModern user={memoizedUser} />
                    </div>
                  </div>
                );
              case 'hm-dashboard':
                return <Dashboard />;
              case 'day-timetable':
                return <DayTimetableView periodTimes={memoizedSettings.periodTimes} />;
              case 'scheme-approvals':
                return <SchemeApprovalsView />;
              case 'lesson-approvals':
                return <LessonApprovalsView />;
              case 'my-daily-reports':
                return <MyDailyReportsView />;
              case 'daily-oversight':
                return <HMDailyOversight user={user} />;
              
              case 'substitutions':
                return <EnhancedSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
              case 'full-timetable':
                return <FullTimetableView />;
              case 'smart-reminders':
                return <SmartReminders user={user} />;
              case 'users':
                return <UserManagement user={user} />;
              case 'audit-log':
                return <AuditLog user={user} />;
              case 'exam-marks':
                return <ExamManagement user={user} withSubmit={withSubmit} />;
              case 'report-card':
                return <ReportCard user={user} />;
              case 'marklist':
                return <Marklist user={user} />;
              case 'class-data':
                return <ClassDataView />;
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
          result = await withSubmit('Updating scheme...', async () => {
            const response = await api.updateScheme(editingScheme.schemeId, user.email, schemeData);
            return response?.data || response;
          });
          if (result?.success) {
            success('Updated', 'Scheme updated successfully');
          } else {
            throw new Error(result?.error || 'Update failed');
          }
        } else {
          // Submit new scheme
          result = await withSubmit('Submitting scheme...', async () => {
            const response = await api.submitPlan(user.email, schemeData);
            return response?.data || response; // Unwrap {status,data,timestamp}
          });
        }
        
        // Check if validation failed (only for new submissions)
        if (!editingScheme && !result.ok && result.error === 'Session count mismatch') {
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
            return;
          } else if (!userChoice || validation.noTimetableFound) {
            // Force submit with override
            const overrideData = {
              ...schemeData,
              forceSubmit: true,
              validationWarning: validation.message
            };
            
            await withSubmit('Submitting scheme with override...', () => api.submitPlan(user.email, overrideData));
            warning('Override Required', 'Scheme submitted with timetable override. HM review required.');
          }
        } else if (result.ok) {
          // Success - normal submission
          const message = result.validation?.message || 'Scheme submitted successfully!';
          success('Scheme Submitted', message);
        } else {
          // Other error
          throw new Error(result.error || 'Submission failed');
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
    };

    // Load all schemes for this teacher from the API on mount.  We use
    // getTeacherSchemes() so teachers can see the status of previously
    // submitted schemes (Pending, Approved, Rejected).
    useEffect(() => {
      async function fetchSchemes() {
        try {
          if (!user) return;
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
        }
      }
      fetchSchemes();
    }, [user]);

    return (
      <div className="space-y-6">
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
                    <option key={cls} value={cls}>{cls}</option>
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
      </div>
    );
  };

  // Lesson Plans View - Based on Timetable with Approved Schemes Dropdown
  const LessonPlansView = () => {
    const [timetableSlots, setTimetableSlots] = useState([]);
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

    // Helper: normalize weekday names (tolerates typos like "Wedbnesday")
    const normalizeDayNameClient = (input) => {
      if (!input && input !== 0) return '';
      const raw = String(input);
      const s = raw.toLowerCase().replace(/[^a-z]/g, '');
      const map = [
        { k: 'mon', v: 'Monday' },
        { k: 'tue', v: 'Tuesday' },
        { k: 'wed', v: 'Wednesday' },
        { k: 'thu', v: 'Thursday' },
        { k: 'fri', v: 'Friday' },
        { k: 'sat', v: 'Saturday' },
        { k: 'sun', v: 'Sunday' }
      ];
      for (const { k, v } of map) {
        if (s.includes(k)) return v;
      }
      // Fallback: best-effort capitalization
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    // App settings for lesson plan preparation
    const [lessonPlanSettings, setLessonPlanSettings] = useState({
      lessonPlanningDay: '',       // No restriction until settings define it
      allowNextWeekOnly: false,    // Next-week-only restriction disabled
      periodTimes: null            // Will store custom period times if available
    });
    
    // Create a memoized version of lessonPlanSettings to avoid unnecessary re-renders
    const memoizedLessonPlanSettings = useMemo(() => {
      return lessonPlanSettings || {
        lessonPlanningDay: '',
        allowNextWeekOnly: false,
        periodTimes: null
      };
    }, [lessonPlanSettings]);
    // Track when settings have been loaded to avoid enforcing defaults prematurely
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    // Track if the user is trying to plan outside allowed days
    const [planningRestricted, setPlanningRestricted] = useState(false);
    // local normalization helper to compare class/subject values reliably
    const normKeyLocal = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

    // Fetch real timetable slots, lesson plans, approved schemes, and app settings from the API
    useEffect(() => {
      async function fetchData() {
        try {
          if (!user) return;
          // Weekly timetable for the teacher
          const timetableData = await api.getTeacherWeeklyTimetable(user.email);
          setTimetableSlots(Array.isArray(timetableData) ? timetableData : []);
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
          
          // Fetch app settings LAST so it's freshest when we check rules below
          // Use the app-level settings instead of fetching again
          setLessonPlanSettings({
            lessonPlanningDay: memoizedSettings.lessonPlanningDay || '',
            allowNextWeekOnly: false, // Ignore sheet value; do not restrict to next week
            periodTimes: memoizedSettings.periodTimes || null
          });
          setSettingsLoaded(true);
        } catch (err) {
          console.error(err);
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
      // First check if planning is allowed based on settings
  const today = new Date();
  const todayName = today.toLocaleDateString('en-US', { weekday: 'long' });
      const normalizedSettingDay = normalizeDayNameClient(memoizedLessonPlanSettings.lessonPlanningDay || '');
      const isAllowedPlanningDay = normalizedSettingDay
        ? normalizeDayNameClient(todayName) === normalizedSettingDay
        : true; // No restriction if no planning day configured
      // Next-week-only restriction removed
      const isNextWeekSlot = true;
      
      // Find existing lesson plan for this class, subject, and date
      const existingPlan = lessonPlans.find(
        plan => normKeyLocal(plan.class) === normKeyLocal(slot.class) &&
                normKeyLocal(plan.subject) === normKeyLocal(slot.subject) &&
                String(plan.date || '') === String(slot.date || '')
      );
      
      // If settings haven't loaded yet, do not block the user
      if (!settingsLoaded) {
        // proceed without restriction while settings load
      } else if (!existingPlan && (!isAllowedPlanningDay)) {
        setPlanningRestricted(true);
        const displayDay = normalizedSettingDay || 'the configured day';
        error('Planning Restricted', `Lesson planning is only allowed on ${displayDay}.`);
        return;
      }
      
      // Reset restriction flag
      setPlanningRestricted(false);
      
      setSelectedSlot(slot);
      setShowPreparationForm(true);
      
      // Filter relevant schemes outside the if/else to make it available for both paths
      const relevantSchemes = approvedSchemes.filter(
        scheme => normKeyLocal(scheme.class) === normKeyLocal(slot.class) && normKeyLocal(scheme.subject) === normKeyLocal(slot.subject)
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
        plan => normKeyLocal(plan.class) === normKeyLocal(selectedSlot.class) && 
                normKeyLocal(plan.subject) === normKeyLocal(selectedSlot.subject) && 
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
        const normalizedClass = normKeyLocal(selectedSlot.class);
        const normalizedSubject = normKeyLocal(selectedSlot.subject);
        // Use only the session number from the scheme, not timetable period
        const sessionNumber = Number(preparationData.session || 1);
        
        const duplicate = lessonPlans.find(lp => {
          // Get the chapter for the plan's scheme
          const planScheme = approvedSchemes.find(s => s.schemeId === lp.schemeId);
          const planChapter = planScheme?.chapter || '';
          
          return (
            normKeyLocal(lp.class) === normalizedClass &&
            normKeyLocal(lp.subject) === normalizedSubject &&
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
                    .filter(scheme => normKeyLocal(scheme.class) === normKeyLocal(selectedSlot.class) && normKeyLocal(scheme.subject) === normKeyLocal(selectedSlot.subject))
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

        {/* DISABLED: Old Lesson Plan Submission - Replaced by Scheme-based Planning */}
        {/* Migration Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-blue-800">📋 New Lesson Planning System</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p className="mb-2">Lesson plans are now created through the <strong>Scheme-based Lesson Planning</strong> workflow for better organization and tracking.</p>
                  <p className="mb-3">Navigate to <strong>Schemes → Select Chapter → Create Lesson Plan</strong> to prepare your lesson plans.</p>
                  <div className="bg-white bg-opacity-50 rounded px-3 py-2 text-xs">
                    <strong>Benefits:</strong>
                    <ul className="list-disc ml-4 mt-1 space-y-1">
                      <li>Linked to approved schemes and chapters</li>
                      <li>Better session tracking and progress monitoring</li>
                      <li>Prevents duplicate period assignments</li>
                      <li>Organized by academic structure</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                    <option key={cls} value={cls}>{cls}</option>
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
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">P{p.period}</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(p.class)} - {p.subject}</span>
                            </div>
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
                      Period {period}
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {substitutions.map((sub, index) => {
                        const uniqueId = `${sub.date}-${sub.period}-${sub.class}`;
                        const acknowledged = isAcknowledged(sub);
                        const acknowledging = acknowledgingId === uniqueId;
                        
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
          <DailyReportModern user={memoizedUser} />
        </div>
      </div>
    );
  };

  const HMDashboardView = ({ insights }) => {
    console.debug('🚀 HMDashboardView rendering with insights:', insights);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dailyReportsData, setDailyReportsData] = useState({ reports: [], stats: {} });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [paceTracking, setPaceTracking] = useState(null);
    const [loadingPaceTracking, setLoadingPaceTracking] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    // Missing lesson plans overview
    const [missingPlans, setMissingPlans] = useState(null);
    const [loadingMissingPlans, setLoadingMissingPlans] = useState(false);

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

  // Auto-refresh daily reports every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    const refreshTimer = setInterval(async () => {
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
    }, 5 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, [autoRefresh]);

  // Load daily reports on mount
  useEffect(() => {
    async function loadTodayReports() {
      try {
        const today = new Date().toISOString().split('T')[0];
        console.debug('📊 Loading daily reports for:', today);
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;
        console.debug('📊 Daily reports response:', data);
        console.debug('📊 Reports array:', data.reports);
        console.debug('📊 Reports count:', data.reports?.length || 0);
        console.debug('📊 Stats:', data.stats);
        
        if (data.reports && data.reports.length > 0) {
          console.debug('📊 Sample report:', data.reports[0]);
          // Group by period to see distribution
          const byPeriod = {};
          data.reports.forEach(r => {
            const p = r.period;
            byPeriod[p] = (byPeriod[p] || 0) + 1;
          });
          console.debug('📊 Reports by period:', byPeriod);
        } else {
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

  // Calculate critical alerts
  const criticalAlerts = [];
  const pendingCount = dailyReportsData.stats.pending || 0;
  const lateSubmissions = dailyReportsData.reports.filter(r => {
    if (r.submitted) return false;
    const reportPeriod = parseInt(r.period);
    return currentPeriod && reportPeriod < currentPeriod;
  }).length;

  if (lateSubmissions > 0) {
    criticalAlerts.push({
      type: 'critical',
      icon: '🚨',
      message: `${lateSubmissions} late report${lateSubmissions > 1 ? 's' : ''} (period${lateSubmissions > 1 ? 's' : ''} already completed)`,
      color: 'red'
    });
  }

  if (pendingCount > 10) {
    criticalAlerts.push({
      type: 'warning',
      icon: '⚠️',
      message: `${pendingCount} reports still pending`,
      color: 'orange'
    });
  }

  if (substitutionNotifications.length > 0) {
    criticalAlerts.push({
      type: 'info',
      icon: '🔄',
      message: `${substitutionNotifications.length} unacknowledged substitution${substitutionNotifications.length > 1 ? 's' : ''}`,
      color: 'amber'
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Headmaster Dashboard - Daily Oversight</h1>
          <p className="text-sm text-gray-600 mt-1">
            Live monitoring • {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()} 
            {currentPeriod && ` • Current Period: ${currentPeriod}`}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg flex items-center ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </button>
          <button 
            onClick={() => setActiveView('daily-oversight')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Detailed View
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-gray-700">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Missing Lesson Plans Overview */}
      <Suspense fallback={<div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>}>
        <HMMissingLessonPlansOverview />
      </Suspense>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-bold text-red-800 mb-2">
                🔴 CRITICAL ALERTS - IMMEDIATE ATTENTION REQUIRED
              </h3>
              <div className="space-y-1">
                {criticalAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center text-sm">
                    <span className="mr-2 text-lg">{alert.icon}</span>
                    <span className={`font-medium text-${alert.color}-800`}>{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Activity Monitor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📊 Live Class Schedule <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <span className="text-xs text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        
        {/* Period Heatmap - Show what's running in each period */}
        <div className="grid grid-cols-8 gap-2 mb-6">
          {[1,2,3,4,5,6,7,8].map(period => {
            const periodClasses = dailyReportsData.reports.filter(r => parseInt(r.period) === period);
            const isCurrent = currentPeriod === period;
            const isPast = currentPeriod && period < currentPeriod;
            const isFuture = currentPeriod && period > currentPeriod;
            
            // Group by subject to show what's being taught
            const subjectCount = {};
            periodClasses.forEach(c => {
              const subj = c.subject || 'Unknown';
              subjectCount[subj] = (subjectCount[subj] || 0) + 1;
            });
            const topSubjects = Object.entries(subjectCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([subj]) => subj);
            
            let bgColor = 'bg-gray-100';
            let textColor = 'text-gray-700';
            let borderColor = '';
            
            if (periodClasses.length === 0) {
              bgColor = 'bg-gray-50 border-2 border-dashed border-gray-300';
              textColor = 'text-gray-400';
            } else if (isCurrent) {
              bgColor = 'bg-blue-500';
              textColor = 'text-white';
              borderColor = 'ring-4 ring-blue-300';
            } else if (isPast) {
              bgColor = 'bg-green-100 border border-green-300';
              textColor = 'text-green-800';
            } else if (isFuture) {
              bgColor = 'bg-orange-50 border border-orange-200';
              textColor = 'text-orange-700';
            }
            
            return (
              <button 
                key={period} 
                onClick={() => setSelectedPeriod(period)}
                className={`relative p-2 rounded-lg ${bgColor} ${borderColor} transition-all hover:shadow-md cursor-pointer hover:scale-105`}
              >
                <div className="text-center">
                  <div className={`text-xs font-bold ${textColor} mb-1`}>
                    Period {period}
                  </div>
                  {periodClasses.length > 0 ? (
                    <>
                      <div className={`text-lg font-bold ${textColor}`}>
                        {periodClasses.length}
                      </div>
                      <div className={`text-xs ${textColor} opacity-90`}>
                        classes
                      </div>
                      {topSubjects.length > 0 && (
                        <div className={`text-xs ${textColor} mt-1 font-medium truncate`}>
                          {topSubjects.join(', ')}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={`text-lg font-bold ${textColor}`}>-</div>
                      <div className={`text-xs ${textColor}`}>No TT</div>
                    </>
                  )}
                  {isCurrent && (
                    <div className="text-xs font-bold text-white mt-1 bg-blue-700 rounded px-1">
                      LIVE NOW
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Message if no timetable data */}
        {dailyReportsData.reports.length === 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">No Timetable Data for Today</h3>
                <p className="text-sm text-blue-700 mt-1">
                  The system cannot find any timetable periods scheduled for today ({new Date().toLocaleDateString('en-US', {weekday: 'long'})}). 
                  Please ensure:
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc space-y-1">
                  <li>Timetable data is uploaded in the Timetable sheet</li>
                  <li>Today's day name matches the timetable day entries</li>
                  <li>Period numbers are correctly assigned (1-8)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{dailyReportsData.stats.submitted || 0}</div>
            <div className="text-xs text-gray-600">Submitted (Today)</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{dailyReportsData.stats.pending || 0}</div>
            <div className="text-xs text-gray-600">Pending (Today)</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{lateSubmissions}</div>
            <div className="text-xs text-gray-600">Late (Today)</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {dailyReportsData.stats.totalPeriods > 0 ? Math.round((dailyReportsData.stats.submitted / dailyReportsData.stats.totalPeriods) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-600">Completion (Today)</div>
          </div>
        </div>
      </div>

      {/* Period Detail Modal */}
      {selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPeriod(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="text-xl font-bold text-white">
                Period {selectedPeriod} - Class Schedule
                {currentPeriod === selectedPeriod && (
                  <span className="ml-3 text-sm bg-white text-blue-600 px-3 py-1 rounded-full font-semibold animate-pulse">
                    🔴 LIVE NOW
                  </span>
                )}
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
                  .sort((a, b) => (a.class || '').localeCompare(b.class || ''));
                
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
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{classData.class}</h4>
                              <p className="text-sm font-medium text-blue-600">{classData.subject}</p>
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
                              <span className="font-medium">{classData.teacher || classData.teacherEmail}</span>
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

      {/* Substitution Notifications */}
      {substitutionNotifications.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Bell className="h-5 w-5 text-amber-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-amber-800">
                Substitution Assignments ({substitutionNotifications.length})
              </h3>
              <div className="mt-2 space-y-2">
                {substitutionNotifications.map((notification) => (
                  <div key={notification.id} className="bg-white p-3 rounded border border-amber-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => acknowledgeNotification(notification.id)}
                        className="ml-3 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
            {substitutionNotifications.length > 0 && (
              <span className="mt-1 px-2 py-0.5 text-xs bg-amber-600 text-white rounded-full">{substitutionNotifications.length}</span>
            )}
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

      {/* Teacher Status Overview */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Teacher Status Overview <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
        <div className="space-y-3">
          {/* Group reports by teacher */}
          {Object.entries(
            dailyReportsData.reports.reduce((acc, report) => {
              const teacherKey = report.teacherEmail || report.teacherName;
              if (!acc[teacherKey]) {
                acc[teacherKey] = {
                  name: report.teacherName || teacherKey,
                  submitted: 0,
                  total: 0,
                  periods: []
                };
              }
              acc[teacherKey].total++;
              if (report.submitted) acc[teacherKey].submitted++;
              acc[teacherKey].periods.push(report.period);
              return acc;
            }, {})
          )
          .sort((a, b) => {
            const aPercent = a[1].total > 0 ? a[1].submitted / a[1].total : 0;
            const bPercent = b[1].total > 0 ? b[1].submitted / b[1].total : 0;
            return aPercent - bPercent; // Sort by completion rate (lowest first)
          })
          .slice(0, 10) // Show top 10 teachers needing attention
          .map(([teacherKey, data]) => {
            const percentage = data.total > 0 ? Math.round((data.submitted / data.total) * 100) : 0;
            let statusColor = 'bg-green-500';
            let statusText = 'All Done';
            if (percentage < 50) {
              statusColor = 'bg-red-500';
              statusText = 'Needs Attention';
            } else if (percentage < 100) {
              statusColor = 'bg-yellow-500';
              statusText = 'In Progress';
            }
            
            return (
              <div key={teacherKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{data.name}</div>
                    <div className="text-xs text-gray-500">Periods: {data.periods.sort((a,b) => a-b).join(', ')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{data.submitted}/{data.total}</div>
                    <div className="text-xs text-gray-500">{statusText}</div>
                  </div>
                  <div className="w-16">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-center text-gray-600 mt-1">{percentage}%</div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {dailyReportsData.reports.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No data available for today</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Timeline Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">📈 Submission Timeline <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <div className="space-y-2">
            {[1,2,3,4,5,6,7,8].map(period => {
              const periodReports = dailyReportsData.reports.filter(r => parseInt(r.period) === period);
              const submitted = periodReports.filter(r => r.submitted).length;
              const total = periodReports.length;
              const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;
              
              return (
                <div key={period} className="flex items-center gap-3">
                  <div className="w-16 text-sm font-medium text-gray-700">Period {period}</div>
                  <div className="flex-1">
                    <div className="relative bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div 
                        className={`h-full flex items-center justify-end pr-2 text-xs font-bold text-white transition-all duration-500 ${
                          percentage >= 80 ? 'bg-green-500' : 
                          percentage >= 60 ? 'bg-blue-500' : 
                          percentage >= 40 ? 'bg-yellow-500' : 
                          percentage > 0 ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 15 && `${percentage}%`}
                      </div>
                      {percentage <= 15 && percentage > 0 && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                          {percentage}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-16 text-sm text-gray-600 text-right">
                    {submitted}/{total}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
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

      {/* Recent Activities - Show latest submissions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">📋 Recent Activity <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
        </div>
        <div className="p-6">
          {dailyReportsData.reports.length > 0 ? (
            <div className="space-y-2">
              {dailyReportsData.reports
                .filter(r => r.submitted)
                .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
                .slice(0, 10)
                .map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{report.teacherName}</div>
                        <div className="text-sm text-gray-500">
                          {stripStdPrefix(report.class)} • {report.subject} • Period {report.period}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {report.completionPercentage != null && (
                        <div className={`text-sm font-semibold ${
                          report.completionPercentage >= 80 ? 'text-green-600' :
                          report.completionPercentage >= 60 ? 'text-blue-600' :
                          report.completionPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {report.completionPercentage}% complete
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(report.submittedAt || report.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No reports submitted yet today</p>
            </div>
          )}
        </div>
      </div>

      {/* Send Notification Modal */}
      {showSendNotification && (
        <div className="fixed inset-0 bg-red-500 bg-opacity-90 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border-8 border-blue-500">
            <div className="p-4 text-center">
              <h1 className="text-2xl font-bold text-red-600">TEST MODAL IS WORKING!</h1>
              <button 
                onClick={() => setShowSendNotification(false)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
              >
                Close Test Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  };
  // Scheme Approvals View
  const SchemeApprovalsView = () => {
    const [allSchemes, setAllSchemes] = useState([]); // Store all schemes loaded once
    const [loading, setLoading] = useState(true); // Add loading state
    const [selectedSchemes, setSelectedSchemes] = useState(new Set()); // For bulk selection
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [statusFilter, setStatusFilter] = useState('Pending'); // Default to pending

    // Ensure sidebar state doesn't auto-toggle here to avoid flicker on mobile

    // Load all schemes ONCE on component mount
    useEffect(() => {
      async function fetchAllSchemes() {
        setLoading(true);
        try {
          const data = await api.getAllSchemes(1, 1000, '', '', '', '', ''); // Get all schemes
          const schemes = Array.isArray(data) ? data : (Array.isArray(data?.plans) ? data.plans : []);
          
          // Sort by createdAt in descending order (latest first)
          schemes.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });
          
          setAllSchemes(schemes);
        } catch (err) {
          console.error('Error fetching schemes:', err);
          setAllSchemes([]);
        } finally {
          setLoading(false);
        }
      }
      fetchAllSchemes();
    }, []); // Empty dependency - load only once

    // CLIENT-SIDE FILTERING
    const filteredSchemes = useMemo(() => {
      let result = allSchemes;
      
      // Filter by status
      if (statusFilter && statusFilter !== 'All') {
        result = result.filter(s => s.status === statusFilter);
      }
      
      // Filter by teacher
      if (selectedTeacher) {
        result = result.filter(s => s.teacherName === selectedTeacher);
      }
      
      // Group by class if enabled
      if (groupByClass) {
        result = [...result].sort((a, b) => (a.class || '').localeCompare(b.class || ''));
      }
      
      // Group by chapter if enabled
      if (groupByChapter) {
        result = [...result].sort((a, b) => (a.chapter || '').localeCompare(b.chapter || ''));
      }
      
      return result;
    }, [allSchemes, statusFilter, selectedTeacher, groupByClass, groupByChapter]);

    // Get unique values for dropdowns - optimized with useMemo
    const uniqueTeachers = useMemo(() => {
      return [...new Set(allSchemes.map(s => s.teacherName).filter(Boolean))].sort();
    }, [allSchemes]);

    const handleApproveScheme = async (schemeId) => {
      try {
        await withSubmit('Approving scheme...', () => api.updatePlanStatus(schemeId, 'Approved'));
        // Remove from allSchemes and maintain filters
        setAllSchemes(prev => prev.filter(scheme => scheme.schemeId !== schemeId));
        setSelectedSchemes(prev => {
          const newSet = new Set(prev);
          newSet.delete(schemeId);
          return newSet;
        });
      } catch (err) {
        console.error(err);
      }
    };

    const handleRejectScheme = async (schemeId) => {
      try {
        await withSubmit('Rejecting scheme...', () => api.updatePlanStatus(schemeId, 'Rejected'));
        // Remove from allSchemes and maintain filters
        setAllSchemes(prev => prev.filter(scheme => scheme.schemeId !== schemeId));
        setSelectedSchemes(prev => {
          const newSet = new Set(prev);
          newSet.delete(schemeId);
          return newSet;
        });
      } catch (err) {
        console.error(err);
      }
    };

    const handleBulkApprove = async () => {
      if (selectedSchemes.size === 0) {
        alert('Please select schemes to approve');
        return;
      }
      
      if (!confirm(`Approve ${selectedSchemes.size} selected scheme(s)?`)) {
        return;
      }

      try {
        const promises = Array.from(selectedSchemes).map(schemeId => 
          api.updatePlanStatus(schemeId, 'Approved')
        );
        await withSubmit(`Approving ${selectedSchemes.size} schemes...`, () => Promise.all(promises));
        
        // Remove approved schemes from allSchemes
        setAllSchemes(prev => prev.filter(scheme => !selectedSchemes.has(scheme.schemeId)));
        setSelectedSchemes(new Set());
      } catch (err) {
        console.error('Bulk approve error:', err);
        alert('Some approvals may have failed. Please refresh to see current status.');
      }
    };

    const handleBulkReject = async () => {
      if (selectedSchemes.size === 0) {
        alert('Please select schemes to reject');
        return;
      }
      
      if (!confirm(`Reject ${selectedSchemes.size} selected scheme(s)?`)) {
        return;
      }

      try {
        const promises = Array.from(selectedSchemes).map(schemeId => 
          api.updatePlanStatus(schemeId, 'Rejected')
        );
        await withSubmit(`Rejecting ${selectedSchemes.size} schemes...`, () => Promise.all(promises));
        
        // Remove rejected schemes from allSchemes
        setAllSchemes(prev => prev.filter(scheme => !selectedSchemes.has(scheme.schemeId)));
        setSelectedSchemes(new Set());
      } catch (err) {
        console.error('Bulk reject error:', err);
        alert('Some rejections may have failed. Please refresh to see current status.');
      }
    };

    const handleSelectAll = () => {
      const pendingOnly = filteredSchemes.filter(s => 
        s.status === 'Pending' || 
        s.status === 'Pending - Validation Override' || 
        s.status === 'Pending - No Timetable'
      );
      
      if (selectedSchemes.size === pendingOnly.length) {
        setSelectedSchemes(new Set());
      } else {
        setSelectedSchemes(new Set(pendingOnly.map(s => s.schemeId)));
      }
    };

    const toggleSchemeSelection = (schemeId) => {
      setSelectedSchemes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(schemeId)) {
          newSet.delete(schemeId);
        } else {
          newSet.add(schemeId);
        }
        return newSet;
      });
    };

    // Show loading spinner while fetching data
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading schemes...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Scheme Approvals</h1>
          {selectedSchemes.size > 0 ? (
            <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
              <button 
                onClick={handleBulkApprove}
                className="flex-1 sm:flex-initial bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-green-700 text-sm"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve ({selectedSchemes.size})
              </button>
              <button 
                onClick={handleBulkReject}
                className="flex-1 sm:flex-initial bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-red-700 text-sm"
              >
                <X className="h-4 w-4 mr-2" />
                Reject ({selectedSchemes.size})
              </button>
            </div>
          ) : null}
        </div>

        {/* Simple Filter Bar - Always Visible */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
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
                  if (newValue) setGroupByChapter(false);
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
                  if (newValue) setGroupByClass(false);
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
            </div>

            {/* Status Quick Filters */}
            <div className="flex gap-2 w-full md:w-auto md:ml-auto">
              <button
                onClick={() => setStatusFilter('Pending')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  statusFilter === 'Pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ⏳ Pending
              </button>
              <button
                onClick={() => setStatusFilter('Approved')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  statusFilter === 'Approved'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ✓ Approved
              </button>
              <button
                onClick={() => setStatusFilter('')}
                className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                  !statusFilter
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                All
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
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-gray-900">
                {statusFilter === 'Approved' ? 'Approved Schemes' : 
                 statusFilter === 'Pending' ? 'Pending Schemes' : 'All Schemes'} 
                ({filteredSchemes.length})
              </h2>
              {(selectedTeacher || groupByClass || groupByChapter) && (
                <div className="flex flex-wrap gap-1 text-xs">
                  {selectedTeacher && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Teacher: {selectedTeacher}</span>
                  )}
                  {groupByClass && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Grouped by Class</span>
                  )}
                  {groupByChapter && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Grouped by Chapter</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredSchemes.map((scheme) => {
              const isPending = scheme.status === 'Pending' || scheme.status === 'Pending - Validation Override' || scheme.status === 'Pending - No Timetable';
              return (
                <div key={scheme.schemeId} className="border-b border-gray-200 p-3 hover:bg-gray-50">
                  {/* Header: Teacher & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">{scheme.teacherName}</div>
                    {scheme.status === 'Approved' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Approved
                      </span>
                    ) : scheme.status === 'Rejected' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        ✗ Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  
                  {/* Class & Subject */}
                  <div className="text-xs text-gray-600 mb-1.5">
                    {stripStdPrefix(scheme.class)} • {scheme.subject}
                  </div>
                  
                  {/* Chapter */}
                  <div className="text-sm text-gray-900 font-medium mb-1.5 line-clamp-2 break-words">{scheme.chapter}</div>
                  
                  {/* Sessions & Date - Compact */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                    <span>{scheme.noOfSessions} Sessions</span>
                    <span>{scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(statusFilter === 'Pending' || !statusFilter) && isPending && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedSchemes.has(scheme.schemeId)}
                          onChange={() => toggleSchemeSelection(scheme.schemeId)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">Select</span>
                      </label>
                    )}
                    <button 
                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100" 
                      onClick={() => openLessonView(scheme)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isPending && (
                      <>
                        <button 
                          onClick={() => handleApproveScheme(scheme.schemeId)}
                          className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          title="Approve"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => handleRejectScheme(scheme.schemeId)}
                          className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                          title="Reject"
                        >
                          ✗
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredSchemes.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No schemes found
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {(statusFilter === 'Pending' || !statusFilter) && (
                    <th className="px-1 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedSchemes.size > 0 && selectedSchemes.size === filteredSchemes.filter(s => s.status?.includes('Pending')).length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[80px]">Teacher</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Class</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[100px]">Subject</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[150px]">Chapter</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-10">Sess</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Date</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-20">Status</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSchemes.map((scheme) => {
                  const isPending = scheme.status === 'Pending' || scheme.status === 'Pending - Validation Override' || scheme.status === 'Pending - No Timetable';
                  return (
                    <tr key={scheme.schemeId} className={`hover:bg-gray-50 ${selectedSchemes.has(scheme.schemeId) ? 'bg-blue-50' : ''}`}>
                      {(statusFilter === 'Pending' || !statusFilter) && (
                        <td className="px-1 py-2">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={selectedSchemes.has(scheme.schemeId)}
                              onChange={() => toggleSchemeSelection(scheme.schemeId)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[80px] truncate" title={scheme.teacherName}>{scheme.teacherName}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 w-16">{stripStdPrefix(scheme.class)}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[100px] truncate" title={scheme.subject}>{scheme.subject}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 max-w-[150px] truncate" title={scheme.chapter}>{scheme.chapter}</td>
                      <td className="px-1 py-2 text-xs text-gray-900 text-center font-medium w-10">{scheme.noOfSessions}</td>
                      <td className="px-1 py-2 text-xs text-gray-600 w-16">{scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                      <td className="px-1 py-2 w-20">
                      {scheme.status === 'Approved' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          ✓
                        </span>
                      ) : scheme.status === 'Rejected' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          ✗
                        </span>
                      ) : scheme.status === 'Pending - Validation Override' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Ovr
                        </span>
                      ) : scheme.status === 'Pending - No Timetable' ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          NoTT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pend
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-2 text-xs text-gray-500 w-24">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        <button type="button"
                          onClick={() => openLessonView(scheme)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View scheme details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {isPending && (
                          <>
                            <button 
                              onClick={() => handleApproveScheme(scheme.schemeId)}
                              className="text-green-600 hover:text-green-900 px-1.5 py-0.5 bg-green-100 rounded text-xs"
                              title="Approve scheme"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => handleRejectScheme(scheme.schemeId)}
                              className="text-red-600 hover:text-red-900 px-1.5 py-0.5 bg-red-100 rounded text-xs"
                              title="Reject scheme"
                            >
                              ✗
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Lesson Approvals View
  const LessonApprovalsView = () => {
    const [allLessons, setAllLessons] = useState([]); // Store all lessons loaded once
    const [loading, setLoading] = useState(true); // Add loading state
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    // Removed: timetable date view UI
    const [rowSubmitting, setRowSubmitting] = useState({});
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

    // CLIENT-SIDE FILTERING - no API calls
    const filteredLessons = useMemo(() => {
      return allLessons.filter(lesson => {
        // Filter by teacher (from simple dropdown)
        if (selectedTeacher && lesson.teacherName !== selectedTeacher) return false;
        
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
    }, [allLessons, selectedTeacher, filters]);

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
      return Object.values(classMap).sort((a, b) => String(a.class || '').localeCompare(String(b.class || '')));
    }, [filteredLessons]);

    const handleApproveLesson = async (lpId, status) => {
      try {
        console.debug('🔵 Single approval - lpId:', lpId, 'status:', status);
        setRowSubmitting(prev => ({ ...prev, [lpId]: true }));
        const response = await api.updateLessonPlanStatus(lpId, status);
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
        if (groupByChapter || groupByClass) {
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
      } catch (e) {
        console.warn('Manual refresh failed:', e);
      } finally {
        setRefreshing(false);
      }
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

        {/* Simple Filter Bar - Always Visible */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
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
                  if (newValue) setGroupByChapter(false);
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
                  if (newValue) setGroupByClass(false);
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
                  className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                >
                  📅 Today
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

        {!groupByChapter && !groupByClass && (
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

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Lesson Plan Details</h2>
          {filteredLessons.length === 0 ? (
            <p className="text-gray-700">No pending lesson plans.</p>
          ) : (
            <p className="text-gray-700">Click the eye icon to view individual lesson, or book icon to view all chapter sessions together.</p>
          )}
        </div>

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
                  <option key={`teacher-${idx}`} value={teacher.name || teacher.email}>
                    {teacher.name || teacher.email}
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
                    {cls}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slot.class}</td>
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
                      <option key={(teacher.email||teacher.name)} value={(teacher.email||teacher.name)}>{teacher.name || teacher.email}</option>
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
                        <option key={`form-class-${idx}`} value={cls}>{cls}</option>
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
                          <div className="text-sm font-medium">{teacher.name || teacher.email}</div>
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
    const [searchDate, setSearchDate] = useState('');
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
          _ts: Date.now()
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
          api.getStudents(exam.class),
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
  const normKey = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  // Use appNormalize defined at the top level of the app
  const userRolesNorm = (user?.roles || []).map(r => appNormalize(r));
  const userClassesSet = new Set((user?.classes || []).map(c => normKey(c)));
  const userSubjectsSet = new Set((user?.subjects || []).map(s => normKey(s)));

    // Filter exams based on user role and permissions

  const examsForTeacher = exams.filter(ex => {
    if (!user) return false;
    if (userRolesNorm.includes('h m')) return true;
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
            {user && (userRolesNorm || []).includes('h m') && (
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
    // Check if user is Super Admin or HM - they can access all classes
    const isSuperAdminOrHM = user?.roles && (
      user.roles.includes('super admin') || 
      user.roles.includes('superadmin') || 
      user.roles.includes('super_admin') || 
      user.roles.includes('h m')
    );
    
    // Fix: Ensure className is a string, not an array
    const rawClassName = user?.classTeacherFor || '';
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
            const studentsData = await api.getStudents('');
            const classes = [...new Set(studentsData.map(s => s.class))].sort();
            setAvailableClasses(classes);
            if (!selectedClass && classes.length > 0) {
              setSelectedClass(classes[0]);
            }
          } catch (err) {
            console.error('Error fetching classes:', err);
          }
        };
        fetchClasses();
      }
    }, [isSuperAdminOrHM]);

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
          const classExams = Array.isArray(examsData) 
            ? examsData.filter(exam => exam.class === selectedClass)
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

    if (!isSuperAdminOrHM && !defaultClassName) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-600">No class assigned as class teacher.</p>
          </div>
        </div>
      );
    }

    if (isSuperAdminOrHM && availableClasses.length === 0) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-600">Loading classes...</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Class Data – {selectedClass}
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
            Class Data {selectedClass && `– ${selectedClass}`}
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
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          )}
        </div>

        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-900">Debug Info:</p>
          <p className="text-blue-700">Class Name: <span className="font-mono">{selectedClass}</span></p>
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
                const classExamsForStudent = exams.filter(exam => exam.class === selectedClass);
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
      
      return result;
    }, [allReports, statusFilter, selectedTeacher, selectedClass, selectedSubject]);

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
          {(selectedTeacher || selectedClass || selectedSubject) && (
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
                if (!confirm('Delete this report? This cannot be undone.')) return;
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
                    if (!confirm('Delete this report? This cannot be undone.')) return;
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
                    <td colSpan={10} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No reports found.
                    </td>
                  </tr>
                )}
                {loadingReports && (
                  <tr>
                    <td colSpan={10} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
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
    const [deletingId, setDeletingId] = useState(null);
    const [rangeMode, setRangeMode] = useState('7d'); // 7d | month | custom
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(1);
    const [maxDisplay, setMaxDisplay] = useState(1000); // soft cap
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [schemeLookup, setSchemeLookup] = useState({});
    const email = user?.email || '';

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

    const total = reports.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginated = reports.slice((page - 1) * pageSize, page * pageSize);

    const exportCSV = () => {
      if (!reports.length) return;
      const headers = ['Date','Class','Subject','Period','Chapter','Session','Completed','Notes'];
      const lines = [headers.join(',')].concat(reports.map(r => [r.date, r.class, r.subject, `P${r.period}`, (r.chapter||'').replace(/,/g,';'), r.sessionNo||'', r.completed||'', (r.notes||'').replace(/\n/g,' ').replace(/,/g,';')].join(',')));
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
            <button onClick={exportCSV} disabled={!reports.length} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-40">Export CSV</button>
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
          <div className="text-xs text-gray-600">Showing reports for <strong>{email}</strong> {(() => { const {from,to}=computeDates(); return `(${from} → ${to})`; })()} • {total} total{total === maxDisplay ? ' (truncated)' : ''}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {(() => {
            const base = reports;
            if (groupByClass || groupByChapter) {
              const keyFn = (r) => groupByClass ? (r.class || 'Unknown Class') : (r.chapter || 'Unknown Chapter');
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
                                const completedVal = r.completed || r.lessonProgressTracked || r.status || '-';
                                const isOwner = String(r.teacherEmail || '').toLowerCase() === String(email || '').toLowerCase();
                                const onDelete = async () => {
                                  if (!id) return alert('Missing report id');
                                  if (!confirm('Delete this report? This cannot be undone.')) return;
                                  try {
                                    setDeletingId(id);
                                    const res = await api.deleteDailyReport(id, email);
                                    if (res && res.success) {
                                      setReports(prev => prev.filter(x => (x.id || x.reportId || '') !== id));
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
                                  <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}>
                                    <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                                    {!groupByClass && (<td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>)}
                                    <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                                    <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                                    {!groupByChapter && (<td className="px-2 py-2 text-xs text-gray-700 truncate">{r.chapter || '-'}</td>)}
                                    <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                                    <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                                    <td className="px-2 py-2 text-xs">{completedVal}</td>
                                    <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                                    <td className="px-2 py-2 text-xs">
                                      {r.verified === 'TRUE' ? (
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
                                        <span className="text-xs text-gray-400">Pending</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-xs text-right">
                                      {isOwner && (
                                        <button onClick={onDelete} disabled={!id || deletingId === id} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 disabled:opacity-40 inline-flex items-center">
                                          {deletingId === id && (<span className="inline-block h-3 w-3 mr-1 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>)}
                                          {deletingId === id ? 'Deleting…' : 'Delete'}
                                        </button>
                                      )}
                                    </td>
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
                      {!loading && reports.length === 0 && (<tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No reports in this range.</td></tr>)}
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
                        const completedVal = r.completed || r.lessonProgressTracked || r.status || '-';
                        return (
                        <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}> 
                          <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                          <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 truncate">{r.chapter || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                          <td className="px-2 py-2 text-xs">{completedVal}</td>
                          <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                          <td className="px-2 py-2 text-xs">
                            {r.verified === 'TRUE' ? (
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
                              <span className="text-xs text-gray-400">Pending</span>
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
          {apiError && (
            <div className="fixed top-4 right-4 z-50">
              <div className="bg-red-100 text-red-800 px-4 py-2 rounded shadow">{apiError}</div>
            </div>
          )}
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
        {apiError && (
          <div className="fixed top-4 right-4 z-50">
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded shadow flex items-center space-x-3">
              <div>{apiError}</div>
              <button onClick={() => setApiError(null)} className="text-sm text-red-600">Dismiss</button>
            </div>
          </div>
        )}
        
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
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

// Main App component wrapped with NotificationProvider
const AppWithNotifications = () => {
  return (
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
};

export default AppWithNotifications;


