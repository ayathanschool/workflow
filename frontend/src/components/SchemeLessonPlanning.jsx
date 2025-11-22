import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, BookOpen, Users, Plus } from 'lucide-react';
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
  const [submitting, setSubmitting] = useState(false);
  const [showLessonPlanForm, setShowLessonPlanForm] = useState(false);
  const [planningDateRange, setPlanningDateRange] = useState(null);
  const [classFilter, setClassFilter] = useState('all'); // NEW: Class filter state
  const [lessonPlanData, setLessonPlanData] = useState({
    learningObjectives: '',
    teachingMethods: '',
    resourcesRequired: '',
    assessmentMethods: '',
    selectedDate: '',
    selectedPeriod: ''
  });

  useEffect(() => {
    loadApprovedSchemes();
  }, [userEmail]);

  const loadApprovedSchemes = async () => {
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
  };

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
      sessionName: session.sessionName
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
        session: selectedSession.session,
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

  const getStatusIcon = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();
    switch (normalizedStatus) {
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
            Lesson Plan Preparation
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setLoading(true);
                loadSchemes();
              }}
              disabled={loading}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <div className="flex items-center space-x-2">
              <label htmlFor="class-filter" className="text-sm font-medium text-gray-700">
                Filter by Class:
              </label>
              <select
                id="class-filter"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Classes</option>
                {[...new Set(schemes.map(s => s.class))].sort().map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              Schemes: {schemes.filter(s => classFilter === 'all' || s.class === classFilter).length} | 
              Total Sessions: {schemes.filter(s => classFilter === 'all' || s.class === classFilter).reduce((sum, s) => sum + s.totalSessions, 0)} |
              Planned: {schemes.filter(s => classFilter === 'all' || s.class === classFilter).reduce((sum, s) => sum + s.plannedSessions, 0)}
            </div>
          </div>
        </div>

        {schemes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No approved schemes found. Please ensure you have approved schemes before creating lesson plans.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {schemes.filter(scheme => classFilter === 'all' || scheme.class === classFilter).length === 0 ? (
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
              schemes
                .filter(scheme => classFilter === 'all' || scheme.class === classFilter)
                .map((scheme) => (
              <div key={scheme.schemeId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {scheme.class} - {scheme.subject}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {scheme.academicYear} | Term: {scheme.term}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Progress: {scheme.plannedSessions}/{scheme.totalSessions} sessions
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
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

                <div className="space-y-4">
                  {scheme.chapters.map((chapter) => (
                    <div key={`${scheme.schemeId}-${chapter.chapterNumber}`} className="border-l-4 border-blue-200 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800">
                          Chapter {chapter.chapterNumber}: {chapter.chapterName}
                        </h4>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {chapter.plannedSessions}/{chapter.totalSessions} planned
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {chapter.sessions.map((session) => (
                          <div
                            key={`${scheme.schemeId}-${chapter.chapterNumber}-${session.sessionNumber}`}
                            onClick={() => {
                              const normalizedStatus = String(session.status || '').toLowerCase();
                              if (!['cancelled', 'reported'].includes(normalizedStatus)) {
                                handleSessionClick(scheme, chapter, session);
                              }
                            }}
                            className={`p-3 rounded transition-colors ${
                              String(session.status || '').toLowerCase() === 'reported'
                                ? 'bg-purple-50 border-2 border-purple-300 opacity-90 cursor-default'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Create Lesson Plan: {selectedSession.chapter} - Session {selectedSession.session}
              </h3>
              <p className="text-sm text-gray-500">
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

            <div className="p-6 space-y-6">
              {/* Period Selection */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Select Teaching Period</h4>
                {loadingPeriods ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <span className="text-sm text-gray-500 mt-2">Loading available periods...</span>
                  </div>
                ) : availablePeriods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="font-medium">No available periods found</p>
                    <p className="text-sm mt-1">All your periods for the next 4 weeks are occupied or no timetable entries exist.</p>
                  </div>
                ) : availablePeriods.filter(p => p.isAvailable).length === 0 ? (
                  <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="font-medium">All periods are occupied</p>
                    <p className="text-sm mt-1">
                      Found {availablePeriods.length} periods, but all are already planned. 
                      <button onClick={() => setLoadingPeriods(true) || loadAvailablePeriods(selectedSession)} className="underline ml-1">
                        Refresh
                      </button>
                    </p>
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
                          className={`p-3 border rounded cursor-pointer transition-colors ${
                            lessonPlanData.selectedDate === period.date && lessonPlanData.selectedPeriod === period.period
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lessonPlanData.selectedDate && lessonPlanData.selectedPeriod && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    Selected: {formatDate(lessonPlanData.selectedDate)} Period {lessonPlanData.selectedPeriod}
                  </div>
                )}
              </div>

              {/* Lesson Plan Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Learning Objectives
                  </label>
                  <textarea
                    value={lessonPlanData.learningObjectives}
                    onChange={(e) => setLessonPlanData({...lessonPlanData, learningObjectives: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="What will students learn in this session?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teaching Methods
                  </label>
                  <textarea
                    value={lessonPlanData.teachingMethods}
                    onChange={(e) => setLessonPlanData({...lessonPlanData, teachingMethods: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="How will you teach this session?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resources Required
                  </label>
                  <textarea
                    value={lessonPlanData.resourcesRequired}
                    onChange={(e) => setLessonPlanData({...lessonPlanData, resourcesRequired: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="What materials, tools, or resources do you need?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assessment Methods
                  </label>
                  <textarea
                    value={lessonPlanData.assessmentMethods}
                    onChange={(e) => setLessonPlanData({...lessonPlanData, assessmentMethods: e.target.value})}
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
    </div>
  );
};

export default SchemeLessonPlanning;