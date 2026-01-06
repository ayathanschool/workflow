import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Search, Calendar, User, Receipt, AlertCircle, 
  CheckCircle, XCircle, Download, Filter, Loader, Clock,
  AlertTriangle, CreditCard, TrendingUp, Users
} from 'lucide-react';

const FeeCollectionModule = ({ user, apiBaseUrl }) => {
  const [activeTab, setActiveTab] = useState('payment');
  const [students, setStudents] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    admNo: '',
    name: '',
    class: '',
    mode: 'Cash',
    selectedFees: []
  });

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      let token = '';
      try {
        const s = JSON.parse(localStorage.getItem('sf_google_session') || '{}');
        token = s?.idToken ? String(s.idToken) : '';
      } catch {}
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const [studentsRes, feeHeadsRes, transactionsRes] = await Promise.all([
        fetch(`${apiBaseUrl}?action=getStudents${tokenParam}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`${apiBaseUrl}?action=feeheads${tokenParam}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`${apiBaseUrl}?action=transactions${tokenParam}`, { cache: 'no-store' }).then(r => r.json())
      ]);

      // Helper to safely extract array from various response shapes
      const extractArray = (res) => {
        if (!res) return [];
        // Direct array
        if (Array.isArray(res)) return res;
        // Nested in data/result/students
        const payload = res.data || res.result || res.students || res;
        if (Array.isArray(payload)) return payload;
        // Deeply nested (e.g., {status:200, data:{ok:true, data:[]}})
        if (payload?.data && Array.isArray(payload.data)) return payload.data;
        if (payload?.result && Array.isArray(payload.result)) return payload.result;
        return [];
      };

      // Deduplicate students by admNo (in case sheet has duplicates)
      const studentsArray = extractArray(studentsRes);
      const uniqueStudents = studentsArray.filter((student, index, self) => 
        index === self.findIndex(s => s.admNo === student.admNo)
      );
      
      setStudents(uniqueStudents);
      setFeeHeads(extractArray(feeHeadsRes));
      setTransactions(extractArray(transactionsRes));
    } catch (err) {
      console.error('Load data error:', err);
      setError('Failed to load data: ' + err.message);
      // Ensure arrays on error too
      setStudents([]);
      setFeeHeads([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill student details
  const handleStudentSelect = (admNo) => {
    const studentArray = Array.isArray(students) ? students : [];
    const student = studentArray.find(s => s.admNo === admNo);
    if (student) {
      setPaymentForm(prev => ({
        ...prev,
        admNo: student.admNo,
        name: student.name,
        class: student.class,
        selectedFees: []
      }));
      
      // Load applicable fees for this class
      const feeHeadArray = Array.isArray(feeHeads) ? feeHeads : [];
      const applicableFees = feeHeadArray.filter(f => f.class === student.class);
      const selectedFees = applicableFees.map(f => ({
        feeHead: f.feeHead,
        amount: f.amount,
        fine: 0
      }));
      setPaymentForm(prev => ({ ...prev, selectedFees }));
    }
  };

  // Submit payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.admNo || !paymentForm.selectedFees.length) {
      setError('Please select a student and at least one fee');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let token = '';
      try {
        const s = JSON.parse(localStorage.getItem('sf_google_session') || '{}');
        token = s?.idToken ? String(s.idToken) : '';
      } catch {}
      const response = await fetch(apiBaseUrl, {
        method: 'POST',
        // Use text/plain to avoid preflight with Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addPaymentBatch',
          date: paymentForm.date,
          admNo: paymentForm.admNo,
          name: paymentForm.name,
          cls: paymentForm.class,
          mode: paymentForm.mode,
          items: paymentForm.selectedFees.filter(f => f.amount > 0),
          ...(token ? { token } : {})
        })
      });

      const result = await response.json();
      if (result.ok || result.status === 200) {
        setSuccess(`Payment recorded successfully! Receipt: ${result.receiptNo}`);
        setPaymentForm({
          date: new Date().toISOString().split('T')[0],
          admNo: '',
          name: '',
          class: '',
          mode: 'Cash',
          selectedFees: []
        });
        loadData(); // Reload transactions
      } else {
        setError(result.error || 'Payment failed');
      }
    } catch (err) {
      setError('Failed to submit payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get unique classes (guard against non-array)
  const studentArray = Array.isArray(students) ? students : [];
  const classes = [...new Set(studentArray.map(s => s.class))].filter(Boolean).sort();

  // Filter students (guard against non-array)
  const filteredStudents = studentArray.filter(s => {
    const matchesSearch = !searchTerm || 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admNo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !classFilter || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // Filter transactions (guard against non-array)
  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter(t => {
    const matchesSearch = !searchTerm ||
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.admNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.receiptNo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !classFilter || t.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // Calculate summary stats (guard against non-array)
  const transactionArray = Array.isArray(transactions) ? transactions : [];
  const summary = {
    totalCollected: transactionArray.reduce((sum, t) => !t.void ? sum + (Number(t.amount) || 0) : sum, 0),
    totalFine: transactionArray.reduce((sum, t) => !t.void ? sum + (Number(t.fine) || 0) : sum, 0),
    totalTransactions: transactionArray.filter(t => !t.void).length,
    todayCollection: transactionArray.filter(t => 
      t.date === new Date().toISOString().split('T')[0] && !t.void
    ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Fee Collection System
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage student fee payments and track collections
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Collected</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                ₹{summary.totalCollected.toLocaleString('en-IN')}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Transactions</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                {summary.totalTransactions}
              </p>
            </div>
            <Receipt className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Fine Collected</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                ₹{summary.totalFine.toLocaleString('en-IN')}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Today's Collection</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                ₹{summary.todayCollection.toLocaleString('en-IN')}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {['payment', 'transactions', 'students'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'payment' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Collect Payment</h2>
          
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            {/* Student Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Student
              </label>
              <select
                value={paymentForm.admNo}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">-- Select Student --</option>
                {students.map((s, idx) => (
                  <option key={`${s.admNo}-${idx}`} value={s.admNo}>
                    {s.admNo} - {s.name} ({s.class})
                  </option>
                ))}
              </select>
            </div>

            {paymentForm.admNo && (
              <>
                {/* Date and Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Mode
                    </label>
                    <select
                      value={paymentForm.mode}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, mode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>

                {/* Fee Heads */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fee Details
                  </label>
                  <div className="space-y-2">
                    {paymentForm.selectedFees.map((fee, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {fee.feeHead}
                        </span>
                        <input
                          type="number"
                          value={fee.amount}
                          onChange={(e) => {
                            const newFees = [...paymentForm.selectedFees];
                            newFees[idx].amount = Number(e.target.value);
                            setPaymentForm(prev => ({ ...prev, selectedFees: newFees }));
                          }}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          placeholder="Amount"
                        />
                        <input
                          type="number"
                          value={fee.fine}
                          onChange={(e) => {
                            const newFees = [...paymentForm.selectedFees];
                            newFees[idx].fine = Number(e.target.value);
                            setPaymentForm(prev => ({ ...prev, selectedFees: newFees }));
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          placeholder="Fine"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Total: ₹{paymentForm.selectedFees.reduce((sum, f) => sum + (Number(f.amount) || 0) + (Number(f.fine) || 0), 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                  {loading ? 'Processing...' : 'Collect Payment'}
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment History</h2>
            <button
              onClick={loadData}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Search and Filter */}
          <div className="mb-4 flex gap-3">
            <input
              type="text"
              placeholder="Search by name, admission no, or receipt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Receipt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fee Head</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransactions.map((t, idx) => (
                  <tr key={`${t.receiptNo || 'tx'}-${t.admNo || 'x'}-${idx}`} className={t.void ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.date}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.receiptNo}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {t.name} ({t.admNo})
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t.class}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.feeHead}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">₹{Number(t.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">₹{Number(t.fine).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Students Fee Status</h2>
          
          {/* Search and Filter */}
          <div className="mb-4 flex gap-3">
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Students Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map(student => {
              const studentTransactions = transactions.filter(t => t.admNo === student.admNo && !t.void);
              const totalPaid = studentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
              const applicableFees = feeHeads.filter(f => f.class === student.class);
              const totalExpected = applicableFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
              const balance = totalExpected - totalPaid;

              return (
                <div key={student.admNo} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{student.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{student.admNo} • {student.class}</p>
                    </div>
                    {balance <= 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Expected:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">₹{totalExpected.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Paid:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">₹{totalPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Balance:</span>
                      <span className={`font-bold ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        ₹{Math.abs(balance).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeCollectionModule;
