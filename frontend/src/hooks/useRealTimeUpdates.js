import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

function getStoredAuthToken() {
  try {
    const raw = localStorage.getItem('sf_google_session');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.idToken ? String(parsed.idToken) : '';
  } catch {
    return '';
  }
}

export const useRealTimeUpdates = (user, interval = 30000) => {
  // Temporarily disabled to prevent error loops
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const intervalRef = useRef(null);
  const { info, success, warning } = useNotifications();

  const fetchUpdates = useCallback(async () => {
    if (!user?.email) return;

    try {
      setIsPolling(true);

      const token = getStoredAuthToken();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      
      // Check for new lesson plan approvals
      const lessonPlans = await fetch(`${import.meta.env.VITE_GAS_WEB_APP_URL}?action=getTeacherLessonPlans&email=${user.email}${tokenParam}`)
        .then(res => res.json());
      
      // Check for new notifications (this would be a new API endpoint)
      const notifications = await fetch(`${import.meta.env.VITE_GAS_WEB_APP_URL}?action=getNotifications&email=${user.email}&since=${lastUpdate || ''}${tokenParam}`)
        .then(res => res.json())
        .catch(() => ({ data: [] }));

      // Process notifications
      if (notifications.data && Array.isArray(notifications.data)) {
        notifications.data.forEach(notification => {
          switch (notification.type) {
            case 'lesson_approved':
              success(
                'Lesson Plan Approved!',
                `Your lesson plan for ${notification.class} - ${notification.subject} has been approved`,
                {
                  actions: [{
                    label: 'View',
                    handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'lesson-plans' }))
                  }]
                }
              );
              break;
            case 'lesson_rejected':
              warning(
                'Lesson Plan Needs Revision',
                `Your lesson plan for ${notification.class} - ${notification.subject} needs revision`,
                {
                  actions: [{
                    label: 'Review',
                    handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'lesson-plans' }))
                  }]
                }
              );
              break;
            case 'scheme_approved':
              success(
                'Scheme Approved!',
                `Your scheme for ${notification.class} - ${notification.subject} has been approved`,
              );
              break;
            case 'substitute_assignment':
              info(
                'Substitute Assignment',
                `You've been assigned as substitute for ${notification.class} Period ${notification.period}`,
                {
                  actions: [{
                    label: 'View Details',
                    handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'substitutions' }))
                  }]
                }
              );
              break;
            case 'deadline_reminder':
              warning(
                'Deadline Reminder',
                notification.message,
                {
                  actions: [{
                    label: 'Take Action',
                    handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: notification.actionUrl }))
                  }]
                }
              );
              break;
            default:
              info(notification.title || 'Update', notification.message);
          }
        });
      }

      setLastUpdate(new Date().toISOString());
      setUpdateCount(prev => prev + 1);
      
    } catch (error) {
      // console.error('Error fetching updates:', error);
    } finally {
      setIsPolling(false);
    }
  }, [user?.email, lastUpdate, success, warning, info]);

  const startPolling = useCallback(() => {
    const enablePolling = false; // Temporarily disabled to prevent error loops
    if (!enablePolling) return;

    // console.log('Starting real-time updates...');
    fetchUpdates(); // Initial fetch

    intervalRef.current = setInterval(fetchUpdates, interval);
  }, [fetchUpdates, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      // console.log('Stopping real-time updates...');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start polling when user is available and page is visible
  useEffect(() => {
    if (!user?.email) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    // Start polling immediately if page is visible
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.email, startPolling, stopPolling]);

  // Listen for navigation events
  useEffect(() => {
    const handleNavigate = (event) => {
      // This would trigger navigation in the app
      // console.log('Navigate to:', event.detail);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  return {
    isPolling,
    lastUpdate,
    updateCount,
    startPolling,
    stopPolling,
    fetchUpdates
  };
};

export const useDataSync = () => {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [lastSync, setLastSync] = useState(null);

  const syncData = useCallback(async (dataType, data) => {
    setSyncStatus('syncing');
    
    try {
      const token = getStoredAuthToken();
      // Sync data to server
      const response = await fetch(`${import.meta.env.VITE_GAS_WEB_APP_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: `sync${dataType}`,
          data: JSON.stringify(data),
          ...(token ? { token } : {})
        })
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setSyncStatus('success');
      setLastSync(new Date().toISOString());
      
      return { success: true, data: result };
    } catch (error) {
      // console.error('Sync error:', error);
      setSyncStatus('error');
      return { success: false, error: error.message };
    }
  }, []);

  return {
    syncStatus,
    lastSync,
    syncData
  };
};