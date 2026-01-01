import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  X, 
  Check, 
  LayoutGrid, 
  BookOpen 
} from 'lucide-react';
import * as api from '../api';

const SchemeApprovalsView = ({ 
  stripStdPrefix,
  openLessonView,
  withSubmit
}) => {
  const [allSchemes, setAllSchemes] = useState([]); // Store all schemes loaded once
  const [loading, setLoading] = useState(true); // Add loading state
  const [selectedSchemes, setSelectedSchemes] = useState(new Set()); // For bulk selection
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [groupByClass, setGroupByClass] = useState(false);
  const [groupByChapter, setGroupByChapter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Pending'); // Default to pending

  // Ensure sidebar state doesn't auto-toggle here to avoid flicker on mobile

  // Load all schemes ONCE on component mount
  useEffect(() => {
    async function fetchAllSchemes() {
      setLoading(true);
      try {
        const data = await api.getAllSchemes(1, 1000, '', '', '', '', ''); // Get all schemes
        const schemes = Array.isArray(data) ? data : (Array.isArray(data?.plans) ? data.plans : []);
        
        // Sort by createdAt in descending order (latest first)
        schemes.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        setAllSchemes(schemes);
      } catch (err) {
        console.error('Error fetching schemes:', err);
        setAllSchemes([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAllSchemes();
  }, []); // Empty dependency - load only once

  // CLIENT-SIDE FILTERING
  const filteredSchemes = useMemo(() => {
    let result = allSchemes;
    
    // Filter by status
    if (statusFilter && statusFilter !== 'All') {
      result = result.filter(s => s.status === statusFilter);
    }
    
    // Filter by teacher
    if (selectedTeacher) {
      result = result.filter(s => s.teacherName === selectedTeacher);
    }
    
    // Group by class if enabled
    if (groupByClass) {
      result = [...result].sort((a, b) => (a.class || '').localeCompare(b.class || ''));
    }
    
    // Group by chapter if enabled
    if (groupByChapter) {
      result = [...result].sort((a, b) => (a.chapter || '').localeCompare(b.chapter || ''));
    }
    
    return result;
  }, [allSchemes, statusFilter, selectedTeacher, groupByClass, groupByChapter]);

  // Get unique values for dropdowns - optimized with useMemo
  const uniqueTeachers = useMemo(() => {
    return [...new Set(allSchemes.map(s => s.teacherName).filter(Boolean))].sort();
  }, [allSchemes]);

  const handleApproveScheme = async (schemeId) => {
    try {
      await withSubmit('Approving scheme...', () => api.updatePlanStatus(schemeId, 'Approved'));
      // Remove from allSchemes and maintain filters
      setAllSchemes(prev => prev.filter(scheme => scheme.schemeId !== schemeId));
      setSelectedSchemes(prev => {
        const newSet = new Set(prev);
        newSet.delete(schemeId);
        return newSet;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectScheme = async (schemeId) => {
    try {
      await withSubmit('Rejecting scheme...', () => api.updatePlanStatus(schemeId, 'Rejected'));
      // Remove from allSchemes and maintain filters
      setAllSchemes(prev => prev.filter(scheme => scheme.schemeId !== schemeId));
      setSelectedSchemes(prev => {
        const newSet = new Set(prev);
        newSet.delete(schemeId);
        return newSet;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedSchemes.size === 0) {
      alert('Please select schemes to approve');
      return;
    }
    
    if (!confirm(`Approve ${selectedSchemes.size} selected scheme(s)?`)) {
      return;
    }

    try {
      const promises = Array.from(selectedSchemes).map(schemeId => 
        api.updatePlanStatus(schemeId, 'Approved')
      );
      await withSubmit(`Approving ${selectedSchemes.size} schemes...`, () => Promise.all(promises));
      
      // Remove approved schemes from allSchemes
      setAllSchemes(prev => prev.filter(scheme => !selectedSchemes.has(scheme.schemeId)));
      setSelectedSchemes(new Set());
    } catch (err) {
      console.error('Bulk approve error:', err);
      alert('Some approvals may have failed. Please refresh to see current status.');
    }
  };

  const handleBulkReject = async () => {
    if (selectedSchemes.size === 0) {
      alert('Please select schemes to reject');
      return;
    }
    
    if (!confirm(`Reject ${selectedSchemes.size} selected scheme(s)?`)) {
      return;
    }

    try {
      const promises = Array.from(selectedSchemes).map(schemeId => 
        api.updatePlanStatus(schemeId, 'Rejected')
      );
      await withSubmit(`Rejecting ${selectedSchemes.size} schemes...`, () => Promise.all(promises));
      
      // Remove rejected schemes from allSchemes
      setAllSchemes(prev => prev.filter(scheme => !selectedSchemes.has(scheme.schemeId)));
      setSelectedSchemes(new Set());
    } catch (err) {
      console.error('Bulk reject error:', err);
      alert('Some rejections may have failed. Please refresh to see current status.');
    }
  };

  const handleSelectAll = () => {
    const pendingOnly = filteredSchemes.filter(s => 
      s.status === 'Pending' || 
      s.status === 'Pending - Validation Override' || 
      s.status === 'Pending - No Timetable'
    );
    
    if (selectedSchemes.size === pendingOnly.length) {
      setSelectedSchemes(new Set());
    } else {
      setSelectedSchemes(new Set(pendingOnly.map(s => s.schemeId)));
    }
  };

  const toggleSchemeSelection = (schemeId) => {
    setSelectedSchemes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schemeId)) {
        newSet.delete(schemeId);
      } else {
        newSet.add(schemeId);
      }
      return newSet;
    });
  };

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading schemes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Scheme Approvals</h1>
        {selectedSchemes.size > 0 ? (
          <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
            <button 
              onClick={handleBulkApprove}
              className="flex-1 sm:flex-initial bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-green-700 text-sm"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve ({selectedSchemes.size})
            </button>
            <button 
              onClick={handleBulkReject}
              className="flex-1 sm:flex-initial bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-red-700 text-sm"
            >
              <X className="h-4 w-4 mr-2" />
              Reject ({selectedSchemes.size})
            </button>
          </div>
        ) : null}
      </div>

      {/* Simple Filter Bar - Always Visible */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
          {/* Teacher Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Teacher:</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[150px]"
            >
              <option value="">All Teachers</option>
              {uniqueTeachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* Group Toggle Buttons */}
          <div className="flex gap-2 w-full md:w-auto md:ml-4">
            <button
              onClick={() => {
                const newValue = !groupByClass;
                setGroupByClass(newValue);
                if (newValue) setGroupByChapter(false);
              }}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                groupByClass
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <LayoutGrid className="h-3 w-3 md:h-4 md:w-4 inline mr-1" />
              <span className="hidden sm:inline">Class-wise</span>
              <span className="sm:hidden">Class</span>
            </button>
            <button
              onClick={() => {
                const newValue = !groupByChapter;
                setGroupByChapter(newValue);
                if (newValue) setGroupByClass(false);
              }}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                groupByChapter
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <BookOpen className="h-3 w-3 md:h-4 md:w-4 inline mr-1" />
              <span className="hidden sm:inline">Chapter-wise</span>
              <span className="sm:hidden">Chapter</span>
            </button>
          </div>

          {/* Status Quick Filters */}
          <div className="flex gap-2 w-full md:w-auto md:ml-auto">
            <button
              onClick={() => setStatusFilter('Pending')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                statusFilter === 'Pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              ⏳ Pending
            </button>
            <button
              onClick={() => setStatusFilter('Approved')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                statusFilter === 'Approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              ✓ Approved
            </button>
            <button
              onClick={() => setStatusFilter('')}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all ${
                !statusFilter
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
          </div>

          {/* Active Filter Badge */}
          {selectedTeacher && (
            <span className="px-2 md:px-3 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full font-medium">
              Teacher: {selectedTeacher}
            </span>
          )}
          {groupByClass && (
            <span className="px-2 md:px-3 py-1 text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 rounded-full font-medium">
              Grouped by Class
            </span>
          )}
          {groupByChapter && (
            <span className="px-2 md:px-3 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full font-medium">
              Grouped by Chapter
            </span>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {statusFilter === 'Approved' ? 'Approved Schemes' : 
               statusFilter === 'Pending' ? 'Pending Schemes' : 'All Schemes'} 
              ({filteredSchemes.length})
            </h2>
            {(selectedTeacher || groupByClass || groupByChapter) && (
              <div className="flex flex-wrap gap-1 text-xs">
                {selectedTeacher && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">Teacher: {selectedTeacher}</span>
                )}
                {groupByClass && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">Grouped by Class</span>
                )}
                {groupByChapter && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">Grouped by Chapter</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
          {filteredSchemes.map((scheme) => {
            const isPending = scheme.status === 'Pending' || scheme.status === 'Pending - Validation Override' || scheme.status === 'Pending - No Timetable';
            return (
              <div key={scheme.schemeId} className="border-b border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* Header: Teacher & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{scheme.teacherName}</div>
                  {scheme.status === 'Approved' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      ✓ Approved
                    </span>
                  ) : scheme.status === 'Rejected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      ✗ Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      ⏳ Pending
                    </span>
                  )}
                </div>
                
                {/* Class & Subject */}
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                  {stripStdPrefix(scheme.class)} • {scheme.subject}
                </div>
                
                {/* Chapter */}
                <div className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1.5 line-clamp-2 break-words">{scheme.chapter}</div>
                
                {/* Sessions & Date - Compact */}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400 mb-3">
                  <span>{scheme.noOfSessions} Sessions</span>
                  <span>{scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(statusFilter === 'Pending' || !statusFilter) && isPending && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSchemes.has(scheme.schemeId)}
                        onChange={() => toggleSchemeSelection(scheme.schemeId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Select</span>
                    </label>
                  )}
                  <button 
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800" 
                    onClick={() => openLessonView(scheme)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  {isPending && (
                    <>
                      <button 
                        onClick={() => handleApproveScheme(scheme.schemeId)}
                        className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        title="Approve"
                      >
                        ✓
                      </button>
                      <button 
                        onClick={() => handleRejectScheme(scheme.schemeId)}
                        className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        title="Reject"
                      >
                        ✗
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {filteredSchemes.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No schemes found
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {(statusFilter === 'Pending' || !statusFilter) && (
                  <th className="px-1 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedSchemes.size > 0 && selectedSchemes.size === filteredSchemes.filter(s => s.status?.includes('Pending')).length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase max-w-[80px]">Teacher</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase w-16">Class</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase max-w-[100px]">Subject</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase max-w-[150px]">Chapter</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 uppercase w-10">Sess</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase w-16">Date</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase w-20">Status</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSchemes.map((scheme) => {
                const isPending = scheme.status === 'Pending' || scheme.status === 'Pending - Validation Override' || scheme.status === 'Pending - No Timetable';
                return (
                  <tr key={scheme.schemeId} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedSchemes.has(scheme.schemeId) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    {(statusFilter === 'Pending' || !statusFilter) && (
                      <td className="px-1 py-2">
                        {isPending && (
                          <input
                            type="checkbox"
                            checked={selectedSchemes.has(scheme.schemeId)}
                            onChange={() => toggleSchemeSelection(scheme.schemeId)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-1 py-2 text-xs text-gray-900 dark:text-gray-100 max-w-[80px] truncate" title={scheme.teacherName}>{scheme.teacherName}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 dark:text-gray-100 w-16">{stripStdPrefix(scheme.class)}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 dark:text-gray-100 max-w-[100px] truncate" title={scheme.subject}>{scheme.subject}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 dark:text-gray-100 max-w-[150px] truncate" title={scheme.chapter}>{scheme.chapter}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 dark:text-gray-100 text-center font-medium w-10">{scheme.noOfSessions}</td>
                    <td className="px-1 py-2 text-xs text-gray-600 dark:text-gray-400 w-16">{scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                    <td className="px-1 py-2 w-20">
                    {scheme.status === 'Approved' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        ✓
                      </span>
                    ) : scheme.status === 'Rejected' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        ✗
                      </span>
                    ) : scheme.status === 'Pending - Validation Override' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        Ovr
                      </span>
                    ) : scheme.status === 'Pending - No Timetable' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        NoTT
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pend
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-xs text-gray-500 dark:text-gray-400 w-24">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <button type="button"
                        onClick={() => openLessonView(scheme)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1"
                        title="View scheme details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {isPending && (
                        <>
                          <button 
                            onClick={() => handleApproveScheme(scheme.schemeId)}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 px-1.5 py-0.5 bg-green-100 dark:bg-green-900 rounded text-xs"
                            title="Approve scheme"
                          >
                            ✓
                          </button>
                          <button 
                            onClick={() => handleRejectScheme(scheme.schemeId)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 px-1.5 py-0.5 bg-red-100 dark:bg-red-900 rounded text-xs"
                            title="Reject scheme"
                          >
                            ✗
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchemeApprovalsView;
