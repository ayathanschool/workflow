// DailyReportEnhanced.jsx - Integrated Daily Reports with Session Progress Tracking
import React, { useEffect, useState, useMemo } from "react";
import {
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  submitDailyReport,
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
  "in plan",
  "not planned",
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

  // Memoize email to prevent unnecessary re-renders
  const email = useMemo(() => user?.email || "", [user?.email]);
  const teacherName = useMemo(() => user?.name || "", [user?.name]);

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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://script.google.com/macros/s/AKfycbw1bZdFJ-RuED-6feux3F24qapAXHimMVwcPcR3AoTB5rPprHLNWxflWyEND6YJ6TN-Pw/exec'}?action=getTeacherSchemes&teacherEmail=${encodeURIComponent(email)}`);
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

  // Prevent unnecessary reloads - only reload when date or email actually changes
  useEffect(() => { 
    if (email) {
      load(); 
    }
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

    // Validation
    const hasBasicContent = d.completionPercentage > 0 || 
                           (d.objectives && d.objectives.trim()) ||
                           (d.activities && d.activities.trim()) ||
                           (d.notes && d.notes.trim());
    
    if (!hasBasicContent) {
      setMessage("Please select completion percentage or fill in some lesson details before submitting.");
      return;
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
        if (d.chapterCompleted && (d.sessionNo || 1) === (d.totalSessions || 1)) {
          successMsg += ` 🎉 Chapter marked as completed - you can now prepare lesson plans for the next chapter!`;
        }
        setMessage(successMsg);
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">Chapter & Session</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Session Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Difficulties & Planning</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => {
                  const k = keyOf(r);
                  const submitted = statusMap[k] === "Submitted";
                  const d = drafts[k] || {};
                  const isLoading = saving[k];
                  const isPlanned = d.planType === "in plan" && d.lessonPlanId;
                  
                  return (
                    <tr key={k} className={submitted ? "bg-green-50" : isPlanned ? "bg-blue-50" : "bg-yellow-50"}>
                      {/* Period */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{r.period}
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
                      
                      {/* Chapter & Session Progress */}
                      <td className="px-4 py-3">
                        <div className="space-y-3">
                          {/* Chapter */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Chapter/Topic</label>
                            {isPlanned && d.chapter ? (
                              <div className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1">
                                📖 {d.chapter}
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Enter chapter/topic taught"
                                value={d.chapter || ""}
                                disabled={submitted}
                                onChange={e => setDraft(k, "chapter", e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            )}
                          </div>
                          
                          {/* Session Number */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                              📚 Session {d.sessionNo || 1} of {d.totalSessions || 1}
                            </span>
                            {isPlanned && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                ✓ Pre-planned
                              </span>
                            )}
                            {/* Last session indicator */}
                            {(d.sessionNo || 1) === (d.totalSessions || 1) && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                                🏁 Final Session
                              </span>
                            )}
                          </div>
                          
                          {/* Objectives & Activities (condensed) */}
                          {(d.objectives || d.activities) && (
                            <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
                              {d.objectives && (
                                <div className="mb-1">
                                  <span className="font-medium">Objectives:</span> {d.objectives}
                                </div>
                              )}
                              {d.activities && (
                                <div>
                                  <span className="font-medium">Activities:</span> {d.activities}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Session Progress Slider */}
                      <td className="px-4 py-3">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">Session Completion</label>
                            <div className="space-y-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={d.completionPercentage || 0}
                                disabled={submitted}
                                onChange={e => setDraft(k, "completionPercentage", Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                              />
                              <div className="flex justify-between items-center">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCompletionColor(d.completionPercentage || 0)}`}>
                                  {d.completionPercentage || 0}%
                                </span>
                                <div className="flex space-x-1">
                                  {[25, 50, 75, 100].map(val => (
                                    <button
                                      key={val}
                                      type="button"
                                      disabled={submitted}
                                      onClick={() => setDraft(k, "completionPercentage", val)}
                                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                                    >
                                      {val}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Chapter Completed checkbox - show for ANY session with a chapter */}
                          {d.chapter && (
                            <div>
                              <label className="flex items-center space-x-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={d.chapterCompleted || false}
                                  disabled={submitted}
                                  onChange={e => setDraft(k, "chapterCompleted", e.target.checked)}
                                  className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:opacity-50"
                                />
                                <span className="font-medium text-green-700">
                                  ✅ Chapter Fully Completed
                                  {(d.sessionNo || 1) > (d.totalSessions || 1) && <span className="text-orange-600 ml-1">(Extended)</span>}
                                  {(d.sessionNo || 1) < (d.totalSessions || 1) && <span className="text-blue-600 ml-1">(Early Completion)</span>}
                                </span>
                              </label>
                              <p className="text-xs text-gray-500 mt-1 ml-5">
                                Check this if the entire chapter is finished{(d.sessionNo || 1) < (d.totalSessions || 1) ? '. This will skip remaining planned sessions.' : '. This allows preparation of the next chapter\'s lesson plans.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Difficulties & Next Session Planning */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Difficulties Encountered</label>
                            <textarea
                              placeholder="Any challenges? (optional)"
                              value={d.difficulties || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "difficulties", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              rows="2"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Next Session Adjustments</label>
                            <textarea
                              placeholder="Plans for next session? (optional)"
                              value={d.nextSessionPlan || ""}
                              disabled={submitted}
                              onChange={e => setDraft(k, "nextSessionPlan", e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
    </div>
  );
}