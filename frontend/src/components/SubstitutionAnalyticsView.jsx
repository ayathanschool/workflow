import React, { useEffect, useMemo, useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import * as api from '../api';

function isoDate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function isItLabSupportRow(row) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const a = norm(row?.absentTeacher);
  const rs = norm(row?.regularSubject);
  const ss = norm(row?.substituteSubject);
  const n = norm(row?.note);
  return [a, rs, ss, n].some((x) => x && x.includes('it lab support'));
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normClass(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '');
}

export default function SubstitutionAnalyticsView({ user }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [cls, setCls] = useState('');
  const [includeDetails, setIncludeDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [rangeSubs, setRangeSubs] = useState([]);

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(isoDate(thirtyDaysAgo));
    setEndDate(isoDate(today));
  }, []);

  const canQuery = !!(user?.email && startDate && endDate);

  const loadOptions = async () => {
    if (!user?.email || !startDate || !endDate) return;
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const res = await api.getSubstitutionsRange(startDate, endDate, user.email);
      if (res?.success === false || res?.error) {
        throw new Error(String(res?.error || 'Failed to load substitutions list'));
      }
      const list = Array.isArray(res?.substitutions) ? res.substitutions : [];
      setRangeSubs(list);
    } catch (e) {
      setRangeSubs([]);
      setOptionsError(String(e?.message || e || 'Failed to load dropdown options'));
    } finally {
      setOptionsLoading(false);
    }
  };

  const load = async () => {
    if (!canQuery) return;
    setLoading(true);
    setError('');
    try {
      let res = await api.getSubstitutionEffectiveness({
        email: user.email,
        startDate,
        endDate,
        teacherEmail: String(teacherEmail || '').trim(),
        class: String(cls || '').trim(),
        includeDetails: includeDetails ? '1' : ''
      });

      // Apps Script deployments may return { error: '...' } without success=false.
      if (res?.success === false || res?.error) {
        const msg = String(res?.error || 'Failed to load analytics');
        const isUnknownAction = /unknown action/i.test(msg);

        // Backward compatibility: older Apps Script deployment.
        // Compute effectiveness client-side using getSubstitutionsRange + getDailyReports.
        if (isUnknownAction) {
          // Limit range to avoid huge loads on old deployments.
          const s = new Date(startDate);
          const e = new Date(endDate);
          const days = Math.floor((e - s) / (24 * 3600 * 1000)) + 1;
          if (!isFinite(days) || days <= 0) throw new Error('Invalid date range');
          if (days > 31) {
            throw new Error('Apps Script is not updated for Substitution Analytics. Deploy the latest Apps Script, or select a smaller range (max 31 days without backend update).');
          }

          const subsRes = await api.getSubstitutionsRange(startDate, endDate, user.email);
          if (subsRes?.success === false || subsRes?.error) {
            throw new Error(String(subsRes?.error || msg));
          }
          let subs = Array.isArray(subsRes?.substitutions) ? subsRes.substitutions : [];
          subs = subs.filter((r) => !isItLabSupportRow(r));

          // Apply teacher/class filters client-side (matching backend behavior)
          const tFilter = normEmail(teacherEmail);
          const cFilter = normClass(cls);
          subs = subs.filter((r) => {
            if (tFilter && normEmail(r?.substituteTeacher) !== tFilter) return false;
            if (cFilter && normClass(r?.class) !== cFilter) return false;
            return true;
          });

          // Load reports for same range and build key: date|period|class|teacher
          const repRes = await api.getDailyReports({
            fromDate: startDate,
            toDate: endDate,
            teacher: tFilter || '',
            cls: cls || ''
          });
          if (repRes?.success === false || repRes?.error) {
            throw new Error(String(repRes?.error || 'Failed to load daily reports'));
          }
          const reports = Array.isArray(repRes?.reports) ? repRes.reports : (Array.isArray(repRes) ? repRes : []);
          const reportMap = new Map();
          for (const r of reports) {
            const key = `${String(r?.date || '').trim()}|${String(r?.period || '').trim()}|${normClass(r?.class)}|${normEmail(r?.teacherEmail)}`;
            if (!key.includes('||')) reportMap.set(key, r);
          }

          const details = [];
          const totals = { assigned: 0, reported: 0, pending: 0, reportedPct: 0 };
          const teacherAgg = new Map();
          const classAgg = new Map();

          const bump = (m, k, da, dr) => {
            if (!m.has(k)) m.set(k, { assigned: 0, reported: 0, pending: 0, reportedPct: 0 });
            const obj = m.get(k);
            obj.assigned += da;
            obj.reported += dr;
            obj.pending = obj.assigned - obj.reported;
            obj.reportedPct = obj.assigned ? Math.round((obj.reported / obj.assigned) * 1000) / 10 : 0;
          };

          for (const sRow of subs) {
            const sDate = String(sRow?.date || '').trim();
            const sPeriod = String(sRow?.period || '').trim();
            const sCls = String(sRow?.class || '').trim();
            const sTeacher = normEmail(sRow?.substituteTeacher);
            const key = `${sDate}|${sPeriod}|${normClass(sCls)}|${sTeacher}`;
            const r = reportMap.get(key) || null;
            const hasReport = !!r;
            totals.assigned += 1;
            if (hasReport) totals.reported += 1;
            bump(teacherAgg, sTeacher || '(unknown)', 1, hasReport ? 1 : 0);
            bump(classAgg, sCls || '(unknown)', 1, hasReport ? 1 : 0);

            if (includeDetails) {
              details.push({
                date: sDate,
                period: sPeriod,
                class: sCls,
                absentTeacher: String(sRow?.absentTeacher || '').trim(),
                substituteTeacher: String(sRow?.substituteTeacher || '').trim(),
                substituteSubject: String(sRow?.substituteSubject || sRow?.regularSubject || '').trim(),
                reported: hasReport,
                reportId: r?.id || r?.reportId || '',
                reportChapter: r?.chapter || '',
                reportSessionNo: r?.sessionNo || '',
                reportNotes: r?.notes || ''
              });
            }
          }

          totals.pending = totals.assigned - totals.reported;
          totals.reportedPct = totals.assigned ? Math.round((totals.reported / totals.assigned) * 1000) / 10 : 0;

          const teacherStats = Array.from(teacherAgg.entries()).map(([email, agg]) => ({
            teacherEmail: email,
            assigned: agg.assigned,
            reported: agg.reported,
            pending: agg.pending,
            reportedPct: agg.reportedPct
          })).sort((a, b) => (b.pending - a.pending) || (b.assigned - a.assigned) || String(a.teacherEmail).localeCompare(String(b.teacherEmail)));

          const classStats = Array.from(classAgg.entries()).map(([c, agg]) => ({
            class: c,
            assigned: agg.assigned,
            reported: agg.reported,
            pending: agg.pending,
            reportedPct: agg.reportedPct
          })).sort((a, b) => (b.pending - a.pending) || (b.assigned - a.assigned) || String(a.class).localeCompare(String(b.class)));

          res = {
            success: true,
            startDate,
            endDate,
            filters: { teacherEmail: tFilter, class: cls || '' },
            totals,
            teacherStats,
            classStats,
            details: includeDetails ? details.filter((d) => d && d.reported === false) : undefined
          };
        } else {
          throw new Error(msg);
        }
      }

      setData(res);
    } catch (e) {
      setData(null);
      setError(String(e?.message || e || 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, startDate, endDate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, startDate, endDate, teacherEmail, cls, includeDetails]);

  const teacherOptions = useMemo(() => {
    const set = new Set();
    const list = (Array.isArray(rangeSubs) ? rangeSubs : []).filter((r) => !isItLabSupportRow(r));
    for (const s of list) {
      const email = String(s?.substituteTeacher || '').trim().toLowerCase();
      if (email) set.add(email);
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [rangeSubs]);

  const classOptions = useMemo(() => {
    const set = new Set();
    const list = (Array.isArray(rangeSubs) ? rangeSubs : []).filter((r) => !isItLabSupportRow(r));
    for (const s of list) {
      const c = String(s?.class || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [rangeSubs]);

  const totals = data?.totals || { assigned: 0, reported: 0, pending: 0, reportedPct: 0 };

  const pendingDetails = useMemo(() => {
    const list = Array.isArray(data?.details) ? data.details : [];
    return list.filter((x) => x && x.reported === false);
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            Substitution Analytics
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Assigned vs reported substitution periods (teacherwise and classwise)
          </p>
        </div>
        <button
          onClick={load}
          disabled={!canQuery || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (loading ? 'animate-spin' : '')} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher (optional)</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              disabled={optionsLoading}
            >
              <option value="">All teachers</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class (optional)</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              disabled={optionsLoading}
            >
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 mt-7 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} />
            Include pending list
          </label>
        </div>
        {(optionsError || optionsLoading) && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {optionsLoading ? 'Loading dropdown options…' : optionsError}
          </div>
        )}
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Assigned</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totals.assigned}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Reported</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totals.reported}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totals.pending}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Reported %</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totals.reportedPct}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Teacherwise</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Assigned</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reported</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(data?.teacherStats || []).map((r) => (
                  <tr key={r.teacherEmail}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.teacherEmail}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.assigned}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.reported}</td>
                    <td className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400 text-right">{r.pending}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.reportedPct}%</td>
                  </tr>
                ))}
                {(!loading && (!data?.teacherStats || data.teacherStats.length === 0)) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Classwise</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Assigned</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reported</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(data?.classStats || []).map((r) => (
                  <tr key={r.class}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.class}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.assigned}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.reported}</td>
                    <td className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400 text-right">{r.pending}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">{r.reportedPct}%</td>
                  </tr>
                ))}
                {(!loading && (!data?.classStats || data.classStats.length === 0)) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {includeDetails && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Pending substitution periods ({pendingDetails.length})</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">These substitutions have no matching daily report yet.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingDetails.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.date}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">P{r.period}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{r.class}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{r.substituteTeacher}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{r.substituteSubject}</td>
                  </tr>
                ))}
                {(!loading && pendingDetails.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No pending substitutions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
