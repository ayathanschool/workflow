import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Notification categories for better organization
export const NOTIFICATION_CATEGORIES = {
  SYSTEM: 'system',
  LESSON_PLAN: 'lesson_plan',
  EXAM: 'exam',
  SUBSTITUTION: 'substitution',
  REPORT: 'report',
  REMINDER: 'reminder',
  APPROVAL: 'approval',
  DEADLINE: 'deadline'
};

// Notification priorities
export const NOTIFICATION_PRIORITY = {
  URGENT: 'urgent',      // Requires immediate action
  HIGH: 'high',          // Important, act within today
  MEDIUM: 'medium',      // Act within this week
  LOW: 'low'             // Informational
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread, category
  const [categoryFilter, setCategoryFilter] = useState(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map(n => ({
          ...n,
          timestamp: new Date(n.timestamp)
        })));
        setUnreadCount(parsed.filter(n => !n.read).length);
      } catch (e) {
        console.error('Error loading saved notifications:', e);
      }
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    try {
      if (notifications.length > 0) {
        localStorage.setItem('notifications', JSON.stringify(notifications));
      } else {
        // Important: if we don't clear this, auto-closed notifications reappear on next page load.
        localStorage.removeItem('notifications');
      }
    } catch (e) {
      console.error('Error saving notifications:', e);
    }
  }, [notifications]);

  // Add notification with smart categorization
  const addNotification = useCallback((notification) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification = {
      id,
      type: 'info', // success, error, warning, info
      title: '',
      message: '',
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      autoClose: true,
      duration: 5000,
      timestamp: new Date(),
      read: false,
      actions: [],
      metadata: {}, // Additional data for context
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 100)); // Keep max 100 notifications
    setUnreadCount(prev => prev + 1);

    // Auto remove if specified and not high priority
    if (newNotification.autoClose && newNotification.priority !== NOTIFICATION_PRIORITY.HIGH && newNotification.priority !== NOTIFICATION_PRIORITY.URGENT) {
      setTimeout(() => {
        setNotifications(prevNotifs => prevNotifs.filter(n => n.id !== id));
      }, newNotification.duration);
    }

    return id;
  }, []); // No dependencies needed since we use functional updates

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  // Mark as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(n => {
        if (n.id === id && !n.read) {
          setUnreadCount(count => Math.max(0, count - 1));
          return { ...n, read: true };
        }
        return n;
      })
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear old read notifications (older than 7 days)
  const clearOldNotifications = useCallback(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    setNotifications(prev => 
      prev.filter(n => 
        !n.read || new Date(n.timestamp) > sevenDaysAgo
      )
    );
  }, []);

  // Quick notification methods with smart defaults
  const success = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITY.LOW,
      duration: 3000,
      ...options
    });
  }, [addNotification]);

  const error = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITY.HIGH,
      autoClose: false,
      ...options
    });
  }, [addNotification]);

  const warning = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      duration: 7000,
      ...options
    });
  }, [addNotification]);

  const info = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITY.LOW,
      ...options
    });
  }, [addNotification]);

  // Smart notification methods for different contexts
  const notifyLessonPlanDue = useCallback((lessonPlan, daysUntilDue) => {
    const priority = daysUntilDue <= 0 ? NOTIFICATION_PRIORITY.URGENT :
                     daysUntilDue <= 1 ? NOTIFICATION_PRIORITY.HIGH : 
                     daysUntilDue <= 3 ? NOTIFICATION_PRIORITY.MEDIUM :
                     NOTIFICATION_PRIORITY.LOW;
    
    return addNotification({
      type: daysUntilDue <= 0 ? 'error' : daysUntilDue <= 1 ? 'warning' : 'info',
      title: '📚 Lesson Plan Due',
      message: `Lesson plan for ${lessonPlan.subject} - ${lessonPlan.class} is due ${daysUntilDue <= 0 ? 'today' : `in ${daysUntilDue} day(s)`}`,
      category: NOTIFICATION_CATEGORIES.LESSON_PLAN,
      priority,
      autoClose: false,
      metadata: { lessonPlanId: lessonPlan.id },
      actions: [{
        label: 'Complete Now',
        handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'lesson-plans' }))
      }]
    });
  }, [addNotification]);

  const notifySubstitution = useCallback((substitution) => {
    return addNotification({
      type: 'warning',
      title: '👥 Substitution Assignment',
      message: `You have been assigned to substitute for ${substitution.absentTeacher} in ${substitution.class} - Period ${substitution.period}`,
      category: NOTIFICATION_CATEGORIES.SUBSTITUTION,
      priority: NOTIFICATION_PRIORITY.URGENT,
      autoClose: false,
      metadata: { substitutionId: substitution.id },
      actions: [
        {
          label: 'View Details',
          handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'my-substitutions' }))
        },
        {
          label: 'Acknowledge',
          handler: async () => {
            console.log('Acknowledging substitution:', substitution.id);
          }
        }
      ]
    });
  }, [addNotification]);

  const notifyExamMarksEntry = useCallback((exam) => {
    return addNotification({
      type: 'info',
      title: '📝 Exam Marks Entry',
      message: `Marks entry is open for ${exam.examType} - ${exam.subject} (${exam.class})`,
      category: NOTIFICATION_CATEGORIES.EXAM,
      priority: NOTIFICATION_PRIORITY.HIGH,
      autoClose: false,
      metadata: { examId: exam.id },
      actions: [{
        label: 'Enter Marks',
        handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'exam-marks' }))
      }]
    });
  }, [addNotification]);

  const notifyDailyReportDue = useCallback(() => {
    return addNotification({
      type: 'warning',
      title: '📄 Daily Report Pending',
      message: 'You have pending daily reports to submit for today',
      category: NOTIFICATION_CATEGORIES.REPORT,
      priority: NOTIFICATION_PRIORITY.HIGH,
      autoClose: false,
      actions: [{
        label: 'Submit Report',
        handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'reports' }))
      }]
    });
  }, [addNotification]);

  const notifyApprovalRequired = useCallback((item, type) => {
    return addNotification({
      type: 'info',
      title: '✅ Approval Required',
      message: `${type} from ${item.teacherName} requires your approval`,
      category: NOTIFICATION_CATEGORIES.APPROVAL,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      autoClose: false,
      metadata: { itemId: item.id, approvalType: type },
      actions: [{
        label: 'Review',
        handler: () => window.dispatchEvent(new CustomEvent('navigate', { 
          detail: type === 'Scheme' ? 'scheme-approvals' : 'lesson-approvals' 
        }))
      }]
    });
  }, [addNotification]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('notifications');
  }, []);

  // Get filtered notifications
  const getFilteredNotifications = useCallback(() => {
    let filtered = notifications;
    
    if (filter === 'unread') {
      filtered = notifications.filter(n => !n.read);
    } else if (filter === 'category' && categoryFilter) {
      filtered = notifications.filter(n => n.category === categoryFilter);
    }
    
    return filtered;
  }, [notifications, filter, categoryFilter]);

  // Get notifications by priority
  const getNotificationsByPriority = useCallback((priority) => {
    return notifications.filter(n => n.priority === priority && !n.read);
  }, [notifications]);

  // Get category counts
  const getCategoryCounts = useCallback(() => {
    const counts = {};
    Object.values(NOTIFICATION_CATEGORIES).forEach(cat => {
      counts[cat] = notifications.filter(n => n.category === cat && !n.read).length;
    });
    return counts;
  }, [notifications]);

  const value = {
    notifications,
    unreadCount,
    filter,
    categoryFilter,
    setFilter,
    setCategoryFilter,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearOldNotifications,
    getFilteredNotifications,
    getNotificationsByPriority,
    getCategoryCounts,
    // Quick methods
    success,
    error,
    warning,
    info,
    // Smart notification methods
    notifyLessonPlanDue,
    notifySubstitution,
    notifyExamMarksEntry,
    notifyDailyReportDue,
    notifyApprovalRequired
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Toast notification container (bottom-right corner)
const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  // Only show auto-closing toast notifications
  const toastNotifications = notifications
    .filter(n => n.autoClose && !n.read)
    .slice(0, 5); // Show max 5 toasts

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = (type) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  if (toastNotifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toastNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto max-w-sm w-full ${getBackgroundColor(notification.type)} border rounded-lg shadow-lg p-4 animate-slide-in-right`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="ml-3 flex-1">
              {notification.title && (
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationContext;
