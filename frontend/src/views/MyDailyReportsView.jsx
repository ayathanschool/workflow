import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { RefreshCw } from 'lucide-react';
import { todayIST } from '../utils/dateUtils';
import { hasRole as userHasRole, hasAnyRole as userHasAnyRole, isAdmin } from '../utils/roles';


// My Daily Reports (Teacher self-history)
const MyDailyReportsView = ({ currentUser, memoizedSettings, stripStdPrefix }) => {
  const hasCurrentUserRole = (role) => userHasRole(currentUser, role);
  const hasCurrentUserAnyRole = (roles) => userHasAnyRole(currentUser, roles);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rangeMode, setRangeMode] = useState('7d'); // 7d | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [substitutionOnly, setSubstitutionOnly] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [maxDisplay, setMaxDisplay] = useState(1000); // soft cap
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [groupByClass, setGroupByClass] = useState(false);
  const [groupByChapter, setGroupByChapter] = useState(false);
  const [schemeLookup, setSchemeLookup] = useState({});
  const email = currentUser?.email || '';

  const [missingReportsSummary, setMissingReportsSummary] = useState({
    loading: false,
    date: todayIST(),
    count: 0,
    pending: [],
    missingDays: 0,
    range: { from: '', to: '' }
  });
  const [missingRange, setMissingRange] = useState({ from: '', to: '' });
  const [missingRangeDraft, setMissingRangeDraft] = useState({ from: '', to: '' });
  const [missingRangeTouched, setMissingRangeTouched] = useState(false);

  useEffect(() => {
    if (!email) return;
    if (!hasCurrentUserAnyRole(['teacher', 'class teacher'])) return;
    if (isAdmin(currentUser) || hasCurrentUserRole('h m')) return;

    let cancelled = false;

    const istNow = () => {
      try {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      } catch {
        return new Date();
      }
    };

    const yesterdayIST = () => {
      const base = istNow();
      base.setDate(base.getDate() - 1);
      return base;
    };

    const formatIST = (d) => {
      try {
        return d.toLocaleString('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split(',')[0];
      } catch {
        return todayIST();
      }
    };

    const addDaysIso = (iso, deltaDays) => {
      const d = new Date(`${iso}T00:00:00Z`);
      if (isNaN(d.getTime())) return iso;
      d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
      return d.toISOString().slice(0, 10);
    };

    const clampToYesterday = (iso) => {
      const y = formatIST(yesterdayIST());
      if (!iso) return y;
      return String(iso) > String(y) ? y : String(iso);
    };

    const maybeInitRange = () => {
      if (missingRangeTouched) return;
      const y = formatIST(yesterdayIST());
      const lookback = Math.max(1, Number(memoizedSettings?.missingDailyReports?.lookbackDays ?? 7) || 7);
      const from = addDaysIso(y, -(lookback - 1));
      const nextRange = { from, to: y };

      if (missingRange.from !== nextRange.from || missingRange.to !== nextRange.to) {
        setMissingRange(nextRange);
        setMissingRangeDraft(nextRange);
      }
    };

    const loadMissingReports = async () => {
      maybeInitRange();
      const from = String(missingRange.from || '').trim();
      const to = clampToYesterday(String(missingRange.to || '').trim());
      if (!from || !to) return;

      setMissingReportsSummary(prev => ({
        ...prev,
        loading: true,
        date: to,
        range: { from, to }
      }));

      try {
        const res = await api.getTeacherDashboardData(email, { from, to });
        if (cancelled) return;
        const payload = res?.data || res || {};
        if (payload.success === false) throw new Error(payload.error || 'Failed to load missing reports');

        const missing = payload.missingReports || {};
        const range = missing.range || { from, to };
        const pending = Array.isArray(missing.pending) ? missing.pending : [];
        const count = Number(missing.count || 0);
        const missingDays = Number(missing.missingDays || 0);

        setMissingReportsSummary({
          loading: false,
          date: range.to || to,
          count: Number.isFinite(count) ? count : 0,
          pending,
          missingDays: Number.isFinite(missingDays) ? missingDays : 0,
          range
        });
      } catch (_e) {
        if (cancelled) return;
        setMissingReportsSummary(prev => ({ ...prev, loading: false, count: 0, pending: [], missingDays: 0 }));
      }
    };

    loadMissingReports();
    return () => { cancelled = true; };
  }, [
    email,
    missingRange.from,
    missingRange.to,
    memoizedSettings?.missingDailyReports?.lookbackDays,
    memoizedSettings?.missingDailyReports?.maxRangeDays
  ]);

  const isSubstitutionReport = useCallback((r) => {
    if (!r) return false;
    const v = r.isSubstitution;
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true', 'yes', '1', 'y', 't'].includes(s)) return true;
      if (s.includes('substitution')) return true;
    }
    // Backward compatibility: some older reports may miss isSubstitution but include metadata
    if (r.absentTeacher) return true;
    if (r.regularSubject || r.substituteSubject) return true;
    if (String(r.planType || '').toLowerCase().includes('substi')) return true;
    return false;
  }, []);

  const getChapterDisplay = useCallback((r) => {
    if (!r) return '-';
    const raw = String(r.chapter || '').trim();
    if (raw) return raw;
    if (isSubstitutionReport(r)) return 'Substitution period (no plan)';
    return 'Unknown Chapter';
  }, [isSubstitutionReport]);

  const computeDates = useCallback(() => {
    const today = new Date();
    const isoToday = today.toISOString().split('T')[0];
    if (rangeMode === '7d') {
      const past = new Date(); past.setDate(past.getDate() - 6);
      return { from: past.toISOString().split('T')[0], to: isoToday };
    }
    if (rangeMode === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: isoToday };
    }
    if (rangeMode === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return { from: isoToday, to: isoToday };
  }, [rangeMode, customFrom, customTo]);

  const loadMyReports = useCallback(async () => {
    if (!email) return;
    const { from, to } = computeDates();
    setLoading(true);
    try {
      const data = await api.getDailyReports({ teacher: email, fromDate: from, toDate: to, cls: classFilter, subject: subjectFilter });
      let arr = Array.isArray(data) ? data : [];
      if (arr.length > maxDisplay) arr = arr.slice(0, maxDisplay);
      setReports(arr);
    } catch (e) {
      console.warn('Failed to load my reports', e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [email, computeDates, classFilter, subjectFilter, maxDisplay]);

  useEffect(() => { 
    setPage(1); 
    loadMyReports(); 
  }, [rangeMode, customFrom, customTo, subjectFilter, classFilter, email, maxDisplay, refreshTrigger, loadMyReports]);

  // Load teacher schemes to map total sessions by class/subject/chapter
  useEffect(() => {
    const loadSchemes = async () => {
      if (!email) return;
      try {
        const teacherSchemes = await api.getTeacherSchemes(email);
        const arr = Array.isArray(teacherSchemes) ? teacherSchemes : [];
        const map = {};
        for (const s of arr) {
          const key = `${(s.class||'').toLowerCase()}|${(s.subject||'').toLowerCase()}|${(s.chapter||'').toLowerCase()}`;
          const nos = Number(s.noOfSessions || s.totalSessions || 0);
          if (key && !isNaN(nos) && nos > 0) map[key] = nos;
        }
        setSchemeLookup(map);
      } catch (e) {
        console.warn('Failed to load teacher schemes for total sessions', e);
        setSchemeLookup({});
      }
    };
    loadSchemes();
  }, [email]);

  const getTotalSessionsForReport = useCallback((r) => {
    // Prefer value directly from report if backend provides
    const direct = Number(r.totalSessions || r.noOfSessions || 0);
    if (!isNaN(direct) && direct > 0) return direct;
    const key = `${(r.class||'').toLowerCase()}|${(r.subject||'').toLowerCase()}|${(r.chapter||'').toLowerCase()}`;
    return schemeLookup[key] || '';
  }, [schemeLookup]);

  const filteredReports = reports
    .filter(r => {
      if (!r) return false;
      if (substitutionOnly && !isSubstitutionReport(r)) return false;
      if (chapterFilter) {
        const needle = chapterFilter.toLowerCase().trim();
        const hay = getChapterDisplay(r).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

  const total = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = filteredReports.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    if (!filteredReports.length) return;
    const headers = ['Date','Class','Subject','Period','Chapter','Session','Completed','Notes'];
    const lines = [headers.join(',')].concat(filteredReports.map(r => [r.date, r.class, r.subject, `P${r.period}`, (getChapterDisplay(r)||'').replace(/,/g,';'), r.sessionNo||'', r.completed||'', (r.notes||'').replace(/\n/g,' ').replace(/,/g,';')].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const { from, to } = computeDates();
    a.download = `daily-reports-${email}-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportMissingReportsCSV = () => {
    const rows = Array.isArray(missingReportsSummary?.pending) ? missingReportsSummary.pending : [];
    if (!rows.length) return;
    const header = ['date','period','class','subject'];
    const csv = [header.join(',')]
      .concat(rows.map(r => {
        const vals = [r?.date, r?.period, r?.class, r?.subject].map(v => {
          const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
          const escaped = s.replace(/"/g, '""');
          return `"${escaped}"`;
        });
        return vals.join(',');
      }))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-daily-reports_${missingReportsSummary?.range?.from || 'from'}_${missingReportsSummary?.range?.to || 'to'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getCompletionLabel = useCallback((r) => {
    const pct = Number(r?.completionPercentage);
    if (!isNaN(pct)) {
      if (pct <= 0) return 'Not Started';
      if (pct < 50) return 'Started';
      if (pct < 75) return 'Half Done';
      if (pct < 100) return 'Almost Done';
      return 'Complete';
    }
    return r?.chapterStatus || r?.completed || r?.lessonProgressTracked || r?.status || '-';
  }, []);

  const isVerifiedReport = useCallback((r) => {
    const v = r?.verified;
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true', 'yes', '1', 'y', 't', 'verified', 'TRUE'].includes(v.trim().toLowerCase()) || v.trim() === 'TRUE';
    return false;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Daily Reports History</h1>
        <button onClick={() => setRefreshTrigger(t => t + 1)} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Missing Daily Reports</div>
            <div className="text-xs text-gray-600 mt-1">
              {missingReportsSummary.loading
                ? 'Checking till yesterday…'
                : `Range ${missingReportsSummary?.range?.from || '-'} → ${missingReportsSummary?.range?.to || missingReportsSummary.date}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {missingReportsSummary.missingDays > Number(memoizedSettings?.missingDailyReports?.escalationDays ?? 2) && !missingReportsSummary.loading && (
              <span className="text-xs font-semibold text-red-700">Meet the HM</span>
            )}
            <button
              type="button"
              onClick={exportMissingReportsCSV}
              disabled={missingReportsSummary.loading || !missingReportsSummary.pending.length}
              className="px-3 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
            >
              Download CSV
            </button>
          </div>
        </div>

        {!missingReportsSummary.loading && memoizedSettings?.missingDailyReports?.allowCustomRange !== false && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <label className="text-gray-600">
              From
              <input
                type="date"
                value={missingRangeDraft.from || ''}
                onChange={(e) => {
                  setMissingRangeTouched(true);
                  setMissingRangeDraft(prev => ({ ...prev, from: e.target.value }));
                }}
                className="ml-2 px-2 py-1 rounded border border-gray-200 bg-white text-gray-900"
              />
            </label>
            <label className="text-gray-600">
              To
              <input
                type="date"
                value={missingRangeDraft.to || ''}
                onChange={(e) => {
                  setMissingRangeTouched(true);
                  setMissingRangeDraft(prev => ({ ...prev, to: e.target.value }));
                }}
                className="ml-2 px-2 py-1 rounded border border-gray-200 bg-white text-gray-900"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setMissingRangeTouched(true);
                setMissingRange({
                  from: String(missingRangeDraft.from || '').trim(),
                  to: String(missingRangeDraft.to || '').trim()
                });
              }}
              className="px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800"
            >
              Apply
            </button>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-600">
          Missing days: <span className="font-semibold">{missingReportsSummary.missingDays}</span> · Total missing: <span className="font-semibold">{missingReportsSummary.count}</span>
        </div>

        {missingReportsSummary.loading ? (
          <div className="mt-3 text-sm text-gray-600">Loading…</div>
        ) : (!Array.isArray(missingReportsSummary.pending) || missingReportsSummary.pending.length === 0) ? (
          <div className="mt-3 text-sm text-gray-600">No missing reports found.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Period</th>
                  <th className="text-left font-medium px-3 py-2">Class</th>
                  <th className="text-left font-medium px-3 py-2">Subject</th>
                  <th className="text-left font-medium px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {missingReportsSummary.pending.map((p, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{String(p.date || '').trim() || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{String(p.period || '').trim() ? `P${String(p.period || '').trim()}` : '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{stripStdPrefix(String(p.class || '').trim() || '—')}</td>
                    <td className="px-3 py-2 text-gray-700">{String(p.subject || '').trim() || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {p.isSubstitution && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">Substitution</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex gap-2">
            <button onClick={() => setRangeMode('7d')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='7d' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Last 7 Days</button>
            <button onClick={() => setRangeMode('month')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>This Month</button>
            <button onClick={() => setRangeMode('custom')} className={`px-3 py-1 rounded-full text-sm ${rangeMode==='custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Custom</button>
          </div>
          {rangeMode === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              <span className="text-gray-500">to</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </div>
          )}
          <input placeholder="Class" value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="Subject" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="Chapter" value={chapterFilter} onChange={e=>setChapterFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input type="checkbox" checked={substitutionOnly} onChange={e=>setSubstitutionOnly(e.target.checked)} />
            Substitution only
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Page size</span>
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1);}} className="px-2 py-1 border rounded-lg">
              {[25,50,100,200].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Max</span>
            <select value={maxDisplay} onChange={e=> setMaxDisplay(Number(e.target.value))} className="px-2 py-1 border rounded-lg">
              {[200,500,1000].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={exportCSV} disabled={!filteredReports.length} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-40">Export CSV</button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setGroupByClass(v => { const next = !v; if (next) setGroupByChapter(false); return next; }); }}
              className={`px-3 py-2 text-sm rounded-md border ${groupByClass ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              title="Group by Class"
            >
              Group by Class
            </button>
            <button
              type="button"
              onClick={() => { setGroupByChapter(v => { const next = !v; if (next) setGroupByClass(false); return next; }); }}
              className={`px-3 py-2 text-sm rounded-md border ${groupByChapter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              title="Group by Chapter"
            >
              Group by Chapter
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-600">Showing reports for <strong>{email}</strong> {(() => { const {from,to}=computeDates(); return `(${from} → ${to})`; })()} • {total} total</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {(() => {
          const base = filteredReports;
          if (groupByClass || groupByChapter) {
            const keyFn = (r) => groupByClass ? (r.class || 'Unknown Class') : getChapterDisplay(r);
            const groups = {};
            for (const r of base) {
              const k = keyFn(r);
              if (!groups[k]) groups[k] = [];
              groups[k].push(r);
            }
            const keys = Object.keys(groups).sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return (
              <div className="divide-y divide-gray-200">
                {keys.map(k => {
                  const list = groups[k].slice().sort((a,b)=> {
                    // sort by date then period
                    const ad = String(a.date||'');
                    const bd = String(b.date||'');
                    const ds = ad.localeCompare(bd);
                    if (ds !== 0) return ds;
                    return Number(a.period||0) - Number(b.period||0);
                  });
                  return (
                    <div key={k} className="">
                      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                        <div className="font-semibold text-gray-900">{groupByClass ? `Class: ${k}` : `Chapter: ${k}`}</div>
                        <div className="text-xs text-gray-600">{list.length} report(s)</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                              {!groupByClass && (<th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>)}
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Period</th>
                              {!groupByChapter && (<th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>)}
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Session</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Total Sessions</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Completed</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {list.map(r => {
                              const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                              const displayDate = (() => {
                                const d = r.date;
                                if (!d) return '-';
                                const s = String(d);
                                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                                try { const dt = new Date(s); if (!isNaN(dt.getTime())) return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); } catch {}
                                if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
                                return s;
                              })();
                              const completedVal = getCompletionLabel(r);
                              const subTag = isSubstitutionReport(r);
                              return (
                                <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}>
                                  <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                                  {!groupByClass && (<td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>)}
                                  <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                                  <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                                  {!groupByChapter && (
                                    <td className="px-2 py-2 text-xs text-gray-700 truncate" title={subTag ? 'Substitution period' : ''}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        {subTag && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">Substitution</span>
                                        )}
                                        <span className="truncate">{getChapterDisplay(r)}</span>
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                                  <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                                  <td className="px-2 py-2 text-xs">{completedVal}</td>
                                  <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                                  <td className="px-2 py-2 text-xs">
                                    {isVerifiedReport(r) ? (
                                      <div className="flex flex-col gap-1">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Verified</span>
                                        {r.verifiedBy && (<span className="text-[10px] text-gray-500">by {r.verifiedBy.split('@')[0]}</span>)}
                                      </div>
                                    ) : r.reopenReason ? (
                                      <div className="flex flex-col gap-1">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Reopened</span>
                                        <span className="text-[10px] text-gray-600 cursor-help max-w-[120px] truncate" title={r.reopenReason}>{r.reopenReason}</span>
                                        {r.reopenedBy && (<span className="text-[10px] text-gray-500">by {r.reopenedBy.split('@')[0]}</span>)}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-700">Submitted</span>
                                    )}
                                  </td>
                                    <td className="px-2 py-2 text-xs text-right"></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Flat, paginated table when grouping is off
          return (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Reports ({total})</h2>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <button onClick={()=> setPage(p=> Math.max(1, p-1))} disabled={page===1} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                  <span>Page {page}/{totalPages}</span>
                  <button onClick={()=> setPage(p=> Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Class</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Subject</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Period</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Chapter</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Session</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Total Sessions</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Completed</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading && (<tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">Loading...</td></tr>)}
                    {!loading && filteredReports.length === 0 && (<tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No reports in this range.</td></tr>)}
                    {!loading && paginated.map(r => {
                      const id = r.id || r.reportId || `${(r.date||'').toString()}|${r.class||''}|${r.subject||''}|${r.period||''}|${String(r.teacherEmail||'').toLowerCase()}`;
                      const displayDate = (() => {
                        const d = r.date;
                        if (!d) return '-';
                        const s = String(d);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                        try { const dt = new Date(s); if (!isNaN(dt.getTime())) return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); } catch {}
                        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0];
                        return s;
                      })();
                      const completedVal = getCompletionLabel(r);
                      const subTag = isSubstitutionReport(r);
                      return (
                      <tr key={id || `${r.date}|${r.class}|${r.subject}|${r.period}`}> 
                        <td className="px-2 py-2 text-xs text-gray-900">{displayDate}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{r.class}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{r.subject}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">P{r.period}</td>
                        <td className="px-2 py-2 text-xs text-gray-700 truncate" title={subTag ? 'Substitution period' : ''}>
                          <div className="flex items-center gap-2 min-w-0">
                            {subTag && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">Substitution</span>
                            )}
                            <span className="truncate">{getChapterDisplay(r)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700">{r.sessionNo || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{getTotalSessionsForReport(r) || '-'}</td>
                        <td className="px-2 py-2 text-xs">{completedVal}</td>
                        <td className="px-2 py-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                        <td className="px-2 py-2 text-xs">
                          {isVerifiedReport(r) ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Verified</span>
                              {r.verifiedBy && (<span className="text-[10px] text-gray-500">by {r.verifiedBy.split('@')[0]}</span>)}
                            </div>
                          ) : r.reopenReason ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Reopened</span>
                              <span className="text-[10px] text-gray-600 cursor-help max-w-[120px] truncate" title={r.reopenReason}>{r.reopenReason}</span>
                              {r.reopenedBy && (<span className="text-[10px] text-gray-500">by {r.reopenedBy.split('@')[0]}</span>)}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-700">Submitted</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default MyDailyReportsView;
