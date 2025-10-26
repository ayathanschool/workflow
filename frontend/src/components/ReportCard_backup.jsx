import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../api';
import { formatShortDate } from '../utils/dateUtils';
import '../styles/reportCard.css';

const ReportCard = ({ user }) => {
  const [examType, setExamType] = useState('');
  const [reportData, setReportData] = useState({ students: [], subjects: [] });
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('class'); // 'class' or 'student'
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState(''); // For HM to select class
  const [availableClasses, setAvailableClasses] = useState([]); // List of all classes

  // Simple role checks based on actual system roles
  const getUserRoles = () => {
    if (!user) return [];
    // Handle both user.role and user.roles
    const roles = user.roles || user.role || [];
    return Array.isArray(roles) ? roles : [roles];
  };

  const userRoles = getUserRoles();
  const normalizedRoles = userRoles.map(role => role.toString().toLowerCase().replace(/\s+/g, ''));

  const isStudent = false; // This system doesn't have students - only teachers and HM
  const isClassTeacher = normalizedRoles.some(role => 
    role.includes('teacher') || role.includes('classteacher')
  );
  const isHM = normalizedRoles.some(role => 
    role.includes('hm') || role.includes('headmaster') || role === 'hm'
  );
  const hasAccess = isClassTeacher || isHM;

  // Load available exams
  useEffect(() => {
    const loadExams = async () => {
      if (!user) return;
      
      try {
        setExamsLoading(true);
        setError('');
        const examData = await api.getAllExams();
        
        if (Array.isArray(examData)) {
          setExams(examData);
        } else if (examData && examData.error) {
          setError(`Failed to load exams: ${examData.error}`);
          setExams([]);
        } else {
          console.warn('Unexpected exam data format:', examData);
          setExams([]);
        }
      } catch (err) {
        console.error('Error loading exams:', err);
        setError(`Failed to load exams: ${err.message}`);
        setExams([]);
      } finally {
        setExamsLoading(false);
      }
    };

    loadExams();
  }, [user]);

  // Load available classes for HM
  useEffect(() => {
    const loadClasses = async () => {
      if (!isHM) return;
      
      try {
        const classes = await api.getAllClasses();
        if (Array.isArray(classes)) {
          setAvailableClasses(classes);
        }
      } catch (err) {
        console.error('Error loading classes:', err);
      }
    };

    loadClasses();
  }, [isHM]);

  // Reset examType when selectedClass changes (for HM)
  useEffect(() => {
    if (isHM && selectedClass) {
      setExamType(''); // Clear exam selection when class changes
      setReportData({ students: [], subjects: [] }); // Clear report data
    }
  }, [selectedClass, isHM]);

  // Load report card data
  const loadReportCard = async () => {
    if (!examType) {
      setError('Please select an exam');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let data;
      if (isClassTeacher) {
        if (viewMode === 'class') {
          // For class teachers, show all students in their class
          const userClass = user.classes?.[0] || user.classTeacherFor || '';
          if (!userClass) {
            setError('No class assigned to you. Please contact your administrator.');
            setLoading(false);
            return;
          }
          data = await api.getStudentReportCard(examType, '', userClass);
        } else {
          // Show specific student
          if (!selectedStudent) {
            setError('Please enter a student admission number');
            setLoading(false);
            return;
          }
          const userClass = user.classes?.[0] || user.classTeacherFor || '';
          data = await api.getStudentReportCard(examType, selectedStudent, userClass);
        }
      } else if (isHM) {
        // HM can view any student's report card
        if (viewMode === 'class') {
          // Show all students in selected class
          if (!selectedClass) {
            setError('Please select a class');
            setLoading(false);
            return;
          }
          data = await api.getStudentReportCard(examType, '', selectedClass);
        } else {
          // Show specific student
          if (!selectedStudent) {
            setError('Please enter a student admission number');
            setLoading(false);
            return;
          }
          data = await api.getStudentReportCard(examType, selectedStudent, selectedClass);
        }
      } else {
        setError('Access denied. Only students, class teachers, and HM can view report cards.');
        setLoading(false);
        return;
      }

      console.log('Report card data received:', data);

      // Check if data has error from backend
      if (data && data.error) {
        setError(data.error);
        setReportData({ students: [], subjects: [] });
        setLoading(false);
        return;
      }

      // Ensure data has proper structure
      const safeData = data || { students: [], subjects: [] };
      const students = Array.isArray(safeData.students) ? safeData.students : [];
      const subjects = Array.isArray(safeData.subjects) ? safeData.subjects : [];
      
      setReportData({
        students: students,
        subjects: subjects
      });

      // Show helpful message if no data
      if (students.length === 0) {
        setError('No exam marks found for this exam. Please ensure marks have been entered in the Exam Marks section.');
      }
    } catch (err) {
      console.error('Error loading report card:', err);
      setError(err.message || 'Failed to load report card. Please try again.');
      setReportData({ students: [], subjects: [] });
    } finally {
      setLoading(false);
    }
  };

  // Format grade display
  const formatGrade = (subjectData) => {
    if (!subjectData || subjectData.grade === 'N/A') {
      return 'N/A';
    }
    return `${subjectData.total}/${subjectData.grade}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Report Card
        </h2>
        <div className="text-sm text-gray-500">
          {isClassTeacher && 'Teacher View'}
          {isHM && 'Administrator View'}
        </div>
      </div>

      {/* Permission check */}
      {!user && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>Please log in</strong> to view report cards.
          </p>
        </div>
      )}

      {user && !hasAccess && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">
            <strong>Access Denied:</strong> Only teachers and administrators can view report cards.
          </p>
        </div>
      )}

      {/* Controls */}
      {user && hasAccess && (
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* View Mode Selection (for teachers and HM only) - FIRST for HM */}
          {(isClassTeacher || isHM)  && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="class">Whole Class</option>
                <option value="student">Individual Student</option>
              </select>
            </div>
          )}

          {/* Class Selection (for HM only) - SECOND for HM */}
          {isHM && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose Class...</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          )}

          {/* Exam Selection - THIRD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Exam
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              disabled={examsLoading || exams.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Choose Exam...</option>
              {exams.map(exam => (
                <option key={exam.examType} value={exam.examType}>
                  {exam.examType}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Selection (when in student mode) */}
        {viewMode === 'student' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Admission Number
            </label>
            <input
              type="text"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              placeholder="Enter admission number..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={loadReportCard}
          disabled={loading || examsLoading || exams.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Generate Report Card'}
        </button>
      </div>

      {/* Help Information */}
      {!error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <strong>📋 How to use:</strong><br/>
            1. Select an exam from the dropdown<br/>
            2. Choose view mode (for teachers/admin)<br/>
            3. Click "Generate Report Card" to view marks<br/>
            <br/>
            <strong>Note:</strong> Report cards show marks that have been entered in the Exam Marks section.
            If no data appears, please ensure exam marks have been submitted.
          </p>
        </div>
      )}

      {/* Info message when no exams */}
      {!examsLoading && exams.length === 0 && !error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>No exams found.</strong> Please contact your administrator to create exams before generating report cards.
          </p>
        </div>
      )}
      </div>
    )}

    {/* Error Message */}
    {error && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    )}

    {/* Report Card Table */}
    {reportData && reportData.students && reportData.subjects && 
     reportData.students.length > 0 && reportData.subjects.length > 0 && (
      <div className="report-card-printable traditional-layout">
        {/* School Header */}
        <div className="report-card-header">
          <div className="school-name">Ayathan School</div>
          <div className="school-subtitle">Progress Report Card</div>
          <div className="academic-info">
            <span>Academic Year: 2024-25</span>
            <span>Term: {examType || 'Selected Exam'}</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Student Information */}
        {reportData.students.length === 1 && (
          <div className="student-info">
            <div className="student-info-grid">
              <div className="info-field">
                <span className="field-label">Name of Student:</span>
                <span className="field-value">{reportData.students[0].name}</span>
              </div>
              <div className="info-field">
                <span className="field-label">Admission No:</span>
                <span className="field-value">{reportData.students[0].admNo}</span>
              </div>
              <div className="info-field">
                <span className="field-label">Father's Name:</span>
                <span className="field-value">_________________</span>
              </div>
              <div className="info-field">
                <span className="field-label">Class:</span>
                <span className="field-value">_________________</span>
              </div>
              <div className="info-field">
                <span className="field-label">Mother's Name:</span>
                <span className="field-value">_________________</span>
              </div>
              <div className="info-field">
                <span className="field-label">Roll No:</span>
                <span className="field-value">_________________</span>
              </div>
            </div>
          </div>
        )}

        {/* Academic Progress Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b no-print">
            <h3 className="text-lg font-medium text-gray-900">
              Scholastic Progress - {examType || 'Selected Exam'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {reportData.students.length} student(s) across {reportData.subjects.length} subject(s)
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="progress-table min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adm No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  {reportData.subjects.map(subject => (
                    <th key={subject} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                      <div className="flex flex-col">
                        <div className="subject-header font-semibold mb-1">{subject}</div>
                        <div className="marks-grid text-xs">
                          <div className="text-center">UT1</div>
                          <div className="text-center">UT2</div>
                          <div className="text-center">CE</div>
                          <div className="text-center">TE</div>
                          <div className="text-center">Total</div>
                          <div className="text-center">Grade</div>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                    Overall
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.students.map((student, index) => {
                  const totalMarks = reportData.subjects.reduce((sum, subject) => {
                    return sum + (student.subjects[subject]?.total || 0);
                  }, 0);
                  const averageMarks = totalMarks / reportData.subjects.length;
                  const overallGrade = averageMarks >= 90 ? 'A+' : 
                                     averageMarks >= 80 ? 'A' : 
                                     averageMarks >= 70 ? 'B+' : 
                                     averageMarks >= 60 ? 'B' : 
                                     averageMarks >= 50 ? 'C+' : 
                                     averageMarks >= 40 ? 'C' : 
                                     averageMarks >= 35 ? 'D' : 'F';

                  return (
                    <tr key={student.admNo} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.admNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.name}
                      </td>
                      {reportData.subjects.map(subject => {
                        const subjectData = student.subjects[subject] || {};
                        return (
                          <td key={subject} className="px-3 py-4 whitespace-nowrap text-sm text-center border-l">
                            <div className="marks-grid">
                              <div className="marks-cell-small text-gray-700">
                                {subjectData.ut1 || 0}
                              </div>
                              <div className="marks-cell-small text-gray-700">
                                {subjectData.ut2 || 0}
                              </div>
                              <div className="marks-cell-small text-gray-700">
                                {subjectData.ce || 0}
                              </div>
                              <div className="marks-cell-small text-gray-700">
                                {subjectData.te || 0}
                              </div>
                              <div className="marks-cell font-medium text-gray-900">
                                {subjectData.total || 0}
                              </div>
                              <div className={`grade-cell text-xs px-1 py-1 rounded-full inline-block ${
                                subjectData.grade === 'A+' ? 'bg-green-100 text-green-800 grade-a-plus' :
                                subjectData.grade === 'A' ? 'bg-green-100 text-green-700 grade-a' :
                                subjectData.grade === 'B+' || subjectData.grade === 'B' ? 'bg-blue-100 text-blue-700 grade-b' :
                                subjectData.grade === 'C+' || subjectData.grade === 'C' ? 'bg-yellow-100 text-yellow-700 grade-c' :
                                subjectData.grade === 'D' ? 'bg-orange-100 text-orange-700 grade-d' :
                                'bg-red-100 text-red-700 grade-f'
                              }`}>
                                {subjectData.grade || 'N/A'}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-l">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">
                            {averageMarks.toFixed(1)}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            overallGrade === 'A+' ? 'bg-green-100 text-green-800' :
                            overallGrade === 'A' ? 'bg-green-100 text-green-700' :
                            overallGrade === 'B+' || overallGrade === 'B' ? 'bg-blue-100 text-blue-700' :
                            overallGrade === 'C+' || overallGrade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                            overallGrade === 'D' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {overallGrade}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grading Scale */}
          <div className="grading-scale">
            <div className="grading-title">Grading Criteria:</div>
            <div className="grade-ranges">
              <span>Excellent: A+ = 90%-100%</span>
              <span>Very Good: A = 80%-89%</span>
              <span>Good: B+ = 70%-79%</span>
              <span>Good: B = 60%-69%</span>
              <span>Satisfactory: C+ = 50%-59%</span>
              <span>Satisfactory: C = 40%-49%</span>
              <span>Need Attention: D = 35%-39%</span>
              <span>Needs Improvement: F = Less than 35%</span>
            </div>
          </div>

          {/* Signature Section */}
          <div className="signature-section">
            <div className="signature-block">
              <div>Class Teacher</div>
            </div>
            <div className="signature-block">
              <div>Principal/HM</div>
            </div>
            <div className="signature-block">
              <div>Parent/Guardian</div>
            </div>
          </div>

          {/* Print Button */}
          <div className="px-6 py-4 border-t bg-gray-50 no-print">
            <div className="flex gap-4">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Print Report Card
              </button>
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  const reportContent = document.querySelector('.report-card-printable');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Report Card - ${reportData.students[0]?.name || 'Student'}</title>
                        <link rel="stylesheet" href="/src/styles/reportCard.css">
                        <style>
                          body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; }
                          .report-card-printable { visibility: visible; position: static; }
                        </style>
                      </head>
                      <body>${reportContent.outerHTML}</body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Print Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Empty State */}
    {!loading && reportData && reportData.students && reportData.students.length === 0 && examType && !error && (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No report card data found for the selected exam.</p>
      </div>
    )}
  </div>
  );
};

export default ReportCard;