import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';

const displayClass = (cls) => {
  const v = Array.isArray(cls) ? cls[0] : cls;
  return String(v ?? '').trim().replace(/^STD\s*/i, '').trim();
};

function normalizeSubject(s) {
  return String(s ?? '').trim();
}

function formatCell(subjectResult, { showMax } = {}) {
  if (!subjectResult) return '—';
  const total = subjectResult.total ?? '';
  const max = subjectResult.maxMarks ?? '';
  const grade = subjectResult.grade ?? '';
  if (total === '' && max === '' && grade === '') return '—';
  if (grade) {
    if (showMax && max !== '') return `${total}/${max} (${grade})`;
    return `${total} (${grade})`;
  }
  if (showMax && max !== '') return `${total}/${max}`;
  return String(total);
}

function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sanitizeFilePart(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

export default function ExamMarksMatrix({ user }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [classes, setClasses] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMaxInCells, setShowMaxInCells] = useState(false);
  const [showMaxInHeaders, setShowMaxInHeaders] = useState(false);
  const [showSummaryRows, setShowSummaryRows] = useState(true);

  // Roles (same approach used in ReportCard/Marklist)
  const userRoles = user?.roles || [];
  const isHM = userRoles && userRoles.some(role => {
    const roleLower = (role || '').toLowerCase().trim();
    const roleNoSpaces = roleLower.replace(/\s+/g, '');
    return roleNoSpaces === 'hm' || roleLower.includes('head master') || roleLower.includes('headmaster');
  });

  useEffect(() => {
    const loadClasses = async () => {
      try {
        if (isHM) {
          const allClasses = await api.getAllClasses();
          setClasses(allClasses || []);
        } else if (user?.classTeacherFor) {
          setClasses([user.classTeacherFor]);
        } else if (user?.classes) {
          setClasses(user.classes);
        } else {
          setClasses([]);
        }
      } catch {
        setClasses(user?.classes || (user?.classTeacherFor ? [user.classTeacherFor] : []));
      }
    };

    if (user) loadClasses();
  }, [user, isHM]);

  useEffect(() => {
    const loadExamTypes = async () => {
      try {
        const allExams = await api.getAllExams();
        const types = [...new Set((allExams || []).map(e => e.examType).filter(Boolean))].sort();
        setExamTypes(types);
        if (!selectedExamType && types.length) setSelectedExamType(types[0]);
      } catch {
        setExamTypes([]);
      }
    };

    loadExamTypes();
  }, []);

  useEffect(() => {
    const loadMatrix = async () => {
      if (!selectedClass || !selectedExamType) {
        setReportData(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await api.getStudentReportCard(selectedExamType, '', selectedClass);
        if (data?.error) throw new Error(String(data.error));
        setReportData(data);
      } catch (e) {
        setReportData(null);
        setError(String(e?.message || e || 'Failed to load'));
      } finally {
        setLoading(false);
      }
    };

    loadMatrix();
  }, [selectedClass, selectedExamType]);

  const subjectColumns = useMemo(() => {
    const exams = Array.isArray(reportData?.exams) ? reportData.exams : [];
    const map = new Map();
    for (const ex of exams) {
      const subject = normalizeSubject(ex?.subject);
      if (!subject) continue;
      const max = Number(ex?.totalMax || (Number(ex?.internalMax || 0) + Number(ex?.externalMax || 0)) || 0) || '';
      if (!map.has(subject)) {
        map.set(subject, { subject, max });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [reportData]);

  const students = useMemo(() => {
    const list = Array.isArray(reportData?.students) ? reportData.students : [];
    return list.slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [reportData]);

  const subjectStats = useMemo(() => {
    const stats = {};
    for (const c of subjectColumns) {
      stats[c.subject] = { sum: 0, count: 0, min: null, max: null };
    }

    for (const s of students) {
      for (const c of subjectColumns) {
        const r = s?.subjects ? s.subjects[c.subject] : null;
        const v = Number(r?.total);
        if (r == null || r.total == null || r.total === '' || Number.isNaN(v)) continue;
        const st = stats[c.subject];
        st.sum += v;
        st.count += 1;
        st.min = st.min == null ? v : Math.min(st.min, v);
        st.max = st.max == null ? v : Math.max(st.max, v);
      }
    }

    return stats;
  }, [students, subjectColumns]);

  const downloadCsv = () => {
    if (!selectedClass || !selectedExamType || !reportData) return;

    const header = ['AdmNo', 'Student Name'];
    subjectColumns.forEach((c) => {
      header.push(`${c.subject} Scored`);
      header.push(`${c.subject} Max`);
      header.push(`${c.subject} Grade`);
    });
    header.push('Total Scored', 'Total Max', 'Overall %', 'Overall Grade');

    const rows = [header];
    students.forEach((s) => {
      const row = [
        escapeCsv(s?.admNo ?? ''),
        escapeCsv(s?.name ?? '')
      ];

      subjectColumns.forEach((c) => {
        const r = s?.subjects ? s.subjects[c.subject] : null;
        row.push(escapeCsv(r?.total ?? ''));
        row.push(escapeCsv(r?.maxMarks ?? c.max ?? ''));
        row.push(escapeCsv(r?.grade ?? ''));
      });

      row.push(
        escapeCsv(s?.totalMarks ?? ''),
        escapeCsv(s?.maxMarks ?? ''),
        escapeCsv(s?.percentage ?? ''),
        escapeCsv(s?.grade ?? '')
      );

      rows.push(row);
    });

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarksMatrix_${sanitizeFilePart(selectedClass)}_${sanitizeFilePart(selectedExamType)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printMatrix = () => {
    if (!selectedClass || !selectedExamType || !reportData) return;
    
    // Detect mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    if (isMobile) {
      // Mobile: Open print-friendly view in new context
      try {
        const printContent = document.querySelector('.matrix-printable');
        if (!printContent) {
          alert('Unable to prepare print view. Please try again.');
          return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Please allow pop-ups to print/save as PDF.');
          return;
        }
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Marks Matrix - ${displayClass(selectedClass)} - ${selectedExamType}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 10px; background: #fff; }
              .header { text-align: center; margin-bottom: 15px; }
              .header h1 { font-size: 18px; margin-bottom: 5px; }
              .header p { font-size: 12px; color: #666; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              th, td { border: 1px solid #000; padding: 4px 3px; text-align: left; vertical-align: top; }
              th { background: #f0f0f0; font-weight: bold; }
              tfoot td { background: #f9f9f9; font-weight: 500; }
              @media print {
                @page { size: landscape; margin: 10mm; }
                body { padding: 0; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Exam Marks Matrix</h1>
              <p>Class: ${displayClass(selectedClass)} | Exam Type: ${selectedExamType}</p>
            </div>
            ${printContent.querySelector('table')?.outerHTML || '<p>No data to print</p>'}
            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); }, 500);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } catch (err) {
        console.error('Mobile print error:', err);
        alert('Unable to open print view. Please try downloading CSV instead.');
      }
    } else {
      // Desktop: Use standard print with body class
      try {
        document.body.classList.add('print-matrix');
        setTimeout(() => window.print(), 50);
        setTimeout(() => document.body.classList.remove('print-matrix'), 1000);
      } catch {
        window.print();
      }
    }
  };

  return (
    <div className="space-y-4 matrix-printable">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between no-print">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Exam Marks Matrix</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">One-page table with marks and grades per subject.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!reportData || loading}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={printMatrix}
            disabled={!reportData || loading}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="no-print bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showMaxInCells} onChange={(e) => setShowMaxInCells(e.target.checked)} />
            Show out-of marks in cells (e.g., 9/15)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showMaxInHeaders} onChange={(e) => setShowMaxInHeaders(e.target.checked)} />
            Show max in headers (e.g., Maths (40))
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showSummaryRows} onChange={(e) => setShowSummaryRows(e.target.checked)} />
            Show summary rows (Avg/Highest/Lowest)
          </label>
        </div>
      </div>

      <div className="print-only matrix-print-header">
        <div className="text-lg font-bold">Exam Marks Matrix</div>
        <div className="text-sm">
          Class: <span className="font-medium">{displayClass(selectedClass)}</span> &nbsp;|&nbsp; Exam Type:{' '}
          <span className="font-medium">{selectedExamType}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">Select class</option>
              {(classes || []).map((c) => (
                <option key={String(c)} value={String(c)}>{displayClass(c)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exam Type</label>
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">Select exam type</option>
              {(examTypes || []).map((t) => (
                <option key={String(t)} value={String(t)}>{String(t)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {loading ? 'Loading…' : (reportData ? `${students.length} students` : '—')}
            </div>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">Student</th>
                {subjectColumns.map((c) => (
                  <th key={c.subject} className="px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {c.subject}{showMaxInHeaders && c.max ? ` (${c.max})` : ''}
                  </th>
                ))}
                <th className="px-3 py-2 sm:px-4 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Total</th>
                <th className="px-3 py-2 sm:px-4 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Overall Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {students.map((s) => (
                <tr key={String(s.admNo || s.name || Math.random())}>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap">
                    {s.name || s.admNo}
                  </td>
                  {subjectColumns.map((c) => {
                    const subjectResult = s?.subjects ? s.subjects[c.subject] : null;
                    return (
                      <td key={c.subject} className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatCell(subjectResult, { showMax: showMaxInCells })}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100 text-right whitespace-nowrap">
                    {(s.totalMarks ?? '—')}{s.maxMarks ? `/${s.maxMarks}` : ''}
                  </td>
                  <td className="px-3 py-2 sm:px-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {s.grade || '—'}
                  </td>
                </tr>
              ))}

              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={subjectColumns.length + 3} className="px-3 py-6 sm:px-4 text-center text-sm text-gray-500">
                    Select class and exam type to view marks.
                  </td>
                </tr>
              )}
            </tbody>

            {showSummaryRows && students.length > 0 && subjectColumns.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <td className="px-3 py-2 sm:px-4 text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 whitespace-nowrap">Subject Avg</td>
                  {subjectColumns.map((c) => {
                    const st = subjectStats[c.subject];
                    const avg = st && st.count ? (st.sum / st.count) : null;
                    return (
                      <td key={c.subject} className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {avg == null ? '—' : avg.toFixed(1)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">—</td>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">—</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 sm:px-4 text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 whitespace-nowrap">Highest</td>
                  {subjectColumns.map((c) => {
                    const st = subjectStats[c.subject];
                    return (
                      <td key={c.subject} className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {st?.max == null ? '—' : st.max}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">—</td>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">—</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 sm:px-4 text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 whitespace-nowrap">Lowest</td>
                  {subjectColumns.map((c) => {
                    const st = subjectStats[c.subject];
                    return (
                      <td key={c.subject} className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {st?.min == null ? '—' : st.min}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">—</td>
                  <td className="px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Cell format: <span className="font-mono">scored/total (grade)</span>. Empty means mark not entered.
      </div>
    </div>
  );
}
