// DailyReportModern.jsx - Redesigned Daily Reporting with Smooth UX
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  submitDailyReport,
  checkChapterCompletion,
  applyChapterCompletionAction,
  getPlannedLessonsForDate,
  getAppSettings,
} from "./api";
import { todayIST, formatLocalDate } from "./utils/dateUtils";

const COMPLETION_LEVELS = [
  { value: 0, label: '0% - Not Started', icon: '⭕', color: 'bg-gray-50 border-gray-200' },
  { value: 25, label: '25% - Started', icon: '🔵', color: 'bg-orange-50 border-orange-200' },
  { value: 50, label: '50% - Half Done', icon: '🟡', color: 'bg-yellow-50 border-yellow-200' },
  { value: 75, label: '75% - Almost Done', icon: '🟢', color: 'bg-blue-50 border-blue-200' },
  { value: 100, label: '100% - Complete', icon: '✅', color: 'bg-green-50 border-green-200' }
];

const DEVIATION_REASONS = [
  { value: "", label: "Select reason for 0% completion" },
  { value: "Exam", label: "📝 Exam / Assessment" },
  { value: "Event", label: "🎉 School Event" },
  { value: "Holiday", label: "🏖️ Holiday / No Class" },
  { value: "Other", label: "📋 Other (specify in notes)" }
];

export default function DailyReportModern({ user }) {
  const [date, setDate] = useState(todayIST());
  const [periods, setPeriods] = useState([]);
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [reports, setReports] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState({});
  const [message, setMessage] = useState({ text: "", type: "" });
  const [lessonPlans, setLessonPlans] = useState({});
  
  // Chapter completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionModalData, setCompletionModalData] = useState(null);
  
  // Prevent infinite reload loops
  const loadingRef = useRef(false);
  const lastErrorRef = useRef(null);
  const errorCountRef = useRef(0);

  const email = user?.email || "";
  const teacherName = user?.name || "";

  const periodKey = (p) => `${p.period}_${p.class}_${p.subject}`;

  const loadData = useCallback(async () => {
    if (!email || !date) {
      console.log('❌ Cannot load - missing email or date');
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.log('⏭️ Load already in progress, skipping');
      return;
    }
    
    // Stop retrying if we've had repeated failures
    if (errorCountRef.current >= 2 && lastErrorRef.current) {
      console.log('⏭️ Too many errors, stopping retry');
      return;
    }
    
    console.log('🔄 Loading data for:', { email, date });
    loadingRef.current = true;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // Load timetable and existing reports in parallel
      const [timetableRes, reportsRes, plansRes] = await Promise.all([
        getTeacherDailyTimetable(email, date),
        getTeacherDailyReportsForDate(email, date),
        getPlannedLessonsForDate(email, date)
      ]);

      // Handle different response structures
      let timetableData;
      if (Array.isArray(timetableRes)) {
        timetableData = timetableRes;
      } else if (Array.isArray(timetableRes?.periods)) {
        // New structure: {date, dayName, periods: []}
        timetableData = timetableRes.periods;
      } else if (Array.isArray(timetableRes?.data)) {
        timetableData = timetableRes.data;
      } else {
        timetableData = [];
      }
      
      const reportsData = Array.isArray(reportsRes?.data) ? reportsRes.data : (Array.isArray(reportsRes) ? reportsRes : []);
      const plansData = plansRes?.data || plansRes || { lessonsByPeriod: {} };

      setPeriods(timetableData);
      
      // Map existing reports by period key
      const reportsMap = {};
      if (Array.isArray(reportsData)) {
        reportsData.forEach(report => {
          const key = `${report.period}_${report.class}_${report.subject}`;
          reportsMap[key] = report;
        });
      }
      setReports(reportsMap);

      // Map lesson plans
      const lessonsByPeriod = plansData.lessonsByPeriod || {};
      setLessonPlans(lessonsByPeriod);

      // Auto-expand first unsubmitted period (only if not already set)
      setExpandedPeriod(prev => {
        if (prev) return prev; // Don't change if already set
        const firstUnsubmitted = timetableData.find(p => !reportsMap[periodKey(p)]);
        return firstUnsubmitted ? periodKey(firstUnsubmitted) : null;
      });

    } catch (error) {
      console.error("❌ Error loading data:", error);
      
      // Prevent infinite retry on network errors
      errorCountRef.current++;
      const errorMsg = error.message || String(error);
      
      if (errorMsg.includes('Failed to fetch')) {
        setMessage({ 
          text: `⚠️ Cannot connect to backend. Please check your internet connection or try refreshing the page.`, 
          type: "error" 
        });
        
        // Stop retrying after 2 failures
        if (errorCountRef.current >= 2) {
          console.error('❌ Multiple fetch failures detected. Stopping auto-retry.');
          lastErrorRef.current = errorMsg;
        }
      } else {
        setMessage({ text: `Error loading data: ${errorMsg}`, type: "error" });
      }
      
      setPeriods([]); // Reset to empty array on error
      setReports({});
      setLessonPlans({});
    } finally {
      setLoading(false);
      loadingRef.current = false; // Always release the lock
    }
  }, [email, date]); // Remove expandedPeriod from dependencies!

  // Load data when date or user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-save drafts to localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`dailyReportDrafts_${email}_${date}`);
    if (saved) {
      try {
        setDrafts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load drafts", e);
      }
    }
  }, [email, date]);

  useEffect(() => {
    if (Object.keys(drafts).length > 0) {
      localStorage.setItem(`dailyReportDrafts_${email}_${date}`, JSON.stringify(drafts));
    }
  }, [drafts, email, date]);

  const updateDraft = useCallback((key, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  }, []);

  const getDraft = useCallback((key) => drafts[key] || {}, [drafts]);
  const getReport = useCallback((key) => reports[key], [reports]);

  const handleSubmit = async (period) => {
    const key = periodKey(period);
    const report = getReport(key);

    if (report) {
      setMessage({ text: "Already submitted", type: "info" });
      return;
    }

    // Get current draft state
    const draft = getDraft(key);

    // Read CURRENT values from DOM to avoid stale state issues
    // When user types and immediately clicks submit, onChange might not have updated state yet
    const elementId = `${period.period}-${period.class}`;
    const chapterInput = document.getElementById(`chapter-${elementId}`);
    const objectivesInput = document.getElementById(`objectives-${elementId}`);
    const deviationReasonSelect = document.getElementById(`deviationReason-${elementId}`);
    
    const chapter = chapterInput ? chapterInput.value.trim() : (draft.chapter || "").trim();
    const objectives = objectivesInput ? objectivesInput.value.trim() : (draft.objectives || "").trim();
    const completionPercentage = Number(draft.completionPercentage || 0);
    const deviationReason = deviationReasonSelect ? deviationReasonSelect.value.trim() : (draft.deviationReason || "").trim();

    // Validation using current DOM values
    if (!chapter) {
      setMessage({ text: "❌ Chapter/Topic is required", type: "error" });
      return;
    }

    if (completionPercentage === 0 && !deviationReason) {
      setMessage({ text: "❌ For 0% completion, please select a reason", type: "error" });
      return;
    }

    if (completionPercentage > 0 && !objectives) {
      setMessage({ text: "❌ Learning Objectives required when teaching was done", type: "error" });
      return;
    }

    setSubmitting(prev => ({ ...prev, [key]: true }));
    setMessage({ text: "", type: "" });

    try {
      const payload = {
        date: date,
        teacherEmail: email,
        teacherName: teacherName,
        class: period.class,
        subject: period.subject,
        period: Number(period.period),
        lessonPlanId: draft.lessonPlanId || "",
        chapter: chapter,
        sessionNo: Number(draft.sessionNo || 1),
        totalSessions: Number(draft.totalSessions || 1),
        completionPercentage: completionPercentage,
        chapterStatus: draft.chapterCompleted ? 'Chapter Complete' : 'Session Complete',
        deviationReason: deviationReason,
        difficulties: draft.difficulties || "",
        nextSessionPlan: draft.nextSessionPlan || "",
        objectives: objectives,
        activities: draft.activities || "",
        notes: draft.notes || "",
        chapterCompleted: draft.chapterCompleted || false,
      };

      console.log('📝 SUBMITTING DAILY REPORT:', payload);
      const res = await submitDailyReport(payload);
      console.log('📥 DAILY REPORT RESPONSE:', res);
      
      const result = res.data || res;
      console.log('📦 UNWRAPPED RESULT:', result);

      if (result && (result.ok || result.submitted)) {
        console.log('✅ Daily report submitted successfully');
        // Update reports map WITHOUT reloading entire page
        setReports(prev => ({
          ...prev,
          [key]: { ...payload, reportId: result.reportId }
        }));

        // Clear draft
        setDrafts(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[key];
          return newDrafts;
        });

        // Collapse this period and expand next
        const currentIndex = periods.findIndex(p => periodKey(p) === key);
        const nextPeriod = periods[currentIndex + 1];
        if (nextPeriod && !getReport(periodKey(nextPeriod))) {
          setExpandedPeriod(periodKey(nextPeriod));
        } else {
          setExpandedPeriod(null);
        }

        setMessage({ text: `✅ Period ${period.period} submitted successfully!`, type: "success" });

        // Check chapter completion
        if (draft.chapterCompleted) {
          try {
            const completionCheck = await checkChapterCompletion({
              teacherEmail: email,
              class: period.class,
              subject: period.subject,
              chapter: chapter,
              date: date
            });

            const checkResult = completionCheck.data || completionCheck;

            if (checkResult.success && checkResult.hasRemainingPlans) {
              setCompletionModalData({
                chapter: chapter,
                class: period.class,
                subject: period.subject,
                remainingPlans: checkResult.remainingPlans
              });
              setShowCompletionModal(true);
            }
          } catch (checkError) {
            console.error('Error checking chapter completion:', checkError);
          }
        }

      } else if (result && result.error === 'duplicate') {
        setReports(prev => ({ ...prev, [key]: payload }));
        setMessage({ text: "Already submitted", type: "info" });
      } else {
        setMessage({ text: "Failed to submit report", type: "error" });
      }
    } catch (error) {
      console.error("Submit error:", error);
      setMessage({ text: `Error: ${error.message}`, type: "error" });
    } finally {
      setSubmitting(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSubmitAll = async () => {
    for (const period of periods) {
      const key = periodKey(period);
      if (!getReport(key)) {
        await handleSubmit(period);
      }
    }
  };

  const getCompletionLevel = (percentage) => {
    return COMPLETION_LEVELS.find(l => l.value === percentage) || COMPLETION_LEVELS[0];
  };

  const displayDate = useMemo(() => {
    if (!date) return 'No date selected';
    try {
      const dateObj = new Date(date + 'T00:00:00');
      if (isNaN(dateObj.getTime())) return date;
      return dateObj.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return date;
    }
  }, [date]);
  const submittedCount = periods.filter(p => getReport(periodKey(p))).length;
  const totalPeriods = periods.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📝 Daily Reports</h1>
              <p className="text-gray-600 mt-1">Track your teaching progress</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Date:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {totalPeriods > 0 && (
                <button
                  onClick={handleSubmitAll}
                  disabled={submittedCount === totalPeriods}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit All
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {totalPeriods > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress: {submittedCount} / {totalPeriods} periods
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {Math.round((submittedCount / totalPeriods) * 100)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${(submittedCount / totalPeriods) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Message */}
          {message.text && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="max-w-5xl mx-auto text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading your timetable...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && periods.length === 0 && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Today</h3>
            <p className="text-gray-600">You don't have any scheduled periods for {displayDate}</p>
          </div>
        </div>
      )}

      {/* Period Cards */}
      {!loading && periods.length > 0 && (
        <div className="max-w-5xl mx-auto space-y-4">
          {periods.map((period) => {
            if (!period || !period.period || !period.class || !period.subject) {
              console.warn('Invalid period data:', period);
              return null;
            }
            
            const key = periodKey(period);
            const report = getReport(key);
            const draft = getDraft(key);
            const isExpanded = expandedPeriod === key;
            const isSubmitted = !!report;
            const isSubmitting = submitting[key] || false;
            
            // Match lesson plan by period|class|subject
            const planKey = `${period.period}|${period.class}|${period.subject}`;
            const plan = lessonPlans[planKey] || null;
            
            const completionLevel = getCompletionLevel(
              isSubmitted ? (report.completionPercentage || 0) : (draft.completionPercentage || 0)
            );

            return (
              <PeriodCard
                key={key}
                period={period}
                isExpanded={isExpanded}
                isSubmitted={isSubmitted}
                isSubmitting={isSubmitting}
                completionLevel={completionLevel}
                draft={draft}
                report={report}
                plan={plan}
                onToggle={() => setExpandedPeriod(isExpanded ? null : key)}
                onUpdate={(field, value) => updateDraft(key, field, value)}
                onSubmit={() => handleSubmit(period)}
              />
            );
          })}
        </div>
      )}

      {/* Chapter Completion Modal */}
      {showCompletionModal && completionModalData && (
        <ChapterCompletionModal
          data={completionModalData}
          onClose={() => setShowCompletionModal(false)}
          onAction={async (action) => {
            try {
              const lessonPlanIds = completionModalData.remainingPlans.map(p => p.lpId);
              console.log('📤 SENDING TO BACKEND:', { userAction: action, lessonPlanIds });
              console.log('   User Action:', action);
              console.log('   IDs:', lessonPlanIds);
              console.log('   Number of IDs:', lessonPlanIds.length);
              
              const result = await applyChapterCompletionAction({ userAction: action, lessonPlanIds });
              
              console.log('📥 BACKEND RESPONSE:', result);
              console.log('   result.data:', result?.data);
              console.log('   result.status:', result?.status);
              
              // Unwrap response if wrapped in {status, data, timestamp} structure
              const actualData = result?.data || result;
              
              console.log('📦 UNWRAPPED DATA:', actualData);
              console.log('   Success:', actualData?.success);
              console.log('   Updated count:', actualData?.updatedCount);
              console.log('   Message:', actualData?.message);
              
              setShowCompletionModal(false);
              
              if (actualData?.updatedCount === 0) {
                setMessage({
                  text: '⚠️ No lesson plans were updated. Please check the lesson plan IDs.',
                  type: 'error'
                });
              } else {
                setMessage({
                  text: action === 'cancel' 
                    ? `✅ ${actualData?.updatedCount || 0} lesson plan(s) cancelled successfully!`
                    : '📚 Lesson plans kept for revision',
                  type: 'success'
                });
              }
              
              // No need to reload data - daily report already submitted and UI already updated
            } catch (error) {
              console.error('❌ Error applying action:', error);
              console.error('   Error message:', error.message);
              console.error('   Error stack:', error.stack);
              setMessage({
                text: 'Error updating lesson plans: ' + (error.message || error),
                type: 'error'
              });
            }
          }}
        />
      )}
    </div>
  );
}

// Period Card Component
function PeriodCard({ 
  period, 
  isExpanded, 
  isSubmitted, 
  isSubmitting,
  completionLevel, 
  draft = {}, 
  report = null, 
  plan = null,
  onToggle, 
  onUpdate, 
  onSubmit 
}) {
  const data = isSubmitted ? (report || {}) : (draft || {});
  const chapter = data.chapter || plan?.chapter || "";
  const objectives = data.objectives || plan?.learningObjectives || "";
  const completionPercentage = data.completionPercentage || 0;

  return (
    <div className={`bg-white rounded-xl shadow-md transition-all duration-300 ${
      isExpanded ? 'shadow-xl' : 'hover:shadow-lg'
    }`}>
      {/* Card Header */}
      <div
        className={`p-6 cursor-pointer ${isSubmitted ? 'bg-green-50' : 'hover:bg-gray-50'} rounded-t-xl transition-colors`}
        onClick={!isSubmitted ? onToggle : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
              isSubmitted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              P{period.period}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{period.class}</h3>
                <span className="text-gray-400">•</span>
                <span className="text-gray-700">{period.subject}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">{period.startTime} - {period.endTime}</span>
                {chapter && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-600">📖 {chapter}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completion Badge */}
            <div className={`px-4 py-2 rounded-full border-2 flex items-center gap-2 ${completionLevel.color}`}>
              <span className="text-lg">{completionLevel.icon}</span>
              <span className="text-sm font-medium">{completionPercentage}%</span>
            </div>

            {/* Status Badge */}
            {isSubmitted ? (
              <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-medium text-sm flex items-center gap-2">
                <span>✓</span>
                <span>Submitted</span>
              </div>
            ) : (
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <svg className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Form */}
      {isExpanded && !isSubmitted && (
        <div className="p-6 border-t border-gray-100 space-y-6">
          {/* Show lesson plan details if available */}
          {plan ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📚</div>
                <div className="flex-1">
                  <div className="font-medium text-green-900">Lesson Plan: {plan.chapter}</div>
                  <div className="text-sm text-green-700 mt-1">Session {plan.session} of {plan.totalSessions}</div>
                  <div className="text-xs text-green-600 mt-1">Plan ID: {plan.lpId}</div>
                  {plan.learningObjectives && (
                    <div className="text-xs text-green-700 mt-2">
                      <strong>Objectives:</strong> {plan.learningObjectives.substring(0, 100)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-medium text-red-900">No Lesson Plan Found</div>
                  <div className="text-sm text-red-700 mt-1">Please prepare and submit a lesson plan for approval before teaching this period.</div>
                </div>
              </div>
            </div>
          )}

          {/* Chapter & Session */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapter / Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id={`chapter-${period.period}-${period.class}`}
                value={chapter}
                onChange={(e) => onUpdate('chapter', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder={plan ? "From lesson plan" : "Enter chapter or topic name"}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  plan ? 'bg-blue-50 border-blue-300' : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Number
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={data.sessionNo || 1}
                  onChange={(e) => onUpdate('sessionNo', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  min="1"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="py-2 text-gray-500">of</span>
                <input
                  type="number"
                  value={data.totalSessions || 1}
                  onChange={(e) => onUpdate('totalSessions', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  min="1"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Learning Objectives */}
          {plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives (from Lesson Plan) 
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                id={`objectives-${period.period}-${period.class}`}
                value={objectives}
                onChange={(e) => onUpdate('objectives', e.target.value)}
                placeholder="Learning objectives from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Teaching Methods/Activities */}
          {plan && plan.teachingMethods && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teaching Methods (from Lesson Plan)
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                value={data.activities || plan.teachingMethods || ""}
                onChange={(e) => onUpdate('activities', e.target.value)}
                placeholder="Teaching methods from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Completion Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Completion Level <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {COMPLETION_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => onUpdate('completionPercentage', level.value)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    completionPercentage === level.value
                      ? level.color + ' border-blue-500 shadow-md'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{level.icon}</div>
                  <div className="text-xs font-medium text-gray-700">{level.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Deviation Reason (only for 0%) */}
          {completionPercentage === 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for 0% Completion <span className="text-red-500">*</span>
              </label>
              <select
                id={`deviationReason-${period.period}-${period.class}`}
                value={data.deviationReason || ""}
                onChange={(e) => onUpdate('deviationReason', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DEVIATION_REASONS.map(reason => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Learning Objectives - show for all cases when completion > 0 */}
          {completionPercentage > 0 && !plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives <span className="text-red-500">*</span>
              </label>
              <textarea
                id={`objectives-${period.period}-${period.class}`}
                value={objectives}
                onChange={(e) => onUpdate('objectives', e.target.value)}
                placeholder="What learning objectives were covered?"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Activities - show for all cases when completion > 0 */}
          {completionPercentage > 0 && !plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activities
              </label>
              <textarea
                value={data.activities || ""}
                onChange={(e) => onUpdate('activities', e.target.value)}
                placeholder="Teaching activities and methods used..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Notes - includes difficulties, observations, next session plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={data.notes || ""}
              onChange={(e) => {
                onUpdate('notes', e.target.value);
                // Also update legacy fields for backward compatibility
                onUpdate('difficulties', e.target.value);
                onUpdate('nextSessionPlan', e.target.value);
              }}
              placeholder="Difficulties, observations, or next session plan..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Chapter Complete Checkbox */}
          {completionPercentage === 100 && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <input
                type="checkbox"
                id={`chapterComplete_${period.period}`}
                checked={data.chapterCompleted || false}
                onChange={(e) => onUpdate('chapterCompleted', e.target.checked)}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <label htmlFor={`chapterComplete_${period.period}`} className="flex-1 text-sm font-medium text-green-900">
                🎉 Mark chapter as fully completed
              </label>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onToggle}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chapter Completion Modal
function ChapterCompletionModal({ data, onClose, onAction }) {
  const [selectedAction, setSelectedAction] = useState('cancel');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async () => {
    setIsProcessing(true);
    await onAction(selectedAction);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">🎉 Chapter Completed!</h3>
              <p className="text-gray-600 mt-1">What should we do with remaining planned sessions?</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Chapter Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Completed Chapter:</div>
            <div className="font-semibold text-gray-900">{data.chapter}</div>
            <div className="text-sm text-gray-600 mt-1">{data.class} • {data.subject}</div>
          </div>

          {/* Remaining Plans */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Remaining Planned Sessions ({data.remainingPlans.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.remainingPlans.map((plan, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium text-sm">
                      {plan.selectedPeriod || 'N/A'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {plan.selectedDate ? new Date(plan.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : 'No date'}
                      </div>
                      <div className="text-xs text-gray-500">Session {plan.session || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{plan.status || 'Unknown'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-green-50 ${selectedAction === 'cancel' ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
              <input
                type="radio"
                name="action"
                value="cancel"
                checked={selectedAction === 'cancel'}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="mt-1 w-5 h-5 text-green-600 focus:ring-green-500"
              />
              <div className="ml-3 flex-1">
                <div className="font-semibold text-gray-900">✅ Chapter Fully Completed</div>
                <div className="text-sm text-gray-600 mt-1">
                  Cancel remaining sessions and free up periods for the next chapter
                </div>
                <div className="text-xs text-green-600 mt-2">
                  ✓ Recommended when chapter is fully taught
                </div>
              </div>
            </label>

            <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-blue-50 ${selectedAction === 'keep' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
              <input
                type="radio"
                name="action"
                value="keep"
                checked={selectedAction === 'keep'}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3 flex-1">
                <div className="font-semibold text-gray-900">📚 Keep for Revision</div>
                <div className="text-sm text-gray-600 mt-1">
                  Keep the planned sessions for revision and practice
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  ✓ Useful for important topics needing more practice
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAction}
            disabled={isProcessing}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Confirm</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
