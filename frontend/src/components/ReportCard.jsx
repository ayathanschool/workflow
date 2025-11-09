import React, { useState, useEffect } from "react";
import { useGoogleAuth } from "../contexts/GoogleAuthContext";
import * as api from "../api";

/**
 * Determine if a class should have internal marks (CE/TE system)
 * Only STD 8, STD 9, and STD 10 have internal marks
 * Returns true for standards 8, 9, 10; false for standards 1-7
 */
const classHasInternalMarks = (cls) => {
  if (!cls) return false;
  try {
    // Extract the first number found in the class string
    const m = String(cls).match(/(\d+)/);
    if (!m) return false;
    const n = Number(m[1]);
    if (isNaN(n)) return false;
    // Only standards 8, 9, and 10 have internal marks (CE and TE)
    return n >= 8 && n <= 10;
  } catch (e) {
    return false;
  }
};

const ReportCard = () => {
  const { user, roles } = useGoogleAuth();
  
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check user role
  const isHM = roles && roles.some(role => {
    const roleLower = (role || "").toLowerCase().trim();
    const roleNoSpaces = roleLower.replace(/\s+/g, "");
    return roleNoSpaces === "hm" || roleLower.includes("head master") || roleLower.includes("headmaster");
  });

  const isClassTeacher = roles && roles.some(role => {
    const roleLower = (role || "").toLowerCase().trim();
    return roleLower.includes("class teacher");
  });

  const hasAccess = roles && roles.length > 0 && roles.some(role => {
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
          // HM can see all classes
          const allClasses = await api.getAllClasses();
          setClasses(allClasses || []);
        } else if (user && user.classTeacherFor) {
          // Class Teacher can only see their assigned class
          setClasses([user.classTeacherFor]);
        } else if (user && user.classes) {
          // Fallback to user's classes
          setClasses(user.classes);
        }
      } catch (err) {
        console.error("Error loading classes:", err);
        // Fallback to user's classes on error
        if (user && user.classes) {
          setClasses(user.classes);
        }
      }
    };

    if (user) {
      loadClasses();
    }
  }, [user, isHM]);

  // Load all exams when component mounts (not dependent on class selection)
  useEffect(() => {
    const loadExams = async () => {
      try {
        setLoading(true);
        // Get ALL exams
        const allExams = await api.getAllExams();
        
        // Group exams by examType to avoid duplicates
        // We only need one entry per examType (Term 1, Term 2, etc.)
        const uniqueExamTypes = new Map();
        allExams.forEach(exam => {
          const examType = exam.examType;
          if (examType && !uniqueExamTypes.has(examType)) {
            uniqueExamTypes.set(examType, {
              examId: exam.examId,
              examType: exam.examType,
              examName: exam.examType, // Use examType as the display name
              class: exam.class
            });
          }
        });
        
        const uniqueExams = Array.from(uniqueExamTypes.values());
        setExams(uniqueExams);
      } catch (err) {
        console.error("Error loading exams:", err);
        setError("Failed to load exams. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadExams();
  }, []);

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

  const generateReport = async () => {
    if (!selectedClass || !selectedExam || !selectedStudent) {
      setError("Please select class, exam, and student");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Handle both uppercase and lowercase field names
      const student = students.find(s => 
        (s.admNo || s.AdmNo || s.ID || s.id) === selectedStudent
      );
      
      // Call API with examType (selectedExam now contains the examType directly)
      const data = await api.getStudentReportCard(selectedExam, selectedStudent, selectedClass);
      
      console.log('=== RAW API RESPONSE ===');
      console.log('Full data:', JSON.stringify(data, null, 2));
      console.log('data.students:', data?.students);
      console.log('data.students.length:', data?.students?.length);
      
      if (data && !data.error && data.students && data.students.length > 0) {
        // Find the student data in the response
        const studentData = data.students.find(s => 
          String(s.admNo || '') === selectedStudent
        ) || data.students[0]; // Fallback to first student if not found
        
        console.log('Student data from backend:', JSON.stringify(studentData, null, 2));
        
        // Transform the subjects data from backend format to frontend format
        // Backend returns: { subjects: { "English": { internal, external, total, grade, ... }, ... } }
        const examTypeGroups = {};
        
        if (studentData && studentData.subjects) {
          // Get the exam type (use selectedExam or data.examType)
          const examType = data.examType || selectedExam || 'General';
          examTypeGroups[examType] = [];
          
          // Iterate through subjects object
          Object.keys(studentData.subjects).forEach(subjectName => {
            const subjectMarks = studentData.subjects[subjectName];
            
            console.log(`Subject ${subjectName}:`, {
              ce: subjectMarks.ce,
              te: subjectMarks.te,
              internal: subjectMarks.internal,
              external: subjectMarks.external,
              total: subjectMarks.total,
              hasInternalMarks: subjectMarks.hasInternalMarks
            });
            
            // CRITICAL DEBUG: Log the exact values
            console.log(`RAW VALUES - ce type: ${typeof subjectMarks.ce}, value: ${subjectMarks.ce}`);
            console.log(`RAW VALUES - te type: ${typeof subjectMarks.te}, value: ${subjectMarks.te}`);
            
            examTypeGroups[examType].push({
              name: subjectName,
              // SIMPLIFIED: Just use the raw values from backend
              ce: subjectMarks.ce,
              te: subjectMarks.te,
              total: subjectMarks.total,
              grade: subjectMarks.grade || 'N/A',
              percentage: subjectMarks.percentage || 0,
              maxMarks: subjectMarks.maxMarks || 100,
              hasInternalMarks: subjectMarks.hasInternalMarks
            });
          });
        }
        
        console.log('Transformed examTypeGroups:', examTypeGroups);
        
        setReportData({
          student: {
            Name: student?.name || student?.Name || studentData?.name || 'Unknown',
            Class: student?.class || student?.Class || studentData?.class || selectedClass,
            AdmNo: student?.admNo || student?.AdmNo || studentData?.admNo || selectedStudent
          },
          exam: { examType: selectedExam, examName: selectedExam },
          examTypeGroups: examTypeGroups,
          subjects: Object.values(examTypeGroups).flat(), // Keep for backward compatibility
          summary: {
            totalMarks: studentData?.totalMarks || 0,
            maxMarks: studentData?.maxMarks || 0,
            percentage: studentData?.percentage || 0,
            grade: studentData?.grade || 'N/A',
            subjectCount: studentData?.subjectCount || 0
          }
        });
      } else {
        setError(data?.error || "Failed to generate report card. No data found.");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setError("Failed to generate report card: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  if (!user || !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-gray-500">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
        <p>You do not have permission to view report cards.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Report Card Generator</h1>
        <p className="text-gray-600 dark:text-gray-400">Multi-Term Assessment System</p>
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Generate Report Card</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Choose a class...</option>
              {classes.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{classes.length} classes available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Exam</label>
            <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled={!selectedClass || exams.length === 0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50">
              <option value="">Choose an exam...</option>
              {exams.map((exam) => (
                <option key={exam.examType} value={exam.examType}>
                  {exam.examType}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{exams.length} exam types available</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} disabled={!selectedClass || students.length === 0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50">
              <option value="">Choose a student...</option>
              {students.map((student, index) => {
                // Handle both uppercase and lowercase field names
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
          <button onClick={generateReport} disabled={!selectedClass || !selectedExam || !selectedStudent || loading} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Generating..." : "Generate Report Card"}
          </button>

          {reportData && (
            <button onClick={() => window.print()} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">🖨️ Print Report</button>
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
              Class: {reportData.student?.Class} | Exam: {reportData.exam?.examName || reportData.exam?.examType}
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
                  {Object.entries(reportData.examTypeGroups).map(([examType, subjects]) => (
                    <div key={examType} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Exam Type Header */}
                      <div className="bg-blue-50 dark:bg-blue-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                          {examType}
                        </h3>
                      </div>
                      
                      {/* Marks Table */}
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Subject</th>
                            {hasInternalMarks && (
                              <>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">CE</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">TE</th>
                              </>
                            )}
                            {!hasInternalMarks && (
                              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">External</th>
                            )}
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Total</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects && subjects.length > 0 ? (
                            subjects.map((subject, index) => {
                              // SIMPLIFIED: Just check if ce exists and is not null
                              const showInternal = hasInternalMarks && subject.ce !== null && subject.ce !== undefined;
                              
                              console.log(`Rendering ${subject.name}: ce=${subject.ce}, te=${subject.te}, showInternal=${showInternal}, hasInternalMarks=${hasInternalMarks}`);
                              
                              return (
                                <tr key={index}>
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{subject.name || "Unknown Subject"}</td>
                                  {hasInternalMarks && (
                                    <>
                                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                        {subject.ce !== null && subject.ce !== undefined ? subject.ce : "-"}
                                      </td>
                                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                        {subject.te !== null && subject.te !== undefined ? subject.te : "-"}
                                      </td>
                                    </>
                                  )}
                                  {!hasInternalMarks && (
                                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                      {subject.te !== null && subject.te !== undefined ? subject.te : "-"}
                                    </td>
                                  )}
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">
                                    {subject.total !== null && subject.total !== undefined ? subject.total : "-"}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">{subject.grade || "-"}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={hasInternalMarks ? "5" : "4"} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500">
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

export default ReportCard;
