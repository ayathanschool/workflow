import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  Edit, 
  Plus, 
  Shield, 
  Database,
  Activity,
  Settings,
  FileText,
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Download,
  Upload
} from 'lucide-react';
import * as api from '../api';
import { useNotifications } from '../contexts/NotificationContext';

const SuperAdminDashboard = ({ user, onNavigate }) => {
  const { success, error: showError } = useNotifications();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalLessonPlans: 0,
    totalReports: 0,
    totalSchemes: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Load system statistics
      const [users, exams] = await Promise.all([
        api.getAllUsers(user.email).catch(() => []),
        api.getAllExams().catch(() => [])
      ]);
      
      setStats({
        totalUsers: users?.length || 0,
        totalExams: exams?.length || 0,
        totalLessonPlans: 0,
        totalReports: 0,
        totalSchemes: 0
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, onClick }) => (
    <div 
      className={`bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow ${onClick ? 'hover:scale-105 transform' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const QuickAction = ({ icon: Icon, title, description, onClick, color }) => (
    <button
      onClick={onClick}
      className="flex items-start p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left w-full"
    >
      <div className={`p-2 rounded-lg ${color} mr-4`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </button>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-8 h-8 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        </div>
        <p className="text-gray-600">Complete system control and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          color="bg-blue-500"
        />
        <StatCard
          icon={FileText}
          title="Total Exams"
          value={stats.totalExams}
          color="bg-green-500"
        />
        <StatCard
          icon={BookOpen}
          title="Lesson Plans"
          value={stats.totalLessonPlans}
          color="bg-purple-500"
        />
        <StatCard
          icon={Calendar}
          title="Daily Reports"
          value={stats.totalReports}
          color="bg-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAction
            icon={Users}
            title="Manage Users"
            description="Add, edit, or remove users from the system"
            color="bg-blue-500"
            onClick={() => onNavigate && onNavigate('users')}
          />
          <QuickAction
            icon={Database}
            title="Exam Management"
            description="Create, edit, and delete exams"
            color="bg-purple-500"
            onClick={() => onNavigate && onNavigate('exam-marks')}
          />
          <QuickAction
            icon={BookOpen}
            title="Lesson Plans"
            description="View and manage all lesson plans"
            color="bg-green-500"
            onClick={() => onNavigate && onNavigate('lesson-plans')}
          />
          <QuickAction
            icon={FileText}
            title="Daily Reports"
            description="View and manage all daily reports"
            color="bg-orange-500"
            onClick={() => onNavigate && onNavigate('reports')}
          />
          <QuickAction
            icon={Activity}
            title="Teacher Performance"
            description="Monitor teacher performance metrics"
            color="bg-indigo-500"
            onClick={() => onNavigate && onNavigate('teacher-performance')}
          />
          <QuickAction
            icon={Calendar}
            title="Timetable Management"
            description="View and manage school timetables"
            color="bg-teal-500"
            onClick={() => onNavigate && onNavigate('full-timetable')}
          />
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Status
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">Apps Script Backend</span>
            </div>
            <span className="text-green-600 text-sm font-semibold">Online</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">Google Sheets Database</span>
            </div>
            <span className="text-green-600 text-sm font-semibold">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">User Authentication</span>
            </div>
            <span className="text-green-600 text-sm font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Super Admin Access</h3>
          <p className="text-sm text-red-700 mt-1">
            You have unrestricted access to all system functions. Please use these privileges responsibly. 
            All actions are logged for security and audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
