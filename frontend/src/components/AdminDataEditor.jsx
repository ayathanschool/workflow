import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';

export default function AdminDataEditor({ user }) {
  const email = user?.email || '';
  const name = user?.name || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('Settings');

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);

  const [draftNewRow, setDraftNewRow] = useState({});
  const [rowEdits, setRowEdits] = useState({}); // rowNumber -> { col: value }

  const isSuperAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.includes('super admin') || roles.includes('superadmin') || roles.includes('super_admin');
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.adminListSheets(email);
        const list = res?.sheets || [];
        if (!mounted) return;
        setSheets(list);
        // pick a default that exists in config
        const preferred = list.find(s => s.name === 'Settings')?.name || list[0]?.name || '';
        setSelectedSheet(preferred);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (isSuperAdmin) load();
    return () => { mounted = false; };
  }, [email, isSuperAdmin]);

  const refreshSheet = async (sheetName) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminGetSheet(email, sheetName);
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to load sheet');
      }
      setHeaders(Array.isArray(res.headers) ? res.headers.filter(Boolean) : []);
      setRows(Array.isArray(res.rows) ? res.rows : []);
      setRowEdits({});
      setDraftNewRow({});
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!selectedSheet) return;
    refreshSheet(selectedSheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet, isSuperAdmin]);

  const onEditCell = (rowNumber, key, value) => {
    setRowEdits(prev => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        [key]: value
      }
    }));
  };

  const onSaveRow = async (rowObj) => {
    const rowNumber = rowObj.__rowNumber;
    const edits = rowEdits[rowNumber];
    if (!rowNumber || !edits || Object.keys(edits).length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const payloadRow = { ...rowObj, ...edits };
      delete payloadRow.__rowNumber;
      const res = await api.adminUpdateRow(email, name, selectedSheet, rowNumber, payloadRow);
      if (!res?.success) throw new Error(res?.error || 'Update failed');
      await refreshSheet(selectedSheet);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteRow = async (rowObj) => {
    const rowNumber = rowObj.__rowNumber;
    if (!rowNumber) return;
    const ok = window.confirm(`Delete row ${rowNumber} from ${selectedSheet}?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      const res = await api.adminDeleteRow(email, name, selectedSheet, rowNumber);
      if (!res?.success) throw new Error(res?.error || 'Delete failed');
      await refreshSheet(selectedSheet);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const onChangeNew = (key, value) => {
    setDraftNewRow(prev => ({ ...prev, [key]: value }));
  };

  const onAddRow = async () => {
    setSaving(true);
    setError(null);
    try {
      const row = {};
      headers.forEach(h => { row[h] = draftNewRow[h] ?? ''; });
      const res = await api.adminAppendRow(email, name, selectedSheet, row);
      if (!res?.success) throw new Error(res?.error || 'Add failed');
      await refreshSheet(selectedSheet);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">Permission denied. Super Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Data</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            {sheets.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => refreshSheet(selectedSheet)}
            disabled={loading || saving}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Row</h2>
              <button
                onClick={onAddRow}
                disabled={saving || headers.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {headers.map(h => (
                <label key={h} className="text-sm">
                  <div className="text-gray-600 mb-1">{h}</div>
                  <input
                    value={draftNewRow[h] ?? ''}
                    onChange={(e) => onChangeNew(h, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Rows ({rows.length})</h2>
              {saving && <span className="text-sm text-gray-600">Saving...</span>}
            </div>
            {headers.length === 0 ? (
              <p className="text-gray-600">No headers found in this sheet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3 text-gray-600">Row</th>
                    {headers.map(h => (
                      <th key={h} className="py-2 pr-3 text-gray-600">{h}</th>
                    ))}
                    <th className="py-2 text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const rowNumber = r.__rowNumber;
                    const edits = rowEdits[rowNumber] || {};
                    const isDirty = Object.keys(edits).length > 0;
                    return (
                      <tr key={rowNumber} className="border-b align-top">
                        <td className="py-2 pr-3 text-gray-500">{rowNumber}</td>
                        {headers.map(h => (
                          <td key={h} className="py-2 pr-3">
                            <input
                              value={edits[h] ?? (r[h] ?? '')}
                              onChange={(e) => onEditCell(rowNumber, h, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded"
                            />
                          </td>
                        ))}
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => onSaveRow(r)}
                              disabled={!isDirty || saving}
                              className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => onDeleteRow(r)}
                              disabled={saving}
                              className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
