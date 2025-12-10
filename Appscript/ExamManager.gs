/**
 * ====== EXAM MANAGEMENT SYSTEM ======
 * This file handles all exam-related functions
 * Think of this as your "Exam Department"
 */

/**
 * Create a new exam
 */
function createExam(data) {
  try {
    appLog('INFO', 'createExam', { data: data });
    
    const creatorEmail = (data.email||'').toLowerCase().trim();
    const examClass = data.class || '';
    const examSubject = data.subject || '';
    
    if (!creatorEmail) {
      appLog('ERROR', 'createExam', 'Creator email is required');
      return { error: 'Creator email is required' };
    }
    
    // Check if user has permission to create exams
    if (!userCanCreateExam(creatorEmail, examClass, examSubject)) {
      appLog('ERROR', 'createExam', 'Permission denied for ' + creatorEmail);
      return { error: 'You do not have permission to create an exam for this class and subject' };
    }
    
    const sh = _getSheet('Exams');
    _ensureHeaders(sh, SHEETS.Exams);
    const now = new Date().toISOString();
    
    const examId = _generateUniqueExamId(data.examType, data.class, data.subject);
    appLog('INFO', 'createExam', 'Generated exam ID: ' + examId);
    
    // Get creator details
    const userSh = _getSheet('Users');
    const userHeaders = _headers(userSh);
    const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));
    const creator = users.find(u => String(u.email||'').toLowerCase() === creatorEmail);
    const creatorName = creator ? creator.name : creatorEmail;
    
    // Calculate totals
    const internalMax = parseInt(data.internalMax) || 0;
    const externalMax = parseInt(data.externalMax) || 0;
    const totalMax = internalMax + externalMax;
    
    const examName = `${data.examType} - ${data.class} - ${data.subject}`;
    
    // Handle hasInternalMarks - accept both boolean and string
    const hasInternal = (
      data.hasInternalMarks === true || 
      data.hasInternalMarks === 'true' || 
      data.hasInternalMarks === 'TRUE'
    ) ? 'TRUE' : 'FALSE';
    
    const examData = [
      examId,
      creatorEmail,
      creatorName,
      data.class || '',
      data.subject || '',
      data.examType || '',
      hasInternal,
      internalMax,
      externalMax,
      totalMax,
      data.date || '',
      now,
      examName
    ];
    
    appLog('INFO', 'createExam', 'Appending row to Exams sheet');
    sh.appendRow(examData);
    appLog('INFO', 'createExam', 'Exam created successfully: ' + examId);
    
    // Audit log: Exam creation
    logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entityType: AUDIT_ENTITIES.EXAM,
      entityId: examId,
      userEmail: creatorEmail,
      userName: creatorName,
      userRole: 'Teacher/HM',
      afterData: {
        examId: examId,
        class: data.class,
        subject: data.subject,
        examType: data.examType,
        totalMax: totalMax
      },
      description: `Exam created: ${examName}`,
      severity: AUDIT_SEVERITY.INFO
    });
    
    return { submitted: true, examId };
  } catch (err) {
    appLog('ERROR', 'createExam', 'Exception: ' + err.message);
    return { error: 'Failed to create exam: ' + err.message };
  }
}

/**
 * Create multiple exams at once for different subjects
 */
function createBulkExams(data) {
  try {
    appLog('INFO', 'createBulkExams', { data: data });
    
    const creatorEmail = (data.email || '').toLowerCase().trim();
    const examClass = data.class || '';
    const subjectExams = data.subjectExams || [];
    
    if (!creatorEmail) {
      return { error: 'Creator email is required' };
    }
    
    if (!Array.isArray(subjectExams) || subjectExams.length === 0) {
      return { error: 'No subjects provided for bulk exam creation' };
    }
    
    const results = [];
    const errors = [];
    
    // Create an exam for each subject
    for (const subjectExam of subjectExams) {
      const examData = {
        email: creatorEmail,
        creatorName: data.creatorName || '',
        class: examClass,
        subject: subjectExam.subject || '',
        examType: data.examType || '',
        hasInternalMarks: data.hasInternalMarks,
        internalMax: data.internalMax || 0,
        externalMax: data.externalMax || 0,
        totalMax: data.totalMax || 0,
        date: subjectExam.date || data.date || ''
      };
      
      // Create individual exam
      const result = createExam(examData);
      
      if (result.error) {
        errors.push({ subject: subjectExam.subject, error: result.error });
      } else {
        results.push({ subject: subjectExam.subject, examId: result.examId });
      }
    }
    
    appLog('INFO', 'createBulkExams', {
      totalRequested: subjectExams.length,
      successful: results.length,
      failed: errors.length
    });
    
    if (errors.length > 0 && results.length === 0) {
      // All failed
      return { error: 'All exams failed to create', details: errors };
    }
    
    return {
      submitted: true,
      created: results.length,
      failed: errors.length,
      results: results,
      errors: errors
    };
    
  } catch (err) {
    appLog('ERROR', 'createBulkExams', 'Exception: ' + err.message);
    return { error: 'Failed to create bulk exams: ' + err.message };
  }
}

/**
 * Get all exams (with optional filtering)
 */
function getExams(params) {
  const sh = _getSheet('Exams');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  
  let filtered = list;
  
  // Filter by class if provided
  if (params.class) {
    filtered = filtered.filter(exam => exam.class === params.class);
  }
  
  // Filter by subject if provided
  if (params.subject) {
    filtered = filtered.filter(exam => exam.subject === params.subject);
  }
  
  // Filter by exam type if provided
  if (params.examType) {
    filtered = filtered.filter(exam => exam.examType === params.examType);
  }
  
  return filtered;
}

/**
 * Submit exam marks for students
 */
function submitExamMarks(data) {
  const examId = data.examId || '';
  const marks = Array.isArray(data.marks) ? data.marks : [];
  
  if (!examId) return { error: 'Missing examId' };
  if (marks.length === 0) return { error: 'No marks data provided' };
  
  // Get exam details
  const examSh = _getSheet('Exams');
  const examHeaders = _headers(examSh);
  const exams = _rows(examSh).map(r => _indexByHeader(r, examHeaders));
  const exam = exams.find(e => e.examId === examId);
  
  if (!exam) return { error: 'Exam not found' };
  
  const marksSh = _getSheet('ExamMarks');
  _ensureHeaders(marksSh, SHEETS.ExamMarks);
  const now = new Date().toISOString();
  
  // Process each student's marks
  for (const studentMark of marks) {
    // Accept both ce/te (old) and internal/external (new) field names
    const ce = parseInt(studentMark.ce || studentMark.internal) || 0;
    const te = parseInt(studentMark.te || studentMark.external) || 0;
    const total = ce + te;
    const percentage = (total / exam.totalMax) * 100;
    const grade = _calculateGradeFromBoundaries(percentage, exam.class);
    
    Logger.log(`[Marks Submission] Student: ${studentMark.studentName}, CE: ${ce}, TE: ${te}, Total: ${total}/${exam.totalMax}, Percentage: ${percentage.toFixed(2)}%, Grade: ${grade}`);
    
    const markData = [
      examId,
      exam.class,
      exam.subject,
      data.teacherEmail || '',
      data.teacherName || '',
      studentMark.admNo || '',
      studentMark.studentName || '',
      exam.examType,
      ce,
      te,
      total,
      grade,
      now
    ];
    
    marksSh.appendRow(markData);
  }
  
  // Audit log: Exam marks submission
  logAudit({
    action: AUDIT_ACTIONS.SUBMIT,
    entityType: AUDIT_ENTITIES.EXAM_MARKS,
    entityId: examId,
    userEmail: data.teacherEmail || '',
    userName: data.teacherName || '',
    userRole: 'Teacher',
    afterData: {
      examId: examId,
      studentsCount: marks.length,
      class: exam.class,
      subject: exam.subject
    },
    description: `Exam marks submitted for ${marks.length} students in ${exam.class} ${exam.subject}`,
    severity: AUDIT_SEVERITY.INFO
  });
  
  return { ok: true };
}

/**
 * Get exam marks for a specific exam
 */
function getExamMarks(examId) {
  const sh = _getSheet('ExamMarks');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  
  return list.filter(mark => mark.examId === examId);
}

/**
 * Generate a unique exam ID
 */
function _generateUniqueExamId(examType, className, subject) {
  const base = _generateExamId(examType, className, subject);
  const sh = _getSheet('Exams');
  const headers = _headers(sh);
  const existing = _rows(sh).map(r => _indexByHeader(r, headers));
  
  // Check if base ID already exists
  if (!existing.find(e => e.examId === base)) {
    return base;
  }
  
  // If it exists, add a number suffix
  let counter = 1;
  let newId = `${base}_${counter}`;
  
  while (existing.find(e => e.examId === newId)) {
    counter++;
    newId = `${base}_${counter}`;
  }
  
  return newId;
}

/**
 * Generate basic exam ID from components
 */
function _generateExamId(examType, className, subject) {
  const cleanExamType = String(examType || 'EXAM').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const cleanClass = String(className || 'CLASS').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const cleanSubject = String(subject || 'SUBJECT').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  
  return `${cleanExamType}_${cleanClass}_${cleanSubject}`;
}

/**
 * Calculate grade from percentage using grade boundaries
 */
function _calculateGradeFromBoundaries(percentage, className) {
  try {
    const standardGroup = _standardGroup(className);
    
    Logger.log(`[Grade Calculation] Class: ${className}, Standard Group: ${standardGroup}, Percentage: ${percentage}`);
    
    const gbSh = _getSheet('GradeBoundaries');
    _ensureHeaders(gbSh, SHEETS.GradeBoundaries);
    const gbHeaders = _headers(gbSh);
    const boundaries = _rows(gbSh).map(r => _indexByHeader(r, gbHeaders));
    
    // Find boundaries for this standard group - normalize comparison
    const applicableBoundaries = boundaries.filter(b => {
      const boundaryGroup = String(b.standardGroup || '').trim().toLowerCase();
      const targetGroup = standardGroup.trim().toLowerCase();
      return boundaryGroup === targetGroup;
    });
    
    Logger.log(`[Grade Calculation] Found ${applicableBoundaries.length} boundaries for ${standardGroup}`);
    
    if (applicableBoundaries.length === 0) {
      Logger.log(`[Grade Calculation] No boundaries found, using fallback`);
      return _calculateGradeFallback(percentage);
    }
    
    // Sort by minPercentage descending to check from highest grade first
    applicableBoundaries.sort((a, b) => (Number(b.minPercentage) || 0) - (Number(a.minPercentage) || 0));
    
    for (const boundary of applicableBoundaries) {
      const minPercent = Number(boundary.minPercentage) || 0;
      const maxPercent = Number(boundary.maxPercentage) || 100;
      
      if (percentage >= minPercent && percentage <= maxPercent) {
        Logger.log(`[Grade Calculation] Matched: ${boundary.grade} (${minPercent}%-${maxPercent}%)`);
        return boundary.grade || 'F';
      }
    }
    
    Logger.log(`[Grade Calculation] No matching boundary, returning F`);
    return 'F';
    
  } catch (error) {
    Logger.log(`[Grade Calculation ERROR] ${error.toString()}`);
    return _calculateGradeFallback(percentage);
  }
}

/**
 * Fallback grade calculation when boundaries are not available
 */
function _calculateGradeFallback(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 35) return 'D';
  return 'F';
}

/**
 * Determine standard group for grade boundaries
 */
function _standardGroup(cls) {
  const cleanClass = String(cls || '').replace(/[^0-9]/g, '');
  const classNum = parseInt(cleanClass) || 0;
  
  if (classNum >= 1 && classNum <= 4) {
    return 'Std 1-4';
  } else if (classNum >= 5 && classNum <= 8) {
    return 'Std 5-8';
  } else if (classNum >= 9 && classNum <= 12) {
    return 'Std 9-12';  // Combined group for classes 9-12
  }
  
  return 'Default';
}

/**
 * Check if a class has internal marks
 */
function _classHasInternalMarks(cls) {
  const standardGroup = _standardGroup(cls);
  return ['Std 9-12'].includes(standardGroup);  // Use combined group
}

/**
 * Get grade types (exam configurations)
 */
function getGradeTypes() {
  const sh = _getSheet('GradeTypes');
  _ensureHeaders(sh, SHEETS.GradeTypes);
  const headers = _headers(sh);
  return _rows(sh).map(r => _indexByHeader(r, headers));
}

/**
 * Get grade boundaries
 */
function getGradeBoundaries() {
  const sh = _getSheet('GradeBoundaries');
  _ensureHeaders(sh, SHEETS.GradeBoundaries);
  const headers = _headers(sh);
  return _rows(sh).map(r => _indexByHeader(r, headers));
}

/**
 * Get list of students, optionally filtered by class
 */
function getStudents(cls = '') {
  try {
    const sh = _getSheet('Students');
    _ensureHeaders(sh, SHEETS.Students);
    const headers = _headers(sh);
    const allStudents = _rows(sh).map(r => _indexByHeader(r, headers));
    
    // Filter by class if provided
    if (cls && cls.trim()) {
      const classFilter = String(cls).trim();
      return allStudents.filter(s => String(s.class || '').trim() === classFilter);
    }
    
    return allStudents;
  } catch (error) {
    Logger.log('Error in getStudents: ' + error.message);
    return [];
  }
}

/**
 * Get student report card data for an exam type
 * Returns exam results for students, used by ReportCard component
 */
function getStudentReportCard(examType, admNo = '', cls = '') {
  try {
    Logger.log(`Getting report card for examType: ${examType}, admNo: ${admNo}, class: ${cls}`);
    
    // Get exams of this type
    const examSh = _getSheet('Exams');
    const examHeaders = _headers(examSh);
    const exams = _rows(examSh).map(r => _indexByHeader(r, examHeaders))
      .filter(exam => {
        const typeMatch = !examType || String(exam.examType || '').toLowerCase() === String(examType).toLowerCase();
        const classMatch = !cls || String(exam.class || '') === String(cls);
        return typeMatch && classMatch;
      });
    
    Logger.log(`Found ${exams.length} exams for type ${examType}, class ${cls}`);
    
    // Get marks for these exams
    const marksSh = _getSheet('ExamMarks');
    const marksHeaders = _headers(marksSh);
    const allMarks = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));
    
    // Get students
    const studentsSh = _getSheet('Students');
    const studentsHeaders = _headers(studentsSh);
    const students = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders))
      .filter(student => {
        const classMatch = !cls || String(student.class || '') === String(cls);
        const admNoMatch = !admNo || String(student.admNo || '') === String(admNo);
        return classMatch && admNoMatch;
      });
    
    Logger.log(`Found ${students.length} students, ${allMarks.length} total marks`);
    
    // Build report card data
    const reportData = {
      examType: examType,
      class: cls,
      students: students.map(student => {
        // Match student marks using admission number with flexible comparison
        const studentAdmNo = String(student.admNo || '').trim();
        const studentMarks = allMarks.filter(mark => 
          String(mark.admNo || '').trim() === studentAdmNo
        );
        
        Logger.log(`Student ${student.name} (${studentAdmNo}): Found ${studentMarks.length} marks`);
        
        const subjects = {};
        let totalMarks = 0;
        let maxMarks = 0;
        let subjectCount = 0;
        
        studentMarks.forEach(mark => {
          const exam = exams.find(e => e.examId === mark.examId);
          if (exam) {
            // ExamMarks sheet uses 'ce' and 'te' columns
            // ce = Continuous Evaluation (Internal marks)
            // te = Term Exam (External marks)
            const ce = Number(mark.ce || 0);
            const te = Number(mark.te || 0);
            const totalFromSheet = Number(mark.total || 0);
            
            // Direct assignment: ce is internal, te is external
            let internal = ce;
            let external = te;
            
            // If total exists but ce and te are both 0, use the stored total
            // This handles legacy data where only total was stored
            if (totalFromSheet > 0 && ce === 0 && te === 0) {
              // For backward compatibility, treat legacy total as external marks
              external = totalFromSheet;
              internal = 0;
            }
            
            const total = internal + external;
            const examMax = Number(exam.totalMax || exam.internalMax + exam.externalMax || 100);
            
            Logger.log(`  Subject ${exam.subject}: ce=${ce}, te=${te}, internal=${internal}, external=${external}, total=${total}, max=${examMax}, percentage=${examMax > 0 ? ((total / examMax) * 100).toFixed(2) : 0}%`);
            
            // Determine if this class has internal marks
            const hasInternalMarks = _classHasInternalMarks(student.class);
            
            // Calculate percentage for grade determination
            const percentage = examMax > 0 ? (total / examMax) * 100 : 0;
            
            // IMPORTANT: Use 'ce' and 'te' property names to match frontend expectations
            subjects[exam.subject] = {
              ce: hasInternalMarks ? internal : null,  // null = don't display
              te: external,  // Always show external marks
              internal: hasInternalMarks ? internal : null,  // Backward compatibility
              external: external,  // Backward compatibility
              total: total,
              maxMarks: examMax,
              percentage: Math.round(percentage),
              grade: _calculateGradeFromBoundaries(percentage, student.class),
              hasInternalMarks: hasInternalMarks
            };
            
            totalMarks += total;
            maxMarks += examMax;
            subjectCount++;
          }
        });
        
        const overallPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
        
        return {
          admNo: student.admNo,
          name: student.name,
          class: student.class,
          subjects: subjects,
          totalMarks: totalMarks,
          maxMarks: maxMarks,
          percentage: overallPercentage,
          grade: _calculateGradeFromBoundaries(overallPercentage, student.class),
          subjectCount: subjectCount
        };
      }),
      exams: exams
    };
    
    Logger.log(`Returning report data with ${reportData.students.length} students`);
    return reportData;
    
  } catch (error) {
    Logger.log('Error in getStudentReportCard: ' + error.message);
    return { students: [], exams: [], examType: examType, class: cls };
  }
}

/**
 * Get attendance data for a specific class and date
 */
function getAttendance(cls, date) {
  try {
    Logger.log(`Getting attendance for class: ${cls}, date: ${date}`);
    
    // For now, return a basic attendance structure
    // This can be enhanced when attendance tracking is implemented
    const studentsResult = getStudents(cls);
    const students = studentsResult || [];
    
    return {
      success: true,
      class: cls,
      date: date,
      students: students.map(student => ({
        admNo: student.admNo,
        name: student.name,
        present: true,  // Default to present (can be modified when attendance tracking is added)
        absent: false,
        remarks: ''
      })),
      totalStudents: students.length,
      presentCount: students.length,
      absentCount: 0
    };
    
  } catch (error) {
    Logger.log('Error in getAttendance: ' + error.message);
    return { success: false, error: error.message, students: [] };
  }
}

/**
 * Get student performance analytics for a specific class
 */
function getStudentPerformance(cls) {
  try {
    Logger.log(`Getting student performance for class: ${cls}`);
    
    // Get students for this class
    const studentsResult = getStudents(cls);
    const students = studentsResult || [];
    
    // Get all exams for this class
    const examsResult = getExams({ class: cls });
    const exams = examsResult?.data || examsResult || [];
    
    // Get all exam marks
    const marksSh = _getSheet('ExamMarks');
    const marksHeaders = _headers(marksSh);
    const allMarks = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));
    
    // Calculate performance for each student
    const studentPerformance = students.map(student => {
      const studentMarks = allMarks.filter(mark => mark.admNo === student.admNo);
      
      let totalMarks = 0;
      let maxMarks = 0;
      let examCount = 0;
      const subjectPerformance = {};
      
      studentMarks.forEach(mark => {
        const exam = exams.find(e => e.examId === mark.examId);
        if (exam) {
          // Handle both ce/te (ExamMarks sheet) and internal/external naming
          const internal = Number(mark.internal || mark.ce || 0);
          const external = Number(mark.external || mark.te || 0);
          const total = internal + external;
          const examMax = Number(exam.totalMax || exam.internalMax + exam.externalMax || 100);
          
          if (!subjectPerformance[exam.subject]) {
            subjectPerformance[exam.subject] = {
              totalMarks: 0,
              maxMarks: 0,
              examCount: 0,
              percentage: 0
            };
          }
          
          subjectPerformance[exam.subject].totalMarks += total;
          subjectPerformance[exam.subject].maxMarks += examMax;
          subjectPerformance[exam.subject].examCount++;
          
          totalMarks += total;
          maxMarks += examMax;
          examCount++;
        }
      });
      
      // Calculate subject percentages
      Object.keys(subjectPerformance).forEach(subject => {
        const subj = subjectPerformance[subject];
        subj.percentage = subj.maxMarks > 0 ? Math.round((subj.totalMarks / subj.maxMarks) * 100) : 0;
      });
      
      const overallPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
      
      return {
        admNo: student.admNo,
        name: student.name,
        class: student.class,
        totalMarks: totalMarks,
        maxMarks: maxMarks,
        percentage: overallPercentage,
        grade: _calculateGradeFromBoundaries(overallPercentage, student.class),
        examCount: examCount,
        subjectPerformance: subjectPerformance
      };
    });
    
    // Calculate class analytics
    const classPerformance = {
      totalStudents: students.length,
      averagePercentage: studentPerformance.length > 0 ? 
        Math.round(studentPerformance.reduce((sum, s) => sum + s.percentage, 0) / studentPerformance.length) : 0,
      highestPercentage: studentPerformance.length > 0 ? 
        Math.max(...studentPerformance.map(s => s.percentage)) : 0,
      lowestPercentage: studentPerformance.length > 0 ? 
        Math.min(...studentPerformance.map(s => s.percentage)) : 0,
      passCount: studentPerformance.filter(s => s.percentage >= 40).length,
      failCount: studentPerformance.filter(s => s.percentage < 40).length
    };
    
    return {
      success: true,
      class: cls,
      students: studentPerformance,
      analytics: classPerformance,
      exams: exams
    };
    
  } catch (error) {
    Logger.log('Error in getStudentPerformance: ' + error.message);
    return { success: false, error: error.message, students: [] };
  }
}

/**
 * ADMIN FUNCTION: Recalculate all grades in ExamMarks sheet
 * Run this once after deploying Version 130 to fix existing grades
 * This will update all grades to use correct "Std 9-12" boundaries
 */
function recalculateAllGrades() {
  try {
    Logger.log('Starting grade recalculation...');
    
    // Get ExamMarks sheet
    const marksSh = _getSheet('ExamMarks');
    const headers = _headers(marksSh);
    const data = marksSh.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('No marks to recalculate');
      return { success: true, message: 'No marks found', updated: 0 };
    }
    
    // Find column indexes
    const classCol = headers.indexOf('class') + 1;
    const totalCol = headers.indexOf('total') + 1;
    const gradeCol = headers.indexOf('grade') + 1;
    
    // Get Exams data for totalMax values
    const examSh = _getSheet('Exams');
    const examHeaders = _headers(examSh);
    const exams = _rows(examSh).map(r => _indexByHeader(r, examHeaders));
    
    if (!classCol || !totalCol || !gradeCol) {
      return { error: 'Required columns not found in ExamMarks sheet' };
    }
    
    let updatedCount = 0;
    
    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      
      const examId = row[headers.indexOf('examId')];
      const className = row[headers.indexOf('class')];
      const total = Number(row[headers.indexOf('total')] || 0);
      const oldGrade = row[headers.indexOf('grade')];
      
      // Find exam to get totalMax
      const exam = exams.find(e => e.examId === examId);
      if (!exam) {
        Logger.log(`Row ${rowNum}: Exam ${examId} not found, skipping`);
        continue;
      }
      
      const totalMax = Number(exam.totalMax || exam.internalMax + exam.externalMax || 100);
      const percentage = totalMax > 0 ? (total / totalMax) * 100 : 0;
      
      // Recalculate grade using current Version 130 logic
      const newGrade = _calculateGradeFromBoundaries(percentage, className);
      
      // Update only if grade changed
      if (oldGrade !== newGrade) {
        marksSh.getRange(rowNum, gradeCol).setValue(newGrade);
        updatedCount++;
        Logger.log(`Row ${rowNum}: ${className} - ${total}/${totalMax} (${percentage.toFixed(1)}%) - Changed ${oldGrade} → ${newGrade}`);
      }
    }
    
    Logger.log(`Grade recalculation complete. Updated ${updatedCount} out of ${data.length - 1} records.`);
    
    return {
      success: true,
      message: `Successfully recalculated grades`,
      totalRecords: data.length - 1,
      updated: updatedCount,
      unchanged: (data.length - 1) - updatedCount
    };
    
  } catch (error) {
    Logger.log('Error in recalculateAllGrades: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an exam (Super Admin only)
 * This will also delete all associated exam marks
 */
function deleteExam(examId) {
  try {
    appLog('INFO', 'deleteExam', 'Deleting exam: ' + examId);
    
    const sh = _getSheet('Exams');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    let deleted = false;
    
    // Find and delete the exam row (iterate backwards to avoid index issues)
    for (let i = data.length - 1; i >= 1; i--) {
      const row = _indexByHeader(data[i], headers);
      if (row.examId === examId) {
        sh.deleteRow(i + 1);
        deleted = true;
        appLog('INFO', 'deleteExam', 'Exam row deleted: ' + examId);
        break;
      }
    }
    
    if (!deleted) {
      return { error: 'Exam not found' };
    }
    
    // Delete all associated exam marks
    deleteExamMarks(examId);
    
    return { success: true, message: 'Exam and associated marks deleted successfully' };
    
  } catch (error) {
    appLog('ERROR', 'deleteExam', 'Error: ' + error.message);
    return { error: 'Failed to delete exam: ' + error.message };
  }
}

/**
 * Delete all marks for a specific exam
 * Helper function used by deleteExam
 */
function deleteExamMarks(examId) {
  try {
    const sh = _getSheet('ExamMarks');
    const headers = _headers(sh);
    const data = sh.getDataRange().getValues();
    
    let deletedCount = 0;
    
    // Iterate backwards to avoid index shifting issues
    for (let i = data.length - 1; i >= 1; i--) {
      const row = _indexByHeader(data[i], headers);
      if (row.examId === examId) {
        sh.deleteRow(i + 1);
        deletedCount++;
      }
    }
    
    appLog('INFO', 'deleteExamMarks', `Deleted ${deletedCount} marks for exam ${examId}`);
    return deletedCount;
    
  } catch (error) {
    appLog('ERROR', 'deleteExamMarks', 'Error: ' + error.message);
    return 0;
  }
}