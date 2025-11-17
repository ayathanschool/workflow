import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Calendar, AlertTriangle, CheckCircle,
  BookOpen, Clock, Users, Target, Activity, Filter, Download, RefreshCw
} from 'lucide-react';
import * as api from '../api';

/**
 * HM Session Analytics Dashboard
 * Comprehensive analytics of session completion across all teachers and subjects
 */
const HMSessionAnalyticsView = ({ user }) => {
  const [analyticsData, setAnalyticsData] = useState({
    totalSessions: 0,
    completedSessions: 0,
    partialSessions: 0,
    notStartedSessions: 0,
    overallCompletion: 0,
    subjectAnalytics: [],
    classAnalytics: [],
    teacherAnalytics: []
  });
  const [cascadingIssues, setCascadingIssues] = useState([]);
  const [issueSummary, setIssueSummary] = useState({
    totalIssues: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'week', // week, month, term
    subject: '',
    class: '',
    teacher: ''
  });
  const [refreshing, setRefreshing] = useState(false);
  // Real-time features
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [highPriorityIssues, setHighPriorityIssues] = useState([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [filters]);

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      handleAutoRefresh();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval]);

  const handleAutoRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData(true);
    setRefreshing(false);
  };

  const loadAnalyticsData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      
      // Use the new HM analytics API
      const [analyticsResponse, cascadingResponse] = await Promise.all([
        api.getSchoolSessionAnalytics(filters),
        api.getCascadingIssuesReport()
      ]);
      
      console.log('Analytics API Response:', analyticsResponse);
      console.log('Cascading Issues Response:', cascadingResponse);
      
      if (analyticsResponse && analyticsResponse.success) {
        const analytics = analyticsResponse.analytics;
        
        setAnalyticsData({
          totalSessions: analytics.totalSessions || 0,
          completedSessions: analytics.completedSessions || 0,
          partialSessions: analytics.partialSessions || 0,
          notStartedSessions: analytics.notStartedSessions || 0,
          overallCompletion: analytics.overallCompletionRate || 0,
          
          // Subject breakdown
          subjectAnalytics: Object.entries(analytics.subjectBreakdown || {}).map(([subject, data]) => ({
            subject,
            totalSessions: data.total || 0,
            completedSessions: data.completed || 0,
            completionRate: data.completionRate || 0,
            classes: 1 // Simplified for now
          })),
          
          // Class breakdown  
          classAnalytics: Object.entries(analytics.classBreakdown || {}).map(([className, data]) => ({
            class: className,
            totalSessions: data.total || 0,
            completedSessions: data.completed || 0,
            completionRate: data.completionRate || 0,
            subjects: 1 // Simplified for now
          })),
          
          // Teacher breakdown
          teacherAnalytics: Object.entries(analytics.teacherBreakdown || {}).map(([email, data]) => ({
            teacherName: data.name || email,
            teacherEmail: email,
            totalSessions: data.total || 0,
            completedSessions: data.completed || 0,
            completionRate: data.completionRate || 0,
            cascadingIssues: data.cascadingIssues || 0,
            status: data.completionRate >= 90 ? 'excellent' :
                   data.completionRate >= 75 ? 'good' :
                   data.completionRate >= 60 ? 'satisfactory' : 'needs-attention'
          }))
        });
        
        setLastUpdated(new Date());
        
        // Set cascading issues
        if (cascadingResponse && cascadingResponse.success) {
          const issues = cascadingResponse.issues || [];
          setCascadingIssues(issues);
          setIssueSummary(cascadingResponse.summary || {
            totalIssues: 0,
            highSeverity: 0,
            mediumSeverity: 0,
            lowSeverity: 0
          });
          
          // Extract high priority issues for alert
          const highPriority = issues.filter(issue => 
            issue.impactLevel === 'high' || issue.severity === 'high'
          ).slice(0, 5);
          setHighPriorityIssues(highPriority);
        }
      } else {
        console.error('Failed to load analytics:', analyticsResponse ? analyticsResponse.error : 'No response');
        setAnalyticsData({
          totalSessions: 0,
          completedSessions: 0,
          partialSessions: 0,
          notStartedSessions: 0,
          overallCompletion: 0,
          subjectAnalytics: [],
          classAnalytics: [],
          teacherAnalytics: []
        });
      }
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSessionData = (schemes, teachers) => {
    let totalSessions = 0;
    let completedSessions = 0;
    let partialSessions = 0;
    let notStartedSessions = 0;
    let totalCompletion = 0;
    
    const subjectMap = new Map();
    const classMap = new Map();
    const teacherMap = new Map();
    const cascadingIssues = [];

    schemes.forEach(scheme => {
      scheme.chapters.forEach(chapter => {
        chapter.sessions.forEach(session => {
          totalSessions++;
          
          if (session.status === 'planned' && session.plannedSessions > 0) {
            completedSessions++;
          } else if (session.status === 'not-planned') {
            notStartedSessions++;
          } else {
            partialSessions++;
          }

          // Subject analytics
          if (!subjectMap.has(scheme.subject)) {
            subjectMap.set(scheme.subject, { 
              total: 0, completed: 0, completion: 0, classes: new Set() 
            });
          }
          const subjectData = subjectMap.get(scheme.subject);
          subjectData.total++;
          subjectData.classes.add(scheme.class);
          if (session.status === 'planned') subjectData.completed++;

          // Class analytics
          if (!classMap.has(scheme.class)) {
            classMap.set(scheme.class, { 
              total: 0, completed: 0, completion: 0, subjects: new Set() 
            });
          }
          const classData = classMap.get(scheme.class);
          classData.total++;
          classData.subjects.add(scheme.subject);
          if (session.status === 'planned') classData.completed++;

          // Teacher analytics
          if (!teacherMap.has(scheme.teacherEmail)) {
            teacherMap.set(scheme.teacherEmail, {
              name: scheme.teacherName,
              total: 0,
              completed: 0,
              completion: 0,
              schemes: 0,
              cascading: 0
            });
          }
          const teacherData = teacherMap.get(scheme.teacherEmail);
          teacherData.total++;
          if (session.status === 'planned') teacherData.completed++;
        });
      });

      // Check for cascading issues
      if (scheme.plannedSessions < scheme.totalSessions) {
        const completionRate = Math.round((scheme.plannedSessions / scheme.totalSessions) * 100);
        if (completionRate < 75) {
          cascadingIssues.push({
            teacher: scheme.teacherName,
            subject: scheme.subject,
            class: scheme.class,
            completionRate,
            missingSessions: scheme.totalSessions - scheme.plannedSessions,
            severity: completionRate < 50 ? 'high' : completionRate < 75 ? 'medium' : 'low'
          });
        }
      }
    });

    // Calculate completion rates
    subjectMap.forEach((data, subject) => {
      data.completion = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      data.classCount = data.classes.size;
    });

    classMap.forEach((data, className) => {
      data.completion = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      data.subjectCount = data.subjects.size;
    });

    teacherMap.forEach((data, email) => {
      data.completion = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    });

    const overallCompletion = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    return {
      overallStats: {
        totalSessions,
        completedSessions,
        partialSessions,
        notStartedSessions,
        averageCompletion: overallCompletion
      },
      subjectAnalytics: Array.from(subjectMap.entries()).map(([subject, data]) => ({
        subject,
        ...data,
        classes: undefined // Remove Set from response
      })).sort((a, b) => b.completion - a.completion),
      classAnalytics: Array.from(classMap.entries()).map(([className, data]) => ({
        class: className,
        ...data,
        subjects: undefined // Remove Set from response
      })).sort((a, b) => b.completion - a.completion),
      teacherAnalytics: Array.from(teacherMap.entries()).map(([email, data]) => ({
        email,
        ...data
      })).sort((a, b) => b.completion - a.completion),
      cascadingIssues: cascadingIssues.sort((a, b) => a.completionRate - b.completionRate)
    };
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCompletionColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading session analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* High Priority Issues Alert */}
      {highPriorityIssues.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                High Priority Issues ({highPriorityIssues.length})
              </h3>
              <div className="space-y-1">
                {highPriorityIssues.map((issue, idx) => (
                  <div key={idx} className="text-sm text-red-700">
                    <strong>{issue.teacher || issue.class}:</strong> {issue.message || `${issue.impactLevel} impact detected`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Real-Time Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session Analytics Dashboard</h1>
          {lastUpdated && (
            <div className="flex items-center mt-1 text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              {refreshing && (
                <span className="ml-2 flex items-center text-blue-600">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Updating...
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex space-x-3 items-center">
          {/* Auto-refresh toggle */}
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Auto-refresh</span>
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border-l pl-2 border-gray-300"
              >
                <option value={1}>1 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={30}>30 min</option>
              </select>
            )}
          </div>
          
          <button
            onClick={handleAutoRefresh}
            disabled={refreshing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:bg-gray-400"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export Analytics
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="term">This Term</option>
          </select>

          <select
            value={filters.subject}
            onChange={(e) => setFilters({...filters, subject: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Subjects</option>
            {analyticsData.subjectAnalytics.map(subject => (
              <option key={subject.subject} value={subject.subject}>
                {subject.subject}
              </option>
            ))}
          </select>

          <select
            value={filters.class}
            onChange={(e) => setFilters({...filters, class: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Classes</option>
            {analyticsData.classAnalytics.map(classData => (
              <option key={classData.class} value={classData.class}>
                {classData.class}
              </option>
            ))}
          </select>

          <select
            value={filters.teacher}
            onChange={(e) => setFilters({...filters, teacher: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Teachers</option>
            {analyticsData.teacherAnalytics.map(teacher => (
              <option key={teacher.teacherEmail} value={teacher.teacherEmail}>
                {teacher.teacherName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.completedSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.partialSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Activity className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Not Started</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.notStartedSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overallCompletion}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Performance */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Subject-wise Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.subjectAnalytics.map((subject) => (
                <tr key={subject.subject} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{subject.subject}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{subject.classCount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{subject.total}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{subject.completed}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getCompletionColor(subject.completion)}`}>
                      {subject.completion}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cascading Issues Alert */}
      {cascadingIssues.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Cascading Issues Alert
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {cascadingIssues.slice(0, 5).map((issue, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {issue.teacher} - {issue.class} {issue.subject}
                    </div>
                    <div className="text-sm text-gray-600">
                      {issue.missingSessions} sessions behind schedule
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-red-600">
                      {issue.completionRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Class Performance */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Class-wise Performance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {analyticsData.classAnalytics.map((classData) => (
            <div key={classData.class} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{classData.class}</h3>
                <span className={`text-sm font-medium ${getCompletionColor(classData.completion)}`}>
                  {classData.completion}%
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>{classData.subjectCount} subjects</div>
                <div>{classData.completed}/{classData.total} sessions completed</div>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${classData.completion}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HMSessionAnalyticsView;