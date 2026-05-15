// src/components/ExpenseManagementModule.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, DollarSign, CheckCircle, XCircle, Clock, AlertCircle, 
  Edit, Trash2, Send, FileText, TrendingUp, Upload, Download,
  Calendar, Tag, Receipt, RefreshCw
} from 'lucide-react';
import * as api from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { formatISTDate, formatISTDateTime } from '../utils/dateUtils';

export default function ExpenseManagementModule({ user }) {
  const { theme } = useTheme();
  
  // Determine available tabs based on role
  const isadmin = user?.roles?.includes('admin') || user?.roles?.includes('admin');
  const isHM = user?.roles?.includes('hm') || user?.roles?.includes('HM');
  const isAccounts = user?.roles?.includes('accounts') || user?.roles?.includes('Accounts');
  const isTeacher = user?.roles?.includes('teacher') || user?.roles?.includes('Teacher') || user?.roles?.includes('class teacher');
  
  // Set default tab based on role
  const getDefaultTab = () => {
    if (isadmin || isHM) return 'all-transactions';
    if (isAccounts) return 'all-transactions';
    if (isTeacher) return 'my-expenses';
    return 'my-expenses';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab()); // my-expenses, create, approve, disburse
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const pollIntervalRef = useRef(null);

  // Load requests on mount and tab change
  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Set up polling interval (30 seconds)
    pollIntervalRef.current = setInterval(() => {
      loadRequests(true); // Silent refresh
    }, 30000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeTab]);

  async function loadRequests(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      
      if (activeTab === 'my-expenses') {
        const result = await api.getTeacherExpenseRequests(user.email);
        if (result.success === false && result.error) {
          setError(result.error);
        }
        setRequests(result.requests || []);
      } else if (activeTab === 'approve' || activeTab === 'disburse' || activeTab === 'all-transactions') {
        const result = await api.getAllExpenseRequests(user.email);
        if (result.success === false && result.error) {
          setError(result.error);
        }
        setRequests(result.requests || []);
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await loadRequests();
      setSuccess('Data refreshed successfully');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function getStatusColor(status) {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      'Pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      'Approved': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      'Disbursed': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  }

  function getStatusIcon(status) {
    const icons = {
      'Draft': <Edit className="w-4 h-4" />,
      'Pending': <Clock className="w-4 h-4" />,
      'Approved': <CheckCircle className="w-4 h-4" />,
      'Disbursed': <DollarSign className="w-4 h-4" />,
      'Rejected': <XCircle className="w-4 h-4" />
    };
    return icons[status] || <FileText className="w-4 h-4" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Expense & Reimbursement Management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Submit and track expense reimbursement requests • Auto-updates every 30s
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          {isTeacher && (
            <>
              <button
                onClick={() => setActiveTab('my-expenses')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'my-expenses'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  My Expenses
                </div>
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'create'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Request
                </div>
              </button>
            </>
          )}
          {(isadmin || isHM) && (
            <>
              <button
                onClick={() => setActiveTab('all-transactions')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'all-transactions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  All Transactions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('approve')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'approve'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </div>
              </button>
            </>
          )}
          {isAccounts && (
            <>
              <button
                onClick={() => setActiveTab('all-transactions')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'all-transactions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  All Transactions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('disburse')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'disburse'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Disburse
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-expenses' && <MyExpensesTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
      {activeTab === 'create' && <CreateExpenseTab onSuccess={(msg) => { setSuccess(msg); setActiveTab('my-expenses'); loadRequests(); }} onError={setError} user={user} />}
      {activeTab === 'approve' && <ApproveExpensesTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
      {activeTab === 'disburse' && <DisburseExpensesTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
      {activeTab === 'all-transactions' && <AllExpensesTab requests={requests} loading={loading} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} />}
    </div>
  );
}

// My Expenses Tab (Teacher View)
function MyExpensesTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  async function handleSubmit(requestId) {
    try {
      setSubmittingId(requestId);
      await api.submitExpenseRequest(requestId, user.email);
      onSuccess('Request submitted for approval');
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleDelete(requestId) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    
    try {
      await api.deleteExpenseRequest(requestId, user.email);
      onSuccess('Request deleted');
      onRefresh();
    } catch (err) {
      onError(err.message);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No expense requests yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Create your first request to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {request.reason}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Request ID: {request.requestId} • Category: {request.category || 'General'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{request.amount}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expense Date</p>
              <p className="text-sm text-gray-900 dark:text-white">{formatISTDate(request.expenseDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Submitted</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {request.submittedAt ? formatISTDateTime(request.submittedAt) : '-'}
              </p>
            </div>
            {request.disbursedAt && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disbursed</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatISTDateTime(request.disbursedAt)}
                </p>
              </div>
            )}
          </div>

          {request.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Notes: {request.notes}
            </p>
          )}

          {request.receiptUrl && (
            <a
              href={request.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
            >
              <Download className="w-4 h-4" />
              View Receipt
            </a>
          )}

          {request.rejectionReason && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              Rejection Reason: {request.rejectionReason}
            </p>
          )}

          {request.disbursementMode && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Payment Mode: {request.disbursementMode}
              {request.disbursementReference && ` (Ref: ${request.disbursementReference})`}
            </p>
          )}

          <div className="flex gap-2">
            {request.status === 'Draft' && (
              <>
                <button
                  onClick={() => handleSubmit(request.requestId)}
                  disabled={submittingId === request.requestId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {submittingId === request.requestId ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  onClick={() => handleDelete(request.requestId)}
                  disabled={submittingId === request.requestId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Create Expense Tab
function CreateExpenseTab({ onSuccess, onError, user }) {
  const [formData, setFormData] = useState({
    amount: '',
    reason: '',
    category: 'General',
    expenseDate: new Date().toISOString().split('T')[0],
    receiptUrl: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const result = await api.getExpenseCategories();
      setCategories(result.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories(['General', 'Travel', 'Materials', 'Other']);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSubmitting(true);
      const payload = {
        teacherEmail: user.email,
        amount: Number(formData.amount),
        reason: formData.reason,
        category: formData.category,
        expenseDate: formData.expenseDate,
        receiptUrl: formData.receiptUrl,
        notes: formData.notes
      };

      await api.createExpenseRequest(payload);
      onSuccess('Expense request created successfully');
      
      // Reset form
      setFormData({
        amount: '',
        reason: '',
        category: 'General',
        expenseDate: new Date().toISOString().split('T')[0],
        receiptUrl: '',
        notes: ''
      });
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Create New Expense Request</h3>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="1000"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Expense <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="e.g., Transportation for field trip"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Expense Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.expenseDate}
            onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Receipt URL (Optional)
          </label>
          <input
            type="url"
            value={formData.receiptUrl}
            onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
            placeholder="https://drive.google.com/..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Upload receipt to Google Drive and paste link here
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional details..."
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {submitting ? 'Creating...' : 'Create Request'}
        </button>
      </div>
    </form>
  );
}

// Approve Expenses Tab (HM)
function ApproveExpensesTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const pendingRequests = requests.filter(r => r.status === 'Pending');

  async function handleDelete(requestId) {
    if (!window.confirm('Are you sure you want to delete this expense request? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(requestId);
      await api.adminDeleteExpenseRequest(requestId, user.email);
      onSuccess('Request deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Error deleting request:', error);
      onError(error.message || 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAction() {
    if (!selectedRequest) return;

    try {
      setProcessing(true);

      if (actionType === 'approve') {
        await api.approveExpenseRequest(selectedRequest.requestId, user.email, reason);
        onSuccess('Request approved successfully');
      } else if (actionType === 'reject') {
        if (!reason) {
          onError('Please provide a rejection reason');
          return;
        }
        await api.rejectExpenseRequest(selectedRequest.requestId, user.email, reason);
        onSuccess('Request rejected');
      }

      setSelectedRequest(null);
      setActionType(null);
      setReason('');
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No pending expense requests</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendingRequests.map((request) => (
          <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {request.reason}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Request ID: {request.requestId} • Teacher: {request.teacherName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{request.amount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{request.category}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expense Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatISTDate(request.expenseDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Submitted</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatISTDateTime(request.submittedAt)}
                </p>
              </div>
            </div>

            {request.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Notes: {request.notes}
              </p>
            )}

            {request.receiptUrl && (
              <a
                href={request.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
              >
                <Download className="w-4 h-4" />
                View Receipt
              </a>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setSelectedRequest(request); setActionType('approve'); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => { setSelectedRequest(request); setActionType('reject'); }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => handleDelete(request.requestId)}
                disabled={deletingId === request.requestId}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deletingId === request.requestId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Action Modal */}
      {selectedRequest && actionType && (
        <ActionModal
          request={selectedRequest}
          actionType={actionType}
          reason={reason}
          setReason={setReason}
          processing={processing}
          onConfirm={handleAction}
          onCancel={() => { setSelectedRequest(null); setActionType(null); setReason(''); }}
        />
      )}
    </>
  );
}

// Disburse Expenses Tab (Accounts)
function DisburseExpensesTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [disbursementMode, setDisbursementMode] = useState('');
  const [disbursementReference, setDisbursementReference] = useState('');
  const [processing, setProcessing] = useState(false);

  const approvedRequests = requests.filter(r => r.status === 'Approved');
  const disbursedRequests = requests.filter(r => r.status === 'Disbursed');

  async function handleDisburse() {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      await api.disburseExpense(selectedRequest.requestId, user.email, disbursementMode, disbursementReference);
      onSuccess('Expense disbursed successfully');
      
      setSelectedRequest(null);
      setDisbursementMode('');
      setDisbursementReference('');
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Disbursements */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pending Disbursements ({approvedRequests.length})
          </h3>
          {approvedRequests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No pending disbursements</p>
          ) : (
            <div className="space-y-4">
              {approvedRequests.map((request) => (
                <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {request.reason}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Request ID: {request.requestId} • Teacher: {request.teacherName} ({request.teacherEmail})
                      </p>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{request.amount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category</p>
                          <p className="text-sm text-gray-900 dark:text-white">{request.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expense Date</p>
                          <p className="text-sm text-gray-900 dark:text-white">{formatISTDate(request.expenseDate)}</p>
                        </div>
                      </div>
                      {request.receiptUrl && (
                        <a
                          href={request.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
                        >
                          <Download className="w-4 h-4" />
                          View Receipt
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Disburse
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Disbursements */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Disbursements ({disbursedRequests.slice(0, 10).length})
          </h3>
          {disbursedRequests.slice(0, 10).map((request) => (
            <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{request.reason}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {request.teacherName} • ₹{request.amount} • {request.disbursementMode || 'N/A'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disbursement Modal */}
      {selectedRequest && (
        <DisburseModal
          request={selectedRequest}
          disbursementMode={disbursementMode}
          setDisbursementMode={setDisbursementMode}
          disbursementReference={disbursementReference}
          setDisbursementReference={setDisbursementReference}
          processing={processing}
          onConfirm={handleDisburse}
          onCancel={() => {
            setSelectedRequest(null);
            setDisbursementMode('');
            setDisbursementReference('');
          }}
        />
      )}
    </>
  );
}

// Action Modal (Approve/Reject)
function ActionModal({ request, actionType, reason, setReason, processing, onConfirm, onCancel }) {
  const titles = {
    approve: 'Approve Expense Request',
    reject: 'Reject Expense Request'
  };

  const colors = {
    approve: 'bg-green-600 hover:bg-green-700',
    reject: 'bg-red-600 hover:bg-red-700'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {titles[actionType]}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Request: {request.reason} (₹{request.amount})
        </p>

        {actionType === 'reject' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Provide reason for rejection..."
              required
            />
          </div>
        )}

        {actionType === 'approve' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Add any approval notes..."
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 px-4 py-2 ${colors[actionType]} text-white rounded-lg font-medium disabled:opacity-50`}
          >
            {processing ? 'Processing...' : 'Confirm'}
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// All Expenses Tab (HM and Accounts View)
function AllExpensesTab({ requests, loading, getStatusColor, getStatusIcon, user, onRefresh, onSuccess, onError }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const isHM = user && (user.roles?.includes('hm') || user.roles?.includes('admin'));

  async function handleDelete(requestId) {
    if (!window.confirm('Are you sure you want to delete this expense request? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(requestId);
      await api.adminDeleteExpenseRequest(requestId, user.email);
      onSuccess('Request deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Error deleting request:', error);
      onError(error.message || 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  }

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchCategory = String(r.category || '').toLowerCase().includes(query);
      const matchReason = String(r.reason || '').toLowerCase().includes(query);
      const matchTeacher = String(r.teacherName || '').toLowerCase().includes(query);
      const matchTeacherEmail = String(r.teacherEmail || '').toLowerCase().includes(query);
      const matchRequestId = String(r.requestId || '').toLowerCase().includes(query);
      if (!matchCategory && !matchReason && !matchTeacher && !matchTeacherEmail && !matchRequestId) return false;
    }
    return true;
  });

  // Group by status
  const statusCounts = {
    'Draft': requests.filter(r => r.status === 'Draft').length,
    'Pending': requests.filter(r => r.status === 'Pending').length,
    'Approved': requests.filter(r => r.status === 'Approved').length,
    'Disbursed': requests.filter(r => r.status === 'Disbursed').length,
    'Rejected': requests.filter(r => r.status === 'Rejected').length
  };

  // Calculate total disbursed amount
  const totalDisbursed = requests
    .filter(r => r.status === 'Disbursed')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // Calculate total approved (not yet disbursed)
  const totalApproved = requests
    .filter(r => r.status === 'Approved')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // Calculate total pending
  const totalPending = requests
    .filter(r => r.status === 'Pending')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading transactions...</p>
      </div>
    );
  }

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{status}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Disbursed</p>
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100">₹{totalDisbursed.toLocaleString()}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{statusCounts['Disbursed']} requests completed</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Approved (Pending Disbursement)</p>
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">₹{totalApproved.toLocaleString()}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{statusCounts['Approved']} requests awaiting payment</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Approval</p>
          </div>
          <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">₹{totalPending.toLocaleString()}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">{statusCounts['Pending']} requests awaiting approval</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Disbursed">Disbursed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search (Category, Reason, Teacher, ID)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by category, reason, teacher name or request ID..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
          </div>
        )}

        {filteredRequests.map((request) => (
          <div
            key={request.requestId}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {request.reason}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Request ID: {request.requestId} • Teacher: {request.teacherName} ({request.teacherEmail})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{request.amount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category</p>
                <p className="text-sm text-gray-900 dark:text-white">{request.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expense Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatISTDate(request.expenseDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatISTDate(request.createdAt)}</p>
              </div>
            </div>

            {request.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Notes: {request.notes}
              </p>
            )}

            {request.receiptUrl && (
              <a
                href={request.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
              >
                <Download className="w-4 h-4" />
                View Receipt
              </a>
            )}

            {/* Show approval details */}
            {request.approvedBy && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Approved by: {request.approvedBy} • {formatISTDateTime(request.approvedAt)}
                </p>
              </div>
            )}

            {/* Show disbursement details */}
            {request.disbursedBy && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disbursed by</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{request.disbursedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date</p>
                    <p className="text-sm text-gray-900 dark:text-white">{formatISTDateTime(request.disbursedAt)}</p>
                  </div>
                  {request.disbursementMode && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Mode</p>
                      <p className="text-sm text-gray-900 dark:text-white">{request.disbursementMode}</p>
                    </div>
                  )}
                  {request.disbursementReference && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reference</p>
                      <p className="text-sm text-gray-900 dark:text-white">{request.disbursementReference}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show rejection details */}
            {request.rejectedBy && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Rejected by: {request.rejectedBy} • {formatISTDateTime(request.rejectedAt)}
                </p>
                {request.rejectionReason && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Reason: {request.rejectionReason}
                  </p>
                )}
              </div>
            )}

            {/* HM Delete Button */}
            {isHM && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <button
                  onClick={() => handleDelete(request.requestId)}
                  disabled={deletingId === request.requestId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingId === request.requestId ? 'Deleting...' : 'Delete Request'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// Disburse Modal
function DisburseModal({ request, disbursementMode, setDisbursementMode, disbursementReference, setDisbursementReference, processing, onConfirm, onCancel }) {
  const modes = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Other'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Disburse Expense
        </h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Request: {request.reason}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Teacher: {request.teacherName} • Amount: <span className="font-semibold">₹{request.amount}</span>
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={disbursementMode}
              onChange={(e) => setDisbursementMode(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">Select mode...</option>
              {modes.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reference/Transaction ID (Optional)
            </label>
            <input
              type="text"
              value={disbursementReference}
              onChange={(e) => setDisbursementReference(e.target.value)}
              placeholder="Cheque number, transaction ID, etc."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={processing || !disbursementMode}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Confirm Disbursement'}
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
