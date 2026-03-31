import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import {
  X, RefreshCw, Download, Filter, Search, BarChart2,
  LayoutGrid, BookOpen, Eye, CheckCircle, AlertTriangle, XCircle
} from 'lucide-react';

const LessonApprovalsView = ({ memoizedUser, stripStdPrefix, openLessonView, withSubmit }) => {
  const [allLessons, setAllLessons] = useState([]); // Store all lessons loaded once
  const [loading, setLoading] = useState(true); // Add loading state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [groupByClass, setGroupByClass] = useState(false);
  const [groupByChapter, setGroupByChapter] = useState(false);
  const [groupByClassChapter, setGroupByClassChapter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newLessonsCount, setNewLessonsCount] = useState(0);
  const [showNewLessonsNotif, setShowNewLessonsNotif] = useState(false);
  const [showTeacherStats, setShowTeacherStats] = useState(false);
  // Removed: timetable date view UI
  const [rowSubmitting, setRowSubmitting] = useState({});
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleLesson, setRescheduleLesson] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  const [rescheduleAvailablePeriods, setRescheduleAvailablePeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [reschedulePlannedPeriods, setReschedulePlannedPeriods] = useState([]);
  const [showOtherClassPeriods, setShowOtherClassPeriods] = useState(false);
  const [showBulkRescheduleModal, setShowBulkRescheduleModal] = useState(false);
  const [bulkRescheduleChapter, setBulkRescheduleChapter] = useState(null);
  const [bulkRescheduleDates, setBulkRescheduleDates] = useState([]);
  const [bulkTimetables, setBulkTimetables] = useState({});
  const [bulkPlannedPeriods, setBulkPlannedPeriods] = useState({});
  const [showOtherClassPeriodsBulk, setShowOtherClassPeriodsBulk] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [filters, setFilters] = useState({
    teacher: '',
    class: '',
    subject: '',
    status: 'Pending Review', // Default to pending for approvals
    dateFrom: '',
    dateTo: ''
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  // View-only: open a modal showing all sessions in the same chapter
  const viewChapterSessions = (baseLesson) => {
    if (!baseLesson) return;
    const keyScheme = baseLesson.schemeId || '';
    const keyChapter = baseLesson.chapter || '';
    // Prefer schemeId + chapter; fallback to class+subject+chapter
    const lessons = filteredLessons.filter(l => {
      const sameScheme = keyScheme && String(l.schemeId || '') === String(keyScheme);
      const sameChapter = String(l.chapter || '') === String(keyChapter);
      const fallbackMatch = !keyScheme && sameChapter && String(l.class||'')===String(baseLesson.class||'') && String(l.subject||'')===String(baseLesson.subject||'');
      return (sameScheme && sameChapter) || fallbackMatch;
    }).sort((a,b) => parseInt(a.session||0) - parseInt(b.session||0));

    setSelectedChapter({
      schemeId: keyScheme,
      chapter: keyChapter,
      class: baseLesson.class,
      subject: baseLesson.subject,
      teacherName: baseLesson.teacherName,
      lessons
    });
    setShowChapterModal(true);
  };

  const closeChapterModal = () => {
    setShowChapterModal(false);
    setSelectedChapter(null);
  };

  const bulkUpdateChapter = async (status) => {
    if (!selectedChapter) return;
    const pendingCount = selectedChapter.lessons.filter(l => l.status === 'Pending Review').length;
    if (pendingCount === 0) { alert('No pending sessions to update.'); return; }
    let remarks = '';
    if (status === 'Needs Rework' || status === 'Rejected') {
      remarks = window.prompt(`Enter remarks for ${status} (required):`, '') || '';
      if (!remarks.trim()) { alert('Remarks are required.'); return; }
    }
    if (!window.confirm(`${status} all ${pendingCount} pending session(s) in this chapter?`)) return;
    try {
      setBulkSubmitting(true);
      const res = await api.chapterBulkUpdateLessonPlanStatus(
        selectedChapter.schemeId,
        selectedChapter.chapter,
        status,
        remarks,
        (memoizedUser && memoizedUser.email) || ''
      );
      const result = res?.data || res;
      if (result && result.success === false && result.error) {
        alert(result.error);
        return;
      }
      // Update modal list locally
      setSelectedChapter(prev => prev ? ({
        ...prev,
        lessons: prev.lessons.map(l => l.status === 'Pending Review' ? { ...l, status } : l)
      }) : prev);
      // Refresh table below
      await refreshApprovals();
    } catch (e) {
      console.error('Bulk update failed', e);
      alert(e?.message || 'Bulk update failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Ensure sidebar state doesn't auto-toggle here to avoid flicker on mobile

  // Get unique values for dropdowns - optimized with useMemo
  const uniqueTeachers = useMemo(() => {
    return [...new Set(allLessons.map(l => l.teacherName).filter(Boolean))].sort();
  }, [allLessons]);
  
  const uniqueClasses = useMemo(() => {
    return [...new Set(allLessons.map(l => l.class).filter(Boolean))].sort();
  }, [allLessons]);
  
  const uniqueSubjects = useMemo(() => {
    return [...new Set(allLessons.map(l => l.subject).filter(Boolean))].sort();
  }, [allLessons]);

  // Load all lessons ONCE on component mount
  useEffect(() => {
    async function fetchAllLessons() {
      setLoading(true);
      try {
        const data = await api.getPendingLessonReviews('', '', '', ''); // Get all lessons
        let lessons = Array.isArray(data) ? data : [];
        
        // Sort by selectedDate in descending order (latest first)
        lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
        
        setAllLessons(lessons);
      } catch (err) {
        console.error('Error fetching lessons:', err);
        setAllLessons([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAllLessons();
  }, []); // Empty dependency - load only once

  // Auto-refresh every 2 minutes to check for new lessons
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getPendingLessonReviews('', '', '', '', { noCache: true });
        let lessons = Array.isArray(data) ? data : [];
        lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
        
        // Check if there are new lessons
        const currentCount = allLessons.length;
        const newCount = lessons.length;
        if (newCount > currentCount) {
          const diff = newCount - currentCount;
          setNewLessonsCount(diff);
          setShowNewLessonsNotif(true);
          // Auto-hide notification after 10 seconds
          setTimeout(() => setShowNewLessonsNotif(false), 10000);
        }
        
        setAllLessons(lessons);
      } catch (err) {
        console.error('Auto-refresh error:', err);
      }
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, [allLessons.length]);

  // CLIENT-SIDE FILTERING - no API calls
  const filteredLessons = useMemo(() => {
    return allLessons.filter(lesson => {
      // Filter by teacher (from simple dropdown)
      if (selectedTeacher && lesson.teacherName !== selectedTeacher) return false;
      
      // Filter by search query (chapter or teacher name)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesChapter = String(lesson.chapter || '').toLowerCase().includes(q);
        const matchesTeacher = String(lesson.teacherName || '').toLowerCase().includes(q);
        const matchesSubject = String(lesson.subject || '').toLowerCase().includes(q);
        if (!matchesChapter && !matchesTeacher && !matchesSubject) return false;
      }
      
      // Filter by advanced filters (when showFilters is true)
      if (filters.teacher && lesson.teacherName !== filters.teacher) return false;
      if (filters.class && lesson.class !== filters.class) return false;
      if (filters.subject && lesson.subject !== filters.subject) return false;
      if (filters.status && filters.status !== 'All') {
        if (lesson.status !== filters.status) return false;
      }
      if (filters.dateFrom && lesson.selectedDate < filters.dateFrom) return false;
      if (filters.dateTo && lesson.selectedDate > filters.dateTo) return false;
      
      return true;
    });
  }, [allLessons, selectedTeacher, searchQuery, filters]);

  // CLIENT-SIDE GROUPING - Compute groups from filteredLessons
  const computedChapterGroups = useMemo(() => {
    const groupMap = {};
    filteredLessons.forEach(lesson => {
      const key = `${lesson.class}|${lesson.subject}|${lesson.chapter}|${lesson.teacherName}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          class: lesson.class,
          subject: lesson.subject,
          chapter: lesson.chapter,
          teacherName: lesson.teacherName,
          schemeId: lesson.schemeId,
          lessons: [],
          counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
        };
      }
      groupMap[key].lessons.push(lesson);
      if (lesson.status === 'Pending Review') groupMap[key].counts.pending++;
      if (lesson.status === 'Ready') groupMap[key].counts.ready++;
      if (lesson.status === 'Needs Rework') groupMap[key].counts.needsRework++;
      if (lesson.status === 'Rejected') groupMap[key].counts.rejected++;
    });
    return Object.values(groupMap).sort((a, b) => String(a.chapter || '').localeCompare(String(b.chapter || '')));
  }, [filteredLessons]);

  const computedClassGroups = useMemo(() => {
    const classMap = {};
    filteredLessons.forEach(lesson => {
      const cls = lesson.class;
      if (!classMap[cls]) {
        classMap[cls] = {
          class: cls,
          subgroups: [],
          counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
        };
      }
      const subKey = `${lesson.subject}|${lesson.chapter}|${lesson.teacherName}`;
      let subgroup = classMap[cls].subgroups.find(sg => sg.key === subKey);
      if (!subgroup) {
        subgroup = {
          key: subKey,
          subject: lesson.subject,
          chapter: lesson.chapter,
          teacherName: lesson.teacherName,
          lessons: [],
          counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
        };
        classMap[cls].subgroups.push(subgroup);
      }
      subgroup.lessons.push(lesson);
      if (lesson.status === 'Pending Review') {
        subgroup.counts.pending++;
        classMap[cls].counts.pending++;
      }
      if (lesson.status === 'Ready') {
        subgroup.counts.ready++;
        classMap[cls].counts.ready++;
      }
      if (lesson.status === 'Needs Rework') {
        subgroup.counts.needsRework++;
        classMap[cls].counts.needsRework++;
      }
      if (lesson.status === 'Rejected') {
        subgroup.counts.rejected++;
        classMap[cls].counts.rejected++;
      }
    });
    return Object.values(classMap).sort((a, b) => {
      const classA = String(a.class || '');
      const classB = String(b.class || '');
      const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
      const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return classA.localeCompare(classB);
    });
  }, [filteredLessons]);

  const computedClassChapterGroups = useMemo(() => {
    const groupMap = {};
    filteredLessons.forEach(lesson => {
      const cls = lesson.class || 'Unknown Class';
      const chapter = lesson.chapter || 'Unknown Chapter';
      const subject = lesson.subject || 'Unknown Subject';
      const key = `${cls}|${subject}|${chapter}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          class: cls,
          subject,
          chapter,
          teacherNames: new Set(),
          schemeId: lesson.schemeId,
          lessons: [],
          counts: { pending: 0, ready: 0, needsRework: 0, rejected: 0 }
        };
      }
      groupMap[key].teacherNames.add(lesson.teacherName || '');
      groupMap[key].lessons.push(lesson);
      if (lesson.status === 'Pending Review') groupMap[key].counts.pending++;
      if (lesson.status === 'Ready') groupMap[key].counts.ready++;
      if (lesson.status === 'Needs Rework') groupMap[key].counts.needsRework++;
      if (lesson.status === 'Rejected') groupMap[key].counts.rejected++;
    });
    return Object.values(groupMap)
      .map(g => ({ ...g, teacherNames: Array.from(g.teacherNames).filter(Boolean) }))
      .sort((a, b) => String(a.class || '').localeCompare(String(b.class || '')) || String(a.chapter || '').localeCompare(String(b.chapter || '')));
  }, [filteredLessons]);

  // Teacher Statistics - computed from allLessons (not filtered)
  const teacherStats = useMemo(() => {
    const statsMap = {};
    allLessons.forEach(lesson => {
      const teacher = lesson.teacherName || 'Unknown';
      if (!statsMap[teacher]) {
        statsMap[teacher] = {
          teacher,
          pending: 0,
          approved: 0,
          needsRework: 0,
          rejected: 0,
          total: 0
        };
      }
      statsMap[teacher].total++;
      if (lesson.status === 'Pending Review') statsMap[teacher].pending++;
      if (lesson.status === 'Ready') statsMap[teacher].approved++;
      if (lesson.status === 'Needs Rework') statsMap[teacher].needsRework++;
      if (lesson.status === 'Rejected') statsMap[teacher].rejected++;
    });
    return Object.values(statsMap)
      .sort((a, b) => b.pending - a.pending); // Sort by pending count (most pending first)
  }, [allLessons]);

  const handleApproveLesson = async (lpId, status) => {
    try {
      console.debug('🔵 Single approval - lpId:', lpId, 'status:', status);
      setRowSubmitting(prev => ({ ...prev, [lpId]: true }));
      const requesterEmail = memoizedUser?.email || '';
      const response = await api.updateLessonPlanStatus(lpId, status, '', requesterEmail);
      console.debug('🔵 Single approval response:', response);
      
      // Check for error in response
      const result = response.data || response;
      if (result.error) {
        // Show error to user
        alert(result.error);
        setRowSubmitting(prev => ({ ...prev, [lpId]: false }));
        return;
      }
      
      await withSubmit('Updating lesson status...', async () => {
        // Already called above, just for UI feedback
      });
      
      setAllLessons(prev => {
        return prev
          .map(lesson => lesson.lpId === lpId ? { ...lesson, status } : lesson)
          .filter(lesson => {
            // If current filter is explicitly pending review, remove non-pending lessons
            if (filters.status === 'Pending Review') {
              return lesson.status === 'Pending Review';
            }
            return true;
          });
      });
      // Broadcast status update so other views can reload
      window.dispatchEvent(new CustomEvent('lesson-plan-status-updated', { detail: { lpId, status } }));
      // Clear caches explicitly (defensive)
      api.clearCache('getPendingLessonReviews');
      api.clearCache('getTeacherLessonPlans');
      api.clearCache('getLessonPlan');
      // Immediate refetch (cache-busting)
      const teacherFilter = filters.teacher === '' ? '' : filters.teacher;
      const classFilter = filters.class === '' ? '' : filters.class;
      const subjectFilter = filters.subject === '' ? '' : filters.subject;
      const statusFilter = filters.status === '' || filters.status === 'All' ? '' : filters.status;
      const fresh = await api.getPendingLessonReviews(teacherFilter, classFilter, subjectFilter, statusFilter, { noCache: true });
      // Apply date filters again (reuse logic)
      let lessons = Array.isArray(fresh) ? fresh : [];
      const fromStr = filters.dateFrom || '';
      const toStr = filters.dateTo || '';
      const singleDay = fromStr && toStr && fromStr === toStr;
      const normalizeDate = (raw) => {
        if (!raw) return '';
        if (typeof raw === 'string') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
          if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.split('T')[0];
          const dm = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/); if (dm) return `${dm[3]}-${dm[2]}-${dm[1]}`;
          const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
        }
        try { const d = new Date(raw); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; } catch (e) {}
        return '';
      };
      if (fromStr || toStr) {
        lessons = lessons.filter(lesson => {
          const raw = lesson.selectedDate || lesson.plannedDate || lesson.date || '';
          const dateStr = normalizeDate(raw);
          if (!dateStr) return false;
          if (singleDay) return dateStr === fromStr;
          if (fromStr && dateStr < fromStr) return false;
          if (toStr && dateStr > toStr) return false;
          return true;
        });
      }
      lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
      // If still filtering by Pending Review, drop updated item
      if (filters.status === 'Pending Review') {
        lessons = lessons.filter(l => l.status === 'Pending Review');
      }
      setAllLessons(lessons);
      // If grouped view is active, refresh groups to reflect changes
      if (groupByChapter || groupByClass || groupByClassChapter) {
        await refreshApprovals();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRowSubmitting(prev => ({ ...prev, [lpId]: false }));
    }
  };

  // Manual refresh (cache-busting, does not change filters)
  const refreshApprovals = async () => {
    setRefreshing(true);
    try {
      api.clearCache('getPendingLessonReviews');
      const data = await api.getPendingLessonReviews('', '', '', '', { noCache: true });
      let lessons = Array.isArray(data) ? data : [];
      lessons.sort((a, b) => new Date(b.selectedDate || 0) - new Date(a.selectedDate || 0));
      setAllLessons(lessons);
      setShowNewLessonsNotif(false);
      setNewLessonsCount(0);
    } catch (e) {
      console.warn('Manual refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (filteredLessons.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Prepare CSV data
    const headers = ['Teacher', 'Class', 'Subject', 'Chapter', 'Session', 'Date', 'Period', 'Status', 'Learning Objectives'];
    const rows = filteredLessons.map(l => [
      l.teacherName || '',
      l.class || '',
      l.subject || '',
      l.chapter || '',
      l.session || '',
      l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN') : '',
      l.selectedPeriod || '',
      l.status || '',
      (l.learningObjectives || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lesson_approvals_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch selection, chapter grouping, and modal approval removed per request

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading lesson plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* New Lessons Notification */}
      {showNewLessonsNotif && newLessonsCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-800">
              {newLessonsCount} new lesson plan{newLessonsCount > 1 ? 's' : ''} submitted!
            </span>
          </div>
          <button
            onClick={() => setShowNewLessonsNotif(false)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lesson Plan Approvals</h1>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
          <button
            onClick={refreshApprovals}
            disabled={refreshing}
            className={`flex-1 sm:flex-initial bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
            title="Force refresh (bypass cache)"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            <span className="sm:hidden">{refreshing ? '...' : 'Refresh'}</span>
          </button>
          <button
            onClick={exportToExcel}
            className="flex-1 sm:flex-initial bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-green-700 text-sm"
            title="Export to Excel (CSV)"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button 
            onClick={() => {
              setShowFilters(!showFilters);
            }}
            className="flex-1 sm:flex-initial bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center hover:bg-blue-700 text-sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            <span className="sm:hidden">{showFilters ? 'Hide' : 'Filters'}</span>
          </button>
        </div>
      </div>

      {/* Teacher Statistics Dashboard */}
      {showTeacherStats && teacherStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-purple-600" />
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Teacher Statistics</h3>
              <span className="text-xs text-gray-500">({teacherStats.length} teachers)</span>
            </div>
            <button
              onClick={() => setShowTeacherStats(false)}
              className="text-gray-400 hover:text-gray-600"
              title="Hide statistics"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Teacher</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Pending</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Approved</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Rework</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teacherStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 font-medium">{stat.teacher}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        stat.pending > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {stat.pending}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {stat.approved}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        stat.needsRework > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {stat.needsRework}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600 font-medium">{stat.total}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => {
                          setSelectedTeacher(stat.teacher);
                          setFilters(prev => ({ ...prev, teacher: stat.teacher }));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Sorted by pending count (highest first)</span>
              <span>Click "View" to filter by teacher</span>
            </div>
          </div>
        </div>
      )}

      {!showTeacherStats && (
        <button
          onClick={() => setShowTeacherStats(true)}
          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <BarChart2 className="h-4 w-4" />
          Show Teacher Statistics
        </button>
      )}

      {/* Simple Filter Bar - Always Visible */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-3 md:p-4 border border-blue-100">
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
          {/* Quick Search */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search chapter, teacher, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[200px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Teacher Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Teacher:</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white md:min-w-[150px]"
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
                if (newValue) { setGroupByChapter(false); setGroupByClassChapter(false); }
              }}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                groupByClass
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
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
                if (newValue) { setGroupByClass(false); setGroupByClassChapter(false); }
              }}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                groupByChapter
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="h-3 w-3 md:h-4 md:w-4 inline mr-1" />
              <span className="hidden sm:inline">Chapter-wise</span>
              <span className="sm:hidden">Chapter</span>
            </button>
            <button
              onClick={() => {
                const newValue = !groupByClassChapter;
                setGroupByClassChapter(newValue);
                if (newValue) { setGroupByClass(false); setGroupByChapter(false); }
              }}
              className={`flex-1 md:flex-initial px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg transition-all ${
                groupByClassChapter
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">Class + Chapter</span>
              <span className="sm:hidden">C+Ch</span>
            </button>
          </div>

          {/* Active Filter Badge */}
          {selectedTeacher && (
            <span className="px-2 md:px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
              Teacher: {selectedTeacher}
            </span>
          )}
          {groupByClass && (
            <span className="px-2 md:px-3 py-1 text-xs bg-teal-100 text-teal-800 rounded-full font-medium">
              Grouped by Class
            </span>
          )}
          {groupByChapter && (
            <span className="px-2 md:px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
              Grouped by Chapter
            </span>
          )}
          {groupByClassChapter && (
            <span className="px-2 md:px-3 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full font-medium">
              Grouped by Class + Chapter
            </span>
          )}
        </div>
      </div>


      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Lesson Plans</h3>
          <div className="space-y-4">
            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Pending Review' })}
                className={`px-3 py-1 text-sm rounded-full transition-all ${
                  filters.status === 'Pending Review' && !filters.teacher && !filters.class && !filters.subject
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⏳ Pending Review
              </button>
              <button
                onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Ready' })}
                className={`px-3 py-1 text-sm rounded-full transition-all ${
                  filters.status === 'Ready' && !filters.teacher && !filters.class && !filters.subject
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ✓ Approved
              </button>
              <button
                onClick={() => setFilters({ teacher: '', class: '', subject: '', status: 'Needs Rework' })}
                className={`px-3 py-1 text-sm rounded-full transition-all ${
                  filters.status === 'Needs Rework' && !filters.teacher && !filters.class && !filters.subject
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⚠ Needs Rework
              </button>
              <button
                onClick={() => setFilters({ teacher: '', class: '', subject: '', status: '' , dateFrom: '', dateTo: ''})}
                className={`px-3 py-1 text-sm rounded-full transition-all ${
                  !filters.status && !filters.teacher && !filters.class && !filters.subject && !filters.dateFrom && !filters.dateTo
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Plans
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilters({ teacher: '', class: '', subject: '', status: 'Pending Review', dateFrom: today, dateTo: today });
                }}
                className={`px-3 py-1 text-sm rounded-full transition-all ${
                  filters.status === 'Pending Review' && filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo && filters.dateFrom === new Date().toISOString().split('T')[0]
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📅 Today's Pending
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekFromNow = new Date(today);
                  weekFromNow.setDate(today.getDate() + 7);
                  setFilters({ 
                    teacher: '', 
                    class: '', 
                    subject: '', 
                    status: 'Pending Review', 
                    dateFrom: today.toISOString().split('T')[0], 
                    dateTo: weekFromNow.toISOString().split('T')[0]
                  });
                }}
                className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
              >
                📆 Next 7 Days
              </button>
            </div>
            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teacher</label>
                <select
                  value={filters.teacher}
                  onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  {uniqueTeachers.map(teacher => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                <select
                  value={filters.class}
                  onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  {uniqueSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="Ready">Ready</option>
                  <option value="Needs Rework">Needs Rework</option>
                  <option value="Rejected">Rejected</option>
                  <option value="">All Statuses</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!groupByChapter && !groupByClass && !groupByClassChapter && (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium text-gray-900">
              {filters.status === 'Ready' ? 'Approved Lesson Plans' : 
               filters.status === 'Pending Review' ? 'Pending Lesson Plans' : 'All Lesson Plans'} 
              ({filteredLessons.length})
            </h2>
            {/* Active Filter Status Display */}
            {(filters.teacher || filters.class || filters.subject || (filters.status && filters.status !== 'Pending Review') || filters.dateFrom || filters.dateTo) && (
              <div className="flex flex-wrap gap-1 text-xs">
                {filters.teacher && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Teacher: {filters.teacher}</span>
                )}
                {filters.class && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Class: {filters.class}</span>
                )}
                {filters.subject && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Subject: {filters.subject}</span>
                )}
                {filters.status && filters.status !== 'Pending Review' && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded">Status: {filters.status}</span>
                )}
                {filters.dateFrom && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">From: {filters.dateFrom}</span>
                )}
                {filters.dateTo && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">To: {filters.dateTo}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="block md:hidden">
          {filteredLessons.map((lesson) => (
            <div key={lesson.lpId} className="border-b border-gray-200 p-3 hover:bg-gray-50">
              {/* Header: Teacher & Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm text-gray-900">{lesson.teacherName}</div>
                {lesson.status === 'Ready' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    ✓ Ready
                  </span>
                ) : lesson.status === 'Needs Rework' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    ⚠ Rework
                  </span>
                ) : lesson.status === 'Rejected' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    ✗ Rejected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    ⏳ Pending
                  </span>
                )}
              </div>
              
              {/* Class & Subject */}
              <div className="text-xs text-gray-600 mb-1.5">
                {stripStdPrefix(lesson.class)} • {lesson.subject}
              </div>
              
              {/* Chapter */}
              <div className="text-sm text-gray-900 font-medium mb-1.5 line-clamp-2 break-words">{lesson.chapter}</div>
              
              {/* Session, Date, Period - Compact */}
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                <span>Session {lesson.noOfSessions ? `${lesson.session}/${lesson.noOfSessions}` : lesson.session}</span>
                <span>{lesson.selectedDate ? new Date(lesson.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                <span>P{lesson.selectedPeriod || '-'}</span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100" 
                  onClick={() => openLessonView(lesson)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
                <button 
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100" 
                  onClick={() => viewChapterSessions(lesson)}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Chapter
                </button>
                {lesson.status === 'Pending Review' && (
                  <>
                    <button 
                      onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                      disabled={!!rowSubmitting[lesson.lpId]}
                      className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      title="Approve"
                    >
                      {rowSubmitting[lesson.lpId] ? '...' : '✓'}
                    </button>
                    <button 
                      onClick={() => handleApproveLesson(lesson.lpId, 'Needs Rework')}
                      disabled={!!rowSubmitting[lesson.lpId]}
                      className="px-2.5 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                      title="Needs Rework"
                    >
                      {rowSubmitting[lesson.lpId] ? '...' : '⚠'}
                    </button>
                    <button 
                      onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                      disabled={!!rowSubmitting[lesson.lpId]}
                      className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      title="Reject"
                    >
                      {rowSubmitting[lesson.lpId] ? '...' : '✗'}
                    </button>
                  </>
                )}
                {lesson.status === 'Needs Rework' && (
                  <>
                    <button 
                      onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                      disabled={!!rowSubmitting[lesson.lpId]}
                      className="px-2.5 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      title="Approve"
                    >
                      {rowSubmitting[lesson.lpId] ? '...' : '✓'}
                    </button>
                    <button 
                      onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                      disabled={!!rowSubmitting[lesson.lpId]}
                      className="px-2.5 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      title="Reject"
                    >
                      {rowSubmitting[lesson.lpId] ? '...' : '✗'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredLessons.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No lesson plans found
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[80px]">Teacher</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Class</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[100px]">Subject</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase max-w-[150px]">Chapter</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-10">Sess</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Submit</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Plan</th>
                <th className="px-1 py-2 text-left text-xs font-medium text-gray-600 uppercase w-20">Status</th>
                <th className="px-1 py-2 text-center text-xs font-medium text-gray-600 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLessons.map((lesson) => {
                return (
                  <tr key={lesson.lpId} className="hover:bg-gray-50">
                    <td className="px-1 py-2 text-xs text-gray-900 max-w-[80px] truncate" title={lesson.teacherName}>{lesson.teacherName}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 w-16">{stripStdPrefix(lesson.class)}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 max-w-[100px] truncate" title={lesson.subject}>{lesson.subject}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 max-w-[150px] truncate" title={lesson.chapter}>{lesson.chapter}</td>
                    <td className="px-1 py-2 text-xs text-gray-900 text-center font-medium w-10">
                      {lesson.noOfSessions ? `${lesson.session}/${lesson.noOfSessions}` : lesson.session}
                    </td>
                    <td className="px-1 py-2 text-xs text-gray-600 w-16">{lesson.submittedAt ? new Date(lesson.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                    <td className="px-1 py-2 text-xs text-gray-600 w-16">
                      <div className="flex flex-col">
                        <span>{lesson.selectedDate ? new Date(lesson.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                        <span className="text-xs text-gray-500">P{lesson.selectedPeriod || '-'}</span>
                      </div>
                    </td>
                  <td className="px-1 py-2 w-20">
                    {lesson.status === 'Ready' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓
                      </span>
                    ) : lesson.status === 'Needs Rework' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Rwk
                      </span>
                    ) : lesson.status === 'Rejected' ? (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        ✗
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Pend
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-xs text-gray-500 w-24">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <button type="button" 
                        className="text-blue-600 hover:text-blue-900 p-1" 
                        onClick={() => openLessonView(lesson)} 
                        title="View lesson details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                        <button type="button" 
                          className="text-purple-600 hover:text-purple-900 p-1" 
                          onClick={() => viewChapterSessions(lesson)} 
                          title="View all chapter sessions"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                      {lesson.status === 'Pending Review' && (
                        <>
                          <button 
                            onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                            disabled={!!rowSubmitting[lesson.lpId]}
                            className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                            title="Approve"
                          >
                            {rowSubmitting[lesson.lpId] ? '…' : '✓'}
                          </button>
                          <button 
                            onClick={() => handleApproveLesson(lesson.lpId, 'Needs Rework')}
                            disabled={!!rowSubmitting[lesson.lpId]}
                            className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                            title="Send for rework"
                          >
                            {rowSubmitting[lesson.lpId] ? '…' : '⚠'}
                          </button>
                          <button 
                            onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                            disabled={!!rowSubmitting[lesson.lpId]}
                            className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                            title="Reject"
                          >
                            {rowSubmitting[lesson.lpId] ? '…' : '✗'}
                          </button>
                        </>
                      )}
                      {lesson.status === 'Needs Rework' && (
                        <>
                          <button 
                            onClick={() => handleApproveLesson(lesson.lpId, 'Ready')}
                            disabled={!!rowSubmitting[lesson.lpId]}
                            className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                            title="Approve"
                          >
                            {rowSubmitting[lesson.lpId] ? '…' : '✓'}
                          </button>
                          <button 
                            onClick={() => handleApproveLesson(lesson.lpId, 'Rejected')}
                            disabled={!!rowSubmitting[lesson.lpId]}
                            className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                            title="Reject"
                          >
                            {rowSubmitting[lesson.lpId] ? '…' : '✗'}
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {
                          setRescheduleLesson(lesson);
                          setNewDate(lesson.selectedDate || lesson.date || '');
                          setNewPeriod(String(lesson.selectedPeriod || lesson.period || ''));
                          setShowOtherClassPeriods(false);
                          setRescheduleAvailablePeriods([]);
                          setReschedulePlannedPeriods([]);
                          setShowRescheduleModal(true);
                        }}
                        disabled={!!rowSubmitting[lesson.lpId]}
                        className={`text-blue-600 px-1.5 py-0.5 bg-blue-100 rounded text-xs ${rowSubmitting[lesson.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-900'}`}
                        title="Reschedule"
                      >
                        📅
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {groupByChapter && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          {computedChapterGroups.length === 0 ? (
            <p className="text-gray-700">No lesson plans match the current filters.</p>
          ) : (
            <div className="space-y-4">
              {computedChapterGroups.map(g => {
                const pending = g.counts?.pending || 0;
                const approved = g.counts?.ready || 0;
                return (
                  <div key={g.key} className="border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm text-gray-600 truncate">{g.class} • {g.subject} • {g.teacherName}</div>
                        <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{g.chapter}</div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                        <button
                          onClick={() => {
                            const lessons = (g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                            setSelectedChapter({ schemeId: g.schemeId || '', chapter: g.chapter, class: g.class, subject: g.subject, teacherName: g.teacherName, lessons });
                            setShowChapterModal(true);
                          }}
                          className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                          title="Open Chapter"
                        ><BookOpen className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="divide-y">
                      {(g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                        <div key={l.lpId} className="px-3 py-2 md:px-4 md:py-3">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            {/* Mobile: Stack info vertically */}
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="font-medium">Session {l.session}</span>
                                <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                <span>P{l.selectedPeriod || '-'}</span>
                              </div>
                              <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                            </div>
                            {/* Status and Actions */}
                            <div className="flex items-center gap-2 self-start md:self-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                              {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                <>
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                    title="Approve"
                                  >✓</button>
                                  {l.status === 'Pending Review' && (
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                      title="Needs Rework"
                                    >⚠</button>
                                  )}
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                    title="Reject"
                                  >✗</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {groupByClassChapter && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Lesson Plans (Class + Chapter)</h2>
          {computedClassChapterGroups.length === 0 ? (
            <p className="text-gray-700">No lesson plans match the current filters.</p>
          ) : (
            <div className="space-y-4">
              {computedClassChapterGroups.map(g => {
                const pending = g.counts?.pending || 0;
                const approved = g.counts?.ready || 0;
                const teachersLabel = (g.teacherNames || []).length > 0 ? g.teacherNames.join(', ') : '';
                return (
                  <div key={g.key} className="border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm text-gray-600 truncate">{stripStdPrefix(g.class)} • {g.subject}</div>
                        <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{g.chapter}</div>
                        {teachersLabel && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">Teachers: {teachersLabel}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                        <button
                          onClick={() => {
                            const lessons = (g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                            setSelectedChapter({ schemeId: g.schemeId || '', chapter: g.chapter, class: g.class, subject: g.subject, teacherName: teachersLabel || 'Multiple Teachers', lessons });
                            setShowChapterModal(true);
                          }}
                          className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                          title="Open Chapter"
                        ><BookOpen className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="divide-y">
                      {(g.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                        <div key={l.lpId} className="px-3 py-2 md:px-4 md:py-3">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="font-medium">Session {l.session}</span>
                                <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                <span>P{l.selectedPeriod || '-'}</span>
                                {l.teacherName && <span className="text-gray-500">• {l.teacherName}</span>}
                              </div>
                              <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                            </div>
                            <div className="flex items-center gap-2 self-start md:self-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                              {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                <>
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                    title="Approve"
                                  >✓</button>
                                  {l.status === 'Pending Review' && (
                                    <button 
                                      onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                      disabled={!!rowSubmitting[l.lpId]}
                                      className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                      title="Needs Rework"
                                    >⚠</button>
                                  )}
                                  <button 
                                    onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                    disabled={!!rowSubmitting[l.lpId]}
                                    className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                    title="Reject"
                                  >✗</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {groupByClass && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Lesson Plans (Class-wise)</h2>
          {computedClassGroups.length === 0 ? (
            <p className="text-gray-700">No lesson plans match the current filters.</p>
          ) : (
            <div className="space-y-4">
              {computedClassGroups.map(clsGroup => {
                const totalPending = clsGroup.counts?.pending || 0;
                const totalApproved = clsGroup.counts?.ready || 0;
                return (
                  <div key={clsGroup.class} className="border rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-b">
                      <div>
                        <div className="text-base font-semibold text-gray-900">{stripStdPrefix(clsGroup.class)}</div>
                        <div className="text-xs sm:text-sm text-gray-600">Subject • Chapter groups</div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {totalPending}</span>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {totalApproved}</span>
                      </div>
                    </div>
                    <div className="divide-y">
                      {(clsGroup.subgroups || []).map(sub => {
                        const pending = sub.counts?.pending || 0;
                        const approved = sub.counts?.ready || 0;
                        return (
                          <div key={sub.key} className="px-3 py-2 sm:px-4 sm:py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm text-gray-600">{sub.subject}</div>
                                <div className="text-sm sm:text-base font-semibold text-gray-900 break-words line-clamp-2">{sub.chapter}</div>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">P: {pending}</span>
                                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">A: {approved}</span>
                                <button
                                  onClick={() => {
                                    const lessons = (sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0));
                                    setSelectedChapter({ schemeId: lessons[0]?.schemeId || '', chapter: sub.chapter, class: clsGroup.class, subject: sub.subject, teacherName: sub.teacherName, lessons });
                                    setShowChapterModal(true);
                                  }}
                                  className="p-1.5 text-purple-600 hover:text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200"
                                  title="Open Chapter"
                                ><BookOpen className="h-4 w-4" /></button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(sub.lessons || []).slice().sort((a,b) => Number(a.session||0) - Number(b.session||0)).map(l => (
                                <div key={l.lpId} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-1">
                                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 flex-1">
                                    <div className="flex items-center gap-3 text-xs text-gray-600">
                                      <span className="font-medium">Session {l.session}</span>
                                      <span>{l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                      <span>P{l.selectedPeriod || '-'}</span>
                                    </div>
                                    <div className="text-xs text-gray-700 line-clamp-2 md:line-clamp-1 md:truncate md:max-w-[28rem] break-words">{l.learningObjectives || '-'}</div>
                                  </div>
                                  <div className="flex items-center gap-2 self-start md:self-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${l.status==='Ready'?'bg-green-100 text-green-800': l.status==='Pending Review'?'bg-yellow-100 text-yellow-800': l.status==='Needs Rework'?'bg-orange-100 text-orange-800':'bg-gray-100 text-gray-800'}`}>{l.status}</span>
                                    {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                                      <>
                                        <button 
                                          onClick={() => handleApproveLesson(l.lpId, 'Ready')}
                                          disabled={!!rowSubmitting[l.lpId]}
                                          className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                                          title="Approve"
                                        >✓</button>
                                        {l.status === 'Pending Review' && (
                                          <button 
                                            onClick={() => handleApproveLesson(l.lpId, 'Needs Rework')}
                                            disabled={!!rowSubmitting[l.lpId]}
                                            className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                            title="Needs Rework"
                                          >⚠</button>
                                        )}
                                        <button 
                                          onClick={() => handleApproveLesson(l.lpId, 'Rejected')}
                                          disabled={!!rowSubmitting[l.lpId]}
                                          className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                                          title="Reject"
                                        >✗</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chapter Sessions Modal (view-only) */}
      {showChapterModal && selectedChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeChapterModal}>
            <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl p-4 md:p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-words">{selectedChapter.chapter}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {stripStdPrefix(selectedChapter.class)} • {selectedChapter.subject} • {selectedChapter.teacherName}
                  </p>
                </div>
                <button onClick={closeChapterModal} className="text-gray-500 hover:text-gray-700">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedChapter.lessons.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {selectedChapter.lessons.filter(l => l.status === 'Pending Review').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Approved</p>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedChapter.lessons.filter(l => l.status === 'Ready').length}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => { const pc = selectedChapter.lessons.filter(l => l.status === 'Pending Review').length; return (
                      <span className="text-xs text-gray-600 w-full sm:w-auto">Pending: {pc}</span>
                    ); })()}
                    <button
                      onClick={() => {
                        setBulkRescheduleChapter(selectedChapter);
                        const sortedLessons = selectedChapter.lessons.sort((a,b) => parseInt(a.session||0) - parseInt(b.session||0));
                        setBulkRescheduleDates(sortedLessons.map(l => ({ 
                          lpId: l.lpId, 
                          session: l.session, 
                          teacherEmail: l.teacherEmail || '',
                          date: l.selectedDate || '', 
                          period: l.selectedPeriod || '',
                          newDate: '',
                          newPeriod: ''
                        })));
                        setBulkTimetables({});
                        setBulkPlannedPeriods({});
                        setShowOtherClassPeriodsBulk(false);
                        setShowBulkRescheduleModal(true);
                      }}
                      className="px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 flex-1 sm:flex-initial whitespace-nowrap"
                      title="Reschedule all sessions in this chapter"
                    >📅 Reschedule Chapter</button>
                    <button
                      disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                      onClick={() => bulkUpdateChapter('Ready')}
                      className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                      title="Approve all pending in this chapter"
                    >{bulkSubmitting ? 'Working…' : 'Approve All'}</button>
                    <button
                      disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                      onClick={() => bulkUpdateChapter('Needs Rework')}
                      className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                      title="Send all pending for rework"
                    >Rework All</button>
                    <button
                      disabled={bulkSubmitting || selectedChapter.lessons.filter(l => l.status === 'Pending Review').length === 0}
                      onClick={() => bulkUpdateChapter('Rejected')}
                      className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex-1 sm:flex-initial whitespace-nowrap`}
                      title="Reject all pending in this chapter"
                    >Reject All</button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedChapter.lessons.map((l) => (
                  <div key={l.lpId} className={`border rounded-lg p-3 md:p-4 ${
                    l.status === 'Ready' ? 'border-green-300 bg-green-50' :
                    l.status === 'Pending Review' ? 'border-yellow-300 bg-yellow-50' :
                    'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">Session {l.session}</h3>
                        <p className="text-sm text-gray-600">
                          {l.selectedDate ? new Date(l.selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled'} 
                          {l.selectedPeriod && ` • Period ${l.selectedPeriod}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                          l.status === 'Ready' ? 'bg-green-100 text-green-800' :
                          l.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' :
                          l.status === 'Needs Rework' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {l.status}
                        </span>
                        {(l.status === 'Pending Review' || l.status === 'Needs Rework') && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button 
                              onClick={async () => { await handleApproveLesson(l.lpId, 'Ready'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Ready'} : x)}) : prev); }}
                              disabled={!!rowSubmitting[l.lpId]}
                              className={`text-green-600 px-1.5 py-0.5 bg-green-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-900'}`}
                              title="Approve"
                            >
                              {rowSubmitting[l.lpId] ? '…' : <CheckCircle className="h-4 w-4" />}
                            </button>
                            {l.status === 'Pending Review' && (
                              <button 
                                onClick={async () => { await handleApproveLesson(l.lpId, 'Needs Rework'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Needs Rework'} : x)}) : prev); }}
                                disabled={!!rowSubmitting[l.lpId]}
                                className={`text-yellow-600 px-1.5 py-0.5 bg-yellow-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-yellow-900'}`}
                                title="Send for rework"
                              >
                                {rowSubmitting[l.lpId] ? '…' : <AlertTriangle className="h-4 w-4" />}
                              </button>
                            )}
                            <button 
                              onClick={async () => { await handleApproveLesson(l.lpId, 'Rejected'); setSelectedChapter(prev => prev ? ({...prev, lessons: prev.lessons.map(x => x.lpId===l.lpId ? {...x, status: 'Rejected'} : x)}) : prev); }}
                              disabled={!!rowSubmitting[l.lpId]}
                              className={`text-red-600 px-1.5 py-0.5 bg-red-100 rounded text-xs ${rowSubmitting[l.lpId] ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-900'}`}
                              title="Reject"
                            >
                              {rowSubmitting[l.lpId] ? '…' : <XCircle className="h-4 w-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Learning Objectives:</p>
                      <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.learningObjectives || '-'}</p>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Teaching Methods:</p>
                      <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.teachingMethods || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {l.resourcesRequired && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Resources:</p>
                          <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.resourcesRequired}</p>
                        </div>
                      )}
                      {l.assessmentMethods && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Assessment:</p>
                          <p className="text-sm text-gray-900 bg-white p-2 rounded">{l.assessmentMethods}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
                <button onClick={closeChapterModal} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

    {/* Reschedule Modal */}
    {showRescheduleModal && rescheduleLesson && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reschedule Lesson Plan</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Teacher:</strong> {rescheduleLesson.teacherName}<br/>
                <strong>Class:</strong> {rescheduleLesson.class}<br/>
                <strong>Subject:</strong> {rescheduleLesson.subject}<br/>
                <strong>Chapter:</strong> {rescheduleLesson.chapter} (Session {rescheduleLesson.session})
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
              <input
                type="date"
                value={newDate}
                onChange={async (e) => {
                  const selectedDate = e.target.value;
                  setNewDate(selectedDate);
                  setNewPeriod('');
                  
                  // Fetch teacher's timetable and lesson plans for selected date
                  if (selectedDate && rescheduleLesson.teacherEmail) {
                    setLoadingPeriods(true);
                    try {
                      // Fetch timetable
                      const timetableData = await api.getTeacherDailyTimetable(rescheduleLesson.teacherEmail, selectedDate);
                      const periods = timetableData?.periods || [];
                      setRescheduleAvailablePeriods(periods);
                      
                      // Fetch lesson plans for this date to check which periods are already scheduled
                      const lessonPlansData = await api.getLessonPlansForDate(selectedDate);
                      const teacherPlans = (lessonPlansData?.lessonPlans || []).filter(
                        lp => (lp.teacherEmail || '').toLowerCase() === rescheduleLesson.teacherEmail.toLowerCase()
                      );
                      const plannedPeriods = teacherPlans.map(lp => String(lp.period || lp.selectedPeriod || ''));
                      setReschedulePlannedPeriods(plannedPeriods);
                    } catch (err) {
                      console.error('Error loading timetable:', err);
                      setRescheduleAvailablePeriods([]);
                      setReschedulePlannedPeriods([]);
                    } finally {
                      setLoadingPeriods(false);
                    }
                  } else {
                    setRescheduleAvailablePeriods([]);
                    setReschedulePlannedPeriods([]);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {loadingPeriods && (
              <div className="text-center py-2">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600 mt-2">Loading periods...</p>
              </div>
            )}
            
            {!loadingPeriods && newDate && rescheduleAvailablePeriods.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Period</label>
                <label className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                  <input
                    type="checkbox"
                    checked={showOtherClassPeriods}
                    onChange={(e) => setShowOtherClassPeriods(e.target.checked)}
                  />
                  Show other class periods (from timetable)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {rescheduleAvailablePeriods.map((period) => {
                    const norm = (v) => String(v || '').toLowerCase().trim();
                    const targetClass = norm(rescheduleLesson?.class);
                    const targetSubject = norm(rescheduleLesson?.subject);

                    const periodNum = period.period || period.Period || period.periodNumber;
                    const isFree = !period.class || period.class === 'Free' || period.subject === 'Free';
                    const hasLessonPlan = reschedulePlannedPeriods.includes(String(periodNum));
                    const isTarget = !isFree && norm(period.class) === targetClass && (!targetSubject || norm(period.subject) === targetSubject);
                    const isSelected = String(newPeriod) === String(periodNum);

                    if (!showOtherClassPeriods && !isFree && !isTarget) {
                      return null;
                    }
                    
                    return (
                      <button
                        key={periodNum}
                        type="button"
                        onClick={() => setNewPeriod(String(periodNum))}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : hasLessonPlan
                            ? 'border-orange-200 bg-orange-50 hover:border-orange-400'
                            : isTarget
                            ? 'border-green-200 bg-green-50 hover:border-green-400'
                            : isFree
                            ? 'border-gray-200 bg-gray-50 hover:border-gray-400'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-400'
                        }`}
                      >
                        <div className="font-semibold text-sm">
                          Period {periodNum}
                          {isSelected && <span className="ml-2 text-blue-600">✓</span>}
                        </div>
                        <div className="text-xs mt-1">
                          {hasLessonPlan ? (
                            <span className="text-orange-700">📅 Lesson Scheduled</span>
                          ) : isTarget ? (
                            <span className="text-green-700">✅ {rescheduleLesson.class} ({rescheduleLesson.subject})</span>
                          ) : isFree ? (
                            <span className="text-gray-700">Free</span>
                          ) : (
                            <>
                              <div className="text-gray-700">{period.class}</div>
                              <div className="text-gray-600">{period.subject}</div>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="text-green-600">● Green</span> = {rescheduleLesson.class} ({rescheduleLesson.subject}),
                  <span className="text-gray-600 ml-2">● Gray</span> = Free period,
                  <span className="text-orange-600 ml-2">● Orange</span> = Lesson already scheduled
                </p>
              </div>
            )}
            
            {!loadingPeriods && newDate && rescheduleAvailablePeriods.length === 0 && (
              <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                No timetable found for this date. You can still enter a period number manually.
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Number</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newPeriod}
                    onChange={(e) => setNewPeriod(e.target.value)}
                    placeholder="Enter period (1-10)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!newDate) {
                    alert('Please select a date');
                    return;
                  }
                  if (!newPeriod) {
                    alert('Please enter a period number');
                    return;
                  }
                  
                  try {
                    setRowSubmitting(prev => ({ ...prev, [rescheduleLesson.lpId]: true }));
                    const response = await api.rescheduleLessonPlan(
                      rescheduleLesson.lpId,
                      newDate,
                      newPeriod,
                      memoizedUser?.email || ''
                    );
                    
                    if (response.data?.success || response.success) {
                      alert('Lesson plan rescheduled successfully!');
                      setShowRescheduleModal(false);
                      setRescheduleLesson(null);
                      refreshApprovals();
                    } else {
                      alert('Failed to reschedule: ' + (response.data?.error || response.error || 'Unknown error'));
                    }
                  } catch (err) {
                    console.error('Error rescheduling:', err);
                    alert('Error rescheduling lesson plan: ' + err.message);
                  } finally {
                    setRowSubmitting(prev => ({ ...prev, [rescheduleLesson.lpId]: false }));
                  }
                }}
                disabled={rowSubmitting[rescheduleLesson.lpId]}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rowSubmitting[rescheduleLesson.lpId] ? 'Rescheduling...' : 'Reschedule'}
              </button>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleLesson(null);
                }}
                disabled={rowSubmitting[rescheduleLesson.lpId]}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  
    {/* Bulk Reschedule Chapter Modal */}
    {showBulkRescheduleModal && bulkRescheduleChapter && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reschedule Chapter: {bulkRescheduleChapter.chapter}</h3>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Class:</strong> {bulkRescheduleChapter.class}<br/>
                <strong>Subject:</strong> {bulkRescheduleChapter.subject}<br/>
                <strong>Total Sessions:</strong> {bulkRescheduleDates.length}
              </p>
            </div>
            
            {autoFillLoading && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-800 font-medium">Auto-filling sessions based on timetable...</span>
              </div>
            )}
            
            <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg">
              <div className="mb-3">
                ℹ️ <strong>Auto-fill Mode:</strong> Set the starting date and period for Session 1, and the system will automatically schedule subsequent sessions based on the teacher's timetable.
              </div>
              <div className="mb-2">
                <span className="text-green-600">● Green</span> = {bulkRescheduleChapter.class} ({bulkRescheduleChapter.subject}), <span className="text-gray-600">● Gray</span> = Free, <span className="text-orange-600">● Orange</span> = Lesson already scheduled.
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={showOtherClassPeriodsBulk}
                  onChange={(e) => setShowOtherClassPeriodsBulk(e.target.checked)}
                />
                Show other class periods (from timetable)
              </label>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Period</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Period</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bulkRescheduleDates.map((item, idx) => (
                    <tr key={item.lpId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.session}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{item.date || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{item.period || '-'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={bulkRescheduleDates[idx]?.newDate ?? ''}
                          onChange={async (e) => {
                            const selectedDate = e.target.value;
                            const updated = [...bulkRescheduleDates];
                            updated[idx] = { ...updated[idx], newDate: selectedDate, newPeriod: '' };
                            setBulkRescheduleDates(updated);
                            
                            // Fetch teacher timetable and lesson plans for this date
                            if (selectedDate && item.teacherEmail) {
                              const key = `${idx}-${selectedDate}`;
                              setBulkTimetables(prev => ({ ...prev, [key]: { loading: true, periods: [] } }));
                              try {
                                // Fetch timetable
                                const timetableData = await api.getTeacherDailyTimetable(item.teacherEmail, selectedDate);
                                const periods = timetableData?.periods || [];
                                setBulkTimetables(prev => ({ ...prev, [key]: { loading: false, periods } }));
                                
                                // Fetch lesson plans for this date
                                const lessonPlansData = await api.getLessonPlansForDate(selectedDate);
                                const teacherPlans = (lessonPlansData?.lessonPlans || []).filter(
                                  lp => (lp.teacherEmail || '').toLowerCase() === item.teacherEmail.toLowerCase()
                                );
                                const plannedPeriods = teacherPlans.map(lp => String(lp.period || lp.selectedPeriod || ''));
                                setBulkPlannedPeriods(prev => ({ ...prev, [key]: plannedPeriods }));
                              } catch (err) {
                                console.error('Error loading timetable:', err);
                                setBulkTimetables(prev => ({ ...prev, [key]: { loading: false, periods: [] } }));
                                setBulkPlannedPeriods(prev => ({ ...prev, [key]: [] }));
                              }
                            }
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          disabled={idx > 0 || autoFillLoading}
                          title={idx === 0 ? "Select date for Session 1 (will auto-fill subsequent sessions)" : "Auto-filled based on Session 1"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {idx > 0 ? (
                            // For sessions 2+, show read-only auto-filled value
                            <div className="px-2 py-1 text-sm bg-gray-100 border border-gray-300 rounded text-gray-700">
                              {bulkRescheduleDates[idx]?.newPeriod 
                                ? `Period ${bulkRescheduleDates[idx].newPeriod} (Auto)`
                                : 'Auto-fill from Session 1'}
                            </div>
                          ) : (
                            // Only Session 1 is editable
                            (() => {
                              const key = `${idx}-${bulkRescheduleDates[idx]?.newDate || ''}`;
                              const timetableData = bulkTimetables[key];
                              const periods = timetableData?.periods || [];
                              const loading = timetableData?.loading;
                              
                              if (loading) {
                                return <span className="text-xs text-gray-500">Loading...</span>;
                              }
                              
                              if (bulkRescheduleDates[idx]?.newDate && periods.length > 0) {
                                const norm = (v) => String(v || '').toLowerCase().trim();
                                const targetClass = norm(bulkRescheduleChapter?.class);
                                const targetSubject = norm(bulkRescheduleChapter?.subject);
                                const plannedPeriods = bulkPlannedPeriods[key] || [];
                                return (
                                  <div className="flex flex-wrap gap-1">
                                    {periods.map((p) => {
                                      const periodNum = p.period || p.Period || p.periodNumber;
                                      const isFree = !p.class || p.class === 'Free' || p.subject === 'Free';
                                      const hasLessonPlan = plannedPeriods.includes(String(periodNum));
                                      const isTarget = !isFree && norm(p.class) === targetClass && (!targetSubject || norm(p.subject) === targetSubject);
                                      const isSelected = String(bulkRescheduleDates[idx]?.newPeriod) === String(periodNum);

                                      if (!showOtherClassPeriodsBulk && !isFree && !isTarget) {
                                        return null;
                                      }
                                      return (
                                        <button
                                          key={periodNum}
                                          type="button"
                                          onClick={async () => {
                                            // Check if this period already has a lesson plan
                                            if (hasLessonPlan && idx === 0) {
                                              if (!window.confirm(
                                                `⚠️ Warning: Period ${periodNum} already has a lesson plan scheduled.\n\n` +
                                                `Do you want to proceed with this period anyway?`
                                              )) {
                                                return;
                                              }
                                            }
                                            
                                            const updated = [...bulkRescheduleDates];
                                            updated[idx] = { ...updated[idx], newPeriod: String(periodNum) };
                                            
                                            // Auto-fill subsequent sessions when session 1 period is selected
                                            if (idx === 0 && bulkRescheduleDates[0]?.newDate) {
                                              setAutoFillLoading(true);
                                              try {
                                                const teacherEmail = item.teacherEmail;
                                                const startDate = bulkRescheduleDates[0].newDate;
                                                const endDate = new Date(startDate);
                                                endDate.setDate(endDate.getDate() + 30);
                                                const endDateStr = endDate.toISOString().split('T')[0];
                                                
                                                const response = await api.getAvailablePeriodsForLessonPlan(
                                                  teacherEmail,
                                                  startDate,
                                                  endDateStr,
                                                  false, // Don't exclude existing - we want to include the selected starting slot
                                                  bulkRescheduleChapter.class,
                                                  bulkRescheduleChapter.subject
                                                );
                                                
                                                const actualData = response?.data || response;
                                                if (actualData.success && actualData.availableSlots) {
                                                  // Filter to start from selected date/period
                                                  const allSlots = actualData.availableSlots;
                                                  const startIdx = allSlots.findIndex(
                                                    s => s.date === startDate && String(s.period) === String(periodNum)
                                                  );
                                                  
                                                  if (startIdx >= 0) {
                                                    // Start from the selected slot and take subsequent available slots
                                                    const slotsFromStart = allSlots.slice(startIdx).filter(p => p.isAvailable);
                                                    for (let i = 0; i < updated.length && i < slotsFromStart.length; i++) {
                                                      updated[i].newDate = slotsFromStart[i].date;
                                                      updated[i].newPeriod = String(slotsFromStart[i].period);
                                                    }
                                                  } else {
                                                    // Fallback: just use available slots from start date onwards
                                                    const available = allSlots.filter(p => 
                                                      p.isAvailable && p.date >= startDate
                                                    );
                                                    // Manually set first session to selected slot
                                                    updated[0].newDate = startDate;
                                                    updated[0].newPeriod = String(periodNum);
                                                    // Fill rest with available slots
                                                    for (let i = 1; i < updated.length && i - 1 < available.length; i++) {
                                                      updated[i].newDate = available[i - 1].date;
                                                      updated[i].newPeriod = String(available[i - 1].period);
                                                    }
                                                  }
                                                }
                                              } catch (err) {
                                                console.error('Error auto-filling sessions:', err);
                                                alert('Failed to auto-fill sessions. Please try again.');
                                              } finally {
                                                setAutoFillLoading(false);
                                              }
                                            }
                                            
                                            setBulkRescheduleDates(updated);
                                          }}
                                          disabled={autoFillLoading}
                                          className={`px-2 py-1 text-xs rounded border ${
                                            isSelected
                                              ? 'bg-blue-600 text-white border-blue-600'
                                              : hasLessonPlan
                                              ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                                              : isTarget
                                              ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                              : isFree
                                              ? 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                          }`}
                                          title={hasLessonPlan ? `Period ${periodNum} - Lesson scheduled` : isTarget ? `Period ${periodNum} - ${bulkRescheduleChapter.class} ${bulkRescheduleChapter.subject}` : isFree ? `Period ${periodNum} - Free` : `Period ${periodNum} - ${p.class} ${p.subject}`}
                                        >
                                          {periodNum}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              
                              return (
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={bulkRescheduleDates[idx]?.newPeriod || ''}
                                  onChange={(e) => {
                                    const updated = [...bulkRescheduleDates];
                                    updated[idx] = { ...updated[idx], newPeriod: e.target.value };
                                    setBulkRescheduleDates(updated);
                                  }}
                                  placeholder="1-10"
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                              );
                            })()
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  // Validate all entries
                  const incomplete = bulkRescheduleDates.filter(item => !item.newDate || !item.newPeriod);
                  if (incomplete.length > 0) {
                    alert(`Please set date and period for all ${incomplete.length} session(s)`);
                    return;
                  }
                  
                  try {
                    setBulkSubmitting(true);
                    let successCount = 0;
                    let failCount = 0;
                    
                    for (const item of bulkRescheduleDates) {
                      try {
                        const response = await api.rescheduleLessonPlan(
                          item.lpId,
                          item.newDate,
                          item.newPeriod,
                          memoizedUser?.email || ''
                        );
                        
                        const result = response.data || response;
                        if (result.success) {
                          successCount++;
                        } else {
                          failCount++;
                          console.error('Failed to reschedule session', item.session, result.error || 'Unknown error', response);
                        }
                      } catch (err) {
                        failCount++;
                        console.error('Error rescheduling session', item.session, err);
                      }
                    }
                    
                    alert(`Bulk reschedule complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
                    setShowBulkRescheduleModal(false);
                    setBulkRescheduleChapter(null);
                    setBulkRescheduleDates([]);
                    setBulkTimetables({});
                    setBulkPlannedPeriods({});
                    refreshApprovals();
                  } catch (err) {
                    console.error('Error in bulk reschedule:', err);
                    alert('Error during bulk reschedule: ' + err.message);
                  } finally {
                    setBulkSubmitting(false);
                  }
                }}
                disabled={bulkSubmitting}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSubmitting ? 'Rescheduling All Sessions...' : 'Reschedule All Sessions'}
              </button>
              <button
                onClick={() => {
                  setShowBulkRescheduleModal(false);
                  setBulkRescheduleChapter(null);
                  setBulkRescheduleDates([]);
                  setBulkTimetables({});
                  setBulkPlannedPeriods({});
                }}
                disabled={bulkSubmitting}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default LessonApprovalsView;
