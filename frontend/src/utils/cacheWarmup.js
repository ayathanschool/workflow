// Cache warming utility to improve initial load performance
import * as api from '../api';

/**
 * Warm up caches by pre-fetching commonly accessed data
 * Call this after login to improve subsequent page loads
 */
export async function warmupCache(user) {
  if (!user) return;
  
  const promises = [];
  
  // Warm up based on user role
  if (user.roles?.includes('HM') || user.roles?.includes('Super Admin')) {
    // HM/Admin: Pre-load dashboard data
    promises.push(
      api.getFullTimetable().catch(() => null),
      api.getExams({}).catch(() => null),
      api.getAllClasses().catch(() => null)
    );
  }
  
  if (user.roles?.includes('Teacher')) {
    // Teachers: Pre-load their specific data
    promises.push(
      api.getTeacherWeeklyTimetable(user.email).catch(() => null),
      api.getExams({ teacherEmail: user.email }).catch(() => null)
    );
  }
  
  // Wait for all warmup requests
  await Promise.all(promises);
  
  console.log('🔥 Cache warmed up successfully');
}

/**
 * Call backend cache warming endpoint
 * This pre-loads frequently accessed data on the server side
 */
export async function warmupBackendCache() {
  try {
    let token = '';
    try {
      const s = JSON.parse(localStorage.getItem('sf_google_session') || '{}');
      token = s?.idToken ? String(s.idToken) : '';
    } catch {}
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}?action=warmCache${tokenParam}`,
      { method: 'GET' }
    );
    
    if (response.ok) {
      console.log('🔥 Backend cache warmed up');
    }
  } catch (err) {
    // Silent fail - warming is optional
    console.debug('Backend cache warmup skipped:', err.message);
  }
}
