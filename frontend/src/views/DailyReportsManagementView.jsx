import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import { RefreshCw, Search, Trash2 } from 'lucide-react';

// Daily Reports Management View (HM only)
// Allows browsing of daily reports across the school with filters for
// teacher, class, subject, date range and completion status.
const DailyReportsManagementView = ({ user }) => {
  const [loadingReports, setLoadingReports] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // Empty = All
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Load all reports ONCE on component mount with default 30-day range
  useEffect(() => {
    async function fetchAllReports() {
      setLoadingReports(true);
      try {
        // Default to last 30 days if no dates set
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const defaultFrom = thirtyDaysAgo.toISOString().split('T')[0];
        const defaultTo = today.toISOString().split('T')[0];
        
        setFromDate(defaultFrom);
        setToDate(defaultTo);
        
        const data = await api.getDailyReports({
          teacher: '',
          cls: '',
          subject: '',
          fromDate: defaultFrom,
          toDate: defaultTo
        });
        const reports = Array.isArray(data) ? data : [];
        
        // Sort by date descending (newest first)
        reports.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateB - dateA;
        });
        
        setAllReports(reports);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setAllReports([]);
      } finally {
        setLoadingReports(false);
      }
    }
    if (user) {
      fetchAllReports();
    }
  }, [user]);

  // CLIENT-SIDE FILTERING
  const filteredReports = useMemo(() => {
    let result = allReports;
    
    // Filter by status
    if (statusFilter) {
      result = result.filter(r => r.completed === statusFilter);
    }
    
    // Filter by teacher
    if (selectedTeacher) {
      result = result.filter(r => r.teacherName === selectedTeacher);
    }
    
    // Filter by class
    if (selectedClass) {
      result = result.filter(r => r.class === selectedClass);
    }
    
    // Filter by subject
    if (selectedSubject) {
      result = result.filter(r => r.subject === selectedSubject);
    }

    // Filter by chapter
    if (selectedChapter) {
      result = result.filter(r => String(r.chapter || '').trim() === selectedChapter);
    }
    
    return result;
  }, [allReports, statusFilter, selectedTeacher, selectedClass, selectedSubject, selectedChapter]);

  // Get unique values for dropdowns
  const uniqueTeachers = useMemo(() => {
    return [...new Set(allReports.map(r => r.teacherName).filter(Boolean))].sort();
  }, [allReports]);

  const uniqueClasses = useMemo(() => {
    return [...new Set(allReports.map(r => r.class).filter(Boolean))].sort();
  }, [allReports]);

  const uniqueSubjects = useMemo(() => {
    return [...new Set(allReports.map(r => r.subject).filter(Boolean))].sort();
  }, [allReports]);

  const uniqueChapters = useMemo(() => {
    return [...new Set(allReports.map(r => String(r.chapter || '').trim()).filter(Boolean))].sort();
  }, [allReports]);

  // Reload reports with new date range
  const handleApplyDateFilter = async () => {
    if (!fromDate || !toDate) {
      alert('Please select both From and To dates');
      return;
    }
    
    setLoadingReports(true);
    try {
      const data = await api.getDailyReports({
        teacher: '',
        cls: '',
        subject: '',
        fromDate: fromDate,
        toDate: toDate
      });
      const reports = Array.isArray(data) ? data : [];
      
      // Sort by date descending (newest first)
      reports.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });
      
      setAllReports(reports);
      // Reset other filters when loading new date range
      setSelectedTeacher('');
      setSelectedClass('');
      setSelectedSubject('');
      setSelectedChapter('');
      setStatusFilter('');
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">All Daily Reports</h1>
        <button
          onClick={handleApplyDateFilter}
          disabled={loadingReports}
          className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 text-sm disabled:opacity-50"
        >
          {loadingReports ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Load Range
            </>
          )}
        </button>
      </div>

      {/* Date Range Filter - Primary */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm p-3 md:p-4 border border-purple-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="flex-1 sm:flex-initial px-2 md:px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="flex-1 sm:flex-initial px-2 md:px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="text-xs text-gray-600">
            Showing {allReports.length} reports
          </div>
        </div>
      </div>

      {/* Secondary Filters - Dropdowns and Status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
          {/* Teacher Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Teacher:</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[180px]"
            >
              <option value="">All Teachers</option>
              {uniqueTeachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* Class Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[120px]"
            >
              <option value="">All Classes</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Subject Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Subject:</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[150px]"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {/* Chapter Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Chapter:</label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[180px]"
            >
              <option value="">All Chapters</option>
              {uniqueChapters.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>

          {/* Status Quick Filters */}
          <div className="flex gap-2 w-full md:w-auto md:ml-auto flex-wrap">
            <button
              onClick={() => setStatusFilter('Fully Completed')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                statusFilter === 'Fully Completed'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ✓ Completed
            </button>
            <button
              onClick={() => setStatusFilter('Partially Completed')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                statusFilter === 'Partially Completed'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ◐ Partial
            </button>
            <button
              onClick={() => setStatusFilter('Not Started')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                statusFilter === 'Not Started'
                  ? 'bg-gray-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ○ Not Started
            </button>
            <button
              onClick={() => setStatusFilter('')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                !statusFilter
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All Status
            </button>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(selectedTeacher || selectedClass || selectedSubject || selectedChapter) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedTeacher && (
              <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                Teacher: {selectedTeacher}
                <button onClick={() => setSelectedTeacher('')} className="ml-1 hover:text-blue-900">×</button>
              </span>
            )}
            {selectedClass && (
              <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                Class: {selectedClass}
                <button onClick={() => setSelectedClass('')} className="ml-1 hover:text-green-900">×</button>
              </span>
            )}
            {selectedSubject && (
              <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
                Subject: {selectedSubject}
                <button onClick={() => setSelectedSubject('')} className="ml-1 hover:text-purple-900">×</button>
              </span>
            )}
            {selectedChapter && (
              <span className="inline-flex items-center px-2 md:px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded-full font-medium">
                Chapter: {selectedChapter}
                <button onClick={() => setSelectedChapter('')} className="ml-1 hover:text-amber-900">×</button>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Daily Report Records ({filteredReports.length})</h2>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
          {filteredReports.map((r, idx) => {
            const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
            const onDelete = async () => {
              if (!id) return alert('Missing report id');
              if (!confirm(
                `Delete this report? This cannot be undone.\n\n` +
                `Date: ${r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}\n` +
                `Teacher: ${r.teacherName || r.teacherEmail || '-'}\n` +
                `Class: ${r.class || '-'}\n` +
                `Subject: ${r.subject || '-'}\n` +
                `Period: ${r.period || '-'}\n`
              )) return;
              try {
                setDeletingId(id);
                const res = await api.deleteDailyReport(id, user.email);
                if (res && res.success) {
                  setAllReports(prev => prev.filter(x => (x.id || x.reportId || `${(x.date||'').toString()}|${x.class||''}|${x.subject||''}|${x.period||''}|${String(x.teacherEmail||'').toLowerCase()}`) !== id));
                } else {
                  alert('Delete failed: ' + (res && res.error ? res.error : 'Not allowed'));
                }
              } catch (err) {
                alert('Delete failed: ' + (err && err.message ? err.message : String(err)));
              } finally {
                setDeletingId(null);
              }
            };
            return (
              <div key={idx} className="border-b border-gray-200 p-3 hover:bg-gray-50">
                {/* Header: Date & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm text-gray-900">
                    {r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </div>
                  {r.completed === 'Fully Completed' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Fully Completed
                    </span>
                  ) : r.completed === 'Partially Completed' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      ◐ Partial
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      ○ Not Started
                    </span>
                  )}
                </div>
                
                {/* Teacher Name */}
                <div className="text-sm font-medium text-gray-900 mb-1.5">{r.teacherName}</div>
                
                {/* Class, Subject & Period */}
                <div className="text-xs text-gray-600 mb-1.5">
                  {r.class} • {r.subject} • Period {r.period}
                </div>

                {/* Chapter */}
                {r.chapter && (
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                      Chapter: {r.chapter}
                    </span>
                  </div>
                )}
                
                {/* Plan Type */}
                {r.planType && (
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {r.planType}
                    </span>
                  </div>
                )}
                
                {/* Objectives */}
                {r.objectives && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-700 mb-0.5">Objectives:</div>
                    <div className="text-xs text-gray-600 line-clamp-2 break-words">{r.objectives}</div>
                  </div>
                )}
                
                {/* Activities */}
                {r.activities && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-0.5">Activities:</div>
                    <div className="text-xs text-gray-600 line-clamp-2 break-words">{r.activities}</div>
                  </div>
                )}
                
                {/* Action Button */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={onDelete} 
                    disabled={!id || deletingId === id} 
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-40"
                  >
                    {deletingId === id ? (
                      <>
                        <span className="inline-block h-3 w-3 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredReports.length === 0 && !loadingReports && (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              No reports found.
            </div>
          )}
          {loadingReports && (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              Loading reports...
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objectives</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReports.map((r, idx) => {
                const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                const onDelete = async () => {
                  if (!id) return alert('Missing report id');
                  if (!confirm(
                    `Delete this report? This cannot be undone.\n\n` +
                    `Date: ${r.date || '-'}\n` +
                    `Teacher: ${r.teacherName || r.teacherEmail || '-'}\n` +
                    `Class: ${r.class || '-'}\n` +
                    `Subject: ${r.subject || '-'}\n` +
                    `Period: ${r.period || '-'}\n`
                  )) return;
                  try {
                    setDeletingId(id);
                    const res = await api.deleteDailyReport(id, user.email);
                    if (res && res.success) {
                      setAllReports(prev => prev.filter(x => (x.id || x.reportId || `${(x.date||'').toString()}|${x.class||''}|${x.subject||''}|${x.period||''}|${String(x.teacherEmail||'').toLowerCase()}`) !== id));
                    } else {
                      alert('Delete failed: ' + (res && res.error ? res.error : 'Not allowed'));
                    }
                  } catch (err) {
                    alert('Delete failed: ' + (err && err.message ? err.message : String(err)));
                  } finally {
                    setDeletingId(null);
                  }
                };
                return (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.teacherName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.class}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.chapter || ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.period}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.planType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.completed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.objectives}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.activities}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <button onClick={onDelete} disabled={!id || deletingId === id} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 disabled:opacity-40 inline-flex items-center">
                      {deletingId === id && (
                        <span className="inline-block h-3 w-3 mr-1 border-2 border-red-600/70 border-t-transparent rounded-full animate-spin"></span>
                      )}
                      {deletingId === id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              )})}
              {filteredReports.length === 0 && !loadingReports && (
                <tr>
                  <td colSpan={11} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    No reports found.
                  </td>
                </tr>
              )}
              {loadingReports && (
                <tr>
                  <td colSpan={11} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    Loading reports...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyReportsManagementView;
