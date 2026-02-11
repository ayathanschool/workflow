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
    teacherName: params.teacherName,
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
  
  // Get teacher information from ClassSubjects sheet
  const csSh = _getSheet('ClassSubjects');
  const csHeaders = _headers(csSh);
  const classSubjects = _rows(csSh).map(r => _indexByHeader(r, csHeaders));
  
  // Build a map of class+subject to teacher name for quick lookup
  const teacherMap = {};
  classSubjects.forEach(row => {
    const cls = normClass(row.class);
    const subj = normText(row.subject);
    const key = cls + '|' + subj;
    
    // Try multiple possible column names for teacher
    const teacher = row.teacherName || row.teacher || row.Teacher || row.TeacherName || row['Teacher Name'] || '';
    
    if (!teacherMap[key] && teacher) {
      teacherMap[key] = teacher;
    }
  });
  
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
  
  // Enrich each exam with teacher info from ClassSubjects
  filtered = filtered.map(exam => {
    const key = normClass(exam.class) + '|' + normText(exam.subject);
    const teacherName = teacherMap[key];
    
    return {
      ...exam,
      teacherName: teacherName || exam.creatorName || '',
      teacherEmail: exam.creatorEmail || ''
    };
  });
  
  // Filter by teacher name if provided (after enrichment)
  if (params.teacherName) {
    const target = normText(params.teacherName);
    filtered = filtered.filter(exam => normText(exam.teacherName) === target);
  }
  
  return filtered;
}

/**
 * Submit exam marks for students
 */
function submitExamMarks(data) {
  const __t0 = Date.now();
  const __timings = {};
  const __mark = function(k) {
    __timings[k] = Date.now() - __t0;
  };

  const examId = data.examId || '';
  const marks = Array.isArray(data.marks) ? data.marks : [];
  const teacherEmail = String(data.teacherEmail || data.email || '').toLowerCase().trim();
  
  if (!examId) return { error: 'Missing examId' };
  if (marks.length === 0) return { error: 'No marks data provided' };
  if (!teacherEmail) return { error: 'Missing teacherEmail' };
  __mark('validated');

  // Helper: find all matching row numbers for an exact value in a column.
  // Uses TextFinder (server-side) to avoid pulling full columns into JS.
  const _findAllRowsByExactMatch_ = function(sh, col1, target) {
    try {
      const lastRow = sh.getLastRow();
      if (lastRow < 2) return [];
      const rowCount = lastRow - 1;
      const range = sh.getRange(2, col1, rowCount, 1);
      const matches = range.createTextFinder(String(target)).matchEntireCell(true).findAll();
      if (!matches || matches.length === 0) return [];
      return matches.map(function(r) { return r.getRow(); });
    } catch (e) {
      return [];
    }
  };
  
  // Get exam details
  const examSh = _getSheet('Exams');
  const examHeaders = _headers(examSh);
  // PERF: avoid mapping all exams; fetch only the target row.
  const examExamIdCol = examHeaders.indexOf('examId') + 1;
  let exam = null;
  if (examExamIdCol > 0 && examSh.getLastRow() >= 2) {
    const rowCount = examSh.getLastRow() - 1;
    const rng = examSh.getRange(2, examExamIdCol, rowCount, 1);
    const found = rng.createTextFinder(String(examId)).matchEntireCell(true).findNext();
    if (found) {
      const rowValues = examSh.getRange(found.getRow(), 1, 1, examHeaders.length).getValues()[0];
      exam = _indexByHeader(rowValues, examHeaders);
    }
  }
  
  if (!exam) return { error: 'Exam not found' };
  __mark('examLookup');

  // Permission check for marks submission:
  // 1. Super Admin - allowed for all
  // 2. HM - allowed for all
  // 3. Class Teacher for this class - allowed for ALL subjects in their class
  // 4. Subject Teacher - allowed if they teach this subject in this class
  
  const isSuperAdmin = _isSuperAdminSafe(teacherEmail);
  if (!isSuperAdmin) {
    // Get user details
    const userSh = _getSheet('Users');
    const userHeaders = _headers(userSh);
    // PERF: avoid mapping all users; fetch only the matching user row.
    const emailCol = userHeaders.indexOf('email') + 1;
    let user = null;
    if (emailCol > 0 && userSh.getLastRow() >= 2) {
      const urc = userSh.getLastRow() - 1;
      const ur = userSh.getRange(2, emailCol, urc, 1)
        .createTextFinder(String(teacherEmail))
        .matchEntireCell(true)
        .findNext();
      if (ur) {
        const userRowValues = userSh.getRange(ur.getRow(), 1, 1, userHeaders.length).getValues()[0];
        user = _indexByHeader(userRowValues, userHeaders);
      }
    }
    
    if (!user) {
      appLog('ERROR', 'submitExamMarks', 'User not found: ' + teacherEmail);
      return { error: 'User not found. Please contact administrator.' };
    }
    __mark('userLookup');
    
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
      
      if (isClassTeacher || hasClassTeacherRole) {
      } else {
        // Check if subject teacher for this class+subject combination
        const hasPermission = userCanCreateExam(teacherEmail, String(exam.class || ''), String(exam.subject || ''));
        if (!hasPermission) {
          appLog('ERROR', 'submitExamMarks', 'Permission denied for ' + teacherEmail + ' on ' + exam.class + ' ' + exam.subject);
          return { error: 'You do not have permission to submit marks for this exam. Only HM, Class Teachers, or Subject Teachers can submit marks.' };
        }
      }
    }
  }
  __mark('permissionCheck');
  
  const marksSh = _getSheet('ExamMarks');
  _ensureHeaders(marksSh, SHEETS.ExamMarks);
  const now = new Date().toISOString();
  __mark('sheetReady');
  
  // PERFORMANCE: build a fast index of existing marks rows for this examId+admNo
  const marksHeaders = _headers(marksSh);
  const examIdCol = marksHeaders.indexOf('examId') + 1;
  const admNoCol = marksHeaders.indexOf('admNo') + 1;
  const colCount = SHEETS.ExamMarks.length;

  const existingRowByKey = {};
  let existingBlock = null;
  let existingBlockStartRow = 0;
  let existingBlockRowCount = 0;
  if (examIdCol > 0 && admNoCol > 0 && marksSh.getLastRow() >= 2) {
    const target = String(examId).trim();
    const lastRowAll = marksSh.getLastRow();
    const rowCountAll = lastRowAll - 1;

    // Strategy:
    // 1) Try TextFinder first to locate matching rows for this examId.
    //    This is very fast when marks for an exam are stored contiguously (common case).
    // 2) Only fall back to scanning the whole sheet (2 columns) if matches are not found or are extremely sparse.
    const rows = _findAllRowsByExactMatch_(marksSh, examIdCol, target);
    if (rows.length > 0) {
      var minRow = rows[0];
      var maxRow = rows[0];
      for (var r = 1; r < rows.length; r++) {
        if (rows[r] < minRow) minRow = rows[r];
        if (rows[r] > maxRow) maxRow = rows[r];
      }

      const span = (maxRow - minRow) + 1;
      const isDense = span <= (rows.length * 2 + 10);
      const canRewriteBlock = isDense && span <= 800;

      // If the matches are very sparse, reading the whole [min..max] block is expensive.
      // In that case, fall back to scanning 2 columns across the sheet.
      const isVerySparse = span > (rows.length * 6 + 50) || span > 2000;
      if (!isVerySparse) {
        const block = marksSh.getRange(minRow, 1, span, colCount).getValues();
        const exIdx = examIdCol - 1;
        const admIdx = admNoCol - 1;

        for (var j = 0; j < block.length; j++) {
          if (String(block[j][exIdx] || '').trim() !== target) continue;
          const adm3 = String(block[j][admIdx] || '').trim();
          if (!adm3) continue;
          existingRowByKey[target + '|' + adm3] = minRow + j;
        }

        if (canRewriteBlock) {
          existingBlock = block;
          existingBlockStartRow = minRow;
          existingBlockRowCount = span;
        }
      } else {
        // Sparse rows: scan only examId+admNo across the full sheet.
        const startCol = Math.min(examIdCol, admNoCol);
        const endCol = Math.max(examIdCol, admNoCol);
        const width = endCol - startCol + 1;
        const block2 = marksSh.getRange(2, startCol, rowCountAll, width).getValues();
        const exIdx2 = examIdCol - startCol;
        const admIdx2 = admNoCol - startCol;
        for (var i = 0; i < rowCountAll; i++) {
          if (String(block2[i][exIdx2] || '').trim() !== target) continue;
          const adm = String(block2[i][admIdx2] || '').trim();
          if (!adm) continue;
          existingRowByKey[target + '|' + adm] = i + 2;
        }
      }
    } else {
      // No TextFinder matches (unexpected). Fall back to scanning 2 columns.
      const startCol3 = Math.min(examIdCol, admNoCol);
      const endCol3 = Math.max(examIdCol, admNoCol);
      const width3 = endCol3 - startCol3 + 1;
      const block3 = marksSh.getRange(2, startCol3, rowCountAll, width3).getValues();
      const exIdx3 = examIdCol - startCol3;
      const admIdx3 = admNoCol - startCol3;
      for (var k = 0; k < rowCountAll; k++) {
        if (String(block3[k][exIdx3] || '').trim() !== target) continue;
        const adm2 = String(block3[k][admIdx3] || '').trim();
        if (!adm2) continue;
        existingRowByKey[target + '|' + adm2] = k + 2;
      }
    }
  }
  __mark('existingIndex');

  const totalMax = (function() {
    const n = Number(exam.totalMax);
    if (Number.isFinite(n) && n > 0) return n;
    const im = Number(exam.internalMax) || 0;
    const em = Number(exam.externalMax) || 0;
    return (im + em) || 100;
  })();

  const updates = []; // { rowIndex:number, values:any[] }
  const inserts = []; // any[][]

  // Process each student's marks
  for (const studentMark of marks) {
    // Accept both ce/te (old) and internal/external (new) field names
    let ce = parseInt(studentMark.ce ?? studentMark.internal, 10);
    if (isNaN(ce)) ce = 0;

    const rawExternal = (studentMark.te ?? studentMark.external);
    const extStr = String(rawExternal || '').trim().toUpperCase();
    const isAbsent = extStr === 'A' || extStr === 'ABSENT';

    let teStored;
    let total;
    let grade;

    if (isAbsent) {
      teStored = 'A';
      total = ce;
      grade = 'Absent';
    } else {
      const teNum = parseInt(rawExternal, 10) || 0;
      teStored = teNum;
      total = ce + teNum;
      const percentage = totalMax > 0 ? (total / totalMax) * 100 : 0;
      grade = _calculateGradeFromBoundaries(percentage, exam.class);
    }

    const adm = String(studentMark.admNo || '').trim();
    const key = String(examId) + '|' + adm;

    const markData = [
      examId,
      exam.class,
      exam.subject,
      data.teacherEmail || '',
      data.teacherName || '',
      adm,
      studentMark.studentName || '',
      exam.examType,
      ce,
      teStored,
      total,
      grade,
      now
    ];

    const existingRow = existingRowByKey[key] || 0;
    if (existingRow) {
      updates.push({ rowIndex: existingRow, values: markData });
    } else {
      inserts.push(markData);
    }
  }
  __mark('preparedRows');

  // Batch update existing rows (group contiguous ranges to reduce API calls)
  if (updates.length > 0) {
    // Fast path: if we have the existing rows loaded as one block, update it in-memory and write once.
    if (existingBlock && existingBlockStartRow > 0 && existingBlockRowCount > 0) {
      for (var u = 0; u < updates.length; u++) {
        const rel = updates[u].rowIndex - existingBlockStartRow;
        if (rel >= 0 && rel < existingBlock.length) {
          existingBlock[rel] = updates[u].values;
        }
      }
      marksSh.getRange(existingBlockStartRow, 1, existingBlock.length, colCount).setValues(existingBlock);
    } else {
    updates.sort(function(a, b) { return a.rowIndex - b.rowIndex; });
    let start = 0;
    while (start < updates.length) {
      let end = start;
      while (end + 1 < updates.length && updates[end + 1].rowIndex === updates[end].rowIndex + 1) {
        end++;
      }
      const firstRow = updates[start].rowIndex;
      const rows = (end - start) + 1;
      const block = [];
      for (var j = start; j <= end; j++) block.push(updates[j].values);
      marksSh.getRange(firstRow, 1, rows, colCount).setValues(block);
      start = end + 1;
    }
    }
  }
  __mark('updatedRows');

  // Batch append new rows
  if (inserts.length > 0) {
    const appendAt = marksSh.getLastRow() + 1;
    marksSh.getRange(appendAt, 1, inserts.length, colCount).setValues(inserts);
  }
  __mark('insertedRows');

  // Clear the specific getExamMarks cache key so UI reflects changes immediately
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(generateCacheKey('exam_marks', { examId: examId }));
  } catch (ee) {
    // ignore cache clear errors
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
  __mark('auditLogged');
  
  return { ok: true, timingsMs: __timings };
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

  // PERF: avoid reading the entire ExamMarks sheet for a single exam.
  const examIdCol = headers.indexOf('examId') + 1;
  const lastRow = sh.getLastRow();
  if (examIdCol <= 0 || lastRow < 2) return [];

  const target = String(examId || '').trim();
  const rowCount = lastRow - 1;
  const range = sh.getRange(2, examIdCol, rowCount, 1);
  let matches = [];
  try {
    matches = range.createTextFinder(target).matchEntireCell(true).findAll();
  } catch (e) {
    matches = [];
  }
  if (!matches || matches.length === 0) return [];

  var minRow = matches[0].getRow();
  var maxRow = matches[0].getRow();
  for (var m = 1; m < matches.length; m++) {
    const rr = matches[m].getRow();
    if (rr < minRow) minRow = rr;
    if (rr > maxRow) maxRow = rr;
  }

  const block = sh.getRange(minRow, 1, (maxRow - minRow) + 1, headers.length).getValues();
  const out = [];
  const exIdx = examIdCol - 1;
  for (var r = 0; r < block.length; r++) {
    if (String(block[r][exIdx] || '').trim() !== target) continue;
    out.push(_indexByHeader(block[r], headers));
  }
  return out;
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
      // PERF: fetch only the matching user row.
      const emailCol = userHeaders.indexOf('email') + 1;
      let user = null;
      if (emailCol > 0 && userSh.getLastRow() >= 2) {
        const rc = userSh.getLastRow() - 1;
        const found = userSh.getRange(2, emailCol, rc, 1)
          .createTextFinder(String(teacherEmail))
          .matchEntireCell(true)
          .findNext();
        if (found) {
          const rowValues = userSh.getRange(found.getRow(), 1, 1, userHeaders.length).getValues()[0];
          user = _indexByHeader(rowValues, userHeaders);
        }
      }
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
    const examMetaById = {};
    // PERF: fetch only the requested exam rows.
    const examIdCol = examsHeaders.indexOf('examId') + 1;
    if (examIdCol > 0 && examsSh.getLastRow() >= 2) {
      const rc = examsSh.getLastRow() - 1;
      const idRange = examsSh.getRange(2, examIdCol, rc, 1);

      for (const targetId of ids) {
        const found = idRange.createTextFinder(String(targetId)).matchEntireCell(true).findNext();
        if (!found) continue;
        const rowValues = examsSh.getRange(found.getRow(), 1, 1, examsHeaders.length).getValues()[0];
        const ex = _indexByHeader(rowValues, examsHeaders);

        const exId = String(ex.examId || '').trim();
        if (!exId || !idSet.has(exId)) continue;

        const exClassRaw = String(ex.class || '').trim();
        const exSubject = String(ex.subject || '').trim();

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
    }

    // Build student sets per class (only for involved classes)
    const studentsSh = _getSheet('Students');
    _ensureHeaders(studentsSh, SHEETS.Students);
    const studentsHeaders = _headers(studentsSh);
    const classNormSet = new Set(Object.keys(examMetaById).map(function(k) { return examMetaById[k].classNorm; }));
    /** @type {Object<string, Set<string>>} */
    const studentsByClass = {};
    const classCol = studentsHeaders.indexOf('class') + 1;
    const admCol = studentsHeaders.indexOf('admNo') + 1;
    const lastStudentRow = studentsSh.getLastRow();
    if (classCol > 0 && admCol > 0 && lastStudentRow >= 2 && classNormSet.size > 0) {
      const rc = lastStudentRow - 1;
      const classVals = studentsSh.getRange(2, classCol, rc, 1).getValues();
      const admVals = studentsSh.getRange(2, admCol, rc, 1).getValues();
      for (var i = 0; i < rc; i++) {
        const clsNorm = normClass(classVals[i][0]);
        if (!clsNorm || !classNormSet.has(clsNorm)) continue;
        const adm = normAdmNo(admVals[i][0]);
        if (!adm) continue;
        if (!studentsByClass[clsNorm]) studentsByClass[clsNorm] = new Set();
        studentsByClass[clsNorm].add(adm);
      }
    }

    // Count entered marks per examId (unique students)
    const marksSh = _getSheet('ExamMarks');
    _ensureHeaders(marksSh, SHEETS.ExamMarks);
    const marksHeaders = _headers(marksSh);
    /** @type {Object<string, Set<string>>} */
    const enteredByExamId = {};
    const marksExamIdCol = marksHeaders.indexOf('examId') + 1;
    const marksAdmCol = marksHeaders.indexOf('admNo') + 1;
    const ceCol = marksHeaders.indexOf('ce') + 1;
    const teCol = marksHeaders.indexOf('te') + 1;
    const totalCol = marksHeaders.indexOf('total') + 1;
    const marksLast = marksSh.getLastRow();
    if (marksExamIdCol > 0 && marksAdmCol > 0 && marksLast >= 2) {
      const rc = marksLast - 1;
      const idRange = marksSh.getRange(2, marksExamIdCol, rc, 1);

      for (const exId of ids) {
        const meta = examMetaById[exId];
        if (!meta) continue;
        const expectedSet = studentsByClass[meta.classNorm] || new Set();
        if (expectedSet.size === 0) continue;

        let matches = [];
        try {
          matches = idRange.createTextFinder(String(exId)).matchEntireCell(true).findAll();
        } catch (e) {
          matches = [];
        }
        if (!matches || matches.length === 0) continue;

        var minRow = matches[0].getRow();
        var maxRow = matches[0].getRow();
        for (var m = 1; m < matches.length; m++) {
          const rr = matches[m].getRow();
          if (rr < minRow) minRow = rr;
          if (rr > maxRow) maxRow = rr;
        }

        const block = marksSh.getRange(minRow, 1, (maxRow - minRow) + 1, marksHeaders.length).getValues();
        const exIdx = marksExamIdCol - 1;
        const admIdx = marksAdmCol - 1;
        const ceIdx = ceCol > 0 ? (ceCol - 1) : -1;
        const teIdx = teCol > 0 ? (teCol - 1) : -1;
        const totalIdx = totalCol > 0 ? (totalCol - 1) : -1;

        for (var i = 0; i < block.length; i++) {
          if (String(block[i][exIdx] || '').trim() !== String(exId)) continue;
          const adm = normAdmNo(block[i][admIdx]);
          if (!adm || !expectedSet.has(adm)) continue;

          const ce = (ceIdx >= 0) ? String(block[i][ceIdx] ?? '').trim() : '';
          const te = (teIdx >= 0) ? String(block[i][teIdx] ?? '').trim() : '';
          const total = (totalIdx >= 0) ? String(block[i][totalIdx] ?? '').trim() : '';
          const teU = te.toUpperCase();
          const isAbsent = (teU === 'A' || teU === 'ABSENT');
          const hasEntry = isAbsent || ce !== '' || te !== '' || total !== '';
          if (!hasEntry) continue;

          if (!enteredByExamId[exId]) enteredByExamId[exId] = new Set();
          enteredByExamId[exId].add(adm);
        }
      }
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
  const cacheKey = generateCacheKey('marks_entry_status_all', {
    class: (params || {}).class,
    examType: (params || {}).examType,
    subject: (params || {}).subject,
    limit: (params || {}).limit,
    teacherEmail: (params || {}).teacherEmail,
    role: (params || {}).role
  });
  return getCachedData(cacheKey, function() {
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

      // Count as entered if teacher has submitted a row for the student.
      // This must treat 0 as a valid score (entered), and treat 'A' as absent (entered).
      const ce = String(mk.ce ?? '').trim();
      const te = String(mk.te ?? '').trim();
      const total = String(mk.total ?? '').trim();
      
      const isAbsent = (te.toUpperCase() === 'A' || te.toUpperCase() === 'ABSENT');
      const hasEntry = isAbsent || ce !== '' || te !== '' || total !== '';
      
      if (!hasEntry) continue;

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
  }, CACHE_TTL.SHORT);
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
// PERFORMANCE NOTE
// Reading GradeBoundaries for every student is very expensive.
// Cache grade boundaries in-memory for the lifetime of the script execution.
var __GRADE_BOUNDARIES_INDEX__ = null; // { [normalizedGroup: string]: Array<{minPercentage:number,maxPercentage:number,grade:string}> }

function _normalizeStandardGroupLabel_(g) {
  return String(g || '')
    .toLowerCase()
    .replace(/std\s*/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function _getGradeBoundariesIndex_() {
  if (__GRADE_BOUNDARIES_INDEX__) return __GRADE_BOUNDARIES_INDEX__;
  __GRADE_BOUNDARIES_INDEX__ = {};

  try {
    const gbSh = _getSheet('GradeBoundaries');
    _ensureHeaders(gbSh, SHEETS.GradeBoundaries);
    const gbHeaders = _headers(gbSh);
    const rows = _rows(gbSh);
    const boundaries = rows.map(r => _indexByHeader(r, gbHeaders));

    for (const b of boundaries) {
      const groupKey = _normalizeStandardGroupLabel_(b.standardGroup);
      if (!groupKey) continue;

      const minP = Number(b.minPercentage);
      const maxP = (b.maxPercentage === '' || b.maxPercentage === null || b.maxPercentage === undefined)
        ? 100
        : Number(b.maxPercentage);

      const entry = {
        minPercentage: Number.isFinite(minP) ? minP : 0,
        maxPercentage: Number.isFinite(maxP) ? maxP : 100,
        grade: String(b.grade || '').trim()
      };

      if (!__GRADE_BOUNDARIES_INDEX__[groupKey]) __GRADE_BOUNDARIES_INDEX__[groupKey] = [];
      __GRADE_BOUNDARIES_INDEX__[groupKey].push(entry);
    }

    // Sort each group's boundaries by minPercentage descending (fast lookup from top grade)
    Object.keys(__GRADE_BOUNDARIES_INDEX__).forEach(k => {
      __GRADE_BOUNDARIES_INDEX__[k].sort((a, b) => (b.minPercentage || 0) - (a.minPercentage || 0));
    });
  } catch (e) {
    // Keep cache empty and allow fallback grading.
    try { appLog('WARN', 'gradeBoundariesCache', 'Failed to build cache: ' + (e && e.message ? e.message : e)); } catch (ee) {}
  }

  return __GRADE_BOUNDARIES_INDEX__;
}

function _calculateGradeFromBoundaries(percentage, className) {
  try {
    const standardGroup = _standardGroup(className);

    const targetGroup = _normalizeStandardGroupLabel_(standardGroup);
    const idx = _getGradeBoundariesIndex_();
    const applicable = idx[targetGroup] || [];

    if (!applicable || applicable.length === 0) {
      return _calculateGradeFallback(percentage);
    }

    const pct = Number(percentage);
    const safePct = Number.isFinite(pct) ? pct : 0;

    for (const boundary of applicable) {
      const minPercent = Number(boundary.minPercentage) || 0;
      const maxPercent = Number(boundary.maxPercentage);
      const maxP = Number.isFinite(maxPercent) ? maxPercent : 100;
      if (safePct >= minPercent && safePct <= maxP) {
        return boundary.grade || 'F';
      }
    }

    return 'F';
    
  } catch (error) {
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

    const targetGroup = _normalizeStandardGroupLabel_(standardGroup);
    const idx = _getGradeBoundariesIndex_();
    const applicable = idx[targetGroup] || [];

    if (applicable.length > 0) {
      // Boundaries are cached sorted DESC; the lowest grade is the last one.
      const lowest = applicable[applicable.length - 1];
      return (lowest && lowest.grade) ? lowest.grade : 'E';
    }

    // If no boundaries configured, prefer 'E' as the least grade label
    return 'E';
  } catch (error) {
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
    
    return result;
  } catch (error) {
    return {};
  }
}

/**
 * Get student report card data for an exam type
 * Returns exam results for students, used by ReportCard component
 */
function getStudentReportCard(examType, admNo = '', cls = '') {
  try {
    // Normalize class values for comparisons only.
    // This avoids mismatches like "STD 4A" vs "4A" without altering stored data.
    const _normClassForReportCard = function (v) {
      return String(v || '')
        .toLowerCase()
        .trim()
        .replace(/^std\s*/i, '')
        .replace(/\s+/g, '');
    };
    const _clsNorm = cls ? _normClassForReportCard(cls) : '';
    
    // Get exams of this type
    const examSh = _getSheet('Exams');
    const examHeaders = _headers(examSh);
    const exams = _rows(examSh).map(r => _indexByHeader(r, examHeaders))
      .filter(exam => {
        const typeMatch = !examType || String(exam.examType || '').toLowerCase() === String(examType).toLowerCase();
        const classMatch = !_clsNorm || _normClassForReportCard(exam.class) === _clsNorm;
        return typeMatch && classMatch;
      });
    
    // Get marks for these exams
    const marksSh = _getSheet('ExamMarks');
    const marksHeaders = _headers(marksSh);
    const allMarks = _rows(marksSh).map(r => _indexByHeader(r, marksHeaders));
    
    // Get students
    const studentsSh = _getSheet('Students');
    const studentsHeaders = _headers(studentsSh);
    const students = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders))
      .filter(student => {
        const classMatch = !_clsNorm || _normClassForReportCard(student.class) === _clsNorm;
        const admNoMatch = !admNo || String(student.admNo || '') === String(admNo);
        return classMatch && admNoMatch;
      });
    
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
    
    return reportData;
    
  } catch (error) {
    return { students: [], exams: [], examType: examType, class: cls };
  }
}

/**
 * Get attendance data for a specific class and date
 */
function getAttendance(cls, date) {
  try {
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
    return { success: false, error: error.message, students: [] };
  }
}

/**
 * Get student performance analytics for a specific class
 */
function getStudentPerformance(cls) {
  try {
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
    // Get ExamMarks sheet
    const marksSh = _getSheet('ExamMarks');
    const headers = _headers(marksSh);
    const data = marksSh.getDataRange().getValues();
    
    if (data.length <= 1) {
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
      }
    }
    return {
      success: true,
      message: `Successfully recalculated grades`,
      totalRecords: data.length - 1,
      updated: updatedCount,
      unchanged: (data.length - 1) - updatedCount
    };
    
  } catch (error) {
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
// testClassSubjects() removed (debug-only).
// testGetClassSubjectsAPI() removed (debug-only).