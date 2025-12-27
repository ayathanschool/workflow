import { addDays, format } from 'date-fns';
import { Clock, AlertTriangle, Calendar, CheckCircle, Bell, RefreshCw, TrendingUp, XCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/useToast';
import { Settings } from 'lucide-react';

const SmartReminders = ({ user }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [settings, setSettings] = useState({
    enableReminders: true,
    reminderFrequency: 'daily',
    advanceNotice: 3,
    emailNotifications: false
  });
  const [stats, setStats] = useState({
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0
  });
  const { warning, info } = useToast();

  useEffect(() => {
    if (user && settings.enableReminders) {
      loadReminders();
      const interval = setInterval(loadReminders, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, settings.enableReminders]);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await generateSmartReminders();
      setReminders(data);
      
      const newStats = {
        urgent: data.filter(r => r.priority === NOTIFICATION_PRIORITY.URGENT).length,
        high: data.filter(r => r.priority === NOTIFICATION_PRIORITY.HIGH).length,
        medium: data.filter(r => r.priority === NOTIFICATION_PRIORITY.MEDIUM).length,
        low: data.filter(r => r.priority === NOTIFICATION_PRIORITY.LOW).length,
        total: data.length
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  }, [user, warning]);

  const generateSmartReminders = async () => {
    const today = new Date();
    const allReminders = [];

    // Generate sample reminders for demonstration
    // TODO: Replace with actual API calls when backend is ready
    
    allReminders.push({
      id: 'demo_1',
      type: 'lesson_plan',
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: '📚 Lesson Plan Pending',
      description: 'Complete lesson plan for Mathematics - Class 7B',
      dueDate: addDays(today, 1),
      daysRemaining: 1,
      actionUrl: 'lesson-plans',
      metadata: {}
    });

    allReminders.push({
      id: 'demo_2',
      type: 'daily_report',
      priority: NOTIFICATION_PRIORITY.URGENT,
      title: '📄 Daily Report Due',
      description: 'Submit your daily report for today',
      dueDate: today,
      daysRemaining: 0,
      actionUrl: 'reports',
      metadata: {}
    });

    return allReminders.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const handleReminderAction = (reminder) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: reminder.actionUrl }));
  };

  const handleComplete = (reminderId) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId));
    info('Reminder Completed', 'Task marked as completed');
  };

  const handleSnooze = (reminderId) => {
    setReminders(prev => prev.map(r => 
      r.id === reminderId 
        ? { ...r, dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), daysRemaining: 1 }
        : r
    ));
    info('Reminder Snoozed', 'Reminder snoozed for 24 hours');
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.URGENT: return 'border-red-500 bg-red-50';
      case NOTIFICATION_PRIORITY.HIGH: return 'border-orange-500 bg-orange-50';
      case NOTIFICATION_PRIORITY.MEDIUM: return 'border-yellow-500 bg-yellow-50';
      case NOTIFICATION_PRIORITY.LOW: return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.URGENT: return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case NOTIFICATION_PRIORITY.HIGH: return <Clock className="w-5 h-5 text-orange-600" />;
      case NOTIFICATION_PRIORITY.MEDIUM: return <Calendar className="w-5 h-5 text-yellow-600" />;
      case NOTIFICATION_PRIORITY.LOW: return <Bell className="w-5 h-5 text-blue-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const filteredReminders = filterPriority === 'all' 
    ? reminders 
    : reminders.filter(r => r.priority === filterPriority);

  if (loading && reminders.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Smart Reminders
          </h1>
          <p className="text-gray-600 mt-1">Intelligent task reminders based on your workload</p>
        </div>
        <button
          onClick={loadReminders}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400 cursor-pointer hover:shadow-md"
             onClick={() => setFilterPriority('all')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500 cursor-pointer hover:shadow-md"
             onClick={() => setFilterPriority(filterPriority === NOTIFICATION_PRIORITY.URGENT ? 'all' : NOTIFICATION_PRIORITY.URGENT)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgent</p>
              <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500 cursor-pointer hover:shadow-md"
             onClick={() => setFilterPriority(filterPriority === NOTIFICATION_PRIORITY.HIGH ? 'all' : NOTIFICATION_PRIORITY.HIGH)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High</p>
              <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500 cursor-pointer hover:shadow-md"
             onClick={() => setFilterPriority(filterPriority === NOTIFICATION_PRIORITY.MEDIUM ? 'all' : NOTIFICATION_PRIORITY.MEDIUM)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
            </div>
            <Calendar className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500 cursor-pointer hover:shadow-md"
             onClick={() => setFilterPriority(filterPriority === NOTIFICATION_PRIORITY.LOW ? 'all' : NOTIFICATION_PRIORITY.LOW)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low</p>
              <p className="text-2xl font-bold text-blue-600">{stats.low}</p>
            </div>
            <Bell className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          Reminder Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Advance Notice (days)</label>
            <input
              type="number"
              min="1"
              max="7"
              value={settings.advanceNotice}
              onChange={(e) => setSettings(prev => ({ ...prev, advanceNotice: parseInt(e.target.value) || 3 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={settings.reminderFrequency}
              onChange={(e) => setSettings(prev => ({ ...prev, reminderFrequency: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="realtime">Real-time</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredReminders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">
              {filterPriority === 'all' 
                ? "You don't have any pending reminders. Great job!" 
                : `No ${filterPriority} priority reminders at the moment.`}
            </p>
            {filterPriority !== 'all' && (
              <button
                onClick={() => setFilterPriority('all')}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View all reminders
              </button>
            )}
          </div>
        ) : (
          filteredReminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${getPriorityColor(reminder.priority)} transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-lg ${getPriorityColor(reminder.priority)}`}>
                    {getPriorityIcon(reminder.priority)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{reminder.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        reminder.priority === NOTIFICATION_PRIORITY.URGENT ? 'bg-red-100 text-red-800' :
                        reminder.priority === NOTIFICATION_PRIORITY.HIGH ? 'bg-orange-100 text-orange-800' :
                        reminder.priority === NOTIFICATION_PRIORITY.MEDIUM ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {reminder.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{reminder.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-medium ${
                        reminder.daysRemaining === 0 ? 'text-red-600' :
                        reminder.daysRemaining <= 1 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {reminder.daysRemaining === 0 ? 'Due Today' :
                         reminder.daysRemaining < 0 ? `Overdue by ${Math.abs(reminder.daysRemaining)} day(s)` :
                         `Due in ${reminder.daysRemaining} day(s)`}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        {format(new Date(reminder.dueDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleReminderAction(reminder)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Take Action
                  </button>
                  <button
                    onClick={() => handleSnooze(reminder.id)}
                    className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm font-medium"
                  >
                    Snooze
                  </button>
                  <button
                    onClick={() => handleComplete(reminder.id)}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => handleComplete(reminder.id)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Dismiss"
                  >
                    <XCircle className="w-5 h-5" />
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
