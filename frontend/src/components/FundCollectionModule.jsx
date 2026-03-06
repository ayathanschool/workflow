// src/components/FundCollectionModule.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Calendar, Users, DollarSign, CheckCircle, XCircle, 
  Clock, AlertCircle, Edit, Trash2, Send, CheckSquare, Square,
  FileText, TrendingUp, Download, RefreshCw
} from 'lucide-react';
import * as api from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { formatISTDate, formatISTDateTime, formatDateRange } from '../utils/dateUtils';
import StudentPaymentModal from './StudentPaymentModal';

export default function FundCollectionModule({ user }) {
  const { theme } = useTheme();
  
  // Determine available tabs based on role
  // Case-insensitive role checking (roles can be string or array)
  const rolesStr = Array.isArray(user?.roles) 
    ? user.roles.join(',').toLowerCase() 
    : String(user?.roles || '').toLowerCase();
  const isAdmin = rolesStr.includes('admin');
  const isHM = rolesStr.includes('hm') || rolesStr.includes('headmaster');
  const isAccounts = rolesStr.includes('accounts');
  const isTeacher = rolesStr.includes('teacher') || rolesStr.includes('class teacher');
  
  // Set default tab based on role
  const getDefaultTab = () => {
    if (isAdmin || isHM) return 'approve';
    if (isAccounts) return 'all-transactions';
    if (isTeacher) return 'my-requests';
    return 'my-requests';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab()); // my-requests, create, approve, accounts
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
      
      // Add cache-busting timestamp to force fresh data
      const cacheBuster = Date.now();
      
      console.log('[FundCollection] Loading requests for tab:', activeTab, 'user:', user.email);
      
      if (activeTab === 'my-requests') {
        const result = await api.getTeacherFundRequests(user.email, cacheBuster);
        console.log('[FundCollection] Teacher requests result:', result);
        setRequests(result.requests || []);
      } else if (activeTab === 'approve' || activeTab === 'accounts' || activeTab === 'all-transactions') {
        const result = await api.getAllFundRequests(user.email, cacheBuster);
        console.log('[FundCollection] All requests result:', result);
        console.log('[FundCollection] All requests count:', result.requests?.length || 0);
        setRequests(result.requests || []);
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[FundCollection] Error loading requests:', err);
      if (!silent) {
        setError(err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function handleManualRefresh() {
    try {
      setRefreshing(true);
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
      'Revised': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      'Approved': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      'Completed': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  }

  function getStatusIcon(status) {
    const icons = {
      'Draft': <Edit className="w-4 h-4" />,
      'Pending': <Clock className="w-4 h-4" />,
      'Revised': <AlertCircle className="w-4 h-4" />,
      'Approved': <CheckCircle className="w-4 h-4" />,
      'In Progress': <TrendingUp className="w-4 h-4" />,
      'Completed': <CheckCircle className="w-4 h-4" />,
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
              Fund Collection Management
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
          Manage student fund collection requests and approvals • Auto-updates every 30s
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
                onClick={() => setActiveTab('my-requests')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'my-requests'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  My Requests
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
                  Create Request
                </div>
              </button>
            </>
          )}
          {(isAdmin || isHM) && (
            <>
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
                  Approve Requests
                </div>
              </button>
              <button
                onClick={() => setActiveTab('all-transactions')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'all-transactions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  All Transactions
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
                  <FileText className="w-4 h-4" />
                  All Transactions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('accounts')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'accounts'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Accounts
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-requests' && <MyRequestsTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
      {activeTab === 'create' && <CreateRequestTab onSuccess={(msg) => { setSuccess(msg); setActiveTab('my-requests'); loadRequests(); }} onError={setError} user={user} />}
      {activeTab === 'approve' && <ApproveRequestsTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
      {activeTab === 'all-transactions' && <AllTransactionsTab requests={requests} loading={loading} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} />}
      {activeTab === 'accounts' && <AccountsTab requests={requests} loading={loading} onRefresh={loadRequests} onSuccess={setSuccess} onError={setError} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} user={user} />}
    </div>
  );
}

// My Requests Tab (Teacher View)
function MyRequestsTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [depositModalRequest, setDepositModalRequest] = useState(null);
  const [deposits, setDeposits] = useState({});
  const [loadingDeposits, setLoadingDeposits] = useState({});
  const [studentPaymentModalRequest, setStudentPaymentModalRequest] = useState(null);
  const [studentPayments, setStudentPayments] = useState({});
  const [loadingPayments, setLoadingPayments] = useState({});
  const [markingPayment, setMarkingPayment] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [loadingTrackPayments, setLoadingTrackPayments] = useState(null);
  const [bulkMarkingPaid, setBulkMarkingPaid] = useState(false);
  const [loadingDepositModal, setLoadingDepositModal] = useState(null);

  async function handleSubmit(requestId) {
    try {
      setSubmittingId(requestId);
      await api.submitFundCollectionRequest(requestId, user.email);
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
      await api.deleteFundCollectionRequest(requestId, user.email);
      onSuccess('Request deleted');
      onRefresh();
    } catch (err) {
      onError(err.message);
    }
  }

  async function handleStartCollection(requestId) {
    try {
      setStartingId(requestId);
      await api.startFundCollection(requestId, user.email);
      onSuccess('Collection started');
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setStartingId(null);
    }
  }

  async function handleCompleteCollection(requestId, collectedAmount) {
    // Check if all deposits are acknowledged
    const requestDeposits = deposits[requestId] || [];
    const unacknowledged = requestDeposits.filter(d => !d.isAcknowledged);
    
    if (unacknowledged.length > 0) {
      onError(`Cannot complete: ${unacknowledged.length} deposit(s) pending acknowledgment from accounts`);
      return;
    }

    try {
      await api.completeFundCollection(requestId, user.email, collectedAmount, new Date().toISOString().split('T')[0]);
      onSuccess('Collection completed, awaiting accounts acknowledgment');
      onRefresh();
      setSelectedRequest(null);
    } catch (err) {
      onError(err.message);
    }
  }

  function canCompleteCollection(request) {
    // If no deposits exist yet, can complete normally
    const requestDeposits = deposits[request.requestId];
    if (!requestDeposits) return true; // Haven't loaded yet, allow
    if (requestDeposits.length === 0) return true; // No deposits, allow

    // If deposits exist, all must be acknowledged
    return requestDeposits.every(d => d.isAcknowledged);
  }

  async function loadDeposits(requestId, forceRefresh = false) {
    if (deposits[requestId] && !forceRefresh) return; // Already loaded unless forced
    
    try {
      setLoadingDeposits(prev => ({ ...prev, [requestId]: true }));
      const result = await api.getFundDeposits(requestId, Date.now()); // Always use cache busting
      setDeposits(prev => ({ ...prev, [requestId]: result }));
    } catch (err) {
      console.error('Error loading deposits:', err);
    } finally {
      setLoadingDeposits(prev => ({ ...prev, [requestId]: false }));
    }
  }

  async function handleAddDeposit(requestId, depositAmount, depositDate, notes) {
    try {
      await api.addFundDeposit(requestId, user.email, depositAmount, depositDate, notes);
      onSuccess('Deposit added successfully');
      // Force reload deposits and requests with cache busting
      await loadDeposits(requestId, true); // Force refresh with cache busting
      // Force full refresh of requests to get updated totalDeposited
      await loadRequests(false);
      setDepositModalRequest(null);
    } catch (err) {
      onError(err.message);
    }
  }

  async function loadStudentPayments(requestId, forceRefresh = false) {
    if (studentPayments[requestId] && !forceRefresh) return;
    
    try {
      setLoadingPayments(prev => ({ ...prev, [requestId]: true }));
      const result = await api.getStudentPayments(requestId);
      setStudentPayments(prev => ({ ...prev, [requestId]: result }));
    } catch (err) {
      console.error('Error loading student payments:', err);
      onError('Failed to load student payments');
    } finally {
      setLoadingPayments(prev => ({ ...prev, [requestId]: false }));
    }
  }

  async function handleMarkStudentPaid(paymentId, requestId, defaultAmount) {
    const customAmount = prompt(`Enter amount paid (default: ₹${defaultAmount}):`, defaultAmount);
    if (customAmount === null) return; // Cancelled
    
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 0) {
      onError('Invalid amount');
      return;
    }

    try {
      setMarkingPayment(paymentId);
      await api.markStudentPayment(paymentId, amount, user.email, '');
      onSuccess('Student payment marked successfully');
      await loadStudentPayments(requestId, true);
      await loadRequests(false); // Force full refresh to update totalDeposited
    } catch (err) {
      onError(err.message);
    } finally {
      setMarkingPayment(null);
    }
  }

  async function handleUpdateStudentPayment(paymentId, requestId, currentAmount) {
    const newAmount = prompt(`Update amount paid (current: ₹${currentAmount}):`, currentAmount);
    if (newAmount === null) return;
    
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) {
      onError('Invalid amount');
      return;
    }

    try {
      setMarkingPayment(paymentId);
      await api.updateStudentPayment(paymentId, amount, '');
      onSuccess('Payment updated successfully');
      await loadStudentPayments(requestId, true);
      await loadRequests(false); // Force full refresh to update totalDeposited
    } catch (err) {
      onError(err.message);
    } finally {
      setMarkingPayment(null);
    }
  }

  async function handleBulkMarkPaid(requestId) {
    if (selectedStudents.size === 0) {
      onError('Please select at least one student');
      return;
    }

    const data = studentPayments[requestId];
    if (!data) return;

    const payments = data.students
      .filter(s => selectedStudents.has(s.paymentId) && s.paymentStatus === 'Pending')
      .map(s => ({
        studentAdmNo: s.studentAdmNo,
        paidAmount: s.expectedAmount,
        notes: ''
      }));

    if (payments.length === 0) {
      onError('No pending payments selected');
      return;
    }

    try {
      setBulkMarkingPaid(true);
      await api.bulkMarkStudentPayments(requestId, payments, user.email);
      onSuccess(`${payments.length} students marked as paid`);
      setSelectedStudents(new Set());
      await loadStudentPayments(requestId, true);
      await loadRequests(false); // Force full refresh to update totalDeposited
    } catch (err) {
      onError(err.message);
    } finally {
      setBulkMarkingPaid(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No fund collection requests yet</p>
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
                  {request.purpose}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Request ID: {request.requestId} • Class: {request.class}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount/Student</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">₹{request.amountPerStudent}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{request.totalStudents}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">₹{request.expectedAmount}</p>
            </div>
            {request.collectedAmount > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">₹{request.collectedAmount}</p>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <p>Collection Period: {formatDateRange(request.startDate, request.endDate) || 'Not specified'}</p>
            {request.notes && <p className="mt-1">Notes: {request.notes}</p>}
            {request.revisionNotes && (
              <p className="mt-1 text-orange-600 dark:text-orange-400">
                Revision Required: {request.revisionNotes}
              </p>
            )}
            {request.rejectionReason && (
              <p className="mt-1 text-red-600 dark:text-red-400">
                Rejection Reason: {request.rejectionReason}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {request.status === 'Draft' && (
              <>
                <button
                  onClick={() => handleSubmit(request.requestId)}
                  disabled={submittingId === request.requestId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {submittingId === request.requestId ? 'Submitting...' : 'Submit for Approval'}
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
            {request.status === 'Revised' && (
              <>
                <button
                  onClick={() => setEditingRequest(request)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit & Resubmit
                </button>
              </>
            )}
            {request.status === 'Approved' && (
              <button
                onClick={() => handleStartCollection(request.requestId)}
                disabled={startingId === request.requestId}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingId === request.requestId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Starting...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    Start Collection
                  </>
                )}
              </button>
            )}
            {request.status === 'In Progress' && (
              <>
                <button
                  onClick={async () => {
                    setLoadingTrackPayments(request.requestId);
                    try {
                      await loadStudentPayments(request.requestId);
                      setStudentPaymentModalRequest(request);
                    } finally {
                      setLoadingTrackPayments(null);
                    }
                  }}
                  disabled={loadingTrackPayments === request.requestId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingTrackPayments === request.requestId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Track Student Payments
                    </>
                  )}
                </button>
                <button
                  onClick={async () => {
                    setLoadingDepositModal(request.requestId);
                    try {
                      // Load latest deposits before opening modal
                      await loadDeposits(request.requestId, true);
                      setDepositModalRequest(request);
                    } finally {
                      setLoadingDepositModal(null);
                    }
                  }}
                  disabled={loadingDepositModal === request.requestId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingDepositModal === request.requestId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Batch Deposit
                    </>
                  )}
                </button>
                <button
                  onClick={async () => {
                    // Load deposits first if not already loaded
                    if (!deposits[request.requestId]) {
                      await loadDeposits(request.requestId);
                    }
                    
                    // Check if can complete
                    const requestDeposits = deposits[request.requestId] || [];
                    const unacknowledged = requestDeposits.filter(d => !d.isAcknowledged);
                    
                    if (unacknowledged.length > 0) {
                      onError(`Cannot complete: ${unacknowledged.length} deposit(s) still pending acknowledgment from accounts. Please wait for accounts to acknowledge all deposits.`);
                      return;
                    }
                    
                    setSelectedRequest(request);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Collection
                </button>
              </>
            )}
          </div>

          {/* Deposit History for In Progress and Completed */}
          {(request.status === 'In Progress' || request.status === 'Completed') && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Deposit History
                </h4>
                {request.totalDeposited > 0 && (
                  <span className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total Deposited: </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      ₹{request.totalDeposited}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">/ ₹{request.expectedAmount}</span>
                  </span>
                )}
              </div>
              
              {!deposits[request.requestId] && (
                <button
                  onClick={() => loadDeposits(request.requestId)}
                  disabled={loadingDeposits[request.requestId]}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {loadingDeposits[request.requestId] ? 'Loading...' : 'View Deposits'}
                </button>
              )}
              
              {deposits[request.requestId] && (
                <div className="space-y-2">
                  {deposits[request.requestId].length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No deposits yet</p>
                  ) : (
                    <>
                      {/* Status indicator for deposits */}
                      {request.status === 'In Progress' && deposits[request.requestId].length > 0 && (
                        <div className={`p-2 rounded-lg text-xs mb-3 ${
                          deposits[request.requestId].every(d => d.isAcknowledged)
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {deposits[request.requestId].every(d => d.isAcknowledged) ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              All deposits acknowledged - You can complete the collection
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {deposits[request.requestId].filter(d => !d.isAcknowledged).length} deposit(s) pending acknowledgment - Wait for accounts to acknowledge before completing
                            </span>
                          )}
                        </div>
                      )}

                      {deposits[request.requestId].map((deposit) => (
                        <div 
                          key={deposit.depositId} 
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  ₹{deposit.depositAmount}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">•</span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {formatISTDate(deposit.depositDate)}
                                </span>
                                {deposit.isAcknowledged && (
                                  <>
                                    <span className="text-gray-500 dark:text-gray-400">•</span>
                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                                      <CheckCircle className="w-3 h-3" />
                                      Acknowledged
                                    </span>
                                  </>
                                )}
                              </div>
                              {deposit.notes && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">{deposit.notes}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {deposit.depositId}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Deposit Modal */}
      {depositModalRequest && (
        <AddDepositModal
          request={depositModalRequest}
          deposits={deposits[depositModalRequest.requestId]}
          onClose={() => setDepositModalRequest(null)}
          onSubmit={handleAddDeposit}
        />
      )}

      {/* Student Payment Tracking Modal */}
      {studentPaymentModalRequest && (
        <StudentPaymentModal
          request={studentPaymentModalRequest}
          payments={studentPayments[studentPaymentModalRequest.requestId]}
          loading={loadingPayments[studentPaymentModalRequest.requestId]}
          markingPayment={markingPayment}
          bulkMarkingPaid={bulkMarkingPaid}
          selectedStudents={selectedStudents}
          onSelectStudent={(paymentId) => {
            setSelectedStudents(prev => {
              const newSet = new Set(prev);
              if (newSet.has(paymentId)) {
                newSet.delete(paymentId);
              } else {
                newSet.add(paymentId);
              }
              return newSet;
            });
          }}
          onSelectAll={() => {
            const data = studentPayments[studentPaymentModalRequest.requestId];
            if (!data) return;
            const pendingIds = data.students
              .filter(s => s.paymentStatus === 'Pending')
              .map(s => s.paymentId);
            setSelectedStudents(new Set(pendingIds));
          }}
          onClearSelection={() => setSelectedStudents(new Set())}
          onMarkPaid={handleMarkStudentPaid}
          onUpdatePayment={handleUpdateStudentPayment}
          onBulkMarkPaid={() => handleBulkMarkPaid(studentPaymentModalRequest.requestId)}
          onClose={() => {
            setStudentPaymentModalRequest(null);
            setSelectedStudents(new Set());
          }}
        />
      )}

      {/* Complete Collection Modal */}
      {selectedRequest && (
        <CompleteCollectionModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onComplete={handleCompleteCollection}
        />
      )}

      {/* Edit Revised Request Modal */}
      {editingRequest && (
        <EditRevisedRequestModal
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSuccess={(msg) => {
            onSuccess(msg);
            setEditingRequest(null);
            onRefresh();
          }}
          onError={onError}
          user={user}
        />
      )}
    </div>
  );
}

// Create Request Tab
function CreateRequestTab({ onSuccess, onError, user }) {
  const [formData, setFormData] = useState({
    class: '',
    purpose: '',
    amountPerStudent: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: ''
  });
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClasses.length > 0) {
      loadStudents();
    } else {
      setStudents([]);
      setSelectedStudents([]);
    }
  }, [selectedClasses]);

  async function loadClasses() {
    try {
      setLoadingClasses(true);
      const result = await api.getAllClasses();
      console.log('Classes API Response:', result); // Debug log
      setClasses(result.classes || []);
      if (!result.classes || result.classes.length === 0) {
        onError('No classes found. Please ensure the Timetable sheet has class data.');
      }
    } catch (err) {
      console.error('Error loading classes:', err); // Debug log
      onError('Failed to load classes: ' + err.message);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function loadStudents() {
    try {
      setLoadingStudents(true);
      // Load students from all selected classes
      const allStudents = [];
      for (const className of selectedClasses) {
        console.log('Loading students for class:', className); // Debug log
        const result = await api.getStudentsForClass(className);
        console.log('API response for', className, ':', result); // Debug log
        if (result.students && result.students.length > 0) {
          allStudents.push(...result.students.map(s => ({ ...s, class: className })));
        }
      }
      console.log('Total students loaded:', allStudents.length); // Debug log
      setStudents(allStudents);
      setSelectedStudents([]);
      if (allStudents.length === 0) {
        onError('No students found for selected classes. Please check if Students sheet has data with correct class names.');
      }
    } catch (err) {
      console.error('Error loading students:', err); // Debug log
      onError('Failed to load students: ' + err.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  function toggleClass(className) {
    setSelectedClasses(prev =>
      prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
    );
  }

  function toggleStudent(admNo) {
    setSelectedStudents(prev =>
      prev.includes(admNo) ? prev.filter(a => a !== admNo) : [...prev, admNo]
    );
  }

  function selectAll() {
    setSelectedStudents(students.map(s => s.admNo));
  }

  function unselectAll() {
    setSelectedStudents([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (selectedClasses.length === 0) {
      onError('Please select at least one class');
      return;
    }
    
    if (selectedStudents.length === 0) {
      onError('Please select at least one student');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        teacherEmail: user.email,
        class: selectedClasses.join(', '),
        purpose: formData.purpose,
        amountPerStudent: Number(formData.amountPerStudent),
        startDate: formData.startDate,
        endDate: formData.endDate,
        selectedStudents: selectedStudents,
        notes: formData.notes
      };

      await api.createFundCollectionRequest(payload);
      onSuccess('Fund collection request created successfully');
      
      // Reset form
      setFormData({
        class: '',
        purpose: '',
        amountPerStudent: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: ''
      });
      setSelectedClasses([]);
      setSelectedStudents([]);
      setStudents([]);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isFormValid = selectedClasses.length > 0 && 
                      formData.purpose.trim() !== '' && 
                      formData.amountPerStudent && 
                      Number(formData.amountPerStudent) > 0 &&
                      formData.startDate && 
                      formData.endDate &&
                      selectedStudents.length > 0;

  const totalAmount = selectedStudents.length * (Number(formData.amountPerStudent) || 0);

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Create New Fund Collection Request</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Multi-Select Class Dropdown */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Classes <span className="text-red-500">*</span>
          </label>
          {loadingClasses ? (
            <div className="text-gray-500 py-2">Loading classes...</div>
          ) : (
            <>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                {classes.length === 0 ? (
                  <p className="text-gray-500 text-sm py-2">No classes available</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {classes.map((cls) => (
                      <label
                        key={cls}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(cls)}
                          onChange={() => toggleClass(cls)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cls}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedClasses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedClasses.map((cls) => (
                    <span
                      key={cls}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {cls}
                      <button
                        type="button"
                        onClick={() => toggleClass(cls)}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Purpose <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            placeholder="e.g., Athletic Meet Registration"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount per Student (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.amountPerStudent}
            onChange={(e) => setFormData({ ...formData, amountPerStudent: e.target.value })}
            placeholder="100"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            min={formData.startDate}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes or instructions"
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Student Selection */}
      {students.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
              Select Students ({selectedStudents.length} of {students.length})
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1 text-sm border border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={unselectAll}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
              >
                Unselect All
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {students.map((student) => (
              <label
                key={student.admNo}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.admNo)}
                  onChange={() => toggleStudent(student.admNo)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex flex-col">
                  <span>{student.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {student.admNo} • {student.class}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {loadingStudents && (
        <div className="text-center py-4 text-gray-500">Loading students...</div>
      )}

      {selectedClasses.length > 0 && students.length === 0 && !loadingStudents && (
        <div className="mb-6 text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No students found for the selected class(es)</p>
        </div>
      )}

      {/* Summary */}
      {selectedStudents.length > 0 && formData.amountPerStudent && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Total Expected Amount:</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{totalAmount}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedStudents.length} students × ₹{formData.amountPerStudent}
          </p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={submitting || !isFormValid}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {submitting ? 'Creating...' : 'Create Request'}
        </button>
        {!isFormValid && selectedClasses.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
            {selectedStudents.length === 0 ? 'Please select at least one student' : 'Please fill all required fields'}
          </p>
        )}
      </div>
    </form>
  );
}

// Approve Requests Tab (HM)
function ApproveRequestsTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve', 'reject', 'revise'
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  console.log('[ApproveTab] Total requests:', requests.length);
  const pendingRequests = requests.filter(r => r.status === 'Pending' || r.status === 'Revised');
  console.log('[ApproveTab] Pending requests:', pendingRequests.length);
  console.log('[ApproveTab] First 3 requests:', requests.slice(0, 3));

  async function handleDelete(requestId) {
    if (!window.confirm('Are you sure you want to delete this fund collection request? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(requestId);
      await api.adminDeleteFundCollectionRequest(requestId, user.email);
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
        await api.approveFundRequest(selectedRequest.requestId, user.email, reason);
        onSuccess('Request approved successfully');
      } else if (actionType === 'reject') {
        if (!reason) {
          onError('Please provide a rejection reason');
          return;
        }
        await api.rejectFundRequest(selectedRequest.requestId, user.email, reason);
        onSuccess('Request rejected');
      } else if (actionType === 'revise') {
        if (!reason) {
          onError('Please provide revision notes');
          return;
        }
        await api.requestFundRevision(selectedRequest.requestId, user.email, reason);
        onSuccess('Revision requested');
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
        <p className="text-gray-500 dark:text-gray-400">No pending requests</p>
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
                    {request.purpose}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Request ID: {request.requestId} • Teacher: {request.teacherName} • Class: {request.class}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount/Student</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">₹{request.amountPerStudent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{request.totalStudents}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected Amount</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">₹{request.expectedAmount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Period</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDateRange(request.startDate, request.endDate) || 'Not specified'}
                </p>
              </div>
            </div>

            {request.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Notes: {request.notes}
              </p>
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
                onClick={() => { setSelectedRequest(request); setActionType('revise'); }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Request Revision
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

// All Transactions Tab (HM - View all fund collections)
function AllTransactionsTab({ requests, loading, getStatusColor, getStatusIcon, user, onRefresh, onSuccess, onError }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const isHM = user && (user.roles?.includes('hm') || user.roles?.includes('admin'));

  async function handleDelete(requestId) {
    if (!window.confirm('Are you sure you want to delete this fund collection request? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(requestId);
      await api.adminDeleteFundCollectionRequest(requestId, user.email);
      onSuccess('Request deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Error deleting request:', error);
      onError(error.message || 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  }

  // Apply filters
  let filteredRequests = requests;
  if (filterStatus) {
    filteredRequests = filteredRequests.filter(r => r.status === filterStatus);
  }
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredRequests = filteredRequests.filter(r => {
      const matchClass = String(r.class || '').toLowerCase().includes(query);
      const matchPurpose = String(r.purpose || '').toLowerCase().includes(query);
      const matchTeacher = String(r.teacherName || '').toLowerCase().includes(query);
      const matchTeacherEmail = String(r.teacherEmail || '').toLowerCase().includes(query);
      const matchRequestId = String(r.requestId || '').toLowerCase().includes(query);
      return matchClass || matchPurpose || matchTeacher || matchTeacherEmail || matchRequestId;
    });
  }

  // Group by status
  const statusCounts = {
    'Draft': requests.filter(r => r.status === 'Draft').length,
    'Pending': requests.filter(r => r.status === 'Pending').length,
    'Approved': requests.filter(r => r.status === 'Approved').length,
    'In Progress': requests.filter(r => r.status === 'In Progress').length,
    'Completed': requests.filter(r => r.status === 'Completed').length,
    'Rejected': requests.filter(r => r.status === 'Rejected').length
  };

  // Calculate total amounts
  const totalExpected = requests
    .filter(r => r.status === 'Approved' || r.status === 'In Progress' || r.status === 'Completed')
    .reduce((sum, r) => sum + Number(r.expectedAmount || 0), 0);

  const totalCollected = requests
    .filter(r => r.status === 'Completed')
    .reduce((sum, r) => sum + Number(r.collectedAmount || 0), 0);

  const totalAcknowledged = requests
    .filter(r => r.status === 'Completed' && r.acknowledgedBy)
    .reduce((sum, r) => sum + Number(r.collectedAmount || 0), 0);

  const totalPending = requests
    .filter(r => r.status === 'Pending')
    .reduce((sum, r) => sum + Number(r.expectedAmount || 0), 0);

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{status}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Collected</p>
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100">₹{totalCollected.toLocaleString()}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{statusCounts['Completed']} completed collections</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Acknowledged</p>
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">₹{totalAcknowledged.toLocaleString()}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Confirmed by accounts</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg shadow-sm border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Expected (Active)</p>
          </div>
          <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">₹{totalExpected.toLocaleString()}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Approved & In Progress</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Approval</p>
          </div>
          <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">₹{totalPending.toLocaleString()}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">{statusCounts['Pending']} requests awaiting</p>
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
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search (Class, Purpose, Teacher, ID)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by class, purpose, teacher name or request ID..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
                    {request.purpose}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Request ID: {request.requestId} • Teacher: {request.teacherName} • Class: {request.class}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount/Student</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">₹{request.amountPerStudent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{request.totalStudents}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected Amount</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">₹{request.expectedAmount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected Amount</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  ₹{request.collectedAmount || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Period</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDateRange(request.startDate, request.endDate) || 'Not specified'}
                </p>
              </div>
            </div>

            {request.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Notes: {request.notes}
              </p>
            )}

            {/* Show approval/disbursement details */}
            {request.approvedBy && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Approved by: {request.approvedBy} • {formatISTDateTime(request.approvedAt)}
              </p>
            )}
            {request.acknowledgedBy && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Acknowledged by: {request.acknowledgedBy} • {formatISTDateTime(request.acknowledgedAt)}
              </p>
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

// Accounts Tab
function AccountsTab({ requests, loading, onRefresh, onSuccess, onError, getStatusColor, getStatusIcon, user }) {
  const completedRequests = requests.filter(r => r.status === 'Completed' && !r.acknowledgedBy);
  const approvedRequests = requests.filter(r => r.status === 'Approved' || r.status === 'In Progress');
  const [deposits, setDeposits] = useState({});
  const [loadingDeposits, setLoadingDeposits] = useState({});
  const [acknowledgingDeposit, setAcknowledgingDeposit] = useState(null);
  const [expandedRequests, setExpandedRequests] = useState({});

  // Auto-expand and load deposits for all In Progress collections on mount/change
  useEffect(() => {
    const inProgressRequests = requests.filter(r => r.status === 'In Progress');
    if (inProgressRequests.length === 0) return;
    // Auto-expand all in-progress requests
    const expanded = {};
    inProgressRequests.forEach(r => { expanded[r.requestId] = true; });
    setExpandedRequests(prev => ({ ...prev, ...expanded }));
    // Load deposits fresh each time requests updates
    inProgressRequests.forEach(request => {
      loadDeposits(request.requestId, true);
    });
  }, [requests.length]);

  async function handleAcknowledge(requestId) {
    if (!confirm('Confirm acknowledgment of received funds?')) return;

    try {
      await api.acknowledgeFundCollection(requestId, user.email);
      onSuccess('Funds acknowledged successfully');
      onRefresh();
    } catch (err) {
      onError(err.message);
    }
  }

  async function loadDeposits(requestId, forceRefresh = false) {
    try {
      setLoadingDeposits(prev => ({ ...prev, [requestId]: true }));
      const result = await api.getFundDeposits(requestId);
      setDeposits(prev => ({ ...prev, [requestId]: result }));
    } catch (err) {
      console.error('Error loading deposits:', err);
    } finally {
      setLoadingDeposits(prev => ({ ...prev, [requestId]: false }));
    }
  }

  function toggleRequest(requestId) {
    setExpandedRequests(prev => ({ ...prev, [requestId]: !prev[requestId] }));
    // Load deposits when expanding
    if (!expandedRequests[requestId]) {
      loadDeposits(requestId, true);
    }
  }

  async function handleAcknowledgeDeposit(depositId, requestId) {
    if (!confirm('Confirm acknowledgment of this deposit?')) return;

    try {
      setAcknowledgingDeposit(depositId);
      await api.acknowledgeFundDeposit(depositId, user.email);
      onSuccess('Deposit acknowledged successfully');
      // Reload deposits with force refresh
      setDeposits(prev => ({ ...prev, [requestId]: null })); // Clear cache
      await loadDeposits(requestId, true);
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setAcknowledgingDeposit(null);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Acknowledgments */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Pending Acknowledgments ({completedRequests.length})
        </h3>
        {completedRequests.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No pending acknowledgments</p>
        ) : (
          <div className="space-y-4">
            {completedRequests.map((request) => (
              <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {request.purpose}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Request ID: {request.requestId} • Teacher: {request.teacherName} • Class: {request.class}
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">₹{request.expectedAmount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected</p>
                        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">₹{request.collectedAmount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Difference</p>
                        <p className={`text-lg font-semibold ${Number(request.collectedAmount) >= Number(request.expectedAmount) ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{Number(request.collectedAmount) - Number(request.expectedAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(request.requestId)}
                    className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Collections (For Reference) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Collections ({approvedRequests.length})
          </h3>
          {/* Show total pending deposits count */}
          {(() => {
            const totalPending = approvedRequests
              .filter(r => r.status === 'In Progress')
              .reduce((sum, r) => {
                const reqDeposits = deposits[r.requestId] || [];
                return sum + reqDeposits.filter(d => !d.isAcknowledged).length;
              }, 0);
            
            return totalPending > 0 ? (
              <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
                {totalPending} deposit(s) pending acknowledgment
              </span>
            ) : null;
          })()}
        </div>
        {approvedRequests.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No active collections</p>
        ) : (
          <div className="space-y-4">
            {approvedRequests.map((request) => (
              <div key={request.requestId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div
                  className={`flex items-center justify-between ${request.status === 'In Progress' ? 'cursor-pointer' : ''}`}
                  onClick={() => request.status === 'In Progress' && toggleRequest(request.requestId)}
                >
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{request.purpose}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {request.teacherName} • {request.class} • Expected: ₹{request.expectedAmount}
                    </p>
                    {request.totalDeposited > 0 && (
                      <p className="text-sm mt-1">
                        <span className="text-gray-500 dark:text-gray-400">Deposited: </span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">₹{request.totalDeposited}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                    {request.status === 'In Progress' && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">
                        {expandedRequests[request.requestId] ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Show deposits for In Progress collections */}
                {request.status === 'In Progress' && expandedRequests[request.requestId] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {loadingDeposits[request.requestId] && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading deposits...</p>
                    )}

                    {!loadingDeposits[request.requestId] && !deposits[request.requestId] && (
                      <button
                        onClick={(e) => { e.stopPropagation(); loadDeposits(request.requestId, true); }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        ↻ Load deposits
                      </button>
                    )}

                    {!loadingDeposits[request.requestId] && deposits[request.requestId] && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Deposits Requiring Acknowledgment
                          </h5>
                          <button
                            onClick={(e) => { e.stopPropagation(); loadDeposits(request.requestId, true); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            ↻ Reload
                          </button>
                        </div>
                        {deposits[request.requestId].length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No deposits submitted yet</p>
                        ) : deposits[request.requestId].filter(d => !d.isAcknowledged).length === 0 ? (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              All {deposits[request.requestId].length} deposit(s) acknowledged
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {deposits[request.requestId].filter(d => !d.isAcknowledged).map((deposit) => (
                              <div 
                                key={deposit.depositId} 
                                className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 flex items-start justify-between border border-yellow-200 dark:border-yellow-800"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      ₹{deposit.depositAmount}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">•</span>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {formatISTDate(deposit.depositDate)}
                                    </span>
                                  </div>
                                  {deposit.notes && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{deposit.notes}</p>
                                  )}
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    ID: {deposit.depositId}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleAcknowledgeDeposit(deposit.depositId, request.requestId)}
                                  disabled={acknowledgingDeposit === deposit.depositId}
                                  className="ml-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {acknowledgingDeposit === deposit.depositId ? 'Acknowledging...' : 'Acknowledge'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {deposits[request.requestId].filter(d => d.isAcknowledged).length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                              Acknowledged Deposits
                            </h5>
                            <div className="space-y-1">
                              {deposits[request.requestId].filter(d => d.isAcknowledged).map((deposit) => (
                                <div 
                                  key={deposit.depositId} 
                                  className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <span>₹{deposit.depositAmount}</span>
                                  <span>•</span>
                                  <span>{formatISTDate(deposit.depositDate)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Complete Collection Modal
function CompleteCollectionModal({ request, onClose, onComplete }) {
  const [collectedAmount, setCollectedAmount] = useState(request.expectedAmount || 0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (submitting) return;
    
    try {
      setSubmitting(true);
      await onComplete(request.requestId, Number(collectedAmount));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Complete Collection
        </h3>
        
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            ℹ️ This marks the collection as finished. After submission, the accounts department will acknowledge receipt of the total amount.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Request: {request.purpose}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Expected Amount: ₹{request.expectedAmount}
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collected Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={collectedAmount}
              onChange={(e) => setCollectedAmount(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              required
            />

            {Number(collectedAmount) !== Number(request.expectedAmount) && (
              <p className={`text-sm mt-2 ${Number(collectedAmount) > Number(request.expectedAmount) ? 'text-green-600' : 'text-orange-600'}`}>
                Difference: ₹{Number(collectedAmount) - Number(request.expectedAmount)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Revised Request Modal
function EditRevisedRequestModal({ request, onClose, onSuccess, onError, user }) {
  const [formData, setFormData] = useState({
    purpose: request.purpose || '',
    amountPerStudent: request.amountPerStudent || '',
    notes: request.notes || ''
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.purpose || !formData.amountPerStudent) {
      onError('Purpose and amount per student are required');
      return;
    }

    if (Number(formData.amountPerStudent) <= 0) {
      onError('Amount must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      
      // Update the request
      await api.updateFundCollectionRequest(request.requestId, user.email, {
        purpose: formData.purpose,
        amountPerStudent: Number(formData.amountPerStudent),
        notes: formData.notes
      });
      
      // Resubmit for approval
      await api.submitFundCollectionRequest(request.requestId, user.email);
      
      onSuccess('Request updated and resubmitted for approval');
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 my-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit & Resubmit Request
        </h3>
        
        {request.revisionNotes && (
          <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">Revision Required:</p>
            <p className="text-sm text-orange-600 dark:text-orange-400">{request.revisionNotes}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Request Details */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Request ID: {request.requestId} • Class: {request.class}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Students: {request.totalStudents} • Current Expected: ₹{request.expectedAmount}
            </p>
          </div>

          {/* Purpose */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purpose <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Amount Per Student */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount Per Student (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.amountPerStudent}
              onChange={(e) => setFormData({ ...formData, amountPerStudent: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* New Expected Amount Preview */}
          {formData.amountPerStudent && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                New Expected Amount: <span className="font-bold text-blue-600 dark:text-blue-400">
                  ₹{Number(formData.amountPerStudent) * Number(request.totalStudents)}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {request.totalStudents} students × ₹{formData.amountPerStudent}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Any additional information..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Updating...' : 'Update & Resubmit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Action Modal (Approve/Reject/Revise)
function ActionModal({ request, actionType, reason, setReason, processing, onConfirm, onCancel }) {
  const titles = {
    approve: 'Approve Request',
    reject: 'Reject Request',
    revise: 'Request Revision'
  };

  const colors = {
    approve: 'bg-green-600 hover:bg-green-700',
    reject: 'bg-red-600 hover:bg-red-700',
    revise: 'bg-orange-600 hover:bg-orange-700'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {titles[actionType]}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Request: {request.purpose} ({request.requestId})
        </p>

        {(actionType === 'reject' || actionType === 'revise') && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {actionType === 'reject' ? 'Rejection Reason' : 'Revision Notes'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={actionType === 'reject' ? 'Provide reason for rejection...' : 'Specify what needs to be revised...'}
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

// Add Deposit Modal
function AddDepositModal({ request, deposits, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    depositAmount: '',
    depositDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.depositAmount || Number(formData.depositAmount) <= 0) {
      alert('Please enter a valid deposit amount');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(
        request.requestId,
        Number(formData.depositAmount),
        formData.depositDate,
        formData.notes
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate current total from deposits if available, otherwise use request.totalDeposited
  let currentTotal = Number(request.totalDeposited || 0);
  let depositCount = 0;
  if (deposits && Array.isArray(deposits)) {
    // Sum up all batch deposits
    const batchTotal = deposits.reduce((sum, d) => sum + Number(d.depositAmount || 0), 0);
    currentTotal = batchTotal;
    depositCount = deposits.length;
  }
  
  const remaining = Number(request.expectedAmount) - currentTotal;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add Deposit
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span className="font-medium">Request:</span> {request.purpose}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span className="font-medium">Expected:</span> ₹{request.expectedAmount}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span className="font-medium">Already Deposited:</span> ₹{currentTotal}
                {depositCount > 0 && <span className="text-gray-500 ml-1">({depositCount} deposit{depositCount !== 1 ? 's' : ''})</span>}
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Remaining: ₹{remaining}
              </p>
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deposit Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={formData.depositAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter amount"
              required
            />
            {formData.depositAmount && Number(formData.depositAmount) > remaining && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                ⚠️ Amount exceeds remaining balance
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deposit Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.depositDate}
              onChange={(e) => setFormData(prev => ({ ...prev, depositDate: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Payment reference, bank details, etc."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Adding...' : 'Add Deposit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
