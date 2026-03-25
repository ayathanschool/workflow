import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, CheckCircle, AlertCircle, Eye, Trash2 } from 'lucide-react';
import * as api from '../api';

const SchemesView = ({ user, currentUser, setSubmitting, success, error, warning, info, openLessonView, stripStdPrefix }) => {
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [deletingScheme, setDeletingScheme] = useState(null);
    const [formData, setFormData] = useState({
      class: '',
      subject: '',
      term: '',
      unit: '',
      chapter: '',
      month: '',
      noOfSessions: ''
    });
    const [planningHelper, setPlanningHelper] = useState(null);
    const [loadingHelper, setLoadingHelper] = useState(false);
    const [schemeGateCheck, setSchemeGateCheck] = useState(null); // null | { allowed, message }
    
    // Filter states for submitted schemes
    const [schemeFilters, setSchemeFilters] = useState({
      class: 'all',
      term: 'all'
    });
    
    // Filtered schemes based on selected filters
    const filteredSchemes = useMemo(() => {
      return schemes.filter(scheme => {
        const classMatch = schemeFilters.class === 'all' || scheme.class === schemeFilters.class;
        const termMatch = schemeFilters.term === 'all' || scheme.term === schemeFilters.term;
        return classMatch && termMatch;
      });
    }, [schemes, schemeFilters]);
    
    // Get unique classes and terms from schemes
    const availableClasses = useMemo(() => {
      return [...new Set(schemes.map(s => s.class))].filter(Boolean).sort();
    }, [schemes]);
    
    const availableTerms = useMemo(() => {
      return [...new Set(schemes.map(s => s.term))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    }, [schemes]);

    // Handle delete scheme
    const handleDeleteScheme = async (scheme) => {
      if (!window.confirm(`Delete scheme "${scheme.chapter}"? This cannot be undone.`)) {
        return;
      }

      setDeletingScheme(scheme.schemeId);
      try {
        const result = await api.deleteScheme(scheme.schemeId, user.email);
        if (result.success) {
          success('Deleted', 'Scheme deleted successfully');
          // Refresh the list
          const list = await api.getTeacherSchemes(user.email);
          const sorted = Array.isArray(list) ? list.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          }) : [];
          setSchemes(sorted);
        } else {
          error('Delete Failed', result.error || 'Failed to delete scheme');
        }
      } catch (err) {
        console.error('Failed to delete scheme:', err);
        error('Delete Failed', err.message || 'Failed to delete scheme');
      } finally {
        setDeletingScheme(null);
      }
    };

    // Cancel form
    const cancelForm = () => {
      setShowForm(false);
      setFormData({
        class: '',
        subject: '',
        term: '',
        unit: '',
        chapter: '',
        month: '',
        noOfSessions: ''
      });
    };

    // Load planning helper when class, subject, and term are selected
    useEffect(() => {
      const loadPlanningHelper = async () => {
        if (formData.class && formData.subject && formData.term && currentUser?.email) {
          try {
            setLoadingHelper(true);
            const termStr = `Term ${formData.term}`;
            const response = await api.getSchemeSubmissionHelper(
              currentUser.email,
              formData.class,
              formData.subject,
              termStr
            );
            const data = response.data || response;
            if (data.success) {
              setPlanningHelper(data);
            } else {
              console.log('Planning helper not available:', data.error);
              setPlanningHelper(null);
            }
          } catch (err) {
            console.error('Error loading planning helper:', err);
            setPlanningHelper(null);
          } finally {
            setLoadingHelper(false);
          }
        } else {
          setPlanningHelper(null);
        }
      };
      loadPlanningHelper();
    }, [formData.class, formData.subject, formData.term, currentUser?.email]);

    // Check if teacher can submit a new scheme whenever class+subject change
    useEffect(() => {

      if (!formData.class || !formData.subject || !currentUser?.email) { setSchemeGateCheck(null); return; }
      let cancelled = false;
      api.checkCanSubmitScheme(currentUser.email, formData.class, formData.subject)
        .then(result => { if (!cancelled) setSchemeGateCheck(result); })
        .catch(() => { if (!cancelled) setSchemeGateCheck(null); });
      return () => { cancelled = true; };
    }, [formData.class, formData.subject, currentUser?.email]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!user) return;
      
      let shouldCloseForm = true;

      try {
        setSubmitting({ active: true, message: 'Submitting scheme...' });

        // GATE: block new scheme if previous is incomplete
        if (schemeGateCheck && !schemeGateCheck.allowed) {
          throw new Error(schemeGateCheck.message || 'Complete the previous chapter before submitting a new scheme.');
        }
        
        // Submit the scheme with timetable validation
        const schemeData = {
          teacherName: user.name || '',
          class: stripStdPrefix(formData.class),
          subject: formData.subject,
          term: formData.term,
          unit: formData.unit,
          chapter: formData.chapter,
          month: formData.month,
          noOfSessions: formData.noOfSessions
        };
        
        // Submit new scheme
        const response = await api.submitPlan(user.email, schemeData);
        const result = response?.data || response; // Unwrap {status,data,timestamp}
        
        // Check if validation failed
        if (result && !result.ok && result.error === 'Session count mismatch') {
          const validation = result.validation;
          
          let confirmMessage = `${validation.message}\n\n`;
          
          if (validation.timetableDetails && validation.timetableDetails.length > 0) {
            confirmMessage += `Your allocated periods:\n`;
            confirmMessage += validation.timetableDetails.map(d => `• ${d.day} Period ${d.period}`).join('\n');
            confirmMessage += `\n\n`;
          }
          
          confirmMessage += `You requested ${validation.requestedSessions} sessions but have ${validation.actualPeriodsPerWeek} periods allocated.\n\n`;
          
          if (validation.noTimetableFound) {
            confirmMessage += `No timetable found for ${formData.class} ${formData.subject}.\nPlease contact administration to verify timetable setup.\n\n`;
            confirmMessage += `Click OK to submit anyway, or Cancel to review.`;
          } else {
            confirmMessage += `Options:\n`;
            confirmMessage += `• Click OK to change sessions to ${validation.suggestion} (recommended)\n`;
            confirmMessage += `• Click Cancel to submit anyway (requires HM approval)`;
          }
          
          const userChoice = confirm(confirmMessage);
          
          if (userChoice && !validation.noTimetableFound) {
            // Update form with recommended sessions
            setFormData(prev => ({
              ...prev,
              noOfSessions: validation.suggestion
            }));
            info('Timetable Adjustment', `Sessions updated to ${validation.suggestion} to match your timetable.`);
            shouldCloseForm = false;
            return;
          } else if (!userChoice || validation.noTimetableFound) {
            // Force submit with override
            const overrideData = {
              ...schemeData,
              forceSubmit: true,
              validationWarning: validation.message
            };
            
            const overrideResponse = await api.submitPlan(user.email, overrideData);
            const overrideResult = overrideResponse?.data || overrideResponse;
            if (!overrideResult?.ok) {
              throw new Error(overrideResult?.error || 'Override submission failed');
            }
            warning('Override Required', 'Scheme submitted with timetable override. HM review required.');
          }
        } else if (result?.ok) {
          // Success - normal submission
          const message = result.validation?.message || 'Scheme submitted successfully!';
          success('Scheme Submitted', message);
        } else if (result?.blocked) {
          // Blocked by previous scheme gate - show detailed error from backend
          const errorMessage = result?.message || result?.error || 'Cannot submit new scheme. Complete the previous chapter first.';
          throw new Error(errorMessage);
        } else if (!result?.ok) {
          // Any other submission failure
          throw new Error(result?.error || result?.message || 'Scheme submission failed');
        }
        
        // Refresh schemes list
        const list = await api.getTeacherSchemes(user.email);
        const sorted = Array.isArray(list) ? list.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        }) : [];
        setSchemes(sorted);
        
      } catch (err) {
        console.error('Failed to submit scheme:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          response: err.response
        });
        error('Submission Failed', `Failed to submit scheme: ${err.message}`);
      } finally {
        setSubmitting({ active: false, message: '' });
        if (shouldCloseForm) {
          setShowForm(false);
          setFormData({
            class: '',
            subject: '',
            term: '',
            unit: '',
            chapter: '',
            month: '',
            noOfSessions: ''
          });
        }
      }
    };

    // Load all schemes for this teacher from the API on mount.  We use
    // getTeacherSchemes() so teachers can see the status of previously
    // submitted schemes (Pending, Approved, Rejected).
    useEffect(() => {
      async function fetchSchemes() {
        try {
          if (!user) return;
          setLoading(true);
          const list = await api.getTeacherSchemes(user.email);
          // Sort by createdAt descending (latest first)
          const sorted = Array.isArray(list) ? list.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA; // Descending order
          }) : [];
          setSchemes(sorted);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      fetchSchemes();
    }, [user]);

    return (
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading schemes...</p>
          </div>
        ) : (
          <>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Schemes of Work</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Scheme
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Submit New Scheme of Work</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Previous scheme gate warning */}
            {schemeGateCheck && !schemeGateCheck.allowed && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 font-bold text-lg leading-none mt-0.5">⛔</span>
                  <div>
                    <p className="font-semibold text-red-700 text-sm mb-1">Cannot submit new scheme</p>
                    <p className="text-red-600 text-sm whitespace-pre-line">{schemeGateCheck.message}</p>
                    <p className="text-red-500 text-xs mt-2">Please complete the daily report for the last session and mark it "Chapter Complete" before submitting a new scheme.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Planning Assistant Panel */}
            {planningHelper && planningHelper.success && (
              <div className={`mb-6 p-4 rounded-lg border-2 ${
                planningHelper.feasibility.riskLevel === 'LOW' ? 'bg-green-50 border-green-300' :
                planningHelper.feasibility.riskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-300' :
                'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {planningHelper.feasibility.riskLevel === 'LOW' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : planningHelper.feasibility.riskLevel === 'MEDIUM' ? (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">📊 Planning Assistant</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Available Periods</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {planningHelper.timetableInfo.usablePeriods}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.timetableInfo.periodsPerWeek} per week
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Required Sessions</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {planningHelper.syllabusRequirement.minSessionsRequired}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.syllabusRequirement.totalChapters} chapters
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Capacity</div>
                        <div className={`text-2xl font-bold ${
                          planningHelper.feasibility.riskLevel === 'LOW' ? 'text-green-600' :
                          planningHelper.feasibility.riskLevel === 'MEDIUM' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {planningHelper.feasibility.capacityUtilization}
                        </div>
                        <div className="text-xs text-gray-500">
                          {planningHelper.feasibility.riskLevel} Risk
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-md mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">💡 Recommendation</div>
                      <div className="text-sm text-gray-600">{planningHelper.feasibility.recommendation}</div>
                    </div>
                    
                    {planningHelper.upcomingEvents && planningHelper.upcomingEvents.length > 0 && (
                      <div className="bg-white p-3 rounded-md mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">📅 Upcoming Events</div>
                        {planningHelper.upcomingEvents.map((event, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            • {event.name} ({event.date}) - {event.periodsLost} period(s) lost
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {planningHelper.warnings && planningHelper.warnings.length > 0 && (
                      <div className="bg-yellow-100 p-3 rounded-md">
                        <div className="text-sm font-medium text-yellow-800 mb-2">⚠️ Important Notices</div>
                        {planningHelper.warnings.map((w, idx) => (
                          <div key={idx} className="text-sm text-yellow-700">{w}</div>
                        ))}
                      </div>
                    )}
                    
                    {planningHelper.syllabusRequirement.chapterDetails && planningHelper.syllabusRequirement.chapterDetails.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                          View Chapter Breakdown ({planningHelper.syllabusRequirement.totalChapters} chapters)
                        </summary>
                        <div className="mt-2 bg-white p-3 rounded-md max-h-48 overflow-y-auto">
                          {planningHelper.syllabusRequirement.chapterDetails.map((ch, idx) => (
                            <div key={idx} className="text-sm text-gray-600 py-1 border-b border-gray-100 last:border-0">
                              <span className="font-medium">Ch {ch.chapterNo}: {ch.chapterName}</span>
                              <span className="text-blue-600 ml-2">({ch.minSessions} sessions)</span>
                              {ch.topics && <div className="text-xs text-gray-500 mt-1">{ch.topics}</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {loadingHelper && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-blue-700">Loading planning context...</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mobile-stack">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({...formData, class: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Class</option>
                  {user?.classes?.map(cls => (
                    <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Subject</option>
                  {user?.subjects?.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={formData.term}
                  onChange={(e) => setFormData({...formData, term: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Term</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="number"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
                <input
                  type="text"
                  value={formData.chapter}
                  onChange={(e) => setFormData({...formData, chapter: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({...formData, month: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. of Sessions</label>
                <input
                  type="number"
                  value={formData.noOfSessions}
                  onChange={(e) => setFormData({...formData, noOfSessions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div className="md:col-span-2 flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schemeGateCheck !== null && !schemeGateCheck.allowed}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Scheme
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Submitted Schemes</h2>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="text-gray-600 dark:text-gray-400 whitespace-nowrap">Filter by:</label>
                <select
                  value={schemeFilters.class}
                  onChange={(e) => setSchemeFilters(prev => ({ ...prev, class: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Classes</option>
                  {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{stripStdPrefix(cls)}</option>
                    ))}
                </select>
                
                <select
                  value={schemeFilters.term}
                  onChange={(e) => setSchemeFilters(prev => ({ ...prev, term: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Terms</option>
                  {availableTerms.map(term => (
                    <option key={term} value={term}>Term {term}</option>
                  ))}
                </select>
                
                {(schemeFilters.class !== 'all' || schemeFilters.term !== 'all') && (
                  <button
                    onClick={() => setSchemeFilters({ class: 'all', term: 'all' })}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs underline"
                  >
                    Clear filters
                  </button>
                )}
                
                <span className="text-gray-500 dark:text-gray-400 text-xs">({filteredSchemes.length} of {schemes.length})</span>
              </div>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {filteredSchemes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {schemes.length === 0 ? 'No schemes submitted yet.' : 'No schemes match the selected filters.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSchemes.map((scheme) => (
                  <div key={scheme.schemeId || scheme.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{stripStdPrefix(scheme.class)} - {scheme.subject}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{scheme.chapter}</div>
                      </div>
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scheme.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        scheme.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        scheme.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {scheme.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Month:</span>
                        <span className="ml-1 text-gray-900 dark:text-gray-100">{scheme.month}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Sessions:</span>
                        <span className="ml-1 text-gray-900 dark:text-gray-100">{scheme.noOfSessions || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openLessonView(scheme)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                      {scheme.status === 'Pending' && (
                        <button
                          onClick={() => handleDeleteScheme(scheme)}
                          disabled={deletingScheme === scheme.schemeId}
                          className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
                          title="Delete scheme"
                        >
                          {deletingScheme === scheme.schemeId ? '...' : <Trash2 className="h-4 w-4" />}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.schemeId || scheme.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{stripStdPrefix(scheme.class)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.chapter}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{scheme.noOfSessions || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scheme.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        scheme.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        scheme.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {scheme.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <button type="button" className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3" onClick={() => openLessonView(scheme)} title="View scheme">
                        <Eye className="h-4 w-4" />
                      </button>
                      {scheme.status === 'Pending' && (
                        <button
                          onClick={() => handleDeleteScheme(scheme)}
                          disabled={deletingScheme === scheme.schemeId}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                          title="Delete scheme"
                        >
                          {deletingScheme === scheme.schemeId ? '...' : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSchemes.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center"
                    >
                      {schemes.length === 0
                        ? 'No schemes submitted yet.'
                        : 'No schemes match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    );
};

export default SchemesView;
