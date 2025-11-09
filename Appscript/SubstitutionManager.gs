/**
 * ====== SUBSTITUTION MANAGEMENT SYSTEM ======
 * This file handles teacher substitutions and notifications
 * Think of this as your "Substitute Teacher Coordinator"
 */

/**
 * Assign a substitute teacher for an absent teacher
 */
function assignSubstitution(data) {
  const sh = _getSheet('Substitutions');
  _ensureHeaders(sh, SHEETS.Substitutions);
  const now = new Date().toISOString();
  
  const normalizedDate = _isoDateString(data.date || '');
  
  if (!normalizedDate) {
    return { error: 'Valid date is required' };
  }
  
  // Check if substitution already exists for this combination
  const headers = _headers(sh);
  const existing = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .find(r => 
      _isoDateString(r.date) === normalizedDate &&
      r.period === data.period &&
      r.class === data.class &&
      String(r.absentTeacher || '').toLowerCase() === String(data.absentTeacher || '').toLowerCase()
    );
  
  if (existing) {
    return { error: 'Substitution already exists for this time slot' };
  }
  
  const substitutionData = [
    normalizedDate,
    data.period || '',
    data.class || '',
    data.absentTeacher || '',
    data.regularSubject || '',
    data.substituteTeacher || '',
    data.substituteSubject || data.regularSubject || '',
    data.note || '',
    now
  ];
  
  // Append row and force date column to be stored as text
  const nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, 1, 1, substitutionData.length).setValues([substitutionData]);
  
  // Force the date cell to be plain text format to prevent automatic date conversion
  sh.getRange(nextRow, 1).setNumberFormat('@STRING@');
  
  // Send notification to substitute teacher
  if (data.substituteTeacher) {
    _sendSubstitutionNotification(data);
  }
  
  return { submitted: true };
}

/**
 * Get substitutions for a specific date
 */
function getSubstitutionsForDate(date) {
  const normalizedDate = _isoDateString(date);
  
  console.log(`[getSubstitutionsForDate] Querying for date: ${normalizedDate}`);
  
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  console.log(`[getSubstitutionsForDate] Headers: ${JSON.stringify(headers)}`);
  
  const allRows = _rows(sh).map(r => _indexByHeader(r, headers));
  console.log(`[getSubstitutionsForDate] Total rows: ${allRows.length}`);
  
  if (allRows.length > 0) {
    console.log(`[getSubstitutionsForDate] Sample row: ${JSON.stringify(allRows[0])}`);
    console.log(`[getSubstitutionsForDate] Sample date value: "${allRows[0].date}", normalized: "${_isoDateString(allRows[0].date)}"`);
  }
  
  const substitutions = allRows.filter(r => {
    const rowDate = _isoDateString(r.date);
    const matches = rowDate === normalizedDate;
    console.log(`[getSubstitutionsForDate] Checking row: date="${r.date}", normalized="${rowDate}", matches="${matches}"`);
    return matches;
  });
  
  console.log(`[getSubstitutionsForDate] Found ${substitutions.length} substitutions for ${normalizedDate}`);
  
  // Sort by period and class
  substitutions.sort((a, b) => {
    const periodCompare = (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
    if (periodCompare !== 0) return periodCompare;
    return (a.class || '').localeCompare(b.class || '');
  });
  
  return {
    date: normalizedDate,
    substitutions
  };
}

/**
 * Get substitutions assigned to a specific teacher
 */
function getTeacherSubstitutions(teacherEmail, date) {
  const normalizedDate = _isoDateString(date);
  
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const substitutions = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => 
      _isoDateString(r.date) === normalizedDate &&
      String(r.substituteTeacher || '').toLowerCase() === teacherEmail.toLowerCase()
    );
  
  // Sort by period
  substitutions.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));
  
  return {
    date: normalizedDate,
    teacherEmail,
    assignedSubstitutions: substitutions
  };
}

/**
 * Delete a substitution
 */
function deleteSubstitution(data) {
  const sh = _getSheet('Substitutions');
  const headers = _headers(sh);
  const rows = sh.getDataRange().getValues();
  
  const normalizedDate = _isoDateString(data.date);
  
  // Find the row to delete
  for (let i = 1; i < rows.length; i++) {
    const row = _indexByHeader(rows[i], headers);
    if (_isoDateString(row.date) === normalizedDate &&
        row.period === data.period &&
        row.class === data.class &&
        String(row.absentTeacher || '').toLowerCase() === String(data.absentTeacher || '').toLowerCase()) {
      
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Substitution not found' };
}

/**
 * Send notification to substitute teacher
 */
function _sendSubstitutionNotification(substitutionData) {
  try {
    const notificationSh = _getSheet('SubstitutionNotifications');
    _ensureHeaders(notificationSh, SHEETS.SubstitutionNotifications);
    
    const notificationId = _uuid();
    const now = new Date().toISOString();
    
    const title = `Substitution Assignment - ${substitutionData.class}`;
    const message = `You have been assigned to substitute for ${substitutionData.absentTeacher} on ${substitutionData.date} during Period ${substitutionData.period} for Class ${substitutionData.class}. Subject: ${substitutionData.substituteSubject || substitutionData.regularSubject}`;
    
    const notificationData = [
      notificationId,
      substitutionData.substituteTeacher,
      title,
      message,
      'substitution',
      JSON.stringify({
        date: substitutionData.date,
        period: substitutionData.period,
        class: substitutionData.class,
        absentTeacher: substitutionData.absentTeacher,
        subject: substitutionData.substituteSubject || substitutionData.regularSubject
      }),
      'FALSE', // acknowledged
      '', // acknowledgedAt
      now
    ];
    
    notificationSh.appendRow(notificationData);
    
    // Also send email notification
    _sendSubstitutionEmail(substitutionData);
    
  } catch (error) {
    console.error('Error sending substitution notification:', error);
  }
}

/**
 * Send email notification for substitution
 */
function _sendSubstitutionEmail(substitutionData) {
  try {
    const subject = `Substitution Assignment - ${substitutionData.class} (${substitutionData.date})`;
    const body = `
Dear ${substitutionData.substituteTeacher},

You have been assigned to substitute for ${substitutionData.absentTeacher} with the following details:

📅 Date: ${substitutionData.date}
⏰ Period: ${substitutionData.period}
🎓 Class: ${substitutionData.class}
📚 Subject: ${substitutionData.substituteSubject || substitutionData.regularSubject}
📝 Note: ${substitutionData.note || 'No additional notes'}

Please acknowledge this assignment by logging into the school system.

Thank you for your cooperation.

Best regards,
School Administration
    `;
    
    // Send email using the basic email function
    sendEmailNotification(substitutionData.substituteTeacher, subject, body);
    
  } catch (error) {
    console.error('Error sending substitution email:', error);
  }
}

/**
 * Get unacknowledged substitution notifications for a teacher
 */
function getUnacknowledgedSubstitutions(teacherEmail) {
  const sh = _getSheet('SubstitutionNotifications');
  const headers = _headers(sh);
  const notifications = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => 
      String(r.recipient || '').toLowerCase() === teacherEmail.toLowerCase() &&
      String(r.acknowledged || '').toLowerCase() !== 'true'
    );
  
  return notifications;
}

/**
 * Acknowledge a substitution notification
 */
function acknowledgeSubstitution(notificationId, teacherEmail) {
  const sh = _getSheet('SubstitutionNotifications');
  const headers = _headers(sh);
  const rows = sh.getDataRange().getValues();
  
  // Find and update the notification
  for (let i = 1; i < rows.length; i++) {
    const row = _indexByHeader(rows[i], headers);
    if (row.id === notificationId && 
        String(row.recipient || '').toLowerCase() === teacherEmail.toLowerCase()) {
      
      // Update acknowledged status
      const acknowledgedColIndex = headers.indexOf('acknowledged') + 1;
      const acknowledgedAtColIndex = headers.indexOf('acknowledgedAt') + 1;
      
      sh.getRange(i + 1, acknowledgedColIndex).setValue('TRUE');
      sh.getRange(i + 1, acknowledgedAtColIndex).setValue(new Date().toISOString());
      
      return { success: true };
    }
  }
  
  return { error: 'Notification not found' };
}

/**
 * Get all substitution notifications for a teacher (acknowledged and unacknowledged)
 * Alias for getTeacherSubstitutionNotifications for frontend compatibility
 */
function getSubstitutionNotifications(teacherEmail) {
  return getTeacherSubstitutionNotifications(teacherEmail);
}

/**
 * Get all substitution notifications for a teacher (acknowledged and unacknowledged)
 */
function getTeacherSubstitutionNotifications(teacherEmail) {
  const sh = _getSheet('SubstitutionNotifications');
  const headers = _headers(sh);
  const notifications = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => String(r.recipient || '').toLowerCase() === teacherEmail.toLowerCase());
  
  // Sort by creation date (newest first)
  notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  
  return notifications;
}