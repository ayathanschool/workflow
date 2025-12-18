import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, TrendingUp, Calendar, Mail, MessageCircle,
  Phone, Download, Filter, Search, Send, Check, X,
  ChevronDown, ChevronUp, Users, DollarSign
} from 'lucide-react';

const OutstandingFeesView = ({ students, feeHeads, transactions, onNavigateToPayment }) => {
  const [filters, setFilters] = useState({
    search: '',
    class: '',
    minAmount: '',
    sortBy: 'amount' // amount, dueDate, name
  });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderType, setReminderType] = useState('email'); // email, sms, whatsapp

  // Calculate outstanding fees for each student
  const defaulters = useMemo(() => {
    return (students || [])
      .map(student => {
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

        // Outstanding fee heads
        const outstandingFees = studentFeeHeads
          .map(fh => {
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
              dueDate: fh.dueDate
            };
          })
          .filter(fh => fh.balance > 0);

        // Calculate overdue days (from earliest due date)
        let overdueDays = 0;
        if (outstandingFees.length > 0) {
          const dueDates = outstandingFees
            .map(fh => fh.dueDate)
            .filter(Boolean)
            .map(d => new Date(d));
          
          if (dueDates.length > 0) {
            const earliestDue = new Date(Math.min(...dueDates));
            const today = new Date();
            overdueDays = Math.max(0, Math.floor((today - earliestDue) / (1000 * 60 * 60 * 24)));
          }
        }

        return {
          ...student,
          balance,
          outstandingFees,
          overdueDays,
          lastPayment: studentTransactions.length > 0 
            ? studentTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date
            : null
        };
      })
      .filter(s => s.balance > 0); // Only students with outstanding balance
  }, [students, feeHeads, transactions]);

  // Apply filters and sorting
  const filteredDefaulters = defaulters
    .filter(d => {
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!(
          String(d.admNo).toLowerCase().includes(term) ||
          d.name?.toLowerCase().includes(term) ||
          d.class?.toLowerCase().includes(term)
        )) return false;
      }

      if (filters.class && d.class !== filters.class) return false;

      if (filters.minAmount && d.balance < Number(filters.minAmount)) return false;

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'amount') {
        return b.balance - a.balance;
      } else if (filters.sortBy === 'dueDate') {
        return b.overdueDays - a.overdueDays;
      } else if (filters.sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

  const classes = [...new Set((students || []).map(s => s.class))].filter(Boolean).sort();

  const summary = {
    totalDefaulters: filteredDefaulters.length,
    totalOutstanding: filteredDefaulters.reduce((sum, d) => sum + d.balance, 0),
    criticalCount: filteredDefaulters.filter(d => d.overdueDays > 30).length,
    warningCount: filteredDefaulters.filter(d => d.overdueDays > 7 && d.overdueDays <= 30).length
  };

  const toggleSelectStudent = (admNo) => {
    setSelectedStudents(prev => 
      prev.includes(admNo) 
        ? prev.filter(a => a !== admNo)
        : [...prev, admNo]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredDefaulters.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredDefaulters.map(d => d.admNo));
    }
  };

  const handleSendReminders = () => {
    if (selectedStudents.length === 0) {
      alert('Please select at least one student');
      return;
    }
    setShowReminderModal(true);
  };

  const confirmSendReminders = () => {
    // In a real implementation, this would call an API endpoint
    alert(`Sending ${reminderType} reminders to ${selectedStudents.length} students...`);
    setShowReminderModal(false);
    setSelectedStudents([]);
  };

  const exportToCSV = () => {
    const headers = ['Adm No', 'Name', 'Class', 'Outstanding Amount', 'Overdue Days', 'Email', 'Contact', 'Last Payment'];
    const rows = filteredDefaulters.map(d => [
      d.admNo,
      d.name,
      d.class,
      d.balance,
      d.overdueDays,
      d.email || '',
      d.parentContact || '',
      d.lastPayment || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outstanding_fees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (overdueDays) => {
    if (overdueDays > 30) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (overdueDays > 7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  };

  // Group by class
  const byClass = useMemo(() => {
    const grouped = {};
    filteredDefaulters.forEach(d => {
      if (!grouped[d.class]) {
        grouped[d.class] = [];
      }
      grouped[d.class].push(d);
    });
    return grouped;
  }, [filteredDefaulters]);

  const classStats = Object.entries(byClass).map(([className, students]) => ({
    class: className,
    count: students.length,
    total: students.reduce((sum, s) => sum + s.balance, 0)
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-7 w-7" />
            Outstanding Fees
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {summary.totalDefaulters} students with ₹{summary.totalOutstanding.toLocaleString('en-IN')} pending
          </p>
        </div>
        <div className="flex gap-2">
          {selectedStudents.length > 0 && (
            <button
              onClick={handleSendReminders}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Reminders ({selectedStudents.length})
            </button>
          )}
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
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Defaulters</p>
              <p className="text-3xl font-bold mt-1">{summary.totalDefaulters}</p>
            </div>
            <Users className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Outstanding</p>
              <p className="text-2xl font-bold mt-1">₹{summary.totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
            <DollarSign className="h-12 w-12 text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Critical (30+ days)</p>
              <p className="text-3xl font-bold mt-1">{summary.criticalCount}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Warning (7-30 days)</p>
              <p className="text-3xl font-bold mt-1">{summary.warningCount}</p>
            </div>
            <Calendar className="h-12 w-12 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Class-wise Breakdown */}
      {classStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Class-wise Outstanding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {classStats.map(stat => (
              <div
                key={stat.class}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stat.class}</span>
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-full text-xs font-medium">
                    {stat.count} students
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ₹{stat.total.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                placeholder="Name or adm no..."
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
              Min Amount
            </label>
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="amount">Amount (High to Low)</option>
              <option value="dueDate">Overdue Days (High to Low)</option>
              <option value="name">Name (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Defaulters Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === filteredDefaulters.length && filteredDefaulters.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Contact
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Overdue
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Fee Heads
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDefaulters.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Check className="h-12 w-12 text-green-500" />
                      <p className="text-lg font-medium">No outstanding fees!</p>
                      <p className="text-sm">All students have cleared their dues.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDefaulters.map((defaulter, idx) => (
                  <tr 
                    key={`${defaulter.admNo}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(defaulter.admNo)}
                        onChange={() => toggleSelectStudent(defaulter.admNo)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{defaulter.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {defaulter.admNo} • {defaulter.class}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="space-y-1">
                        {defaulter.email && (
                          <div className="flex items-center gap-1 text-xs">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{defaulter.email}</span>
                          </div>
                        )}
                        {defaulter.parentContact && (
                          <div className="flex items-center gap-1 text-xs">
                            <Phone className="h-3 w-3" />
                            <span>{defaulter.parentContact}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        ₹{defaulter.balance.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(defaulter.overdueDays)}`}>
                        <Calendar className="h-3 w-3" />
                        {defaulter.overdueDays} days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {defaulter.outstandingFees.slice(0, 3).map((fee, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-block px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs"
                          >
                            {fee.feeHead}
                          </span>
                        ))}
                        {defaulter.outstandingFees.length > 3 && (
                          <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{defaulter.outstandingFees.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {onNavigateToPayment && (
                        <button
                          onClick={() => onNavigateToPayment(defaulter)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Collect
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Send Payment Reminders</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Sending to {selectedStudents.length} student(s)
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Select Reminder Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      value="email"
                      checked={reminderType === 'email'}
                      onChange={(e) => setReminderType(e.target.value)}
                      className="w-4 h-4"
                    />
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Email</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send via email</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      value="sms"
                      checked={reminderType === 'sms'}
                      onChange={(e) => setReminderType(e.target.value)}
                      className="w-4 h-4"
                    />
                    <Phone className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">SMS</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send via SMS</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      value="whatsapp"
                      checked={reminderType === 'whatsapp'}
                      onChange={(e) => setReminderType(e.target.value)}
                      className="w-4 h-4"
                    />
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">WhatsApp</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send via WhatsApp</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={confirmSendReminders}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Reminders
                </button>
                <button
                  onClick={() => setShowReminderModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutstandingFeesView;
