import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, 
  X, 
  Trash2, 
  CheckSquare, 
  Filter,
  Calendar,
  FileText,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Clock,
  Award
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITY } from '../contexts/NotificationContext';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, unread, category
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAll, 
    clearOldNotifications,
    removeNotification,
    getCategoryCounts 
  } = useNotifications();
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter notifications based on active tab
  const getFilteredNotifications = () => {
    let filtered = notifications;
    
    if (activeTab === 'unread') {
      filtered = notifications.filter(n => !n.read);
    } else if (activeTab === 'category' && selectedCategory) {
      filtered = notifications.filter(n => n.category === selectedCategory);
    }
    
    // Sort by priority and timestamp
    return filtered.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority] || 999;
      const bPriority = priorityOrder[b.priority] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };

  const categoryCounts = getCategoryCounts();
  const filteredNotifications = getFilteredNotifications();

  const getCategoryIcon = (category) => {
    switch (category) {
      case NOTIFICATION_CATEGORIES.LESSON_PLAN: return <BookOpen className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.EXAM: return <Award className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.SUBSTITUTION: return <Users className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.REPORT: return <FileText className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.REMINDER: return <Clock className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.APPROVAL: return <CheckCircle className="w-4 h-4" />;
      case NOTIFICATION_CATEGORIES.DEADLINE: return <Calendar className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category) => {
    return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      urgent: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    const icons = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[priority] || styles.low}`}>
        <span className="mr-1">{icons[priority]}</span>
        {priority.toUpperCase()}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const groupNotificationsByTime = (notifs) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    notifs.forEach(notif => {
      const notifDate = new Date(notif.timestamp);
      if (notifDate >= today) {
        groups.today.push(notif);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(notif);
      } else if (notifDate >= thisWeek) {
        groups.thisWeek.push(notif);
      } else {
        groups.older.push(notif);
      }
    });

    return groups;
  };

  const groupedNotifications = groupNotificationsByTime(filteredNotifications);

  const renderNotificationGroup = (title, notifs) => {
    if (notifs.length === 0) return null;

    return (
      <div key={title} className="mb-4">
        <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {title}
        </div>
        {notifs.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
              !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
            onClick={() => markAsRead(notification.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getTypeIcon(notification.type)}</span>
                  {getCategoryIcon(notification.category)}
                  {notification.title && (
                    <p className="text-sm font-medium text-gray-900 flex-1">
                      {notification.title}
                    </p>
                  )}
                  {getPriorityBadge(notification.priority)}
                </div>
                <p className="text-sm text-gray-600 mt-1 ml-8">
                  {notification.message}
                </p>
                <div className="flex items-center gap-3 mt-2 ml-8">
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {getCategoryLabel(notification.category)}
                  </span>
                </div>
                
                {/* Actions */}
                {notification.actions && notification.actions.length > 0 && (
                  <div className="mt-2 ml-8 flex flex-wrap gap-2">
                    {notification.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.handler();
                          markAsRead(notification.id);
                        }}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeNotification(notification.id);
                }}
                className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearOldNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700"
                  title="Clear old notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => { setActiveTab('all'); setSelectedCategory(null); }}
                className={`px-3 py-1 rounded ${
                  activeTab === 'all' 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => { setActiveTab('unread'); setSelectedCategory(null); }}
                className={`px-3 py-1 rounded ${
                  activeTab === 'unread' 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <div className="relative">
                <button
                  onClick={() => setActiveTab(activeTab === 'category' ? 'all' : 'category')}
                  className={`px-3 py-1 rounded flex items-center gap-1 ${
                    activeTab === 'category' 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Categories
                </button>
                
                {/* Category Dropdown */}
                {activeTab === 'category' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[200px]">
                    {Object.values(NOTIFICATION_CATEGORIES).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                          selectedCategory === cat ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {getCategoryIcon(cat)}
                          {getCategoryLabel(cat)}
                        </span>
                        {categoryCounts[cat] > 0 && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            {categoryCounts[cat]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm mt-1">You're all caught up!</p>
              </div>
            ) : (
              <>
                {renderNotificationGroup('Today', groupedNotifications.today)}
                {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
                {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
                {renderNotificationGroup('Older', groupedNotifications.older)}
              </>
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-between">
              <button
                onClick={clearAll}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Clear All
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(NotificationCenter);
