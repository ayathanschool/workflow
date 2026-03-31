import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { Download, Plus, BarChart2, Eye, Edit } from 'lucide-react';
import { todayIST } from '../utils/dateUtils';

const ClassStudentsView = ({ user, withSubmit, openLessonView }) => {
  // Students state starts empty and is populated from the backend.
  const [students, setStudents] = useState([]);
  const className = user?.classTeacherFor || '';
  // Attendance form state
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(todayIST());
  const [attendanceRows, setAttendanceRows] = useState([]);
  // Performance data
  const [performance, setPerformance] = useState([]);
  const [showPerformance, setShowPerformance] = useState(false);

  // Load students on mount or when the classTeacherFor changes
  useEffect(() => {
    async function fetchStudents() {
      try {
        if (user && user.classTeacherFor) {
          const data = await api.getStudents(user.classTeacherFor);
          setStudents(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchStudents();
  }, [user?.classTeacherFor]);

  // Load performance data when requested
  const loadPerformance = async () => {
    try {
      if (user && user.classTeacherFor) {
        const data = await api.getStudentPerformance(user.classTeacherFor);
        setPerformance(Array.isArray(data) ? data : []);
        setShowPerformance(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Initialize attendance rows when opening the form
  const openAttendanceForm = () => {
    const rows = students.map(s => ({ admNo: s.admNo, studentName: s.name, status: 'Present' }));
    setAttendanceRows(rows);
    setShowAttendanceForm(true);
  };
  const updateAttendanceRow = (index, status) => {
    const updated = attendanceRows.map((r, i) => (i === index ? { ...r, status } : r));
    setAttendanceRows(updated);
  };
  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    if (!user || !user.classTeacherFor) return;
    try {
      await withSubmit('Submitting attendance...', () => api.submitAttendance({
        date: attendanceDate,
        class: user.classTeacherFor,
        teacherEmail: user.email,
        teacherName: user.name || '',
        records: attendanceRows
      }));
      setShowAttendanceForm(false);
    } catch (err) {
      console.error('Error submitting attendance:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Students{className ? ` – ${className}` : ''}</h1>
        <div className="flex space-x-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          {user && user.classTeacherFor && (
            <button
              onClick={openAttendanceForm}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Attendance
            </button>
          )}
          {user && user.classTeacherFor && (
            <button
              onClick={loadPerformance}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-purple-700"
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              View Performance
            </button>
          )}
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Student List</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No students to display.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.admNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button type="button" className="text-blue-600 hover:text-blue-900 mr-3" onClick={() => openLessonView(student)} title="View student">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Form */}
      {showAttendanceForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Record Attendance – {className}</h2>
          <form onSubmit={handleSubmitAttendance} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.admNo}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.studentName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        <select
                          value={row.status}
                          onChange={(e) => updateAttendanceRow(index, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAttendanceForm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Attendance
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Performance Overview */}
      {showPerformance && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Performance Overview – {className}</h2>
          {performance.length === 0 ? (
            <p className="text-sm text-gray-500">No performance data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Average Marks</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exams</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performance.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.admNo}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.average.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.examCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => setShowPerformance(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassStudentsView;
