import { Plus, RefreshCw, Upload, Download, ChevronUp, ChevronDown, Share2 } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../api';
import { useToast } from '../hooks/useToast';
import { todayIST, parseApiDate, formatShortDate } from '../utils/dateUtils';

const ExamManagement = ({ user, hasRole, withSubmit, userRolesNorm }) => {
  // Get notification functions
  const { success, error: _error, warning, info: _info } = useToast();
  const displayClass = (cls) => {
    const v = Array.isArray(cls) ? cls[0] : cls;
    return String(v ?? '').trim().replace(/^STD\s*/i, '').trim();
  };
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
  
  // Check if user is Super Admin
  const isSuperAdmin = useMemo(() => {
    return normalizedRoles.some(r => 
      r === 'super admin' || 
      r === 'superadmin' || 
      r === 'super_admin'
    );
  }, [normalizedRoles]);
  
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
    subjectExams: [],
    mode: 'single', // 'single' | 'section'
    section: '', // 'LP' | 'UP' | 'HS'
    classesToCreate: []
  });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  // List of grading schemes loaded from the GradeTypes sheet.  Each entry
  // contains examType and the maximum internal/external marks.  Used to
  // populate the exam type dropdown dynamically and auto-fill mark limits.
  const [gradeTypes, setGradeTypes] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  
  
  // Filter states
  const [filters, setFilters] = useState({
    class: '',
    subject: '',
    examType: '',
    completionStatus: '' // all, pending, partial, complete
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Error handling state
  const [apiError, setApiError] = useState('');

  const [showMarksForm, setShowMarksForm] = useState(false);
  const [marksRows, setMarksRows] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);

  // Global bulk upload state (replacing per-exam bulk upload)
  const [showGlobalBulkUpload, setShowGlobalBulkUpload] = useState(false);
  const [globalBulkFile, setGlobalBulkFile] = useState(null);
  const [globalBulkData, setGlobalBulkData] = useState([]);
  const [globalBulkPreview, setGlobalBulkPreview] = useState([]);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ current: 0, total: 0 });

  const [viewExamMarks, setViewExamMarks] = useState(null);
  const [examMarks, setExamMarks] = useState([]);


  // Marks entry indicator: examId -> { enteredCount, totalStudents, complete, ... }
  const [marksEntryStatus, setMarksEntryStatus] = useState({});
  
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
        console.log('📊 Boundaries count:', boundaries?.length || 0);
        if (boundaries && boundaries.length > 0) {
          console.log('📊 Sample boundary:', boundaries[0]);
          console.log('📊 All standard groups:', [...new Set(boundaries.map(b => b.standardGroup))]);
        }
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
    // Handle absent students
    if (percentage === 'Absent' || percentage === null || percentage === undefined) {
      return 'Absent';
    }

    // Normalize percentage (handle strings like "76%")
    const pct = typeof percentage === 'string' ? parseFloat(percentage) : Number(percentage);
    if (isNaN(pct)) return 'E';

    console.log('🎓 calculateGrade called:', {
      percentage: pct,
      className,
      gradeBoundariesLoaded,
      boundariesCount: gradeBoundaries.length
    });

    if (!gradeBoundariesLoaded || !gradeBoundaries.length) {
      console.log('⚠️ Using fallback grading - boundaries not loaded');
      if (pct >= 80) return 'A';
      if (pct >= 60) return 'B';
      if (pct >= 40) return 'C';
      if (pct >= 30) return 'D';
      return 'E';
    }

    // Determine standard group as canonical range labels: '1-4', '5-8', '9-12'
    const getStandardGroup = (cls) => {
      if (!cls) return '';
      const match = String(cls).match(/(\d+)/);
      if (!match) return '';
      const num = Number(match[1]);
      if (isNaN(num)) return '';
      if (num >= 1 && num <= 4) return '1-4';
      if (num >= 5 && num <= 8) return '5-8';
      if (num >= 9 && num <= 12) return '9-12';
      return '';
    };

    const stdGroup = getStandardGroup(className);
    const normalizeGroup = (g) => String(g || '')
      .toLowerCase()
      .replace(/std\s*/g, '')
      .replace(/\s+/g, '')
      .trim();

    const targetGroup = normalizeGroup(stdGroup);
    console.log('📚 Standard group determined:', { className, stdGroup: targetGroup });

    // Filter boundaries by normalized group label (supports 'Std 9-12' and '9-12')
    const boundaries = gradeBoundaries
      .filter(b => normalizeGroup(b.standardGroup) === targetGroup)
      .sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));

    console.log('🔍 Filtered boundaries:', boundaries);

    for (const boundary of boundaries) {
      const minP = Number(boundary.minPercentage);
      const maxP = Number(boundary.maxPercentage);
      if (!isNaN(minP) && !isNaN(maxP) && pct >= minP && pct <= maxP) {
        console.log('✅ Grade found:', boundary.grade, `(${pct}% in range ${minP}-${maxP}%)`);
        return boundary.grade;
      }
    }

    console.log('⚠️ No matching boundary, using lowest grade');
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
        console.log('📚 Fetching grade types...');
        const types = await api.getGradeTypes();
        console.log('✅ Grade types fetched:', types);
        
        if (!types) {
          console.warn('⚠️  Grade types response is null/undefined');
          setGradeTypes([]);
          return;
        }
        
        if (!Array.isArray(types)) {
          console.warn('⚠️  Grade types is not an array:', types);
          // If it's wrapped in a data object, extract it
          if (types.data && Array.isArray(types.data)) {
            console.log('📦 Extracting grade types from data wrapper');
            setGradeTypes(types.data);
          } else {
            setGradeTypes([]);
          }
          return;
        }
        
        console.log('✅ Setting grade types:', types.length, 'types found');
        setGradeTypes(types);
      } catch (err) {
        console.error('❌ Error fetching grade types:', err);
        setGradeTypes([]);
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

  // Load subjects exclusively from ClassSubjects sheet
  useEffect(() => {
    async function fetchAllSubjects() {
      try {
        setSubjectsLoading(true);

        const isHeadmaster = typeof hasRole === 'function'
          ? hasRole('h m')
          : normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'));
        const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');

        // Determine target class: prefer edit form, bulk form, exam form, class-teacher's class, or filter selection
        const selectedClass = (editExamData?.class || bulkExamFormData.class || examFormData.class || (isClassTeacher ? user?.classTeacherFor : filters.class) || '')
          .toString()
          .trim();

        if (!selectedClass) {
          // No class selected yet; keep subjects empty until class is chosen
          setAvailableSubjects([]);
          return;
        }

        // Always source subjects from ClassSubjects for exams
        const res = await api.getClassSubjects(selectedClass);
        console.log('📋 Raw API response:', res);
        console.log('📋 Response type:', typeof res, Array.isArray(res) ? 'is array' : 'is object');
        let finalSubjects = [];

        const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
        const targetClassNorm = norm(selectedClass);

        // Case 1: { subjects: [...] }
        if (res && Array.isArray(res.subjects)) {
          console.log('📋 Case 1: res.subjects array, count:', res.subjects.length);
          console.log('📋 res.subjects:', res.subjects);
          finalSubjects = res.subjects;
        // Case 2: { data: { subjects: [...] } }
        } else if (Array.isArray(res?.data?.subjects)) {
          console.log('📋 Case 2: res.data.subjects array, count:', res.data.subjects.length);
          finalSubjects = res.data.subjects;
        // Case 3: API returned array directly
        } else if (Array.isArray(res)) {
          if (res.length > 0 && typeof res[0] === 'string') {
            console.log('📋 Case 3a: Array of strings, count:', res.length);
            // Array of subject strings
            finalSubjects = res;
          } else if (typeof res[0] === 'object') {
            console.log('📋 Case 3b: Array of objects, parsing...');
            // Array of rows from ClassSubjects sheet: filter by class and extract subject
            const subjectsSet = new Set();
            res.forEach(row => {
              const rowClass = norm(row.class || row.Class || row.cls || row.standard || '');
              const subj = (row.subject || row.Subject || row.subjects || row.Subjects || row.sub || row.name || '').toString().trim();
              if (rowClass && subj && rowClass === targetClassNorm) {
                subjectsSet.add(subj);
              }
            });
            finalSubjects = Array.from(subjectsSet);
          }
        }

        console.log('📋 Before filter/sort, finalSubjects count:', finalSubjects.length);
        console.log('📋 Before filter/sort, finalSubjects:', finalSubjects);
        const beforeFilter = finalSubjects.length;
        finalSubjects = Array.isArray(finalSubjects) ? finalSubjects.filter(Boolean).sort() : [];
        console.log('📋 After filter/sort, count:', finalSubjects.length);
        if (beforeFilter !== finalSubjects.length) {
          console.warn(`⚠️ Lost ${beforeFilter - finalSubjects.length} subjects during filter!`);
        }
        console.log(`✅ Loaded ${finalSubjects.length} subjects from ClassSubjects for ${selectedClass}`);
        setAvailableSubjects(finalSubjects);
      } catch (error) {
        console.error('❌ Error fetching ClassSubjects:', error);
        setAvailableSubjects([]);
      } finally {
        setSubjectsLoading(false);
      }
    }

    fetchAllSubjects();
  }, [user, hasRole, normalizedRoles, editExamData?.class, bulkExamFormData.class, examFormData.class, filters.class]);

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
        const examPayload = {
          creatorName: user.name || '',
          class: examFormData.class,
          subject: examFormData.subject,
          examType: examFormData.examType,
          hasInternalMarks: examFormData.hasInternalMarks,
          internalMax: examFormData.hasInternalMarks ? Number(examFormData.internalMax) : 0,
          externalMax: Number(examFormData.externalMax),
          totalMax: totalMax,
          date: examFormData.date
        };
        
        console.log('📝 Creating exam with payload:', examPayload);
        console.log('👤 User email:', user.email);
        
        const result = await api.createExam(user.email, examPayload);
        
        console.log('✅ Exam creation result:', result);
        
        if (result && result.error) {
          console.error('❌ Exam creation error:', result.error);
          throw new Error(result.error);
        }
        
        return result;
      });
      
      // Show success message
      success('Exam Created', 'Exam created successfully');
      
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
    } else if (field === 'mode') {
      setBulkExamFormData({ ...bulkExamFormData, mode: value });
    } else if (field === 'section') {
      // Compute classes for selected section
      const computeClassesForSection = (sectionLabel) => {
        const classes = Array.isArray(availableClasses) ? availableClasses.slice() : [];
        const extractNum = (cls) => {
          const m = String(cls || '').match(/(\d+)/);
          return m ? Number(m[1]) : NaN;
        };
        let min = 1, max = 4; // LP default
        if (sectionLabel === 'UP') { min = 5; max = 7; }
        if (sectionLabel === 'HS') { min = 8; max = 10; }
        return classes.filter(c => {
          const n = extractNum(c);
          return !isNaN(n) && n >= min && n <= max;
        });
      };
      const classesToCreate = computeClassesForSection(value);
      // Use the first class to load subjects from ClassSubjects
      const representativeClass = classesToCreate[0] || '';
      setBulkExamFormData({ 
        ...bulkExamFormData, 
        section: value, 
        classesToCreate, 
        class: representativeClass 
      });
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

  // Select all subjects for bulk exam creation
  const selectAllSubjects = () => {
    setSelectedSubjects([...availableSubjects]);
    // Set today's date for all subjects
    const allSubjectExams = availableSubjects.map(subject => ({
      subject,
      date: todayIST()
    }));
    setBulkExamFormData({
      ...bulkExamFormData,
      subjectExams: allSubjectExams
    });
  };

  // Deselect all subjects
  const deselectAllSubjects = () => {
    setSelectedSubjects([]);
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
      if (bulkExamFormData.mode === 'single' && !bulkExamFormData.class) {
        setApiError('Please select a class');
        return;
      }
      if (bulkExamFormData.mode === 'section' && (!Array.isArray(bulkExamFormData.classesToCreate) || bulkExamFormData.classesToCreate.length === 0)) {
        setApiError('No classes found for the selected section');
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
      
      // Submit bulk exams creation for single class or multiple classes (section mode)
      await withSubmit('Creating exams...', async () => {
        const targetClasses = bulkExamFormData.mode === 'section'
          ? bulkExamFormData.classesToCreate
          : [bulkExamFormData.class];

        const results = [];
        for (const cls of targetClasses) {
          const res = await api.createBulkExams(user.email, {
            creatorName: user.name || '',
            class: cls,
            examType: bulkExamFormData.examType,
            hasInternalMarks: bulkExamFormData.hasInternalMarks,
            internalMax: bulkExamFormData.hasInternalMarks ? Number(bulkExamFormData.internalMax) : 0,
            externalMax: Number(bulkExamFormData.externalMax),
            totalMax: totalMax,
            subjectExams
          });
          if (res && res.error) {
            throw new Error(`Class ${cls}: ${res.error}`);
          }
          results.push(res);
        }
        return { ok: true, count: results.length };
      });
      
      // Show success message
      const classCount = bulkExamFormData.mode === 'section' ? (bulkExamFormData.classesToCreate?.length || 0) : 1;
      success('Bulk Exams Created', `Successfully created ${selectedSubjects.length} subjects across ${classCount} class(es)`);
      
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
        subjectExams: [],
        mode: 'single',
        section: '',
        classesToCreate: []
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
      const userRole = isSuperAdmin ? 'superadmin' :
                     isClassTeacher ? 'classteacher' : 
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
      
      console.log('📊 Exams loaded:', list?.length || 0, 'exams for role:', userRole);
      setExams(Array.isArray(list) ? list : []);
      
      // CRITICAL: Clear loading state immediately after exams load
      // Marks status can load in the background without blocking UI
      setIsLoading(false);

      // Load marks-entry progress in background (non-blocking)
      const ids = (Array.isArray(list) ? list : [])
        .map(e => e && e.examId)
        .filter(Boolean);
      
      if (ids.length > 0) {
        // Fire and forget - don't await or block UI
        (async () => {
          try {
            const byId = {};
            const idsParamLen = ids.join(',').length;
            const shouldUseAll = ids.length > 80 || idsParamLen > 1500;
            
            const res = shouldUseAll
              ? await api.getExamMarksEntryStatusAll({
                  teacherEmail: user?.email || '',
                  role: userRole,
                  class: filters.class || '',
                  subject: filters.subject || '',
                  examType: filters.examType || '',
                  _ts: Date.now()
                })
              : await api.getExamMarksEntryStatusBatch(ids, {
                  teacherEmail: user?.email || '',
                  role: userRole
                });

            (res?.exams || []).forEach(row => {
              if (row && row.examId) byId[row.examId] = row;
            });
            setMarksEntryStatus(byId);
          } catch (err) {
            console.warn('Background marks status load failed:', err);
            setMarksEntryStatus({});
          }
        })();
      } else {
        setMarksEntryStatus({});
      }
    } catch (e) {
      console.error('Failed to reload exams', e);
      setApiError('Failed to load exams: ' + (e.message || e));
      setIsLoading(false);
    }
  };

  // WhatsApp share function for pending exams
  const shareToWhatsApp = () => {
    // Get all pending/partial exams
    const pendingExams = filteredExams.filter(exam => {
      const st = marksEntryStatus[exam.examId];
      if (!st) return false;
      const entered = st.enteredCount || 0;
      const total = st.totalStudents || 0;
      return entered < total; // pending or partial
    });

    if (pendingExams.length === 0) {
      warning('No pending exams to share');
      return;
    }

    // Format message
    let message = '📋 *Pending Exam Marks - Reminder*\n\n';
    
    pendingExams.forEach(exam => {
      const st = marksEntryStatus[exam.examId];
      const entered = st?.enteredCount || 0;
      const total = st?.totalStudents || 0;
      const pending = total - entered;
      const icon = entered === 0 ? '🔴' : '🟡';
      const status = entered === 0 ? 'Pending' : 'Partial';
      
      message += `${icon} *${exam.examType}*\n`;
      message += `   ${displayClass(exam.class)} - ${exam.subject}\n`;
      message += `   Status: ${status} (${pending} pending)\n\n`;
    });
    
    message += `Please complete marks entry at your earliest.\n`;
    message += `Total Pending: ${pendingExams.length} exam${pendingExams.length > 1 ? 's' : ''}`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Use a stronger normalization that removes spaces and non-alphanumeric
  // characters so values like "6 A" and "6A" match reliably.
  const normKey = useCallback((s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''), []);

  // Memoize the expensive filtering logic for better performance
  const examsForTeacher = useMemo(() => {
    if (!user || !exams.length) return [];
    
    // Super Admin and HM see ALL exams
    if (isSuperAdmin || normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) {
      return exams;
    }
    
    // Pre-compute normalized user data
    const userClassesNorm = user.classes ? new Set(user.classes.map(c => normKey(c))) : new Set();
    const userSubjectsNorm = user.subjects ? new Set(user.subjects.map(s => normKey(s))) : new Set();
    const userClassTeacherForNorm = user.classTeacherFor ? normKey(user.classTeacherFor) : '';
    
    const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
    
    console.log('📋 ExamManagement Filter Debug:', {
      isClassTeacher,
      userClassTeacherFor: user.classTeacherFor,
      userClassTeacherForNorm,
      userClasses: user.classes,
      userSubjects: user.subjects,
      totalExams: exams.length
    });
    
    return exams.filter(ex => {
      
      const exClass = normKey(ex.class);
      const exSubject = normKey(ex.subject);
      const teachesClass = userClassesNorm.has(exClass);
      const teachesSubject = userSubjectsNorm.has(exSubject);
      
      // If user is a Class Teacher, allow access to:
      // 1. ANY subject from the class they are class teacher for (PRIMARY ACCESS)
      // 2. OR subjects they teach in ANY class they are assigned to teach (SECONDARY ACCESS)
      if (isClassTeacher) {
        // Primary: Access to ALL subjects in the class they are class teacher for
        const isClassTeacherForThisClass = userClassTeacherForNorm && userClassTeacherForNorm === exClass;
        
        if (isClassTeacherForThisClass) {
          console.log('✅ Class Teacher access (Primary):', {
            class: ex.class,
            subject: ex.subject,
            reason: 'Class Teacher for this class - ALL SUBJECTS'
          });
          return true;
        }
        
        // Secondary: Access to subjects they teach in OTHER classes they are assigned to
        const teachesThisSubjectInThisClass = teachesSubject && teachesClass;
        
        if (teachesThisSubjectInThisClass) {
          console.log('✅ Class Teacher access (Secondary):', {
            class: ex.class,
            subject: ex.subject,
            reason: 'Teaches this subject in this class'
          });
          return true; // Changed from returning after if statement
        }
        
        // If neither condition met, deny access
        return false;
      }
      
      // Regular subject teacher: require both class and subject match.
      return teachesClass && teachesSubject;
    });
  }, [exams, user, normalizedRoles, normKey, isSuperAdmin]);

  // Client-side filtering for instant results without API calls
  const filteredExams = useMemo(() => {
    let result = examsForTeacher;
    
    // Apply class filter
    if (filters.class) {
      result = result.filter(ex => normKey(ex.class) === normKey(filters.class));
    }
    
    // Apply subject filter
    if (filters.subject) {
      result = result.filter(ex => normKey(ex.subject) === normKey(filters.subject));
    }
    
    // Apply exam type filter
    if (filters.examType) {
      result = result.filter(ex => normKey(ex.examType) === normKey(filters.examType));
    }
    
    // Apply completion status filter
    if (filters.completionStatus) {
      result = result.filter(ex => {
        const st = marksEntryStatus[ex.examId];
        if (!st) return filters.completionStatus === 'pending'; // No status = pending
        
        const entered = st.enteredCount || 0;
        const total = st.totalStudents || 0;
        
        if (filters.completionStatus === 'pending') {
          return entered === 0;
        } else if (filters.completionStatus === 'partial') {
          return entered > 0 && entered < total;
        } else if (filters.completionStatus === 'complete') {
          return total > 0 && entered >= total;
        }
        return true;
      });
    }
    
    // Sort by creation date descending (newest first)
    result = result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return result;
  }, [examsForTeacher, filters, normKey, marksEntryStatus]);

  // Open marks form for a specific exam with caching optimization
  const openMarksForm = useCallback(async (exam) => {
    setSelectedExam(exam);
    setIsLoading(true);
    setApiError('');
    
    try {
      console.log('🔍 Opening marks form for exam:', exam);
      
      // Check cache first to avoid duplicate API calls
      const _cacheKey = `${exam.class}_${exam.examId}`;
      
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
      success('Exam Updated', 'Exam updated successfully');
      
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
        
        // FIXED: Backend returns 'ce' and 'te' from ExamMarks sheet
        // ce = Continuous Evaluation (Internal)
        // te = Term Exam (External)
        const internal = existingMark.ce || existingMark.internal || '';
        const external = existingMark.te || existingMark.external || '';
        const total = existingMark.total || '';
        
        // Calculate percentage and grade using the new class-specific grading system
        const calculatedPercentage = total && exam.totalMax ? Math.round((total / exam.totalMax) * 100) : 0;
        
        return {
          admNo: student.admNo,
          studentName: student.name,
          internal: internal,
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

  // Helper function to handle marks change
  const handleMarksChange = useCallback((index, field, value) => {
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
  }, [marksRows, selectedExam, calculateGrade]);
  
  // Helper function to calculate total marks
  const calculateTotal = useCallback((row, exam = selectedExam) => {
    // Check if student is absent (marked with 'A' in external marks)
    if (row.external && row.external.toString().toUpperCase() === 'A') {
      return 'Absent';
    }
    
    const external = Number(row.external) || 0;
    if (examHasInternalMarks(exam)) {
      const internal = Number(row.internal) || 0;
      return internal + external;
    }
    return external;
  }, [selectedExam]);
  
  // Helper function to calculate percentage
  const calculatePercentage = useCallback((row, maxMarks, exam = selectedExam) => {
    if (!maxMarks) return '';
    const total = calculateTotal(row, exam);
    
    // Return 'Absent' if student was absent
    if (total === 'Absent') return 'Absent';
    
    return Math.round((total / maxMarks) * 100);
  }, [calculateTotal, selectedExam]);

  // Submit marks to the backend
  const handleSubmitMarks = useCallback(async () => {
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
      
      // Debug logging
      console.log('=== SUBMITTING MARKS ===');
      console.log('Selected Exam:', selectedExam);
      console.log('Exam ID:', selectedExam?.examId);
      console.log('Marks Count:', marks.length);
      console.log('Sample Mark:', marks[0]);
      
      // Submit to API
      const result = await api.submitExamMarks({
        examId: selectedExam.examId,
        class: selectedExam.class,
        subject: selectedExam.subject,
        teacherEmail: user.email,
        teacherName: user.name || user.email,
        marks
      });
      
      console.log('Backend Response:', result);
      console.log('Response details:', {
        hasOk: result?.ok,
        hasSubmitted: result?.submitted,
        hasError: result?.error,
        fullResponse: JSON.stringify(result)
      });
      
      // Support both response formats for compatibility
      if (result && (result.ok || result.submitted)) {
        success('Marks Saved', 'Marks saved successfully');
        setShowMarksForm(false);
      } else {
        const errorMsg = result?.error || 'Failed to save marks';
        console.error('❌ SAVE FAILED:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('Error submitting marks:', err);
      setApiError(`Failed to save marks: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedExam, user, marksRows, setIsLoading, setApiError, setShowMarksForm]);

  // Global Bulk Upload Functions (Optimized)
  const validateGlobalBulkCSV = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csv = e.target.result;
          const lines = csv.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            reject(new Error('CSV file must have at least a header row and one data row'));
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          // Required columns for global bulk upload
          const requiredColumns = ['examid', 'admno', 'studentname'];
          const missingRequired = requiredColumns.filter(col => 
            !headers.some(h => h.includes(col))
          );
          
          if (missingRequired.length > 0) {
            reject(new Error(`Missing required columns: ${missingRequired.join(', ')}`));
            return;
          }

          // Parse data rows (limit to 1000 for performance)
          const data = [];
          for (let i = 1; i < Math.min(lines.length, 1001); i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) continue;
            
            const row = {};
            headers.forEach((header, index) => {
              const cleanHeader = header.replace(/[^a-z0-9]/g, '');
              row[cleanHeader] = values[index];
            });
            
            // Validate required data
            if (row.examid && row.admno && row.studentname) {
              // Use the full readable examId as the actual exam ID (no UUID extraction)
              let examId = row.examid.trim();
              
              // Remove any UUID part if present (e.g., "TermTest1_Std5A_Math (uuid)" becomes "TermTest1_Std5A_Math")
              const uuidMatch = examId.match(/^(.+?)\s*\([a-f0-9-]{36}\)$/i);
              if (uuidMatch) {
                examId = uuidMatch[1].trim(); // Use the human-readable part only
              }
              
              // Add processed row with meaningful examId
              data.push({
                ...row,
                examId: examId, // Use meaningful name as exam ID
                admNo: row.admno || '',
                studentName: row.studentname || '',
                internal: row.internal || '',
                external: row.external || ''
              });
            }
          }

          if (data.length === 0) {
            reject(new Error('No valid data rows found'));
            return;
          }

          resolve(data);
        } catch (error) {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const handleGlobalBulkFileChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setGlobalBulkFile(file);
    setGlobalBulkData([]);
    setGlobalBulkPreview([]);
    setApiError('');

    try {
      setIsLoading(true);
      const data = await validateGlobalBulkCSV(file);
      setGlobalBulkData(data);
      
      // Create preview with calculated totals and grades
      const preview = data.slice(0, 5).map(row => {
        const internal = parseFloat(row.internal || row.ce || 0);
        const external = parseFloat(row.external || row.te || 0);
        const total = internal + external;
        
        // Find exam to get class for grading
        const exam = exams.find(e => e.examId === row.examid);
        const percentage = exam && exam.totalMax ? (total / exam.totalMax) * 100 : 0;
        const grade = exam ? calculateGrade(percentage, exam.class) : 'N/A';

        return {
          ...row,
          calculatedInternal: internal,
          calculatedExternal: external,
          calculatedTotal: total,
          calculatedPercentage: Math.round(percentage),
          calculatedGrade: grade,
          examFound: !!exam
        };
      });
      
      setGlobalBulkPreview(preview);
      setApiError(`✅ File validated successfully! ${data.length} records ready for upload.`);
    } catch (error) {
      setApiError(`❌ ${error.message}`);
      setGlobalBulkFile(null);
    } finally {
      setIsLoading(false);
    }
  }, [exams, calculateGrade, validateGlobalBulkCSV]);

  const handleGlobalBulkUpload = useCallback(async () => {
    if (!globalBulkData.length || !user) return;

    try {
      setIsLoading(true);
      setBulkUploadProgress({ current: 0, total: globalBulkData.length });
      
      // Group data by examId for efficient processing
      const examGroups = {};
      globalBulkData.forEach(row => {
        if (!examGroups[row.examid]) {
          examGroups[row.examid] = [];
        }
        examGroups[row.examid].push(row);
      });

      let totalProcessed = 0;
      let totalErrors = 0;
      const errorDetails = [];

      // Process each exam group
      for (const [examId, marks] of Object.entries(examGroups)) {
        let exam = exams.find(e => e.examId === examId);
        
        // Check if examId is UUID format and show warning
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId);
        if (isUUID) {
          totalErrors += marks.length;
          errorDetails.push(`❌ Exam ID "${examId}" is in UUID format. Please use readable format like "T1_10A_ENG", "T2_9B_MATH", etc.`);
          continue;
        }
        
        // If exam doesn't exist, create it automatically from the examId
        if (!exam) {
          console.log(`Creating new exam with ID: ${examId}`);
          
          // Parse examId to extract exam details (format: "TermTest1_Std5A_Math")
          const parts = examId.split('_');
          let examType = parts[0] || 'General Exam';
          let className = '';
          let subject = '';
          
          if (parts.length >= 3) {
            className = parts[1] || '';
            subject = parts.slice(2).join('_') || '';
          } else if (parts.length === 2) {
            // Could be "TermTest1_Math" or "Std5A_Math"
            if (parts[1].match(/^std\d+/i)) {
              className = parts[1];
              subject = examType; // Fallback
              examType = 'General Exam';
            } else {
              subject = parts[1];
            }
          }
          
          // Create exam with meaningful ID
          try {
            // Determine standard number from class string (e.g., "10A" -> 10)
            const stdMatch = String(className || '').match(/(\d+)/);
            const stdNum = stdMatch ? parseInt(stdMatch[1], 10) : NaN;
            const internalEnabled = !isNaN(stdNum) && stdNum >= 8 && stdNum <= 10;

            const examData = {
              examId: examId, // Use the meaningful ID directly
              class: className,
              subject: subject,
              examType: examType,
              hasInternalMarks: internalEnabled,
              internalMax: internalEnabled ? 20 : 0,
              externalMax: internalEnabled ? 80 : 80,
              totalMax: internalEnabled ? 100 : 80,
              date: new Date().toISOString().slice(0, 10)
            };
            
            const createResult = await api.createExamWithId(user.email, examData);
            
            if (createResult && createResult.examId) {
              // Fetch the newly created exam
              await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for backend
              const updatedExams = await api.getAllExams();
              exam = updatedExams.find(e => e.examId === examId);
              
              if (exam) {
                // Update local exams state
                setExams(updatedExams);
                console.log(`✅ Created exam: ${examId}`);
              }
            }
          } catch (createError) {
            console.error(`Failed to create exam ${examId}:`, createError);
            totalErrors += marks.length;
            errorDetails.push(`Failed to create exam ${examId}: ${createError.message}`);
            continue;
          }
        }
        
        if (!exam) {
          console.warn(`Exam still not found after creation attempt: ${examId}`);
          totalErrors += marks.length;
          errorDetails.push(`Exam ${examId} not found and could not be created`);
          continue;
        }

        const marksData = marks.map(row => ({
          admNo: row.admno,
          studentName: row.studentname,
          internal: parseFloat(row.internal || row.ce || 0),
          external: parseFloat(row.external || row.te || 0)
        }));

        try {
          const result = await api.submitExamMarks({
            examId: examId,
            class: exam.class,
            subject: exam.subject,
            teacherEmail: user.email,
            teacherName: user.name || user.email,
            marks: marksData
          });

          if (result && (result.ok || result.submitted)) {
            totalProcessed += marks.length;
          } else {
            totalErrors += marks.length;
            errorDetails.push(`Failed to upload marks for exam ${examId}`);
          }
        } catch (error) {
          totalErrors += marks.length;
          errorDetails.push(`Error uploading exam ${examId}: ${error.message}`);
        }

        setBulkUploadProgress(prev => ({ ...prev, current: prev.current + marks.length }));
      }

      // Show results
      if (totalErrors === 0) {
        success('Bulk Upload Complete', `🎉 Bulk upload completed successfully! ${totalProcessed} records uploaded.`);
      } else {
        warning('Upload Issues', `⚠️ Bulk upload completed with issues. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
        console.warn('Bulk upload errors:', errorDetails);
      }

      // Reset state
      setShowGlobalBulkUpload(false);
      setGlobalBulkFile(null);
      setGlobalBulkData([]);
      setGlobalBulkPreview([]);
      setBulkUploadProgress({ current: 0, total: 0 });
      
      // Clear caches to show updated data
      setStudentsCache(new Map());
      setMarksCache(new Map());

    } catch (error) {
      setApiError(`❌ Bulk upload failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [globalBulkData, exams, user, calculateGrade, setStudentsCache, setMarksCache]);

  const generateSampleCSV = useCallback(() => {
    const headers = ['examId', 'admNo', 'studentName', 'internal', 'external'];
    
    // Create human-readable exam identifiers that will be used as actual exam IDs
    const getReadableExamId = (exam) => {
      return `${exam.examType}_${exam.class}_${exam.subject}`.replace(/\s+/g, '_');
    };
    
    let sampleData = [];
    
    if (exams && exams.length > 0) {
      // Use real exam data to create sample
      const sampleExams = exams.slice(0, 3); // Take first 3 exams as example
      
      sampleExams.forEach((exam, index) => {
        const readableId = getReadableExamId(exam);
        // Add sample students for each exam (using readable ID as actual exam ID)
        sampleData.push([readableId, '1001', 'John Doe', exam.hasInternalMarks ? '18' : '0', '72']);
        sampleData.push([readableId, '1002', 'Jane Smith', exam.hasInternalMarks ? '19' : '0', '68']);
        if (index === 0) { // Add extra student for first exam
          sampleData.push([readableId, '1003', 'Mike Johnson', exam.hasInternalMarks ? '20' : '0', '75']);
        }
      });
    } else {
      // Fallback sample data with non-STD class IDs
      sampleData = [
        ['TermTest1_5A_Math', '1001', 'John Doe', '18', '72'],
        ['TermTest1_5A_Math', '1002', 'Jane Smith', '19', '68'], 
        ['TermTest1_5A_Science', '1001', 'John Doe', '0', '85'],
        ['TermTest1_5A_Science', '1002', 'Jane Smith', '0', '78'],
        ['Quarterly_6B_English', '1003', 'Mike Johnson', '20', '75']
      ];
    }
    
    const csvContent = [headers, ...sampleData]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'exam_marks_bulk_upload_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [exams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {user && (normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) && (
            <>
              <button
                onClick={() => setShowExamForm(true)}
                className="flex-1 sm:flex-initial bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create Exam</span>
                <span className="sm:hidden">Create</span>
              </button>
              <button
                onClick={() => setShowBulkExamForm(true)}
                className="flex-1 sm:flex-initial bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create Bulk Exams</span>
                <span className="sm:hidden">Bulk</span>
              </button>
            </>
          )}
          {user && (normalizedRoles.some(r => r.includes('teacher'))) && (
            <button
              onClick={() => {
                // If there are no exams matching this teacher's classes/subjects, show feedback
                if (!examsForTeacher || examsForTeacher.length === 0) {
                  setApiError('No exams available for your classes or subjects to enter marks. Please ask your Headmaster to create exams.');
                  return;
                }
                // Teacher selects exam to enter marks; if only one exam, open directly, else pick the first
                if (examsForTeacher.length >= 1) {
                  openMarksForm(examsForTeacher[0]);
                }
              }}
              disabled={!examsForTeacher || examsForTeacher.length === 0}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg flex items-center justify-center ${(!examsForTeacher || examsForTeacher.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
              title={(!examsForTeacher || examsForTeacher.length === 0) ? 'No exams available - please ask your Headmaster to create exams' : 'Enter marks for your exams'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Enter Marks
            </button>
          )}

        </div>
      </div>

      {/* Global Bulk Upload Section */}
      {normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster')) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-blue-600" />
              Global Bulk Upload Marks
            </h2>
            <button
              onClick={() => setShowGlobalBulkUpload(!showGlobalBulkUpload)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm"
            >
              {showGlobalBulkUpload ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Upload Marks
                </>
              )}
            </button>
          </div>

          {showGlobalBulkUpload && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">How to use Global Bulk Upload:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Upload a single CSV file containing marks for multiple exams</li>
                  <li>CSV format: examId, admNo, studentName, internal, external</li>
                  <li><strong>Use readable exam IDs:</strong> T1_10A_ENG, T2_9B_MATH, UT1_8A_SCI, etc.</li>
                  <li><strong>Format:</strong> ExamType_Class_Subject (e.g., T1_10A_ENG)</li>
                  <li>❌ Do NOT use UUID format (long random strings)</li>
                  <li>Leave internal or external empty if not applicable</li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleGlobalBulkFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={generateSampleCSV}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm flex items-center"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Sample CSV
                </button>
                <button
                  onClick={handleGlobalBulkUpload}
                  disabled={!globalBulkFile || globalBulkData.length === 0}
                  className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center ${
                    globalBulkFile && globalBulkData.length > 0
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload All Marks
                </button>
              </div>

              {/* Progress Indicator */}
              {bulkUploadProgress.total > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      Uploading Marks Progress
                    </span>
                    <span className="text-sm text-blue-700">
                      {bulkUploadProgress.current} / {bulkUploadProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(bulkUploadProgress.current / bulkUploadProgress.total) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Processing marks upload... Please wait.
                  </p>
                </div>
              )}

              {globalBulkData.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Preview ({globalBulkData.length} rows):</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 px-2">Exam Type</th>
                          <th className="text-left py-1 px-2">Adm No</th>
                          <th className="text-left py-1 px-2">Student</th>
                          <th className="text-left py-1 px-2">Internal</th>
                          <th className="text-left py-1 px-2">External</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalBulkData.slice(0, 5).map((row, index) => (
                          <tr key={`global-bulk-${index}-${row.admNo || index}`} className="border-b">
                            <td className="py-1 px-2">{row.examId}</td>
                            <td className="py-1 px-2">{row.admNo}</td>
                            <td className="py-1 px-2">{row.studentName}</td>
                            <td className="py-1 px-2">{row.internal || '-'}</td>
                            <td className="py-1 px-2">{row.external || '-'}</td>
                          </tr>
                        ))}
                        {globalBulkData.length > 5 && (
                          <tr key="global-bulk-more-rows">
                            <td colSpan="5" className="py-1 px-2 text-gray-500 italic">
                              ... and {globalBulkData.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                    <option key={cls} value={cls}>{displayClass(cls)}</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="bulkMode" checked={bulkExamFormData.mode === 'single'} onChange={() => handleBulkExamFormChange('mode', 'single')} />
                    Single Class
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="bulkMode" checked={bulkExamFormData.mode === 'section'} onChange={() => handleBulkExamFormChange('mode', 'section')} />
                    Section (LP/UP/HS)
                  </label>
                </div>
              </div>
              <div>
                {bulkExamFormData.mode === 'single' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select
                      value={bulkExamFormData.class}
                      onChange={(e) => handleBulkExamFormChange('class', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Class</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>{displayClass(cls)}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <select
                      value={bulkExamFormData.section}
                      onChange={(e) => handleBulkExamFormChange('section', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Section</option>
                      <option value="LP">LP (Std 1-4)</option>
                      <option value="UP">UP (Std 5-7)</option>
                      <option value="HS">HS (Std 8-10)</option>
                    </select>
                    <div className="mt-2 text-xs text-gray-600">Classes: {bulkExamFormData.classesToCreate.join(', ') || '—'}</div>
                  </>
                )}
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Select Subjects & Set Exam Dates</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllSubjects}
                    className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                    disabled={availableSubjects.length === 0}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllSubjects}
                    className="text-xs px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                    disabled={selectedSubjects.length === 0}
                  >
                    Deselect All
                  </button>
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              {/* WhatsApp Share Button for HM/Super Admin */}
              {(isSuperAdmin || normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) && (
                <button
                  onClick={shareToWhatsApp}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  title="Share pending exams list via WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                  Share Pending
                </button>
              )}
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
          </div>
          
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-full md:min-w-[180px]">
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
                      {displayClass(user.classTeacherFor)} (My Class)
                    </option>
                  )}
                  {availableClasses
                    .filter(cls => cls !== user?.classTeacherFor) // Remove duplicates
                    .map(cls => (
                      <option key={cls} value={cls}>{displayClass(cls)}</option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="flex-1 min-w-full md:min-w-[180px]">
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
            
            <div className="flex-1 min-w-full md:min-w-[180px]">
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
            
            {/* Completion Status Filter - HM and Super Admin only */}
            {(isSuperAdmin || normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster'))) && (
              <div className="flex-1 min-w-full md:min-w-[180px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Completion Status</label>
                <div className="relative">
                  <select
                    value={filters.completionStatus}
                    onChange={(e) => setFilters({...filters, completionStatus: e.target.value})}
                    className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">🔴 Pending</option>
                    <option value="partial">🟡 Partial</option>
                    <option value="complete">🟢 Complete</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 w-full md:w-auto md:items-end">
              <button
                onClick={() => setFilters({class: '', subject: '', examType: '', completionStatus: ''})}
                className="flex-1 md:flex-initial px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4" /> Clear Filters
              </button>
              <button
                onClick={() => reloadExams()}
                className="flex-1 md:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4" /> Refresh Data
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
        ) : filteredExams && filteredExams.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Marks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marks Entered</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExams.map((exam) => {
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
                        {exam.examType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{displayClass(exam.class)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{exam.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {exam.date && exam.date !== '1950-01-01' && exam.date !== '1999-12-31' ? 
                          formatShortDate(parseApiDate(exam.date)) : 
                          formatShortDate(new Date())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{exam.totalMax}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const st = marksEntryStatus[exam.examId];
                          if (!st) return <span className="text-xs text-gray-400">—</span>;
                          const entered = st.enteredCount ?? 0;
                          const total = st.totalStudents ?? 0;
                          const label = `${entered}/${total}`;
                          
                          let bgColor, textColor, statusText;
                          if (entered === 0) {
                            // Pending - Red
                            bgColor = "bg-red-100";
                            textColor = "text-red-800";
                            statusText = "Pending";
                          } else if (entered < total) {
                            // Partial - Yellow
                            bgColor = "bg-yellow-100";
                            textColor = "text-yellow-800";
                            statusText = "Partial";
                          } else {
                            // Complete - Green
                            bgColor = "bg-green-100";
                            textColor = "text-green-800";
                            statusText = "Complete";
                          }
                          
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}>
                                {label}
                              </span>
                              <span className={`text-xs ${textColor}`}>{statusText}</span>
                            </div>
                          );
                        })()}
                      </td>
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
          
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredExams.map((exam) => {
              const isClassTeacher = normalizedRoles.some(r => r.includes('class teacher') || r === 'classteacher');
              const isClassTeacherForThisClass = user.classTeacherFor && normKey(user.classTeacherFor) === normKey(exam.class);
              const teachesSubject = user.subjects && new Set(user.subjects.map(s => normKey(s))).has(normKey(exam.subject));
              
              let accessBadge = null;
              
              if (isClassTeacher && isClassTeacherForThisClass) {
                accessBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Class Teacher
                  </span>
                );
              } else if (teachesSubject) {
                accessBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Subject Teacher
                  </span>
                );
              }
              
              return (
                <div key={exam.examId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">{exam.examName || `${exam.examType} - ${displayClass(exam.class)} - ${exam.subject}`}</h3>
                      {accessBadge && <div className="mt-1">{accessBadge}</div>}
                      {(() => {
                        const st = marksEntryStatus[exam.examId];
                        if (!st) return null;
                        const ok = !!st.complete;
                        return (
                          <div className="mt-2">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " +
                                (ok ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")
                              }
                              title={ok ? "All students marked" : `${st.missingCount ?? 0} missing`}
                            >
                              Marks: {st.enteredCount ?? 0}/{st.totalStudents ?? 0}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-500 block">Class</span>
                      <span className="font-medium text-gray-900">{displayClass(exam.class)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Subject</span>
                      <span className="font-medium text-gray-900">{exam.subject}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Date</span>
                      <span className="font-medium text-gray-900">
                        {exam.date && exam.date !== '1950-01-01' && exam.date !== '1999-12-31' ? 
                          formatShortDate(parseApiDate(exam.date)) : 
                          formatShortDate(new Date())}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Max Marks</span>
                      <span className="font-medium text-gray-900">{exam.totalMax}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                    <button 
                      onClick={() => viewMarks(exam)}
                      className="flex-1 min-w-[120px] bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      View Marks
                    </button>
                    <button 
                      onClick={() => openMarksForm(exam)}
                      className="flex-1 min-w-[120px] bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      Edit Marks
                    </button>
                    {normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster')) && (
                      <button 
                        onClick={() => openEditExamForm(exam)}
                        className="flex-1 min-w-[120px] bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
                      >
                        Edit Exam
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
        ) : (
          <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-lg">
            <div className="flex justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-16 h-16 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-gray-700 mb-2">No Exams Available</p>
            {normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('headmaster')) ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Get started by creating your first exam</p>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={() => setShowExamForm(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exam
                  </button>
                  <button
                    onClick={() => setShowBulkExamForm(true)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 inline-flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Multiple Exams
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-w-md mx-auto">
                <p className="text-sm text-gray-600">No exams have been created for your classes or subjects yet.</p>
                <p className="text-xs text-gray-500 mt-2">
                  Please contact your Headmaster to create exams. Once exams are created, you'll be able to enter marks here.
                </p>
                {filters.class || filters.subject || filters.examType ? (
                  <p className="text-xs text-blue-600 mt-3">
                    💡 Tip: Try clearing the filters above to see if there are exams in other classes/subjects.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Marks Entry Form */}
      {showMarksForm && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto relative">
            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-xl">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">Saving marks...</p>
                </div>
              </div>
            )}
            
            <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
              <span>Enter Marks: {selectedExam.examName || `${selectedExam.examType} - ${displayClass(selectedExam.class)} - ${selectedExam.subject}`}</span>
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
                      <tr key={`marks-${index}-${row.admNo || 'unknown-' + index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.admNo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{row.studentName}</td>
                        {/* Only show internal marks input if exam has internal marks */}
                        {examHasInternalMarks(selectedExam) && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.internal} 
                              onChange={(e) => handleMarksChange(index, 'internal', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center"
                              placeholder={`0-${selectedExam.internalMax || 0}`}
                              title="Enter marks or leave blank if not applicable"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap">
                          <input 
                            type="text" 
                            value={row.external} 
                            onChange={(e) => handleMarksChange(index, 'external', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center"
                            placeholder={`0-${selectedExam.externalMax || 0} or A`}
                            title={`Enter marks (0-${selectedExam.externalMax || 0}) or 'A' for Absent`}
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
                      <option key={cls} value={cls}>{displayClass(cls)}</option>
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
                      <tr key={`exam-marks-${index}-${row.admNo || 'unknown-' + index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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


    </div>
  );
};

export default React.memo(ExamManagement);