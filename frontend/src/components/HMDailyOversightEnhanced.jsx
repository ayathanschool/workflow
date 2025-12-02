// HMDailyOversightEnhanced.jsx - Enhanced HM Dashboard with Session Progress Analytics
import React, { useState, useEffect } from 'react';
import { getDailyReportsForDate, getLessonPlansForDate, getClassSubjectPerformance, getSyllabusPaceTracking, getMissingSubmissions, verifyDailyReport, reopenDailyReport, notifyMissingSubmissions, getDailyReadinessStatus, getHMDailyOversightData } from '../api';
import { todayIST, formatLocalDate, nowIST } from '../utils/dateUtils';
import { Clock, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, CheckCircle, Undo2, FileText, ClipboardCheck, ChevronUp } from 'lucide-react';

const HMDailyOversightEnhanced = ({ user }) => {
  const [date, setDate] = useState(todayIST());
  const [reports, setReports] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [merged, setMerged] = useState({ periods: [], summary: { total: 0, plannedReady: 0, reported: 0, unplannedCount: 0, avgCompletion: 0 } });
  const [stats, setStats] = useState({
    totalPeriods: 0,
    submitted: 0,
    pending: 0,
    avgCompletion: 0,
    sessionsAtRisk: 0,
    excellentSessions: 0,
    concernSessions: 0,
    cascadingIssues: 0
  });
  const [filters, setFilters] = useState({
    teacher: '',
    class: '',
    subject: '',
    status: 'all',
    completionRange: 'all' // all | excellent (80-100) | good (60-79) | concern (0-59)
  });
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessionAnalytics, setSessionAnalytics] = useState([]);
  // Class/Subject Performance Analytics
  const [classSubjectPerformance, setClassSubjectPerformance] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [performanceClassFilter, setPerformanceClassFilter] = useState(''); // Class filter
  const [performanceTeacherFilter, setPerformanceTeacherFilter] = useState(''); // Teacher filter
  // Real-time features
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [paceTracking, setPaceTracking] = useState(null);
  const [loadingPaceTracking, setLoadingPaceTracking] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('Term 2');
  // Missing submissions
  const [missing, setMissing] = useState({ list: [], byTeacher: [], stats: { totalPeriods: 0, missingCount: 0, teachersImpacted: 0 } });
  const [missingLoading, setMissingLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(null);
  const [reopeningKey, setReopeningKey] = useState(null);
  // Collapsible sections
  const [subjectPerfOpen, setSubjectPerfOpen] = useState(false);
  const [classPerfOpen, setClassPerfOpen] = useState(false);
  // Readiness tracking
  const [readinessData, setReadinessData] = useState(null);
  const [readinessError, setReadinessError] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [showLessonPlanDetails, setShowLessonPlanDetails] = useState(false);
  const [showReportDetails, setShowReportDetails] = useState(false);

  useEffect(() => {
    loadDailyReports();
    loadLessonPlans();
    loadClassSubjectPerformance(); // Load analytics data on mount
    loadPaceTracking(); // Load pace tracking data
    loadMissing();
    loadReadinessStatus(); // Load readiness status
    loadMerged(); // Load plan vs actual merged
  }, [date]);

  // Load class/subject performance analytics
  async function loadClassSubjectPerformance() {
    setAnalyticsLoading(true);
    try {
      const response = await getClassSubjectPerformance();
      console.log('Class/Subject performance response:', response);
      
      const result = response.data || response;
      if (result.success && result.classMetrics && Array.isArray(result.classMetrics)) {
        console.log('Setting classSubjectPerformance with', result.classMetrics.length, 'items');
        setClassSubjectPerformance(result.classMetrics);
      } else {
        console.warn('Invalid class/subject performance response:', result);
        setClassSubjectPerformance([]);
      }
    } catch (err) {
      console.error('Failed to load class/subject performance:', err);
      setClassSubjectPerformance([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  // Load pace tracking data
  async function loadPaceTracking() {
    setLoadingPaceTracking(true);
    try {
      const response = await getSyllabusPaceTracking(selectedTerm);
      console.log('Pace tracking response:', response);
      
      const result = response.data || response;
      if (result.success) {
        setPaceTracking(result);
      } else {
        console.warn('Failed to load pace tracking:', result.error);
        setPaceTracking(null);
      }
    } catch (err) {
      console.error('Error loading pace tracking:', err);
      setPaceTracking(null);
    } finally {
      setLoadingPaceTracking(false);
    }
  }

  // Load readiness status
  async function loadReadinessStatus() {
    setLoadingReadiness(true);
    try {
      console.log('Fetching readiness status for date:', date);
      const response = await getDailyReadinessStatus(date);
      console.log('Readiness status response:', response);
      console.log('Readiness data keys:', Object.keys(response));
      console.log('Readiness data.data:', response.data);
      
      // Extract the actual data - API returns {status: 200, data: {...}, timestamp: ...}
      const result = response.data || response;
      if (result && result.success) {
        console.log('Setting readiness data to:', result);
        setReadinessData(result);
        setReadinessError(null);
      } else {
        const msg = (result && result.error) || 'Readiness endpoint unavailable';
        console.warn('Readiness not available:', msg);
        setReadinessData(null);
        setReadinessError(msg);
      }
    } catch (err) {
      console.error('Failed to load readiness status:', err);
      setReadinessData(null);
      setReadinessError(err?.message || String(err));
    } finally {
      setLoadingReadiness(false);
    }
  }

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      handleAutoRefresh();
    }, refreshInterval * 60 * 1000); // refreshInterval is in minutes

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, date]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadDailyReports(true), loadLessonPlans(true), loadReadinessStatus()]);
    setIsRefreshing(false);
  };

  async function loadDailyReports(isAutoRefresh = false) {
    if (!isAutoRefresh) setLoading(true);
    try {
      const response = await getDailyReportsForDate(date);
      console.log('Daily reports response:', response);
      
      const result = response.data || response;
      const reportsData = result.reports || [];

      setReports(reportsData);
      setLastUpdated(new Date());
      calculateEnhancedStats(reportsData);
      extractFilterOptions(reportsData);
      analyzeSessionProgress(reportsData);
      detectUrgentAlerts(reportsData);
    } catch (err) {
      console.error('Failed to load daily reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLessonPlans() {
    try {
      const response = await getLessonPlansForDate(date);
      console.log('Lesson plans response:', response);
      
      const result = response.data || response;
      const plansData = result.lessonPlans || [];
      setLessonPlans(plansData);
    } catch (err) {
      console.error('Failed to load lesson plans:', err);
      setLessonPlans([]);
    }
  }

  // Load merged Plan vs Actual per period for the date
  async function loadMerged() {
    try {
      const response = await getHMDailyOversightData(date);
      const result = response.data || response;
      if (result && result.success) {
        setMerged({ periods: result.periods || [], summary: result.summary || { total: 0, plannedReady: 0, reported: 0, unplannedCount: 0, avgCompletion: 0 } });
      } else {
        setMerged({ periods: [], summary: { total: 0, plannedReady: 0, reported: 0, unplannedCount: 0, avgCompletion: 0 } });
      }
    } catch (e) {
      setMerged({ periods: [], summary: { total: 0, plannedReady: 0, reported: 0, unplannedCount: 0, avgCompletion: 0 } });
    }
  }

  async function loadMissing() {
    setMissingLoading(true);
    try {
      const resp = await getMissingSubmissions(date);
      const data = resp.data || resp;
      if (data && data.success) {
        setMissing({ list: data.missing || [], byTeacher: data.byTeacher || [], stats: data.stats || { totalPeriods: 0, missingCount: 0, teachersImpacted: 0 } });
      } else {
        setMissing({ list: [], byTeacher: [], stats: { totalPeriods: 0, missingCount: 0, teachersImpacted: 0 } });
      }
    } catch (e) {
      console.warn('failed to load missing submissions', e);
      setMissing({ list: [], byTeacher: [], stats: { totalPeriods: 0, missingCount: 0, teachersImpacted: 0 } });
    } finally {
      setMissingLoading(false);
    }
  }

  // Compute a unique key for a report, preferring UUID id then composite
  const computeReportKey = (report) => {
    if (report.id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(report.id)) {
      return report.id;
    }
    const normalizedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date(date).toISOString().split('T')[0];
    const periodNum = String(report.period || '').replace(/^Period\s*/i, '').trim();
    return [normalizedDate, report.class, report.subject, periodNum, String(report.teacherEmail || '').toLowerCase()].join('|');
  };

  async function handleNotifyAllMissing() {
    if (!user?.email) return alert('Missing user email for notification.');
    setActionBusy(true);
    try {
      const res = await notifyMissingSubmissions(date, user.email);
      const out = res?.data || res;
      if (out && out.success) {
        alert(`Notifications sent: ${out.notified || 0}${out.failed ? `, failed: ${out.failed}` : ''}`);
      } else {
        alert(`Failed to send notifications: ${out?.error || 'unknown error'}`);
      }
    } catch (e) {
      alert(`Failed to send notifications: ${e?.message || e}`);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleVerify(report) {
    if (!user?.email) return alert('Missing verifier email.');
    
    const key = computeReportKey(report);
    console.log('[handleVerify] Using key:', key);
    setVerifyingKey(key);
    try {
      const res = await verifyDailyReport(key, user.email);
      const out = res?.data || res;
      if (out && out.success) {
        alert('Report verified.');
        await loadDailyReports();
      } else {
        console.error('[handleVerify] Failed:', out);
        alert(`Verify failed: ${out?.error || 'unknown error'}`);
      }
    } catch (e) {
      alert(`Verify failed: ${e?.message || e}`);
    } finally {
      setVerifyingKey(null);
    }
  }

  async function handleReopen(report) {
    if (!user?.email) return alert('Missing requester email.');
    const reason = window.prompt('Enter reason to reopen this report:', 'Please add more detail');
    if (reason === null) return; // cancelled
    
    const key = computeReportKey(report);
    console.log('[handleReopen] Using key:', key);
    setReopeningKey(key);
    try {
      const res = await reopenDailyReport(key, user.email, reason);
      const out = res?.data || res;
      if (out && out.success) {
        alert('Report reopened.');
        await loadDailyReports();
      } else {
        console.error('[handleReopen] Failed:', out);
        alert(`Reopen failed: ${out?.error || 'unknown error'}`);
      }
    } catch (e) {
      alert(`Reopen failed: ${e?.message || e}`);
    } finally {
      setReopeningKey(null);
    }
  }

  function calculateEnhancedStats(data) {
    const total = data.length;
    const submitted = data.filter(r => r.submitted || r.completionPercentage !== undefined).length;
    
    // Calculate completion percentages for submitted reports
    const submittedWithCompletion = data.filter(r => 
      (r.submitted || r.completionPercentage !== undefined) && 
      r.completionPercentage !== null && 
      r.completionPercentage !== undefined
    );
    
    const avgCompletion = submittedWithCompletion.length > 0 
      ? Math.round(submittedWithCompletion.reduce((sum, r) => sum + (Number(r.completionPercentage) || 0), 0) / submittedWithCompletion.length)
      : 0;
    
    const excellentSessions = submittedWithCompletion.filter(r => (Number(r.completionPercentage) || 0) >= 80).length;
    const concernSessions = submittedWithCompletion.filter(r => (Number(r.completionPercentage) || 0) < 60).length;
    
    // Detect sessions at risk (incomplete previous sessions in same chapter)
    const sessionsAtRisk = detectCascadingRisks(data);
    
    setStats({
      totalPeriods: total,
      submitted,
      pending: total - submitted,
      avgCompletion,
      excellentSessions,
      concernSessions,
      sessionsAtRisk: sessionsAtRisk.length,
      cascadingIssues: sessionsAtRisk.filter(s => s.riskLevel === 'high').length
    });
  }

  function detectCascadingRisks(data) {
    const risks = [];
    
    // Group by teacher, class, subject, chapter
    const chapterGroups = {};
    data.forEach(report => {
      if (!report.chapter || !report.sessionNo) return;
      
      const key = `${report.teacherEmail}|${report.class}|${report.subject}|${report.chapter}`;
      if (!chapterGroups[key]) {
        chapterGroups[key] = [];
      }
      chapterGroups[key].push(report);
    });
    
    // Check each group for incomplete sessions affecting later ones
    Object.entries(chapterGroups).forEach(([key, sessions]) => {
      const sorted = sessions.sort((a, b) => (a.sessionNo || 0) - (b.sessionNo || 0));
      
      for (let i = 1; i < sorted.length; i++) {
        const currentSession = sorted[i];
        const previousSessions = sorted.slice(0, i);
        
        const incompleteCount = previousSessions.filter(s => 
          (Number(s.completionPercentage) || 0) < 75
        ).length;
        
        if (incompleteCount > 0) {
          risks.push({
            ...currentSession,
            incompletePrevious: incompleteCount,
            totalPrevious: previousSessions.length,
            riskLevel: incompleteCount > 1 ? 'high' : 'medium'
          });
        }
      }
    });
    
    return risks;
  }

  function detectUrgentAlerts(data) {
    const alerts = [];
    const now = nowIST();
    const currentHour = now.getHours();
    const day = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const isWorkingDay = day >= 1 && day <= 5;
    const after3pm = currentHour >= 15;

    // Detect pending reports for ongoing/past periods
    const pendingReports = data.filter(r => !r.submitted && !r.completionPercentage);
    
    // Only surface pending-report and low-completion alerts after 3 PM on working days
    if (isWorkingDay && after3pm) {
      if (pendingReports.length > 0) {
        alerts.push({
          type: 'pending_reports',
          category: 'pending_reports',
          message: `${pendingReports.length} reports pending submission`,
          count: pendingReports.length,
          severity: pendingReports.length > 5 ? 'high' : 'medium'
        });
      }
    }
    
    // Alert for high number of sessions at risk
    const atRisk = detectCascadingRisks(data);
    const highRisk = atRisk.filter(r => r.riskLevel === 'high');
    if (highRisk.length > 0) {
      alerts.push({
        type: 'cascading_risk',
        category: 'cascading_risk',
        message: `${highRisk.length} sessions at high risk of cascading delays`,
        count: highRisk.length,
        severity: 'high'
      });
    }
    
    // Alert for poor completion rates
    const lowCompletion = data.filter(r => 
      r.submitted && (Number(r.completionPercentage) || 0) < 50
    );
    if (isWorkingDay && after3pm && lowCompletion.length >= 3) {
      alerts.push({
        type: 'low_completion',
        category: 'low_completion',
        message: `${lowCompletion.length} sessions with completion below 50%`,
        count: lowCompletion.length,
        severity: 'medium'
      });
    }
    
    setUrgentAlerts(alerts);
  }

  function analyzeSessionProgress(data) {
    // Group sessions by chapter and analyze progression
    const chapterAnalysis = {};
    
    data.forEach(report => {
      if (!report.chapter) return;
      
      const key = `${report.class}|${report.subject}|${report.chapter}`;
      if (!chapterAnalysis[key]) {
        chapterAnalysis[key] = {
          chapter: report.chapter,
          class: report.class,
          subject: report.subject,
          teachers: new Set(),
          sessions: [],
          avgCompletion: 0,
          totalSessions: 0,
          completedSessions: 0
        };
      }
      
      chapterAnalysis[key].teachers.add(report.teacherName || report.teacherEmail);
      chapterAnalysis[key].sessions.push(report);
      
      if (report.totalSessions) {
        chapterAnalysis[key].totalSessions = Math.max(
          chapterAnalysis[key].totalSessions,
          Number(report.totalSessions)
        );
      }
    });
    
    // Calculate analytics for each chapter
    const analytics = Object.values(chapterAnalysis).map(chapter => {
      const completions = chapter.sessions
        .filter(s => s.completionPercentage !== null && s.completionPercentage !== undefined)
        .map(s => Number(s.completionPercentage) || 0);
      
      chapter.avgCompletion = completions.length > 0 
        ? Math.round(completions.reduce((sum, c) => sum + c, 0) / completions.length)
        : 0;
      
      chapter.completedSessions = chapter.sessions.filter(s => 
        (Number(s.completionPercentage) || 0) >= 80
      ).length;
      
      chapter.teachers = Array.from(chapter.teachers);
      
      return chapter;
    }).sort((a, b) => b.sessions.length - a.sessions.length);
    
    setSessionAnalytics(analytics);
  }

  function extractFilterOptions(data) {
    const uniqueTeachers = [...new Set(data.map(r => r.teacherName || r.teacherEmail).filter(Boolean))].sort();
    const uniqueClasses = [...new Set(data.map(r => r.class).filter(Boolean))].sort();
    const uniqueSubjects = [...new Set(data.map(r => r.subject).filter(Boolean))].sort();
    
    setTeachers(uniqueTeachers);
    setClasses(uniqueClasses);
    setSubjects(uniqueSubjects);
  }

  function getFilteredReports() {
    return reports.filter(report => {
      if (filters.teacher && (report.teacherName || report.teacherEmail) !== filters.teacher) return false;
      if (filters.class && report.class !== filters.class) return false;
      if (filters.subject && report.subject !== filters.subject) return false;
      if (filters.status !== 'all') {
        const isSubmitted = report.submitted || report.completionPercentage !== undefined;
        if (filters.status === 'submitted' && !isSubmitted) return false;
        if (filters.status === 'pending' && isSubmitted) return false;
      }
      if (filters.completionRange !== 'all') {
        const completion = Number(report.completionPercentage) || 0;
        if (filters.completionRange === 'excellent' && completion < 80) return false;
        if (filters.completionRange === 'good' && (completion < 60 || completion >= 80)) return false;
        if (filters.completionRange === 'concern' && completion >= 60) return false;
      }
      return true;
    });
  }

  function getFilteredAnalytics() {
    return sessionAnalytics.filter(chapter => {
      if (filters.teacher && !chapter.teachers.some(t => t === filters.teacher)) return false;
      if (filters.class && chapter.class !== filters.class) return false;
      if (filters.subject && chapter.subject !== filters.subject) return false;
      return true;
    });
  }

  function getFilteredPaceTracking() {
    if (!paceTracking || !paceTracking.subjects) return [];
    return paceTracking.subjects.filter(subject => {
      if (filters.teacher && subject.teacher !== filters.teacher) return false;
      if (filters.class && subject.className !== filters.class) return false;
      if (filters.subject && subject.subject !== filters.subject) return false;
      return true;
    });
  }

  function getCompletionColor(percentage) {
    const p = Number(percentage) || 0;
    if (p >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (p >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (p >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (p > 0) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  const filteredReports = getFilteredReports();
  const filteredAnalytics = getFilteredAnalytics();
  const filteredPaceTrackingSubjects = getFilteredPaceTracking();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enhanced Daily Oversight</h2>
        <p className="text-gray-600">Monitor daily session progress and teacher performance with detailed analytics</p>
      </div>

      {/* Urgent Alerts Banner */}
      {urgentAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold mb-2">
                Urgent Issues Detected ({urgentAlerts.length})
              </h3>
              <div className="space-y-1">
                {urgentAlerts.slice(0, 5).map((alert, idx) => (
                  <div key={idx} className="text-sm text-red-700 flex items-start">
                    <span className="mr-2">•</span>
                    <span className="flex-1">
                      <span className="font-medium">{alert.type === 'pending_reports' ? 'Pending Report' : alert.type === 'cascading_risk' ? 'Cascading Risk' : 'Low Completion'}:</span>
                      {' '}{alert.message}
                    </span>
                  </div>
                ))}
                {urgentAlerts.length > 5 && (
                  <p className="text-sm text-red-600 mt-2 italic">
                    + {urgentAlerts.length - 5} more urgent issue(s)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Controls Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not yet loaded'}
              </span>
              {isRefreshing && (
                <span className="text-xs text-blue-600 font-medium">Updating...</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Auto-refresh</span>
            </label>
            
              {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value={1}>1 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={30}>30 min</option>
              </select>
            )}
            
            <button
              onClick={handleAutoRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Date and Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="oversight-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date:
            </label>
            <input
              id="oversight-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600 pt-6">
            📅 {formatLocalDate(date)}
          </div>
        </div>
        <button
          onClick={() => {
            loadDailyReports();
            loadLessonPlans();
            loadReadinessStatus();
          }}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Readiness Status Cards */}
      {readinessData?.success && !readinessData.noClassesScheduled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Lesson Plans Readiness Card */}
          <div className={`border-2 rounded-lg p-4 ${readinessData.lessonPlans?.status === 'complete' ? 'bg-green-50 border-green-200' : readinessData.lessonPlans?.status === 'good' ? 'bg-blue-50 border-blue-200' : readinessData.lessonPlans?.status === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} ${nowIST().getHours() < 15 ? 'ring-2 ring-blue-400' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Lesson Plans</h3>
              </div>
              <button
                onClick={() => setShowLessonPlanDetails(!showLessonPlanDetails)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showLessonPlanDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold ${readinessData.lessonPlans?.status === 'complete' ? 'text-green-700' : readinessData.lessonPlans?.status === 'good' ? 'text-blue-700' : readinessData.lessonPlans?.status === 'warning' ? 'text-yellow-700' : 'text-red-700'}`}>
                {readinessData.lessonPlans?.ready}/{readinessData.lessonPlans?.total}
              </span>
              <span className="text-sm text-gray-600">Ready</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${readinessData.lessonPlans?.percentage === 100 ? 'bg-green-500' : readinessData.lessonPlans?.percentage >= 80 ? 'bg-blue-500' : readinessData.lessonPlans?.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${readinessData.lessonPlans?.percentage || 0}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700">{readinessData.lessonPlans?.percentage}%</span>
            </div>
            
            {readinessData.lessonPlans?.pending > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {readinessData.lessonPlans.pending} period{readinessData.lessonPlans.pending !== 1 ? 's' : ''} pending
              </p>
            )}
            
            {showLessonPlanDetails && readinessData.lessonPlans?.byTeacher && readinessData.lessonPlans.byTeacher.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Pending by Teacher:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {readinessData.lessonPlans.byTeacher.map((teacher, idx) => (
                    <div key={idx} className="text-xs bg-white bg-opacity-50 rounded px-2 py-1">
                      <span className="font-medium">{teacher.teacherName}</span>
                      <span className="text-gray-600"> - {teacher.count} period{teacher.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily Reports Card */}
          <div className={`border-2 rounded-lg p-4 ${readinessData.dailyReports?.status === 'complete' ? 'bg-green-50 border-green-200' : readinessData.dailyReports?.status === 'good' ? 'bg-blue-50 border-blue-200' : readinessData.dailyReports?.status === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} ${nowIST().getHours() >= 15 ? 'ring-2 ring-green-400' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Daily Reports</h3>
              </div>
              <button
                onClick={() => setShowReportDetails(!showReportDetails)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showReportDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold ${readinessData.dailyReports?.status === 'complete' ? 'text-green-700' : readinessData.dailyReports?.status === 'good' ? 'text-blue-700' : readinessData.dailyReports?.status === 'warning' ? 'text-yellow-700' : 'text-red-700'}`}>
                {readinessData.dailyReports?.submitted}/{readinessData.dailyReports?.total}
              </span>
              <span className="text-sm text-gray-600">Submitted</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${readinessData.dailyReports?.percentage === 100 ? 'bg-green-500' : readinessData.dailyReports?.percentage >= 70 ? 'bg-blue-500' : readinessData.dailyReports?.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${readinessData.dailyReports?.percentage || 0}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700">{readinessData.dailyReports?.percentage}%</span>
            </div>
            
            {readinessData.dailyReports?.pending > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {readinessData.dailyReports.pending} report{readinessData.dailyReports.pending !== 1 ? 's' : ''} pending
              </p>
            )}
            
            {showReportDetails && readinessData.dailyReports?.byTeacher && readinessData.dailyReports.byTeacher.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Pending by Teacher:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {readinessData.dailyReports.byTeacher.map((teacher, idx) => (
                    <div key={idx} className="text-xs bg-white bg-opacity-50 rounded px-2 py-1">
                      <span className="font-medium">{teacher.teacherName}</span>
                      <span className="text-gray-600"> - {teacher.count} report{teacher.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Readiness unavailable banner */}
      {!readinessData?.success && readinessError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm text-yellow-800">
          Readiness summary is temporarily unavailable: {readinessError}
        </div>
      )}

      {readinessData?.noClassesScheduled && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center mb-6">
          <p className="text-gray-600">{readinessData.message}</p>
        </div>
      )}

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Completion</p>
              <p className="text-2xl font-bold text-blue-600">{stats.avgCompletion}%</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stats.submitted} of {stats.totalPeriods} periods reported
          </p>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Excellent Sessions</p>
              <p className="text-2xl font-bold text-green-600">{stats.excellentSessions}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">80%+ completion rate</p>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sessions at Risk</p>
              <p className="text-2xl font-bold text-orange-600">{stats.sessionsAtRisk}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Incomplete previous sessions</p>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Issues</p>
              <p className="text-2xl font-bold text-red-600">{stats.cascadingIssues}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">High cascading risk</p>
        </div>
      </div>

      {/* Subject-wise Performance (Collapsible) */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg mb-6">
        <div
          className="flex justify-between items-center mb-2 cursor-pointer select-none"
          onClick={() => setSubjectPerfOpen(prev => !prev)}
        >
          <div className="flex items-center gap-2">
            {subjectPerfOpen ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">Subject-wise Performance (Plan vs Actual)</h3>
          </div>
          {!subjectPerfOpen && (
            <span className="text-xs text-gray-500">
              {classSubjectPerformance.length} subjects
            </span>
          )}
        </div>
        {subjectPerfOpen && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm text-gray-600">Class:</label>
                <select 
                  value={performanceClassFilter}
                  onChange={(e) => setPerformanceClassFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Classes</option>
                  {[...new Set(classSubjectPerformance.map(p => p.class))].sort().map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <label className="text-sm text-gray-600 ml-2">Teacher:</label>
                <select 
                  value={performanceTeacherFilter}
                  onChange={(e) => setPerformanceTeacherFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Teachers</option>
                  {[...new Set(classSubjectPerformance.map(p => p.teacherNames).filter(Boolean))].sort().map(teacher => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </select>
                {(performanceClassFilter || performanceTeacherFilter) && (
                  <button 
                    onClick={() => {
                      setPerformanceClassFilter('');
                      setPerformanceTeacherFilter('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher(s)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual (Planned)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unplanned ⚠️</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {classSubjectPerformance.length > 0 ? (
                    classSubjectPerformance
                      .filter(performance => {
                        const classMatch = !performanceClassFilter || performance.class === performanceClassFilter;
                        const teacherMatch = !performanceTeacherFilter || (performance.teacherNames && performance.teacherNames.includes(performanceTeacherFilter));
                        return classMatch && teacherMatch;
                      })
                      .map((performance, idx) => (
                      <tr key={idx} className={`hover:bg-gray-50 ${performance.unplannedSessions > 0 ? 'bg-orange-50' : performance.riskLevel === 'High' ? 'bg-red-50' : performance.riskLevel === 'Medium' ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{performance.subject}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{performance.class}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-block max-w-xs truncate" title={performance.teacherNames}>
                            {performance.teacherNames || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{performance.plannedSessions}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{performance.actualPlannedSessions || 0}</td>
                        <td className="px-4 py-3 text-sm">
                          {performance.unplannedSessions > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                              {performance.unplannedSessions} ⚠️
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={performance.planActualGap > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {performance.planActualGap > 0 ? '+' : ''}{performance.planActualGap}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={performance.coveragePercentage >= 80 ? 'bg-green-600' : performance.coveragePercentage >= 50 ? 'bg-yellow-600' : 'bg-red-600'} 
                                style={{ width: `${Math.min(performance.coveragePercentage || 0, 100)}%`, height: '100%', borderRadius: '4px' }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{performance.coveragePercentage || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(performance.avgCompletion || 0, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{performance.avgCompletion || 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        {analyticsLoading ? 'Loading performance data...' : 'No subject performance data available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">📖 Legend:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><strong>Planned:</strong> Total lesson plans created</li>
                <li><strong>Actual (Planned):</strong> Daily reports with matching lesson plans</li>
                <li><strong className="text-orange-600">Unplanned ⚠️:</strong> Daily reports WITHOUT lesson plans (taught without preparation)</li>
                <li><strong>Gap:</strong> Planned sessions not yet taught (+ means pending)</li>
                <li><strong>Coverage:</strong> (Actual Planned / Planned) × 100%</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Class-wise Performance (Collapsible) */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg mb-6">
        <div
          className="flex justify-between items-center mb-2 cursor-pointer select-none"
          onClick={() => setClassPerfOpen(prev => !prev)}
        >
          <div className="flex items-center gap-2">
            {classPerfOpen ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">Class-wise Performance (Plan vs Actual)</h3>
          </div>
          {!classPerfOpen && (
            <span className="text-xs text-gray-500">{[...new Set(classSubjectPerformance.map(p => p.class))].length} classes</span>
          )}
        </div>
        {classPerfOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classSubjectPerformance.length > 0 ? (
            // Group by class from the performance data
            Object.entries(
              classSubjectPerformance.reduce((acc, perf) => {
                if (!acc[perf.class]) {
                  acc[perf.class] = {
                    class: perf.class,
                    plannedSessions: 0,
                    actualPlannedSessions: 0,
                    unplannedSessions: 0,
                    completedSessions: 0,
                    avgCompletions: [],
                    subjects: new Set(),
                    riskLevel: 'Low'
                  };
                }
                acc[perf.class].plannedSessions += perf.plannedSessions || 0;
                acc[perf.class].actualPlannedSessions += perf.actualPlannedSessions || 0;
                acc[perf.class].unplannedSessions += perf.unplannedSessions || 0;
                acc[perf.class].completedSessions += perf.completedSessions || 0;
                acc[perf.class].avgCompletions.push(perf.avgCompletion || 0);
                acc[perf.class].riskLevel = perf.riskLevel === 'High' ? 'High' : acc[perf.class].riskLevel;
                if (perf.subject) acc[perf.class].subjects.add(perf.subject);
                return acc;
              }, {})
            ).map(([classKey, classData]) => {
              const avgCompletion = classData.avgCompletions.length > 0
                ? Math.round(classData.avgCompletions.reduce((a, b) => a + b) / classData.avgCompletions.length)
                : 0;
              
              const coverage = classData.plannedSessions > 0
                ? Math.round((classData.actualPlannedSessions / classData.plannedSessions) * 100)
                : 0;
              
              const gap = classData.plannedSessions - classData.actualPlannedSessions;
              const hasUnplanned = classData.unplannedSessions > 0;
              
              return (
                <div key={classKey} className={`p-4 rounded-lg border-2 ${hasUnplanned ? 'bg-orange-50 border-orange-300' : classData.riskLevel === 'High' ? 'bg-red-50 border-red-200' : classData.riskLevel === 'Medium' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{classData.class}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hasUnplanned ? 'bg-orange-100 text-orange-800' : classData.riskLevel === 'High' ? 'bg-red-100 text-red-800' : classData.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {hasUnplanned ? '⚠️ Unprepared' : classData.riskLevel}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium">Plan: {classData.plannedSessions}</span>
                      <span className="text-gray-500"> | </span>
                      <span className="font-medium">Actual: {classData.actualPlannedSessions}</span>
                      <span className={`ml-1 font-medium ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ({gap > 0 ? '+' : ''}{gap})
                      </span>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Total Reports: {classData.actualPlannedSessions + classData.unplannedSessions}</span>
                      <span className="text-gray-500"> ({classData.actualPlannedSessions} planned + {classData.unplannedSessions} unplanned)</span>
                    </p>
                    {hasUnplanned && (
                      <p className="text-orange-700 font-medium">
                        ⚠️ {classData.unplannedSessions} session(s) taught without lesson plan
                      </p>
                    )}
                    <p className="text-gray-600">
                      <span className="font-medium">{classData.completedSessions}</span>
                      <span className="text-gray-500"> sessions completed (Avg: {avgCompletion}%)</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">{classData.subjects.size}</span>
                      <span className="text-gray-500"> subject(s) | Coverage: {coverage}%</span>
                    </p>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={coverage >= 80 ? 'bg-green-600' : coverage >= 50 ? 'bg-yellow-600' : 'bg-red-600'} 
                      style={{ width: `${Math.min(coverage, 100)}%`, height: '100%', borderRadius: '4px' }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500">
              {analyticsLoading ? 'Loading performance data...' : 'No class performance data available.'}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
            <select
              value={filters.teacher}
              onChange={(e) => setFilters(prev => ({ ...prev, teacher: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Teachers</option>
              {teachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Completion</label>
            <select
              value={filters.completionRange}
              onChange={(e) => setFilters(prev => ({ ...prev, completionRange: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="excellent">Excellent (80%+)</option>
              <option value="good">Good (60-79%)</option>
              <option value="concern">Concern (&lt;60%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'reports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Session Reports ({filteredReports.length})
          </button>
          <button
            onClick={() => setActiveTab('plan-actual')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plan-actual'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Plan vs Actual ({merged.summary?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Chapter Analytics ({filteredAnalytics.length})
          </button>
          <button
            onClick={() => setActiveTab('pace-tracking')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pace-tracking'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Syllabus Pace Tracking ({filteredPaceTrackingSubjects.length})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'missing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Missing Submissions ({missing.stats.missingCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'insights'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Performance Insights
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'reports' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class/Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter & Session</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report, index) => {
                  const completion = Number(report.completionPercentage) || 0;
                  // Treat report as submitted only if we have an explicit submittedAt timestamp OR a positive completion percentage OR explicit submitted flag
                  const isSubmitted = !!(report.submittedAt || report.submitted || (report.completionPercentage != null && completion > 0));
                  const isVerified = String(report.verified ?? report.Verified ?? '').toLowerCase() === 'true';
                  const isReopened = Boolean(report.reopenedAt || report.reopenReason || (String(report.reopened ?? '').toLowerCase() === 'true'));
                  // Determine if a matching lesson plan exists (by id first, then by fields)
                  const matchingPlanById = Array.isArray(lessonPlans) ? lessonPlans.find(p => String(p.lpId || p.lessonPlanId || '') === String(report.lessonPlanId || '')) : null;
                  const matchingPlanByFields = !matchingPlanById && Array.isArray(lessonPlans) ? lessonPlans.find(p =>
                    String(p.teacherEmail || '').toLowerCase() === String(report.teacherEmail || '').toLowerCase() &&
                    String(p.class || '') === String(report.class || '') &&
                    String(p.subject || '') === String(report.subject || '') &&
                    String(p.selectedPeriod || p.period || '') === String(report.period || '')
                  ) : null;
                  const matchingPlan = matchingPlanById || matchingPlanByFields;
                  const hasMatchingPlan = !!matchingPlan;
                  // Only show Unplanned warning for substitution sessions without a matching plan
                  const showUnplanned = isSubmitted && !hasMatchingPlan && (report.isSubstitution === true || String(report.isSubstitution).toLowerCase() === 'true');
                  // Derive display chapter/session from report, fallback to matching lesson plan
                  const displayChapter = report.chapter || (matchingPlan && matchingPlan.chapter) || '';
                  const displaySessionNo = report.sessionNo || report.session || (matchingPlan && (matchingPlan.session || matchingPlan.sessionNo));
                  const displayTotalSessions = report.totalSessions || (matchingPlan && matchingPlan.totalSessions) || '';
                  return (
                    <tr key={index} className={isSubmitted ? 'bg-green-50' : 'bg-yellow-50'}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">
                          {report.teacherName || report.teacherEmail}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Period {report.period}
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{report.class}</div>
                        <div className="text-gray-500">{report.subject}</div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{displayChapter || <span className="text-gray-400">—</span>}</div>
                        {displaySessionNo && (
                          <div className="text-xs text-purple-600">
                            Session {displaySessionNo}{displayTotalSessions ? ` of ${displayTotalSessions}` : ''}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-3">
                        {isSubmitted ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCompletionColor(completion)}`}>
                              {completion}%
                            </span>
                            {completion < 60 && (
                              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Not Submitted
                          </span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {showUnplanned && (
                            <div className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                              ⚠️ Unplanned (Substitution without matching plan)
                            </div>
                          )}
                          {report.difficulties && (
                            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                              ⚠️ {report.difficulties}
                            </div>
                          )}
                          {report.nextSessionPlan && (
                            <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                              📝 {report.nextSessionPlan}
                            </div>
                          )}
                          {!report.difficulties && !report.nextSessionPlan && (
                            <span className="text-xs text-gray-500">No issues reported</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isSubmitted ? (
                          <div className="flex flex-col gap-2">
                            {(isVerified || isReopened) && (
                              <div className="flex flex-wrap items-center gap-2">
                                {isVerified && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Verified
                                  </span>
                                )}
                                {isReopened && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                    <Undo2 className="w-3 h-3 mr-1" /> Reopened
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex gap-2">
                              {(() => {
                                const rk = computeReportKey(report);
                                const isVerifying = verifyingKey === rk;
                                const isReopening = reopeningKey === rk;
                                return (
                                  <>
                                    {/* Show Verify/Reopen only when truly submitted (not empty 0% placeholder) */}
                                    {isSubmitted && completion > 0 && (
                                      <>
                                        <button
                                          disabled={isVerifying || isReopening}
                                          onClick={() => handleVerify(report)}
                                          className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center"
                                        >
                                          {isVerifying && (
                                            <span className="inline-block h-3 w-3 mr-1 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></span>
                                          )}
                                          {isVerifying ? 'Verifying…' : 'Verify'}
                                        </button>
                                        <button
                                          disabled={isVerifying || isReopening}
                                          onClick={() => handleReopen(report)}
                                          className="px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 inline-flex items-center"
                                        >
                                          {isReopening && (
                                            <span className="inline-block h-3 w-3 mr-1 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></span>
                                          )}
                                          {isReopening ? 'Reopening…' : 'Reopen'}
                                        </button>
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                
                {filteredReports.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No reports found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'plan-actual' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Summary header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border-b border-gray-200 bg-gray-50">
            <div>
              <p className="text-xs text-gray-600">Scheduled</p>
              <p className="text-lg font-semibold text-gray-900">{merged.summary?.total || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Planned (Ready/Approved)</p>
              <p className="text-lg font-semibold text-blue-700">{merged.summary?.plannedReady || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Reports Submitted</p>
              <p className="text-lg font-semibold text-green-700">{merged.summary?.reported || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Unplanned</p>
              <p className="text-lg font-semibold text-amber-700">{merged.summary?.unplannedCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Avg Completion</p>
              <p className="text-lg font-semibold text-indigo-700">{merged.summary?.avgCompletion || 0}%</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class/Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(merged.periods || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">P{row.period}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{row.class}</div>
                      <div className="text-gray-600">{row.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{row.teacherName || row.teacherEmail}</div>
                      {row.isSubstitution && (
                        <div className="text-xs text-amber-700">Substitution</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.hasPlan ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {row.planStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">No Plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.hasReport ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            {row.completionPercentage || 0}%
                          </span>
                          {row.verified && (
                            <span className="text-xs text-emerald-700">Verified</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No Report</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        {row.unplanned && (
                          <div className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200 inline-block">Unplanned</div>
                        )}
                        {row.difficulties && (
                          <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block">⚠️ {row.difficulties}</div>
                        )}
                        {row.nextSessionPlan && (
                          <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">📝 {row.nextSessionPlan}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(merged.periods || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No data for selected date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'missing' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Missing Submissions</h3>
              <p className="text-sm text-gray-600">Total periods: {missing.stats.totalPeriods} • Missing: {missing.stats.missingCount} • Teachers: {missing.stats.teachersImpacted}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadMissing}
                disabled={missingLoading}
                className="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                {missingLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={handleNotifyAllMissing}
                disabled={actionBusy || (missing.stats.missingCount || 0) === 0}
                className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Notify All Pending
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending Count</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periods</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(missing.byTeacher || []).map((t, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.teacher}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.teacherEmail}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">{t.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(t.periods || []).map((p, i) => (
                        <span key={i} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs border border-yellow-200">
                          P{p.period}: {p.class} {p.subject}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
                {(!missing.byTeacher || missing.byTeacher.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No pending submissions for this date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {filteredAnalytics.map((chapter, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{chapter.chapter}</h3>
                  <p className="text-sm text-gray-600">{chapter.class} - {chapter.subject}</p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getCompletionColor(chapter.avgCompletion)}`}>
                    {chapter.avgCompletion}% Avg
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {chapter.completedSessions} of {chapter.sessions.length} sessions complete
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Progress</p>
                  <p className="text-gray-600">
                    {chapter.completedSessions}/{chapter.totalSessions || chapter.sessions.length} sessions
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(chapter.completedSessions / (chapter.totalSessions || chapter.sessions.length)) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <p className="font-medium text-gray-700">Teachers</p>
                  <p className="text-gray-600">{chapter.teachers.join(', ')}</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-700">Sessions Detail</p>
                  <div className="space-y-1">
                    {chapter.sessions.map((session, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span>Session {session.sessionNo || idx + 1}</span>
                        <span className={`px-1 py-0.5 rounded ${getCompletionColor(session.completionPercentage)}`}>
                          {session.completionPercentage || 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredAnalytics.length === 0 && !loading && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No chapter analytics available for the selected filters.
            </div>
          )}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Performance Insights</h3>
              <p className="text-sm text-gray-600">Aggregated metrics powered by the analytics API</p>
            </div>
            <button
              onClick={loadClassSubjectPerformance}
              disabled={analyticsLoading}
              className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {analyticsLoading ? 'Recomputing…' : 'Recompute Insights'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {(() => {
              const items = classSubjectPerformance || [];
              const subjectCount = items.length;
              const avgCoverage = subjectCount > 0
                ? Math.round(items.reduce((s, x) => s + (x.coveragePercentage || 0), 0) / subjectCount)
                : 0;
              const totalUnplanned = items.reduce((s, x) => s + (x.unplannedSessions || 0), 0);
              const highRisk = items.filter(x => x.riskLevel === 'High').length;
              return (
                <>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <p className="text-sm text-gray-600">Subjects Analyzed</p>
                    <p className="text-2xl font-bold text-gray-900">{subjectCount}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <p className="text-sm text-gray-600">Average Coverage</p>
                    <p className="text-2xl font-bold text-blue-700">{avgCoverage}%</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <p className="text-sm text-gray-600">Unplanned Sessions</p>
                    <p className="text-2xl font-bold text-amber-700">{totalUnplanned}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <p className="text-sm text-gray-600">High Risk Subjects</p>
                    <p className="text-2xl font-bold text-red-700">{highRisk}</p>
                  </div>
                </>
              );
            })()}
          </div>

          {(!classSubjectPerformance || classSubjectPerformance.length === 0) && !analyticsLoading ? (
            <div className="text-center py-8 text-gray-500">No insights available. Try "Recompute Insights".</div>
          ) : null}
        </div>
      )}

      {activeTab === 'pace-tracking' && (
        <div className="space-y-6">
          {/* Term Selector */}
          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium text-gray-700">Select Term:</label>
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value);
                setTimeout(() => loadPaceTracking(), 100);
              }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          {loadingPaceTracking && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="ml-3 text-gray-600">Loading pace tracking...</div>
            </div>
          )}

          {!loadingPaceTracking && paceTracking && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Total Subjects</p>
                  <p className="text-3xl font-bold text-blue-600">{filteredPaceTrackingSubjects.length}</p>
                </div>
                <div className="bg-green-50 p-4 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">On Track</p>
                  <p className="text-3xl font-bold text-green-600">
                    {filteredPaceTrackingSubjects.filter(s => s.riskLevel === 'LOW').length}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">At Risk</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {filteredPaceTrackingSubjects.filter(s => s.riskLevel === 'MEDIUM').length}
                  </p>
                </div>
                <div className="bg-red-50 p-4 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Critical</p>
                  <p className="text-3xl font-bold text-red-600">
                    {filteredPaceTrackingSubjects.filter(s => s.riskLevel === 'HIGH').length}
                  </p>
                </div>
              </div>

              {/* Subject Details */}
              <div className="space-y-4">
                {filteredPaceTrackingSubjects.map((subject, idx) => {
                  const bgColor = subject.riskLevel === 'HIGH' ? 'bg-red-50 border-red-200' :
                                  subject.riskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                                  'bg-green-50 border-green-200';
                  const textColor = subject.riskLevel === 'HIGH' ? 'text-red-700' :
                                    subject.riskLevel === 'MEDIUM' ? 'text-yellow-700' :
                                    'text-green-700';
                  
                  return (
                    <div key={idx} className={`p-4 border rounded-lg ${bgColor}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{subject.className} - {subject.subject}</h3>
                          <p className="text-sm text-gray-600">Teacher: {subject.teacher}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${textColor} bg-white`}>
                          {subject.riskLevel} RISK
                        </span>
                      </div>

                      {/* Progress Bars */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Syllabus Target</p>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-blue-600 h-3 rounded-full flex items-center justify-center text-white text-xs"
                              style={{ width: `${Math.min(subject.syllabusProgress || 0, 100)}%` }}
                            >
                              {subject.syllabusProgress || 0}%
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {subject.syllabusCompleted || 0} / {subject.syllabusTotal || 0} chapters
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Scheme Progress</p>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-indigo-600 h-3 rounded-full flex items-center justify-center text-white text-xs"
                              style={{ width: `${Math.min(subject.schemeProgress || 0, 100)}%` }}
                            >
                              {subject.schemeProgress || 0}%
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {subject.schemeCompleted || 0} / {subject.schemeTotal || 0} sessions
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Actual Completion</p>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full flex items-center justify-center text-white text-xs"
                              style={{ width: `${Math.min(subject.actualProgress || 0, 100)}%` }}
                            >
                              {subject.actualProgress || 0}%
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {subject.actualCompleted || 0} / {subject.actualTotal || 0} sessions
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Time Elapsed</p>
                          <p className="font-bold">{subject.weeksElapsed || 0} / {subject.totalWeeks || 0} weeks</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Expected Progress</p>
                          <p className="font-bold">{subject.expectedProgress || 0}%</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Behind By</p>
                          <p className={`font-bold ${subject.behindBy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {subject.behindBy > 0 ? `${subject.behindBy}%` : 'On track'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Projected Completion</p>
                          <p className="font-bold">{subject.projectedCompletion || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Recommendations */}
                      {subject.recommendation && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">💡 Recommendation:</p>
                          <p className="text-sm text-gray-600">{subject.recommendation}</p>
                        </div>
                      )}

                      {/* Warnings */}
                      {subject.warnings && subject.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {subject.warnings.map((warning, wIdx) => (
                            <p key={wIdx} className="text-sm text-red-600 flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredPaceTrackingSubjects.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  No pace tracking data available for {selectedTerm} with the current filters. Please ensure syllabus and scheme data are configured.
                </div>
              )}
            </>
          )}

          {!loadingPaceTracking && !paceTracking && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              Unable to load pace tracking data. Please try again.
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="ml-3 text-gray-600">Loading data...</div>
        </div>
      )}
    </div>
  );
};

export default HMDailyOversightEnhanced;