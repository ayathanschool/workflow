import React, { useEffect, useState, useMemo } from 'react';
import { getPendingLessonPlans, batchUpdateLessonPlanStatus } from '../api';
import LoadingSpinner from './LoadingSpinner.jsx';

// HM Lesson Plan Approval (Batchwise & Chapterwise)
// Additive component: no existing logic replaced.
export default function HMLessonPlanApproval({ currentUser }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('batch'); // 'batch' | 'chapter'
  const [filters, setFilters] = useState({ teacher: '', class: '', subject: '', status: 'Pending Review', search: '' });
  const [selection, setSelection] = useState(new Set());
  const [bulkState, setBulkState] = useState({ working: false, result: null });

  const isHM = useMemo(() => {
    if (!currentUser) return false;
    const rawRoles = currentUser.roles;
    const roleArray = Array.isArray(rawRoles)
      ? rawRoles
      : String(rawRoles || '')
          .split(/[,]/)
          .map(r => r.trim())
          .filter(Boolean);
    if (roleArray.length === 0) return false;
    return roleArray.some(r => {
      const norm = String(r).toLowerCase().replace(/[^a-z]/g, '');
      if (['hm','headmaster','headteacher','headmistress','principal'].includes(norm)) return true;
      // Handle split variants like "h m" or "head master"
      return norm === 'head' && roleArray.some(rr => /master|teacher|mistress/i.test(rr));
    });
  }, [currentUser]);

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line
  }, [filters.status]);

  async function loadPending() {
    setLoading(true); setError('');
    try {
      const res = await getPendingLessonPlans(filters);
      setPending(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelection(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  }

  function clearSelection() { setSelection(new Set()); }

  const filtered = useMemo(() => {
    let rows = pending;
    if (filters.teacher) {
      const t = filters.teacher.toLowerCase();
      rows = rows.filter(r => String(r.teacherName||'').toLowerCase().includes(t) || String(r.teacherEmail||'').toLowerCase().includes(t));
    }
    if (filters.class) {
      rows = rows.filter(r => String(r.class||'').toLowerCase() === filters.class.toLowerCase());
    }
    if (filters.subject) {
      rows = rows.filter(r => String(r.subject||'').toLowerCase() === filters.subject.toLowerCase());
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      rows = rows.filter(r => String(r.chapter||'').toLowerCase().includes(s));
    }
    return rows;
  }, [pending, filters]);

  const batchGroups = useMemo(() => {
    const map = {};
    filtered.forEach(lp => {
      const key = String(lp.class || 'Unknown');
      if (!map[key]) map[key] = [];
      map[key].push(lp);
    });
    return Object.entries(map).map(([batch, items]) => ({ batch, items }));
  }, [filtered]);

  const chapterGroups = useMemo(() => {
    const map = {};
    filtered.forEach(lp => {
      const key = (lp.chapter ? String(lp.chapter) : 'No Chapter');
      if (!map[key]) map[key] = [];
      map[key].push(lp);
    });
    return Object.entries(map).map(([chapter, items]) => ({ chapter, items }));
  }, [filtered]);

  async function bulkApprove() {
    if (!isHM || selection.size === 0) return;
    setBulkState({ working: true, result: null });
    try {
      const ids = Array.from(selection);
      const requesterEmail = currentUser?.email || '';
      const res = await batchUpdateLessonPlanStatus(ids, 'Ready', 'Approved', requesterEmail);
      const unwrapped = res && (res.data || res);
      const ok = !!(unwrapped && (unwrapped.success || unwrapped.ok));
      setBulkState({ working: false, result: unwrapped });
      if (ok) {
        await loadPending();
        clearSelection();
      }
    } catch (e) {
      setBulkState({ working: false, result: { error: e.message || 'Bulk failed' } });
    }
  }

  function renderGroupItems(items) {
    return (
      <table className="min-w-full text-sm border mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Select</th>
            <th className="p-2">Class</th>
            <th className="p-2">Subject</th>
            <th className="p-2">Chapter</th>
            <th className="p-2">Session</th>
            <th className="p-2">Teacher</th>
            <th className="p-2">Date</th>
            <th className="p-2">Period</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(lp => {
            const id = lp.lpId || lp.lessonPlanId || lp.id;
            const checked = selection.has(id);
            return (
              <tr key={id} className="border-t hover:bg-yellow-50">
                <td className="p-2"><input type="checkbox" disabled={!isHM} checked={checked} onChange={() => toggle(id)} /></td>
                <td className="p-2">{lp.class}</td>
                <td className="p-2">{lp.subject}</td>
                <td className="p-2">{lp.chapter}</td>
                <td className="p-2">{lp.session}</td>
                <td className="p-2">{lp.teacherName || lp.teacherEmail}</td>
                <td className="p-2">{lp.selectedDate || lp.date || ''}</td>
                <td className="p-2">{lp.selectedPeriod || lp.period || ''}</td>
                <td className="p-2">{lp.status === 'Ready' ? 'Approved' : lp.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-3">HM Lesson Plan Approval</h2>
      {!isHM && <div className="text-red-600 mb-2">HM role required for approvals (view only).</div>}
      {/* Sticky controls bar stays visible while scrolling */}
      <div className="flex flex-wrap gap-2 mb-3 items-center sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 py-2 px-2 -mx-2">
        <input placeholder="Teacher" className="border px-2 py-1" value={filters.teacher} onChange={e => setFilters(f => ({ ...f, teacher: e.target.value }))} />
        <input placeholder="Class" className="border px-2 py-1" value={filters.class} onChange={e => setFilters(f => ({ ...f, class: e.target.value }))} />
        <input placeholder="Subject" className="border px-2 py-1" value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} />
        <input placeholder="Search chapter" className="border px-2 py-1" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        <select className="border px-2 py-1" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="Pending Review">Pending Review</option>
          <option value="All">All Statuses</option>
        </select>
        <div className="ml-auto flex gap-2 items-center">
          <button onClick={loadPending} className="bg-blue-600 text-white px-3 py-1 rounded">Refresh</button>
          {isHM && (
            <button
              disabled={bulkState.working || selection.size === 0}
              onClick={bulkApprove}
              className={`px-3 py-1 rounded text-white ${selection.size>0 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
              title={selection.size>0 ? `Approve Selected (${selection.size})` : 'Select rows to enable approval'}
            >
              {bulkState.working ? 'Approving...' : `Approve (${selection.size||0})`}
            </button>
          )}
          {selection.size > 0 && !bulkState.working && (
            <button onClick={clearSelection} className="bg-gray-300 px-3 py-1 rounded">Clear</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${activeTab==='batch' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`} onClick={() => setActiveTab('batch')}>Batchwise</button>
        <button className={`px-3 py-1 rounded ${activeTab==='chapter' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`} onClick={() => setActiveTab('chapter')}>Chapterwise</button>
      </div>

      {loading && <LoadingSpinner label="Loading pending plans" />}
      {error && <div className="text-red-600 mb-2">{error}</div>}

      {!loading && !error && (
        <div>
          {activeTab === 'batch' && batchGroups.map(g => (
            <div key={g.batch} className="mb-6">
              <div className="font-semibold mb-1">Batch: {g.batch} <span className="text-xs text-gray-500">({g.items.length} plans)</span></div>
              {renderGroupItems(g.items)}
            </div>
          ))}
          {activeTab === 'chapter' && chapterGroups.map(g => (
            <div key={g.chapter} className="mb-6">
              <div className="font-semibold mb-1">Chapter: {g.chapter} <span className="text-xs text-gray-500">({g.items.length} plans)</span></div>
              {renderGroupItems(g.items)}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-sm text-gray-600">No lesson plans match filters.</div>}
        </div>
      )}

      {bulkState.result && (
        <div className="mt-4 text-sm">
          {bulkState.result.error && <div className="text-red-600">Bulk Error: {bulkState.result.error}</div>}
          {bulkState.result.success && <div className="text-green-700">Bulk Success: {bulkState.result.successCount} / {bulkState.result.totalRequested} approved.</div>}
          {bulkState.result.errors && bulkState.result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">Errors ({bulkState.result.errors.length})</summary>
              <ul className="list-disc ml-5">
                {bulkState.result.errors.map(er => <li key={er.lpId}>{er.lpId}: {er.error}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
