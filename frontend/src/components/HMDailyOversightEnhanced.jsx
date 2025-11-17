// HMDailyOversightEnhanced.jsx - Enhanced HM Dashboard with Session Progress Analytics
import React, { useState, useEffect } from 'react';
import { getDailyReportsForDate, getLessonPlansForDate } from '../api';
import { todayIST, formatLocalDate } from '../utils/dateUtils';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';

const HMDailyOversightEnhanced = ({ user }) => {
  const [date, setDate] = useState(todayIST());
  const [reports, setReports] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
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
  // Real-time features
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urgentAlerts, setUrgentAlerts] = useState([]);

  useEffect(() => {
    loadDailyReports();
    loadLessonPlans();
  }, [date]);

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      handleAutoRefresh();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, date]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadDailyReports(true), loadLessonPlans(true)]);
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
    const now = new Date();
    const currentHour = now.getHours();
    
    // Detect pending reports for ongoing/past periods
    const pendingReports = data.filter(r => !r.submitted && !r.completionPercentage);
    
    // Check if it's during school hours (8 AM - 4 PM)
    if (currentHour >= 8 && currentHour <= 16) {
      // Alert for reports that should have been submitted
      if (pendingReports.length > 0) {
        alerts.push({
          type: 'urgent',
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
        type: 'critical',
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
    if (lowCompletion.length >= 3) {
      alerts.push({
        type: 'warning',
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

  function getCompletionColor(percentage) {
    const p = Number(percentage) || 0;
    if (p >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (p >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (p >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (p > 0) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  const filteredReports = getFilteredReports();

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
                <option value={60000}>1 min</option>
                <option value={300000}>5 min</option>
                <option value={600000}>10 min</option>
                <option value={1800000}>30 min</option>
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
          }}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

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
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Chapter Analytics ({sessionAnalytics.length})
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report, index) => {
                  const completion = Number(report.completionPercentage) || 0;
                  const isSubmitted = report.submitted || report.completionPercentage !== undefined;
                  
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
                        <div className="font-medium text-gray-900">{report.chapter}</div>
                        {report.sessionNo && (
                          <div className="text-xs text-purple-600">
                            Session {report.sessionNo}{report.totalSessions ? ` of ${report.totalSessions}` : ''}
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

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {sessionAnalytics.map((chapter, index) => (
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
          
          {sessionAnalytics.length === 0 && !loading && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No chapter analytics available for the selected date.
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