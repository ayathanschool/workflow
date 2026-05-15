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

  const isadmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.includes('admin') || roles.includes('admin') || roles.includes('admin');
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
    if (isadmin) load();
    return () => { mounted = false; };
  }, [email, isadmin]);

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
    if (!isadmin) return;
    if (!selectedSheet) return;
    refreshSheet(selectedSheet);
  }, [selectedSheet, isadmin]);

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

  if (!isadmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-gray-600 dark:text-gray-300">Permission denied. admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Data</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Row</h2>
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
                  <div className="text-gray-600 dark:text-gray-300 mb-1">{h}</div>
                  <input
                    value={draftNewRow[h] ?? ''}
                    onChange={(e) => onChangeNew(h, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rows ({rows.length})</h2>
              {saving && <span className="text-sm text-gray-600 dark:text-gray-300">Saving...</span>}
            </div>
            {headers.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-300">No headers found in this sheet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3 text-gray-600 dark:text-gray-300">Row</th>
                    {headers.map(h => (
                      <th key={h} className="py-2 pr-3 text-gray-600 dark:text-gray-300">{h}</th>
                    ))}
                    <th className="py-2 text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const rowNumber = r.__rowNumber;
                    const edits = rowEdits[rowNumber] || {};
                    const isDirty = Object.keys(edits).length > 0;
                    return (
                      <tr key={rowNumber} className="border-b border-gray-100 dark:border-gray-700 align-top">
                        <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{rowNumber}</td>
                        {headers.map(h => (
                          <td key={h} className="py-2 pr-3">
                            <input
                              value={edits[h] ?? (r[h] ?? '')}
                              onChange={(e) => onEditCell(rowNumber, h, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
