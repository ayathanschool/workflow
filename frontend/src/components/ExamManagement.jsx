import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Bell, Search, Filter, RefreshCw, Loader } from 'lucide-react';
import * as api from '../api';
import { todayIST, parseApiDate, formatShortDate } from '../utils/dateUtils';

const ExamManagement = ({ user, hasRole, withSubmit, setToast, userRolesNorm }) => {
  // Helper function to determine if exam has internal marks
  const examHasInternalMarks = (exam) => {
    if (!exam) return false;
    
    const isFalseValue = (
      exam.hasInternalMarks === false ||
      exam.hasInternalMarks === 'false' ||
      exam.hasInternalMarks === 'FALSE' ||
      exam.hasInternalMarks === 'False' ||
      String(exam.hasInternalMarks).toLowerCase() === 'false' ||
      exam.hasInternalMarks === 0 ||
      exam.hasInternalMarks === '0'
    );
    
    return !isFalseValue;
  };
  
  // Normalize user roles internally if userRolesNorm isn't provided
  const normalizedRoles = useMemo(() => {
    if (Array.isArray(userRolesNorm)) return userRolesNorm;
    
    if (!user || !user.roles) return [];
    
    // Simple role normalization function
    return Array.isArray(user.roles) 
      ? user.roles.map(r => String(r).toLowerCase().trim())
      : [String(user.roles).toLowerCase().trim()];
  }, [user, userRolesNorm]);
  const [exams, setExams] = useState([]);
  const [showExamForm, setShowExamForm] = useState(false);
  const [showBulkExamForm, setShowBulkExamForm] = useState(false);
  const [examFormData, setExamFormData] = useState({
    examType: '',
    class: '',
    subject: '',
    hasInternalMarks: true,
    internalMax: 20,
    externalMax: 80,
    date: todayIST()
  });
  const [bulkExamFormData, setBulkExamFormData] = useState({
    examType: '',
    class: '',
    hasInternalMarks: true,
    internalMax: 20,
    externalMax: 80,
    subjectExams: [] // Will contain {subject, date} pairs
  });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  // List of grading schemes loaded from the GradeTypes sheet.  Each entry
  // contains examType and the maximum internal/external marks.  Used to
  // populate the exam type dropdown dynamically and auto-fill mark limits.
  const [gradeTypes, setGradeTypes] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  
  // Initialize with some default subjects for immediate display
  useEffect(() => {
    // Set some default subjects immediately for better UX
    const defaultSubjects = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi', 'Computer Science', 'Physics', 'Chemistry', 'Biology'];
    setAvailableSubjects(defaultSubjects);
    setSubjectsLoading(false);
  }, []);
  
  // Filter states
  const [filters, setFilters] = useState({
    class: '',
    subject: '',
    examType: ''
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Error handling state
  const [apiError, setApiError] = useState('');

  const [showMarksForm, setShowMarksForm] = useState(false);
  const [marksRows, setMarksRows] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);

  // Bulk marks upload state
  const [showBulkMarksUpload, setShowBulkMarksUpload] = useState(false);
  const [bulkMarksFile, setBulkMarksFile] = useState(null);
  const [bulkMarksData, setBulkMarksData] = useState([]);
  const [bulkMarksPreview, setBulkMarksPreview] = useState([]);

  const [viewExamMarks, setViewExamMarks] = useState(null);
  const [examMarks, setExamMarks] = useState([]);
  
  // Performance optimization: Cache frequently accessed data
  const [studentsCache, setStudentsCache] = useState(new Map());
  const [marksCache, setMarksCache] = useState(new Map());
  
  // State for grade boundaries
  const [gradeBoundaries, setGradeBoundaries] = useState([]);
  const [gradeBoundariesLoaded, setGradeBoundariesLoaded] = useState(false);

  // Load grade boundaries on component mount
  useEffect(() => {
    const loadGradeBoundaries = async () => {
      try {
        const boundaries = await api.getGradeBoundaries();
        setGradeBoundaries(boundaries);
        setGradeBoundariesLoaded(true);
        console.log('📊 Grade boundaries loaded:', boundaries);
      } catch (error) {
        console.error('❌ Error loading grade boundaries:', error);
        setGradeBoundariesLoaded(true); // Still mark as loaded to prevent infinite loading
      }
    };
    
    if (!gradeBoundariesLoaded) {
      loadGradeBoundaries();
    }
  }, [gradeBoundariesLoaded]);

  // Calculate grade using backend grade boundaries
  const calculateGrade = useCallback((percentage, className) => {
    if (!gradeBoundariesLoaded || !gradeBoundaries.length) {
      // Fallback calculation while loading or if no boundaries
      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B+';
      if (percentage >= 60) return 'B';
      if (percentage >= 50) return 'C+';
      if (percentage >= 40) return 'C';
      if (percentage >= 30) return 'D';
      return 'E';
    }

    // Determine standard group
    const getStandardGroup = (cls) => {
      if (!cls) return '';
      const match = String(cls).match(/(\d+)/);
      if (!match) return '';
      const num = Number(match[1]);
      if (isNaN(num)) return '';
      if (num <= 4) return 'Std 1-4';
      if (num <= 8) return 'Std 5-8';
      return 'Std 9-12';
    };

    const stdGroup = getStandardGroup(className);
    
    // Find appropriate grade boundary
    const boundaries = gradeBoundaries
      .filter(b => b.standardGroup === stdGroup)
      .sort((a, b) => b.minPercentage - a.minPercentage); // Sort descending

    for (const boundary of boundaries) {
      if (percentage >= boundary.minPercentage && percentage <= boundary.maxPercentage) {
        return boundary.grade;
      }
    }

    // Return lowest grade if no boundary found
    return boundaries.length > 0 ? boundaries[boundaries.length - 1].grade : 'E';
  }, [gradeBoundaries, gradeBoundariesLoaded]);
  const clearCache = useCallback(() => {
    console.log('🗑️ Clearing all caches');
    setStudentsCache(new Map());
    setMarksCache(new Map());
    setApiError('Cache cleared successfully');
    setTimeout(() => setApiError(''), 2000);
  }, []);

  const refreshExamData = useCallback(async () => {
    if (!selectedExam) return;
    
    console.log('🔄 Refreshing exam data for:', selectedExam);
    setIsLoading(true);
    
    try {
      // Clear caches for this specific exam
      setStudentsCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(selectedExam.class);
        return newCache;
      });
      
      setMarksCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(selectedExam.examId);
        return newCache;
      });
      
      // Re-fetch data by calling openMarksForm
      const updatedOpenMarksForm = async (exam) => {
        setSelectedExam(exam);
        setIsLoading(true);
        setApiError('');
        
        try {
          console.log('🔍 Opening marks form for exam:', exam);
          
          // Fetch fresh data without cache
          console.log('📚 Fetching students for class:', exam.class);
          const students = await api.getStudents(exam.class);
          console.log('✅ Students fetched:', students);
          setStudentsCache(prev => new Map(prev.set(exam.class, students)));
          
          console.log('📊 Fetching marks for examId:', exam.examId);
          const marks = await api.getExamMarks(exam.examId);
          console.log('✅ Marks fetched:', marks);
          setMarksCache(prev => new Map(prev.set(exam.examId, marks)));
          
          // Validate data
          if (!Array.isArray(students) || students.length === 0) {
            throw new Error(`No students found for class ${exam.class}`);
          }
          
          // Create marks rows for each student, pre-populating with existing marks
          const marksMap = {};
          if (Array.isArray(marks)) {
            marks.forEach(mark => {
              if (mark && mark.admNo) {
                marksMap[mark.admNo] = mark;
              }
            });
          }
          
          console.log('📝 Creating marks rows for', students.length, 'students');
          
          // Create a row for each student
          const rows = students.map(student => {
            const existingMark = marksMap[student.admNo] || {};
            return {
              admNo: student.admNo,
              studentName: student.name,
              internal: existingMark.internal || '',
              external: existingMark.external || '',
              total: existingMark.total || '',
              percentage: existingMark.percentage || '',
              grade: existingMark.grade || ''
            };
          });
          
          console.log('✅ Marks rows created:', rows.length);
          setMarksRows(rows);
          setShowMarksForm(true);
        } catch (error) {
          console.error('❌ Error in openMarksForm:', error);
          setApiError(error.message || 'Failed to load exam data');
        } finally {
          setIsLoading(false);
        }
      };
      
      await updatedOpenMarksForm(selectedExam);
      
    } catch (error) {
      console.error('❌ Error refreshing exam data:', error);
      setApiError('Failed to refresh exam data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedExam]);
  
  // State for editing exams
  const [showEditExamForm, setShowEditExamForm] = useState(false);
  const [editExamData, setEditExamData] = useState(null);

  // Load grade types once on component mount.  This allows the exam
  // creation form to offer dynamic exam type options and automatically
  // populate max marks based on the selected grading scheme.
  useEffect(() => {
    async function fetchGradeTypes() {
      try {
        const types = await api.getGradeTypes();
        setGradeTypes(Array.isArray(types) ? types : []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchGradeTypes();
  }, []);

  // Load exams and class list on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setApiError('');
        // Fetch all exams with proper role-based filtering
        await reloadExams();
        // Fetch classes for HM or use teacher's classes
        if (user) {
          // Check if hasRole is a function before calling it
          const isHeadmaster = typeof hasRole === 'function' ? 
            hasRole('h m') : 
            normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'));
          
          if (isHeadmaster) {
            const cls = await api.getAllClasses();
            setAvailableClasses(Array.isArray(cls) ? cls : []);
          } else {
            setAvailableClasses(user.classes || []);
          }
        }
      } catch (err) {
        console.error(err);
        setApiError('Failed to load data: ' + (err.message || err));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [user, hasRole, normalizedRoles]);

  // Load all subjects from the centralized API endpoint
  useEffect(() => {
    async function fetchAllSubjects() {
      try {
        setSubjectsLoading(true);
        // Get all available subjects from the centralized API endpoint
        const allSubjects = await api.getSubjects();
        
        // Check if hasRole is a function before calling it
        const isHeadmaster = typeof hasRole === 'function' ? 
          hasRole('h m') : 
          normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'));
        
        // Check if user is a class teacher
        const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
        
        // Filter subjects based on user role and selected class
        if (user && !isHeadmaster) {
          // For class teacher: show subjects they teach + subjects in their assigned class
          if (isClassTeacher) {
            const subjectsSet = new Set();
            
            // Add subjects that the teacher teaches in ANY class
            if (Array.isArray(user.subjects)) {
              user.subjects.forEach(s => subjectsSet.add(s));
            }
            
            // Add ALL subjects for the class they are class teacher for
            if (user.classTeacherFor) {
              const classTeacherClass = user.classTeacherFor;
              
              // For class teacher, show ALL subjects in their assigned class
              // Get subjects from timetable for this specific class
              try {
                const timetableData = await api.getTeacherWeeklyTimetable(user.email);
                if (Array.isArray(timetableData)) {
                  timetableData.forEach(day => {
                    if (day.periods && Array.isArray(day.periods)) {
                      day.periods.forEach(period => {
                        if (period.class === classTeacherClass && period.subject) {
                          subjectsSet.add(period.subject);
                        }
                      });
                    }
                  });
                }
              } catch (err) {
                console.warn('Could not fetch timetable data for subjects:', err);
              }
              
              // Also add subjects from existing exams for this class
              if (Array.isArray(exams)) {
                exams.forEach(ex => {
                  if (!ex) return;
                  if (String(ex.class || '').trim() === classTeacherClass) {
                    const subj = String(ex.subject || '').trim();
                    if (subj) subjectsSet.add(subj);
                  }
                });
              }
            }
            
            // Convert the set back to an array and sort it
            const filteredSubjects = Array.from(subjectsSet).filter(Boolean).sort();
            setAvailableSubjects(filteredSubjects);
          } else {
            // Regular teacher: just show their subjects
            const teacherSubjects = Array.isArray(user.subjects) ? user.subjects : [];
            setAvailableSubjects(teacherSubjects);
          }
        } else {
          // Headmaster: filter subjects based on selected class
          const selectedClass = (examFormData.class || '').toString().trim();
          
          if (selectedClass) {
            // Show only subjects for the selected class
            const classSubjects = new Set();
            
            // Get subjects from exams for this class
            if (Array.isArray(exams)) {
              exams.forEach(ex => {
                if (!ex) return;
                if (String(ex.class || '').trim() === selectedClass) {
                  const subj = String(ex.subject || '').trim();
                  if (subj) classSubjects.add(subj);
                }
              });
            }
            
            // If no subjects found from exams, show all subjects as fallback
            if (classSubjects.size === 0) {
              console.log('⚠️  No subjects found for class, showing all subjects');
              setAvailableSubjects(allSubjects);
            } else {
              const sortedClassSubjects = Array.from(classSubjects).sort();
              console.log('📚 Class-specific subjects:', sortedClassSubjects);
              setAvailableSubjects(sortedClassSubjects);
            }
          } else {
            // No class selected, show all subjects for headmaster
            console.log('🌟 Headmaster - showing all subjects:', allSubjects);
            setAvailableSubjects(allSubjects);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching subjects:", error);
        // Fallback to the old method if API call fails
        fallbackToExamBasedSubjects();
      } finally {
        setSubjectsLoading(false);
      }
    }
    
    // Fallback method to use exam-based subjects if API fails
    function fallbackToExamBasedSubjects() {
      const cls = (examFormData.class || '').toString().trim();
      
      // Check if hasRole is a function before calling it
      const isHeadmaster = typeof hasRole === 'function' ? 
        hasRole('h m') : 
        normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'));
      
      // Check if user is a class teacher
      const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
      
      // If user is a class teacher, add all subjects from their assigned class AND subjects they teach
      if (user && isClassTeacher && !isHeadmaster) {
        const subjectsSet = new Set();
        
        // Add subjects that the teacher teaches
        if (Array.isArray(user.subjects)) {
          user.subjects.forEach(s => subjectsSet.add(s));
        }
        
        // Add all subjects for the class they are class teacher for
        if (user.classTeacherFor) {
          const classTeacherClass = user.classTeacherFor;
          
          // Get subjects for this class from existing exams
          if (Array.isArray(exams)) {
            exams.forEach(ex => {
              if (!ex) return;
              if (String(ex.class || '').trim() === classTeacherClass) {
                const subj = String(ex.subject || '').trim();
                if (subj) subjectsSet.add(subj);
              }
            });
          }
        }
        
        const list = Array.from(subjectsSet).filter(Boolean).sort();
        setAvailableSubjects(list);
        return;
      }
      
      // If user is a regular teacher (not class teacher, not HM), restrict to their subjects
      if (user && !isHeadmaster) {
        const teacherSubjects = Array.isArray(user.subjects) ? user.subjects : [];
        setAvailableSubjects(teacherSubjects);
        return;
      }

      // Headmaster: Derive subjects from the fetched exams
      const subjectsSet = new Set();
      
      // Get subjects from existing exams
      if (Array.isArray(exams)) {
        exams.forEach(ex => {
          if (!ex) return;
          if (cls) {
            if (String(ex.class || '').trim() === cls) {
              const subj = String(ex.subject || '').trim();
              if (subj) subjectsSet.add(subj);
            }
          } else {
            const subj = String(ex.subject || '').trim();
            if (subj) subjectsSet.add(subj);
          }
        });
      }

      // If still no subjects, add some common subjects as last resort
      if (subjectsSet.size === 0) {
        console.warn('⚠️  No subjects found anywhere, adding default subjects');
        ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'].forEach(s => subjectsSet.add(s));
      }
      
      const list = Array.from(subjectsSet).filter(Boolean).sort();
      setAvailableSubjects(list);
      setSubjectsLoading(false);
    }
    
    // Call the function to fetch subjects
    fetchAllSubjects();
  }, [user, hasRole, normalizedRoles, exams, examFormData.class]);

  // Handlers for Exam Creation
  const handleExamFormChange = (field, value) => {
    // When the exam type changes, update the max marks based on the
    // selected grading scheme. If no matching scheme is found, leave
    // existing values unchanged. For other fields, simply update the
    // value as provided.
    if (field === 'examType') {
      const gt = gradeTypes.find(g => g.examType === value);
      if (gt) {
        setExamFormData({ ...examFormData, examType: value, internalMax: gt.internalMax, externalMax: gt.externalMax });
      } else {
        setExamFormData({ ...examFormData, examType: value });
      }
    } else if (field === 'hasInternalMarks') {
      // When toggling internal marks, reset internal max to 0 if disabled
      const newData = { ...examFormData, hasInternalMarks: value };
      if (!value) {
        newData.internalMax = 0;
      } else {
        // Re-enable with default value or from grade type
        const gt = gradeTypes.find(g => g.examType === examFormData.examType);
        newData.internalMax = gt ? gt.internalMax : 20;
      }
      setExamFormData(newData);
    } else {
      setExamFormData({ ...examFormData, [field]: value });
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!user) {
      setApiError('You must be logged in to create an exam');
      return;
    }
    
      // Log current user state to help debug role issues
      console.log('Creating exam with user:', {
        email: user.email,
        name: user.name,
        roles: user.roles,
        normalizedRoles: normalizedRoles
      });    try {
      const totalMax = Number(examFormData.internalMax || 0) + Number(examFormData.externalMax || 0);
      
      setApiError(''); // Clear any previous errors
      
      // Validate form data
      if (!examFormData.examType) {
        setApiError('Please select an exam type');
        return;
      }
      if (!examFormData.class) {
        setApiError('Please select a class');
        return;
      }
      if (!examFormData.subject) {
        setApiError('Please select a subject');
        return;
      }
      
      // Create exam and show overlay/toast while the request runs
      await withSubmit('Creating exam...', async () => {
        const result = await api.createExam(user.email, {
          creatorName: user.name || '',
          class: examFormData.class,
          subject: examFormData.subject,
          examType: examFormData.examType,
          hasInternalMarks: examFormData.hasInternalMarks,
          internalMax: examFormData.hasInternalMarks ? Number(examFormData.internalMax) : 0,
          externalMax: Number(examFormData.externalMax),
          totalMax: totalMax,
          date: examFormData.date
        });
        
        if (result && result.error) {
          throw new Error(result.error);
        }
        
        return result;
      });
      
      // Show success message
      setToast({ type: 'success', text: 'Exam created successfully' });
      setTimeout(() => setToast(null), 3000);
      
      // Refresh exams list with proper role-based filtering
      await reloadExams();
      
      // Close form and reset
      setShowExamForm(false);
      setExamFormData({ examType: '', class: '', subject: '', hasInternalMarks: true, internalMax: 20, externalMax: 80, date: todayIST() });
    } catch (err) {
      console.error('Error creating exam:', err);
      setApiError(`Failed to create exam: ${err.message || 'Unknown error'}`);
    }
  };

  // Handlers for Bulk Exam Creation
  const handleBulkExamFormChange = (field, value) => {
    if (field === 'examType') {
      const gt = gradeTypes.find(g => g.examType === value);
      if (gt) {
        setBulkExamFormData({ 
          ...bulkExamFormData, 
          examType: value, 
          internalMax: gt.internalMax, 
          externalMax: gt.externalMax 
        });
      } else {
        setBulkExamFormData({ ...bulkExamFormData, examType: value });
      }
    } else if (field === 'hasInternalMarks') {
      // When toggling internal marks, reset internal max to 0 if disabled
      const newData = { ...bulkExamFormData, hasInternalMarks: value };
      if (!value) {
        newData.internalMax = 0;
      } else {
        // Re-enable with default value or from grade type
        const gt = gradeTypes.find(g => g.examType === bulkExamFormData.examType);
        newData.internalMax = gt ? gt.internalMax : 20;
      }
      setBulkExamFormData(newData);
    } else if (field === 'subjects') {
      // Handle multiple subject selection
      setSelectedSubjects(value);
    } else {
      setBulkExamFormData({ ...bulkExamFormData, [field]: value });
    }
  };

  // Toggle subject selection for bulk exam creation
  const toggleSubjectSelection = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  // Update the date for a specific subject in bulk creation
  const updateSubjectExamDate = (subject, date) => {
    // Validate and normalize the date format
    let validDate = date;
    
    // If date is empty or invalid, use today's date
    if (!validDate || !validDate.trim()) {
      validDate = todayIST();
    } else {
      try {
        // Ensure the date is valid by parsing and reformatting
        validDate = parseApiDate(validDate);
      } catch (err) {
        console.error('Invalid date format:', err);
        validDate = todayIST(); // Fallback to today
      }
    }
    
    const updatedSubjectExams = [...bulkExamFormData.subjectExams];
    const existingIndex = updatedSubjectExams.findIndex(item => item.subject === subject);
    
    if (existingIndex >= 0) {
      updatedSubjectExams[existingIndex] = { ...updatedSubjectExams[existingIndex], date: validDate };
    } else {
      updatedSubjectExams.push({ subject, date: validDate });
    }
    
    setBulkExamFormData({
      ...bulkExamFormData,
      subjectExams: updatedSubjectExams
    });
  };

  // Handle bulk exam creation submission
  const handleBulkExamCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      setApiError('You must be logged in to create exams');
      return;
    }
    
    try {
      setApiError(''); // Clear any previous errors
      
      // Validate form data
      if (!bulkExamFormData.examType) {
        setApiError('Please select an exam type');
        return;
      }
      if (!bulkExamFormData.class) {
        setApiError('Please select a class');
        return;
      }
      if (selectedSubjects.length === 0) {
        setApiError('Please select at least one subject');
        return;
      }
      
      // Create subjectExams array from selected subjects and their dates
      const subjectExams = selectedSubjects.map(subject => {
        const existingSubjectExam = bulkExamFormData.subjectExams.find(item => item.subject === subject);
        let examDate = existingSubjectExam?.date || todayIST();
        
        // Validate and normalize the date format
        try {
          // Ensure the date is valid by parsing and reformatting
          examDate = parseApiDate(examDate);
        } catch (err) {
          console.error(`Invalid date format for ${subject}:`, err);
          examDate = todayIST(); // Fallback to today
        }
        
        return {
          subject,
          date: examDate
        };
      });
      
      // Calculate total max marks
      const totalMax = Number(bulkExamFormData.internalMax || 0) + Number(bulkExamFormData.externalMax || 0);
      
      // Submit bulk exams creation
      await withSubmit('Creating exams...', async () => {
        const result = await api.createBulkExams(user.email, {
          creatorName: user.name || '',
          class: bulkExamFormData.class,
          examType: bulkExamFormData.examType,
          hasInternalMarks: bulkExamFormData.hasInternalMarks,
          internalMax: bulkExamFormData.hasInternalMarks ? Number(bulkExamFormData.internalMax) : 0,
          externalMax: Number(bulkExamFormData.externalMax),
          totalMax: totalMax,
          subjectExams
        });
        
        if (result && result.error) {
          throw new Error(result.error);
        }
        
        return result;
      });
      
      // Show success message
      setToast({ 
        type: 'success', 
        text: `Successfully created ${selectedSubjects.length} exams` 
      });
      setTimeout(() => setToast(null), 3000);
      
      // Refresh exams list
      await reloadExams();
      
      // Reset form and close
      setShowBulkExamForm(false);
      setBulkExamFormData({
        examType: '',
        class: '',
        hasInternalMarks: true,
        internalMax: 20,
        externalMax: 80,
        subjectExams: []
      });
      setSelectedSubjects([]);
      
    } catch (err) {
      console.error('Error creating bulk exams:', err);
      setApiError(`Failed to create exams: ${err.message || 'Unknown error'}`);
    }
  };

  // Helper to reload exams list from backend and set local state
  const reloadExams = async () => {
    try {
      setIsLoading(true);
      setApiError('');
      
      // Clear cache when reloading exams to ensure fresh data
      clearCache();
      
      // Determine role information
      const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
      const userRole = isClassTeacher ? 'classteacher' : 
                     normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster')) ? 'headmaster' : 
                     'teacher';
      
      // Pass additional info to help backend filter appropriately
      const list = await api.getExams({
        teacherEmail: user?.email || undefined,
        role: userRole, // Send specific role to backend
        classTeacherFor: user?.classTeacherFor || undefined, // Send class teacher info
        teacherSubjects: user?.subjects || undefined, // Send subject info
        class: filters.class || undefined,
        subject: filters.subject || undefined,
        examType: filters.examType || undefined,
        // prevent CDN/browser cache on Apps Script
        _ts: Date.now()
      });
      
      setExams(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to reload exams', e);
      setApiError('Failed to load exams: ' + (e.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  // Use a stronger normalization that removes spaces and non-alphanumeric
  // characters so values like "6 A" and "6A" match reliably.
  const normKey = useCallback((s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''), []);

  // Memoize the expensive filtering logic for better performance
  const examsForTeacher = useMemo(() => {
    if (!user || !exams.length) return [];
    
    // Pre-compute normalized user data
    const userClassesNorm = user.classes ? new Set(user.classes.map(c => normKey(c))) : new Set();
    const userSubjectsNorm = user.subjects ? new Set(user.subjects.map(s => normKey(s))) : new Set();
    const userClassTeacherForNorm = user.classTeacherFor ? normKey(user.classTeacherFor) : '';
    
    return exams.filter(ex => {
      // Check for HM role, allowing for different formats (h m, hm, headmaster)
      if (normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) return true;
      
      const exClass = normKey(ex.class);
      const exSubject = normKey(ex.subject);
      const teachesClass = userClassesNorm.has(exClass);
      const teachesSubject = userSubjectsNorm.has(exSubject);
      
      // If user is a Class Teacher, allow access to:
      // 1. Any subject from the class they are class teacher for
      // 2. OR subjects they teach but only in classes they are assigned to teach
      const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
      if (isClassTeacher) {
        // Access to all subjects in the class they are class teacher for
        const isClassTeacherForThisClass = userClassTeacherForNorm && userClassTeacherForNorm === exClass;
        
        // Access to subjects they teach, but only in classes they are assigned to
        const teachesThisSubjectInThisClass = teachesSubject && teachesClass;
        
        return isClassTeacherForThisClass || teachesThisSubjectInThisClass;
      }
      
      // Regular subject teacher: require both class and subject match.
      return teachesClass && teachesSubject;
    });
  }, [exams, user, normalizedRoles, normKey]);

  // Open marks form for a specific exam with caching optimization
  const openMarksForm = useCallback(async (exam) => {
    setSelectedExam(exam);
    setIsLoading(true);
    setApiError('');
    
    try {
      console.log('🔍 Opening marks form for exam:', exam);
      
      // Check cache first to avoid duplicate API calls
      const cacheKey = `${exam.class}_${exam.examId}`;
      
      let students = studentsCache.get(exam.class);
      let marks = marksCache.get(exam.examId);
      
      // Fetch students only if not cached
      if (!students) {
        console.log('📚 Fetching students for class:', exam.class);
        students = await api.getStudents(exam.class);
        console.log('✅ Students fetched:', students);
        setStudentsCache(prev => new Map(prev.set(exam.class, students)));
      } else {
        console.log('📚 Using cached students for class:', exam.class);
      }
      
      // Fetch marks only if not cached
      if (!marks) {
        console.log('📊 Fetching marks for examId:', exam.examId);
        marks = await api.getExamMarks(exam.examId);
        console.log('✅ Marks fetched:', marks);
        setMarksCache(prev => new Map(prev.set(exam.examId, marks)));
      } else {
        console.log('📊 Using cached marks for examId:', exam.examId);
      }
      
      // Validate data
      if (!Array.isArray(students) || students.length === 0) {
        throw new Error(`No students found for class ${exam.class}`);
      }
      
      // Create marks rows for each student, pre-populating with existing marks
      const marksMap = {};
      if (Array.isArray(marks)) {
        marks.forEach(mark => {
          if (mark && mark.admNo) {
            marksMap[mark.admNo] = mark;
          }
        });
      }
      
      console.log('📝 Creating marks rows for', students.length, 'students');
      
      // Create a row for each student
      const rows = students.map(student => {
        const existingMark = marksMap[student.admNo] || {};
        
        // For external-only exams, if external is empty but total exists, use total as external
        let external = existingMark.external || '';
        let total = existingMark.total || '';
        
        // If this is an external-only exam and external is empty but total has value
        if (!examHasInternalMarks(exam) && !external && total) {
          external = total;
        }

        // Recalculate percentage and grade using current grading system
        let percentage = existingMark.percentage || '';
        let grade = existingMark.grade || '';
        
        if (external || existingMark.internal) {
          const calculatedTotal = examHasInternalMarks(exam) 
            ? (Number(existingMark.internal) || 0) + (Number(external) || 0)
            : (Number(external) || 0);
          
          if (exam.totalMax && calculatedTotal > 0) {
            percentage = Math.round((calculatedTotal / exam.totalMax) * 100);
            grade = calculateGrade(percentage, exam.class);
          }
        }
        
        return {
          admNo: student.admNo,
          studentName: student.name,
          internal: existingMark.internal || '',
          external: external,
          total: total,
          percentage: percentage,
          grade: grade
        };
      });
      
      console.log('✅ Marks rows created:', rows.length);
      setMarksRows(rows);
      setShowMarksForm(true);
    } catch (err) {
      console.error('Failed to load students or marks data', err);
      setApiError(`Error loading marks form: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [studentsCache, marksCache, calculateGrade]);

  // Open edit exam form
  const openEditExamForm = (exam) => {
    // Clone the exam data for editing
    setEditExamData({
      examId: exam.examId,
      class: exam.class,
      subject: exam.subject,
      examType: exam.examType,
      hasInternalMarks: examHasInternalMarks(exam),
      internalMax: Number(exam.internalMax || 0),
      externalMax: Number(exam.externalMax || 0),
      date: parseApiDate(exam.date) // Ensure we have a normalized date format
    });
    setShowEditExamForm(true);
  };
  
  // Handle edit exam form submission
  const handleEditExam = async (e) => {
    e.preventDefault();
    if (!editExamData || !user) {
      setApiError('Missing exam data or user not logged in');
      return;
    }
    
    try {
      setApiError(''); // Clear any previous errors
      
      // Calculate total max marks
      const totalMax = Number(editExamData.internalMax || 0) + Number(editExamData.externalMax || 0);
      
      // Submit update via API
      await withSubmit('Updating exam...', async () => {
        const result = await api.updateExam({
          examId: editExamData.examId,
          userEmail: user.email,
          class: editExamData.class,
          subject: editExamData.subject,
          examType: editExamData.examType,
          hasInternalMarks: editExamData.hasInternalMarks,
          internalMax: editExamData.hasInternalMarks ? Number(editExamData.internalMax) : 0,
          externalMax: Number(editExamData.externalMax),
          totalMax: totalMax,
          date: editExamData.date
        });
        
        if (result && result.error) {
          throw new Error(result.error);
        }
        
        return result;
      });
      
      // Show success message
      setToast({ type: 'success', text: 'Exam updated successfully' });
      setTimeout(() => setToast(null), 3000);
      
      // Refresh exams list
      reloadExams();
      
      // Close form
      setShowEditExamForm(false);
      setEditExamData(null);
      
    } catch (err) {
      console.error('Error updating exam:', err);
      setApiError(`Failed to update exam: ${err.message || 'Unknown error'}`);
    }
  };
  
  // View marks for a specific exam (read-only)
  const viewMarks = useCallback(async (exam) => {
    setSelectedExam(exam);
    setIsLoading(true);
    setApiError('');
    
    try {
      // Use cache optimization here too
      let students = studentsCache.get(exam.class);
      let marks = marksCache.get(exam.examId);
      
      // Fetch students only if not cached
      if (!students) {
        students = await api.getStudents(exam.class);
        setStudentsCache(prev => new Map(prev.set(exam.class, students)));
      }
      
      // Fetch marks only if not cached
      if (!marks) {
        marks = await api.getExamMarks(exam.examId);
        setMarksCache(prev => new Map(prev.set(exam.examId, marks)));
      }
      
      // Create marks rows for each student with existing marks
      const marksMap = {};
      if (Array.isArray(marks)) {
        marks.forEach(mark => {
          if (mark && mark.admNo) {
            marksMap[mark.admNo] = mark;
          }
        });
      }
      
      // Create a row for each student
      const rows = Array.isArray(students) ? students.map(student => {
        const existingMark = marksMap[student.admNo] || {};
        
        // For external-only exams, if external is empty but total exists, use total as external
        let external = existingMark.external || '';
        let total = existingMark.total || '';
        
        // If this is an external-only exam and external is empty but total has value
        if (!examHasInternalMarks(exam) && !external && total) {
          external = total;
        }
        
        // Calculate percentage and grade using the new class-specific grading system
        const calculatedPercentage = total && exam.totalMax ? Math.round((total / exam.totalMax) * 100) : 0;
        
        return {
          admNo: student.admNo,
          studentName: student.name,
          internal: existingMark.internal || '',
          external: external,
          total: total,
          percentage: calculatedPercentage,
          grade: calculateGrade(calculatedPercentage, exam.class)
        };
      }) : [];
      
      setExamMarks(rows);
      setViewExamMarks(exam);
    } catch (err) {
      console.error('Failed to load marks data', err);
      setApiError(`Error loading marks: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [studentsCache, marksCache, calculateGrade]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
        <div className="flex space-x-3">
          {user && (normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) && (
            <>
              <button
                onClick={() => setShowExamForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Exam
              </button>
              <button
                onClick={() => setShowBulkExamForm(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Bulk Exams
              </button>
            </>
          )}
          {user && (normalizedRoles.some(r => r.includes('teacher'))) && (
            <button
              onClick={() => {
                // If there are no exams matching this teacher's classes/subjects, show feedback
                if (!examsForTeacher || examsForTeacher.length === 0) {
                  setApiError('No exams available for your classes or subjects to enter marks.');
                  return;
                }
                // Teacher selects exam to enter marks; if only one exam, open directly, else pick the first
                if (examsForTeacher.length >= 1) {
                  openMarksForm(examsForTeacher[0]);
                }
              }}
              disabled={!examsForTeacher || examsForTeacher.length === 0}
              className={`bg-green-600 text-white px-4 py-2 rounded-lg flex items-center ${(!examsForTeacher || examsForTeacher.length === 0) ? 'opacity-50 cursor-not-allowed hover:bg-green-600' : 'hover:bg-green-700'}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Edit Marks
            </button>
          )}
        </div>
      </div>

      {/* Exam Creation Form */}
      {showExamForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Exam</h2>
          <form onSubmit={handleCreateExam} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                <select
                  value={examFormData.examType}
                  onChange={(e) => handleExamFormChange('examType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Exam Type</option>
                  {gradeTypes.map((gt) => (
                    <option key={gt.examType} value={gt.examType}>{gt.examType}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={examFormData.class}
                  onChange={(e) => handleExamFormChange('class', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Class</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={examFormData.subject}
                  onChange={(e) => handleExamFormChange('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Subject</option>
                  {availableSubjects.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={examFormData.date}
                  onChange={(e) => handleExamFormChange('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="hasInternalMarks"
                    checked={examFormData.hasInternalMarks}
                    onChange={(e) => handleExamFormChange('hasInternalMarks', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="hasInternalMarks" className="ml-2 text-sm font-medium text-gray-700">
                    Internal Marks?
                  </label>
                </div>
                {examFormData.hasInternalMarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Max Marks</label>
                    <input
                      type="number"
                      value={examFormData.internalMax}
                      onChange={(e) => handleExamFormChange('internalMax', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">External Max Marks</label>
                <input
                  type="number"
                  value={examFormData.externalMax}
                  onChange={(e) => handleExamFormChange('externalMax', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  required
                />
              </div>
            </div>
            {apiError && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
                {apiError}
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowExamForm(false);
                  setApiError('');
                  setExamFormData({ examType: '', class: '', subject: '', hasInternalMarks: true, internalMax: 20, externalMax: 80, date: todayIST() });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center"
              >
                <span className="mr-1">✓</span> Create Exam
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Exam Creation Form */}
      {showBulkExamForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Create Multiple Exams</h2>
          <form onSubmit={handleBulkExamCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                <select
                  value={bulkExamFormData.examType}
                  onChange={(e) => handleBulkExamFormChange('examType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Exam Type</option>
                  {gradeTypes.map((gt) => (
                    <option key={gt.examType} value={gt.examType}>{gt.examType}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={bulkExamFormData.class}
                  onChange={(e) => handleBulkExamFormChange('class', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Class</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="bulkHasInternalMarks"
                    checked={bulkExamFormData.hasInternalMarks}
                    onChange={(e) => handleBulkExamFormChange('hasInternalMarks', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="bulkHasInternalMarks" className="ml-2 text-sm font-medium text-gray-700">
                    Internal Marks?
                  </label>
                </div>
                {bulkExamFormData.hasInternalMarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Max Marks</label>
                    <input
                      type="number"
                      value={bulkExamFormData.internalMax}
                      onChange={(e) => handleBulkExamFormChange('internalMax', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">External Max Marks</label>
                <input
                  type="number"
                  value={bulkExamFormData.externalMax}
                  onChange={(e) => handleBulkExamFormChange('externalMax', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  required
                />
              </div>
            </div>
            
            {/* Subject Selection */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Subjects & Set Exam Dates</label>
              <div className="border border-gray-200 rounded-lg p-4 max-h-72 overflow-y-auto">
                {availableSubjects.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exam Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {availableSubjects.map((subject) => {
                        // Find existing date if any
                        const existingSubjectExam = bulkExamFormData.subjectExams.find(
                          item => item.subject === subject
                        );
                        const date = existingSubjectExam?.date || todayIST();
                        
                        return (
                          <tr key={subject}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedSubjects.includes(subject)}
                                onChange={() => toggleSubjectSelection(subject)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">{subject}</td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={date}
                                onChange={(e) => updateSubjectExamDate(subject, e.target.value)}
                                className="w-full py-1 px-2 border rounded"
                                disabled={!selectedSubjects.includes(subject)}
                                required={selectedSubjects.includes(subject)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    {subjectsLoading ? "Loading subjects..." : "No subjects available"}
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {selectedSubjects.length} subjects selected
              </div>
            </div>
            
            {apiError && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
                {apiError}
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowBulkExamForm(false);
                  setApiError('');
                  setBulkExamFormData({
                    examType: '',
                    class: '',
                    hasInternalMarks: true,
                    internalMax: 20,
                    externalMax: 80,
                    subjectExams: []
                  });
                  setSelectedSubjects([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedSubjects.length === 0}
                className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center ${
                  selectedSubjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <span className="mr-1">✓</span> Create {selectedSubjects.length} Exams
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Exams List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Available Exams</h2>
            {isLoading && (
              <div className="flex items-center text-blue-600">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            )}
          </div>
          
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Class</label>
              <div className="relative">
                <select
                  value={filters.class}
                  onChange={(e) => setFilters({...filters, class: e.target.value})}
                  className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">All Classes</option>
                  {/* If user is a class teacher, highlight their assigned class */}
                  {user && user.classTeacherFor && normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher') && (
                    <option value={user.classTeacherFor} style={{fontWeight: 'bold', backgroundColor: '#e6f2ff'}}>
                      {user.classTeacherFor} (My Class)
                    </option>
                  )}
                  {availableClasses
                    .filter(cls => cls !== user?.classTeacherFor) // Remove duplicates
                    .map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Subject</label>
              <div className="relative">
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters({...filters, subject: e.target.value})}
                  className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">All Subjects</option>
                  {availableSubjects.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Exam Type</label>
              <div className="relative">
                <select
                  value={filters.examType}
                  onChange={(e) => setFilters({...filters, examType: e.target.value})}
                  className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">All Types</option>
                  {gradeTypes.map(type => (
                    <option key={type.examType} value={type.examType}>{type.examType}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => reloadExams()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                disabled={isLoading}
              >
                <Filter className="w-4 h-4" /> Apply Filters
              </button>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({class: '', subject: '', examType: ''});
                  reloadExams();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
          
          {apiError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
              {apiError}
            </div>
          )}
        {isLoading ? (
          <div className="text-gray-500 text-center py-12">
            <div className="flex justify-center mb-3">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            Loading exams...
          </div>
        ) : examsForTeacher && examsForTeacher.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Marks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {examsForTeacher.map((exam) => {
                  const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
                  const isClassTeacherForThisClass = user.classTeacherFor && normKey(user.classTeacherFor) === normKey(exam.class);
                  const teachesSubject = user.subjects && new Set(user.subjects.map(s => normKey(s))).has(normKey(exam.subject));
                  
                  // Highlight exams based on access type
                  let rowClassName = "";
                  let accessBadge = null;
                  
                  if (isClassTeacher && isClassTeacherForThisClass) {
                    // This exam is for a class where the user is class teacher
                    rowClassName = "border-l-4 border-blue-300";
                    accessBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                        Class Teacher
                      </span>
                    );
                  } else if (teachesSubject) {
                    // This exam is for a subject the user teaches
                    rowClassName = "border-l-4 border-green-300";
                    accessBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                        Subject Teacher
                      </span>
                    );
                  }
                  
                  return (
                    <tr key={exam.examId} className={rowClassName}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {exam.examName || `${exam.examType} - ${exam.class} - ${exam.subject}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{exam.class}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{exam.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {exam.date && exam.date !== '1950-01-01' && exam.date !== '1999-12-31' ? 
                          formatShortDate(parseApiDate(exam.date)) : 
                          formatShortDate(new Date())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{exam.totalMax}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {accessBadge}
                          <button 
                            onClick={() => viewMarks(exam)}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                          >
                            View Marks
                          </button>
                          <button 
                            onClick={() => openMarksForm(exam)}
                            className="text-green-600 hover:text-green-900 mr-2"
                          >
                            Edit Marks
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedExam(exam);
                              setShowBulkMarksUpload(true);
                            }}
                            className="text-orange-600 hover:text-orange-900 mr-2"
                            title="Upload marks from CSV file"
                          >
                            Bulk Upload
                          </button>
                          {/* Edit Exam Button - only visible to headmasters */}
                          {normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster')) && (
                            <button 
                              onClick={() => openEditExamForm(exam)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              Edit Exam
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
            <div className="flex justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-12 h-12 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium">No exams available for you to manage.</p>
            <p className="mt-1 text-sm">Try adjusting your filters or check back later.</p>
          </div>
        )}
      </div>
      
      {/* Marks Entry Form */}
      {showMarksForm && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
              <span>Enter Marks: {selectedExam.examName || `${selectedExam.examType} - ${selectedExam.class} - ${selectedExam.subject}`}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={refreshExamData}
                  disabled={isLoading}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                  title="Refresh exam data"
                >
                  🔄 Refresh
                </button>
                <button 
                  onClick={clearCache}
                  className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                  title="Clear all cache"
                >
                  🗑️ Clear Cache
                </button>
                <button 
                  onClick={() => setShowMarksForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </h2>
            
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Max Marks:</span> {selectedExam.totalMax} 
                {examHasInternalMarks(selectedExam) && (
                  <span>(Internal: {selectedExam.internalMax || 0}, External: {selectedExam.externalMax || 0})</span>
                )}
                {!examHasInternalMarks(selectedExam) && (
                  <span>(External only: {selectedExam.externalMax || 0})</span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSubmitMarks}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  disabled={isLoading}
                >
                  Save Marks
                </button>
              </div>
            </div>
            
            {apiError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
                {apiError}
              </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm. No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                      {/* Only show internal marks column if exam has internal marks */}
                      {examHasInternalMarks(selectedExam) && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Internal ({selectedExam.internalMax || 0})</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External ({selectedExam.externalMax || 0})</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {marksRows.map((row, index) => (
                      <tr key={row.admNo} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.admNo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.studentName}</td>
                        {/* Only show internal marks input if exam has internal marks */}
                        {examHasInternalMarks(selectedExam) && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            <input 
                              type="number" 
                              min="0" 
                              max={selectedExam.internalMax || 0} 
                              value={row.internal} 
                              onChange={(e) => handleMarksChange(index, 'internal', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded-md"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap">
                          <input 
                            type="number" 
                            min="0" 
                            max={selectedExam.externalMax || 0} 
                            value={row.external} 
                            onChange={(e) => handleMarksChange(index, 'external', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-md"
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{calculateTotal(row, selectedExam)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{calculatePercentage(row, selectedExam.totalMax, selectedExam)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{calculateGrade(calculatePercentage(row, selectedExam.totalMax, selectedExam), selectedExam.class)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {showEditExamForm && editExamData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Exam Details</h2>
              <button 
                onClick={() => setShowEditExamForm(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditExam}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={editExamData.class}
                    onChange={(e) => setEditExamData({...editExamData, class: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select
                    value={editExamData.subject}
                    onChange={(e) => setEditExamData({...editExamData, subject: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select Subject</option>
                    {availableSubjects.map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                  <select
                    value={editExamData.examType}
                    onChange={(e) => setEditExamData({...editExamData, examType: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select Exam Type</option>
                    {gradeTypes.map((type) => (
                      <option key={type.examType} value={type.examType}>{type.examType}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label>
                  <input
                    type="date"
                    value={editExamData.date ? new Date(editExamData.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditExamData({...editExamData, date: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                
                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="editHasInternalMarks"
                      checked={editExamData.hasInternalMarks}
                      onChange={(e) => setEditExamData({...editExamData, hasInternalMarks: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="editHasInternalMarks" className="text-sm font-medium text-gray-700">Has Internal Marks?</label>
                  </div>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editExamData.hasInternalMarks ? 'External Maximum Marks' : 'Maximum Marks'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editExamData.externalMax}
                    onChange={(e) => setEditExamData({...editExamData, externalMax: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                
                {editExamData.hasInternalMarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Maximum Marks</label>
                    <input
                      type="number"
                      min="0"
                      value={editExamData.internalMax}
                      onChange={(e) => setEditExamData({...editExamData, internalMax: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditExamForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update Exam
                </button>
              </div>
            </form>
            
            {apiError && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {apiError}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* View Marks Modal */}
      {viewExamMarks && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
              <span>View Marks: {viewExamMarks.examName || `${viewExamMarks.examType} - ${viewExamMarks.class} - ${viewExamMarks.subject}`}</span>
              <button 
                onClick={() => setViewExamMarks(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </h2>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Max Marks:</span> {viewExamMarks.totalMax} 
                {examHasInternalMarks(viewExamMarks) && (
                  <span>(Internal: {viewExamMarks.internalMax || 0}, External: {viewExamMarks.externalMax || 0})</span>
                )}
                {!examHasInternalMarks(viewExamMarks) && (
                  <span>(External only: {viewExamMarks.externalMax || 0})</span>
                )}
              </div>
            </div>
            
            {apiError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
                {apiError}
              </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                      {examHasInternalMarks(viewExamMarks) && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Internal</th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {examMarks.map((row, index) => (
                      <tr key={row.admNo} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.admNo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.studentName}</td>
                        {examHasInternalMarks(viewExamMarks) && (
                          <td className="px-4 py-2 whitespace-nowrap text-sm">{row.internal || '-'}</td>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.external || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.total || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {row.percentage ? row.percentage + '%' : 
                           (row.total && viewExamMarks.totalMax ? Math.round((row.total / viewExamMarks.totalMax) * 100) + '%' : '-')}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.grade || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Marks Upload Modal */}
      {showBulkMarksUpload && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
              <span>Bulk Upload Marks: {selectedExam.examName || `${selectedExam.examType} - ${selectedExam.class} - ${selectedExam.subject}`}</span>
              <button 
                onClick={() => {
                  setShowBulkMarksUpload(false);
                  setBulkMarksFile(null);
                  setBulkMarksData([]);
                  setBulkMarksPreview([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </h2>
            
            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Upload a CSV file with columns: <strong>admNo, studentName, external</strong> {examHasInternalMarks(selectedExam) && <span>and optionally <strong>internal</strong></span>}</li>
                  <li>• First row should contain column headers</li>
                  <li>• Grades and totals will be calculated automatically</li>
                  <li>• Download sample file below for reference</li>
                </ul>
                <button
                  onClick={downloadMarksSample}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  📥 Download Sample CSV File
                </button>
              </div>
              
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkMarksFileChange}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                />
              </div>
              
              {/* Preview */}
              {bulkMarksPreview.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Preview (First 5 rows):</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                          {examHasInternalMarks(selectedExam) && (
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Internal</th>
                          )}
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">External</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bulkMarksPreview.map((row, index) => {
                          const internal = Number(row.internal) || 0;
                          const external = Number(row.external) || 0;
                          const total = examHasInternalMarks(selectedExam) ? internal + external : external;
                          const percentage = selectedExam.totalMax ? Math.round((total / selectedExam.totalMax) * 100) : 0;
                          const grade = calculateGrade(percentage, selectedExam.class);
                          
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 text-sm">{row.admNo}</td>
                              <td className="px-4 py-2 text-sm">{row.studentName}</td>
                              {examHasInternalMarks(selectedExam) && (
                                <td className="px-4 py-2 text-sm">{row.internal || '-'}</td>
                              )}
                              <td className="px-4 py-2 text-sm">{row.external || '-'}</td>
                              <td className="px-4 py-2 text-sm">{total}</td>
                              <td className="px-4 py-2 text-sm">{percentage}%</td>
                              <td className="px-4 py-2 text-sm">{grade}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {bulkMarksData.length > 5 && (
                    <p className="text-sm text-gray-600 mt-2">
                      ...and {bulkMarksData.length - 5} more rows
                    </p>
                  )}
                </div>
              )}
              
              {/* Error Display */}
              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">
                  {apiError}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowBulkMarksUpload(false);
                    setBulkMarksFile(null);
                    setBulkMarksData([]);
                    setBulkMarksPreview([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkMarksUpload}
                  disabled={!bulkMarksData.length || isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Uploading...' : `Upload ${bulkMarksData.length} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  // Helper function to handle marks change
  function handleMarksChange(index, field, value) {
    const newRows = [...marksRows];
    newRows[index][field] = value;
    
    // Auto-calculate total, percentage, and grade when marks change
    if (field === 'internal' || field === 'external') {
      const total = calculateTotal(newRows[index], selectedExam);
      const percentage = calculatePercentage(newRows[index], selectedExam.totalMax, selectedExam);
      const grade = calculateGrade(percentage, selectedExam.class);
      
      newRows[index].total = total;
      newRows[index].percentage = percentage;
      newRows[index].grade = grade;
    }
    
    setMarksRows(newRows);
  }
  
  // Helper function to calculate total marks
  function calculateTotal(row, exam = selectedExam) {
    const external = Number(row.external) || 0;
    if (examHasInternalMarks(exam)) {
      const internal = Number(row.internal) || 0;
      return internal + external;
    }
    return external;
  }
  
  // Helper function to calculate percentage
  function calculatePercentage(row, maxMarks, exam = selectedExam) {
    if (!maxMarks) return '';
    const total = calculateTotal(row, exam);
    return Math.round((total / maxMarks) * 100);
  }
  
  // Submit marks to the backend
  async function handleSubmitMarks() {
    if (!selectedExam || !user) return;
    
    try {
      setIsLoading(true);
      setApiError('');
      
      // Format marks data
      const marks = marksRows.map(row => ({
        admNo: row.admNo,
        studentName: row.studentName,
        internal: Number(row.internal) || 0,
        external: Number(row.external) || 0
      }));
      
      // Submit to API
      const result = await api.submitExamMarks({
        examId: selectedExam.examId,
        class: selectedExam.class,
        subject: selectedExam.subject,
        teacherEmail: user.email,
        teacherName: user.name || user.email,
        marks
      });
      
      // Support both response formats for compatibility
      if (result && (result.ok || result.submitted)) {
        setToast({ type: 'success', text: 'Marks saved successfully' });
        setTimeout(() => setToast(null), 3000);
        setShowMarksForm(false);
      } else {
        throw new Error(result?.error || 'Failed to save marks');
      }
    } catch (err) {
      console.error('Error submitting marks:', err);
      setApiError(`Failed to save marks: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Bulk Marks Upload Functions
  const handleBulkMarksFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setBulkMarksFile(file);
    
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      
      // Remove empty rows
      const validRows = rows.filter(row => row.some(cell => cell));
      
      if (validRows.length < 2) {
        setApiError('CSV file must have at least a header row and one data row');
        return;
      }
      
      // Expected headers: admNo, studentName, internal (optional), external
      const headers = validRows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
      const dataRows = validRows.slice(1);
      
      // Validate headers
      const requiredHeaders = ['admno', 'studentname', 'external'];
      const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));
      
      if (!hasRequiredHeaders) {
        setApiError('CSV must have columns: admNo, studentName, external (and optionally internal)');
        return;
      }
      
      // Parse data
      const parsedData = dataRows.map(row => {
        const data = {};
        headers.forEach((header, index) => {
          data[header] = row[index] || '';
        });
        
        return {
          admNo: data.admno || '',
          studentName: data.studentname || '',
          internal: data.internal || '',
          external: data.external || '',
        };
      }).filter(row => row.admNo && row.studentName);
      
      setBulkMarksData(parsedData);
      setBulkMarksPreview(parsedData.slice(0, 5)); // Show first 5 rows as preview
      setApiError('');
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setApiError('Error parsing CSV file: ' + error.message);
    }
  };

  const handleBulkMarksUpload = async () => {
    if (!selectedExam || !bulkMarksData.length) return;
    
    try {
      setIsLoading(true);
      setApiError('');
      
      // Process bulk data and auto-calculate totals, percentages, and grades
      const processedMarks = bulkMarksData.map(row => {
        const internal = Number(row.internal) || 0;
        const external = Number(row.external) || 0;
        const total = examHasInternalMarks(selectedExam) ? internal + external : external;
        const percentage = selectedExam.totalMax ? Math.round((total / selectedExam.totalMax) * 100) : 0;
        const grade = calculateGrade(percentage, selectedExam.class);
        
        return {
          admNo: row.admNo,
          studentName: row.studentName,
          internal: internal,
          external: external,
          total: total,
          percentage: percentage,
          grade: grade
        };
      });
      
      // Submit to API
      const result = await api.submitExamMarks({
        examId: selectedExam.examId,
        class: selectedExam.class,
        subject: selectedExam.subject,
        teacherEmail: user.email,
        teacherName: user.name || user.email,
        marks: processedMarks
      });
      
      if (result && (result.ok || result.submitted)) {
        setToast({ type: 'success', text: `Bulk marks uploaded successfully for ${processedMarks.length} students` });
        setTimeout(() => setToast(null), 3000);
        
        // Reset bulk upload state
        setShowBulkMarksUpload(false);
        setBulkMarksFile(null);
        setBulkMarksData([]);
        setBulkMarksPreview([]);
        
        // Clear cache to show updated data
        setStudentsCache(new Map());
        setMarksCache(new Map());
      } else {
        throw new Error(result?.error || 'Failed to upload bulk marks');
      }
    } catch (err) {
      console.error('Error uploading bulk marks:', err);
      setApiError(`Failed to upload bulk marks: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadMarksSample = () => {
    // Create sample CSV content
    const sampleData = [
      ['admNo', 'studentName', 'internal', 'external'],
      ['5885', 'Aarav R Menon', '10', '15'],
      ['5933', 'Abhimanyu A', '12', '18'],
      ['5890', 'Abhinand V K', '11', '17']
    ];
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'exam_marks_sample.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
};

export default React.memo(ExamManagement);