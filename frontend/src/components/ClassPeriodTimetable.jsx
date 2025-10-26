// ClassPeriodTimetable.jsx - Class-based timetable view with periods as columns
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { todayIST, formatLocalDate, periodToTimeString } from '../utils/dateUtils';

export default function ClassPeriodTimetable({ user, date: initialDate }) {
  const [date, setDate] = useState(initialDate || todayIST());
  const [timetableData, setTimetableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data organization
  const [periodHeaders, setPeriodHeaders] = useState([]);
  const [classTimetable, setClassTimetable] = useState({});
  
  useEffect(() => {
    loadTimetable();
  }, [date]);
  
  async function loadTimetable() {
    if (!date) return;
    
    setLoading(true);
    setError('');
    
    try {
      // You may need to adjust this API call based on your actual API structure
      const response = await api.getDailyTimetableForDate(date);
      const data = Array.isArray(response) ? response : [];
      setTimetableData(data);
      
      // Process the data to organize by class and period
      processDataForClassView(data);
    } catch (err) {
      console.error('Failed to load timetable:', err);
      setError('Failed to load timetable: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }
  
  function processDataForClassView(data) {
    if (!Array.isArray(data) || data.length === 0) {
      setPeriodHeaders([]);
      setClassTimetable({});
      return;
    }
    
    // Extract all unique periods and sort them numerically
    const periods = [...new Set(data.map(item => item.period))]
      .filter(Boolean)
      .sort((a, b) => parseInt(a) - parseInt(b));
    
    // Create period headers with time info
    const headers = periods.map(period => ({
      period,
      timeLabel: periodToTimeString(period)
    }));
    setPeriodHeaders(headers);
    
    // Group timetable data by class
    const byClass = {};
    
    // Initialize all classes with empty periods
    const allClasses = [...new Set(data.map(item => item.class))].filter(Boolean);
    allClasses.forEach(className => {
      byClass[className] = {};
      // Initialize each period as null for this class
      periods.forEach(period => {
        byClass[className][period] = null;
      });
    });
    
    // Fill in the actual data
    data.forEach(item => {
      if (item.class && item.period) {
        byClass[item.class][item.period] = item;
      }
    });
    
    setClassTimetable(byClass);
  }
  
  // Helper to sort class names naturally (1A, 1B, 2A, 2B, etc)
  function sortClassNames(classes) {
    return classes.sort((a, b) => {
      // Extract grade number (e.g. '1' from '1A')
      const gradeA = parseInt(a.match(/^\d+/) || '0');
      const gradeB = parseInt(b.match(/^\d+/) || '0');
      
      if (gradeA !== gradeB) return gradeA - gradeB;
      
      // If same grade, sort by section alphabetically
      return a.localeCompare(b);
    });
  }
  
  const displayDate = formatLocalDate(date);
  const sortedClasses = sortClassNames(Object.keys(classTimetable));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Class Timetable</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors" 
            onClick={loadTimetable} 
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {displayDate && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">{displayDate}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="ml-3 text-gray-600">Loading timetable...</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  {periodHeaders.map(header => (
                    <th key={header.period} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>Period {header.period}</div>
                      <div className="text-xxs text-gray-400 normal-case">{header.timeLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedClasses.length === 0 ? (
                  <tr>
                    <td colSpan={periodHeaders.length + 1} className="px-4 py-8 text-center text-gray-500">
                      No timetable data available for this date.
                    </td>
                  </tr>
                ) : (
                  sortedClasses.map(className => (
                    <tr key={className}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {className}
                      </td>
                      {periodHeaders.map(header => {
                        const cellData = classTimetable[className][header.period];
                        return (
                          <td key={`${className}-${header.period}`} className="px-4 py-3">
                            {cellData ? (
                              <div className="border border-gray-200 rounded p-2 bg-gray-50 text-sm">
                                <div className="font-medium text-gray-900">{cellData.subject}</div>
                                <div className="text-gray-600 text-xs">{cellData.teacherName}</div>
                                {cellData.substitution && (
                                  <div className="text-xs font-medium text-blue-600 mt-1">
                                    Sub: {cellData.substitution.teacherName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}