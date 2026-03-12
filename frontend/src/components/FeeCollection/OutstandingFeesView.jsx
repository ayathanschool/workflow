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
    route: '',
    minAmount: '',
    sortBy: 'amount', // amount, dueDate, name
    onlyOverdue: false,
    includeSchoolFee: true,
    includeTransport: true
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

        // Class-wide fee heads + per-student monthly transport installments (start–end month)
        const now = new Date();
        const ayStart = (now.getMonth() + 1 >= 6) ? now.getFullYear() : now.getFullYear() - 1;
        const transportFeeAmt = Number(student.transportFee) || 0;
        const ayIdx = (m) => m >= 6 ? m - 6 : m + 6;
        const startM = Number(student.transportStartMonth) || 6;
        const endM   = Number(student.transportEndMonth)   || 3;
        // Skip months already covered by class-level fee heads (avoids duplicates)
        const existingFeeHeadNames = new Set(
          (feeHeads || [])
            .filter(fh => String(fh.class || '').toLowerCase() === String(student.class || '').toLowerCase())
            .map(fh => String(fh.feeHead || '').toLowerCase())
        );
        const transportFeeHeads = transportFeeAmt > 0 ? [
          { name: 'June',      m: 6,  y: ayStart },
          { name: 'July',      m: 7,  y: ayStart },
          { name: 'August',    m: 8,  y: ayStart },
          { name: 'September', m: 9,  y: ayStart },
          { name: 'October',   m: 10, y: ayStart },
          { name: 'November',  m: 11, y: ayStart },
          { name: 'December',  m: 12, y: ayStart },
          { name: 'January',   m: 1,  y: ayStart + 1 },
          { name: 'February',  m: 2,  y: ayStart + 1 },
          { name: 'March',     m: 3,  y: ayStart + 1 }
        ]
        .filter(mo => { const i = ayIdx(mo.m); return i >= ayIdx(startM) && i <= ayIdx(endM); })
        .filter(mo => !existingFeeHeadNames.has(`transport ${mo.name.toLowerCase()}`))
        .map(mo => ({
          feeHead: `Transport ${mo.name}`,
          class: student.class,
          amount: transportFeeAmt,
          dueDate: `${mo.y}-${String(mo.m).padStart(2, '0')}-15`
        })) : [];

        const studentFeeHeads = [
          ...(feeHeads || []).filter(fh => fh.class === student.class),
          ...transportFeeHeads
        ];

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
            const fhKey = String(fh.feeHead || '').trim().toLowerCase();
            const fhTransactions = studentTransactions.filter(t => String(t.feeHead || '').trim().toLowerCase() === fhKey);
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
    .map(d => {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // end of today

      // Narrow fee list by fee-type checkboxes first
      let visibleFees = (d.outstandingFees || []).filter(f => {
        const isTransport = String(f.feeHead || '').toLowerCase().startsWith('transport ');
        if (isTransport && !filters.includeTransport) return false;
        if (!isTransport && !filters.includeSchoolFee) return false;
        return true;
      });
      // When "Only Due" is on, further restrict to fees whose due date has passed
      if (filters.onlyOverdue) {
        visibleFees = visibleFees.filter(f => f.dueDate && new Date(f.dueDate) <= today);
      }
      const visibleBalance = visibleFees.reduce((sum, f) => sum + f.balance, 0);
      // Overdue days from earliest overdue due date among visible fees
      const overdueDueDates = visibleFees
        .filter(f => f.dueDate && new Date(f.dueDate) <= today)
        .map(f => new Date(f.dueDate));
      const visibleOverdueDays = overdueDueDates.length > 0
        ? Math.max(0, Math.floor((today - new Date(Math.min(...overdueDueDates))) / 86400000))
        : 0;
      return { ...d, visibleBalance, visibleFees, visibleOverdueDays };
    })
    .filter(d => {
      if (d.visibleBalance <= 0) return false;

      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!(
          String(d.admNo).toLowerCase().includes(term) ||
          d.name?.toLowerCase().includes(term) ||
          d.class?.toLowerCase().includes(term) ||
          String(d.transportRoute || '').toLowerCase().includes(term)
        )) return false;
      }

      if (filters.class && d.class !== filters.class) return false;

      if (filters.route && String(d.transportRoute || '').toLowerCase() !== filters.route.toLowerCase()) return false;

      if (filters.minAmount && d.visibleBalance < Number(filters.minAmount)) return false;

      // Only overdue: must have at least one visible fee past its due date
      if (filters.onlyOverdue && d.visibleOverdueDays <= 0) return false;

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'amount') return b.visibleBalance - a.visibleBalance;
      if (filters.sortBy === 'dueDate') return b.visibleOverdueDays - a.visibleOverdueDays;
      if (filters.sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  const classes = [...new Set((students || []).map(s => s.class))].filter(Boolean).sort();
  const routes = Object.values(
    (students || []).reduce((acc, s) => {
      const raw = String(s.transportRoute || '').trim();
      if (!raw) return acc;
      const key = raw.toLowerCase();
      if (!acc[key]) acc[key] = raw;
      return acc;
    }, {})
  ).sort();

  const summary = {
    totalDefaulters: filteredDefaulters.length,
    totalOutstanding: filteredDefaulters.reduce((sum, d) => sum + d.visibleBalance, 0),
    criticalCount: filteredDefaulters.filter(d => d.visibleOverdueDays > 30).length,
    warningCount: filteredDefaulters.filter(d => d.visibleOverdueDays > 7 && d.visibleOverdueDays <= 30).length
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
    const headers = ['Adm No', 'Name', 'Class', 'Route', 'Outstanding Amount', 'Overdue Days', 'Email', 'Contact', 'Last Payment'];
    const rows = filteredDefaulters.map(d => [
      d.admNo,
      d.name,
      d.class,
      d.transportRoute || '',
      d.visibleBalance,
      d.visibleOverdueDays,
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
    total: students.reduce((sum, s) => sum + s.visibleBalance, 0)
  })).sort((a, b) => b.total - a.total);

  const byRoute = useMemo(() => {
    const grouped = {};
    filteredDefaulters.filter(d => d.transportRoute).forEach(d => {
      const route = String(d.transportRoute).trim();
      if (!grouped[route]) grouped[route] = [];
      grouped[route].push(d);
    });
    return grouped;
  }, [filteredDefaulters]);

  const routeStats = Object.entries(byRoute).map(([route, routeStudents]) => ({
    route,
    count: routeStudents.length,
    total: routeStudents.reduce((sum, s) => sum + s.visibleBalance, 0),
    transportBalance: routeStudents.reduce((sum, s) => {
      const transportOut = (s.visibleFees || []).filter(f =>
        String(f.feeHead || '').toLowerCase().startsWith('transport')
      );
      return sum + transportOut.reduce((s2, f) => s2 + f.balance, 0);
    }, 0)
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
            Outstanding Fees
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {summary.totalDefaulters} students with ₹{summary.totalOutstanding.toLocaleString('en-IN')} pending
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs">Total Defaulters</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">{summary.totalDefaulters}</p>
            </div>
            <Users className="h-8 w-8 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs">Total Outstanding</p>
              <p className="text-lg font-bold mt-0.5">₹{summary.totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs">Critical (30+ days)</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">{summary.criticalCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-xs">Warning (7-30 days)</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">{summary.warningCount}</p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Class-wise Breakdown */}
      {classStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Class-wise Outstanding</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{classStats.length} classes</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {classStats.map(stat => {
              const maxTotal = Math.max(...classStats.map(s => s.total));
              const pct = maxTotal > 0 ? (stat.total / maxTotal * 100) : 0;
              return (
                <button
                  key={stat.class}
                  onClick={() => setFilters(prev => ({ ...prev, class: prev.class === stat.class ? '' : stat.class }))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                    filters.class === stat.class ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <span className={`text-xs font-semibold w-10 shrink-0 ${
                    filters.class === stat.class ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>{stat.class}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-red-400 rounded-full h-1.5 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right shrink-0">{stat.count} stu.</span>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 w-20 text-right shrink-0">₹{stat.total.toLocaleString('en-IN')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Route-wise Breakdown */}
      {routeStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">🚌 Route-wise Transport Outstanding</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{routeStats.length} routes</span>
          </div>
          <div className="divide-y divide-amber-50 dark:divide-gray-700">
            {routeStats.map(stat => {
              const maxTotal = Math.max(...routeStats.map(s => s.total));
              const pct = maxTotal > 0 ? (stat.total / maxTotal * 100) : 0;
              return (
                <button
                  key={stat.route}
                  onClick={() => setFilters(prev => ({ ...prev, route: prev.route === stat.route ? '' : stat.route }))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors text-left ${
                    filters.route === stat.route ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                  }`}
                >
                  <span className={`text-xs font-semibold w-16 shrink-0 ${
                    filters.route === stat.route ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>🚌 {stat.route}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-amber-400 rounded-full h-1.5 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right shrink-0">{stat.count} stu.</span>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 w-20 text-right shrink-0">₹{stat.total.toLocaleString('en-IN')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Name or adm no..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Class */}
          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Route */}
          {routes.length > 0 && (
            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Route</label>
              <select
                value={filters.route}
                onChange={(e) => setFilters(prev => ({ ...prev, route: e.target.value }))}
                className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg text-sm"
              >
                <option value="">🚌 All Routes</option>
                {routes.map(r => <option key={r} value={r}>🚌 {r}</option>)}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="amount">Amount (High to Low)</option>
              <option value="dueDate">Overdue Days</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-4 pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.onlyOverdue}
                onChange={(e) => setFilters(prev => ({ ...prev, onlyOverdue: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Only Due</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.includeSchoolFee}
                onChange={(e) => setFilters(prev => ({ ...prev, includeSchoolFee: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">🏫 School Fee</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.includeTransport}
                onChange={(e) => setFilters(prev => ({ ...prev, includeTransport: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">🚌 Transport</span>
            </label>
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
                        {defaulter.transportRoute && (
                          <p className="text-xs mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                              🚌 {defaulter.transportRoute}
                            </span>
                          </p>
                        )}
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
                        ₹{defaulter.visibleBalance.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(defaulter.visibleOverdueDays)}`}>
                        <Calendar className="h-3 w-3" />
                        {defaulter.visibleOverdueDays} days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {defaulter.visibleFees.slice(0, 3).map((fee, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-block px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs"
                          >
                            {fee.feeHead}
                          </span>
                        ))}
                        {defaulter.visibleFees.length > 3 && (
                          <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{defaulter.visibleFees.length - 3}
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
