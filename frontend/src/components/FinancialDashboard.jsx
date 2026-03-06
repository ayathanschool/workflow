// src/components/FinancialDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, 
  AlertCircle, Users, Calendar, FileText, ArrowRight, BarChart3,
  Download, RefreshCw
} from 'lucide-react';
import * as api from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { formatISTDate, formatISTDateTime } from '../utils/dateUtils';

export default function FinancialDashboard({ user }) {
  const { theme } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Determine user role
  const isHM = user?.roles?.includes('hm') || user?.roles?.includes('admin');
  const isAccounts = user?.roles?.includes('accounts');
  const isTeacher = user?.roles?.includes('teacher');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      if (isHM) {
        result = await api.getAdminFinancialDashboard(user.email);
      } else if (isAccounts) {
        result = await api.getAccountsFinancialDashboard(user.email);
      } else if (isTeacher) {
        result = await api.getTeacherFinancialDashboard(user.email);
      }

      setDashboard(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button 
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Financial Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {dashboard?.role} • Overview of fund collections and expenses
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Role-specific Dashboard */}
      {isHM && dashboard && <AdminDashboard data={dashboard} />}
      {isAccounts && dashboard && <AccountsDashboard data={dashboard} />}
      {isTeacher && dashboard && <TeacherDashboard data={dashboard} />}
    </div>
  );
}

// HM Dashboard
function AdminDashboard({ data }) {
  const stats = data.stats || {};
  const pendingActions = data.pendingActions || {};
  const recentActivity = data.recentActivity || {};

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Approvals"
          value={stats.totalPendingApprovals || 0}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
          subtitle="Requires action"
        />
        <StatCard
          title="Fund Requests"
          value={stats.pendingFundRequests || 0}
          icon={<TrendingUp className="w-6 h-6" />}
          color="blue"
          subtitle={`₹${stats.pendingFundAmount || 0}`}
        />
        <StatCard
          title="Expense Requests"
          value={stats.pendingExpenseRequests || 0}
          icon={<TrendingDown className="w-6 h-6" />}
          color="purple"
          subtitle={`₹${stats.pendingExpenseAmount || 0}`}
        />
        <StatCard
          title="Recent Approvals"
          value={(stats.recentFundApprovals || 0) + (stats.recentExpenseApprovals || 0)}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
          subtitle="Last 30 days"
        />
      </div>

      {/* Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fund Collection Requests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Fund Requests
            </h3>
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-medium">
              {pendingActions.fundRequests?.length || 0}
            </span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(pendingActions.fundRequests || []).slice(0, 5).map((request) => (
              <div key={request.requestId} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {request.purpose}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {request.teacherName} • {request.class}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    ₹{request.expectedAmount}
                  </p>
                </div>
              </div>
            ))}
            {(pendingActions.fundRequests?.length || 0) === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No pending fund requests
              </p>
            )}
          </div>
        </div>

        {/* Expense Requests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Expense Requests
            </h3>
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-medium">
              {pendingActions.expenseRequests?.length || 0}
            </span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(pendingActions.expenseRequests || []).slice(0, 5).map((request) => (
              <div key={request.requestId} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {request.reason}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {request.teacherName} • {request.category}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    ₹{request.amount}
                  </p>
                </div>
              </div>
            ))}
            {(pendingActions.expenseRequests?.length || 0) === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No pending expense requests
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[
            ...(recentActivity.fundApprovals || []).slice(0, 3).map(r => ({
              type: 'fund',
              action: 'approved',
              data: r,
              timestamp: r.approvedAt
            })),
            ...(recentActivity.expenseApprovals || []).slice(0, 3).map(r => ({
              type: 'expense',
              action: 'approved',
              data: r,
              timestamp: r.approvedAt
            }))
          ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5)
            .map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className={`p-2 rounded-full ${activity.type === 'fund' ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                  {activity.type === 'fund' ? (
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.type === 'fund' ? 'Fund Collection' : 'Expense'} Approved
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.data.purpose || activity.data.reason} • ₹{activity.data.expectedAmount || activity.data.amount}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatISTDate(activity.timestamp)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Accounts Dashboard
function AccountsDashboard({ data }) {
  const stats = data.stats || {};
  const pendingActions = data.pendingActions || {};

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Actions"
          value={stats.totalPendingActions || 0}
          icon={<AlertCircle className="w-6 h-6" />}
          color="yellow"
          subtitle="Requires attention"
        />
        <StatCard
          title="To Disburse"
          value={stats.pendingDisbursements || 0}
          icon={<TrendingDown className="w-6 h-6" />}
          color="red"
          subtitle={`₹${stats.pendingDisbursementAmount || 0}`}
        />
        <StatCard
          title="To Acknowledge"
          value={stats.pendingAcknowledgments || 0}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          subtitle={`₹${stats.pendingAcknowledgmentAmount || 0}`}
        />
        <StatCard
          title="Active Collections"
          value={stats.approvedFundCollections || 0}
          icon={<Clock className="w-6 h-6" />}
          color="blue"
          subtitle="In progress"
        />
      </div>

      {/* Pending Disbursements */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Expenses to Disburse
          </h3>
          <span className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
            {pendingActions.expensesToDisburse?.length || 0}
          </span>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(pendingActions.expensesToDisburse || []).map((request) => (
            <div key={request.requestId} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.reason}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {request.teacherName} • {request.category}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    ₹{request.amount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatISTDate(request.approvedAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {(pendingActions.expensesToDisburse?.length || 0) === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No pending disbursements
            </p>
          )}
        </div>
      </div>

      {/* Funds to Acknowledge */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Funds to Acknowledge
          </h3>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
            {pendingActions.fundsToAcknowledge?.length || 0}
          </span>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(pendingActions.fundsToAcknowledge || []).map((request) => (
            <div key={request.requestId} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.purpose}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {request.teacherName} • {request.class}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">₹{request.expectedAmount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 mt-2">Collected</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">₹{request.collectedAmount}</p>
                </div>
              </div>
            </div>
          ))}
          {(pendingActions.fundsToAcknowledge?.length || 0) === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No funds pending acknowledgment
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Teacher Dashboard
function TeacherDashboard({ data }) {
  const stats = data.stats || {};
  const fundRequests = data.fundRequests || [];
  const expenseRequests = data.expenseRequests || [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Fund Requests"
          value={stats.totalFundRequests || 0}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          subtitle={`₹${stats.totalFundExpected || 0} expected`}
        />
        <StatCard
          title="Expense Requests"
          value={stats.totalExpenseRequests || 0}
          icon={<TrendingDown className="w-6 h-6" />}
          color="blue"
          subtitle={`₹${stats.totalExpenseApproved || 0} approved`}
        />
        <StatCard
          title="Pending Approval"
          value={(stats.pendingFundRequests || 0) + (stats.pendingExpenseRequests || 0)}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
          subtitle="Awaiting decision"
        />
        <StatCard
          title="Completed"
          value={(stats.completedFundRequests || 0) + (stats.disbursedExpenses || 0)}
          icon={<CheckCircle className="w-6 h-6" />}
          color="purple"
          subtitle="Closed requests"
        />
      </div>

      {/* Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Fund Requests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Fund Requests
            </h3>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
              {fundRequests.length}
            </span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {fundRequests.slice(0, 5).map((request) => (
              <div key={request.requestId} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {request.purpose}
                  </p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {request.class} • ₹{request.expectedAmount}
                </p>
              </div>
            ))}
            {fundRequests.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No fund requests yet
              </p>
            )}
          </div>
        </div>

        {/* Recent Expense Requests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Expense Requests
            </h3>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
              {expenseRequests.length}
            </span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {expenseRequests.slice(0, 5).map((request) => (
              <div key={request.requestId} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {request.reason}
                  </p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {request.category} • ₹{request.amount}
                </p>
              </div>
            ))}
            {expenseRequests.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No expense requests yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Stat Card Component
function StatCard({ title, value, icon, color, subtitle }) {
  const colors = {
    yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400',
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }) {
  const colors = {
    'Draft': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    'Pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    'Revised': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    'Approved': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'Completed': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    'Disbursed': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors['Draft']}`}>
      {status}
    </span>
  );
}
