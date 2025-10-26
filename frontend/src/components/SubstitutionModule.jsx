// src/components/SubstitutionModule.jsx
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { Plus, Calendar, User, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function SubstitutionModule() {
  const { theme } = useTheme();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [absentTeacher, setAbsentTeacher] = useState(''); // identifier: email or name
  const [absentTeachers, setAbsentTeachers] = useState([]); // array of { name, email }
  const [timetable, setTimetable] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [freeTeachers, setFreeTeachers] = useState({});
  // Track selected substitute per period-class row: { '<period>-<class>': identifierOrObject }
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({});
  // Track which rows are currently being assigned: { '<period>-<class>': boolean }
  const [assigningRows, setAssigningRows] = useState({});
  const [assignError, setAssignError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Helper: refresh assigned substitutions for a date with robust fallbacks
  async function refreshAssigned(targetDate) {
    // 1) Direct endpoint
    try {
      const direct = await api.getAssignedSubstitutions(targetDate, { noCache: true });
      const assigned = (direct && Array.isArray(direct.assignedSubstitutions)) ? direct.assignedSubstitutions : [];
      if (assigned.length > 0) {
        setSubstitutions(assigned);
        return;
      }
    } catch (e1) {
      // continue to next fallback
      console.warn('getAssignedSubstitutions failed:', e1?.message || e1);
    }
    // 2) Vacant endpoint (compatibility)
    try {
      const allSubs = await api.getVacantSlotsForAbsent(targetDate, [], { noCache: true });
      const fromVacant = (allSubs && Array.isArray(allSubs.assignedSubstitutions)) ? allSubs.assignedSubstitutions : [];
      if (fromVacant.length > 0) {
        setSubstitutions(fromVacant);
        return;
      }
    } catch (e2) {
      console.warn('getVacantSlotsForAbsent failed:', e2?.message || e2);
    }
    // 3) Merged timetable fallback (derive substitutions)
    try {
      const merged = await api.getDailyTimetableWithSubstitutions(targetDate, { noCache: true });
      const list = (merged && Array.isArray(merged.timetable)) ? merged.timetable : [];
      const normalized = list
        .filter(item => item && item.isSubstitution)
        .map(item => ({
          date: targetDate,
          period: Number(item.period || 0),
          class: String(item.class || ''),
          absentTeacher: '',
          regularSubject: String(item.subject || ''),
          substituteTeacher: String(item.teacher || ''),
          substituteSubject: String(item.subject || ''),
          note: ''
        }));
      setSubstitutions(normalized);
    } catch (e3) {
      console.warn('getDailyTimetableWithSubstitutions failed:', e3?.message || e3);
      setSubstitutions([]);
    }
  }

  // Manual refresh handler
  async function handleRefresh() {
    if (!date) return;
    try {
      setRefreshing(true);
  await refreshAssigned(date);
    } finally {
      setRefreshing(false);
    }
  }
  
  // Fetch substitutions for the date when component loads (even without absent teacher selected)
  useEffect(() => {
    if (!date) return;
    const timeoutId = setTimeout(() => refreshAssigned(date), 200);
    return () => clearTimeout(timeoutId);
  }, [date]);

  // Fetch list of potential absent teachers
  useEffect(() => {
    async function fetchAbsentTeachers() {
      try {
        const teachers = await api.getPotentialAbsentTeachers();
        // backend returns array of { name, email }
        setAbsentTeachers(Array.isArray(teachers) ? teachers : []);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    }
    fetchAbsentTeachers();
  }, []);

  // Fetch timetable when teacher or date changes (use daily timetable API)
  useEffect(() => {
    let mounted = true;
    async function fetchTimetable() {
      if (!absentTeacher || !date) return;      setLoading(true);
      try {
        // Fetch the teacher's daily timetable for the selected date
  // absentTeacher is the identifier (prefer email if provided)
  const teacherDaily = await api.getTeacherDailyTimetable(absentTeacher, date);

        // teacherDaily expected to be an array of slots: { period, class, subject, ... }
        const filteredTimetable = Array.isArray(teacherDaily) ? teacherDaily.slice() : [];

        // Sort by numeric period when possible
        filteredTimetable.sort((a, b) => (parseInt(a.period) || 0) - (parseInt(b.period) || 0));

        if (mounted) setTimetable(filteredTimetable);

        // Refresh substitutions for the date (independent of absent teacher)
        if (mounted) await refreshAssigned(date);

        // Fetch free teachers for each period (limit concurrent requests)
        const teachersMap = {};
        const periods = filteredTimetable.map(slot => slot.period);
        
        // Process periods in smaller batches to avoid overwhelming the server
        const batchSize = 3;
        for (let i = 0; i < periods.length; i += batchSize) {
          const batch = periods.slice(i, i + batchSize);
          await Promise.all(batch.map(async (period) => {
            try {
              const free = await api.getFreeTeachers(date, period, [absentTeacher]);
              teachersMap[period] = Array.isArray(free) ? free : [];
            } catch (err) {
              console.error(`Error fetching free teachers for period ${period}:`, err);
              teachersMap[period] = [];
            }
          }));
          
          // Small delay between batches to be gentle on the server
          if (i + batchSize < periods.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (mounted) setFreeTeachers(teachersMap);
      } catch (err) {
        console.error('Error fetching timetable or substitutes:', err);
        if (mounted) {
          setTimetable([]);
          setSubstitutions([]);
          setFreeTeachers({});
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchTimetable();
    return () => { mounted = false };
  }, [absentTeacher, date]);
  
  // Handle substitute teacher assignment
  async function handleSubstituteAssign(period, classname, subject, substituteTeacher) {
    if (!substituteTeacher || !period || !classname) return false;
    
    const rowKey = `${period}-${classname}`;
    setAssignError(null);
    setSuccessMessage(null);
    setAssigningRows(prev => ({ ...prev, [rowKey]: true }));
    
    try {
      // substituteTeacher may be an object { name, email } or a string
      const substituteIdentifier = typeof substituteTeacher === 'object' ? (substituteTeacher.email || substituteTeacher.name) : substituteTeacher;
      const substituteDisplayName = typeof substituteTeacher === 'object' ? (substituteTeacher.name || substituteTeacher.email) : substituteTeacher;
      
      console.log('Assigning substitution:', { date, period, class: classname, substitute: substituteIdentifier });
      
      await api.assignSubstitution({
        date,
        absentTeacher,
        period,
        class: classname,
        regularSubject: subject,
        substituteTeacher: substituteIdentifier,
        substituteSubject: subject // Default to same subject
      });

      // Immediately show the assignment in UI (optimistic update)
      const newSub = {
        period: Number(period),
        class: classname,
        absentTeacher: absentTeacher,
        regularSubject: subject,
        substituteTeacher: substituteIdentifier,
        substituteSubject: subject,
        date: date
      };
      
      setSubstitutions(prev => {
        // Remove any existing assignment for this period/class
        const filtered = prev.filter(s => !(Number(s.period) === Number(period) && String(s.class) === String(classname)));
        return [...filtered, newSub];
      });

      // Also refresh from server to ensure list matches persisted data
      try { await refreshAssigned(date); } catch {}

      // Clear the selected substitute for this row since it's now assigned
      setSelectedSubstitutes(prev => { 
        const updated = { ...prev }; 
        delete updated[rowKey]; 
        return updated; 
      });

      // Show success message briefly
      setSuccessMessage(`✓ Assigned ${substituteDisplayName} to period ${period}, ${classname}`);
      setAssignError(null);
      
      // Clear success message after 2 seconds (shorter to avoid confusion)
      setTimeout(() => setSuccessMessage(null), 2000);
      
      return true;
    } catch (err) {
      console.error('Error assigning substitution:', err);
      const errorMsg = err?.message || String(err);
      setAssignError(`Failed to assign substitution: ${errorMsg}`);
      setSuccessMessage(null);
      return false;
    } finally {
      setAssigningRows(prev => ({ ...prev, [rowKey]: false }));
    }
  }
  
  // Check if a period already has a substitution assigned
  function getAssignedSubstitute(period, classname) {
    const substitution = substitutions.find(sub => 
      Number(sub.period) === Number(period) && 
      String(sub.class) === String(classname)
    );
    return substitution ? (substitution.substituteTeacher || substitution.teacher) : null;
  }
  
  // Show appropriate status message for a period
  function getStatusForPeriod(period) {
    if (loading) return null;
    
    const availableTeachers = freeTeachers[period] || [];
    if (availableTeachers.length === 0) {
      return (
        <div className="text-red-600 text-sm">
          No available teachers
        </div>
      );
    }
    return null;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} transition-colors duration-300`}>Substitutions</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-300 btn-animate"
            title="Refresh substitutions list"
            disabled={refreshing}
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </button>
          <button 
            className="bg-blue-600 dark:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-300 btn-animate"
          >
            <Plus className="h-5 w-5 mr-2" /> 
            Assign Substitution
          </button>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            {successMessage}
          </div>
        </div>
      )}
      
      {assignError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">✗</span>
            {assignError}
          </div>
        </div>
      )}
      
      {/* Selection controls */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 md:p-6 rounded-lg shadow-sm transition-colors duration-300`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-300`}>
              <Calendar className="inline h-4 w-4 mr-1 -mt-1" /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500 transition-colors duration-300`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-300`}>
              <User className="inline h-4 w-4 mr-1 -mt-1" /> Absent Teacher
            </label>
            <select
              value={absentTeacher}
              onChange={(e) => {
                const val = e.target.value;
                const found = absentTeachers.find(t => (t.email === val || t.name === val));
                // prefer email identifier when available
                setAbsentTeacher(found ? (found.email || found.name) : val);
              }}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500 transition-colors duration-300`}
            >
              <option value="">Select Teacher</option>
              {absentTeachers.map((teacher, idx) => (
                <option
                  key={`${(teacher && (teacher.email || teacher.name)) || String(teacher) || 'teacher'}-${idx}`}
                  value={(teacher && (teacher.email || teacher.name)) || String(teacher)}
                >
                  { (teacher && (teacher.name || teacher.email)) || String(teacher) }
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Existing Substitutions for the Day */}
      {substitutions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-green-700 border-b pb-2">
            Substitutions Assigned for {date}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {substitutions.map((sub, index) => (
                  <tr key={`existing-${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.absentTeacher}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-green-600 font-medium flex items-center">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        {sub.substituteTeacher || sub.teacher}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Teacher's timetable */}
      {absentTeacher && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-blue-400 border-gray-700' : 'text-blue-700 border-gray-200'} border-b pb-2 transition-colors duration-300`}>
            {(absentTeachers.find(t => (t.email === absentTeacher || t.name === absentTeacher))?.name || absentTeacher) + "'s Timetable"}
          </h2>
          
          {loading && (
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {!loading && timetable.length > 0 && (
            <table className={`min-w-full border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} shadow-sm rounded-lg overflow-hidden responsive-table transition-colors duration-300`}>
              <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} transition-colors duration-300`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Period</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Class</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Subject</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Substitute Teacher</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Status</th>
                </tr>
              </thead>
              <tbody className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'} transition-colors duration-300`}>
                {timetable.map((slot, index) => {
                  const assignedTeacher = getAssignedSubstitute(slot.period, slot.class);
                  const availableTeachers = freeTeachers[slot.period] || [];
                  const rowKey = `${slot.period}-${slot.class}`;
                  const isAssigning = assigningRows[rowKey] || false;
                  
                  return (
                    <tr key={rowKey} className={`${theme === 'dark' ? 
                      (index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750') :
                      (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')} transition-colors duration-300`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b">{slot.period}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b">{slot.class}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b">{slot.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border-b">
                        {assignedTeacher ? (
                          <div className="text-green-600 font-medium flex items-center">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            {assignedTeacher}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              <select
                                className={`w-full border rounded px-2 py-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} transition-colors duration-300`}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const found = availableTeachers.find(t => (t.email === val || t.name === val));
                                  setSelectedSubstitutes(prev => ({ ...prev, [rowKey]: found || val }));
                                }}
                                value={selectedSubstitutes[rowKey] ? (selectedSubstitutes[rowKey].email || selectedSubstitutes[rowKey].name || selectedSubstitutes[rowKey]) : ''}
                                disabled={loading || isAssigning || availableTeachers.length === 0}
                              >
                                <option value="">Select teacher</option>
                                {availableTeachers.map((teacher, idx) => (
                                  <option
                                    key={`${(teacher && (teacher.email || teacher.name)) || String(teacher) || 'free'}-${idx}`}
                                    value={(teacher && (teacher.email || teacher.name)) || String(teacher)}
                                  >
                                    {(teacher && (teacher.name || teacher.email)) || String(teacher)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <button
                                className="ml-2 bg-green-600 dark:bg-green-700 text-white rounded px-3 py-1 text-sm flex items-center hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-300 btn-animate"
                                onClick={async () => {
                                  const sel = selectedSubstitutes[rowKey];
                                  await handleSubstituteAssign(slot.period, slot.class, slot.subject, sel);
                                  // Note: handleSubstituteAssign now clears the selection automatically
                                }}
                                disabled={loading || isAssigning || !selectedSubstitutes[rowKey]}
                              >
                                {isAssigning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : null}
                                Assign
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border-b">
                        {assignedTeacher ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Assigned
                          </span>
                        ) : (
                          getStatusForPeriod(slot.period)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {!loading && timetable.length === 0 && (
            <div className={`text-center py-10 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} transition-colors duration-300`}>
              <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} transition-colors duration-300`}>
                <p className="text-xl font-medium mb-2">No timetable entries found</p>
                <p className="mb-4">There are no classes scheduled for {absentTeacher} on {new Date(date).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Substitutions list */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'} transition-colors duration-300`}>
            Substitutions for {new Date(date).toLocaleDateString()}
          </h2>
          <button 
            onClick={handleRefresh}
            className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-3 py-1.5 flex items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-300"
            disabled={refreshing}
          >
            {refreshing ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </button>
        </div>
        
        {substitutions.length > 0 ? (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {substitutions.map((sub, index) => (
                <tr key={`${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.period}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sub.absentTeacher || (absentTeachers.find(t => (t.email === absentTeacher || t.name === absentTeacher))?.name) || absentTeacher}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">{sub.substituteTeacher || sub.teacher}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No substitutions assigned for this date.
          </div>
        )}
      </div>
    </div>
  );
}