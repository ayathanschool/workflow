import React, { useState, useEffect } from 'react';
import { Calendar, Download, Filter, RefreshCw, UserPlus, FileText, FileSpreadsheet, Eye, EyeOff, Table, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toISTDateString, formatDateForInput, parseApiDate, formatLocalDate, periodToTimeString } from '../utils/dateUtils';
import * as api from '../api';

const EnhancedSubstitutionView = ({ user, periodTimes }) => {
  // State Management
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()));
  const [timetableData, setTimetableData] = useState([]);
  const [substitutionData, setSubstitutionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dataRefreshKey, setDataRefreshKey] = useState(0); // Used to force re-fetches
  const [customPeriodTimes, setCustomPeriodTimes] = useState(periodTimes || null); // Use provided period times or fetch them
  
  // Filter States
  const [teacherFilter, setTeacherFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showWithSubstitutions, setShowWithSubstitutions] = useState(true);
  
  // Modal States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  
  // Assignment Form States
  const [assignmentForm, setAssignmentForm] = useState({
    substituteTeacher: '',
    substituteSubject: '',
    note: ''
  });

  // Debug States
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [lastApiCall, setLastApiCall] = useState(null);
  const [apiCallHistory, setApiCallHistory] = useState([]);

  // Add to API call history
  const logApiCall = (endpoint, params, result) => {
    setLastApiCall({
      endpoint,
      params,
      timestamp: new Date().toISOString(),
      success: !!result && !result.error,
      error: result?.error || null
    });
    
    setApiCallHistory(prev => [
      {
        endpoint,
        params,
        timestamp: new Date().toISOString(),
        success: !!result && !result.error,
        error: result?.error || null
      },
      ...prev.slice(0, 9)  // Keep last 10 calls
    ]);
  };

  // Fetch timetable for selected date
  const fetchTimetableData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // console.log('Fetching timetable for date:', selectedDate);
      const response = await api.getDailyTimetableForDate(selectedDate);
      // console.log('Timetable data response:', response);
      
      logApiCall('getDailyTimetableForDate', { date: selectedDate }, response);

      if (response && Array.isArray(response)) {
        setTimetableData(response);
        setError(''); // Clear any previous errors
      } else if (response && response.success && response.data) {
        setTimetableData(response.data);
        setError(''); // Clear any previous errors
      } else {
        setError(response?.error || 'Failed to fetch timetable');
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

  // Fetch substitution data for selected date
  const fetchSubstitutionData = async () => {
    try {
      // console.log('Fetching substitutions for date:', selectedDate);
      
      // Force no caching
      const response = await api.getSubstitutionsForDate(selectedDate, { noCache: true });
      
      // console.log('Substitution data response:', response);
      // console.log('Response type:', typeof response);
      
      logApiCall('getSubstitutionsForDate', { date: selectedDate }, response);

      let substitutions = [];

      if (Array.isArray(response)) {
        substitutions = response;
        // console.log('Set substitution data (direct array):', response);
      } else if (response && response.success && Array.isArray(response.data)) {
        substitutions = response.data;
        // console.log('Set substitution data (response.data array):', response.data);
      } else if (response && Array.isArray(response.substitutions)) {
        substitutions = response.substitutions;
        // console.log('Set substitution data (response.substitutions array):', response.substitutions);
      } else if (response && response.data && Array.isArray(response.data.substitutions)) {
        substitutions = response.data.substitutions;
        // console.log('Set substitution data (response.data.substitutions array):', response.data.substitutions);
      } else {
        console.warn('No substitution data found or invalid format. Response:', response);
        
        // Try direct fetch via XMLHttpRequest as a fallback
        // console.log('Attempting direct fetch as fallback...');
        
        try {
          const directUrl = `${api.getBaseUrl()}?action=getSubstitutionsForDate&date=${encodeURIComponent(selectedDate)}&_=${Date.now()}`;
          
          // console.log('Direct URL:', directUrl);
          
          const xhr = new XMLHttpRequest();
          xhr.open('GET', directUrl, false); // Synchronous request
          xhr.send(null);
          
          if (xhr.status === 200) {
            const fallbackResponse = JSON.parse(xhr.responseText);
            // console.log('Fallback response:', fallbackResponse);
            
            if (Array.isArray(fallbackResponse)) {
              substitutions = fallbackResponse;
              // console.log('Set substitution data from fallback (direct array):', fallbackResponse);
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback fetch failed:', fallbackErr);
        }
        
        if (substitutions.length === 0) {
          substitutions = [];
        }
      }

      // console.log('Setting substitution data:', substitutions);
      setSubstitutionData(substitutions);
      
      // Log substitution data for debugging
      if (substitutions.length > 0) {
        // console.log('FOUND SUBSTITUTIONS:', substitutions.length);
        // substitutions.forEach((sub, i) => {
        //   console.log(`Substitution ${i+1}:`, sub);
        // });
      } else {
        console.warn('No substitutions found for date', selectedDate);
      }
      
    } catch (err) {
      console.error('Error fetching substitution data:', err);
      setSubstitutionData([]);
      logApiCall('getSubstitutionsForDate', { date: selectedDate }, { error: err.message || String(err) });
    }
  };

  // Get unique teachers and classes for filters
  const uniqueTeachers = [...new Set(timetableData.map(item => item.teacherName).filter(Boolean))].sort();
  const uniqueClasses = [...new Set(timetableData.map(item => item.class).filter(Boolean))].sort();

  // Force refresh all data
  const refreshAllData = async () => {
    setDataRefreshKey(prev => prev + 1);
    await fetchTimetableData();
    await fetchSubstitutionData();
  };

  // We now receive periodTimes from props, so we don't need to fetch them

  // Auto-fetch data when component mounts or date changes
  useEffect(() => {
    if (selectedDate) {
      fetchTimetableData();
      fetchSubstitutionData();
    }
  }, [selectedDate, dataRefreshKey]);

  // Filter timetable data
  const filteredTimetable = timetableData.filter(item => {
    const teacherMatch = !teacherFilter || item.teacherName?.toLowerCase().includes(teacherFilter.toLowerCase());
    const classMatch = !classFilter || item.class?.toLowerCase().includes(classFilter.toLowerCase());
    return teacherMatch && classMatch;
  });

  // Get period time display using the utility function and custom times if available
  const getPeriodTime = (period) => {
    return periodToTimeString(period, customPeriodTimes);
  };

  // Check if period has substitution
  const getSubstitutionForPeriod = (period, className) => {
    // console.log(`Looking for substitution - Period: ${period}, Class: ${className}`);
    // console.log('Available substitution data:', substitutionData);
    
    if (!substitutionData || substitutionData.length === 0) {
      // console.log('No substitution data available');
      return null;
    }
    
    const substitution = substitutionData.find(sub => {
      const periodMatch = (parseInt(sub.period) === parseInt(period));
      const classMatch = String(sub.class || '').toLowerCase() === String(className || '').toLowerCase();
      
      // console.log(`Checking sub: Period ${sub.period} (${periodMatch ? '✓' : '✗'}), Class ${sub.class} (${classMatch ? '✓' : '✗'})`);
      
      return periodMatch && classMatch;
    });
    
    // console.log('Found substitution:', substitution || 'undefined');
    return substitution || null;
  };

  // Open assignment modal
  const openAssignModal = async (period) => {
    setSelectedPeriod(period);
    setAssignmentForm({
      substituteTeacher: '',
      substituteSubject: period.subject,
      note: ''
    });
    
    // Fetch available teachers for this period
    try {
      console.log('Fetching available teachers for period:', period.period);
      const response = await api.getAvailableTeachers(selectedDate, period.period);
      console.log('Available teachers response:', response);
      
      logApiCall('getAvailableTeachers', { date: selectedDate, period: period.period }, response);
      
      if (response && Array.isArray(response)) {
        setAvailableTeachers(response);
      } else if (response && response.success && response.data) {
        setAvailableTeachers(response.data);
      } else {
        setAvailableTeachers([]);
      }
    } catch (err) {
      console.error('Error fetching available teachers:', err);
      setAvailableTeachers([]);
    }
    
    setShowAssignModal(true);
  };

  // Assign substitute teacher
  const assignSubstitute = async () => {
    if (!selectedPeriod || !assignmentForm.substituteTeacher) {
      setError('Please select a substitute teacher');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const substitutionData = {
        date: selectedDate,
        period: selectedPeriod.period,
        class: selectedPeriod.class,
        absentTeacher: selectedPeriod.teacherEmail || selectedPeriod.teacherName,
        regularSubject: selectedPeriod.subject,
        substituteTeacher: assignmentForm.substituteTeacher,
        substituteSubject: assignmentForm.substituteSubject || selectedPeriod.subject,
        note: assignmentForm.note || '',
      };

      console.log('Assigning substitution:', substitutionData);
      const response = await api.addSubstitution(substitutionData);
      console.log('Assignment response:', response);
      
      logApiCall('addSubstitution', substitutionData, response);

      // Handle different response formats - be more lenient with success detection
      const isSuccess = (
        response?.success === true || 
        response?.status === 'success' || 
        response?.message?.toLowerCase().includes('success')
      );

      console.log('Success check result:', isSuccess);

      if (isSuccess) {
        // Close modal first
        setShowAssignModal(false);
        
        // Show success message
        const successMsg = `Successfully assigned ${assignmentForm.substituteTeacher} to Period ${selectedPeriod.period} - ${selectedPeriod.class}`;
        setSuccessMessage(successMsg);
        console.log('Setting success message:', successMsg);
        
        // Clear form
        setAssignmentForm({
          substituteTeacher: '',
          substituteSubject: '',
          note: ''
        });
        
        // Small delay to ensure modal closes before refresh
        setTimeout(async () => {
          try {
            console.log('Refreshing data after assignment...');
            // Refresh data
            await fetchSubstitutionData();
            await fetchTimetableData();
            console.log('Data refresh completed');
          } catch (refreshError) {
            console.error('Error refreshing data:', refreshError);
          }
        }, 500);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
        
      } else {
        setError(response?.error || response?.message || 'Failed to assign substitute');
      }
    } catch (err) {
      console.error('Error assigning substitute:', err);
      setError('Network error while assigning substitute: ' + (err.message || err));
      logApiCall('addSubstitution', {}, { error: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportToPDF = () => {
    try {
      // Create table content for PDF export
      const tableData = Object.keys(groupedTimetable)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .flatMap(period => 
          groupedTimetable[period].map(item => {
            const substitution = showWithSubstitutions ? getSubstitutionForPeriod(parseInt(period), item.class) : null;
            const hasSubstitution = !!substitution;
            
            return {
              period: period,
              time: getPeriodTime(parseInt(period)),
              class: item.class,
              subject: hasSubstitution && showWithSubstitutions ? 
                `${item.subject} → ${substitution.substituteSubject}` : item.subject,
              teacher: hasSubstitution && showWithSubstitutions ? 
                `${item.teacherName} → ${substitution.substituteTeacher}` : item.teacherName,
              status: hasSubstitution ? 'Substituted' : 'Regular',
              note: hasSubstitution ? substitution.note : ''
            };
          })
        );

      // Create HTML content for PDF
      const htmlContent = `
        <html>
          <head>
            <title>Timetable - ${formatLocalDate(selectedDate)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; text-align: center; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .substituted { background-color: #fff3cd; }
              .regular { background-color: #d4edda; }
            </style>
          </head>
          <body>
            <h1>School Timetable ${showWithSubstitutions ? '(With Substitutions)' : '(Regular View)'}</h1>
            <h2>${formatLocalDate(selectedDate)}</h2>
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${tableData.map(row => `
                  <tr class="${row.status.toLowerCase()}">
                    <td>${row.period}</td>
                    <td>${row.time}</td>
                    <td>${row.class}</td>
                    <td>${row.subject}</td>
                    <td>${row.teacher}</td>
                    <td>${row.status}</td>
                    <td>${row.note}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timetable-${selectedDate}${showWithSubstitutions ? '-with-substitutions' : ''}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export PDF: ' + error.message);
    }
  };

  const exportToExcel = () => {
    try {
      // Create CSV content for Excel compatibility
      const headers = ['Period', 'Time', 'Class', 'Subject', 'Teacher', 'Status', 'Note'];
      
      const csvData = Object.keys(groupedTimetable)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .flatMap(period => 
          groupedTimetable[period].map(item => {
            const substitution = showWithSubstitutions ? getSubstitutionForPeriod(parseInt(period), item.class) : null;
            const hasSubstitution = !!substitution;
            
            return [
              period,
              getPeriodTime(parseInt(period)),
              item.class,
              hasSubstitution && showWithSubstitutions ? 
                `${item.subject} → ${substitution.substituteSubject}` : item.subject,
              hasSubstitution && showWithSubstitutions ? 
                `${item.teacherName} → ${substitution.substituteTeacher}` : item.teacherName,
              hasSubstitution ? 'Substituted' : 'Regular',
              hasSubstitution ? substitution.note : ''
            ];
          })
        );

      // Convert to CSV format
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timetable-${selectedDate}${showWithSubstitutions ? '-with-substitutions' : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export Excel: ' + error.message);
    }
  };

  // Group timetable by periods for display (original grouping)
  const groupedTimetable = filteredTimetable.reduce((acc, item) => {
    const period = item.period;
    if (!acc[period]) acc[period] = [];
    acc[period].push(item);
    return acc;
  }, {});
  
  // Group timetable by classes for alternative view (classes as columns)
  const classesByPeriod = {};
  const uniquePeriods = [...new Set(filteredTimetable.map(item => item.period))].sort((a, b) => parseInt(a) - parseInt(b));
  const uniqueClassNames = [...new Set(filteredTimetable.map(item => item.class))].sort();
  
  // Initialize the structure with empty cells
  uniquePeriods.forEach(period => {
    classesByPeriod[period] = {};
    uniqueClassNames.forEach(className => {
      classesByPeriod[period][className] = null;
    });
  });
  
  // Fill in the data
  filteredTimetable.forEach(item => {
    if (item.period && item.class) {
      classesByPeriod[item.period][item.class] = item;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Substitution Management
        </h2>
        <div className="flex gap-2">
          <button
            onClick={refreshAllData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Fetch Button */}
          <div className="flex items-end">
            <button
              onClick={refreshAllData}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Fetching...' : 'Fetch Timetable'}
            </button>
          </div>

          {/* Teacher Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Teacher
            </label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Teachers</option>
              {uniqueTeachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Class
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Classes</option>
              {uniqueClasses.map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle View */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const newValue = !showWithSubstitutions;
              console.log('Toggle substitution view:', showWithSubstitutions, '=>', newValue);
              setShowWithSubstitutions(newValue);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showWithSubstitutions 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
            }`}
          >
            {showWithSubstitutions ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showWithSubstitutions ? 'With Substitutions' : 'Regular View'}
          </button>
          
          {/* Debug Toggle */}
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className={`flex items-center gap-2 px-3 py-1 text-xs rounded-lg transition-colors ${
              showDebugInfo 
                ? 'bg-amber-600 text-white hover:bg-amber-700' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Debug Info */}
      {showDebugInfo && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs overflow-auto max-h-64">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-700 dark:text-gray-300">Debug Information</h3>
            <button
              onClick={fetchSubstitutionData}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
            >
              Fetch Substitution Data
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <strong>Timetable Data:</strong> {timetableData.length} items
            </div>
            <div>
              <strong>Substitution Data:</strong> {substitutionData.length} items
            </div>
            <div>
              <strong>View Mode:</strong> {showWithSubstitutions ? 'With Substitutions' : 'Regular'}
            </div>
            <div>
              <strong>Selected Date:</strong> {selectedDate}
            </div>
          </div>
          
          {/* Last API Call */}
          {lastApiCall && (
            <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <div className="font-bold mb-1">Last API Call: {lastApiCall.endpoint}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong>Params:</strong> {JSON.stringify(lastApiCall.params)}
                </div>
                <div>
                  <strong>Result:</strong> {lastApiCall.success ? '✅ Success' : `❌ Error: ${lastApiCall.error || 'Unknown'}`}
                </div>
                <div className="col-span-2">
                  <strong>Timestamp:</strong> {new Date(lastApiCall.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
          
          {/* Substitution Data */}
          {substitutionData.length > 0 ? (
            <div className="mb-3">
              <div className="font-bold mb-1">Substitution Data ({substitutionData.length} records):</div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="p-1 border">Period</th>
                    <th className="p-1 border">Class</th>
                    <th className="p-1 border">Absent</th>
                    <th className="p-1 border">Substitute</th>
                    <th className="p-1 border">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {substitutionData.map((sub, i) => (
                    <tr key={i} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                      <td className="p-1 border">{sub.period}</td>
                      <td className="p-1 border">{sub.class}</td>
                      <td className="p-1 border">{sub.absentTeacher}</td>
                      <td className="p-1 border">{sub.substituteTeacher}</td>
                      <td className="p-1 border">{sub.substituteSubject || sub.regularSubject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-3 text-amber-600">No substitution data available.</div>
          )}
          
          {/* Raw Response Data */}
          <div className="mb-3">
            <button
              onClick={() => console.log('Substitution data:', substitutionData)}
              className="text-xs bg-gray-600 text-white px-2 py-1 rounded mr-2"
            >
              Log Substitution Data
            </button>
            
            <button
              onClick={() => console.log('Timetable data:', timetableData)}
              className="text-xs bg-gray-600 text-white px-2 py-1 rounded"
            >
              Log Timetable Data
            </button>
          </div>
        </div>
      )}

      {/* Timetable Display */}
      {timetableData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Timetable for {formatLocalDate(selectedDate)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Classes (rows) × Periods (columns)
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border">Class / Period</th>
                  {uniquePeriods.map(period => (
                    <th key={period} className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border">
                      <div>Period {period}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{getPeriodTime(parseInt(period))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueClassNames.map(className => {
                  return (
                    <tr key={`class-${className}`} className={uniqueClassNames.indexOf(className) % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium border">
                        {className}
                      </td>
                      {uniquePeriods.map(period => {
                        // Find the item for this class in this period
                        const item = filteredTimetable.find(entry => 
                          entry.class === className && entry.period === period
                        );
                        if (!item) {
                          return (
                            <td key={`${className}-${period}`} className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center border">
                              -
                            </td>
                          );
                        }
                        
                        const substitution = showWithSubstitutions ? getSubstitutionForPeriod(parseInt(period), className) : null;
                        const hasSubstitution = !!substitution;
                        
                        return (
                          <td 
                            key={`${className}-${period}`}
                            className={`px-4 py-3 text-sm border ${hasSubstitution ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                          >
                            <div className="text-center">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {hasSubstitution && showWithSubstitutions ? (
                                  <>
                                    <span className="line-through text-gray-500">{item.subject}</span>
                                    <div className="text-orange-600 dark:text-orange-400">{substitution.substituteSubject || substitution.regularSubject}</div>
                                  </>
                                ) : (
                                  item.subject
                                )}
                              </div>
                              <div className="text-xs mt-1">
                                {hasSubstitution && showWithSubstitutions ? (
                                  <>
                                    <span className="line-through text-gray-500">{item.teacherName}</span>
                                    <div className="text-orange-600 dark:text-orange-400">{substitution.substituteTeacher}</div>
                                  </>
                                ) : (
                                  item.teacherName
                                )}
                              </div>
                              <div className="mt-2">
                                {hasSubstitution ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                    Substituted
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openAssignModal(item)}
                                    className="flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors w-full"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    Assign
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Substitute Teacher
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Period: {selectedPeriod.period} | Class: {selectedPeriod.class}
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Absent Teacher: {selectedPeriod.teacherName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Regular Subject: {selectedPeriod.subject}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Substitute Teacher *
                </label>
                <select
                  value={assignmentForm.substituteTeacher}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, substituteTeacher: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select a teacher...</option>
                  {availableTeachers.map(teacher => (
                    <option key={teacher.email || teacher.name} value={teacher.name}>
                      {teacher.name} ({teacher.subjects?.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Substitute Subject
                </label>
                <input
                  type="text"
                  value={assignmentForm.substituteSubject}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, substituteSubject: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Note (Optional)
                </label>
                <textarea
                  value={assignmentForm.note}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={loading}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  loading 
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={assignSubstitute}
                disabled={loading || !assignmentForm.substituteTeacher}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  loading || !assignmentForm.substituteTeacher
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assigning...
                  </>
                ) : (
                  'Assign Substitute'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loading && timetableData.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No timetable data found for the selected date.</p>
          <p className="text-sm">Click "Fetch Timetable" to load data.</p>
        </div>
      )}
    </div>
  );
};

export default EnhancedSubstitutionView;