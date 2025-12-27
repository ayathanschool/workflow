import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';

// Helper to build matrix from batch API response
function buildMatrixFromBatch(students, batchRes, selectedExamTypes) {
  const m = {};

  // init base with student list (so UI can render even if some exams missing)
  (students || []).forEach(s => {
    const admNo = String(s.admNo || s.admissionNo || s.adm || '').trim();
    if (!admNo) return;
    m[admNo] = {
      studentName: s.name || s.studentName || '',
      byExam: {}
    };
  });

  const data = (batchRes && batchRes.data) || {};

  (selectedExamTypes || []).forEach(examType => {
    const one = data[examType] || {};
    // depending on your backend return, the class list could be in different keys
    const list =
      one.students ||
      one.data ||
      one.reportCards ||
      one.items ||
      [];

    (list || []).forEach(row => {
      const admNo = String(row.admNo || row.admissionNo || row.adm || '').trim();
      if (!admNo) return;

      if (!m[admNo]) {
        m[admNo] = { studentName: row.name || row.studentName || '', byExam: {} };
      }

      m[admNo].byExam[examType] = {
        total: Number(row.total ?? row.totalMarks ?? 0),
        grade: row.grade ?? row.finalGrade ?? '',
        percentage: Number(row.percentage ?? row.percent ?? 0)
      };

      // keep best studentName available
      if (!m[admNo].studentName) m[admNo].studentName = row.name || row.studentName || '';
    });
  });

  return m;
}

// One-page class view: matrix of students x exam types with grade/total
const ClassTeacherOnePage = ({ user }) => {
  const className = user?.classTeacherFor || '';
  const [students, setStudents] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [selectedExamTypes, setSelectedExamTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [matrix, setMatrix] = useState({}); // { admNo: { studentName, byExam: { examType: { total, grade, percentage } } } }

  const hasAccess = useMemo(() => {
    const roles = (user?.roles || []).map(r => String(r).toLowerCase());
    return roles.some(r => r.includes('class teacher') || r === 'classteacher');
  }, [user]);

  useEffect(() => {
    const init = async () => {
      if (!className) {
      setLoading(false);
      return;
    }
      try {
        setLoading(true);
        setError('');
        const [clsStudents, allExams] = await Promise.all([
          api.getStudents(className),
          api.getAllExams()
        ]);

        const forClass = (allExams || []).filter(e => String(e.class||'').trim() === String(className).trim());
        const types = [...new Set(forClass
          .map(e => e.examType)
          .filter(Boolean)
        )].sort();
        setStudents(Array.isArray(clsStudents) ? clsStudents : []);
        setExamTypes(types);
        setSelectedExamTypes(types);
      } catch (err) {
        setError('Failed to load class data: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [className]);

  // Auto-load matrix when students or exam types change
  useEffect(() => {
    let cancelled = false;

    async function loadMatrix() {
      try {
        if (!students || students.length === 0) {
      setLoading(false);
      return;
    }
        if (!selectedExamTypes || selectedExamTypes.length === 0) {
      setMatrix({});
      setLoading(false);
      return;
    }

        setLoading(true);
        setError('');

        const res = await api.getReportCardsBatch(className, selectedExamTypes, students);

        if (cancelled) return;

        if (res && res.ok) {
          const m = buildMatrixFromBatch(students, res, selectedExamTypes);
          setMatrix(m);
        } else {
          console.error('getReportCardsBatch failed', res);
          setMatrix({});
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Failed to load matrix: ' + (err.message || 'Unknown error'));
          setMatrix({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMatrix();
    return () => { cancelled = true; };
  }, [students, selectedExamTypes, className]);

  // Manual refresh function (keep as backup/refresh button)
  const refreshMatrix = async () => {
    if (!className || students.length === 0 || selectedExamTypes.length === 0) return;
    try {
      setLoading(true);
      setError('');

      const batchRes = await api.getReportCardsBatch(className, selectedExamTypes, students);
      
      if (!batchRes || !batchRes.ok) {
        throw new Error(batchRes?.error || 'Batch fetch failed');
      }

      const nextMatrix = buildMatrixFromBatch(students, batchRes, selectedExamTypes);
      setMatrix(nextMatrix);
    } catch (err) {
      setError('Failed to refresh matrix: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };


  const exportCSV = () => {
    const rows = [];
    const header = ['AdmNo', 'Student', ...selectedExamTypes.map(t => `${t} Total`), ...selectedExamTypes.map(t => `${t} Grade`)];
    rows.push(header.join(','));
    Object.entries(matrix).forEach(([admNo, rec]) => {
      const totals = selectedExamTypes.map(t => rec.byExam?.[t]?.total ?? '');
      const grades = selectedExamTypes.map(t => rec.byExam?.[t]?.grade ?? '');
      rows.push([admNo, rec.studentName, ...totals, ...grades].join(','));
    });
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_${className.replace(/\s+/g,'_')}_one_page.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAccess) {
    return (
      <div className="p-6 text-gray-600">This view is for Class Teachers only.</div>
    );
  }
  if (!className) {
    return (
      <div className="p-6 text-gray-600">No assigned class found for your profile.</div>
    );
  }

  const admNos = Object.keys(matrix);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Class One-Page View</h2>
        <p className="text-sm text-gray-600">{className} • Students: {students.length}</p>
      </div>

      {examTypes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Exam Types</label>
          <div className="flex flex-wrap gap-2">
            {examTypes.map((type) => {
              const checked = selectedExamTypes.includes(type);
              return (
                <label key={type} className="inline-flex items-center bg-gray-50 px-3 py-1 rounded border text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedExamTypes([...selectedExamTypes, type]);
                      } else {
                        setSelectedExamTypes(selectedExamTypes.filter(t => t !== type));
                      }
                    }}
                  />
                  <span className="text-gray-700">{type}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-1">{selectedExamTypes.length} selected</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={refreshMatrix} disabled={loading || selectedExamTypes.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {loading ? 'Refreshing…' : 'Refresh Data'}
        </button>
        {admNos.length > 0 && (
          <button onClick={exportCSV} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">Export CSV</button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      {loading && (
        <div className="text-sm text-gray-600">Progress: {progress.current} / {progress.total}</div>
      )}

      {admNos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-3 py-2 text-left">AdmNo</th>
                <th className="border px-3 py-2 text-left">Student</th>
                {selectedExamTypes.map(t => (
                  <th key={`tot-${t}`} className="border px-3 py-2 text-center">{t} Total</th>
                ))}
                {selectedExamTypes.map(t => (
                  <th key={`gr-${t}`} className="border px-3 py-2 text-center">{t} Grade</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admNos.map(admNo => (
                <tr key={admNo}>
                  <td className="border px-3 py-2">{admNo}</td>
                  <td className="border px-3 py-2">{matrix[admNo].studentName}</td>
                  {selectedExamTypes.map(t => (
                    <td key={`totv-${admNo}-${t}`} className="border px-3 py-2 text-center">{matrix[admNo].byExam?.[t]?.total ?? ''}</td>
                  ))}
                  {selectedExamTypes.map(t => (
                    <td key={`grv-${admNo}-${t}`} className="border px-3 py-2 text-center font-semibold">{matrix[admNo].byExam?.[t]?.grade ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClassTeacherOnePage;
