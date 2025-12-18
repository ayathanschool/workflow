import { useAuth } from '../App';

export default function RoleGuard({ children, requiredRoles, fallback = null }) {
  const { hasRole, user } = useAuth();

  if (!requiredRoles || requiredRoles.length === 0) {
    return children;
  }

  // Check if user has at least one of the required roles
  const hasRequiredRole = requiredRoles.some(role => {
    // Check via hasRole function (checks workflow roles)
    if (hasRole(role)) return true;
    
    // Also check fee app mapped role
    const roleLower = role.toLowerCase();
    const userRole = user?.role?.toLowerCase();
    
    if (roleLower.includes('account') && userRole === 'accounts') return true;
    if (roleLower.includes('admin') && userRole === 'admin') return true;
    if (roleLower === 'hm' && userRole === 'hm') return true;
    if (roleLower.includes('class') && userRole === 'class_teacher') return true;
    
    return false;
  });

  if (!hasRequiredRole) {
    return fallback || null;
  }

  return children;
}
