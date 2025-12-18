import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Download, MessageCircle, Copy, Filter, X,
  ChevronDown, ChevronUp, Users, DollarSign, Calendar, Phone
} from 'lucide-react';

const DefaultersReminderView = ({ user, students, feeHeads, transactions }) => {
  const [filters, setFilters] = useState({
    class: '',
    groupByStudent: true,
    onlyOverdue: false
  });
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [messageTemplate, setMessageTemplate] = useState(
    `Dear Parent,\n\nThis is a gentle reminder regarding the pending fee payment for {name} (Adm No: {admNo}), Class {class}.\n\nPending Fee Details:\n{lines}\n\nTotal Outstanding: ₹{total}\n\nKindly make the payment at the earliest to avoid any inconvenience.\n\nThank you,\nAyathan Central School`
  );

  // Helper to strip "STD " prefix from class names
  const stripStdPrefix = (className) => {
    if (!className) return '';
    return String(className).replace(/^STD\s+/i, '');
  };

  // Normalize class for comparisons (strip STD and lowercase)
  const normalizeClass = (c) => stripStdPrefix(c).toLowerCase().trim();

  // Determine user's access level
  const normalizedRoles = (user?.roles || []).map(r => String(r).toLowerCase());
  const isHM = normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('head'));
  const isAccounts = normalizedRoles.some(r => r.includes('accounts') || r === 'accountant' || r === 'account');
  const classTeacherFor = user?.classTeacherFor || user?.class || '';

  // Helper: clean phone number to international format
  const cleanPhone = (phone) => {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10 && !cleaned.startsWith('91')) {
      cleaned = '91' + cleaned;
    }
    return cleaned.length >= 10 ? cleaned : null;
  };

  // Helper: format date
  const fmtDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  // Calculate itemized defaulters (one row per unpaid fee head)
  const itemizedDefaulters = useMemo(() => {
    const rows = [];
    
    // Filter students based on role
    let filteredStudents = students || [];
    if (!isHM && !isAccounts && classTeacherFor) {
      // Class teacher sees only their class
      filteredStudents = filteredStudents.filter(s => 
        normalizeClass(s.class) === normalizeClass(classTeacherFor)
      );
    }

    // Apply class filter if selected
    if (filters.class && filters.class !== 'All') {
      filteredStudents = filteredStudents.filter(s => 
        String(s.class || '').toLowerCase() === String(filters.class).toLowerCase()
      );
    }

    filteredStudents.forEach(student => {
      const studentFeeHeads = (feeHeads || []).filter(fh => 
        String(fh.class || '').toLowerCase() === String(student.class || '').toLowerCase()
      );

      const studentTransactions = (transactions || []).filter(t => 
        String(t.admNo) === String(student.admNo) && 
        !String(t.void || '').toUpperCase().startsWith('Y')
      );

      studentFeeHeads.forEach(fh => {
        const fhTransactions = studentTransactions.filter(t => 
          String(t.feeHead || '').toLowerCase() === String(fh.feeHead || '').toLowerCase()
        );
        
        const paid = fhTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const balance = (Number(fh.amount) || 0) - paid;

        if (balance > 0) {
          // Check if overdue
          const dueDate = fh.dueDate ? new Date(fh.dueDate) : null;
          const today = new Date();
          const isOverdue = dueDate && today > dueDate;

          // Skip if onlyOverdue filter is on and not overdue
          if (filters.onlyOverdue && !isOverdue) return;

          rows.push({
            admNo: student.admNo,
            name: student.name,
            class: student.class,
            phone: student.parentContact || student.phone || '',
            feeHead: fh.feeHead,
            amount: balance,
            dueDate: fh.dueDate,
            isOverdue
          });
        }
      });
    });

    // Sort by class, then name, then fee head
    return rows.sort((a, b) =>
      String(a.class).localeCompare(String(b.class)) ||
      String(a.name).localeCompare(String(b.name)) ||
      String(a.feeHead).localeCompare(String(b.feeHead))
    );
  }, [students, feeHeads, transactions, filters, isHM, classTeacherFor]);

  // Group by student
  const groupedDefaulters = useMemo(() => {
    if (!filters.groupByStudent) return null;

    const byStudent = new Map();
    
    itemizedDefaulters.forEach(row => {
      const key = row.admNo;
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          admNo: row.admNo,
          name: row.name,
          class: row.class,
          phone: row.phone,
          items: [],
          total: 0,
          earliestDue: row.dueDate || ''
        });
      }
      const bucket = byStudent.get(key);
      bucket.items.push({
        feeHead: row.feeHead,
        amount: row.amount,
        dueDate: row.dueDate,
        isOverdue: row.isOverdue
      });
      bucket.total += Number(row.amount || 0);
      
      // Track earliest due date
      if (row.dueDate) {
        if (!bucket.earliestDue) {
          bucket.earliestDue = row.dueDate;
        } else if (new Date(row.dueDate) < new Date(bucket.earliestDue)) {
          bucket.earliestDue = row.dueDate;
        }
      }
    });

    const arr = Array.from(byStudent.values());
    arr.sort((a, b) =>
      String(a.class).localeCompare(String(b.class)) ||
      String(a.name).localeCompare(String(b.name))
    );
    
    return arr;
  }, [itemizedDefaulters, filters.groupByStudent]);

  // Get unique classes for filter
  const availableClasses = useMemo(() => {
    let classList = [...new Set((students || []).map(s => s.class))].filter(Boolean);
    
    // Filter by role
    if (!isHM && !isAccounts && classTeacherFor) {
      classList = classList.filter(c => 
        normalizeClass(c) === normalizeClass(classTeacherFor)
      );
    }
    
    return classList.sort();
  }, [students, isHM, classTeacherFor]);

  // Render WhatsApp message for a student group
  const renderGroupedMessage = (group) => {
    const lines = group.items.map(it =>
      `${it.feeHead}: ₹${Number(it.amount || 0).toLocaleString('en-IN')} (Due: ${fmtDate(it.dueDate)})`
    ).join('\n');
    
    return messageTemplate
      .replace('{name}', group.name)
      .replace('{admNo}', group.admNo)
      .replace('{class}', group.class)
      .replace('{lines}', lines)
      .replace('{total}', Number(group.total || 0).toLocaleString('en-IN'));
  };

  // Render WhatsApp message for single item
  const renderItemMessage = (item) => {
    const line = `${item.feeHead}: ₹${Number(item.amount || 0).toLocaleString('en-IN')} (Due: ${fmtDate(item.dueDate)})`;
    
    return messageTemplate
      .replace('{name}', item.name)
      .replace('{admNo}', item.admNo)
      .replace('{class}', item.class)
      .replace('{lines}', line)
      .replace('{total}', Number(item.amount || 0).toLocaleString('en-IN'));
  };

  // Download CSV
  const downloadCSV = () => {
    if (filters.groupByStudent && groupedDefaulters) {
      const header = ['AdmNo', 'Name', 'Class', 'Phone', 'Fee Heads', 'Total', 'Earliest Due'];
      const lines = [header.join(',')].concat(
        groupedDefaulters.map(g =>
          [
            g.admNo,
            `"${(g.name || '').replace(/"/g, '""')}"`,
            g.class,
            `"${g.phone || ''}"`,
            `"${g.items.map(i => `${i.feeHead} (₹${i.amount})`).join('; ')}"`,
            g.total,
            fmtDate(g.earliestDue)
          ].join(',')
        )
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fee_defaulters_grouped.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = ['AdmNo', 'Name', 'Class', 'Phone', 'Fee Head', 'Amount', 'Due Date'];
      const lines = [header.join(',')].concat(
        itemizedDefaulters.map(r =>
          [
            r.admNo,
            `"${r.name}"`,
            r.class,
            `"${r.phone || ''}"`,
            `"${r.feeHead}"`,
            r.amount,
            fmtDate(r.dueDate)
          ].join(',')
        )
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fee_defaulters.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalDefaulters = filters.groupByStudent && groupedDefaulters 
    ? groupedDefaulters.length 
    : itemizedDefaulters.length;

  const totalOutstanding = filters.groupByStudent && groupedDefaulters
    ? groupedDefaulters.reduce((sum, g) => sum + g.total, 0)
    : itemizedDefaulters.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-xl p-4 sm:p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Fee Defaulters & Reminders</h2>
            <p className="text-orange-100 text-sm">
              {isHM ? 'All Classes' : (isAccounts ? 'Accounts - All Classes' : `Class Teacher - ${stripStdPrefix(classTeacherFor)}`)}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs text-orange-100">Total Defaulters</span>
            </div>
            <p className="text-2xl font-bold">{totalDefaulters}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs text-orange-100">Outstanding</span>
            </div>
            <p className="text-2xl font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
          </div>
          <button
            onClick={downloadCSV}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            >
              <option value="">All Classes</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{stripStdPrefix(c)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={filters.groupByStudent}
                onChange={(e) => setFilters(prev => ({ ...prev, groupByStudent: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Group by Student</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={filters.onlyOverdue}
                onChange={(e) => setFilters(prev => ({ ...prev, onlyOverdue: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Only Overdue</span>
            </label>
          </div>
        </div>

        {/* Message Template */}
        <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            Message Template
          </summary>
          <div className="p-3">
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm"
              placeholder="Enter message template..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Available placeholders: {'{name}'}, {'{admNo}'}, {'{class}'}, {'{lines}'}, {'{total}'}
            </p>
          </div>
        </details>
      </div>

      {/* Results */}
      {filters.groupByStudent && groupedDefaulters ? (
        // Grouped by Student View
        <div className="space-y-3">
          {groupedDefaulters.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No fee defaulters found</p>
            </div>
          ) : (
            groupedDefaulters.map((group) => {
              const phone = cleanPhone(group.phone);
              const message = renderGroupedMessage(group);
              const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
              const isExpanded = expandedStudent === group.admNo;

              return (
                <div key={group.admNo} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                  {/* Header */}
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {group.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {group.admNo} • {stripStdPrefix(group.class)}
                        </p>
                        {group.phone && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {group.phone}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          ₹{group.total.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {group.items.length} fee{group.items.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fee Items */}
                  <div className="p-4 space-y-3">
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : group.admNo)}
                      className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <span>Fee Details ({group.items.length})</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                        {group.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start text-sm">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{item.feeHead}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {fmtDate(item.dueDate)}
                                {item.isOverdue && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs">
                                    Overdue
                                  </span>
                                )}
                              </p>
                            </div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              ₹{item.amount.toLocaleString('en-IN')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      ) : (
                        <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-lg text-center text-sm">
                          No Phone
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(message);
                            alert('Message copied to clipboard!');
                          } catch {
                            alert('Failed to copy message');
                          }
                        }}
                        className="px-4 py-2 border border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        // Itemized Table View
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {itemizedDefaulters.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No fee defaulters found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fee Head
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {itemizedDefaulters.map((row, idx) => {
                    const phone = cleanPhone(row.phone);
                    const message = renderItemMessage(row);
                    const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;

                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-3 text-sm">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{row.admNo}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {stripStdPrefix(row.class)}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {row.feeHead}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                          ₹{row.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div>
                            <p>{fmtDate(row.dueDate)}</p>
                            {row.isOverdue && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex gap-1">
                            {whatsappHref ? (
                              <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                <MessageCircle className="h-3 w-3 inline" />
                              </a>
                            ) : (
                              <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-400 rounded text-xs">
                                No Phone
                              </span>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(message);
                                  alert('Copied!');
                                } catch {
                                  alert('Copy failed');
                                }
                              }}
                              className="px-2 py-1 border border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs"
                            >
                              <Copy className="h-3 w-3 inline" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DefaultersReminderView;
