import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, Check, X, RotateCcw, History } from 'lucide-react';
import * as api from '../api';

const HolidayManagement = ({ user }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form states
  const [cascadeDate, setCascadeDate] = useState('');
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  const [affectedLessons, setAffectedLessons] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Cascade history
  const [cascadeHistory, setCascadeHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Load holidays on mount
  useEffect(() => {
    loadHolidays();
    loadCascadeHistory();
  }, []);
  
  const loadHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUndeclaredHolidays(true);
      console.log('Holidays data received:', data);
      
      // Handle both array and object with holidays property
      let holidaysList = [];
      if (Array.isArray(data)) {
        holidaysList = data;
      } else if (data && Array.isArray(data.holidays)) {
        holidaysList = data.holidays;
      } else if (data && data.data && Array.isArray(data.data)) {
        holidaysList = data.data;
      }
      
      console.log('Parsed holidays list:', holidaysList);
      setHolidays(holidaysList);
    } catch (err) {
      console.error('Error loading holidays:', err);
      setError('Failed to load holidays: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleCascade = async () => {
    if (!cascadeDate) {
      setError('Please select a start date for cascading');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get preview of affected lessons
      const preview = await api.getAffectedLessonPlans(cascadeDate);
      
      if (preview.error) {
        setError(preview.error);
        return;
      }
      
      if (!preview.affectedLessons || preview.affectedLessons.length === 0) {
        setError('No lesson plans found on holiday dates from the selected date onwards');
        return;
      }
      
      setAffectedLessons(preview.affectedLessons);
      setShowPreview(true);
    } catch (err) {
      console.error('Error getting affected lessons:', err);
      setError('Failed to load affected lessons: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const confirmCascade = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setShowPreview(false);
      
      const result = await api.cascadeLessonPlans(cascadeDate);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          `Successfully cascaded lesson plans! ` +
          `${result.updatedLessons || 0} lesson plans adjusted to skip ` +
          `${result.holidays?.length || 0} holidays.`
        );
        setCascadeDate('');
        setAffectedLessons([]);
        loadCascadeHistory(); // Reload history after cascade
      }
    } catch (err) {
      console.error('Error cascading lessons:', err);
      setError('Failed to cascade lesson plans: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const loadCascadeHistory = async () => {
    try {
      const data = await api.getRecentCascades(10);
      setCascadeHistory(Array.isArray(data) ? data : (data.cascades || []));
    } catch (err) {
      console.error('Error loading cascade history:', err);
    }
  };
  
  const handleUndoCascade = async (cascadeId) => {
    if (!confirm('Are you sure you want to undo this cascade? All lesson plans will be restored to their original dates.')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const result = await api.undoCascade(cascadeId);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Successfully undid cascade! ${result.restoredCount} lesson plans restored.`);
        loadCascadeHistory();
      }
    } catch (err) {
      console.error('Error undoing cascade:', err);
      setError('Failed to undo cascade: ' + (err.message || 'Unknown error'));
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
          Review undeclared holidays and cascade lesson plans to maintain schedule continuity
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
        
        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Affected Lesson Plans Preview
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  The following {affectedLessons.length} lesson plans are scheduled on holiday dates and will be cascaded forward:
                </p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {affectedLessons.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No lesson plans found</p>
                ) : (
                  <div className="space-y-2">
                    {affectedLessons.map((lesson, index) => (
                      <div
                        key={lesson.lpId || index}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">
                                {(() => {
                                  const [year, month, day] = lesson.date.split('-').map(Number);
                                  const date = new Date(year, month - 1, day);
                                  return date.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                  });
                                })()}
                              </span>
                              <span className="text-sm text-gray-500">Period {lesson.period}</span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className="font-medium text-gray-700">{lesson.class}</span>
                                {' • '}
                                <span className="text-gray-600">{lesson.subject}</span>
                              </div>
                              <div className="text-gray-600">
                                Teacher: {lesson.teacher}
                              </div>
                              {lesson.chapter && (
                                <div className="text-gray-500 text-xs">
                                  Chapter: {lesson.chapter} {lesson.session && `(Session ${lesson.session})`}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {lesson.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setAffectedLessons([]);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCascade}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Cascade'}
                </button>
              </div>
            </div>
          </div>
        )}
        
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
            No undeclared holidays found.
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
                      {(() => {
                        // Parse YYYY-MM-DD format properly
                        const [year, month, day] = holiday.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day);
                        return date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 ml-7">{holiday.reason}</p>
                  <p className="text-xs text-gray-400 mt-1 ml-7">
                    Marked by {holiday.markedBy} on {new Date(holiday.markedAt).toLocaleDateString()}
                  </p>
                </div>
                
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Cascade History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <History size={20} />
            Cascade History
          </h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>
        
        {showHistory && (
          <div className="space-y-3">
            {cascadeHistory.length === 0 ? (
              <p className="text-center py-4 text-gray-500">No cascade operations yet</p>
            ) : (
              cascadeHistory.map((cascade) => (
                <div
                  key={cascade.cascadeId}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {new Date(cascade.cascadeDate).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          cascade.status === 'cascaded' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cascade.status === 'cascaded' ? 'Active' : 'Undone'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Affected {cascade.lessons.length} lesson plans from {cascade.startDate}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        By {cascade.performedBy}
                      </p>
                    </div>
                    
                    {cascade.status === 'cascaded' && (
                      <button
                        onClick={() => handleUndoCascade(cascade.cascadeId)}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-md disabled:opacity-50"
                        title="Undo this cascade"
                      >
                        <RotateCcw size={16} />
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayManagement;
