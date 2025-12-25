// DailyReportModern.jsx - Redesigned Daily Reporting with Smooth UX
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  submitDailyReport,
  checkChapterCompletion,
  getPlannedLessonsForDate,
  getSubstitutionsForDate,
  getTeacherWeeklyTimetable
} from "./api";
import { todayIST } from "./utils/dateUtils";

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

const CASCADE_OPTIONS = [
  { value: "", label: "Select cascade option" },
  { value: "continue", label: "📌 Continue with existing plan" },
  { value: "cascade", label: "🔄 Reschedule remaining sessions" }
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
  const [cascadePreview, setCascadePreview] = useState({});
  const [cascadeMoves, setCascadeMoves] = useState({});
  const [cascadeLoading, setCascadeLoading] = useState({});
  // Fallback tracking
  const [fallbackInfo, setFallbackInfo] = useState({ used: false, weeklyCount: 0, matchedCount: 0, dayName: '' });
  
  // Chapter completion - inline dropdown approach
  const [remainingSessions, setRemainingSessions] = useState({});
  const [remainingSessionsLoading, setRemainingSessionsLoading] = useState({});
  // Debounce + cooldown to prevent frequent refresh on global re-renders (e.g., theme toggle)
  const lastRemainingFetchAtRef = useRef(0);
  const pendingRemainingFetchRef = useRef(null);
  
  // Prevent infinite reload loops
  const loadingRef = useRef(false);
  const lastErrorRef = useRef(null);
  const errorCountRef = useRef(0);

  const email = user?.email || "";
  const teacherName = user?.name || "";

  const periodKey = (p) => `${p.period}|${p.class}|${p.subject}`;

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
      const [timetableRes, reportsRes, plansRes, subsAll] = await Promise.all([
        getTeacherDailyTimetable(email, date),
        getTeacherDailyReportsForDate(email, date),
        getPlannedLessonsForDate(email, date),
        getSubstitutionsForDate(date, { noCache: true })
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

      // Fallback: if no daily timetable returned, derive periods from weekly timetable structure
      if ((!timetableData || timetableData.length === 0) && email) {
        try {
          console.warn('⚠️ Daily timetable empty. Attempting weekly fallback for', { email, date });
          const weekly = await getTeacherWeeklyTimetable(email);
          const weeklyDays = Array.isArray(weekly?.data) ? weekly.data : (Array.isArray(weekly) ? weekly : []); // expect array of day objects
          if (weeklyDays.length > 0) {
            const dayName = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
            // Find the matching day object, then flatten its periods
            const dayObj = weeklyDays.find(d => {
              const raw = d.dayOfWeek || d.day || d.dayname || d.dayName;
              let dow = String(raw || '').trim();
              if (/^[0-7]$/.test(dow)) {
                const map = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                dow = map[Number(dow)];
              }
              return dow.toLowerCase() === dayName.toLowerCase();
            });
            if (dayObj && Array.isArray(dayObj.periods) && dayObj.periods.length > 0) {
              console.log('✅ Weekly fallback found day periods:', dayObj.periods.length);
              const norm = dayObj.periods.map(p => {
                const periodValRaw = p.period || p.Period || p.periodNumber || p.slot || p.slotNumber || p.index;
                const classValRaw = p.class || p.Class || p.className || p.standard || p.grade || p.Grade || p.Standard;
                const subjectValRaw = p.subject || p.Subject || p.subjectName || p.subj || p.course || p.topic || p.Topic;
                const periodVal = periodValRaw !== undefined && periodValRaw !== '' ? periodValRaw : '1';
                const classVal = classValRaw !== undefined && classValRaw !== '' ? String(classValRaw) : 'UNKNOWN-CLASS';
                const subjectVal = subjectValRaw !== undefined && subjectValRaw !== '' ? String(subjectValRaw) : 'UNKNOWN-SUBJECT';
                return {
                  period: periodVal,
                  class: classVal,
                  subject: subjectVal,
                  startTime: p.startTime || p.begin || p.StartTime || '',
                  endTime: p.endTime || p.finish || p.EndTime || '',
                  isFallback: true,
                  teacherEmail: p.teacherEmail || p.TeacherEmail || email,
                  teacherName: p.teacherName || p.TeacherName || teacherName,
                  _raw: p
                };
              });
              const placeholderCount = norm.filter(x => x.class === 'UNKNOWN-CLASS' || x.subject === 'UNKNOWN-SUBJECT').length;
              if (placeholderCount > 0) {
                console.warn(`⚠️ ${placeholderCount} fallback periods missing class/subject; placeholders applied.`);
              }
              timetableData = norm;
              setFallbackInfo({ used: true, weeklyCount: weeklyDays.length, matchedCount: norm.length, dayName });
            } else {
              console.warn('⚠️ Weekly fallback found matching day but no periods');
              setFallbackInfo({ used: true, weeklyCount: weeklyDays.length, matchedCount: 0, dayName });
            }
          } else {
            console.warn('⚠️ Weekly timetable also empty for teacher');
            setFallbackInfo({ used: true, weeklyCount: 0, matchedCount: 0, dayName: '' });
          }
        } catch (fbErr) {
          console.error('❌ Weekly fallback failed:', fbErr);
          setFallbackInfo({ used: true, weeklyCount: 0, matchedCount: 0, dayName: '' });
        }
      }
      
      const reportsData = Array.isArray(reportsRes?.data) ? reportsRes.data : (Array.isArray(reportsRes) ? reportsRes : []);
      const plansData = plansRes?.data || plansRes || { lessonsByPeriod: {} };

      // Merge substitution assignments for this teacher into periods list
      const mySubs = Array.isArray(subsAll) ? subsAll.filter(s => String(s.substituteTeacher || '').toLowerCase() === String(email).toLowerCase()) : [];
      const subPeriods = mySubs.map(s => ({
        period: s.period,
        class: s.class,
        subject: s.substituteSubject || s.regularSubject || '',
        startTime: '',
        endTime: '',
        isSubstitution: true,
        absentTeacher: s.absentTeacher || '',
        regularSubject: s.regularSubject || '',
        substituteSubject: s.substituteSubject || ''
      }));

      // Avoid duplicates if somehow a timetable entry exists for same key
      const ttKeys = new Set((timetableData || []).map(p => `${p.period}|${p.class}|${p.subject}`));
      const merged = [...timetableData, ...subPeriods.filter(p => !ttKeys.has(`${p.period}|${p.class}|${p.subject}`))];

      setPeriods(merged);
      
      // Map existing reports by period key
      const reportsMap = {};
      if (Array.isArray(reportsData)) {
        reportsData.forEach(report => {
          // Use pipe-delimited key consistent with periodKey()
          const key = `${report.period}|${report.class}|${report.subject}`;
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

  // Legend component
  const LegendBar = () => (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
        <span className="text-sm">Planned</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
        <span className="text-sm">Substitution</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
        <span className="text-sm">Cascaded</span>
      </div>
    </div>
  );

  useEffect(() => {
    if (Object.keys(drafts).length > 0) {
      localStorage.setItem(`dailyReportDrafts_${email}_${date}`, JSON.stringify(drafts));
    }
  }, [drafts, email, date]);

  const updateDraft = useCallback((key, field, value) => {
    let currentDraft = null;
    setDrafts(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value
        }
      };
      currentDraft = updated[key];
      return updated;
    });
    
    // When chapter completed checkbox is toggled ON, fetch remaining sessions
    if (field === 'chapterCompleted' && value === true) {
      const period = periods.find(p => periodKey(p) === key);
      const plan = lessonPlans[key];
      if (period) {
        // Enrich draft with chapter from plan if not already present
        const enrichedDraft = {
          ...currentDraft,
          chapter: (currentDraft?.chapter) || plan?.chapter || period?.chapter || ''
        };
        safeFetchRemainingSessions(key, period, enrichedDraft);
      }
    } else if (field === 'chapterCompleted' && value === false) {
      // Clear remaining sessions when unchecked
      setRemainingSessions(prev => ({ ...prev, [key]: null }));
    }
    
    // When cascade option is selected, fetch preview
    if (field === 'cascadeOption' && value === 'cascade') {
      // Robust plan lookup: direct key, fuzzy by period+class, fallback id fields
      let plan = lessonPlans[key];
      if (!plan) {
        plan = Object.values(lessonPlans).find(lp => {
          const lpPeriod = String(lp.period || lp.selectedPeriod || lp.periodNumber || lp.sessionPeriod || lp.session || '').trim();
          const lpClass = String(lp.class || lp.className || '').trim().toLowerCase();
          const [periodPart, classPart] = key.split('|');
          return lpPeriod === periodPart && lpClass === String(classPart || '').trim().toLowerCase();
        }) || null;
        if (plan && typeof window !== 'undefined' && !window.__SUPPRESS_CASCADE_DEBUG__) {
          console.log('[Cascade/Fuzzy] Preview trigger matched plan via fuzzy lookup:', { key, matchedPlanId: plan.lpId || plan.lessonPlanId || plan.planId || plan.id });
        }
      }
      const planId = plan?.lpId || plan?.lessonPlanId || plan?.planId || plan?.id;
      if (plan && planId) {
        fetchCascadePreview(key, planId);
      } else {
        setCascadePreview(prev => ({ ...prev, [key]: { success: false, sessionsToReschedule: [], error: 'No lesson plan ID found for cascade.' } }));
      }
    }
  }, [lessonPlans]);
  
  const fetchCascadePreview = async (key, lpId) => {
    try {
      setCascadeLoading(prev => ({ ...prev, [key]: true }));
      const base = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_GAS_WEB_APP_URL || import.meta.env.VITE_APP_SCRIPT_URL;
      if (!base) {
        console.error('Missing API base URL for cascade preview');
        setCascadePreview(prev => ({ ...prev, [key]: { success: false, sessionsToReschedule: [], error: 'Missing API base URL (set VITE_API_BASE_URL)' } }));
        return;
      }
      const response = await fetch(`${base}?action=getCascadePreview&lpId=${lpId}&teacherEmail=${email}&originalDate=${date}`);
      const result = await response.json();
      
      console.log('🔍 Cascade API Response:', result);
      
      // Normalize possible response shapes
      const cascadeData = (result?.data && (result.status === 200 || result.success === true)) ? result.data : (result.success && result.sessionsToReschedule ? result : null);
      if (cascadeData && (cascadeData.success || Array.isArray(cascadeData.sessionsToReschedule))) {
        const normalized = {
          success: cascadeData.success !== false,
            sessionsToReschedule: cascadeData.sessionsToReschedule || cascadeData.sessions || [],
            examWarnings: cascadeData.examWarnings || cascadeData.warnings || [],
            updatedCount: cascadeData.updatedCount || (cascadeData.sessionsToReschedule ? cascadeData.sessionsToReschedule.length : 0)
        };
        setCascadePreview(prev => ({ ...prev, [key]: normalized }));
      } else {
        console.error('Cascade preview failed or malformed:', result);
        setCascadePreview(prev => ({ ...prev, [key]: { success: false, sessionsToReschedule: [], error: cascadeData?.error || result?.error || 'Malformed response' } }));
        setMessage({ text: `❌ Cannot calculate cascade: ${cascadeData?.error || result?.error || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching cascade preview:', error);
      setCascadePreview(prev => ({ ...prev, [key]: { success: false, sessionsToReschedule: [], error: error.message || String(error) } }));
      setMessage({ text: '❌ Failed to calculate cascade preview', type: 'error' });
    } finally {
      setCascadeLoading(prev => ({ ...prev, [key]: false }));
    }
  };
  
  const fetchRemainingSessions = useCallback(async (key, period, currentDraft = null) => {
    // Use passed draft if provided (for immediate state), else get from state
    const draft = currentDraft || drafts[key] || {};
    const plan = lessonPlans[key] || null;
    
    console.log('[RemainingSessions] Debug data:', {
      key,
      draftChapter: draft.chapter,
      planChapter: plan?.chapter,
      periodClass: period.class,
      periodSubject: period.subject,
      currentDraft: currentDraft ? 'provided' : 'from state',
      allDraftKeys: Object.keys(draft),
      allPlanKeys: plan ? Object.keys(plan) : 'no plan'
    });
    
    const chapter = draft.chapter || plan?.chapter || '';
    
    if (!chapter) {
      console.log('[RemainingSessions] No chapter available (draft/plan), cannot check. Draft:', draft, 'Plan:', plan);
      // Ensure UI shows a definitive state rather than an empty box
      setRemainingSessions(prev => ({ ...prev, [key]: [] }));
      return;
    }
    
    console.log('[RemainingSessions] Using chapter:', chapter);
    
    setRemainingSessionsLoading(prev => ({ ...prev, [key]: true }));
    try {
      const result = await checkChapterCompletion({
        teacherEmail: email,
        class: period.class,
        subject: period.subject,
        chapter: chapter,
        date: date
      });
      
      console.log('[RemainingSessions] Backend response:', { result, chapter, class: period.class, subject: period.subject });
      
      const checkResult = result.data || result;
      console.log('[RemainingSessions] Processed result:', { 
        success: checkResult.success, 
        hasRemainingPlans: checkResult.hasRemainingPlans, 
        remainingPlans: checkResult.remainingPlans,
        count: checkResult.remainingPlans?.length || 0
      });
      
      if (checkResult.success && checkResult.hasRemainingPlans) {
        const plans = Array.isArray(checkResult.remainingPlans) ? checkResult.remainingPlans : [];
        // Exclude the current session being reported (same date and period)
        const filtered = plans.filter(p => {
          const pDate = p.selectedDate || p.date || p.scheduledDate || p.proposedDate || p.targetDate || p.sessionDate;
          const pPeriod = Number(p.selectedPeriod || p.period || p.scheduledPeriod || p.proposedPeriod || p.targetPeriod || p.sessionPeriod);
          const isSameDate = pDate && String(pDate).slice(0, 10) === String(date);
          const isSamePeriod = Number(period.period) === pPeriod;
          return !(isSameDate && isSamePeriod);
        });
        setRemainingSessions(prev => ({
          ...prev,
          [key]: filtered
        }));
      } else {
        setRemainingSessions(prev => ({ ...prev, [key]: [] }));
      }
    } catch (error) {
      console.error('Error fetching remaining sessions:', error);
      setRemainingSessions(prev => ({ ...prev, [key]: [] }));
    } finally {
      setRemainingSessionsLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [drafts, email, date]);

  const safeFetchRemainingSessions = useCallback((key, period, currentDraft = null) => {
    const now = Date.now();
    const cooldownMs = 2500; // ignore triggers within 2.5s
    const debounceMs = 800; // batch rapid triggers
    if (now - lastRemainingFetchAtRef.current < cooldownMs) {
      return; // suppress frequent refresh
    }
    if (pendingRemainingFetchRef.current) {
      clearTimeout(pendingRemainingFetchRef.current);
    }
    pendingRemainingFetchRef.current = setTimeout(() => {
      lastRemainingFetchAtRef.current = Date.now();
      fetchRemainingSessions(key, period, currentDraft);
    }, debounceMs);
  }, [fetchRemainingSessions]);

  const getDraft = useCallback((key) => drafts[key] || {}, [drafts]);
  const getReport = useCallback((key) => reports[key], [reports]);

  const handleSubmit = async (period) => {
    const key = periodKey(period);
    const draft = getDraft(key);
    const report = getReport(key);
    const plan = lessonPlans[key]; // Get the lesson plan for this period
    
    console.log('🔍 Submit Debug:', { key, draft, plan, chapter: draft.chapter || plan?.chapter });

    if (report) {
      setMessage({ text: "Already submitted", type: "info" });
      return;
    }

    // If substitution period: require only answer box (what done) and skip plan validations
    if (period?.isSubstitution) {
      const whatDone = String((draft.subNotes || draft.objectives || '').trim());
      if (!whatDone) {
        setMessage({ text: '❌ Please describe what you did in this substitution period', type: 'error' });
        return;
      }

      setSubmitting(prev => ({ ...prev, [key]: true }));
      setMessage({ text: '', type: '' });
      try {
        const payload = {
          date,
          teacherEmail: email,
          teacherName,
          class: period.class,
          subject: period.subject,
          period: Number(period.period),
          objectives: whatDone, // store in objectives field
          activities: '',
          completionPercentage: 0,
          isSubstitution: true,
          absentTeacher: period.absentTeacher || '',
          regularSubject: period.regularSubject || '',
          substituteSubject: period.substituteSubject || ''
        };
        const res = await submitDailyReport(payload);
        const result = res?.data || res;
        // Treat success if backend returns ok | submitted | success
        if (result && (result.ok || result.submitted || result.success)) {
          setReports(prev => ({ ...prev, [key]: { ...payload, reportId: result.reportId } }));
          setDrafts(prev => { const n = { ...prev }; delete n[key]; return n; });
          setExpandedPeriod(null);
          const absentInfo = result?.absentCascade;
          if (absentInfo?.attempted && absentInfo?.success) {
            setMessage({ text: `✅ Substitution submitted. Absent teacher plan rescheduled (${absentInfo.updatedCount} session(s)).`, type: 'success' });
          } else {
            setMessage({ text: '✅ Substitution report submitted successfully.', type: 'success' });
          }
        } else {
          const errMsg = result?.message || result?.error || 'Submission failed';
          setMessage({ text: `❌ ${errMsg}`, type: 'error' });
        }
      } catch (e) {
        setMessage({ text: `❌ ${e.message || e}`, type: 'error' });
      } finally {
        setSubmitting(prev => ({ ...prev, [key]: false }));
      }
      return;
    }

    // Validation - check draft first, then fallback to lesson plan (regular periods)
    const chapter = (draft.chapter || plan?.chapter || "").trim();
    const objectives = (draft.objectives || plan?.learningObjectives || "").trim();
    const completionPercentage = Number(draft.completionPercentage || 0);
    const deviationReason = (draft.deviationReason || "").trim();
    const cascadeOption = draft.cascadeOption || "";

    if (!chapter) {
      setMessage({ text: "❌ Chapter/Topic is required", type: "error" });
      return;
    }
    
    // Validate remaining sessions action if chapter completed and has remaining sessions
    if (draft.chapterCompleted && remainingSessions[key] && remainingSessions[key].length > 0 && !draft.remainingSessionsAction) {
      setMessage({ text: "Please choose what to do with remaining sessions", type: "error" });
      setSubmitting(prev => ({ ...prev, [key]: false }));
      return;
    }

    if (completionPercentage === 0 && !deviationReason) {
      setMessage({ text: "❌ For 0% completion, please select a reason", type: "error" });
      return;
    }
    
    // Validate cascade option if lesson plan exists and 0% completion
    // Only require explicit cascade option if auto-cascade is disabled (backend flag) – optimistic assumption via window flag
    const autoCascadeDisabled = window.__AUTO_CASCADE_DISABLED__ === true; // can be set after fetching settings
    if (autoCascadeDisabled && completionPercentage === 0 && plan && !cascadeOption) {
      setMessage({ text: "❌ Select cascade option (Continue or Reschedule)", type: "error" });
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
        lessonPlanId: draft.lessonPlanId || plan?.lpId || "",
        chapter: chapter,
        sessionNo: Number(draft.sessionNo || plan?.session || 1),
        totalSessions: Number(draft.totalSessions || plan?.totalSessions || 1),
        completionPercentage: completionPercentage,
        chapterStatus: draft.chapterCompleted ? 'Chapter Complete' : 'Session Complete',
        deviationReason: deviationReason,
        difficulties: draft.difficulties || "",
        nextSessionPlan: draft.nextSessionPlan || "",
        objectives: objectives,
        activities: draft.activities || "",
        notes: draft.notes || "",
        chapterCompleted: draft.chapterCompleted || false,
        remainingSessionsAction: draft.chapterCompleted && draft.remainingSessionsAction ? draft.remainingSessionsAction : null,
        remainingSessions: draft.chapterCompleted && remainingSessions[key] ? remainingSessions[key].map(s => s.lpId) : [],
        completionRationale: draft.completionRationale || ''
      };

      console.log('📝 SUBMITTING DAILY REPORT:', payload);
      const res = await submitDailyReport(payload);
      console.log('📥 DAILY REPORT RESPONSE:', res);
      
      const result = res.data || res;
      console.log('📦 UNWRAPPED RESULT:', result);

      // Success criteria broadened to include 'success' flag from backend
      if (result && (result.ok || result.submitted || result.success)) {
        console.log('✅ Daily report submitted successfully');
        // Handle auto-cascade feedback (backend may have moved sessions automatically)
        const autoCascade = result.autoCascade || result.data?.autoCascade || null;
        if (autoCascade && autoCascade.attempted && cascadeOption !== 'cascade') {
          if (autoCascade.success) {
            setMessage({ text: `✅ Report submitted. Auto-cascade rescheduled ${autoCascade.updatedCount} session(s).`, type: 'success' });
          } else if (autoCascade.reason === 'auto_disabled') {
            setMessage({ text: 'ℹ️ Report submitted. Auto-cascade disabled. You can manually choose Reschedule.', type: 'info' });
          } else if (autoCascade.reason === 'completion_not_zero_or_missing_lpId') {
            // Do nothing: normal non-zero completion path
          } else {
            setMessage({ text: `⚠️ Report submitted. Cascade not applied (${autoCascade.reason || autoCascade.error || 'Unknown reason'}).`, type: 'warning' });
          }
        }
        
        // Execute cascade if option was selected
        if (cascadeOption === 'cascade' && cascadePreview[key]) {
          console.log('🔄 Executing cascade...');
          try {
            const cascadePayload = {
              currentLpId: plan.lpId,
              sessionsToUpdate: cascadePreview[key].sessionsToReschedule,
              dailyReportContext: {
                date,
                teacherEmail: email,
                class: period.class,
                subject: period.subject,
                period: Number(period.period)
              }
            };
            const baseExec = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_GAS_WEB_APP_URL || import.meta.env.VITE_APP_SCRIPT_URL;
            if (!baseExec) throw new Error('Missing API base URL for cascade execution (set VITE_API_BASE_URL)');
            const cascadeRes = await fetch(`${baseExec}?action=executeCascade`, {
              method: 'POST',
              body: JSON.stringify(cascadePayload)
            });
            const cascadeData = await cascadeRes.json();
            if (cascadeData.status === 200 && cascadeData.data.success) {
              console.log('✅ Cascade executed successfully');
              // Record moved target for this specific period to show banner
              try {
                const moved = (cascadePreview[key]?.sessionsToReschedule || []).find(s => s.lpId === plan.lpId);
                if (moved) {
                  setCascadeMoves(prev => ({
                    ...prev,
                    [key]: { date: moved.proposedDate, period: moved.proposedPeriod }
                  }));
                }
              } catch {}
              // Refresh planned lessons for the day so UI reflects moved sessions
              try {
                const refreshed = await getPlannedLessonsForDate(email, date);
                const lessonsByPeriod = refreshed?.data?.lessonsByPeriod || refreshed?.lessonsByPeriod || {};
                setLessonPlans(lessonsByPeriod);
                console.log('🔄 Lesson plans refreshed after cascade');
              } catch (e) {
                console.warn('⚠️ Failed to refresh lesson plans after cascade', e);
              }
              setMessage({ text: `✅ Report submitted and ${cascadeData.data.updatedCount} sessions rescheduled!`, type: "success" });
            } else {
              console.error('Cascade failed:', cascadeData);
              setMessage({ text: `⚠️ Report submitted but cascade failed: ${cascadeData.data.error}`, type: "warning" });
            }
          } catch (cascadeError) {
            console.error('Cascade error:', cascadeError);
            setMessage({ text: '⚠️ Report submitted but cascade failed', type: "warning" });
          }
        }
        
        // Update reports map WITHOUT reloading entire page
        setReports(prev => ({
          ...prev,
          [key]: { ...payload, reportId: result.reportId }
        }));

        // Clear draft and cascade preview
        setDrafts(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[key];
          return newDrafts;
        });
        
        setCascadePreview(prev => {
          const newPreview = { ...prev };
          delete newPreview[key];
          return newPreview;
        });

        // Collapse this period and expand next
        const currentIndex = periods.findIndex(p => periodKey(p) === key);
        const nextPeriod = periods[currentIndex + 1];
        if (nextPeriod && !getReport(periodKey(nextPeriod))) {
          setExpandedPeriod(periodKey(nextPeriod));
        } else {
          setExpandedPeriod(null);
        }

        // Clear remaining sessions state after successful submit
        setRemainingSessions(prev => ({ ...prev, [key]: null }));
        
        setMessage({ 
          text: draft.chapterCompleted && draft.remainingSessionsAction
            ? `✅ Period ${period.period} submitted! ${draft.remainingSessionsAction === 'cancel' ? 'Remaining sessions cancelled.' : 'Sessions kept for revision.'}`
            : `✅ Period ${period.period} submitted successfully!`, 
          type: "success" 
        });

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
          {/* Legend */}
          <div className="mt-4">
            <LegendBar />
          </div>
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
            {fallbackInfo.used && (
              <div className="mt-4 inline-block text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded">
                Fallback attempted • Weekly entries: {fallbackInfo.weeklyCount} • Matched day ({fallbackInfo.dayName || 'N/A'}): {fallbackInfo.matchedCount}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Period Cards */}
      {!loading && periods.length > 0 && (() => {
        const renderable = periods.filter(p => p && p.period && p.class && p.subject);
        if (renderable.length === 0) {
          return (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl shadow p-8 text-center border border-amber-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Timetable Loaded – Missing Fields</h3>
                <p className="text-sm text-gray-600 mb-3">Entries were received but lacked required fields (period/class/subject). Please verify timetable sheet column names.</p>
                {fallbackInfo.used && (
                  <p className="text-xs text-gray-500">Fallback weekly matched: {fallbackInfo.matchedCount} • Normalized after filter: 0</p>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="max-w-5xl mx-auto space-y-4">
            {renderable.map((period) => {
              const key = periodKey(period);
              const report = getReport(key);
              const draft = getDraft(key);
              const isExpanded = expandedPeriod === key;
              const isSubmitted = !!report;
              const isSubmitting = submitting[key] || false;
              const planKey = `${period.period}|${period.class}|${period.subject}`;
              // Attempt direct key lookup first
              let plan = lessonPlans[planKey] || null;
              // Fuzzy fallback: match by period + class if exact subject key not found (subject naming variations)
              if (!plan) {
                const fuzzy = Object.values(lessonPlans).find(lp => {
                  const lpPeriod = String(lp.period || lp.selectedPeriod || lp.periodNumber || lp.sessionPeriod || '').trim();
                  const lpClass = String(lp.class || lp.className || '').trim();
                  return lpPeriod === String(period.period).trim() && lpClass.toLowerCase() === String(period.class).trim().toLowerCase();
                });
                if (fuzzy) {
                  plan = fuzzy;
                  // Optional lightweight debug (dev only)
                  if (typeof window !== 'undefined' && !window.__SUPPRESS_CASCADE_DEBUG__) {
                    console.log('[Cascade/Fuzzy] Matched lesson plan via period+class fallback:', {
                      period: period.period,
                      class: period.class,
                      subjectOriginal: period.subject,
                      planSubject: fuzzy.subject || fuzzy.chapter || '(none)'
                    });
                  }
                }
              }
              const completionLevel = getCompletionLevel(isSubmitted ? (report.completionPercentage || 0) : (draft.completionPercentage || 0));
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
                  cascadePreview={cascadePreview[key]}
                  cascadeLoading={!!cascadeLoading[key]}
                  cascadeMoves={cascadeMoves}
                  periodKey={key}
                  remainingSessions={remainingSessions}
                  remainingSessionsLoading={remainingSessionsLoading}
                  onToggle={() => setExpandedPeriod(isExpanded ? null : key)}
                  onUpdate={(field, value) => updateDraft(key, field, value)}
                  onSubmit={() => handleSubmit(period)}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Chapter completion modal removed - now handled inline */}
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
  cascadePreview = null,
  cascadeLoading = false,
  cascadeMoves = {},
  periodKey = '',
  remainingSessions = {},
  remainingSessionsLoading = {},
  onToggle, 
  onUpdate, 
  onSubmit 
}) {
  const data = isSubmitted ? (report || {}) : (draft || {});
  const chapter = data.chapter || plan?.chapter || "";
  const objectives = data.objectives || plan?.learningObjectives || "";
  const teachingMethods = data.activities || plan?.teachingMethods || "";
  const _resources = data.resources || plan?.resourcesRequired || "";
  const sessionNo = data.sessionNo || plan?.sessionNo || 1;
  const totalSessions = data.totalSessions || plan?.totalSessions || 1;
  const completionPercentage = data.completionPercentage || 0;
  const isSub = !!period.isSubstitution;

  return (
    <div className={`bg-white rounded-xl shadow-md transition-all duration-300 ${
      isExpanded ? 'shadow-xl' : 'hover:shadow-lg'
    }`}>
      {/* Card Header */}
      <div
        className={`p-6 cursor-pointer ${isSubmitted ? 'bg-green-50' : (isSub ? 'bg-amber-50' : 'hover:bg-gray-50')} rounded-t-xl transition-colors`}
        onClick={!isSubmitted ? onToggle : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
              isSubmitted ? 'bg-green-100 text-green-700' : (isSub ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')
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
            <div className={`px-4 py-2 rounded-full border-2 flex items-center gap-2 ${isSub ? 'bg-amber-50 border-amber-300' : completionLevel.color}`}>
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
              isSub ? (
                <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full font-medium text-sm">
                  Substitution
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
              )
            )}
          </div>
        </div>
      </div>

      {/* Expanded Form */}
      {isExpanded && !isSubmitted && (
        <div className="p-6 border-t border-gray-100 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Substitution banner */}
          {isSub && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="font-medium text-amber-900">Substitution period – lesson plan not required</div>
              {period.absentTeacher && (
                <div className="text-sm text-amber-700 mt-1">Absent Teacher: {period.absentTeacher} • Regular Subject: {period.regularSubject || '-'}</div>
              )}
            </div>
          )}

          {/* Show lesson plan details if available and not substitution */}
          {!isSub && plan ? (
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
          ) : (!isSub && (
            <div className={`rounded-lg p-4 border ${cascadeMoves[periodKey] ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{cascadeMoves[periodKey] ? 'ℹ️' : '⚠️'}</div>
                <div className="flex-1">
                  {cascadeMoves[periodKey] ? (
                    <>
                      <div className="font-medium text-blue-900">Plan moved due to cascade</div>
                      <div className="text-sm text-blue-700 mt-1">
                        New schedule: {cascadeMoves[periodKey].date} • P{cascadeMoves[periodKey].period}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-red-900">No Lesson Plan Found</div>
                      <div className="text-sm text-red-700 mt-1">Please prepare and submit a lesson plan for approval before teaching this period.</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Substitution simplified form */}
          {isSub ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What did you do in this period? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={data.subNotes || data.objectives || ''}
                onChange={(e) => { onUpdate('subNotes', e.target.value); onUpdate('objectives', e.target.value); }}
                placeholder="Briefly describe the activities/coverage during substitution"
                rows={4}
                className="w-full px-4 py-2 border border-amber-300 bg-amber-50 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
            </div>
          ) : (
          /* Chapter & Session */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapter / Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={chapter}
                readOnly
                disabled={true}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder={plan ? "From lesson plan" : "No planned chapter – prepare a lesson plan"}
                className={`w-full px-4 py-2 border rounded-lg bg-gray-100 ${
                  plan ? 'border-blue-300' : 'border-red-300'
                }`}
              />
              {!plan && (
                <p className="mt-1 text-xs text-red-600">No planned chapter found for this period. Please prepare a lesson plan first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Number
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={sessionNo}
                  onChange={(e) => onUpdate('sessionNo', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  min="1"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="py-2 text-gray-500">of</span>
                <input
                  type="number"
                  value={totalSessions}
                  onChange={(e) => onUpdate('totalSessions', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  min="1"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          )}

          {/* Learning Objectives */}
          {!isSub && plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives (from Lesson Plan) 
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                value={objectives}
                onChange={(e) => onUpdate('objectives', e.target.value)}
                placeholder="Learning objectives from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Teaching Methods/Activities */}
          {!isSub && plan && plan.teachingMethods && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teaching Methods (from Lesson Plan)
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                value={teachingMethods}
                onChange={(e) => onUpdate('activities', e.target.value)}
                placeholder="Teaching methods from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Completion Percentage */}
          {!isSub && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Session Completion level <span className="text-red-500">*</span>
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
          )}

          {/* Deviation Reason (only for 0%) */}
          {!isSub && completionPercentage === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for 0% Completion <span className="text-red-500">*</span>
                </label>
                <select
                  value={data.deviationReason || ""}
                  onChange={(e) => onUpdate('deviationReason', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DEVIATION_REASONS.map(reason => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>

              {/* Cascade Option (only when lesson plan exists and reason is selected) */}
              {plan && data.deviationReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lesson Plan Action <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={data.cascadeOption || ""}
                    onChange={(e) => onUpdate('cascadeOption', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {CASCADE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-600">
                    {data.cascadeOption === 'continue' && '📌 Remaining sessions will keep their original dates'}
                    {data.cascadeOption === 'cascade' && '🔄 All remaining sessions will be rescheduled to next available periods'}
                  </p>
                  {data.cascadeOption === 'cascade' && cascadeLoading && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                      <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></span>
                      Generating cascade preview...
                    </div>
                  )}
                </div>
              )}

              {/* Cascade Preview */}
              {data.cascadeOption === 'cascade' && cascadePreview && !cascadeLoading && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">🔄</span>
                    Cascade Preview: {cascadePreview.sessionsToReschedule?.length || 0} Sessions
                  </h4>
                  {(cascadePreview.sessionsToReschedule?.length || 0) === 0 && (
                    <div className="text-sm text-blue-700 mb-2">
                      {cascadePreview.message || cascadePreview.error || 'No eligible sessions were found to reschedule.'}
                    </div>
                  )}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cascadePreview.sessionsToReschedule?.map((session, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-blue-200">
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-gray-900">Session {session.sessionNo}</div>
                          <div className="text-sm text-gray-600">
                            {session.currentDate} P{session.currentPeriod} → {session.proposedDate} P{session.proposedPeriod}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {session.dayName} • {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                  {cascadePreview.examWarnings?.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                      <div className="font-semibold text-orange-900 mb-2">⚠️ Exam Warnings</div>
                      {cascadePreview.examWarnings.map((warn, idx) => (
                        <div key={idx} className="text-sm text-orange-800">{warn.warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Learning Objectives - show for all cases when completion > 0 */}
          {!isSub && completionPercentage > 0 && !plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives <span className="text-red-500">*</span>
              </label>
              <textarea
                value={objectives}
                onChange={(e) => onUpdate('objectives', e.target.value)}
                placeholder="What learning objectives were covered?"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Activities - show for all cases when completion > 0 */}
          {!isSub && completionPercentage > 0 && !plan && (
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

          {/* Chapter Completion with Inline Dropdown */}
          {!isSub && completionPercentage === 100 && (
            <div className="space-y-3">
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
              
              {/* Remaining Sessions Decision */}
              {data.chapterCompleted && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
                  {remainingSessionsLoading[periodKey] ? (
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <span>Checking remaining sessions...</span>
                    </div>
                  ) : remainingSessions[periodKey] && remainingSessions[periodKey].length > 0 ? (
                    <>
                      <div className="text-sm font-medium text-blue-900">
                        📋 {remainingSessions[periodKey].length} remaining session(s) found
                      </div>
                      
                      {/* Preview of remaining sessions */}
                      <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                        {remainingSessions[periodKey].map((session, idx) => (
                          <div key={idx} className="text-xs bg-white p-2 rounded border border-blue-200 flex justify-between items-center">
                            <span className="font-medium">Session {session.sessionNo || session.session}</span>
                            <span className="text-gray-600">{session.selectedDate || session.date} • Period {session.selectedPeriod || session.period}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Action dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-2">
                          What to do with remaining sessions? <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={data.remainingSessionsAction || ''}
                          onChange={(e) => onUpdate('remainingSessionsAction', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">-- Choose Action --</option>
                          <option value="cancel">❌ Cancel All Remaining Sessions</option>
                          <option value="keep_revision">📚 Keep for Revision</option>
                        </select>
                      </div>
                      
                      {/* Optional rationale */}
                      <div>
                        <label className="block text-xs text-blue-700 mb-1">
                          Reason (optional)
                        </label>
                        <input
                          type="text"
                          value={data.completionRationale || ''}
                          onChange={(e) => onUpdate('completionRationale', e.target.value)}
                          placeholder="Why completed early?"
                          className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </>
                  ) : remainingSessions[periodKey] && remainingSessions[periodKey].length === 0 ? (
                    <div className="text-sm text-green-700 flex items-center gap-2">
                      <span>✅</span>
                      <span>No remaining sessions to manage</span>
                    </div>
                  ) : null}
                </div>
              )}
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
function _ChapterCompletionModal({ data, onClose, onAction }) {
  const [selectedAction, setSelectedAction] = useState('cancel');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async () => {
    if (!selectedAction || data.loading || isProcessing) {
      return;
    }
    
    setIsProcessing(true);
    try {
      await onAction(selectedAction);
      // onAction handler will close modal on success
    } catch (error) {
      console.error('Action error:', error);
      setIsProcessing(false);
    }
  };

  // Sync default selection to recommended action when modal first loads finished
  useEffect(() => {
    if (!data.loading && data.recommendedAction) {
      setSelectedAction(data.recommendedAction);
    }
  }, [data.loading, data.recommendedAction]);

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
              disabled={data.loading || isProcessing}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Chapter Info & Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:col-span-1">
              <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Completed Chapter</div>
              <div className="font-semibold text-gray-900 truncate" title={data.chapter}>{data.chapter}</div>
              <div className="text-sm text-gray-600 mt-1">{data.class} • {data.subject}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-center">
              <div className="text-xs text-gray-500">Remaining Sessions</div>
              <div className="text-lg font-bold text-gray-900">{data.loading ? '…' : data.remainingPlans.length}</div>
              {(!data.loading && data.remainingPlans.length > 0) && (
                <div className="mt-1 text-xs text-gray-500">Earliest: {data.earliestDate || '-'} • Latest: {data.latestDate || '-'}</div>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-center">
              <div className="text-xs text-gray-500">Recommended Action</div>
              <div className="text-lg font-bold {data.recommendedAction === 'cancel' ? 'text-green-600' : 'text-blue-600'}">
                {data.loading ? 'Analyzing…' : (data.recommendedAction === 'cancel' ? 'Cancel & Free Periods' : 'Keep for Revision')}
              </div>
              {!data.loading && (
                <div className="mt-1 text-xs text-gray-500">
                  {data.recommendedAction === 'cancel' ? `${data.periodsFreed} period(s) will open for next chapter` : 'Retain planned slots for reinforcement'}
                </div>
              )}
            </div>
          </div>

          {/* Remaining Plans */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              {data.loading ? 'Checking remaining planned sessions…' : `Remaining Planned Sessions (${data.remainingPlans.length})`}
            </h4>
            {data.loading ? (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span>Analyzing scheduled sessions…</span>
              </div>
            ) : (
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
            )}
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <label className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-green-50 ${selectedAction === 'cancel' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200'}`}>
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
                {data.recommendedAction === 'cancel' && !data.loading && (
                  <div className="mt-2 inline-flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    Recommended
                  </div>
                )}
              </div>
            </label>

            <label className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-blue-50 ${selectedAction === 'keep' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200'}`}>
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
                {data.recommendedAction === 'keep' && !data.loading && (
                  <div className="mt-2 inline-flex items-center text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    Recommended
                  </div>
                )}
              </div>
            </label>
            <div className="text-xs text-gray-400 mt-2">You can revisit cancelled periods during next planning cycle.</div>
          </div>
        </div>
        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleAction}
            disabled={isProcessing || data.loading}
            className={`px-8 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedAction === 'cancel' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Processing...</span>
              </>
            ) : data.loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>{selectedAction === 'cancel' ? 'Confirm Cancellation' : 'Confirm Keep'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
