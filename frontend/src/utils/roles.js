export const normalizeRole = (role) => {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
};

export const getUserRoles = (user) => {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles.map(normalizeRole).filter(Boolean);
  if (user.role) return [normalizeRole(user.role)].filter(Boolean);
  return [];
};

export const hasRole = (user, role) => {
  const roles = getUserRoles(user);
  return roles.includes(normalizeRole(role));
};

export const hasAnyRole = (user, rolesToCheck = []) => {
  const roles = getUserRoles(user);
  return rolesToCheck.some((role) => roles.includes(normalizeRole(role)));
};

export const isAdmin = (user) => hasRole(user, 'admin');
export const isHM = (user) => hasAnyRole(user, ['h m', 'hm', 'headmaster', 'headmistress']);
export const isTeacher = (user) => hasRole(user, 'teacher');
export const isClassTeacher = (user) => hasAnyRole(user, ['class teacher', 'classteacher']);
