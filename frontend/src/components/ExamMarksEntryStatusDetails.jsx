import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { formatShortDate } from '../utils/dateUtils';

export default function ExamMarksEntryStatusDetails({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [examTypeFilter, setExamTypeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [limit, setLimit] = useState(100);
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const roleString = useMemo(() => (user?.roles || []).join(','), [user?.roles]);
  const roleLower = useMemo(() => String(roleString || '').toLowerCase(), [roleString]);
  const isPrivilegedUser = useMemo(() => {
    if (roleLower.includes('super')) return true;
    if (roleLower.includes('admin')) return true;
    if (roleLower.includes('hm') || roleLower.includes('h m') || roleLower.includes('headmaster') || roleLower.includes('head master')) return true;
    return false;
  }, [roleLower]);

  const allowedClassesForUser = useMemo(() => {
    if (isPrivilegedUser) return [];
    const classes = [];

    const ctFor = user?.classTeacherFor;
    if (ctFor) {
      String(ctFor)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(c => classes.push(c));
    }

    const clsField = user?.classes;
    if (clsField) {
      String(clsField)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(c => classes.push(c));
    }

    // De-dupe
    return Array.from(new Set(classes));
  }, [isPrivilegedUser, user?.classTeacherFor, user?.classes]);

  const examTypeOptions = useMemo(() => {
    const filtered = (allExams || []).filter(ex => {
      if (classFilter && String(ex.class || '') !== String(classFilter)) return false;
      return true;
    });
    const set = new Set(filtered.map(ex => String(ex.examType || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allExams, classFilter]);

  const subjectOptions = useMemo(() => {
    const filtered = (allExams || []).filter(ex => {
      if (classFilter && String(ex.class || '') !== String(classFilter)) return false;
      if (examTypeFilter && String(ex.examType || '') !== String(examTypeFilter)) return false;
      return true;
    });
    const set = new Set(filtered.map(ex => String(ex.subject || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allExams, classFilter, examTypeFilter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => (r.missingCount ?? 0) > 0).length;
    const complete = total - pending;
    return { total, pending, complete };
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        setOptionsLoading(true);
        const [cls, exams] = await Promise.all([
          api.getAllClasses().catch(() => []),
          api.getAllExams().catch(() => [])
        ]);
        if (cancelled) return;

        const allClasses = Array.isArray(cls) ? cls : [];
        const allExamList = Array.isArray(exams) ? exams : [];

        if (!isPrivilegedUser && allowedClassesForUser.length > 0) {
          const allowedSet = new Set(allowedClassesForUser.map(String));
          setClasses(allClasses.filter(c => allowedSet.has(String(c))));
          setAllExams(allExamList.filter(ex => allowedSet.has(String(ex.class || ''))));
        } else {
          setClasses(allClasses);
          setAllExams(allExamList);
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [allowedClassesForUser, isPrivilegedUser]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await api.getExamMarksEntryStatusAll({
          class: classFilter || undefined,
          examType: examTypeFilter || undefined,
          subject: subjectFilter || undefined,
          teacherEmail: (!isPrivilegedUser ? (user?.email || '') : ''),
          role: roleString || '',
          limit
        });
        if (cancelled) return;
        setRows(Array.isArray(res?.exams) ? res.exams : []);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError('Failed to load exam marks status.');
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [classFilter, examTypeFilter, subjectFilter, limit]);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Exam Marks Entry Status</h2>
          <p className="text-sm text-gray-600">All exams (use class filter if needed)</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Class</label>
            <select
              value={classFilter}
              onChange={e => {
                setClassFilter(e.target.value);
                setExamTypeFilter('');
                setSubjectFilter('');
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-44"
              disabled={optionsLoading}
            >
              <option value="">All</option>
              {(classes || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Exam Type</label>
            <select
              value={examTypeFilter}
              onChange={e => {
                setExamTypeFilter(e.target.value);
                setSubjectFilter('');
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-36"
              disabled={optionsLoading}
            >
              <option value="">All</option>
              {examTypeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Subject</label>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-44"
              disabled={optionsLoading}
            >
              <option value="">All</option>
              {subjectOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Limit</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending: {summary.pending}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Complete: {summary.complete}
          </span>
        </div>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="mt-3 text-sm text-gray-500">Loading…</div> : null}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-3">Exam</th>
              <th className="py-2 pr-3">Class</th>
              <th className="py-2 pr-3">Subject</th>
              <th className="py-2 pr-3">Marks Entered</th>
              <th className="py-2 pr-3">Pending</th>
              <th className="py-2 pr-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const complete = (r.missingCount ?? 0) === 0 && (r.totalStudents ?? 0) > 0;
              return (
                <tr key={r.examId} className="border-t">
                  <td className="py-2 pr-3">{r.examName || r.examType || r.examId}</td>
                  <td className="py-2 pr-3">{r.class || ''}</td>
                  <td className="py-2 pr-3">{r.subject || ''}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " +
                        (complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')
                      }
                    >
                      {(r.enteredCount ?? 0)}/{(r.totalStudents ?? 0)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{r.missingCount ?? 0}</td>
                  <td className="py-2 pr-3">{formatShortDate(r.date || r.createdAt || '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">No exams found.</div>
        ) : null}
      </div>
    </div>
  );
}
