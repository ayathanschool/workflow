import React, { useEffect, useState, useMemo } from 'react';
import { fetchJSON } from '../api'; // assuming api.js exports helper
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
    const roles = String(currentUser?.roles || '').toLowerCase();
    return /hm|headmaster|principal|headteacher|headmistress/.test(roles);
  }, [currentUser]);

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line
  }, [filters.status]);

  async function loadPending() {
    setLoading(true); setError('');
    try {
      const params = { action: 'getPendingLessonPlans', ...filters };
      const qs = Object.entries(params).filter(([k,v]) => v!=='' && v!=null).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const res = await fetchJSON('GET', qs);
      if (res.error) setError(res.error); else setPending(Array.isArray(res) ? res : []);
    } catch (e) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
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
      const payload = { action: 'batchUpdateLessonPlanStatus', lessonPlanIds: ids, status: 'Ready', reviewComments: 'Approved' };
      const res = await fetchJSON('POST', payload);
      setBulkState({ working: false, result: res });
      if (res && res.success) {
        // Refresh list and clear selection
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
                <td className="p-2">{lp.status}</td>
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

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input placeholder="Teacher" className="border px-2 py-1" value={filters.teacher} onChange={e => setFilters(f => ({ ...f, teacher: e.target.value }))} />
        <input placeholder="Class" className="border px-2 py-1" value={filters.class} onChange={e => setFilters(f => ({ ...f, class: e.target.value }))} />
        <input placeholder="Subject" className="border px-2 py-1" value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} />
        <input placeholder="Search chapter" className="border px-2 py-1" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        <select className="border px-2 py-1" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="Pending Review">Pending Review</option>
          <option value="All">All Statuses</option>
        </select>
        <button onClick={loadPending} className="bg-blue-600 text-white px-3 py-1 rounded">Refresh</button>
        {isHM && selection.size > 0 && (
          <button disabled={bulkState.working} onClick={bulkApprove} className="bg-green-600 text-white px-3 py-1 rounded">
            {bulkState.working ? 'Approving...' : `Approve Selected (${selection.size})`}
          </button>
        )}
        {selection.size > 0 && !bulkState.working && (
          <button onClick={clearSelection} className="bg-gray-300 px-3 py-1 rounded">Clear</button>
        )}
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
