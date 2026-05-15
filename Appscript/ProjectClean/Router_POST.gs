/**
 * ============================================================
 * POST Route Handlers  (Router_POST.gs)
 * ============================================================
 * Each _routePost*_ function handles one domain of POST actions.
 * Returns a ContentService response if the action is handled,
 * or null to let the next handler try.
 *
 * doPost() in Main.gs is the thin dispatcher that chains these.
 * ============================================================
 */

// ─── System: bootstrap ────────────────────────────────────────────────────────
  function _routePostSystem_(action, data, e) {
    // Run bootstrap ONLY when explicitly requested (bootstrap is expensive)
    if (action === 'admin.bootstrap') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      _bootstrapSheets();
      return _respond({ success: true, message: 'Bootstrap completed' });
    }
    return null;
  }

// ─── Authentication ───────────────────────────────────────────────────────────
  function _routePostAuth_(action, data, e) {
    if (action === 'googleLogin') {
      return handleGoogleLogin(data); // handleGoogleLogin already returns _respond(...)
    }

    if (action === 'auth.verify') {
      // Accept token from Authorization header (Bearer) or payload
      var authHeader = (e && e.parameter && e.parameter.Authorization) || (e && e.postData && e.postData.type && e.postData.contents && (e.postData.contents.match(/Authorization":"([^"]+)/) || [])[1]) || '';
      var bearer = '';
      try {
        // Also check raw headers if available via e.headers (not standard)
        bearer = String((e && e.headers && e.headers.Authorization) || '').trim();
      } catch (ee) { /* ignore */ }
      var token = String(data.token || '').trim();
      if (!token) {
        var hVal = String(authHeader || bearer || '').trim();
        if (/^Bearer\s+/i.test(hVal)) token = hVal.replace(/^Bearer\s+/i, '').trim();
      }
      if (!token) {
        return _respond({ success: false, error: 'Missing token' });
      }
      return _respond(verifyGoogleLogin(token));
    }

    return null;
  }

// ─── Admin Data (sheet read/write) ────────────────────────────────────────────
  function _routePostAdminData_(action, data, e) {
    // Additive endpoints to manage sheet data from the frontend.
    if (action === 'admin.listSheets') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_adminListSheets());
    }

    if (action === 'admin.getSheet') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_adminGetSheet(data.sheetName));
    }

    if (action === 'admin.appendRow') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_adminAppendRow(data.sheetName, data.row || {}, email, data.name || ''));
    }

    if (action === 'admin.updateRow') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_adminUpdateRow(data.sheetName, data.rowNumber, data.row || {}, email, data.name || ''));
    }

    if (action === 'admin.deleteRow') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_adminDeleteRow(data.sheetName, data.rowNumber, email, data.name || ''));
    }

    return null;
  }

// ─── Settings ─────────────────────────────────────────────────────────────────
  function _routePostSettings_(action, data, e) {
    if (action === 'updateAppSettings') {
      return _handleUpdateAppSettings(data);
    }
    return null;
  }

// ─── Exams ────────────────────────────────────────────────────────────────────
  function _routePostExams_(action, data, e) {
    if (action === 'createExam') {
      return _respond(createExam(data));
    }

    if (action === 'debugExamsSheet') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      // Debug endpoint to check Exams sheet state
      try {
        const sh = _getSheet('Exams');
        const headers = _headers(sh);
        const rows = _rows(sh);
        return _respond({
          sheetExists: true,
          sheetName: sh.getName(),
          lastRow: sh.getLastRow(),
          lastColumn: sh.getLastColumn(),
          headers: headers,
          rowCount: rows.length,
          sampleData: rows.slice(0, 3) // First 3 rows
        });
      } catch (err) {
        return _respond({ error: err.message, stack: err.stack });
      }
    }

    if (action === 'createBulkExams') {
      return _respond(createBulkExams(data));
    }

    if (action === 'updateExam') {
      return _respond(updateExam(data));
    }

    if (action === 'deleteExam') {
      // Admin only
      if (!_isAdminSafe(data.email)) {
        return _respond({ error: 'Permission denied. Admin access required to delete exams.' });
      }
      return _respond(deleteExam(data.examId));
    }

    if (action === 'submitExamMarks') {
      return _respond(submitExamMarks(data));
    }

    return null;
  }

// ─── Admin Management (users, reports, lesson plans, schemes) ─────────────────
  function _routePostAdminMgmt_(action, data, e) {
    if (action === 'deleteLessonPlan') {
      // Back-compat: allow Admin hard-delete; non-admin flows are handled later
      // via `_handleDeleteLessonPlan(data)` which enforces teacher ownership/status.
      if (_isAdminSafe(data.email)) {
        return _respond(deleteLessonPlan(data.lessonPlanId));
      }
      // Fall through: non-admin path handled in _routePostSchemes_
    }

    if (action === 'deleteScheme') {
      // Back-compat: allow Admin hard-delete; non-admin flows are handled later
      // via `_handleDeleteScheme(data)` which enforces teacher ownership/status.
      if (_isAdminSafe(data.email)) {
        return _respond(deleteScheme(data.schemeId));
      }
      // Fall through: non-admin path handled in _routePostSchemes_
    }

    if (action === 'deleteReport') {
      if (!_isAdminSafe(data.email)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(deleteReport(data.reportId));
    }

    if (action === 'addUser') {
      if (!_isAdminSafe(data.email)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(addUser(data));
    }

    if (action === 'updateUser') {
      if (!_isAdminSafe(data.email)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(updateUser(data));
    }

    if (action === 'deleteUser') {
      if (!_isAdminSafe(data.email)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(deleteUser(data.userEmail));
    }

    if (action === 'getAllUsers') {
      if (!_isHMOrAdminSafe(data.email || e.parameter.email)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getAllUsers());
    }

    return null;
  }

// ─── Audit Log ────────────────────────────────────────────────────────────────
  function _routePostAuditLog_(action, data, e) {
    if (action === 'getAuditLogs') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getAuditLogsForRequester(data.filters || {}, requesterEmail));
    }

    if (action === 'getEntityAuditTrail') {
      if (!_isHMOrAdminSafe(data.email || e.parameter.email)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getEntityAuditTrail(data.entityType, data.entityId));
    }

    if (action === 'getAuditSummary') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(getAuditSummaryForRequester(data.filters || {}, requesterEmail));
    }

    if (action === 'exportAuditLogs') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isHMOrAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. HM or Admin access required.' });
      }
      return _respond(exportAuditLogsForRequester(data.filters || {}, requesterEmail));
    }

    return null;
  }

// ─── Lesson Cascading (admin) ─────────────────────────────────────────────────
  function _routePostLessonCascade_(action, data, e) {
    if (action === 'getLessonsByDateRange') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond({ lessons: getLessonsByDateRange(data.startDate, data.endDate, data.filters || {}) });
    }

    if (action === 'cascadeSelectedLessons') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(cascadeSelectedLessons(data.lessonIds, data.mode, requesterEmail, data.name));
    }

    if (action === 'getRecentCascades') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond({ cascades: getRecentCascades(data.limit || 10) });
    }

    if (action === 'undoCascade') {
      const requesterEmail = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(requesterEmail)) {
        return _respond({ error: 'Permission denied. Admin access required.' });
      }
      return _respond(undoCascade(data.cascadeId, requesterEmail, data.name));
    }

    if (action === 'executeCascade') {
      return _respond(executeCascade(data));
    }

    return null;
  }

// ─── Substitutions (POST) ─────────────────────────────────────────────────────
  function _routePostSubstitutions_(action, data, e) {
    if (action === 'assignSubstitutionsBatch') {
      return _respond(assignSubstitutionsBatch(data));
    }

    if (action === 'assignSubstitution') {
      return _respond(assignSubstitution(data));
    }

    if (action === 'deleteSubstitution') {
      return _respond(deleteSubstitution(data));
    }

    if (action === 'acknowledgeSubstitution') {
      const notificationId = data.notificationId || '';
      const teacherEmail = (data.teacherEmail || '').toLowerCase().trim();
      return _respond(acknowledgeSubstitution(notificationId, teacherEmail));
    }

    if (action === 'getSubstitutionNotifications') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      return _respond(getSubstitutionNotifications(email));
    }

    if (action === 'acknowledgeSubstitutionNotification') {
      const notificationId = data.notificationId || '';
      const teacherEmail = (data.teacherEmail || '').toLowerCase().trim();
      return _respond(acknowledgeSubstitution(notificationId, teacherEmail));
    }

    if (action === 'acknowledgeSubstitutionAssignment') {
      return _respond(acknowledgeSubstitutionAssignment(data));
    }

    return null;
  }

// ─── Fund Collection & Expense Management ────────────────────────────────────
  function _routePostFundsExpense_(action, data, e) {
    if (action === 'createFundCollectionRequest') {
      return _respond(createFundCollectionRequest(data));
    }

    if (action === 'submitFundCollectionRequest') {
      return _respond(submitFundCollectionRequest(data.requestId));
    }

    if (action === 'updateFundCollectionRequest') {
      return _respond(updateFundCollectionRequest(data.requestId, data.updates));
    }

    if (action === 'approveFundRequest') {
      return _respond(approveFundRequest(data.requestId, data.approverEmail, data.approverNotes));
    }

    if (action === 'rejectFundRequest') {
      return _respond(rejectFundRequest(data.requestId, data.rejectorEmail, data.reason));
    }

    if (action === 'requestFundRevision') {
      return _respond(requestFundRevision(data.requestId, data.reviewerEmail, data.notes));
    }

    if (action === 'startFundCollection') {
      return _respond(startFundCollection(data.requestId, data.teacherEmail));
    }

    if (action === 'completeFundCollection') {
      return _respond(completeFundCollection(data.requestId, data.teacherEmail, data.collectedAmount, data.completionDate));
    }

    if (action === 'acknowledgeFundCollection') {
      return _respond(acknowledgeFundCollection(data.requestId, data.accountsEmail));
    }

    if (action === 'addFundDeposit') {
      return _respond(addFundDeposit(data.requestId, data.teacherEmail, data.depositAmount, data.depositDate, data.notes));
    }

    if (action === 'getFundDeposits') {
      return _respond(getFundDeposits(data.requestId));
    }

    if (action === 'acknowledgeFundDeposit') {
      return _respond(acknowledgeFundDeposit(data.depositId, data.accountsEmail));
    }

    if (action === 'markStudentPayment') {
      return _respond(markStudentPayment(data.paymentId, data.paidAmount, data.teacherEmail, data.notes || ''));
    }

    if (action === 'updateStudentPayment') {
      return _respond(updateStudentPayment(data.paymentId, data.paidAmount, data.notes || ''));
    }

    if (action === 'bulkMarkStudentPayments') {
      return _respond(bulkMarkStudentPayments(data.requestId, data.payments, data.teacherEmail));
    }

    if (action === 'deleteFundCollectionRequest') {
      return _respond(deleteFundCollectionRequest(data.requestId, data.teacherEmail));
    }

    if (action === 'adminDeleteFundCollectionRequest') {
      return _respond(adminDeleteFundCollectionRequest(data.requestId, data.adminEmail));
    }

    if (action === 'createExpenseRequest') {
      return _respond(createExpenseRequest(data));
    }

    if (action === 'submitExpenseRequest') {
      return _respond(submitExpenseRequest(data.requestId));
    }

    if (action === 'updateExpenseRequest') {
      return _respond(updateExpenseRequest(data.requestId, data.updates));
    }

    if (action === 'approveExpenseRequest') {
      return _respond(approveExpenseRequest(data.requestId, data.approverEmail, data.approverNotes));
    }

    if (action === 'rejectExpenseRequest') {
      return _respond(rejectExpenseRequest(data.requestId, data.rejectorEmail, data.reason));
    }

    if (action === 'disburseExpense') {
      return _respond(disburseExpense(data.requestId, data.accountsEmail, data.disbursementMode, data.disbursementReference));
    }

    if (action === 'deleteExpenseRequest') {
      return _respond(deleteExpenseRequest(data.requestId, data.teacherEmail));
    }

    if (action === 'adminDeleteExpenseRequest') {
      return _respond(adminDeleteExpenseRequest(data.requestId, data.adminEmail));
    }

    return null;
  }

// ─── Scheme Management ────────────────────────────────────────────────────────
  function _routePostSchemes_(action, data, e) {
    if (action === 'canSubmitNewScheme') {
      const gate = canSubmitNewScheme(data.email || data.teacherEmail, data.class, data.subject);
      return _respond({ success: true, allowed: gate.allowed, message: gate.message || '', reason: gate.reason || '' });
    }

    if (action === 'submitPlan') {
      return _handleSubmitScheme(data);
    }

    if (action === 'updatePlanStatus') {
      return _handleUpdateSchemeStatus(data);
    }

    if (action === 'deleteScheme') {
      return _handleDeleteScheme(data);
    }

    if (action === 'updateScheme') {
      return _handleUpdateScheme(data);
    }

    if (action === 'deleteLessonPlan') {
      return _handleDeleteLessonPlan(data);
    }

    return null;
  }

// ─── Daily Reports ────────────────────────────────────────────────────────────
  function _routePostDailyReports_(action, data, e) {
    if (action === 'submitDailyReport') {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
        appLog('INFO', 'submitDailyReport start', { version: 90 });
        appLog('DEBUG', 'payload', data);

        const sh = _getSheet('DailyReports');
        // Include id as first column to match configured schema and new UUID flow
        const headers = ['id', 'date', 'teacherEmail', 'teacherName', 'class', 'subject', 'schemeId', 'period', 'planType', 'lessonPlanId', 'chapter', 'sessionNo', 'totalSessions', 'completionPercentage', 'chapterStatus', 'deviationReason', 'difficulties', 'nextSessionPlan', 'objectives', 'activities', 'completed', 'notes', 'createdAt', 'isSubstitution', 'absentTeacher', 'regularSubject', 'substituteSubject'];
        _ensureHeaders(sh, headers);

        const reportDate = _normalizeQueryDate(data.date);
        const teacherEmail = String(data.teacherEmail || '').toLowerCase().trim();
        const reportClass = String(data.class || '').trim();
        const reportSubject = String(data.subject || '').trim();
        const reportPeriod = Number(data.period || 0);
        appLog('DEBUG', 'duplicateCheck params', { date: reportDate, email: teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod });

        // === DATE VALIDATION: Check backward and forward date limits ===
        try {
          const settings = _getCachedSettings();
          const today = _todayISO();
          const reportDateObj = _coerceToDate(reportDate);
          const todayObj = _coerceToDate(today);

          if (reportDateObj && todayObj) {
            // Calculate date difference in days
            const timeDiff = reportDateObj.getTime() - todayObj.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));

            appLog('DEBUG', 'Date validation', { reportDate, today, daysDiff });

            // Check backward date limit (negative daysDiff means past date)
            if (daysDiff < 0) {
              const allowBackfill = String(settings.allow_backfill_reporting || '').toUpperCase() === 'TRUE';
              const backwardLimit = parseInt(settings.dailyReportBackwardDaysLimit || '0');

              if (!allowBackfill) {
                appLog('WARN', 'Backward date rejected: backfill disabled', { reportDate, today });
                return _respond({
                  ok: false,
                  error: 'backfill_disabled',
                  message: 'Backfill reporting is disabled. You can only submit reports for today. Please contact admin if you need to report past dates.'
                });
              }

              // backwardLimit of 0 means unlimited when backfill is enabled
              if (backwardLimit > 0 && Math.abs(daysDiff) > backwardLimit) {
                appLog('WARN', 'Backward date rejected: exceeds limit', { reportDate, today, daysDiff, limit: backwardLimit });
                return _respond({
                  ok: false,
                  error: 'date_too_old',
                  message: `Cannot submit reports more than ${backwardLimit} day(s) in the past. Report date: ${reportDate}, Today: ${today}`
                });
              }
            }

            // Check forward date limit (positive daysDiff means future date)
            if (daysDiff > 0) {
              const forwardLimit = parseInt(settings.dailyReportForwardDaysLimit || '0');

              if (daysDiff > forwardLimit) {
                appLog('WARN', 'Forward date rejected: exceeds limit', { reportDate, today, daysDiff, limit: forwardLimit });
                return _respond({
                  ok: false,
                  error: 'date_too_far',
                  message: `Cannot submit reports more than ${forwardLimit} day(s) in the future. Report date: ${reportDate}, Today: ${today}`
                });
              }
            }

            appLog('INFO', 'Date validation passed', { reportDate, today, daysDiff });
          }
        } catch (dateErr) {
          appLog('ERROR', 'Date validation error', { error: dateErr.message });
          // Don't block submission if validation fails - log and continue
        }
        // === END DATE VALIDATION ===

        SpreadsheetApp.flush();
        const existingReports = _rows(sh).map(row => _indexByHeader(row, headers));
        appLog('DEBUG', 'existingReports count', { count: existingReports.length });

        const duplicate = existingReports.find(r => {
          const rDate = _isoDateIST(r.date);
          const rEmail = String(r.teacherEmail || '').toLowerCase().trim();
          const rClass = String(r.class || '').trim();
          const rSubject = String(r.subject || '').trim();
          const rPeriod = Number(r.period || 0);
          return rDate === reportDate && rEmail === teacherEmail && rClass === reportClass && rSubject === reportSubject && rPeriod === reportPeriod;
        });

        if (duplicate) {
          appLog('INFO', 'duplicate daily report', { duplicate: duplicate });
          return _respond({ ok: false, error: 'duplicate', message: 'Report already submitted for this period' });
        }

        // Enforce: a matching Ready/Approved lesson plan must exist for this period (unless valid substitution)
        const lpSheet = _getSheet('LessonPlans');
        const lpHeaders = _headers(lpSheet);
        const lessonPlans = _rows(lpSheet).map(row => _indexByHeader(row, lpHeaders));
        const isFetchableStatus = (s) => _isPlanReadyForTeacher(s);
        const matchingPlan = lessonPlans.find(p => {
          const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
          const dateMatch = _normalizeQueryDate(p.selectedDate || p.date) === reportDate;
          const periodMatch = String(p.selectedPeriod || p.period || '').trim() === String(reportPeriod);
          const classMatch = String(p.class || '').trim() === reportClass;
          const subjectMatch = String(p.subject || '').trim() === reportSubject;
          return emailMatch && dateMatch && periodMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
        });

        // Check if this is a valid substitution slot for the requester
        let isSubstitution = false;
        let subAbsentTeacher = '';
        let subRegularSubject = '';
        let subSubstituteSubject = '';
        try {
          const subSh = _getSheet('Substitutions');
          const subHeaders = _headers(subSh);
          const subs = _rows(subSh).map(r => _indexByHeader(r, subHeaders));
          const subRow = subs.find(s => {
            const dMatch = _normalizeQueryDate(s.date) === reportDate;
            const pMatch = String(s.period || '').trim() === String(reportPeriod);
            const classMatch = String(s.class || '').trim() === reportClass;
            const subTeacherMatch = String(s.substituteTeacher || '').toLowerCase().trim() === teacherEmail;
            return dMatch && pMatch && classMatch && subTeacherMatch;
          });
          if (subRow) {
            const regSubj = String(subRow.regularSubject || '').toLowerCase().trim();
            const subSubj = String(subRow.substituteSubject || '').toLowerCase().trim();
            const rptSubj = String(reportSubject || '').toLowerCase().trim();
            const subjOk = !rptSubj || rptSubj === regSubj || (subSubj && rptSubj === subSubj);
            if (subjOk) {
              isSubstitution = true;
              subAbsentTeacher = String(subRow.absentTeacher || '').trim();
              subRegularSubject = String(subRow.regularSubject || '').trim();
              subSubstituteSubject = String(subRow.substituteSubject || '').trim();
            }
          }
        } catch (subErr) {
          appLog('WARN', 'Substitution check failed', { error: subErr && subErr.message });
        }

        if (!matchingPlan && !isSubstitution) {
          appLog('WARN', 'Daily report blocked: no Ready lesson plan', { reportDate, reportPeriod, reportClass, reportSubject, teacherEmail });
          return _respond({ ok: false, error: 'plan_required', message: 'A Ready lesson plan is required for this period. Please prepare and get it approved before submitting the report.' });
        }

        // Optional: for substitution reports, allow attaching a Ready plan for the SAME teacher+class+subject
        // (teacher manually chooses a plan; not auto-cascade).
        let attachedPlan = null;
        try {
          const lpId = String(data.lessonPlanId || '').trim();
          if (isSubstitution && lpId) {
            attachedPlan = lessonPlans.find(p => {
              const idMatch = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim() === lpId;
              const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
              const classMatch = String(p.class || '').trim() === reportClass;
              const subjectMatch = String(p.subject || '').trim() === reportSubject;
              return idMatch && emailMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
            }) || null;
          }
        } catch (apErr) {
          attachedPlan = null;
        }

        // Objectives/methods: for substitution require a free-text answer; for planned, auto-fill if missing
        var objectivesVal = String(data.objectives || '').trim();
        var activitiesVal = String(data.activities || '').trim();
        if (isSubstitution) {
          // If a valid plan was attached, auto-fill from it when missing.
          if (attachedPlan) {
            if (!objectivesVal) objectivesVal = String(attachedPlan.learningObjectives || attachedPlan.objectives || '').trim();
            if (!activitiesVal) activitiesVal = String(attachedPlan.teachingMethods || attachedPlan.activities || '').trim();
          }
          if (!objectivesVal) {
            return _respond({ ok: false, error: 'sub_note_required', message: 'Please describe what you did in this substitution period (or select a lesson plan).' });
          }
        } else {
          if (!objectivesVal) objectivesVal = String(matchingPlan.learningObjectives || '').trim();
          if (!activitiesVal) activitiesVal = String(matchingPlan.teachingMethods || '').trim();
        }

        // Compute total sessions from scheme if available
        var totalSessionsVal = Number(data.totalSessions || 0);
        if (!isSubstitution && !totalSessionsVal && matchingPlan && matchingPlan.schemeId) {
          try {
            const schemeSheet = _getSheet('Schemes');
            const schemeHeaders = _headers(schemeSheet);
            const schemes = _rows(schemeSheet).map(row => _indexByHeader(row, schemeHeaders));
            const scheme = schemes.find(s => String(s.schemeId || '').trim() === String(matchingPlan.schemeId || '').trim());
            totalSessionsVal = Number(scheme && scheme.noOfSessions ? scheme.noOfSessions : 1);
          } catch (e3) {
            totalSessionsVal = 1;
          }
        }
        // For substitution with attached plan, allow total sessions from that plan/scheme as well.
        if (isSubstitution && attachedPlan) {
          if (!totalSessionsVal) {
            const directTs = Number(attachedPlan.totalSessions || attachedPlan.noOfSessions || 0);
            if (!isNaN(directTs) && directTs > 0) totalSessionsVal = directTs;
          }
          if (!totalSessionsVal && attachedPlan.schemeId) {
            try {
              const schemeSheet2 = _getSheet('Schemes');
              const schemeHeaders2 = _headers(schemeSheet2);
              const schemes2 = _rows(schemeSheet2).map(row => _indexByHeader(row, schemeHeaders2));
              const scheme2 = schemes2.find(s => String(s.schemeId || '').trim() === String(attachedPlan.schemeId || '').trim());
              totalSessionsVal = Number(scheme2 && scheme2.noOfSessions ? scheme2.noOfSessions : 1);
            } catch (e4) {
              // ignore
            }
          }
        }
        if (!totalSessionsVal) totalSessionsVal = 1;

        // Extract schemeId from matching plan or attached plan (needed for sequence validation)
        const reportSchemeId = String(data.schemeId || (!isSubstitution && matchingPlan && matchingPlan.schemeId) || (attachedPlan && attachedPlan.schemeId) || '').trim();

        // *** SESSION SEQUENCE VALIDATION ***
        // Enforce sequential reporting (no skipping sessions)
        // Use the existing lock from parent function to ensure atomicity
        // CRITICAL: Prioritize user's explicit draft values (data.*) over plan defaults
        const reportedChapter = String(data.chapter || (!isSubstitution && matchingPlan && matchingPlan.chapter) || (attachedPlan && attachedPlan.chapter) || '').trim();
        const reportedSession = Number(data.sessionNo || (!isSubstitution && matchingPlan && (matchingPlan.session || matchingPlan.sessionNo)) || (isSubstitution && attachedPlan && (attachedPlan.session || attachedPlan.sessionNo)) || 0);

        if (reportedChapter && reportedSession > 0 && totalSessionsVal > 0) {
          // Validation happens within the lock acquired at the start of submitDailyReport
          // This prevents race conditions during concurrent submissions
          const sequenceCheck = validateSessionSequence(teacherEmail, reportClass, reportSubject, reportedChapter, reportedSession, totalSessionsVal, reportSchemeId);
          if (!sequenceCheck.valid) {
            appLog('WARN', 'Session sequence violation', { attempted: reportedSession, expected: sequenceCheck.expectedSession, chapter: reportedChapter });
            return _respond({
              ok: false,
              error: 'session_sequence_violation',
              expectedSession: sequenceCheck.expectedSession,
              message: sequenceCheck.message
            });
          }
        }

        const now = new Date().toISOString();
        const reportId = _uuid();
        const inferredPlanType = isSubstitution ? 'substitution' : 'in plan';
        const attachedPlanId = attachedPlan ? String(attachedPlan.lpId || attachedPlan.lessonPlanId || attachedPlan.planId || attachedPlan.id || '').trim() : '';
        const attachedChapter = attachedPlan ? String(attachedPlan.chapter || '').trim() : '';
        const attachedSession = attachedPlan ? Number(attachedPlan.session || attachedPlan.sessionNo || 0) : 0;
        const attachedSchemeId = attachedPlan ? String(attachedPlan.schemeId || '').trim() : '';

        // For substitution, use the attached plan ID directly (teacher's choice from Ready plans)
        let finalPlanId = '';
        if (isSubstitution && attachedPlan) {
          finalPlanId = attachedPlanId;
        }

        // Standardize on sessionComplete boolean only
        // Frontend sends sessionComplete (boolean) - convert to percentage for sheet storage
        const sessionComplete = data.sessionComplete === true || data.sessionComplete === 'true' || String(data.sessionComplete).toLowerCase() === 'true';
        const completionPercentage = sessionComplete ? 100 : 0;

        // reportSchemeId already computed above

        const rowData = [
          reportId,
          data.date || '',
          data.teacherEmail || '',
          data.teacherName || '',
          data.class || '',
          data.subject || '',
          reportSchemeId,
          Number(data.period || 0),
          inferredPlanType,
          String((!isSubstitution && matchingPlan && matchingPlan.lpId) || finalPlanId || ''),
          reportedChapter,  // Use the validated chapter value
          reportedSession,  // Use the validated session value
          Number(totalSessionsVal || 1),
          completionPercentage,
          data.chapterStatus || '',
          data.deviationReason || '',
          data.difficulties || '',
          data.nextSessionPlan || '',
          objectivesVal,
          activitiesVal,
          data.chapterCompleted ? 'Chapter Complete' : (data.completed || ''),
          data.notes || '',
          now,
          isSubstitution ? 'TRUE' : 'FALSE',
          subAbsentTeacher,
          subRegularSubject,
          subSubstituteSubject
        ];
        // Sanitize string fields to prevent formula injection in Sheets
        var sanitizedRowData = rowData.map(function(v){
          if (v === null || v === undefined) return '';
          if (typeof v === 'string') {
            return (/^[=+\-@]/.test(v) ? ('\'' + v) : v);
          }
          return v;
        });
        sh.appendRow(sanitizedRowData);
        SpreadsheetApp.flush();
        appLog('INFO', 'daily report submitted', { email: teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod });

        try {
          logAudit({
            action: AUDIT_ACTIONS.SUBMIT,
            entityType: AUDIT_ENTITIES.DAILY_REPORT,
            entityId: reportId,
            userEmail: teacherEmail,
            userName: String(data.teacherName || '').trim(),
            userRole: 'Teacher',
            description: `Daily report submitted for ${reportClass} ${reportSubject} Period ${reportPeriod}`,
            severity: AUDIT_SEVERITY.INFO
          });
        } catch (auditErr) { /* ignore audit failures */ }

        // *** SIMPLIFIED CASCADE LOGIC ***
        // Cascade precedence (only one type applies per submission):
        // 1. Manual cascade (frontend explicit request)
        // 2. Auto-cascade (enabled via settings, 0% completion)
        // 3. Absent teacher cascade (substitution scenario)
        // 4. Substitute pullback (substitution with attached plan)

        let cascadeResults = {
          manual: null,
          auto: null,
          absent: null,
          substitutePullback: null,
          appliedType: null
        };

        // 1. MANUAL CASCADE: Frontend explicitly requested reschedule
        if (!sessionComplete && String(data.cascadeOption || '').trim() === 'cascade') {
          try {
            const reportedPlanId = String((!isSubstitution && matchingPlan && matchingPlan.lpId) || finalPlanId || '').trim();
            if (reportedPlanId) {
              const preview = getCascadePreview(reportedPlanId, teacherEmail, reportDate);
              if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
                const execPayload = {
                  sessionsToReschedule: preview.sessionsToReschedule,
                  mode: preview.mode,
                  dailyReportContext: { date: reportDate, teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod }
                };
                const cascadeResult = executeCascade(execPayload);
                cascadeResults.manual = {
                  success: cascadeResult && cascadeResult.success,
                  updatedCount: cascadeResult && cascadeResult.updatedCount,
                  errors: cascadeResult && cascadeResult.errors
                };
                cascadeResults.appliedType = 'manual';
                appLog('INFO', 'Manual cascade executed', cascadeResults.manual);
              } else {
                cascadeResults.manual = { success: false, reason: 'preview_not_cascadable' };
              }
            } else {
              cascadeResults.manual = { success: false, reason: 'no_lesson_plan_id' };
            }
          } catch (mcErr) {
            cascadeResults.manual = { success: false, error: mcErr.message };
            appLog('ERROR', 'Manual cascade failed', { message: mcErr.message });
          }
        }

        // 2. AUTO-CASCADE: Enabled via settings, triggers on incomplete session
        // Only apply if manual cascade was not requested
        if (!cascadeResults.appliedType && !sessionComplete) {
          try {
            const lpIdForCascade = String((!isSubstitution && matchingPlan && matchingPlan.lpId) || finalPlanId || '').trim();
            const autoCascadeEnabled = _isAutoCascadeEnabled();
            if (autoCascadeEnabled && lpIdForCascade) {
              appLog('INFO', 'Auto-cascade check passed', { lpId: lpIdForCascade });
              const preview = getCascadePreview(lpIdForCascade, teacherEmail, reportDate);
              if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
                appLog('INFO', 'Auto-cascade executing', { affected: preview.sessionsToReschedule.length });
                const execPayload = {
                  sessionsToReschedule: preview.sessionsToReschedule,
                  mode: preview.mode,
                  dailyReportContext: { date: reportDate, teacherEmail: teacherEmail, class: reportClass, subject: reportSubject, period: reportPeriod }
                };
                const cascadeResult = executeCascade(execPayload);
                cascadeResults.auto = {
                  previewSessions: preview.sessionsToReschedule.length,
                  success: cascadeResult && cascadeResult.success,
                  updatedCount: cascadeResult && cascadeResult.updatedCount,
                  errors: cascadeResult && cascadeResult.errors,
                  flagEnabled: autoCascadeEnabled
                };
                cascadeResults.appliedType = 'auto';
                appLog('INFO', 'Auto-cascade result', cascadeResults.auto);
              } else {
                cascadeResults.auto = { success: false, reason: 'preview_not_cascadable', flagEnabled: autoCascadeEnabled };
              }
            } else {
              cascadeResults.auto = { attempted: false, reason: autoCascadeEnabled ? 'missing_lpId' : 'auto_disabled', flagEnabled: autoCascadeEnabled };
            }
          } catch (acErr) {
            cascadeResults.auto = { success: false, error: acErr.message, flagEnabled: _isAutoCascadeEnabled() };
            appLog('ERROR', 'Auto-cascade exception', { message: acErr.message });
          }
        }

        // 3. ABSENT TEACHER CASCADE: For substitution, cascade the absent teacher's plan
        // Only applies to substitutions
        if (isSubstitution && subAbsentTeacher && subRegularSubject) {
          try {
            const absentEmail = String(subAbsentTeacher || '').toLowerCase().trim();
            const absentPlan = lessonPlans.find(p => {
              const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === absentEmail;
              const dateMatch = _normalizeQueryDate(p.selectedDate || p.date) === reportDate;
              const periodMatch = String(p.selectedPeriod || p.period || '').trim() === String(reportPeriod);
              const classMatch = String(p.class || '').trim() === reportClass;
              const subjectMatch = String(p.subject || '').trim().toLowerCase() === String(subRegularSubject).toLowerCase();
              return emailMatch && dateMatch && periodMatch && classMatch && subjectMatch && isFetchableStatus(p.status);
            });
            if (absentPlan && absentPlan.lpId) {
              const preview = getCascadePreview(absentPlan.lpId, absentEmail, reportDate);
              if (preview && preview.success && preview.needsCascade && preview.canCascade && Array.isArray(preview.sessionsToReschedule) && preview.sessionsToReschedule.length) {
                const execPayload = {
                  sessionsToReschedule: preview.sessionsToReschedule,
                  mode: preview.mode,
                  dailyReportContext: { date: reportDate, teacherEmail: absentEmail, class: reportClass, subject: subRegularSubject, period: reportPeriod }
                };
                const exec = executeCascade(execPayload);
                cascadeResults.absent = { success: exec && exec.success, updatedCount: exec && exec.updatedCount, errors: exec && exec.errors };
                appLog('INFO', 'Absent teacher cascade executed', cascadeResults.absent);
              } else {
                cascadeResults.absent = { attempted: true, success: false, reason: 'preview_not_cascadable' };
              }
            } else {
              cascadeResults.absent = { attempted: false, reason: 'no_absent_plan_found' };
            }
          } catch (abErr) {
            cascadeResults.absent = { success: false, error: abErr && abErr.message };
            appLog('ERROR', 'Absent cascade failed', { message: abErr && abErr.message });
          }
        }

        // 4. SUBSTITUTE PULLBACK: When substitute uses their own plan, pull back future sessions
        // Only applies to substitutions with attached plan
        if (isSubstitution && attachedPlan && attachedPlanId) {
          try {
            const attachedIso = _isoDateIST(attachedPlan.selectedDate || attachedPlan.date);
            const reportIso = reportDate; // already normalized
            const attachedPeriod = String(attachedPlan.selectedPeriod || attachedPlan.period || '').trim();

            const compareSlot = (dateA, periodA, dateB, periodB) => {
              const a = String(dateA || '').trim();
              const b = String(dateB || '').trim();
              if (!a || !b) return 0;
              if (a < b) return -1;
              if (a > b) return 1;
              const pa = Number(periodA || 0);
              const pb = Number(periodB || 0);
              if (pa < pb) return -1;
              if (pa > pb) return 1;
              return 0;
            };

            // Only apply pullback if the attached plan was scheduled after the report slot (date+period)
            if (attachedIso && reportIso && compareSlot(reportIso, reportPeriod, attachedIso, attachedPeriod) < 0) {
              const lpSh2 = lpSheet; // already loaded
              const lpH2 = lpHeaders;
              const colSelectedDate = lpH2.indexOf('selectedDate') + 1;
              const colSelectedPeriod = lpH2.indexOf('selectedPeriod') + 1;
              const colOriginalDate = lpH2.indexOf('originalDate') + 1;
              const colOriginalPeriod = lpH2.indexOf('originalPeriod') + 1;

              const chapterKey = String(attachedPlan.chapter || '').trim();
              const targetSession = Number(attachedPlan.session || attachedPlan.sessionNo || 0);

              // Find the chain of plans in the same chapter
              const chain = lessonPlans
                .filter(p => {
                  const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                  if (!id) return false;
                  const emailMatch = String(p.teacherEmail || '').trim().toLowerCase() === teacherEmail;
                  const classMatch = String(p.class || '').trim() === reportClass;
                  const subjectMatch = String(p.subject || '').trim() === reportSubject;
                  const chapterMatch = chapterKey ? (String(p.chapter || '').trim() === chapterKey) : true;
                  const statusOk = isFetchableStatus(p.status);
                  const sess = Number(p.session || p.sessionNo || 0);
                  return emailMatch && classMatch && subjectMatch && chapterMatch && statusOk && sess >= targetSession;
                })
                .sort((a, b) => Number(a.session || a.sessionNo || 0) - Number(b.session || b.sessionNo || 0));

              const idxAttach = chain.findIndex(p => {
                const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                return id === attachedPlanId;
              });

              if (idxAttach < 0) {
                substitutePullback = { attempted: true, success: false, reason: 'attached_plan_not_in_chain' };
              } else {
                const oldSlots = chain.map(p => ({
                  date: _isoDateIST(p.selectedDate || p.date),
                  period: String(p.selectedPeriod || p.period || '').trim()
                }));

                const moves = [];
                let updatedCount = 0;
                // Update each plan row
                chain.forEach((p, i) => {
                  if (i < idxAttach) return;
                  const id = String(p.lpId || p.lessonPlanId || p.planId || p.id || '').trim();
                  const rowIndex = lessonPlans.findIndex(x => String(x.lpId || x.lessonPlanId || x.planId || x.id || '').trim() === id);
                  if (rowIndex < 0) return;
                  const sheetRow = rowIndex + 2;
                  const oldDate = _isoDateIST(p.selectedDate || p.date);
                  const oldPeriod = String(p.selectedPeriod || p.period || '').trim();
                  if (!oldDate) return;

                  let newDate = '';
                  let newPeriod = '';

                  // For the attached plan itself: move it to the reporting date/period
                  if (id === attachedPlanId) {
                    newDate = reportIso;
                    newPeriod = String(reportPeriod);
                  } else {
                    // Shift later sessions into the previous session's ORIGINAL scheduled slot
                    const prev = oldSlots[i - 1];
                    if (prev && prev.date) {
                      newDate = prev.date;
                      newPeriod = String(prev.period || '').trim();
                    }
                  }

                  // Only write if we have valid new date
                  if (!newDate) return;

                  // Preserve original fields if present and blank
                  try {
                    if (colOriginalDate > 0 && colOriginalPeriod > 0) {
                      const origDateVal = String(lpSh2.getRange(sheetRow, colOriginalDate).getValue() || '').trim();
                      const origPerVal = String(lpSh2.getRange(sheetRow, colOriginalPeriod).getValue() || '').trim();
                      if (!origDateVal) lpSh2.getRange(sheetRow, colOriginalDate).setValue(oldDate);
                      if (!origPerVal) lpSh2.getRange(sheetRow, colOriginalPeriod).setValue(oldPeriod);
                    }
                  } catch (_ignoreOrig) {}

                  if (colSelectedDate > 0) lpSh2.getRange(sheetRow, colSelectedDate).setValue(newDate);
                  if (colSelectedPeriod > 0) lpSh2.getRange(sheetRow, colSelectedPeriod).setValue(newPeriod);

                  moves.push({ lpId: id, oldDate: oldDate, oldPeriod: oldPeriod, newDate: newDate, newPeriod: newPeriod });
                  updatedCount++;
                });

                cascadeResults.substitutePullback = {
                  attempted: true,
                  success: updatedCount > 0,
                  updatedCount: updatedCount,
                  moves: moves
                };
                appLog('INFO', 'Substitute pullback executed', cascadeResults.substitutePullback);
              }
            } else {
              cascadeResults.substitutePullback = { attempted: false, reason: 'not_after_report_date' };
            }
          } catch (spErr) {
            cascadeResults.substitutePullback = { success: false, error: spErr && spErr.message };
            appLog('ERROR', 'Substitute pullback failed', { message: spErr && spErr.message });
          }
        }

        // CHAPTER COMPLETION ACTION (INLINE)
        // If chapter completed and has remaining sessions action, apply it
        if (data.chapterCompleted && data.remainingSessionsAction && data.remainingSessions && data.remainingSessions.length > 0) {
          try {
            const completionResult = applyChapterCompletionAction({
              action: data.remainingSessionsAction,
              lessonPlanIds: data.remainingSessions,
              requesterEmail: data.teacherEmail,
              rationale: data.completionRationale || 'Chapter completed early'
            });
            appLog('INFO', 'Chapter completion action applied', { success: completionResult.success });
          } catch (ccErr) {
            // Don't fail report submission if chapter action fails
            appLog('ERROR', 'Chapter completion action failed', { message: ccErr.message });
          }
        }

        // CRITICAL: Invalidate caches so UI refreshes immediately
        try {
          const cache = CacheService.getScriptCache();

          // Teacher-specific caches
          const specificKeys = [
            'teacher_reports_' + teacherEmail + '_' + reportDate,
            'teacher_daily_' + teacherEmail + '_' + reportDate,
            'daily_timetable_' + reportDate,
            'planned_lessons_' + teacherEmail + '_' + reportDate,
            generateCacheKey('getTeacherDailyReportsForDate', { email: teacherEmail, date: reportDate }),
            generateCacheKey('getTeacherDailyData', { email: teacherEmail, date: reportDate }),
            generateCacheKey('suggestedPlansForSubstitution', { teacherEmail: teacherEmail, cls: reportClass, subject: reportSubject, date: reportDate, period: String(reportPeriod) })
          ];

          // Clear specific keys
          specificKeys.forEach(k => {
            try { cache.remove(k); } catch (e) { /* ignore */ }
          });

          // Invalidate pattern-based caches
          try {
            invalidateCache('approved_schemes');
            if (teacherEmail) {
              invalidateCache('teacher_lessonplans_' + teacherEmail);
              // Clear weekly timetable cache as reporting affects availability
              invalidateCache('teacher_weekly_' + teacherEmail);
            }
            // Clear daily reports query cache for this class/subject
            if (reportClass && reportSubject) {
              invalidateCache('daily_reports_' + reportClass + '_' + reportSubject);
            }
            // Clear scheme-based lesson plan caches
            if (reportSchemeId) {
              invalidateCache('scheme_plans_' + reportSchemeId);
            }
            // Clear HM oversight cache for this date
            invalidateCache('hm_oversight_' + reportDate);
            invalidateCache('daily_readiness_' + reportDate);
          } catch (_e1) {
            appLog('WARN', 'Pattern cache invalidation partial failure', { error: _e1.message });
          }

          appLog('INFO', 'Cache cleared successfully', { specificKeys: specificKeys.length, date: reportDate, teacher: teacherEmail });
        } catch (cacheErr) {
          appLog('ERROR', 'Cache invalidation failed', { error: cacheErr.message });
        }

        // Return unified cascade results
        return _respond({
          ok: true,
          submitted: true,
          cascade: cascadeResults,
          isSubstitution
        });
      } catch (err) {
        appLog('ERROR', 'submitDailyReport failed', { message: err.message, stack: err.stack });
        return _respond({ error: 'Failed to submit: ' + err.message });
      } finally {
        lock.releaseLock();
      }
    }

    // Daily report deletion (time-window enforced in helper)
    if (action === 'deleteDailyReport') {
      const reportId = (data.reportId || e.parameter.reportId || '').trim();
      const email = (data.email || e.parameter.email || '').trim();
      return _respond(deleteDailyReport(reportId, email));
    }

    // HM verification/reopen actions
    if (action === 'verifyDailyReport') {
      const reportId = (data.reportId || e.parameter.reportId || '').trim();
      const verifierEmail = (data.verifierEmail || e.parameter.verifierEmail || '').trim();
      return _respond(verifyDailyReport(reportId, verifierEmail));
    }

    if (action === 'reopenDailyReport') {
      const reportId = (data.reportId || e.parameter.reportId || '').trim();
      const requesterEmail = (data.requesterEmail || e.parameter.requesterEmail || '').trim();
      const reason = (data.reason || e.parameter.reason || '').trim();
      return _respond(reopenDailyReport(reportId, requesterEmail, reason));
    }

    if (action === 'notifyMissingSubmissions') {
      return _respond(_handleNotifyMissingSubmissions(data));
    }

    return null;
  }

// ─── Scheme-Based Lesson Planning, AI, Chapter, Session ───────────────────────
  function _routePostLessonPlanning_(action, data, e) {
    if (action === 'createSchemeLessonPlan') {
      return _handleCreateSchemeLessonPlan(data);
    }

    if (action === 'createBulkSchemeLessonPlans') {
      return _handleCreateBulkSchemeLessonPlans(data);
    }

    // === AI LESSON PLAN SUGGESTIONS ===
    if (action === 'getAILessonSuggestions') {
      return _respond(getAILessonSuggestions(data.context || data));
    }

    // Deterministic AI-like suggestion endpoints (no external keys required)
    if (action === 'suggestLessonPlan') {
      return _respond(suggestLessonPlan(data));
    }

    if (action === 'suggestLessonPlansBulk') {
      return _respond(suggestLessonPlansBulk(data));
    }

    // === CHAPTER COMPLETION ROUTES ===
    if (action === 'checkChapterCompletion') {
      return _handleCheckChapterCompletion(data);
    }

    if (action === 'applyChapterCompletionAction') {
      appLog('INFO', 'applyChapterCompletionAction', { action: data && data.action, idsCount: (data && data.lessonPlanIds && data.lessonPlanIds.length) || 0 });
      return _handleApplyChapterCompletionAction(data);
    }

    // === SESSION COMPLETION TRACKING ROUTES ===
    if (action === 'updateSessionCompletion') {
      return _handleUpdateSessionCompletion(data);
    }

    // TeacherPerformance dashboard removed

    if (action === 'getSchemeCompletionAnalytics') {
      return _handleGetSchemeCompletionAnalytics(data);
    }

    return null;
  }

// ─── HM Monitoring, Lesson Plan Status, Sync ──────────────────────────────────
  function _routePostHMMonitoring_(action, data, e) {
    if (action === 'getAllTeachersPerformance') {
      return _handleGetAllTeachersPerformance(data);
    }

    if (action === 'getClassSubjectPerformance') {
      return _respond(getClassSubjectPerformance());
    }

    if (action === 'getDailySubmissionMetrics') {
      const daysBack = Number(data.daysBack || 30);
      return _respond(getDailySubmissionMetrics(daysBack));
    }

    if (action === 'getDailyReadinessStatus') {
      const date = (e && e.parameter && e.parameter.date) ? String(e.parameter.date).trim() : '';
      return _respond(getDailyReadinessStatus(date || _todayISO()));
    }

    if (action === 'getHMAnalyticsDashboard') {
      return _respond(getHMAnalyticsDashboard());
    }

    if (action === 'getSchoolSessionAnalytics') {
      return _handleGetSchoolSessionAnalytics(data);
    }

    if (action === 'getCascadingIssuesReport') {
      return _handleGetCascadingIssuesReport(data);
    }

    if (action === 'syncSessionDependencies') {
      return _handleSyncSessionDependencies(data);
    }

    if (action === 'updateLessonPlanStatus') {
      return _handleUpdateLessonPlanStatus(data);
    }

    if (action === 'updateLessonPlanDetailsStatus') {
      return _handleUpdateLessonPlanStatus(data); // Same handler, different name for compatibility
    }

    if (action === 'batchUpdateLessonPlanStatus') {
      return _handleBatchUpdateLessonPlanStatus(data);
    }

    // Chapter-scoped bulk lesson plan status update (HM only)
    if (action === 'chapterBulkUpdateLessonPlanStatus') {
      return _handleChapterBulkUpdateLessonPlanStatus(data);
    }

    // Reschedule lesson plan (change date and period) - HM/Admin only
    if (action === 'rescheduleLessonPlan') {
      return _handleRescheduleLessonPlan(data);
    }

    // Simple diagnostic: reveals LessonPlans sheet headers and detects status column
    if (action === 'diagnoseLessonPlanHeaders') {
      const email = (data.email || e.parameter.email || '').toLowerCase().trim();
      if (!_isAdminSafe(email)) {
        return _respond({ success: false, error: 'Permission denied. Admin access required.' });
      }
      return _respond(_handleDiagnoseLessonPlanHeaders());
    }

    return null;
  }

// ─── Fee Collection (POST) ────────────────────────────────────────────────────
  function _routePostFees_(action, data, e) {
    if (action === 'addPaymentBatch') {
      try {
        const result = addPayment(data);
        return _respond({ ok: true, ...result });
      } catch (err) {
        return _respond({ ok: false, error: String(err) });
      }
    }

    if (action === 'voidReceipt') {
      try {
        const result = voidReceipt(data.receiptNo);
        return _respond({ ok: true, ...result });
      } catch (err) {
        return _respond({ ok: false, error: String(err) });
      }
    }

    if (action === 'unvoidReceipt') {
      try {
        const result = unvoidReceipt(data.receiptNo);
        return _respond({ ok: true, ...result });
      } catch (err) {
        return _respond({ ok: false, error: String(err) });
      }
    }

    if (action === 'bulkPayment') {
      try {
        // Transform data format: map body to match addPayment format for each student
        const payments = Array.isArray(data.payments) ? data.payments : [];
        const results = [];

        payments.forEach(payment => {
          try {
            const result = addPayment({
              date: data.date,
              admNo: payment.admNo,
              name: payment.name,
              cls: payment.cls || payment.class,
              mode: payment.mode,
              items: payment.feeHeads || []
            });
            results.push({ ...result, admNo: payment.admNo, success: true });
          } catch (err) {
            results.push({ admNo: payment.admNo, success: false, error: String(err) });
          }
        });

        return _respond({
          ok: true,
          results: results,
          successCount: results.filter(r => r.success).length,
          totalCount: results.length,
          date: data.date
        });
      } catch (err) {
        return _respond({ ok: false, error: String(err) });
      }
    }

    return null;
  }

// ─── Primary POST Dispatcher ───────────────────────────────────────────────────
function routePost(action, data, e) {
  const authResp = _ensureAuthenticatedOrRespond_(e, data, action);
  if (authResp) return authResp;

  return _routePostSystem_(action, data, e)
      || _routePostAuth_(action, data, e)
      || _routePostAdminData_(action, data, e)
      || _routePostSettings_(action, data, e)
      || _routePostExams_(action, data, e)
      || _routePostAdminMgmt_(action, data, e)
      || _routePostAuditLog_(action, data, e)
      || _routePostLessonCascade_(action, data, e)
      || _routePostSubstitutions_(action, data, e)
      || _routePostFundsExpense_(action, data, e)
      || _routePostSchemes_(action, data, e)
      || _routePostDailyReports_(action, data, e)
      || _routePostLessonPlanning_(action, data, e)
      || _routePostHMMonitoring_(action, data, e)
      || _routePostFees_(action, data, e)
      || _respond({ error: 'Unknown action: ' + action });
}
