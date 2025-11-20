import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, 
  Users, BookOpen, Target, Activity, Filter, Search, Eye, X,
  BarChart3, PieChart, Calendar, Award, Download, RefreshCw
} from 'lucide-react';
import * as api from '../api';

/**
 * HM Teacher Performance Overview
 * Comprehensive monitoring of all teachers' session completion and performance
 */
const HMTeacherPerformanceView = ({ user }) => {
  const [teacherPerformances, setTeacherPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    performanceGrade: '',
    sortBy: 'averageCompletion',
    sortOrder: 'desc'
  });
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showTeacherDetail, setShowTeacherDetail] = useState(false);
  const [overallStats, setOverallStats] = useState({
    totalTeachers: 0,
    averageCompletion: 0,
    onTimeRate: 0,
    teachersNeedingSupport: 0
  });
  // Real-time update features
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAllTeacherPerformances();
  }, []);

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      handleAutoRefresh();
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    await loadAllTeacherPerformances(true);
    setIsRefreshing(false);
  };

  const loadAllTeacherPerformances = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      
      // Use the new HM-specific API endpoint
      const response = await api.getAllTeachersPerformance();
      
      console.log('HM Performance API Response:', response);
      
      // Unwrap response structure: {status, data: {success, performances}}
      const result = response.data || response;
      
      if (result.success && result.performances && Array.isArray(result.performances)) {
        // Map the performances to expected format
        const performances = result.performances.map((teacher, idx) => {
          const mapped = {
            teacherEmail: teacher.teacherEmail,
            teacherName: teacher.teacherName || teacher.teacherEmail,
            totalSessions: parseInt(teacher.totalSessions || 0),
            completedSessions: parseInt(teacher.completedSessions || 0),
            partialSessions: parseInt(teacher.partialSessions || 0),
            averageCompletion: parseInt(teacher.averageCompletion || 0),
            onTimeCompletion: parseInt(teacher.onTimeCompletion || 100),
            cascadingIssues: parseInt(teacher.cascadingIssues || 0),
            performanceGrade: String(teacher.performanceGrade || 'No Data').trim(),
            recommendations: teacher.recommendations || [],
            qualityScore: parseInt(teacher.qualityScore || 0),
            submissionRate: parseInt(teacher.submissionRate || 0),
            lastSubmitDate: teacher.lastSubmitDate || 'Never'
          };
          
          // Log first teacher to debug
          if (idx === 0) {
            console.log('First teacher mapped data:', mapped);
            console.log('Raw teacher from backend:', teacher);
          }
          
          return mapped;
        });
        
        console.log(`Loaded ${performances.length} teacher performances`);
        setTeacherPerformances(performances);
        setLastUpdated(new Date());
        
        // Detect critical alerts
        const alerts = performances
          .filter(t => 
            t.cascadingIssues >= 3 || 
            t.averageCompletion < 60 || 
            t.performanceGrade === 'Needs Improvement' ||
            t.performanceGrade === 'At Risk'
          )
          .map(t => ({
            type: 'critical',
            teacher: t.teacherName,
            email: t.teacherEmail,
            message: t.cascadingIssues >= 3 
              ? `${t.cascadingIssues} cascading issues detected`
              : t.performanceGrade === 'At Risk'
              ? `At risk: ${t.averageCompletion}% completion`
              : `Low completion rate: ${t.averageCompletion}%`,
            timestamp: new Date()
          }));
        
        setCriticalAlerts(alerts);
        
        // Calculate overall stats
        if (performances.length > 0) {
          const avgCompletion = Math.round(performances.reduce((sum, p) => sum + p.averageCompletion, 0) / performances.length);
          const avgOnTime = Math.round(performances.reduce((sum, p) => sum + p.onTimeCompletion, 0) / performances.length);
          const teachersNeedingSupport = performances.filter(t => 
            t.performanceGrade === 'At Risk' || 
            t.performanceGrade === 'Needs Improvement'
          ).length;
          
          setOverallStats({
            totalTeachers: performances.length,
            averageCompletion: avgCompletion,
            onTimeRate: avgOnTime,
            teachersNeedingSupport: teachersNeedingSupport
          });
        } else {
          setOverallStats({
            totalTeachers: 0,
            averageCompletion: 0,
            onTimeRate: 0,
            teachersNeedingSupport: 0
          });
        }
      } else {
        console.warn('No teacher performance data available or invalid response structure:', result);
        setTeacherPerformances([]);
        setOverallStats({
          totalTeachers: 0,
          averageCompletion: 0,
          onTimeRate: 0,
          teachersNeedingSupport: 0
        });
      }
    } catch (error) {
      console.error('Error loading teacher performances:', error);
      setTeacherPerformances([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallStats = (performances) => {
    if (performances.length === 0) return;
    
    const totalCompletion = performances.reduce((sum, p) => sum + (p.averageCompletion || 0), 0);
    const totalOnTime = performances.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0);
    const needingSupport = performances.filter(p => 
      p.performanceGrade === 'Needs Improvement' || p.cascadingIssues > 2
    ).length;
    
    setOverallStats({
      totalTeachers: performances.length,
      averageCompletion: Math.round(totalCompletion / performances.length),
      onTimeRate: Math.round(totalOnTime / performances.length),
      teachersNeedingSupport: needingSupport
    });
  };

  const filteredTeachers = teacherPerformances
    .filter(teacher => {
      const matchesSearch = !filters.search || 
        teacher.teacherEmail.toLowerCase().includes(filters.search.toLowerCase());
      const matchesGrade = !filters.performanceGrade || 
        teacher.performanceGrade === filters.performanceGrade;
      
      return matchesSearch && matchesGrade;
    })
    .sort((a, b) => {
      const aVal = a[filters.sortBy] || 0;
      const bVal = b[filters.sortBy] || 0;
      return filters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const getPerformanceColor = (grade) => {
    switch (grade) {
      case 'Excellent': return 'text-green-600 bg-green-50';
      case 'Good': return 'text-blue-600 bg-blue-50';
      case 'Satisfactory': return 'text-yellow-600 bg-yellow-50';
      case 'Needs Improvement': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCompletionIndicator = (percentage) => {
    if (percentage >= 90) return { color: 'text-green-600', icon: CheckCircle };
    if (percentage >= 75) return { color: 'text-blue-600', icon: TrendingUp };
    if (percentage >= 60) return { color: 'text-yellow-600', icon: Clock };
    return { color: 'text-red-600', icon: AlertTriangle };
  };

  const openTeacherDetail = async (teacher) => {
    setSelectedTeacher(teacher);
    setShowTeacherDetail(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading teacher performance data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                Critical Alerts ({criticalAlerts.length})
              </h3>
              <div className="space-y-1">
                {criticalAlerts.slice(0, 3).map((alert, idx) => (
                  <div key={idx} className="text-sm text-red-700">
                    <strong>{alert.teacher}:</strong> {alert.message}
                  </div>
                ))}
                {criticalAlerts.length > 3 && (
                  <p className="text-sm text-red-600 font-medium mt-1">
                    +{criticalAlerts.length - 3} more alerts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Real-Time Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Performance Overview</h1>
          {lastUpdated && (
            <div className="flex items-center mt-1 text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              {isRefreshing && (
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
          
          {/* Manual refresh button */}
          <button
            onClick={() => handleAutoRefresh()}
            disabled={isRefreshing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:bg-gray-400"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{overallStats.totalTeachers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Completion</p>
              <p className="text-2xl font-bold text-gray-900">{overallStats.averageCompletion}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">On-Time Rate</p>
              <p className="text-2xl font-bold text-gray-900">{overallStats.onTimeRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Need Support</p>
              <p className="text-2xl font-bold text-gray-900">{overallStats.teachersNeedingSupport}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <select
            value={filters.performanceGrade}
            onChange={(e) => setFilters({...filters, performanceGrade: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Grades</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Satisfactory">Satisfactory</option>
            <option value="Needs Improvement">Needs Improvement</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="averageCompletion">Completion Rate</option>
            <option value="onTimeCompletion">On-Time Rate</option>
            <option value="totalSessions">Total Sessions</option>
            <option value="cascadingIssues">Issues Count</option>
          </select>

          <select
            value={filters.sortOrder}
            onChange={(e) => setFilters({...filters, sortOrder: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="desc">Highest First</option>
            <option value="asc">Lowest First</option>
          </select>
        </div>
      </div>

      {/* Teacher Performance Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Individual Teacher Performance</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On-Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTeachers.map((teacher) => {
                const completionIndicator = getCompletionIndicator(teacher.averageCompletion || 0);
                const CompletionIcon = completionIndicator.icon;
                
                return (
                  <tr key={teacher.teacherEmail} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {teacher.teacherEmail.split('@')[0]}
                        </div>
                        <div className="text-sm text-gray-500">{teacher.teacherEmail}</div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{teacher.totalSessions || 0}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CompletionIcon className={`h-4 w-4 mr-2 ${completionIndicator.color}`} />
                        <span className="text-sm font-medium text-gray-900">
                          {teacher.averageCompletion || 0}%
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {teacher.onTimeCompletion || 100}%
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {teacher.cascadingIssues > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        )}
                        <span className="text-sm text-gray-900">{teacher.cascadingIssues || 0}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColor(teacher.performanceGrade)}`}>
                        {teacher.performanceGrade || 'No Data'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openTeacherDetail(teacher)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTeachers.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {teacherPerformances.length === 0 ? 'No performance data available' : 'No teachers found'}
            </h3>
            <div className="text-gray-600">
              {teacherPerformances.length === 0 ? (
                <div className="space-y-2">
                  <p>Performance data will appear when teachers complete sessions</p>
                  <div className="text-sm text-left inline-block mt-3">
                    <p>Teachers need to:</p>
                    <p>1. Create lesson plans</p>
                    <p>2. Use "Session Progress" to mark completion</p>
                    <p>3. Complete sessions with percentage tracking</p>
                  </div>
                </div>
              ) : (
                <p>No teachers match your current filters</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Teacher Detail Modal */}
      {showTeacherDetail && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Teacher Performance Details
              </h3>
              <button
                onClick={() => setShowTeacherDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Teacher Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Teacher Information</h4>
                <p className="text-sm text-gray-600">{selectedTeacher.teacherEmail}</p>
                <p className="text-sm text-gray-600">Performance Grade: 
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(selectedTeacher.performanceGrade)}`}>
                    {selectedTeacher.performanceGrade}
                  </span>
                </p>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800">Total Sessions</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedTeacher.totalSessions}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{selectedTeacher.completedSessions}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800">Avg Completion</p>
                  <p className="text-2xl font-bold text-yellow-900">{selectedTeacher.averageCompletion}%</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-purple-800">On-Time Rate</p>
                  <p className="text-2xl font-bold text-purple-900">{selectedTeacher.onTimeCompletion}%</p>
                </div>
              </div>

              {/* Recommendations */}
              {selectedTeacher.recommendations && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">💡 Recommendations</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {selectedTeacher.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTeacherDetail(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HMTeacherPerformanceView;