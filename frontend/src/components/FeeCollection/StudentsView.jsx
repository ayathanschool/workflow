import React, { useState, useMemo } from 'react';
import { 
  Users, Grid, List, Search, Filter, Download, Mail, 
  Phone, CreditCard, CheckCircle, AlertCircle, Clock,
  ChevronDown, X, Eye, TrendingUp, TrendingDown
} from 'lucide-react';

const StudentsView = ({ students, feeHeads, transactions, onNavigateToPayment }) => {
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [filters, setFilters] = useState({
    search: '',
    class: '',
    status: 'all' // all, paid, partial, pending
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Calculate fee status for each student
  const studentsWithStatus = useMemo(() => {
    return (students || []).map(student => {
      const studentTransactions = (transactions || []).filter(t => 
        t.admNo === student.admNo && 
        !String(t.void || '').toUpperCase().startsWith('Y')
      );

      const studentFeeHeads = (feeHeads || []).filter(fh => 
        fh.class === student.class
      );

      const totalRequired = studentFeeHeads.reduce((sum, fh) => 
        sum + (Number(fh.amount) || 0), 0
      );

      const totalPaid = studentTransactions.reduce((sum, t) => 
        sum + (Number(t.amount) || 0) + (Number(t.fine) || 0), 0
      );

      const balance = totalRequired - totalPaid;

      let status = 'pending';
      if (totalPaid >= totalRequired && totalRequired > 0) {
        status = 'paid';
      } else if (totalPaid > 0) {
        status = 'partial';
      }

      // Calculate per fee head breakdown
      const feeBreakdown = studentFeeHeads.map(fh => {
        const fhTransactions = studentTransactions.filter(t => t.feeHead === fh.feeHead);
        const fhPaid = fhTransactions.reduce((sum, t) => 
          sum + (Number(t.amount) || 0) + (Number(t.fine) || 0), 0
        );
        const fhBalance = (Number(fh.amount) || 0) - fhPaid;

        return {
          feeHead: fh.feeHead,
          required: Number(fh.amount) || 0,
          paid: fhPaid,
          balance: fhBalance,
          dueDate: fh.dueDate,
          isPaid: fhBalance <= 0
        };
      });

      return {
        ...student,
        totalRequired,
        totalPaid,
        balance,
        status,
        feeBreakdown,
        transactionCount: studentTransactions.length,
        lastPayment: studentTransactions.length > 0 
          ? studentTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date
          : null
      };
    });
  }, [students, feeHeads, transactions]);

  // Apply filters
  const filteredStudents = studentsWithStatus.filter(s => {
    if (filters.search) {
      const term = filters.search.toLowerCase();
      if (!(
        String(s.admNo).toLowerCase().includes(term) ||
        s.name?.toLowerCase().includes(term) ||
        s.class?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
      )) return false;
    }

    if (filters.class && s.class !== filters.class) return false;

    if (filters.status !== 'all' && s.status !== filters.status) return false;

    return true;
  });

  const classes = [...new Set((students || []).map(s => s.class))].filter(Boolean).sort();

  const summary = {
    total: filteredStudents.length,
    paid: filteredStudents.filter(s => s.status === 'paid').length,
    partial: filteredStudents.filter(s => s.status === 'partial').length,
    pending: filteredStudents.filter(s => s.status === 'pending').length,
    totalCollected: filteredStudents.reduce((sum, s) => sum + s.totalPaid, 0),
    totalOutstanding: filteredStudents.reduce((sum, s) => sum + Math.max(0, s.balance), 0)
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'pending': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'partial': return <Clock className="h-4 w-4" />;
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const exportToCSV = () => {
    const headers = ['Adm No', 'Name', 'Class', 'Email', 'Contact', 'Total Required', 'Total Paid', 'Balance', 'Status', 'Last Payment'];
    const rows = filteredStudents.map(s => [
      s.admNo,
      s.name,
      s.class,
      s.email || '',
      s.parentContact || '',
      s.totalRequired,
      s.totalPaid,
      s.balance,
      s.status,
      s.lastPayment || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_fee_status_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Students Fee Status</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {summary.total} students • {summary.paid} fully paid • {summary.pending} pending
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              } transition-all`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              } transition-all`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Fully Paid</p>
              <p className="text-3xl font-bold mt-1">{summary.paid}</p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-200" />
          </div>
          <p className="text-xs text-green-100 mt-2">
            {summary.total > 0 ? Math.round((summary.paid / summary.total) * 100) : 0}% of students
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Partial Payment</p>
              <p className="text-3xl font-bold mt-1">{summary.partial}</p>
            </div>
            <Clock className="h-12 w-12 text-yellow-200" />
          </div>
          <p className="text-xs text-yellow-100 mt-2">
            {summary.total > 0 ? Math.round((summary.partial / summary.total) * 100) : 0}% of students
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Pending</p>
              <p className="text-3xl font-bold mt-1">{summary.pending}</p>
            </div>
            <AlertCircle className="h-12 w-12 text-red-200" />
          </div>
          <p className="text-xs text-red-100 mt-2">
            {summary.total > 0 ? Math.round((summary.pending / summary.total) * 100) : 0}% of students
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Outstanding</p>
              <p className="text-2xl font-bold mt-1">₹{summary.totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
            <TrendingDown className="h-12 w-12 text-blue-200" />
          </div>
          <p className="text-xs text-blue-100 mt-2">
            Total amount pending
          </p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Name, adm no, email..."
                  className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Class
              </label>
              <select
                value={filters.class}
                onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="paid">Fully Paid</option>
                <option value="partial">Partial Payment</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilters({ search: '', class: '', status: 'all' })}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Students Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No students found
            </div>
          ) : (
            filteredStudents.map((student, idx) => (
              <div
                key={`${student.admNo}-${idx}`}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => setSelectedStudent(student)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {student.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {student.admNo} • {student.class}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                    {getStatusIcon(student.status)}
                    {student.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {student.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{student.email}</span>
                    </div>
                  )}
                  {student.parentContact && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{student.parentContact}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Required:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      ₹{student.totalRequired.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Paid:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ₹{student.totalPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
                    <span className={`font-bold ${
                      student.balance > 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      ₹{Math.abs(student.balance).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                        style={{
                          width: `${student.totalRequired > 0 
                            ? Math.min(100, (student.totalPaid / student.totalRequired) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {student.balance > 0 && onNavigateToPayment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToPayment(student);
                    }}
                    className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Collect Payment
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Required</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      No students found
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr 
                      key={`${student.admNo}-${idx}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{student.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{student.admNo} • {student.class}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="space-y-1">
                          {student.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{student.email}</span>
                            </div>
                          )}
                          {student.parentContact && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{student.parentContact}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ₹{student.totalRequired.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                        ₹{student.totalPaid.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                        <span className={`font-bold ${
                          student.balance > 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          ₹{Math.abs(student.balance).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                          {getStatusIcon(student.status)}
                          {student.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          {student.balance > 0 && onNavigateToPayment && (
                            <button
                              onClick={() => onNavigateToPayment(student)}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Collect Payment"
                            >
                              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedStudent.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStudent.admNo} • {selectedStudent.class}</p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedStudent.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      <span>{selectedStudent.email}</span>
                    </div>
                  )}
                  {selectedStudent.parentContact && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4" />
                      <span>{selectedStudent.parentContact}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Summary */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Fee Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Required</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      ₹{selectedStudent.totalRequired.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-green-600 dark:text-green-400">Total Paid</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                      ₹{selectedStudent.totalPaid.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className={`${
                    selectedStudent.balance > 0 
                      ? 'bg-red-50 dark:bg-red-900/20' 
                      : 'bg-green-50 dark:bg-green-900/20'
                  } rounded-lg p-3`}>
                    <p className={`text-xs ${
                      selectedStudent.balance > 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      Balance
                    </p>
                    <p className={`text-xl font-bold mt-1 ${
                      selectedStudent.balance > 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      ₹{Math.abs(selectedStudent.balance).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fee Breakdown */}
              {selectedStudent.feeBreakdown && selectedStudent.feeBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Fee Breakdown</h4>
                  <div className="space-y-2">
                    {selectedStudent.feeBreakdown.map((fb, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{fb.feeHead}</p>
                            {fb.dueDate && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">Due: {fb.dueDate}</p>
                            )}
                          </div>
                          {fb.isPaid ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Required</p>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              ₹{fb.required.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Paid</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              ₹{fb.paid.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Balance</p>
                            <p className={`font-semibold ${
                              fb.balance > 0 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              ₹{Math.abs(fb.balance).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                {selectedStudent.balance > 0 && onNavigateToPayment && (
                  <button
                    onClick={() => {
                      setSelectedStudent(null);
                      onNavigateToPayment(selectedStudent);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Collect Payment
                  </button>
                )}
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsView;
