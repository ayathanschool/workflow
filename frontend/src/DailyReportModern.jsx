// DailyReportModern.jsx - Redesigned Daily Reporting with Smooth UX
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
	getTeacherDailyData,
  getTeacherDailyTimetable,
  getTeacherDailyReportsForDate,
  getDailyReports,
  submitDailyReport,
  checkChapterCompletion,
  getPlannedLessonsForDate,
  getTeacherWeeklyTimetable,
  getSuggestedPlansForSubstitution,
  getFirstUnreportedSession,
  deleteDailyReport
} from "./api";
import { todayIST } from "./utils/dateUtils";
import { confirmDestructive } from "./utils/confirm";

// Session completion is now binary: Yes (complete) or No (incomplete)
// Backend maps: true → 100%, false → 0%

const DEVIATION_REASONS = [
  { value: "", label: "Select reason for incomplete session" },
  { value: "Exam", label: "📝 Exam / Assessment" },
  { value: "Event", label: "🎉 School Event" },
  { value: "Holiday", label: "🏖️ Holiday / No Class" },
  { value: "Other", label: "📋 Other (specify in notes)" }
];

// Removed: Complex cascade options replaced with simple Yes/No session completion

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
  const [firstUnreportedSession, setFirstUnreportedSession] = useState({});
  // Substitution: optional lesson plan suggestions (manual selection)
  // Stored per periodKey: { nextPlan, pullbackPreview }
  const [suggestedSubPlans, setSuggestedSubPlans] = useState({});
  const [suggestedSubPlansLoading, setSuggestedSubPlansLoading] = useState({});
  // Fallback tracking
  const [fallbackInfo, setFallbackInfo] = useState({ used: false, weeklyCount: 0, matchedCount: 0, dayName: '' });
  
  // Chapter completion - inline dropdown approach
  const [remainingSessions, setRemainingSessions] = useState({});
  const [remainingSessionsLoading, setRemainingSessionsLoading] = useState({});
  // Debounce + cooldown to prevent frequent refresh on global re-renders (e.g., theme toggle)
  const lastRemainingFetchAtRef = useRef(0);
  const pendingRemainingFetchRef = useRef(null);

  // Preview of already reported sessions per chapter
  const [reportedChapterSessions, setReportedChapterSessions] = useState({});
  const [reportedChapterSessionsLoading, setReportedChapterSessionsLoading] = useState({});
  
  // Prevent infinite reload loops
  const loadingRef = useRef(false);
  const lastErrorRef = useRef(null);
  const errorCountRef = useRef(0);
  const draftsSaveTimeoutRef = useRef(null);

  const email = user?.email || "";
  const teacherName = user?.name || "";

  const debug = typeof window !== 'undefined' && !!window.__DEBUG_DAILY_REPORT__;

  const normalizeText = useCallback((v) => {
    return String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, '');
  }, []);

  const normalizePeriod = useCallback((v) => {
    const s = String(v ?? '').trim();
    const m = s.match(/(\d+)/);
    return m ? m[1] : s;
  }, []);

  const getChapterKey = useCallback((cls, subject, chapter, schemeId) => {
    const c = normalizeText(cls);
    const s = normalizeText(subject);
    const ch = normalizeText(chapter);
    const sid = String(schemeId || '').trim();
    if (!c || !s || !ch) return '';
    return sid ? `${c}|${s}|${ch}|${sid}` : `${c}|${s}|${ch}`;
  }, [normalizeText]);

  // Build a normalized index so "Ready" lesson plans match even if timetable strings vary.
  const lessonPlansIndex = useMemo(() => {
    const idx = new Map();
    const values = Object.values(lessonPlans || {});
    values.forEach((lp) => {
      const p = normalizePeriod(lp?.selectedPeriod || lp?.period || lp?.periodNumber || lp?.sessionPeriod || lp?.session);
      const cls = normalizeText(lp?.class || lp?.className);
      const subj = normalizeText(lp?.subject || lp?.subjectName || lp?.subj);
      if (p && cls && subj) {
        const k = `${p}|${cls}|${subj}`;
        if (!idx.has(k)) idx.set(k, lp);
      }
      if (p && cls) {
        const k2 = `${p}|${cls}`;
        if (!idx.has(k2)) idx.set(k2, lp);
      }
    });
    return idx;
  }, [lessonPlans, normalizePeriod, normalizeText]);

  const periodKey = (p) => `${String(p.period || '')}|${p.class}|${p.subject}`;

  // Load suggested Ready plans for a substitution period (optional picker)
  useEffect(() => {
    if (!expandedPeriod) return;
    if (!Array.isArray(periods) || periods.length === 0) return;
    if (!email) return;

    const p = periods.find(x => periodKey(x) === expandedPeriod);
    if (!p || !p.isSubstitution) return;

    // Avoid refetch if already loaded (even if empty array)
    if (Object.prototype.hasOwnProperty.call(suggestedSubPlans, expandedPeriod)) return;
    if (suggestedSubPlansLoading[expandedPeriod]) return;

    const cls = String(p.class || '').trim();
    const subject = String(p.substituteSubject || p.subject || '').trim();
    const chapterHint = String(p.chapter || '').trim();
    const schemeHint = String(p.schemeId || '').trim();
    if (!cls || !subject) {
      setSuggestedSubPlans(prev => ({ ...prev, [expandedPeriod]: [] }));
      return;
    }

    (async () => {
      setSuggestedSubPlansLoading(prev => ({ ...prev, [expandedPeriod]: true }));
      try {
        const res = await getSuggestedPlansForSubstitution(email, cls, subject, date, p.period, {
          chapter: chapterHint,
          schemeId: schemeHint,
          noCache: true
        });
        const payload = res?.data || res;
        const plans = Array.isArray(payload?.plans) ? payload.plans : (Array.isArray(payload) ? payload : []);
        const nextPlan = payload?.nextPlan || plans[0] || null;
        const pullbackPreview = Array.isArray(payload?.pullbackPreview) ? payload.pullbackPreview : [];
        const expectedSession = payload?.expectedSession || null;
        setSuggestedSubPlans(prev => ({ ...prev, [expandedPeriod]: { nextPlan, pullbackPreview, expectedSession } }));
      } catch (_e) {
        setSuggestedSubPlans(prev => ({ ...prev, [expandedPeriod]: { nextPlan: null, pullbackPreview: [] } }));
      } finally {
        setSuggestedSubPlansLoading(prev => ({ ...prev, [expandedPeriod]: false }));
      }
    })();
  }, [expandedPeriod, periods, email, date, suggestedSubPlans, suggestedSubPlansLoading]);

  const loadData = useCallback(async () => {
    if (!email || !date) {
      if (debug) console.log('❌ Cannot load - missing email or date');
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      if (debug) console.log('⏭️ Load already in progress, skipping');
      return;
    }
    
    // Stop retrying if we've had repeated failures
    if (errorCountRef.current >= 2 && lastErrorRef.current) {
      if (debug) console.log('⏭️ Too many errors, stopping retry');
      return;
    }
    
    if (debug) console.log('🔄 Loading data for:', { email, date });
    loadingRef.current = true;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // FAST PATH (1 request): use the batch endpoint (timetable + reports) when available.
      // Fallback to legacy endpoints if the deployment doesn't have it yet.
      let timetableRes, reportsRes, plansRes;
      try {
        const [daily, planned] = await Promise.all([
          getTeacherDailyData(email, date),
          getPlannedLessonsForDate(email, date)
        ]);
        timetableRes = daily?.timetableWithReports || daily?.timetable || daily;
        reportsRes = { data: Array.isArray(daily?.reports) ? daily.reports : [] };
        plansRes = planned;
      } catch (batchErr) {
        // Legacy (3 requests)
        [timetableRes, reportsRes, plansRes] = await Promise.all([
          getTeacherDailyTimetable(email, date),
          getTeacherDailyReportsForDate(email, date),
          getPlannedLessonsForDate(email, date)
        ]);
      }

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
          if (debug) console.warn('⚠️ Daily timetable empty. Attempting weekly fallback for', { email, date });
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
              if (debug) console.log('✅ Weekly fallback found day periods:', dayObj.periods.length);
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
                if (debug) console.warn(`⚠️ ${placeholderCount} fallback periods missing class/subject; placeholders applied.`);
              }
              timetableData = norm;
              setFallbackInfo({ used: true, weeklyCount: weeklyDays.length, matchedCount: norm.length, dayName });
            } else {
              if (debug) console.warn('⚠️ Weekly fallback found matching day but no periods');
              setFallbackInfo({ used: true, weeklyCount: weeklyDays.length, matchedCount: 0, dayName });
            }
          } else {
            if (debug) console.warn('⚠️ Weekly timetable also empty for teacher');
            setFallbackInfo({ used: true, weeklyCount: 0, matchedCount: 0, dayName: '' });
          }
        } catch (fbErr) {
          console.error('❌ Weekly fallback failed:', fbErr);
          setFallbackInfo({ used: true, weeklyCount: 0, matchedCount: 0, dayName: '' });
        }
      }
      
      const reportsData = Array.isArray(reportsRes?.data) ? reportsRes.data : (Array.isArray(reportsRes) ? reportsRes : []);
      const plansData = plansRes?.data || plansRes || { lessonsByPeriod: {} };

      // Timetable already includes substitution periods (backend merges them)
      setPeriods(timetableData);
      
      // Map existing reports by period key
      const reportsMap = {};
      if (Array.isArray(reportsData)) {
        reportsData.forEach(report => {
          // Use pipe-delimited key consistent with periodKey()
          // Normalize period to string to match timetable entries
          const key = `${String(report.period || '')}|${report.class}|${report.subject}`;
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
    if (!email || !date) return;
    // Debounce to avoid firing multiple requests when the user quickly changes dates
    const t = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(t);
  }, [loadData, email, date]);
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
      if (draftsSaveTimeoutRef.current) {
        clearTimeout(draftsSaveTimeoutRef.current);
      }
      draftsSaveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(`dailyReportDrafts_${email}_${date}`, JSON.stringify(drafts));
        } catch (e) {
          // ignore quota/storage errors
        }
      }, 300);
    }
    return () => {
      if (draftsSaveTimeoutRef.current) {
        clearTimeout(draftsSaveTimeoutRef.current);
      }
    };
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
      // For substitution in-plan mode, lessonPlans[key] may be null; fall back to selected lessonPlanId from draft.
      const fallbackPlanId = String((currentDraft && currentDraft.lessonPlanId) || (drafts[key] && drafts[key].lessonPlanId) || '').trim();
      const resolvedPlanId = planId || fallbackPlanId;
      if (resolvedPlanId) {
        fetchCascadePreview(key, resolvedPlanId);
      } else {
        setCascadePreview(prev => ({ ...prev, [key]: { success: false, sessionsToReschedule: [], error: 'No lesson plan ID found for cascade.' } }));
      }
    }
    // Fetch preview for continue_same option
    if (field === 'cascadeOption' && value === 'continue_same') {
      // Continue same session preview removed - now using sequential session enforcement
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
      let token = '';
      try {
        const s = JSON.parse(localStorage.getItem('sf_google_session') || '{}');
        token = s?.idToken ? String(s.idToken) : '';
      } catch {}
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const response = await fetch(`${base}?action=getCascadePreview&lpId=${lpId}&teacherEmail=${email}&originalDate=${date}${tokenParam}`);
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

  const fetchReportedSessions = useCallback(async (cls, subject, chapter, schemeId) => {
    const chapterKey = getChapterKey(cls, subject, chapter, schemeId);
    if (!chapterKey) return;
    if (!email) return;
    if (Object.prototype.hasOwnProperty.call(reportedChapterSessions, chapterKey)) return;
    if (reportedChapterSessionsLoading[chapterKey]) return;

    setReportedChapterSessionsLoading(prev => ({ ...prev, [chapterKey]: true }));
    try {
      const result = await getDailyReports({ teacher: email, cls, subject, chapter, schemeId });
      const data = Array.isArray(result) ? result : [];
      const clsNorm = normalizeText(cls);
      const subjNorm = normalizeText(subject);
      const chNorm = normalizeText(chapter);
      const schemeNorm = String(schemeId || '').trim();
      let filtered = data.filter(r => {
        if (!r) return false;
        const rClass = normalizeText(r.class);
        const rSubj = normalizeText(r.subject);
        const rChap = normalizeText(r.chapter);
        if (rClass !== clsNorm) return false;
        const subjMatch = rSubj === subjNorm || rSubj.includes(subjNorm) || subjNorm.includes(rSubj);
        const chapMatch = rChap === chNorm || rChap.includes(chNorm) || chNorm.includes(rChap);
        return subjMatch && chapMatch;
      });
      if (schemeNorm) {
        filtered = filtered.filter(r => String(r.schemeId || '').trim() === schemeNorm);
      }

      const sorted = filtered.slice().sort((a, b) => {
        const aSession = Number(a.sessionNo || 0);
        const bSession = Number(b.sessionNo || 0);
        if (aSession && bSession && aSession !== bSession) return aSession - bSession;
        const aDate = String(a.date || '');
        const bDate = String(b.date || '');
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return Number(a.period || 0) - Number(b.period || 0);
      });

      setReportedChapterSessions(prev => ({ ...prev, [chapterKey]: sorted }));
    } catch (error) {
      console.error('Error fetching reported sessions preview:', error);
      setReportedChapterSessions(prev => ({ ...prev, [chapterKey]: [] }));
    } finally {
      setReportedChapterSessionsLoading(prev => ({ ...prev, [chapterKey]: false }));
    }
  }, [email, getChapterKey, normalizeText, reportedChapterSessions, reportedChapterSessionsLoading]);

  useEffect(() => {
    if (!expandedPeriod || periods.length === 0) return;
    const period = periods.find(p => periodKey(p) === expandedPeriod);
    if (!period) return;
    const draft = drafts[expandedPeriod] || {};
    const report = reports[expandedPeriod] || null;
    const plan = lessonPlans[expandedPeriod] || null;
    const subject = period.substituteSubject || period.subject || '';
    const chapter = String(draft.chapter || report?.chapter || plan?.chapter || '').trim();
    const schemeId = String(report?.schemeId || plan?.schemeId || '').trim();
    if (!chapter || !subject || !period.class) return;
    fetchReportedSessions(period.class, subject, chapter, schemeId);
  }, [expandedPeriod, periods, drafts, reports, lessonPlans, fetchReportedSessions]);
  
  const fetchRemainingSessions = useCallback(async (key, period, currentDraft = null) => {
    // Use passed draft if provided (for immediate state), else get from state
    const draft = currentDraft || drafts[key] || {};
    const plan = lessonPlans[key] || null;
    const report = reports[key] || null;
    
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
    
    const chapter = draft.chapter || plan?.chapter || report?.chapter || '';
    const schemeId = String(draft.schemeId || report?.schemeId || plan?.schemeId || '').trim();
    
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
        schemeId: schemeId,
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
      const lessonPlanId = String((draft.lessonPlanId || '').trim());
      const whatDone = String((draft.subNotes || draft.objectives || '').trim());
      const inPlan = !!lessonPlanId;

      if (!lessonPlanId && !whatDone) {
        setMessage({ text: '❌ Please describe what you did, or select a ready lesson plan for this substitution period', type: 'error' });
        return;
      }

      // If teacher attached a Ready plan for this substitution period, allow full planned-report options
      // (chapter completion + remaining sessions action + cascade preview/decision).
      const chapter = String((draft.chapter || '')).trim();
      const sessionComplete = draft.sessionComplete === true;
      const deviationReason = String((draft.deviationReason || '')).trim();
      if (inPlan) {
        if (!chapter) {
          setMessage({ text: '❌ Chapter/Topic is required (select a plan)', type: 'error' });
          return;
        }
        if (draft.chapterCompleted && remainingSessions[key] && remainingSessions[key].length > 0 && !draft.remainingSessionsAction) {
          setMessage({ text: 'Please choose what to do with remaining sessions', type: 'error' });
          return;
        }
        if (!sessionComplete && !deviationReason) {
          setMessage({ text: '❌ For 0% completion, please select a reason', type: 'error' });
          return;
        }
      }

      setSubmitting(prev => ({ ...prev, [key]: true }));
      setMessage({ text: '', type: '' });
      try {
        const taughtSubject = period.substituteSubject || period.subject;
        const sessionNo = inPlan ? Number(draft.sessionNo || 0) : 0;
        const totalSessions = inPlan ? Number(draft.totalSessions || 0) : 0;
        const payload = {
          date,
          teacherEmail: email,
          teacherName,
          class: period.class,
          subject: taughtSubject,
          period: Number(period.period),
          lessonPlanId: lessonPlanId || '',
          // If a lesson plan is attached, send edited fields if present; backend can still auto-fill missing ones.
          chapter: inPlan ? String(draft.chapter || '') : String(draft.chapter || ''),
          // Optional notes go into activities so objectives can come from plan.
          objectives: inPlan ? String(draft.objectives || '') : whatDone,
          activities: inPlan ? String(draft.activities || whatDone || '') : '',
          sessionComplete: sessionComplete,
          sessionNo: isNaN(sessionNo) ? 0 : sessionNo,
          totalSessions: isNaN(totalSessions) ? 0 : totalSessions,
          deviationReason: inPlan ? String(draft.deviationReason || '') : '',
          cascadeOption: inPlan ? (draft.cascadeOption || '') : '',
          difficulties: inPlan ? (draft.difficulties || '') : '',
          nextSessionPlan: inPlan ? (draft.nextSessionPlan || '') : '',
          notes: inPlan ? (draft.notes || '') : (draft.subNotes || ''),
          chapterCompleted: inPlan ? (draft.chapterCompleted || false) : false,
          remainingSessionsAction: (inPlan && draft.chapterCompleted && draft.remainingSessionsAction) ? draft.remainingSessionsAction : null,
          remainingSessions: (inPlan && draft.chapterCompleted && remainingSessions[key]) ? remainingSessions[key].map(s => s.lpId) : [],
          completionRationale: inPlan ? (draft.completionRationale || '') : '',
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
          const cascade = result?.cascade || {};
          const absentInfo = cascade?.absent;
          const pullback = cascade?.substitutePullback;
          if (pullback?.attempted && pullback?.success && pullback?.updatedCount) {
            setMessage({ text: `✅ Substitution submitted. Your future lesson plans were pulled back (${pullback.updatedCount} plan(s) updated).`, type: 'success' });
          } else if (absentInfo?.attempted && absentInfo?.success) {
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

    // Simplified validation - session complete Yes/No
    const chapter = (draft.chapter || plan?.chapter || "").trim();
    const objectives = (draft.objectives || plan?.learningObjectives || "").trim();
    // Standardized: use only sessionComplete boolean
    const sessionComplete = draft.sessionComplete === true;
    const wantsReschedule = draft.wantsReschedule === true || String(draft.cascadeOption || '').trim() === 'cascade';

    if (!chapter) {
      setMessage({ text: "❌ Chapter/Topic is required", type: "error" });
      return;
    }

    // Substitution strict sequence: if a plan is selected, ensure it matches expected session.
    if (period.isSubstitution && draft.lessonPlanId) {
      const subData = suggestedSubPlans[key] || null;
      const expectedSession = subData && subData.expectedSession ? Number(subData.expectedSession) : null;
      const selectedPlan = subData && subData.nextPlan ? subData.nextPlan : null;
      if (expectedSession && selectedPlan && Number(selectedPlan.sessionNo || 0) !== expectedSession) {
        // Auto-clear mismatched plan to avoid invalid submission under strict sequencing.
        onUpdate('lessonPlanId', '');
        setMessage({
          text: `❌ Session ${expectedSession} must be reported first. The selected plan was Session ${selectedPlan.sessionNo}, so it has been cleared.`,
          type: "error"
        });
        return;
      }
    }

    if (sessionComplete && !objectives) {
      setMessage({ text: "❌ Learning Objectives required when session is complete", type: "error" });
      return;
    }

    if (!sessionComplete && !String(draft.deviationReason || '').trim()) {
      setMessage({ text: "❌ Please select reason for incomplete session", type: "error" });
      return;
    }

    if (sessionComplete && draft.chapterCompleted && remainingSessions[key] && remainingSessions[key].length > 0 && !draft.remainingSessionsAction) {
      setMessage({ text: "❌ Please choose what to do with remaining sessions", type: "error" });
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
        totalSessions: Number(draft.totalSessions || plan?.totalSessions || plan?.noOfSessions || 1),
        // Send only sessionComplete boolean
        sessionComplete: sessionComplete,
        deviationReason: String(draft.deviationReason || ''),
        chapterCompleted: !!draft.chapterCompleted,
        remainingSessionsAction: draft.remainingSessionsAction || null,
        remainingSessions: (draft.chapterCompleted && remainingSessions[key]) ? remainingSessions[key].map(s => s.lpId) : [],
        completionRationale: String(draft.completionRationale || ''),
        cascadeOption: (!sessionComplete && wantsReschedule) ? 'cascade' : '',
        objectives: objectives,
        activities: draft.activities || "",
        notes: draft.notes || ""
      };

      console.log('📝 SUBMITTING DAILY REPORT:', payload);
      const res = await submitDailyReport(payload);
      console.log('📥 DAILY REPORT RESPONSE:', res);
      
      const result = res.data || res;
      console.log('📦 UNWRAPPED RESULT:', result);

      // Success criteria broadened to include 'success' flag from backend
      if (result && (result.ok || result.submitted || result.success)) {
        console.log('✅ Daily report submitted successfully');
        // Handle cascade feedback
        const cascade = result.cascade || result.data?.cascade || {};
        const appliedType = cascade.appliedType;
        
        // Show appropriate message based on which cascade was applied
        if (appliedType === 'auto' && cascade.auto?.success) {
          setMessage({ text: `✅ Report submitted. Auto-cascade rescheduled ${cascade.auto.updatedCount} session(s).`, type: 'success' });
        } else if (appliedType === 'manual' && cascade.manual?.success) {
          setMessage({ text: `✅ Report submitted. Sessions rescheduled (${cascade.manual.updatedCount} session(s) updated).`, type: 'success' });
        } else if (!appliedType && cascade.auto && !cascade.auto.attempted) {
          // Auto-cascade disabled, no special message needed
        } else {
          // Default success message
          setMessage({ text: '✅ Report submitted successfully.', type: 'success' });
        }
        
        // Execute cascade if requested for incomplete session
        if (!sessionComplete && wantsReschedule && cascadePreview[key]) {
          console.log('🔄 Executing cascade...');
          try {
            const sessionsToUpdate = cascadePreview[key].sessionsToReschedule || [];

            const ok = confirmDestructive({
              title: 'Reschedule remaining sessions?',
              lines: [
                `This will move ${sessionsToUpdate.length} session(s) to future dates.`,
                `Class: ${period.class || '-'}`,
                `Subject: ${period.subject || '-'}`,
                `Period: ${Number(period.period) || '-'}`,
                `Date: ${date || '-'}`
              ]
            });

            if (!ok) {
              setMessage({ text: 'ℹ️ Report submitted. Reschedule cancelled.', type: 'info' });
              // Skip executeCascade
              return;
            }

            const cascadePayload = {
              currentLpId: plan.lpId,
              sessionsToUpdate: sessionsToUpdate,
              dailyReportContext: {
                date,
                teacherEmail: email,
                class: period.class,
                subject: period.subject,
                period: Number(period.period)
              }
            };
            try {
              const s = JSON.parse(localStorage.getItem('sf_google_session') || '{}');
              const token = s?.idToken ? String(s.idToken) : '';
              if (token) cascadePayload.token = token;
            } catch {}
            const baseExec = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_GAS_WEB_APP_URL || import.meta.env.VITE_APP_SCRIPT_URL;
            if (!baseExec) throw new Error('Missing API base URL for cascade execution (set VITE_API_BASE_URL)');
            const cascadeRes = await fetch(`${baseExec}?action=executeCascade`, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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

        // CRITICAL: Invalidate frontend caches so data refreshes properly
        try {
          // Import the cache manager to clear cached data
          const { cacheManager } = await import('./utils/cacheManager.js');
          // Clear caches for this teacher/date so next fetch gets fresh data
          cacheManager.deletePattern(`teacher_.*_${date}`);
          cacheManager.deletePattern(`daily_timetable_${date}`);
          console.log('✅ Frontend caches invalidated after submission');
        } catch (cacheErr) {
          console.warn('⚠️ Cache invalidation failed:', cacheErr);
        }

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

  const handleDeleteReport = async (period) => {
    const key = periodKey(period);
    const report = getReport(key);
    
    // Support both 'id' and 'reportId' fields
    const reportId = report?.id || report?.reportId;
    
    if (!report || !reportId) {
      setMessage({ text: "❌ No report found to delete", type: "error" });
      console.error('Delete failed - report data:', report);
      return;
    }

    const confirmed = confirmDestructive({
      title: 'Delete this report?',
      lines: [
        `Class: ${period.class}`,
        `Subject: ${period.subject}`,
        `Period: ${period.period}`,
        `Date: ${date}`,
        '',
        'This action cannot be undone.'
      ]
    });

    if (!confirmed) return;

    setSubmitting(prev => ({ ...prev, [key]: true }));
    setMessage({ text: "", type: "" });

    try {
      const res = await deleteDailyReport(reportId, email);
      const result = res?.data || res;

      if (result && (result.ok || result.success)) {
        // Remove report from state
        setReports(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        // Keep the period expanded in draft mode for immediate re-submission
        setExpandedPeriod(key);
        setMessage({ text: '✅ Report deleted successfully. You can now edit and submit again.', type: 'success' });
        // Clear any submission state
        setSubmitting(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      } else {
        setMessage({ text: `❌ ${result?.message || result?.error || 'Delete failed'}`, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: `❌ ${e.message || e}`, type: 'error' });
    } finally {
      setSubmitting(prev => ({ ...prev, [key]: false }));
    }
  };

  const getSessionCompleteLabel = (isComplete) => {
    // Display binary completion status
    return isComplete ? '✅ Complete' : '⭕ Incomplete';
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
              const planKey = `${String(period.period || '')}|${period.class}|${period.subject}`;
              // Attempt direct key lookup first
              let plan = lessonPlans[planKey] || null;
              // Fallback: some backends key lesson plans by uniqueKey: teacherEmail|YYYY-MM-DD|period
              if (!plan) {
                const uk = `${String(email || '').trim().toLowerCase()}|${String(date || '').trim()}|${normalizePeriod(period.period)}`;
                plan = lessonPlans[uk] || null;
              }
              // Normalized lookup: handles case/spacing/prefix differences in timetable strings
              if (!plan) {
                const pNorm = normalizePeriod(period.period);
                const clsNorm = normalizeText(period.class);
                const subjNorm = normalizeText(period.subject);
                plan =
                  lessonPlansIndex.get(`${pNorm}|${clsNorm}|${subjNorm}`) ||
                  lessonPlansIndex.get(`${pNorm}|${clsNorm}`) ||
                  null;
              }
              const completionLabel = getSessionCompleteLabel(
                isSubmitted 
                  ? (report.completionPercentage === 100 || report.sessionComplete === true)
                  : (draft.sessionComplete === true)
              );
              return (
                <PeriodCard
                  key={key}
                  teacherEmail={email}
                  period={period}
                  isExpanded={isExpanded}
                  isSubmitted={isSubmitted}
                  isSubmitting={isSubmitting}
                  completionLabel={completionLabel}
                  draft={draft}
                  report={report}
                  plan={plan}
                  reportingDate={date}
                  reportedChapterSessions={(() => {
                    const subject = period.substituteSubject || period.subject || '';
                    const chapter = String((isSubmitted ? report?.chapter : (draft.chapter || plan?.chapter || '')) || '').trim();
                    const schemeId = String(report?.schemeId || plan?.schemeId || '').trim();
                    const key = getChapterKey(period.class, subject, chapter, schemeId);
                    return key ? reportedChapterSessions[key] : null;
                  })()}
                  reportedChapterSessionsLoading={(() => {
                    const subject = period.substituteSubject || period.subject || '';
                    const chapter = String((isSubmitted ? report?.chapter : (draft.chapter || plan?.chapter || '')) || '').trim();
                    const schemeId = String(report?.schemeId || plan?.schemeId || '').trim();
                    const key = getChapterKey(period.class, subject, chapter, schemeId);
                    return key ? !!reportedChapterSessionsLoading[key] : false;
                  })()}
                  substitutionPlanData={suggestedSubPlans[key] || { nextPlan: null, pullbackPreview: [] }}
                  substitutionPlansLoading={!!suggestedSubPlansLoading[key]}
                  cascadePreview={cascadePreview[key]}
                  cascadeLoading={!!cascadeLoading[key]}
                  cascadeMoves={cascadeMoves}
                  periodKey={key}
                  remainingSessions={remainingSessions}
                  remainingSessionsLoading={remainingSessionsLoading}
                  onToggle={() => setExpandedPeriod(isExpanded ? null : key)}
                  onUpdate={(field, value) => updateDraft(key, field, value)}
                  onSubmit={() => handleSubmit(period)}
                  onDelete={() => handleDeleteReport(period)}
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
  teacherEmail = '',
  period, 
  isExpanded, 
  isSubmitted, 
  isSubmitting,
  completionLabel, 
  draft = {}, 
  report = null, 
  plan = null,
  reportingDate = '',
  reportedChapterSessions = null,
  reportedChapterSessionsLoading = false,
  substitutionPlanData = { nextPlan: null, pullbackPreview: [] },
  substitutionPlansLoading = false,
  cascadePreview = null,
  cascadeLoading = false,
  cascadeMoves = {},
  periodKey = '',
  remainingSessions = {},
  remainingSessionsLoading = {},
  onToggle, 
  onUpdate, 
  onSubmit,
  onDelete
}) {
  const data = isSubmitted ? (report || {}) : (draft || {});
  const chapter = data.chapter || plan?.chapter || "";
  const objectives = data.objectives || plan?.learningObjectives || "";
  const teachingMethods = data.activities || plan?.teachingMethods || "";
  const _resources = data.resources || plan?.resourcesRequired || "";
  const sessionNo = data.sessionNo || plan?.sessionNo || plan?.session || 1;
  const totalSessions = data.totalSessions || plan?.totalSessions || plan?.noOfSessions || 1;
  const sessionComplete = data.sessionComplete === true || data.completionPercentage === 100;
  const isSub = !!period.isSubstitution;
  const selectedSubPlanId = String(data.lessonPlanId || '').trim();
  const nextPlan = substitutionPlanData && substitutionPlanData.nextPlan ? substitutionPlanData.nextPlan : null;
  const pullbackPreview = substitutionPlanData && Array.isArray(substitutionPlanData.pullbackPreview) ? substitutionPlanData.pullbackPreview : [];
  const expectedSession = substitutionPlanData && substitutionPlanData.expectedSession ? Number(substitutionPlanData.expectedSession) : null;
  const selectedSubPlan = isSub && selectedSubPlanId && nextPlan && String(nextPlan.lpId || '').trim() === selectedSubPlanId ? nextPlan : null;
  const inPlanMode = isSub && !!selectedSubPlanId;
  const effectivePlan = (isSub && selectedSubPlan) ? selectedSubPlan : plan;
  const showPlannedFields = !isSub || inPlanMode;
  const allowPlanActions = !isSub || (inPlanMode && !!effectivePlan);

  const previewSubject = period.substituteSubject || period.subject || '';
  const previewSchemeId = String(report?.schemeId || effectivePlan?.schemeId || plan?.schemeId || '').trim();
  const previewList = Array.isArray(reportedChapterSessions) ? reportedChapterSessions : [];
  const filteredPreviewList = previewList.filter(r => {
    if (!r) return false;
    if (!isSubmitted && reportingDate) {
      const rDate = String(r.date || '').slice(0, 10);
      const rPeriod = Number(r.period || 0);
      if (rDate === String(reportingDate) && rPeriod === Number(period.period)) return false;
    }
    return true;
  });
  const formatPreviewDate = (value) => {
    if (!value) return '-';
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Preserve cascaded context even after reporting.
  // Sources:
  // - cascadeMoves[periodKey]: periods moved in this UI session
  // - plan.status: persisted lesson-plan status like 'cascaded' / 'Rescheduled (Cascade)'
  // - report notes: sometimes includes 'Cascade:' marker
  const planStatus = String((plan && plan.status) || '').toLowerCase();
  const notesText = String((data && (data.notes || data.completed || '')) || '').toLowerCase();
  const isCascaded = !!(cascadeMoves && cascadeMoves[periodKey]) ||
    planStatus.includes('cascad') ||
    planStatus.includes('rescheduled') ||
    notesText.includes('cascade:') ||
    notesText.includes('cascad');

  // When selecting "In plan", prefill the reporting draft from the plan (still editable where allowed)
  const handleSubPlanSelect = async (value) => {
    onUpdate('lessonPlanId', value);
    if (!value) return;
    if (!nextPlan) return;
    const id = String(nextPlan.lpId || '').trim();
    if (id && String(value).trim() === id) {
      if (nextPlan.chapter) onUpdate('chapter', String(nextPlan.chapter));
      if (nextPlan.totalSessions) onUpdate('totalSessions', Number(nextPlan.totalSessions));
      if (nextPlan.learningObjectives) onUpdate('objectives', String(nextPlan.learningObjectives));
      if (nextPlan.teachingMethods) onUpdate('activities', String(nextPlan.teachingMethods));
      if (data.sessionComplete === undefined) onUpdate('sessionComplete', false);
      
      // Fetch first unreported session for sequential enforcement
      const email = String(teacherEmail || '').trim();
      if (email && nextPlan.chapter && nextPlan.totalSessions && period?.class && period?.subject) {
        try {
          const result = await getFirstUnreportedSession(
            email,
            period.class,
            period.subject,
            nextPlan.chapter,
            nextPlan.totalSessions,
            nextPlan.schemeId
          );
          const payload = result?.data || result || {};
          const firstUnreported = payload?.firstUnreportedSession || payload?.session;
          if (payload?.success && firstUnreported) {
            onUpdate('sessionNo', Number(firstUnreported));
          } else if (nextPlan.sessionNo) {
            // Fallback to plan's session number if API fails
            onUpdate('sessionNo', Number(nextPlan.sessionNo));
          }
        } catch (error) {
          console.error('Failed to fetch first unreported session:', error);
          // Fallback to plan's session number
          if (nextPlan.sessionNo) onUpdate('sessionNo', Number(nextPlan.sessionNo));
        }
      } else if (nextPlan.sessionNo) {
        onUpdate('sessionNo', Number(nextPlan.sessionNo));
      }
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-md transition-all duration-300 ${
      isExpanded ? 'shadow-xl' : 'hover:shadow-lg'
    } ${isCascaded ? 'border-l-4 border-blue-400' : ''}`}>
      {/* Card Header */}
      <div
        className={`p-6 cursor-pointer ${isSubmitted ? 'bg-green-50' : (isSub ? 'bg-amber-50' : 'hover:bg-gray-50')} rounded-t-xl transition-colors`}
        onClick={onToggle}
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
            <div className={`px-4 py-2 rounded-full border-2 flex items-center gap-2 ${isSub ? 'bg-amber-50 border-amber-300' : (sessionComplete ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500')}`}>
              <span className="text-sm font-medium">{completionLabel}</span>
            </div>

            {/* Status Badge */}
            {isSubmitted ? (
              <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-medium text-sm flex items-center gap-2">
                <span>✓</span>
                <span>Submitted</span>
              </div>
            ) : isSub ? (
              <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full font-medium text-sm">
                Substitution
              </div>
            ) : null}

            {/* Cascaded Badge (show even after submission) */}
            {isCascaded && (
              <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium text-sm flex items-center gap-2 border border-blue-200">
                <span>↻</span>
                <span>Cascaded</span>
              </div>
            )}

            {/* Expand/Collapse */}
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Form */}
      {isExpanded && (
        <div className="p-6 border-t border-gray-100 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {isSubmitted ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Submitted report (read-only)</div>
                  <div className="text-xs text-gray-500 mt-1">You can view details here, but editing is disabled after submission.</div>
                </div>
                {report?.createdAt ? (
                  <div className="text-xs text-gray-500">Submitted: {String(report.createdAt)}</div>
                ) : null}
              </div>

              {chapter && previewSubject && period.class && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Reported sessions preview</div>
                      <div className="text-xs text-slate-600 mt-1">
                        {chapter} • {previewSubject} • {period.class}
                        {previewSchemeId ? ` • Scheme ${previewSchemeId}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">Reported: {filteredPreviewList.length}</div>
                  </div>
                  {reportedChapterSessionsLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
                      <span>Loading reported sessions...</span>
                    </div>
                  ) : filteredPreviewList.length > 0 ? (
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-2">
                      {filteredPreviewList.map(r => (
                        <div
                          key={r.reportId || r.id || `${r.date || 'date'}-${r.period || 'p'}-${r.sessionNo || 's'}`}
                          className="text-xs bg-white border border-slate-200 rounded-md p-2 flex items-center justify-between gap-2"
                        >
                          <div className="font-medium text-slate-800">
                            {r.sessionNo ? `Session ${r.sessionNo}` : 'Session'}
                            {r.totalSessions ? ` / ${r.totalSessions}` : ''}
                          </div>
                          <div className="text-slate-600">{formatPreviewDate(r.date)} • P{r.period || '-'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-600">No reported sessions yet for this chapter.</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-gray-500">Chapter</div>
                  <div className="text-sm text-gray-900 mt-1 break-words">{chapter || '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-gray-500">Session</div>
                  <div className="text-sm text-gray-900 mt-1">{sessionNo ? `${sessionNo} / ${totalSessions || 1}` : '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <div className="text-xs font-medium text-gray-500">Objectives</div>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{objectives || '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <div className="text-xs font-medium text-gray-500">Activities / Teaching Methods</div>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{teachingMethods || '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <div className="text-xs font-medium text-gray-500">Notes</div>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{data?.notes || '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <div className="text-xs font-medium text-gray-500">Difficulties</div>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{data?.difficulties || '—'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <div className="text-xs font-medium text-gray-500">Next Session Plan</div>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">{data?.nextSessionPlan || '—'}</div>
                </div>
              </div>

              {/* Delete Button for Submitted Report */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onToggle}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={onDelete}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>Delete Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* Substitution banner */}
          {isSub && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="font-medium text-amber-900">Substitution period – lesson plan not required</div>
              {period.absentTeacher && (
                <div className="text-sm text-amber-700 mt-1">Absent Teacher: {period.absentTeacher} • Regular Subject: {period.regularSubject || '-'}</div>
              )}

              <div className="mt-3">
                <label className="block text-sm font-medium text-amber-900 mb-2">
                  Use your ready lesson plan (optional)
                </label>
                <select
                  value={selectedSubPlanId}
                  onChange={(e) => handleSubPlanSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">No plan (write notes)</option>
                  {nextPlan && String(nextPlan.lpId || '').trim() && (
                    <option value={String(nextPlan.lpId || '').trim()}>
                      In plan — {String(nextPlan.chapter || 'Lesson Plan').trim()}
                      {nextPlan.sessionNo ? ` (Plan: S${nextPlan.sessionNo}` : ''}
                      {(nextPlan.sessionNo && nextPlan.totalSessions) ? `/${nextPlan.totalSessions})` : (nextPlan.sessionNo ? ')' : '')}
                      {nextPlan.selectedDate ? ` • ${nextPlan.selectedDate}` : ''}
                      {nextPlan.selectedPeriod ? ` • P${nextPlan.selectedPeriod}` : ''}
                    </option>
                  )}
                </select>
                {substitutionPlansLoading && (
                  <div className="text-xs text-amber-700 mt-1">Loading suggested plans…</div>
                )}
                {nextPlan && expectedSession && Number(nextPlan.sessionNo || 0) !== Number(expectedSession) && !substitutionPlansLoading && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
                    <div className="font-semibold">⚠️ Session Mismatch Warning</div>
                    <div className="mt-1">
                      The suggested plan is <strong>Session {nextPlan.sessionNo}</strong>, but you must report <strong>Session {expectedSession}</strong> first (sequential enforcement).
                    </div>
                    <div className="mt-1 text-xs">
                      The plan for Session {expectedSession} may not be prepared or may be from a missed period. You may need to prepare Session {expectedSession} first, or report without selecting a plan.
                    </div>
                  </div>
                )}
                {nextPlan && !substitutionPlansLoading && (!expectedSession || Number(nextPlan.sessionNo || 0) === Number(expectedSession)) && (
                  <div className="text-xs text-blue-600 mt-1">
                    💡 Session number will be auto-set to first unreported session when selected
                  </div>
                )}
                {!nextPlan && expectedSession && !substitutionPlansLoading && (
                  <div className="text-xs text-amber-700 mt-1">
                    ⚠️ No Ready plan found for Session {expectedSession}. Prepare it or report without a plan.
                  </div>
                )}
              </div>

              {selectedSubPlan && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-900">Selected plan: {selectedSubPlan.chapter || 'Lesson Plan'}</div>
                  <div className="text-xs text-green-700 mt-1">
                    {(selectedSubPlan.sessionNo && selectedSubPlan.totalSessions) ? `Session ${selectedSubPlan.sessionNo} of ${selectedSubPlan.totalSessions}` : ''}
                    {selectedSubPlan.selectedDate ? ` • ${selectedSubPlan.selectedDate}` : ''}
                    {selectedSubPlan.selectedPeriod ? ` • P${selectedSubPlan.selectedPeriod}` : ''}
                  </div>
                  {selectedSubPlan.learningObjectives && (
                    <div className="text-xs text-green-700 mt-2">
                      <strong>Objectives:</strong> {String(selectedSubPlan.learningObjectives).substring(0, 160)}{String(selectedSubPlan.learningObjectives).length > 160 ? '…' : ''}
                    </div>
                  )}
                  {pullbackPreview.length > 0 && (
                    <div className="mt-3 text-xs text-green-800">
                      <div className="font-medium">Other sessions will be shifted earlier:</div>
                      <div className="mt-1 space-y-1">
                        {pullbackPreview.map(m => (
                          <div key={m.lpId}>
                            S{m.sessionNo}: {m.oldDate} P{m.oldPeriod} → {m.newDate} P{m.newPeriod}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Show lesson plan details if available and planned fields are shown */}
          {showPlannedFields && effectivePlan ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📚</div>
                <div className="flex-1">
                  <div className="font-medium text-green-900">Lesson Plan: {effectivePlan.chapter}</div>
                  <div className="text-sm text-green-700 mt-1">Session {effectivePlan.sessionNo || effectivePlan.session} of {effectivePlan.totalSessions || effectivePlan.noOfSessions || 1}</div>
                  {(effectivePlan.schemeId || plan?.schemeId) && (
                    <div className="text-xs text-green-700 mt-1">Scheme ID: {effectivePlan.schemeId || plan?.schemeId}</div>
                  )}
                  <div className="text-xs text-green-600 mt-1">Plan ID: {effectivePlan.lpId}</div>
                  {effectivePlan.learningObjectives && (
                    <div className="text-xs text-green-700 mt-2">
                      <strong>Objectives:</strong> {String(effectivePlan.learningObjectives).substring(0, 100)}...
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

          {chapter && previewSubject && period.class && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Reported sessions preview</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {chapter} • {previewSubject} • {period.class}
                    {previewSchemeId ? ` • Scheme ${previewSchemeId}` : ''}
                  </div>
                </div>
                <div className="text-xs text-slate-600">Reported: {filteredPreviewList.length}</div>
              </div>
              {reportedChapterSessionsLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
                  <span>Loading reported sessions...</span>
                </div>
              ) : filteredPreviewList.length > 0 ? (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-2">
                  {filteredPreviewList.map(r => (
                    <div
                      key={r.reportId || r.id || `${r.date || 'date'}-${r.period || 'p'}-${r.sessionNo || 's'}`}
                      className="text-xs bg-white border border-slate-200 rounded-md p-2 flex items-center justify-between gap-2"
                    >
                      <div className="font-medium text-slate-800">
                        {r.sessionNo ? `Session ${r.sessionNo}` : 'Session'}
                        {r.totalSessions ? ` / ${r.totalSessions}` : ''}
                      </div>
                      <div className="text-slate-600">{formatPreviewDate(r.date)} • P{r.period || '-'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-600">No reported sessions yet for this chapter.</div>
              )}
            </div>
          )}

          {/* Substitution form: notes-only OR in-plan (planned reporting fields) */}
          {isSub && !inPlanMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedSubPlanId ? 'Notes (optional)' : 'What did you do in this period?'} {!selectedSubPlanId && (<span className="text-red-500">*</span>)}
              </label>
              <textarea
                value={data.subNotes || data.objectives || ''}
                onChange={(e) => { onUpdate('subNotes', e.target.value); onUpdate('objectives', e.target.value); }}
                placeholder={selectedSubPlanId ? "Optional: add any notes about what you did" : "Briefly describe the activities/coverage during substitution"}
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
                value={data.chapter || effectivePlan?.chapter || ""}
                readOnly
                disabled={true}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder={effectivePlan ? "From lesson plan" : "No planned chapter – prepare a lesson plan"}
                className={`w-full px-4 py-2 border rounded-lg bg-gray-100 ${
                  effectivePlan ? 'border-blue-300' : 'border-red-300'
                }`}
              />
              {!effectivePlan && (
                <p className="mt-1 text-xs text-red-600">No planned chapter found for this period. Please prepare a lesson plan first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Number {isSub && inPlanMode && <span className="text-blue-600 text-xs ml-1">(enforced sequentially)</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={sessionNo}
                  onChange={(e) => onUpdate('sessionNo', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  min="1"
                  readOnly={isSub && inPlanMode}
                  className={`w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isSub && inPlanMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  title={isSub && inPlanMode ? 'Session number is automatically set to first unreported session' : ''}
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
              {isSub && inPlanMode && (
                <p className="text-xs text-blue-600 mt-1">
                  📌 Session number is set to first unreported session (sequential enforcement)
                </p>
              )}
            </div>
          </div>
          )}

          {/* Learning Objectives */}
          {showPlannedFields && effectivePlan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Objectives (from Lesson Plan) 
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                value={data.objectives || effectivePlan?.learningObjectives || ""}
                onChange={(e) => onUpdate('objectives', e.target.value)}
                placeholder="Learning objectives from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Teaching Methods/Activities */}
          {showPlannedFields && effectivePlan && (effectivePlan.teachingMethods || effectivePlan.activities) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teaching Methods (from Lesson Plan)
                <span className="text-blue-600 text-xs ml-2">✏️ Editable</span>
              </label>
              <textarea
                value={data.activities || effectivePlan?.teachingMethods || effectivePlan?.activities || ""}
                onChange={(e) => onUpdate('activities', e.target.value)}
                placeholder="Teaching methods from lesson plan..."
                rows={3}
                className="w-full px-4 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Session Complete: Yes/No */}
          {showPlannedFields && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Session Completed? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  onUpdate('sessionComplete', true);
                  // Clear incomplete-only fields
                  onUpdate('deviationReason', '');
                  onUpdate('cascadeOption', '');
                }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  sessionComplete
                    ? 'bg-green-50 border-green-500 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">✅</div>
                <div className="text-base font-medium text-gray-700">Yes - Complete</div>
                <div className="text-xs text-gray-500 mt-1">Session fully delivered</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate('sessionComplete', false);
                  // Clear chapter completion when marking incomplete
                  onUpdate('chapterCompleted', false);
                  onUpdate('remainingSessionsAction', null);
                }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  !sessionComplete
                    ? 'bg-orange-50 border-orange-500 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">⭕</div>
                <div className="text-base font-medium text-gray-700">No - Incomplete</div>
                <div className="text-xs text-gray-500 mt-1">Need to reschedule</div>
              </button>
            </div>
          </div>
          )}

          {/* Reason for Incomplete Session */}
          {allowPlanActions && !sessionComplete && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Incomplete Session <span className="text-red-500">*</span>
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
          )}

          {/* Cascade Option (only for incomplete sessions) */}
          {allowPlanActions && effectivePlan && !sessionComplete && data.deviationReason && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <input
                  type="checkbox"
                  checked={data.cascadeOption === 'cascade'}
                  onChange={(e) => onUpdate('cascadeOption', e.target.checked ? 'cascade' : '')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-700">🔄 Reschedule remaining sessions</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Push all future sessions of this chapter to next available periods
                  </div>
                </div>
              </label>
              {data.cascadeOption === 'cascade' && cascadeLoading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></span>
                  Generating cascade preview...
                </div>
              )}
            </div>
          )}

              {/* Cascade Preview (incomplete only) */}
              {!sessionComplete && data.cascadeOption === 'cascade' && cascadePreview && !cascadeLoading && (
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

          {/* Learning Objectives - show for all cases when session complete */}
          {showPlannedFields && sessionComplete && !effectivePlan && (
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

          {/* Activities - show for all cases when session complete */}
          {showPlannedFields && sessionComplete && !effectivePlan && (
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
          {allowPlanActions && sessionComplete && (
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
            </>
          )}
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
