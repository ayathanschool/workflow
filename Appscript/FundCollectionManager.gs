/**
 * ====== FUND COLLECTION MANAGEMENT SYSTEM ======
 * This file handles fund collection requests from teachers
 * 
 * Key Features:
 * - Teachers create fund collection requests (e.g., Athletic Meet, Field Trip)
 * - Student selection with checkboxes (Select All/Individual)
 * - Multi-step approval workflow: HM/Admin → Accounts
 * - Teachers can collect funds after approval
 * - Accounts department acknowledges final collected amount
 * - Status tracking: Draft, Pending, Approved, In Progress, Completed, Rejected, Revised
 */

/**
 * Create a new fund collection request
 * 
 * @param {Object} data
 *   - teacherEmail: string (creator)
 *   - class: string (e.g., "Class 1A")
 *   - purpose: string (e.g., "Athletic Meet Registration")
 *   - amountPerStudent: number
 *   - startDate: string (YYYY-MM-DD)
 *   - endDate: string (YYYY-MM-DD)
 *   - selectedStudents: array of admission numbers ['ADM001', 'ADM002']
 *   - notes: string (optional)
 * @returns {Object} { success: true, requestId: 'FC-2026-001' }
 */
function createFundCollectionRequest(data) {
  try {
    if (!data || !data.teacherEmail || !data.class || !data.purpose || !data.amountPerStudent) {
      return { success: false, error: 'teacherEmail, class, purpose, and amountPerStudent are required' };
    }

    if (!Array.isArray(data.selectedStudents) || data.selectedStudents.length === 0) {
      return { success: false, error: 'At least one student must be selected' };
    }

    const sh = _getSheet('FundCollectionRequests');
    _ensureHeaders(sh, ['requestId', 'teacherEmail', 'teacherName', 'class', 'purpose', 'amountPerStudent', 
                        'totalStudents', 'expectedAmount', 'startDate', 'endDate', 'selectedStudents', 
                        'status', 'notes', 'createdAt', 'submittedAt', 'approvedBy', 'approvedAt', 
                        'rejectedBy', 'rejectedAt', 'rejectionReason', 'revisedBy', 'revisedAt', 
                        'revisionNotes', 'collectedAmount', 'totalDeposited', 'acknowledgedBy', 'acknowledgedAt', 
                        'completedAt']);

    const normalizedStartDate = _isoDateString(data.startDate);
    const normalizedEndDate = _isoDateString(data.endDate);

    if (!normalizedStartDate || !normalizedEndDate) {
      return { success: false, error: 'Valid startDate and endDate are required' };
    }

    if (normalizedEndDate < normalizedStartDate) {
      return { success: false, error: 'endDate must be >= startDate' };
    }

    // Generate unique request ID
    const requestId = _generateFundRequestId();
    
    // Get teacher name
    const teacherName = _getTeacherName(data.teacherEmail);
    
    // Calculate totals
    const totalStudents = data.selectedStudents.length;
    const expectedAmount = totalStudents * Number(data.amountPerStudent);
    
    // Store selected students as JSON string
    const studentsJson = JSON.stringify(data.selectedStudents);
    
    const now = new Date().toISOString();
    
    const row = [
      requestId,
      data.teacherEmail,
      teacherName,
      data.class,
      data.purpose,
      Number(data.amountPerStudent),
      totalStudents,
      expectedAmount,
      normalizedStartDate,
      normalizedEndDate,
      studentsJson,
      'Draft', // status
      data.notes || '',
      now, // createdAt
      '', // submittedAt
      '', // approvedBy
      '', // approvedAt
      '', // rejectedBy
      '', // rejectedAt
      '', // rejectionReason
      '', // revisedBy
      '', // revisedAt
      '', // revisionNotes
      0, // collectedAmount
      0, // totalDeposited
      '', // acknowledgedBy
      '', // acknowledgedAt
      '' // completedAt
    ];

    sh.appendRow(row);
    
    invalidateCache('fund_collection');
    
    return { 
      success: true, 
      requestId: requestId,
      expectedAmount: expectedAmount,
      totalStudents: totalStudents
    };

  } catch (error) {
    console.error('Error creating fund collection request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit fund collection request for approval
 * Changes status from Draft to Pending
 */
function submitFundCollectionRequest(requestId) {
  try {
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Draft') {
          return { success: false, error: 'Only draft requests can be submitted' };
        }

        const statusCol = headers.indexOf('status') + 1;
        const submittedAtCol = headers.indexOf('submittedAt') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Pending');
        sh.getRange(i + 1, submittedAtCol).setValue(new Date().toISOString());

        invalidateCache('fund_collection');
        
        // Send notification to admin/HM
        _notifyAdminFundRequest(row);
        
        return { success: true, message: 'Request submitted for approval' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error submitting fund collection request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get students in a class for selection
 * 
 * @param {string} className - Class name (e.g., "Class 1A", "5")
 * @returns {Object} { success: true, students: [{admNo, name, class}] }
 */
function getStudentsForClass(className) {
  try {
    if (!className) {
      return { success: false, error: 'className is required' };
    }

    const studentsData = _getCachedSheetData('Students').data;
    
    const normalizedClass = String(className).trim().toLowerCase()
      .replace(/^(std|class)\s*/i, '')
      .replace(/\s+/g, '');
    
    const students = studentsData.filter(s => {
      const studentClass = String(s.class || '').trim().toLowerCase()
        .replace(/^(std|class)\s*/i, '')
        .replace(/\s+/g, '');
      return studentClass === normalizedClass;
    }).map(s => ({
      admNo: s.admNo,
      name: s.name,
      class: s.class,
      email: s.email || '',
      parentContact: s.parentContact || ''
    }));

    students.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    return {
      success: true,
      class: className,
      totalStudents: students.length,
      students: students
    };

  } catch (error) {
    console.error('Error getting students for class:', error);
    return { success: false, error: error.message, students: [] };
  }
}

/**
 * Get fund collection requests for a teacher
 */
function getTeacherFundRequests(teacherEmail, status = '') {
  try {
    const allRequests = _getCachedSheetData('FundCollectionRequests').data;
    
    const email = String(teacherEmail || '').toLowerCase().trim();
    
    let requests = allRequests.filter(r => {
      return String(r.teacherEmail || '').toLowerCase().trim() === email;
    });

    if (status) {
      const statusFilter = String(status).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.status || '').toLowerCase() === statusFilter
      );
    }

    // Sort by createdAt descending (newest first)
    requests.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Parse selectedStudents JSON
    requests = requests.map(r => {
      try {
        r.selectedStudentsArray = JSON.parse(r.selectedStudents || '[]');
      } catch (e) {
        r.selectedStudentsArray = [];
      }
      return r;
    });

    return {
      success: true,
      teacherEmail: teacherEmail,
      count: requests.length,
      requests: requests
    };

  } catch (error) {
    console.error('Error getting teacher fund requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Get all fund collection requests for admin/HM/accounts
 * Enforces role-based access control
 * 
 * @param {string} userEmail - Email of requesting user
 * @param {string} status - Optional status filter
 * @param {string} className - Optional class filter
 * @returns {Object} { success: boolean, requests: Array }
 */
function getAllFundRequests(userEmail, status = '', className = '') {
  try {
    // Enforce role-based access control
    if (!userEmail) {
      return { success: false, error: 'User email required', requests: [] };
    }
    
    console.log('[getAllFundRequests] Checking permissions for:', userEmail);
    
    const isSuperAdmin = userHasRole(userEmail, 'admin');
    const isHM = userHasRole(userEmail, 'hm');
    const isAccounts = userHasRole(userEmail, 'accounts');
    
    console.log('[getAllFundRequests] Role checks:', { isSuperAdmin, isHM, isAccounts });
    
    // Debug: Get user from sheet to see their actual roles
    const usersSheet = _getSheet('Users');
    const headers = _headers(usersSheet);
    const rows = _rows(usersSheet).map(r => _indexByHeader(r, headers));
    const user = rows.find(u => String(u.email || '').toLowerCase().trim() === userEmail.toLowerCase().trim());
    console.log('[getAllFundRequests] User found in sheet:', user ? { email: user.email, roles: user.roles || user.role } : 'NOT FOUND');
    
    if (!isSuperAdmin && !isHM && !isAccounts) {
      return { success: false, error: 'Unauthorized: admin, HM or Accounts role required', requests: [] };
    }
    
    const allRequests = _getCachedSheetData('FundCollectionRequests').data;
    
    let requests = allRequests;

    if (status) {
      const statusFilter = String(status).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.status || '').toLowerCase() === statusFilter
      );
    }

    if (className) {
      const classFilter = String(className).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.class || '').toLowerCase().trim() === classFilter
      );
    }

    // Sort by createdAt descending (newest first)
    requests.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Parse selectedStudents JSON
    requests = requests.map(r => {
      try {
        r.selectedStudentsArray = JSON.parse(r.selectedStudents || '[]');
      } catch (e) {
        r.selectedStudentsArray = [];
      }
      return r;
    });

    return {
      success: true,
      count: requests.length,
      requests: requests
    };

  } catch (error) {
    console.error('Error getting all fund requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Approve fund collection request (Admin/HM action)
 * Enforces role-based access control
 */
function approveFundRequest(requestId, approverEmail, notes = '') {
  try {
    // Validate HM or admin role
    if (!userHasRole(approverEmail, 'hm') && !userHasRole(approverEmail, 'admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Pending' && row.status !== 'Revised') {
          return { success: false, error: 'Only pending or revised requests can be approved' };
        }

        const now = new Date().toISOString();
        const statusCol = headers.indexOf('status') + 1;
        const approvedByCol = headers.indexOf('approvedBy') + 1;
        const approvedAtCol = headers.indexOf('approvedAt') + 1;
        const revisionNotesCol = headers.indexOf('revisionNotes') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Approved');
        sh.getRange(i + 1, approvedByCol).setValue(approverEmail);
        sh.getRange(i + 1, approvedAtCol).setValue(now);
        if (notes) {
          sh.getRange(i + 1, revisionNotesCol).setValue(notes);
        }

        invalidateCache('fund_collection');
        
        // Notify teacher
        _notifyTeacherFundApproval(row, approverEmail);
        
        // Notify accounts department
        _notifyAccountsFundApproval(row);
        
        return { success: true, message: 'Request approved successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error approving fund request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject fund collection request (Admin/HM action)
 * Enforces role-based access control
 */
function rejectFundRequest(requestId, rejectorEmail, reason) {
  try {
    // Validate HM or admin role
    if (!userHasRole(rejectorEmail, 'hm') && !userHasRole(rejectorEmail, 'admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }
    
    if (!reason) {
      return { success: false, error: 'Rejection reason is required' };
    }

    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Pending') {
          return { success: false, error: 'Only pending requests can be rejected' };
        }

        const now = new Date().toISOString();
        const statusCol = headers.indexOf('status') + 1;
        const rejectedByCol = headers.indexOf('rejectedBy') + 1;
        const rejectedAtCol = headers.indexOf('rejectedAt') + 1;
        const rejectionReasonCol = headers.indexOf('rejectionReason') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Rejected');
        sh.getRange(i + 1, rejectedByCol).setValue(rejectorEmail);
        sh.getRange(i + 1, rejectedAtCol).setValue(now);
        sh.getRange(i + 1, rejectionReasonCol).setValue(reason);

        invalidateCache('fund_collection');
        
        // Notify teacher
        _notifyTeacherFundRejection(row, rejectorEmail, reason);
        
        return { success: true, message: 'Request rejected' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error rejecting fund request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Request revision (Admin/HM asks teacher to modify)
 * Enforces role-based access control
 */
function requestFundRevision(requestId, revisorEmail, revisionNotes) {
  try {
    // Validate HM or admin role
    if (!userHasRole(revisorEmail, 'hm') && !userHasRole(revisorEmail, 'admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }
    
    if (!revisionNotes) {
      return { success: false, error: 'Revision notes are required' };
    }

    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Pending') {
          return { success: false, error: 'Only pending requests can be sent for revision' };
        }

        const now = new Date().toISOString();
        const statusCol = headers.indexOf('status') + 1;
        const revisedByCol = headers.indexOf('revisedBy') + 1;
        const revisedAtCol = headers.indexOf('revisedAt') + 1;
        const revisionNotesCol = headers.indexOf('revisionNotes') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Revised');
        sh.getRange(i + 1, revisedByCol).setValue(revisorEmail);
        sh.getRange(i + 1, revisedAtCol).setValue(now);
        sh.getRange(i + 1, revisionNotesCol).setValue(revisionNotes);

        invalidateCache('fund_collection');
        
        // Notify teacher
        _notifyTeacherFundRevision(row, revisorEmail, revisionNotes);
        
        return { success: true, message: 'Revision requested' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error requesting fund revision:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update fund collection request (teacher editing after revision request)
 */
function updateFundCollectionRequest(requestId, data) {
  try {
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Draft' && row.status !== 'Revised') {
          return { success: false, error: 'Only draft or revised requests can be updated' };
        }

        // Update allowed fields
        if (data.purpose) {
          const purposeCol = headers.indexOf('purpose') + 1;
          sh.getRange(i + 1, purposeCol).setValue(data.purpose);
        }
        if (data.amountPerStudent) {
          const amountCol = headers.indexOf('amountPerStudent') + 1;
          sh.getRange(i + 1, amountCol).setValue(Number(data.amountPerStudent));
        }
        if (data.startDate) {
          const startDateCol = headers.indexOf('startDate') + 1;
          sh.getRange(i + 1, startDateCol).setValue(_isoDateString(data.startDate));
        }
        if (data.endDate) {
          const endDateCol = headers.indexOf('endDate') + 1;
          sh.getRange(i + 1, endDateCol).setValue(_isoDateString(data.endDate));
        }
        if (data.selectedStudents && Array.isArray(data.selectedStudents)) {
          const studentsCol = headers.indexOf('selectedStudents') + 1;
          const totalStudentsCol = headers.indexOf('totalStudents') + 1;
          const expectedAmountCol = headers.indexOf('expectedAmount') + 1;
          
          sh.getRange(i + 1, studentsCol).setValue(JSON.stringify(data.selectedStudents));
          sh.getRange(i + 1, totalStudentsCol).setValue(data.selectedStudents.length);
          
          const amountPerStudent = Number(row.amountPerStudent);
          sh.getRange(i + 1, expectedAmountCol).setValue(data.selectedStudents.length * amountPerStudent);
        }
        if (data.notes !== undefined) {
          const notesCol = headers.indexOf('notes') + 1;
          sh.getRange(i + 1, notesCol).setValue(data.notes);
        }

        invalidateCache('fund_collection');
        
        return { success: true, message: 'Request updated successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error updating fund collection request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start collection (Teacher marks as "In Progress" after approval)
 */
function startFundCollection(requestId, teacherEmail) {
  try {
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Approved') {
          return { success: false, error: 'Only approved requests can be started' };
        }

        if (String(row.teacherEmail || '').toLowerCase() !== String(teacherEmail || '').toLowerCase()) {
          return { success: false, error: 'Unauthorized' };
        }

        const statusCol = headers.indexOf('status') + 1;
        sh.getRange(i + 1, statusCol).setValue('In Progress');

        invalidateCache('fund_collection');
        
        // Initialize student payment tracking
        const initResult = _initializeStudentPayments(requestId, row);
        if (!initResult.success) {
          console.warn('Failed to initialize student payments:', initResult.error);
        }
        
        return { success: true, message: 'Collection started' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error starting fund collection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete collection (Teacher submits collected amount)
 */
function completeFundCollection(requestId, teacherEmail, collectedAmount) {
  try {
    if (!collectedAmount || collectedAmount < 0) {
      return { success: false, error: 'Valid collected amount is required' };
    }

    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'In Progress') {
          return { success: false, error: 'Only in-progress collections can be completed' };
        }

        if (String(row.teacherEmail || '').toLowerCase() !== String(teacherEmail || '').toLowerCase()) {
          return { success: false, error: 'Unauthorized' };
        }

        const statusCol = headers.indexOf('status') + 1;
        const collectedAmountCol = headers.indexOf('collectedAmount') + 1;
        const completedAtCol = headers.indexOf('completedAt') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Completed');
        sh.getRange(i + 1, collectedAmountCol).setValue(Number(collectedAmount));
        sh.getRange(i + 1, completedAtCol).setValue(new Date().toISOString());

        invalidateCache('fund_collection');
        
        // Notify accounts for acknowledgment
        _notifyAccountsFundComplete(row, collectedAmount);
        
        return { success: true, message: 'Collection completed, awaiting accounts acknowledgment' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error completing fund collection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Acknowledge collection (Accounts department confirms receipt)
 * Enforces role-based access control
 */
function acknowledgeFundCollection(requestId, accountsEmail) {
  try {
    // Validate accounts role
    if (!userHasRole(accountsEmail, 'accounts')) {
      return { success: false, error: 'Unauthorized: Accounts role required' };
    }
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Completed') {
          return { success: false, error: 'Only completed collections can be acknowledged' };
        }

        const acknowledgedByCol = headers.indexOf('acknowledgedBy') + 1;
        const acknowledgedAtCol = headers.indexOf('acknowledgedAt') + 1;
        
        sh.getRange(i + 1, acknowledgedByCol).setValue(accountsEmail);
        sh.getRange(i + 1, acknowledgedAtCol).setValue(new Date().toISOString());

        invalidateCache('fund_collection');
        
        // Notify teacher that acknowledgment is complete
        _notifyTeacherFundAcknowledged(row, accountsEmail);
        
        return { success: true, message: 'Collection acknowledged' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error acknowledging fund collection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete fund collection request (only drafts can be deleted)
 */
function deleteFundCollectionRequest(requestId, teacherEmail) {
  try {
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Draft') {
          return { success: false, error: 'Only draft requests can be deleted' };
        }

        if (String(row.teacherEmail || '').toLowerCase() !== String(teacherEmail || '').toLowerCase()) {
          return { success: false, error: 'Unauthorized' };
        }

        sh.deleteRow(i + 1);
        invalidateCache('fund_collection');
        
        return { success: true, message: 'Request deleted' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error deleting fund collection request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin delete fund collection request (can delete any status)
 * 
 * @param {string} requestId
 * @param {string} adminEmail
 * @returns {Object} { success: boolean, message?: string, error?: string }
 */
function adminDeleteFundCollectionRequest(requestId, adminEmail) {
  try {
    // Verify HM or admin role
    const usersData = _getCachedSheetData('Users').data;
    const user = usersData.find(u => 
      String(u.email || '').toLowerCase().trim() === String(adminEmail || '').toLowerCase().trim()
    );
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const roles = String(user.roles || '').toLowerCase();
    if (!roles.includes('hm') && !roles.includes('admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }

    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        // Log deletion for audit trail
        logAdminAction({
          action: 'DELETE_FUND_COLLECTION_REQUEST',
          adminEmail: adminEmail,
          requestId: requestId,
          teacherEmail: row.teacherEmail,
          purpose: row.purpose,
          totalAmount: row.totalAmount,
          status: row.status,
          class: row.class
        });

        sh.deleteRow(i + 1);
        invalidateCache('fund_collection');
        
        // Notify teacher about deletion
        try {
          const subject = `Fund Collection Request Deleted: ${row.purpose}`;
          const body = `
Dear ${row.teacherName},

Your fund collection request has been deleted by administration:

Request ID: ${row.requestId}
Class: ${row.class}
Purpose: ${row.purpose}
Total Amount: ₹${row.totalAmount}
Status at deletion: ${row.status}

If you have any questions, please contact the administration.

Best regards,
School Administration
          `;
          
          sendEmailNotification(row.teacherEmail, subject, body);
        } catch (notifyError) {
          console.error('Error sending deletion notification:', notifyError);
        }
        
        return { success: true, message: 'Request deleted successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error in admin delete fund collection request:', error);
    return { success: false, error: error.message };
  }
}

// ============ DEPOSIT MANAGEMENT FUNCTIONS ============

/**
 * Add a partial deposit for a fund collection request
 * 
 * @param {string} requestId
 * @param {string} teacherEmail
 * @param {number} depositAmount
 * @param {string} depositDate (YYYY-MM-DD)
 * @param {string} notes (optional)
 * @returns {Object} { success: boolean, depositId?: string, totalDeposited?: number }
 */
function addFundDeposit(requestId, teacherEmail, depositAmount, depositDate, notes = '') {
  try {
    if (!depositAmount || depositAmount <= 0) {
      return { success: false, error: 'Valid deposit amount is required' };
    }

    // Verify request exists and is In Progress
    const requestSh = _getSheet('FundCollectionRequests');
    const requestHeaders = _headers(requestSh);
    const requestRows = requestSh.getDataRange().getValues();

    let requestRow = null;
    let requestRowIndex = -1;

    for (let i = 1; i < requestRows.length; i++) {
      const row = _indexByHeader(requestRows[i], requestHeaders);
      if (row.requestId === requestId) {
        requestRow = row;
        requestRowIndex = i;
        break;
      }
    }

    if (!requestRow) {
      return { success: false, error: 'Request not found' };
    }

    if (requestRow.status !== 'In Progress') {
      return { success: false, error: 'Can only add deposits to in-progress collections' };
    }

    if (String(requestRow.teacherEmail || '').toLowerCase() !== String(teacherEmail || '').toLowerCase()) {
      return { success: false, error: 'Unauthorized' };
    }

    // Create deposit record
    const depositSh = _getSheet('FundDeposits');
    _ensureHeaders(depositSh, ['depositId', 'requestId', 'depositDate', 'depositAmount', 
                                'depositedBy', 'depositedByName', 'notes', 'acknowledgedBy', 
                                'acknowledgedAt', 'createdAt']);

    const depositId = _generateDepositId();
    const teacherName = _getTeacherName(teacherEmail);
    const normalizedDate = _isoDateString(depositDate) || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const depositRow = [
      depositId,
      requestId,
      normalizedDate,
      Number(depositAmount),
      teacherEmail,
      teacherName,
      notes || '',
      '', // acknowledgedBy
      '', // acknowledgedAt
      now
    ];

    depositSh.appendRow(depositRow);

    // Recalculate totalDeposited from all sources
    const newTotal = _recalculateTotalDeposited(requestId);

    invalidateCache('fund_collection');
    invalidateCache('fund_deposits');
    invalidateCache(`fund_deposits_${requestId}`);

    // Notify accounts about new deposit
    _notifyAccountsNewDeposit(requestRow, depositId, depositAmount, newTotal);

    return { 
      success: true, 
      depositId: depositId,
      totalDeposited: newTotal,
      message: 'Deposit added successfully'
    };

  } catch (error) {
    console.error('Error adding fund deposit:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all deposits for a request
 * 
 * @param {string} requestId
 * @returns {Object} { success: boolean, deposits: Array }
 */
function getFundDeposits(requestId) {
  try {
    // No caching for deposits - need real-time data for acknowledgments
    const sh = _getSheet('FundDeposits');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    const deposits = [];
    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      if (row.requestId === requestId) {
        deposits.push({
          depositId: row.depositId,
          requestId: row.requestId,
          depositDate: row.depositDate,
          depositAmount: Number(row.depositAmount || 0),
          depositedBy: row.depositedBy,
          depositedByName: row.depositedByName,
          notes: row.notes,
          acknowledgedBy: row.acknowledgedBy || '',
          acknowledgedAt: row.acknowledgedAt || '',
          createdAt: row.createdAt,
          isAcknowledged: !!row.acknowledgedBy
        });
      }
    }

    // Sort by date, newest first
    deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { success: true, deposits: deposits };

  } catch (error) {
    console.error('Error getting fund deposits:', error);
    return { success: false, error: error.message, deposits: [] };
  }
}

/**
 * Acknowledge a deposit (Accounts department)
 * Enforces role-based access control
 * 
 * @param {string} depositId
 * @param {string} accountsEmail
 * @returns {Object} { success: boolean }
 */
function acknowledgeFundDeposit(depositId, accountsEmail) {
  try {
    // Validate accounts role
    if (!userHasRole(accountsEmail, 'accounts')) {
      return { success: false, error: 'Unauthorized: Accounts role required' };
    }
    const sh = _getSheet('FundDeposits');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.depositId === depositId) {
        if (row.acknowledgedBy) {
          return { success: false, error: 'Deposit already acknowledged' };
        }

        const now = new Date().toISOString();
        const acknowledgedByCol = headers.indexOf('acknowledgedBy') + 1;
        const acknowledgedAtCol = headers.indexOf('acknowledgedAt') + 1;
        
        sh.getRange(i + 1, acknowledgedByCol).setValue(accountsEmail);
        sh.getRange(i + 1, acknowledgedAtCol).setValue(now);

        invalidateCache('fund_collection');
        invalidateCache('fund_deposits');
        invalidateCache(`fund_deposits_${row.requestId}`);

        // Notify teacher about acknowledgment
        _notifyTeacherDepositAcknowledged(row, accountsEmail);

        return { success: true, message: 'Deposit acknowledged' };
      }
    }
    
    return { success: false, error: 'Deposit not found' };

  } catch (error) {
    console.error('Error acknowledging deposit:', error);
    return { success: false, error: error.message };
  }
}

// ============ STUDENT PAYMENT TRACKING ============

/**
 * Get student payment details for a request
 * Shows which students have paid and how much
 * 
 * @param {string} requestId
 * @returns {Object} { success: boolean, students: Array, summary: Object }
 */
function getStudentPayments(requestId) {
  try {
    const sh = _getSheet('FundStudentPayments');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    const students = [];
    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      if (row.requestId === requestId) {
        students.push({
          paymentId: row.paymentId,
          studentAdmNo: row.studentAdmNo,
          studentName: row.studentName,
          expectedAmount: Number(row.expectedAmount || 0),
          paidAmount: Number(row.paidAmount || 0),
          paymentStatus: row.paymentStatus || 'Pending',
          paidDate: row.paidDate || '',
          markedBy: row.markedBy || '',
          notes: row.notes || '',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt || ''
        });
      }
    }

    // Sort by student name
    students.sort((a, b) => String(a.studentName || '').localeCompare(String(b.studentName || '')));

    // Calculate summary
    const totalStudents = students.length;
    const paidCount = students.filter(s => s.paymentStatus === 'Paid').length;
    const pendingCount = students.filter(s => s.paymentStatus === 'Pending').length;
    const totalExpected = students.reduce((sum, s) => sum + s.expectedAmount, 0);
    const totalCollected = students.reduce((sum, s) => sum + s.paidAmount, 0);

    return {
      success: true,
      students: students,
      summary: {
        totalStudents,
        paidCount,
        pendingCount,
        totalExpected,
        totalCollected,
        collectionPercentage: totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0
      }
    };

  } catch (error) {
    console.error('Error getting student payments:', error);
    return { success: false, error: error.message, students: [], summary: {} };
  }
}

/**
 * Mark a student as paid
 * 
 * @param {string} paymentId
 * @param {number} paidAmount - Actual amount paid (can differ from expected)
 * @param {string} teacherEmail
 * @param {string} notes - Optional payment notes
 * @returns {Object} { success: boolean, totalCollected: number }
 */
function markStudentPayment(paymentId, paidAmount, teacherEmail, notes = '') {
  try {
    if (!paidAmount || paidAmount < 0) {
      return { success: false, error: 'Valid paid amount is required' };
    }

    const sh = _getSheet('FundStudentPayments');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.paymentId === paymentId) {
        if (row.paymentStatus === 'Paid') {
          return { success: false, error: 'Student already marked as paid. Use update function to modify.' };
        }

        const now = new Date().toISOString();
        const paidDate = now.split('T')[0];
        
        // Update columns
        const paidAmountCol = headers.indexOf('paidAmount') + 1;
        const statusCol = headers.indexOf('paymentStatus') + 1;
        const paidDateCol = headers.indexOf('paidDate') + 1;
        const markedByCol = headers.indexOf('markedBy') + 1;
        const notesCol = headers.indexOf('notes') + 1;
        const updatedAtCol = headers.indexOf('updatedAt') + 1;
        
        sh.getRange(i + 1, paidAmountCol).setValue(Number(paidAmount));
        sh.getRange(i + 1, statusCol).setValue('Paid');
        sh.getRange(i + 1, paidDateCol).setValue(paidDate);
        sh.getRange(i + 1, markedByCol).setValue(teacherEmail);
        if (notes) {
          sh.getRange(i + 1, notesCol).setValue(notes);
        }
        sh.getRange(i + 1, updatedAtCol).setValue(now);

        // Update request totalDeposited
        const requestId = row.requestId;
        const totalCollected = _updateRequestTotalFromStudents(requestId);

        invalidateCache('fund_collection');
        invalidateCache('fund_student_payments');

        return { 
          success: true, 
          message: 'Student payment marked successfully',
          totalCollected: totalCollected
        };
      }
    }
    
    return { success: false, error: 'Payment record not found' };

  } catch (error) {
    console.error('Error marking student payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update existing student payment
 * 
 * @param {string} paymentId
 * @param {number} paidAmount
 * @param {string} notes
 * @returns {Object} { success: boolean }
 */
function updateStudentPayment(paymentId, paidAmount, notes = '') {
  try {
    if (paidAmount === undefined || paidAmount < 0) {
      return { success: false, error: 'Valid paid amount is required' };
    }

    const sh = _getSheet('FundStudentPayments');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.paymentId === paymentId) {
        const now = new Date().toISOString();
        
        const paidAmountCol = headers.indexOf('paidAmount') + 1;
        const notesCol = headers.indexOf('notes') + 1;
        const updatedAtCol = headers.indexOf('updatedAt') + 1;
        const statusCol = headers.indexOf('paymentStatus') + 1;
        
        sh.getRange(i + 1, paidAmountCol).setValue(Number(paidAmount));
        if (notes !== undefined) {
          sh.getRange(i + 1, notesCol).setValue(notes);
        }
        sh.getRange(i + 1, updatedAtCol).setValue(now);
        
        // Update status based on amount
        const newStatus = paidAmount > 0 ? 'Paid' : 'Pending';
        sh.getRange(i + 1, statusCol).setValue(newStatus);

        // Update request totalDeposited
        const requestId = row.requestId;
        _updateRequestTotalFromStudents(requestId);

        invalidateCache('fund_collection');
        invalidateCache('fund_student_payments');

        return { success: true, message: 'Payment updated successfully' };
      }
    }
    
    return { success: false, error: 'Payment record not found' };

  } catch (error) {
    console.error('Error updating student payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk mark multiple students as paid (for batch processing)
 * 
 * @param {string} requestId
 * @param {Array} payments - Array of {studentAdmNo, paidAmount, notes}
 * @param {string} teacherEmail
 * @returns {Object} { success: boolean, markedCount: number }
 */
function bulkMarkStudentPayments(requestId, payments, teacherEmail) {
  try {
    if (!Array.isArray(payments) || payments.length === 0) {
      return { success: false, error: 'No payments provided' };
    }

    const sh = _getSheet('FundStudentPayments');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();
    
    let markedCount = 0;
    const now = new Date().toISOString();
    const paidDate = now.split('T')[0];

    for (const payment of payments) {
      for (let i = 1; i < rows.length; i++) {
        const row = _indexByHeader(rows[i], headers);
        
        if (row.requestId === requestId && row.studentAdmNo === payment.studentAdmNo) {
          if (row.paymentStatus !== 'Paid') {
            const paidAmountCol = headers.indexOf('paidAmount') + 1;
            const statusCol = headers.indexOf('paymentStatus') + 1;
            const paidDateCol = headers.indexOf('paidDate') + 1;
            const markedByCol = headers.indexOf('markedBy') + 1;
            const notesCol = headers.indexOf('notes') + 1;
            const updatedAtCol = headers.indexOf('updatedAt') + 1;
            
            sh.getRange(i + 1, paidAmountCol).setValue(Number(payment.paidAmount || 0));
            sh.getRange(i + 1, statusCol).setValue('Paid');
            sh.getRange(i + 1, paidDateCol).setValue(paidDate);
            sh.getRange(i + 1, markedByCol).setValue(teacherEmail);
            if (payment.notes) {
              sh.getRange(i + 1, notesCol).setValue(payment.notes);
            }
            sh.getRange(i + 1, updatedAtCol).setValue(now);
            
            markedCount++;
          }
          break;
        }
      }
    }

    // Update request total
    _updateRequestTotalFromStudents(requestId);

    invalidateCache('fund_collection');
    invalidateCache('fund_student_payments');

    return { 
      success: true, 
      markedCount: markedCount,
      message: `${markedCount} student payments marked successfully`
    };

  } catch (error) {
    console.error('Error bulk marking payments:', error);
    return { success: false, error: error.message };
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Generate unique fund collection request ID
 */
function _generateFundRequestId() {
  const year = new Date().getFullYear();
  const sh = _getSheet('FundCollectionRequests');
  const lastRow = sh.getLastRow();
  
  // Count existing requests this year
  let count = 1;
  if (lastRow > 1) {
    const headers = _headers(sh);
    const rows = _rows(sh);
    const yearPrefix = `FC-${year}-`;
    
    count = rows.filter(r => {
      const row = _indexByHeader(r, headers);
      return String(row.requestId || '').startsWith(yearPrefix);
    }).length + 1;
  }
  
  return `FC-${year}-${String(count).padStart(3, '0')}`;
}

/**
 * Generate unique deposit ID
 */
function _generateDepositId() {
  const year = new Date().getFullYear();
  const sh = _getSheet('FundDeposits');
  const lastRow = sh.getLastRow();
  
  let count = 1;
  if (lastRow > 1) {
    const headers = _headers(sh);
    const rows = _rows(sh);
    const yearPrefix = `FD-${year}-`;
    
    count = rows.filter(r => {
      const row = _indexByHeader(r, headers);
      return String(row.depositId || '').startsWith(yearPrefix);
    }).length + 1;
  }
  
  return `FD-${year}-${String(count).padStart(4, '0')}`;
}

/**
 * Notify HM/admin when teacher submits fund request
 */
function _notifyAdminFundRequest(request) {
  try {
    // Get HM and admin emails from Users sheet
    const usersData = _getCachedSheetData('Users').data;
    const approvers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('hm') || roles.includes('admin');
    });

    approvers.forEach(approver => {
      const subject = `Fund Collection Request: ${request.purpose}`;
      const body = `
Dear ${approver.name || 'Approver'},

A new fund collection request requires your approval:

Request ID: ${request.requestId}
Teacher: ${request.teacherName} (${request.teacherEmail})
Class: ${request.class}
Purpose: ${request.purpose}
Amount per Student: ₹${request.amountPerStudent}
Total Students: ${request.totalStudents}
Expected Amount: ₹${request.expectedAmount}
Collection Period: ${request.startDate} to ${request.endDate}

📋 Click here to review and approve:
https://workflow-wine.vercel.app/

(Navigate to Fund Collection Management → Approve Requests tab)

Best regards,
School Management System
      `;
      
      sendEmailNotification(admin.email, subject, body);
    });
  } catch (e) {
    console.error('Error notifying admin:', e);
  }
}

/**
 * Notify teacher when request is approved
 */
function _notifyTeacherFundApproval(request, approverEmail) {
  try {
    const subject = `Fund Collection Approved: ${request.purpose}`;
    const body = `
Dear ${request.teacherName},

Your fund collection request has been approved:

Request ID: ${request.requestId}
Purpose: ${request.purpose}
Class: ${request.class}
Expected Amount: ₹${request.expectedAmount}
Approved By: ${approverEmail}

You can now start collecting funds from students.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Notify teacher when request is rejected
 */
function _notifyTeacherFundRejection(request, rejectorEmail, reason) {
  try {
    const subject = `Fund Collection Rejected: ${request.purpose}`;
    const body = `
Dear ${request.teacherName},

Your fund collection request has been rejected:

Request ID: ${request.requestId}
Purpose: ${request.purpose}
Rejected By: ${rejectorEmail}
Reason: ${reason}

Please contact the administration if you have any questions.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Notify teacher when revision is requested
 */
function _notifyTeacherFundRevision(request, revisorEmail, revisionNotes) {
  try {
    const subject = `Revision Requested: ${request.purpose}`;
    const body = `
Dear ${request.teacherName},

Your fund collection request requires revision:

Request ID: ${request.requestId}
Purpose: ${request.purpose}
Requested By: ${revisorEmail}
Revision Notes: ${revisionNotes}

Please log in and update your request.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Notify accounts department when request is approved
 */
function _notifyAccountsFundApproval(request) {
  try {
    // Get accounts department emails
    const usersData = _getCachedSheetData('Users').data;
    const accountsUsers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('accounts');
    });

    accountsUsers.forEach(user => {
      const subject = `Fund Collection Approved: ${request.purpose}`;
      const body = `
Dear ${user.name || 'Accounts'},

A fund collection request has been approved (for your records):

Request ID: ${request.requestId}
Teacher: ${request.teacherName}
Class: ${request.class}
Purpose: ${request.purpose}
Expected Amount: ₹${request.expectedAmount}

Best regards,
School Management System
      `;
      
      sendEmailNotification(user.email, subject, body);
    });
  } catch (e) {
    console.error('Error notifying accounts:', e);
  }
}

/**
 * Notify accounts when collection is complete
 */
function _notifyAccountsFundComplete(request, collectedAmount) {
  try {
    const usersData = _getCachedSheetData('Users').data;
    const accountsUsers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('accounts');
    });

    accountsUsers.forEach(user => {
      const subject = `Fund Collection Complete - Acknowledgment Required: ${request.purpose}`;
      const body = `
Dear ${user.name || 'Accounts'},

A fund collection has been completed and requires your acknowledgment:

Request ID: ${request.requestId}
Teacher: ${request.teacherName}
Class: ${request.class}
Purpose: ${request.purpose}
Expected Amount: ₹${request.expectedAmount}
Collected Amount: ₹${collectedAmount}
Difference: ₹${Number(collectedAmount) - Number(request.expectedAmount)}

Please log in to acknowledge receipt of funds.

Best regards,
School Management System
      `;
      
      sendEmailNotification(user.email, subject, body);
    });
  } catch (e) {
    console.error('Error notifying accounts:', e);
  }
}

/**
 * Notify teacher when accounts acknowledges
 */
function _notifyTeacherFundAcknowledged(request, accountsEmail) {
  try {
    const subject = `Fund Collection Acknowledged: ${request.purpose}`;
    const body = `
Dear ${request.teacherName},

Your fund collection has been acknowledged by the accounts department:

Request ID: ${request.requestId}
Purpose: ${request.purpose}
Collected Amount: ₹${request.collectedAmount}
Acknowledged By: ${accountsEmail}

This request is now closed.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Notify accounts about new deposit
 */
function _notifyAccountsNewDeposit(request, depositId, depositAmount, newTotal) {
  try {
    const usersData = _getCachedSheetData('Users').data;
    const accountsUsers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('accounts');
    });

    const remaining = Number(request.expectedAmount) - Number(newTotal);

    accountsUsers.forEach(user => {
      const subject = `New Deposit - ${request.purpose}`;
      const body = `
Dear ${user.name || 'Accounts'},

A new deposit has been made for a fund collection:

Request ID: ${request.requestId}
Deposit ID: ${depositId}
Teacher: ${request.teacherName}
Class: ${request.class}
Purpose: ${request.purpose}
Deposit Amount: ₹${depositAmount}
Total Deposited: ₹${newTotal}
Expected Amount: ₹${request.expectedAmount}
Remaining: ₹${remaining}

📋 Click here to acknowledge this deposit:
https://workflow-wine.vercel.app/

(Navigate to Fund Collection Management → Accounts tab)

Best regards,
School Management System
      `;
      
      sendEmailNotification(user.email, subject, body);
    });
  } catch (e) {
    console.error('Error notifying accounts:', e);
  }
}

/**
 * Notify teacher when deposit is acknowledged
 */
function _notifyTeacherDepositAcknowledged(deposit, accountsEmail) {
  try {
    const subject = `Deposit Acknowledged: ${deposit.depositId}`;
    const body = `
Dear ${deposit.depositedByName},

Your deposit has been acknowledged by the accounts department:

Deposit ID: ${deposit.depositId}
Request ID: ${deposit.requestId}
Amount: ₹${deposit.depositAmount}
Deposit Date: ${deposit.depositDate}
Acknowledged By: ${accountsEmail}

Thank you.

Best regards,
School Administration
    `;
    
    sendEmailNotification(deposit.depositedBy, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Initialize student payment records when collection starts
 * Creates one record per student in the selectedStudents array
 * 
 * @param {string} requestId
 * @param {Object} request - The fund collection request object
 * @returns {Object} { success: boolean }
 */
function _initializeStudentPayments(requestId, request) {
  try {
    // Check if already initialized
    const existingPayments = getStudentPayments(requestId);
    if (existingPayments.success && existingPayments.students.length > 0) {
      return { success: true, message: 'Student payments already initialized' };
    }

    const sh = _getSheet('FundStudentPayments');
    _ensureHeaders(sh, ['paymentId', 'requestId', 'studentAdmNo', 'studentName', 
                        'expectedAmount', 'paidAmount', 'paymentStatus', 'paidDate', 
                        'markedBy', 'notes', 'createdAt', 'updatedAt']);

    // Get student details from Students sheet
    const studentsData = _getCachedSheetData('Students').data;
    
    // Parse selected students
    let selectedStudents = [];
    try {
      selectedStudents = JSON.parse(request.selectedStudents || '[]');
    } catch (e) {
      console.error('Error parsing selectedStudents:', e);
      return { success: false, error: 'Invalid selectedStudents data' };
    }

    if (selectedStudents.length === 0) {
      return { success: false, error: 'No students selected in request' };
    }

    const now = new Date().toISOString();
    const amountPerStudent = Number(request.amountPerStudent || 0);

    // Create payment record for each student
    for (const admNo of selectedStudents) {
      const student = studentsData.find(s => s.admNo === admNo);
      if (!student) {
        console.warn(`Student ${admNo} not found in Students sheet`);
        continue;
      }

      const paymentId = _generateStudentPaymentId();
      
      const row = [
        paymentId,
        requestId,
        admNo,
        student.name || '',
        amountPerStudent,
        0, // paidAmount
        'Pending', // paymentStatus
        '', // paidDate
        '', // markedBy
        '', // notes
        now, // createdAt
        '' // updatedAt
      ];

      sh.appendRow(row);
    }

    invalidateCache('fund_student_payments');
    
    return { 
      success: true, 
      message: `Initialized ${selectedStudents.length} student payment records`
    };

  } catch (error) {
    console.error('Error initializing student payments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate total collected from BOTH batch deposits AND student payments
 * 
 * @param {string} requestId
 * @returns {number} Total collected amount
 */
function _updateRequestTotalFromStudents(requestId) {
  return _recalculateTotalDeposited(requestId);
}

/**
 * Recalculate totalDeposited from all sources
 * Sums: acknowledged batch deposits + paid student payments
 * 
 * @param {string} requestId
 * @returns {number} New total
 */
function _recalculateTotalDeposited(requestId) {
  try {
    let total = 0;

    // 1. Sum ALL batch deposits from FundDeposits (acknowledged or not)
    const depositsSh = _getSheet('FundDeposits');
    const depositHeaders = _headers(depositsSh);
    const depositRows = depositsSh.getDataRange().getValues();

    for (let i = 1; i < depositRows.length; i++) {
      const deposit = _indexByHeader(depositRows[i], depositHeaders);
      if (deposit.requestId === requestId) {
        total += Number(deposit.depositAmount || 0);
      }
    }

    // 2. Sum all paid student payments from FundStudentPayments
    const paymentsResult = getStudentPayments(requestId);
    if (paymentsResult.success) {
      total += Number(paymentsResult.summary.totalCollected || 0);
    }

    // 3. Update FundCollectionRequests.totalDeposited
    const sh = _getSheet('FundCollectionRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        const totalDepositedCol = headers.indexOf('totalDeposited') + 1;
        sh.getRange(i + 1, totalDepositedCol).setValue(total);
        break;
      }
    }

    return total;

  } catch (error) {
    console.error('Error recalculating total deposited:', error);
    return 0;
  }
}

/**
 * Generate unique student payment ID
 * 
 * @returns {string} Payment ID (e.g., FSP-2026-0001)
 */
function _generateStudentPaymentId() {
  const year = new Date().getFullYear();
  const sh = _getSheet('FundStudentPayments');
  const lastRow = sh.getLastRow();
  
  let count = 1;
  if (lastRow > 1) {
    const headers = _headers(sh);
    const rows = _rows(sh);
    const yearPrefix = `FSP-${year}-`;
    
    count = rows.filter(r => {
      const row = _indexByHeader(r, headers);
      return String(row.paymentId || '').startsWith(yearPrefix);
    }).length + 1;
  }
  
  return `FSP-${year}-${String(count).padStart(4, '0')}`;
}
