/**
 * ====== AUTHENTICATION MANAGER ======
 * This file handles all login and user permission checking
 * Think of this as the "security guard" for your school system
 */

/**
 * Handle regular email/password login
 */
function handleBasicLogin(email, password) {
  email = String(email || '').toLowerCase().trim();
  const sh = _getSheet('Users');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  const found = list.find(u => String(u.email||'').toLowerCase() === email);

  if (!found) return { error: 'User not found' };

  // Check password if provided (optional)
  if (password && String(found.password || '') !== '') {
    if (String(found.password || '') !== String(password)) {
      return { error: 'Invalid password' };
    }
  }

  // Parse user roles and permissions
  const roles = String(found.roles || '')
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => r.length > 0);

  const classes = String(found.classes || '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0);

  const subjects = String(found.subjects || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const classTeacherFor = String(found.classTeacherFor || '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0);

  return {
    name: found.name || '',
    email: found.email || '',
    roles: roles,
    classes: classes,
    subjects: subjects,
    classTeacherFor: classTeacherFor,
    loginMethod: 'basic'
  };
}

/**
 * Handle Google login (when teachers use "Sign in with Google")
 */
function handleGoogleLogin(payload) {
  try {
    let email = '';
    let name = '';
    let picture = '';
    let google_id = '';
    
    // Handle different types of Google login data
    if (payload.idToken) {
      // This would verify the Google token (advanced security)
      // For now, we'll extract basic info
      email = payload.email || '';
      name = payload.name || '';
      picture = payload.picture || '';
      google_id = payload.sub || payload.google_id || '';
    } else if (payload.email) {
      // Direct email login
      email = payload.email;
      name = payload.name || '';
      picture = payload.picture || '';
      google_id = payload.google_id || 'email_auth';
    }
    
    if (!email) {
      return _respond({ error: 'No email provided in Google login' });
    }
    
    email = email.toLowerCase().trim();
    
    // Check if user exists in our system
    const sh = _getSheet('Users');
    const headers = _headers(sh);
    const list = _rows(sh).map(r => _indexByHeader(r, headers));
    const found = list.find(u => String(u.email||'').toLowerCase() === email);
    
    if (!found) {
      return _respond({ error: 'User not found in school system' });
    }
    
    // Parse user permissions (same as basic login)
    const roles = String(found.roles || '')
      .split(',')
      .map(r => r.trim().toLowerCase())
      .filter(r => r.length > 0);
    
    const classes = String(found.classes || '')
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    const subjects = String(found.subjects || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const classTeacherFor = String(found.classTeacherFor || '')
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    const userData = {
      name: found.name || name || '',  // Use sheet name first, then Google name as fallback
      email: found.email || '',
      picture: picture || '',
      google_id: google_id || '',
      roles,
      classes,
      subjects,
      classTeacherFor,
      loginMethod: 'google'
    };
    
    return _respond(userData);
    
  } catch (error) {
    console.error('Google login error:', error);
    return _respond({ error: 'Google login failed: ' + error.message });
  }
}

/**
 * DEPRECATED: Use userHasRole() from SheetHelpers.gs instead (enhanced version with better role matching)
 * Legacy role check - kept for backwards compatibility
 */
function userHasRoleLegacy(userEmail, requiredRole) {
  const sh = _getSheet('Users');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  const user = list.find(u => String(u.email||'').toLowerCase() === userEmail.toLowerCase());
  
  if (!user) return false;
  
  const roles = String(user.roles || '')
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => r.length > 0);
  
  return roles.includes(requiredRole.toLowerCase());
}

/**
 * Check if a user can access a specific class
 */
function userCanAccessClass(userEmail, className) {
  const sh = _getSheet('Users');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  const user = list.find(u => String(u.email||'').toLowerCase() === userEmail.toLowerCase());
  
  if (!user) return false;
  
  // HM can access all classes
  const roles = String(user.roles || '').toLowerCase();
  if (roles.includes('hm') || roles.includes('headmaster')) {
    return true;
  }
  
  // Check if user teaches this class
  const classes = String(user.classes || '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0);
  
  const classTeacherFor = String(user.classTeacherFor || '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0);
  
  return classes.includes(className) || classTeacherFor.includes(className);
}

/**
 * Check if a user can create exams for a specific class and subject
 */
function userCanCreateExam(userEmail, className, subject) {
  const sh = _getSheet('Users');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  const user = list.find(u => String(u.email||'').toLowerCase() === userEmail.toLowerCase());
  
  if (!user) {
    appLog('ERROR', 'userCanCreateExam', 'User not found: ' + userEmail);
    return false;
  }
  
  // HM can create exams for any class/subject
  const roles = String(user.roles || '').toLowerCase();
  if (roles.includes('hm') || roles.includes('headmaster') || roles.includes('h m')) {
    appLog('INFO', 'userCanCreateExam', 'HM access granted for ' + userEmail);
    return true;
  }
  
  // Check if user teaches this class and subject
  const hasClassAccess = userCanAccessClass(userEmail, className);
  const teachesSubject = userTeachesSubject(userEmail, subject);
  
  appLog('INFO', 'userCanCreateExam', {
    email: userEmail,
    class: className,
    subject: subject,
    hasClassAccess: hasClassAccess,
    teachesSubject: teachesSubject,
    userClasses: user.classes,
    userSubjects: user.subjects
  });
  
  return hasClassAccess && teachesSubject;
}

/**
 * Check if a user teaches a specific subject
 */
function userTeachesSubject(userEmail, subject) {
  const sh = _getSheet('Users');
  const headers = _headers(sh);
  const list = _rows(sh).map(r => _indexByHeader(r, headers));
  const user = list.find(u => String(u.email||'').toLowerCase() === userEmail.toLowerCase());
  
  if (!user) return false;
  
  const subjects = String(user.subjects || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return subjects.includes(subject);
}