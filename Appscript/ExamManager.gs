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
    // Normalize class name: remove "STD" or "Std" prefix and extra spaces
    const examClass = String(data.class || '')
      .trim()
      .replace(/^std\s*/gi, '')
      .replace(/\s+/g, '')
      .toUpperCase();
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
    
    // Get or create the Exams sheet
    appLog('INFO', 'createExam', 'Attempting to get/create Exams sheet');
    const sh = _getSheet('Exams');
    appLog('INFO', 'createExam', 'Sheet retrieved: ' + sh.getName() + ', Last Row: ' + sh.getLastRow());
    
    // Ensure headers are set
    appLog('INFO', 'createExam', 'Ensuring headers');
    _ensureHeaders(sh, SHEETS.Exams);
    appLog('INFO', 'createExam', 'Headers ensured, Last Row: ' + sh.getLastRow());
    
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
    
    const examName = `${data.examType} - ${examClass} - ${data.subject}`;
    
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
      examClass,  // Use normalized class name
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
    
    appLog('INFO', 'createExam', 'Appending row to Exams sheet. Data: ' + JSON.stringify(examData));
    const rowsBefore = sh.getLastRow();
    sh.appendRow(examData);
    const rowsAfter = sh.getLastRow();
    appLog('INFO', 'createExam', 'Row appended. Rows before: ' + rowsBefore + ', Rows after: ' + rowsAfter);
    
    // Verify the row was actually written
    if (rowsAfter > rowsBefore) {
      appLog('INFO', 'createExam', 'Exam created successfully: ' + examId + ' at row ' + rowsAfter);
    } else {
      appLog('ERROR', 'createExam', 'Row count did not increase! Data may not have been written.');
    }
    
    // Invalidate exam caches since data changed
    invalidateCache('exams');
    
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
        class: examClass,  // Use normalized class name
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
    // Normalize class name: remove "STD" or "Std" prefix and extra spaces
    const examClass = String(data.class || '')
      .trim()
      .replace(/^std\s*/gi, '')
      .replace(/\s+/g, '')
      .toUpperCase();
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
 * Update an existing exam
 */
function updateExam(data) {
  try {
    appLog('INFO', 'updateExam', { data: data });
    
    const userEmail = (data.userEmail || '').toLowerCase().trim();
    const examId = data.examId || '';
    
    if (!userEmail) {
      appLog('ERROR', 'updateExam', 'User email is required');
      return { error: 'User email is required' };
    }
    
    if (!examId) {
      appLog('ERROR', 'updateExam', 'Exam ID is required');
      return { error: 'Exam ID is required' };
    }
    
    // Get the Exams sheet
    const sh = _getSheet('Exams');
    const headers = _headers(sh);
    const rows = _rows(sh);
    
    // Find the exam row
    const examIdCol = headers.indexOf('examId') + 1;
    if (examIdCol === 0) {
      return { error: 'examId column not found' };
    }
    
    let targetRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][examIdCol - 1]) === examId) {
        targetRow = i + 2; // +2 because: 1-indexed and header row
        break;
      }
    }
    
    if (targetRow === -1) {
      appLog('ERROR', 'updateExam', 'Exam not found: ' + examId);
      return { error: 'Exam not found' };
    }
    
    // Get current exam data
    const currentExam = _indexByHeader(rows[targetRow - 2], headers);
    
    // Check permission (only creator or admin can edit)
    const isSuperAdmin = _isSuperAdminSafe(userEmail);
    const isCreator = String(currentExam.creatorEmail || '').toLowerCase() === userEmail;
    
    if (!isSuperAdmin && !isCreator) {
      appLog('ERROR', 'updateExam', 'Permission denied for ' + userEmail);
      return { error: 'You do not have permission to edit this exam' };
    }
    
    // Normalize class name
    const examClass = String(data.class || currentExam.class || '')
      .trim()
      .replace(/^std\s*/gi, '')
      .replace(/\s+/g, '')
      .toUpperCase();
    
    // Handle hasInternalMarks
    const hasInternal = (
      data.hasInternalMarks === true || 
      data.hasInternalMarks === 'true' || 
      data.hasInternalMarks === 'TRUE'
    ) ? 'TRUE' : 'FALSE';
    
    // Calculate marks - use provided values from frontend
    const internalMax = hasInternal === 'TRUE' ? (parseInt(data.internalMax) || 0) : 0;
    const externalMax = parseInt(data.externalMax) || 0;
    const totalMax = parseInt(data.totalMax) || (internalMax + externalMax);
    
    const subject = data.subject || currentExam.subject;
    const examType = data.examType || currentExam.examType;
    const examName = `${examType} - ${examClass} - ${subject}`;
    
    // Update the row
    const classCol = headers.indexOf('class') + 1;
    const subjectCol = headers.indexOf('subject') + 1;
    const examTypeCol = headers.indexOf('examType') + 1;
    const hasInternalCol = headers.indexOf('hasInternalMarks') + 1;
    const internalMaxCol = headers.indexOf('internalMax') + 1;
    const externalMaxCol = headers.indexOf('externalMax') + 1;
    const totalMaxCol = headers.indexOf('totalMax') + 1;
    const dateCol = headers.indexOf('date') + 1;
    const examNameCol = headers.indexOf('examName') + 1;
    
    if (classCol) sh.getRange(targetRow, classCol).setValue(examClass);
    if (subjectCol) sh.getRange(targetRow, subjectCol).setValue(subject);
    if (examTypeCol) sh.getRange(targetRow, examTypeCol).setValue(examType);
    if (hasInternalCol) sh.getRange(targetRow, hasInternalCol).setValue(hasInternal);
    if (internalMaxCol) sh.getRange(targetRow, internalMaxCol).setValue(internalMax);
    if (externalMaxCol) sh.getRange(targetRow, externalMaxCol).setValue(externalMax);
    if (totalMaxCol) sh.getRange(targetRow, totalMaxCol).setValue(totalMax);
    if (dateCol) sh.getRange(targetRow, dateCol).setValue(data.date || currentExam.date);
    if (examNameCol) sh.getRange(targetRow, examNameCol).setValue(examName);
    
    appLog('INFO', 'updateExam', 'Exam updated successfully: ' + examId + ' at row ' + targetRow);
    
    // Invalidate exam caches
    invalidateCache('exams');
    
    // Audit log
    const userSh = _getSheet('Users');
    const userHeaders = _headers(userSh);
    const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));
    const user = users.find(u => String(u.email||'').toLowerCase() === userEmail);
    const userName = user ? user.name : userEmail;
    
    logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: AUDIT_ENTITIES.EXAM,
      entityId: examId,
      userEmail: userEmail,
      userName: userName,
      userRole: isSuperAdmin ? 'Super Admin' : 'Teacher/HM',
      beforeData: {
        class: currentExam.class,
        subject: currentExam.subject,
        examType: currentExam.examType,
        totalMax: currentExam.totalMax,
        internalMax: currentExam.internalMax,
        externalMax: currentExam.externalMax
      },
      afterData: {
        class: examClass,
        subject: subject,
        examType: examType,
        totalMax: totalMax,
        internalMax: internalMax,
        externalMax: externalMax
      },
      description: `Exam updated: ${examName}`,
      severity: AUDIT_SEVERITY.INFO
    });
    
    return { ok: true, examId: examId };
  } catch (err) {
    appLog('ERROR', 'updateExam', 'Exception: ' + err.message);
    return { error: 'Failed to update exam: ' + err.message };
  }
}

/**
 * Get all exams (with optional filtering)
 */
function getExams(params) {
  // Generate cache key based on filters
  const cacheKey = generateCacheKey('exams', {
    class: params.class,
    subject: params.subject,
    examType: params.examType,
    teacherEmail: params.teacherEmail,
    role: params.role
  });
  
  // Use cached data if available (5 minute TTL)
  return getCachedData(cacheKey, function() {
    return _fetchExams(params);
  }, CACHE_TTL.MEDIUM);
}

/**
 * Internal function to fetch exams from sheet
 */
function _fetchExams(params) {
  const sh = _getSheet('Exams');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));

  // Normalize helpers so filters work even if some sheets store "STD 10A" and others store "10A"
  const normClass = function(v) {
    return String(v || '')
      .toLowerCase()
      .trim()
      .replace(/^std\s*/g, '')
      .replace(/\s+/g, '');
  };
  const normText = function(v) {
    return String(v || '').toLowerCase().trim();
  };
  
  let filtered = list;
  
  // Filter by class if provided
  if (params.class) {
    const target = normClass(params.class);
    filtered = filtered.filter(exam => normClass(exam.class) === target);
  }
  
  // Filter by subject if provided
  if (params.subject) {
    const target = normText(params.subject);
    filtered = filtered.filter(exam => normText(exam.subject) === target);
  }
  
  // Filter by exam type if provided
  if (params.examType) {
    const target = normText(params.examType);
    filtered = filtered.filter(exam => normText(exam.examType) === target);
  }
  
  return filtered;
}

/**
 * Submit exam marks for students
 */
function submitExamMarks(data) {
  const examId = data.examId || '';
  const marks = Array.isArray(data.marks) ? data.marks : [];
  const teacherEmail = String(data.teacherEmail || data.email || '').toLowerCase().trim();
  
  if (!examId) return { error: 'Missing examId' };
  if (marks.length === 0) return { error: 'No marks data provided' };
  if (!teacherEmail) return { error: 'Missing teacherEmail' };
  
  // Get exam details
  const examSh = _getSheet('Exams');
  const examHeaders = _headers(examSh);
  const exams = _rows(examSh).map(r => _indexByHeader(r, examHeaders));
  const exam = exams.find(e => e.examId === examId);
  
  if (!exam) return { error: 'Exam not found' };

  // Permission check for marks submission:
  // 1. Super Admin - allowed for all
  // 2. HM - allowed for all
  // 3. Class Teacher for this class - allowed for ALL subjects in their class
  // 4. Subject Teacher - allowed if they teach this subject in this class
  
  const isSuperAdmin = _isSuperAdminSafe(teacherEmail);
  if (isSuperAdmin) {
    appLog('INFO', 'submitExamMarks', 'Super Admin access granted for ' + teacherEmail);
  } else {
    // Get user details
    const userSh = _getSheet('Users');
    const userHeaders = _headers(userSh);
    const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));
    const user = users.find(u => String(u.email||'').toLowerCase() === teacherEmail);
    
    if (!user) {
      appLog('ERROR', 'submitExamMarks', 'User not found: ' + teacherEmail);
      return { error: 'User not found. Please contact administrator.' };
    }
    
    // Check if HM
    const roles = String(user.roles || '').toLowerCase();
    const isHM = roles.includes('hm') || roles.includes('headmaster') || roles.includes('h m') || roles.includes('head master');
    
    if (isHM) {
      appLog('INFO', 'submitExamMarks', 'HM access granted for ' + teacherEmail);
    } else {
      // Check if class teacher for this class (by classTeacherFor field OR by "Class Teacher" role)
      const classTeacherFor = String(user.classTeacherFor || '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      
      // Normalize class for comparison - remove std prefix, spaces, and make lowercase
      const normClass = function(s) { 
        return String(s || '').trim().replace(/^std\s*/gi, '').replace(/\s+/g, '').toLowerCase(); 
      };
      const examClassNorm = normClass(exam.class);
      
      // Also check by numeric class only (e.g., "10" matches "10A", "10B")
      const numOnly = function(s) {
        const m = String(s || '').match(/\d+/);
        return m ? m[0] : '';
      };
      const examClassNum = numOnly(exam.class);
      
      // Check if user is class teacher for this class
      const isClassTeacher = classTeacherFor.some(c => {
        const cNorm = normClass(c);
        const cNum = numOnly(c);
        return cNorm === examClassNorm || (examClassNum && cNum === examClassNum);
      });
      
      // Also check if user has "Class Teacher" role (general class teacher)
      const hasClassTeacherRole = roles.includes('class teacher') || roles.includes('classteacher');
      
      appLog('INFO', 'submitExamMarks', {
        email: teacherEmail,
        examClass: exam.class,
        examClassNorm: examClassNorm,
        classTeacherFor: classTeacherFor,
        isClassTeacher: isClassTeacher,
        hasClassTeacherRole: hasClassTeacherRole,
        roles: roles
      });
      
      if (isClassTeacher || hasClassTeacherRole) {
        appLog('INFO', 'submitExamMarks', 'Class Teacher access granted for ' + teacherEmail + ' on class ' + exam.class);
      } else {
        // Check if subject teacher for this class+subject combination
        const hasPermission = userCanCreateExam(teacherEmail, String(exam.class || ''), String(exam.subject || ''));
        if (!hasPermission) {
          appLog('ERROR', 'submitExamMarks', 'Permission denied for ' + teacherEmail + ' on ' + exam.class + ' ' + exam.subject);
          return { error: 'You do not have permission to submit marks for this exam. Only HM, Class Teachers, or Subject Teachers can submit marks.' };
        }
        appLog('INFO', 'submitExamMarks', 'Subject Teacher access granted for ' + teacherEmail);
      }
    }
  }
  
  const marksSh = _getSheet('ExamMarks');
  _ensureHeaders(marksSh, SHEETS.ExamMarks);
  const now = new Date().toISOString();
  
  // Get existing marks to check for updates vs inserts
  const marksHeaders = _headers(marksSh);
  const existingMarks = _rows(marksSh).map((r, idx) => ({
    data: _indexByHeader(r, marksHeaders),
    rowIndex: idx + 2 // +2 because: 1-based index + header row
  }));
  
  // Process each student's marks
  for (const studentMark of marks) {
    // Accept both ce/te (old) and internal/external (new) field names
    let ce = parseInt(studentMark.ce ?? studentMark.internal);
    if (isNaN(ce)) ce = 0;
    const rawExternal = (studentMark.te ?? studentMark.external);
    const extStr = String(rawExternal || '').trim().toUpperCase();
    const isAbsent = extStr === 'A' || extStr === 'ABSENT';

    let teStored;
    let total;
    let grade;

    if (isAbsent) {
      // Persist explicit Absent status
      teStored = 'A';
      total = ce; // Only internal contributes when external is Absent
      grade = 'Absent';
      Logger.log(`[Marks Submission] Student: ${studentMark.studentName}, CE: ${ce}, TE: A (Absent), Total: ${total}/${exam.totalMax}, Grade: Absent`);
    } else {
      const teNum = parseInt(rawExternal) || 0;
      teStored = teNum;
      total = ce + teNum;
      const percentage = (total / exam.totalMax) * 100;
      grade = _calculateGradeFromBoundaries(percentage, exam.class);
      Logger.log(`[Marks Submission] Student: ${studentMark.studentName}, CE: ${ce}, TE: ${teNum}, Total: ${total}/${exam.totalMax}, Percentage: ${percentage.toFixed(2)}%, Grade: ${grade}`);
    }
    
    // Invalidate cache for this exam
    invalidateCache('exam_marks_examid:' + examId);
    
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
      teStored,
      total,
      grade,
      now
    ];
    
    // Check if this student already has marks for this exam
    const existingMark = existingMarks.find(m => 
      m.data.examId === examId && 
      String(m.data.admNo || '').trim() === String(studentMark.admNo || '').trim()
    );
    
    if (existingMark) {
      // Update existing row
      const range = marksSh.getRange(existingMark.rowIndex, 1, 1, markData.length);
      range.setValues([markData]);
      Logger.log(`[Marks Update] Updated existing marks for ${studentMark.studentName} (Row ${existingMark.rowIndex})`);
    } else {
      // Insert new row
      marksSh.appendRow(markData);
      Logger.log(`[Marks Insert] Added new marks for ${studentMark.studentName}`);
    }
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
  const cacheKey = generateCacheKey('exam_marks', { examId: examId });
  return getCachedData(cacheKey, function() {
    return _fetchExamMarks(examId);
  }, CACHE_TTL.MEDIUM);
}

function _fetchExamMarks(examId) {
  const sh = _getSheet('ExamMarks');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  
  return list.filter(mark => mark.examId === examId);
}

/**
 * Get classwise marks entry status for a batch of exams.
 * Returns entered/total counts per examId to show an indicator in UI.
 *
 * @param {string[]} examIds
 * @param {{teacherEmail?:string, role?:string}=} params
 * @returns {{success:boolean, exams:Array<{examId:string, class:string, enteredCount:number, totalStudents:number, missingCount:number, complete:boolean}>}}
 */
function getExamMarksEntryStatusBatch(examIds, params) {
  try {
    const p = params || {};
    const teacherEmail = String(p.teacherEmail || '').toLowerCase().trim();
    
    const ids = (Array.isArray(examIds) ? examIds : [])
      .map(x => String(x || '').trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return { success: true, exams: [] };
    }

    const normClass = function(v) {
      return String(v || '')
        .toLowerCase()
        .trim()
        .replace(/^std\s*/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };
    const normAdmNo = function(v) {
      return String(v || '').trim().toLowerCase();
    };

    const idSet = new Set(ids);
    
    // Check if we should filter by teacher permissions
    const roleLower = String(p.role || '').toLowerCase();
    const isPrivilegedRole = (
      roleLower.includes('super') ||
      roleLower.includes('admin') ||
      roleLower.includes('hm') ||
      roleLower.includes('h m') ||
      roleLower.includes('headmaster') ||
      roleLower.includes('head master')
    );
    const filterByTeacher = !!teacherEmail && !isPrivilegedRole;
    
    const normalizeClassForPermission = function(v) {
      return String(v || '')
        .trim()
        .replace(/^std\s*/gi, '')
        .replace(/\s+/g, '')
        .toUpperCase();
    };

    // Prepare teacher context for class-teacher permissions
    const teacherCtx = {
      hasClassTeacherRole: false,
      classTeacherFor: []
    };
    if (filterByTeacher) {
      const userSh = _getSheet('Users');
      const userHeaders = _headers(userSh);
      const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));
      const user = users.find(u => String(u.email || '').toLowerCase() === teacherEmail);
      if (user) {
        const rolesLower = String(user.roles || '').toLowerCase();
        teacherCtx.hasClassTeacherRole = rolesLower.includes('class teacher') || rolesLower.includes('classteacher');
        teacherCtx.classTeacherFor = String(user.classTeacherFor || '')
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0);
      }
    }

    // Map examId -> class (normalized + raw)
    const examsSh = _getSheet('Exams');
    _ensureHeaders(examsSh, SHEETS.Exams);
    const examsHeaders = _headers(examsSh);
    const examsList = _rows(examsSh).map(r => _indexByHeader(r, examsHeaders));

    const examMetaById = {};
    for (const ex of examsList) {
      const exId = String(ex.examId || '').trim();
      if (!exId || !idSet.has(exId)) continue;
      
      const exClassRaw = String(ex.class || '').trim();
      const exSubject = String(ex.subject || '').trim();
      
      // Filter by teacher permissions: allow if class teacher for this class OR subject teacher
      if (filterByTeacher) {
        const permClassUpper = normalizeClassForPermission(exClassRaw);
        const examClassNormLower = normClass(exClassRaw);
        const numOnly = function(s) { const m = String(s || '').match(/\d+/); return m ? m[0] : ''; };
        const examClassNum = numOnly(exClassRaw);

        const isClassTeacherForThis = teacherCtx.classTeacherFor.some(c => {
          const cNorm = normClass(c);
          const cNum = numOnly(c);
          return cNorm === examClassNormLower || (examClassNum && cNum === examClassNum);
        });

        const isAllowed = isClassTeacherForThis || teacherCtx.hasClassTeacherRole || userCanCreateExam(teacherEmail, permClassUpper, exSubject);
        if (!isAllowed) continue;
      }
      
      examMetaById[exId] = {
        examId: exId,
        classRaw: exClassRaw,
        classNorm: normClass(exClassRaw)
      };
    }

    // Build student sets per class
    const studentsSh = _getSheet('Students');
    _ensureHeaders(studentsSh, SHEETS.Students);
    const studentsHeaders = _headers(studentsSh);
    const studentsList = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders));

    /** @type {Object<string, Set<string>>} */
    const studentsByClass = {};
    for (const st of studentsList) {
      const clsNorm = normClass(st.class);
      const adm = normAdmNo(st.admNo);
      if (!clsNorm || !adm) continue;
      if (!studentsByClass[clsNorm]) studentsByClass[clsNorm] = new Set();
      studentsByClass[clsNorm].add(adm);
    }

    // Count entered marks per examId (unique students)
    const marksSh = _getSheet('ExamMarks');
    _ensureHeaders(marksSh, SHEETS.ExamMarks);
    const marksHeaders = _headers(marksSh);
    const marksList = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));

    /** @type {Object<string, Set<string>>} */
    const enteredByExamId = {};
    for (const mk of marksList) {
      const exId = String(mk.examId || '').trim();
      if (!exId || !idSet.has(exId)) continue;
      const meta = examMetaById[exId];
      if (!meta) continue;

      const adm = normAdmNo(mk.admNo);
      if (!adm) continue;

      const expectedSet = studentsByClass[meta.classNorm];
      if (!expectedSet || !expectedSet.has(adm)) continue;

      // Only count as entered if there are actual marks (not all zeros/empty)
      // Allow 'A' for absent, or any non-zero marks
      const ce = String(mk.ce ?? '').trim();
      const te = String(mk.te ?? '').trim();
      const total = String(mk.total ?? '').trim();
      
      const isAbsent = (te.toUpperCase() === 'A' || te.toUpperCase() === 'ABSENT');
      const hasActualMarks = (
        (ce !== '' && ce !== '0' && parseFloat(ce) > 0) ||
        (te !== '' && te !== '0' && parseFloat(te) > 0 && !isAbsent) ||
        isAbsent
      );
      
      if (!hasActualMarks) continue;

      if (!enteredByExamId[exId]) enteredByExamId[exId] = new Set();
      enteredByExamId[exId].add(adm);
    }

    const result = [];
    for (const exId of ids) {
      const meta = examMetaById[exId] || { examId: exId, classRaw: '', classNorm: '' };
      const expectedSet = meta.classNorm ? (studentsByClass[meta.classNorm] || new Set()) : new Set();
      const enteredSet = enteredByExamId[exId] || new Set();
      const totalStudents = expectedSet.size;
      const enteredCount = enteredSet.size;
      const missingCount = Math.max(0, totalStudents - enteredCount);
      const complete = totalStudents > 0 && enteredCount >= totalStudents;

      result.push({
        examId: exId,
        class: meta.classRaw || '',
        enteredCount,
        totalStudents,
        missingCount,
        complete
      });
    }

    return { success: true, exams: result };
  } catch (error) {
    appLog('ERROR', 'getExamMarksEntryStatusBatch', 'Error: ' + error.message);
    return { success: false, exams: [], error: error.message };
  }
}

/**
 * Get marks entry status for all exams (optionally filtered by class).
 * This avoids sending large examIds lists from frontend.
 *
 * @param {{class?:string, examType?:string, subject?:string, limit?:number, teacherEmail?:string, role?:string}=} params
 * @returns {{success:boolean, exams:Array<{examId:string, class:string, subject:string, examType:string, examName:string, date:string, createdAt:string, enteredCount:number, totalStudents:number, missingCount:number, complete:boolean}>}}
 */
function getExamMarksEntryStatusAll(params) {
  try {
    const p = params || {};
    const limit = Number(p.limit || 0) || 0;
    const teacherEmail = String(p.teacherEmail || '').toLowerCase().trim();

    const normClass = function(v) {
      return String(v || '')
        .toLowerCase()
        .trim()
        .replace(/^std\s*/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };
    const normAdmNo = function(v) {
      return String(v || '').trim().toLowerCase();
    };
    const classFilterNorm = p.class ? normClass(p.class) : '';
    const examTypeFilter = String(p.examType || '').trim().toLowerCase();
    const subjectFilter = String(p.subject || '').trim().toLowerCase();

    // Decide if we should filter by teacher permissions
    const roleLower = String(p.role || '').toLowerCase();
    const isPrivilegedRole = (
      roleLower.includes('super') ||
      roleLower.includes('admin') ||
      roleLower.includes('hm') ||
      roleLower.includes('h m') ||
      roleLower.includes('headmaster') ||
      roleLower.includes('head master')
    );
    const filterByTeacher = !!teacherEmail && !isPrivilegedRole;

    const normalizeClassForPermission = function(v) {
      return String(v || '')
        .trim()
        .replace(/^std\s*/gi, '')
        .replace(/\s+/g, '')
        .toUpperCase();
    };

    // Prepare teacher context for class-teacher permissions
    const teacherCtx = {
      hasClassTeacherRole: false,
      classTeacherFor: []
    };
    if (filterByTeacher) {
      const userSh = _getSheet('Users');
      const userHeaders = _headers(userSh);
      const users = _rows(userSh).map(r => _indexByHeader(r, userHeaders));
      const user = users.find(u => String(u.email || '').toLowerCase() === teacherEmail);
      if (user) {
        const rolesLower = String(user.roles || '').toLowerCase();
        teacherCtx.hasClassTeacherRole = rolesLower.includes('class teacher') || rolesLower.includes('classteacher');
        teacherCtx.classTeacherFor = String(user.classTeacherFor || '')
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0);
      }
    }

    // Read exams and optionally filter by class
    const examsSh = _getSheet('Exams');
    _ensureHeaders(examsSh, SHEETS.Exams);
    const examsHeaders = _headers(examsSh);
    const examsList = _rows(examsSh).map(r => _indexByHeader(r, examsHeaders));

    const examMetaById = {};
    const examIds = [];
    for (const ex of examsList) {
      const exId = String(ex.examId || '').trim();
      if (!exId) continue;
      const exClassRaw = String(ex.class || '').trim();
      const exClassNorm = normClass(exClassRaw);
      if (classFilterNorm && exClassNorm !== classFilterNorm) continue;

      const exSubject = String(ex.subject || '').trim();
      const exExamType = String(ex.examType || '').trim();
      if (subjectFilter && exSubject.toLowerCase() !== subjectFilter) continue;
      if (examTypeFilter && exExamType.toLowerCase() !== examTypeFilter) continue;

      if (filterByTeacher) {
        const permClassUpper = normalizeClassForPermission(exClassRaw);
        const examClassNormLower = exClassNorm;
        const numOnly = function(s) { const m = String(s || '').match(/\d+/); return m ? m[0] : ''; };
        const examClassNum = numOnly(exClassRaw);

        const isClassTeacherForThis = teacherCtx.classTeacherFor.some(c => {
          const cNorm = normClass(c);
          const cNum = numOnly(c);
          return cNorm === examClassNormLower || (examClassNum && cNum === examClassNum);
        });

        const isAllowed = isClassTeacherForThis || teacherCtx.hasClassTeacherRole || userCanCreateExam(teacherEmail, permClassUpper, exSubject);
        if (!isAllowed) continue;
      }

      examMetaById[exId] = {
        examId: exId,
        classRaw: exClassRaw,
        classNorm: exClassNorm,
        subject: exSubject,
        examType: exExamType,
        examName: String(ex.examName || '').trim(),
        date: String(ex.date || '').trim(),
        createdAt: String(ex.createdAt || ex.date || '').trim()
      };
      examIds.push(exId);
    }

    if (examIds.length === 0) {
      return { success: true, exams: [] };
    }

    const examIdSet = new Set(examIds);

    // Build student sets per class
    const studentsSh = _getSheet('Students');
    _ensureHeaders(studentsSh, SHEETS.Students);
    const studentsHeaders = _headers(studentsSh);
    const studentsList = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders));

    /** @type {Object<string, Set<string>>} */
    const studentsByClass = {};
    for (const st of studentsList) {
      const clsNorm = normClass(st.class);
      const adm = normAdmNo(st.admNo);
      if (!clsNorm || !adm) continue;
      if (!studentsByClass[clsNorm]) studentsByClass[clsNorm] = new Set();
      studentsByClass[clsNorm].add(adm);
    }

    // Count entered marks per examId (unique students)
    const marksSh = _getSheet('ExamMarks');
    _ensureHeaders(marksSh, SHEETS.ExamMarks);
    const marksHeaders = _headers(marksSh);
    const marksList = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));

    /** @type {Object<string, Set<string>>} */
    const enteredByExamId = {};
    for (const mk of marksList) {
      const exId = String(mk.examId || '').trim();
      if (!exId || !examIdSet.has(exId)) continue;
      const meta = examMetaById[exId];
      if (!meta) continue;

      const adm = normAdmNo(mk.admNo);
      if (!adm) continue;

      const expectedSet = studentsByClass[meta.classNorm];
      if (!expectedSet || !expectedSet.has(adm)) continue;

      // Only count as entered if there are actual marks (not all zeros/empty)
      // Allow 'A' for absent, or any non-zero marks
      const ce = String(mk.ce ?? '').trim();
      const te = String(mk.te ?? '').trim();
      const total = String(mk.total ?? '').trim();
      
      const isAbsent = (te.toUpperCase() === 'A' || te.toUpperCase() === 'ABSENT');
      const hasActualMarks = (
        (ce !== '' && ce !== '0' && parseFloat(ce) > 0) ||
        (te !== '' && te !== '0' && parseFloat(te) > 0 && !isAbsent) ||
        isAbsent
      );
      
      if (!hasActualMarks) continue;

      if (!enteredByExamId[exId]) enteredByExamId[exId] = new Set();
      enteredByExamId[exId].add(adm);
    }

    const result = [];
    for (const exId of examIds) {
      const meta = examMetaById[exId];
      if (!meta) continue;
      const expectedSet = meta.classNorm ? (studentsByClass[meta.classNorm] || new Set()) : new Set();
      const enteredSet = enteredByExamId[exId] || new Set();
      const totalStudents = expectedSet.size;
      const enteredCount = enteredSet.size;
      const missingCount = Math.max(0, totalStudents - enteredCount);
      const complete = totalStudents > 0 && enteredCount >= totalStudents;

      result.push({
        examId: exId,
        class: meta.classRaw || '',
        subject: meta.subject || '',
        examType: meta.examType || '',
        examName: meta.examName || '',
        date: meta.date || '',
        createdAt: meta.createdAt || '',
        enteredCount,
        totalStudents,
        missingCount,
        complete
      });
    }

    // Sort: pending first, then by missingCount desc, then newest
    result.sort((a, b) => {
      const ap = (a.missingCount || 0) > 0 ? 1 : 0;
      const bp = (b.missingCount || 0) > 0 ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const am = Number(a.missingCount || 0);
      const bm = Number(b.missingCount || 0);
      if (am !== bm) return bm - am;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    const limited = (limit > 0) ? result.slice(0, limit) : result;
    return { success: true, exams: limited };
  } catch (error) {
    appLog('ERROR', 'getExamMarksEntryStatusAll', 'Error: ' + error.message);
    return { success: false, exams: [], error: error.message };
  }
}

/**
 * Get ONLY pending exams (missingCount > 0). If marks are fully entered for a class+subject exam, pending becomes 0.
 *
 * @param {{class?:string, examType?:string, subject?:string, limit?:number, teacherEmail?:string, role?:string}=} params
 */
function getExamMarksEntryPending(params) {
  const res = getExamMarksEntryStatusAll(params || {});
  if (!res || !res.success) return res;
  const pending = (res.exams || []).filter(r => (r.totalStudents || 0) > 0 && (r.missingCount || 0) > 0);
  return { success: true, pending: pending };
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
    
    // Find boundaries for this standard group - normalize labels ('Std 9-12' vs '9-12')
    const normalizeGroup = g => String(g || '')
      .toLowerCase()
      .replace(/std\s*/g, '')
      .replace(/\s+/g, '')
      .trim();
    const targetGroup = normalizeGroup(standardGroup);
    const applicableBoundaries = boundaries.filter(b => normalizeGroup(b.standardGroup) === targetGroup);
    
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
 * Get the lowest grade label applicable for a class's standard group.
 * Used to represent Absent as a fail grade in report cards.
 * Preference: use the lowest boundary grade; fallback to 'E'.
 */
function _getLeastGradeForClass(className) {
  try {
    const standardGroup = _standardGroup(className);

    const gbSh = _getSheet('GradeBoundaries');
    _ensureHeaders(gbSh, SHEETS.GradeBoundaries);
    const gbHeaders = _headers(gbSh);
    const boundaries = _rows(gbSh).map(r => _indexByHeader(r, gbHeaders));

    const normalizeGroup = g => String(g || '')
      .toLowerCase()
      .replace(/std\s*/g, '')
      .replace(/\s+/g, '')
      .trim();
    const targetGroup = normalizeGroup(standardGroup);
    const applicable = boundaries.filter(b => normalizeGroup(b.standardGroup) === targetGroup);

    if (applicable.length > 0) {
      // Sort by minPercentage ascending to get the lowest grade band
      applicable.sort((a, b) => (Number(a.minPercentage) || 0) - (Number(b.minPercentage) || 0));
      const lowest = applicable[0];
      return lowest.grade || 'E';
    }

    // If no boundaries configured, prefer 'E' as the least grade label
    return 'E';
  } catch (error) {
    Logger.log(`[Lowest Grade ERROR] ${error.toString()}`);
    return 'E';
  }
}

/**
 * Determine standard group for grade boundaries
 */
function _standardGroup(cls) {
  const cleanClass = String(cls || '').replace(/[^0-9]/g, '');
  const classNum = parseInt(cleanClass) || 0;
  
  if (classNum >= 1 && classNum <= 4) {
    return '1-4';
  } else if (classNum >= 5 && classNum <= 8) {
    return '5-8';
  } else if (classNum >= 9 && classNum <= 12) {
    return '9-12';  // Combined group for classes 9-12
  }
  
  return 'Default';
}

/**
 * Check if a class has internal marks
 */
function _classHasInternalMarks(cls) {
  const standardGroup = _standardGroup(cls);
  return ['9-12'].includes(standardGroup);  // Use combined group
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

/** * Get subjects for a specific class from ClassSubjects sheet
 * Falls back to Timetable if ClassSubjects not found
 */
function getClassSubjects(className) {
  try {
    appLog('INFO', 'getClassSubjects', 'Fetching subjects for class: ' + className);
    
    if (!className) {
      return { success: false, error: 'Class name is required' };
    }
    
    // Try to get from ClassSubjects sheet first
    const classSubjectsSh = _getSheet('ClassSubjects');
    appLog('INFO', 'getClassSubjects', 'ClassSubjects sheet found: ' + (classSubjectsSh ? 'Yes' : 'No'));
    
    if (classSubjectsSh && classSubjectsSh.getLastRow() > 1) {
      const headers = _headers(classSubjectsSh);
      const rows = _rows(classSubjectsSh).map(r => _indexByHeader(r, headers));
      
      appLog('INFO', 'getClassSubjects', 'ClassSubjects rows found: ' + rows.length);
      appLog('INFO', 'getClassSubjects', 'Headers: ' + JSON.stringify(headers));
      
      // Find matching class (case-insensitive, flexible matching)
      const normalizedClass = String(className).trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
      appLog('INFO', 'getClassSubjects', 'Normalized class: ' + normalizedClass);
      
      // Check if sheet has 'subjects' (comma-separated) or 'subject' (one per row) column
      const hasSubjectsColumn = headers.includes('subjects');
      const hasSubjectColumn = headers.includes('subject');
      
      appLog('INFO', 'getClassSubjects', 'Has subjects column: ' + hasSubjectsColumn + ', Has subject column: ' + hasSubjectColumn);
      
      if (hasSubjectsColumn) {
        // Denormalized format: one row per class with comma-separated subjects
        const classRow = rows.find(row => {
          const rowClass = String(row.class || '').trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
          return rowClass === normalizedClass;
        });
        
        if (classRow && classRow.subjects) {
          appLog('INFO', 'getClassSubjects', 'Found matching row (denormalized), subjects raw: ' + classRow.subjects);
          
          const subjects = String(classRow.subjects)
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          
          appLog('INFO', 'getClassSubjects', 'Final subjects: ' + JSON.stringify(subjects));
          
          return { 
            success: true, 
            subjects: subjects,
            source: 'ClassSubjects',
            count: subjects.length
          };
        }
      } else if (hasSubjectColumn) {
        // Normalized format: one row per class-subject pair
        const subjects = [];
        
        rows.forEach(row => {
          const rowClass = String(row.class || '').trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
          if (rowClass === normalizedClass && row.subject) {
            const subj = String(row.subject).trim();
            if (subj && !subjects.includes(subj)) {
              subjects.push(subj);
            }
          }
        });
        
        if (subjects.length > 0) {
          appLog('INFO', 'getClassSubjects', 'Found ' + subjects.length + ' subjects (normalized format)');
          appLog('INFO', 'getClassSubjects', 'Final subjects: ' + JSON.stringify(subjects));
          
          return { 
            success: true, 
            subjects: subjects,
            source: 'ClassSubjects',
            count: subjects.length
          };
        }
      }
      
      appLog('WARN', 'getClassSubjects', 'No matching subjects found in ClassSubjects, falling back to Timetable');
    } else {
      appLog('WARN', 'getClassSubjects', 'ClassSubjects sheet not available or empty, falling back to Timetable');
    }
    
    // Fallback: Get from Timetable
    appLog('INFO', 'getClassSubjects', 'Fetching from Timetable as fallback');
    const timetableSh = _getSheet('Timetable');
    const timetableHeaders = _headers(timetableSh);
    const timetableRows = _rows(timetableSh).map(r => _indexByHeader(r, timetableHeaders));
    
    const normalizedClass = String(className).trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
    const subjects = new Set();
    
    timetableRows.forEach(row => {
      const rowClass = String(row.class || '').trim().toLowerCase().replace(/std\s*/gi, '').replace(/\s+/g, '');
      if (rowClass === normalizedClass && row.subject) {
        subjects.add(String(row.subject).trim());
      }
    });
    
    appLog('INFO', 'getClassSubjects', 'Timetable subjects: ' + JSON.stringify(Array.from(subjects)));
    
    return { 
      success: true, 
      subjects: Array.from(subjects),
      source: 'Timetable'
    };
    
  } catch (err) {
    appLog('ERROR', 'getClassSubjects', 'Exception: ' + err.message);
    return { 
      success: false, 
      error: 'Failed to get class subjects: ' + err.message 
    };
  }
}

/** * Get grade boundaries
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
 * Get students for multiple classes in one call (batch operation)
 * Performance: Reduces N API calls to 1 call
 * @param {Array} classes - Array of class names
 * @returns {Object} Object with class names as keys and student arrays as values
 */
function getStudentsBatch(classes) {
  try {
    const sh = _getSheet('Students');
    _ensureHeaders(sh, SHEETS.Students);
    const headers = _headers(sh);
    const allStudents = _rows(sh).map(r => _indexByHeader(r, headers));
    
    const result = {};
    
    if (!Array.isArray(classes)) {
      Logger.log('getStudentsBatch: classes parameter is not an array');
      return result;
    }
    
    // Normalize class names for comparison
    const normalizeClass = function(cls) {
      return String(cls || '').replace(/^std\s*/i, '').trim().toLowerCase();
    };
    
    classes.forEach(function(cls) {
      const normalized = normalizeClass(cls);
      result[cls] = allStudents.filter(function(s) {
        return normalizeClass(s.class) === normalized;
      });
    });
    
    Logger.log(`getStudentsBatch: Returned students for ${classes.length} classes`);
    
    return result;
  } catch (error) {
    Logger.log('Error in getStudentsBatch: ' + error.message);
    return {};
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
            const teStr = String(mark.te || '').trim().toUpperCase();
            const isAbsent = (teStr === 'A' || teStr === 'ABSENT' || String(mark.grade || '').trim().toUpperCase() === 'ABSENT');
            const teNumParsed = parseInt(mark.te);
            const teNum = isNaN(teNumParsed) ? 0 : teNumParsed;
            const totalFromSheet = Number(mark.total || 0);

            // Direct assignment: ce is internal, te is external (unless Absent)
            let internal = ce;
            let external = isAbsent ? 0 : teNum;

            // If total exists but ce and te are both 0 (and not Absent), use the stored total
            // This handles legacy data where only total was stored
            if (!isAbsent && totalFromSheet > 0 && ce === 0 && teNum === 0) {
              // For backward compatibility, treat legacy total as external marks
              external = totalFromSheet;
              internal = 0;
            }

            const total = internal + external;
            const examMax = Number(exam.totalMax || exam.internalMax + exam.externalMax || 100);

            const perc = examMax > 0 ? ((total / examMax) * 100) : 0;
            const hasInternalMarks = _classHasInternalMarks(student.class);
            const gradeLabel = isAbsent ? _getLeastGradeForClass(student.class) : _calculateGradeFromBoundaries(perc, student.class);

            Logger.log(`  Subject ${exam.subject}: ce=${ce}, te=${isAbsent ? 'A' : teNum}, internal=${internal}, external=${external}, total=${total}, max=${examMax}, percentage=${examMax > 0 ? (perc.toFixed(2)) : 0}%, grade=${gradeLabel}${isAbsent ? ' (Absent treated as fail)' : ''}`);

            // IMPORTANT: Use 'ce' and 'te' property names to match frontend expectations
            subjects[exam.subject] = {
              ce: hasInternalMarks ? internal : null,
              te: isAbsent ? 'A' : external,
              internal: hasInternalMarks ? internal : null,
              external: external,
              total: total,
              maxMarks: examMax,
              percentage: Math.round(perc),
              grade: gradeLabel,
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
    
    // Calculate performance for each student with term-wise breakdown
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
              percentage: 0,
              terms: {}  // Add term-wise breakdown
            };
          }
          
          // Add term-wise data
          if (!subjectPerformance[exam.subject].terms[exam.examType]) {
            subjectPerformance[exam.subject].terms[exam.examType] = {
              marks: total,
              maxMarks: examMax,
              percentage: examMax > 0 ? Math.round((total / examMax) * 100) : 0
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

/**
 * DEBUG FUNCTION: Test ClassSubjects sheet reading
 * Run this manually to see what's in the ClassSubjects sheet
 */
function testClassSubjects() {
  try {
    const sh = _getSheet('ClassSubjects');
    if (!sh) {
      Logger.log('❌ ClassSubjects sheet not found!');
      return;
    }
    
    Logger.log('✅ ClassSubjects sheet found');
    Logger.log('Last row: ' + sh.getLastRow());
    
    const headers = _headers(sh);
    const rows = _rows(sh).map(r => _indexByHeader(r, headers));
    
    Logger.log('Total rows: ' + rows.length);
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    // Test the actual getClassSubjects function
    Logger.log('\n=== Testing getClassSubjects("10A") ===');
    const result = getClassSubjects('10A');
    Logger.log('Result: ' + JSON.stringify(result));
    
    return result;
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * TEST ENDPOINT: Direct API test for getClassSubjects
 * Call this from the frontend to bypass any caching
 */
function testGetClassSubjectsAPI() {
  return getClassSubjects('10A');
}