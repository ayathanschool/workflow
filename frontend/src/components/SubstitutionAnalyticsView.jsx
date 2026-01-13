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

export default function SubstitutionAnalyticsView({ user }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [cls, setCls] = useState('');
  const [includeDetails, setIncludeDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(isoDate(thirtyDaysAgo));
    setEndDate(isoDate(today));
  }, []);

  const canQuery = !!(user?.email && startDate && endDate);

  const load = async () => {
    if (!canQuery) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getSubstitutionEffectiveness({
        email: user.email,
        startDate,
        endDate,
        teacherEmail: String(teacherEmail || '').trim(),
        class: String(cls || '').trim(),
        includeDetails: includeDetails ? '1' : ''
      });

      if (res?.success === false) {
        throw new Error(res.error || 'Failed to load analytics');
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, startDate, endDate]);

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
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900" placeholder="teacher@email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class (optional)</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900" placeholder="10A" value={cls} onChange={(e) => setCls(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 mt-7 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} />
            Include pending list
          </label>
        </div>
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
