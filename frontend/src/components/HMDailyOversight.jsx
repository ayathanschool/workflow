// HMDailyOversight.jsx - HM Dashboard for Daily Report Tracking
import React, { useState, useEffect } from 'react';
import { getDailyReportsForDate, getLessonPlansForDate, getDailyReadinessStatus } from '../api';
import { todayIST, formatLocalDate } from '../utils/dateUtils';
import { FileText, ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react';

const HMDailyOversight = ({ user }) => {
  const [date, setDate] = useState(todayIST());
  const [reports, setReports] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [readinessData, setReadinessData] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [showLessonPlanDetails, setShowLessonPlanDetails] = useState(false);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' or 'lessonplans'
  const [stats, setStats] = useState({
    totalPeriods: 0,
    submitted: 0,
    pending: 0,
    completionRate: 0,
    fullyCompleted: 0,
    partiallyCompleted: 0,
    notStarted: 0
  });
  const [filters, setFilters] = useState({
    teacher: '',
    class: '',
    subject: '',
    status: 'all' // all | submitted | pending
  });
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    loadDailyReports();
    loadLessonPlans();
    loadReadinessStatus();
  }, [date]);

  // Auto-refresh readiness every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadReadinessStatus();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [date]);

  async function loadReadinessStatus() {
    setLoadingReadiness(true);
    try {
      console.log('Fetching readiness status for date:', date);
      const response = await getDailyReadinessStatus(date);
      console.log('Readiness status response:', response);
      console.log('Response type:', typeof response, 'Keys:', Object.keys(response));
      
      const result = response.data || response;
      console.log('Setting readinessData to:', result);
      setReadinessData(result);
    } catch (err) {
      console.error('Failed to load readiness status:', err);
    } finally {
      setLoadingReadiness(false);
    }
  }

  async function loadDailyReports() {
    setLoading(true);
    try {
      const response = await getDailyReportsForDate(date);
      console.log('Daily reports response:', response);
      
      // Unwrap the response (backend wraps in {status, data, timestamp})
      const result = response.data || response;
      const reportsData = result.reports || [];

      setReports(reportsData);
      calculateStats(reportsData);
      extractFilterOptions(reportsData);
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
      
      // Unwrap the response
      const result = response.data || response;
      const plansData = result.lessonPlans || [];

      setLessonPlans(plansData);
    } catch (err) {
      console.error('Failed to load lesson plans:', err);
      setLessonPlans([]);
    }
  }

  function calculateStats(data) {
    const total = data.length;
    const submitted = data.filter(r => r.submitted).length;
    const fullyCompleted = data.filter(r => r.completed === 'Fully Completed').length;
    const partiallyCompleted = data.filter(r => r.completed === 'Partially Completed').length;
    const notStarted = data.filter(r => r.completed === 'Not Started').length;

    setStats({
      totalPeriods: total,
      submitted,
      pending: total - submitted,
      completionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      fullyCompleted,
      partiallyCompleted,
      notStarted
    });
  }

  function extractFilterOptions(data) {
    const uniqueTeachers = [...new Set(data.map(r => r.teacher))].sort();
    const uniqueClasses = [...new Set(data.map(r => r.class))].sort();
    const uniqueSubjects = [...new Set(data.map(r => r.subject))].sort();

    setTeachers(uniqueTeachers);
    setClasses(uniqueClasses);
    setSubjects(uniqueSubjects);
  }

  function getFilteredReports() {
    return reports.filter(r => {
      if (filters.teacher && r.teacher !== filters.teacher) return false;
      if (filters.class && r.class !== filters.class) return false;
      if (filters.subject && r.subject !== filters.subject) return false;
      if (filters.status === 'submitted' && !r.submitted) return false;
      if (filters.status === 'pending' && r.submitted) return false;
      return true;
    });
  }

  const filteredReports = getFilteredReports();

  // Helper to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'bg-green-50 border-green-200';
      case 'good': return 'bg-blue-50 border-blue-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'critical': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'complete': return 'text-green-700';
      case 'good': return 'text-blue-700';
      case 'warning': return 'text-yellow-700';
      case 'critical': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  // Determine current time context (morning = before 3 PM, evening = after 3 PM)
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 15; // 3 PM

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Oversight</h1>
          <p className="text-sm text-gray-600 mt-1">Track daily reports and lesson plans</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="oversight-date" className="text-sm font-medium text-gray-700">Date:</label>
          <input
            id="oversight-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => { loadDailyReports(); loadReadinessStatus(); }}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Readiness Status Cards */}
      {readinessData && !readinessData.noClassesScheduled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lesson Plans Readiness Card */}
          <div className={`border-2 rounded-lg p-4 ${getStatusColor(readinessData.lessonPlans?.status)} ${!isEvening ? 'ring-2 ring-blue-400' : ''}`}>
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
              <span className={`text-3xl font-bold ${getStatusTextColor(readinessData.lessonPlans?.status)}`}>
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
          <div className={`border-2 rounded-lg p-4 ${getStatusColor(readinessData.dailyReports?.status)} ${isEvening ? 'ring-2 ring-green-400' : ''}`}>
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
              <span className={`text-3xl font-bold ${getStatusTextColor(readinessData.dailyReports?.status)}`}>
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

      {readinessData?.noClassesScheduled && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600">{readinessData.message}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'reports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📊 Daily Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('lessonplans')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'lessonplans'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📚 Lesson Plans ({lessonPlans.length})
          </button>
        </nav>
      </div>

      {/* Statistics Cards - Only show for Daily Reports */}
      {activeTab === 'reports' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Periods</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPeriods}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Submitted</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.submitted}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.completionRate}% completion</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.pending}</p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion</p>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600">✓ Full:</span>
                  <span className="text-sm font-semibold text-green-600">{stats.fullyCompleted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-600">◐ Partial:</span>
                  <span className="text-sm font-semibold text-yellow-600">{stats.partiallyCompleted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">○ Not Started:</span>
                  <span className="text-sm font-semibold text-gray-600">{stats.notStarted}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Filters - Only show for Daily Reports */}
      {activeTab === 'reports' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teacher</label>
              <select
                value={filters.teacher}
                onChange={e => setFilters({ ...filters, teacher: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Teachers</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
              <select
                value={filters.class}
                onChange={e => setFilters({ ...filters, class: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={filters.subject}
                onChange={e => setFilters({ ...filters, subject: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="submitted">Submitted Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
          </div>
          {(filters.teacher || filters.class || filters.subject || filters.status !== 'all') && (
            <button
              onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'all' })}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Daily Reports Table */}
      {activeTab === 'reports' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReports.map((report, idx) => (
                <tr key={idx} className={report.submitted ? 'bg-green-50' : 'bg-red-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{report.period}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {report.teacher}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {report.class}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {report.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      {report.planType === 'in plan' && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">📚</span>
                      )}
                      {report.chapter || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      report.completed === 'Fully Completed' 
                        ? 'bg-green-100 text-green-800'
                        : report.completed === 'Partially Completed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {report.completed}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {report.submitted ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✓ Submitted
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        ⚠️ Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.notes || '-'}
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No reports found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lesson Plans Table */}
      {activeTab === 'lessonplans' && (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LP Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lessonPlans.map((lp, idx) => (
                <tr key={idx} className={
                  lp.lpStatus === 'Approved' ? 'bg-green-50' : 
                  lp.lpStatus === 'Pending Review' ? 'bg-yellow-50' : 
                  lp.lpStatus === 'Rejected' ? 'bg-red-50' : 
                  'bg-white'
                }>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{lp.period}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {lp.class}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {lp.teacher}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {lp.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {lp.chapter || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                    {lp.sessionNo || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      lp.lpStatus === 'Approved' 
                        ? 'bg-green-100 text-green-800'
                        : lp.lpStatus === 'Pending Review'
                        ? 'bg-yellow-100 text-yellow-800'
                        : lp.lpStatus === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {lp.lpStatus === 'Pending Review' ? '⏳ Pending' : 
                       lp.lpStatus === 'Approved' ? '✓ Approved' : 
                       lp.lpStatus === 'Rejected' ? '✗ Rejected' : 
                       lp.lpStatus || 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      lp.completionStatus === 'Fully Completed' 
                        ? 'bg-green-100 text-green-800'
                        : lp.completionStatus === 'Partially Completed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {lp.completionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lp.notes || lp.reviewComments || '-'}
                  </td>
                </tr>
              ))}
              {lessonPlans.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No lesson plans found for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Summary Footer */}
      {activeTab === 'reports' && (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredReports.length}</span> of <span className="font-semibold">{reports.length}</span> reports
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Last updated: {formatLocalDate(date)}
          </div>
        </div>
      </div>
      )}

      {/* Lesson Plans Summary Footer */}
      {activeTab === 'lessonplans' && (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <p className="text-sm text-gray-600">
              Total: <span className="font-semibold">{lessonPlans.length}</span>
            </p>
            <p className="text-sm text-yellow-600">
              ⏳ Pending: <span className="font-semibold">{lessonPlans.filter(lp => lp.lpStatus === 'Pending Review').length}</span>
            </p>
            <p className="text-sm text-green-600">
              ✓ Approved: <span className="font-semibold">{lessonPlans.filter(lp => lp.lpStatus === 'Approved').length}</span>
            </p>
            <p className="text-sm text-red-600">
              ✗ Rejected: <span className="font-semibold">{lessonPlans.filter(lp => lp.lpStatus === 'Rejected').length}</span>
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Last updated: {formatLocalDate(date)}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default HMDailyOversight;
