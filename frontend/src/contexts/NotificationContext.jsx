import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Add notification
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info', // success, error, warning, info
      title: '',
      message: '',
      autoClose: true,
      duration: 5000,
      timestamp: new Date(),
      read: false,
      actions: [],
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Auto remove if specified
    if (newNotification.autoClose) {
      setTimeout(() => {
        setNotifications(prevNotifs => prevNotifs.filter(n => n.id !== id));
      }, newNotification.duration);
    }

    return id;
  }, []); // No dependencies needed since we use functional updates

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Mark as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Quick notification methods
  const success = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  const error = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      autoClose: false, // Errors should persist
      ...options
    });
  }, [addNotification]);

  const warning = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  const info = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    // Quick methods
    success,
    error,
    warning,
    info
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Toast notification container
const NotificationContainer = () => {
  const { notifications, removeNotification, markAsRead } = useNotifications();

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

  // Only show recent auto-closing notifications as toasts
  const toastNotifications = notifications
    .filter(n => n.autoClose && Date.now() - n.timestamp.getTime() < n.duration)
    .slice(0, 5); // Max 5 toasts

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toastNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ${getBackgroundColor(notification.type)} border animate-in slide-in-from-right duration-300`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getIcon(notification.type)}
              </div>
              <div className="ml-3 w-0 flex-1">
                {notification.title && (
                  <p className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  {notification.message}
                </p>
                {notification.actions && notification.actions.length > 0 && (
                  <div className="mt-3 flex space-x-2">
                    {notification.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          action.handler();
                          removeNotification(notification.id);
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="rounded-md inline-flex text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationContext;