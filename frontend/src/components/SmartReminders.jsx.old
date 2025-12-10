import { formatDistanceToNow, isBefore, addDays } from 'date-fns';
import { Clock, AlertTriangle, Calendar, CheckCircle, Bell } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const SmartReminders = ({ user }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifiedReminders, setNotifiedReminders] = useState(new Set()); // Track which reminders we've already notified about
  const [settings, setSettings] = useState({
    enableReminders: true,
    reminderFrequency: 'daily', // daily, weekly
    advanceNotice: 2, // days before deadline
    emailNotifications: true
  });
  const { warning, info } = useNotifications();

  useEffect(() => {
    if (user) {
      generateReminders();
    }
  }, [user]);

  const generateReminders = async () => {
    setLoading(true);
    try {
      const today = new Date();
      
      // Get all smart reminders from the backend
      const allReminders = await fetchSmartReminders();

      setReminders(allReminders);

      // Send urgent notifications for high priority items due soon (only once per reminder)
      allReminders
        .filter(r => r.priority === 'high' && 
                    isBefore(new Date(r.dueDate), addDays(today, 1)) &&
                    !notifiedReminders.has(r.id)) // Only notify if we haven't already
        .forEach(reminder => {
          warning(
            'Urgent Reminder',
            reminder.title,
            {
              actions: [{
                label: 'Take Action',
                handler: () => window.dispatchEvent(new CustomEvent('navigate', { detail: reminder.actionUrl }))
              }],
              autoClose: false
            }
          );
          
          // Mark this reminder as notified
          setNotifiedReminders(prev => new Set([...prev, reminder.id]));
        });

    } catch (error) {
      console.error('Error generating reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmartReminders = async () => {
    try {
      // Temporarily disabled - backend not deployed yet
      console.warn('Smart Reminders API temporarily disabled - awaiting backend deployment');
      return [];
      
      // Uncomment when backend is deployed:
      // const response = await fetch(`${import.meta.env.VITE_GAS_WEB_APP_URL}?action=getSmartReminders&teacherEmail=${user.email}&advanceNotice=${settings.advanceNotice}`);
      // const result = await response.json();
      // 
      // if (result.success && Array.isArray(result.data)) {
      //   return result.data;
      // } else {
      //   console.error('Error in smart reminders response:', result.error);
      //   return [];
      // }
    } catch (error) {
      console.error('Error fetching smart reminders:', error);
      return [];
    }
  };

  const markCompleted = (reminderId) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId));
    info('Reminder Completed', 'Task marked as completed');
  };

  const snoozeReminder = (reminderId, hours = 24) => {
    setReminders(prev => prev.map(r => 
      r.id === reminderId 
        ? { ...r, dueDate: new Date(Date.now() + hours * 60 * 60 * 1000) }
        : r
    ));
    info('Reminder Snoozed', `Reminder snoozed for ${hours} hours`);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-5 h-5" />;
      case 'medium': return <Clock className="w-5 h-5" />;
      case 'low': return <Calendar className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Smart Reminders</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{reminders.length} active reminders</span>
          <button
            onClick={generateReminders}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reminder Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.enableReminders}
              onChange={(e) => setSettings(prev => ({ ...prev, enableReminders: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable Reminders</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Email Notifications</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={settings.reminderFrequency}
              onChange={(e) => setSettings(prev => ({ ...prev, reminderFrequency: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Advance Notice (days)</label>
            <input
              type="number"
              min="1"
              max="7"
              value={settings.advanceNotice}
              onChange={(e) => setSettings(prev => ({ ...prev, advanceNotice: parseInt(e.target.value) }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="space-y-4">
        {reminders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">You don't have any pending reminders. Great job!</p>
          </div>
        ) : (
          reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${getPriorityColor(reminder.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${getPriorityColor(reminder.priority)}`}>
                    {getPriorityIcon(reminder.priority)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{reminder.title}</h3>
                    <p className="text-gray-600 mt-1">{reminder.description}</p>
                    <div className="flex items-center space-x-4 mt-3">
                      <span className="text-sm text-gray-500">
                        Due {formatDistanceToNow(reminder.dueDate, { addSuffix: true })}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        reminder.priority === 'high' 
                          ? 'bg-red-100 text-red-800'
                          : reminder.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {reminder.priority} priority
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: reminder.actionUrl }))}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Take Action
                  </button>
                  <button
                    onClick={() => snoozeReminder(reminder.id)}
                    className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                  >
                    Snooze
                  </button>
                  <button
                    onClick={() => markCompleted(reminder.id)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Complete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default React.memo(SmartReminders);