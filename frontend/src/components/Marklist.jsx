import React, { useState, useEffect } from "react";
import * as api from "../api";

/**
 * Determine if a class should have internal marks (CE/TE system)
 * Only STD 8, STD 9, and STD 10 have internal marks
 */
const classHasInternalMarks = (cls) => {
  if (!cls) return false;
  try {
    const m = String(cls).match(/(\d+)/);
    if (!m) return false;
    const n = Number(m[1]);
    if (isNaN(n)) return false;
    return n >= 8 && n <= 10;
  } catch (e) {
    return false;
  }
};

const Marklist = ({ user }) => {
  
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState(null);

  // Get roles from user object
  const userRoles = user?.roles || [];

  // Check user role
  const isHM = userRoles && userRoles.some(role => {
    const roleLower = (role || "").toLowerCase().trim();
    const roleNoSpaces = roleLower.replace(/\s+/g, "");
    return roleNoSpaces === "hm" || roleLower.includes("head master") || roleLower.includes("headmaster");
  });

  const isClassTeacher = userRoles && userRoles.some(role => {
    const roleLower = (role || "").toLowerCase().trim();
    return roleLower.includes("class teacher");
  });

  const hasAccess = userRoles && userRoles.length > 0 && userRoles.some(role => {
    const roleLower = (role || "").toLowerCase().trim();
    const roleNoSpaces = roleLower.replace(/\s+/g, "");
    if (roleLower.includes("teacher")) return true;
    if (roleLower.includes("admin")) return true;
    if (roleNoSpaces === "hm") return true;
    return false;
  });

  // Load classes based on role
  useEffect(() => {
    const loadClasses = async () => {
      try {
        if (isHM) {
          const allClasses = await api.getAllClasses();
          setClasses(allClasses || []);
        } else if (user && user.classTeacherFor) {
          setClasses([user.classTeacherFor]);
        } else if (user && user.classes) {
          setClasses(user.classes);
        }
      } catch (err) {
        console.error("Error loading classes:", err);
        if (user && user.classes) {
          setClasses(user.classes);
        }
      }
    };

    if (user) {
      loadClasses();
    }
  }, [user, isHM]);

  // Load students when class is selected
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) {
        setStudents([]);
        return;
      }

      try {
        setLoading(true);
        const data = await api.getStudents(selectedClass);
        setStudents(data || []);
      } catch (err) {
        console.error("Error loading students:", err);
        setError("Failed to load students: " + (err.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedClass]);

  const generateMarklist = async () => {
    if (!selectedClass || !selectedStudent) {
      setError("Please select class and student");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setLoadingProgress("Finding student...");
      
      console.log('🔍 Finding student:', selectedStudent);
      console.log('📚 Available students:', students);
      
      // Handle both uppercase and lowercase field names
      // Also handle string vs number comparison
      const student = students.find(s => {
        const admNo = s.admNo || s.AdmNo || s.ID || s.id;
        return String(admNo) === String(selectedStudent);
      });
      
      console.log('👤 Found student:', student);
      
      // Fetch all exam types and get marks for each
      setLoadingProgress("Loading exam types...");
      const allExams = await api.getAllExams();
      const uniqueExamTypes = [...new Set(allExams.map(e => e.examType))].filter(Boolean);
      
      console.log('📋 Fetching marklist for exam types:', uniqueExamTypes);
      setLoadingProgress(`Loading ${uniqueExamTypes.length} exam types...`);
      
      // Fetch reports for all exam types in parallel
      const reportPromises = uniqueExamTypes.map(examType => 
        api.getStudentReportCard(examType, selectedStudent, selectedClass)
      );
      
      const allReports = await Promise.all(reportPromises);
      console.log('📊 All reports fetched:', allReports);
      
      // Combine all exam types into one structure
      const examTypeGroups = {};
      
      allReports.forEach((data, index) => {
        const examType = uniqueExamTypes[index];
        
        if (data && !data.error && data.students && data.students.length > 0) {
          const studentData = data.students.find(s => 
            String(s.admNo || '') === selectedStudent
          ) || data.students[0];
          
          console.log(`✅ Processing ${examType}:`, studentData);
          
          if (studentData && studentData.subjects) {
            const subjects = [];
            
            Object.keys(studentData.subjects).forEach(subjectName => {
              const subjectMarks = studentData.subjects[subjectName];
              
              subjects.push({
                name: subjectName,
                ce: subjectMarks.ce,
                te: subjectMarks.te,
                internal: subjectMarks.internal,
                external: subjectMarks.external,
                total: subjectMarks.total,
                grade: subjectMarks.grade || 'N/A',
                percentage: subjectMarks.percentage || 0,
                maxMarks: subjectMarks.maxMarks || 100,
                hasInternalMarks: subjectMarks.hasInternalMarks
              });
            });
            
            examTypeGroups[examType] = {
              subjects: subjects,
              totalMarks: studentData.totalMarks || 0,
              maxMarks: studentData.maxMarks || 0,
              percentage: studentData.percentage || 0,
              grade: studentData.grade || 'N/A'
            };
          }
        }
      });
      
      console.log('📊 Combined examTypeGroups:', examTypeGroups);
      
      if (Object.keys(examTypeGroups).length === 0) {
        setError("No marks found for this student");
        return;
      }
      
      setReportData({
        student: {
          Name: student?.name || student?.Name || 'Unknown',
          Class: student?.class || student?.Class || selectedClass,
          AdmNo: student?.admNo || student?.AdmNo || selectedStudent
        },
        examTypeGroups: examTypeGroups
      });
    } catch (err) {
      console.error("Error generating marklist:", err);
      setError("Failed to generate marklist: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
      setLoadingProgress("");
    }
  };

  if (!user || !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-gray-500">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
        <p>You do not have permission to view marklists.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Marklist Generator</h1>
        <p className="text-gray-600 dark:text-gray-400">Detailed marks with CE, TE, Total, and Grades</p>
        {isHM && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
            🔑 HM Access: You can view all classes and students
          </p>
        )}
        {isClassTeacher && !isHM && user?.classTeacherFor && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            🔑 Class Teacher Access: You can view students from {user.classTeacherFor}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Generate Comprehensive Marklist</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">📊 View detailed marks across all exam types</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Choose a class...</option>
              {classes.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{classes.length} classes available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} disabled={!selectedClass || students.length === 0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50">
              <option value="">Choose a student...</option>
              {students.map((student, index) => {
                const studentId = student.admNo || student.AdmNo || student.ID || student.id || `student-${index}`;
                const studentName = student.name || student.Name || 'Unknown Student';
                return (
                  <option key={studentId} value={studentId}>
                    {studentName}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {loading && selectedClass ? "Loading students..." : `${students.length} students in ${selectedClass || 'selected class'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={generateMarklist} disabled={!selectedClass || !selectedStudent || loading} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (loadingProgress || "Generating...") : "Generate Marklist"}
          </button>

          {reportData && (
            <button onClick={() => window.print()} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">🖨️ Print Marklist</button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>

      {reportData && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow border dark:border-gray-700">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.student?.Name}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Class: {reportData.student?.Class} | Admission No: {reportData.student?.AdmNo}
            </p>
            {(() => {
              const studentClass = reportData.student?.Class || selectedClass;
              const hasInternalMarks = classHasInternalMarks(studentClass);
              return (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  📊 Assessment Type: {hasInternalMarks ? "CE (Internal) + TE (External)" : "External Marks Only"} 
                  {hasInternalMarks ? " • STD 8,9,10 Format" : " • STD 1-7 Format"}
                </p>
              );
            })()}
          </div>

          <div className="overflow-x-auto">
            {(() => {
              const hasInternalMarks = classHasInternalMarks(reportData.student?.Class || selectedClass);
              
              if (!reportData.examTypeGroups || Object.keys(reportData.examTypeGroups).length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    No exam data available
                  </div>
                );
              }
              
              return (
                <div className="space-y-6">
                  {Object.entries(reportData.examTypeGroups).map(([examType, examData]) => (
                    <div key={examType} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Exam Type Header */}
                      <div className="bg-blue-50 dark:bg-blue-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                          {examType}
                          <span className="ml-4 text-sm font-normal">
                            Total: {examData.totalMarks}/{examData.maxMarks} ({examData.percentage}%) - Grade: {examData.grade}
                          </span>
                        </h3>
                      </div>
                      
                      {/* Detailed Marks Table */}
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Subject</th>
                            {hasInternalMarks && (
                              <>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">CE (20)</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">TE (80)</th>
                              </>
                            )}
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Total (100)</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examData.subjects && examData.subjects.length > 0 ? (
                            examData.subjects.map((subject, index) => {
                              return (
                                <tr key={index}>
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{subject.name || "Unknown Subject"}</td>
                                  {hasInternalMarks && (
                                    <>
                                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                        {subject.ce !== undefined && subject.ce !== null && subject.ce !== '' ? subject.ce : '-'}
                                      </td>
                                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                        {subject.te !== undefined && subject.te !== null && subject.te !== '' ? subject.te : '-'}
                                      </td>
                                    </>
                                  )}
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">
                                    {subject.total || 0}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold text-lg">
                                    {subject.grade || "N/A"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={hasInternalMarks ? "5" : "3"} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-gray-500">
                                No subjects found for {examType}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Marklist;
