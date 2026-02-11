/**
 * AuditLogger.gs
 * Comprehensive audit logging system for tracking all system changes
 * Provides accountability, compliance, and debugging capabilities
 */

/**
 * Audit action types
 */
const AUDIT_ACTIONS = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
  APPROVE: 'approved',
  REJECT: 'rejected',
  SUBMIT: 'submitted',
  CANCEL: 'cancelled',
  REOPEN: 'reopened',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'exported',
  IMPORT: 'imported',
  ASSIGN: 'assigned',
  ACKNOWLEDGE: 'acknowledged',
  VERIFY: 'verified',
  CASCADE_LESSONS: 'cascaded_lesson_plans'
};

/**
 * Entity types being tracked
 */
const AUDIT_ENTITIES = {
  USER: 'User',
  STUDENT: 'Student',
  SCHEME: 'Scheme',
  LESSON_PLAN: 'LessonPlan',
  DAILY_REPORT: 'DailyReport',
  EXAM: 'Exam',
  EXAM_MARKS: 'ExamMarks',
  SUBSTITUTION: 'Substitution',
  TIMETABLE: 'Timetable',
  SETTINGS: 'Settings',
  SYLLABUS: 'Syllabus',
  ACADEMIC_CALENDAR: 'AcademicCalendar',
  HOLIDAY: 'Holiday'
};

/**
 * Severity levels for audit events
 */
const AUDIT_SEVERITY = {
  INFO: 'info',        // Normal operations
  WARNING: 'warning',  // Important changes
  CRITICAL: 'critical' // Security-sensitive actions
};

const AUDIT_ROLE_SCOPES = {
  HM_ALLOWED_ENTITIES: [
    AUDIT_ENTITIES.STUDENT,
    AUDIT_ENTITIES.SCHEME,
    AUDIT_ENTITIES.LESSON_PLAN,
    AUDIT_ENTITIES.DAILY_REPORT,
    AUDIT_ENTITIES.EXAM,
    AUDIT_ENTITIES.EXAM_MARKS,
    AUDIT_ENTITIES.SUBSTITUTION,
    AUDIT_ENTITIES.TIMETABLE,
    AUDIT_ENTITIES.SETTINGS,
    AUDIT_ENTITIES.SYLLABUS,
    AUDIT_ENTITIES.ACADEMIC_CALENDAR,
    AUDIT_ENTITIES.HOLIDAY
  ]
};

function _normalizeAuditEntityType(entityType) {
  return String(entityType || '').toLowerCase().trim();
}

function _filterAuditLogsByEntity(logs, allowedEntities) {
  if (!Array.isArray(logs)) return [];
  const allowed = new Set((allowedEntities || []).map(_normalizeAuditEntityType));
  return logs.filter(log => allowed.has(_normalizeAuditEntityType(log.entityType)));
}

function _auditAllowedEntitiesForHM() {
  return AUDIT_ROLE_SCOPES.HM_ALLOWED_ENTITIES.slice();
}

function getAuditLogsForRequester(filters = {}, requesterEmail) {
  const email = String(requesterEmail || '').toLowerCase().trim();
  if (email && isSuperAdmin(email)) return getAuditLogs(filters);
  if (!email || !isHMOrSuperAdmin(email)) return [];
  const logs = getAuditLogs(filters);
  return _filterAuditLogsByEntity(logs, _auditAllowedEntitiesForHM());
}

/**
 * Log an audit event
 * @param {Object} params - Audit event parameters
 * @param {string} params.action - Action performed (use AUDIT_ACTIONS constants)
 * @param {string} params.entityType - Type of entity (use AUDIT_ENTITIES constants)
 * @param {string} params.entityId - Unique identifier of the entity
 * @param {string} params.userEmail - Email of user performing action
 * @param {string} params.userName - Name of user performing action
 * @param {string} params.userRole - Role of user (Teacher, HM, Super Admin, etc.)
 * @param {Object} params.beforeData - State before change (optional)
 * @param {Object} params.afterData - State after change (optional)
 * @param {string} params.description - Human-readable description of change
 * @param {string} params.severity - Severity level (default: INFO)
 * @param {string} params.ipAddress - IP address (optional)
 */
function logAudit(params) {
  try {
    const {
      action,
      entityType,
      entityId,
      userEmail = '',
      userName = '',
      userRole = '',
      beforeData = null,
      afterData = null,
      description = '',
      severity = AUDIT_SEVERITY.INFO,
      ipAddress = ''
    } = params;
    
    // Validate required fields
    if (!action || !entityType || !entityId) {
      console.error('AuditLog: Missing required fields', params);
      return { error: 'Missing required audit fields' };
    }
    
    const sh = _getSheet('AuditLog');
    _ensureHeaders(sh, SHEETS.AuditLog);
    
    const now = new Date().toISOString();
    
    // Serialize complex objects to JSON strings
    const beforeJson = beforeData ? JSON.stringify(beforeData) : '';
    const afterJson = afterData ? JSON.stringify(afterData) : '';
    
    // Create audit record
    const auditRecord = [
      now,                    // timestamp
      userEmail,              // userEmail
      userName,               // userName
      userRole,               // userRole
      action,                 // action
      entityType,             // entityType
      entityId,               // entityId
      beforeJson,             // beforeData (JSON)
      afterJson,              // afterData (JSON)
      ipAddress,              // ipAddress
      description,            // changeDescription
      severity,               // severity
      now                     // createdAt
    ];

    // PERF: appendRow() becomes slow as the sheet grows.
    // Writing directly to the next row via setValues is typically faster and more predictable.
    const nextRow = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(nextRow, 1, 1, auditRecord.length).setValues([auditRecord]);
    
    // Log to Apps Script console for debugging
    console.log(`AUDIT: ${action} ${entityType} ${entityId} by ${userEmail}`);
    
    return { ok: true, timestamp: now };
    
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit failures shouldn't break the main operation
    return { error: error.toString() };
  }
}

/**
 * Get audit logs with filtering
 * @param {Object} filters - Filter parameters
 * @param {string} filters.userEmail - Filter by user
 * @param {string} filters.entityType - Filter by entity type
 * @param {string} filters.entityId - Filter by specific entity
 * @param {string} filters.action - Filter by action
 * @param {string} filters.startDate - Filter from date (ISO string)
 * @param {string} filters.endDate - Filter to date (ISO string)
 * @param {number} filters.limit - Max results to return
 * @returns {Array} Filtered audit logs
 */
function getAuditLogs(filters = {}) {
  try {
    const sh = _getSheet('AuditLog');
    const headers = _headers(sh);
    let logs = _rows(sh).map(r => _indexByHeader(r, headers));
    
    // Apply filters
    if (filters.userEmail) {
      logs = logs.filter(log => log.userEmail === filters.userEmail);
    }
    
    if (filters.entityType) {
      logs = logs.filter(log => log.entityType === filters.entityType);
    }
    
    if (filters.entityId) {
      logs = logs.filter(log => log.entityId === filters.entityId);
    }
    
    if (filters.action) {
      logs = logs.filter(log => log.action === filters.action);
    }
    
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= startTime);
    }
    
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      logs = logs.filter(log => new Date(log.timestamp).getTime() <= endTime);
    }
    
    if (filters.severity) {
      logs = logs.filter(log => log.severity === filters.severity);
    }
    
    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    if (filters.limit && filters.limit > 0) {
      logs = logs.slice(0, filters.limit);
    }
    
    return logs;
    
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

/**
 * Get audit trail for a specific entity
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity identifier
 * @returns {Array} Audit trail sorted by timestamp
 */
function getEntityAuditTrail(entityType, entityId) {
  return getAuditLogs({ entityType, entityId });
}

/**
 * Get recent activity for a user
 * @param {string} userEmail - User email
 * @param {number} limit - Max results (default: 50)
 * @returns {Array} Recent user actions
 */
function getUserActivity(userEmail, limit = 50) {
  return getAuditLogs({ userEmail, limit });
}

/**
 * Get critical security events
 * @param {number} days - Look back period in days (default: 7)
 * @returns {Array} Critical security events
 */
function getCriticalEvents(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return getAuditLogs({
    severity: AUDIT_SEVERITY.CRITICAL,
    startDate: startDate.toISOString(),
    limit: 100
  });
}

/**
 * Export audit logs for compliance
 * @param {Object} filters - Filter parameters
 * @returns {Array} Audit logs in exportable format
 */
function exportAuditLogs(filters = {}) {
  const logs = getAuditLogs(filters);
  
  return logs.map(log => ({
    timestamp: log.timestamp,
    user: `${log.userName} (${log.userEmail})`,
    role: log.userRole,
    action: log.action,
    entity: `${log.entityType} #${log.entityId}`,
    description: log.changeDescription,
    severity: log.severity,
    ipAddress: log.ipAddress
  }));
}

function exportAuditLogsForRequester(filters = {}, requesterEmail) {
  const logs = getAuditLogsForRequester(filters, requesterEmail);
  return logs.map(log => ({
    timestamp: log.timestamp,
    user: `${log.userName} (${log.userEmail})`,
    role: log.userRole,
    action: log.action,
    entity: `${log.entityType} #${log.entityId}`,
    description: log.changeDescription,
    severity: log.severity,
    ipAddress: log.ipAddress
  }));
}

/**
 * Clean up old audit logs (retention policy)
 * @param {number} retentionDays - Keep logs for this many days (default: 365)
 * @returns {Object} Cleanup summary
 */
function cleanupAuditLogs(retentionDays = 365) {
  try {
    const sh = _getSheet('AuditLog');
    const headers = _headers(sh);
    const allRows = _rows(sh);
    
    if (allRows.length === 0) {
      return { ok: true, deletedCount: 0, message: 'No logs to clean up' };
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTime = cutoffDate.getTime();
    
    // Find rows to delete (working backwards to avoid index issues)
    let deletedCount = 0;
    for (let i = allRows.length; i >= 1; i--) {
      const row = allRows[i - 1];
      const log = _indexByHeader(row, headers);
      const logTime = new Date(log.timestamp).getTime();
      
      if (logTime < cutoffTime) {
        sh.deleteRow(i + 1); // +1 for header row
        deletedCount++;
      }
    }
    
    return { 
      ok: true, 
      deletedCount, 
      message: `Deleted ${deletedCount} audit logs older than ${retentionDays} days` 
    };
    
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    return { error: error.toString() };
  }
}

/**
 * Generate audit summary report
 * @param {Object} filters - Filter parameters
 * @returns {Object} Summary statistics
 */
function getAuditSummary(filters = {}) {
  return _buildAuditSummary(getAuditLogs(filters));
}

function getAuditSummaryForRequester(filters = {}, requesterEmail) {
  return _buildAuditSummary(getAuditLogsForRequester(filters, requesterEmail));
}

function _buildAuditSummary(logs) {
  const summary = {
    totalEvents: logs.length,
    byAction: {},
    byEntity: {},
    bySeverity: {},
    byUser: {},
    recentCritical: []
  };

  logs.forEach(log => {
    summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
    summary.byEntity[log.entityType] = (summary.byEntity[log.entityType] || 0) + 1;
    summary.bySeverity[log.severity] = (summary.bySeverity[log.severity] || 0) + 1;
    summary.byUser[log.userEmail] = (summary.byUser[log.userEmail] || 0) + 1;
    if (log.severity === AUDIT_SEVERITY.CRITICAL && summary.recentCritical.length < 10) {
      summary.recentCritical.push({
        timestamp: log.timestamp,
        user: log.userEmail,
        action: log.action,
        entity: log.entityType,
        description: log.changeDescription
      });
    }
  });

  return summary;
}
