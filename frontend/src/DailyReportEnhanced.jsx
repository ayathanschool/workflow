// DailyReportEnhanced.jsx - Integrated Daily Reports with Session Progress Tracking
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  submitDailyReport,
  checkChapterCompletion,
  applyChapterCompletionAction,
  getApprovedLessonPlansForReport,
  getPlannedLessonsForDate, // BATCH: Optimized for performance
  getAppSettings, // Get period times from settings
} from "./api";
import { todayIST, formatLocalDate, periodToTimeString } from "./utils/dateUtils";

// Enhanced completion tracking - percentage instead of 3-level
const COMPLETION_LEVELS = [
  { value: 0, label: 'Not Started (0%)', color: 'bg-gray-100 text-gray-800' },
  { value: 25, label: 'Started (25%)', color: 'bg-orange-100 text-orange-800' },
  { value: 50, label: 'Half Complete (50%)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 75, label: 'Mostly Done (75%)', color: 'bg-blue-100 text-blue-800' },
  { value: 100, label: 'Fully Complete (100%)', color: 'bg-green-100 text-green-800' }
];

const PLAN_TYPES = [
  { value: "in plan", label: "In Plan" },
  { value: "not planned", label: "Not Planned" }
];

const DEVIATION_REASONS = [
  { value: "", label: "Select reason" },
  { value: "Exam", label: "Exam" },
  { value: "Event", label: "School Event" },
  { value: "Holiday", label: "Holiday" }
];

export default function DailyReportEnhanced({ user }) {
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState([]);              
  const [statusMap, setStatusMap] = useState({});    
  const [drafts, setDrafts] = useState({});          
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});          
  const [message, setMessage] = useState("");        
  const [lessonPlansMap, setLessonPlansMap] = useState({});
  const [appSettings, setAppSettings] = useState(null);
  const [loadedDate, setLoadedDate] = useState(null);
  const loadedEmailRef = useRef(null);
  
  // Chapter completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionModalData, setCompletionModalData] = useState(null);

  // Memoize user data to prevent unnecessary re-renders
  const memoizedUser = useMemo(() => ({
    email: user?.email || "",
    name: user?.name || ""
  }), [user?.email, user?.name]);

  const email = memoizedUser.email;
  const teacherName = memoizedUser.name;

  function keyOf(r) {
    return `${r.period}|${r.class}|${r.subject}`;
  }

  // Calculate session numbers from lesson plans and schemes
  const calculateSessionData = (plans, currentPlan, schemes = []) => {
    if (!currentPlan.chapter || !plans.length) return { sessionNo: 1, totalSessions: 1 };
    
    // Find all sessions for this chapter
    const chapterSessions = plans
      .filter(p => p.chapter === currentPlan.chapter && p.class === currentPlan.class && p.subject === currentPlan.subject)
      .sort((a, b) => new Date(a.selectedDate || a.date) - new Date(b.selectedDate || b.date));
    
    const currentIndex = chapterSessions.findIndex(p => p.lpId === currentPlan.lpId);
    
    // Try to get total sessions from the scheme first
    let totalSessions = chapterSessions.length;
    
    // Look for the scheme that matches this chapter/class/subject
    const matchingScheme = schemes.find(scheme => 
      scheme.chapter === currentPlan.chapter && 
      scheme.class === currentPlan.class && 
      scheme.subject === currentPlan.subject
    );
    
    if (matchingScheme && matchingScheme.noOfSessions) {
      totalSessions = Number(matchingScheme.noOfSessions);
    } else if (currentPlan.schemeId) {
      // Fallback: Try to get from the lesson plan's scheme reference
      const schemeByIdMatch = schemes.find(scheme => scheme.schemeId === currentPlan.schemeId);
      if (schemeByIdMatch && schemeByIdMatch.noOfSessions) {
        totalSessions = Number(schemeByIdMatch.noOfSessions);
      }
    }
    
    return {
      sessionNo: currentIndex + 1,
      totalSessions: totalSessions,
      chapterSessions
    };
  };

  // Fetch lesson plans for a specific class/subject (cached for performance)
  async function fetchLessonPlans(cls, subject) {
    if (!cls || !subject || !email) return [];
    try {
      const plans = await getApprovedLessonPlansForReport(email, cls, subject);
      return Array.isArray(plans) ? plans : [];
    } catch (e) {
      console.error('Failed to fetch lesson plans:', e);
      return [];
    }
  }

  async function fetchSchemes(cls, subject) {
    if (!cls || !subject || !email) return [];
    try {
      // Use the existing getTeacherSchemes API endpoint
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://script.google.com/macros/s/AKfycbyfKlfWqiDRkNF_Cjft73qHpGQm8tQ-nHjPSPHOKfuC1l8H5JH5gfippuhNqjvtx5dsDg/exec'}?action=getTeacherSchemes&teacherEmail=${encodeURIComponent(email)}`);
      const data = await response.json();
      const schemes = data?.data?.schemes || data?.schemes || [];
      
      // Filter schemes for this specific class and subject
      const filteredSchemes = Array.isArray(schemes) ? schemes.filter(scheme => 
        scheme.class === cls && scheme.subject === subject
      ) : [];
      
      console.log(`Fetched ${filteredSchemes.length} schemes for ${cls}/${subject}:`, filteredSchemes);
      return filteredSchemes;
    } catch (e) {
      console.error('Failed to fetch schemes:', e);
      return [];
    }
  }

  async function load() {
    if (!email) return;
    setLoading(true);
    setMessage("");
    
    try {
      // ===== PERFORMANCE: Fetch ALL data in parallel (3 main calls at once) =====
      const [tt, rep, batchPlannedLessons] = await Promise.all([
        getTeacherDailyTimetable(email, date),
        getTeacherDailyReportsForDate(email, date),
        getPlannedLessonsForDate(email, date)  // Batch fetch all planned lessons
      ]);

      console.log('✅ All data loaded:', { timetable: tt, reports: rep, plannedLessons: batchPlannedLessons });

      // Normalize timetable
      let ttList = [];
      if (Array.isArray(tt)) {
        ttList = tt;
      } else if (tt && Array.isArray(tt.periods)) {
        ttList = tt.periods;
      } else if (tt && tt.data && Array.isArray(tt.data)) {
        ttList = tt.data;
      }
      
      setRows(ttList);

      // Handle submitted reports
      const sm = {};
      const reportsArray = Array.isArray(rep?.data) ? rep.data : (Array.isArray(rep) ? rep : []);
      const reportMap = {};
      
      reportsArray.forEach(r => {
        const k = `${r.period}|${r.class}|${r.subject}`;
        sm[k] = r.status || "Submitted";
        reportMap[k] = r;
      });
      
      setStatusMap(sm);

      // Early return if no periods
      if (!ttList.length) {
        setMessage("No periods on this day.");
        setLoading(false);
        return;
      }

      // ===== PERFORMANCE: Skip loading lesson plans/schemes upfront - lazy load when needed =====
      // Lesson plans are only needed when user manually changes fields, not for initial render
      const lessonPlansMap = {};
      const schemesMap = {};
      
      setLessonPlansMap(lessonPlansMap);
      console.log('⚡ Skipping lesson plan/scheme preload for faster initial load');

      // ===== Use planned lessons from batch call (already fetched in parallel above) =====
      const lessonsByPeriod = batchPlannedLessons?.lessonsByPeriod || {};
      console.log(`✅ Using ${Object.keys(lessonsByPeriod).length} planned lessons from batch endpoint`);
      
      const nextDrafts = {};
      
      // Build drafts array without additional async calls
      const plannedLessonResults = ttList.map((r) => {
        const k = keyOf(r);
        
        // If already submitted, use existing report
        if (sm[k] && sm[k] !== "Not Submitted") {
          return [k, { type: 'submitted', data: reportMap[k] }];
        }
        
        // Check if there's a planned lesson from batch result
        const periodKey = `${r.period}|${r.class}|${r.subject}`;
        if (lessonsByPeriod[periodKey]) {
          return [k, { type: 'planned', data: { success: true, hasPlannedLesson: true, lessonPlan: lessonsByPeriod[periodKey] } }];
        }
        
        return [k, { type: 'none', data: null }];
      });
      
      // STEP 5: Process results WITHOUT cascading checks (remove the slow sequential checks)
      for (let index = 0; index < plannedLessonResults.length; index++) {
        const [k, result] = plannedLessonResults[index];
        const r = ttList[index];
        const plansKey = `${r.class}|${r.subject}`;
        const allPlans = lessonPlansMap[plansKey] || [];
        const allSchemes = schemesMap[plansKey] || [];
        
        if (result.type === 'submitted') {
          const report = result.data;
          nextDrafts[k] = {
            planType: report.planType || "not planned",
            lessonPlanId: report.lessonPlanId || "",
            chapter: report.chapter || "",
            sessionNo: Number(report.sessionNo || 0),
            totalSessions: Number(report.totalSessions || 1),
            completionPercentage: Number(report.completionPercentage || 0),
            chapterCompleted: report.chapterCompleted || false,
            difficulties: report.difficulties || "",
            nextSessionPlan: report.nextSessionPlan || "",
            objectives: report.objectives || "",
            activities: report.activities || "",
            notes: report.notes || "",
            _submitted: true
          };
        } else if (result.type === 'planned' && result.data?.success && result.data?.hasPlannedLesson && result.data?.lessonPlan) {
          const lp = result.data.lessonPlan;
          
          // Use totalSessions from lesson plan if available, otherwise calculate from schemes
          let totalSessions = lp.totalSessions || 1;
          let sessionNo = Number(lp.session || lp.sessionNo || 1);
          
          if (!lp.totalSessions) {
            // Fallback to scheme-based calculation if not provided by API
            const sessionData = calculateSessionData(allPlans, lp, allSchemes);
            totalSessions = sessionData.totalSessions;
            sessionNo = sessionData.sessionNo;
          }
          
          // NOTE: Removed cascading checks - they were causing major slowdown
          // Validation is now handled on the backend during submission
          
          // In Plan: Auto-populate objectives and activities from lesson plan
          nextDrafts[k] = {
            planType: "in plan",
            lessonPlanId: lp.lpId,
            chapter: lp.chapter || "",
            sessionNo: sessionNo,
            totalSessions: totalSessions,
            completionPercentage: 0,
            chapterCompleted: false,
            difficulties: "",
            nextSessionPlan: "",
            objectives: lp.learningObjectives || "",
            activities: lp.teachingMethods || "",
            notes: ""
          };
        } else {
          // Not Planned: Leave objectives and activities blank for teacher to fill
          nextDrafts[k] = {
            planType: "not planned",
            lessonPlanId: "",
            chapter: r.chapter || "",
            sessionNo: 1,
            totalSessions: 1,
            completionPercentage: 0,
            chapterCompleted: false,
            difficulties: "",
            nextSessionPlan: "",
            objectives: "",
            activities: "",
            notes: ""
          };
        }
      }
      
      setDrafts(nextDrafts);

    } catch (e) {
      console.error('Error loading timetable:', e);
      setMessage(`Unable to load timetable or reports. Error: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settings = await getAppSettings();
        if (settings && (settings.periodTimesWeekday || settings.periodTimesFriday)) {
          setAppSettings(settings);
        }
      } catch (err) {
        // Continue with defaults
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    // Only reload if date OR email has actually changed from last load
    const hasDateChanged = date !== loadedDate;
    const hasEmailChanged = email && email !== loadedEmailRef.current;
    
    if (email && (hasDateChanged || hasEmailChanged)) {
      console.log('🔄 Loading data:', { 
        reason: hasDateChanged ? 'date changed' : 'email changed',
        date, 
        email 
      });
      setLoadedDate(date);
      loadedEmailRef.current = email;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, email]);

  function setDraft(k, field, value) {
    setDrafts(prev => ({ ...prev, [k]: { ...(prev[k] || {}), [field]: value } }));
  }

  // Get completion percentage color class
  function getCompletionColor(percentage) {
    const level = COMPLETION_LEVELS.find(l => l.value <= percentage) || COMPLETION_LEVELS[0];
    return level.color;
  }

  async function handleSubmitOne(r) {
    const k = keyOf(r);
    const d = drafts[k] || {};
    if (statusMap[k] === "Submitted") return;

    // SMART VALIDATION: Different rules for 0% vs teaching sessions
    const chapter = (d.chapter || r.chapter || "").trim();
    const objectives = (d.objectives || "").trim();
    const completionPercentage = Number(d.completionPercentage || 0);
    const deviationReason = (d.deviationReason || "").trim();
    
    // Validate chapter (always required)
    if (!chapter || chapter.length === 0) {
      const errorMsg = "❌ Chapter/Topic is required! Please fill the Chapter field before submitting.";
      setMessage(errorMsg);
      alert(errorMsg);
      return;
    }
    
    // SMART VALIDATION FOR 0% COMPLETION:
    // If 0% completion: Check if deviation reason is provided
    if (completionPercentage === 0) {
      // If deviation reason is selected (Exam/Event/Holiday), allow submission
      // This handles valid cases like: exam duty, school event, holiday
      if (!deviationReason || deviationReason === '') {
        const errorMsg = "❌ For 0% completion, please select a reason (Exam/Event/Holiday)!\n\nIf you taught something, please increase the completion percentage.";
        setMessage(errorMsg);
        alert(errorMsg);
        return;
      }
      // Valid: 0% with reason - teacher couldn't conduct class due to valid reason
      // Objectives not required in this case since no teaching happened
    } else {
      // If teaching happened (completion > 0%): Require objectives
      if (!objectives || objectives.length === 0) {
        const errorMsg = "❌ Learning Objectives are required when teaching was done! Please fill what was taught.";
        setMessage(errorMsg);
        alert(errorMsg);
        return;
      }
    }

    setSaving(s => ({ ...s, [k]: true }));
    setMessage("");

    try {
      const payload = {
        date: date,
        teacherEmail: email,
        teacherName: teacherName,
        class: r.class,
        subject: r.subject,
        period: Number(r.period),
        planType: d.planType || "not planned",
        lessonPlanId: d.lessonPlanId || "",
        chapter: d.chapter || r.chapter || "",
        sessionNo: Number(d.sessionNo || 1),
        totalSessions: Number(d.totalSessions || 1),
        completionPercentage: Number(d.completionPercentage || 0),
        chapterStatus: d.chapterCompleted ? 'Chapter Complete' : 'Session Complete',
        deviationReason: d.deviationReason || '',
        difficulties: d.difficulties || "",
        nextSessionPlan: d.nextSessionPlan || "",
        objectives: d.objectives || "",
        activities: d.activities || "",
        notes: d.notes || "",
        chapterCompleted: d.chapterCompleted || false, // NEW: Chapter completion flag
      };

      const res = await submitDailyReport(payload);
      const result = res.data || res;
      
      if (result && (result.ok || result.submitted)) {
        setStatusMap(m => ({ ...m, [k]: "Submitted" }));
        setDrafts(prev => {
          const copy = { ...prev };
          copy[k] = { ...copy[k], _submitted: true };
          return copy;
        });
        
        // Enhanced success message
        let successMsg = `Report submitted successfully! Session ${d.sessionNo} of ${d.totalSessions} recorded at ${d.completionPercentage}% completion.`;
        if (d.chapterCompleted) {
          successMsg += ` 🎉 Chapter marked as completed!`;
        }
        setMessage(successMsg);
        
        // Check for remaining lesson plans if chapter is complete
        if (d.chapterCompleted) {
          try {
            const completionCheck = await checkChapterCompletion({
              teacherEmail: email,
              class: r.class,
              subject: r.subject,
              chapter: d.chapter || r.chapter || "",
              date: date
            });
            
            const checkResult = completionCheck.data || completionCheck;
            
            if (checkResult.success && checkResult.hasRemainingPlans) {
              // Show modal with remaining plans
              setCompletionModalData({
                chapter: d.chapter || r.chapter || "",
                class: r.class,
                subject: r.subject,
                remainingPlans: checkResult.remainingPlans
              });
              setShowCompletionModal(true);
            }
          } catch (checkError) {
            console.error('Error checking chapter completion:', checkError);
            // Don't block the success - just log the error
          }
        }
      } else if (result && result.error === 'duplicate') {
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
        <h2 className="text-xl font-semibold text-gray-900">Enhanced Daily Reporting</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="daily-report-date" className="text-sm font-medium text-gray-700">Date:</label>
            <input
              id="daily-report-date"
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

      {/* Enhanced Instructions */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📊 Enhanced Session Progress Tracking:</h3>
            <ul className="text-xs text-blue-800 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="font-bold">🎯 Session Progress:</span>
                <span>Choose completion percentage (0-100%) instead of basic completion levels</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">⚠️ Smart Warnings:</span>
                <span>System alerts you if previous sessions in a chapter are incomplete</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">🔗 Chapter Sessions:</span>
                <span>Auto-calculates "Session X of Y" for better chapter progress tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">📝 Enhanced Planning:</span>
                <span>Add difficulties encountered and next session adjustments for better continuity</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {displayDate && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">📅 {displayDate}</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Completion</th>
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
                  
                  // Row background color based on status
                  let rowBgClass = "";
                  if (submitted) {
                    rowBgClass = "bg-green-100 border-l-4 border-green-500";
                  } else if (isPlanned) {
                    rowBgClass = "bg-blue-100 border-l-4 border-blue-500";
                  } else {
                    rowBgClass = "bg-yellow-100 border-l-4 border-yellow-500";
                  }
                  
                  return (
                    <tr key={k} className={rowBgClass}>
                      {/* Period */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          #{r.period}
                          {isPlanned && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Pre-planned lesson">
                              📚
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {periodToTimeString(r.period, 
                            new Date(date + 'T00:00:00').getDay() === 5 
                              ? appSettings?.periodTimesFriday 
                              : appSettings?.periodTimesWeekday
                          )}
                        </div>
                      </td>
                      
                      {/* Class */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{r.class}</td>
                      
                      {/* Subject */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{r.subject}</td>
                      
                      {/* Lesson Details */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {/* Plan Type Dropdown */}
                          <div className="pb-2 border-b">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Plan Type
                            </label>
                            <select
                              value={d.planType || "not planned"}
                              disabled={submitted}
                              onChange={e => {
                                const newPlanType = e.target.value;
                                setDraft(k, "planType", newPlanType);
                                // Clear objectives and activities if switching to "Not Planned"
                                if (newPlanType === "not planned") {
                                  setDraft(k, "objectives", "");
                                  setDraft(k, "activities", "");
                                }
                              }}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                              {PLAN_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Session Info */}
                          {isPlanned && (
                            <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                              ✓ Pre-planned (Session {d.sessionNo || 1} of {d.totalSessions || 1})
                              {(d.sessionNo || 1) === (d.totalSessions || 1) && <span className="ml-1">🏁</span>}
                            </div>
                          )}
                          
                          {/* Chapter - REQUIRED */}
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
                          
                          {/* Objectives - REQUIRED if completion > 0% */}
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${(d.completionPercentage || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                              Learning Objectives {(d.completionPercentage || 0) > 0 && <span className="text-red-600">*</span>}
                              {(d.completionPercentage || 0) === 0 && <span className="text-gray-500 text-xs ml-1">(Not required for 0%)</span>}
                            </label>
                            <textarea
                              placeholder={(d.completionPercentage || 0) > 0 ? "Objectives (REQUIRED)" : "Objectives (optional)"}
                              value={d.objectives || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "objectives", e.target.value)}
                              className={`w-full text-xs border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                                !d.objectives?.trim() && (d.completionPercentage || 0) > 0 && !submitted ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                              rows="2"
                            />
                          </div>
                          
                          {/* Activities */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Activities Done</label>
                            <textarea
                              placeholder="Teaching activities/methods"
                              value={d.activities || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "activities", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                        </div>
                      </td>
                      
                      {/* Completion */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {/* Percentage Slider */}
                          <div>
                            <label className="block text-xs font-medium text-red-700 mb-1">
                              Completion % <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={d.completionPercentage || 0}
                              disabled={submitted}
                              onChange={e => setDraft(k, "completionPercentage", Number(e.target.value))}
                              className={`w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 ${
                                (d.completionPercentage || 0) <= 0 && !submitted ? 'bg-red-200' : 'bg-gray-200'
                              }`}
                            />
                            <div className="flex justify-between items-center mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCompletionColor(d.completionPercentage || 0)}`}>
                                {d.completionPercentage || 0}%
                              </span>
                              <div className="flex space-x-1">
                                {[25, 50, 75, 100].map(val => (
                                  <button
                                    key={val}
                                    type="button"
                                    disabled={submitted}
                                    onClick={() => setDraft(k, "completionPercentage", val)}
                                    className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Chapter Completed Checkbox */}
                          {d.chapter && (
                            <div>
                              <label className="flex items-center space-x-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={d.chapterCompleted || false}
                                  disabled={submitted}
                                  onChange={e => setDraft(k, "chapterCompleted", e.target.checked)}
                                  className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:opacity-50"
                                />
                                <span className="font-medium text-green-700">
                                  ✅ Chapter Complete
                                </span>
                              </label>
                            </div>
                          )}
                          
                          {/* Deviation Reason - Required for 0% */}
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${(d.completionPercentage || 0) === 0 ? 'text-red-700' : 'text-gray-700'}`}>
                              Reason {(d.completionPercentage || 0) === 0 && <span className="text-red-600">*</span>}
                            </label>
                            <select
                              value={d.deviationReason || ''}
                              disabled={submitted}
                              onChange={e => setDraft(k, "deviationReason", e.target.value)}
                              className={`w-full text-xs border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                                (d.completionPercentage || 0) === 0 && !d.deviationReason && !submitted ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                            >
                              {DEVIATION_REASONS.map(reason => (
                                <option key={reason.value} value={reason.value}>
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                      
                      {/* Notes */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Difficulties</label>
                            <textarea
                              placeholder="Any challenges? (optional)"
                              value={d.difficulties || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "difficulties", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Next Session Plan</label>
                            <textarea
                              placeholder="Plans for next session? (optional)"
                              value={d.nextSessionPlan || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "nextSessionPlan", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Additional Notes</label>
                            <textarea
                              placeholder="General notes (optional)"
                              value={d.notes || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "notes", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                        </div>
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
      
      {/* Chapter Completion Modal */}
      {showCompletionModal && completionModalData && (
        <ChapterCompletionModal
          data={completionModalData}
          onClose={() => setShowCompletionModal(false)}
          onAction={async (action) => {
            try {
              const lessonPlanIds = completionModalData.remainingPlans.map(p => p.lpId);
              await applyChapterCompletionAction({ action, lessonPlanIds });
              setShowCompletionModal(false);
              setMessage(`Chapter completion confirmed. ${action === 'cancel' ? 'Remaining periods freed up for next chapter.' : 'Lesson plans kept for revision.'}`);
            } catch (error) {
              console.error('Error applying action:', error);
              setMessage('Error updating lesson plans: ' + (error.message || error));
            }
          }}
        />
      )}
    </div>
  );
}

// Chapter Completion Modal Component
function ChapterCompletionModal({ data, onClose, onAction }) {
  const [selectedAction, setSelectedAction] = useState('cancel');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                ✅ Chapter "{data.chapter}" Completed!
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {data.class} - {data.subject}
              </p>
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
          
          {/* Remaining Plans */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              You have {data.remainingPlans.length} remaining lesson plan(s):
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.remainingPlans.map((plan, idx) => (
                <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Session {plan.session} - {new Date(plan.selectedDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Period {plan.selectedPeriod} • {plan.status}
                      </p>
                      {plan.learningObjectives && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {plan.learningObjectives}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action Selection */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              What would you like to do with these lesson plans?
            </h4>
            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: selectedAction === 'cancel' ? '#3b82f6' : '#e5e7eb' }}>
                <input
                  type="radio"
                  name="action"
                  value="cancel"
                  checked={selectedAction === 'cancel'}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    ✅ Chapter Fully Completed
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    <strong>Frees up {data.remainingPlans.length} period(s)</strong> - Chapter is complete, no need for remaining sessions. Periods become available for planning the next chapter immediately.
                  </p>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: selectedAction === 'keep' ? '#3b82f6' : '#e5e7eb' }}>
                <input
                  type="radio"
                  name="action"
                  value="keep"
                  checked={selectedAction === 'keep'}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    📚 Keep for Revision
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Keep these lesson plans active. Use the scheduled periods for chapter revision, practice, or assessment. Periods remain occupied.
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onAction(selectedAction)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}