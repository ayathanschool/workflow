import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Calendar,
  User,
  Users,
  Target,
  BookOpen,
  BookCheck,
  FileCheck,
  BarChart2
} from 'lucide-react';
import * as api from '../api';

const HMDashboardView = ({ insights: insightsProp, memoizedSettings, setActiveView }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dailyReportsData, setDailyReportsData] = useState({ reports: [], stats: {} });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [paceTracking, setPaceTracking] = useState(null);
    const [loadingPaceTracking, setLoadingPaceTracking] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    const [lessonPlansToday, setLessonPlansToday] = useState([]);
    const [loadingLessonPlansToday, setLoadingLessonPlansToday] = useState(false);
    const lessonPlansLoadRef = useRef({ date: null, loading: false });

    // Live schedule focused period (Prev/Next controls). Auto-follows current period until user navigates.
    const [focusedPeriod, setFocusedPeriod] = useState(1);
    const [focusedPeriodPinned, setFocusedPeriodPinned] = useState(false);

    // Modal for lesson plan details
    const [selectedLessonPlan, setSelectedLessonPlan] = useState(null);
    const [showLessonPlanModal, setShowLessonPlanModal] = useState(false);

    // Missing lesson plans overview
    const [missingPlans, setMissingPlans] = useState(null);
    const [loadingMissingPlans, setLoadingMissingPlans] = useState(false);

    // Insights state - fetch if not provided as prop
    const [localInsights, setLocalInsights] = useState(null);
    const insights = insightsProp || localInsights || {
      planCount: 0,
      lessonCount: 0,
      teacherCount: 0,
      classCount: 0
    };

    // Fetch insights if not provided
    useEffect(() => {
      if (!insightsProp) {
        const fetchInsights = async () => {
          try {
            const [hmData, classes] = await Promise.all([
              api.getHmInsights(),
              api.getAllClasses()
            ]);
            setLocalInsights({
              planCount: hmData?.planCount || 0,
              lessonCount: hmData?.lessonCount || 0,
              teacherCount: hmData?.teacherCount || 0,
              classCount: Array.isArray(classes) ? classes.length : 0
            });
          } catch (err) {
            console.error('Failed to fetch HM insights:', err);
          }
        };
        fetchInsights();
      }
    }, [insightsProp]);

    useEffect(() => {
      async function loadMissingPlans() {
        try {
          setLoadingMissingPlans(true);
          const result = await api.getAllMissingLessonPlans(7);
          setMissingPlans(result?.data || result);
        } catch (err) {
          console.error('Failed to load missing lesson plans:', err);
        } finally {
          setLoadingMissingPlans(false);
        }
      }
      loadMissingPlans();
    }, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh daily reports every 5 minutes (pauses when tab hidden)
  useEffect(() => {
    if (!autoRefresh) return;
    
    const refreshData = async () => {
      // Skip if tab is hidden to save resources
      if (document.hidden) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;
        setDailyReportsData({
          reports: data.reports || [],
          stats: data.stats || {}
        });
        setLastRefresh(new Date());
      } catch (err) {
        console.error('Auto-refresh failed:', err);
      }
    };
    
    const refreshTimer = setInterval(refreshData, 5 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, [autoRefresh]);

  // Load daily reports on mount
  useEffect(() => {
    async function loadTodayReports() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.getDailyReportsForDate(today);
        const data = response?.data || response;

        if (!Array.isArray(data?.reports) || data.reports.length === 0) {
          console.warn('⚠️ NO REPORTS FOUND - Check backend logs for timetable data');
        }
        
        setDailyReportsData({
          reports: data.reports || [],
          stats: data.stats || {}
        });
        setLastRefresh(new Date());
      } catch (err) {
        console.error('❌ Failed to load daily reports:', err);
      }
    }
    loadTodayReports();
  }, []);
  
  // Load syllabus pace tracking
  useEffect(() => {
    async function loadPaceTracking() {
      setLoadingPaceTracking(true);
      try {
        const response = await api.getSyllabusPaceTracking('Term 2');
        if (response?.success) {
          setPaceTracking(response);
        }
      } catch (err) {
        console.error('Failed to load pace tracking:', err);
      } finally {
        setLoadingPaceTracking(false);
      }
    }
    loadPaceTracking();
  }, []);

  // Determine current period based on time
  const getCurrentPeriod = () => {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const time = hour * 60 + minute;

    // Check if today is Friday (0 = Sunday, 5 = Friday)
    const today = new Date();
    const isFriday = today.getDay() === 5;

    // Use Friday-specific period times if available and today is Friday
    let selectedPeriodTimes = null;
    if (isFriday && memoizedSettings?.periodTimesFriday && Array.isArray(memoizedSettings.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesFriday;
    } else if (memoizedSettings?.periodTimesWeekday && Array.isArray(memoizedSettings.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesWeekday;
    } else if (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length) {
      selectedPeriodTimes = memoizedSettings.periodTimes;
    }

    // Prefer dynamic period times from settings if available
    const dynamicTimes = selectedPeriodTimes
      ? selectedPeriodTimes.map(p => {
          if (!p.start || !p.end) return null;
          const [sh, sm] = p.start.split(':').map(Number);
          const [eh, em] = p.end.split(':').map(Number);
          return { period: p.period, start: sh * 60 + sm, end: eh * 60 + em };
        }).filter(Boolean)
      : null;

    const fallbackTimes = [
      { period: 1, start: 8 * 60 + 50, end: 9 * 60 + 35 },
      { period: 2, start: 9 * 60 + 35, end: 10 * 60 + 20 },
      { period: 3, start: 10 * 60 + 30, end: 11 * 60 + 15 },
      { period: 4, start: 11 * 60 + 15, end: 12 * 60 },
      { period: 5, start: 12 * 60, end: 12 * 60 + 45 },
      { period: 6, start: 13 * 60 + 15, end: 14 * 60 },
      { period: 7, start: 14 * 60, end: 14 * 60 + 40 },
      { period: 8, start: 14 * 60 + 45, end: 15 * 60 + 25 }
    ];

    const ranges = dynamicTimes || fallbackTimes;
    const current = ranges.find(r => time >= r.start && time < r.end);
    return current ? current.period : null;
  };

  const currentPeriod = getCurrentPeriod();

  // Keep focused period synced to current period unless user has navigated.
  useEffect(() => {
    if (focusedPeriodPinned) return;
    setFocusedPeriod(currentPeriod || 1);
  }, [currentPeriod, focusedPeriodPinned]);

  // Lazy-load lesson plans for today so we can show chapter/session in live and selected periods.
  useEffect(() => {
    const shouldLoad = Boolean(currentPeriod || selectedPeriod);
    if (!shouldLoad) return;
    const today = new Date().toISOString().split('T')[0];
    if (lessonPlansLoadRef.current.loading) return;
    if (lessonPlansLoadRef.current.date === today) return;

    let cancelled = false;
    async function loadLessonPlansForToday() {
      try {
        lessonPlansLoadRef.current.loading = true;
        lessonPlansLoadRef.current.date = today;
        setLoadingLessonPlansToday(true);
        const response = await api.getLessonPlansForDate(today);
        const result = response?.data || response;
        const plans = Array.isArray(result?.lessonPlans) ? result.lessonPlans : (Array.isArray(result) ? result : []);
        if (!cancelled) setLessonPlansToday(plans);
      } catch (err) {
        console.warn('Failed to load lesson plans for HM live period:', err);
        if (!cancelled) setLessonPlansToday([]);
      } finally {
        if (!cancelled) setLoadingLessonPlansToday(false);
        lessonPlansLoadRef.current.loading = false;
      }
    }

    loadLessonPlansForToday();
    return () => { cancelled = true; };
  }, [currentPeriod, selectedPeriod]);

  const normalizeKeyPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  const normalizeSubjectKey = (value) => {
    const s = normalizeKeyPart(value).replace(/[^a-z0-9]/g, '');
    if (!s) return '';
    if (s === 'eng' || s === 'english' || s === 'engg' || s === 'englishg' || s === 'englishgrammar') return 'english';
    if (s === 'mal' || s === 'malayalam') return 'malayalam';
    if (s === 'math' || s === 'maths' || s === 'mathematics') return 'maths';
    return s;
  };

  const buildLiveKey = (row) => {
    const period = String(row?.period || '').replace(/^Period\s*/i, '').trim();
    const cls = normalizeKeyPart(row?.class);
    const subj = normalizeSubjectKey(row?.subject);
    return `${period}|${cls}|${subj}`;
  };

  const plansByLiveKey = useMemo(() => {
    const map = new Map();
    (Array.isArray(lessonPlansToday) ? lessonPlansToday : []).forEach((p) => {
      const row = {
        period: p?.selectedPeriod || p?.period,
        class: p?.class,
        subject: p?.subject
      };
      map.set(buildLiveKey(row), p);
    });
    return map;
  }, [lessonPlansToday]);

  const getDisplayChapter = (row, matchingPlan) =>
    row?.chapterName || row?.chapter || (matchingPlan && matchingPlan.chapter) || '';

  const getDisplaySessionNo = (row, matchingPlan) =>
    row?.sessionNo || row?.sessionNumber || row?.session || (matchingPlan && (matchingPlan.session || matchingPlan.sessionNo || matchingPlan.sessionNumber)) || '';

  const getDisplayTeacher = (row) => row?.teacherName || row?.teacher || row?.teacherEmail || '';

  const getPeriodTimeLabel = (periodNumber) => {
    const p = Number(periodNumber);
    if (!p) return '';

    const today = new Date();
    const isFriday = today.getDay() === 5;

    let selectedPeriodTimes = null;
    if (isFriday && memoizedSettings?.periodTimesFriday && Array.isArray(memoizedSettings.periodTimesFriday) && memoizedSettings.periodTimesFriday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesFriday;
    } else if (memoizedSettings?.periodTimesWeekday && Array.isArray(memoizedSettings.periodTimesWeekday) && memoizedSettings.periodTimesWeekday.length) {
      selectedPeriodTimes = memoizedSettings.periodTimesWeekday;
    } else if (memoizedSettings?.periodTimes && Array.isArray(memoizedSettings.periodTimes) && memoizedSettings.periodTimes.length) {
      selectedPeriodTimes = memoizedSettings.periodTimes;
    }

    const fromSettings = selectedPeriodTimes
      ? selectedPeriodTimes.find(x => Number(x?.period) === p)
      : null;
    if (fromSettings?.start && fromSettings?.end) return `${fromSettings.start} - ${fromSettings.end}`;

    const fallback = {
      1: '08:50 - 09:35',
      2: '09:35 - 10:20',
      3: '10:30 - 11:15',
      4: '11:15 - 12:00',
      5: '12:00 - 12:45',
      6: '13:15 - 14:00',
      7: '14:00 - 14:40',
      8: '14:45 - 15:25'
    };
    return fallback[p] || '';
  };

  const lateSubmissions =
    dailyReportsData?.stats?.lateSubmissions ??
    dailyReportsData?.stats?.late ??
    dailyReportsData?.stats?.lateCount ??
    0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-gray-800 dark:text-gray-100" />
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">Headmaster</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Live monitoring • {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}
              {` • Live Period: ${currentPeriod || '—'}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center border transition-colors ${
                autoRefresh
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
              }`}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
            </button>
            <button
              onClick={() => setActiveView('daily-oversight')}
              className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center hover:bg-gray-800 dark:hover:bg-gray-600 border border-transparent"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Detailed View
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Activity Monitor */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📊 Live Class Schedule <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <span className="text-xs text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        
        {/* Live Period - Class-wise View Only */}
        {(() => {
          const focusPeriod = focusedPeriod || 1;
          const maxPeriodFromReports = Math.max(
            1,
            ...(dailyReportsData?.reports || [])
              .map(r => Number(r?.period || 0))
              .filter(n => Number.isFinite(n) && n > 0)
          );
          const maxPeriod = Number.isFinite(maxPeriodFromReports) && maxPeriodFromReports > 0 ? maxPeriodFromReports : 8;

          const periodRows = (dailyReportsData?.reports || [])
            .filter(r => String(r?.period || '').trim() === String(focusPeriod))
            .sort((a, b) => {
              const classA = String(a?.class || '');
              const classB = String(b?.class || '');
              const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
              const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
              if (numA !== numB) return numA - numB;
              return classA.localeCompare(classB);
            });

          return (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    📊 Period {focusPeriod}
                    {getPeriodTimeLabel(focusPeriod) && (
                      <span className="text-base font-normal text-blue-600 dark:text-blue-400 ml-2">
                        {getPeriodTimeLabel(focusPeriod)}
                      </span>
                    )}
                    {currentPeriod === focusPeriod && (
                      <span className="ml-3 text-sm bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                        LIVE
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} • Last updated: {lastRefresh.toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedPeriodPinned(true);
                        setFocusedPeriod(p => Math.max(1, Number(p || 1) - 1));
                      }}
                      disabled={focusPeriod <= 1}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                        focusPeriod <= 1
                          ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Previous period"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedPeriodPinned(true);
                        setFocusedPeriod(p => Math.min(maxPeriod, Number(p || 1) + 1));
                      }}
                      disabled={focusPeriod >= maxPeriod}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                        focusPeriod >= maxPeriod
                          ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Next period"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  {loadingLessonPlansToday && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Loading lesson plans…</div>
                  )}
                </div>
              </div>

              {dailyReportsData.reports.length === 0 && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">No Timetable Data for Today</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        The system cannot find any timetable periods scheduled for today ({new Date().toLocaleDateString('en-US', {weekday: 'long'})}). 
                        Please ensure:
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc space-y-1">
                        <li>Timetable data is uploaded in the Timetable sheet</li>
                        <li>Today's day name matches the timetable day entries</li>
                        <li>Period numbers are correctly assigned (1-8)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {periodRows.length === 0 && dailyReportsData.reports.length > 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No classes scheduled for Period {focusPeriod} today.</p>
                  {!currentPeriod && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Currently outside school hours.
                    </p>
                  )}
                </div>
              ) : periodRows.length > 0 ? (
                <div className="space-y-2">
                  {periodRows.map((row, idx) => {
                    const matchingPlan = plansByLiveKey.get(buildLiveKey(row)) || null;
                    const chapter = getDisplayChapter(row, matchingPlan);
                    const sessionNo = getDisplaySessionNo(row, matchingPlan);
                    const teacher = getDisplayTeacher(row);
                    const subject = row?.subject || '';
                    const cls = row?.class || '';
                    const isSubmitted = row?.submitted || false;
                    const isSubstitution = !!row?.isSubstitution;

                    return (
                      <div
                        key={`${buildLiveKey(row)}|${idx}`}
                        onClick={() => {
                          if (matchingPlan) {
                            setSelectedLessonPlan(matchingPlan);
                            setShowLessonPlanModal(true);
                          }
                        }}
                        className={`p-3 md:p-4 rounded-lg border transition-all ${
                          matchingPlan ? 'cursor-pointer hover:shadow-md' : ''
                        } ${
                          isSubmitted
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40'
                        } ${
                          isSubstitution
                            ? 'ring-2 ring-blue-400/60 dark:ring-blue-500/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                            : ''
                        }`}
                      >
                        {/* Mobile: Vertical card layout */}
                        <div className="flex md:hidden flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{cls}</span>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                isSubmitted
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                              }`}
                            >
                              {isSubmitted ? '✓' : '○'}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-400">{subject}</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">{teacher || '—'}</div>
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{chapter || '—'}</span>
                            <span className="text-purple-700 dark:text-purple-400 font-medium">
                              {sessionNo ? `S${sessionNo}` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Desktop: Horizontal grid layout */}
                        <div className="hidden md:grid grid-cols-6 gap-4 items-center text-sm">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{cls}</div>
                          <div className="text-gray-700 dark:text-gray-300">{teacher || '—'}</div>
                          <div className="font-medium text-blue-700 dark:text-blue-400">{subject}</div>
                          <div className="text-gray-700 dark:text-gray-300">{chapter || '—'}</div>
                          <div className="text-purple-700 dark:text-purple-400 font-medium">
                            {sessionNo ? `Session ${sessionNo}` : '—'}
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                isSubmitted
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                              }`}
                            >
                              {isSubmitted ? '✓ Reported' : '○ Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          );
        })()}
      </div>

      {/* Today's Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dailyReportsData.stats.submitted || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Submitted</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dailyReportsData.stats.pending || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{lateSubmissions}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Late</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {dailyReportsData.stats.totalPeriods > 0 ? Math.round((dailyReportsData.stats.submitted / dailyReportsData.stats.totalPeriods) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completion</div>
          </div>
        </div>
      </div>

      {/* Period Detail Modal */}
      {selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPeriod(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="text-xl font-bold text-white">
                Period {selectedPeriod}{getPeriodTimeLabel(selectedPeriod) ? ` (${getPeriodTimeLabel(selectedPeriod)})` : ''} - Class Schedule
              </h2>
              <button 
                onClick={() => setSelectedPeriod(null)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {(() => {
                const periodClasses = dailyReportsData.reports
                  .filter(r => parseInt(r.period) === selectedPeriod)
                  .sort((a, b) => {
                    const classA = String(a.class || '');
                    const classB = String(b.class || '');
                    const numA = parseInt(classA.match(/\d+/)?.[0] || '0');
                    const numB = parseInt(classB.match(/\d+/)?.[0] || '0');
                    if (numA !== numB) return numA - numB;
                    return classA.localeCompare(classB);
                  });
                
                if (periodClasses.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-3">
                        <Calendar className="h-16 w-16 mx-auto" />
                      </div>
                      <p className="text-gray-500 text-lg">No classes scheduled for Period {selectedPeriod}</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-blue-900">Period {selectedPeriod} Overview</h3>
                          <p className="text-sm text-blue-700">{periodClasses.length} classes running</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round((periodClasses.filter(c => c.submitted).length / periodClasses.length) * 100)}%
                          </div>
                          <div className="text-xs text-blue-700">Reports Submitted</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {periodClasses.map((classData, idx) => (
                        <div 
                          key={idx}
                          className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                            classData.submitted 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-orange-300 bg-orange-50'
                          } ${
                            classData?.isSubstitution
                              ? 'ring-2 ring-blue-400/60 dark:ring-blue-500/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                              : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{classData.class}</h4>
                              <p className="text-sm font-medium text-blue-600">{classData.subject}</p>
                              {(() => {
                                const matchingPlan = plansByLiveKey.get(buildLiveKey({
                                  period: selectedPeriod,
                                  class: classData?.class,
                                  subject: classData?.subject
                                })) || null;
                                const chapter = getDisplayChapter(classData, matchingPlan);
                                const sessionNo = getDisplaySessionNo(classData, matchingPlan);
                                return (
                                  <div className="text-xs text-gray-700 mt-1">
                                    <span className="font-medium">Chapter:</span> {chapter || '—'}
                                    {sessionNo ? <span className="text-purple-700"> • Session {sessionNo}</span> : null}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              classData.submitted 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-orange-200 text-orange-800'
                            }`}>
                              {classData.submitted ? '✓ Reported' : '○ Pending'}
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <User className="h-4 w-4" />
                              <span className="font-medium">{getDisplayTeacher(classData) || '—'}</span>
                            </div>
                            {classData.isSubstitution && (
                              <div className="mt-2 text-xs bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-yellow-800">
                                🔄 Substitution Class
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedPeriod(null)}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Plan Details Modal */}
      {showLessonPlanModal && selectedLessonPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowLessonPlanModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-blue-600">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Lesson Plan Details
                </h2>
                <p className="text-sm text-blue-100 mt-1">
                  {selectedLessonPlan.class} • {selectedLessonPlan.subject} • Chapter: {selectedLessonPlan.chapter} • Session {selectedLessonPlan.session || selectedLessonPlan.sessionNo}
                </p>
              </div>
              <button 
                onClick={() => setShowLessonPlanModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)] space-y-6">
              {/* Teacher Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Teacher</p>
                    <p className="text-blue-700 dark:text-blue-300">{selectedLessonPlan.teacherName || selectedLessonPlan.teacher || selectedLessonPlan.teacherEmail}</p>
                  </div>
                </div>
              </div>

              {/* Learning Objectives */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Learning Objectives</h3>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900/40 rounded-lg p-4">
                  {selectedLessonPlan.objectives || selectedLessonPlan.learningObjectives ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedLessonPlan.objectives || selectedLessonPlan.learningObjectives}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No learning objectives specified</p>
                  )}
                </div>
              </div>

              {/* Teaching Methods / Activities */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Teaching Methods</h3>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-lg p-4">
                  {selectedLessonPlan.teachingMethods || selectedLessonPlan.activities ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedLessonPlan.teachingMethods || selectedLessonPlan.activities}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No teaching methods specified</p>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {selectedLessonPlan.status && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-3 py-1 rounded-full font-medium ${
                    selectedLessonPlan.status === 'Approved' || selectedLessonPlan.status === 'Ready'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : selectedLessonPlan.status === 'Pending Review'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                  }`}>
                    Status: {selectedLessonPlan.status}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setShowLessonPlanModal(false)}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Schemes</p>
              <p className="text-2xl font-bold text-gray-900">{insights.planCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Lessons</p>
              <p className="text-2xl font-bold text-gray-900">{insights.lessonCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{insights.teacherCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Classes</p>
              <p className="text-2xl font-bold text-gray-900">{insights.classCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Command Center */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveView('scheme-approvals')}
            className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <BookCheck className="h-6 w-6 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-900">Approve Schemes</span>
            {insights.planCount > 0 && (
              <span className="mt-1 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">{insights.planCount}</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveView('lesson-approvals')}
            className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <FileCheck className="h-6 w-6 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Approve Lessons</span>
            {insights.lessonCount > 0 && (
              <span className="mt-1 px-2 py-0.5 text-xs bg-green-600 text-white rounded-full">{insights.lessonCount}</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveView('substitution')}
            className="flex flex-col items-center p-4 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-6 w-6 text-amber-600 mb-2" />
            <span className="text-sm font-medium text-amber-900">Substitutions</span>
          </button>
          
          <button 
            onClick={() => setActiveView('daily-oversight')}
            className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <BarChart2 className="h-6 w-6 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-900">Analytics</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Completion Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">🎯 Completion Distribution <span className="text-sm font-normal text-blue-600">[{new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}]</span></h2>
          <div className="space-y-4">
            {(() => {
              const submittedReports = dailyReportsData.reports.filter(r => r.submitted && r.completionPercentage != null);
              const excellent = submittedReports.filter(r => r.completionPercentage >= 80).length;
              const good = submittedReports.filter(r => r.completionPercentage >= 60 && r.completionPercentage < 80).length;
              const moderate = submittedReports.filter(r => r.completionPercentage >= 40 && r.completionPercentage < 60).length;
              const poor = submittedReports.filter(r => r.completionPercentage < 40).length;
              const total = submittedReports.length || 1;
              
              const ranges = [
                { label: 'Excellent (80-100%)', count: excellent, color: 'bg-green-500', textColor: 'text-green-700' },
                { label: 'Good (60-79%)', count: good, color: 'bg-blue-500', textColor: 'text-blue-700' },
                { label: 'Moderate (40-59%)', count: moderate, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
                { label: 'Poor (<40%)', count: poor, color: 'bg-red-500', textColor: 'text-red-700' }
              ];
              
              return (
                <>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    {ranges.map((range, idx) => {
                      const percent = Math.round((range.count / total) * 100);
                      return percent > 0 ? (
                        <div
                          key={idx}
                          className={range.color}
                          style={{ width: `${percent}%` }}
                          title={`${range.label}: ${range.count}`}
                        />
                      ) : null;
                    })}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {ranges.map((range, idx) => {
                      const percent = Math.round((range.count / total) * 100);
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${range.color}`}></div>
                            <span className="text-sm text-gray-700">{range.label.split(' ')[0]}</span>
                          </div>
                          <div className={`text-sm font-bold ${range.textColor}`}>
                            {range.count} ({percent}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HMDashboardView;
