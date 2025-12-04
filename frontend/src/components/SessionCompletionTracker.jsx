import { 
  Clock, CheckCircle, AlertTriangle, BookOpen, 
  Calendar, Target, Activity
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import * as api from '../api';

/**
 * Session Completion Tracker
 * Handles Rema's scenario: partial completion tracking and performance evaluation
 */
const SessionCompletionTracker = ({ user, onSessionUpdate }) => {
  const [activeSession, setActiveSession] = useState(null);
  const [completionForm, setCompletionForm] = useState({
    lpId: '',
    completionPercentage: 0,
    teachingNotes: '',
    difficultiesEncountered: '',
    nextSessionAdjustments: '',
    estimatedCatchupTime: ''
  });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [schemeAnalytics, setSchemeAnalytics] = useState({});
  const [todaysSessions, setTodaysSessions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Load today's sessions for the teacher
  useEffect(() => {
    if (user?.email) {
      loadTodaysSessions();
      loadPerformanceData();
    }
  }, [user]);

  const loadTodaysSessions = async () => {
    try {
      // Load this week's sessions instead of just today's for better visibility
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
      
      const plans = await api.getTeacherLessonPlans(user.email);
      console.log('Loaded lesson plans:', plans); // Debug log
      
      // Filter for this week's sessions
      const thisWeeksPlans = plans.filter(plan => {
        const planDate = new Date(plan.selectedDate || plan.date);
        return planDate >= startOfWeek && planDate <= endOfWeek;
      });
      
      console.log('This week\'s sessions:', thisWeeksPlans); // Debug log
      setTodaysSessions(thisWeeksPlans);
      
      if (thisWeeksPlans.length === 0) {
        console.log('No lesson plans found for this week. Teacher needs to create lesson plans first.');
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      setTodaysSessions([]);
    }
  };

  const loadPerformanceData = async () => {
    try {
      const performance = await api.getTeacherPerformanceDashboard(user.email);
      if (performance.success) {
        setPerformanceData(performance.performance);
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  };

  const handleSessionComplete = (session) => {
    setActiveSession(session);
    setCompletionForm({
      lpId: session.lpId,
      completionPercentage: 0,
      teachingNotes: '',
      difficultiesEncountered: '',
      nextSessionAdjustments: '',
      estimatedCatchupTime: ''
    });
    setShowCompletionModal(true);
  };

  const submitCompletion = async () => {
    if (!activeSession) return;
    
    setSubmitting(true);
    try {
      const sessionData = {
        ...completionForm,
        teacherEmail: user.email,
        completionDate: new Date().toISOString(),
        class: activeSession.class,
        subject: activeSession.subject,
        chapter: activeSession.chapter,
        session: activeSession.session
      };

      const result = await api.updateSessionCompletion(sessionData);
      
      if (result.success) {
        setShowCompletionModal(false);
        loadTodaysSessions();
        loadPerformanceData();
        
        if (onSessionUpdate) {
          onSessionUpdate(activeSession, sessionData);
        }
        
        // Show success message with cascading effects info
        alert(`Session completed successfully! ${result.cascadingEffects || ''}`);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        alert(`Error updating session: ${errorMessage}`);
        console.error('Session update error:', result);
      }
    } catch (error) {
      console.error('Error updating session completion:', error);
      alert('Error updating session completion');
    } finally {
      setSubmitting(false);
    }
  };

  const getSessionStatusColor = (completion) => {
    if (completion >= 100) return 'bg-green-100 text-green-800';
    if (completion >= 75) return 'bg-blue-100 text-blue-800';
    if (completion >= 25) return 'bg-yellow-100 text-yellow-800';
    if (completion > 0) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getSessionStatusText = (completion) => {
    if (completion >= 100) return 'Completed';
    if (completion >= 75) return 'Mostly Complete';
    if (completion >= 25) return 'Partial';
    if (completion > 0) return 'Started';
    return 'Not Started';
  };

  const getPerformanceGradeColor = (grade) => {
    switch (grade) {
      case 'Excellent': return 'text-green-600';
      case 'Good': return 'text-blue-600';
      case 'Satisfactory': return 'text-yellow-600';
      case 'Needs Improvement': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      {performanceData && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Teaching Performance</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceGradeColor(performanceData.performanceGrade)}`}>
              {performanceData.performanceGrade}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">Total Sessions</p>
                  <p className="text-2xl font-bold text-blue-900">{performanceData.totalSessions || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{performanceData.completedSessions || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800">Avg Completion</p>
                  <p className="text-2xl font-bold text-yellow-900">{performanceData.averageCompletion || 0}%</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-800">On-Time Rate</p>
                  <p className="text-2xl font-bold text-purple-900">{performanceData.onTimeCompletion || 100}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {performanceData.recommendations && performanceData.recommendations.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Performance Recommendations</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                {performanceData.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Today's Sessions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">This Week's Sessions</h2>
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {todaysSessions.length > 0 ? (
            <div className="space-y-4">
              {todaysSessions.map((session, index) => (
                <div key={session.lpId || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">
                          Period {session.selectedPeriod || session.period}
                        </span>
                        <span className="text-sm text-gray-600">
                          {session.class} - {session.subject}
                        </span>
                        <span className="text-sm text-gray-500">
                          Chapter: {session.chapter}, Session {session.session}
                        </span>
                      </div>
                      
                      <div className="flex items-center mt-2 space-x-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getSessionStatusColor(session.completionPercentage || 0)
                        }`}>
                          {getSessionStatusText(session.completionPercentage || 0)}
                          {session.completionPercentage > 0 && ` (${session.completionPercentage}%)`}
                        </span>
                        
                        {session.cascadingWarning && (
                          <span className="text-xs text-amber-600 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Cascading Effect
                          </span>
                        )}
                      </div>

                      {session.teachingNotes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <strong>Notes:</strong> {session.teachingNotes}
                        </div>
                      )}
                      
                      {session.difficultiesEncountered && (
                        <div className="mt-1 text-sm text-red-600">
                          <strong>Difficulties:</strong> {session.difficultiesEncountered}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <button
                        onClick={() => handleSessionComplete(session)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                        disabled={session.completionPercentage >= 100}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        {session.completionPercentage >= 100 ? 'Completed' : 'Update Progress'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions scheduled this week</h3>
              <div className="text-gray-600 space-y-2">
                <p>To start tracking session progress, you need to:</p>
                <div className="text-left inline-block mt-3">
                  <p className="text-sm">1. Go to <span className="font-medium text-blue-600">"Lesson Plans"</span> and create lesson plans</p>
                  <p className="text-sm">2. Or use <span className="font-medium text-blue-600">"Scheme-Based Planning"</span> to generate sessions</p>
                  <p className="text-sm">3. Schedule sessions for this week</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Completion Modal */}
      {showCompletionModal && activeSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Session Progress
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {activeSession.class} - {activeSession.subject} | Chapter: {activeSession.chapter}, Session {activeSession.session}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Completion Percentage
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={completionForm.completionPercentage}
                  onChange={(e) => setCompletionForm({
                    ...completionForm,
                    completionPercentage: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span className="font-medium text-blue-600">{completionForm.completionPercentage}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teaching Notes
                </label>
                <textarea
                  value={completionForm.teachingNotes}
                  onChange={(e) => setCompletionForm({
                    ...completionForm,
                    teachingNotes: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="What was covered in this session?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulties Encountered
                </label>
                <textarea
                  value={completionForm.difficultiesEncountered}
                  onChange={(e) => setCompletionForm({
                    ...completionForm,
                    difficultiesEncountered: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Any challenges or issues faced?"
                />
              </div>

              {completionForm.completionPercentage < 100 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Next Session Adjustments
                    </label>
                    <textarea
                      value={completionForm.nextSessionAdjustments}
                      onChange={(e) => setCompletionForm({
                        ...completionForm,
                        nextSessionAdjustments: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={2}
                      placeholder="How will you adjust the next session?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Catch-up Time
                    </label>
                    <select
                      value={completionForm.estimatedCatchupTime}
                      onChange={(e) => setCompletionForm({
                        ...completionForm,
                        estimatedCatchupTime: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select time needed</option>
                      <option value="5-10 minutes">5-10 minutes</option>
                      <option value="15-20 minutes">15-20 minutes</option>
                      <option value="Half session">Half session</option>
                      <option value="Full session">Full session</option>
                      <option value="Multiple sessions">Multiple sessions</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={submitCompletion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Update Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionCompletionTracker;