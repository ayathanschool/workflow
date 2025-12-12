import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, AlertCircle, Check, X } from 'lucide-react';
import * as api from '../api';

const HolidayManagement = ({ user }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [cascadeDate, setCascadeDate] = useState('');
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  
  // Load holidays on mount
  useEffect(() => {
    loadHolidays();
  }, []);
  
  const loadHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUndeclaredHolidays(true);
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading holidays:', err);
      setError('Failed to load holidays: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    
    if (!selectedDate || !reason.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const result = await api.markUndeclaredHoliday(selectedDate, reason);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Holiday marked successfully');
        setSelectedDate('');
        setReason('');
        setShowAddForm(false);
        loadHolidays();
      }
    } catch (err) {
      console.error('Error marking holiday:', err);
      setError('Failed to mark holiday: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteHoliday = async (holidayId) => {
    if (!confirm('Are you sure you want to delete this holiday? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const result = await api.deleteUndeclaredHoliday(holidayId);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Holiday deleted successfully');
        loadHolidays();
      }
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setError('Failed to delete holiday: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleCascade = async () => {
    if (!cascadeDate) {
      setError('Please select a start date for cascading');
      return;
    }
    
    // Count affected holidays
    const affectedHolidays = holidays.filter(h => h.date >= cascadeDate);
    
    if (affectedHolidays.length === 0) {
      setError('No holidays found from the selected date onwards');
      return;
    }
    
    setShowCascadeConfirm(true);
  };
  
  const confirmCascade = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setShowCascadeConfirm(false);
      
      const result = await api.cascadeLessonPlans(cascadeDate);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          `Successfully cascaded lesson plans! ` +
          `${result.affectedCount || 0} lesson plans adjusted to skip ` +
          `${result.holidays?.length || 0} holidays.`
        );
        setCascadeDate('');
      }
    } catch (err) {
      console.error('Error cascading lessons:', err);
      setError('Failed to cascade lesson plans: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          <Calendar className="inline-block mr-2 mb-1" size={28} />
          Undeclared Holiday Management
        </h1>
        <p className="text-gray-600">
          Mark sudden/undeclared holidays and cascade lesson plans to maintain schedule continuity
        </p>
      </div>
      
      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <Check className="text-green-600 mr-2 flex-shrink-0" size={20} />
          <span className="text-green-800">{success}</span>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <X className="text-red-600 mr-2 flex-shrink-0" size={20} />
          <span className="text-red-800">{error}</span>
        </div>
      )}
      
      {/* Add Holiday Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Mark New Holiday</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus size={18} className="mr-1" />
            {showAddForm ? 'Cancel' : 'Add Holiday'}
          </button>
        </div>
        
        {showAddForm && (
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Heavy rain, Emergency closure"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Holiday'}
            </button>
          </form>
        )}
      </div>
      
      {/* Cascade Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Cascade Lesson Plans</h2>
        <p className="text-sm text-gray-600 mb-4">
          After marking holidays, cascade lesson plans to automatically adjust scheduled dates,
          skipping all holidays while maintaining the sequence.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date (cascade from)
            </label>
            <input
              type="date"
              value={cascadeDate}
              onChange={(e) => setCascadeDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="text-sm text-gray-600">
            {cascadeDate && holidays.filter(h => h.date >= cascadeDate).length > 0 && (
              <p>
                Will skip <strong>{holidays.filter(h => h.date >= cascadeDate).length}</strong> holiday(s)
                from {cascadeDate} onwards
              </p>
            )}
          </div>
          
          <button
            onClick={handleCascade}
            disabled={loading || !cascadeDate}
            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Cascade Plans'}
          </button>
        </div>
        
        {showCascadeConfirm && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start mb-4">
              <AlertCircle className="text-yellow-600 mr-2 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-yellow-800 mb-2">Confirm Cascade Operation</p>
                <p className="text-sm text-yellow-700 mb-2">
                  This will adjust all pending lesson plans from <strong>{cascadeDate}</strong> onwards,
                  shifting them to skip <strong>{holidays.filter(h => h.date >= cascadeDate).length}</strong> holiday(s).
                </p>
                <p className="text-sm text-yellow-700">
                  Completed lessons will NOT be affected. This action cannot be easily undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmCascade}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                Confirm Cascade
              </button>
              <button
                onClick={() => setShowCascadeConfirm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Holidays List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Marked Holidays</h2>
        
        {loading && holidays.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Loading holidays...
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No holidays marked yet. Add a holiday to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="font-semibold text-gray-800">
                      {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 ml-7">{holiday.reason}</p>
                  <p className="text-xs text-gray-400 mt-1 ml-7">
                    Marked by {holiday.markedBy} on {new Date(holiday.markedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <button
                  onClick={() => handleDeleteHoliday(holiday.id)}
                  disabled={loading}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                  title="Delete holiday"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayManagement;
