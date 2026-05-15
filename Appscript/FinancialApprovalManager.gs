/**
 * ====== FINANCIAL APPROVAL MANAGEMENT SYSTEM ======
 * This file provides consolidated views and dashboards for financial requests
 * 
 * Key Features:
 * - Unified approval dashboard for HM/admin
 * - Accounts department dashboard for pending actions
 * - Financial analytics and reporting
 * - Role-based data access
 */

/**
 * Get unified dashboard for HM/admin
 * Shows all pending approvals and recent activity
 * 
 * @param {string} userEmail - HM/admin email
 * @returns {Object} Dashboard data with pending items and statistics
 */
function getAdminFinancialDashboard(userEmail) {
  try {
    // Get pending fund collection requests
    const pendingFundRequests = getAllFundRequests('Pending');
    const revisedFundRequests = getAllFundRequests('Revised');
    
    // Get pending expense requests
    const pendingExpenseRequests = _getExpenseRequestsData('Pending');
    
    // Get recent approvals (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = _isoDateString(thirtyDaysAgo);
    
    const allFundRequests = getAllFundRequests();
    const recentFundApprovals = allFundRequests.requests.filter(r => {
      return r.status === 'Approved' && r.approvedAt && _isoDateString(r.approvedAt) >= startDate;
    });
    
    const allExpenseRequests = _getExpenseRequestsData();
    const recentExpenseApprovals = allExpenseRequests.requests.filter(r => {
      return r.status === 'Approved' && r.approvedAt && _isoDateString(r.approvedAt) >= startDate;
    });
    
    // Calculate statistics
    const stats = {
      pendingFundRequests: pendingFundRequests.count + revisedFundRequests.count,
      pendingExpenseRequests: pendingExpenseRequests.count,
      totalPendingApprovals: pendingFundRequests.count + revisedFundRequests.count + pendingExpenseRequests.count,
      recentFundApprovals: recentFundApprovals.length,
      recentExpenseApprovals: recentExpenseApprovals.length,
      pendingFundAmount: _sumExpectedAmount(pendingFundRequests.requests) + _sumExpectedAmount(revisedFundRequests.requests),
      pendingExpenseAmount: _sumRequestAmount(pendingExpenseRequests.requests)
    };
    
    return {
      success: true,
      userEmail: userEmail,
      role: 'Admin/HM',
      stats: stats,
      pendingActions: {
        fundRequests: [...pendingFundRequests.requests, ...revisedFundRequests.requests],
        expenseRequests: pendingExpenseRequests.requests
      },
      recentActivity: {
        fundApprovals: recentFundApprovals,
        expenseApprovals: recentExpenseApprovals
      }
    };

  } catch (error) {
    console.error('Error getting admin financial dashboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get dashboard for Accounts Department
 * Shows items requiring acknowledgment or disbursement
 * 
 * @param {string} userEmail - Accounts user email
 * @returns {Object} Dashboard data with pending actions
 */
function getAccountsFinancialDashboard(userEmail) {
  try {
    // Get approved fund requests (not yet completed)
    const approvedFundRequests = getAllFundRequests('Approved');
    
    // Get completed fund requests (awaiting acknowledgment)
    const completedFundRequests = getAllFundRequests('Completed');
    const unacknowledgedFunds = completedFundRequests.requests.filter(r => {
      return !r.acknowledgedBy;
    });
    
    // Get approved expense requests (awaiting disbursement)
    const approvedExpenseRequests = _getExpenseRequestsData('Approved');
    
    // Get disbursed items (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = _isoDateString(thirtyDaysAgo);
    
    const allExpenseRequests = _getExpenseRequestsData();
    const recentDisbursements = allExpenseRequests.requests.filter(r => {
      return r.status === 'Disbursed' && r.disbursedAt && _isoDateString(r.disbursedAt) >= startDate;
    });
    
    const allFundRequests = getAllFundRequests();
    const recentAcknowledgments = allFundRequests.requests.filter(r => {
      return r.status === 'Completed' && r.acknowledgedAt && _isoDateString(r.acknowledgedAt) >= startDate;
    });
    
    // Calculate statistics
    const stats = {
      pendingDisbursements: approvedExpenseRequests.count,
      pendingAcknowledgments: unacknowledgedFunds.length,
      totalPendingActions: approvedExpenseRequests.count + unacknowledgedFunds.length,
      approvedFundCollections: approvedFundRequests.count,
      recentDisbursements: recentDisbursements.length,
      recentAcknowledgments: recentAcknowledgments.length,
      pendingDisbursementAmount: _sumRequestAmount(approvedExpenseRequests.requests),
      pendingAcknowledgmentAmount: _sumCollectedAmount(unacknowledgedFunds)
    };
    
    return {
      success: true,
      userEmail: userEmail,
      role: 'Accounts',
      stats: stats,
      pendingActions: {
        expensesToDisburse: approvedExpenseRequests.requests,
        fundsToAcknowledge: unacknowledgedFunds,
        approvedFundCollections: approvedFundRequests.requests
      },
      recentActivity: {
        disbursements: recentDisbursements,
        acknowledgments: recentAcknowledgments
      }
    };

  } catch (error) {
    console.error('Error getting accounts financial dashboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get teacher's financial dashboard
 * Shows all their fund and expense requests
 * 
 * @param {string} teacherEmail
 * @returns {Object} Dashboard data with teacher's requests
 */
function getTeacherFinancialDashboard(teacherEmail) {
  try {
    // Get teacher's fund requests
    const fundRequests = getTeacherFundRequests(teacherEmail);
    
    // Get teacher's expense requests
    const expenseRequests = getTeacherExpenseRequests(teacherEmail);
    
    // Group by status
    const fundByStatus = _groupByStatus(fundRequests.requests);
    const expenseByStatus = _groupByStatus(expenseRequests.requests);
    
    // Calculate statistics
    const stats = {
      totalFundRequests: fundRequests.count,
      totalExpenseRequests: expenseRequests.count,
      pendingFundRequests: (fundByStatus.Pending || []).length + (fundByStatus.Revised || []).length,
      pendingExpenseRequests: (expenseByStatus.Pending || []).length,
      approvedFundRequests: (fundByStatus.Approved || []).length,
      approvedExpenseRequests: (expenseByStatus.Approved || []).length,
      completedFundRequests: (fundByStatus.Completed || []).length,
      disbursedExpenses: (expenseByStatus.Disbursed || []).length,
      totalFundExpected: _sumExpectedAmount(fundRequests.requests.filter(r => 
        r.status === 'Approved' || r.status === 'In Progress' || r.status === 'Completed'
      )),
      totalExpenseApproved: _sumRequestAmount(expenseRequests.requests.filter(r => 
        r.status === 'Approved' || r.status === 'Disbursed'
      ))
    };
    
    return {
      success: true,
      teacherEmail: teacherEmail,
      role: 'Teacher',
      stats: stats,
      fundRequests: fundRequests.requests,
      expenseRequests: expenseRequests.requests,
      fundByStatus: fundByStatus,
      expenseByStatus: expenseByStatus
    };

  } catch (error) {
    console.error('Error getting teacher financial dashboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get comprehensive financial report
 * For HM/admin analytics and reporting
 * 
 * @param {Object} params
 *   - startDate, endDate: optional date range
 *   - includeDetails: boolean (default false)
 * @returns {Object} Comprehensive financial report
 */
function getFinancialReport(params = {}) {
  try {
    const startDate = params.startDate ? _isoDateString(params.startDate) : null;
    const endDate = params.endDate ? _isoDateString(params.endDate) : null;
    const includeDetails = params.includeDetails === true;
    
    // Get all fund collection requests
    const allFundRequests = getAllFundRequests().requests;
    let fundRequests = allFundRequests;
    
    if (startDate) {
      fundRequests = fundRequests.filter(r => _isoDateString(r.createdAt) >= startDate);
    }
    if (endDate) {
      fundRequests = fundRequests.filter(r => _isoDateString(r.createdAt) <= endDate);
    }
    
    // Get all expense requests
    const allExpenseRequests = _getExpenseRequestsData().requests;
    let expenseRequests = allExpenseRequests;
    
    if (startDate) {
      expenseRequests = expenseRequests.filter(r => _isoDateString(r.createdAt) >= startDate);
    }
    if (endDate) {
      expenseRequests = expenseRequests.filter(r => _isoDateString(r.createdAt) <= endDate);
    }
    
    // Fund Collection Summary
    const fundSummary = {
      totalRequests: fundRequests.length,
      byStatus: _countByStatus(fundRequests),
      totalExpected: _sumExpectedAmount(fundRequests),
      totalCollected: _sumCollectedAmount(fundRequests.filter(r => r.status === 'Completed')),
      acknowledged: _sumCollectedAmount(fundRequests.filter(r => r.acknowledgedBy)),
      byClass: _groupAndSumByField(fundRequests, 'class', 'expectedAmount'),
      byTeacher: _groupAndSumByField(fundRequests, 'teacherEmail', 'expectedAmount')
    };
    
    // Expense Request Summary
    const expenseSummary = {
      totalRequests: expenseRequests.length,
      byStatus: _countByStatus(expenseRequests),
      totalRequested: _sumRequestAmount(expenseRequests),
      totalApproved: _sumRequestAmount(expenseRequests.filter(r => 
        r.status === 'Approved' || r.status === 'Disbursed'
      )),
      totalDisbursed: _sumRequestAmount(expenseRequests.filter(r => r.status === 'Disbursed')),
      byCategory: _groupAndSumByField(expenseRequests, 'category', 'amount'),
      byTeacher: _groupAndSumByField(expenseRequests, 'teacherEmail', 'amount')
    };
    
    // Overall Financial Summary
    const overallSummary = {
      totalInflow: fundSummary.totalCollected,
      totalOutflow: expenseSummary.totalDisbursed,
      netBalance: fundSummary.totalCollected - expenseSummary.totalDisbursed,
      pendingInflow: fundSummary.totalExpected - fundSummary.totalCollected,
      pendingOutflow: expenseSummary.totalApproved - expenseSummary.totalDisbursed
    };
    
    const result = {
      success: true,
      dateRange: {
        startDate: startDate,
        endDate: endDate
      },
      overallSummary: overallSummary,
      fundCollections: fundSummary,
      expenses: expenseSummary
    };
    
    if (includeDetails) {
      result.fundCollectionDetails = fundRequests;
      result.expenseDetails = expenseRequests;
    }
    
    return result;

  } catch (error) {
    console.error('Error getting financial report:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending approval count for a user (for notification badge)
 * 
 * @param {string} userEmail
 * @param {string} userRole - 'admin', 'hm', 'accounts', 'teacher'
 * @returns {Object} Count of pending items requiring action
 */
function getPendingFinancialCount(userEmail, userRole) {
  try {
    const role = String(userRole || '').toLowerCase();
    let count = 0;
    
    if (role === 'hm' || role.includes('admin')) {
      const pendingFund = getAllFundRequests('Pending').count;
      const revisedFund = getAllFundRequests('Revised').count;
      const pendingExpense = _getExpenseRequestsData('Pending').count;
      count = pendingFund + revisedFund + pendingExpense;
    } else if (role === 'accounts') {
      const approvedExpense = _getExpenseRequestsData('Approved').count;
      const completedFund = getAllFundRequests('Completed').requests.filter(r => !r.acknowledgedBy).length;
      count = approvedExpense + completedFund;
    } else if (role === 'teacher') {
      // For teachers, count items that require their action
      const teacherFund = getTeacherFundRequests(userEmail);
      const teacherExpense = getTeacherExpenseRequests(userEmail);
      
      // Count revised fund requests (need teacher to re-submit)
      const revisedFund = teacherFund.requests.filter(r => r.status === 'Revised').length;
      count = revisedFund;
    }
    
    return {
      success: true,
      userEmail: userEmail,
      userRole: userRole,
      pendingCount: count
    };

  } catch (error) {
    console.error('Error getting pending financial count:', error);
    return { success: false, error: error.message, pendingCount: 0 };
  }
}

/**
 * Get financial activity log (recent actions)
 * 
 * @param {Object} params
 *   - limit: number of records (default 50)
 *   - type: 'fund' or 'expense' (optional)
 * @returns {Object} Recent activity log
 */
function getFinancialActivityLog(params = {}) {
  try {
    const limit = params.limit || 50;
    const type = params.type ? String(params.type).toLowerCase() : null;
    
    const activities = [];
    
    if (!type || type === 'fund') {
      const fundRequests = getAllFundRequests().requests;
      fundRequests.forEach(r => {
        if (r.submittedAt) {
          activities.push({
            timestamp: r.submittedAt,
            type: 'fund',
            action: 'submitted',
            requestId: r.requestId,
            userEmail: r.teacherEmail,
            userName: r.teacherName,
            amount: r.expectedAmount,
            status: r.status
          });
        }
        if (r.approvedAt) {
          activities.push({
            timestamp: r.approvedAt,
            type: 'fund',
            action: 'approved',
            requestId: r.requestId,
            userEmail: r.approvedBy,
            amount: r.expectedAmount,
            status: r.status
          });
        }
        if (r.rejectedAt) {
          activities.push({
            timestamp: r.rejectedAt,
            type: 'fund',
            action: 'rejected',
            requestId: r.requestId,
            userEmail: r.rejectedBy,
            amount: r.expectedAmount,
            reason: r.rejectionReason
          });
        }
        if (r.acknowledgedAt) {
          activities.push({
            timestamp: r.acknowledgedAt,
            type: 'fund',
            action: 'acknowledged',
            requestId: r.requestId,
            userEmail: r.acknowledgedBy,
            amount: r.collectedAmount,
            status: r.status
          });
        }
      });
    }
    
    if (!type || type === 'expense') {
      const expenseRequests = _getExpenseRequestsData().requests;
      expenseRequests.forEach(r => {
        if (r.submittedAt) {
          activities.push({
            timestamp: r.submittedAt,
            type: 'expense',
            action: 'submitted',
            requestId: r.requestId,
            userEmail: r.teacherEmail,
            userName: r.teacherName,
            amount: r.amount,
            status: r.status
          });
        }
        if (r.approvedAt) {
          activities.push({
            timestamp: r.approvedAt,
            type: 'expense',
            action: 'approved',
            requestId: r.requestId,
            userEmail: r.approvedBy,
            amount: r.amount,
            status: r.status
          });
        }
        if (r.rejectedAt) {
          activities.push({
            timestamp: r.rejectedAt,
            type: 'expense',
            action: 'rejected',
            requestId: r.requestId,
            userEmail: r.rejectedBy,
            amount: r.amount,
            reason: r.rejectionReason
          });
        }
        if (r.disbursedAt) {
          activities.push({
            timestamp: r.disbursedAt,
            type: 'expense',
            action: 'disbursed',
            requestId: r.requestId,
            userEmail: r.disbursedBy,
            amount: r.amount,
            status: r.status
          });
        }
      });
    }
    
    // Sort by timestamp descending (newest first)
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB - dateA;
    });
    
    // Limit results
    const limitedActivities = activities.slice(0, limit);
    
    return {
      success: true,
      count: limitedActivities.length,
      totalActivities: activities.length,
      activities: limitedActivities
    };

  } catch (error) {
    console.error('Error getting financial activity log:', error);
    return { success: false, error: error.message, activities: [] };
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Sum expected amount from fund collection requests
 */
function _sumExpectedAmount(requests) {
  return requests.reduce((sum, r) => sum + Number(r.expectedAmount || 0), 0);
}

/**
 * Sum collected amount from fund collection requests
 */
function _sumCollectedAmount(requests) {
  return requests.reduce((sum, r) => sum + Number(r.collectedAmount || 0), 0);
}

/**
 * Sum amount from expense requests
 */
function _sumRequestAmount(requests) {
  return requests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

/**
 * Group requests by status
 */
function _groupByStatus(requests) {
  const grouped = {};
  requests.forEach(r => {
    const status = r.status || 'Unknown';
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(r);
  });
  return grouped;
}

/**
 * Count requests by status
 */
function _countByStatus(requests) {
  const counts = {};
  requests.forEach(r => {
    const status = r.status || 'Unknown';
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

/**
 * Group and sum by a specific field
 */
function _groupAndSumByField(requests, groupField, sumField) {
  const grouped = {};
  requests.forEach(r => {
    const key = r[groupField] || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = { count: 0, total: 0 };
    }
    grouped[key].count++;
    grouped[key].total += Number(r[sumField] || 0);
  });
  
  // Convert to array and sort by total descending
  return Object.entries(grouped)
    .map(([key, val]) => ({ [groupField]: key, count: val.count, total: val.total }))
    .sort((a, b) => b.total - a.total);
}
