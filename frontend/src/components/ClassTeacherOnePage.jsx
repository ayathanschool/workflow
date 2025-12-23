import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';

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

  const [pendingExamMarks, setPendingExamMarks] = useState({ loading: false, rows: [] });

  const hasAccess = useMemo(() => {
    const roles = (user?.roles || []).map(r => String(r).toLowerCase());
    return roles.some(r => r.includes('class teacher') || r === 'classteacher');
  }, [user]);

  useEffect(() => {
    const init = async () => {
      if (!className) return;
      try {
        setLoading(true);
        setError('');
        const [clsStudents, allExams] = await Promise.all([
          api.getStudents(className),
          api.getAllExams()
        ]);
        // Pending-only list for this class (server-side)
        try {
          setPendingExamMarks({ loading: true, rows: [] });
          const res = await api.getExamMarksEntryPending({
            class: className,
            limit: 50,
            teacherEmail: user?.email || '',
            role: (user?.roles || []).join(',')
          });
          setPendingExamMarks({ loading: false, rows: res?.pending || [] });
        } catch (e) {
          console.warn('Failed to load class pending exam marks:', e);
          setPendingExamMarks({ loading: false, rows: [] });
        }

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

  const pendingCount = useMemo(() => (pendingExamMarks.rows || []).length, [pendingExamMarks.rows]);

  const generateMatrix = async () => {
    if (!className || students.length === 0 || selectedExamTypes.length === 0) return;
    try {
      setLoading(true);
      setError('');
      const totalCalls = students.length * selectedExamTypes.length;
      setProgress({ current: 0, total: totalCalls });
      const nextMatrix = {};

      // Build all report calls in parallel
      const tasks = [];
      students.forEach(s => {
        const admNo = s.admNo || s.AdmNo || s.ID || s.id;
        if (!admNo) return;
        if (!nextMatrix[admNo]) {
          nextMatrix[admNo] = { studentName: s.name || s.Name || 'Unknown', byExam: {} };
        }
        selectedExamTypes.forEach(exType => {
          tasks.push((async () => {
            try {
              const data = await api.getStudentReportCard(exType, String(admNo), className);
              const studentRecord = Array.isArray(data?.students) ? data.students.find(st => String(st.admNo) === String(admNo)) : null;
              if (studentRecord) {
                nextMatrix[admNo].byExam[exType] = {
                  total: studentRecord.totalMarks || 0,
                  grade: studentRecord.grade || 'N/A',
                  percentage: studentRecord.percentage || 0
                };
              } else {
                nextMatrix[admNo].byExam[exType] = { total: 0, grade: 'N/A', percentage: 0 };
              }
            } finally {
              setProgress(prev => ({ current: prev.current + 1, total: prev.total }));
            }
          })());
        });
      });

      await Promise.all(tasks);
      setMatrix(nextMatrix);
    } catch (err) {
      setError('Failed to build matrix: ' + (err.message || 'Unknown error'));
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

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Exam Marks Entry Pending</h3>
            <p className="text-xs text-gray-600">Only subjects with pending marks are shown (pending=0 means completed)</p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              Pending Exams: {pendingExamMarks.loading ? '…' : pendingCount}
            </span>
          </div>
        </div>

        {pendingExamMarks.loading ? (
          <div className="mt-3 text-sm text-gray-500">Loading…</div>
        ) : (pendingExamMarks.rows || []).length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">No pending marks for {className}. ✅</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Exam</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Marks</th>
                  <th className="py-2 pr-3">Pending</th>
                </tr>
              </thead>
              <tbody>
                {pendingExamMarks.rows.slice(0, 10).map(r => (
                  <tr key={r.examId} className="border-t">
                    <td className="py-2 pr-3">{r.examType || r.examId}</td>
                    <td className="py-2 pr-3">{r.subject || ''}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        {(r.enteredCount ?? 0)}/{(r.totalStudents ?? 0)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{r.missingCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <button onClick={generateMatrix} disabled={loading || selectedExamTypes.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {loading ? 'Building…' : 'Generate View'}
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
