import React, { useMemo, useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Activity,
  Calendar,
  AlertCircle,
  CheckCircle,
  CheckSquare,
  LayoutList,
  GraduationCap,
  ClipboardCheck,
  Edit2,
  FileCheck,
  DollarSign
} from 'lucide-react';
import * as api from '../api';
import { useNotifications } from '../contexts/NotificationContext';

const SuperAdminDashboard = ({ user, onNavigate }) => {
  const { success, error: showError } = useNotifications();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalSchemes: 0
  });
  const [loading, setLoading] = useState(false);

  const [pendingExamMarks, setPendingExamMarks] = useState({ loading: false, rows: [] });

  const isSuperAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.includes('super admin') || roles.includes('superadmin') || roles.includes('super_admin');
  }, [user]);

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
        totalSchemes: 0
      });

      // Pending-only list (server-side computed for all exams)
      try {
        setPendingExamMarks({ loading: true, rows: [] });
        const res = await api.getExamMarksEntryPending({ limit: 20 });
        setPendingExamMarks({ loading: false, rows: res?.pending || [] });
      } catch (e) {
        console.warn('Failed to load pending exam marks:', e);
        setPendingExamMarks({ loading: false, rows: [] });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = useMemo(() => (pendingExamMarks.rows || []).length, [pendingExamMarks.rows]);

  const StatCard = ({ icon: Icon, title, value, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-2">
            {loading ? '…' : value}
          </p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </div>
      </div>
    </button>
  );

  const QuickAction = ({ icon: Icon, title, description, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-start p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 mr-4 flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </button>
  );

  const ActionSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-7 h-7 text-gray-800 dark:text-gray-100" />
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">Super Admin</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              System overview and administrative tools
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Signed in as</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name || user?.email}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          title="Users"
          value={stats.totalUsers}
          onClick={() => onNavigate && onNavigate('users')}
        />
        <StatCard
          icon={FileCheck}
          title="Exams"
          value={stats.totalExams}
          onClick={() => onNavigate && onNavigate('exam-marks')}
        />
        <StatCard
          icon={DollarSign}
          title="Fee Collection"
          value="Open"
          onClick={() => onNavigate && onNavigate('fee-collection')}
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionSection title="Approvals" icon={CheckSquare}>
          <QuickAction
            icon={LayoutList}
            title="Scheme Approvals"
            description="Review and approve scheme of work submissions"
            onClick={() => onNavigate && onNavigate('scheme-approvals')}
          />
          <QuickAction
            icon={ClipboardCheck}
            title="Lesson Plan Approvals"
            description="Review and approve lesson plan submissions"
            onClick={() => onNavigate && onNavigate('lesson-approvals')}
          />
        </ActionSection>

        <ActionSection title="Administration" icon={GraduationCap}>
          <QuickAction
            icon={Edit2}
            title="Admin Data"
            description="Edit system master data (Sheets)"
            onClick={() => onNavigate && onNavigate('admin-data')}
          />
          <QuickAction
            icon={Calendar}
            title="Timetable"
            description="View full timetable"
            onClick={() => onNavigate && onNavigate('full-timetable')}
          />
        </ActionSection>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          System Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Backend</span>
            </div>
            <span className="text-green-700 dark:text-green-400 text-sm font-semibold">Online</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Database</span>
            </div>
            <span className="text-green-700 dark:text-green-400 text-sm font-semibold">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Auth</span>
            </div>
            <span className="text-green-700 dark:text-green-400 text-sm font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Exam Marks Entry Pending */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Exam Marks Entry Pending</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Shows only exams where pending &gt; 0 (if a subject is fully entered, it will not appear here)</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('exam-marks')}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Open Exams
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending Exams: {pendingExamMarks.loading ? '…' : pendingCount}
          </span>
        </div>

        {pendingExamMarks.loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading pending list…</div>
        ) : (pendingExamMarks.rows || []).length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No pending exam marks. ✅</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Exam</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Marks</th>
                  <th className="py-2 pr-4">Pending</th>
                </tr>
              </thead>
              <tbody>
                {pendingExamMarks.rows.slice(0, 10).map((r) => {
                  return (
                    <tr key={r.examId} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">{r.examType || r.examId}</td>
                      <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">{r.class || ''}</td>
                      <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">{r.subject || ''}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          {(r.enteredCount ?? 0)}/{(r.totalStudents ?? 0)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.missingCount ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      {isSuperAdmin && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">Super Admin Access</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Changes can affect the whole school system. Actions are audit-logged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
