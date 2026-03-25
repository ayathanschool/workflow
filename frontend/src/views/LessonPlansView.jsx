import React, { useState, useEffect, useCallback } from 'react';
import { Download, Eye, Trash2 } from 'lucide-react';
import * as api from '../api';
import { periodToTimeString, todayIST } from '../utils/dateUtils';

const appNormalize = (s) => (s || '').toString().trim().toLowerCase();

const LessonPlansView = ({ user, currentUser, withSubmit, success, error, warning, openLessonView, stripStdPrefix, memoizedSettings }) => {
    const [loading, setLoading] = useState(true);
    const [lessonPlans, setLessonPlans] = useState([]);
    const [approvedSchemes, setApprovedSchemes] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showPreparationForm, setShowPreparationForm] = useState(false);
    const [deletingPlan, setDeletingPlan] = useState(null);
    const [preparationData, setPreparationData] = useState({
      schemeId: '',
      session: '1',
      objectives: '',
      activities: '',
      notes: ''
    });
    // Grouping toggles (mutually exclusive)
    const [groupByClass, setGroupByClass] = useState(false);
    const [groupByChapter, setGroupByChapter] = useState(false);
    const [groupByClassChapter, setGroupByClassChapter] = useState(false);
    
    // Filter states for lesson plans
    const [lessonPlanFilters, setLessonPlanFilters] = useState({
      class: '',
      subject: '',
      status: '',
      chapter: ''
    });

    // Handle delete lesson plan
    const handleDeleteLessonPlan = async (plan) => {
      if (!window.confirm(`Delete lesson plan for "${plan.chapter}" Session ${plan.session}? This cannot be undone.`)) {
        return;
      }

      setDeletingPlan(plan.lpId);
      try {
        const result = await api.deleteLessonPlan(plan.lpId, user.email);
        if (result.success) {
          success('Deleted', 'Lesson plan deleted successfully');
          // Refresh the list
          const plans = await api.getTeacherLessonPlans(user.email);
          setLessonPlans(Array.isArray(plans) ? plans : []);
        } else {
          error('Delete Failed', result.error || 'Failed to delete lesson plan');
        }
      } catch (err) {
        console.error('Failed to delete lesson plan:', err);
        error('Delete Failed', err.message || 'Failed to delete lesson plan');
      } finally {
        setDeletingPlan(null);
      }
    };

    // App settings for lesson plan preparation (using parent memoizedSettings)
    // No planning restrictions - teachers can plan anytime

    // Fetch real timetable slots, lesson plans, approved schemes, and app settings from the API
    useEffect(() => {
      async function fetchData() {
        setLoading(true);
        try {
          if (!user) return;
          const [plansResult, schemesResult] = await Promise.allSettled([
            api.getTeacherLessonPlans(user.email),
            api.getTeacherSchemes(user.email)
          ]);

          if (plansResult.status === 'fulfilled') {
            const plans = plansResult.value;
            setLessonPlans(Array.isArray(plans) ? plans : []);
          } else {
            console.warn('Error loading lesson plans:', plansResult.reason);
            setLessonPlans([]);
          }

          if (schemesResult.status === 'fulfilled') {
            const teacherSchemes = schemesResult.value;
            const approved = Array.isArray(teacherSchemes)
              ? teacherSchemes.filter(s => String(s.status || '').toLowerCase() === 'approved')
              : [];
            setApprovedSchemes(approved);
          } else {
            console.warn('Error loading approved schemes:', schemesResult.reason);
            setApprovedSchemes([]);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    }, [user]);

    // Helper to force-refresh lesson plans when status updates elsewhere (e.g., HM approvals)
    const refreshTeacherLessonPlans = useCallback(async () => {
      if (!user) return;
      try {
        api.clearCache('getTeacherLessonPlans');
        const fresh = await api.getTeacherLessonPlans(user.email);
        setLessonPlans(Array.isArray(fresh) ? fresh : []);
      } catch (e) {
        console.warn('Refresh lesson plans failed:', e);
      }
    }, [user]);

    // Listen for global lesson plan status update events
    useEffect(() => {
      const handler = (e) => {
        // Optionally inspect e.detail.lpId/e.detail.status
        refreshTeacherLessonPlans();
      };
      window.addEventListener('lesson-plan-status-updated', handler);
      return () => window.removeEventListener('lesson-plan-status-updated', handler);
    }, [refreshTeacherLessonPlans]);

    const handlePrepareLesson = (slot) => {
      // Find existing lesson plan for this class, subject, and date
      const existingPlan = lessonPlans.find(
        plan => appNormalize(plan.class) === appNormalize(slot.class) &&
                appNormalize(plan.subject) === appNormalize(slot.subject) &&
                String(plan.date || '') === String(slot.date || '')
      );
      
      setSelectedSlot(slot);
      setShowPreparationForm(true);
      
      // Filter relevant schemes outside the if/else to make it available for both paths
      const relevantSchemes = approvedSchemes.filter(
        scheme => appNormalize(scheme.class) === appNormalize(slot.class) && appNormalize(scheme.subject) === appNormalize(slot.subject)
      );
      
      if (existingPlan) {
        setPreparationData({
          schemeId: existingPlan.schemeId || '',
          session: String(existingPlan.session || '1'),
          objectives: existingPlan.objectives || '',
          activities: existingPlan.activities || '',
          notes: existingPlan.notes || ''
        });
      } else {
        const defaultSchemeId = relevantSchemes.length > 0 ? relevantSchemes[0].schemeId : '';
        
        // Calculate next session number for the selected scheme's chapter
        let nextSessionNumber = 1;
        if (defaultSchemeId && lessonPlans.length > 0) {
          // Find existing lesson plans for this scheme to determine next session
          const existingSessionsForScheme = lessonPlans
            .filter(lp => lp.schemeId === defaultSchemeId)
            .map(lp => Number(lp.session || 0))
            .filter(session => session > 0);
          
          if (existingSessionsForScheme.length > 0) {
            nextSessionNumber = Math.max(...existingSessionsForScheme) + 1;
          }
        }
        
        setPreparationData({
          schemeId: defaultSchemeId,
          // Use sequential session number for the chapter, not timetable period
          session: String(nextSessionNumber), 
          objectives: '',
          activities: '',
          notes: ''
        });
      }
      // Pre-filled data ready for form
    };

    const handleSchemeChange = (schemeId) => {
      const scheme = approvedSchemes.find(s => s.schemeId === schemeId);
      
      if (scheme) {
        // Calculate next session number for the selected scheme's chapter
        let nextSessionNumber = 1;
        if (lessonPlans.length > 0) {
          // Find existing lesson plans for this scheme to determine next session
          const existingSessionsForScheme = lessonPlans
            .filter(lp => lp.schemeId === schemeId)
            .map(lp => Number(lp.session || 0))
            .filter(session => session > 0);
          
          if (existingSessionsForScheme.length > 0) {
            nextSessionNumber = Math.max(...existingSessionsForScheme) + 1;
          }
        }
        
        // Use sequential session number for the chapter, not timetable period
        setPreparationData(prev => ({
          ...prev,
          schemeId: schemeId,
          session: String(nextSessionNumber)
        }));
      } else {
        setPreparationData(prev => ({ ...prev, schemeId: schemeId }));
      }
    };

    // When the session changes, update preparation data and pre-fill
    // objectives/activities if an existing lesson plan exists for the
    // selected class/subject/session.
    const handleSessionChange = (sess) => {
      if (!selectedSlot) return;
      // Check if there is an existing plan for the selected session
      const existingPlan = lessonPlans.find(
        plan => appNormalize(plan.class) === appNormalize(selectedSlot.class) && 
                appNormalize(plan.subject) === appNormalize(selectedSlot.subject) && 
                Number(plan.session) === Number(sess) &&
                String(plan.date || '') === String(selectedSlot.date || '')
      );
      if (existingPlan) {
        setPreparationData(prev => ({
          ...prev,
          session: String(sess),
          objectives: existingPlan.objectives || '',
          activities: existingPlan.activities || ''
        }));
      } else {
        setPreparationData(prev => ({
          ...prev,
          session: String(sess),
          objectives: '',
          activities: ''
        }));
      }
    };

    const handleSubmitPreparation = async (e) => {
      e.preventDefault();
      if (!selectedSlot) return;
      
      // Get the selected scheme to access its chapter
      const selectedScheme = approvedSchemes.find(s => s.schemeId === preparationData.schemeId);
      const selectedChapter = selectedScheme?.chapter || '';
      
  // Enhanced duplicate prevention
  // Prevent duplicates based on class/subject/session/date/chapter combination
      // Allow editing existing lesson plans (when lpId matches)
      if (!selectedSlot.lpId) {
        const normalizedClass = appNormalize(selectedSlot.class);
        const normalizedSubject = appNormalize(selectedSlot.subject);
        // Use only the session number from the scheme, not timetable period
        const sessionNumber = Number(preparationData.session || 1);
        
        const duplicate = lessonPlans.find(lp => {
          // Get the chapter for the plan's scheme
          const planScheme = approvedSchemes.find(s => s.schemeId === lp.schemeId);
          const planChapter = planScheme?.chapter || '';
          
          return (
            appNormalize(lp.class) === normalizedClass &&
            appNormalize(lp.subject) === normalizedSubject &&
            Number(lp.session) === sessionNumber &&
            String(lp.date || '') === String(selectedSlot.date || '') &&
            // Check if the chapters match (strict duplicate check)
            planChapter === selectedChapter
          );
        });
        
        if (duplicate) {
          error('Duplicate Detected', 'A lesson plan already exists for this class/subject/session/date/chapter combination. Duplicate not allowed.');
          return;
        }
      }
      try {
        // Use withSubmit so the overlay/toast appears during submission
        await withSubmit('Submitting lesson plan...', async () => {
          const res = await api.submitLessonPlanDetails(selectedSlot.lpId, {
            class: selectedSlot.class,
            subject: selectedSlot.subject,
            session: Number(preparationData.session || 1), // Use scheme session number, not timetable period
            date: selectedSlot.date,
            schemeId: preparationData.schemeId,
            objectives: preparationData.objectives,
            activities: preparationData.activities,
            notes: preparationData.notes,
            teacherEmail: currentUser?.email || '',
            teacherName: currentUser?.name || ''
          });
          
          // Unwrap the response (backend wraps in {status, data, timestamp})
          const result = res.data || res;
          
          // If server responded with an error payload, throw to trigger error handling
          if (result && result.error) throw new Error(result.error);
          return result;
        });
        // Refresh lesson plans list from backend
        if (user) {
          const updatedPlans = await api.getTeacherLessonPlans(user.email);
          setLessonPlans(Array.isArray(updatedPlans) ? updatedPlans : []);
        }
        // On success, close the form
        setShowPreparationForm(false);
        setSelectedSlot(null);
        setPreparationData({ schemeId: '', session: '1', objectives: '', activities: '', notes: '' });
      } catch (err) {
        console.error('Error submitting lesson plan details:', err);
  // If duplicate detected (server returned a duplicate error), refresh plans and open the existing plan for editing
  if (String(err.message || '').toLowerCase().indexOf('duplicate') !== -1) {
          try {
            if (user) {
              const updatedPlans = await api.getTeacherLessonPlans(user.email);
              setLessonPlans(Array.isArray(updatedPlans) ? updatedPlans : []);
              const normalizedClass = (selectedSlot.class || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
              const normalizedSubject = (selectedSlot.subject || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
              const sessNum = Number(preparationData.session || 1); // Use scheme session number, not timetable period
              const dup = (updatedPlans || []).find(p => {
                return (p.class || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === normalizedClass &&
                       (p.subject || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === normalizedSubject &&
                       Number(p.session) === sessNum;
              });
              if (dup) {
                // Open editor for existing plan
                setSelectedSlot({
                  class: dup.class,
                  subject: dup.subject,
                  period: dup.session,
                  date: todayIST(),
                  day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                  lpId: dup.lpId
                });
                setPreparationData(prev => ({
                  ...prev,
                  schemeId: preparationData.schemeId || '',
                  session: String(dup.session || '1'),
                  objectives: dup.objectives || '',
                  activities: dup.activities || '',
                  notes: ''
                }));
                setShowPreparationForm(true);
                warning('Duplicate Plan', 'Duplicate detected: opened existing lesson plan for editing.');
                return;
              }
            }
          } catch (e) {
            console.warn('Failed to recover from duplicate error:', e);
          }
        }
        // For other errors, close the form to avoid leaving stale state
        setShowPreparationForm(false);
        setSelectedSlot(null);
        setPreparationData({ schemeId: '', session: '1', objectives: '', activities: '', notes: '' });
      }
    };

    return (
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading lesson plans...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
              <div className="flex space-x-3">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

        {showPreparationForm && selectedSlot && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              Prepare Lesson Plan for {selectedSlot.class} - {selectedSlot.subject}
            </h2>
            <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Date:</strong> {selectedSlot.date} ({selectedSlot.day})
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Period {selectedSlot.period}:</strong> {periodToTimeString(selectedSlot.period, memoizedSettings.periodTimes)}
                </p>
              </div>
            </div>
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This lesson plan applies only to this specific period. You'll need to create separate lesson plans for other periods of the same class.
              </p>
            </div>
            <form onSubmit={handleSubmitPreparation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approved Scheme of Work
                </label>
                <select
                  value={preparationData.schemeId}
                  onChange={(e) => handleSchemeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Approved Scheme</option>
                  {approvedSchemes
                    .filter(scheme => appNormalize(scheme.class) === appNormalize(selectedSlot.class) && appNormalize(scheme.subject) === appNormalize(selectedSlot.subject))
                    .map(scheme => (
                      <option key={scheme.schemeId} value={scheme.schemeId}>
                        {scheme.chapter} - {scheme.month} ({scheme.noOfSessions} sessions)
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select from approved schemes for this class and subject
                </p>
              </div>

              {/* Session dropdown based on selected scheme's number of sessions + extensions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session
                </label>
                <select
                  value={preparationData.session}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  {(() => {
                    const scheme = approvedSchemes.find(s => s.schemeId === preparationData.schemeId);
                    const originalMax = scheme ? Number(scheme.noOfSessions || 1) : 1;
                    
                    // Calculate extended max: include existing sessions + 1 for continuation
                    let extendedMax = originalMax;
                    if (scheme && lessonPlans.length > 0) {
                      const existingSessionsForScheme = lessonPlans
                        .filter(lp => lp.schemeId === scheme.schemeId)
                        .map(lp => Number(lp.session || 0))
                        .filter(session => session > 0);
                      
                      if (existingSessionsForScheme.length > 0) {
                        const maxExisting = Math.max(...existingSessionsForScheme);
                        extendedMax = Math.max(originalMax, maxExisting + 1);
                      }
                    }
                    
                    const options = [];
                    for (let i = 1; i <= extendedMax; i++) {
                      const isExtended = i > originalMax;
                      options.push(
                        <option key={i} value={String(i)}>
                          Session {i} - {scheme ? scheme.chapter : ''}{isExtended ? ' (Extended)' : ''}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Sessions beyond the original plan are marked as extended
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Learning Objectives</label>
                <textarea
                  value={preparationData.objectives}
                  onChange={(e) => setPreparationData(prev => ({...prev, objectives: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  placeholder="What students should learn..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activities/Methods</label>
                <textarea
                  value={preparationData.activities}
                  onChange={(e) => setPreparationData(prev => ({...prev, activities: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="4"
                  placeholder="Teaching methods, activities, resources..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={preparationData.notes}
                  onChange={(e) => setPreparationData(prev => ({...prev, notes: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="2"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreparationForm(false);
                    setSelectedSlot(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Submitted Lesson Plans Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Your Submitted Lesson Plans</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage all your submitted lesson plans</p>
            
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
                <select
                  value={lessonPlanFilters.class}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, class: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Classes</option>
                  {[...new Set(lessonPlans.map(plan => plan.class))].sort().map(cls => (
                    <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <select
                  value={lessonPlanFilters.subject}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, subject: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Subjects</option>
                  {[...new Set(lessonPlans.map(plan => plan.subject))].sort().map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={lessonPlanFilters.status}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, status: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  {[...new Set(lessonPlans.map(plan => plan.status))].sort().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chapter</label>
                <select
                  value={lessonPlanFilters.chapter}
                  onChange={(e) => setLessonPlanFilters({...lessonPlanFilters, chapter: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Chapters</option>
                  {[...new Set(lessonPlans.map(plan => plan.chapter).filter(Boolean))].sort().map(chapter => (
                    <option key={chapter} value={chapter}>{chapter}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setLessonPlanFilters({ class: '', subject: '', status: '', chapter: '' })}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Clear Filters
                </button>
              </div>
              <div className="flex items-end gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => { setGroupByClass(v => { const next = !v; if (next) setGroupByChapter(false); return next; }); }}
                  className={`px-3 py-2 text-sm rounded-md border ${groupByClass ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                  title="Group by Class"
                >
                  Group by Class
                </button>
                <button
                  type="button"
                  onClick={() => { setGroupByChapter(v => { const next = !v; if (next) setGroupByClass(false); return next; }); }}
                  className={`px-3 py-2 text-sm rounded-md border ${groupByChapter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                  title="Group by Chapter"
                >
                  Group by Chapter
                </button>
              </div>
            </div>
          </div>
          {(() => {
            const filtered = lessonPlans.filter(plan => (
              (!lessonPlanFilters.class || plan.class === lessonPlanFilters.class) &&
              (!lessonPlanFilters.subject || plan.subject === lessonPlanFilters.subject) &&
              (!lessonPlanFilters.status || plan.status === lessonPlanFilters.status) &&
              (!lessonPlanFilters.chapter || plan.chapter === lessonPlanFilters.chapter)
            ));

            if (groupByClass || groupByChapter) {
              const keyFn = (p) => groupByClass ? (p.class || 'Unknown Class') : (p.chapter || 'Unknown Chapter');
              const groups = {};
              for (const p of filtered) {
                const k = keyFn(p);
                if (!groups[k]) groups[k] = [];
                groups[k].push(p);
              }
              const sortedKeys = Object.keys(groups).sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
              return (
                <div className="px-6 py-4 space-y-6">
                  {sortedKeys.map(key => {
                    const items = groups[key].slice().sort((a,b)=> {
                      // sort by subject then session
                      const s = (a.subject||'').localeCompare(b.subject||'');
                      if (s !== 0) return s;
                      return Number(a.session||0) - Number(b.session||0);
                    });
                    return (
                      <div key={key} className="border rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                          <div className="font-semibold text-gray-900">
                            {groupByClass ? `Class: ${key}` : `Chapter: ${key}`}
                          </div>
                          <div className="text-xs text-gray-600">{items.length} plan(s)</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                {!groupByClass && (<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>)}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                {!groupByChapter && (<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>)}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {items.map(plan => (
                                <tr key={plan.lpId}>
                                  {!groupByClass && (<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.class}</td>)}
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.subject}</td>
                                  {!groupByChapter && (<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.chapter || 'N/A'}</td>)}
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{plan.session}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      plan.status === 'Pending Preparation' 
                                        ? 'bg-yellow-100 text-yellow-800' 
                                        : plan.status === 'Pending Review' 
                                          ? 'bg-blue-100 text-blue-800'
                                          : plan.status === 'Ready'
                                            ? 'bg-green-100 text-green-800'
                                            : plan.status === 'Needs Rework'
                                              ? 'bg-orange-100 text-orange-800'
                                              : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {plan.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    <button
                                      onClick={() => handlePrepareLesson({
                                        class: plan.class,
                                        subject: plan.subject,
                                        period: plan.session,
                                        date: todayIST(),
                                        day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                        lpId: plan.lpId
                                      })}
                                      className={`${
                                        plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                          ? 'bg-gray-300 cursor-not-allowed'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      } text-white px-3 py-1 rounded text-sm mr-2`}
                                      disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                                    >
                                      Edit
                                    </button>
                                    <button type="button" className="text-blue-600 hover:text-blue-900 mr-2" onClick={() => openLessonView(plan)} title="View lesson plan">
                                      <Eye className="h-4 w-4 inline" />
                                    </button>
                                    {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                                      <button
                                        onClick={() => handleDeleteLessonPlan(plan)}
                                        disabled={deletingPlan === plan.lpId}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                        title="Delete lesson plan"
                                      >
                                        {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4 inline" />}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Default flat table view
            return (
              <>
                {/* Mobile Card Layout */}
                <div className="block md:hidden">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No lesson plans found.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.map((plan) => (
                        <div key={plan.lpId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{stripStdPrefix(plan.class)} - {plan.subject}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{plan.chapter || 'N/A'}</div>
                            </div>
                            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              plan.status === 'Pending Preparation' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                : plan.status === 'Pending Review' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : plan.status === 'Ready'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : plan.status === 'Needs Rework'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {plan.status}
                            </span>
                          </div>
                          
                          <div className="text-sm mb-3">
                            <span className="text-gray-500 dark:text-gray-400">Session:</span>
                            <span className="ml-1 text-gray-900 dark:text-gray-100">{plan.session}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePrepareLesson({
                                class: plan.class,
                                subject: plan.subject,
                                period: plan.session,
                                date: todayIST(),
                                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                lpId: plan.lpId
                              })}
                              className={`flex-1 ${
                                plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              } text-white px-3 py-2 rounded-lg text-sm font-medium`}
                              disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openLessonView(plan)}
                              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg"
                              title="View lesson plan"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                              <button
                                onClick={() => handleDeleteLessonPlan(plan)}
                                disabled={deletingPlan === plan.lpId}
                                className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
                                title="Delete lesson plan"
                              >
                                {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Chapter</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Session</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.map((plan) => (
                        <tr key={plan.lpId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(plan.class)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.subject}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.chapter || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{plan.session}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              plan.status === 'Pending Preparation' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                : plan.status === 'Pending Review' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : plan.status === 'Ready'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : plan.status === 'Needs Rework'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {plan.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <button
                              onClick={() => handlePrepareLesson({
                                class: plan.class,
                                subject: plan.subject,
                                period: plan.session,
                                date: todayIST(),
                                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                                lpId: plan.lpId
                              })}
                              className={`${
                                plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'
                                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              } text-white px-3 py-1 rounded text-sm mr-2`}
                              disabled={plan.status !== 'Pending Preparation' && plan.status !== 'Needs Rework'}
                            >
                              Edit
                            </button>
                            <button type="button" className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-2" onClick={() => openLessonView(plan)} title="View lesson plan">
                              <Eye className="h-4 w-4 inline" />
                            </button>
                            {(plan.status === 'Pending Preparation' || plan.status === 'Pending Review' || plan.status === 'Needs Rework') && (
                              <button
                                onClick={() => handleDeleteLessonPlan(plan)}
                                disabled={deletingPlan === plan.lpId}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                                title="Delete lesson plan"
                              >
                                {deletingPlan === plan.lpId ? '...' : <Trash2 className="h-4 w-4 inline" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                          {lessonPlans.length === 0 ? 'No lesson plans submitted yet.' : 'No lesson plans match the selected filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )
          })()}
        </div>
          </>
        )}
      </div>
    );
};

export default LessonPlansView;
