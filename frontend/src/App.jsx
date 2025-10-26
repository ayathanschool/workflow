import * as api from './api'
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
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
const AdvancedAnalytics = lazy(() => import('./components/AdvancedAnalytics'));
const SmartReminders = lazy(() => import('./components/SmartReminders'));
const EnhancedSubstitutionView = lazy(() => import('./components/EnhancedSubstitutionView'));
const DailyReportTimetable = lazy(() => import('./DailyReportTimetable'));
const ClassPeriodSubstitutionView = lazy(() => import('./components/ClassPeriodSubstitutionView'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ExamManagement = lazy(() => import('./components/ExamManagement'));
const ReportCard = lazy(() => import('./components/ReportCard'));
const LessonProgressTracker = lazy(() => import('./components/LessonProgressTracker'));

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
  School,
  UserCircle,
  CalendarDays,
  UserPlus,
  BookCheck,
  FileCheck,
  FileClock,
  RefreshCw,
  LayoutGrid
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
        const settings = await api.getAppSettings();
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

  // ----- GLOBAL submit overlay + toast -----
  const [submitting, setSubmitting] = useState({ active:false, message:'' });
  const [toast, setToast] = useState(null);
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
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-gray-900">{value ?? '-'}</div>
    </div>
  );

  const withSubmit = async (message, fn) => {
    setSubmitting({ active:true, message });
    try {
      await fn();
      // Use notification system for success
      notificationSystem.success('Success!', message || 'Operation completed successfully');
      setToast({ type: 'success', text: message || 'Success' });
      setTimeout(() => setToast(null), 1800);
    } catch (err) {
      console.error('submit error', err);
      // Use notification system for errors
      notificationSystem.error('Error!', err?.message || 'An error occurred');
      // surface as global api-error event so other parts of app can react
      window.dispatchEvent(new CustomEvent('api-error', { detail: { message: err?.message || String(err) } }));
      setToast({ type: 'error', text: err?.message || 'Error occurred' });
      setTimeout(() => setToast(null), 3000);
      throw err;
    } finally {
      setSubmitting({ active:false, message: '' });
    }

  };

  const Toast = () => (
    toast ? (
      <div className="fixed top-4 right-4 z-[1100]">
        <div className={`px-4 py-2 rounded shadow text-sm ${toast.type==='success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.text}
        </div>
      </div>
    ) : null
  );

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
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 mx-4">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-gray-900">{viewLesson.title || viewLesson.chapter || viewLesson.lpId || viewLesson.schemeId || viewLesson.class || 'Details'}</h3>
            <button onClick={closeLessonView} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Detail label="Class" value={viewLesson.class} />
            <Detail label="Subject" value={viewLesson.subject} />
            <Detail label="Chapter/Session" value={viewLesson.chapter || viewLesson.session || ''} />
            <Detail label="Teacher" value={viewLesson.teacherName || viewLesson.teacher || ''} />
            <div className="md:col-span-2">
              <h4 className="text-sm font-medium text-gray-700">Objectives</h4>
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{viewLesson.objectives || '-'}</div>
              <h4 className="text-sm font-medium text-gray-700 mt-3">Activities</h4>
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{viewLesson.activities || '-'}</div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
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

  // Real-time updates - temporarily disabled to prevent infinite loops
  // const { isPolling, updateCount, lastUpdate } = useRealTimeUpdates(user);
  const isPolling = false;
  const updateCount = 0;
  const lastUpdate = null;

  // Role helpers — use normalized comparisons to handle different spellings/casing
  const _normRole = (r) => (r || '').toString().toLowerCase().trim();
  const hasRole = (token) => {
    if (!user || !Array.isArray(user.roles)) return false;
    const t = (token || '').toString().toLowerCase();
    return user.roles.some(r => {
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
      // Prefetch common data in parallel to warm up cache
      Promise.all([
        api.getAllClasses().catch(() => []),
        api.getSubjects().catch(() => []),
        api.getGradeTypes().catch(() => [])
      ]).catch(() => {});
    }
  }, [user?.email]);

  // Navigation items based on user role
  const getNavigationItems = () => {
    if (!user) return [];
    
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: Home }
    ];

  if (hasAnyRole(['teacher','class teacher'])) {
      items.push(
        { id: 'schemes', label: 'Schemes of Work', icon: Book },
        { id: 'lesson-plans', label: 'Lesson Plans', icon: BookOpen },
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'reports', label: 'Daily Reports', icon: FileText },
        { id: 'lesson-progress', label: 'Lesson Progress', icon: TrendingUp },
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
        { id: 'reports', label: 'Daily Reports', icon: FileText }
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
        { id: 'substitutions', label: 'Substitutions', icon: UserPlus },
        { id: 'class-period-timetable', label: 'Class-Period View', icon: LayoutGrid },
        { id: 'full-timetable', label: 'Full Timetable', icon: CalendarDays },
        { id: 'calendar', label: 'School Calendar', icon: Calendar },
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        { id: 'smart-reminders', label: 'Smart Reminders', icon: Bell },
        { id: 'exam-marks', label: 'Exam Marks', icon: Award },
        { id: 'report-card', label: 'Report Card', icon: FileText }
      );
      // Additional management views for the headmaster: view all plans and daily reports.
      items.push(
        { id: 'all-plans', label: 'All Plans', icon: Clipboard },
        { id: 'daily-reports-management', label: 'All Reports', icon: FileText },
        { id: 'lesson-progress', label: 'Lesson Progress', icon: TrendingUp }
      );
    }

    // Students can view their report cards
    if (hasAnyRole(['student'])) {
      items.push({ id: 'report-card', label: 'My Report Card', icon: FileText });
    }

    return items;
  };

  // Dashboard component
  const Dashboard = () => {
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
      pendingReports: 0
    });

    useEffect(() => {
      async function fetchDashboardData() {
        try {
          if (!user?.email) return; // More specific check
          
          // Headmaster view: use HM insights and classes count
          if (hasRole('h m')) {
            const hmData = await api.getHmInsights();
            const classes = await api.getAllClasses();
            setInsights({
              planCount: hmData?.planCount || 0,
              lessonCount: hmData?.lessonCount || 0,
              teacherCount: hmData?.teacherCount || 0,
              classCount: Array.isArray(classes) ? classes.length : 0,
              subjectCount: 0,
              pendingReports: 0
            });
          } else if (hasAnyRole(['teacher','class teacher','daily reporting teachers'])) {
            // Teacher view: compute classes and subjects from user object
            const classCount = Array.isArray(user.classes) ? user.classes.length : 0;
            const subjectCount = Array.isArray(user.subjects) ? user.subjects.length : 0;
            
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
              pendingReports
            });
          }
        } catch (err) {
          console.error('Error loading dashboard data:', err);
        }
      }
      
      // Only run once when user changes, not on every render
      if (user?.email) {
        fetchDashboardData();
      }
    }, [user?.email]); // More specific dependency

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <NotificationCenter />
          </div>
        </div>

  {user && hasRole('h m') ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {/* Pending Schemes */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 mobile-p-2">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Book className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Schemes</p>
                  <p className="text-2xl font-bold text-gray-900">{insights.planCount}</p>
                </div>
              </div>
            </div>
            {/* Pending Lessons */}
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
            {/* Teachers */}
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
            {/* Classes */}
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
  ) : user && hasAnyRole(['teacher','class teacher','daily reporting teachers']) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Classes Teaching */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <School className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Classes Teaching</p>
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
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome, {user?.name}</h2>
            <p className="text-gray-600">Use the navigation menu to access your school workflow tools.</p>
          </div>
        )}

        {/* Analytics Section for HM */}
  {user && hasRole('h m') && (
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
          </div>
        )}
      </div>
    );
  };

  // Google Auth integration
  const googleAuth = useGoogleAuth();
  // Local user (manual login) fallback
  const [localUser, setLocalUser] = useState(null);
  const effectiveUser = googleAuth?.user || localUser || user;

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
    }
  }, [googleAuth?.user?.email]);

  // Sidebar component
  const Sidebar = () => {
    const navigationItems = getNavigationItems();
    const { theme } = useTheme();

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
            <span className={`ml-2 text-sm font-medium hidden md:block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              {user?.name}
            </span>
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
          return <Dashboard />;
        case 'schemes':
          return <SchemesView />;
        case 'lesson-plans':
          return <LessonPlansView />;
        case 'timetable':
          return <TimetableView />;
      case 'calendar':
        return <CalendarPage user={user} />;
      case 'reports':
        return <ReportsView />;
      case 'lesson-progress':
        return <LessonProgressTracker user={user} />;
      case 'hm-dashboard':
        // hm-dashboard should reuse the main Dashboard to avoid duplicate UIs
        return <Dashboard />;
      case 'day-timetable':
        return <DayTimetableView periodTimes={memoizedSettings.periodTimes} />;
      case 'scheme-approvals':
        return <SchemeApprovalsView />;
      case 'lesson-approvals':
        return <LessonApprovalsView />;
      case 'substitutions':
        return <EnhancedSubstitutionView user={user} periodTimes={memoizedSettings.periodTimes} />;
      case 'full-timetable':
        return <FullTimetableView />;
      case 'analytics':
        return <AdvancedAnalytics user={user} />;
      case 'smart-reminders':
        return <SmartReminders user={user} />;
      case 'exam-marks':
        return <ExamManagement user={user} withSubmit={withSubmit} setToast={setToast} />;
      case 'report-card':
        return <ReportCard user={user} />;
      case 'class-data':
        return <ClassDataView />;
      case 'class-students':
        return <ClassStudentsView />;
      case 'all-plans':
        return <AllPlansView />;
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

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!user) return;
      try {
        // Submit the scheme of work to the backend using the global
        // withSubmit helper so the user sees a submitting overlay and
        // a toast on success/failure.
        await withSubmit('Submitting scheme...', () => api.submitPlan(user.email, {
          teacherName: user.name || '',
          class: formData.class,
          subject: formData.subject,
          term: formData.term,
          unit: formData.unit,
          chapter: formData.chapter,
          month: formData.month,
          noOfSessions: formData.noOfSessions
        }));
        // Refresh schemes list to include the newly submitted scheme and
        // reflect its status.  getTeacherSchemes() returns all schemes
        // submitted by this teacher.
        const list = await api.getTeacherSchemes(user.email);
        setSchemes(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to submit scheme:', err);
      } finally {
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
            // We'll fetch ALL approved schemes that match teacher's classes/subjects, not just ones they submitted
            const allSchemes = await api.getAllApprovedSchemes();
            let approved = [];
            
            if (Array.isArray(allSchemes)) {
              // Filter based on teacher's classes/subjects
              if (Array.isArray(user.classes) && Array.isArray(user.subjects)) {
                approved = allSchemes.filter(scheme => {
                  const matchesClass = user.classes.some(cls => normKeyLocal(cls) === normKeyLocal(scheme.class));
                  const matchesSubject = user.subjects.some(subj => normKeyLocal(subj) === normKeyLocal(scheme.subject));
                  return matchesClass && matchesSubject && String(scheme.status || '').toLowerCase() === 'approved';
                });
              } else {
                // Fallback to just filtering by status
                approved = allSchemes.filter(s => String(s.status || '').toLowerCase() === 'approved');
              }
            }
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
        setToast({ 
          type: 'error', 
          text: `Lesson planning is only allowed on ${displayDay}.` 
        });
        setTimeout(() => setToast(null), 3000);
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
          setToast({ 
            type: 'error', 
            text: 'A lesson plan already exists for this class/subject/session/date/chapter combination. Duplicate not allowed.' 
          });
          setTimeout(() => setToast(null), 3000);
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
          // If server responded with an error payload, throw to trigger error handling
          if (res && res.error) throw new Error(res.error);
          return res;
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
                setToast({ type: 'error', text: 'Duplicate detected: opened existing lesson plan for editing.' });
                setTimeout(() => setToast(null), 3000);
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

              {/* Session dropdown based on selected scheme's number of sessions */}
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
                    const max = scheme ? Number(scheme.noOfSessions || 1) : 1;
                    const options = [];
                    for (let i = 1; i <= max; i++) {
                      options.push(
                        <option key={i} value={String(i)}>
                          Session {i} - {scheme ? scheme.chapter : ''}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
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

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Timetable Slots</h2>
            <p className="text-sm text-gray-500 mt-1">Prepare lesson plans for your scheduled classes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timetableSlots.flatMap(day => 
                  day.periods.map((period, index) => {
                    const lessonPlan = lessonPlans.find(
                      plan => normKeyLocal(plan.class) === normKeyLocal(period.class) && 
                              normKeyLocal(plan.subject) === normKeyLocal(period.subject) && 
                              Number(plan.session) === Number(period.period) &&
                              String(plan.date || '') === String(day.date || '')
                    );
                    
                    // Process timetable slot
                    
                    return (
                      <tr key={`${day.date}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.day}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.period}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.class}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lessonPlan ? (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              lessonPlan.status === 'Pending Preparation' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : lessonPlan.status === 'Pending Review' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {lessonPlan.status}
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Not Prepared
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handlePrepareLesson({
                              ...period,
                              date: day.date,
                              day: day.day,
                              lpId: lessonPlan?.lpId || `lp-${Date.now()}`
                            })}
                            className={`${
                              lessonPlan && lessonPlan.status !== 'Pending Preparation' && lessonPlan.status !== 'Needs Rework'
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            } text-white px-3 py-1 rounded text-sm`}
                            disabled={lessonPlan && lessonPlan.status !== 'Pending Preparation' && lessonPlan.status !== 'Needs Rework'}
                          >
                            {lessonPlan ? 'Edit' : 'Prepare'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
        
        {/* Enhanced daily reporting with timetable integration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <DailyReportTimetable user={user} />
        </div>
      </div>
    );
  };

  const HMDashboardView = () => {
    const [insights, setInsights] = useState({ planCount: 0, lessonCount: 0, teacherCount: 0, classCount: 0 });

  useEffect(() => {
    async function fetchInsights() {
      try {
        const hmData = await api.getHmInsights().catch(() => ({}));
        const classes = await api.getAllClasses().catch(() => []);
        setInsights({
          planCount: hmData?.planCount || 0,
          lessonCount: hmData?.lessonCount || 0,
          teacherCount: hmData?.teacherCount || 0,
          classCount: Array.isArray(classes) ? classes.length : 0
        });
      } catch (err) {
        console.warn('Failed to load HM insights', err);
      }
    }
    fetchInsights();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Headmaster Dashboard</h1>
        <div className="flex space-x-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

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
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activities</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500">
            Recent activity data will be displayed here when available.
          </p>
        </div>
      </div>
    </div>
  );
  };
  // Scheme Approvals View
  const SchemeApprovalsView = () => {
    const [pendingSchemes, setPendingSchemes] = useState([]);

    // Load pending schemes for HM on mount
    useEffect(() => {
      async function fetchPendingSchemes() {
        try {
          const data = await api.getPendingPlans(1, 50, '', '', '', '');
          // The API returns an object with a `plans` array
          setPendingSchemes(Array.isArray(data?.plans) ? data.plans : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchPendingSchemes();
    }, []);

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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Scheme Approvals</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Pending Schemes of Work</h2>
          </div>
          <div className="overflow-x-auto responsive-table">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingSchemes.map((scheme) => (
                  <tr key={scheme.schemeId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.teacherName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{scheme.noOfSessions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button 
                        onClick={() => handleApproveScheme(scheme.schemeId)}
                        className="text-green-600 hover:text-green-900 mr-3 px-3 py-1 bg-green-100 rounded"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleRejectScheme(scheme.schemeId)}
                        className="text-red-600 hover:text-red-900 px-3 py-1 bg-red-100 rounded"
                      >
                        Reject
                      </button>
                      <button type="button"
                        onClick={() => openLessonView(scheme)}
                        className="text-blue-600 hover:text-blue-900 ml-3"
                        title="View lesson"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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

    // Load pending lesson reviews on mount (HM only)
    useEffect(() => {
      async function fetchPendingLessons() {
        try {
          const data = await api.getPendingLessonReviews('', '', '', 'Pending Review');
          setPendingLessons(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchPendingLessons();
    }, []);

    const handleApproveLesson = async (lpId, status) => {
      try {
        await withSubmit('Updating lesson status...', () => api.updateLessonPlanDetailsStatus(lpId, status));
        setPendingLessons(pendingLessons.filter(lesson => lesson.lpId !== lpId));
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Lesson Plan Approvals</h1>
          <div className="flex space-x-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Pending Lesson Plans</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingLessons.map((lesson) => (
                  <tr key={lesson.lpId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.teacherName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.session}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                        className="text-green-600 hover:text-green-900 mr-3 px-3 py-1 bg-green-100 rounded"
                      >
                        Ready
                      </button>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Needs Rework')}
                        className="text-yellow-600 hover:text-yellow-900 mr-3 px-3 py-1 bg-yellow-100 rounded"
                      >
                        Rework
                      </button>
                      <button 
                        onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                        className="text-red-600 hover:text-red-900 mr-3 px-3 py-1 bg-red-100 rounded"
                      >
                        Reject
                      </button>
                      <button type="button" className="text-blue-600 hover:text-blue-900" onClick={() => openLessonView(lesson)} title="View lesson">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Lesson Plan Details</h2>
          {pendingLessons.length === 0 ? (
            <p className="text-gray-700">No pending lesson plans.</p>
          ) : (
            <p className="text-gray-700">Click the eye icon in the table to open the lesson plan details for any row.</p>
          )}
        </div>
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
              onClick={() => {
                console.log('=== DEBUG INFO ===');
                console.log('Current substitutions:', substitutions);
                console.log('Current date filter:', formData.date);
                console.log('Daily timetable:', dailyTimetable);
                console.log('=================');
                
                // Debug the raw API response
                Promise.all([
                  api.getAssignedSubstitutions(formData.date, { noCache: true }),
                  api.debugSubstitutions(formData.date, { noCache: true })
                ]).then(([response, debugResponse]) => {
                  console.log('🔍 NORMAL API RESPONSE:', response);
                  console.log('🔧 DEBUG API RESPONSE:', debugResponse);
                  
                  if (debugResponse) {
                    console.log('📊 Headers in sheet:', debugResponse.headers);
                    console.log('📊 Total substitutions in sheet:', debugResponse.totalCount);
                    console.log('📊 All substitutions:', debugResponse.allSubstitutions);
                    console.log('📊 Target date:', debugResponse.targetDate);
                    console.log('📊 Target date ISO:', debugResponse.targetDateISO);
                    console.log('📊 Date conversion debug:', debugResponse.dateDebug);
                    console.log('📊 Filtered for date:', debugResponse.filteredForDate);
                  }
                }).catch(err => console.error('❌ API Error:', err));
                
                alert(`Debug info logged to console. Found ${substitutions.length} substitutions. Check console for detailed API response.`);
              }}
              className="bg-yellow-100 text-yellow-800 rounded-lg px-3 py-2 flex items-center hover:bg-yellow-200 transition-colors duration-300"
            >
              🐛 Debug
            </button>
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
        setToast({ type:'success', text:'No changes to save.' });
        setTimeout(() => setToast(null), 2000);
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((r, idx) => (
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
                  </tr>
                ))}
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
        {/* Global submit overlay and toast rendered at app root */}
        <SubmitOverlay />
        <LessonModal />
        <Toast />
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


