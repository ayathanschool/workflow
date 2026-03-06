import React, { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Square, ArrowRight, RotateCcw, History, Filter, Search } from 'lucide-react';
import * as api from '../api';

const LessonCascading = ({ user }) => {
  // Date and filters
  const [selectedDate, setSelectedDate] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  
  // Dropdown options
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  
  // Lessons data
  const [lessons, setLessons] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState(new Set());
  const [loading, setLoading] = useState(false);
  
  // Cascade mode
  const [cascadeMode, setCascadeMode] = useState('skip-day');
  
  // Cascade history
  const [cascadeHistory, setCascadeHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Messages
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Get today's date for defaults and load dropdown options
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setEndDate(today);
    loadCascadeHistory();
    loadDropdownOptions();
  }, []);
  
  const loadDropdownOptions = async () => {
    try {
      const [teachersData, classesData] = await Promise.all([
        api.getAllTeachers(),
        api.getAllClasses()
      ]);
      
      // Teachers data is array of {email, name, roles, classes, subjects}
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      
      // Classes data comes wrapped in {classes: [...]}
      setClasses(Array.isArray(classesData?.classes) ? classesData.classes : []);
    } catch (err) {
      console.error('Error loading dropdown options:', err);
    }
  };
  
  const loadLessons = async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const filters = {};
      if (teacherFilter) filters.teacherEmail = teacherFilter;
      if (classFilter) filters.class = classFilter;
      
      const startDate = selectedDate;
      const finalEndDate = useRange && endDate ? endDate : selectedDate;
      
      const data = await api.getLessonsByDateRange(startDate, finalEndDate, filters);
      console.log('getLessonsByDateRange returned:', data);
      console.log('Is array?', Array.isArray(data));
      console.log('Length:', data?.length);
      setLessons(Array.isArray(data) ? data : []);
      setSelectedLessons(new Set());
    } catch (err) {
      console.error('Error loading lessons:', err);
      setError('Failed to load lessons: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const toggleLesson = (lpId) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(lpId)) {
      newSelected.delete(lpId);
    } else {
      newSelected.add(lpId);
    }
    setSelectedLessons(newSelected);
  };
  
  const toggleAll = () => {
    if (selectedLessons.size === lessons.length) {
      setSelectedLessons(new Set());
    } else {
      setSelectedLessons(new Set(lessons.map(l => l.lpId)));
    }
  };
  
  const handleCascade = async () => {
    if (selectedLessons.size === 0) {
      setError('Please select at least one lesson to cascade');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Use selected mode: 'skip-day' or 'next-period'
      const result = await api.cascadeSelectedLessons(Array.from(selectedLessons), cascadeMode);
      
      if (result.error) {
        setError(result.error);
      } else {
        const message = result.message || `Successfully cascaded ${result.updatedLessons || 0} lesson(s)`;
        setSuccess(message);
        setSelectedLessons(new Set());
        loadLessons();
        loadCascadeHistory();
      }
    } catch (err) {
      console.error('Error cascading lessons:', err);
      setError('Failed to cascade lessons: ' + (err.message || 'Unknown error'));
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
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const result = await api.undoCascade(cascadeId);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Successfully undid cascade: ${result.restoredCount || 0} lessons restored`);
        loadCascadeHistory();
        loadLessons();
      }
    } catch (err) {
      console.error('Error undoing cascade:', err);
      setError('Failed to undo cascade: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-clear messages
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Calendar size={28} />
          Lesson Plan Cascading
        </h1>
        <p className="text-gray-600">
          Automatically reschedule lessons based on teacher's timetable - perfect for holidays, closures, or adjustments
        </p>
      </div>
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckSquare className="text-green-600 mr-2 flex-shrink-0" size={20} />
          <span className="text-green-800">{success}</span>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <span className="text-red-600 mr-2 flex-shrink-0">✕</span>
          <span className="text-red-800">{error}</span>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <Filter size={20} />
          Select Lessons to Cascade
        </h2>
        
        <div className="mb-4 text-sm text-gray-600">
          Choose the date (or date range) containing lessons you want to reschedule
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={useRange}
                onChange={(e) => setUseRange(e.target.checked)}
                className="rounded"
              />
              Select Date Range
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!useRange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="End date"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Teacher (Optional)</label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Teachers</option>
              {teachers.map(teacher => (
                <option key={teacher.email} value={teacher.email}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class (Optional)</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={loadLessons}
          disabled={loading || !selectedDate}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Search size={18} />
          {loading ? 'Loading...' : 'Load Lessons'}
        </button>
      </div>
      
      {/* No lessons found message */}
      {!loading && lessons.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            No lessons found for the selected date range. Try:
          </p>
          <ul className="list-disc ml-5 mt-2 text-sm text-yellow-700">
            <li>Selecting a different date</li>
            <li>Removing teacher/class filters</li>
            <li>Checking if lessons exist in your LessonPlans sheet</li>
          </ul>
        </div>
      )}
      
      {lessons.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Found {lessons.length} Lesson(s) - {selectedLessons.size} Selected
            </h2>
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              {selectedLessons.size === lessons.length ? (
                <>
                  <CheckSquare size={18} />
                  Deselect All
                </>
              ) : (
                <>
                  <Square size={18} />
                  Select All
                </>
              )}
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chapter
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lessons.map((lesson, index) => (
                  <tr
                    key={lesson.lpId || index}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedLessons.has(lesson.lpId) ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleLesson(lesson.lpId)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLesson(lesson.lpId);
                        }}
                        className="text-blue-600"
                      >
                        {selectedLessons.has(lesson.lpId) ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(lesson.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {lesson.period}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {lesson.class}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {lesson.subject}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {lesson.teacher}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lesson.chapter || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 border-t pt-6">
            <h3 className="text-md font-semibold text-gray-800 mb-2">Reschedule Selected Lessons</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose how to reschedule lessons based on the teacher's timetable:
            </p>
            
            <div className="flex flex-col gap-3 mb-4">
              <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${cascadeMode === 'skip-day' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="cascadeMode"
                  value="skip-day"
                  checked={cascadeMode === 'skip-day'}
                  onChange={(e) => setCascadeMode(e.target.value)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">Option 1: Skip to Next Day</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Recommended for holidays</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Skips the current day completely and moves to the <strong>next day</strong> where the teacher has this class+subject in their timetable
                  </p>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <strong>Example:</strong> Teacher has 10A Math on Mon P3, Wed P5, Fri P2<br/>
                    Cascading Mon P3 → <strong>Wed P5</strong> (skips all Monday slots)
                  </div>
                </div>
              </label>
              
              <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${cascadeMode === 'next-period' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="cascadeMode"
                  value="next-period"
                  checked={cascadeMode === 'next-period'}
                  onChange={(e) => setCascadeMode(e.target.value)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">Option 2: Next Period</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Can be same day</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Moves to the <strong>next occurrence</strong> in timetable (can be later period on same day, or next day)
                  </p>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <strong>Example:</strong> Teacher has 10A Math on Mon P1, Mon P6, Wed P3<br/>
                    Cascading Mon P1 → <strong>Mon P6</strong> (next period on same day)<br/>
                    Cascading Mon P6 → <strong>Wed P3</strong> (next day when P7+ doesn't exist)
                  </div>
                </div>
              </label>
            </div>
            
            <button
              onClick={handleCascade}
              disabled={loading || selectedLessons.size === 0}
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <ArrowRight size={18} />
              {loading ? 'Cascading...' : `Cascade ${selectedLessons.size} Lesson(s)`}
            </button>
          </div>
        </div>
      )}
      
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
            {showHistory ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {showHistory && (
          <div className="space-y-3">
            {cascadeHistory.length === 0 ? (
              <p className="text-center py-4 text-gray-500">No cascade operations yet</p>
            ) : (
              cascadeHistory.map((cascade, index) => (
                <div
                  key={cascade.cascadeId || `cascade-${index}`}
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
                        Affected {cascade.lessons?.length || 0} lesson plans from {
                          (() => {
                            try {
                              const date = new Date(cascade.startDate);
                              return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return cascade.startDate;
                            }
                          })()
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        By {cascade.performedBy}
                      </p>
                    </div>
                    
                    {cascade.status === 'cascaded' && (
                      <button
                        onClick={() => handleUndoCascade(cascade.cascadeId)}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-md disabled:opacity-50 transition-colors"
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

export default LessonCascading;
