import React, { useState } from 'react';
import { 
  Search, Filter, Download, Calendar, DollarSign, Eye,
  ChevronDown, ChevronUp, Printer, X, CheckCircle, XCircle
} from 'lucide-react';
import { confirmDestructive } from '../../utils/confirm';

const TransactionHistory = ({ transactions, onVoidReceipt, onRefresh }) => {
  const TIME_ZONE = 'Asia/Kolkata';
  const toYMDInTimeZone = (dateInput, timeZone = TIME_ZONE) => {
    if (!dateInput) return '';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (!year || !month || !day) return '';
    return `${year}-${month}-${day}`;
  };

  const normalizeText = (value) => String(value ?? '').trim();

  const [filters, setFilters] = useState({
    search: '',
    class: '',
    feeHead: '',
    mode: '',
    status: 'valid', // valid, voided, all
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  });
  const [sortBy, setSortBy] = useState('date'); // date, amount, receiptNo
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Get unique values for filters
  const classes = [...new Set((transactions || []).map(t => normalizeText(t.class)))].filter(Boolean).sort();
  const feeHeads = [...new Set((transactions || []).map(t => normalizeText(t.feeHead)))].filter(Boolean).sort();
  const modes = [...new Set((transactions || []).map(t => normalizeText(t.mode)))].filter(Boolean).sort();

  // Apply filters
  const filteredTransactions = (transactions || [])
    .filter(t => {
      const tClass = normalizeText(t.class);
      const tFeeHead = normalizeText(t.feeHead);
      const tMode = normalizeText(t.mode);

      // Search filter
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!(
          String(t.admNo).toLowerCase().includes(term) ||
          t.name?.toLowerCase().includes(term) ||
          t.receiptNo?.toLowerCase().includes(term) ||
          tClass.toLowerCase().includes(term)
        )) return false;
      }

      // Class filter
      if (filters.class && tClass !== filters.class) return false;

      // Fee head filter
      if (filters.feeHead && tFeeHead !== filters.feeHead) return false;

      // Mode filter
      if (filters.mode && tMode !== filters.mode) return false;

      // Status filter
      const isVoid = String(t.void || '').toUpperCase().startsWith('Y');
      if (filters.status === 'valid' && isVoid) return false;
      if (filters.status === 'voided' && !isVoid) return false;

      // Date range
      // IMPORTANT: Google Sheets dates often come as UTC midnight-ish timestamps (e.g. 2026-01-02T18:30Z)
      // which represents 2026-01-03 in IST. So we must compare using the IST date.
      if (filters.dateFrom || filters.dateTo) {
        const transactionYMD = toYMDInTimeZone(t.date);
        if (filters.dateFrom && transactionYMD < filters.dateFrom) return false;
        if (filters.dateTo && transactionYMD > filters.dateTo) return false;
      }

      // Amount range
      const totalAmount = (Number(t.amount) || 0) + (Number(t.fine) || 0);
      if (filters.minAmount && totalAmount < Number(filters.minAmount)) return false;
      if (filters.maxAmount && totalAmount > Number(filters.maxAmount)) return false;

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        comparison = aTime - bTime;
      } else if (sortBy === 'amount') {
        const aTotal = (Number(a.amount) || 0) + (Number(a.fine) || 0);
        const bTotal = (Number(b.amount) || 0) + (Number(b.fine) || 0);
        comparison = aTotal - bTotal;
      } else if (sortBy === 'receiptNo') {
        comparison = (a.receiptNo || '').localeCompare(b.receiptNo || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      class: '',
      feeHead: '',
      mode: '',
      status: 'valid',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const filterToday = () => {
    const today = toYMDInTimeZone(new Date());
    setFilters(prev => ({
      ...prev,
      dateFrom: today,
      dateTo: today
    }));
    setShowFilters(false); // Close filters panel
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Receipt No', 'Adm No', 'Student Name', 'Class', 'Fee Head', 'Amount', 'Fine', 'Total', 'Mode', 'Status'];
    const rows = filteredTransactions.map(t => [
      toYMDInTimeZone(t.date),
      t.receiptNo,
      t.admNo,
      t.name,
      normalizeText(t.class),
      normalizeText(t.feeHead),
      t.amount,
      t.fine,
      (Number(t.amount) || 0) + (Number(t.fine) || 0),
      normalizeText(t.mode),
      String(t.void || '').toUpperCase().startsWith('Y') ? 'Voided' : 'Valid'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${toYMDInTimeZone(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate summary
  const summary = {
    total: filteredTransactions.length,
    totalAmount: filteredTransactions.reduce((sum, t) => {
      if (String(t.void || '').toUpperCase().startsWith('Y')) return sum;
      return sum + (Number(t.amount) || 0) + (Number(t.fine) || 0);
    }, 0),
    totalFine: filteredTransactions.reduce((sum, t) => {
      if (String(t.void || '').toUpperCase().startsWith('Y')) return sum;
      return sum + (Number(t.fine) || 0);
    }, 0),
    voided: filteredTransactions.filter(t => String(t.void || '').toUpperCase().startsWith('Y')).length
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transaction History</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {summary.total} transactions • ₹{summary.totalAmount.toLocaleString('en-IN')} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={filterToday}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            title="Filter today's transactions"
          >
            <Calendar className="h-4 w-4" />
            Today
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Amount Collected</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            ₹{summary.totalAmount.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Fine Collected</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            ₹{summary.totalFine.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Voided</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{summary.voided}</p>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  placeholder="Receipt, name, or adm no..."
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
                Fee Head
              </label>
              <select
                value={filters.feeHead}
                onChange={(e) => setFilters(prev => ({ ...prev, feeHead: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">All Fee Heads</option>
                {feeHeads.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Mode
              </label>
              <select
                value={filters.mode}
                onChange={(e) => setFilters(prev => ({ ...prev, mode: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">All Modes</option>
                {modes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="valid">Valid Only</option>
                <option value="voided">Voided Only</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    {sortBy === 'date' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleSort('receiptNo')}
                >
                  <div className="flex items-center gap-2">
                    Receipt
                    {sortBy === 'receiptNo' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Fee Head
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Amount
                    {sortBy === 'amount' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Fine
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Mode
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, idx) => {
                  const isVoid = String(t.void || '').toUpperCase().startsWith('Y');
                  const totalAmount = (Number(t.amount) || 0) + (Number(t.fine) || 0);
                  
                  return (
                    <tr 
                      key={`${t.receiptNo}-${t.admNo}-${idx}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${
                        isVoid ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {t.date ? new Date(t.date).toLocaleDateString('en-IN', { timeZone: TIME_ZONE }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {t.receiptNo}
                        {isVoid && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            VOID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t.admNo} • {t.class}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.feeHead}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ₹{Number(t.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400 whitespace-nowrap font-medium">
                        {Number(t.fine) > 0 ? `₹${Number(t.fine).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                        ₹{totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {t.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedReceipt(t)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          {!isVoid && onVoidReceipt && (
                            <button
                              onClick={() => {
                                const ok = confirmDestructive({
                                  title: 'Void this receipt?',
                                  lines: [
                                    `Receipt No: ${t.receiptNo}`,
                                    `Student: ${t.name || '-'} (${t.admNo || '-'})`,
                                    `Class: ${t.class || '-'}`,
                                    `Amount: ₹${totalAmount.toLocaleString('en-IN')}`
                                  ]
                                });
                                if (!ok) return;
                                onVoidReceipt(t.receiptNo);
                              }}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Void Receipt"
                            >
                              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Receipt Details</h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receipt No</p>
                  <p className="font-mono font-bold text-gray-900 dark:text-gray-100">{selectedReceipt.receiptNo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedReceipt.date ? new Date(selectedReceipt.date).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Student Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedReceipt.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Admission No</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedReceipt.admNo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Class</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedReceipt.class}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Payment Mode</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedReceipt.mode}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fee Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Fee Head:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedReceipt.feeHead}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ₹{Number(selectedReceipt.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Fine:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      ₹{Number(selectedReceipt.fine).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      ₹{((Number(selectedReceipt.amount) || 0) + (Number(selectedReceipt.fine) || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => window.print()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={() => setSelectedReceipt(null)}
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

export default TransactionHistory;
