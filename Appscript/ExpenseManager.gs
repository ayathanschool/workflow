/**
 * ====== EXPENSE REIMBURSEMENT MANAGEMENT SYSTEM ======
 * This file handles expense reimbursement requests from teachers
 * 
 * Key Features:
 * - Teachers create expense/reimbursement requests
 * - Optional digital receipt upload (Drive file link)
 * - Multi-step approval workflow: Admin → Accounts
 * - Accounts department processes payout and marks as "Disbursed"
 * - Status tracking: Draft, Pending, Approved, Disbursed, Rejected
 */

/**
 * Create a new expense reimbursement request
 * 
 * @param {Object} data
 *   - teacherEmail: string (creator)
 *   - amount: number
 *   - reason: string (description of expense)
 *   - category: string (e.g., "Travel", "Materials", "Professional Development")
 *   - expenseDate: string (YYYY-MM-DD) - when the expense was incurred
 *   - receiptUrl: string (optional - Google Drive link or uploaded file URL)
 *   - notes: string (optional additional details)
 * @returns {Object} { success: true, requestId: 'EXP-2026-001' }
 */
function createExpenseRequest(data) {
  try {
    if (!data || !data.teacherEmail || !data.amount || !data.reason) {
      return { success: false, error: 'teacherEmail, amount, and reason are required' };
    }

    if (Number(data.amount) <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    const sh = _getSheet('ExpenseRequests');
    _ensureHeaders(sh, ['requestId', 'teacherEmail', 'teacherName', 'amount', 'reason', 'category', 
                        'expenseDate', 'receiptUrl', 'notes', 'status', 'createdAt', 'submittedAt', 
                        'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionReason', 
                        'disbursedBy', 'disbursedAt', 'disbursementMode', 'disbursementReference']);

    const normalizedExpenseDate = _isoDateString(data.expenseDate || new Date());

    // Generate unique request ID
    const requestId = _generateExpenseRequestId();
    
    // Get teacher name
    const teacherName = _getTeacherName(data.teacherEmail);
    
    const now = new Date().toISOString();
    
    const row = [
      requestId,
      data.teacherEmail,
      teacherName,
      Number(data.amount),
      data.reason,
      data.category || 'General',
      normalizedExpenseDate,
      data.receiptUrl || '',
      data.notes || '',
      'Draft', // status
      now, // createdAt
      '', // submittedAt
      '', // approvedBy
      '', // approvedAt
      '', // rejectedBy
      '', // rejectedAt
      '', // rejectionReason
      '', // disbursedBy
      '', // disbursedAt
      '', // disbursementMode
      '' // disbursementReference
    ];

    sh.appendRow(row);
    
    invalidateCache('expense_requests');
    
    return { 
      success: true, 
      requestId: requestId,
      amount: Number(data.amount)
    };

  } catch (error) {
    console.error('Error creating expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit expense request for approval
 * Changes status from Draft to Pending
 */
function submitExpenseRequest(requestId) {
  try {
    const sh = _getSheet('ExpenseRequests');
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

        invalidateCache('expense_requests');
        
        // Send notification to admin
        _notifyAdminExpenseRequest(row);
        
        return { success: true, message: 'Request submitted for approval' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error submitting expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get expense requests for a teacher
 */
function getTeacherExpenseRequests(teacherEmail, status = '') {
  try {
    const allRequests = _getCachedSheetData('ExpenseRequests').data;
    
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

    return {
      success: true,
      teacherEmail: teacherEmail,
      count: requests.length,
      requests: requests
    };

  } catch (error) {
    console.error('Error getting teacher expense requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Get all expense requests for admin/accounts
 */
/**
 * Internal helper — reads expense requests without role check.
 * Used by backend-to-backend calls (dashboards, reports, counts).
 *
 * @param {string} status   - Optional status filter
 * @param {string} category - Optional category filter
 * @returns {Object} { success: true, count: number, requests: Array }
 */
function _getExpenseRequestsData(status = '', category = '') {
  try {
    const allRequests = _getCachedSheetData('ExpenseRequests').data;
    let requests = allRequests;

    if (status) {
      const statusFilter = String(status).toLowerCase().trim();
      requests = requests.filter(r =>
        String(r.status || '').toLowerCase() === statusFilter
      );
    }

    if (category) {
      const categoryFilter = String(category).toLowerCase().trim();
      requests = requests.filter(r =>
        String(r.category || '').toLowerCase().trim() === categoryFilter
      );
    }

    requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return { success: true, count: requests.length, requests: requests };
  } catch (error) {
    console.error('Error in _getExpenseRequestsData:', error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Get all expense requests for admin/accounts
 * Enforces role-based access control
 *
 * @param {string} userEmail - Email of requesting user
 * @param {string} status - Optional status filter
 * @param {string} category - Optional category filter
 * @returns {Object} { success: boolean, requests: Array }
 */
function getAllExpenseRequests(userEmail, status = '', category = '') {
  try {
    // Enforce role-based access control
    if (!userEmail) {
      return { success: false, error: 'User email required', requests: [] };
    }
    
    const isSuperAdmin = userHasRole(userEmail, 'admin');
    const isHM = userHasRole(userEmail, 'hm');
    const isAccounts = userHasRole(userEmail, 'accounts');
    
    if (!isSuperAdmin && !isHM && !isAccounts) {
      return { success: false, error: 'Unauthorized: admin, HM or Accounts role required', requests: [] };
    }
    
    const allRequests = _getCachedSheetData('ExpenseRequests').data;
    
    let requests = allRequests;

    if (status) {
      const statusFilter = String(status).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.status || '').toLowerCase() === statusFilter
      );
    }

    if (category) {
      const categoryFilter = String(category).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.category || '').toLowerCase().trim() === categoryFilter
      );
    }

    // Sort by createdAt descending (newest first)
    requests.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    return {
      success: true,
      count: requests.length,
      requests: requests
    };

  } catch (error) {
    console.error('Error getting all expense requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Approve expense request (HM/admin action)
 */
function approveExpenseRequest(requestId, approverEmail, notes = '') {
  try {
    // Validate HM or admin role
    if (!userHasRole(approverEmail, 'hm') && !userHasRole(approverEmail, 'admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }
    
    const sh = _getSheet('ExpenseRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Pending') {
          return { success: false, error: 'Only pending requests can be approved' };
        }

        const now = new Date().toISOString();
        const statusCol = headers.indexOf('status') + 1;
        const approvedByCol = headers.indexOf('approvedBy') + 1;
        const approvedAtCol = headers.indexOf('approvedAt') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Approved');
        sh.getRange(i + 1, approvedByCol).setValue(approverEmail);
        sh.getRange(i + 1, approvedAtCol).setValue(now);

        invalidateCache('expense_requests');
        
        // Notify teacher
        _notifyTeacherExpenseApproval(row, approverEmail, notes);
        
        // Notify accounts department for disbursement
        _notifyAccountsExpenseApproval(row);
        
        return { success: true, message: 'Request approved successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error approving expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject expense request (Admin action)
 * Enforces role-based access control
 */
function rejectExpenseRequest(requestId, rejectorEmail, reason) {
  try {
    // Validate HM or admin role
    if (!userHasRole(rejectorEmail, 'hm') && !userHasRole(rejectorEmail, 'admin')) {
      return { success: false, error: 'Unauthorized: HM or admin role required' };
    }
    
    if (!reason) {
      return { success: false, error: 'Rejection reason is required' };
    }

    const sh = _getSheet('ExpenseRequests');
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

        invalidateCache('expense_requests');
        
        // Notify teacher
        _notifyTeacherExpenseRejection(row, rejectorEmail, reason);
        
        return { success: true, message: 'Request rejected' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error rejecting expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update expense request (teacher editing draft)
 */
function updateExpenseRequest(requestId, data) {
  try {
    const sh = _getSheet('ExpenseRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Draft') {
          return { success: false, error: 'Only draft requests can be updated' };
        }

        // Update allowed fields
        if (data.amount !== undefined) {
          const amountCol = headers.indexOf('amount') + 1;
          sh.getRange(i + 1, amountCol).setValue(Number(data.amount));
        }
        if (data.reason) {
          const reasonCol = headers.indexOf('reason') + 1;
          sh.getRange(i + 1, reasonCol).setValue(data.reason);
        }
        if (data.category) {
          const categoryCol = headers.indexOf('category') + 1;
          sh.getRange(i + 1, categoryCol).setValue(data.category);
        }
        if (data.expenseDate) {
          const expenseDateCol = headers.indexOf('expenseDate') + 1;
          sh.getRange(i + 1, expenseDateCol).setValue(_isoDateString(data.expenseDate));
        }
        if (data.receiptUrl !== undefined) {
          const receiptUrlCol = headers.indexOf('receiptUrl') + 1;
          sh.getRange(i + 1, receiptUrlCol).setValue(data.receiptUrl);
        }
        if (data.notes !== undefined) {
          const notesCol = headers.indexOf('notes') + 1;
          sh.getRange(i + 1, notesCol).setValue(data.notes);
        }

        invalidateCache('expense_requests');
        
        return { success: true, message: 'Request updated successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error updating expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Disburse expense (Accounts department marks payment as complete)
 * Enforces role-based access control
 * 
 * @param {string} requestId
 * @param {string} accountsEmail
 * @param {string} disbursementMode - e.g., "Cash", "Cheque", "Bank Transfer", "UPI"
 * @param {string} disbursementReference - e.g., cheque number, transaction ID
 */
function disburseExpense(requestId, accountsEmail, disbursementMode = '', disbursementReference = '') {
  try {
    // Validate accounts role
    if (!userHasRole(accountsEmail, 'accounts')) {
      return { success: false, error: 'Unauthorized: Accounts role required' };
    }
    
    const sh = _getSheet('ExpenseRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        if (row.status !== 'Approved') {
          return { success: false, error: 'Only approved requests can be disbursed' };
        }

        const now = new Date().toISOString();
        const statusCol = headers.indexOf('status') + 1;
        const disbursedByCol = headers.indexOf('disbursedBy') + 1;
        const disbursedAtCol = headers.indexOf('disbursedAt') + 1;
        const disbursementModeCol = headers.indexOf('disbursementMode') + 1;
        const disbursementReferenceCol = headers.indexOf('disbursementReference') + 1;
        
        sh.getRange(i + 1, statusCol).setValue('Disbursed');
        sh.getRange(i + 1, disbursedByCol).setValue(accountsEmail);
        sh.getRange(i + 1, disbursedAtCol).setValue(now);
        sh.getRange(i + 1, disbursementModeCol).setValue(disbursementMode);
        sh.getRange(i + 1, disbursementReferenceCol).setValue(disbursementReference);

        invalidateCache('expense_requests');
        
        // Notify teacher
        _notifyTeacherExpenseDisbursed(row, accountsEmail, disbursementMode, disbursementReference);
        
        return { success: true, message: 'Expense disbursed successfully' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error disbursing expense:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete expense request (only drafts can be deleted)
 */
function deleteExpenseRequest(requestId, teacherEmail) {
  try {
    const sh = _getSheet('ExpenseRequests');
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
        invalidateCache('expense_requests');
        
        return { success: true, message: 'Request deleted' };
      }
    }
    
    return { success: false, error: 'Request not found' };

  } catch (error) {
    console.error('Error deleting expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin delete expense request (can delete any status)
 * 
 * @param {string} requestId
 * @param {string} adminEmail
 * @returns {Object} { success: boolean, message?: string, error?: string }
 */
function adminDeleteExpenseRequest(requestId, adminEmail) {
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

    const sh = _getSheet('ExpenseRequests');
    const headers = _headers(sh);
    const rows = sh.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row = _indexByHeader(rows[i], headers);
      
      if (row.requestId === requestId) {
        // Log deletion for audit trail
        logAdminAction({
          action: 'DELETE_EXPENSE_REQUEST',
          adminEmail: adminEmail,
          requestId: requestId,
          teacherEmail: row.teacherEmail,
          amount: row.amount,
          status: row.status,
          category: row.category,
          reason: row.reason
        });

        sh.deleteRow(i + 1);
        invalidateCache('expense_requests');
        
        // Notify teacher about deletion
        try {
          const subject = `Expense Request Deleted: ${row.reason}`;
          const body = `
Dear ${row.teacherName},

Your expense reimbursement request has been deleted by administration:

Request ID: ${row.requestId}
Amount: ₹${row.amount}
Category: ${row.category}
Reason: ${row.reason}
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
    console.error('Error in admin delete expense request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get expense categories for dropdown
 */
function getExpenseCategories() {
  return {
    success: true,
    categories: [
      'Travel',
      'Materials',
      'Professional Development',
      'Books & Resources',
      'Event Expenses',
      'Technology',
      'Office Supplies',
      'Student Activities',
      'Other'
    ]
  };
}

/**
 * Get expense summary/analytics
 * 
 * @param {Object} params
 *   - startDate, endDate: optional date range
 *   - teacherEmail: optional filter by teacher
 *   - category: optional filter by category
 *   - status: optional filter by status
 */
function getExpenseSummary(params = {}) {
  try {
    const allRequests = _getCachedSheetData('ExpenseRequests').data;
    
    let requests = allRequests;

    // Apply filters
    if (params.startDate) {
      const start = _isoDateString(params.startDate);
      requests = requests.filter(r => _isoDateString(r.createdAt) >= start);
    }
    if (params.endDate) {
      const end = _isoDateString(params.endDate);
      requests = requests.filter(r => _isoDateString(r.createdAt) <= end);
    }
    if (params.teacherEmail) {
      const email = String(params.teacherEmail).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.teacherEmail || '').toLowerCase().trim() === email
      );
    }
    if (params.category) {
      const cat = String(params.category).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.category || '').toLowerCase().trim() === cat
      );
    }
    if (params.status) {
      const stat = String(params.status).toLowerCase().trim();
      requests = requests.filter(r => 
        String(r.status || '').toLowerCase() === stat
      );
    }

    // Calculate summary
    const summary = {
      totalRequests: requests.length,
      totalAmount: 0,
      approvedAmount: 0,
      disbursedAmount: 0,
      pendingAmount: 0,
      byStatus: {},
      byCategory: {},
      byTeacher: {}
    };

    requests.forEach(r => {
      const amount = Number(r.amount || 0);
      const status = String(r.status || 'Unknown');
      const category = String(r.category || 'Other');
      const teacher = String(r.teacherEmail || 'Unknown');

      summary.totalAmount += amount;

      if (status === 'Approved' || status === 'Disbursed') {
        summary.approvedAmount += amount;
      }
      if (status === 'Disbursed') {
        summary.disbursedAmount += amount;
      }
      if (status === 'Pending') {
        summary.pendingAmount += amount;
      }

      // By status
      if (!summary.byStatus[status]) {
        summary.byStatus[status] = { count: 0, amount: 0 };
      }
      summary.byStatus[status].count++;
      summary.byStatus[status].amount += amount;

      // By category
      if (!summary.byCategory[category]) {
        summary.byCategory[category] = { count: 0, amount: 0 };
      }
      summary.byCategory[category].count++;
      summary.byCategory[category].amount += amount;

      // By teacher
      if (!summary.byTeacher[teacher]) {
        summary.byTeacher[teacher] = { count: 0, amount: 0 };
      }
      summary.byTeacher[teacher].count++;
      summary.byTeacher[teacher].amount += amount;
    });

    return {
      success: true,
      summary: summary,
      filters: params
    };

  } catch (error) {
    console.error('Error getting expense summary:', error);
    return { success: false, error: error.message };
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Generate unique expense request ID
 */
function _generateExpenseRequestId() {
  const year = new Date().getFullYear();
  const sh = _getSheet('ExpenseRequests');
  const lastRow = sh.getLastRow();
  
  // Count existing requests this year
  let count = 1;
  if (lastRow > 1) {
    const headers = _headers(sh);
    const rows = _rows(sh);
    const yearPrefix = `EXP-${year}-`;
    
    count = rows.filter(r => {
      const row = _indexByHeader(r, headers);
      return String(row.requestId || '').startsWith(yearPrefix);
    }).length + 1;
  }
  
  return `EXP-${year}-${String(count).padStart(3, '0')}`;
}

/**
 * Notify admin when teacher submits expense request
 */
function _notifyAdminExpenseRequest(request) {
  try {
    // Get HM and admin emails from Users sheet
    const usersData = _getCachedSheetData('Users').data;
    const approvers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('hm') || roles.includes('admin');
    });

    approvers.forEach(approver => {
      const subject = `Expense Reimbursement Request: ${request.reason}`;
      const body = `
Dear ${approver.name || 'Approver'},

A new expense reimbursement request requires your approval:

Request ID: ${request.requestId}
Teacher: ${request.teacherName} (${request.teacherEmail})
Amount: ₹${request.amount}
Category: ${request.category}
Reason: ${request.reason}
Expense Date: ${request.expenseDate}
${request.receiptUrl ? 'Receipt: ' + request.receiptUrl : 'No receipt attached'}

📋 Click here to review and approve:
https://workflow-wine.vercel.app/

(Navigate to Expense Management → Approve Requests tab)

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
 * Notify teacher when expense request is approved
 */
function _notifyTeacherExpenseApproval(request, approverEmail, notes) {
  try {
    const subject = `Expense Request Approved: ${request.reason}`;
    const body = `
Dear ${request.teacherName},

Your expense reimbursement request has been approved:

Request ID: ${request.requestId}
Amount: ₹${request.amount}
Reason: ${request.reason}
Approved By: ${approverEmail}
${notes ? 'Notes: ' + notes : ''}

The accounts department will process your payment shortly.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}

/**
 * Notify teacher when expense request is rejected
 */
function _notifyTeacherExpenseRejection(request, rejectorEmail, reason) {
  try {
    const subject = `Expense Request Rejected: ${request.reason}`;
    const body = `
Dear ${request.teacherName},

Your expense reimbursement request has been rejected:

Request ID: ${request.requestId}
Amount: ₹${request.amount}
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
 * Notify accounts department when expense is approved
 */
function _notifyAccountsExpenseApproval(request) {
  try {
    // Get accounts department emails
    const usersData = _getCachedSheetData('Users').data;
    const accountsUsers = usersData.filter(u => {
      const roles = String(u.roles || '').toLowerCase();
      return roles.includes('accounts');
    });

    accountsUsers.forEach(user => {
      const subject = `Expense Approved - Disbursement Required: ${request.reason}`;
      const body = `
Dear ${user.name || 'Accounts'},

An expense reimbursement has been approved and requires disbursement:

Request ID: ${request.requestId}
Teacher: ${request.teacherName} (${request.teacherEmail})
Amount: ₹${request.amount}
Category: ${request.category}
Reason: ${request.reason}
${request.receiptUrl ? 'Receipt: ' + request.receiptUrl : 'No receipt attached'}

📋 Click here to disburse payment:
https://workflow-wine.vercel.app/

(Navigate to Expense Management → Disburse Expenses tab)

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
 * Notify teacher when expense is disbursed
 */
function _notifyTeacherExpenseDisbursed(request, accountsEmail, mode, reference) {
  try {
    const subject = `Expense Disbursed: ${request.reason}`;
    const body = `
Dear ${request.teacherName},

Your expense reimbursement has been disbursed:

Request ID: ${request.requestId}
Amount: ₹${request.amount}
Disbursement Mode: ${mode || 'N/A'}
${reference ? 'Reference: ' + reference : ''}
Processed By: ${accountsEmail}

This request is now closed.

Best regards,
School Administration
    `;
    
    sendEmailNotification(request.teacherEmail, subject, body);
  } catch (e) {
    console.error('Error notifying teacher:', e);
  }
}
