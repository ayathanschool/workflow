import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  submitDailyReport,
  getApprovedLessonPlansForReport,
  getPlannedLessonsForDate, // NEW: Batch endpoint
  getAppSettings, // Get period times from settings
} from "./api";
import { todayIST, formatLocalDate, periodToTimeString } from "./utils/dateUtils";

const COMPLETION = [
  "Not Started",
  "Partially Completed", 
  "Fully Completed",
];

const PLAN_TYPES = [
  "in plan",
  "not planned",
];

export default function DailyReportTimetable({ user }) {
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState([]);              // timetable rows for the day
  const [statusMap, setStatusMap] = useState({});    // key -> "Submitted" | "Not Submitted"
  const [drafts, setDrafts] = useState({});          // key -> { planType, lessonPlanId, chapter, objectives, activities, completed, notes }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});          // key -> boolean
  const [message, setMessage] = useState("");        // top level message
  const [periods, setPeriods] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [reportDetails, setReportDetails] = useState({});
  const [lessonPlansMap, setLessonPlansMap] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lessonDelays, setLessonDelays] = useState([]);
  const [appSettings, setAppSettings] = useState(null);  // Store app settings with period times
  const [loadedDate, setLoadedDate] = useState(null);  // Track last loaded date to prevent infinite refreshes
  const loadedEmailRef = useRef(null);  // Track last loaded email to prevent unnecessary reloads

  // Memoize user object to prevent unnecessary re-renders from parent component
  const memoizedUser = useMemo(() => ({
    email: user?.email || "",
    name: user?.name || ""
  }), [user?.email, user?.name]);
  
  const stableEmail = memoizedUser.email;
  const teacherName = memoizedUser.name;

  function keyOf(r) {
    // stable per-period key
    return `${r.period}|${r.class}|${r.subject}`;
  }

  async function fetchLessonPlans(cls, subject) {
    if (!cls || !subject || !stableEmail) return [];
    try {
      const plans = await getApprovedLessonPlansForReport(stableEmail, cls, subject);
      return Array.isArray(plans) ? plans : [];
    } catch (e) {
      console.error('Failed to fetch lesson plans:', e);
      return [];
    }
  }

  async function load() {
    if (!stableEmail) {
      console.log('❌ No email provided for timetable load');
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      console.log('🔍 Loading timetable for:', { email: stableEmail, date, user });
      
      // ===== PERFORMANCE: Fetch ALL data in parallel (3 main calls at once) =====
      const [tt, rep, batchPlannedLessons] = await Promise.all([
        getTeacherDailyTimetable(stableEmail, date),            // [{period, class, subject, teacherName, chapter}]
        getTeacherDailyReportsForDate(stableEmail, date),       // [{class, subject, period, planType, lessonPlanId, status}]
        getPlannedLessonsForDate(stableEmail, date)            // Batch fetch all planned lessons
      ]);

      console.log('📅 Timetable response:', tt);
      console.log('📝 Reports response:', rep);
      console.log('📦 Planned lessons batch:', batchPlannedLessons);
      console.log('🐛 Debug info from API:', tt?.debug);
      
      // DEBUG: Check reports structure
      console.log('🔍 Reports is array?', Array.isArray(rep));
      console.log('🔍 Reports length:', rep?.length);
      console.log('🔍 Reports.data is array?', Array.isArray(rep?.data));
      console.log('🔍 Reports.data length:', rep?.data?.length);
      if (rep && rep.length > 0) {
        console.log('🔍 First report:', rep[0]);
      } else if (rep?.data && rep.data.length > 0) {
        console.log('🔍 First report from .data:', rep.data[0]);
      }

      // No lesson delays loaded (feature removed)
      setLessonDelays([]);

      // Normalize timetable list - handle both array and structured response
      let ttList = [];
      if (Array.isArray(tt)) {
        ttList = tt;
      } else if (tt && Array.isArray(tt.periods)) {
        ttList = tt.periods;
      } else if (tt && tt.data && Array.isArray(tt.data)) {
        ttList = tt.data;
      } else {
        console.log('⚠️ Unexpected timetable response format:', tt);
      }
      
      console.log('📚 Normalized timetable list:', ttList);
      setRows(ttList);

      // status map: Submitted/Not Submitted
      const sm = {};
      
      // CRITICAL FIX: API wraps response in {status, data, timestamp}
      // Need to unwrap the .data property to get actual reports array
      console.log('🔍 Reports response structure:', rep);
      const reportsArray = Array.isArray(rep?.data) ? rep.data : (Array.isArray(rep) ? rep : []);
      console.log('🔍 Reports array extracted:', reportsArray.length, 'reports');
      
      // Create report map by period key for easy lookup
      const reportMap = {};
      reportsArray.forEach(r => {
        const k = `${r.period}|${r.class}|${r.subject}`;
        sm[k] = r.status || "Submitted";  // Mark as submitted
        reportMap[k] = r;  // Store the full report for later use
        console.log(`  ✓ Mapped report: ${k} -> status: ${sm[k]}`);
      });
      
      console.log(`📊 Status map created with ${Object.keys(sm).length} submitted reports`);
      setStatusMap(sm);

      // ===== PERFORMANCE: Skip loading lesson plans upfront - lazy load when dropdown opens =====
      // Lesson plans are only needed when user selects from dropdown, not for initial render
      const lessonPlansMap = {};
      setLessonPlansMap(lessonPlansMap);
      console.log('⚡ Skipping lesson plan preload for faster initial load');

      // ===== Use planned lessons from batch call (already fetched in parallel above) =====
      const lessonsByPeriod = batchPlannedLessons?.lessonsByPeriod || {};
      console.log(`📦 Using ${Object.keys(lessonsByPeriod).length} planned lessons from batch endpoint`);

      // Initialize drafts for not-submitted rows WITH AUTO-FILL from planned lessons
      // AND populate with existing report data for submitted reports (for display)
      const nextDrafts = {};
      
      ttList.forEach((r) => {
        const k = keyOf(r);
        
        // If already submitted, populate with existing report data
        if (sm[k] && sm[k] !== "Not Submitted") {
          const existingReport = reportMap[k];
          if (existingReport) {
            console.log(`📄 Populating period ${r.period} with submitted report data`);
            nextDrafts[k] = {
              planType: existingReport.planType || "not planned",
              lessonPlanId: existingReport.lessonPlanId || "",
              chapter: existingReport.chapter || "",
              sessionNo: Number(existingReport.sessionNo || 0),
              objectives: existingReport.objectives || "",
              activities: existingReport.activities || "",
              completed: existingReport.completed || "Not Started",
              notes: existingReport.notes || "",
              _isSubstitution: r.isSubstitution || false,
              _originalTeacher: r.originalTeacher || '',
              _session: existingReport.sessionNo || existingReport.session || '',
              _submitted: true
            };
            return; // Skip to next period
          }
        }
        
        // Check if there's a planned lesson for this period
        const periodKey = `${r.period}|${r.class}|${r.subject}`;
        const plannedLesson = lessonsByPeriod[periodKey];
        
        if (plannedLesson) {
          // Auto-fill with planned lesson
          console.log(`✨ Auto-filling period ${r.period} with lesson plan: ${plannedLesson.lpId}`);
          nextDrafts[k] = {
            planType: "in plan",
            lessonPlanId: plannedLesson.lpId,
            chapter: plannedLesson.chapter || "",
            sessionNo: Number(plannedLesson.sessionNo || plannedLesson.session || 0),
            objectives: plannedLesson.learningObjectives || "",
            activities: plannedLesson.teachingMethods || "",
            completed: "Not Started",
            notes: "",
            _isSubstitution: r.isSubstitution || false,
            _originalTeacher: r.originalTeacher || '',
            _session: plannedLesson.session || ''
          };
        } else {
          // No planned lesson - unplanned period
          console.log(`⚠️ No planned lesson for period ${r.period} (${r.class}/${r.subject})`);
          nextDrafts[k] = {
            planType: "not planned",
            lessonPlanId: "",
            chapter: r.chapter || "",
            sessionNo: 0,
            objectives: "",
            activities: "",
            completed: "Not Started",
            notes: "",
            _isSubstitution: r.isSubstitution || false,
            _originalTeacher: r.originalTeacher || ''
          };
        }
      });
      
      setDrafts(nextDrafts);
      console.log('✅ Auto-filled', Object.keys(nextDrafts).length, 'periods (including submitted reports)');

      if (!ttList.length) {
        const debugInfo = tt?.debug || {};
        setMessage(`No periods on this day. Debug: Found ${debugInfo.regularPeriodsFound || 0} regular periods and ${debugInfo.substitutionPeriodsFound || 0} substitution periods for ${debugInfo.dayName || 'unknown day'}.`);
      }
    } catch (e) {
      console.error('❌ Error loading timetable:', e);
      setMessage(`Unable to load timetable or reports. Error: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  // Fetch app settings (including period times) once on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        console.log('📊 Fetching app settings...');
        const settings = await getAppSettings();
        console.log('✅ App settings received:', settings);
        
        if (settings && (settings.periodTimesWeekday || settings.periodTimesFriday)) {
          setAppSettings(settings);
          console.log('✅ App settings loaded with period times:', {
            weekday: settings.periodTimesWeekday?.length || 0,
            friday: settings.periodTimesFriday?.length || 0
          });
        } else {
          console.warn('⚠️ No period times in settings, using defaults');
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch app settings, using defaults:', err);
        // Continue with defaults (hardcoded in dateUtils)
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => { 
    // Only reload if date OR email has actually changed from last load
    // This prevents reloads when user is typing or when parent re-renders for other reasons
    const hasDateChanged = date !== loadedDate;
    const hasEmailChanged = stableEmail && stableEmail !== loadedEmailRef.current;
    
    if (stableEmail && (hasDateChanged || hasEmailChanged)) {
      console.log('🔄 Loading data:', { 
        reason: hasDateChanged ? 'date changed' : 'email changed',
        date, 
        email: stableEmail 
      });
      setLoadedDate(date);
      loadedEmailRef.current = stableEmail;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, stableEmail]); // Removed loadedDate from dependencies to prevent loops

  function setDraft(k, field, value) {
    setDrafts(prev => ({ ...prev, [k]: { ...(prev[k] || {}), [field]: value } }));
  }

  function handleLessonPlanChange(k, lessonPlanId) {
    const r = rows.find(row => keyOf(row) === k);
    if (!r) return;

    const plansKey = `${r.class}|${r.subject}`;
    
    // Lazy load lesson plans if not already loaded
    if (!lessonPlansMap[plansKey]) {
      console.log(`⏳ Lazy-loading lesson plans for ${r.class}/${r.subject}...`);
      fetchLessonPlans(r.class, r.subject).then(plans => {
        setLessonPlansMap(prev => ({
          ...prev,
          [plansKey]: plans
        }));
        
        // Apply the selection after plans are loaded
        const selectedPlan = plans.find(plan => plan.lpId === lessonPlanId);
        if (selectedPlan) {
          setDrafts(prev => ({
            ...prev,
            [k]: {
              ...(prev[k] || {}),
              lessonPlanId: lessonPlanId,
              chapter: selectedPlan.chapter || "",
              objectives: selectedPlan.objectives || "",
              activities: selectedPlan.activities || "",
            }
          }));
        }
      }).catch(err => {
        console.error(`Failed to lazy-load lesson plans:`, err);
      });
      return; // Exit early, will update after async load
    }

    const selectedPlan = lessonPlansMap[plansKey]?.find(plan => plan.lpId === lessonPlanId);

    if (selectedPlan) {
      setDrafts(prev => ({
        ...prev,
        [k]: {
          ...(prev[k] || {}),
          lessonPlanId: lessonPlanId,
          chapter: selectedPlan.chapter || "",
          objectives: selectedPlan.objectives || "",
          activities: selectedPlan.activities || "",
        }
      }));
    } else {
      // Clear lesson plan fields if no plan selected
      setDrafts(prev => ({
        ...prev,
        [k]: {
          ...(prev[k] || {}),
          lessonPlanId: "",
          chapter: prev[k]?.chapter || "",
          objectives: prev[k]?.objectives || "",
          activities: prev[k]?.activities || "",
        }
      }));
    }
  }

  async function handleSubmitOne(r) {
    const k = keyOf(r);
    const d = drafts[k] || {};
    if (statusMap[k] === "Submitted") return;

    // STRICT VALIDATION: Chapter, Objectives AND Completion Status are REQUIRED
    const chapter = (d.chapter || r.chapter || "").trim();
    const objectives = (d.objectives || "").trim();
    const completed = d.completed || "Not Started";
    
    // Validate chapter
    if (!chapter || chapter.length === 0) {
      const errorMsg = "❌ Chapter/Topic is required! Please fill the Chapter field before submitting.";
      setMessage(errorMsg);
      alert(errorMsg);
      return;
    }
    
    // Validate objectives
    if (!objectives || objectives.length === 0) {
      const errorMsg = "❌ Learning Objectives are required! Please fill the Objectives field before submitting.";
      setMessage(errorMsg);
      alert(errorMsg);
      return;
    }
    
    // Validate completion status
    if (completed === "Not Started") {
      const errorMsg = "❌ Completion Status is required! Please select how much of the lesson was completed before submitting.";
      setMessage(errorMsg);
      alert(errorMsg);
      return;
    }

    setSaving(s => ({ ...s, [k]: true }));
    setMessage("");

    try {
      const payload = {
        date,
        teacherEmail: stableEmail,
        teacherName,
        class: r.class,
        subject: r.subject,
        period: Number(r.period),
        planType: d.planType || "not planned",
        lessonPlanId: d.lessonPlanId || "",
        chapter: chapter,
        sessionNo: Number(d.sessionNo || 0),
        objectives: objectives,
        activities: d.activities || "",
        completed: d.completed || "Not Started",
        notes: d.notes || "",
      };

      const res = await submitDailyReport(payload);
      
      // Unwrap the response (backend wraps in {status, data, timestamp})
      const result = res.data || res;
      
      if (result && (result.ok || result.submitted)) {
        // mark as submitted
        setStatusMap(m => ({ ...m, [k]: "Submitted" }));
        // clear draft for that row
        setDrafts(prev => {
          const copy = { ...prev };
          delete copy[k];
          return copy;
        });
        setMessage("Report submitted successfully!");
      } else if (result && result.error === 'duplicate') {
        // Already submitted - treat as success
        setStatusMap(m => ({ ...m, [k]: "Submitted" }));
        setMessage(result.message || "Report already submitted for this period");
      } else {
        setMessage("Failed to submit report.");
      }
    } catch (e) {
      console.error(e);
      setMessage("Error submitting report: " + (e.message || e));
    } finally {
      setSaving(s => ({ ...s, [k]: false }));
    }
  }

  async function handleSubmitAll() {
    const notSubmittedRows = rows.filter(r => statusMap[keyOf(r)] !== "Submitted");
    if (!notSubmittedRows.length) {
      setMessage("All reports already submitted.");
      return;
    }
    for (const r of notSubmittedRows) {
      await handleSubmitOne(r);
    }
  }

  const displayDate = date ? formatLocalDate(date) : '';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Daily Reporting</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="daily-report-date" className="text-sm font-medium text-gray-700">Date:</label>
            <input
              id="daily-report-date"
              name="daily-report-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors" 
            onClick={load} 
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button 
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium transition-colors" 
            onClick={async () => {
              try {
                const result = await getTeacherDailyTimetable(stableEmail, date);
                alert(`API Response: ${JSON.stringify(result, null, 2)}`);
              } catch (err) {
                alert(`API Error: ${err.message}`);
              }
            }}
          >
            Test API
          </button>
          {rows.length > 0 && (
            <button 
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
              onClick={handleSubmitAll}
            >
              Submit All
            </button>
          )}
        </div>
      </div>

      {/* Show lesson delays if any */}
      {lessonDelays.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Lesson Progress Delays</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>You have {lessonDelays.length} lesson(s) with completion delays. Consider reviewing your lesson progress.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Instructions */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Quick Daily Reporting Guide:</h3>
            <ul className="text-xs text-blue-800 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="font-bold">📚 Pre-planned:</span>
                <span>Lesson details auto-filled from approved plans - just select completion status!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">⚠️ Unplanned:</span>
                <span>Enter chapter and activities manually, then select completion status.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓ Quick Submit:</span>
                <span>Select completion status, add notes (optional), and submit - that's it!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {displayDate && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">{displayDate}</p>
        </div>
      )}

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.includes('success') 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : message.includes('Error') || message.includes('Failed')
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="ml-3 text-gray-600">Loading timetable...</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">Lesson Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Completion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => {
                  const k = keyOf(r);
                  const submitted = statusMap[k] === "Submitted";
                  const d = drafts[k] || {};
                  const isLoading = saving[k];
                  const isPlanned = d.planType === "in plan" && d.lessonPlanId;
                  const isSubstitution = d._isSubstitution || r.isSubstitution || false;
                  
                  // Row background color based on status - ENHANCED COLORS for better visibility
                  let rowBgClass = "";
                  if (submitted) {
                    rowBgClass = "bg-green-100 border-l-4 border-green-500"; // Green for submitted
                  } else if (isSubstitution) {
                    rowBgClass = "bg-pink-100 border-l-4 border-pink-600"; // Pink/Red for substitution - more distinctive
                  } else if (isPlanned) {
                    rowBgClass = "bg-blue-100 border-l-4 border-blue-500"; // Blue for in-plan
                  } else {
                    rowBgClass = "bg-yellow-100 border-l-4 border-yellow-500"; // Yellow for not-planned
                  }
                  
                  return (
                    <tr key={k} className={rowBgClass}>
                      {/* Period with icons */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          #{r.period}
                          {isPlanned && !isSubstitution && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Pre-planned lesson">
                              📚
                            </span>
                          )}
                          {isSubstitution && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title={`Substitution for ${d._originalTeacher || 'another teacher'}`}>
                              🔄
                            </span>
                          )}
                          {!isPlanned && !isSubstitution && !submitted && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Unplanned period">
                              ⚠️
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {periodToTimeString(r.period, 
                            // Get the right period times based on day: Friday vs weekday
                            new Date(date + 'T00:00:00').getDay() === 5 
                              ? appSettings?.periodTimesFriday 
                              : appSettings?.periodTimesWeekday
                          )}
                        </div>
                        {isSubstitution && d._originalTeacher && (
                          <div className="text-xs text-orange-600 mt-1">For: {d._originalTeacher}</div>
                        )}
                      </td>
                      
                      {/* Class */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{r.class}</td>
                      
                      {/* Subject */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{r.subject}</td>
                      
                      {/* Lesson Details - Read-only info card */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {/* Plan Type Toggle */}
                          <div className="flex gap-2 pb-2 border-b">
                            {PLAN_TYPES.map(type => (
                              <button
                                key={type}
                                type="button"
                                disabled={submitted}
                                onClick={() => setDraft(k, "planType", type)}
                                className={`px-2 py-1 text-xs font-medium rounded border ${
                                  d.planType === type
                                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                          
                          {/* Chapter/Topic - REQUIRED */}
                          <div>
                            <label className="block text-xs font-medium text-red-700 mb-1">
                              Chapter/Topic <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Chapter taught (REQUIRED)"
                              value={d.chapter || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "chapter", e.target.value)}
                              className={`w-full text-xs border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                                !d.chapter?.trim() && !submitted ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                              required
                            />
                          </div>
                          
                          {/* Status badge for planned lessons */}
                          {isPlanned && d.lessonPlanId && (
                            <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                              ✓ Pre-planned {(d._session || d.sessionNo) ? `(Session ${d._session || d.sessionNo})` : ''}
                            </div>
                          )}
                          
                          {/* Objectives - REQUIRED */}
                          <div>
                            <label className="block text-xs font-medium text-red-700 mb-1">
                              Learning Objectives <span className="text-red-600">*</span>
                            </label>
                            <textarea
                              placeholder="Objectives for this session (REQUIRED)"
                              value={d.objectives || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "objectives", e.target.value)}
                              className={`w-full text-xs border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                                !d.objectives?.trim() && !submitted ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                              rows="2"
                              required
                            />
                          </div>
                          
                          {/* Activities - EDITABLE */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Activities Done</label>
                            <textarea
                              placeholder="Teaching activities/methods"
                              value={d.activities || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "activities", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                        </div>
                      </td>
                      
                      {/* Completion Status - REQUIRED FIELD */}
                      <td className="px-4 py-3">
                        <label className="block text-xs font-medium text-red-700 mb-1">
                          Completion <span className="text-red-600">*</span>
                        </label>
                        <select
                          id={`completed-${k}`}
                          name={`completed-${k}`}
                          value={d.completed || "Not Started"}
                          disabled={submitted}
                          onChange={e => setDraft(k, "completed", e.target.value)}
                          className={`w-full text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-medium ${
                            (d.completed === "Not Started" || !d.completed) && !submitted 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-300'
                          }`}
                          required
                        >
                          {COMPLETION.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      
                      {/* Notes - Optional */}
                      <td className="px-4 py-3">
                        <textarea
                          id={`notes-${k}`}
                          name={`notes-${k}`}
                          placeholder="Any additional notes (optional)"
                          disabled={submitted}
                          value={d.notes || ""}
                          onChange={e => setDraft(k, "notes", e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                          rows="2"
                        />
                      </td>
                      
                      {/* Action */}
                      <td className="px-4 py-3">
                        {submitted ? (
                          <span className="inline-flex px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            ✓ Submitted
                          </span>
                        ) : (
                          <button
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
                            onClick={() => handleSubmitOne(r)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : "Submit"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No periods scheduled for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}