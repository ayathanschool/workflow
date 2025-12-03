import * as api from './api'
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import LoginForm from './auth/LoginForm';
import LoadingSplash from './auth/LoadingSplash';
import TopBar from './layout/TopBar';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import ThemeToggle from './components/ThemeToggle';
import AnimatedPage from './components/AnimatedPage';
import { useTheme } from './contexts/ThemeContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import NotificationCenter from './components/NotificationCenter';
import PWAControls from './components/PWAControls';
import PWAInstallBanner from './components/PWAInstallBanner';
// import { useRealTimeUpdates } from './hooks/useRealTimeUpdates';

// Lazy load heavy components for better performance
const SmartReminders = lazy(() => import('./components/SmartReminders'));
const SubstitutionModule = lazy(() => import('./components/SubstitutionModule'));
const EnhancedSubstitutionView = lazy(() => import('./components/EnhancedSubstitutionView'));
const DailyReportModern = lazy(() => import('./DailyReportModern'));
const ClassPeriodSubstitutionView = lazy(() => import('./components/ClassPeriodSubstitutionView'));
const ExamManagement = lazy(() => import('./components/ExamManagement'));
const ReportCard = lazy(() => import('./components/ReportCard'));
const SchemeLessonPlanning = lazy(() => import('./components/SchemeLessonPlanning'));
const SessionCompletionTracker = lazy(() => import('./components/SessionCompletionTracker'));
const HMDailyOversight = lazy(() => import('./components/HMDailyOversightEnhanced'));
const HMTeacherPerformanceView = lazy(() => import('./components/HMTeacherPerformanceView'));

// Keep lightweight components as regular imports
import AppLayout from './components/AppLayout';
import { periodToTimeString, isDateForNextWeek, todayIST, formatDateForInput, parseApiDate, createISTTimestamp, formatIndianDate, toISTDateString } from './utils/dateUtils';
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
  Clipboard,
  BarChart2,
  TrendingUp,
  Bell,
  Search,
  Filter,
  Eye,
  Edit,
  Save,
  Plus,
  Trash2,
  Send,
  Download,
  Upload,
  Settings,
  UserCheck,
  Award,
  Activity,
  School,
  UserCircle,
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
  XCircle
} from 'lucide-react';

// Common utility functions to avoid duplication
const appNormalize = (s) => (s || '').toString().trim().toLowerCase();

const App = () => {
  
  // Get notifications context
  const notificationSystem = useNotifications();
  
  // Get theme context
  const { theme } = useTheme();
  
  // API error banner state
  const [apiError, setApiError] = useState(null);
  
  // App settings for the whole application
  const [appSettings, setAppSettings] = useState({
    lessonPlanningDay: '',       // No restriction until settings define it
    allowNextWeekOnly: false,    // Next-week-only restriction disabled
    periodTimes: null            // Will store custom period times if available
  });
  
  // Create a memoized version of appSettings to avoid unnecessary re-renders
  const memoizedSettings = useMemo(() => {
    return appSettings || {
      lessonPlanningDay: '',
      allowNextWeekOnly: false,
      periodTimes: null
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
        // Temporarily disabled to prevent errors
        // const settings = await api.getAppSettings();
        const settings = null; // Use default settings
        if (settings) {
          setAppSettings({
            lessonPlanningDay: settings.lessonPlanningDay || '',
            allowNextWeekOnly: false, // Ignore sheet value; do not restrict to next week
            periodTimes: settings.periodTimes || null
          });
        }
      } catch (err) {
        console.warn('Error loading app settings:', err);
        // Keep default settings
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
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-gray-900">{value ?? '-'}</div>
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
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 mx-4">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-gray-900">{viewModal.title || 'Lesson Details'}</h3>
            <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Objectives</h4>
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{viewModal.objectives || '-'}</div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700">Activities</h4>
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{viewModal.activities || '-'}</div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setViewModal(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
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
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{viewLesson.title || viewLesson.chapter || viewLesson.lpId || viewLesson.schemeId || viewLesson.class || 'Details'}</h3>
            <button onClick={closeLessonView} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
              <Detail label="Class" value={viewLesson.class} />
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
              <h4 className="text-sm font-medium text-gray-700 mb-2">Learning Objectives</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {viewLesson.learningObjectives || viewLesson.objectives || '-'}
              </div>
            </div>
            
            {/* Teaching Methods */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Teaching Methods</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded">
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
        { id: 'class-students', label: 'Students', icon: Users }
      );
    }

    if (hasRole('h m')) {
      items.push(
        { id: 'scheme-approvals', label: 'Scheme Approvals', icon: FileCheck },
        { id: 'lesson-approvals', label: 'Lesson Approvals', icon: BookCheck },
        { id: 'daily-oversight', label: 'Daily Oversight (Enhanced)', icon: ClipboardCheck },
        { id: 'teacher-performance', label: 'Teacher Performance', icon: BarChart2 },
        { id: 'substitutions', label: 'Substitutions', icon: UserPlus },
        { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
        { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays },
        { id: 'smart-reminders', label: 'Smart Reminders', icon: Bell },
        { id: 'exam-marks', label: 'Exam Marks', icon: Award },
        { id: 'report-card', label: 'Report Card', icon: FileText }
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
                        
                        marks.forEach(mark => {
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
                        
                        if (studentMarks.length > 0) {
                          // Calculate class average
                          const percentages = studentMarks.map(m => m.percentage);
                          const avgPercentage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
                          
                          // Categorize students for this class
                          const aboveAverage = percentages.filter(p => p >= avgPercentage).length;
                          const needFocus = percentages.filter(p => p < 50).length;
                          
                          classPerformance[className] = {
                            aboveAverage,
                            needFocus,
                            avgPercentage: Math.round(avgPercentage),
                            totalStudents: studentMarks.length
                          };
                          
                          totalAboveAverage += aboveAverage;
                          totalNeedFocus += needFocus;
                        }
                      }
                    });
                    
                    studentsAboveAverage = totalAboveAverage;
                    studentsNeedFocus = totalNeedFocus;
                    
                    console.log('📊 Class-wise Performance:', classPerformance);
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
            setInsights({
              planCount: 0,
              lessonCount: 0,
              teacherCount: 0,
              classCount,
              subjectCount,
              pendingReports,
              classStudentCounts,
              teachingClasses,
              teachingSubjects,
              studentsAboveAverage,
              studentsNeedFocus,
              classPerformance
            });
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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

  {user && hasRole('h m') ? (
          <HMDashboardView insights={insights} />
  ) : user && hasAnyRole(['teacher','class teacher','daily reporting teachers']) ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Classes Teaching */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <School className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Classes</p>
                    <p className="text-2xl font-bold text-gray-900">{insights.classCount}</p>
                  </div>
                </div>
              </div>
              
              {/* Subjects */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Book className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Subjects</p>
                    <p className="text-2xl font-bold text-gray-900">{insights.subjectCount}</p>
                  </div>
                </div>
              </div>
              
              {/* Pending Reports */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                    <p className="text-2xl font-bold text-gray-900">{insights.pendingReports}</p>
                  </div>
                </div>
              </div>
              
              {/* Students Above Average - Only for class teachers with performance data */}
              {hasRole('class teacher') && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center">
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <Award className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Above Average</p>
                      <p className="text-2xl font-bold text-gray-900">{insights.studentsAboveAverage}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Students Need Focus - Only for class teachers with performance data */}
              {hasRole('class teacher') && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Need Focus</p>
                      <p className="text-2xl font-bold text-gray-900">{insights.studentsNeedFocus}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Detailed Teaching Assignment - Shows specific classes and subjects */}
            {(insights.teachingClasses.length > 0 || insights.teachingSubjects.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Teaching Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {insights.teachingClasses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Classes</p>
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
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Class-wise Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(insights.classPerformance).map(([className, perf]) => (
                    <div key={className} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">{className}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Class Average:</span>
                          <span className="text-sm font-semibold text-blue-600">{perf.avgPercentage}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Students:</span>
                          <span className="text-sm font-semibold">{perf.totalStudents}</span>
                        </div>
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome, {user?.name}</h2>
            <p className="text-gray-600">Use the navigation menu to access your school workflow tools.</p>
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
    const { theme } = useTheme();
    
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
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            <div className={`relative flex-1 flex flex-col max-w-xs w-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
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
                  <span className={`ml-2 text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SchoolFlow</span>
                </div>
                <nav className="mt-5 px-2 space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveView(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`${
                          activeView === item.id
                            ? 'bg-blue-100 text-blue-600'
                            : theme === 'dark' 
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
            <div className={`flex flex-col h-0 flex-1 border-r ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} transition-colors duration-300`}>
              <div className={`flex items-center h-16 flex-shrink-0 px-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
                <School className="h-8 w-8 text-blue-600" />
                <span className={`ml-2 text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SchoolFlow</span>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto">
                <nav className={`flex-1 px-2 py-4 space-y-1 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} transition-colors duration-300`}>
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`${
                          activeView === item.id
                            ? 'bg-blue-100 text-blue-600'
                            : theme === 'dark' 
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
    const { theme } = useTheme();
    return (
      <div className={`flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b transition-colors duration-300`}>
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden mr-3 p-2 rounded-md transition-colors duration-200 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'}`}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className={`text-xl font-semibold capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {activeView.replace('-', ' ')}
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <button className={`p-2 transition-colors duration-200 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-500'}`}>
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className={`ml-2 hidden md:block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
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
              className={`ml-4 text-sm flex items-center transition-colors duration-200 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
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
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }>
        <AnimatedPage transitionKey={activeView}>
          {(() => {
            switch (activeView) {
        case 'dashboard':
          return <Dashboard 
            showSendNotification={showSendNotification} 
            setShowSendNotification={setShowSendNotification}
            notificationData={notificationData}
            setNotificationData={setNotificationData}
          />;
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
        return <ReportsView />;
      case 'hm-dashboard':
        // hm-dashboard should reuse the main Dashboard to avoid duplicate UIs
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
      case 'teacher-performance':
        return <HMTeacherPerformanceView user={user} />;
      case 'substitutions':
        return <EnhancedSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
      case 'full-timetable':
        return <FullTimetableView />;
      case 'smart-reminders':
        return <SmartReminders user={user} />;
      case 'exam-marks':
        return <ExamManagement user={user} withSubmit={withSubmit} />;
      case 'report-card':
        return <ReportCard user={user} />;
      case 'class-data':
        return <ClassDataView />;
      case 'class-students':
        return <ClassStudentsView />;
      case 'daily-reports-management':
        return <DailyReportsManagementView />;
      case 'class-period-timetable':
        return <ClassPeriodSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
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
        setSubmitting({ active: true, message: 'Submitting scheme...' });
        
        // Submit the scheme with timetable validation
        const schemeData = {
          teacherName: user.name || '',
          class: formData.class,
          subject: formData.subject,
          term: formData.term,
          unit: formData.unit,
          chapter: formData.chapter,
          month: formData.month,
          noOfSessions: formData.noOfSessions
        };
        
        const response = await api.submitPlan(user.email, schemeData);
        
        // Unwrap the response (backend wraps in {status, data, timestamp})
        const result = response.data || response;
        
        // Check if validation failed
        if (!result.ok && result.error === 'Session count mismatch') {
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
        setSchemes(Array.isArray(list) ? list : []);
        
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
          setSchemes(Array.isArray(list) ? list : []);
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
            <h2 className="text-lg font-semibold mb-4">Submit New Scheme of Work</h2>
            
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
                    <option key={cls} value={cls}>{cls}</option>
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

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Submitted Schemes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schemes.map((scheme) => (
                  <tr key={scheme.schemeId || scheme.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.noOfSessions || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scheme.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        scheme.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        scheme.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {scheme.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button type="button" className="text-blue-600 hover:text-blue-900 mr-3" onClick={() => openLessonView(scheme)} title="View scheme">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {schemes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No schemes submitted yet.
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
    const [preparationData, setPreparationData] = useState({
      schemeId: '',
      session: '1',
      objectives: '',
      activities: '',
      notes: ''
    });
    
    // Filter states for lesson plans
    const [lessonPlanFilters, setLessonPlanFilters] = useState({
      class: '',
      subject: '',
      status: '',
      chapter: ''
    });
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Submitted Lesson Plans</h2>
            <p className="text-sm text-gray-500 mt-1">View and manage all your submitted lesson plans</p>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={lessonPlanFilters.class}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, class: e.target.value})}
                  className="min-w-[120px] border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Classes</option>
                  {[...new Set(lessonPlans.map(plan => plan.class))].sort().map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={lessonPlanFilters.subject}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, subject: e.target.value})}
                  className="min-w-[120px] border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Subjects</option>
                  {[...new Set(lessonPlans.map(plan => plan.subject))].sort().map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={lessonPlanFilters.status}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, status: e.target.value})}
                  className="min-w-[120px] border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  {[...new Set(lessonPlans.map(plan => plan.status))].sort().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
                <select
                  value={lessonPlanFilters.chapter}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, chapter: e.target.value})}
                  className="min-w-[120px] border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Chapters</option>
                  {[...new Set(lessonPlans.map(plan => plan.chapter).filter(Boolean))].sort().map(chapter => (
                    <option key={chapter} value={chapter}>{chapter}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setLessonPlanFilters({ class: '', subject: '', status: '', chapter: '' })}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lessonPlans
                  .filter(plan => {
                    return (
                      (!lessonPlanFilters.class || plan.class === lessonPlanFilters.class) &&
                      (!lessonPlanFilters.subject || plan.subject === lessonPlanFilters.subject) &&
                      (!lessonPlanFilters.status || plan.status === lessonPlanFilters.status) &&
                      (!lessonPlanFilters.chapter || plan.chapter === lessonPlanFilters.chapter)
                    );
                  })
                  .map((plan) => {
                  // Get scheme info if available
                  const relatedScheme = approvedSchemes.find(s => s.schemeId === plan.schemeId);
                  
                  return (
                    <tr key={plan.lpId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{plan.class}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{plan.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{plan.chapter || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{plan.session}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        <button type="button" className="text-blue-600 hover:text-blue-900" onClick={() => openLessonView(plan)} title="View lesson plan">
                          <Eye className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lessonPlans
                  .filter(plan => {
                    return (
                      (!lessonPlanFilters.class || plan.class === lessonPlanFilters.class) &&
                      (!lessonPlanFilters.subject || plan.subject === lessonPlanFilters.subject) &&
                      (!lessonPlanFilters.status || plan.status === lessonPlanFilters.status) &&
                      (!lessonPlanFilters.chapter || plan.chapter === lessonPlanFilters.chapter)
                    );
                  }).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {lessonPlans.length === 0 ? 'No lesson plans submitted yet.' : 'No lesson plans match the selected filters.'}
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Timetable</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">This Week</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                  {periodHeaders.map(period => (
                    <th key={period} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timetable.map((day, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {day.day}
                    </td>
                    {periodHeaders.map(periodNumber => {
                      const p = Array.isArray(day.periods)
                        ? day.periods.find(x => x.period === periodNumber)
                        : undefined;
                      return (
                        <td key={periodNumber} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {p ? `${p.class} - ${p.subject}` : ''}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.class}</td>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Assigned Substitutions ({substitutions.length})</h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading substitutions...</p>
              </div>
            ) : substitutions.length === 0 ? (
              <div>
                <div className="text-center py-12">
                  <UserPlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No substitutions found for the selected period</p>
                  <p className="text-sm text-gray-500">Showing results for: {startDate} to {endDate}</p>
                </div>
                
                {/* Debug Info */}
                {debugInfo && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-sm text-gray-700 mb-2">Debug Information:</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>• Total substitutions in sheet: <strong>{debugInfo.totalInSheet}</strong></p>
                      <p>• Searching for teacher: <strong>{debugInfo.searchedEmail}</strong></p>
                      <p>• Date range: <strong>{debugInfo.searchedRange}</strong></p>
                      {debugInfo.allData && debugInfo.allData.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium mb-1">All substitutions in sheet:</p>
                          <div className="max-h-60 overflow-y-auto">
                            {debugInfo.allData.map((sub, idx) => (
                              <div key={idx} className="pl-4 py-1 border-l-2 border-gray-300 mb-2">
                                <p>Date: {sub.date} | Period: {sub.period} | Class: {sub.class}</p>
                                <p>Substitute: <strong>{sub.substituteTeacher}</strong></p>
                                <p className="text-gray-500">Absent: {sub.absentTeacher}</p>
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent Teacher</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {substitutions.map((sub, index) => {
                      const uniqueId = `${sub.date}-${sub.period}-${sub.class}`;
                      const acknowledged = isAcknowledged(sub);
                      const acknowledging = acknowledgingId === uniqueId;
                      
                      return (
                        <tr key={index} className={acknowledged ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {new Date(sub.date).toLocaleDateString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Period {sub.period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {getPeriodTime(sub.period)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sub.class}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex flex-col">
                              <span className="font-medium">{sub.substituteSubject || sub.regularSubject}</span>
                              {sub.substituteSubject !== sub.regularSubject && (
                                <span className="text-xs text-gray-500">(Original: {sub.regularSubject})</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {sub.absentTeacher}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {sub.note || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {acknowledged ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Check className="w-3 h-3 mr-1" />
                                Acknowledged
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
                              <span className="text-xs text-gray-500">
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
    console.log('🚀 HMDashboardView rendering with insights:', insights);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dailyReportsData, setDailyReportsData] = useState({ reports: [], stats: {} });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [paceTracking, setPaceTracking] = useState(null);
    const [loadingPaceTracking, setLoadingPaceTracking] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

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
        console.log('📊 Loading daily reports for:', today);
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;
        console.log('📊 Daily reports response:', data);
        console.log('📊 Reports array:', data.reports);
        console.log('📊 Reports count:', data.reports?.length || 0);
        console.log('📊 Stats:', data.stats);
        
        if (data.reports && data.reports.length > 0) {
          console.log('📊 Sample report:', data.reports[0]);
          // Group by period to see distribution
          const byPeriod = {};
          data.reports.forEach(r => {
            const p = r.period;
            byPeriod[p] = (byPeriod[p] || 0) + 1;
          });
          console.log('📊 Reports by period:', byPeriod);
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

    // Prefer dynamic period times from settings if available
    const dynamicTimes = (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length)
      ? memoizedSettings.periodTimes.map(p => {
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
                          {report.class} • {report.subject} • Period {report.period}
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
    const [pendingSchemes, setPendingSchemes] = useState([]);
    const [allSchemes, setAllSchemes] = useState([]); // Store all schemes for filter options
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      subject: '',
      status: 'Pending' // Default to pending for approvals
    });

    // Auto-hide sidebar when viewing approvals
    useEffect(() => {
      setSidebarOpen(false);
    }, []);

    // Get unique values for dropdowns - optimized with useMemo
    const uniqueTeachers = useMemo(() => {
      return [...new Set(allSchemes.map(s => s.teacherName).filter(Boolean))].sort();
    }, [allSchemes]);
    
    const uniqueClasses = useMemo(() => {
      return [...new Set(allSchemes.map(s => s.class).filter(Boolean))].sort();
    }, [allSchemes]);
    
    const uniqueSubjects = useMemo(() => {
      return [...new Set(allSchemes.map(s => s.subject).filter(Boolean))].sort();
    }, [allSchemes]);

    // Load all schemes once for filter options
    useEffect(() => {
      async function fetchAllSchemes() {
        try {
          const data = await api.getAllSchemes(1, 1000, '', '', '', '', ''); // Get all schemes regardless of status
          // Backend returns array directly, not wrapped in .plans
          const schemes = Array.isArray(data) ? data : (Array.isArray(data?.plans) ? data.plans : []);
          setAllSchemes(schemes);
        } catch (err) {
          console.error('Error fetching schemes for filters:', err);
          // Set empty array as fallback to prevent filter UI from breaking
          setAllSchemes([]);
        }
      }
      fetchAllSchemes();
    }, []);

    // Load filtered schemes
    useEffect(() => {
      async function fetchPendingSchemes() {
        try {
          // Ensure empty strings for "All" selections  
          const teacherFilter = filters.teacher === '' ? '' : filters.teacher;
          const classFilter = filters.class === '' ? '' : filters.class;
          const subjectFilter = filters.subject === '' ? '' : filters.subject;
          const statusFilter = filters.status === '' || filters.status === 'All' ? '' : filters.status;
          
          // Use getAllSchemes API with status filter directly - backend handles exact matching
          const data = await api.getAllSchemes(1, 200, teacherFilter, classFilter, subjectFilter, statusFilter, '');
          
          // Backend returns array directly, not wrapped in .plans  
          let schemes = Array.isArray(data) ? data : (Array.isArray(data?.plans) ? data.plans : []);
          // Sort by createdAt in descending order (latest first)
          schemes.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA; // Latest first
          });
          setPendingSchemes(schemes);
        } catch (err) {
          console.error('Error fetching filtered schemes:', err);
          setPendingSchemes([]); // Set empty array on error to prevent UI breaking
        }
      }
      fetchPendingSchemes();
    }, [filters]);

    const handleApproveScheme = async (schemeId) => {
      try {
        await withSubmit('Approving scheme...', () => api.updatePlanStatus(schemeId, 'Approved'));
        setPendingSchemes(pendingSchemes.filter(scheme => scheme.schemeId !== schemeId));
      } catch (err) {
        console.error(err);
      }
    };

    const handleRejectScheme = async (schemeId) => {
      try {
        await withSubmit('Rejecting scheme...', () => api.updatePlanStatus(schemeId, 'Rejected'));
        setPendingSchemes(pendingSchemes.filter(scheme => scheme.schemeId !== schemeId));
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div className="space-y-6 max-w-full">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Scheme Approvals</h1>
          <div className="flex space-x-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Schemes</h3>
            <div className="space-y-4">
              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Pending' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Pending' && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ⏳ Pending Only
                </button>
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Approved' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    filters.status === 'Approved' && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ✓ Approved Only
                </button>
                <button
                  onClick={() => setFilters({ teacher: '', class: '', subject: '', status: '' })}
                  className={`px-3 py-1 text-sm rounded-full transition-all ${
                    !filters.status && !filters.teacher && !filters.class && !filters.subject
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Schemes
                </button>
              </div>
              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    <option value="Pending">Pending</option>
                    <option value="Pending - Validation Override">Pending - Override</option>
                    <option value="Pending - No Timetable">Pending - No TT</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="">All Statuses</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-gray-900">
                {filters.status === 'Approved' ? 'Approved Schemes' : 
                 filters.status === 'Pending' ? 'Pending Schemes' : 'All Schemes'} 
                ({pendingSchemes.length})
              </h2>
              {/* Active Filter Status Display */}
              {(filters.teacher || filters.class || filters.subject || (filters.status && filters.status !== 'Pending')) && (
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
                  {filters.status && filters.status !== 'Pending' && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded">Status: {filters.status}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Teacher</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase w-12">Sess</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Submitted</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-20">Status</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingSchemes.map((scheme) => (
                  <tr key={scheme.schemeId} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-xs text-gray-900 truncate">{scheme.teacherName}</td>
                    <td className="px-2 py-2 text-xs text-gray-900">{scheme.class}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 truncate">{scheme.subject}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 truncate">{scheme.chapter}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 text-center font-medium">{scheme.noOfSessions}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</td>
                    <td className="px-2 py-2">
                      {scheme.status === 'Approved' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Approved
                        </span>
                      ) : scheme.status === 'Rejected' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ✗ Rejected
                        </span>
                      ) : scheme.status === 'Pending - Validation Override' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Override
                        </span>
                      ) : scheme.status === 'Pending - No Timetable' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          No TT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button type="button"
                          onClick={() => openLessonView(scheme)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View scheme details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(scheme.status === 'Pending' || scheme.status === 'Pending - Validation Override' || scheme.status === 'Pending - No Timetable') && (
                          <>
                            <button 
                              onClick={() => handleApproveScheme(scheme.schemeId)}
                              className="text-green-600 hover:text-green-900 px-2 py-1 bg-green-100 rounded text-xs"
                              title="Approve scheme"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => handleRejectScheme(scheme.schemeId)}
                              className="text-red-600 hover:text-red-900 px-2 py-1 bg-red-100 rounded text-xs"
                              title="Reject scheme"
                            >
                              ✗
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Lesson Approvals View
  const LessonApprovalsView = () => {
    const [pendingLessons, setPendingLessons] = useState([]);
    const [allLessons, setAllLessons] = useState([]); // Store all lessons for filter options
    const [showFilters, setShowFilters] = useState(false);
    // Removed: timetable date view UI
    const [rowSubmitting, setRowSubmitting] = useState({});
    const [refreshing, setRefreshing] = useState(false);
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [groupByClass, setGroupByClass] = useState(false);
    const [chapterGroups, setChapterGroups] = useState([]);
    const [classGroups, setClassGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
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
      const lessons = pendingLessons.filter(l => {
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

    // Auto-hide sidebar when viewing approvals
    useEffect(() => {
      setSidebarOpen(false);
    }, []);

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

    // Load all lessons once for reference
    useEffect(() => {
      async function fetchAllLessons() {
        try {
          const data = await api.getPendingLessonReviews('', '', '', ''); // Get all for reference
          const lessons = Array.isArray(data) ? data : [];
          setAllLessons(lessons);
        } catch (err) {
          console.error('Error fetching lessons for filters:', err);
          // Set empty array as fallback to prevent filter UI from breaking
          setAllLessons([]);
        }
      }
      fetchAllLessons();
    }, []);

    // Load lessons or grouped data based on toggles and filters
    useEffect(() => {
      async function fetchData() {
        try {
          const teacherFilter = filters.teacher === '' ? '' : filters.teacher;
          const classFilter = filters.class === '' ? '' : filters.class;
          const subjectFilter = filters.subject === '' ? '' : filters.subject;
          const statusFilter = filters.status === '' || filters.status === 'All' ? '' : filters.status;
          const dateFrom = filters.dateFrom || '';
          const dateTo = filters.dateTo || '';

          if (groupByChapter) {
            setGroupsLoading(true);
            const res = await api.getLessonPlansByChapter({ teacher: teacherFilter, class: classFilter, subject: subjectFilter, status: statusFilter || 'Pending Review', dateFrom, dateTo });
            const groups = (res?.groups) || (Array.isArray(res) ? res : []);
            setChapterGroups(groups);
            setGroupsLoading(false);
            return;
          }
          if (groupByClass) {
            setGroupsLoading(true);
            const res = await api.getLessonPlansByClass({ teacher: teacherFilter, class: classFilter, subject: subjectFilter, status: statusFilter || 'Pending Review', dateFrom, dateTo });
            const groups = (res?.groups) || (Array.isArray(res) ? res : []);
            setClassGroups(groups);
            setGroupsLoading(false);
            return;
          }

          // Default flat list
          const data = await api.getPendingLessonReviews(teacherFilter, classFilter, subjectFilter, statusFilter);
          let lessons = Array.isArray(data) ? data : [];
          // Sort by selectedDate in descending order
          lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
          setPendingLessons(lessons);
        } catch (err) {
          console.error('Error fetching approvals data:', err);
          setGroupsLoading(false);
        }
      }
      fetchData();
    }, [filters, groupByChapter, groupByClass]);

    const handleApproveLesson = async (lpId, status) => {
      try {
        console.log('🔵 Single approval - lpId:', lpId, 'status:', status);
        setRowSubmitting(prev => ({ ...prev, [lpId]: true }));
        const response = await api.updateLessonPlanStatus(lpId, status);
        console.log('🔵 Single approval response:', response);
        
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
        
        setPendingLessons(prev => {
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
        setPendingLessons(lessons);
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
        const teacherFilter = filters.teacher === '' ? '' : filters.teacher;
        const classFilter = filters.class === '' ? '' : filters.class;
        const subjectFilter = filters.subject === '' ? '' : filters.subject;
        const statusFilter = filters.status === '' || filters.status === 'All' ? '' : filters.status;
        const dateFrom = filters.dateFrom || '';
        const dateTo = filters.dateTo || '';

        if (groupByChapter) {
          api.clearCache('getLessonPlansByChapter');
          const res = await api.getLessonPlansByChapter({ teacher: teacherFilter, class: classFilter, subject: subjectFilter, status: statusFilter || 'Pending Review', dateFrom, dateTo, noCache: true });
          setChapterGroups(res?.groups || []);
        } else if (groupByClass) {
          api.clearCache('getLessonPlansByClass');
          const res = await api.getLessonPlansByClass({ teacher: teacherFilter, class: classFilter, subject: subjectFilter, status: statusFilter || 'Pending Review', dateFrom, dateTo, noCache: true });
          setClassGroups(res?.groups || []);
        } else {
          api.clearCache('getPendingLessonReviews');
          let lessons = await api.getPendingLessonReviews(teacherFilter, classFilter, subjectFilter, statusFilter, { noCache: true });
          lessons = Array.isArray(lessons) ? lessons : [];
          lessons.sort((a,b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
          if (filters.status === 'Pending Review') lessons = lessons.filter(l => l.status === 'Pending Review');
          setPendingLessons(lessons);
        }
      } catch (e) {
        console.warn('Manual refresh failed:', e);
      } finally {
        setRefreshing(false);
      }
    };

    // Batch selection, chapter grouping, and modal approval removed per request

    return (
      <div className="space-y-6 max-w-full">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Lesson Plan Approvals</h1>
          <div className="flex space-x-3">
            <button
              onClick={refreshApprovals}
              disabled={refreshing}
              className={`bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Force refresh (bypass cache)"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => setGroupByChapter(v => { const nv = !v; if (nv) setGroupByClass(false); return nv; })}
              className={`px-4 py-2 rounded-lg flex items-center ${groupByChapter ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              title="Toggle chapter-wise view"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              {groupByChapter ? 'Grouped by Chapter' : 'Group by Chapter'}
            </button>
            <button
              onClick={() => setGroupByClass(v => { const nv = !v; if (nv) setGroupByChapter(false); return nv; })}
              className={`px-4 py-2 rounded-lg flex items-center ${groupByClass ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              title="Toggle class-wise view"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              {groupByClass ? 'Grouped by Class' : 'Group by Class'}
            </button>
            <button 
              onClick={() => {
                setShowFilters(!showFilters);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>


        {/* Filter Panel */}
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
                ({pendingLessons.length})
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
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Teacher</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase w-10">Sess</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Submitted</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Planned</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-20">Status</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingLessons.map((lesson) => {
                  return (
                    <tr key={lesson.lpId} className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-xs text-gray-900 truncate">{lesson.teacherName}</td>
                      <td className="px-2 py-2 text-xs text-gray-900">{lesson.class}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 truncate">{lesson.subject}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 truncate">{lesson.chapter}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 text-center font-medium">
                        {lesson.noOfSessions ? `${lesson.session}/${lesson.noOfSessions}` : lesson.session}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600">{lesson.submittedAt ? new Date(lesson.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</td>
                      <td className="px-2 py-2 text-xs text-gray-600"><div className="flex flex-col"><span>{lesson.selectedDate ? new Date(lesson.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</span><span className="text-xs text-gray-500">P{lesson.selectedPeriod || '-'}</span></div></td>
                    <td className="px-2 py-2">
                      {lesson.status === 'Ready' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Ready
                        </span>
                      ) : lesson.status === 'Needs Rework' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Rework
                        </span>
                      ) : lesson.status === 'Rejected' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ✗ Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <button type="button" 
                          className="text-blue-600 hover:text-blue-900 p-1" 
                          onClick={() => openLessonView(lesson)} 
                          title="View lesson details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                          <button type="button" 
                            className="text-purple-600 hover:text-purple-900 p-1" 
                            onClick={() => viewChapterSessions(lesson)} 
                            title="View all chapter sessions"
                          >
                            <BookOpen className="h-4 w-4" />
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
            {groupsLoading ? (
              <p className="text-gray-700">Loading chapter groups…</p>
            ) : chapterGroups.length === 0 ? (
              <p className="text-gray-700">No lesson plans match the current filters.</p>
            ) : (
              <div className="space-y-4">
                {chapterGroups.map(g => {
                  const pending = g.counts?.pending || 0;
                  const approved = g.counts?.ready || 0;
                  return (
                    <div key={g.key} className="border rounded-lg">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div>
                          <div className="text-sm text-gray-600">{g.class} • {g.subject} • {g.teacherName}</div>
                          <div className="text-base font-semibold text-gray-900">{g.chapter}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">Pending: {pending}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Approved: {approved}</span>
                          <button
                            onClick={() => {
                              const lessons = (g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                              setSelectedChapter({ schemeId: g.schemeId || '', chapter: g.chapter, class: g.class, subject: g.subject, teacherName: g.teacherName, lessons });
                              setShowChapterModal(true);
                            }}
                            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >Open Chapter</button>
                        </div>
                      </div>
                      <div className="divide-y">
                        {(g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                          <div key={l.lpId} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-xs text-gray-600">Session {l.session}</div>
                              <div className="text-xs text-gray-600">{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                              <div className="text-xs text-gray-500">P{l.selectedPeriod || '-'}</div>
                              <div className="text-xs text-gray-700 truncate max-w-[28rem]">{l.learningObjectives || '-'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                              {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                <>
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}>✓</button>
                                  {l.status === 'Pending Review' && (
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}>⚠</button>
                                  )}
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}>✗</button>
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
            )}
          </div>
        )}

        {groupByClass && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Lesson Plans (Class-wise)</h2>
            {groupsLoading ? (
              <p className="text-gray-700">Loading class groups…</p>
            ) : classGroups.length === 0 ? (
              <p className="text-gray-700">No lesson plans match the current filters.</p>
            ) : (
              <div className="space-y-4">
                {classGroups.map(clsGroup => {
                  const totalPending = clsGroup.counts?.pending || 0;
                  const totalApproved = clsGroup.counts?.ready || 0;
                  return (
                    <div key={clsGroup.class} className="border rounded-lg">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div>
                          <div className="text-base font-semibold text-gray-900">{clsGroup.class}</div>
                          <div className="text-sm text-gray-600">Subject • Chapter groups</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">Pending: {totalPending}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Approved: {totalApproved}</span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {(clsGroup.subgroups || []).map(sub => {
                          const pending = sub.counts?.pending || 0;
                          const approved = sub.counts?.ready || 0;
                          return (
                            <div key={sub.key} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="text-sm text-gray-600">{sub.subject}</div>
                                  <div className="text-base font-semibold text-gray-900">{sub.chapter}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">Pending: {pending}</span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Approved: {approved}</span>
                                  <button
                                    onClick={() => {
                                      const lessons = (sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                                      setSelectedChapter({ schemeId: lessons[0]?.schemeId || '', chapter: sub.chapter, class: clsGroup.class, subject: sub.subject, teacherName: sub.teacherName, lessons });
                                      setShowChapterModal(true);
                                    }}
                                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                  >Open Chapter</button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {(sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                                  <div key={l.lpId} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="text-xs text-gray-600">Session {l.session}</div>
                                      <div className="text-xs text-gray-600">{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                                      <div className="text-xs text-gray-500">P{l.selectedPeriod || '-'}</div>
                                      <div className="text-xs text-gray-700 truncate max-w-[28rem]">{l.learningObjectives || '-'}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                                      {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                        <>
                                          <button 
                                            onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                            disabled={!!rowSubmitting[l.lpId]}
                                            className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}>✓</button>
                                          {l.status === 'Pending Review' && (
                                            <button 
                                              onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                              disabled={!!rowSubmitting[l.lpId]}
                                              className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}>⚠</button>
                                          )}
                                          <button 
                                            onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                            disabled={!!rowSubmitting[l.lpId]}
                                            className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}>✗</button>
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
          {pendingLessons.length === 0 ? (
            <p className="text-gray-700">No pending lesson plans.</p>
          ) : (
            <p className="text-gray-700">Click the eye icon to view individual lesson, or book icon to view all chapter sessions together.</p>
          )}
        </div>

          {/* Chapter Sessions Modal (view-only) */}
          {showChapterModal && selectedChapter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeChapterModal}>
              <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedChapter.chapter}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedChapter.class} • {selectedChapter.subject} • {selectedChapter.teacherName}
                    </p>
                  </div>
                  <button onClick={closeChapterModal} className="text-gray-500 hover:text-gray-700">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
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
                    <div className="flex items-center gap-2">
                      {(() => { const pc = selectedChapter.lessons.filter(l => l.status === 'Pending Review').length; return (
                        <span className="text-xs text-gray-600 mr-2">Pending: {pc}</span>
                      ); })()}
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Ready')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50`}
                        title="Approve all pending in this chapter"
                      >{bulkSubmitting ? 'Working…' : 'Approve All Pending'}</button>
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Needs Rework')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50`}
                        title="Send all pending for rework"
                      >Rework All Pending</button>
                      <button
                        disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                        onClick={() => bulkUpdateChapter('Rejected')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`}
                        title="Reject all pending in this chapter"
                      >Reject All Pending</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedChapter.lessons.map((l) => (
                    <div key={l.lpId} className={`border rounded-lg p-4 ${
                      l.status === 'Ready' ? 'border-green-300 bg-green-50' :
                      l.status === 'Pending Review' ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-300 bg-gray-50'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Session {l.session}</h3>
                          <p className="text-sm text-gray-600">
                            {l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled'} 
                            {l.selectedPeriod && ` • Period ${l.selectedPeriod}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            l.status === 'Ready' ? 'bg-green-100 text-green-800' :
                            l.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' :
                            l.status === 'Needs Rework' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {l.status}
                          </span>
                          {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                            <div className="flex items-center gap-1">
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
                  const teachesClass = new Set((user?.classes||[]).map(c => appNormalize(c))).has(appNormalize(exam.class));
                  const teachesSubject = new Set((user?.subjects||[]).map(s => appNormalize(s))).has(appNormalize(exam.subject));
                  let canEnter = false;
                  if (!user) canEnter = false;
                  else if (isHm) canEnter = true;
                  else if (isClassTeacher) canEnter = teachesClass;
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

  // Class Data View (Class Teacher only)
  const ClassDataView = () => {
    // Display a simple placeholder until class data endpoints are available.
    const className = user?.classTeacherFor || '';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Class Data{className ? ` – ${className}` : ''}</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">
            Detailed class data, performance summaries, lesson plan progress and daily report summaries
            will appear here once the relevant data is available.
          </p>
        </div>
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
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      subject: '',
      date: '',
      fromDate: '',
      toDate: '',
      status: ''
    });

    useEffect(() => {
      if (!user) return;
      loadReports();
    }, [user]);

    const loadReports = async () => {
      try {
        setLoadingReports(true);
        const data = await api.getDailyReports({
          teacher: filters.teacher,
          cls: filters.class,
          subject: filters.subject,
          date: filters.date,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          status: filters.status
        });
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoadingReports(false);
      }
    };

    const handleReportFilterChange = (field, value) => {
      setFilters(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">All Daily Reports</h1>
          <div className="flex space-x-3">
            <button
              onClick={loadReports}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
            >
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Filter fields */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleReportFilterChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleReportFilterChange('fromDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleReportFilterChange('toDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <option value="Fully Completed">Fully Completed</option>
                <option value="Partially Completed">Partially Completed</option>
                <option value="Not Started">Not Started</option>
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Daily Report Records</h2>
          </div>
          <div className="overflow-x-auto">
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
                {reports.map((r, idx) => {
                  const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                  const onDelete = async () => {
                    if (!id) return alert('Missing report id');
                    if (!confirm('Delete this report? This cannot be undone.')) return;
                    try {
                      setDeletingId(id);
                      const res = await api.deleteDailyReport(id, user.email);
                      if (res && res.success) {
                        setReports(prev => prev.filter(x => (x.id || x.reportId || `${(x.date||'').toString()}|${x.class||''}|${x.subject||''}|${x.period||''}|${String(x.teacherEmail||'').toLowerCase()}`) !== id));
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
                {reports.length === 0 && !loadingReports && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No reports found.
                    </td>
                  </tr>
                )}
                {loadingReports && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
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
          </div>
          <div className="text-xs text-gray-600">Showing reports for <strong>{email}</strong> {(() => { const {from,to}=computeDates(); return `(${from} → ${to})`; })()} • {total} total{total === maxDisplay ? ' (truncated)' : ''}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Completed</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">Loading...</td></tr>
                )}
                {!loading && reports.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No reports in this range.</td></tr>
                )}
                {!loading && paginated.map(r => {
                  const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                  const displayDate = (() => {
                    const d = r.date;
                    if (!d) return '-';
                    const s = String(d);
                    // If backend already normalized yyyy-MM-dd, show as-is
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                    // If ISO datetime, compute IST date string
                    try {
                      const dt = new Date(s);
                      if (!isNaN(dt.getTime())) {
                        // en-CA with timeZone gives YYYY-MM-DD
                        return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      }
                    } catch {}
                    // Fallback: strip time part
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
                    <td className="px-2 py-2 text-xs">{completedVal}</td>
                    <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                    <td className="px-2 py-2 text-xs">
                      {r.verified === 'TRUE' ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Verified
                          </span>
                          {r.verifiedBy && (
                            <span className="text-[10px] text-gray-500">
                              by {r.verifiedBy.split('@')[0]}
                            </span>
                          )}
                        </div>
                      ) : r.reopenReason ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠ Reopened
                          </span>
                          <span 
                            className="text-[10px] text-gray-600 cursor-help max-w-[120px] truncate" 
                            title={r.reopenReason}
                          >
                            {r.reopenReason}
                          </span>
                          {r.reopenedBy && (
                            <span className="text-[10px] text-gray-500">
                              by {r.reopenedBy.split('@')[0]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-right">
                      {(() => {
                        // Show delete for own reports; backend enforces time window
                        const isOwner = String(r.teacherEmail || '').toLowerCase() === String(email || '').toLowerCase();
                        if (!isOwner) return null;
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
                          <button onClick={onDelete} disabled={!id || deletingId === id} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 disabled:opacity-40 inline-flex items-center">
                            {deletingId === id && (
                              <span className="inline-block h-3 w-3 mr-1 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>
                            )}
                            {deletingId === id ? 'Deleting…' : 'Delete'}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Main render wrapped in try/catch so render-time exceptions surface visibly
  try {
    if (loading) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
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
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
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
            <main className={`flex-1 overflow-auto p-6 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
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


