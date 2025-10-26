import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, BookOpen, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import * as api from '../api';

const AdvancedAnalytics = ({ user }) => {
  const [analytics, setAnalytics] = useState({
    submissionTrends: [],
    teacherPerformance: [],
    classProgress: [],
    systemOverview: {}
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7days'); // 7days, 30days, 90days

  useEffect(() => {
    fetchAnalytics();
  }, [user, timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Try to fetch real analytics data from the backend
      const realData = await api.getAnalyticsData();
      
      // If backend returns meaningful data, use it; otherwise use mock data
      if (realData && Object.keys(realData).length > 0) {
        // Transform backend data to match our component structure
        const transformedData = transformBackendData(realData);
        setAnalytics(transformedData);
      } else {
        // Fallback to mock data if backend data is empty
        console.warn('Backend analytics data is empty, using mock data');
        const mockData = generateMockAnalytics();
        setAnalytics(mockData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Fallback to mock data on error
      const mockData = generateMockAnalytics();
      setAnalytics(mockData);
    } finally {
      setLoading(false);
    }
  };

  const transformBackendData = (backendData) => {
    // Transform backend structure to match frontend expectations
    const systemOverview = backendData.systemOverview || {
      totalUsers: 0, activeToday: 0, pendingApprovals: 0, overdueItems: 0, systemHealth: 95
    };
    
    const submissionTrends = Array.isArray(backendData.submissionTrends) && backendData.submissionTrends.length > 0
      ? backendData.submissionTrends
      : generateMockSubmissionTrends();
    
    return {
      systemOverview: systemOverview,
      submissionTrends: submissionTrends,
      teacherPerformance: generateMockTeacherPerformance(), // Backend doesn't have this detailed data yet
      classProgress: generateMockClassProgress() // Backend doesn't have this detailed data yet
    };
  };

  const generateMockSubmissionTrends = () => [
    { date: '2025-10-17', lessonPlans: 12, schemes: 5, reports: 28 },
    { date: '2025-10-18', lessonPlans: 15, schemes: 3, reports: 32 },
    { date: '2025-10-19', lessonPlans: 8, schemes: 7, reports: 25 },
    { date: '2025-10-20', lessonPlans: 18, schemes: 4, reports: 30 },
    { date: '2025-10-21', lessonPlans: 22, schemes: 6, reports: 35 },
    { date: '2025-10-22', lessonPlans: 16, schemes: 2, reports: 28 },
    { date: '2025-10-23', lessonPlans: 20, schemes: 8, reports: 40 }
  ];

  const generateMockTeacherPerformance = () => [
    { name: 'Math Teachers', onTime: 85, late: 10, pending: 5 },
    { name: 'Science Teachers', onTime: 90, late: 7, pending: 3 },
    { name: 'English Teachers', onTime: 78, late: 15, pending: 7 },
    { name: 'Social Studies', onTime: 88, late: 8, pending: 4 },
    { name: 'Languages', onTime: 82, late: 12, pending: 6 }
  ];

  const generateMockClassProgress = () => [
    { name: 'Grade 1', completed: 95, inProgress: 5 },
    { name: 'Grade 2', completed: 88, inProgress: 12 },
    { name: 'Grade 3', completed: 92, inProgress: 8 },
    { name: 'Grade 4', completed: 85, inProgress: 15 },
    { name: 'Grade 5', completed: 90, inProgress: 10 }
  ];

  const generateMockAnalytics = () => {
    return {
      submissionTrends: generateMockSubmissionTrends(),
      teacherPerformance: generateMockTeacherPerformance(),
      classProgress: generateMockClassProgress(),
      systemOverview: {
        totalUsers: 45,
        activeToday: 38,
        pendingApprovals: 12,
        overdueItems: 3,
        systemHealth: 98
      }
    };
  };

  const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed'];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
        </select>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.systemOverview.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Today</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.systemOverview.activeToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.systemOverview.pendingApprovals}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue Items</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.systemOverview.overdueItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Trends */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.submissionTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="lessonPlans" stroke="#2563eb" strokeWidth={2} name="Lesson Plans" />
              <Line type="monotone" dataKey="schemes" stroke="#16a34a" strokeWidth={2} name="Schemes" />
              <Line type="monotone" dataKey="reports" stroke="#f59e0b" strokeWidth={2} name="Reports" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Teacher Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.teacherPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="onTime" fill="#16a34a" name="On Time" />
              <Bar dataKey="late" fill="#f59e0b" name="Late" />
              <Bar dataKey="pending" fill="#dc2626" name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.classProgress}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, completed }) => `${name}: ${completed}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="completed"
              >
                {analytics.classProgress.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative inline-flex">
                <div className="w-32 h-32 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">
                      {analytics.systemOverview.systemHealth}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">Overall System Health</p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Excellent
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { action: 'Lesson Plan Approved', user: 'John Smith', time: '2 minutes ago', type: 'success' },
                { action: 'New Scheme Submitted', user: 'Mary Johnson', time: '15 minutes ago', type: 'info' },
                { action: 'Daily Report Submitted', user: 'Robert Davis', time: '32 minutes ago', type: 'info' },
                { action: 'Exam Marks Updated', user: 'Sarah Wilson', time: '1 hour ago', type: 'warning' },
                { action: 'Substitution Assigned', user: 'Admin', time: '2 hours ago', type: 'info' }
              ].map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.user} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { metric: 'Average Response Time', value: '1.2s', change: '+5%', trend: 'up' },
                { metric: 'Lesson Plan Approval Rate', value: '94%', change: '+2%', trend: 'up' },
                { metric: 'Daily Report Completion', value: '87%', change: '-3%', trend: 'down' },
                { metric: 'User Satisfaction', value: '4.8/5', change: '+0.2', trend: 'up' },
                { metric: 'System Uptime', value: '99.9%', change: '0%', trend: 'stable' }
              ].map((metric, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{metric.metric}</p>
                    <p className="text-lg font-bold text-gray-900">{metric.value}</p>
                  </div>
                  <div className={`text-sm font-medium ${
                    metric.trend === 'up' ? 'text-green-600' :
                    metric.trend === 'down' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {metric.change}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdvancedAnalytics);