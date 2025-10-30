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
const SubstitutionModule = lazy(() => import('./components/SubstitutionModule'));
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
      // Additional management views for the headmaster
      items.push(
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
    const [allSchemes, setAllSchemes] = useState([]); // Store all schemes for filter options
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      subject: '',
      status: 'Pending' // Default to pending for approvals
    });

    // Get unique values for dropdowns
    const uniqueTeachers = [...new Set(allSchemes.map(s => s.teacherName).filter(Boolean))].sort();
    const uniqueClasses = [...new Set(allSchemes.map(s => s.class).filter(Boolean))].sort();
    const uniqueSubjects = [...new Set(allSchemes.map(s => s.subject).filter(Boolean))].sort();

    // Load all schemes once for filter options
    useEffect(() => {
      async function fetchAllSchemes() {
        try {
          const data = await api.getPendingPlans(1, 1000, '', '', '', ''); // Get all for reference
          setAllSchemes(Array.isArray(data?.plans) ? data.plans : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchAllSchemes();
    }, []);

    // Load filtered schemes
    useEffect(() => {
      async function fetchPendingSchemes() {
        try {
          let data;
          if (filters.status === 'Approved') {
            // For now, we'll get all schemes and filter client-side for approved ones
            // TODO: Implement getApprovedPlans API if needed
            const allData = await api.getPendingPlans(1, 200, filters.teacher, filters.class, filters.subject, '');
            const allPlans = Array.isArray(allData?.plans) ? allData.plans : [];
            const approvedPlans = allPlans.filter(plan => plan.status === 'Approved');
            data = { plans: approvedPlans };
          } else {
            // Default to pending schemes
            data = await api.getPendingPlans(1, 50, filters.teacher, filters.class, filters.subject, '');
          }
          setPendingSchemes(Array.isArray(data?.plans) ? data.plans : []);
        } catch (err) {
          console.error(err);
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
      <div className="space-y-6">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
                <select
                  value={filters.teacher}
                  onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Teachers</option>
                  {uniqueTeachers.map(teacher => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                  value={filters.class}
                  onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Classes</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="">All</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Pending' })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {filters.status === 'Approved' ? 'Approved Schemes' : 
               filters.status === 'Pending' ? 'Pending Schemes' : 'All Schemes'} 
              ({pendingSchemes.length})
            </h2>
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
                      {filters.status !== 'Approved' && (
                        <>
                          <button 
                            onClick={() => handleApproveScheme(scheme.schemeId)}
                            className="text-green-600 hover:text-green-900 mr-3 px-3 py-1 bg-green-100 rounded"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectScheme(scheme.schemeId)}
                            className="text-red-600 hover:text-red-900 mr-3 px-3 py-1 bg-red-100 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button type="button"
                        onClick={() => openLessonView(scheme)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View scheme details"
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
    const [allLessons, setAllLessons] = useState([]); // Store all lessons for filter options
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
      teacher: '',
      class: '',
      subject: '',
      status: 'Pending Review' // Default to pending for approvals
    });

    // Get unique values for dropdowns
    const uniqueTeachers = [...new Set(allLessons.map(l => l.teacherName).filter(Boolean))].sort();
    const uniqueClasses = [...new Set(allLessons.map(l => l.class).filter(Boolean))].sort();
    const uniqueSubjects = [...new Set(allLessons.map(l => l.subject).filter(Boolean))].sort();

    // Load all lessons once for reference
    useEffect(() => {
      async function fetchAllLessons() {
        try {
          const data = await api.getPendingLessonReviews('', '', '', ''); // Get all for reference
          setAllLessons(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchAllLessons();
    }, []);

    // Load filtered lessons
    useEffect(() => {
      async function fetchPendingLessons() {
        try {
          const data = await api.getPendingLessonReviews(filters.teacher, filters.class, filters.subject, filters.status);
          setPendingLessons(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error(err);
        }
      }
      fetchPendingLessons();
    }, [filters]);

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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Lesson Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
                <select
                  value={filters.teacher}
                  onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Teachers</option>
                  {uniqueTeachers.map(teacher => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                  value={filters.class}
                  onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Classes</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
