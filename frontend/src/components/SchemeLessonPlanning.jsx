import { Clock, CheckCircle, AlertCircle, BookOpen, Users, Plus, Search, Sparkles } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ai from '../api-ai.js';
import * as api from '../api.js';

// Generic API request function
const apiRequest = async (action, params = {}, method = 'GET') => {
  try {
    console.log(`Making API request: ${action}`, params);

    if (method === 'GET') {
      switch (action) {
        case 'getApprovedSchemesForLessonPlanning':
          console.log('Calling getApprovedSchemesForLessonPlanning with:', params.teacherEmail);
          return await api.getApprovedSchemesForLessonPlanning(params.teacherEmail);
        case 'getAvailablePeriodsForLessonPlan':
          return await api.getAvailablePeriodsForLessonPlan(
            params.teacherEmail,
            params.startDate,
            params.endDate,
            params.excludeExisting !== 'false',
            params.class || '',        // ✅ Pass class parameter
            params.subject || ''       // ✅ Pass subject parameter
          );
        default:
          throw new Error(`Unknown GET action: ${action}`);
      }
    } else if (method === 'POST') {
      switch (action) {
        case 'createSchemeLessonPlan':
          return await api.createSchemeLessonPlan(params.lessonPlanData);
        default:
          throw new Error(`Unknown POST action: ${action}`);
      }
    }
  } catch (error) {
    console.error(`API request failed for ${action}:`, error);
    throw error;
  }
};

const SchemeLessonPlanning = ({ userEmail, userName }) => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [examIndex, setExamIndex] = useState({ byDate: new Set(), byDatePeriod: new Set(), meta: [] });
  const [submitting, setSubmitting] = useState(false);
  const [showLessonPlanForm, setShowLessonPlanForm] = useState(false);
  const [planningDateRange, setPlanningDateRange] = useState(null);
  const [classFilter, setClassFilter] = useState('all');
  const [lessonPlanData, setLessonPlanData] = useState({
    learningObjectives: '',
    teachingMethods: '',
    resourcesRequired: '',
    assessmentMethods: '',
    selectedDate: '',
    selectedPeriod: ''
  });

  // Bulk preparation state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPrepData, setBulkPrepData] = useState(null);

  // View session details modal (for bulk-only mode)
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewSessionData, setViewSessionData] = useState(null);

  // AI suggestions state
  const [loadingAI, setLoadingAI] = useState(false);
  
  // Bulk-only mode setting
  const [isBulkOnlyMode, setIsBulkOnlyMode] = useState(false);

  const loadApprovedSchemes = useCallback(async () => {
    try {
      setLoading(true);

      // Debug logging
      console.log('Loading schemes for user:', userEmail);

      if (!userEmail) {
        setError('No user email provided');
        return;
      }

      const response = await apiRequest('getApprovedSchemesForLessonPlanning', {
        teacherEmail: userEmail
      });

      console.log('Scheme response:', response);
      console.log('Response data:', response.data);
      console.log('Response success:', response.data?.success);
      console.log('Response schemes:', response.data?.schemes);
      console.log('Planning date range:', response.data?.planningDateRange);

      if (response.data && response.data.success) {
        setSchemes(response.data.schemes || []);
        setPlanningDateRange(response.data.planningDateRange || null);
        
        // Check if bulk-only mode is enabled
        if (response.data.settings && response.data.settings.bulkOnly) {
          setIsBulkOnlyMode(true);
          console.log('Bulk-only mode is ENABLED - single session preparation disabled');
        } else {
          setIsBulkOnlyMode(false);
        }
        
        setError(null);
      } else {
        const errorMsg = response.data?.error || response.error || 'Failed to load schemes';
        console.log('Setting error:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error loading schemes:', err);
      setError('Error loading schemes: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      loadApprovedSchemes();
    }
  }, [userEmail, loadApprovedSchemes]);

  // Memoize available classes to prevent recalculation on every render
  const availableClasses = useMemo(() => {
    return [...new Set(schemes.map(s => s.class))].sort();
  }, [schemes]);

  // Memoize filtered schemes to prevent recalculation on every render
  const filteredSchemes = useMemo(() => {
    return classFilter === 'all' ? schemes : schemes.filter(s => s.class === classFilter);
  }, [schemes, classFilter]);

  // Memoize statistics to prevent recalculation on every render
  const statistics = useMemo(() => {
    const filtered = filteredSchemes;
    return {
      count: filtered.length,
      totalSessions: filtered.reduce((sum, s) => sum + s.totalSessions, 0),
      plannedSessions: filtered.reduce((sum, s) => sum + s.plannedSessions, 0)
    };
  }, [filteredSchemes]);

  const loadAvailablePeriods = async (session) => {
    try {
      setLoadingPeriods(true);

      // Use date range from backend (calculated based on Settings)
      let startDate, endDate;

      if (planningDateRange) {
        startDate = planningDateRange.startDate;
        endDate = planningDateRange.endDate;
        console.log('Using backend date range:', { startDate, endDate, deferredDays: planningDateRange.deferredDays, daysAhead: planningDateRange.daysAhead });
      } else {
        // Fallback: Calculate next week (Monday to Friday) if date range not available
        const today = new Date();
        const dayOfWeek = today.getDay();

        let daysUntilNextMonday;
        if (dayOfWeek === 0) { // Sunday
          daysUntilNextMonday = 1;
        } else if (dayOfWeek === 1) { // Monday
          daysUntilNextMonday = 7;
        } else {
          daysUntilNextMonday = 8 - dayOfWeek;
        }

        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + daysUntilNextMonday);

        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextMonday.getDate() + 4);

        startDate = nextMonday.toISOString().split('T')[0];
        endDate = nextFriday.toISOString().split('T')[0];
        console.log('Using fallback date range:', { startDate, endDate });
      }

      console.log('Loading available periods with params:', {
        teacherEmail: userEmail,
        class: session.class,
        subject: session.subject,
        startDate,
        endDate,
        excludeExisting: 'true'
      });

      const response = await apiRequest('getAvailablePeriodsForLessonPlan', {
        teacherEmail: userEmail,
        class: session.class,
        subject: session.subject,
        startDate,
        endDate,
        excludeExisting: 'true'
      });

      console.log('Available periods response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', Object.keys(response || {}));
      console.log('Response.data:', response?.data);
      console.log('Response.data type:', typeof response?.data);
      console.log('Response.data keys:', Object.keys(response?.data || {}));

      // Check if the response has the expected structure
      const actualData = response?.data || response;
      console.log('Actual data to check:', actualData);
      console.log('Actual data success:', actualData?.success);

      if (actualData && actualData.success) {
        const periods = actualData.availableSlots || [];
        console.log('✅ Periods loaded successfully!');
        console.log('Total periods:', periods.length);
        console.log('Available periods:', periods.filter(p => p.isAvailable).length);
        console.log('Occupied periods:', periods.filter(p => p.isOccupied).length);
        console.log('First 3 periods:', periods.slice(0, 3));
        setAvailablePeriods(periods);

        // Also load exams for the class/subject and mark conflict dates/periods
        try {
          const allExams = await api.getExams({ class: session.class, subject: session.subject });
          const idxByDate = new Set();
          const idxByDatePeriod = new Set();
          const meta = [];
          if (Array.isArray(allExams)) {
            for (const ex of allExams) {
              const d = (ex.date || ex.examDate || '').toString().split('T')[0];
              if (d) {
                idxByDate.add(d);
                // If exam period known, index date|period
                const p = ex.period || ex.examPeriod || '';
                if (p) idxByDatePeriod.add(`${d}|${p}`);
                meta.push({ date: d, period: p, name: ex.examName || ex.examType || 'Exam', class: ex.class, subject: ex.subject });
              }
            }
          }
          setExamIndex({ byDate: idxByDate, byDatePeriod: idxByDatePeriod, meta });
        } catch (e) {
          console.warn('Failed to load exams for conflict highlighting', e);
          setExamIndex({ byDate: new Set(), byDatePeriod: new Set(), meta: [] });
        }
      } else {
        const errorMsg = actualData?.error || 'Unknown error loading periods';
        console.error('Period loading error:', errorMsg);
        console.log('Full error details:', {
          response: response,
          actualData: actualData,
          hasSuccess: 'success' in (actualData || {}),
          successValue: actualData?.success
        });
        alert('Error loading available periods: ' + errorMsg);
      }
    } catch (err) {
      console.error('Period loading exception:', err);
      alert('Error loading periods: ' + err.message);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handleSessionClick = async (scheme, chapter, session) => {
    console.log('Session clicked:', { scheme, chapter, session });

    if (session.status === 'planned') {
      // Show existing lesson plan details with formatted date
      const formattedDate = session.plannedDate ? formatDate(session.plannedDate) : session.plannedDate;
      alert(`This session is already planned for ${formattedDate} Period ${session.plannedPeriod}`);
      return;
    }

    // Load available periods for this session
    const sessionData = {
      schemeId: scheme.schemeId,
      class: scheme.class,
      subject: scheme.subject,
      chapter: chapter.chapterName,
      session: session.sessionNumber,
      sessionName: session.sessionName,
      content: scheme.content, totalSessions: chapter.totalSessions
    };

    console.log('Setting selected session:', sessionData);
    console.log('Opening lesson plan form modal');

    setSelectedSession(sessionData);
    setShowLessonPlanForm(true);

    console.log('Loading available periods...');
    await loadAvailablePeriods(sessionData);
  };

  const handlePeriodSelect = (period) => {
    setLessonPlanData({
      ...lessonPlanData,
      selectedDate: period.date,
      selectedPeriod: period.period
    });
  };

  const handleSubmitLessonPlan = async () => {
    try {
      if (!selectedSession || !lessonPlanData.selectedDate || !lessonPlanData.selectedPeriod) {
        alert('Please select a period and fill in the lesson plan details');
        return;
      }

      setSubmitting(true);

      const submitData = {
        schemeId: selectedSession.schemeId,
        chapter: selectedSession.chapter,
        session: selectedSession.session, topic: selectedSession.content, totalSessions: selectedSession.totalSessions,
        teacherEmail: userEmail,
        teacherName: userName,
        selectedDate: lessonPlanData.selectedDate,
        selectedPeriod: lessonPlanData.selectedPeriod,
        learningObjectives: lessonPlanData.learningObjectives,
        teachingMethods: lessonPlanData.teachingMethods,
        resourcesRequired: lessonPlanData.resourcesRequired,
        assessmentMethods: lessonPlanData.assessmentMethods,
        status: 'submitted'
      };

      console.log('Submitting lesson plan with data:', submitData);
      const response = await apiRequest('createSchemeLessonPlan', {
        lessonPlanData: submitData
      }, 'POST');

      console.log('Received response:', response);

      // Extract actual data from wrapped response
      const actualData = response?.data || response;

      if (actualData && actualData.success) {
        alert('Lesson plan created successfully!');
        setShowLessonPlanForm(false);
        setSelectedSession(null);
        setLessonPlanData({
          learningObjectives: '',
          teachingMethods: '',
          resourcesRequired: '',
          assessmentMethods: '',
          selectedDate: '',
          selectedPeriod: ''
        });
        // Reload schemes to show updated status
        await loadApprovedSchemes();
      } else {
        const errorMsg = actualData?.error || actualData?.message || 'Unknown error occurred';
        console.error('Lesson plan creation failed:', errorMsg);
        alert('Error creating lesson plan: ' + errorMsg);
      }
    } catch (err) {
      console.error('Exception submitting lesson plan:', err);
      alert('Error submitting lesson plan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAISuggestions = async () => {
    if (!selectedSession) {
      console.error('[AI] No session selected');
      return;
    }

    setLoadingAI(true);
    try {
      const context = {
        teacherEmail: userEmail,
        class: selectedSession.class,
        subject: selectedSession.subject,
        chapter: selectedSession.chapter,
        session: selectedSession.session, topic: selectedSession.content, totalSessions: selectedSession.totalSessions
      };

      console.log('[AI] Requesting AI suggestions with context:', context);
      const res = await ai.suggestLessonPlan(context);
      console.log('[AI] Response:', res);

      const success = !!res?.success;
      const suggestion = res?.suggestion;
      if (success && suggestion) {
        const learningObjectives = Array.isArray(suggestion.objectives) ? suggestion.objectives.join('\n') : '';
        const teachingMethods = Array.isArray(suggestion.activities) ? suggestion.activities.join('\n') : '';
        const resourcesRequired = Array.isArray(suggestion.materials) ? suggestion.materials.join('\n') : '';
        const assessmentMethods = Array.isArray(suggestion.assessment) ? suggestion.assessment.join('\n') : '';

        setLessonPlanData(prev => ({
          ...prev,
          learningObjectives: learningObjectives || prev.learningObjectives,
          teachingMethods: teachingMethods || prev.teachingMethods,
          resourcesRequired: resourcesRequired || prev.resourcesRequired,
          assessmentMethods: assessmentMethods || prev.assessmentMethods
        }));
        alert('✨ AI suggestions loaded! You can edit them before submitting.');
      } else {
        const errorMsg = res?.error || 'Unknown error';
        console.error('[AI] FAILED - Error:', errorMsg);
        alert(`AI Error: ${errorMsg}\n\nTry the search buttons instead.`);
      }
    } catch (err) {
      console.error('[AI] EXCEPTION:', err.message, err.stack);
      alert('AI service unavailable. Use search buttons to find examples online.');
    } finally {
      setLoadingAI(false);
    }
  };

  const getStatusIcon = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();
    switch (normalizedStatus) {
      case 'cascaded':
        return <CheckCircle className="w-4 h-4 text-orange-600" />;
      case 'reported':
        return <CheckCircle className="w-4 h-4 text-purple-600" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'planned':
      case 'pending review':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      case 'not-planned':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleBulkPrepareClick = (scheme, chapter) => {
    console.log('Bulk prepare clicked:', { scheme, chapter });
    setBulkPrepData({
      scheme,
      chapter,
      sessionCount: chapter.totalSessions
    });
    setShowBulkModal(true);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Strip "STD " prefix from class names for display
  const stripStdPrefix = (className) => {
    if (!className) return '';
    return String(className).replace(/^STD\s+/i, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading approved schemes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
        <button
          onClick={loadApprovedSchemes}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        {/* Mobile-optimized header */}
        <div className="space-y-4 mb-4">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              <span className="hidden sm:inline">Lesson Plan Preparation</span>
              <span className="sm:hidden">Lesson Plans</span>
            </h2>
            <button
              onClick={loadApprovedSchemes}
              disabled={loading}
              className="px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Statistics - Mobile optimized */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-4 text-xs sm:text-sm">
            <div className="bg-blue-50 rounded px-2 py-1 text-center sm:text-left">
              <div className="font-semibold text-blue-700">{statistics.count}</div>
              <div className="text-blue-600 text-[10px] sm:text-xs">Schemes</div>
            </div>
            <div className="bg-purple-50 rounded px-2 py-1 text-center sm:text-left">
              <div className="font-semibold text-purple-700">{statistics.totalSessions}</div>
              <div className="text-purple-600 text-[10px] sm:text-xs">Total</div>
            </div>
            <div className="bg-green-50 rounded px-2 py-1 text-center sm:text-left">
              <div className="font-semibold text-green-700">{statistics.plannedSessions}</div>
              <div className="text-green-600 text-[10px] sm:text-xs">Planned</div>
            </div>
          </div>

          {/* Filter - Full width on mobile */}
          <div className="flex items-center space-x-2">
            <label htmlFor="class-filter" className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
              Class:
            </label>
            <select
              id="class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Classes</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {schemes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No approved schemes found. Please ensure you have approved schemes before creating lesson plans.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSchemes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No schemes found for class "{classFilter}"</p>
                <button
                  onClick={() => setClassFilter('all')}
                  className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Show All Classes
                </button>
              </div>
            ) : (
              filteredSchemes.map((scheme) => (
                  <div key={scheme.schemeId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    {/* Mobile-optimized scheme header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900">
                          {stripStdPrefix(scheme.class)} - {scheme.subject}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {scheme.academicYear} | Term: {scheme.term}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          Progress: {scheme.plannedSessions}/{scheme.totalSessions} sessions
                        </div>
                        <div className="w-full sm:w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProgressColor(scheme.overallProgress)}`}
                            style={{ width: `${scheme.overallProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {scheme.overallProgress}% complete
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                      {scheme.chapters.map((chapter) => (
                        <div key={`${scheme.schemeId}-${chapter.chapterNumber}`} className="border-l-4 border-blue-200 pl-2 sm:pl-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <h4 className="text-sm sm:text-base font-medium text-gray-800">
                                Ch {chapter.chapterNumber}: {chapter.chapterName}
                              </h4>
                              {chapter.plannedSessions === 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBulkPrepareClick(scheme, chapter);
                                  }}
                                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                  title="Prepare all sessions at once"
                                >
                                  <Plus className="w-3 h-3" />
                                  Prepare All ({chapter.totalSessions})
                                </button>
                              )}
                            </div>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {chapter.plannedSessions}/{chapter.totalSessions} planned
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {chapter.sessions.map((session) => (
                              <div
                                key={`${scheme.schemeId}-${chapter.chapterNumber}-${session.sessionNumber}`}
                                onClick={() => {
                                  // In bulk-only mode, handle session clicks
                                  if (isBulkOnlyMode) {
                                    const normalizedStatus = String(session.status || '').toLowerCase();
                                    if (['planned', 'pending review', 'ready', 'cascaded', 'reported'].includes(normalizedStatus)) {
                                      // Show view-only modal with session details
                                      setViewSessionData({ scheme, chapter, session });
                                      setShowViewModal(true);
                                    } else {
                                      // Check if this is an extended session (auto-generated)
                                      // Extended sessions have sessionName starting with "Extended Session" or isExtended flag
                                      const isExtendedSession = session.sessionName?.includes('Extended') || 
                                                               session.isExtended === true ||
                                                               session.sessionNumber > chapter.numberOfSessions;
                                      
                                      // Allow single session preparation ONLY for extended sessions
                                      if (isExtendedSession) {
                                        handleSessionClick(scheme, chapter, session);
                                      } else {
                                        // For regular sessions, redirect to bulk preparation
                                        setBulkPrepData({ scheme, chapter });
                                        setShowBulkModal(true);
                                      }
                                    }
                                    return;
                                  }
                                  
                                  const normalizedStatus = String(session.status || '').toLowerCase();
                                  if (!['cancelled', 'reported'].includes(normalizedStatus)) {
                                    handleSessionClick(scheme, chapter, session);
                                  }
                                }}
                                className={`p-3 rounded transition-colors ${String(session.status || '').toLowerCase() === 'reported'
                                  ? 'bg-purple-50 border-2 border-purple-300 opacity-90 cursor-default'
                                  : String(session.status || '').toLowerCase() === 'cascaded'
                                    ? 'bg-orange-50 border-2 border-orange-300 hover:bg-orange-100 cursor-default'
                                    : String(session.status || '').toLowerCase() === 'ready'
                                      ? 'bg-blue-50 border-2 border-blue-300 hover:bg-blue-100 cursor-pointer'
                                      : ['planned', 'pending review'].includes(String(session.status || '').toLowerCase())
                                        ? 'bg-green-50 border-2 border-green-300 hover:bg-green-100 cursor-pointer'
                                        : String(session.status || '').toLowerCase() === 'cancelled'
                                          ? 'bg-gray-50 border-2 border-gray-300 opacity-60 cursor-not-allowed'
                                          : 'bg-red-50 border-2 border-red-300 hover:bg-red-100 cursor-pointer'
                                  }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    Session {session.sessionNumber}
                                  </span>
                                  {getStatusIcon(session.status)}
                                </div>
                                <div className="text-xs text-gray-600 mb-1">
                                  {session.sessionName}
                                </div>
                                {String(session.status || '').toLowerCase() === 'reported' && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-purple-700 font-semibold bg-purple-100 rounded px-2 py-1 inline-block">
                                      ✓ Reported
                                    </div>
                                    <div className="text-xs text-purple-700">
                                      {formatDate(session.plannedDate)} P{session.plannedPeriod}
                                    </div>
                                  </div>
                                )}
                                {String(session.status || '').toLowerCase() === 'cascaded' && (
                                  <div className="space-y-1" title={`Moved from ${session.originalDate ? formatDate(session.originalDate) : 'original date unavailable'}${session.originalPeriod ? ` P${session.originalPeriod}` : ''} → ${session.plannedDate ? formatDate(session.plannedDate) : ''}${session.plannedPeriod ? ` P${session.plannedPeriod}` : ''}`}>
                                    <div className="text-xs text-orange-700 font-semibold bg-orange-100 rounded px-2 py-1 inline-block">
                                      ↻ Cascaded
                                    </div>
                                    <div className="text-xs text-orange-700">
                                      {session.originalDate ? (
                                        <>
                                          <span className="opacity-80">from</span> {formatDate(session.originalDate)}{session.originalPeriod ? ` P${session.originalPeriod}` : ''}
                                          <span className="opacity-80"> to</span> {session.plannedDate ? formatDate(session.plannedDate) : ''}{session.plannedPeriod ? ` P${session.plannedPeriod}` : ''}
                                        </>
                                      ) : (
                                        <>
                                          Rescheduled via cascade{session.plannedDate && session.plannedPeriod ? `: ${formatDate(session.plannedDate)} P${session.plannedPeriod}` : ''}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {String(session.status || '').toLowerCase() === 'ready' && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-blue-700 font-semibold bg-blue-100 rounded px-2 py-1 inline-block">
                                      ✓ Approved
                                    </div>
                                    <div className="text-xs text-blue-700">
                                      {formatDate(session.plannedDate)} P{session.plannedPeriod}
                                    </div>
                                  </div>
                                )}
                                {['planned', 'pending review'].includes(String(session.status || '').toLowerCase()) && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-green-700 font-semibold bg-green-100 rounded px-2 py-1 inline-block">
                                      ⏳ Pending Review
                                    </div>
                                    <div className="text-xs text-green-700">
                                      {formatDate(session.plannedDate)} P{session.plannedPeriod}
                                    </div>
                                  </div>
                                )}
                                {String(session.status || '').toLowerCase() === 'cancelled' && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-700 font-semibold bg-gray-200 rounded px-2 py-1 inline-block">
                                      ❌ Cancelled
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {session.plannedDate && session.plannedPeriod ? `${formatDate(session.plannedDate)} P${session.plannedPeriod}` : 'No longer needed'}
                                    </div>
                                  </div>
                                )}
                                {session.status === 'not-planned' && (
                                  <div className="text-xs text-red-600 flex items-center">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Click to plan
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* Lesson Plan Creation Modal */}
      {showLessonPlanForm && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-3 sm:p-6 border-b border-gray-200 z-10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Create Lesson Plan: {selectedSession.chapter} - Session {selectedSession.session}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {selectedSession.class} {selectedSession.subject} | {selectedSession.sessionName}
              </p>
            </div>

            {/* Preparation Day Warning */}
            {planningDateRange && !planningDateRange.canSubmit && (
              <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Submission restricted</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Lesson plans can only be submitted on <strong>{planningDateRange.preparationDay}</strong>.
                      You can view and select periods, but submission will be disabled.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Period Selection */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Select Teaching Period</h4>
                {loadingPeriods ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <span className="text-sm text-gray-500 mt-2">Loading available periods...</span>
                  </div>
                ) : availablePeriods.length === 0 ? (
                  <div className="text-center py-8 bg-amber-50 rounded-lg border-2 border-amber-300">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-600" />
                    <p className="font-semibold text-amber-900 mb-2">No Periods Found</p>
                    <div className="text-sm text-amber-800 space-y-2 max-w-md mx-auto">
                      <p>Your timetable doesn't have <strong>{selectedSession?.subject}</strong> for <strong>{selectedSession?.class}</strong> in the planning window.</p>
                      <p className="text-xs mt-2">Please check:</p>
                      <ul className="list-disc list-inside text-xs text-left inline-block">
                        <li>Timetable has this class/subject assigned to you</li>
                        <li>Planning window date range is correct</li>
                      </ul>
                    </div>
                  </div>
                ) : availablePeriods.filter(p => p.isAvailable).length === 0 ? (
                  <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border-2 border-amber-300">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                    <p className="font-semibold text-amber-900 mb-2">All Periods Occupied</p>
                    <p className="text-sm text-amber-800">
                      Found {availablePeriods.length} periods for <strong>{selectedSession?.class} {selectedSession?.subject}</strong>, but all are already planned.
                    </p>
                    <button
                      onClick={() => { setLoadingPeriods(true); loadAvailablePeriods(selectedSession); }}
                      className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                      🔄 Refresh Periods
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">
                      Showing {availablePeriods.filter(p => p.isAvailable).length} available periods
                      (Total: {availablePeriods.length}, Occupied: {availablePeriods.filter(p => p.isOccupied).length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
                      {availablePeriods.filter(p => p.isAvailable).map((period) => (
                        <div
                          key={`${period.date}-${period.period}`}
                          onClick={() => handlePeriodSelect(period)}
                          className={`p-3 border rounded cursor-pointer transition-colors ${lessonPlanData.selectedDate === period.date && lessonPlanData.selectedPeriod === period.period
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                          <div className="text-sm font-medium">{formatDate(period.date)}</div>
                          <div className="text-xs text-gray-600">
                            Period {period.period} ({period.startTime} - {period.endTime})
                          </div>
                          <div className="text-xs text-gray-500">
                            {period.class} {period.subject}
                          </div>
                          {(() => {
                            const dkey = (period.date || '').toString().split('T')[0];
                            const pkey = `${dkey}|${period.period}`;
                            const hasExamDay = examIndex.byDate.has(dkey);
                            const hasExamPeriod = examIndex.byDatePeriod.has(pkey);
                            if (!hasExamDay && !hasExamPeriod) return null;
                            return (
                              <div className={`mt-2 text-xs ${hasExamPeriod ? 'text-red-700' : 'text-amber-700'} flex items-center gap-1`}>
                                <AlertCircle className={`w-4 h-4 ${hasExamPeriod ? 'text-red-600' : 'text-amber-600'}`} />
                                {hasExamPeriod ? 'Exam scheduled in this period' : 'Exam day in academic calendar'}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lessonPlanData.selectedDate && lessonPlanData.selectedPeriod && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    Selected: {formatDate(lessonPlanData.selectedDate)} Period {lessonPlanData.selectedPeriod}
                    {(() => {
                      const dkey = (lessonPlanData.selectedDate || '').toString().split('T')[0];
                      const pkey = `${dkey}|${lessonPlanData.selectedPeriod}`;
                      const hasExamDay = examIndex.byDate.has(dkey);
                      const hasExamPeriod = examIndex.byDatePeriod.has(pkey);
                      if (!hasExamDay && !hasExamPeriod) return null;
                      return (
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${hasExamPeriod ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {hasExamPeriod ? '⚠ Exam scheduled in this period' : '⚠ Exam day in calendar'}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* AI Suggestions Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleAISuggestions}
                  disabled={loadingAI}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAI ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating AI Suggestions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      ✨ Get AI Suggestions (Auto-fill all fields)
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Powered by Google Gemini AI • Free to use • Edit suggestions before submitting
                </p>
              </div>

              {/* Lesson Plan Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Learning Objectives
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const query = `lesson plan learning objectives ${selectedSession?.subject || ''} class ${selectedSession?.class || ''} ${selectedSession?.chapter || ''}`.trim();
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title="Search for examples online"
                    >
                      <Search className="w-3 h-3" />
                      Find Examples
                    </button>
                  </div>
                  <textarea
                    value={lessonPlanData.learningObjectives}
                    onChange={(e) => setLessonPlanData({ ...lessonPlanData, learningObjectives: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="What will students learn in this session?"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Teaching Methods
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const query = `teaching methods ${selectedSession?.subject || ''} class ${selectedSession?.class || ''} ${selectedSession?.chapter || ''}`.trim();
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title="Search for teaching strategies"
                    >
                      <Search className="w-3 h-3" />
                      Search Methods
                    </button>
                  </div>
                  <textarea
                    value={lessonPlanData.teachingMethods}
                    onChange={(e) => setLessonPlanData({ ...lessonPlanData, teachingMethods: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="How will you teach this session?"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Resources Required
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const query = `teaching resources materials ${selectedSession?.subject || ''} ${selectedSession?.chapter || ''}`.trim();
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title="Find teaching resources"
                    >
                      <Search className="w-3 h-3" />
                      Find Resources
                    </button>
                  </div>
                  <textarea
                    value={lessonPlanData.resourcesRequired}
                    onChange={(e) => setLessonPlanData({ ...lessonPlanData, resourcesRequired: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="What materials, tools, or resources do you need?"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Assessment Methods
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const query = `assessment methods ${selectedSession?.subject || ''} class ${selectedSession?.class || ''}`.trim();
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title="Search for assessment ideas"
                    >
                      <Search className="w-3 h-3" />
                      Search Ideas
                    </button>
                  </div>
                  <textarea
                    value={lessonPlanData.assessmentMethods}
                    onChange={(e) => setLessonPlanData({ ...lessonPlanData, assessmentMethods: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="How will you assess student understanding?"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowLessonPlanForm(false);
                  setSelectedSession(null);
                  setLessonPlanData({
                    learningObjectives: '',
                    teachingMethods: '',
                    resourcesRequired: '',
                    assessmentMethods: '',
                    selectedDate: '',
                    selectedPeriod: ''
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLessonPlan}
                disabled={
                  submitting ||
                  !lessonPlanData.selectedDate ||
                  !lessonPlanData.selectedPeriod ||
                  (planningDateRange && !planningDateRange.canSubmit)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                title={planningDateRange && !planningDateRange.canSubmit ? `Can only submit on ${planningDateRange.preparationDay}` : ''}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Create Lesson Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Preparation Modal */}
      {showBulkModal && bulkPrepData && (
        <BulkPreparationModal
          data={bulkPrepData}
          userEmail={userEmail}
          userName={userName}
          planningDateRange={planningDateRange}
          onClose={() => {
            setShowBulkModal(false);
            setBulkPrepData(null);
          }}
          onSuccess={() => {
            setShowBulkModal(false);
            setBulkPrepData(null);
            loadApprovedSchemes(); // Reload to show updated status
          }}
        />
      )}

      {/* View Session Details Modal (Read-Only) */}
      {showViewModal && viewSessionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Session {viewSessionData.session.sessionNumber} Details
                  </h2>
                  <p className="text-blue-100">
                    {viewSessionData.chapter.chapterName}
                  </p>
                  <p className="text-sm text-blue-200 mt-1">
                    {viewSessionData.scheme.class} • {viewSessionData.scheme.subject}
                  </p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Session Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">📅 Session Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Session Name:</span>
                    <p className="font-medium text-gray-900">{viewSessionData.session.sessionName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Session Number:</span>
                    <p className="font-medium text-gray-900">{viewSessionData.session.sessionNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <p className="font-medium text-gray-900">
                      {viewSessionData.session.plannedDate
                        ? formatDate(viewSessionData.session.plannedDate)
                        : (viewSessionData.session.date ? formatDate(viewSessionData.session.date) : 'Not scheduled')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Period:</span>
                    <p className="font-medium text-gray-900">
                      {viewSessionData.session.plannedPeriod
                        ? `Period ${viewSessionData.session.plannedPeriod}`
                        : (viewSessionData.session.period ? `Period ${viewSessionData.session.period}` : 'N/A')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Learning Objectives */}
              {viewSessionData.session.learningObjectives && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">🎯 Learning Objectives</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.learningObjectives}</p>
                </div>
              )}

              {/* Teaching Methods */}
              {viewSessionData.session.teachingMethods && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">👨‍🏫 Teaching Methods</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.teachingMethods}</p>
                </div>
              )}

              {/* Learning Resources */}
              {viewSessionData.session.resourcesRequired && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2">📚 Learning Resources</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.resourcesRequired}</p>
                </div>
              )}

              {/* Assessment Methods */}
              {viewSessionData.session.assessmentMethods && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h3 className="font-semibold text-pink-900 mb-2">📝 Assessment Methods</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.assessmentMethods}</p>
                </div>
              )}

              {/* Activities */}
              {viewSessionData.session.activities && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="font-semibold text-indigo-900 mb-2">🎨 Activities</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.activities}</p>
                </div>
              )}

              {/* Homework */}
              {viewSessionData.session.homework && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-2">📖 Homework</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.homework}</p>
                </div>
              )}

              {/* Differentiation */}
              {viewSessionData.session.differentiation && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <h3 className="font-semibold text-teal-900 mb-2">🎭 Differentiation Strategies</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.differentiation}</p>
                </div>
              )}

              {/* ICT Integration */}
              {viewSessionData.session.ictIntegration && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <h3 className="font-semibold text-cyan-900 mb-2">💻 ICT Integration</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.ictIntegration}</p>
                </div>
              )}

              {/* Cross-curricular Links */}
              {viewSessionData.session.crossCurricularLinks && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                  <h3 className="font-semibold text-violet-900 mb-2">🔗 Cross-curricular Links</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.crossCurricularLinks}</p>
                </div>
              )}

              {/* Notes */}
              {viewSessionData.session.notes && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">📋 Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewSessionData.session.notes}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Bulk Preparation Modal Component
const BulkPreparationModal = ({ data, userEmail, userName, planningDateRange, onClose, onSuccess }) => {
  // Initialize session-specific data
  const [sessions, setSessions] = useState(
    Array.from({ length: data.sessionCount }, (_, idx) => ({
      sessionNumber: idx + 1,
      learningObjectives: '',
      teachingMethods: '',
      resourcesRequired: '',
      assessmentMethods: ''
    }))
  );
  const [currentSession, setCurrentSession] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [aiBulkLoading, setAiBulkLoading] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      // Use planningDateRange from backend, or fallback to today + 30 days
      const startDate = planningDateRange?.startDate || new Date().toISOString().split('T')[0];
      const endDate = planningDateRange?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log('🗓️ Bulk modal using date range:', { startDate, endDate, source: planningDateRange ? 'backend' : 'fallback' });
      
      const response = await api.getAvailablePeriodsForLessonPlan(
        userEmail,
        startDate,
        endDate,
        true,
        data.scheme.class,
        data.scheme.subject
      );

      const actualData = response?.data || response;
      if (actualData.success && actualData.availableSlots) {
        const available = actualData.availableSlots.filter(p => p.isAvailable);
        setPreview(available.slice(0, data.sessionCount));
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      alert('Failed to load period preview: ' + error.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  const updateSession = (field, value) => {
    const updated = [...sessions];
    updated[currentSession][field] = value;
    setSessions(updated);
  };

  const handleNext = () => {
    if (currentSession < sessions.length - 1) {
      setCurrentSession(currentSession + 1);
    }
  };

  const handlePrev = () => {
    if (currentSession > 0) {
      setCurrentSession(currentSession - 1);
    }
  };

  const canProceed = () => {
    const current = sessions[currentSession];
    return current.learningObjectives.trim() && current.teachingMethods.trim();
  };

  const allSessionsComplete = () => {
    return sessions.every(s => s.learningObjectives.trim() && s.teachingMethods.trim());
  };

  const handleSubmit = async () => {
    if (!allSessionsComplete()) {
      alert('Please fill in Learning Objectives and Teaching Methods for all sessions');
      return;
    }

    setSubmitting(true);
    try {
      const bulkData = {
        schemeId: data.scheme.schemeId,
        chapter: data.chapter.chapterName,
        sessionCount: data.sessionCount,
        teacherEmail: userEmail,
        teacherName: userName,
        sessionObjectives: sessions.map(s => s.learningObjectives),
        sessionMethods: sessions.map(s => s.teachingMethods),
        sessionResources: sessions.map(s => s.resourcesRequired),
        sessionAssessments: sessions.map(s => s.assessmentMethods),
        // For backward compatibility, send first session's data as defaults
        learningObjectives: sessions[0].learningObjectives,
        teachingMethods: sessions[0].teachingMethods,
        resourcesRequired: sessions[0].resourcesRequired,
        assessmentMethods: sessions[0].assessmentMethods
      };

      console.log('Submitting bulk lesson plans:', bulkData);
      const response = await api.createBulkSchemeLessonPlans(bulkData);

      const actualData = response?.data || response;
      if (actualData && actualData.success) {
        alert(`✅ Successfully created ${actualData.createdCount} lesson plans!`);
        onSuccess();
      } else {
        const errorMsg = actualData?.error || actualData?.message || 'Unknown error occurred';
        console.error('Bulk creation failed:', errorMsg);
        alert('Error: ' + errorMsg);
      }
    } catch (err) {
      console.error('Exception submitting bulk plans:', err);
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAIPrefillAll = async () => {
    try {
      setAiBulkLoading(true);
      const total = data.sessionCount;
      const contexts = Array.from({ length: total }, (_, i) => ({
        teacherEmail: userEmail,
        class: data.scheme.class,
        subject: data.scheme.subject,
        chapter: data.chapter.chapterName,
        session: i + 1,
        topic: data.scheme.content,
        totalSessions: total
      }));
      const results = await Promise.all(contexts.map(ctx => ai.suggestLessonPlan(ctx).catch(err => ({ success: false, error: err?.message }))));

      const filled = sessions.map((s, idx) => {
        const r = results[idx];
        const suggestion = r && r.success ? r.suggestion : null;
        const learningObjectives = suggestion && Array.isArray(suggestion.objectives) ? suggestion.objectives.join('\n') : s.learningObjectives;
        const teachingMethods = suggestion && Array.isArray(suggestion.activities) ? suggestion.activities.join('\n') : s.teachingMethods;
        const resourcesRequired = suggestion && Array.isArray(suggestion.materials) ? suggestion.materials.join('\n') : s.resourcesRequired;
        const assessmentMethods = suggestion && Array.isArray(suggestion.assessment) ? suggestion.assessment.join('\n') : s.assessmentMethods;
        return {
          ...s,
          learningObjectives,
          teachingMethods,
          resourcesRequired,
          assessmentMethods
        };
      });

      setSessions(filled);
      alert('✨ AI prefilled all sessions. Review and click Create All.');
    } catch (err) {
      console.error('[AI Prefill] Exception:', err);
      alert('AI prefill error: ' + err.message);
    } finally {
      setAiBulkLoading(false);
    }
  };

  const session = sessions[currentSession];
  const assignedPeriod = preview ? preview[currentSession] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {data.chapter.chapterName}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* AI Bulk Prefill (no save) */}
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
            <div className="text-sm text-purple-800">
              ✨ Prefill all {data.sessionCount} sessions into the four fields. Review, then submit.
            </div>
            <button
              onClick={handleAIPrefillAll}
              disabled={aiBulkLoading}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium shadow hover:shadow-md disabled:opacity-50"
            >
              {aiBulkLoading ? 'Prefilling…' : `AI Prefill All (${data.sessionCount})`}
            </button>
          </div>

          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Session {currentSession + 1} of {data.sessionCount}
              </span>
              <span className="text-xs text-gray-500">
                {sessions.filter(s => s.learningObjectives.trim() && s.teachingMethods.trim()).length}/{data.sessionCount} completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentSession + 1) / data.sessionCount) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{data.scheme.class} - {data.scheme.subject}</strong>
            </p>
          </div>

          {/* Assigned Period for Current Session */}
          {loadingPreview ? (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading available periods...</p>
            </div>
          ) : assignedPeriod ? (
            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2">📅 Assigned Period:</h4>
              <div className="text-sm">
                <div className="font-medium">{assignedPeriod.dayName}, {assignedPeriod.date}</div>
                <div className="text-gray-700">Period {assignedPeriod.period} ({assignedPeriod.startTime}-{assignedPeriod.endTime})</div>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">⚠️ Not enough available periods</p>
            </div>
          )}

          {/* Session Form */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Learning Objectives * <span className="text-xs text-gray-500">(Session {currentSession + 1})</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const query = `lesson plan learning objectives ${data.scheme.subject} class ${data.scheme.class} ${data.chapter.chapterName} session ${currentSession + 1}`.trim();
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Search for examples online"
                >
                  <Search className="w-3 h-3" />
                  Examples
                </button>
              </div>
              <textarea
                value={session.learningObjectives}
                onChange={(e) => updateSession('learningObjectives', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="What will students learn in this specific session?"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Teaching Methods * <span className="text-xs text-gray-500">(Session {currentSession + 1})</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const query = `teaching methods ${data.scheme.subject} class ${data.scheme.class} ${data.chapter.chapterName}`.trim();
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Search teaching strategies"
                >
                  <Search className="w-3 h-3" />
                  Methods
                </button>
              </div>
              <textarea
                value={session.teachingMethods}
                onChange={(e) => updateSession('teachingMethods', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="How will you teach this session?"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Resources Required <span className="text-xs text-gray-500">(Session {currentSession + 1})</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const query = `teaching resources materials ${data.scheme.subject} ${data.chapter.chapterName}`.trim();
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Find teaching resources"
                >
                  <Search className="w-3 h-3" />
                  Resources
                </button>
              </div>
              <textarea
                value={session.resourcesRequired}
                onChange={(e) => updateSession('resourcesRequired', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                placeholder="Materials, tools, or resources needed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Assessment Methods <span className="text-xs text-gray-500">(Session {currentSession + 1})</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const query = `assessment methods ${data.scheme.subject} class ${data.scheme.class}`.trim();
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Search assessment ideas"
                >
                  <Search className="w-3 h-3" />
                  Ideas
                </button>
              </div>
              <textarea
                value={session.assessmentMethods}
                onChange={(e) => updateSession('assessmentMethods', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                placeholder="How will you assess student learning?"
              />
            </div>
          </div>

          {/* Navigation & Submit */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>

            <div className="flex-1 flex gap-2">
              <button
                onClick={handlePrev}
                disabled={currentSession === 0}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              {currentSession < sessions.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !allSessionsComplete() || !preview}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    `Create All ${data.sessionCount} Plans`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  
  );
};

export default SchemeLessonPlanning;
