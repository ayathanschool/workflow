// ClassPeriodSubstitutionView.jsx - Shows classes as rows and periods as columns
import { Calendar, RefreshCw, Check, X, Filter, Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { formatLocalDate, periodToTimeString, formatDateForInput } from '../utils/dateUtils';

export default function ClassPeriodSubstitutionView({ user, periodTimes }) {
  const { theme } = useTheme();
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [timetableData, setTimetableData] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [customPeriodTimes, setCustomPeriodTimes] = useState(periodTimes || null); // Use provided period times or fetch them
  
  // For the dropdown filters
  const [filterClass, setFilterClass] = useState('');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Helper to reorganize timetable data by classes and periods
  const organizeByClassAndPeriod = (data) => {
    if (!Array.isArray(data) || data.length === 0) return { classes: [], periods: [], classMap: {} };
    
    // Extract unique periods and classes
    const periodsSet = new Set();
    const classesSet = new Set();
    
    data.forEach(item => {
      if (item.period) periodsSet.add(Number(item.period));
      if (item.class) classesSet.add(item.class);
    });
    
    // Sort periods numerically
    const periods = Array.from(periodsSet).sort((a, b) => a - b);
    // Sort classes alphabetically with natural sort (1A, 1B, 2A, etc.)
    const classes = Array.from(classesSet).sort((a, b) => {
      // Extract grade number (e.g. '1' from '1A')
      const gradeA = parseInt(a.match(/^\d+/) || '0');
      const gradeB = parseInt(b.match(/^\d+/) || '0');
      
      if (gradeA !== gradeB) return gradeA - gradeB;
      
      // If same grade, sort by section alphabetically
      return a.localeCompare(b);
    });
    
    // Create a map of class -> period -> timetable entry
    const classMap = {};
    
    classes.forEach(cls => {
      classMap[cls] = {};
      periods.forEach(period => {
        // Find matching entry
        const entry = data.find(item => 
          item.class === cls && Number(item.period) === Number(period)
        );
        classMap[cls][period] = entry || null;
      });
    });
    
    return { classes, periods, classMap };
  };
  
  // Get substitution for a class and period
  const getSubstitutionForClassPeriod = (className, period) => {
    return substitutions.find(sub => 
      sub.class === className && Number(sub.period) === Number(period)
    );
  };

  // Fetch timetable for selected date
  const fetchTimetableData = async () => {
    if (!date) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getDailyTimetableForDate(date);
      
      if (Array.isArray(response)) {
        setTimetableData(response);
      } else if (response && Array.isArray(response.data)) {
        setTimetableData(response.data);
      } else {
        setError(response?.error || 'Invalid timetable data format');
        setTimetableData([]);
      }
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setError('Network error while fetching timetable: ' + (err.message || err));
      setTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch substitutions for the date
  const fetchSubstitutions = async () => {
    if (!date) return;
    
    setRefreshing(true);
    
    try {
      const result = await api.getAssignedSubstitutions(date);
      
      if (result && Array.isArray(result.assignedSubstitutions)) {
        setSubstitutions(result.assignedSubstitutions);
      } else {
        // Try alternative endpoint format
        try {
          const merged = await api.getDailyTimetableWithSubstitutions(date);
          if (merged && Array.isArray(merged.timetable)) {
            const subs = merged.timetable
              .filter(item => item && item.isSubstitution)
              .map(item => ({
                date,
                period: Number(item.period || 0),
                class: String(item.class || ''),
                absentTeacher: item.absentTeacher || '',
                regularSubject: String(item.subject || ''),
                substituteTeacher: String(item.teacher || ''),
                substituteSubject: String(item.subject || ''),
                note: item.note || ''
              }));
            setSubstitutions(subs);
          } else {
            setSubstitutions([]);
          }
        } catch (e2) {
          setSubstitutions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching substitutions:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Manual refresh handler
  const handleRefresh = () => {
    fetchTimetableData();
    fetchSubstitutions();
  };

  // We now receive periodTimes from props, so we don't need to fetch them

  // Load data when date changes
  useEffect(() => {
    fetchTimetableData();
    fetchSubstitutions();
  }, [date]);

  // Extract unique classes for filter dropdown
  const uniqueClasses = [...new Set(timetableData.map(item => item.class).filter(Boolean))];

  // Apply class filter if selected
  const filteredData = filterClass
    ? timetableData.filter(item => item.class === filterClass)
    : timetableData;

  // Organize data by classes and periods
  const { classes, periods, classMap } = organizeByClassAndPeriod(filteredData);

  // Period time ranges mapping
  const periodTimeMap = {};
  periods.forEach(period => {
    periodTimeMap[period] = periodToTimeString(period, customPeriodTimes);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Class-Period View
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className={`text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg p-2`}
          >
            {showDebugInfo ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <button 
            onClick={handleRefresh}
            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-600"
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </button>
        </div>
      </div>
      
      {/* Date selection and filters */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 md:p-6 rounded-lg shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              <Calendar className="inline h-4 w-4 mr-1 -mt-1" /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              <Filter className="inline h-4 w-4 mr-1 -mt-1" /> Class Filter
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">All Classes</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <X className="h-5 w-5 text-red-600 mr-2" />
            {error}
          </div>
        </div>
      )}
      
      {/* Success message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-600 mr-2" />
            {successMessage}
          </div>
        </div>
      )}
      
      {/* Timetable - Classes as rows, Periods as columns */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
        <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
          Timetable for {formatLocalDate(date)}
        </h2>
        
        {loading ? (
          <div className="flex justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : classes.length > 0 && periods.length > 0 ? (
          <div className="overflow-x-auto max-w-full">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <th className={`px-3 py-2 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider border`}>
                    Class / Period
                  </th>
                  {periods.map(period => (
                    <th key={period} className={`px-3 py-2 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} uppercase tracking-wider border text-center`}>
                      <div>Period {period}</div>
                      <div className="text-xs font-normal normal-case">{periodTimeMap[period] || ''}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {classes.map(className => (
                  <tr key={className} className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}`}>
                    <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'} border`}>
                      {className}
                    </td>
                    {periods.map(period => {
                      const entry = classMap[className][period];
                      const substitution = getSubstitutionForClassPeriod(className, period);
                      const hasSubstitution = !!substitution;
                      
                      return (
                        <td key={`${className}-${period}`} className={`px-3 py-2 text-sm border ${hasSubstitution ? (theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50') : ''}`}>
                          {entry ? (
                            <div>
                              <div className={`${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'} font-medium`}>
                                {entry.subject}
                              </div>
                              <div className="text-xs mt-1 flex items-center justify-between">
                                <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {hasSubstitution ? (
                                    <span className="flex items-center text-green-600">
                                      <Check className="h-3 w-3 mr-1" /> 
                                      {substitution.substituteTeacher || entry.teacherName}
                                    </span>
                                  ) : entry.teacherName}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-lg`}>
              No timetable data available for this date.
            </p>
          </div>
        )}
      </div>
      
      {/* Substitutions List */}
      {substitutions.length > 0 && (
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
            Substitutions for {formatLocalDate(date)}
          </h2>
          
          <table className="min-w-full">
            <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Period</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Class</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Regular Teacher</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Subject</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Substitute Teacher</th>
              </tr>
            </thead>
            <tbody className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {substitutions.map((sub, index) => (
                <tr key={`${sub.period}-${sub.class}-${index}`}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{sub.period}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{sub.class}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{sub.absentTeacher || 'N/A'}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{sub.regularSubject || sub.subject}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600`}>{sub.substituteTeacher || sub.teacher}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Debug Info */}
      {showDebugInfo && (
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm border border-yellow-500`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
            Debug Information
          </h2>
          <div className="overflow-auto max-h-96">
            <pre className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              {JSON.stringify({
                date,
                substitutionsCount: substitutions.length,
                timetableCount: timetableData.length,
                uniqueClasses: uniqueClasses.length,
                periods: periods.length,
                classes: classes.length
              }, null, 2)}
            </pre>
            <details>
              <summary className={`cursor-pointer mt-2 text-sm font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                Show Substitutions Data
              </summary>
              <pre className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {JSON.stringify(substitutions, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}