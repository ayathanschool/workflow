import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { yesterdayIST } from '../utils/dateUtils';

function _listIsoDatesInclusive(fromIso, toIso) {
  try {
    const s = new Date(fromIso);
    const e = new Date(toIso);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return [];
    // normalize to midnight UTC-ish (using Date objects from yyyy-mm-dd strings)
    const cur = new Date(s);
    const end = new Date(e);
    const out = [];
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
      if (out.length > 60) break;
    }
    return out;
  } catch {
    return [];
  }
}

export default function MissingDailyReportsTeacherwiseView({ user }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [optionsCache, setOptionsCache] = useState({ teachers: null, classes: null, subjects: null });

  useEffect(() => {
    const yday = yesterdayIST();
    setFromDate(yday);
    setToDate(yday);
  }, []);

  const load = useCallback(async () => {
    if (!user?.email || !fromDate || !toDate) return;
    setLoading(true);
    setError('');
    try {
      let res = await api.getMissingSubmissionsTeacherwiseRange(fromDate, toDate, user.email, {
        teacher: selectedTeacher || '',
        cls: selectedClass || '',
        subject: selectedSubject || ''
      });

      // Apps Script sometimes returns { error: 'Unknown action: ...' } without success=false.
      if (res?.success === false || res?.error) {
        const msg = String(res?.error || 'Failed to load missing submissions');

        const isUnknownAction = /unknown action/i.test(msg);
        const isSingleDay = String(fromDate) === String(toDate);

        // Backward compatibility:
        // 1) If range endpoint isn't deployed, do client-side range aggregation using getMissingSubmissions.
        // 2) If teacherwise endpoint isn't deployed, fall back to getMissingSubmissions.
        if (isUnknownAction) {
          const days = _listIsoDatesInclusive(fromDate, toDate);
          if (!days.length) throw new Error('Invalid date range');
          if (days.length > 14) {
            throw new Error('Backend not updated for date-range missing reports. Deploy Apps Script, or select a smaller range (max 14 days without backend update).');
          }

          const missing = [];
          let totalPeriods = 0;

          for (const d of days) {
            // Prefer teacherwise if available; else use non-teacherwise endpoint.
            let one = null;
            try {
              one = await api.getMissingSubmissionsTeacherwise(d, user.email);
              if (one?.success === false || one?.error) throw new Error(String(one?.error || 'failed'));
            } catch {
              one = await api.getMissingSubmissions(d);
              if (one?.success === false || one?.error) throw new Error(String(one?.error || 'Failed to load missing submissions'));
            }

            const items = Array.isArray(one?.missing) ? one.missing : [];
            items.forEach((m) => missing.push({ ...m, date: d }));
            totalPeriods += Number(one?.stats?.totalPeriods || 0);
          }

          res = {
            success: true,
            fromDate,
            toDate,
            missing,
            stats: {
              totalPeriods,
              missingCount: missing.length,
              teachersImpacted: 0
            },
            byTeacher: []
          };
        } else if (isSingleDay) {
          // Non-unknown-action errors on single day: attempt teacherwise then regular.
          let single = await api.getMissingSubmissionsTeacherwise(fromDate, user.email);
          if (single?.success === false || single?.error) {
            single = await api.getMissingSubmissions(fromDate);
          }
          if (single?.success === false || single?.error) {
            throw new Error(String(single?.error || msg || 'Failed to load missing submissions'));
          }
          res = { ...single, fromDate, toDate, date: single?.date || fromDate };
        } else {
          throw new Error(msg);
        }
      }

      setData(res);

      // Cache unfiltered options so dropdowns don't shrink when filters are applied.
      if (!selectedTeacher && !selectedClass && !selectedSubject) {
        const byTeacher = Array.isArray(res?.byTeacher) ? res.byTeacher : [];
        const missing = Array.isArray(res?.missing) ? res.missing : [];

        const teachers = (() => {
          if (byTeacher.length) {
            return byTeacher
              .map(t => ({ label: t.teacher || t.teacherEmail, value: t.teacherEmail }))
              .filter(t => t.value)
              .sort((a, b) => String(a.label).localeCompare(String(b.label)));
          }

          const map = new Map();
          for (const m of missing) {
            const email = String(m?.teacherEmail || '').trim();
            if (!email) continue;
            const name = String(m?.teacher || '').trim();
            if (!map.has(email)) map.set(email, name || email);
          }
          return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => String(a.label).localeCompare(String(b.label)));
        })();

        const classes = [...new Set(missing.map(m => String(m?.class || '').trim()).filter(Boolean))].sort();
        const subjects = [...new Set(missing.map(m => String(m?.subject || '').trim()).filter(Boolean))].sort();
        setOptionsCache({ teachers, classes, subjects });
      }
    } catch (e) {
      setData(null);
      setError(String(e?.message || e || 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, user?.email, selectedTeacher, selectedClass, selectedSubject]);

  useEffect(() => {
    load();
  }, [load]);

  const uniqueTeachers = useMemo(() => {
    if (Array.isArray(optionsCache?.teachers) && optionsCache.teachers.length) return optionsCache.teachers;

    const byTeacher = Array.isArray(data?.byTeacher) ? data.byTeacher : [];
    if (byTeacher.length) {
      return byTeacher
        .map(t => ({ label: t.teacher || t.teacherEmail, value: t.teacherEmail }))
        .filter(t => t.value)
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }

    // Fallback: derive teacher list from missing[] (covers older endpoints and client-side aggregation).
    const missing = Array.isArray(data?.missing) ? data.missing : [];
    const map = new Map();
    for (const m of missing) {
      const email = String(m?.teacherEmail || '').trim();
      if (!email) continue;
      const name = String(m?.teacher || '').trim();
      if (!map.has(email)) map.set(email, name || email);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [data, optionsCache]);

  const selectedTeacherLabel = useMemo(() => {
    if (!selectedTeacher) return '';
    const found = uniqueTeachers.find(t => String(t.value).toLowerCase() === String(selectedTeacher).toLowerCase());
    return found ? found.label : selectedTeacher;
  }, [selectedTeacher, uniqueTeachers]);

  const uniqueClasses = useMemo(() => {
    if (Array.isArray(optionsCache?.classes) && optionsCache.classes.length) return optionsCache.classes;
    const list = Array.isArray(data?.missing) ? data.missing : [];
    return [...new Set(list.map(m => String(m.class || '').trim()).filter(Boolean))].sort();
  }, [data, optionsCache]);

  const uniqueSubjects = useMemo(() => {
    if (Array.isArray(optionsCache?.subjects) && optionsCache.subjects.length) return optionsCache.subjects;
    const list = Array.isArray(data?.missing) ? data.missing : [];
    return [...new Set(list.map(m => String(m.subject || '').trim()).filter(Boolean))].sort();
  }, [data, optionsCache]);

  const filteredMissing = useMemo(() => {
    const list = Array.isArray(data?.missing) ? data.missing : [];
    return list.filter((m) => {
      if (!m) return false;

      if (selectedTeacher) {
        const a = String(m.teacherEmail || '').trim().toLowerCase();
        const b = String(selectedTeacher || '').trim().toLowerCase();
        if (!a || a !== b) return false;
      }

      if (selectedClass) {
        const a = String(m.class || '').trim();
        const b = String(selectedClass || '').trim();
        if (!a || a !== b) return false;
      }

      if (selectedSubject) {
        const a = String(m.subject || '').trim();
        const b = String(selectedSubject || '').trim();
        if (!a || a !== b) return false;
      }

      return true;
    });
  }, [data, selectedTeacher, selectedClass, selectedSubject]);

  const rows = useMemo(() => {
    const by = {};
    filteredMissing.forEach((m) => {
      const key = String(m.teacherEmail || '').toLowerCase();
      if (!key) return;
      if (!by[key]) by[key] = { teacher: m.teacher, teacherEmail: m.teacherEmail, count: 0, periods: [] };
      by[key].count += 1;
      by[key].periods.push({ date: m.date, class: m.class, subject: m.subject, period: m.period });
    });
    const arr = Object.values(by);
    arr.forEach(t => {
      t.periods.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.period || 0) - (b.period || 0));
    });
    arr.sort((a, b) => (b.count - a.count) || String(a.teacherEmail).localeCompare(String(b.teacherEmail)));
    return arr;
  }, [filteredMissing]);

  const serverStats = data?.stats || { totalPeriods: 0 };
  const stats = useMemo(() => {
    const hasFilters = !!(selectedTeacher || selectedClass || selectedSubject);
    return {
      // Backend now reports totalPeriods AFTER applying filters.
      totalPeriods: serverStats.totalPeriods || 0,
      missingCount: hasFilters ? filteredMissing.length : (serverStats.missingCount ?? filteredMissing.length),
      teachersImpacted: hasFilters ? rows.length : (serverStats.teachersImpacted ?? rows.length)
    };
  }, [serverStats.totalPeriods, serverStats.missingCount, serverStats.teachersImpacted, filteredMissing.length, rows.length, selectedTeacher, selectedClass, selectedSubject]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            Missing Daily Reports (Teacherwise)
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Shows which teachers haven’t submitted daily reports for scheduled periods.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading || !user?.email || !fromDate || !toDate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (loading ? 'animate-spin' : '')} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">All Teachers</option>
              {uniqueTeachers.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">All Classes</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {(selectedTeacher || selectedClass || selectedSubject) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedTeacher && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                Teacher: {selectedTeacherLabel}
                <button onClick={() => setSelectedTeacher('')} className="ml-1 hover:text-blue-900">×</button>
              </span>
            )}
            {selectedClass && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                Class: {selectedClass}
                <button onClick={() => setSelectedClass('')} className="ml-1 hover:text-green-900">×</button>
              </span>
            )}
            {selectedSubject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                Subject: {selectedSubject}
                <button onClick={() => setSelectedSubject('')} className="ml-1 hover:text-purple-900">×</button>
              </span>
            )}
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total scheduled periods</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPeriods}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Missing reports</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.missingCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Teachers impacted</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.teachersImpacted}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Teacherwise missing list</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                <th className="hidden md:table-cell px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-3 py-2 sm:px-4 text-right text-xs font-medium text-gray-500 uppercase">Missing</th>
                <th className="px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase">Missing periods</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((t) => (
                <tr key={t.teacherEmail}>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100">{t.teacher || t.teacherEmail}</td>
                  <td className="hidden md:table-cell px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300">{t.teacherEmail}</td>
                  <td className="px-3 py-2 sm:px-4 text-sm text-amber-700 dark:text-amber-400 text-right font-medium">{t.count}</td>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300">
                    <details className="max-w-[70vw]">
                      <summary className="cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                        View periods ({(t.periods || []).length})
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(t.periods || []).map((p, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                            {p.date ? `${p.date} • ` : ''}P{p.period} • {p.class} • {p.subject}
                          </span>
                        ))}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 sm:px-4 text-center text-sm text-gray-500">No missing reports</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
